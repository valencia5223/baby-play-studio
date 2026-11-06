// ═════════════════════════════════════════════════════════════════════════════
// 🚗 우리 동네 (군포·안양·의왕·과천): 하나로 이어진 그림 지도 위의 장소를 누르면 아빠 차·버스·지하철·걸어서 유나가 이동한다
//  - 지도: 온 동네 좌표(townData.js)를 화면 한 장(1×1) 크기 조각(타일)으로 나눠 그려 두고, 카메라(cam)가 보는 곳만 붙여 그린다.
//    아파트·나무 자리는 온 동네 격자에서 정해서 조각 경계에서도 이어진다. 손가락으로 끌면 지도가 움직이고, 위 동네 버튼으로 옮겨 볼 수 있다
//  - 구름·전철·지나가는 차·장소 그림·유나·아빠 차·버스는 매 프레임. 탈것이 움직이면 카메라가 따라간다
//  - 길·버스 노선은 townData.js (네 동네 경기버스 노선을 이어 붙임, scripts/update-bus.mjs)
//  - 흐름: 장소 콕 → '무엇을 타고 갈까?'(아빠 차 / 버스 / 지하철 / 걷기) → 이동 → 도착 카드 + 도장
//    버스: 정류장에 서는 버스 중 목적지에 가는 버스를 골라 타고, 내릴 때 벨을 누른다 (동네를 넘어가는 버스도)
//    지하철: 가까운 역까지 걸어가 타고, 필요하면 금정역(4↔1)·사당역(4↔2)에서 갈아탄다
//  - 유나 그림은 그림책(StoryBook.jsx)의 drawYuna 를 그대로 쓴다
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { drawYuna } from './StoryBook.jsx';
import { TOWNS, TOWN_LIST, ALL_TOWN_SPOTS, SPOT_BY_ID, NODES, EDGES, HILLS, RIVERS, LINES, WORLD_BOUNDS, roadPath, meters, busBoard, canBus, busStyle, busLabel, shortStop, nodeOfStop, stopsAtNode, HOME_STOPS, metroPlan, townAt, loadTown, saveTown, LINE_COLOR, SEAS, ISLANDS, DAMS, inSea, isRural } from './townData.js';
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };
const nodeUV = (i) => ({ u: NODES[i].u, v: NODES[i].v });
const inHill = (p, pad = 1) => HILLS.some(([u, v, ru, rv]) => ((p.u - u) / ru) ** 2 + ((p.v - v) / rv) ** 2 < pad);
const nearRiver = (p, k = 0.035) => RIVERS.some(rv => rv.some((a, i) => i > 0 && segDist(p.u, p.v * 0.6, rv[i - 1].u, rv[i - 1].v * 0.6, a.u, a.v * 0.6) < k));
// 노드 이웃 (지나가는 차)
const NB = NODES.map(() => []);
EDGES.forEach(([a, b]) => { NB[a].push(b); NB[b].push(a); });

// ═══════════════ 배치: cam = 화면 지도 칸 왼쪽 위의 온 동네 좌표, 화면 한 장 = 1×1 ═══════════════
function layout(W, H, cam) {
  const s = Math.max(0.62, Math.min(1.35, Math.min(W, H) / 720));
  const ox = W * 0.015, oy = H * 0.05, mw = W * 0.97, mh = H * 0.92;
  const X = (p) => ox + (p.u - cam.u) * mw, Y = (p) => oy + (p.v - cam.v) * mh;
  return { W, H, s, ox, oy, mw, mh, X, Y, cam };
}

