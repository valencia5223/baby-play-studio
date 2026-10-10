import { useEffect, useRef, useState } from 'react';
import { VOICE, attachJosa } from './voiceLines.js';
import {
  FARM_SPECIES, FARM_BY_ID, farmSpeciesOf, FARM_STAGE_NAMES, farmStageOf, farmSizeScale,
  FARM_RATES, FARM_SLEEP_IDLE_SEC, isFarmNight, farmDirt, isFarmSad, farmCondition, farmGrowFactor,
  FARM_REWARDS, farmReleaseReward, newAnimal, loadFarm, saveFarm, catchUpFarm, farmTodayKey
} from './farmData.js';

// ═════════════════════════════════════════════════════════════════════════════
// 🐮 내 목장 — 다마고치형 동물 키우기 (내 어항의 육지판)
// 캔버스 한 장에 하늘·목장 배경·동물·먹이·똥·선물을 그린다. 위치는 매 프레임 ref 로 갱신하고
// 상단 상태(별·깨끗함)만 0.4초마다 state 로 반영한다. 규칙·저장은 farmData.js.
// ═════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
// '#rrggbb' 또는 mixColor 가 돌려준 'rgb(r,g,b)' 를 숫자 셋으로
const hex3 = (c) => (c[0] === '#' ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : c.slice(4, -1).split(',').map(Number));
const mixColor = (a, b, t) => { const A = hex3(a), B = hex3(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
// 배경이 화면 크기가 바뀌어도 같은 모양이 되게 하는 고정 난수
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// 실제 시계에 따른 어둠 0~1 (아침 8시~오후 5시 환함, 저녁에 점점 어두워져 저녁 7시 반~아침 6시는 밤)
const farmDark = (d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 8 && h < 17) return 0;
  if (h >= 17 && h < 19.5) return (h - 17) / 2.5;
  if (h >= 6 && h < 8) return 1 - (h - 6) / 2;
  return 1;
};

const rr = (ctx, x, y, w, h, rad) => {
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
};
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };

// ═══════════════════════════════ 동물 그림 ═══════════════════════════════
// 원점은 발이 닿는 땅, 오른쪽을 보는 모습. S 는 몸 크기 기준(px).
// o: { phase(걸음), moving, growth, sleep, lie(0~1 엎드림), eat(0~1 고개 숙임), wag, mud, t }
function drawEye(ctx, x, y, r, closed, ring) {
  if (ring) { ctx.fillStyle = '#ffffff'; ell(ctx, x, y, r * 1.5, r * 1.5); ctx.fill(); }
  if (closed) {
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1, r * 0.45); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - r * 0.2, r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    return;
  }
  ctx.fillStyle = '#1f2937'; ell(ctx, x, y, r, r * 1.08); ctx.fill();
  ctx.fillStyle = '#ffffff'; ell(ctx, x - r * 0.3, y - r * 0.35, r * 0.36, r * 0.36); ctx.fill();
}

function drawMud(ctx, mud, S, cy, w, h) {
  if (mud < 20) return;
  ctx.fillStyle = `rgba(120,72,38,${clamp((mud - 20) / 80, 0, 1) * 0.85})`;
  [[-0.5, 0.35, 0.3], [0.1, 0.5, 0.36], [0.55, 0.15, 0.24], [-0.15, -0.2, 0.2], [0.35, -0.45, 0.16]].forEach(([px, py, pr], i) => {
    if (mud < 20 + i * 14) return;
    ell(ctx, px * w, cy + py * h, pr * S * 0.42, pr * S * 0.3, i); ctx.fill();
  });
}

