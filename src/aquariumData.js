// ═════════════════════════════════════════════════════════════════════════════
// 🐠 내 어항 키우기 – 데이터 & 규칙
// 물고기 종류, 장식, 바다 친구 가격, 성장/컨디션 계산, 저장 형식을 모아 둔다.
// (React 없음: voiceLines.js 의 음성 문장 목록에서도 그대로 불러 쓴다)
// ═════════════════════════════════════════════════════════════════════════════

// 물고기 종류
//  len: 다 큰 물고기 길이(px, 화면 크기에 따라 조금 더 커짐) / hRatio: 몸 높이 비율
//  shape: normal(보통) · angel(세로로 긴 마름모) · disc(동그란 원반) · betta(긴 지느러미) · tang(타원) · cory(바닥 메기)
//  growMul: 성장 속도 배율 / zone: 주로 머무는 높이 (mid · bottom · top)
export const FISH_SPECIES = [
  {
    id: 'neon', desc: '파란 줄무늬가 반짝반짝', name: '네온테트라', price: 0, starter: true, len: 34, hRatio: 0.3, shape: 'normal',
    speed: 1.1, growMul: 1.25, school: true, zone: 'mid',
    top: '#475569', belly: '#e2e8f0',
    bands: [{ color: '#22d3ee', y: -0.12, from: 0.05, to: 0.78, w: 0.2, glow: true }, { color: '#ef4444', y: 0.2, from: 0.42, to: 0.92, w: 0.3 }],
    tail: { color: 'rgba(226,232,240,0.55)', len: 0.3, spread: 0.3 }, fin: 'rgba(226,232,240,0.45)'
  },
  {
    id: 'guppy', name: '구피', price: 0, starter: true, desc: '🎲 디자인은 랜덤!', len: 34, hRatio: 0.3, shape: 'normal',
    speed: 0.95, growMul: 1.25, school: false, zone: 'top',
    top: '#a8a29e', belly: '#fef3c7',
    tail: { grad: ['#f97316', '#ec4899', '#3b82f6'], len: 0.8, spread: 0.6 }, fin: 'rgba(236,72,153,0.6)'
  },
  {
    id: 'danio', desc: '줄무늬 달리기 선수', name: '지브라다니오', price: 0, starter: true, len: 36, hRatio: 0.27, shape: 'normal',
    speed: 1.25, growMul: 1.15, school: true, zone: 'mid',
    top: '#94a3b8', belly: '#fefce8',
    bands: [{ color: '#1e3a8a', y: -0.18, from: 0.12, to: 0.98, w: 0.14 }, { color: '#1e40af', y: 0.02, from: 0.1, to: 1, w: 0.14 }, { color: '#1e3a8a', y: 0.22, from: 0.2, to: 1, w: 0.12 }],
    tail: { color: 'rgba(253,224,71,0.5)', len: 0.34, spread: 0.32 }, fin: 'rgba(253,224,71,0.45)'
  },
  {
    id: 'goldfish', desc: '통통한 꼬리 살랑살랑', name: '금붕어', price: 0, starter: true, len: 60, hRatio: 0.52, shape: 'normal',
    speed: 0.6, growMul: 0.85, school: false, zone: 'mid',
    top: '#ea580c', belly: '#fde68a',
    tail: { color: 'rgba(251,146,60,0.72)', len: 0.75, spread: 0.62, double: true }, fin: 'rgba(251,146,60,0.65)'
  },
  {
    id: 'platy', desc: '주황빛 동글동글', name: '플래티', price: 125, len: 40, hRatio: 0.4, shape: 'normal',
    speed: 0.9, growMul: 1.1, school: true, zone: 'mid',
    top: '#dc2626', belly: '#fdba74',
    tail: { color: 'rgba(15,23,42,0.75)', len: 0.36, spread: 0.36 }, fin: 'rgba(248,113,113,0.6)'
  },
  {
    id: 'cory', desc: '바닥을 콕콕 청소해요', name: '코리도라스', price: 165, len: 40, hRatio: 0.36, shape: 'cory',
    speed: 0.55, growMul: 1, school: true, zone: 'bottom',
    top: '#78716c', belly: '#f5f5f4', spots: '#44403c',
    tail: { color: 'rgba(214,211,209,0.6)', len: 0.3, spread: 0.32 }, fin: 'rgba(214,211,209,0.55)'
  },
  {
    // 비파(플레코): 바닥과 유리에 붙어 다니며 유리 이끼를 먹어 치운다
    id: 'pleco', name: '비파', price: 250, desc: '유리 이끼를 먹어요', len: 58, hRatio: 0.3, shape: 'pleco',
    speed: 0.45, growMul: 0.9, school: false, zone: 'bottom', algaeEater: true,
    top: '#44403c', belly: '#78716c', spots: '#e7e5e4',
    tail: { color: 'rgba(68,64,60,0.85)', len: 0.3, spread: 0.36, solid: true }, fin: 'rgba(87,83,78,0.85)'
  },
  {
    id: 'betta', desc: '치렁치렁 긴 지느러미', name: '베타', price: 210, len: 54, hRatio: 0.3, shape: 'betta',
    speed: 0.5, growMul: 0.95, school: false, zone: 'top',
    top: '#1d4ed8', belly: '#7c3aed',
    tail: { grad: ['#2563eb', '#7c3aed', '#dc2626'], len: 1.05, spread: 0.85 }, fin: 'rgba(124,58,237,0.6)'
  },
  {
    id: 'angel', desc: '세모 날개로 우아하게', name: '엔젤피시', price: 335, len: 52, hRatio: 0.95, shape: 'angel',
    speed: 0.55, growMul: 0.9, school: false, zone: 'mid',
    top: '#cbd5e1', belly: '#f8fafc', bars: '#1e293b',
    tail: { color: 'rgba(226,232,240,0.6)', len: 0.4, spread: 0.45 }, fin: 'rgba(226,232,240,0.55)'
  },
  {
    id: 'tang', desc: '파란 몸에 노란 꼬리', name: '블루탱', price: 500, len: 60, hRatio: 0.62, shape: 'tang',
    speed: 0.8, growMul: 0.85, school: false, zone: 'mid',
    top: '#1d4ed8', belly: '#3b82f6', mark: '#0f172a',
    tail: { color: '#facc15', len: 0.38, spread: 0.4, solid: true }, fin: 'rgba(15,23,42,0.75)'
  },
  {
    id: 'discus', desc: '동그란 접시 모양', name: '디스커스', price: 665, len: 62, hRatio: 0.95, shape: 'disc',
    speed: 0.45, growMul: 0.8, school: false, zone: 'mid',
    top: '#ea580c', belly: '#f59e0b', waves: '#38bdf8',
    tail: { color: 'rgba(234,88,12,0.6)', len: 0.25, spread: 0.3 }, fin: 'rgba(234,88,12,0.55)'
  },
  {
    id: 'mackerel', name: '고등어', price: 125, len: 64, hRatio: 0.24, shape: 'normal', desc: '떼 지어 쌩쌩!',
    speed: 1.3, growMul: 1, school: true, zone: 'mid',
    top: '#0f766e', belly: '#e2e8f0', backStripes: '#0f172a',
    tail: { color: 'rgba(15,118,110,0.85)', len: 0.34, spread: 0.52, fork: true }, fin: 'rgba(148,163,184,0.6)'
  },
  {
    id: 'rockfish', name: '우럭', price: 150, len: 62, hRatio: 0.36, shape: 'normal', desc: '가시 지느러미 바닥 대장',
    speed: 0.55, growMul: 0.9, school: false, zone: 'bottom',
    top: '#292524', belly: '#78716c', mottle: '#0c0a09', spiny: true, bigMouth: true,
    tail: { color: 'rgba(41,37,36,0.85)', len: 0.3, spread: 0.36, solid: true }, fin: 'rgba(68,64,60,0.85)'
  },
  {
    id: 'seabream', name: '참돔', price: 200, len: 64, hRatio: 0.46, shape: 'normal', desc: '빨간 바다의 왕',
    speed: 0.75, growMul: 0.85, school: false, zone: 'mid',
    top: '#e11d48', belly: '#fecdd3', spots: '#7dd3fc', spiny: true,
    tail: { color: 'rgba(225,29,72,0.8)', len: 0.36, spread: 0.54, fork: true }, fin: 'rgba(251,113,133,0.7)'
  },
  {
    id: 'hairtail', name: '갈치', price: 225, len: 112, hRatio: 0.09, shape: 'ribbon', desc: '은빛 리본처럼 길쭉',
    speed: 0.6, growMul: 0.85, school: false, zone: 'mid',
    top: '#94a3b8', belly: '#f8fafc',
    tail: { color: 'rgba(203,213,225,0)', len: 0.01, spread: 0.01 }, fin: 'rgba(226,232,240,0.55)'
  },
  {
    id: 'puffer', name: '복어', price: 250, len: 48, hRatio: 0.7, shape: 'puffer', desc: '톡 치면 빵빵!',
    speed: 0.5, growMul: 0.9, school: false, zone: 'mid',
    top: '#a16207', belly: '#fefce8', spots: '#422006',
    tail: { color: 'rgba(161,98,7,0.7)', len: 0.25, spread: 0.32 }, fin: 'rgba(250,204,21,0.5)'
  },
  {
    id: 'flounder', name: '광어', price: 300, len: 66, hRatio: 0.55, shape: 'flat', desc: '바닥에 납작 엎드려요', lieDown: true,
    speed: 0.4, growMul: 0.85, school: false, zone: 'bottom',
    top: '#78716c', belly: '#a8a29e', mottle: '#292524',
    tail: { color: 'rgba(120,113,108,0.85)', len: 0.18, spread: 0.3, solid: true }, fin: 'rgba(120,113,108,0.8)'
  }
];
export const FISH_BY_ID = Object.fromEntries(FISH_SPECIES.map(f => [f.id, f]));

