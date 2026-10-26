// ═════════════════════════════════════════════════════════════════════════════
// 📞 전화 놀이: 장난감 전화기로 친구(아기상어·원숭이·판다)에게 전화를 걸어 이야기한다
//  - 흐름: 친구 고르기 → 번호 누르기(아무 숫자나 눌러도 친구 번호가 한 자리씩 채워짐) → 따르릉 → 통화 → 끊기
//  - 대답: Supabase Edge Function baby-call (Gemini, 아기 수준·친구 성격, 저장 안 함)
//  - 목소리: baby-voice?who=친구 (무료 Edge 목소리 3개를 친구마다 속도·음높이로 다르게)
//  - 아기 말: 친구 말이 끝나면 저절로 듣기 시작 → 소리 크기로 말 시작·끝을 알아채(1초 조용하면 끝) 짧게 녹음(16kHz WAV)
//    → baby-call 에 보내 Gemini 가 직접 듣고 대답. 기기 음성 인식(Web Speech)은 쓰지 않는다 (받아 적기 실수·매번 권한 질문·통화 음량 저하 때문에)
//  - 마이크는 통화 화면에서 한 번 열어 계속 쓰고(권한을 매번 묻지 않게), 화면을 떠나면 닫는다
//    통화용 음성 처리(echoCancellation)를 끄고 열어 스피커 소리가 작아지지 않게 한다 (친구 말이 끝난 뒤에만 들으므로 필요 없다)
//  - 아이폰: 마이크를 열면 앱의 Web Audio 가 '중단'되어 소리가 안 나거나 늦게 난다 →
//    연결음·친구 목소리는 터치 때 미리 깨워 둔 <audio> 플레이어 하나로, 녹음은 마이크를 연 뒤 만든 녹음 전용 AudioContext 로 한다
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';

const API = 'https://auaygojvfrvxmaerzmzi.supabase.co/functions/v1';
const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const TAU = Math.PI * 2;
const CONSENT_KEY = 'bps_phone_consent_v1';
const MAX_BABY_TURNS = 6;          // 아기가 이만큼 말하면 친구가 작별 인사
const MAX_CALL_SEC = 180;          // 통화는 최대 3분
const IDLE_NUDGE_SEC = 14;         // (눌러서 말하기일 때) 아기가 말이 없으면 친구가 먼저 한마디 (두 번까지)
const SILENCE_MS = 1000;           // 자동 듣기: 아기가 말하다 이만큼 조용하면 말이 끝난 것으로
const MAX_UTTER_MS = 8000;         // 한 번에 녹음하는 최대 길이
const NO_SPEECH_MS = 9000;         // 자동 듣기: 이만큼 아무 말이 없으면 친구가 먼저 이어 간다

const FRIENDS = [
  { id: 'shark', name: '아기상어', number: '5252', color: '#fde68a', ink: '#92400e', desc: '바닷속 노래쟁이',
    fallback: ['뚜루루뚜루! 유나야, 나랑 같이 노래할래?', '우와, 그렇구나! 바닷속에는 해파리가 반짝반짝해!', '유나는 물고기 좋아해?', '엄마상어가 맛있는 밥을 줬어. 냠냠!'], bye: '유나야, 또 전화해! 뚜루루뚜루, 안녕!' },
  { id: 'monkey', name: '원숭이', number: '8282', color: '#fed7aa', ink: '#7c2d12', desc: '바나나 좋아 장난꾸러기',
    fallback: ['우끼끼! 유나야, 바나나 좋아해?', '와, 정말? 나는 나무 위에서 그네 탔어!', '유나는 숨바꼭질 좋아해?', '우끼끼, 재미있다!'], bye: '우끼끼! 유나야, 또 놀자! 안녕!' },
  { id: 'panda', name: '판다', number: '7777', color: '#e5e7eb', ink: '#1f2937', desc: '느긋한 대나무 형아',
    fallback: ['음, 유나야 안녕. 나는 대나무를 냠냠 먹었어.', '음~ 그렇구나. 참 좋다.', '유나는 낮잠 잤어?', '하아암, 판다는 조금 졸려.'], bye: '음, 유나야. 또 전화해 줘. 잘 지내, 안녕.' }
];
const FRIEND_BY_ID = Object.fromEntries(FRIENDS.map(f => [f.id, f]));
const MIC_HELP = {
  tap: '🎤를 한 번 눌러 주세요 (마이크 깨우기)',
  inapp: '카카오톡 같은 앱 안에서는 마이크를 못 써요. ⋮ 메뉴 → 다른 브라우저로 열기',
  denied: '마이크가 막혀 있어요. 주소창 옆 설정에서 마이크를 허용한 뒤 🎤를 눌러 주세요',
  nomic: '마이크를 찾지 못했어요',
  unsupported: '이 브라우저는 마이크를 쓸 수 없어요. 크롬이나 사파리로 열어 주세요',
  other: '🎤를 누르면 마이크 허락을 다시 물어봐요'
};
// 카카오톡·네이버·인스타그램·페이스북·라인 앱 안의 브라우저는 마이크를 막는 경우가 많다
const IN_APP = typeof navigator !== 'undefined' && /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(navigator.userAgent || '');

