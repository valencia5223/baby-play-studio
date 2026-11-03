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
export const SHELF_N = 9;   // 선반 칸 수 (손님마다 SHOP_GOODS 에서 무작위로 골라 순서도 섞는다)
export const GOOD_BY_ID = Object.fromEntries(SHOP_GOODS.map(g => [g.id, g]));

// 손님이 자주 사는 물건 (반쯤은 이걸 산다)
const SHOP_FAV = { rabbit: 'carrot', monkey: 'banana', pig: 'apple', chick: 'corn', fox: 'egg', cat: 'fish', penguin: 'fish', mouse: 'cheese', elephant: 'orange', bear: 'honey', hippo: 'kiwi', koala: 'lettuce', panda: 'blueberry', lion: 'potato', dog: 'milk', squirrel: 'cherry' };

export const SHOP_MAX_N = 3;    // 한 번에 사는 개수 최대
export const PIGGY_FULL = 10;   // 동전이 이만큼 모일 때마다 저금통 축하

// 처음 두 손님은 한 개, 그다음은 두 개까지, 다섯 손님 뒤로는 세 개까지
export function makeOrder(guestId, served, lastItem) {
  const fav = SHOP_FAV[guestId];
  let item = fav && fav !== lastItem && Math.random() < 0.5 ? fav : null;
  while (!item || item === lastItem) item = SHOP_GOODS[Math.floor(Math.random() * SHOP_GOODS.length)].id;
  const top = served < 2 ? 1 : served < 5 ? 2 : SHOP_MAX_N;
  return { item, n: 1 + Math.floor(Math.random() * top) };
}

// 이번 손님 선반: 주문한 물건을 꼭 넣고 나머지는 무작위, 자리도 섞는다
export function makeStock(item) {
  const rest = SHOP_GOODS.map(g => g.id).filter(id => id !== item);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const stock = rest.slice(0, SHELF_N - 1);
  stock.splice(Math.floor(Math.random() * SHELF_N), 0, item);
  return stock;
}

const KEY = 'bps_shop_v1';
export function loadShop() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.coins === 'number') return s; } catch { /* 망가진 저장은 새로 */ }
  return { version: 1, coins: 0 };
}
export function saveShop(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 공간이 없으면 그냥 넘어감 */ } }