// 구피는 실제처럼 디자인이 다양하다: 들어올 때마다 무작위로 하나 (glowTail: 어두우면 꼬리가 빛남)
export const GUPPY_VARIANTS = [
  { id: 'rainbow', name: '무지개', tail: ['#f97316', '#ec4899', '#3b82f6'] },
  { id: 'redcobra', name: '레드 코브라', tail: ['#991b1b', '#ef4444', '#fca5a5'], tailSpots: '#1f2937', top: '#9a3412', belly: '#fed7aa' },
  { id: 'bluegrass', name: '블루 그라스', tail: ['#1e3a8a', '#3b82f6', '#bfdbfe'], tailSpots: '#0f172a', top: '#475569', belly: '#e0f2fe' },
  { id: 'tuxedo', name: '옐로 턱시도', tail: ['#ca8a04', '#facc15', '#fef08a'], tuxedo: '#111827', fin: 'rgba(250,204,21,0.65)' },
  { id: 'albino', name: '알비노 레드', tail: ['#e11d48', '#fb7185', '#ffe4e6'], top: '#fecdd3', belly: '#fff1f2', eye: '#e11d48' },
  { id: 'mosaic', name: '드래곤 모자이크', tail: ['#6d28d9', '#db2777', '#f59e0b'], tailSpots: '#fde68a', fin: 'rgba(219,39,119,0.6)' },
  { id: 'koi', name: '코이', tail: ['#ffffff', '#fecaca', '#ef4444'], top: '#f8fafc', belly: '#ffffff', patches: '#ef4444', fin: 'rgba(255,255,255,0.7)' },
  { id: 'neonblue', name: '형광 네온블루', tail: ['#0e7490', '#22d3ee', '#a5f3fc'], glowTail: true, top: '#155e75', belly: '#cffafe', fin: 'rgba(34,211,238,0.6)' },
  { id: 'black', name: '풀 블랙', tail: ['#030712', '#1f2937', '#4b5563'], top: '#111827', belly: '#374151', fin: 'rgba(31,41,55,0.75)' }
];
export const GUPPY_BY_ID = Object.fromEntries(GUPPY_VARIANTS.map(v => [v.id, v]));

