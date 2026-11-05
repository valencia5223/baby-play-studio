// ═════════════════════════════════════════════════════════════════════════════
// 🚗 우리 동네 데이터: 동네(산본·안양)마다 장소·철길·길 그래프·버스 노선을 makeTown 으로 만든다
//  - 좌표는 경도/위도를 그 동네 지도 범위(townBus*.json 의 box) 안 0~1 (u: 서→동, v: 북→남) 로 바꿔 쓴다
//  - 길: 버스 노선 정류장 순서를 이은 선 (가까운 정류장(길 양쪽)은 한 점으로 합침) → 아빠차·걷기 길찾기에 씀
//  - 버스: 산본은 우리집 앞 정류장(한라2차아파트입구 + 수리산역), 안양은 장소 근처 정류장을 지나는 노선 (scripts/update-bus.mjs 로 받음)
//  - 옆 동네 오가기: 지하철(LINKS 의 노선 끝 = 옆 동네 쪽) · 아빠 차(GATES 의 지도 끝 길)
//  - 화면에는 동 번호 없이 '유나집'만 보인다
// ═════════════════════════════════════════════════════════════════════════════
import BUS_SANBON from './townBus.json';
import BUS_ANYANG from './townBus_anyang.json';
import BUS_UIWANG from './townBus_uiwang.json';
import { SPOT_LIST, ANYANG_SPOT_LIST, UIWANG_SPOT_LIST } from './townSpots.js';

export const BUS_STYLE = {
  '마을버스': { color: '#facc15', dark: '#ca8a04', label: '마을버스', text: '#713f12' },
  '일반형시내버스': { color: '#2563eb', dark: '#1e40af', label: '시내버스' },
  '직행좌석형시내버스': { color: '#ef4444', dark: '#b91c1c', label: '빨간 버스' }
};
export const busStyle = (type) => BUS_STYLE[type] || BUS_STYLE['일반형시내버스'];
// 음성용 번호: 11-2 → 11 다시 2, P9801(출근) → P9801
export const busSpoken = (name) => `${String(name).replace(/\(.*?\)/g, '').replace('-', ' 다시 ')}번`;
export const busLabel = (name) => String(name).replace(/\(.*?\)/g, '');
// 온 동네 좌표의 기준 = 산본 지도 범위. 안양 지도도 같은 크기라 겹치지 않고 바로 위에 붙는다
const WORLD_REF = BUS_SANBON.box;
export const LINE_COLOR = { 4: ['#38bdf8', '#0284c7'], 1: ['#1e3a8a', '#172554'] };

