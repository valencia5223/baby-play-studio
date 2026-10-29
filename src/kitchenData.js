// 🍳 요리 놀이 "동물 친구 식당": 손님·메뉴·재료 (KitchenGame.jsx 가 쓰고, 안내 문장은 voiceLines.js 의 VOICE.kitchen*)
// 실패는 없다: 아무 재료나 넣어도 손님은 맛있게 먹는다. 손님마다 제일 좋아하는 재료(fav)가 있어 넣어 주면 더 기뻐한다.

export const KITCHEN_GUESTS = [
  { id: 'rabbit', name: '토끼', fav: 'carrot' },
  { id: 'bear', name: '곰', fav: 'honey' },
  { id: 'panda', name: '판다', fav: 'bamboo' },
  { id: 'lion', name: '사자', fav: 'meat' },
  { id: 'cat', name: '고양이', fav: 'fish' },
  { id: 'dog', name: '강아지', fav: 'pepperoni' },
  { id: 'monkey', name: '원숭이', fav: 'banana' },
  { id: 'mouse', name: '생쥐', fav: 'cheese' },
  { id: 'squirrel', name: '다람쥐', fav: 'acorn' },
  { id: 'pig', name: '돼지', fav: 'apple' },
  { id: 'chick', name: '병아리', fav: 'corn' }
];
export const GUEST_BY_ID = Object.fromEntries(KITCHEN_GUESTS.map(g => [g.id, g]));

export const INGREDIENTS = {
  cheese: { name: '치즈' }, ham: { name: '햄' }, lettuce: { name: '상추' }, tomato: { name: '토마토' }, egg: { name: '달걀' },
  pepperoni: { name: '소시지' }, pepper: { name: '피망' }, mushroom: { name: '버섯' }, corn: { name: '옥수수' }, olive: { name: '올리브' },
  strawberry: { name: '딸기' }, banana: { name: '바나나' }, kiwi: { name: '키위' }, orange: { name: '귤' },
  // 손님이 좋아하는 재료 (모든 메뉴에 하나씩 더 나온다)
  carrot: { name: '당근' }, honey: { name: '꿀' }, bamboo: { name: '대나무 잎' }, meat: { name: '고기' }, fish: { name: '생선' },
  acorn: { name: '도토리' }, apple: { name: '사과' }
};

export const KITCHEN_MENUS = [
  { id: 'sandwich', name: '샌드위치', items: ['cheese', 'ham', 'lettuce', 'tomato', 'egg'] },
  { id: 'pizza', name: '피자', items: ['cheese', 'pepperoni', 'pepper', 'mushroom', 'corn', 'olive'] },
  { id: 'skewer', name: '과일 꼬치', items: ['strawberry', 'banana', 'kiwi', 'orange'] }
];
export const MENU_BY_ID = Object.fromEntries(KITCHEN_MENUS.map(m => [m.id, m]));

export const SANDWICH_MAX = 10;   // 샌드위치에 쌓는 재료 최대 수
export const SKEWER_SLOTS = 6;    // 꼬치 한 개에 끼우는 조각 수
export const PIZZA_MAX = 60;      // 피자 위 토핑 최대 수
