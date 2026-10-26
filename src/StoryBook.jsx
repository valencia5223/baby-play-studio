// ═════════════════════════════════════════════════════════════════════════════
// 🌙 잠자리 그림책: 어항·목장 친구들과 유나가 나오는 짧은 이야기를 부드러운 여성 목소리로 읽어 준다
//  - 이야기·쪽 데이터: storyData.js / 음성: public/story-voice (scripts/generate-story-voices.mjs, ko-KR-SunHiNeural)
//  - 그림: 캔버스 한 장. 배경(밤바다·목장·연못·방·욕실·부엌·마당)과 유나는 여기서 그리고,
//    물고기·바다 친구는 AquariumGame 의 drawFish, 목장 동물은 FarmGame 의 drawAnimal 을 빌려 그린다
//  - 읽기가 끝나면 저절로 다음 쪽 → 마지막엔 '잘 자요' 화면 + 자장가(잠들기 타이머). 하룻밤 이야기 수 제한은 부모 설정
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { STORIES, STORY_SHELF_LINE, STORY_END_LINE, STORY_LIMIT_LINE } from './storyData.js';
import { drawFish, lookOf } from './AquariumGame.jsx';
import { drawAnimal } from './FarmGame.jsx';
import { FISH_BY_ID, isNightTime } from './aquariumData.js';
import { FARM_SPECIES } from './farmData.js';

const TAU = Math.PI * 2;
const FARM_BY_ID = Object.fromEntries(FARM_SPECIES.map(s => [s.id, s]));
const SAVE_KEY = 'bps_story_v1';
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
// 밤 이야기 횟수는 저녁 6시 ~ 다음 날 아침까지를 하룻밤으로 센다
const nightKey = () => { const d = new Date(); if (d.getHours() < 12) d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const loadSettings = () => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && typeof s === 'object') return { timer: 5, limit: 0, night: '', count: 0, last: null, ...s };
  } catch { /* 처음 */ }
  return { timer: 5, limit: 0, night: '', count: 0, last: null };
};
const saveSettings = (s) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* 무시 */ } };

// 시드 고정 난수 (그릴 때마다 같은 자리에 별·자갈이 나오게)
const seeded = (seed) => { let v = seed * 9301 + 49297; return () => { v = (v * 16807) % 2147483647; return v / 2147483647; }; };

