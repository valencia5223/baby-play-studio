// ═════════════════════════════════════════════════════════════════════════════
// 🏥 병원 놀이: 아기·어린이·동물 친구가 아파서 찾아오면 의사 선생님이 되어 치료해 준다
//  - 순서: 청진기(가슴 세 곳 콩닥콩닥) → 귀 체온계(삐빅, 열이면 → 이마에 열 시트) → 손전등으로 목 보기('아~', 돋보기로 목 속) → 콧물 빼기(흡입기 다이얼로 켜면 모터 소리 → 노즐을 콧구멍 왼쪽·오른쪽에, 쭈루룩 소리) → 약 바르기(쓱쓱) → 밴드 붙이기 → 잘 참았다고 양갈래 사탕을 손에 쥐여 주기
//    콧물·상처는 환자마다 다르게(sym) 정해서, 필요한 것만 한다. 실패는 없다
//  - 캔버스 한 장: 진료실 + 침대에 앉은 환자 + 아래 도구 칸. 도구는 끌어서 쓴다(손가락보다 조금 위가 도구 끝)
//  - 동물 그림은 요리 놀이 손님(GUEST_FN)을 빌려 쓰고, 아기·어린이는 drawKid 로 같은 방식(앞을 보고 앉음)으로 그린다
//  - 음성은 남성 아나운서 MP3 (VOICE.hosp*, npm run voices)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { GUEST_FN } from './KitchenGame.jsx';
import { friendlyEyes, smileMouth } from './BirthdayParty.jsx';
import { HOSPITAL_PATIENTS, HOSPITAL_SYMPTOMS, HOSPITAL_TEMPS } from './hospitalData.js';
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rg = (c, x0, y0, r0, x1, y1, r1, stops) => { const g = c.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.01, r1)); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const shadowOn = (c, blur, oy = 0, col = 'rgba(20,40,40,0.25)') => { c.shadowColor = col; c.shadowBlur = blur; c.shadowOffsetX = 0; c.shadowOffsetY = oy; };
const shadowOff = (c) => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };

const TOOL_IDS = ['steth', 'temp', 'sheet', 'throat', 'nose', 'cream', 'band', 'candy'];
const TOOL_NAME = { steth: '청진기', temp: '체온계', sheet: '열 시트', throat: '손전등', nose: '콧물 빼기', cream: '연고', band: '밴드', candy: '사탕' };
const TOOL_EMOJI = { steth: '🩺', temp: '🌡️', sheet: '🧊', throat: '🔦', nose: '👃', cream: '🧴', band: '🩹', candy: '🍬' };
const HINT = {
  steth: '🩺 청진기를 가슴 동그라미에 콕콕 대 보세요',
  temp: '🌡️ 체온계를 귀에 살짝 대요',
  sheet: '🧊 열 시트를 이마에 붙여요',
  throat: '🔦 손전등을 입에 비춰요',
  nosePower: '👃 콧물 기계의 버튼을 눌러 켜요',
  nose: '👃 노즐을 잡고 콧구멍에 쏙 넣어요',
  cream: '🧴 아야 한 곳에 약을 쓱쓱 발라요',
  band: '🩹 밴드를 아야 한 곳에 붙여요',
  candy: '🍬 잘 참았어요! 사탕을 손에 쥐여 줘요'
};
// 청진기를 댈 가슴 세 곳 (S 배, 앉은 바닥이 0)
const STETH_SPOTS = [[-0.1, -0.47], [0.11, -0.42], [0, -0.3]];
const NOSE_SEC = 1.5;
const TEMP_SEC = 1.3;     // 귀에 대고 있으면 삐빅 할 때까지
const THROAT_SEC = 1.8;   // 입에 비추고 목을 보는 시간   // 콧구멍 한쪽 콧물을 다 빼는 데 걸리는 시간