// 이로치(색이 다른 희귀 개체)가 나올 확률 – 물고기·바다 친구 모두 같은 확률
export const SHINY_RATE = 1 / 40;
export const rollShiny = () => Math.random() < SHINY_RATE;

// 장식 (모래 위에 놓는다) – 그림은 AquariumGame.jsx 의 drawDecor 가 그린다
export const DECOR_ITEMS = [
  { id: 'grass', name: '수초 덤불', price: 70, icon: '🌿' },
  { id: 'rock', name: '둥근 바위', price: 50, icon: '🪨' },
  { id: 'sword', name: '넓은잎 수초', price: 120, icon: '🍃' },
  { id: 'coral', name: '분홍 산호', price: 150, icon: '🪸' },
  { id: 'airstone', name: '뽀글 기포돌', price: 170, icon: '🫧' },
  { id: 'chest', name: '보물상자', price: 250, icon: '💰' },
  { id: 'castle', name: '모래성', price: 330, icon: '🏰' },
  { id: 'diver', name: '잠수부 아저씨', price: 420, icon: '🤿' }
];
export const DECOR_BY_ID = Object.fromEntries(DECOR_ITEMS.map(d => [d.id, d]));

// 바다 친구(기존 바다 생물 SVG) 가격
export const FRIEND_PRICES = {
  fish: 125, crab: 125, starfish: 125, shrimp: 125, seahorse: 165, jellyfish: 165,
  octopus: 250, squid: 250, turtle: 290, penguin: 290, seal: 335, shark: 460, whale: 500
};

