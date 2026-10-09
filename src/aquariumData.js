// ═════════════════════════════════════════════════════════════════════════════
// 🐠 내 어항 키우기 – 데이터 & 규칙
// 물고기 종류, 장식, 바다 친구 가격, 성장/컨디션 계산, 저장 형식을 모아 둔다.
// (React 없음: voiceLines.js 의 음성 문장 목록에서도 그대로 불러 쓴다)
// ═════════════════════════════════════════════════════════════════════════════

// 물고기 종류
//  len: 다 큰 물고기 길이(px, 화면 크기에 따라 조금 더 커짐) / hRatio: 몸 높이 비율
//  shape: normal(보통) · angel(세로로 긴 마름모) · disc(동그란 원반) · betta(긴 지느러미) · tang(타원) · cory(바닥 메기)
//  eyeK: 눈(흰자) 지름 / 눈 자리 머리 높이 (기본 0.45, 몸이 가는 물고기 눈이 너무 커지지 않게)
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
    // 코리도라스(페퍼드): 등이 솟고 배가 납작한 갑옷 메기. 무리 지어 바닥 모래를 수염으로 훑고(forager), 가끔 수면에서 숨을 쉰다
    id: 'cory', desc: '바닥을 콕콕 청소해요', name: '코리도라스', price: 165, len: 40, hRatio: 0.34, shape: 'cory', eyeK: 0.4,
    speed: 0.55, growMul: 1, school: true, zone: 'bottom', forager: true, bottomFeeder: true,
    top: '#857f66', belly: '#efe4d4', spots: '#3b3628',
    bands: [{ color: 'rgba(110,160,140,0.35)', y: -0.08, from: 0.22, to: 0.92, w: 0.34 }],
    tail: { color: 'rgba(214,206,190,0.6)', len: 0.28, spread: 0.36, fork: true, spots: 'rgba(59,54,40,0.55)' }, fin: 'rgba(214,206,190,0.55)'
  },
  {
    // 비파(플레코): 바닥·유리벽에 빨판으로 붙어 오래 가만히 있고 유리 이끼를 먹어 치운다. 밤에 더 부지런하다(nocturnal: 밤에 자지 않음)
    id: 'pleco', name: '비파', price: 250, desc: '유리 이끼를 먹어요', len: 58, hRatio: 0.3, shape: 'pleco', eyeK: 0.3,
    speed: 0.45, growMul: 0.9, school: false, zone: 'bottom', algaeEater: true, nocturnal: true, bottomFeeder: true,
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
    id: 'mackerel', name: '고등어', price: 125, len: 64, hRatio: 0.24, shape: 'normal', eyeK: 0.4, desc: '떼 지어 쌩쌩!',
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
    id: 'hairtail', name: '갈치', price: 225, len: 112, hRatio: 0.09, shape: 'ribbon', eyeK: 0.5, desc: '은빛 리본처럼 길쭉',
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
  },
  // ── 바다 친구 ── 물고기와 똑같이 밥 먹고·아프고·이름 짓고·자란다 (sea: 상점에서 바다 친구로 묶어 보여줌)
  //  shape 가 바다 친구 이름이면 drawFish 가 drawCreature 로 따로 그린다
  //  crawl: 바닥을 기어 다님(가라앉은 밥만 먹음) / swim: 기다가도 배고프면 헤엄쳐 올라가 밥을 먹음(게) / upright: 몸을 기울이지 않음
  {
    id: 'clownfish', name: '흰동가리', price: 125, len: 44, hRatio: 0.48, shape: 'normal', desc: '주황 줄무늬 니모', sea: true,
    speed: 0.85, growMul: 1, school: false, zone: 'mid',
    top: '#ea580c', belly: '#fb923c', bars: '#ffffff',
    tail: { color: 'rgba(234,88,12,0.85)', len: 0.3, spread: 0.4 }, fin: 'rgba(249,115,22,0.8)'
  },
  {
    id: 'crab', name: '게', price: 125, len: 50, hRatio: 0.62, shape: 'crab', desc: '옆으로 엉금엉금', sea: true, crawl: true, swim: true,
    speed: 0.45, growMul: 1, school: false, zone: 'bottom',
    top: '#dc2626', belly: '#f87171', fin: '#b91c1c', tail: {}
  },
  {
    // 소라게: 소라 껍데기를 지고 바닥을 기어 다니며 자주 멈춘다. 놀라면 껍데기 속으로 쏙(hermit),
    // 자라서 단계가 바뀌면 더 큰 빈 껍데기를 찾아가 이사한다
    id: 'hermit', name: '소라게', price: 140, len: 58, hRatio: 0.8, shape: 'hermit', desc: '껍데기 집을 지고 다녀요', sea: true, crawl: true, hermit: true,
    speed: 0.35, growMul: 1, school: false, zone: 'bottom',
    top: '#ea580c', belly: '#fdba74', fin: '#c2410c', accent: '#f4a259', spots: '#7c2d12', tail: {},
    growLines: { juvenile: '소라게가 쑥쑥 자라서 더 큰 집을 찾아요!', adult: '소라게가 다 커서 제일 큰 집을 찾아요!' }
  },
  {
    // 가재: 바닥을 기어 다니다 놀라면 꼬리를 배 밑으로 말아 뒤로 휙 튕겨 도망(tailFlip). 누르면 집게를 번쩍
    id: 'crayfish', name: '가재', price: 175, len: 56, hRatio: 0.36, shape: 'crayfish', desc: '놀라면 뒤로 휙!', sea: true, crawl: true, swim: true, tailFlip: true,
    speed: 0.4, growMul: 1, school: false, zone: 'bottom',
    top: '#b91c1c', belly: '#f87171', fin: '#991b1b', accent: '#fecaca', tail: {}
  },
  {
    id: 'starfish', name: '불가사리', price: 125, len: 46, hRatio: 1, shape: 'starfish', desc: '바닥을 느릿느릿', sea: true, crawl: true, upright: true,
    speed: 0.2, growMul: 1, school: false, zone: 'bottom',
    top: '#f59e0b', belly: '#fcd34d', spots: '#fef3c7', tail: {}
  },
  {
    id: 'shrimp', name: '새우', price: 125, len: 44, hRatio: 0.5, shape: 'shrimp', desc: '톡톡 튀는 새우', sea: true,
    speed: 0.7, growMul: 1.1, school: false, zone: 'bottom',
    top: '#f97316', belly: '#fdba74', fin: 'rgba(251,146,60,0.75)', tail: {}
  },
  {
    // 개구리: 알에서 올챙이로 태어나 뒷다리 → 앞다리가 나오고 꼬리가 줄어 개구리가 된다 (frog).
    // 다 크면 뒷다리로 쭉쭉 밀며 헤엄치고, 가끔 수면에 둥둥 떠서 쉰다
    id: 'frog', name: '개구리', babyName: '올챙이', price: 150, len: 46, hRatio: 0.6, shape: 'frog', desc: '자라면 개구리로 변신!', sea: true, frog: true,
    speed: 0.6, growMul: 1.1, school: false, zone: 'mid',
    top: '#4d7c0f', belly: '#ecfccb', fin: '#3f6212', spots: '#365314', accent: '#a3e635', tail: {},
    stageNames: { fry: '올챙이', juvenile: '다리가 난 올챙이', adult: '개구리' },
    infoLines: { fry: '올챙이예요! 쑥쑥 자라면 개구리가 돼요!', juvenile: '다리가 난 올챙이예요! 곧 개구리가 돼요!', adult: '개구리예요! 개굴개굴!' },
    growLines: { juvenile: '와아! 올챙이 뒷다리가 쏙 나왔어요!', adult: '와아! 올챙이가 개구리가 됐어요! 개굴개굴!' }
  },
  {
    id: 'seahorse', name: '해마', price: 165, len: 46, hRatio: 1.5, shape: 'seahorse', desc: '꼬리를 말고 둥실둥실', sea: true, upright: true,
    speed: 0.3, growMul: 0.95, school: false, zone: 'mid',
    top: '#eab308', belly: '#fde047', fin: 'rgba(253,224,71,0.7)', tail: {}
  },
  {
    id: 'jellyfish', name: '해파리', price: 165, len: 52, hRatio: 1.3, shape: 'jellyfish', desc: '뿅뿅 떠오르고 빛나요', sea: true, upright: true, glow: true,
    speed: 0.3, growMul: 1, school: false, zone: 'top',
    top: 'rgba(192,132,252,0.75)', belly: 'rgba(244,114,182,0.6)', fin: 'rgba(216,180,254,0.75)', tail: {}
  },
  {
    id: 'octopus', name: '문어', price: 250, len: 64, hRatio: 0.9, shape: 'octopus', desc: '다리가 여덟 개', sea: true,
    speed: 0.5, growMul: 0.9, school: false, zone: 'bottom',
    top: '#e11d48', belly: '#fb7185', spots: '#fecdd3', tail: {}
  },
  {
    id: 'squid', name: '오징어', price: 250, len: 70, hRatio: 0.32, shape: 'squid', desc: '쓩 하고 헤엄쳐요', sea: true,
    speed: 0.9, growMul: 0.9, school: false, zone: 'mid',
    top: '#f9a8d4', belly: '#fdf2f8', spots: '#be185d', fin: 'rgba(249,168,212,0.85)', tail: {}
  },
  {
    id: 'turtle', name: '거북이', price: 290, len: 74, hRatio: 0.55, shape: 'turtle', desc: '느긋하게 헤엄쳐요', sea: true,
    speed: 0.5, growMul: 0.8, school: false, zone: 'mid',
    top: '#15803d', belly: '#86efac', fin: '#65a30d', accent: '#a3e635', tail: {}
  },
  {
    id: 'penguin', name: '펭귄', price: 290, len: 62, hRatio: 0.45, shape: 'penguin', desc: '물속을 쌩쌩', sea: true,
    speed: 1.2, growMul: 0.85, school: false, zone: 'top',
    top: '#1e293b', belly: '#f8fafc', fin: '#0f172a', accent: '#f59e0b', tail: {}
  },
  {
    id: 'seal', name: '물개', price: 335, len: 86, hRatio: 0.36, shape: 'seal', desc: '장난꾸러기 물개', sea: true,
    speed: 1, growMul: 0.8, school: false, zone: 'mid',
    top: '#78716c', belly: '#d6d3d1', fin: '#57534e', spots: '#57534e', tail: {}
  },
  {
    // 돌고래: 빠르게 헤엄치다 가끔 깊이 내려갔다가 수면 위로 점프해 물보라를 튀긴다(jumper). 누르면 끽끽
    id: 'dolphin', name: '돌고래', price: 420, len: 110, hRatio: 0.3, shape: 'dolphin', desc: '수면 위로 점프!', sea: true, jumper: true,
    speed: 1.3, growMul: 0.75, school: false, zone: 'mid',
    top: '#64748b', belly: '#e2e8f0', fin: '#475569', tail: {}
  },
  {
    // 수달: 물속을 쌩쌩 헤엄치다가, 수면에 배를 하늘로 하고 둥둥 떠서 가슴 위 조개를 톡톡 깨 먹는다(otter)
    id: 'otter', name: '수달', price: 380, len: 88, hRatio: 0.3, shape: 'otter', desc: '누워서 조개를 톡톡', sea: true, otter: true,
    speed: 1.1, growMul: 0.8, school: false, zone: 'mid',
    top: '#7c4a2d', belly: '#e7cfa8', fin: '#5b3520', tail: {}
  },
  // 상어 가족 (모두 shape 'shark', 동요 속 색: 아기 노랑·엄마 분홍·아빠 파랑·할머니 주황·할아버지 초록).
  // sex 는 정해진 성별, mate 는 짝이 되는 종류, babySp 는 태어나는 아기 종류, noBreed 는 아기를 낳지 않음.
  // 엄마상어 + 아빠상어 → 아기상어. 아기상어는 다 커도 아기상어 (예전 저장의 'shark' 가 아기상어)
  {
    id: 'shark', name: '아기상어', price: 460, len: 96, hRatio: 0.4, shape: 'shark', desc: '노랗고 귀여운 아기상어', sea: true, noBreed: true,
    speed: 0.9, growMul: 0.75, school: false, zone: 'mid',
    top: '#facc15', belly: '#fef9c3', fin: '#f59e0b', tail: {}
  },
  {
    id: 'sharkMom', name: '엄마상어', price: 520, len: 116, hRatio: 0.4, shape: 'shark', desc: '분홍색 엄마상어 (아빠상어와 아기상어를 낳아요)', sea: true,
    sex: 'f', mate: 'sharkDad', babySp: 'shark',
    speed: 0.85, growMul: 0.7, school: false, zone: 'mid',
    top: '#f472b6', belly: '#fce7f3', fin: '#db2777', tail: {}
  },
  {
    id: 'sharkDad', name: '아빠상어', price: 540, len: 124, hRatio: 0.4, shape: 'shark', desc: '파란색 힘센 아빠상어', sea: true, sex: 'm', noBreed: true,
    speed: 0.85, growMul: 0.7, school: false, zone: 'mid',
    top: '#3b82f6', belly: '#dbeafe', fin: '#1d4ed8', tail: {}
  },
  {
    id: 'sharkGrandma', name: '할머니상어', price: 580, len: 112, hRatio: 0.4, shape: 'shark', desc: '주황색 다정한 할머니상어', sea: true, sex: 'f', noBreed: true,
    speed: 0.65, growMul: 0.7, school: false, zone: 'mid',
    top: '#fb923c', belly: '#ffedd5', fin: '#ea580c', tail: {}
  },
  {
    id: 'sharkGrandpa', name: '할아버지상어', price: 600, len: 118, hRatio: 0.4, shape: 'shark', desc: '초록색 멋쟁이 할아버지상어', sea: true, sex: 'm', noBreed: true,
    speed: 0.65, growMul: 0.7, school: false, zone: 'mid',
    top: '#4ade80', belly: '#dcfce7', fin: '#16a34a', tail: {}
  },
  {
    id: 'whale', name: '고래', price: 500, len: 136, hRatio: 0.42, shape: 'whale', desc: '바다에서 제일 커요', sea: true,
    speed: 0.5, growMul: 0.7, school: false, zone: 'mid',
    top: '#1d4ed8', belly: '#bfdbfe', fin: '#1e40af', tail: {}
  }
];
export const FISH_BY_ID = Object.fromEntries(FISH_SPECIES.map(f => [f.id, f]));
// 개체를 부를 때 쓰는 종류 정보: 올챙이처럼 어릴 때 이름이 따로 있으면(babyName) 다 크기 전까지는 그 이름으로 부른다
const BABY_VIEW = Object.fromEntries(FISH_SPECIES.filter(f => f.babyName).map(f => [f.id, { ...f, name: f.babyName }]));
export const speciesOf = (f) => (BABY_VIEW[f.sp] && f.growth < 0.8 ? BABY_VIEW[f.sp] : FISH_BY_ID[f.sp]);

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

