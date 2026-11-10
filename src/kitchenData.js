// 🍳 요리 놀이 "동물 친구 식당": 손님·메뉴·재료 (KitchenGame.jsx 가 쓰고, 안내 문장은 voiceLines.js 의 VOICE.kitchen*)
// 실패는 없다: 아무 재료나 넣어도 손님은 맛있게 먹는다. 손님마다 제일 좋아하는 재료(fav)가 있어 넣어 주면 더 기뻐한다.

export const KITCHEN_GUESTS = [
  // 생일 파티에서 온 손님 (party: 동물 마을 가게에는 오지 않는다)
  { id: 'shark', name: '아기상어', fav: 'fish', party: true },
  { id: 'yuna', name: '유나', fav: 'banana', party: true },
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
  { id: 'chick', name: '병아리', fav: 'corn' },
  { id: 'fox', name: '여우', fav: 'egg' },
  { id: 'penguin', name: '펭귄', fav: 'fish' },
  { id: 'elephant', name: '코끼리', fav: 'orange' },
  { id: 'koala', name: '코알라', fav: 'lettuce' },
  { id: 'hippo', name: '하마', fav: 'kiwi' }
];
export const GUEST_BY_ID = Object.fromEntries(KITCHEN_GUESTS.map(g => [g.id, g]));

export const INGREDIENTS = {
  cheese: { name: '치즈' }, ham: { name: '햄' }, lettuce: { name: '상추' }, tomato: { name: '토마토' }, egg: { name: '달걀' },
  pepperoni: { name: '소시지' }, pepper: { name: '피망' }, mushroom: { name: '버섯' }, corn: { name: '옥수수' }, olive: { name: '올리브' },
  strawberry: { name: '딸기' }, banana: { name: '바나나' }, kiwi: { name: '키위' }, orange: { name: '귤' },
  // 손님이 좋아하는 재료 (모든 메뉴에 하나씩 더 나온다)
  carrot: { name: '당근' }, honey: { name: '꿀' }, bamboo: { name: '대나무 잎' }, meat: { name: '고기' }, fish: { name: '생선' },
  acorn: { name: '도토리' }, apple: { name: '사과' },
  // 팝콘·케이크·김밥·아이스크림
  butter: { name: '버터' }, blueberry: { name: '블루베리' }, choco: { name: '초콜릿' }, sprinkles: { name: '스프링클' }, cherry: { name: '체리' },
  danmuji: { name: '단무지' }, spinach: { name: '시금치' },
  vanilla: { name: '바닐라' }, icStrawberry: { name: '딸기 맛' }, icChoco: { name: '초코 맛' }, icMelon: { name: '멜론 맛' },
  // 쿠키 모양 틀·라면·도넛 옷
  cutStar: { name: '별' }, cutHeart: { name: '하트' }, cutFlower: { name: '꽃' }, cutBear: { name: '곰돌이' },
  noodle: { name: '라면' }, greenOnion: { name: '파' },
  glChoco: { name: '초코' }, glStrawberry: { name: '딸기' }, glVanilla: { name: '바닐라' },
  // 짜서 그리는 소스·크림
  ketchup: { name: '케첩' }, mustard: { name: '머스터드' }, mayo: { name: '마요네즈' },
  creamWhite: { name: '하얀 크림' }, creamPink: { name: '분홍 크림' }, creamChoco: { name: '초코 크림' },
  // 솜사탕 설탕
  sugarPink: { name: '분홍 설탕' }, sugarBlue: { name: '파란 설탕' }, sugarYellow: { name: '노란 설탕' }, sugarPurple: { name: '보라 설탕' },
  // 떡볶이·스파게티·카레·커피
  tteok: { name: '떡' }, eomuk: { name: '어묵' }, sauceTomato: { name: '토마토 소스' }, sauceCream: { name: '크림 소스' },
  potato: { name: '감자' }, onion: { name: '양파' },
  milk: { name: '우유' }, ice: { name: '얼음' }, whip: { name: '휘핑크림' }, syrup: { name: '캐러멜' },
  // 팥빙수·붕어빵
  redBean: { name: '팥' }, condensed: { name: '연유' }, custard: { name: '슈크림' }
};