// 상점에 보이는 바다 친구 한 줄 설명
export const FRIEND_DESC = {
  fish: '주황 지느러미 친구', crab: '옆으로 엉금엉금', starfish: '바닥을 느릿느릿', shrimp: '톡톡 튀는 새우',
  seahorse: '꼬리를 말고 둥실둥실', jellyfish: '뿅뿅 떠오르고 빛나요', octopus: '다리가 여덟 개',
  squid: '쓩 하고 헤엄쳐요', turtle: '느긋하게 헤엄쳐요', penguin: '물속을 쌩쌩',
  seal: '장난꾸러기 물개', shark: '씩씩한 바다 대장', whale: '바다에서 제일 커요'
};

// 기본 물고기(처음 받는 치어 종류)를 상점에서 더 살 때 가격
export const STARTER_FISH_PRICE = 50;

export const LIMITS = { fish: 20, friends: 4, decor: 10 };

// ── 번식 ──
// 구피·플래티는 새끼를 낳는 난태생, 나머지는 알을 낳는다.
// 난태생 암컷은 정자를 몸에 저장해 두어서, 한 번 짝짓기한 뒤에는 수컷이 없어도 가끔 다시 아기를 가진다.
const BREED = {
  guppy: { type: 'live', storesSperm: true, brood: [3, 5] },
  platy: { type: 'live', storesSperm: true, brood: [3, 5] }
};
const BREED_DEFAULT = { type: 'egg', storesSperm: false, brood: [3, 6] };
export const breedOf = (spId) => BREED[spId] || BREED_DEFAULT;
export const randomSex = () => (Math.random() < 0.5 ? 'm' : 'f');
export const SEX_NAMES = { m: '수컷', f: '암컷' };

// ── 성장 단계 ──
export const STAGE_NAMES = { fry: '아기 치어', juvenile: '어린 물고기', adult: '다 큰 물고기' };
export const stageOf = (growth) => (growth < 0.34 ? 'fry' : growth < 0.8 ? 'juvenile' : 'adult');
export const sizeScale = (growth) => 0.55 + 0.45 * (1 - Math.pow(1 - Math.min(1, growth), 1.6));

