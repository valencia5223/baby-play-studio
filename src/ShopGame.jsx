// ═════════════════════════════════════════════════════════════════════════════
// 🛒 동물 마을 가게: 동물 손님이 와서 "사과 두 개 주세요!" 하면 선반에서 콕 눌러 바구니에 담아 주고,
//    계산대에서 물건을 하나씩 콕 눌러 "삑!" 찍으면 영수증이 나오고 서랍이 "땡!" 열린다.
//    손님이 놓고 간 동전을 콕 눌러 서랍에 넣는다 (물건 이름 + 1~3 세기를 담기·찍기·동전에서 세 번)
//  - 캔버스 한 장 (왼쪽/위: 가게 카운터와 손님·바구니·계산대, 오른쪽/아래: 물건 상자가 놓인 선반 3×3)
//  - 손님·음식 그림은 요리 놀이(KitchenGame.jsx)의 GUEST_FN·drawWhole 을 빌려 쓰고, 통째 토마토·사과·달걀만 여기서 그린다
//  - 실패는 없다: 다른 물건을 누르면 상자가 흔들리며 "그건 ○○예요" 하고, 찾을 물건 상자가 반짝인다(가만히 있어도 7초 뒤 반짝)
//  - 저장: localStorage bps_shop_v1 (모은 동전 수, shopData.js)
//  - 음성은 남성 아나운서 MP3 (VOICE.shop*, npm run voices)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { KITCHEN_GUESTS, GUEST_BY_ID } from './kitchenData.js';
import { GUEST_FN, drawWhole } from './KitchenGame.jsx';
import { SHOP_GOODS, GOOD_BY_ID, makeOrder, makeStock, PIGGY_FULL, loadShop, saveShop } from './shopData.js';
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const easeIn = (k) => Math.pow(clamp01(k), 2);
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rg = (c, x0, y0, r0, x1, y1, r1, stops) => { const g = c.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.01, r1)); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const shadowOn = (c, blur, oy = 0, col = 'rgba(40,20,5,0.28)') => { c.shadowColor = col; c.shadowBlur = blur; c.shadowOffsetX = 0; c.shadowOffsetY = oy; };
const shadowOff = (c) => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };
function speckle(c, seed, n, x0, y0, x1, y1, r0, r1, cols) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; ell(c, x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), r0 + r() * (r1 - r0), (r0 + r() * (r1 - r0)) * (0.6 + r() * 0.5), r() * 3); c.fill(); }
}
function gloss(c, x, y, rx, ry, a = 0.55, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, ry / rx);
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, rx, [[0, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]);
  c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}
function drawHeart(ctx, x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.4, y - s * 0.9, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 0.9, x + s * 0.9, y - s * 0.3, x, y + s * 0.3); ctx.fill();
}

// ═══════════════ 통째 물건 (요리 놀이에는 썬 모습뿐인 것) ═══════════════
function gdTomato(c, u) {
  const body = () => { c.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * TAU, rr = u * (0.8 + 0.035 * Math.cos(a * 5 + 0.3)), x = Math.cos(a) * rr * 1.06, y = Math.sin(a) * rr * 0.88 + u * 0.06; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
  shadowOn(c, u * 0.14, u * 0.07); body();
  c.fillStyle = rg(c, -u * 0.3, -u * 0.25, u * 0.05, 0, u * 0.06, u * 0.95, [[0, '#ff8a6e'], [0.45, '#ea3a22'], [1, '#a3160a']]); c.fill(); shadowOff(c);
  c.save(); body(); c.clip(); c.strokeStyle = 'rgba(120,10,0,0.16)'; c.lineWidth = u * 0.06;
  [-0.5, 0, 0.5].forEach(q => { c.beginPath(); c.moveTo(q * u * 0.4, -u * 0.62); c.quadraticCurveTo(q * u * 1.7, u * 0.1, q * u * 0.6, u * 0.88); c.stroke(); });
  c.restore();
  gloss(c, -u * 0.38, -u * 0.3, u * 0.26, u * 0.13, 0.75, -0.5);
  gloss(c, u * 0.4, u * 0.35, u * 0.12, u * 0.05, 0.25, -0.8);
  c.save(); c.translate(0, -u * 0.64); c.scale(1, 0.45); c.fillStyle = '#3d8b2c';
  for (let i = 0; i < 6; i++) { c.save(); c.rotate(i / 6 * TAU + 0.2); c.beginPath(); c.moveTo(0, -u * 0.06); c.quadraticCurveTo(u * 0.22, -u * 0.12, u * 0.45, 0); c.quadraticCurveTo(u * 0.22, u * 0.12, 0, u * 0.06); c.fill(); c.restore(); }
  c.restore();
  c.fillStyle = lg(c, -u * 0.04, 0, u * 0.04, 0, [[0, '#2f6b20'], [1, '#4f9a35']]); c.beginPath(); c.roundRect(-u * 0.04, -u * 0.86, u * 0.08, u * 0.24, u * 0.03); c.fill();
}
function gdApple(c, u) {
  shadowOn(c, u * 0.14, u * 0.07);
  c.fillStyle = rg(c, -u * 0.3, -u * 0.3, u * 0.05, 0, 0, u * 0.95, [[0, '#ff7676'], [0.45, '#e11d2e'], [1, '#8f0d18']]);
  c.beginPath(); c.moveTo(0, -u * 0.6);
  c.bezierCurveTo(u * 0.45, -u * 0.88, u * 1.0, -u * 0.55, u * 0.86, u * 0.12); c.bezierCurveTo(u * 0.74, u * 0.74, u * 0.26, u * 0.92, 0, u * 0.74);
  c.bezierCurveTo(-u * 0.26, u * 0.92, -u * 0.74, u * 0.74, -u * 0.86, u * 0.12); c.bezierCurveTo(-u * 1.0, -u * 0.55, -u * 0.45, -u * 0.88, 0, -u * 0.6); c.fill(); shadowOff(c);
  c.save(); c.clip();
  speckle(c, 171, 60, -u * 0.9, -u * 0.7, u * 0.9, u * 0.8, u * 0.008, u * 0.02, ['rgba(255,225,160,0.45)']);
  c.strokeStyle = 'rgba(255,190,120,0.18)'; c.lineWidth = u * 0.05; [-0.4, -0.15, 0.15, 0.45].forEach(q => { c.beginPath(); c.moveTo(q * u * 0.4, -u * 0.55); c.quadraticCurveTo(q * u * 1.5, 0, q * u * 0.8, u * 0.75); c.stroke(); });
  c.restore();
  gloss(c, -u * 0.4, -u * 0.3, u * 0.22, u * 0.12, 0.8, -0.5);
  c.fillStyle = 'rgba(90,20,10,0.35)'; ell(c, 0, -u * 0.56, u * 0.12, u * 0.05); c.fill();
  c.strokeStyle = '#5a3a1a'; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -u * 0.56); c.quadraticCurveTo(u * 0.02, -u * 0.8, u * 0.12, -u * 0.92); c.stroke();
  c.save(); c.translate(u * 0.1, -u * 0.8); c.rotate(-0.45);
  c.fillStyle = lg(c, 0, -u * 0.1, u * 0.45, u * 0.1, [[0, '#7cc243'], [1, '#2f7a1f']]);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(u * 0.22, -u * 0.16, u * 0.48, 0); c.quadraticCurveTo(u * 0.22, u * 0.16, 0, 0); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = u * 0.015; c.beginPath(); c.moveTo(u * 0.03, 0); c.lineTo(u * 0.42, 0); c.stroke();
  c.restore();
}
function gdEgg(c, u) {
  const path = () => { c.beginPath(); c.moveTo(0, -u * 0.9); c.bezierCurveTo(u * 0.48, -u * 0.9, u * 0.7, u * 0.02, u * 0.68, u * 0.3); c.bezierCurveTo(u * 0.66, u * 0.74, u * 0.36, u * 0.9, 0, u * 0.9); c.bezierCurveTo(-u * 0.36, u * 0.9, -u * 0.66, u * 0.74, -u * 0.68, u * 0.3); c.bezierCurveTo(-u * 0.7, u * 0.02, -u * 0.48, -u * 0.9, 0, -u * 0.9); c.closePath(); };
  c.save(); c.rotate(0.12);
  shadowOn(c, u * 0.14, u * 0.07); path();
  c.fillStyle = rg(c, -u * 0.22, -u * 0.32, u * 0.04, 0, u * 0.08, u * 1.0, [[0, '#fdf0e2'], [0.5, '#ecc9a2'], [1, '#b8834f']]); c.fill(); shadowOff(c);
  c.save(); path(); c.clip(); speckle(c, 77, 40, -u * 0.7, -u * 0.9, u * 0.7, u * 0.9, u * 0.01, u * 0.025, ['rgba(140,85,40,0.28)', 'rgba(255,255,255,0.25)']); c.restore();
  gloss(c, -u * 0.25, -u * 0.38, u * 0.18, u * 0.28, 0.7, 0.2);
  c.restore();
}
// 키위: 털 난 통 키위(요리 놀이 그림) + 반으로 자른 초록 단면
function gdKiwi(c, u) {
  drawWhole(c, 'kiwi', -u * 0.22, -u * 0.12, u * 0.78);
  c.save(); c.translate(u * 0.32, u * 0.3); c.rotate(-0.2);
  shadowOn(c, u * 0.12, u * 0.06); c.fillStyle = '#7a5530'; ell(c, 0, 0, u * 0.55, u * 0.47); c.fill(); shadowOff(c);
  c.fillStyle = rg(c, 0, 0, u * 0.05, 0, 0, u * 0.5, [[0, '#f4f8d8'], [0.25, '#b9dc4c'], [0.8, '#6fb52c'], [1, '#5a9a22']]); ell(c, 0, 0, u * 0.5, u * 0.42); c.fill();
  c.fillStyle = '#fbfde9'; ell(c, 0, 0, u * 0.13, u * 0.1); c.fill();
  c.fillStyle = '#1f1a12'; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ell(c, Math.cos(a) * u * 0.2, Math.sin(a) * u * 0.165, u * 0.028, u * 0.016, a); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = u * 0.012; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * u * 0.14, Math.sin(a) * u * 0.11); c.lineTo(Math.cos(a) * u * 0.44, Math.sin(a) * u * 0.37); c.stroke(); }
  gloss(c, -u * 0.18, -u * 0.15, u * 0.15, u * 0.07, 0.5, -0.3);
  c.restore();
}
const OWN_FN = { tomato: gdTomato, apple: gdApple, egg: gdEgg, kiwi: gdKiwi };
const ownCache = new Map();
function drawGood(ctx, id, x, y, r, rot = 0, alpha = 1) {
  if (!OWN_FN[id]) {
    if (!rot && alpha === 1) { drawWhole(ctx, id, x, y, r); return; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= alpha; drawWhole(ctx, id, 0, 0, r); ctx.restore(); return;
  }
  const ref = 110; let cv = ownCache.get(id);
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(ref * 2.4); const c = cv.getContext('2d'); c.translate(cv.width / 2, cv.height / 2); OWN_FN[id](c, ref); ownCache.set(id, cv); }
  const sc = r / ref;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(cv, -cv.width / 2 * sc, -cv.height / 2 * sc, cv.width * sc, cv.height * sc); ctx.restore();
}

