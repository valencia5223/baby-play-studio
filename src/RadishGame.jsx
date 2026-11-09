// ═════════════════════════════════════════════════════════════════════════════
// 🌱 무 뽑기 체험: 유나가 밭에서 무를 뽑는다
//  - 흐름: 무를 콕 → 유나가 걸어가 쪼그려 잎을 잡음 → 손가락을 위로 끌면(또는 톡톡) 유나가 뒤로 젖히며 영차,
//    좌우로 흔들면 더 잘 빠짐 → 쑥! 엉덩방아 → 흙을 문질러 털기 → 콕 눌러 바구니에 → 다섯 개 다 뽑으면 새 밭
//  - 왕무(맨 오른쪽)는 혼자서는 안 빠진다: '커다란 순무'처럼 엄마·아빠·강아지·고양이·생쥐를 차례로 불러 줄줄이 당긴다
//    (radishData.js 의 GIANT_CAPS: 도와주는 친구 수별로 뽑힐 수 있는 한계)
//  - 사람(유나·엄마·아빠)은 관절 인형: rigOf 가 엉덩이·기울기·발·손 목표로 무릎·팔꿈치를 계산(IK)하고 drawPerson 이 그린다.
//    잎을 쥔 손 위치를 먼저 구해서 무 잎이 그 손으로 모이게 그린다
//  - 강아지·고양이 그림은 내 목장(FarmGame.jsx)의 drawAnimal 을 빌려 쓴다
//  - 캔버스 한 장 + 카메라(z 배율): 고를 땐 밭 전체, 당길 땐 유나 쪽으로 다가간다
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { drawAnimal } from './FarmGame.jsx';
import { FARM_BY_ID } from './farmData.js';
import { RADISH_SIZES, RADISH_HELPERS, GIANT_CAPS, newField, loadRadishStats, saveRadishStats } from './radishData.js';
import { VOICE } from './voiceLines.js';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hex3 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => { const A = hex3(a), B = hex3(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
const shade = (h, k = 0.18) => mix(h, '#000000', k);
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

// 밭의 무 자리 (화면 너비 비율). 마지막이 왕무
const SLOT_U = [0.13, 0.29, 0.45, 0.61, 0.84];

// ───────────────────────────── 사람 (관절 인형) ─────────────────────────────
// 비율은 키(S) 기준. leg = 엉덩이 높이, torso = 엉덩이~어깨, headR = 머리 반지름
// 유나는 아기 체형: 머리가 키의 3분의 1 남짓으로 크고, 다리·팔은 짧고 통통하다
const KID = { leg: 0.34, torso: 0.28, neck: 0.01, headR: 0.18, shW: 0.1, hipW: 0.05, upper: 0.12, fore: 0.115, limbW: 0.074, hipHalf: 0.13, shHalf: 0.1, eye: 1, baby: true };
const ADULT = { leg: 0.47, torso: 0.3, neck: 0.03, headR: 0.1, shW: 0.08, hipW: 0.04, upper: 0.17, fore: 0.165, limbW: 0.056, hipHalf: 0.085, shHalf: 0.1, eye: 0.85 };
export const LOOKS = {
  yuna: { id: 'yuna', P: KID, skin: '#ffe1c8', skinEdge: '#f7c9a6', hair: '#3b2a20', hairHi: '#6e4c37', style: 'pigtail', hat: null,
    shirt: '#fff4b0', shirtDot: '#ffd43b', pants: '#78acdf', boots: '#ff8fb1', gloves: null, lashes: false },
  mom: { id: 'mom', P: ADULT, skin: '#ffe0c4', skinEdge: '#f2c4a0', hair: '#4a2f22', hairHi: '#7a5240', style: 'pony', hat: null,
    shirt: '#ffb3b3', pants: '#9c7a5b', apron: '#b9e8a8', boots: '#8a6143', gloves: '#ffffff', lashes: true },
  dad: { id: 'dad', P: ADULT, skin: '#f8d7b8', skinEdge: '#e8b893', hair: '#1f1a17', hairHi: '#3d3530', style: 'short', hat: 'cap', capCol: '#37a24b',
    shirt: '#7cc0f5', plaid: true, pants: '#3f5f8a', boots: '#5c4033', gloves: '#c9ced6', lashes: false }
};

// 두 마디 팔다리 IK: a 에서 b 로 뻗을 때 가운데 관절. sign 으로 굽는 쪽 (무릎 -1 = 앞, 팔꿈치 +1 = 아래)
function ik(ax, ay, bx, by, l1, l2, sign) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-6;
  const max = (l1 + l2) * 0.999;
  if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; dx = bx - ax; dy = by - ay; d = max; }
  const dd = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  return [ax + ux * a - uy * h * sign, ay + uy * a + ux * h * sign, bx, by];
}

// 자세(st)로 관절 위치 계산. 좌표는 발 사이 바닥이 원점, 오른쪽(+x)을 보는 기준
// st: { S, hipX, hipY, lean(+ 면 앞으로 숙임), feet:[[x,y]×2], hands:[[x,y]×2], handsRel(어깨 기준) }
export function rigOf(look, st) {
  const P = look.P, S = st.S, legL = P.leg * S, lean = st.lean || 0, cs = Math.cos(lean), sn = Math.sin(lean);
  const hx = st.hipX || 0, hy = st.hipY ?? -legL * 0.97;
  const R = (x, y) => [hx + x * cs - y * sn, hy + x * sn + y * cs];
  const ank = S * 0.03, th = (legL - ank) * 0.52, sh = (legL - ank) * 0.5, T = P.torso * S;
  const legs = [R(-P.hipW * S, 0), R(P.hipW * S, 0)].map(([ax, ay], i) => {
    const [fx, fy] = st.feet[i];
    const [kx, ky, ex, ey] = ik(ax, ay, fx, fy - ank, th, sh, -1);
    return { ax, ay, kx, ky, fx: ex, fy: ey };
  });
  const shoulders = [R(-P.shW * S, -T * 0.88), R(P.shW * S * 0.9, -T * 0.88)];
  const arms = shoulders.map(([ax, ay], i) => {
    let [tx, ty] = st.hands[i];
    if (st.handsRel) { tx += ax; ty += ay; }
    const [ex, ey, hx2, hy2] = ik(ax, ay, tx, ty, P.upper * S, P.fore * S, 1);
    return { ax, ay, ex, ey, hx: hx2, hy: hy2 };
  });
  return { S, P, lean, hip: [hx, hy], legs, arms, head: R(0, -T - P.neck * S - P.headR * S), waist: R(-P.hipHalf * S * 0.9, -T * 0.32) };
}

// 자세 만들기
export function pose(kind, look, S, o = {}) {
  const P = look.P, legL = P.leg * S, t = o.t || 0, reach = (P.upper + P.fore) * S;
  if (kind === 'walk') {
    const ph = o.phase || 0, sw = Math.sin(ph), stp = 0.09 * S;
    return { S, hipY: -legL * 0.95 - Math.abs(Math.cos(ph)) * 0.012 * S, lean: 0.07,
      feet: [[-sw * stp, -Math.max(0, -Math.cos(ph)) * 0.04 * S], [sw * stp, -Math.max(0, Math.cos(ph)) * 0.04 * S]],
      hands: [[sw * 0.09 * S - 0.02 * S, reach * 0.9], [-sw * 0.09 * S + 0.02 * S, reach * 0.9]], handsRel: true };
  }
  if (kind === 'cheer') {
    const b = Math.abs(Math.sin(t * 7)) * 0.05 * S, w = Math.sin(t * 7) * 0.04 * S;
    return { S, hipY: -legL * 0.97 - b, lean: -0.05, feet: [[-0.07 * S, -b], [0.07 * S, -b]],
      hands: [[-0.07 * S - w, -reach * 0.9], [0.07 * S + w, -reach * 0.9]], handsRel: true };
  }
  if (kind === 'watch') {
    const br = Math.sin(t * 2) * 0.004 * S;
    return { S, hipY: -legL * 0.97 + br, lean: 0.08, feet: [[-0.06 * S, 0], [0.07 * S, 0]], hands: [[0.16 * S, 0.15 * S], [-0.03 * S, 0.15 * S]], handsRel: true };
  }
  if (kind === 'fall') {
    const k = o.k ?? 1, kick = Math.sin(t * 13) * 0.03 * S * k;
    return { S, hipX: -0.1 * S * k, hipY: lerp(-legL * 0.9, -0.075 * S, k), lean: -0.42 * k,
      feet: [[lerp(-0.06 * S, legL * 0.62, k), -0.02 * S * k], [lerp(0.06 * S, legL * 0.8, k), -0.1 * S * k + kick]],
      hands: [[-0.16 * S, -reach * 0.55 * k + reach * 0.6 * (1 - k)], [0.16 * S, -reach * 0.75 * k + reach * 0.6 * (1 - k)]], handsRel: true };
  }
  // stand
  const sw = Math.sin(t * 1.6) * 0.008 * S;
  return { S, hipY: -legL * 0.99, lean: 0.02, feet: [[-0.065 * S, 0], [0.065 * S, 0]], hands: [[-0.035 * S + sw, reach * 0.9], [0.035 * S - sw, reach * 0.9]], handsRel: true };
}

// 잡아당기는 자세: 손은 hands(로컬 절대 좌표)로, F(0~1) 가 클수록 뒤로 젖힌다
function pullPose(look, S, F, t, hands) {
  const legL = look.P.leg * S, tr = Math.sin(t * 43) * 0.004 * S * F;
  return { S, hipX: -0.02 * S - 0.06 * S * F + tr, hipY: -legL * (0.78 - 0.1 * F), lean: lerp(0.38, -0.32, F),
    feet: [[-0.12 * S - 0.03 * S * F, 0], [0.11 * S + 0.04 * S * F, 0]], hands };
}

function strokeLimb(c, pts, w, col, ol) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = ol; c.lineWidth = w + Math.max(1.6, w * 0.16) * 2; c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}

function drawLeg(c, L, g, S, back) {
  const P = L.P, w = P.limbW * S * 1.08, pants = back ? shade(L.pants, 0.14) : L.pants, boots = back ? shade(L.boots, 0.14) : L.boots;
  strokeLimb(c, [g.ax, g.ay, g.kx, g.ky, g.fx, g.fy], w, pants, shade(L.pants, 0.35));
  // 장화: 정강이 아래 절반
  const bx = lerp(g.kx, g.fx, L.id === 'yuna' ? 0.42 : 0.6), by = lerp(g.ky, g.fy, L.id === 'yuna' ? 0.42 : 0.6);
  strokeLimb(c, [bx, by, g.fx, g.fy], w * 1.18, boots, shade(L.boots, 0.35));
  const fl = (L.id === 'yuna' ? 0.06 : 0.045) * S, fh = (L.id === 'yuna' ? 0.034 : 0.025) * S;
  const ang = Math.atan2(g.fy - g.ky, g.fx - g.kx) - Math.PI / 2;   // 발은 정강이에 수직
  c.save(); c.translate(g.fx, g.fy); c.rotate(ang * 0.8);
  ell(c, fl * 0.45, fh * 0.55, fl, fh); c.fillStyle = boots; c.fill(); c.strokeStyle = shade(L.boots, 0.35); c.lineWidth = Math.max(1.2, S * 0.006); c.stroke();
  c.fillStyle = shade(L.boots, 0.4); rr(c, -fl * 0.55, fh * 1.05, fl * 2, fh * 0.45, fh * 0.2); c.fill();   // 밑창
  if (L.id === 'yuna' && !back) { c.fillStyle = 'rgba(255,255,255,0.55)'; ell(c, fl * 0.1, -fh * 0.1, fl * 0.3, fh * 0.28, -0.3); c.fill(); }
  c.restore();
  if (L.id === 'yuna') {   // 장화 입구 테
    c.strokeStyle = back ? shade('#ffffff', 0.12) : '#ffffff'; c.lineWidth = Math.max(1.5, S * 0.012); c.lineCap = 'round';
    const nx = -(g.fy - g.ky), ny = g.fx - g.kx, nl = Math.hypot(nx, ny) || 1;
    c.beginPath(); c.moveTo(bx - nx / nl * w * 0.62, by - ny / nl * w * 0.62); c.lineTo(bx + nx / nl * w * 0.62, by + ny / nl * w * 0.62); c.stroke();
  }
}

