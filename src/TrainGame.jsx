import { useEffect, useRef, useState } from 'react';
import { VOICE } from './voiceLines.js';
import { drawAnimal } from './FarmGame.jsx';
import { FARM_BY_ID } from './farmData.js';
import {
  TRAIN_STATIONS, STATION_BY_ID, PASSENGERS, CARGO_COLORS, ENGINES, ENGINE_COLORS, MAX_PASS_CARS, passCarPrice,
  CARGO_CAR_PRICE, SEATS_PER_CAR, BOXES_PER_CARGO, TOWN_DECOR, TRAIN_REWARDS, loadTrain, saveTrain, trainTodayKey, openStations
} from './trainData.js';

// ═════════════════════════════════════════════════════════════════════════════
// 🚂 기차 마을 — 동그란 철길 위를 기차가 달리고, 역에서 동물 친구를 태워 데려다준다.
// 캔버스 한 장: 고정 배경(풀밭·강·길·철길·역)은 크기·역·꾸미기가 바뀔 때만 다시 그리고,
// 기차·승객·짐·신호등·연기·산(터널)은 매 프레임 그린다. 규칙·저장은 trainData.js.
// ═════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const hex3 = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = hex3(a), B = hex3(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (ctx, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const emoji = (ctx, text, x, y, px, alpha = 1) => {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = '#000000';
  ctx.font = `${Math.round(px)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); ctx.restore();
};
// 실제 시계에 따른 어둠 0~1 (목장과 같은 규칙)
const clockDark = (d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 8 && h < 17) return 0;
  if (h >= 17 && h < 19.5) return (h - 17) / 2.5;
  if (h >= 6 && h < 8) return 1 - (h - 6) / 2;
  return 1;
};
const engineFill = (id) => (ENGINE_COLORS.find(c => c.id === id) || ENGINE_COLORS[0]).fill;

// ═══════════════════════════════ 철길 모양 ═══════════════════════════════
// 둥근 모서리 직사각형을 시계 방향으로 돈다. at(s) = 철길 길이 s 지점의 위치·방향
function buildTrack(W, H, k) {
  const L = clamp(W * 0.13, 110, 230), R = W - clamp(W * 0.07, 60, 130);
  const T = clamp(H * 0.28, 130, 240), B = H - clamp(H * 0.21, 105, 180);
  const rad = Math.min(70 * k, (B - T) / 3, (R - L) / 4);
  const pts = [];
  const sides = {};
  const line = (name, x0, y0, x1, y1) => {
    const start = pts.length;
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
    sides[name] = { start, end: pts.length };
  };
  const arc = (cx, cy, a0, a1) => { const n = 18; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
  line('top', L + rad, T, R - rad, T); arc(R - rad, T + rad, -Math.PI / 2, 0);
  line('right', R, T + rad, R, B - rad); arc(R - rad, B - rad, 0, Math.PI / 2);
  line('bottom', R - rad, B, L + rad, B); arc(L + rad, B - rad, Math.PI / 2, Math.PI);
  line('left', L, B - rad, L, T + rad); arc(L + rad, T + rad, Math.PI, Math.PI * 1.5);
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const len = cum[pts.length];
  Object.values(sides).forEach(sd => { sd.s0 = cum[sd.start]; sd.len = cum[sd.end] - cum[sd.start]; });
  const at = (s) => {
    s = ((s % len) + len) % len;
    let lo = 0, hi = pts.length;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[(lo + 1) % pts.length], seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    const dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dx, dy };
  };
  const sAt = (side, frac) => sides[side].s0 + sides[side].len * frac;
  return { L, R, T, B, rad, len, at, sAt, sides };
}
const OUTWARD = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

// ═══════════════════════════════ 기차 그림 ═══════════════════════════════
// 원점 = 차량 가운데 (바퀴는 아래), 오른쪽을 본다. w·h = 차량 크기
function drawWheels(ctx, xs, y, r, spin) {
  xs.forEach(x => {
    ctx.fillStyle = '#1f2937'; ell(ctx, x, y, r, r); ctx.fill();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = Math.max(1, r * 0.22);
    for (let i = 0; i < 3; i++) { const a = spin + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r * 0.75, y - Math.sin(a) * r * 0.75); ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); ctx.stroke(); }
    ctx.fillStyle = '#e5e7eb'; ell(ctx, x, y, r * 0.25, r * 0.25); ctx.fill();
  });
}
function drawEngine(ctx, type, color, w, h, spin, lit) {
  const dark = mix(color, '#000000', 0.35), light = mix(color, '#ffffff', 0.35);
  ctx.lineJoin = 'round';
  if (type === 'bullet') {
    // 고속열차: 하얀 몸에 색 줄무늬, 뾰족한 코
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.55); ctx.lineTo(w * 0.05, -h * 0.55);
    ctx.bezierCurveTo(w * 0.42, -h * 0.55, w * 0.62, -h * 0.05, w * 0.62, h * 0.3); ctx.lineTo(-w * 0.5, h * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(-w * 0.5, h * 0.02, w * 1.05, h * 0.14);
    ctx.fillStyle = '#1e3a8a'; ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 0.42); ctx.quadraticCurveTo(w * 0.38, -h * 0.42, w * 0.48, -h * 0.12); ctx.lineTo(w * 0.1, -h * 0.12); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 3; i++) { rr(ctx, -w * 0.44 + i * w * 0.16, -h * 0.4, w * 0.11, h * 0.24, 3); ctx.fillStyle = lit ? '#fde68a' : '#93c5fd'; ctx.fill(); }
    drawWheels(ctx, [-w * 0.3, w * 0.3], h * 0.42, h * 0.16, spin);
    return;
  }
  if (type === 'tram') {
    // 꼬마 전철: 네모난 몸, 큰 창문, 지붕의 전깃줄 손(팬터그래프)
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w * 0.15, -h * 0.72); ctx.lineTo(w * 0.05, -h * 1.0); ctx.lineTo(w * 0.22, -h * 0.72); ctx.moveTo(-w * 0.1, -h * 1.0); ctx.lineTo(w * 0.2, -h * 1.0); ctx.stroke();
    rr(ctx, -w * 0.5, -h * 0.72, w, h * 1.02, h * 0.22); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = light; ctx.fillRect(-w * 0.5, h * 0.05, w, h * 0.1);
    for (let i = 0; i < 3; i++) { rr(ctx, -w * 0.4 + i * w * 0.27, -h * 0.55, w * 0.2, h * 0.42, 4); ctx.fillStyle = lit ? '#fde68a' : '#e0f2fe'; ctx.fill(); }
    ell(ctx, w * 0.46, h * 0.12, h * 0.08, h * 0.08); ctx.fillStyle = '#fef08a'; ctx.fill();
    drawWheels(ctx, [-w * 0.28, w * 0.28], h * 0.38, h * 0.15, spin);
    return;
  }
  // 증기기관차: 둥근 보일러, 굴뚝, 운전칸, 앞의 배장기
  ctx.fillStyle = dark; ctx.fillRect(-w * 0.5, h * 0.12, w * 1.0, h * 0.14);
  rr(ctx, -w * 0.12, -h * 0.4, w * 0.58, h * 0.56, h * 0.26); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
  [0.08, 0.26].forEach(q => { ctx.fillStyle = light; ctx.fillRect(w * q, -h * 0.4, w * 0.035, h * 0.56); });
  rr(ctx, w * 0.24, -h * 0.85, w * 0.12, h * 0.48, 2); ctx.fillStyle = '#1f2937'; ctx.fill();
  rr(ctx, w * 0.2, -h * 0.92, w * 0.2, h * 0.1, 2); ctx.fill();
  ell(ctx, w * 0.06, -h * 0.44, w * 0.07, h * 0.1); ctx.fillStyle = '#facc15'; ctx.fill();
  rr(ctx, -w * 0.5, -h * 0.8, w * 0.4, h * 0.96, 4); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = dark; ctx.stroke();
  rr(ctx, -w * 0.53, -h * 0.9, w * 0.46, h * 0.14, 3); ctx.fillStyle = dark; ctx.fill();
  rr(ctx, -w * 0.42, -h * 0.68, w * 0.24, h * 0.34, 3); ctx.fillStyle = lit ? '#fde68a' : '#e0f2fe'; ctx.fill();
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.0); ctx.lineTo(w * 0.62, h * 0.32); ctx.lineTo(w * 0.42, h * 0.32); ctx.closePath(); ctx.fill();
  ell(ctx, w * 0.47, -h * 0.18, h * 0.09, h * 0.09); ctx.fillStyle = '#fef08a'; ctx.fill();
  drawWheels(ctx, [-w * 0.3], h * 0.32, h * 0.26, spin);
  drawWheels(ctx, [w * 0.08, w * 0.32], h * 0.38, h * 0.17, spin);
}
// 객차: 지붕만 있는 열린 칸. riders 는 칸 안에 서서 상체가 보이도록 먼저 그린다
function drawPassengerCar(ctx, color, w, h, spin, ridersFn) {
  const dark = mix(color, '#000000', 0.35), light = mix(color, '#ffffff', 0.55);
  rr(ctx, -w * 0.5, -h * 0.95, w, h * 0.14, 4); ctx.fillStyle = dark; ctx.fill();
  ctx.fillStyle = dark; [-0.46, 0.43].forEach(q => ctx.fillRect(w * q, -h * 0.85, w * 0.035, h * 0.7));
  if (ridersFn) ridersFn();
  rr(ctx, -w * 0.5, -h * 0.18, w, h * 0.48, 5); ctx.fillStyle = light; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = color; ctx.fillRect(-w * 0.5, h * 0.05, w, h * 0.09);
  drawWheels(ctx, [-w * 0.3, w * 0.3], h * 0.38, h * 0.15, spin);
}
function drawCargoCar(ctx, colorId, w, h, spin, boxes, highlight) {
  const c = CARGO_COLORS[colorId];
  if (highlight) { rr(ctx, -w * 0.58, -h * 0.75, w * 1.16, h * 1.25, 8); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 4; ctx.stroke(); }
  boxes.forEach((col, i) => drawBox(ctx, (i - (BOXES_PER_CARGO - 1) / 2) * w * 0.38, -h * 0.32, h * 0.42, col));
  ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.18); ctx.lineTo(w * 0.5, -h * 0.18); ctx.lineTo(w * 0.44, h * 0.3); ctx.lineTo(-w * 0.44, h * 0.3); ctx.closePath();
  ctx.fillStyle = c.fill; ctx.fill(); ctx.strokeStyle = c.dark; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
  [-0.2, 0.2].forEach(q => { ctx.beginPath(); ctx.moveTo(w * q, -h * 0.14); ctx.lineTo(w * q, h * 0.26); ctx.stroke(); });
  drawWheels(ctx, [-w * 0.28, w * 0.28], h * 0.38, h * 0.15, spin);
}
function drawBox(ctx, x, y, s, colorId) {
  const c = CARGO_COLORS[colorId];
  rr(ctx, x - s / 2, y - s / 2, s, s, s * 0.12); ctx.fillStyle = c.fill; ctx.fill(); ctx.strokeStyle = c.dark; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath(); ctx.moveTo(x - s / 2, y); ctx.lineTo(x + s / 2, y); ctx.moveTo(x, y - s / 2); ctx.lineTo(x, y + s / 2); ctx.stroke();
}

// 상점 미리보기: 기관차 그림
function EnginePreview({ type, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d'), d = window.devicePixelRatio || 1;
    c.width = 120 * d; c.height = 80 * d; ctx.scale(d, d);
    ctx.translate(60, 50); drawEngine(ctx, type, color, 84, 40, 0.4, false);
  }, [type, color]);
  return <canvas ref={ref} style={{ width: 120, height: 80 }} />;
}

// 큰 둥근 그림 버튼
function TrainButton({ icon, label, color, onClick, big, pulse }) {
  const size = big ? 84 : 66;
  return (
    <button onClick={onClick} aria-label={label} title={label} style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%', cursor: 'pointer', touchAction: 'manipulation', padding: 0,
      background: color, border: '4px solid rgba(255,255,255,0.45)', boxShadow: pulse ? '0 0 0 5px rgba(250,204,21,0.8), 0 6px 14px rgba(0,0,0,0.25)' : '0 6px 14px rgba(0,0,0,0.22)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: pulse ? 'bpsPulse 1s ease-in-out infinite' : 'none'
    }}>
      <span style={{ fontSize: big ? '2.4rem' : '1.9rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.66rem', fontWeight: 900, color: '#ffffff', marginTop: '1px' }}>{label}</span>
    </button>
  );
}

// ═══════════════════════════════ 본체 ═══════════════════════════════
export default function TrainGame({ audio, speak }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const [hud, setHud] = useState({ points: 0, deliveries: 0, running: false, at: null, red: false, riders: 0, seats: 3 });
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState('train');
  const [toast, setToast] = useState(null);
  const [, setTick] = useState(0);
  const showToast = (text) => setToast({ text, key: Date.now() });
  useEffect(() => { if (!toast) return undefined; const tm = setTimeout(() => setToast(null), 2600); return () => clearTimeout(tm); }, [toast]);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, ctx = canvas.getContext('2d');
    const game = loadTrain();
    if (!Array.isArray(game.riders)) game.riders = [];
    if (!Array.isArray(game.loaded)) game.loaded = [];
    const s = {
      game, W: 0, H: 0, dpr: 1, k: 1, t: 0, track: null, layer: null, layerKey: '',
      pos: 0, vel: 0, running: false, at: null, lastStop: null, lastStopS: -1e9,
      signal: { red: false, decided: false, redT: 0 }, gateDown: false, bellT: 0,
      waiting: {}, boxes: {}, selBox: null, fx: [], smoke: [], cars: [], hits: [],
      roadCars: [{ x: -60, dir: 1, color: '#3b82f6' }, { x: 9999, dir: -1, color: '#f59e0b' }],
      chugT: 0, chugA: false, dark: clockDark(), clockT: 0, spawnT: 3, boxT: 6, lastHud: 0, lastSave: 0, lastVoice: {}, unloadQ: []
    };
    simRef.current = s;
    const timers = [];
    const after = (fn, ms) => timers.push(setTimeout(fn, ms));
    const say = (key, line, gap = 0) => { if (gap && s.t - (s.lastVoice[key] ?? -1e9) < gap) return; s.lastVoice[key] = s.t; speak(line); };
    s.say = say;
    const addPoints = (n, x, y) => { game.points += n; if (x != null) s.fx.push({ x, y, text: `+${n} ⭐`, life: 1.4, vy: -34 }); };
    const pop = (x, y, text, n = 1) => { for (let i = 0; i < n; i++) s.fx.push({ x: x + rand(-18, 18), y: y + rand(-8, 8), text, life: rand(0.8, 1.3), vy: rand(-46, -24) }); };

    // 오늘의 선물·환영
    if (!game.welcomed) { game.welcomed = true; game.lastDaily = trainTodayKey(); after(() => speak(VOICE.trainWelcome()), 500); }
    else if (game.lastDaily !== trainTodayKey()) { game.lastDaily = trainTodayKey(); game.points += TRAIN_REWARDS.daily; after(() => showToast(`🎁 오늘의 선물! 별 +${TRAIN_REWARDS.daily}`), 400); }
    saveTrain(game);

    // ── 차량 구성: 기관차 → 객차들 → 화물칸들 ──
    const seats = () => game.passCars * SEATS_PER_CAR;
    const carList = () => {
      const list = [{ kind: 'engine' }];
      for (let i = 0; i < game.passCars; i++) list.push({ kind: 'pass', idx: i });
      game.cargo.forEach((col, i) => list.push({ kind: 'cargo', idx: i, color: col }));
      return list;
    };
    const loadedOf = (i) => (game.loaded[i] || (game.loaded[i] = []));

    // ── 역의 승객·짐 ──
    const stations = () => openStations(game);
    const newWaiter = (st) => {
      const others = stations().filter(o => o.id !== st.id);
      return { sp: pick(PASSENGERS), want: pick(others).id, hop: 0, id: Math.random() };
    };
    stations().forEach(st => {
      s.waiting[st.id] = Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => newWaiter(st));
      s.boxes[st.id] = game.cargo.length && Math.random() < 0.7 ? [{ color: pick(game.cargo), id: Math.random() }] : [];
    });

    // ── 크기·고정 배경 ──
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      s.W = Math.max(320, r.width); s.H = Math.max(260, r.height);
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.k = clamp(Math.min(s.W, s.H * 1.5) / 720, 0.72, 1.5);
      canvas.width = Math.round(s.W * s.dpr); canvas.height = Math.round(s.H * s.dpr);
      canvas.style.width = `${s.W}px`; canvas.style.height = `${s.H}px`;
      const oldLen = s.track ? s.track.len : 0;
      s.track = buildTrack(s.W, s.H, s.k);
      if (oldLen) s.pos = s.pos / oldLen * s.track.len;
      s.layerKey = '';
    };
    const sOfStation = (st) => s.track.sAt(st.side, st.frac);
    const signalS = () => s.track.sAt('left', 0.3);
    const crossS = () => s.track.sAt('left', 0.47);
    const tunnel = () => [s.track.sAt('right', 0.22), s.track.sAt('right', 0.78)];
    const bridge = () => [s.track.sAt('bottom', 0.42), s.track.sAt('bottom', 0.6)];

    const buildLayer = () => {
      const { W, H, k, track: tr } = s;
      const c = document.createElement('canvas');
      c.width = Math.round(W * s.dpr); c.height = Math.round(H * s.dpr);
      const g = c.getContext('2d'); g.scale(s.dpr, s.dpr);
      const rnd = seeded(77);
      // 풀밭
      const gg = g.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, '#a3e3a0'); gg.addColorStop(1, '#6cc86a');
      g.fillStyle = gg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, tr.L + 30 * k, tr.T + 30 * k, tr.R - tr.L - 60 * k, tr.B - tr.T - 60 * k, 40 * k); g.fill();
      for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H, sz = (3 + rnd() * 4) * k; g.strokeStyle = `rgba(34,120,50,${0.25 + rnd() * 0.3})`; g.lineWidth = 1.5; [-0.5, 0, 0.5].forEach(a => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * sz, y - Math.cos(a) * sz); g.stroke(); }); }
      // 강 (아래 변의 다리 밑으로 흐른다)
      const [b0, b1] = bridge(), bx0 = tr.at(b1).x, bx1 = tr.at(b0).x, rw = (bx1 - bx0) * 0.6, rx = (bx0 + bx1) / 2;
      g.fillStyle = '#38bdf8'; g.beginPath(); g.moveTo(rx - rw / 2, tr.T + 80 * k);
      g.bezierCurveTo(rx - rw, (tr.T + tr.B) / 2, rx, tr.B - 40 * k, rx - rw / 2, H); g.lineTo(rx + rw / 2, H);
      g.bezierCurveTo(rx + rw, tr.B - 40 * k, rx + rw * 0.2, (tr.T + tr.B) / 2, rx + rw / 2, tr.T + 80 * k); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const yy = tr.T + 120 * k + i * (H - tr.T) / 7; g.beginPath(); g.moveTo(rx - 10 * k, yy); g.quadraticCurveTo(rx, yy - 5 * k, rx + 10 * k, yy); g.stroke(); }
      // 길과 건널목 (왼 변)
      const cp = tr.at(crossS()), roadH = 30 * k;
      g.fillStyle = '#94a3b8'; g.fillRect(0, cp.y - roadH / 2, tr.L + 110 * k, roadH);
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.setLineDash([10 * k, 8 * k]);
      g.beginPath(); g.moveTo(0, cp.y); g.lineTo(tr.L - 30 * k, cp.y); g.moveTo(tr.L + 30 * k, cp.y); g.lineTo(tr.L + 110 * k, cp.y); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#facc15'; rr(g, tr.L + 104 * k, cp.y - 22 * k, 34 * k, 44 * k, 6 * k); g.fill();
      emoji(g, '🏪', tr.L + 121 * k, cp.y, 26 * k);
      // 침목과 레일
      const step = 15 * k;
      for (let sl = 0; sl < tr.len; sl += step) {
        const p = tr.at(sl), nx = -p.dy, ny = p.dx;
        g.strokeStyle = '#92400e'; g.lineWidth = 5 * k; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(p.x - nx * 11 * k, p.y - ny * 11 * k); g.lineTo(p.x + nx * 11 * k, p.y + ny * 11 * k); g.stroke();
      }
      [-6, 6].forEach(off => {
        g.strokeStyle = '#64748b'; g.lineWidth = 3 * k; g.lineCap = 'round'; g.beginPath();
        for (let sl = 0; sl <= tr.len; sl += 4) { const p = tr.at(sl), x = p.x - p.dy * off * k, y = p.y + p.dx * off * k; if (sl === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.closePath(); g.stroke();
      });
      // 다리 난간
      g.fillStyle = '#b45309';
      [-15, 13].forEach(off => { g.fillRect(bx0 - 6 * k, tr.B + off * k, bx1 - bx0 + 12 * k, 3 * k); for (let x = bx0; x <= bx1; x += 12 * k) g.fillRect(x, tr.B + (off < 0 ? off - 5 : off) * k, 2.5 * k, 8 * k); });
      // 건널목 판
      g.fillStyle = '#e2e8f0'; g.fillRect(tr.L - 16 * k, cp.y - roadH / 2, 32 * k, roadH);
      // 역 (승강장·지붕·이름표)
      stations().forEach(st => {
        const p = tr.at(sOfStation(st)), [ox, oy] = OUTWARD[st.side], along = st.side === 'left' ? [0, 1] : [1, 0];
        const cx = p.x + ox * 34 * k, cy = p.y + oy * 34 * k, plen = 170 * k, pw = 30 * k;
        g.fillStyle = '#e7d3b0'; g.strokeStyle = '#a16207'; g.lineWidth = 2;
        if (st.side === 'left') rr(g, cx - pw / 2, cy - plen / 2, pw, plen, 6 * k); else rr(g, cx - plen / 2, cy - pw / 2, plen, pw, 6 * k);
        g.fill(); g.stroke();
        // 이름표
        const lx = cx + ox * 34 * k - along[0] * 0, ly = cy + oy * (st.side === 'top' ? 92 : 30) * k + (st.side === 'left' ? -plen / 2 - 18 * k : 0);
        g.font = `900 ${Math.round(13 * k)}px system-ui, sans-serif`;
        const label = `${st.icon} ${st.name}`, tw = g.measureText(label).width + 16 * k;
        const tx = st.side === 'left' ? cx : cx - plen / 2 + tw / 2 + 4 * k, ty = st.side === 'left' ? cy - plen / 2 - 16 * k : st.side === 'top' ? cy - 86 * k : cy + 30 * k;
        rr(g, tx - tw / 2, ty - 12 * k, tw, 24 * k, 10 * k); g.fillStyle = st.color; g.fill();
        g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, tx, ty + 1);
        // 가로등
        const lpx = st.side === 'left' ? cx - pw * 0.8 : cx + plen / 2 - 8 * k, lpy = st.side === 'left' ? cy + plen / 2 - 8 * k : cy;
        g.strokeStyle = '#334155'; g.lineWidth = 3; g.beginPath(); g.moveTo(lpx, lpy); g.lineTo(lpx, lpy - 34 * k); g.stroke();
        ell(g, lpx, lpy - 36 * k, 5 * k, 5 * k); g.fillStyle = '#fef9c3'; g.fill();
        st._lamp = [lpx, lpy - 36 * k];
        void lx; void ly;
      });
      s.layer = c;
    };

    // ── 마을 꾸미기 (매 프레임: 풍차·관람차가 돈다) ──
    const drawDecor = () => {
      const { k, track: tr, t } = s, iw = tr.R - tr.L - 120 * k, ih = tr.B - tr.T - 120 * k, ix = tr.L + 60 * k, iy = tr.T + 60 * k;
      s.decorPos = {};
      game.decor.forEach(id => {
        const d = TOWN_DECOR.find(o => o.id === id); if (!d) return;
        const x = ix + iw * d.x, y = iy + ih * d.y, z = 46 * k;
        s.decorPos[id] = [x, y];
        const wig = s.wiggle && s.wiggle.id === id ? Math.sin(s.wiggle.t * 30) * 0.15 * s.wiggle.t : 0;
        ctx.save(); ctx.translate(x, y); ctx.rotate(wig);
        if (id === 'windmill') {
          ctx.fillStyle = '#f5f5f4'; ctx.beginPath(); ctx.moveTo(-14 * k, 26 * k); ctx.lineTo(-8 * k, -24 * k); ctx.lineTo(8 * k, -24 * k); ctx.lineTo(14 * k, 26 * k); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.save(); ctx.translate(0, -24 * k); ctx.rotate(t * 1.2);
          for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#fca5a5'; ctx.fillRect(-4 * k, 0, 8 * k, 30 * k); }
          ctx.restore();
        } else if (id === 'ferris') {
          ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3; ell(ctx, 0, -14 * k, 30 * k, 30 * k); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-18 * k, 26 * k); ctx.lineTo(0, -14 * k); ctx.lineTo(18 * k, 26 * k); ctx.stroke();
          for (let i = 0; i < 8; i++) { const a = t * 0.5 + i * TAU / 8; ell(ctx, Math.cos(a) * 30 * k, -14 * k + Math.sin(a) * 30 * k + 4 * k, 5 * k, 4 * k); ctx.fillStyle = ['#f43f5e', '#facc15', '#22c55e', '#3b82f6'][i % 4]; ctx.fill(); }
        } else if (id === 'balloon') {
          const by = Math.sin(t * 0.8) * 8 * k;
          ell(ctx, 0, -10 * k + by, 22 * k, 26 * k); ctx.fillStyle = '#f97316'; ctx.fill();
          ctx.fillStyle = '#fde047'; ctx.fillRect(-4 * k, -36 * k + by, 8 * k, 52 * k);
          ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-12 * k, 10 * k + by); ctx.lineTo(-6 * k, 22 * k + by); ctx.moveTo(12 * k, 10 * k + by); ctx.lineTo(6 * k, 22 * k + by); ctx.stroke();
          ctx.fillStyle = '#92400e'; ctx.fillRect(-7 * k, 22 * k + by, 14 * k, 9 * k);
        } else if (id === 'rainbow') {
          ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((c2, i) => { ctx.strokeStyle = c2; ctx.lineWidth = 5 * k; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(0, 20 * k, (60 - i * 5) * k, Math.PI, TAU); ctx.stroke(); });
          ctx.globalAlpha = 1;
        } else if (id === 'pond') {
          ell(ctx, 0, 6 * k, 40 * k, 16 * k); ctx.fillStyle = '#7dd3fc'; ctx.fill();
          emoji(ctx, '🦆', -10 * k + Math.sin(t * 0.7) * 10 * k, 0, 20 * k);
        } else if (id === 'lighthouse') {
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-10 * k, 28 * k); ctx.lineTo(-6 * k, -26 * k); ctx.lineTo(6 * k, -26 * k); ctx.lineTo(10 * k, 28 * k); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ef4444'; ctx.fillRect(-8 * k, -6 * k, 16 * k, 8 * k); ctx.fillRect(-9 * k, 14 * k, 18 * k, 8 * k);
          ctx.fillStyle = '#fde047'; ctx.fillRect(-7 * k, -34 * k, 14 * k, 9 * k);
          if (s.dark > 0.3) { ctx.save(); ctx.globalAlpha = s.dark * 0.35; ctx.fillStyle = '#fef08a'; ctx.rotate(Math.sin(t) * 0.8); ctx.beginPath(); ctx.moveTo(0, -30 * k); ctx.lineTo(120 * k, -60 * k); ctx.lineTo(120 * k, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
        } else emoji(ctx, d.icon, 0, 0, z);
        ctx.restore();
        s.hits.push({ kind: 'decor', id, x, y, r: 30 * k });
      });
    };

    // ── 소리 ──
    const whistle = () => { audio.playFreq(523, 'triangle', 0.55, 0.28); audio.playFreq(659, 'triangle', 0.55, 0.22); setTimeout(() => audio.playFreq(784, 'triangle', 0.3, 0.18), 180); };
    s.whistle = whistle;

    // ── 출발·멈춤 ──
    s.go = () => {
      if (s.running) return;
      if (s.signal.red && s.signalHold) { say('red', VOICE.trainRed(), 3); return; }
      s.running = true;
      if (s.at) { s.lastStop = s.at; s.lastStopS = s.pos; s.at = null; s.selBox = null; }
      whistle(); say('go', VOICE.trainGo(), 2);
    };
    s.halt = () => { if (!s.running) return; s.running = false; say('stop', VOICE.trainStop(), 2); audio.playFreq(1300, 'sawtooth', 0.18, 0.04); };

    // 역에서 할 일이 있는지 (없으면 그냥 지나간다)
    const ridersFor = (st) => game.riders.filter(r => r.want === st.id).length;
    const needStop = (st) => {
      if (ridersFor(st)) return true;
      if ((s.waiting[st.id] || []).length && game.riders.length < seats()) return true;
      if (game.loaded.some((l, i) => (l || []).some(b => b.from !== st.id)) ) return true;
      if ((s.boxes[st.id] || []).some(b => game.cargo.includes(b.color))) return true;
      return false;
    };
    // 역에 도착: 내릴 친구 → 짐 내리기 → 탈 친구는 아이가 눌러서
    const arrive = (st) => {
      s.at = st.id; s.running = false; s.vel = 0;
      say('arrive', VOICE.trainArrive(st), 1);
      audio.playFreq(880, 'sine', 0.12, 0.25); setTimeout(() => audio.playFreq(660, 'sine', 0.18, 0.25), 140);
      const off = game.riders.map((r, i) => ({ r, i })).filter(o => o.r.want === st.id);
      let delay = 1300;
      off.forEach((o, j) => {
        after(() => {
          const idx = game.riders.indexOf(o.r); if (idx < 0) return;
          game.riders.splice(idx, 1);
          const p = s.track.at(sOfStation(st)), [ox, oy] = OUTWARD[st.side];
          addPoints(TRAIN_REWARDS.alight, p.x + ox * 60 * s.k, p.y + oy * 60 * s.k - 30 * s.k);
          pop(p.x + ox * 50 * s.k, p.y + oy * 50 * s.k - 20 * s.k, '💗', 3);
          audio.playYum();
          game.deliveries++;
          if (j === 0) say('alight', VOICE.trainAlight(FARM_BY_ID[o.r.sp]));
          // 새 역이 열렸나
          const snow = STATION_BY_ID.snow;
          if (game.deliveries === snow.unlockAt) {
            s.waiting.snow = [newWaiter(snow)]; s.boxes.snow = [];
            s.layerKey = '';
            after(() => { audio.playFanfare(); say('newst', VOICE.trainNewStation()); showToast('❄️ 새 역이 생겼어요! 눈꽃역'); }, 1500);
          }
          saveTrain(game);
        }, delay + j * 900);
      });
      delay += off.length * 900;
      const boxCount = game.loaded.reduce((n, l) => n + (l || []).filter(b => b.from !== st.id).length, 0);
      if (boxCount) {
        after(() => {
          game.loaded = game.loaded.map(l => (l || []).filter(b => b.from === st.id));
          const p = s.track.at(sOfStation(st));
          addPoints(TRAIN_REWARDS.unload * boxCount, p.x, p.y - 40 * s.k);
          audio.playSnap(); say('unload', VOICE.trainUnload(), 2);
          saveTrain(game);
        }, delay + 200);
      }
    };

    // ── 입력 ──
    const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return;
      const { x, y } = local(e);
      for (let i = s.hits.length - 1; i >= 0; i--) {
        const h = s.hits[i];
        if (Math.hypot(h.x - x, h.y - y) > h.r) continue;
        if (h.kind === 'waiter') {
          const list = s.waiting[h.st]; const w = list && list[h.idx]; if (!w) return;
          w.hop = 0.5;
          if (s.at !== h.st) { audio.playBubble(); say('waittrain', VOICE.trainWaitTrain(), 4); return; }
          if (game.riders.length >= seats()) { say('full', VOICE.trainFull(), 3); audio.playFreq(220, 'sine', 0.2, 0.2); return; }
          list.splice(h.idx, 1);
          game.riders.push({ sp: w.sp, want: w.want });
          addPoints(TRAIN_REWARDS.board, x, y - 30 * s.k);
          audio.playPopSound();
          const n = game.riders.length;
          say('board', VOICE.trainBoard(FARM_BY_ID[w.sp], STATION_BY_ID[w.want]));
          if (n >= 2) after(() => say('count', VOICE.trainCount(n), 2), 2600);
          saveTrain(game);
          return;
        }
        if (h.kind === 'box') {
          const b = (s.boxes[h.st] || [])[h.idx]; if (!b) return;
          if (s.at !== h.st) { audio.playBubble(); say('waittrain', VOICE.trainWaitTrain(), 4); return; }
          if (!game.cargo.includes(b.color)) { say('nocar', VOICE.trainBoxNoCar(CARGO_COLORS[b.color]), 3); return; }
          s.selBox = { st: h.st, id: b.id, color: b.color };
          audio.playFreq(700, 'sine', 0.1, 0.3);
          say('box', VOICE.trainBox(CARGO_COLORS[b.color]), 1.5);
          return;
        }
        if (h.kind === 'cargo') {
          if (!s.selBox) { whistle(); return; }
          const col = game.cargo[h.idx], load = loadedOf(h.idx);
          if (col !== s.selBox.color) { say('wrong', VOICE.trainBoxWrong(), 2); audio.playFreq(200, 'sawtooth', 0.15, 0.12); return; }
          if (load.length >= BOXES_PER_CARGO) { say('full', VOICE.trainFull(), 3); return; }
          const list = s.boxes[s.selBox.st], bi = list.findIndex(b => b.id === s.selBox.id);
          if (bi >= 0) list.splice(bi, 1);
          load.push({ color: col, from: s.selBox.st });
          addPoints(TRAIN_REWARDS.load, x, y - 30 * s.k);
          audio.playSnap(); say('boxok', VOICE.trainBoxOk(CARGO_COLORS[col]), 1);
          s.selBox = null; saveTrain(game);
          return;
        }
        if (h.kind === 'signal') {
          if (s.signal.red) { s.signal.red = false; s.signalHold = false; say('green', VOICE.trainGreen(), 1); audio.playFreq(900, 'sine', 0.15, 0.3); if (s.wantRun) s.running = true; }
          else audio.playBubble();
          return;
        }
        if (h.kind === 'engine') { whistle(); return; }
        if (h.kind === 'decor') { s.wiggle = { id: h.id, t: 1 }; audio.playPopSound(); return; }
      }
    };
    wrap.addEventListener('pointerdown', onDown);

    // ── 한 프레임: 움직임 ──
    const update = (dt) => {
      const tr = s.track, len = tr.len, k = s.k, VMAX = 115 * k, ACC = 70 * k;
      // 다음에 멈출 곳 (역·빨간 신호)
      let stopDist = Infinity, stopWhat = null;
      if (s.running) {
        stations().forEach(st => {
          if (st.id === s.lastStop && ((s.pos - s.lastStopS + len) % len) < 60 * k) return;   // 방금 떠난 역
          const d = (sOfStation(st) - s.pos + len) % len;
          if (d < stopDist && needStop(st)) { stopDist = d; stopWhat = { st }; }
        });
        // 신호등: 다가갈 때 한 바퀴에 한 번 정한다 (반쯤은 빨간불)
        const ds = (signalS() - s.pos + len) % len;
        if (ds < 160 * k && ds > 20 * k && !s.signal.decided) { s.signal.decided = true; if (Math.random() < 0.5) { s.signal.red = true; s.signal.redT = 0; } }
        if (ds > len * 0.5) s.signal.decided = false;
        if (s.signal.red && ds < stopDist && ds < len * 0.5) { stopDist = ds; stopWhat = { signal: true }; }
      }
      if (s.signal.red) { s.signal.redT += dt; if (s.signal.redT > 7) { s.signal.red = false; s.signalHold = false; if (s.wantRun) { s.running = true; say('green', VOICE.trainGreen(), 2); } } }
      // 속도
      const vAllowed = stopWhat ? Math.sqrt(2 * ACC * Math.max(0, stopDist - 1)) : VMAX;
      if (s.running) s.vel = Math.min(VMAX, vAllowed, s.vel + ACC * dt);
      else s.vel = Math.max(0, s.vel - ACC * 2 * dt);
      s.pos = (s.pos + s.vel * dt) % len;
      if (stopWhat && stopDist <= Math.max(1.5, s.vel * dt + 0.5)) {
        if (stopWhat.st) { s.pos = sOfStation(stopWhat.st); arrive(stopWhat.st); }
        else if (stopWhat.signal) { s.vel = 0; s.running = false; s.wantRun = true; s.signalHold = true; say('red', VOICE.trainRed(), 4); }
      }
      if (s.running) s.wantRun = false;
      // 칙칙폭폭 (속도에 맞춰), 터널은 작게, 다리는 덜컹
      const head = s.pos, [t0, t1] = tunnel(), [b0, b1] = bridge();
      const inTunnel = head > t0 && head < t1, onBridge = head > b0 && head < b1;
      if (s.vel > 5) {
        s.chugT -= dt * (s.vel / VMAX);
        if (s.chugT <= 0) {
          s.chugT = 0.32; s.chugA = !s.chugA;
          audio.playFreq(s.chugA ? 95 : 75, 'square', 0.06, inTunnel ? 0.03 : 0.07);
          if (onBridge) audio.playFreq(320, 'triangle', 0.04, 0.08);
          if (game.engine === 'steam') { const ep = engineSpot(); if (ep) s.smoke.push({ x: ep.x, y: ep.y, r: 6 * k, life: 1.6, vx: rand(-8, 8), vy: -26 * k }); }
        }
      }
      // 건널목 차단기: 기차가 가까우면 내려가고 땡땡
      const dc = Math.abs(((crossS() - s.pos + len * 1.5) % len) - len * 0.5);
      const trainLen = carList().length * 62 * k;
      s.gateDown = (crossS() - s.pos + len) % len < 140 * k || ((s.pos - crossS() + len) % len) < trainLen + 30 * k;
      if (s.gateDown && (s.vel > 2 || dc < 200 * k)) { s.bellT -= dt; if (s.bellT <= 0) { s.bellT = 0.5; audio.playFreq(1250, 'square', 0.06, 0.05); } }
      // 자동차: 차단기가 내려가면 건널목 앞에서 기다린다
      const cp = tr.at(crossS()), stopL = tr.L - 46 * k, stopR = tr.L + 46 * k;
      s.roadCars.forEach(c => {
        if (c.x > 5000) c.x = tr.L + 100 * k;
        const v = 70 * k * c.dir, nx = c.x + v * dt;
        const blocked = s.gateDown && ((c.dir > 0 && c.x <= stopL && nx > stopL) || (c.dir < 0 && c.x >= stopR && nx < stopR));
        if (!blocked) c.x = nx;
        if (c.dir > 0 && c.x > tr.L + 100 * k) c.x = -40 * k;
        if (c.dir < 0 && c.x < -40 * k) c.x = tr.L + 100 * k;
        c.y = cp.y + (c.dir > 0 ? 7 : -7) * k;
      });
      // 역에 승객·짐이 다시 생긴다
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.spawnT = rand(6, 11);
        const st = pick(stations().filter(o => (s.waiting[o.id] || []).length < 3) || []);
        if (st) (s.waiting[st.id] = s.waiting[st.id] || []).push(newWaiter(st));
      }
      s.boxT -= dt;
      if (s.boxT <= 0) {
        s.boxT = rand(9, 15);
        if (game.cargo.length) { const st = pick(stations().filter(o => (s.boxes[o.id] || []).length < 3) || []); if (st) (s.boxes[st.id] = s.boxes[st.id] || []).push({ color: pick(game.cargo), id: Math.random() }); }
      }
      // 효과
      Object.values(s.waiting).forEach(list => list.forEach(w => { w.hop = Math.max(0, w.hop - dt); }));
      s.fx.forEach(f => { f.life -= dt; f.y += f.vy * dt; }); s.fx = s.fx.filter(f => f.life > 0);
      s.smoke.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 10 * k * dt; }); s.smoke = s.smoke.filter(p => p.life > 0);
      if (s.wiggle) { s.wiggle.t -= dt * 1.5; if (s.wiggle.t <= 0) s.wiggle = null; }
      s.clockT -= dt; if (s.clockT <= 0) { s.clockT = 10; s.dark = clockDark(); }
    };
    // 증기기관차 굴뚝 위치 (연기)
    const engineSpot = () => { const p = s.track.at(s.pos), dir = p.dx < -0.3 ? -1 : 1; return { x: p.x + dir * 0.3 * 70 * s.k, y: p.y - 46 * s.k }; };

    // ── 그리기 ──
    const draw = () => {
      const { W, H, k, track: tr, t } = s;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      const key = `${W}x${H}|${stations().length}|${s.dpr}`;
      if (key !== s.layerKey) { s.layerKey = key; buildLayer(); }
      ctx.drawImage(s.layer, 0, 0, W, H);
      s.hits = [];
      drawDecor();

      // 건널목 차단기·신호등
      const cp = tr.at(crossS()), sp2 = tr.at(signalS());
      [-1, 1].forEach(side => {
        const px = tr.L + side * 30 * k, py = cp.y + side * 20 * k;
        ctx.fillStyle = '#334155'; ctx.fillRect(px - 2 * k, py - 26 * k, 4 * k, 28 * k);
        ctx.save(); ctx.translate(px, py - 24 * k); ctx.rotate(s.gateDown ? 0 : -side * 1.3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(side > 0 ? -44 * k : 0, -2.5 * k, 44 * k, 5 * k);
        ctx.fillStyle = '#ef4444'; for (let i = 0; i < 4; i++) ctx.fillRect((side > 0 ? -44 : 0) * k + i * 11 * k, -2.5 * k, 5 * k, 5 * k);
        ctx.restore();
        if (s.gateDown) { ell(ctx, px, py - 30 * k, 4 * k, 4 * k); ctx.fillStyle = Math.sin(t * 12 + side) > 0 ? '#ef4444' : '#7f1d1d'; ctx.fill(); }
      });
      const sgx = sp2.x - 30 * k, sgy = sp2.y;
      ctx.fillStyle = '#334155'; ctx.fillRect(sgx - 2 * k, sgy - 4 * k, 4 * k, 30 * k);
      rr(ctx, sgx - 11 * k, sgy - 46 * k, 22 * k, 44 * k, 6 * k); ctx.fillStyle = '#1f2937'; ctx.fill();
      ell(ctx, sgx, sgy - 34 * k, 7 * k, 7 * k); ctx.fillStyle = s.signal.red ? '#ef4444' : '#450a0a'; ctx.fill();
      ell(ctx, sgx, sgy - 14 * k, 7 * k, 7 * k); ctx.fillStyle = s.signal.red ? '#14532d' : '#22c55e'; ctx.fill();
      if (s.signal.red && s.signalHold) { ctx.strokeStyle = `rgba(250,204,21,${0.6 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 3; ell(ctx, sgx, sgy - 24 * k, 22 * k, 30 * k); ctx.stroke(); }
      s.hits.push({ kind: 'signal', x: sgx, y: sgy - 24 * k, r: 30 * k });
      // 자동차
      s.roadCars.forEach(c => {
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.dir, 1);
        rr(ctx, -16 * k, -7 * k, 32 * k, 12 * k, 4 * k); ctx.fillStyle = c.color; ctx.fill();
        rr(ctx, -8 * k, -13 * k, 18 * k, 8 * k, 3 * k); ctx.fill();
        ctx.fillStyle = '#e0f2fe'; ctx.fillRect(-5 * k, -11 * k, 6 * k, 5 * k); ctx.fillRect(3 * k, -11 * k, 5 * k, 5 * k);
        ctx.fillStyle = '#1f2937'; ell(ctx, -9 * k, 5 * k, 4 * k, 4 * k); ctx.fill(); ell(ctx, 10 * k, 5 * k, 4 * k, 4 * k); ctx.fill();
        ctx.restore();
      });

      // 역에서 기다리는 친구·짐
      stations().forEach(st => {
        const p = tr.at(sOfStation(st)), [ox, oy] = OUTWARD[st.side], along = st.side === 'left' ? [0, -1] : [1, 0];
        const base = st.side === 'top' ? 40 : st.side === 'bottom' ? 46 : 44;
        (s.waiting[st.id] || []).forEach((w, i) => {
          const off = (i - 1) * 46 * k + (st.side === 'left' ? 10 * k : -12 * k);
          const fx = p.x + ox * base * k + along[0] * off, fy = p.y + oy * base * k + along[1] * off + (st.side === 'bottom' ? 14 * k : st.side === 'top' ? 4 * k : 14 * k);
          const hop = w.hop > 0 ? -Math.sin(w.hop / 0.5 * Math.PI) * 10 * k : 0;
          const sp = FARM_BY_ID[w.sp];
          ctx.save(); ctx.translate(fx, fy + hop); ctx.scale(st.side === 'left' ? 1 : (i % 2 ? -1 : 1), 1);
          drawAnimal(ctx, sp, 34 * k, { phase: 0, moving: 0, growth: 1, t, blink: Math.sin(t * 0.7 + i * 2) > 0.97 });
          ctx.restore();
          // 가고 싶은 역 말풍선
          const want = STATION_BY_ID[w.want], bx = fx + 16 * k, by = fy - 52 * k + hop;
          ell(ctx, bx, by, 15 * k, 13 * k); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = want.color; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(bx - 8 * k, by + 9 * k); ctx.lineTo(bx - 12 * k, by + 18 * k); ctx.lineTo(bx - 2 * k, by + 11 * k); ctx.fill();
          emoji(ctx, want.icon, bx, by + 1, 16 * k);
          if (s.at === st.id) { ctx.strokeStyle = `rgba(250,204,21,${0.55 + Math.sin(t * 6) * 0.35})`; ctx.lineWidth = 3; ell(ctx, fx, fy - 16 * k, 22 * k, 24 * k); ctx.stroke(); }
          s.hits.push({ kind: 'waiter', st: st.id, idx: i, x: fx, y: fy - 16 * k, r: 28 * k });
        });
        (s.boxes[st.id] || []).forEach((b, i) => {
          const off = (st.side === 'left' ? -1 : 1) * (78 + i * 18) * k;
          const bx = p.x + ox * 34 * k + along[0] * off, by = p.y + oy * 34 * k + along[1] * off - (st.side === 'left' ? 0 : 8 * k);
          const sel = s.selBox && s.selBox.id === b.id;
          drawBox(ctx, bx, by - (sel ? 6 * k + Math.abs(Math.sin(t * 8)) * 4 * k : 0), 15 * k, b.color);
          if (sel) { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ell(ctx, bx, by - 6 * k, 14 * k, 14 * k); ctx.stroke(); }
          s.hits.push({ kind: 'box', st: st.id, idx: i, x: bx, y: by, r: 16 * k });
        });
      });

      // 기차: 기관차 → 객차 → 화물칸, 철길을 따라 간격을 두고
      const cars = carList(), gap = 62 * k, cw = 58 * k, ch = 34 * k, spin = s.pos / (10 * k);
      const lit = s.dark > 0.4;
      let riderIdx = 0;
      const placed = cars.map((c, i) => { const p = tr.at(s.pos - i * gap); return { c, p, i }; });
      // 아래쪽에 있는 차를 나중에 (앞으로 보이게)
      const order = placed.slice().sort((a, b) => a.p.y - b.p.y);
      const riderStart = {}; let acc = 0;
      cars.forEach((c, i) => { if (c.kind === 'pass') { riderStart[i] = acc; acc += SEATS_PER_CAR; } });
      order.forEach(({ c, p, i }) => {
        const dir = p.dx < -0.3 ? -1 : p.dx > 0.3 ? 1 : (s.lastDir || 1);
        if (i === 0) s.lastDir = dir;
        ctx.save(); ctx.translate(p.x, p.y - ch * 0.42); ctx.scale(dir, 1);
        if (c.kind === 'engine') {
          drawEngine(ctx, game.engine, engineFill(game.color), cw * 1.2, ch, spin, lit);
          ctx.restore();
          s.hits.push({ kind: 'engine', x: p.x, y: p.y - ch * 0.5, r: 36 * k });
          if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * s.dark; ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.moveTo(p.x + dir * 30 * k, p.y - ch * 0.5); ctx.lineTo(p.x + dir * 150 * k, p.y - ch * 1.1); ctx.lineTo(p.x + dir * 150 * k, p.y + ch * 0.4); ctx.closePath(); ctx.fill(); ctx.restore(); }
          return;
        }
        if (c.kind === 'pass') {
          const start = riderStart[i];
          drawPassengerCar(ctx, engineFill(game.color), cw, ch, spin, () => {
            for (let j = 0; j < SEATS_PER_CAR; j++) {
              const r = game.riders[start + j]; if (!r) continue;
              ctx.save(); ctx.translate((j - 1) * cw * 0.3, ch * 0.18); ctx.scale(1, 1);
              drawAnimal(ctx, FARM_BY_ID[r.sp], 26 * k, { phase: 0, moving: 0, growth: 1, t });
              ctx.restore();
            }
          });
          ctx.restore();
          // 탄 친구가 가고 싶은 역 (작은 말풍선)
          for (let j = 0; j < SEATS_PER_CAR; j++) {
            const r = game.riders[start + j]; if (!r) continue;
            emoji(ctx, STATION_BY_ID[r.want].icon, p.x + dir * (j - 1) * cw * 0.3, p.y - ch * 1.75, 12 * k, 0.9);
          }
          riderIdx += SEATS_PER_CAR;
          return;
        }
        drawCargoCar(ctx, c.color, cw, ch, spin, loadedOf(c.idx).map(b => b.color), !!s.selBox && s.selBox.color === c.color);
        ctx.restore();
        s.hits.push({ kind: 'cargo', idx: c.idx, x: p.x, y: p.y - ch * 0.4, r: 30 * k });
      });

      // 산(터널): 기차 위에 덮어서 터널 속으로 들어간 것처럼
      const [t0, t1] = tunnel(), ta = tr.at(t0), tb = tr.at(t1), mx = tr.R;
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath(); ctx.moveTo(mx - 40 * k, ta.y + 10 * k);
      ctx.quadraticCurveTo(mx - 10 * k, ta.y - 50 * k, mx + 40 * k, ta.y - 10 * k);
      ctx.lineTo(W, ta.y - 30 * k); ctx.lineTo(W, tb.y + 10 * k);
      ctx.quadraticCurveTo(mx + 30 * k, tb.y + 30 * k, mx - 40 * k, tb.y - 14 * k);
      ctx.quadraticCurveTo(mx - 70 * k, (ta.y + tb.y) / 2, mx - 40 * k, ta.y + 10 * k); ctx.fill();
      ctx.fillStyle = '#65a30d'; ell(ctx, mx + 10 * k, (ta.y + tb.y) / 2 - 10 * k, 46 * k, (tb.y - ta.y) * 0.32); ctx.fill();
      ctx.fillStyle = '#ffffff'; ell(ctx, mx + 20 * k, ta.y + 6 * k, 14 * k, 6 * k); ctx.fill();
      [ta, tb].forEach((q, i) => { ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(q.x, q.y + (i ? -16 : 16) * k, 20 * k, i ? 0 : Math.PI, i ? Math.PI : TAU); ctx.fill(); ctx.strokeStyle = '#78716c'; ctx.lineWidth = 4 * k; ctx.stroke(); });

      // 연기
      s.smoke.forEach(p => { ctx.globalAlpha = clamp(p.life / 1.6, 0, 1) * 0.7; ell(ctx, p.x, p.y, p.r, p.r); ctx.fillStyle = s.dark > 0.4 ? '#94a3b8' : '#f1f5f9'; ctx.fill(); });
      ctx.globalAlpha = 1;

      // 밤: 어둡게 + 가로등·창문 빛
      if (s.dark > 0.02) {
        ctx.fillStyle = `rgba(8,16,48,${0.5 * s.dark})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        stations().forEach(st => { if (!st._lamp) return; const [lx, ly] = st._lamp, gr = ctx.createRadialGradient(lx, ly, 2, lx, ly, 60 * k); gr.addColorStop(0, `rgba(254,240,138,${0.5 * s.dark})`); gr.addColorStop(1, 'rgba(254,240,138,0)'); ctx.fillStyle = gr; ctx.fillRect(lx - 60 * k, ly - 60 * k, 120 * k, 120 * k); });
        ctx.restore();
      }
      // 효과 글자
      s.fx.forEach(f => {
        const a = clamp(f.life * 2, 0, 1);
        if (f.text.startsWith('+')) {
          ctx.globalAlpha = a; ctx.font = `900 ${Math.round(17 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(120,53,15,0.85)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = '#fef08a'; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
        } else emoji(ctx, f.text, f.x, f.y, 20 * k, a);
      });
    };

    resize();
    s.pos = sOfStation(stations()[0]) - 1;
    const ro = new ResizeObserver(resize); ro.observe(wrap);
    let raf = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; s.t += dt;
      update(dt); draw();
      if (s.t - s.lastHud > 0.3) {
        s.lastHud = s.t;
        const next = { points: game.points, deliveries: game.deliveries, running: s.running, at: s.at, red: !!(s.signal.red && s.signalHold), riders: game.riders.length, seats: seats() };
        setHud(prev => (Object.keys(next).every(kk => prev[kk] === next[kk]) ? prev : next));
      }
      if (s.t - s.lastSave > 5) { s.lastSave = s.t; saveTrain(game); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    s.refresh = () => { s.layerKey = ''; setTick(v => v + 1); };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); timers.forEach(clearTimeout);
      wrap.removeEventListener('pointerdown', onDown);
      saveTrain(game);
    };
  }, []);

  // ── 상점 ──
  const buy = (what, id) => {
    const s = simRef.current; if (!s) return;
    const game = s.game;
    let price = 0, apply = null;
    if (what === 'engine') {
      if (game.ownedEngines.includes(id)) { game.engine = id; saveTrain(game); setTick(v => v + 1); return; }
      price = ENGINES.find(e => e.id === id).price; apply = () => { game.ownedEngines.push(id); game.engine = id; };
    } else if (what === 'color') {
      if (game.ownedColors.includes(id)) { game.color = id; saveTrain(game); setTick(v => v + 1); return; }
      price = ENGINE_COLORS.find(c => c.id === id).price; apply = () => { game.ownedColors.push(id); game.color = id; };
    } else if (what === 'pass') {
      if (game.passCars >= MAX_PASS_CARS) return;
      price = passCarPrice(game.passCars); apply = () => { game.passCars++; };
    } else if (what === 'cargo') {
      if (game.cargo.includes(id)) return;
      price = CARGO_CAR_PRICE; apply = () => { game.cargo.push(id); };
    } else if (what === 'decor') {
      if (game.decor.includes(id)) return;
      price = TOWN_DECOR.find(d => d.id === id).price; apply = () => { game.decor.push(id); };
    }
    if (game.points < price) { showToast(`⭐ 별이 ${price - game.points}개 더 필요해요`); s.say('need', VOICE.trainNeedMore(), 3); return; }
    game.points -= price; apply();
    audio.playFanfare(); s.say('buy', VOICE.trainBuy(), 2);
    saveTrain(game); s.refresh();
    setHud(h => ({ ...h, points: game.points }));
  };

  const sim = simRef.current, game = sim ? sim.game : null, pts = game ? game.points : hud.points;
  const snow = STATION_BY_ID.snow, snowLeft = Math.max(0, snow.unlockAt - hud.deliveries);
  const card = { border: '2px solid #e2e8f0', borderRadius: '18px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', gap: '4px' };
  const btn = (enabled, bg = '#16a34a') => ({ width: '100%', border: 'none', borderRadius: '12px', padding: '8px', fontWeight: 900, cursor: 'pointer', background: enabled ? bg : '#cbd5e1', color: '#ffffff' });
  const owned = { width: '100%', borderRadius: '12px', padding: '8px', fontWeight: 900, textAlign: 'center', background: '#dcfce7', color: '#15803d', fontSize: '0.85rem' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '10px', padding: '4px' }}>
      {/* 상단: 별·데려다준 친구·버튼 */}
      <div data-ui style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', borderRadius: '22px', padding: '8px 14px', flexShrink: 0 }}>
        <div style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, fontSize: '1.45rem', padding: '6px 14px', borderRadius: '18px' }}>⭐ {hud.points}</div>
        <div style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 900, fontSize: '1rem', padding: '6px 12px', borderRadius: '16px' }}>
          🚉 데려다준 친구 {hud.deliveries}명{snowLeft > 0 ? ` · ❄️ 눈꽃역까지 ${snowLeft}명` : ''}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', fontWeight: 900, fontSize: '1rem', padding: '6px 12px', borderRadius: '16px' }}>🚃 {hud.riders}/{hud.seats}</div>
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
          <TrainButton icon={hud.running ? '✋' : '▶️'} label={hud.running ? '멈춤' : '출발'} color={hud.running ? '#ef4444' : '#16a34a'} big pulse={!hud.running && !hud.red}
            onClick={() => { const s = simRef.current; if (!s) return; if (s.running) s.halt(); else s.go(); }} />
          <TrainButton icon="📯" label="기적" color="#f59e0b" onClick={() => simRef.current && simRef.current.whistle()} />
          <TrainButton icon="🛒" label="상점" color="#8b5cf6" onClick={() => setShopOpen(true)} />
        </div>
      </div>

      <div ref={wrapRef} style={{ flex: 1, minHeight: '300px', position: 'relative', overflow: 'hidden', borderRadius: '18px', border: '7px solid #0369a1', background: '#86d986', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, display: 'block' }} />
        {/* 도움말 */}
        <div style={{ position: 'absolute', left: '50%', bottom: '10px', transform: 'translateX(-50%)', pointerEvents: 'none', background: 'rgba(15,23,42,0.7)', color: '#ffffff', fontWeight: 900, padding: '7px 14px', borderRadius: '14px', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
          {hud.red ? '🚦 빨간불! 신호등을 눌러 초록불로 바꿔요'
            : hud.at ? `${STATION_BY_ID[hud.at].icon} ${STATION_BY_ID[hud.at].name}! 친구를 눌러 태우고 ▶️ 출발`
              : hud.running ? '🚂 칙칙폭폭~ 역에서 친구가 기다려요' : '▶️ 출발 버튼을 눌러요'}
        </div>
        {toast && (
          <div key={toast.key} style={{ position: 'absolute', left: '50%', bottom: '56px', transform: 'translateX(-50%)', pointerEvents: 'none', background: 'rgba(255,255,255,0.95)', color: '#0f172a', fontWeight: 900, padding: '9px 18px', borderRadius: '16px', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>{toast.text}</div>
        )}

        {/* 상점 */}
        {shopOpen && game && (
          <div data-ui onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ background: '#ffffff', borderRadius: '26px', width: 'min(760px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', color: '#ffffff' }}>
                <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>🛒 기차 마을 상점</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: '#fef08a', color: '#713f12', fontWeight: 900, padding: '4px 12px', borderRadius: '14px' }}>⭐ {pts}</span>
                  <button onClick={() => setShopOpen(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.25)', color: '#ffffff', borderRadius: '12px', padding: '6px 12px', fontWeight: 900, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', padding: '10px 14px 0' }}>
                {[['train', '🚂 기차'], ['cars', '🚃 칸 붙이기'], ['town', '🏡 마을 꾸미기']].map(([kk, label]) => (
                  <button key={kk} onClick={() => setShopTab(kk)} style={{ border: 'none', borderRadius: '14px', padding: '8px 14px', fontWeight: 900, cursor: 'pointer', background: shopTab === kk ? '#0ea5e9' : '#f1f5f9', color: shopTab === kk ? '#ffffff' : '#475569' }}>{label}</button>
                ))}
              </div>
              <div style={{ padding: '12px 14px 16px', overflowY: 'auto', touchAction: 'pan-y' }}>
                {shopTab === 'train' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                      {ENGINES.map(e => (
                        <div key={e.id} style={{ ...card, border: game.engine === e.id ? '3px solid #0ea5e9' : card.border }}>
                          <EnginePreview type={e.id} color={engineFill(game.color)} />
                          <div style={{ fontWeight: 900 }}>{e.name}</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>{e.desc}</div>
                          {game.engine === e.id ? <div style={owned}>✅ 달리는 중</div>
                            : <button onClick={() => buy('engine', e.id)} style={btn(game.ownedEngines.includes(e.id) || pts >= e.price, '#0ea5e9')}>{game.ownedEngines.includes(e.id) ? '이 기차로 바꾸기' : `⭐ ${e.price}`}</button>}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontWeight: 900, margin: '14px 2px 8px' }}>🎨 기차 색깔</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {ENGINE_COLORS.map(c => (
                        <button key={c.id} onClick={() => buy('color', c.id)} style={{ border: game.color === c.id ? '4px solid #0f172a' : '2px solid #e2e8f0', borderRadius: '16px', padding: '6px 12px', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900 }}>
                          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: c.fill, display: 'inline-block' }} />
                          {c.name} {game.ownedColors.includes(c.id) ? '' : `⭐${c.price}`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {shopTab === 'cars' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                    <div style={card}>
                      <div style={{ fontSize: '2.4rem' }}>🚃</div>
                      <div style={{ fontWeight: 900 }}>객차 붙이기</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>친구 {SEATS_PER_CAR}명이 더 탈 수 있어요 ({game.passCars}/{MAX_PASS_CARS}칸)</div>
                      {game.passCars >= MAX_PASS_CARS ? <div style={owned}>✅ 다 붙였어요</div>
                        : <button onClick={() => buy('pass')} style={btn(pts >= passCarPrice(game.passCars))}>⭐ {passCarPrice(game.passCars)}</button>}
                    </div>
                    {Object.entries(CARGO_COLORS).map(([id, c]) => (
                      <div key={id} style={card}>
                        <div style={{ width: '70px', height: '40px', borderRadius: '8px 8px 14px 14px', background: c.fill, border: `3px solid ${c.dark}` }} />
                        <div style={{ fontWeight: 900 }}>{c.name} 화물칸</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>{c.name} 상자를 실어 날라요</div>
                        {game.cargo.includes(id) ? <div style={owned}>✅ 붙어 있어요</div>
                          : <button onClick={() => buy('cargo', id)} style={btn(pts >= CARGO_CAR_PRICE)}>⭐ {CARGO_CAR_PRICE}</button>}
                      </div>
                    ))}
                  </div>
                )}
                {shopTab === 'town' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                    {[...TOWN_DECOR].sort((a, b) => a.price - b.price).map(d => (
                      <div key={d.id} style={card}>
                        <div style={{ fontSize: '2.6rem' }}>{d.icon}</div>
                        <div style={{ fontWeight: 900 }}>{d.name}</div>
                        {game.decor.includes(d.id) ? <div style={owned}>✅ 마을에 있어요</div>
                          : <button onClick={() => buy('decor', d.id)} style={btn(pts >= d.price, '#f97316')}>⭐ {d.price}</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