// ═══════════════ 배치 ═══════════════
function layout(W, H) {
  const land = W >= H * 1.1;
  if (land) {
    const split = W * 0.4, S = Math.min(W * 0.17, H * 0.36), counterY = H * 0.6, d = H * 0.09;
    return { land, split, W, H, S, gx: split * 0.21, counterY, gy: counterY + S * 0.1, d,
      bx: split * 0.47, br: Math.min(split * 0.14, H * 0.1), px: split * 0.8, pr: Math.min(split * 0.18, H * 0.14),
      front: [0, 0, split, H], shelf: { x0: split + W * 0.015, x1: W * 0.985, y0: H * 0.12, y1: H * 0.985 } };
  }
  const split = H * 0.43, S = Math.min(W * 0.26, H * 0.18), counterY = split * 0.64, d = split * 0.13;
  return { land, split, W, H, S, gx: W * 0.2, counterY, gy: counterY + S * 0.1, d,
    bx: W * 0.45, br: Math.min(W * 0.1, split * 0.15), px: W * 0.79, pr: Math.min(W * 0.16, split * 0.24),
    front: [0, 0, W, split], shelf: { x0: W * 0.03, x1: W * 0.97, y0: split + H * 0.07, y1: H * 0.985 } };
}
function shelfCells(L, stock) {
  const s = L.shelf, cw = (s.x1 - s.x0) / 3, ch = (s.y1 - s.y0) / 3;
  return stock.map((id, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const w = Math.min(cw * 0.84, ch * 1.3), h = Math.min(ch * 0.78, w * 0.8);
    return { id, i, x: s.x0 + cw * (col + 0.5), base: s.y0 + ch * (row + 1) - ch * 0.09, w, h };
  });
}
// 바구니 안 물건 자리 (왼쪽 → 오른쪽 → 가운데 위)
const BASKET_SLOT = [[-0.42, -0.36], [0.42, -0.36], [0, -0.55]];

