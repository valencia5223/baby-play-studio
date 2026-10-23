// ═════════════════════════════════════════════════════════════════════════════
// 🌱 텃밭 가꾸기 — 밭 규칙과 저장 (화면은 GardenGame.jsx)
// 빈 밭을 누르고 씨앗을 골라 심고, 물을 주면(누르기) 자라고, 가끔 오는 벌레를 쫓아내며, 다 자라면 눌러 수확해 바구니에 모은다.
// 물기(water 1→0)가 있고 벌레가 없을 때만 자란다. 비가 오면 저절로 물이 준다.
// 바구니(basket) 채소는 내 목장의 🧺 버튼으로 초식동물에게 준다 (FarmGame.jsx 가 takeFromBasket 사용).
// ═════════════════════════════════════════════════════════════════════════════
import { CROP_BY_ID, FARM_SAVE_KEY } from './farmData.js';

export const GARDEN_SAVE_KEY = 'bps_garden_v1';
export const GARDEN_PLOTS = 8; // 4칸 × 2줄
export const GARDEN_YIELD = 6; // 한 밭에서 수확하는 채소 수 (밭에 그려지는 포기 수와 같다)
export const GARDEN_RATES = {
  dryPerSec: 1 / 70,                 // 물 준 뒤 70초면 마른다 (다 자라려면 2~4번)
  offlineDryPerSec: 1 / (3 * 3600),  // 꺼둔 동안은 3시간에 걸쳐 천천히 마른다
  offlineGrowMul: 0.5,
  bugPerSec: 1 / 55,                 // 자라는 칸 하나에 벌레가 올 확률 (밭 전체 기준 약 1분에 한 번)
  bugMax: 2
};

export const newPlot = () => ({ crop: null, growth: 0, water: 0, bug: false });
const createGarden = () => ({ version: 1, plots: Array.from({ length: GARDEN_PLOTS }, newPlot), basket: {}, lastTick: Date.now(), welcomed: false });

const fixPlot = (p) => ({
  crop: p && CROP_BY_ID[p.crop] ? p.crop : null,
  growth: p && CROP_BY_ID[p.crop] ? Math.min(1, Math.max(0, Number(p.growth) || 0)) : 0,
  water: p ? Math.min(1, Math.max(0, Number(p.water) || 0)) : 0,
  bug: !!(p && p.bug && CROP_BY_ID[p.crop])
});

export function loadGarden() {
  try {
    const raw = localStorage.getItem(GARDEN_SAVE_KEY);
    if (raw) {
      const g = JSON.parse(raw);
      if (g && g.version === 1 && Array.isArray(g.plots)) {
        g.plots = Array.from({ length: GARDEN_PLOTS }, (_, i) => fixPlot(g.plots[i]));
        if (!g.basket || typeof g.basket !== 'object') g.basket = {};
        Object.keys(g.basket).forEach(k => { if (!CROP_BY_ID[k] || !(g.basket[k] > 0)) delete g.basket[k]; });
        return g;
      }
    }
  } catch { /* 저장소를 못 쓰면 새 텃밭 */ }
  const g = createGarden();
  // 예전에 목장 안에 있던 텃밭(6칸)에서 키우던 채소는 그대로 옮겨 온다
  try {
    const farm = JSON.parse(localStorage.getItem(FARM_SAVE_KEY) || 'null');
    if (farm && Array.isArray(farm.garden)) farm.garden.slice(0, GARDEN_PLOTS).forEach((p, i) => { g.plots[i] = fixPlot(p); });
  } catch { /* 무시 */ }
  return g;
}

export function saveGarden(g) {
  try { localStorage.setItem(GARDEN_SAVE_KEY, JSON.stringify(g)); } catch { /* 저장 실패는 무시 */ }
}

// 꺼둔 시간: 물기가 남아 있는 동안만 천천히 자란다 (벌레가 있으면 안 자람)
export function catchUpGarden(g, now = Date.now()) {
  const gone = Math.max(0, (now - (g.lastTick || now)) / 1000);
  g.plots.forEach(p => {
    if (!p.crop) return;
    if (!p.bug) {
      const wetSec = Math.min(gone, p.water / GARDEN_RATES.offlineDryPerSec);
      p.growth = Math.min(1, p.growth + wetSec * GARDEN_RATES.offlineGrowMul / CROP_BY_ID[p.crop].growSec);
    }
    p.water = Math.max(0, p.water - gone * GARDEN_RATES.offlineDryPerSec);
  });
  g.lastTick = now;
  return gone;
}

export const basketCount = (g) => Object.values(g.basket || {}).reduce((n, v) => n + v, 0);

// 목장에서 바구니 채소를 꺼낼 때: 최대 max 개를 꺼내 crop id 목록으로 (저장까지)
export function takeFromBasket(max) {
  const g = loadGarden();
  const out = [];
  const ids = Object.keys(g.basket).filter(k => g.basket[k] > 0);
  while (out.length < max && ids.some(k => g.basket[k] > 0)) {
    ids.forEach(k => { if (out.length < max && g.basket[k] > 0) { out.push(k); g.basket[k] -= 1; } });
  }
  Object.keys(g.basket).forEach(k => { if (!(g.basket[k] > 0)) delete g.basket[k]; });
  saveGarden(g);
  return out;
}
