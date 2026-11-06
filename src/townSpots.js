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
    desc: '높은 수리산에 왔어요! 다람쥐랑 새들이 살아요. 야호!' },
  // ── 군포 당동·당정동 (산본 지도 오른쪽 아래, 1호선 옆) ──
  { id: 'gunpoStn', name: '군포역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9483, 37.3535], at: [0.885, 0.585], stop: ['군포역'],
    desc: '군포역이에요! 남색 1호선 전철이 서요. 기차도 쌩쌩 지나가요.' },
  { id: 'dangdongPost', name: '당동 우체국', emoji: '📮', kind: 'post', real: [126.9451, 37.3507], at: [0.78, 0.66], stop: ['당동우체국'],
    desc: '당동 우체국이에요! 할미 할비한테 편지를 보내 볼까요?' },
  { id: 'gunpoSchool', name: '군포초등학교', emoji: '🏫', kind: 'school', real: [126.9433, 37.3478], at: [0.8, 0.8], stop: ['군포초등학교'],
    desc: '군포초등학교예요! 형 누나들이 공부하고 운동장에서 뛰어놀아요.' },
  { id: 'hansei', name: '한세대학교', emoji: '🎓', kind: 'univ', real: [126.9517, 37.3475], at: [0.965, 0.79], stop: ['한세대학교'],
    desc: '한세대학교예요! 언니 오빠들이 공부하는 커다란 대학교예요.' },
  { id: 'itValley', name: '군포 IT밸리', emoji: '🏢', kind: 'tower', real: [126.9518, 37.3495], at: [0.965, 0.665], stop: ['군포IT밸리'],
    desc: '군포 IT밸리예요! 반짝반짝 높은 건물에서 컴퓨터로 일하는 곳이에요.' },
  { id: 'dangjeongStn', name: '당정역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9487, 37.3441], at: [0.89, 0.9], stop: ['당정역'],
    desc: '당정역이에요! 남색 1호선 전철이 서요.' }
];
// 금정역은 4호선·1호선 둘 다 선다 (역 그림의 노선 동그라미)
SPOT_LIST.find(s => s.id === 'geumjeongStn').lines = ['4', '1'];

// 🚇 옆 동네 안양 (범계·평촌·안양역). 지도 범위는 townData.js 의 ANYANG_BOX, 버스는 townBus_anyang.json (npm run bus anyang)
export const ANYANG_SPOT_LIST = [
  { id: 'bumgyeStn', name: '범계역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9515, 37.3897], at: [0.72, 0.66], stop: ['범계역'],
    desc: '범계역이에요! 파란 4호선 전철이 서요. 군포에서 전철로 금방 와요.' },
  { id: 'pyeongchonStn', name: '평촌역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9640, 37.3946], at: [0.93, 0.58], stop: ['평촌역'],
    desc: '평촌역이에요! 파란 4호선 전철이 서요.' },
  { id: 'anyangStn', name: '안양역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9228, 37.4010], at: [0.12, 0.41], stop: ['안양역'],
    desc: '안양역이에요! 남색 1호선 전철이 서요. 기차도 지나가요.' },
  { id: 'anyang1st', name: '안양1번가', emoji: '🛍️', kind: 'shops', real: [126.9218, 37.3990], at: [0.11, 0.58], stop: ['안양1번가'],
    desc: '안양1번가예요! 옷 가게랑 맛있는 가게가 줄줄이 있어요.' },
  { id: 'bumgyeDept', name: '롯데백화점', emoji: '🏬', kind: 'dept', sign: '롯데', real: [126.9500, 37.3904], at: [0.6, 0.79], stop: ['롯데백화점'],
    desc: '범계 백화점이에요! 엘리베이터 타고 장난감 가게에 가 봐요.' },
  { id: 'anyangHall', name: '안양시청', emoji: '🏛️', kind: 'hall', real: [126.9580, 37.3940], at: [0.82, 0.48], stop: ['안양시청'],
    desc: '안양시청이에요! 안양을 돌보는 커다란 건물이에요.' },
  { id: 'pyeongchonPark', name: '평촌 중앙공원', emoji: '⛲', kind: 'park', real: [126.9600, 37.3898], at: [0.87, 0.77], stop: ['중앙공원'],
    desc: '평촌 중앙공원이에요! 넓은 잔디밭에서 뛰어놀고 분수도 봐요.' },
  { id: 'bisanEmart', name: '비산 이마트', emoji: '🛒', kind: 'mart', real: [126.9360, 37.3985], at: [0.4, 0.46], stop: ['이마트'],
    desc: '안양 이마트예요! 카트 타고 장 보러 가요.' },
  { id: 'stadium', name: '안양종합운동장', emoji: '⚽', kind: 'stadium', real: [126.9505, 37.4027], at: [0.68, 0.35], stop: ['종합운동장'],
    desc: '안양종합운동장이에요! 축구 선수들이 공을 뻥뻥 차요. 와아, 골인!' },
  { id: 'anyangStream', name: '안양천', emoji: '🚲', kind: 'river', real: [126.9296, 37.3962], at: [0.28, 0.67],
    desc: '안양천이에요! 졸졸 흐르는 냇물을 따라 자전거도 타고 산책도 해요.' }
];

// 🏞️ 옆 동네 의왕 (군포 동쪽). 북쪽 계원예대·동쪽 아울렛부터 남쪽 의왕역·왕송호수까지
export const UIWANG_SPOT_LIST = [
  { id: 'lotteOutlet', name: '롯데아울렛', emoji: '🛍️', kind: 'outlet', real: [127.0085, 37.3757], at: [0.9, 0.23], stop: ['롯데프리미엄아울렛'],
    desc: '롯데아울렛이에요! 예쁜 가게가 마을처럼 모여 있어요. 구경하러 가요!' },
  { id: 'baegunLake', name: '백운호수', emoji: '🦢', kind: 'lake', real: [127.0040, 37.3825], at: [0.83, 0.12], stop: ['백운호수'],
    desc: '백운호수예요! 반짝이는 호수를 따라 산책하고 오리배도 봐요.' },
  { id: 'uiwangLotteMart', name: '의왕 롯데마트', emoji: '🛒', kind: 'mart', real: [126.9728, 37.3798], at: [0.4, 0.19], stop: ['롯데마트'],
    desc: '의왕 롯데마트예요! 카트 타고 장 보러 가요.' },
  { id: 'kaywon', name: '계원예대', emoji: '🎨', kind: 'art', real: [126.9755, 37.3795], at: [0.5, 0.14], stop: ['계원예술대학교'],
    desc: '계원예술대학교예요! 언니 오빠들이 그림도 그리고 멋진 것을 만들어요.' },
  // 이마트 의왕점: 오전동 경수대로 262 (의왕서해그랑블 블루스퀘어), 정류장 '서해그랑블'
  { id: 'uiwangEmart', name: '의왕 이마트', emoji: '🛒', kind: 'mart', real: [126.9740, 37.3497], at: [0.45, 0.45], stop: ['서해그랑블'],
    desc: '의왕 이마트예요! 카트 타고 맛있는 것 사러 가요.' },
  { id: 'uiwangHall', name: '의왕시청', emoji: '🏛️', kind: 'hall', real: [126.9705, 37.3445], at: [0.39, 0.52], stop: ['의왕시청'],
    desc: '의왕시청이에요! 의왕을 돌보는 커다란 건물이에요.' },
  { id: 'gocheonGym', name: '고천 체육관', emoji: '🏀', kind: 'stadium', real: [126.9820, 37.3478], at: [0.56, 0.49], stop: ['고천다목적체육관'],
    desc: '고천 체육관이에요! 공 던지고 달리기하며 신나게 운동해요.' },
  // ── 의왕 남쪽 (의왕역·왕송호수) ──
  { id: 'uiwangStn', name: '의왕역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9503, 37.3209], at: [0.15, 0.74], stop: ['의왕역'],
    desc: '의왕역이에요! 남색 1호선 전철이 서요. 기차도 쌩쌩 지나가요.' },
  { id: 'railBike', name: '의왕레일바이크', emoji: '🚲', kind: 'railbike', real: [126.9451, 37.3129], at: [0.08, 0.83], stop: ['레일바이크'],
    desc: '의왕레일바이크예요! 기찻길 위에서 자전거를 굴리며 호수를 한 바퀴 돌아요!' },
  { id: 'wangsongLake', name: '왕송호수', emoji: '🦆', kind: 'lake', real: [126.9480, 37.3060], at: [0.17, 0.92], stop: ['왕송호수'],
    desc: '왕송호수예요! 넓은 호수에 오리랑 새들이 둥둥 떠 있어요.' }
];

