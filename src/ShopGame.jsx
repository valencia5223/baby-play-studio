// ═════════════════════════════════════════════════════════════════════════════
// 🛒 동물 마을 가게 (편의점): 점원(아이) 쪽에서 바라본 가게 전경.
//    동물 손님이 자동문으로 들어와 매대를 돌아다니며 스스로 물건을 골라 바구니에 담고, 계산대로 와서 바구니를 올려놓는다.
//    가끔 "그리고 호빵 한 개 주세요!" 하고 카운터 진열장(점원 쪽) 물건을 달라고 하면 아이가 콕 눌러 바구니에 넣어 준다.
//    → 하나씩 콕 "삑!" 찍기 → 현금(동전 콕) 또는 카드(꽂기·돌려주기)
//  - 손님은 동시에 둘까지. 계산대는 한 번에 한 손님(g.task), 다른 손님은 줄을 선다
//  - 카운터 진열장 물건: shopData COUNTER_GOODS (그림은 이 파일 gdBun 등)
//  - 진열대: 과일 · 채소 · 냉장고 (shopData SHOP_UNITS, 가게를 열 때 진열대 안에서 자리만 섞음)
//  - 손님·음식 그림은 요리 놀이(KitchenGame.jsx)의 GUEST_FN·drawWhole 을 빌려 쓰고, 통째 토마토·사과·달걀·키위만 여기서 그린다
//  - 실패는 없다: 다른 물건을 누르면 흔들리며 "그건 ○○예요", 가만히 있으면 7초 뒤 찾을 물건이 반짝
//  - 저장: localStorage bps_shop_v1 (모은 동전 수, shopData.js)
//  - 음성은 남성 아나운서 MP3 (VOICE.shop*, npm run voices)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { KITCHEN_GUESTS, GUEST_BY_ID } from './kitchenData.js';
import { GUEST_FN, drawWhole } from './KitchenGame.jsx';
import { GOOD_BY_ID, SHOP_UNITS, arrangeStore, arrangeCounter, makeVisit, PIGGY_FULL, loadShop, saveShop } from './shopData.js';
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const easeIn = (k) => Math.pow(clamp01(k), 2);
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
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
// ── 카운터 진열장 물건 (호빵·군고구마·어묵·핫도그·막대사탕·아이스크림)
function gdBun(c, u) {
  c.fillStyle = '#efe3c8'; c.beginPath(); c.roundRect(-u * 0.8, u * 0.4, u * 1.6, u * 0.2, u * 0.05); c.fill();
  const dome = () => { c.beginPath(); c.moveTo(-u * 0.84, u * 0.44); c.bezierCurveTo(-u * 0.95, -u * 0.22, -u * 0.46, -u * 0.74, 0, -u * 0.74); c.bezierCurveTo(u * 0.46, -u * 0.74, u * 0.95, -u * 0.22, u * 0.84, u * 0.44); c.quadraticCurveTo(0, u * 0.58, -u * 0.84, u * 0.44); c.closePath(); };
  shadowOn(c, u * 0.14, u * 0.06); dome();
  c.fillStyle = rg(c, -u * 0.28, -u * 0.38, u * 0.05, 0, 0, u * 0.98, [[0, '#ffffff'], [0.55, '#f8f3ea'], [1, '#d8ccb8']]); c.fill(); shadowOff(c);
  c.save(); dome(); c.clip(); speckle(c, 41, 40, -u * 0.8, -u * 0.7, u * 0.8, u * 0.5, u * 0.008, u * 0.02, ['rgba(200,185,160,0.35)']); c.restore();
  c.strokeStyle = 'rgba(165,145,115,0.5)'; c.lineWidth = u * 0.035; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const q = (i - 3) / 3; c.beginPath(); c.moveTo(q * u * 0.06, -u * 0.63); c.quadraticCurveTo(q * u * 0.32, -u * 0.58, q * u * 0.5, -u * 0.28 - (1 - Math.abs(q)) * u * 0.05); c.stroke(); }
  c.fillStyle = 'rgba(175,150,115,0.55)'; ell(c, 0, -u * 0.63, u * 0.08, u * 0.045); c.fill();
  gloss(c, -u * 0.38, -u * 0.32, u * 0.24, u * 0.12, 0.65, -0.5);
}
function gdSweetPotato(c, u) {
  c.save(); c.rotate(-0.28);
  const body = () => { c.beginPath(); c.moveTo(-u * 1.0, u * 0.05); c.bezierCurveTo(-u * 0.92, -u * 0.46, u * 0.5, -u * 0.56, u * 0.98, -u * 0.06); c.bezierCurveTo(u * 1.06, u * 0.3, u * 0.3, u * 0.5, -u * 0.4, u * 0.42); c.bezierCurveTo(-u * 0.8, u * 0.38, -u * 1.06, u * 0.3, -u * 1.0, u * 0.05); c.closePath(); };
  shadowOn(c, u * 0.14, u * 0.07); body();
  c.fillStyle = rg(c, -u * 0.2, -u * 0.25, u * 0.05, 0, 0, u * 1.1, [[0, '#b45a70'], [0.6, '#7c2d44'], [1, '#4a1726']]); c.fill(); shadowOff(c);
  c.save(); body(); c.clip();
  speckle(c, 31, 34, -u, -u * 0.5, u, u * 0.5, u * 0.03, u * 0.09, ['rgba(40,10,15,0.45)', 'rgba(70,25,20,0.35)', 'rgba(20,10,5,0.4)']);
  // 갈라진 노란 속살 (김이 나는 듯)
  const flesh = () => { c.beginPath(); c.moveTo(-u * 0.62, -u * 0.16); c.bezierCurveTo(-u * 0.3, -u * 0.46, u * 0.32, -u * 0.48, u * 0.66, -u * 0.2); c.bezierCurveTo(u * 0.3, u * 0.02, -u * 0.3, u * 0.04, -u * 0.62, -u * 0.16); c.closePath(); };
  flesh(); c.fillStyle = rg(c, 0, -u * 0.2, u * 0.02, 0, -u * 0.2, u * 0.62, [[0, '#ffe999'], [0.55, '#f8b93c'], [1, '#d3841a']]); c.fill();
  c.save(); flesh(); c.clip(); speckle(c, 9, 18, -u * 0.55, -u * 0.4, u * 0.6, 0, u * 0.02, u * 0.045, ['rgba(255,250,210,0.7)', 'rgba(200,110,20,0.35)']); c.restore();
  c.strokeStyle = 'rgba(60,15,20,0.6)'; c.lineWidth = u * 0.04; flesh(); c.stroke();
  c.restore();
  gloss(c, -u * 0.45, -u * 0.22, u * 0.18, u * 0.05, 0.3, -0.2);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = u * 0.04; c.lineCap = 'round';
  [-0.15, 0.12].forEach((q, i) => { c.beginPath(); c.moveTo(q * u, -u * 0.45); c.bezierCurveTo(q * u + u * 0.12, -u * 0.6, q * u - u * 0.12, -u * 0.72, q * u + (i ? -0.02 : 0.04) * u, -u * 0.9); c.stroke(); });
}
function gdFishcake(c, u) {
  c.fillStyle = lg(c, -u * 0.045, 0, u * 0.045, 0, [[0, '#b98c55'], [1, '#e8cc98']]); c.beginPath(); c.roundRect(-u * 0.045, -u * 1.0, u * 0.09, u * 1.95, u * 0.03); c.fill();
  const a = u * 0.64, b = u * 0.15, th = u * 0.24;
  for (let i = 0; i < 4; i++) {
    const y = -u * 0.68 + i * u * 0.34, k = i % 2 ? 1 : -1, sx = k * u * 0.05;
    const fold = () => { c.beginPath(); c.moveTo(-a + sx, y); c.quadraticCurveTo(sx, y + b * k * 2, a + sx, y); c.lineTo(a + sx, y + th); c.quadraticCurveTo(sx, y + th + b * k * 2, -a + sx, y + th); c.closePath(); };
    shadowOn(c, u * 0.08, u * 0.04); fold();
    c.fillStyle = lg(c, -a, y, a, y + th, [[0, '#f6e0b4'], [0.5, '#e7bf80'], [1, '#c48f50']]); c.fill(); shadowOff(c);
    c.save(); fold(); c.clip(); speckle(c, 50 + i, 14, -a, y - b, a, y + th + b * 2, u * 0.01, u * 0.025, ['rgba(150,95,40,0.35)', 'rgba(255,245,220,0.5)']); c.restore();
    c.strokeStyle = 'rgba(140,90,40,0.45)'; c.lineWidth = u * 0.02; c.beginPath(); c.moveTo(-a + sx, y + th); c.quadraticCurveTo(sx, y + th + b * k * 2, a + sx, y + th); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(-a * 0.7 + sx, y + th * 0.2); c.quadraticCurveTo(sx, y + th * 0.2 + b * k * 2, a * 0.2 + sx, y + th * 0.25 + b * k); c.lineTo(a * 0.2 + sx, y + th * 0.4 + b * k); c.quadraticCurveTo(sx, y + th * 0.35 + b * k * 2, -a * 0.7 + sx, y + th * 0.35); c.closePath(); c.fill();
  }
}
function gdHotdog(c, u) {
  c.save(); c.rotate(0.15);
  c.fillStyle = lg(c, -u * 0.05, 0, u * 0.05, 0, [[0, '#b98c55'], [1, '#ead2a0']]); c.beginPath(); c.roundRect(-u * 0.05, u * 0.35, u * 0.1, u * 0.65, u * 0.03); c.fill();
  const body = () => { c.beginPath(); c.roundRect(-u * 0.33, -u * 0.95, u * 0.66, u * 1.42, u * 0.33); };
  shadowOn(c, u * 0.14, u * 0.06); body();
  c.fillStyle = rg(c, -u * 0.12, -u * 0.35, u * 0.03, 0, -u * 0.2, u * 0.85, [[0, '#f8cf7a'], [0.5, '#dc8f2c'], [1, '#9a5414']]); c.fill(); shadowOff(c);
  c.save(); body(); c.clip(); speckle(c, 23, 80, -u * 0.33, -u * 0.95, u * 0.33, u * 0.47, u * 0.015, u * 0.035, ['rgba(255,225,150,0.6)', 'rgba(130,65,10,0.45)', 'rgba(200,120,30,0.5)']); c.restore();
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = '#c81e1e'; c.lineWidth = u * 0.08; c.beginPath(); for (let i = 0; i <= 6; i++) { const y = -u * 0.78 + i * u * 0.19, x = (i % 2 ? 1 : -1) * u * 0.2; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = u * 0.02; c.beginPath(); for (let i = 0; i <= 6; i++) { const y = -u * 0.8 + i * u * 0.19, x = (i % 2 ? 1 : -1) * u * 0.18; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
  c.strokeStyle = '#facc15'; c.lineWidth = u * 0.035; c.beginPath(); for (let i = 0; i <= 6; i++) { const y = -u * 0.7 + i * u * 0.19, x = (i % 2 ? -1 : 1) * u * 0.17; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
  gloss(c, -u * 0.14, -u * 0.55, u * 0.08, u * 0.26, 0.45);
  c.restore();
}
function gdLollipop(c, u) {
  c.fillStyle = '#f8fafc'; c.strokeStyle = '#cbd5e1'; c.lineWidth = u * 0.02; c.beginPath(); c.roundRect(-u * 0.05, -u * 0.05, u * 0.1, u * 1.05, u * 0.04); c.fill(); c.stroke();
  const R = u * 0.62, cy = -u * 0.32;
  shadowOn(c, u * 0.14, u * 0.06); c.fillStyle = '#fff7ed'; ell(c, 0, cy, R, R); c.fill(); shadowOff(c);
  c.save(); ell(c, 0, cy, R, R); c.clip();
  const cols = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];
  c.lineWidth = R * 0.17; c.lineCap = 'round';
  cols.forEach((col, i) => { c.strokeStyle = col; c.beginPath(); for (let s = 0; s <= 50; s++) { const a = s / 50 * TAU * 1.6 + i / 6 * TAU, rr = R * 1.05 * s / 50; const x = Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (s) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); });
  c.fillStyle = rg(c, -R * 0.3, cy - R * 0.3, 0, 0, cy, R, [[0, 'rgba(255,255,255,0.25)'], [0.7, 'rgba(255,255,255,0)'], [1, 'rgba(80,0,40,0.25)']]); ell(c, 0, cy, R, R); c.fill();
  c.restore();
  gloss(c, -R * 0.38, cy - R * 0.42, R * 0.32, R * 0.18, 0.75, -0.6);
}
function gdIcecream(c, u) {
  const cone = () => { c.beginPath(); c.moveTo(-u * 0.46, -u * 0.12); c.lineTo(u * 0.46, -u * 0.12); c.lineTo(0, u * 1.0); c.closePath(); };
  shadowOn(c, u * 0.12, u * 0.06); cone(); c.fillStyle = lg(c, -u * 0.46, 0, u * 0.46, 0, [[0, '#b97a34'], [0.5, '#eab36a'], [1, '#a8682a']]); c.fill(); shadowOff(c);
  c.save(); cone(); c.clip(); c.strokeStyle = 'rgba(120,70,20,0.5)'; c.lineWidth = u * 0.035;
  for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(i * u * 0.16 - u * 0.5, -u * 0.12); c.lineTo(i * u * 0.16 + u * 0.5, u * 1.0); c.stroke(); c.beginPath(); c.moveTo(i * u * 0.16 + u * 0.5, -u * 0.12); c.lineTo(i * u * 0.16 - u * 0.5, u * 1.0); c.stroke(); }
  c.restore();
  const scoop = () => {
    c.beginPath(); c.moveTo(-u * 0.56, -u * 0.1);
    c.bezierCurveTo(-u * 0.72, -u * 0.62, -u * 0.36, -u * 0.95, 0, -u * 0.95); c.bezierCurveTo(u * 0.36, -u * 0.95, u * 0.72, -u * 0.62, u * 0.56, -u * 0.1);
    for (let i = 0; i < 5; i++) { const x0 = u * 0.56 - i * u * 0.224; c.quadraticCurveTo(x0 - u * 0.06, -u * 0.1 + (i % 2 ? u * 0.16 : u * 0.06), x0 - u * 0.112, -u * 0.08); c.quadraticCurveTo(x0 - u * 0.17, -u * 0.12, x0 - u * 0.224, -u * 0.1); }
    c.closePath();
  };
  shadowOn(c, u * 0.12, u * 0.05); scoop();
  c.fillStyle = rg(c, -u * 0.2, -u * 0.62, u * 0.05, 0, -u * 0.42, u * 0.65, [[0, '#ffe1ea'], [0.55, '#f9a8c0'], [1, '#e2708f']]); c.fill(); shadowOff(c);
  const r = rng(7), cols = ['#f43f5e', '#facc15', '#38bdf8', '#4ade80', '#ffffff', '#a78bfa'];
  for (let i = 0; i < 16; i++) { const a = r() * Math.PI, rr = r() * u * 0.5; c.save(); c.translate(Math.cos(a) * rr * 1.1 - u * 0.0, -u * 0.5 - Math.sin(a) * rr * 0.75); c.rotate(r() * 3); c.fillStyle = cols[i % cols.length]; c.beginPath(); c.roundRect(-u * 0.05, -u * 0.015, u * 0.1, u * 0.03, u * 0.015); c.fill(); c.restore(); }
  gloss(c, -u * 0.25, -u * 0.68, u * 0.2, u * 0.1, 0.7, -0.4);
}
const OWN_FN = { tomato: gdTomato, apple: gdApple, egg: gdEgg, kiwi: gdKiwi, bun: gdBun, sweetpotato: gdSweetPotato, fishcake: gdFishcake, hotdog: gdHotdog, lollipop: gdLollipop, icecream: gdIcecream };
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

// ═══════════════ 배치 (가로: 넓은 전경 / 세로: 같은 구성을 좁게) ═══════════════
function layout(W, H) {
  const land = W >= H * 1.1;
  if (land) {
    return { land, W, H, S: H * 0.22, ceil: H * 0.045, signY: H * 0.105, shelfTop: H * 0.165, shelfBot: H * 0.49, wallBot: H * 0.5,
      door: { x0: W * 0.012, x1: W * 0.118, y0: H * 0.15 },
      units: [0, 1, 2].map(u => ({ x0: W * (0.135 + u * 0.29), x1: W * (0.405 + u * 0.29) })),
      laneY: H * 0.8, laneD: H * 0.025, counterX: W * 0.45, counterY: H * 0.72, d: H * 0.065, caseCols: 6, caseRows: 1,
      gx: W * 0.685, bx: W * 0.79, br: Math.min(W * 0.055, H * 0.085), px: W * 0.915, pr: Math.min(W * 0.07, H * 0.11),
      queueX: W * 0.35, doorX: W * 0.065, speed: 0.15 };
  }
  return { land, W, H, S: Math.min(H * 0.15, W * 0.22), ceil: H * 0.035, signY: H * 0.072, shelfTop: H * 0.115, shelfBot: H * 0.44, wallBot: H * 0.45,
    door: { x0: W * 0.01, x1: W * 0.098, y0: H * 0.11 },
    units: [0, 1, 2].map(u => ({ x0: W * (0.108 + u * 0.298), x1: W * (0.393 + u * 0.298) })),
    laneY: H * 0.68, laneD: H * 0.02, counterX: W * 0.3, counterY: H * 0.65, d: H * 0.07, caseCols: 3, caseRows: 2,
    gx: W * 0.5, bx: W * 0.67, br: Math.min(W * 0.09, H * 0.065), px: W * 0.87, pr: Math.min(W * 0.11, H * 0.085),
    queueX: W * 0.15, doorX: W * 0.054, speed: 0.2 };
}
const rowH = (L) => (L.shelfBot - L.shelfTop) / 3;
// 진열 칸: stock[i] → 진열대 floor(i/6), 그 안에서 2열 × 3층
function shelfCells(L, stock) {
  const ch = rowH(L);
  return stock.map((id, i) => {
    const u = Math.floor(i / 6), j = i % 6, col = j % 2, row = Math.floor(j / 2), U = L.units[u], cw = (U.x1 - U.x0) / 2;
    const w = Math.min(cw * 0.84, ch * 1.35), h = Math.min(ch * 0.8, w * 0.8);
    return { id, i, u, fridge: SHOP_UNITS[u].kind === 'fridge', x: U.x0 + cw * (col + 0.5), base: L.shelfTop + ch * (row + 1) - ch * 0.08, w, h };
  });
}
// 카운터 진열장 (계산대 점원 쪽 앞판 안)
function caseRect(L) {
  const pTop = L.counterY + L.d + 10, ph = L.H - pTop;
  return { x0: L.counterX + L.d * 0.4, x1: L.W - 12, y0: pTop + ph * 0.2, y1: L.H - 8 };
}
function caseCells(L, stock) {
  const R = caseRect(L), cw = (R.x1 - R.x0) / L.caseCols, ch = (R.y1 - R.y0) / L.caseRows;
  return stock.map((id, i) => {
    const col = i % L.caseCols, row = Math.floor(i / L.caseCols);
    const w = Math.min(cw * 0.86, ch * 1.2), h = Math.min(ch * 0.76, w * 0.86);
    return { id, i: 18 + i, fridge: true, inCase: true, x: R.x0 + cw * (col + 0.5), base: R.y0 + ch * (row + 1) - ch * 0.1, w, h };
  });
}
// 바구니 안 물건 자리 (왼쪽 → 오른쪽 → 가운데 위)
const BASKET_SLOT = [[-0.42, -0.36], [0.42, -0.36], [0, -0.55]];

// ── 가게 뒤쪽 (천장·벽·자동문 틀·진열대·바닥): 크기가 바뀔 때만 그린다
let bgCache = null;
function drawStore(ctx, W, H, L) {
  const key = `${W}x${H}`;
  if (!bgCache || bgCache.key !== key) {
    const cv = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr); const r = rng(11);
    const fy = L.wallBot, fh = H - fy, ch = rowH(L);
    // 벽
    c.fillStyle = lg(c, 0, 0, 0, fy, [[0, '#f8fafc'], [1, '#e8eef5']]); c.fillRect(0, 0, W, fy);
    // 천장 + 조명
    c.fillStyle = lg(c, 0, 0, 0, L.ceil, [[0, '#dfe3e8'], [1, '#eef1f4']]); c.fillRect(0, 0, W, L.ceil);
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + i * 0.2);
      c.fillStyle = rg(c, x, L.ceil, 0, x, L.ceil, W * 0.12, [[0, 'rgba(255,253,230,0.75)'], [1, 'rgba(255,253,230,0)']]); ell(c, x, L.ceil, W * 0.12, H * 0.06); c.fill();
      c.fillStyle = '#ffffff'; shadowOn(c, 10, 0, 'rgba(255,250,200,0.9)'); c.beginPath(); c.roundRect(x - W * 0.06, L.ceil * 0.3, W * 0.12, L.ceil * 0.42, L.ceil * 0.2); c.fill(); shadowOff(c);
    }
    // 가게 색 띠 (초록 + 주황)
    c.fillStyle = '#16a34a'; c.fillRect(0, L.ceil, W, H * 0.012); c.fillStyle = '#fb923c'; c.fillRect(0, L.ceil + H * 0.012, W, H * 0.006);
    // 바닥 (원근 타일 + 조명 반사)
    c.fillStyle = lg(c, 0, fy, 0, H, [[0, '#e7e2d8'], [1, '#f8f5ef']]); c.fillRect(0, fy, W, fh);
    c.strokeStyle = 'rgba(150,135,110,0.22)'; c.lineWidth = 1.5;
    for (let k = 1; k < 8; k++) { const y = fy + fh * Math.pow(k / 8, 1.4); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let i = -14; i <= 14; i++) { const xt = W / 2 + i * W * 0.055; c.beginPath(); c.moveTo(xt, fy); c.lineTo(W / 2 + (xt - W / 2) * 1.9, H); c.stroke(); }
    for (let i = 0; i < 5; i++) { const x = W * (0.1 + i * 0.2); c.fillStyle = rg(c, x, fy + fh * 0.3, 0, x, fy + fh * 0.3, W * 0.09, [[0, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]); ell(c, x, fy + fh * 0.3, W * 0.09, fh * 0.1); c.fill(); }
    c.fillStyle = lg(c, 0, fy, 0, fy + fh * 0.08, [[0, 'rgba(60,60,70,0.18)'], [1, 'rgba(60,60,70,0)']]); c.fillRect(0, fy, W, fh * 0.08);
    // 걸레받이
    c.fillStyle = '#9ca3af'; c.fillRect(0, fy - H * 0.01, W, H * 0.01);
    // 자동문: 바깥 풍경 + 문틀 + 발판
    const D = L.door, dw = D.x1 - D.x0, dh = fy - D.y0;
    c.fillStyle = lg(c, 0, D.y0, 0, fy, [[0, '#7dd3fc'], [0.65, '#e0f2fe'], [1, '#e0f2fe']]); c.fillRect(D.x0, D.y0, dw, dh);
    c.fillStyle = '#ffffff'; [[0.3, 0.2], [0.72, 0.34]].forEach(([a, b]) => [[0, 0, 0.16], [0.12, -0.03, 0.12]].forEach(([dx, dy, rr]) => { ell(c, D.x0 + dw * (a + dx), D.y0 + dh * (b + dy), dw * rr, dh * 0.035); c.fill(); }));
    c.fillStyle = '#4ade80'; ell(c, D.x0 + dw * 0.22, fy - dh * 0.3, dw * 0.26, dh * 0.13); c.fill(); ell(c, D.x0 + dw * 0.8, fy - dh * 0.26, dw * 0.24, dh * 0.11); c.fill();
    c.fillStyle = '#86efac'; c.fillRect(D.x0, fy - dh * 0.22, dw, dh * 0.22);
    c.fillStyle = '#d6d3d1'; c.beginPath(); c.moveTo(D.x0 + dw * 0.3, fy); c.lineTo(D.x0 + dw * 0.7, fy); c.lineTo(D.x0 + dw * 0.56, fy - dh * 0.22); c.lineTo(D.x0 + dw * 0.44, fy - dh * 0.22); c.closePath(); c.fill();
    c.strokeStyle = '#64748b'; c.lineWidth = Math.max(4, dw * 0.07); c.strokeRect(D.x0, D.y0, dw, dh);
    c.fillStyle = '#475569'; c.beginPath(); c.moveTo(D.x0 - dw * 0.05, fy); c.lineTo(D.x1 + dw * 0.05, fy); c.lineTo(D.x1 + dw * 0.35, fy + fh * 0.1); c.lineTo(D.x0 - dw * 0.1, fy + fh * 0.1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 2; for (let i = 1; i < 6; i++) { const y = fy + fh * 0.1 * i / 6; c.beginPath(); c.moveTo(D.x0, y); c.lineTo(D.x1 + dw * 0.3 * i / 6, y); c.stroke(); }
    // 진열대
    L.units.forEach((U, u) => {
      const w = U.x1 - U.x0, top = L.shelfTop - ch * 0.12, post = Math.max(6, w * 0.025);
      if (SHOP_UNITS[u].kind === 'fridge') {
        shadowOn(c, 12, 4, 'rgba(30,41,59,0.3)');
        c.fillStyle = lg(c, U.x0, 0, U.x1, 0, [[0, '#cbd5e1'], [0.5, '#f1f5f9'], [1, '#cbd5e1']]); c.fillRect(U.x0 - post, top - ch * 0.16, w + post * 2, fy - top + ch * 0.16); shadowOff(c);
        c.fillStyle = lg(c, 0, top, 0, L.shelfBot, [[0, '#f0f9ff'], [1, '#bae6fd']]); c.fillRect(U.x0, top, w, L.shelfBot - top);
        c.fillStyle = 'rgba(255,255,255,0.9)'; shadowOn(c, 8, 0, 'rgba(186,230,253,1)'); c.fillRect(U.x0 + w * 0.04, top + 2, w * 0.92, ch * 0.03); shadowOff(c);
        for (let row = 0; row < 3; row++) {
          const by = L.shelfTop + ch * (row + 1) - ch * 0.08;
          c.fillStyle = 'rgba(30,64,120,0.15)'; c.fillRect(U.x0, by + ch * 0.04, w, ch * 0.05);
          c.fillStyle = lg(c, 0, by, 0, by + ch * 0.05, [[0, '#e2e8f0'], [1, '#94a3b8']]); c.fillRect(U.x0, by, w, ch * 0.05);
        }
        c.fillStyle = '#94a3b8'; c.fillRect(U.x0 - post, L.shelfBot, w + post * 2, fy - L.shelfBot);
        c.fillStyle = '#64748b'; for (let i = 0; i < 12; i++) c.fillRect(U.x0 + w * (0.08 + i * 0.075), L.shelfBot + (fy - L.shelfBot) * 0.3, w * 0.04, (fy - L.shelfBot) * 0.4);
      } else {
        shadowOn(c, 10, 3, 'rgba(30,41,59,0.22)');
        c.fillStyle = lg(c, 0, top, 0, L.shelfBot, [[0, '#fffbf3'], [1, '#f3e9d6']]); c.fillRect(U.x0, top, w, L.shelfBot - top); shadowOff(c);
        c.fillStyle = 'rgba(160,130,90,0.16)'; for (let y = top + ch * 0.12; y < L.shelfBot; y += ch * 0.16) for (let x = U.x0 + w * 0.04; x < U.x1; x += w * 0.06) { ell(c, x, y, 1.6, 1.6); c.fill(); }
        [U.x0 - post, U.x1].forEach(x => { c.fillStyle = lg(c, x, 0, x + post, 0, [[0, '#94a3b8'], [0.5, '#e2e8f0'], [1, '#94a3b8']]); c.fillRect(x, top - ch * 0.06, post, fy - top + ch * 0.06); });
        for (let row = 0; row < 3; row++) {
          const by = L.shelfTop + ch * (row + 1) - ch * 0.08, th = ch * 0.08;
          c.fillStyle = 'rgba(30,41,59,0.15)'; c.fillRect(U.x0, by + th, w, th);
          c.fillStyle = lg(c, 0, by, 0, by + th, [[0, '#ffffff'], [1, '#cbd5e1']]); c.fillRect(U.x0 - post, by, w + post * 2, th);
          c.fillStyle = SHOP_UNITS[u].color; c.globalAlpha = 0.8; c.fillRect(U.x0 - post, by + th * 0.55, w + post * 2, th * 0.3); c.globalAlpha = 1;
        }
        c.fillStyle = lg(c, 0, L.shelfBot, 0, fy, [[0, '#cbd5e1'], [1, '#94a3b8']]); c.fillRect(U.x0 - post, L.shelfBot, w + post * 2, fy - L.shelfBot);
      }
      // 간판 줄
      c.strokeStyle = '#94a3b8'; c.lineWidth = 2; const sw = w * 0.5, sx = (U.x0 + U.x1) / 2;
      [-1, 1].forEach(k => { c.beginPath(); c.moveTo(sx + k * sw * 0.35, L.ceil + H * 0.018); c.lineTo(sx + k * sw * 0.35, L.signY - H * 0.02); c.stroke(); });
    });
    for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(150,135,110,${0.05 + r() * 0.05})`; ell(c, W * r(), fy + fh * (0.2 + r() * 0.7), W * 0.02, fh * 0.01); c.fill(); }
    bgCache = { key, cv };
  }
  ctx.drawImage(bgCache.cv, 0, 0, W, H);
}
// 진열대 간판·문 위 글씨 (글꼴이 늦게 불러와져도 맞게 매 프레임)
function drawSigns(ctx, L) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  L.units.forEach((U, u) => {
    const w = (U.x1 - U.x0) * 0.5, h = L.H * 0.048, x = (U.x0 + U.x1) / 2, y = L.signY;
    shadowOn(ctx, 6, 2, 'rgba(0,0,0,0.2)'); ctx.fillStyle = SHOP_UNITS[u].color; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.3); ctx.fill(); shadowOff(ctx);
    ctx.fillStyle = '#ffffff'; ctx.font = `${Math.round(h * 0.62)}px ${JUA}`; ctx.fillText(SHOP_UNITS[u].label, x, y + h * 0.04);
  });
  const D = L.door, dw = D.x1 - D.x0, h = L.H * 0.04;
  ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.roundRect(D.x0 - dw * 0.04, D.y0 - h * 1.15, dw * 1.08, h, h * 0.25); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = `${Math.round(Math.min(h * 0.6, dw * 0.17))}px ${JUA}`; ctx.fillText('어서 오세요', (D.x0 + D.x1) / 2, D.y0 - h * 0.63);
  ctx.restore();
}
// 자동문 유리 두 짝 (k = 열린 정도)
function drawDoor(ctx, L, k) {
  const D = L.door, dw = D.x1 - D.x0, y1 = L.wallBot, dh = y1 - D.y0, half = dw / 2, sl = half * 0.92 * k;
  ctx.save(); ctx.beginPath(); ctx.rect(D.x0, D.y0, dw, dh); ctx.clip();
  [[D.x0 - sl, 0], [D.x0 + half + sl, 1]].forEach(([x]) => {
    ctx.fillStyle = 'rgba(214,236,250,0.35)'; ctx.fillRect(x, D.y0, half, dh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(x + half * 0.2, D.y0); ctx.lineTo(x + half * 0.42, D.y0); ctx.lineTo(x + half * 0.05, y1); ctx.lineTo(x - half * 0.17, y1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(3, dw * 0.035); ctx.strokeRect(x + 1, D.y0 + 1, half - 2, dh - 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + half * 0.15, D.y0 + dh * 0.5, half * 0.7, dh * 0.04);
  });
  ctx.restore();
}
// 냉장고 유리문 (물건 위에 덮는다)
function drawFridgeGlass(ctx, L, U) {
  const ch = rowH(L), y0 = L.shelfTop - ch * 0.12, y1 = L.shelfBot, w = U.x1 - U.x0, half = w / 2;
  ctx.save();
  [0, 1].forEach(k => {
    const x = U.x0 + k * half;
    ctx.fillStyle = 'rgba(224,242,254,0.12)'; ctx.fillRect(x, y0, half, y1 - y0);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y0, half, y1 - y0); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(x + half * 0.55, y0); ctx.lineTo(x + half * 0.7, y0); ctx.lineTo(x + half * 0.25, y1); ctx.lineTo(x + half * 0.1, y1); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = Math.max(4, w * 0.022); ctx.strokeRect(x + 2, y0 + 2, half - 4, y1 - y0 - 4);
    ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.roundRect(k === 0 ? x + half - w * 0.035 : x + w * 0.018, y0 + (y1 - y0) * 0.36, w * 0.016, (y1 - y0) * 0.28, w * 0.008); ctx.fill();
  });
  ctx.restore();
}

// ── 진열 칸 그림: 나무 상자(과일·채소) / 냉장 칸(가격표). 칸마다 한 번 그려 두고 복사
function crateArt(ctx, id, w, h) {
  shadowOn(ctx, w * 0.06, w * 0.03, 'rgba(60,30,10,0.35)');
  ctx.fillStyle = lg(ctx, 0, -h, 0, 0, [[0, '#9c6a3c'], [1, '#6b4220']]); ctx.beginPath(); ctx.roundRect(-w / 2, -h * 0.82, w, h * 0.82, w * 0.04); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = 'rgba(40,20,5,0.35)'; ctx.fillRect(-w * 0.46, -h * 0.78, w * 0.92, h * 0.1);
  const r = Math.min(w * 0.2, h * 0.34), tall = id === 'corn' || id === 'carrot';
  [[0, -0.66, 0.15], [-0.25, -0.5, -0.25], [0.25, -0.5, 0.3]].forEach(([dx, dy, rot], i) => drawGood(ctx, id, dx * w, dy * h - (tall ? h * 0.05 : 0), r * (i ? 1 : 0.95), tall ? rot * 0.5 : rot));
  const fh = h * 0.42;
  ctx.fillStyle = lg(ctx, 0, -fh, 0, 0, [[0, '#e2ad70'], [1, '#b47d44']]); ctx.beginPath(); ctx.roundRect(-w / 2, -fh, w, fh, w * 0.04); ctx.fill();
  ctx.strokeStyle = 'rgba(110,60,20,0.45)'; ctx.lineWidth = Math.max(1, w * 0.008); ctx.beginPath(); ctx.moveTo(-w / 2, -fh * 0.5); ctx.lineTo(w / 2, -fh * 0.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-w / 2 + 2, -fh + 1, w - 4, 2);
  const lw = Math.min(w * 0.64, fh * 2.6), lh = fh * 0.66;
  ctx.fillStyle = '#fffdf5'; shadowOn(ctx, 4, 1, 'rgba(0,0,0,0.2)'); ctx.beginPath(); ctx.roundRect(-lw / 2, -fh * 0.83, lw, lh, lh * 0.25); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = '#5b3a1a'; ctx.font = `${Math.round(lh * 0.66)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(GOOD_BY_ID[id].name, 0, -fh * 0.83 + lh * 0.54);
}
function fridgeArt(ctx, id, w, h) {
  const r = Math.min(w * 0.2, h * 0.42);
  const upright = id === 'milk' || id === 'fishcake' || id === 'hotdog' || id === 'lollipop' || id === 'icecream';
  [[0, -0.74, 0, 1.0], [-0.3, -0.64, -0.12, 0.92], [0.3, -0.64, 0.14, 0.92]].forEach(([dx, dy, rot, k]) => drawGood(ctx, id, dx * w, dy * h, r * k, upright ? rot * 0.4 : rot));
  const lw = Math.min(w * 0.7, h * 1.4), lh = h * 0.28;
  ctx.fillStyle = '#fef08a'; shadowOn(ctx, 3, 1, 'rgba(0,0,0,0.2)'); ctx.beginPath(); ctx.roundRect(-lw / 2, -lh * 1.08, lw, lh, lh * 0.2); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = '#1e3a8a'; ctx.font = `${Math.round(lh * 0.66)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(GOOD_BY_ID[id].name, 0, -lh * 0.52);
}
const cellCache = new Map();
function drawCell(ctx, cell, glow, shakeK, pressK) {
  const { x, base, w, h, id, fridge } = cell;
  if (glow > 0) {
    ctx.save(); shadowOn(ctx, w * 0.25, 0, `rgba(250,204,21,${0.9 * glow})`);
    ctx.fillStyle = `rgba(254,240,138,${0.75 * glow})`; ctx.beginPath(); ctx.roundRect(x - w * 0.56, base - h * 1.12, w * 1.12, h * (fridge ? 1.42 : 1.18), w * 0.1); ctx.fill(); ctx.restore();
  }
  const key = `${id}|${fridge ? 1 : 0}|${Math.round(w)}|${Math.round(h)}`;
  let sp = cellCache.get(key);
  if (!sp) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = w * 1.3, chh = h * 1.7, oy = h * 1.3;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(cw * dpr); cv.height = Math.ceil(chh * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.translate(cw / 2, oy);
    (fridge ? fridgeArt : crateArt)(c, id, w, h);
    if (cellCache.size > 90) cellCache.clear();
    sp = { cv, cw, chh, oy }; cellCache.set(key, sp);
  }
  const sx = shakeK > 0 ? Math.sin(shakeK * 38) * w * 0.05 * shakeK : 0, sc = 1 - pressK * 0.06;
  ctx.save(); ctx.translate(x + sx, base); if (sc !== 1) ctx.scale(sc, sc);
  ctx.drawImage(sp.cv, -sp.cw / 2, -sp.oy, sp.cw, sp.chh); ctx.restore();
}

// ── 계산대 (앞쪽, 손님보다 나중에 그린다) + 바구니 더미
let fgCache = null;
function drawCounterFg(ctx, W, H, L) {
  const key = `${W}x${H}`;
  if (!fgCache || fgCache.key !== key) {
    const cv = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr); const r = rng(5);
    const x0 = L.counterX, y0 = L.counterY, d = L.d, pTop = y0 + d + 10;
    c.fillStyle = 'rgba(40,40,50,0.18)'; ell(c, x0 + 6, H, d * 0.6, H * 0.01); c.fill();
    // 윗면 (나무)
    shadowOn(c, 14, 4, 'rgba(40,30,20,0.3)');
    c.fillStyle = lg(c, 0, y0, 0, y0 + d, [[0, '#f0d3a6'], [1, '#d8ae75']]); c.beginPath(); c.roundRect(x0, y0, W - x0 + 20, d, [d * 0.25, 0, 0, 0]); c.fill(); shadowOff(c);
    c.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const y = y0 + 3 + r() * (d - 6); c.strokeStyle = `rgba(120,70,25,${0.08 + r() * 0.1})`; c.beginPath(); c.moveTo(x0 + d * 0.2, y); c.bezierCurveTo(x0 + (W - x0) * 0.3, y + (r() - 0.5) * 5, x0 + (W - x0) * 0.7, y + (r() - 0.5) * 5, W, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x0 + d * 0.2, y0, W - x0, 2);
    c.fillStyle = lg(c, 0, y0 + d, 0, pTop, [[0, '#a8743e'], [1, '#8a5a2c']]); c.fillRect(x0, y0 + d, W - x0, 10);
    // 앞판 (가게 색: 초록 + 주황 줄)
    c.fillStyle = lg(c, 0, pTop, 0, H, [[0, '#22c55e'], [1, '#15803d']]); c.fillRect(x0 + 4, pTop, W - x0, H - pTop);
    c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(x0 + 4, pTop, W - x0, 6);
    c.fillStyle = '#fb923c'; c.fillRect(x0 + 4, pTop + (H - pTop) * 0.1, W - x0, Math.max(4, (H - pTop) * 0.06));
    c.fillStyle = lg(c, x0, 0, x0 + d * 0.3, 0, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(x0 + 4, pTop, d * 0.3, H - pTop);
    // 카운터 진열장 (점원 쪽): 틀 + 따뜻한 불빛 안쪽 + 선반
    const R = caseRect(L), rh = (R.y1 - R.y0) / L.caseRows;
    shadowOn(c, 8, 2, 'rgba(0,0,0,0.3)'); c.fillStyle = '#334155'; c.beginPath(); c.roundRect(R.x0 - 8, R.y0 - 8, R.x1 - R.x0 + 16, R.y1 - R.y0 + 12, 10); c.fill(); shadowOff(c);
    c.fillStyle = lg(c, 0, R.y0, 0, R.y1, [[0, '#fffbeb'], [1, '#fed7aa']]); c.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    c.fillStyle = 'rgba(255,255,255,0.9)'; shadowOn(c, 8, 0, 'rgba(253,186,116,1)'); c.fillRect(R.x0 + 6, R.y0 + 2, R.x1 - R.x0 - 12, 4); shadowOff(c);
    for (let row = 0; row < L.caseRows; row++) { const by = R.y0 + rh * (row + 1) - rh * 0.12; c.fillStyle = lg(c, 0, by, 0, by + rh * 0.06, [[0, '#e2e8f0'], [1, '#94a3b8']]); c.fillRect(R.x0, by, R.x1 - R.x0, rh * 0.06); }
    c.strokeStyle = 'rgba(51,65,85,0.25)'; c.lineWidth = 2; for (let k = 1; k < L.caseCols; k++) { const x = R.x0 + (R.x1 - R.x0) * k / L.caseCols; c.beginPath(); c.moveTo(x, R.y0); c.lineTo(x, R.y1); c.stroke(); }
    // 바구니 더미 (문 옆 바닥, 빨간 장바구니)
    const bx = L.land ? W * 0.07 : W * 0.09, by = H - (L.land ? H * 0.03 : H * 0.03), bw = L.land ? W * 0.075 : W * 0.15, bh = bw * 0.5;
    for (let i = 3; i >= 0; i--) {
      const y = by - i * bh * 0.22;
      c.fillStyle = i ? '#dc2626' : '#ef4444'; shadowOn(c, 6, 2, 'rgba(0,0,0,0.2)');
      c.beginPath(); c.moveTo(bx - bw / 2, y - bh); c.lineTo(bx + bw / 2, y - bh); c.lineTo(bx + bw * 0.4, y); c.lineTo(bx - bw * 0.4, y); c.closePath(); c.fill(); shadowOff(c);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(bx - bw / 2, y - bh, bw, bh * 0.08);
      if (!i) { c.fillStyle = 'rgba(120,10,10,0.35)'; for (let k = 0; k < 4; k++) c.fillRect(bx - bw * 0.32 + k * bw * 0.18, y - bh * 0.72, bw * 0.1, bh * 0.45); }
    }
    fgCache = { key, cv };
  }
  ctx.drawImage(fgCache.cv, 0, 0, W, H);
}
// 카운터 진열장 유리 + 이름표 (물건 위에 덮는다)
function drawCaseGlass(ctx, L) {
  const R = caseRect(L), w = R.x1 - R.x0, h = R.y1 - R.y0;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(R.x0, R.y0, w, h);
  ctx.beginPath(); ctx.rect(R.x0, R.y0, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let k = 0; k < 3; k++) { const x = R.x0 + w * (0.12 + k * 0.33); ctx.beginPath(); ctx.moveTo(x, R.y0); ctx.lineTo(x + w * 0.05, R.y0); ctx.lineTo(x - w * 0.03, R.y1); ctx.lineTo(x - w * 0.08, R.y1); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const th = Math.min(L.H * 0.035, (R.y0 - L.counterY - L.d - 10) * 0.85), tw = th * 5.4;
  ctx.save(); ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.roundRect(R.x0 + 4, R.y0 - 8 - th, tw, th, [th * 0.3, th * 0.3, 0, 0]); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = `${Math.round(th * 0.7)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('카운터 간식', R.x0 + 4 + tw / 2, R.y0 - 8 - th / 2 + th * 0.05); ctx.restore();
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

// 💳 카드 (w = 가로 길이, flat < 1 이면 카운터에 누운 모습)
const CARD_COLS = [['#60a5fa', '#1d4ed8'], ['#f472b6', '#be185d'], ['#34d399', '#047857'], ['#fbbf24', '#d97706'], ['#a78bfa', '#6d28d9']];
function drawCard(ctx, x, y, w, rot, col, flat = 1, alpha = 1) {
  const h = w * 0.63;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, flat); if (alpha < 1) ctx.globalAlpha *= alpha;
  shadowOn(ctx, w * 0.08, w * 0.04);
  ctx.fillStyle = lg(ctx, -w / 2, -h / 2, w / 2, h / 2, [[0, col[0]], [1, col[1]]]); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.07); ctx.fill(); shadowOff(ctx);
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.07); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.1); ctx.bezierCurveTo(-w * 0.1, -h * 0.2, w * 0.15, h * 0.5, w / 2, h * 0.05); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = lg(ctx, -w * 0.36, -h * 0.2, -w * 0.18, h * 0.08, [[0, '#fff1b8'], [0.5, '#e8b931'], [1, '#b8860b']]); ctx.beginPath(); ctx.roundRect(-w * 0.37, -h * 0.2, w * 0.19, h * 0.27, w * 0.025); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,0,0.45)'; ctx.lineWidth = Math.max(1, w * 0.008); ctx.beginPath(); ctx.moveTo(-w * 0.37, -h * 0.065); ctx.lineTo(-w * 0.18, -h * 0.065); ctx.moveTo(-w * 0.275, -h * 0.2); ctx.lineTo(-w * 0.275, h * 0.07); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let gI = 0; gI < 4; gI++) for (let k = 0; k < 3; k++) { ell(ctx, -w * 0.38 + gI * w * 0.2 + k * w * 0.045, h * 0.27, w * 0.014, w * 0.014); ctx.fill(); }
  drawHeart(ctx, w * 0.33, -h * 0.2, w * 0.1, 'rgba(255,255,255,0.92)');
  gloss(ctx, -w * 0.15, -h * 0.3, w * 0.3, h * 0.08, 0.35, -0.1);
  ctx.restore();
}
// 카드 단말기 (앞모습, 위에 카드 꽂는 틈) base = 아래 y, T = 폭, st = 'idle'|'proc'|'ok'
const termSlotY = (base, T) => base - T * 1.5;
function drawTerminal(ctx, x, base, T, t, st, k) {
  if (k <= 0.01) return;
  const w = T, h = T * 1.5;
  ctx.save(); ctx.translate(x, base); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(30,20,10,0.22)'; ell(ctx, 0, 0, w * 0.6, w * 0.08); ctx.fill();
  shadowOn(ctx, w * 0.12, w * 0.05);
  ctx.fillStyle = lg(ctx, -w / 2, 0, w / 2, 0, [[0, '#334155'], [0.5, '#475569'], [1, '#1e293b']]); ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, w * 0.14); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = '#0b1220'; ctx.beginPath(); ctx.roundRect(-w * 0.38, -h - w * 0.01, w * 0.76, w * 0.06, w * 0.03); ctx.fill();
  const sc = st === 'ok' ? ['#dcfce7', '#86efac'] : st === 'proc' ? ['#e0f2fe', '#7dd3fc'] : ['#f1f5f9', '#cbd5e1'];
  ctx.fillStyle = lg(ctx, 0, -h * 0.86, 0, -h * 0.52, [[0, sc[0]], [1, sc[1]]]); ctx.beginPath(); ctx.roundRect(-w * 0.38, -h * 0.86, w * 0.76, h * 0.34, w * 0.06); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (st === 'ok') { ctx.strokeStyle = '#16a34a'; ctx.lineWidth = w * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-w * 0.14, -h * 0.69); ctx.lineTo(-w * 0.03, -h * 0.6); ctx.lineTo(w * 0.16, -h * 0.78); ctx.stroke(); }
  else if (st === 'proc') { const nd = 1 + Math.floor(t * 4) % 3; for (let i = 0; i < 3; i++) { ctx.fillStyle = i < nd ? '#0369a1' : 'rgba(3,105,161,0.25)'; ell(ctx, (i - 1) * w * 0.17, -h * 0.69, w * 0.055, w * 0.055); ctx.fill(); } }
  else { ctx.fillStyle = '#475569'; ctx.font = `${Math.round(w * 0.26)}px ${JUA}`; ctx.fillText('카드', 0, -h * 0.68); }
  for (let i = 0; i < 9; i++) { const bx = (i % 3 - 1) * w * 0.24, by = -h * 0.4 + Math.floor(i / 3) * h * 0.11; ctx.fillStyle = i === 8 ? '#22c55e' : i === 6 ? '#ef4444' : '#cbd5e1'; ctx.beginPath(); ctx.roundRect(bx - w * 0.09, by - h * 0.035, w * 0.18, h * 0.07, w * 0.03); ctx.fill(); }
  gloss(ctx, -w * 0.2, -h * 0.8, w * 0.15, h * 0.04, 0.4);
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

