// ═════════════════════════════════════════════════════════════════════════════
// 🚗 우리 동네 (산본): 그림 지도 위의 장소를 누르면 아빠 차·버스·걸어서 유나가 이동한다
//  - 지도: 캔버스 한 장. 고정 배경(언덕·수리산·길·철길·아파트)은 buildLayer 로 크기가 바뀔 때만 그리고,
//    구름·전철·지나가는 차·장소 그림·유나·아빠 차·버스는 매 프레임
//  - 길·버스 노선은 townData.js (실제 경기버스 노선, scripts/update-bus.mjs)
//  - 흐름: 장소 콕 → '무엇을 타고 갈까?'(아빠 차 / 버스 / 걷기) → 이동 → 도착 카드 + 도장
//    버스: 우리집 앞 정류장에서 들어오는 버스 중 목적지에 가는 버스를 골라 타고, 내릴 때 벨을 누른다
//  - 유나 그림은 그림책(StoryBook.jsx)의 drawYuna 를 그대로 쓴다
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { drawYuna } from './StoryBook.jsx';
import { TOWNS, TOWN_LIST, ALL_TOWN_SPOTS, busStyle, busLabel, loadTown, saveTown, WORLD, toWorld, crossRail } from './townData.js';
// 지금 보고 있는 동네 (산본·안양). 동네를 옮기면 바뀌고, 지도 그림·길찾기는 모두 이것을 쓴다
let T = TOWNS.sanbon;
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };
const nodeUV = (i) => ({ u: T.NODES[i].u, v: T.NODES[i].v });

// 산 언덕은 동네마다 (T.hills: u, v, 반지름 u, 반지름 v)
const inHill = (p, pad = 1) => T.hills.some(([u, v, ru, rv]) => ((p.u - u) / ru) ** 2 + ((p.v - v) / rv) ** 2 < pad);
const nearRiver = (p, k = 0.035) => !!T.river && T.river.some((a, i) => i > 0 && segDist(p.u, p.v * 0.6, T.river[i - 1].u, T.river[i - 1].v * 0.6, a.u, a.v * 0.6) < k);

// ═══════════════ 배치 ═══════════════
// 동네 지도를 꽉 채워 보는 카메라
const townView = (tw) => ({ u: tw.off.u, v: tw.off.v, ku: tw.k.u, kv: tw.k.v });
// cam: 화면 왼쪽 위가 온 동네 지도의 어디인지 (없으면 지금 동네 그대로). X·Y = 지금 동네 좌표, XW·YW = 온 동네 좌표
function layout(W, H, cam) {
  const s = Math.max(0.62, Math.min(1.35, Math.min(W, H) / 720));
  const ox = W * 0.015, oy = H * 0.05, mw = W * 0.97, mh = H * 0.92;
  const c = cam || townView(T);
  const XW = (p) => ox + (p.u - c.u) / c.ku * mw, YW = (p) => oy + (p.v - c.v) / c.kv * mh;
  const X = (p) => XW({ u: T.off.u + p.u * T.k.u }), Y = (p) => YW({ v: T.off.v + p.v * T.k.v });
  return { W, H, s, ox, oy, mw, mh, X, Y, XW, YW, cam: c };
}
const toUV = (L, x, y) => ({ u: (x - L.ox) / L.mw, v: (y - L.oy) / L.mh });

// ═══════════════ 고정 배경 ═══════════════
function strokePath(c, L, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(L.X(p), L.Y(p)) : c.moveTo(L.X(p), L.Y(p)))); c.stroke(); }
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
function drawTree(c, x, y, r, col = '#4ea24a') {
  c.fillStyle = 'rgba(30,60,20,0.18)'; ell(c, x + r * 0.2, y + r * 0.15, r * 0.9, r * 0.35); c.fill();
  c.fillStyle = '#8b5a2b'; c.fillRect(x - r * 0.12, y - r * 0.5, r * 0.24, r * 0.55);
  c.fillStyle = col; ell(c, x, y - r * 0.95, r * 0.75, r * 0.7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.22)'; ell(c, x - r * 0.25, y - r * 1.15, r * 0.3, r * 0.22); c.fill();
}
function drawBuilding(c, x, y, w, h, col, roof) {
  const d = w * 0.28;
  c.fillStyle = 'rgba(40,50,30,0.2)'; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + d * 1.4, y - d * 0.5); c.lineTo(x + w + d * 1.4, y - h * 0.5); c.lineTo(x + w, y - h * 0.4); c.fill();
  c.fillStyle = col; c.fillRect(x, y - h, w, h);
  c.fillStyle = 'rgba(0,0,0,0.1)'; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + d, y - d * 0.6); c.lineTo(x + w + d, y - h - d * 0.6); c.lineTo(x + w, y - h); c.fill();
  c.fillStyle = roof; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + d, y - h - d * 0.6); c.lineTo(x + w + d, y - h - d * 0.6); c.lineTo(x + w, y - h); c.fill();
  c.fillStyle = 'rgba(80,110,150,0.55)';
  const rows = Math.max(2, Math.floor(h / (w * 0.32))), cols = 2;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) c.fillRect(x + w * (0.18 + j * 0.42), y - h + h * (0.1 + i * 0.85 / rows), w * 0.22, h * 0.45 / rows);
}