// ─────────────────────────────── 배경 ───────────────────────────────
function sky(ctx, W, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function stars(ctx, W, H, t, n = 40, maxY = 0.6, seed = 3) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H * maxY, s = 0.8 + r() * 1.8, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i);
    ctx.fillStyle = `rgba(255,251,220,${0.35 + 0.65 * tw})`;
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    if (s > 2.2) { ctx.strokeStyle = `rgba(255,251,220,${0.4 * tw})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - s * 3, y); ctx.lineTo(x + s * 3, y); ctx.moveTo(x, y - s * 3); ctx.lineTo(x, y + s * 3); ctx.stroke(); }
  }
}
function moon(ctx, x, y, r, face) {
  const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
  glow.addColorStop(0, 'rgba(254,249,195,0.45)'); glow.addColorStop(1, 'rgba(254,249,195,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(234,179,8,0.18)';
  [[-0.35, -0.2, 0.18], [0.3, 0.25, 0.13], [0.1, -0.45, 0.09]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); ctx.fill(); });
  if (face) {
    // 잠든 달님 얼굴 (감은 눈 + 미소 + 발그레)
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(1.2, r * 0.07); ctx.lineCap = 'round';
    [-0.32, 0.32].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx * r, y - 0.05 * r, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(x, y + 0.22 * r, r * 0.18, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(251,113,133,0.35)';
    [-0.5, 0.5].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx * r, y + 0.18 * r, r * 0.13, 0, TAU); ctx.fill(); });
  }
}
function sun(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2);
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.lineTo(Math.cos(a) * r * 1.65, Math.sin(a) * r * 1.65); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#92400e';
  [-0.32, 0.32].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx * r, y - 0.1 * r, r * 0.09, 0, TAU); ctx.fill(); });
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(x, y + 0.1 * r, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(251,113,133,0.4)'; [-0.55, 0.55].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx * r, y + 0.2 * r, r * 0.13, 0, TAU); ctx.fill(); });
}
function cloud(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.25, 0.75], [0.35, -0.35, 0.75], [-0.4, -0.25, 0.6]].forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * k, 0, TAU); ctx.fill(); });
}

function bgSea(ctx, W, H, t, time) {
  const pal = time === 'day' ? [[0, '#7dd3fc'], [0.5, '#0ea5e9'], [1, '#075985']]
    : time === 'dusk' ? [[0, '#fbcfe8'], [0.12, '#a78bfa'], [0.45, '#3b5bb5'], [1, '#14295e']]
      : [[0, '#1e3a8a'], [0.5, '#132a63'], [1, '#0a1433']];
  sky(ctx, W, H, pal);
  // 위에서 내려오는 빛줄기
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = W * (0.12 + i * 0.2) + Math.sin(t * 0.3 + i) * 20;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    g.addColorStop(0, `rgba(255,255,255,${time === 'night' ? 0.05 : time === 'dusk' ? 0.08 : 0.12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 90, H * 0.8); ctx.lineTo(x - 50, H * 0.8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (time === 'night') stars(ctx, W, H, t, 30, 0.7, 7);   // 반짝이는 플랑크톤
  // 모래 바닥
  const fy = H * 0.84;
  const sand = ctx.createLinearGradient(0, fy, 0, H);
  sand.addColorStop(0, time === 'night' ? '#6b6383' : '#e9d5a1'); sand.addColorStop(1, time === 'night' ? '#3b3557' : '#c4a46b');
  ctx.fillStyle = sand; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 20) { const xx = Math.min(x, W); ctx.lineTo(xx, fy + Math.sin(xx * 0.012) * 8 + Math.sin(xx * 0.031) * 4); }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  // 해초 (살랑살랑)
  const r = seeded(11);
  for (let i = 0; i < 7; i++) {
    const x = W * (0.05 + i * 0.15 + r() * 0.05), h = H * (0.22 + r() * 0.2);
    ctx.strokeStyle = time === 'night' ? '#256e5a' : '#22a06b'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, fy + 6);
    for (let k = 1; k <= 8; k++) { const q = k / 8; ctx.lineTo(x + Math.sin(t * 1.2 + q * 3 + i) * 12 * q, fy - h * q); }
    ctx.stroke();
  }
  // 조개·불가사리
  ctx.font = `${Math.round(H * 0.06)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center';
  ctx.globalAlpha = time === 'night' ? 0.6 : 1;
  ctx.fillText('🐚', W * 0.12, H * 0.95); ctx.fillText('⭐', W * 0.88, H * 0.96);
  ctx.globalAlpha = 1;
  // 거품
  for (let i = 0; i < 8; i++) {
    const y = H - ((t * 40 + i * 97) % H), x = W * (0.1 + (i * 0.13) % 0.85) + Math.sin(t + i) * 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3) * 2, 0, TAU); ctx.stroke();
  }
}

function bgFarm(ctx, W, H, t, time) {
  const pal = time === 'sunset' ? [[0, '#fb923c'], [0.35, '#f9a8d4'], [0.7, '#c4b5fd'], [1, '#c4b5fd']]
    : time === 'dusk' ? [[0, '#6d5bd0'], [0.45, '#e879a6'], [0.75, '#fdba74'], [1, '#fdba74']]
      : [[0, '#0b1433'], [0.6, '#1e2a5e'], [1, '#2b3a75']];
  sky(ctx, W, H * 0.75, pal);
  if (time === 'night') { stars(ctx, W, H, t, 55, 0.55, 5); }
  if (time === 'sunset') { ctx.fillStyle = 'rgba(253,224,71,0.9)'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.5, H * 0.09, 0, TAU); ctx.fill(); }
  if (time !== 'night') { cloud(ctx, W * 0.2, H * 0.18, H * 0.05, 'rgba(255,255,255,0.6)'); cloud(ctx, W * 0.6, H * 0.12, H * 0.04, 'rgba(255,255,255,0.5)'); }
  const dark = time === 'night';
  // 먼 언덕
  ctx.fillStyle = dark ? '#1f3d3a' : time === 'dusk' ? '#7c8f5a' : '#9bbf6a';
  ctx.beginPath(); ctx.moveTo(0, H * 0.62);
  for (let x = 0; x <= W + 20; x += 20) { const xx = Math.min(x, W); ctx.lineTo(xx, H * 0.6 - Math.sin(xx * 0.006 + 1) * H * 0.08); }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  // 헛간
  const bx = W * 0.14, by = H * 0.66, bw = W * 0.16, bh = H * 0.2;
  ctx.fillStyle = dark ? '#6b1f1f' : '#c2410c'; ctx.fillRect(bx, by - bh, bw, bh);
  ctx.fillStyle = dark ? '#4a1414' : '#9a3412';
  ctx.beginPath(); ctx.moveTo(bx - bw * 0.08, by - bh); ctx.lineTo(bx + bw / 2, by - bh * 1.55); ctx.lineTo(bx + bw * 1.08, by - bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark ? '#fde68a' : '#fef3c7'; ctx.fillRect(bx + bw * 0.38, by - bh * 0.62, bw * 0.24, bh * 0.62);
  ctx.strokeStyle = dark ? '#7c2d12' : '#7c2d12'; ctx.lineWidth = 2; ctx.strokeRect(bx + bw * 0.38, by - bh * 0.62, bw * 0.24, bh * 0.62);
  if (dark) { const g = ctx.createRadialGradient(bx + bw / 2, by - bh * 0.3, 2, bx + bw / 2, by - bh * 0.3, bw); g.addColorStop(0, 'rgba(253,224,71,0.35)'); g.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = g; ctx.fillRect(bx - bw, by - bh * 1.5, bw * 3, bh * 2); }
  // 풀밭
  const gg = ctx.createLinearGradient(0, H * 0.68, 0, H);
  gg.addColorStop(0, dark ? '#24493a' : '#86c56a'); gg.addColorStop(1, dark ? '#153024' : '#5f9e45');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(0, H * 0.72);
  for (let x = 0; x <= W + 20; x += 20) { const xx = Math.min(x, W); ctx.lineTo(xx, H * 0.7 + Math.sin(xx * 0.01) * 6); }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  // 울타리
  ctx.fillStyle = dark ? '#8a7a66' : '#f5e6c8';
  for (let x = W * 0.36; x < W; x += W * 0.07) { ctx.fillRect(x, H * 0.64, W * 0.012, H * 0.09); }
  ctx.fillRect(W * 0.36, H * 0.66, W * 0.64, H * 0.012); ctx.fillRect(W * 0.36, H * 0.695, W * 0.64, H * 0.012);
  // 꽃
  const r = seeded(4);
  for (let i = 0; i < 18; i++) {
    const x = r() * W, y = H * (0.78 + r() * 0.2);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : ['#fde047', '#f9a8d4', '#ffffff'][i % 3];
    ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  }
}

function bgPond(ctx, W, H, t, time) {
  const night = time === 'night';
  sky(ctx, W, H, night ? [[0, '#14304a'], [0.12, '#123d3a'], [1, '#0b2420']] : [[0, '#bff0e6'], [0.12, '#6fd1b4'], [0.6, '#2fa384'], [1, '#1d6b56']]);
  // 수면과 연잎
  const sy = H * 0.1;
  ctx.fillStyle = night ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)';
  ctx.fillRect(0, sy - 2, W, 3);
  [[0.15, 0.09], [0.45, 0.07], [0.8, 0.1]].forEach(([fx, fr], i) => {
    const x = W * fx + Math.sin(t * 0.4 + i) * 6, r = W * fr;
    ctx.fillStyle = night ? '#2c5e2c' : '#4fa63a';
    ctx.beginPath(); ctx.ellipse(x, sy, r, r * 0.16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = night ? 'rgba(60,120,60,0.5)' : 'rgba(60,120,50,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, sy + 4); ctx.quadraticCurveTo(x + Math.sin(t * 0.5 + i) * 12, H * 0.5, x - 10, H * 0.85); ctx.stroke();
  });
  // 연꽃
  ctx.fillStyle = '#f9a8d4';
  [[-0.6, 0.6], [0.6, 0.6], [0, 1]].forEach(([a, l]) => { ctx.save(); ctx.translate(W * 0.8 + 10, sy - 2); ctx.rotate(a * 0.6); ctx.beginPath(); ctx.ellipse(0, -H * 0.03 * l, W * 0.012, H * 0.035 * l, 0, 0, TAU); ctx.fill(); ctx.restore(); });
  // 갈대·수초
  const r = seeded(9);
  for (let i = 0; i < 12; i++) {
    const x = r() * W, h = H * (0.25 + r() * 0.35);
    ctx.strokeStyle = night ? '#2f5d3a' : ['#3f8f3a', '#5fae4a', '#2f7a3a'][i % 3]; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, H);
    ctx.quadraticCurveTo(x + Math.sin(t + i) * 14, H - h * 0.5, x + Math.sin(t * 0.8 + i) * 20, H - h); ctx.stroke();
  }
  // 바닥 진흙과 돌
  ctx.fillStyle = night ? '#2b2418' : '#6b5638';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 20) { const xx = Math.min(x, W); ctx.lineTo(xx, H * 0.9 + Math.sin(xx * 0.02) * 5); }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 9; i++) { ctx.fillStyle = night ? '#4a4438' : ['#a8a29e', '#d6d3d1', '#8a7356'][i % 3]; ctx.beginPath(); ctx.ellipse(r() * W, H * (0.93 + r() * 0.05), 10 + r() * 14, 6 + r() * 6, 0, 0, TAU); ctx.fill(); }
  if (night) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,20,50,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

// 방 (아침: 창밖 파란 하늘과 해, 밤: 달과 별, 은은한 스탠드 불빛)
function bgRoom(ctx, W, H, t, time) {
  const night = time === 'night';
  sky(ctx, W, H, night ? [[0, '#4c4377'], [1, '#2f2a52']] : [[0, '#fff3e0'], [1, '#ffe4cc']]);
  // 벽지 무늬
  ctx.fillStyle = night ? 'rgba(255,255,255,0.05)' : 'rgba(251,191,36,0.12)';
  for (let x = 20; x < W; x += 60) for (let y = 20; y < H * 0.72; y += 60) { ctx.beginPath(); ctx.arc(x + ((y / 60) % 2) * 30, y, 5, 0, TAU); ctx.fill(); }
  // 창문
  const wx = W * 0.06, wy = H * 0.1, ww = W * 0.3, wh = H * 0.36;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  if (night) { sky(ctx, W, H, [[0, '#0b1433'], [1, '#1e2a5e']]); stars(ctx, W, H, t, 30, 0.5, 21); moon(ctx, wx + ww * 0.65, wy + wh * 0.35, wh * 0.16, true, t); }
  else { ctx.fillStyle = '#93d5f5'; ctx.fillRect(wx, wy, ww, wh); sun(ctx, wx + ww * 0.68, wy + wh * 0.36, wh * 0.14, t); cloud(ctx, wx + ww * 0.25, wy + wh * 0.6, wh * 0.08, '#ffffff'); }
  ctx.restore();
  ctx.fillStyle = night ? '#cbd5e1' : '#ffffff'; ctx.fillRect(wx + ww / 2 - 4, wy, 8, wh); ctx.fillRect(wx, wy + wh / 2 - 4, ww, 8);
  // 커튼
  ctx.fillStyle = night ? '#8b7fc7' : '#fbcfe8';
  ctx.beginPath(); ctx.moveTo(wx - 20, wy - 14); ctx.quadraticCurveTo(wx + 10, wy + wh * 0.5, wx - 10, wy + wh + 18); ctx.lineTo(wx - 28, wy + wh + 18); ctx.lineTo(wx - 28, wy - 14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(wx + ww + 20, wy - 14); ctx.quadraticCurveTo(wx + ww - 10, wy + wh * 0.5, wx + ww + 10, wy + wh + 18); ctx.lineTo(wx + ww + 28, wy + wh + 18); ctx.lineTo(wx + ww + 28, wy - 14); ctx.closePath(); ctx.fill();
  // 바닥
  const fy = H * 0.74;
  ctx.fillStyle = night ? '#5b4a3a' : '#e3b98a'; ctx.fillRect(0, fy, W, H - fy);
  ctx.strokeStyle = night ? 'rgba(0,0,0,0.15)' : 'rgba(146,64,14,0.15)'; ctx.lineWidth = 2;
  for (let y = fy + 18; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // 동그란 러그
  ctx.fillStyle = night ? 'rgba(196,181,253,0.4)' : 'rgba(167,243,208,0.8)';
  ctx.beginPath(); ctx.ellipse(W * 0.45, H * 0.9, W * 0.25, H * 0.06, 0, 0, TAU); ctx.fill();
  // 벽 액자 (별)
  ctx.fillStyle = night ? '#e9d5ff' : '#fde68a'; ctx.fillRect(W * 0.55, H * 0.14, W * 0.1, H * 0.13);
  ctx.font = `${Math.round(H * 0.07)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(night ? '🌙' : '🌈', W * 0.6, H * 0.205);
  if (night) {
    // 스탠드 불빛
    const lx = W * 0.92, ly = H * 0.42;
    const g = ctx.createRadialGradient(lx, ly, 5, lx, ly, H * 0.5); g.addColorStop(0, 'rgba(253,224,71,0.35)'); g.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(lx - 26, ly); ctx.lineTo(lx + 26, ly); ctx.lineTo(lx + 16, ly - 34); ctx.lineTo(lx - 16, ly - 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8a29e'; ctx.fillRect(lx - 3, ly, 6, H * 0.3);
  }
}
function bgBathroom(ctx, W, H, t, time) {
  sky(ctx, W, H, time === 'evening' ? [[0, '#c7d7f5'], [1, '#a9bde6']] : [[0, '#e0f2fe'], [1, '#c7e7fb']]);
  // 타일
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * 0.76); ctx.stroke(); }
  for (let y = 0; y < H * 0.76; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // 거울
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(W * 0.16, H * 0.26, W * 0.1, H * 0.15, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#dbeafe'; ctx.beginPath(); ctx.ellipse(W * 0.16, H * 0.26, W * 0.085, H * 0.13, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W * 0.11, H * 0.2); ctx.lineTo(W * 0.15, H * 0.15); ctx.stroke();
  // 수건과 고무 오리
  ctx.fillStyle = '#fda4af'; ctx.fillRect(W * 0.8, H * 0.2, W * 0.08, H * 0.26);
  ctx.fillStyle = '#fecdd3'; ctx.fillRect(W * 0.8, H * 0.38, W * 0.08, H * 0.03);
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, H * 0.76, W, H * 0.24);
  ctx.fillStyle = '#d1d5db'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, H * 0.76, 2, H * 0.24);
}
function bgKitchen(ctx, W, H) {
  sky(ctx, W, H, [[0, '#fef3c7'], [1, '#fde7b0']]);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, H * 0.7);   // 줄무늬 벽지
  // 찬장
  ctx.fillStyle = '#ffffff'; ctx.fillRect(W * 0.62, H * 0.08, W * 0.3, H * 0.22);
  ctx.strokeStyle = '#e7d3b0'; ctx.lineWidth = 3; ctx.strokeRect(W * 0.62, H * 0.08, W * 0.3, H * 0.22); ctx.beginPath(); ctx.moveTo(W * 0.77, H * 0.08); ctx.lineTo(W * 0.77, H * 0.3); ctx.stroke();
  ctx.font = `${Math.round(H * 0.07)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🍎', W * 0.12, H * 0.2); ctx.fillText('🥛', W * 0.2, H * 0.2);
  ctx.fillStyle = '#d6a77a'; ctx.fillRect(0, H * 0.74, W, H * 0.26);
}
function bgYard(ctx, W, H, t) {
  sky(ctx, W, H * 0.7, [[0, '#7dd3fc'], [1, '#e0f2fe']]);
  sun(ctx, W * 0.85, H * 0.16, H * 0.07, t);
  cloud(ctx, W * 0.25, H * 0.15, H * 0.05, '#ffffff'); cloud(ctx, W * 0.55, H * 0.1, H * 0.035, '#ffffff');
  ctx.fillStyle = '#a3d977'; ctx.beginPath(); ctx.moveTo(0, H * 0.6);
  for (let x = 0; x <= W + 20; x += 20) { const xx = Math.min(x, W); ctx.lineTo(xx, H * 0.58 - Math.sin(xx * 0.008) * H * 0.05); }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7cc25a'; ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.fillStyle = '#ffffff';
  for (let x = 0; x < W; x += W * 0.06) ctx.fillRect(x, H * 0.62, W * 0.012, H * 0.1);
  ctx.fillRect(0, H * 0.64, W, H * 0.012);
}

function drawBg(ctx, W, H, t, bg) {
  const f = { sea: bgSea, farm: bgFarm, pond: bgPond, room: bgRoom, bathroom: bgBathroom, kitchen: bgKitchen, yard: bgYard }[bg.kind] || bgRoom;
  f(ctx, W, H, t, bg.time);
}

// ─────────────────────────────── 유나 ───────────────────────────────
// 원점은 발밑 가운데, S 는 키. pose 에 따라 팔과 손에 든 물건이 바뀐다
function drawYuna(ctx, pose, S, t, night) {
  const r = S * 0.2;                         // 머리 반지름
  const hy = -S + r;                         // 머리 가운데
  const skin = '#ffe0c7', hair = '#3b2a20', cheek = 'rgba(251,113,133,0.45)';
  const cloth = night ? '#c4b5fd' : '#fcd34d', clothDark = night ? '#a78bfa' : '#f59e0b';
  const breathe = Math.sin(t * 2) * S * 0.006;
  if (pose === 'sleep') {
    // 침대에 누워 자는 모습: 베개 + 이불 + 감은 눈 (아래 r 은 누운 머리 크기)
    const bw = S * 1.0, bh = S * 0.34, r = S * 0.13;   // 누우면 머리를 작게
    ctx.fillStyle = '#c08457'; ctx.fillRect(-bw * 0.55, -bh * 0.55, bw * 1.1, bh * 0.55);   // 침대 틀
    ctx.fillRect(-bw * 0.58, -bh * 1.4, bw * 0.08, bh * 1.4);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-bw * 0.36, -bh * 0.78, bw * 0.16, bh * 0.22, 0, 0, TAU); ctx.fill();   // 베개
    const hx = -bw * 0.34, hY = -bh * 0.92;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hY, r * 0.9, 0, TAU); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx - r * 0.1, hY - r * 0.15, r * 0.92, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - r * 0.95, hY + r * 0.05, r * 0.28, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineCap = 'round';
    [-0.32, 0.3].forEach(dx => { ctx.beginPath(); ctx.arc(hx + dx * r, hY + r * 0.1, r * 0.15, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); });
    ctx.fillStyle = cheek; [-0.5, 0.5].forEach(dx => { ctx.beginPath(); ctx.arc(hx + dx * r, hY + r * 0.38, r * 0.14, 0, TAU); ctx.fill(); });
    ctx.strokeStyle = '#be123c'; ctx.beginPath(); ctx.arc(hx, hY + r * 0.42, r * 0.1, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    // 이불 (숨 쉴 때마다 들썩)
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath(); ctx.moveTo(-bw * 0.2, -bh * 0.5);
    ctx.quadraticCurveTo(bw * 0.15, -bh * (1.05 + breathe / S * 8), bw * 0.52, -bh * 0.55);
    ctx.lineTo(bw * 0.55, -bh * 0.05); ctx.lineTo(-bw * 0.22, -bh * 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-bw * 0.1 + i * bw * 0.11, -bh * (0.42 + (i % 2) * 0.12), S * 0.015, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#c08457'; ctx.fillRect(bw * 0.5, -bh * 1.05, bw * 0.07, bh * 1.05);
    return;
  }
  const limb = (x0, y0, x1, y1, x2, y2, w, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const shY = -S * 0.56, shX = S * 0.13, armW = S * 0.065;
  // 다리
  if (pose !== 'bath') {
    limb(-S * 0.07, -S * 0.25, -S * 0.07, -S * 0.12, -S * 0.08, -S * 0.02, S * 0.075, night ? '#ddd6fe' : skin);
    limb(S * 0.07, -S * 0.25, S * 0.07, -S * 0.12, S * 0.08, -S * 0.02, S * 0.075, night ? '#ddd6fe' : skin);
    ctx.fillStyle = night ? '#f9a8d4' : '#ef4444';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * S * 0.09, -S * 0.015, S * 0.065, S * 0.035, 0, 0, TAU); ctx.fill(); });
  }
  // 팔 (자세별) — [어깨→팔꿈치→손] 왼팔, 오른팔
  const wave = Math.sin(t * 3);
  const arms = {
    stand: [[-shX, shY, -S * 0.22, -S * 0.42, -S * 0.24, -S * 0.3], [shX, shY, S * 0.22, -S * 0.42, S * 0.24, -S * 0.3]],
    stretch: [[-shX, shY, -S * 0.24, -S * 0.75, -S * 0.2 - wave * S * 0.02, -S * 0.95], [shX, shY, S * 0.24, -S * 0.75, S * 0.2 + wave * S * 0.02, -S * 0.95]],
    brush: [[-shX, shY, -S * 0.22, -S * 0.42, -S * 0.24, -S * 0.3], [shX, shY, S * 0.24, -S * 0.5, S * 0.06 + wave * S * 0.02, -S * 0.7]],
    eat: [[-shX, shY, -S * 0.2, -S * 0.45, -S * 0.12, -S * 0.42], [shX, shY, S * 0.22, -S * 0.5, S * 0.07, -S * 0.68 + Math.abs(wave) * S * 0.04]],
    feed: [[-shX, shY, -S * 0.22, -S * 0.42, -S * 0.24, -S * 0.3], [shX, shY, S * 0.3, -S * 0.66, S * 0.42, -S * 0.8]],
    water: [[-shX, shY, -S * 0.2, -S * 0.42, S * 0.05, -S * 0.42], [shX, shY, S * 0.25, -S * 0.46, S * 0.32, -S * 0.42]],
    kiss: [[-shX, shY, -S * 0.22, -S * 0.6, -S * 0.12, -S * 0.72], [shX, shY, S * 0.22, -S * 0.6, S * 0.12, -S * 0.72]],
    bath: [[-shX, shY, -S * 0.3, -S * 0.62, -S * 0.36, -S * 0.78 - wave * S * 0.04], [shX, shY, S * 0.3, -S * 0.62, S * 0.36, -S * 0.78 + wave * S * 0.04]]
  }[pose] || [];
  // 몸 (원피스·잠옷)
  ctx.fillStyle = pose === 'bath' ? skin : cloth;
  ctx.beginPath();
  ctx.moveTo(-S * 0.12, shY - S * 0.02 + breathe);
  ctx.quadraticCurveTo(-S * 0.2, -S * 0.32, -S * 0.21, -S * 0.22);
  ctx.lineTo(S * 0.21, -S * 0.22);
  ctx.quadraticCurveTo(S * 0.2, -S * 0.32, S * 0.12, shY - S * 0.02 + breathe);
  ctx.closePath(); ctx.fill();
  if (pose !== 'bath') {
    ctx.fillStyle = clothDark;
    if (night) { for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-S * 0.1 + (i % 3) * S * 0.1, -S * 0.45 + Math.floor(i / 3) * S * 0.12, S * 0.018, 0, TAU); ctx.fill(); } }
    else { ctx.fillRect(-S * 0.21, -S * 0.27, S * 0.42, S * 0.03); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, shY + S * 0.005, S * 0.07, S * 0.03, 0, 0, Math.PI); ctx.fill();   // 옷깃
  }
  // 팔 그리기 + 손
  arms.forEach(([x0, y0, x1, y1, x2, y2]) => { limb(x0, y0, x1, y1, x2, y2, armW, pose === 'bath' ? skin : cloth); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x2, y2, S * 0.042, 0, TAU); ctx.fill(); });
  // 머리
  ctx.fillStyle = hair;
  [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * r * 1.05, hy - r * 0.15, r * 0.3, r * 0.42, sd * 0.4, 0, TAU); ctx.fill(); });   // 양갈래
  ctx.fillStyle = '#f472b6'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * r * 0.85, hy - r * 0.45, r * 0.12, 0, TAU); ctx.fill(); });   // 머리끈
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, hy - r * 0.1, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(r * 0.3, hy - r * 0.55, -r * 0.2, hy - r * 0.45); ctx.quadraticCurveTo(-r * 0.6, hy - r * 0.5, -r * 1.0, hy - r * 0.1); ctx.fill();
  // 얼굴
  const blink = (t % 4) < 0.12;
  ctx.fillStyle = '#2b1d16'; ctx.strokeStyle = '#2b1d16'; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineCap = 'round';
  [-0.35, 0.35].forEach(dx => {
    if (blink || pose === 'kiss') { ctx.beginPath(); ctx.arc(dx * r, hy + r * 0.08, r * 0.13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(dx * r, hy + r * 0.05, r * 0.11, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(dx * r + r * 0.04, hy, r * 0.04, 0, TAU); ctx.fill(); ctx.fillStyle = '#2b1d16'; }
  });
  ctx.fillStyle = cheek; [-0.58, 0.58].forEach(dx => { ctx.beginPath(); ctx.arc(dx * r, hy + r * 0.32, r * 0.15, 0, TAU); ctx.fill(); });
  if (pose === 'kiss') { ctx.fillStyle = '#e11d48'; ctx.beginPath(); ctx.ellipse(0, hy + r * 0.45, r * 0.09, r * 0.12, 0, 0, TAU); ctx.fill(); }
  else if (pose === 'eat') { ctx.fillStyle = '#9f1239'; ctx.beginPath(); ctx.ellipse(0, hy + r * 0.45, r * 0.12, r * 0.08 + Math.abs(wave) * r * 0.05, 0, 0, TAU); ctx.fill(); }
  else { ctx.strokeStyle = '#be123c'; ctx.beginPath(); ctx.arc(0, hy + r * 0.3, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  // 손에 든 물건
  const R = arms[1];
  if (pose === 'brush' && R) {
    ctx.save(); ctx.translate(R[4], R[5]); ctx.rotate(-0.4);
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(-S * 0.015, -S * 0.02, S * 0.03, S * 0.14);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-S * 0.02, -S * 0.05, S * 0.04, S * 0.04);
    ctx.restore();
  } else if (pose === 'eat' && R) {
    ctx.save(); ctx.translate(R[4], R[5]); ctx.rotate(-0.6);
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-S * 0.01, 0, S * 0.02, S * 0.12); ctx.beginPath(); ctx.ellipse(0, -S * 0.005, S * 0.025, S * 0.018, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (pose === 'feed' && R) {
    for (let i = 0; i < 6; i++) { const q = ((t * 0.8 + i / 6) % 1); ctx.fillStyle = ['#ea580c', '#65a30d', '#ca8a04'][i % 3]; ctx.beginPath(); ctx.arc(R[4] + S * 0.06 + i * S * 0.012, R[5] + q * S * 0.3, S * 0.012, 0, TAU); ctx.fill(); }
  } else if (pose === 'water' && R) {
    // 물뿌리개
    const cx = R[4] + S * 0.05, cy = R[5] + S * 0.02;
    ctx.fillStyle = '#34d399'; ctx.beginPath(); ctx.ellipse(cx, cy, S * 0.09, S * 0.07, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#34d399'; ctx.lineWidth = S * 0.025; ctx.beginPath(); ctx.moveTo(cx + S * 0.07, cy - S * 0.01); ctx.lineTo(cx + S * 0.18, cy - S * 0.07); ctx.stroke();
    for (let i = 0; i < 6; i++) { const q = ((t * 1.2 + i / 6) % 1); ctx.fillStyle = 'rgba(56,189,248,0.85)'; ctx.beginPath(); ctx.ellipse(cx + S * (0.19 + i * 0.01), cy - S * 0.06 + q * S * 0.32, S * 0.008, S * 0.016, 0, 0, TAU); ctx.fill(); }
  }
}

// ─────────────────────────────── 소품 ───────────────────────────────
const BACK_PROPS = new Set(['moon', 'sun', 'cave', 'bed', 'tank', 'sink', 'garden', 'eggs', 'teddy']);
function drawProp(ctx, p, W, H, t, actorsAt) {
  const m = Math.min(W, H), x = (p.x ?? 0.5) * W, y = (p.y ?? 0.5) * H, s = (p.s ?? 0.2) * m;
  const emoji = (ch, ex, ey, size, alpha = 1) => {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, ex, ey); ctx.restore();
  };
  switch (p.t) {
    case 'moon': moon(ctx, x, y, s * 0.5, p.face, t); break;
    case 'sun': sun(ctx, x, y, s * 0.5, t); break;
    case 'zzz': for (let i = 0; i < 3; i++) {
      const q = (t * 0.35 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = 1 - q; ctx.fillStyle = '#fef9c3'; ctx.strokeStyle = 'rgba(30,27,75,0.5)'; ctx.lineWidth = 3;
      ctx.font = `${Math.round(m * (0.045 + i * 0.015))}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const zx = x + q * m * 0.06 + i * m * 0.035, zy = y - q * m * 0.12 - i * m * 0.04;
      ctx.strokeText('Z', zx, zy); ctx.fillText('Z', zx, zy); ctx.restore();
    } break;
    case 'hearts': for (let i = 0; i < 5; i++) { const q = (t * 0.3 + i / 5) % 1; emoji('💗', x + Math.sin(t * 2 + i * 2) * m * 0.06, y - q * m * 0.2, m * (0.05 + (i % 2) * 0.02), 1 - q * 0.8); } break;
    case 'notes': for (let i = 0; i < 4; i++) { const q = (t * 0.3 + i / 4) % 1; emoji(i % 2 ? '🎵' : '🎶', x + q * m * 0.3, y + Math.sin(t * 2 + i) * m * 0.03, m * 0.06, 1 - q * 0.7); } break;
    case 'sparkle': for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t, d = m * (0.22 + Math.sin(t * 3 + i) * 0.03); emoji('✨', x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, m * 0.05); } break;
    case 'bubbles': {
      const n = p.small ? 6 : 14;
      for (let i = 0; i < n; i++) {
        const q = (t * 0.25 + i / n) % 1, bx = x + Math.sin(i * 2.3 + t) * m * (p.small ? 0.05 : 0.22), by = y - q * m * (p.small ? 0.1 : 0.3), br = m * (p.small ? 0.012 : 0.02 + (i % 3) * 0.012);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.25, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'flakes': for (let i = 0; i < 10; i++) { const q = (t * 0.25 + i / 10) % 1; ctx.fillStyle = ['#ea580c', '#65a30d', '#ca8a04'][i % 3]; ctx.beginPath(); ctx.arc(x + Math.sin(i * 1.7) * m * 0.12 + Math.sin(t + i) * 5, y + q * m * 0.35, m * 0.008, 0, TAU); ctx.fill(); } break;
    case 'fireflies': for (let i = 0; i < 12; i++) {
      const fx = W * (0.1 + (i * 0.37) % 0.85) + Math.sin(t * 0.7 + i) * 20, fy = H * (0.2 + (i * 0.23) % 0.5) + Math.cos(t * 0.9 + i) * 14, a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14); g.addColorStop(0, `rgba(253,250,170,${a})`); g.addColorStop(1, 'rgba(253,250,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 14, 0, TAU); ctx.fill();
    } break;
    case 'jelly': (actorsAt || []).forEach(([jx, jy, js]) => {
      const g = ctx.createRadialGradient(jx, jy, 0, jx, jy, js * 1.4); g.addColorStop(0, `rgba(216,180,254,${0.45 + 0.2 * Math.sin(t * 2 + jx)})`); g.addColorStop(1, 'rgba(216,180,254,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(jx, jy, js * 1.4, 0, TAU); ctx.fill();
    }); break;
    case 'cave': {
      // 아늑한 바위 동굴 (안쪽은 은은하게 밝다)
      ctx.fillStyle = '#4b4f6b';
      ctx.beginPath(); ctx.moveTo(x - s * 0.75, y); ctx.quadraticCurveTo(x - s * 0.7, y - s * 0.95, x, y - s * 0.9); ctx.quadraticCurveTo(x + s * 0.75, y - s * 0.9, x + s * 0.8, y); ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(x, y - s * 0.2, 2, x, y - s * 0.2, s * 0.5); g.addColorStop(0, 'rgba(147,197,253,0.55)'); g.addColorStop(1, 'rgba(30,27,75,0.95)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, s * 0.45, s * 0.55, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#5c6283'; [[-0.6, -0.4, 0.14], [0.55, -0.55, 0.12], [-0.2, -0.8, 0.1]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, rr * s, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#2f9e6e'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x - s * 0.4 + i * s * 0.2, y - s * 0.05, s * 0.06, s * 0.12, Math.sin(t + i) * 0.3, 0, TAU); ctx.fill(); }
      break;
    }
    case 'bed': {
      ctx.fillStyle = '#c08457'; ctx.fillRect(x - s * 0.5, y - s * 0.42, s, s * 0.3); ctx.fillRect(x + s * 0.42, y - s * 0.8, s * 0.1, s * 0.8); ctx.fillRect(x - s * 0.52, y - s * 0.6, s * 0.08, s * 0.6);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + s * 0.28, y - s * 0.5, s * 0.14, s * 0.07, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f9a8d4'; ctx.fillRect(x - s * 0.45, y - s * 0.52, s * 0.62, s * 0.14);
      break;
    }
    case 'teddy': emoji('🧸', x, y, s * 1.2); break;
    case 'eggs': {
      // 투명한 개구리알 덩어리 (안에 까만 점)
      const r = seeded(13);
      for (let i = 0; i < (p.hatched ? 10 : 22); i++) {
        const ex = x + (r() - 0.5) * s * 1.2, ey = y + (r() - 0.5) * s * 0.7 + Math.sin(t + i) * 2, er = s * 0.07;
        ctx.fillStyle = 'rgba(220,252,231,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill(); ctx.stroke();
        if (!p.hatched) { ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(ex + Math.sin(t * 2 + i) * er * 0.1, ey, er * 0.32, 0, TAU); ctx.fill(); }
      }
      break;
    }
    case 'tank': {
      // 작은 어항 (안에 물고기 두 마리가 헤엄)
      const w = s * 1.1, h = s * 0.75;
      ctx.fillStyle = '#a16207'; ctx.fillRect(x - w * 0.6, y + h * 0.5, w * 1.2, h * 0.12); ctx.fillRect(x - w * 0.5, y + h * 0.62, w * 0.08, h * 0.6); ctx.fillRect(x + w * 0.42, y + h * 0.62, w * 0.08, h * 0.6);
      const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, '#bae6fd'); g.addColorStop(1, '#38bdf8');
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = '#e9d5a1'; ctx.fillRect(x - w / 2, y + h * 0.36, w, h * 0.14);
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.clip();
      [['clownfish', 0], ['neon', 1.7], ['guppy', 3.1]].forEach(([id, ph]) => {
        const sp = FISH_BY_ID[id]; if (!sp) return;
        const fx = x + Math.sin(t * 0.6 + ph) * w * 0.32, fy = y + Math.sin(t * 0.9 + ph * 2) * h * 0.18, dir = Math.cos(t * 0.6 + ph) > 0 ? 1 : -1;
        ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1);
        drawFish(ctx, lookOf(sp, { sp: id, variant: id === 'guppy' ? 'rainbow' : undefined }), w * 0.2, { phase: t * 5 + ph, growth: 1, detail: true, happy: true });
        ctx.restore();
      });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w / 2 + 6, y - h / 2 + 6, w * 0.06, h * 0.7);
      break;
    }
    case 'sink': {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + s * 0.0, y - s * 0.62, s * 0.5, s * 0.12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - s * 0.08, y - s * 0.6, s * 0.16, s * 0.6);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x - s * 0.04, y - s * 0.86, s * 0.08, s * 0.16); ctx.fillRect(x - s * 0.04, y - s * 0.86, s * 0.18, s * 0.05);
      break;
    }
    case 'table': {
      ctx.fillStyle = '#b07a4f'; ctx.fillRect(x - s * 0.55, y - s * 0.42, s * 1.1, s * 0.07);
      ctx.fillRect(x - s * 0.5, y - s * 0.36, s * 0.05, s * 0.36); ctx.fillRect(x + s * 0.45, y - s * 0.36, s * 0.05, s * 0.36);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + s * 0.12, y - s * 0.46, s * 0.12, s * 0.04, 0, 0, TAU); ctx.fill();
      emoji('🍚', x + s * 0.12, y - s * 0.5, s * 0.14); emoji('🥕', x + s * 0.34, y - s * 0.48, s * 0.1); emoji('🥛', x - s * 0.25, y - s * 0.5, s * 0.12);
      break;
    }
    case 'tub': {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.42); ctx.lineTo(x + s * 0.55, y - s * 0.42); ctx.quadraticCurveTo(x + s * 0.55, y, x + s * 0.3, y); ctx.lineTo(x - s * 0.3, y); ctx.quadraticCurveTo(x - s * 0.55, y, x - s * 0.55, y - s * 0.42); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3; ctx.stroke();
      // 거품 띠 + 고무 오리
      for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(x - s * 0.5 + i * s * 0.09, y - s * 0.43 + Math.sin(t * 2 + i) * 3, s * 0.06, 0, TAU); ctx.fill(); }
      emoji('🐤', x + s * 0.38, y - s * 0.52 + Math.sin(t * 2) * 4, s * 0.16);
      break;
    }
    case 'garden': {
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x - s * 0.6, y - s * 0.18, s * 1.2, s * 0.18);
      ['🌱', '🥕', '🌱', '🥬'].forEach((ch, i) => emoji(ch, x - s * 0.45 + i * s * 0.3, y - s * 0.26 + Math.sin(t * 2 + i) * 2, s * 0.22));
      break;
    }
    default: break;
  }
}

