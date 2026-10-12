// ═════════════════════════════════════════════════════════════════════════════
// 🐮 내 목장 — 동물 종류, 돌봄·성장 규칙, 저장
// 내 어항(aquariumData.js)과 같은 구조지만 서로 코드를 공유하지 않는다 (저장도 따로).
// 화면·움직임은 FarmGame.jsx.
// ═════════════════════════════════════════════════════════════════════════════

// shape: 'quad'(네 발 동물) | 'bird'(닭). 그림 파라미터는 FarmGame.jsx 의 drawAnimal 이 읽는다.
// sound: 생생 동물 카드(REAL_ANIMALS)의 id — 누르면 그 울음소리를 낸다.
// gift: 다 큰 동물이 컨디션이 좋을 때 가끔 떨어뜨리는 선물 (누르면 별을 받는다)
export const FARM_SPECIES = [
  {
    id: 'chicken', name: '닭', babyName: '병아리', price: 30, size: 46, shape: 'bird', sound: 'chicken', desc: '삐약삐약 병아리가 닭이 돼요',
    speed: 1.1, growMul: 1.3, body: '#ffffff', belly: '#fef3c7', accent: '#ef4444', babyBody: '#fde047',
    gift: { icon: '🥚', name: '달걀', stars: 6, everySec: 150 }
  },
  {
    id: 'duck', name: '오리', babyName: '아기 오리', price: 40, size: 48, shape: 'bird', duck: true, desc: '꽥꽥! 뒤뚱뒤뚱 걸어요',
    speed: 0.95, growMul: 1.25, body: '#ffffff', belly: '#f8fafc', accent: '#f59e0b', babyBody: '#fde68a',
    gift: { icon: '🪶', name: '깃털', stars: 5, everySec: 160 }
  },
  {
    id: 'rabbit', name: '토끼', price: 60, size: 50, shape: 'quad', sound: 'rabbit', desc: '깡충깡충 뛰어다녀요',
    speed: 1.2, growMul: 1.2, hop: true, body: '#f8fafc', belly: '#ffffff', accent: '#fda4af',
    ear: 'long', tail: 'puff', legLen: 0.2, bodyLen: 0.78, headSize: 0.5,
    gift: { icon: '🥕', name: '당근', stars: 5, everySec: 170 }
  },
  {
    id: 'dog', name: '강아지', price: 90, size: 62, shape: 'quad', sound: 'dog', desc: '꼬리를 살랑살랑 흔들어요',
    speed: 1.3, growMul: 1.1, wag: true, body: '#d6a15c', belly: '#fdf0d5', accent: '#8b5a2b',
    ear: 'flop', tail: 'wag', legLen: 0.34, bodyLen: 0.95, headSize: 0.5, snout: 'dog',
    gift: { icon: '🦴', name: '뼈다귀', stars: 6, everySec: 170 }
  },
  {
    id: 'cat', name: '고양이', price: 90, size: 56, shape: 'quad', sound: 'cat', desc: '햇볕에서 낮잠을 좋아해요',
    speed: 1.05, growMul: 1.1, napper: true, body: '#f59e0b', belly: '#fff7ed', accent: '#b45309',
    ear: 'point', tail: 'long', legLen: 0.3, bodyLen: 0.92, headSize: 0.5, snout: 'cat', stripes: true,
    gift: { icon: '🧶', name: '털실', stars: 6, everySec: 170 }
  },
  {
    id: 'pig', name: '돼지', price: 130, size: 70, shape: 'quad', sound: 'pig', desc: '꿀꿀! 뭐든 잘 먹어요',
    speed: 0.85, growMul: 1, body: '#fbb6c9', belly: '#fde4ec', accent: '#ec7fa0',
    ear: 'fold', tail: 'curl', legLen: 0.24, bodyLen: 1.05, headSize: 0.5, snout: 'pig', fat: 1.18,
    gift: { icon: '🍄', name: '버섯', stars: 8, everySec: 180 }
  },
  {
    id: 'sheep', name: '양', price: 160, size: 72, shape: 'quad', sound: 'sheep', desc: '폭신폭신 털이 자라요',
    speed: 0.8, growMul: 0.95, body: '#fdfcf7', belly: '#ffffff', accent: '#3f3a36',
    ear: 'side', tail: 'puff', legLen: 0.3, bodyLen: 1, headSize: 0.44, wool: true, darkFace: true,
    gift: { icon: '☁️', name: '양털', stars: 10, everySec: 190 }
  },
  {
    id: 'goat', name: '염소', price: 150, size: 66, shape: 'quad', desc: '음메~ 수염이 멋져요',
    speed: 1.0, growMul: 1, body: '#f5f5f4', belly: '#ffffff', accent: '#78716c',
    ear: 'side', tail: 'puff', legLen: 0.36, bodyLen: 0.95, headSize: 0.44, horns: true, beard: true,
    gift: { icon: '🧀', name: '치즈', stars: 9, everySec: 185 }
  },
  {
    id: 'cow', name: '젖소', price: 220, size: 84, shape: 'quad', sound: 'cow', desc: '음머! 고소한 우유를 줘요',
    speed: 0.7, growMul: 0.85, body: '#ffffff', belly: '#fff1f2', accent: '#1f2937',
    ear: 'side', tail: 'tuft', legLen: 0.36, bodyLen: 1.12, headSize: 0.44, snout: 'cow', spots: true, horns: true,
    gift: { icon: '🥛', name: '우유', stars: 14, everySec: 200 }
  },
  {
    id: 'donkey', name: '당나귀', price: 240, size: 82, shape: 'quad', desc: '귀가 쫑긋 길어요',
    speed: 1.0, growMul: 0.85, body: '#9ca3af', belly: '#e5e7eb', accent: '#4b5563',
    ear: 'long', tail: 'tuft', legLen: 0.42, bodyLen: 1.02, headSize: 0.44, snout: 'horse', mane: true,
    gift: { icon: '🍎', name: '사과', stars: 15, everySec: 205 }
  },
  {
    id: 'alpaca', name: '알파카', price: 260, size: 84, shape: 'quad', desc: '복슬복슬 긴 목이 귀여워요',
    speed: 0.9, growMul: 0.85, body: '#f3e3c3', belly: '#fbf3e4', accent: '#a47148',
    ear: 'point', tail: 'puff', legLen: 0.44, bodyLen: 0.92, headSize: 0.4, snout: 'horse', wool: true,
    gift: { icon: '🧣', name: '목도리', stars: 16, everySec: 205 }
  },
  {
    id: 'horse', name: '말', price: 280, size: 90, shape: 'quad', sound: 'horse', desc: '다그닥다그닥 달려요',
    speed: 1.5, growMul: 0.8, runner: true, body: '#a0623a', belly: '#c98a5e', accent: '#3b2314',
    ear: 'point', tail: 'horse', legLen: 0.48, bodyLen: 1.1, headSize: 0.42, snout: 'horse', mane: true,
    gift: { icon: '🥇', name: '메달', stars: 18, everySec: 210 }
  }
];
export const FARM_BY_ID = Object.fromEntries(FARM_SPECIES.map(a => [a.id, a]));

