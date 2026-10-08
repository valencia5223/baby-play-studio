// ═════════════════════════════════════════════════════════════════════════════
// 🐠 내 어항 키우기 (다마고치형 어항 RPG)
//  - 치어로 시작해 밥 주기·청소·물갈이로 돌보면, 물고기마다 컨디션에 따라 자란다
//  - 돌봐서 모은 조개(포인트)로 상점에서 물고기(치어)·장식·바다 친구를 사서 꾸민다
//  - 그래픽: 캔버스(물고기·바다 친구·수초·장식·모래·거품) + WebGL 빛 레이어(물결 빛무늬·햇살)
//    + 유리 이끼/탁한 물 레이어
//  - 진행 상황은 이 기기의 localStorage 에 저장된다 (aquariumData.js)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { VOICE, attachJosa } from './voiceLines.js';
import {
  FISH_SPECIES, FISH_BY_ID, GUPPY_BY_ID, DECOR_ITEMS, DECOR_BY_ID, STARTER_FISH_PRICE, LIMITS, STAGE_NAMES,
  stageOf, sizeScale, RATES, breedOf, mateStatus, SEX_NAMES, isNightTime, SLEEP_IDLE_SEC, isSad, conditionOf, growFactor, REWARDS,
  loadGame, saveGame, catchUpOffline, newFish, newUid, todayKey
} from './aquariumData.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 장식 크기(터치·끌기 판정용, 화면 배율 k 를 곱한다)
const DECOR_BOX = {
  grass: [50, 120], sword: [90, 85], rock: [80, 50], coral: [74, 84],
  airstone: [32, 22], chest: [72, 62], castle: [112, 104], diver: [52, 92]
};
const FOOD_COLORS = ['#f97316', '#dc2626', '#84cc16', '#facc15', '#a16207'];

// ── 밝기 ── 조명을 끈 상태의 밝기는 실제 시계를 따른다:
// 낮(아침 8시 ~ 오후 5시)에는 햇빛으로 꺼도 환하고, 저녁부터 점점 어두워져 밤(저녁 7시 반 ~ 아침 6시)엔 깜깜하다.
// 조명은 그 어둠을 단계만큼 걷어낸다 → 저녁·밤에는 불을 켜야 환하다.
const MAX_DARK = 0.8;
const DAYLIGHT_KEYS = [[0, 1], [6, 1], [8, 0], [17, 0], [19.5, 1], [24, 1]];   // [시각, 어둠 비율 0~1]
function ambientDark(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  for (let i = 1; i < DAYLIGHT_KEYS.length; i++) {
    const [h0, v0] = DAYLIGHT_KEYS[i - 1], [h1, v1] = DAYLIGHT_KEYS[i];
    if (h <= h1) return MAX_DARK * (v0 + (v1 - v0) * (h - h0) / (h1 - h0));
  }
  return MAX_DARK;
}
// 조명 단계(0 꺼짐 · 1 · 2 · 3 최대)별로 어둠을 걷어내는 정도
const LAMP = [0, 0.45, 0.75, 1];
const darkFor = (ambient, light) => ambient * (1 - LAMP[light]);
// WebGL 빛무늬·햇살 세기: 낮엔 햇빛만으로 충분하고, 어두울 때는 조명이 빛을 채운다
const glFor = (ambient, light) => { const sun = 0.08 + 0.92 * (1 - ambient / MAX_DARK); return (sun + (1 - sun) * LAMP[light]) * (1 + 0.15 * LAMP[light]); };   // 조명은 햇빛보다 더 밝게 빛무늬·햇살을 키운다

// ═══════════════════════════════ 이로치 색 · 구피 디자인 ═══════════════════════════════
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, sat, l];
}
function hslToRgb(h, sat, l) {
  const k = (n) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
// 색상환을 돌리고 채도를 올려 '이로치' 색을 만든다 (#rrggbb / rgba() 모두 지원)
function shinyColor(c) {
  let r, g, b, a = null;
  if (typeof c !== 'string') return c;
  if (c[0] === '#') { r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); }
  else {
    const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c;
    [r, g, b, a] = m[1].split(',').map(Number);
  }
  const [h, sat, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb((h + 150) % 360, Math.min(1, sat * 1.25 + 0.15), Math.min(0.82, l * 1.05 + 0.04));
  return a == null || Number.isNaN(a) ? `rgb(${nr},${ng},${nb})` : `rgba(${nr},${ng},${nb},${a})`;
}
const lookCache = new Map();
// 개체 한 마리의 실제 모습: 종류 기본값 + 구피 디자인 + 이로치 색
export function lookOf(sp, f) {
  const key = `${sp.id}|${f.variant || ''}|${f.shiny ? 1 : 0}`;
  if (lookCache.has(key)) return lookCache.get(key);
  let look = sp;
  const v = sp.id === 'guppy' && f.variant ? GUPPY_BY_ID[f.variant] : null;
  if (v) {
    look = {
      ...sp, top: v.top || sp.top, belly: v.belly || sp.belly, fin: v.fin || sp.fin,
      tail: { ...sp.tail, grad: v.tail, spots: v.tailSpots, glow: !!v.glowTail },
      tuxedo: v.tuxedo, patches: v.patches, eyeColor: v.eye
    };
  }
  if (f.shiny) {
    const t = look.tail;
    look = {
      ...look, shiny: true,
      top: shinyColor(look.top), belly: shinyColor(look.belly), fin: shinyColor(look.fin),
      bars: shinyColor(look.bars), spots: shinyColor(look.spots), waves: shinyColor(look.waves), mark: shinyColor(look.mark),
      tuxedo: shinyColor(look.tuxedo), patches: shinyColor(look.patches), accent: shinyColor(look.accent),
      bands: look.bands && look.bands.map(b => ({ ...b, color: shinyColor(b.color) })),
      tail: { ...t, color: shinyColor(t.color), grad: t.grad && t.grad.map(shinyColor), spots: shinyColor(t.spots) }
    };
  }
  lookCache.set(key, look);
  return look;
}

// ═══════════════════════════════ 물고기 그리기 ═══════════════════════════════
function bodyProfile(shape, s) {
  if (shape === 'disc') return Math.sqrt(Math.max(0, 1 - Math.pow(2 * s - 1.04, 2)));
  if (shape === 'angel') return s < 0.42 ? Math.pow(s / 0.42, 0.65) : Math.pow(Math.max(0, (1 - s) / 0.58), 0.85);
  if (shape === 'ribbon') return Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + s * 0.96)), 0.25) * (1 - s * 0.88);
  if (shape === 'puffer') return Math.pow(Math.max(0, 1 - Math.pow((2 * s) / 0.92 - 1, 2)), 0.5);
  if (shape === 'flat') return Math.pow(Math.max(0, 1 - Math.pow((2 * s) / 0.94 - 1, 2)), 0.6);
  if (shape === 'pleco') return Math.pow(Math.sin(Math.PI * Math.min(1, 0.2 + s * 0.8)), 0.45) * (1 - s * 0.5);
  if (shape === 'cory') return Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + s * 0.86)), 0.55) * (s < 0.35 ? 1 : 1 - (s - 0.35) * 0.45);
  return Math.pow(Math.sin(Math.PI * (0.07 + s * 0.89)), 0.75);
}