function makeTown(def) {
  const BUS = def.bus, BOX = BUS.box;
  const W_M = (BOX.x1 - BOX.x0) * 88400, H_M = (BOX.y1 - BOX.y0) * 111000;   // 지도 가로·세로 (m)
  const uv = (lon, lat) => ({ u: (lon - BOX.x0) / (BOX.x1 - BOX.x0), v: (BOX.y1 - lat) / (BOX.y1 - BOX.y0) });
  const meters = (a, b) => Math.hypot((a.u - b.u) * W_M, (a.v - b.v) * H_M);

  const TOWN_SPOTS = def.spots.map(sp => ({ ...sp, town: def.id }));
  const SPOT_BY_ID = Object.fromEntries(TOWN_SPOTS.map(s => [s.id, s]));
  TOWN_SPOTS.forEach(s => { s.r = uv(s.real[0], s.real[1]); s.a = { u: s.at[0], v: s.at[1] }; });

  // 전철: 4호선(하늘색), 1호선(남색)
  const RAILS = def.rails.map(rl => ({ id: rl.id, color: LINE_COLOR[rl.id][0], dark: LINE_COLOR[rl.id][1], pts: rl.pts.map(([x, y]) => uv(x, y)), stations: rl.stations, ends: rl.ends, arrive: rl.arrive }));

  // ── 길 그래프 ──
  const stopUV = {};
  Object.entries(BUS.stops).forEach(([id, [, x, y]]) => { stopUV[id] = uv(x, y); });
  const NODES = [];          // {u, v, n}
  const stopNode = {};
  Object.keys(BUS.stops).forEach(id => {
    const p = stopUV[id];
    let best = -1, bd = 55;
    NODES.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } });
    if (best < 0) { NODES.push({ u: p.u, v: p.v, n: 1 }); stopNode[id] = NODES.length - 1; }
    else { const nd = NODES[best]; nd.u = (nd.u * nd.n + p.u) / (nd.n + 1); nd.v = (nd.v * nd.n + p.v) / (nd.n + 1); nd.n += 1; stopNode[id] = best; }
  });
  const edgeSet = new Set();
  const EDGES = [];          // [a, b] 노드 번호
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
  function roadPath(fromUV, fromNode, toUV, toNode) {
    const ids = dijkstra(fromNode, toNode) || [fromNode, toNode];
    return [fromUV, ...ids.map(i => ({ u: NODES[i].u, v: NODES[i].v })), toUV];
  }

  // ── 버스 ──
  const HOME_STOPS = BUS.home;
  const stopName = (id) => (BUS.stops[id] ? BUS.stops[id][0] : '');
  const shortStop = (id) => stopName(id).split('.')[0].replace(/\(.*?\)/g, '');
  const nodeOfStop = (id) => stopNode[id];
  const ALL_ROUTES = BUS.routes;
  // 장소 근처 정류장 (지도 안 노선이 서는 것만)
  TOWN_SPOTS.forEach(sp => { sp.stops = (BUS.spotStops[sp.id] || []).filter(id => BUS.stops[id]); });
  // 한 점(노드)에 모인 정류장들 (길 양쪽)
  const NODE_STOPS = NODES.map(() => []);
  Object.keys(BUS.stops).forEach(id => NODE_STOPS[stopNode[id]].push(+id));
  const stopsAtNode = (n) => NODE_STOPS[n];

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
  function busBoard(fromStops, dest, pref = null) {
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
  const canBus = (fromStops, dest) => !!dest.stops.length && busBoard(fromStops, dest).some(x => x.ok);

  // ── 지하철 (동네 안: 4호선 역끼리) ──
  // 역끼리: 두 역이 같은 노선(4호선·1호선)에 있으면 그 철길로
  const METRO_STATIONS = [...new Set(RAILS.flatMap(rl => Object.keys(rl.stations)))];
  function metroPath(fromId, toId) {
    const rl = RAILS.find(r => r.stations[fromId] != null && r.stations[toId] != null);
    if (!rl) return null;
    const idx = rl.stations, a = idx[fromId], b = idx[toId], pts = rl.pts;
    if (a === b) return null;
    const seg = a < b ? pts.slice(a, b + 1) : pts.slice(b, a + 1).reverse();
    const stops = Object.keys(idx).filter(id => { const k = idx[id]; return (k > Math.min(a, b) && k < Math.max(a, b)); }).sort((x, y) => (a < b ? idx[x] - idx[y] : idx[y] - idx[x]));
    return { pts: seg, rail: rl, middle: stops.map(id => ({ id, at: idx[id] })), dir: a < b ? 1 : -1 };
  }
  // 옆 동네 이정표 자리 (누르면 그 동네로)
  const GATES = Object.fromEntries(Object.entries(def.gates).map(([to, [su, sv]]) => [to, { sign: { u: su, v: sv } }]));
  // 온 동네 지도(WORLD) 안에서 이 동네 지도의 자리: 산본 지도 크기를 1 로 본 왼쪽 위 모서리
  const off = { u: (BOX.x0 - WORLD_REF.x0) / (WORLD_REF.x1 - WORLD_REF.x0), v: (WORLD_REF.y1 - BOX.y1) / (WORLD_REF.y1 - WORLD_REF.y0) };
  // 배율: 이 동네 지도가 군포 지도보다 몇 배 넓은지 (의왕 1.32배, 나머지 1)
  const k = { u: (BOX.x1 - BOX.x0) / (WORLD_REF.x1 - WORLD_REF.x0), v: (BOX.y1 - BOX.y0) / (WORLD_REF.y1 - WORLD_REF.y0) };

  return { id: def.id, name: def.name, areas: def.areas || [], hills: def.hills, river: def.river ? def.river.map(([x, y]) => uv(x, y)) : null, home: def.home, carEntry: def.carEntry, off, k,
    BOX, uv, meters, TOWN_SPOTS, SPOT_BY_ID, RAILS, NODES, EDGES, roadPath, HOME_STOPS, shortStop, nodeOfStop, stopsAtNode, ALL_ROUTES, busBoard, canBus,
    METRO_STATIONS, metroPath, GATES };
}