// ── 품종 ── 강아지·고양이는 살 때 여러 품종 중 하나가 무작위로 나온다. 값은 그림 파라미터를 덮어쓴다.
// (첫 품종은 덮어쓰기 없음 = 예전 모습. sizeMul: 몸 크기 배율, eyeRing: 몸이 어두울 때 눈 테두리)
export const FARM_VARIANTS = {
  dog: [
    { id: 'mixed', name: '누렁이' },
    { id: 'jindo', name: '진돗개', body: '#f5efe2', belly: '#ffffff', accent: '#d9c9a6', ear: 'point', tail: 'curl' },
    { id: 'shiba', name: '시바견', body: '#d98a3d', belly: '#fff7ed', accent: '#9a5b22', ear: 'point', tail: 'curl' },
    { id: 'poodle', name: '푸들', body: '#b07a4f', belly: '#c99a72', accent: '#7c4a2b', wool: true },
    { id: 'beagle', name: '비글', body: '#ffffff', belly: '#ffffff', accent: '#8b5a2b', spots: true },
    { id: 'dachshund', name: '닥스훈트', body: '#8b4513', belly: '#c47a45', accent: '#5c2e0e', legLen: 0.18, bodyLen: 1.25, eyeRing: true },
    { id: 'golden', name: '골든 리트리버', body: '#e6b450', belly: '#f8dfa0', accent: '#b9852f', legLen: 0.38, sizeMul: 1.12 },
    { id: 'maltese', name: '말티즈', body: '#ffffff', belly: '#ffffff', accent: '#e2e8f0', wool: true, legLen: 0.26, sizeMul: 0.82 }
  ],
  cat: [
    { id: 'cheese', name: '치즈 고양이' },
    { id: 'mackerel', name: '고등어 고양이', body: '#9ca3af', belly: '#f3f4f6', accent: '#374151' },
    { id: 'tuxedo', name: '턱시도 고양이', body: '#1f2937', belly: '#ffffff', accent: '#111827', stripes: false, eyeRing: true },
    { id: 'calico', name: '삼색 고양이', body: '#ffffff', belly: '#ffffff', accent: '#f59e0b', stripes: false, spots: true },
    { id: 'russian', name: '러시안 블루', body: '#8796ab', belly: '#c3cdda', accent: '#5b6b80', stripes: false, eyeRing: true },
    { id: 'siamese', name: '샴 고양이', body: '#f5ead8', belly: '#fffbf2', accent: '#5b4636', stripes: false, darkFace: true },
    { id: 'white', name: '하얀 고양이', body: '#ffffff', belly: '#ffffff', accent: '#fda4af', stripes: false }
  ]
};
const VARIANT_BY = Object.fromEntries(Object.entries(FARM_VARIANTS).map(([sp, list]) => [sp, Object.fromEntries(list.map(v => [v.id, v]))]));
export const farmVariantOf = (a) => (a.variant && VARIANT_BY[a.sp] ? VARIANT_BY[a.sp][a.variant] : null);
const randomVariant = (sp) => (FARM_VARIANTS[sp] ? FARM_VARIANTS[sp][Math.floor(Math.random() * FARM_VARIANTS[sp].length)].id : undefined);
// 그림용 모습: 종류 파라미터 + 품종 덮어쓰기 (이름·id 는 종류 그대로)
export const farmLookOf = (a) => {
  const sp = FARM_BY_ID[a.sp], v = farmVariantOf(a);
  if (!v) return sp;
  const { id, name, sizeMul, ...over } = v;
  return { ...sp, ...over };
};

