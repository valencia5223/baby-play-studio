// ═════════════════════════════════════════════════════════════════════════════
// 🍳 요리 놀이 "동물 친구 식당": 동물 손님이 오면 메뉴(샌드위치·피자·과일 꼬치)를 골라 만들고, 접시를 손님에게 갖다 주면 냠냠 먹는다
//  - 캔버스 한 장 (왼쪽/위: 식당 카운터와 손님, 오른쪽/아래: 위에서 내려다본 주방 탁자 + 재료 칸)
//  - 음식은 실사 느낌으로 그라데이션·광택·질감을 넣어 그리고, 재료 그림은 처음 한 번만 그려 저장해 두고 복사한다(spriteCache)
//  - 손님 그림은 생일 파티의 앞을 보고 앉은 동물(판다·사자·고양이)을 빌려 쓰고, 토끼·곰은 여기서 같은 방식으로 그린다
//  - 실패는 없다: 재료를 누르거나 끌어다 놓으면 무조건 들어간다. 손님이 좋아하는 재료(fav)를 넣으면 더 기뻐한다
//  - 음성은 남성 아나운서 MP3 (VOICE.kitchen*, npm run voices)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { KITCHEN_GUESTS, GUEST_BY_ID, INGREDIENTS, KITCHEN_MENUS, MENU_BY_ID, SANDWICH_MAX, SKEWER_SLOTS, PIZZA_MAX, ICE_FLAVORS, ICE_MAX, PANCAKE_COUNT, KIMBAP_MAX, KIMBAP_SLICES, DECO_MAX } from './kitchenData.js';
import { drawPanda, drawLion, drawCat, sitBody, friendlyEyes, smileMouth } from './BirthdayParty.jsx';
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ─────────────────────────────── 그리기 도우미 ───────────────────────────────
const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rg = (c, x0, y0, r0, x1, y1, r1, stops) => { const g = c.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.01, r1)); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const shadowOn = (c, blur, oy = 0, col = 'rgba(40,20,5,0.28)') => { c.shadowColor = col; c.shadowBlur = blur; c.shadowOffsetX = 0; c.shadowOffsetY = oy; };
const shadowOff = (c) => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };
// 점 질감 (빵 기공·고기 결·씨앗 등): 지금 클립 안에 흩뿌린다
function speckle(c, seed, n, x0, y0, x1, y1, r0, r1, cols) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    c.fillStyle = cols[Math.floor(r() * cols.length)];
    ell(c, x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), r0 + r() * (r1 - r0), (r0 + r() * (r1 - r0)) * (0.6 + r() * 0.5), r() * 3);
    c.fill();
  }
}
// 윗면 광택
function gloss(c, x, y, rx, ry, a = 0.55, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, ry / rx);
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, rx, [[0, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]);
  c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}

// 재료 그림 저장소: key 마다 ref 크기로 한 번 그려 두고 크기만 바꿔 복사
const spriteCache = new Map();
function stamp(ctx, key, ref, box, fn, x, y, size, rot = 0, alpha = 1) {
  let cv = spriteCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(ref * box);
    const c = cv.getContext('2d'); c.translate(cv.width / 2, cv.height / 2);
    fn(c, ref);
    spriteCache.set(key, cv);
  }
  const sc = size / ref;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(cv, -cv.width / 2 * sc, -cv.height / 2 * sc, cv.width * sc, cv.height * sc);
  ctx.restore();
}

// ═══════════════ 샌드위치 층 (옆에서 본 모습, 폭 u, 가운데 0) ═══════════════
// th = 쌓을 때 차지하는 높이 (u 배)
const LAYER_TH = { breadBottom: 0.13, cheese: 0.035, ham: 0.045, lettuce: 0.045, tomato: 0.055, egg: 0.06, carrot: 0.045, honey: 0.025, bamboo: 0.045, meat: 0.09, fish: 0.085, acorn: 0.06, apple: 0.05, pepperoni: 0.04, pepper: 0.05, mushroom: 0.05, corn: 0.05, olive: 0.045, strawberry: 0.06, banana: 0.055, kiwi: 0.055, orange: 0.055 };
function lyBreadBottom(c, u) {
  const w = 0.5 * u, h = 0.13 * u;
  shadowOn(c, u * 0.04, u * 0.02);
  c.fillStyle = lg(c, 0, -h / 2, 0, h / 2, [[0, '#cf9250'], [0.5, '#b8763b'], [1, '#8a5124']]);
  c.beginPath(); c.roundRect(-w, -h / 2, 2 * w, h, u * 0.045); c.fill(); shadowOff(c);
  c.save();
  c.beginPath(); c.roundRect(-w + u * 0.022, -h / 2 + u * 0.02, 2 * w - u * 0.044, h - u * 0.045, u * 0.03); c.clip();
  c.fillStyle = lg(c, 0, -h / 2, 0, h / 2, [[0, '#fcebc8'], [1, '#e8cb92']]); c.fillRect(-w, -h, 2 * w, 2 * h);
  speckle(c, 11, 220, -w, -h / 2, w, h / 2, u * 0.002, u * 0.007, ['rgba(185,140,80,0.45)', 'rgba(205,165,105,0.4)', 'rgba(255,255,255,0.55)']);
  c.restore();
}
function lyBreadTop(c, u) {
  const w = 0.52 * u;
  shadowOn(c, u * 0.04, u * 0.02);
  c.fillStyle = lg(c, 0, -u * 0.17, 0, u * 0.07, [[0, '#e9b56b'], [0.45, '#c9843f'], [1, '#93551f']]);
  c.beginPath(); c.moveTo(-w, u * 0.07);
  c.bezierCurveTo(-w - u * 0.03, -u * 0.08, -w * 0.7, -u * 0.17, 0, -u * 0.17);
  c.bezierCurveTo(w * 0.7, -u * 0.17, w + u * 0.03, -u * 0.08, w, u * 0.07);
  c.closePath(); c.fill(); shadowOff(c);
  // 아래 단면 (속살)
  c.fillStyle = lg(c, 0, u * 0.03, 0, u * 0.07, [[0, '#fbe8c2'], [1, '#e9cc95']]);
  c.beginPath(); c.roundRect(-w + u * 0.025, u * 0.03, 2 * w - u * 0.05, u * 0.035, u * 0.015); c.fill();
  c.save(); c.beginPath(); c.roundRect(-w + u * 0.025, u * 0.03, 2 * w - u * 0.05, u * 0.035, u * 0.015); c.clip();
  speckle(c, 21, 90, -w, u * 0.03, w, u * 0.07, u * 0.002, u * 0.006, ['rgba(185,140,80,0.5)', 'rgba(255,255,255,0.6)']);
  c.restore();
  // 노릇한 얼룩·광택
  c.save(); c.beginPath(); c.moveTo(-w, u * 0.03); c.bezierCurveTo(-w - u * 0.03, -u * 0.08, -w * 0.7, -u * 0.17, 0, -u * 0.17); c.bezierCurveTo(w * 0.7, -u * 0.17, w + u * 0.03, -u * 0.08, w, u * 0.03); c.closePath(); c.clip();
  speckle(c, 23, 70, -w, -u * 0.17, w, u * 0.03, u * 0.004, u * 0.012, ['rgba(120,60,20,0.18)', 'rgba(255,230,180,0.25)']);
  c.restore();
  gloss(c, -w * 0.3, -u * 0.12, w * 0.45, u * 0.035, 0.5, -0.08);
}
function lyCheese(c, u) {
  const w = 0.54 * u, h = 0.018 * u;
  c.fillStyle = lg(c, 0, -h, 0, h + u * 0.07, [[0, '#ffe57a'], [0.5, '#fcc838'], [1, '#e9a512']]);
  c.beginPath(); c.moveTo(-w, -h); c.lineTo(w, -h); c.lineTo(w, h);
  c.quadraticCurveTo(w * 1.02, h + u * 0.06, w * 0.93, h + u * 0.068); c.quadraticCurveTo(w * 0.88, h + u * 0.02, w * 0.78, h);
  c.lineTo(-w * 0.72, h); c.quadraticCurveTo(-w * 0.84, h + u * 0.05, -w * 0.94, h + u * 0.055); c.quadraticCurveTo(-w * 1.03, h + u * 0.03, -w, h);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = u * 0.006; c.beginPath(); c.moveTo(-w * 0.95, -h + u * 0.004); c.lineTo(w * 0.95, -h + u * 0.004); c.stroke();
  c.fillStyle = 'rgba(214,145,10,0.55)'; [[-0.3, 0.012], [0.15, 0.022], [0.62, 0.01], [-0.8, 0.03]].forEach(([q, r]) => { ell(c, w * q, 0, u * r, u * 0.008); c.fill(); });
}
function lyHam(c, u) {
  const w = 0.56 * u;
  const path = () => {
    c.beginPath(); c.moveTo(-w, -u * 0.01);
    for (let x = -w; x <= w; x += u * 0.02) c.lineTo(x, -u * 0.022 + Math.sin(x / u * 26) * u * 0.006);
    c.quadraticCurveTo(w + u * 0.03, 0, w, u * 0.03);
    for (let x = w; x >= -w; x -= u * 0.02) c.lineTo(x, u * 0.024 + Math.sin(x / u * 20 + 1) * u * 0.009);
    c.quadraticCurveTo(-w - u * 0.03, 0, -w, -u * 0.01); c.closePath();
  };
  path(); c.fillStyle = lg(c, 0, -u * 0.03, 0, u * 0.035, [[0, '#f8b4bc'], [0.5, '#ec8f9c'], [1, '#c9636f']]); c.fill();
  c.strokeStyle = '#b9505e'; c.lineWidth = u * 0.006; c.stroke();
  c.save(); path(); c.clip();
  c.strokeStyle = 'rgba(255,232,236,0.6)'; c.lineWidth = u * 0.006;
  [-0.6, -0.1, 0.4].forEach(q => { c.beginPath(); c.moveTo(w * q, -u * 0.01); c.quadraticCurveTo(w * (q + 0.12), u * 0.005, w * (q + 0.25), -u * 0.004); c.stroke(); });
  c.restore();
}
function lyLettuce(c, u) {
  const w = 0.6 * u;
  const path = () => {
    c.beginPath(); c.moveTo(-w, 0);
    for (let x = -w; x <= w; x += u * 0.01) c.lineTo(x, -u * 0.016 + Math.sin(x / u * 40) * u * 0.008);
    for (let x = w; x >= -w; x -= u * 0.01) c.lineTo(x, u * 0.016 + Math.abs(Math.sin(x / u * 13)) * u * 0.035 + Math.sin(x / u * 61) * u * 0.004);
    c.closePath();
  };
  path(); c.fillStyle = lg(c, 0, -u * 0.025, 0, u * 0.05, [[0, '#c9f59a'], [0.35, '#86d057'], [1, '#3f8a24']]); c.fill();
  c.save(); path(); c.clip();
  c.strokeStyle = 'rgba(235,255,210,0.55)'; c.lineWidth = u * 0.004;
  for (let i = 0; i < 9; i++) { const x = -w + (i + 0.5) * (2 * w / 9); c.beginPath(); c.moveTo(x, -u * 0.01); c.quadraticCurveTo(x + u * 0.03, u * 0.02, x + u * 0.01, u * 0.05); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = u * 0.004; c.beginPath();
  for (let x = -w; x <= w; x += u * 0.01) { const y = -u * 0.016 + Math.sin(x / u * 40) * u * 0.008; if (x === -w) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
}
function lyTomato(c, u) {
  [-0.33, 0, 0.33].forEach((q, i) => {
    const x = q * u;
    c.fillStyle = lg(c, 0, -u * 0.03, 0, u * 0.03, [[0, '#ff6b57'], [0.5, '#e02d1b'], [1, '#a3150b']]);
    ell(c, x, 0, u * 0.19, u * 0.03); c.fill();
    c.fillStyle = rg(c, x, -u * 0.006, 0, x, -u * 0.006, u * 0.17, [[0, '#ff9c8a'], [0.6, '#f0533f'], [1, 'rgba(220,40,25,0)']]);
    ell(c, x, -u * 0.006, u * 0.16, u * 0.018); c.fill();
    c.fillStyle = 'rgba(255,230,140,0.85)'; [-0.08, -0.03, 0.04, 0.09].forEach((d, k) => { ell(c, x + d * u, -u * 0.006 + (k % 2 ? 1 : -1) * u * 0.004, u * 0.008, u * 0.004); c.fill(); });
    gloss(c, x - u * 0.06, -u * 0.016, u * 0.06, u * 0.008, 0.7 - i * 0.05);
  });
}
function lyEgg(c, u) {
  [-0.32, 0, 0.32].forEach(q => {
    const x = q * u;
    c.fillStyle = lg(c, 0, -u * 0.035, 0, u * 0.035, [[0, '#ffffff'], [1, '#e4ded2']]);
    ell(c, x, 0, u * 0.17, u * 0.034); c.fill();
    c.strokeStyle = 'rgba(180,170,150,0.5)'; c.lineWidth = u * 0.003; c.stroke();
    c.fillStyle = rg(c, x - u * 0.02, -u * 0.006, 0, x, 0, u * 0.08, [[0, '#ffd96a'], [0.6, '#fbbf24'], [1, '#e8930a']]);
    ell(c, x, -u * 0.002, u * 0.075, u * 0.018); c.fill();
    gloss(c, x - u * 0.06, -u * 0.016, u * 0.05, u * 0.007, 0.8);
  });
}
function lyCarrot(c, u) {
  const r = rng(31); c.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = -0.56 * u + r() * 1.12 * u, y = -u * 0.018 + r() * u * 0.04, l = u * (0.05 + r() * 0.07), a = (r() - 0.5) * 0.9;
    c.strokeStyle = ['#fb8a2c', '#f97316', '#fdae5b', '#ea6a0c'][i % 4]; c.lineWidth = u * (0.007 + r() * 0.005);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 - u * 0.006, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
}
function lyHoney(c, u) {
  const w = 0.52 * u;
  c.fillStyle = lg(c, 0, -u * 0.012, 0, u * 0.08, [[0, 'rgba(255,196,60,0.95)'], [1, 'rgba(214,128,8,0.95)']]);
  c.beginPath(); c.roundRect(-w, -u * 0.012, 2 * w, u * 0.022, u * 0.01); c.fill();
  [[-0.7, 0.05], [-0.2, 0.075], [0.3, 0.045], [0.75, 0.065]].forEach(([q, l]) => {
    const x = w * q; c.beginPath(); c.moveTo(x - u * 0.018, u * 0.006); c.quadraticCurveTo(x - u * 0.012, u * l, x, u * (l + 0.012)); c.quadraticCurveTo(x + u * 0.012, u * l, x + u * 0.018, u * 0.006); c.fill();
    gloss(c, x - u * 0.004, u * l * 0.7, u * 0.006, u * 0.012, 0.7);
  });
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = u * 0.004; c.beginPath(); c.moveTo(-w * 0.9, -u * 0.006); c.lineTo(w * 0.9, -u * 0.006); c.stroke();
}
function lyBamboo(c, u) {
  [[-1, -0.06, 0.15], [1, 0.02, -0.1], [-1, 0.03, -0.2], [1, -0.03, 0.22]].forEach(([k, y, a]) => {
    c.save(); c.translate(k * u * 0.18, y * u); c.rotate(a + (k > 0 ? 0 : Math.PI)); leafShape(c, u * 0.48, u * 0.06); c.restore();
  });
}
function leafShape(c, L, wd) {
  c.fillStyle = lg(c, 0, -wd, 0, wd, [[0, '#7fd46f'], [0.5, '#3f9a37'], [1, '#22661f']]);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.45, -wd * 1.1, L, 0); c.quadraticCurveTo(L * 0.45, wd * 1.1, 0, 0); c.fill();
  c.strokeStyle = 'rgba(220,255,200,0.6)'; c.lineWidth = wd * 0.12; c.beginPath(); c.moveTo(0, 0); c.lineTo(L * 0.95, 0); c.stroke();
}
function lyMeat(c, u) {
  const w = 0.5 * u, h = 0.085 * u;
  shadowOn(c, u * 0.02, u * 0.01);
  c.fillStyle = lg(c, 0, -h / 2, 0, h / 2, [[0, '#8f4c22'], [0.5, '#6b3416'], [1, '#3e1b08']]);
  c.beginPath(); c.roundRect(-w, -h / 2, 2 * w, h, u * 0.04); c.fill(); shadowOff(c);
  c.save(); c.beginPath(); c.roundRect(-w, -h / 2, 2 * w, h, u * 0.04); c.clip();
  speckle(c, 41, 160, -w, -h / 2, w, h / 2, u * 0.002, u * 0.007, ['rgba(30,10,2,0.45)', 'rgba(180,100,50,0.35)', 'rgba(255,200,150,0.2)']);
  c.strokeStyle = 'rgba(25,8,0,0.55)'; c.lineWidth = u * 0.012;
  for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(i * u * 0.12 - u * 0.03, -h / 2); c.lineTo(i * u * 0.12 + u * 0.03, h / 2); c.stroke(); }
  c.restore();
  gloss(c, -w * 0.3, -h * 0.3, w * 0.4, u * 0.012, 0.35);
}
// 구운 생선 (옆모습, 길이 L)
function fishShape(c, L) {
  const h = L * 0.2;
  c.save();
  shadowOn(c, L * 0.03, L * 0.015);
  c.fillStyle = lg(c, 0, -h, 0, h, [[0, '#6b7785'], [0.45, '#b8c2cc'], [0.75, '#e6ebef'], [1, '#c9cfd4']]);
  c.beginPath(); c.moveTo(-L * 0.5, 0);
  c.bezierCurveTo(-L * 0.42, -h * 1.05, L * 0.15, -h * 1.15, L * 0.33, -h * 0.25);
  c.lineTo(L * 0.5, -h * 0.85); c.quadraticCurveTo(L * 0.44, 0, L * 0.5, h * 0.85); c.lineTo(L * 0.33, h * 0.25);
  c.bezierCurveTo(L * 0.15, h * 1.1, -L * 0.42, h * 1.0, -L * 0.5, 0);
  c.fill(); shadowOff(c);
  // 구운 자국·노릇함
  c.save(); c.clip();
  c.fillStyle = 'rgba(190,120,40,0.22)'; c.fillRect(-L * 0.5, -h, L, h * 2);
  c.strokeStyle = 'rgba(60,30,10,0.55)'; c.lineWidth = L * 0.018;
  [-0.25, -0.08, 0.09].forEach(q => { c.beginPath(); c.moveTo(L * q, -h); c.lineTo(L * (q + 0.07), h); c.stroke(); });
  c.restore();
  c.strokeStyle = 'rgba(70,80,90,0.5)'; c.lineWidth = L * 0.008; c.beginPath(); c.moveTo(-L * 0.3, -h * 0.75); c.quadraticCurveTo(-L * 0.25, 0, -L * 0.32, h * 0.7); c.stroke();
  c.fillStyle = '#f5f5f4'; ell(c, -L * 0.38, -h * 0.2, L * 0.035, L * 0.035); c.fill();
  c.fillStyle = '#1f2937'; ell(c, -L * 0.38, -h * 0.2, L * 0.018, L * 0.018); c.fill();
  gloss(c, -L * 0.05, -h * 0.55, L * 0.25, h * 0.15, 0.55);
  c.restore();
}
function lyFish(c, u) { fishShape(c, u * 0.95); }
const LAYER_FN = { breadBottom: lyBreadBottom, breadTop: lyBreadTop, cheese: lyCheese, ham: lyHam, lettuce: lyLettuce, tomato: lyTomato, egg: lyEgg, carrot: lyCarrot, honey: lyHoney, bamboo: lyBamboo, meat: lyMeat, fish: lyFish };
// 샌드위치에 피자·과일 재료가 들어오면 조각을 한 줄로 늘어놓는다
function layerFn(id) {
  if (LAYER_FN[id]) return LAYER_FN[id];
  return (c, u) => { [-0.36, -0.12, 0.12, 0.36].forEach((q, i) => { c.save(); c.translate(q * u, 0); c.scale(1, 0.45); (PIECE_FN[id] || TOP_FN[id])(c, u * 0.13, i); c.restore(); }); };
}
const drawLayer = (ctx, id, x, y, w, rot = 0) => stamp(ctx, `ly:${id}`, 420, 1.5, layerFn(id), x, y, w, rot);