// ─────────────────────────────── 장면 ───────────────────────────────
// 등장인물의 지금 위치 (헤엄·통통 반응 포함)
function actorPose(a, i, W, H, t, tap) {
  const m = Math.min(W, H);
  let x = a.x * W, y = a.y * H;
  if (a.swim) { x += Math.sin(t * 0.5 + i * 1.7) * W * 0.03; y += Math.sin(t * 1.1 + i) * H * 0.02; }
  if (a.loop) { x += Math.cos(t * 0.8) * W * 0.08; y += Math.sin(t * 0.8) * H * 0.08; }
  let dir = a.dir || 1;
  if (a.loop) dir = -Math.sin(t * 0.8) >= 0 ? 1 : -1;
  const since = tap && tap.i === i ? t - tap.t0 : 9;
  const hop = since < 0.7 ? -Math.abs(Math.sin(since * 9)) * m * 0.05 * (1 - since / 0.7) : 0;
  return { x, y: y + hop, dir, size: a.s * m, tapped: since < 1.2 };
}

function drawScene(ctx, W, H, t, page, tap) {
  drawBg(ctx, W, H, t, page.bg || { kind: 'room', time: 'day' });
  const actors = page.actors || [];
  const props = page.props || [];
  const poses = actors.map((a, i) => actorPose(a, i, W, H, t, tap));
  const jellyAt = actors.map((a, i) => (a.sp === 'jellyfish' ? [poses[i].x, poses[i].y, poses[i].size * 1.2] : null)).filter(Boolean);
  props.filter(p => BACK_PROPS.has(p.t) || p.t === 'jelly').forEach(p => drawProp(ctx, p, W, H, t, jellyAt));
  actors.forEach((a, i) => {
    const P = poses[i];
    ctx.save(); ctx.translate(P.x, P.y);
    if (a.t === 'fish') {
      const sp = FISH_BY_ID[a.sp]; if (sp) {
        ctx.scale(P.dir, 1);
        const L = P.size * 1.5;
        drawFish(ctx, lookOf(sp, { sp: a.sp }), L, { phase: a.sleep ? t * 0.8 + i : t * 4 + i, growth: a.g ?? 1, sleep: !!a.sleep, happy: a.happy || P.tapped, detail: true, gloss: true, lit: 0.6 });
      }
    } else if (a.t === 'animal') {
      const sp = FARM_BY_ID[a.sp]; if (sp) {
        ctx.scale(P.dir, 1);
        const S = P.size * 1.25;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.5, S * 0.1, 0, 0, TAU); ctx.fill();
        drawAnimal(ctx, sp, S, { phase: t * 2 + i, moving: 0, growth: a.g ?? 1, sleep: !!a.sleep, lie: a.lie || 0, t, wag: P.tapped, blink: (t + i) % 4 < 0.12 });
      }
    } else if (a.t === 'yuna') {
      drawYuna(ctx, a.pose, P.size * 1.1, t, a.night);
    }
    ctx.restore();
    if (P.tapped) drawProp(ctx, { t: 'hearts', x: P.x / W, y: (P.y - P.size * 0.6) / H }, W, H, t * 2);
  });
  props.filter(p => !BACK_PROPS.has(p.t) && p.t !== 'jelly').forEach(p => drawProp(ctx, p, W, H, t, jellyAt));
  return poses;
}

