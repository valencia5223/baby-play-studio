// ═════════════════════════════════════════════════════════════════════════════
// 🎂 생일 파티: 주인공(아기상어·판다·유나)을 고르면 케이크 앞에 나오고, 생일 노래(오르골 또는 가족이 녹음한 노래)가
//    노래방처럼 가사와 함께 나온 뒤 "후~" 불어서(마이크 소리 크기) 또는 터치로 촛불을 끈다 → 폭죽·박수
//  - 소리는 모두 <audio> 하나로 (아이폰에서 마이크를 열어도 소리가 끊기지 않게). 멜로디는 WAV 를 그 자리에서 만든다
//  - 가족 노래 녹음: 반주에 맞춰 부른 노래를 주인공별로 이 기기(IndexedDB)에 저장. 서버로 보내지 않는다
//  - 안내 문장은 그림책 여성 목소리 MP3 (public/story-voice, scripts/generate-story-voices.mjs)
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { BDAY_CHARS, BDAY_BY_ID, BDAY_BEAT, BDAY_MELODY, BDAY_BASS, NOTE_HZ, bdayLyrics, BDAY_MP3, BDAY_MP3_LINES, bdayIntro, bdayBlow, BDAY_DONE } from './birthdayData.js';
import { drawFish } from './AquariumGame.jsx';
import { drawAnimal } from './FarmGame.jsx';
import { drawYuna } from './StoryBook.jsx';
import { FISH_BY_ID } from './aquariumData.js';
import { FARM_SPECIES } from './farmData.js';
import { voiceKey } from './voiceLines.js';
import STORY_VOICE_INDEX from './storyVoiceIndex.json';

const TAU = Math.PI * 2;
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const STORY_KEYS = new Set(STORY_VOICE_INDEX);
const lineUrl = (text) => { const k = voiceKey(text); return STORY_KEYS.has(k) ? `/story-voice/${k}.mp3` : null; };
const PANDA = FARM_SPECIES.find(s => s.id === 'panda');
const SONG_SEC = BDAY_MELODY.reduce((a, [, d]) => a + d, 0) * BDAY_BEAT;

// ─────────────────────────────── 소리 만들기 ───────────────────────────────
const wavCache = new Map();
function wavUrl(key, seconds, fill, rate = 22050) {
  if (wavCache.has(key)) return wavCache.get(key);
  const n = Math.ceil(seconds * rate), buf = new Float32Array(n);
  fill(buf, rate);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  const k = peak > 0 ? 0.88 / peak : 1;
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buf[i] * k)) * 0x7fff, true);
  const bytes = new Uint8Array(ab); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const url = `data:audio/wav;base64,${btoa(bin)}`;
  wavCache.set(key, url);
  return url;
}
// 오르골 생일 노래 (멜로디 + 마디 첫 박 낮은 반주)
const melodyUrl = () => wavUrl('melody', SONG_SEC + 2.2, (buf, R) => {
  const note = (f, startBeat, durBeat, vol, bass) => {
    const s0 = Math.floor(startBeat * BDAY_BEAT * R), len = Math.floor(Math.max(durBeat, bass ? 2.5 : 1.6) * BDAY_BEAT * R);
    for (let i = 0; i < len && s0 + i < buf.length; i++) {
      const t = i / R, env = Math.exp(-t * (bass ? 2.2 : 3.2)) * Math.min(1, i / 60);
      buf[s0 + i] += (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6) + 0.15 * Math.sin(TAU * f * 3.01 * t) * Math.exp(-t * 9)) * env * vol;
    }
  };
  let b = 0; BDAY_MELODY.forEach(([n, d]) => { note(NOTE_HZ[n], b, d, 0.32, false); b += d; });
  BDAY_BASS.forEach(([at, n]) => note(NOTE_HZ[n], at, 2.6, 0.18, true));
});
// 박수 소리 (짝짝짝 + 반짝 종소리)
const clapUrl = () => wavUrl('clap', 2.2, (buf, R) => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  [0, 0.28, 0.56, 0.95, 1.2, 1.45].forEach((at, k) => {
    const s0 = Math.floor(at * R);
    for (let i = 0; i < R * 0.12 && s0 + i < buf.length; i++) buf[s0 + i] += rnd() * Math.exp(-i / R * 38) * (k < 3 ? 0.9 : 0.7);
  });
  [1046.5, 1318.5, 1568].forEach((f, k) => {
    const s0 = Math.floor((0.1 + k * 0.12) * R);
    for (let i = 0; i < R * 1.4 && s0 + i < buf.length; i++) { const t = i / R; buf[s0 + i] += Math.sin(TAU * f * t) * Math.exp(-t * 3) * 0.25; }
  });
});