// ═══════════════ 피자 토핑 (위에서 본 모습, 반지름 u) ═══════════════
function tpCheese(c, u, v = 0) {
  const r = rng(51 + v);
  for (let i = 0; i < 7; i++) {
    c.save(); c.translate((r() - 0.5) * u * 1.3, (r() - 0.5) * u * 1.3); c.rotate(r() * 3);
    c.fillStyle = lg(c, 0, -u * 0.1, 0, u * 0.1, [[0, '#fff6c2'], [1, '#f2c246']]);
    c.beginPath(); c.roundRect(-u * 0.45, -u * 0.08, u * 0.9, u * 0.16, u * 0.08); c.fill();
    c.restore();
  }
}
function tpCheeseBaked(c, u, v = 0) {
  const r = rng(61 + v);
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, u * 1.2, [[0, '#fff1a6'], [0.7, '#fbd157'], [1, '#eab33a']]);
  c.beginPath();
  for (let i = 0; i <= 14; i++) { const a = i / 14 * TAU, rr = u * (0.85 + r() * 0.35); if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fill();
  for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(190,110,30,${0.25 + r() * 0.25})`; ell(c, (r() - 0.5) * u, (r() - 0.5) * u, u * (0.1 + r() * 0.12), u * (0.08 + r() * 0.08)); c.fill(); }
  gloss(c, -u * 0.25, -u * 0.25, u * 0.4, u * 0.25, 0.6);
}
function tpPepperoni(c, u, v = 0, baked = false) {
  c.fillStyle = rg(c, -u * 0.2, -u * 0.2, 0, 0, 0, u * 0.82, [[0, baked ? '#b8321f' : '#d24a33'], [0.8, baked ? '#8c1f10' : '#b02c1c'], [1, baked ? '#5a1207' : '#8a1d10']]);
  ell(c, 0, 0, u * 0.8, u * 0.8); c.fill();
  c.save(); ell(c, 0, 0, u * 0.78, u * 0.78); c.clip();
  speckle(c, 71 + v, 26, -u, -u, u, u, u * 0.02, u * 0.06, ['rgba(255,215,195,0.6)', 'rgba(255,190,170,0.45)', 'rgba(110,20,10,0.4)']);
  c.restore();
  gloss(c, -u * 0.25, -u * 0.3, u * 0.35, u * 0.15, baked ? 0.6 : 0.35);
}
function tpPepper(c, u, v = 0) {
  const ring = (rad, k) => { c.moveTo(rad * (1 + 0.08 * Math.sin(0)), 0); for (let i = 1; i <= 48; i++) { const a = i / 48 * TAU * k, rr = rad * (1 + 0.09 * Math.sin(4 * Math.abs(a) + v)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); };
  c.beginPath(); ring(u * 0.78, 1); ring(u * 0.56, -1);
  c.fillStyle = rg(c, 0, 0, u * 0.5, 0, 0, u * 0.8, [[0, '#9be27c'], [0.4, '#2fae45'], [1, '#127526']]); c.fill('evenodd');
  c.strokeStyle = 'rgba(230,255,220,0.6)'; c.lineWidth = u * 0.05; c.beginPath(); c.arc(0, 0, u * 0.6, -2.4, -1.2); c.stroke();
}
function tpMushroom(c, u) {
  c.fillStyle = lg(c, 0, -u * 0.7, 0, u * 0.7, [[0, '#f6ecdb'], [1, '#dfcbaa']]);
  c.beginPath(); c.moveTo(-u * 0.75, 0); c.bezierCurveTo(-u * 0.75, -u * 0.75, u * 0.75, -u * 0.75, u * 0.75, 0);
  c.quadraticCurveTo(u * 0.5, u * 0.12, u * 0.25, u * 0.08); c.lineTo(u * 0.25, u * 0.65); c.quadraticCurveTo(0, u * 0.78, -u * 0.25, u * 0.65); c.lineTo(-u * 0.25, u * 0.08); c.quadraticCurveTo(-u * 0.5, u * 0.12, -u * 0.75, 0); c.closePath();
  c.fill(); c.strokeStyle = '#8b6844'; c.lineWidth = u * 0.07; c.stroke();
  c.strokeStyle = 'rgba(140,105,70,0.45)'; c.lineWidth = u * 0.03;
  [-0.45, -0.2, 0.2, 0.45].forEach(q => { c.beginPath(); c.moveTo(q * u, -u * 0.05); c.lineTo(q * u * 0.6, -u * 0.35); c.stroke(); });
}
function tpCorn(c, u, v = 0) {
  const r = rng(81 + v);
  for (let i = 0; i < 3; i++) {
    const x = (r() - 0.5) * u * 0.9, y = (r() - 0.5) * u * 0.9;
    c.save(); c.translate(x, y); c.rotate(r() * 3);
    c.fillStyle = rg(c, -u * 0.08, -u * 0.08, 0, 0, 0, u * 0.32, [[0, '#fff3a0'], [0.6, '#fcd226'], [1, '#e1a406']]);
    c.beginPath(); c.roundRect(-u * 0.27, -u * 0.22, u * 0.54, u * 0.44, u * 0.16); c.fill();
    gloss(c, -u * 0.08, -u * 0.08, u * 0.12, u * 0.07, 0.75);
    c.restore();
  }
}
function tpOlive(c, u) {
  c.beginPath(); c.arc(0, 0, u * 0.55, 0, TAU); c.arc(0, 0, u * 0.22, 0, TAU, true);
  c.fillStyle = rg(c, -u * 0.2, -u * 0.2, 0, 0, 0, u * 0.6, [[0, '#5b4d66'], [0.6, '#2a2330'], [1, '#141016']]); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, u * 0.4, -2.6, -1.7); c.stroke();
}
function tpCarrot(c, u) {
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, u * 0.7, [[0, '#ffc173'], [0.45, '#fb9a3c'], [0.8, '#f47c16'], [1, '#d9620b']]);
  ell(c, 0, 0, u * 0.68, u * 0.68); c.fill();
  c.strokeStyle = 'rgba(255,220,170,0.6)'; c.lineWidth = u * 0.04; ell(c, 0, 0, u * 0.36, u * 0.36); c.stroke();
  c.strokeStyle = 'rgba(200,90,10,0.35)'; c.lineWidth = u * 0.025;
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * u * 0.38, Math.sin(a) * u * 0.38); c.lineTo(Math.cos(a) * u * 0.62, Math.sin(a) * u * 0.62); c.stroke(); }
  gloss(c, -u * 0.25, -u * 0.25, u * 0.25, u * 0.15, 0.5);
}
function tpHoney(c, u) {
  c.fillStyle = 'rgba(240,160,20,0.85)';
  c.beginPath(); c.moveTo(-u * 0.8, -u * 0.1);
  c.bezierCurveTo(-u * 0.5, -u * 0.6, -u * 0.2, u * 0.5, u * 0.1, -u * 0.1); c.bezierCurveTo(u * 0.35, -u * 0.6, u * 0.6, u * 0.4, u * 0.85, 0);
  c.lineTo(u * 0.85, u * 0.16); c.bezierCurveTo(u * 0.6, u * 0.56, u * 0.35, -u * 0.44, u * 0.1, u * 0.06); c.bezierCurveTo(-u * 0.2, u * 0.66, -u * 0.5, -u * 0.44, -u * 0.8, u * 0.06); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,245,200,0.75)'; c.lineWidth = u * 0.05; c.beginPath(); c.moveTo(-u * 0.6, -u * 0.18); c.quadraticCurveTo(-u * 0.45, -u * 0.32, -u * 0.32, -u * 0.12); c.stroke();
}
function tpBamboo(c, u) { c.save(); c.translate(-u * 0.8, 0); c.rotate(-0.2); leafShape(c, u * 1.6, u * 0.28); c.restore(); }
function tpMeat(c, u, v = 0) {
  c.fillStyle = rg(c, -u * 0.2, -u * 0.25, 0, 0, 0, u * 0.7, [[0, '#a2592b'], [0.6, '#6e3414'], [1, '#3a1806']]);
  ell(c, 0, 0, u * 0.68, u * 0.66); c.fill();
  c.save(); ell(c, 0, 0, u * 0.68, u * 0.66); c.clip();
  speckle(c, 91 + v, 40, -u, -u, u, u, u * 0.02, u * 0.06, ['rgba(30,10,0,0.5)', 'rgba(200,120,60,0.35)', 'rgba(80,140,40,0.35)']);
  c.restore();
  gloss(c, -u * 0.22, -u * 0.25, u * 0.3, u * 0.18, 0.55);
}
function tpFish(c, u) { fishShape(c, u * 1.7); }
// 도토리 한 알 (옆모습)
function acornShape(c, u) {
  c.fillStyle = rg(c, -u * 0.2, u * 0.05, 0, 0, u * 0.15, u * 0.6, [[0, '#d9a066'], [0.5, '#b0702f'], [1, '#7a4416']]);
  c.beginPath(); c.moveTo(-u * 0.42, -u * 0.1); c.bezierCurveTo(-u * 0.45, u * 0.45, -u * 0.1, u * 0.72, 0, u * 0.78); c.bezierCurveTo(u * 0.1, u * 0.72, u * 0.45, u * 0.45, u * 0.42, -u * 0.1); c.closePath(); c.fill();
  gloss(c, -u * 0.18, u * 0.15, u * 0.1, u * 0.2, 0.55);
  c.fillStyle = lg(c, 0, -u * 0.45, 0, 0, [[0, '#9a7a4e'], [1, '#6b5030']]);
  ell(c, 0, -u * 0.15, u * 0.5, u * 0.26); c.fill();
  c.save(); ell(c, 0, -u * 0.15, u * 0.5, u * 0.26); c.clip();
  c.strokeStyle = 'rgba(60,40,20,0.45)'; c.lineWidth = u * 0.03;
  for (let i = -5; i <= 5; i++) { c.beginPath(); c.moveTo(i * u * 0.1 - u * 0.15, -u * 0.45); c.lineTo(i * u * 0.1 + u * 0.15, 0); c.stroke(); c.beginPath(); c.moveTo(i * u * 0.1 + u * 0.15, -u * 0.45); c.lineTo(i * u * 0.1 - u * 0.15, 0); c.stroke(); }
  c.restore();
  c.strokeStyle = '#5a3c1e'; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -u * 0.38); c.quadraticCurveTo(u * 0.04, -u * 0.5, u * 0.12, -u * 0.55); c.stroke();
}
function tpAcorn(c, u, v = 0) { c.rotate((v - 1) * 0.5); acornShape(c, u * 0.85); }
// 사과 한 조각 (반달 모양, 빨간 껍질 + 하얀 속 + 씨)
function appleWedge(c, u) {
  c.fillStyle = lg(c, 0, -u * 0.5, 0, u * 0.3, [[0, '#e0283a'], [1, '#a5101f']]);
  c.beginPath(); c.moveTo(-u * 0.8, 0); c.quadraticCurveTo(0, -u * 0.95, u * 0.8, 0); c.closePath(); c.fill();
  c.fillStyle = lg(c, 0, -u * 0.4, 0, u * 0.1, [[0, '#fff7dc'], [1, '#f1e1aa']]);
  c.beginPath(); c.moveTo(-u * 0.72, u * 0.02); c.quadraticCurveTo(0, -u * 0.78, u * 0.72, u * 0.02); c.lineTo(u * 0.72, u * 0.1); c.lineTo(-u * 0.72, u * 0.1); c.closePath(); c.fill();
  c.fillStyle = 'rgba(200,170,90,0.35)'; ell(c, 0, -u * 0.05, u * 0.3, u * 0.1); c.fill();
  c.fillStyle = '#4a2a10'; [-1, 1].forEach(k => { ell(c, k * u * 0.1, -u * 0.06, u * 0.05, u * 0.08, k * 0.4); c.fill(); });
  gloss(c, -u * 0.3, -u * 0.35, u * 0.2, u * 0.06, 0.6, -0.4);
}
function tpApple(c, u, v = 0) { c.rotate(v * 1.3); appleWedge(c, u); }
const TOP_FN = { cheese: tpCheese, pepperoni: tpPepperoni, pepper: tpPepper, mushroom: tpMushroom, corn: tpCorn, olive: tpOlive, carrot: tpCarrot, honey: tpHoney, bamboo: tpBamboo, meat: tpMeat, fish: tpFish, acorn: tpAcorn, apple: tpApple };

// ═══════════════ 과일 조각 (꼬치·피자용, 반지름 u) ═══════════════
function pcStrawberry(c, u) {
  const path = () => { c.beginPath(); c.moveTo(0, u * 0.85); c.bezierCurveTo(-u * 0.95, u * 0.2, -u * 0.8, -u * 0.8, 0, -u * 0.7); c.bezierCurveTo(u * 0.8, -u * 0.8, u * 0.95, u * 0.2, 0, u * 0.85); c.closePath(); };
  path(); c.fillStyle = '#c8102e'; c.fill();
  c.save(); path(); c.clip();
  c.fillStyle = rg(c, 0, -u * 0.05, 0, 0, 0, u * 0.85, [[0, '#fff5f5'], [0.35, '#ffc2c8'], [0.7, '#f2465a'], [0.92, '#d3122e']]);
  ell(c, 0, 0, u * 0.78, u * 0.82); c.fill();
  c.strokeStyle = 'rgba(255,240,240,0.65)'; c.lineWidth = u * 0.035;
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i - 3.5) * 0.35; c.beginPath(); c.moveTo(0, -u * 0.05); c.lineTo(Math.cos(a + Math.PI) * -u * 0.6, Math.sin(a + Math.PI) * -u * 0.6 + u * 0.1); c.stroke(); }
  c.restore();
  gloss(c, -u * 0.3, -u * 0.35, u * 0.22, u * 0.12, 0.5);
}
function pcBanana(c, u) {
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, u * 0.85, [[0, '#fffbe6'], [0.6, '#fbf0c4'], [0.88, '#f2df99'], [1, '#e2c770']]);
  ell(c, 0, 0, u * 0.82, u * 0.8); c.fill();
  c.strokeStyle = 'rgba(200,170,90,0.35)'; c.lineWidth = u * 0.02;
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * u * 0.2, Math.sin(a) * u * 0.2); c.lineTo(Math.cos(a) * u * 0.7, Math.sin(a) * u * 0.7); c.stroke(); }
  c.fillStyle = 'rgba(110,80,30,0.55)'; [0, 2.1, 4.2].forEach(a => { ell(c, Math.cos(a) * u * 0.1, Math.sin(a) * u * 0.1, u * 0.04, u * 0.025, a); c.fill(); });
  gloss(c, -u * 0.3, -u * 0.3, u * 0.25, u * 0.15, 0.6);
}
function pcKiwi(c, u) {
  c.fillStyle = '#7a5631'; ell(c, 0, 0, u * 0.9, u * 0.84); c.fill();
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, u * 0.85, [[0, '#f6f8dc'], [0.22, '#d6ea86'], [0.5, '#8fcc33'], [0.92, '#5e9e1c'], [1, '#4e8a15']]);
  ell(c, 0, 0, u * 0.84, u * 0.78); c.fill();
  c.strokeStyle = 'rgba(235,250,190,0.5)'; c.lineWidth = u * 0.02;
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * u * 0.25, Math.sin(a) * u * 0.23); c.lineTo(Math.cos(a) * u * 0.78, Math.sin(a) * u * 0.72); c.stroke(); }
  c.fillStyle = '#1a1410';
  for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + (i % 2) * 0.08, rr = u * (0.36 + (i % 3) * 0.04); ell(c, Math.cos(a) * rr, Math.sin(a) * rr * 0.93, u * 0.045, u * 0.025, a); c.fill(); }
  c.fillStyle = '#fbfbea'; ell(c, 0, 0, u * 0.2, u * 0.12); c.fill();
  gloss(c, -u * 0.3, -u * 0.35, u * 0.3, u * 0.15, 0.55);
}
function pcOrange(c, u) {
  // 귤 단면: 껍질 → 흰 속껍질 → 반투명 과육 10쪽
  c.fillStyle = rg(c, -u * 0.2, -u * 0.2, 0, 0, 0, u * 0.86, [[0, '#ffb04a'], [1, '#e8730c']]); ell(c, 0, 0, u * 0.85, u * 0.85); c.fill();
  c.fillStyle = '#fff3dc'; ell(c, 0, 0, u * 0.76, u * 0.76); c.fill();
  for (let i = 0; i < 10; i++) {
    const a0 = i / 10 * TAU + 0.04, a1 = (i + 1) / 10 * TAU - 0.04;
    c.fillStyle = rg(c, 0, 0, u * 0.05, 0, 0, u * 0.7, [[0, '#ffd27a'], [0.6, '#ffa82e'], [1, '#f7900f']]);
    c.beginPath(); c.moveTo(Math.cos((a0 + a1) / 2) * u * 0.08, Math.sin((a0 + a1) / 2) * u * 0.08); c.arc(0, 0, u * 0.7, a0, a1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,240,200,0.55)'; c.lineWidth = u * 0.015;
    const am = (a0 + a1) / 2; c.beginPath(); c.moveTo(Math.cos(am) * u * 0.2, Math.sin(am) * u * 0.2); c.lineTo(Math.cos(am) * u * 0.6, Math.sin(am) * u * 0.6); c.stroke();
  }
  c.fillStyle = '#fff3dc'; ell(c, 0, 0, u * 0.08, u * 0.08); c.fill();
  gloss(c, -u * 0.3, -u * 0.35, u * 0.3, u * 0.15, 0.55);
}
const PIECE_FN = { strawberry: pcStrawberry, banana: pcBanana, kiwi: pcKiwi, orange: pcOrange };

// ═══════════════ 통째 모습 (재료 칸 그림·도마 위 과일, 반지름 u) ═══════════════
function whStrawberry(c, u) {
  const path = () => { c.beginPath(); c.moveTo(0, u * 0.9); c.bezierCurveTo(-u * 0.9, u * 0.35, -u * 0.85, -u * 0.6, 0, -u * 0.55); c.bezierCurveTo(u * 0.85, -u * 0.6, u * 0.9, u * 0.35, 0, u * 0.9); c.closePath(); };
  shadowOn(c, u * 0.15, u * 0.06); path(); c.fillStyle = '#d0122d'; c.fill(); shadowOff(c);
  c.save(); path(); c.clip();
  c.fillStyle = rg(c, -u * 0.25, -u * 0.25, 0, 0, 0, u * 1.0, [[0, '#ff6a6a'], [0.5, '#e01b33'], [1, '#8f0a1b']]); c.fillRect(-u, -u, 2 * u, 2 * u);
  for (let row = 0; row < 7; row++) for (let k = 0; k < 7; k++) {
    const x = (k - 3 + (row % 2) * 0.5) * u * 0.24, y = -u * 0.38 + row * u * 0.19;
    c.fillStyle = 'rgba(120,0,15,0.35)'; ell(c, x, y, u * 0.05, u * 0.04); c.fill();
    c.fillStyle = '#f7d65a'; ell(c, x, y - u * 0.005, u * 0.025, u * 0.035); c.fill();
  }
  c.restore();
  gloss(c, -u * 0.3, -u * 0.2, u * 0.25, u * 0.16, 0.55, -0.4);
  c.fillStyle = '#2f8a2c';
  for (let i = 0; i < 6; i++) { c.save(); c.translate(0, -u * 0.55); c.rotate(-Math.PI / 2 + (i - 2.5) * 0.5); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(u * 0.2, -u * 0.09, u * 0.38, 0); c.quadraticCurveTo(u * 0.2, u * 0.09, 0, 0); c.fill(); c.restore(); }
  c.fillStyle = '#4a7a2a'; c.beginPath(); c.roundRect(-u * 0.03, -u * 0.85, u * 0.06, u * 0.28, u * 0.03); c.fill();
}
function whBanana(c, u) {
  c.save(); c.rotate(-0.2);
  const path = () => { c.beginPath(); c.moveTo(-u * 1.0, -u * 0.32); c.bezierCurveTo(-u * 0.6, u * 0.6, u * 0.6, u * 0.6, u * 1.0, -u * 0.36); c.quadraticCurveTo(u * 0.96, -u * 0.12, u * 0.8, -u * 0.08); c.bezierCurveTo(u * 0.4, u * 0.18, -u * 0.4, u * 0.16, -u * 0.86, -u * 0.42); c.closePath(); };
  shadowOn(c, u * 0.12, u * 0.06); path(); c.fillStyle = '#f5d33a'; c.fill(); shadowOff(c);
  c.save(); path(); c.clip();
  c.fillStyle = lg(c, 0, -u * 0.1, 0, u * 0.45, [[0, '#fff59a'], [0.45, '#f9d531'], [1, '#cf980f']]); c.fillRect(-u * 1.2, -u, u * 2.4, u * 2);
  c.strokeStyle = 'rgba(170,120,10,0.45)'; c.lineWidth = u * 0.025; c.beginPath(); c.moveTo(-u * 0.92, -u * 0.36); c.bezierCurveTo(-u * 0.5, u * 0.42, u * 0.5, u * 0.42, u * 0.92, -u * 0.24); c.stroke();
  speckle(c, 101, 22, -u * 0.6, 0, u * 0.6, u * 0.4, u * 0.01, u * 0.025, ['rgba(110,70,10,0.35)']);
  c.restore();
  c.fillStyle = '#4a3418'; ell(c, -u * 0.95, -u * 0.38, u * 0.07, u * 0.06); c.fill();
  c.fillStyle = '#7a6a2a'; c.beginPath(); c.moveTo(u * 0.84, -u * 0.12); c.lineTo(u * 1.1, -u * 0.5); c.lineTo(u * 1.0, -u * 0.55); c.lineTo(u * 0.88, -u * 0.32); c.fill();
  gloss(c, -u * 0.2, u * 0.1, u * 0.4, u * 0.06, 0.6, 0.2);
  c.restore();
}
function whKiwi(c, u) {
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = rg(c, -u * 0.3, -u * 0.3, 0, 0, 0, u * 0.95, [[0, '#a98058'], [0.7, '#80592f'], [1, '#5c3d1c']]);
  ell(c, 0, 0, u * 0.9, u * 0.72); c.fill(); shadowOff(c);
  c.save(); ell(c, 0, 0, u * 0.9, u * 0.72); c.clip();
  const r = rng(111); c.lineWidth = u * 0.012;
  for (let i = 0; i < 260; i++) { const x = (r() - 0.5) * 1.8 * u, y = (r() - 0.5) * 1.5 * u, a = r() * TAU; c.strokeStyle = r() > 0.5 ? 'rgba(210,175,130,0.5)' : 'rgba(60,35,15,0.4)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * u * 0.06, y + Math.sin(a) * u * 0.06); c.stroke(); }
  c.restore();
  c.fillStyle = '#4a3218'; ell(c, -u * 0.88, 0, u * 0.05, u * 0.06); c.fill();
}
function whOrange(c, u) {
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = rg(c, -u * 0.3, -u * 0.35, 0, 0, 0, u * 0.9, [[0, '#ffc266'], [0.55, '#fb8b1a'], [1, '#d9620a']]);
  ell(c, 0, 0, u * 0.85, u * 0.78); c.fill(); shadowOff(c);
  c.save(); ell(c, 0, 0, u * 0.85, u * 0.78); c.clip();
  speckle(c, 121, 200, -u, -u, u, u, u * 0.008, u * 0.018, ['rgba(180,70,0,0.25)', 'rgba(255,220,160,0.3)']);
  c.restore();
  gloss(c, -u * 0.3, -u * 0.3, u * 0.3, u * 0.2, 0.6, -0.5);
  c.fillStyle = '#5b7a2a'; ell(c, 0, -u * 0.74, u * 0.08, u * 0.05); c.fill();
  c.save(); c.translate(u * 0.02, -u * 0.76); c.rotate(-0.5); leafShape(c, u * 0.5, u * 0.14); c.restore();
}
function whCarrot(c, u) {
  c.save(); c.rotate(0.6);
  shadowOn(c, u * 0.1, u * 0.05);
  c.fillStyle = lg(c, -u * 0.2, 0, u * 0.2, 0, [[0, '#ffb15c'], [0.45, '#fb7f1a'], [1, '#d55b06']]);
  c.beginPath(); c.moveTo(-u * 0.2, -u * 0.5); c.quadraticCurveTo(0, -u * 0.6, u * 0.2, -u * 0.5); c.lineTo(u * 0.03, u * 0.95); c.quadraticCurveTo(0, u * 1.0, -u * 0.03, u * 0.95); c.closePath(); c.fill(); shadowOff(c);
  c.strokeStyle = 'rgba(160,60,0,0.4)'; c.lineWidth = u * 0.025;
  [-0.25, 0, 0.25, 0.5].forEach((q, i) => { c.beginPath(); c.moveTo(-u * 0.13 + i * 0.01 * u, q * u); c.lineTo(u * (i % 2 ? 0.02 : -0.04), q * u + u * 0.04); c.stroke(); });
  gloss(c, -u * 0.08, -u * 0.1, u * 0.05, u * 0.3, 0.45);
  [-0.4, 0, 0.4].forEach(a => { c.save(); c.translate(0, -u * 0.52); c.rotate(-Math.PI / 2 + a); leafShape(c, u * 0.5, u * 0.1); c.restore(); });
  c.restore();
}
function whHoney(c, u) {
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.roundRect(-u * 0.6, -u * 0.5, u * 1.2, u * 1.3, u * 0.25); c.fill(); shadowOff(c);
  c.fillStyle = lg(c, -u * 0.6, 0, u * 0.6, 0, [[0, '#c0700a'], [0.35, '#f5b324'], [0.7, '#e89512'], [1, '#a65c06']]);
  c.beginPath(); c.roundRect(-u * 0.56, -u * 0.3, u * 1.12, u * 1.06, u * 0.22); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.roundRect(-u * 0.45, -u * 0.2, u * 0.12, u * 0.8, u * 0.06); c.fill();
  c.fillStyle = lg(c, 0, -u * 0.8, 0, -u * 0.45, [[0, '#d9a35c'], [1, '#9a6326']]);
  c.beginPath(); c.roundRect(-u * 0.55, -u * 0.78, u * 1.1, u * 0.32, u * 0.08); c.fill();
  c.strokeStyle = '#7a4a18'; c.lineWidth = u * 0.03; c.setLineDash([u * 0.06, u * 0.05]); c.beginPath(); c.moveTo(-u * 0.5, -u * 0.5); c.lineTo(u * 0.5, -u * 0.5); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(245,170,30,0.95)'; c.beginPath(); c.moveTo(u * 0.25, -u * 0.46); c.quadraticCurveTo(u * 0.3, -u * 0.15, u * 0.22, -u * 0.05); c.quadraticCurveTo(u * 0.18, -u * 0.2, u * 0.15, -u * 0.46); c.fill();
}
function whBamboo(c, u) {
  c.save(); c.rotate(0.35);
  c.fillStyle = lg(c, -u * 0.1, 0, u * 0.1, 0, [[0, '#6fa83c'], [0.5, '#a6d16a'], [1, '#4f7f25']]);
  c.beginPath(); c.roundRect(-u * 0.09, -u * 0.95, u * 0.18, u * 1.9, u * 0.06); c.fill();
  c.fillStyle = '#4a7a22'; [-0.4, 0.3].forEach(q => { c.beginPath(); c.roundRect(-u * 0.11, q * u, u * 0.22, u * 0.05, u * 0.02); c.fill(); });
  c.restore();
  [[-0.1, -0.3, -2.4], [0.05, 0.1, -0.5], [0.1, -0.5, -0.9]].forEach(([x, y, a]) => { c.save(); c.translate(x * u, y * u); c.rotate(a); leafShape(c, u * 0.85, u * 0.17); c.restore(); });
}
function whMeat(c, u) {
  c.save(); c.rotate(-0.5);
  c.fillStyle = '#f4efe6'; c.beginPath(); c.roundRect(u * 0.25, -u * 0.09, u * 0.6, u * 0.18, u * 0.08); c.fill();
  [-1, 1].forEach(k => { ell(c, u * 0.85, k * u * 0.11, u * 0.12, u * 0.11); c.fill(); });
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = rg(c, -u * 0.3, -u * 0.2, 0, -u * 0.15, 0, u * 0.75, [[0, '#c27a3c'], [0.6, '#8a4318'], [1, '#55250a']]);
  c.beginPath(); c.moveTo(u * 0.3, -u * 0.13); c.bezierCurveTo(u * 0.1, -u * 0.62, -u * 0.95, -u * 0.6, -u * 0.85, 0); c.bezierCurveTo(-u * 0.95, u * 0.6, u * 0.1, u * 0.62, u * 0.3, u * 0.13); c.closePath(); c.fill(); shadowOff(c);
  c.save(); c.clip(); speckle(c, 131, 50, -u, -u * 0.6, u * 0.3, u * 0.6, u * 0.02, u * 0.05, ['rgba(40,15,0,0.4)', 'rgba(230,160,90,0.3)']); c.restore();
  gloss(c, -u * 0.4, -u * 0.22, u * 0.3, u * 0.12, 0.55);
  c.restore();
}
function whFish(c, u) { fishShape(c, u * 1.9); }
function whCheese(c, u) {
  c.save(); c.rotate(-0.12);
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = '#e3a313'; c.beginPath(); c.roundRect(-u * 0.72, -u * 0.62, u * 1.44, u * 1.32, u * 0.06); c.fill(); shadowOff(c);
  c.fillStyle = lg(c, -u, -u, u, u, [[0, '#ffe98a'], [0.5, '#fdd040'], [1, '#f0b21c']]);
  c.beginPath(); c.roundRect(-u * 0.72, -u * 0.7, u * 1.44, u * 1.32, u * 0.06); c.fill();
  [[-0.35, -0.3, 0.13], [0.3, 0.1, 0.17], [-0.15, 0.35, 0.09], [0.45, -0.42, 0.08]].forEach(([x, y, r]) => { c.fillStyle = rg(c, x * u, y * u, 0, x * u, y * u, r * u, [[0, '#e8a516'], [1, '#f7c63a']]); ell(c, x * u, y * u, r * u, r * u * 0.85); c.fill(); });
  gloss(c, -u * 0.3, -u * 0.45, u * 0.4, u * 0.12, 0.55);
  c.restore();
}
function whHam(c, u) {
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = '#d06a78'; ell(c, 0, 0, u * 0.86, u * 0.8); c.fill(); shadowOff(c);
  c.fillStyle = rg(c, -u * 0.2, -u * 0.2, 0, 0, 0, u * 0.82, [[0, '#ffd0d6'], [0.6, '#f59aa7'], [1, '#e07c8b']]);
  ell(c, 0, 0, u * 0.78, u * 0.72); c.fill();
  c.strokeStyle = 'rgba(255,240,242,0.7)'; c.lineWidth = u * 0.04; c.beginPath(); c.arc(0, 0, u * 0.82, 0.3, 2.2); c.stroke();
  c.strokeStyle = 'rgba(255,225,230,0.5)'; c.lineWidth = u * 0.025;
  [[-0.4, -0.2], [0.1, 0.3], [0.2, -0.35]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x * u, y * u); c.quadraticCurveTo((x + 0.15) * u, (y + 0.1) * u, (x + 0.3) * u, y * u); c.stroke(); });
  gloss(c, -u * 0.3, -u * 0.35, u * 0.3, u * 0.12, 0.45);
}
function whLettuce(c, u) {
  shadowOn(c, u * 0.1, u * 0.05);
  c.fillStyle = lg(c, 0, -u, 0, u, [[0, '#c7f39a'], [0.6, '#79c64b'], [1, '#3f8a24']]);
  c.beginPath();
  for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU, rr = u * (0.78 + 0.1 * Math.sin(a * 9) + 0.05 * Math.sin(a * 23)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.9; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.closePath(); c.fill(); shadowOff(c);
  c.strokeStyle = 'rgba(240,255,220,0.8)'; c.lineWidth = u * 0.06; c.beginPath(); c.moveTo(0, u * 0.75); c.lineTo(0, -u * 0.55); c.stroke();
  c.lineWidth = u * 0.025;
  [-0.4, -0.1, 0.2, 0.45].forEach(y => [-1, 1].forEach(k => { c.beginPath(); c.moveTo(0, y * u); c.quadraticCurveTo(k * u * 0.3, (y - 0.1) * u, k * u * 0.6, (y - 0.25) * u); c.stroke(); }));
}
function whTomato(c, u) {
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = '#c81e10'; ell(c, 0, 0, u * 0.85, u * 0.82); c.fill(); shadowOff(c);
  c.fillStyle = rg(c, 0, 0, 0, 0, 0, u * 0.8, [[0, '#ff8f7a'], [0.5, '#f1452e'], [1, '#d42a17']]); ell(c, 0, 0, u * 0.78, u * 0.75); c.fill();
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU + 0.5;
    c.fillStyle = 'rgba(255,170,140,0.85)'; ell(c, Math.cos(a) * u * 0.38, Math.sin(a) * u * 0.36, u * 0.22, u * 0.15, a); c.fill();
    c.fillStyle = '#f8d76b';
    for (let k = 0; k < 4; k++) { ell(c, Math.cos(a) * u * (0.28 + k * 0.06), Math.sin(a) * u * (0.27 + k * 0.05) + (k % 2 ? 1 : -1) * u * 0.04, u * 0.035, u * 0.022, a); c.fill(); }
  }
  c.fillStyle = '#ffd0c4'; ell(c, 0, 0, u * 0.12, u * 0.12); c.fill();
  gloss(c, -u * 0.35, -u * 0.35, u * 0.3, u * 0.14, 0.6, -0.6);
}
function whEgg(c, u) {
  [[-0.38, 0.1, 0.25], [0.38, -0.08, -0.25]].forEach(([x, y, rot]) => {
    c.save(); c.translate(x * u, y * u); c.rotate(rot);
    shadowOn(c, u * 0.1, u * 0.05);
    c.fillStyle = lg(c, 0, -u * 0.6, 0, u * 0.6, [[0, '#ffffff'], [1, '#e7e0d2']]); ell(c, 0, 0, u * 0.42, u * 0.6); c.fill(); shadowOff(c);
    c.fillStyle = rg(c, -u * 0.05, -u * 0.05, 0, 0, 0, u * 0.25, [[0, '#ffe07a'], [0.6, '#fbbd23'], [1, '#e8920b']]); ell(c, 0, u * 0.03, u * 0.24, u * 0.27); c.fill();
    gloss(c, -u * 0.06, -u * 0.06, u * 0.08, u * 0.06, 0.8);
    c.restore();
  });
}
const whKiwiCut = (c, u) => { c.save(); c.translate(-u * 0.28, -u * 0.2); whKiwi(c, u * 0.75); c.restore(); c.save(); c.translate(u * 0.32, u * 0.28); shadowOn(c, u * 0.1, u * 0.05); pcKiwi(c, u * 0.62); shadowOff(c); c.restore(); };
function whAcorn(c, u) {
  [[-0.38, 0.22, -0.35], [0.38, 0.25, 0.3], [0, -0.3, 0]].forEach(([x, y, a]) => { c.save(); c.translate(x * u, y * u); c.rotate(a); shadowOn(c, u * 0.08, u * 0.04); acornShape(c, u * 0.68); shadowOff(c); c.restore(); });
}
// 소시지: 통 소시지 하나 + 동그랗게 썬 조각 둘
function whPepperoni(c, u) {
  c.save(); c.rotate(-0.45); c.translate(-u * 0.1, -u * 0.15);
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = lg(c, 0, -u * 0.2, 0, u * 0.2, [[0, '#d9543c'], [0.45, '#b4301e'], [1, '#6e160b']]);
  c.beginPath(); c.roundRect(-u * 0.75, -u * 0.19, u * 1.5, u * 0.38, u * 0.19); c.fill(); shadowOff(c);
  c.save(); c.clip(); speckle(c, 181, 40, -u * 0.75, -u * 0.19, u * 0.75, u * 0.19, u * 0.01, u * 0.025, ['rgba(255,210,190,0.45)', 'rgba(90,15,5,0.35)']); c.restore();
  gloss(c, -u * 0.1, -u * 0.09, u * 0.5, u * 0.05, 0.6);
  c.strokeStyle = '#7a4a26'; c.lineWidth = u * 0.04; c.lineCap = 'round';
  [-1, 1].forEach(k => { c.beginPath(); c.moveTo(k * u * 0.75, 0); c.lineTo(k * u * 0.86, k * u * 0.03); c.stroke(); });
  c.restore();
  [[0.35, 0.45, 0], [-0.1, 0.55, 1]].forEach(([x, y, v]) => { c.save(); c.translate(x * u, y * u); shadowOn(c, u * 0.06, u * 0.03); tpPepperoni(c, u * 0.3, v); shadowOff(c); c.restore(); });
}
function whApple(c, u) {
  c.save(); c.translate(-u * 0.15, -u * 0.08);
  shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = rg(c, -u * 0.25, -u * 0.25, u * 0.05, 0, 0, u * 0.75, [[0, '#ff6b6b'], [0.45, '#e11d2e'], [1, '#8f0d18']]);
  c.beginPath(); c.moveTo(0, -u * 0.5);
  c.bezierCurveTo(u * 0.35, -u * 0.72, u * 0.82, -u * 0.45, u * 0.7, u * 0.1); c.bezierCurveTo(u * 0.6, u * 0.6, u * 0.2, u * 0.75, 0, u * 0.6);
  c.bezierCurveTo(-u * 0.2, u * 0.75, -u * 0.6, u * 0.6, -u * 0.7, u * 0.1); c.bezierCurveTo(-u * 0.82, -u * 0.45, -u * 0.35, -u * 0.72, 0, -u * 0.5); c.fill(); shadowOff(c);
  c.save(); c.clip(); speckle(c, 171, 40, -u * 0.7, -u * 0.6, u * 0.7, u * 0.7, u * 0.008, u * 0.018, ['rgba(255,220,160,0.45)']); c.restore();
  gloss(c, -u * 0.32, -u * 0.25, u * 0.18, u * 0.1, 0.75, -0.5);
  c.strokeStyle = '#5a3a1a'; c.lineWidth = u * 0.06; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -u * 0.48); c.quadraticCurveTo(u * 0.02, -u * 0.68, u * 0.1, -u * 0.78); c.stroke();
  c.save(); c.translate(u * 0.1, -u * 0.66); c.rotate(-0.5); leafShape(c, u * 0.4, u * 0.11); c.restore();
  c.restore();
  c.save(); c.translate(u * 0.45, u * 0.5); c.rotate(-0.3); shadowOn(c, u * 0.08, u * 0.04); appleWedge(c, u * 0.42); shadowOff(c); c.restore();
}
// 옥수수: 껍질이 벌어진 옥수수 한 자루
function whCorn(c, u) {
  c.save(); c.rotate(0.5);
  shadowOn(c, u * 0.12, u * 0.06);
  [[-1, 0.35], [1, -0.3]].forEach(([k, a]) => { c.save(); c.translate(0, u * 0.55); c.rotate(Math.PI + k * 0.35 + a * 0.2); leafShape(c, u * 0.95, u * 0.2); c.restore(); });
  c.fillStyle = '#e8a908'; c.beginPath(); c.roundRect(-u * 0.27, -u * 0.8, u * 0.54, u * 1.45, u * 0.27); c.fill(); shadowOff(c);
  c.save(); c.beginPath(); c.roundRect(-u * 0.27, -u * 0.8, u * 0.54, u * 1.45, u * 0.27); c.clip();
  for (let row = 0; row < 13; row++) for (let col = -2; col <= 2; col++) {
    const x = col * u * 0.105 + (row % 2) * u * 0.05, y = -u * 0.74 + row * u * 0.11, sh = 1 - Math.abs(col) * 0.18;
    c.fillStyle = rg(c, x - u * 0.02, y - u * 0.02, 0, x, y, u * 0.07, [[0, '#fff3a0'], [0.6, '#fcd226'], [1, '#d99a05']]);
    ell(c, x, y, u * 0.048 * sh, u * 0.05); c.fill();
  }
  c.restore();
  gloss(c, -u * 0.1, -u * 0.3, u * 0.06, u * 0.35, 0.5);
  [[-1, -0.25], [1, 0.3]].forEach(([k, a]) => { c.save(); c.translate(k * u * 0.05, u * 0.62); c.rotate(-Math.PI / 2 + k * 0.5 + a); leafShape(c, u * 0.7, u * 0.17); c.restore(); });
  c.restore();
}
const WHOLE_FN = { corn: whCorn, acorn: whAcorn, apple: whApple, pepperoni: whPepperoni, strawberry: whStrawberry, banana: whBanana, kiwi: whKiwiCut, orange: whOrange, carrot: whCarrot, honey: whHoney, bamboo: whBamboo, meat: whMeat, fish: whFish, cheese: whCheese, ham: whHam, lettuce: whLettuce, tomato: whTomato, egg: whEgg };
// 재료 칸 그림: 통째 그림이 있으면 그것, 없으면 토핑 그림 몇 개
function iconFn(id) {
  if (WHOLE_FN[id]) return WHOLE_FN[id];
  return (c, u) => { [[-0.35, -0.3], [0.35, -0.2], [0, 0.35]].forEach(([x, y], i) => { c.save(); c.translate(x * u, y * u); shadowOn(c, u * 0.08, u * 0.04); TOP_FN[id](c, u * 0.45, i); shadowOff(c); c.restore(); }); };
}
const drawIcon = (ctx, id, x, y, r, rot = 0, alpha = 1) => stamp(ctx, `ic:${id}`, 110, 2.4, iconFn(id), x, y, r, rot, alpha);
// 도마 위 통과일 (키위는 칸 그림과 달리 자르기 전 통째로)
const drawWhole = (ctx, id, x, y, r) => stamp(ctx, `wh:${id}`, 110, 2.4, id === 'kiwi' ? whKiwi : WHOLE_FN[id], x, y, r);
const drawTop = (ctx, id, x, y, r, rot, v, baked) => {
  if (id === 'cheese') return stamp(ctx, `tp:${baked ? 'cb' : 'c'}:${v}`, 70, 3, (c, u) => (baked ? tpCheeseBaked : tpCheese)(c, u, v), x, y, r, rot);
  if (PIECE_FN[id]) return stamp(ctx, `pc:${id}`, 90, 2.4, PIECE_FN[id], x, y, r * 0.95, rot);
  const k = id === 'pepperoni' && baked ? 'pb' : '';
  return stamp(ctx, `tp:${id}${k}:${v % 3}`, 70, 3.6, (c, u) => { shadowOn(c, u * 0.1, u * 0.05); TOP_FN[id](c, u, v % 3, !!k); shadowOff(c); }, x, y, r, rot);
};
const drawPiece = (ctx, id, x, y, r, rot = 0) => {
  if (PIECE_FN[id]) return stamp(ctx, `pc:${id}`, 90, 2.4, PIECE_FN[id], x, y, r, rot);
  return stamp(ctx, `tp:${id}:0`, 70, 3.6, (c, u) => { shadowOn(c, u * 0.1, u * 0.05); TOP_FN[id](c, u, 0); shadowOff(c); }, x, y, r * 0.95, rot);
};

// ═══════════════ 그릇·도구 ═══════════════
function drawPlate(ctx, x, y, rx) {
  const ry = rx * 0.32;
  ctx.save();
  shadowOn(ctx, rx * 0.12, rx * 0.05, 'rgba(60,40,20,0.3)');
  ctx.fillStyle = lg(ctx, 0, y - ry, 0, y + ry, [[0, '#ffffff'], [1, '#dcd7cf']]); ell(ctx, x, y, rx, ry); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = lg(ctx, 0, y - ry, 0, y + ry, [[0, '#ece8e1'], [1, '#ffffff']]); ell(ctx, x, y, rx * 0.72, ry * 0.68); ctx.fill();
  ctx.strokeStyle = 'rgba(160,150,135,0.35)'; ctx.lineWidth = Math.max(1, rx * 0.012); ell(ctx, x, y, rx * 0.72, ry * 0.68); ctx.stroke();
  ctx.restore();
}
function drawBoard(ctx, x, y, w, h) {
  ctx.save();
  shadowOn(ctx, w * 0.05, w * 0.02, 'rgba(60,30,10,0.35)');
  ctx.fillStyle = lg(ctx, x - w / 2, y - h / 2, x + w / 2, y + h / 2, [[0, '#e9c48f'], [0.5, '#d9a965'], [1, '#c48d4a']]);
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.12); ctx.fill(); shadowOff(ctx);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.12); ctx.clip();
  const r = rng(7); ctx.lineWidth = Math.max(1, h * 0.008);
  for (let i = 0; i < 22; i++) { const yy = y - h / 2 + r() * h; ctx.strokeStyle = `rgba(150,95,40,${0.12 + r() * 0.15})`; ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.bezierCurveTo(x - w / 6, yy + (r() - 0.5) * h * 0.08, x + w / 6, yy + (r() - 0.5) * h * 0.08, x + w / 2, yy + (r() - 0.5) * h * 0.04); ctx.stroke(); }
  ctx.restore();
  // 손잡이 구멍
  ctx.fillStyle = 'rgba(110,70,30,0.55)'; ell(ctx, x + w / 2 - h * 0.14, y - h * 0.3, h * 0.05, h * 0.05); ctx.fill();
  ctx.restore();
}
function drawPizzaBoard(ctx, x, y, R) {
  ctx.save();
  shadowOn(ctx, R * 0.1, R * 0.04, 'rgba(60,30,10,0.35)');
  ctx.fillStyle = lg(ctx, x - R, y - R, x + R, y + R, [[0, '#d6a464'], [1, '#b98243']]);
  ctx.beginPath(); ctx.roundRect(x + R * 0.9, y - R * 0.16, R * 0.5, R * 0.32, R * 0.12); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, R * 1.12, 0, TAU); ctx.fill(); shadowOff(ctx);
  ctx.strokeStyle = 'rgba(120,75,30,0.25)'; ctx.lineWidth = Math.max(1, R * 0.01);
  for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(x - R * 1.1, y + i * R * 0.2); ctx.lineTo(x + R * 1.1, y + i * R * 0.2 + R * 0.03); ctx.stroke(); }
  ctx.restore();
}
function drawKnife(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = lg(ctx, 0, -s * 0.12, 0, s * 0.1, [[0, '#f8fafc'], [0.5, '#cbd5e1'], [1, '#94a3b8']]);
  ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.08); ctx.lineTo(s * 0.75, -s * 0.06); ctx.quadraticCurveTo(s * 0.85, s * 0.02, s * 0.72, s * 0.09); ctx.lineTo(-s * 0.05, s * 0.09); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lg(ctx, 0, -s * 0.08, 0, s * 0.08, [[0, '#5b3a1e'], [1, '#2e1a0b']]);
  ctx.beginPath(); ctx.roundRect(-s * 0.5, -s * 0.07, s * 0.47, s * 0.15, s * 0.05); ctx.fill();
  ctx.fillStyle = '#d1d5db'; [-0.4, -0.25, -0.1].forEach(q => { ell(ctx, s * q, 0, s * 0.015, s * 0.015); ctx.fill(); });
  ctx.restore();
}
function drawOven(ctx, x, y, s, glow) {
  ctx.save();
  shadowOn(ctx, s * 0.12, s * 0.05, 'rgba(40,30,20,0.35)');
  ctx.fillStyle = lg(ctx, x - s, y - s, x + s, y + s, [[0, '#f1f5f9'], [0.5, '#cbd5e1'], [1, '#94a3b8']]);
  ctx.beginPath(); ctx.roundRect(x - s, y - s * 0.95, s * 2, s * 1.9, s * 0.16); ctx.fill(); shadowOff(ctx);
  // 조절 손잡이
  ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.roundRect(x - s * 0.9, y - s * 0.86, s * 1.8, s * 0.32, s * 0.08); ctx.fill();
  [-0.55, 0, 0.55].forEach((q, i) => {
    ctx.fillStyle = lg(ctx, 0, y - s * 0.8, 0, y - s * 0.6, [[0, '#e2e8f0'], [1, '#64748b']]); ell(ctx, x + q * s, y - s * 0.7, s * 0.1, s * 0.1); ctx.fill();
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = s * 0.025; ctx.beginPath(); const a = -Math.PI / 2 + (i === 1 ? glow * 4 : 0.6); ctx.moveTo(x + q * s, y - s * 0.7); ctx.lineTo(x + q * s + Math.cos(a) * s * 0.08, y - s * 0.7 + Math.sin(a) * s * 0.08); ctx.stroke();
  });
  ctx.fillStyle = glow > 0 ? '#ef4444' : '#475569'; ell(ctx, x + s * 0.82, y - s * 0.7, s * 0.04, s * 0.04); ctx.fill();
  // 창
  const wy = y - s * 0.42, wh = s * 1.15;
  ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(x - s * 0.82, wy, s * 1.64, wh, s * 0.1); ctx.fill();
  if (glow > 0) { ctx.fillStyle = rg(ctx, x, wy + wh * 0.6, 0, x, wy + wh * 0.6, s * 0.9, [[0, `rgba(255,170,60,${0.85 * glow})`], [1, `rgba(255,90,20,${0.25 * glow})`]]); ctx.beginPath(); ctx.roundRect(x - s * 0.82, wy, s * 1.64, wh, s * 0.1); ctx.fill(); }
  ctx.restore();
  return { wx: x, wy: wy + wh * 0.55, wr: s * 0.62 };
}
function drawOvenGlass(ctx, x, y, s, glow) {
  const wy = y - s * 0.42, wh = s * 1.15;
  ctx.save();
  ctx.fillStyle = 'rgba(200,220,255,0.12)'; ctx.beginPath(); ctx.roundRect(x - s * 0.82, wy, s * 1.64, wh, s * 0.1); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = s * 0.06; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(x - s * 0.6, wy + wh * 0.15); ctx.lineTo(x - s * 0.2, wy + wh * 0.15); ctx.stroke();
  // 손잡이
  ctx.fillStyle = lg(ctx, 0, wy + wh + s * 0.05, 0, wy + wh + s * 0.15, [[0, '#e2e8f0'], [1, '#64748b']]);
  ctx.beginPath(); ctx.roundRect(x - s * 0.6, wy + wh + s * 0.06, s * 1.2, s * 0.1, s * 0.05); ctx.fill();
  if (glow > 0.2) {
    ctx.strokeStyle = `rgba(255,${120 + Math.floor(glow * 80)},40,0.8)`; ctx.lineWidth = s * 0.05;
    for (let i = 0; i < 3; i++) { const yy = wy + wh * 0.92; ctx.beginPath(); ctx.moveTo(x - s * 0.6 + i * s * 0.6, yy); ctx.lineTo(x - s * 0.3 + i * s * 0.6, yy); ctx.stroke(); }
  }
  ctx.restore();
}

// ═══════════════ 완성 음식 그리기 ═══════════════
// 샌드위치: 접시 위로 층층이 (x,y = 가운데, R = 크기 기준). 돌려주는 값: 다음 층이 놓일 윗면 y
function sandwichGeom(x, y, R) { return { w: R * 1.7, base: y + R * 0.62, plateY: y + R * 0.68 }; }
// 비스듬히 위에서 본 각도: 층마다 옆면(띠) + 그 위 윗면(눌린 위에서 본 그림). 다음 층이 덮고 가장자리만 삐져나온다
const SW_K = 0.32;   // 윗면을 세로로 누르는 비율 (작을수록 옆에서 보는 쪽)
function breadSliceTop(c, u, toast) {
  const path = (k) => {
    const s = u * k;
    c.beginPath(); c.moveTo(-s * 0.95, s * 0.95); c.lineTo(-s * 0.95, -s * 0.55);
    c.bezierCurveTo(-s * 1.08, -s * 1.02, -s * 0.5, -s * 1.1, 0, -s * 0.92);
    c.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.08, -s * 1.02, s * 0.95, -s * 0.55);
    c.lineTo(s * 0.95, s * 0.95); c.quadraticCurveTo(s * 0.95, s * 1.0, s * 0.88, s * 1.0); c.lineTo(-s * 0.88, s * 1.0); c.quadraticCurveTo(-s * 0.95, s * 1.0, -s * 0.95, s * 0.95); c.closePath();
  };
  path(1); c.fillStyle = lg(c, -u, -u, u, u, [[0, '#d99a55'], [0.5, '#c27d3a'], [1, '#9c5c22']]); c.fill();
  path(0.9); c.fillStyle = rg(c, -u * 0.2, -u * 0.2, 0, 0, 0, u * 1.2, toast ? [[0, '#f6dba6'], [0.7, '#eec98a'], [1, '#e2b26a']] : [[0, '#fff6dc'], [0.7, '#f8e6bb'], [1, '#efd49a']]); c.fill();
  c.save(); path(0.9); c.clip();
  speckle(c, toast ? 341 : 331, 260, -u, -u, u, u, u * 0.006, u * 0.022, ['rgba(190,145,85,0.45)', 'rgba(215,175,115,0.4)', 'rgba(255,255,255,0.6)']);
  c.restore();
}
function friedEgg(c, u) {
  c.fillStyle = '#fffdf7'; c.beginPath();
  for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU, rr = u * (0.82 + 0.1 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.strokeStyle = 'rgba(210,190,150,0.6)'; c.lineWidth = u * 0.02; c.stroke();
  c.fillStyle = rg(c, -u * 0.08, -u * 0.08, 0, u * 0.05, 0, u * 0.32, [[0, '#ffe08a'], [0.6, '#fbbf24'], [1, '#e8930a']]); ell(c, u * 0.05, 0, u * 0.3, u * 0.3); c.fill();
  gloss(c, -u * 0.05, -u * 0.1, u * 0.12, u * 0.08, 0.85);
}
function topFaceFn(id) {
  if (id === 'breadBottom') return (c, u) => breadSliceTop(c, u, false);
  if (id === 'breadTop') return (c, u) => breadSliceTop(c, u, true);
  if (id === 'cheese') return (c, u) => { c.save(); c.rotate(0.22); shadowOn(c, u * 0.05, u * 0.02); c.fillStyle = lg(c, -u, -u, u, u, [[0, '#ffe98a'], [0.5, '#fdd040'], [1, '#f0b21c']]); c.beginPath(); c.roundRect(-u * 0.92, -u * 0.92, u * 1.84, u * 1.84, u * 0.05); c.fill(); shadowOff(c); gloss(c, -u * 0.3, -u * 0.4, u * 0.5, u * 0.15, 0.5); c.restore(); };
  if (id === 'ham') return (c, u) => { shadowOn(c, u * 0.05, u * 0.02); whHam(c, u * 1.12); shadowOff(c); };
  if (id === 'lettuce') return (c, u) => [[-0.35, -0.2, 0.95, 0], [0.4, -0.1, 0.9, 1], [0, 0.3, 1.0, 2]].forEach(([x, y, k, i]) => {
    c.save(); c.translate(x * u, y * u); const r = u * k;
    c.fillStyle = rg(c, -r * 0.2, -r * 0.2, 0, 0, 0, r, [[0, '#d9f7a8'], [0.5, '#9ad76a'], [1, '#4f9a2e']]);
    c.beginPath(); for (let j = 0; j <= 72; j++) { const a = j / 72 * TAU, rr = r * (0.8 + 0.09 * Math.sin(a * 11 + i) + 0.05 * Math.sin(a * 27 + i * 2)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.85); } c.closePath();
    shadowOn(c, u * 0.06, u * 0.03); c.fill(); shadowOff(c);
    c.strokeStyle = 'rgba(245,255,225,0.35)'; c.lineWidth = r * 0.025;
    for (let j = 0; j < 7; j++) { const a = j / 7 * TAU + i; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a + 0.3) * r * 0.4, Math.sin(a + 0.3) * r * 0.35, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.65); c.stroke(); }
    c.restore();
  });
  if (id === 'tomato') return (c, u) => [[-0.48, -0.45], [0.48, -0.45], [-0.48, 0.45], [0.48, 0.45]].forEach(([x, y]) => { c.save(); c.translate(x * u, y * u); whTomato(c, u * 0.56); c.restore(); });
  if (id === 'egg') return (c, u) => { shadowOn(c, u * 0.05, u * 0.02); friedEgg(c, u); shadowOff(c); };
  return (c, u) => {
    const pts = [[0, 0], [-0.55, -0.45], [0.55, -0.45], [-0.6, 0.45], [0.6, 0.45], [0, -0.7], [0, 0.7]];
    pts.forEach(([x, y], i) => { c.save(); c.translate(x * u, y * u); c.rotate(i * 1.3); shadowOn(c, u * 0.05, u * 0.02); (PIECE_FN[id] || TOP_FN[id])(c, u * 0.3, i % 3); shadowOff(c); c.restore(); });
  };
}
function drawTopFace(ctx, id, x, y, w, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, SW_K);
  stamp(ctx, `tv:${id}`, 160, 3, topFaceFn(id), 0, 0, w / 2);
  ctx.restore();
}
function drawSandwich(ctx, st, x, y, R, t, opts = {}) {
  const { w, base, plateY } = sandwichGeom(x, y, R);
  if (!opts.noPlate) drawPlate(ctx, x, plateY, R * 1.15);
  let top = base;
  const sway = Math.min(1, st.layers.length / 9) * Math.sin(t * 2.4) * 0.012;
  const fw = w;   // 윗면 폭 (빵 폭)
  const put = (id, dx, rot, k, faceId = id, sideId = id) => {
    const th = (LAYER_TH[id] || 0.05) * w;
    const lean = sway * k, cx = x + dx * w + lean * w * 2;
    drawLayer(ctx, sideId, cx, top - th / 2, w, rot * 0.3 + lean);
    drawTopFace(ctx, faceId, cx, top - th - fw / 2 * SW_K * 0.92, fw, rot);
    top -= th * 0.9;
  };
  put('breadBottom', 0, 0, 0);
  st.layers.forEach((l, i) => put(l.id, l.dx, l.rot * 4, i + 1));
  if (st.topBread != null) {
    const fall = easeOut(st.topBread), k = st.layers.length + 1, lean = sway * k;
    const th = LAYER_TH.breadBottom * w, off = (1 - fall) * R * 1.4;
    drawLayer(ctx, 'breadBottom', x + lean * w * 2, top - th / 2 - off, w, lean);
    drawTopFace(ctx, 'breadTop', x + lean * w * 2, top - th - fw / 2 * SW_K * 0.92 - off, fw, 0);
    top -= th;
  }
  return top;
}
// 피자 (위에서 본 동그라미)
function drawPizza(ctx, st, x, y, R, opts = {}) {
  const bk = clamp01(st.bake || 0);
  if (!opts.noBoard) drawPizzaBoard(ctx, x, y, R);
  ctx.save();
  // 반죽·테두리
  shadowOn(ctx, R * 0.06, R * 0.03, 'rgba(80,40,10,0.35)');
  const crustA = ['#f3dcae', '#e9c486'], crustB = ['#e7a453', '#b8692a'];
  const mix = (a, b) => { const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * bk)).join(',')})`; };
  ctx.fillStyle = rg(ctx, x - R * 0.2, y - R * 0.2, R * 0.6, x, y, R, [[0, mix(crustA[0], crustB[0])], [1, mix(crustA[1], crustB[1])]]);
  ell(ctx, x, y, R, R); ctx.fill(); shadowOff(ctx);
  ctx.save(); ell(ctx, x, y, R, R); ctx.clip();
  speckle(ctx, 141, 90, x - R, y - R, x + R, y + R, R * 0.006, R * 0.02, bk > 0.5 ? ['rgba(120,55,15,0.35)', 'rgba(255,230,180,0.3)'] : ['rgba(255,255,255,0.5)', 'rgba(200,160,100,0.3)']);
  ctx.restore();
  ctx.strokeStyle = `rgba(255,240,210,${0.5 - bk * 0.3})`; ctx.lineWidth = R * 0.03; ell(ctx, x, y, R * 0.9, R * 0.9); ctx.stroke();
  // 소스
  const sR = R * 0.86;
  ctx.save(); ell(ctx, x, y, sR, sR); ctx.clip();
  if (st.sauceFull >= 1 || opts.fullSauce) { ctx.fillStyle = rg(ctx, x, y, 0, x, y, sR, [[0, bk > 0.5 ? '#b52a17' : '#cf3520'], [1, bk > 0.5 ? '#8f1f0f' : '#b02a17']]); ctx.fillRect(x - sR, y - sR, sR * 2, sR * 2); }
  else {
    if (st.sauceCv) ctx.drawImage(st.sauceCv, x - R, y - R, R * 2, R * 2);
    if (st.sauceFull > 0) { ctx.globalAlpha = st.sauceFull; ctx.fillStyle = '#c3301c'; ctx.fillRect(x - sR, y - sR, sR * 2, sR * 2); ctx.globalAlpha = 1; }
  }
  if (st.sauceFull > 0 || opts.fullSauce) {
    speckle(ctx, 151, 50, x - sR, y - sR, x + sR, y + sR, R * 0.006, R * 0.016, ['rgba(90,10,0,0.35)', 'rgba(255,140,100,0.3)']);
    ctx.fillStyle = 'rgba(40,110,30,0.75)'; const r = rng(161); for (let i = 0; i < 26; i++) { ell(ctx, x + (r() - 0.5) * sR * 1.6, y + (r() - 0.5) * sR * 1.6, R * 0.012, R * 0.006, r() * 3); ctx.fill(); }
  }
  ctx.restore();
  // 녹은 치즈 바닥 (구우면)
  if (bk > 0.3 && st.toppings.some(p => p.id === 'cheese')) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (bk - 0.3) * 1.6) * 0.55;
    ctx.fillStyle = '#fcd96b'; ell(ctx, x, y, sR * 0.85, sR * 0.85); ctx.fill(); ctx.restore();
  }
  st.toppings.forEach(p => drawTop(ctx, p.id, x + p.x * R, y + p.y * R, R * (p.id === 'cheese' ? 0.2 : 0.13), p.rot, p.v, bk > 0.6));
  if (bk > 0.6) gloss(ctx, x - R * 0.3, y - R * 0.35, R * 0.5, R * 0.25, 0.25 * bk);
  ctx.restore();
}
// 과일 꼬치
function skewerGeom(x, y, R) { return { x0: x - R * 1.3, x1: x + R * 1.3, y, gap: (R * 1.9) / (SKEWER_SLOTS - 1), first: x - R * 0.95 }; }
function drawSkewer(ctx, st, x, y, R, opts = {}) {
  const g = skewerGeom(x, y, R);
  if (!opts.noPlate) drawPlate(ctx, x, y + R * 0.42, R * 1.45);
  ctx.save();
  shadowOn(ctx, R * 0.04, R * 0.03);
  ctx.fillStyle = lg(ctx, 0, y - R * 0.03, 0, y + R * 0.03, [[0, '#f0d6a6'], [0.5, '#d9b47a'], [1, '#b08650']]);
  ctx.beginPath(); ctx.moveTo(g.x0, y - R * 0.025); ctx.lineTo(g.x1 - R * 0.1, y - R * 0.025); ctx.lineTo(g.x1, y); ctx.lineTo(g.x1 - R * 0.1, y + R * 0.025); ctx.lineTo(g.x0, y + R * 0.025); ctx.closePath(); ctx.fill(); shadowOff(ctx);
  st.skewer.forEach((p, i) => drawPiece(ctx, p.id, g.first + i * g.gap, y, R * 0.3, p.rot));
  ctx.restore();
}
function drawFood(ctx, menu, st, x, y, R, t, opts) {
  if (menu === 'sandwich') drawSandwich(ctx, st, x, y, R, t, opts);
  else if (menu === 'pizza') drawPizza(ctx, st, x, y, R, opts);
  else if (menu === 'skewer') drawSkewer(ctx, st, x, y, R, opts);
  else if (menu === 'pancake') drawPancakes(ctx, st, x, y, R, t, opts);
  else if (menu === 'cake') drawCake(ctx, st, x, y, R, t, opts);
  else if (menu === 'kimbap') drawKimbapPlate(ctx, st, x, y, R, opts);
  else if (menu === 'icecream') drawIceCream(ctx, st, x, y, R, t, opts);
}
// 먹을 때 남겨 두는 그릇
function drawDish(ctx, menu, x, y, R) {
  if (menu === 'sandwich') drawPlate(ctx, x, sandwichGeom(x, y, R).plateY, R * 1.15);
  else if (menu === 'skewer') drawPlate(ctx, x, y + R * 0.42, R * 1.45);
  else if (menu === 'pizza') drawPizzaBoard(ctx, x, y, R);
  else if (menu === 'pancake') drawPlate(ctx, x, pancakeGeom(x, y, R).plateY, R * 1.15);
  else if (menu === 'cake') drawPlate(ctx, x, cakeGeom(x, y, R).plateY, R * 1.3);
  else if (menu === 'kimbap') drawPlate(ctx, x, y + R * 0.12, R * 1.35);
  else if (menu === 'icecream') drawIceSleeve(ctx, x, y, R);
}