// 산 언덕 (u, v, 반지름 u, 반지름 v)
const SANBON_HILLS = [[0.0, 0.06, 0.13, 0.13], [0.06, 0.22, 0.14, 0.15], [0.13, 0.38, 0.14, 0.14], [0.03, 0.5, 0.12, 0.16], [0.15, 0.6, 0.1, 0.11], [0.07, 0.8, 0.14, 0.15], [0.2, 0.97, 0.14, 0.09], [0.32, 1.02, 0.1, 0.06]];
const ANYANG_HILLS = [[0.0, 0.08, 0.1, 0.14], [0.06, -0.02, 0.12, 0.08], [0.98, 0.04, 0.07, 0.1]];

export const TOWNS = {
  sanbon: makeTown({
    id: 'sanbon', name: '군포', bus: BUS_SANBON, spots: SPOT_LIST, hills: SANBON_HILLS, home: 'home',
    areas: [{ name: '당동·당정동', at: [0.86, 0.975] }],   // 지도 위 동네 이름 (산본 옆 당동·당정동)
    rails: [
      // 4호선: 수리산역(2) → 산본역(4) → 금정역(6) → 안양 쪽(7)
      { id: 4, pts: [[126.9190, 37.3380], [126.9230, 37.3450], [126.9254, 37.3500], [126.9290, 37.3545], [126.9331, 37.3584], [126.9392, 37.3648], [126.9432, 37.3720], [126.9460, 37.3780]],
        stations: { surisanStn: 2, sanbonStn: 4, geumjeongStn: 6 }, ends: { anyang: 7 }, arrive: { anyang: 'sanbonStn' } },
      // 1호선: 금정역(3) → 안양 쪽(4)
      // 1호선: 의왕 쪽 → 당정역(1) → 군포역(2) → 금정역(4) → 안양 쪽(5)
      { id: 1, pts: [[126.9500, 37.3330], [126.9487, 37.3441], [126.9483, 37.3535], [126.9450, 37.3660], [126.9432, 37.3720], [126.9405, 37.3780]],
        stations: { dangjeongStn: 1, gunpoStn: 2, geumjeongStn: 4 }, ends: { anyang: 5 }, arrive: { anyang: 'geumjeongStn' } }
    ],
    gates: { anyang: [0.94, 0.06], uiwang: [0.965, 0.33] },   // '안양'(북동쪽 끝)·'의왕'(동쪽 끝) 이정표 자리
    carEntry: { anyang: 'home', uiwang: 'home' }     // 옆 동네에서 아빠 차로 오면 유나집으로
  }),
  anyang: makeTown({
    id: 'anyang', name: '안양', bus: BUS_ANYANG, spots: ANYANG_SPOT_LIST, hills: ANYANG_HILLS,
    // 안양천 (남쪽 → 북서쪽)
    river: [[126.9365, 37.3790], [126.9335, 37.3870], [126.9310, 37.3940], [126.9285, 37.4000], [126.9245, 37.4060], [126.9190, 37.4110]],
    rails: [
      // 4호선: 산본 쪽(0) → 범계역(2) → 평촌역(4) → 인덕원 쪽
      { id: 4, pts: [[126.9460, 37.3780], [126.9488, 37.3845], [126.9515, 37.3897], [126.9580, 37.3925], [126.9640, 37.3946], [126.9740, 37.3990]],
        stations: { bumgyeStn: 2, pyeongchonStn: 4 }, ends: { sanbon: 0 }, arrive: { sanbon: 'bumgyeStn' } },
      // 1호선: 산본(금정) 쪽(0) → 명학 → 안양역(3) → 서울 쪽
      { id: 1, pts: [[126.9405, 37.3780], [126.9353, 37.3846], [126.9290, 37.3930], [126.9228, 37.4010], [126.9165, 37.4110]],
        stations: { anyangStn: 3 }, ends: { sanbon: 0 }, arrive: { sanbon: 'anyangStn' } }
    ],
    gates: { sanbon: [0.38, 0.95], uiwang: [0.95, 0.93] },   // '군포'(남쪽 끝)·'의왕'(남동쪽 끝, 평촌 → 의왕 내손·포일동) 이정표 자리
    carEntry: { sanbon: 'pyeongchonPark', uiwang: 'pyeongchonPark' }   // 옆 동네에서 아빠 차로 오면 평촌 중앙공원으로
  }),
  uiwang: makeTown({
    id: 'uiwang', name: '의왕', bus: BUS_UIWANG, spots: UIWANG_SPOT_LIST,
    // 모락산(왼쪽 가운데)·청계산 쪽(오른쪽 위) 언덕
    hills: [[0.08, 0.4, 0.09, 0.13], [0.14, 0.5, 0.07, 0.09], [1.0, 0.0, 0.1, 0.12], [0.98, 0.95, 0.08, 0.1]],
    rails: [],
    gates: { sanbon: [0.04, 0.58], anyang: [0.07, 0.06] },   // '군포'(서쪽 끝)·'안양'(북서쪽 끝, 평촌 쪽) 이정표 자리
    carEntry: { sanbon: 'baegunLake', anyang: 'uiwangLotteMart' }   // 군포에서 오면 백운호수, 안양에서 오면 롯데마트로
  })
};
export const TOWN_LIST = Object.values(TOWNS);