// ═══════════════ 고정 배경: 지도 조각(타일) ═══════════════
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
const PASTEL = ['#fde2e4', '#fff1c1', '#dbeafe', '#e0f2e9', '#f3e8ff', '#ffe4cc', '#fefce8'];
const ROOFS = ['#f87171', '#fb923c', '#60a5fa', '#34d399', '#a78bfa', '#f472b6'];
// 지도 조각 하나 (ti, tj): 온 동네 u ∈ [ti, ti+1], v ∈ [tj, tj+1]
function buildTile(ti, tj, L, dpr) {
  const { mw, mh, s } = L;
  const cv = document.createElement('canvas'); cv.width = Math.round(mw * dpr); cv.height = Math.round(mh * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const X = (p) => (p.u - ti) * mw, Y = (p) => (p.v - tj) * mh;
  const TL = { X, Y };
  const near = (x, y, pad) => x > -pad && x < mw + pad && y > -pad && y < mh + pad;
  // 풀밭
  c.fillStyle = '#b9e3a0'; c.fillRect(0, 0, mw, mh);
  const r0 = rng(ti * 7919 + tj * 104729 + 99991);
  for (let i = 0; i < 260; i++) { c.fillStyle = r0() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(60,120,40,0.12)'; ell(c, r0() * mw, r0() * mh, (2 + r0() * 5) * s, (1 + r0() * 2) * s); c.fill(); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  // 바다: 모래 해변 → 물 → 잔물결, 그 위에 섬(모래 → 풀)과 방조제 길
  const poly = (pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p), Y(p)) : c.moveTo(X(p), Y(p)))); c.closePath(); };
  if (SEAS.length) {
    SEAS.forEach(sp => { poly(sp); c.strokeStyle = '#f3dfae'; c.lineWidth = 22 * s; c.stroke(); });
    SEAS.forEach(sp => { poly(sp); c.fillStyle = '#6cc0ee'; c.fill(); c.strokeStyle = '#9fd8f5'; c.lineWidth = 8 * s; c.stroke(); });
    ISLANDS.forEach(il => { poly(il); c.strokeStyle = '#f3dfae'; c.lineWidth = 18 * s; c.stroke(); c.fillStyle = '#b9e3a0'; c.fill(); });
    const rw0 = rng(ti * 31 + tj * 977 + 5);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2.2 * s;
    for (let i = 0; i < 90; i++) {
      const x = rw0() * mw, y = rw0() * mh;
      if (!inSea({ u: ti + x / mw, v: tj + y / mh })) continue;
      const w = (8 + rw0() * 8) * s; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w / 2, y - 4 * s, x, y); c.quadraticCurveTo(x + w / 2, y - 4 * s, x + w, y); c.stroke();
    }
    DAMS.forEach(dm => {
      c.strokeStyle = '#a8a29e'; c.lineWidth = 16 * s; strokePath(c, TL, dm);
      c.strokeStyle = '#eef0f2'; c.lineWidth = 8 * s; strokePath(c, TL, dm);
    });
  }
  // 냇물: 풀 둑 → 물
  RIVERS.forEach(rv => {
    c.strokeStyle = '#b7e4a0'; c.lineWidth = 44 * s; strokePath(c, TL, rv);
    c.strokeStyle = '#7cc4f2'; c.lineWidth = 24 * s; strokePath(c, TL, rv);
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 3 * s; c.setLineDash([10 * s, 18 * s]); strokePath(c, TL, rv); c.setLineDash([]);
  });
  // 산 (뒤에서 앞으로)
  HILLS.map((h, k) => [h, k]).sort((a, b) => a[0][1] - b[0][1]).forEach(([[u, v, ru, rv], k]) => {
    const x = X({ u, v }), y = Y({ u, v }), rx = ru * mw, ry = rv * mh;
    if (!near(x, y, Math.max(rx, ry) + 20 * s)) return;
    const hg = c.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, Math.max(rx, ry));
    hg.addColorStop(0, '#86cf6f'); hg.addColorStop(0.7, '#4f9e48'); hg.addColorStop(1, '#3f8a3c');
    c.fillStyle = hg; ell(c, x, y, rx, ry); c.fill();
    const rr = rng(40 + k);
    for (let i = 0; i < 26; i++) { const a = rr() * TAU, q = Math.sqrt(rr()) * 0.85; drawTree(c, x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q, (6 + rr() * 5) * s, rr() < 0.5 ? '#2f7d32' : '#3c8f3a'); }
  });
  // 공원·꽃동산 바닥
  const parks = ALL_TOWN_SPOTS.filter(sp => sp.kind === 'park'), flowers = ALL_TOWN_SPOTS.filter(sp => sp.kind === 'azalea');
  parks.forEach(pk => { c.fillStyle = '#8fd97c'; ell(c, X(pk.r), Y(pk.r), 0.04 * mw, 0.035 * mh); c.fill(); });
  flowers.forEach(az => { c.fillStyle = '#f9c5dc'; ell(c, X(az.a), Y(az.a) + 6 * s, 0.05 * mw, 0.04 * mh); c.fill(); });
  // 길: 테두리 → 바탕 (이 조각 근처만)
  const rw = 7 * s, pad = 0.2;
  const edges = EDGES.filter(([a, b]) => { const A = NODES[a], B = NODES[b]; return Math.max(A.u, B.u) > ti - pad && Math.min(A.u, B.u) < ti + 1 + pad && Math.max(A.v, B.v) > tj - pad && Math.min(A.v, B.v) < tj + 1 + pad; });
  const spots = ALL_TOWN_SPOTS.filter(sp => { const x = X(sp.a), y = Y(sp.a); return near(x, y, 0.4 * mw); });
  const roadPass = (w, col) => {
    c.strokeStyle = col; c.lineWidth = w;
    edges.forEach(([a, b]) => { c.beginPath(); c.moveTo(X(NODES[a]), Y(NODES[a])); c.lineTo(X(NODES[b]), Y(NODES[b])); c.stroke(); });
    spots.forEach(sp => { if (sp.link) return; c.beginPath(); c.moveTo(X(sp.r), Y(sp.r)); c.lineTo(X(NODES[sp.node]), Y(NODES[sp.node])); c.stroke(); });
  };
  roadPass(rw + 4 * s, '#9aa1a9'); roadPass(rw, '#eef0f2');
  // 산길 (수리산)
  spots.filter(sp => sp.link).forEach(ms => {
    c.setLineDash([6 * s, 5 * s]); c.strokeStyle = '#a16207'; c.lineWidth = 3.5 * s;
    c.beginPath(); c.moveTo(X(NODES[ms.node]), Y(NODES[ms.node])); c.lineTo(X(ms.r), Y(ms.r)); c.stroke(); c.setLineDash([]);
  });
  // 철길
  LINES.forEach(rl => {
    c.strokeStyle = '#b8b2aa'; c.lineWidth = 12 * s; strokePath(c, TL, rl.pts);
    c.strokeStyle = '#7c4a1e'; c.lineWidth = 2 * s;
    for (let i = 1; i < rl.pts.length; i++) {
      const ax = X(rl.pts[i - 1]), ay = Y(rl.pts[i - 1]), bx = X(rl.pts[i]), by = Y(rl.pts[i]), len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (let d = 0; d < len; d += 8 * s) { const x = ax + (bx - ax) * d / len, y = ay + (by - ay) * d / len; if (!near(x, y, 10)) continue; c.beginPath(); c.moveTo(x - nx * 6 * s, y - ny * 6 * s); c.lineTo(x + nx * 6 * s, y + ny * 6 * s); c.stroke(); }
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
  // 아파트·나무: 온 동네 격자에서 자리를 정한다 (옆 조각과 같은 자리 → 경계에서 이어진다)
  const segs = [];
  edges.forEach(([a, b]) => segs.push([X(NODES[a]), Y(NODES[a]), X(NODES[b]), Y(NODES[b]), rw]));
  LINES.forEach(rl => { for (let i = 1; i < rl.pts.length; i++) segs.push([X(rl.pts[i - 1]), Y(rl.pts[i - 1]), X(rl.pts[i]), Y(rl.pts[i]), 12 * s]); });
  spots.forEach(sp => segs.push([X(sp.r), Y(sp.r), X(NODES[sp.node]), Y(NODES[sp.node]), rw]));
  const step = 30 * s, items = [], blocks = [];
  const gx0 = Math.floor((ti * mw - 60 * s) / step), gx1 = Math.ceil(((ti + 1) * mw + 60 * s) / step);
  const gy0 = Math.floor((tj * mh - 80 * s) / step), gy1 = Math.ceil(((tj + 1) * mh + 60 * s) / step);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const rb = rng(((gx * 73856093) ^ (gy * 19349663)) >>> 0 || 7);
    const wx = (gx + 0.5) * step + (rb() - 0.5) * step * 0.5, wy = (gy + 0.7) * step + (rb() - 0.5) * step * 0.4;
    const px = wx - ti * mw, py = wy - tj * mh, p = { u: wx / mw, v: wy / mh };
    if (inHill(p, 1.15) || inSea(p)) continue;
    if (nearRiver(p)) { if (rb() < 0.3 && !nearRiver(p, 0.02)) items.push({ k: 't', x: px, y: py }); continue; }
    const bw = (13 + rb() * 7) * s, bh = (16 + rb() * 18) * s;
    if (segs.some(([ax, ay, bx, by, w]) => segDist(px, py - bh * 0.4, ax, ay, bx, by) < w / 2 + bh * 0.55 + 3 * s)) continue;
    if (spots.some(sp => Math.hypot(X(sp.a) - px, Y(sp.a) - py + 20 * s) < 62 * s)) continue;
    if (parks.some(pk => Math.hypot(X(pk.r) - px, Y(pk.r) - py) < 0.045 * mw)) { items.push({ k: 't', x: px, y: py }); continue; }
    if (flowers.some(az => Math.hypot(X(az.a) - px, Y(az.a) - py) < 0.055 * mw)) continue;
    if (isRural(p)) {
      const k = rb();
      if (k < 0.32) items.push({ k: 't', x: px, y: py });
      else if (k < 0.4) items.push({ k: 'b', x: px - bw * 0.4, y: py, w: bw * 0.8, h: (9 + rb() * 4) * s, col: PASTEL[Math.floor(rb() * PASTEL.length)], roof: ROOFS[Math.floor(rb() * ROOFS.length)] });
      continue;
    }
    items.push(rb() < 0.72 ? { k: 'b', x: px - bw / 2, y: py, w: bw, h: bh, col: PASTEL[Math.floor(rb() * PASTEL.length)], roof: ROOFS[Math.floor(rb() * ROOFS.length)] } : { k: 't', x: px, y: py });
  }
  items.sort((a, b) => a.y - b.y).forEach(it => {
    if (it.k === 'b') { drawBuilding(c, it.x, it.y, it.w, it.h, it.col, it.roof); blocks.push(it); }
    else drawTree(c, it.x, it.y, 7 * s, '#4ea24a');
  });
  // 동네 이름 (크게, 연하게) + 동네 안 구역 이름
  TOWN_LIST.forEach(t => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const x = t.label ? X(t.label) : 0, y = t.label ? Y(t.label) : 0;
    if (t.label && near(x, y, 200 * s)) {
      const fs = Math.round(44 * s); c.font = `${fs}px ${JUA}`;
      c.lineWidth = 8 * s; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.strokeText(t.name, x, y); c.fillStyle = 'rgba(15,118,110,0.75)'; c.fillText(t.name, x, y);
    }
    t.areas.forEach(ar => {
      const ax = X(ar.p), ay = Y(ar.p), fs2 = Math.round(26 * s); c.font = `${fs2}px ${JUA}`;
      const tw = c.measureText(ar.name).width + fs2;
      c.fillStyle = 'rgba(255,255,255,0.75)'; rrect(c, ax - tw / 2, ay - fs2 * 0.75, tw, fs2 * 1.5, fs2 * 0.75); c.fill();
      c.fillStyle = '#0f766e'; c.fillText(ar.name, ax, ay + 1);
    });
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
    const lines = (sp.lines || ['4']).map(n => [n, (LINE_COLOR[n] || LINE_COLOR[4])[1]]);
    lines.forEach(([n, col], i) => {
      const bx = (i - (lines.length - 1) / 2) * u * 0.5, by = -h - u * 0.62;
      c.fillStyle = col; c.beginPath(); c.arc(bx, by, u * 0.22, 0, TAU); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = u * 0.05; c.stroke();
      c.fillStyle = '#ffffff'; c.font = `bold ${Math.round(u * (n.length > 1 ? 0.19 : 0.3))}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, bx, by + u * 0.01);
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
  } else if (K === 'ktx') {
    // KTX 역: 커다란 유리 지붕 + 쌩 지나가는 고속열차
    c.fillStyle = '#e0f2fe'; c.beginPath(); c.moveTo(-u * 1.5, 0); c.lineTo(-u * 1.5, -u * 0.8); c.quadraticCurveTo(0, -u * 1.7, u * 1.5, -u * 0.8); c.lineTo(u * 1.5, 0); c.closePath(); c.fill();
    c.strokeStyle = '#0369a1'; c.lineWidth = u * 0.06; c.stroke();
    c.strokeStyle = 'rgba(3,105,161,0.4)'; c.lineWidth = u * 0.03; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * u * 0.55, 0); c.lineTo(i * u * 0.55, -u * (1.2 - Math.abs(i) * 0.15)); c.stroke(); }
    const tx = ((t * 0.5) % 1) * u * 4 - u * 2;
    c.save(); c.beginPath(); c.rect(-u * 1.5, -u * 0.6, u * 3, u * 0.6); c.clip();
    c.fillStyle = '#f8fafc'; rrect(c, tx - u * 0.9, -u * 0.48, u * 1.8, u * 0.32, u * 0.16); c.fill();
    c.fillStyle = '#1d4ed8'; c.fillRect(tx - u * 0.9, -u * 0.3, u * 1.8, u * 0.06);
    c.fillStyle = '#334155'; for (let k = 0; k < 4; k++) c.fillRect(tx - u * 0.6 + k * u * 0.35, -u * 0.44, u * 0.18, u * 0.1);
    c.restore();
  } else if (K === 'cave') {
    // 동굴: 바위산 + 어두운 입구 + 박쥐
    c.fillStyle = '#78716c'; c.beginPath(); c.moveTo(-u * 1.5, 0); c.quadraticCurveTo(-u * 1.2, -u * 1.6, 0, -u * 1.7); c.quadraticCurveTo(u * 1.3, -u * 1.6, u * 1.5, 0); c.closePath(); c.fill();
    c.fillStyle = '#57534e'; ell(c, -u * 0.6, -u * 1.0, u * 0.35, u * 0.2); c.fill(); ell(c, u * 0.7, -u * 0.7, u * 0.3, u * 0.18); c.fill();
    c.fillStyle = '#1c1917'; c.beginPath(); c.moveTo(-u * 0.5, 0); c.quadraticCurveTo(-u * 0.5, -u * 0.9, 0, -u * 0.95); c.quadraticCurveTo(u * 0.5, -u * 0.9, u * 0.5, 0); c.closePath(); c.fill();
    ['#fde047', '#f472b6', '#38bdf8'].forEach((col, i) => { c.fillStyle = col; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i * 2); ell(c, (i - 1) * u * 0.22, -u * 0.35 - i * u * 0.12, u * 0.06, u * 0.06); c.fill(); });
    c.globalAlpha = 1; c.font = `${Math.round(u * 0.45)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🦇', Math.sin(t * 2) * u * 0.6, -u * 1.9 + Math.sin(t * 5) * u * 0.08);
  } else if (K === 'ikea') {
    // 파란 큰 상자 건물 + 노란 띠
    const w = u * 2.4, h = u * 1.2;
    c.fillStyle = '#1d4ed8'; c.fillRect(-w / 2, -h, w, h); c.fillStyle = '#facc15'; c.fillRect(-w / 2, -h * 0.72, w, h * 0.2);
    c.fillStyle = '#1d4ed8'; c.font = `${Math.round(u * 0.26)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('이케아', 0, -h * 0.62);
    c.fillStyle = '#93c5fd'; c.fillRect(-u * 0.3, -h * 0.4, u * 0.6, h * 0.4);
    c.font = `${Math.round(u * 0.5)}px sans-serif`; c.fillText('🛋️', w * 0.55, -u * 0.3);
  } else if (K === 'railbike') {
    // 레일바이크: 둥근 기찻길 위를 달리는 자전거 수레
    c.strokeStyle = '#78716c'; c.lineWidth = u * 0.08; ell(c, 0, -u * 0.45, u * 1.4, u * 0.5); c.stroke();
    c.strokeStyle = '#a8a29e'; c.lineWidth = u * 0.03; ell(c, 0, -u * 0.45, u * 1.22, u * 0.4); c.stroke();
    c.fillStyle = '#86efac'; ell(c, 0, -u * 0.45, u * 1.0, u * 0.28); c.fill();
    const a = t * 0.9, bx = Math.cos(a) * u * 1.31, by = -u * 0.45 + Math.sin(a) * u * 0.45;
    c.fillStyle = '#ef4444'; rrect(c, bx - u * 0.3, by - u * 0.3, u * 0.6, u * 0.24, u * 0.06); c.fill();
    c.fillStyle = '#1f2937'; [-0.18, 0.18].forEach(q => { ell(c, bx + q * u, by - u * 0.04, u * 0.08, u * 0.08); c.fill(); });
    c.font = `${Math.round(u * 0.4)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('🙌', bx, by - u * 0.28);
  } else if (K === 'zoo') {
    // 동물원: 나무 울타리 + 기린·코끼리·사자
    c.fillStyle = '#86efac'; ell(c, 0, -u * 0.25, u * 1.5, u * 0.45); c.fill();
    c.strokeStyle = '#a16207'; c.lineWidth = u * 0.06;
    c.beginPath(); c.moveTo(-u * 1.45, -u * 0.35); c.lineTo(u * 1.45, -u * 0.35); c.moveTo(-u * 1.45, -u * 0.12); c.lineTo(u * 1.45, -u * 0.12); c.stroke();
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(i * u * 0.23, -u * 0.5); c.lineTo(i * u * 0.23, 0); c.stroke(); }
    c.font = `${Math.round(u * 0.85)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillText('🦒', -u * 0.75, -u * 0.35 + Math.sin(t * 2) * u * 0.04);
    c.font = `${Math.round(u * 0.65)}px sans-serif`; c.fillText('🐘', u * 0.2, -u * 0.3 + Math.abs(Math.sin(t * 1.5)) * -u * 0.06);
    c.font = `${Math.round(u * 0.5)}px sans-serif`; c.fillText('🦁', u * 0.95, -u * 0.32);
  } else if (K === 'themepark') {
    // 놀이공원: 빙글빙글 관람차
    const R = u * 1.05, cy = -u * 1.3;
    c.strokeStyle = '#64748b'; c.lineWidth = u * 0.07; c.beginPath(); c.moveTo(-u * 0.55, 0); c.lineTo(0, cy); c.lineTo(u * 0.55, 0); c.stroke();
    c.strokeStyle = '#f472b6'; c.lineWidth = u * 0.06; c.beginPath(); c.arc(0, cy, R, 0, TAU); c.stroke();
    const rot = t * 0.5, cols = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#facc15'];
    for (let i = 0; i < 8; i++) {
      const a = rot + i / 8 * TAU, px = Math.cos(a) * R, py = cy + Math.sin(a) * R;
      c.strokeStyle = 'rgba(148,163,184,0.8)'; c.lineWidth = u * 0.03; c.beginPath(); c.moveTo(0, cy); c.lineTo(px, py); c.stroke();
      c.fillStyle = cols[i]; rrect(c, px - u * 0.16, py - u * 0.02, u * 0.32, u * 0.26, u * 0.06); c.fill();
    }
    c.fillStyle = '#f8fafc'; ell(c, 0, cy, u * 0.14, u * 0.14); c.fill();
  } else if (K === 'science') {
    // 과학관: 하얀 돔 + 로켓 발사
    c.fillStyle = '#e2e8f0'; c.fillRect(-u * 1.1, -u * 0.6, u * 2.2, u * 0.6); c.strokeStyle = '#64748b'; c.lineWidth = u * 0.05; c.strokeRect(-u * 1.1, -u * 0.6, u * 2.2, u * 0.6);
    c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(-u * 0.2, -u * 0.6, u * 0.75, Math.PI, 0); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(100,116,139,0.5)'; c.lineWidth = u * 0.03; [-0.45, 0.05].forEach(q => { c.beginPath(); c.moveTo(q * u, -u * 0.6); c.lineTo(q * u, -u * 1.3); c.stroke(); });
    const ry = -u * 1.1 - ((t * 0.6) % 1) * u * 0.9;
    c.font = `${Math.round(u * 0.6)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚀', u * 0.85, ry);
    c.fillText('🦕', -u * 0.85, -u * 0.95);
  } else if (K === 'horse') {
    // 경마장: 타원 트랙 위를 달리는 말
    c.fillStyle = '#d9a066'; ell(c, 0, -u * 0.5, u * 1.5, u * 0.62); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = u * 0.06; c.stroke();
    c.fillStyle = '#4ade80'; ell(c, 0, -u * 0.5, u * 1.05, u * 0.36); c.fill();
    const a = t * 1.2, hx = Math.cos(a) * u * 1.28, hy = -u * 0.5 + Math.sin(a) * u * 0.5;
    c.save(); c.translate(hx, hy); c.scale(Math.sin(a) > 0 ? 1 : -1, 1);
    c.font = `${Math.round(u * 0.6)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('🐎', 0, u * 0.2 + Math.abs(Math.sin(t * 10)) * -u * 0.08); c.restore();
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
  } else if (K === 'lighthouse') {
    // 빨간 등대: 줄무늬 탑 + 빙글 도는 불빛 + 갈매기
    const h = u * 2.2;
    c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(-u * 0.45, 0); c.lineTo(-u * 0.28, -h); c.lineTo(u * 0.28, -h); c.lineTo(u * 0.45, 0); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; [0.3, 0.62].forEach(q => { const y0 = -h * q, w0 = u * (0.45 - 0.17 * q); c.fillRect(-w0, y0 - u * 0.12, w0 * 2, u * 0.24); });
    c.fillStyle = '#fef08a'; rrect(c, -u * 0.25, -h - u * 0.4, u * 0.5, u * 0.4, u * 0.06); c.fill();
    c.fillStyle = '#b91c1c'; c.beginPath(); c.moveTo(-u * 0.35, -h - u * 0.4); c.lineTo(0, -h - u * 0.75); c.lineTo(u * 0.35, -h - u * 0.4); c.fill();
    const ang = t * 1.6, by = -h - u * 0.2;
    c.fillStyle = 'rgba(254,240,138,0.45)'; c.beginPath(); c.moveTo(0, by); c.lineTo(Math.cos(ang) * u * 1.8, by + Math.sin(ang) * u * 0.5 - u * 0.25); c.lineTo(Math.cos(ang) * u * 1.8, by + Math.sin(ang) * u * 0.5 + u * 0.25); c.fill();
    c.font = `${Math.round(u * 0.45)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🕊️', u * 0.9 + Math.sin(t * 1.3) * u * 0.4, -h + Math.sin(t * 3) * u * 0.15);
  } else if (K === 'tidal') {
    // 조력발전소: 방조제 위 수문 + 달 전망대
    c.fillStyle = '#94a3b8'; c.fillRect(-u * 1.4, -u * 0.35, u * 2.8, u * 0.35);
    c.fillStyle = '#475569'; for (let i = 0; i < 4; i++) c.fillRect(-u * 1.2 + i * u * 0.65, -u * 0.3, u * 0.4, u * 0.25);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = u * 0.05; for (let i = 0; i < 4; i++) { const yy = -u * 0.1 + ((t * 0.8 + i * 0.25) % 1) * u * 0.25; c.beginPath(); c.moveTo(-u * 1.1 + i * u * 0.65, yy); c.lineTo(-u * 0.9 + i * u * 0.65, yy); c.stroke(); }
    c.fillStyle = '#e2e8f0'; c.fillRect(u * 0.55, -u * 2.0, u * 0.3, u * 1.7);
    c.fillStyle = '#facc15'; c.beginPath(); c.arc(u * 0.7, -u * 2.3, u * 0.42, 0, TAU); c.fill();
    c.fillStyle = '#6cc0ee'; c.beginPath(); c.arc(u * 0.88, -u * 2.4, u * 0.36, 0, TAU); c.fill();
  } else if (K === 'beach') {
    // 해수욕장: 모래밭 + 파라솔 + 모래성 + 철썩 파도
    c.fillStyle = '#fde68a'; ell(c, 0, -u * 0.25, u * 1.5, u * 0.5); c.fill();
    const wv = Math.sin(t * 2) * u * 0.08;
    c.strokeStyle = '#38bdf8'; c.lineWidth = u * 0.1; c.beginPath(); c.ellipse(0, -u * 0.25, u * 1.5 + wv, u * 0.5 + wv * 0.4, 0, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    c.strokeStyle = '#78350f'; c.lineWidth = u * 0.07; c.beginPath(); c.moveTo(-u * 0.4, -u * 0.2); c.lineTo(-u * 0.4, -u * 1.5); c.stroke();
    ['#ef4444', '#ffffff', '#ef4444', '#ffffff'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(-u * 0.4, -u * 1.35); c.arc(-u * 0.4, -u * 1.35, u * 0.8, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); c.closePath(); c.fill(); });
    c.fillStyle = '#d97706'; c.fillRect(u * 0.4, -u * 0.6, u * 0.6, u * 0.35); c.fillRect(u * 0.5, -u * 0.85, u * 0.18, u * 0.25); c.fillRect(u * 0.72, -u * 0.85, u * 0.18, u * 0.25);
    c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(u * 0.81, -u * 0.85); c.lineTo(u * 0.81, -u * 1.15); c.lineTo(u * 1.0, -u * 1.05); c.fill();
  } else if (K === 'grape') {
    // 포도밭: 덩굴 줄 + 주렁주렁 포도
    c.strokeStyle = '#78350f'; c.lineWidth = u * 0.06;
    [-0.9, 0, 0.9].forEach(q => { c.beginPath(); c.moveTo(q * u, 0); c.lineTo(q * u, -u * 1.2); c.stroke(); });
    c.beginPath(); c.moveTo(-u * 1.1, -u * 1.2); c.lineTo(u * 1.1, -u * 1.2); c.stroke();
    c.fillStyle = '#4ade80'; [-0.75, -0.25, 0.25, 0.75].forEach(q => { ell(c, q * u, -u * 1.3, u * 0.32, u * 0.2); c.fill(); });
    [-0.6, 0.05, 0.65].forEach((q, i) => {
      const sw = Math.sin(t * 2 + i) * u * 0.05;
      c.fillStyle = '#7c3aed'; [[0, 0], [-0.12, 0], [0.12, 0], [-0.06, 0.12], [0.06, 0.12], [0, 0.24]].forEach(([dx, dy]) => { c.beginPath(); c.arc(q * u + dx * u + sw, -u * 1.05 + dy * u, u * 0.08, 0, TAU); c.fill(); });
    });
  } else if (K === 'port') {
    // 항구: 나무 다리 + 둥실 배 + 누에섬 바람개비
    c.fillStyle = '#7dd3fc'; ell(c, 0, -u * 0.2, u * 1.6, u * 0.45); c.fill();
    c.fillStyle = '#a16207'; c.fillRect(-u * 1.4, -u * 0.35, u * 1.1, u * 0.18);
    const bob2 = Math.sin(t * 2.2) * u * 0.07;
    c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(-u * 0.1, -u * 0.35 + bob2); c.lineTo(u * 0.9, -u * 0.35 + bob2); c.lineTo(u * 0.7, -u * 0.1 + bob2); c.lineTo(u * 0.1, -u * 0.1 + bob2); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(u * 0.4, -u * 0.38 + bob2); c.lineTo(u * 0.4, -u * 1.1 + bob2); c.lineTo(u * 0.85, -u * 0.45 + bob2); c.closePath(); c.fill();
    [[-0.9, 1.7], [-0.45, 1.5]].forEach(([q, hh], i) => {
      const bx = q * u, top = -u * hh;
      c.strokeStyle = '#e5e7eb'; c.lineWidth = u * 0.07; c.beginPath(); c.moveTo(bx, -u * 0.35); c.lineTo(bx, top); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = u * 0.06;
      for (let k = 0; k < 3; k++) { const a = t * 2.5 + i + k * TAU / 3; c.beginPath(); c.moveTo(bx, top); c.lineTo(bx + Math.cos(a) * u * 0.35, top + Math.sin(a) * u * 0.35); c.stroke(); }
    });
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
  } else if (K === 'ginkgo') {
    // 오래된 큰 은행나무: 굵은 줄기 + 노란 잎 덩어리 + 팔랑 떨어지는 잎, 둘레에 돌 울타리
    c.fillStyle = '#94a3b8'; ell(c, 0, -u * 0.05, u * 1.2, u * 0.28); c.fill();
    c.fillStyle = '#6b4423'; c.beginPath(); c.moveTo(-u * 0.32, 0); c.lineTo(-u * 0.18, -u * 1.2); c.lineTo(u * 0.18, -u * 1.2); c.lineTo(u * 0.32, 0); c.fill();
    c.strokeStyle = '#6b4423'; c.lineWidth = u * 0.12; c.beginPath(); c.moveTo(0, -u * 1.0); c.lineTo(-u * 0.6, -u * 1.55); c.moveTo(0, -u * 1.1); c.lineTo(u * 0.55, -u * 1.65); c.stroke();
    [[-0.75, -1.7, 0.62], [0.7, -1.75, 0.6], [0, -2.15, 0.78], [-0.35, -1.45, 0.5], [0.4, -1.42, 0.5]].forEach(([x, y, r], i) => {
      c.fillStyle = i % 2 ? '#fde047' : '#facc15'; ell(c, u * x, u * y, u * r, u * r * 0.85); c.fill();
    });
    c.fillStyle = '#eab308';
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.35 + i * 0.25) % 1, lx = u * (-0.9 + i * 0.6) + Math.sin(t * 2 + i) * u * 0.2, ly = -u * 1.4 + p * u * 1.4;
      c.save(); c.translate(lx, ly); c.rotate(Math.sin(t * 3 + i)); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, u * 0.12, -Math.PI * 0.85, -Math.PI * 0.15); c.closePath(); c.fill(); c.restore();
    }
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
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + meters(pts[i - 1], pts[i]));
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
const AMB_COLS = ['#ef4444', '#facc15', '#38bdf8', '#a3e635', '#f472b6'];
const SAFE = 0.24;   // 움직이는 탈것이 화면 가장자리에서 이만큼 안쪽에 있도록 카메라가 따라간다
const clampCam = (c) => { const b = WORLD_BOUNDS, m = 0.05; return { u: Math.max(b.u0 - m, Math.min(b.u1 - 1 + m, c.u)), v: Math.max(b.v0 - m, Math.min(b.v1 - 1 + m, c.v)) }; };
const camOn = (p) => clampCam({ u: p.u - 0.5, v: p.v - 0.55 });

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
  const [ui, setUi] = useState({ mode: 'idle', sel: null, choices: [], wrong: null, card: null, bell: false, bellOn: false, stamps: 0, at: 'home', view: 'sanbon', newStamp: false });

  const say = (text) => { const g = G.current; if (g) g.lastLine = text; if (speak && text) speak(text); };
  const later = (fn, ms) => { const g = G.current; const id = setTimeout(() => { g.timers = g.timers.filter(x => x !== id); fn(); }, ms); g.timers.push(id); };
  const sync = (extra = {}) => {
    const g = G.current;
    setUi(u => ({ ...u, mode: g.mode, sel: g.sel, at: g.at, view: g.view, bell: g.bell, bellOn: g.bellOn, stamps: Object.keys(g.save.stamps).length, ...extra }));
  };
  const sparkle = (p, n) => addSparkle(G.current, p, n);

  useEffect(() => {
    const save = loadTown();
    // 이 기기에서 유나가 마지막으로 있던 곳에서 시작한다 (없으면 군포 유나집)
    const startId = save.last && SPOT_BY_ID[save.last.at] ? save.last.at : 'home';
    const home = SPOT_BY_ID[startId];
    G.current = { t: 0, mode: 'idle', at: home.id, view: home.town, cam: camOn(home.a), camTo: null, drag: null, sel: null, save, timers: [], parts: [], amb: [], lastLine: '',
      yuna: { p: { ...home.a }, vis: true, walk: null, onDone: null, dir: 1 },
      car: { p: { ...home.r }, at: home.id, node: home.node, dir: 1, m: null, onDone: null, yuna: false, roll: 0 },
      bus: null, metro: null, route: null, bell: false, bellOn: false };
    later(() => { sync(); say(startId === 'home' ? VOICE.townWelcome() : VOICE.townArrive(home)); }, 400);
    return () => { G.current.timers.forEach(clearTimeout); G.current.timers = []; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 이동 시작 도우미 ──
  const walkYuna = (pts, onDone, speed = spd.walk, maxSec = 5) => { const g = G.current; g.yuna.vis = true; g.yuna.walk = mover(pts, speed, maxSec); g.yuna.onDone = onDone; };
  const driveCar = (pts, speed, onDone, maxSec = 7) => { const g = G.current; g.car.m = mover(pts, speed, maxSec); g.car.onDone = onDone; };
  const vroom = () => { audio.playFreq(98, 'sawtooth', 0.35, 0.12); setTimeout(() => audio.playFreq(147, 'sawtooth', 0.4, 0.1), 160); };
  const honk = () => { audio.playFreq(415, 'square', 0.13, 0.12); setTimeout(() => audio.playFreq(415, 'square', 0.18, 0.12), 190); };
  const curSpot = () => SPOT_BY_ID[G.current.at];

  // 장소 콕
  const originStops = () => { const g = G.current; return g.at === 'home' ? [...new Set([...HOME_STOPS, ...curSpot().stops])] : curSpot().stops; };
  const tapSpot = (sp) => {
    const g = G.current;
    if (g.mode !== 'idle') return;
    audio.playXylophone(880, 0.3);
    if (sp.id === g.at) { g.mode = 'card'; sync({ card: sp.id, newStamp: false }); say(VOICE.townArrive(sp)); return; }
    g.sel = sp.id; g.mode = 'choose';
    sync({ wrong: null, walk: canWalk(sp), bus: canBus(originStops(), sp), metro: !!metroPlan(curSpot(), sp) });
    say(VOICE.townHow(sp));
  };
  const canWalk = (sp) => meters(curSpot().r, sp.r) < 900;

  // 🚗 아빠 차: 차가 다른 곳에 있으면 데리러 오고, 유나가 걸어가서 탄 뒤 go()
  const boardCar = (from, go) => {
    const g = G.current;
    const board = () => {
      walkYuna([{ ...g.yuna.p }, { ...g.car.p }], () => {
        g.yuna.vis = false; g.car.yuna = true; audio.playFreq(220, 'triangle', 0.12, 0.3); audio.playNoise(0.12, 0.12, 900);
        later(go, 500);
      }, spd.walk * 0.5, 1.3);
    };
    if (g.car.at !== g.at) {
      say(VOICE.townPickup()); vroom();
      driveCar(roadPath(g.car.p, g.car.node, from.r, from.node), spd.pickup, () => { g.car.at = g.at; g.car.node = from.node; later(board, 300); }, 5);
    } else board();
  };
  // 차에서 내려 장소까지 걸어가 도착
  const carAlight = (sp) => {
    const g = G.current;
    g.car.at = sp.id; g.car.node = sp.node; g.route = null; audio.playNoise(0.12, 0.12, 900);
    later(() => { g.car.yuna = false; g.yuna.p = { ...g.car.p }; walkYuna([{ ...g.car.p }, { ...sp.a }], () => arrive(sp), spd.walk * 0.6, 1.3); }, 350);
  };
  const goCar = () => {
    const g = G.current, sp = SPOT_BY_ID[g.sel], from = curSpot();
    g.mode = 'move'; g.route = null; sync();
    boardCar(from, () => {
      say(VOICE.townCarGo(sp)); vroom();
      const pts = roadPath(from.r, from.node, sp.r, sp.node);
      g.route = { pts, col: '#f97316' };
      driveCar(pts, spd.car, () => carAlight(sp), 10);
    });
  };
  // 🚶 걷기
  const goWalk = () => {
    const g = G.current, sp = SPOT_BY_ID[g.sel], from = curSpot();
    g.mode = 'move'; sync();
    say(VOICE.townWalkGo(sp));
    const pts = [{ ...g.yuna.p }, ...roadPath(from.r, from.node, sp.r, sp.node), { ...sp.a }];
    g.route = { pts, col: '#ec4899' };
    walkYuna(pts, () => { g.route = null; arrive(sp); }, spd.walk, 6);
  };
  // 🚇 지하철: 가까운 역까지 걸어가서 타고, 필요하면 금정역에서 갈아탄 뒤 내려서 걸어간다
  const goMetro = () => {
    const g = G.current, sp = SPOT_BY_ID[g.sel], from = curSpot(), plan = metroPlan(from, sp);
    if (!plan) return;
    g.mode = 'move'; sync();
    const ext = (q0, q1, k) => ({ u: q0.u + (q0.u - q1.u) * k, v: q0.v + (q0.v - q1.v) * k });
    const startLeg = (i) => {
      const leg = plan.legs[i], lp = leg.pts;
      g.yuna.vis = false;
      const pts = [ext(lp[0], lp[1], 0.6), ...lp, ext(lp[lp.length - 1], lp[lp.length - 2], 0.6)];
      const m = mover(pts, 300, 99);
      // 서는 곳은 탈 역·내릴 역뿐. 중간 역은 멈추지 않고 지나가며 '띵동'만 (midAt)
      const stopAt = [m.cum[1], m.cum[pts.length - 2]], midAt = leg.mids.map(md => m.cum[1 + lp.indexOf(md.at)]);
      g.route = { pts: lp, col: leg.line.color };
      g.metro = { m, stopAt, midAt, midN: 0, si: 0, state: 'come', wait: 0, yuna: false, alpha: 0, col: leg.line.color,
        speed: Math.max(300, (stopAt[stopAt.length - 1] - stopAt[0]) / 7),
        onAlight: () => {
          const st = SPOT_BY_ID[leg.to]; g.yuna.p = { ...st.r }; g.yuna.vis = true; g.route = null;
          if (i + 1 < plan.legs.length) { say(VOICE.townMetroTransfer(st, plan.legs[i + 1].line.id)); later(() => startLeg(i + 1), 1400); }
          else if (st.id === sp.id) walkYuna([{ ...st.r }, { ...sp.a }], () => arrive(sp), spd.walk * 0.6, 1.2);
          else walkYuna([{ ...st.r }, ...roadPath(st.r, st.node, sp.r, sp.node), { ...sp.a }], () => arrive(sp), spd.walk, 4);
        } };
    };
    if (plan.from.id === from.id) { say(VOICE.townMetroGo(sp)); walkYuna([{ ...g.yuna.p }, { ...from.r }], () => startLeg(0), spd.walk * 0.6, 1.2); }
    else {
      say(VOICE.townMetroWalk(plan.from));
      const pts = [{ ...g.yuna.p }, ...roadPath(from.r, from.node, plan.from.r, plan.from.node)];
      g.route = { pts, col: '#ec4899' };
      walkYuna(pts, () => { g.route = null; say(VOICE.townMetroGo(sp)); startLeg(0); }, spd.walk, 4);
    }
  };
  // 🚌 버스: 정류장에 서는 버스를 모두 보여 준다 (가는 버스 → 갈아타는 버스 → 안 가는 버스)
  const openBoard = (stops, label, pref, transfer) => {
    const g = G.current, sp = SPOT_BY_ID[g.sel];
    g.board = busBoard(stops, sp, pref); g.boardStops = stops; g.mode = 'busPick'; g.transferring = !!transfer;
    const firstStop = (r) => { for (const run of r.runs) for (const id of run) if (stops.includes(id)) return id; return stops[0]; };
    sync({ wrong: null, boardLabel: label, transfer: !!transfer, choices: g.board.filter(ch => ch.ok).map(ch => ({ id: ch.route.id, name: busLabel(ch.route.name), type: ch.route.type, ok: ch.ok, n: ch.trip ? ch.trip.stops.length - 1 : 0,
      via: ch.transfer ? shortStop(ch.trip.via) : '', stop: shortStop(ch.trip ? ch.trip.from : firstStop(ch.route)) })) });
    say(transfer ? VOICE.townTransfer() : VOICE.townBusPick(sp));
  };
  const goBus = () => {
    const g = G.current, sp = SPOT_BY_ID[g.sel];
    if (!canBus(originStops(), sp)) { say(VOICE.townNoBus(sp)); audio.playFreq(300, 'triangle', 0.15, 0.3); return; }
    openBoard(originStops(), g.at === 'home' ? '우리집 앞 정류장' : `${curSpot().name} 근처 정류장`, g.at === 'home' ? HOME_STOPS[0] : null, false);
  };
  const pickBus = (id) => {
    const g = G.current, sp = SPOT_BY_ID[g.sel], ch = g.board.find(c => c.route.id === id);
    if (!ch) return;
    if (!ch.ok) { audio.playFreq(260, 'triangle', 0.15, 0.35); sync({ wrong: id }); say(VOICE.townBusWrong(sp)); later(() => sync({ wrong: null }), 700); return; }
    audio.playXylophone(1046.5, 0.4);
    const trip = ch.trip, from = curSpot();
    g.mode = 'move'; sync();
    say(VOICE.townBusOk(ch.route.name));
    const stopPts = trip.stops.map(id2 => nodeUV(nodeOfStop(id2)));
    const board = stopPts[0];
    const walkPts = g.transferring ? [{ ...g.yuna.p }, board] : [{ ...g.yuna.p }, ...roadPath(from.r, from.node, board, nodeOfStop(trip.from))];
    walkYuna(walkPts, () => {
      // 버스가 앞 정류장에서 들어온다
      const prev = trip.before != null && nodeOfStop(trip.before) != null ? nodeUV(nodeOfStop(trip.before)) : { u: board.u - (stopPts[1].u - board.u) * 0.5, v: board.v - (stopPts[1].v - board.v) * 0.5 };
      const after = trip.after.filter(id2 => nodeOfStop(id2) != null).map(id2 => nodeUV(nodeOfStop(id2)));
      const tripLen = stopPts.slice(1).reduce((a2, q, i) => a2 + meters(stopPts[i], q), 0);
      g.bus = { speed: Math.max(spd.bus, tripLen / 12), route: ch.route, style: busStyle(ch.route.type), seed: ch.route.name.length * 3, pts: [prev, ...stopPts, ...after], leg: 0, legK: 0, state: 'come', wait: 0, door: 0, yuna: false, alpha: 0, roll: 0, dir: 1, nDrop: stopPts.length, sp, via: ch.transfer ? trip.via : null };
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
    g.save.stamps[sp.id] = true; g.save.last = { town: sp.town, at: sp.id }; saveTown(g.save);
    sparkle(sp.a, 16); audio.playXylophone(1046.5, 0.4); setTimeout(() => audio.playXylophone(1318.5, 0.5), 160); setTimeout(() => audio.playXylophone(1568, 0.7), 320);
    say(VOICE.townArrive(sp));
    sync({ card: sp.id, newStamp: isNew });
    if (isNew && ALL_TOWN_SPOTS.every(s2 => g.save.stamps[s2.id])) later(() => { say(VOICE.townStampAll()); ALL_TOWN_SPOTS.forEach(s2 => sparkle(s2.a, 6)); }, 4500);
  };
  const closeCard = () => { const g = G.current; g.mode = 'idle'; sync({ card: null }); };
  const cancel = () => { const g = G.current; g.mode = 'idle'; g.sel = null; sync({ wrong: null }); };
  const goHome = () => {
    const g = G.current; if (!g) return;
    if (g.mode === 'card') { g.mode = 'idle'; sync({ card: null }); }
    if (g.mode !== 'idle' || g.at === 'home') return;
    g.sel = 'home'; goCar();
  };
  // 지도 옮겨 보기: 동네 버튼·유나 찾기
  const lookYuna = () => { const g = G.current; if (!g) return; g.camTo = camOn(g.yuna.p); audio.playFreq(660, 'sine', 0.08, 0.25); };

  // ── 터치: 장소 콕 / 아빠 차 빵빵 / 손가락으로 끌어 지도 옮기기 ──
  const pos = (e) => { const rc = canvasRef.current.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; };
  const onDown = (e) => {
    const g = G.current, cv = canvasRef.current; if (!g || !g.L || !cv) return;
    const [x, y] = pos(e), L = g.L;
    try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    let best = null, bd = Infinity;
    ALL_TOWN_SPOTS.forEach(sp => { const sx = L.X(sp.a), sy = L.Y(sp.a) - 22 * L.s, d = Math.hypot(x - sx, (y - sy) * 0.9); if (d < bd) { bd = d; best = sp; } });
    if (best && bd < 52 * L.s && g.mode === 'idle') { tapSpot(best); return; }
    g.drag = { x, y, cam: { ...g.cam }, moved: false };
  };
  const onMove = (e) => {
    const g = G.current; if (!g || !g.drag || !g.L) return;
    const [x, y] = pos(e), d = g.drag;
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 8) return;
    d.moved = true; g.camTo = null; g.userLookT = g.t;
    g.cam = clampCam({ u: d.cam.u - (x - d.x) / g.L.mw, v: d.cam.v - (y - d.y) / g.L.mh });
  };
  const onUp = (e) => {
    const g = G.current; if (!g || !g.drag) return;
    const d = g.drag; g.drag = null;
    if (d.moved || !g.L) return;
    const [x, y] = pos(e), L = g.L;
    // 아빠 차 빵빵
    const cx = L.X(g.car.p), cy = L.Y(g.car.p), cl = 86 * L.s;
    if (Math.abs(x - cx) < cl * 0.55 && y < cy + 6 && y > cy - cl * 0.45) { honk(); g.car.honkT = g.t; }
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = -1, t0 = 0;
    const tiles = new Map(), tileOrder = [];
    const tileOf = (i, j, L, W, H, dpr) => {
      const key = `${i},${j}@${W}x${H}@${dpr}`;
      let tl = tiles.get(key);
      if (!tl) {
        tl = buildTile(i, j, L, dpr); tiles.set(key, tl); tileOrder.push(key);
        while (tileOrder.length > 16) tiles.delete(tileOrder.shift());   // 오래된 조각은 버린다
      }
      return tl;
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
        const y = g.yuna, car = g.car, b = g.bus, mt = g.metro;

        // ── 카메라: 움직이는 것(탈 것·걷는 유나)을 화면 안쪽에 두도록 따라간다. 손으로 옮긴 뒤 잠깐은 그대로 ──
        let focus = null;
        if (b && b.yuna) { const a = b.pts[b.leg], c2 = b.pts[Math.min(b.leg + 1, b.pts.length - 1)], k = b.state === 'dwell' ? 0 : b.legK; focus = { u: a.u + (c2.u - a.u) * k, v: a.v + (c2.v - a.v) * k }; }
        else if (mt && mt.yuna) focus = moverAt(mt.m, mt.m.s);
        else if (car.m && (car.yuna || car.m.len > 1500)) focus = car.p;
        else if (y.walk) focus = y.p;
        if (focus && !g.drag && !(g.userLookT && t - g.userLookT < 2.5)) {
          const want = { ...g.cam }, sx = SAFE, sy = SAFE + 0.04;
          if (focus.u - want.u < sx) want.u = focus.u - sx; if (focus.u - want.u > 1 - sx) want.u = focus.u - (1 - sx);
          if (focus.v - want.v < sy) want.v = focus.v - sy; if (focus.v - want.v > 1 - sy * 0.6) want.v = focus.v - (1 - sy * 0.6);
          g.camTo = clampCam(want);
        }
        if (g.camTo && !g.drag) {
          const k = Math.min(1, dt * (focus ? 6 : 4));
          g.cam = { u: g.cam.u + (g.camTo.u - g.cam.u) * k, v: g.cam.v + (g.camTo.v - g.cam.v) * k };
          if (Math.abs(g.camTo.u - g.cam.u) < 1e-4 && Math.abs(g.camTo.v - g.cam.v) < 1e-4) g.camTo = null;
        }
        const L = layout(W, H, g.cam); g.L = L; const { X, Y, s } = L;
        // 지금 보고 있는 동네 이름 (위 제목)
        if (!g.viewT || t - g.viewT > 0.4) { g.viewT = t; const tv = townAt({ u: g.cam.u + 0.5, v: g.cam.v + 0.5 }).id; if (tv !== g.view) { g.view = tv; sync(); } }

        // 지도 조각 붙이기
        ctx.fillStyle = '#b9e3a0'; ctx.fillRect(0, 0, W, H);
        const i0 = Math.floor(g.cam.u - L.ox / L.mw), i1 = Math.floor(g.cam.u + (W - L.ox) / L.mw);
        const j0 = Math.floor(g.cam.v - L.oy / L.mh), j1 = Math.floor(g.cam.v + (H - L.oy) / L.mh);
        const shown = [];
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const tl = tileOf(i, j, L, W, H, dpr), dx = L.ox + (i - g.cam.u) * L.mw, dy = L.oy + (j - g.cam.v) * L.mh;
          ctx.drawImage(tl.cv, dx, dy, L.mw, L.mh); shown.push([tl, dx, dy]);
        }

        // ── 움직이기 ──
        if (y.walk) {
          y.walk.s += y.walk.speed * dt; const q = moverAt(y.walk, y.walk.s); y.p = { u: q.u, v: q.v }; if (Math.abs(q.du) > 1e-6) y.dir = Math.sign(q.du);
          if (y.walk.s >= y.walk.len) { y.walk = null; const f = y.onDone; y.onDone = null; if (f) f(); }
        }
        if (car.m) {
          car.m.s += car.m.speed * dt; car.roll += car.m.speed * dt * 0.02 * s;
          const q = moverAt(car.m, car.m.s); car.p = { u: q.u, v: q.v };
          const dx = q.du * L.mw, dy = q.dv * L.mh; if (Math.abs(dx) > 0.5) car.dir = Math.sign(dx);
          car.ang = Math.max(-0.28, Math.min(0.28, Math.atan2(dy, Math.abs(dx) + 1e-6) * 0.5)) * car.dir;
          if (car.m.s >= car.m.len) { car.m = null; car.ang = 0; const f = car.onDone; car.onDone = null; if (f) f(); }
        }
        if (b) {
          if (b.state === 'come' || b.state === 'go' || b.state === 'leave') {
            b.alpha = b.state === 'leave' ? Math.max(0, b.alpha - dt * 0.8) : Math.min(1, b.alpha + dt * 2.5);
            const a = b.pts[b.leg], c2 = b.pts[b.leg + 1];
            const seg = Math.max(1, meters(a, c2));
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
                later(() => openBoard(stopsAtNode(nodeOfStop(via)), `${shortStop(via)} 정류장`, null, true), 900);
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
        if (mt) {
          const target = mt.stopAt[mt.si];
          if (mt.state === 'come' || mt.state === 'go' || mt.state === 'leave') {
            mt.alpha = mt.state === 'leave' ? Math.max(0, mt.alpha - dt * 0.9) : Math.min(1, mt.alpha + dt * 2.5);
            mt.m.s += (mt.state === 'come' ? 260 : mt.speed) * dt;
            // 중간 역을 지날 때: 띵동만
            if (mt.state === 'go' && mt.midAt && mt.midN < mt.midAt.length && mt.m.s >= mt.midAt[mt.midN]) { mt.midN += 1; audio.playXylophone(1568, 0.25); setTimeout(() => audio.playXylophone(1318.5, 0.3), 160); }
            if (mt.state !== 'leave' && mt.m.s >= target) {
              mt.m.s = target; mt.state = 'dwell'; mt.wait = 0;
              audio.playXylophone(1568, 0.3); setTimeout(() => audio.playXylophone(1318.5, 0.4), 160);
            }
            if (mt.state === 'leave' && (mt.alpha <= 0 || mt.m.s >= mt.m.len)) { if (g.metro === mt) g.metro = null; }
          } else if (mt.state === 'dwell') {
            mt.wait += dt;
            const first = mt.si === 0, lastStop = mt.si === mt.stopAt.length - 1;
            if (first && !mt.yuna && mt.wait > 0.6) { mt.yuna = true; audio.playFreq(1568, 'sine', 0.12, 0.35); }
            if (lastStop && mt.yuna && mt.wait > 0.6) { mt.yuna = false; const f = mt.onAlight; mt.onAlight = null; if (f) f(); }
            if (mt.wait > (first ? 1.4 : lastStop ? 1.4 : 0.8)) { if (lastStop) mt.state = 'leave'; else { mt.si += 1; mt.state = 'go'; } }
          }
        }
        // 지나가는 차들: 화면 근처 길 위에서 달리고, 멀어지면 화면 안 다른 길로 옮긴다
        const inView = (p, m = 0.1) => p.u > g.cam.u - m && p.u < g.cam.u + 1 + m && p.v > g.cam.v - m && p.v < g.cam.v + 1 + m;
        while (g.amb.length < AMB_COLS.length) g.amb.push({ col: AMB_COLS[g.amb.length], a: -1 });
        g.amb.forEach(a => {
          if (a.a < 0 || !inView(a.p || NODES[a.a], 0.25)) {
            const cand = EDGES.filter(([p, q]) => inView(NODES[p], -0.05) && inView(NODES[q], -0.05));
            if (!cand.length) { a.a = -1; return; }
            const e = cand[Math.floor(Math.random() * cand.length)]; a.a = e[0]; a.b = e[1]; a.k = Math.random(); a.dir = 1;
          }
          const A = NODES[a.a], B = NODES[a.b], seg = Math.max(1, meters(A, B));
          a.k += 160 * dt / seg;
          if (a.k >= 1) { const nb = NB[a.b].filter(q => q !== a.a); a.a = a.b; a.b = nb.length ? nb[Math.floor(Math.random() * nb.length)] : a.a; a.k = 0; }
          const A2 = NODES[a.a], B2 = NODES[a.b], dx = (B2.u - A2.u) * L.mw; if (Math.abs(dx) > 0.5) a.dir = Math.sign(dx);
          a.p = { u: A2.u + (B2.u - A2.u) * a.k, v: A2.v + (B2.v - A2.v) * a.k };
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
        // 버스 정류장 표시 (우리집 앞)
        if (g.mode === 'busPick' || (b && b.state !== 'leave')) {
          HOME_STOPS.slice(0, 2).forEach(id2 => { const n = nodeOfStop(id2); if (n == null) return; const p = nodeUV(n); ctx.font = `${Math.round(20 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('🚏', X(p) + 12 * s, Y(p)); });
        }
        // 전철 (지나가는 전철)
        LINES.forEach((rl, ri) => {
          const pts = rl.pts.map(p => [X(p), Y(p)]), seg = [], cum = [0];
          for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); cum.push(cum[i - 1] + d); }
          const total = cum[cum.length - 1], carLen = 26 * s, period = total * 2 + carLen * 6;
          const at = (d) => { d = Math.max(0, Math.min(total, d)); let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const k = (d - cum[i - 1]) / (seg[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k, Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; };
          for (let n = 0; n < 3; n++) {
            let d = (t * 70 * s + ri * total * 0.6 + n * period / 3) % period; const back = d > total + carLen * 3; if (back) d = period - d;
            for (let k = 0; k < 4; k++) { const dd = d - (back ? -1 : 1) * k * (carLen + 2 * s); if (dd < -carLen || dd > total + carLen) continue; const [px, py, an] = at(dd); if (px < -50 || px > W + 50 || py < -50 || py > H + 50) continue; drawTrainCar(ctx, px, py, an, carLen, rl.color); }
          }
        });
        // 장소 + 탈것 + 유나를 아래쪽(v)이 앞으로 오게 그린다
        const draws = [];
        ALL_TOWN_SPOTS.forEach(sp => { if (!inView(sp.a, 0.12)) return; draws.push({ v: sp.a.v, f: () => drawSpot(ctx, sp, X(sp.a), Y(sp.a), 30 * s, t, { sel: g.sel === sp.id, stamp: !!g.save.stamps[sp.id] }) }); });
        g.amb.forEach((a, i) => { if (a.a < 0 || !a.p) return; draws.push({ v: a.p.v, f: () => drawCar(ctx, X(a.p), Y(a.p), 34 * s, a.dir, t, { color: a.col, edge: 'rgba(0,0,0,0.25)', roll: t * 20 + i, bump: Math.abs(Math.sin(t * 9 + i)) * 0.6 * s }) }); });
        draws.push({ v: car.p.v + 0.001, f: () => {
          const moving = !!car.m, hk = car.honkT && t - car.honkT < 0.4 ? Math.sin((t - car.honkT) * 40) * 2 * s : 0;
          drawCar(ctx, X(car.p) + hk, Y(car.p), 86 * s, car.dir, t, { yuna: car.yuna, dad: true, ang: car.ang, roll: car.roll, bump: moving ? Math.abs(Math.sin(t * 14)) * 1.2 * s : 0 });
          if (car.honkT && t - car.honkT < 0.6) { ctx.font = `${Math.round(16 * s)}px ${JUA}`; ctx.fillStyle = '#b45309'; ctx.textAlign = 'center'; ctx.fillText('빵빵!', X(car.p), Y(car.p) - 40 * s - (t - car.honkT) * 30 * s); }
        } });
        if (b) {
          const a = b.pts[b.leg], c2 = b.pts[Math.min(b.leg + 1, b.pts.length - 1)], k = b.state === 'dwell' ? 0 : b.legK;
          const bp = { u: a.u + (c2.u - a.u) * k, v: a.v + (c2.v - a.v) * k };
          draws.push({ v: bp.v + 0.002, f: () => drawBus(ctx, X(bp), Y(bp), 116 * s, b.dir, t, { style: b.style, name: b.route.name, door: b.door, yuna: b.yuna, roll: b.roll, ang: b.state === 'dwell' ? 0 : b.ang, seed: b.seed, alpha: b.alpha, bump: b.state === 'dwell' ? 0 : Math.abs(Math.sin(t * 10)) * s }) });
        }
        if (mt) {
          const gap = 34 * s / (L.mw / meters({ u: 0, v: 0 }, { u: 1, v: 0 }));
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
          shown.forEach(([tl, dx, dy]) => tl.blocks.forEach((bk, i) => { if ((i * 7) % 5 === 0) return; const wx = dx + bk.x + bk.w * 0.18, rows = Math.max(2, Math.floor(bk.h / (bk.w * 0.32))); for (let r = 0; r < rows; r++) if ((i + r) % 3) ctx.fillRect(wx + ((i + r) % 2) * bk.w * 0.42, dy + bk.y - bk.h + bk.h * (0.1 + r * 0.85 / rows), bk.w * 0.22, bk.h * 0.45 / rows); }));
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
  const sel = ui.sel ? SPOT_BY_ID[ui.sel] : null, card = ui.card ? SPOT_BY_ID[ui.card] : null;
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(60,40,20,0.6)', whiteSpace: 'nowrap' });
  const big = (bg, color = '#ffffff') => ({ ...btn(bg, color), minHeight: '96px', minWidth: '150px', borderRadius: '28px', fontSize: '1.45rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '10px 18px' });
  const hint = ui.mode === 'idle' ? '👆 가고 싶은 곳을 콕! 손가락으로 끌면 지도가 움직여요' : ui.mode === 'busPick' ? '🚏 가는 버스를 찾아 콕!' : ui.bell ? (ui.bellOn ? '🔔 다음 정류장에서 내려요!' : '🔔 벨을 눌러요!') : ui.mode === 'move' ? '부릉부릉 가는 중...' : '';
  const overlay = { position: 'absolute', inset: 0, background: 'rgba(30,20,10,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
  const panel = { background: '#fffdf8', borderRadius: '30px', padding: '20px 22px', boxShadow: '0 20px 40px -18px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', maxWidth: '100%' };
  const walkOk = sel && ui.walk;
  const busNote = sel && !ui.bus ? '버스는 안 가요' : '';
  const mapBtn = (bg, color) => ({ ...btn(bg, color), minHeight: '64px', width: '78px', padding: '6px 4px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'normal', lineHeight: 1.1 });
  const chip = (color, bg = 'rgba(255,255,255,0.92)') => ({ background: bg, color, borderRadius: '16px', padding: '5px 12px', fontFamily: JUA, fontSize: '1.05rem', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' });

  return (
    <div ref={rootRef} style={full
      ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#fdf6ec', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }
      : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: full ? '18px' : '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(15,118,110,0.5)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: '12%', right: '12%', top: '6px', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.15rem', color: '#7c2d12', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
        <div style={{ position: 'absolute', right: '10px', top: '52px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={lookYuna} style={mapBtn('#fce7f3', '#be185d')}><span style={{ fontSize: '1.7rem', lineHeight: 1 }}>📍</span>유나 찾기</button>
          <button onClick={goHome} style={mapBtn('#fff7ed', '#9a3412')}><span style={{ fontSize: '1.7rem', lineHeight: 1 }}>🏠</span>집으로</button>
          <button onClick={toggleFull} style={mapBtn(full ? '#334155' : '#ffffff', full ? '#ffffff' : '#0f766e')}><span style={{ fontSize: '1.7rem', lineHeight: 1 }}>{full ? '↙' : '⛶'}</span>{full ? '작게' : '전체화면'}</button>
        </div>
        <div style={{ position: 'absolute', left: '10px', bottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap', pointerEvents: 'none', maxWidth: 'calc(100% - 150px)' }}>
          <span style={chip('#0f766e')}>🚗 우리 동네 {TOWNS[ui.view || 'sanbon'].name}</span>
          <span style={chip('#92400e', '#fef3c7')}>🏅 도장 {ui.stamps}/{ALL_TOWN_SPOTS.length}</span>
        </div>
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