// 말풍선: 물건 그림(담은 것 ✔) + 글자, 또는 하트
function drawBubble(ctx, L, x, y, icons, label, heart, popK, t) {
  const ir = L.S * (L.land ? 0.12 : 0.13), n = icons.length, gap = ir * 2.5;
  const bw = heart ? ir * 3.4 : Math.max(n * gap + ir * 0.8, label.length > 4 ? ir * 5.2 : ir * 3), bh = ir * 3.2;
  let bx = x, flip = false;
  if (bx + bw > L.W - 8) { bx = x - L.S * 0.76 - bw; flip = true; }
  const by = y;
  ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(popK, popK); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
  shadowOn(ctx, 12, 4, 'rgba(0,0,0,0.18)'); ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh * 0.35); ctx.fill();
  ctx.beginPath();
  if (flip) { ctx.moveTo(bx + bw - bh * 0.25, by + bh * 0.7); ctx.lineTo(bx + bw + bh * 0.22, by + bh * 1.05); ctx.lineTo(bx + bw - bh * 0.5, by + bh * 0.95); }
  else { ctx.moveTo(bx + bh * 0.25, by + bh * 0.7); ctx.lineTo(bx - bh * 0.22, by + bh * 1.05); ctx.lineTo(bx + bh * 0.5, by + bh * 0.95); }
  ctx.fill(); shadowOff(ctx);
  if (heart) drawHeart(ctx, bx + bw / 2, by + bh * 0.55, ir * 1.1 * (1 + Math.sin(t * 6) * 0.08), '#f472b6');
  else {
    icons.forEach((ic, i) => {
      const cx = bx + bw / 2 + (i - (n - 1) / 2) * gap, cy = by + ir * 1.25;
      drawGood(ctx, ic.id, cx, cy, ir, 0, ic.done ? 0.35 : 1);
      if (ic.done) { ctx.fillStyle = '#22c55e'; ell(ctx, cx + ir * 0.55, cy + ir * 0.5, ir * 0.42, ir * 0.42); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = ir * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + ir * 0.36, cy + ir * 0.52); ctx.lineTo(cx + ir * 0.5, cy + ir * 0.68); ctx.lineTo(cx + ir * 0.76, cy + ir * 0.34); ctx.stroke(); }
    });
    ctx.fillStyle = '#9a3412'; ctx.font = `${Math.round(ir * 0.75)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + ir * 2.75);
  }
  ctx.restore();
  return { x0: bx - 10, x1: bx + bw + 10, y0: by - 10, y1: by + bh + 10 };
}

// ─────────────────────────────── 화면 ───────────────────────────────
//  손님 c.state: enter(문에서 나옴) → walk ↔ pick(매대에서 혼자 고르기) → queue(줄 서기) → counter(계산) → walk(문으로) → exit
//  g.phase (아이가 할 일): none | ask(카운터 물건 건네기) | thanks | scan | pay | card | bye
const makeGame = () => ({ stock: arrangeStore(), caseStock: arrangeCounter(), custs: [], uid: 0, lastGuest: null, nextSpawnT: 0.8,
  task: null, phase: 'none', phaseT: 0, t: 0, served: 0, fly: [], coinsOut: [], parts: [], coins: loadShop().coins,
  help: false, helpSaid: false, lastAct: 0, lastWrongSay: -9, shake: null, press: null, doorT: -9, doorUntil: -9,
  regT: -9, scanned: 0, scanFly: null, beepT: -9, receiptT: null, drawerOpen: false, drawerT: -9, coinsIn: 0, card: null, cardN: 0, termT: -9, payBy: 'cash',
  bubble: null, L: null, cells: [], caseCells: [], timers: [] });

export default function ShopGame({ audio, speak }) {
  const canvasRef = useRef(null);
  const G = useRef(null);
  const [ui, setUi] = useState({ phase: 'none', guest: null, lines: '', cardSt: null, coins: 0, land: true, nc: 0 });
  const sync = () => {
    const g = G.current, c = g.task && g.task.c;
    setUi({ phase: g.phase, guest: c ? c.id : null, lines: g.phase === 'ask' && c ? c.want.lines.map(l => `${l.item}:${l.n}`).join(',') : '', cardSt: g.card ? g.card.state : null, coins: g.coins, land: g.L ? g.L.land : true, nc: g.custs.length });
  };
  const later = (fn, ms) => { const g = G.current; const id = setTimeout(() => { g.timers = g.timers.filter(x => x !== id); fn(); }, ms); g.timers.push(id); };
  const say = (text) => { if (speak && text) speak(text); };
  const talk = (c, sec) => { if (c) c.mouthUntil = G.current.t + sec; };
  const sparkle = (x, y, n) => { const g = G.current; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; g.parts.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, born: g.t, life: 0.6 }); } };
  const hearts = (x, y, n) => { const g = G.current; for (let i = 0; i < n; i++) g.parts.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 80, y, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, born: g.t + i * 0.1, life: 2.2 }); };

  // ── 손님 들어오기 ──
  const openDoor = () => { const g = G.current; if (g.t > g.doorUntil + 0.4) g.doorT = g.t; g.doorUntil = g.t + 1.5; };
  const spawn = () => {
    const g = G.current, L = g.L; if (!L || g.custs.length >= 2) return;
    const ids = KITCHEN_GUESTS.map(k => k.id).filter(id => id !== g.lastGuest && !g.custs.some(c => c.id === id));
    const id = ids[Math.floor(Math.random() * ids.length)]; g.lastGuest = id;
    const v = makeVisit(id);
    const c = { uid: ++g.uid, id, steps: v.steps, step: 0, payBy: v.payBy, basket: [], askGot: [], want: v.ask, xf: L.doorX / L.W, txf: 0, dep: Math.random(), dir: 1,
      state: 'enter', t0: g.t, wt: 0, goal: null, happyUntil: 0, mouthUntil: 0, bkOn: false, bkBack: false, bkT: -9, px: L.doorX, py: L.laneY, sc: 1 };
    g.custs.push(c); openDoor();
    audio.playXylophone(1318.5, 0.5); setTimeout(() => audio.playXylophone(1046.5, 0.6), 230);   // 딩동
    if (!g.task) { say(VOICE.shopWelcome(GUEST_BY_ID[id])); talk(c, 2.2); }
    g.nextSpawnT = g.t + 12 + Math.random() * 8;
    sync();
  };
  const walkTo = (c, x, goal) => { c.state = 'walk'; c.txf = x / G.current.L.W; c.goal = goal; };
  const advance = (c) => {
    const g = G.current, L = g.L, s = c.steps[c.step];
    if (s) { const cell = g.cells.find(k => k.id === s.item); walkTo(c, cell ? cell.x + (Math.random() - 0.5) * cell.w * 0.3 : L.queueX, 'self'); return; }
    if (!g.task) { g.task = { kind: 'counter', c }; walkTo(c, L.gx, 'counter'); } else walkTo(c, L.queueX, 'queue');
  };
  const arrived = (c) => {
    const g = G.current;
    if (c.goal === 'self') { c.state = 'pick'; c.t0 = g.t; c.happyUntil = g.t + 1.0; later(() => selfPick(c), 380); }
    else if (c.goal === 'queue') c.state = 'queue';
    else if (c.goal === 'counter') startCounter(c);
    else if (c.goal === 'door') { c.state = 'exit'; c.t0 = g.t; openDoor(); }
  };
  const flyTo = (c, cell, ask) => {
    const g = G.current;
    const slot = c.basket.length + g.fly.filter(f => f.c === c).length;
    g.press = { id: cell.id, t0: g.t };   // ask = 카운터 진열장 → 계산대 위 바구니
    g.fly.push({ id: cell.id, c, ask, slot, x0: cell.x, y0: cell.base - cell.h * 0.6, t0: g.t, dur: 0.65 });
  };
  // 손님이 혼자 고르기
  const selfPick = (c) => {
    const g = G.current, s = c.steps[c.step], cell = s && g.cells.find(k => k.id === s.item);
    if (!cell) { c.step += 1; advance(c); return; }
    audio.playPopSound(); flyTo(c, cell, false);
  };
  const landItem = (f) => {
    const c = f.c;
    c.basket.push(f.id);
    const bk = basketPos(c);
    if (!f.ask) {
      audio.playXylophone(783.99 + c.basket.length * 120, 0.4); sparkle(bk.x, bk.y - bk.r * 0.4, 5);
      later(() => { c.step += 1; advance(c); }, 550);
      return;
    }
    c.askGot.push(f.id);
    const k = c.askGot.length;
    audio.playXylophone([523.25, 659.25, 783.99][k - 1] || 1046.5, 0.6);
    say(VOICE.shopCount(k)); sparkle(bk.x, bk.y - bk.r * 0.4, 8);
    if (k >= c.want.n) later(() => finishAsk(c), 750);
    sync();
  };

  // ── 계산대에서 부탁: "그리고 호빵 한 개 주세요!" → 카운터 진열장에서 콕 → 계산대 위 바구니로 ──
  const asker = () => { const g = G.current; return g.task && g.task.kind === 'counter' && g.phase === 'ask' ? g.task.c : null; };
  const needOf = (id) => { const c = asker(), l = c && c.want.lines.find(x => x.item === id); return l ? l.n : 0; };
  const haveOf = (id) => { const g = G.current, c = asker(); if (!c) return 0; return c.askGot.filter(x => x === id).length + g.fly.filter(f => f.c === c && f.ask && f.id === id).length; };
  const nextWant = () => { const c = asker(), l = c.want.lines.find(x => haveOf(x.item) < x.n); return (l || c.want.lines[0]).item; };
  const sayAsk = (c) => {
    const w = c.want;
    if (w.lines.length > 1) { say(VOICE.shopAsk2(GOOD_BY_ID[w.lines[0].item], GOOD_BY_ID[w.lines[1].item])); talk(c, 2.6); }
    else { say(VOICE.shopAsk(GOOD_BY_ID[w.item], w.n)); talk(c, 1.8); }
  };
  const pick = (cell) => {
    const g = G.current, c = asker(); if (!c) return;
    g.lastAct = g.t;
    const need = needOf(cell.id);
    if (!need || haveOf(cell.id) >= need) {
      g.shake = { id: cell.id, t0: g.t }; g.help = true;
      audio.playFreq(260, 'triangle', 0.14, 0.35);
      if (g.t - g.lastWrongSay > 1.8) {
        g.lastWrongSay = g.t;
        say(need ? VOICE.shopFull(GOOD_BY_ID[cell.id]) : VOICE.shopWrong(GOOD_BY_ID[cell.id], GOOD_BY_ID[nextWant()])); talk(c, 2.2);
      }
      return;
    }
    if (c.askGot.length + g.fly.filter(f => f.c === c && f.ask).length >= c.want.n) return;
    audio.playPopSound(); flyTo(c, cell, true);
  };
  const finishAsk = (c) => {
    const g = G.current; if (g.phase !== 'ask') return;
    g.phase = 'thanks'; g.help = false;
    say(VOICE.shopThanks()); talk(c, 1.2); audio.playYum();
    c.happyUntil = g.t + 1.6; hearts(c.px, c.py - g.L.S * 1.1, 5);
    sync();
    later(() => startScan(c), 1500);
  };

  // ── 계산대: 바구니를 올려놓음 → 하나씩 콕 삑 → 영수증 → 현금(서랍·동전) / 카드 ──
  const startCounter = (c) => {
    const g = G.current;
    g.task = { kind: 'counter', c }; c.state = 'counter'; c.bkOn = true; c.bkBack = false; c.bkT = g.t;
    g.scanned = 0; g.scanFly = null; g.receiptT = null; g.card = null; g.coinsOut = []; g.coinsIn = 0; g.payBy = c.payBy;
    g.help = false; g.lastAct = g.t;
    if (g.drawerOpen) { g.drawerOpen = false; g.drawerT = g.t; }
    audio.playNoise(0.08, 0.2, 600);
    if (c.want) {   // 카운터 물건도 달라고 한다
      g.phase = 'ask'; g.phaseT = g.t + 0.5; c.askGot = []; g.helpSaid = false;
      later(() => { if (g.phase === 'ask') { audio.playFreq(880, 'sine', 0.08, 0.3); g.lastAct = g.t; sayAsk(c); } }, 500);
      sync();
    } else startScan(c);
  };
  const startScan = (c) => {
    const g = G.current;
    g.phase = 'scan'; g.phaseT = g.t; g.scanned = 0; g.lastAct = g.t; g.help = false;
    say(g.served < 3 ? VOICE.shopScan() : VOICE.shopScanShort()); talk(c, g.served < 3 ? 2.6 : 1.2);
    sync();
  };
  const counterCust = () => { const g = G.current; return g.task && g.task.kind === 'counter' && g.task.c.state === 'counter' ? g.task.c : null; };
  const scanOne = () => {
    const g = G.current, c = counterCust();
    if (!c || g.phase !== 'scan' || g.scanFly || g.scanned >= c.basket.length || g.t - c.bkT < 0.45) return;
    g.lastAct = g.t;
    g.scanFly = { idx: c.basket.length - 1 - g.scanned, t0: g.t, beeped: false };
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
    if (g.payBy === 'card') { later(startCard, 250); return; }
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
    const g = G.current, c = counterCust(); if (g.phase !== 'scan' || !c) return;
    g.phase = 'pay'; g.phaseT = g.t; c.happyUntil = g.t + 1.6; g.help = false;
    audio.playYum(); hearts(g.L.gx, g.L.laneY - g.L.S * 1.1, 5);
    say(g.served < 3 ? VOICE.shopPay() : VOICE.shopPayShort()); talk(c, g.served < 3 ? 3.2 : 1.6);
    g.coinsOut = Array.from({ length: c.basket.length }, (_, i) => ({ i, state: 'drop', t0: g.t + 0.6 + i * 0.3 }));
    sync();
  };
  const startCard = () => {
    const g = G.current, c = counterCust(); if (g.phase !== 'scan' || !c) return;
    g.phase = 'card'; g.phaseT = g.t; g.termT = g.t; c.happyUntil = g.t + 1.4; g.help = false;
    g.card = { state: 'drop', t0: g.t + 0.6, col: CARD_COLS[c.uid % CARD_COLS.length] };
    audio.playYum(); audio.playPopSound();
    say(g.cardN < 2 ? VOICE.shopCard() : VOICE.shopCardShort()); talk(c, g.cardN < 2 ? 2.8 : 1.2);
    g.cardN += 1;
    sync();
  };
  const tapCard = () => {
    const g = G.current, cd = g.card; g.lastAct = g.t;
    if (cd.state === 'wait') { cd.state = 'insert'; cd.t1 = g.t; audio.playFreq(900, 'sine', 0.06, 0.3); sync(); }
    else if (cd.state === 'ready') { cd.state = 'return'; cd.t1 = g.t; audio.playPopSound(); sync(); }
  };
  const cardIn = () => {
    const g = G.current, cd = g.card, c = counterCust();
    cd.state = 'proc'; cd.t1 = g.t;
    audio.playNoise(0.06, 0.3, 1500);
    [350, 700, 1050].forEach(ms => later(() => audio.playFreq(1300, 'sine', 0.05, 0.25), ms));
    later(() => {
      cd.state = 'ok'; cd.t1 = g.t; g.regT = g.t; g.receiptT = g.t;
      audio.playXylophone(1567.98, 0.6); setTimeout(() => audio.playXylophone(2093, 0.6), 160);
      audio.playNoise(0.8, 0.12, 3500, 2);
      say(VOICE.shopCardOk()); talk(c, 1.2);
      const L = g.L; sparkle(L.bx + L.br * 0.3, L.counterY - L.br * 0.2, 10);
      sync();
      later(() => { cd.state = 'ready'; cd.t1 = g.t; audio.playFreq(700, 'triangle', 0.08, 0.3); sync(); }, 1500);
    }, 1400);
    sync();
  };
  const cardBack = () => {
    const g = G.current, c = counterCust(); g.card.state = 'gone';
    if (!c) return;
    c.happyUntil = g.t + 2; audio.playYum(); hearts(g.L.gx, g.L.laneY - g.L.S * 1.1, 6);
    g.served += 1;
    endCounter(c, 700);
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
    const g = G.current, c = counterCust(); g.served += 1;
    const full = g.coins % PIGGY_FULL === 0;
    later(() => { g.drawerOpen = false; g.drawerT = g.t; audio.playFreq(330, 'triangle', 0.1, 0.4); audio.playNoise(0.1, 0.25, 700); }, 450);
    if (full) later(() => { audio.playFanfare(); say(VOICE.shopPiggy()); g.regT = g.t; const L = g.L; hearts(L.px, L.counterY - L.pr, 10); sparkle(L.px, L.counterY - L.pr, 16); }, 900);
    if (c) endCounter(c, full ? 3800 : 1000);
  };
  // 계산 끝: 바구니를 다시 들고 인사 → 문으로
  const endCounter = (c, wait) => {
    const g = G.current;
    later(() => {
      g.phase = 'bye'; g.phaseT = g.t; c.happyUntil = g.t + 2; c.bkOn = false; c.bkBack = true; c.bkT = g.t;
      say(VOICE.shopBye()); talk(c, 1.5); sync();
      later(() => { g.task = null; g.phase = 'none'; g.card = null; g.coinsOut = []; walkTo(c, g.L.doorX, 'door'); sync(); }, 1300);
    }, wait);
  };

  // 바구니 위치: 손에 든 모습 ↔ 계산대 위 (옮기는 중엔 사이)
  const handBk = (c) => { const L = G.current.L, S = L.S * c.sc; return { x: c.px + c.dir * S * 0.4, y: c.py - S * 0.2, r: S * 0.26 }; };
  const counterBk = () => { const L = G.current.L; return { x: L.bx, y: L.counterY + L.d * 0.45 - L.br * 0.55, r: L.br }; };
  const basketPos = (c) => {
    const g = G.current, k = easeOut((g.t - c.bkT) / 0.45);
    if (!c.bkOn && !c.bkBack) return handBk(c);
    const a = c.bkOn ? handBk(c) : counterBk(), b = c.bkOn ? counterBk() : handBk(c);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * a.r * 0.8, r: a.r + (b.r - a.r) * k };
  };

  const resetAll = () => {
    const g = G.current; if (!g) return;
    g.timers.forEach(clearTimeout); g.timers = [];
    const fresh = makeGame(); fresh.coins = g.coins; fresh.L = g.L; fresh.t = g.t; fresh.nextSpawnT = g.t + 0.3; fresh.cardN = g.cardN; fresh.served = g.served;
    G.current = fresh; sync();
  };
  useEffect(() => { G.current = makeGame(); return () => { G.current.timers.forEach(clearTimeout); G.current.timers = []; }; }, []);

  // ── 터치 ──
  const custAt = (x, y) => {
    const g = G.current, L = g.L;
    return [...g.custs].sort((a, b) => b.py - a.py).find(c => c.state !== 'exit' && Math.abs(x - c.px) < L.S * c.sc * 0.42 && y > c.py - L.S * c.sc * 1.2 && y < c.py + 4);
  };
  const onDown = (e) => {
    const g = G.current; if (!g || !g.L) return;
    const rect = canvasRef.current.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, L = g.L;
    if (g.phase === 'scan') {
      const c = counterCust(), bk = c && basketPos(c), rb = L.counterY + L.d * 0.55;
      const inBasket = bk && Math.abs(x - bk.x) < L.br * 1.25 && y > bk.y - L.br * 1.5 && y < bk.y + L.br * 0.8;
      const inReg = Math.abs(x - L.px) < L.pr * 1.1 && y > rb - L.pr * 1.7 && y < rb + L.pr * 0.2;
      if (inBasket || inReg) { scanOne(); return; }
    } else if (g.phase === 'card') {
      const cd = g.card;
      if (cd && (cd.state === 'wait' || cd.state === 'ready') && cd.x != null && Math.hypot(x - cd.x, y - cd.y) < Math.max(L.br * 0.75, 50)) { tapCard(); return; }
    } else if (g.phase === 'pay') {
      let best = null, bd = 1e9;
      g.coinsOut.forEach(c => { if (c.state !== 'wait') return; const dd = Math.hypot(x - c.x, y - c.y); if (dd < Math.max(c.r * 1.9, 46) && dd < bd) { bd = dd; best = c; } });
      if (best) { takeCoin(best); return; }
    }
    const hitCell = (c) => x > c.x - c.w * 0.55 && x < c.x + c.w * 0.55 && y > c.base - c.h * 1.1 && y < c.base + c.h * (c.fridge ? 0.3 : 0.12);
    const ccell = g.caseCells.find(hitCell);
    if (ccell) {
      if (g.phase === 'ask') pick(ccell);
      else { g.shake = { id: ccell.id, t0: g.t }; audio.playFreq(520 + ccell.i * 20, 'sine', 0.08, 0.25); }
      return;
    }
    const cell = g.cells.find(hitCell);
    if (cell) { g.shake = { id: cell.id, t0: g.t }; audio.playFreq(520 + cell.i * 25, 'sine', 0.08, 0.25); return; }
    const b = g.bubble;
    if (g.phase === 'ask' && b && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) { g.lastAct = g.t; sayAsk(asker()); return; }
    const c = custAt(x, y);
    if (c) {
      if (g.phase === 'ask' && asker() === c) { g.lastAct = g.t; sayAsk(c); return; }
      c.happyUntil = g.t + 1.2; audio.playPopSound(); hearts(c.px, c.py - L.S * c.sc * 1.1, 3);
    }
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = performance.now(); const t0 = last;
    const loop = (now) => {
      const g = G.current;
      if (!g) { raf = requestAnimationFrame(loop); return; }
      cv.__g = g;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t = (now - t0) / 1000; const t = g.t;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (W > 0 && H > 0) {
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const L = layout(W, H); const wasLand = g.L && g.L.land; g.L = L;
        if (wasLand !== L.land) sync();
        g.cells = shelfCells(L, g.stock); g.caseCells = caseCells(L, g.caseStock);

        // ── 손님 움직이기 ──
        if (t > g.nextSpawnT && g.custs.length < 2) spawn();
        if (!g.custs.length && g.nextSpawnT > t + 3) g.nextSpawnT = t + 3;
        g.custs.forEach(c => {
          if (c.state === 'enter' && t - c.t0 >= 1.0) advance(c);
          else if (c.state === 'walk') {
            const v = L.speed * dt, d = c.txf - c.xf;
            if (Math.abs(d) <= v) { c.xf = c.txf; arrived(c); }
            else { c.xf += Math.sign(d) * v; c.dir = Math.sign(d); c.wt += dt; }
          } else if (c.state === 'queue' && !g.task) { g.task = { kind: 'counter', c }; walkTo(c, L.gx, 'counter'); }
        });
        const nBefore = g.custs.length;
        g.custs = g.custs.filter(c => !(c.state === 'exit' && t - c.t0 >= 1.0));
        if (g.custs.length !== nBefore) sync();
        // 화면 위치
        g.custs.forEach(c => {
          const ly = L.laneY + c.dep * L.laneD, base = 0.97 + c.dep * 0.06;
          let x = c.xf * W, y = ly, sc = base;
          if (c.state === 'enter' || c.state === 'exit') {
            const k = c.state === 'enter' ? easeOut((t - c.t0) / 1.0) : 1 - easeIn((t - c.t0) / 1.0);
            x = L.doorX; y = L.wallBot + (ly - L.wallBot) * k; sc = base * (0.62 + 0.38 * k);
          }
          c.px = x; c.py = y; c.sc = sc;
        });

        drawStore(ctx, W, H, L);
        drawSigns(ctx, L);
        const dk = t < g.doorUntil ? easeOut((t - g.doorT) / 0.35) : 1 - easeOut((t - g.doorUntil) / 0.45);
        drawDoor(ctx, L, clamp01(dk));

        // 가만히 있으면 찾을 물건이 반짝
        if (g.phase === 'ask' && !g.help && t - g.lastAct > 7) {
          g.help = true;
          if (!g.helpSaid) { g.helpSaid = true; say(VOICE.shopFind(GOOD_BY_ID[nextWant()])); talk(asker(), 2.5); }
        }

        // 진열 칸
        g.cells.forEach(cell => {
          const glow = 0;
          const sk = g.shake && g.shake.id === cell.id ? clamp01(1 - (t - g.shake.t0) / 0.5) : 0;
          const pr = g.press && g.press.id === cell.id ? clamp01(1 - (t - g.press.t0) / 0.2) : 0;
          drawCell(ctx, cell, glow, sk, pr);
          if (glow > 0) { ctx.save(); ctx.font = `${Math.round(cell.h * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👆', cell.x + cell.w * 0.3, cell.base - cell.h * 0.05 + Math.sin(t * 6) * cell.h * 0.06); ctx.restore(); }
        });
        L.units.forEach((U, u) => { if (SHOP_UNITS[u].kind === 'fridge') drawFridgeGlass(ctx, L, U); });

        // 손님 (가까운 쪽이 앞)
        [...g.custs].sort((a, b) => a.py - b.py).forEach(c => {
          const S = L.S * c.sc, walking = c.state === 'walk' || c.state === 'enter' || c.state === 'exit';
          const ph = walking ? (c.state === 'walk' ? c.wt : t) * 9 : 0;
          const hop = walking ? Math.abs(Math.sin(ph)) * S * 0.06 : 0, rot = walking ? Math.sin(ph) * 0.07 : 0;
          const happy = t < c.happyUntil, mouth = t < c.mouthUntil ? 0.15 + 0.2 * Math.abs(Math.sin(t * 13)) : 0;
          const jump = happy ? Math.abs(Math.sin(t * 6)) * S * 0.05 : 0;
          ctx.save(); ctx.globalAlpha = c.state === 'enter' ? clamp01((t - c.t0) / 0.25) : c.state === 'exit' ? clamp01((1 - (t - c.t0)) / 0.25) : 1;
          ctx.fillStyle = 'rgba(30,30,40,0.18)'; ell(ctx, c.px, c.py, S * 0.4, S * 0.07); ctx.fill();
          ctx.translate(c.px, c.py - hop - jump); ctx.rotate(rot);
          GUEST_FN[c.id](ctx, S, t, happy, mouth);
          ctx.restore();
          if (!c.bkOn && !c.bkBack) {
            const bk = handBk(c);
            ctx.save(); if (c.state === 'enter' || c.state === 'exit') ctx.globalAlpha = c.state === 'enter' ? clamp01((t - c.t0) / 0.25) : clamp01((1 - (t - c.t0)) / 0.25);
            drawBasket(ctx, bk.x, bk.y - hop - jump, bk.r, c.basket); ctx.restore();
          }
        });

        // 진열대 → 손님 바구니로 날아가는 물건
        g.fly = g.fly.filter(f => {
          const k = (t - f.t0) / f.dur; if (k < 0) return true;
          const bk = f.ask ? counterBk() : handBk(f.c), [dx, dy] = BASKET_SLOT[Math.min(f.slot, 2)], tx = bk.x + dx * bk.r, ty = bk.y + dy * bk.r;
          const kk = easeOut(k), x = f.x0 + (tx - f.x0) * kk, y = f.y0 + (ty - f.y0) * kk - Math.sin(clamp01(k) * Math.PI) * L.S * 0.35;
          drawGood(ctx, f.id, x, y, Math.max(bk.r * 0.4, L.S * (0.2 - 0.08 * kk)), k * 2);
          if (k >= 1) { landItem(f); return false; }
          return true;
        });

        // ── 계산대 ──
        drawCounterFg(ctx, W, H, L);
        g.caseCells.forEach(cell => {
          const glow = g.phase === 'ask' && g.help && needOf(cell.id) > haveOf(cell.id) ? 0.55 + 0.45 * Math.sin(t * 6) : 0;
          const sk = g.shake && g.shake.id === cell.id ? clamp01(1 - (t - g.shake.t0) / 0.5) : 0;
          const pr = g.press && g.press.id === cell.id ? clamp01(1 - (t - g.press.t0) / 0.2) : 0;
          drawCell(ctx, cell, glow, sk, pr);
          if (glow > 0) { ctx.save(); ctx.font = `${Math.round(cell.h * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👆', cell.x + cell.w * 0.32, cell.base - cell.h * 0.15 + Math.sin(t * 6) * cell.h * 0.06); ctx.restore(); }
        });
        drawCaseGlass(ctx, L);
        const cc = g.task && g.task.kind === 'counter' ? g.task.c : null, atC = cc && (cc.state === 'counter') ? cc : null;
        const nItems = atC ? atC.basket.length : 0;
        const pBase = L.counterY + L.d * 0.55;
        const pk = (t - g.regT) / 0.45, phop = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) : 0;
        const drk = clamp01((t - g.drawerT) / 0.3), drawerK = g.drawerOpen ? easeOut(drk) : 1 - easeOut(drk);
        const cst = g.card ? g.card.state : null;
        const screen = g.phase === 'scan' ? `삑 ${g.scanned}개` : g.phase === 'pay' ? `${g.coinsIn} / ${nItems}` : g.phase === 'card' ? (cst === 'proc' ? '결제 중' : cst === 'ok' || cst === 'ready' || cst === 'return' || cst === 'gone' ? '완료!' : '💳 카드') : `🪙 ${g.coins}`;
        drawRegister(ctx, L.px, pBase, L.pr, t, { flash: clamp01(1 - (t - g.beepT) / 0.35), drawer: drawerK, receipt: g.receiptT == null || !atC ? 0 : easeOut((t - g.receiptT) / 0.9), screen, hop: phop, coinsIn: g.coinsIn });

        // 계산대 위 바구니 (올려놓는 중·돌려받는 중 포함)
        g.custs.forEach(c => {
          if (!c.bkOn && !c.bkBack) return;
          const bk = basketPos(c), sf = c === atC ? g.scanFly : null;
          drawBasket(ctx, bk.x, bk.y, bk.r, c.basket, sf ? sf.idx : -1);
          if (c.bkBack && t - c.bkT >= 0.45) c.bkBack = false;
          if (c !== atC) return;
          if (sf) {
            const e = t - sf.t0, [dx, dy] = BASKET_SLOT[sf.idx], hx = bk.x + dx * bk.r, hy = bk.y + dy * bk.r;
            const [sx, sy] = regScanPos(L.px, pBase, L.pr), tx = sx, ty = sy - L.br * 0.35;
            let x, y;
            if (e < 0.4) { const k = easeOut(e / 0.4); x = hx + (tx - hx) * k; y = hy + (ty - hy) * k - Math.sin(k * Math.PI) * L.br * 0.6; }
            else if (e < 0.65) { x = tx + Math.sin((e - 0.4) * 40) * L.br * 0.03; y = ty; }
            else { const k = easeOut((e - 0.65) / 0.4); x = tx + (hx - tx) * k; y = ty + (hy - ty) * k - Math.sin(k * Math.PI) * L.br * 0.6; }
            if (e >= 0.42 && !sf.beeped) { sf.beeped = true; beep(); }
            drawGood(ctx, c.basket[sf.idx], x, y, L.br * 0.45, dx * 0.4);
            if (e >= 1.05) { g.scanFly = null; if (g.scanned >= c.basket.length) later(checkout, 300); }
          } else if (g.phase === 'scan' && g.scanned < c.basket.length && t - c.bkT > 0.45) {
            ctx.save(); ctx.font = `${Math.round(L.br * 0.55)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('👆', bk.x + L.br * 0.35, bk.y - L.br * 0.95 + Math.sin(t * 6) * L.br * 0.08); ctx.restore();
          }
        });

        // 동전
        const cr = Math.min(L.d * 0.36, L.br * 0.36);
        g.coinsOut.forEach(c => {
          const n = g.coinsOut.length, tx = L.bx - (n - 1) * cr * 1.35 + c.i * cr * 2.7 - L.br * 0.2, ty = L.counterY + L.d * 0.55;
          c.r = cr;
          if (c.state === 'drop') {
            const k = (t - c.t0) / 0.45; if (k < 0) return;
            const hx = L.gx + L.S * 0.2, hy = L.counterY - L.S * 0.3;
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

        // 💳 카드 단말기 + 카드
        {
          const T = L.br * 0.8, tX = L.bx + L.br * 0.36, tBase = L.counterY + L.d * 0.8, slotY = termSlotY(tBase, T), cw = L.br * 1.0;
          const termK = g.phase === 'card' ? easeOut((t - g.termT) / 0.35) : g.phase === 'bye' && g.payBy === 'card' ? 1 - easeOut((t - g.phaseT) / 0.3) : 0;
          const cd = g.card, restX = L.bx - L.br * 0.65, restY = L.counterY + L.d * 0.55;
          const hx = L.gx + L.S * 0.2, hy = L.counterY - L.S * 0.3;
          const inPos = (vis) => [tX, slotY - vis * cw + cw / 2];
          let front = null, behind = null;
          if (cd && g.phase === 'card') {
            if (cd.state === 'drop') {
              const k = (t - cd.t0) / 0.45;
              if (k >= 0) { const kk = easeOut(k); front = [hx + (restX - hx) * kk, hy + (restY - hy) * k * k - Math.sin(clamp01(k) * Math.PI) * L.S * 0.12, 0.25 * (1 - clamp01(k)), 1 - 0.3 * clamp01(k)]; }
              if (k >= 1) { cd.state = 'wait'; audio.playFreq(1000, 'sine', 0.05, 0.2); sync(); }
            } else if (cd.state === 'wait') {
              front = [restX, restY, 0, 0.7];
            } else if (cd.state === 'insert') {
              const k = (t - cd.t1) / 0.85;
              if (k < 0.55) { const kk = easeOut(k / 0.55), [ex, ey] = inPos(1.08); behind = [restX + (ex - restX) * kk, restY + (ey - restY) * kk - Math.sin(kk * Math.PI) * L.br * 0.5, -Math.PI / 2 * kk, 0.7 + 0.3 * kk]; }
              else { const kk = easeOut((k - 0.55) / 0.45), [ex, ey] = inPos(1.08 - 0.68 * kk); behind = [ex, ey, -Math.PI / 2, 1]; }
              if (k >= 1) cardIn();
            } else if (cd.state === 'proc' || cd.state === 'ok') {
              const [ex, ey] = inPos(0.4); behind = [ex, ey, -Math.PI / 2, 1];
            } else if (cd.state === 'ready') {
              const k = easeOut((t - cd.t1) / 0.3), [ex, ey] = inPos(0.4 + 0.25 * k); behind = [ex, ey + Math.sin(t * 5) * cw * 0.03, -Math.PI / 2, 1];
            } else if (cd.state === 'return') {
              const k = (t - cd.t1) / 0.6, kk = easeOut(k), [sx, sy] = inPos(0.65);
              front = [sx + (hx - sx) * kk, sy + (hy - sy) * kk - Math.sin(clamp01(k) * Math.PI) * L.br * 0.6, -Math.PI / 2 * (1 - kk), 1 - 0.3 * kk, 1 - clamp01((k - 0.75) / 0.25)];
              if (k >= 1) cardBack();
            }
          }
          if (behind) { drawCard(ctx, behind[0], behind[1], cw, behind[2], cd.col, behind[3]); cd.x = behind[0]; cd.y = behind[1]; }
          drawTerminal(ctx, tX, tBase, T, t, cd && cd.state === 'proc' ? 'proc' : cd && (cd.state === 'ok' || cd.state === 'ready' || cd.state === 'return' || cd.state === 'gone') ? 'ok' : 'idle', termK);
          if (front) { drawCard(ctx, front[0], front[1], cw, front[2], cd.col, front[3], front[4] == null ? 1 : front[4]); cd.x = front[0]; cd.y = front[1]; }
          if (cd && g.phase === 'card' && (cd.state === 'wait' || cd.state === 'ready') && cd.x != null) {
            ctx.save(); ctx.font = `${Math.round(L.br * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('👆', cd.x + cw * 0.35, cd.y + cw * (cd.state === 'wait' ? 0.45 : 0.55) + Math.sin(t * 6) * cw * 0.08); ctx.restore();
          }
        }

        // 말풍선: 부탁하는 손님(필요한 물건, 건넨 만큼 ✔) / 계산하는 손님(찍은 만큼 ✔ → 하트)
        g.bubble = null;
        const ac = asker();
        if (ac && g.phase === 'ask') {
          const S = L.S * ac.sc, icons = ac.want.lines.flatMap(l => Array.from({ length: l.n }, (_, j) => ({ id: l.item, done: j < ac.askGot.filter(x => x === l.item).length })));
          const label = ac.want.lines.length > 1 ? ac.want.lines.map(l => `${GOOD_BY_ID[l.item].name} ${l.n}`).join(' · ') : `${ac.want.n}개`;
          g.bubble = drawBubble(ctx, L, ac.px + S * 0.38, ac.py - S * 1.25, icons, label, false, easeOut((t - g.phaseT) / 0.35), t);
        } else if (atC && (g.phase === 'scan' || g.phase === 'pay' || g.phase === 'card')) {
          const S = L.S * atC.sc, icons = atC.basket.map((id, i) => ({ id, done: i >= atC.basket.length - g.scanned }));
          drawBubble(ctx, L, atC.px + S * 0.38, atC.py - S * 1.3, icons, `${atC.basket.length}개`, g.phase !== 'scan', 1, t);
        }

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
  const gu = ui.guest ? GUEST_BY_ID[ui.guest] : null, lines = ui.lines ? ui.lines.split(',').map(s => s.split(':')) : [];
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(120,60,20,0.6)', whiteSpace: 'nowrap' });
  const hint = ui.phase === 'ask' && lines.length > 1 ? `${lines.map(([id, n]) => `${GOOD_BY_ID[id].emoji} ${GOOD_BY_ID[id].name} ${n}개`).join(' + ')}를 콕! 바구니에 넣어요`
    : ui.phase === 'ask' && lines.length ? `${GOOD_BY_ID[lines[0][0]].emoji} ${GOOD_BY_ID[lines[0][0]].name} ${lines[0][1]}개를 콕! 바구니에 넣어 줘요`
    : ui.phase === 'thanks' ? '😊 고마워요!'
    : ui.phase === 'scan' ? '🧺 바구니를 콕! 계산대에서 삑~ 찍어요'
    : ui.phase === 'pay' ? '🪙 동전을 콕! 계산대 서랍에 넣어요'
    : ui.phase === 'card' ? (ui.cardSt === 'insert' || ui.cardSt === 'proc' ? '💳 결제하고 있어요...' : ui.cardSt === 'ok' ? '✅ 결제 완료!' : ui.cardSt === 'ready' || ui.cardSt === 'return' || ui.cardSt === 'gone' ? '💳 카드를 콕! 손님에게 돌려줘요' : '💳 카드를 콕! 단말기에 꽂아요')
    : ui.phase === 'bye' ? '👋 안녕히 가세요~'
    : ui.nc > 0 ? '🛒 손님들이 장을 보고 있어요' : '🚪 손님을 기다리고 있어요';
  const replay = () => { const g = G.current; if (!g) return; if (g.phase === 'ask') sayAsk(asker()); else if (g.phase === 'scan') say(VOICE.shopScanShort()); };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={() => { const g = G.current; if (g && g.custs.length < 2) spawn(); }} style={btn('#f6efe7', '#5c5248')}>🙋 손님 오세요</button>
        <button onClick={replay} style={btn('#ffffff', '#9a3412')}>🔊 다시 듣기</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#15803d', minWidth: '160px' }}>🛒 동물 마을 가게{gu ? ` · ${gu.name} 손님` : ''}</div>
        <button onClick={resetAll} style={btn('#f6efe7', '#5c5248')} title="가게를 처음부터">🔄</button>
        <div style={{ fontFamily: JUA, fontSize: '1.3rem', color: '#a16207', background: '#fef9c3', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 6px 14px -10px rgba(120,80,0,0.6)' }}>🪙 {ui.coins}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(21,128,61,0.5)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: '12%', right: '12%', top: '6px', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.2rem', color: '#7c2d12', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
      </div>
    </div>
  );
}