// 🦒 옆 동네 과천 (안양 북동쪽). 4호선 인덕원~경마공원. 서울대공원·과학관 안에는 버스정류장이 없어 위치는 오픈스트리트맵 기준
export const GWACHEON_SPOT_LIST = [
  { id: 'indeogwonStn', name: '인덕원역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9768, 37.4013], at: [0.2, 0.86], stop: ['인덕원역'],
    desc: '인덕원역이에요! 파란 4호선을 타면 과천으로 가요.' },
  { id: 'govStn', name: '정부과천청사역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9900, 37.4262], at: [0.37, 0.48], stop: ['정부과천청사역'],
    desc: '정부과천청사역이에요! 파란 4호선 전철이 서요.' },
  { id: 'gwacheonStn', name: '과천역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9966, 37.4327], at: [0.5, 0.36], stop: ['과천역'],
    desc: '과천역이에요! 파란 4호선 전철이 서요.' },
  { id: 'grandParkStn', name: '대공원역', emoji: '🚉', kind: 'station', lines: ['4'], real: [127.0063, 37.4357], at: [0.68, 0.33],
    desc: '대공원역이에요! 여기서 내리면 동물원이랑 과학관이 바로 앞이에요.' },
  { id: 'racecourseStn', name: '경마공원역', emoji: '🚉', kind: 'station', lines: ['4'], real: [127.0063, 37.4441], at: [0.6, 0.07], stop: ['경마공원역'],
    desc: '경마공원역이에요! 말들이 사는 렛츠런파크가 가까워요.' },
  { id: 'seoulZoo', name: '서울대공원 동물원', emoji: '🦒', kind: 'zoo', real: [127.0130, 37.4325], at: [0.84, 0.4],
    desc: '서울대공원 동물원이에요! 코끼리, 기린, 사자를 만나러 가요!' },
  { id: 'seoulLand', name: '서울랜드', emoji: '🎡', kind: 'themepark', real: [127.0203, 37.4341], at: [0.94, 0.24],
    desc: '서울랜드예요! 빙글빙글 관람차랑 회전목마를 타요!' },
  { id: 'scienceMuseum', name: '과천과학관', emoji: '🚀', kind: 'science', real: [127.0062, 37.4385], at: [0.63, 0.2],
    desc: '국립과천과학관이에요! 로켓이랑 별이랑 공룡을 보러 가요!' },
  { id: 'letsrun', name: '렛츠런파크', emoji: '🐎', kind: 'horse', real: [127.0140, 37.4460], at: [0.82, 0.09], stop: ['렛츠런파크'],
    desc: '렛츠런파크예요! 멋진 말들이 다그닥다그닥 달려요!' },
  { id: 'gwacheonPark', name: '과천 중앙공원', emoji: '⛲', kind: 'park', real: [126.9922, 37.4287], at: [0.5, 0.57], stop: ['과천중앙공원'],
    desc: '과천 중앙공원이에요! 넓은 잔디밭에서 공놀이해요.' }
];

// 🌾 군포 남쪽 대야미·송부 (산본 아래). 4호선 대야미역
export const GUNPO_SOUTH_SPOT_LIST = [
  { id: 'daeyamiStn', name: '대야미역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9172, 37.3275], at: [0.5, 0.27], stop: ['대야미역'],
    desc: '대야미역이에요! 파란 4호선 전철이 서요. 논밭이랑 호수가 가까워요.' },
  { id: 'banwolLake', name: '반월호수', emoji: '🦢', kind: 'lake', real: [126.8924, 37.3215], at: [0.17, 0.44], stop: ['반월호수'],
    desc: '반월호수예요! 호수 둘레길을 걸으며 물고기랑 오리를 찾아봐요.' },
  { id: 'galchi', name: '갈치저수지', emoji: '🐟', kind: 'pond', real: [126.9067, 37.3338], at: [0.33, 0.12],
    desc: '갈치저수지예요! 조용한 저수지에 물고기가 살아요.' },
  { id: 'dundaeSchool', name: '둔대초등학교', emoji: '🏫', kind: 'school', real: [126.9117, 37.3261], at: [0.37, 0.52], stop: ['둔대초등학교'],
    desc: '둔대초등학교예요! 형 누나들이 공부하고 운동장에서 뛰어놀아요.' },
  { id: 'songjeongPark', name: '송정중앙공원', emoji: '⛲', kind: 'park', real: [126.9169, 37.3182], at: [0.56, 0.66],
    desc: '송부동 송정중앙공원이에요! 잔디밭에서 뛰어놀고 그네도 타요.' },
  { id: 'gunpoTech', name: '첨단산업단지', emoji: '🏭', kind: 'tower', real: [126.9392, 37.3266], at: [0.8, 0.32], stop: ['군포첨단산업단지'],
    desc: '군포첨단산업단지예요! 반짝반짝 공장에서 멋진 물건을 만들어요.' }
];

// ⛰️ 안양 북쪽 석수·관악 (1호선 관악역·석수역, 안양예술공원)
export const SEOKSU_SPOT_LIST = [
  { id: 'gwanakStn', name: '관악역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9093, 37.4193], at: [0.42, 0.62], stop: ['관악역'],
    desc: '관악역이에요! 남색 1호선 전철이 서요.' },
  { id: 'seoksuStn', name: '석수역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9028, 37.4340], at: [0.28, 0.27], stop: ['석수역'],
    desc: '석수역이에요! 남색 1호선 전철이 서요. 조금만 더 가면 서울이에요.' },
  { id: 'anyangArtPark', name: '안양예술공원', emoji: '🎨', kind: 'art', real: [126.9146, 37.4167], at: [0.6, 0.72], stop: ['안양예술공원'],
    desc: '안양예술공원이에요! 계곡 물놀이도 하고 신기한 조각 작품도 구경해요.' },
  { id: 'seoksuMarket', name: '석수시장', emoji: '🧺', kind: 'market', real: [126.9075, 37.4128], at: [0.38, 0.84], stop: ['석수시장'],
    desc: '석수시장이에요! 떡이랑 과일이랑 맛있는 게 가득해요.' }
];