// ─────────────────────────── 아기·어린이 (앞을 보고 앉음, 바닥 가운데가 0) ───────────────────────────
// id: baby · girl · boy · yuna(요리 놀이 손님 유나: 양갈래 + 노란 옷 + 분홍 머리끈)
export function drawKid(ctx, S, t, happy, mouth, id) {
  const baby = id === 'baby', yuna = id === 'yuna', girl = id === 'girl' || yuna;
  const SK = '#ffe2cc', SKD = '#f3c19c', LINE = 'rgba(170,100,70,0.45)';
  const top = baby ? '#a5d8ff' : yuna ? '#ffe066' : girl ? '#ffafcc' : '#8cc8ff';
  const topD = baby ? '#74c0fc' : yuna ? '#fab005' : girl ? '#f783ac' : '#4dabf7';
  const hair = baby ? '#b07a45' : yuna ? '#3b2a20' : girl ? '#6b3f26' : '#3b2a20';
  const o = (x, y, rx, ry, rot = 0) => ell(ctx, x * S, y * S, rx * S, ry * S, rot);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x * S, y * S, w * S, h * S, r * S); };
  const br = 1 + Math.sin(t * 2) * 0.012;
  ctx.save();
  ctx.lineWidth = Math.max(1.5, S * 0.01); ctx.strokeStyle = LINE; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 다리 (앉아서 앞으로 내민 무릎 아래) + 양말 + 신발
  [-1, 1].forEach(k => {
    ctx.fillStyle = lg(ctx, 0, -0.27 * S, 0, 0, [[0, SK], [1, SKD]]);
    rr(k * 0.12 - 0.065, -0.28, 0.13, 0.26, 0.06); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; rr(k * 0.12 - 0.068, -0.075, 0.136, 0.05, 0.02); ctx.fill();
    ctx.fillStyle = baby ? '#ffd43b' : girl ? '#e64980' : '#1c7ed6'; o(k * 0.13, -0.018, 0.1, 0.052); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; o(k * 0.13 - 0.03, -0.035, 0.035, 0.014); ctx.fill();
  });
  // 옷
  if (girl) {
    ctx.fillStyle = lg(ctx, 0, -0.64 * S, 0, -0.18 * S, [[0, top], [1, topD]]);
    ctx.beginPath(); ctx.moveTo(-0.19 * S, -0.64 * S); ctx.lineTo(0.19 * S, -0.64 * S);
    ctx.quadraticCurveTo(0.25 * S, -0.48 * S, 0.35 * S * br, -0.22 * S);
    ctx.quadraticCurveTo(0, -0.15 * S, -0.35 * S * br, -0.22 * S);
    ctx.quadraticCurveTo(-0.25 * S, -0.48 * S, -0.19 * S, -0.64 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    [[-0.14, -0.45], [0.1, -0.5], [0.02, -0.36], [-0.2, -0.3], [0.2, -0.3], [-0.05, -0.25], [0.16, -0.4]].forEach(([x, y]) => { o(x, y, 0.018, 0.018); ctx.fill(); });
    ctx.fillStyle = '#ffffff'; [-1, 1].forEach(k => { o(k * 0.06, -0.62, 0.07, 0.035, k * 0.3); ctx.fill(); });
  } else if (baby) {
    ctx.fillStyle = lg(ctx, 0, -0.65 * S, 0, -0.15 * S, [[0, top], [1, topD]]);
    o(0, -0.4, 0.28 * br, 0.26); ctx.fill(); ctx.stroke();
    // 턱받이
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-0.13 * S, -0.62 * S); ctx.quadraticCurveTo(-0.15 * S, -0.44 * S, 0, -0.42 * S); ctx.quadraticCurveTo(0.15 * S, -0.44 * S, 0.13 * S, -0.62 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd43b'; o(0, -0.51, 0.035, 0.035); ctx.fill();
    ctx.fillStyle = '#fff3bf'; o(-0.008, -0.518, 0.012, 0.012); ctx.fill();
  } else {
    ctx.fillStyle = '#3b5bdb'; rr(-0.25, -0.32, 0.5, 0.13, 0.05); ctx.fill(); ctx.stroke();   // 반바지
    ctx.fillStyle = lg(ctx, 0, -0.65 * S, 0, -0.26 * S, [[0, top], [1, topD]]);
    rr(-0.25 * br, -0.65, 0.5 * br, 0.38, 0.13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd43b';   // 가슴의 별
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.03 : 0.065) * S; ctx.lineTo(Math.cos(a) * r, -0.46 * S + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }
  // 팔 (왼팔은 무릎 위, 오른팔은 기쁘면 흔들기)
  const arm = (k, ang) => {
    ctx.save(); ctx.translate(k * 0.2 * S, -0.58 * S); ctx.rotate(ang);
    ctx.fillStyle = SK; rr(-0.05, 0, 0.1, 0.26, 0.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = top; rr(-0.068, -0.03, 0.136, 0.12, 0.06); ctx.fill();
    ctx.fillStyle = SK; o(0, 0.28, 0.055, 0.05); ctx.fill();
    ctx.restore();
  };
  arm(-1, 0.35);
  arm(1, happy ? -2.5 + Math.sin(t * 10) * 0.35 : -0.35);
  // 목·머리
  const hy = baby ? -0.79 : -0.8, hr = baby ? 0.27 : 0.25;
  ctx.fillStyle = SKD; rr(-0.05, -0.68, 0.1, 0.07, 0.03); ctx.fill();
  if (girl) {   // 양 갈래 머리 + 리본
    ctx.fillStyle = hair; [-1, 1].forEach(k => { o(k * 0.29, hy + 0.08, 0.08, 0.13, k * -0.2); ctx.fill(); });
    [-1, 1].forEach(k => {
      ctx.fillStyle = yuna ? '#f472b6' : '#f03e3e';
      ctx.beginPath(); ctx.moveTo(k * 0.25 * S, (hy - 0.04) * S); ctx.lineTo(k * 0.33 * S, (hy - 0.1) * S); ctx.lineTo(k * 0.33 * S, (hy + 0.01) * S); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(k * 0.25 * S, (hy - 0.04) * S); ctx.lineTo(k * 0.17 * S, (hy - 0.1) * S); ctx.lineTo(k * 0.17 * S, (hy + 0.01) * S); ctx.closePath(); ctx.fill();
      o(k * 0.25, hy - 0.045, 0.025, 0.025); ctx.fill();
    });
  }
  ctx.fillStyle = SK; [-1, 1].forEach(k => { o(k * (hr - 0.01), hy + 0.02, 0.045, 0.06); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = rg(ctx, -0.07 * S, (hy - 0.08) * S, 0.02 * S, 0, hy * S, hr * S, [[0, '#fff1e6'], [1, SK]]);
  o(0, hy, hr, hr - 0.01); ctx.fill(); ctx.stroke();
  // 머리카락
  ctx.fillStyle = hair;
  if (baby) {
    ctx.strokeStyle = hair; ctx.lineWidth = S * 0.018;
    ctx.beginPath(); ctx.arc(0.01 * S, (hy - 0.25) * S, 0.035 * S, Math.PI * 0.9, Math.PI * 2.6); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(0, hy * S, (hr - 0.02) * S, (hr - 0.03) * S, 0, Math.PI * 1.15, Math.PI * 1.85); ctx.lineWidth = S * 0.03; ctx.stroke(); ctx.globalAlpha = 1;
  } else {
    ctx.beginPath(); ctx.moveTo(-(hr + 0.015) * S, (hy + 0.03) * S);
    ctx.ellipse(0, (hy - 0.01) * S, (hr + 0.015) * S, (hr + 0.02) * S, 0, Math.PI, TAU);
    if (girl) {
      ctx.quadraticCurveTo(0.19 * S, (hy - 0.09) * S, 0, (hy - 0.17) * S);
      ctx.quadraticCurveTo(-0.19 * S, (hy - 0.09) * S, -(hr + 0.015) * S, (hy + 0.03) * S);
    } else {
      ctx.quadraticCurveTo(0.22 * S, (hy - 0.15) * S, 0.09 * S, (hy - 0.1) * S);
      ctx.quadraticCurveTo(0.01 * S, (hy - 0.17) * S, -0.08 * S, (hy - 0.1) * S);
      ctx.quadraticCurveTo(-0.2 * S, (hy - 0.14) * S, -(hr + 0.015) * S, (hy + 0.03) * S);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; o(-0.08, hy - 0.19, 0.08, 0.025, -0.3); ctx.fill();
  }
  // 얼굴
  friendlyEyes(ctx, S, hy * S, t, 0.09);
  ctx.strokeStyle = SKD; ctx.lineWidth = S * 0.012; ctx.beginPath(); ctx.arc(0, (hy + 0.045) * S, 0.018 * S, 0.3, Math.PI - 0.3); ctx.stroke();
  smileMouth(ctx, S, (hy + 0.12) * S, '#a8473b', mouth);
  ctx.fillStyle = 'rgba(244,114,182,0.4)'; [-1, 1].forEach(k => { o(k * 0.15, hy + 0.07, 0.045, 0.028); ctx.fill(); });
  ctx.restore();
}

function drawPatient(ctx, p, S, t, happy, mouth) {
  if (p.kid) drawKid(ctx, S, t, happy, mouth, p.id);
  else GUEST_FN[p.id](ctx, S, t, happy, mouth);
}
// 아야 한 곳: 동물은 무릎 위에 얹은 왼팔, 아기·어린이는 왼쪽 무릎
const woundOf = (p) => (p.kid ? { x: -0.12, y: -0.16, rot: 0, len: 0.19 } : { x: -0.332, y: -0.346, rot: 0.5, len: 0.21 });

// 체온계를 넣을 귀 (S 배, k = -1 왼쪽 / 1 오른쪽), 열 시트를 붙일 이마
const earOf = (p, k) => (p.kid ? [k * (p.id === 'baby' ? 0.265 : 0.245), (p.id === 'baby' ? -0.79 : -0.8) + 0.02] : [k * 0.3, -0.76]);
const FOREHEAD_Y = -0.92;
// 사탕을 쥐여 줄 손 (S 배, 화면 오른쪽 손). 기쁘면 손을 흔들어서 매 프레임 바뀐다 (drawKid·sitBody 의 팔과 같은 계산)
function handOf(p, t, happy) {
  const [px, py, len, rest] = p.kid ? [0.2, -0.58, 0.28, -0.35] : [0.27, -0.46, 0.235, -0.5];
  const a = happy ? (p.kid ? -2.5 : -2.4) + Math.sin(t * 10) * 0.35 : rest;
  return [px - Math.sin(a) * len, py + Math.cos(a) * len, a];
}

// ─────────────────────────────── 그림 도우미 ───────────────────────────────
function drawHeart(c, x, y, r, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9); c.fill();
}
function drawStar(c, x, y, r, col, rot = 0) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  c.closePath(); c.fill();
}
// 까진 상처
function drawWound(c, x, y, r, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = 'rgba(251,113,133,0.55)'; ell(c, 0, 0, r * 1.25, r * 0.85); c.fill();
  c.strokeStyle = '#e03131'; c.lineWidth = r * 0.16; c.lineCap = 'round';
  [[-0.7, -0.3, 0.5, -0.45], [-0.8, 0.05, 0.75, -0.08], [-0.5, 0.38, 0.6, 0.3]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a * r, b * r); c.lineTo(d * r, e * r); c.stroke(); });
  c.restore();
}
// 밴드 (가운데가 0, 가로로 긴)
function drawBandage(c, len, wid) {
  c.save();
  shadowOn(c, wid * 0.25, wid * 0.08, 'rgba(0,0,0,0.2)');
  c.fillStyle = lg(c, 0, -wid / 2, 0, wid / 2, [[0, '#ffd8e8'], [1, '#fbb6ce']]);
  c.beginPath(); c.roundRect(-len / 2, -wid / 2, len, wid, wid / 2); c.fill(); shadowOff(c);
  c.strokeStyle = '#f598b8'; c.lineWidth = Math.max(1, wid * 0.05); c.stroke();
  c.fillStyle = '#fff5f8'; c.beginPath(); c.roundRect(-len * 0.17, -wid * 0.36, len * 0.34, wid * 0.72, wid * 0.14); c.fill();
  c.fillStyle = 'rgba(244,114,182,0.35)';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ell(c, -len * 0.1 + i * len * 0.1, -wid * 0.14 + j * wid * 0.28, wid * 0.035, wid * 0.035); c.fill(); }
  [-1, 1].forEach(k => drawHeart(c, k * len * 0.33, 0, wid * 0.2, '#ffffff'));
  c.restore();
}
// 청진기 (끝 = 가슴에 대는 동그라미 가운데가 0, 관은 아래로)
function drawSteth(c, s) {
  c.save(); c.lineCap = 'round';
  c.strokeStyle = '#0f9d8f'; c.lineWidth = s * 0.055;
  c.beginPath(); c.moveTo(0, s * 0.14); c.lineTo(0, s * 0.42); c.stroke();
  [-1, 1].forEach(k => {
    c.beginPath(); c.moveTo(0, s * 0.42); c.quadraticCurveTo(k * s * 0.3, s * 0.5, k * s * 0.22, s * 0.78); c.stroke();
    c.fillStyle = '#334155'; ell(c, k * s * 0.22, s * 0.8, s * 0.045, s * 0.04); c.fill();
  });
  c.fillStyle = '#cbd5e1'; ell(c, 0, s * 0.42, s * 0.04, s * 0.04); c.fill();
  c.fillStyle = '#94a3b8'; c.beginPath(); c.roundRect(-s * 0.03, s * 0.1, s * 0.06, s * 0.08, s * 0.02); c.fill();
  shadowOn(c, s * 0.06, s * 0.02);
  c.fillStyle = rg(c, -s * 0.05, -s * 0.05, 0, 0, 0, s * 0.17, [[0, '#ffffff'], [0.5, '#cbd5e1'], [1, '#64748b']]);
  ell(c, 0, 0, s * 0.16, s * 0.16); c.fill(); shadowOff(c);
  c.fillStyle = rg(c, -s * 0.03, -s * 0.03, 0, 0, 0, s * 0.11, [[0, '#f8fafc'], [1, '#94a3b8']]); ell(c, 0, 0, s * 0.11, s * 0.11); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)'; ell(c, -s * 0.05, -s * 0.06, s * 0.035, s * 0.02, -0.6); c.fill();
  c.restore();
}
// 연고 (끝 = 뚜껑 연 흰 주둥이 끝이 0, 아래로 갈수록 넓어지는 주황 튜브 + 흰 라벨 + 눌러 붙인 끝)
function drawCream(c, s, bead = 0) {
  c.save(); c.lineWidth = Math.max(1, s * 0.012);
  if (bead > 0) { c.fillStyle = '#fffdf5'; ell(c, 0, -s * 0.025, s * 0.045 * bead, s * 0.04 * bead); c.fill(); }
  c.fillStyle = '#f8f9fa'; c.strokeStyle = '#ced4da';
  c.beginPath(); c.roundRect(-s * 0.035, 0, s * 0.07, s * 0.075, s * 0.015); c.fill(); c.stroke();
  // 흰 주름 목
  c.fillStyle = lg(c, -s * 0.11, 0, s * 0.11, 0, [[0, '#dee2e6'], [0.4, '#ffffff'], [1, '#dee2e6']]);
  c.beginPath(); c.roundRect(-s * 0.11, s * 0.065, s * 0.22, s * 0.16, s * 0.025); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(173,181,189,0.7)'; c.beginPath(); for (let i = 1; i < 6; i++) { const x = -s * 0.11 + i * s * 0.22 / 6; c.moveTo(x, s * 0.075); c.lineTo(x, s * 0.215); } c.stroke();
  // 몸통 (위는 흰 라벨, 아래는 주황)
  const body = () => { c.beginPath(); c.moveTo(-s * 0.12, s * 0.22); c.lineTo(s * 0.12, s * 0.22); c.lineTo(s * 0.18, s * 0.75); c.lineTo(-s * 0.18, s * 0.75); c.closePath(); };
  shadowOn(c, s * 0.05, s * 0.02);
  body(); c.fillStyle = lg(c, -s * 0.18, 0, s * 0.18, 0, [[0, '#e8590c'], [0.45, '#ff922b'], [1, '#e8590c']]); c.fill(); shadowOff(c);
  c.save(); body(); c.clip();
  c.fillStyle = lg(c, -s * 0.18, 0, s * 0.18, 0, [[0, '#f1f3f5'], [0.45, '#ffffff'], [1, '#e9ecef']]); c.fillRect(-s * 0.2, s * 0.22, s * 0.4, s * 0.3);
  c.fillStyle = '#f76707'; c.font = `${s * 0.095}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('연고', 0, s * 0.32);
  c.fillStyle = 'rgba(232,89,12,0.55)'; c.fillRect(-s * 0.08, s * 0.39, s * 0.16, s * 0.015); c.fillRect(-s * 0.1, s * 0.42, s * 0.2, s * 0.012); c.fillRect(-s * 0.09, s * 0.45, s * 0.12, s * 0.012);
  c.fillStyle = '#e03131'; c.fillRect(-s * 0.1, s * 0.26, s * 0.04, s * 0.02);
  // 주황 부분의 흰 조개 무늬
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = s * 0.012; c.beginPath(); c.arc(0, s * 0.66, s * 0.06, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(0, s * 0.67); c.lineTo(Math.sin(i * 0.35) * s * 0.055, s * 0.67 - Math.cos(i * 0.35) * s * 0.055); } c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-s * 0.1, s * 0.22, s * 0.04, s * 0.53);
  c.restore();
  // 눌러 붙인 끝
  c.fillStyle = '#f76707'; c.beginPath(); c.roundRect(-s * 0.2, s * 0.74, s * 0.4, s * 0.08, s * 0.01); c.fill();
  c.strokeStyle = 'rgba(160,50,0,0.35)'; c.lineWidth = Math.max(1, s * 0.008); c.beginPath(); for (let i = 1; i < 12; i++) { const x = -s * 0.2 + i * s * 0.4 / 12; c.moveTo(x, s * 0.75); c.lineTo(x, s * 0.81); } c.stroke();
  c.restore();
}
// 양갈래 사탕 (가운데가 0, 가로 폭 w): 동그란 사탕을 비닐로 싸고 양쪽 끝을 꼬았다
function drawCandy(c, w, t = 0) {
  const r = w * 0.2;
  c.save();
  // 양쪽 꼬리 (주름진 비닐)
  [-1, 1].forEach(k => {
    const wig = Math.sin(t * 3 + k) * w * 0.01;
    c.fillStyle = lg(c, k * r, 0, k * w * 0.5, 0, [[0, 'rgba(255,214,232,0.95)'], [1, 'rgba(255,236,153,0.95)']]);
    c.beginPath(); c.moveTo(k * r * 1.15, 0);
    c.lineTo(k * w * 0.5, -r * 0.95 + wig);
    for (let i = 1; i <= 4; i++) c.lineTo(k * (w * 0.5 - (i % 2) * w * 0.035), -r * 0.95 + (i / 4) * r * 1.9 + wig);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(240,101,149,0.45)'; c.lineWidth = Math.max(1, w * 0.008);
    c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(k * r * 1.25, 0); c.lineTo(k * w * 0.46, i * r * 0.6 + wig); } c.stroke();
    // 꼰 목
    c.fillStyle = '#f783ac'; ell(c, k * r * 1.12, 0, r * 0.16, r * 0.26); c.fill();
  });
  // 가운데 사탕
  shadowOn(c, w * 0.04, w * 0.015, 'rgba(160,30,80,0.3)');
  c.fillStyle = rg(c, -r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1, [[0, '#ffc9de'], [1, '#e64980']]); ell(c, 0, 0, r, r * 0.92); c.fill(); shadowOff(c);
  c.save(); ell(c, 0, 0, r, r * 0.92); c.clip();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = r * 0.18;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * r * 0.45 - r, -r); c.lineTo(i * r * 0.45 + r, r); c.stroke(); }
  c.restore();
  // 비닐 반짝임
  c.fillStyle = 'rgba(255,255,255,0.7)'; ell(c, -r * 0.35, -r * 0.45, r * 0.32, r * 0.14, -0.4); c.fill();
  c.restore();
}
// 귀 체온계 (끝 = 귀에 넣는 투명 끝이 0, 몸통은 아래로): 파란 링 + 흰 몸통 + 회색 판(파란 버튼·초록 화면·파란 버튼 둘) + 아래 전원 버튼
//  lcd = { text, col } (화면 글자·불빛 색)
function drawThermo(c, s, lcd = null) {
  c.save(); c.lineWidth = Math.max(1, s * 0.012);
  c.fillStyle = 'rgba(232,240,248,0.95)'; c.strokeStyle = '#adb5bd';
  c.beginPath(); c.moveTo(-s * 0.045, s * 0.005); c.quadraticCurveTo(0, -s * 0.03, s * 0.045, s * 0.005); c.lineTo(s * 0.06, s * 0.09); c.lineTo(-s * 0.06, s * 0.09); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = lg(c, -s * 0.08, 0, s * 0.08, 0, [[0, '#1c3fb0'], [0.45, '#5c7cfa'], [1, '#1c3fb0']]);
  c.beginPath(); c.roundRect(-s * 0.075, s * 0.085, s * 0.15, s * 0.05, s * 0.015); c.fill();
  const body = () => {
    c.beginPath(); c.moveTo(-s * 0.08, s * 0.13); c.lineTo(s * 0.08, s * 0.13);
    c.quadraticCurveTo(s * 0.17, s * 0.2, s * 0.16, s * 0.4); c.lineTo(s * 0.15, s * 0.78); c.quadraticCurveTo(s * 0.15, s * 0.88, 0, s * 0.88);
    c.quadraticCurveTo(-s * 0.15, s * 0.88, -s * 0.15, s * 0.78); c.lineTo(-s * 0.16, s * 0.4); c.quadraticCurveTo(-s * 0.17, s * 0.2, -s * 0.08, s * 0.13); c.closePath();
  };
  shadowOn(c, s * 0.06, s * 0.02);
  body(); c.fillStyle = lg(c, -s * 0.16, 0, s * 0.16, 0, [[0, '#dee2e6'], [0.4, '#ffffff'], [1, '#e9ecef']]); c.fill(); shadowOff(c);
  c.strokeStyle = '#ced4da'; c.stroke();
  // 회색 판
  c.fillStyle = lg(c, 0, s * 0.24, 0, s * 0.62, [[0, '#ced4da'], [1, '#adb5bd']]);
  c.beginPath(); c.roundRect(-s * 0.115, s * 0.24, s * 0.23, s * 0.38, s * 0.06); c.fill();
  // 파란 동그라미 버튼 (온도계 그림)
  c.fillStyle = '#2b4acb'; ell(c, 0, s * 0.29, s * 0.04, s * 0.04); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(-s * 0.006, s * 0.265, s * 0.012, s * 0.035, s * 0.006); c.fill(); ell(c, 0, s * 0.305, s * 0.012, s * 0.012); c.fill();
  // 화면
  const col = lcd ? lcd.col : '#c5d6c8';
  c.fillStyle = col; c.beginPath(); c.roundRect(-s * 0.09, s * 0.34, s * 0.18, s * 0.13, s * 0.015); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-s * 0.085, s * 0.345, s * 0.17, s * 0.03);
  c.fillStyle = '#212529'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${s * 0.062}px 'Arial', sans-serif`; c.fillText(lcd ? lcd.text : '--.-', -s * 0.008, s * 0.395);
  c.font = `bold ${s * 0.028}px 'Arial', sans-serif`; c.fillText('℃', s * 0.07, s * 0.378);
  c.fillStyle = 'rgba(33,37,41,0.55)'; [-0.06, -0.02, 0.03].forEach(x => c.fillRect(x * s, s * 0.44, s * 0.03, s * 0.012));
  // 파란 버튼 둘
  [-1, 1].forEach(k => { c.fillStyle = '#3b5bdb'; c.beginPath(); c.roundRect(k * s * 0.05 - s * 0.04, s * 0.5, s * 0.08, s * 0.05, s * 0.015); c.fill(); c.fillStyle = 'rgba(255,255,255,0.85)'; ell(c, k * s * 0.05, s * 0.525, s * 0.012, s * 0.012); c.fill(); });
  // 전원 버튼
  c.strokeStyle = '#adb5bd'; c.lineWidth = Math.max(1, s * 0.01); ell(c, 0, s * 0.73, s * 0.035, s * 0.035); c.stroke();
  c.strokeStyle = '#868e96'; c.beginPath(); c.arc(0, s * 0.73, s * 0.015, -Math.PI / 2 + 0.7, -Math.PI / 2 - 0.7 + TAU); c.moveTo(0, s * 0.71); c.lineTo(0, s * 0.725); c.stroke();
  c.restore();
}
// 열 내리는 시트 (가운데가 0, 폭 w): 말랑한 하늘색 젤 + 눈송이 + 웃는 얼굴
function drawSheet(c, w) {
  const h = w * 0.42;
  c.save();
  shadowOn(c, w * 0.05, w * 0.02, 'rgba(30,90,160,0.25)');
  c.fillStyle = lg(c, 0, -h / 2, 0, h / 2, [[0, 'rgba(219,240,255,0.97)'], [1, 'rgba(160,212,252,0.97)']]);
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h * 0.35); c.fill(); shadowOff(c);
  c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, w * 0.02); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = Math.max(1, w * 0.012); c.lineCap = 'round';
  [[-0.33, -0.1, 0.07], [0.33, 0.08, 0.06], [0.2, -0.22, 0.04]].forEach(([x, y, r]) => {
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(x * w - Math.cos(a) * r * w, y * w - Math.sin(a) * r * w); c.lineTo(x * w + Math.cos(a) * r * w, y * w + Math.sin(a) * r * w); c.stroke(); }
  });
  c.fillStyle = '#1c7ed6'; [-1, 1].forEach(k => { ell(c, k * w * 0.07, -h * 0.05, w * 0.018, w * 0.022); c.fill(); });
  c.strokeStyle = '#1c7ed6'; c.lineWidth = Math.max(1, w * 0.014); c.beginPath(); c.arc(0, h * 0.02, w * 0.05, 0.3, Math.PI - 0.3); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.roundRect(-w * 0.42, -h * 0.38, w * 0.4, h * 0.14, h * 0.07); c.fill();
  c.restore();
}
// 손전등 (끝 = 불 나오는 렌즈가 0, 몸통은 아래로)
function drawPenlight(c, s, on = false) {
  c.save();
  if (on) { c.fillStyle = rg(c, 0, 0, 0, 0, 0, s * 0.12, [[0, 'rgba(255,250,210,0.95)'], [1, 'rgba(255,250,210,0)']]); ell(c, 0, 0, s * 0.12, s * 0.12); c.fill(); }
  c.fillStyle = lg(c, -s * 0.05, 0, s * 0.05, 0, [[0, '#adb5bd'], [0.45, '#f1f3f5'], [1, '#868e96']]);
  c.beginPath(); c.roundRect(-s * 0.05, s * 0.01, s * 0.1, s * 0.13, s * 0.02); c.fill();
  c.fillStyle = on ? '#fff9db' : '#dee2e6'; ell(c, 0, s * 0.015, s * 0.04, s * 0.018); c.fill();
  shadowOn(c, s * 0.05, s * 0.02);
  c.fillStyle = lg(c, -s * 0.042, 0, s * 0.042, 0, [[0, '#1971c2'], [0.45, '#74c0fc'], [1, '#1971c2']]);
  c.beginPath(); c.roundRect(-s * 0.042, s * 0.13, s * 0.084, s * 0.6, s * 0.03); c.fill(); shadowOff(c);
  c.fillStyle = '#ced4da'; c.fillRect(s * 0.04, s * 0.17, s * 0.018, s * 0.28);
  c.fillStyle = '#ffd43b'; ell(c, 0, s * 0.3, s * 0.02, s * 0.02); c.fill();
  c.fillStyle = '#adb5bd'; c.beginPath(); c.roundRect(-s * 0.044, s * 0.7, s * 0.088, s * 0.07, s * 0.02); c.fill();
  c.restore();
}
// 목 속을 크게 본 돋보기 (x,y 가운데, 반지름 r). fever 면 목이 빨갛다
function drawThroatView(c, x, y, r, fever, k) {
  c.save(); c.globalAlpha = clamp01(k);
  shadowOn(c, r * 0.15, r * 0.05);
  c.fillStyle = '#ffffff'; ell(c, x, y, r * 1.1, r * 1.1); c.fill(); shadowOff(c);
  c.save(); ell(c, x, y, r, r); c.clip();
  c.fillStyle = '#4a0d1b'; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  c.fillStyle = fever ? '#e03131' : '#f08c9a'; ell(c, x, y - r * 0.05, r * 0.72, r * 0.55); c.fill();
  [-1, 1].forEach(q => { c.fillStyle = fever ? '#c92a2a' : '#f06595'; ell(c, x + q * r * 0.58, y + r * 0.05, r * 0.2, r * 0.3); c.fill(); });
  if (fever) { c.fillStyle = 'rgba(134,14,61,0.7)'; [[-0.2, 0.05], [0.15, -0.1], [0.25, 0.15], [-0.1, 0.25]].forEach(([a, b]) => { ell(c, x + a * r, y + b * r, r * 0.04, r * 0.04); c.fill(); }); }
  c.fillStyle = '#f783ac'; ell(c, x, y - r * 0.95, r * 1.05, r * 0.5); c.fill();
  c.fillStyle = '#ff8fa3'; c.beginPath(); c.moveTo(x - r * 0.08, y - r * 0.5); c.quadraticCurveTo(x - r * 0.1, y - r * 0.1, x, y - r * 0.05); c.quadraticCurveTo(x + r * 0.1, y - r * 0.1, x + r * 0.08, y - r * 0.5); c.closePath(); c.fill();
  c.fillStyle = '#ffffff'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.roundRect(x + i * r * 0.21 - r * 0.09, y - r * 0.95, r * 0.18, r * 0.2, r * 0.06); c.fill(); }
  c.fillStyle = '#ff6b8a'; ell(c, x, y + r * 0.72, r * 0.8, r * 0.42); c.fill();
  c.strokeStyle = 'rgba(201,42,80,0.5)'; c.lineWidth = r * 0.03; c.beginPath(); c.moveTo(x, y + r * 0.45); c.lineTo(x, y + r * 0.85); c.stroke();
  c.fillStyle = 'rgba(255,250,200,0.3)'; ell(c, x, y - r * 0.1, r * 0.6, r * 0.5); c.fill();
  c.restore();
  c.strokeStyle = '#adb5bd'; c.lineWidth = r * 0.09; ell(c, x, y, r * 1.02, r * 1.02); c.stroke();
  c.strokeStyle = '#868e96'; c.lineWidth = r * 0.16; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + r * 0.78, y + r * 0.78); c.lineTo(x + r * 1.2, y + r * 1.2); c.stroke();
  c.restore();
}
// 콧물 흡입기 노즐 (투명): 끝 = 말랑한 코 끝이 0, 동그란 투명 통(뺀 콧물이 찬다) → 아래 호스. 길이 n, 호스는 0.62n 에서 나간다
function drawNozzle(c, n, fill = 0) {
  c.save(); c.lineWidth = Math.max(1, n * 0.014); c.strokeStyle = 'rgba(110,160,190,0.9)';
  c.fillStyle = 'rgba(225,240,250,0.92)';
  c.beginPath(); c.moveTo(-n * 0.035, n * 0.012); c.quadraticCurveTo(0, -n * 0.035, n * 0.035, n * 0.012);
  c.lineTo(n * 0.075, n * 0.15); c.lineTo(-n * 0.075, n * 0.15); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(200,225,240,0.95)'; c.beginPath(); c.roundRect(-n * 0.09, n * 0.13, n * 0.18, n * 0.04, n * 0.015); c.fill(); c.stroke();
  const cy = n * 0.3, r = n * 0.15;
  shadowOn(c, n * 0.05, n * 0.02, 'rgba(40,90,120,0.25)');
  c.fillStyle = 'rgba(236,248,255,0.8)'; ell(c, 0, cy, r, r * 0.95); c.fill(); shadowOff(c); c.stroke();
  if (fill > 0) { c.save(); ell(c, 0, cy, r * 0.9, r * 0.85); c.clip(); c.fillStyle = 'rgba(185,228,105,0.92)'; const h = r * 1.8 * Math.min(1, fill) * 0.75; c.fillRect(-r, cy + r * 0.85 - h, r * 2, h); c.restore(); }
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = n * 0.02; c.lineCap = 'round'; c.beginPath(); c.arc(0, cy, r * 0.7, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
  c.lineWidth = Math.max(1, n * 0.014); c.strokeStyle = 'rgba(110,160,190,0.9)';
  c.fillStyle = 'rgba(225,240,250,0.92)'; c.beginPath(); c.roundRect(-n * 0.035, cy + r * 0.85, n * 0.07, n * 0.62 - cy - r * 0.85, n * 0.02); c.fill(); c.stroke();
  c.restore();
}
// 콧물 흡입기 본체: 위는 하늘색·아래는 흰 공 모양 + 곰 귀 같은 손잡이 둘 + 앞의 꽃 모양 파란 다이얼(전원). 바닥 가운데가 0, 지름 m
const MACHINE_DIAL_Y = -0.39;   // 다이얼 높이 (m 배)
function drawMachine(c, m, on, t) {
  const R = m * 0.5, cy = -R;
  c.save();
  if (on) c.translate(Math.sin(t * 70) * m * 0.003, Math.cos(t * 55) * m * 0.002);
  c.fillStyle = 'rgba(0,0,0,0.12)'; ell(c, 0, -m * 0.01, R * 0.8, R * 0.12); c.fill();
  // 손잡이 (고리)
  [-1, 1].forEach(k => {
    c.save(); c.translate(k * R * 0.66, cy - R * 0.7); c.rotate(k * 0.55);
    c.strokeStyle = '#7cc8ea'; c.lineWidth = R * 0.13; ell(c, 0, 0, R * 0.24, R * 0.2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = R * 0.03; c.beginPath(); c.ellipse(0, 0, R * 0.26, R * 0.22, 0, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
    c.restore();
  });
  // 공 몸통
  c.save(); ell(c, 0, cy, R, R); c.clip();
  c.fillStyle = rg(c, -R * 0.35, cy - R * 0.2, R * 0.1, 0, cy, R * 1.1, [[0, '#ffffff'], [1, '#dde7ee']]); c.fillRect(-R, cy - R, 2 * R, 2 * R);
  c.fillStyle = lg(c, 0, cy - R, 0, cy, [[0, '#b4e2f7'], [1, '#6cc0e8']]);
  c.beginPath(); c.moveTo(-R * 1.1, cy - R * 1.1); c.lineTo(R * 1.1, cy - R * 1.1); c.lineTo(R * 1.1, cy - R * 0.02);
  for (let i = 0; i <= 40; i++) { const x = R * 1.1 - i * R * 2.2 / 40; c.lineTo(x, cy - R * 0.02 + Math.sin(i * 0.95) * R * 0.06 + Math.sin(i * 0.37) * R * 0.04); }
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)'; [[-0.55, -0.1, 0.07], [-0.3, -0.18, 0.05], [0.4, -0.12, 0.06], [0.62, -0.25, 0.045], [0.15, -0.2, 0.04]].forEach(([x, y, r]) => { ell(c, x * R, cy + y * R, r * R, r * R); c.fill(); });
  c.fillStyle = 'rgba(255,255,255,0.55)'; ell(c, -R * 0.4, cy - R * 0.55, R * 0.25, R * 0.12, -0.6); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(90,150,180,0.45)'; c.lineWidth = Math.max(1.5, R * 0.025); ell(c, 0, cy, R, R); c.stroke();
  c.fillStyle = '#ffffff'; ell(c, 0, cy - R * 0.98, R * 0.11, R * 0.06); c.fill(); c.stroke();
  // 다이얼 (전원)
  const dy = MACHINE_DIAL_Y * m, dr = R * 0.32;
  if (on) { c.fillStyle = 'rgba(64,192,87,0.25)'; ell(c, 0, dy, dr * 1.55, dr * 1.55); c.fill(); }
  else { c.fillStyle = `rgba(255,212,59,${0.4 + Math.sin(t * 5) * 0.25})`; ell(c, 0, dy, dr * 1.7, dr * 1.7); c.fill(); }
  c.save(); c.translate(0, dy); c.rotate(on ? 0.9 : 0);
  shadowOn(c, R * 0.06, R * 0.02, 'rgba(20,80,120,0.35)');
  c.fillStyle = '#45a9dc'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ell(c, Math.cos(a) * dr * 0.55, Math.sin(a) * dr * 0.55, dr * 0.48, dr * 0.48); c.fill(); }
  ell(c, 0, 0, dr * 0.7, dr * 0.7); c.fill(); shadowOff(c);
  c.fillStyle = '#ffffff'; ell(c, 0, -dr * 0.78, dr * 0.1, dr * 0.1); c.fill();
  c.restore();
  c.fillStyle = '#2f8fc4'; ell(c, 0, dy, dr * 0.24, dr * 0.24); c.fill();
  // 불빛
  c.fillStyle = on ? '#51cf66' : '#ced4da'; ell(c, R * 0.55, cy + R * 0.38, R * 0.05, R * 0.05); c.fill();
  c.restore();
}
// 도구 칸 그림 (칸 가운데 x,y, 칸 크기 s)
function drawToolIcon(c, id, x, y, s, t, lcd = null) {
  c.save(); c.translate(x, y);
  if (id === 'steth') { c.translate(0, -s * 0.32); drawSteth(c, s * 0.82); }
  else if (id === 'temp') { c.translate(-s * 0.06, -s * 0.42); c.rotate(0.22); drawThermo(c, s * 0.95, lcd); }
  else if (id === 'sheet') { c.rotate(-0.2); drawSheet(c, s * 0.8); }
  else if (id === 'throat') { c.translate(-s * 0.1, -s * 0.34); c.rotate(0.35); drawPenlight(c, s * 0.9, false); }
  else if (id === 'nose') { c.translate(-s * 0.08, s * 0.36); drawMachine(c, s * 0.6, false, t); c.translate(s * 0.36, -s * 0.66); c.rotate(0.2); drawNozzle(c, s * 0.6); }
  else if (id === 'cream') { c.translate(0, -s * 0.36); drawCream(c, s * 0.95); }
  else if (id === 'band') { c.rotate(-0.35); drawBandage(c, s * 0.82, s * 0.26); }
  else if (id === 'candy') { c.rotate(-0.25); drawCandy(c, s * 0.95, t); }
  c.restore();
}

// ─────────────────────────────── 콧물 흡입기 소리 ───────────────────────────────
//  - 모터: 켜 둔 동안 계속 웅~ (톱니파 기본음 + 배음 → 낮은 통과 필터, 날개 떨림 LFO + 바람 소리). 처음 켤 때 윙 하고 돌기 시작한다
//    콧구멍에 대면 부하가 걸려 음이 살짝 낮아지고 바람 소리가 거칠어진다
//  - 콧물 빠지는 소리: 대역 필터를 쓸어 올리는 '쭈루룩' + 뽀글뽀글 거품 (0.4초 조각을 이어 재생)
//  - 아이패드 elementMode(<audio> 로 재생)에서는 모터도 0.6초 조각으로 만들어 이어 튼다
const seeded = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
function noiseBuf(ctx, sec) { const n = Math.ceil(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
// dur 가 있으면 그 길이 조각, 0 이면 멈출 때까지 계속
function buildMotor(ctx, out, now, dur, load) {
  const f0 = load ? 104 : 122;
  const master = ctx.createGain(); master.connect(out);
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  const osc2 = ctx.createOscillator(); osc2.type = 'square';
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = load ? 800 : 1000; lp.Q.value = 1.5;
  const og = ctx.createGain(); og.gain.value = 0.12; const og2 = ctx.createGain(); og2.gain.value = 0.03;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
  lfo.connect(lfoG); lfoG.connect(og.gain); osc.connect(og); osc2.connect(og2); og.connect(lp); og2.connect(lp); lp.connect(master);
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuf(ctx, dur ? dur + 0.05 : 2); ns.loop = !dur;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = load ? 1500 : 2600; bp.Q.value = 0.6;
  const ng = ctx.createGain(); ng.gain.value = load ? 0.12 : 0.05; ns.connect(bp); bp.connect(ng); ng.connect(master);
  if (dur) {
    osc.frequency.value = f0; osc2.frequency.value = f0 * 2;
    master.gain.setValueAtTime(0.0001, now); master.gain.linearRampToValueAtTime(0.55, now + 0.03); master.gain.setValueAtTime(0.55, now + dur - 0.03); master.gain.linearRampToValueAtTime(0.0001, now + dur);
  } else {
    osc.frequency.setValueAtTime(35, now); osc.frequency.exponentialRampToValueAtTime(f0, now + 0.45);
    osc2.frequency.setValueAtTime(70, now); osc2.frequency.exponentialRampToValueAtTime(f0 * 2, now + 0.45);
    master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(0.55, now + 0.35);
  }
  const nodes = [osc, osc2, lfo, ns]; nodes.forEach(n => n.start(now)); if (dur) nodes.forEach(n => n.stop(now + dur + 0.02));
  return { master, osc, osc2, bp, ng, lp, nodes };
}
function buildSlurp(ctx, out, now, seed) {
  const r = seeded(seed + 1), dur = 0.42;
  const ns = ctx.createBufferSource(); ns.buffer = noiseBuf(ctx, dur + 0.05);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.5;
  bp.frequency.setValueAtTime(450 + r() * 300, now); bp.frequency.linearRampToValueAtTime(1300 + r() * 700, now + dur * 0.5); bp.frequency.linearRampToValueAtTime(650 + r() * 200, now + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.4, now + 0.04); g.gain.linearRampToValueAtTime(0.28, now + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, now + dur);
  ns.connect(bp); bp.connect(g); g.connect(out); ns.start(now); ns.stop(now + dur + 0.02);
  const nb = 8 + Math.floor(r() * 6);
  for (let i = 0; i < nb; i++) {   // 뽀글뽀글: 짧게 음이 떨어지는 거품
    const t = now + r() * dur * 0.9, f = 240 + r() * 560, o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.03);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.18 + r() * 0.17, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.05);
  }
}
function startMotor(audio) {
  if (audio.muted || audio.elementMode) return null;
  try {
    audio.init(); const ctx = audio.ctx; if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    const m = buildMotor(ctx, audio.out(), ctx.currentTime + 0.01, 0, false);
    return {
      setLoad(on) {
        const t = ctx.currentTime, f0 = on ? 104 : 122;
        m.osc.frequency.setTargetAtTime(f0, t, 0.08); m.osc2.frequency.setTargetAtTime(f0 * 2, t, 0.08);
        m.bp.frequency.setTargetAtTime(on ? 1500 : 2600, t, 0.1); m.ng.gain.setTargetAtTime(on ? 0.12 : 0.05, t, 0.08); m.lp.frequency.setTargetAtTime(on ? 800 : 1000, t, 0.1);
      },
      stop() {
        const t = ctx.currentTime;
        try { m.master.gain.cancelScheduledValues(t); m.master.gain.setValueAtTime(Math.max(0.0001, m.master.gain.value), t); m.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); m.osc.frequency.setTargetAtTime(30, t, 0.15); m.nodes.forEach(n => n.stop(t + 0.55)); } catch { /* 이미 멈춤 */ }
      }
    };
  } catch { return null; }
}
function playSlurp(audio, n) {
  if (audio.muted) return;
  const v = n % 6;
  if (audio.elementMode) { audio._renderPlay(`hospSlurp${v}`, 0.48, (c, o, now) => buildSlurp(c, o, now, v)); return; }
  try { audio.init(); const ctx = audio.ctx; if (ctx) buildSlurp(ctx, audio.out(), ctx.currentTime + 0.005, v); } catch { /* 무시 */ }
}
function playMotorChunk(audio, load) {
  if (audio.muted) return;
  audio._renderPlay(`hospMotor${load ? 1 : 0}`, 0.6, (c, o, now) => buildMotor(c, o, now, 0.6, load));
}

