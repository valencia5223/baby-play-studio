// ═════════════════════════════════════════════════════════════════════════════
// 📞 전화 놀이: 장난감 전화기로 친구(아기상어·원숭이·판다)에게 전화를 걸어 이야기한다
//  - 흐름: 친구 고르기 → 번호 누르기(아무 숫자나 눌러도 친구 번호가 한 자리씩 채워짐) → 따르릉 → 통화 → 끊기
//  - 대답: Supabase Edge Function baby-call (Gemini, 아기 수준·친구 성격, 저장 안 함)
//  - 목소리: baby-voice?who=친구 (무료 Edge 목소리 3개를 친구마다 속도·음높이로 다르게)
//  - 아기 말: 친구 말이 끝나면 저절로 듣기 시작(Web Speech, ko-KR) → 1.3초 조용하면 대답. 자동 듣기가 막힌 기기는 🎤 를 누르고 말하기.
//    못 알아듣거나 말이 없어도 친구가 이어 간다
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
async function askFriend(friendId, turns, phase) {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(`${API}/baby-call`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ friend: friendId, phase, turns })
    });
    clearTimeout(tm);
    const d = await r.json();
    if (r.ok && d.text) return d.text;
  } catch { /* 아래 준비한 말 */ }
  const f = FRIEND_BY_ID[friendId];
  if (phase === 'bye') return f.bye;
  return f.fallback[Math.floor(Math.random() * f.fallback.length)];
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
  const heardRef = useRef('');
  const listeningRef = useRef(false);
  const sessionRef = useRef(null);                     // 지금 듣기 (자동 또는 누르기)
  const callStartRef = useRef(0);
  const autoOkRef = useRef(true);                      // 자동 듣기가 되는 기기인지 (권한 거절·미지원이면 false → 눌러서 말하기)
  const [autoOk, setAutoOk] = useState(true);
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const friend = FRIEND_BY_ID[friendId];
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id; };
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  useEffect(() => () => { clearTimers(); callIdRef.current++; audio.interruptVoice(); endSession(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // 통화 시간
  useEffect(() => {
    if (screen !== 'call') return undefined;
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [screen]);

  const tone = (f1, f2, d = 0.12) => { audio.playFreq(f1, 'sine', d, 0.18); audio.playFreq(f2, 'sine', d, 0.18); };

  // 친구가 말하기 (목소리 MP3 를 받아 재생, 다 말하면 onDone)
  const say = (text, onDone) => {
    const id = callIdRef.current;
    setFriendLine(text); setTalking(true); setThinking(false);
    turnsRef.current.push({ who: 'friend', text });
    let done = false;
    const finish = () => { if (done || callIdRef.current !== id) return; done = true; setTalking(false); onDone && onDone(); };
    const lines = splitLines(text);
    const urls = lines.map(l => voiceUrl(friendId, l));
    urls.forEach(u => { audio.getVoiceBuffer(u).catch(() => { }); });   // 모든 문장의 목소리를 동시에 미리 받기
    const playAt = (i) => {
      if (done || callIdRef.current !== id) return;
      if (i >= lines.length) { finish(); return; }
      const next = () => playAt(i + 1);
      audio.playClipThen(urls[i], next, () => nativeSay(lines[i], next), 12000);
    };
    playAt(0);
    later(finish, 14000 + text.length * 220);   // 무슨 일이 있어도 다음으로
  };

  // 다음 친구 말 요청
  const friendTurn = (phase) => {
    const id = callIdRef.current;
    setThinking(true);
    askFriend(friendId, turnsRef.current, phase).then(text => {
      if (callIdRef.current !== id || screenRef.current !== 'call') return;
      say(text, () => {
        if (phase === 'bye') { later(() => hangUp(true), 700); return; }
        if (SR && autoOkRef.current) later(() => listen(false), 350);   // 스피커 소리 끝자락을 듣지 않게 잠깐 쉬고
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

  const startCall = () => {
    clearTimers();
    callIdRef.current++;
    turnsRef.current = []; babyTurnsRef.current = 0; nudgeRef.current = 0;
    setSec(0); setHeard(''); setFriendLine(''); setTalking(false); setThinking(false);
    setScreen('ringing');
    // 따르릉 두 번 → 받음
    const ring = () => { for (let k = 0; k < 6; k++) later(() => tone(440, 480, 0.16), k * 190); };
    ring(); later(ring, 2000);
    later(() => {
      if (screenRef.current !== 'ringing') return;
      tone(880, 1320, 0.08);
      setScreen('call'); screenRef.current = 'call';
      callStartRef.current = Date.now();
      friendTurn('hello');
    }, 4200);
  };

  function hangUp(byFriend = false) {
    clearTimers();
    callIdRef.current++;
    audio.interruptVoice();
    endSession();
    listeningRef.current = false; setListening(false); setTalking(false); setThinking(false);
    if (!byFriend) tone(480, 620, 0.25);
    setScreen('ended');
  }

  // 아기 말 보내기 (빈 말 = 조용했음: 두 번까지는 친구가 먼저 이어 가고, 그다음은 작별)
  const sendBaby = (raw) => {
    const text = (raw || '').trim();
    setHeard(text);
    if (!text) {
      if (nudgeRef.current >= 2) { friendTurn('bye'); return; }
      nudgeRef.current++;
    } else { nudgeRef.current = 0; babyTurnsRef.current++; }
    turnsRef.current.push({ who: 'baby', text });
    const over = babyTurnsRef.current >= MAX_BABY_TURNS || (Date.now() - callStartRef.current) / 1000 >= MAX_CALL_SEC;
    friendTurn(over ? 'bye' : 'chat');
  };
  const endSession = () => {
    const ss = sessionRef.current; sessionRef.current = null;
    if (!ss) return;
    ss.done = true; clearInterval(ss.poll);
    const rec = ss.rec; ss.rec = null;
    if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; try { rec.abort(); } catch { /* 무시 */ } }
  };

  // 듣기: manual=false 는 친구 말이 끝난 뒤 저절로, true 는 🎤 를 누르고 있는 동안
  const listen = (manual) => {
    if (listeningRef.current || screenRef.current !== 'call') return;
    const id = callIdRef.current;
    clearTimers();
    heardRef.current = '';
    listeningRef.current = true; setListening(true); setHeard('');
    if (manual) audio.playFreq(1046, 'sine', 0.08, 0.2);
    const ss = { done: false, gotSpeech: false, startAt: Date.now(), lastAt: Date.now(), rec: null, poll: 0 };
    sessionRef.current = ss;
    const finish = () => {
      if (ss.done) return;
      endSession();
      listeningRef.current = false; setListening(false);
      if (callIdRef.current !== id) return;
      setThinking(true);
      sendBaby(heardRef.current);
    };
    ss.finish = finish;
    const startRec = () => {
      if (!SR || ss.done) return;
      try {
        const rec = new SR();
        rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          heardRef.current = t; setHeard(t);
          if (t.trim()) { ss.gotSpeech = true; ss.lastAt = Date.now(); }
        };
        rec.onerror = (e) => {
          // 마이크 권한 거절·지원 안 함 → 이 기기는 눌러서 말하기로
          if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture')) { autoOkRef.current = false; setAutoOk(false); }
        };
        rec.onend = () => {
          if (ss.done) return;
          ss.rec = null;
          if (ss.gotSpeech) finish();                                        // 기기가 먼저 끝냈으면 들은 데까지 보낸다
          else if (manual || autoOkRef.current) setTimeout(startRec, 150);   // 아직 말이 없으면 다시 듣기
        };
        rec.start();
        ss.rec = rec;
      } catch { autoOkRef.current = false; setAutoOk(false); }
    };
    startRec();
    ss.poll = setInterval(() => {
      if (ss.done) return;
      const now = Date.now();
      if (ss.gotSpeech && now - ss.lastAt > SILENCE_MS) finish();                        // 말하다 조용해짐 → 대답
      else if (!manual && !ss.gotSpeech && now - ss.startAt > NO_SPEECH_MS) finish();    // 아무 말 없음 → 친구가 이어 가기
      else if (!manual && !autoOkRef.current) {                                          // 자동 듣기가 막힘 → 눌러서 말하기로 바꾸고 기다리기
        endSession(); listeningRef.current = false; setListening(false); waitForBaby();
      }
    }, 200);
  };
  // 🎤 버튼: 자동 듣기 중이면 누르는 즉시 "다 말했어요", 눌러서 말하기 기기면 누르고 있는 동안 듣기
  const micDown = () => {
    if (talking || thinking) return;
    if (listeningRef.current) { if (autoOkRef.current && sessionRef.current) sessionRef.current.finish(); return; }
    listen(true);
  };
  const micUp = () => {
    if (!autoOkRef.current && listeningRef.current && sessionRef.current) sessionRef.current.finish();
  };

  const pressKey = (k) => {
    const dtmf = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], '*': [941, 1209], 0: [941, 1336], '#': [941, 1477] }[k] || [800, 1200];
    tone(dtmf[0], dtmf[1], 0.12);
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px', padding: '10px 6px', color: '#3f3a52' }}>
        <div style={{ fontSize: '3rem', textAlign: 'center' }}>📞</div>
        <div style={{ fontFamily: JUA, fontSize: '1.4rem', textAlign: 'center' }}>부모님께 먼저 알려 드려요</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', lineHeight: 1.6, fontWeight: 700 }}>
          <li>통화 중에 친구 말이 끝나면 아기 목소리를 듣고, 이 기기가 글자로 바꿔요.</li>
          <li>그 글자만 AI(Google Gemini)에 보내 친구의 대답을 만들어요.</li>
          <li>목소리와 대화 내용은 어디에도 저장하지 않아요.</li>
          <li>처음 한 번 마이크 사용 허락을 물어봐요.</li>
        </ul>
        <button onClick={() => { try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* 무시 */ } setConsent(true); audio.playFreq(660, 'sine', 0.12); }} style={{ border: 'none', borderRadius: '22px', height: '56px', background: '#34d399', color: '#ffffff', fontFamily: JUA, fontSize: '1.25rem', cursor: 'pointer' }}>알겠어요, 시작할게요</button>
      </div>
    );
  } else if (screen === 'contacts') {
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '6px 2px' }}>
        <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: '#3f3a52', padding: '0 6px' }}>누구에게 전화할까?</div>
        {FRIENDS.map(f => (
          <button key={f.id} onClick={() => { setFriendId(f.id); setTyped(''); setScreen('dial'); audio.playFreq(660, 'sine', 0.1); }} style={{
            display: 'flex', alignItems: 'center', gap: '12px', border: 'none', borderRadius: '26px', padding: '10px 14px', background: f.color, cursor: 'pointer', touchAction: 'manipulation', textAlign: 'left', boxShadow: `0 10px 20px -14px ${f.ink}`
          }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FriendFace id={f.id} size={80} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: JUA, fontSize: '1.5rem', color: f.ink }}>{f.name}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: f.ink, opacity: 0.7 }}>{f.desc}</div>
            </div>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', flexShrink: 0 }}>📞</span>
          </button>
        ))}
      </div>
    );
  } else if (screen === 'dial') {
    const ready = typed.length >= friend.number.length;
    body = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '4px 2px' }}>
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
            onPointerUp={micUp} onPointerLeave={micUp} onPointerCancel={micUp}
            disabled={talking || thinking}
            aria-label="말하기"
            style={{ ...roundBtn(listening ? '#f43f5e' : '#ffffff', 108), color: listening ? '#ffffff' : '#3f3a52', fontSize: '2.8rem', opacity: talking || thinking ? 0.45 : 1, animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          >🎤</button>
        )}
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.75)', minHeight: '1.2em', textAlign: 'center' }}>
          {ringing ? '' : listening ? (heard ? `유나: ${heard}` : autoOk ? '듣고 있어요... 말해 보세요' : '듣고 있어요... 손을 떼면 친구가 대답해요') : talking || thinking ? (heard ? `유나: ${heard}` : '') : (autoOk ? '' : '🎤를 누르고 말해 보세요')}
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

  const dark = consent && (screen === 'ringing' || screen === 'call');
  const screenBg = dark ? `linear-gradient(180deg, ${friend.ink} 0%, #1e1b4b 100%)` : 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)';
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '6px', background: 'radial-gradient(circle at 30% 20%, #e0f2fe 0, rgba(224,242,254,0) 45%), radial-gradient(circle at 75% 80%, #fce7f3 0, rgba(252,231,243,0) 45%)', borderRadius: '28px' }}>
      <style>{'@keyframes phonePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 50% { box-shadow: 0 0 0 16px rgba(34,197,94,0); } } @keyframes micPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,0.55); } 50% { box-shadow: 0 0 0 22px rgba(244,63,94,0); } }'}</style>
      {/* 장난감 전화기 */}
      <div style={{
        height: '100%', maxHeight: '700px', aspectRatio: '0.52', minHeight: 0, background: 'linear-gradient(145deg, #fb7185, #f472b6)', borderRadius: '52px', padding: '14px',
        boxShadow: '0 30px 50px -24px rgba(190,24,93,0.6), inset 0 2px 0 rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', position: 'relative'
      }}>
        {/* 옆 버튼 */}
        <span style={{ position: 'absolute', left: '-6px', top: '22%', width: '6px', height: '54px', borderRadius: '4px 0 0 4px', background: '#e11d48' }} />
        <span style={{ position: 'absolute', right: '-6px', top: '30%', width: '6px', height: '80px', borderRadius: '0 4px 4px 0', background: '#e11d48' }} />
        <div style={{ flex: 1, minHeight: 0, borderRadius: '40px', background: screenBg, padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background 0.4s' }}>
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