// 기본 물고기(처음 받는 치어 종류)를 상점에서 더 살 때 가격
export const STARTER_FISH_PRICE = 50;

// 사서 넣는 물고기·바다 친구는 제한 없음. 저절로 태어나는 아기만 breed 마리까지 (끝없이 불어나 느려지지 않게)
export const LIMITS = { breed: 40, decor: 10 };

// ── 번식 ──
// 구피·플래티는 새끼를 낳는 난태생, 나머지는 알을 낳는다.
// 난태생 암컷은 정자를 몸에 저장해 두어서, 한 번 짝짓기한 뒤에는 수컷이 없어도 가끔 다시 아기를 가진다.
const BREED = {
  guppy: { type: 'live', storesSperm: true, brood: [3, 5] },
  platy: { type: 'live', storesSperm: true, brood: [3, 5] },
  // 바다 친구: 고래·물개·상어는 새끼를 적게 낳고, 펭귄·거북이는 알을 조금 낳는다
  whale: { type: 'live', storesSperm: false, brood: [1, 1] },
  seal: { type: 'live', storesSperm: false, brood: [1, 1] },
  dolphin: { type: 'live', storesSperm: false, brood: [1, 1] },
  otter: { type: 'live', storesSperm: false, brood: [1, 2] },
  sharkMom: { type: 'live', storesSperm: false, brood: [1, 2] },
  penguin: { type: 'egg', storesSperm: false, brood: [1, 2] },
  turtle: { type: 'egg', storesSperm: false, brood: [2, 4] }
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
  offlineSickMul: 0.15,     // 꺼둔 동안(화면이 잠기거나 다른 탭)에도 놀 때의 15% 확률로 가끔 아프다
  pregPerSec: 1 / 900,      // 짝이 있고 컨디션 좋은 다 큰 암컷이 아기를 가질 확률 (평균 15분)
  pregSoloMul: 0.35,        // 저장한 정자로 수컷 없이 가질 때는 훨씬 드물게
  pregCond: 70,             // 이 컨디션 이상일 때만
  pregSec: 480,             // 배가 불러서 낳기까지 놀이 시간 8분
  offlinePregMul: 0.3,      // 꺼둔 동안은 천천히 (낳는 건 보고 있을 때 하도록 98% 에서 멈춤)
  pregRestSec: 1200,        // 낳은 뒤 20분은 쉰다
  eggHatchSec: 90           // 알에서 깨어나기까지 1분 30초
};
// ── 낮과 밤 (실제 시계) ── 저녁 8시 ~ 아침 7시는 밤: 한동안(SLEEP_IDLE_SEC) 아무도 만지지 않으면 물고기들이 잔다
export const NIGHT_HOURS = { from: 20, to: 7 };
export const SLEEP_IDLE_SEC = 30;   // 밤에 이만큼(초) 아무 동작이 없으면 잠든다
export const isNightTime = (d = new Date()) => { const h = d.getHours(); return h >= NIGHT_HOURS.from || h < NIGHT_HOURS.to; };