let bgCache = null;
function drawBackground(ctx, W, H, L) {
  const key = `${W}x${H}`;
  if (!bgCache || bgCache.key !== key) {
    const cv = document.createElement('canvas'); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const [fx, fy, fw, fh] = L.front, r = rng(7);
    // ── 가게 앞쪽 벽 (줄무늬 벽지)
    c.fillStyle = lg(c, 0, 0, 0, fh, [[0, '#fff7ea'], [1, '#f6e3c6']]); c.fillRect(fx, fy, fw, fh);
    for (let x = fx; x < fx + fw; x += 26) { c.fillStyle = 'rgba(214,170,120,0.12)'; c.fillRect(x, fy, 11, fh); }
    // 창문 (밖에 하늘·언덕)
    const wx = fx + fw * 0.08, ww = fw * 0.84, wy = fy + fh * (L.land ? 0.15 : 0.15), wh = (L.counterY - wy) * (L.land ? 0.55 : 0.62);
    c.fillStyle = lg(c, 0, wy, 0, wy + wh, [[0, '#9fd6ff'], [1, '#e2f4ff']]); c.fillRect(wx, wy, ww, wh);
    c.fillStyle = '#ffffff'; [[0.22, 0.3], [0.68, 0.22]].forEach(([a, b]) => { [[0, 0, 0.09], [0.07, -0.05, 0.07], [0.13, 0, 0.06]].forEach(([dx, dy, rr]) => { ell(c, wx + ww * (a + dx), wy + wh * (b + dy), ww * rr, wh * 0.11); c.fill(); }); });
    c.fillStyle = lg(c, 0, wy + wh * 0.6, 0, wy + wh, [[0, '#9ad66b'], [1, '#5fae3c']]);
    c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx, wy + wh * 0.72); c.quadraticCurveTo(wx + ww * 0.3, wy + wh * 0.5, wx + ww * 0.6, wy + wh * 0.7); c.quadraticCurveTo(wx + ww * 0.85, wy + wh * 0.6, wx + ww, wy + wh * 0.68); c.lineTo(wx + ww, wy + wh); c.fill();
    for (let i = 0; i < 9; i++) { c.fillStyle = ['#f472b6', '#fde047', '#ffffff'][i % 3]; ell(c, wx + ww * (0.05 + r() * 0.9), wy + wh * (0.8 + r() * 0.15), 3, 3); c.fill(); }
    c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.strokeRect(wx, wy, ww, wh); c.lineWidth = 4; c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
    c.strokeStyle = 'rgba(150,110,70,0.35)'; c.lineWidth = 1.5; c.strokeRect(wx - 3.5, wy - 3.5, ww + 7, wh + 7);
    // 줄무늬 차양 (빨강·크림, 아래는 물결)
    const ay = fy, ah = fh * (L.land ? 0.1 : 0.12), stripe = fw / 9;
    for (let i = 0; i < 9; i++) {
      c.fillStyle = i % 2 ? '#fff6e6' : '#ef4444';
      c.beginPath(); c.moveTo(fx + i * stripe, ay); c.lineTo(fx + (i + 1) * stripe, ay); c.lineTo(fx + (i + 1) * stripe, ay + ah);
      c.arc(fx + (i + 0.5) * stripe, ay + ah, stripe / 2, 0, Math.PI); c.closePath(); c.fill();
    }
    c.fillStyle = lg(c, 0, ay, 0, ay + ah * 1.4, [[0, 'rgba(0,0,0,0.12)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(fx, ay, fw, ah);
    c.fillStyle = 'rgba(80,40,10,0.12)'; c.fillRect(fx, ay + ah + stripe / 2, fw, 5);
    // 카운터: 윗면(나무) + 앞판(민트색 칠)
    const cy0 = L.counterY, d = L.d;
    c.fillStyle = lg(c, 0, cy0, 0, cy0 + d, [[0, '#e9c48e'], [1, '#d4a265']]); c.fillRect(fx, cy0, fw, d);
    c.lineWidth = 1.2; for (let i = 0; i < 10; i++) { const y = cy0 + 3 + r() * (d - 6); c.strokeStyle = `rgba(120,70,25,${0.08 + r() * 0.12})`; c.beginPath(); c.moveTo(fx, y); c.bezierCurveTo(fx + fw * 0.3, y + (r() - 0.5) * 5, fx + fw * 0.7, y + (r() - 0.5) * 5, fx + fw, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(fx, cy0, fw, 2);
    c.fillStyle = lg(c, 0, cy0 + d, 0, cy0 + d + 10, [[0, '#a8743e'], [1, '#8a5a2c']]); c.fillRect(fx, cy0 + d, fw, 10);
    const pTop = cy0 + d + 10, pH = fy + fh - pTop;
    if (pH > 0) {
      c.fillStyle = lg(c, 0, pTop, 0, fy + fh, [[0, '#8fd3b6'], [1, '#5fae92']]); c.fillRect(fx, pTop, fw, pH);
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(fx, pTop, fw, 6);
      const pw = fw / 6; for (let i = 1; i < 6; i++) { c.fillStyle = 'rgba(30,90,70,0.25)'; c.fillRect(fx + i * pw - 1, pTop, 2, pH); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(fx + i * pw + 1, pTop, 2, pH); }
    }
    // ── 선반 쪽 벽 (세로 나무판)
    const sx = L.land ? L.split : 0, sy = L.land ? 0 : L.split;
    c.fillStyle = lg(c, sx, sy, sx, H, [[0, '#f6e7cc'], [1, '#e9d2ab']]); c.fillRect(sx, sy, W - sx, H - sy);
    for (let x = sx; x < W; x += 54) { c.fillStyle = 'rgba(150,100,50,0.16)'; c.fillRect(x, sy, 2, H - sy); for (let i = 0; i < 3; i++) { const xx = x + 8 + r() * 38; c.strokeStyle = `rgba(160,110,60,${0.06 + r() * 0.08})`; c.lineWidth = 1; c.beginPath(); c.moveTo(xx, sy); c.bezierCurveTo(xx + (r() - 0.5) * 8, sy + (H - sy) * 0.3, xx + (r() - 0.5) * 8, sy + (H - sy) * 0.7, xx, H); c.stroke(); } }
    // 선반 기둥·판
    const s = L.shelf, ch = (s.y1 - s.y0) / 3, post = Math.max(10, (s.x1 - s.x0) * 0.018);
    [s.x0 - post, s.x1].forEach(x => { c.fillStyle = lg(c, x, 0, x + post, 0, [[0, '#8a5530'], [0.5, '#b07a48'], [1, '#7a4824']]); c.fillRect(x, s.y0 - ch * 0.05, post, s.y1 - s.y0 + ch * 0.05); });
    for (let row = 0; row < 3; row++) {
      const by = s.y0 + ch * (row + 1) - ch * 0.09, th = ch * 0.08;
      c.fillStyle = 'rgba(70,40,15,0.22)'; c.fillRect(s.x0, by + th, s.x1 - s.x0, th * 0.9);
      c.fillStyle = lg(c, 0, by, 0, by + th, [[0, '#d39a62'], [0.3, '#b97c45'], [1, '#8a5530']]); c.fillRect(s.x0 - post, by, s.x1 - s.x0 + post * 2, th);
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(s.x0 - post, by, s.x1 - s.x0 + post * 2, 2);
    }
    // 경계 그림자
    if (L.land) { c.fillStyle = lg(c, sx, 0, sx + 18, 0, [[0, 'rgba(60,30,10,0.28)'], [1, 'rgba(60,30,10,0)']]); c.fillRect(sx, 0, 18, H); }
    else { c.fillStyle = lg(c, 0, sy, 0, sy + 18, [[0, 'rgba(60,30,10,0.28)'], [1, 'rgba(60,30,10,0)']]); c.fillRect(0, sy, W, 18); }
    bgCache = { key, cv };
  }
  ctx.drawImage(bgCache.cv, 0, 0, W, H);
}

// 나무 상자 + 물건 3개 + 이름표
function drawCrate(ctx, cell, t, glow, shakeK, pressK) {
  const { x, base, w, h, id } = cell;
  const sx = shakeK > 0 ? Math.sin(shakeK * 38) * w * 0.05 * shakeK : 0;
  const sc = 1 - pressK * 0.06;
  ctx.save(); ctx.translate(x + sx, base); ctx.scale(sc, sc);
  if (glow > 0) {
    ctx.save(); shadowOn(ctx, w * 0.25, 0, `rgba(250,204,21,${0.9 * glow})`);
    ctx.fillStyle = `rgba(254,240,138,${0.75 * glow})`; ctx.beginPath(); ctx.roundRect(-w * 0.56, -h * 1.12, w * 1.12, h * 1.16, w * 0.1); ctx.fill(); ctx.restore();
  }
  // 상자 안쪽
  shadowOn(ctx, w * 0.06, w * 0.03, 'rgba(60,30,10,0.35)');
  ctx.fillStyle = lg(ctx, 0, -h, 0, 0, [[0, '#9c6a3c'], [1, '#6b4220']]); ctx.beginPath(); ctx.roundRect(-w / 2, -h * 0.82, w, h * 0.82, w * 0.04); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = 'rgba(40,20,5,0.35)'; ctx.fillRect(-w * 0.46, -h * 0.78, w * 0.92, h * 0.1);
  // 물건 (뒤 가운데 → 앞 양옆)
  const r = Math.min(w * 0.2, h * 0.34);
  const tall = id === 'milk' || id === 'corn' || id === 'carrot';
  [[0, -0.66, 0.15], [-0.25, -0.5, -0.25], [0.25, -0.5, 0.3]].forEach(([dx, dy, rot], i) => drawGood(ctx, id, dx * w, dy * h - (tall ? h * 0.05 : 0), r * (i ? 1 : 0.95), tall ? rot * 0.5 : rot));
  // 앞판
  const fh = h * 0.42;
  ctx.fillStyle = lg(ctx, 0, -fh, 0, 0, [[0, '#e2ad70'], [1, '#b47d44']]); ctx.beginPath(); ctx.roundRect(-w / 2, -fh, w, fh, w * 0.04); ctx.fill();
  ctx.strokeStyle = 'rgba(110,60,20,0.45)'; ctx.lineWidth = Math.max(1, w * 0.008); ctx.beginPath(); ctx.moveTo(-w / 2, -fh * 0.5); ctx.lineTo(w / 2, -fh * 0.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-w / 2 + 2, -fh + 1, w - 4, 2);
  ctx.fillStyle = '#6b4220'; [-1, 1].forEach(k => [-0.75, -0.25].forEach(q => { ell(ctx, k * w * 0.45, q * fh, w * 0.012, w * 0.012); ctx.fill(); }));
  // 이름표
  const lw = Math.min(w * 0.64, fh * 2.6), lh = fh * 0.66;
  ctx.fillStyle = '#fffdf5'; shadowOn(ctx, 4, 1, 'rgba(0,0,0,0.2)'); ctx.beginPath(); ctx.roundRect(-lw / 2, -fh * 0.83, lw, lh, lh * 0.25); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = '#5b3a1a'; ctx.font = `${Math.round(lh * 0.66)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(GOOD_BY_ID[id].name, 0, -fh * 0.83 + lh * 0.54);
  ctx.restore();
}

// 카운터 앞판 간판 (글꼴이 늦게 불러와져도 맞게 매 프레임 그린다)
function drawSign(ctx, L, t) {
  const [fx, fy, fw, fh] = L.front, top = L.counterY + L.d + 10, ph = fy + fh - top;
  if (ph < 40) return;
  const h = Math.min(ph * 0.55, fw * 0.16), w = Math.min(fw * 0.82, h * 5.2), x = fx + fw / 2, y = top + ph * 0.5;
  ctx.save();
  shadowOn(ctx, 10, 4, 'rgba(30,60,40,0.35)');
  ctx.fillStyle = lg(ctx, 0, y - h / 2, 0, y + h / 2, [[0, '#fffaf0'], [1, '#f3e3c4']]); ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.3); ctx.fill(); shadowOff(ctx);
  ctx.strokeStyle = '#c98a46'; ctx.lineWidth = Math.max(3, h * 0.06); ctx.stroke();
  ctx.fillStyle = '#b45309'; ctx.font = `${Math.round(h * 0.42)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('동물 마을 가게', x, y + h * 0.04);
  const ir = h * 0.26;
  drawGood(ctx, 'apple', x - w / 2 + h * 0.45, y + Math.sin(t * 2) * h * 0.04, ir);
  drawGood(ctx, 'carrot', x + w / 2 - h * 0.45, y + Math.sin(t * 2 + 1) * h * 0.04, ir);
  ctx.restore();
}

// 바구니: 손잡이·안쪽(뒤) → 물건 → 앞면(앞)
function basketBack(ctx, x, y, r) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a5528'; ctx.lineWidth = r * 0.13; ctx.beginPath(); ctx.ellipse(x, y - r * 0.3, r * 0.78, r * 0.95, 0, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#c98a46'; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.ellipse(x, y - r * 0.3, r * 0.78, r * 0.95, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = rg(ctx, x, y - r * 0.3, 0, x, y - r * 0.3, r, [[0, '#4a2a10'], [1, '#7a4a22']]); ell(ctx, x, y - r * 0.3, r, r * 0.26); ctx.fill();
  ctx.restore();
}
function basketFront(ctx, x, y, r) {
  const top = y - r * 0.3, bot = y + r * 0.55;
  ctx.save(); shadowOn(ctx, r * 0.15, r * 0.06);
  ctx.beginPath(); ctx.moveTo(x - r, top); ctx.lineTo(x - r * 0.8, bot - r * 0.08); ctx.quadraticCurveTo(x, bot + r * 0.12, x + r * 0.8, bot - r * 0.08); ctx.lineTo(x + r, top); ctx.ellipse(x, top, r, r * 0.26, 0, 0, Math.PI); ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, top, 0, bot, [[0, '#e3ac62'], [1, '#a5682f']]); ctx.fill(); shadowOff(ctx);
  ctx.clip();
  // 엮은 무늬
  const rows = 5, rh = (bot - top + r * 0.2) / rows, cw = r * 0.26;
  for (let i = 0; i < rows; i++) for (let k = -5; k <= 5; k++) {
    const cx = x + k * cw + (i % 2) * cw / 2, cy = top + r * 0.1 + i * rh;
    ctx.fillStyle = (k + i) % 2 ? 'rgba(255,225,170,0.35)' : 'rgba(110,60,20,0.22)';
    ell(ctx, cx, cy, cw * 0.48, rh * 0.42); ctx.fill();
  }
  ctx.fillStyle = lg(ctx, x - r, 0, x + r, 0, [[0, 'rgba(60,30,10,0.3)'], [0.35, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(60,30,10,0.3)']]); ctx.fillRect(x - r, top, r * 2, bot - top + r * 0.2);
  ctx.restore();
  // 테두리
  ctx.save(); ctx.strokeStyle = '#b8783a'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.ellipse(x, top, r, r * 0.26, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,180,0.6)'; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.ellipse(x, top - r * 0.02, r * 0.97, r * 0.24, 0, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}
function drawBasket(ctx, x, y, r, items, hide = -1) {
  basketBack(ctx, x, y, r);
  items.forEach((id, i) => { if (i === hide) return; const [dx, dy] = BASKET_SLOT[i]; drawGood(ctx, id, x + dx * r, y + dy * r, r * 0.4, dx * 0.4); });
  basketFront(ctx, x, y, r);
}

// 동전 (카운터 위에 비스듬히 누운 모습 / 날아갈 땐 세운 모습)
function drawCoin(ctx, x, y, r, flat = 0.55, spin = 0) {
  const ry = r * flat, sx = Math.max(0.15, Math.abs(Math.cos(spin)));
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  shadowOn(ctx, r * 0.3, r * 0.15, 'rgba(80,50,0,0.35)');
  ctx.fillStyle = '#b77d0a'; ell(ctx, 0, r * 0.12 * flat, r, ry); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = rg(ctx, -r * 0.3, -ry * 0.4, 0, 0, 0, r, [[0, '#fff3b0'], [0.45, '#fbcd34'], [1, '#d99a0b']]); ell(ctx, 0, 0, r, ry); ctx.fill();
  ctx.strokeStyle = 'rgba(160,100,0,0.55)'; ctx.lineWidth = r * 0.07; ell(ctx, 0, 0, r * 0.76, ry * 0.76); ctx.stroke();
  ctx.save(); ctx.scale(1, flat); ctx.fillStyle = 'rgba(190,120,0,0.6)'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * 0.2 : r * 0.46; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
  gloss(ctx, -r * 0.35, -ry * 0.35, r * 0.35, ry * 0.25, 0.7, -0.3);
  ctx.restore();
}

// 계산대 (앞모습): 몸통 윗면 왼쪽에 스캐너 유리, 오른쪽에 버튼, 기둥 위 화면, 뒤에서 올라오는 영수증, 앞쪽 돈 서랍
//  base = 카운터에 닿는 아래쪽 y, R = 반폭. o = { flash 0~1, drawer 0~1, receipt 0~1, screen 글자, hop 0~1, coinsIn }
const regScanPos = (x, base, R) => [x - R * 0.45, base - R * 0.72];
const regDrawerPos = (x, base, R, k) => [x, base - R * 0.3 + k * R * 0.1];
function drawRegister(ctx, x, base, R, t, o) {
  ctx.save(); ctx.translate(x, base - (o.hop || 0) * R * 0.12);
  ctx.fillStyle = 'rgba(60,30,10,0.22)'; ell(ctx, 0, R * 0.02, R * 1.05, R * 0.1); ctx.fill();
  // 영수증 (뒤 왼쪽 틈에서 위로)
  if (o.receipt > 0) {
    const rh = o.receipt * R * 0.85, rw = R * 0.34, rx = -R * 0.72;
    ctx.save(); shadowOn(ctx, 4, 1, 'rgba(0,0,0,0.15)'); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(rx, -R * 0.8); ctx.lineTo(rx, -R * 0.8 - rh);
    for (let i = 0; i <= 6; i++) ctx.lineTo(rx + rw * i / 6, -R * 0.8 - rh + (i % 2 ? R * 0.03 : 0));
    ctx.lineTo(rx + rw, -R * 0.8); ctx.closePath(); ctx.fill(); shadowOff(ctx);
    ctx.fillStyle = 'rgba(100,100,110,0.55)';
    for (let i = 0; i < 6; i++) { const ly = -R * 0.8 - rh + R * 0.1 + i * R * 0.11; if (ly > -R * 0.86) break; ctx.fillRect(rx + rw * 0.15, ly, rw * (i % 3 === 2 ? 0.4 : 0.7), R * 0.025); }
    ctx.restore();
  }
  // 화면 기둥 + 화면
  ctx.fillStyle = lg(ctx, R * 0.4, 0, R * 0.52, 0, [[0, '#6b7280'], [1, '#9ca3af']]); ctx.fillRect(R * 0.42, -R * 1.25, R * 0.1, R * 0.5);
  shadowOn(ctx, R * 0.08, R * 0.03);
  ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.roundRect(R * 0.0, -R * 1.66, R * 0.95, R * 0.48, R * 0.08); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = lg(ctx, 0, -R * 1.6, 0, -R * 1.24, [[0, '#d9fbe5'], [1, '#a7f3c5']]); ctx.beginPath(); ctx.roundRect(R * 0.06, -R * 1.6, R * 0.83, R * 0.36, R * 0.05); ctx.fill();
  ctx.fillStyle = '#14532d'; ctx.font = `${Math.round(R * 0.24)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.screen || '', R * 0.475, -R * 1.41);
  // 몸통 앞면
  shadowOn(ctx, R * 0.12, R * 0.05);
  ctx.fillStyle = lg(ctx, 0, -R * 0.66, 0, 0, [[0, '#fbf7ef'], [1, '#d8cfbf']]);
  ctx.beginPath(); ctx.moveTo(-R * 0.9, -R * 0.64); ctx.lineTo(R * 0.9, -R * 0.64); ctx.lineTo(R, 0); ctx.lineTo(-R, 0); ctx.closePath(); ctx.fill(); shadowOff(ctx);
  // 윗면
  ctx.fillStyle = lg(ctx, 0, -R * 0.82, 0, -R * 0.64, [[0, '#ffffff'], [1, '#ece5d8']]);
  ctx.beginPath(); ctx.moveTo(-R * 0.82, -R * 0.82); ctx.lineTo(R * 0.82, -R * 0.82); ctx.lineTo(R * 0.9, -R * 0.64); ctx.lineTo(-R * 0.9, -R * 0.64); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4b5563'; ctx.fillRect(-R * 0.74, -R * 0.815, R * 0.38, R * 0.025);   // 영수증 틈
  // 스캐너 유리 + 빨간 빛
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.moveTo(-R * 0.74, -R * 0.77); ctx.lineTo(-R * 0.1, -R * 0.77); ctx.lineTo(-R * 0.08, -R * 0.67); ctx.lineTo(-R * 0.8, -R * 0.67); ctx.closePath(); ctx.fill();
  const fl = o.flash || 0, pulse = 0.5 + 0.5 * Math.sin(t * 8);
  ctx.strokeStyle = `rgba(255,${Math.round(40 + 120 * fl)},${Math.round(40 + 120 * fl)},${0.55 + 0.25 * pulse + 0.2 * fl})`; ctx.lineWidth = R * (0.025 + 0.03 * fl);
  ctx.beginPath(); ctx.moveTo(-R * 0.74, -R * 0.72); ctx.lineTo(-R * 0.12, -R * 0.72); ctx.stroke();
  if (fl > 0) { ctx.save(); ctx.globalAlpha = fl * 0.6; ctx.fillStyle = rg(ctx, -R * 0.45, -R * 0.75, 0, -R * 0.45, -R * 0.75, R * 0.7, [[0, 'rgba(255,60,60,0.9)'], [1, 'rgba(255,60,60,0)']]); ell(ctx, -R * 0.45, -R * 0.75, R * 0.7, R * 0.45); ctx.fill(); ctx.restore(); }
  // 버튼
  const cols = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
  for (let i = 0; i < 6; i++) { const bx = R * (0.06 + (i % 3) * 0.25), by = -R * (0.795 - Math.floor(i / 3) * 0.075); ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.roundRect(bx, by, R * 0.2, R * 0.055, R * 0.02); ctx.fill(); }
  // 앞면 장식 줄
  ctx.fillStyle = '#ef4444'; ctx.fillRect(-R * 0.91, -R * 0.52, R * 1.82, R * 0.05);
  // 돈 서랍 (열리면 앞으로 나오며 칸과 동전이 보인다)
  const k = o.drawer || 0, dy = k * R * 0.22, ds = 1 + k * 0.08;
  ctx.fillStyle = 'rgba(40,30,20,0.55)'; ctx.fillRect(-R * 0.82, -R * 0.38, R * 1.64, R * 0.32);
  ctx.save(); ctx.translate(0, dy); ctx.scale(ds, ds);
  if (k > 0.05) {
    const th = k * R * 0.26;
    ctx.fillStyle = lg(ctx, 0, -R * 0.36 - th, 0, -R * 0.36, [[0, '#374151'], [1, '#6b7280']]);
    ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.36); ctx.lineTo(-R * 0.74, -R * 0.36 - th); ctx.lineTo(R * 0.74, -R * 0.36 - th); ctx.lineTo(R * 0.8, -R * 0.36); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = R * 0.02;
    for (let i = 1; i < 4; i++) { const xx = -R * 0.8 + i * R * 0.4; ctx.beginPath(); ctx.moveTo(xx, -R * 0.36); ctx.lineTo(xx * 0.93, -R * 0.36 - th); ctx.stroke(); }
    const nc = Math.min(o.coinsIn || 0, 8);
    for (let i = 0; i < nc; i++) { const cx = -R * 0.6 + (i % 4) * R * 0.4, cy = -R * 0.36 - th * 0.45 - Math.floor(i / 4) * R * 0.04; ctx.fillStyle = '#b77d0a'; ell(ctx, cx, cy + R * 0.015, R * 0.13, R * 0.05); ctx.fill(); ctx.fillStyle = '#fbcd34'; ell(ctx, cx, cy, R * 0.13, R * 0.05); ctx.fill(); }
  }
  ctx.fillStyle = lg(ctx, 0, -R * 0.36, 0, -R * 0.06, [[0, '#ece6da'], [1, '#bfb5a2']]); ctx.beginPath(); ctx.roundRect(-R * 0.8, -R * 0.36, R * 1.6, R * 0.3, R * 0.04); ctx.fill();
  ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.roundRect(-R * 0.18, -R * 0.24, R * 0.36, R * 0.06, R * 0.03); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ─────────────────────────────── 화면 ───────────────────────────────
const makeGame = () => ({ stock: SHOP_GOODS.slice(0, 9).map(g => g.id), stockT: -9, order: shuffle(KITCHEN_GUESTS.map(g => g.id)), gi: 0, phase: 'arrive', phaseT: 0, t: 0, want: null, lastItem: null, served: 0,
  basket: [], fly: [], coinsOut: [], parts: [], coins: loadShop().coins, help: false, helpSaid: false, lastAct: 0, lastWrongSay: -9, shake: null, press: null,
  regT: -9, scanned: 0, scanFly: null, beepT: -9, receiptT: null, drawerOpen: false, drawerT: -9, coinsIn: 0, bkPos: null, happyUntil: 0, mouthUntil: 0, L: null, cells: [], timers: [] });

export default function ShopGame({ audio, speak }) {
  const canvasRef = useRef(null);
  const G = useRef(null);
  const [ui, setUi] = useState({ phase: 'arrive', guest: KITCHEN_GUESTS[0].id, item: null, n: 0, got: 0, coins: 0, land: true });
  const sync = () => { const g = G.current; setUi({ phase: g.phase, guest: g.order[g.gi], item: g.want ? g.want.item : null, n: g.want ? g.want.n : 0, got: g.basket.length, coins: g.coins, stock: g.stock.join(','), land: g.L ? g.L.land : true }); };
  const later = (fn, ms) => { const g = G.current; const id = setTimeout(() => { g.timers = g.timers.filter(x => x !== id); fn(); }, ms); g.timers.push(id); };
  const say = (text) => { if (speak && text) speak(text); };
  const guest = () => GUEST_BY_ID[G.current.order[G.current.gi]];
  const talk = (sec) => { const g = G.current; g.mouthUntil = g.t + sec; };

  // ── 흐름: 손님 옴 → 주문 → 바구니에 담기 → 동전 받기 → 손님 감 ──
  const sayOrder = () => { const g = G.current; if (!g.want) return; say(VOICE.shopOrder(GOOD_BY_ID[g.want.item], g.want.n)); talk(1.8); };
  const arrive = () => {
    const g = G.current;
    g.phase = 'arrive'; g.phaseT = g.t; g.basket = []; g.fly = []; g.coinsOut = []; g.help = false; g.helpSaid = false; g.shake = null; g.happyUntil = 0;
    g.scanned = 0; g.scanFly = null; g.receiptT = null; if (g.drawerOpen) { g.drawerOpen = false; g.drawerT = g.t; } g.coinsIn = 0;
    g.want = makeOrder(guest().id, g.served, g.lastItem); g.lastItem = g.want.item;
    g.stock = makeStock(g.want.item); g.stockT = g.t;   // 손님마다 선반 물건·자리가 바뀐다
    audio.playXylophone(1318.5, 0.5); setTimeout(() => audio.playXylophone(1046.5, 0.5), 160);
    later(() => { if (g.phase !== 'arrive') return; g.phase = 'shop'; g.lastAct = g.t; sayOrder(); sync(); }, 950);
    sync();
  };
  const nextGuest = () => { const g = G.current; g.timers.forEach(clearTimeout); g.timers = []; g.gi = (g.gi + 1) % g.order.length; if (g.gi === 0) g.order = shuffle(g.order); arrive(); };
  useEffect(() => { G.current = makeGame(); arrive(); return () => { G.current.timers.forEach(clearTimeout); G.current.timers = []; }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const sparkle = (x, y, n) => { const g = G.current; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; g.parts.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, born: g.t, life: 0.6 }); } };
  const hearts = (x, y, n) => { const g = G.current; for (let i = 0; i < n; i++) g.parts.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 80, y, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, born: g.t + i * 0.1, life: 2.2 }); };

  const pick = (cell) => {
    const g = G.current, want = g.want;
    g.lastAct = g.t;
    if (cell.id !== want.item) {
      g.shake = { id: cell.id, t0: g.t }; g.help = true;
      audio.playFreq(260, 'triangle', 0.14, 0.35);
      if (g.t - g.lastWrongSay > 1.8) { g.lastWrongSay = g.t; say(VOICE.shopWrong(GOOD_BY_ID[cell.id], GOOD_BY_ID[want.item])); talk(2.2); }
      return;
    }
    const slot = g.basket.length + g.fly.length;
    if (slot >= want.n) return;
    audio.playPopSound();
    g.press = { id: cell.id, t0: g.t };
    g.fly.push({ id: cell.id, x0: cell.x, y0: cell.base - cell.h * 0.6, slot, t0: g.t, dur: 0.6 });
  };
  const landItem = (f) => {
    const g = G.current, L = g.L;
    g.basket.push(f.id);
    const k = g.basket.length;
    audio.playXylophone([523.25, 659.25, 783.99][k - 1] || 1046.5, 0.6);
    say(VOICE.shopCount(k));
    sparkle(L.bx, L.counterY - L.br * 0.5, 8);
    sync();
    if (k >= g.want.n) later(startScan, 750);
  };
  // 계산대: 바구니 물건을 하나씩 눌러 삑 → 다 찍으면 영수증 → 서랍 땡 → 동전
  const startScan = () => {
    const g = G.current; if (g.phase !== 'shop') return;
    g.phase = 'scan'; g.phaseT = g.t; g.scanned = 0; g.help = false; g.lastAct = g.t;
    say(g.served < 3 ? VOICE.shopScan() : VOICE.shopScanShort()); talk(g.served < 3 ? 2.6 : 1.2);
    sync();
  };
  const scanOne = () => {
    const g = G.current;
    if (g.phase !== 'scan' || g.scanFly || g.scanned >= g.want.n) return;
    g.lastAct = g.t;
    g.scanFly = { idx: g.basket.length - 1 - g.scanned, t0: g.t, beeped: false };
    audio.playPopSound();
  };
  const beep = () => {
    const g = G.current, L = g.L;
    g.scanned += 1; g.beepT = g.t;
    audio.playFreq(1760, 'square', 0.11, 0.18);
    say(VOICE.shopCount(g.scanned));
    const [sx, sy] = regScanPos(L.px, L.counterY + L.d * 0.55, L.pr); sparkle(sx, sy, 5);
    sync();
  };
  const checkout = () => {
    const g = G.current; if (g.phase !== 'scan') return;
    g.receiptT = g.t;
    audio.playNoise(0.8, 0.12, 3500, 2);
    later(() => {
      g.drawerOpen = true; g.drawerT = g.t;
      audio.playXylophone(2093, 0.6); setTimeout(() => audio.playXylophone(2637, 0.5), 90);
      audio.playNoise(0.12, 0.25, 900);
      later(startPay, 450);
    }, 950);
  };
  const startPay = () => {
    const g = G.current; if (g.phase !== 'scan') return;
    g.phase = 'pay'; g.phaseT = g.t; g.happyUntil = g.t + 1.6; g.help = false;
    audio.playYum(); hearts(g.L.gx, g.L.gy - g.L.S * 1.0, 5);
    say(g.served < 3 ? VOICE.shopPay() : VOICE.shopPayShort()); talk(g.served < 3 ? 3.2 : 1.6);
    g.coinsOut = Array.from({ length: g.want.n }, (_, i) => ({ i, state: 'drop', t0: g.t + 0.6 + i * 0.3 }));
    sync();
  };
  const takeCoin = (coin) => {
    const g = G.current; g.lastAct = g.t;
    coin.state = 'fly'; coin.t1 = g.t;
    audio.playFreq(1400, 'sine', 0.06, 0.3);
  };
  const coinIn = (coin) => {
    const g = G.current, L = g.L;
    coin.state = 'done';
    g.coins += 1; saveShop({ version: 1, coins: g.coins });
    g.regT = g.t; g.coinsIn += 1;
    audio.playXylophone(1567.98, 0.55); setTimeout(() => audio.playXylophone(2093, 0.45), 70);
    const got = g.coinsOut.filter(c => c.state === 'done').length;
    say(VOICE.shopCount(got));
    { const [dx, dy] = regDrawerPos(L.px, L.counterY + L.d * 0.55, L.pr, 1); sparkle(dx, dy, 6); }
    sync();
    if (got >= g.coinsOut.length) finishOrder();
  };
  const finishOrder = () => {
    const g = G.current; g.served += 1;
    const full = g.coins % PIGGY_FULL === 0;
    let wait = 1000;
    later(() => { g.drawerOpen = false; g.drawerT = g.t; audio.playFreq(330, 'triangle', 0.1, 0.4); audio.playNoise(0.1, 0.25, 700); }, 450);
    if (full) {
      wait = 3800;
      later(() => { audio.playFanfare(); say(VOICE.shopPiggy()); g.regT = g.t; const L = g.L; hearts(L.px, L.counterY - L.pr, 10); sparkle(L.px, L.counterY - L.pr, 16); }, 900);
    }
    later(() => {
      g.phase = 'leave'; g.phaseT = g.t; g.happyUntil = g.t + 2;
      say(VOICE.shopBye()); talk(1.5); sync();
      later(nextGuest, 1500);
    }, wait);
  };

  // ── 터치 ──
  const onDown = (e) => {
    const g = G.current; if (!g || !g.L) return;
    const rect = canvasRef.current.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, L = g.L;
    if (g.phase === 'shop') {
      const cell = g.cells.find(c => x > c.x - c.w * 0.55 && x < c.x + c.w * 0.55 && y > c.base - c.h * 1.1 && y < c.base + c.h * 0.12);
      if (cell) { pick(cell); return; }
      const inGuest = Math.abs(x - L.gx) < L.S * 0.45 && y > L.gy - L.S * 1.2 && y < L.counterY;
      const b = g.bubble, inBubble = b && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
      if (inGuest || inBubble) { g.lastAct = g.t; sayOrder(); }
      return;
    }
    if (g.phase === 'scan') {
      const bk = g.bkPos, rx = L.px, rb = L.counterY + L.d * 0.55;
      const inBasket = bk && Math.abs(x - bk.x) < L.br * 1.25 && y > bk.y - L.br * 1.5 && y < bk.y + L.br * 0.8;
      const inReg = Math.abs(x - rx) < L.pr * 1.1 && y > rb - L.pr * 1.7 && y < rb + L.pr * 0.2;
      if (inBasket || inReg) scanOne();
      return;
    }
    if (g.phase === 'pay') {
      let best = null, bd = 1e9;
      g.coinsOut.forEach(c => { if (c.state !== 'wait') return; const dd = Math.hypot(x - c.x, y - c.y); if (dd < Math.max(c.r * 1.9, 46) && dd < bd) { bd = dd; best = c; } });
      if (best) takeCoin(best);
    }
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = performance.now(); const t0 = last;
    const loop = (now) => {
      const g = G.current;
      if (!g) { raf = requestAnimationFrame(loop); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t = (now - t0) / 1000; const t = g.t;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (W > 0 && H > 0) {
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const L = layout(W, H); const wasLand = g.L && g.L.land; g.L = L;
        if (wasLand !== L.land) sync();
        g.cells = shelfCells(L, g.stock);
        const gu = guest(), want = g.want;
        drawBackground(ctx, W, H, L);
        drawSign(ctx, L, t);

        // 가만히 있으면 찾을 물건이 반짝
        if (g.phase === 'shop' && !g.help && t - g.lastAct > 7) {
          g.help = true;
          if (!g.helpSaid) { g.helpSaid = true; say(VOICE.shopFind(GOOD_BY_ID[want.item])); talk(2.5); }
        }

        // 손님 (오는 중 / 가는 중 미끄러짐)
        let gxNow = L.gx, hop = 0;
        if (g.phase === 'arrive') { const k = easeOut((t - g.phaseT) / 0.9); gxNow = -L.S + (L.gx + L.S) * k; hop = Math.abs(Math.sin((t - g.phaseT) * 9)) * L.S * 0.08 * (1 - k); }
        if (g.phase === 'leave') { const k = easeIn((t - g.phaseT - 0.4) / 1.0); gxNow = L.gx - (L.gx + L.S * 1.4) * k; hop = Math.abs(Math.sin((t - g.phaseT) * 9)) * L.S * 0.06 * (k > 0 ? 1 : 0); }
        const happy = t < g.happyUntil;
        const mouth = t < g.mouthUntil ? 0.15 + 0.2 * Math.abs(Math.sin(t * 13)) : 0;
        const oy = L.gy - hop + (happy ? -Math.abs(Math.sin(t * 6)) * L.S * 0.05 : 0);
        ctx.save(); ctx.translate(gxNow, oy);
        ctx.beginPath(); ctx.rect(-L.S * 2, -L.S * 3, L.S * 4, L.counterY - oy + L.S * 3 + 1); ctx.clip();
        GUEST_FN[gu.id](ctx, L.S, t, happy, mouth);
        ctx.restore();

        // 말풍선: 사고 싶은 물건 n개 (담은 만큼 ✔)
        g.bubble = null;
        if ((g.phase === 'shop' || g.phase === 'scan' || g.phase === 'pay') && want) {
          const ir = L.S * (L.land ? 0.12 : 0.13), n = want.n, gap = ir * 2.5;
          const bw = Math.max(n * gap + ir * 0.8, ir * 3), bh = ir * 3.2;
          const bx = Math.min(gxNow + L.S * (L.land ? 0.42 : 0.5), (L.land ? L.split : W) - bw - 10), by = L.gy - L.S * (L.land ? 1.5 : 1.42);
          const popK = g.phase === 'scan' ? 1 : easeOut((t - g.phaseT) / 0.35);
          ctx.save(); ctx.translate(bx, by + bh / 2); ctx.scale(popK, popK); ctx.translate(-bx, -(by + bh / 2));
          shadowOn(ctx, 12, 4, 'rgba(0,0,0,0.18)'); ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh * 0.35); ctx.fill();
          ctx.beginPath(); ctx.moveTo(bx + bh * 0.25, by + bh * 0.7); ctx.lineTo(bx - bh * 0.22, by + bh * 1.05); ctx.lineTo(bx + bh * 0.5, by + bh * 0.95); ctx.fill(); shadowOff(ctx);
          if (g.phase !== 'pay') {
            const doneN = g.phase === 'scan' ? g.scanned : g.basket.length;
            for (let i = 0; i < n; i++) {
              const cx = bx + bw / 2 + (i - (n - 1) / 2) * gap, cy = by + ir * 1.25, done = i < doneN;
              drawGood(ctx, want.item, cx, cy, ir, 0, done ? 0.35 : 1);
              if (done) { ctx.fillStyle = '#22c55e'; ell(ctx, cx + ir * 0.55, cy + ir * 0.5, ir * 0.42, ir * 0.42); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = ir * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + ir * 0.36, cy + ir * 0.52); ctx.lineTo(cx + ir * 0.5, cy + ir * 0.68); ctx.lineTo(cx + ir * 0.76, cy + ir * 0.34); ctx.stroke(); }
            }
            ctx.fillStyle = '#9a3412'; ctx.font = `${Math.round(ir * 0.75)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`${n}개`, bx + bw / 2, by + ir * 2.75);
          } else {
            const pulse = 1 + Math.sin(t * 6) * 0.08;
            drawHeart(ctx, bx + bw / 2, by + bh * 0.55, ir * 1.1 * pulse, '#f472b6');
          }
          ctx.restore();
          g.bubble = { x0: bx - 10, x1: bx + bw + 10, y0: by - 10, y1: by + bh + 10 };
        }

        // 계산대
        const pBase = L.counterY + L.d * 0.55;
        const pk = (t - g.regT) / 0.45, phop = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0;
        const dk = clamp01((t - g.drawerT) / 0.3), drawerK = g.drawerOpen ? easeOut(dk) : 1 - easeOut(dk);
        const screen = g.phase === 'scan' ? `삑 ${g.scanned}개` : g.phase === 'pay' ? `${g.coinsIn} / ${want.n}` : `🪙 ${g.coins}`;
        drawRegister(ctx, L.px, pBase, L.pr, t, { flash: clamp01(1 - (t - g.beepT) / 0.35), drawer: drawerK, receipt: g.receiptT == null ? 0 : easeOut((t - g.receiptT) / 0.9), screen, hop: phop, coinsIn: g.coinsIn });

        // 바구니 (돈 낼 땐 손님이 들어 올리고, 갈 땐 같이 간다)
        let bxNow = L.bx, byNow = L.counterY + L.d * 0.45 - L.br * 0.55;
        if (g.phase === 'pay') byNow -= L.d * 0.9 * easeOut((t - g.phaseT) / 0.4);
        if (g.phase === 'leave') { byNow -= L.d * 0.9; bxNow += gxNow - L.gx - (L.bx - L.gx) * easeOut((t - g.phaseT) / 0.4) * 0.6; }
        g.bkPos = { x: bxNow, y: byNow };
        const sf = g.scanFly;
        drawBasket(ctx, bxNow, byNow, L.br, g.basket, sf ? sf.idx : -1);
        // 찍는 중인 물건: 바구니 → 스캐너 위 (삑) → 바구니
        if (sf) {
          const e = t - sf.t0, [dx, dy] = BASKET_SLOT[sf.idx], hx = bxNow + dx * L.br, hy = byNow + dy * L.br;
          const [sx, sy] = regScanPos(L.px, pBase, L.pr), tx = sx, ty = sy - L.br * 0.35;
          let x, y;
          if (e < 0.4) { const k = easeOut(e / 0.4); x = hx + (tx - hx) * k; y = hy + (ty - hy) * k - Math.sin(k * Math.PI) * L.br * 0.6; }
          else if (e < 0.65) { x = tx + Math.sin((e - 0.4) * 40) * L.br * 0.03; y = ty; }
          else { const k = easeOut((e - 0.65) / 0.4); x = tx + (hx - tx) * k; y = ty + (hy - ty) * k - Math.sin(k * Math.PI) * L.br * 0.6; }
          if (e >= 0.42 && !sf.beeped) { sf.beeped = true; beep(); }
          drawGood(ctx, g.basket[sf.idx], x, y, L.br * 0.45, dx * 0.4);
          if (e >= 1.05) { g.scanFly = null; if (g.scanned >= want.n) later(checkout, 300); }
        } else if (g.phase === 'scan' && g.scanned < want.n) {
          ctx.save(); ctx.font = `${Math.round(L.br * 0.55)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('👆', bxNow + L.br * 0.35, byNow - L.br * 0.95 + Math.sin(t * 6) * L.br * 0.08); ctx.restore();
        }

        // 동전
        const cr = Math.min(L.d * 0.36, L.br * 0.36);
        g.coinsOut.forEach(c => {
          const n = g.coinsOut.length, tx = L.bx - (n - 1) * cr * 1.35 + c.i * cr * 2.7 - L.br * 0.2, ty = L.counterY + L.d * 0.55;
          c.r = cr;
          if (c.state === 'drop') {
            const k = (t - c.t0) / 0.45; if (k < 0) return;
            const hx = gxNow + L.S * 0.2, hy = L.counterY - L.S * 0.3;
            c.x = hx + (tx - hx) * easeOut(k); c.y = hy + (ty - hy) * k * k - Math.sin(clamp01(k) * Math.PI) * L.S * 0.15;
            drawCoin(ctx, c.x, c.y, cr, 0.55 + (1 - clamp01(k)) * 0.45, (1 - clamp01(k)) * 6);
            if (k >= 1) { c.state = 'wait'; c.x = tx; c.y = ty; audio.playFreq(1200 + c.i * 150, 'sine', 0.05, 0.25); }
          } else if (c.state === 'wait') {
            c.x = tx; c.y = ty;
            const bob = Math.sin(t * 5 + c.i) * 0.5 + 0.5;
            ctx.save(); ctx.globalAlpha = 0.35 + bob * 0.3; ctx.fillStyle = '#fde047'; ell(ctx, tx, ty, cr * 1.5, cr * 0.95); ctx.fill(); ctx.restore();
            drawCoin(ctx, tx, ty, cr);
          } else if (c.state === 'fly') {
            const k = (t - c.t1) / 0.55, sx0 = c.x, sy0 = c.y, [ex, ey] = regDrawerPos(L.px, pBase, L.pr, drawerK);
            const kk = easeOut(k);
            drawCoin(ctx, sx0 + (ex - sx0) * kk, sy0 + (ey - sy0) * kk - Math.sin(clamp01(k) * Math.PI) * L.pr * 0.9, cr * (1 - 0.3 * kk), 0.55 + 0.45 * clamp01(k * 2), k * 10);
            if (k >= 1) coinIn(c);
          }
        });
        if (g.phase === 'pay' && !g.coinsOut.some(c => c.state === 'fly')) {
          const w = g.coinsOut.find(c => c.state === 'wait');
          if (w) { ctx.save(); ctx.font = `${Math.round(cr * 1.6)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👆', w.x + cr * 0.4, w.y + cr * 1.6 + Math.sin(t * 6) * cr * 0.2); ctx.restore(); }
        }

        // 선반 상자
        g.cells.forEach(cell => {
          const target = g.phase === 'shop' && cell.id === want.item;
          const glow = target && g.help ? 0.55 + 0.45 * Math.sin(t * 6) : 0;
          const sk = g.shake && g.shake.id === cell.id ? clamp01(1 - (t - g.shake.t0) / 0.5) : 0;
          const pr = g.press && g.press.id === cell.id ? clamp01(1 - (t - g.press.t0) / 0.2) : 0;
          const popK = (t - g.stockT - cell.i * 0.06) / 0.4;
          if (popK < 0) return;
          if (popK < 1) { const sc = easeOut(popK) * (1 + 0.12 * Math.sin(clamp01(popK) * Math.PI)); ctx.save(); ctx.translate(cell.x, cell.base); ctx.scale(sc, sc); ctx.translate(-cell.x, -cell.base); drawCrate(ctx, cell, t, 0, 0, 0); ctx.restore(); return; }
          drawCrate(ctx, cell, t, glow, sk, pr);
          if (glow > 0) { ctx.save(); ctx.font = `${Math.round(cell.h * 0.38)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👆', cell.x + cell.w * 0.3, cell.base - cell.h * 0.05 + Math.sin(t * 6) * cell.h * 0.06); ctx.restore(); }
        });

        // 날아가는 물건 (상자 → 바구니)
        g.fly = g.fly.filter(f => {
          const k = (t - f.t0) / f.dur; if (k < 0) return true;
          const [dx, dy] = BASKET_SLOT[f.slot], tx = bxNow + dx * L.br, ty = byNow + dy * L.br;
          const kk = easeOut(k), x = f.x0 + (tx - f.x0) * kk, y = f.y0 + (ty - f.y0) * kk - Math.sin(clamp01(k) * Math.PI) * L.S * 0.5;
          drawGood(ctx, f.id, x, y, L.br * (0.6 - 0.2 * kk), k * 2);
          if (k >= 1) { landItem(f); return false; }
          return true;
        });

        // 효과
        g.parts = g.parts.filter(p => {
          const e = t - p.born; if (e < 0) return true; if (e > p.life) return false;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const a = 1 - e / p.life;
          if (p.kind === 'star') { ctx.globalAlpha = a; ctx.fillStyle = '#fde047'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(e * 5); ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? 3 : 8; ctx.lineTo(Math.cos(i / 10 * TAU) * rr, Math.sin(i / 10 * TAU) * rr); } ctx.fill(); ctx.restore(); }
          else if (p.kind === 'heart') { ctx.globalAlpha = a; drawHeart(ctx, p.x + Math.sin(e * 4) * 10, p.y, 16, '#f472b6'); }
          ctx.globalAlpha = 1;
          return true;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 화면 (캔버스 + 버튼) ──
  const gu = GUEST_BY_ID[ui.guest], good = ui.item ? GOOD_BY_ID[ui.item] : null;
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(120,60,20,0.6)', whiteSpace: 'nowrap' });
  const hint = ui.phase === 'shop' && good ? `${good.emoji} ${good.name} ${ui.n}개를 콕! 바구니에 담아요`
    : ui.phase === 'scan' ? '🧺 바구니를 콕! 계산대에서 삑~ 찍어요'
    : ui.phase === 'pay' ? '🪙 동전을 콕! 계산대 서랍에 넣어요'
    : ui.phase === 'leave' ? '👋 안녕히 가세요~' : null;
  const workArea = ui.land ? { left: '41%', right: '1.5%' } : { left: '3%', right: '3%' };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={nextGuest} style={btn('#f6efe7', '#5c5248')}>🙋 다른 손님</button>
        <button onClick={() => { if (G.current.phase === 'shop') sayOrder(); }} style={btn('#ffffff', '#9a3412')}>🔊 다시 듣기</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#9a3412', minWidth: '160px' }}>🛒 동물 마을 가게 · {gu.name} 손님</div>
        <div style={{ fontFamily: JUA, fontSize: '1.3rem', color: '#a16207', background: '#fef9c3', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 6px 14px -10px rgba(120,80,0,0.6)' }}>🪙 {ui.coins}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(154,52,18,0.55)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} data-stock={ui.stock}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: workArea.left, right: workArea.right, top: ui.land ? '12px' : '44.5%', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.9)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.25rem', color: '#7c2d12', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
      </div>
    </div>
  );
}