// ─────────────────────────────── 친구 얼굴 ───────────────────────────────
// 원점은 얼굴 가운데, S 는 지름 정도. mouth 0~1 (말할 때 벌어짐)
function drawFace(ctx, id, S, mouth, t, blink) {
  const R = S * 0.42;
  const eye = (x, y, r) => {
    if (blink) { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = Math.max(1.5, r * 0.35); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r * 0.9, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); return; }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(x + r * 0.1, y + r * 0.1, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.3, r * 0.38, 0, TAU); ctx.fill();
  };
  const cheeks = (dx, y, r) => { ctx.fillStyle = 'rgba(251,113,133,0.45)'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * dx, y, r * 1.2, r * 0.8, 0, 0, TAU); ctx.fill(); }); };
  const mouthDraw = (y, w, teeth) => {
    const open = Math.max(0.12, mouth);
    ctx.fillStyle = '#9f1239';
    ctx.beginPath(); ctx.ellipse(0, y, w, w * 0.25 + w * 0.6 * open, 0, 0, Math.PI); ctx.lineTo(-w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.ellipse(0, y + w * 0.35 * open + w * 0.1, w * 0.45, w * 0.22 * (0.4 + open), 0, 0, TAU); ctx.fill();
    if (teeth) { ctx.fillStyle = '#ffffff'; [-0.45, 0.45].forEach(k => { ctx.beginPath(); ctx.moveTo(k * w - w * 0.13, y); ctx.lineTo(k * w + w * 0.13, y); ctx.lineTo(k * w, y + w * 0.3); ctx.closePath(); ctx.fill(); }); }
  };
  const bob = Math.sin(t * 2) * S * 0.01;
  ctx.save(); ctx.translate(0, bob);
  if (id === 'shark') {
    // 노란 아기상어: 머리 위 지느러미, 하얀 배, 웃는 입과 이빨 두 개
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 0.82); ctx.quadraticCurveTo(R * 0.05, -R * 1.45, R * 0.42, -R * 1.25); ctx.quadraticCurveTo(R * 0.2, -R * 0.95, R * 0.3, -R * 0.78); ctx.closePath(); ctx.fill();
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * R * 0.98, R * 0.25, R * 0.28, R * 0.14, sd * -0.6, 0, TAU); ctx.fill(); });
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.2, 0, 0, R * 1.1); g.addColorStop(0, '#fde68a'); g.addColorStop(1, '#fbbf24');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.92, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffbeb'; ctx.beginPath(); ctx.ellipse(0, R * 0.42, R * 0.72, R * 0.45, 0, 0, TAU); ctx.fill();
    eye(-R * 0.36, -R * 0.2, R * 0.15); eye(R * 0.36, -R * 0.2, R * 0.15);
    cheeks(R * 0.6, R * 0.12, R * 0.1);
    mouthDraw(R * 0.24, R * 0.3, true);
  } else if (id === 'monkey') {
    // 갈색 원숭이: 큰 귀, 하트 모양 얼굴, 콧구멍 두 개
    ctx.fillStyle = '#92400e';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * R * 1.0, -R * 0.05, R * 0.36, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#fcd9b6'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * R * 1.0, -R * 0.05, R * 0.22, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#a0522d'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7c3a12'; ctx.beginPath(); ctx.moveTo(-R * 0.15, -R * 0.95); ctx.quadraticCurveTo(0, -R * 1.25, R * 0.12, -R * 0.95); ctx.fill();   // 머리털
    ctx.fillStyle = '#fcd9b6';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * R * 0.3, -R * 0.15, R * 0.36, 0, TAU); ctx.fill(); });
    ctx.beginPath(); ctx.ellipse(0, R * 0.35, R * 0.62, R * 0.46, 0, 0, TAU); ctx.fill();
    eye(-R * 0.3, -R * 0.15, R * 0.13); eye(R * 0.3, -R * 0.15, R * 0.13);
    ctx.fillStyle = '#7c3a12'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * R * 0.08, R * 0.12, R * 0.04, R * 0.03, 0, 0, TAU); ctx.fill(); });
    cheeks(R * 0.5, R * 0.25, R * 0.09);
    mouthDraw(R * 0.34, R * 0.3, false);
  } else {
    // 판다: 까만 귀와 눈 둘레, 까만 코
    ctx.fillStyle = '#1f2937';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(sd * R * 0.72, -R * 0.72, R * 0.32, 0, TAU); ctx.fill(); });
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.2, 0, 0, R * 1.1); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e5e7eb');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.92, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f2937';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(sd * R * 0.36, -R * 0.12, R * 0.22, R * 0.3, sd * 0.5, 0, TAU); ctx.fill(); });
    if (blink) { eye(-R * 0.36, -R * 0.14, R * 0.1); eye(R * 0.36, -R * 0.14, R * 0.1); }
    else {
      [-1, 1].forEach(sd => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sd * R * 0.36, -R * 0.14, R * 0.1, 0, TAU); ctx.fill(); ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(sd * R * 0.36 + R * 0.02, -R * 0.12, R * 0.065, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sd * R * 0.36 + R * 0.05, -R * 0.16, R * 0.025, 0, TAU); ctx.fill(); });
    }
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(0, R * 0.14, R * 0.12, R * 0.08, 0, 0, TAU); ctx.fill();
    cheeks(R * 0.62, R * 0.25, R * 0.09);
    mouthDraw(R * 0.32, R * 0.24, false);
  }
  ctx.restore();
}

function FriendFace({ id, size, talking = false, ringing = false }) {
  const ref = useRef(null);
  const talkRef = useRef(talking);
  useEffect(() => { talkRef.current = talking; }, [talking]);
  useEffect(() => {
    const c = ref.current; if (!c) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    let raf = 0; const t0 = performance.now(); let mouth = 0, target = 0, nextFlap = 0;
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (talkRef.current) { if (t > nextFlap) { target = 0.3 + Math.random() * 0.7; nextFlap = t + 0.08 + Math.random() * 0.1; } }
      else target = 0;
      mouth += (target - mouth) * 0.35;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
      ctx.save(); ctx.translate(size / 2, size / 2);
      if (ringing) ctx.rotate(Math.sin(t * 30) * 0.05 * (Math.sin(t * 3) > 0 ? 1 : 0));
      drawFace(ctx, id, size, mouth, t, (t % 3.5) < 0.12);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, size, ringing]);
  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} />;
}

