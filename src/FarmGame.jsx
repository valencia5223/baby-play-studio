import { useEffect, useRef, useState } from 'react';
import { VOICE, attachJosa } from './voiceLines.js';
import {
  FARM_SPECIES, FARM_BY_ID, farmSpeciesOf, FARM_STAGE_NAMES, farmStageOf, farmSizeScale,
  FARM_RATES, FARM_SLEEP_IDLE_SEC, isFarmNight, farmDirt, isFarmSad, farmCondition, farmGrowFactor,
  FARM_REWARDS, farmReleaseReward, newAnimal, loadFarm, saveFarm, catchUpFarm, farmTodayKey,
  YOUNG_GIFT_STARS, YOUNG_GIFT_MUL, farmBreedOf, farmMateStatus, FARM_SEX_NAMES, newFarmUid, FARM_LIMITS, FARM_VARIANTS, farmVariantOf, farmLookOf,
  farmPenOf, FARM_PENS, CROP_BY_ID, FAVORITE_CROP, FAVORITE_STARS, farmSeasonOf, FARM_SEASONS, FARM_WEATHER
} from './farmData.js';
import { loadGarden, basketCount, takeFromBasket } from './gardenData.js';
const FARM_LIMITS_BREED = FARM_LIMITS.breed;

// 들판 구역 (가로 비율): 왼쪽 초식동물 우리 | 오른쪽 육식동물 우리  (텃밭은 '텃밭 가꾸기' 탭으로 옮김)
const PEN_X = { herb: [0.012, 0.6], meat: [0.62, 0.988] };
const FENCE_X = [0.61];
// 날씨가 이어지는 시간(초)
const WEATHER_SEC = { sunny: [90, 180], cloudy: [45, 90], rain: [45, 80], snow: [60, 100] };
// 계절 색: [먼 언덕, 가까운 언덕, 풀밭 위, 풀밭 아래, 나뭇잎]
const SEASON_COLORS = {
  spring: ['#b5e59a', '#93d477', '#9be07c', '#5cba4f', '#4caf50'],
  summer: ['#a7d98b', '#86c96a', '#8fd672', '#4fae4a', '#3f9d4b'],
  autumn: ['#dccb84', '#c8ad5e', '#c9cf72', '#97a647', '#ea8a1a'],
  winter: ['#e5e7eb', '#d1d5db', '#eef2f6', '#cdd6e1', '#94a3b8']
};
const fract = (v) => v - Math.floor(v);

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
  const bw = S * 0.5 * sp.bodyLen, bh = S * 0.29 * (sp.fat || 1) * (1 + 0.28 * (o.belly || 0));   // 아기를 가지면 배가 불룩
  const legL = S * sp.legLen * (1 - lie * 0.88);
  const hopY = sp.hop && o.moving ? -Math.abs(Math.sin(o.phase)) * S * 0.22 : 0;
  const by = -(legL + bh * 0.82) + hopY;
  const outline = 'rgba(60,40,20,0.28)';
  const hoofed = sp.snout === 'cow' || sp.snout === 'horse' || sp.darkFace;
  const legCol = sp.legColor || (sp.darkFace ? sp.accent : mixColor(sp.body, '#000000', 0.07));
  const hoofCol = hoofed ? mixColor(sp.accent, '#000000', 0.25) : sp.snout === 'pig' ? sp.accent : sp.belly;
  const lw = S * 0.115, legLen = legL + bh * 0.34;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // 다리 (먼 쪽은 어둡게, 모두 몸 아래로)
  const leg = (x, ph, far) => {
    const a = !o.moving ? 0 : sp.hop ? Math.sin(o.phase) * 0.55 * (x > 0 ? 1 : -1) : Math.sin(o.phase + ph) * 0.5;
    ctx.save(); ctx.translate(x, by + bh * 0.48); ctx.rotate(a);
    ctx.fillStyle = far ? mixColor(sp.legColor || (sp.darkFace ? sp.accent : sp.body), '#000000', sp.darkFace || sp.legColor ? 0.25 : 0.2) : legCol;
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
  } else if (sp.tail === 'bushy') {
    // 여우·늑대: 굵고 복슬한 꼬리 (끝은 다른 색)
    ctx.save(); ctx.translate(tx + S * 0.04, ty); ctx.rotate(-0.45 + wagA * 0.5);
    ctx.fillStyle = sp.body; ell(ctx, -S * 0.2, 0, S * 0.24, S * 0.1, 0.15); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
    if (sp.tipColor) { ctx.fillStyle = sp.tipColor; ell(ctx, -S * 0.38, S * 0.03, S * 0.08, S * 0.07, 0.15); ctx.fill(); }
    ctx.restore();
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
    ctx.strokeStyle = sp.accent; ctx.lineWidth = S * (sp.stripeN ? 0.05 : 0.045);
    const qs = sp.stripeN ? Array.from({ length: sp.stripeN }, (_, i) => -0.85 + i * (1.6 / (sp.stripeN - 1))) : [-0.45, -0.1, 0.25];
    qs.forEach((q, i) => { ctx.beginPath(); ctx.moveTo(bw * q, by - bh); ctx.lineTo(bw * (q - 0.08), by - bh * (sp.stripeN ? (i % 2 ? 0.1 : -0.25) : 0.35)); ctx.stroke(); });
  }
  if (sp.patches) {
    // 기린: 네모난 얼룩 여러 개
    ctx.fillStyle = sp.accent;
    [[-0.6, -0.45], [-0.15, -0.55], [0.3, -0.45], [-0.4, 0.05], [0.05, -0.05], [0.5, 0.05], [-0.75, 0.15]].forEach(([qx, qy], i) => { rr(ctx, bw * qx - bw * 0.13, by + bh * qy - bh * 0.18, bw * 0.26, bh * 0.36, bw * 0.06); ctx.fill(); });
  }
  if (sp.whiteSpots) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[-0.5, -0.55], [-0.2, -0.65], [0.1, -0.6], [0.4, -0.5], [-0.35, -0.3], [0.25, -0.3]].forEach(([qx, qy]) => { ell(ctx, bw * qx, by + bh * qy, S * 0.025, S * 0.025); ctx.fill(); });
  }
  drawMud(ctx, o.mud || 0, S, by, bw, bh);
  ctx.restore();

  // 목과 머리
  const hs = S * sp.headSize * 0.5, e = o.eat || 0, horse = sp.snout === 'horse';
  const lift = sp.neckLift ? S * sp.neckLift : horse ? S * 0.34 : sp.snout === 'cow' ? S * 0.03 : S * 0.1;
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
  if (sp.lionMane) {
    // 사자: 머리 둘레의 풍성한 갈기 (다 크면 더 크게)
    const mk = 0.6 + 0.4 * Math.min(1, (o.growth || 0) / 0.8);
    ctx.fillStyle = sp.accent;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ell(ctx, hx + Math.cos(a) * hs * 1.0 * mk, hy + Math.sin(a) * hs * 0.95 * mk, hs * 0.42 * mk, hs * 0.42 * mk); ctx.fill(); }
    ell(ctx, hx, hy, hs * 1.25 * mk, hs * 1.18 * mk); ctx.fill();
  }
  if (sp.ear === 'big') {
    // 코끼리: 머리 뒤의 커다란 귀
    ctx.fillStyle = mixColor(sp.body, '#000000', 0.08); ell(ctx, hx - hs * 0.55, hy + hs * 0.05, hs * 0.8, hs * 1.0, 0.15); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#fbcfe8'; ell(ctx, hx - hs * 0.55, hy + hs * 0.05, hs * 0.5, hs * 0.7, 0.15); ctx.fill();
  }
  if (sp.ear === 'round') {
    [[-0.55, 0], [0.35, 0]].forEach(([q]) => {
      ctx.fillStyle = sp.earColor || (sp.lionMane ? sp.body : sp.body); ell(ctx, hx + hs * q, hy - hs * 0.82, hs * 0.32, hs * 0.32); ctx.fill();
      ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
      if (!sp.earColor) { ctx.fillStyle = 'rgba(251,113,133,0.45)'; ell(ctx, hx + hs * q, hy - hs * 0.8, hs * 0.16, hs * 0.16); ctx.fill(); }
    });
  }
  if (sp.antlers && (o.growth || 0) > 0.34) {
    // 사슴뿔: 자라면서 생긴다
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1.5, hs * 0.13); ctx.lineCap = 'round';
    [[-0.25, -1], [0.2, 1]].forEach(([q, side]) => {
      const bx = hx + hs * q, byy = hy - hs * 0.8;
      ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(bx + side * hs * 0.2, byy - hs * 0.9);
      ctx.moveTo(bx + side * hs * 0.08, byy - hs * 0.4); ctx.lineTo(bx + side * hs * 0.45, byy - hs * 0.6);
      ctx.moveTo(bx + side * hs * 0.15, byy - hs * 0.7); ctx.lineTo(bx - side * hs * 0.15, byy - hs * 1.05); ctx.stroke();
    });
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
  } else if (sp.snout === 'trunk') {
    // 코끼리: 아래로 늘어졌다 끝이 살짝 말린 긴 코 + 상아
    ctx.strokeStyle = sp.body; ctx.lineWidth = hs * 0.42; ctx.lineCap = 'round';
    const sw = Math.sin((o.t || 0) * 1.6) * hs * 0.12;
    ctx.beginPath(); ctx.moveTo(hx + hs * 0.6, hy + hs * 0.15); ctx.quadraticCurveTo(hx + hs * 1.25, hy + hs * 0.4, hx + hs * 1.1 + sw, hy + hs * 1.3); ctx.stroke();
    ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#fffbeb'; ctx.beginPath(); ctx.moveTo(hx + hs * 0.55, hy + hs * 0.55); ctx.quadraticCurveTo(hx + hs * 0.9, hy + hs * 0.9, hx + hs * 1.0, hy + hs * 0.7); ctx.lineTo(hx + hs * 0.7, hy + hs * 0.5); ctx.closePath(); ctx.fill();
  } else if (horse) {
    ctx.fillStyle = sp.body; ell(ctx, hx + hs * 0.72, hy + hs * 0.45, hs * 0.8, hs * 0.5, 0.5); ctx.fill();
    ctx.fillStyle = sp.belly; ell(ctx, hx + hs * 1.15, hy + hs * 0.78, hs * 0.36, hs * 0.32, 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(31,41,55,0.7)'; ell(ctx, hx + hs * 1.28, hy + hs * 0.72, hs * 0.07, hs * 0.09); ctx.fill();
  } else {
    ctx.fillStyle = sp.darkFace ? '#111827' : sp.accent; ell(ctx, hx + hs * 0.98, hy + hs * 0.15, hs * 0.11, hs * 0.09); ctx.fill();
  }

  // 염소 수염
  if (sp.beard) {
    ctx.fillStyle = mixColor(sp.body, '#000000', 0.25);
    ctx.beginPath(); ctx.moveTo(hx + hs * 0.55, hy + hs * 0.7); ctx.lineTo(hx + hs * 0.95, hy + hs * 0.7); ctx.lineTo(hx + hs * 0.7, hy + hs * 1.35); ctx.closePath(); ctx.fill();
  }
  // 눈·볼
  if (sp.eyePatch) { ctx.fillStyle = sp.accent; ell(ctx, hx + hs * 0.3, hy - hs * 0.12, hs * 0.32, hs * 0.26, -0.4); ctx.fill(); }
  drawEye(ctx, hx + hs * 0.32, hy - hs * 0.15, hs * 0.2, o.sleep || o.blink, sp.darkFace || sp.eyeRing || sp.eyePatch);
  if (!sp.darkFace && sp.snout !== 'pig') { ctx.fillStyle = 'rgba(251,113,133,0.4)'; ell(ctx, hx + hs * 0.08, hy + hs * 0.38, hs * 0.22, hs * 0.14); ctx.fill(); }

  // 앞쪽 귀 (머리 위에 덮이는 귀)
  if (sp.ear === 'flop') { ctx.fillStyle = sp.accent; ell(ctx, hx - hs * 0.55, hy + hs * 0.08, hs * 0.36, hs * 0.75, 0.25); ctx.fill(); }
  if (sp.ear === 'fold') {
    ctx.fillStyle = sp.accent;
    ctx.beginPath(); ctx.moveTo(hx - hs * 0.55, hy - hs * 0.85); ctx.lineTo(hx + hs * 0.08, hy - hs * 0.78); ctx.lineTo(hx - hs * 0.05, hy - hs * 0.2); ctx.closePath(); ctx.fill();
  }
}