function drawArm(c, L, a, S, back) {
  const P = L.P, w = P.limbW * S * 0.9, skin = back ? shade(L.skin, 0.1) : L.skin, shirt = back ? shade(L.shirt, 0.12) : L.shirt;
  strokeLimb(c, [a.ax, a.ay, a.ex, a.ey, a.hx, a.hy], w, skin, shade(L.skinEdge, 0.25));
  const sx = lerp(a.ax, a.ex, L.id === 'yuna' ? 0.3 : 1), sy = lerp(a.ay, a.ey, L.id === 'yuna' ? 0.3 : 1);
  if (L.id === 'yuna') strokeLimb(c, [a.ax, a.ay, sx, sy], w * 1.22, shirt, shade(L.shirt, 0.3));
  else strokeLimb(c, [a.ax, a.ay, a.ex, a.ey, lerp(a.ex, a.hx, 0.55), lerp(a.ey, a.hy, 0.55)], w * 1.15, shirt, shade(L.shirt, 0.3));   // 어른은 긴소매
  // 장갑
  if (!L.gloves) {   // 아기 손: 동글동글 맨손
    const hr = P.limbW * S * 0.62;
    ell(c, a.hx, a.hy, hr, hr); c.fillStyle = skin; c.fill(); c.strokeStyle = shade(L.skinEdge, 0.25); c.lineWidth = Math.max(1.2, S * 0.006); c.stroke();
    return;
  }
  const gr = (L.id === 'yuna' ? 0.045 : 0.032) * S, gl = back ? shade(L.gloves, 0.12) : L.gloves, ang = Math.atan2(a.hy - a.ey, a.hx - a.ex);
  c.save(); c.translate(a.hx, a.hy); c.rotate(ang);
  c.fillStyle = gl; c.strokeStyle = shade(L.gloves, 0.35); c.lineWidth = Math.max(1.2, S * 0.006);
  ell(c, 0, 0, gr * 1.1, gr); c.fill(); c.stroke();
  ell(c, gr * 0.2, -gr * 0.85, gr * 0.42, gr * 0.3, -0.5); c.fill(); c.stroke();   // 엄지
  c.fillStyle = L.id === 'yuna' ? '#7bc96f' : shade(L.gloves, 0.2); rr(c, -gr * 1.35, -gr * 0.85, gr * 0.5, gr * 1.7, gr * 0.2); c.fill();   // 소매 고무단
  c.restore();
}

function drawTorso(c, L, S, t) {
  const P = L.P, T = P.torso * S, hw = P.hipHalf * S, sw = P.shHalf * S;
  const body = () => {
    c.beginPath(); c.moveTo(-sw, -T);
    c.quadraticCurveTo(-hw * 1.18, -T * 0.45, -hw, S * 0.02);
    c.quadraticCurveTo(0, S * 0.055, hw, S * 0.02);
    c.quadraticCurveTo(hw * 1.18, -T * 0.45, sw, -T);
    c.quadraticCurveTo(0, -T - S * 0.03, -sw, -T); c.closePath();
  };
  // 목
  c.fillStyle = L.skin; rr(c, -S * 0.025, -T - P.neck * S - S * 0.02, S * 0.05, P.neck * S + S * 0.04, S * 0.015); c.fill();
  body(); c.fillStyle = L.shirt; c.fill();
  c.save(); body(); c.clip();
  if (L.id === 'yuna') {
    c.fillStyle = L.shirtDot; for (let i = 0; i < 9; i++) { ell(c, -sw + (i % 3) * sw * 0.9 + (Math.floor(i / 3) % 2) * sw * 0.45, -T * 0.92 + Math.floor(i / 3) * T * 0.17, S * 0.011, S * 0.011); c.fill(); }
    // 멜빵바지
    c.fillStyle = L.pants; c.fillRect(-hw * 1.3, -T * 0.4, hw * 2.6, T * 0.6);
    rr(c, -S * 0.07, -T * 0.8, S * 0.14, T * 0.45, S * 0.02); c.fill();
    c.strokeStyle = shade(L.pants, 0.25); c.lineWidth = Math.max(1, S * 0.005); c.setLineDash([S * 0.012, S * 0.01]);
    rr(c, -S * 0.058, -T * 0.77, S * 0.116, T * 0.4, S * 0.015); c.stroke(); c.setLineDash([]);
    c.strokeStyle = L.pants; c.lineWidth = S * 0.032; c.lineCap = 'round';
    [-1, 1].forEach(sd => { c.beginPath(); c.moveTo(sd * S * 0.055, -T * 0.78); c.lineTo(sd * sw * 0.8, -T * 1.02); c.stroke(); });
    c.fillStyle = '#ffd43b'; [-1, 1].forEach(sd => { ell(c, sd * S * 0.052, -T * 0.74, S * 0.014, S * 0.014); c.fill(); });
    // 주머니에 꽃 한 송이
    c.fillStyle = shade(L.pants, 0.1); rr(c, -S * 0.04, -T * 0.6, S * 0.08, T * 0.17, S * 0.012); c.fill();
    const fx = S * 0.012, fy = -T * 0.62;
    c.fillStyle = '#ff8fab'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t * 0.2; ell(c, fx + Math.cos(a) * S * 0.012, fy + Math.sin(a) * S * 0.012, S * 0.009, S * 0.009); c.fill(); }
    c.fillStyle = '#ffd43b'; ell(c, fx, fy, S * 0.007, S * 0.007); c.fill();
  } else if (L.id === 'mom') {
    c.fillStyle = L.apron; rr(c, -S * 0.055, -T * 0.82, S * 0.11, T * 0.9, S * 0.015); c.fill();
    c.fillStyle = shade(L.apron, 0.1); rr(c, -S * 0.035, -T * 0.4, S * 0.07, T * 0.18, S * 0.01); c.fill();
  } else {
    c.strokeStyle = 'rgba(30,80,140,0.28)'; c.lineWidth = S * 0.012;
    for (let x = -hw * 1.4; x < hw * 1.4; x += S * 0.04) { c.beginPath(); c.moveTo(x, -T * 1.1); c.lineTo(x, S * 0.05); c.stroke(); }
    for (let y = -T; y < S * 0.05; y += S * 0.04) { c.beginPath(); c.moveTo(-hw * 1.4, y); c.lineTo(hw * 1.4, y); c.stroke(); }
    c.fillStyle = '#6b4a2b'; c.fillRect(-hw * 1.3, -S * 0.015, hw * 2.6, S * 0.03);
    c.fillStyle = '#e0b84a'; c.fillRect(-S * 0.012, -S * 0.017, S * 0.024, S * 0.034);
  }
  c.restore();
  if (L.id === 'mom') {   // 앞치마 아래쪽 (허벅지를 덮는 치마)
    c.fillStyle = L.apron; c.beginPath(); c.moveTo(-hw * 0.95, 0); c.lineTo(hw * 0.95, 0); c.lineTo(hw * 1.15, S * 0.15); c.quadraticCurveTo(0, S * 0.17, -hw * 1.15, S * 0.15); c.closePath(); c.fill();
    c.strokeStyle = shade(L.apron, 0.2); c.lineWidth = Math.max(1, S * 0.004); c.stroke();
  }
  body(); c.strokeStyle = shade(L.shirt, 0.3); c.lineWidth = Math.max(1.3, S * 0.006); c.stroke();
  if (L.id === 'yuna') { c.fillStyle = '#ffffff'; ell(c, 0, -T + S * 0.004, S * 0.05, S * 0.018); c.fill(); }   // 옷깃
}