// 책 표지 미리보기 (작은 캔버스에 첫 장면을 한 번 그린다)
function Cover({ story }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return undefined;
    let raf = 0, t0 = performance.now();
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cv = story.cover;
      const page = { bg: { kind: cv.bg, time: cv.time }, actors: [], props: [] };
      if (cv.fish) page.actors.push({ t: 'fish', sp: cv.fish, x: 0.5, y: 0.5, s: 0.42, swim: true });
      if (cv.animal) page.actors.push({ t: 'animal', sp: cv.animal, x: 0.5, y: 0.9, s: 0.5 });
      if (cv.yuna) page.actors.push({ t: 'yuna', pose: cv.yuna, x: 0.5, y: 0.92, s: 0.72 });
      if (cv.time === 'night' && cv.bg !== 'room') page.props.push({ t: 'moon', x: 0.82, y: 0.18, s: 0.2, face: true });
      drawScene(ctx, W, H, (performance.now() - t0) / 1000, page, null);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [story]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─────────────────────────────── 화면 ───────────────────────────────
// 이야기가 끝난 뒤 '잘 자요' 장면
const SLEEP_SCENE = { bg: { kind: 'room', time: 'night' }, actors: [{ t: 'yuna', pose: 'sleep', x: 0.55, y: 0.86, s: 0.7, night: true }], props: [{ t: 'zzz', x: 0.5, y: 0.45 }, { t: 'teddy', x: 0.28, y: 0.72, s: 0.12 }] };
export default function StoryBook({ audio, playLine, stopLine, lullabyUrl }) {
  const [settings, setSettings] = useState(loadSettings);
  const [view, setView] = useState('shelf');          // 'shelf' 책장 | 'read' 읽기 | 'end' 잘 자요 | 'limit' 오늘은 끝
  const [storyIdx, setStoryIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [auto, setAuto] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lullabyLeft, setLullabyLeft] = useState(0);   // 자장가 남은 초
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const tapRef = useRef(null);
  const posesRef = useRef([]);
  const timersRef = useRef([]);
  const lullabyRef = useRef(null);
  const swipeRef = useRef(null);
  const tRef = useRef(0);                // 그림 루프의 지금 시각(초)
  const autoRef = useRef(true);
  const [night] = useState(isNightTime);   // 그림책을 연 시각 기준 (저녁 8시 ~ 아침 7시는 밤 화면)
  const story = STORIES[storyIdx];

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const after = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id; };
  const updateSettings = (patch) => setSettings(s => { const n = { ...s, ...patch }; saveSettings(n); return n; });

  const stopLullaby = () => {
    const a = lullabyRef.current; lullabyRef.current = null;
    if (a) { a.pause(); a.src = ''; }
    setLullabyLeft(0);
  };
  const startLullaby = (minutes) => {
    stopLullaby();
    if (!minutes || !lullabyUrl) return;
    try {
      const a = new Audio(lullabyUrl); a.loop = true; a.volume = 0.35;
      a.muted = !!audio.muted;
      a.play().catch(() => { });
      lullabyRef.current = a;
      const end = Date.now() + minutes * 60000;
      setLullabyLeft(minutes * 60);
      const tick = () => {
        if (lullabyRef.current !== a) return;
        const left = Math.max(0, (end - Date.now()) / 1000);
        setLullabyLeft(Math.ceil(left));
        if (left < 15) a.volume = 0.35 * (left / 15);   // 끝날 때는 천천히 작아진다
        if (left <= 0) { stopLullaby(); return; }
        after(tick, 1000);
      };
      after(tick, 1000);
    } catch { /* 무시 */ }
  };

  const goEnd = () => {
    clearTimers(); stopLine(); setSpeaking(false);
    setView('end');
    after(() => playLine(STORY_END_LINE), 500);
    startLullaby(settings.timer);
  };

  // 화면을 떠나면 소리·타이머 정리
  useEffect(() => () => { clearTimers(); stopLullaby(); stopLine(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // 책장 인사
  useEffect(() => { if (view === 'shelf') { const id = setTimeout(() => playLine(STORY_SHELF_LINE), 300); return () => clearTimeout(id); } return undefined; }, [view]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 쪽이 바뀌면 그 쪽을 읽는다 → 다 읽으면(자동 넘김이면) 다음 쪽
  useEffect(() => {
    if (view !== 'read') return undefined;
    clearTimers();
    const pg = story.pages[page];
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      setSpeaking(false);
      if (!autoRef.current) return;
      after(() => {
        if (page + 1 < story.pages.length) setPage(page + 1);
        else goEnd();
      }, 1800);
    };
    tapRef.current = null;
    setSpeaking(true);
    after(() => playLine(pg.text, finish), 450);
    // 소리를 못 내는 상황(음소거·오류)에도 넘어가도록 넉넉한 안전 타이머
    after(finish, 1500 + pg.text.length * 230);
    return () => { done = true; };
  }, [view, storyIdx, page]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 지금 그릴 장면 (그림 루프가 매 프레임 이 값을 읽는다)
  useEffect(() => {
    if (view === 'read') sceneRef.current = STORIES[storyIdx].pages[page];
    else if (view === 'end' || view === 'limit') sceneRef.current = SLEEP_SCENE;
  }, [view, storyIdx, page]);

  // 그림 그리기 루프
  useEffect(() => {
    if (view === 'shelf') return undefined;
    const c = canvasRef.current; if (!c) return undefined;
    let raf = 0; const t0 = performance.now();
    const loop = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = c.clientWidth, H = c.clientHeight;
      if (W > 0 && H > 0) {
        if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
        const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = (performance.now() - t0) / 1000;
        tRef.current = t;
        const pg = sceneRef.current;
        if (pg) posesRef.current = drawScene(ctx, W, H, t, pg, tapRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [view]);


  const openStory = (i) => {
    audio.playFreq(520, 'sine', 0.15);
    stopLullaby();
    const nk = nightKey();
    const count = settings.night === nk ? settings.count : 0;
    if (settings.limit && count >= settings.limit) {
      setView('limit'); stopLine(); clearTimers();
      after(() => playLine(STORY_LIMIT_LINE), 400);
      startLullaby(settings.timer);
      return;
    }
    updateSettings({ night: nk, count: count + 1, last: STORIES[i].id });
    setStoryIdx(i); setPage(0); setAuto(true); autoRef.current = true; setView('read');
  };
  const goPage = (d) => {
    const n = page + d;
    if (n < 0) return;
    stopLine(); clearTimers();
    audio.playFreq(d > 0 ? 660 : 440, 'sine', 0.1, 0.25);
    if (n >= story.pages.length) { goEnd(); return; }
    setPage(n);
  };
  const backToShelf = () => { clearTimers(); stopLine(); stopLullaby(); setSpeaking(false); setView('shelf'); };

  // 그림 속 친구 누르기 → 통통 + 하트 + 소리 / 옆으로 쓸면 쪽 넘기기
  const onCanvasDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    swipeRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const pg = sceneRef.current; if (!pg || !pg.actors) return;
    let best = -1, bd = 1e9;
    posesRef.current.forEach((P, i) => {
      const a = pg.actors[i]; const cy = a.t === 'fish' ? P.y : P.y - P.size * 0.5;
      const d = Math.hypot(px - P.x, py - cy);
      if (d < P.size * 0.9 && d < bd) { bd = d; best = i; }
    });
    if (best >= 0) {
      const a = pg.actors[best];
      tapRef.current = { i: best, t0: tRef.current };
      if (a.t === 'animal' && FARM_BY_ID[a.sp] && FARM_BY_ID[a.sp].sound) audio.playItemSound({ id: FARM_BY_ID[a.sp].sound });
      else if (a.t === 'fish') audio.playBubble();
      else audio.playPopSound();
    }
  };
  const onCanvasUp = (e) => {
    const s = swipeRef.current; swipeRef.current = null;
    if (!s || view !== 'read') return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.at < 800) goPage(dx < 0 ? 1 : -1);
  };

  const shelfBg = night
    ? 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.08) 0, rgba(255,255,255,0) 30%), linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)'
    : 'linear-gradient(180deg, #f5f3ff 0%, #fdf2f8 100%)';
  const bigBtn = (extra = {}) => ({
    border: 'none', borderRadius: '50%', width: '72px', height: '72px', cursor: 'pointer', touchAction: 'manipulation',
    background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 20px -8px rgba(30,27,75,0.5)', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', ...extra
  });

  // ── 책장 ──
  if (view === 'shelf') {
    const settingsChip = (label, on, onClick) => (
      <button key={label} onClick={onClick} style={{ border: 'none', borderRadius: '14px', padding: '6px 12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', background: on ? '#7c3aed' : '#ede9fe', color: on ? '#ffffff' : '#5b21b6' }}>{label}</button>
    );
    return (
      <div style={{ flex: 1, minHeight: 0, borderRadius: '28px', background: shelfBg, padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
        {night && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(2px 2px at 10% 20%, #fff, transparent), radial-gradient(2px 2px at 30% 70%, #fff, transparent), radial-gradient(1.5px 1.5px at 60% 30%, #fff, transparent), radial-gradient(2px 2px at 85% 15%, #fff, transparent), radial-gradient(1.5px 1.5px at 75% 80%, #fff, transparent), radial-gradient(1.5px 1.5px at 45% 50%, #fff, transparent)', opacity: 0.7 }} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <h2 style={{ margin: 0, fontFamily: JUA, fontWeight: 400, fontSize: '2rem', color: night ? '#fef9c3' : '#4c1d95' }}>🌙 잠자리 그림책</h2>
          <button onClick={() => setShowSettings(v => !v)} title="부모 설정" style={{ border: 'none', borderRadius: '16px', padding: '6px 12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', background: night ? 'rgba(255,255,255,0.15)' : '#ede9fe', color: night ? '#e0e7ff' : '#5b21b6' }}>⚙︎ 부모 설정</button>
        </div>
        {showSettings && (
          <div style={{ position: 'relative', background: '#ffffff', borderRadius: '20px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 10px 24px -12px rgba(30,27,75,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <b style={{ fontSize: '0.88rem', color: '#4c1d95', minWidth: '120px' }}>🎵 다 읽고 자장가</b>
              {[[0, '끄기'], [3, '3분'], [5, '5분'], [10, '10분']].map(([v, l]) => settingsChip(l, settings.timer === v, () => updateSettings({ timer: v })))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <b style={{ fontSize: '0.88rem', color: '#4c1d95', minWidth: '120px' }}>📚 하룻밤 이야기</b>
              {[[1, '1편'], [2, '2편'], [3, '3편'], [0, '제한 없음']].map(([v, l]) => settingsChip(l, settings.limit === v, () => updateSettings({ limit: v })))}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#7c6f8a' }}>하룻밤 수를 다 읽으면 "이제 코 자요" 화면에서 멈춰요. (낮 12시가 지나면 다시 셀게요)</span>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem', position: 'relative', alignContent: 'center' }}>
          {STORIES.map((s, i) => (
            <button key={s.id} onClick={() => openStory(i)} style={{
              border: 'none', borderRadius: '28px', padding: 0, cursor: 'pointer', overflow: 'hidden', background: s.color, touchAction: 'manipulation',
              boxShadow: `0 16px 30px -18px ${s.ink}`, display: 'flex', flexDirection: 'column', minHeight: '240px'
            }}>
              <div style={{ flex: 1, minHeight: '170px', position: 'relative' }}><Cover story={s} /></div>
              <div style={{ padding: '12px 10px 14px', fontFamily: JUA, fontSize: '1.3rem', color: s.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {settings.last === s.id && <span title="지난번에 읽은 책" style={{ fontSize: '1rem' }}>🔖</span>}{s.title}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 읽기 / 잘 자요 ──
  const pg = view === 'read' ? story.pages[page] : null;
  const dark = view !== 'read';
  const mins = Math.floor(lullabyLeft / 60), secs = lullabyLeft % 60;
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem', borderRadius: '28px', padding: '0.8rem', background: dark || night ? '#1e1b4b' : '#f5f3ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button onClick={backToShelf} style={{ border: 'none', borderRadius: '22px', padding: '0 18px', height: '48px', cursor: 'pointer', fontFamily: JUA, fontSize: '1.05rem', background: dark || night ? 'rgba(255,255,255,0.15)' : '#ede9fe', color: dark || night ? '#e0e7ff' : '#4c1d95' }}>📚 책장</button>
        <div style={{ flex: 1, fontFamily: JUA, fontSize: '1.3rem', color: dark || night ? '#fef9c3' : story.ink, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {view === 'read' ? story.title : '잘 자요 🌙'}
        </div>
        {view === 'read' && (
          <button onClick={() => {
            const on = !autoRef.current; autoRef.current = on; setAuto(on);
            // 다 읽고 멈춰 있을 때 켜면 바로 다음 쪽으로
            if (on && !speaking) after(() => goPage(1), 600);
          }} title="저절로 넘기기" style={{ border: 'none', borderRadius: '22px', padding: '0 16px', height: '48px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', background: auto ? '#a78bfa' : (night ? 'rgba(255,255,255,0.15)' : '#ede9fe'), color: auto ? '#ffffff' : (night ? '#e0e7ff' : '#5b21b6') }}>
            {auto ? '▶︎ 저절로 넘기기' : '⏸ 손으로 넘기기'}
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 16px 34px -18px rgba(30,27,75,0.6)' }}>
        <canvas ref={canvasRef} onPointerDown={onCanvasDown} onPointerUp={onCanvasUp} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'pointer' }} />
        {view === 'read' && (
          <>
            <button aria-label="앞 쪽" onClick={() => goPage(-1)} disabled={page === 0} style={bigBtn({ position: 'absolute', left: '12px', top: '50%', marginTop: '-36px', opacity: page === 0 ? 0.35 : 1 })}>◀</button>
            <button aria-label="다음 쪽" onClick={() => goPage(1)} style={bigBtn({ position: 'absolute', right: '12px', top: '50%', marginTop: '-36px' })}>▶</button>
          </>
        )}
        {dark && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,10,45,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '6%', gap: '12px', pointerEvents: 'none' }}>
            <div style={{ fontFamily: JUA, fontSize: '2.6rem', color: '#fef9c3', textShadow: '0 4px 18px rgba(0,0,0,0.5)' }}>{view === 'limit' ? '이제 코 자요 🌙' : '잘 자요, 좋은 꿈 꿔요 🌙'}</div>
          </div>
        )}
      </div>

      {view === 'read' ? (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            flex: 1, borderRadius: '22px', padding: '14px 20px', fontFamily: JUA, fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)', lineHeight: 1.45,
            background: night ? 'rgba(255,255,255,0.08)' : '#ffffff', color: night ? '#f5f3ff' : '#3f3a52', minHeight: '3.2em', display: 'flex', alignItems: 'center'
          }}>
            <span style={{ backgroundImage: speaking ? 'linear-gradient(transparent 58%, rgba(253,224,71,0.75) 58%)' : 'none', transition: 'background-image 0.3s' }}>{pg.text}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {story.pages.map((_, i) => <span key={i} style={{ width: i === page ? '22px' : '10px', height: '10px', borderRadius: '6px', background: i === page ? '#a78bfa' : (night ? 'rgba(255,255,255,0.25)' : '#ddd6fe'), transition: 'width 0.2s' }} />)}
          </div>
        </div>
      ) : (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {lullabyLeft > 0
            ? <button onClick={stopLullaby} style={{ border: 'none', borderRadius: '24px', padding: '0 22px', height: '56px', cursor: 'pointer', fontFamily: JUA, fontSize: '1.1rem', background: 'rgba(255,255,255,0.15)', color: '#e0e7ff' }}>🎵 자장가 끄기 ({mins}:{String(secs).padStart(2, '0')})</button>
            : <button onClick={() => startLullaby(settings.timer || 5)} style={{ border: 'none', borderRadius: '24px', padding: '0 22px', height: '56px', cursor: 'pointer', fontFamily: JUA, fontSize: '1.1rem', background: 'rgba(255,255,255,0.15)', color: '#e0e7ff' }}>🎵 자장가 듣기</button>}
          <button onClick={backToShelf} style={{ border: 'none', borderRadius: '24px', padding: '0 22px', height: '56px', cursor: 'pointer', fontFamily: JUA, fontSize: '1.1rem', background: '#a78bfa', color: '#ffffff' }}>📚 다른 이야기</button>
        </div>
      )}
    </div>
  );
}