// 친구 대답 받기 (실패하면 미리 준비한 말 중 하나)
async function askFriend(friendId, turns, phase, audioB64) {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), audioB64 ? 15000 : 9000);
    const r = await fetch(`${API}/baby-call`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ friend: friendId, phase, turns, ...(audioB64 ? { audio: audioB64, mime: 'audio/wav' } : {}) })
    });
    clearTimeout(tm);
    const d = await r.json();
    if (r.ok && d.text) return { text: d.text, heard: d.heard || '' };
  } catch { /* 아래 준비한 말 */ }
  const f = FRIEND_BY_ID[friendId];
  if (phase === 'bye') return { text: f.bye, heard: '' };
  return { text: f.fallback[Math.floor(Math.random() * f.fallback.length)], heard: '' };
}

// 간단한 소리(연결음·버튼음)를 WAV data URL 로 만든다. segs: [[주파수들, 초], ...] (주파수 [] = 조용)
const toneCache = new Map();
function toneUrl(key, segs, vol = 0.35) {
  if (toneCache.has(key)) return toneCache.get(key);
  const rate = 16000, n = Math.round(segs.reduce((a, [, d]) => a + d, 0) * rate);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (off, t) => { for (let i = 0; i < t.length; i++) v.setUint8(off + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let i = 0;
  segs.forEach(([fs, d]) => {
    const m = Math.round(d * rate);
    for (let k = 0; k < m && i < n; k++, i++) {
      const env = Math.min(1, k / 200, (m - k) / 200);   // 딸깍 소리 없게 앞뒤를 부드럽게
      let x = 0; fs.forEach(f => { x += Math.sin(2 * Math.PI * f * k / rate); });
      x = fs.length ? (x / fs.length) * vol * env : 0;
      v.setInt16(44 + i * 2, x * 0x7fff, true);
    }
  });
  const bytes = new Uint8Array(buf); let bin = '';
  for (let j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
  const url = `data:audio/wav;base64,${btoa(bin)}`;
  toneCache.set(key, url);
  return url;
}
const RING = [[[440, 480], 1.0], [[], 0.8], [[440, 480], 1.0], [[], 0.6]];   // 따르릉 두 번 (약 3.4초)
const SILENT = [[[], 0.05]];

// 녹음한 소리(Float32, 기기 샘플레이트) → 16kHz 16bit 모노 WAV(base64)
function toWavBase64(chunks, srcRate) {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const rate = 16000, ratio = srcRate / rate, n = Math.floor(total / ratio);
  const all = new Float32Array(total); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (off, t) => { for (let i = 0; i < t.length; i++) v.setUint8(off + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0; for (let j = a; j < b; j++) sum += all[j];
    const x = Math.max(-1, Math.min(1, sum / Math.max(1, b - a)));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// 대답을 문장 단위로 나눈다 (아주 짧은 조각은 다음 문장과 합침) → 문장마다 목소리를 동시에 만들어 첫 문장부터 바로 말하기
const splitLines = (text) => {
  const parts = (text.match(/[^.!?]+[.!?]*/g) || [text]).map(t => t.trim()).filter(Boolean);
  const out = [];
  parts.forEach(p => { if (out.length && out[out.length - 1].length < 7) out[out.length - 1] += ` ${p}`; else out.push(p); });
  return out.length ? out : [text];
};
// 서버 목소리를 못 받으면 기기 목소리로라도 (끝나면 onEnd)
const nativeSay = (text, onEnd) => {
  try {
    if (!('speechSynthesis' in window)) { setTimeout(onEnd, 800 + text.length * 90); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.05; u.pitch = 1.2;
    u.onend = onEnd; u.onerror = onEnd;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch { setTimeout(onEnd, 800 + text.length * 90); }
};
const voiceUrl = (friendId, text) => `${API}/baby-voice?who=${friendId}&text=${encodeURIComponent(text.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ,.!?-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 118))}`;

// ─────────────────────────────── 화면 ───────────────────────────────
export default function PhoneCall({ audio }) {
  const [consent, setConsent] = useState(() => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } });
  const [screen, setScreen] = useState('contacts');   // contacts | dial | ringing | call | ended
  const [friendId, setFriendId] = useState('shark');
  const [typed, setTyped] = useState('');
  const [talking, setTalking] = useState(false);       // 친구가 말하는 중
  const [thinking, setThinking] = useState(false);     // 친구 대답을 기다리는 중
  const [listening, setListening] = useState(false);   // 아기 말을 듣는 중
  const [heard, setHeard] = useState('');              // 마지막으로 알아들은 아기 말 (부모용 작은 글씨)
  const [friendLine, setFriendLine] = useState('');
  const [sec, setSec] = useState(0);
  const turnsRef = useRef([]);
  const babyTurnsRef = useRef(0);
  const nudgeRef = useRef(0);
  const callIdRef = useRef(0);                         // 통화마다 번호 (끊은 뒤 늦게 온 대답 무시)
  const timersRef = useRef([]);
  const listeningRef = useRef(false);
  const sessionRef = useRef(null);                     // 지금 듣기 (자동 또는 누르기)
  const callStartRef = useRef(0);
  const micRef = useRef(null);                         // { stream } 통화 화면에서 한 번 연 마이크
  const [micOk, setMicOk] = useState(true);            // 마이크를 못 열면 false (친구가 혼자 이어 간다)
  const [micErr, setMicErrState] = useState('');
  const micErrRef = useRef('');
  const setMicErr = (v) => { micErrRef.current = v; setMicErrState(v); };            // denied 허락 안 함 · inapp 앱 안 브라우저 · nomic · unsupported · other
  const micPromiseRef = useRef(null);
  const capCtxRef = useRef(null);                      // 녹음 전용 AudioContext (마이크를 연 뒤 만든다)
  const playerRef = useRef(null);                      // 연결음·친구 목소리를 트는 <audio> 하나 (터치 때 깨워 둔다)
  const [diag, setDiag] = useState('');                // 마이크·소리 문제 진단 (부모용 작은 글씨)
  const [showMicHelp, setShowMicHelp] = useState(false);
  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const friend = FRIEND_BY_ID[friendId];

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id; };
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  useEffect(() => () => { clearTimers(); callIdRef.current++; audio.interruptVoice(); endSession(); releaseMic(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // 통화 시간
  useEffect(() => {
    if (screen !== 'call') return undefined;
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [screen]);

  const tone = (f1, f2, d = 0.12) => { audio.playFreq(f1, 'sine', d, 0.18); audio.playFreq(f2, 'sine', d, 0.18); };
  // <audio> 플레이어: 터치(사용자 동작) 안에서 한 번 깨워 두면 그 뒤로는 아이폰에서도 마음대로 튼다
  const player = () => {
    if (!playerRef.current) { const a = new Audio(); a.preload = 'auto'; playerRef.current = a; }
    return playerRef.current;
  };
  const wakePlayer = () => { try { const a = player(); a.src = toneUrl('silent', SILENT); a.play().catch(() => { }); } catch { /* 무시 */ } };
  // url 을 틀고 소리가 실제로 나기 시작하면 onStart, 끝나면 onEnd (실패하면 onFail)
  const playUrl = (url, { onStart, onEnd, onFail } = {}) => {
    const a = player();
    let settled = false;
    const end = (fn) => () => { if (settled) return; settled = true; a.onended = a.onerror = a.onplaying = null; fn && fn(); };
    a.onplaying = () => { onStart && onStart(); a.onplaying = null; };
    a.onended = end(onEnd);
    a.onerror = end(onFail || onEnd);
    a.volume = 1;
    a.src = url;
    const pr = a.play();
    if (pr && pr.catch) pr.catch((e) => { setDiag(`재생: ${e && e.name}`); end(onFail || onEnd)(); });
  };
  const stopPlayer = () => { const a = playerRef.current; if (a) { a.onended = a.onerror = a.onplaying = null; try { a.pause(); } catch { /* 무시 */ } } };

  // 친구가 말하기 (목소리 MP3 를 받아 재생, 다 말하면 onDone)
  const say = (text, onDone) => {
    const id = callIdRef.current;
    turnsRef.current.push({ who: 'friend', text });
    let done = false;
    const finish = () => { if (done || callIdRef.current !== id) return; done = true; setTalking(false); onDone && onDone(); };
    const lines = splitLines(text);
    // 모든 문장의 목소리를 동시에 받아 기기 메모리에 (받는 대로 바로 틀 수 있게)
    const clips = lines.map(l => fetch(voiceUrl(friendId, l)).then(r => (r.ok ? r.blob() : null)).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null));
    let shown = 0;
    const show = (i) => {   // 자막은 소리가 나기 시작할 때 (문장이 나올 때마다 이어 붙인다)
      if (callIdRef.current !== id) return;
      shown = Math.max(shown, i + 1);
      setThinking(false); setTalking(true); setFriendLine(lines.slice(0, shown).join(' '));
    };
    const playAt = async (i) => {
      if (done || callIdRef.current !== id) return;
      if (i >= lines.length) { finish(); return; }
      const next = () => playAt(i + 1);
      const url = await clips[i];
      if (done || callIdRef.current !== id) return;
      if (!url) { show(i); nativeSay(lines[i], next); return; }
      playUrl(url, { onStart: () => show(i), onEnd: () => { URL.revokeObjectURL(url); next(); }, onFail: () => { show(i); nativeSay(lines[i], next); } });
    };
    playAt(0);
    later(finish, 20000 + text.length * 220);   // 무슨 일이 있어도 다음으로
  };

  // 다음 친구 말 요청
  // audioB64: 아기가 방금 한 말의 녹음 (있으면 Gemini 가 듣고 heard 로 알아들은 말을 돌려준다)
  const friendTurn = (phase, audioB64 = null) => {
    const id = callIdRef.current;
    setThinking(true);
    askFriend(friendId, turnsRef.current, phase, audioB64).then(({ text, heard: h }) => {
      if (callIdRef.current !== id || screenRef.current !== 'call') return;
      if (audioB64) {
        const said = (h || '').trim();
        setHeard(said);
        turnsRef.current.push({ who: 'baby', text: said });
        if (said) { babyTurnsRef.current++; nudgeRef.current = 0; } else nudgeRef.current++;
      }
      say(text, () => {
        if (phase === 'bye') { later(() => hangUp(true), 700); return; }
        if (micRef.current) later(() => listen(false), 350);   // 스피커 소리 끝자락을 듣지 않게 잠깐 쉬고
        else waitForBaby();
      });
    });
  };

  // 아기 차례: 한동안 말이 없으면 친구가 먼저 이어서 (두 번까지), 그다음은 작별
  const waitForBaby = () => {
    const id = callIdRef.current;
    later(() => {
      if (callIdRef.current !== id || listeningRef.current) return;
      if (nudgeRef.current < 2) { nudgeRef.current++; turnsRef.current.push({ who: 'baby', text: '' }); friendTurn('chat'); }
      else friendTurn('bye');
    }, IDLE_NUDGE_SEC * 1000);
  };

  // 마이크 열기 (통화 화면에서 한 번만 → 다음 통화부터는 다시 묻지 않는다)
  // 동시에 여러 번 부르면 같은 요청을 기다린다 (허락 창이 두 번 뜨지 않게)
  const ensureMic = () => {
    if (micRef.current && micRef.current.stream.getAudioTracks().some(t => t.readyState === 'live')) return Promise.resolve(true);
    if (micPromiseRef.current) return micPromiseRef.current;
    const p = (async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMicErr(IN_APP ? 'inapp' : 'unsupported'); setMicOk(false); return false; }
      let stream = null, err = null;
      if (navigator.permissions && navigator.permissions.query) {
        try { const st = await navigator.permissions.query({ name: 'microphone' }); setDiag(`권한: ${st.state}`); } catch { /* 지원 안 함 */ }
      }
      // 통화용 음성 처리를 끈 설정 → 안 되는 기기면 기본 설정으로 한 번 더
      for (const c of [{ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } }, { audio: true }]) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { err = e; if (e && e.name === 'NotAllowedError') break; }
      }
      if (!stream) {
        micRef.current = null; setMicOk(false);
        setMicErr(IN_APP ? 'inapp' : err && err.name === 'NotAllowedError' ? 'denied' : err && err.name === 'NotFoundError' ? 'nomic' : 'other');
        setDiag(`마이크: ${err && err.name} ${err && err.message ? err.message.slice(0, 60) : ''}`);
        return false;
      }
      micRef.current = { stream };
      // 녹음 전용 AudioContext: 마이크를 연 뒤에 만들어야 아이폰에서 '중단' 상태가 되지 않는다
      try {
        if (!capCtxRef.current || capCtxRef.current.state === 'closed') {
          const AC = window.AudioContext || window.webkitAudioContext;
          capCtxRef.current = new AC();
        }
        capCtxRef.current.resume().catch(() => { });
      } catch (e) { setDiag(`녹음 준비: ${e && e.name}`); }
      setMicOk(true); setMicErr('');
      return true;
    })();
    micPromiseRef.current = p;
    p.finally(() => { micPromiseRef.current = null; });
    return p;
  };
  // 화면을 떠날 때: 마이크를 닫고 일반 재생 모드로 (아이폰에서 소리가 다시 커지게)
  function releaseMic() {
    const m = micRef.current; micRef.current = null;
    if (m) m.stream.getTracks().forEach(t => t.stop());
    const c = capCtxRef.current; capCtxRef.current = null;
    if (c) c.close().catch(() => { });
    stopPlayer();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 무시 */ }
  }

  const startCall = () => {
    playUrl(toneUrl('ring', RING));   // 터치 안에서 바로 틀어야 아이폰에서도 들린다 (플레이어도 함께 깨워짐)
    ensureMic();   // 통화 버튼을 누른 순간(사용자 동작)에 마이크 허락을 받아 둔다
    clearTimers();
    callIdRef.current++;
    turnsRef.current = []; babyTurnsRef.current = 0; nudgeRef.current = 0;
    setSec(0); setHeard(''); setFriendLine(''); setTalking(false); setThinking(false);
    setScreen('ringing');
    // 따르릉 두 번 → 받음
    later(() => {
      if (screenRef.current !== 'ringing') return;
      setScreen('call'); screenRef.current = 'call';
      callStartRef.current = Date.now();
      friendTurn('hello');
    }, 4200);
  };

  function hangUp(byFriend = false) {
    clearTimers();
    callIdRef.current++;
    audio.interruptVoice();
    stopPlayer();
    endSession();
    listeningRef.current = false; setListening(false); setTalking(false); setThinking(false);
    if (!byFriend) playUrl(toneUrl('hangup', [[[480, 620], 0.25], [[], 0.1], [[480, 620], 0.25]]));
    setScreen('ended');
  }

  // 듣기 끝 정리 (녹음 노드 떼고 마이크는 꺼 둔다)
  function endSession() {
    const ss = sessionRef.current; sessionRef.current = null;
    if (!ss) return;
    ss.done = true; clearInterval(ss.poll);
    try { ss.src && ss.src.disconnect(); ss.proc && ss.proc.disconnect(); } catch { /* 무시 */ }
    if (ss.proc) ss.proc.onaudioprocess = null;
  }

  // 듣기: 소리 크기로 말 시작·끝을 알아채 녹음 → 끝나면 친구에게 보낸다. manual 이면 🎤 를 눌러 시작한 것
  const listen = async () => {
    if (listeningRef.current || screenRef.current !== 'call') return;
    const id = callIdRef.current;
    clearTimers();
    const ok = await ensureMic();
    const ctx = capCtxRef.current;
    if (ctx && ctx.state !== 'running') { try { await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 600))]); } catch { /* 아래에서 처리 */ } }
    if (!ok || !ctx || callIdRef.current !== id || screenRef.current !== 'call') { waitForBaby(); return; }
    if (ctx.state !== 'running') {
      // 녹음 엔진이 아직 잠들어 있다 (아이폰은 터치가 있어야 깨어나기도 함) → 🎤 를 눌러 달라고
      setDiag(`녹음 엔진: ${ctx.state}`); setMicOk(false); setMicErr('tap'); waitForBaby(); return;
    }
    listeningRef.current = true; setListening(true); setHeard('');
    const stream = micRef.current.stream;
    const ss = { done: false, chunks: [], speechAt: -1, lastVoice: 0, startAt: Date.now(), floor: 0, frames: 0, loud: 0, poll: 0, src: null, proc: null };
    sessionRef.current = ss;
    const finish = () => {
      if (ss.done) return;
      const chunks = ss.chunks, got = ss.speechAt >= 0, rate = ctx.sampleRate;
      endSession();
      listeningRef.current = false; setListening(false);
      if (callIdRef.current !== id) return;
      setThinking(true);
      const over = babyTurnsRef.current + 1 >= MAX_BABY_TURNS || (Date.now() - callStartRef.current) / 1000 >= MAX_CALL_SEC;
      if (!got) {
        // 아무 말이 없었다: 두 번까지는 친구가 먼저 이어 가고, 그다음은 작별
        turnsRef.current.push({ who: 'baby', text: '' });
        if (nudgeRef.current >= 2) friendTurn('bye'); else { nudgeRef.current++; friendTurn(over ? 'bye' : 'chat'); }
        return;
      }
      // 말 시작 0.4초 전부터 보낸다 (첫소리가 잘리지 않게)
      const per = chunks.length ? chunks[0].length / rate : 0.085;
      const from = Math.max(0, ss.speechAt - Math.ceil(0.4 / per));
      friendTurn(over ? 'bye' : 'chat', toWavBase64(chunks.slice(from), rate));
    };
    ss.finish = finish;
    try {
      ss.src = ctx.createMediaStreamSource(stream);
      ss.proc = ctx.createScriptProcessor(4096, 1, 1);
      ss.proc.onaudioprocess = (e) => {
        if (ss.done) return;
        const d = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(d.length); copy.set(d);
        ss.chunks.push(copy);
        let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const rms = Math.sqrt(sum / d.length);
        ss.frames++;
        if (ss.frames <= 3) { ss.floor = Math.max(ss.floor, rms); return; }   // 처음 잠깐은 주변 소리 크기를 잰다
        const th = Math.min(0.08, Math.max(0.012, ss.floor * 2.5));
        if (rms > th) { ss.loud++; ss.lastVoice = Date.now(); if (ss.loud >= 2 && ss.speechAt < 0) ss.speechAt = ss.chunks.length - 2; }
        else { ss.loud = 0; if (rms > th * 0.7) ss.lastVoice = Date.now(); }
      };
      ss.src.connect(ss.proc); ss.proc.connect(ctx.destination);   // 출력은 비워 두므로 소리가 나지 않는다
    } catch (e) { endSession(); listeningRef.current = false; setListening(false); setDiag(`녹음: ${e && e.name}`); setMicOk(false); setMicErr('other'); waitForBaby(); return; }
    ss.poll = setInterval(() => {
      if (ss.done) return;
      const now = Date.now();
      if (ss.speechAt >= 0 && now - ss.lastVoice > SILENCE_MS) finish();          // 말하다 조용해짐 → 대답
      else if (ss.speechAt >= 0 && now - ss.startAt > MAX_UTTER_MS + 2000) finish(); // 너무 길면 끊어서 보낸다
      else if (ss.speechAt < 0 && now - ss.startAt > NO_SPEECH_MS) finish();       // 아무 말 없음 → 친구가 이어 가기
    }, 150);
  };
  // 🎤 버튼: 듣는 중이면 "다 말했어요", 아니면 듣기 시작 (마이크 허락을 다시 받을 때도)
  const micDown = () => {
    if (talking || thinking) return;
    if (listeningRef.current) { if (sessionRef.current) sessionRef.current.finish(); return; }
    // 터치 안에서 녹음 엔진을 깨운다 (아이폰)
    if (capCtxRef.current && capCtxRef.current.state !== 'running') capCtxRef.current.resume().catch(() => { });
    if (!micOk) {
      // 허락 거절·앱 안 브라우저는 사이트가 다시 물을 수 없다 → 한 번 더 시도해 보고, 안 되면 켜는 방법을 크게 보여 준다
      ensureMic().then(ok => {
        if (ok) { setMicOk(true); setMicErr(''); listen(true); }
        else if (['denied', 'inapp'].includes(micErrRef.current)) setShowMicHelp(true);
      });
      return;
    }
    listen(true);
  };

  const pressKey = (k) => {
    const dtmf = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], '*': [941, 1209], 0: [941, 1336], '#': [941, 1477] }[k] || [800, 1200];
    try { const a = new Audio(toneUrl(`k${k}`, [[dtmf, 0.13]])); a.play().catch(() => tone(dtmf[0], dtmf[1], 0.12)); } catch { tone(dtmf[0], dtmf[1], 0.12); }
    // 아무 숫자를 눌러도 친구 번호가 한 자리씩 채워진다
    setTyped(t => (t.length < friend.number.length ? friend.number.slice(0, t.length + 1) : t));
  };

  // ── 화면 그리기 ──
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  const now = new Date(), clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const roundBtn = (bg, size = 76) => ({ width: size, height: size, borderRadius: '50%', border: 'none', background: bg, color: '#ffffff', fontSize: size * 0.42, cursor: 'pointer', touchAction: 'manipulation', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 22px -10px ${bg}` });

  let body;
  if (!consent) {
    body = (
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'safe center', gap: '10px', padding: '6px 4px', color: '#3f3a52' }}>
        <div style={{ fontSize: '2.4rem', textAlign: 'center', lineHeight: 1 }}>📞</div>
        <div style={{ fontFamily: JUA, fontSize: '1.3rem', textAlign: 'center' }}>부모님께 먼저 알려 드려요</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.84rem', lineHeight: 1.5, fontWeight: 700 }}>
          <li>통화 중에 친구 말이 끝나면 아기 목소리를 몇 초 녹음해요.</li>
          <li>그 녹음을 AI(Google Gemini)에 보내 알아듣고 친구의 대답을 만들어요.</li>
          <li>이 앱은 녹음과 대화를 저장하지 않아요. (보낸 내용은 Google 정책에 따라 처리돼요)</li>
          <li>'알겠어요'를 누르면 마이크 사용 허락을 물어봐요. '허용'을 눌러 주세요.</li>
          {IN_APP && <li style={{ color: '#dc2626' }}>지금은 앱(카카오톡 등) 안에서 열려 있어서 마이크가 안 될 수 있어요. ⋮ 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.</li>}
        </ul>
        <button onClick={() => { try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* 무시 */ } setConsent(true); audio.playFreq(660, 'sine', 0.12); wakePlayer(); ensureMic(); }} style={{ border: 'none', borderRadius: '22px', minHeight: '56px', flexShrink: 0, background: '#34d399', color: '#ffffff', fontFamily: JUA, fontSize: '1.25rem', cursor: 'pointer' }}>알겠어요, 시작할게요</button>
      </div>
    );
  } else if (screen === 'contacts') {
    body = (
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '6px 2px' }}>
        <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: '#3f3a52', padding: '0 6px' }}>누구에게 전화할까?</div>
        {FRIENDS.map(f => (
          <button key={f.id} onClick={() => { setFriendId(f.id); setTyped(''); setScreen('dial'); audio.playFreq(660, 'sine', 0.1); wakePlayer(); ensureMic(); }} style={{
            display: 'flex', alignItems: 'center', gap: '12px', border: 'none', borderRadius: '26px', padding: '10px 14px', background: f.color, cursor: 'pointer', touchAction: 'manipulation', textAlign: 'left', boxShadow: `0 10px 20px -14px ${f.ink}`
          }}>
            <div className="bps-contact-face" style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FriendFace id={f.id} size={80} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: f.ink }}>{f.name}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: f.ink, opacity: 0.7 }}>{f.desc}</div>
            </div>
            <span className="bps-contact-call" style={{ width: 56, height: 56, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', flexShrink: 0 }}>📞</span>
          </button>
        ))}
      </div>
    );
  } else if (screen === 'dial') {
    const ready = typed.length >= friend.number.length;
    body = (
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '4px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'stretch' }}>
          <button onClick={() => setScreen('contacts')} style={{ border: 'none', background: 'transparent', fontSize: '1.6rem', cursor: 'pointer' }}>⬅️</button>
          <FriendFace id={friend.id} size={52} />
          <span style={{ fontFamily: JUA, fontSize: '1.3rem', color: '#3f3a52' }}>{friend.name}</span>
        </div>
        <div style={{ fontFamily: JUA, fontSize: '2.4rem', letterSpacing: '6px', color: '#3f3a52', minHeight: '3rem' }}>
          {friend.number.split('').map((d, i) => <span key={i} style={{ color: i < typed.length ? '#3f3a52' : '#d4d4d8' }}>{d}</span>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%', maxWidth: '300px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
            <button key={k} onClick={() => pressKey(k)} style={{ height: '62px', borderRadius: '31px', border: 'none', background: '#f4f4f5', fontFamily: JUA, fontSize: '1.7rem', color: '#3f3a52', cursor: 'pointer', touchAction: 'manipulation' }}>{k}</button>
          ))}
        </div>
        <button onClick={() => { setTyped(friend.number); startCall(); }} aria-label="전화 걸기" style={{ ...roundBtn('#22c55e', 84), marginTop: '6px', animation: ready ? 'phonePulse 1s ease-in-out infinite' : 'none' }}>📞</button>
      </div>
    );
  } else if (screen === 'ringing' || screen === 'call') {
    const ringing = screen === 'ringing';
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px 4px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: JUA, fontSize: '1.7rem', color: '#ffffff' }}>{friend.name}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{ringing ? '따르릉 따르릉...' : `${mm}:${ss}`}</div>
        </div>
        <div style={{ position: 'relative', width: 210, height: 210, borderRadius: '50%', background: friend.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: talking ? `0 0 0 10px rgba(255,255,255,0.25), 0 0 0 22px rgba(255,255,255,0.12)` : 'none', transition: 'box-shadow 0.2s' }}>
          <FriendFace id={friend.id} size={200} talking={talking} ringing={ringing} />
          {thinking && <div style={{ position: 'absolute', top: '-8px', right: '-6px', background: '#ffffff', borderRadius: '18px', padding: '4px 12px', fontFamily: JUA, fontSize: '1.3rem', color: '#6b7280' }}>음...</div>}
        </div>
        <div style={{ minHeight: '3.6em', textAlign: 'center', fontFamily: JUA, fontSize: '1.15rem', color: '#ffffff', padding: '0 8px', lineHeight: 1.35 }}>{!ringing && friendLine}</div>
        {!ringing && (
          <button
            onPointerDown={(e) => { e.preventDefault(); micDown(); }}
            disabled={talking || thinking}
            aria-label="말하기"
            style={{ ...roundBtn(listening ? '#f43f5e' : '#ffffff', 108), color: listening ? '#ffffff' : '#3f3a52', fontSize: '2.8rem', opacity: talking || thinking ? 0.45 : 1, animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          >🎤</button>
        )}
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.75)', minHeight: '1.2em', textAlign: 'center' }}>
          {ringing ? '' : listening ? '듣고 있어요... 말해 보세요' : talking || thinking ? (heard ? `유나: ${heard}` : '') : (micOk ? '' : MIC_HELP[micErr] || MIC_HELP.other)}
          {diag && !micOk && <div style={{ fontSize: '0.62rem', opacity: 0.6, marginTop: '2px' }}>{diag}</div>}
        </div>
        <button onClick={() => hangUp(false)} aria-label="전화 끊기" style={{ ...roundBtn('#ef4444', 70), fontSize: '1.9rem' }}>✕</button>
      </div>
    );
  } else {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
        <FriendFace id={friend.id} size={150} />
        <div style={{ fontFamily: JUA, fontSize: '1.6rem', color: '#3f3a52' }}>통화가 끝났어요</div>
        {sec > 0 && <div style={{ fontWeight: 800, color: '#6b7280' }}>{mm}:{ss} 동안 이야기했어요</div>}
        <div style={{ display: 'flex', gap: '14px' }}>
          <button onClick={startCall} style={{ border: 'none', borderRadius: '24px', height: '56px', padding: '0 20px', background: '#22c55e', color: '#ffffff', fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer' }}>📞 다시 걸기</button>
          <button onClick={() => setScreen('contacts')} style={{ border: 'none', borderRadius: '24px', height: '56px', padding: '0 20px', background: '#e0e7ff', color: '#3730a3', fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer' }}>👫 다른 친구</button>
        </div>
      </div>
    );
  }

  // 마이크 켜는 방법 (막혔을 때 🎤 를 누르면)
  if (showMicHelp) {
    const steps = micErr === 'inapp'
      ? ['오른쪽 위(또는 아래) ⋮ 메뉴를 눌러요', '"다른 브라우저로 열기"를 눌러요', '크롬이나 사파리에서 전화 놀이를 다시 열어요']
      : isIOS
        ? ['주소창 왼쪽의 "가가"(또는 ⚙︎)를 눌러요', '"웹사이트 설정" → 마이크를 "허용"으로 바꿔요', '아래 "새로고침"을 눌러요']
        : ['주소창 왼쪽의 자물쇠(또는 ⓘ)를 눌러요', '"권한" → 마이크를 "허용"으로 바꿔요', '아래 "새로고침"을 눌러요'];
    body = (
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'safe center', gap: '12px', padding: '6px 4px', color: '#3f3a52' }}>
        <div style={{ fontSize: '2.4rem', textAlign: 'center', lineHeight: 1 }}>🎤🚫</div>
        <div style={{ fontFamily: JUA, fontSize: '1.25rem', textAlign: 'center' }}>마이크가 꺼져 있어요</div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', color: '#6b7280' }}>한 번 '허용 안 함'이 되면 앱이 다시 물어볼 수 없어서, 부모님이 직접 켜 주셔야 해요.</div>
        {diag && <div style={{ fontSize: '0.7rem', textAlign: 'center', color: '#9ca3af' }}>진단: {diag}</div>}
        <ol style={{ margin: 0, paddingLeft: '1.3rem', fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 800 }}>{steps.map(t => <li key={t}>{t}</li>)}</ol>
        <button onClick={() => window.location.reload()} style={{ border: 'none', borderRadius: '22px', minHeight: '54px', flexShrink: 0, background: '#34d399', color: '#ffffff', fontFamily: JUA, fontSize: '1.2rem', cursor: 'pointer' }}>🔄 새로고침</button>
        <button onClick={() => setShowMicHelp(false)} style={{ border: 'none', borderRadius: '22px', minHeight: '46px', flexShrink: 0, background: '#e5e7eb', color: '#374151', fontFamily: JUA, fontSize: '1.05rem', cursor: 'pointer' }}>돌아가기</button>
      </div>
    );
  }

  const dark = consent && !showMicHelp && (screen === 'ringing' || screen === 'call');
  const screenBg = dark ? `linear-gradient(180deg, ${friend.ink} 0%, #1e1b4b 100%)` : 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)';
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '6px', background: 'radial-gradient(circle at 30% 20%, #e0f2fe 0, rgba(224,242,254,0) 45%), radial-gradient(circle at 75% 80%, #fce7f3 0, rgba(252,231,243,0) 45%)', borderRadius: '28px' }}>
      <style>{'@keyframes phonePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 50% { box-shadow: 0 0 0 16px rgba(34,197,94,0); } } @keyframes micPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.55); } 50% { box-shadow: 0 0 0 22px rgba(244,63,94,0); } }'}</style>
      {/* 장난감 전화기 */}
      <div className="bps-phone" style={{
        height: '100%', maxHeight: '700px', aspectRatio: '0.52', minHeight: 0, background: 'linear-gradient(145deg, #fb7185, #f472b6)', borderRadius: '52px', padding: '14px',
        boxShadow: '0 30px 50px -24px rgba(190,24,93,0.6), inset 0 2px 0 rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', position: 'relative'
      }}>
        {/* 옆 버튼 */}
        <span style={{ position: 'absolute', left: '-6px', top: '22%', width: '6px', height: '54px', borderRadius: '4px 0 0 4px', background: '#e11d48' }} />
        <span style={{ position: 'absolute', right: '-6px', top: '30%', width: '6px', height: '80px', borderRadius: '0 4px 4px 0', background: '#e11d48' }} />
        <div style={{ flex: 1, minHeight: 0, borderRadius: '40px', background: screenBg, padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', transition: 'background 0.4s' }}>
          {/* 상태 표시줄 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: dark ? '#ffffff' : '#3f3a52', padding: '0 8px 6px' }}>
            <span>{clock}</span>
            <span style={{ width: '90px', height: '22px', borderRadius: '12px', background: '#1f2937' }} />
            <span>📶 🔋</span>
          </div>
          {body}
          <div style={{ width: '120px', height: '5px', borderRadius: '3px', background: dark ? 'rgba(255,255,255,0.6)' : '#d4d4d8', margin: '8px auto 0' }} />
        </div>
      </div>
    </div>
  );
}