// ═══════════════ 새 재료 (팬케이크·케이크·김밥·아이스크림) ═══════════════
function berry(c, x, y, r) {
  c.fillStyle = rg(c, x - r * 0.35, y - r * 0.4, 0, x, y, r, [[0, '#8fa3e8'], [0.35, '#4152a8'], [1, '#1b2150']]);
  ell(c, x, y, r, r); c.fill();
  c.fillStyle = 'rgba(205,215,250,0.22)'; ell(c, x - r * 0.15, y - r * 0.2, r * 0.6, r * 0.45); c.fill();
  c.fillStyle = '#211c3d'; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? r * 0.1 : r * 0.24; c.lineTo(x + r * 0.15 + Math.cos(a) * rr, y - r * 0.25 + Math.sin(a) * rr); }
  c.closePath(); c.fill();
  gloss(c, x - r * 0.4, y - r * 0.35, r * 0.25, r * 0.15, 0.6, -0.5);
}
function tpBlueberry(c, u) { berry(c, 0, 0, u * 0.6); }
function whBlueberry(c, u) { [[0.55, -0.25], [0, -0.3], [-0.4, 0.15], [0.35, 0.3], [-0.05, 0.55]].forEach(([x, y]) => { shadowOn(c, u * 0.08, u * 0.04); berry(c, x * u, y * u, u * 0.33); shadowOff(c); }); }
function butterBlock(c, w, h, d) {
  c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#ffe78f'], [1, '#efc548']]); c.beginPath(); c.roundRect(-w / 2, 0, w, h, w * 0.04); c.fill();
  c.fillStyle = '#e2b337'; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2 + d * 0.6, -d); c.lineTo(w / 2 + d * 0.6, h - d); c.lineTo(w / 2, h); c.closePath(); c.fill();
  c.fillStyle = lg(c, 0, -d, 0, 0, [[0, '#fff8cc'], [1, '#ffeb9c']]); c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 + d * 0.6, -d); c.lineTo(w / 2 + d * 0.6, -d); c.lineTo(w / 2, 0); c.closePath(); c.fill();
  gloss(c, 0, -d * 0.5, w * 0.3, d * 0.2, 0.7);
}
function tpButter(c, u) {
  c.fillStyle = 'rgba(255,214,90,0.55)'; ell(c, u * 0.05, u * 0.15, u * 0.75, u * 0.45); c.fill();
  c.save(); c.translate(-u * 0.12, 0); butterBlock(c, u * 0.7, u * 0.22, u * 0.3); c.restore();
}
function whButter(c, u) {
  shadowOn(c, u * 0.1, u * 0.05); c.fillStyle = lg(c, 0, 0, 0, u * 0.6, [[0, '#ffffff'], [1, '#dcd7cf']]); ell(c, 0, u * 0.3, u * 0.9, u * 0.36); c.fill(); shadowOff(c);
  c.save(); c.translate(-u * 0.15, -u * 0.05); butterBlock(c, u * 0.95, u * 0.38, u * 0.35); c.restore();
}
function chocoPiece(c, s) {
  c.fillStyle = '#2e1709'; c.beginPath(); c.roundRect(-s / 2, -s / 2 + s * 0.12, s, s, s * 0.1); c.fill();
  c.fillStyle = lg(c, -s / 2, -s / 2, s / 2, s / 2, [[0, '#8f5636'], [0.5, '#6a3a1e'], [1, '#4a2510']]); c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * 0.1); c.fill();
  c.strokeStyle = 'rgba(30,10,0,0.4)'; c.lineWidth = s * 0.05; c.beginPath(); c.roundRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64, s * 0.06); c.stroke();
  gloss(c, -s * 0.15, -s * 0.22, s * 0.25, s * 0.07, 0.45);
}
function tpChoco(c, u, v = 0) { c.rotate(v * 0.4 - 0.4); chocoPiece(c, u * 0.95); }
function whChoco(c, u) {
  c.save(); c.rotate(-0.25); shadowOn(c, u * 0.12, u * 0.06);
  c.fillStyle = '#3a1d0b'; c.beginPath(); c.roundRect(-u * 0.82, -u * 0.55, u * 1.64, u * 1.1, u * 0.08); c.fill(); shadowOff(c);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.save(); c.translate((i - 1) * u * 0.52, (j - 0.5) * u * 0.52); chocoPiece(c, u * 0.46); c.restore(); }
  c.restore();
}
const SPR_COLS = ['#f43f5e', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#fb923c', '#ffffff'];
function sprinkleBits(c, seed, n, rad, len) {
  const r = rng(seed); c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rad, x = Math.cos(a) * d, y = Math.sin(a) * d, an = r() * Math.PI;
    c.strokeStyle = SPR_COLS[i % SPR_COLS.length]; c.lineWidth = len * 0.42;
    c.beginPath(); c.moveTo(x - Math.cos(an) * len / 2, y - Math.sin(an) * len / 2); c.lineTo(x + Math.cos(an) * len / 2, y + Math.sin(an) * len / 2); c.stroke();
  }
}
function tpSprinkles(c, u, v = 0) { sprinkleBits(c, 201 + v, 12, u * 0.75, u * 0.24); }
function whSprinkles(c, u) {
  c.save(); c.translate(0, -u * 0.2); c.scale(1, 0.6); sprinkleBits(c, 211, 90, u * 0.72, u * 0.2); c.restore();
  shadowOn(c, u * 0.1, u * 0.05);
  c.fillStyle = lg(c, -u, 0, u, 0, [[0, 'rgba(200,220,245,0.85)'], [0.4, 'rgba(240,248,255,0.75)'], [1, 'rgba(180,200,230,0.85)']]);
  c.beginPath(); c.moveTo(-u * 0.82, -u * 0.12); c.quadraticCurveTo(-u * 0.78, u * 0.75, 0, u * 0.75); c.quadraticCurveTo(u * 0.78, u * 0.75, u * 0.82, -u * 0.12); c.closePath(); c.fill(); shadowOff(c);
  c.save(); c.beginPath(); c.moveTo(-u * 0.82, -u * 0.12); c.quadraticCurveTo(-u * 0.78, u * 0.75, 0, u * 0.75); c.quadraticCurveTo(u * 0.78, u * 0.75, u * 0.82, -u * 0.12); c.closePath(); c.clip();
  c.globalAlpha = 0.55; c.translate(0, u * 0.2); sprinkleBits(c, 213, 60, u * 0.6, u * 0.18); c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = u * 0.05; ell(c, 0, -u * 0.12, u * 0.82, u * 0.16); c.stroke();
  gloss(c, -u * 0.5, u * 0.2, u * 0.08, u * 0.25, 0.7);
}
function cherryShape(c, x, y, r, sx = 0.5) {
  c.strokeStyle = '#4d7a2a'; c.lineWidth = r * 0.16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y - r * 0.75); c.quadraticCurveTo(x + r * 0.1, y - r * 1.6, x + r * sx, y - r * 2.1); c.stroke();
  c.fillStyle = rg(c, x - r * 0.35, y - r * 0.35, 0, x, y, r, [[0, '#ff5a6e'], [0.45, '#c8102e'], [1, '#5c0412']]);
  c.beginPath(); c.moveTo(x, y - r * 0.7); c.bezierCurveTo(x + r * 1.15, y - r * 1.05, x + r * 1.1, y + r * 0.95, x, y + r * 0.95); c.bezierCurveTo(x - r * 1.1, y + r * 0.95, x - r * 1.15, y - r * 1.05, x, y - r * 0.7); c.fill();
  gloss(c, x - r * 0.4, y - r * 0.25, r * 0.22, r * 0.14, 0.75, -0.6);
}
function tpCherry(c, u) { cherryShape(c, 0, u * 0.35, u * 0.5, 0.2); }
function whCherry(c, u) {
  shadowOn(c, u * 0.1, u * 0.05); cherryShape(c, -u * 0.35, u * 0.4, u * 0.38, 0.95); cherryShape(c, u * 0.35, u * 0.45, u * 0.38, -0.85); shadowOff(c);
  c.save(); c.translate(u * 0.03, -u * 0.42); c.rotate(-0.4); leafShape(c, u * 0.5, u * 0.13); c.restore();
}
function whDanmuji(c, u) {
  [[-0.25, -0.1], [0.2, 0.15]].forEach(([x, y]) => {
    c.save(); c.translate(x * u, y * u); c.rotate(-0.5); shadowOn(c, u * 0.1, u * 0.05);
    c.fillStyle = lg(c, 0, -u * 0.13, 0, u * 0.13, [[0, '#fff59d'], [0.5, '#fcd34d'], [1, '#eab308']]); c.beginPath(); c.roundRect(-u * 0.85, -u * 0.13, u * 1.7, u * 0.26, u * 0.04); c.fill(); shadowOff(c);
    gloss(c, 0, -u * 0.06, u * 0.6, u * 0.03, 0.6); c.restore();
  });
}
function darkLeaf(c, L, wd, k = 0) {
  c.fillStyle = lg(c, 0, -wd, 0, wd, [[0, k ? '#4f9a3c' : '#3f8a32'], [0.5, '#2a6b23'], [1, '#174a14']]);
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(L * 0.3, -wd * 1.3, L * 0.85, -wd * 0.9, L, 0); c.bezierCurveTo(L * 0.85, wd * 0.9, L * 0.3, wd * 1.3, 0, 0); c.fill();
  c.strokeStyle = 'rgba(200,240,180,0.45)'; c.lineWidth = wd * 0.1; c.beginPath(); c.moveTo(0, 0); c.lineTo(L * 0.9, 0); c.stroke();
}
function whSpinach(c, u) {
  c.save(); c.translate(0, u * 0.7);
  [-0.55, -0.25, 0.05, 0.35, 0.6].forEach((a, i) => {
    c.save(); c.rotate(-Math.PI / 2 + a);
    c.strokeStyle = '#d98aa0'; c.lineWidth = u * 0.06; c.beginPath(); c.moveTo(0, 0); c.lineTo(u * 0.5, 0); c.stroke();
    c.translate(u * 0.45, 0); darkLeaf(c, u * 0.95, u * 0.3, i % 2); c.restore();
  });
  c.restore();
}
// 아이스크림 한 덩이 (반지름 u)
const ICE = { vanilla: ['#fffdf0', '#f8ebc2', '#e3cd93'], icStrawberry: ['#ffe0e8', '#f9a8bf', '#df6f8f'], icChoco: ['#a7714f', '#7a4a2e', '#4e2b16'], icMelon: ['#e6fbb8', '#a6e07c', '#6bb84a'] };
function scoopShape(c, u, id) {
  const [a, b, d] = ICE[id] || ICE.vanilla, base = u * 0.2;
  const path = () => {
    c.beginPath(); c.moveTo(-u * 0.9, base);
    c.bezierCurveTo(-u * 1.0, -u * 0.85, u * 1.0, -u * 0.85, u * 0.9, base);
    const n = 6;
    for (let i = 1; i <= n; i++) { const x0 = u * 0.9 - (i - 1) * (u * 1.8 / n), x1 = u * 0.9 - i * (u * 1.8 / n), drop = i % 2 ? 0.3 : 0.2; c.bezierCurveTo(x0 - u * 0.02, base + u * drop, x1 + u * 0.02, base + u * drop, x1, base); }
    c.closePath();
  };
  shadowOn(c, u * 0.1, u * 0.06); path(); c.fillStyle = rg(c, -u * 0.3, -u * 0.4, u * 0.05, 0, 0, u * 1.0, [[0, a], [0.55, b], [1, d]]); c.fill(); shadowOff(c);
  c.save(); path(); c.clip();
  const tex = { vanilla: ['rgba(60,40,20,0.55)'], icStrawberry: ['rgba(200,20,60,0.55)', 'rgba(255,240,245,0.6)'], icChoco: ['rgba(40,15,5,0.6)', 'rgba(200,150,110,0.35)'], icMelon: ['rgba(255,255,230,0.55)', 'rgba(70,140,40,0.35)'] }[id] || [];
  speckle(c, 231 + id.length, id === 'vanilla' ? 26 : 36, -u, -u * 0.8, u, u * 0.5, u * 0.012, id === 'icStrawberry' ? u * 0.06 : u * 0.03, tex);
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = u * 0.04;
  [[-0.5, -0.1], [0.1, -0.35], [0.45, 0.0]].forEach(([x, y]) => { c.beginPath(); c.arc(x * u, y * u, u * 0.25, 3.6, 5.6); c.stroke(); });
  c.restore();
  gloss(c, -u * 0.35, -u * 0.4, u * 0.3, u * 0.14, 0.65, -0.4);
}
function whIce(id) {
  return (c, u) => {
    shadowOn(c, u * 0.1, u * 0.05);
    c.fillStyle = lg(c, -u * 0.6, 0, u * 0.6, 0, [[0, '#f1f5f9'], [0.5, '#ffffff'], [1, '#cbd5e1']]);
    c.beginPath(); c.moveTo(-u * 0.6, u * 0.15); c.lineTo(u * 0.6, u * 0.15); c.lineTo(u * 0.42, u * 0.85); c.lineTo(-u * 0.42, u * 0.85); c.closePath(); c.fill(); shadowOff(c);
    c.strokeStyle = 'rgba(244,114,182,0.6)'; c.lineWidth = u * 0.06; [0.35, 0.6].forEach(y => { c.beginPath(); c.moveTo(-u * 0.55 + y * 0.2 * u, y * u); c.lineTo(u * 0.55 - y * 0.2 * u, y * u); c.stroke(); });
    c.save(); c.translate(0, -u * 0.15); scoopShape(c, u * 0.68, id); c.restore();
  };
}
Object.assign(TOP_FN, { butter: tpButter, blueberry: tpBlueberry, choco: tpChoco, sprinkles: tpSprinkles, cherry: tpCherry });
Object.assign(WHOLE_FN, { butter: whButter, blueberry: whBlueberry, choco: whChoco, sprinkles: whSprinkles, cherry: whCherry, danmuji: whDanmuji, spinach: whSpinach, vanilla: whIce('vanilla'), icStrawberry: whIce('icStrawberry'), icChoco: whIce('icChoco'), icMelon: whIce('icMelon') });
Object.assign(LAYER_TH, { butter: 0.04, blueberry: 0.05, choco: 0.04, sprinkles: 0.025, cherry: 0.06 });
// 위에 얹는 장식 그림 (케이크·팬케이크·아이스크림): 딸기는 통째로, 나머지는 토핑·조각 그림
const drawDeco = (ctx, id, x, y, r, rot, v) => {
  if (id === 'strawberry') return stamp(ctx, 'wh:strawberry', 110, 2.4, whStrawberry, x, y - r * 0.3, r * 1.1, rot * 0.2);
  if (id === 'honey') return stamp(ctx, 'tp:honey:0', 70, 3.6, tpHoney, x, y, r, rot);
  if (TOP_FN[id] || PIECE_FN[id]) return drawTop(ctx, id, x, y, r, rot, v || 0, false);
  return drawIcon(ctx, id, x, y, r);
};