function smoothClosed(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

// 원점(몸 가운데)에서 +x 방향을 보는 물고기를 그린다. L: 현재 몸 길이(px)
// o.glowOnly: 어두울 때 빛나는 부분(야광 줄무늬·형광 꼬리)만 덧그린다 (o.glowK: 빛 세기 0~1)
export function drawFish(ctx, sp, L, o = {}) {
  if (!(L > 0)) return;   // 크기가 0 이하(또는 계산 오류)면 그리지 않는다 — 음수 반지름으로 캔버스 오류가 나지 않게
  if (CREATURE_SHAPES.has(sp.shape)) { drawCreature(ctx, sp, L, o); return; }
  const glowOnly = !!o.glowOnly;
  const growth = o.growth ?? 1;
  const fry = 1 - Math.min(1, growth / 0.6);           // 1 이면 갓 태어난 치어
  const puff = o.puff || 0;                            // 복어가 부풀어 오른 정도 0~1
  const belly = o.belly || 0;                          // 아기·알을 가진 정도 0~1 (배 아래쪽이 불룩)
  const bulge = (s) => H * 0.62 * belly * Math.exp(-Math.pow((s - 0.42) / 0.2, 2));
  const H = L * sp.hRatio * (1 + fry * 0.12) * (1 + puff * 0.6);
  const ribbon = sp.shape === 'ribbon';
  const amp = L * (sp.shape === 'disc' || sp.shape === 'angel' || sp.shape === 'flat' ? 0.03 : sp.shape === 'betta' ? 0.09 : ribbon ? 0.05 : 0.07);
  const ph = o.phase || 0;
  // 갈치는 몸 전체가 뱀장어처럼 여러 번 굽이친다
  const wave = (s) => Math.sin(ph - s * (ribbon ? 7 : 3.2)) * amp * (ribbon ? s : s * s);
  const half = (s) => H * 0.5 * Math.max(0.07, bodyProfile(sp.shape, s));
  const xs = (s) => L * (0.5 - s);
  const finK = 0.4 + 0.6 * (1 - fry);
  const tailX = xs(1), tailY = wave(1);
  const swing = Math.sin(ph - 3.6) * amp * 1.9;
  const t = sp.tail;

  ctx.save();
  ctx.globalAlpha *= 1 - fry * 0.28;

  // ── 지느러미 (몸 뒤) ──
  const finFill = sp.fin;
  ctx.fillStyle = finFill;
  if (glowOnly) {
    // 야광 모드에서는 지느러미를 그리지 않는다
  } else if (sp.shape === 'angel') {
    // 길게 뒤로 뻗은 등·뒷지느러미
    ctx.beginPath();
    ctx.moveTo(xs(0.3), wave(0.3) - half(0.3) * 0.9);
    ctx.quadraticCurveTo(xs(0.55), wave(0.5) - H * 0.95 * finK, xs(1.15), wave(1) - H * 0.85 * finK + swing);
    ctx.lineTo(xs(0.85), wave(0.85) - half(0.85));
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xs(0.3), wave(0.3) + half(0.3) * 0.9);
    ctx.quadraticCurveTo(xs(0.55), wave(0.5) + H * 0.95 * finK, xs(1.15), wave(1) + H * 0.85 * finK + swing);
    ctx.lineTo(xs(0.85), wave(0.85) + half(0.85));
    ctx.closePath(); ctx.fill();
  } else if (sp.shape === 'betta') {
    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0, 'rgba(37,99,235,0.75)'); g.addColorStop(1, 'rgba(220,38,38,0.7)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(xs(0.25), wave(0.25) - half(0.25));
    ctx.quadraticCurveTo(xs(0.6), wave(0.6) - H * 1.3 * finK + swing * 0.5, xs(1.05), wave(1) - H * 0.4 + swing);
    ctx.lineTo(xs(0.9), wave(0.9));
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xs(0.3), wave(0.3) + half(0.3));
    ctx.quadraticCurveTo(xs(0.6), wave(0.6) + H * 1.5 * finK + swing * 0.5, xs(1.05), wave(1) + H * 0.5 + swing);
    ctx.lineTo(xs(0.9), wave(0.9));
    ctx.closePath(); ctx.fill();
  } else if (sp.shape === 'flat') {
    // 광어: 몸 둘레를 따라 이어진 지느러미 테두리
    const rim = [];
    for (let i = 1; i <= 10; i++) { const q = 0.06 + i * 0.088; rim.push([xs(q), wave(q) - half(q) * 1.3 - H * 0.04]); }
    for (let i = 10; i >= 1; i--) { const q = 0.06 + i * 0.088; rim.push([xs(q), wave(q) + half(q) * 1.3 + H * 0.04]); }
    smoothClosed(ctx, rim); ctx.fill();
  } else if (ribbon) {
    // 갈치: 등을 따라 길게 이어진 투명한 지느러미
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const q = 0.08 + i * 0.062; const y = wave(q) - half(q) - H * 0.9 * (1 - q * 0.6); if (i === 0) ctx.moveTo(xs(q), y); else ctx.lineTo(xs(q), y); }
    for (let i = 14; i >= 0; i--) { const q = 0.08 + i * 0.062; ctx.lineTo(xs(q), wave(q) - half(q) * 0.8); }
    ctx.closePath(); ctx.fill();
  } else if (sp.shape === 'pleco') {
    // 커다란 돛 모양 등지느러미 (점무늬)
    ctx.beginPath();
    ctx.moveTo(xs(0.22), wave(0.22) - half(0.22) * 0.95);
    ctx.quadraticCurveTo(xs(0.3), wave(0.3) - half(0.3) - H * 0.95 * finK, xs(0.58), wave(0.58) - half(0.58) - H * 0.25 * finK);
    ctx.lineTo(xs(0.62), wave(0.62) - half(0.62) * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(231,229,228,0.55)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(xs(0.28 + i * 0.06), wave(0.3) - half(0.3) - H * (0.15 + (i % 2) * 0.2) * finK, Math.max(0.7, L * 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = finFill;
    // 배 아래로 넓게 펼친 배지느러미
    ctx.beginPath(); ctx.ellipse(xs(0.32), wave(0.32) + half(0.32) * 0.8, L * 0.12 * finK, H * 0.22 * finK, -0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // 등지느러미 (우럭·참돔은 뾰족한 가시)
    ctx.beginPath();
    ctx.moveTo(xs(0.32), wave(0.32) - half(0.32) * 0.92);
    if (sp.spiny) {
      for (let i = 0; i <= 8; i++) {
        const q = 0.24 + i * 0.05, up = i % 2 === 0 ? 0.5 : 0.28;
        ctx.lineTo(xs(q), wave(q) - half(q) - H * up * finK);
      }
      ctx.lineTo(xs(0.68), wave(0.68) - half(0.68) * 0.9);
    } else {
      ctx.quadraticCurveTo(xs(0.45), wave(0.45) - half(0.45) - H * 0.42 * finK, xs(0.66), wave(0.66) - half(0.66) * 0.9);
    }
    ctx.closePath(); ctx.fill();
    // 뒷지느러미
    ctx.beginPath();
    ctx.moveTo(xs(0.55), wave(0.55) + half(0.55) * 0.9);
    ctx.quadraticCurveTo(xs(0.68), wave(0.68) + half(0.68) + H * 0.26 * finK, xs(0.82), wave(0.82) + half(0.82) * 0.85);
    ctx.closePath(); ctx.fill();
  }

  // ── 꼬리 ──
  const tl = L * t.len * finK, tsp = L * t.spread * finK;
  let tailFill = t.color;
  if (t.grad) {
    const g = ctx.createLinearGradient(tailX, 0, tailX - tl, 0);
    t.grad.forEach((c, i) => g.addColorStop(i / (t.grad.length - 1), c));
    tailFill = g;
  }
  const tailLobe = (yOff, k) => {
    ctx.beginPath();
    ctx.moveTo(tailX + L * 0.05, tailY - H * 0.13 * k + yOff);
    ctx.quadraticCurveTo(tailX - tl * 0.45, tailY + swing * 0.5 - tsp * 0.62 * k + yOff, tailX - tl, tailY + swing - tsp * 0.5 * k + yOff);
    ctx.quadraticCurveTo(tailX - tl * (t.fork ? 0.42 : t.solid ? 0.72 : sp.shape === 'betta' ? 1.08 : 0.84), tailY + swing + yOff, tailX - tl, tailY + swing + tsp * 0.5 * k + yOff);
    ctx.quadraticCurveTo(tailX - tl * 0.45, tailY + swing * 0.5 + tsp * 0.62 * k + yOff, tailX + L * 0.05, tailY + H * 0.13 * k + yOff);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = tailFill;
  if (glowOnly) {
    if (t.glow) {
      ctx.save();
      ctx.globalAlpha *= o.glowK ?? 1;
      ctx.shadowColor = t.grad ? t.grad[t.grad.length - 1] : t.color;
      ctx.shadowBlur = L * 0.4;
      tailLobe(0, 1);
      ctx.restore();
    }
  } else if (t.double) {
    ctx.save(); ctx.globalAlpha *= 0.7; tailLobe(-tsp * 0.12, 0.8); ctx.restore();
    tailLobe(tsp * 0.1, 0.85);
  } else {
    tailLobe(0, 1);
  }
  if (!glowOnly && t.spots && fry < 0.7) {
    // 구피 꼬리 점무늬
    ctx.fillStyle = t.spots;
    for (let i = 0; i < 12; i++) {
      const q = 0.25 + ((i * 0.37) % 1) * 0.68;
      ctx.beginPath();
      ctx.arc(tailX - tl * q, tailY + swing * q + (((i * 0.61) % 1) - 0.5) * tsp * 0.85 * q, Math.max(0.7, L * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!glowOnly && o.detail && fry < 0.6) {
    // 꼬리 지느러미 줄무늬
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(0.6, L * 0.012);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(tailX + L * 0.02, tailY);
      ctx.lineTo(tailX - tl * 0.92, tailY + swing + i * tsp * 0.2);
      ctx.stroke();
    }
  }

  // ── 몸통 ──
  const N = 9;
  const pts = [[xs(0) + L * 0.015, wave(0)]];
  for (let i = 1; i <= N; i++) { const s = i / N; pts.push([xs(s), wave(s) - half(s)]); }
  for (let i = N; i >= 1; i--) { const s = i / N; pts.push([xs(s), wave(s) + half(s) + bulge(s)]); }
  smoothClosed(ctx, pts);
  const bg = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  bg.addColorStop(0, sp.top);
  bg.addColorStop(0.62, sp.belly);
  bg.addColorStop(1, sp.belly);
  ctx.fillStyle = bg;
  if (!glowOnly) ctx.fill();
  if (!glowOnly && puff > 0.05) {
    ctx.strokeStyle = sp.top; ctx.lineWidth = Math.max(0.8, L * 0.02); ctx.lineCap = 'round';
    pts.forEach(([px, py], i) => {
      if (i === 0 || i % 2) return;
      const cx0 = xs(0.45), dx = px - cx0, dy = py, d = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx / d * L * 0.09 * puff, py + dy / d * L * 0.09 * puff); ctx.stroke();
    });
    smoothClosed(ctx, pts);
  }

  // ── 무늬 (몸 모양으로 잘라 그리기) ──
  ctx.save();
  ctx.clip();
  if (glowOnly) ctx.globalAlpha *= o.glowK ?? 1;
  if (sp.bands) {
    sp.bands.forEach(b => {
      if (glowOnly && !b.glow) return;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = H * b.w;
      ctx.lineCap = 'round';
      if (b.glow) { ctx.shadowColor = b.color; ctx.shadowBlur = L * (glowOnly ? 0.45 : 0.15); }
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const s = b.from + (b.to - b.from) * i / 8;
        const y = wave(s) + b.y * H * 2 * Math.max(0.5, bodyProfile(sp.shape, s));
        if (i === 0) ctx.moveTo(xs(s), y); else ctx.lineTo(xs(s), y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }
  if (glowOnly) { ctx.restore(); ctx.restore(); return; }
  if (belly > 0.05) {
    // 불룩한 배: 밝은 배 + 난태생은 배 속 아기 눈이 비치는 까만 임신 반점
    ctx.fillStyle = `rgba(255,255,255,${0.25 * belly})`;
    ctx.beginPath(); ctx.ellipse(xs(0.42), wave(0.42) + half(0.42) * 0.55 + bulge(0.42) * 0.45, L * 0.16, H * 0.2 + bulge(0.42) * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    if (o.gravidSpot && belly > 0.35) {
      ctx.fillStyle = `rgba(15,23,42,${Math.min(0.75, (belly - 0.35) * 1.4)})`;
      ctx.beginPath(); ctx.ellipse(xs(0.55), wave(0.55) + half(0.55) * 0.45 + bulge(0.55) * 0.5, L * 0.05, H * 0.1 + bulge(0.55) * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (sp.tuxedo) {
    // 턱시도 구피: 몸 뒤쪽 절반이 검다
    ctx.save(); ctx.globalAlpha *= 0.88; ctx.fillStyle = sp.tuxedo;
    ctx.fillRect(xs(1) - L * 0.1, -H, xs(0.48) - xs(1) + L * 0.1, H * 2);
    ctx.restore();
  }
  if (sp.patches) {
    // 코이 구피: 붉은 얼룩
    ctx.fillStyle = sp.patches;
    [[0.22, -0.15, 0.3], [0.55, 0.05, 0.34], [0.82, -0.1, 0.24]].forEach(([q, yy, rr]) => {
      ctx.beginPath(); ctx.ellipse(xs(q), wave(q) + yy * H, L * rr * 0.32, H * rr, 0.3, 0, Math.PI * 2); ctx.fill();
    });
  }
  if (sp.mottle) {
    // 우럭·광어의 얼룩무늬
    ctx.save(); ctx.globalAlpha *= 0.45; ctx.fillStyle = sp.mottle;
    for (let i = 0; i < 10; i++) {
      const q = 0.1 + ((i * 0.618) % 1) * 0.82, yy = (((i * 0.43) % 1) - 0.5) * H * 0.75;
      ctx.beginPath(); ctx.ellipse(xs(q), wave(q) + yy, L * 0.07, H * 0.13, i, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (sp.backStripes) {
    // 고등어 등의 물결 줄무늬
    ctx.strokeStyle = sp.backStripes; ctx.lineWidth = Math.max(0.7, L * 0.016);
    for (let i = 0; i < 10; i++) {
      const q = 0.14 + i * 0.075;
      ctx.beginPath();
      ctx.moveTo(xs(q), wave(q) - H * 0.55);
      ctx.quadraticCurveTo(xs(q) + L * 0.03, wave(q) - H * 0.3, xs(q) - L * 0.005, wave(q) - H * 0.05);
      ctx.stroke();
    }
  }
  if (sp.bars) {
    ctx.fillStyle = sp.bars;
    [0.18, 0.46, 0.74].forEach((s, i) => {
      ctx.globalAlpha *= i === 1 ? 0.9 : 0.75;
      ctx.fillRect(xs(s) - L * 0.035, -H, L * (i === 1 ? 0.09 : 0.06), H * 2);
      ctx.globalAlpha /= i === 1 ? 0.9 : 0.75;
    });
  }
  if (sp.spots) {
    ctx.fillStyle = sp.spots;
    for (let i = 0; i < 14; i++) {
      // 2차원으로 고르게 흩어지는 점 배치 (일렬로 늘어서지 않게)
      const s = 0.15 + ((i * 0.5698403) % 1) * 0.75, yy = (((i * 0.7548777) % 1) - 0.5) * H * 0.75;
      ctx.beginPath(); ctx.arc(xs(s), wave(s) + yy, Math.max(0.8, L * 0.022), 0, Math.PI * 2); ctx.fill();
    }
  }
  if (sp.waves) {
    ctx.strokeStyle = sp.waves; ctx.lineWidth = Math.max(0.8, L * 0.022); ctx.globalAlpha *= 0.8;
    for (let r = -3; r <= 3; r++) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const s = i / 12, x = xs(s);
        const y = wave(s) + r * H * 0.12 + Math.sin(s * 14 + r) * H * 0.03;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha /= 0.8;
  }
  if (sp.mark) {
    // 블루탱의 검은 팔레트 무늬
    ctx.fillStyle = sp.mark;
    ctx.beginPath();
    ctx.moveTo(xs(0.2), wave(0.2) - H * 0.18);
    ctx.quadraticCurveTo(xs(0.55), wave(0.55) - H * 0.42, xs(0.98), wave(0.98) - H * 0.05);
    ctx.quadraticCurveTo(xs(0.6), wave(0.6) - H * 0.02, xs(0.45), wave(0.45) + H * 0.12);
    ctx.quadraticCurveTo(xs(0.35), wave(0.35) - H * 0.08, xs(0.2), wave(0.2) - H * 0.18);
    ctx.fill();
  }
  // 입체감: 위쪽 반사광 + 아래쪽 그늘
  const shine = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
  shine.addColorStop(0, `rgba(255,255,255,${0.32 + 0.2 * (o.lit || 0)})`);
  shine.addColorStop(0.35, 'rgba(255,255,255,0)');
  shine.addColorStop(0.8, 'rgba(15,23,42,0)');
  shine.addColorStop(1, 'rgba(15,23,42,0.28)');
  ctx.fillStyle = shine;
  ctx.fillRect(-L, -H, L * 2, H * 2);
  // 비늘 광택: 헤엄칠 때 몸을 따라 천천히 지나가는 반짝임
  if (o.gloss && L > 18 && !o.sad) {
    const u = ((ph * 0.035) % 2.2) - 0.6;
    if (u > -0.2 && u < 1.2) {
      const sg = ctx.createLinearGradient(xs(u - 0.16), -H * 0.4, xs(u + 0.16), H * 0.2);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${0.24 + 0.22 * (o.lit || 0)})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-L, -H, L * 2, H * 2);
    }
  }
  if (o.sad) { ctx.fillStyle = 'rgba(100,116,139,0.4)'; ctx.fillRect(-L, -H, L * 2, H * 2); }
  ctx.restore();

  // 외곽선(그늘)과 등 쪽 빛 테두리로 몸의 윤곽을 또렷하게
  if (o.gloss && L > 24) {
    smoothClosed(ctx, pts);
    ctx.strokeStyle = 'rgba(8,24,40,0.22)'; ctx.lineWidth = Math.max(0.6, L * 0.011);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = Math.max(0.5, L * 0.009); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 1; i <= 6; i++) { const q = 0.08 + i * 0.09; const px = xs(q), py = wave(q) - half(q) * 0.9; if (i === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
  }

  // 아가미 선
  if (fry < 0.7) {
    ctx.strokeStyle = 'rgba(15,23,42,0.18)'; ctx.lineWidth = Math.max(0.6, L * 0.015);
    ctx.beginPath(); ctx.arc(xs(0.24) + L * 0.06, wave(0.24), half(0.24) * 0.75, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
  }
  // 가슴지느러미 (파닥파닥)
  ctx.fillStyle = finFill;
  ctx.save();
  ctx.translate(xs(0.3), wave(0.3) + half(0.3) * 0.35);
  ctx.rotate(0.5 + Math.sin(ph * 1.4) * 0.35);
  ctx.beginPath(); ctx.ellipse(-L * 0.06, 0, L * 0.09 * finK, H * 0.13 * finK, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 비파 빨판 입
  if (sp.shape === 'pleco') {
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath(); ctx.ellipse(xs(0.02), wave(0) + H * 0.22, L * 0.05, H * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 코리도라스 수염
  if (sp.shape === 'cory') {
    ctx.strokeStyle = 'rgba(68,64,60,0.7)'; ctx.lineWidth = Math.max(0.6, L * 0.012);
    ctx.beginPath(); ctx.moveTo(xs(0.02), wave(0) + H * 0.12); ctx.lineTo(xs(-0.05), wave(0) + H * 0.32); ctx.stroke();
  }

  if (sp.bigMouth) {
    ctx.strokeStyle = 'rgba(12,10,9,0.55)'; ctx.lineWidth = Math.max(0.8, L * 0.016);
    ctx.beginPath(); ctx.moveTo(xs(0.0), wave(0) + H * 0.04); ctx.lineTo(xs(0.1), wave(0.1) + H * 0.12); ctx.stroke();
  }
  if (sp.shape === 'flat') {
    // 광어는 두 눈이 한쪽에 몰려 있다
    const e2x = xs(0.24), e2y = wave(0.24) - H * 0.22, e2r = Math.max(1.3, L * 0.045);
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(e2x, e2y, e2r * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(e2x + e2r * 0.15, e2y, e2r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(e2x + e2r * 0.45, e2y - e2r * 0.4, e2r * 0.36, 0, Math.PI * 2); ctx.fill();
  }
  // ── 눈 ──
  const ex = xs(0.15), ey = wave(0.15) - H * (sp.shape === 'disc' || sp.shape === 'angel' ? 0.12 : 0.07);
  const er = Math.max(1.3, L * 0.052 * (1 + fry * 0.75));
  if (o.sleep) {
    // 자는 물고기: 감은 눈 (◡)
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = Math.max(0.8, er * 0.45); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ex, ey - er * 0.35, er * 1.05, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath(); ctx.arc(ex, ey, er * 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = sp.eyeColor || '#0f172a';
  ctx.beginPath(); ctx.arc(ex + er * 0.15, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ex + er * 0.45, ey - er * 0.4, er * 0.36, 0, Math.PI * 2); ctx.fill();
  if (o.sad) {
    // 눈물 한 방울
    ctx.fillStyle = 'rgba(125,211,252,0.9)';
    ctx.beginPath(); ctx.ellipse(ex - er * 0.2, ey + er * 2.2, er * 0.45, er * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  } else if (o.happy) {
    ctx.fillStyle = 'rgba(244,63,94,0.45)';
    ctx.beginPath(); ctx.arc(ex - er * 1.2, ey + er * 1.8, er * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════ 바다 친구 그리기 ═══════════════════════════════
// 물고기와 같은 규칙으로 그린다: 원점이 몸 가운데, +x 방향을 본다. L: 현재 몸 길이(px)
// 자면 눈을 감고, 슬프면 색이 바래고 눈물, 기쁘면 볼이 발그레, 아기일 때는 눈이 크고 조금 투명하다.
const CREATURE_SHAPES = new Set(['crab', 'starfish', 'shrimp', 'seahorse', 'jellyfish', 'octopus', 'squid', 'turtle', 'penguin', 'seal', 'shark', 'whale']);
const TAU = Math.PI * 2;

// 슬플 때 색을 회색 쪽으로 바랜다
function dullColor(c) {
  if (typeof c !== 'string') return c;
  let r, g, b, a = null;
  if (c[0] === '#') { r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); }
  else {
    const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c;
    [r, g, b, a] = m[1].split(',').map(Number);
  }
  const mix = (v, to) => Math.round(v + (to - v) * 0.45);
  const [nr, ng, nb] = [mix(r, 100), mix(g, 116), mix(b, 139)];
  return a == null || Number.isNaN(a) ? `rgb(${nr},${ng},${nb})` : `rgba(${nr},${ng},${nb},${a})`;
}

// 끝으로 갈수록 가늘어지는 선 (다리·촉수·꼬리)
function taperStroke(ctx, pts, w0, w1, color) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = Math.max(0.6, w0 + (w1 - w0) * (i / (pts.length - 1)));
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
}

function creatureEye(ctx, x, y, r, o) {
  if (o.sleep) {
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = Math.max(0.8, r * 0.45); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 1.05, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    return;
  }
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(x + r * 0.15, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.4, r * 0.36, 0, TAU); ctx.fill();
  if (o.sad) {
    ctx.fillStyle = 'rgba(125,211,252,0.9)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.2, y + r * 2.2, r * 0.45, r * 0.7, 0, 0, TAU); ctx.fill();
  } else if (o.happy) {
    ctx.fillStyle = 'rgba(244,63,94,0.45)';
    ctx.beginPath(); ctx.arc(x - r * 1.2, y + r * 1.8, r * 0.8, 0, TAU); ctx.fill();
  }
}

function smile(ctx, x, y, r, color = 'rgba(15,23,42,0.6)') {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.8, r * 0.35); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y - r * 0.6, r, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
}

function drawCreature(ctx, sp, L, o = {}) {
  const growth = o.growth ?? 1;
  const fry = 1 - Math.min(1, growth / 0.6);
  const ph = o.phase || 0;
  const H = L * sp.hRatio;
  const col = (c) => (o.sad ? dullColor(c) : c);
  const top = col(sp.top), belly = col(sp.belly), fin = col(sp.fin || sp.top), spots = col(sp.spots), accent = col(sp.accent || sp.belly);
  const er = Math.max(1.4, L * 0.045 * (1 + fry * 0.6));
  const grad = (y0, y1, stop = 0.62) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top); g.addColorStop(stop, belly); g.addColorStop(1, belly);
    return g;
  };
  // 지금 경로를 칠하고, 그 안에 무늬(inner) + 위쪽 반사광·아래쪽 그늘을 덧그린다
  const finish = (inner) => {
    ctx.fill();
    ctx.save(); ctx.clip();
    if (inner) inner();
    const sh = ctx.createLinearGradient(0, -H * 0.55, 0, H * 0.55);
    sh.addColorStop(0, 'rgba(255,255,255,0.3)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)');
    sh.addColorStop(0.8, 'rgba(15,23,42,0)'); sh.addColorStop(1, 'rgba(15,23,42,0.25)');
    ctx.fillStyle = sh; ctx.fillRect(-L, -H * 1.2, L * 2, H * 2.4);
    ctx.restore();
  };
  const dots = (pts, r) => { ctx.fillStyle = spots; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, r), 0, TAU); ctx.fill(); }); };

  // 해파리 갓 (야광에서도 같은 모양)
  const pulse = Math.sin(ph * 0.5);
  const bw = L * 0.46 * (1 + pulse * 0.08), bh = H * 0.3 * (1 - pulse * 0.08), by = -H * 0.12;
  const bellPath = () => {
    ctx.beginPath();
    ctx.moveTo(-bw, by);
    ctx.bezierCurveTo(-bw, by - bh * 1.6, bw, by - bh * 1.6, bw, by);
    for (let i = 0; i < 6; i++) {
      const x1 = bw - (i + 0.5) * 2 * bw / 6, x2 = bw - (i + 1) * 2 * bw / 6;
      ctx.quadraticCurveTo(x1, by + bh * 0.28, x2, by);
    }
    ctx.closePath();
  };

  if (o.glowOnly) {
    if (sp.glow) {
      ctx.save();
      ctx.globalAlpha *= (o.glowK ?? 1) * 0.8;
      ctx.shadowColor = fin; ctx.shadowBlur = L * 0.5;
      ctx.fillStyle = fin; bellPath(); ctx.fill();
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.globalAlpha *= 1 - fry * 0.25;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  switch (sp.shape) {
    case 'shark': {
      const w = Math.sin(ph) * H * 0.18;
      ctx.fillStyle = fin;
      // 초승달 꼬리
      ctx.beginPath();
      ctx.moveTo(-L * 0.36, -H * 0.1 + w * 0.5);
      ctx.quadraticCurveTo(-L * 0.46, -H * 0.4 + w, -L * 0.58, -H * 0.85 + w * 1.4);
      ctx.quadraticCurveTo(-L * 0.5, -H * 0.1 + w, -L * 0.47, w);
      ctx.quadraticCurveTo(-L * 0.5, H * 0.15 + w, -L * 0.55, H * 0.6 + w * 1.4);
      ctx.quadraticCurveTo(-L * 0.44, H * 0.3 + w, -L * 0.36, H * 0.1 + w * 0.5);
      ctx.closePath(); ctx.fill();
      // 세모 등지느러미
      ctx.beginPath();
      ctx.moveTo(L * 0.06, -H * 0.44);
      ctx.quadraticCurveTo(-L * 0.02, -H * 0.8, -L * 0.1, -H * 1.08);
      ctx.quadraticCurveTo(-L * 0.12, -H * 0.6, -L * 0.2, -H * 0.38);
      ctx.closePath(); ctx.fill();
      // 몸
      ctx.beginPath();
      ctx.moveTo(L * 0.5, H * 0.04);
      ctx.quadraticCurveTo(L * 0.44, -H * 0.5, L * 0.08, -H * 0.5);
      ctx.quadraticCurveTo(-L * 0.22, -H * 0.46, -L * 0.38, -H * 0.1 + w * 0.5);
      ctx.lineTo(-L * 0.38, H * 0.1 + w * 0.5);
      ctx.quadraticCurveTo(-L * 0.2, H * 0.44, L * 0.1, H * 0.46);
      ctx.quadraticCurveTo(L * 0.44, H * 0.44, L * 0.5, H * 0.04);
      ctx.closePath();
      ctx.fillStyle = grad(-H * 0.5, H * 0.5, 0.56); finish();
      // 가슴지느러미
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(L * 0.12, H * 0.3); ctx.rotate(Math.sin(ph * 1.2) * 0.15);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-L * 0.06, H * 0.5, -L * 0.16, H * 0.62); ctx.quadraticCurveTo(-L * 0.1, H * 0.2, -L * 0.1, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      // 아가미 세 줄
      ctx.strokeStyle = 'rgba(15,23,42,0.3)'; ctx.lineWidth = Math.max(0.7, L * 0.012);
      for (let i = 0; i < 3; i++) {
        const gx = L * (0.24 - i * 0.04);
        ctx.beginPath(); ctx.moveTo(gx, -H * 0.18); ctx.quadraticCurveTo(gx - L * 0.02, 0, gx, H * 0.18); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(15,23,42,0.55)'; ctx.lineWidth = Math.max(0.8, L * 0.014);
      ctx.beginPath(); ctx.moveTo(L * 0.44, H * 0.2); ctx.quadraticCurveTo(L * 0.38, H * 0.3, L * 0.31, H * 0.22); ctx.stroke();
      creatureEye(ctx, L * 0.33, -H * 0.12, er * 0.9, o);
      break;
    }
    case 'whale': {
      const w = Math.sin(ph) * H * 0.12;
      // 꼬리지느러미
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(-L * 0.43, w); ctx.rotate(Math.sin(ph) * 0.25);
      ctx.beginPath();
      ctx.moveTo(L * 0.04, 0);
      ctx.quadraticCurveTo(-L * 0.04, -H * 0.1, -L * 0.12, -H * 0.42);
      ctx.quadraticCurveTo(-L * 0.06, -H * 0.08, -L * 0.03, 0);
      ctx.quadraticCurveTo(-L * 0.06, H * 0.08, -L * 0.12, H * 0.42);
      ctx.quadraticCurveTo(-L * 0.04, H * 0.1, L * 0.04, 0);
      ctx.fill();
      ctx.restore();
      // 몸
      ctx.beginPath();
      ctx.moveTo(L * 0.5, H * 0.05);
      ctx.bezierCurveTo(L * 0.5, -H * 0.62, L * 0.0, -H * 0.6, -L * 0.26, -H * 0.22);
      ctx.quadraticCurveTo(-L * 0.38, -H * 0.06 + w * 0.6, -L * 0.45, w);
      ctx.quadraticCurveTo(-L * 0.38, H * 0.12 + w * 0.6, -L * 0.2, H * 0.32);
      ctx.bezierCurveTo(L * 0.05, H * 0.56, L * 0.5, H * 0.55, L * 0.5, H * 0.05);
      ctx.closePath();
      ctx.fillStyle = top;
      finish(() => {
        // 밝은 배와 주름
        ctx.fillStyle = belly;
        ctx.beginPath(); ctx.ellipse(L * 0.15, H * 0.44, L * 0.38, H * 0.24, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(30,64,175,0.22)'; ctx.lineWidth = Math.max(0.7, L * 0.01);
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(L * 0.42, H * (0.28 + i * 0.06)); ctx.lineTo(-L * 0.08, H * (0.3 + i * 0.06)); ctx.stroke(); }
      });
      // 가슴지느러미
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(L * 0.1, H * 0.28); ctx.rotate(0.6 + Math.sin(ph * 1.1) * 0.3);
      ctx.beginPath(); ctx.ellipse(-L * 0.06, 0, L * 0.11, H * 0.09, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(15,23,42,0.45)'; ctx.lineWidth = Math.max(0.8, L * 0.012);
      ctx.beginPath(); ctx.moveTo(L * 0.49, H * 0.14); ctx.quadraticCurveTo(L * 0.34, H * 0.26, L * 0.2, H * 0.16); ctx.stroke();
      creatureEye(ctx, L * 0.27, H * 0.02, er * 0.85, o);
      // 기분 좋으면 머리 위로 물을 뿜는다
      if (o.happy) {
        ctx.fillStyle = 'rgba(186,230,253,0.85)';
        [[0.16, -0.75, 0.04], [0.11, -0.95, 0.03], [0.21, -0.95, 0.03], [0.16, -1.1, 0.025]].forEach(([x, y, r]) => {
          ctx.beginPath(); ctx.arc(L * x, H * y, L * r, 0, TAU); ctx.fill();
        });
      }
      break;
    }
    case 'turtle': {
      const fl = Math.sin(ph * 0.8);
      const flipper = (x, y, rot, rx, ry) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(rx * 0.7, 0, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.restore();
      };
      // 먼 쪽 지느러미 (어둡게)
      ctx.fillStyle = fin;
      flipper(L * 0.14, -H * 0.12, -0.9 + fl * 0.4, L * 0.18, H * 0.12);
      flipper(-L * 0.26, -H * 0.05, -2.5 - fl * 0.3, L * 0.09, H * 0.08);
      // 머리
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.ellipse(L * 0.37, -H * 0.02, L * 0.13, H * 0.2, 0, 0, TAU); ctx.fill();
      // 등껍질
      ctx.beginPath();
      ctx.moveTo(-L * 0.37, H * 0.14);
      ctx.bezierCurveTo(-L * 0.36, -H * 0.62, L * 0.3, -H * 0.62, L * 0.3, H * 0.12);
      ctx.quadraticCurveTo(-L * 0.04, H * 0.32, -L * 0.37, H * 0.14);
      ctx.closePath();
      ctx.fillStyle = grad(-H * 0.5, H * 0.3, 0.95);
      finish(() => {
        // 육각형 무늬
        ctx.strokeStyle = 'rgba(217,249,157,0.55)'; ctx.lineWidth = Math.max(0.8, L * 0.014);
        ctx.beginPath(); ctx.ellipse(-L * 0.03, -H * 0.12, L * 0.14, H * 0.16, 0, 0, TAU); ctx.stroke();
        [[-0.17, -0.18, -0.3, 0.02], [0.11, -0.18, 0.22, 0.02], [-0.03, -0.28, -0.03, -0.42], [-0.15, -0.05, -0.27, -0.28], [0.09, -0.05, 0.2, -0.28]].forEach(([x1, y1, x2, y2]) => {
          ctx.beginPath(); ctx.moveTo(L * x1, H * y1); ctx.lineTo(L * x2, H * y2); ctx.stroke();
        });
      });
      // 배딱지 테두리
      ctx.strokeStyle = belly; ctx.lineWidth = Math.max(1, H * 0.08);
      ctx.beginPath(); ctx.moveTo(-L * 0.36, H * 0.14); ctx.quadraticCurveTo(-L * 0.04, H * 0.32, L * 0.3, H * 0.12); ctx.stroke();
      // 가까운 쪽 지느러미
      ctx.fillStyle = accent;
      flipper(L * 0.12, H * 0.2, 0.9 - fl * 0.45, L * 0.2, H * 0.14);
      flipper(-L * 0.27, H * 0.18, 2.4 + fl * 0.3, L * 0.1, H * 0.09);
      creatureEye(ctx, L * 0.41, -H * 0.08, er * 0.85, o);
      smile(ctx, L * 0.44, H * 0.08, er * 0.7);
      break;
    }
    case 'seal': {
      const w = Math.sin(ph) * H * 0.15;
      // 뒷지느러미
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(-L * 0.4, w * 0.6); ctx.rotate(Math.sin(ph) * 0.3);
      ctx.beginPath(); ctx.ellipse(-L * 0.07, -H * 0.13, L * 0.1, H * 0.12, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-L * 0.07, H * 0.13, L * 0.1, H * 0.12, 0.5, 0, TAU); ctx.fill();
      ctx.restore();
      // 몸
      ctx.beginPath();
      ctx.moveTo(L * 0.36, -H * 0.46);
      ctx.bezierCurveTo(L * 0.1, -H * 0.56, -L * 0.25, -H * 0.4, -L * 0.42, w * 0.6);
      ctx.bezierCurveTo(-L * 0.25, H * 0.45, L * 0.1, H * 0.56, L * 0.36, H * 0.44);
      ctx.closePath();
      ctx.fillStyle = grad(-H * 0.5, H * 0.5, 0.7);
      finish(() => dots([[-0.1, -0.2], [0.05, -0.28], [-0.22, -0.05], [0.12, -0.1], [-0.02, 0.0]].map(([x, y]) => [L * x, H * y]), L * 0.012));
      // 머리
      ctx.beginPath(); ctx.ellipse(L * 0.34, -H * 0.04, L * 0.17, H * 0.47, 0, 0, TAU);
      ctx.fillStyle = grad(-H * 0.5, H * 0.45, 0.72); finish();
      // 주둥이 · 코 · 수염
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(L * 0.46, H * 0.1, L * 0.065, H * 0.17, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1c1917';
      ctx.beginPath(); ctx.ellipse(L * 0.51, H * 0.0, L * 0.024, H * 0.07, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(28,25,23,0.55)'; ctx.lineWidth = Math.max(0.6, L * 0.007);
      [[0.04], [0.14], [0.22]].forEach(([yy]) => { ctx.beginPath(); ctx.moveTo(L * 0.48, H * 0.12); ctx.lineTo(L * 0.6, H * yy); ctx.stroke(); });
      // 앞지느러미
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(L * 0.14, H * 0.3); ctx.rotate(0.6 + Math.sin(ph * 1.3) * 0.35);
      ctx.beginPath(); ctx.ellipse(-L * 0.05, H * 0.1, L * 0.1, H * 0.15, 0.3, 0, TAU); ctx.fill();
      ctx.restore();
      creatureEye(ctx, L * 0.39, -H * 0.16, er * 1.05, o);
      break;
    }
    case 'penguin': {
      const fl = Math.sin(ph * 1.5);
      // 발
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(-L * 0.38, H * 0.12); ctx.lineTo(-L * 0.55, H * 0.04 + fl * H * 0.06); ctx.lineTo(-L * 0.52, H * 0.26); ctx.closePath(); ctx.fill();
      // 몸 (등은 까맣고 배는 하얗다)
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.44, H * 0.5, 0, 0, TAU);
      ctx.fillStyle = top;
      finish(() => {
        ctx.fillStyle = belly;
        ctx.beginPath(); ctx.ellipse(L * 0.04, H * 0.3, L * 0.4, H * 0.36, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(L * 0.3, -H * 0.08, L * 0.09, H * 0.17, 0, 0, TAU); ctx.fill();
      });
      // 부리
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(L * 0.4, -H * 0.14); ctx.lineTo(L * 0.58, -H * 0.03); ctx.lineTo(L * 0.41, H * 0.06); ctx.closePath(); ctx.fill();
      // 날개 (파닥파닥)
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(L * 0.05, -H * 0.02); ctx.rotate(0.3 + fl * 0.5);
      ctx.beginPath(); ctx.ellipse(-L * 0.14, 0, L * 0.18, H * 0.12, 0, 0, TAU); ctx.fill();
      ctx.restore();
      creatureEye(ctx, L * 0.31, -H * 0.12, er * 0.9, o);
      break;
    }
    case 'octopus': {
      // 다리 여덟 개: 머리 아래에서 뒤로 흐느적
      for (let i = 0; i < 8; i++) {
        const bx = L * (0.24 - i * 0.055), byy = H * 0.12;
        const pts = [];
        for (let j = 0; j <= 9; j++) {
          const q = j / 9;
          pts.push([bx - q * L * (0.44 - i * 0.02), byy + q * H * (0.22 + (i % 4) * 0.08) + Math.sin(ph * 1.2 - q * 4 - i) * H * 0.12 * q]);
        }
        taperStroke(ctx, pts, L * 0.085, L * 0.02, i % 2 ? top : col('#be123c'));
        if (i % 2) dots(pts.slice(2, 8).filter((_, j) => j % 2 === 0).map(([x, y]) => [x, y + L * 0.02]), L * 0.012);
      }
      // 둥근 머리
      ctx.beginPath(); ctx.ellipse(L * 0.1, -H * 0.12, L * 0.3, H * 0.42, -0.25, 0, TAU);
      ctx.fillStyle = grad(-H * 0.55, H * 0.3, 0.9);
      finish(() => dots([[0.02, -0.38], [0.16, -0.32], [-0.08, -0.18], [0.08, -0.12]].map(([x, y]) => [L * x, H * y]), L * 0.03));
      creatureEye(ctx, L * 0.2, -H * 0.02, er * 0.85, o);
      creatureEye(ctx, L * 0.33, -H * 0.06, er * 0.85, o);
      smile(ctx, L * 0.32, H * 0.14, er * 0.6);
      break;
    }
    case 'squid': {
      // 다리 (뒤로 흐느적, 긴 다리 두 개)
      for (let i = 0; i < 8; i++) {
        const long = i === 2 || i === 5, len = L * (long ? 0.5 : 0.3);
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const q = j / 8;
          pts.push([-L * 0.12 - q * len, (i - 3.5) * H * 0.08 * (1 + q * 0.6) + Math.sin(ph * 1.5 - q * 5 + i) * H * 0.12 * q]);
        }
        taperStroke(ctx, pts, H * 0.16, H * 0.04, top);
      }
      // 끝쪽 세모 지느러미
      const flap = Math.sin(ph * 1.5) * 0.15;
      ctx.fillStyle = fin;
      ctx.beginPath(); ctx.moveTo(L * 0.52, 0); ctx.lineTo(L * 0.3, -H * (0.85 + flap)); ctx.lineTo(L * 0.2, 0); ctx.lineTo(L * 0.3, H * (0.85 + flap)); ctx.closePath(); ctx.fill();
      // 머리
      ctx.fillStyle = top;
      ctx.beginPath(); ctx.ellipse(-L * 0.08, 0, L * 0.1, H * 0.4, 0, 0, TAU); ctx.fill();
      // 몸통
      ctx.beginPath();
      ctx.moveTo(L * 0.52, 0);
      ctx.quadraticCurveTo(L * 0.3, -H * 0.52, 0, -H * 0.44);
      ctx.lineTo(0, H * 0.44);
      ctx.quadraticCurveTo(L * 0.3, H * 0.52, L * 0.52, 0);
      ctx.closePath();
      ctx.fillStyle = grad(-H * 0.5, H * 0.5, 0.65);
      finish(() => dots([[0.08, -0.22], [0.2, -0.12], [0.32, -0.08], [0.14, 0.02], [0.26, 0.1], [0.06, 0.2]].map(([x, y]) => [L * x, H * y]), L * 0.014));
      creatureEye(ctx, -L * 0.07, -H * 0.06, er * 1.1, o);
      break;
    }
    case 'crab': {
      // 다리 세 쌍 (걸을 때 번갈아 들썩)
      ctx.strokeStyle = fin; ctx.lineWidth = Math.max(1.2, L * 0.045);
      [-1, 1].forEach(side => {
        for (let i = 0; i < 3; i++) {
          const bx = side * L * (0.16 + i * 0.07), byy = H * 0.12;
          const lift = Math.sin(ph * 1.2 + i * 2 + (side > 0 ? 0 : 1.5)) * H * 0.06;
          ctx.beginPath(); ctx.moveTo(bx * 0.8, byy); ctx.lineTo(bx + side * L * 0.12, byy + H * 0.04 - lift); ctx.lineTo(bx + side * L * 0.18, byy + H * 0.36 - lift * 0.5); ctx.stroke();
        }
      });
      // 집게발
      const open = 0.2 + Math.max(0, Math.sin(ph * 0.7)) * 0.35;
      [-1, 1].forEach(side => {
        ctx.strokeStyle = fin; ctx.lineWidth = Math.max(1.4, L * 0.06);
        ctx.beginPath(); ctx.moveTo(side * L * 0.24, -H * 0.05); ctx.lineTo(side * L * 0.38, -H * 0.32); ctx.stroke();
        ctx.save(); ctx.translate(side * L * 0.42, -H * 0.44);
        ctx.fillStyle = top;
        ctx.beginPath(); ctx.ellipse(side * L * 0.03, -H * 0.13, L * 0.045, H * 0.14, side * (0.3 + open), 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(side * L * 0.07, -H * 0.03, L * 0.035, H * 0.1, side * (0.9 + open), 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, H * 0.04, L * 0.08, H * 0.12, 0, 0, TAU); ctx.fill();
        ctx.restore();
      });
      // 눈자루
      ctx.strokeStyle = fin; ctx.lineWidth = Math.max(1, L * 0.03);
      [-1, 1].forEach(side => { ctx.beginPath(); ctx.moveTo(side * L * 0.08, -H * 0.26); ctx.lineTo(side * L * 0.1, -H * 0.5); ctx.stroke(); });
      // 몸통
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.34, H * 0.34, 0, 0, TAU);
      ctx.fillStyle = grad(-H * 0.34, H * 0.34, 0.75);
      finish(() => {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        [[-0.18, -0.14], [0, -0.2], [0.18, -0.14]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(L * x, H * y, L * 0.03, 0, TAU); ctx.fill(); });
      });
      creatureEye(ctx, -L * 0.1, -H * 0.55, er * 0.9, o);
      creatureEye(ctx, L * 0.1, -H * 0.55, er * 0.9, o);
      smile(ctx, 0, H * 0.1, er * 0.8);
      break;
    }
    case 'starfish': {
      const rot = Math.sin(ph * 0.15) * 0.15;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5 + rot;
        const rr = i % 2 ? L * 0.22 : L * 0.6 * (1 + Math.sin(ph * 0.5 + i) * 0.04);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      smoothClosed(ctx, pts);
      const g = ctx.createRadialGradient(0, -L * 0.05, L * 0.04, 0, 0, L * 0.5);
      g.addColorStop(0, belly); g.addColorStop(1, top);
      ctx.fillStyle = g;
      finish(() => {
        const arms = [];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + i * TAU / 5 + rot;
          [0.17, 0.27, 0.36].forEach(rr => arms.push([Math.cos(a) * L * rr, Math.sin(a) * L * rr]));
        }
        dots(arms, L * 0.022);
      });
      creatureEye(ctx, -L * 0.07, -L * 0.03, er * 0.85, o);
      creatureEye(ctx, L * 0.07, -L * 0.03, er * 0.85, o);
      smile(ctx, 0, L * 0.09, er * 0.7);
      break;
    }
    case 'shrimp': {
      const seg = [];
      for (let i = 0; i < 6; i++) {
        const q = i / 5;
        seg.push({ x: L * (0.12 - q * 0.42), y: -H * 0.05 + H * 0.45 * q * q + Math.sin(ph - q * 2) * H * 0.04 * q, r: H * (0.3 - q * 0.14) });
      }
      const last = seg[5];
      // 꼬리 부채
      ctx.fillStyle = fin;
      ctx.save(); ctx.translate(last.x - L * 0.04, last.y + H * 0.06); ctx.rotate(0.9 + Math.sin(ph) * 0.15);
      [-0.5, 0, 0.5].forEach(a => { ctx.beginPath(); ctx.ellipse(Math.sin(a) * L * 0.05, L * 0.07, L * 0.04, L * 0.09, a, 0, TAU); ctx.fill(); });
      ctx.restore();
      // 다리
      ctx.strokeStyle = fin; ctx.lineWidth = Math.max(0.7, L * 0.02);
      for (let i = 0; i < 5; i++) {
        const s0 = seg[Math.min(4, i)];
        ctx.beginPath(); ctx.moveTo(s0.x + L * 0.04, s0.y + s0.r * 0.7); ctx.lineTo(s0.x + L * 0.04 + Math.sin(ph * 2 + i) * L * 0.03, s0.y + s0.r * 0.7 + H * 0.25); ctx.stroke();
      }
      // 마디 (꼬리 쪽부터)
      for (let i = 5; i >= 1; i--) {
        const s0 = seg[i];
        ctx.beginPath(); ctx.ellipse(s0.x, s0.y, s0.r * 1.15, s0.r, 0.5 * i / 5, 0, TAU);
        ctx.fillStyle = grad(s0.y - s0.r, s0.y + s0.r, 0.7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(0.6, L * 0.012); ctx.stroke();
      }
      // 머리 껍질 · 뿔
      ctx.beginPath(); ctx.ellipse(L * 0.24, -H * 0.1, L * 0.19, H * 0.3, -0.15, 0, TAU);
      ctx.fillStyle = grad(-H * 0.4, H * 0.2, 0.75); finish();
      ctx.fillStyle = top;
      ctx.beginPath(); ctx.moveTo(L * 0.38, -H * 0.24); ctx.lineTo(L * 0.56, -H * 0.34); ctx.lineTo(L * 0.4, -H * 0.12); ctx.closePath(); ctx.fill();
      // 더듬이
      ctx.strokeStyle = top; ctx.lineWidth = Math.max(0.6, L * 0.012);
      [0, 1].forEach(j => {
        ctx.beginPath(); ctx.moveTo(L * 0.36, -H * 0.2);
        ctx.quadraticCurveTo(L * 0.55, -H * (0.7 + j * 0.2), L * (0.7 - j * 0.08), -H * (0.5 + j * 0.4) + Math.sin(ph * 1.3 + j) * H * 0.1);
        ctx.stroke();
      });
      creatureEye(ctx, L * 0.3, -H * 0.24, er * 0.9, o);
      break;
    }
    case 'seahorse': {
      // 돌돌 말린 꼬리
      const tail = [[-L * 0.06, H * 0.08], [-L * 0.08, H * 0.2], [-L * 0.05, H * 0.31]];
      const cx = L * 0.08, cy = H * 0.36;
      for (let j = 0; j <= 10; j++) {
        const a = Math.PI - j * 0.5, rr = L * 0.13 * (1 - j / 14);
        tail.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + Math.sin(ph * 0.4) * L * 0.01]);
      }
      taperStroke(ctx, tail, L * 0.16, L * 0.04, top);
      // 등지느러미 (빠르게 파닥)
      ctx.fillStyle = fin;
      ctx.beginPath(); ctx.ellipse(-L * 0.26, -H * 0.02, L * (0.07 + Math.sin(ph * 3) * 0.02), H * 0.08, 0, 0, TAU); ctx.fill();
      // 몸 (배가 앞으로 볼록)
      ctx.beginPath();
      ctx.moveTo(L * 0.02, -H * 0.24);
      ctx.bezierCurveTo(L * 0.32, -H * 0.15, L * 0.28, H * 0.1, -L * 0.03, H * 0.14);
      ctx.bezierCurveTo(-L * 0.3, H * 0.05, -L * 0.28, -H * 0.18, -L * 0.08, -H * 0.26);
      ctx.closePath();
      ctx.fillStyle = grad(-H * 0.26, H * 0.14, 0.4);
      finish(() => {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(0.7, L * 0.014);
        for (let i = 0; i < 6; i++) { const yy = -H * 0.17 + i * H * 0.05; ctx.beginPath(); ctx.moveTo(L * 0.04, yy); ctx.lineTo(L * 0.3, yy + H * 0.01); ctx.stroke(); }
      });
      // 머리 · 주둥이 · 볏
      ctx.fillStyle = top;
      ctx.beginPath(); ctx.ellipse(L * 0.0, -H * 0.3, L * 0.17, H * 0.1, 0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = top; ctx.lineWidth = Math.max(1.2, L * 0.1);
      ctx.beginPath(); ctx.moveTo(L * 0.1, -H * 0.3); ctx.lineTo(L * 0.4, -H * 0.26); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-L * 0.12, -H * 0.35); ctx.lineTo(-L * 0.08, -H * 0.43); ctx.lineTo(-L * 0.02, -H * 0.37); ctx.lineTo(L * 0.02, -H * 0.45); ctx.lineTo(L * 0.06, -H * 0.36);
      ctx.closePath(); ctx.fill();
      creatureEye(ctx, L * 0.04, -H * 0.31, er * 0.9, o);
      break;
    }
    case 'jellyfish': {
      // 촉수
      for (let i = 0; i < 6; i++) {
        const x0 = (i - 2.5) / 2.5 * bw * 0.8;
        const pts = [];
        for (let j = 0; j <= 8; j++) { const q = j / 8; pts.push([x0 + Math.sin(ph * 0.8 - q * 5 + i) * L * 0.06 * q, by + q * H * 0.6]); }
        taperStroke(ctx, pts, L * 0.035, L * 0.01, fin);
      }
      // 프릴 입팔
      [-1, 1].forEach(side => {
        const pts = [];
        for (let j = 0; j <= 8; j++) { const q = j / 8; pts.push([side * L * 0.08 + Math.sin(ph * 0.9 - q * 6 + side) * L * 0.05 * q, by + q * H * 0.45]); }
        taperStroke(ctx, pts, L * 0.08, L * 0.03, belly);
      });
      // 갓
      bellPath();
      const g = ctx.createRadialGradient(0, by - bh * 0.7, L * 0.04, 0, by - bh * 0.3, bw);
      g.addColorStop(0, belly); g.addColorStop(1, top);
      ctx.fillStyle = g;
      finish();
      creatureEye(ctx, -L * 0.11, by - bh * 0.5, er * 0.85, o);
      creatureEye(ctx, L * 0.11, by - bh * 0.5, er * 0.85, o);
      smile(ctx, 0, by - bh * 0.18, er * 0.6);
      break;
    }
    default: break;
  }

  // 아기(알)를 가진 배는 밝고 볼록하게
  const bellyK = o.belly || 0;
  if (bellyK > 0.05) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 * bellyK})`;
    ctx.beginPath(); ctx.ellipse(0, H * 0.22, L * 0.16 * (1 + bellyK * 0.4), H * 0.14 * (1 + bellyK * 0.6), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════ 장식 그리기 ═══════════════════════════════
// x: 가운데, y: 모래 위 바닥선, k: 화면 배율, t: 시간(초), rt: 상자 열림 등 상태
export function drawDecor(ctx, id, x, y, k, t, rt = {}, flow = 0) {
  ctx.save();
  if (id === 'grass') {
    const cols = ['#15803d', '#16a34a', '#22c55e', '#166534'];
    for (let i = 0; i < 8; i++) {
      const bx = x + (i - 3.5) * 5.5 * k, h = (66 + ((i * 37) % 50)) * k, w = 7 * k;
      const ph = t * 1.25 + i * 0.8 + x * 0.013;
      ctx.beginPath();
      const left = [], right = [];
      for (let j = 0; j <= 7; j++) {
        const q = j / 7;
        const cx = bx + (Math.sin(ph + q * 2.2) * 9 * k + flow * 22 * k) * q * q;
        const cy = y - h * q;
        const hw = w * (1 - q * 0.82) / 2;
        left.push([cx - hw, cy]); right.push([cx + hw, cy]);
      }
      ctx.moveTo(left[0][0], left[0][1]);
      left.forEach(p => ctx.lineTo(p[0], p[1]));
      right.reverse().forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill();
    }
  } else if (id === 'sword') {
    for (let i = 0; i < 7; i++) {
      const a = -1.05 + i * 0.35 + Math.sin(t * 1.1 + i + x * 0.01) * 0.07 + flow * 0.15;
      const len = (52 + (i % 3) * 12) * k, w = 15 * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, '#166534'); g.addColorStop(0.5, '#4ade80'); g.addColorStop(1, '#15803d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w, -len * 0.55, 0, -len);
      ctx.quadraticCurveTo(-w, -len * 0.55, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,252,231,0.5)'; ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -len * 0.92); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'rock') {
    const g = ctx.createRadialGradient(x - 12 * k, y - 34 * k, 4 * k, x, y - 18 * k, 46 * k);
    g.addColorStop(0, '#d1d5db'); g.addColorStop(0.55, '#6b7280'); g.addColorStop(1, '#374151');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 40 * k, y);
    ctx.bezierCurveTo(x - 42 * k, y - 30 * k, x - 14 * k, y - 48 * k, x + 8 * k, y - 44 * k);
    ctx.bezierCurveTo(x + 34 * k, y - 40 * k, x + 44 * k, y - 18 * k, x + 40 * k, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(101,163,13,0.55)';
    ctx.beginPath(); ctx.ellipse(x - 10 * k, y - 40 * k, 16 * k, 6 * k, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b5563';
    ctx.beginPath(); ctx.ellipse(x + 34 * k, y - 6 * k, 14 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'coral') {
    ctx.lineCap = 'round';
    const branch = (bx, by, len, ang, depth) => {
      const sway = Math.sin(t * 0.9 + depth + bx * 0.02) * 0.04;
      const ex = bx + Math.sin(ang + sway) * len, ey = by - Math.cos(ang + sway) * len;
      ctx.strokeStyle = depth > 1 ? '#f472b6' : '#ec4899';
      ctx.lineWidth = (10 - depth * 2.4) * k;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      if (depth < 3) {
        branch(ex, ey, len * 0.72, ang - 0.45, depth + 1);
        branch(ex, ey, len * 0.68, ang + 0.5, depth + 1);
      } else {
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath(); ctx.arc(ex, ey, 3.2 * k, 0, Math.PI * 2); ctx.fill();
      }
    };
    branch(x - 8 * k, y, 30 * k, -0.25, 0);
    branch(x + 10 * k, y, 24 * k, 0.35, 1);
  } else if (id === 'airstone') {
    const g = ctx.createRadialGradient(x - 4 * k, y - 10 * k, 2, x, y - 6 * k, 18 * k);
    g.addColorStop(0, '#e5e7eb'); g.addColorStop(1, '#6b7280');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - 6 * k, 15 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(55,65,81,0.6)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 9 * k + i * 3.6 * k, y - 8 * k + (i % 2) * 3 * k, 1.1 * k, 0, Math.PI * 2); ctx.fill(); }
  } else if (id === 'chest') {
    const w = 64 * k, h = 34 * k, open = rt.open || 0;
    if (open > 0.2) {
      const glow = ctx.createRadialGradient(x, y - h, 2, x, y - h, 50 * k);
      glow.addColorStop(0, `rgba(253,224,71,${0.7 * open})`); glow.addColorStop(1, 'rgba(253,224,71,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 60 * k, y - h - 60 * k, 120 * k, 90 * k);
    }
    const wg = ctx.createLinearGradient(0, y - h, 0, y);
    wg.addColorStop(0, '#b45309'); wg.addColorStop(1, '#78350f');
    ctx.fillStyle = wg; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = 'rgba(69,26,3,0.5)'; ctx.lineWidth = 1.5 * k;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * i / 3); ctx.lineTo(x + w / 2, y - h * i / 3); ctx.stroke(); }
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - w / 2 + 6 * k, y - h, 5 * k, h); ctx.fillRect(x + w / 2 - 11 * k, y - h, 5 * k, h);
    if (open > 0.2) {
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 18 * k + i * 7 * k, y - h - 2 * k, 4 * k, Math.PI, 0); ctx.fill(); }
    }
    // 뚜껑 (뒤쪽 경첩 기준으로 열림)
    ctx.save();
    ctx.translate(x - w / 2, y - h);
    ctx.rotate(-open * 0.95);
    ctx.fillStyle = '#92400e';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w / 2, -h * 0.75, w, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(w / 2 - 4 * k, -4 * k, 8 * k, 9 * k);
    ctx.restore();
  } else if (id === 'castle') {
    const w = 104 * k, h = 62 * k, sand = '#e7c9a0', dark = '#c4a170';
    const block = (bx, by, bw, bh) => {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, sand); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = sand;
      for (let i = 0; i < 3; i++) ctx.fillRect(bx + i * bw / 3 + bw / 12, by - 7 * k, bw / 6, 7 * k);
    };
    block(x - w / 2, y - h, w, h);
    block(x - w / 2 - 6 * k, y - h - 30 * k, 28 * k, h + 30 * k);
    block(x + w / 2 - 22 * k, y - h - 30 * k, 28 * k, h + 30 * k);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.moveTo(x - 14 * k, y); ctx.lineTo(x - 14 * k, y - 26 * k); ctx.arc(x, y - 26 * k, 14 * k, Math.PI, 0); ctx.lineTo(x + 14 * k, y); ctx.fill();
    [[x - w / 2 + 8 * k, y - h - 14 * k], [x + w / 2 - 8 * k, y - h - 14 * k]].forEach(([wx, wy]) => {
      ctx.beginPath(); ctx.arc(wx, wy, 4.5 * k, Math.PI, 0); ctx.lineTo(wx + 4.5 * k, wy + 8 * k); ctx.lineTo(wx - 4.5 * k, wy + 8 * k); ctx.fill();
    });
    [x - w / 2 + 8 * k, x + w / 2 - 8 * k].forEach((fx, i) => {
      const fy = y - h - 37 * k;
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 18 * k); ctx.stroke();
      ctx.fillStyle = i ? '#3b82f6' : '#ef4444';
      const wv = Math.sin(t * 3 + i) * 3 * k;
      ctx.beginPath(); ctx.moveTo(fx, fy - 18 * k); ctx.quadraticCurveTo(fx + 8 * k, fy - 15 * k + wv, fx + 14 * k, fy - 13 * k); ctx.lineTo(fx, fy - 9 * k); ctx.fill();
    });
  } else if (id === 'diver') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 11 * k, y - 26 * k, 9 * k, 24 * k); ctx.fillRect(x + 2 * k, y - 26 * k, 9 * k, 24 * k);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 13 * k, y - 5 * k, 12 * k, 5 * k); ctx.fillRect(x + 1 * k, y - 5 * k, 12 * k, 5 * k);
    const bg2 = ctx.createLinearGradient(x - 16 * k, 0, x + 16 * k, 0);
    bg2.addColorStop(0, '#c2410c'); bg2.addColorStop(0.5, '#fb923c'); bg2.addColorStop(1, '#c2410c');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 15 * k, y - 58 * k, 30 * k, 34 * k, 8 * k) : ctx.rect(x - 15 * k, y - 58 * k, 30 * k, 34 * k); ctx.fill();
    ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round';
    const arm = Math.sin(t * 1.5) * 0.25;
    ctx.beginPath(); ctx.moveTo(x - 14 * k, y - 52 * k); ctx.lineTo(x - 24 * k, y - 36 * k + arm * 10 * k); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14 * k, y - 52 * k); ctx.lineTo(x + 24 * k, y - 66 * k - arm * 10 * k); ctx.stroke();
    const hg = ctx.createRadialGradient(x - 5 * k, y - 76 * k, 2, x, y - 70 * k, 20 * k);
    hg.addColorStop(0, '#fde68a'); hg.addColorStop(1, '#b45309');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(x, y - 70 * k, 17 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath(); ctx.arc(x + 3 * k, y - 70 * k, 9 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(x + 3 * k, y - 70 * k, 9 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(x + 1 * k, y - 71 * k, 1.6 * k, 0, Math.PI * 2); ctx.arc(x + 6 * k, y - 71 * k, 1.6 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════ WebGL 빛 레이어 ═══════════════════════════════
// 검은 바탕에 빛만 그리고 CSS mix-blend-mode: screen 으로 아래 어항 위에 더한다
const LIGHT_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform float uSurface; uniform float uFloor; uniform vec2 uTilt; uniform float uMurk; uniform float uLight;
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float y = 1.0 - uv.y;
  float aspect = uRes.x / uRes.y;
  float water = smoothstep(uSurface - 0.004, uSurface + 0.004, y);
  float depth = clamp((y - uSurface) / max(0.05, 1.0 - uSurface), 0.0, 1.0);
  vec2 cuv = vec2(uv.x * aspect * 0.9 + uTilt.x * 0.04, y * 0.9) ;
  float cs = caustic(cuv, uTime * 0.45 + 23.0);
  float floorMask = smoothstep(uFloor - 0.05, uFloor + 0.01, y);
  float clear = 1.0 - uMurk * 0.75;
  float light = cs * (0.05 * (1.0 - depth) + floorMask * 0.5) * water * clear;   // 물속 빛무늬는 은은하게, 바닥은 또렷하게
  float lean = 0.32 + uTilt.x * 0.35;
  float rx = uv.x * aspect + (y - uSurface) * lean;
  float rays = pow(0.5 + 0.5 * sin(rx * 6.0 + uTime * 0.3), 9.0) + 0.6 * pow(0.5 + 0.5 * sin(rx * 11.0 - uTime * 0.22 + 1.7), 14.0);
  rays *= (1.0 - smoothstep(0.0, 0.7, depth)) * water * 0.16 * clear;   // 햇살이 뿌연 막처럼 덮지 않게
  float surf = exp(-abs(y - uSurface) * 90.0) * (0.45 + 0.35 * sin(uv.x * 90.0 + uTime * 3.0));
  vec3 col = vec3(0.72, 0.95, 1.0) * (light + rays) + vec3(1.0) * surf * 0.45;
  gl_FragColor = vec4(col * uLight, 1.0);
}`;

function initLightLayer(canvas) {
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = mk(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }');
  const fs = mk(gl.FRAGMENT_SHADER, LIGHT_FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n) => gl.getUniformLocation(prog, n);
  return { gl, uRes: u('uRes'), uTime: u('uTime'), uSurface: u('uSurface'), uFloor: u('uFloor'), uTilt: u('uTilt'), uMurk: u('uMurk'), uLight: u('uLight') };
}

// ═══════════════════════════════ 상점 미리보기 ═══════════════════════════════
function FishPreview({ species }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 110 * d; c.height = 74 * d;
    ctx.scale(d, d);
    ctx.translate(58, 37);
    // 작은 물고기도 잘 보이게 크게 (몸이 높은 종류는 칸에 맞게 조금 작게)
    const L = species.hRatio > 1.1 ? 66 / species.hRatio : species.hRatio > 0.8 ? 58 : clamp(species.len * 1.5, 56, 74);
    drawFish(ctx, lookOf(species, { variant: species.id === 'guppy' ? 'rainbow' : undefined }), L, { phase: 0.6, growth: 1, detail: true, gloss: true });
  }, [species]);
  return <canvas ref={ref} style={{ width: 110, height: 74 }} />;
}

function DecorPreview({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 110 * d; c.height = 92 * d;
    ctx.scale(d, d);
    const [w, h] = DECOR_BOX[id];
    const k = Math.min(1, 96 / w, 82 / h);
    drawDecor(ctx, id, 55, 88, k, 1.2, { open: id === 'chest' ? 0.8 : 0 });
  }, [id]);
  return <canvas ref={ref} style={{ width: 110, height: 92 }} />;
}

// ═══════════════════════════════ 상단 버튼·물 상태 ═══════════════════════════════
// 큰 둥근 그림 버튼 (아래 작은 글자는 부모용)
function IconButton({ icon, label, color, active, onClick, badge, keepColor }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: '68px', height: '68px', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation',
        background: active && !keepColor ? '#fef08a' : color, border: active ? '4px solid #ffffff' : '4px solid rgba(255,255,255,0.35)',
        boxShadow: active ? '0 0 0 4px #facc15, 0 6px 14px rgba(0,0,0,0.25)' : '0 6px 14px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0,
        transform: active ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.15s ease', position: 'relative'
      }}
    >
      {badge ? (
        <span style={{
          position: 'absolute', top: '-4px', right: '-4px', minWidth: '24px', height: '24px', borderRadius: '12px', background: '#ef4444',
          color: '#ffffff', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ffffff',
          animation: 'bpsPulse 1s ease-in-out infinite'
        }}>{badge}</span>
      ) : null}
      <span style={{ fontSize: '2rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.62rem', fontWeight: 900, color: active && !keepColor ? '#713f12' : '#ffffff', marginTop: '1px' }}>{label}</span>
    </button>
  );
}

// 밥 버튼 그림: 공기에 수북이 담은 고봉밥
function RiceBowlIcon() {
  const grains = [[14, 15, -20], [20, 11, 10], [26, 13, -35], [17, 20, 30], [24, 18, -5], [30, 19, 25], [11, 21, -40], [21, 25, 15], [28, 24, -25], [34, 23, 40]];
  return (
    <svg width="40" height="36" viewBox="0 0 44 40" aria-hidden="true">
      <path d="M15 6 q-2 -3 0 -5 M22 5 q-2 -3 0 -5 M29 6 q-2 -3 0 -5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M5 25 C5 9 13 7 22 7 C31 7 39 9 39 25 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <ellipse cx="16" cy="13" rx="5" ry="3" fill="#f8fafc" opacity="0.9" />
      {grains.map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx="2" ry="1.1" transform={`rotate(${a} ${x} ${y})`} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" />)}
      <path d="M2 24 H42 C41 33 34 38 22 38 C10 38 3 33 2 24 Z" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.4" />
      <path d="M8 29 H36" stroke="#e0f2fe" strokeWidth="1.6" strokeDasharray="3 2.5" />
      <rect x="15" y="36.5" width="14" height="3" rx="1.2" fill="#0369a1" />
    </svg>
  );
}

// 캔버스용: 치료 버튼과 같은 모양 (분홍 동그라미 + 비스듬한 반창고). size = 동그라미 지름
function drawBandageBadge(ctx, x, y, size) {
  const k = size / 68;   // 버튼(68px) 기준 비율
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f43f5e';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3 * k;
  ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 아이콘(44x40 그림을 40px 로)과 같은 비율
  const u = 40 / 44 * k;
  ctx.scale(u, u);
  ctx.rotate(-35 * Math.PI / 180);
  const rr = (rx, ry, w, h, rad) => { ctx.beginPath(); ctx.moveTo(rx + rad, ry); ctx.arcTo(rx + w, ry, rx + w, ry + h, rad); ctx.arcTo(rx + w, ry + h, rx, ry + h, rad); ctx.arcTo(rx, ry + h, rx, ry, rad); ctx.arcTo(rx, ry, rx + w, ry, rad); ctx.closePath(); };
  rr(-21, -8, 42, 16, 8); ctx.fillStyle = '#fbbf8a'; ctx.fill(); ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.4; ctx.stroke();
  rr(-7, -6.5, 14, 13, 2.5); ctx.fillStyle = '#fde7d3'; ctx.fill(); ctx.strokeStyle = '#ea9a63'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#ea9a63';
  [-3.5, 0, 3.5].forEach(px => [-3, 0, 3].forEach(py => { ctx.beginPath(); ctx.arc(px, py, 0.7, 0, Math.PI * 2); ctx.fill(); }));
  ctx.fillStyle = 'rgba(194,65,12,0.6)';
  [[-16, -3], [-13, 2], [-16, 3], [13, -3], [16, 2], [13, 3], [16, -3]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 0.9, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

// 치료 버튼 그림: 비스듬한 반창고(데일밴드)
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

// 어항 물 상태: 깨끗하면 웃는 얼굴, 더러우면 찡그린 얼굴
function WaterMeter({ value }) {
  const face = value >= 60 ? '😊' : value >= 30 ? '😐' : '😣';
  const col = value >= 60 ? '#38bdf8' : value >= 30 ? '#facc15' : '#f43f5e';
  return (
    <div title="물 깨끗함" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '18px', padding: '6px 10px' }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>💧</span>
      <div style={{ width: '64px', height: '12px', background: 'rgba(255,255,255,0.3)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: col, borderRadius: '8px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{face}</span>
    </div>
  );
}

// ═══════════════════════════════ 본체 ═══════════════════════════════
export default function AquariumGame({ audio, speak }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const lightRef = useRef(null);
  const overlayRef = useRef(null);
  const simRef = useRef(null);
  const modeRef = useRef('play');

  const [night, setNight] = useState(isNightTime());
  const [hud, setHud] = useState({ points: 0, clean: 100, sad: 0, sick: 0 });
  const [mode, setModeState] = useState('play');
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState('fish');   // 'fish' = 물고기 + 바다 친구, 'decor' = 장식
  const [info, setInfo] = useState(null);          // 터치한 물고기 uid
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [infoTick, setInfoTick] = useState(0);
  const [placed, setPlaced] = useState({ decor: [] });
  const [toast, setToast] = useState(null);
  const [tiltState, setTiltState] = useState('none');
  const [light, setLight] = useState(3);            // 조명 단계 (처음엔 가장 밝게 켜짐)

  const setMode = (m) => { modeRef.current = m; setModeState(m); };

  const showToast = (text) => {
    setToast({ text, key: Date.now() });
  };
  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(tm);
  }, [toast]);

  // ── 시뮬레이션 & 렌더 루프 ──
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, overlay = overlayRef.current;
    const ctx = canvas.getContext('2d');
    const octx = overlay.getContext('2d');
    const light = initLightLayer(lightRef.current);

    const game = loadGame();
    const offline = catchUpOffline(game);
    saveGame(game);   // 꺼둔 동안 생긴 변화(아픔·성장)를 바로 저장
    const s = {
      game, W: 0, H: 0, dpr: 1, t: 0, k: 1, quality: 1, slow: 0,
      surface: 0, surfaceBase: 0, floor: 0, gravelH: 60,
      rt: {}, decorRt: {},
      food: [], bubbles: [], ripples: [], pops: [], pearls: [], drops: [], algae: [],
      pointer: { down: false, x: 0, y: 0, downAt: 0, drag: null },
      tilt: { x: 0, y: 0 }, tiltRaw: { x: 0, y: 0 }, tiltBase: null,
      shaker: null, waterChange: null, overlayKey: '', algaeLayer: null,
      dtLast: 0, fx: 1, lampNow: LAMP[3], light: 3, ambient: ambientDark(), darkNow: 0, glNow: 1, night: isNightTime(), sleeping: false, lastActive: 0, touched: false,
      lastSave: 0, lastHud: 0, lastVoice: {}, lastYum: 0, bubbleT: 0, backdrop: null, gravel: null
    };
    simRef.current = s;

    // 꺼둔 동안 자란 물고기 보상 & 오늘의 첫 방문 선물
    offline.grown.forEach(f => { game.points += stageOf(f.growth) === 'adult' ? REWARDS.adult : REWARDS.juvenile; });
    const welcomeLines = [];
    if (!game.welcomed) {
      game.welcomed = true; game.lastDaily = todayKey();
      welcomeLines.push(VOICE.aquaWelcome());
    } else if (game.lastDaily !== todayKey()) {
      game.lastDaily = todayKey(); game.points += REWARDS.daily;
      welcomeLines.push(VOICE.aquaWelcomeBack());
      setTimeout(() => showToast(`🎁 오늘의 선물! 조개 +${REWARDS.daily}`), 400);
    }
    if (offline.grown.length) setTimeout(() => showToast(`🌱 그동안 ${offline.grown.length}마리가 자랐어요!`), 3200);
    if (offline.sick && offline.sick.length) setTimeout(() => { showToast(`🩹 그동안 ${offline.sick.length}마리가 아파졌어요! 밴드를 붙여 주세요`); speak(VOICE.aquaSick(FISH_BY_ID[offline.sick[0].sp])); }, 6000);
    if (welcomeLines.length) setTimeout(() => speak(welcomeLines[0]), 500);

    setPlaced({ decor: game.decor.slice() });

    const addPoints = (n, x, y) => {
      game.points += n;
      if (x != null) s.pops.push({ x, y, text: `+${n} 🐚`, life: 1.4, vy: -32, color: '#fef08a' });
    };
    s.addPoints = addPoints;
    const say = (key, line, gap = 0) => {
      if (gap && s.t - (s.lastVoice[key] ?? -1e9) < gap) return;
      s.lastVoice[key] = s.t;
      speak(line);
    };
    s.say = say;

    const groundY = (x) => s.floor + Math.sin(x * 0.021) * 3 + Math.sin(x * 0.007 + 1) * 4;
    s.groundY = groundY;

    // ── 화면 크기 & 고정 배경(물 그라데이션·자갈) 미리 그리기 ──
    const makeLayer = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * s.dpr); c.height = Math.round(h * s.dpr);
      const x = c.getContext('2d'); x.scale(s.dpr, s.dpr);
      return [c, x];
    };
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      s.W = Math.max(240, r.width); s.H = Math.max(240, r.height);
      s.dpr = Math.min(window.devicePixelRatio || 1, s.quality < 1 ? 1 : 2);
      s.k = clamp(Math.min(s.W, s.H * 1.5) / 620, 0.8, 1.5);
      s.surfaceBase = Math.round(s.H * 0.075);
      if (!s.waterChange) s.surface = s.surfaceBase;
      s.gravelH = clamp(s.H * 0.12, 52, 92);
      s.floor = s.H - s.gravelH + 10;
      [canvas, overlay].forEach(c => {
        c.width = Math.round(s.W * s.dpr); c.height = Math.round(s.H * s.dpr);
        c.style.width = `${s.W}px`; c.style.height = `${s.H}px`;
      });
      if (light) {
        const ls = s.quality < 1 ? 0.35 : 0.5;
        lightRef.current.width = Math.max(64, Math.round(s.W * s.dpr * ls));
        lightRef.current.height = Math.max(64, Math.round(s.H * s.dpr * ls));
        lightRef.current.style.width = `${s.W}px`; lightRef.current.style.height = `${s.H}px`;
      }

      // 물 + 뒷벽 실루엣
      const [bc, bx] = makeLayer(s.W, s.H);
      const g = bx.createLinearGradient(0, s.surfaceBase, 0, s.H);
      g.addColorStop(0, '#67d4f5'); g.addColorStop(0.28, '#16a3c9'); g.addColorStop(0.68, '#0e6f8f'); g.addColorStop(1, '#0c4a63');
      bx.fillStyle = g; bx.fillRect(0, 0, s.W, s.H);
      const drawRidge = (cx) => {
        cx.fillStyle = 'rgba(14,90,100,0.4)';
        cx.beginPath(); cx.moveTo(0, s.floor);
        for (let x = 0; x <= s.W; x += 40) cx.lineTo(x, s.floor - 26 - Math.sin(x * 0.013) * 16 - Math.sin(x * 0.041) * 6);
        cx.lineTo(s.W, s.floor); cx.closePath(); cx.fill();
      };
      // 수초가 없을 때의 배경 (수초 실루엣 없음)
      const [pc, px0] = makeLayer(s.W, s.H);
      px0.drawImage(bc, 0, 0, s.W, s.H);
      drawRidge(px0);
      s.backdropPlain = pc;
      // 멀리 보이는 수초 실루엣 (수초를 놓았을 때만, 위로 갈수록 물빛에 녹아든다)
      const far = bx.createLinearGradient(0, s.floor - s.H * 0.6, 0, s.floor);
      far.addColorStop(0, 'rgba(20,110,100,0)'); far.addColorStop(1, 'rgba(20,110,100,0.32)');
      bx.fillStyle = far;
      for (let i = 0; i < 9; i++) {
        const px = (i + 0.3) * s.W / 9, ph = s.H * (0.28 + (i * 0.37 % 0.3));
        bx.beginPath(); bx.moveTo(px - 18, s.floor);
        bx.quadraticCurveTo(px - 30 + (i % 3) * 18, s.floor - ph * 0.6, px + (i % 2 ? 12 : -10), s.floor - ph);
        bx.quadraticCurveTo(px + 26, s.floor - ph * 0.5, px + 22, s.floor); bx.fill();
      }
      drawRidge(bx);
      s.backdrop = bc;

      // 자갈 바닥
      const [gc, gx] = makeLayer(s.W, s.H);
      const sg = gx.createLinearGradient(0, s.floor - 8, 0, s.H);
      sg.addColorStop(0, '#d6c08f'); sg.addColorStop(1, '#8a6a3a');
      gx.fillStyle = sg;
      gx.beginPath(); gx.moveTo(0, s.H);
      for (let x = 0; x <= s.W; x += 8) gx.lineTo(x, groundY(x));
      gx.lineTo(s.W, s.H); gx.closePath(); gx.fill();
      const pebbleCols = [['#f5f5f4', '#a8a29e'], ['#d6d3d1', '#78716c'], ['#fde68a', '#b45309'], ['#fecaca', '#b91c1c'], ['#bfdbfe', '#1d4ed8'], ['#e7e5e4', '#57534e']];
      const count = Math.round(s.W * s.gravelH / 70);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * s.W, y = groundY(x) + 4 + Math.pow(Math.random(), 0.8) * (s.H - groundY(x) - 4);
        const r = (2 + Math.random() * 4.5) * s.k * (0.6 + (y - s.floor) / s.gravelH * 0.6);
        const [c1, c2] = pebbleCols[i % pebbleCols.length];
        const pg = gx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.2);
        pg.addColorStop(0, c1); pg.addColorStop(1, c2);
        gx.fillStyle = pg;
        gx.beginPath(); gx.ellipse(x, y, r * 1.25, r, (i % 7) * 0.4, 0, Math.PI * 2); gx.fill();
      }
      const edge = gx.createLinearGradient(0, s.floor - 6, 0, s.floor + 18);
      edge.addColorStop(0, 'rgba(255,255,255,0.18)'); edge.addColorStop(1, 'rgba(255,255,255,0)');
      gx.fillStyle = edge; gx.fillRect(0, s.floor - 6, s.W, 24);
      // 자갈 앞쪽(유리 가까이)은 조금 어둡게, 물과 닿는 경계는 살짝 그늘지게 → 바닥에 깊이감
      const front = gx.createLinearGradient(0, s.floor + 10, 0, s.H);
      front.addColorStop(0, 'rgba(15,23,42,0)'); front.addColorStop(1, 'rgba(15,23,42,0.22)');
      gx.fillStyle = front; gx.fillRect(0, s.floor + 10, s.W, s.H - s.floor);
      s.gravel = gc;
      // 물속을 천천히 떠도는 작은 부유물 (z: 0 먼 곳 ~ 1 가까운 곳)
      if (!s.motes) s.motes = [];
      const moteN = Math.round(clamp(s.W * s.H / 22000, 18, 60));
      s.motes = Array.from({ length: moteN }, (_, i) => ({
        x: Math.random() * s.W, y: s.surface + Math.random() * (s.floor - s.surface), z: Math.random(),
        ph: Math.random() * 6, sp: 0.4 + Math.random() * 0.8
      }));
      // 앞쪽 유리 가까이 지나가는 흐릿한 빛망울 (몇 개만)
      s.bokeh = Array.from({ length: 4 }, () => ({ x: Math.random() * s.W, y: s.surface + Math.random() * (s.floor - s.surface), r: 18 + Math.random() * 30, ph: Math.random() * 6 }));
      [s.algaeLayer, s.algaeCtx] = makeLayer(s.W, s.H);
      s.overlayKey = '';
      if (s.algae.length !== game.algae) regenAlgae();
    };

    // 유리 이끼 위치 (저장된 개수만큼 무작위 배치)
    const regenAlgae = () => {
      s.algae = Array.from({ length: game.algae }, () => makeAlgaeSpot());
      s.overlayKey = '';
    };
    const makeAlgaeSpot = () => ({
      x: Math.random() * s.W, y: s.surfaceBase + 20 + Math.random() * (s.floor - s.surfaceBase - 30),
      r: (10 + Math.random() * 22) * s.k, a: 0.25 + Math.random() * 0.3, blobs: Math.floor(3 + Math.random() * 4), seed: Math.random() * 10
    });

    // ── 물고기 런타임 상태 ──
    const ensureFishRt = (f, entering) => {
      if (s.rt[f.uid]) return s.rt[f.uid];
      const r = {
        x: 40 + Math.random() * Math.max(10, s.W - 80),
        y: entering ? s.surface + 10 : s.surface + 40 + Math.random() * Math.max(10, s.floor - s.surface - 100),
        vx: (Math.random() - 0.5) * 60, vy: entering ? 40 : 0,
        z: 0.35 + Math.random() * 0.65, phase: Math.random() * 6, panic: 0, poopDue: 0, pearlT: 60 + Math.random() * 60,
        boing: 0, happyT: 0
      };
      s.rt[f.uid] = r;
      return r;
    };
    s.ensureFishRt = ensureFishRt;

    resize();
    game.fish.forEach(f => ensureFishRt(f, false));
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── 먹이 ──
    const spawnFood = (x, n) => {
      for (let i = 0; i < n; i++) {
        if (s.food.length > 90) break;
        s.food.push({
          x: clamp(x + (Math.random() - 0.5) * 50, 10, s.W - 10), y: s.surface + 2 + Math.random() * 4,
          vx: (Math.random() - 0.5) * 10, vy: 0, state: 'float', t: 0.3 + Math.random() * 0.8,
          rot: Math.random() * 6, color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)], life: 25
        });
      }
    };
    // 밥 한 번 = 한 그릇: 물고기 수에 맞춘 양을 한꺼번에 떨어뜨린다. 남아 있으면 더 주지 않는다.
    s.feed = () => {
      // 물에 떠 있거나 가라앉는 중인 밥이 있으면 더 못 준다 (바닥에 다 떨어지면 다시 줄 수 있음)
      if (s.food.some(fd => fd.state !== 'ground') || s.shaker) { showToast('🍚 아직 밥이 남아 있어요!'); return; }
      const x = s.W * (0.25 + Math.random() * 0.5);
      s.shaker = { x, t: 0, dur: 0.6, dropped: false };
      audio.playYum();
      say('feed', VOICE.aquaFeed(), 6);
    };

    // ── 입력 ──
    const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const fishLen = (f) => {
      const sp = FISH_BY_ID[f.sp];
      return sp.len * sizeScale(f.growth) * s.k;
    };
    const hitFish = (x, y) => {
      let best = null, bd = Infinity;
      game.fish.forEach(f => {
        const r = s.rt[f.uid]; if (!r || r.leaving != null) return;
        const d = Math.hypot(r.x - x, r.y - y), rad = Math.max(26, fishLen(f) * 0.75);
        if (d < rad && d < bd) { best = f; bd = d; }
      });
      return best;
    };
    const hitDecor = (x, y) => {
      for (let i = game.decor.length - 1; i >= 0; i--) {
        const d = game.decor[i], [w, h] = DECOR_BOX[d.id];
        const dx = d.x * s.W, by = groundY(dx);
        if (Math.abs(x - dx) < w * s.k / 2 + 10 && y < by + 14 && y > by - h * s.k - 10) return d;
      }
      return null;
    };
    const cleanAt = (x, y) => {
      let n = 0;
      s.algae = s.algae.filter(a => {
        if (Math.hypot(a.x - x, a.y - y) < a.r + 36 * s.k) { n++; s.pops.push({ x: a.x, y: a.y, text: '✨', life: 0.8, vy: -20 }); return false; }
        return true;
      });
      if (n) {
        game.algae = s.algae.length;
        game.dirt = Math.max(0, game.dirt - n * 0.6);
        addPoints(REWARDS.algae * n, x, y - 20);
        s.overlayKey = '';
        audio.playFreq(1400 + Math.random() * 500, 'sine', 0.05, 0.2);
      }
      const before = game.poop.length;
      game.poop = game.poop.filter(p => Math.hypot(p.x - x, (groundY(p.x) + p.dy) - y) > 40 * s.k);
      const removed = before - game.poop.length;
      s.food = s.food.filter(f => !(f.state === 'ground' && Math.hypot(f.x - x, f.y - y) < 40 * s.k));
      if (removed) {
        addPoints(REWARDS.poop * removed, x, y - 26);
        audio.playPopSound();
        for (let i = 0; i < 4; i++) s.bubbles.push({ x: x + (Math.random() - 0.5) * 20, y, r: 2 + Math.random() * 3, wob: Math.random() * 6, vy: 70 });
      }
      if ((n || removed) && game.algae === 0 && game.poop.length === 0) say('clean', VOICE.aquaClean(), 20);
    };

    const onDown = (e) => {
      // 버튼·정보 카드·상점 같은 화면 요소를 누른 것은 어항 터치로 치지 않는다
      if (e.target.closest && e.target.closest('button, [data-ui]')) return;
      const { x, y } = local(e);
      s.pointer = { down: true, x, y, downAt: s.t, drag: null };
      const m = modeRef.current;
      if (m === 'clean') { cleanAt(x, y); return; }
      if (m === 'heal') {
        const f = hitFish(x, y);
        if (!f) return;
        const r = s.rt[f.uid], sp = FISH_BY_ID[f.sp];
        r.boing = 1;
        if (!f.sick) { audio.playBubble(); say('notsick', VOICE.aquaNotSick(), 2); return; }
        f.sick = false;
        f.happy = Math.min(100, f.happy + 25);
        r.happyT = 3;
        addPoints(REWARDS.heal, r.x, r.y - 30);
        audio.playFanfare();
        say('heal', VOICE.aquaHeal(sp));
        for (let i = 0; i < 12; i++) s.pops.push({ x: r.x + (Math.random() - 0.5) * 60, y: r.y + (Math.random() - 0.5) * 40, text: i % 3 ? '💗' : '✨', life: 1.2, vy: -40 });
        saveGame(game);
        if (!game.fish.some(fi => fi.sick)) setTimeout(() => { if (modeRef.current === 'heal') setMode('play'); }, 900);
        return;
      }
      if (m === 'decorate') {
        const d = hitDecor(x, y);
        if (d) { s.pointer.drag = { kind: 'decor', uid: d.uid, dx: d.x * s.W - x }; audio.playSnap(); }
        return;
      }
      // 놀이 모드
      s.ripples.push({ x, y, r: 6, life: 1 });
      const pearl = s.pearls.find(p => Math.hypot(p.x - x, p.y - y) < 34 * s.k);
      if (pearl) {
        s.pearls = s.pearls.filter(p => p !== pearl);
        addPoints(REWARDS.pearl, pearl.x, pearl.y - 20);
        audio.playFanfare();
        say('pearl', VOICE.aquaPearl(), 4);
        return;
      }
      const f = hitFish(x, y);
      if (f && s.rt[f.uid].asleep) {
        // 자는 물고기는 깨우지 않고 쉿! (정보 카드는 보여 준다)
        const r = s.rt[f.uid];
        s.touched = false;
        setInfo(f.uid);
        s.pops.push({ x: r.x, y: r.y - fishLen(f) * 0.6 - 10, text: '🤫 쉿!', life: 1.6, vy: -18, color: '#e0f2fe' });
        say('sleeptap', VOICE.aquaSleepTap(), 4);
        return;
      }
      if (f) {
        // 누르면 쓰다듬기: 기분 +15, 💗, 3초에 한 번 조개 +1
        const r = s.rt[f.uid];
        r.boing = 1; r.happyT = 2;
        f.happy = Math.min(100, f.happy + 15);
        s.pops.push({ x: r.x, y: r.y - 20, text: '💗', life: 1, vy: -30 });
        if (s.t - (s.lastPet || -9) > 3) { s.lastPet = s.t; addPoints(REWARDS.pet, r.x, r.y - 40); }
        audio.playYum();
        setInfo(f.uid);
        const sp = FISH_BY_ID[f.sp];
        if (f.sp === 'puffer') { r.puffT = 2.5; audio.playFreq(260, 'sine', 0.25, 0.4); setTimeout(() => audio.playFreq(520, 'sine', 0.2, 0.35), 120); }
        if (f.name) s.pops.push({ x: r.x, y: r.y - fishLen(f) * 0.6 - 10, text: `${sp.name} ${f.name}`, life: 1.6, vy: -22, color: '#fef08a' });
        if (f.sick) say('info', VOICE.aquaSick(sp), 1.5);
        else if (isSad(f, game.dirt)) say('info', VOICE.aquaSadFish(sp), 1.5);
        else if (f.name) say('info', VOICE.aquaHello(sp, f.name), 1.5);   // 종류 + 이름 (직접 지은 이름은 기기 음성으로 읽음)
        else say('info', VOICE.aquaFishInfo(sp, stageOf(f.growth)), 1.5);
        return;
      }
      for (let i = 0; i < 6; i++) s.bubbles.push({ x: x + (Math.random() - 0.5) * 30, y, r: 2 + Math.random() * 6, wob: Math.random() * 6, vy: 60 + Math.random() * 50 });
      audio.playBubble();
      game.fish.forEach(fi => {
        const r = s.rt[fi.uid]; if (!r) return;
        const dx = r.x - x, dy = r.y - y, d = Math.hypot(dx, dy) || 1;
        // 자는 물고기는 깨우지 않는다
        if (d < 200 && !r.asleep) { const kk = 380 * (1 - d / 200); r.vx += dx / d * kk; r.vy += dy / d * kk; r.panic = 1; if (fi.sp === 'puffer') r.puffT = 2; }
      });
    };
    const onMove = (e) => {
      if (!s.pointer.down) return;
      const { x, y } = local(e);
      s.pointer.x = x; s.pointer.y = y;
      const m = modeRef.current;
      if (m === 'clean') cleanAt(x, y);
      else if (m === 'decorate' && s.pointer.drag) {
        const dr = s.pointer.drag;
        const d = game.decor.find(it => it.uid === dr.uid);
        if (d) d.x = clamp((x + dr.dx) / s.W, 0.04, 0.96);
      }
    };
    const onUp = () => {
      if (s.pointer.drag) { saveGame(game); setPlaced({ decor: game.decor.slice() }); }
      s.pointer.down = false; s.pointer.drag = null;
    };
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    // 밤에도 아이가 놀고 있으면 물고기는 깨어 있다. 화면 어디를 눌러도(버튼 포함) 깨어 있는 시간이 늘어나지만,
    // 자는 물고기를 누르거나(onDown 에서 touched 를 지움) 정보 카드를 만지는 건 깨우지 않는다
    const onActive = (e) => { if (!(e.target && e.target.closest && e.target.closest('[data-quiet]'))) s.touched = true; };
    window.addEventListener('pointerdown', onActive, true);
    window.addEventListener('keydown', onActive, true);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // ── 기울기 센서 ──
    s.onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const ang = (window.screen.orientation && window.screen.orientation.angle) ?? window.orientation ?? 0;
      let x = e.gamma, y = e.beta;
      if (ang === 90) { x = e.beta; y = -e.gamma; } else if (ang === -90 || ang === 270) { x = -e.beta; y = e.gamma; } else if (ang === 180) { x = -e.gamma; y = -e.beta; }
      if (!s.tiltBase) s.tiltBase = { x, y };
      s.tiltBase.x += (x - s.tiltBase.x) * 0.005; s.tiltBase.y += (y - s.tiltBase.y) * 0.005;
      s.tiltRaw.x = clamp((x - s.tiltBase.x) / 28, -1, 1); s.tiltRaw.y = clamp((y - s.tiltBase.y) / 28, -1, 1);
    };
    const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (touchDevice && typeof window.DeviceOrientationEvent !== 'undefined') {
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') setTiltState('ask');
      else { window.addEventListener('deviceorientation', s.onOrient); setTiltState('on'); }
    }

    // ── 돌봄 규칙 (배고픔·물 더러움·기분·성장) ──
    // 아기 물고기들을 (x, y) 근처에 태어나게 한다. 자리가 모자라면 들어갈 만큼만
    const spawnFry = (spId, n, x, y, variant, family = {}) => {
      const room = Math.max(0, LIMITS.fish - game.fish.length);
      const count = Math.min(n, room);
      for (let i = 0; i < count; i++) {
        const baby = newFish(spId);
        if (variant && Math.random() < 0.7) baby.variant = variant;   // 대부분 엄마를 닮는다
        // 가족: 엄마·아빠 uid 를 기억한다 (부모가 자연으로 떠나도 그때 이름은 남겨 둔다)
        if (family.mom) { baby.mom = family.mom; if (family.momName) baby.momName = family.momName; }
        if (family.dad) { baby.dad = family.dad; if (family.dadName) baby.dadName = family.dadName; }
        game.fish.push(baby);
        const r = ensureFishRt(baby, false);
        r.x = clamp(x + (Math.random() - 0.5) * 40, 10, s.W - 10); r.y = clamp(y + (Math.random() - 0.5) * 20, s.surface + 20, s.floor - 10);
        r.vx = (Math.random() - 0.5) * 80; r.vy = -Math.random() * 30;
        for (let j = 0; j < 3; j++) s.pops.push({ x: r.x, y: r.y, text: j ? '✨' : '💗', life: 1.2, vy: -30 - Math.random() * 20 });
      }
      return count;
    };
    // 배 속 아기가 다 자라면: 난태생은 새끼를, 나머지는 바닥에 알을 낳는다
    const deliver = (f) => {
      const sp = FISH_BY_ID[f.sp], br = breedOf(f.sp), r = s.rt[f.uid];
      const dadFish = f.pregDad && game.fish.find(o => o.uid === f.pregDad);
      const family = { mom: f.uid, momName: f.name, dad: f.pregDad, dadName: dadFish ? dadFish.name : undefined };
      delete f.pregDad;
      const n = br.brood[0] + Math.floor(Math.random() * (br.brood[1] - br.brood[0] + 1));
      delete f.preg;
      f.restUntil = Date.now() + RATES.pregRestSec * 1000;
      const x = r ? r.x : s.W / 2, y = r ? r.y : s.H / 2;
      if (br.type === 'live') {
        const got = spawnFry(f.sp, n, x, y, f.variant, family);
        if (got) { addPoints(REWARDS.birth, x, y - 30); audio.playFanfare(); say('birth', VOICE.aquaBirth(sp)); showToast(`🍼 ${f.name || sp.name} 아기 ${got}마리가 태어났어요!`); }
      } else {
        game.eggs.push({ uid: newUid(), sp: f.sp, x: clamp(x / s.W, 0.05, 0.95), n, t: RATES.eggHatchSec, variant: f.variant, family });
        audio.playPopSound();
        say('eggs', VOICE.aquaEggs(sp));
        showToast(`🥚 ${f.name || sp.name} 이(가) 알 ${n}개를 낳았어요!`);
      }
      saveGame(game);
    };

    const tickCare = (dt) => {
      const groundFood = s.food.filter(f => f.state === 'ground').length;
      game.dirt = Math.min(100, game.dirt + (RATES.dirtPerSec + game.poop.length * 0.004 + groundFood * 0.01) * dt);
      // 물이 더러우면 유리에 이끼가 낀다
      if (game.dirt > 35 && game.algae < 60) {
        s.algaeT = (s.algaeT || 0) + dt;
        if (s.algaeT > 30 - game.dirt / 5) { s.algaeT = 0; game.algae++; s.algae.push(makeAlgaeSpot()); s.overlayKey = ''; }
      }
      game.fish.forEach(f => {
        const sp = FISH_BY_ID[f.sp]; if (!sp) return;
        f.full = Math.max(0, f.full - RATES.fullDropPerSec * (s.night ? 0.5 : 1) * dt);
        const comfy = f.full > 60 && game.dirt < 40;
        f.happy = clamp(f.happy + (comfy ? 0.6 : -RATES.happyDropPerSec * (isSad(f, game.dirt) ? 2 : 1)) * dt, 0, 100);
        const before = stageOf(f.growth);
        f.growth = Math.min(1, f.growth + RATES.growPerSec * sp.growMul * growFactor(f, game.dirt) * dt);
        const after = stageOf(f.growth);
        if (after !== before) {
          const r = s.rt[f.uid];
          addPoints(after === 'adult' ? REWARDS.adult : REWARDS.juvenile, r ? r.x : s.W / 2, r ? r.y - 30 : s.H / 2);
          audio.playFanfare();
          say('grow', VOICE.aquaGrow(sp, after));
          if (r) for (let i = 0; i < 16; i++) s.pops.push({ x: r.x + (Math.random() - 0.5) * 60, y: r.y + (Math.random() - 0.5) * 40, text: i % 2 ? '✨' : '⭐', life: 1.2, vy: -40 });
        }
        // 가끔 랜덤으로 아프다 (배고프거나 물이 더러우면 더 잘 아픔). 아프면 자라지 않는다
        if (!f.sick && s.t > 20 && game.fish.filter(fi => fi.sick).length < RATES.sickMax &&
            Math.random() < RATES.sickPerSec * (f.full < 25 || game.dirt > 70 ? 3 : 1) * dt) {
          f.sick = true;
          saveGame(game);
          audio.playFreq(330, 'sine', 0.25, 0.3);
          say('sick', VOICE.aquaSick(sp), 8);
          showToast(`🩹 ${f.name || sp.name}${f.name ? ` (${sp.name})` : ''} 이(가) 아파요! 밴드를 붙여 주세요`);
        }
        // 번식: 짝이 있고 컨디션이 좋으면 가끔 아기(알)를 갖고, 배가 점점 불러서 낳는다
        if (f.preg != null) {
          f.preg += dt / RATES.pregSec;
          if (f.preg >= 1) deliver(f);
        } else {
          const ms = mateStatus(game, f);
          if (ms && Math.random() < RATES.pregPerSec * (ms === 'solo' ? RATES.pregSoloMul : 1) * dt) {
            f.preg = 0;
            if (ms === 'pair') {
              // 아빠: 어항에 있는 같은 종류의 다 큰 수컷 중 하나 (난태생은 기억해 두었다가 혼자일 때도 아빠로)
              const males = game.fish.filter(o => o.sp === f.sp && o.sex === 'm' && stageOf(o.growth) === 'adult' && !o.sick);
              f.lastMate = males[Math.floor(Math.random() * males.length)].uid;
              f.mated = true;
            }
            f.pregDad = f.lastMate;
            const rr = s.rt[f.uid];
            if (rr) for (let i = 0; i < 6; i++) s.pops.push({ x: rr.x + (Math.random() - 0.5) * 40, y: rr.y - 10, text: '💕', life: 1.2, vy: -30 });
            say('preg', VOICE.aquaPregnant(sp, breedOf(f.sp).type), 5);
            saveGame(game);
          }
        }
        // 다 큰 물고기가 기분 좋으면 가끔 반짝 조개를 떨어뜨린다
        const r = s.rt[f.uid];
        if (r && f.shiny) {
          r.sparkT = (r.sparkT ?? Math.random()) - dt;
          if (r.sparkT <= 0) { r.sparkT = 0.5 + Math.random() * 0.6; s.pops.push({ x: r.x + (Math.random() - 0.5) * 30, y: r.y + (Math.random() - 0.5) * 20, text: '✨', life: 0.7, vy: -18 }); }
        }
        if (r && after === 'adult' && !isSad(f, game.dirt) && s.pearls.length < 4) {
          r.pearlT -= dt;
          if (r.pearlT <= 0) { r.pearlT = 70 + Math.random() * 60; s.drops.push({ kind: 'pearl', x: r.x, y: r.y, vy: 30 }); }
        }
      });
      // 알 깨어나기
      if (game.eggs.length) {
        const hatched = [];
        game.eggs.forEach(e => { e.t -= dt; if (e.t <= 0) hatched.push(e); });
        if (hatched.length) {
          game.eggs = game.eggs.filter(e => !hatched.includes(e));
          hatched.forEach(e => {
            const x = e.x * s.W;
            const n = spawnFry(e.sp, e.n, x, groundY(x) - 14, e.variant, e.family);
            if (n) { addPoints(REWARDS.birth, x, groundY(x) - 40); audio.playFanfare(); say('hatch', VOICE.aquaHatch(FISH_BY_ID[e.sp])); }
          });
          saveGame(game);
        }
      }
      // 돌봄 알림 음성 (너무 자주 말하지 않게)
      const avgFull = game.fish.length ? game.fish.reduce((a, f) => a + f.full, 0) / game.fish.length : 100;
      if (avgFull < 30) say('hungry', VOICE.aquaHungry(), 90);
      else if (game.dirt > 65) say('dirty', VOICE.aquaDirty(), 90);
    };

    // ── 물고기 움직임 (Boids + 먹이 쫓기 + 손가락 따라오기) ──
    const updateFish = (dt) => {
      const list = game.fish;
      const p = s.pointer;
      const following = modeRef.current === 'play' && p.down && !p.drag && s.t - p.downAt > 0.3;
      const top = s.surface + 14, bottom = s.floor - 8;
      list.forEach(f => {
        const r = s.rt[f.uid]; const sp = FISH_BY_ID[f.sp];
        if (!r || !sp) return;
        if (r.leaving != null) {
          r.leaving += dt;
          r.vx += (Math.sin(r.leaving * 3) * 40 - r.vx) * dt * 2;
          r.vy += (-90 * s.k - r.vy) * dt * 2;
          r.x = clamp(r.x + r.vx * dt, 6, s.W - 6); r.y += r.vy * dt;
          r.phase += dt * 12; r.dir = r.vx >= 0 ? 1 : -1;
          if (Math.random() < 0.3) s.pops.push({ x: r.x + (Math.random() - 0.5) * 30, y: r.y, text: '✨', life: 0.8, vy: -30 });
          if (r.leaving > 2.6 || r.y < s.surface - 10) r.gone = true;
          return;
        }
        const L = fishLen(f);
        const sad = isSad(f, game.dirt);
        let fx = 0, fy = 0, ax = 0, ay = 0, cx = 0, cy = 0, cnt = 0;
        list.forEach(o => {
          if (o === f) return;
          const q = s.rt[o.uid]; if (!q) return;
          const dx = q.x - r.x, dy = q.y - r.y, d2 = dx * dx + dy * dy;
          const sep = (L + fishLen(o)) * 0.45;
          if (d2 < sep * sep && d2 > 0.01) { const d = Math.sqrt(d2); fx -= dx / d * (sep - d) * 6; fy -= dy / d * (sep - d) * 6; }
          if (sp.school && o.sp === f.sp && d2 < 130 * 130) { ax += q.vx; ay += q.vy; cx += q.x; cy += q.y; cnt++; }
        });
        if (cnt) { fx += (ax / cnt - r.vx) * 1.2 + (cx / cnt - r.x) * 0.7; fy += (ay / cnt - r.vy) * 1.2 + (cy / cnt - r.y) * 0.7; }
        // 혼자 다니는 물고기는 천천히 배회
        r.wander = (r.wander ?? Math.random() * 6) + (Math.random() - 0.5) * dt * 2;
        fx += Math.cos(r.wander) * 40; fy += Math.sin(r.wander) * 18;
        // 머무는 높이
        const span = bottom - top;
        const pref = sad ? bottom - span * 0.15 : sp.zone === 'bottom' ? bottom - (sp.lieDown ? 2 : 12) : sp.zone === 'top' ? top + span * 0.18 : null;
        if (pref != null) fy += (pref - r.y) * 0.9;
        // 벽
        const m = 40;
        if (r.x < m) fx += (m - r.x) * 6; if (r.x > s.W - m) fx -= (r.x - (s.W - m)) * 6;
        if (r.y < top + 20) fy += (top + 20 - r.y) * 7; if (r.y > bottom - 10) fy -= (r.y - (bottom - 10)) * 7;
        // 먹이 쫓기: 배고플수록(hunger 0~1) 멀리서 알아채고, 더 세게·더 빨리 달려든다.
        // 많이 배고픈 물고기는 수면에 떠 있는 먹이도 바로 낚아챈다.
        // 바닥을 기는 친구(게·불가사리)는 바닥에 내려온 밥만 먹는다 (좌우 거리만 본다)
        const hunger = clamp((100 - f.full) / 100, 0, 1);
        const reach = 220 + hunger * 1000;
        let target = null, td = reach * reach;
        s.food.forEach(fd => {
          if (fd.state === 'float' && hunger < 0.12) return;   // 배고픈 물고기는 수면 밥도 찾아간다
          if (sp.crawl && !(fd.state === 'ground' || fd.y > bottom - 50)) return;
          const dx = fd.x - r.x, dy = sp.crawl ? 0 : fd.y - r.y, d2 = dx * dx + dy * dy;
          if (d2 < td) { td = d2; target = fd; }
        });
        // 배고프면 슬퍼도 밥 앞에서는 힘을 낸다
        let maxSp = 70 * sp.speed * (1 + r.panic * 1.6) * (sad && !(target && hunger > 0.5) ? 0.5 : 1) * (0.7 + 0.3 * sizeScale(f.growth)) * s.k;
        const chasing = !!target && f.full < 98 && (hunger > 0.12 || td < 110 * 110);
        if (chasing) {
          const dx = target.x - r.x, dy = sp.crawl ? 0 : target.y - r.y, d = Math.sqrt(td) || 1;
          const pull = 360 + hunger * 1100;
          fx += dx / d * pull; fy += dy / d * pull;
          maxSp *= 1.3 + hunger * 1.9;
          r.eager = hunger;
          if (pref != null) fy -= (pref - r.y) * 0.9;   // 밥을 쫓을 때는 머무는 높이(바닥·슬픔)에 끌려가지 않게
          if (target.y < top + 20) fy -= (top + 20 - Math.max(r.y, top)) * 7;   // 수면 밥: 위쪽 벽 힘 상쇄
          if (d < Math.max(14 * s.k, L * 0.6)) {
            target.eaten = true;
            const wasHungry = f.full < 70;
            f.full = Math.min(100, f.full + 9); f.happy = Math.min(100, f.happy + 2);
            r.poopDue += 1; r.happyT = 1.2;
            if (wasHungry) addPoints(REWARDS.eat, r.x, r.y - 16);
            s.pops.push({ x: r.x + 8, y: r.y - 10, text: '💗', life: 0.9, vy: -30 });
            if (s.t - s.lastYum > 0.12) { s.lastYum = s.t; audio.playFreq(820 + Math.random() * 420, 'sine', 0.07, 0.22); }
            if (r.poopDue >= 4) { r.poopDue = 0; s.drops.push({ kind: 'poop', uid: f.uid, x: r.x, y: r.y, vy: 6, delay: 2 + Math.random() * 3 }); }
          }
        } else if (s.shaker && hunger > 0.3) {
          const dx = s.shaker.x - r.x, dy = (s.surface + 30) - r.y, d = Math.hypot(dx, dy) || 1;
          fx += dx / d * (300 + hunger * 600); fy += dy / d * (300 + hunger * 600);
          maxSp *= 1.2 + hunger;
        } else if (sp.algaeEater && s.algae.length) {
          // 비파: 가장 가까운 유리 이끼로 가서 냠냠 먹는다
          let ag = null, ad = Infinity;
          s.algae.forEach(a => { const d = Math.hypot(a.x - r.x, a.y - r.y); if (d < ad) { ad = d; ag = a; } });
          if (ag) {
            if (pref != null) fy -= (pref - r.y) * 0.9;   // 바닥으로 끌려가지 않게
            fx += (ag.x - r.x) / (ad || 1) * 260; fy += (ag.y - r.y) / (ad || 1) * 260;
            if (ad < ag.r + 12) {
              ag.eat = (ag.eat || 0) + dt;
              r.vx *= 0.9; r.vy *= 0.9;
              if (ag.eat > 2.5) {
                s.algae = s.algae.filter(a => a !== ag);
                game.algae = s.algae.length;
                game.dirt = Math.max(0, game.dirt - 0.6);
                f.full = Math.min(100, f.full + 6); f.happy = Math.min(100, f.happy + 3);
                s.pops.push({ x: ag.x, y: ag.y, text: '😋', life: 1, vy: -24 });
                s.overlayKey = '';
              }
            }
          }
        } else if (following) {
          const dx = p.x - r.x, dy = p.y - r.y, d = Math.hypot(dx, dy) || 1;
          if (d < 460) { const pull = d > 45 ? 380 : -140; fx += dx / d * pull - dy / d * 60; fy += dy / d * pull + dx / d * 60; }
        }
        // 밤에 한동안 아무도 만지지 않으면 잔다: 밥을 쫓거나 놀란 게 아니면 아래쪽 자기 자리에서 거의 움직이지 않는다
        const asleep = s.sleeping && !chasing && r.panic < 0.05;
        r.asleep = asleep;
        // 아직 다 크지 않은 아기는 엄마가 어항에 있으면 엄마 뒤를 졸졸 따라다닌다
        const momRt = f.mom && f.growth < 0.8 && s.rt[f.mom] && s.rt[f.mom].leaving == null ? s.rt[f.mom] : null;
        if (asleep) {
          if (momRt && momRt.sleepY != null) {
            // 밤에는 엄마 바로 옆에서 잔다
            if (r.sleepOff == null) r.sleepOff = (Math.random() - 0.5) * 50 * s.k;
            r.sleepY = momRt.sleepY + 8 * s.k;
            fx = fx * 0.12 + (momRt.x + r.sleepOff - r.x) * 0.8;
          } else if (r.sleepY == null) r.sleepY = bottom - span * (0.08 + Math.random() * 0.4);
          if (!momRt) fx *= 0.12;
          fy = fy * 0.12 + (r.sleepY - r.y) * 0.8;
          maxSp *= 0.25;
        } else {
          r.sleepY = null;
          if (momRt && !chasing) {
            const tx = momRt.x - (momRt.dir || 1) * (momRt.drawL || 30) * 0.9, ty = momRt.y + (r.phase % 1 - 0.5) * 12;
            const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy) || 1;
            if (d > 22 * s.k) { fx += dx / d * Math.min(260, d * 2.2); fy += dy / d * Math.min(260, d * 2.2); }
          }
        }
        fx += s.tilt.x * 140; fy += s.tilt.y * 80;
        // 해파리는 갓을 오므릴 때 뿅 떠올랐다가 천천히 가라앉는다 (그림의 오므림과 박자를 맞춤)
        if (sp.shape === 'jellyfish' && !asleep) fy += Math.sin(r.phase * 0.5) < -0.6 ? -160 : 30;
        // 광어는 먹이가 없으면 바닥에 납작 엎드려 거의 움직이지 않는다
        const resting = sp.lieDown && !target && !following;
        if (resting) { fx *= 0.2; fy = fy * 0.2 + (bottom - 2 - r.y) * 3; }   // 바닥으로는 확실히 내려앉게

        if (sp.crawl) { fy = 0; r.vy = 0; }   // 기는 친구는 좌우로만 움직인다
        r.vx += fx * dt; r.vy += fy * dt;
        if (resting || asleep) { r.vx *= 1 - Math.min(1, dt * 1.2); r.vy *= 1 - Math.min(1, dt * 1.2); }
        const spd = Math.hypot(r.vx, r.vy) || 1, minSp = resting || asleep ? 0 : 14 * s.k;
        if (spd > maxSp) { r.vx *= maxSp / spd; r.vy *= maxSp / spd; } else if (spd < minSp) { r.vx *= minSp / spd; r.vy *= minSp / spd; }
        r.panic = Math.max(0, r.panic - dt);
        r.puffT = Math.max(0, (r.puffT || 0) - dt);
        r.puffNow = (r.puffNow || 0) + ((r.puffT > 0 ? 1 : 0) - (r.puffNow || 0)) * Math.min(1, dt * 5);
        r.boing = Math.max(0, r.boing - dt * 1.8);
        r.happyT = Math.max(0, r.happyT - dt);
        // 밥을 쫓을 때는 수면·바닥 가까이까지 갈 수 있다
        const yLo = chasing ? Math.min(top, target.y + 2) : top, yHi = chasing ? Math.max(bottom, target.y - 3) : bottom;
        r.x = clamp(r.x + r.vx * dt, 6, s.W - 6); r.y = clamp(r.y + r.vy * dt, yLo, yHi);
        if (sp.crawl) r.y = groundY(r.x) - L * sp.hRatio * 0.42;   // 모래 위에 발을 딛고
        r.phase += dt * (5 + spd * 0.12 / s.k) * (sad ? 0.6 : 1) * (asleep ? 0.3 : 1) * (1 + (r.eager || 0) * 0.8);
        r.eager = Math.max(0, (r.eager || 0) - dt);
        // 진행 방향 (좌우가 자주 바뀌지 않게)
        if (r.vx > 5) r.dir = 1; else if (r.vx < -5) r.dir = -1; else r.dir = r.dir || 1;
      });
      s.food = s.food.filter(fd => !fd.eaten);
      // 자연으로 떠난 물고기 정리
      const goneUids = list.filter(f => s.rt[f.uid] && s.rt[f.uid].gone).map(f => f.uid);
      if (goneUids.length) {
        game.fish = game.fish.filter(f => !goneUids.includes(f.uid));
        goneUids.forEach(uid => { delete s.rt[uid]; });
        saveGame(game);
      }
    };

    // ── 먹이·거품·떨어지는 것들 ──
    const updateParticles = (dt) => {
      if (s.shaker) {
        const sh = s.shaker;
        sh.t += dt;
        if (!sh.dropped && sh.t > 0.2) {
          sh.dropped = true;
          spawnFood(sh.x, clamp(Math.round(game.fish.length * 1.5), 4, 16));
          for (let i = 0; i < 3; i++) audio.playFreq(2200 + Math.random() * 900, 'triangle', 0.03, 0.07);
        }
        if (sh.t > sh.dur) s.shaker = null;
      }
      s.food.forEach(fd => {
        if (fd.state === 'float') {
          fd.t -= dt; fd.y = s.surface + 3 + Math.sin(s.t * 3 + fd.rot) * 1.5; fd.x += (fd.vx + s.tilt.x * 20) * dt;
          if (fd.t <= 0) { fd.state = 'sink'; fd.vy = 16 + Math.random() * 12; }
        } else if (fd.state === 'sink') {
          fd.y += fd.vy * dt; fd.x += (Math.sin(s.t * 2 + fd.rot) * 10 + s.tilt.x * 30) * dt; fd.rot += dt;
          const gy = groundY(fd.x) + 4;
          if (fd.y >= gy) { fd.y = gy; fd.state = 'ground'; }
        } else {
          fd.life -= dt;
          if (fd.life <= 0) { fd.eaten = true; game.dirt = Math.min(100, game.dirt + 1.5); }
        }
        fd.x = clamp(fd.x, 6, s.W - 6);
      });
      s.food = s.food.filter(fd => !fd.eaten);

      s.drops.forEach(d => {
        if (d.delay > 0) {
          d.delay -= dt;
          // 똥은 시간이 지난 뒤 그 물고기의 지금 꼬리 쪽에서 떨어진다
          const r = d.uid && s.rt[d.uid];
          const f = r && game.fish.find(fi => fi.uid === d.uid);
          if (f && r.leaving == null) {
            const L = fishLen(f), ang = r.drawAng || 0, dir = r.dir || 1;
            d.x = r.x - Math.cos(ang) * L * 0.42 * dir;
            d.y = r.y - Math.sin(ang) * L * 0.42 + L * 0.06;
            d.vx = r.vx * 0.3;
          }
          return;
        }
        if (d.vx) { d.x += d.vx * dt; d.vx *= 1 - Math.min(1, dt * 2.5); }
        d.y += d.vy * dt; d.vy = Math.min(60, d.vy + 20 * dt);
        if (d.y >= groundY(d.x) + 2) {
          d.done = true;
          if (d.kind === 'poop' && game.poop.length < 30) game.poop.push({ x: d.x, dy: 2 + Math.random() * 8 });
          if (d.kind === 'pearl') s.pearls.push({ x: d.x, y: groundY(d.x) - 6, life: 40 });
        }
      });
      s.drops = s.drops.filter(d => !d.done);
      s.pearls.forEach(p => { p.life -= dt; });
      s.pearls = s.pearls.filter(p => p.life > 0);

      // 기포돌·잠수부·보물상자 거품
      game.decor.forEach(d => {
        const rt = s.decorRt[d.uid] || (s.decorRt[d.uid] = { acc: Math.random() * 3, open: 0, cycle: Math.random() * 9 });
        const x = d.x * s.W, y = groundY(x);
        if (d.id === 'airstone') {
          rt.acc += dt;
          while (rt.acc > 0.07) { rt.acc -= 0.07; s.bubbles.push({ x: x + (Math.random() - 0.5) * 8, y: y - 10 * s.k, r: 1.5 + Math.random() * 2.5, wob: Math.random() * 6, vy: 70 + Math.random() * 30, grow: 1 }); }
        } else if (d.id === 'diver') {
          rt.acc += dt;
          if (rt.acc > 2.2) { rt.acc = 0; for (let i = 0; i < 4; i++) s.bubbles.push({ x: x + 3 * s.k, y: y - 90 * s.k - i * 8, r: 2 + Math.random() * 3, wob: Math.random() * 6, vy: 55 }); }
        } else if (d.id === 'chest') {
          rt.cycle += dt;
          const ph = rt.cycle % 9;
          const want = ph > 6 ? 1 : 0;
          rt.open += (want - rt.open) * Math.min(1, dt * 3);
          if (ph > 6 && ph - dt <= 6) for (let i = 0; i < 10; i++) s.bubbles.push({ x: x + (Math.random() - 0.5) * 40 * s.k, y: y - 40 * s.k, r: 2 + Math.random() * 5, wob: Math.random() * 6, vy: 60 + Math.random() * 40 });
        }
      });
      // 바닥 틈 사이로 가끔 올라오는 거품
      s.bubbleT -= dt;
      if (s.bubbleT <= 0) { s.bubbleT = 0.5 + Math.random() * 0.9; const x = Math.random() * s.W; s.bubbles.push({ x, y: groundY(x), r: 1.5 + Math.random() * 3, wob: Math.random() * 6, vy: 40 + Math.random() * 30 }); }
      s.bubbles.forEach(b => {
        b.wob += dt * 3; b.y -= (b.vy + b.r * 4) * dt; b.x += (Math.sin(b.wob) * 16 - s.tilt.x * 40) * dt;
        if (b.grow) b.r = Math.min(6, b.r + dt * 0.8);
        if (b.y <= s.surface + 2) { b.pop = true; s.ripples.push({ x: b.x, y: s.surface + 1, r: 2, life: 0.5, flat: true }); }
      });
      s.bubbles = s.bubbles.filter(b => !b.pop).slice(-220);
      s.ripples.forEach(r => { r.r += (r.flat ? 40 : 170) * dt; r.life -= dt * 1.4; });
      s.ripples = s.ripples.filter(r => r.life > 0).slice(-60);
      s.pops.forEach(p => { p.y += p.vy * dt; p.life -= dt; });
      s.pops = s.pops.filter(p => p.life > 0).slice(-60);

      // 물갈이 애니메이션: 물 높이가 내려갔다가 다시 차오른다
      if (s.waterChange) {
        const w = s.waterChange;
        w.t += dt;
        const low = s.surfaceBase + (s.floor - s.surfaceBase) * 0.42;
        if (w.t < 1.6) s.surface = s.surfaceBase + (low - s.surfaceBase) * Math.sin(Math.min(1, w.t / 1.6) * Math.PI / 2);
        else if (w.t < 3.4) {
          const q = (w.t - 1.6) / 1.8;
          s.surface = low - (low - s.surfaceBase) * (1 - Math.pow(1 - q, 2));
          if (Math.random() < 0.6) s.bubbles.push({ x: s.W * 0.15 + Math.random() * 30, y: s.surface + 6, r: 2 + Math.random() * 4, wob: Math.random() * 6, vy: -80 });
          if (!w.cleaned && q > 0.2) {
            w.cleaned = true;
            const was = game.dirt;
            game.dirt = 0; s.overlayKey = '';
            if (was >= 25) addPoints(REWARDS.waterChange, s.W / 2, s.H / 2);
            game.fish.forEach(f => { f.happy = Math.min(100, f.happy + 20); });
          }
        } else {
          s.surface = s.surfaceBase; s.waterChange = null;
          audio.playFanfare();
          say('water', VOICE.aquaWaterChange());
        }
      }
    };
    // 물고기 한 마리를 자연으로 보낸다 (마지막 한 마리는 남겨 둔다)
    s.releaseFish = (uid) => {
      const f = game.fish.find(it => it.uid === uid);
      const r = s.rt[uid];
      if (!f || !r || r.leaving != null) return false;
      const staying = game.fish.filter(it => s.rt[it.uid] && s.rt[it.uid].leaving == null);
      if (staying.length <= 1) { showToast('🐟 마지막 친구는 어항에 남겨 둬요!'); return false; }
      r.leaving = 0;
      // 아기들이 떠난 엄마·아빠의 지금 이름을 기억하게
      if (f.name) game.fish.forEach(k => { if (k.mom === f.uid) k.momName = f.name; if (k.dad === f.uid) k.dadName = f.name; });
      audio.playFanfare();
      say('release', VOICE.aquaRelease(FISH_BY_ID[f.sp]));
      return true;
    };
    // 조명: 3단(기본) → 꺼짐 → 1단 → 2단 → 3단
    s.toggleLight = () => {
      s.light = (s.light + 1) % 4;
      audio.playFreq(s.light ? 660 + s.light * 160 : 330, 'triangle', 0.08, 0.35);
      return s.light;
    };
    s.startWaterChange = () => {
      if (s.waterChange) return;
      if (game.dirt < 8) { showToast('💧 물이 아직 깨끗해요!'); return; }
      s.waterChange = { t: 0, cleaned: false };
      audio.playBubble();
    };

    // ── 그리기 ──
    const draw = () => {
      const { W, H, t, k } = s;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.drawImage(game.decor.some(d => d.id === 'grass' || d.id === 'sword') ? s.backdrop : s.backdropPlain, 0, 0, W, H);

      // 수면 위 공기 (물갈이 중엔 내려간다)
      const ag = ctx.createLinearGradient(0, 0, 0, s.surface);
      ag.addColorStop(0, '#e0f2fe'); ag.addColorStop(1, '#bae6fd');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
      for (let x = W; x >= 0; x -= 14) ctx.lineTo(x, s.surface + Math.sin(x * 0.035 + t * 2.2) * 1.6 + s.tilt.x * (x - W / 2) * 0.04);
      ctx.closePath(); ctx.fill();

      const flow = s.tilt.x;
      // 장식 (수초·바위 등) – 자갈보다 먼저 그려 밑동이 자갈에 묻히게
      game.decor.forEach(d => { const x = d.x * W; drawDecor(ctx, d.id, x, groundY(x) + 8, k, t, s.decorRt[d.uid], flow); });
      ctx.drawImage(s.gravel, 0, 0, W, H);
      // 장식 밑동 그림자: 바닥에 단단히 붙어 보이게
      game.decor.forEach(d => {
        const x = d.x * W, box = DECOR_BOX[d.id]; if (!box) return;
        const rw = box[0] * k * 0.62, gy = groundY(x) + 5;
        const sh = ctx.createRadialGradient(x, gy, 1, x, gy, rw);
        sh.addColorStop(0, 'rgba(15,23,42,0.34)'); sh.addColorStop(1, 'rgba(15,23,42,0)');
        ctx.save(); ctx.translate(x, gy); ctx.scale(1, 0.22); ctx.translate(-x, -gy);
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x, gy, rw, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // 똥, 바닥 먹이, 조개
      game.poop.forEach(p => {
        const y = groundY(p.x) + p.dy;
        ctx.fillStyle = '#6b4423';
        ctx.beginPath(); ctx.ellipse(p.x, y, 4.5 * k, 2.6 * k, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x + 5 * k, y + 1, 3 * k, 2 * k, -0.2, 0, Math.PI * 2); ctx.fill();
      });
      // 바닥의 알 무더기: 깨어날 때가 되면 눈이 보이고 꼼지락거린다
      (game.eggs || []).forEach(e => {
        const ex = e.x * s.W, ey = groundY(ex) - 3 * k;
        const ready = 1 - clamp(e.t / RATES.eggHatchSec, 0, 1);
        for (let i = 0; i < e.n + 3; i++) {
          const a = i * 2.399, rr = Math.sqrt(i) * 4.2 * k;
          const jig = ready > 0.85 ? Math.sin(t * 20 + i) * 0.8 * k : 0;
          const px = ex + Math.cos(a) * rr * 1.4 + jig, py = ey - Math.abs(Math.sin(a)) * rr * 0.6;
          ctx.fillStyle = 'rgba(254,243,199,0.85)'; ctx.strokeStyle = 'rgba(217,119,6,0.55)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(px, py, 3.2 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (ready > 0.5) { ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(px + 0.8 * k, py - 0.4 * k, 0.9 * k, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(px - 1 * k, py - 1 * k, 0.8 * k, 0, Math.PI * 2); ctx.fill(); }
        }
      });
      s.pearls.forEach(p => {
        const glow = 0.5 + 0.5 * Math.sin(t * 4 + p.x);
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 26 * k);
        g.addColorStop(0, `rgba(255,255,255,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 30 * k, p.y - 30 * k, 60 * k, 60 * k);
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath(); ctx.moveTo(p.x - 13 * k, p.y + 4 * k); ctx.quadraticCurveTo(p.x, p.y - 16 * k, p.x + 13 * k, p.y + 4 * k); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 1.3 * k;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(p.x, p.y + 4 * k); ctx.lineTo(p.x + i * 5 * k, p.y - 8 * k + Math.abs(i) * 3 * k); ctx.stroke(); }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y - 1 * k, 4.5 * k, 0, Math.PI * 2); ctx.fill();
      });

      // 물고기 그림자
      game.fish.forEach(f => {
        const r = s.rt[f.uid]; if (!r) return;
        const L = fishLen(f), gy = groundY(r.x) + 6, hgt = gy - r.y;
        const a = 0.22 * (1 - clamp(hgt / (H * 0.8), 0, 1));
        if (a < 0.02) return;
        ctx.fillStyle = `rgba(30,41,59,${a})`;
        ctx.beginPath(); ctx.ellipse(r.x + hgt * 0.08, gy, L * 0.45, L * 0.09 + 1, 0, 0, Math.PI * 2); ctx.fill();
      });

      // 먼 곳의 부유물 (물고기 뒤)
      // 한 번에 그린다 (경로 하나 + 칠하기 한 번)
      const drawMotes = (near) => {
        ctx.fillStyle = near ? 'rgba(224,242,254,0.3)' : 'rgba(224,242,254,0.16)';
        ctx.beginPath();
        s.motes.forEach(m => {
          if ((m.z >= 0.55) !== near) return;
          m.y -= (2 + m.z * 4) * m.sp * s.dtLast; m.x += Math.sin(t * 0.3 + m.ph) * 4 * s.dtLast + flow * 10 * s.dtLast;
          if (m.y < s.surface + 4) { m.y = s.floor - 4; m.x = Math.random() * W; }
          if (m.x < 0) m.x += W; if (m.x > W) m.x -= W;
          const rr = (0.6 + m.z * 1.6) * k;
          ctx.moveTo(m.x + rr, m.y); ctx.arc(m.x, m.y, rr, 0, Math.PI * 2);
        });
        ctx.fill();
      };
      if (s.fx) drawMotes(false);

      // 물고기 (멀리 있는 것부터). 먼 물고기와 가까운 물고기 사이에 옅은 물빛 안개를 깔아 깊이감을 준다
      const order = game.fish.filter(f => s.rt[f.uid]).sort((a, b) => s.rt[a.uid].z - s.rt[b.uid].z);
      let hazed = false;
      const badges = [];
      const haze = () => {
        hazed = true;
        const hg = ctx.createLinearGradient(0, s.surface, 0, s.floor);
        hg.addColorStop(0, 'rgba(56,189,248,0.04)'); hg.addColorStop(1, 'rgba(12,74,110,0.12)');
        ctx.fillStyle = hg; ctx.fillRect(0, s.surface, W, s.floor - s.surface);
      };
      order.forEach(f => {
        const r = s.rt[f.uid], sp = FISH_BY_ID[f.sp]; if (!sp) return;
        if (!hazed && r.z >= 0.55) haze();
        const L = fishLen(f) * (0.82 + r.z * 0.18) * (1 + Math.sin(r.boing * Math.PI) * 0.25);
        ctx.save();
        ctx.translate(r.x, r.y);
        const ang = sp.lieDown || sp.crawl || sp.upright ? 0 : clamp(Math.atan2(r.vy, Math.abs(r.vx) + 8) * 0.6, -0.6, 0.6);
        r.drawL = L; r.drawAng = ang;
        ctx.scale(r.dir, 1);
        ctx.rotate(ang * 1);
        ctx.globalAlpha = (0.72 + r.z * 0.28) * (r.leaving != null ? clamp(1 - r.leaving / 2.6, 0, 1) : 1);
        const belly = f.preg != null ? Math.pow(f.preg, 0.8) : 0;
        drawFish(ctx, lookOf(sp, f), L, { phase: r.phase, growth: f.growth, sad: isSad(f, game.dirt), happy: r.happyT > 0, detail: L > 26, puff: r.puffNow || 0, belly, sleep: !!r.asleep, gloss: s.fx === 1, lit: s.lampNow, gravidSpot: breedOf(f.sp).type === 'live' });
        ctx.restore();
        // 아픈 물고기 위에는 상단 치료 버튼과 똑같은 모양(분홍 동그라미 + 반창고)을 띄운다 (다른 물고기에 가리지 않게 맨 나중에)
        if (f.sick) badges.push(() => {
          const size = Math.max(30, L * 0.75) * (modeRef.current === 'heal' ? 1 + Math.sin(s.t * 6) * 0.08 : 1);
          drawBandageBadge(ctx, r.x, r.y - L * 0.5 - size * 0.55 + Math.sin(s.t * 3 + r.phase) * 3, size);
          // 치료 모드에서는 아픈 물고기를 빨간 원으로 알려준다
          if (modeRef.current === 'heal') {
            ctx.strokeStyle = `rgba(239,68,68,${0.6 + Math.sin(s.t * 6) * 0.3})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(r.x, r.y, L * 0.7 + 8, 0, Math.PI * 2); ctx.stroke();
          }
        });
        if (info === f.uid) {
          ctx.strokeStyle = 'rgba(254,240,138,0.9)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(r.x, r.y, L * 0.7 + 6, 0, Math.PI * 2); ctx.stroke();
        }
      });

      if (!hazed) haze();
      // 조명 빛: 흰빛을 덧칠하면 뿌옇게 들뜨므로 소프트 라이트로 밝혀 대비와 색을 살린다
      if (s.lampNow > 0.02) {
        const lk = s.lampNow;
        ctx.globalCompositeOperation = 'soft-light';
        const lc = ctx.createRadialGradient(W / 2, s.surface - H * 0.1, 10, W / 2, s.surface + H * 0.3, H * 1.1);
        lc.addColorStop(0, `rgba(255,244,214,${0.55 * lk})`); lc.addColorStop(0.55, `rgba(255,244,214,${0.25 * lk})`); lc.addColorStop(1, 'rgba(255,244,214,0)');
        ctx.fillStyle = lc; ctx.fillRect(0, s.surface, W, H - s.surface);
        ctx.globalCompositeOperation = 'source-over';
      }
      badges.forEach(fn => fn());
      if (s.fx) drawMotes(true);

      // 떨어지는 먹이·똥·조개
      s.food.forEach(fd => {
        ctx.save(); ctx.translate(fd.x, fd.y); ctx.rotate(fd.rot);
        ctx.fillStyle = fd.color; ctx.fillRect(-2.6 * k, -1.8 * k, 5.2 * k, 3.6 * k);
        ctx.restore();
      });
      s.drops.forEach(d => {
        if (d.delay > 0) return;
        ctx.fillStyle = d.kind === 'pearl' ? '#ffffff' : '#6b4423';
        ctx.beginPath(); ctx.arc(d.x, d.y, (d.kind === 'pearl' ? 4.5 : 3) * k, 0, Math.PI * 2); ctx.fill();
      });

      // 거품
      s.bubbles.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2); ctx.fill();
      });

      // 유리 가까이 지나가는 흐릿한 빛망울 (초점이 안 맞은 듯한 깊이감)
      if (s.fx) s.bokeh.forEach(b => {
        b.y -= 3 * s.dtLast; b.x += Math.sin(t * 0.2 + b.ph) * 6 * s.dtLast;
        if (b.y < s.surface + b.r) { b.y = s.floor - b.r; b.x = Math.random() * W; }
        const a = 0.05 + 0.03 * Math.sin(t * 0.7 + b.ph);
        const bg = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r * k);
        bg.addColorStop(0, `rgba(240,249,255,${a})`); bg.addColorStop(0.7, `rgba(240,249,255,${a * 0.6})`); bg.addColorStop(1, 'rgba(240,249,255,0)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * k, 0, Math.PI * 2); ctx.fill();
      });

      // 수면 바로 아래 일렁이는 빛줄 (수면이 빛을 굴절시키는 느낌)
      ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let j = 0; j < (s.fx ? 3 : 0); j++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.16 - j * 0.04})`;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 18) {
          const y = s.surface + (7 + j * 9) * k + Math.sin(x * (0.02 + j * 0.007) + t * (1.3 - j * 0.25) + j * 2) * (2 + j) + Math.sin(x * 0.051 - t * 1.7) * 1.2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 수면 아래 반사 띠 & 수면선
      const ug = ctx.createLinearGradient(0, s.surface, 0, s.surface + 16);
      ug.addColorStop(0, 'rgba(255,255,255,0.35)'); ug.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ug; ctx.fillRect(0, s.surface, W, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 14) {
        const y = s.surface + Math.sin(x * 0.035 + t * 2.2) * 1.6 + s.tilt.x * (x - W / 2) * 0.04;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 물결 링
      s.ripples.forEach(r => {
        ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.7})`; ctx.lineWidth = 2.5 * r.life + 0.8;
        ctx.beginPath();
        if (r.flat) ctx.ellipse(r.x, r.y, r.r, r.r * 0.25, 0, 0, Math.PI * 2); else ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 먹이통
      if (s.shaker) {
        const sh = s.shaker, y = s.surface - 30 * k;
        ctx.save(); ctx.translate(sh.x, y); ctx.rotate(2.3 + Math.sin(sh.t * 26) * 0.25);
        ctx.fillStyle = '#f97316'; ctx.fillRect(-14 * k, -22 * k, 28 * k, 40 * k);
        ctx.fillStyle = '#fef3c7'; ctx.fillRect(-14 * k, -6 * k, 28 * k, 12 * k);
        ctx.fillStyle = '#334155'; ctx.fillRect(-15 * k, 16 * k, 30 * k, 6 * k);
        ctx.restore();
      }

      // 떠오르는 글자 (+1 🐚, 💗, ✨)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      s.pops.forEach(p => {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.font = `900 ${Math.round(16 * k)}px system-ui, sans-serif`;
        if (p.color) { ctx.strokeStyle = 'rgba(15,23,42,0.6)'; ctx.lineWidth = 3; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; }
        else ctx.fillStyle = '#ffffff';
        ctx.fillText(p.text, p.x, p.y);
      });
      ctx.globalAlpha = 1;

      // 청소 스펀지
      if (modeRef.current === 'clean' && s.pointer.down) {
        ctx.fillStyle = 'rgba(250,204,21,0.9)'; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s.pointer.x - 24 * k, s.pointer.y - 16 * k, 48 * k, 32 * k, 8 * k) : ctx.rect(s.pointer.x - 24 * k, s.pointer.y - 16 * k, 48 * k, 32 * k);
        ctx.fill(); ctx.stroke();
      }
    };

    // 맨 위 레이어: 탁한 물·유리 이끼(값이 바뀔 때만 캐시에 다시 그림) → 어둠 → 야광
    const drawOverlay = () => {
      const key = `${Math.round(game.dirt / 2)}|${s.algae.length}|${Math.round(s.surface)}|${s.W}x${s.H}`;
      if (key !== s.overlayKey) {
        s.overlayKey = key;
        const ac = s.algaeCtx;
        ac.clearRect(0, 0, s.W, s.H);
        const d = game.dirt / 100;
        if (d > 0.05) {
          ac.fillStyle = `rgba(101,108,36,${Math.pow(d, 1.3) * 0.38})`;
          ac.fillRect(0, s.surface, s.W, s.H - s.surface);
        }
        s.algae.forEach(a => {
          for (let i = 0; i < a.blobs; i++) {
            const ang = a.seed + i * 2.1, rr = a.r * (0.45 + (i % 3) * 0.2);
            const bx = a.x + Math.cos(ang) * a.r * 0.5, by = a.y + Math.sin(ang) * a.r * 0.4;
            const g = ac.createRadialGradient(bx, by, 0, bx, by, rr);
            g.addColorStop(0, `rgba(77,124,15,${a.a})`); g.addColorStop(1, 'rgba(77,124,15,0)');
            ac.fillStyle = g;
            ac.beginPath(); ac.arc(bx, by, rr, 0, Math.PI * 2); ac.fill();
          }
        });
      }
      octx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      octx.clearRect(0, 0, s.W, s.H);
      octx.drawImage(s.algaeLayer, 0, 0, s.W, s.H);

      const dark = s.darkNow;
      // 자는 물고기 위로 z Z 가 피어오른다 (조명을 환하게 켜도 보이도록 테두리를 두른다)
      const drawZz = () => {
        octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.lineWidth = 2.5; octx.lineJoin = 'round';
        game.fish.forEach(f => {
          const r = s.rt[f.uid];
          if (!r || !r.asleep || !r.drawL) return;
          for (let j = 0; j < 2; j++) {
            const zt = (s.t * 0.45 + r.phase * 0.05 + j * 0.5) % 1;
            octx.globalAlpha = Math.sin(zt * Math.PI) * 0.9;
            octx.font = `900 ${Math.round(Math.max(10, r.drawL * 0.28) * (0.7 + zt * 0.6))}px system-ui, sans-serif`;
            const zx = r.x + r.dir * r.drawL * 0.25 + zt * 10, zy = r.y - r.drawL * 0.3 - zt * 26;
            octx.strokeStyle = 'rgba(15,23,42,0.45)'; octx.strokeText(j ? 'Z' : 'z', zx, zy);
            octx.fillStyle = '#e0f2fe'; octx.fillText(j ? 'Z' : 'z', zx, zy);
          }
        });
        octx.globalAlpha = 1;
      };
      // 조명: 수면에 비친 눈부신 반사 + 반짝이는 물결 (어항을 밝히는 빛은 본 캔버스에서 소프트 라이트로)
      const drawLamp = () => {
        const lk = s.lampNow; if (lk < 0.02) return;
        octx.globalCompositeOperation = 'lighter';
        const cx = s.W / 2, top = s.surface;
        // 수면에 비친 조명 (가로로 긴 눈부신 띠)
        octx.save(); octx.translate(cx, top + 3); octx.scale(1, 0.05);
        const glare = octx.createRadialGradient(0, 0, 0, 0, 0, s.W * 0.42);
        glare.addColorStop(0, `rgba(255,255,255,${0.5 * lk})`); glare.addColorStop(0.5, `rgba(255,255,255,${0.16 * lk})`); glare.addColorStop(1, 'rgba(255,255,255,0)');
        octx.fillStyle = glare; octx.beginPath(); octx.arc(0, 0, s.W * 0.42, 0, Math.PI * 2); octx.fill();
        octx.restore();
        // 수면 물결에 반짝이는 빛 조각
        octx.fillStyle = `rgba(255,255,255,${0.75 * lk})`;
        octx.beginPath();
        for (let i = 0; i < 18; i++) {
          const fx = ((i * 0.618 + s.t * 0.015 * (i % 3 + 1)) % 1);
          const x = cx + (fx - 0.5) * s.W * 0.8, tw = Math.max(0, Math.sin(s.t * (2 + i % 4) + i * 1.7));
          const w = (2 + tw * 5) * s.k * (1 - Math.abs(fx - 0.5) * 1.4);
          if (w <= 0.3) continue;
          octx.moveTo(x - w, top + 4); octx.ellipse(x, top + 4 + (i % 3) * 3, w, w * 0.25, 0, 0, Math.PI * 2);
        }
        octx.fill();
        octx.globalCompositeOperation = 'source-over';
      };
      if (dark < 0.01) { drawLamp(); drawZz(); return; }
      // 어둠 (조명 아래쪽은 덜 어둡게)
      const lampOn = s.light > 0;
      const g = octx.createRadialGradient(s.W / 2, 0, 10, s.W / 2, s.H * 0.3, Math.max(s.W, s.H) * 0.9);
      g.addColorStop(0, `rgba(2,8,28,${dark * (lampOn ? 0.45 : 1)})`);
      g.addColorStop(1, `rgba(2,8,28,${dark})`);
      octx.fillStyle = g;
      octx.fillRect(0, 0, s.W, s.H);

      drawZz();
      // 야광: 어두울수록 더 밝게 빛난다
      const gk = clamp(dark / MAX_DARK, 0, 1);
      octx.globalCompositeOperation = 'lighter';
      game.fish.forEach(f => {
        const r = s.rt[f.uid], sp = FISH_BY_ID[f.sp];
        if (!r || !sp || r.drawL == null) return;
        const look = lookOf(sp, f);
        const fade = r.leaving != null ? clamp(1 - r.leaving / 2.6, 0, 1) : 1;
        if (f.shiny) {
          const aura = octx.createRadialGradient(r.x, r.y, 2, r.x, r.y, r.drawL * 0.9);
          aura.addColorStop(0, `rgba(253,224,71,${0.4 * gk * fade})`); aura.addColorStop(1, 'rgba(253,224,71,0)');
          octx.fillStyle = aura;
          octx.fillRect(r.x - r.drawL, r.y - r.drawL, r.drawL * 2, r.drawL * 2);
        }
        const glows = (look.bands && look.bands.some(b => b.glow)) || look.tail.glow || look.glow;
        if (!glows) return;
        octx.save();
        octx.translate(r.x, r.y);
        octx.scale(r.dir, 1);
        octx.rotate(r.drawAng || 0);
        octx.globalAlpha = fade;
        drawFish(octx, look, r.drawL, { phase: r.phase, growth: f.growth, glowOnly: true, glowK: 0.55 + gk * 0.45 });
        octx.restore();
      });
      // 반짝 조개도 은은하게 빛난다
      s.pearls.forEach(p => {
        const aura = octx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 30 * s.k);
        aura.addColorStop(0, `rgba(255,255,255,${0.6 * gk})`); aura.addColorStop(1, 'rgba(255,255,255,0)');
        octx.fillStyle = aura;
        octx.fillRect(p.x - 30 * s.k, p.y - 30 * s.k, 60 * s.k, 60 * s.k);
      });
      octx.globalCompositeOperation = 'source-over';
      drawLamp();
    };

    const drawLight = () => {
      if (!light) return;
      const { gl } = light;
      const cw = lightRef.current.width, ch = lightRef.current.height;
      gl.viewport(0, 0, cw, ch);
      gl.uniform2f(light.uRes, cw, ch);
      gl.uniform1f(light.uTime, s.t);
      gl.uniform1f(light.uSurface, s.surface / s.H);
      gl.uniform1f(light.uFloor, s.floor / s.H);
      gl.uniform2f(light.uTilt, s.tilt.x, s.tilt.y);
      gl.uniform1f(light.uMurk, game.dirt / 100);
      gl.uniform1f(light.uLight, s.glNow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    let info = null;
    s.setInfoUid = (uid) => { info = uid; };

    let raf = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; s.t += dt; s.dtLast = dt;
      // 자잘한 효과(광택·부유물·빛망울·수면 빛줄)는 프레임이 3초 넘게 버거우면 자동으로 끈다 (오래된 태블릿 배려)
      s.emaDt = (s.emaDt ?? 1 / 60) * 0.95 + dt * 0.05;
      if (s.fx && s.t > 4) {
        s.slowFx = s.emaDt > 1 / 50 ? (s.slowFx || 0) + dt : 0;
        if (s.slowFx > 3) s.fx = 0;
      }
      if (s.quality === 1) {
        s.slow = dt > 0.03 ? s.slow + 1 : Math.max(0, s.slow - 1);
        if (s.slow > 120) { s.quality = 0.6; resize(); }
      }
      s.tilt.x += (s.tiltRaw.x - s.tilt.x) * Math.min(1, dt * 4);
      s.tilt.y += (s.tiltRaw.y - s.tilt.y) * Math.min(1, dt * 4);
      s.darkNow += (darkFor(s.ambient, s.light) - s.darkNow) * Math.min(1, dt * 5);
      s.glNow += (glFor(s.ambient, s.light) - s.glNow) * Math.min(1, dt * 5);
      s.lampNow += (LAMP[s.light] - s.lampNow) * Math.min(1, dt * 5);

      tickCare(dt);
      if (s.touched) { s.touched = false; s.lastActive = s.t; s.sleeping = false; }
      updateFish(dt);
      updateParticles(dt);
      draw();
      drawOverlay();
      drawLight();

      if (s.t - s.lastHud > 0.4) {
        s.lastHud = s.t;
        const fish = game.fish;
        const next = { points: game.points, clean: Math.round(100 - game.dirt), sad: fish.filter(f => isSad(f, game.dirt)).length, sick: fish.filter(f => f.sick).length };
        setHud(prev => (prev.points === next.points && prev.clean === next.clean && prev.sad === next.sad && prev.sick === next.sick ? prev : next));
        setInfoTick(v => (v + 1) % 1000);
        s.ambient = ambientDark();
        const nightNow = isNightTime();
        s.night = nightNow;
        setNight(nightNow);
        const sleepNow = nightNow && s.t - s.lastActive > SLEEP_IDLE_SEC;
        if (sleepNow && !s.sleeping) say('night', VOICE.aquaNight(), 60);
        s.sleeping = sleepNow;
      }
      if (s.t - s.lastSave > 4) { s.lastSave = s.t; game.lastTick = Date.now(); saveGame(game); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const persist = () => { game.lastTick = Date.now(); saveGame(game); };
    const onVis = () => {
      if (document.hidden) { persist(); return; }
      // 다른 앱을 보다 돌아오면 그 사이 시간만큼 반영
      const back = catchUpOffline(game);
      back.grown.forEach(f => { game.points += stageOf(f.growth) === 'adult' ? REWARDS.adult : REWARDS.juvenile; });
      if (back.sick.length) { showToast(`🩹 그동안 ${back.sick.length}마리가 아파졌어요! 밴드를 붙여 주세요`); say('sick', VOICE.aquaSick(FISH_BY_ID[back.sick[0].sp]), 8); }
      s.touched = true;   // 돌아오면 잠깐은 깨어 있다
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', persist);

    return () => {
      persist();
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerdown', onActive, true);
      window.removeEventListener('keydown', onActive, true);
      window.removeEventListener('deviceorientation', s.onOrient);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', persist);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택한 물고기 표시 링
  useEffect(() => { if (simRef.current) simRef.current.setInfoUid(info); }, [info]);
  useEffect(() => { setConfirmRelease(false); setNaming(false); }, [info]);
  useEffect(() => {
    // 이름을 짓는 동안은 카드가 저절로 닫히지 않게
    if (!info || naming) return undefined;
    const tm = setTimeout(() => setInfo(null), 9000);
    return () => clearTimeout(tm);
  }, [info, naming]);

  // ── 상점 ──
  const buy = (kind, id) => {
    const s = simRef.current; if (!s) return;
    const game = s.game;
    const price = kind === 'fish' ? FISH_BY_ID[id].price || STARTER_FISH_PRICE : DECOR_BY_ID[id].price;
    const full = kind === 'fish' ? game.fish.length >= LIMITS.fish : game.decor.length >= LIMITS.decor;
    if (full) { showToast('🙅 어항이 꽉 찼어요!'); return; }
    if (game.points < price) { showToast(`🐚 조개가 ${price - game.points}개 더 필요해요`); s.say('need', VOICE.aquaNeedMore(), 3); return; }
    game.points -= price;
    if (kind === 'fish') {
      const f = newFish(id);
      game.fish.push(f);
      s.ensureFishRt(f, true);
      for (let i = 0; i < 12; i++) s.bubbles.push({ x: s.rt[f.uid].x + (Math.random() - 0.5) * 30, y: s.surface + 10, r: 2 + Math.random() * 4, wob: Math.random() * 6, vy: 40 });
      const v = f.variant ? GUPPY_BY_ID[f.variant] : null;
      if (f.shiny) {
        s.say('buy', VOICE.aquaShiny(FISH_BY_ID[id]));
        showToast(`✨ 이로치 ${FISH_BY_ID[id].name}${v ? ` (${v.name})` : ''} 등장! ✨`);
        for (let i = 0; i < 20; i++) s.pops.push({ x: s.rt[f.uid].x + (Math.random() - 0.5) * 80, y: s.surface + 20 + Math.random() * 60, text: i % 2 ? '✨' : '⭐', life: 1.4, vy: -30 });
      } else {
        s.say('buy', VOICE.aquaNewFish(FISH_BY_ID[id]));
        if (v) showToast(`🎲 ${v.name} 구피가 왔어요!`);
      }
    } else {
      game.decor.push({ uid: newUid(), id, x: 0.1 + Math.random() * 0.8 });
    }
    audio.playFanfare();
    saveGame(game);
    setPlaced({ decor: game.decor.slice() });
    setHud(h => ({ ...h, points: game.points }));
    setShopOpen(false);
  };

  const sellDecor = (uid) => {
    const s = simRef.current; if (!s) return;
    const game = s.game;
    const d = game.decor.find(it => it.uid === uid);
    if (!d) return;
    game.decor = game.decor.filter(it => it.uid !== uid);
    game.points += Math.floor(DECOR_BY_ID[d.id].price / 2);
    audio.playPopSound();
    saveGame(game);
    setPlaced({ decor: game.decor.slice() });
    setHud(h => ({ ...h, points: game.points }));
  };

  const enableTilt = (e) => {
    e.stopPropagation();
    const s = simRef.current;
    window.DeviceOrientationEvent.requestPermission()
      .then(res => { if (res === 'granted' && s) { window.addEventListener('deviceorientation', s.onOrient); setTiltState('on'); } else setTiltState('none'); })
      .catch(() => setTiltState('none'));
  };

  const stop = (e) => e.stopPropagation();
  const sim = simRef.current;
  const infoFish = info && sim ? sim.game.fish.find(f => f.uid === info) : null;
  const pointsNow = sim ? sim.game.points : hud.points;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '0.7rem' }}>
      {/* 상단 상태판: 27개월 아기도 알아보게 큰 그림 버튼 위주 (글자는 부모용으로 작게) */}
      <div style={{
        background: 'linear-gradient(135deg, #0369a1 0%, #075985 100%)', borderRadius: '22px', padding: '0.55rem 0.9rem',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0,
        border: '3px solid #38bdf8', boxShadow: '0 8px 22px rgba(2,132,199,0.25)'
      }}>
        <div style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, fontSize: '1.45rem', padding: '6px 14px', borderRadius: '18px', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.1)' }}>
          🐚 {hud.points}
        </div>
        <WaterMeter value={hud.clean} />
        {night && <div title="밤 (저녁 8시 ~ 아침 7시)" style={{ fontSize: '1.9rem', lineHeight: 1, filter: 'drop-shadow(0 0 6px #fde68a)' }}>🌙</div>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {/* 수조 조명: 누를 때마다 꺼짐 → 1단 → 2단 → 3단 (수조를 가리지 않게 상단 버튼줄에 둠) */}
          <button
            onClick={() => { if (simRef.current) setLight(simRef.current.toggleLight()); }}
            aria-label="조명"
            title="조명"
            style={{
              width: '68px', height: '68px', borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation', padding: 0,
              background: 'linear-gradient(180deg, #1e293b, #0f172a)', border: '4px solid rgba(255,255,255,0.35)',
              boxShadow: light ? `0 0 ${8 + light * 8}px rgba(254,240,138,${0.25 + light * 0.15}), 0 6px 14px rgba(0,0,0,0.22)` : '0 6px 14px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px'
            }}
          >
            <span style={{ fontSize: '1.8rem', lineHeight: 1, filter: light ? `drop-shadow(0 0 ${4 + light * 4}px #fde047)` : 'grayscale(1) brightness(0.55)' }}>💡</span>
            <span style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3].map(i => (
                <span key={i} style={{
                  width: '9px', height: '9px', borderRadius: '50%',
                  background: light >= i ? '#fde047' : '#475569',
                  boxShadow: light >= i ? '0 0 6px #fde047' : 'inset 0 1px 2px rgba(0,0,0,0.5)'
                }} />
              ))}
            </span>
          </button>
          <IconButton icon={<RiceBowlIcon />} label="밥" color="#f97316" onClick={() => { setMode('play'); if (simRef.current) simRef.current.feed(); }} />
          <IconButton icon={<BandageIcon />} label="치료" color="#f43f5e" keepColor badge={hud.sick} active={mode === 'heal'} onClick={() => { const m = mode === 'heal' ? 'play' : 'heal'; setMode(m); if (m === 'heal' && simRef.current) simRef.current.say('healmode', VOICE.aquaHealMode(), 3); }} />
          <IconButton icon="🧽" label="청소" color="#10b981" active={mode === 'clean'} onClick={() => setMode(mode === 'clean' ? 'play' : 'clean')} />
          <IconButton icon="🚿" label="물갈이" color="#0ea5e9" onClick={() => { if (simRef.current) simRef.current.startWaterChange(); }} />
          <IconButton icon="🛒" label="상점" color="#8b5cf6" onClick={() => setShopOpen(true)} />
          <IconButton icon="🎨" label="꾸미기" color="#ec4899" active={mode === 'decorate'} onClick={() => setMode(mode === 'decorate' ? 'play' : 'decorate')} />
        </div>
      </div>

      {/* 어항 */}
      <div
        ref={wrapRef}
        style={{
          flex: 1, minHeight: '260px', position: 'relative', overflow: 'hidden', borderRadius: '18px',
          border: '7px solid #1e293b', borderTopWidth: '14px', background: '#0e6f8f',
          boxShadow: '0 14px 30px rgba(15,23,42,0.35), inset 0 0 0 2px rgba(255,255,255,0.15)',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          cursor: mode === 'clean' || mode === 'heal' ? 'crosshair' : mode === 'decorate' ? 'grab' : 'pointer'
        }}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block', zIndex: 0 }} />
        <canvas ref={lightRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block', zIndex: 1, mixBlendMode: 'screen', pointerEvents: 'none' }} />

        <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block', zIndex: 3, pointerEvents: 'none' }} />
        {/* 유리 반사 */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
          background: 'linear-gradient(112deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 16%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.08) 63%, rgba(255,255,255,0) 69%), radial-gradient(ellipse 75% 70% at 50% 42%, rgba(4,30,50,0) 60%, rgba(4,30,50,0.22) 100%)',
          boxShadow: 'inset 0 0 70px rgba(8,47,73,0.45)'
        }} />

        {/* 모드 안내 */}
        {mode !== 'play' && (
          <div style={{
            position: 'absolute', left: '50%', top: '12px', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none',
            background: 'rgba(15,23,42,0.75)', color: '#ffffff', fontWeight: 900, padding: '8px 16px', borderRadius: '16px', fontSize: '0.95rem', whiteSpace: 'nowrap'
          }}>
            {mode === 'clean' ? '🧽 유리 이끼와 바닥 똥을 문질러 치워요' : mode === 'heal' ? (hud.sick ? '🩹 밴드 그림이 떠 있는 물고기를 눌러 줘요' : '🩹 지금은 아픈 물고기가 없어요') : '🎨 장식을 끌어서 옮겨요'}
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

        {tiltState === 'ask' && (
          <button onPointerDown={stop} onClick={enableTilt} style={{
            position: 'absolute', right: '12px', top: '12px', zIndex: 6, background: 'rgba(255,255,255,0.92)', color: '#0369a1', border: 'none',
            padding: '9px 14px', borderRadius: '16px', fontWeight: 900, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', cursor: 'pointer'
          }}>📱 기울여서 놀기</button>
        )}

        {/* 물고기 정보 카드 */}
        {infoFish && (() => {
          const sp = FISH_BY_ID[infoFish.sp];
          const dirt = sim.game.dirt;
          const stage = stageOf(infoFish.growth);
          const sad = isSad(infoFish, dirt);
          const cond = conditionOf(infoFish, dirt);
          const speed = growFactor(infoFish, dirt);
          return (
            <div data-ui data-quiet onPointerDown={stop} data-tick={infoTick} style={{
              position: 'absolute', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: 8,
              background: 'rgba(255,255,255,0.96)', borderRadius: '22px', padding: '12px 16px', width: 'min(360px, calc(100% - 24px))',
              boxShadow: '0 12px 28px rgba(0,0,0,0.3)', border: `3px solid ${sad ? '#94a3b8' : '#38bdf8'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0f172a' }}>
                  {sim.rt[infoFish.uid]?.asleep ? '😴' : infoFish.sick ? '🤒' : sad ? '😢' : '😊'} {infoFish.name ? <>{infoFish.name} <span style={{ fontSize: '0.8rem', color: '#475569' }}>({sp.name})</span></> : sp.name}
                  {infoFish.sex && <span title={SEX_NAMES[infoFish.sex]} style={{ marginLeft: '4px', fontSize: '0.85rem', color: '#ffffff', background: infoFish.sex === 'm' ? '#2563eb' : '#db2777', borderRadius: '10px', padding: '1px 7px' }}>{infoFish.sex === 'm' ? '♂' : '♀'} {SEX_NAMES[infoFish.sex]}</span>}
                  {infoFish.variant && <span style={{ fontSize: '0.8rem', color: '#be185d' }}> ({GUPPY_BY_ID[infoFish.variant]?.name})</span>}
                  {' '}<span style={{ fontSize: '0.85rem', color: '#0369a1' }}>· {STAGE_NAMES[stage]}</span>
                  {infoFish.shiny && <span style={{ marginLeft: '6px', fontSize: '0.78rem', background: 'linear-gradient(135deg, #fde047, #f59e0b)', color: '#713f12', padding: '2px 8px', borderRadius: '10px' }}>✨ 이로치</span>}
                </div>
                <button onClick={() => setInfo(null)} style={{ border: 'none', background: '#e2e8f0', borderRadius: '12px', padding: '4px 10px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: '8px', fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
                {[['🍚 배부름', infoFish.full, '#facc15'], ['💗 기분', infoFish.happy, '#f472b6'], ['💪 컨디션', cond, '#22c55e'], ['🌱 성장', infoFish.growth * 100, '#0ea5e9']].map(([label, v, col]) => (
                  <div key={label}>
                    {label} {Math.round(v)}%
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', marginTop: '2px' }}>
                      <div style={{ width: `${clamp(v, 0, 100)}%`, height: '100%', background: v < 30 && label !== '🌱 성장' ? '#f43f5e' : col }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.82rem', fontWeight: 800, color: sad ? '#be123c' : '#0f766e' }}>
                {infoFish.preg != null ? `${breedOf(infoFish.sp).type === 'live' ? '🤰 배 속에 아기가 있어요' : '🥚 배 속에 알이 있어요'} (${Math.round(infoFish.preg * 100)}%)` : stage === 'adult' ? '🎉 다 컸어요! 가끔 반짝 조개를 떨어뜨려요' : infoFish.sick ? '🤒 아파서 자라지 않아요. 🩹 치료 버튼을 누르고 이 물고기를 눌러 주세요' : sad ? '배고프거나 물이 더러워서 자라지 않아요' : `자라는 속도 ${Math.round(speed * 100)}% (컨디션이 좋을수록 빨라요)`}
              </div>
              {/* 가족: 엄마·아빠·아기들. 이름이 없으면 '엄마 구피 ♀' 처럼 종류로 부르고, 누르면 그 물고기 카드로 */}
              {(() => {
                const all = sim.game.fish;
                const chip = (uid, savedName, role) => {
                  const p = all.find(o => o.uid === uid);
                  const icon = role === 'mom' ? '♀' : '♂', label = role === 'mom' ? '엄마' : '아빠';
                  if (!p) return <span key={role} style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '10px', padding: '2px 8px' }}>{label} {savedName || sp.name} {icon} · 자연으로 갔어요</span>;
                  return (
                    <button key={role} onClick={() => setInfo(p.uid)} style={{ border: 'none', cursor: 'pointer', background: role === 'mom' ? '#fce7f3' : '#dbeafe', color: role === 'mom' ? '#9d174d' : '#1e40af', borderRadius: '10px', padding: '2px 8px', fontWeight: 900, fontSize: '0.8rem' }}>
                      {label} {p.name || FISH_BY_ID[p.sp].name} {icon}
                    </button>
                  );
                };
                const kids = all.filter(o => o.mom === infoFish.uid || o.dad === infoFish.uid);
                if (!infoFish.mom && !infoFish.dad && !kids.length) return null;
                const momP = infoFish.mom && all.find(o => o.uid === infoFish.mom);
                const momLabel = momP ? (momP.name || `엄마 ${FISH_BY_ID[momP.sp].name}`) : infoFish.momName || `엄마 ${sp.name}`;
                return (
                  <div style={{ marginTop: '8px', background: '#fff7ed', borderRadius: '14px', padding: '7px 10px', fontSize: '0.8rem', fontWeight: 800, color: '#7c2d12', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                    {infoFish.mom && <span>👪 {momLabel}의 아기예요</span>}
                    {infoFish.mom && chip(infoFish.mom, infoFish.momName, 'mom')}
                    {infoFish.dad && chip(infoFish.dad, infoFish.dadName, 'dad')}
                    {kids.length > 0 && (
                      <button onClick={() => setInfo(kids[Math.floor(Math.random() * kids.length)].uid)} style={{ border: 'none', cursor: 'pointer', background: '#dcfce7', color: '#166534', borderRadius: '10px', padding: '2px 8px', fontWeight: 900, fontSize: '0.8rem' }}>
                        👶 아기 {kids.length}마리
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* 이름 짓기: 지은 이름은 물고기를 누르면 불러 준다 */}
              {!naming ? (
                <button
                  onClick={() => { setNameDraft(infoFish.name || ''); setNaming(true); }}
                  style={{ marginTop: '6px', width: '100%', border: '2px solid #fde68a', borderRadius: '14px', padding: '7px', fontWeight: 900, fontSize: '0.88rem', background: '#fefce8', color: '#854d0e', cursor: 'pointer' }}
                >✏️ {infoFish.name ? '이름 바꾸기' : '이름 짓기'}</button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nm = nameDraft.trim().slice(0, 10);
                    infoFish.name = nm || undefined;
                    saveGame(sim.game);
                    setNaming(false);
                    if (nm) speak(VOICE.aquaHello(sp, nm));
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
              {/* 자연으로 보내기 (아기가 실수로 누르지 않게 한 번 더 확인) */}
              {!confirmRelease ? (
                <button
                  onClick={() => setConfirmRelease(true)}
                  style={{ marginTop: '6px', width: '100%', border: '2px solid #7dd3fc', borderRadius: '14px', padding: '7px', fontWeight: 900, fontSize: '0.88rem', background: '#f0f9ff', color: '#0369a1', cursor: 'pointer' }}
                >🌊 자연으로 보내기</button>
              ) : (
                <div style={{ marginTop: '6px', background: '#e0f2fe', borderRadius: '14px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '0.88rem', color: '#0c4a6e' }}>정말 {attachJosa(sp.name, '을/를')} 넓은 자연으로 보낼까요?</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      onClick={() => { if (sim.releaseFish(infoFish.uid)) setInfo(null); else setConfirmRelease(false); }}
                      style={{ flex: 1, border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, background: '#0284c7', color: '#ffffff', cursor: 'pointer' }}
                    >🌊 보내기</button>
                    <button
                      onClick={() => setConfirmRelease(false)}
                      style={{ flex: 1, border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, background: '#e2e8f0', color: '#334155', cursor: 'pointer' }}
                    >취소</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 꾸미기: 놓인 장식·친구 목록 (✕ 는 반값에 되팔기) */}
        {mode === 'decorate' && (
          <div data-ui onPointerDown={stop} style={{
            position: 'absolute', left: '10px', right: '10px', bottom: '10px', zIndex: 8, display: 'flex', gap: '6px', overflowX: 'auto',
            background: 'rgba(255,255,255,0.92)', borderRadius: '18px', padding: '8px'
          }}>
            {placed.decor.map(d => (
              <div key={d.uid} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px 8px', whiteSpace: 'nowrap', fontWeight: 900 }}>
                {DECOR_BY_ID[d.id].icon} {DECOR_BY_ID[d.id].name}
                <button onClick={() => sellDecor(d.uid)} style={{ border: 'none', background: '#fecaca', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>✕ +{Math.floor(DECOR_BY_ID[d.id].price / 2)}🐚</button>
              </div>
            ))}
            {!placed.decor.length && <span style={{ fontWeight: 800, color: '#64748b' }}>상점에서 장식을 사 보세요!</span>}
          </div>
        )}

        {/* 상점 */}
        {shopOpen && (
          <div data-ui onPointerDown={stop} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ background: '#ffffff', borderRadius: '26px', width: 'min(760px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#ffffff' }}>
                <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>🛒 바다 상점</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, padding: '4px 12px', borderRadius: '14px' }}>🐚 {pointsNow}</span>
                  <button onClick={() => setShopOpen(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.25)', color: '#ffffff', borderRadius: '12px', padding: '6px 12px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', padding: '10px 14px 0' }}>
                {[['fish', '🐟 물고기·바다 친구'], ['decor', '🪸 장식']].map(([k, label]) => (
                  <button key={k} onClick={() => setShopTab(k)} style={{
                    border: 'none', borderRadius: '14px', padding: '8px 14px', fontWeight: 900, cursor: 'pointer',
                    background: shopTab === k ? '#8b5cf6' : '#f1f5f9', color: shopTab === k ? '#ffffff' : '#475569'
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ padding: '12px 14px 16px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {shopTab === 'fish' && FISH_SPECIES.map(sp => {
                  const price = sp.price || STARTER_FISH_PRICE;
                  return (
                    <div key={sp.id} style={{ border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: sp.sea ? '#eff6ff' : '#f0f9ff' }}>
                      <FishPreview species={sp} />
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>{sp.name}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>{sp.desc}</div>
                      <button onClick={() => buy('fish', sp.id)} style={{ marginTop: '6px', width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: pointsNow >= price ? (sp.sea ? '#0ea5e9' : '#8b5cf6') : '#cbd5e1', color: '#ffffff' }}>🐚 {price}</button>
                    </div>
                  );
                })}
                {shopTab === 'decor' && DECOR_ITEMS.map(d => (
                  <div key={d.id} style={{ border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0fdf4' }}>
                    <DecorPreview id={d.id} />
                    <div style={{ fontWeight: 900, color: '#0f172a' }}>{d.name}</div>
                    <button onClick={() => buy('decor', d.id)} style={{ marginTop: '6px', width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: pointsNow >= d.price ? '#10b981' : '#cbd5e1', color: '#ffffff' }}>🐚 {d.price}</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 16px 14px', fontSize: '0.8rem', fontWeight: 800, color: '#64748b' }}>
                ✨ 아주 가끔 특별한 색깔의 이로치가 나와요 · 물고기·바다 친구 {sim ? sim.game.fish.length : 0}/{LIMITS.fish} · 장식 {placed.decor.length}/{LIMITS.decor}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
