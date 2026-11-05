// ═════════════════════════════════════════════════════════════════════════════
// 🚗 우리 동네 데이터: 군포(산본·당동)·안양·의왕·과천을 하나로 이어진 지도(온 동네)로 합친다
//  - 좌표: 온 동네 좌표 (u 서→동, v 북→남). 군포(산본) 버스 지도 범위를 1×1 로 본다 → 화면 한 장 = 1×1
//  - 동네마다 버스 노선을 따로 받지만(scripts/update-bus.mjs, 지도 밖 600m 까지), 여기서 정류장·길·노선을 모두 합친다
//    · 길: 버스 노선 정류장 순서를 이은 선 (가까운 정류장(길 양쪽)은 한 점으로 합침) → 아빠 차·걷기 길찾기
//    · 노선: 동네마다 잘려 받은 구간을 같은 노선끼리 이어 붙인다 → 동네를 넘어가는 버스도 탄다
//  - 전철: 4호선·1호선을 노선 하나씩으로 (금정역에서 갈아타기)
//  - 장소 at(그림 자리)은 그 동네 버스 지도 범위 안 0~1 (복잡한 곳은 겹치지 않게 조금씩 벌림)
// ═════════════════════════════════════════════════════════════════════════════
import BUS_SANBON from './townBus.json';
import BUS_ANYANG from './townBus_anyang.json';
import BUS_UIWANG from './townBus_uiwang.json';
import BUS_GWACHEON from './townBus_gwacheon.json';
import BUS_GUNPOSOUTH from './townBus_gunposouth.json';
import BUS_SEOKSU from './townBus_seoksu.json';
import BUS_GWANGMYEONG from './townBus_gwangmyeong.json';
import { SPOT_LIST, ANYANG_SPOT_LIST, UIWANG_SPOT_LIST, GWACHEON_SPOT_LIST, GUNPO_SOUTH_SPOT_LIST, SEOKSU_SPOT_LIST, GWANGMYEONG_SPOT_LIST } from './townSpots.js';

export const BUS_STYLE = {
  '마을버스': { color: '#facc15', dark: '#ca8a04', label: '마을버스', text: '#713f12' },
  '일반형시내버스': { color: '#2563eb', dark: '#1e40af', label: '시내버스' },
  '직행좌석형시내버스': { color: '#ef4444', dark: '#b91c1c', label: '빨간 버스' }
};
export const busStyle = (type) => BUS_STYLE[type] || BUS_STYLE['일반형시내버스'];
// 음성용 번호: 11-2 → 11 다시 2, P9801(출근) → P9801
export const busSpoken = (name) => `${String(name).replace(/\(.*?\)/g, '').replace('-', ' 다시 ')}번`;
export const busLabel = (name) => String(name).replace(/\(.*?\)/g, '');
export const LINE_COLOR = { 4: ['#38bdf8', '#0284c7'], 1: ['#1e3a8a', '#172554'] };

// ── 온 동네 좌표 ──
const REF = BUS_SANBON.box, SX = REF.x1 - REF.x0, SY = REF.y1 - REF.y0;
export const wuv = (lon, lat) => ({ u: (lon - REF.x0) / SX, v: (REF.y1 - lat) / SY });
const W_M = SX * 88400, H_M = SY * 111000;
export const meters = (a, b) => Math.hypot((a.u - b.u) * W_M, (a.v - b.v) * H_M);
const BUSES = [BUS_SANBON, BUS_ANYANG, BUS_UIWANG, BUS_GWACHEON, BUS_GUNPOSOUTH, BUS_SEOKSU, BUS_GWANGMYEONG];

