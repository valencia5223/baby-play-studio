// 🚗 우리 동네 장소 목록 (townData.js 와 scripts/update-bus.mjs 가 함께 쓴다, 다른 import 없음)
// 장소: real = 실제 위치(길이 닿는 곳), at = 그림 놓을 자리(복잡한 산본역 주변은 겹치지 않게 조금씩 벌림)
//  kind = 그림 종류, stop = 버스에서 내릴 정류장 이름(포함 검사), walk = 집에서 걸어갈 수 있음
export const SPOT_LIST = [
  { id: 'home', name: '유나집', emoji: '🏠', kind: 'home', real: [126.9244, 37.3447], at: [0.35, 0.86],
    desc: '우리 집이에요! 엄마 아빠랑 유나가 사는 집이에요.' },
  { id: 'grandma', name: '할미 할비 집', emoji: '👵', kind: 'grandma', real: [126.9338, 37.3522], at: [0.64, 0.66],
    desc: '할미 할비 집이에요! 할미랑 할비가 반갑게 꼭 안아 줘요.' },
  { id: 'flying', name: '청년공간 플라잉', emoji: '🎨', kind: 'youth', real: [126.9215, 37.3450], at: [0.28, 0.885], stop: ['청년공간플라잉'],
    desc: '청년공간 플라잉이에요! 형 누나들이 모여서 그림도 그리고 공부도 하는 곳이에요.' },
  { id: 'surisanStn', name: '수리산역', emoji: '🚉', kind: 'station', real: [126.9254, 37.3500], at: [0.47, 0.71], walk: true,
    desc: '수리산역이에요! 수리산 바로 앞에 있는 역이에요. 파란 전철이 서요.' },
  { id: 'sanbonStn', name: '산본역', emoji: '🚉', kind: 'station', real: [126.9331, 37.3582], at: [0.60, 0.53], stop: ['산본역'],
    desc: '산본역에 왔어요! 파란 전철이 칙칙폭폭 지나가요.' },
  { id: 'center', name: '중심상가', emoji: '🛍️', kind: 'shops', real: [126.9350, 37.3592], at: [0.73, 0.49], stop: ['산본역'],
    desc: '가게가 아주 많은 중심상가예요! 맛있는 것도 먹고 구경도 해요.' },
  { id: 'cityhall', name: '군포시청', emoji: '🏛️', kind: 'hall', real: [126.9336, 37.3606], at: [0.66, 0.37], stop: ['군포시청'],
    desc: '군포시청이에요! 우리 동네 일을 하는 커다란 건물이에요.' },
  { id: 'emart', name: '이마트', emoji: '🛒', kind: 'mart', real: [126.9306, 37.3611], at: [0.49, 0.45],
    desc: '이마트에 왔어요! 카트 타고 장 보러 가요.' },
  { id: 'centralPark', name: '중앙공원', emoji: '⛲', kind: 'park', real: [126.9304, 37.3630], at: [0.53, 0.30], stop: ['중앙공원'],
    desc: '넓은 중앙공원이에요! 분수도 보고 신나게 뛰어놀아요.' },
  { id: 'market', name: '산본시장', emoji: '🧺', kind: 'market', real: [126.9374, 37.3700], at: [0.70, 0.19], stop: ['산본시장'],
    desc: '북적북적 산본시장이에요! 떡이랑 과일이랑 생선이 많아요.' },
  { id: 'geumjeongStn', name: '금정역', emoji: '🚉', kind: 'station', real: [126.9432, 37.3720], at: [0.86, 0.13], stop: ['금정역'],
    desc: '금정역이에요! 파란 전철이랑 남색 전철, 두 가지 전철이 서요.' },
  { id: 'azalea', name: '철쭉동산', emoji: '🌸', kind: 'azalea', real: [126.9262, 37.3550], at: [0.37, 0.58],
    desc: '철쭉동산이에요! 봄이 되면 분홍 꽃이 가득 피어요.' },
  { id: 'chomakgol', name: '초막골생태공원', emoji: '🦆', kind: 'pond', real: [126.9180, 37.3452], at: [0.22, 0.78],
    desc: '초막골생태공원이에요! 연못에서 오리랑 개구리를 찾아봐요.' },
  { id: 'surisan', name: '수리산', emoji: '⛰️', kind: 'mountain', real: [126.9135, 37.3585], at: [0.13, 0.42], link: 'surisanStn',
    desc: '높은 수리산에 왔어요! 다람쥐랑 새들이 살아요. 야호!' }
];