// 다 크기 전에는 어릴 때 이름(병아리)으로 부른다
const BABY_VIEW = Object.fromEntries(FARM_SPECIES.filter(a => a.babyName).map(a => [a.id, { ...a, name: a.babyName }]));
export const farmSpeciesOf = (a) => (BABY_VIEW[a.sp] && a.growth < 0.8 ? BABY_VIEW[a.sp] : FARM_BY_ID[a.sp]);
// 단계(baby·young·adult)에서 부르는 종류 (음성 문장 목록용)
export const farmSpeciesAt = (spId, stage) => (BABY_VIEW[spId] && stage !== 'adult' ? BABY_VIEW[spId] : FARM_BY_ID[spId]);

// ── 성장 단계 ──
export const FARM_STAGE_NAMES = { baby: '아기', young: '어린이', adult: '다 큰 어른' };
export const farmStageOf = (growth) => (growth < 0.34 ? 'baby' : growth < 0.8 ? 'young' : 'adult');
export const farmSizeScale = (growth) => 0.5 + 0.5 * (1 - Math.pow(1 - Math.min(1, growth), 1.6));

// ── 돌봄 규칙 ── 배부름(full)·기분(happy)·깨끗함의 반대인 흙먼지(mud)는 동물마다 0~100.
// 바닥 똥(poop)이 많으면 목장 전체가 더러워져 모두의 컨디션이 내려간다.
export const FARM_RATES = {
  growPerSec: 1 / 14400,       // 컨디션 최고일 때 아기 → 어른 약 4시간 (종류별 growMul 곱)
  offlineGrowMul: 0.08,
  fullDropPerSec: 100 / 420,   // 놀 때 배부름 100 → 0 약 7분
  offlineFullDropPerSec: 100 / (8 * 3600),
  mudPerSec: 100 / 1200,       // 놀 때 흙먼지 0 → 100 약 20분
  offlineMudPerSec: 100 / (24 * 3600),
  happyDropPerSec: 100 / 900,
  poopEverySec: [70, 130],     // 밥을 먹은 동물이 똥을 누는 간격
  poopMax: 14,
  offlineCapSec: 24 * 3600,
  sickPerSec: 1 / 3000,
  sickMax: 2,
  offlineSickMul: 0.15,
  pregPerSec: 1 / 900,      // 짝(같은 종류의 다 큰 수컷)이 있고 컨디션 좋은 다 큰 암컷이 아기를 가질 확률 (평균 15분)
  pregCond: 70,             // 이 컨디션 이상일 때만
  pregSec: 480,             // 배가 불러서 낳기까지 놀이 시간 8분
  offlinePregMul: 0.3,      // 꺼둔 동안은 천천히 (낳는 건 보고 있을 때 하도록 98% 에서 멈춤)
  pregRestSec: 1200,        // 낳은 뒤 20분은 쉰다
  eggHatchSec: 90           // 둥지의 알이 깨어나기까지 1분 30초
};
// 저절로 태어나는 아기는 목장 동물이 이 수가 될 때까지만 (산 동물은 제한 없음)
export const FARM_LIMITS = { breed: 30 };

