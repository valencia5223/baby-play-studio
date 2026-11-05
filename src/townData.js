// ═════════════════════════════════════════════════════════════════════════════
// 🚗 우리 동네(산본) 데이터: 장소·철길·길 그래프·버스 노선
//  - 좌표는 경도/위도를 지도 범위(townBus.json 의 box) 안 0~1 (u: 서→동, v: 북→남) 로 바꿔 쓴다
//  - 길: 버스 노선 정류장 순서를 이은 선 (가까운 정류장(길 양쪽)은 한 점으로 합침) → 아빠차·걷기 길찾기에 씀
//  - 버스: 우리집 앞 정류장(한라2차아파트입구 + 수리산역)을 지나는 노선만 탈 수 있다 (scripts/update-bus.mjs 로 받음)
//  - 화면에는 동 번호 없이 '유나집'만 보인다
// ═════════════════════════════════════════════════════════════════════════════
import BUS from './townBus.json';
import { SPOT_LIST } from './townSpots.js';

export const BOX = BUS.box;
const W_M = (BOX.x1 - BOX.x0) * 88400, H_M = (BOX.y1 - BOX.y0) * 111000;   // 지도 가로·세로 (m)
export const uv = (lon, lat) => ({ u: (lon - BOX.x0) / (BOX.x1 - BOX.x0), v: (BOX.y1 - lat) / (BOX.y1 - BOX.y0) });
export const meters = (a, b) => Math.hypot((a.u - b.u) * W_M, (a.v - b.v) * H_M);

export const TOWN_SPOTS = SPOT_LIST.map(sp => ({ ...sp }));
export const SPOT_BY_ID = Object.fromEntries(TOWN_SPOTS.map(s => [s.id, s]));
TOWN_SPOTS.forEach(s => { s.r = uv(s.real[0], s.real[1]); s.a = { u: s.at[0], v: s.at[1] }; });

// 전철: 4호선(하늘색) 수리산역 → 산본역 → 금정역, 1호선(남색)은 금정역에서 남북으로
const P = (lon, lat) => uv(lon, lat);
export const RAILS = [
  { id: 4, color: '#38bdf8', dark: '#0284c7', pts: [P(126.9190, 37.3380), P(126.9230, 37.3450), P(126.9254, 37.3500), P(126.9290, 37.3545), P(126.9331, 37.3584), P(126.9392, 37.3648), P(126.9432, 37.3720), P(126.9490, 37.3780)] },
  { id: 1, color: '#1e3a8a', dark: '#172554', pts: [P(126.9510, 37.3380), P(126.9480, 37.3560), P(126.9450, 37.3660), P(126.9432, 37.3720), P(126.9405, 37.3780)] }
];
export const STATIONS_ON_RAIL = { 4: ['surisanStn', 'sanbonStn', 'geumjeongStn'], 1: ['geumjeongStn'] };

// ── 길 그래프 ──
const stopUV = {};
Object.entries(BUS.stops).forEach(([id, [, x, y]]) => { stopUV[id] = uv(x, y); });
export const NODES = [];          // {u, v, n}
const stopNode = {};
Object.keys(BUS.stops).forEach(id => {
  const p = stopUV[id];
  let best = -1, bd = 55;
  NODES.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } });
  if (best < 0) { NODES.push({ u: p.u, v: p.v, n: 1 }); stopNode[id] = NODES.length - 1; }
  else { const nd = NODES[best]; nd.u = (nd.u * nd.n + p.u) / (nd.n + 1); nd.v = (nd.v * nd.n + p.v) / (nd.n + 1); nd.n += 1; stopNode[id] = best; }
});
const edgeSet = new Set();
export const EDGES = [];          // [a, b] 노드 번호
const addEdge = (a, b) => { if (a === b) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; if (edgeSet.has(k)) return; edgeSet.add(k); EDGES.push([a, b]); };
BUS.routes.forEach(r => r.runs.forEach(run => {
  for (let i = 1; i < run.length; i++) { const a = stopNode[run[i - 1]], b = stopNode[run[i]]; if (meters(NODES[a], NODES[b]) < 1300) addEdge(a, b); }
}));
// 장소마다 가장 가까운 길에 작은 골목을 잇는다
const nearestNode = (p) => { let best = 0, bd = Infinity; NODES.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } }); return best; };
TOWN_SPOTS.forEach(s => { s.node = nearestNode(s.r); });
TOWN_SPOTS.forEach(s => { if (s.link) s.node = SPOT_BY_ID[s.link].node; });   // 수리산은 수리산역 쪽 산길로 들어간다
const ADJ = NODES.map(() => []);
EDGES.forEach(([a, b]) => { const d = meters(NODES[a], NODES[b]); ADJ[a].push([b, d]); ADJ[b].push([a, d]); });