// ─────────────────────────────── 화면 배치 ───────────────────────────────
function layout(W, H) {
  const land = W > H * 1.05;
  const trayH = Math.max(96, Math.min(H * 0.22, 150));
  const areaH = H - trayH;
  const S = Math.min(areaH * 0.66, W * (land ? 0.34 : 0.48));
  const gx = W * (land ? 0.44 : 0.42), gy = areaH * 0.9;
  const nT = TOOL_IDS.length, tile = Math.min(trayH * 0.64, W / (nT * 1.3)), gap = tile * 0.24, tw = tile * nT + gap * (nT - 1);
  const tiles = TOOL_IDS.map((id, i) => ({ id, x: W / 2 - tw / 2 + tile / 2 + i * (tile + gap), y: H - trayH / 2 - trayH * 0.07, s: tile }));
  const ms = S * 0.48, mx = Math.min(W - ms * 0.7, gx + S * 1.05), my = gy + S * 0.06;
  const nz = S * 0.4;   // 노즐 길이
  return { W, H, land, trayH, areaH, S, gx, gy, tile, tiles, ms, mx, my, nz, nzRest: [mx - ms * 0.72, my - ms * 0.92] };
}
function drawRoom(c, L, t) {
  const { W, H, areaH, S, gx, gy, trayH } = L, floorY = areaH * 0.78;
  c.fillStyle = lg(c, 0, 0, 0, floorY, [[0, '#effcf8'], [1, '#d3f2ea']]); c.fillRect(0, 0, W, floorY);
  c.fillStyle = '#bde9dd'; c.fillRect(0, floorY - areaH * 0.13, W, areaH * 0.13);
  c.fillStyle = '#a5dccd'; c.fillRect(0, floorY - areaH * 0.13, W, 4);
  c.fillStyle = lg(c, 0, floorY, 0, H, [[0, '#fff4e3'], [1, '#f6e2c4']]); c.fillRect(0, floorY, W, H - floorY);
  c.strokeStyle = 'rgba(214,180,130,0.35)'; c.lineWidth = 2;
  for (let x = -40; x < W + 40; x += 70) { c.beginPath(); c.moveTo(x, floorY); c.lineTo(x - 30, areaH); c.stroke(); }
  // 창문
  const wx = W * 0.05, wy = areaH * 0.08, ww = Math.min(W * 0.18, 230), wh = areaH * 0.32;
  c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(wx - 8, wy - 8, ww + 16, wh + 16, 18); c.fill();
  c.fillStyle = lg(c, 0, wy, 0, wy + wh, [[0, '#a5d8ff'], [1, '#e7f5ff']]); c.beginPath(); c.roundRect(wx, wy, ww, wh, 12); c.fill();
  c.fillStyle = '#ffe066'; ell(c, wx + ww * 0.75, wy + wh * 0.3, ww * 0.1, ww * 0.1); c.fill();
  c.fillStyle = '#ffffff'; [[0.3, 0.45, 1], [0.55, 0.7, 0.7]].forEach(([qx, qy, k]) => { const cx = wx + ww * qx + Math.sin(t * 0.2) * 6, cy = wy + wh * qy, r = ww * 0.08 * k; ell(c, cx, cy, r * 1.6, r); c.fill(); ell(c, cx - r * 0.6, cy - r * 0.4, r, r * 0.8); c.fill(); });
  c.fillStyle = '#ffffff'; c.fillRect(wx + ww / 2 - 4, wy, 8, wh); c.fillRect(wx, wy + wh / 2 - 4, ww, 8);
  // 오른쪽 위 포스터 (하트 + 초록 십자)
  const px = W - Math.min(W * 0.17, 200) - W * 0.04, pw = Math.min(W * 0.17, 200), py = areaH * 0.07, ph = areaH * 0.26;
  c.fillStyle = '#ffffff'; shadowOn(c, 10, 4); c.beginPath(); c.roundRect(px, py, pw, ph, 16); c.fill(); shadowOff(c);
  c.fillStyle = '#40c057'; const cx = px + pw * 0.5, cy = py + ph * 0.45, k = Math.min(pw, ph) * 0.16;
  c.beginPath(); c.roundRect(cx - k * 0.4, cy - k * 1.2, k * 0.8, k * 2.4, k * 0.2); c.fill(); c.beginPath(); c.roundRect(cx - k * 1.2, cy - k * 0.4, k * 2.4, k * 0.8, k * 0.2); c.fill();
  drawHeart(c, cx + k * 1.35, cy - k * 1.05, k * 0.5 * (1 + Math.sin(t * 3) * 0.08), '#ff8787');
  c.fillStyle = '#2b8a3e'; c.font = `${Math.max(12, ph * 0.13)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('튼튼 병원', cx, py + ph * 0.84);
  // 침대
  const bw = S * 1.6, bx = gx - bw / 2, bt = gy - S * 0.03;
  c.fillStyle = '#adb5bd'; [bx + S * 0.08, bx + bw - S * 0.14].forEach(x => c.fillRect(x, bt + S * 0.12, S * 0.06, areaH - bt - S * 0.12));
  shadowOn(c, 14, 6);
  c.fillStyle = lg(c, 0, bt, 0, bt + S * 0.15, [[0, '#d0ebff'], [1, '#74c0fc']]); c.beginPath(); c.roundRect(bx, bt, bw, S * 0.15, S * 0.05); c.fill(); shadowOff(c);
  c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(bx + S * 0.03, bt - S * 0.01, bw - S * 0.06, S * 0.06, S * 0.03); c.fill();
  c.fillStyle = '#ffffff'; shadowOn(c, 8, 3); ell(c, bx + S * 0.2, bt - S * 0.03, S * 0.17, S * 0.07, -0.08); c.fill(); shadowOff(c);
  // 도구 판
  c.fillStyle = 'rgba(255,255,255,0.94)'; shadowOn(c, 16, -2, 'rgba(20,60,50,0.18)');
  c.beginPath(); c.roundRect(8, H - trayH + 6, W - 16, trayH - 12, 26); c.fill(); shadowOff(c);
}

// ═════════════════════════════════════════════════════════════════════════════
export default function HospitalGame({ audio, speak }) {
  const canvasRef = useRef(null);
  const G = useRef(null);
  const motorRef = useRef(null);   // 켜 둔 콧물 흡입기 모터 소리
  const [ui, setUi] = useState({ phase: 'arrive', si: 0, steps: [], pid: 'baby', land: true, power: false });
  const say = (text) => { if (speak && text) speak(text); };
  const later = (fn, ms) => audio.later(fn, ms);
  const sync = () => { const g = G.current; if (!g || !g.p) return; setUi({ phase: g.phase, si: g.si, steps: g.steps, pid: g.p.id, land: g.L ? g.L.land : true, power: g.power }); };
  const step = () => { const g = G.current; return g.phase === 'treat' ? g.steps[g.si] : null; };
  const stepLine = (id) => ({ steth: VOICE.hospSteth(), temp: VOICE.hospTempGo(), throat: VOICE.hospThroatGo(), nose: VOICE.hospNose(), cream: VOICE.hospCream(), candy: VOICE.hospCandy() }[id]);

  const newPatient = () => {
    const g = G.current;
    audio.interruptVoice();
    g.pi += 1;
    if (g.pi >= g.order.length) { g.order = shuffle(HOSPITAL_PATIENTS); g.pi = 0; }
    const p = g.order[g.pi];
    // 아픈 곳은 열·콧물·상처 중 한두 가지
    const sym = HOSPITAL_SYMPTOMS[Math.floor(Math.random() * HOSPITAL_SYMPTOMS.length)], fever = sym.includes('fever');
    const temps = HOSPITAL_TEMPS[fever ? 'fever' : 'normal'], temp = temps[Math.floor(Math.random() * temps.length)];
    const steps = ['steth', 'temp', ...(fever ? ['sheet'] : []), 'throat', ...(sym.includes('nose') ? ['nose'] : []), ...(sym.includes('wound') ? ['cream', 'band'] : []), 'candy'];
    Object.assign(g, {
      p, sym, steps, si: 0, phase: 'arrive', phaseT: g.t, beats: STETH_SPOTS.map(() => false),
      fever, temp, tempK: 0, inEar: null, tempShown: false, sheet: false, sheetT: 0, throat: 0, lit: false, ahSaid: false,
      snot: sym.includes('nose') ? [1, 1] : [0, 0], power: false, inNose: null, cream: 0, dabs: [], band: false, candy: false,
      chewUntil: 0, happyUntil: 0, drag: null, parts: [], soundT: 0, humT: 0, lastHp: null, waitSaid: 0
    });
    say(VOICE.hospArrive(p, sym));
    later(() => { const h = G.current; if (h.p === p && h.si === 0 && !h.drag) say(VOICE.hospSteth()); }, 4800);
    sync();
  };
  useEffect(() => {
    G.current = { t: 0, order: shuffle(HOSPITAL_PATIENTS), pi: -1, parts: [] };
    newPatient();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const burst = (x, y, n, kinds = ['heart', 'star']) => {
    const g = G.current, cols = ['#ff8787', '#f783ac', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 60 + Math.random() * 120;
      g.parts.push({ kind: kinds[i % kinds.length], x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, born: g.t, life: 1.2 + Math.random() * 0.6, col: cols[i % cols.length], r: 7 + Math.random() * 7, rot: Math.random() * 6 });
    }
  };
  const completeStep = () => {
    const g = G.current, id = g.steps[g.si], L = g.L;
    g.drag = null; g.inNose = null; g.inEar = null; g.lit = false; g.si += 1; g.happyUntil = g.t + 1.6;
    audio.playXylophone(1318.5, 0.6); later(() => audio.playXylophone(1568, 0.6), 130);
    burst(L.gx, L.gy - L.S * 0.6, 12);
    say({ steth: VOICE.hospStethDone(), temp: VOICE.hospTemp(g.temp, g.fever), sheet: VOICE.hospSheetDone(), throat: VOICE.hospThroatDone(g.fever), nose: VOICE.hospNoseDone(), cream: VOICE.hospCreamDone(), band: VOICE.hospBandDone(), candy: VOICE.hospCandyDone() }[id]);
    if (id === 'nose') later(() => { G.current.power = false; sync(); }, 900);
    if (g.si >= g.steps.length) {
      g.phase = 'done'; g.happyUntil = Infinity; g.chewUntil = g.t + 1.6;
      later(() => { audio.playFanfare(); burst(L.gx, L.gy - L.S * 0.8, 26); }, 1200);
      const p = g.p; later(() => { if (G.current.p === p) say(VOICE.hospThanks(p)); }, 2300);
    } else {
      const next = g.steps[g.si], p = g.p, si = g.si;
      // 밴드·열 시트는 앞 문장(약 다 발랐어요 / 열이 나요)이 이미 안내한다. 체온 문장은 길어서 조금 더 기다린다
      if (next !== 'band' && next !== 'sheet') later(() => { const h = G.current; if (h.p === p && h.si === si && !h.drag && !(next === 'nose' && h.power)) say(stepLine(next)); }, id === 'temp' ? 4600 : 2300);
    }
    sync();
  };

  // ── 입력 ──
  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const hotOf = (g, x, y) => [x, y - g.L.tile * 0.42];   // 도구 끝은 손가락보다 조금 위 (손가락에 가려지지 않게)
  const onDown = (e) => {
    const g = G.current; if (!g || !g.L) return; const L = g.L, [x, y] = pos(e), cur = step();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    if (!cur) return;
    // 콧물 기계: 전원 버튼 → 노즐 잡기
    if (cur === 'nose') {
      const bx = L.mx, by = L.my + MACHINE_DIAL_Y * L.ms;
      if (!g.power && Math.hypot(x - bx, y - by) < L.ms * 0.3) {
        g.power = true; audio.playNoise(0.035, 0.5, 3200, 1.2);   // 딸깍 (모터 소리는 그림 루프에서)
        say(VOICE.hospNoseOn()); sync(); return;
      }
      const [rx, ry] = L.nzRest;
      if (Math.hypot(x - rx, y - (ry + L.nz * 0.35)) < L.nz * 0.5) {
        if (!g.power) { say(VOICE.hospNose()); audio.playFreq(300, 'sine', 0.1, 0.25); return; }
        g.drag = { id: 'nose', x, y }; audio.playFreq(660, 'sine', 0.06, 0.25); sync(); return;
      }
    }
    const tile = L.tiles.find(q => Math.abs(x - q.x) < q.s * 0.6 && Math.abs(y - q.y) < q.s * 0.6);
    if (!tile) return;
    if (tile.id !== cur) {
      if (g.t - g.waitSaid > 2.5) { g.waitSaid = g.t; say(VOICE.hospWait()); }
      audio.playFreq(300, 'sine', 0.12, 0.25); return;
    }
    if (cur === 'nose') { say(g.power ? VOICE.hospNoseOn() : VOICE.hospNose()); return; }
    g.drag = { id: cur, x, y }; g.lastHp = null; audio.playFreq(660, 'sine', 0.06, 0.25); sync();
  };
  const onMove = (e) => { const g = G.current; if (!g || !g.drag) return; const [x, y] = pos(e); g.drag.x = x; g.drag.y = y; };
  const onUp = () => {
    const g = G.current; if (!g || !g.drag) return; const L = g.L, d = g.drag;
    if (d.id === 'candy') {   // 손 가까이에 놓으면 쥔다
      const [hx, hy] = hotOf(g, d.x, d.y), [ax, ay] = handOf(g.p, g.t, g.t < g.happyUntil);
      if (Math.hypot(hx - (L.gx + ax * L.S), hy - (L.gy + ay * L.S)) < L.S * 0.22) {
        g.candy = true; audio.playPopSound(); audio.playNoise(0.12, 0.2, 4000, 0.8); completeStep(); return;   // 바스락
      }
    }
    if (d.id === 'sheet') {   // 이마에 착
      const [hx, hy] = hotOf(g, d.x, d.y);
      if (Math.hypot(hx - L.gx, hy - (L.gy + FOREHEAD_Y * L.S)) < L.S * 0.2) {
        g.sheet = true; g.sheetT = g.t; audio.playPopSound(); audio.playNoise(0.25, 0.15, 5000, 0.6);
        for (let i = 0; i < 14; i++) { const a = Math.random() * TAU; g.parts.push({ kind: 'star', x: L.gx, y: L.gy + FOREHEAD_Y * L.S, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60 - 40, born: g.t, life: 1.3, col: i % 2 ? '#a5d8ff' : '#ffffff', r: 6 + Math.random() * 5, rot: Math.random() * 6 }); }
        completeStep(); return;
      }
    }
    if (d.id === 'band') {
      const [hx, hy] = hotOf(g, d.x, d.y), w = woundOf(g.p);
      if (Math.hypot(hx - (L.gx + w.x * L.S), hy - (L.gy + w.y * L.S)) < L.S * 0.2) {
        g.band = true; audio.playPopSound(); completeStep(); return;
      }
    }
    g.drag = null; g.inNose = null; g.inEar = null; g.lit = false; g.tempK = 0; g.lastHp = null; sync();
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = performance.now(); const t0 = last;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const g = G.current; if (!g || !g.p) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t = (now - t0) / 1000; const t = g.t;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (!(W > 0 && H > 0)) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const L = layout(W, H), wasLand = g.L && g.L.land; g.L = L; if (wasLand !== L.land) sync();
      const { S, gx, gy } = L, p = g.p, cur = step();
      if (g.phase === 'arrive' && t - g.phaseT > 1) { g.phase = 'treat'; sync(); }
      const at = (sx, sy) => [gx + sx * S, gy + sy * S];
      const w = woundOf(p), [wx, wy] = at(w.x, w.y);
      const nostril = (k) => at(k * (p.kid ? 0.022 : 0.026), p.nose + 0.012);
      let mouth = 0;

      // ── 도구 쓰기 ──
      const d = g.drag;
      const ear = (k) => { const [ex, ey] = earOf(p, k); return at(ex, ey); };
      g.lit = false;
      if (d && cur === d.id) {
        const [hx, hy] = hotOf(g, d.x, d.y);
        if (cur === 'temp') {
          // 귀에 가까이 가면 체온계 끝이 귀에 쏙 들어가고, 잠깐 기다리면 삐빅
          if (g.inEar != null) { const [ex, ey] = ear(g.inEar); if (Math.hypot(hx - ex, hy - ey) > S * 0.17) { g.inEar = null; g.tempK = 0; } }
          if (g.inEar == null) [-1, 1].forEach(k => { const [ex, ey] = ear(k); if (g.inEar == null && Math.hypot(hx - ex, hy - ey) < S * 0.11) { g.inEar = k; g.tempK = 0; audio.playFreq(1300, 'sine', 0.05, 0.2); } });
          if (g.inEar != null) {
            g.tempK += dt / TEMP_SEC;
            if (t - g.soundT > 0.32) { g.soundT = t; audio.playFreq(950, 'sine', 0.03, 0.12); }
            if (g.tempK >= 1) {
              g.tempShown = true; audio.playFreq(2350, 'square', 0.07, 0.22); later(() => audio.playFreq(2350, 'square', 0.07, 0.22), 140);   // 삐빅
              completeStep();
            }
          }
        } else if (cur === 'throat') {
          const [mx, my] = at(0, p.mouth);
          if (Math.hypot(hx - mx, hy - my) < S * 0.18) {
            g.lit = true; mouth = 1;
            if (!g.ahSaid) { g.ahSaid = true; say(VOICE.hospAh()); }
            g.throat = Math.min(1, g.throat + dt / THROAT_SEC);
            if (g.throat >= 1) completeStep();
          }
        } else if (cur === 'steth') {
          STETH_SPOTS.forEach(([sx, sy], i) => {
            if (g.beats[i]) return; const [bx, by] = at(sx, sy);
            if (Math.hypot(hx - bx, hy - by) < S * 0.08) {
              g.beats[i] = true; audio.playFreq(75, 'sine', 0.14, 0.9); later(() => audio.playFreq(62, 'sine', 0.16, 0.8), 190);
              g.parts.push({ kind: 'heart', x: bx, y: by, vx: 0, vy: -50, born: t, life: 1.2, col: '#ff6b6b', r: S * 0.05, big: true });
              if (g.beats.every(Boolean)) later(() => completeStep(), 450);
            }
          });
        } else if (cur === 'nose') {
          // 가까운 콧구멍으로 노즐이 쏙 들어간다 (그쪽 콧물이 남아 있을 때만)
          if (g.inNose != null) { const [nx, ny] = nostril(g.inNose), [ox, oy] = nostril(-g.inNose); if (Math.hypot(hx - nx, hy - ny) > S * 0.16 || (g.snot[g.inNose < 0 ? 1 : 0] > 0 && Math.hypot(hx - ox, hy - oy) < Math.hypot(hx - nx, hy - ny) - S * 0.01)) g.inNose = null; }
          if (g.inNose == null) {
            // 더 가까운 콧구멍 쪽으로만 (한쪽을 다 빼면 노즐을 다른 쪽으로 옮겨야 들어간다)
            const dl = Math.hypot(hx - nostril(-1)[0], hy - nostril(-1)[1]), dr = Math.hypot(hx - nostril(1)[0], hy - nostril(1)[1]);
            const k = dl <= dr ? -1 : 1;
            if (g.snot[k < 0 ? 0 : 1] > 0 && Math.min(dl, dr) < S * 0.09) { g.inNose = k; audio.playFreq(500, 'sine', 0.05, 0.25); }
          }
          if (g.inNose != null) {
            const si = g.inNose < 0 ? 0 : 1;
            g.snot[si] = Math.max(0, g.snot[si] - dt / NOSE_SEC);
            if (t - g.soundT > 0.34) { g.soundT = t; g.slurpN = (g.slurpN || 0) + 1; playSlurp(audio, g.slurpN); }   // 쭈루룩 뽀글뽀글
            if (g.snot[si] <= 0) {
              audio.playPopSound(); g.inNose = null;
              if (g.snot.every(v => v <= 0)) completeStep();
              else say(VOICE.hospNoseOther());
            }
          }
        } else if (cur === 'cream') {
          if (Math.hypot(hx - wx, hy - wy) < S * 0.14) {
            if (g.lastHp) {
              const mv = Math.hypot(hx - g.lastHp[0], hy - g.lastHp[1]);
              g.cream = Math.min(1, g.cream + mv / (S * 1.3));
              if (mv > 2 && g.dabs.length < 60) { const a = Math.random() * TAU, rr = Math.random() * 0.05; g.dabs.push([w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr * 0.7, 0.018 + Math.random() * 0.02]); }
              if (mv > 3 && t - g.soundT > 0.18) { g.soundT = t; audio.playNoise(0.08, 0.12, 2600, 0.8); }
              if (g.cream >= 1) completeStep();
            }
            g.lastHp = [hx, hy];
          } else g.lastHp = null;
        }
      }
      // 모터: 켜 둔 동안 계속 (콧구멍에 대면 부하가 걸린 소리)
      const load = g.inNose != null;
      if (g.power && !audio.muted) {
        if (audio.elementMode) { if (t - g.humT > 0.56) { g.humT = t; playMotorChunk(audio, load); } }
        else {
          if (!motorRef.current) { motorRef.current = startMotor(audio); g.load = false; }
          if (motorRef.current && load !== g.load) { g.load = load; motorRef.current.setLoad(load); }
        }
      } else if (motorRef.current) { motorRef.current.stop(); motorRef.current = null; }
      if (t < g.chewUntil) mouth = Math.max(mouth, 0.3 * Math.abs(Math.sin(t * 9)));

      // ── 그리기 ──
      drawRoom(ctx, L, t);
      const ak = g.phase === 'arrive' ? easeOut((t - g.phaseT) / 0.9) : 1;
      const px = -S + (gx + S) * ak, hop = g.phase === 'arrive' ? -Math.abs(Math.sin((t - g.phaseT) * 9)) * S * 0.08 * (1 - ak) : 0;
      const happy = t < g.happyUntil;
      const oy = gy + hop + (happy ? -Math.abs(Math.sin(t * 6)) * S * 0.04 : 0);
      ctx.save(); ctx.translate(px, oy);
      drawPatient(ctx, p, S, t, happy, mouth);
      // 열: 빨간 볼·이마·땀방울. 열 시트를 붙이면 2.5초 동안 서서히 원래대로
      const heat = g.fever ? (g.sheet ? 1 - clamp01((t - g.sheetT) / 2.5) : 1) : 0;
      if (heat > 0) {
        ctx.fillStyle = `rgba(250,82,82,${0.32 * heat})`; [-1, 1].forEach(k => { ell(ctx, k * S * 0.17, (p.nose + 0.01) * S, S * 0.06, S * 0.04); ctx.fill(); });
        ctx.fillStyle = `rgba(250,82,82,${0.14 * heat})`; ell(ctx, 0, (FOREHEAD_Y + 0.02) * S, S * 0.16, S * 0.07); ctx.fill();
        const sy = ((t * 0.5) % 1) * S * 0.08;
        ctx.fillStyle = `rgba(116,192,252,${0.85 * heat})`; ctx.beginPath(); const sx = S * 0.2, s0 = (FOREHEAD_Y + 0.03) * S + sy;
        ctx.moveTo(sx, s0 - S * 0.03); ctx.quadraticCurveTo(sx + S * 0.022, s0, sx, s0 + S * 0.015); ctx.quadraticCurveTo(sx - S * 0.022, s0, sx, s0 - S * 0.03); ctx.fill();
      }
      if (g.sheet) { ctx.save(); ctx.translate(0, FOREHEAD_Y * S); drawSheet(ctx, S * 0.3); ctx.restore(); }
      else if (cur === 'sheet') { ctx.setLineDash([6, 5]); ctx.strokeStyle = `rgba(28,126,214,${0.6 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-S * 0.15, (FOREHEAD_Y - 0.063) * S, S * 0.3, S * 0.126, S * 0.044); ctx.stroke(); ctx.setLineDash([]); }
      if (cur === 'temp' && !(g.drag && g.drag.id === 'temp' && g.inEar != null)) [-1, 1].forEach(k => { const [ex, ey] = earOf(p, k); ctx.setLineDash([5, 4]); ctx.strokeStyle = `rgba(59,91,219,${0.55 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex * S, ey * S, S * 0.06, 0, TAU); ctx.stroke(); ctx.setLineDash([]); });
      if (cur === 'throat' && !g.lit) { ctx.setLineDash([5, 4]); ctx.strokeStyle = `rgba(250,176,5,${0.6 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, p.mouth * S, S * 0.07, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      // 콧물
      [-1, 1].forEach(k => {
        const v = g.snot[k < 0 ? 0 : 1]; if (v <= 0) return;
        const nx = k * S * (p.kid ? 0.022 : 0.026), ny = (p.nose + 0.012) * S, len = S * (0.025 + 0.055 * v) * (1 + Math.sin(t * 2 + k) * 0.08);
        ctx.fillStyle = 'rgba(192,235,117,0.92)';
        ctx.beginPath(); ctx.moveTo(nx - S * 0.012, ny); ctx.quadraticCurveTo(nx - S * 0.016, ny + len * 0.7, nx, ny + len); ctx.quadraticCurveTo(nx + S * 0.016, ny + len * 0.7, nx + S * 0.012, ny); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, nx - S * 0.004, ny + len * 0.65, S * 0.004, S * 0.008); ctx.fill();
      });
      // 상처·연고·밴드
      if (g.steps.includes('cream')) {
        const lx = w.x * S, ly = w.y * S;
        if (!g.band) {
          drawWound(ctx, lx, ly, S * 0.045, w.rot);
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; g.dabs.forEach(([dx, dy, r]) => { ell(ctx, dx * S, dy * S, r * S, r * S * 0.75); ctx.fill(); });
          if (g.cream > 0) { ctx.fillStyle = `rgba(255,255,255,${0.55 * g.cream})`; ell(ctx, lx, ly, S * 0.065, S * 0.05, w.rot); ctx.fill(); }
          if (cur === 'band') { ctx.save(); ctx.translate(lx, ly); ctx.rotate(w.rot); ctx.setLineDash([6, 5]); ctx.strokeStyle = `rgba(247,131,172,${0.6 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-w.len * S / 2, -S * 0.04, w.len * S, S * 0.08, S * 0.04); ctx.stroke(); ctx.restore(); }
        } else { ctx.save(); ctx.translate(lx, ly); ctx.rotate(w.rot); drawBandage(ctx, w.len * S, S * 0.075); ctx.restore(); }
      }
      // 손에 쥔 사탕 (손을 흔들면 같이 흔들린다) / 쥐여 줄 자리
      {
        const [ax, ay, aa] = handOf(p, t, happy);
        if (g.candy) { ctx.save(); ctx.translate(ax * S, ay * S); ctx.rotate(aa + 1.2); drawCandy(ctx, S * 0.3, t); ctx.restore(); }
        else if (cur === 'candy') { const pr = S * (0.1 + Math.sin(t * 5) * 0.008); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(240,101,149,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax * S, ay * S, pr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      }
      // 청진기 자리
      if (cur === 'steth') {
        STETH_SPOTS.forEach(([sx, sy], i) => {
          if (g.beats[i]) { drawHeart(ctx, sx * S, sy * S, S * 0.035, '#ff6b6b'); return; }
          const pr = S * (0.055 + Math.sin(t * 5 + i) * 0.006);
          ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,107,107,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx * S, sy * S, pr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, sx * S, sy * S, pr, pr); ctx.fill();
        });
      }
      ctx.restore();

      // 잰 체온 (다 나을 때까지 머리 옆에)
      if (g.tempShown && g.phase !== 'done') {
        const bx = gx - S * 0.72, by = gy - S * 1.2, txt = `${g.temp.toFixed(1)}℃`, hot = g.fever && !g.sheet;
        ctx.save(); ctx.font = `${Math.max(16, S * 0.09)}px ${JUA}`; const tw = ctx.measureText(txt).width + S * 0.12;
        shadowOn(ctx, 8, 3, 'rgba(0,0,0,0.18)'); ctx.fillStyle = hot ? '#ffe3e3' : '#ebfbee'; ctx.beginPath(); ctx.roundRect(bx - tw / 2, by - S * 0.07, tw, S * 0.14, S * 0.07); ctx.fill(); shadowOff(ctx);
        ctx.fillStyle = hot ? '#e03131' : '#2b8a3e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx, by + S * 0.005);
        ctx.restore();
      }
      // 손전등을 비추면 목 속을 크게 보여 준다
      if (cur === 'throat' && g.throat > 0.05 && g.lit) drawThroatView(ctx, Math.max(S * 0.25, gx - S * 0.8), gy - S * 0.62, S * 0.2, g.fever, g.throat * 4);

      // 말풍선: 지금 쓸 도구
      if (g.phase === 'treat' && cur && !g.drag) {
        const bx = gx + S * 0.62, by = gy - S * 1.12, br = S * 0.2, bob = Math.sin(t * 3) * 4;
        ctx.save(); shadowOn(ctx, 10, 3, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = '#ffffff'; ell(ctx, bx, by + bob, br * 1.2, br); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - br * 0.6, by + bob + br * 0.6); ctx.lineTo(bx - br * 1.0, by + bob + br * 1.2); ctx.lineTo(bx - br * 0.1, by + bob + br * 0.85); ctx.fill(); shadowOff(ctx);
        drawToolIcon(ctx, cur, bx, by + bob, br * 1.35, t);
        ctx.restore();
      }

      // 콧물 기계
      if (cur === 'nose') {
        const { mx, my, ms, nz } = L;
        const fill = clamp01((2 - g.snot[0] - g.snot[1]) / 2);
        ctx.save(); ctx.translate(mx, my); drawMachine(ctx, ms, g.power, t); ctx.restore();
        // 노즐 자리·노즐
        let tipX = L.nzRest[0], tipY = L.nzRest[1], ang = -0.12;
        if (g.drag && g.drag.id === 'nose') {
          if (g.inNose != null) { const [nx, ny] = nostril(g.inNose); tipX = nx + g.inNose * S * 0.004; tipY = ny - S * 0.012; ang = g.inNose * 0.38 + Math.sin(t * 40) * 0.01; }
          else { [tipX, tipY] = hotOf(g, g.drag.x, g.drag.y); ang = 0; }
        }
        const baseX = tipX - Math.sin(ang) * nz * 0.62, baseY = tipY + Math.cos(ang) * nz * 0.62;
        const hx0 = mx, hy0 = my + MACHINE_DIAL_Y * ms;   // 호스는 다이얼 가운데에서 나온다
        ctx.strokeStyle = 'rgba(108,192,232,0.85)'; ctx.lineWidth = Math.max(4, nz * 0.055); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx0, hy0);
        ctx.bezierCurveTo(hx0 - ms * 0.1, my + ms * 0.35, baseX + (mx - baseX) * 0.2, Math.max(baseY, my) + ms * 0.45, baseX, baseY); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(1.5, nz * 0.02); ctx.stroke();
        if (!g.power || !(g.drag && g.drag.id === 'nose')) {   // 노즐을 잡으라고 반짝
          if (g.power) { ctx.fillStyle = `rgba(255,212,59,${0.3 + Math.sin(t * 6) * 0.2})`; ell(ctx, L.nzRest[0], L.nzRest[1] + nz * 0.3, nz * 0.28, nz * 0.45); ctx.fill(); }
        }
        ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(ang); drawNozzle(ctx, nz, fill); ctx.restore();
        if (g.inNose != null && Math.random() < 0.5) g.parts.push({ kind: 'drop', x: tipX, y: tipY + nz * 0.25, vx: (Math.random() - 0.5) * 20, vy: 60, born: t, life: 0.35, col: 'rgba(192,235,117,0.9)', r: S * 0.008 });
      }

      // 도구 칸
      L.tiles.forEach(q => {
        const active = cur === q.id, done = g.steps.indexOf(q.id) >= 0 && g.steps.indexOf(q.id) < g.si, need = g.steps.includes(q.id);
        ctx.save();
        ctx.fillStyle = active ? '#fff3bf' : '#f8f9fa';
        if (active) { ctx.shadowColor = 'rgba(250,176,5,0.8)'; ctx.shadowBlur = 16 + Math.sin(t * 5) * 6; }
        ctx.beginPath(); ctx.roundRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s, q.s * 0.22); ctx.fill(); shadowOff(ctx);
        if (active) { ctx.strokeStyle = '#fab005'; ctx.lineWidth = 3; ctx.stroke(); }
        const held = g.drag && g.drag.id === q.id && q.id !== 'nose';
        ctx.globalAlpha = held ? 0.25 : active || g.phase !== 'treat' ? 1 : need && !done ? 0.55 : 0.35;
        const bob = active && !held ? -Math.abs(Math.sin(t * 4)) * q.s * 0.05 : 0;
        drawToolIcon(ctx, q.id, q.x, q.y + bob, q.s * 0.86, t, q.id === 'temp' && g.tempShown ? { text: g.temp.toFixed(1), col: g.fever ? '#ffa8a8' : '#8ce99a' } : null);
        ctx.globalAlpha = 1;
        if (done) { ctx.fillStyle = '#40c057'; ell(ctx, q.x + q.s * 0.38, q.y - q.s * 0.38, q.s * 0.13, q.s * 0.13); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = q.s * 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x + q.s * 0.32, q.y - q.s * 0.38); ctx.lineTo(q.x + q.s * 0.37, q.y - q.s * 0.33); ctx.lineTo(q.x + q.s * 0.45, q.y - q.s * 0.44); ctx.stroke(); }
        ctx.fillStyle = active ? '#e67700' : '#868e96'; ctx.font = `${Math.max(12, q.s * 0.16)}px ${JUA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const fs = Math.max(12, q.s * 0.16);
        if (L.trayH - q.s > fs * 1.6) ctx.fillText(TOOL_NAME[q.id], q.x, q.y + q.s / 2 + fs * 1.05);
        ctx.restore();
      });

      // 손에 든 도구
      if (g.drag && g.drag.id !== 'nose') {
        const [hx, hy] = hotOf(g, g.drag.x, g.drag.y), s = L.tile * 1.1;
        ctx.save(); ctx.translate(hx, hy);
        if (g.drag.id === 'steth') drawSteth(ctx, s);
        else if (g.drag.id === 'temp') {
          const lcd = g.inEar != null ? { text: Math.floor(t * 4) % 2 ? '- - -' : ' ', col: '#b2f2bb' } : null;
          if (g.inEar != null) { const [ex, ey] = ear(g.inEar); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ex, ey); ctx.rotate(g.inEar < 0 ? 1.2 : -1.2); }
          drawThermo(ctx, s * 1.1, lcd);
        }
        else if (g.drag.id === 'sheet') { ctx.rotate(Math.sin(t * 4) * 0.06); drawSheet(ctx, S * 0.3); }
        else if (g.drag.id === 'throat') {
          if (g.lit) {   // 입으로 빛줄기
            const [mx, my] = at(0, p.mouth);
            ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const ang = Math.atan2(my - hy, mx - hx), sp = S * 0.09;
            ctx.fillStyle = lg(ctx, hx, hy, mx, my, [[0, 'rgba(255,249,196,0.75)'], [1, 'rgba(255,249,196,0.15)']]);
            ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(mx - Math.sin(ang) * sp, my + Math.cos(ang) * sp); ctx.lineTo(mx + Math.sin(ang) * sp, my - Math.cos(ang) * sp); ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.rotate(Math.atan2(my - hy, mx - hx) + Math.PI / 2);
          }
          drawPenlight(ctx, s, g.lit);
        }
        else if (g.drag.id === 'cream') { const near = Math.hypot(hx - wx, hy - wy) < S * 0.14; ctx.rotate(near ? Math.sin(t * 12) * 0.1 : 0); drawCream(ctx, s, near ? 1 : 0.6); }
        else if (g.drag.id === 'band') { ctx.rotate(w.rot); drawBandage(ctx, w.len * S, S * 0.075); }
        else if (g.drag.id === 'candy') { ctx.rotate(-0.25 + Math.sin(t * 6) * 0.08); drawCandy(ctx, S * 0.3, t); }
        ctx.restore();
      }

      // 반짝이·하트
      g.parts = g.parts.filter(q => t - q.born < q.life);
      g.parts.forEach(q => {
        const e = t - q.born, k = e / q.life;
        q.x += q.vx * dt; q.y += q.vy * dt; if (q.kind !== 'drop') q.vy += 120 * dt * (q.big ? 0 : 1);
        ctx.save(); ctx.globalAlpha = 1 - k;
        if (q.kind === 'heart') drawHeart(ctx, q.x, q.y, q.r * (q.big ? 1 + k * 0.6 : 1), q.col);
        else if (q.kind === 'star') drawStar(ctx, q.x, q.y, q.r, q.col, q.rot + e * 3);
        else { ctx.fillStyle = q.col; ell(ctx, q.x, q.y, q.r, q.r * 1.2); ctx.fill(); }
        ctx.restore();
      });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); if (motorRef.current) { motorRef.current.stop(); motorRef.current = null; } };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const p = HOSPITAL_PATIENTS.find(q => q.id === ui.pid) || HOSPITAL_PATIENTS[0];
  const cur = ui.phase === 'treat' ? ui.steps[ui.si] : null;
  const hint = cur ? HINT[cur === 'nose' && !ui.power ? 'nosePower' : cur] : null;
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(20,80,60,0.6)', whiteSpace: 'nowrap' });
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={newPatient} style={btn('#e6fcf5', '#087f5b')}>🙋 다른 친구</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#087f5b', minWidth: '160px' }}>🏥 {p.emoji} {p.name} 진료 중</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {ui.steps.map((id, i) => (
            <span key={id} style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
              background: i < ui.si ? '#d3f9d8' : i === ui.si && ui.phase === 'treat' ? '#fff3bf' : '#f1f3f5', boxShadow: i === ui.si && ui.phase === 'treat' ? '0 0 0 3px #fab005' : 'none', opacity: i <= ui.si ? 1 : 0.55 }}>
              {i < ui.si ? '✅' : TOOL_EMOJI[id]}
            </span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(8,127,91,0.55)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: 0, right: 0, top: '12px', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.25rem', color: '#0b7285', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
        {ui.phase === 'done' && (
          <div style={{ position: 'absolute', right: '3%', top: ui.land ? '38%' : '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#e64980', textShadow: '0 3px 0 #fff' }}>🎉 다 나았어요!</div>
            <button onClick={newPatient} style={btn('#20c997')}>🙋 다음 친구 진료하기</button>
          </div>
        )}
      </div>
    </div>
  );
}
