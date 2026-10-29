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
  acorn: { name: '도토리' }, apple: { name: '사과' },
  // 팬케이크·케이크·김밥·아이스크림
  butter: { name: '버터' }, blueberry: { name: '블루베리' }, choco: { name: '초콜릿' }, sprinkles: { name: '스프링클' }, cherry: { name: '체리' },
  danmuji: { name: '단무지' }, spinach: { name: '시금치' },
  vanilla: { name: '바닐라' }, icStrawberry: { name: '딸기 맛' }, icChoco: { name: '초코 맛' }, icMelon: { name: '멜론 맛' }
};

export const KITCHEN_MENUS = [
  { id: 'sandwich', name: '샌드위치', items: ['cheese', 'ham', 'lettuce', 'tomato', 'egg'] },
  { id: 'pizza', name: '피자', items: ['cheese', 'pepperoni', 'pepper', 'mushroom', 'corn', 'olive'] },
  { id: 'skewer', name: '과일 꼬치', items: ['strawberry', 'banana', 'kiwi', 'orange'] },
  // 팬 3장 굽기(붓기 → 보글보글 → 톡 뒤집기) → 쌓아서 꿀·과일 올리기
  { id: 'pancake', name: '팬케이크', items: ['honey', 'butter', 'strawberry', 'banana', 'blueberry'] },
  // 생크림 쓱쓱 바르기 → 꾸미기 → 초 꽂기 (손님이 먹기 전에 촛불을 후 분다)
  { id: 'cake', name: '케이크', items: ['strawberry', 'blueberry', 'choco', 'sprinkles', 'cherry'] },
  // 밥 쓱쓱 펴기 → 재료 올리기 → 돌돌 말기 → 콕콕 썰기
  { id: 'kimbap', name: '김밥', items: ['danmuji', 'spinach', 'ham', 'egg', 'carrot'] },
  // 맛 고르기(콘 위로 4개까지) + 스프링클·체리
  { id: 'icecream', name: '아이스크림', items: ['vanilla', 'icStrawberry', 'icChoco', 'icMelon', 'sprinkles', 'cherry'] }
];
export const ICE_FLAVORS = ['vanilla', 'icStrawberry', 'icChoco', 'icMelon'];
export const ICE_MAX = 4;         // 아이스크림 최대 몇 단
export const PANCAKE_COUNT = 3;   // 굽는 팬케이크 장 수
export const KIMBAP_MAX = 6;      // 김밥 재료 줄 수
export const KIMBAP_SLICES = 8;   // 썰면 나오는 조각 수 (한 번 누를 때 2개씩)
export const DECO_MAX = 40;       // 팬케이크·케이크 위 장식 최대 수
export const MENU_BY_ID = Object.fromEntries(KITCHEN_MENUS.map(m => [m.id, m]));

export const SANDWICH_MAX = 10;   // 샌드위치에 쌓는 재료 최대 수
export const SKEWER_SLOTS = 6;    // 꼬치 한 개에 끼우는 조각 수
export const PIZZA_MAX = 60;      // 피자 위 토핑 최대 수