function drawBird(ctx, sp, S, o) {
  // t: 0 = 갓 태어난 병아리 → 1 = 다 큰 닭 (성장 34%~80% 동안 몸 색·볏·꼬리깃·목·머리 크기가 조금씩 바뀐다)
  const g = o.growth ?? 1, t0 = clamp((g - 0.34) / 0.46, 0, 1), t = t0 * t0 * (3 - 2 * t0);
  const body = mixColor(sp.babyBody || sp.body, sp.body, t);
  const outline = 'rgba(60,40,20,0.3)';
  const lie = o.sleep ? 1 : (o.lie || 0);
  const bw = S * 0.36 * (sp.duck ? 1.12 : 1), bh = S * 0.31 * (1 + 0.15 * (o.belly || 0)), legL = S * (sp.duck ? 0.14 : 0.2) * (1 - lie * 0.9);
  const by = -(legL + bh * 0.9);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 다리
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = S * (sp.duck ? 0.06 : 0.05);
  [[-S * 0.07, 0], [S * 0.09, Math.PI]].forEach(([x, ph]) => {
    const sw = o.moving ? Math.sin(o.phase + ph) * S * 0.09 : 0;
    ctx.beginPath(); ctx.moveTo(x, by + bh * 0.7); ctx.lineTo(x + sw, 0); ctx.lineTo(x + sw + S * 0.09, 0); ctx.stroke();
  });
  // 꼬리깃: 자라면서 점점 길어진다 (오리는 짧게 위로 치켜든 꼬리)
  if (t > 0.05) {
    ctx.fillStyle = body; ctx.strokeStyle = outline; ctx.lineWidth = 1;
    if (sp.duck) {
      ctx.beginPath(); ctx.moveTo(-bw * 0.7, by - bh * 0.1); ctx.lineTo(-bw * (0.8 + 0.42 * t), by - bh * (0.2 + 0.55 * t)); ctx.lineTo(-bw * 0.8, by - bh * 0.55 * t); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      [-0.9, -0.55, -0.2].forEach(a => { ell(ctx, -bw * 0.85 + Math.cos(a - 1.2) * S * 0.12 * t, by - bh * 0.45 + Math.sin(a - 1.2) * S * 0.12 * t, S * 0.07 * t, S * 0.19 * t, a); ctx.fill(); ctx.stroke(); });
    }
  }
  // 몸
  ell(ctx, 0, by, bw, bh); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, S * 0.015); ctx.stroke();
  ctx.save(); ell(ctx, 0, by, bw, bh); ctx.clip();
  ctx.fillStyle = mixColor(mixColor(sp.babyBody || sp.body, '#ffffff', 0.35), sp.belly, t); ell(ctx, bw * 0.15, by + bh * 0.6, bw * 0.75, bh * 0.5); ctx.fill();
  drawMud(ctx, o.mud || 0, S, by, bw, bh);
  ctx.restore();
  // 날개 (기분 좋으면 파닥파닥, 자라면서 커진다)
  ctx.save(); ctx.translate(-bw * 0.05, by - bh * 0.05); ctx.rotate(o.wag ? Math.sin(o.t * 16) * 0.35 : 0);
  ctx.fillStyle = mixColor(body, '#000000', 0.08); ell(ctx, -bw * 0.12, bh * 0.12, bw * lerp(0.36, 0.5, t), bh * lerp(0.32, 0.44, t), 0.25); ctx.fill();
  ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  // 머리: 병아리는 몸에 붙은 큰 머리, 자라면서 목이 길어지고 머리는 작아진다
  const e = o.eat || 0, hr = S * lerp(0.21, 0.17, t);
  let hx = bw * lerp(0.5, 0.62, t) + e * S * 0.12, hy = by - bh * lerp(0.6, 0.95, t) + e * S * 0.5;
  if (lie > 0) hy = lerp(hy, by - bh * 0.2, lie * 0.8);
  if (t > 0.02) {
    ctx.strokeStyle = body; ctx.lineWidth = hr * (sp.duck ? 1.3 : 1.4);
    ctx.beginPath(); ctx.moveTo(bw * 0.45, by - bh * 0.3); ctx.lineTo(hx, hy); ctx.stroke();
  }
  if (!sp.duck && t > 0.05) {
    // 닭 볏과 턱볏: 자라면서 점점 커진다
    ctx.fillStyle = sp.accent;
    [-0.5, 0, 0.5].forEach((q, i) => { ell(ctx, hx + hr * q, hy - hr * (0.75 + (0.2 + (i === 1 ? 0.18 : 0)) * t), hr * 0.34 * t, hr * 0.38 * t); ctx.fill(); });
    ell(ctx, hx + hr * 0.75, hy + hr * (0.55 + 0.2 * t), hr * 0.22 * t, hr * 0.38 * t); ctx.fill();
  }
  ell(ctx, hx, hy, hr, hr); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, S * 0.015); ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  if (sp.duck) { ell(ctx, hx + hr * 1.15, hy + hr * 0.2, hr * 0.62, hr * 0.24, 0.05); ctx.fill(); }   // 오리는 납작하고 넓적한 부리
  else { ctx.beginPath(); ctx.moveTo(hx + hr * 0.82, hy - hr * 0.2); ctx.lineTo(hx + hr * 1.55, hy + hr * 0.12); ctx.lineTo(hx + hr * 0.82, hy + hr * 0.42); ctx.closePath(); ctx.fill(); }
  drawEye(ctx, hx + hr * 0.3, hy - hr * 0.15, hr * 0.2, o.sleep || o.blink, false);
  ctx.fillStyle = 'rgba(251,113,133,0.4)'; ell(ctx, hx + hr * 0.15, hy + hr * 0.4, hr * 0.24, hr * 0.15); ctx.fill();
}

export function drawAnimal(ctx, sp, S, o) {
  if (sp.shape === 'bird') drawBird(ctx, sp, S, o); else drawQuad(ctx, sp, S, o);
}

// 해상도 단계(기기 픽셀 배율 상한)와, 동물 수에 따라 처음부터 낮춰 둘 단계
const FARM_DPR_STEPS = [2, 1.6, 1.3, 1];
const farmCrowdLevel = (n) => (n > 40 ? 3 : n > 30 ? 2 : n > 20 ? 1 : 0);

// 씻기·청소 모드의 마우스 커서: 노란 수세미 (가운데가 문지르는 곳)
const SPONGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
<g transform="rotate(-20 22 22)"><rect x="6" y="12" width="32" height="20" rx="6" fill="#facc15" stroke="#a16207" stroke-width="2"/>
<rect x="6" y="12" width="32" height="7" rx="3" fill="#22c55e" stroke="#15803d" stroke-width="2"/>
<circle cx="14" cy="25" r="1.8" fill="#ca8a04"/><circle cx="21" cy="27" r="1.5" fill="#ca8a04"/><circle cx="28" cy="24" r="1.8" fill="#ca8a04"/><circle cx="33" cy="28" r="1.3" fill="#ca8a04"/></g>
<circle cx="36" cy="8" r="4" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.5"/><circle cx="40" cy="15" r="2.5" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.2"/></svg>`;
const SPONGE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(SPONGE_SVG)}") 22 22, crosshair`;
// 캔버스에 수세미 그리기 (터치 기기는 커서가 없으므로 문지르는 손가락 밑에 보여 준다)
function drawSponge(ctx, x, y, k, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35 + Math.sin(t * 14) * 0.12); ctx.scale(k, k);
  rr(ctx, -20, -12, 40, 24, 7); ctx.fillStyle = '#facc15'; ctx.fill(); ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2; ctx.stroke();
  rr(ctx, -20, -12, 40, 9, 4); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#15803d'; ctx.stroke();
  ctx.fillStyle = '#ca8a04'; [[-10, 3], [-2, 6], [7, 2], [14, 7]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill(); });
  ctx.restore();
}