export const isSad = (fish, dirt) => fish.full < 25 || dirt > 70 || !!fish.sick;
// 컨디션 점수 0~100 (배부름 40% + 물 깨끗함 40% + 기분 20%)
export const conditionOf = (fish, dirt) => Math.round(fish.full * 0.4 + (100 - dirt) * 0.4 + fish.happy * 0.2);
// 컨디션에 따른 성장 배율 (슬프면 멈춤)
export const growFactor = (fish, dirt) => (isSad(fish, dirt) ? 0 : Math.max(0.15, Math.min(1, (conditionOf(fish, dirt) - 30) / 55)));

// ── 포인트(조개) 보상 ──
// 자연으로 보낼 때 받는 선물 조개: 종류 값 × (40% + 자란 만큼 최대 160%), 이로치는 두 배.
// 갓 산 친구는 산 값의 40%, 반쯤 자라면 1.2배, 다 크면 2배 (오래 돌본 수고만큼 남는다)
export const releaseReward = (f) => {
  const sp = FISH_BY_ID[f.sp];
  const price = (sp && sp.price) || STARTER_FISH_PRICE;
  return Math.max(2, Math.round(price * (0.4 + 1.6 * Math.min(1, f.growth || 0)) * (f.shiny ? 2 : 1)));
};
export const REWARDS = { eat: 1, poop: 2, algae: 1, waterChange: 10, juvenile: 20, adult: 50, pearl: 5, daily: 20, pet: 1, heal: 5, birth: 10 };

