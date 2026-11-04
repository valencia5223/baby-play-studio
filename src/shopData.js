// 🛒 동물 마을 가게: 파는 물건·손님 주문·저장 (ShopGame.jsx 가 쓰고, 안내 문장은 voiceLines.js 의 VOICE.shop*)
// 손님은 요리 놀이의 동물 손님(KITCHEN_GUESTS)이 그대로 온다.

export const SHOP_GOODS = [
  { id: 'apple', name: '사과', emoji: '🍎' },
  { id: 'banana', name: '바나나', emoji: '🍌' },
  { id: 'strawberry', name: '딸기', emoji: '🍓' },
  { id: 'orange', name: '귤', emoji: '🍊' },
  { id: 'carrot', name: '당근', emoji: '🥕' },
  { id: 'tomato', name: '토마토', emoji: '🍅' },
  { id: 'corn', name: '옥수수', emoji: '🌽' },
  { id: 'egg', name: '달걀', emoji: '🥚' },
  { id: 'milk', name: '우유', emoji: '🥛' },
  { id: 'potato', name: '감자', emoji: '🥔' },
  { id: 'onion', name: '양파', emoji: '🧅' },
  { id: 'kiwi', name: '키위', emoji: '🥝' },
  { id: 'cheese', name: '치즈', emoji: '🧀' },
  { id: 'fish', name: '생선', emoji: '🐟' },
  { id: 'honey', name: '꿀', emoji: '🍯' },
  { id: 'lettuce', name: '상추', emoji: '🥬' },
  { id: 'cherry', name: '체리', emoji: '🍒' },
  { id: 'blueberry', name: '블루베리', emoji: '🫐' }
];
// 카운터 진열장 물건: 손님이 계산대에서 "○○ 주세요!" 하고 점원(아이)에게 달라고 하는 것
export const COUNTER_GOODS = [
  { id: 'mandu', name: '만두', emoji: '🥟' },
  { id: 'sweetpotato', name: '군고구마', emoji: '🍠' },
  { id: 'chicken', name: '치킨', emoji: '🍗' },
  { id: 'hotdog', name: '핫도그', emoji: '🌭' },
  { id: 'candy', name: '사탕', emoji: '🍬' },
  { id: 'icecream', name: '아이스크림', emoji: '🍦' }
];
export const ASK_MAX_N = 2;   // 카운터에서 한 가지를 달라고 할 때 최대 개수
export const GOOD_BY_ID = Object.fromEntries([...SHOP_GOODS, ...COUNTER_GOODS].map(g => [g.id, g]));

// 손님이 자주 사는 물건 (반쯤은 이걸 산다)
const SHOP_FAV = { rabbit: 'carrot', monkey: 'banana', pig: 'apple', chick: 'corn', fox: 'egg', cat: 'fish', penguin: 'fish', mouse: 'cheese', elephant: 'orange', bear: 'honey', hippo: 'kiwi', koala: 'lettuce', panda: 'blueberry', lion: 'potato', dog: 'milk', squirrel: 'cherry' };

// 💵 돈은 원(지폐). 시장(도매)에서 싸게 사 와서 가게에서 비싸게 판다 → 남는 돈(이익)
// 품목별 [시장에서 사는 값, 가게에서 파는 값] (천 원 단위 = 지폐로만 계산)
const PRICE_TABLE = {
  apple: [1000, 2000], banana: [2000, 4000], strawberry: [5000, 8000], orange: [3000, 5000], kiwi: [1000, 2000], cherry: [6000, 10000],
  carrot: [1000, 2000], tomato: [2000, 3000], corn: [1000, 2000], potato: [2000, 4000], onion: [1000, 2000], lettuce: [2000, 3000],
  milk: [2000, 3000], egg: [4000, 7000], cheese: [3000, 5000], fish: [5000, 9000], blueberry: [4000, 7000], honey: [7000, 12000],
  mandu: [3000, 5000], sweetpotato: [2000, 3000], chicken: [9000, 15000], hotdog: [1000, 2000], candy: [1000, 2000], icecream: [2000, 3000]
};
export const PRICE = Object.fromEntries(Object.entries(PRICE_TABLE).map(([id, [buy, sell]]) => [id, { buy, sell }]));
export const TOTAL_MAX = 3 * 15000;   // 손님 한 명이 낼 수 있는 가장 큰 돈 (음성 '모두 ○원이에요' 만들 범위)
export const STOCK_MAX = 6;       // 매대 칸 하나에 놓을 수 있는 개수
export const STOCK_START = 3;     // 처음 재고
export const MONEY_START = 10000; // 처음 가진 돈
export const MONEY_GOAL = 10000;  // 만 원 모일 때마다 축하
export const BILLS = [50000, 10000, 5000, 1000];
// 손님이 내는 지폐 (큰 돈부터)
export function billsFor(total) { const out = []; let r = total; BILLS.forEach(v => { while (r >= v) { out.push(v); r -= v; } }); return out; }
export const fmtWon = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
// 읽는 말: 7000 → '칠천 원', 12000 → '만 이천 원'
const DIG = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
function sino4(x) {
  let s = '';
  [[1000, '천'], [100, '백'], [10, '십'], [1, '']].forEach(([u, w]) => { const d = Math.floor(x / u) % 10; if (d) s += (d === 1 && u > 1 ? '' : DIG[d]) + w; });
  return s;
}
export function wonText(n) {
  const man = Math.floor(n / 10000), rest = n % 10000;
  const parts = [];
  if (man) parts.push((man === 1 ? '' : sino4(man)) + '만');
  if (rest) parts.push(sino4(rest));
  return `${parts.join(' ') || '영'} 원`;
}