// 🚄 광명 (안양 서쪽 소하·일직동). KTX 광명역·광명동굴
export const GWANGMYEONG_SPOT_LIST = [
  { id: 'gwangmyeongStn', name: '광명역', emoji: '🚄', kind: 'ktx', real: [126.8845, 37.4168], at: [0.76, 0.58], stop: ['KTX광명역'],
    desc: '광명역이에요! 아주 빠른 KTX 기차가 쌩 하고 달려요!' },
  { id: 'gwangmyeongCave', name: '광명동굴', emoji: '🦇', kind: 'cave', real: [126.8650, 37.4255], at: [0.33, 0.32], stop: ['광명동굴'],
    desc: '광명동굴이에요! 어둡고 시원한 동굴 안에 반짝이는 불빛이 가득해요.' },
  { id: 'ikea', name: '이케아', emoji: '🛋️', kind: 'ikea', real: [126.8825, 37.4232], at: [0.64, 0.33], stop: ['이케아'],
    desc: '이케아예요! 예쁜 침대랑 의자가 잔뜩 있어요. 미트볼도 먹어요!' },
  { id: 'costco', name: '코스트코', emoji: '🛒', kind: 'mart', real: [126.8865, 37.4209], at: [0.87, 0.4], stop: ['코스트코'],
    desc: '코스트코예요! 커다란 카트를 밀며 장을 봐요.' }
];