// 아픈 친구 머리 위: 치료 버튼과 같은 모양(분홍 동그라미 + 비스듬한 반창고). size = 지름
function drawBandageBadge(ctx, x, y, size) {
  const k = size / 68;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f43f5e';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3 * k;
  ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, TAU); ctx.fill(); ctx.stroke();
  const u = 40 / 44 * k;
  ctx.scale(u, u);
  ctx.rotate(-35 * Math.PI / 180);
  rr(ctx, -21, -8, 42, 16, 8); ctx.fillStyle = '#fbbf8a'; ctx.fill(); ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.4; ctx.stroke();
  rr(ctx, -7, -6.5, 14, 13, 2.5); ctx.fillStyle = '#fde7d3'; ctx.fill(); ctx.strokeStyle = '#ea9a63'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#ea9a63';
  [-3.5, 0, 3.5].forEach(px => [-3, 0, 3].forEach(py => { ctx.beginPath(); ctx.arc(px, py, 0.7, 0, TAU); ctx.fill(); }));
  ctx.fillStyle = 'rgba(194,65,12,0.6)';
  [[-16, -3], [-13, 2], [-16, 3], [13, -3], [16, 2], [13, 3], [16, -3]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 0.9, 0, TAU); ctx.fill(); });
  ctx.restore();
}
// 치료 버튼 그림 (비스듬한 반창고)
function BandageIcon() {
  return (
    <svg width="40" height="36" viewBox="0 0 44 40" aria-hidden="true">
      <g transform="rotate(-35 22 20)">
        <rect x="1" y="12" width="42" height="16" rx="8" fill="#fbbf8a" stroke="#c2410c" strokeWidth="1.4" />
        <rect x="15" y="13.5" width="14" height="13" rx="2.5" fill="#fde7d3" stroke="#ea9a63" strokeWidth="0.8" />
        {[[6, 17], [9, 22], [6, 23], [35, 17], [38, 22], [35, 23], [38, 17]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill="#c2410c" opacity="0.6" />)}
        {[[18.5, 17], [22, 17], [25.5, 17], [18.5, 20], [22, 20], [25.5, 20], [18.5, 23], [22, 23], [25.5, 23]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.7" fill="#ea9a63" />)}
      </g>
    </svg>
  );
}

// ═══════════════════════════════ 상점 미리보기·버튼 ═══════════════════════════════
function AnimalPreview({ species }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 120 * d; c.height = 92 * d;
    ctx.scale(d, d);
    const tall = species.shape === 'bird' ? 1.15 : species.legLen + 0.6 * (species.fat || 1) + (species.neckLift ? species.neckLift + 0.45 : species.snout === 'horse' ? 0.6 : species.ear === 'long' ? 0.75 : species.antlers ? 0.7 : 0.32);
    const long = species.shape === 'bird' ? 1 : species.bodyLen + species.headSize * (species.snout === 'trunk' ? 1.4 : 0.9);
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

  const [hud, setHud] = useState({ points: 0, clean: 100, sick: 0, night: isFarmNight(), weather: 'sunny', season: farmSeasonOf(), basket: 0 });
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

    const game = loadFarm();
    const offline = catchUpFarm(game);
    const s = {
      game, W: 0, H: 0, dpr: 1, t: 0, k: 1, hz: 0, fieldTop: 0, fieldBot: 0, qLevel: farmCrowdLevel(game.animals.length), slow: 0,
      rt: {}, food: [], gifts: [], fx: [], layer: null, barnWin: null,
      pointer: { down: false, x: 0, y: 0 },
      dark: farmDark(), night: isFarmNight(), sleeping: false, lastActive: 0,
      lastSave: 0, lastHud: 0, lastVoice: {}, lastYum: -9, lastBubble: -9, lastSound: -9, nagT: 8, clockT: 0,
      // 날씨·계절 (날씨는 저장하지 않고 들어올 때마다 새로)
      season: farmSeasonOf(), weather: null, gloom: 0, rainAmt: 0, snowAmt: 0, wet: 0, snowCover: 0, rainbow: 0,
      shelter: null, puddles: [],
      basket: basketCount(loadGarden())   // 텃밭 바구니 채소 수 (🧺 버튼 숫자)
    };
    simRef.current = s;
    if (import.meta.env.DEV) window.__farm = s;   // 개발 중 확인용

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
    const sizeOf = (a, r) => FARM_BY_ID[a.sp].size * ((farmVariantOf(a) || {}).sizeMul || 1) * farmSizeScale(a.growth) * scaleOf(r.d);

    // ── 고정 배경(언덕·헛간·나무·울타리·풀밭)은 크기가 바뀔 때만 다시 그린다 ──
    const buildLayer = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(s.W * s.dpr); c.height = Math.round(s.H * s.dpr);
      const g = c.getContext('2d'); g.scale(s.dpr, s.dpr);
      const { W, H, hz, k } = s, rnd = seeded(20240611);
      const SC = SEASON_COLORS[s.season] || SEASON_COLORS.summer;
      // 먼 언덕
      [[SC[0], 0.1, 0.006, 0], [SC[1], 0.065, 0.011, 2]].forEach(([col, amp, fq, off]) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - H * amp * (0.55 + 0.45 * Math.sin(x * fq + off)) + H * 0.03);
        g.lineTo(W, H); g.closePath(); g.fill();
      });
      // 풀밭
      const fg = g.createLinearGradient(0, hz, 0, H);
      fg.addColorStop(0, SC[2]); fg.addColorStop(1, SC[3]);
      g.fillStyle = fg; g.fillRect(0, hz, W, H - hz);
      // 헛간
      const bx = W * 0.14, bbase = hz + H * 0.035, bwid = clamp(W * 0.2, 100, 230), bhei = bwid * 0.62;
      g.fillStyle = '#dc2626'; g.fillRect(bx - bwid / 2, bbase - bhei, bwid, bhei);
      g.fillStyle = '#7f1d1d';
      g.beginPath(); g.moveTo(bx - bwid * 0.58, bbase - bhei); g.lineTo(bx - bwid * 0.32, bbase - bhei * 1.5); g.lineTo(bx + bwid * 0.32, bbase - bhei * 1.5); g.lineTo(bx + bwid * 0.58, bbase - bhei); g.closePath(); g.fill();
      if (s.season === 'winter') { g.fillStyle = '#f8fafc'; g.beginPath(); g.moveTo(bx - bwid * 0.6, bbase - bhei - 2); g.lineTo(bx - bwid * 0.32, bbase - bhei * 1.52); g.lineTo(bx + bwid * 0.32, bbase - bhei * 1.52); g.lineTo(bx + bwid * 0.6, bbase - bhei - 2); g.lineTo(bx + bwid * 0.5, bbase - bhei * 1.12); g.lineTo(bx - bwid * 0.5, bbase - bhei * 1.12); g.closePath(); g.fill(); }
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, bwid * 0.025);
      g.strokeRect(bx - bwid / 2, bbase - bhei, bwid, bhei);
      const dw = bwid * 0.34, dh = bhei * 0.62;
      g.fillStyle = '#991b1b'; g.fillRect(bx - dw / 2, bbase - dh, dw, dh); g.strokeRect(bx - dw / 2, bbase - dh, dw, dh);
      g.beginPath(); g.moveTo(bx - dw / 2, bbase - dh); g.lineTo(bx + dw / 2, bbase); g.moveTo(bx + dw / 2, bbase - dh); g.lineTo(bx - dw / 2, bbase); g.stroke();
      const ww = bwid * 0.16;
      s.barnWin = { x: bx - ww / 2, y: bbase - bhei * 1.28, w: ww, h: ww };
      g.fillStyle = '#fef3c7'; g.fillRect(s.barnWin.x, s.barnWin.y, ww, ww); g.strokeRect(s.barnWin.x, s.barnWin.y, ww, ww);
      // 나무 (봄: 꽃, 여름: 사과, 가을: 단풍, 겨울: 앙상한 가지에 눈)
      const tx = W * 0.87, tb = hz + H * 0.045, th = clamp(H * 0.3, 90, 220);
      g.fillStyle = '#92400e'; g.fillRect(tx - th * 0.06, tb - th * 0.5, th * 0.12, th * 0.5);
      if (s.season === 'winter') {
        g.strokeStyle = '#92400e'; g.lineCap = 'round';
        [[-0.25, -0.8], [0.22, -0.82], [0, -0.92], [-0.14, -0.66], [0.15, -0.64]].forEach(([qx, qy]) => { g.lineWidth = th * 0.035; g.beginPath(); g.moveTo(tx, tb - th * 0.48); g.lineTo(tx + th * qx, tb + th * qy); g.stroke(); });
        g.fillStyle = '#f8fafc';
        [[-0.25, -0.8], [0.22, -0.82], [0, -0.92]].forEach(([qx, qy]) => { ell(g, tx + th * qx, tb + th * qy - 2, th * 0.06, th * 0.025); g.fill(); });
      } else {
        const leaf = s.season === 'autumn' ? ['#ea8a1a', '#dc6b12', '#f2b33d', '#c2410c'] : [SC[4], SC[4], SC[4], SC[4]];
        [[0, -0.72, 0.3], [-0.2, -0.58, 0.24], [0.2, -0.58, 0.24], [0, -0.5, 0.22]].forEach(([qx, qy, qr], i) => { g.fillStyle = leaf[i]; g.beginPath(); g.arc(tx + th * qx, tb + th * qy, th * qr, 0, TAU); g.fill(); });
        g.fillStyle = s.season === 'spring' ? '#f9a8d4' : s.season === 'autumn' ? '#fde68a' : '#ef4444';
        const dots = s.season === 'spring' ? [[-0.18, -0.62], [0.12, -0.78], [0.22, -0.55], [-0.02, -0.52], [-0.28, -0.5], [0.05, -0.68], [-0.1, -0.85], [0.28, -0.66]] : [[-0.18, -0.62], [0.12, -0.78], [0.22, -0.55], [-0.02, -0.52], [-0.28, -0.5]];
        dots.forEach(([qx, qy]) => { g.beginPath(); g.arc(tx + th * qx, tb + th * qy, th * (s.season === 'spring' ? 0.028 : 0.035), 0, TAU); g.fill(); });
      }
      // 뒤쪽 울타리
      const fy = hz + H * 0.06, fh = 26 * k;
      g.strokeStyle = '#c9a66b'; g.fillStyle = '#f5e6c8'; g.lineWidth = 1.5;
      [0.35, 0.72].forEach(q => { g.fillRect(0, fy - fh * q - 2.5 * k, W, 5 * k); g.strokeRect(0, fy - fh * q - 2.5 * k, W, 5 * k); });
      for (let x = 14 * k; x < W; x += 48 * k) { rr(g, x - 4 * k, fy - fh, 8 * k, fh, 3 * k); g.fill(); g.stroke(); }
      // 육식동물 우리 바닥은 모래빛 (초원 느낌)
      if (s.season !== 'winter') {
        const mx = PEN_X.meat[0] * W - 6 * k;
        const sg = g.createLinearGradient(0, fy, 0, H);
        sg.addColorStop(0, 'rgba(236,206,140,0.30)'); sg.addColorStop(1, 'rgba(214,170,96,0.42)');
        g.fillStyle = sg; g.fillRect(mx, fy, W - mx, H - fy);
      }
      // 풀 포기와 꽃
      for (let i = 0; i < 90; i++) {
        const d = rnd(), x = rnd() * W, y = lerp(fy + 6, H - 4, d), sz = (4 + rnd() * 5) * (0.6 + d * 0.7) * k;
        g.strokeStyle = s.season === 'winter' ? `rgba(100,116,139,${0.25 + rnd() * 0.2})` : s.season === 'autumn' ? `rgba(120,110,40,${0.35 + rnd() * 0.3})` : `rgba(34,120,50,${0.35 + rnd() * 0.3})`;
        g.lineWidth = Math.max(1, sz * 0.22); g.lineCap = 'round';
        [-0.5, 0, 0.5].forEach(a => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * sz, y - Math.cos(a) * sz); g.stroke(); });
      }
      const flowerN = { spring: 50, summer: 26, autumn: 10, winter: 0 }[s.season] ?? 26;
      for (let i = 0; i < flowerN; i++) {
        const d = rnd(), x = rnd() * W, y = lerp(fy + 10, H - 6, d), sz = (2.2 + rnd() * 1.6) * (0.6 + d * 0.7) * k;
        g.fillStyle = s.season === 'autumn' ? ['#f59e0b', '#c2410c', '#fbbf24'][Math.floor(rnd() * 3)] : ['#ffffff', '#fde047', '#f9a8d4', '#fca5a5'][Math.floor(rnd() * 4)];
        for (let q = 0; q < 5; q++) { g.beginPath(); g.arc(x + Math.cos(q * 1.257) * sz, y + Math.sin(q * 1.257) * sz, sz * 0.7, 0, TAU); g.fill(); }
        g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(x, y, sz * 0.6, 0, TAU); g.fill();
      }
      // 쉼터 (비가 오면 동물들이 이 앞으로 모인다)
      const yd = (d) => lerp(s.fieldTop, s.fieldBot, d);
      const sw = 116 * k, sh = 64 * k;
      s.shelter = {
        herb: { x: lerp(PEN_X.herb[0], PEN_X.herb[1], 0.66) * W, w: sw },
        meat: { x: lerp(PEN_X.meat[0], PEN_X.meat[1], 0.66) * W, w: sw }
      };
      Object.values(s.shelter).forEach(({ x }) => {
        const base = yd(0) + 2 * k;
        g.fillStyle = '#7c4a1e'; g.fillRect(x - sw / 2, base - sh, sw, sh);
        g.fillStyle = '#5b3716'; g.fillRect(x - sw * 0.36, base - sh * 0.72, sw * 0.72, sh * 0.72);
        g.fillStyle = s.season === 'winter' ? '#f1f5f9' : '#b45309';
        g.beginPath(); g.moveTo(x - sw * 0.62, base - sh); g.lineTo(x, base - sh * 1.55); g.lineTo(x + sw * 0.62, base - sh); g.closePath(); g.fill();
        g.strokeStyle = '#78350f'; g.lineWidth = 2 * k; g.stroke();
        g.fillStyle = '#a16207'; [-0.5, 0.5].forEach(q => g.fillRect(x + q * sw - 4 * k, base - sh, 8 * k, sh));
      });
      // 구역 울타리 (세로): 앞으로 올수록 크게
      const postAt = (x) => {
        const pts = [];
        for (let i = 0; i <= 8; i++) { const d = i / 8, y = lerp(fy + 4 * k, H - 3 * k, d), z = 0.55 + d * 0.75; pts.push({ x, y, h: 24 * k * z, w: 7 * k * z }); }
        g.strokeStyle = '#a07b47'; g.fillStyle = '#f5e6c8'; g.lineWidth = 1.4;
        [0.4, 0.78].forEach(q => {
          g.lineWidth = 5 * k; g.strokeStyle = '#e8d3a8'; g.beginPath(); pts.forEach((pt, i) => { const yy = pt.y - pt.h * q; if (i) g.lineTo(pt.x, yy); else g.moveTo(pt.x, yy); }); g.stroke();
        });
        g.lineWidth = 1.4; g.strokeStyle = '#a07b47';
        pts.forEach(pt => { rr(g, pt.x - pt.w / 2, pt.y - pt.h, pt.w, pt.h, 2.5 * k); g.fill(); g.stroke(); });
      };
      FENCE_X.forEach(q => postAt(q * W));
      // 구역 이름판
      const sign = (cx, text) => {
        const bw = 112 * k, bh = 26 * k, by = fy + 10 * k;
        g.fillStyle = '#a16207'; g.fillRect(cx - 2 * k, by + bh, 4 * k, 10 * k);
        rr(g, cx - bw / 2, by, bw, bh, 7 * k); g.fillStyle = '#fef3c7'; g.fill(); g.strokeStyle = '#a16207'; g.lineWidth = 2 * k; g.stroke();
        g.fillStyle = '#78350f'; g.font = `900 ${Math.round(13 * k)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, cx, by + bh / 2 + 1);
      };
      sign(lerp(PEN_X.herb[0], PEN_X.herb[1], 0.4) * W, `${FARM_PENS.herb.icon} ${FARM_PENS.herb.name}`);
      sign(lerp(PEN_X.meat[0], PEN_X.meat[1], 0.26) * W, `${FARM_PENS.meat.icon} ${FARM_PENS.meat.name}`);
      // 비 온 뒤 웅덩이 자리
      const prnd = seeded(5150);
      s.puddles = Array.from({ length: 7 }, (_, i) => ({ pen: i < 5 ? 'herb' : 'meat', q: 0.12 + prnd() * 0.76, d: 0.2 + prnd() * 0.7, w: 0.8 + prnd() * 0.6 }));
      s.layer = c;
    };
    s.rebuild = () => buildLayer();

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const oldW = s.W;
      s.W = Math.max(240, r.width); s.H = Math.max(240, r.height);
      s.dpr = Math.min(window.devicePixelRatio || 1, FARM_DPR_STEPS[s.qLevel]);
      s.k = clamp(Math.min(s.W, s.H * 1.5) / 620, 0.75, 1.6);
      s.hz = s.H * 0.42; s.fieldTop = s.H * 0.56; s.fieldBot = s.H * 0.95;
      canvas.width = Math.round(s.W * s.dpr); canvas.height = Math.round(s.H * s.dpr);
      canvas.style.width = `${s.W}px`; canvas.style.height = `${s.H}px`;
      if (oldW) { const q = s.W / oldW; Object.values(s.rt).forEach(r2 => { r2.x *= q; r2.tx *= q; }); s.food.forEach(f => { f.x *= q; }); s.gifts.forEach(f => { f.x *= q; }); }
      buildLayer();
      if (s.redraw) s.redraw();   // 크기를 바꾸면 캔버스가 지워지므로 바로 다시 그린다 (깜빡임 방지)
    };

    // 우리 안에서 다닐 수 있는 가로 범위(px)
    const penRange = (pen) => { const [a, b] = PEN_X[pen]; return [a * s.W + 24 * s.k, b * s.W - 24 * s.k]; };
    s.penRange = penRange;
    const ensureRt = (a, entering) => {
      if (s.rt[a.uid]) return s.rt[a.uid];
      const [px0, px1] = penRange(farmPenOf(a.sp));
      const x = rand(px0, px1), d = rand(0.05, 0.95);
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
    // 초식동물 우리엔 건초·채소, 육식동물 우리엔 고기
    s.feed = () => {
      if (s.food.some(f => f.bites > 0 && !f.crop)) { showToast('🥕 아직 밥이 남아 있어요!'); return; }
      if (!game.animals.length) { showToast('🛒 상점에서 동물 친구를 데려와요!'); return; }
      ['herb', 'meat'].forEach(pen => {
        const cnt = game.animals.filter(a => farmPenOf(a.sp) === pen).length;
        if (!cnt) return;
        const [x0, x1] = penRange(pen);
        const n = clamp(Math.ceil(cnt * 0.5), 1, 30);
        for (let i = 0; i < n; i++) s.food.push({ x: rand(x0, x1), d: rand(0.1, 0.9), bites: 3, fall: 1 + i * 0.12, life: 90, gone: 0, pen });
      });
      audio.playYum();
      say('feed', VOICE.farmFeed(), 6);
    };

    // ── 날씨 ── 맑음·흐림·비(겨울엔 눈)가 몇 분마다 바뀐다. 비가 그치면 무지개
    const setWeather = (kind, quiet) => {
      const prev = s.weather ? s.weather.kind : 'sunny';
      const [a, b] = WEATHER_SEC[kind];
      s.weather = { kind, t: rand(a, b) };
      if (quiet) return;
      if (kind === 'rain') { say('rain', VOICE.farmRain(), 60); Object.values(s.rt).forEach(r => { r.wait = Math.min(r.wait, 0.3); }); }
      if (kind === 'snow') say('snow', VOICE.farmSnow(), 60);
      if (prev === 'rain' && kind === 'sunny') { s.rainbow = 40; after(() => say('rainbow', VOICE.farmRainbow(), 60), 1500); }
    };
    const nextWeather = () => {
      if (s.weather.kind === 'rain' || s.weather.kind === 'snow') return 'sunny';
      const q = Math.random();
      return q < 0.5 ? 'sunny' : q < 0.72 ? 'cloudy' : s.season === 'winter' ? 'snow' : 'rain';
    };
    { const q = Math.random(); setWeather(q < 0.65 ? 'sunny' : q < 0.85 ? 'cloudy' : s.season === 'winter' ? 'snow' : 'rain', true); }
    s.setWeather = setWeather;

    // ── 텃밭 바구니 채소를 초식동물 우리에 (좋아하는 채소를 먹으면 하트·별을 더) ──
    s.feedVeg = () => {
      const herbs = game.animals.filter(a => farmPenOf(a.sp) === 'herb').length;
      if (!herbs) { showToast('🌿 초식동물 친구가 없어요!'); return; }
      // 한 번에 한 밭 수확만큼(6개), 초식동물이 많으면 그만큼 (최대 12개)
      const crops = takeFromBasket(clamp(Math.max(6, herbs), 1, 12));
      s.basket = basketCount(loadGarden());
      if (!crops.length) { showToast('🧺 바구니가 비었어요! 텃밭에서 채소를 키워 와요'); say('vegempty', VOICE.farmBasketEmpty(), 4); return; }
      const [x0, x1] = penRange('herb');
      crops.forEach((id, i) => s.food.push({ x: rand(x0, x1), d: rand(0.15, 0.85), bites: 2, fall: 1 + i * 0.12, life: 120, gone: 0, pen: 'herb', crop: id }));
      const counts = {};
      crops.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      showToast(`🧺 ${Object.entries(counts).map(([id, n]) => `${CROP_BY_ID[id].icon}${n}`).join(' ')} 채소 ${crops.length}개를 줬어요! (바구니에 ${s.basket}개 남음)`);
      audio.playYum();
      say('veg', VOICE.farmBasketFeed(), 4);
    };

    // ── 입력 ──
    const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hitAnimal = (x, y, pad = 1) => {   // pad: 터치 범위 배율 (씻기는 넓게)
      const list = game.animals.slice().sort((a, b) => s.rt[b.uid].d - s.rt[a.uid].d);
      for (const a of list) {
        const r = s.rt[a.uid], S = sizeOf(a, r);
        if (Math.hypot(r.x - x, yOf(r.d) - S * 0.5 - y) < Math.max(30, S * 0.65) * pad) return a;
      }
      return null;
    };
    const hearts = (x, y, text = '💗', n = 4) => { for (let i = 0; i < n; i++) s.fx.push({ x: x + rand(-22, 22), y: y + rand(-10, 10), text, life: rand(0.8, 1.3), vy: rand(-48, -26) }); };

    // 아기 동물들을 (x, d) 근처에 태어나게 한다. 자리가 모자라면 들어갈 만큼만
    const spawnBabies = (spId, n, x, d, family = {}) => {
      const room = Math.max(0, FARM_LIMITS_BREED - game.animals.length);
      const count = Math.min(n, room);
      for (let i = 0; i < count; i++) {
        const baby = newAnimal(spId);
        if (FARM_VARIANTS[spId]) {
          const mom = game.animals.find(o => o.uid === family.mom), dad = game.animals.find(o => o.uid === family.dad);
          const q = Math.random();
          if (mom && mom.variant && q < 0.6) baby.variant = mom.variant;
          else if (dad && dad.variant && q < 0.9) baby.variant = dad.variant;
        }
        if (family.mom) { baby.mom = family.mom; if (family.momName) baby.momName = family.momName; }
        if (family.dad) { baby.dad = family.dad; if (family.dadName) baby.dadName = family.dadName; }
        game.animals.push(baby);
        const r = ensureRt(baby, true);
        r.x = clamp(x + rand(-40, 40) * s.k, 10, s.W - 10); r.d = clamp(d + rand(-0.06, 0.06), 0, 1); r.tx = r.x; r.td = r.d; r.wait = rand(1, 3);
        hearts(r.x, yOf(r.d) - 20, i % 2 ? '✨' : '💗', 2);
      }
      return count;
    };
    // 배 속 아기가 다 자라면: 새끼를 낳거나, 둥지에 알을 낳는다
    const deliver = (a) => {
      const sp = FARM_BY_ID[a.sp], br = farmBreedOf(a.sp), r = s.rt[a.uid];
      const n = br.brood[0] + Math.floor(Math.random() * (br.brood[1] - br.brood[0] + 1));
      const dadA = a.pregDad && game.animals.find(o => o.uid === a.pregDad);
      const family = { mom: a.uid, momName: a.name, dad: a.pregDad, dadName: dadA ? dadA.name : undefined };
      delete a.preg; delete a.pregDad;
      a.restUntil = Date.now() + FARM_RATES.pregRestSec * 1000;
      const x = r ? r.x : s.W / 2, d = r ? r.d : 0.5;
      if (br.type === 'egg') {
        game.eggs.push({ uid: newFarmUid(), sp: a.sp, x: clamp((x - (r ? r.face : 1) * 34 * s.k) / s.W, 0.05, 0.95), d, n, t: FARM_RATES.eggHatchSec, family });
        audio.playPopSound(); say('eggs', VOICE.farmEggs(sp));
        showToast(`🥚 ${a.name || sp.name} 이(가) 둥지에 알 ${n}개를 낳았어요!`);
      } else {
        const got = spawnBabies(a.sp, n, x, d, family);
        if (got) {
          addPoints(FARM_REWARDS.birth, x, yOf(d) - 60); audio.playFanfare(); say('birth', VOICE.farmBirth(sp));
          showToast(`🍼 ${a.name || sp.name} 아기 ${got}마리가 태어났어요!`);
        }
      }
      saveFarm(game);
    };

    const pet = (a) => {
      const r = s.rt[a.uid], S = sizeOf(a, r), y = yOf(r.d) - S;
      a.happy = Math.min(100, a.happy + 15);
      r.hopT = 0.6;
      hearts(r.x, y);
      if (s.t - (r.petAt ?? -9) > 3) { r.petAt = s.t; addPoints(FARM_REWARDS.pet, r.x, y - 16); }
      if (s.t - s.lastSound > 1.2) {
        s.lastSound = s.t;
        if (a.name) speak(VOICE.farmHello(farmSpeciesOf(a), a.name));
        else speak(VOICE.farmInfo(farmSpeciesOf(a), farmStageOf(a.growth)));
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
      if (a.name) game.animals.forEach(kd => { if (kd.mom === a.uid) kd.momName = a.name; if (kd.dad === a.uid) kd.dadName = a.name; });
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
      let sickCount = game.animals.filter(o => o.sick).length;

      // 날씨
      s.weather.t -= dt;
      if (s.weather.t <= 0) setWeather(nextWeather());
      const wk = s.weather.kind, raining = wk === 'rain';
      s.gloom += (({ sunny: 0, cloudy: 0.45, rain: 0.8, snow: 0.5 })[wk] - s.gloom) * Math.min(1, dt * 0.4);
      s.rainAmt += ((raining ? 1 : 0) - s.rainAmt) * Math.min(1, dt * 0.6);
      s.snowAmt += ((wk === 'snow' ? 1 : 0) - s.snowAmt) * Math.min(1, dt * 0.5);
      s.wet = clamp(s.wet + (raining ? dt / 20 : -dt / 70), 0, 1);
      s.snowCover = clamp(s.snowCover + (wk === 'snow' ? dt / 45 : -dt / 150), 0, 0.85);
      if (s.rainbow > 0) s.rainbow -= dt;


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
        washing = hitAnimal(x, y, 1.45);   // 몸 주변을 대충 문질러도 닦인다
        const before = game.poop.length;
        game.poop = game.poop.filter(p => {
          const hit = Math.hypot(p.x * s.W - x, yOf(p.y) - y) < 50 * s.k;
          if (hit) addPoints(FARM_REWARDS.poop, p.x * s.W, yOf(p.y) - 20);
          return !hit;
        });
        if (game.poop.length !== before) audio.playPopSound();
        if (washing) {
          const r = s.rt[washing.uid];
          r.washT = 0.5;
          if (washing.mud >= 25) r.wasDirty = true;
          washing.mud = Math.max(0, washing.mud - 260 * dt);   // 아주 지저분해도 0.4초 정도면 깨끗
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

      if (game.eggs.length) {
        const hatched = [];
        game.eggs.forEach(e => { e.t -= dt; if (e.t <= 0) hatched.push(e); });
        if (hatched.length) {
          game.eggs = game.eggs.filter(e => !hatched.includes(e));
          hatched.forEach(e => {
            const x = e.x * s.W, n = spawnBabies(e.sp, e.n, x, e.d, e.family);
            if (n) { addPoints(FARM_REWARDS.birth, x, yOf(e.d) - 50); audio.playFanfare(); say('hatch', VOICE.farmHatch(FARM_BY_ID[e.sp])); }
          });
          saveFarm(game);
        }
      }

      game.animals.forEach(a => {
        const sp = FARM_BY_ID[a.sp], r = ensureRt(a, false);
        const pen = farmPenOf(a.sp), [px0, px1] = penRange(pen);
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
          a.sick = true; sickCount++;
          say('sick', VOICE.farmSick(), 20);
          audio.playFreq(330, 'sine', 0.25, 0.3);
          showToast(`🩹 ${a.name || farmSpeciesOf(a).name} 이(가) 아파요! 밴드를 붙여 주세요`);
          saveFarm(game);
        }
        // 번식: 짝이 있고 컨디션이 좋으면 가끔 아기(알)를 갖고, 배가 점점 불러서 낳는다
        if (a.preg != null) {
          a.preg += dt / FARM_RATES.pregSec;
          if (a.preg >= 1) deliver(a);
        } else if (farmMateStatus(game, a) && Math.random() < FARM_RATES.pregPerSec * dt) {
          const males = game.animals.filter(o => o.sp === a.sp && o.sex === 'm' && farmStageOf(o.growth) === 'adult' && !o.sick);
          a.preg = 0; a.pregDad = males[Math.floor(Math.random() * males.length)].uid;
          hearts(r.x, yOf(r.d) - sizeOf(a, r), '💕', 6);
          say('preg', VOICE.farmPregnant(sp, farmBreedOf(a.sp).type), 5);
          saveFarm(game);
        }
        // 컨디션이 좋으면 가끔 선물을 떨어뜨린다 (다 크기 전에는 작은 선물을 조금 더 드물게)
        if (!sad && sp.gift) {
          const grown = now === 'adult';
          a.giftT = (a.giftT || 0) + dt;
          if (a.giftT >= sp.gift.everySec * (grown ? 1 : YOUNG_GIFT_MUL) && s.gifts.length < 8) {
            a.giftT = 0;
            const stars = grown ? sp.gift.stars : YOUNG_GIFT_STARS[Math.floor(Math.random() * YOUNG_GIFT_STARS.length)];
            s.gifts.push({ x: clamp(r.x - r.face * 30 * s.k, 20, s.W - 20), d: r.d, icon: sp.gift.icon, stars, small: !grown, life: 120, bob: 0 });
          }
        }
        if (r.poopDue > 0) {
          r.poopDue -= dt;
          if (r.poopDue <= 0 && game.poop.length < FARM_RATES.poopMax) {
            game.poop.push({ x: clamp((r.x - r.face * 24 * s.k) / s.W, 0.03, 0.97), y: r.d });
            audio.playFreq(180, 'sine', 0.12, 0.25);   // 뿡!
            saveFarm(game);
          }
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
            const wasHungry = a.full < 70;   // 배고플 때 먹으면 별을 더 준다
            a.full = Math.min(100, a.full + 40); a.happy = Math.min(100, a.happy + 6);
            addPoints(wasHungry ? FARM_REWARDS.eatHungry : FARM_REWARDS.eat, r.x, yOf(r.d) - sizeOf(a, r) - 10);
            // 텃밭 채소: 기분이 더 좋아지고, 제일 좋아하는 채소면 하트·별을 더
            if (r.eatCrop) {
              a.happy = Math.min(100, a.happy + 15);
              if (FAVORITE_CROP[a.sp] === r.eatCrop) {
                r.hopT = 0.6; hearts(r.x, yOf(r.d) - sizeOf(a, r), '💖', 6);
                addPoints(FAVORITE_STARS, r.x, yOf(r.d) - sizeOf(a, r) - 34);
                say('fav', VOICE.farmFavorite(), 12);
              }
              r.eatCrop = null;
            }
            if (!(r.poopDue > 0)) r.poopDue = rand(FARM_RATES.poopEverySec[0], FARM_RATES.poopEverySec[1]);   // 이미 기다리는 중이면 미루지 않는다
            if (s.t - s.lastYum > 0.9) { s.lastYum = s.t; audio.playYum(); }
          }
        } else {
          const S = sizeOf(a, r);
          let seeking = null;
          if (a.full < 80) {
            let bd = Infinity;
            s.food.forEach(f => {
              if (f.bites <= 0 || f.fall > 0 || (f.pen || 'herb') !== pen) return;
              let dd = Math.hypot(f.x - r.x, (f.d - r.d) * fieldH);
              if (f.crop && FAVORITE_CROP[a.sp] === f.crop) dd *= 0.4;   // 좋아하는 채소부터
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
              r.tx = rand(px0, px1); r.td = rand(0.02, 0.98);
              // 비가 오면 우리 쉼터 앞으로
              if (raining && s.shelter) { const sh = s.shelter[pen]; r.tx = clamp(sh.x + rand(-0.5, 0.5) * sh.w, px0, px1); r.td = rand(0.02, 0.2); }
              // 아직 다 크지 않은 아기는 엄마 곁으로 졸졸 따라간다
              const mr = a.mom && a.growth < 0.8 ? s.rt[a.mom] : null;
              if (mr && Math.random() < 0.85) { r.tx = clamp(mr.x - mr.face * rand(30, 70) * s.k, 10, s.W - 10); r.td = clamp(mr.d + rand(-0.06, 0.06), 0, 1); r.wait = 0; }
              r.run = !!sp.runner && Math.random() < 0.4;
            }
          }
          const dx = r.tx - r.x, dy = (r.td - r.d) * fieldH, dist = Math.hypot(dx, dy);
          if (dist > 6 && (seeking || r.wait <= 0)) {
            const v = 46 * s.k * sp.speed * (0.65 + 0.5 * r.d) * (sad ? 0.55 : 1) * (r.run ? 2 : 1) * (seeking ? 1.5 : 1);
            const step = Math.min(dist, v * dt);
            r.x = clamp(r.x + (dx / dist) * step, px0, px1); r.d = clamp(r.d + (dy / dist) * step / fieldH, 0, 1);
            if (Math.abs(dx) > 2) r.face = dx > 0 ? 1 : -1;
            r.moving = 1;
            r.phase += dt * (sp.hop ? 7 : 9) * (r.run ? 1.6 : 1) * sp.speed;
          } else if (seeking) {
            r.face = seeking.x >= r.x ? 1 : -1;
            seeking.bites -= 1; r.eatT = 1.3; r.eatCrop = seeking.crop || null;
          } else if (r.wait <= 0) {
            r.wait = rand(1.5, 5) * (sp.napper ? 2.6 : 1) * (a.mom && a.growth < 0.8 && s.rt[a.mom] ? 0.4 : 1) * (raining ? 2 : 1);
          }
          if (r.x < px0 - 1 || r.x > px1 + 1) r.x = clamp(r.x, px0, px1);
        }
        r.lie += (lieTarget - r.lie) * Math.min(1, dt * 5);
      });

      // 밤이면 한동안 아무도 만지지 않을 때 모두 잔다
      s.clockT -= dt;
      if (s.clockT <= 0) {
        s.clockT = 5; s.night = isFarmNight(); s.dark = farmDark();
        const season = farmSeasonOf();
        if (season !== s.season) { s.season = season; buildLayer(); }
      }
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
      if (s.gloom > 0.01) { ctx.fillStyle = `rgba(71,85,105,${s.gloom * 0.55})`; ctx.fillRect(0, 0, W, s.hz + H * 0.05); }
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
        ctx.globalAlpha = clamp((1 - dark / 0.75) * (1 - s.gloom * 1.15), 0, 1);
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + s.t * 0.15; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 34 * k, sy + Math.sin(a) * 34 * k); ctx.lineTo(sx + Math.cos(a) * 46 * k, sy + Math.sin(a) * 46 * k); ctx.stroke(); }
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(sx, sy, 27 * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = mixColor('#ffffff', '#94a3b8', s.gloom);
      clouds.forEach(c => {
        const x = ((c.off * (W + 260) + s.t * c.sp) % (W + 260)) - 130, y = c.y * H, z = 26 * k * c.sz;
        ctx.globalAlpha = 0.92 - dark * 0.78;
        [[0, 0, 1], [-1, 0.25, 0.75], [1, 0.2, 0.8], [0.4, -0.35, 0.7]].forEach(([qx, qy, qr]) => { ctx.beginPath(); ctx.arc(x + qx * z, y + qy * z, z * qr, 0, TAU); ctx.fill(); });
      });
      ctx.globalAlpha = 1;
      // 무지개 (비가 그친 뒤)
      if (s.rainbow > 0) {
        const ra = Math.min(1, s.rainbow / 6, (40 - s.rainbow) / 3) * 0.55 * (1 - dark);
        if (ra > 0.01) {
          const cx = W * 0.55, cy = s.hz + H * 0.12, R0 = Math.min(W * 0.42, H * 0.52);
          ctx.lineWidth = 7 * k; ctx.globalAlpha = ra;
          ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'].forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R0 - i * 7 * k, Math.PI, TAU); ctx.stroke(); });
          ctx.globalAlpha = 1;
        }
      }
      if (s.layer) ctx.drawImage(s.layer, 0, 0, W, H);
      // 웅덩이 (비가 오면 생기고 마르면 사라짐)
      if (s.wet > 0.02) {
        s.puddles.forEach(pd => {
          const [x0, x1] = PEN_X[pd.pen], x = lerp(x0, x1, pd.q) * W, y = yOf(pd.d), sc = scaleOf(pd.d);
          ctx.fillStyle = `rgba(96,150,210,${0.5 * s.wet})`; ell(ctx, x, y, 34 * sc * pd.w * (0.4 + 0.6 * s.wet), 9 * sc * pd.w * (0.4 + 0.6 * s.wet)); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${0.35 * s.wet})`; ell(ctx, x - 8 * sc, y - 2 * sc, 10 * sc * pd.w, 2.2 * sc); ctx.fill();
          if (s.rainAmt > 0.3) { const ph = fract(s.t * 1.3 + pd.q * 7); ctx.strokeStyle = `rgba(255,255,255,${(1 - ph) * 0.6 * s.rainAmt})`; ctx.lineWidth = 1.2; ell(ctx, x + (pd.q - 0.5) * 20 * sc, y, 4 * sc + ph * 12 * sc, 1.2 * sc + ph * 3 * sc); ctx.stroke(); }
        });
      }
      // 쌓인 눈
      if (s.snowCover > 0.01) { ctx.fillStyle = `rgba(248,250,252,${s.snowCover * 0.6})`; ctx.fillRect(0, s.hz, W, H - s.hz); }
      // 땅 위의 것들을 뒤에서부터
      const items = [];
      game.poop.forEach(p => items.push({ d: p.y - 0.001, kind: 'poop', p }));
      s.food.forEach(f => items.push({ d: f.d, kind: 'food', f }));
      s.gifts.forEach(g => items.push({ d: g.d, kind: 'gift', g }));
      game.eggs.forEach(e => items.push({ d: e.d - 0.0005, kind: 'nest', e }));
      game.animals.forEach(a => items.push({ d: s.rt[a.uid].d, kind: 'animal', a }));
      items.sort((p, q) => p.d - q.d);
      const dirt = farmDirt(game);
      const badges = [];
      items.forEach(it => {
        if (it.kind === 'nest') {
          // 둥지와 알: 깨어날 때가 되면 꼼지락거린다
          const e = it.e, sc = scaleOf(e.d), x = e.x * W, y = yOf(e.d), ready = 1 - clamp(e.t / FARM_RATES.eggHatchSec, 0, 1);
          ctx.fillStyle = '#a16207'; ell(ctx, x, y - 4 * sc, 30 * sc, 11 * sc); ctx.fill();
          ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 2 * sc;
          for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(x + (i - 3) * 8 * sc, y - 2 * sc, 9 * sc, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
          for (let i = 0; i < e.n; i++) {
            const jig = ready > 0.8 ? Math.sin(s.t * 18 + i) * 0.25 : 0;
            const ex = x + (i - (e.n - 1) / 2) * 13 * sc, ey = y - 12 * sc;
            ctx.save(); ctx.translate(ex, ey); ctx.rotate(jig);
            ctx.fillStyle = e.sp === 'duck' ? '#ecfdf5' : '#fef3c7'; ell(ctx, 0, 0, 7 * sc, 9 * sc); ctx.fill();
            ctx.strokeStyle = 'rgba(120,80,30,0.35)'; ctx.lineWidth = 1; ctx.stroke();
            if (ready > 0.6) { ctx.strokeStyle = 'rgba(120,80,30,0.7)'; ctx.beginPath(); ctx.moveTo(-4 * sc, -1 * sc); ctx.lineTo(-1 * sc, 2 * sc); ctx.lineTo(2 * sc, -2 * sc); ctx.lineTo(5 * sc, 1 * sc); ctx.stroke(); }
            ctx.restore();
          }
        } else if (it.kind === 'poop') {
          const x = it.p.x * W, y = yOf(it.p.y), z = 9 * scaleOf(it.p.y);
          ctx.fillStyle = '#7c4a21';
          [[0, 0, 1], [0, -0.7, 0.72], [0, -1.25, 0.45]].forEach(([qx, qy, qr]) => { ell(ctx, x + qx * z, y + qy * z - z * 0.4, z * qr, z * qr * 0.62); ctx.fill(); });
        } else if (it.kind === 'food') {
          const f = it.f, sc = scaleOf(f.d), x = f.x, y = yOf(f.d) - f.fall * H * 0.5;
          const a = f.bites > 0 ? 1 : clamp(1 - f.gone / 1.2, 0, 1), z = (10 + Math.max(0, f.bites) * 5) * sc;
          if (f.pen === 'meat') {
            // 육식동물 우리: 고기
            ctx.fillStyle = `rgba(120,53,15,${0.22 * a})`; ell(ctx, x, y - z * 0.1, z * 1.2, z * 0.42); ctx.fill();
            emoji('🍖', x, y - z * 0.6, z * (1.3 + 0.22 * Math.max(0, f.bites)), a);
            if (f.bites >= 3) emoji('🍗', x + z * 0.75, y - z * 0.45, z * 1.1, a);
            return;
          }
          if (f.crop) {
            // 텃밭에서 딴 채소
            ctx.fillStyle = `rgba(234,179,8,${0.5 * a})`; ell(ctx, x, y - z * 0.2, z * 1.1, z * 0.4); ctx.fill();
            emoji(CROP_BY_ID[f.crop].icon, x, y - z * 0.6, z * (1.2 + 0.25 * Math.max(0, f.bites)), a);
            return;
          }
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
          emoji(g.icon, g.x, y - 16 * sc - Math.abs(Math.sin(g.bob * 3)) * 5 * sc, (g.small ? 19 : 26) * sc, g.life < 8 ? 0.4 + 0.6 * Math.abs(Math.sin(g.bob * 6)) : 1);
        } else {
          const a = it.a, r = s.rt[a.uid], sp = FARM_BY_ID[a.sp], S = sizeOf(a, r), y = yOf(r.d);
          const hop = r.hopT > 0 ? -Math.sin(clamp(r.hopT / 0.6, 0, 1) * Math.PI) * S * 0.28 : 0;
          if (s.infoUid === a.uid) { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3.5 * k; ell(ctx, r.x, y, S * 0.62, S * 0.16); ctx.stroke(); }
          ctx.fillStyle = 'rgba(0,0,0,0.16)'; ell(ctx, r.x, y, S * 0.5, S * 0.11); ctx.fill();
          const eatDip = r.eatT > 0 ? clamp(Math.min(r.eatT, 1.3 - r.eatT) * 5, 0, 1) * (0.85 + 0.15 * Math.sin(s.t * 18)) : 0;
          ctx.save(); ctx.translate(r.x, y + hop); ctx.scale(r.face, 1);
          drawAnimal(ctx, farmLookOf(a), S, {
            phase: r.phase, moving: r.moving, growth: a.growth, sleep: r.asleep, lie: r.lie, eat: eatDip, belly: a.preg != null ? Math.pow(a.preg, 0.8) : 0,
            wag: !r.asleep && (r.hopT > 0 || r.washT > 0 || (sp.wag && a.happy > 50)), mud: a.mud, t: s.t, blink: r.blinkT < 0
          });
          ctx.restore();
          // 머리 위 상태 표시
          const top = y - S * (sp.shape === 'bird' ? 1.05 : sp.legLen + 0.62 * (sp.fat || 1) + (sp.neckLift ? sp.neckLift + 0.4 : sp.snout === 'horse' ? 0.6 : 0.3)) * (1 - r.lie * 0.4) - 14 * k;
          if (r.asleep) emoji('💤', r.x + S * 0.3, top - Math.sin(s.t * 1.5 + r.phase) * 4, 20 * k, 0.9);
          else if (a.sick) {
            // 밴드 표시는 다른 동물에 가리지 않게 맨 나중에 그린다
            const bsz = 34 * k * (modeRef.current === 'heal' ? 1 + Math.sin(s.t * 6) * 0.08 : 1);
            badges.push(() => {
              drawBandageBadge(ctx, r.x, top - 4 * k + Math.sin(s.t * 3 + r.phase) * 3, bsz);
              if (modeRef.current === 'heal') { ctx.strokeStyle = `rgba(239,68,68,${0.6 + Math.sin(s.t * 6) * 0.3})`; ctx.lineWidth = 3; ell(ctx, r.x, y - S * 0.35, S * 0.7, S * 0.55); ctx.stroke(); }
            });
          }
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

      badges.forEach(fn => fn());
      if (modeRef.current === 'wash' && s.pointer.down) drawSponge(ctx, s.pointer.x, s.pointer.y, 1.25 * k, s.t);

      // 비·눈·계절 (봄 꽃잎, 가을 낙엽, 여름밤 반딧불)
      if (s.rainAmt > 0.02) {
        ctx.strokeStyle = `rgba(191,219,254,${0.75 * s.rainAmt})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 120; i++) {
          const a = fract(i * 0.618034), b = fract(i * 0.381966 + 0.13);
          const x = fract(a + s.t * 0.04) * (W + 60) - 30, y = fract(b + s.t * (0.9 + (i % 5) * 0.08)) * H;
          ctx.moveTo(x, y); ctx.lineTo(x - 4 * k, y + 15 * k);
        }
        ctx.stroke();
      }
      if (s.snowAmt > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * s.snowAmt})`;
        for (let i = 0; i < 80; i++) {
          const a = fract(i * 0.618034), b = fract(i * 0.381966 + 0.29), r0 = (1.6 + (i % 3)) * k;
          const x = fract(a + Math.sin(s.t * 0.7 + i) * 0.012) * W, y = fract(b + s.t * (0.06 + (i % 4) * 0.015)) * H;
          ell(ctx, x, y, r0, r0); ctx.fill();
        }
      }
      if ((s.season === 'autumn' || s.season === 'spring') && s.rainAmt < 0.6) {
        const cols = s.season === 'autumn' ? ['#f59e0b', '#ea580c', '#b45309', '#facc15'] : ['#f9a8d4', '#fbcfe8', '#fda4af', '#ffffff'];
        ctx.globalAlpha = 0.9 * (1 - s.rainAmt);
        for (let i = 0; i < 14; i++) {
          const a = fract(i * 0.618034 + 0.07), b = fract(i * 0.381966 + 0.51);
          const x = fract(a + s.t * 0.018 * (1 + (i % 3) * 0.3)) * (W + 60) - 30, y = fract(b + s.t * (0.045 + (i % 4) * 0.012)) * H;
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.t * (1 + (i % 3)) + i);
          ctx.fillStyle = cols[i % cols.length]; ell(ctx, 0, 0, (s.season === 'autumn' ? 6 : 4) * k, (s.season === 'autumn' ? 3 : 2.4) * k); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      if (s.season === 'summer' && dark > 0.5) {
        for (let i = 0; i < 12; i++) {
          const a = fract(i * 0.618034), b = fract(i * 0.381966 + 0.2);
          const x = a * W + Math.sin(s.t * 0.5 + i) * 30, y = lerp(s.fieldTop - 40, H - 20, b) + Math.cos(s.t * 0.7 + i) * 15;
          ctx.globalAlpha = (0.5 + 0.5 * Math.sin(s.t * 3 + i)) * (dark - 0.5) * 2;
          ctx.fillStyle = '#fef08a'; ell(ctx, x, y, 3 * k, 3 * k); ctx.fill();
          ctx.fillStyle = 'rgba(254,240,138,0.25)'; ell(ctx, x, y, 9 * k, 9 * k); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

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
      // 프레임이 계속 늦거나 동물이 많아지면 해상도를 한 단계씩 낮춘다 (2 → 1.6 → 1.3 → 1배)
      s.slow = dt > 0.026 ? s.slow + 1 : Math.max(0, s.slow - 2);
      const crowd = farmCrowdLevel(game.animals.length);
      if ((s.slow > 90 || crowd > s.qLevel) && s.qLevel < FARM_DPR_STEPS.length - 1) { s.qLevel = Math.max(s.qLevel + (s.slow > 90 ? 1 : 0), crowd); s.slow = 0; resize(); }
      update(dt);
      draw();
      if (s.t - s.lastHud > 0.4) {
        s.lastHud = s.t;
        const avgMud = game.animals.length ? game.animals.reduce((n, a) => n + a.mud, 0) / game.animals.length : 0;
        setHud({ points: game.points, clean: Math.round(100 - Math.max(farmDirt(game), avgMud)), sick: game.animals.filter(a => a.sick).length, night: s.night, weather: s.weather.kind, season: s.season, basket: s.basket });
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
    const v = farmVariantOf(a);
    if (v) showToast(`🎲 ${attachJosa(v.name, '이/가')} 왔어요!`);
    else if (farmPenOf(id) === 'meat') showToast(`🍖 ${attachJosa(sp.babyName || sp.name, '은/는')} 육식동물 우리에서 지내요`);
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
        <div title={`${FARM_SEASONS[hud.season].name} · ${FARM_WEATHER[hud.weather].name}`} style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.15)', borderRadius: '18px', padding: '4px 10px', fontSize: '1.6rem', lineHeight: 1 }}>
          {FARM_SEASONS[hud.season].icon}{FARM_WEATHER[hud.weather].icon}
        </div>
        {hud.night && <div title="밤 (저녁 8시 ~ 아침 7시)" style={{ fontSize: '1.9rem', lineHeight: 1, filter: 'drop-shadow(0 0 6px #fde68a)' }}>🌙</div>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <FarmButton icon="🥕" label="밥" color="#f97316" onClick={() => { setMode('play'); if (simRef.current) simRef.current.feed(); }} />
          <FarmButton icon="🧺" label="채소" color="#65a30d" badge={hud.basket} onClick={() => { setMode('play'); if (simRef.current) simRef.current.feedVeg(); }} />
          <FarmButton icon={<BandageIcon />} label="치료" color="#f43f5e" badge={hud.sick} active={mode === 'heal'} onClick={() => { const m = mode === 'heal' ? 'play' : 'heal'; setMode(m); if (m === 'heal' && simRef.current) simRef.current.say('healmode', VOICE.farmHealMode(), 3); }} />
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
          cursor: mode === 'wash' ? SPONGE_CURSOR : mode === 'play' ? 'pointer' : 'crosshair'
        }}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }} />

        {mode !== 'play' && (
          <div style={{
            position: 'absolute', left: '50%', top: '12px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none',
            background: 'rgba(15,23,42,0.75)', color: '#ffffff', fontWeight: 900, padding: '8px 16px', borderRadius: '16px', fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}>
            {mode === 'wash' ? '🧼 친구를 문질러 씻기고, 똥도 문질러 치워요' : hud.sick ? '🩹 밴드 그림이 떠 있는 친구를 눌러 줘요' : '🩹 지금은 아픈 친구가 없어요'}
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
                  {farmVariantOf(infoAnimal) && <span style={{ fontSize: '0.8rem', color: '#be185d' }}> ({farmVariantOf(infoAnimal).name})</span>}
                  {infoAnimal.sex && <span style={{ marginLeft: '4px', fontSize: '0.8rem', color: '#ffffff', background: infoAnimal.sex === 'm' ? '#2563eb' : '#db2777', borderRadius: '10px', padding: '1px 7px' }}>{infoAnimal.sex === 'm' ? '♂' : '♀'} {FARM_SEX_NAMES[infoAnimal.sex]}</span>}
                  {' '}<span style={{ fontSize: '0.85rem', color: '#15803d' }}>· {FARM_STAGE_NAMES[stage]}</span>
                  {' '}<span style={{ fontSize: '0.78rem', color: farmPenOf(infoAnimal.sp) === 'meat' ? '#b45309' : '#15803d' }}>· {FARM_PENS[farmPenOf(infoAnimal.sp)].icon} {FARM_PENS[farmPenOf(infoAnimal.sp)].name} 우리</span>
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
                {infoAnimal.preg != null ? `${farmBreedOf(infoAnimal.sp).type === 'egg' ? '🥚 배 속에 알이 있어요' : '🤰 배 속에 아기가 있어요'} (${Math.round(infoAnimal.preg * 100)}%)`
                  : infoAnimal.sick ? '🩹 아파서 자라지 않아요. 치료 버튼을 누르고 이 친구를 눌러 주세요'
                  : sad ? '배고프거나 지저분해서 자라지 않아요'
                    : stage === 'adult' ? `🎉 다 컸어요! 가끔 ${vsp.gift.icon} ${attachJosa(vsp.gift.name, '을/를')} 선물해요`
                      : `자라는 속도 ${Math.round(speed * 100)}% · 컨디션 ${cond}% · 가끔 작은 ${vsp.gift.icon} 선물도 줘요`}
              </div>
              {/* 가족: 이름이 없으면 '엄마 토끼 ♀' 처럼 종류로 부르고, 누르면 그 친구 카드로 */}
              {(() => {
                const all = sim.game.animals;
                const chip = (uid, savedName, role) => {
                  const p = all.find(o => o.uid === uid);
                  const icon = role === 'mom' ? '♀' : '♂', label = role === 'mom' ? '엄마' : '아빠';
                  if (!p) return <span key={role} style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '10px', padding: '2px 8px' }}>{label} {savedName || FARM_BY_ID[infoAnimal.sp].name} {icon} · 들판으로 갔어요</span>;
                  return (
                    <button key={role} onClick={() => setInfo(p.uid)} style={{ border: 'none', cursor: 'pointer', background: role === 'mom' ? '#fce7f3' : '#dbeafe', color: role === 'mom' ? '#9d174d' : '#1e40af', borderRadius: '10px', padding: '2px 8px', fontWeight: 900, fontSize: '0.8rem' }}>
                      {label} {p.name || farmSpeciesOf(p).name} {icon}
                    </button>
                  );
                };
                const kids = all.filter(o => o.mom === infoAnimal.uid || o.dad === infoAnimal.uid);
                if (!infoAnimal.mom && !infoAnimal.dad && !kids.length) return null;
                const momP = infoAnimal.mom && all.find(o => o.uid === infoAnimal.mom);
                const momLabel = momP ? (momP.name || `엄마 ${farmSpeciesOf(momP).name}`) : infoAnimal.momName || `엄마 ${FARM_BY_ID[infoAnimal.sp].name}`;
                return (
                  <div style={{ marginTop: '8px', background: '#fff7ed', borderRadius: '14px', padding: '7px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#7c2d12', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                    {infoAnimal.mom && <span>👪 {momLabel}의 아기예요</span>}
                    {infoAnimal.mom && chip(infoAnimal.mom, infoAnimal.momName, 'mom')}
                    {infoAnimal.dad && chip(infoAnimal.dad, infoAnimal.dadName, 'dad')}
                    {kids.length > 0 && (
                      <button onClick={() => setInfo(kids[Math.floor(Math.random() * kids.length)].uid)} style={{ border: 'none', cursor: 'pointer', background: '#dcfce7', color: '#166534', borderRadius: '10px', padding: '2px 8px', fontWeight: 900, fontSize: '0.8rem' }}>
                        👶 아기 {kids.length}마리
                      </button>
                    )}
                  </div>
                );
              })()}
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
                    {FARM_VARIANTS[sp.id] && <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#be185d' }}>🎲 품종은 랜덤! ({FARM_VARIANTS[sp.id].length}가지)</div>}
                    <div style={{ fontSize: '0.72rem', fontWeight: 900, color: farmPenOf(sp.id) === 'meat' ? '#b45309' : '#15803d' }}>
                      {FARM_PENS[farmPenOf(sp.id)].icon} {FARM_PENS[farmPenOf(sp.id)].name} 우리{FAVORITE_CROP[sp.id] ? ` · 좋아하는 채소 ${CROP_BY_ID[FAVORITE_CROP[sp.id]].icon}` : ''}
                    </div>
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