export const MULTI_RATE = 0.2;   // 카운터에서 두 가지를 달라는 비율 (한 가지 8 : 두 가지 2)

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// 편의점 진열대 3개 (왼쪽부터, 칸 6개씩 = 2열 × 3층). 가게를 열 때마다 진열대 안에서 자리만 섞는다
export const SHOP_UNITS = [
  { id: 'fruit', label: '🍎 과일', color: '#ef4444', kind: 'shelf', items: ['apple', 'banana', 'strawberry', 'orange', 'kiwi', 'cherry'] },
  { id: 'veg', label: '🥕 채소', color: '#16a34a', kind: 'shelf', items: ['carrot', 'tomato', 'corn', 'potato', 'onion', 'lettuce'] },
  { id: 'cold', label: '🥛 냉장', color: '#2563eb', kind: 'fridge', items: ['milk', 'egg', 'cheese', 'fish', 'blueberry', 'honey'] }
];
// 시장 진열 묶음 (매대 3개 + 카운터 간식)
export const MARKET_GROUPS = [...SHOP_UNITS.map(u => ({ id: u.id, label: u.label, color: u.color, items: u.items })),
  { id: 'snack', label: '🍗 간식', color: '#ea580c', items: COUNTER_GOODS.map(g => g.id) }];
export function arrangeStore() { return SHOP_UNITS.flatMap(u => shuffle(u.items)); }
export function arrangeCounter() { return shuffle(COUNTER_GOODS.map(g => g.id)); }

export const ASK_RATE = 0.6;   // 계산대에서 카운터 물건을 달라고 하는 손님 비율
export const BASKET_MAX = 3;   // 손님 바구니에 담기는 물건 수 최대

// 카운터 주문: 한 가지 1~2개, 또는 (MULTI_RATE) 두 가지 한 개씩 → { lines: [{ item, n }], item, n }
export function makeCounterOrder() {
  const ids = shuffle(COUNTER_GOODS.map(g => g.id));
  const lines = Math.random() < MULTI_RATE ? [{ item: ids[0], n: 1 }, { item: ids[1], n: 1 }] : [{ item: ids[0], n: 1 + Math.floor(Math.random() * ASK_MAX_N) }];
  return { lines, item: lines[0].item, n: lines.reduce((x, l) => x + l.n, 0) };
}
// 손님 한 명의 장보기: 매대에서 스스로 고르는 물건(self, 1개 이상) + 가끔 계산대에서 부탁(ask)
//  → { steps: [{ kind: 'self', item }], ask: 주문|null, payBy }
export function makeVisit(guestId) {
  const ask = Math.random() < ASK_RATE ? makeCounterOrder() : null;
  const room = BASKET_MAX - (ask ? ask.n : 0);
  const fav = SHOP_FAV[guestId];
  let pool = shuffle(SHOP_GOODS.map(g => g.id));
  if (fav && Math.random() < 0.5) pool = [fav, ...pool.filter(id => id !== fav)];
  const selfN = 1 + Math.floor(Math.random() * room);
  return { steps: pool.slice(0, selfN).map(item => ({ kind: 'self', item })), ask, payBy: Math.random() < 0.5 ? 'card' : 'cash' };
}

const KEY = 'bps_shop_v1';
const freshInv = () => Object.fromEntries(Object.keys(PRICE).map(id => [id, STOCK_START]));
// 저장: { version: 2, money(원), inv: { 물건: 개수 }, earned(판 돈), spent(산 돈) }. v1(동전 수)은 동전 1개 = 천 원으로
export function loadShop() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* 망가진 저장은 새로 */ }
  const base = { version: 2, money: MONEY_START, inv: freshInv(), earned: 0, spent: 0 };
  if (!s || typeof s !== 'object') return base;
  if (s.version === 2) {
    const inv = freshInv();
    Object.keys(inv).forEach(id => { const n = s.inv && s.inv[id]; if (typeof n === 'number') inv[id] = Math.max(0, Math.min(STOCK_MAX, n)); });
    return { ...base, money: Math.max(0, +s.money || 0), inv, earned: +s.earned || 0, spent: +s.spent || 0 };
  }
  if (typeof s.coins === 'number') base.money = MONEY_START + s.coins * 1000;
  return base;
}
export function saveShop(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 공간이 없으면 그냥 넘어감 */ } }