function drawQuad(ctx, sp, S, o) {
  const lie = o.sleep ? 1 : (o.lie || 0);
  const bw = S * 0.5 * sp.bodyLen, bh = S * 0.29 * (sp.fat || 1);
  const legL = S * sp.legLen * (1 - lie * 0.88);
  const hopY = sp.hop && o.moving ? -Math.abs(Math.sin(o.phase)) * S * 0.22 : 0;
  const by = -(legL + bh * 0.82) + hopY;
  const outline = 'rgba(60,40,20,0.28)';
  const hoofed = sp.snout === 'cow' || sp.snout === 'horse' || sp.darkFace;
  const legCol = sp.darkFace ? sp.accent : mixColor(sp.body, '#000000', 0.07);
  const hoofCol = hoofed ? mixColor(sp.accent, '#000000', 0.25) : sp.snout === 'pig' ? sp.accent : sp.belly;
  const lw = S * 0.115, legLen = legL + bh * 0.34;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // 다리 (먼 쪽은 어둡게, 모두 몸 아래로)
  const leg = (x, ph, far) => {
    const a = !o.moving ? 0 : sp.hop ? Math.sin(o.phase) * 0.55 * (x > 0 ? 1 : -1) : Math.sin(o.phase + ph) * 0.5;
    ctx.save(); ctx.translate(x, by + bh * 0.48); ctx.rotate(a);
    ctx.fillStyle = far ? mixColor(sp.darkFace ? sp.accent : sp.body, '#000000', sp.darkFace ? 0.25 : 0.2) : legCol;
    rr(ctx, -lw / 2, 0, lw, legLen, lw * 0.45); ctx.fill();
    if (legLen > S * 0.08) { ctx.fillStyle = hoofCol; rr(ctx, -lw / 2, legLen * 0.78, lw, legLen * 0.22, lw * 0.35); ctx.fill(); }
    ctx.restore();
  };
  leg(-bw * 0.52 + S * 0.07, Math.PI, true); leg(bw * 0.5 + S * 0.07, 0, true);
  leg(-bw * 0.6, 0, false); leg(bw * 0.42, Math.PI, false);

  // 꼬리
  const tx = -bw * 0.92, ty = by - bh * 0.25, wagA = o.wag ? Math.sin(o.t * 14) * 0.5 : 0;
  if (sp.tail === 'puff') {
    ctx.fillStyle = sp.wool ? sp.body : sp.belly; ell(ctx, tx - S * 0.03, ty + bh * 0.2, S * 0.1, S * 0.1); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
  } else if (sp.tail === 'wag') {
    ctx.save(); ctx.translate(tx + S * 0.03, ty); ctx.rotate(wagA);
    ctx.strokeStyle = sp.body; ctx.lineWidth = S * 0.085;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-S * 0.16, -S * 0.08, -S * 0.2, -S * 0.3); ctx.stroke();
    ctx.restore();
  } else if (sp.tail === 'long') {
    ctx.strokeStyle = sp.body; ctx.lineWidth = S * 0.075;
    ctx.beginPath(); ctx.moveTo(tx + S * 0.04, ty);
    ctx.bezierCurveTo(tx - S * 0.25, ty + S * 0.02, tx - S * 0.32, ty - S * 0.38, tx - S * 0.12 + Math.sin(o.t * 2) * S * 0.06, ty - S * 0.52); ctx.stroke();
  } else if (sp.tail === 'curl') {
    ctx.strokeStyle = sp.accent; ctx.lineWidth = S * 0.04;
    ctx.beginPath(); ctx.arc(tx - S * 0.06, ty, S * 0.06, 0, TAU * 0.85); ctx.stroke();
  } else if (sp.tail === 'tuft') {
    const ex = tx - S * 0.07 + Math.sin(o.t * 3) * S * 0.04, ey = ty + bh * 1.35;
    ctx.strokeStyle = mixColor(sp.body, '#000000', 0.15); ctx.lineWidth = S * 0.03;
    ctx.beginPath(); ctx.moveTo(tx + S * 0.03, ty); ctx.quadraticCurveTo(tx - S * 0.12, ty + bh * 0.3, ex, ey); ctx.stroke();
    ctx.fillStyle = sp.accent; ell(ctx, ex, ey + S * 0.04, S * 0.04, S * 0.07); ctx.fill();
  } else if (sp.tail === 'horse') {
    ctx.strokeStyle = sp.accent; ctx.lineWidth = S * 0.13;
    ctx.beginPath(); ctx.moveTo(tx + S * 0.04, ty);
    ctx.quadraticCurveTo(tx - S * 0.24, ty + S * 0.02, tx - S * 0.18 + Math.sin(o.t * 2.5) * S * 0.05, ty + bh * 1.7); ctx.stroke();
  }

  // 몸
  if (sp.wool) {
    ctx.fillStyle = sp.body; ctx.strokeStyle = outline; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ell(ctx, Math.cos(a) * bw * 0.9, by + Math.sin(a) * bh * 0.88, S * 0.12, S * 0.12); ctx.fill(); ctx.stroke();
    }
  }
  ell(ctx, 0, by, bw, bh); ctx.fillStyle = sp.body; ctx.fill();
  if (!sp.wool) { ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, S * 0.012); ctx.stroke(); }
  ctx.save(); ell(ctx, 0, by, bw, bh); ctx.clip();
  ctx.fillStyle = sp.belly; ell(ctx, 0, by + bh * 0.62, bw * 0.8, bh * 0.5); ctx.fill();
  if (sp.spots) {
    ctx.fillStyle = sp.accent;
    ell(ctx, -bw * 0.5, by - bh * 0.4, bw * 0.34, bh * 0.5, 0.4); ctx.fill();
    ell(ctx, bw * 0.12, by - bh * 0.1, bw * 0.24, bh * 0.4, -0.3); ctx.fill();
    ell(ctx, bw * 0.55, by - bh * 0.7, bw * 0.22, bh * 0.35, 0.2); ctx.fill();
  }
  if (sp.stripes) {
    ctx.strokeStyle = sp.accent; ctx.lineWidth = S * 0.045;
    [-0.45, -0.1, 0.25].forEach(q => { ctx.beginPath(); ctx.moveTo(bw * q, by - bh); ctx.lineTo(bw * (q - 0.06), by - bh * 0.35); ctx.stroke(); });
  }
  drawMud(ctx, o.mud || 0, S, by, bw, bh);
  ctx.restore();

  // 목과 머리
  const hs = S * sp.headSize * 0.5, e = o.eat || 0, horse = sp.snout === 'horse';
  const lift = horse ? S * 0.34 : sp.snout === 'cow' ? S * 0.03 : S * 0.1;
  let hx = bw * 0.78 + (horse ? S * 0.16 : hs * 0.55) + e * S * 0.08;
  let hy = by - bh * 0.45 - lift + e * (lift + bh * 0.95 + legL * 0.55);
  if (lie > 0) { hx = lerp(hx, bw * 0.85 + hs * 0.3, lie); hy = lerp(hy, by + bh * 0.15, lie); }
  const hc = sp.darkFace ? sp.accent : sp.body;
  if (sp.mane) {
    ctx.strokeStyle = sp.accent; ctx.lineWidth = hs * 0.75;
    ctx.beginPath(); ctx.moveTo(bw * 0.5, by - bh * 0.75); ctx.lineTo(hx - hs * 0.75, hy - hs * 0.45); ctx.stroke();
  }
  ctx.strokeStyle = sp.wool ? sp.body : hc; ctx.lineWidth = hs * (horse ? 1.15 : 1.3);
  ctx.beginPath(); ctx.moveTo(bw * 0.62, by - bh * 0.3); ctx.lineTo(hx - hs * 0.2, hy + hs * 0.2); ctx.stroke();

  // 뒤쪽 귀·뿔
  if (sp.horns) {
    ctx.fillStyle = '#fef3c7';
    ell(ctx, hx - hs * 0.35, hy - hs * 0.95, hs * 0.13, hs * 0.36, -0.3); ctx.fill();
    ell(ctx, hx + hs * 0.25, hy - hs * 0.98, hs * 0.13, hs * 0.36, 0.3); ctx.fill();
  }
  if (sp.ear === 'long') {
    [[-0.3, -0.22], [0.12, 0.06]].forEach(([q, rot]) => {
      ctx.fillStyle = sp.body; ell(ctx, hx + hs * q, hy - hs * 1.45, hs * 0.27, hs * 0.88, rot); ctx.fill();
      ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = sp.accent; ell(ctx, hx + hs * q, hy - hs * 1.42, hs * 0.13, hs * 0.62, rot); ctx.fill();
    });
  } else if (sp.ear === 'point') {
    [[0.05, true], [-0.5, false]].forEach(([q, far]) => {
      const x = hx + hs * q;
      ctx.fillStyle = far ? mixColor(sp.body, '#000000', 0.18) : sp.body;
      ctx.beginPath(); ctx.moveTo(x - hs * 0.32, hy - hs * 0.55); ctx.lineTo(x + hs * 0.02, hy - hs * 1.5); ctx.lineTo(x + hs * 0.38, hy - hs * 0.65); ctx.closePath(); ctx.fill();
      if (!far && sp.snout === 'cat') { ctx.fillStyle = '#fda4af'; ctx.beginPath(); ctx.moveTo(x - hs * 0.15, hy - hs * 0.7); ctx.lineTo(x + hs * 0.03, hy - hs * 1.25); ctx.lineTo(x + hs * 0.2, hy - hs * 0.75); ctx.closePath(); ctx.fill(); }
    });
  } else if (sp.ear === 'side') {
    ctx.fillStyle = sp.spots ? sp.accent : hc; ell(ctx, hx - hs * 0.85, hy - hs * 0.45, hs * 0.5, hs * 0.24, -0.4); ctx.fill();
  }

  // 머리
  ell(ctx, hx, hy, hs * 1.05, hs * 0.95); ctx.fillStyle = hc; ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, S * 0.012); ctx.stroke();
  if (sp.wool) { ctx.fillStyle = sp.body; [-0.45, 0, 0.4].forEach(q => { ell(ctx, hx + hs * q, hy - hs * 0.85, hs * 0.36, hs * 0.34); ctx.fill(); }); }
  if (sp.mane) { ctx.fillStyle = sp.accent; ell(ctx, hx + hs * 0.05, hy - hs * 0.88, hs * 0.5, hs * 0.26, 0.3); ctx.fill(); }

  // 주둥이
  const dark = '#1f2937';
  if (sp.snout === 'dog') {
    ctx.fillStyle = sp.belly; ell(ctx, hx + hs * 0.62, hy + hs * 0.28, hs * 0.52, hs * 0.4); ctx.fill();
    ctx.fillStyle = dark; ell(ctx, hx + hs * 1.04, hy + hs * 0.12, hs * 0.16, hs * 0.14); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, hs * 0.06);
    ctx.beginPath(); ctx.arc(hx + hs * 0.75, hy + hs * 0.3, hs * 0.22, 0.1 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else if (sp.snout === 'cat') {
    ctx.fillStyle = sp.belly; ell(ctx, hx + hs * 0.6, hy + hs * 0.32, hs * 0.4, hs * 0.3); ctx.fill();
    ctx.fillStyle = '#fb7185'; ell(ctx, hx + hs * 0.9, hy + hs * 0.2, hs * 0.1, hs * 0.08); ctx.fill();
    ctx.strokeStyle = 'rgba(31,41,55,0.6)'; ctx.lineWidth = Math.max(0.8, hs * 0.035);
    [-0.05, 0.14].forEach(q => { ctx.beginPath(); ctx.moveTo(hx + hs * 0.7, hy + hs * 0.36); ctx.lineTo(hx + hs * 1.45, hy + hs * (0.32 + q * 2)); ctx.stroke(); });
  } else if (sp.snout === 'pig') {
    ctx.fillStyle = sp.accent; ell(ctx, hx + hs * 0.84, hy + hs * 0.18, hs * 0.34, hs * 0.42); ctx.fill();
    ctx.fillStyle = 'rgba(131,24,67,0.55)'; ell(ctx, hx + hs * 0.9, hy + hs * 0.04, hs * 0.07, hs * 0.1); ctx.fill(); ell(ctx, hx + hs * 0.9, hy + hs * 0.32, hs * 0.07, hs * 0.1); ctx.fill();
  } else if (sp.snout === 'cow') {
    ctx.fillStyle = '#fbcfe8'; ell(ctx, hx + hs * 0.55, hy + hs * 0.45, hs * 0.68, hs * 0.48); ctx.fill();
    ctx.fillStyle = 'rgba(131,24,67,0.5)'; ell(ctx, hx + hs * 0.6, hy + hs * 0.4, hs * 0.08, hs * 0.11); ctx.fill(); ell(ctx, hx + hs * 0.98, hy + hs * 0.38, hs * 0.08, hs * 0.11); ctx.fill();
  } else if (horse) {
    ctx.fillStyle = sp.body; ell(ctx, hx + hs * 0.72, hy + hs * 0.45, hs * 0.8, hs * 0.5, 0.5); ctx.fill();
    ctx.fillStyle = sp.belly; ell(ctx, hx + hs * 1.15, hy + hs * 0.78, hs * 0.36, hs * 0.32, 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(31,41,55,0.7)'; ell(ctx, hx + hs * 1.28, hy + hs * 0.72, hs * 0.07, hs * 0.09); ctx.fill();
  } else {
    ctx.fillStyle = sp.darkFace ? '#111827' : sp.accent; ell(ctx, hx + hs * 0.98, hy + hs * 0.15, hs * 0.11, hs * 0.09); ctx.fill();
  }

  // 눈·볼
  drawEye(ctx, hx + hs * 0.32, hy - hs * 0.15, hs * 0.2, o.sleep || o.blink, sp.darkFace);
  if (!sp.darkFace && sp.snout !== 'pig') { ctx.fillStyle = 'rgba(251,113,133,0.4)'; ell(ctx, hx + hs * 0.08, hy + hs * 0.38, hs * 0.22, hs * 0.14); ctx.fill(); }

  // 앞쪽 귀 (머리 위에 덮이는 귀)
  if (sp.ear === 'flop') { ctx.fillStyle = sp.accent; ell(ctx, hx - hs * 0.55, hy + hs * 0.08, hs * 0.36, hs * 0.75, 0.25); ctx.fill(); }
  if (sp.ear === 'fold') {
    ctx.fillStyle = sp.accent;
    ctx.beginPath(); ctx.moveTo(hx - hs * 0.55, hy - hs * 0.85); ctx.lineTo(hx + hs * 0.08, hy - hs * 0.78); ctx.lineTo(hx - hs * 0.05, hy - hs * 0.2); ctx.closePath(); ctx.fill();
  }
}

function drawBird(ctx, sp, S, o) {
  const chick = o.growth < 0.8;
  const body = chick ? sp.babyBody : sp.body;
  const outline = 'rgba(60,40,20,0.3)';
  const lie = o.sleep ? 1 : (o.lie || 0);
  const bw = S * 0.36, bh = S * 0.31, legL = S * 0.2 * (1 - lie * 0.9);
  const by = -(legL + bh * 0.9);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 다리
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = S * 0.05;
  [[-S * 0.07, 0], [S * 0.09, Math.PI]].forEach(([x, ph]) => {
    const sw = o.moving ? Math.sin(o.phase + ph) * S * 0.09 : 0;
    ctx.beginPath(); ctx.moveTo(x, by + bh * 0.7); ctx.lineTo(x + sw, 0); ctx.lineTo(x + sw + S * 0.09, 0); ctx.stroke();
  });
  // 꼬리깃 (다 큰 닭)
  if (!chick) {
    ctx.fillStyle = body; ctx.strokeStyle = outline; ctx.lineWidth = 1;
    [-0.9, -0.55, -0.2].forEach(a => { ell(ctx, -bw * 0.85 + Math.cos(a - 1.2) * S * 0.12, by - bh * 0.45 + Math.sin(a - 1.2) * S * 0.12, S * 0.07, S * 0.19, a); ctx.fill(); ctx.stroke(); });
  }
  // 몸
  ell(ctx, 0, by, bw, bh); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, S * 0.015); ctx.stroke();
  ctx.save(); ell(ctx, 0, by, bw, bh); ctx.clip();
  ctx.fillStyle = chick ? mixColor(body, '#ffffff', 0.35) : sp.belly; ell(ctx, bw * 0.15, by + bh * 0.6, bw * 0.75, bh * 0.5); ctx.fill();
  drawMud(ctx, o.mud || 0, S, by, bw, bh);
  ctx.restore();
  // 날개 (기분 좋으면 파닥파닥)
  ctx.save(); ctx.translate(-bw * 0.05, by - bh * 0.05); ctx.rotate(o.wag ? Math.sin(o.t * 16) * 0.35 : 0);
  ctx.fillStyle = mixColor(body, '#000000', 0.08); ell(ctx, -bw * 0.12, bh * 0.12, bw * (chick ? 0.36 : 0.5), bh * (chick ? 0.32 : 0.44), 0.25); ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  // 머리
  const e = o.eat || 0, hr = S * (chick ? 0.21 : 0.17);
  let hx = bw * (chick ? 0.5 : 0.62) + e * S * 0.12, hy = by - bh * (chick ? 0.6 : 0.95) + e * S * 0.5;
  if (lie > 0) hy = lerp(hy, by - bh * 0.2, lie * 0.8);
  if (!chick) {
    ctx.strokeStyle = body; ctx.lineWidth = hr * 1.4;
    ctx.beginPath(); ctx.moveTo(bw * 0.45, by - bh * 0.3); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = sp.accent;
    [-0.5, 0, 0.5].forEach((q, i) => { ell(ctx, hx + hr * q, hy - hr * (0.95 + (i === 1 ? 0.18 : 0)), hr * 0.34, hr * 0.38); ctx.fill(); });
    ell(ctx, hx + hr * 0.75, hy + hr * 0.75, hr * 0.22, hr * 0.38); ctx.fill();
  }
  ell(ctx, hx, hy, hr, hr); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, S * 0.015); ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.moveTo(hx + hr * 0.82, hy - hr * 0.2); ctx.lineTo(hx + hr * 1.55, hy + hr * 0.12); ctx.lineTo(hx + hr * 0.82, hy + hr * 0.42); ctx.closePath(); ctx.fill();
  drawEye(ctx, hx + hr * 0.3, hy - hr * 0.15, hr * 0.2, o.sleep || o.blink, false);
  ctx.fillStyle = 'rgba(251,113,133,0.4)'; ell(ctx, hx + hr * 0.15, hy + hr * 0.4, hr * 0.24, hr * 0.15); ctx.fill();
}

