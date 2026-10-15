// ═════════════════════════════════════════════════════════════════════════════
// 🚂 기차 마을 — 역·승객·상점 데이터, 저장
// 화면·움직임은 TrainGame.jsx. 승객 동물 그림은 내 목장(FarmGame.jsx 의 drawAnimal)을 빌려 쓴다.
// ═════════════════════════════════════════════════════════════════════════════

// 역: side = 철길의 어느 변(top·bottom·left), frac = 그 변을 기차가 지나가는 방향으로 몇 % 지점
// (철길은 시계 방향: 위 변은 왼→오, 오른 변은 위→아래, 아래 변은 오→왼, 왼 변은 아래→위)
export const TRAIN_STATIONS = [
  { id: 'village', name: '동물 마을역', icon: '🏡', color: '#f97316', side: 'top', frac: 0.16 },
  { id: 'park', name: '놀이공원역', icon: '🎡', color: '#d946ef', side: 'top', frac: 0.5 },
  { id: 'forest', name: '숲속역', icon: '🌳', color: '#16a34a', side: 'top', frac: 0.84 },
  { id: 'beach', name: '바닷가역', icon: '🏖️', color: '#0ea5e9', side: 'bottom', frac: 0.2 },
  { id: 'snow', name: '눈꽃역', icon: '❄️', color: '#60a5fa', side: 'bottom', frac: 0.8, unlockAt: 15 }
];
export const STATION_BY_ID = Object.fromEntries(TRAIN_STATIONS.map(s => [s.id, s]));

// 승객: 내 목장 동물 종류 id (FARM_SPECIES)
export const PASSENGERS = ['chicken', 'rabbit', 'dog', 'cat', 'pig', 'sheep', 'cow', 'duck', 'fox', 'panda', 'lion', 'bear', 'elephant', 'giraffe'];

// 짐 상자 색 (화물칸 색과 같아야 실린다)
export const CARGO_COLORS = {
  red: { name: '빨간', fill: '#ef4444', dark: '#991b1b' },
  yellow: { name: '노란', fill: '#facc15', dark: '#a16207' },
  blue: { name: '파란', fill: '#3b82f6', dark: '#1e40af' }
};

// ── 상점 ──
export const ENGINES = [
  { id: 'steam', name: '증기기관차', price: 0, desc: '연기를 뿜는 칙칙폭폭 기차' },
  { id: 'tram', name: '꼬마 전철', price: 120, desc: '지붕에 전깃줄 손이 있어요' },
  { id: 'bullet', name: '고속열차', price: 220, desc: '쌩쌩 빠른 뾰족 기차' }
];
export const ENGINE_COLORS = [
  { id: 'red', name: '빨강', fill: '#ef4444', price: 0 },
  { id: 'blue', name: '파랑', fill: '#3b82f6', price: 30 },
  { id: 'green', name: '초록', fill: '#22c55e', price: 30 },
  { id: 'yellow', name: '노랑', fill: '#facc15', price: 30 },
  { id: 'pink', name: '분홍', fill: '#f472b6', price: 40 },
  { id: 'purple', name: '보라', fill: '#a855f7', price: 40 }
];
export const MAX_PASS_CARS = 4;
export const passCarPrice = (owned) => 40 + owned * 40;   // 객차를 더 붙일수록 조금씩 비싸진다
export const CARGO_CAR_PRICE = 50;
export const SEATS_PER_CAR = 3;
export const BOXES_PER_CARGO = 2;

// 마을 꾸미기: 한 번씩만 살 수 있고, 정해진 자리(x, y 는 철길 안쪽 마당의 0~1 비율)에 놓인다
export const TOWN_DECOR = [
  { id: 'flowers', name: '꽃밭', icon: '🌷', price: 20, x: 0.12, y: 0.78 },
  { id: 'tree', name: '큰 나무', icon: '🌳', price: 25, x: 0.88, y: 0.72 },
  { id: 'house', name: '빨간 지붕 집', icon: '🏠', price: 40, x: 0.24, y: 0.36 },
  { id: 'pond', name: '오리 연못', icon: '🦆', price: 60, x: 0.5, y: 0.7 },
  { id: 'windmill', name: '풍차', icon: '🌬️', price: 80, x: 0.75, y: 0.32 },
  { id: 'balloon', name: '열기구', icon: '🎈', price: 100, x: 0.5, y: 0.22 },
  { id: 'lighthouse', name: '등대', icon: '🗼', price: 120, x: 0.92, y: 0.3 },
  { id: 'ferris', name: '대관람차', icon: '🎡', price: 150, x: 0.08, y: 0.32 },
  { id: 'rainbow', name: '무지개', icon: '🌈', price: 200, x: 0.5, y: 0.45 }
];

// 별 보상
export const TRAIN_REWARDS = { board: 1, alight: 3, load: 1, unload: 2, daily: 20 };

// ── 저장 ──
export const TRAIN_SAVE_KEY = 'bps_train_v1';
export function createNewTrain() {
  return { version: 1, points: 20, deliveries: 0, engine: 'steam', color: 'red', ownedEngines: ['steam'], ownedColors: ['red'], passCars: 1, cargo: [], decor: [], lastDaily: '', welcomed: false };
}
export function loadTrain() {
  try {
    const raw = localStorage.getItem(TRAIN_SAVE_KEY);
    if (raw) {
      const g = JSON.parse(raw);
      if (g && g.version === 1) return { ...createNewTrain(), ...g };
    }
  } catch (e) { /* 저장소를 못 쓰면 새로 */ }
  return createNewTrain();
}
export function saveTrain(game) {
  try { localStorage.setItem(TRAIN_SAVE_KEY, JSON.stringify(game)); } catch (e) { /* 저장 실패는 무시 */ }
}
export const trainTodayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// 지금 열려 있는 역
export const openStations = (game) => TRAIN_STATIONS.filter(st => !st.unlockAt || game.deliveries >= st.unlockAt);