function buildLayer(L, dpr) {
  const cv = document.createElement('canvas'); cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const { W, H, s, X, Y } = L;
  // 풀밭
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c9ecb0'); g.addColorStop(1, '#a9dc8c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(7);
  for (let i = 0; i < 260; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(60,120,40,0.12)'; ell(c, r() * W, r() * H, (2 + r() * 5) * s, (1 + r() * 2) * s); c.fill(); }
  // 수리산 (뒤에서 앞으로)
  // 냇물 (안양천): 풀 둑 → 물
  if (T.river) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#b7e4a0'; c.lineWidth = 44 * s; strokePath(c, L, T.river);
    c.strokeStyle = '#7cc4f2'; c.lineWidth = 24 * s; strokePath(c, L, T.river);
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 3 * s; c.setLineDash([10 * s, 18 * s]); strokePath(c, L, T.river); c.setLineDash([]);
  }
  [...T.hills].sort((a, b) => a[1] - b[1]).forEach(([u, v, ru, rv], k) => {
    const x = X({ u, v }), y = Y({ u, v }), rx = ru * L.mw, ry = rv * L.mh;
    const hg = c.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, Math.max(rx, ry));
    hg.addColorStop(0, '#86cf6f'); hg.addColorStop(0.7, '#4f9e48'); hg.addColorStop(1, '#3f8a3c');
    c.fillStyle = hg; ell(c, x, y, rx, ry); c.fill();
    const rr = rng(40 + k);
    for (let i = 0; i < 26; i++) { const a = rr() * TAU, q = Math.sqrt(rr()) * 0.85; drawTree(c, x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q, (6 + rr() * 5) * s, rr() < 0.5 ? '#2f7d32' : '#3c8f3a'); }
  });
  // 공원·꽃동산 바닥
  const parks = T.TOWN_SPOTS.filter(sp => sp.kind === 'park'), flowers = T.TOWN_SPOTS.filter(sp => sp.kind === 'azalea');
  parks.forEach(pk => { c.fillStyle = '#8fd97c'; ell(c, X(pk.r), Y(pk.r), 0.04 * L.mw, 0.035 * L.mh); c.fill(); });
  flowers.forEach(az => { c.fillStyle = '#f9c5dc'; ell(c, X(az.a), Y(az.a) + 6 * s, 0.05 * L.mw, 0.04 * L.mh); c.fill(); });
  // 길: 테두리 → 바탕
  const rw = 7 * s;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const roadPass = (w, col) => {
    c.strokeStyle = col; c.lineWidth = w;
    T.EDGES.forEach(([a, b]) => { c.beginPath(); c.moveTo(X(T.NODES[a]), Y(T.NODES[a])); c.lineTo(X(T.NODES[b]), Y(T.NODES[b])); c.stroke(); });
    T.TOWN_SPOTS.forEach(sp => { if (sp.link) return; c.beginPath(); c.moveTo(X(sp.r), Y(sp.r)); c.lineTo(X(T.NODES[sp.node]), Y(T.NODES[sp.node])); c.stroke(); });
  };
  roadPass(rw + 4 * s, '#9aa1a9'); roadPass(rw, '#eef0f2');
  // 수리산 산길
  T.TOWN_SPOTS.filter(sp => sp.link).forEach(ms => {
    c.setLineDash([6 * s, 5 * s]); c.strokeStyle = '#a16207'; c.lineWidth = 3.5 * s;
    c.beginPath(); c.moveTo(X(T.NODES[ms.node]), Y(T.NODES[ms.node])); c.lineTo(X(ms.r), Y(ms.r)); c.stroke(); c.setLineDash([]);
  });
  // 철길
  T.RAILS.forEach(rl => {
    c.strokeStyle = '#b8b2aa'; c.lineWidth = 12 * s; strokePath(c, L, rl.pts);
    c.strokeStyle = '#7c4a1e'; c.lineWidth = 2 * s;
    for (let i = 1; i < rl.pts.length; i++) {
      const ax = X(rl.pts[i - 1]), ay = Y(rl.pts[i - 1]), bx = X(rl.pts[i]), by = Y(rl.pts[i]), len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (let d = 0; d < len; d += 8 * s) { const x = ax + (bx - ax) * d / len, y = ay + (by - ay) * d / len; c.beginPath(); c.moveTo(x - nx * 6 * s, y - ny * 6 * s); c.lineTo(x + nx * 6 * s, y + ny * 6 * s); c.stroke(); }
    }
    c.strokeStyle = rl.dark; c.lineWidth = 1.6 * s;
    [-3, 3].forEach(off => {
      c.beginPath();
      rl.pts.forEach((p, i) => {
        const q = rl.pts[Math.min(i + 1, rl.pts.length - 1)], o = rl.pts[Math.max(i - 1, 0)], dx = X(q) - X(o), dy = Y(q) - Y(o), l = Math.hypot(dx, dy) || 1;
        const x = X(p) - dy / l * off * s, y = Y(p) + dx / l * off * s; if (i) c.lineTo(x, y); else c.moveTo(x, y);
      });
      c.stroke();
    });
  });
  // 아파트·나무 채우기 (길·철길·장소·산 피해서)
  const segs = [];
  T.EDGES.forEach(([a, b]) => segs.push([X(T.NODES[a]), Y(T.NODES[a]), X(T.NODES[b]), Y(T.NODES[b]), rw]));
  T.RAILS.forEach(rl => { for (let i = 1; i < rl.pts.length; i++) segs.push([X(rl.pts[i - 1]), Y(rl.pts[i - 1]), X(rl.pts[i]), Y(rl.pts[i]), 12 * s]); });
  T.TOWN_SPOTS.forEach(sp => segs.push([X(sp.r), Y(sp.r), X(T.NODES[sp.node]), Y(T.NODES[sp.node]), rw]));
  const blocks = [], step = 30 * s, rb = rng(3);
  const pastel = ['#fde2e4', '#fff1c1', '#dbeafe', '#e0f2e9', '#f3e8ff', '#ffe4cc', '#fefce8'];
  const roofs = ['#f87171', '#fb923c', '#60a5fa', '#34d399', '#a78bfa', '#f472b6'];
  const items = [];
  for (let y = step * 0.7; y < H; y += step) for (let x = step * 0.5; x < W; x += step) {
    const px = x + (rb() - 0.5) * step * 0.5, py = y + (rb() - 0.5) * step * 0.4, p = toUV(L, px, py);
    if (inHill(p, 1.15)) continue;
    if (nearRiver(p)) { if (rb() < 0.3 && !nearRiver(p, 0.02)) items.push({ k: 't', x: px, y: py }); continue; }
    const bw = (13 + rb() * 7) * s, bh = (16 + rb() * 18) * s;
    if (segs.some(([ax, ay, bx, by, w]) => segDist(px, py - bh * 0.4, ax, ay, bx, by) < w / 2 + bh * 0.55 + 3 * s)) continue;
    if (T.TOWN_SPOTS.some(sp => Math.hypot(X(sp.a) - px, Y(sp.a) - py + 20 * s) < 62 * s)) continue;
    if (parks.some(pk => Math.hypot(X(pk.r) - px, Y(pk.r) - py) < 0.045 * L.mw)) { items.push({ k: 't', x: px, y: py }); continue; }
    if (flowers.some(az => Math.hypot(X(az.a) - px, Y(az.a) - py) < 0.055 * L.mw)) continue;
    items.push(rb() < 0.72 ? { k: 'b', x: px - bw / 2, y: py, w: bw, h: bh, col: pastel[Math.floor(rb() * pastel.length)], roof: roofs[Math.floor(rb() * roofs.length)] } : { k: 't', x: px, y: py });
  }
  items.sort((a, b) => a.y - b.y).forEach(it => {
    if (it.k === 'b') { drawBuilding(c, it.x, it.y, it.w, it.h, it.col, it.roof); blocks.push(it); }
    else drawTree(c, it.x, it.y, 7 * s, '#4ea24a');
  });
  // 동네 이름 (예: 산본 지도 오른쪽 아래 '군포 당동·당정동')
  T.areas.forEach(ar => {
    const fs = Math.round(26 * s); c.font = `${fs}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const x = X({ u: ar.at[0], v: ar.at[1] }), y = Y({ u: ar.at[0], v: ar.at[1] }), tw = c.measureText(ar.name).width + fs;
    c.fillStyle = 'rgba(255,255,255,0.75)'; rrect(c, x - tw / 2, y - fs * 0.75, tw, fs * 1.5, fs * 0.75); c.fill();
    c.fillStyle = '#0f766e'; c.fillText(ar.name, x, y + 1);
  });
  return { cv, blocks };
}

// ═══════════════ 장소 그림 (원점 = 아래 가운데) ═══════════════
function drawSpot(c, sp, x, y, u, t, opt) {
  c.save(); c.translate(x, y);
  const bob = opt.sel ? Math.abs(Math.sin(t * 5)) * u * 0.18 : 0;
  c.translate(0, -bob);
  if (opt.sel) { c.fillStyle = `rgba(250,204,21,${0.35 + 0.25 * Math.sin(t * 6)})`; ell(c, 0, -u * 0.5, u * 1.9, u * 1.3); c.fill(); }
  c.fillStyle = 'rgba(30,50,20,0.22)'; ell(c, 0, 0, u * 1.25, u * 0.28); c.fill();
  const K = sp.kind;
  if (K === 'home' || K === 'grandma') {
    const gm = K === 'grandma', w = u * 1.25, h = u * 2.0;
    c.fillStyle = gm ? '#dcfce7' : '#fef3c7'; rrect(c, -w / 2, -h, w, h, u * 0.08); c.fill(); c.strokeStyle = gm ? '#15803d' : '#d97706'; c.lineWidth = u * 0.06; c.stroke();
    c.fillStyle = gm ? '#22c55e' : '#f97316'; rrect(c, -w / 2 - u * 0.06, -h - u * 0.16, w + u * 0.12, u * 0.22, u * 0.06); c.fill();
    c.fillStyle = '#7dd3fc'; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) c.fillRect(-w / 2 + w * (0.12 + j * 0.29), -h + h * (0.1 + i * 0.16), w * 0.18, h * 0.09);
    c.fillStyle = '#a16207'; rrect(c, -u * 0.18, -u * 0.38, u * 0.36, u * 0.38, u * 0.06); c.fill();
    if (gm) {
      c.font = `${Math.round(u * 0.62)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('👵', -u * 0.32, -h - u * 0.55 + Math.sin(t * 3) * u * 0.05); c.fillText('👴', u * 0.36, -h - u * 0.55 + Math.sin(t * 3 + 1.5) * u * 0.05);
    } else {
    // 하트 깃발
    c.strokeStyle = '#64748b'; c.lineWidth = u * 0.06; c.beginPath(); c.moveTo(w * 0.3, -h - u * 0.16); c.lineTo(w * 0.3, -h - u * 1.0); c.stroke();
    const fx = w * 0.3, fy = -h - u * 0.95, wv = Math.sin(t * 4) * u * 0.06;
    c.fillStyle = '#f472b6'; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + u * 0.35, fy - u * 0.1 + wv, fx + u * 0.7, fy + wv); c.lineTo(fx + u * 0.7, fy + u * 0.38 + wv); c.quadraticCurveTo(fx + u * 0.35, fy + u * 0.28 - wv, fx, fy + u * 0.38); c.fill();
    c.fillStyle = '#ffffff'; c.font = `${Math.round(u * 0.3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♥', fx + u * 0.35, fy + u * 0.19 + wv);
    }
  } else if (K === 'youth') {
    // 알록달록 2층 건물 + 날개 달린 별 간판
    const w = u * 1.7, h = u * 1.25;
    c.fillStyle = '#ede9fe'; rrect(c, -w / 2, -h, w, h, u * 0.1); c.fill(); c.strokeStyle = '#7c3aed'; c.lineWidth = u * 0.06; c.stroke();
    ['#f472b6', '#facc15', '#38bdf8', '#4ade80'].forEach((col, i) => { c.fillStyle = col; c.fillRect(-w / 2 + w * (0.08 + i * 0.22), -h * 0.85, w * 0.16, h * 0.28); });
    c.fillStyle = '#7dd3fc'; c.fillRect(-w * 0.4, -h * 0.45, w * 0.45, h * 0.3); c.fillStyle = '#6d28d9'; rrect(c, w * 0.12, -h * 0.45, w * 0.22, h * 0.45, u * 0.05); c.fill();
    const fy = -h - u * 0.45 + Math.sin(t * 3) * u * 0.08;
    c.fillStyle = '#ffffff'; [-1, 1].forEach(sd => { c.beginPath(); c.ellipse(sd * u * 0.38, fy, u * 0.28, u * 0.12, sd * -0.5 + Math.sin(t * 8) * 0.25 * sd, 0, TAU); c.fill(); });
    c.font = `${Math.round(u * 0.55)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⭐', 0, fy);
  } else if (K === 'station') {
    const w = u * 2.1, h = u * 0.95;
    c.fillStyle = '#e0f2fe'; rrect(c, -w / 2, -h, w, h, u * 0.08); c.fill(); c.strokeStyle = '#0369a1'; c.lineWidth = u * 0.06; c.stroke();
    c.fillStyle = '#0284c7'; c.beginPath(); c.moveTo(-w / 2 - u * 0.15, -h); c.lineTo(-w / 2 + u * 0.15, -h - u * 0.4); c.lineTo(w / 2 - u * 0.15, -h - u * 0.4); c.lineTo(w / 2 + u * 0.15, -h); c.fill();
    c.fillStyle = '#93c5fd'; [-0.62, -0.2, 0.22, 0.64].forEach(q => c.fillRect(q * u - u * 0.15, -h * 0.75, u * 0.3, h * 0.35));
    c.fillStyle = '#334155'; rrect(c, -u * 0.2, -h * 0.5, u * 0.4, h * 0.5, u * 0.05); c.fill();
    const lines = (sp.lines || ['4']).map(n => [n, n === '1' ? '#1e3a8a' : '#0ea5e9']);
    lines.forEach(([n, col], i) => {
      const bx = (i - (lines.length - 1) / 2) * u * 0.5, by = -h - u * 0.62;
      c.fillStyle = col; c.beginPath(); c.arc(bx, by, u * 0.22, 0, TAU); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = u * 0.05; c.stroke();
      c.fillStyle = '#ffffff'; c.font = `bold ${Math.round(u * 0.3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, bx, by + u * 0.01);
    });
  } else if (K === 'shops') {
    const cols = [['#fecaca', '#ef4444'], ['#fde68a', '#f59e0b'], ['#bbf7d0', '#16a34a']];
    cols.forEach(([b, a], i) => {
      const x0 = -u * 1.05 + i * u * 0.7, w = u * 0.68, h = u * (1.0 + (i % 2) * 0.3);
      c.fillStyle = b; c.fillRect(x0, -h, w, h); c.fillStyle = '#7dd3fc'; c.fillRect(x0 + w * 0.15, -h * 0.55, w * 0.7, h * 0.3);
      for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ffffff' : a; c.beginPath(); c.moveTo(x0 + k * w / 4, -h * 0.68); c.lineTo(x0 + (k + 1) * w / 4, -h * 0.68); c.lineTo(x0 + (k + 1) * w / 4, -h * 0.58); c.arc(x0 + (k + 0.5) * w / 4, -h * 0.58, w / 8, 0, Math.PI); c.fill(); }
    });
    c.font = `${Math.round(u * 0.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎈', u * 1.0, -u * 1.55 + Math.sin(t * 2) * u * 0.08);
  } else if (K === 'hall') {
    const w = u * 2.0, h = u * 1.1;
    c.fillStyle = '#f8fafc'; c.fillRect(-w / 2, -h, w, h); c.strokeStyle = '#94a3b8'; c.lineWidth = u * 0.05; c.strokeRect(-w / 2, -h, w, h);
    c.fillStyle = '#cbd5e1'; for (let i = 0; i < 5; i++) c.fillRect(-w / 2 + w * (0.08 + i * 0.2), -h * 0.85, w * 0.06, h * 0.85);
    c.fillStyle = '#e2e8f0'; c.beginPath(); c.moveTo(-w / 2 - u * 0.1, -h); c.lineTo(0, -h - u * 0.5); c.lineTo(w / 2 + u * 0.1, -h); c.fill(); c.stroke();
    c.strokeStyle = '#64748b'; c.lineWidth = u * 0.05; c.beginPath(); c.moveTo(0, -h - u * 0.5); c.lineTo(0, -h - u * 1.2); c.stroke();
    c.fillStyle = '#3b82f6'; const wv = Math.sin(t * 4) * u * 0.05; c.beginPath(); c.moveTo(0, -h - u * 1.2); c.lineTo(u * 0.55, -h - u * 1.1 + wv); c.lineTo(0, -h - u * 0.9); c.fill();
  } else if (K === 'mart') {
    const w = u * 2.3, h = u * 1.0;
    c.fillStyle = '#fef9c3'; c.fillRect(-w / 2, -h, w, h); c.fillStyle = '#facc15'; c.fillRect(-w / 2, -h, w, h * 0.3);
    c.fillStyle = '#7dd3fc'; c.fillRect(-w * 0.4, -h * 0.55, w * 0.8, h * 0.4); c.fillStyle = '#475569'; c.fillRect(-u * 0.22, -h * 0.55, u * 0.44, h * 0.55);
    c.fillStyle = '#854d0e'; c.font = `${Math.round(u * 0.26)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('마트', 0, -h * 0.85);
    c.font = `${Math.round(u * 0.6)}px sans-serif`; c.fillText('🛒', w * 0.6, -u * 0.3);
  } else if (K === 'park') {
    c.fillStyle = '#93c5fd'; ell(c, 0, -u * 0.2, u * 0.95, u * 0.35); c.fill(); c.strokeStyle = '#e5e7eb'; c.lineWidth = u * 0.12; c.stroke();
    c.strokeStyle = 'rgba(191,219,254,0.95)'; c.lineWidth = u * 0.07;
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.35, hh = u * (1.0 + 0.15 * Math.sin(t * 6 + i)); c.beginPath(); c.moveTo(0, -u * 0.3); c.quadraticCurveTo(Math.sin(a) * u * 0.7, -u * 0.3 - hh, Math.sin(a) * u * 0.9, -u * 0.25); c.stroke(); }
    drawTree(c, -u * 1.3, -u * 0.05, u * 0.55, '#3f9a3c'); drawTree(c, u * 1.3, -u * 0.1, u * 0.6, '#4ea24a');
  } else if (K === 'market') {
    [['#ef4444', -0.75], ['#3b82f6', 0], ['#f59e0b', 0.75]].forEach(([col, q], i) => {
      const x0 = q * u, w = u * 0.7, h = u * 0.85;
      c.fillStyle = '#fff7ed'; c.fillRect(x0 - w / 2, -h * 0.6, w, h * 0.6);
      for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ffffff' : col; c.beginPath(); c.moveTo(x0 - w / 2 + k * w / 4, -h * 0.6); c.lineTo(x0 - w / 2 + k * w / 4 + w / 8, -h); c.lineTo(x0 - w / 2 + (k + 1) * w / 4 + w / 8 - w / 8, -h); c.lineTo(x0 - w / 2 + (k + 1) * w / 4, -h * 0.6); c.fill(); }
      const fr = [['#ef4444', '#f97316', '#facc15'], ['#22c55e', '#a3e635', '#16a34a'], ['#f472b6', '#c084fc', '#fb7185']][i];
      fr.forEach((f, j) => { c.fillStyle = f; c.beginPath(); c.arc(x0 - w * 0.25 + j * w * 0.25, -h * 0.5, u * 0.09, 0, TAU); c.fill(); });
    });
  } else if (K === 'azalea') {
    const rr = rng(9);
    for (let i = 0; i < 16; i++) { const x = (rr() - 0.5) * u * 2.4, y = -rr() * u * 0.9; c.fillStyle = '#4d7c0f'; ell(c, x, y, u * 0.3, u * 0.2); c.fill(); c.fillStyle = ['#ec4899', '#f472b6', '#f9a8d4', '#db2777'][i % 4]; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + (rr() - 0.5) * u * 0.4, y - u * 0.05 + (rr() - 0.5) * u * 0.2, u * 0.08, 0, TAU); c.fill(); } }
    const bf = t * 1.5; c.font = `${Math.round(u * 0.45)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🦋', Math.sin(bf) * u * 0.9, -u * 1.3 + Math.sin(bf * 2.3) * u * 0.2);
  } else if (K === 'pond') {
    c.fillStyle = '#60a5fa'; ell(c, 0, -u * 0.3, u * 1.2, u * 0.45); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; ell(c, -u * 0.4, -u * 0.4, u * 0.3, u * 0.08); c.fill();
    c.strokeStyle = '#4d7c0f'; c.lineWidth = u * 0.06; [-1.1, -0.95, 1.0, 1.15].forEach(q => { c.beginPath(); c.moveTo(q * u, -u * 0.15); c.lineTo(q * u + Math.sin(t * 2 + q) * u * 0.05, -u * 0.85); c.stroke(); });
    const dx = Math.sin(t * 0.8) * u * 0.5, dy = -u * 0.38 + Math.sin(t * 3) * u * 0.03;
    c.fillStyle = '#fde047'; ell(c, dx, dy, u * 0.24, u * 0.14); c.fill(); c.beginPath(); c.arc(dx + u * 0.18, dy - u * 0.16, u * 0.12, 0, TAU); c.fill();
    c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(dx + u * 0.28, dy - u * 0.17); c.lineTo(dx + u * 0.4, dy - u * 0.14); c.lineTo(dx + u * 0.28, dy - u * 0.11); c.fill();
    c.fillStyle = '#1f2937'; c.beginPath(); c.arc(dx + u * 0.21, dy - u * 0.19, u * 0.025, 0, TAU); c.fill();
  } else if (K === 'dept') {
    // 높은 백화점 + 유리 엘리베이터
    const w = u * 1.7, h = u * 2.2;
    c.fillStyle = '#fdf2f8'; rrect(c, -w / 2, -h, w, h, u * 0.08); c.fill(); c.strokeStyle = '#db2777'; c.lineWidth = u * 0.06; c.stroke();
    c.fillStyle = '#ec4899'; c.fillRect(-w / 2, -h, w, u * 0.32);
    c.fillStyle = '#ffffff'; c.font = `${Math.round(u * 0.24)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('백화점', 0, -h + u * 0.17);
    c.fillStyle = '#bae6fd'; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) c.fillRect(-w / 2 + w * (0.1 + j * 0.24), -h + u * 0.45 + i * u * 0.36, w * 0.16, u * 0.22);
    c.fillStyle = 'rgba(14,165,233,0.35)'; c.fillRect(w * 0.3, -h + u * 0.4, w * 0.16, h - u * 0.4);
    const ey = -u * 0.35 - ((Math.sin(t * 0.8) + 1) / 2) * (h - u * 1.0);
    c.fillStyle = '#f59e0b'; c.fillRect(w * 0.31, ey, w * 0.14, u * 0.28);
    c.fillStyle = '#475569'; rrect(c, -u * 0.25, -u * 0.42, u * 0.5, u * 0.42, u * 0.05); c.fill();
  } else if (K === 'stadium') {
    // 타원 경기장 + 초록 잔디 + 굴러가는 공
    c.fillStyle = '#e2e8f0'; ell(c, 0, -u * 0.55, u * 1.55, u * 0.7); c.fill(); c.strokeStyle = '#64748b'; c.lineWidth = u * 0.06; c.stroke();
    c.fillStyle = '#ef4444'; ell(c, 0, -u * 0.55, u * 1.3, u * 0.55); c.fill();
    c.fillStyle = '#22c55e'; ell(c, 0, -u * 0.55, u * 1.0, u * 0.38); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = u * 0.04; c.beginPath(); c.moveTo(0, -u * 0.92); c.lineTo(0, -u * 0.18); c.stroke(); ell(c, 0, -u * 0.55, u * 0.18, u * 0.1); c.stroke();
    c.font = `${Math.round(u * 0.42)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('⚽', Math.sin(t * 1.6) * u * 0.7, -u * 0.6 + Math.abs(Math.sin(t * 3.2)) * -u * 0.15);
    [-1, 1].forEach(k => { c.strokeStyle = '#94a3b8'; c.lineWidth = u * 0.05; c.beginPath(); c.moveTo(k * u * 1.2, -u * 0.9); c.lineTo(k * u * 1.2, -u * 1.6); c.stroke(); c.fillStyle = '#fde68a'; ell(c, k * u * 1.2, -u * 1.65, u * 0.16, u * 0.1); c.fill(); });
  } else if (K === 'river') {
    // 냇가 자전거길 + 오리
    c.fillStyle = '#7cc4f2'; ell(c, 0, -u * 0.25, u * 1.35, u * 0.4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = u * 0.05; [-0.4, 0.3].forEach((q, i) => { c.beginPath(); c.arc(q * u + Math.sin(t * 2 + i) * u * 0.1, -u * 0.25, u * 0.2, 3.5, 5.9); c.stroke(); });
    c.font = `${Math.round(u * 0.55)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🚲', -u * 0.9 + ((t * 0.35) % 1) * u * 1.8, -u * 0.95);
    c.fillText('🦆', Math.sin(t * 0.7) * u * 0.6, -u * 0.32 + Math.sin(t * 3) * u * 0.03);
  } else if (K === 'post') {
    // 빨간 우체국 + 편지 봉투
    const w = u * 1.6, h = u * 1.1;
    c.fillStyle = '#fff7ed'; rrect(c, -w / 2, -h, w, h, u * 0.08); c.fill(); c.strokeStyle = '#ea580c'; c.lineWidth = u * 0.06; c.stroke();
    c.fillStyle = '#ef4444'; rrect(c, -w / 2 - u * 0.05, -h - u * 0.25, w + u * 0.1, u * 0.3, u * 0.06); c.fill();
    c.fillStyle = '#7dd3fc'; c.fillRect(-w * 0.4, -h * 0.7, w * 0.3, h * 0.35); c.fillStyle = '#475569'; rrect(c, w * 0.05, -h * 0.6, w * 0.25, h * 0.6, u * 0.04); c.fill();
    const ey = -h - u * 0.75 + Math.sin(t * 3) * u * 0.08;
    c.fillStyle = '#ffffff'; c.strokeStyle = '#ef4444'; c.lineWidth = u * 0.05; c.fillRect(-u * 0.32, ey, u * 0.64, u * 0.42); c.strokeRect(-u * 0.32, ey, u * 0.64, u * 0.42);
    c.beginPath(); c.moveTo(-u * 0.32, ey); c.lineTo(0, ey + u * 0.24); c.lineTo(u * 0.32, ey); c.stroke();
  } else if (K === 'school' || K === 'univ') {
    // 학교: 시계탑 건물 + 운동장(초등학교) / 큰 건물 + 학사모(대학교)
    const uni = K === 'univ', w = u * (uni ? 2.2 : 1.9), h = u * (uni ? 1.5 : 1.1);
    if (!uni) { c.fillStyle = '#d9a066'; ell(c, u * 0.2, u * 0.05, u * 1.3, u * 0.28); c.fill(); }
    c.fillStyle = uni ? '#e0e7ff' : '#fef3c7'; c.fillRect(-w / 2, -h, w, h); c.strokeStyle = uni ? '#4338ca' : '#b45309'; c.lineWidth = u * 0.05; c.strokeRect(-w / 2, -h, w, h);
    c.fillStyle = '#7dd3fc'; for (let i = 0; i < (uni ? 3 : 2); i++) for (let j = 0; j < 4; j++) c.fillRect(-w / 2 + w * (0.08 + j * 0.24), -h + h * (0.14 + i * (uni ? 0.28 : 0.4)), w * 0.14, h * (uni ? 0.16 : 0.22));
    c.fillStyle = uni ? '#6366f1' : '#f59e0b'; c.fillRect(-u * 0.25, -h - u * 0.55, u * 0.5, u * 0.55);
    c.fillStyle = '#ffffff'; ell(c, 0, -h - u * 0.3, u * 0.17, u * 0.17); c.fill();
    c.strokeStyle = '#1f2937'; c.lineWidth = u * 0.03; c.beginPath(); c.moveTo(0, -h - u * 0.3); c.lineTo(Math.cos(t) * u * 0.12, -h - u * 0.3 + Math.sin(t) * u * 0.12); c.stroke();
    if (uni) { c.font = `${Math.round(u * 0.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎓', w * 0.55, -h - u * 0.2 + Math.sin(t * 2) * u * 0.06); }
  } else if (K === 'outlet') {
    // 아울렛: 알록달록 지붕 가게 마을 + 깃발
    [['#f472b6', -1.05, 0.95], ['#60a5fa', -0.35, 1.25], ['#facc15', 0.35, 1.05], ['#34d399', 1.05, 0.9]].forEach(([col, q, hh]) => {
      const x0 = q * u - u * 0.33, w = u * 0.66, h = u * hh;
      c.fillStyle = '#fffbeb'; c.fillRect(x0, -h, w, h); c.strokeStyle = 'rgba(120,90,60,0.4)'; c.lineWidth = u * 0.03; c.strokeRect(x0, -h, w, h);
      c.fillStyle = col; c.beginPath(); c.moveTo(x0 - u * 0.06, -h); c.lineTo(x0 + w / 2, -h - u * 0.38); c.lineTo(x0 + w + u * 0.06, -h); c.fill();
      c.fillStyle = '#7dd3fc'; c.fillRect(x0 + w * 0.15, -h * 0.55, w * 0.7, h * 0.3);
    });
    c.strokeStyle = '#64748b'; c.lineWidth = u * 0.04; c.beginPath(); c.moveTo(-u * 0.35, -u * 1.6); c.lineTo(-u * 0.35, -u * 2.2); c.stroke();
    c.fillStyle = '#ef4444'; const wv = Math.sin(t * 4) * u * 0.05; c.beginPath(); c.moveTo(-u * 0.35, -u * 2.2); c.lineTo(u * 0.15, -u * 2.08 + wv); c.lineTo(-u * 0.35, -u * 1.96); c.fill();
  } else if (K === 'lake') {
    // 넓은 호수 + 오리배
    c.fillStyle = '#60a5fa'; ell(c, 0, -u * 0.3, u * 1.5, u * 0.55); c.fill(); c.strokeStyle = '#bbf7d0'; c.lineWidth = u * 0.1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = u * 0.05; [-0.6, 0.1, 0.7].forEach((q, i) => { c.beginPath(); c.arc(q * u + Math.sin(t * 1.5 + i) * u * 0.1, -u * 0.3, u * 0.22, 3.6, 5.8); c.stroke(); });
    const bx = Math.sin(t * 0.6) * u * 0.7, by = -u * 0.38 + Math.sin(t * 3) * u * 0.03;
    c.fillStyle = '#ffffff'; ell(c, bx, by, u * 0.32, u * 0.14); c.fill(); c.fillStyle = '#fde047'; c.beginPath(); c.arc(bx + u * 0.22, by - u * 0.2, u * 0.13, 0, TAU); c.fill();
    c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(bx + u * 0.33, by - u * 0.22); c.lineTo(bx + u * 0.46, by - u * 0.19); c.lineTo(bx + u * 0.33, by - u * 0.15); c.fill();
    drawTree(c, -u * 1.55, -u * 0.1, u * 0.55, '#3f9a3c'); drawTree(c, u * 1.6, -u * 0.15, u * 0.5, '#4ea24a');
  } else if (K === 'art') {
    // 예술대학: 흰 건물 + 커다란 팔레트와 붓
    const w = u * 2.0, h = u * 1.3;
    c.fillStyle = '#f8fafc'; c.fillRect(-w / 2, -h, w, h); c.strokeStyle = '#a855f7'; c.lineWidth = u * 0.05; c.strokeRect(-w / 2, -h, w, h);
    ['#f472b6', '#facc15', '#38bdf8', '#4ade80'].forEach((col, i) => { c.fillStyle = col; c.fillRect(-w / 2 + w * (0.08 + i * 0.23), -h * 0.75, w * 0.15, h * 0.32); });
    c.fillStyle = '#475569'; rrect(c, -u * 0.2, -h * 0.35, u * 0.4, h * 0.35, u * 0.04); c.fill();
    const py = -h - u * 0.55 + Math.sin(t * 2) * u * 0.06;
    c.fillStyle = '#fde68a'; ell(c, 0, py, u * 0.6, u * 0.38); c.fill(); c.strokeStyle = '#b45309'; c.lineWidth = u * 0.04; c.stroke();
    ['#ef4444', '#3b82f6', '#22c55e', '#a855f7'].forEach((col, i) => { c.fillStyle = col; ell(c, -u * 0.32 + i * u * 0.2, py - u * 0.08 + (i % 2) * u * 0.14, u * 0.08, u * 0.08); c.fill(); });
  } else if (K === 'tower') {
    // 유리 빌딩 셋 (반짝이는 창)
    [[-0.7, 1.9, '#bae6fd'], [0, 2.6, '#a5f3fc'], [0.7, 2.1, '#c7d2fe']].forEach(([q, hh, col], i) => {
      const x0 = q * u - u * 0.32, w = u * 0.64, h = u * hh;
      c.fillStyle = col; c.fillRect(x0, -h, w, h); c.strokeStyle = '#0369a1'; c.lineWidth = u * 0.04; c.strokeRect(x0, -h, w, h);
      for (let r = 0; r < Math.floor(hh * 3); r++) { c.fillStyle = (r + i + Math.floor(t * 2)) % 5 === 0 ? '#fef08a' : 'rgba(14,116,144,0.35)'; c.fillRect(x0 + w * 0.15, -h + u * 0.15 + r * u * 0.3, w * 0.7, u * 0.14); }
    });
  } else if (K === 'mountain') {
    c.fillStyle = '#2f7d32'; c.beginPath(); c.moveTo(-u * 1.5, 0); c.lineTo(-u * 0.4, -u * 1.7); c.lineTo(u * 0.2, -u * 1.0); c.lineTo(u * 0.7, -u * 1.45); c.lineTo(u * 1.5, 0); c.fill();
    c.fillStyle = '#4caf50'; c.beginPath(); c.moveTo(-u * 1.1, 0); c.lineTo(-u * 0.4, -u * 1.4); c.lineTo(u * 0.4, 0); c.fill();
    c.strokeStyle = '#64748b'; c.lineWidth = u * 0.05; c.beginPath(); c.moveTo(-u * 0.4, -u * 1.7); c.lineTo(-u * 0.4, -u * 2.25); c.stroke();
    c.fillStyle = '#ef4444'; const wv = Math.sin(t * 4) * u * 0.05; c.beginPath(); c.moveTo(-u * 0.4, -u * 2.25); c.lineTo(u * 0.1, -u * 2.12 + wv); c.lineTo(-u * 0.4, -u * 1.98); c.fill();
    c.font = `${Math.round(u * 0.45)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🐿️', u * 0.85, -u * 0.35 + Math.abs(Math.sin(t * 3)) * -u * 0.15);
  }
  // 이름표
  const fs = Math.round(u * 0.5);
  c.font = `${fs}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const label = sp.name + (opt.stamp ? ' 🏅' : ''), tw = c.measureText(label).width + fs * 0.9;
  c.fillStyle = opt.sel ? '#facc15' : 'rgba(255,255,255,0.95)'; rrect(c, -tw / 2, u * 0.25, tw, fs * 1.45, fs * 0.7); c.fill();
  const fam = sp.id === 'home' ? '#f472b6' : sp.id === 'grandma' ? '#22c55e' : null;
  c.strokeStyle = fam || 'rgba(120,90,60,0.35)'; c.lineWidth = fam ? 2.5 : 1.2; c.stroke();
  c.fillStyle = sp.id === 'home' ? '#be185d' : sp.id === 'grandma' ? '#166534' : '#4a3424'; c.fillText(label, 0, u * 0.25 + fs * 0.75);
  c.restore();
}

// 옆 동네 이정표 (원점 = 기둥 아래): 누르면 그 동네로 간다
function drawGateSign(c, name, x, y, u, t, arrow) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(30,50,20,0.22)'; ell(c, 0, 0, u * 0.7, u * 0.18); c.fill();
  c.fillStyle = '#8b5a2b'; c.fillRect(-u * 0.08, -u * 1.6, u * 0.16, u * 1.6);
  const bob = Math.sin(t * 3) * u * 0.05, w = u * 2.3, h = u * 0.85, by = -u * 2.3 + bob;
  c.fillStyle = '#0ea5e9'; rrect(c, -w / 2, by, w, h, u * 0.18); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = u * 0.08; c.stroke();
  c.fillStyle = '#ffffff'; c.font = `${Math.round(u * 0.46)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(arrow === '⬅' ? `⬅ ${name}` : `${name} ${arrow}`, 0, by + h / 2 + u * 0.02);
  c.fillStyle = '#0c4a6e'; c.font = `${Math.round(u * 0.3)}px ${JUA}`; c.fillText('옆 동네', 0, by - u * 0.25);
  c.restore();
}

// ═══════════════ 탈것 (옆모습, 원점 = 바퀴 아래 가운데, 오른쪽을 봄) ═══════════════
function headInWindow(c, x, y, r, t) {
  // 그림책 유나를 창문 크기에 맞춰 그린다 (머리 가운데가 x, y)
  const S = r / 0.2;
  c.save(); c.translate(x, y + S * 0.8); drawYuna(c, 'stand', S, t, false); c.restore();
}
function drawCar(c, x, y, len, dir, t, opt = {}) {
  const L = len, body = opt.color || '#f8fafc', edge = opt.edge || '#94a3b8';
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(20,30,20,0.25)'; ell(c, 0, 0, L * 0.5, L * 0.06); c.fill();
  c.translate(0, -(opt.bump || 0)); c.rotate(opt.ang || 0); c.scale(dir, 1);
  // 차체 (길고 낮은 세단)
  c.beginPath();
  c.moveTo(-L * 0.5, -L * 0.07); c.lineTo(-L * 0.5, -L * 0.19); c.quadraticCurveTo(-L * 0.47, -L * 0.235, -L * 0.36, -L * 0.24);
  c.lineTo(-L * 0.27, -L * 0.25); c.quadraticCurveTo(-L * 0.2, -L * 0.37, -L * 0.12, -L * 0.385); c.lineTo(L * 0.08, -L * 0.385);
  c.quadraticCurveTo(L * 0.15, -L * 0.37, L * 0.24, -L * 0.26); c.lineTo(L * 0.42, -L * 0.225); c.quadraticCurveTo(L * 0.5, -L * 0.2, L * 0.5, -L * 0.14);
  c.lineTo(L * 0.49, -L * 0.07); c.closePath();
  const bg = c.createLinearGradient(0, -L * 0.38, 0, -L * 0.07); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, body); bg.addColorStop(1, opt.color ? body : '#dfe5ec');
  c.fillStyle = bg; c.fill(); c.strokeStyle = edge; c.lineWidth = Math.max(1, L * 0.018); c.stroke();
  // 창문
  c.save();
  c.beginPath(); c.moveTo(-L * 0.245, -L * 0.255); c.quadraticCurveTo(-L * 0.19, -L * 0.345, -L * 0.115, -L * 0.355); c.lineTo(L * 0.075, -L * 0.355); c.quadraticCurveTo(L * 0.13, -L * 0.34, L * 0.205, -L * 0.258); c.closePath();
  c.fillStyle = '#334155'; c.fill(); c.clip();
  if (opt.dad) { c.fillStyle = '#1f2937'; c.beginPath(); c.arc(L * 0.09, -L * 0.29, L * 0.055, 0, TAU); c.fill(); c.fillStyle = '#fcd9bd'; c.beginPath(); c.arc(L * 0.1, -L * 0.275, L * 0.045, 0, TAU); c.fill(); }
  if (opt.yuna) headInWindow(c, -L * 0.12, -L * 0.285, L * 0.055, t);
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(-L * 0.05, -L * 0.36); c.lineTo(L * 0.02, -L * 0.36); c.lineTo(-L * 0.06, -L * 0.25); c.lineTo(-L * 0.13, -L * 0.25); c.fill();
  c.restore();
  c.strokeStyle = body === '#f8fafc' ? '#e2e8f0' : 'rgba(255,255,255,0.5)'; c.lineWidth = L * 0.022; c.beginPath(); c.moveTo(-L * 0.025, -L * 0.36); c.lineTo(-L * 0.025, -L * 0.25); c.stroke();
  // 문 선·손잡이
  c.strokeStyle = 'rgba(100,116,139,0.55)'; c.lineWidth = Math.max(0.8, L * 0.008);
  c.beginPath(); c.moveTo(-L * 0.025, -L * 0.25); c.lineTo(-L * 0.035, -L * 0.09); c.moveTo(L * 0.2, -L * 0.25); c.lineTo(L * 0.21, -L * 0.1); c.stroke();
  c.fillStyle = '#94a3b8'; c.fillRect(-L * 0.1, -L * 0.21, L * 0.05, L * 0.012); c.fillRect(L * 0.12, -L * 0.21, L * 0.05, L * 0.012);
  // 앞: 'T' 모양 주간등 + 그릴, 뒤: 미등
  c.fillStyle = '#e0f2fe'; c.fillRect(L * 0.43, -L * 0.195, L * 0.06, L * 0.035);
  c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, L * 0.012); c.beginPath(); c.moveTo(L * 0.435, -L * 0.178); c.lineTo(L * 0.485, -L * 0.178); c.moveTo(L * 0.46, -L * 0.178); c.lineTo(L * 0.46, -L * 0.163); c.stroke();
  c.fillStyle = '#1e293b'; c.fillRect(L * 0.475, -L * 0.15, L * 0.022, L * 0.05);
  c.fillStyle = '#dc2626'; c.fillRect(-L * 0.5, -L * 0.185, L * 0.03, L * 0.04);
  c.fillStyle = 'rgba(100,116,139,0.35)'; c.fillRect(-L * 0.48, -L * 0.09, L * 0.96, L * 0.015);
  // 바퀴
  const spin = (opt.roll || 0) / (L * 0.08);
  [-0.31, 0.3].forEach(q => {
    const wx = q * L, wy = -L * 0.075, wr = L * 0.08;
    c.fillStyle = '#111827'; c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.fill();
    c.fillStyle = '#cbd5e1'; c.beginPath(); c.arc(wx, wy, wr * 0.6, 0, TAU); c.fill();
    c.strokeStyle = '#64748b'; c.lineWidth = Math.max(1, wr * 0.15);
    for (let k = 0; k < 5; k++) { const a = spin + k * TAU / 5; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * wr * 0.55, wy + Math.sin(a) * wr * 0.55); c.stroke(); }
  });
  c.restore();
}
function drawBus(c, x, y, len, dir, t, opt) {
  const L = len, st = opt.style;
  c.save(); c.translate(x, y); c.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
  c.fillStyle = 'rgba(20,30,20,0.25)'; ell(c, 0, 0, L * 0.52, L * 0.06); c.fill();
  c.translate(0, -(opt.bump || 0)); c.rotate(opt.ang || 0); c.scale(dir, 1);
  c.fillStyle = st.color; rrect(c, -L * 0.5, -L * 0.42, L, L * 0.36, L * 0.06); c.fill();
  c.fillStyle = st.dark; c.fillRect(-L * 0.5, -L * 0.13, L, L * 0.06);
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(-L * 0.5, -L * 0.19, L, L * 0.02);
  // 창문 + 승객
  const wins = [-0.44, -0.31, -0.18, -0.05, 0.08];
  wins.forEach((q, i) => {
    const wx = q * L, wy = -L * 0.37, ww = L * 0.11, wh = L * 0.13;
    c.fillStyle = '#bfdbfe'; rrect(c, wx, wy, ww, wh, L * 0.015); c.fill();
    c.save(); rrect(c, wx, wy, ww, wh, L * 0.015); c.clip();
    if (opt.yuna && i === 2) headInWindow(c, wx + ww / 2, wy + wh * 0.62, L * 0.04, t);
    else if ((i * 7 + opt.seed) % 3 === 0) { c.fillStyle = ['#a16207', '#1f2937', '#78350f'][i % 3]; c.beginPath(); c.arc(wx + ww / 2, wy + wh * 0.8, L * 0.035, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(wx + ww * 0.1, wy, ww * 0.18, wh);
    c.restore();
  });
  // 문 (앞쪽)
  const dk = opt.door || 0;
  c.fillStyle = '#93c5fd'; c.fillRect(L * 0.22, -L * 0.37, L * 0.12, L * 0.3);
  if (dk > 0) { c.fillStyle = '#1e293b'; c.fillRect(L * 0.22 + L * 0.06 * (1 - dk), -L * 0.37, L * 0.12 * dk, L * 0.3); }
  c.strokeStyle = st.dark; c.lineWidth = Math.max(1, L * 0.01); c.strokeRect(L * 0.22, -L * 0.37, L * 0.12, L * 0.3);
  // 앞 유리 + 번호판(LED)
  c.fillStyle = '#bfdbfe'; c.beginPath(); c.moveTo(L * 0.38, -L * 0.37); c.lineTo(L * 0.49, -L * 0.37); c.lineTo(L * 0.5, -L * 0.2); c.lineTo(L * 0.38, -L * 0.2); c.fill();
  c.fillStyle = '#111827'; rrect(c, -L * 0.2, -L * 0.415, L * 0.42, L * 0.07, L * 0.012); c.fill();
  c.save(); c.scale(dir, 1);
  c.fillStyle = '#fb923c'; c.font = `bold ${Math.round(L * 0.07)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(opt.name), dir * L * 0.01, -L * 0.378);
  c.restore();
  c.fillStyle = '#fef08a'; c.fillRect(L * 0.47, -L * 0.15, L * 0.03, L * 0.03);
  // 바퀴
  const spin = (opt.roll || 0) / (L * 0.07);
  [-0.32, 0.3].forEach(q => {
    const wx = q * L, wy = -L * 0.065, wr = L * 0.07;
    c.fillStyle = '#111827'; c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.fill();
    c.fillStyle = '#e5e7eb'; c.beginPath(); c.arc(wx, wy, wr * 0.5, 0, TAU); c.fill();
    c.strokeStyle = '#6b7280'; c.lineWidth = Math.max(1, wr * 0.15); c.beginPath(); c.moveTo(wx + Math.cos(spin) * wr * 0.45, wy + Math.sin(spin) * wr * 0.45); c.lineTo(wx - Math.cos(spin) * wr * 0.45, wy - Math.sin(spin) * wr * 0.45); c.stroke();
  });
  c.restore();
}
function drawTrainCar(c, x, y, ang, len, stripe, yuna = false, t = 0) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const h = len * 0.38;
  c.fillStyle = 'rgba(20,30,20,0.25)'; rrect(c, -len / 2 + 2, -h / 2 + 3, len, h, h * 0.3); c.fill();
  c.fillStyle = '#f8fafc'; rrect(c, -len / 2, -h / 2, len, h, h * 0.3); c.fill(); c.strokeStyle = '#94a3b8'; c.lineWidth = 1; c.stroke();
  c.fillStyle = stripe; c.fillRect(-len / 2 + 2, -h * 0.12, len - 4, h * 0.24);
  c.fillStyle = '#1e293b'; for (let i = 0; i < 3; i++) c.fillRect(-len * 0.38 + i * len * 0.28, -h * 0.4, len * 0.14, h * 0.18);
  c.restore();
  if (yuna) {   // 맨 앞 칸 위에 유나 얼굴 (바로 서 있게)
    c.save(); c.beginPath(); c.arc(x, y - len * 0.32, len * 0.24, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = stripe; c.lineWidth = 2; c.stroke(); c.clip();
    headInWindow(c, x, y - len * 0.3, len * 0.15, t); c.restore();
  }
}

// ═══════════════ 경로 따라 움직이기 ═══════════════
// maxSec: 아무리 멀어도 이 시간 안에 도착하도록 빨라진다 (아기가 기다리기 지루하지 않게)
function mover(pts, speed, maxSec = 99) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + T.meters(pts[i - 1], pts[i]));
  const len = cum[cum.length - 1];
  return { pts, cum, len, s: 0, speed: Math.max(speed, len / maxSec) };
}
function moverAt(m, s) {
  const { pts, cum } = m; s = Math.max(0, Math.min(m.len, s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i] || a, seg = cum[i] - cum[i - 1] || 1, k = clamp01((s - cum[i - 1]) / seg);
  return { u: a.u + (b.u - a.u) * k, v: a.v + (b.v - a.v) * k, du: b.u - a.u, dv: b.v - a.v };
}
function addSparkle(g, p, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 50 + Math.random() * 110; g.parts.push({ p: { ...p }, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, born: g.t, life: 0.9, kind: i % 3 ? 'star' : 'heart' }); }
}
const spd = { car: 430, pickup: 700, walk: 95, bus: 330 };   // 지도 위 m/초 (실제보다 아주 빠르게)
// 길 위를 돌아다니는 차들 (지금 동네 길에서)
const makeAmb = () => ['#ef4444', '#facc15', '#38bdf8', '#a3e635'].map((col, i) => {
  const e = T.EDGES[(i * 53 + 7) % T.EDGES.length];
  return { col, a: e[0], b: e[1], k: Math.random(), prev: -1, dir: 1 };
});

// ═════════════════════════════════════════════════════════════════════════════
export default function TownGame({ audio, speak }) {
  const canvasRef = useRef(null);
  // ── 전체화면: 진짜 전체화면(Fullscreen API, 아이패드 Safari 는 webkit)을 먼저 시도하고, 안 되면(아이폰 등) 화면에 꽉 채운다 ──
  const rootRef = useRef(null);
  const [full, setFull] = useState(false);
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const toggleFull = () => {
    const el = rootRef.current;
    if (!full) {
      setFull(true);
      const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
      if (req) { try { const r = req.call(el); if (r && r.catch) r.catch(() => { }); } catch { /* 꽉 채우기로 대신 */ } }
    } else {
      setFull(false);
      if (fsElement()) { const exit = document.exitFullscreen || document.webkitExitFullscreen; try { const r = exit.call(document); if (r && r.catch) r.catch(() => { }); } catch { /* 무시 */ } }
    }
  };
  useEffect(() => {
    // 기기 쪽에서 전체화면을 끄면(아래로 쓸기, Esc) 같이 작게
    const onChange = () => { if (!fsElement()) setFull(false); };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange); };
  }, []);
  const G = useRef(null);
  const [ui, setUi] = useState({ mode: 'idle', sel: null, choices: [], wrong: null, card: null, bell: false, bellOn: false, stamps: 0, at: 'home', town: 'sanbon', newStamp: false });

  const say = (text) => { const g = G.current; if (g) g.lastLine = text; if (speak && text) speak(text); };
  const later = (fn, ms) => { const g = G.current; const id = setTimeout(() => { g.timers = g.timers.filter(x => x !== id); fn(); }, ms); g.timers.push(id); };
  const sync = (extra = {}) => {
    const g = G.current;
    setUi(u => ({ ...u, mode: g.mode, sel: g.sel, at: g.at, town: g.town, bell: g.bell, bellOn: g.bellOn, stamps: Object.keys(g.save.stamps).length, ...extra }));
  };
  const sparkle = (p, n) => addSparkle(G.current, p, n);

  useEffect(() => {
    const save = loadTown();
    // 이 기기에서 유나가 마지막으로 있던 곳에서 시작한다 (없으면 산본 유나집)
    const last = save.last && TOWNS[save.last.town] && TOWNS[save.last.town].SPOT_BY_ID[save.last.at] ? save.last : { town: 'sanbon', at: 'home' };
    T = TOWNS[last.town];
    const home = T.SPOT_BY_ID[last.at];
    G.current = { t: 0, mode: 'idle', at: home.id, town: T.id, cam: townView(T), sel: null, save, timers: [], parts: [], amb: makeAmb(), lastLine: '',
      yuna: { p: { ...home.a }, vis: true, walk: null, onDone: null, dir: 1 },
      car: { p: { ...home.r }, town: T.id, at: home.id, node: home.node, dir: 1, m: null, onDone: null, yuna: false, roll: 0 },
      bus: null, route: null, bell: false, bellOn: false };
    later(() => { sync(); say(last.at === 'home' ? VOICE.townWelcome() : VOICE.townArrive(home)); }, 400);
    return () => { G.current.timers.forEach(clearTimeout); G.current.timers = []; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 이동 시작 도우미 ──
  const walkYuna = (pts, onDone, speed = spd.walk, maxSec = 5) => { const g = G.current; g.yuna.vis = true; g.yuna.walk = mover(pts, speed, maxSec); g.yuna.onDone = onDone; };
  const driveCar = (pts, speed, onDone, maxSec = 7) => { const g = G.current; g.car.m = mover(pts, speed, maxSec); g.car.onDone = onDone; };
  // 온 동네 좌표로 달리기 (옆 동네에 있는 차가 데리러 오거나, 옆 동네로 갈 때). follow 가 있으면 화면이 차를 따라 옆 동네로 넘어간다
  const driveCarWorld = (pts, speed, onDone, maxSec, follow = null) => { const g = G.current; g.car.wm = mover(pts, speed, maxSec); g.car.pw = { ...pts[0] }; g.car.wDone = onDone; g.camFollow = follow; };
  const vroom = () => { audio.playFreq(98, 'sawtooth', 0.35, 0.12); setTimeout(() => audio.playFreq(147, 'sawtooth', 0.4, 0.1), 160); };
  const honk = () => { audio.playFreq(415, 'square', 0.13, 0.12); setTimeout(() => audio.playFreq(415, 'square', 0.18, 0.12), 190); };
  const curSpot = () => T.SPOT_BY_ID[G.current.at];

  // 장소 콕
  const originStops = () => { const g = G.current; return g.at === 'home' ? T.HOME_STOPS : curSpot().stops; };
  const tapSpot = (sp) => {
    const g = G.current;
    if (g.mode !== 'idle') return;
    audio.playXylophone(880, 0.3);
    if (sp.id === g.at) { g.mode = 'card'; sync({ card: sp.id, newStamp: false }); say(VOICE.townArrive(sp)); return; }
    g.sel = sp.id; g.mode = 'choose';
    sync({ wrong: null, walk: canWalk(sp), bus: T.canBus(originStops(), sp), metro: !!T.metroPath(g.at, sp.id) });
    say(VOICE.townHow(sp));
  };
  const canWalk = (sp) => T.meters(curSpot().r, sp.r) < 900;

  // 🚗 아빠 차: 차가 다른 곳에 있으면 데리러 오고, 유나가 걸어가서 탄 뒤 go()
  const boardCar = (from, go) => {
    const g = G.current;
    const board = () => {
      walkYuna([{ ...g.yuna.p }, { ...g.car.p }], () => {
        g.yuna.vis = false; g.car.yuna = true; audio.playFreq(220, 'triangle', 0.12, 0.3); audio.playNoise(0.12, 0.12, 900);
        later(go, 500);
      }, spd.walk * 0.5, 1.3);
    };
    if (g.car.town !== T.id) {
      // 아빠 차가 옆 동네에 있다 (지하철로 왔을 때): 실제 길을 따라 이 동네로 데리러 온다
      say(VOICE.townPickup()); vroom();
      const pts = WORLD.path(toWorld(TOWNS[g.car.town], g.car.p), toWorld(T, from.r));
      driveCarWorld(pts, spd.pickup, () => { g.car.town = T.id; g.car.p = { ...from.r }; g.car.at = g.at; later(board, 300); }, 5);
    } else if (g.car.at !== g.at) {
      say(VOICE.townPickup()); vroom();
      const cn = g.car.at ? T.SPOT_BY_ID[g.car.at].node : g.car.node;
      driveCar(T.roadPath(g.car.p, cn, from.r, from.node), spd.pickup, () => { g.car.at = g.at; later(board, 300); }, 4);
    } else board();
  };
  // 차에서 내려 장소까지 걸어가 도착
  const carAlight = (sp) => {
    const g = G.current;
    g.car.town = T.id; g.car.p = { ...sp.r }; g.car.at = sp.id; g.car.node = sp.node; g.route = null; audio.playNoise(0.12, 0.12, 900);
    later(() => { g.car.yuna = false; g.yuna.p = { ...g.car.p }; walkYuna([{ ...g.car.p }, { ...sp.a }], () => arrive(sp), spd.walk * 0.6, 1.3); }, 350);
  };
  const goCar = () => {
    const g = G.current, sp = T.SPOT_BY_ID[g.sel], from = curSpot();
    g.mode = 'move'; g.route = null; sync();
    boardCar(from, () => {
      say(VOICE.townCarGo(sp)); vroom();
      const pts = T.roadPath(from.r, from.node, sp.r, sp.node);
      g.route = { pts, col: '#f97316' };
      driveCar(pts, spd.car, () => carAlight(sp));
    });
  };

  // 🗺️ 옆 동네 가기 (산본 ↔ 안양): 두 동네를 이은 온 동네 지도(WORLD) 위에서 실제 길·철길을 따라가고, 화면이 탈것을 따라 옆 동네로 넘어간다
  const openCross = (toId) => {
    const g = G.current; if (!g) return;
    if (g.mode === 'card') { g.mode = 'idle'; sync({ card: null }); }
    if (g.mode !== 'idle') return;
    const to = TOWNS[toId]; g.crossTo = toId;
    const lines = g.at ? T.RAILS.filter(rl => crossRail(T, to, rl.id, g.at)).map(rl => rl.id) : [];
    g.mode = 'cross'; audio.playXylophone(880, 0.3);
    sync({ crossTo: to.id, crossLines: lines });
    say(VOICE.townCrossAsk(to));
  };
  // 도착한 동네로 바꾼다 (지도 좌표도 그 동네 것으로)
  const enterTown = (to) => {
    const g = G.current;
    T = to; g.town = to.id; g.amb = makeAmb(); g.route = null; g.at = null; g.bus = null; g.metro = null;
    sync();
  };
  const crossCar = (destId, toId) => {
    const g = G.current, from = T, to = TOWNS[toId || g.crossTo], fs = curSpot();
    const dest = to.SPOT_BY_ID[destId || to.carEntry[from.id]];
    g.mode = 'move'; g.route = null; sync();
    boardCar(fs, () => {
      say(VOICE.townCrossCar(to)); vroom();
      const pts = WORLD.path(toWorld(from, fs.r), toWorld(to, dest.r));
      g.routeW = { pts, col: '#f97316' };
      driveCarWorld(pts, spd.car, () => {
        enterTown(to);
        g.routeW = null;
        say(VOICE.townCrossArrive(to));
        later(() => carAlight(dest), 600);
      }, 12, { from, to });
    });
  };
  const crossMetro = (lineId) => {
    const g = G.current, from = T, to = TOWNS[g.crossTo], fs = curSpot(), cr = crossRail(from, to, lineId, g.at);
    if (!cr) return;
    g.mode = 'move'; g.route = null; sync();
    say(VOICE.townCrossMetro(to));
    walkYuna([{ ...g.yuna.p }, { ...fs.r }], () => {
      g.yuna.vis = false;
      const p = cr.pts, ext = (q0, q1, k) => ({ u: q0.u + (q0.u - q1.u) * k, v: q0.v + (q0.v - q1.v) * k });
      const pts = [ext(p[0], p[1], 0.8), ...p, ext(p[p.length - 1], p[p.length - 2], 1.0)];
      const m = mover(pts, 300, 99);
      g.xmetro = { m, stopAt: [m.cum[1], m.cum[pts.length - 2]], si: 0, state: 'come', wait: 0, yuna: false, alpha: 0, col: cr.color, speed: Math.max(300, (m.cum[pts.length - 2] - m.cum[1]) / 9),
        from, to, dest: to.SPOT_BY_ID[cr.destId] };
      g.routeW = { pts: p, col: cr.color };
    }, spd.walk * 0.6, 1.2);
  };
  // 🚶 걷기
  const goWalk = () => {
    const g = G.current, sp = T.SPOT_BY_ID[g.sel], from = curSpot();
    g.mode = 'move'; sync();
    say(VOICE.townWalkGo(sp));
    const pts = [{ ...g.yuna.p }, ...T.roadPath(from.r, from.node, sp.r, sp.node), { ...sp.a }];
    g.route = { pts, col: '#ec4899' };
    walkYuna(pts, () => { g.route = null; arrive(sp); }, spd.walk, 6);
  };
  // 🚇 지하철 (4호선): 역 안으로 들어가면 전철이 들어오고, 가운데 역에 잠깐 섰다가 내릴 역까지
  const goMetro = () => {
    const g = G.current, sp = T.SPOT_BY_ID[g.sel], from = curSpot(), mp = T.metroPath(g.at, sp.id);
    if (!mp) return;
    g.mode = 'move'; sync();
    say(VOICE.townMetroGo(sp));
    walkYuna([{ ...g.yuna.p }, { ...from.r }], () => {
      g.yuna.vis = false;
      const ext = (p0, p1) => ({ u: p0.u + (p0.u - p1.u) * 1.2, v: p0.v + (p0.v - p1.v) * 1.2 });
      const pts = [ext(mp.pts[0], mp.pts[1]), ...mp.pts, ext(mp.pts[mp.pts.length - 1], mp.pts[mp.pts.length - 2])];
      const m = mover(pts, 300, 99);
      const stopAt = [m.cum[1], ...mp.middle.map(md => m.cum[1 + mp.pts.indexOf(mp.rail.pts[md.at])]), m.cum[pts.length - 2]];
      g.metro = { col: mp.rail.color, m, stopAt, si: 0, state: 'come', wait: 0, yuna: false, alpha: 0, sp, mids: mp.middle.map(md => T.SPOT_BY_ID[md.id]), speed: Math.max(300, (stopAt[stopAt.length - 1] - stopAt[0]) / 7) };
      g.route = { pts: mp.pts, col: mp.rail.color };
    }, spd.walk * 0.6, 1.2);
  };
  // 🚌 버스: 정류장에 서는 버스를 모두 보여 준다 (가는 버스 → 갈아타는 버스 → 안 가는 버스)
  const openBoard = (stops, label, pref, transfer) => {
    const g = G.current, sp = T.SPOT_BY_ID[g.sel];
    g.board = T.busBoard(stops, sp, pref); g.boardStops = stops; g.mode = 'busPick'; g.transferring = !!transfer;
    const firstStop = (r) => { for (const run of r.runs) for (const id of run) if (stops.includes(id)) return id; return stops[0]; };
    sync({ wrong: null, boardLabel: label, transfer: !!transfer, choices: g.board.filter(ch => ch.ok).map(ch => ({ id: ch.route.id, name: busLabel(ch.route.name), type: ch.route.type, ok: ch.ok, n: ch.trip ? ch.trip.stops.length - 1 : 0,
      via: ch.transfer ? T.shortStop(ch.trip.via) : '', stop: T.shortStop(ch.trip ? ch.trip.from : firstStop(ch.route)) })) });
    say(transfer ? VOICE.townTransfer() : VOICE.townBusPick(sp));
  };
  const goBus = () => {
    const g = G.current, sp = T.SPOT_BY_ID[g.sel];
    if (!T.canBus(originStops(), sp)) { say(VOICE.townNoBus(sp)); audio.playFreq(300, 'triangle', 0.15, 0.3); return; }
    openBoard(originStops(), g.at === 'home' ? '우리집 앞 정류장' : `${curSpot().name} 정류장`, g.at === 'home' ? T.HOME_STOPS[0] : null, false);
  };
  const pickBus = (id) => {
    const g = G.current, sp = T.SPOT_BY_ID[g.sel], ch = g.board.find(c => c.route.id === id);
    if (!ch) return;
    if (!ch.ok) { audio.playFreq(260, 'triangle', 0.15, 0.35); sync({ wrong: id }); say(VOICE.townBusWrong(sp)); later(() => sync({ wrong: null }), 700); return; }
    audio.playXylophone(1046.5, 0.4);
    const trip = ch.trip, from = curSpot();
    g.mode = 'move'; sync();
    say(VOICE.townBusOk(ch.route.name));
    // 정류장 점(길 위)
    const stopPts = trip.stops.map(id2 => nodeUV(T.nodeOfStop(id2)));
    const board = stopPts[0];
    const walkPts = g.transferring ? [{ ...g.yuna.p }, board] : [{ ...g.yuna.p }, ...T.roadPath(from.r, from.node, board, T.nodeOfStop(trip.from))];
    walkYuna(walkPts, () => {
      // 버스가 앞 정류장에서 들어온다
      const prev = trip.before ? nodeUV(T.nodeOfStop(trip.before)) : { u: board.u - (stopPts[1].u - board.u) * 0.5, v: board.v - (stopPts[1].v - board.v) * 0.5 };
      const after = trip.after.map(id2 => nodeUV(T.nodeOfStop(id2)));
      const tripLen = stopPts.slice(1).reduce((a2, q, i) => a2 + T.meters(stopPts[i], q), 0);
      g.bus = { speed: Math.max(spd.bus, tripLen / 9), route: ch.route, style: busStyle(ch.route.type), seed: ch.route.name.length * 3, pts: [prev, ...stopPts, ...after], leg: 0, legK: 0, state: 'come', wait: 0, door: 0, yuna: false, alpha: 0, roll: 0, dir: 1, nDrop: stopPts.length, sp, via: ch.transfer ? trip.via : null };
      g.route = { pts: stopPts, col: g.bus.style.color };
    }, spd.walk * 0.8, 3.5);
  };
  const ringBell = () => {
    const g = G.current; if (!g.bell || g.bellOn) return;
    g.bellOn = true; audio.playXylophone(1318.5, 0.5); setTimeout(() => audio.playXylophone(1046.5, 0.7), 230);
    say(VOICE.townBell()); sync();
  };
  // 도착
  const arrive = (sp) => {
    const g = G.current;
    g.at = sp.id; g.sel = null; g.mode = 'card'; g.route = null;
    const isNew = !g.save.stamps[sp.id];
    g.save.stamps[sp.id] = true; g.save.last = { town: T.id, at: sp.id }; saveTown(g.save);
    sparkle(sp.a, 16); audio.playXylophone(1046.5, 0.4); setTimeout(() => audio.playXylophone(1318.5, 0.5), 160); setTimeout(() => audio.playXylophone(1568, 0.7), 320);
    say(VOICE.townArrive(sp));
    sync({ card: sp.id, newStamp: isNew });
    if (isNew && ALL_TOWN_SPOTS.every(s2 => g.save.stamps[s2.id])) later(() => { say(VOICE.townStampAll()); T.TOWN_SPOTS.forEach(s2 => sparkle(s2.a, 6)); }, 4500);
  };
  const closeCard = () => { const g = G.current; g.mode = 'idle'; sync({ card: null }); };
  const cancel = () => { const g = G.current; g.mode = 'idle'; g.sel = null; sync({ wrong: null }); };
  const goHome = () => {
    const g = G.current; if (!g) return;
    if (g.mode === 'card') { g.mode = 'idle'; sync({ card: null }); }
    if (g.mode !== 'idle' || g.at === 'home') return;
    if (T.id !== 'sanbon') { crossCar('home', 'sanbon'); return; }   // 안양에서는 아빠 차로 군포 집까지
    g.sel = 'home'; goCar();
  };
  const replay = () => { const g = G.current; if (g && g.lastLine) say(g.lastLine); };

  // ── 터치 ──
  const onDown = (e) => {
    const g = G.current, cv = canvasRef.current; if (!g || !g.L || !cv) return;
    const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, L = g.L;
    let best = null, bd = Infinity;
    T.TOWN_SPOTS.forEach(sp => { const sx = L.X(sp.a), sy = L.Y(sp.a) - 22 * L.s, d = Math.hypot(x - sx, (y - sy) * 0.9); if (d < bd) { bd = d; best = sp; } });
    if (best && bd < 52 * L.s && g.mode === 'idle') { tapSpot(best); return; }
    // 옆 동네 이정표
    const hit = Object.entries(T.GATES).find(([, gt]) => Math.abs(x - L.X(gt.sign)) < 60 * L.s && y > L.Y(gt.sign) - 90 * L.s && y < L.Y(gt.sign) + 10 * L.s);
    if (hit && (g.mode === 'idle' || g.mode === 'card')) { openCross(hit[0]); return; }
    // 아빠 차 빵빵
    const cx = L.X(g.car.p), cy = L.Y(g.car.p), cl = 86 * L.s;
    if (Math.abs(x - cx) < cl * 0.55 && y < cy + 6 && y > cy - cl * 0.45) { honk(); g.car.honkT = g.t; }
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = -1, t0 = 0, layer = null;
    const layers = {};
    // 동네마다 고정 배경 (그 동네를 잠깐 T 로 놓고 그린다)
    const layerOf = (tw, W, H, dpr) => {
      const key = `${tw.id}:${W}x${H}@${dpr}`;
      if (!layers[key]) { const keep = T; T = tw; try { layers[key] = buildLayer(layout(W, H), dpr); } finally { T = keep; } }
      return layers[key];
    };
    // 옆 동네로 가는 탈것을 따라가는 카메라: 탈것이 두 동네 가운데를 잇는 선 위 어디쯤인지로 화면을 옮긴다
    const followCam = (p, from, to) => {
      const a = townView(from), b = townView(to);
      const ca = { u: a.u + a.ku / 2, v: a.v + a.kv / 2 }, cb = { u: b.u + b.ku / 2, v: b.v + b.kv / 2 };
      const du = cb.u - ca.u, dv = cb.v - ca.v, l2 = du * du + dv * dv || 1;
      const k = clamp01(((p.u - ca.u) * du + (p.v - ca.v) * dv) / l2);
      const e = clamp01((k - 0.2) / 0.6), sm = e * e * (3 - 2 * e);
      return { u: a.u + (b.u - a.u) * sm, v: a.v + (b.v - a.v) * sm, ku: a.ku + (b.ku - a.ku) * sm, kv: a.kv + (b.kv - a.kv) * sm };
    };
    const loop = (now) => {
      const g = G.current;
      if (last < 0) { last = now; t0 = now; }
      if (!g) { raf = requestAnimationFrame(loop); return; }
      cv.__g = g;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t = (now - t0) / 1000; const t = g.t;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (W > 0 && H > 0) {
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 카메라: 옆 동네로 가는 중이면 탈것을 따라가고, 아니면 지금 동네로 스르르 돌아온다
        const xmF = g.xmetro && g.xmetro.state !== 'leave' ? g.xmetro : null;
        let camT = townView(T);
        if (g.camFollow && g.car.wm) camT = followCam(g.car.pw, g.camFollow.from, g.camFollow.to);
        else if (xmF) { const q = moverAt(xmF.m, xmF.m.s); camT = followCam(q, xmF.from, xmF.to); }
        if (g.camFollow && g.car.wm || xmF) g.cam = camT;
        else { const k = Math.min(1, dt * 5); g.cam = { u: g.cam.u + (camT.u - g.cam.u) * k, v: g.cam.v + (camT.v - g.cam.v) * k, ku: g.cam.ku + (camT.ku - g.cam.ku) * k, kv: g.cam.kv + (camT.kv - g.cam.kv) * k }; }
        const tv = townView(T), panning = Math.abs(g.cam.u - tv.u) > 1e-3 || Math.abs(g.cam.v - tv.v) > 1e-3 || Math.abs(g.cam.ku - tv.ku) > 1e-3;
        const L = layout(W, H, g.cam); g.L = L; const { X, Y, s } = L;
        layer = layerOf(T, W, H, dpr);
        if (!panning) ctx.drawImage(layer.cv, 0, 0, W, H);
        else {
          // 두 동네 지도를 맞닿게 이어 그린다 (각자 지도 칸만)
          ctx.fillStyle = '#b5e09a'; ctx.fillRect(0, 0, W, H);
          TOWN_LIST.forEach(tw => {
            // 그 동네 지도 칸이 화면 어디에 어떤 크기로 오는지 (배율이 다르면 크게·작게)
            const sx = L.XW(tw.off), sy = L.YW(tw.off), fu = tw.k.u / g.cam.ku, fv = tw.k.v / g.cam.kv;
            if (sx >= W || sy >= H || sx + L.mw * fu <= 0 || sy + L.mh * fv <= 0) return;
            ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, L.mw * fu, L.mh * fv); ctx.clip(); ctx.drawImage(layerOf(tw, W, H, dpr).cv, sx - L.ox * fu, sy - L.oy * fv, W * fu, H * fv); ctx.restore();
          });
        }

        // ── 움직이기 ──
        const y = g.yuna;
        if (y.walk) {
          y.walk.s += y.walk.speed * dt; const q = moverAt(y.walk, y.walk.s); y.p = { u: q.u, v: q.v }; if (Math.abs(q.du) > 1e-6) y.dir = Math.sign(q.du);
          if (y.walk.s >= y.walk.len) { y.walk = null; const f = y.onDone; y.onDone = null; if (f) f(); }
        }
        const car = g.car;
        if (car.m) {
          car.m.s += car.m.speed * dt; car.roll += car.m.speed * dt * 0.02 * s;
          const q = moverAt(car.m, car.m.s); car.p = { u: q.u, v: q.v };
          const dx = q.du * L.mw, dy = q.dv * L.mh; if (Math.abs(dx) > 0.5) car.dir = Math.sign(dx);
          car.ang = Math.max(-0.28, Math.min(0.28, Math.atan2(dy, Math.abs(dx) + 1e-6) * 0.5)) * car.dir;
          if (car.m.s >= car.m.len) { car.m = null; car.ang = 0; const f = car.onDone; car.onDone = null; if (f) f(); }
        }
        if (car.wm) {   // 온 동네 좌표로 달리는 중 (옆 동네 오가기)
          car.wm.s += car.wm.speed * dt; car.roll += car.wm.speed * dt * 0.02 * s;
          const q = moverAt(car.wm, car.wm.s); car.pw = { u: q.u, v: q.v };
          const dx = q.du * L.mw, dy = q.dv * L.mh; if (Math.abs(dx) > 0.5) car.dir = Math.sign(dx);
          car.ang = Math.max(-0.28, Math.min(0.28, Math.atan2(dy, Math.abs(dx) + 1e-6) * 0.5)) * car.dir;
          if (car.wm.s >= car.wm.len) { car.wm = null; car.ang = 0; const f = car.wDone; car.wDone = null; g.camFollow = null; if (f) f(); }
        }
        // 옆 동네로 가는 전철 (온 동네 좌표): 탈 역 → 철길 → 옆 동네 내릴 역
        const xm = g.xmetro;
        if (xm) {
          if (xm.state === 'come' || xm.state === 'go' || xm.state === 'leave') {
            xm.alpha = xm.state === 'leave' ? Math.max(0, xm.alpha - dt * 0.9) : Math.min(1, xm.alpha + dt * 2.5);
            xm.m.s += (xm.state === 'come' ? 260 : xm.speed) * dt;
            if (xm.state !== 'leave' && xm.m.s >= xm.stopAt[xm.si]) { xm.m.s = xm.stopAt[xm.si]; xm.state = 'dwell'; xm.wait = 0; audio.playXylophone(1568, 0.3); setTimeout(() => audio.playXylophone(1318.5, 0.4), 160); }
            if (xm.state === 'leave' && (xm.alpha <= 0 || xm.m.s >= xm.m.len)) g.xmetro = null;
          } else if (xm.state === 'dwell') {
            xm.wait += dt;
            if (xm.si === 0) {
              if (!xm.yuna && xm.wait > 0.6) { xm.yuna = true; audio.playFreq(1568, 'sine', 0.12, 0.35); }
              if (xm.wait > 1.4) { xm.si = 1; xm.state = 'go'; }
            } else {
              if (xm.yuna && xm.wait > 0.6) {
                xm.yuna = false; enterTown(xm.to); g.routeW = null;
                const sp = xm.dest; y.p = { ...sp.r }; y.vis = true;
                say(VOICE.townCrossArrive(xm.to));
                walkYuna([{ ...sp.r }, { ...sp.a }], () => arrive(sp), spd.walk * 0.6, 1.2);
              }
              if (xm.wait > 1.4) xm.state = 'leave';
            }
          }
        }
        const b = g.bus;
        if (b) {
          if (b.state === 'come' || b.state === 'go' || b.state === 'leave') {
            b.alpha = b.state === 'leave' ? Math.max(0, b.alpha - dt * 0.8) : Math.min(1, b.alpha + dt * 2.5);
            const a = b.pts[b.leg], c2 = b.pts[b.leg + 1];
            const seg = Math.max(1, T.meters(a, c2));
            b.legK += b.speed * dt / seg; b.roll += b.speed * dt * 0.02 * s;
            const dx = (c2.u - a.u) * L.mw, dy = (c2.v - a.v) * L.mh; if (Math.abs(dx) > 0.5) b.dir = Math.sign(dx);
            b.ang = Math.max(-0.22, Math.min(0.22, Math.atan2(dy, Math.abs(dx) + 1e-6) * 0.4)) * b.dir;
            if (b.legK >= 1) {
              b.legK = 0; b.leg += 1;
              const idx = b.leg;   // 지금 닿은 점 번호
              if (b.state === 'leave') { if (b.leg >= b.pts.length - 1 || b.alpha <= 0) g.bus = null; }
              else if (idx === 1 && b.state === 'come') { b.state = 'dwell'; b.wait = 0; b.next = 'board'; audio.playNoise(0.25, 0.12, 700); }
              else if (idx >= b.nDrop) { b.state = 'dwell'; b.wait = 0; b.next = 'drop'; g.bell = false; audio.playNoise(0.25, 0.12, 700); sync(); }
              else if (b.nDrop > 6) {   // 정류장이 많으면 중간 정류장은 '띵' 하고 지나간다
                audio.playXylophone(1568, 0.2);
                if (b.leg + 1 === b.nDrop && !g.bell) { g.bell = true; g.bellOn = false; say(b.via ? VOICE.townBusNextTransfer() : VOICE.townBusNext(b.sp)); sync(); }
              } else { b.state = 'dwell'; b.wait = 0; b.next = 'stop'; audio.playXylophone(1568, 0.25); }
            }
          } else if (b.state === 'dwell') {
            b.wait += dt; b.door = clamp01(b.wait < 0.3 ? b.wait / 0.3 : b.wait > (b.next === 'stop' ? 0.45 : 1.3) ? 1 - (b.wait - (b.next === 'stop' ? 0.45 : 1.3)) / 0.25 : 1);
            if (b.next === 'board' && !b.yuna && b.wait > 0.5) { b.yuna = true; y.vis = false; audio.playFreq(1568, 'sine', 0.12, 0.35); setTimeout(() => audio.playFreq(2093, 'sine', 0.1, 0.3), 110); }
            if (b.next === 'drop' && b.yuna && b.wait > 0.5) {
              b.yuna = false; y.vis = true; y.p = { ...b.pts[b.leg] };
              g.bellOn = false; g.route = null;
              if (b.via) {   // 갈아타기: 이 정류장에 서는 버스를 다시 고른다
                const via = b.via;
                later(() => openBoard(T.stopsAtNode(T.nodeOfStop(via)), `${T.shortStop(via)} 정류장`, null, true), 900);
                sync();
              } else {
                say(VOICE.townBusAlight(b.sp)); sync();
                const sp = b.sp; walkYuna([{ ...y.p }, { ...sp.r }, { ...sp.a }], () => arrive(sp), spd.walk * 0.7, 2);
              }
            }
            const hold = b.next === 'stop' ? 0.55 : 1.6;
            if (b.wait > hold) {
              b.door = 0;
              if (b.next === 'drop') { b.state = 'leave'; if (b.leg >= b.pts.length - 1) g.bus = null; }
              else {
                b.state = 'go';
                if (b.next === 'board') vroom();
                if (b.leg + 1 === b.nDrop) { g.bell = true; g.bellOn = false; say(b.via ? VOICE.townBusNextTransfer() : VOICE.townBusNext(b.sp)); sync(); }
              }
            }
          }
        }
        const mt = g.metro;
        if (mt) {
          const target = mt.stopAt[mt.si];
          if (mt.state === 'come' || mt.state === 'go' || mt.state === 'leave') {
            mt.alpha = mt.state === 'leave' ? Math.max(0, mt.alpha - dt * 0.9) : Math.min(1, mt.alpha + dt * 2.5);
            mt.m.s += (mt.state === 'come' ? 260 : mt.speed) * dt;
            if (mt.state !== 'leave' && mt.m.s >= target) {
              mt.m.s = target; mt.state = 'dwell'; mt.wait = 0;
              audio.playXylophone(1568, 0.3); setTimeout(() => audio.playXylophone(1318.5, 0.4), 160);
              const mid = mt.si > 0 && mt.si < mt.stopAt.length - 1 ? mt.mids[mt.si - 1] : null;
              if (mid) say(VOICE.townMetroStop(mid));
            }
            if (mt.state === 'leave' && (mt.alpha <= 0 || mt.m.s >= mt.m.len)) g.metro = null;
          } else if (mt.state === 'dwell') {
            mt.wait += dt;
            const first = mt.si === 0, last = mt.si === mt.stopAt.length - 1;
            if (first && !mt.yuna && mt.wait > 0.6) { mt.yuna = true; audio.playFreq(1568, 'sine', 0.12, 0.35); }
            if (last && mt.yuna && mt.wait > 0.6) {
              mt.yuna = false; const sp = mt.sp; g.route = null;
              y.p = { ...sp.r }; y.vis = true;
              walkYuna([{ ...sp.r }, { ...sp.a }], () => arrive(sp), spd.walk * 0.6, 1.2);
            }
            if (mt.wait > (first ? 1.4 : last ? 1.4 : 1.0)) { if (last) mt.state = 'leave'; else { mt.si += 1; mt.state = 'go'; } }
          }
        }
        // 지나가는 차들
        g.amb.forEach(a => {
          const A = T.NODES[a.a], B = T.NODES[a.b], seg = Math.max(1, T.meters(A, B));
          a.k += 160 * dt / seg;
          if (a.k >= 1) {
            const nb = []; T.EDGES.forEach(([p, q]) => { if (p === a.b && q !== a.a) nb.push(q); else if (q === a.b && p !== a.a) nb.push(p); });
            const nx = nb.length ? nb[Math.floor(Math.random() * nb.length)] : a.a;
            a.prev = a.a; a.a = a.b; a.b = nx; a.k = 0;
          }
          const dx = (B.u - A.u) * L.mw; if (Math.abs(dx) > 0.5) a.dir = Math.sign(dx);
          a.p = { u: A.u + (B.u - A.u) * a.k, v: A.v + (B.v - A.v) * a.k };
        });

        // ── 그리기 ──
        // 구름 (그림자 + 구름)
        for (let i = 0; i < 4; i++) {
          const cw = (70 + i * 18) * s, span = W + cw * 3, cx = ((i * 0.31 * span + t * (9 + i * 3) * s) % span) - cw * 1.5, cy = H * (0.12 + i * 0.22);
          ctx.fillStyle = 'rgba(40,70,40,0.08)'; ell(ctx, cx + 30 * s, cy + 50 * s, cw * 0.55, cw * 0.18); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          [[0, 0, 0.32], [-0.28, 0.06, 0.22], [0.3, 0.05, 0.24], [0.1, -0.12, 0.22]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx * cw, cy + dy * cw, r * cw, 0, TAU); ctx.fill(); });
        }
        // 가는 길 표시
        if (g.route) {
          ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = g.route.col; ctx.globalAlpha = 0.55; ctx.lineWidth = 9 * s; ctx.setLineDash([2 * s, 14 * s]); ctx.lineDashOffset = -t * 40 * s;
          strokePath(ctx, L, g.route.pts); ctx.restore();
          const end = g.route.pts[g.route.pts.length - 1];
          ctx.fillStyle = g.route.col; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6); ell(ctx, X(end), Y(end), 8 * s, 8 * s); ctx.fill(); ctx.globalAlpha = 1;
        }
        // 옆 동네로 가는 길 (온 동네 좌표)
        if (g.routeW) {
          ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = g.routeW.col; ctx.globalAlpha = 0.55; ctx.lineWidth = 9 * s; ctx.setLineDash([2 * s, 14 * s]); ctx.lineDashOffset = -t * 40 * s;
          ctx.beginPath(); g.routeW.pts.forEach((q, i) => (i ? ctx.lineTo(L.XW(q), L.YW(q)) : ctx.moveTo(L.XW(q), L.YW(q)))); ctx.stroke(); ctx.restore();
        }
        // 버스 정류장 표시 (우리집 앞)
        if (g.mode === 'busPick' || (g.bus && g.bus.state !== 'leave')) {
          T.HOME_STOPS.slice(0, 2).forEach(id2 => { const p = nodeUV(T.nodeOfStop(id2)); ctx.font = `${Math.round(20 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('🚏', X(p) + 12 * s, Y(p)); });
        }
        // 전철
        T.RAILS.forEach((rl, ri) => {
          const pts = rl.pts.map(p => [X(p), Y(p)]), seg = [], cum = [0];
          for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); cum.push(cum[i - 1] + d); }
          const total = cum[cum.length - 1], carLen = 26 * s, period = total * 2 + carLen * 6;
          const pos = (d) => { d = Math.max(0, Math.min(total, d)); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const k = (d - cum[i - 1]) / (seg[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k, Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; };
          let d = (t * 70 * s + ri * total * 0.6) % period; const back = d > total + carLen * 3; if (back) d = period - d;
          for (let k = 0; k < 4; k++) { const dd = d - (back ? -1 : 1) * k * (carLen + 2 * s) + (back ? 0 : 0); if (dd < -carLen || dd > total + carLen) continue; const [px, py, an] = pos(dd); drawTrainCar(ctx, px, py, an, carLen, rl.color); }
        });
        // 장소 + 탈것 + 유나를 아래쪽(v)이 앞으로 오게 그린다
        const draws = [];
        T.TOWN_SPOTS.forEach(sp => draws.push({ v: sp.a.v, f: () => drawSpot(ctx, sp, X(sp.a), Y(sp.a), 30 * s, t, { sel: g.sel === sp.id, stamp: !!g.save.stamps[sp.id] }) }));
        // 화면이 옆 동네로 넘어가는 중이면 그 동네 장소도 보인다
        if (panning) TOWN_LIST.forEach(tw => { if (tw === T) return; tw.TOWN_SPOTS.forEach(sp => { const w = toWorld(tw, sp.a); draws.push({ v: (w.v - T.off.v) / T.k.v, f: () => drawSpot(ctx, sp, L.XW(w), L.YW(w), 30 * s, t, { sel: false, stamp: !!g.save.stamps[sp.id] }) }); }); });
        Object.entries(T.GATES).forEach(([to, gt]) => draws.push({ v: gt.sign.v, f: () => drawGateSign(ctx, TOWNS[to].name, X(gt.sign), Y(gt.sign), 30 * s, t, gt.sign.u > 0.9 ? '➡' : gt.sign.u < 0.1 ? '⬅' : gt.sign.v < 0.5 ? '⬆' : '⬇') }));
        g.amb.forEach((a, i) => draws.push({ v: a.p.v, f: () => drawCar(ctx, X(a.p), Y(a.p), 34 * s, a.dir, t, { color: a.col, edge: 'rgba(0,0,0,0.25)', roll: t * 20 + i, bump: Math.abs(Math.sin(t * 9 + i)) * 0.6 * s }) }));
        // 아빠 차: 옆 동네를 오가는 중이면 온 동네 좌표, 옆 동네에 세워 두었으면 안 보임
        const carW = car.wm ? car.pw : null;
        if (car.wm || car.town === T.id) draws.push({ v: (carW ? (carW.v - T.off.v) / T.k.v : car.p.v) + 0.001, f: () => {
          const cx2 = carW ? L.XW(carW) : X(car.p), cy2 = carW ? L.YW(carW) : Y(car.p);
          const moving = !!(car.m || car.wm), hk = car.honkT && t - car.honkT < 0.4 ? Math.sin((t - car.honkT) * 40) * 2 * s : 0;
          drawCar(ctx, cx2 + hk, cy2, 86 * s, car.dir, t, { yuna: car.yuna, dad: true, ang: car.ang, roll: car.roll, bump: moving ? Math.abs(Math.sin(t * 14)) * 1.2 * s : 0 });
          if (car.honkT && t - car.honkT < 0.6) { ctx.font = `${Math.round(16 * s)}px ${JUA}`; ctx.fillStyle = '#b45309'; ctx.textAlign = 'center'; ctx.fillText('빵빵!', cx2, cy2 - 40 * s - (t - car.honkT) * 30 * s); }
        } });
        if (xm) {
          const gap = 34 * s / (L.mw / T.meters({ u: 0, v: 0 }, { u: 1, v: 0 }));
          for (let k = 3; k >= 0; k--) {
            const q = moverAt(xm.m, xm.m.s - k * gap), q2 = moverAt(xm.m, xm.m.s - k * gap + 1);
            const an = Math.atan2((q2.v - q.v) * L.mh, (q2.u - q.u) * L.mw);
            draws.push({ v: (q.v - T.off.v) / T.k.v + 0.004, f: () => { ctx.save(); ctx.globalAlpha = xm.alpha; drawTrainCar(ctx, L.XW(q), L.YW(q), an, 34 * s, xm.col, k === 0 && xm.yuna, t); ctx.restore(); } });
          }
        }
        if (b) {
          const a = b.pts[b.leg], c2 = b.pts[Math.min(b.leg + 1, b.pts.length - 1)], k = b.state === 'dwell' ? 0 : b.legK;
          const bp = { u: a.u + (c2.u - a.u) * k, v: a.v + (c2.v - a.v) * k };
          draws.push({ v: bp.v + 0.002, f: () => drawBus(ctx, X(bp), Y(bp), 116 * s, b.dir, t, { style: b.style, name: b.route.name, door: b.door, yuna: b.yuna, roll: b.roll, ang: b.state === 'dwell' ? 0 : b.ang, seed: b.seed, alpha: b.alpha, bump: b.state === 'dwell' ? 0 : Math.abs(Math.sin(t * 10)) * s }) });
        }
        if (mt) {
          const gap = 34 * s / (L.mw / T.meters({ u: 0, v: 0 }, { u: 1, v: 0 }));
          for (let k = 3; k >= 0; k--) {
            const q = moverAt(mt.m, mt.m.s - k * gap), q2 = moverAt(mt.m, mt.m.s - k * gap + 1);
            const an = Math.atan2((q2.v - q.v) * L.mh, (q2.u - q.u) * L.mw);
            draws.push({ v: q.v + 0.004, f: () => { ctx.save(); ctx.globalAlpha = mt.alpha; drawTrainCar(ctx, X(q), Y(q), an, 34 * s, mt.col || '#0ea5e9', k === 0 && mt.yuna, t); ctx.restore(); } });
          }
        }
        if (y.vis) draws.push({ v: y.p.v + 0.003, f: () => {
          const S = 50 * s, walking = !!y.walk, hop = walking ? Math.abs(Math.sin(t * 11)) * S * 0.08 : Math.abs(Math.sin(t * 2)) * S * 0.02;
          const ox = (g.mode === 'idle' || g.mode === 'card' || g.mode === 'choose' || g.mode === 'busPick') && !walking ? 30 * s : 0;
          ctx.save(); ctx.translate(X(y.p) + ox, Y(y.p) - hop); ctx.rotate(walking ? Math.sin(t * 11) * 0.06 : 0);
          ctx.fillStyle = 'rgba(30,40,20,0.22)'; ell(ctx, 0, hop, S * 0.28, S * 0.06); ctx.fill();
          drawYuna(ctx, 'stand', S, t, false);
          ctx.restore();
        } });
        draws.sort((p, q) => p.v - q.v).forEach(d => d.f());

        // 밤 (실제 시계)
        const hr = new Date().getHours() + new Date().getMinutes() / 60;
        const dark = hr >= 20 || hr < 5.5 ? 1 : hr >= 18 ? (hr - 18) / 2 : hr < 7 ? (7 - hr) / 1.5 : 0;
        if (dark > 0) {
          ctx.fillStyle = `rgba(20,30,80,${0.38 * dark})`; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = `rgba(253,224,71,${0.85 * dark})`;
          if (!panning) layer.blocks.forEach((bk, i) => { if ((i * 7) % 5 === 0) return; const wx = bk.x + bk.w * 0.18, rows = Math.max(2, Math.floor(bk.h / (bk.w * 0.32))); for (let r = 0; r < rows; r++) if ((i + r) % 3) ctx.fillRect(wx + ((i + r) % 2) * bk.w * 0.42, bk.y - bk.h + bk.h * (0.1 + r * 0.85 / rows), bk.w * 0.22, bk.h * 0.45 / rows); });
        }
        // 반짝이
        g.parts = g.parts.filter(p => {
          const k = (t - p.born) / p.life; if (k >= 1) return false; if (k < 0) return true;
          const px = X(p.p) + p.vx * (t - p.born), py = Y(p.p) - 30 * s + p.vy * (t - p.born) + 120 * (t - p.born) ** 2;
          ctx.globalAlpha = 1 - k; ctx.font = `${Math.round(18 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.kind === 'heart' ? '💖' : '⭐', px, py); ctx.globalAlpha = 1;
          return true;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 화면 ──
  const sel = ui.sel ? T.SPOT_BY_ID[ui.sel] : null, card = ui.card ? T.SPOT_BY_ID[ui.card] : null;
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(60,40,20,0.6)', whiteSpace: 'nowrap' });
  const big = (bg, color = '#ffffff') => ({ ...btn(bg, color), minHeight: '96px', minWidth: '150px', borderRadius: '28px', fontSize: '1.45rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '10px 18px' });
  const hint = ui.mode === 'idle' ? '👆 가고 싶은 곳을 콕!' : ui.mode === 'busPick' ? '🚏 가는 버스를 찾아 콕!' : ui.bell ? (ui.bellOn ? '🔔 다음 정류장에서 내려요!' : '🔔 벨을 눌러요!') : ui.mode === 'move' ? '부릉부릉 가는 중...' : '';
  const overlay = { position: 'absolute', inset: 0, background: 'rgba(30,20,10,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
  const panel = { background: '#fffdf8', borderRadius: '30px', padding: '20px 22px', boxShadow: '0 20px 40px -18px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', maxWidth: '100%' };
  const walkOk = sel && ui.walk;
  const busNote = sel && !ui.bus ? '버스는 안 가요' : '';

  return (
    <div ref={rootRef} style={full
      ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#fdf6ec', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }
      : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={goHome} style={btn('#fce7f3', '#be185d')}>🏠 집으로 귀가</button>
        <button onClick={replay} style={btn('#ffffff', '#9a3412')}>🔊 다시 듣기</button>
        <button onClick={toggleFull} style={btn(full ? '#334155' : '#ffffff', full ? '#ffffff' : '#0f766e')}>{full ? '↙ 작게 보기' : '⛶ 전체화면'}</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#0f766e', minWidth: '160px' }}>🚗 우리 동네 {TOWNS[ui.town || 'sanbon'].name}</div>
        <div style={{ fontFamily: JUA, fontSize: '1.2rem', color: '#92400e', background: '#fef3c7', borderRadius: '20px', padding: '8px 16px' }}>🏅 도장 {ui.stamps}/{ALL_TOWN_SPOTS.length}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(15,118,110,0.5)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: '15%', right: '15%', top: '6px', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.2rem', color: '#7c2d12', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
        {ui.bell && <button onClick={ringBell} style={{ ...btn(ui.bellOn ? '#dc2626' : '#f97316'), position: 'absolute', right: '16px', bottom: '16px', minHeight: '110px', minWidth: '110px', borderRadius: '50%', fontSize: '1.3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: ui.bellOn ? 'none' : 'bpsTownPulse 0.9s ease-in-out infinite' }}>
          <span style={{ fontSize: '2.6rem', lineHeight: 1 }}>🔔</span>{ui.bellOn ? '내려요' : '벨 누르기'}
        </button>}

        {ui.mode === 'choose' && sel && <div style={overlay} onPointerDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
          <div style={panel}>
            <div style={{ fontFamily: JUA, fontSize: '1.7rem', color: '#4a3424' }}>{sel.emoji} {sel.name}에 갈까요?</div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={goCar} style={big('#f1f5f9', '#0f172a')}><span style={{ fontSize: '2.4rem' }}>🚗</span>아빠 차</button>
              <button onClick={goBus} style={{ ...big(busNote ? '#e5e7eb' : '#2563eb', busNote ? '#6b7280' : '#ffffff') }}><span style={{ fontSize: '2.4rem', opacity: busNote ? 0.5 : 1 }}>🚌</span>버스{busNote && <span style={{ fontSize: '0.85rem' }}>{busNote}</span>}</button>
              {ui.metro && <button onClick={goMetro} style={big('#0ea5e9')}><span style={{ fontSize: '2.4rem' }}>🚇</span>지하철</button>}
              {walkOk && <button onClick={goWalk} style={big('#fce7f3', '#be185d')}><span style={{ fontSize: '2.4rem' }}>🚶</span>걸어가기</button>}
            </div>
            <button onClick={cancel} style={btn('#f6efe7', '#5c5248')}>✕ 안 갈래요</button>
          </div>
        </div>}

        {ui.mode === 'cross' && ui.crossTo && <div style={overlay} onPointerDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
          <div style={panel}>
            <div style={{ fontFamily: JUA, fontSize: '1.7rem', color: '#4a3424' }}>🗺️ 옆 동네 {TOWNS[ui.crossTo].name}에 갈까요?</div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => crossCar(null, ui.crossTo)} style={big('#f1f5f9', '#0f172a')}><span style={{ fontSize: '2.4rem' }}>🚗</span>아빠 차</button>
              {(ui.crossLines || []).map(n => <button key={n} onClick={() => crossMetro(n)} style={big(n === 1 ? '#1e3a8a' : '#0ea5e9')}><span style={{ fontSize: '2.4rem' }}>🚇</span>{n}호선 지하철</button>)}
              {!(ui.crossLines || []).length && <button onClick={() => say(VOICE.townNeedStation())} style={big('#e5e7eb', '#6b7280')}><span style={{ fontSize: '2.4rem', opacity: 0.5 }}>🚇</span>지하철<span style={{ fontSize: '0.85rem' }}>역에서 타요</span></button>}
            </div>
            <button onClick={cancel} style={btn('#f6efe7', '#5c5248')}>✕ 안 갈래요</button>
          </div>
        </div>}

        {ui.mode === 'busPick' && sel && <div style={overlay}>
          <div style={{ ...panel, background: '#f0f9ff', width: 'min(980px, 100%)', maxHeight: '100%', padding: '16px 18px', gap: '10px' }}>
            <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: '#0c4a6e' }}>🚏 {ui.boardLabel}{ui.transfer && <span style={{ marginLeft: '8px', fontSize: '1rem', background: '#fef3c7', color: '#92400e', borderRadius: '12px', padding: '2px 10px' }}>🔁 갈아타기</span>}</div>
            <div style={{ fontFamily: JUA, fontSize: '1.2rem', color: '#7c2d12' }}>{sel.emoji} {sel.name}에 가는 버스는? <span style={{ fontSize: '0.95rem', color: '#64748b' }}>(가는 버스 {ui.choices.length}대)</span></div>
            <div style={{ display: 'flex', gap: '12px 10px', flexWrap: 'wrap', justifyContent: 'center', overflowY: 'auto', padding: '4px 4px 16px', minHeight: 0 }}>
              {ui.choices.map(ch => {
                const st = busStyle(ch.type), shake = ui.wrong === ch.id;
                return (
                  <button key={ch.id} onClick={() => pickBus(ch.id)} style={{ border: 'none', cursor: 'pointer', touchAction: 'manipulation', background: st.color, borderRadius: '18px 18px 12px 12px', padding: '8px 10px 18px', width: '132px', position: 'relative', boxShadow: `0 8px 0 -2px ${st.dark}, 0 14px 18px -12px rgba(0,0,0,0.5)`, animation: shake ? 'bpsTownShake 0.5s' : 'none', color: st.text || '#ffffff', fontFamily: JUA, opacity: ch.ok ? 1 : 0.55, marginBottom: '8px' }}>
                    <div style={{ background: '#111827', color: '#fb923c', borderRadius: '7px', fontSize: ch.name.length > 5 ? '1.15rem' : '1.6rem', padding: '1px 6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{ch.name}</div>
                    <div style={{ display: 'flex', gap: '4px', margin: '6px 0 3px' }}>{[0, 1, 2, 3].map(i => <span key={i} style={{ flex: 1, height: '16px', background: '#bfdbfe', borderRadius: '4px' }} />)}</div>
                    <div style={{ fontSize: '0.85rem' }}>{st.label}</div>
                    <div style={{ fontSize: '0.8rem', minHeight: '2.2em', lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!ch.ok ? '✕ 안 가요' : ch.via ? `🔁 ${ch.via}에서 갈아타요` : `✓ ${ch.n}정류장`}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.stop}</div>
                    {[12, 'calc(100% - 32px)'].map((l, i) => <span key={i} style={{ position: 'absolute', left: l, bottom: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: '#111827', border: '3px solid #d1d5db' }} />)}
                  </button>
                );
              })}
            </div>
            {!ui.transfer && <button onClick={cancel} style={btn('#e0f2fe', '#0c4a6e')}>↩ 돌아가기</button>}
          </div>
        </div>}

        {ui.mode === 'card' && card && <div style={{ ...overlay, alignItems: 'flex-end', background: 'transparent', pointerEvents: 'none' }}>
          <div style={{ ...panel, flexDirection: 'row', gap: '18px', pointerEvents: 'auto', maxWidth: '760px', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '3.6rem', width: '90px', height: '90px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{card.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: JUA, fontSize: '1.7rem', color: '#4a3424' }}>{card.name}{ui.newStamp && <span style={{ marginLeft: '10px', fontSize: '1.1rem', color: '#b45309', background: '#fef3c7', borderRadius: '12px', padding: '2px 10px' }}>🏅 도장 쾅!</span>}</div>
              <div style={{ fontFamily: JUA, fontSize: '1.15rem', color: '#57534e', marginTop: '4px', lineHeight: 1.4 }}>{card.desc}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => say(VOICE.townArrive(card))} style={btn('#ffffff', '#9a3412')}>🔊</button>
              <button onClick={closeCard} style={btn('#16a34a')}>좋아요!</button>
            </div>
          </div>
        </div>}
      </div>
      <style>{`@keyframes bpsTownPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.6); } 50% { box-shadow: 0 0 0 16px rgba(249,115,22,0); } }
@keyframes bpsTownShake { 0%,100% { margin-left: 0; } 20% { margin-left: -10px; } 40% { margin-left: 10px; } 60% { margin-left: -6px; } 80% { margin-left: 6px; } }`}</style>
    </div>
  );
}
