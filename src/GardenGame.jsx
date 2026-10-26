import { useEffect, useRef, useState } from 'react';
import { VOICE } from './voiceLines.js';
import { CROPS, CROP_BY_ID, farmSeasonOf, FARM_SEASONS, FARM_WEATHER } from './farmData.js';
import { GARDEN_RATES, GARDEN_YIELD, newPlot, loadGarden, saveGarden, catchUpGarden, basketCount } from './gardenData.js';

// ═════════════════════════════════════════════════════════════════════════════
// 🌱 텃밭 가꾸기 — 씨앗 심기 → 물 주기 → (벌레 쫓기) → 수확해서 바구니에 모으기
// 캔버스 한 장에 하늘·날씨·밭 8칸을 그린다. 밭 칸을 누르면 상황에 맞게 심기/물 주기/벌레 쫓기/수확.
// 바구니 채소는 내 목장의 🧺 버튼으로 초식동물에게 준다. 규칙·저장은 gardenData.js.
// ═════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const fract = (v) => v - Math.floor(v);
const hex3 = (c) => (c[0] === '#' ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : c.slice(4, -1).split(',').map(Number));
const mixColor = (a, b, t) => { const A = hex3(a), B = hex3(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (ctx, x, y, w, h, rad) => {
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
};
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };

// 실제 시계에 따른 어둠 0~1 (내 목장과 같은 규칙)
const gardenDark = (d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 8 && h < 17) return 0;
  if (h >= 17 && h < 19.5) return (h - 17) / 2.5;
  if (h >= 6 && h < 8) return 1 - (h - 6) / 2;
  return 1;
};

const WEATHER_SEC = { sunny: [90, 180], cloudy: [45, 90], rain: [40, 70], snow: [60, 100] };
// [먼 언덕, 가까운 언덕, 풀밭 위, 풀밭 아래, 나뭇잎]
const SEASON_COLORS = {
  spring: ['#b5e59a', '#93d477', '#9be07c', '#5cba4f', '#4caf50'],
  summer: ['#a7d98b', '#86c96a', '#8fd672', '#4fae4a', '#3f9d4b'],
  autumn: ['#dccb84', '#c8ad5e', '#c9cf72', '#97a647', '#ea8a1a'],
  winter: ['#e5e7eb', '#d1d5db', '#eef2f6', '#cdd6e1', '#94a3b8']
};
// 밭 두 줄 (뒷줄은 작게, 앞줄은 크게): 위·아래 높이 비율, 좌우 여백 비율, 크기 배율
const ROWS = [{ y0: 0.41, y1: 0.6, mx: 0.11, sc: 0.85 }, { y0: 0.66, y1: 0.95, mx: 0.035, sc: 1.1 }];

// 물뿌리개 그림 (기울기 tilt, 원점은 주둥이 끝)
function drawCan(ctx, x, y, z, tilt) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.strokeStyle = '#15803d'; ctx.lineWidth = z * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(z * 0.7, z * 0.38); ctx.stroke();
  ctx.fillStyle = '#22c55e'; rr(ctx, z * 0.55, z * 0.15, z * 0.9, z * 0.7, z * 0.14); ctx.fill();
  ctx.fillStyle = '#86efac'; rr(ctx, z * 0.62, z * 0.22, z * 0.25, z * 0.5, z * 0.08); ctx.fill();
  ctx.strokeStyle = '#15803d'; ctx.lineWidth = z * 0.1;
  ctx.beginPath(); ctx.arc(z * 1.0, z * 0.15, z * 0.3, Math.PI, TAU); ctx.stroke();
  ctx.fillStyle = '#166534'; ell(ctx, 0, 0, z * 0.1, z * 0.14, tilt); ctx.fill();
  ctx.restore();
}

function GardenButton({ children, active, onClick, label, color = '#ffffff' }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        minWidth: '58px', height: '62px', borderRadius: '16px', cursor: 'pointer', touchAction: 'manipulation', padding: '2px 8px',
        background: active ? '#fef08a' : color, border: active ? '4px solid #facc15' : '3px solid rgba(255,255,255,0.6)',
        boxShadow: active ? '0 0 0 3px #ffffff, 0 6px 14px rgba(0,0,0,0.25)' : '0 4px 10px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px'
      }}
    >{children}</button>
  );
}