export function drawAnimal(ctx, sp, S, o) {
  if (sp.shape === 'bird') drawBird(ctx, sp, S, o); else drawQuad(ctx, sp, S, o);
}

// ═══════════════════════════════ 상점 미리보기·버튼 ═══════════════════════════════
function AnimalPreview({ species }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 120 * d; c.height = 92 * d;
    ctx.scale(d, d);
    const tall = species.shape === 'bird' ? 1.15 : species.legLen + 0.6 * (species.fat || 1) + (species.snout === 'horse' ? 0.6 : species.ear === 'long' ? 0.75 : 0.32);
    const long = species.shape === 'bird' ? 1 : species.bodyLen + species.headSize * 0.9;
    const S = Math.min(78 / tall, 104 / long);
    ctx.translate(60 - S * (species.shape === 'bird' ? 0.05 : 0.16), 86);
    drawAnimal(ctx, species, S, { phase: 0.6, moving: 0, growth: species.babyName ? 0.1 : 1, t: 0 });
  }, [species]);
  return <canvas ref={ref} style={{ width: 120, height: 92 }} />;
}

// 큰 둥근 그림 버튼 (아래 작은 글자는 부모용)
function FarmButton({ icon, label, color, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: '68px', height: '68px', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation',
        background: color, border: active ? '4px solid #ffffff' : '4px solid rgba(255,255,255,0.35)',
        boxShadow: active ? '0 0 0 4px #facc15, 0 6px 14px rgba(0,0,0,0.25)' : '0 6px 14px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0, position: 'relative'
      }}
    >
      {badge ? (
        <span style={{
          position: 'absolute', top: '-4px', right: '-4px', minWidth: '24px', height: '24px', borderRadius: '12px', background: '#ef4444',
          color: '#ffffff', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ffffff'
        }}>{badge}</span>
      ) : null}
      <span style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ffffff', marginTop: '1px' }}>{label}</span>
    </button>
  );
}

