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
    id: 'cow', name: '젖소', price: 220, size: 84, shape: 'quad', sound: 'cow', desc: '음머! 고소한 우유를 줘요',
    speed: 0.7, growMul: 0.85, body: '#ffffff', belly: '#fff1f2', accent: '#1f2937',
    ear: 'side', tail: 'tuft', legLen: 0.36, bodyLen: 1.12, headSize: 0.44, snout: 'cow', spots: true, horns: true,
    gift: { icon: '🥛', name: '우유', stars: 14, everySec: 200 }
  },
  {
    id: 'horse', name: '말', price: 280, size: 90, shape: 'quad', sound: 'horse', desc: '다그닥다그닥 달려요',
    speed: 1.5, growMul: 0.8, runner: true, body: '#a0623a', belly: '#c98a5e', accent: '#3b2314',
    ear: 'point', tail: 'horse', legLen: 0.48, bodyLen: 1.1, headSize: 0.42, snout: 'horse', mane: true,
    gift: { icon: '🥇', name: '메달', stars: 18, everySec: 210 }
  }
];
export const FARM_BY_ID = Object.fromEntries(FARM_SPECIES.map(a => [a.id, a]));

// 다 크기 전에는 어릴 때 이름(병아리)으로 부른다
const BABY_VIEW = Object.fromEntries(FARM_SPECIES.filter(a => a.babyName).map(a => [a.id, { ...a, name: a.babyName }]));
export const farmSpeciesOf = (a) => (BABY_VIEW[a.sp] && a.growth < 0.8 ? BABY_VIEW[a.sp] : FARM_BY_ID[a.sp]);

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
  offlineSickMul: 0.15
};
export const FARM_NIGHT = { from: 20, to: 7 };
export const FARM_SLEEP_IDLE_SEC = 30;
export const isFarmNight = (d = new Date()) => { const h = d.getHours(); return h >= FARM_NIGHT.from || h < FARM_NIGHT.to; };

// 목장 더러움 0~100: 바닥 똥 하나당 12
export const farmDirt = (game) => Math.min(100, (game.poop ? game.poop.length : 0) * 12);
export const isFarmSad = (a, dirt) => a.full < 25 || a.mud > 75 || dirt > 70 || !!a.sick;
// 컨디션 0~100 (배부름 40% + 깨끗함 30% + 기분 20% + 목장 깨끗함 10%)
export const farmCondition = (a, dirt) => Math.round(a.full * 0.4 + (100 - a.mud) * 0.3 + a.happy * 0.2 + (100 - dirt) * 0.1);
export const farmGrowFactor = (a, dirt) => (isFarmSad(a, dirt) ? 0 : Math.max(0.15, Math.min(1, (farmCondition(a, dirt) - 30) / 55)));

// ── 별(⭐) 보상 ──
export const FARM_REWARDS = { eat: 1, poop: 2, wash: 5, young: 20, adult: 50, daily: 20, pet: 1, heal: 5 };
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
  uid: newFarmUid(), sp, growth: 0, full: 80, happy: 80, mud: 0, bornAt: Date.now(), giftT: 0
});

export function createNewFarm() {
  return {
    version: 1,
    points: 40,
    poop: [],     // { x, y } 는 밭 안의 0~1 비율 좌표
    animals: ['chicken', 'chicken', 'rabbit'].map(newAnimal),
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
      if (a.sick || game.animals.filter(o => o.sick).length >= FARM_RATES.sickMax) return;
      if (Math.random() < FARM_RATES.sickPerSec * FARM_RATES.offlineSickMul * (a.full < 25 || a.mud > 75 ? 3 : 1) * step) { a.sick = true; sick.push(a); }
    });
  }
  game.lastTick = now;
  return { goneSec: gone, grown, sick };
}

export const farmTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