// ── 팬케이크 ──
function pancakeGeom(x, y, R) { const w = R * 1.55; return { w, th: R * 0.15, ry: w * 0.5 * 0.3, plateY: y + R * 0.62, base: y + R * 0.56 }; }
function pancakeLayer(ctx, x, cy, w, th, ry, k) {
  const rx = w / 2;
  ctx.fillStyle = lg(ctx, 0, cy - th / 2, 0, cy + th / 2 + ry, [[0, '#c27a34'], [0.35, '#f0cf96'], [0.55, '#e7b56c'], [1, '#9c5a22']]);
  ctx.beginPath(); ctx.moveTo(x - rx, cy - th / 2); ctx.lineTo(x - rx, cy + th / 2); ctx.ellipse(x, cy + th / 2, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(x + rx, cy - th / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lg(ctx, x - rx, 0, x + rx, 0, [[0, 'rgba(90,40,10,0.25)'], [0.25, 'rgba(255,255,255,0)'], [0.8, 'rgba(255,255,255,0)'], [1, 'rgba(90,40,10,0.3)']]);
  ctx.fill();
  ctx.fillStyle = rg(ctx, x - rx * 0.2, cy - th / 2 - ry * 0.2, 0, x, cy - th / 2, rx, [[0, '#b8692a'], [0.55, '#cf8a40'], [0.85, '#e4ae63'], [1, '#efc98c']]);
  ell(ctx, x, cy - th / 2, rx, ry); ctx.fill();
  if (k != null) { ctx.save(); ell(ctx, x, cy - th / 2, rx, ry); ctx.clip(); speckle(ctx, 241 + k, 40, x - rx, cy - th / 2 - ry, x + rx, cy - th / 2 + ry, rx * 0.01, rx * 0.03, ['rgba(255,225,170,0.4)', 'rgba(120,55,15,0.3)']); ctx.restore(); }
}
function drawPancakes(ctx, st, x, y, R, t, opts = {}) {
  const g = pancakeGeom(x, y, R), n = st.cakes || 0;
  if (!opts.noPlate) drawPlate(ctx, x, g.plateY, R * 1.15);
  ctx.save(); shadowOn(ctx, R * 0.05, R * 0.02);
  for (let i = 0; i < n; i++) { const cy = g.base - g.th * (i + 0.5); pancakeLayer(ctx, x + Math.sin(i * 2.3) * R * 0.03, cy, g.w * (1 - i * 0.015), g.th, g.ry, i); if (i === 0) shadowOff(ctx); }
  ctx.restore();
  if (!n) return;
  const topY = g.base - g.th * n, rx = g.w / 2 * 0.98;
  // 꿀(시럽): 윗면에 고이고 옆으로 흘러내린다
  if (st.syrup) {
    const s = Math.min(3, st.syrup), drips = [[-0.75, 0.9], [-0.35, 1.5], [0.1, 1.1], [0.5, 1.7], [0.82, 0.8]];
    ctx.save();
    ctx.fillStyle = 'rgba(214,128,12,0.82)';
    drips.slice(0, 2 + s).forEach(([q, l]) => {
      const dx = x + q * rx, dy = topY + Math.sqrt(1 - q * q) * g.ry * 0.9, len = g.th * l * (0.6 + s * 0.25);
      ctx.beginPath(); ctx.moveTo(dx - R * 0.045, dy - 2); ctx.lineTo(dx - R * 0.03, dy + len); ctx.arc(dx, dy + len, R * 0.03, Math.PI, 0, true); ctx.lineTo(dx + R * 0.045, dy - 2); ctx.closePath(); ctx.fill();
      gloss(ctx, dx - R * 0.012, dy + len * 0.6, R * 0.008, len * 0.25, 0.6);
    });
    const pr = rx * (0.6 + s * 0.13);
    ctx.fillStyle = rg(ctx, x - pr * 0.2, topY - g.ry * 0.2, 0, x, topY, pr, [[0, 'rgba(250,190,60,0.9)'], [1, 'rgba(214,128,12,0.88)']]);
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, w = 1 + 0.06 * Math.sin(a * 5 + 1); ctx.lineTo(x + Math.cos(a) * pr * w, topY + Math.sin(a) * g.ry * (pr / rx) * w); } ctx.fill();
    gloss(ctx, x - pr * 0.3, topY - g.ry * 0.3, pr * 0.35, g.ry * 0.15, 0.75);
    ctx.restore();
  }
  [...(st.toppings || [])].sort((a, b) => a.y - b.y).forEach(p => drawDeco(ctx, p.id, x + p.x * rx * 0.72, topY + p.y * g.ry * 0.72, R * 0.13, p.rot, p.v));
}
// 프라이팬 (위에서 본 모습) + 그 위 팬케이크
function drawPan(ctx, x, y, r, hot) {
  ctx.save();
  if (hot) { ctx.fillStyle = rg(ctx, x, y, r, x, y, r * 1.25, [[0, 'rgba(255,120,40,0.45)'], [1, 'rgba(255,120,40,0)']]); ell(ctx, x, y, r * 1.25, r * 1.25); ctx.fill(); }
  shadowOn(ctx, r * 0.12, r * 0.05, 'rgba(30,20,10,0.4)');
  ctx.fillStyle = lg(ctx, 0, y - r * 0.08, 0, y + r * 0.08, [[0, '#4b4f57'], [1, '#1f2227']]);
  ctx.beginPath(); ctx.roundRect(x - r * 2.0, y - r * 0.09, r * 1.1, r * 0.18, r * 0.09); ctx.fill();
  ctx.fillStyle = lg(ctx, x - r, y - r, x + r, y + r, [[0, '#6b7280'], [0.5, '#374151'], [1, '#1f2937']]); ell(ctx, x, y, r, r); ctx.fill(); shadowOff(ctx);
  ctx.fillStyle = rg(ctx, x - r * 0.3, y - r * 0.3, 0, x, y, r * 0.9, [[0, '#4a4f58'], [0.7, '#2b2f36'], [1, '#202329']]); ell(ctx, x, y, r * 0.88, r * 0.88); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.arc(x, y, r * 0.94, 3.6, 5.2); ctx.stroke();
  ctx.restore();
}
function panCakeTop(ctx, x, y, r, side, cookK, seed) {
  ctx.save();
  if (side === 'raw') {
    ctx.fillStyle = rg(ctx, x, y, r * 0.2, x, y, r, [[0, '#fbecc8'], [0.8, '#f5dca4'], [1, `rgb(${Math.round(240 - cookK * 40)},${Math.round(205 - cookK * 60)},${Math.round(140 - cookK * 60)})`]]);
    ctx.beginPath(); for (let i = 0; i <= 36; i++) { const a = i / 36 * TAU, w = 1 + 0.025 * Math.sin(a * 7 + seed); ctx.lineTo(x + Math.cos(a) * r * w, y + Math.sin(a) * r * w); } ctx.fill();
    const rr = rng(251 + seed), nb = Math.floor(cookK * 22);
    for (let i = 0; i < 22; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * r * 0.78, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d, br = r * (0.025 + rr() * 0.04);
      if (i >= nb) continue;
      const popped = i < nb - 6;
      ctx.fillStyle = popped ? 'rgba(170,110,40,0.45)' : 'rgba(255,250,235,0.85)'; ell(ctx, bx, by, br, br); ctx.fill();
      if (!popped) { ctx.strokeStyle = 'rgba(200,150,80,0.6)'; ctx.lineWidth = Math.max(1, br * 0.25); ctx.stroke(); }
    }
  } else {
    ctx.fillStyle = rg(ctx, x - r * 0.1, y - r * 0.1, 0, x, y, r, [[0, '#b0602a'], [0.55, '#c97e3a'], [0.85, '#e2aa60'], [1, '#f0cd90']]);
    ell(ctx, x, y, r, r); ctx.fill();
    ctx.save(); ell(ctx, x, y, r, r); ctx.clip(); speckle(ctx, 261 + seed, 50, x - r, y - r, x + r, y + r, r * 0.01, r * 0.035, ['rgba(255,225,170,0.35)', 'rgba(110,50,15,0.3)']); ctx.restore();
    gloss(ctx, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.15, 0.35);
  }
  ctx.restore();
}

// ── 케이크 (조금 위에서 본 원통) ──
function cakeGeom(x, y, R) { const rx = R * 0.92, ry = rx * 0.36, h = R * 0.5, topY = y - h * 0.55; return { rx, ry, h, topY, botY: topY + h, plateY: topY + h + R * 0.08 }; }
function cakeBox(x, y, R) { const g = cakeGeom(x, y, R); return { x0: x - g.rx, y0: g.topY - g.ry, w: g.rx * 2, h: g.h + g.ry * 2 }; }
function cakePath(ctx, x, g) { ctx.beginPath(); ctx.ellipse(x, g.topY, g.rx, g.ry, 0, Math.PI, 0); ctx.lineTo(x + g.rx, g.botY); ctx.ellipse(x, g.botY, g.rx, g.ry, 0, 0, Math.PI); ctx.closePath(); }
function creamDot(ctx, x, y, r) {
  ctx.fillStyle = rg(ctx, x - r * 0.3, y - r * 0.4, 0, x, y, r, [[0, '#ffffff'], [0.7, '#fbf6ec'], [1, '#e2d8c8']]);
  ell(ctx, x, y, r, r * 0.85); ctx.fill();
  ctx.strokeStyle = 'rgba(205,190,170,0.6)'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.5, 0.3, 4.2); ctx.stroke();
}
function drawCake(ctx, st, x, y, R, t, opts = {}) {
  const g = cakeGeom(x, y, R);
  if (!opts.noPlate) drawPlate(ctx, x, g.plateY, R * 1.3);
  ctx.save();
  // 스펀지 (생크림 바르기 전)
  shadowOn(ctx, R * 0.06, R * 0.03);
  cakePath(ctx, x, g); ctx.fillStyle = lg(ctx, x - g.rx, 0, x + g.rx, 0, [[0, '#cf9550'], [0.3, '#f2cd88'], [0.7, '#eec27a'], [1, '#c48a44']]); ctx.fill(); shadowOff(ctx);
  ctx.save(); cakePath(ctx, x, g); ctx.clip();
  speckle(ctx, 271, 140, x - g.rx, g.topY, x + g.rx, g.botY + g.ry, R * 0.004, R * 0.012, ['rgba(160,100,40,0.35)', 'rgba(255,240,200,0.4)']);
  [0.36, 0.68].forEach(q => { const yy = g.topY + g.h * q; ctx.fillStyle = 'rgba(255,250,240,0.95)'; ctx.beginPath(); ctx.ellipse(x, yy, g.rx, g.ry, 0, 0, Math.PI); ctx.ellipse(x, yy + g.h * 0.06, g.rx, g.ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); });
  ctx.restore();
  ctx.fillStyle = rg(ctx, x - g.rx * 0.2, g.topY - g.ry * 0.3, 0, x, g.topY, g.rx, [[0, '#f8dc9e'], [1, '#e6b86e']]); ell(ctx, x, g.topY, g.rx, g.ry); ctx.fill();
  ctx.save(); ell(ctx, x, g.topY, g.rx, g.ry); ctx.clip(); speckle(ctx, 281, 60, x - g.rx, g.topY - g.ry, x + g.rx, g.topY + g.ry, R * 0.005, R * 0.014, ['rgba(170,110,50,0.35)']); ctx.restore();
  // 생크림
  const full = st.rub && st.rub.full >= 1 || opts.fullCream;
  if (full) {
    cakePath(ctx, x, g); ctx.fillStyle = lg(ctx, x - g.rx, 0, x + g.rx, 0, [[0, '#e3dacb'], [0.25, '#fffdf8'], [0.7, '#f9f4ea'], [1, '#d9cfbf']]); ctx.fill();
    ctx.fillStyle = rg(ctx, x - g.rx * 0.25, g.topY - g.ry * 0.3, 0, x, g.topY, g.rx, [[0, '#ffffff'], [1, '#f3ece0']]); ell(ctx, x, g.topY, g.rx, g.ry); ctx.fill();
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; creamDot(ctx, x + Math.cos(a) * g.rx * 0.97, g.botY + Math.sin(a) * g.ry * 0.97, R * 0.07); }
  } else if (st.rub && st.rub.cv) {
    ctx.save(); cakePath(ctx, x, g); ctx.clip(); const b = cakeBox(x, y, R); ctx.drawImage(st.rub.cv, b.x0, b.y0, b.w, b.h);
    if (st.rub.full > 0) { ctx.globalAlpha = st.rub.full; ctx.fillStyle = '#fffaf1'; ctx.fillRect(b.x0, b.y0, b.w, b.h); }
    ctx.restore();
  }
  // 윗면 장식 + 초 (뒤에서 앞으로)
  const items = [...(st.toppings || []).map(p => ({ ...p, kind: 'top' })), ...(st.candles || []).map((c, i) => ({ ...c, kind: 'candle', i }))].sort((a, b) => a.y - b.y);
  items.forEach(p => {
    const px = x + p.x * g.rx * 0.78, py = g.topY + p.y * g.ry * 0.78;
    if (p.kind === 'top') { drawDeco(ctx, p.id, px, py, R * 0.17, p.rot, p.v); return; }
    if (p.t0 != null && t != null && t < p.t0) return;
    const drop = p.t0 != null && t != null ? 1 - easeOut(clamp01((t - p.t0) / 0.35)) : 0;
    const ch = R * 0.32, cw = R * 0.055, cy = py - drop * R * 0.6;
    ctx.fillStyle = ['#f9a8d4', '#93c5fd', '#fde68a'][p.i % 3]; ctx.beginPath(); ctx.roundRect(px - cw / 2, cy - ch, cw, ch, cw * 0.3); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(px - cw / 2, cy - ch, cw, ch, cw * 0.3); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = cw * 0.35; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(px - cw, cy - ch + k * cw * 1.4); ctx.lineTo(px + cw, cy - ch + k * cw * 1.4 - cw * 1.1); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = Math.max(1, cw * 0.18); ctx.beginPath(); ctx.moveTo(px, cy - ch); ctx.lineTo(px, cy - ch - cw * 0.6); ctx.stroke();
    if (p.lit && drop < 0.05) {
      const fl = 1 + Math.sin((t || 0) * 23 + p.i * 2) * 0.12, fy = cy - ch - cw * 0.6;
      ctx.fillStyle = rg(ctx, px, fy - cw * 0.8, 0, px, fy - cw * 0.8, cw * 3.5, [[0, 'rgba(255,220,120,0.55)'], [1, 'rgba(255,200,80,0)']]); ell(ctx, px, fy - cw * 0.8, cw * 3.5, cw * 3.5); ctx.fill();
      ctx.fillStyle = rg(ctx, px, fy - cw * 0.5, 0, px, fy - cw * 0.9, cw * 1.6 * fl, [[0, '#ffffff'], [0.35, '#fff3a0'], [0.75, '#fb923c'], [1, 'rgba(239,68,68,0.6)']]);
      ctx.beginPath(); ctx.moveTo(px, fy - cw * 2.4 * fl); ctx.bezierCurveTo(px + cw * 1.0, fy - cw * 0.9, px + cw * 0.6, fy + cw * 0.1, px, fy + cw * 0.1); ctx.bezierCurveTo(px - cw * 0.6, fy + cw * 0.1, px - cw * 1.0, fy - cw * 0.9, px, fy - cw * 2.4 * fl); ctx.fill();
    }
  });
  ctx.restore();
}