export default function GardenGame({ audio, speak }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const [picking, setPicking] = useState(null); // 씨앗을 고르는 중인 밭 { i, x, y, w, h } (화면 px)
  const [hud, setHud] = useState({ basket: {}, weather: 'sunny', season: farmSeasonOf() });
  const [toast, setToast] = useState(null);
  const showToast = (text) => setToast({ text, key: Date.now() });
  useEffect(() => {
    if (!toast) return undefined;
    const tm = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(tm);
  }, [toast]);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, ctx = canvas.getContext('2d');
    const garden = loadGarden();
    catchUpGarden(garden);
    const s = {
      garden, W: 0, H: 0, dpr: 1, k: 1, t: 0, layer: null, plots: [],
      dark: gardenDark(), clockT: 0, season: farmSeasonOf(), weather: null,
      gloom: 0, rainAmt: 0, snowAmt: 0, rainbow: 0, snowCover: 0,
      fx: [], cans: [], flies: [], lastVoice: {}, lastSave: 0, lastHud: 0, nagT: 10
    };
    simRef.current = s;
    if (import.meta.env.DEV) window.__garden = s;   // 개발 중 확인용
    const timers = [];
    const after = (fn, ms) => timers.push(setTimeout(fn, ms));
    const say = (key, line, gap = 0) => {
      if (gap && s.t - (s.lastVoice[key] ?? -1e9) < gap) return;
      s.lastVoice[key] = s.t;
      speak(line);
    };
    s.say = say;
    if (!garden.welcomed) { garden.welcomed = true; after(() => speak(VOICE.gardenWelcome()), 500); }
    saveGarden(garden);
    const pushHud = () => setHud({ basket: { ...garden.basket }, weather: s.weather.kind, season: s.season });

    // ── 고정 배경 ──
    const buildLayer = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(s.W * s.dpr); c.height = Math.round(s.H * s.dpr);
      const g = c.getContext('2d'); g.scale(s.dpr, s.dpr);
      const { W, H, k } = s, hz = H * 0.3, SC = SEASON_COLORS[s.season] || SEASON_COLORS.summer, rnd = seeded(818);
      [[SC[0], 0.09, 0.007, 1], [SC[1], 0.06, 0.012, 3]].forEach(([col, amp, fq, off]) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - H * amp * (0.55 + 0.45 * Math.sin(x * fq + off)) + H * 0.03);
        g.lineTo(W, H); g.closePath(); g.fill();
      });
      const fg = g.createLinearGradient(0, hz, 0, H);
      fg.addColorStop(0, SC[2]); fg.addColorStop(1, SC[3]);
      g.fillStyle = fg; g.fillRect(0, hz, W, H - hz);
      // 뒤쪽 나무들
      [[0.32, 0.9], [0.62, 1.1], [0.78, 0.85]].forEach(([q, m]) => {
        const tx = W * q, tb = hz + H * 0.045, th = clamp(H * 0.2, 60, 160) * m;
        g.fillStyle = '#92400e'; g.fillRect(tx - th * 0.05, tb - th * 0.5, th * 0.1, th * 0.5);
        if (s.season === 'winter') { g.fillStyle = '#e2e8f0'; ell(g, tx, tb - th * 0.62, th * 0.22, th * 0.18); g.fill(); return; }
        const leaf = s.season === 'autumn' ? ['#ea8a1a', '#dc6b12', '#f2b33d'] : [SC[4], SC[4], SC[4]];
        [[0, -0.72, 0.28], [-0.18, -0.58, 0.22], [0.18, -0.58, 0.22]].forEach(([qx, qy, qr], i) => { g.fillStyle = leaf[i]; g.beginPath(); g.arc(tx + th * qx, tb + th * qy, th * qr, 0, TAU); g.fill(); });
        if (s.season === 'spring') { g.fillStyle = '#f9a8d4'; [[-0.1, -0.7], [0.12, -0.62], [0.02, -0.82], [-0.2, -0.55]].forEach(([qx, qy]) => { g.beginPath(); g.arc(tx + th * qx, tb + th * qy, th * 0.03, 0, TAU); g.fill(); }); }
      });
      // 창고
      const bx = W * 0.09, bb = hz + H * 0.06, bw = clamp(W * 0.13, 70, 150), bh = bw * 0.7;
      g.fillStyle = '#b45309'; g.fillRect(bx - bw / 2, bb - bh, bw, bh);
      g.fillStyle = s.season === 'winter' ? '#f1f5f9' : '#78350f';
      g.beginPath(); g.moveTo(bx - bw * 0.6, bb - bh); g.lineTo(bx, bb - bh * 1.55); g.lineTo(bx + bw * 0.6, bb - bh); g.closePath(); g.fill();
      g.fillStyle = '#7c2d12'; g.fillRect(bx - bw * 0.18, bb - bh * 0.62, bw * 0.36, bh * 0.62);
      g.fillStyle = '#fde68a'; g.fillRect(bx + bw * 0.24, bb - bh * 0.8, bw * 0.16, bw * 0.16);
      // 울타리
      const fy = hz + H * 0.075, fh = 22 * k;
      g.strokeStyle = '#c9a66b'; g.fillStyle = '#f5e6c8'; g.lineWidth = 1.5;
      [0.35, 0.72].forEach(q => { g.fillRect(0, fy - fh * q - 2.5 * k, W, 5 * k); g.strokeRect(0, fy - fh * q - 2.5 * k, W, 5 * k); });
      for (let x = 14 * k; x < W; x += 46 * k) { rr(g, x - 4 * k, fy - fh, 8 * k, fh, 3 * k); g.fill(); g.stroke(); }
      // 허수아비 (오른쪽 뒤)
      const sx = W * 0.955, sb = H * 0.6, sz = 70 * k;
      g.strokeStyle = '#92400e'; g.lineWidth = 5 * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sb); g.lineTo(sx, sb - sz); g.moveTo(sx - sz * 0.45, sb - sz * 0.7); g.lineTo(sx + sz * 0.45, sb - sz * 0.7); g.stroke();
      g.fillStyle = '#ef4444'; rr(g, sx - sz * 0.22, sb - sz * 0.78, sz * 0.44, sz * 0.4, 6 * k); g.fill();
      g.fillStyle = '#fde68a'; g.beginPath(); g.arc(sx, sb - sz * 0.92, sz * 0.15, 0, TAU); g.fill();
      g.fillStyle = '#a16207'; ell(g, sx, sb - sz * 1.04, sz * 0.26, sz * 0.06); g.fill(); rr(g, sx - sz * 0.12, sb - sz * 1.2, sz * 0.24, sz * 0.16, 3 * k); g.fill();
      g.fillStyle = '#1f2937'; [-0.05, 0.05].forEach(q => { g.beginPath(); g.arc(sx + sz * q, sb - sz * 0.93, sz * 0.02, 0, TAU); g.fill(); });
      // 풀 포기·꽃
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W, y = lerp(fy + 6, H - 4, rnd()), sz2 = (4 + rnd() * 4) * k;
        g.strokeStyle = s.season === 'winter' ? 'rgba(100,116,139,0.3)' : 'rgba(34,120,50,0.45)'; g.lineWidth = Math.max(1, sz2 * 0.2);
        [-0.5, 0, 0.5].forEach(a => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * sz2, y - Math.cos(a) * sz2); g.stroke(); });
      }
      s.layer = c;
    };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      s.W = Math.max(240, r.width); s.H = Math.max(240, r.height);
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.k = clamp(Math.min(s.W, s.H * 1.5) / 620, 0.75, 1.6);
      canvas.width = Math.round(s.W * s.dpr); canvas.height = Math.round(s.H * s.dpr);
      canvas.style.width = `${s.W}px`; canvas.style.height = `${s.H}px`;
      // 밭 칸 위치
      s.plots = [];
      ROWS.forEach((row) => {
        const usable = s.W * (1 - row.mx * 2), gap = s.W * 0.018, w = (usable - gap * 3) / 4;
        for (let c = 0; c < 4; c++) s.plots.push({ x: s.W * row.mx + c * (w + gap), y: s.H * row.y0, w, h: s.H * (row.y1 - row.y0), sc: row.sc });
      });
      buildLayer();
      if (s.redraw) s.redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── 날씨 ──
    const setWeather = (kind, quiet) => {
      const prev = s.weather ? s.weather.kind : 'sunny';
      const [a, b] = WEATHER_SEC[kind];
      s.weather = { kind, t: rand(a, b) };
      if (quiet) return;
      if (kind === 'rain') say('rain', VOICE.gardenRain(), 60);
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
    pushHud();

    // ── 밭 누르기: 벌레 쫓기 > 심기 > 수확 > 물 주기 ──
    const sparkle = (x, y, text, n = 4) => { for (let i = 0; i < n; i++) s.fx.push({ x: x + rand(-24, 24), y: y + rand(-10, 10), text, life: rand(0.8, 1.3), vy: rand(-50, -26) }); };
    const tapPlot = (i) => {
      const p = garden.plots[i], R = s.plots[i], cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      if (p.bug) {
        p.bug = false;
        s.fx.push({ x: cx, y: cy, text: '🐛', life: 1.1, vy: -120, vx: rand(-80, 80) });
        sparkle(cx, cy, '✨', 3);
        audio.playPopSound(); say('bugoff', VOICE.gardenBugGone(), 3);
      } else if (!p.crop) {
        // 빈 밭: 이 밭에 심을 씨앗을 고르는 창을 띄운다 (고르면 s.plant)
        s.picking = i;
        setPicking({ i, x: R.x, y: R.y, w: R.w, h: R.h });
        audio.playFreq(620, 'sine', 0.1);
        say('pick', VOICE.gardenPickSeed(), 4);
        return;
      } else if (p.growth >= 1) {
        const crop = CROP_BY_ID[p.crop];
        Object.assign(p, newPlot());
        garden.basket[crop.id] = (garden.basket[crop.id] || 0) + GARDEN_YIELD;
        // 밭에 있던 포기들이 하나씩 바구니로 날아간다
        [0.42, 0.78].forEach((qy, row) => [0.22, 0.5, 0.78].forEach((qx, col) => {
          s.flies.push({ icon: crop.icon, x: R.x + R.w * qx, y: R.y + R.h * qy, t: -(row * 3 + col) * 0.07 });
        }));
        audio.playFanfare(); say('harvest', VOICE.gardenHarvest(crop), 2);
        showToast(`🧺 ${crop.icon} ${crop.name} ${GARDEN_YIELD}개 바구니에 쏙! (목장 친구들에게 줄 수 있어요)`);
        pushHud();
      } else if (p.water < 0.97) {
        const dry = p.water < 0.3;
        p.water = 1;
        s.cans.push({ x: cx + R.w * 0.18, y: R.y - 6 * s.k, t: 0, i });
        audio.playBubble();
        if (dry) say('water', VOICE.farmWater(), 4);
      } else {
        sparkle(cx, R.y, '💧', 2);
        say('enough', VOICE.gardenEnough(), 6);
      }
      saveGarden(garden);
    };
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return;
      const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const i = s.plots.findIndex(R => x >= R.x - 4 && x <= R.x + R.w + 4 && y >= R.y - 30 * s.k && y <= R.y + R.h + 4);
      // 씨앗 고르는 창이 떠 있을 때 다른 곳을 누르면 닫기만 (다른 빈 밭이면 그 밭으로 옮김)
      if (s.picking != null) {
        s.picking = null; setPicking(null);
        if (i < 0 || garden.plots[i].crop) return;
      }
      if (i >= 0) tapPlot(i);
    };
    wrap.addEventListener('pointerdown', onDown);
    // 씨앗 고르기 창에서 고른 씨앗을 그 밭에 심는다
    s.plant = (i, cropId) => {
      const p = garden.plots[i], R = s.plots[i], crop = CROP_BY_ID[cropId];
      s.picking = null;
      if (!p || p.crop || !crop) return;
      Object.assign(p, newPlot(), { crop: crop.id, water: s.weather.kind === 'rain' ? 1 : 0 });
      audio.playPopSound(); sparkle(R.x + R.w / 2, R.y + R.h / 2, '🌱', 4);
      say('plant', VOICE.farmPlant(crop), 2);
      saveGarden(garden);
    };
    s.cancelPick = () => { s.picking = null; };

    // ── 한 프레임 ──
    const update = (dt) => {
      s.weather.t -= dt;
      if (s.weather.t <= 0) setWeather(nextWeather());
      const wk = s.weather.kind, raining = wk === 'rain';
      s.gloom += (({ sunny: 0, cloudy: 0.45, rain: 0.8, snow: 0.5 })[wk] - s.gloom) * Math.min(1, dt * 0.4);
      s.rainAmt += ((raining ? 1 : 0) - s.rainAmt) * Math.min(1, dt * 0.6);
      s.snowAmt += ((wk === 'snow' ? 1 : 0) - s.snowAmt) * Math.min(1, dt * 0.5);
      s.snowCover = clamp(s.snowCover + (wk === 'snow' ? dt / 45 : -dt / 150), 0, 0.7);
      if (s.rainbow > 0) s.rainbow -= dt;

      const growing = garden.plots.filter(p => p.crop && p.growth < 1);
      garden.plots.forEach(p => {
        if (!p.crop || p.growth >= 1) return;
        if (raining) p.water = 1;
        if (p.water > 0 && !p.bug) {
          p.growth = Math.min(1, p.growth + dt / CROP_BY_ID[p.crop].growSec);
          if (p.growth >= 1) { say('ripe', VOICE.farmRipe(), 30); audio.playPopSound(); saveGarden(garden); }
        }
        p.water = Math.max(0, p.water - GARDEN_RATES.dryPerSec * dt);
      });
      // 가끔 벌레가 와서 자라는 걸 멈춘다 (눌러서 쫓아낸다)
      const bugs = garden.plots.filter(p => p.bug).length;
      if (bugs < GARDEN_RATES.bugMax && Math.random() < GARDEN_RATES.bugPerSec * dt) {
        const cand = growing.filter(p => !p.bug && p.growth > 0.15);
        if (cand.length) { cand[Math.floor(Math.random() * cand.length)].bug = true; say('bug', VOICE.gardenBug(), 25); audio.playFreq(660, 'triangle', 0.12, 0.25); }
      }
      s.nagT -= dt;
      if (s.nagT <= 0) {
        s.nagT = 15;
        if (growing.some(p => p.water <= 0 && !p.bug)) say('nag', VOICE.farmThirsty(), 60);
      }
      s.clockT -= dt;
      if (s.clockT <= 0) {
        s.clockT = 5; s.dark = gardenDark();
        const season = farmSeasonOf();
        if (season !== s.season) { s.season = season; buildLayer(); }
      }
      s.cans.forEach(c => { c.t += dt; });
      s.cans = s.cans.filter(c => c.t < 1.1);
      s.flies.forEach(f => { f.t += dt; });
      const doneFly = s.flies.filter(f => f.t >= 0.7);
      if (doneFly.length) audio.playFreq(880, 'sine', 0.08, 0.2);
      s.flies = s.flies.filter(f => f.t < 0.7);
      s.fx.forEach(f => { f.life -= dt; f.y += f.vy * dt; if (f.vx) f.x += f.vx * dt; });
      s.fx = s.fx.filter(f => f.life > 0);
    };

    const emoji = (text, x, y, px, alpha = 1) => {
      ctx.fillStyle = '#000000'; ctx.globalAlpha = alpha; ctx.font = `${Math.round(px)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
    };
    const clouds = Array.from({ length: 4 }, (_, i) => ({ off: i * 0.27 + Math.random() * 0.1, y: 0.04 + Math.random() * 0.14, sp: 6 + Math.random() * 8, sz: 0.8 + Math.random() * 0.5 }));

    const drawPlot = (p, R, i) => {
      const { k } = s, sc = k * R.sc;
      // 나무 틀 + 흙 (젖으면 진하게)
      ctx.fillStyle = '#a16207'; rr(ctx, R.x, R.y, R.w, R.h, 10 * k); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; rr(ctx, R.x, R.y + R.h - 6 * k, R.w, 6 * k, 4 * k); ctx.fill();
      const ins = 7 * sc;
      ctx.fillStyle = mixColor('#a87444', '#5b3a1e', clamp(p.water, 0, 1));
      rr(ctx, R.x + ins, R.y + ins, R.w - ins * 2, R.h - ins * 2.2, 7 * k); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,0.3)'; ctx.lineWidth = 2 * k;
      [0.42, 0.78].forEach(q => { const yy = R.y + R.h * q + 6 * sc; ctx.beginPath(); ctx.moveTo(R.x + ins + 6 * k, yy); ctx.lineTo(R.x + R.w - ins - 6 * k, yy); ctx.stroke(); });
      if (s.snowCover > 0.05) { ctx.fillStyle = `rgba(248,250,252,${s.snowCover * 0.5})`; rr(ctx, R.x + ins, R.y + ins, R.w - ins * 2, R.h - ins * 2.2, 7 * k); ctx.fill(); }
      const cx = R.x + R.w / 2;
      if (!p.crop) {
        // 빈 칸: '씨앗 심기' 표시 + 누르라는 손가락 (고르는 중이면 노란 테두리)
        if (s.picking === i) { ctx.strokeStyle = `rgba(250,204,21,${0.7 + 0.3 * Math.sin(s.t * 6)})`; ctx.lineWidth = 5 * k; rr(ctx, R.x - 3 * k, R.y - 3 * k, R.w + 6 * k, R.h + 6 * k, 12 * k); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, cx, R.y + R.h * 0.48, 26 * sc, 26 * sc); ctx.fill();
        ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 * k; ell(ctx, cx, R.y + R.h * 0.48, 26 * sc, 26 * sc); ctx.stroke(); ctx.setLineDash([]);
        emoji('🌱', cx, R.y + R.h * 0.48, 26 * sc, 0.75);
        if (s.picking !== i) emoji('👆', cx + R.w * 0.28, R.y + R.h * 0.72 + Math.sin(s.t * 4 + i) * 3, 20 * sc, 0.45 + 0.3 * Math.sin(s.t * 3 + i));
        return;
      }
      const g = p.growth, crop = CROP_BY_ID[p.crop];
      const spots = [];
      [0.42, 0.78].forEach(qy => [0.22, 0.5, 0.78].forEach(qx => spots.push([R.x + R.w * qx, R.y + R.h * qy + 4 * sc])));
      spots.forEach(([px, py], j) => {
        const sway = Math.sin(s.t * 2 + i + j) * 0.08;
        if (g < 0.1) { ctx.fillStyle = '#3f2a14'; ell(ctx, px, py, 3 * sc, 2 * sc); ctx.fill(); return; }
        if (g >= 1) { emoji(crop.icon, px, py - 12 * sc + Math.sin(s.t * 3 + i + j) * 2 * sc, 28 * sc); return; }
        const z = (6 + 22 * g) * sc;
        ctx.save(); ctx.translate(px, py); ctx.rotate(sway);
        ctx.strokeStyle = '#15803d'; ctx.lineWidth = Math.max(1.4, 2.4 * sc); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -z * 0.85); ctx.stroke();
        ctx.fillStyle = g > 0.55 ? '#16a34a' : '#4ade80';
        const leaves = g < 0.35 ? 2 : 4;
        for (let l = 0; l < leaves; l++) {
          const side = l % 2 ? 1 : -1, hy = -z * (0.75 - Math.floor(l / 2) * 0.32);
          ell(ctx, side * z * 0.32, hy, z * 0.34, z * 0.15, side * 0.5); ctx.fill();
        }
        if (g > 0.7) emoji(crop.icon, 0, -z * 0.95, 13 * sc, 0.75);   // 열매가 맺히기 시작
        ctx.restore();
      });
      // 머리 위 표시 (왼쪽엔 이름표가 있으니 오른쪽에)
      const mx = R.x + R.w * 0.8;
      if (p.bug) {
        const bx = R.x + R.w * (0.5 + 0.32 * Math.sin(s.t * 0.9 + i)), by = R.y + R.h * 0.55;
        emoji('🐛', bx, by + Math.sin(s.t * 8) * 1.5 * sc, 30 * sc);
        emoji('❗', mx, R.y - 12 * sc + Math.sin(s.t * 5 + i) * 3, 22 * sc);
      } else if (g >= 1) emoji('✨', mx, R.y - 12 * sc + Math.sin(s.t * 4 + i) * 3, 22 * sc, 0.6 + 0.4 * Math.abs(Math.sin(s.t * 3 + i)));
      else if (p.water <= 0.02) emoji('💧', mx, R.y - 14 * sc + Math.sin(s.t * 4 + i) * 3, 24 * sc, 0.6 + 0.4 * Math.abs(Math.sin(s.t * 3)));
      // 이름표 (밭 왼쪽 위 말뚝): 무엇을 심었고 얼마나 자랐는지
      {
        const stage = p.bug ? '벌레!' : g >= 1 ? '다 자랐어요!' : g < 0.1 ? '씨앗' : g < 0.35 ? '새싹' : g < 0.7 ? '쑥쑥' : '열매';
        const fs = Math.round(13 * sc), pad = 7 * sc, h = 26 * sc, x0 = R.x + 8 * k, y0 = R.y - h * 0.75;
        ctx.font = `900 ${fs}px sans-serif`;
        const nameW = ctx.measureText(crop.name).width;
        ctx.font = `800 ${Math.round(11 * sc)}px sans-serif`;
        const stageW = ctx.measureText(stage).width;
        const iconW = 18 * sc, w = pad + iconW + 3 * sc + nameW + 8 * sc + stageW + pad;
        // 말뚝
        ctx.fillStyle = '#92400e'; ctx.fillRect(x0 + 14 * sc, y0 + h - 2, 5 * sc, R.y + 14 * sc - (y0 + h));
        // 판
        const ripe = g >= 1;
        ctx.fillStyle = ripe ? '#fef08a' : p.bug ? '#fed7aa' : '#fef3c7';
        rr(ctx, x0, y0, w, h, 7 * sc); ctx.fill();
        ctx.strokeStyle = ripe ? '#eab308' : '#a16207'; ctx.lineWidth = 2 * sc; ctx.stroke();
        emoji(crop.icon, x0 + pad + iconW / 2, y0 + h / 2 + 1, 17 * sc);
        ctx.fillStyle = '#78350f'; ctx.font = `900 ${fs}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(crop.name, x0 + pad + iconW + 3 * sc, y0 + h / 2 + 1);
        ctx.fillStyle = ripe ? '#a16207' : p.bug ? '#c2410c' : '#15803d'; ctx.font = `800 ${Math.round(11 * sc)}px sans-serif`;
        ctx.fillText(stage, x0 + pad + iconW + 3 * sc + nameW + 8 * sc, y0 + h / 2 + 1);
      }
      // 자람 막대
      const bw = R.w - 26 * k, by2 = R.y + R.h - 13 * k;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, R.x + 13 * k, by2, bw, 6 * k, 3 * k); ctx.fill();
      if (g > 0.02) { ctx.fillStyle = g >= 1 ? '#facc15' : p.bug ? '#f97316' : '#4ade80'; rr(ctx, R.x + 13 * k, by2, bw * clamp(g, 0, 1), 6 * k, 3 * k); ctx.fill(); }
    };

    const draw = () => {
      const { W, H, k, dark } = s, hz = H * 0.3;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      const dusk = Math.sin(dark * Math.PI);
      const sky = ctx.createLinearGradient(0, 0, 0, hz + H * 0.05);
      sky.addColorStop(0, mixColor('#38bdf8', '#0b1437', dark));
      sky.addColorStop(1, mixColor(mixColor('#e0f2fe', '#fdba74', dusk * 0.8), '#2b4470', dark * dark));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (s.gloom > 0.01) { ctx.fillStyle = `rgba(71,85,105,${s.gloom * 0.55})`; ctx.fillRect(0, 0, W, hz + H * 0.05); }
      if (dark > 0.35) {
        ctx.globalAlpha = (dark - 0.35) / 0.65;
        ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(W * 0.45, H * 0.1, 20 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = mixColor('#38bdf8', '#0b1437', dark); ctx.beginPath(); ctx.arc(W * 0.45 + 8 * k, H * 0.1 - 5 * k, 17 * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (dark < 0.75) {
        const sx = W * 0.82, sy = H * (0.09 + dark * 0.15);
        ctx.globalAlpha = clamp((1 - dark / 0.75) * (1 - s.gloom * 1.15), 0, 1);
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + s.t * 0.15; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 30 * k, sy + Math.sin(a) * 30 * k); ctx.lineTo(sx + Math.cos(a) * 41 * k, sy + Math.sin(a) * 41 * k); ctx.stroke(); }
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(sx, sy, 24 * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = mixColor('#ffffff', '#94a3b8', s.gloom);
      clouds.forEach(c => {
        const x = ((c.off * (W + 260) + s.t * c.sp) % (W + 260)) - 130, y = c.y * H, z = 24 * k * c.sz;
        ctx.globalAlpha = 0.92 - dark * 0.78;
        [[0, 0, 1], [-1, 0.25, 0.75], [1, 0.2, 0.8], [0.4, -0.35, 0.7]].forEach(([qx, qy, qr]) => { ctx.beginPath(); ctx.arc(x + qx * z, y + qy * z, z * qr, 0, TAU); ctx.fill(); });
      });
      ctx.globalAlpha = 1;
      if (s.rainbow > 0) {
        const ra = Math.min(1, s.rainbow / 6, (40 - s.rainbow) / 3) * 0.55 * (1 - dark);
        if (ra > 0.01) {
          const cx = W * 0.5, cy = hz + H * 0.1, R0 = Math.min(W * 0.4, H * 0.42);
          ctx.lineWidth = 7 * k; ctx.globalAlpha = ra;
          ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'].forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R0 - i * 7 * k, Math.PI, TAU); ctx.stroke(); });
          ctx.globalAlpha = 1;
        }
      }
      if (s.layer) ctx.drawImage(s.layer, 0, 0, W, H);
      if (s.snowCover > 0.01) { ctx.fillStyle = `rgba(248,250,252,${s.snowCover * 0.6})`; ctx.fillRect(0, hz, W, H - hz); }

      garden.plots.forEach((p, i) => drawPlot(p, s.plots[i], i));

      // 물뿌리개
      s.cans.forEach(c => {
        const R = s.plots[c.i], a = clamp(Math.min(c.t / 0.15, (1.1 - c.t) / 0.2), 0, 1), z = 46 * k * R.sc;
        ctx.globalAlpha = a;
        drawCan(ctx, c.x - z * 0.2, c.y - z * 0.2, z, -0.55);
        ctx.fillStyle = '#7dd3fc';
        for (let j = 0; j < 9; j++) {
          const ph = fract(c.t * 2.2 + j / 9), dx = (j % 3 - 1) * 9 * k;
          ell(ctx, c.x - z * 0.2 + dx - ph * 10 * k, c.y - z * 0.2 + ph * R.h * 0.55, 2.2 * k, 3.6 * k); ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
      // 수확한 채소가 바구니(왼쪽 위)로 날아감
      s.flies.forEach(f => {
        if (f.t < 0) return;
        const q = clamp(f.t / 0.7, 0, 1), e = q * q * (3 - 2 * q);
        const x = lerp(f.x, 30 * k, e), y = lerp(f.y, 30 * k, e) - Math.sin(e * Math.PI) * 80 * k;
        emoji(f.icon, x, y, (34 - 14 * e) * k);
      });

      // 비·눈·계절
      if (s.rainAmt > 0.02) {
        ctx.strokeStyle = `rgba(191,219,254,${0.75 * s.rainAmt})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 110; i++) {
          const a = fract(i * 0.618034), b = fract(i * 0.381966 + 0.13);
          const x = fract(a + s.t * 0.04) * (W + 60) - 30, y = fract(b + s.t * (0.9 + (i % 5) * 0.08)) * H;
          ctx.moveTo(x, y); ctx.lineTo(x - 4 * k, y + 15 * k);
        }
        ctx.stroke();
      }
      if (s.snowAmt > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * s.snowAmt})`;
        for (let i = 0; i < 70; i++) {
          const a = fract(i * 0.618034), b = fract(i * 0.381966 + 0.29), r0 = (1.6 + (i % 3)) * k;
          ell(ctx, fract(a + Math.sin(s.t * 0.7 + i) * 0.012) * W, fract(b + s.t * (0.06 + (i % 4) * 0.015)) * H, r0, r0); ctx.fill();
        }
      }
      if ((s.season === 'autumn' || s.season === 'spring') && s.rainAmt < 0.6) {
        const cols = s.season === 'autumn' ? ['#f59e0b', '#ea580c', '#b45309', '#facc15'] : ['#f9a8d4', '#fbcfe8', '#fda4af', '#ffffff'];
        ctx.globalAlpha = 0.9 * (1 - s.rainAmt);
        for (let i = 0; i < 12; i++) {
          const a = fract(i * 0.618034 + 0.07), b = fract(i * 0.381966 + 0.51);
          ctx.save(); ctx.translate(fract(a + s.t * 0.018 * (1 + (i % 3) * 0.3)) * (W + 60) - 30, fract(b + s.t * (0.045 + (i % 4) * 0.012)) * H); ctx.rotate(s.t * (1 + (i % 3)) + i);
          ctx.fillStyle = cols[i % cols.length]; ell(ctx, 0, 0, (s.season === 'autumn' ? 6 : 4) * k, (s.season === 'autumn' ? 3 : 2.4) * k); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      // 나비 (봄·여름 낮, 맑을 때)
      if ((s.season === 'spring' || s.season === 'summer') && dark < 0.4 && s.rainAmt < 0.3) {
        for (let i = 0; i < 3; i++) {
          const x = (0.2 + 0.3 * i) * W + Math.sin(s.t * 0.4 + i * 2) * W * 0.12, y = H * (0.36 + 0.08 * i) + Math.sin(s.t * 1.3 + i) * 30 * k;
          emoji('🦋', x, y, 22 * k * (0.85 + 0.15 * Math.abs(Math.sin(s.t * 9 + i))), 0.95);
        }
      }
      // 밤
      if (dark > 0.02) {
        const ng = ctx.createLinearGradient(0, 0, 0, hz);
        ng.addColorStop(0, `rgba(8,16,48,${dark * 0.2})`); ng.addColorStop(1, `rgba(8,16,48,${dark * 0.45})`);
        ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
      }
      s.fx.forEach(f => emoji(f.text, f.x, f.y, 22 * k, clamp(f.life * 2, 0, 1)));
    };
    s.redraw = draw;

    let raf = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; s.t += dt;
      update(dt);
      draw();
      if (s.t - s.lastHud > 0.5) { s.lastHud = s.t; setHud(h => (h.weather === s.weather.kind && h.season === s.season ? h : { ...h, weather: s.weather.kind, season: s.season })); }
      if (s.t - s.lastSave > 5) { s.lastSave = s.t; garden.lastTick = Date.now(); saveGarden(garden); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => {
      if (document.hidden) { garden.lastTick = Date.now(); saveGarden(garden); }
      else { catchUpGarden(garden); last = performance.now(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      wrap.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVis);
      garden.lastTick = Date.now();
      saveGarden(garden);
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plantSeed = (id) => {
    if (picking && simRef.current) simRef.current.plant(picking.i, id);
    setPicking(null);
  };
  const closePicker = () => {
    if (simRef.current) simRef.current.cancelPick();
    setPicking(null);
  };
  const total = basketCount({ basket: hud.basket });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '0.7rem' }}>
      {/* 상단: 바구니 · 계절·날씨 · 씨앗 고르기 */}
      <div style={{
        background: 'linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%)', borderRadius: '22px', padding: '0.5rem 0.9rem',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0,
        border: '3px solid #bef264', boxShadow: '0 8px 22px rgba(77,124,15,0.25)'
      }}>
        <div title="바구니 (내 목장의 🧺 버튼으로 동물에게 줘요)" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef9c3', borderRadius: '18px', padding: '6px 12px', minHeight: '48px' }}>
          <span style={{ fontSize: '1.7rem', lineHeight: 1 }}>🧺</span>
          {total === 0 ? <span style={{ fontWeight: 900, color: '#854d0e', fontSize: '0.85rem' }}>비었어요</span>
            : CROPS.filter(c => hud.basket[c.id] > 0).map(c => (
              <span key={c.id} style={{ fontWeight: 900, color: '#713f12', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '1px' }}>
                <span style={{ fontSize: '1.4rem' }}>{c.icon}</span>{hud.basket[c.id]}
              </span>
            ))}
        </div>
        <div title={`${FARM_SEASONS[hud.season].name} · ${FARM_WEATHER[hud.weather].name}`} style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.18)', borderRadius: '18px', padding: '6px 10px', fontSize: '1.6rem', lineHeight: 1 }}>
          {FARM_SEASONS[hud.season].icon}{FARM_WEATHER[hud.weather].icon}
        </div>
        <div style={{ marginLeft: 'auto', color: '#ffffff', fontWeight: 900, fontSize: '0.9rem' }}>
          🌱 빈 밭 누르기 → 씨앗 고르기 · 💧 물 · 🐛 쫓기 · ✨ 수확
        </div>
      </div>

      {/* 밭 */}
      <div ref={wrapRef} style={{
        flex: 1, minHeight: '260px', position: 'relative', overflow: 'hidden', borderRadius: '18px',
        border: '7px solid #92400e', background: '#8fd672', boxShadow: '0 14px 30px rgba(63,98,18,0.3)',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer'
      }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }} />
        {/* 씨앗 고르기 창: 누른 밭 위에 띄운다 */}
        {picking && (() => {
          const ww = wrapRef.current ? wrapRef.current.clientWidth : 800, wh = wrapRef.current ? wrapRef.current.clientHeight : 600;
          // 씨앗 15종: 5칸 × 3줄 (좁은 화면은 칸 수를 줄이고 넘치면 스크롤)
          const cols = ww < 460 ? 4 : 5;
          const pw = Math.min(cols * 80 + 24, ww - 16), ph = Math.min(Math.ceil(CROPS.length / cols) * 70 + 58, wh - 16);
          const left = clamp(picking.x + picking.w / 2 - pw / 2, 8, ww - pw - 8);
          const top = clamp(picking.y + picking.h / 2 - ph / 2, 8, wh - ph - 8);
          return (
            <div data-ui onPointerDown={(e) => e.stopPropagation()} style={{
              position: 'absolute', left, top, width: pw, zIndex: 8, background: 'rgba(255,255,255,0.97)', borderRadius: '22px',
              padding: '10px 12px 12px', boxShadow: '0 14px 30px rgba(0,0,0,0.3)', border: '4px solid #facc15',
              maxHeight: ph, overflowY: 'auto', boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 900, color: '#365314', fontSize: '1rem' }}>🌰 어떤 씨앗을 심을까요?</span>
                <button onClick={closePicker} aria-label="닫기" style={{ border: 'none', background: '#e2e8f0', borderRadius: '12px', padding: '4px 10px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}>
                {CROPS.map(c => (
                  <GardenButton key={c.id} label={`${c.name} 씨앗`} color="#f7fee7" onClick={() => plantSeed(c.id)}>
                    <span style={{ fontSize: '2rem', lineHeight: 1 }}>{c.icon}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#3f6212' }}>{c.name}</span>
                  </GardenButton>
                ))}
              </div>
            </div>
          );
        })()}
        {toast && (
          <div key={toast.key} style={{
            position: 'absolute', left: '50%', top: '52px', transform: 'translateX(-50%)', zIndex: 7, pointerEvents: 'none',
            background: '#ffffff', color: '#0f172a', fontWeight: 900, padding: '10px 18px', borderRadius: '18px', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap'
          }}>{toast.text}</div>
        )}
      </div>
    </div>
  );
}