export const KITCHEN_MENUS = [
  { id: 'sandwich', name: '샌드위치', items: ['cheese', 'ham', 'lettuce', 'tomato', 'egg'] },
  { id: 'pizza', name: '피자', items: ['cheese', 'pepperoni', 'pepper', 'mushroom', 'corn', 'olive'] },
  { id: 'skewer', name: '과일 꼬치', items: ['strawberry', 'banana', 'kiwi', 'orange'] },
  // 달걀 콕콕 톡톡 깨기 → 지글지글 굽기 → 케첩 그림·재료 올리기 (가끔 노른자 두 개)
  { id: 'friedegg', name: '달걀프라이', items: ['ketchup', 'ham', 'lettuce', 'tomato', 'cheese'] },
  // 생크림 쓱쓱 바르기 → 꾸미기 → 초 꽂기 (손님이 먹기 전에 촛불을 후 분다)
  { id: 'cake', name: '케이크', items: ['strawberry', 'blueberry', 'choco', 'sprinkles', 'cherry'] },
  // 밥 쓱쓱 펴기 → 재료 올리기 → 돌돌 말기 → 콕콕 썰기
  { id: 'kimbap', name: '김밥', items: ['danmuji', 'spinach', 'ham', 'egg', 'carrot'] },
  // 맛 고르기(콘 위로 4개까지) + 스프링클·체리
  { id: 'icecream', name: '아이스크림', items: ['vanilla', 'icStrawberry', 'icChoco', 'icMelon', 'sprinkles', 'cherry'] },
  // 과일 넣기 → 윙 갈기 → 컵에 따르기
  { id: 'juice', name: '주스', items: ['strawberry', 'banana', 'kiwi', 'orange', 'blueberry', 'apple'] },
  // 모양 틀로 찍기(COOKIE_CUTTERS) → 오븐에 굽기 → 꾸미기(items)
  { id: 'cookie', name: '쿠키', items: ['choco', 'sprinkles', 'blueberry', 'strawberry', 'cherry'] },
  // 밥 속에 재료 넣기 → 콕콕 눌러 뭉치기(세모) → 김 두르기
  { id: 'riceball', name: '주먹밥', items: ['fish', 'ham', 'egg', 'corn', 'danmuji'] },
  // 물 붓기 → 보글보글 끓이기 → 면·건더기 넣기
  { id: 'ramen', name: '라면', items: ['noodle', 'egg', 'greenOnion', 'mushroom', 'ham'] },
  // 기름에 튀기기 → 도넛 옷(DONUT_GLAZES) 입히기 + 스프링클
  { id: 'donut', name: '도넛', items: ['glChoco', 'glStrawberry', 'glVanilla', 'sprinkles', 'choco'] },
  // 볶음밥에 재료 → 달걀 이불 덮기 → 케첩으로 그림 그리기(OMU_SAUCES)
  { id: 'omurice', name: '오므라이스', items: ['ham', 'carrot', 'corn', 'pepper', 'mushroom'] },
  // 소시지 콕콕 굴려 굽기 → 빵에 넣고 소스로 그리기
  { id: 'hotdog', name: '핫도그', items: ['ketchup', 'mustard', 'mayo'] },
  // 컵에 반죽 붓기 → 오븐 → 크림으로 그리기 + 장식
  { id: 'cupcake', name: '컵케이크', items: ['creamWhite', 'creamPink', 'creamChoco', 'sprinkles', 'cherry', 'strawberry'] },
  // 색깔 설탕 넣기 → 손가락으로 빙글빙글 돌려 키우기
  { id: 'cotton', name: '솜사탕', items: ['sugarPink', 'sugarBlue', 'sugarYellow', 'sugarPurple'] },
  // 밀대로 반죽 밀기 → 소 넣기 → 반으로 접기 → 콕콕 주름 → 찌기
  { id: 'mandu', name: '만두', items: ['meat', 'carrot', 'greenOnion', 'mushroom', 'egg'] },
  // 빨간 양념 붓기 → 재료 넣기 → 휘휘 젓기
  { id: 'tteokbokki', name: '떡볶이', items: ['tteok', 'eomuk', 'egg', 'greenOnion', 'cheese'] },
  // 고기 굽고 뒤집기 → 재료 쌓기 → 빵 덮기
  { id: 'burger', name: '햄버거', items: ['cheese', 'lettuce', 'tomato', 'egg', 'ham'] },
  // 면 삶기 → 소스·재료 → 포크로 돌돌 말기
  { id: 'spaghetti', name: '스파게티', items: ['sauceTomato', 'sauceCream', 'meat', 'mushroom', 'cheese', 'pepper'] },
  // 채소 썰기(CURRY_VEG) → 냄비에 재료 → 휘휘 젓기 → 밥 옆에
  { id: 'curry', name: '카레라이스', items: ['meat', 'mushroom', 'egg'] },
  // 컵 놓기 → 원두 갈기 → 버튼 눌러 추출 → 우유·얼음·휘핑크림
  { id: 'coffee', name: '커피', items: ['milk', 'ice', 'whip', 'syrup', 'choco'] },
  // 옥수수 넣기 → 냄비 흔들흔들(펑펑) → 통에 담아 맛 입히기
  { id: 'popcorn', name: '팝콘', items: ['corn', 'butter', 'syrup', 'choco', 'sprinkles'] },
  // 빙수기 손잡이 빙글빙글 → 눈꽃 얼음 → 팥·연유·과일
  { id: 'bingsu', name: '팥빙수', items: ['redBean', 'condensed', 'tteok', 'strawberry', 'kiwi'] },
  // 틀에 반죽 붓기 → 속 넣기 → 뚜껑 덮고 굽기 → 톡 뒤집기
  { id: 'bungeo', name: '붕어빵', items: ['redBean', 'custard', 'choco', 'cheese'] }
];
export const ICE_FLAVORS = ['vanilla', 'icStrawberry', 'icChoco', 'icMelon'];
export const ICE_MAX = 4;         // 아이스크림 최대 몇 단
export const KIMBAP_MAX = 6;      // 김밥 재료 줄 수
export const KIMBAP_SLICES = 8;   // 썰면 나오는 조각 수 (한 번 누를 때 2개씩)
export const DECO_MAX = 40;
export const JUICE_MAX = 9;       // 믹서에 넣는 과일 수
export const COOKIE_CUTTERS = ['cutStar', 'cutHeart', 'cutFlower', 'cutBear'];
export const COOKIE_MAX = 6;      // 쿠키 판에 찍는 쿠키 수
export const RB_MAX = 5;          // 주먹밥 속 재료 수
export const RB_PRESS = 4;        // 몇 번 눌러야 세모로 뭉쳐지나
export const DONUT_GLAZES = ['glChoco', 'glStrawberry', 'glVanilla'];
export const OMU_SAUCES = ['ketchup', 'mayo'];
export const COTTON_MAX = 4;      // 솜사탕 설탕 색 수
export const MANDU_MAX = 5;       // 만두 소 수
export const MANDU_PLEATS = 5;    // 주름 수
export const HOTDOG_ROLLS = 3;    // 소시지를 몇 번 굴려야 다 굽나
export const BURGER_MAX = 8;      // 햄버거에 쌓는 재료 수       // 팬케이크·케이크 위 장식 최대 수
export const MENU_BY_ID = Object.fromEntries(KITCHEN_MENUS.map(m => [m.id, m]));

export const SANDWICH_MAX = 10;   // 샌드위치에 쌓는 재료 최대 수
export const SKEWER_SLOTS = 6;    // 꼬치 한 개에 끼우는 조각 수
export const PIZZA_MAX = 60;      // 피자 위 토핑 최대 수