// 얼굴: face = smile | strain | wow | laugh | ouch, blush 0~1
function drawHead(c, L, r, face, t, blush) {
  const fx = 0.16 * r, ek = L.P.eye, lw = Math.max(1.3, r * 0.07), baby = !!L.P.baby;
  const sway = Math.sin(t * 3.1) * 0.1;
  c.fillStyle = L.hair;
  // 뒷머리 · 묶은 머리
  if (L.style === 'pigtail') {
    [-1, 1].forEach(sd => {
      // 머리 옆에 몽글몽글 묶은 아기 양갈래 (털 뭉치 세 개)
      c.save(); c.translate(sd * r * 0.86 + fx * 0.2, -r * 0.42); c.rotate(sd * 0.5 + sway * 0.5);
      c.fillStyle = L.hair;
      [[0, 0, 0.24], [sd * 0.16, 0.16, 0.18], [sd * 0.2, -0.12, 0.16]].forEach(([dx, dy, rad]) => { ell(c, dx * r + sd * r * 0.12, dy * r, rad * r, rad * r * 1.1); c.fill(); });
      c.strokeStyle = L.hairHi; c.lineWidth = lw * 0.7; c.beginPath(); c.arc(sd * r * 0.12, 0, r * 0.15, sd > 0 ? -1.2 : 2.0, sd > 0 ? -0.2 : 3.0); c.stroke();
      c.restore();
    });
  } else if (L.style === 'pony') {
    c.save(); c.translate(-r * 0.9, -r * 0.2); c.rotate(0.3 + sway);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-r * 0.55, r * 0.1, -r * 0.4, r * 0.9, -r * 0.05, r * 1.05); c.bezierCurveTo(r * 0.05, r * 0.7, r * 0.2, r * 0.2, 0, 0); c.fill();
    c.restore();
  }
  ell(c, fx * 0.1, -r * 0.06, r * 1.05, r * 1.02); c.fill();
  // 귀
  c.fillStyle = L.skin; ell(c, -r * 0.93 + fx * 0.4, r * 0.12, r * 0.15, r * 0.2); c.fill();
  // 얼굴
  const gr = c.createRadialGradient(fx - r * 0.25, -r * 0.25, r * 0.1, fx * 0.2, 0, r * 1.05);
  gr.addColorStop(0, mix(L.skin, '#ffffff', 0.25)); gr.addColorStop(0.75, L.skin); gr.addColorStop(1, L.skinEdge);
  ell(c, fx * 0.18, baby ? r * 0.03 : 0, baby ? r * 1.05 : r, r * 0.97); c.fillStyle = gr; c.fill();   // 아기는 볼이 통통하게 옆으로
  if (blush > 0.05) { ell(c, fx * 0.18, 0, r, r * 0.97); c.fillStyle = `rgba(255,90,90,${blush * 0.16})`; c.fill(); }
  // 앞머리
  c.fillStyle = L.hair;
  if (L.style === 'short') {
    c.beginPath(); c.moveTo(-r * 0.98, -r * 0.05); c.bezierCurveTo(-r * 1.05, -r * 1.2, r * 1.05, -r * 1.25, r * 0.98, -r * 0.1);
    c.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.2, -r * 0.5); c.quadraticCurveTo(-r * 0.3, -r * 0.62, -r * 0.75, -r * 0.4); c.quadraticCurveTo(-r * 0.9, -r * 0.25, -r * 0.98, -r * 0.05); c.fill();
  } else {
    c.beginPath(); c.moveTo(-r * 0.99, r * 0.05); c.bezierCurveTo(-r * 1.08, -r * 1.2, r * 1.08, -r * 1.22, r * 0.99, r * 0.0);
    const xs = [0.99, 0.62, 0.25, -0.12, -0.5, -0.85], ys = baby ? -0.46 : -0.42;   // 아기는 이마가 넓고 앞머리가 짧다
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1];
      c.quadraticCurveTo(r * (xa + xb) / 2 + fx * 0.3, r * (ys + 0.17), r * xb + fx * 0.2, r * (ys - (i % 2) * 0.05));
    }
    c.quadraticCurveTo(-r * 0.97, -r * 0.2, -r * 0.99, r * 0.05); c.fill();
    c.strokeStyle = L.hairHi; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath(); c.arc(fx * 0.2, -r * 0.1, r * 0.82, Math.PI * 1.25, Math.PI * 1.45); c.stroke();
  }
  // 눈썹
  const ex = [(-0.36 + 0.16) * r, (0.36 + 0.16) * r], ey = r * (baby ? 0.2 : 0.08);   // 아기는 눈이 얼굴 아래쪽
  c.strokeStyle = shade(L.hair, -0.1); c.lineWidth = lw * 0.9; c.lineCap = 'round';
  if (!baby || face === 'strain' || face === 'ouch') ex.forEach((x, i) => {
    const sd = i ? 1 : -1, by = ey - r * (face === 'wow' ? 0.36 : 0.27);
    c.beginPath();
    if (face === 'strain' || face === 'ouch') { c.moveTo(x - sd * r * 0.13, by - r * 0.03); c.lineTo(x + sd * r * 0.12, by + r * 0.05 * -1 + r * 0.02); c.moveTo(x + sd * r * 0.13, by - r * 0.06); c.lineTo(x - sd * r * 0.1, by + r * 0.04); }
    else c.arc(x, by + r * 0.1, r * 0.13 * ek, Math.PI * 1.2, Math.PI * 1.8);
    c.stroke();
  });
  // 눈
  const blink = (t % 3.7) < 0.12;
  c.fillStyle = '#2b1d16'; c.strokeStyle = '#2b1d16'; c.lineWidth = lw * 1.1;
  ex.forEach((x, i) => {
    const sd = i ? 1 : -1;
    if (face === 'strain' || face === 'ouch') {   // > <
      c.beginPath(); c.moveTo(x - sd * r * 0.12, ey - r * 0.1); c.lineTo(x + sd * r * 0.08, ey); c.lineTo(x - sd * r * 0.12, ey + r * 0.1); c.stroke();
    } else if (face === 'laugh' || (blink && face !== 'wow')) {
      c.beginPath(); c.arc(x, ey + r * 0.06, r * 0.12 * ek, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    } else {
      const big = face === 'wow' ? 1.25 : 1;
      ell(c, x, ey, r * 0.1 * ek * big, r * 0.135 * ek * big); c.fillStyle = '#2b1d16'; c.fill();
      c.fillStyle = '#ffffff'; ell(c, x + r * 0.035, ey - r * 0.05, r * 0.045 * ek * big, r * 0.045 * ek * big); c.fill();
      ell(c, x - r * 0.03, ey + r * 0.05, r * 0.02 * ek, r * 0.02 * ek); c.fill();
      if (L.lashes) { c.strokeStyle = '#2b1d16'; c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(x + sd * r * 0.08, ey - r * 0.1); c.lineTo(x + sd * r * 0.15, ey - r * 0.15); c.stroke(); }
    }
  });
  // 코
  c.fillStyle = shade(L.skinEdge, 0.08); ell(c, fx * 1.4, r * (baby ? 0.38 : 0.27), r * (baby ? 0.04 : 0.05), r * (baby ? 0.028 : 0.035)); c.fill();
  // 볼
  c.fillStyle = `rgba(255,120,140,${0.32 + blush * 0.35})`;
  ex.forEach((x, i) => { ell(c, x + (i ? 1 : -1) * r * 0.2, r * (baby ? 0.47 : 0.38), r * ((baby ? 0.19 : 0.15) + blush * 0.05), r * ((baby ? 0.12 : 0.09) + blush * 0.03)); c.fill(); });
  // 입
  const mx = fx * 1.1, my = r * (baby ? 0.58 : 0.5);
  c.lineWidth = lw; c.strokeStyle = '#9c2f45';
  if (face === 'strain') {
    rr(c, mx - r * 0.19, my - r * 0.08, r * 0.38, r * 0.17, r * 0.06); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(mx - r * 0.17, my); c.lineTo(mx + r * 0.17, my);
    [-0.07, 0.07].forEach(q => { c.moveTo(mx + r * q, my - r * 0.07); c.lineTo(mx + r * q, my + r * 0.08); }); c.stroke();
  } else if (face === 'wow' || face === 'ouch') {
    ell(c, mx, my + r * 0.02, r * 0.08, r * (face === 'ouch' ? 0.07 : 0.11)); c.fillStyle = '#a61e4d'; c.fill();
  } else if (face === 'laugh') {
    c.beginPath(); c.moveTo(mx - r * 0.22, my - r * 0.04); c.quadraticCurveTo(mx, my + r * 0.36, mx + r * 0.22, my - r * 0.04); c.closePath(); c.fillStyle = '#a61e4d'; c.fill();
    ell(c, mx, my + r * 0.13, r * 0.09, r * 0.05); c.fillStyle = '#ff8fab'; c.fill();
  } else {
    c.beginPath(); c.moveTo(mx - r * 0.15, my - r * 0.02); c.quadraticCurveTo(mx, my + r * 0.2, mx + r * 0.15, my - r * 0.02); c.closePath(); c.fillStyle = '#c2255c'; c.fill();
    ell(c, mx, my + r * 0.07, r * 0.06, r * 0.03); c.fillStyle = '#ff8fab'; c.fill();
  }
  // 묶은 머리 방울 (양갈래)
  if (L.style === 'pigtail') {
    [-1, 1].forEach(sd => {
      const bx = sd * r * 0.8 + fx * 0.2, by = -r * 0.48;
      ell(c, bx, by, r * 0.14, r * 0.14); c.fillStyle = '#ff6fa3'; c.fill();
      ell(c, bx - r * 0.04, by - r * 0.05, r * 0.045, r * 0.045); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
    });
  }
  // 모자
  if (L.hat === 'straw') {
    c.save(); c.rotate(-0.08 + sway * 0.15);
    ell(c, fx * 0.3, -r * 0.62, r * 1.45, r * 0.3); c.fillStyle = '#f6da8e'; c.fill(); c.strokeStyle = '#d4a446'; c.lineWidth = lw * 0.8; c.stroke();
    c.strokeStyle = 'rgba(190,140,50,0.45)'; c.lineWidth = lw * 0.5;
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; c.beginPath(); c.moveTo(fx * 0.3 + Math.cos(a) * r * 0.85, -r * 0.62 + Math.sin(a) * r * 0.18); c.lineTo(fx * 0.3 + Math.cos(a) * r * 1.38, -r * 0.62 + Math.sin(a) * r * 0.28); c.stroke(); }
    c.beginPath(); c.moveTo(-r * 0.72, -r * 0.64); c.bezierCurveTo(-r * 0.74, -r * 1.48, r * 0.86, -r * 1.48, r * 0.84, -r * 0.64); c.closePath();
    c.fillStyle = '#f3d27c'; c.fill(); c.strokeStyle = '#d4a446'; c.lineWidth = lw * 0.8; c.stroke();
    c.strokeStyle = 'rgba(190,140,50,0.4)'; c.lineWidth = lw * 0.5;
    [-0.95, -1.15].forEach(y => { c.beginPath(); c.moveTo(-r * 0.66, r * y + r * 0.2); c.quadraticCurveTo(fx * 0.3, r * y - r * 0.05, r * 0.78, r * y + r * 0.2); c.stroke(); });
    c.strokeStyle = '#ff7eb0'; c.lineWidth = r * 0.15; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(-r * 0.73, -r * 0.74); c.quadraticCurveTo(fx * 0.3, -r * 0.86, r * 0.85, -r * 0.74); c.stroke();
    c.fillStyle = '#ff7eb0';   // 뒤쪽 리본
    ell(c, -r * 0.78, -r * 0.8, r * 0.16, r * 0.1, -0.5); c.fill(); ell(c, -r * 0.78, -r * 0.62, r * 0.16, r * 0.1, 0.5); c.fill();
    c.beginPath(); c.moveTo(-r * 0.75, -r * 0.72); c.quadraticCurveTo(-r * 1.05, -r * 0.5 + sway * r, -r * 1.0, -r * 0.3); c.lineTo(-r * 0.9, -r * 0.34); c.quadraticCurveTo(-r * 0.92, -r * 0.55, -r * 0.7, -r * 0.7); c.fill();
    c.restore();
  } else if (L.hat === 'cap') {
    c.fillStyle = L.capCol; c.beginPath(); c.arc(fx * 0.1, -r * 0.3, r * 0.98, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
    ell(c, r * 0.85, -r * 0.33, r * 0.6, r * 0.13, 0.08); c.fillStyle = shade(L.capCol, 0.2); c.fill();
    ell(c, fx * 0.1, -r * 1.27, r * 0.09, r * 0.06); c.fillStyle = shade(L.capCol, 0.25); c.fill();
    c.fillStyle = '#ffffff'; ell(c, fx * 0.4, -r * 0.8, r * 0.22, r * 0.14); c.fill();
    c.fillStyle = L.capCol; c.font = `${Math.round(r * 0.22)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♥', fx * 0.4, -r * 0.79);
  }
}

// 사람 한 명 그리기. o: { x, y(바닥), dir(1 오른쪽 / -1 왼쪽), face, blush, t, shadow }
export function drawPerson(c, L, rig, o) {
  const S = rig.S, P = L.P;
  c.save(); c.translate(o.x, o.y); c.scale(o.dir || 1, 1);
  if (o.shadow !== false) { ell(c, rig.hip[0] * 0.5, 0, S * 0.17, S * 0.03); c.fillStyle = 'rgba(60,40,20,0.18)'; c.fill(); }
  drawArm(c, L, rig.arms[0], S, true);
  drawLeg(c, L, rig.legs[0], S, true);
  drawLeg(c, L, rig.legs[1], S, false);
  c.save(); c.translate(rig.hip[0], rig.hip[1]); c.rotate(rig.lean); drawTorso(c, L, S, o.t); c.restore();
  c.save(); c.translate(rig.head[0], rig.head[1]); c.rotate(rig.lean * 0.55); drawHead(c, L, P.headR * S, o.face || 'smile', o.t || 0, o.blush || 0); c.restore();
  drawArm(c, L, rig.arms[1], S, false);
  c.restore();
}
// 로컬 → 화면(월드) 좌표
const toWorld = (o, p) => [o.x + p[0] * (o.dir || 1), o.y + p[1]];

// ───────────────────────────── 생쥐 ─────────────────────────────
function drawMouse(c, k, t, F, walk) {
  const bob = walk ? Math.abs(Math.sin(t * 14)) * k * 0.015 : 0;
  c.save(); c.translate(0, -bob);
  c.strokeStyle = '#e6a5b5'; c.lineWidth = k * 0.012; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-k * 0.13, -k * 0.07); c.bezierCurveTo(-k * 0.28, -k * 0.05, -k * 0.25, -k * 0.2, -k * 0.34, -k * 0.16 + Math.sin(t * 4) * k * 0.02); c.stroke();
  ell(c, 0, -k * 0.09, k * 0.14, k * 0.09); c.fillStyle = '#b9bac6'; c.fill();
  ell(c, k * 0.02, -k * 0.06, k * 0.09, k * 0.05); c.fillStyle = '#e4e4ec'; c.fill();
  c.fillStyle = '#f2a7b8'; [-0.07, 0.07].forEach(q => { ell(c, k * q, -k * 0.005, k * 0.03, k * 0.015); c.fill(); });
  // 머리 (앞으로 뻗어 고양이 꼬리를 잡음)
  c.save(); c.translate(k * 0.13, -k * 0.13); c.rotate(-F * 0.15);
  ell(c, 0, 0, k * 0.085, k * 0.075); c.fillStyle = '#b9bac6'; c.fill();
  ell(c, -k * 0.03, -k * 0.08, k * 0.055, k * 0.055); c.fill();
  ell(c, -k * 0.03, -k * 0.08, k * 0.035, k * 0.035); c.fillStyle = '#f7b9c8'; c.fill();
  c.beginPath(); c.moveTo(k * 0.04, -k * 0.04); c.lineTo(k * 0.13, k * 0.01); c.lineTo(k * 0.04, k * 0.04); c.closePath(); c.fillStyle = '#b9bac6'; c.fill();
  ell(c, k * 0.13, k * 0.008, k * 0.016, k * 0.014); c.fillStyle = '#ff6b8b'; c.fill();
  ell(c, k * 0.04, -k * 0.015, k * 0.013, k * 0.016); c.fillStyle = '#1f1a1a'; c.fill();
  c.strokeStyle = 'rgba(80,80,90,0.6)'; c.lineWidth = k * 0.004;
  [-0.02, 0.01].forEach(q => { c.beginPath(); c.moveTo(k * 0.1, k * 0.01); c.lineTo(k * 0.18, k * (0.01 + q * 2)); c.stroke(); });
  c.restore();
  c.strokeStyle = '#b9bac6'; c.lineWidth = k * 0.025;   // 앞발
  c.beginPath(); c.moveTo(k * 0.08, -k * 0.08); c.lineTo(k * 0.19, -k * 0.09 - F * k * 0.02); c.stroke();
  c.restore();
}

// ───────────────────────────── 무 ─────────────────────────────
// 로컬 좌표: 무 윗면 가운데가 원점, 아래(+y)로 뿌리
function radishPath(c, Wb, Lb) {
  c.beginPath(); c.moveTo(-Wb * 0.38, 0);
  c.quadraticCurveTo(0, -Wb * 0.16, Wb * 0.38, 0);
  c.bezierCurveTo(Wb * 0.56, Lb * 0.18, Wb * 0.5, Lb * 0.55, Wb * 0.14, Lb * 0.92);
  c.quadraticCurveTo(0, Lb * 1.0, -Wb * 0.14, Lb * 0.92);
  c.bezierCurveTo(-Wb * 0.5, Lb * 0.55, -Wb * 0.56, Lb * 0.18, -Wb * 0.38, 0);
  c.closePath();
}
function drawRadishBody(c, Wb, Lb, seed, dirt) {
  const rnd = seeded(seed);
  c.strokeStyle = '#d9cfb0'; c.lineWidth = Math.max(1, Wb * 0.012); c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, Lb * 0.97); c.quadraticCurveTo(Wb * 0.05, Lb * 1.1, Wb * 0.1, Lb * 1.2); c.stroke();   // 뿌리 꼬리
  radishPath(c, Wb, Lb);
  const g = c.createLinearGradient(0, -Wb * 0.1, 0, Lb);
  g.addColorStop(0, '#93cc5c'); g.addColorStop(0.16, '#cfe9a2'); g.addColorStop(0.3, '#f6fbe6'); g.addColorStop(1, '#fffdf4');
  c.fillStyle = g; c.fill();
  c.save(); radishPath(c, Wb, Lb); c.clip();
  const sg = c.createLinearGradient(-Wb * 0.5, 0, Wb * 0.5, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0.35)'); sg.addColorStop(0.45, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(150,130,90,0.22)');
  c.fillStyle = sg; c.fillRect(-Wb, -Wb, Wb * 2, Lb * 1.3);
  c.strokeStyle = 'rgba(170,150,110,0.32)'; c.lineWidth = Math.max(1, Wb * 0.01);
  for (let i = 0; i < 6; i++) { const y = Lb * (0.38 + i * 0.09), w = Wb * (0.12 + rnd() * 0.12), x = (rnd() - 0.5) * Wb * 0.4; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + Wb * 0.03, x + w, y); c.stroke(); }
  ell(c, -Wb * 0.2, Lb * 0.32, Wb * 0.07, Lb * 0.18, 0.05); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
  c.restore();
  radishPath(c, Wb, Lb); c.strokeStyle = '#cbbf98'; c.lineWidth = Math.max(1, Wb * 0.014); c.stroke();
  // 잔뿌리
  c.strokeStyle = '#ddd3b5'; c.lineWidth = Math.max(0.8, Wb * 0.008);
  for (let i = 0; i < 6; i++) {
    const v = 0.5 + rnd() * 0.4, sd = i % 2 ? 1 : -1, hw = Wb * (0.48 - (v - 0.2) * 0.42);
    c.beginPath(); c.moveTo(sd * hw, Lb * v); c.lineTo(sd * (hw + Wb * 0.08), Lb * (v + 0.05)); c.stroke();
  }
  // 흙
  if (dirt) dirt.forEach(b => {
    if (b.a <= 0.02) return;
    c.globalAlpha = b.a * 0.9;
    ell(c, b.u * Wb, b.v * Lb, b.r * Wb, b.r * Wb * 0.75, b.rot); c.fillStyle = '#8a5a35'; c.fill();
    c.fillStyle = '#6e4426'; ell(c, b.u * Wb + b.r * Wb * 0.3, b.v * Lb - b.r * Wb * 0.2, b.r * Wb * 0.3, b.r * Wb * 0.25); c.fill();
    c.globalAlpha = 1;
  });
}

// 무 잎. grip(로컬 좌표)이 있으면 줄기가 그 손으로 모였다가 위로 펼쳐진다
function leafShapes(seed, sz, S) {
  const rnd = seeded(seed + 7), n = { small: 5, mid: 6, big: 7, giant: 9 }[sz.id];
  return Array.from({ length: n }, (_, i) => ({
    a: -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.1 + (rnd() - 0.5) * 0.2,
    len: sz.leaf * S * (0.8 + rnd() * 0.22), curl: (rnd() - 0.5) * 0.5, bx: (i / (n - 1) - 0.5) * 0.3,
    col: ['#3f9b45', '#4caf50', '#58b85b', '#45a349'][i % 4], ph: rnd() * TAU
  }));
}
function drawBlade(c, pts, w, col) {
  const n = pts.length;
  c.fillStyle = col; c.strokeStyle = shade(col, 0.3); c.lineWidth = Math.max(0.8, w * 0.07);
  for (let j = 1; j < n; j++) {
    const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], ang = Math.atan2(y1 - y0, x1 - x0), k = j / (n - 1);
    const s = w * (0.35 + 0.65 * k);
    [-1, 1].forEach(sd => {
      const nx = -Math.sin(ang) * sd, ny = Math.cos(ang) * sd;
      ell(c, x1 + nx * s * 0.75, y1 + ny * s * 0.75, s, s * 0.55, ang + sd * 0.9); c.fill(); c.stroke();
    });
  }
  const [ex, ey] = pts[n - 1], [px, py] = pts[n - 2], ang = Math.atan2(ey - py, ex - px);
  ell(c, ex + Math.cos(ang) * w * 0.8, ey + Math.sin(ang) * w * 0.8, w * 1.25, w * 0.85, ang); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(220,245,200,0.8)'; c.lineWidth = Math.max(1, w * 0.12);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(ex + Math.cos(ang) * w * 1.6, ey + Math.sin(ang) * w * 1.6); c.stroke();
}
function drawLeaves(c, sz, S, Wb, seed, t, grip, grow, sway) {
  const leaves = leafShapes(seed, sz, S), w0 = S * 0.04 * (sz.id === 'giant' ? 1.4 : 1) * grow, stemW = S * 0.016 * (sz.id === 'giant' ? 1.8 : 1) * grow;
  const order = leaves.map((l, i) => i).sort((a, b) => Math.abs(leaves[b].a + Math.PI / 2) - Math.abs(leaves[a].a + Math.PI / 2));   // 바깥 잎 먼저
  order.forEach(i => {
    const l = leaves[i], len = l.len * grow, bx = l.bx * Wb, by = -Wb * 0.04;
    const pts = [];
    let stemEnd;
    if (grip) {
      const gx = grip[0] + (i - leaves.length / 2) * S * 0.004, gy = grip[1];
      const dist = Math.hypot(gx - bx, gy - by);
      c.strokeStyle = '#a9d47a'; c.lineWidth = stemW; c.lineCap = 'round';
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx * 0.4, (by + gy) / 2, gx, gy); c.stroke();
      c.strokeStyle = 'rgba(80,140,50,0.35)'; c.lineWidth = stemW * 0.3; c.stroke();
      const dir = l.a - 0.35 + Math.sin(t * 2 + l.ph) * 0.05;   // 손 위로 꽃다발처럼 펼쳐짐
      const rest = Math.max(len * 0.35, len - dist * 0.85);
      let a = dir, x = gx, y = gy; pts.push([x, y]);
      for (let j = 0; j < 6; j++) { a += l.curl * 0.12 + (Math.cos(a) > 0 ? 0.04 : -0.04); x += Math.cos(a) * rest / 6; y += Math.sin(a) * rest / 6; pts.push([x, y]); }
      stemEnd = null;
    } else {
      let a = l.a + Math.sin(t * 1.6 + l.ph) * 0.05 + sway, x = bx, y = by;
      const petiole = 0.32;
      c.strokeStyle = '#a9d47a'; c.lineWidth = stemW; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 10; j++) {
        a += l.curl * 0.08 + (Math.cos(a) > 0 ? 0.03 : -0.03);
        x += Math.cos(a) * len / 10; y += Math.sin(a) * len / 10;
        if (j / 10 < petiole) c.lineTo(x, y); else pts.push([x, y]);
        if (Math.abs(j / 10 - petiole) < 0.05) { c.lineTo(x, y); pts.unshift([x, y]); }
      }
      c.stroke(); stemEnd = pts[0];
    }
    if (pts.length > 2) drawBlade(c, pts, w0, l.col);
    void stemEnd;
  });
  ell(c, 0, -Wb * 0.05, Wb * 0.14, Wb * 0.06); c.fillStyle = '#6aa84f'; c.fill();
}

// ───────────────────────────── 배경 ─────────────────────────────
function drawSky(c, W, H, t) {
  const g = c.createLinearGradient(0, 0, 0, H * 0.7); g.addColorStop(0, '#a9dcff'); g.addColorStop(1, '#eaf7ff');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sx = W * 0.9, sy = H * 0.13, sr = Math.min(W, H) * 0.07;
  c.save(); c.translate(sx, sy); c.rotate(t * 0.15); c.strokeStyle = 'rgba(255,214,90,0.55)'; c.lineWidth = sr * 0.12; c.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.beginPath(); c.moveTo(Math.cos(a) * sr * 1.35, Math.sin(a) * sr * 1.35); c.lineTo(Math.cos(a) * sr * 1.75, Math.sin(a) * sr * 1.75); c.stroke(); }
  c.restore();
  ell(c, sx, sy, sr, sr); c.fillStyle = '#ffd84d'; c.fill();
  c.fillStyle = '#7a4b00'; [-0.32, 0.32].forEach(q => { ell(c, sx + q * sr, sy - sr * 0.1, sr * 0.08, sr * 0.11); c.fill(); });
  c.strokeStyle = '#7a4b00'; c.lineWidth = sr * 0.07; c.beginPath(); c.arc(sx, sy + sr * 0.1, sr * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  [[0.15, 0.12, 1], [0.48, 0.08, 0.8], [0.7, 0.2, 0.65]].forEach(([u, v, k], i) => {
    const x = ((u * W + t * (8 + i * 4)) % (W * 1.3)) - W * 0.15, y = v * H, s = Math.min(W, H) * 0.06 * k;
    c.fillStyle = 'rgba(255,255,255,0.95)';
    [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.25, 0.75], [0.35, -0.35, 0.75]].forEach(([dx, dy, r]) => { ell(c, x + dx * s, y + dy * s, s * r, s * r * 0.8); c.fill(); });
  });
}
function drawWorld(c, W, H, gy, S, t) {
  // 언덕
  c.fillStyle = '#b6e09a'; c.beginPath(); c.moveTo(0, H * 0.52);
  for (let x = 0; x <= W; x += W / 24) c.lineTo(x, H * 0.5 - Math.sin(x / W * 5 + 1) * H * 0.04 - Math.sin(x / W * 11) * H * 0.012);
  c.lineTo(W, H); c.lineTo(0, H); c.fill();
  // 헛간
  const bx = W * 0.71, by = H * 0.53, bs = H * 0.1;
  c.fillStyle = '#d9534f'; c.fillRect(bx - bs * 0.6, by - bs * 0.7, bs * 1.2, bs * 0.7);
  c.fillStyle = '#9b2c2c'; c.beginPath(); c.moveTo(bx - bs * 0.72, by - bs * 0.68); c.lineTo(bx, by - bs * 1.15); c.lineTo(bx + bs * 0.72, by - bs * 0.68); c.fill();
  c.fillStyle = '#fff5e6'; c.fillRect(bx - bs * 0.2, by - bs * 0.45, bs * 0.4, bs * 0.45);
  c.strokeStyle = '#d9534f'; c.lineWidth = bs * 0.05; c.beginPath(); c.moveTo(bx - bs * 0.2, by - bs * 0.45); c.lineTo(bx + bs * 0.2, by); c.moveTo(bx + bs * 0.2, by - bs * 0.45); c.lineTo(bx - bs * 0.2, by); c.stroke();
  // 나무
  [[0.06, 0.55, 1], [0.93, 0.56, 1.15], [0.3, 0.52, 0.7]].forEach(([u, v, k]) => {
    const x = u * W, y = v * H, s = H * 0.07 * k;
    c.fillStyle = '#8b5a2b'; c.fillRect(x - s * 0.12, y - s * 0.8, s * 0.24, s * 0.8);
    c.fillStyle = '#5cb85c'; [[0, -1.25, 0.75], [-0.5, -0.9, 0.55], [0.5, -0.9, 0.55]].forEach(([dx, dy, r]) => { ell(c, x + dx * s, y + dy * s, s * r, s * r); c.fill(); });
    c.fillStyle = '#e8574e'; [[-0.3, -1.3], [0.35, -1.05], [0.05, -0.85]].forEach(([dx, dy]) => { ell(c, x + dx * s, y + dy * s, s * 0.08, s * 0.08); c.fill(); });
  });
  // 울타리
  const fy = H * 0.6;
  c.strokeStyle = '#c9965f'; c.lineWidth = H * 0.008;
  [0, 1].forEach(k => { c.beginPath(); c.moveTo(0, fy - H * (0.012 + k * 0.022)); c.lineTo(W, fy - H * (0.012 + k * 0.022)); c.stroke(); });
  c.fillStyle = '#d8a86e'; for (let x = W * 0.02; x < W; x += W * 0.07) { rr(c, x - H * 0.006, fy - H * 0.05, H * 0.012, H * 0.05, H * 0.004); c.fill(); }
  // 뒤쪽 이랑 (새싹)
  const rows = 4, top = H * 0.6, bot = gy - S * 0.05;
  for (let i = 0; i < rows; i++) {
    const y0 = lerp(top, bot, i / rows), y1 = lerp(top, bot, (i + 1) / rows);
    c.fillStyle = i % 2 ? '#b07c50' : '#c08a5c'; c.fillRect(0, y0, W, y1 - y0 + 1);
    const step = W * (0.045 + i * 0.005), s = (y1 - y0) * 0.45;
    c.fillStyle = '#5fae4f';
    for (let x = (i % 2) * step * 0.5 + step * 0.3; x < W; x += step) {
      const sw = Math.sin(t * 1.5 + x * 0.05) * 0.1;
      ell(c, x - s * 0.35, y0 + (y1 - y0) * 0.45, s * 0.45, s * 0.2, -0.6 + sw); c.fill();
      ell(c, x + s * 0.35, y0 + (y1 - y0) * 0.45, s * 0.45, s * 0.2, 0.6 + sw); c.fill();
    }
  }
  // 허수아비
  const qx = W * 0.53, qy = lerp(top, bot, 0.5), qs = H * 0.13;
  c.strokeStyle = '#8b5a2b'; c.lineWidth = qs * 0.06; c.beginPath(); c.moveTo(qx, qy); c.lineTo(qx, qy - qs); c.moveTo(qx - qs * 0.45, qy - qs * 0.68); c.lineTo(qx + qs * 0.45, qy - qs * 0.68); c.stroke();
  c.fillStyle = '#e8590c'; rr(c, qx - qs * 0.2, qy - qs * 0.75, qs * 0.4, qs * 0.38, qs * 0.05); c.fill();
  c.fillStyle = '#f9d77e'; ell(c, qx, qy - qs * 0.86, qs * 0.14, qs * 0.14); c.fill();
  c.fillStyle = '#c9963c'; ell(c, qx, qy - qs * 0.97, qs * 0.3, qs * 0.06); c.fill(); ell(c, qx, qy - qs * 1.03, qs * 0.15, qs * 0.09); c.fill();
  c.fillStyle = '#3b2a20'; [-0.05, 0.05].forEach(q => { ell(c, qx + q * qs, qy - qs * 0.88, qs * 0.015, qs * 0.015); c.fill(); });
  c.strokeStyle = '#3b2a20'; c.lineWidth = qs * 0.012; c.beginPath(); c.arc(qx, qy - qs * 0.84, qs * 0.05, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  // 팻말
  const px = W * 0.37, py = lerp(top, bot, 0.75), ps = H * 0.06;
  c.fillStyle = '#8b5a2b'; c.fillRect(px - ps * 0.06, py - ps * 0.9, ps * 0.12, ps * 0.9);
  c.fillStyle = '#e9c48f'; rr(c, px - ps * 1.05, py - ps * 1.45, ps * 2.1, ps * 0.62, ps * 0.1); c.fill(); c.strokeStyle = '#8b5a2b'; c.lineWidth = ps * 0.05; c.stroke();
  c.fillStyle = '#6b3f1f'; c.font = `${Math.round(ps * 0.36)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('유나네 무밭', px, py - ps * 1.13);
  // 앞 이랑 (무가 있는 줄) + 앞 땅
  const ridge = c.createLinearGradient(0, gy - S * 0.05, 0, H);
  ridge.addColorStop(0, '#b47e52'); ridge.addColorStop(0.12, '#9b6b43'); ridge.addColorStop(1, '#7a5233');
  c.fillStyle = ridge; c.beginPath(); c.moveTo(0, gy - S * 0.03);
  for (let x = 0; x < W + W / 30; x += W / 30) c.lineTo(x, gy - S * 0.03 - Math.sin(x * 0.03) * S * 0.006);
  c.lineTo(W, H); c.lineTo(0, H); c.fill();
  const rnd = seeded(42);
  for (let i = 0; i < 50; i++) { const x = rnd() * W, y = gy + S * 0.04 + rnd() * (H - gy); ell(c, x, y, S * (0.008 + rnd() * 0.012), S * (0.005 + rnd() * 0.007)); c.fillStyle = rnd() > 0.5 ? 'rgba(90,60,35,0.45)' : 'rgba(210,170,120,0.4)'; c.fill(); }
  // 앞쪽 풀과 꽃
  for (let x = 0; x < W; x += W * 0.035) {
    const h = S * (0.05 + ((x * 7) % 5) * 0.012), sw = Math.sin(t * 1.4 + x) * S * 0.008;
    c.fillStyle = '#5aa84a'; c.beginPath(); c.moveTo(x - S * 0.02, H); c.quadraticCurveTo(x + sw, H - h * 1.3, x + S * 0.02, H); c.fill();
    c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + S * 0.025 + sw, H - h, x + S * 0.04, H); c.fill();
  }
  [[0.22, '#ff8fab'], [0.5, '#ffd43b'], [0.76, '#ffffff'], [0.95, '#b197fc']].forEach(([u, col]) => {
    const x = u * W, y = H - S * 0.07;
    c.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ell(c, x + Math.cos(a) * S * 0.014, y + Math.sin(a) * S * 0.014, S * 0.011, S * 0.011); c.fill(); }
    c.fillStyle = '#ffa94d'; ell(c, x, y, S * 0.008, S * 0.008); c.fill();
  });
  // 나비
  [[0.25, 0.4, '#ffb3d9'], [0.68, 0.35, '#ffe066']].forEach(([u, v, col], i) => {
    const x = u * W + Math.sin(t * 0.5 + i * 3) * W * 0.12, y = v * H + Math.sin(t * 1.3 + i) * H * 0.04, f = Math.abs(Math.sin(t * 12 + i)), s = S * 0.04;
    c.fillStyle = col; ell(c, x - s * 0.5 * f, y, s * 0.6 * f + 1, s * 0.5); c.fill(); ell(c, x + s * 0.5 * f, y, s * 0.6 * f + 1, s * 0.5); c.fill();
    c.fillStyle = '#5c3d2e'; ell(c, x, y, s * 0.08, s * 0.35); c.fill();
  });
}