function dijkstra(from, to) {
  const n = NODES.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[from] = 0;
  for (;;) {
    let u = -1, bd = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === to) break;
    done[u] = true;
    ADJ[u].forEach(([w, d]) => { if (dist[u] + d < dist[w]) { dist[w] = dist[u] + d; prev[w] = u; } });
  }
  if (!isFinite(dist[to])) return null;
  const path = []; for (let x = to; x >= 0; x = prev[x]) path.unshift(x);
  return path;
}
// 한 지점에서 다른 지점까지 길을 따라가는 점 목록 (u,v)
export function roadPath(fromUV, fromNode, toUV, toNode) {
  const ids = dijkstra(fromNode, toNode) || [fromNode, toNode];
  return [fromUV, ...ids.map(i => ({ u: NODES[i].u, v: NODES[i].v })), toUV];
}

// ── 버스 ──
export const HOME_STOPS = BUS.home;
export const stopName = (id) => (BUS.stops[id] ? BUS.stops[id][0] : '');
export const shortStop = (id) => stopName(id).split('.')[0].replace(/\(.*?\)/g, '');
export const stopUVOf = (id) => stopUV[id];
export const nodeOfStop = (id) => stopNode[id];
export const ALL_ROUTES = BUS.routes;
// 장소 근처 정류장 (지도 안 노선이 서는 것만)
TOWN_SPOTS.forEach(sp => { sp.stops = (BUS.spotStops[sp.id] || []).filter(id => BUS.stops[id]); });
// 한 점(노드)에 모인 정류장들 (길 양쪽)
const NODE_STOPS = NODES.map(() => []);
Object.keys(BUS.stops).forEach(id => NODE_STOPS[stopNode[id]].push(+id));
export const stopsAtNode = (n) => NODE_STOPS[n];
export const BUS_STYLE = {
  '마을버스': { color: '#22c55e', dark: '#15803d', label: '마을버스' },
  '일반형시내버스': { color: '#2563eb', dark: '#1e40af', label: '시내버스' },
  '직행좌석형시내버스': { color: '#ef4444', dark: '#b91c1c', label: '빨간 버스' }
};
export const busStyle = (type) => BUS_STYLE[type] || BUS_STYLE['일반형시내버스'];
// 음성용 번호: 11-2 → 11 다시 2, P9801(출근) → P9801
export const busSpoken = (name) => `${String(name).replace(/\(.*?\)/g, '').replace('-', ' 다시 ')}번`;
export const busLabel = (name) => String(name).replace(/\(.*?\)/g, '');

// 노드 → 그 노드를 지나는 (노선, 구간, 위치)
const NODE_RUNS = NODES.map(() => []);
ALL_ROUTES.forEach((r, ri) => r.runs.forEach((run, ki) => run.forEach((id, pos) => NODE_RUNS[stopNode[id]].push([ri, ki, pos]))));
const MAX_STOPS = 26;