function CleanMeter({ value }) {
  const face = value >= 60 ? '😊' : value >= 30 ? '😐' : '😣';
  const col = value >= 60 ? '#86efac' : value >= 30 ? '#facc15' : '#f43f5e';
  return (
    <div title="목장 깨끗함" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '18px', padding: '6px 10px' }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🧼</span>
      <div style={{ width: '64px', height: '12px', background: 'rgba(255,255,255,0.3)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: '8px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{face}</span>
    </div>
  );
}

// ═══════════════════════════════ 본체 ═══════════════════════════════
// animals: 생생 동물 카드 목록(REAL_ANIMALS) — 누르면 그 동물의 진짜 울음소리를 낸다
export default function FarmGame({ audio, speak, animals = [] }) {
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const modeRef = useRef('play');

  const [hud, setHud] = useState({ points: 0, clean: 100, sick: 0, night: isFarmNight() });
  const [mode, setModeState] = useState('play');
  const [shopOpen, setShopOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [, setInfoTick] = useState(0);
  const [toast, setToast] = useState(null);
  const [full, setFull] = useState(false);

  const setMode = (m) => { modeRef.current = m; setModeState(m); };
  const showToast = (text) => setToast({ text, key: Date.now() });
  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(tm);
  }, [toast]);

  // ── 시뮬레이션 & 렌더 루프 ──
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const soundById = Object.fromEntries(animals.map(a => [a.id, a]));

    const game = loadFarm();
    const offline = catchUpFarm(game);
    const s = {
      game, W: 0, H: 0, dpr: 1, t: 0, k: 1, hz: 0, fieldTop: 0, fieldBot: 0,
      rt: {}, food: [], gifts: [], fx: [], layer: null, barnWin: null,
      pointer: { down: false, x: 0, y: 0 },
      dark: farmDark(), night: isFarmNight(), sleeping: false, lastActive: 0,
      lastSave: 0, lastHud: 0, lastVoice: {}, lastYum: -9, lastBubble: -9, lastSound: -9, nagT: 8, clockT: 0
    };
    simRef.current = s;

    offline.grown.forEach(a => { game.points += farmStageOf(a.growth) === 'adult' ? FARM_REWARDS.adult : FARM_REWARDS.young; });
    const timers = [];
    const after = (fn, ms) => timers.push(setTimeout(fn, ms));
    if (!game.welcomed) {
      game.welcomed = true; game.lastDaily = farmTodayKey();
      after(() => speak(VOICE.farmWelcome()), 500);
    } else if (game.lastDaily !== farmTodayKey()) {
      game.lastDaily = farmTodayKey(); game.points += FARM_REWARDS.daily;
      after(() => speak(VOICE.farmWelcomeBack()), 500);
      after(() => showToast(`🎁 오늘의 선물! 별 +${FARM_REWARDS.daily}`), 400);
    }
    if (offline.grown.length) after(() => showToast(`🌱 그동안 ${offline.grown.length}마리가 자랐어요!`), 3200);
    if (offline.sick.length) after(() => { showToast(`🩹 그동안 ${offline.sick.length}마리가 아파졌어요! 밴드를 붙여 주세요`); speak(VOICE.farmSick()); }, 6000);
    saveFarm(game);
    game.animals.forEach(a => { if (a.name && audio.preloadVoice) audio.preloadVoice(VOICE.farmHello(farmSpeciesOf(a), a.name)); });

    const say = (key, line, gap = 0) => {
      if (gap && s.t - (s.lastVoice[key] ?? -1e9) < gap) return;
      s.lastVoice[key] = s.t;
      speak(line);
    };
    s.say = say;
    const addPoints = (n, x, y) => {
      game.points += n;
      if (x != null) s.fx.push({ x, y, text: `+${n} ⭐`, life: 1.4, vy: -34 });
    };

    const yOf = (d) => lerp(s.fieldTop, s.fieldBot, d);
    const scaleOf = (d) => (0.52 + 0.42 * d) * s.k;
    const sizeOf = (a, r) => FARM_BY_ID[a.sp].size * farmSizeScale(a.growth) * scaleOf(r.d);

    // ── 고정 배경(언덕·헛간·나무·울타리·풀밭)은 크기가 바뀔 때만 다시 그린다 ──
    const buildLayer = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(s.W * s.dpr); c.height = Math.round(s.H * s.dpr);
      const g = c.getContext('2d'); g.scale(s.dpr, s.dpr);
      const { W, H, hz, k } = s, rnd = seeded(20240611);
      // 먼 언덕
      [['#a7d98b', 0.1, 0.006, 0], ['#86c96a', 0.065, 0.011, 2]].forEach(([col, amp, fq, off]) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - H * amp * (0.55 + 0.45 * Math.sin(x * fq + off)) + H * 0.03);
        g.lineTo(W, H); g.closePath(); g.fill();
      });
      // 풀밭
      const fg = g.createLinearGradient(0, hz, 0, H);
      fg.addColorStop(0, '#8fd672'); fg.addColorStop(1, '#4fae4a');
      g.fillStyle = fg; g.fillRect(0, hz, W, H - hz);
      // 헛간
      const bx = W * 0.14, bbase = hz + H * 0.035, bwid = clamp(W * 0.2, 100, 230), bhei = bwid * 0.62;
      g.fillStyle = '#dc2626'; g.fillRect(bx - bwid / 2, bbase - bhei, bwid, bhei);
      g.fillStyle = '#7f1d1d';
      g.beginPath(); g.moveTo(bx - bwid * 0.58, bbase - bhei); g.lineTo(bx - bwid * 0.32, bbase - bhei * 1.5); g.lineTo(bx + bwid * 0.32, bbase - bhei * 1.5); g.lineTo(bx + bwid * 0.58, bbase - bhei); g.closePath(); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, bwid * 0.025);
      g.strokeRect(bx - bwid / 2, bbase - bhei, bwid, bhei);
      const dw = bwid * 0.34, dh = bhei * 0.62;
      g.fillStyle = '#991b1b'; g.fillRect(bx - dw / 2, bbase - dh, dw, dh); g.strokeRect(bx - dw / 2, bbase - dh, dw, dh);
      g.beginPath(); g.moveTo(bx - dw / 2, bbase - dh); g.lineTo(bx + dw / 2, bbase); g.moveTo(bx + dw / 2, bbase - dh); g.lineTo(bx - dw / 2, bbase); g.stroke();
      const ww = bwid * 0.16;
      s.barnWin = { x: bx - ww / 2, y: bbase - bhei * 1.28, w: ww, h: ww };
      g.fillStyle = '#fef3c7'; g.fillRect(s.barnWin.x, s.barnWin.y, ww, ww); g.strokeRect(s.barnWin.x, s.barnWin.y, ww, ww);
      // 사과나무
      const tx = W * 0.87, tb = hz + H * 0.045, th = clamp(H * 0.3, 90, 220);
      g.fillStyle = '#92400e'; g.fillRect(tx - th * 0.06, tb - th * 0.5, th * 0.12, th * 0.5);
      g.fillStyle = '#3f9d4b';
      [[0, -0.72, 0.3], [-0.2, -0.58, 0.24], [0.2, -0.58, 0.24], [0, -0.5, 0.22]].forEach(([qx, qy, qr]) => { g.beginPath(); g.arc(tx + th * qx, tb + th * qy, th * qr, 0, TAU); g.fill(); });
      g.fillStyle = '#ef4444';
      [[-0.18, -0.62], [0.12, -0.78], [0.22, -0.55], [-0.02, -0.52], [-0.28, -0.5]].forEach(([qx, qy]) => { g.beginPath(); g.arc(tx + th * qx, tb + th * qy, th * 0.035, 0, TAU); g.fill(); });
      // 울타리
      const fy = hz + H * 0.06, fh = 26 * k;
      g.strokeStyle = '#c9a66b'; g.fillStyle = '#f5e6c8'; g.lineWidth = 1.5;
      [0.35, 0.72].forEach(q => { g.fillRect(0, fy - fh * q - 2.5 * k, W, 5 * k); g.strokeRect(0, fy - fh * q - 2.5 * k, W, 5 * k); });
      for (let x = 14 * k; x < W; x += 48 * k) { rr(g, x - 4 * k, fy - fh, 8 * k, fh, 3 * k); g.fill(); g.stroke(); }
      // 풀 포기와 꽃
      for (let i = 0; i < 90; i++) {
        const d = rnd(), x = rnd() * W, y = lerp(fy + 6, H - 4, d), sz = (4 + rnd() * 5) * (0.6 + d * 0.7) * k;
        g.strokeStyle = `rgba(34,120,50,${0.35 + rnd() * 0.3})`; g.lineWidth = Math.max(1, sz * 0.22); g.lineCap = 'round';
        [-0.5, 0, 0.5].forEach(a => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * sz, y - Math.cos(a) * sz); g.stroke(); });
      }
      for (let i = 0; i < 26; i++) {
        const d = rnd(), x = rnd() * W, y = lerp(fy + 10, H - 6, d), sz = (2.2 + rnd() * 1.6) * (0.6 + d * 0.7) * k;
        g.fillStyle = ['#ffffff', '#fde047', '#f9a8d4', '#fca5a5'][Math.floor(rnd() * 4)];
        for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.257) * sz, y + Math.sin(p * 1.257) * sz, sz * 0.7, 0, TAU); g.fill(); }
        g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(x, y, sz * 0.6, 0, TAU); g.fill();
      }
      s.layer = c;
    };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const oldW = s.W;
      s.W = Math.max(240, r.width); s.H = Math.max(240, r.height);
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.k = clamp(Math.min(s.W, s.H * 1.5) / 620, 0.75, 1.6);
      s.hz = s.H * 0.42; s.fieldTop = s.H * 0.56; s.fieldBot = s.H * 0.95;
      canvas.width = Math.round(s.W * s.dpr); canvas.height = Math.round(s.H * s.dpr);
      canvas.style.width = `${s.W}px`; canvas.style.height = `${s.H}px`;
      if (oldW) { const q = s.W / oldW; Object.values(s.rt).forEach(r2 => { r2.x *= q; r2.tx *= q; }); s.food.forEach(f => { f.x *= q; }); s.gifts.forEach(f => { f.x *= q; }); }
      buildLayer();
      if (s.redraw) s.redraw();   // 크기를 바꾸면 캔버스가 지워지므로 바로 다시 그린다 (깜빡임 방지)
    };

    const ensureRt = (a, entering) => {
      if (s.rt[a.uid]) return s.rt[a.uid];
      const x = rand(0.12, 0.88) * s.W, d = rand(0.05, 0.95);
      const r = { x, d, tx: x, td: d, wait: rand(0, 2.5), face: Math.random() < 0.5 ? 1 : -1, phase: rand(0, 6), moving: 0, hopT: entering ? 0.6 : 0, eatT: 0, washT: 0, poopDue: 0, lie: 0, run: false, blinkT: rand(1, 5) };
      s.rt[a.uid] = r;
      return r;
    };
    s.ensureRt = ensureRt;

    resize();
    game.animals.forEach(a => ensureRt(a, false));
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── 밥: 한 번에 한 상. 동물 수에 비례해 먹이 더미를 놓는다 (더미 하나에 세 입) ──
    s.feed = () => {
      if (s.food.some(f => f.bites > 0)) { showToast('🥕 아직 밥이 남아 있어요!'); return; }
      if (!game.animals.length) { showToast('🛒 상점에서 동물 친구를 데려와요!'); return; }
      const n = clamp(Math.ceil(game.animals.length * 0.5), 1, 30);
      for (let i = 0; i < n; i++) s.food.push({ x: rand(0.1, 0.9) * s.W, d: rand(0.1, 0.9), bites: 3, fall: 1 + i * 0.12, life: 90, gone: 0 });
      audio.playYum();
      say('feed', VOICE.farmFeed(), 6);
    };

    // ── 입력 ──
    const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hitAnimal = (x, y) => {
      const list = game.animals.slice().sort((a, b) => s.rt[b.uid].d - s.rt[a.uid].d);
      for (const a of list) {
        const r = s.rt[a.uid], S = sizeOf(a, r);
        if (Math.hypot(r.x - x, yOf(r.d) - S * 0.5 - y) < Math.max(30, S * 0.65)) return a;
      }
      return null;
    };
    const hearts = (x, y, text = '💗', n = 4) => { for (let i = 0; i < n; i++) s.fx.push({ x: x + rand(-22, 22), y: y + rand(-10, 10), text, life: rand(0.8, 1.3), vy: rand(-48, -26) }); };

    const pet = (a) => {
      const r = s.rt[a.uid], sp = FARM_BY_ID[a.sp], S = sizeOf(a, r), y = yOf(r.d) - S;
      a.happy = Math.min(100, a.happy + 15);
      r.hopT = 0.6;
      hearts(r.x, y);
      if (s.t - (r.petAt ?? -9) > 3) { r.petAt = s.t; addPoints(FARM_REWARDS.pet, r.x, y - 16); }
      if (s.t - s.lastSound > 1.2) {
        s.lastSound = s.t;
        if (a.name) speak(VOICE.farmHello(farmSpeciesOf(a), a.name));
        else if (soundById[sp.sound]) audio.playItemSound(soundById[sp.sound]);
        else audio.playPopSound();
      }
      setInfo(a.uid); setInfoTick(n => n + 1);
    };

    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return;
      const p = local(e);
      s.pointer = { down: true, x: p.x, y: p.y };
      const m = modeRef.current;
      const a = hitAnimal(p.x, p.y);
      if (s.sleeping && a && m === 'play') {
        // 자는 친구는 깨우지 않는다
        say('sleeptap', VOICE.farmSleepTap(), 4);
        setInfo(a.uid); setInfoTick(n => n + 1);
        return;
      }
      s.lastActive = s.t;
      if (m === 'heal') {
        if (!a) return;
        const r = s.rt[a.uid];
        if (a.sick) {
          a.sick = false; a.happy = Math.min(100, a.happy + 20); r.hopT = 0.6;
          hearts(r.x, yOf(r.d) - sizeOf(a, r), '✨', 6);
          addPoints(FARM_REWARDS.heal, r.x, yOf(r.d) - sizeOf(a, r) - 16);
          audio.playFanfare(); say('heal', VOICE.farmHeal());
          if (!game.animals.some(o => o.sick)) setMode('play');
        } else say('notsick', VOICE.farmNotSick(), 3);
        return;
      }
      if (m === 'wash') return;   // 문지르기는 매 프레임 처리
      const gi = s.gifts.findIndex(g => Math.hypot(g.x - p.x, yOf(g.d) - 14 * s.k - p.y) < 34 * s.k);
      if (gi >= 0) {
        const g = s.gifts[gi];
        s.gifts.splice(gi, 1);
        addPoints(g.stars, g.x, yOf(g.d) - 30);
        hearts(g.x, yOf(g.d) - 20, '✨', 3);
        audio.playPopSound(); say('gift', VOICE.farmGift(), 10);
        return;
      }
      if (a) pet(a); else setInfo(null);
    };
    const onMove = (e) => { if (!s.pointer.down) return; const p = local(e); s.pointer.x = p.x; s.pointer.y = p.y; };
    const onUp = () => { s.pointer.down = false; };
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    s.release = (uid) => {
      const a = game.animals.find(o => o.uid === uid);
      if (!a) return false;
      const r = s.rt[uid], reward = farmReleaseReward(a);
      game.animals = game.animals.filter(o => o.uid !== uid);
      delete s.rt[uid];
      if (r) { hearts(r.x, yOf(r.d) - 30, '🌼', 6); addPoints(reward, r.x, yOf(r.d) - 50); } else game.points += reward;
      audio.playFanfare(); speak(VOICE.farmRelease());
      showToast(`🌼 잘 가! 선물로 별 ${reward}개를 받았어요`);
      saveFarm(game);
      return true;
    };

    // ── 한 프레임: 돌봄 수치·행동 ──
    const update = (dt) => {
      const dirt = farmDirt(game);
      const fieldH = s.fieldBot - s.fieldTop;
      const sickCount = game.animals.filter(o => o.sick).length;

      // 밥
      s.food.forEach(f => {
        if (f.fall > 0) f.fall = Math.max(0, f.fall - dt * 2.2);
        f.life -= dt;
        if (f.bites <= 0) f.gone += dt;
      });
      s.food = s.food.filter(f => f.gone < 1.4 && f.life > 0);
      s.gifts.forEach(g => { g.life -= dt; g.bob += dt; });
      s.gifts = s.gifts.filter(g => g.life > 0);

      // 씻기 모드: 문지르면 흙먼지가 지워지고 바닥 똥이 치워진다
      let washing = null;
      if (s.pointer.down && modeRef.current === 'wash') {
        const { x, y } = s.pointer;
        washing = hitAnimal(x, y);
        const before = game.poop.length;
        game.poop = game.poop.filter(p => {
          const hit = Math.hypot(p.x * s.W - x, yOf(p.y) - y) < 34 * s.k;
          if (hit) addPoints(FARM_REWARDS.poop, p.x * s.W, yOf(p.y) - 20);
          return !hit;
        });
        if (game.poop.length !== before) audio.playPopSound();
        if (washing) {
          const r = s.rt[washing.uid];
          r.washT = 0.5;
          if (washing.mud >= 25) r.wasDirty = true;
          washing.mud = Math.max(0, washing.mud - 75 * dt);
          washing.happy = Math.min(100, washing.happy + 4 * dt);
          if (Math.random() < dt * 22) s.fx.push({ x: x + rand(-26, 26), y: y + rand(-22, 22), bubble: rand(4, 11) * s.k, life: rand(0.5, 1), vy: rand(-40, -14) });
          if (s.t - s.lastBubble > 0.22) { s.lastBubble = s.t; audio.playBubble(); }
          if (washing.mud <= 0 && r.wasDirty) {
            r.wasDirty = false; r.hopT = 0.6;
            hearts(r.x, yOf(r.d) - sizeOf(washing, r), '✨', 6);
            addPoints(FARM_REWARDS.wash, r.x, yOf(r.d) - sizeOf(washing, r) - 16);
            audio.playFanfare(); say('wash', VOICE.farmWash(), 3);
          }
        }
      }

      game.animals.forEach(a => {
        const sp = FARM_BY_ID[a.sp], r = ensureRt(a, false);
        // 수치
        a.full = Math.max(0, a.full - FARM_RATES.fullDropPerSec * dt);
        a.happy = Math.max(0, a.happy - FARM_RATES.happyDropPerSec * dt);
        a.mud = Math.min(100, a.mud + FARM_RATES.mudPerSec * (sp.snout === 'pig' ? 1.6 : 1) * dt);
        const stage = farmStageOf(a.growth);
        a.growth = Math.min(1, a.growth + FARM_RATES.growPerSec * sp.growMul * farmGrowFactor(a, dirt) * dt);
        const now = farmStageOf(a.growth);
        if (now !== stage) {
          addPoints(now === 'adult' ? FARM_REWARDS.adult : FARM_REWARDS.young, r.x, yOf(r.d) - sizeOf(a, r) - 16);
          hearts(r.x, yOf(r.d) - sizeOf(a, r), '🌟', 6); r.hopT = 0.6;
          audio.playFanfare(); say('grow', VOICE.farmGrow(sp, now));
        }
        const sad = isFarmSad(a, dirt);
        if (!a.sick && sickCount < FARM_RATES.sickMax && Math.random() < FARM_RATES.sickPerSec * (a.full < 25 || a.mud > 75 ? 3 : 1) * dt) {
          a.sick = true; say('sick', VOICE.farmSick(), 20);
        }
        // 다 큰 친구는 컨디션이 좋으면 가끔 선물을 떨어뜨린다
        if (now === 'adult' && !sad && sp.gift) {
          a.giftT = (a.giftT || 0) + dt;
          if (a.giftT >= sp.gift.everySec && s.gifts.length < 8) {
            a.giftT = 0;
            s.gifts.push({ x: clamp(r.x - r.face * 30 * s.k, 20, s.W - 20), d: r.d, icon: sp.gift.icon, stars: sp.gift.stars, life: 120, bob: 0 });
          }
        }
        if (r.poopDue > 0) {
          r.poopDue -= dt;
          if (r.poopDue <= 0 && game.poop.length < FARM_RATES.poopMax) game.poop.push({ x: clamp((r.x - r.face * 24 * s.k) / s.W, 0.03, 0.97), y: r.d });
        }
        r.blinkT -= dt; if (r.blinkT < -0.14) r.blinkT = rand(2, 6);
        if (r.hopT > 0) r.hopT = Math.max(0, r.hopT - dt);

        // 행동
        const asleep = s.sleeping && r.washT <= 0 && r.eatT <= 0;
        r.asleep = asleep;
        let lieTarget = asleep ? 1 : 0;
        r.moving = 0;
        if (asleep) { /* 코 잔다 */ }
        else if (r.washT > 0) r.washT -= dt;
        else if (r.eatT > 0) {
          r.eatT -= dt;
          if (r.eatT <= 0) {
            a.full = Math.min(100, a.full + 40); a.happy = Math.min(100, a.happy + 6);
            addPoints(FARM_REWARDS.eat, r.x, yOf(r.d) - sizeOf(a, r) - 10);
            r.poopDue = rand(FARM_RATES.poopEverySec[0], FARM_RATES.poopEverySec[1]);
            if (s.t - s.lastYum > 0.9) { s.lastYum = s.t; audio.playYum(); }
          }
        } else {
          const S = sizeOf(a, r);
          let seeking = null;
          if (a.full < 80) {
            let bd = Infinity;
            s.food.forEach(f => {
              if (f.bites <= 0 || f.fall > 0) return;
              const dd = Math.hypot(f.x - r.x, (f.d - r.d) * fieldH);
              if (dd < bd) { bd = dd; seeking = f; }
            });
          }
          if (seeking) {
            const side = r.x <= seeking.x ? -1 : 1;
            r.tx = clamp(seeking.x + side * S * 0.55, 10, s.W - 10); r.td = clamp(seeking.d + 0.012, 0, 1); r.wait = 0; r.run = false;
          } else if (r.wait > 0) {
            r.wait -= dt;
            if (sp.napper && r.wait > 3) lieTarget = 1;   // 고양이는 쉴 때 엎드려 낮잠
            if (r.wait <= 0) {
              r.tx = rand(0.06, 0.94) * s.W; r.td = rand(0.02, 0.98);
              r.run = !!sp.runner && Math.random() < 0.4;
            }
          }
          const dx = r.tx - r.x, dy = (r.td - r.d) * fieldH, dist = Math.hypot(dx, dy);
          if (dist > 6 && (seeking || r.wait <= 0)) {
            const v = 46 * s.k * sp.speed * (0.65 + 0.5 * r.d) * (sad ? 0.55 : 1) * (r.run ? 2 : 1) * (seeking ? 1.5 : 1);
            const step = Math.min(dist, v * dt);
            r.x += (dx / dist) * step; r.d = clamp(r.d + (dy / dist) * step / fieldH, 0, 1);
            if (Math.abs(dx) > 2) r.face = dx > 0 ? 1 : -1;
            r.moving = 1;
            r.phase += dt * (sp.hop ? 7 : 9) * (r.run ? 1.6 : 1) * sp.speed;
          } else if (seeking) {
            r.face = seeking.x >= r.x ? 1 : -1;
            seeking.bites -= 1; r.eatT = 1.3;
          } else if (r.wait <= 0) {
            r.wait = rand(1.5, 5) * (sp.napper ? 2.6 : 1);
          }
        }
        r.lie += (lieTarget - r.lie) * Math.min(1, dt * 5);
      });

      // 밤이면 한동안 아무도 만지지 않을 때 모두 잔다
      s.clockT -= dt;
      if (s.clockT <= 0) { s.clockT = 5; s.night = isFarmNight(); s.dark = farmDark(); }
      const sleeping = s.night && s.t - s.lastActive > FARM_SLEEP_IDLE_SEC && !s.food.some(f => f.bites > 0);
      if (sleeping && !s.sleeping) say('night', VOICE.farmNight(), 120);
      s.sleeping = sleeping;

      // 돌봄 안내 (한 번에 하나, 뜸하게)
      s.nagT -= dt;
      if (s.nagT <= 0 && !s.sleeping && game.animals.length) {
        s.nagT = 14;
        const hungry = game.animals.filter(a => a.full < 25).length;
        if (hungry * 2 >= game.animals.length && !s.food.length) say('nag', VOICE.farmHungry(), 60);
        else if (game.poop.length >= 5) say('nag', VOICE.farmPoop(), 60);
        else if (game.animals.some(a => a.mud > 75)) say('nag', VOICE.farmDirty(), 60);
      }

      s.fx.forEach(f => { f.life -= dt; f.y += f.vy * dt; });
      s.fx = s.fx.filter(f => f.life > 0);
    };

    // ── 그리기 ──
    const emoji = (text, x, y, px, alpha = 1) => {
      // 색 이모지도 fillStyle 의 투명도를 따라가므로 불투명한 색으로 맞춰 둔다
      ctx.fillStyle = '#000000'; ctx.globalAlpha = alpha; ctx.font = `${Math.round(px)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
    };
    const starRnd = seeded(77), stars = Array.from({ length: 36 }, () => [starRnd(), starRnd() * 0.38, 0.6 + starRnd() * 1.2, starRnd() * 6]);
    const clouds = Array.from({ length: 5 }, (_, i) => ({ off: i * 0.23 + Math.random() * 0.1, y: 0.05 + Math.random() * 0.2, sp: 6 + Math.random() * 8, sz: 0.8 + Math.random() * 0.6 }));

    const draw = () => {
      const { W, H, k, dark } = s;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      // 하늘
      const dusk = Math.sin(dark * Math.PI);
      const sky = ctx.createLinearGradient(0, 0, 0, s.hz + H * 0.05);
      sky.addColorStop(0, mixColor('#38bdf8', '#0b1437', dark));
      sky.addColorStop(1, mixColor(mixColor('#e0f2fe', '#fdba74', dusk * 0.8), '#2b4470', dark * dark));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (dark > 0.35) {
        ctx.fillStyle = '#ffffff';
        stars.forEach(([sx, sy, sr, ph]) => { ctx.globalAlpha = (dark - 0.35) / 0.65 * (0.5 + 0.5 * Math.sin(s.t * 1.5 + ph)); ctx.beginPath(); ctx.arc(sx * W, sy * H, sr * k, 0, TAU); ctx.fill(); });
        ctx.globalAlpha = (dark - 0.35) / 0.65;
        ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(W * 0.42, H * 0.13, 24 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = mixColor('#38bdf8', '#0b1437', dark); ctx.beginPath(); ctx.arc(W * 0.42 + 10 * k, H * 0.13 - 6 * k, 21 * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (dark < 0.75) {
        const sx = W * 0.76, sy = H * (0.12 + dark * 0.2);
        ctx.globalAlpha = 1 - dark / 0.75;
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + s.t * 0.15; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 34 * k, sy + Math.sin(a) * 34 * k); ctx.lineTo(sx + Math.cos(a) * 46 * k, sy + Math.sin(a) * 46 * k); ctx.stroke(); }
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(sx, sy, 27 * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#ffffff';
      clouds.forEach(c => {
        const x = ((c.off * (W + 260) + s.t * c.sp) % (W + 260)) - 130, y = c.y * H, z = 26 * k * c.sz;
        ctx.globalAlpha = 0.92 - dark * 0.78;
        [[0, 0, 1], [-1, 0.25, 0.75], [1, 0.2, 0.8], [0.4, -0.35, 0.7]].forEach(([qx, qy, qr]) => { ctx.beginPath(); ctx.arc(x + qx * z, y + qy * z, z * qr, 0, TAU); ctx.fill(); });
      });
      ctx.globalAlpha = 1;
      if (s.layer) ctx.drawImage(s.layer, 0, 0, W, H);

      // 땅 위의 것들을 뒤에서부터
      const items = [];
      game.poop.forEach(p => items.push({ d: p.y - 0.001, kind: 'poop', p }));
      s.food.forEach(f => items.push({ d: f.d, kind: 'food', f }));
      s.gifts.forEach(g => items.push({ d: g.d, kind: 'gift', g }));
      game.animals.forEach(a => items.push({ d: s.rt[a.uid].d, kind: 'animal', a }));
      items.sort((p, q) => p.d - q.d);
      const dirt = farmDirt(game);
      items.forEach(it => {
        if (it.kind === 'poop') {
          const x = it.p.x * W, y = yOf(it.p.y), z = 9 * scaleOf(it.p.y);
          ctx.fillStyle = '#7c4a21';
          [[0, 0, 1], [0, -0.7, 0.72], [0, -1.25, 0.45]].forEach(([qx, qy, qr]) => { ell(ctx, x + qx * z, y + qy * z - z * 0.4, z * qr, z * qr * 0.62); ctx.fill(); });
        } else if (it.kind === 'food') {
          const f = it.f, sc = scaleOf(f.d), x = f.x, y = yOf(f.d) - f.fall * H * 0.5;
          const a = f.bites > 0 ? 1 : clamp(1 - f.gone / 1.2, 0, 1), z = (10 + Math.max(0, f.bites) * 5) * sc;
          ctx.globalAlpha = a;
          ctx.fillStyle = '#eab308'; ell(ctx, x, y - z * 0.35, z * 1.25, z * 0.6); ctx.fill();
          ctx.strokeStyle = '#a16207'; ctx.lineWidth = Math.max(1, sc * 1.2); ctx.lineCap = 'round';
          [-0.9, -0.4, 0.1, 0.6].forEach((q, i) => { ctx.beginPath(); ctx.moveTo(x + q * z, y - z * 0.2); ctx.lineTo(x + (q + 0.35) * z, y - z * (0.6 + (i % 2) * 0.2)); ctx.stroke(); });
          if (f.bites >= 2) { ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(x + z * 0.2, y - z * 0.9); ctx.lineTo(x + z * 1.2, y - z * 0.5); ctx.lineTo(x + z * 0.3, y - z * 0.35); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#16a34a'; ell(ctx, x + z * 0.15, y - z * 0.7, z * 0.2, z * 0.14, -0.6); ctx.fill(); }
          if (f.bites >= 3) { ctx.fillStyle = '#ef4444'; ell(ctx, x - z * 0.55, y - z * 0.72, z * 0.3, z * 0.28); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (it.kind === 'gift') {
          const g = it.g, sc = scaleOf(g.d), y = yOf(g.d);
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ell(ctx, g.x, y, 12 * sc, 4 * sc); ctx.fill();
          ctx.fillStyle = `rgba(254,240,138,${0.35 + 0.2 * Math.sin(g.bob * 4)})`; ell(ctx, g.x, y - 16 * sc, 20 * sc, 20 * sc); ctx.fill();
          emoji(g.icon, g.x, y - 16 * sc - Math.abs(Math.sin(g.bob * 3)) * 5 * sc, 26 * sc, g.life < 8 ? 0.4 + 0.6 * Math.abs(Math.sin(g.bob * 6)) : 1);
        } else {
          const a = it.a, r = s.rt[a.uid], sp = FARM_BY_ID[a.sp], S = sizeOf(a, r), y = yOf(r.d);
          const hop = r.hopT > 0 ? -Math.sin(clamp(r.hopT / 0.6, 0, 1) * Math.PI) * S * 0.28 : 0;
          if (s.infoUid === a.uid) { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3.5 * k; ell(ctx, r.x, y, S * 0.62, S * 0.16); ctx.stroke(); }
          ctx.fillStyle = 'rgba(0,0,0,0.16)'; ell(ctx, r.x, y, S * 0.5, S * 0.11); ctx.fill();
          const eatDip = r.eatT > 0 ? clamp(Math.min(r.eatT, 1.3 - r.eatT) * 5, 0, 1) * (0.85 + 0.15 * Math.sin(s.t * 18)) : 0;
          ctx.save(); ctx.translate(r.x, y + hop); ctx.scale(r.face, 1);
          drawAnimal(ctx, sp, S, {
            phase: r.phase, moving: r.moving, growth: a.growth, sleep: r.asleep, lie: r.lie, eat: eatDip,
            wag: !r.asleep && (r.hopT > 0 || r.washT > 0 || (sp.wag && a.happy > 50)), mud: a.mud, t: s.t, blink: r.blinkT < 0
          });
          ctx.restore();
          // 머리 위 상태 표시
          const top = y - S * (sp.shape === 'bird' ? 1.05 : sp.legLen + 0.62 * (sp.fat || 1) + (sp.snout === 'horse' ? 0.6 : 0.3)) * (1 - r.lie * 0.4) - 14 * k;
          if (r.asleep) emoji('💤', r.x + S * 0.3, top - Math.sin(s.t * 1.5 + r.phase) * 4, 20 * k, 0.9);
          else if (a.sick) emoji('🤒', r.x, top, 24 * k);
          else if (a.full < 25) emoji('🍽️', r.x, top, 22 * k, 0.6 + 0.4 * Math.abs(Math.sin(s.t * 3)));
          else if (a.mud > 75) emoji('💦', r.x, top, 22 * k, 0.6 + 0.4 * Math.abs(Math.sin(s.t * 3)));
          else if (isFarmSad(a, dirt)) emoji('😢', r.x, top, 20 * k);
          if (a.name) {
            ctx.font = `900 ${Math.round(12 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.strokeText(a.name, r.x, y + 5 * k);
            ctx.fillStyle = '#14532d'; ctx.fillText(a.name, r.x, y + 5 * k);
          }
        }
      });

      // 어둠 (밤에는 헛간 창문에 불이 켜진다)
      if (dark > 0.02) {
        // 하늘은 이미 어두우니 위쪽은 옅게, 땅으로 갈수록 짙게 덮는다
        const ng = ctx.createLinearGradient(0, 0, 0, s.hz);
        ng.addColorStop(0, `rgba(8,16,48,${dark * 0.2})`); ng.addColorStop(1, `rgba(8,16,48,${dark * 0.48})`);
        ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
        if (dark > 0.4 && s.barnWin) { ctx.fillStyle = `rgba(253,224,71,${(dark - 0.4) * 1.5})`; ctx.fillRect(s.barnWin.x, s.barnWin.y, s.barnWin.w, s.barnWin.h); }
      }
      // 효과 (하트·별·비누 거품·점수)
      s.fx.forEach(f => {
        const a = clamp(f.life * 2, 0, 1);
        if (f.bubble) {
          ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 1.5;
          ell(ctx, f.x, f.y, f.bubble, f.bubble); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
        } else if (f.text.startsWith('+')) {
          ctx.globalAlpha = a; ctx.font = `900 ${Math.round(17 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(120,53,15,0.85)'; ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = '#fef08a'; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
        } else emoji(f.text, f.x, f.y, 20 * k, a);
      });
    };

    s.redraw = draw;
    let raf = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      s.t += dt;
      update(dt);
      draw();
      if (s.t - s.lastHud > 0.4) {
        s.lastHud = s.t;
        const avgMud = game.animals.length ? game.animals.reduce((n, a) => n + a.mud, 0) / game.animals.length : 0;
        setHud({ points: game.points, clean: Math.round(100 - Math.max(farmDirt(game), avgMud)), sick: game.animals.filter(a => a.sick).length, night: s.night });
        setInfoTick(n => n + 1);
      }
      if (s.t - s.lastSave > 5) { s.lastSave = s.t; game.lastTick = Date.now(); saveFarm(game); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // 화면을 꺼 두거나 다른 탭에 가 있던 시간은 꺼둔 시간처럼 천천히 따라잡는다
    const onVis = () => {
      if (document.hidden) { game.lastTick = Date.now(); saveFarm(game); }
      else { catchUpFarm(game); last = performance.now(); }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('visibilitychange', onVis);
      game.lastTick = Date.now();
      saveFarm(game);
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택한 친구에게 노란 동그라미 (렌더 루프는 처음 한 번만 만들어지므로 ref 로 전달)
  useEffect(() => { if (simRef.current) simRef.current.infoUid = info; setConfirmRelease(false); setNaming(false); }, [info]);
  useEffect(() => {
    if (!info || naming) return undefined;
    const tm = setTimeout(() => setInfo(null), 9000);
    return () => clearTimeout(tm);
  }, [info, naming]);

  const wake = () => { const s = simRef.current; if (s) s.lastActive = s.t; };

  const buy = (id) => {
    const s = simRef.current; if (!s) return;
    const game = s.game, sp = FARM_BY_ID[id];
    if (game.points < sp.price) { showToast(`⭐ 별이 ${sp.price - game.points}개 더 필요해요`); s.say('need', VOICE.farmNeedMore(), 3); return; }
    game.points -= sp.price;
    const a = newAnimal(id);
    game.animals.push(a);
    s.ensureRt(a, true);
    audio.playFanfare();
    s.say('buy', VOICE.farmNew(sp));
    saveFarm(game);
    setInfo(a.uid);
    setHud(h => ({ ...h, points: game.points }));
    setShopOpen(false);
  };

  // ── 전체화면 (Fullscreen API, 지원하지 않으면 화면에 꽉 채우기) ──
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const toggleFull = (e) => {
    e.stopPropagation();
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
    const onChange = () => { if (!fsElement()) setFull(false); };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange); };
  }, []);

  const stop = (e) => e.stopPropagation();
  const sim = simRef.current;
  const infoAnimal = info && sim ? sim.game.animals.find(a => a.uid === info) : null;
  const pointsNow = sim ? sim.game.points : hud.points;

  return (
    <div ref={rootRef} style={{
      flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '0.7rem',
      ...(full ? {
        position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100dvh', boxSizing: 'border-box', gap: '0.5rem',
        background: 'linear-gradient(180deg, #dcfce7, #bbf7d0)',
        padding: 'max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))'
      } : {})
    }}>
      {/* 상단 상태판: 큰 그림 버튼 위주 (글자는 부모용으로 작게) */}
      <div onPointerDown={wake} style={{
        background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)', borderRadius: '22px', padding: '0.55rem 0.9rem',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0,
        border: '3px solid #86efac', boxShadow: '0 8px 22px rgba(22,101,52,0.25)'
      }}>
        <div style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, fontSize: '1.45rem', padding: '6px 14px', borderRadius: '18px', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.1)' }}>
          ⭐ {hud.points}
        </div>
        <CleanMeter value={hud.clean} />
        {hud.night && <div title="밤 (저녁 8시 ~ 아침 7시)" style={{ fontSize: '1.9rem', lineHeight: 1, filter: 'drop-shadow(0 0 6px #fde68a)' }}>🌙</div>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <FarmButton icon="🥕" label="밥" color="#f97316" onClick={() => { setMode('play'); if (simRef.current) simRef.current.feed(); }} />
          <FarmButton icon="🩹" label="치료" color="#f43f5e" badge={hud.sick} active={mode === 'heal'} onClick={() => { const m = mode === 'heal' ? 'play' : 'heal'; setMode(m); if (m === 'heal' && simRef.current) simRef.current.say('healmode', VOICE.farmHealMode(), 3); }} />
          <FarmButton icon="🧼" label="씻기·청소" color="#0ea5e9" active={mode === 'wash'} onClick={() => { const m = mode === 'wash' ? 'play' : 'wash'; setMode(m); if (m === 'wash' && simRef.current) simRef.current.say('washmode', VOICE.farmWashMode(), 20); }} />
          <FarmButton icon="🛒" label="상점" color="#8b5cf6" onClick={() => setShopOpen(true)} />
        </div>
      </div>

      {/* 목장 */}
      <div
        ref={wrapRef}
        style={{
          flex: 1, minHeight: '260px', position: 'relative', overflow: 'hidden', borderRadius: '18px',
          border: '7px solid #92400e', background: '#7ccf63',
          boxShadow: '0 14px 30px rgba(20,83,45,0.3)',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          cursor: mode === 'play' ? 'pointer' : 'crosshair'
        }}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }} />

        {mode !== 'play' && (
          <div style={{
            position: 'absolute', left: '50%', top: '12px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none',
            background: 'rgba(15,23,42,0.75)', color: '#ffffff', fontWeight: 900, padding: '8px 16px', borderRadius: '16px', fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}>
            {mode === 'wash' ? '🧼 친구를 문질러 씻기고, 똥도 문질러 치워요' : hud.sick ? '🩹 🤒 표시가 있는 친구를 눌러 줘요' : '🩹 지금은 아픈 친구가 없어요'}
          </div>
        )}

        {toast && (
          <div key={toast.key} style={{
            position: 'absolute', left: '50%', top: mode !== 'play' ? '58px' : '12px', transform: 'translateX(-50%)', zIndex: 7, pointerEvents: 'none',
            background: '#ffffff', color: '#0f172a', fontWeight: 900, padding: '10px 18px', borderRadius: '18px', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap'
          }}>
            {toast.text}
          </div>
        )}

        <button data-ui onPointerDown={stop} onClick={toggleFull} aria-label={full ? '작게 보기' : '전체화면'} style={{
          position: 'absolute', right: '12px', top: '12px', zIndex: 6, background: 'rgba(255,255,255,0.92)', color: '#166534', border: 'none',
          padding: '9px 14px', borderRadius: '16px', fontWeight: 900, fontSize: '0.95rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', cursor: 'pointer', touchAction: 'manipulation'
        }}>{full ? '↙️ 작게 보기' : '⛶ 전체화면'}</button>

        {/* 동물 정보 카드 */}
        {infoAnimal && (() => {
          const vsp = farmSpeciesOf(infoAnimal);
          const dirt = farmDirt(sim.game);
          const stage = farmStageOf(infoAnimal.growth);
          const sad = isFarmSad(infoAnimal, dirt);
          const cond = farmCondition(infoAnimal, dirt);
          const speed = farmGrowFactor(infoAnimal, dirt);
          const asleep = sim.rt[infoAnimal.uid]?.asleep;
          return (
            <div data-ui onPointerDown={stop} style={{
              position: 'absolute', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: 8,
              background: 'rgba(255,255,255,0.96)', borderRadius: '22px', padding: '12px 16px', width: 'min(360px, calc(100% - 24px))',
              boxShadow: '0 12px 28px rgba(0,0,0,0.3)', border: `3px solid ${sad ? '#94a3b8' : '#4ade80'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0f172a' }}>
                  {asleep ? '😴' : infoAnimal.sick ? '🤒' : sad ? '😢' : '😊'} {infoAnimal.name ? <>{infoAnimal.name} <span style={{ fontSize: '0.8rem', color: '#475569' }}>({vsp.name})</span></> : vsp.name}
                  {' '}<span style={{ fontSize: '0.85rem', color: '#15803d' }}>· {FARM_STAGE_NAMES[stage]}</span>
                </div>
                <button onClick={() => setInfo(null)} style={{ border: 'none', background: '#e2e8f0', borderRadius: '12px', padding: '4px 10px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: '8px', fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
                {[['🥕 배부름', infoAnimal.full, '#facc15'], ['💗 기분', infoAnimal.happy, '#f472b6'], ['🧼 깨끗함', 100 - infoAnimal.mud, '#38bdf8'], ['🌱 성장', infoAnimal.growth * 100, '#22c55e']].map(([label, v, col]) => (
                  <div key={label}>
                    {label} {Math.round(v)}%
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', marginTop: '2px' }}>
                      <div style={{ width: `${clamp(v, 0, 100)}%`, height: '100%', background: v < 30 && label !== '🌱 성장' ? '#f43f5e' : col }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.82rem', fontWeight: 800, color: sad ? '#be123c' : '#0f766e' }}>
                {infoAnimal.sick ? '🤒 아파서 자라지 않아요. 🩹 치료 버튼을 누르고 이 친구를 눌러 주세요'
                  : sad ? '배고프거나 지저분해서 자라지 않아요'
                    : stage === 'adult' ? `🎉 다 컸어요! 가끔 ${vsp.gift.icon} ${attachJosa(vsp.gift.name, '을/를')} 선물해요`
                      : `자라는 속도 ${Math.round(speed * 100)}% · 컨디션 ${cond}% (좋을수록 빨라요)`}
              </div>
              {!naming ? (
                <button
                  onClick={() => { setNameDraft(infoAnimal.name || ''); setNaming(true); }}
                  style={{ marginTop: '6px', width: '100%', border: '2px solid #fde68a', borderRadius: '14px', padding: '7px', fontWeight: 900, fontSize: '0.88rem', background: '#fefce8', color: '#854d0e', cursor: 'pointer' }}
                >✏️ {infoAnimal.name ? '이름 바꾸기' : '이름 짓기'}</button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nm = nameDraft.trim().slice(0, 10);
                    infoAnimal.name = nm || undefined;
                    saveFarm(sim.game);
                    setNaming(false);
                    if (nm) speak(VOICE.farmHello(vsp, nm));
                  }}
                  style={{ marginTop: '6px', display: 'flex', gap: '6px' }}
                >
                  <input
                    autoFocus value={nameDraft} maxLength={10} placeholder="예: 뽀뽀"
                    onChange={(e) => setNameDraft(e.target.value)}
                    style={{ flex: 1, minWidth: 0, border: '2px solid #fde68a', borderRadius: '12px', padding: '7px 10px', fontWeight: 800, fontSize: '1rem' }}
                  />
                  <button type="submit" style={{ border: 'none', borderRadius: '12px', padding: '7px 12px', fontWeight: 900, background: '#facc15', color: '#713f12', cursor: 'pointer' }}>저장</button>
                  <button type="button" onClick={() => setNaming(false)} style={{ border: 'none', borderRadius: '12px', padding: '7px 10px', fontWeight: 900, background: '#e2e8f0', color: '#334155', cursor: 'pointer' }}>취소</button>
                </form>
              )}
              {/* 들판으로 보내기 (실수로 누르지 않게 두 번 확인. 두 번째는 버튼 자리를 바꾼다) */}
              {!confirmRelease ? (
                <button
                  onClick={() => setConfirmRelease(1)}
                  style={{ marginTop: '6px', width: '100%', border: '2px solid #86efac', borderRadius: '14px', padding: '7px', fontWeight: 900, fontSize: '0.88rem', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' }}
                >🌼 넓은 들판으로 보내기</button>
              ) : confirmRelease === 1 ? (
                <div style={{ marginTop: '6px', background: '#dcfce7', borderRadius: '14px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '0.88rem', color: '#14532d' }}>정말 {attachJosa(vsp.name, '을/를')} 넓은 들판으로 보낼까요?</div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#15803d', marginTop: '2px' }}>🎁 잘 키운 선물로 별 {farmReleaseReward(infoAnimal)}개를 받아요</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={() => setConfirmRelease(2)} style={{ flex: 1, border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, background: '#16a34a', color: '#ffffff', cursor: 'pointer' }}>🌼 보내기</button>
                    <button onClick={() => setConfirmRelease(false)} style={{ flex: 1, border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, background: '#e2e8f0', color: '#334155', cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '6px', background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '14px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#92400e' }}>한 번 더 확인해요! 🙋</div>
                  <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#78350f', marginTop: '2px' }}>들판으로 가면 다시 돌아오지 않아요. 정말 보낼까요?</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={() => setConfirmRelease(false)} style={{ flex: 1, border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, background: '#e2e8f0', color: '#334155', cursor: 'pointer' }}>아니요</button>
                    <button onClick={() => { if (sim.release(infoAnimal.uid)) setInfo(null); else setConfirmRelease(false); }} style={{ flex: 1, border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, background: '#d97706', color: '#ffffff', cursor: 'pointer' }}>네, 보낼게요</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 상점 */}
        {shopOpen && (
          <div data-ui onPointerDown={stop} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ background: '#ffffff', borderRadius: '26px', width: 'min(760px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#ffffff' }}>
                <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>🛒 목장 상점</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, padding: '4px 12px', borderRadius: '14px' }}>⭐ {pointsNow}</span>
                  <button onClick={() => setShopOpen(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.25)', color: '#ffffff', borderRadius: '12px', padding: '6px 12px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ padding: '12px 14px 16px', overflowY: 'auto', touchAction: 'pan-y', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {[...FARM_SPECIES].sort((a, b) => a.price - b.price).map(sp => (
                  <div key={sp.id} style={{ border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0fdf4' }}>
                    <AnimalPreview species={sp} />
                    <div style={{ fontWeight: 900, color: '#0f172a' }}>{sp.babyName || sp.name}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textAlign: 'center' }}>{sp.desc}</div>
                    <button onClick={() => buy(sp.id)} style={{ marginTop: '6px', width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: pointsNow >= sp.price ? '#16a34a' : '#cbd5e1', color: '#ffffff' }}>⭐ {sp.price}</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 16px 14px', fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>
                🌱 아기로 와서 잘 돌보면 쑥쑥 자라요 · 지금 친구 {sim ? sim.game.animals.length : 0}마리
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