// ── 번식 ── 닭·오리는 둥지에 알을 낳고, 나머지는 새끼를 낳는다
const FARM_BREED = {
  chicken: { type: 'egg', brood: [2, 4] }, duck: { type: 'egg', brood: [2, 4] },
  rabbit: { type: 'live', brood: [3, 5] }, dog: { type: 'live', brood: [2, 4] }, cat: { type: 'live', brood: [2, 4] },
  pig: { type: 'live', brood: [3, 5] }, sheep: { type: 'live', brood: [1, 2] }, goat: { type: 'live', brood: [1, 2] },
  cow: { type: 'live', brood: [1, 1] }, donkey: { type: 'live', brood: [1, 1] }, alpaca: { type: 'live', brood: [1, 1] },
  horse: { type: 'live', brood: [1, 1] }
};
export const farmBreedOf = (spId) => FARM_BREED[spId] || { type: 'live', brood: [1, 2] };
export const FARM_SEX_NAMES = { m: '수컷', f: '암컷' };
const randomSex = () => (Math.random() < 0.5 ? 'm' : 'f');

// 짝짓기 조건: 다 큰 암컷 + 컨디션 좋음 + 쉬는 중 아님 + 아기들이 들어갈 자리 + 같은 종류의 다 큰 수컷
export function farmMateStatus(game, a, now = Date.now()) {
  if (a.sex !== 'f' || a.preg != null || a.sick || farmStageOf(a.growth) !== 'adult') return null;
  if ((a.restUntil || 0) > now) return null;
  const dirt = farmDirt(game);
  if (farmCondition(a, dirt) < FARM_RATES.pregCond || isFarmSad(a, dirt)) return null;
  const pending = game.animals.reduce((n, o) => n + (o.preg != null ? farmBreedOf(o.sp).brood[1] : 0), 0) + (game.eggs || []).reduce((n, e) => n + e.n, 0);
  if (game.animals.length + pending + 1 > FARM_LIMITS.breed) return null;
  const male = game.animals.some(o => o.sp === a.sp && o.sex === 'm' && farmStageOf(o.growth) === 'adult' && !o.sick);
  return male ? 'pair' : null;
}
export const FARM_NIGHT = { from: 20, to: 7 };
export const FARM_SLEEP_IDLE_SEC = 30;
export const isFarmNight = (d = new Date()) => { const h = d.getHours(); return h >= FARM_NIGHT.from || h < FARM_NIGHT.to; };

// 목장 더러움 0~100: 바닥 똥 하나당 12
export const farmDirt = (game) => Math.min(100, (game.poop ? game.poop.length : 0) * 12);
export const isFarmSad = (a, dirt) => a.full < 25 || a.mud > 75 || dirt > 70 || !!a.sick;
// 컨디션 0~100 (배부름 40% + 깨끗함 30% + 기분 20% + 목장 깨끗함 10%)
export const farmCondition = (a, dirt) => Math.round(a.full * 0.4 + (100 - a.mud) * 0.3 + a.happy * 0.2 + (100 - dirt) * 0.1);
export const farmGrowFactor = (a, dirt) => (isFarmSad(a, dirt) ? 0 : Math.max(0.15, Math.min(1, (farmCondition(a, dirt) - 30) / 55)));

// ── 별(⭐) 보상 ── 배고플 때(배부름 70% 미만) 먹으면 eatHungry, 아니면 eat.
// 다 크기 전에도 가끔 작은 선물(별 YOUNG_GIFT_STARS)을 떨어뜨리고, 간격은 YOUNG_GIFT_MUL 배로 길다.
export const YOUNG_GIFT_STARS = [2, 3];
export const YOUNG_GIFT_MUL = 1.3;
export const FARM_REWARDS = { eat: 1, eatHungry: 3, poop: 2, wash: 5, young: 20, adult: 50, daily: 20, pet: 1, heal: 5, birth: 10 };
// 넓은 들판으로 보낼 때: 종류 값 × (40% + 자란 만큼 최대 160%)
export const farmReleaseReward = (a) => {
  const sp = FARM_BY_ID[a.sp];
  return Math.max(2, Math.round(((sp && sp.price) || 30) * (0.4 + 1.6 * Math.min(1, a.growth || 0))));
};