// ── 길: 모든 동네 정류장을 합친 점 + 버스 노선을 이은 선 ──
export const NODES = [];          // {u, v, n}
const stopNode = {}, STOP_NAME = {};
BUSES.forEach(B => Object.entries(B.stops).forEach(([id, [name, x, y]]) => {
  if (stopNode[id] != null) return;   // 두 동네 파일에 같이 있는 정류장 (맞닿는 곳)
  STOP_NAME[id] = name;
  const p = wuv(x, y);
  let best = -1, bd = 55;
  NODES.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } });
  if (best < 0) { NODES.push({ u: p.u, v: p.v, n: 1 }); stopNode[id] = NODES.length - 1; }
  else { const nd = NODES[best]; nd.u = (nd.u * nd.n + p.u) / (nd.n + 1); nd.v = (nd.v * nd.n + p.v) / (nd.n + 1); nd.n += 1; stopNode[id] = best; }
}));
// 같은 노선(id)끼리 동네마다 잘린 구간을 이어 붙인다 (겹치는 정류장으로)
function stitch(runs) {
  let list = runs.map(r => r.slice());
  for (let changed = true; changed;) {
    changed = false;
    outer: for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const a = list[i], b = list[j];
      if (b.every(id => a.includes(id)) && a.indexOf(b[0]) >= 0 && a.slice(a.indexOf(b[0]), a.indexOf(b[0]) + b.length).join() === b.join()) { list.splice(j, 1); changed = true; break outer; }
      const k = a.indexOf(b[0]);
      if (k > 0) {
        const tail = a.slice(k), n = Math.min(tail.length, b.length);
        if (tail.slice(0, n).join() === b.slice(0, n).join() && b.length > tail.length) { list[i] = a.slice(0, k).concat(b); list.splice(j, 1); changed = true; break outer; }
      }
    }
  }
  return list;
}
const routeMap = new Map();
BUSES.forEach(B => B.routes.forEach(r => {
  const o = routeMap.get(r.id) || { id: r.id, name: r.name, type: r.type, home: false, runs: [] };
  o.home = o.home || r.home; o.runs.push(...r.runs); routeMap.set(r.id, o);
}));
export const ROUTES = [...routeMap.values()].map(r => ({ ...r, runs: stitch(r.runs).filter(run => run.length >= 2) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));

export const EDGES = [];
const ADJ = NODES.map(() => []), edgeSeen = new Set();
ROUTES.forEach(r => r.runs.forEach(run => {
  for (let i = 1; i < run.length; i++) {
    const a = stopNode[run[i - 1]], b = stopNode[run[i]];
    if (a == null || b == null || a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`, d = meters(NODES[a], NODES[b]);
    if (edgeSeen.has(k) || d >= 1300) continue;
    edgeSeen.add(k); EDGES.push([a, b]); ADJ[a].push([b, d]); ADJ[b].push([a, d]);
  }
}));
export const nearestNode = (p) => { let best = 0, bd = Infinity; NODES.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } }); return best; };
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
// 한 점에서 다른 점까지 길을 따라가는 점 목록
export function roadPath(fromP, fromNode, toP, toNode) {
  const ids = dijkstra(fromNode, toNode) || [fromNode, toNode];
  return [fromP, ...ids.map(i => ({ u: NODES[i].u, v: NODES[i].v })), toP];
}

// ── 동네 ──
// 산 언덕 (그 동네 버스 지도 범위 안 u, v, 반지름 u, 반지름 v)
const TOWN_DEFS = [
  { id: 'sanbon', name: '군포', bus: BUS_SANBON, spots: SPOT_LIST, label: [0.4, 0.07],
    hills: [[0.0, 0.06, 0.13, 0.13], [0.06, 0.22, 0.14, 0.15], [0.13, 0.38, 0.14, 0.14], [0.03, 0.5, 0.12, 0.16], [0.15, 0.6, 0.1, 0.11], [0.07, 0.8, 0.14, 0.15], [0.2, 0.97, 0.14, 0.09], [0.32, 1.02, 0.1, 0.06]],
    areas: [{ name: '당동·당정동', at: [0.86, 0.975] }] },
  { id: 'anyang', name: '안양', bus: BUS_ANYANG, spots: ANYANG_SPOT_LIST, label: [0.45, 0.13],
    hills: [[0.0, 0.08, 0.1, 0.14], [0.06, -0.02, 0.12, 0.08]],
    // 안양천 (남쪽 → 북서쪽, 경도·위도)
    river: [[126.9365, 37.3790], [126.9335, 37.3870], [126.9310, 37.3940], [126.9285, 37.4000], [126.9245, 37.4060], [126.9190, 37.4110]] },
  { id: 'uiwang', name: '의왕', bus: BUS_UIWANG, spots: UIWANG_SPOT_LIST, label: [0.68, 0.34],
    // 모락산(왼쪽 위)·청계산(오른쪽 위)·오봉산 쪽 언덕
    hills: [[0.2, 0.28, 0.06, 0.06], [0.27, 0.33, 0.05, 0.05], [1.0, 0.05, 0.08, 0.07], [0.98, 0.6, 0.06, 0.08], [0.6, 0.85, 0.08, 0.06]] },
  { id: 'gwacheon', name: '과천', bus: BUS_GWACHEON, spots: GWACHEON_SPOT_LIST, label: [0.28, 0.25],
    // 관악산(왼쪽 위)·청계산(오른쪽) 언덕
    hills: [[0.0, 0.08, 0.14, 0.18], [0.1, 0.0, 0.12, 0.1], [1.0, 0.62, 0.1, 0.2], [0.96, 0.85, 0.1, 0.14]] },
  // 군포 남쪽 대야미·송부: 이름은 '군포', 동네 보기 버튼은 '대야미·송부'
  { id: 'gunposouth', name: '군포', button: '대야미·송부', bus: BUS_GUNPOSOUTH, spots: GUNPO_SOUTH_SPOT_LIST, label: null,
    hills: [[0.02, 0.15, 0.08, 0.2], [0.26, 0.0, 0.07, 0.1], [0.08, 0.85, 0.1, 0.15]],
    areas: [{ name: '대야미', at: [0.27, 0.66] }, { name: '송부동', at: [0.66, 0.84] }] },
  // 안양 북쪽 석수·관악: 이름은 '안양', 버튼은 '석수·관악'
  { id: 'seoksu', name: '안양', button: '석수·관악', bus: BUS_SEOKSU, spots: SEOKSU_SPOT_LIST, label: null,
    // 삼성산·관악산 쪽 언덕
    hills: [[0.85, 0.2, 0.15, 0.2], [0.95, 0.5, 0.1, 0.14], [0.62, 0.05, 0.1, 0.08]],
    areas: [{ name: '석수·관악', at: [0.6, 0.45] }] },
  { id: 'gwangmyeong', name: '광명', bus: BUS_GWANGMYEONG, spots: GWANGMYEONG_SPOT_LIST, label: [0.45, 0.72],
    // 가학산(광명동굴 뒤)·구름산 쪽 언덕
    hills: [[0.18, 0.22, 0.13, 0.14], [0.05, 0.5, 0.08, 0.14], [0.3, 0.02, 0.1, 0.06]] }
];
const boxToWorld = (box) => (p) => wuv(box.x0 + p[0] * (box.x1 - box.x0), box.y1 - p[1] * (box.y1 - box.y0));
// 온 동네의 모든 장소
export const ALL_TOWN_SPOTS = [];
export const SPOT_BY_ID = {};
const worldStops = Object.keys(stopNode).map(id => ({ id: +id, p: NODES[stopNode[id]] }));
export const TOWN_LIST = TOWN_DEFS.map(def => {
  const box = def.bus.box, toW = boxToWorld(box), kx = (box.x1 - box.x0) / SX, ky = (box.y1 - box.y0) / SY;
  const spots = def.spots.map(sp => {
    const o = { ...sp, town: def.id, r: wuv(sp.real[0], sp.real[1]), a: toW(sp.at) };
    o.node = nearestNode(o.r);
    // 근처 정류장: 받아 둔 장소 정류장 → 없으면 600m 안 가까운 정류장
    o.stops = (def.bus.spotStops[sp.id] || []).filter(id => stopNode[id] != null);
    if (!o.stops.length) o.stops = worldStops.map(s => ({ id: s.id, d: meters(s.p, o.r) })).filter(s => s.d < 600).sort((x, y) => x.d - y.d).slice(0, 4).map(s => s.id);
    return o;
  });
  spots.forEach(o => { ALL_TOWN_SPOTS.push(o); SPOT_BY_ID[o.id] = o; });
  return {
    id: def.id, name: def.name, button: def.button || def.name, box, label: def.label ? toW(def.label) : null,
    center: wuv((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2),
    hills: def.hills.map(([u, v, ru, rv]) => { const c = toW([u, v]); return [c.u, c.v, ru * kx, rv * ky]; }),
    river: def.river ? def.river.map(([x, y]) => wuv(x, y)) : null,
    areas: (def.areas || []).map(ar => ({ name: ar.name, p: toW(ar.at) })),
    TOWN_SPOTS: spots, SPOT_BY_ID
  };
});
export const TOWNS = Object.fromEntries(TOWN_LIST.map(t => [t.id, t]));
ALL_TOWN_SPOTS.forEach(s => { if (s.link) s.node = SPOT_BY_ID[s.link].node; });   // 수리산은 수리산역 쪽 산길로 들어간다
export const HOME_STOPS = BUS_SANBON.home;
export const HILLS = TOWN_LIST.flatMap(t => t.hills);
export const RIVERS = TOWN_LIST.filter(t => t.river).map(t => t.river);
// 이 점은 어느 동네? (동네 버스 지도 범위 가운데에 가장 가까운 곳)
export function townAt(p) {
  let best = TOWN_LIST[0], bd = Infinity;
  TOWN_LIST.forEach(t => {
    const a = wuv(t.box.x0, t.box.y1), b = wuv(t.box.x1, t.box.y0);
    const inside = p.u >= a.u && p.u <= b.u && p.v >= a.v && p.v <= b.v;
    const d = Math.hypot(p.u - (a.u + b.u) / 2, p.v - (a.v + b.v) / 2) - (inside ? 10 : 0);
    if (d < bd) { bd = d; best = t; }
  });
  return best;
}
// 온 동네 끝 (카메라가 못 나가게)
export const WORLD_BOUNDS = (() => {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  TOWN_LIST.forEach(t => { const a = wuv(t.box.x0, t.box.y1), b = wuv(t.box.x1, t.box.y0); u0 = Math.min(u0, a.u); v0 = Math.min(v0, a.v); u1 = Math.max(u1, b.u); v1 = Math.max(v1, b.v); });
  return { u0, v0, u1, v1 };
})();

// ── 버스 ──
export const stopName = (id) => STOP_NAME[id] || '';
export const shortStop = (id) => stopName(id).split('.')[0].replace(/\(.*?\)/g, '');
export const nodeOfStop = (id) => stopNode[id];
const NODE_STOPS = NODES.map(() => []);
Object.keys(stopNode).forEach(id => NODE_STOPS[stopNode[id]].push(+id));
export const stopsAtNode = (n) => NODE_STOPS[n];
const NODE_RUNS = NODES.map(() => []);
ROUTES.forEach((r, ri) => r.runs.forEach((run, ki) => run.forEach((id, pos) => { const n = stopNode[id]; if (n != null) NODE_RUNS[n].push([ri, ki, pos]); })));
const MAX_STOPS = 40;
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
  const ri0 = ROUTES.indexOf(r);
  r.runs.forEach(run => {
    run.forEach((id, i) => {
      if (!from.has(id)) return;
      for (let k = i + 1; k < run.length && k - i <= 24; k++) {
        if (from.has(run[k])) break;
        const nk = stopNode[run[k]];
        if (nk == null) continue;
        NODE_RUNS[nk].forEach(([rb, kb, m]) => {
          if (rb === ri0) return;
          const runB = ROUTES[rb].runs[kb];
          for (let j = m + 1; j < runB.length && j - m <= 24; j++) {
            if (!to.has(runB[j])) continue;
            const total = (k - i) + (j - m);
            if (!best || total < best.total) best = { total, route: r, stops: run.slice(i, k + 1), from: id, to: run[k], before: i > 0 ? run[i - 1] : null, after: run.slice(k + 1, k + 3), via: run[k], next: ROUTES[rb] };
            break;
          }
        });
      }
    });
  });
  return best;
}
// 정류장에 서는 모든 버스: 바로 가는 버스 → 갈아타는 버스 → 안 가는 버스 순
export function busBoard(fromStops, dest, pref = null) {
  if (!dest.stops.length || dest.stops.every(id => fromStops.includes(id))) return [];
  const to = new Set(dest.stops), from = new Set(fromStops.filter(id => !to.has(id)));
  const here = ROUTES.filter(r => r.runs.some(run => run.some(id => from.has(id)) && run.length > 1));
  const list = here.map(r => {
    const d = directTrip(r, from, to, pref);
    if (d) return { route: r, ok: true, trip: d, n: d.stops.length - 1 };
    return { route: r, ok: false, trip: null, n: 99 };
  });
  if (!list.some(x => x.ok)) list.forEach(x => { const tr = transferTrip(x.route, from, to); if (tr) { x.ok = true; x.trip = tr; x.n = 50 + tr.total; x.transfer = true; } });
  return list.sort((a, b) => a.n - b.n || a.route.name.localeCompare(b.route.name, 'ko', { numeric: true }));
}
export const canBus = (fromStops, dest) => !!dest.stops.length && busBoard(fromStops, dest).some(x => x.ok);

// ── 전철 (4호선·1호선, 경도·위도). 금정역에서 서로 갈아탄다 ──
export const LINES = [
  { id: 4, pts: [[126.9030, 37.3120], [126.9172, 37.3275], [126.9215, 37.3405], [126.9254, 37.3500], [126.9290, 37.3545], [126.9331, 37.3584], [126.9392, 37.3648], [126.9432, 37.3720], [126.9460, 37.3780],
    [126.9488, 37.3845], [126.9515, 37.3897], [126.9580, 37.3925], [126.9640, 37.3946], [126.9768, 37.4013], [126.9840, 37.4140], [126.9900, 37.4262], [126.9966, 37.4327], [127.0063, 37.4357], [127.0063, 37.4441], [127.0185, 37.4515]],
    stations: { daeyamiStn: 1, surisanStn: 3, sanbonStn: 5, geumjeongStn: 7, bumgyeStn: 10, pyeongchonStn: 12, indeogwonStn: 13, govStn: 15, gwacheonStn: 16, grandParkStn: 17, racecourseStn: 18 } },
  { id: 1, pts: [[126.9520, 37.2900], [126.9503, 37.3209], [126.9500, 37.3330], [126.9487, 37.3441], [126.9483, 37.3535], [126.9450, 37.3660], [126.9432, 37.3720], [126.9405, 37.3780],
    [126.9353, 37.3846], [126.9290, 37.3930], [126.9228, 37.4010], [126.9160, 37.4100], [126.9093, 37.4193], [126.9028, 37.4340], [126.8990, 37.4480]],
    stations: { uiwangStn: 1, dangjeongStn: 3, gunpoStn: 4, geumjeongStn: 6, anyangStn: 10, gwanakStn: 12, seoksuStn: 13 } }
].map(l => ({ ...l, color: LINE_COLOR[l.id][0], dark: LINE_COLOR[l.id][1], pts: l.pts.map(([x, y]) => wuv(x, y)) }));
const TRANSFER = 'geumjeongStn';
export const STATION_IDS = [...new Set(LINES.flatMap(l => Object.keys(l.stations)))];
// 한 노선 구간: 점 목록 + 사이에 서는 역
export function lineLeg(line, fromId, toId) {
  const a = line.stations[fromId], b = line.stations[toId];
  const pts = a < b ? line.pts.slice(a, b + 1) : line.pts.slice(b, a + 1).reverse();
  const mids = Object.keys(line.stations).filter(id => { const k = line.stations[id]; return k > Math.min(a, b) && k < Math.max(a, b); }).sort((x, y) => (a < b ? line.stations[x] - line.stations[y] : line.stations[y] - line.stations[x]));
  return { line, from: fromId, to: toId, pts, mids: mids.map(id => ({ id, at: line.pts[line.stations[id]] })) };
}
// 지하철로 가기: 가까운 역(1.5km 안)까지 걸어가 타고(필요하면 금정역에서 갈아타고), 내려서 걸어간다
export function metroPlan(fromSpot, toSpot) {
  const near = (sp) => (sp.kind === 'station' && STATION_IDS.includes(sp.id) ? [{ id: sp.id, d: 0 }]
    : STATION_IDS.map(id => ({ id, d: meters(SPOT_BY_ID[id].r, sp.r) })).filter(x => x.d < 1500).sort((x, y) => x.d - y.d).slice(0, 3));
  let best = null;
  near(fromSpot).forEach(o => near(toSpot).forEach(d => {
    if (o.id === d.id) return;
    LINES.forEach(A => {
      if (A.stations[o.id] == null) return;
      let legs = null;
      if (A.stations[d.id] != null) legs = [lineLeg(A, o.id, d.id)];
      else {
        const B = LINES.find(l => l !== A && l.stations[d.id] != null && l.stations[TRANSFER] != null);
        if (B && A.stations[TRANSFER] != null && o.id !== TRANSFER && d.id !== TRANSFER) legs = [lineLeg(A, o.id, TRANSFER), lineLeg(B, TRANSFER, d.id)];
      }
      if (!legs) return;
      const cost = (o.d + d.d) / 60 + legs.reduce((n, l) => n + l.pts.length, 0) + (legs.length - 1) * 4;
      if (!best || cost < best.cost) best = { cost, legs, from: SPOT_BY_ID[o.id], to: SPOT_BY_ID[d.id] };
    });
  }));
  return best;
}

// 음성 문장용 (예전 코드와 같은 이름): 동네마다 역·노선
TOWN_LIST.forEach(t => { t.METRO_STATIONS = t.TOWN_SPOTS.filter(s => STATION_IDS.includes(s.id)).map(s => s.id); t.ALL_ROUTES = ROUTES; });
export const TOWN_SPOTS = TOWNS.sanbon.TOWN_SPOTS;
export const ALL_ROUTES = ROUTES;
export const METRO_STATIONS = STATION_IDS;

// ── 저장: 도장·마지막 위치 ──
const SAVE_KEY = 'bps_town_v1';
export function loadTown() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && d.version === 1) return d; } catch { /* 없음 */ }
  return { version: 1, stamps: {} };
}
export function saveTown(d) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* 저장 실패 무시 */ } }
