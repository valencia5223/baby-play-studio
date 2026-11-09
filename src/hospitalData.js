// 🏥 병원 놀이: 찾아오는 환자 (아기·어린이·동물 친구)
//  - kid: true 는 HospitalGame.jsx 의 drawKid 로, 나머지는 요리 놀이 손님 그림(GUEST_FN)을 빌려 그린다
//  - nose·mouth = 코·입 높이 (몸 크기 S 배, 앉은 엉덩이 바닥이 0), 콧물 빼기·비타민 먹이기 자리
//  - 이름이 음성 문장에 들어가므로 바꾸면 npm run voices 를 다시 실행할 것
export const HOSPITAL_PATIENTS = [
  { id: 'baby', name: '아기', emoji: '👶', kid: true, nose: -0.735, mouth: -0.675 },
  { id: 'girl', name: '하나', emoji: '👧', kid: true, nose: -0.745, mouth: -0.68 },
  { id: 'boy', name: '준이', emoji: '👦', kid: true, nose: -0.745, mouth: -0.68 },
  { id: 'rabbit', name: '토끼', emoji: '🐰', nose: -0.7, mouth: -0.645 },
  { id: 'bear', name: '곰', emoji: '🐻', nose: -0.7, mouth: -0.645 },
  { id: 'panda', name: '판다', emoji: '🐼', nose: -0.695, mouth: -0.64 },
  { id: 'dog', name: '강아지', emoji: '🐶', nose: -0.7, mouth: -0.645 },
  { id: 'cat', name: '고양이', emoji: '🐱', nose: -0.705, mouth: -0.66 },
  { id: 'pig', name: '돼지', emoji: '🐷', nose: -0.7, mouth: -0.645 },
  { id: 'monkey', name: '원숭이', emoji: '🐵', nose: -0.7, mouth: -0.645 },
  { id: 'koala', name: '코알라', emoji: '🐨', nose: -0.675, mouth: -0.635 },
  { id: 'fox', name: '여우', emoji: '🦊', nose: -0.7, mouth: -0.645 },
  { id: 'mouse', name: '생쥐', emoji: '🐭', nose: -0.68, mouth: -0.625 },
  { id: 'lion', name: '사자', emoji: '🦁', nose: -0.71, mouth: -0.66 }
];
// 아픈 곳 (한두 가지): fever = 열, nose = 콧물, wound = 넘어져서 아야
export const HOSPITAL_SYMPTOMS = [['fever'], ['nose'], ['wound'], ['fever', 'nose'], ['fever', 'wound'], ['nose', 'wound']];
// 귀 체온계에 나오는 체온 (음성 문장이 미리 만들어져 있어서 이 숫자들만 쓴다)
export const HOSPITAL_TEMPS = { fever: [38.2, 38.5, 38.8], normal: [36.5, 36.8, 37.0] };