function drawStar(c, x, y, r, col, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  c.closePath(); c.fillStyle = col; c.fill(); c.restore();
}
function bubble(c, text, x, y, size, alpha, col = '#e8590c') {
  c.save(); c.globalAlpha = alpha; c.font = `${Math.round(size)}px ${JUA}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + size * 0.9, h = size * 1.45;
  rr(c, x - w / 2, y - h / 2, w, h, h * 0.45); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = col; c.lineWidth = Math.max(2, size * 0.09); c.stroke();
  c.fillStyle = col; c.fillText(text, x, y + size * 0.04); c.restore();
}

// 바구니 (화면 왼쪽 아래)
function basketBox(W, H) { const w = Math.min(W * 0.2, H * 0.27), h = w * 0.62; return { x: W * 0.02, y: H - h - H * 0.03, w, h }; }
function drawMiniRadish(c, x, y, s, rot, seed, giant) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const Wb = s * (giant ? 0.5 : 0.36), Lb = s;
  c.fillStyle = '#4caf50'; [-0.5, 0, 0.5].forEach(q => { ell(c, q * Wb * 0.6, -Lb * 0.18, Wb * 0.2, Lb * 0.24, q * 0.6); c.fill(); });
  drawRadishBody(c, Wb, Lb, seed, null);
  c.restore();
}
function drawBasket(c, B, items, t, bump) {
  const { x, y, w, h } = B, k = 1 + Math.max(0, bump) * 0.08;
  c.save(); c.translate(x + w / 2, y + h); c.scale(k, k); c.translate(-(x + w / 2), -(y + h));
  ell(c, x + w / 2, y + h * 0.98, w * 0.5, h * 0.1); c.fillStyle = 'rgba(60,40,20,0.2)'; c.fill();
  // 손잡이
  c.strokeStyle = '#a0662f'; c.lineWidth = w * 0.05; c.beginPath(); c.ellipse(x + w / 2, y + h * 0.15, w * 0.38, h * 0.62, 0, Math.PI, TAU); c.stroke();
  ell(c, x + w / 2, y + h * 0.15, w * 0.5, h * 0.14); c.fillStyle = '#7a4a1f'; c.fill();
  items.forEach((it, i) => {
    const giant = it.size === 'giant', col = i % 3, row = Math.floor(i / 3);
    const s = giant ? h * 1.3 : h * 0.62;
    drawMiniRadish(c, x + w * (0.25 + col * 0.25), y + h * (0.05 - row * 0.12) - (giant ? s * 0.5 : s * 0.3), s, (col - 1) * 0.35 + (giant ? 0.2 : 0), it.seed, giant);
  });
  c.beginPath(); c.moveTo(x, y + h * 0.15); c.lineTo(x + w, y + h * 0.15); c.lineTo(x + w * 0.88, y + h); c.lineTo(x + w * 0.12, y + h); c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#d9a05b'); g.addColorStop(1, '#b97a3c'); c.fillStyle = g; c.fill();
  c.save(); c.clip(); c.strokeStyle = 'rgba(120,70,25,0.45)'; c.lineWidth = Math.max(1.5, w * 0.012);
  for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x, y + h * (0.15 + i * 0.17)); c.lineTo(x + w, y + h * (0.15 + i * 0.17)); c.stroke(); }
  for (let i = 0; i < 12; i++) { const xx = x + w * (i + (Math.floor(i) % 2) * 0.5) / 11; c.beginPath(); c.moveTo(xx, y + h * 0.15); c.lineTo(xx + w * 0.02, y + h); c.stroke(); }
  c.restore();
  ell(c, x + w / 2, y + h * 0.15, w * 0.5, h * 0.06); c.strokeStyle = '#8a5a2b'; c.lineWidth = w * 0.035; c.stroke();
  c.restore();
  void t;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function RadishGame({ audio, speak }) {
  const canvasRef = useRef(null);
  const G = useRef(null);
  const [ui, setUi] = useState({ phase: 'field', done: 0, stuck: false, helperIdx: 0, total: 0, giant: 0, field: [] });
  const later = (fn, ms) => audio.later(fn, ms);
  const sync = () => {
    const g = G.current; if (!g) return;
    setUi({ phase: g.phase, done: g.basket.length, stuck: g.stuck && !g.helpers.some(h => h.walking), helperIdx: g.helpers.length, total: g.stats.total, giant: g.stats.giant, field: g.field.map(s => ({ size: s.size, done: s.done })) });
  };
  const say = (text) => { const g = G.current; if (!text) return; if (g) g.voiceBusy = g.t + text.length * 0.11 + 0.5; if (speak) speak(text); };

  useEffect(() => {
    G.current = {
      t: 0, phase: 'field', field: newField(), growT: 0, cur: -1, basket: [], stats: loadRadishStats(),
      cam: { x: 0, y: 0, z: 1, init: false },
      yuna: { u: 0.05, dir: 1, walk: null, face: 'smile', ph: 0, fallT: -9, cheerUntil: 0 },
      helpers: [], pull: null, F: 0, tug: 0, wig: 0, tiltT: 0, tilt: 0, stuckT: 0, stuck: false, pullTime: 0,
      parts: [], pops: [], loose: null, fly: null, bump: 0, voiceBusy: 0, heaveI: 0, heaveT: 0, crackT: 0, rubT: 0,
      saidWiggle: false, saidAlmost: false, lastUp: 0
    };
    say(VOICE.radishWelcome());
    sync();
    return () => audio.interruptVoice();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 동작 ──
  const geo = (g) => {
    const W = g.W, H = g.H, S = Math.min(H * 0.38, W * 0.26), gy = H * 0.76;
    return { W, H, S, gy };
  };
  const radishDims = (sz, S) => ({ Wb: sz.wid * S, Lb: sz.len * S });
  const standX = (g, i) => {
    const { W, S } = geo(g), sz = RADISH_SIZES[g.field[i].size], { Wb } = radishDims(sz, S), rx = SLOT_U[i] * W;
    return sz.id === 'giant' ? rx - Wb * 0.5 - S * 0.12 : rx - S * 0.22;
  };
  const choose = (i) => {
    const g = G.current;
    audio.interruptVoice();
    g.cur = i; g.phase = 'walk'; g.saidAlmost = false; g.stuck = false; g.stuckT = 0; g.pullTime = 0;
    g.yuna.walk = { tu: standX(g, i) / g.W, onDone: startPull };
    audio.playFreq(660, 'sine', 0.08, 0.3);
    sync();
  };
  const startPull = () => {
    const g = G.current, giant = g.field[g.cur].size === 'giant';
    g.phase = 'pull'; g.yuna.dir = 1; g.pullTime = 0;
    audio.playNoise(0.1, 0.18, 4200, 0.9);   // 잎 사각
    say(giant ? VOICE.radishGiantGrab() : VOICE.radishGrab());
    const i = g.cur;
    later(() => { const h = G.current; if (h.phase === 'pull' && h.cur === i && h.field[i].p < 0.05 && !h.pull) say(VOICE.radishGrab()); }, 9000);
    sync();
  };
  const callHelper = () => {
    const g = G.current; if (!g || g.helpers.length >= RADISH_HELPERS.length) return;
    const h = RADISH_HELPERS[g.helpers.length], { S } = geo(g);
    g.helpers.push({ id: h.id, x: g.cam.x - g.W / (2 * g.cam.z) - S * 0.6, walking: true, ph: 0, arrivedT: 0, fallT: -9, leaving: false });
    g.stuck = false; g.stuckT = 0;
    say(VOICE.radishCall(h)); audio.playFreq(880, 'triangle', 0.12, 0.35); later(() => audio.playFreq(1100, 'triangle', 0.12, 0.35), 120);
    sync();
  };
  const pop = () => {
    const g = G.current, slot = g.field[g.cur], sz = RADISH_SIZES[slot.size], { W, S, gy } = geo(g), { Wb, Lb } = radishDims(sz, S), rx = SLOT_U[g.cur] * W;
    const rnd = seeded(slot.seed + 3);
    slot.p = 1; slot.pulled = true; g.phase = 'pop'; g.popT = g.t; g.pull = null; g.F = 0; g.tug = 0;
    const top = gy - Lb * 0.58;
    g.loose = {
      size: slot.size, seed: slot.seed, i: g.cur,
      x0: rx, y0: top + Lb / 2, r0: g.tilt * 0.1, x1: rx + Lb * (slot.size === 'giant' ? -0.1 : 0.12), y1: gy - Wb * 0.42, r1: -Math.PI / 2, x: rx, y: top + Lb / 2, rot: 0,
      dirt: Array.from({ length: slot.size === 'giant' ? 18 : 12 }, () => ({ u: (rnd() - 0.5) * 0.7, v: 0.12 + rnd() * 0.82, r: 0.09 + rnd() * 0.1, rot: rnd() * 3, a: 1 }))
    };
    g.yuna.fallT = g.t; g.yuna.face = 'ouch';
    g.helpers.forEach((h, k) => { h.fallT = g.t + 0.08 * (k + 1); });
    // 소리: 쑥 → 뽕 → 쿵
    audio.playNoise(0.3, 0.5, 500, 0.7); audio.playFreq(150, 'sine', 0.25, 0.6);
    later(() => { audio.playFreq(520, 'triangle', 0.1, 0.45); audio.playFreq(780, 'sine', 0.12, 0.35); }, 60);
    later(() => audio.playFreq(85, 'sine', 0.28, 0.8), 380);
    later(() => { [784, 988, 1175, 1568].forEach((f, k) => later(() => audio.playXylophone(f, 0.55), k * 90)); }, 600);
    for (let k = 0; k < (slot.size === 'giant' ? 60 : 32); k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = S * (1 + Math.random() * 1.8);
      g.parts.push({ kind: 'clod', x: rx + (Math.random() - 0.5) * Wb, y: gy - S * 0.01, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: g.t, life: 2.2, r: S * (0.008 + Math.random() * 0.018), col: Math.random() > 0.4 ? '#7a4f2e' : '#a8774c' });
    }
    burst(rx, top, 14);
    g.pops.push({ text: slot.size === 'giant' ? '쑤우욱!' : '쑥!', x: rx, y: top - S * 0.35, born: g.t, size: S * (slot.size === 'giant' ? 0.3 : 0.22), col: '#e8590c' });
    say(VOICE.radishPop(slot.size));
    later(() => {
      const h = G.current; if (h.phase !== 'pop') return;
      h.phase = 'clean'; h.yuna.face = 'wow';
      say(VOICE.radishClean()); sync();
    }, slot.size === 'giant' ? 4200 : 2400);
    sync();
  };
  const burst = (x, y, n) => {
    const g = G.current, cols = ['#ffd43b', '#ff8fab', '#69db7c', '#74c0fc', '#ffffff'];
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 140; g.parts.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, born: g.t, life: 1.1 + Math.random() * 0.5, r: 6 + Math.random() * 7, col: cols[i % cols.length], rot: Math.random() * 6 }); }
  };
  const cleanDone = () => {
    const g = G.current, L = g.loose;
    L.dirt.forEach(b => { b.a = 0; });
    g.phase = 'ready'; g.yuna.face = 'laugh'; g.yuna.cheerUntil = g.t + 1.6;
    burst(L.x, L.y, 18);
    [1047, 1319, 1568].forEach((f, k) => later(() => audio.playXylophone(f, 0.6), k * 110));
    say(VOICE.radishCleanDone()); sync();
  };
  const toBasket = () => {
    const g = G.current, L = g.loose, c = g.cam;
    g.fly = { sx: (L.x - c.x) * c.z + g.W / 2, sy: (L.y - c.y) * c.z + g.H / 2, rot: L.rot, scale: c.z, t0: g.t, size: L.size, seed: L.seed, i: L.i };
    g.loose = null; g.phase = 'fly'; g.yuna.cheerUntil = g.t + 1.4;
    audio.playNoise(0.35, 0.18, 1800, 0.5);
    sync();
  };
  const landBasket = () => {
    const g = G.current, f = g.fly, slot = g.field[f.i], giant = f.size === 'giant';
    g.fly = null; slot.done = true; g.basket.push({ size: f.size, seed: f.seed }); g.bump = 1;
    g.stats.total += 1; if (giant) g.stats.giant += 1; saveRadishStats(g.stats);
    audio.playPopSound(); audio.playXylophone([523, 587, 659, 784, 1047][Math.min(4, g.basket.length - 1)], 0.6);
    if (giant) { say(VOICE.radishGiantDone()); g.helpers.forEach(h => { h.leaving = true; h.walking = true; }); }
    else say(VOICE.radishBasket(g.basket.length));
    g.cur = -1; g.stuck = false;
    if (g.field.every(s => s.done)) {
      g.phase = 'alldone';
      later(() => { audio.playFanfare(); say(VOICE.radishAllDone()); G.current.yuna.cheerUntil = G.current.t + 3; }, giant ? 4300 : 1800);
    } else g.phase = 'field';
    sync();
  };
  const resetField = () => {
    const g = G.current; if (!g) return;
    audio.interruptVoice();
    Object.assign(g, { field: newField(), growT: g.t, cur: -1, basket: [], phase: 'field', helpers: [], pull: null, loose: null, fly: null, stuck: false, F: 0, tug: 0, pops: [] });
    g.yuna.walk = null; g.yuna.face = 'smile'; g.yuna.fallT = -9;
    audio.playNoise(0.4, 0.15, 900, 0.6); [523, 659, 784].forEach((f, k) => later(() => audio.playXylophone(f, 0.5), k * 120));
    say(VOICE.radishNewField()); sync();
  };

  // ── 입력 ──
  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toW = (g, sx, sy) => [g.cam.x + (sx - g.W / 2) / g.cam.z, g.cam.y + (sy - g.H / 2) / g.cam.z];
  const onDown = (e) => {
    const g = G.current; if (!g || !g.W) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const [sx, sy] = pos(e), [wx, wy] = toW(g, sx, sy), { W, S, gy } = geo(g);
    if (g.phase === 'field') {
      let best = -1, bd = Infinity;
      g.field.forEach((s, i) => {
        if (s.done) return;
        const sz = RADISH_SIZES[s.size], rx = SLOT_U[i] * W, hw = Math.max(sz.wid * S * 0.9, S * 0.14);
        if (Math.abs(wx - rx) < hw && wy > gy - sz.leaf * S * 1.0 && wy < gy + S * 0.12) { const d = Math.abs(wx - rx); if (d < bd) { bd = d; best = i; } }
      });
      if (best >= 0) { choose(best); return; }
      if (wy > gy - S * 1.1) {   // 땅을 누르면 그쪽으로 걸어간다
        g.yuna.walk = { tu: clamp(wx / W, 0.04, 0.96), onDone: null }; audio.playFreq(520, 'sine', 0.06, 0.2);
      }
      return;
    }
    if (g.phase === 'pull') { g.pull = { sx0: sx, sy0: sy, sx, sy, lx: sx, down: g.t, moved: 0 }; return; }
    if (g.phase === 'clean') { g.rub = { x: wx, y: wy }; rubAt(wx, wy, 0); return; }
    if (g.phase === 'ready') toBasket();
  };
  const rubAt = (wx, wy, dist) => {
    const g = G.current, L = g.loose; if (!L) return;
    const { S } = geo(g), sz = RADISH_SIZES[L.size], { Wb, Lb } = radishDims(sz, S);
    const dx = wx - L.x, dy = wy - L.y, cs = Math.cos(-L.rot), sn = Math.sin(-L.rot);
    const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs + Lb / 2;
    const brush = S * 0.08;
    let hit = false;
    L.dirt.forEach(b => {
      if (b.a <= 0) return;
      if (Math.hypot(lx - b.u * Wb, ly - b.v * Lb) < b.r * Wb + brush) { b.a = Math.max(0, b.a - (0.12 + dist / (S * 0.25))); hit = true; }
    });
    if (hit) {
      if (g.t - g.rubT > 0.09) { g.rubT = g.t; audio.playNoise(0.07, 0.14, 2200 + Math.random() * 800, 0.8); }
      if (Math.random() < 0.6) g.parts.push({ kind: 'clod', x: wx, y: wy, vx: (Math.random() - 0.5) * S * 0.6, vy: -S * 0.2, born: g.t, life: 1.2, r: S * (0.006 + Math.random() * 0.01), col: '#8a5a35' });
      const left = L.dirt.reduce((s, b) => s + b.a, 0);
      if (left < L.dirt.length * 0.1) cleanDone();
    }
  };
  const onMove = (e) => {
    const g = G.current; if (!g || !g.W) return;
    const [sx, sy] = pos(e);
    if (g.phase === 'pull' && g.pull) {
      const p = g.pull, dx = sx - p.lx;
      p.moved += Math.abs(dx) + Math.abs(sy - p.sy); p.sx = sx; p.sy = sy; p.lx = sx;
      g.wig = Math.min(1.5, g.wig + Math.abs(dx) / (g.W * 0.12));
      g.tiltT = clamp(g.tiltT + dx / (g.W * 0.06), -1, 1);
      if (Math.abs(dx) > 3 && g.t - (g.leafT || 0) > 0.15) { g.leafT = g.t; audio.playNoise(0.06, 0.08, 4500, 0.9); }
    } else if (g.phase === 'clean' && g.rub) {
      const [wx, wy] = toW(g, sx, sy), d = Math.hypot(wx - g.rub.x, wy - g.rub.y);
      g.rub = { x: wx, y: wy }; rubAt(wx, wy, d);
    }
  };
  const onUp = () => {
    const g = G.current; if (!g) return;
    if (g.pull) {
      const p = g.pull;
      if (g.t - p.down < 0.3 && p.moved < 25) { g.tug = Math.min(1.3, g.tug + 0.75); audio.playNoise(0.06, 0.12, 700, 0.9); }   // 톡톡 눌러도 영차
      g.pull = null;
    }
    g.rub = null;
  };

  // ── 그림 루프 ──
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    let raf = 0, last = performance.now(); const t0 = last;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const g = G.current; if (!g) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t = (now - t0) / 1000; const t = g.t;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (!(W > 0 && H > 0)) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      g.W = W; g.H = H;
      const c = cv.getContext('2d');
      const { S, gy } = geo(g), Y = g.yuna, yS = S * 0.82, mS = S * 1.6, dogS = S * 0.62, catS = S * 0.55;
      const giantSlot = g.cur >= 0 && g.field[g.cur].size === 'giant';

      // ── 유나 걷기 ──
      if (Y.walk) {
        const d = Y.walk.tu - Y.u, step = (S * 1.1 / W) * dt;
        if (Math.abs(d) <= step) { Y.u = Y.walk.tu; const f = Y.walk.onDone; Y.walk = null; if (f) f(); }
        else { Y.u += Math.sign(d) * step; Y.dir = Math.sign(d); Y.ph += dt * 9; if (Math.sin(Y.ph) * Math.sin(Y.ph - dt * 9) < 0) audio.playNoise(0.04, 0.05, 900, 1); }
      }
      const yx = Y.u * W;

      // ── 당기기 ──
      let slot = g.cur >= 0 ? g.field[g.cur] : null;
      const sz = slot ? RADISH_SIZES[slot.size] : null;
      const arrived = g.helpers.filter(h => !h.walking && !h.leaving).length;
      if (g.phase === 'pull' && slot) {
        const pl = g.pull; let f = 0;
        if (pl) {
          const up = (pl.sy0 - pl.sy) + Math.max(0, pl.sx0 - pl.sx) * 0.6;
          f = clamp01(up / (H * 0.18));
          if (t - pl.down > 0.25) f = Math.max(f, 0.35);
        }
        g.tug = Math.max(0, g.tug - dt * 2.2);
        const Ft = Math.max(f, Math.min(1, g.tug));
        g.F += (Ft - g.F) * Math.min(1, dt * 8);
        g.wig = Math.max(0, g.wig - dt * 1.4);
        g.tiltT *= Math.max(0, 1 - dt * 3);
        const cap = giantSlot ? GIANT_CAPS[arrived] : 1;
        const rate = Math.pow(g.F, 1.3) * (1 + Math.min(1, g.wig) * 0.9) / sz.need * (giantSlot ? 1 + arrived * 0.25 : 1);
        const before = slot.p;
        if (g.F > 0.12) { slot.p = Math.min(cap, slot.p + rate * dt); g.pullTime += dt; }
        const dp = slot.p - before;
        // 흙 갈라지는 소리와 흙 부스러기
        if (g.F > 0.3 && t - g.crackT > 0.34) {
          g.crackT = t; audio.playNoise(0.12, 0.12 + 0.18 * g.F, 300 + Math.random() * 250, 1.1);
          const { Wb } = radishDims(sz, S), rx = SLOT_U[g.cur] * W;
          for (let k = 0; k < 2 + (dp > 0 ? 2 : 0); k++) g.parts.push({ kind: 'clod', x: rx + (Math.random() > 0.5 ? 1 : -1) * Wb * (0.35 + Math.random() * 0.2), y: gy - S * 0.01, vx: (Math.random() - 0.5) * S * 0.8, vy: -S * (0.3 + Math.random() * 0.6), born: t, life: 1.4, r: S * (0.007 + Math.random() * 0.012), col: Math.random() > 0.5 ? '#7a4f2e' : '#a8774c' });
        }
        if (g.F > 0.55 && Math.random() < dt * 2.5) g.parts.push({ kind: 'sweat', x: yx + S * 0.05 + Math.random() * S * 0.1, y: gy - S * 0.85, vx: (Math.random() - 0.3) * S * 0.6, vy: -S * 0.4, born: t, life: 0.9, r: S * 0.018 });
        // 영차 소리 (다른 안내 중이면 기다림)
        if (g.F > 0.45 && t > g.voiceBusy && t - g.heaveT > 2.8) {
          g.heaveT = t;
          if (arrived > 0) { say(VOICE.radishChorus()); g.pops.push({ text: '영차 영차!', x: yx - S * 0.5, y: gy - S * 1.9, born: t, size: S * 0.13, col: '#d6336c' }); }
          else { const i = g.heaveI++ % 3; say(VOICE.radishHeave(i)); g.pops.push({ text: ['끙차!', '영차!', '으라차차!'][i], x: yx - S * 0.1, y: gy - S * 1.25, born: t, size: S * 0.12, col: '#e8590c' }); }
        }
        if (!giantSlot && !g.saidWiggle && g.pullTime > 3.5 && slot.p < 0.55 && t > g.voiceBusy) { g.saidWiggle = true; say(VOICE.radishWiggle()); }
        if (!g.saidAlmost && slot.p > 0.78 && (sz.id === 'big' || sz.id === 'giant') && t > g.voiceBusy) { g.saidAlmost = true; say(VOICE.radishAlmost()); }
        // 왕무: 한계에 막힘 → 친구 부르기
        if (giantSlot && cap < 1 && slot.p >= cap - 1e-4 && g.F > 0.3) {
          g.stuckT += dt;
          if (g.stuckT > 1.1 && !g.stuck && !g.helpers.some(h => h.walking)) {
            g.stuck = true; say(VOICE.radishStuck(RADISH_HELPERS[g.helpers.length])); sync();
          }
        }
        if (slot.p >= 1) pop();
      } else {
        g.F += (0 - g.F) * Math.min(1, dt * 6);
      }
      g.tilt += (g.tiltT - g.tilt) * Math.min(1, dt * 10);
      const F = g.F;

      // ── 친구들 위치 (왕무 줄: 유나 뒤로 엄마·아빠·강아지·고양이·생쥐) ──
      const chainX = [];
      { let x = yx;
        RADISH_HELPERS.forEach((h, k) => {
          if (h.id === 'mom') x -= S * 0.44; else if (h.id === 'dad') x -= S * 0.6; else if (h.id === 'dog') x -= S * 0.64;
          else if (h.id === 'cat') x -= dogS * 0.5 + catS * 0.5; else x -= catS * 0.55 + S * 0.2;
          chainX[k] = x;
        }); }
      g.helpers.forEach((h, k) => {
        const tx = h.leaving ? g.cam.x - W / (2 * g.cam.z) - S * 1.5 : chainX[k];
        if (h.walking) {
          const d = tx - h.x, step = S * 1.3 * dt;
          h.ph += dt * 9;
          if (Math.abs(d) <= step) {
            h.x = tx;
            if (!h.leaving) {
              h.walking = false; h.arrivedT = t; audio.playXylophone(784 + k * 120, 0.5);
              say(VOICE.radishCome(RADISH_HELPERS[k])); g.heaveT = t; sync();
            }
          } else h.x += Math.sign(d) * step;
        } else if (!h.leaving) h.x = tx;
      });
      if (g.helpers.length && g.helpers.every(h => h.leaving && h.x < g.cam.x - W / (2 * g.cam.z) - S)) g.helpers = [];

      // ── 카메라 ──
      const cam = g.cam; let cz = 1, cx = W / 2, cy = H / 2;
      if (slot && ['walk', 'pull', 'pop', 'clean', 'ready'].includes(g.phase)) {
        const rx = SLOT_U[g.cur] * W, { Wb } = radishDims(sz, S);
        if (giantSlot) {
          const n = g.helpers.filter(h => !h.leaving).length, left = n ? Math.min(chainX[n - 1], ...g.helpers.map(h => h.x)) - S * 0.35 : yx - S * 0.45;
          const right = rx + Wb * 0.8, topY = gy - (n >= 1 ? mS * 1.05 : S * 1.6), botY = gy + S * 0.2;
          cz = clamp(Math.min(W / (right - left), H / (botY - topY)) * 0.95, 1, 1.15); cx = (left + right) / 2; cy = (topY + botY) / 2;
        } else if (g.phase === 'walk') { cz = 1.1; cx = (yx + rx) / 2; cy = gy - S * 0.5; }
        else if (g.phase === 'clean' || g.phase === 'ready') { cz = clamp(0.4 * H / yS, 1, 1.35); cx = (yx + rx) / 2 + S * 0.05; cy = gy - S * 0.45; }
        else { cz = clamp(0.42 * H / yS, 1, 1.4)   /* 유나가 화면 높이의 40% 남짓 (생일 파티와 비슷한 크기) */; cx = (yx + rx) / 2; cy = gy - S * 0.5; }
      }
      if (!cam.init) { cam.x = W / 2; cam.y = H / 2; cam.z = 1; cam.init = true; }
      const ck = Math.min(1, dt * 2.6);
      cam.z += (cz - cam.z) * ck; cam.x += (cx - cam.x) * ck; cam.y += (cy - cam.y) * ck;
      cam.x = clamp(cam.x, W / (2 * cam.z), W - W / (2 * cam.z)); cam.y = clamp(cam.y, H / (2 * cam.z), H - H / (2 * cam.z));

      // ═══ 그리기 ═══
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(c, W, H, t);
      c.save(); c.translate(W / 2, H / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
      drawWorld(c, W, H, gy, S, t);

      // 유나 자세 (무 잎을 쥔 손 위치를 먼저 구한다)
      const yo = { x: yx, y: gy, dir: Y.dir, t, face: 'smile', blush: 0 };
      let yRig, gripW = null;
      const gripping = g.phase === 'pull' && slot;
      if (gripping) {
        const rx = SLOT_U[g.cur] * W, { Lb } = radishDims(sz, S), lift = Lb * (0.2 + 0.4 * slot.p);
        const topY = gy - lift;
        const gyy0 = Math.min(topY - S * 0.08, gy - yS * 0.42);   // 아기 손이 닿는 높이 (잎이 손으로 모인다)
        const gx = rx - (giantSlot ? S * 0.12 : S * 0.02) - S * 0.07 * F, gyy = gyy0;
        yRig = rigOf(LOOKS.yuna, pullPose(LOOKS.yuna, yS, F, t, [[gx - yx + S * 0.015, gyy - gy - S * 0.02], [gx - yx, gyy - gy]]));
        gripW = toWorld(yo, [(yRig.arms[0].hx + yRig.arms[1].hx) / 2, (yRig.arms[0].hy + yRig.arms[1].hy) / 2]);
        yo.face = F > 0.3 ? 'strain' : (g.stuck ? 'wow' : 'smile'); yo.blush = F;
      } else if (t - Y.fallT < 1.5) {
        const k = Math.min(1, (t - Y.fallT) / 0.25) * (t - Y.fallT > 1.25 ? Math.max(0, 1 - (t - Y.fallT - 1.25) / 0.25) : 1);
        yRig = rigOf(LOOKS.yuna, pose('fall', LOOKS.yuna, yS, { t, k })); yo.face = 'ouch';
      } else if (Y.walk) { yRig = rigOf(LOOKS.yuna, pose('walk', LOOKS.yuna, yS, { phase: Y.ph })); }
      else if (t < Y.cheerUntil || g.phase === 'alldone') { yRig = rigOf(LOOKS.yuna, pose('cheer', LOOKS.yuna, yS, { t })); yo.face = 'laugh'; }
      else if (g.phase === 'clean' || g.phase === 'pop') { yRig = rigOf(LOOKS.yuna, pose('watch', LOOKS.yuna, yS, { t })); yo.face = 'wow'; }
      else { yRig = rigOf(LOOKS.yuna, pose('stand', LOOKS.yuna, yS, { t })); }
      if (g.phase === 'pop' && t - Y.fallT > 1.5) yo.face = 'laugh';

      // 밭의 무
      const grow = easeOut((t - g.growT) / 1.2);
      g.field.forEach((s, i) => {
        const z = RADISH_SIZES[s.size], rx = SLOT_U[i] * W, { Wb, Lb } = radishDims(z, S);
        if (s.pulled || s.done) {   // 뽑힌 자리: 구멍
          ell(c, rx, gy, Wb * 0.55, S * 0.03); c.fillStyle = '#5b3a24'; c.fill();
          c.fillStyle = '#a8774c'; for (let k = 0; k < 5; k++) { ell(c, rx + (k - 2) * Wb * 0.3, gy + S * 0.02 + (k % 2) * S * 0.01, S * 0.025, S * 0.014); c.fill(); }
          return;
        }
        const active = i === g.cur && g.phase === 'pull';
        const lift = Lb * (0.2 + 0.4 * s.p) + (active ? Math.sin(t * 38) * S * 0.003 * F : 0);
        const topY = gy - lift * grow, tilt = active ? g.tilt * 0.12 : Math.sin(t * 1.2 + i) * 0.015;
        // 구멍 뒤쪽
        ell(c, rx, gy, Wb * 0.5 + s.p * S * 0.04, S * 0.022 + s.p * S * 0.01); c.fillStyle = '#5b3a24'; c.fill();
        // 몸통 (땅 위만)
        c.save(); c.beginPath(); c.rect(rx - Wb * 2, 0, Wb * 4, gy + S * 0.005); c.clip();
        c.save(); c.translate(rx, topY); c.rotate(tilt); c.scale(grow, grow); drawRadishBody(c, Wb, Lb, s.seed, null); c.restore();
        c.restore();
        // 잎
        c.save(); c.translate(rx, topY); c.rotate(tilt);
        let gl = null;
        if (active && gripW) { const dx = gripW[0] - rx, dy = gripW[1] - topY, cs = Math.cos(-tilt), sn = Math.sin(-tilt); gl = [dx * cs - dy * sn, dx * sn + dy * cs]; }
        drawLeaves(c, z, S, Wb, s.seed, t, gl, grow, active ? 0 : Math.sin(t * 0.9 + i * 2) * 0.04);
        c.restore();
        // 앞 흙 둔덕 + 갈라짐
        c.beginPath(); c.ellipse(rx, gy, Wb * 0.62 + s.p * S * 0.05, S * 0.035, 0, 0, Math.PI); c.fillStyle = '#93653f'; c.fill();
        c.fillStyle = '#a8774c'; for (let k = 0; k < 6; k++) { ell(c, rx + (k - 2.5) * Wb * 0.24, gy + S * 0.012 - s.p * S * 0.012 * (k % 2), S * (0.02 + s.p * 0.01), S * 0.012); c.fill(); }
        if (s.p > 0.05) {
          const rnd = seeded(s.seed + 11); c.strokeStyle = '#4a2e1a'; c.lineWidth = Math.max(1, S * 0.006); c.lineCap = 'round';
          for (let k = 0; k < 6; k++) {
            const sd = k % 2 ? 1 : -1, len = S * 0.14 * s.p * (0.6 + rnd()); let x = rx + sd * Wb * 0.45, y = gy + S * 0.005 + rnd() * S * 0.015;
            c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 3; j++) { x += sd * len / 3; y += (rnd() - 0.5) * S * 0.02; c.lineTo(x, y); } c.stroke();
          }
        }
      });

      // 친구들: 사람(아빠 → 엄마) → 유나 → 동물(강아지 → 고양이 → 생쥐). 동물은 앞사람 발뒤꿈치·꼬리를 무니까 위에 그린다
      const drawHelper = (k) => {
        const h = g.helpers[k], fall = h.fallT > 0 && t - h.fallT < 1.6 && t >= h.fallT;
        const fk = fall ? Math.min(1, (t - h.fallT) / 0.25) * (t - h.fallT > 1.35 ? Math.max(0, 1 - (t - h.fallT - 1.35) / 0.25) : 1) : 0;
        const pulling = !h.walking && g.phase === 'pull';
        const hF = pulling ? clamp01(F + Math.sin(t * 3 + k) * 0.05) : 0;
        const dir = h.leaving ? -1 : 1, celebrate = (g.phase === 'clean' || g.phase === 'ready' || g.phase === 'fly' || (g.phase === 'pop' && !fall)) && !h.walking;
        if (h.id === 'mom' || h.id === 'dad') {
          const L = LOOKS[h.id], ho = { x: h.x, y: gy, dir, t, face: 'smile', blush: 0 };
          let st;
          if (h.walking) st = pose('walk', L, mS, { phase: h.ph });
          else if (fall) { st = pose('fall', L, mS, { t, k: fk }); ho.face = 'ouch'; }
          else if (pulling) {
            // 앞사람 허리를 잡는다
            const front = k === 0 ? toWorld(yo, yRig.waist) : g.helpers[k - 1].waistW || [h.x + S * 0.4, gy - S * 0.6];
            st = pullPose(L, mS, hF, t + k, [[front[0] - h.x - S * 0.03, front[1] - gy + S * 0.02], [front[0] - h.x, front[1] - gy]]);
            st.lean = lerp(0.3, -0.25, hF);
            ho.face = hF > 0.3 ? 'strain' : 'smile'; ho.blush = hF * 0.8;
          } else if (celebrate) { st = pose('cheer', L, mS, { t: t + k }); ho.face = 'laugh'; }
          else st = pose('stand', L, mS, { t });
          const rig = rigOf(L, st);
          h.waistW = toWorld(ho, rig.waist);
          drawPerson(c, L, rig, ho);
        } else if (h.id === 'mouse') {
          c.save(); c.translate(h.x, gy); c.scale(dir, 1); c.rotate(fall ? -0.6 * fk : -0.12 * hF);
          drawMouse(c, S * 0.95, t, hF, h.walking); c.restore();
        } else {
          const sp = FARM_BY_ID[h.id], aS = h.id === 'dog' ? dogS : catS;
          c.save(); c.translate(h.x - (pulling ? S * 0.03 * hF : 0), gy); c.scale(dir, 1); c.rotate(fall ? -0.5 * fk : -0.14 * hF);
          if (celebrate) c.translate(0, -Math.abs(Math.sin(t * 6 + k)) * S * 0.06);
          drawAnimal(c, sp, aS, { phase: h.ph, moving: h.walking ? 1 : 0, growth: 1, t, wag: true, blink: hF > 0.3 });
          c.restore();
        }
        if (fall && fk > 0.5) {   // 빙글빙글 별
          const hy = h.id === 'mom' || h.id === 'dad' ? gy - mS * 0.35 : gy - S * 0.45;
          for (let s2 = 0; s2 < 3; s2++) { const a = t * 5 + s2 * TAU / 3; drawStar(c, h.x + Math.cos(a) * S * 0.12, hy + Math.sin(a) * S * 0.04, S * 0.025, '#ffd43b', a); }
        }
      };
      const isPerson = (k) => g.helpers[k].id === 'mom' || g.helpers[k].id === 'dad';
      for (let k = g.helpers.length - 1; k >= 0; k--) if (isPerson(k)) drawHelper(k);

      // 유나
      drawPerson(c, LOOKS.yuna, yRig, yo);
      if (yo.face === 'ouch') { const hd = toWorld(yo, yRig.head); for (let s2 = 0; s2 < 3; s2++) { const a = t * 5 + s2 * TAU / 3; drawStar(c, hd[0] + Math.cos(a) * S * 0.2, hd[1] - S * 0.22 + Math.sin(a) * S * 0.05, S * 0.03, '#ffd43b', a); } }
      for (let k = 0; k < g.helpers.length; k++) if (!isPerson(k)) drawHelper(k);

      // 뽑힌 무 (날아가 눕기 → 흙 털기)
      const L = g.loose;
      if (L) {
        const z = RADISH_SIZES[L.size], { Wb, Lb } = radishDims(z, S);
        const k = clamp01((t - g.popT) / 0.85), e = easeOut(k);
        if (g.phase === 'pop' && k < 1) {
          L.x = lerp(L.x0, L.x1, e); L.y = lerp(L.y0, L.y1, k) - Math.sin(k * Math.PI) * S * (L.size === 'giant' ? 0.4 : 0.7); L.rot = lerp(L.r0, L.r1, e);
          if (k > 0.97 && !L.landed) { L.landed = true; audio.playFreq(110, 'sine', 0.2, 0.6); for (let q = 0; q < 12; q++) g.parts.push({ kind: 'clod', x: L.x + (Math.random() - 0.5) * Lb, y: gy, vx: (Math.random() - 0.5) * S, vy: -S * Math.random() * 0.6, born: t, life: 1, r: S * 0.012, col: '#a8774c' }); }
        } else { L.x = L.x1; L.y = L.y1; L.rot = L.r1; }
        ell(c, L.x, gy + S * 0.005, Lb * 0.55, S * 0.03); c.fillStyle = 'rgba(60,40,20,0.2)'; c.fill();
        c.save(); c.translate(L.x, L.y); c.rotate(L.rot); c.translate(0, -Lb / 2);
        drawLeaves(c, z, S, Wb, L.seed, t, null, 1, 0);
        drawRadishBody(c, Wb, Lb, L.seed, L.dirt);
        if (g.phase === 'ready') { for (let q = 0; q < 4; q++) { const a = t * 2 + q * TAU / 4; drawStar(c, Math.cos(a) * Wb * 0.7, Lb * 0.5 + Math.sin(a) * Lb * 0.45, S * 0.025, '#fffbe0', a); } }
        c.restore();
        if (g.phase === 'clean') {   // 문지르는 곳 안내: 손 그림이 오가며 흔들
          const hx = L.x + Math.sin(t * 4) * Lb * 0.25, hy = L.y - Wb * 0.1;
          c.save(); c.globalAlpha = 0.85; c.font = `${Math.round(S * 0.14)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('👆', hx, hy + S * 0.06); c.restore();
        }
      }

      // 당기기 안내 손가락 (처음 잡았을 때)
      if (g.phase === 'pull' && slot && slot.p < 0.04 && !g.pull && gripW) {
        const q = (t * 0.9) % 1;
        c.save(); c.globalAlpha = 0.9 * (1 - Math.max(0, q - 0.8) * 5); c.font = `${Math.round(S * 0.15)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('👆', gripW[0] + S * 0.15, gripW[1] + S * 0.1 - easeOut(q / 0.8) * S * 0.3); c.restore();
      }

      // 조각들
      g.parts = g.parts.filter(p => t - p.born < p.life);
      g.parts.forEach(p => {
        const e = (t - p.born) / p.life;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'clod') { p.vy += S * 4 * dt; if (p.y > gy + S * 0.03 && p.vy > 0) { p.y = gy + S * 0.03; p.vy *= -0.3; p.vx *= 0.6; } c.globalAlpha = 1 - Math.max(0, e - 0.7) / 0.3; ell(c, p.x, p.y, p.r, p.r * 0.8); c.fillStyle = p.col; c.fill(); c.globalAlpha = 1; }
        else if (p.kind === 'sweat') { p.vy += S * 2 * dt; c.globalAlpha = 1 - e; c.fillStyle = '#74c0fc'; c.beginPath(); c.moveTo(p.x, p.y - p.r * 1.6); c.quadraticCurveTo(p.x + p.r, p.y, p.x, p.y + p.r); c.quadraticCurveTo(p.x - p.r, p.y, p.x, p.y - p.r * 1.6); c.fill(); c.globalAlpha = 1; }
        else { p.vy += 160 * dt; c.globalAlpha = 1 - e; drawStar(c, p.x, p.y, p.r / cam.z * 1.4, p.col, p.rot + e * 4); c.globalAlpha = 1; }
      });
      g.pops = g.pops.filter(p => t - p.born < 1.4);
      g.pops.forEach(p => { const e = (t - p.born) / 1.4; bubble(c, p.text, p.x, p.y - e * S * 0.12, p.size * (0.8 + easeOut(e * 4) * 0.2), 1 - Math.max(0, e - 0.7) / 0.3, p.col); });
      c.restore();

      // ── 화면 고정: 바구니 · 날아가는 무 ──
      const B = basketBox(W, H);
      g.bump = Math.max(0, g.bump - dt * 3);
      drawBasket(c, B, g.basket, t, Math.sin(g.bump * Math.PI) * g.bump);
      if (g.fly) {
        const f = g.fly, k = clamp01((t - f.t0) / 0.8), e = easeOut(k), z = RADISH_SIZES[f.size];
        const tx = B.x + B.w / 2, ty = B.y + B.h * 0.1;
        const x = lerp(f.sx, tx, e), y = lerp(f.sy, ty, k) - Math.sin(k * Math.PI) * H * 0.25, sc = lerp(f.scale, 0.45, e);
        const { Wb, Lb } = radishDims(z, S);
        c.save(); c.translate(x, y); c.rotate(lerp(f.rot, f.rot + TAU, e)); c.scale(sc, sc); c.translate(0, -Lb / 2);
        drawLeaves(c, z, S, Wb, f.seed, t, null, 1, 0); drawRadishBody(c, Wb, Lb, f.seed, null); c.restore();
        if (k >= 1) landBasket();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const helper = RADISH_HELPERS[ui.helperIdx];
  const hint = {
    field: '👆 뽑고 싶은 무를 콕 눌러요',
    pull: ui.stuck ? '📣 친구를 불러서 같이 당겨요!' : '💪 손가락을 위로 쭉! 좌우로 흔들흔들, 톡톡 눌러도 영차!',
    clean: '🧽 무에 묻은 흙을 쓱쓱 문질러 털어요',
    ready: '🧺 무를 콕 눌러서 바구니에 쏙!'
  }[ui.phase];
  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 8px 18px -10px rgba(90,60,20,0.55)', whiteSpace: 'nowrap' });
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={resetField} style={btn('#ebfbee', '#2b8a3e')}>🌱 새 밭</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#5c3d1e', minWidth: '160px' }}>유나의 무 뽑기</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {ui.field.map((s, i) => (
            <span key={i} title={RADISH_SIZES[s.size].name} style={{ minWidth: '40px', height: '40px', padding: '0 6px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: JUA, fontSize: s.size === 'giant' ? '0.95rem' : '1.2rem',
              background: s.done ? '#d3f9d8' : '#fff4e6', color: '#7a4a1f', opacity: s.done ? 1 : 0.7 }}>
              {s.done ? '✅' : s.size === 'giant' ? '왕무' : '🌱'}
            </span>
          ))}
          <span style={{ fontFamily: JUA, fontSize: '0.95rem', color: '#8a6a4a', marginLeft: '6px', whiteSpace: 'nowrap' }}>지금까지 {ui.total}개</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(120,80,30,0.55)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
        {hint && <div style={{ position: 'absolute', left: 0, right: 0, top: '12px', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.2rem', color: '#7a4a1f', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
        {ui.phase === 'pull' && ui.stuck && helper && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '6%', display: 'flex', justifyContent: 'center' }}>
            <button onClick={callHelper} style={{ ...btn('#f06595'), minHeight: '68px', fontSize: '1.5rem', padding: '0 30px', animation: 'bpsRadishPulse 1s ease-in-out infinite' }}>📣 {helper.call}, 도와주세요!</button>
          </div>
        )}
        {ui.phase === 'alldone' && (
          <div style={{ position: 'absolute', right: '3%', top: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#e8590c', textShadow: '0 3px 0 #fff' }}>🎉 무를 모두 뽑았어요!</div>
            <button onClick={resetField} style={btn('#40c057')}>🌱 새 밭에서 또 뽑기</button>
          </div>
        )}
        <style>{'@keyframes bpsRadishPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(240,101,149,0.55); } 50% { box-shadow: 0 0 0 14px rgba(240,101,149,0); } }'}</style>
      </div>
    </div>
  );
}