// ── 저장 ──
export const SAVE_KEY = 'bps_aquarium_v1';
let uidSeq = 0;
export const newUid = () => `${Date.now().toString(36)}${(uidSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const newFish = (sp) => ({
  uid: newUid(), sp, growth: 0, full: 80, happy: 80, bornAt: Date.now(),
  variant: sp === 'guppy' ? GUPPY_VARIANTS[Math.floor(Math.random() * GUPPY_VARIANTS.length)].id : undefined,
  shiny: rollShiny(),
  sex: (FISH_BY_ID[sp] && FISH_BY_ID[sp].sex) || randomSex()
});

// 짝짓기 조건: 다 큰 암컷 + 컨디션 좋음 + 쉬는 중 아님 + 아기들이 들어갈 자리.
// 같은 종류의 다 큰 수컷이 어항에 있어야 한다 (난태생은 예전에 짝짓기했으면 수컷 없이도 가끔)
export function mateStatus(game, f, now = Date.now()) {
  const sp = FISH_BY_ID[f.sp];
  if (!sp || sp.noBreed || f.sex !== 'f' || f.preg != null || f.sick || stageOf(f.growth) !== 'adult') return null;
  if ((f.restUntil || 0) > now) return null;
  if (conditionOf(f, game.dirt) < RATES.pregCond || isSad(f, game.dirt)) return null;
  const pending = game.fish.reduce((a, o) => a + (o.preg != null ? breedOf(o.sp).brood[1] : 0), 0) + (game.eggs || []).reduce((a, e) => a + e.n, 0);
  if (game.fish.length + pending + 2 > LIMITS.breed) return null;
  const male = game.fish.some(o => o.sp === (sp.mate || f.sp) && o.sex === 'm' && stageOf(o.growth) === 'adult' && !o.sick);
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
        // 예전 '바다 친구'는 이제 물고기와 똑같이 돌보는 개체로 옮긴다 (니모 물고기 → 흰동가리)
        (g.friends || []).forEach(fr => {
          const sp = fr.id === 'fish' ? 'clownfish' : fr.id;
          if (!FISH_BY_ID[sp]) return;
          g.fish.push({
            uid: fr.uid || newUid(), sp, growth: typeof fr.growth === 'number' ? fr.growth : 1, full: 80, happy: 80,
            bornAt: fr.bornAt || Date.now(), shiny: !!fr.shiny, sex: randomSex()
          });
        });
        g.friends = [];
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
  const grown = [], sick = [];
  for (let t = 0; t < gone; t += 60) {
    const step = Math.min(60, gone - t);
    game.dirt = Math.min(100, game.dirt + RATES.offlineDirtPerSec * step);
    game.fish.forEach(f => {
      f.full = Math.max(0, f.full - RATES.offlineFullDropPerSec * step);
      const before = stageOf(f.growth);
      const sp = FISH_BY_ID[f.sp];
      f.growth = Math.min(1, f.growth + RATES.growPerSec * RATES.offlineGrowMul * (sp ? sp.growMul : 1) * growFactor(f, game.dirt) * step);
      if (stageOf(f.growth) !== before) grown.push(f);
      if (f.preg != null) f.preg = Math.max(f.preg, Math.min(0.98, f.preg + step / RATES.pregSec * RATES.offlinePregMul));
    });
    (game.eggs || []).forEach(e => { e.t = Math.max(1, e.t - step); });
    game.fish.forEach(f => {
      if (f.sick || game.fish.filter(o => o.sick).length >= RATES.sickMax) return;
      if (Math.random() < RATES.sickPerSec * RATES.offlineSickMul * (f.full < 25 || game.dirt > 70 ? 3 : 1) * step) { f.sick = true; sick.push(f); }
    });
  }
  game.lastTick = now;
  return { goneSec: gone, grown, sick };
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