// 한 노선으로 바로: 탈 정류장(from 안) ~ 내릴 정류장(to 안). 가장 짧은 것
function directTrip(r, from, to, pref) {
  let best = null;
  r.runs.forEach(run => {
    for (let j = 1; j < run.length; j++) {
      if (!to.has(run[j]) || from.has(run[j])) continue;
      let i = -1;
      for (let k = j - 1; k >= 0 && j - k <= MAX_STOPS; k--) if (from.has(run[k])) { i = k; break; }
      if (i < 0) continue;
      if (pref != null) for (let k = i; k >= Math.max(0, i - 3); k--) if (run[k] === pref) { i = k; break; }
      const stops = run.slice(i, j + 1);
      if (!best || stops.length < best.stops.length) best = { route: r, stops, from: run[i], to: run[j], before: i > 0 ? run[i - 1] : null, after: run.slice(j + 1, j + 3) };
      break;
    }
  });
  return best;
}
// 한 번 갈아타기: 노선 r 로 가다가 어느 정류장에서 내려 다른 노선으로 목적지까지 (전체 정류장 수가 가장 적은 것)
function transferTrip(r, from, to) {
  let best = null;
  const ri0 = ALL_ROUTES.indexOf(r);
  r.runs.forEach(run => {
    run.forEach((id, i) => {
      if (!from.has(id)) return;
      for (let k = i + 1; k < run.length && k - i <= 16; k++) {
        if (from.has(run[k])) break;
        const nk = stopNode[run[k]];
        NODE_RUNS[nk].forEach(([rb, kb, m]) => {
          if (rb === ri0) return;
          const runB = ALL_ROUTES[rb].runs[kb];
          for (let j = m + 1; j < runB.length && j - m <= 16; j++) {
            if (!to.has(runB[j])) continue;
            const total = (k - i) + (j - m);
            if (!best || total < best.total) best = { total, route: r, stops: run.slice(i, k + 1), from: id, to: run[k], before: i > 0 ? run[i - 1] : null, after: run.slice(k + 1, k + 3), via: run[k], next: ALL_ROUTES[rb] };
            break;
          }
        });
      }
    });
  });
  return best;
}
// 정류장에 서는 모든 버스: 바로 가는 버스 → 갈아타는 버스 → 안 가는 버스 순
//  fromStops: 지금 있는 곳의 정류장들, dest: 목적지 장소
export function busBoard(fromStops, dest, pref = null) {
  // 목적지 정류장은 출발 정류장에서 뺀다 (유나집 묶음의 수리산역 정류장 → 수리산역 갈 때는 한라2차 앞에서 탄다)
  if (dest.stops.every(id => fromStops.includes(id))) return [];   // 같은 정류장 (유나집 ↔ 청년공간 플라잉)
  const to = new Set(dest.stops), from = new Set(fromStops.filter(id => !to.has(id)));
  const here = ALL_ROUTES.filter(r => r.runs.some(run => run.some(id => from.has(id)) && run.length > 1));
  const list = here.map(r => {
    const d = directTrip(r, from, to, pref);
    if (d) return { route: r, ok: true, trip: d, n: d.stops.length - 1 };
    return { route: r, ok: false, trip: null, n: 99 };
  });
  if (!list.some(x => x.ok)) {
    list.forEach(x => { const tr = transferTrip(x.route, from, to); if (tr) { x.ok = true; x.trip = tr; x.n = 50 + tr.total; x.transfer = true; } });
  }
  return list.sort((a, b) => a.n - b.n || a.route.name.localeCompare(b.route.name, 'ko', { numeric: true }));
}
export const canBus = (fromStops, dest) => !!dest.stops.length && busBoard(fromStops, dest).some(x => x.ok);

// ── 지하철 (4호선: 수리산역 ↔ 산본역 ↔ 금정역) ──
export const METRO_STATIONS = ['surisanStn', 'sanbonStn', 'geumjeongStn'];
const METRO_RAIL_IDX = { surisanStn: 2, sanbonStn: 4, geumjeongStn: 6 };   // RAILS[0].pts 안 위치
export function metroPath(fromId, toId) {
  const a = METRO_RAIL_IDX[fromId], b = METRO_RAIL_IDX[toId], pts = RAILS[0].pts;
  if (a == null || b == null || a === b) return null;
  const seg = a < b ? pts.slice(a, b + 1) : pts.slice(b, a + 1).reverse();
  const stops = METRO_STATIONS.filter(id => { const k = METRO_RAIL_IDX[id]; return (k > Math.min(a, b) && k < Math.max(a, b)); });
  if (a > b) stops.reverse();
  return { pts: seg, middle: stops.map(id => ({ id, at: METRO_RAIL_IDX[id] })) , dir: a < b ? 1 : -1 };
}

// ── 저장: 도장 ──
const SAVE_KEY = 'bps_town_v1';
export function loadTown() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && d.version === 1) return d; } catch { /* 없음 */ }
  return { version: 1, stamps: {} };
}
export function saveTown(d) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* 저장 실패 무시 */ } }