// ── 김밥 ──
function kimbapGeom(x, y, R) { const w = R * 2.3, h = R * 1.5; return { mx: x, my: y, mw: w, mh: h, lx0: x - w * 0.43, ly0: y - h * 0.4, lw: w * 0.86, lh: h * 0.8 }; }
function kimbapBox(x, y, R) { const g = kimbapGeom(x, y, R); return { x0: g.lx0, y0: g.ly0, w: g.lw, h: g.lh }; }
const KB_COL = { danmuji: ['#fde047', '#eab308'], spinach: ['#2f7a2a', '#1b4d18'], ham: ['#f6a3b0', '#d9677a'], egg: ['#fde68a', '#f5c33b'], carrot: ['#fb923c', '#ea580c'], cheese: ['#fde047', '#f2b21c'], meat: ['#8a4a22', '#4e250c'], fish: ['#e7e5e4', '#a8a29e'], pepperoni: ['#d24a33', '#8a1d10'], banana: ['#fbf0c4', '#e2c770'], honey: ['#f5a524', '#c46f06'], bamboo: ['#5cbf4f', '#2a7a22'], acorn: ['#b07a40', '#6b4420'], apple: ['#f8ecc4', '#d62839'], corn: ['#fcd226', '#d99a05'] };
const kbCol = (id) => KB_COL[id] || ['#d4d4d8', '#a1a1aa'];
let riceStampCv = null;
function riceStamp() {
  if (riceStampCv) return riceStampCv;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); const r = rng(291);
  for (let i = 0; i < 70; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 28; const x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d; c.fillStyle = r() > 0.25 ? '#ffffff' : '#ece8de'; ell(c, x, y, 3.4, 2.1, r() * 3); c.fill(); c.strokeStyle = 'rgba(170,165,150,0.5)'; c.lineWidth = 0.6; c.stroke(); }
  riceStampCv = cv; return cv;
}
function drawMat(ctx, g) {
  ctx.save(); shadowOn(ctx, g.mw * 0.03, g.mw * 0.01, 'rgba(60,40,10,0.3)');
  ctx.fillStyle = '#c9b77a'; ctx.beginPath(); ctx.roundRect(g.mx - g.mw / 2, g.my - g.mh / 2, g.mw, g.mh, g.mh * 0.03); ctx.fill(); shadowOff(ctx);
  const n = 22, sh = g.mh / n;
  for (let i = 0; i < n; i++) { const yy = g.my - g.mh / 2 + i * sh; ctx.fillStyle = lg(ctx, 0, yy, 0, yy + sh, [[0, '#efe2b0'], [0.5, '#d8c48a'], [1, '#b39d5e']]); ctx.beginPath(); ctx.roundRect(g.mx - g.mw / 2, yy + sh * 0.06, g.mw, sh * 0.88, sh * 0.4); ctx.fill(); }
  ctx.strokeStyle = 'rgba(120,90,40,0.6)'; ctx.lineWidth = Math.max(1, g.mw * 0.004);
  [-0.38, -0.13, 0.13, 0.38].forEach(q => { ctx.beginPath(); ctx.moveTo(g.mx + q * g.mw, g.my - g.mh / 2); ctx.lineTo(g.mx + q * g.mw, g.my + g.mh / 2); ctx.stroke(); });
  ctx.restore();
}
function drawLaver(ctx, x0, y0, w, h) {
  ctx.save(); ctx.fillStyle = lg(ctx, x0, y0, x0 + w, y0 + h, [[0, '#2b3a2a'], [0.5, '#1a241a'], [1, '#243324']]); ctx.fillRect(x0, y0, w, h);
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  const r = rng(301); ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const yy = y0 + r() * h; ctx.strokeStyle = `rgba(${r() > 0.5 ? '90,120,80' : '10,15,10'},${0.2 + r() * 0.25})`; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.bezierCurveTo(x0 + w * 0.3, yy + (r() - 0.5) * 12, x0 + w * 0.7, yy + (r() - 0.5) * 12, x0 + w, yy + (r() - 0.5) * 6); ctx.stroke(); }
  ctx.restore();
}
// 밥 위에 가로로 놓은 재료 한 줄 (위에서 본 모습)
function drawStrip(ctx, id, x0, x1, y, th, seed) {
  const [a, b] = kbCol(id), w = x1 - x0;
  ctx.save(); shadowOn(ctx, th * 0.3, th * 0.12);
  if (id === 'spinach') {
    for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(x0 + (i + 0.3) * w / 9, y + Math.sin(i * 1.7 + seed) * th * 0.15); ctx.rotate((i % 2 ? 0.25 : -0.2)); darkLeaf(ctx, w / 7, th * 0.55, i % 2); ctx.restore(); }
  } else if (id === 'carrot') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const yy = y + (i - 3) * th * 0.13; ctx.strokeStyle = i % 2 ? a : b; ctx.lineWidth = th * 0.16; ctx.beginPath(); ctx.moveTo(x0 + (i % 3) * th * 0.3, yy); ctx.lineTo(x1 - (i % 2) * th * 0.4, yy + th * 0.03); ctx.stroke(); }
  } else if (KB_COL[id] && !['fish', 'meat', 'acorn', 'apple', 'corn', 'bamboo', 'banana', 'honey'].includes(id)) {
    ctx.fillStyle = lg(ctx, 0, y - th / 2, 0, y + th / 2, [[0, a], [1, b]]); ctx.beginPath(); ctx.roundRect(x0, y - th / 2, w, th, th * 0.2); ctx.fill(); shadowOff(ctx);
    gloss(ctx, x0 + w * 0.4, y - th * 0.2, w * 0.35, th * 0.12, 0.55);
    if (id === 'egg') { ctx.fillStyle = 'rgba(200,130,30,0.25)'; speckle(ctx, 311, 18, x0, y - th / 2, x1, y + th / 2, th * 0.04, th * 0.1, ['rgba(200,130,30,0.3)']); }
  } else {
    shadowOff(ctx); const n = Math.max(4, Math.round(w / (th * 1.1)));
    for (let i = 0; i < n; i++) drawTop(ctx, id, x0 + (i + 0.5) * w / n, y, th * 0.7, (i * 1.3 + seed) % TAU, i % 3, false);
  }
  ctx.restore();
}
// 김밥 단면 (지름 1 기준 그림을 저장해 두고 크기만 바꿔 복사)
function kbFaceFn(fills) {
  return (c, u) => {
    c.fillStyle = '#18221a'; ell(c, 0, 0, u, u); c.fill();
    c.strokeStyle = 'rgba(120,150,110,0.35)'; c.lineWidth = u * 0.03; c.beginPath(); c.arc(0, 0, u * 0.97, 3.5, 5.4); c.stroke();
    c.fillStyle = '#fbfaf5'; ell(c, 0, 0, u * 0.88, u * 0.88); c.fill();
    c.save(); ell(c, 0, 0, u * 0.88, u * 0.88); c.clip();
    const r = rng(321); for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * u * 0.88; c.strokeStyle = 'rgba(180,175,160,0.55)'; c.lineWidth = u * 0.012; ell(c, Math.cos(a) * d, Math.sin(a) * d, u * 0.07, u * 0.04, r() * 3); c.stroke(); }
    c.restore();
    const n = fills.length;
    fills.forEach((id, i) => {
      const [a, b] = kbCol(id), an = i / Math.max(1, n) * TAU + 0.6, d = n > 1 ? u * (n > 4 ? 0.3 : 0.24) : 0, s = u * (n > 4 ? 0.17 : 0.21);
      const fx = Math.cos(an) * d, fy = Math.sin(an) * d;
      c.fillStyle = rg(c, fx - s * 0.3, fy - s * 0.3, 0, fx, fy, s * 1.2, [[0, a], [1, b]]);
      if (id === 'spinach' || id === 'carrot') { for (let k = 0; k < 4; k++) { ell(c, fx + Math.cos(k * 1.6) * s * 0.45, fy + Math.sin(k * 1.6) * s * 0.45, s * 0.45, s * 0.35, k); c.fill(); } }
      else { c.beginPath(); c.roundRect(fx - s, fy - s, s * 2, s * 2, s * 0.35); c.fill(); }
      gloss(c, fx - s * 0.3, fy - s * 0.4, s * 0.4, s * 0.15, 0.45);
    });
  };
}
const drawKbFace = (ctx, fills, x, y, rx, ry) => { ctx.save(); ctx.translate(x, y); ctx.scale(rx / ry, 1); stamp(ctx, `kb:${fills.join(',')}`, 80, 2.1, kbFaceFn(fills), 0, 0, ry); ctx.restore(); };
const kbFills = (st) => { const f = (st.layers || []).map(l => l.id); return f.length ? f.slice(0, 6) : ['danmuji']; };
// 김밥 한 줄을 눕혀 놓은 모습 (cut 조각만큼 오른쪽부터 썰려 벌어진다)
function drawKimbapRoll(ctx, st, x, y, len, rr, cut) {
  const n = 8, segW = len / n, fills = kbFills(st);
  ctx.save();
  for (let j = 0; j < n; j++) {
    const fromRight = n - 1 - j, isCut = fromRight < cut, gap = isCut ? (cut - fromRight) * rr * 0.1 + rr * 0.5 : 0;
    const sx = x - len / 2 + j * segW + (isCut ? gap : 0), w = isCut ? segW * 0.92 : segW + 1;
    shadowOn(ctx, rr * 0.25, rr * 0.12);
    ctx.fillStyle = lg(ctx, 0, y - rr, 0, y + rr, [[0, '#3a4a38'], [0.35, '#1d281d'], [1, '#0d140d']]);
    ctx.beginPath(); ctx.roundRect(sx, y - rr, w, rr * 2, (j === 0 || isCut) ? rr * 0.25 : 0); ctx.fill(); shadowOff(ctx);
    ctx.strokeStyle = 'rgba(160,190,150,0.25)'; ctx.lineWidth = rr * 0.08; ctx.beginPath(); ctx.moveTo(sx + 2, y - rr * 0.55); ctx.lineTo(sx + w - 2, y - rr * 0.55); ctx.stroke();
    if (isCut || fromRight === cut) drawKbFace(ctx, fills, sx + w, y, rr * 0.38, rr);
  }
  ctx.restore();
}
function drawKimbapPlate(ctx, st, x, y, R, opts = {}) {
  if (!opts.noPlate) drawPlate(ctx, x, y + R * 0.12, R * 1.35);
  const r = R * 0.24, fills = kbFills(st);
  const spots = [];
  for (let i = 0; i < 4; i++) spots.push([x + (i - 1.5) * r * 1.9 + r * 0.5, y - r * 0.55]);
  for (let i = 0; i < 4; i++) spots.push([x + (i - 1.5) * r * 1.9 - r * 0.3, y + r * 0.45]);
  spots.forEach(([sx, sy], i) => {
    ctx.save(); shadowOn(ctx, r * 0.3, r * 0.15);
    ctx.fillStyle = lg(ctx, 0, sy, 0, sy + r * 0.45, [[0, '#2a3a28'], [1, '#0d140d']]); ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.35, r, r * 0.78, 0, 0, Math.PI); ctx.lineTo(sx - r, sy); ctx.ellipse(sx, sy, r, r * 0.78, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); shadowOff(ctx);
    drawKbFace(ctx, fills, sx, sy, r, r * 0.78 * (1 + (i % 2) * 0.02));
    ctx.restore();
  });
}

// ── 아이스크림 콘 ──
function iceGeom(x, y, R) { const sr = R * 0.36, y0 = y + R * 0.32; return { sr, y0, cw: R * 0.32, tip: y0 + R * 0.95, sc: (i) => y0 - sr * 0.3 - i * sr * 0.92 }; }
// 콘 아래 그림자 (먹을 때도 남김)
function drawIceSleeve(ctx, x, y, R) {
  const g = iceGeom(x, y, R);
  ctx.save(); ctx.fillStyle = 'rgba(70,40,10,0.22)'; ell(ctx, x, g.tip + R * 0.04, R * 0.3, R * 0.07); ctx.fill(); ctx.restore();
}
function drawCone(ctx, x, g, R) {
  ctx.save();
  const path = () => { ctx.beginPath(); ctx.moveTo(x - g.cw, g.y0); ctx.lineTo(x + g.cw, g.y0); ctx.lineTo(x + R * 0.03, g.tip); ctx.quadraticCurveTo(x, g.tip + R * 0.03, x - R * 0.03, g.tip); ctx.closePath(); };
  shadowOn(ctx, R * 0.06, R * 0.03); path(); ctx.fillStyle = lg(ctx, x - g.cw, 0, x + g.cw, 0, [[0, '#c9853a'], [0.4, '#eab56a'], [1, '#b9722b']]); ctx.fill(); shadowOff(ctx);
  ctx.save(); path(); ctx.clip();
  ctx.strokeStyle = 'rgba(140,80,25,0.65)'; ctx.lineWidth = R * 0.018;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(x + i * R * 0.09, g.y0 - R * 0.1); ctx.lineTo(x + i * R * 0.09 + R * 0.7, g.tip + R * 0.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + i * R * 0.09, g.y0 - R * 0.1); ctx.lineTo(x + i * R * 0.09 - R * 0.7, g.tip + R * 0.1); ctx.stroke(); }
  // 종이 띠
  ctx.fillStyle = lg(ctx, x - g.cw, 0, x + g.cw, 0, [[0, '#f472b6'], [0.45, '#fbcfe8'], [1, '#db2777']]);
  const sy = g.y0 + (g.tip - g.y0) * 0.45; ctx.fillRect(x - g.cw, sy, g.cw * 2, g.tip - sy + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = -3; i <= 3; i++) { ell(ctx, x + i * g.cw * 0.3, sy + R * 0.12, R * 0.025, R * 0.025); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = lg(ctx, 0, g.y0 - R * 0.05, 0, g.y0 + R * 0.05, [[0, '#f0c27a'], [1, '#b9722b']]); ctx.beginPath(); ctx.roundRect(x - g.cw - R * 0.02, g.y0 - R * 0.04, g.cw * 2 + R * 0.04, R * 0.08, R * 0.04); ctx.fill();
  ctx.restore();
}
function drawIceCream(ctx, st, x, y, R, t, opts = {}) {
  const g = iceGeom(x, y, R), sc = st.scoops || [];
  if (!opts.noPlate) drawIceSleeve(ctx, x, y, R);
  drawCone(ctx, x, g, R);
  const sway = Math.min(1, sc.length / 4) * Math.sin((t || 0) * 2.4) * R * 0.02;
  const tops = st.toppings || [];
  const drawTops = (si, sx, sy) => tops.filter(p => p.si === si).forEach(p => drawDeco(ctx, p.id, sx + p.x * g.sr, sy + p.y * g.sr, p.id === 'cherry' ? g.sr * 0.42 : g.sr * 0.36, p.rot, p.v));
  drawTops(-1, x, g.y0);
  sc.forEach((id, i) => {
    const sx = x + sway * i + Math.sin(i * 2.1) * R * 0.03, sy = g.sc(i);
    stamp(ctx, `ice:${id}`, 100, 2.6, (c, u) => scoopShape(c, u, id), sx, sy, g.sr);
    drawTops(i, sx, sy);
  });
}