// ── 저장 ──
export const FARM_SAVE_KEY = 'bps_farm_v1';
let uidSeq = 0;
export const newFarmUid = () => `${Date.now().toString(36)}${(uidSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const newAnimal = (sp) => ({
  uid: newFarmUid(), sp, growth: 0, full: 80, happy: 80, mud: 0, bornAt: Date.now(), giftT: 0, sex: randomSex(), variant: randomVariant(sp)
});

export function createNewFarm() {
  return {
    version: 1,
    points: 40,
    poop: [],     // { x, y } 는 밭 안의 0~1 비율 좌표
    eggs: [],     // 둥지 { uid, sp, x, d, n, t, family }
    // 처음 받는 닭 두 마리는 암수 한 쌍
    animals: ['chicken', 'chicken', 'rabbit'].map((sp, i) => ({ ...newAnimal(sp), ...(i < 2 ? { sex: i ? 'f' : 'm' } : {}) })),
    lastTick: Date.now(),
    lastDaily: '',
    welcomed: false
  };
}

export function loadFarm() {
  try {
    const raw = localStorage.getItem(FARM_SAVE_KEY);
    if (raw) {
      const g = JSON.parse(raw);
      if (g && g.version === 1 && Array.isArray(g.animals)) {
        g.animals = g.animals.filter(a => FARM_BY_ID[a.sp]);
        if (!Array.isArray(g.poop)) g.poop = [];
        if (!Array.isArray(g.eggs)) g.eggs = [];
        // 암수가 생기기 전의 동물에게 성별을 정해 준다
        g.animals.forEach(a => { if (!a.sex) a.sex = randomSex(); });
        // 품종이 생기기 전의 강아지·고양이는 예전 모습(첫 품종)
        g.animals.forEach(a => { if (FARM_VARIANTS[a.sp] && !a.variant) a.variant = FARM_VARIANTS[a.sp][0].id; });
        return g;
      }
    }
  } catch (e) { /* 저장소를 못 쓰면 새 목장 */ }
  return createNewFarm();
}

export function saveFarm(game) {
  try { localStorage.setItem(FARM_SAVE_KEY, JSON.stringify(game)); } catch (e) { /* 저장 실패는 무시 */ }
}

// 앱을 꺼둔 시간만큼 천천히 배고파지고, 지저분해지고, 조금씩 자란다 (1분 단위)
export function catchUpFarm(game, now = Date.now()) {
  const gone = Math.min(FARM_RATES.offlineCapSec, Math.max(0, (now - (game.lastTick || now)) / 1000));
  const grown = [], sick = [];
  for (let t = 0; t < gone; t += 60) {
    const step = Math.min(60, gone - t);
    const dirt = farmDirt(game);
    game.animals.forEach(a => {
      a.full = Math.max(0, a.full - FARM_RATES.offlineFullDropPerSec * step);
      a.mud = Math.min(100, a.mud + FARM_RATES.offlineMudPerSec * step);
      const before = farmStageOf(a.growth);
      a.growth = Math.min(1, a.growth + FARM_RATES.growPerSec * FARM_RATES.offlineGrowMul * FARM_BY_ID[a.sp].growMul * farmGrowFactor(a, dirt) * step);
      if (farmStageOf(a.growth) !== before) grown.push(a);
      if (a.preg != null) a.preg = Math.max(a.preg, Math.min(0.98, a.preg + step / FARM_RATES.pregSec * FARM_RATES.offlinePregMul));
      if (a.sick || game.animals.filter(o => o.sick).length >= FARM_RATES.sickMax) return;
      if (Math.random() < FARM_RATES.sickPerSec * FARM_RATES.offlineSickMul * (a.full < 25 || a.mud > 75 ? 3 : 1) * step) { a.sick = true; sick.push(a); }
    });
  }
  (game.eggs || []).forEach(e => { e.t = Math.max(1, e.t - gone); });
  game.lastTick = now;
  return { goneSec: gone, grown, sick };
}

export const farmTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