// 🏙️ 서울 금천구 (석수역 위). 버스는 서울시 버스 API (scripts/update-bus-seoul.mjs → townBus_geumcheon.json)
export const GEUMCHEON_SPOT_LIST = [
  { id: 'geumcheonStn', name: '금천구청역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.8946, 37.4560], at: [0.3, 0.66], stop: ['금천구청역'],
    desc: '금천구청역이에요! 남색 1호선 전철이 서요. 여기부터 서울이에요!' },
  { id: 'doksanStn', name: '독산역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.8895, 37.4662], at: [0.24, 0.45], stop: ['독산역'],
    desc: '독산역이에요! 남색 1호선 전철이 서요.' },
  { id: 'gasanStn', name: '가산디지털단지역', emoji: '🚉', kind: 'station', lines: ['1', '7'], real: [126.8826, 37.4810], at: [0.13, 0.15], stop: ['가산디지털단지역'],
    desc: '가산디지털단지역이에요! 1호선이랑 7호선 전철이 서요.' },
  { id: 'geumcheonHall', name: '금천구청', emoji: '🏛️', kind: 'hall', real: [126.8990, 37.4585], at: [0.43, 0.57], stop: ['금천구청'],
    desc: '금천구청이에요! 서울 금천구를 돌보는 커다란 건물이에요.' },
  { id: 'ginkgo', name: '시흥동 은행나무', emoji: '🌳', kind: 'ginkgo', real: [126.9085, 37.4508], at: [0.56, 0.8], stop: ['시흥동은행나무'],
    desc: '시흥동 은행나무예요! 아주아주 오래된 할아버지 나무예요. 가을엔 노랗게 물들어요.' },
  { id: 'geumcheonPark', name: '금천체육공원', emoji: '⚽', kind: 'stadium', real: [126.9085, 37.4683], at: [0.56, 0.4], stop: ['금천체육공원'],
    desc: '금천체육공원이에요! 운동장에서 공 차고 달리기해요.' },
  { id: 'hoamsan', name: '호암산', emoji: '⛰️', kind: 'mountain', real: [126.9291, 37.4510], at: [0.88, 0.75],
    desc: '호암산이에요! 관악산 옆 산이에요. 꼭대기에서 야호!' }
];
// 🎓 서울 관악구 (금천 동쪽). 2호선 신림~사당, 4호선 남태령·사당. 버스는 서울시 버스 API
export const GWANAK_SPOT_LIST = [
  { id: 'sillimStn', name: '신림역', emoji: '🚉', kind: 'station', lines: ['2'], real: [126.9296, 37.4846], at: [0.04, 0.08], stop: ['신림역'],
    desc: '신림역이에요! 초록색 2호선 전철이 서요.' },
  { id: 'bongcheonStn', name: '봉천역', emoji: '🚉', kind: 'station', lines: ['2'], real: [126.9416, 37.4825], at: [0.15, 0.13], stop: ['봉천역'],
    desc: '봉천역이에요! 초록색 2호선 전철이 서요.' },
  { id: 'snuStn', name: '서울대입구역', emoji: '🚉', kind: 'station', lines: ['2'], real: [126.9527, 37.4812], at: [0.31, 0.1], stop: ['서울대입구역'],
    desc: '서울대입구역이에요! 초록색 2호선 전철이 서요.' },
  { id: 'nakseongdaeStn', name: '낙성대역', emoji: '🚉', kind: 'station', lines: ['2'], real: [126.9637, 37.4770], at: [0.5, 0.2], stop: ['낙성대역'],
    desc: '낙성대역이에요! 초록색 2호선 전철이 서요.' },
  { id: 'sadangStn', name: '사당역', emoji: '🚉', kind: 'station', lines: ['2', '4'], real: [126.9817, 37.4766], at: [0.79, 0.22], stop: ['사당역'],
    desc: '사당역이에요! 초록색 2호선이랑 하늘색 4호선을 갈아탈 수 있어요.' },
  { id: 'namtaeryeongStn', name: '남태령역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.9880, 37.4656], at: [0.9, 0.47], stop: ['남태령'],
    desc: '남태령역이에요! 하늘색 4호선 전철이 서요. 고개 넘으면 과천이에요.' },
  { id: 'gwanakHall', name: '관악구청', emoji: '🏛️', kind: 'hall', real: [126.9520, 37.4781], at: [0.25, 0.3], stop: ['관악구청'],
    desc: '관악구청이에요! 서울 관악구를 돌보는 건물이에요.' },
  { id: 'nakseongdae', name: '낙성대공원', emoji: '🌳', kind: 'park', real: [126.9590, 37.4717], at: [0.46, 0.4], stop: ['낙성대'],
    desc: '낙성대공원이에요! 옛날 강감찬 장군이 태어난 곳이에요. 별이 떨어졌대요!' },
  { id: 'snu', name: '서울대학교', emoji: '🎓', kind: 'univ', real: [126.9522, 37.4590], at: [0.28, 0.62], stop: ['서울대'],
    desc: '서울대학교예요! 언니 오빠들이 공부하는 아주 넓은 학교예요.' },
  { id: 'gwanaksan', name: '관악산', emoji: '⛰️', kind: 'mountain', real: [126.9646, 37.4448], at: [0.52, 0.9],
    desc: '관악산이에요! 바위가 많은 높은 산이에요. 꼭대기에 연주대가 있어요.' }
];
// 🌊 안산 (군포 왼쪽). 4호선 상록수~안산역, 초지역에서 서해선 갈아타기
export const ANSAN_SPOT_LIST = [
  { id: 'sangroksuStn', name: '상록수역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.8660, 37.3025], at: [0.88, 0.77], stop: ['상록수역'],
    desc: '상록수역이에요! 하늘색 4호선 전철이 서요. 여기부터 안산이에요!' },
  { id: 'handaeStn', name: '한대앞역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.8535, 37.3095], at: [0.78, 0.65], stop: ['한대앞역'],
    desc: '한대앞역이에요! 하늘색 4호선 전철이 서요.' },
  { id: 'ansanCenterStn', name: '중앙역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.8389, 37.3158], at: [0.66, 0.53], stop: ['중앙역'],
    desc: '안산 중앙역이에요! 하늘색 4호선 전철이 서요. 사람이 아주 많아요!' },
  { id: 'chojiStn', name: '초지역', emoji: '🚉', kind: 'station', lines: ['4', '서해'], real: [126.8070, 37.3213], at: [0.39, 0.43], stop: ['초지역'],
    desc: '초지역이에요! 하늘색 4호선이랑 연두색 서해선을 갈아탈 수 있어요.' },
  { id: 'ansanStn', name: '안산역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.7893, 37.3279], at: [0.24, 0.31], stop: ['안산역'],
    desc: '안산역이에요! 하늘색 4호선 전철이 서요.' },
  { id: 'ansanHall', name: '안산시청', emoji: '🏛️', kind: 'hall', real: [126.8317, 37.3212], at: [0.6, 0.43], stop: ['안산시청'],
    desc: '안산시청이에요! 안산을 돌보는 커다란 건물이에요.' },
  { id: 'ansanLake', name: '안산호수공원', emoji: '🦢', kind: 'lake', real: [126.8260, 37.3060], at: [0.55, 0.71],
    desc: '안산호수공원이에요! 넓은 호수에 오리가 둥둥 떠다녀요.' },
  { id: 'hwarang', name: '화랑유원지', emoji: '🌷', kind: 'pond', real: [126.8095, 37.3245], at: [0.41, 0.37], stop: ['화랑유원지'],
    desc: '화랑유원지예요! 큰 연못 둘레를 자전거 타고 빙글빙글 돌아요.' },
  { id: 'erica', name: '한양대 에리카', emoji: '🎓', kind: 'univ', real: [126.8380, 37.2995], at: [0.65, 0.83], stop: ['한양대'],
    desc: '한양대학교 에리카예요! 언니 오빠들이 공부하는 학교예요.' },
  { id: 'wastadium', name: '안산와스타디움', emoji: '⚽', kind: 'stadium', real: [126.8187, 37.3178], at: [0.49, 0.49],
    desc: '안산와스타디움이에요! 축구 선수들이 뻥뻥 공을 차요. 골인!' },
  { id: 'multiculture', name: '다문화음식거리', emoji: '🍜', kind: 'market', real: [126.7920, 37.3310], at: [0.27, 0.25], stop: ['원곡동'],
    desc: '다문화음식거리예요! 여러 나라 친구들의 맛있는 음식이 가득해요.' }
];
// 🦀 시흥 (안산 위, 광명 왼쪽). 4호선 정왕·오이도, 서해선 시흥시청~시흥대야
export const SIHEUNG_SPOT_LIST = [
  { id: 'oidoStn', name: '오이도역', emoji: '🚉', kind: 'station', lines: ['4', '수인'], real: [126.7375, 37.3618], at: [0.06, 0.85], stop: ['오이도역'],
    desc: '오이도역이에요! 하늘색 4호선 끝 역이에요. 조금 가면 바다가 있어요!' },
  { id: 'jeongwangStn', name: '정왕역', emoji: '🚉', kind: 'station', lines: ['4'], real: [126.7420, 37.3515], at: [0.1, 0.94], stop: ['정왕역'],
    desc: '정왕역이에요! 하늘색 4호선 전철이 서요.' },
  { id: 'siheungHallStn', name: '시흥시청역', emoji: '🚉', kind: 'station', lines: ['서해'], real: [126.8062, 37.3820], at: [0.64, 0.66], stop: ['시흥시청역'],
    desc: '시흥시청역이에요! 연두색 서해선 전철이 서요.' },
  { id: 'sincheonStn', name: '신천역', emoji: '🚉', kind: 'station', lines: ['서해'], real: [126.7880, 37.4391], at: [0.48, 0.14], stop: ['신천역'],
    desc: '신천역이에요! 연두색 서해선 전철이 서요.' },
  { id: 'daeyaStn', name: '시흥대야역', emoji: '🚉', kind: 'station', lines: ['서해'], real: [126.7940, 37.4508], at: [0.53, 0.04], stop: ['시흥대야역'],
    desc: '시흥대야역이에요! 연두색 서해선 전철이 서요. 조금 가면 부천이에요.' },
  { id: 'siheungHall', name: '시흥시청', emoji: '🏛️', kind: 'hall', real: [126.8028, 37.3790], at: [0.61, 0.69], stop: ['시흥시청.종합일자리센터'],
    desc: '시흥시청이에요! 시흥을 돌보는 커다란 건물이에요.' },
  { id: 'gaetgol', name: '갯골생태공원', emoji: '🦀', kind: 'park', real: [126.7803, 37.3896], at: [0.42, 0.59], stop: ['갯골생태공원'],
    desc: '갯골생태공원이에요! 갯벌에 게가 옆으로 사사삭 걸어가요. 높은 전망대도 있어요!' },
  { id: 'mulwang', name: '물왕저수지', emoji: '🎣', kind: 'lake', real: [126.8340, 37.3860], at: [0.87, 0.63], stop: ['물왕'],
    desc: '물왕저수지예요! 넓은 물에서 아저씨들이 낚시를 해요.' },
  { id: 'lotus', name: '연꽃테마파크', emoji: '🪷', kind: 'pond', real: [126.8082, 37.4005], at: [0.65, 0.5], stop: ['연꽃테마파크'],
    desc: '연꽃테마파크예요! 여름이면 커다란 연꽃이 활짝 피어요.' },
  { id: 'eungyeLake', name: '은계호수공원', emoji: '🦆', kind: 'lake', real: [126.8040, 37.4430], at: [0.62, 0.11], stop: ['은계호수공원'],
    desc: '은계호수공원이에요! 호수 둘레를 아장아장 산책해요.' }
];
// 🌊 대부도·오이도 바닷가 (시흥·안산 서쪽). 시화방조제로 이어진 섬
export const DAEBU_SPOT_LIST = [
  { id: 'oidoLighthouse', name: '오이도 빨강등대', emoji: '🗼', kind: 'lighthouse', real: [126.6878, 37.3454], at: [0.67, 0.18], stop: ['빨강등대'],
    desc: '오이도 빨강등대예요! 빨간 등대가 밤바다를 반짝반짝 비춰 줘요. 갈매기도 끼룩끼룩!' },
  { id: 'tidalPark', name: '시화나래 조력공원', emoji: '🌙', kind: 'tidal', real: [126.6080, 37.3111], at: [0.31, 0.35], stop: ['조력발전소'],
    desc: '시화나래 조력공원이에요! 바닷물이 들어오고 나가는 힘으로 전기를 만들어요. 높은 달 전망대도 있어요!' },
  { id: 'bangamori', name: '방아머리 해수욕장', emoji: '🏖️', kind: 'beach', real: [126.5800, 37.2915], at: [0.18, 0.45], stop: ['방아머리'],
    desc: '방아머리 해수욕장이에요! 모래성 쌓고 파도랑 놀아요. 철썩철썩!' },
  { id: 'daebuGrape', name: '대부도 포도밭', emoji: '🍇', kind: 'grape', real: [126.6000, 37.2560], at: [0.27, 0.64], stop: ['대부동복지체육센터'],
    desc: '대부도 포도밭이에요! 달콤한 포도가 주렁주렁 열려요. 냠냠!' },
  { id: 'glassIsland', name: '유리섬 박물관', emoji: '🔮', kind: 'art', real: [126.6017, 37.2217], at: [0.28, 0.81], stop: ['유리섬'],
    desc: '유리섬 박물관이에요! 반짝반짝 예쁜 유리 그릇을 만들어요.' },
  { id: 'seaArboretum', name: '바다향기수목원', emoji: '🌲', kind: 'park', real: [126.6440, 37.2240], at: [0.47, 0.8], stop: ['바다향기수목원'],
    desc: '바다향기수목원이에요! 바닷바람 부는 숲길을 산책해요.' },
  { id: 'tando', name: '탄도항', emoji: '⛵', kind: 'port', real: [126.6458, 37.1943], at: [0.48, 0.95], stop: ['탄도'],
    desc: '탄도항이에요! 배가 둥실둥실, 바다 건너 누에섬에는 커다란 바람개비가 빙글빙글 돌아요.' }
];
// 🏙️ 부천 (시흥 위, 광명 왼쪽). 1호선(경인선)·7호선·서해선이 지나간다
export const BUCHEON_SPOT_LIST = [
  { id: 'bucheonStn', name: '부천역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.7829, 37.4842], at: [0.42, 0.62], stop: ['부천역'],
    desc: '부천역이에요! 남색 1호선 전철이 칙칙폭폭 서요. 사람이 아주 많아요!' },
  { id: 'songnaeStn', name: '송내역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.7530, 37.4877], at: [0.16, 0.57], stop: ['송내역'],
    desc: '송내역이에요! 남색 1호선 전철이 서요.' },
  { id: 'yeokgokStn', name: '역곡역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.8115, 37.4853], at: [0.67, 0.6], stop: ['역곡역'],
    desc: '역곡역이에요! 남색 1호선 전철이 서요.' },
  { id: 'sosaStn', name: '소사역', emoji: '🚉', kind: 'station', lines: ['1', '서해'], real: [126.7953, 37.4827], at: [0.53, 0.66], stop: ['소사역'],
    desc: '소사역이에요! 남색 1호선이랑 연두색 서해선을 갈아탈 수 있어요.' },
  { id: 'onsuStn', name: '온수역', emoji: '🚉', kind: 'station', lines: ['1', '7'], real: [126.8251, 37.4921], at: [0.79, 0.5], stop: ['온수역'],
    desc: '온수역이에요! 남색 1호선이랑 올리브색 7호선을 갈아탈 수 있어요.' },
  { id: 'bucheonHallStn', name: '부천시청역', emoji: '🚉', kind: 'station', lines: ['7'], real: [126.7634, 37.5045], at: [0.25, 0.33], stop: ['부천시청역'],
    desc: '부천시청역이에요! 올리브색 7호선 전철이 땅속으로 다녀요.' },
  { id: 'bcStadiumStn', name: '부천종합운동장', emoji: '🏟️', kind: 'stadium', lines: ['7'], real: [126.7975, 37.5050], at: [0.55, 0.33], stop: ['부천종합운동장'],
    desc: '부천종합운동장이에요! 축구 선수들이 공을 뻥뻥 차요. 7호선 역도 바로 옆에 있어요.' },
  { id: 'hyundaiJungdong', name: '현대백화점 중동점', emoji: '🏬', kind: 'dept', sign: '현대', real: [126.7612, 37.5040], at: [0.19, 0.42], stop: ['현대백화점'],
    desc: '현대백화점 중동점이에요! 부천시청역 바로 옆 커다란 백화점이에요. 엘리베이터 타고 쓩!' },
  { id: 'lotteJungdong', name: '롯데백화점 중동점', emoji: '🏬', kind: 'dept', sign: '롯데', real: [126.7735, 37.5038], at: [0.38, 0.34], stop: ['롯데백화점'],
    desc: '롯데백화점 중동점이에요! 신중동역 옆에 있는 커다란 백화점이에요.' },
  { id: 'bucheonHall', name: '부천시청', emoji: '🏛️', kind: 'hall', real: [126.7660, 37.5035], at: [0.29, 0.41], stop: ['부천시청'],
    desc: '부천시청이에요! 부천을 돌보는 커다란 건물이에요. 앞에 넓은 잔디밭도 있어요.' },
  { id: 'sangdongLake', name: '상동호수공원', emoji: '🦢', kind: 'lake', real: [126.7470, 37.5025], at: [0.09, 0.4], stop: ['상동호수공원'],
    desc: '상동호수공원이에요! 호수에 오리가 둥실둥실 떠 있어요.' },
  { id: 'woongjin', name: '웅진플레이도시', emoji: '🏊', kind: 'themepark', real: [126.7458, 37.5008], at: [0.15, 0.47], stop: ['웅진플레이도시'],
    desc: '웅진플레이도시예요! 물놀이도 하고 눈썰매도 타는 커다란 곳이에요. 첨벙첨벙 신나요.' },
  { id: 'wonmi', name: '원미산 진달래동산', emoji: '🌸', kind: 'azalea', real: [126.7960, 37.4960], at: [0.53, 0.47],
    desc: '원미산 진달래동산이에요! 봄이 되면 산이 온통 분홍색 진달래로 물들어요.' },
  { id: 'botanical', name: '부천식물원', emoji: '🌵', kind: 'park', real: [126.8180, 37.5120], at: [0.72, 0.24], stop: ['식물원', '자연생태공원'],
    desc: '부천식물원이에요! 유리 온실 안에 뾰족뾰족 선인장이랑 커다란 나무가 있어요.' },
  { id: 'manhwa', name: '만화박물관', emoji: '📚', kind: 'art', real: [126.7413, 37.5085], at: [0.05, 0.23], stop: ['한국만화박물관'],
    desc: '만화박물관이에요! 재미있는 그림책이랑 만화가 가득해요.' },
  { id: 'freeMarket', name: '부천 자유시장', emoji: '🛒', kind: 'market', real: [126.7860, 37.4870], at: [0.45, 0.53],
    desc: '부천 자유시장이에요! 떡이랑 과일이랑 맛있는 게 많아요.' }
];
// 🌉 인천 부평·남동 (부천·시흥 왼쪽). 인천 1호선·경인선·7호선·수인선
export const INCHEON_SPOT_LIST = [
  { id: 'bupyeongStn', name: '부평역', emoji: '🚉', kind: 'station', lines: ['1', '인천1'], real: [126.7238, 37.4897], at: [0.85, 0.29], stop: ['부평역'],
    desc: '부평역이에요! 남색 1호선이랑 인천 1호선을 갈아탈 수 있어요. 땅속에 커다란 지하상가도 있어요!' },
  { id: 'bupyeongGuStn', name: '부평구청역', emoji: '🚉', kind: 'station', lines: ['7', '인천1'], real: [126.7215, 37.5082], at: [0.82, 0.14], stop: ['부평구청역', '부평구청'],
    desc: '부평구청역이에요! 올리브색 7호선 끝 역이에요. 인천 1호선으로 갈아탈 수 있어요.' },
  { id: 'incheonHallStn', name: '인천시청역', emoji: '🚉', kind: 'station', lines: ['인천1'], real: [126.7020, 37.4575], at: [0.53, 0.49], stop: ['인천시청역'],
    desc: '인천시청역이에요! 인천 1호선 전철이 땅속으로 다녀요.' },
  { id: 'incheonHall', name: '인천시청', emoji: '🏛️', kind: 'hall', real: [126.7052, 37.4563], at: [0.67, 0.53], stop: ['인천시청'],
    desc: '인천시청이에요! 바다가 있는 큰 도시 인천을 돌보는 곳이에요.' },
  { id: 'lotteIncheon', name: '롯데백화점 인천점', emoji: '🏬', kind: 'dept', sign: '롯데', real: [126.7016, 37.4431], at: [0.52, 0.62], stop: ['롯데백화점'],
    desc: '롯데백화점 인천점이에요! 버스 터미널 바로 옆에 있는 커다란 백화점이에요.' },
  { id: 'bupyeongMarket', name: '부평시장', emoji: '🛒', kind: 'market', real: [126.7228, 37.4950], at: [0.84, 0.23], stop: ['부평시장'],
    desc: '부평시장이에요! 떡이랑 반찬이랑 맛있는 게 줄줄이 있어요.' },
  { id: 'soraePort', name: '소래포구', emoji: '🦐', kind: 'port', lines: ['수인'], real: [126.7339, 37.4012], at: [0.99, 0.89], stop: ['소래포구역'],
    desc: '소래포구예요! 배가 둥실둥실, 새우랑 꽃게를 파는 어시장이 있어요. 노란 수인선 전철역도 있어요.' },
  { id: 'soraeWetland', name: '소래습지생태공원', emoji: '🌾', kind: 'park', real: [126.7445, 37.4130], at: [1.12, 0.8], stop: ['소래습지생태공원', '생태공원'],
    desc: '소래습지생태공원이에요! 갈대밭 사이로 커다란 풍차가 빙글빙글 돌아요.' },
  { id: 'incheonPark', name: '인천대공원', emoji: '🦌', kind: 'park', real: [126.7515, 37.4595], at: [1.22, 0.5], stop: ['인천대공원'],
    desc: '인천대공원이에요! 넓은 잔디밭이랑 호수가 있고, 작은 동물원에 사슴도 있어요.' }
];
// 🌊 인천 바닷가 (인천 서쪽): 송도·월미도·차이나타운·연안부두·영종도(인천공항·을왕리)
export const INCHEON_WEST_SPOT_LIST = [
  { id: 'incheonAirport', name: '인천공항', emoji: '✈️', kind: 'airport', lines: ['공항'], real: [126.4505, 37.4492], at: [0.3, 0.4], stop: ['인천공항1터미널', '제1여객터미널', '제1터미널'],
    desc: '인천공항이에요! 커다란 비행기가 부웅 하고 하늘로 날아올라요. 먼 나라로 여행 가는 곳이에요!' },
  { id: 'eurwangni', name: '을왕리 해수욕장', emoji: '🏖️', kind: 'beach', real: [126.3740, 37.4475], at: [0.06, 0.41], stop: ['을왕리'],
    desc: '을왕리 해수욕장이에요! 모래성 쌓고 파도랑 철썩철썩 놀아요. 저녁엔 해가 바다로 쏙 들어가요.' },
  { id: 'wolmido', name: '월미도', emoji: '🎡', kind: 'themepark', real: [126.5975, 37.4755], at: [0.78, 0.27], stop: ['월미도', '월미공원', '월미바다'],
    desc: '월미도예요! 바닷가에 빙글빙글 관람차랑 신나는 놀이기구가 있어요. 갈매기한테 손 흔들어요!' },
  { id: 'incheonStn', name: '인천역', emoji: '🚉', kind: 'station', lines: ['1', '수인'], real: [126.6167, 37.4766], at: [0.85, 0.25], stop: ['인천역'],
    desc: '인천역이에요! 남색 1호선이랑 노란 수인선의 끝 역이에요.' },
  { id: 'chinatown', name: '차이나타운', emoji: '🏮', kind: 'shops', real: [126.6190, 37.4750], at: [0.89, 0.31], stop: ['차이나타운'],
    desc: '차이나타운이에요! 빨간 등이 주렁주렁, 맛있는 짜장면 냄새가 솔솔 나요.' },
  { id: 'yeonan', name: '연안부두', emoji: '⛴️', kind: 'port', real: [126.5985, 37.4530], at: [0.8, 0.39], stop: ['연안부두', '연안여객터미널'],
    desc: '연안부두예요! 섬으로 가는 커다란 배가 뿌우 하고 떠나요.' },
  { id: 'songdoPark', name: '송도 센트럴파크', emoji: '🏙️', kind: 'park', lines: ['인천1'], real: [126.6345, 37.3933], at: [0.91, 0.68], stop: ['센트럴파크'],
    desc: '송도 센트럴파크예요! 높은 빌딩 사이로 물길이 흐르고, 배를 타고 둥실둥실 다녀요. 인천 1호선 역도 있어요.' }
];
// ⛰️ 인천 북쪽: 계양·서구·청라 (+ 김포공항)
export const INCHEON_NORTH_SPOT_LIST = [
  { id: 'gyeyangStn', name: '계양역', emoji: '🚉', kind: 'station', lines: ['인천1', '공항'], real: [126.7373, 37.5715], at: [0.69, 0.48], stop: ['계양역'],
    desc: '계양역이에요! 인천 1호선이랑 공항철도를 갈아탈 수 있어요. 공항철도 타면 비행기 보러 가요!' },
  { id: 'gyeyangsan', name: '계양산', emoji: '⛰️', kind: 'mountain', real: [126.7085, 37.5440], at: [0.54, 0.8], stop: ['계양산'],
    desc: '계양산이에요! 인천에서 제일 높은 산이에요. 꼭대기에 올라가면 바다가 보여요.' },
  { id: 'asiad', name: '아시아드 경기장', emoji: '🏟️', kind: 'stadium', real: [126.6773, 37.5487], at: [0.38, 0.75], stop: ['아시아드'],
    desc: '아시아드 주경기장이에요! 아주아주 커다란 운동장에서 달리기도 하고 공연도 해요.' },
  { id: 'cheongnaStn', name: '청라국제도시역', emoji: '🚉', kind: 'station', lines: ['공항'], real: [126.6247, 37.5562], at: [0.13, 0.66], stop: ['청라국제도시역'],
    desc: '청라국제도시역이에요! 파란 공항철도 전철이 서요. 다음은 바다 건너 영종도예요!' },
  { id: 'cheongnaLake', name: '청라호수공원', emoji: '⛲', kind: 'lake', real: [126.6375, 37.5330], at: [0.19, 0.95], stop: ['청라호수공원'],
    desc: '청라호수공원이에요! 커다란 호수에서 음악에 맞춰 분수가 춤을 춰요.' },
  { id: 'araRiver', name: '경인아라뱃길', emoji: '🚢', kind: 'river', real: [126.7300, 37.5760], at: [0.65, 0.4],
    desc: '경인아라뱃길이에요! 바다까지 이어진 커다란 물길이에요. 배도 다니고 자전거도 타요.' },
  { id: 'gimpoAirport', name: '김포공항', emoji: '🛫', kind: 'airport', lines: ['공항'], real: [126.8015, 37.5620], at: [0.97, 0.6], stop: ['김포공항'],
    desc: '김포공항이에요! 제주도 가는 비행기가 슝 하고 날아가요. 공항철도로 인천공항까지 갈 수 있어요.' }
];
// 🏙️ 서울 구로·영등포 (양천 목동 포함). 부천 위쪽 오른편
export const GURO_SPOT_LIST = [
  { id: 'guroStn', name: '구로역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.8818, 37.5030], at: [0.398, 0.712], stop: ['구로역'],
    desc: '구로역이에요! 남색 1호선이 두 갈래로 나뉘는 역이에요. 기차가 아주 많이 지나가요.' },
  { id: 'sindorimStn', name: '신도림역', emoji: '🚉', kind: 'station', lines: ['1', '2'], real: [126.8913, 37.5088], at: [0.489, 0.6], stop: ['신도림역'],
    desc: '신도림역이에요! 남색 1호선이랑 초록 2호선을 갈아타요. 사람이 아주아주 많아요!' },
  { id: 'yeongdeungpoStn', name: '영등포역', emoji: '🚉', kind: 'station', lines: ['1'], real: [126.9071, 37.5155], at: [0.639, 0.471], stop: ['영등포역'],
    desc: '영등포역이에요! 남색 1호선이랑 멀리 가는 기차도 서요. 역 안에 큰 백화점도 있어요.' },
  { id: 'gocheokDome', name: '고척스카이돔', emoji: '⚾', kind: 'stadium', real: [126.8671, 37.4982], at: [0.258, 0.804], stop: ['고척스카이돔', '고척돔'],
    desc: '고척스카이돔이에요! 지붕이 있는 커다란 야구장이라 비가 와도 야구를 해요. 딱! 홈런!' },
  { id: 'yeouidoStn', name: '여의도역', emoji: '🚉', kind: 'station', lines: ['5', '9'], real: [126.9243, 37.5216], at: [0.803, 0.354], stop: ['여의도역'],
    desc: '여의도역이에요! 보라색 5호선이랑 금색 9호선을 갈아타요.' },
  { id: 'yeouidoPark', name: '여의도 한강공원', emoji: '🌉', kind: 'river', real: [126.9330, 37.5275], at: [0.886, 0.24], stop: ['여의나루역', '여의도한강공원'],
    desc: '여의도 한강공원이에요! 넓은 한강을 보며 돗자리 펴고 놀아요. 유람선도 지나가요.' },
  { id: 'sixtyThree', name: '63빌딩', emoji: '🏢', kind: 'tower', real: [126.9400, 37.5198], at: [0.952, 0.388], stop: ['63빌딩'],
    desc: '63빌딩이에요! 반짝반짝 금색 유리 빌딩이에요. 안에 커다란 수족관도 있어요.' },
  { id: 'ohmokgyoStn', name: '오목교역', emoji: '🚉', kind: 'station', lines: ['5'], real: [126.8750, 37.5245], at: [0.333, 0.298], stop: ['오목교역'],
    desc: '오목교역이에요! 보라색 5호선 전철이 서요. 근처에 목동 아파트가 많아요.' },
  { id: 'parisPark', name: '파리공원', emoji: '🗼', kind: 'park', real: [126.8790, 37.5320], at: [0.371, 0.154], stop: ['파리공원'],
    desc: '파리공원이에요! 작은 에펠탑이 있는 예쁜 공원이에요.' },
  { id: 'seonyudo', name: '선유도공원', emoji: '🌿', kind: 'park', real: [126.8995, 37.5460], at: [0.567, -0.115], stop: ['선유도'],
    desc: '선유도공원이에요! 한강 가운데 작은 섬 공원이에요. 무지개다리를 건너가요.' }
];
// ✈️ 서울 강서 (김포공항 옆, 한강 남쪽)
export const GANGSEO_SPOT_LIST = [
  { id: 'seoulBotanic', name: '서울식물원', emoji: '🌵', kind: 'park', real: [126.8350, 37.5695], at: [0.619, 0.293], stop: ['서울식물원'],
    desc: '서울식물원이에요! 커다란 유리 온실 안에 세계 여러 나라 나무랑 꽃이 있어요.' },
  { id: 'magokStn', name: '마곡나루역', emoji: '🚉', kind: 'station', lines: ['9'], real: [126.8271, 37.5668], at: [0.544, 0.331], stop: ['마곡나루역'],
    desc: '마곡나루역이에요! 금색 9호선 전철이 서요.' },
  { id: 'balsanStn', name: '발산역', emoji: '🚉', kind: 'station', lines: ['5'], real: [126.8375, 37.5585], at: [0.643, 0.45], stop: ['발산역'],
    desc: '발산역이에요! 보라색 5호선 전철이 서요.' },
  { id: 'hwagokStn', name: '화곡역', emoji: '🚉', kind: 'station', lines: ['5'], real: [126.8405, 37.5415], at: [0.671, 0.693], stop: ['화곡역'],
    desc: '화곡역이에요! 보라색 5호선 전철이 서요.' },
  { id: 'kkachisanStn', name: '까치산역', emoji: '🚉', kind: 'station', lines: ['2', '5'], real: [126.8467, 37.5318], at: [0.73, 0.831], stop: ['까치산역'],
    desc: '까치산역이에요! 초록 2호선이랑 보라색 5호선을 갈아타요.' },
  { id: 'gangseoHall', name: '강서구청', emoji: '🏛️', kind: 'hall', real: [126.8497, 37.5509], at: [0.759, 0.559], stop: ['강서구청'],
    desc: '강서구청이에요! 강서구를 돌보는 큰 건물이에요.' },
  { id: 'heojun', name: '허준박물관', emoji: '🌿', kind: 'art', real: [126.8495, 37.5700], at: [0.757, 0.286], stop: ['허준박물관'],
    desc: '허준박물관이에요! 옛날 훌륭한 의사 선생님이 약초로 아픈 사람을 고쳐 준 이야기가 있어요.' },
  { id: 'gangseoRiver', name: '강서 한강공원', emoji: '🦆', kind: 'river', real: [126.8170, 37.5860], at: [0.448, 0.057], stop: ['강서한강공원'],
    desc: '강서 한강공원이에요! 한강 옆 넓은 풀밭에서 새들이 쉬어 가요.' },
  { id: 'gaehwasan', name: '개화산', emoji: '⛰️', kind: 'mountain', real: [126.8040, 37.5780], at: [0.324, 0.171], stop: ['개화산'],
    desc: '개화산이에요! 꼭대기에 오르면 한강이랑 비행기가 보여요.' },
  { id: 'gayangStn', name: '가양역', emoji: '🚉', kind: 'station', lines: ['9'], real: [126.8545, 37.5615], at: [0.805, 0.407], stop: ['가양역'],
    desc: '가양역이에요! 금색 9호선 전철이 서요.' }
];
// 🌾 김포 (인천 서구 위, 한강 하구). 김포골드라인
export const GIMPO_SPOT_LIST = [
  { id: 'gimpoHall', name: '김포시청', emoji: '🏛️', kind: 'hall', real: [126.7155, 37.6152], at: [0.675, 0.86], stop: ['김포시청'],
    desc: '김포시청이에요! 김포를 돌보는 큰 건물이에요.' },
  { id: 'sawooStn', name: '사우역', emoji: '🚉', kind: 'station', lines: ['김포'], real: [126.7170, 37.6205], at: [0.681, 0.831], stop: ['사우역'],
    desc: '사우역이에요! 금빛 김포골드라인 꼬마 전철이 서요. 운전하는 사람이 없는 전철이에요!' },
  { id: 'guraeStn', name: '구래역', emoji: '🚉', kind: 'station', lines: ['김포'], real: [126.6280, 37.6450], at: [0.338, 0.694], stop: ['구래역'],
    desc: '구래역이에요! 금빛 김포골드라인 꼬마 전철이 서요.' },
  { id: 'gimpoLake', name: '한강신도시 호수공원', emoji: '🦢', kind: 'lake', real: [126.6790, 37.6570], at: [0.535, 0.628], stop: ['호수공원'],
    desc: '김포 호수공원이에요! 커다란 호수 둘레를 아장아장 산책해요.' },
  { id: 'lavenice', name: '라베니체 물길', emoji: '🛶', kind: 'river', real: [126.6700, 37.6440], at: [0.5, 0.7], stop: ['라베니체', '장기역'],
    desc: '라베니체예요! 집 사이로 물길이 흐르고 작은 배가 둥실둥실 다녀요.' },
  { id: 'daemyeong', name: '대명항', emoji: '🦀', kind: 'port', real: [126.5600, 37.6465], at: [0.077, 0.686], stop: ['대명항'],
    desc: '대명항이에요! 고기잡이배가 돌아오면 꽃게랑 생선을 팔아요.' },
  { id: 'aegibong', name: '애기봉 전망대', emoji: '🔭', kind: 'tower', real: [126.5885, 37.7510], at: [0.187, 0.106], stop: ['애기봉'],
    desc: '애기봉 전망대예요! 망원경으로 강 건너 아주 먼 곳까지 보여요.' },
  { id: 'munsusan', name: '문수산', emoji: '⛰️', kind: 'mountain', real: [126.5565, 37.7330], at: [0.063, 0.206], stop: ['문수산'],
    desc: '문수산이에요! 옛날 성벽이 산을 빙 둘러 있어요.' }
];
// 🏝️ 강화도 (김포 서쪽 섬). 강화대교·초지대교로 건너간다
export const GANGHWA_SPOT_LIST = [
  { id: 'ganghwaMarket', name: '강화 풍물시장', emoji: '🛒', kind: 'market', real: [126.4930, 37.7390], at: [0.758, 0.277], stop: ['풍물시장', '강화터미널'],
    desc: '강화 풍물시장이에요! 강화 순무랑 고소한 땅콩이랑 맛있는 게 많아요.' },
  { id: 'dolmen', name: '강화 고인돌', emoji: '🪨', kind: 'art', real: [126.4495, 37.7615], at: [0.556, 0.175], stop: ['고인돌'],
    desc: '강화 고인돌이에요! 아주아주 옛날 사람들이 커다란 돌을 탁자처럼 쌓았어요.' },
  { id: 'peaceObs', name: '강화 평화전망대', emoji: '🔭', kind: 'tower', real: [126.4280, 37.7745], at: [0.456, 0.116], stop: ['평화전망대'],
    desc: '강화 평화전망대예요! 바다 건너 먼 마을까지 보여요.' },
  { id: 'manisan', name: '마니산', emoji: '⛰️', kind: 'mountain', real: [126.4290, 37.6140], at: [0.46, 0.845], stop: ['마니산'],
    desc: '마니산이에요! 꼭대기에 아주 옛날 하늘에 제사를 지내던 돌 제단이 있어요.' },
  { id: 'dongmak', name: '동막 해수욕장', emoji: '🏖️', kind: 'beach', real: [126.4640, 37.5935], at: [0.623, 0.939], stop: ['동막'],
    desc: '동막 해수욕장이에요! 바닷물이 빠지면 넓은 갯벌에서 게를 찾아요.' },
  { id: 'ganghwaLuge', name: '강화 루지', emoji: '🛷', kind: 'themepark', real: [126.4770, 37.6040], at: [0.684, 0.891], stop: ['루지', '씨사이드'],
    desc: '강화 루지예요! 바퀴 달린 썰매를 타고 언덕을 쓩 내려와요!' }
];
export const TOWN_SPOT_LISTS = { sanbon: SPOT_LIST, anyang: ANYANG_SPOT_LIST, uiwang: UIWANG_SPOT_LIST, gwacheon: GWACHEON_SPOT_LIST,
  gunposouth: GUNPO_SOUTH_SPOT_LIST, seoksu: SEOKSU_SPOT_LIST, gwangmyeong: GWANGMYEONG_SPOT_LIST, geumcheon: GEUMCHEON_SPOT_LIST, gwanak: GWANAK_SPOT_LIST,
  ansan: ANSAN_SPOT_LIST, siheung: SIHEUNG_SPOT_LIST, daebu: DAEBU_SPOT_LIST, bucheon: BUCHEON_SPOT_LIST, incheon: INCHEON_SPOT_LIST,
  incheonwest: INCHEON_WEST_SPOT_LIST, incheonnorth: INCHEON_NORTH_SPOT_LIST,
  guro: GURO_SPOT_LIST, gangseo: GANGSEO_SPOT_LIST, gimpo: GIMPO_SPOT_LIST, ganghwa: GANGHWA_SPOT_LIST };