// ═══════════════ 손님 ═══════════════
function drawRabbit(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  ctx.fillStyle = '#ffffff'; ell(ctx, S * 0.33, -S * 0.12, S * 0.09, S * 0.08); ctx.fill();
  sitBody(ctx, S, t, happy, { body: '#ffffff', dark: '#e8e2da', belly: '#fffaf5', paw: '#fde4e8', line: '#d6cec5' });
  const hy = -S * 0.78, wig = Math.sin(t * 1.7) * 0.06;
  [-1, 1].forEach(k => {
    ctx.save(); ctx.translate(k * S * 0.1, hy - S * 0.17); ctx.rotate(k * 0.16 + (k > 0 ? wig : 0));
    ctx.fillStyle = lg(ctx, -S * 0.07, 0, S * 0.07, 0, [[0, '#ffffff'], [1, '#ebe5dd']]); ell(ctx, 0, -S * 0.2, S * 0.075, S * 0.23); ctx.fill();
    ctx.strokeStyle = '#d6cec5'; ctx.lineWidth = Math.max(1, S * 0.008); ctx.stroke();
    ctx.fillStyle = '#f8bfcb'; ell(ctx, 0, -S * 0.19, S * 0.038, S * 0.17); ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.08, S * 0.03, 0, hy, S * 0.3, [[0, '#ffffff'], [1, '#ece6de']]);
  ell(ctx, 0, hy, S * 0.27, S * 0.24); ctx.fill(); ctx.strokeStyle = '#d6cec5'; ctx.lineWidth = Math.max(1.5, S * 0.01); ctx.stroke();
  friendlyEyes(ctx, S, hy - S * 0.015, t, 0.1);
  ctx.fillStyle = '#f28ba1'; ctx.beginPath(); ctx.moveTo(-S * 0.03, hy + S * 0.05); ctx.lineTo(S * 0.03, hy + S * 0.05); ctx.lineTo(0, hy + S * 0.08); ctx.closePath(); ctx.fill();
  smileMouth(ctx, S, hy + S * 0.11, '#a26b6b', mouth);
  if (mouth < 0.05) { ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d6cec5'; ctx.lineWidth = Math.max(1, S * 0.005); ctx.beginPath(); ctx.roundRect(-S * 0.022, hy + S * 0.125, S * 0.044, S * 0.035, S * 0.008); ctx.fill(); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(120,100,90,0.45)'; ctx.lineWidth = Math.max(1, S * 0.005);
  [-1, 1].forEach(k => [-0.01, 0.02].forEach(q => { ctx.beginPath(); ctx.moveTo(k * S * 0.08, hy + S * (0.08 + q)); ctx.lineTo(k * S * 0.27, hy + S * (0.06 + q * 2)); ctx.stroke(); }));
  ctx.fillStyle = 'rgba(244,114,182,0.35)'; [-1, 1].forEach(k => { ell(ctx, k * S * 0.17, hy + S * 0.07, S * 0.045, S * 0.028); ctx.fill(); });
  ctx.restore();
}
function drawBear(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  sitBody(ctx, S, t, happy, { body: '#b98352', dark: '#8a5730', belly: '#e9cba0', paw: '#e9cba0', line: '#74461f', arm: '#a8733f' });
  const hy = -S * 0.78;
  [-1, 1].forEach(k => {
    ctx.fillStyle = '#a06a3a'; ell(ctx, k * S * 0.21, hy - S * 0.19, S * 0.09, S * 0.09); ctx.fill();
    ctx.fillStyle = '#e3b98a'; ell(ctx, k * S * 0.21, hy - S * 0.185, S * 0.05, S * 0.05); ctx.fill();
  });
  ctx.fillStyle = rg(ctx, -S * 0.08, hy - S * 0.1, S * 0.03, 0, hy, S * 0.33, [[0, '#cf9a69'], [1, '#97603a']]);
  ell(ctx, 0, hy, S * 0.3, S * 0.265); ctx.fill(); ctx.strokeStyle = '#74461f'; ctx.lineWidth = Math.max(1.5, S * 0.01); ctx.stroke();
  ctx.fillStyle = '#efd6b3'; ell(ctx, 0, hy + S * 0.1, S * 0.13, S * 0.095); ctx.fill();
  friendlyEyes(ctx, S, hy - S * 0.02, t, 0.11);
  ctx.fillStyle = '#2b1a10'; ell(ctx, 0, hy + S * 0.06, S * 0.045, S * 0.032); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, -S * 0.012, hy + S * 0.05, S * 0.012, S * 0.008); ctx.fill();
  smileMouth(ctx, S, hy + S * 0.13, '#2b1a10', mouth);
  ctx.fillStyle = 'rgba(244,114,182,0.3)'; [-1, 1].forEach(k => { ell(ctx, k * S * 0.2, hy + S * 0.08, S * 0.045, S * 0.028); ctx.fill(); });
  ctx.restore();
}
const lw = (S, k = 0.01) => Math.max(1.5, S * k);
const blush = (ctx, S, hy, dx = 0.18, a = 0.32) => { ctx.fillStyle = `rgba(244,114,182,${a})`; [-1, 1].forEach(k => { ell(ctx, k * S * dx, hy + S * 0.075, S * 0.045, S * 0.028); ctx.fill(); }); };
// 강아지: 늘어진 갈색 귀 + 흰 주둥이 + 흔드는 꼬리
function drawDog(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  const wag = Math.sin(t * (happy ? 14 : 5)) * 0.35;
  ctx.save(); ctx.translate(S * 0.26, -S * 0.14); ctx.rotate(-0.9 + wag);
  ctx.fillStyle = '#c98b4c'; ell(ctx, 0, -S * 0.13, S * 0.045, S * 0.14); ctx.fill(); ctx.restore();
  sitBody(ctx, S, t, happy, { body: '#e6b47c', dark: '#c98b4c', belly: '#fff6e8', paw: '#fff6e8', line: '#b07a40' });
  const hy = -S * 0.78;
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.1, S * 0.03, 0, hy, S * 0.32, [[0, '#f2c792'], [1, '#d99c5b']]);
  ell(ctx, 0, hy, S * 0.27, S * 0.25); ctx.fill(); ctx.strokeStyle = '#b07a40'; ctx.lineWidth = lw(S); ctx.stroke();
  // 한쪽 눈 얼룩
  ctx.fillStyle = 'rgba(140,85,40,0.55)'; ell(ctx, S * 0.1, hy - S * 0.04, S * 0.08, S * 0.07, 0.3); ctx.fill();
  [-1, 1].forEach(k => {
    ctx.save(); ctx.translate(k * S * 0.22, hy - S * 0.13); ctx.rotate(k * (0.25 + Math.sin(t * 2 + k) * 0.05));
    ctx.fillStyle = lg(ctx, 0, 0, 0, S * 0.3, [[0, '#8a5328'], [1, '#6b3d1a']]); ell(ctx, 0, S * 0.13, S * 0.085, S * 0.17); ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = '#fff6e8'; ell(ctx, 0, hy + S * 0.1, S * 0.13, S * 0.095); ctx.fill();
  friendlyEyes(ctx, S, hy - S * 0.02, t, 0.1);
  ctx.fillStyle = '#2b1a10'; ell(ctx, 0, hy + S * 0.055, S * 0.05, S * 0.035); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, -S * 0.015, hy + S * 0.045, S * 0.014, S * 0.009); ctx.fill();
  smileMouth(ctx, S, hy + S * 0.125, '#2b1a10', mouth);
  if (happy && mouth < 0.05) { ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.roundRect(-S * 0.022, hy + S * 0.13, S * 0.044, S * 0.05, S * 0.02); ctx.fill(); }
  blush(ctx, S, hy, 0.19, 0.28);
  ctx.restore();
}
// 원숭이: 동그란 귀 + 하트 모양 얼굴 + 말린 꼬리
function drawMonkey(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  const sw = Math.sin(t * 2) * S * 0.03;
  ctx.strokeStyle = '#7a4a26'; ctx.lineWidth = S * 0.045; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(S * 0.25, -S * 0.1); ctx.bezierCurveTo(S * 0.6, -S * 0.1, S * 0.62, -S * 0.5, S * 0.45 + sw, -S * 0.52); ctx.arc(S * 0.45 + sw, -S * 0.46, S * 0.06, -Math.PI / 2, Math.PI * 0.9, true); ctx.stroke();
  sitBody(ctx, S, t, happy, { body: '#94603a', dark: '#6e4224', belly: '#f0d2ad', paw: '#e8c39b', line: '#5a3418' });
  const hy = -S * 0.78;
  [-1, 1].forEach(k => {
    ctx.fillStyle = '#7a4a26'; ell(ctx, k * S * 0.29, hy, S * 0.1, S * 0.1); ctx.fill();
    ctx.fillStyle = '#f0c9a0'; ell(ctx, k * S * 0.29, hy, S * 0.058, S * 0.058); ctx.fill();
  });
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.1, S * 0.03, 0, hy, S * 0.32, [[0, '#a8724a'], [1, '#6e4224']]);
  ell(ctx, 0, hy, S * 0.27, S * 0.26); ctx.fill(); ctx.strokeStyle = '#5a3418'; ctx.lineWidth = lw(S); ctx.stroke();
  ctx.fillStyle = '#f3d3b0';
  [-1, 1].forEach(k => { ell(ctx, k * S * 0.085, hy - S * 0.03, S * 0.1, S * 0.1); ctx.fill(); });
  ell(ctx, 0, hy + S * 0.09, S * 0.17, S * 0.12); ctx.fill();
  friendlyEyes(ctx, S, hy - S * 0.03, t, 0.085);
  ctx.fillStyle = '#5a3418'; [-1, 1].forEach(k => { ell(ctx, k * S * 0.018, hy + S * 0.055, S * 0.011, S * 0.008); ctx.fill(); });
  smileMouth(ctx, S, hy + S * 0.12, '#5a3418', mouth);
  blush(ctx, S, hy, 0.16, 0.3);
  ctx.restore();
}
// 생쥐: 커다란 둥근 분홍 귀 + 가는 꼬리 + 수염
function drawMouse(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  ctx.strokeStyle = '#f2a6b4'; ctx.lineWidth = S * 0.02; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(S * 0.25, -S * 0.08); ctx.bezierCurveTo(S * 0.55, -S * 0.02, S * 0.62, -S * 0.3, S * 0.5 + Math.sin(t * 2.4) * S * 0.04, -S * 0.42); ctx.stroke();
  sitBody(ctx, S, t, happy, { body: '#c9ced6', dark: '#9aa1ac', belly: '#f4f5f7', paw: '#f8c6d0', line: '#858c97' });
  const hy = -S * 0.76;
  [-1, 1].forEach(k => {
    ctx.fillStyle = '#b3b9c3'; ell(ctx, k * S * 0.23, hy - S * 0.18, S * 0.16, S * 0.15); ctx.fill();
    ctx.strokeStyle = '#858c97'; ctx.lineWidth = lw(S, 0.008); ctx.stroke();
    ctx.fillStyle = rg(ctx, k * S * 0.23, hy - S * 0.18, 0, k * S * 0.23, hy - S * 0.18, S * 0.11, [[0, '#fbd0d9'], [1, '#f2a6b4']]); ell(ctx, k * S * 0.23, hy - S * 0.175, S * 0.105, S * 0.1); ctx.fill();
  });
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.1, S * 0.03, 0, hy, S * 0.3, [[0, '#dde1e7'], [1, '#a3aab5']]);
  ell(ctx, 0, hy, S * 0.25, S * 0.23); ctx.fill(); ctx.strokeStyle = '#858c97'; ctx.lineWidth = lw(S); ctx.stroke();
  ctx.fillStyle = '#f4f5f7'; ell(ctx, 0, hy + S * 0.1, S * 0.11, S * 0.08); ctx.fill();
  friendlyEyes(ctx, S, hy - S * 0.01, t, 0.09);
  ctx.fillStyle = '#f47c96'; ell(ctx, 0, hy + S * 0.06, S * 0.03, S * 0.024); ctx.fill();
  smileMouth(ctx, S, hy + S * 0.115, '#6b5560', mouth);
  ctx.strokeStyle = 'rgba(90,90,100,0.5)'; ctx.lineWidth = Math.max(1, S * 0.005);
  [-1, 1].forEach(k => [-0.015, 0.015].forEach(q => { ctx.beginPath(); ctx.moveTo(k * S * 0.08, hy + S * (0.08 + q)); ctx.lineTo(k * S * 0.28, hy + S * (0.06 + q * 2.5)); ctx.stroke(); }));
  blush(ctx, S, hy, 0.16, 0.38);
  ctx.restore();
}
// 다람쥐: 등 뒤로 크게 말린 복슬 꼬리 + 뾰족 귀 + 크림색 배
function drawSquirrel(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  const sw = Math.sin(t * 1.8) * 0.05;
  // 꼬리: 등 뒤로 S자로 올라가는 복슬복슬한 털 뭉치 (원을 겹쳐 그림)
  ctx.save(); ctx.translate(S * 0.2, -S * 0.12); ctx.rotate(sw);
  const tailPt = (k) => { const a = k * 3.6; return [S * (0.22 + Math.sin(a) * 0.16 + k * 0.08), -S * (k * 0.78 + Math.sin(k * 3) * 0.04), S * (0.1 + k * 0.1)]; };
  [['#9a4f18', 1.12], ['#cf7a34', 1], ['#e9a05a', 0.62]].forEach(([col, m], li) => {
    ctx.fillStyle = col;
    for (let i = 0; i <= 18; i++) { const [x, y, r] = tailPt(i / 18); ell(ctx, x - (li === 2 ? r * 0.25 : 0), y - (li === 2 ? r * 0.2 : 0), r * m, r * m); ctx.fill(); }
  });
  ctx.strokeStyle = 'rgba(255,230,190,0.55)'; ctx.lineWidth = S * 0.012; ctx.lineCap = 'round';
  for (let i = 2; i <= 17; i += 3) { const [x, y, r] = tailPt(i / 18); ctx.beginPath(); ctx.moveTo(x - r * 0.4, y); ctx.quadraticCurveTo(x, y - r * 0.5, x + r * 0.3, y - r * 0.2); ctx.stroke(); }
  ctx.restore();
  sitBody(ctx, S, t, happy, { body: '#d98a46', dark: '#a9601f', belly: '#fbe7c8', paw: '#f6d7aa', line: '#8f4f1a' });
  const hy = -S * 0.78;
  [-1, 1].forEach(k => {
    ctx.fillStyle = '#c4732e'; ctx.beginPath(); ctx.moveTo(k * S * 0.08, hy - S * 0.18); ctx.lineTo(k * S * 0.2, hy - S * 0.36); ctx.lineTo(k * S * 0.25, hy - S * 0.12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a3e12'; ctx.beginPath(); ctx.moveTo(k * S * 0.18, hy - S * 0.33); ctx.lineTo(k * S * 0.2, hy - S * 0.41); ctx.lineTo(k * S * 0.23, hy - S * 0.31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6c2a4'; ctx.beginPath(); ctx.moveTo(k * S * 0.12, hy - S * 0.18); ctx.lineTo(k * S * 0.195, hy - S * 0.3); ctx.lineTo(k * S * 0.22, hy - S * 0.15); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.1, S * 0.03, 0, hy, S * 0.3, [[0, '#eba465'], [1, '#b8692a']]);
  ell(ctx, 0, hy, S * 0.25, S * 0.23); ctx.fill(); ctx.strokeStyle = '#8f4f1a'; ctx.lineWidth = lw(S); ctx.stroke();
  // 볼주머니
  ctx.fillStyle = '#fbe7c8'; [-1, 1].forEach(k => { ell(ctx, k * S * 0.08, hy + S * 0.1, S * 0.09, S * 0.075); ctx.fill(); });
  friendlyEyes(ctx, S, hy - S * 0.02, t, 0.095);
  ctx.fillStyle = '#4a2410'; ell(ctx, 0, hy + S * 0.055, S * 0.026, S * 0.02); ctx.fill();
  smileMouth(ctx, S, hy + S * 0.11, '#4a2410', mouth);
  if (mouth < 0.05) { ctx.fillStyle = '#fff'; ctx.fillRect(-S * 0.015, hy + S * 0.12, S * 0.03, S * 0.025); }
  blush(ctx, S, hy, 0.17, 0.3);
  ctx.restore();
}
// 돼지: 분홍 몸 + 접힌 세모 귀 + 커다란 코 + 꼬불 꼬리
function drawPig(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  ctx.strokeStyle = '#f39aae'; ctx.lineWidth = S * 0.025; ctx.lineCap = 'round';
  ctx.beginPath(); const tx = S * 0.36, ty = -S * 0.2; ctx.moveTo(S * 0.3, -S * 0.15);
  for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU * 1.5 + t * 2; ctx.lineTo(tx + i * S * 0.004 + Math.cos(a) * S * 0.04, ty + Math.sin(a) * S * 0.04); }
  ctx.stroke();
  sitBody(ctx, S, t, happy, { body: '#ffc7d2', dark: '#f39aae', belly: '#ffe1e7', paw: '#e88aa0', line: '#d97c92' });
  const hy = -S * 0.78;
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.1, S * 0.03, 0, hy, S * 0.33, [[0, '#ffd8e0'], [1, '#f5a3b5']]);
  ell(ctx, 0, hy, S * 0.29, S * 0.26); ctx.fill(); ctx.strokeStyle = '#d97c92'; ctx.lineWidth = lw(S); ctx.stroke();
  [-1, 1].forEach(k => {
    ctx.save(); ctx.translate(k * S * 0.17, hy - S * 0.2); ctx.rotate(k * 0.35);
    ctx.fillStyle = '#f5a3b5'; ctx.beginPath(); ctx.moveTo(-S * 0.08, S * 0.04); ctx.lineTo(k * S * 0.03, -S * 0.12); ctx.lineTo(S * 0.08, S * 0.04); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d97c92'; ctx.lineWidth = lw(S, 0.008); ctx.stroke();
    ctx.restore();
  });
  friendlyEyes(ctx, S, hy - S * 0.05, t, 0.11);
  ctx.fillStyle = rg(ctx, -S * 0.02, hy + S * 0.04, 0, 0, hy + S * 0.06, S * 0.11, [[0, '#ffc2cf'], [1, '#ef8fa6']]);
  ell(ctx, 0, hy + S * 0.06, S * 0.1, S * 0.07); ctx.fill(); ctx.strokeStyle = '#d97c92'; ctx.lineWidth = lw(S, 0.008); ctx.stroke();
  ctx.fillStyle = '#b5546d'; [-1, 1].forEach(k => { ell(ctx, k * S * 0.035, hy + S * 0.06, S * 0.018, S * 0.026); ctx.fill(); });
  smileMouth(ctx, S, hy + S * 0.16, '#a04460', mouth);
  blush(ctx, S, hy, 0.19, 0.4);
  ctx.restore();
}
// 병아리: 노란 솜털 + 작은 주황 부리 + 머리 위 깃털 한 가닥
function drawChick(ctx, S, t, happy, mouth = 0) {
  ctx.save();
  sitBody(ctx, S, t, happy, { body: '#ffe066', dark: '#f5c518', belly: '#fff3b0', paw: '#f59e0b', line: '#d9a406', arm: '#fcd34d' });
  const hy = -S * 0.78;
  ctx.strokeStyle = '#f5c518'; ctx.lineWidth = S * 0.025; ctx.lineCap = 'round';
  [-0.4, 0, 0.4].forEach(a => { ctx.beginPath(); ctx.moveTo(0, hy - S * 0.22); ctx.quadraticCurveTo(a * S * 0.15, hy - S * 0.35, a * S * 0.25 + S * 0.02, hy - S * 0.33); ctx.stroke(); });
  ctx.fillStyle = rg(ctx, -S * 0.07, hy - S * 0.1, S * 0.03, 0, hy, S * 0.3, [[0, '#fff1a0'], [1, '#f7c92a']]);
  ell(ctx, 0, hy, S * 0.26, S * 0.24); ctx.fill(); ctx.strokeStyle = '#d9a406'; ctx.lineWidth = lw(S); ctx.stroke();
  friendlyEyes(ctx, S, hy - S * 0.03, t, 0.1);
  // 부리 (먹을 때 위아래로 벌어진다)
  const op = mouth > 0.05 ? mouth * S * 0.05 : 0, by = hy + S * 0.06;
  ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#c2700a'; ctx.lineWidth = Math.max(1, S * 0.006);
  ctx.beginPath(); ctx.moveTo(-S * 0.055, by); ctx.lineTo(S * 0.055, by); ctx.lineTo(0, by - S * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (op) { ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.moveTo(-S * 0.045, by); ctx.lineTo(S * 0.045, by); ctx.lineTo(0, by + op); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.moveTo(-S * 0.045, by + op); ctx.lineTo(S * 0.045, by + op); ctx.lineTo(0, by + op + S * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
  blush(ctx, S, hy, 0.16, 0.35);
  ctx.restore();
}
const GUEST_FN = { rabbit: drawRabbit, bear: drawBear, panda: drawPanda, lion: drawLion, cat: drawCat, dog: drawDog, monkey: drawMonkey, mouse: drawMouse, squirrel: drawSquirrel, pig: drawPig, chick: drawChick };

// ═══════════════ 배경 ═══════════════
function layout(W, H) {
  const land = W >= H * 1.1;
  if (land) {
    const R = Math.min(W * 0.15, H * 0.25);
    return { land, split: W * 0.33, gx: W * 0.165, gy: H * 0.66, S: Math.min(W * 0.16, H * 0.36), counterY: H * 0.6, serveX: W * 0.165, serveY: H * 0.7,
      cx: W * 0.6, cy: H * 0.4, R, ovenX: W * 0.89, ovenY: H * 0.3, ovenS: Math.min(W * 0.08, H * 0.15),
      trayX0: W * 0.35, trayX1: W * 0.985, trayY: H * 0.86, tileMax: H * 0.19 };
  }
  const R = Math.min(W * 0.27, H * 0.15);
  return { land, split: H * 0.36, gx: W * 0.3, gy: H * 0.33, S: Math.min(W * 0.25, H * 0.19), counterY: H * 0.29, serveX: W * 0.3, serveY: H * 0.32,
    cx: W * 0.5, cy: H * 0.6, R, ovenX: W * 0.8, ovenY: H * 0.18, ovenS: Math.min(W * 0.12, H * 0.08),
    trayX0: W * 0.02, trayX1: W * 0.98, trayY: H * 0.885, tileMax: Math.min(W * 0.16, H * 0.12) };
}
let bgCache = null;
function drawBackground(ctx, W, H, L) {
  const key = `${W}x${H}`;
  if (!bgCache || bgCache.key !== key) {
    const cv = document.createElement('canvas'); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const gW = L.land ? L.split : W, gH = L.land ? H : L.split;
    // 식당 벽 + 타일
    c.fillStyle = lg(c, 0, 0, 0, gH, [[0, '#fff6e8'], [1, '#f7e4c8']]); c.fillRect(0, 0, gW, gH);
    c.strokeStyle = 'rgba(200,170,130,0.25)'; c.lineWidth = 1;
    const tH = 22, tW = 44;
    for (let y = 0, row = 0; y < L.counterY; y += tH, row++) { c.beginPath(); c.moveTo(0, y); c.lineTo(gW, y); c.stroke(); for (let x = (row % 2) * tW / 2; x < gW; x += tW) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + tH); c.stroke(); } }
    // 창문
    const wx = L.land ? gW * 0.18 : gW * 0.55, wy = L.land ? H * 0.06 : gH * 0.08, ww = L.land ? gW * 0.64 : gW * 0.28, wh = L.land ? H * 0.2 : gH * 0.36;
    c.fillStyle = lg(c, 0, wy, 0, wy + wh, [[0, '#bfe3ff'], [1, '#e6f6ff']]); c.fillRect(wx, wy, ww, wh);
    c.fillStyle = 'rgba(255,255,255,0.85)'; [[0.3, 0.35], [0.7, 0.6]].forEach(([a, b]) => { ell(c, wx + ww * a, wy + wh * b, ww * 0.12, wh * 0.08); c.fill(); ell(c, wx + ww * a + ww * 0.07, wy + wh * b - wh * 0.04, ww * 0.08, wh * 0.08); c.fill(); });
    c.strokeStyle = '#c99a62'; c.lineWidth = 6; c.strokeRect(wx, wy, ww, wh); c.lineWidth = 3; c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
    // 카운터 (손님 앞)
    const cy0 = L.counterY;
    c.fillStyle = lg(c, 0, cy0, 0, cy0 + 14, [[0, '#a0643a'], [1, '#7b4524']]); c.fillRect(0, cy0, gW, 14);
    c.fillStyle = lg(c, 0, cy0 + 14, 0, gH, [[0, '#c8874f'], [1, '#93582f']]); c.fillRect(0, cy0 + 14, gW, gH - cy0 - 14);
    const r = rng(3); c.lineWidth = 1.2;
    for (let i = 0; i < 30; i++) { const y = cy0 + 18 + r() * (gH - cy0 - 18); c.strokeStyle = `rgba(90,50,20,${0.1 + r() * 0.15})`; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(gW * 0.3, y + (r() - 0.5) * 8, gW * 0.6, y + (r() - 0.5) * 8, gW, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, cy0 + 1, gW, 3);
    // 주방 탁자 (위에서 본 나무판)
    const tx = L.land ? L.split : 0, ty = L.land ? 0 : L.split;
    c.fillStyle = lg(c, tx, ty, W, H, [[0, '#e8c896'], [0.5, '#dcb47c'], [1, '#c99a5e']]); c.fillRect(tx, ty, W - tx, H - ty);
    const plankH = 64;
    for (let y = ty; y < H; y += plankH) {
      c.strokeStyle = 'rgba(120,75,30,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, y); c.lineTo(W, y); c.stroke();
      for (let i = 0; i < 6; i++) { const yy = y + 6 + r() * (plankH - 12); c.strokeStyle = `rgba(140,90,40,${0.08 + r() * 0.12})`; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, yy); c.bezierCurveTo(tx + (W - tx) * 0.3, yy + (r() - 0.5) * 10, tx + (W - tx) * 0.7, yy + (r() - 0.5) * 10, W, yy + (r() - 0.5) * 6); c.stroke(); }
    }
    // 경계 그림자
    if (L.land) { c.fillStyle = lg(c, tx, 0, tx + 18, 0, [[0, 'rgba(60,30,10,0.3)'], [1, 'rgba(60,30,10,0)']]); c.fillRect(tx, 0, 18, H); }
    else { c.fillStyle = lg(c, 0, ty, 0, ty + 18, [[0, 'rgba(60,30,10,0.3)'], [1, 'rgba(60,30,10,0)']]); c.fillRect(0, ty, W, 18); }
    bgCache = { key, cv };
  }
  ctx.drawImage(bgCache.cv, 0, 0, W, H);
}
// 재료 칸 위치
function trayTiles(L, ids) {
  const n = ids.length; if (!n) return [];
  const span = L.trayX1 - L.trayX0, s = Math.min(L.tileMax, span / n * 0.9), gap = (span - s * n) / (n + 1);
  return ids.map((id, i) => ({ id, x: L.trayX0 + gap + s / 2 + i * (s + gap), y: L.trayY - s * 0.05, s }));
}
function drawTile(ctx, tile, fav, t, pressed) {
  const { x, y, s } = tile;
  ctx.save();
  const bob = pressed ? 0.94 : 1;
  ctx.translate(x, y); ctx.scale(bob, bob);
  shadowOn(ctx, s * 0.1, s * 0.05, 'rgba(70,40,10,0.3)');
  ctx.fillStyle = '#fffdf8'; ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.22); ctx.fill(); shadowOff(ctx);
  if (fav) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = s * 0.04; ctx.stroke(); }
  drawIcon(ctx, tile.id, 0, -s * 0.08, s * 0.3);
  ctx.fillStyle = '#6b4a2b'; ctx.font = `${Math.round(s * 0.17)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(INGREDIENTS[tile.id].name, 0, s * 0.36);
  if (fav) { ctx.font = `${Math.round(s * 0.22)}px sans-serif`; ctx.fillText('💗', s * 0.38, -s * 0.38 + Math.sin(t * 4) * s * 0.03); }
  ctx.restore();
}
function drawHeart(ctx, x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.4, y - s * 0.9, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 0.9, x + s * 0.9, y - s * 0.3, x, y + s * 0.3); ctx.fill();
}

// 피자 토핑 3개 자리 (놓은 곳 근처, 누르기만 했으면 아무 곳)
function scatterToppings(id, ux, uy, dropped) {
  if (!dropped || Math.hypot(ux, uy) > 0.8) { const a = Math.random() * TAU, d = 0.15 + Math.sqrt(Math.random()) * 0.55; ux = Math.cos(a) * d; uy = Math.sin(a) * d; }
  return [0, 1, 2].map(k => {
    let px = ux + (k ? (Math.random() - 0.5) * 0.7 : 0), py = uy + (k ? (Math.random() - 0.5) * 0.7 : 0);
    const d = Math.hypot(px, py); if (d > 0.72) { px *= 0.72 / d; py *= 0.72 / d; }
    return { id, x: px, y: py, rot: Math.random() * TAU, v: Math.floor(Math.random() * 3) };
  });
}

// 케이크·팬케이크 윗면 장식 자리 (놓은 곳 근처, 누르기만 했으면 아무 곳)
function decoSpot(id, ux, uy, dropped) {
  if (!dropped || Math.hypot(ux, uy) > 1.1) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 0.9; ux = Math.cos(a) * d; uy = Math.sin(a) * d; }
  const dd = Math.hypot(ux, uy); if (dd > 0.95) { ux *= 0.95 / dd; uy *= 0.95 / dd; }
  return { id, x: ux, y: uy, rot: (Math.random() - 0.5) * 1.2, v: Math.floor(Math.random() * 3) };
}

// ─────────────────────────────── 화면 ───────────────────────────────
const makeGame = () => ({ order: shuffle(KITCHEN_GUESTS.map(g => g.id)), gi: 0, phase: 'arrive', menu: null, step: null, phaseT: 0, t: 0, st: newCook(), fly: [], parts: [], drag: null, paint: false, knife: null, happyUntil: 0, bites: [], tiles: [], L: null, lastRub: 0, timers: [] });
const newCook = () => ({ layers: [], topBread: null, toppings: [], sauceCv: null, sauceFull: 0, cov: new Set(), bake: 0, skewer: [], fruits: [], hasFav: false, favSaid: false,
  cakes: 0, pan: null, syrup: 0, rub: null, candles: [], scoops: [], cut: 0 });
// 손님 앞 음식 크기·높이, 먹을 때 부스러기 색, 먹는 방향
const SERVE_SC = { sandwich: 0.3, pizza: 0.27, skewer: 0.4, pancake: 0.3, cake: 0.28, kimbap: 0.3, icecream: 0.17 };
const SERVE_DY = { sandwich: 0.5, skewer: 0.25, pizza: -0.2, pancake: 0.55, cake: 0.55, kimbap: 0.2, icecream: 1.25 };
const CRUMBS = { pizza: ['#e9b46a', '#d33a22', '#fcd34d'], skewer: ['#e11d48', '#84cc16', '#fbbf24'], pancake: ['#d08a3c', '#f0cf96', '#f59e0b'], cake: ['#ffffff', '#f2cd88', '#e11d48'], kimbap: ['#ffffff', '#1d281d', '#fde047'], icecream: ['#fffdf0', '#f9a8bf', '#d9a066'] };
const BITE_FROM_TOP = { pizza: true, icecream: true };

export default function KitchenGame({ audio, speak }) {
  const canvasRef = useRef(null);
  // 게임 상태는 매 화면 바뀌므로 React 상태가 아닌 ref 에 두고(처음 effect 에서 만듦), 버튼에 필요한 것만 ui 로 옮긴다(sync)
  const G = useRef(null);
  const [ui, setUi] = useState({ phase: 'arrive', menu: null, step: null, n: 0, land: true, guest: KITCHEN_GUESTS[0].id });
  const sync = () => { const g = G.current, st = g.st; setUi({ phase: g.phase, menu: g.menu, step: g.step, sub: st.pan ? st.pan.state : null, n: st.layers.length + st.toppings.length + st.skewer.length + st.scoops.length + st.syrup, land: g.L ? g.L.land : true, guest: g.order[g.gi] }); };
  const later = (fn, ms) => { const g = G.current; const id = setTimeout(() => { g.timers = g.timers.filter(x => x !== id); fn(); }, ms); g.timers.push(id); };
  const say = (text) => { if (speak && text) speak(text); };
  const guest = () => GUEST_BY_ID[G.current.order[G.current.gi]];

  // ── 흐름 ──
  const arrive = () => {
    const g = G.current;
    g.phase = 'arrive'; g.phaseT = g.t; g.menu = null; g.step = null; g.st = newCook(); g.fly = []; g.bites = []; g.happyUntil = 0;
    audio.playXylophone(1318.5, 0.5); setTimeout(() => audio.playXylophone(1046.5, 0.5), 160);
    say(VOICE.kitchenArrive(guest()));
    later(() => { if (g.phase === 'arrive') { g.phase = 'menu'; sync(); } }, 1000);
    sync();
  };
  useEffect(() => { G.current = makeGame(); arrive(); return () => { G.current.timers.forEach(clearTimeout); G.current.timers = []; }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const chooseMenu = (id) => {
    const g = G.current;
    g.menu = id; g.phase = 'cook'; g.st = newCook(); g.fly = []; g.phaseT = g.t;
    if (id === 'sandwich') g.step = 'stack';
    if (id === 'pizza') { g.step = 'sauce'; const cv = document.createElement('canvas'); cv.width = cv.height = 256; g.st.sauceCv = cv; }
    if (id === 'skewer') { g.step = 'cut'; g.st.fruits = MENU_BY_ID.skewer.items.map((f, i) => ({ id: f, i, cutT: null })); }
    if (id === 'pancake') { g.step = 'pan'; g.st.pan = { state: 'empty', t0: g.t }; }
    if (id === 'cake') { g.step = 'cream'; g.st.rub = { cv: null, cov: new Set(), full: 0 }; }
    if (id === 'kimbap') { g.step = 'rice'; g.st.rub = { cv: null, cov: new Set(), full: 0 }; }
    if (id === 'icecream') g.step = 'scoop';
    audio.playPopSound();
    say(VOICE.kitchenMenu(MENU_BY_ID[id]));
    sync();
  };
  const trayIds = () => {
    const g = G.current, fav = guest().fav;
    if (g.phase !== 'cook') return [];
    if (['sandwich:stack', 'pizza:top', 'skewer:stick', 'pancake:top', 'cake:deco', 'kimbap:fill', 'icecream:scoop'].includes(`${g.menu}:${g.step}`)) return [...new Set([...MENU_BY_ID[g.menu].items, fav])];   // 좋아하는 재료가 이미 메뉴에 있으면(치즈·바나나 등) 한 칸만
    return [];
  };

  // 재료 넣기 (누르거나 끌어다 놓은 곳에서 날아간다)
  const addIngredient = (id, fx, fy, dropped) => {
    const g = G.current, L = g.L, st = g.st, gu = guest();
    if (!L) return;
    const land = (fn) => (k) => { fn(k); audio.playSnap(); sparkle(k.tx, k.ty, 6); sync(); };
    const pending = g.fly.length;
    if (g.menu === 'sandwich') {
      if (st.layers.length + pending >= SANDWICH_MAX) { audio.playFreq(220, 'sine', 0.15, 0.3); say(VOICE.kitchenFull()); return; }
      const geo = sandwichGeom(L.cx, L.cy, L.R);
      let top = geo.base - LAYER_TH.breadBottom * geo.w * 0.9;
      st.layers.forEach(l => { top -= (LAYER_TH[l.id] || 0.05) * geo.w * 0.9; });
      const tx = L.cx, ty = top - (LAYER_TH[id] || 0.05) * geo.w - geo.w * 0.15 - pending * 0.05 * geo.w;
      g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx, ty, t0: g.t, dur: 0.42, done: land(() => st.layers.push({ id, dx: (Math.random() - 0.5) * 0.05, rot: (Math.random() - 0.5) * 0.04 })) });
    } else if (g.menu === 'pizza') {
      if (st.toppings.length >= PIZZA_MAX) { audio.playFreq(220, 'sine', 0.15, 0.3); say(VOICE.kitchenFull()); return; }
      scatterToppings(id, (fx - L.cx) / L.R, (fy - L.cy) / L.R, dropped).forEach((p, k) => {
        g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx: L.cx + p.x * L.R, ty: L.cy + p.y * L.R, t0: g.t + k * 0.07, dur: 0.38, done: land(() => st.toppings.push(p)) });
      });
    } else if (g.menu === 'skewer') {
      const idx = st.skewer.length + pending;
      if (idx >= SKEWER_SLOTS) return;
      const geo = skewerGeom(L.cx, L.cy, L.R);
      g.fly.push({ id, kind: 'piece', x0: fx, y0: fy, tx: geo.first + idx * geo.gap, ty: geo.y, t0: g.t, dur: 0.4, done: land(() => { st.skewer.push({ id, rot: (Math.random() - 0.5) * 0.5 }); if (st.skewer.length >= SKEWER_SLOTS) later(finishCooking, 700); }) });
    } else if (g.menu === 'pancake' || g.menu === 'cake') {
      if (st.toppings.length + pending >= DECO_MAX) { audio.playFreq(220, 'sine', 0.15, 0.3); say(VOICE.kitchenFull()); return; }
      // 윗면(타원) 안 자리: 끌어다 놓았으면 그 근처
      const isCake = g.menu === 'cake';
      const geo = isCake ? cakeGeom(L.cx, L.cy, L.R) : pancakeGeom(L.cx, L.cy, L.R);
      const cx0 = L.cx, cy0 = isCake ? geo.topY : geo.base - geo.th * st.cakes, rx = (isCake ? geo.rx * 0.78 : geo.w / 2 * 0.7), ry = (isCake ? geo.ry * 0.78 : geo.ry * 0.7);
      if (id === 'honey' && !isCake) {
        g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx: cx0, ty: cy0, t0: g.t, dur: 0.42, done: land(() => { st.syrup = Math.min(3, st.syrup + 1); audio.playNoise(0.4, 0.15, 500, 0.6); }) });
      } else {
        const p = decoSpot(id, (fx - cx0) / rx, (fy - cy0) / ry, dropped);
        g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx: cx0 + p.x * rx, ty: cy0 + p.y * ry, t0: g.t, dur: 0.4, done: land(() => st.toppings.push(p)) });
      }
    } else if (g.menu === 'kimbap') {
      if (st.layers.length + pending >= KIMBAP_MAX) { audio.playFreq(220, 'sine', 0.15, 0.3); say(VOICE.kitchenFull()); return; }
      const kg = kimbapGeom(L.cx, L.cy, L.R), i = st.layers.length + pending;
      g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx: L.cx, ty: kg.ly0 + kg.lh * (0.86 - i * 0.1), t0: g.t, dur: 0.42, done: land(() => st.layers.push({ id, seed: Math.random() * 10 })) });
    } else if (g.menu === 'icecream') {
      const ig = iceGeom(L.cx, L.cy, L.R);
      if (ICE_FLAVORS.includes(id)) {
        const i = st.scoops.length + pending;
        if (i >= ICE_MAX) { audio.playFreq(220, 'sine', 0.15, 0.3); say(VOICE.kitchenFull()); return; }
        g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx: L.cx, ty: ig.sc(i), t0: g.t, dur: 0.42, done: land(() => { st.scoops.push(id); audio.playFreq(180, 'sine', 0.12, 0.4); }) });
      } else {
        if (st.toppings.length + pending >= DECO_MAX) { audio.playFreq(220, 'sine', 0.15, 0.3); say(VOICE.kitchenFull()); return; }
        const si = st.scoops.length - 1, sy = si < 0 ? ig.y0 : ig.sc(si);
        const list = id === 'sprinkles' ? [0, 1, 2] : [0];
        list.forEach(k => {
          const p = id === 'cherry' ? { x: (Math.random() - 0.5) * 0.3, y: si < 0 ? -0.3 : -0.78 } : { x: (Math.random() - 0.5) * 1.1, y: si < 0 ? -0.15 : -0.25 - Math.random() * 0.45 };
          Object.assign(p, { id, si, rot: (Math.random() - 0.5) * 1.2, v: Math.floor(Math.random() * 3) });
          g.fly.push({ id, kind: 'icon', x0: fx, y0: fy, tx: L.cx + p.x * ig.sr, ty: sy + p.y * ig.sr, t0: g.t + k * 0.06, dur: 0.4, done: land(() => st.toppings.push(p)) });
        });
      }
    }
    if (id === gu.fav) { st.hasFav = true; if (!st.favSaid) { st.favSaid = true; g.happyUntil = g.t + 2.6; say(VOICE.kitchenFav(gu)); return; } }
    say(VOICE.kitchenIng(id));
  };
  const sparkle = (x, y, n) => { const g = G.current; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; g.parts.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, born: g.t, life: 0.6 }); } };
  const crumbs = (x, y, n, cols) => { const g = G.current; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 80 + Math.random() * 160; g.parts.push({ kind: 'crumb', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: g.t, life: 1.1, col: cols[i % cols.length], r: 2 + Math.random() * 3 }); } };

  // 단계 넘기기
  const coverSandwich = () => {
    const g = G.current; if (g.menu !== 'sandwich' || g.step !== 'stack' || !g.st.layers.length) return;
    g.step = 'cover'; g.st.topBread = 0; g.coverT = g.t;
    say(VOICE.kitchenBread());
    later(() => audio.playFreq(160, 'sine', 0.15, 0.5), 450);
    later(finishCooking, 1700);
    sync();
  };
  const startBake = () => {
    const g = G.current; if (g.menu !== 'pizza' || g.step !== 'top' || !g.st.toppings.length) return;
    g.step = 'toOven'; g.stepT = g.t;
    audio.playFreq(330, 'square', 0.08, 0.2);
    say(VOICE.kitchenBake());
    sync();
  };
  const finishSkewer = () => { const g = G.current; if (g.menu === 'skewer' && g.step === 'stick' && g.st.skewer.length >= 2) finishCooking(); };
  const finishSimple = () => { const g = G.current; if ((g.menu === 'pancake' && g.step === 'top') || (g.menu === 'icecream' && g.step === 'scoop' && g.st.scoops.length)) finishCooking(); };
  // 팬케이크: 팬을 누르면 붓고, 보글보글 다 익으면 눌러서 뒤집는다 (나머지는 그림 루프의 panTick 이 시간 따라 넘김)
  const setPan = (state) => { const g = G.current; g.st.pan = { state, t0: g.t }; sync(); };
  const tapPan = () => {
    const g = G.current, pan = g.st.pan; if (!pan) return;
    if (pan.state === 'empty') { setPan('pour'); audio.playNoise(0.8, 0.18, 700, 0.5); say(VOICE.kitchenPour()); }
    else if (pan.state === 'ready') { setPan('flip'); audio.playFreq(500, 'sine', 0.15, 0.3); setTimeout(() => audio.playFreq(800, 'sine', 0.12, 0.3), 120); say(VOICE.kitchenFlipped()); }
  };
  const panTick = () => {
    const g = G.current, st = g.st, pan = st.pan; if (!pan || g.step !== 'pan') return;
    const e = g.t - pan.t0;
    if (pan.state === 'pour' && e > 0.9) setPan('cook');
    else if (pan.state === 'cook') {
      if (Math.floor(e / 0.4) !== pan.sz) { pan.sz = Math.floor(e / 0.4); audio.playNoise(0.3, 0.1, 5200, 0.6); }
      if (e > 2.0) { setPan('ready'); audio.playXylophone(1318.5, 0.4); say(VOICE.kitchenFlip()); }
    } else if (pan.state === 'flip' && e > 0.7) { setPan('cooked2'); audio.playSnap(); }
    else if (pan.state === 'cooked2' && e > 0.9) setPan('toStack');
    else if (pan.state === 'toStack' && e > 0.6) {
      st.cakes++; audio.playSnap();
      if (st.cakes < PANCAKE_COUNT) { setPan('empty'); say(VOICE.kitchenOneMore()); }
      else { st.pan = null; g.step = 'top'; sparkle(g.L.cx, g.L.cy, 14); say(VOICE.kitchenTopping()); sync(); }
    }
  };
  // 케이크: 초 세 개를 하나씩 꽂고 불을 켠 뒤 완성
  const placeCandles = () => {
    const g = G.current; if (g.menu !== 'cake' || g.step !== 'deco') return;
    g.step = 'candle';
    g.st.candles = [[-0.5, -0.35], [0, -0.55], [0.5, -0.35]].map(([x, y], i) => ({ x, y, t0: g.t + i * 0.3, lit: false }));
    g.st.candles.forEach((c, i) => {
      later(() => audio.playFreq(300, 'triangle', 0.08, 0.4), i * 300 + 330);
      later(() => { c.lit = true; audio.playXylophone([1046.5, 1318.5, 1568][i], 0.5); }, 900 + i * 250);
    });
    say(VOICE.kitchenCandle());
    later(finishCooking, 2300);
    sync();
  };
  // 김밥: 돌돌 말고 콕콕 썰기
  const rollKimbap = () => {
    const g = G.current; if (g.menu !== 'kimbap' || g.step !== 'fill' || !g.st.layers.length) return;
    g.step = 'roll'; g.rollT = g.t;
    say(VOICE.kitchenRoll());
    [0, 350, 700, 1050].forEach(ms => later(() => audio.playNoise(0.3, 0.2, 400, 0.7), ms));
    sync();
  };
  const cutKimbap = () => {
    const g = G.current, st = g.st, L = g.L; if (st.cut >= KIMBAP_SLICES || (g.knife && g.t - g.knife.t0 < 0.5)) return;
    const len = L.R * 2.2;
    g.knife = { x: L.cx + len / 2 - (st.cut + 1) * len / 8, y: L.cy, t0: g.t };
    later(() => { st.cut = Math.min(KIMBAP_SLICES, st.cut + 1); audio.playNoise(0.07, 0.8, 2600, 1.2); audio.playFreq(120, 'triangle', 0.08, 0.5); }, 140);
    later(() => { st.cut = Math.min(KIMBAP_SLICES, st.cut + 1); audio.playNoise(0.07, 0.8, 2600, 1.2); audio.playFreq(110, 'triangle', 0.08, 0.5); if (st.cut >= KIMBAP_SLICES) later(finishCooking, 900); }, 380);
  };
  // 쓱쓱 바르기 (케이크 생크림·김밥 밥): 화면 칸을 얼마나 덮었는지 세어 60% 넘으면 다 덮는다
  const rubShape = () => {
    const g = G.current, L = g.L;
    if (g.menu === 'cake') {
      const b = cakeBox(L.cx, L.cy, L.R), cg = cakeGeom(L.cx, L.cy, L.R);
      const inside = (px, py) => { const dx = (px - L.cx) / cg.rx; if (py < cg.topY) return dx * dx + ((py - cg.topY) / cg.ry) ** 2 <= 1; if (py <= cg.botY) return Math.abs(dx) <= 1; return dx * dx + ((py - cg.botY) / cg.ry) ** 2 <= 1; };
      return { b, inside };
    }
    const b = kimbapBox(L.cx, L.cy, L.R);
    return { b, inside: (px, py) => px >= b.x0 && px <= b.x0 + b.w && py >= b.y0 + b.h * 0.18 && py <= b.y0 + b.h };
  };
  const paintRub = (x, y) => {
    const g = G.current, rub = g.st.rub; if (!rub || rub.full > 0) return;
    const { b, inside } = rubShape();
    if (x < b.x0 - b.w * 0.08 || x > b.x0 + b.w * 1.08 || y < b.y0 - b.h * 0.1 || y > b.y0 + b.h * 1.1) return;
    if (!rub.cv) { rub.cv = document.createElement('canvas'); rub.cv.width = 300; rub.cv.height = Math.round(300 * b.h / b.w); }
    const c = rub.cv.getContext('2d'), k = rub.cv.width / b.w, px = (x - b.x0) * k, py = (y - b.y0) * k, brS = b.w * 0.13, br = brS * k;
    const dab = (qx, qy) => {
      if (g.menu === 'cake') {
        const gr = c.createRadialGradient(qx, qy, 0, qx, qy, br); gr.addColorStop(0, 'rgba(255,253,247,1)'); gr.addColorStop(0.75, 'rgba(252,248,238,0.95)'); gr.addColorStop(1, 'rgba(250,245,235,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(qx, qy, br, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(215,205,190,0.5)'; c.lineWidth = br * 0.06; c.beginPath(); c.arc(qx + br * 0.1, qy, br * 0.55, 0.5, 2.6); c.stroke();
      } else {
        c.fillStyle = '#f7f5ee'; c.beginPath(); c.arc(qx, qy, br * 0.85, 0, TAU); c.fill();
        c.drawImage(riceStamp(), qx - br, qy - br, br * 2, br * 2);
      }
    };
    dab(px, py);
    const GX = 16, GY = Math.max(6, Math.round(16 * b.h / b.w));
    let total = 0;
    for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) {
      const cx = b.x0 + (i + 0.5) * b.w / GX, cy = b.y0 + (j + 0.5) * b.h / GY;
      if (!inside(cx, cy)) continue; total++;
      if (Math.hypot(cx - x, cy - y) < brS * 0.95) rub.cov.add(i * 100 + j);
    }
    if (g.t - g.lastRub > 0.12) { g.lastRub = g.t; audio.playNoise(0.14, 0.22, g.menu === 'cake' ? 900 : 1500, 0.7); }
    if (rub.cov.size / total >= 0.6) {
      g.paint = false;
      // 남은 곳도 다 채운다
      for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) dab((i / 12) * rub.cv.width, (j / 12) * rub.cv.height);
      if (g.menu === 'cake') { rub.full = 0.001; rub.fullT = g.t; } else rub.full = 1;
      audio.playSnap(); sparkle(b.x0 + b.w / 2, b.y0 + b.h / 2, 14);
      later(() => {
        if (g.menu === 'cake' && g.step === 'cream') { g.step = 'deco'; say(VOICE.kitchenTopping()); sync(); }
        if (g.menu === 'kimbap' && g.step === 'rice') { g.step = 'fill'; say(VOICE.kitchenFill()); sync(); }
      }, 900);
    }
  };
  const finishCooking = () => {
    const g = G.current; if (g.phase !== 'cook') return;
    g.phase = 'serve'; g.phaseT = g.t;
    audio.playXylophone(1568, 0.5);
    sparkle(g.L.cx, g.L.cy, 18);
    say(VOICE.kitchenServe());
    sync();
  };
  const serve = (fx, fy) => {
    const g = G.current; if (g.phase !== 'serve') return;
    g.phase = 'carry'; g.carry = { x0: fx, y0: fy, t0: g.t }; g.phaseT = g.t;
    audio.playPopSound();
    sync();
  };
  const startEat = () => {
    const g = G.current; g.phase = 'eat'; g.phaseT = g.t; g.bites = [];
    // 케이크는 먼저 촛불을 후 분다
    const blow = g.menu === 'cake' && g.st.candles.some(c => c.lit);
    g.biteAt = blow ? [1.9, 2.9, 3.9] : [0.7, 1.7, 2.7]; g.blowAt = blow ? 0.9 : null;
    g.biteAt.forEach((at, k) => later(() => {
      if (G.current.phase !== 'eat') return;
      g.bites.push(k); audio.playNoise(0.09, 0.5, 1800, 0.9); audio.playYum();
      const L = g.L, sc = L.S * 0.35 / L.R;
      const cols = CRUMBS[g.menu] || ['#e9c48f', '#86d057', '#fcd34d'];
      crumbs(L.serveX + L.R * sc * (0.5 - k * 0.5), L.serveY - L.R * sc * 0.4, 10, cols);
    }, at * 1000));
    if (blow) later(() => { audio.playNoise(0.7, 0.35, 900, 0.5); say(VOICE.kitchenBlow()); }, 400);
    later(() => {
      if (G.current.phase !== 'eat') return;
      g.phase = 'end'; g.happyUntil = g.t + 999; g.phaseT = g.t;
      for (let i = 0; i < 12; i++) g.parts.push({ kind: 'heart', x: g.L.gx + (Math.random() - 0.5) * g.L.S, y: g.L.gy - g.L.S * 0.8, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, born: g.t + i * 0.12, life: 2.4 });
      audio.playFanfare();
      say(g.st.hasFav ? VOICE.kitchenYumFav(guest()) : VOICE.kitchenYum(guest()));
      sync();
    }, (g.biteAt[2] + 0.8) * 1000);
    sync();
  };
  const again = () => { const g = G.current; g.phase = 'menu'; g.menu = null; g.step = null; g.st = newCook(); g.bites = []; g.happyUntil = 0; g.fly = []; sync(); };
  const nextGuest = () => { const g = G.current; g.timers.forEach(clearTimeout); g.timers = []; g.gi = (g.gi + 1) % g.order.length; if (g.gi === 0) g.order = shuffle(g.order); arrive(); };
  const backToMenu = () => { const g = G.current; g.timers.forEach(clearTimeout); g.timers = []; again(); };

  // 소스 바르기
  const paintSauce = (x, y) => {
    const g = G.current, L = g.L, st = g.st;
    const ux = (x - L.cx) / L.R, uy = (y - L.cy) / L.R;
    if (Math.hypot(ux, uy) > 1.05 || !st.sauceCv || st.sauceFull > 0) return;
    const c = st.sauceCv.getContext('2d'), px = (ux + 1) * 128, py = (uy + 1) * 128, br = 0.28 * 128;
    const gr = c.createRadialGradient(px, py, 0, px, py, br);
    gr.addColorStop(0, 'rgba(205,48,28,0.95)'); gr.addColorStop(0.7, 'rgba(196,44,24,0.85)'); gr.addColorStop(1, 'rgba(190,40,20,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(px, py, br, 0, TAU); c.fill();
    for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) {
      const cx = -0.8 + (i + 0.5) * (1.6 / 14), cy = -0.8 + (j + 0.5) * (1.6 / 14);
      if (Math.hypot(cx, cy) < 0.82 && Math.hypot(cx - ux, cy - uy) < 0.24) st.cov.add(i * 14 + j);
    }
    if (g.t - g.lastRub > 0.12) { g.lastRub = g.t; audio.playNoise(0.14, 0.22, 650, 0.7); }
    let total = 0; for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) { const cx = -0.8 + (i + 0.5) * (1.6 / 14), cy = -0.8 + (j + 0.5) * (1.6 / 14); if (Math.hypot(cx, cy) < 0.82) total++; }
    if (st.cov.size / total >= 0.55) {
      st.sauceFull = 0.001; g.sauceT = g.t; g.paint = false;
      audio.playSnap(); sparkle(L.cx, L.cy, 12);
      later(() => { if (g.menu === 'pizza' && g.step === 'sauce') { g.step = 'top'; say(VOICE.kitchenTopping()); sync(); } }, 900);
    }
  };
  // 과일 썰기
  const cutFruit = (f) => {
    const g = G.current, L = g.L;
    if (f.cutT != null) return;
    f.cutT = g.t;
    const fx = L.cx + (f.i - 1.5) * L.R * 0.55, fy = L.cy;
    g.knife = { x: fx, y: fy, t0: g.t };
    later(() => { audio.playNoise(0.07, 0.8, 2600, 1.2); audio.playFreq(120, 'triangle', 0.08, 0.5); }, 140);
    later(() => { audio.playNoise(0.07, 0.8, 2600, 1.2); audio.playFreq(110, 'triangle', 0.08, 0.5); }, 380);
    say(VOICE.kitchenIng(f.id));
    if (g.st.fruits.every(x => x.cutT != null)) later(() => { if (g.menu === 'skewer' && g.step === 'cut') { g.step = 'stick'; say(VOICE.kitchenStick()); sync(); } }, 1500);
  };

  // ── 터치 ──
  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    const g = G.current; if (!g || !g.L) return; const L = g.L;
    const [x, y] = pos(e);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    if (g.phase === 'cook') {
      const tile = g.tiles.find(t => Math.abs(x - t.x) < t.s / 2 && Math.abs(y - t.y) < t.s / 2);
      if (tile) { g.drag = { id: tile.id, x, y, sx: x, sy: y, tile }; audio.playFreq(660, 'sine', 0.06, 0.25); return; }
      if (g.menu === 'pizza' && g.step === 'sauce') { g.paint = true; paintSauce(x, y); return; }
      if ((g.menu === 'cake' && g.step === 'cream') || (g.menu === 'kimbap' && g.step === 'rice')) { g.paint = true; paintRub(x, y); return; }
      if (g.menu === 'pancake' && g.step === 'pan' && Math.hypot(x - (L.cx - L.R * 0.62), y - L.cy) < L.R * 0.75) { tapPan(); return; }
      if (g.menu === 'kimbap' && g.step === 'cut' && Math.abs(x - L.cx) < L.R * 1.4 && Math.abs(y - L.cy) < L.R * 0.6) { cutKimbap(); return; }
      if (g.menu === 'pizza' && g.step === 'top' && Math.abs(x - L.ovenX) < L.ovenS && Math.abs(y - L.ovenY) < L.ovenS) { startBake(); return; }
      if (g.menu === 'skewer' && g.step === 'cut') {
        const f = g.st.fruits.filter(q => q.cutT == null).find(q => Math.hypot(x - (L.cx + (q.i - 1.5) * L.R * 0.55), y - L.cy) < L.R * 0.3);
        if (f) cutFruit(f);
      }
      return;
    }
    if (g.phase === 'serve') {
      if (Math.hypot(x - L.cx, y - L.cy) < L.R * 1.5) { g.drag = { plate: true, x, y, sx: x, sy: y }; return; }
      if (Math.hypot(x - L.gx, y - (L.gy - L.S * 0.5)) < L.S) serve(L.cx, L.cy);
    }
  };
  const onMove = (e) => {
    const g = G.current; if (!g) return; const [x, y] = pos(e);
    if (g.drag) { g.drag.x = x; g.drag.y = y; return; }
    if (g.paint) { if (g.menu === 'pizza') paintSauce(x, y); else paintRub(x, y); }
  };
  const onUp = () => {
    const g = G.current; if (!g) return; const d = g.drag; g.paint = false;
    if (!d) return;
    g.drag = null;
    const moved = Math.hypot(d.x - d.sx, d.y - d.sy) > 14;
    if (d.plate) { serve(moved ? d.x : g.L.cx, moved ? d.y : g.L.cy); return; }
    addIngredient(d.id, moved ? d.x : d.tile.x, moved ? d.y : d.tile.y, moved);
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = performance.now(); const t0 = last;
    let eatCv = null;
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
        const st = g.st, gu = guest();
        drawBackground(ctx, W, H, L);

        // 손님
        const arriveK = g.phase === 'arrive' ? easeOut((t - g.phaseT) / 0.9) : 1;
        const gxNow = -L.S + (L.gx + L.S) * arriveK;
        const hopY = g.phase === 'arrive' ? -Math.abs(Math.sin((t - g.phaseT) * 9)) * L.S * 0.08 * (1 - arriveK) : 0;
        let mouth = 0;
        if (g.phase === 'eat') {
          const e = t - g.phaseT;
          if (g.blowAt != null && e > 0.3 && e < g.blowAt + 0.3) mouth = 0.35;
          g.biteAt.forEach(at => { const k = (e - (at - 0.4)) / 0.5; if (k > 0 && k < 1) mouth = Math.max(mouth, Math.sin(k * Math.PI)); const ch = e - at; if (ch > 0.1 && ch < 0.7) mouth = Math.max(mouth, 0.25 * Math.abs(Math.sin(ch * 18))); });
        }
        const happy = t < g.happyUntil;
        const oy = L.gy + hopY + (happy ? -Math.abs(Math.sin(t * 6)) * L.S * 0.05 : 0);
        ctx.save(); ctx.translate(gxNow, oy);
        ctx.beginPath(); ctx.rect(-L.S * 2, -L.S * 3, L.S * 4, L.counterY - oy + L.S * 3 + 2); ctx.clip();   // 카운터 아래는 가림
        GUEST_FN[gu.id](ctx, L.S, t, happy, mouth);
        ctx.restore();
        // 말풍선
        if (g.phase !== 'arrive') {
          const bx = gxNow + L.S * (L.land ? 0.42 : 0.62), by = L.gy - L.S * (L.land ? 1.42 : 1.15), br = L.S * 0.26;
          ctx.save(); shadowOn(ctx, 10, 3, 'rgba(0,0,0,0.15)');
          ctx.fillStyle = '#ffffff'; ell(ctx, bx, by, br * 1.25, br); ctx.fill();
          ctx.beginPath(); ctx.moveTo(bx - br * 0.6, by + br * 0.6); ctx.lineTo(bx - br * 1.05, by + br * 1.25); ctx.lineTo(bx - br * 0.15, by + br * 0.85); ctx.fill(); shadowOff(ctx);
          if (g.phase === 'end') { drawHeart(ctx, bx, by + br * 0.2, br * 0.9 * (1 + Math.sin(t * 6) * 0.08), '#f43f5e'); }
          else { drawIcon(ctx, gu.fav, bx - br * 0.18, by, br * 0.62); drawHeart(ctx, bx + br * 0.75, by - br * 0.35, br * 0.32 * (1 + Math.sin(t * 5) * 0.12), '#f472b6'); }
          ctx.restore();
        }
        // 손님 앞 음식 (나르기·먹기·끝)
        if (g.phase === 'carry' || g.phase === 'eat' || g.phase === 'end') {
          const sc = L.S * (SERVE_SC[g.menu] || 0.3) / L.R;   // 손님 얼굴(입)을 가리지 않는 크기
          let Rs = L.R * sc, fx = L.serveX, fy = L.counterY - Rs * (SERVE_DY[g.menu] || 0);
          if (g.phase === 'carry') {
            const k = easeOut((t - g.carry.t0) / 0.7);
            fx = g.carry.x0 + (fx - g.carry.x0) * k; fy = g.carry.y0 + (fy - g.carry.y0) * k - Math.sin(k * Math.PI) * L.S * 0.5;
            Rs = L.R + (Rs - L.R) * k;
            if (k >= 1) startEat();
          }
          // 촛불 끄기: 연기
          if (g.phase === 'eat' && g.blowAt != null && t - g.phaseT > g.blowAt && st.candles.some(c => c.lit)) {
            const cg = cakeGeom(fx, fy, Rs);
            st.candles.forEach(c => { c.lit = false; const cx = fx + c.x * cg.rx * 0.78, cy = cg.topY + c.y * cg.ry * 0.78 - Rs * 0.38; for (let i = 0; i < 4; i++) g.parts.push({ kind: 'smoke', x: cx, y: cy, vx: (Math.random() - 0.5) * 14, vy: -30 - Math.random() * 20, born: t + i * 0.1, life: 1.5, r: Rs * 0.05 }); });
          }
          const eaten = g.phase === 'end' ? 3 : g.bites.length;
          if (eaten === 0) drawFood(ctx, g.menu, st, fx, fy, Rs, t);
          else {
            // 먹은 만큼 오른쪽부터 베어 문 자국
            const pad = Rs * 1.8, size = Math.ceil(pad * 2 * dpr);
            if (!eatCv || eatCv.width !== size) { eatCv = document.createElement('canvas'); eatCv.width = eatCv.height = size; }
            const ec = eatCv.getContext('2d'); ec.setTransform(1, 0, 0, 1, 0, 0); ec.clearRect(0, 0, size, size); ec.setTransform(dpr, 0, 0, dpr, 0, 0);
            // 그릇은 남기고 음식만 베어 먹는다
            drawDish(ctx, g.menu, fx, fy, Rs);
            if (eaten < 3) {
              drawFood(ec, g.menu, st, pad, pad, Rs, t, { noPlate: true, noBoard: true });
              ec.globalCompositeOperation = 'destination-out';
              const r = rng(5);
              for (let k = 0; k < eaten; k++) for (let i = 0; i < 7; i++) {
                // 피자는 손님 입이 있는 위쪽부터, 나머지는 오른쪽부터
                const top = BITE_FROM_TOP[g.menu], ice = g.menu === 'icecream';
                const along = Rs * (ice ? 1.3 - k * 0.85 : 1.05 - k * 0.7) + (r() - 0.5) * Rs * 0.2, across = (i - 3) * Rs * 0.45;
                const ex = pad + (top ? across : along), ey = pad + (top ? -along : across);
                ec.beginPath(); ec.arc(ex, ey, Rs * 0.5, 0, TAU); ec.fill();
              }
              ec.globalCompositeOperation = 'source-over';
              ctx.drawImage(eatCv, fx - pad, fy - pad, pad * 2, pad * 2);
            }
          }
        }

        // 주방 탁자 위
        if (g.phase === 'cook' || (g.phase === 'serve' && !(g.drag && g.drag.plate))) {
          const m = g.menu;
          if (m === 'pizza') {
            let glow = 0;
            if (g.step === 'bake') { const e = t - g.stepT; st.bake = clamp01(e / 3.2); glow = 0.6 + Math.sin(t * 8) * 0.1; if (e > 3.2) { g.step = 'fromOven'; g.stepT = t; audio.playXylophone(1760, 0.7); setTimeout(() => audio.playXylophone(2093, 0.6), 150); say(VOICE.kitchenDing()); sync(); } else if (Math.floor(e / 0.35) !== g.sizzleN) { g.sizzleN = Math.floor(e / 0.35); audio.playNoise(0.3, 0.12, 5200, 0.6); } }
            const ov = drawOven(ctx, L.ovenX, L.ovenY, L.ovenS, glow);
            // 피자 위치 (오븐 안팎)
            let px = L.cx, py = L.cy, pr = L.R, inOven = false;
            if (g.step === 'toOven') { const k = easeOut((t - g.stepT) / 0.8); px = L.cx + (ov.wx - L.cx) * k; py = L.cy + (ov.wy - L.cy) * k; pr = L.R + (ov.wr - L.R) * k; if (k >= 1) { g.step = 'bake'; g.stepT = t; g.sizzleN = -1; sync(); } }
            else if (g.step === 'bake') { px = ov.wx; py = ov.wy; pr = ov.wr; inOven = true; }
            else if (g.step === 'fromOven') { const k = easeOut((t - g.stepT) / 0.8); px = ov.wx + (L.cx - ov.wx) * k; py = ov.wy + (L.cy - ov.wy) * k; pr = ov.wr + (L.R - ov.wr) * k; if (k >= 1 && g.phase === 'cook') { g.step = 'baked'; later(finishCooking, 900); } }
            if (st.sauceFull > 0 && st.sauceFull < 1) st.sauceFull = clamp01((t - g.sauceT) / 0.6);
            if (inOven) { ctx.save(); ctx.beginPath(); ctx.roundRect(L.ovenX - L.ovenS * 0.82, L.ovenY - L.ovenS * 0.42, L.ovenS * 1.64, L.ovenS * 1.15, L.ovenS * 0.1); ctx.clip(); drawPizza(ctx, st, px, py, pr, { noBoard: true }); ctx.restore(); drawOvenGlass(ctx, L.ovenX, L.ovenY, L.ovenS, glow); }
            else { drawOvenGlass(ctx, L.ovenX, L.ovenY, L.ovenS, 0); drawPizza(ctx, st, px, py, pr, { noBoard: g.step === 'toOven' || g.step === 'fromOven' }); }
            if ((g.step === 'fromOven' || g.step === 'baked' || g.phase === 'serve') && Math.random() < 0.15) g.parts.push({ kind: 'steam', x: px + (Math.random() - 0.5) * pr * 1.2, y: py - pr * 0.2, vx: (Math.random() - 0.5) * 10, vy: -40 - Math.random() * 20, born: t, life: 1.4, r: pr * 0.05 });
            if (g.step === 'top' && st.toppings.length) { ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.4; ctx.font = `${Math.round(L.ovenS * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('👆', L.ovenX, L.ovenY + L.ovenS * 1.35); ctx.restore(); }
          } else if (m === 'sandwich') {
            if (st.topBread != null) st.topBread = clamp01((t - g.coverT) / 0.5);
            drawSandwich(ctx, st, L.cx, L.cy, L.R, t);
          } else if (m === 'skewer') {
            if (g.step === 'cut') {
              drawBoard(ctx, L.cx, L.cy, L.R * 2.6, L.R * 1.25);
              st.fruits.forEach(f => {
                const fx = L.cx + (f.i - 1.5) * L.R * 0.55, fy = L.cy;
                if (f.cutT == null) drawWhole(ctx, f.id, fx, fy + Math.sin(t * 2 + f.i) * 2, L.R * 0.22);
                else {
                  const e = t - f.cutT;
                  if (e < 0.4) drawWhole(ctx, f.id, fx, fy, L.R * 0.22);
                  else [-1, 0, 1].forEach(k => drawPiece(ctx, f.id, fx + k * L.R * 0.13 * Math.min(1, (e - 0.4) * 4), fy + Math.abs(k) * L.R * 0.06, L.R * 0.12, k * 0.3));
                }
              });
              if (g.knife) { const e = t - g.knife.t0; if (e < 0.6) { const down = Math.abs(Math.sin(e / 0.6 * Math.PI * 2)); drawKnife(ctx, g.knife.x + L.R * 0.05, g.knife.y - L.R * 0.45 + down * L.R * 0.3, L.R * 0.75, -0.35); } }
            } else drawSkewer(ctx, st, L.cx, L.cy, L.R);
          } else if (m === 'pancake') {
            if (g.step === 'pan' && st.pan) {
              panTick();
              const pan = st.pan || { state: 'empty', t0: t }, e = t - pan.t0;
              const px = L.cx - L.R * 0.62, py = L.cy, pr = L.R * 0.62, cr = pr * 0.72;
              const sx = L.cx + L.R * 0.98, sy = L.cy + L.R * 0.05, sR = L.R * 0.55;
              drawPan(ctx, px, py, pr, pan.state !== 'empty');
              drawPancakes(ctx, st, sx, sy, sR, t);
              const seed = st.cakes * 7;
              if (pan.state === 'pour') {
                const k = clamp01(e / 0.9);
                panCakeTop(ctx, px, py, cr * easeOut(k), 'raw', 0, seed);
                if (k < 0.85) {
                  ctx.save(); ctx.strokeStyle = '#f3d9a3'; ctx.lineWidth = pr * 0.09 * (1 - k * 0.5); ctx.lineCap = 'round';
                  ctx.beginPath(); ctx.moveTo(px + pr * 0.45, py - pr * 1.05); ctx.quadraticCurveTo(px + pr * 0.15, py - pr * 0.8, px, py); ctx.stroke();
                  // 반죽 그릇
                  ctx.translate(px + pr * 0.55, py - pr * 1.1); ctx.rotate(-0.7);
                  shadowOn(ctx, pr * 0.1, pr * 0.05);
                  ctx.fillStyle = lg(ctx, -pr * 0.4, 0, pr * 0.4, 0, [[0, '#e0f2fe'], [0.5, '#ffffff'], [1, '#bae6fd']]);
                  ctx.beginPath(); ctx.moveTo(-pr * 0.42, -pr * 0.1); ctx.quadraticCurveTo(-pr * 0.4, pr * 0.35, 0, pr * 0.35); ctx.quadraticCurveTo(pr * 0.4, pr * 0.35, pr * 0.42, -pr * 0.1); ctx.closePath(); ctx.fill(); shadowOff(ctx);
                  ctx.fillStyle = '#f3d9a3'; ell(ctx, 0, -pr * 0.1, pr * 0.42, pr * 0.1); ctx.fill();
                  ctx.restore();
                }
              } else if (pan.state === 'cook' || pan.state === 'ready') {
                const wob = pan.state === 'ready' ? 1 + Math.sin(t * 9) * 0.02 : 1;
                panCakeTop(ctx, px, py, cr * wob, 'raw', pan.state === 'ready' ? 1 : clamp01(e / 2.0), seed);
                if (pan.state === 'ready') { ctx.save(); ctx.font = `${Math.round(pr * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.4; ctx.fillText('👆', px + pr * 0.15, py + pr * 0.35 + Math.sin(t * 6) * pr * 0.06); ctx.restore(); }
                if (Math.random() < 0.08) g.parts.push({ kind: 'steam', x: px + (Math.random() - 0.5) * cr, y: py - cr * 0.2, vx: 0, vy: -40, born: t, life: 1.2, r: pr * 0.06 });
              } else if (pan.state === 'flip') {
                const k = clamp01(e / 0.7), sy2 = Math.cos(k * Math.PI), lift = Math.sin(k * Math.PI) * pr * 0.9;
                ctx.save(); ctx.translate(px, py - lift); ctx.scale(1 + Math.sin(k * Math.PI) * 0.2, Math.max(0.04, Math.abs(sy2)));
                panCakeTop(ctx, 0, 0, cr, sy2 >= 0 ? 'raw' : 'cooked', 1, seed); ctx.restore();
              } else if (pan.state === 'cooked2') panCakeTop(ctx, px, py, cr, 'cooked', 1, seed);
              else if (pan.state === 'toStack') {
                const k = easeOut(e / 0.6), pg = pancakeGeom(sx, sy, sR), ty = pg.base - pg.th * (st.cakes + 0.5);
                ctx.save(); ctx.translate(px + (sx - px) * k, py + (ty - py) * k - Math.sin(k * Math.PI) * pr * 0.6);
                ctx.scale(1 - k * (1 - pg.w / 2 / cr), 1 - k * 0.7); panCakeTop(ctx, 0, 0, cr, 'cooked', 1, seed); ctx.restore();
              }
            } else drawPancakes(ctx, st, L.cx, L.cy, L.R, t);
          } else if (m === 'cake') {
            if (st.rub && st.rub.full > 0 && st.rub.full < 1) st.rub.full = clamp01((t - st.rub.fullT) / 0.6);
            drawCake(ctx, st, L.cx, L.cy, L.R, t);
          } else if (m === 'kimbap') {
            const kg = kimbapGeom(L.cx, L.cy, L.R);
            if (g.step === 'cut' || g.phase === 'serve') {
              if (g.phase === 'serve') drawKimbapPlate(ctx, st, L.cx, L.cy, L.R);
              else {
                drawBoard(ctx, L.cx, L.cy, L.R * 2.7, L.R * 0.95);
                drawKimbapRoll(ctx, st, L.cx, L.cy, L.R * 2.2, L.R * 0.2, st.cut);
                if (g.knife) { const e = t - g.knife.t0; if (e < 0.6) { const down = Math.abs(Math.sin(e / 0.6 * Math.PI * 2)); drawKnife(ctx, g.knife.x + L.R * 0.05, g.knife.y - L.R * 0.45 + down * L.R * 0.3, L.R * 0.75, -0.35); } }
                else if (st.cut === 0) { ctx.save(); ctx.font = `${Math.round(L.R * 0.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.4; ctx.fillText('👆', L.cx + L.R * 0.8, L.cy + L.R * 0.6); ctx.restore(); }
              }
            } else {
              const rollK = g.step === 'roll' ? clamp01((t - g.rollT) / 1.4) : 0;
              if (rollK >= 1 && g.step === 'roll') { g.step = 'cut'; say(VOICE.kitchenCut()); sync(); }
              drawMat(ctx, kg);
              const edge = kg.ly0 + kg.lh * (1 - easeOut(rollK) * 0.92);
              ctx.save(); ctx.beginPath(); ctx.rect(kg.lx0 - 2, kg.ly0 - 2, kg.lw + 4, edge - kg.ly0 + 2); ctx.clip();
              drawLaver(ctx, kg.lx0, kg.ly0, kg.lw, kg.lh);
              if (st.rub && st.rub.cv) { ctx.save(); ctx.beginPath(); ctx.rect(kg.lx0, kg.ly0 + kg.lh * 0.18, kg.lw, kg.lh * 0.82); ctx.clip(); ctx.drawImage(st.rub.cv, kg.lx0, kg.ly0, kg.lw, kg.lh); ctx.restore(); }
              st.layers.forEach((l, i) => drawStrip(ctx, l.id, kg.lx0 + kg.lw * 0.04, kg.lx0 + kg.lw * 0.96, kg.ly0 + kg.lh * (0.86 - i * 0.1), kg.lh * 0.075, l.seed || i));
              ctx.restore();
              if (rollK > 0) {
                const rr = kg.lh * (0.07 + rollK * 0.09);
                ctx.save(); shadowOn(ctx, rr * 0.4, rr * 0.2);
                ctx.fillStyle = lg(ctx, 0, edge - rr, 0, edge + rr, [[0, '#3a4a38'], [0.35, '#1d281d'], [1, '#0d140d']]);
                ctx.beginPath(); ctx.roundRect(kg.lx0, edge - rr, kg.lw, rr * 2, rr); ctx.fill(); shadowOff(ctx);
                ctx.strokeStyle = 'rgba(160,190,150,0.3)'; ctx.lineWidth = rr * 0.12; ctx.beginPath(); ctx.moveTo(kg.lx0 + rr, edge - rr * 0.5); ctx.lineTo(kg.lx0 + kg.lw - rr, edge - rr * 0.5); ctx.stroke();
                ctx.restore();
              }
            }
          } else if (m === 'icecream') {
            drawIceCream(ctx, st, L.cx, L.cy, L.R, t);
          }
          // 서빙 안내 화살표
          if (g.phase === 'serve' && !g.drag) {
            ctx.save(); ctx.font = `${Math.round(L.R * 0.45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const wob = Math.sin(t * 6) * L.R * 0.08;
            if (L.land) ctx.fillText('👈', L.cx - L.R * 1.55 + wob, L.cy); else ctx.fillText('👆', L.cx - L.R * 0.9, L.cy - L.R * 1.25 + wob);
            ctx.restore();
          }
        }
        // 접시 끌기 중
        if (g.drag && g.drag.plate) { ctx.save(); ctx.globalAlpha = 0.95; drawFood(ctx, g.menu, st, g.drag.x, g.drag.y, L.R * 0.8, t); ctx.restore(); }

        // 재료 칸
        const ids = trayIds();
        g.tiles = trayTiles(L, ids);
        g.tiles.forEach(tile => drawTile(ctx, tile, tile.id === gu.fav, t, g.drag && g.drag.id === tile.id));
        // 날아가는 재료
        g.fly = g.fly.filter(f => {
          const k = (t - f.t0) / f.dur; if (k < 0) return true;
          const kk = easeOut(k), x = f.x0 + (f.tx - f.x0) * kk, y = f.y0 + (f.ty - f.y0) * kk - Math.sin(clamp01(k) * Math.PI) * L.R * 0.5;
          if (f.kind === 'piece') drawPiece(ctx, f.id, x, y, L.R * 0.3); else drawIcon(ctx, f.id, x, y, L.R * (0.3 - 0.1 * kk));
          if (k >= 1) { f.done(f); return false; }
          return true;
        });
        // 끌고 있는 재료
        if (g.drag && !g.drag.plate && Math.hypot(g.drag.x - g.drag.sx, g.drag.y - g.drag.sy) > 14) drawIcon(ctx, g.drag.id, g.drag.x, g.drag.y - 10, L.R * 0.3);
        // 효과
        g.parts = g.parts.filter(p => {
          const e = t - p.born; if (e < 0) return true; if (e > p.life) return false;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const a = 1 - e / p.life;
          if (p.kind === 'crumb') { p.vy += 500 * dt; ctx.fillStyle = p.col; ctx.globalAlpha = a; ell(ctx, p.x, p.y, p.r, p.r * 0.8); ctx.fill(); }
          else if (p.kind === 'star') { ctx.globalAlpha = a; ctx.fillStyle = '#fde047'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(e * 5); ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? 3 : 8; ctx.lineTo(Math.cos(i / 10 * TAU) * rr, Math.sin(i / 10 * TAU) * rr); } ctx.fill(); ctx.restore(); }
          else if (p.kind === 'heart') { ctx.globalAlpha = a; drawHeart(ctx, p.x + Math.sin(e * 4) * 10, p.y, 16, '#f472b6'); }
          else if (p.kind === 'smoke') { ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#9ca3af'; ell(ctx, p.x + Math.sin(e * 5) * 4, p.y, p.r * (1 + e * 1.5), p.r * (1 + e * 1.5)); ctx.fill(); }
          else if (p.kind === 'steam') { ctx.globalAlpha = a * 0.22; ctx.fillStyle = '#ffffff'; ell(ctx, p.x, p.y, p.r * (1 + e), p.r * (1 + e)); ctx.fill(); }
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
  const gu = GUEST_BY_ID[ui.guest];
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(120,60,20,0.6)', whiteSpace: 'nowrap' });
  let action = null;
  if (ui.phase === 'cook') {
    if (ui.menu === 'sandwich' && ui.step === 'stack' && ui.n > 0) action = <button onClick={coverSandwich} style={btn('#f59e0b')}>🍞 빵 덮어서 완성!</button>;
    if (ui.menu === 'pizza' && ui.step === 'top' && ui.n > 0) action = <button onClick={startBake} style={btn('#ef4444')}>🔥 오븐에 굽기</button>;
    if (ui.menu === 'skewer' && ui.step === 'stick' && ui.n >= 2) action = <button onClick={finishSkewer} style={btn('#22c55e')}>✨ 꼬치 완성!</button>;
    if (ui.menu === 'pancake' && ui.step === 'top') action = <button onClick={finishSimple} style={btn('#f59e0b')}>✨ 팬케이크 완성!</button>;
    if (ui.menu === 'cake' && ui.step === 'deco') action = <button onClick={placeCandles} style={btn('#ec4899')}>🕯️ 초 꽂고 완성!</button>;
    if (ui.menu === 'kimbap' && ui.step === 'fill' && ui.n > 0) action = <button onClick={rollKimbap} style={btn('#16a34a')}>🌀 돌돌 말기</button>;
    if (ui.menu === 'icecream' && ui.step === 'scoop' && ui.n > 0) action = <button onClick={finishSimple} style={btn('#8b5cf6')}>🍦 아이스크림 완성!</button>;
  }
  const HINT = {
    'sandwich:stack': '🥪 재료를 콕! 눌러서 빵 위에 올려요', 'sandwich:cover': '🍞 빵을 덮어요',
    'pizza:sauce': '🍅 손가락으로 쓱쓱 소스를 발라요', 'pizza:top': '🧀 재료를 콕! 눌러서 뿌려요', 'pizza:toOven': '🔥 오븐에 쏙!', 'pizza:bake': '🔥 지글지글 굽는 중...', 'pizza:fromOven': '✨ 다 구워졌어요!', 'pizza:baked': '✨ 다 구워졌어요!',
    'skewer:cut': '🔪 과일을 콕! 눌러서 썰어요', 'skewer:stick': '🍓 과일 조각을 콕! 꼬치에 끼워요',
    'pancake:pan:empty': '🥣 팬을 콕! 눌러서 반죽을 부어요', 'pancake:pan:pour': '🥣 주르륵~', 'pancake:pan:cook': '🔥 보글보글 익는 중...', 'pancake:pan:ready': '👆 팬케이크를 톡! 눌러서 뒤집어요',
    'pancake:pan:flip': '✨ 휙!', 'pancake:pan:cooked2': '✨ 노릇노릇!', 'pancake:pan:toStack': '✨ 접시에 쏙!', 'pancake:top': '🍯 꿀이랑 과일을 콕! 올려요',
    'cake:cream': '🍰 손가락으로 쓱쓱 생크림을 발라요', 'cake:deco': '🍓 재료를 콕! 눌러서 꾸며요', 'cake:candle': '🕯️ 초를 꽂아요',
    'kimbap:rice': '🍚 손가락으로 쓱쓱 밥을 펴요', 'kimbap:fill': '🥕 재료를 콕! 눌러서 올려요', 'kimbap:roll': '🌀 돌돌돌 말아요', 'kimbap:cut': '🔪 김밥을 콕! 눌러서 썰어요',
    'icecream:scoop': '🍦 좋아하는 맛을 콕! 눌러서 쌓아요'
  };
  const hint = ui.phase === 'cook' ? (HINT[`${ui.menu}:${ui.step}:${ui.sub}`] || HINT[`${ui.menu}:${ui.step}`]) : ui.phase === 'serve' ? (ui.land ? '👈 접시를 손님에게 갖다 주세요!' : '👆 접시를 손님에게 갖다 주세요!') : ui.phase === 'eat' || ui.phase === 'carry' ? '😋 냠냠 먹는 중...' : null;
  const workArea = ui.land ? { left: '34%', right: '1.5%', top: '6%', bottom: '6%' } : { left: '3%', right: '3%', top: '39%', bottom: '3%' };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={nextGuest} style={btn('#f6efe7', '#5c5248')}>🙋 다른 손님</button>
        {(ui.phase === 'cook') && <button onClick={backToMenu} style={btn('#ffffff', '#9a3412')}>📋 다른 요리</button>}
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#9a3412', minWidth: '160px' }}>🍽️ {gu.name} 손님의 식당</div>
        {action}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(154,52,18,0.55)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: workArea.left, right: workArea.right, top: ui.land ? '12px' : workArea.top, textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.88)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.25rem', color: '#7c2d12', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
        {ui.phase === 'menu' && (
          <div style={{ position: 'absolute', ...workArea, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'center', fontFamily: JUA, fontSize: '1.6rem', color: '#7c2d12', textShadow: '0 2px 0 #fff' }}>무엇을 만들어 줄까요?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {KITCHEN_MENUS.map(m => (
                <button key={m.id} onClick={() => chooseMenu(m.id)} style={{ border: 'none', borderRadius: '22px', padding: '6px 4px 8px', background: 'rgba(255,253,248,0.95)', cursor: 'pointer', touchAction: 'manipulation', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', boxShadow: '0 14px 26px -16px rgba(120,60,20,0.7)' }}>
                  <MenuIcon menu={m.id} />
                  <span style={{ fontFamily: JUA, fontSize: '1.2rem', color: '#7c2d12', whiteSpace: 'nowrap' }}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {ui.phase === 'end' && (
          <div style={{ position: 'absolute', ...workArea, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#db2777', textShadow: '0 3px 0 #fff' }}>😋 맛있게 먹었어요!</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={again} style={btn('#f97316')}>🍳 하나 더 만들어 주기</button>
              <button onClick={nextGuest} style={btn('#8b5cf6')}>🙋 다음 손님</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 메뉴 고르기 카드의 완성 음식 그림
const SAMPLE = {
  sandwich: () => ({ ...newCook(), layers: ['lettuce', 'tomato', 'cheese', 'ham', 'egg'].map(id => ({ id, dx: 0, rot: 0 })), topBread: 1 }),
  pizza: () => {
    const r = rng(9), ids = ['cheese', 'pepperoni', 'pepper', 'mushroom', 'olive', 'corn'], tp = [];
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.7; tp.push({ id: ids[i % ids.length], x: Math.cos(a) * d, y: Math.sin(a) * d, rot: r() * TAU, v: i % 3 }); }
    return { ...newCook(), toppings: tp, sauceFull: 1, bake: 1 };
  },
  skewer: () => ({ ...newCook(), skewer: ['strawberry', 'banana', 'kiwi', 'orange', 'strawberry', 'kiwi'].map(id => ({ id, rot: 0 })) }),
  pancake: () => ({ ...newCook(), cakes: 3, syrup: 2, toppings: [{ id: 'butter', x: -0.05, y: -0.1, rot: 0, v: 0 }, { id: 'strawberry', x: 0.5, y: 0.2, rot: 0, v: 0 }, { id: 'blueberry', x: -0.5, y: 0.3, rot: 0, v: 0 }] }),
  cake: () => ({ ...newCook(), rub: { full: 1 }, toppings: [[-0.5, 0.25], [0.5, 0.25], [0, 0.55]].map(([x, y]) => ({ id: 'strawberry', x, y, rot: 0, v: 0 })), candles: [[-0.5, -0.35], [0, -0.55], [0.5, -0.35]].map(([x, y], i) => ({ x, y, lit: true, i })) }),
  kimbap: () => ({ ...newCook(), layers: ['danmuji', 'spinach', 'ham', 'egg', 'carrot'].map(id => ({ id })) }),
  icecream: () => ({ ...newCook(), scoops: ['icMelon', 'icStrawberry', 'vanilla'], toppings: [{ id: 'cherry', si: 2, x: 0, y: -0.78, rot: 0, v: 0 }, { id: 'sprinkles', si: 2, x: -0.3, y: -0.4, rot: 0, v: 0 }] })
};
const ICON_POS = { sandwich: [0.52, 48], pizza: [0.5, 44], skewer: [0.45, 46], pancake: [0.42, 50], cake: [0.56, 50], kimbap: [0.5, 54], icecream: [0.5, 38] };
function MenuIcon({ menu }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = 150, H = 120;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const st = SAMPLE[menu]();
    const [yk, size] = ICON_POS[menu];
    drawFood(ctx, menu, st, W / 2, H * yk, size, 0);
  }, [menu]);
  return <canvas ref={ref} style={{ width: 150, maxWidth: '100%', aspectRatio: '150 / 120', display: 'block' }} />;
}