// ─────────────────────────────── 가족 노래 저장 (IndexedDB) ───────────────────────────────
const DB = 'bps_birthday', STORE = 'songs';
const openDb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const dbGet = async (k) => { try { const db = await openDb(); return await new Promise(res => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } };
const dbPut = async (k, v) => { try { const db = await openDb(); await new Promise(res => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = res; tx.onerror = res; }); } catch { /* 무시 */ } };
const dbDel = async (k) => { try { const db = await openDb(); await new Promise(res => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(k); tx.oncomplete = res; tx.onerror = res; }); } catch { /* 무시 */ } };

// ─────────────────────────────── 그림 ───────────────────────────────
function drawRoom(ctx, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fff1f6'); g.addColorStop(1, '#fde7f0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 벽 물방울 무늬
  ctx.fillStyle = 'rgba(244,114,182,0.08)';
  for (let x = 20; x < W; x += 54) for (let y = 30; y < H * 0.7; y += 54) { ctx.beginPath(); ctx.arc(x + ((y / 54) % 2) * 27, y, 6, 0, TAU); ctx.fill(); }
  // 삼각 깃발 줄
  const cols = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
  ctx.strokeStyle = '#d6bcd0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H * 0.06); ctx.quadraticCurveTo(W / 2, H * 0.17, W, H * 0.06); ctx.stroke();
  for (let i = 0; i < 13; i++) {
    const q = (i + 0.5) / 13, x = q * W;
    const yy = H * 0.06 + (H * 0.11) * 4 * q * (1 - q) * 0.5 + 2;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(x - 16, yy); ctx.lineTo(x + 16, yy); ctx.lineTo(x, yy + 30 + Math.sin(t * 2 + i) * 2); ctx.closePath(); ctx.fill();
  }
  // 풍선 (둥실둥실)
  [[0.08, 0.36, '#f87171'], [0.16, 0.28, '#60a5fa'], [0.88, 0.32, '#fbbf24'], [0.94, 0.4, '#a78bfa'], [0.12, 0.48, '#34d399']].forEach(([fx, fy, c], i) => {
    const x = fx * W + Math.sin(t * 0.8 + i) * 6, y = fy * H + Math.sin(t * 1.1 + i * 2) * 8, r = Math.min(W, H) * 0.055;
    ctx.strokeStyle = 'rgba(120,90,110,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + r * 1.2); ctx.quadraticCurveTo(x + 10, y + r * 2.5, x - 4, y + r * 4); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y + r * 1.15); ctx.lineTo(x + 4, y + r * 1.15); ctx.lineTo(x, y + r * 1.32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.2, r * 0.3, -0.4, 0, TAU); ctx.fill();
  });
  // 바닥
  ctx.fillStyle = '#f3d6c2'; ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

function drawCake(ctx, cx, by, S, candles, lit, t, smokeT) {
  // 탁자
  ctx.fillStyle = '#c08457'; ctx.fillRect(cx - S * 1.3, by, S * 2.6, S * 0.12);
  ctx.fillStyle = '#a16207'; ctx.fillRect(cx - S * 1.2, by + S * 0.12, S * 0.1, S * 0.6); ctx.fillRect(cx + S * 1.1, by + S * 0.12, S * 0.1, S * 0.6);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, by, S * 0.95, S * 0.12, 0, 0, TAU); ctx.fill();   // 접시
  const tier = (w, h, y, body, cream) => {
    ctx.fillStyle = body; ctx.fillRect(cx - w, y - h, w * 2, h);
    ctx.beginPath(); ctx.ellipse(cx, y, w, w * 0.18, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = cream; ctx.beginPath(); ctx.ellipse(cx, y - h, w, w * 0.18, 0, 0, TAU); ctx.fill();
    // 흘러내린 크림
    for (let i = 0; i < 8; i++) { const x = cx - w + (i + 0.5) * (w * 2 / 8); ctx.beginPath(); ctx.ellipse(x, y - h + w * 0.06, w * 0.09, w * (0.1 + (i % 3) * 0.05), 0, 0, TAU); ctx.fill(); }
  };
  tier(S * 0.85, S * 0.38, by - S * 0.02, '#f9a8d4', '#fff7fb');
  tier(S * 0.6, S * 0.32, by - S * 0.42, '#fcd5e5', '#ffffff');
  // 딸기
  for (let i = 0; i < 5; i++) {
    const x = cx - S * 0.45 + i * S * 0.225, y = by - S * 0.78;
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(x, y, S * 0.06, S * 0.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.ellipse(x, y - S * 0.06, S * 0.04, S * 0.02, 0, 0, TAU); ctx.fill();
  }
  // 촛불
  const top = by - S * 0.76;
  const xs = Array.from({ length: candles }, (_, i) => cx + (i - (candles - 1) / 2) * S * 0.28);
  xs.forEach((x, i) => {
    ctx.fillStyle = ['#60a5fa', '#fbbf24', '#34d399', '#f472b6'][i % 4];
    ctx.fillRect(x - S * 0.035, top - S * 0.32, S * 0.07, S * 0.32);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, S * 0.015);
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - S * 0.035, top - S * (0.08 + k * 0.1)); ctx.lineTo(x + S * 0.035, top - S * (0.12 + k * 0.1)); ctx.stroke(); }
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top - S * 0.32); ctx.lineTo(x, top - S * 0.37); ctx.stroke();
    const fy = top - S * 0.42;
    if (lit[i]) {
      const fl = 1 + Math.sin(t * 18 + i * 3) * 0.08 + Math.sin(t * 7 + i) * 0.05;
      const glow = ctx.createRadialGradient(x, fy, 1, x, fy, S * 0.25);
      glow.addColorStop(0, 'rgba(253,224,71,0.55)'); glow.addColorStop(1, 'rgba(253,224,71,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, fy, S * 0.25, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(x, fy, S * 0.045 * fl, S * 0.085 * fl, Math.sin(t * 5 + i) * 0.08, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(x, fy + S * 0.015, S * 0.025, S * 0.05 * fl, 0, 0, TAU); ctx.fill();
    } else if (smokeT != null && t - smokeT < 2.5) {
      // 꺼진 뒤 모락모락 연기
      for (let k = 0; k < 3; k++) {
        const q = ((t - smokeT) * 0.6 + k * 0.33) % 1;
        ctx.fillStyle = `rgba(160,160,170,${0.45 * (1 - q) * (1 - (t - smokeT) / 2.5)})`;
        ctx.beginPath(); ctx.arc(x + Math.sin(q * 6 + k) * S * 0.05, fy - q * S * 0.5, S * (0.03 + q * 0.05), 0, TAU); ctx.fill();
      }
    }
  });
  return xs.map(x => [x, top - S * 0.42]);
}

