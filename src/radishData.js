// 🥕 무 뽑기 체험 데이터 (그림·동작은 RadishGame.jsx)

// 무 크기. len·wid 는 유나 키(S) 대비 무 몸통 길이·굵기, need = 혼자 끝까지 당기는 데 드는 시간(초, 힘껏 당길 때)
export const RADISH_SIZES = {
  small: { id: 'small', name: '꼬마 무', len: 0.34, wid: 0.15, leaf: 0.36, need: 1.6 },
  mid: { id: 'mid', name: '무', len: 0.46, wid: 0.2, leaf: 0.44, need: 2.4 },
  big: { id: 'big', name: '큰 무', len: 0.58, wid: 0.25, leaf: 0.5, need: 3.2 },
  giant: { id: 'giant', name: '왕무', len: 1.15, wid: 0.56, leaf: 0.72, need: 2.6 }
};

// 왕무는 혼자서는 안 빠진다: 친구가 한 명씩 붙을 때마다 더 뽑힐 수 있는 한계(cap)가 올라간다.
// 동화 '커다란 순무'처럼 엄마 → 아빠 → 강아지 → 고양이 → 생쥐 순서, 생쥐가 오면 쑥!
export const RADISH_HELPERS = [
  { id: 'mom', name: '엄마', call: '엄마' },
  { id: 'dad', name: '아빠', call: '아빠' },
  { id: 'dog', name: '강아지', call: '멍멍이' },
  { id: 'cat', name: '고양이', call: '야옹이' },
  { id: 'mouse', name: '생쥐', call: '생쥐' }
];
export const GIANT_CAPS = [0.3, 0.45, 0.6, 0.74, 0.86, 1];   // 도와주는 친구 수(0~5)별 한계

// 한 밭: 보통 무 4개(크기 무작위) + 맨 오른쪽 왕무 1개
export const FIELD_NORMAL = 4;
export function newField() {
  const pool = ['small', 'mid', 'mid', 'big'];
  const sizes = Array.from({ length: FIELD_NORMAL }, () => pool[Math.floor(Math.random() * pool.length)]);
  return [...sizes, 'giant'].map((size, i) => ({
    i, size, seed: Math.floor(Math.random() * 1e9),
    p: 0,            // 뽑힌 정도 0~1
    done: false      // 바구니에 들어갔으면 true
  }));
}

// 지금까지 뽑은 무 (이 기기에만)
const KEY = 'bps_radish_v1';
export function loadRadishStats() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.total === 'number') return { total: v.total, giant: v.giant || 0 }; } catch { /* 무시 */ }
  return { total: 0, giant: 0 };
}
export function saveRadishStats(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 무시 */ } }
