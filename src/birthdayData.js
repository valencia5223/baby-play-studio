// 🎂 생일 파티: 주인공·가사·멜로디·안내 문장 (BirthdayParty.jsx 가 쓰고, 안내 문장은 그림책 여성 목소리로 미리 만든다)
// 멜로디는 전통 "생일 축하합니다"(저작권이 끝난 곡)를 앱이 직접 연주한다.

export const BDAY_CHARS = [
  { id: 'shark', name: '아기상어', call: '아기상어야', candles: 3, color: '#fde68a', ink: '#92400e' },
  { id: 'panda', name: '판다', call: '판다야', candles: 3, color: '#e5e7eb', ink: '#1f2937' },
  { id: 'lion', name: '사자', call: '사자야', candles: 4, color: '#fed7aa', ink: '#9a3412' },
  { id: 'cat', name: '고양이', call: '고양아', candles: 3, color: '#fde2c4', ink: '#9a5b13' },
  { id: 'yuna', name: '유나', call: '유나야', candles: 2, color: '#fbcfe8', ink: '#9d174d' }
];
export const BDAY_BY_ID = Object.fromEntries(BDAY_CHARS.map(c => [c.id, c]));

// 3/4박자, [음, 박]
export const BDAY_BEAT = 0.55;   // 한 박 (초)
export const BDAY_MELODY = [
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
  ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
  ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]
];
// 마디 첫 박의 낮은 반주 [박, 음]
export const BDAY_BASS = [[1, 'C3'], [4, 'G3'], [7, 'G3'], [10, 'C3'], [13, 'C3'], [16, 'F3'], [19, 'C3'], [21, 'G3'], [22, 'C3']];
export const NOTE_HZ = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, C3: 130.81, F3: 174.61, G3: 196 };

// 가사 줄과 그 줄이 불리는 박 구간 [시작, 끝)
export const bdayLyrics = (c) => [
  { text: '생일 축하합니다', from: 0, to: 6 },
  { text: '생일 축하합니다', from: 6, to: 12 },
  { text: `사랑하는 ${c.name}의`, from: 12, to: 19, name: c.name },
  { text: '생일 축하합니다', from: 19, to: 26 }
];

// 생일 노래 MP3 (public/birthday). 노래가 두 번 나오며, 줄마다 [시작, 끝) 초 — 소리 분석으로 맞춤.
// 줄 번호는 i % 4 (위 가사 4줄을 두 번)
export const BDAY_MP3 = '/birthday/birthday-song.mp3';
export const BDAY_MP3_LINES = [
  [7.1, 10.0], [10.0, 12.9], [12.9, 16.9], [16.9, 19.6],
  [23.6, 26.6], [26.6, 29.5], [29.5, 33.5], [33.5, 36.3]
];

// MP3 가사 8줄: 1절 한국어, 2절 영어 (BDAY_MP3_LINES 와 같은 순서)
export const bdayMp3Lyrics = (c) => [
  ...bdayLyrics(c),
  { text: 'Happy birthday to you' },
  { text: 'Happy birthday to you' },
  { text: `Happy birthday dear ${c.name}`, name: c.name },
  { text: 'Happy birthday to you' }
];

export const bdayIntro = (c) => `${c.name}의 생일 파티예요! 다 같이 생일 노래를 불러요!`;
export const bdayBlow = (c) => `${c.call}, 생일 축하해! 이제 촛불을 후 불어 볼까?`;
export const BDAY_DONE = '와아! 촛불을 다 껐어요! 짝짝짝, 생일 축하해요!';

export function collectBirthdayLines() {
  const lines = [BDAY_DONE];
  BDAY_CHARS.forEach(c => lines.push(bdayIntro(c), bdayBlow(c)));
  return lines;
}