// ── 컨디션 & 성장 규칙 ──
// 배부름(full)·기분(happy)은 물고기마다, 물 더러움(dirt)은 어항 전체 값이다 (모두 0~100)
export const RATES = {
  growPerSec: 1 / 18000,    // 컨디션 최고일 때 치어 → 다 큰 물고기 약 5시간 (종류별 growMul 곱)
  offlineGrowMul: 0.08,     // 앱을 꺼둔 동안은 8% 속도로 자란다 (배고파지면 그마저 멈춤 → 며칠에 걸쳐 자람)
  fullDropPerSec: 100 / 420, // 놀 때 배부름 100 → 0 약 7분
  offlineFullDropPerSec: 100 / (8 * 3600),
  dirtPerSec: 100 / 1500,   // 놀 때 물 더러움 0 → 100 약 25분
  offlineDirtPerSec: 100 / (24 * 3600),
  happyDropPerSec: 100 / 900,
  offlineCapSec: 24 * 3600,
  sickPerSec: 1 / 3000,     // 놀 때 물고기 한 마리가 아플 확률 (평균 50분에 한 번, 배고프거나 물이 더러우면 3배)
  sickMax: 2,               // 한 번에 아픈 물고기는 최대 2마리
  pregPerSec: 1 / 900,      // 짝이 있고 컨디션 좋은 다 큰 암컷이 아기를 가질 확률 (평균 15분)
  pregSoloMul: 0.35,        // 저장한 정자로 수컷 없이 가질 때는 훨씬 드물게
  pregCond: 70,             // 이 컨디션 이상일 때만
  pregSec: 480,             // 배가 불러서 낳기까지 놀이 시간 8분
  offlinePregMul: 0.3,      // 꺼둔 동안은 천천히 (낳는 건 보고 있을 때 하도록 98% 에서 멈춤)
  pregRestSec: 1200,        // 낳은 뒤 20분은 쉰다
  eggHatchSec: 90           // 알에서 깨어나기까지 1분 30초
};
// ── 낮과 밤 (실제 시계) ── 저녁 8시 ~ 아침 7시는 밤: 어항이 어두워지고 물고기들이 잔다
export const NIGHT_HOURS = { from: 20, to: 7 };
export const isNightTime = (d = new Date()) => { const h = d.getHours(); return h >= NIGHT_HOURS.from || h < NIGHT_HOURS.to; };

export const isSad = (fish, dirt) => fish.full < 25 || dirt > 70 || !!fish.sick;
// 컨디션 점수 0~100 (배부름 40% + 물 깨끗함 40% + 기분 20%)
export const conditionOf = (fish, dirt) => Math.round(fish.full * 0.4 + (100 - dirt) * 0.4 + fish.happy * 0.2);
// 컨디션에 따른 성장 배율 (슬프면 멈춤)
export const growFactor = (fish, dirt) => (isSad(fish, dirt) ? 0 : Math.max(0.15, Math.min(1, (conditionOf(fish, dirt) - 30) / 55)));

// ── 포인트(조개) 보상 ──
export const REWARDS = { eat: 1, poop: 2, algae: 1, waterChange: 10, juvenile: 20, adult: 50, pearl: 5, daily: 20, pet: 1, heal: 5, birth: 10 };