// ── 온 동네 지도 (산본 + 안양): 옆 동네로 갈 때 두 동네 버스 길을 이어 실제 길을 따라간다 ──
//  좌표는 산본 지도 크기를 1 로 본 값 (u 서→동, v 북→남). 동네 지도 좌표 + 그 동네 off = 온 동네 좌표
function makeWorld(buses) {
  const sx = WORLD_REF.x1 - WORLD_REF.x0, sy = WORLD_REF.y1 - WORLD_REF.y0, W_M = sx * 88400, H_M = sy * 111000;
  const uv = (lon, lat) => ({ u: (lon - WORLD_REF.x0) / sx, v: (WORLD_REF.y1 - lat) / sy });
  const meters = (a, b) => Math.hypot((a.u - b.u) * W_M, (a.v - b.v) * H_M);
  const nodes = [], stopNode = {};
  buses.forEach(B => Object.entries(B.stops).forEach(([id, [, x, y]]) => {
    if (stopNode[id] != null) return;   // 두 동네 파일에 같이 있는 정류장 (맞닿는 곳)
    const p = uv(x, y);
    let best = -1, bd = 55;
    nodes.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } });
    if (best < 0) { nodes.push({ u: p.u, v: p.v, n: 1 }); stopNode[id] = nodes.length - 1; }
    else { const nd = nodes[best]; nd.u = (nd.u * nd.n + p.u) / (nd.n + 1); nd.v = (nd.v * nd.n + p.v) / (nd.n + 1); nd.n += 1; stopNode[id] = best; }
  }));
  const adj = nodes.map(() => []), seen = new Set();
  buses.forEach(B => B.routes.forEach(r => r.runs.forEach(run => {
    for (let i = 1; i < run.length; i++) {
      const a = stopNode[run[i - 1]], b = stopNode[run[i]], k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (a === b || seen.has(k) || meters(nodes[a], nodes[b]) >= 1300) continue;
      seen.add(k); const d = meters(nodes[a], nodes[b]); adj[a].push([b, d]); adj[b].push([a, d]);
    }
  })));
  const nearest = (p) => { let best = 0, bd = Infinity; nodes.forEach((nd, i) => { const d = meters(nd, p); if (d < bd) { bd = d; best = i; } }); return best; };
  function path(fromP, toP) {
    const from = nearest(fromP), to = nearest(toP), n = nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    dist[from] = 0;
    for (;;) {
      let u = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = true;
      adj[u].forEach(([w, d]) => { if (dist[u] + d < dist[w]) { dist[w] = dist[u] + d; prev[w] = u; } });
    }
    const ids = []; if (isFinite(dist[to])) for (let x = to; x >= 0; x = prev[x]) ids.unshift(x); else ids.push(from, to);
    return [fromP, ...ids.map(i => ({ u: nodes[i].u, v: nodes[i].v })), toP];
  }
  return { uv, meters, path };
}
export const WORLD = makeWorld([BUS_SANBON, BUS_ANYANG, BUS_UIWANG]);
// 동네 지도 좌표 ↔ 온 동네 좌표
export const toWorld = (town, p) => ({ u: town.off.u + p.u * town.k.u, v: town.off.v + p.v * town.k.v });
export const toLocal = (town, p) => ({ u: (p.u - town.off.u) / town.k.u, v: (p.v - town.off.v) / town.k.v });
// 동네 사이 지하철: 출발 역 → 철길 끝(맞닿는 곳) → 옆 동네 철길 → 내릴 역 (온 동네 좌표)
export function crossRail(fromTown, toTown, lineId, fromId) {
  const ra = fromTown.RAILS.find(r => r.id === lineId), rb = toTown.RAILS.find(r => r.id === lineId);
  if (!ra || !rb) return null;
  const a = ra.stations[fromId], ea = ra.ends[toTown.id], eb = rb.ends[fromTown.id], destId = rb.arrive[fromTown.id], b = rb.stations[destId];
  if (a == null || ea == null || eb == null || b == null) return null;
  const segA = (a < ea ? ra.pts.slice(a, ea + 1) : ra.pts.slice(ea, a + 1).reverse()).map(p => toWorld(fromTown, p));
  const segB = (eb < b ? rb.pts.slice(eb, b + 1) : rb.pts.slice(b, eb + 1).reverse()).map(p => toWorld(toTown, p));
  return { pts: [...segA, ...segB.slice(1)], destId, color: ra.color };
}
export const ALL_TOWN_SPOTS = TOWN_LIST.flatMap(t => t.TOWN_SPOTS);
// 옆 동네 (지금은 산본 ↔ 안양)
export const otherTown = (id) => (id === 'sanbon' ? TOWNS.anyang : TOWNS.sanbon);   // (예전 코드용) 이제 옆 동네는 이정표마다 다르다

// 산본 (음성 문장·예전 코드용)
export const TOWN_SPOTS = TOWNS.sanbon.TOWN_SPOTS;
export const SPOT_BY_ID = TOWNS.sanbon.SPOT_BY_ID;
export const ALL_ROUTES = TOWNS.sanbon.ALL_ROUTES;
export const METRO_STATIONS = TOWNS.sanbon.METRO_STATIONS;

// ── 저장: 도장 ──
const SAVE_KEY = 'bps_town_v1';
export function loadTown() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && d.version === 1) return d; } catch { /* 없음 */ }
  return { version: 1, stamps: {} };
}
export function saveTown(d) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* 저장 실패 무시 */ } }