function drawHero(ctx, id, x, y, S, t, happy) {
  ctx.save(); ctx.translate(x, y);
  const hop = happy ? -Math.abs(Math.sin(t * 6)) * S * 0.12 : 0;
  if (id === 'shark') {
    const sp = FISH_BY_ID.shark;
    ctx.translate(0, -S * 0.82 + Math.sin(t * 1.6) * S * 0.04 + hop);   // 촛불 위로 둥실
    if (sp) drawFish(ctx, sp, S * 1.15, { phase: t * 4, growth: 1, happy: true, detail: true, gloss: true, lit: 0.6 });
  } else if (id === 'panda') {
    ctx.translate(-S * 0.22, hop);   // 판다는 머리가 오른쪽으로 나와서 몸을 왼쪽으로 조금
    if (PANDA) drawAnimal(ctx, PANDA, S * 0.95, { phase: t * 2, moving: 0, growth: 1, t, wag: happy, blink: t % 4 < 0.12 });
  } else {
    ctx.translate(0, hop);
    drawYuna(ctx, happy ? 'stretch' : 'stand', S * 1.05, t, false);
  }
  // 고깔모자
  const hatY = id === 'shark' ? -S * 0.2   /* 상어는 위에서 이미 몸 높이로 옮겨 둠 */ : id === 'panda' ? -S * 0.98 + hop : -S * 1.12 + hop;
  const hatX = id === 'shark' ? S * 0.26 : id === 'panda' ? S * 0.1 : 0;
  ctx.fillStyle = '#a78bfa';
  ctx.beginPath(); ctx.moveTo(hatX - S * 0.11, hatY); ctx.lineTo(hatX + S * 0.11, hatY); ctx.lineTo(hatX, hatY - S * 0.26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fde047'; [0.3, 0.6].forEach(q => { ctx.beginPath(); ctx.arc(hatX + (q - 0.45) * S * 0.08, hatY - S * 0.26 * q, S * 0.018, 0, TAU); ctx.fill(); });
  ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(hatX, hatY - S * 0.27, S * 0.035, 0, TAU); ctx.fill();
  ctx.restore();
}

// ─────────────────────────────── 화면 ───────────────────────────────
export default function BirthdayParty() {
  const [heroId, setHeroId] = useState(null);           // 고른 주인공 (null 이면 고르기 화면)
  const [phase, setPhase] = useState('pick');            // pick | intro | song | blow | done
  const [lineIdx, setLineIdx] = useState(-1);            // 지금 부르는 가사 줄
  const [lineProg, setLineProg] = useState(0);           // 그 줄의 진행 (0~1)
  const [useFamily, setUseFamily] = useState(true);      // 녹음한 가족 노래가 있으면 그걸로
  const [family, setFamily] = useState({});              // { 주인공: true } 녹음이 있는지
  const [recUi, setRecUi] = useState(null);              // 녹음 창: null | 'ready' | 'rec' | 'review'
  const [micNote, setMicNote] = useState('');
  const [micLevel, setMicLevel] = useState(0);           // 입김 크기 (0~1, 1 이면 꺼짐, -1 이면 마이크 멈춤)
  const [recNote, setRecNote] = useState('');            // 녹음 창 안내·오류
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const litRef = useRef([]);
  const smokeRef = useRef(null);
  const confettiRef = useRef([]);
  const flamesRef = useRef([]);
  const tRef = useRef(0);
  const phaseRef = useRef('pick');
  const micRef = useRef(null);                           // { stream, ctx, an, timer }
  const capCtxRef = useRef(null);
  const recRef = useRef(null);                           // 녹음 중 { mr, chunks, stream }
  const reviewRef = useRef(null);                        // 녹음 들어 보기 { blob, url }
  const runRef = useRef(0);                              // 파티 번호 (다시 하기·나가기 때 이전 흐름 무시)
  const hero = heroId ? BDAY_BY_ID[heroId] : null;
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // 녹음이 있는 주인공 확인
  useEffect(() => { (async () => { const f = {}; for (const c of BDAY_CHARS) f[c.id] = !!(await dbGet(c.id)); setFamily(f); })(); }, []);
  // 나갈 때 정리
  useEffect(() => () => { runRef.current++; stopPlayer(); stopMic(); stopRecording(true); try { capCtxRef.current && capCtxRef.current.close(); } catch { /* 무시 */ } }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── 소리: <audio> 하나 ──
  const player = () => { if (!playerRef.current) { playerRef.current = new Audio(); playerRef.current.preload = 'auto'; } return playerRef.current; };
  const stopPlayer = () => { const a = playerRef.current; if (a) { a.onended = a.onerror = a.ontimeupdate = null; try { a.pause(); } catch { /* 무시 */ } } };
  const play = (url, onEnd, onTime) => {
    const a = player();
    a.onended = () => { a.onended = a.onerror = a.ontimeupdate = null; onEnd && onEnd(); };
    a.onerror = () => { a.onended = a.onerror = a.ontimeupdate = null; onEnd && onEnd(); };
    a.ontimeupdate = onTime ? () => onTime(a.currentTime) : null;
    a.src = url; a.volume = 1; a.muted = false;
    const p = a.play(); if (p && p.catch) p.catch(() => { a.onended = a.onerror = null; setTimeout(() => onEnd && onEnd(), 300); });
  };
  const sayLine = (text, onEnd) => { const u = lineUrl(text); if (u) play(u, onEnd); else setTimeout(() => onEnd && onEnd(), 1500); };

  // ── 파티 흐름 ──
  const startParty = (id) => {
    const run = ++runRef.current;
    const c = BDAY_BY_ID[id];
    stopPlayer(); stopMic();
    setHeroId(id); setPhase('intro'); setLineIdx(-1); setLineProg(0); setMicNote('');
    litRef.current = Array(c.candles).fill(true); smokeRef.current = null; confettiRef.current = [];
    sayLine(bdayIntro(c), () => { if (runRef.current === run) singSong(id, run); });
  };
  const singSong = async (id, run) => {
    setPhase('song');
    const rec = useFamily ? await dbGet(id) : null;
    if (runRef.current !== run) return;
    const lines = bdayLyrics(BDAY_BY_ID[id]);
    const next = () => { if (runRef.current === run) askBlow(id, run); };
    // 오르골(앱이 연주)·가족 녹음: 박자로 가사 맞춤
    const playBeats = (url, offset, onDone) => play(url, onDone, (sec) => {
      const beat = (sec - offset) / BDAY_BEAT;
      const i = lines.findIndex(l => beat >= l.from && beat < l.to);
      setLineIdx(i);
      if (i >= 0) setLineProg((beat - lines[i].from) / (lines[i].to - lines[i].from));
    });
    if (rec && rec.blob) {
      const url = URL.createObjectURL(rec.blob);
      playBeats(url, rec.offset || 0, () => { URL.revokeObjectURL(url); next(); });   // 녹음은 반주 시작과 맞춰 저장
      return;
    }
    // 생일 노래 MP3: 초로 가사 맞춤, 못 불러오면 오르골로
    play(BDAY_MP3, next, (sec) => {
      const k = BDAY_MP3_LINES.findIndex(([a, b]) => sec >= a && sec < b);
      setLineIdx(k >= 0 ? k % 4 : -1);
      if (k >= 0) setLineProg((sec - BDAY_MP3_LINES[k][0]) / (BDAY_MP3_LINES[k][1] - BDAY_MP3_LINES[k][0]));
    });
    const a = player();
    a.onerror = () => { if (runRef.current === run) playBeats(melodyUrl(), 0, next); };
  };
  const askBlow = (id, run) => {
    setLineIdx(4); setPhase('blow');
    sayLine(bdayBlow(BDAY_BY_ID[id]), () => { if (runRef.current === run && phaseRef.current === 'blow') startMic(run); });
  };
  const blowOut = (all = true) => {
    if (phaseRef.current !== 'blow') return;
    const lit = litRef.current;
    if (all) lit.fill(false);
    else { const i = lit.indexOf(true); if (i >= 0) lit[i] = false; }
    smokeRef.current = tRef.current;
    if (lit.some(Boolean)) return;
    stopMic();
    setPhase('done');
    // 폭죽
    const W = canvasRef.current ? canvasRef.current.clientWidth : 800;
    confettiRef.current = Array.from({ length: 120 }, () => ({ x: W * (0.2 + Math.random() * 0.6), y: 0, vx: (Math.random() - 0.5) * 520, vy: -300 - Math.random() * 420, c: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'][Math.floor(Math.random() * 6)], r: Math.random() * TAU, born: tRef.current }));
    const run = runRef.current;
    play(clapUrl(), () => { if (runRef.current === run) sayLine(BDAY_DONE); });
  };

  // ── "후~" 불기: 마이크 소리가 크게 0.25초 넘게 이어지면 ──
  // 아이패드: 마이크를 켜기 전에 만든 오디오 엔진에는 무음만 들어오는 문제가 있어, 마이크를 켠 뒤 새로 만든다.
  // 주변 소리 크기를 먼저 재고 그보다 확 커지면 "후~" 로 본다.
  const startMic = async (run) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMicNote('촛불을 톡 눌러서 꺼 주세요'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (runRef.current !== run || phaseRef.current !== 'blow') { stream.getTracks().forEach(t => t.stop()); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      try { await ctx.resume(); } catch { /* 무시 */ }
      const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
      an.fftSize = 1024; src.connect(an);
      const data = new Float32Array(an.fftSize);
      let loud = 0, n = 0, floor = 0.01;
      const timer = setInterval(() => {
        if (ctx.state !== 'running') { ctx.resume().catch(() => { }); setMicLevel(-1); return; }
        an.getFloatTimeDomainData(data);
        let s = 0; for (let i = 0; i < data.length; i++) s += data[i] * data[i];
        const rms = Math.sqrt(s / data.length);
        n++;
        if (n <= 6) { floor = Math.max(floor, rms); return; }          // 처음 0.36초: 주변 소리
        if (rms < floor * 1.5) floor = floor * 0.95 + rms * 0.05;     // 조용할 때 천천히 따라감
        const th = Math.max(0.035, floor * 3.5);
        setMicLevel(Math.min(1, rms / th));
        loud = rms > th ? loud + 1 : Math.max(0, loud - 1);
        if (loud >= 3) blowOut(true);
      }, 60);
      micRef.current = { stream, src, ctx, timer };
      setMicNote('후~ 불어 보세요! (촛불을 눌러도 돼요)');
    } catch { setMicNote('촛불을 톡 눌러서 꺼 주세요'); }
  };
  function stopMic() {
    const m = micRef.current; micRef.current = null;
    setMicLevel(0);
    if (!m) return;
    clearInterval(m.timer);
    try { m.src.disconnect(); } catch { /* 무시 */ }
    try { m.ctx.close(); } catch { /* 무시 */ }
    m.stream.getTracks().forEach(t => t.stop());
  }

  // ── 가족 노래 녹음: 반주를 틀고 같이 부르는 동안 녹음 ──
  const startRecording = async () => {
    if (!heroId) return;
    stopPlayer();
    setRecNote('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setRecNote('이 브라우저에서는 녹음할 수 없어요. iPad 설정에서 iPadOS를 최신으로 업데이트해 주세요.'); return;
    }
    setRecUi('wait');
    // 터치 안에서 반주를 소리 없이 먼저 틀어 둔다 (아이패드는 마이크를 기다린 뒤에는 새로 틀 수 없을 때가 있음)
    const a = player();
    a.onended = a.onerror = a.ontimeupdate = null;
    a.src = melodyUrl(); a.muted = true;
    try { const p = a.play(); if (p && p.catch) p.catch(() => { }); } catch { /* 무시 */ }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      stopPlayer(); a.muted = false; setRecUi('ready');
      setRecNote(e && e.name === 'NotAllowedError'
        ? '마이크가 막혀 있어요. 설정 › Safari › 마이크 에서 "허용"으로 바꾼 뒤 다시 눌러 주세요.'
        : `마이크를 켤 수 없어요 (${(e && e.name) || '오류'})`);
      return;
    }
    try {
      // 아이패드(Safari)는 mp4 를 먼저
      const isApple = /iPad|iPhone|Macintosh/.test(navigator.userAgent) && !/Chrome|CriOS|Edg/.test(navigator.userAgent);
      const order = isApple ? ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime = order.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
      let mr;
      try { mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch { mr = new MediaRecorder(stream); }
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (recRef.current && recRef.current.cancel) return;
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        reviewRef.current = { blob, url: URL.createObjectURL(blob) };
        setRecUi('review');
      };
      recRef.current = { mr, stream, chunks };
      mr.start(1000);
      setRecUi('rec');
      setLineIdx(-1);
      const lines = bdayLyrics(hero);
      // 소리 없이 틀어 둔 반주를 처음으로 돌려 소리를 켠다
      a.onended = () => { a.onended = a.onerror = a.ontimeupdate = null; setTimeout(() => stopRecording(false), 400); };
      a.onerror = a.onended;
      a.ontimeupdate = () => {
        const beat = a.currentTime / BDAY_BEAT, i = lines.findIndex(l => beat >= l.from && beat < l.to);
        setLineIdx(i); if (i >= 0) setLineProg((beat - lines[i].from) / (lines[i].to - lines[i].from));
      };
      try { a.currentTime = 0; } catch { /* 무시 */ }
      a.muted = false; a.volume = 1;
      if (a.paused) {
        const p = a.play();
        if (p && p.catch) p.catch(() => setRecNote('반주가 안 나오면 그냥 불러 주세요. 다 부르고 ■ 그만을 눌러요.'));
      }
    } catch (e) {
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* 무시 */ }
      stopPlayer(); a.muted = false; recRef.current = null; setRecUi('ready');
      setRecNote(`이 기기에서 녹음을 시작하지 못했어요 (${(e && e.name) || '오류'})`);
    }
  };
  function stopRecording(cancel) {
    const r = recRef.current; if (!r) return;
    recRef.current = cancel ? { cancel: true } : r;
    try { if (r.mr && r.mr.state !== 'inactive') r.mr.stop(); } catch { /* 무시 */ }
    if (cancel) { try { r.stream && r.stream.getTracks().forEach(t => t.stop()); } catch { /* 무시 */ } }
  }
  const saveRecording = async () => {
    const rv = reviewRef.current; if (!rv || !heroId) return;
    await dbPut(heroId, { blob: rv.blob, offset: 0, at: Date.now() });
    setFamily(f => ({ ...f, [heroId]: true })); setUseFamily(true);
    URL.revokeObjectURL(rv.url); reviewRef.current = null; recRef.current = null; setRecUi(null); stopPlayer();
  };
  const closeRecorder = () => { stopRecording(true); stopPlayer(); if (reviewRef.current) { URL.revokeObjectURL(reviewRef.current.url); reviewRef.current = null; } recRef.current = null; setRecUi(null); setLineIdx(-1); };

  // ── 그림 루프 ──
  useEffect(() => {
    if (!heroId) return undefined;
    const c = canvasRef.current; if (!c) return undefined;
    let raf = 0; const t0 = performance.now(); let last = t0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = c.clientWidth, H = c.clientHeight;
      if (W > 0 && H > 0) {
        if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
        const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = (now - t0) / 1000; tRef.current = t;
        drawRoom(ctx, W, H, t);
        const S = Math.min(W * 0.32, H * 0.42);
        const happy = phaseRef.current === 'done';
        drawHero(ctx, heroId, W * 0.5, H * 0.6, S, t, happy);
        flamesRef.current = drawCake(ctx, W * 0.5, H * 0.8, S * 0.62, BDAY_BY_ID[heroId].candles, litRef.current, t, smokeRef.current);
        // 폭죽
        confettiRef.current.forEach(p => {
          p.vy += 520 * dt; p.x += p.vx * dt; p.y = (p.y || H * 0.55) + p.vy * dt; p.r += dt * 6;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
        });
        confettiRef.current = confettiRef.current.filter(p => p.y < H + 20);
        if (happy && Math.random() < 0.05 && confettiRef.current.length < 60) {
          for (let k = 0; k < 18; k++) confettiRef.current.push({ x: W * (0.15 + Math.random() * 0.7), y: H * 0.5, vx: (Math.random() - 0.5) * 400, vy: -250 - Math.random() * 300, c: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'][k % 6], r: 0 });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [heroId]);

  const onCanvasDown = (e) => {
    if (phaseRef.current !== 'blow') return;
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const near = flamesRef.current.some(([fx, fy]) => Math.hypot(x - fx, y - fy) < 70);
    blowOut(!near ? true : false);   // 촛불 하나를 누르면 하나씩, 케이크·화면을 누르면 한 번에
  };

  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.1rem', cursor: 'pointer', touchAction: 'manipulation' });

  // ── 주인공 고르기 ──
  if (!heroId) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1.2rem', justifyContent: 'center', padding: '0.5rem', borderRadius: '28px', background: 'radial-gradient(circle at 20% 15%, #ffe4ef 0, rgba(255,228,239,0) 45%), radial-gradient(circle at 80% 85%, #fef3c7 0, rgba(254,243,199,0) 45%)' }}>
        <h2 style={{ margin: 0, textAlign: 'center', fontFamily: JUA, fontWeight: 400, fontSize: '2rem', color: '#9d174d' }}>🎂 오늘은 누구 생일일까요?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
          {BDAY_CHARS.map(c => (
            <button key={c.id} onClick={() => startParty(c.id)} style={{ border: 'none', borderRadius: '32px', padding: '1.2rem 1rem', background: c.color, cursor: 'pointer', touchAction: 'manipulation', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', boxShadow: `0 16px 30px -18px ${c.ink}` }}>
              <HeroCard id={c.id} />
              <span style={{ fontFamily: JUA, fontSize: '1.8rem', color: c.ink }}>{c.name}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: c.ink, opacity: 0.7 }}>{'🕯️'.repeat(c.candles)} {family[c.id] ? '· 🎙️ 가족 노래' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 파티 ──
  const lines = bdayLyrics(hero);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={() => { runRef.current++; stopPlayer(); stopMic(); closeRecorder(); setHeroId(null); setPhase('pick'); }} style={btn('#f6efe7', '#5c5248')}>⬅️ 다른 친구</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: hero.ink }}>{hero.name}의 생일 파티 🎉</div>
        {family[heroId] && (
          <button onClick={() => setUseFamily(v => !v)} title="노래 고르기" style={btn(useFamily ? '#fbcfe8' : '#ede9fe', useFamily ? '#9d174d' : '#5b21b6')}>{useFamily ? '👩 가족 노래' : '🎵 생일 노래'}</button>
        )}
        <button onClick={() => { runRef.current++; stopPlayer(); stopMic(); setRecNote(''); setRecUi('ready'); setLineIdx(-1); }} style={btn('#ffffff', '#9d174d')}>🎙️ 노래 녹음</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(157,23,77,0.5)' }}>
        <canvas ref={canvasRef} onPointerDown={onCanvasDown} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: phase === 'blow' ? 'pointer' : 'default' }} />
        {phase === 'blow' && <div style={{ position: 'absolute', left: 0, right: 0, top: '12px', textAlign: 'center', fontFamily: JUA, fontSize: '1.5rem', color: '#9d174d', textShadow: '0 2px 0 #fff' }}>🌬️ {micNote || '후~ 불어 보세요!'}</div>}
        {phase === 'blow' && micLevel !== 0 && (
          <div style={{ position: 'absolute', left: '50%', top: '52px', width: '220px', marginLeft: '-110px', height: '14px', borderRadius: '7px', background: 'rgba(255,255,255,0.8)', overflow: 'hidden', boxShadow: '0 0 0 2px #fbcfe8' }}>
            <div style={{ height: '100%', width: `${Math.max(0, micLevel) * 100}%`, background: micLevel >= 1 ? '#f43f5e' : '#f9a8d4', transition: 'width 0.06s' }} />
          </div>
        )}
        {phase === 'done' && <div style={{ position: 'absolute', left: 0, right: 0, top: '12px', textAlign: 'center', fontFamily: JUA, fontSize: '2rem', color: '#db2777', textShadow: '0 3px 0 #fff' }}>🎉 생일 축하해요! 🎉</div>}

        {/* 가족 노래 녹음 창 */}
        {recUi && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(253,242,248,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: '#9d174d' }}>🎙️ {hero.name}에게 불러 줄 생일 노래</div>
            {recNote && <div style={{ fontWeight: 800, color: '#be123c', background: '#fff1f2', borderRadius: '14px', padding: '8px 14px', lineHeight: 1.5, maxWidth: '520px' }}>{recNote}</div>}
            {recUi === 'wait' && <div style={{ fontFamily: JUA, fontSize: '1.2rem', color: '#6b7280' }}>🎤 마이크를 켜는 중... (허용을 눌러 주세요)</div>}
            {recUi === 'ready' && <>
              <div style={{ fontWeight: 800, color: '#6b7280', lineHeight: 1.6 }}>시작을 누르면 오르골 반주가 나와요. 반주에 맞춰 같이 불러 주세요.<br />노래는 이 기기에만 저장돼요.</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={startRecording} style={btn('#f43f5e')}>● 녹음 시작</button>
                <button onClick={closeRecorder} style={btn('#e5e7eb', '#374151')}>닫기</button>
              </div>
              {family[heroId] && <button onClick={async () => { await dbDel(heroId); setFamily(f => ({ ...f, [heroId]: false })); }} style={{ ...btn('transparent', '#9ca3af'), minHeight: '36px', fontSize: '0.9rem' }}>저장한 가족 노래 지우기</button>}
            </>}
            {recUi === 'rec' && <>
              <div style={{ fontFamily: JUA, fontSize: '1.2rem', color: '#f43f5e' }}>● 녹음 중... 같이 불러 주세요</div>
              <Karaoke lines={lines} idx={lineIdx} prog={lineProg} big />
              <button onClick={() => stopRecording(false)} style={btn('#6b7280')}>■ 그만</button>
            </>}
            {recUi === 'review' && <>
              <div style={{ fontWeight: 800, color: '#6b7280' }}>잘 녹음됐는지 들어 보세요</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => reviewRef.current && play(reviewRef.current.url)} style={btn('#a78bfa')}>▶ 들어 보기</button>
                <button onClick={saveRecording} style={btn('#22c55e')}>저장하기</button>
                <button onClick={() => { closeRecorder(); setRecUi('ready'); }} style={btn('#e5e7eb', '#374151')}>다시 녹음</button>
              </div>
            </>}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '64px' }}>
        {phase === 'done'
          ? <>
            <button onClick={() => startParty(heroId)} style={btn('#f472b6')}>🔁 한 번 더</button>
            <button onClick={() => { runRef.current++; stopPlayer(); setHeroId(null); setPhase('pick'); }} style={btn('#a78bfa')}>🎂 다른 친구</button>
          </>
          : <Karaoke lines={lines} idx={phase === 'song' ? lineIdx : -1} prog={lineProg} />}
      </div>
    </div>
  );
}

// 노래방 가사: 지금 줄을 왼쪽부터 색칠, 주인공 이름은 반짝
function Karaoke({ lines, idx, prog, big }) {
  const line = lines[Math.max(0, Math.min(lines.length - 1, idx))];
  const active = idx >= 0 && idx < lines.length;
  const pct = active ? Math.round(Math.max(0, Math.min(1, prog)) * 100) : 0;
  const parts = line.name ? line.text.split(line.name) : [line.text];
  const style = {
    fontFamily: JUA, fontSize: big ? '2rem' : 'clamp(1.5rem, 3.4vw, 2.3rem)', lineHeight: 1.2,
    backgroundImage: `linear-gradient(90deg, #db2777 ${pct}%, #d4c4cc ${pct}%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
  };
  return (
    <div style={{ background: '#ffffff', borderRadius: '22px', padding: '8px 22px', boxShadow: '0 8px 20px -14px rgba(157,23,77,0.6)', opacity: active ? 1 : 0.6 }}>
      <span style={style}>
        {parts[0]}{line.name && <span style={{ ...style, backgroundImage: `linear-gradient(90deg, #f59e0b ${pct}%, #fcd34d ${pct}%)`, padding: '0 2px' }}>{line.name}</span>}{parts[1] || ''}
      </span>
    </div>
  );
}

// 고르기 화면의 주인공 그림
function HeroCard({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return undefined;
    let raf = 0; const t0 = performance.now();
    const loop = (now) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = 170, H = 170;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      drawHero(ctx, id, W / 2, id === 'shark' ? H * 1.12 : H * 0.92, 120, (now - t0) / 1000, false);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} style={{ width: 170, height: 170, display: 'block' }} />;
}