// ── 저장 ──
export const SAVE_KEY = 'bps_aquarium_v1';
let uidSeq = 0;
export const newUid = () => `${Date.now().toString(36)}${(uidSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
// 바다 친구도 아기 모습으로 와서 자란다 (밥 대신 물 깨끗함에 따라 자람)
export const newFriend = (id) => ({ uid: newUid(), id, growth: 0, shiny: rollShiny(), bornAt: Date.now() });
export const friendGrowFactor = (dirt) => (dirt > 70 ? 0 : Math.max(0.15, Math.min(1, (100 - dirt) / 70)));

export const newFish = (sp) => ({
  uid: newUid(), sp, growth: 0, full: 80, happy: 80, bornAt: Date.now(),
  variant: sp === 'guppy' ? GUPPY_VARIANTS[Math.floor(Math.random() * GUPPY_VARIANTS.length)].id : undefined,
  shiny: rollShiny(),
  sex: randomSex()
});

// 짝짓기 조건: 다 큰 암컷 + 컨디션 좋음 + 쉬는 중 아님 + 아기들이 들어갈 자리.
// 같은 종류의 다 큰 수컷이 어항에 있어야 한다 (난태생은 예전에 짝짓기했으면 수컷 없이도 가끔)
export function mateStatus(game, f, now = Date.now()) {
  if (f.sex !== 'f' || f.preg != null || f.sick || stageOf(f.growth) !== 'adult') return null;
  if ((f.restUntil || 0) > now) return null;
  if (conditionOf(f, game.dirt) < RATES.pregCond || isSad(f, game.dirt)) return null;
  const pending = game.fish.reduce((a, o) => a + (o.preg != null ? breedOf(o.sp).brood[1] : 0), 0) + (game.eggs || []).reduce((a, e) => a + e.n, 0);
  if (game.fish.length + pending + 2 > LIMITS.fish) return null;
  const male = game.fish.some(o => o.sp === f.sp && o.sex === 'm' && stageOf(o.growth) === 'adult' && !o.sick);
  if (male) return 'pair';
  if (breedOf(f.sp).storesSperm && f.mated) return 'solo';
  return null;
}

export function createNewGame() {
  return {
    version: 1,
    points: 30,
    dirt: 0,
    algae: 0,
    poop: [],
    // 처음엔 기본 물고기들의 치어로 시작 (떼 지어 다니는 종류는 여러 마리)
    // 떼 지어 다니는 종류는 암수가 섞이게
    fish: ['neon', 'neon', 'neon', 'danio', 'danio', 'guppy', 'guppy', 'goldfish'].map((sp, i, arr) => {
      const f = newFish(sp);
      const idx = arr.slice(0, i).filter(x => x === sp).length;
      if (arr.filter(x => x === sp).length > 1) f.sex = idx % 2 ? 'f' : 'm';
      return f;
    }),
    eggs: [],
    friends: [],
    decor: [
      { uid: newUid(), id: 'grass', x: 0.12 },
      { uid: newUid(), id: 'rock', x: 0.72 },
      { uid: newUid(), id: 'grass', x: 0.86 }
    ],
    lastTick: Date.now(),
    lastDaily: '',
    welcomed: false
  };
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const g = JSON.parse(raw);
      if (g && g.version === 1 && Array.isArray(g.fish)) {
        // 디자인이 생기기 전에 들어온 구피는 원래 모습(무지개)으로
        g.fish.forEach(f => { if (f.sp === 'guppy' && !f.variant) f.variant = 'rainbow'; });
        // 자라기 기능 전에 산 바다 친구는 이미 다 큰 모습
        (g.friends || []).forEach(fr => { if (typeof fr.growth !== 'number') fr.growth = 1; });
        // 암수가 생기기 전의 물고기에게 성별을 정해 준다
        g.fish.forEach(f => { if (!f.sex) f.sex = randomSex(); });
        if (!Array.isArray(g.eggs)) g.eggs = [];
        return g;
      }
    }
  } catch (e) { /* 저장소를 못 쓰면 새 게임 */ }
  return createNewGame();
}

export function saveGame(game) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) { /* 저장 실패는 무시 */ }
}

// 앱을 꺼둔 시간만큼 천천히 배고파지고, 물이 더러워지고, 조금씩 자란다 (1분 단위로 계산)
export function catchUpOffline(game, now = Date.now()) {
  const gone = Math.min(RATES.offlineCapSec, Math.max(0, (now - (game.lastTick || now)) / 1000));
  const grown = [];
  for (let t = 0; t < gone; t += 60) {
    const step = Math.min(60, gone - t);
    game.dirt = Math.min(100, game.dirt + RATES.offlineDirtPerSec * step);
    game.fish.forEach(f => {
      f.full = Math.max(0, f.full - RATES.offlineFullDropPerSec * step);
      const before = stageOf(f.growth);
      const sp = FISH_BY_ID[f.sp];
      f.growth = Math.min(1, f.growth + RATES.growPerSec * RATES.offlineGrowMul * (sp ? sp.growMul : 1) * growFactor(f, game.dirt) * step);
      if (stageOf(f.growth) !== before) grown.push(f);
      if (f.preg != null) f.preg = Math.min(0.98, f.preg + step / RATES.pregSec * RATES.offlinePregMul);
    });
    (game.eggs || []).forEach(e => { e.t = Math.max(1, e.t - step); });
    (game.friends || []).forEach(fr => {
      const before = stageOf(fr.growth);
      fr.growth = Math.min(1, fr.growth + RATES.growPerSec * RATES.offlineGrowMul * friendGrowFactor(game.dirt) * step);
      if (stageOf(fr.growth) !== before) grown.push(fr);
    });
  }
  game.lastTick = now;
  return { goneSec: gone, grown };
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
