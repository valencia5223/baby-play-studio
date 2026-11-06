// ═════════════════════════════════════════════════════════════════════════════
// 🚗 우리 동네 데이터: 군포(산본·당동)·안양·의왕·과천을 하나로 이어진 지도(온 동네)로 합친다
//  - 좌표: 온 동네 좌표 (u 서→동, v 북→남). 군포(산본) 버스 지도 범위를 1×1 로 본다 → 화면 한 장 = 1×1
//  - 동네마다 버스 노선을 따로 받지만(scripts/update-bus.mjs, 지도 밖 600m 까지), 여기서 정류장·길·노선을 모두 합친다
//    · 길: 버스 노선 정류장 순서를 이은 선 (가까운 정류장(길 양쪽)은 한 점으로 합침) → 아빠 차·걷기 길찾기
//    · 노선: 동네마다 잘려 받은 구간을 같은 노선끼리 이어 붙인다 → 동네를 넘어가는 버스도 탄다
//  - 전철: 4호선·1호선·2호선·서해선을 노선 하나씩으로 (금정역·사당역·초지역에서 갈아타기)
//  - 장소 at(그림 자리)은 그 동네 버스 지도 범위 안 0~1 (복잡한 곳은 겹치지 않게 조금씩 벌림)
// ═════════════════════════════════════════════════════════════════════════════
import BUS_SANBON from './townBus.json';
import BUS_ANYANG from './townBus_anyang.json';
import BUS_UIWANG from './townBus_uiwang.json';
import BUS_GWACHEON from './townBus_gwacheon.json';
import BUS_GUNPOSOUTH from './townBus_gunposouth.json';
import BUS_SEOKSU from './townBus_seoksu.json';
import BUS_GWANGMYEONG from './townBus_gwangmyeong.json';
import BUS_GEUMCHEON from './townBus_geumcheon.json';
import BUS_GWANAK from './townBus_gwanak.json';
import BUS_ANSAN from './townBus_ansan.json';
import BUS_SIHEUNG from './townBus_siheung.json';
import BUS_DAEBU from './townBus_daebu.json';
import BUS_BUCHEON from './townBus_bucheon.json';
import BUS_INCHEON from './townBus_incheon.json';
import BUS_INCHEON_WEST from './townBus_incheonwest.json';
import BUS_INCHEON_NORTH from './townBus_incheonnorth.json';
import BUS_GURO from './townBus_guro.json';
import BUS_GANGSEO from './townBus_gangseo.json';
import BUS_GIMPO from './townBus_gimpo.json';
import BUS_GANGHWA from './townBus_ganghwa.json';
import BUS_DONGJAK from './townBus_dongjak.json';
import BUS_SEOCHO from './townBus_seocho.json';
import BUS_GANGNAM from './townBus_gangnam.json';
import BUS_SONGPA from './townBus_songpa.json';
import BUS_SUWON from './townBus_suwon.json';
import BUS_SUJI from './townBus_suji.json';
import BUS_GIHEUNG from './townBus_giheung.json';
import { SPOT_LIST, ANYANG_SPOT_LIST, UIWANG_SPOT_LIST, GWACHEON_SPOT_LIST, GUNPO_SOUTH_SPOT_LIST, SEOKSU_SPOT_LIST, GWANGMYEONG_SPOT_LIST, GEUMCHEON_SPOT_LIST, GWANAK_SPOT_LIST, ANSAN_SPOT_LIST, SIHEUNG_SPOT_LIST, DAEBU_SPOT_LIST, BUCHEON_SPOT_LIST, INCHEON_SPOT_LIST, INCHEON_WEST_SPOT_LIST, INCHEON_NORTH_SPOT_LIST, GURO_SPOT_LIST, GANGSEO_SPOT_LIST, GIMPO_SPOT_LIST, GANGHWA_SPOT_LIST, DONGJAK_SPOT_LIST, SEOCHO_SPOT_LIST, GANGNAM_SPOT_LIST, SONGPA_SPOT_LIST, SUWON_SPOT_LIST, SUJI_SPOT_LIST, GIHEUNG_SPOT_LIST } from './townSpots.js';

export const BUS_STYLE = {
  '마을버스': { color: '#facc15', dark: '#ca8a04', label: '마을버스', text: '#713f12' },
  '일반형시내버스': { color: '#2563eb', dark: '#1e40af', label: '시내버스' },
  '직행좌석형시내버스': { color: '#ef4444', dark: '#b91c1c', label: '빨간 버스' },
  // 서울 버스 (서울시 버스 API 노선 종류)
  '서울간선': { color: '#2563eb', dark: '#1e40af', label: '파란 버스' },
  '서울지선': { color: '#22c55e', dark: '#15803d', label: '초록 버스' },
  '서울순환': { color: '#facc15', dark: '#ca8a04', label: '노란 버스', text: '#713f12' }
};
export const busStyle = (type) => BUS_STYLE[type] || BUS_STYLE['일반형시내버스'];
// 음성용 번호: 11-2 → 11 다시 2, P9801(출근) → P9801
export const busSpoken = (name) => `${String(name).replace(/\(.*?\)/g, '').replace('-', ' 다시 ')}번`;
export const busLabel = (name) => String(name).replace(/\(.*?\)/g, '');
export const LINE_COLOR = { 4: ['#38bdf8', '#0284c7'], 1: ['#1e3a8a', '#172554'], 2: ['#22c55e', '#15803d'], '서해': ['#a3e635', '#65a30d'], 7: ['#a3a32a', '#6b6b10'], '경인': ['#1e3a8a', '#172554'], '인천1': ['#7ca3d8', '#3f68a8'], '수인': ['#facc15', '#ca8a04'], '공항': ['#3b82f6', '#1d4ed8'], 5: ['#a855f7', '#7e22ce'], 9: ['#c8b273', '#8e7a3e'], '김포': ['#e0a800', '#9c7400'], 3: ['#f97316', '#c2410c'], 8: ['#ec4899', '#be185d'], '분당': ['#eab308', '#a16207'], '신분당': ['#dc2626', '#991b1b'] };
// 안내 문장용 노선 이름: 4 → 4호선, 서해 → 서해선
const LINE_NAME = { '경인': '1호선', '인천1': '인천 1호선', '공항': '공항철도', '김포': '김포골드라인', '분당': '수인분당선', '신분당': '신분당선' };
export const lineName = (id) => (LINE_NAME[id] ? LINE_NAME[id] : /^\d+$/.test(String(id)) ? `${id}호선` : `${id}선`);   // 경인선은 1호선 갈래

// ── 온 동네 좌표 ──
const REF = BUS_SANBON.box, SX = REF.x1 - REF.x0, SY = REF.y1 - REF.y0;
export const wuv = (lon, lat) => ({ u: (lon - REF.x0) / SX, v: (REF.y1 - lat) / SY });
const W_M = SX * 88400, H_M = SY * 111000;
export const meters = (a, b) => Math.hypot((a.u - b.u) * W_M, (a.v - b.v) * H_M);
const BUSES = [BUS_SANBON, BUS_ANYANG, BUS_UIWANG, BUS_GWACHEON, BUS_GUNPOSOUTH, BUS_SEOKSU, BUS_GWANGMYEONG, BUS_GEUMCHEON, BUS_GWANAK, BUS_ANSAN, BUS_SIHEUNG, BUS_DAEBU, BUS_BUCHEON, BUS_INCHEON, BUS_INCHEON_WEST, BUS_INCHEON_NORTH, BUS_GURO, BUS_GANGSEO, BUS_GIMPO, BUS_GANGHWA, BUS_DONGJAK, BUS_SEOCHO, BUS_GANGNAM, BUS_SONGPA, BUS_SUWON, BUS_SUJI, BUS_GIHEUNG];

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
    river: [[126.9365, 37.3790], [126.9335, 37.3870], [126.9310, 37.3940], [126.9285, 37.4000], [126.9245, 37.4060], [126.9190, 37.4110],
      [126.9010, 37.4250], [126.8920, 37.4400], [126.8860, 37.4560], [126.8800, 37.4720], [126.8760, 37.4850], [126.8730, 37.5000], [126.8715, 37.5150], [126.8745, 37.5300], [126.8800, 37.5430], [126.8850, 37.5530]] },
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
    hills: [[0.18, 0.22, 0.13, 0.14], [0.05, 0.5, 0.08, 0.14], [0.3, 0.02, 0.1, 0.06]] },
  // 서울 금천구 (석수 위): 버스는 서울시 버스 API
  { id: 'geumcheon', name: '서울 금천', button: '금천(서울)', bus: BUS_GEUMCHEON, spots: GEUMCHEON_SPOT_LIST, label: [0.7, 0.22],
    // 호암산·삼성산 쪽 언덕
    hills: [[0.95, 0.78, 0.1, 0.2], [1.0, 0.5, 0.08, 0.14], [0.78, 0.98, 0.1, 0.06]],
    areas: [{ name: '독산동', at: [0.4, 0.33] }, { name: '시흥동', at: [0.68, 0.68] }, { name: '가산동', at: [0.2, 0.05] }] },
  // 서울 관악구 (금천 동쪽): 2호선이 남부순환로를 따라 지나간다
  { id: 'gwanak', name: '서울 관악', button: '관악(서울)', bus: BUS_GWANAK, spots: GWANAK_SPOT_LIST, label: [0.66, 0.36],
    // 관악산(아래)·까치산·남태령 고개 언덕
    hills: [[0.52, 1.0, 0.22, 0.14], [0.3, 0.92, 0.12, 0.1], [0.75, 0.9, 0.12, 0.12], [1.0, 0.62, 0.08, 0.12], [0.62, 0.55, 0.06, 0.06]],
    areas: [{ name: '신림동', at: [0.1, 0.38] }, { name: '봉천동', at: [0.18, 0.24] }] },
  // 안산 (군포 대야미·송부 왼쪽). 4호선이 상록수 → 안산역 → 오이도로, 초지역에서 서해선
  { id: 'ansan', name: '안산', bus: BUS_ANSAN, spots: ANSAN_SPOT_LIST, label: [0.5, 0.86],
    // 노적봉·광덕산(가운데 아래)·수리산 서쪽 언덕
    hills: [[0.55, 0.98, 0.1, 0.12], [0.95, 0.12, 0.08, 0.14], [0.2, 0.95, 0.08, 0.08]],
    areas: [{ name: '고잔동', at: [0.58, 0.68] }, { name: '원곡동', at: [0.2, 0.52] }, { name: '사동', at: [0.72, 0.92] }] },
  // 서울 구로·영등포 (양천 목동·여의도). 한강이 위쪽으로 흐르고 안양천이 한강으로 들어간다
  { id: 'guro', name: '서울 구로·영등포', bus: BUS_GURO, spots: GURO_SPOT_LIST, label: [0.3, 0.62],
    hills: [],
    // 한강 (행주대교 → 여의도 → 잠실 → 암사). 바다처럼 넓은 물로 그린다. 선유도는 한강 속 섬
    sea: [[126.8116, 37.6092], [126.8255, 37.5993], [126.8434, 37.5884], [126.8616, 37.5763], [126.8786, 37.5643], [126.8930, 37.5546], [126.9074, 37.5489], [126.9224, 37.5429], [126.9377, 37.5368], [126.9504, 37.5304], [126.9614, 37.5219], [126.9702, 37.5175], [126.9801, 37.5151], [126.9910, 37.5170], [127.0005, 37.5218], [127.0088, 37.5290], [127.0181, 37.5382], [127.0341, 37.5415], [127.0481, 37.5420], [127.0607, 37.5373], [127.0717, 37.5318], [127.0818, 37.5275], [127.0904, 37.5288], [127.0991, 37.5355], [127.1081, 37.5435], [127.1186, 37.5514], [127.1328, 37.5590], [127.1584, 37.5651], [127.1616, 37.5569], [127.1372, 37.5510], [127.1254, 37.5446], [127.1159, 37.5375], [127.1069, 37.5295], [127.0956, 37.5212], [127.0802, 37.5189], [127.0663, 37.5242], [127.0553, 37.5297], [127.0459, 37.5336], [127.0359, 37.5329], [127.0239, 37.5308], [127.0172, 37.5234], [127.0075, 37.5152], [126.9950, 37.5090], [126.9799, 37.5065], [126.9658, 37.5095], [126.9546, 37.5151], [126.9436, 37.5236], [126.9323, 37.5292], [126.9176, 37.5351], [126.9026, 37.5411], [126.8870, 37.5474], [126.8714, 37.5577], [126.8544, 37.5697], [126.8366, 37.5816], [126.8185, 37.5927], [126.8044, 37.6028]],
    islands: [[[126.8955, 37.5440], [126.9025, 37.5445], [126.9030, 37.5480], [126.8960, 37.5482]]],
    // 한강을 건너는 대교 (그림만: 강 건너편은 아직 없다)
    bridges: [{ name: '행주대교', pts: [[126.8084, 37.5982], [126.8186, 37.6060]] }, { name: '방화대교', pts: [[126.8180, 37.5914], [126.8270, 37.6000]] }, { name: '마곡대교', pts: [[126.8277, 37.5855], [126.8383, 37.5931]] }, { name: '가양대교', pts: [[126.8545, 37.5679], [126.8655, 37.5752]] }, { name: '월드컵대교', pts: [[126.8707, 37.5565], [126.8813, 37.5641]] }, { name: '성산대교', pts: [[126.8839, 37.5478], [126.8941, 37.5555]] }, { name: '양화대교', pts: [[126.8978, 37.5416], [126.9062, 37.5508]] }, { name: '서강대교', pts: [[126.9223, 37.5318], [126.9307, 37.5410]] }, { name: '마포대교', pts: [[126.9314, 37.5282], [126.9406, 37.5368]] }, { name: '원효대교', pts: [[126.9421, 37.5229], [126.9499, 37.5321]] }, { name: '한강대교', pts: [[126.9546, 37.5136], [126.9624, 37.5229]] }, { name: '동작대교', pts: [[126.9793, 37.5053], [126.9807, 37.5164]] }, { name: '반포대교', pts: [[126.9986, 37.5093], [126.9934, 37.5197]] }, { name: '한남대교', pts: [[127.0171, 37.5214], [127.0079, 37.5301]] }, { name: '동호대교', pts: [[127.0249, 37.5298], [127.0161, 37.5382]] }, { name: '성수대교', pts: [[127.0355, 37.5315], [127.0345, 37.5429]] }, { name: '영동대교', pts: [[127.0538, 37.5289], [127.0622, 37.5381]] }, { name: '청담대교', pts: [[127.0648, 37.5234], [127.0732, 37.5326]] }, { name: '잠실대교', pts: [[127.0953, 37.5199], [127.0897, 37.5299]] }, { name: '올림픽대교', pts: [[127.1084, 37.5289], [127.0986, 37.5370]] }, { name: '천호대교', pts: [[127.1169, 37.5365], [127.1071, 37.5445]] }, { name: '광진교', pts: [[127.1217, 37.5401], [127.1123, 37.5484]] }],
    areas: [{ name: '구로', at: [0.38, 0.3] }, { name: '영등포', at: [0.62, 0.48] }, { name: '목동', at: [0.28, 0.85] }, { name: '여의도', at: [0.83, 0.42] }] },
  // 서울 강서 (김포공항·마곡·화곡)
  { id: 'gangseo', name: '서울 강서', bus: BUS_GANGSEO, spots: GANGSEO_SPOT_LIST, label: [0.55, 0.3],
    hills: [[0.32, 0.17, 0.035, 0.05], [0.69, 0.6, 0.022, 0.035]],   // 개화산·우장산
    areas: [{ name: '마곡', at: [0.6, 0.18] }, { name: '화곡동', at: [0.88, 0.75] }, { name: '방화동', at: [0.35, 0.38] }] },
  // 서울 동작 (여의도 오른쪽 아래, 한강 남쪽). 노들섬은 한강대교 가운데 섬
  { id: 'dongjak', name: '서울 동작', bus: BUS_DONGJAK, spots: DONGJAK_SPOT_LIST, label: [0.5, 0.86],
    hills: [[0.5, 0.66, 0.13, 0.08]],   // 서달산 (현충원 뒤)
    islands: [[[126.9520, 37.5165], [126.9600, 37.5160], [126.9640, 37.5178], [126.9600, 37.5196], [126.9525, 37.5192]]],
    areas: [{ name: '흑석동', at: [0.52, 0.45] }, { name: '상도동', at: [0.2, 0.62] }] },
  // 서울 서초 (반포·고속터미널·예술의전당)
  { id: 'seocho', name: '서울 서초', bus: BUS_SEOCHO, spots: SEOCHO_SPOT_LIST, label: [0.3, 0.72],
    hills: [[0.55, 0.85, 0.25, 0.06]],   // 우면산
    areas: [{ name: '반포', at: [0.55, 0.3] }, { name: '서초동', at: [0.75, 0.38] }, { name: '방배동', at: [0.15, 0.55] }] },
  // 서울 강남 (강남역·압구정·코엑스·대모산)
  { id: 'gangnam', name: '서울 강남', bus: BUS_GANGNAM, spots: GANGNAM_SPOT_LIST, label: [0.4, 0.68],
    hills: [[0.85, 0.9, 0.15, 0.05], [0.56, 0.95, 0.1, 0.04]],   // 대모산·구룡산
    areas: [{ name: '역삼동', at: [0.25, 0.4] }, { name: '대치동', at: [0.62, 0.55] }, { name: '청담동', at: [0.5, 0.18] }, { name: '압구정', at: [0.2, 0.1] }] },
  // 서울 송파 (잠실·올림픽공원·가락시장)
  { id: 'songpa', name: '서울 송파', bus: BUS_SONGPA, spots: SONGPA_SPOT_LIST, label: [0.72, 0.62],
    hills: [],
    areas: [{ name: '잠실', at: [0.1, 0.25] }, { name: '방이동', at: [0.52, 0.45] }, { name: '문정동', at: [0.62, 0.85] }] },
  // 수원 (의왕 아래). 팔달산 둘레에 수원 화성
  { id: 'suwon', name: '수원', bus: BUS_SUWON, spots: SUWON_SPOT_LIST, label: [0.55, 0.62],
    hills: [[0.5, 0.33, 0.04, 0.06]],   // 팔달산
    areas: [{ name: '광교', at: [0.88, 0.12] }, { name: '영통', at: [0.85, 0.75] }, { name: '팔달', at: [0.35, 0.5] }] },
  // 용인 수지 (의왕 동쪽). 신분당선
  { id: 'suji', name: '용인 수지', bus: BUS_SUJI, spots: SUJI_SPOT_LIST, label: [0.45, 0.45],
    hills: [[0.02, 0.15, 0.08, 0.12], [0.35, 0.05, 0.08, 0.05]],   // 광교산
    areas: [{ name: '죽전', at: [0.8, 0.85] }, { name: '상현동', at: [0.3, 0.8] }, { name: '풍덕천동', at: [0.6, 0.6] }] },
  // 용인 기흥 (수원 동쪽). 용인 할비집(언남동)·민속촌·에버랜드
  { id: 'giheung', name: '용인 기흥', bus: BUS_GIHEUNG, spots: GIHEUNG_SPOT_LIST, label: [0.5, 0.62],
    hills: [[0.75, 0.75, 0.06, 0.12], [0.95, 0.35, 0.05, 0.1]],   // 석성산·에버랜드 뒷산
    areas: [{ name: '언남동', at: [0.48, 0.05] }, { name: '동백', at: [0.68, 0.35] }, { name: '신갈', at: [0.25, 0.4] }] },
  // 김포 (한강 하구). 북쪽·서쪽은 논밭이 많은 시골
  { id: 'gimpo', name: '김포', bus: BUS_GIMPO, spots: GIMPO_SPOT_LIST, label: [0.45, 0.42],
    hills: [[0.07, 0.2, 0.025, 0.04], [0.36, 0.6, 0.03, 0.04], [0.55, 0.3, 0.03, 0.05]],   // 문수산·가현산 쪽·운유산
    // 바다·한강 하구: 강화 서쪽 바다 → 북쪽 하구 → 김포 동쪽 한강을 따라 행주대교까지
    sea: [[126.250, 37.600], [126.250, 37.860], [126.700, 37.860], [126.700, 37.755], [126.722, 37.722], [126.742, 37.692], [126.762, 37.664], [126.785, 37.640], [126.808, 37.618], [126.820, 37.608],
      [126.808, 37.598], [126.792, 37.611], [126.770, 37.632], [126.748, 37.656], [126.728, 37.684], [126.705, 37.712], [126.672, 37.737], [126.632, 37.757], [126.592, 37.767], [126.560, 37.757],
      [126.546, 37.732], [126.541, 37.700], [126.545, 37.670], [126.553, 37.648], [126.578, 37.622], [126.603, 37.600]],
    // 강화대교·초지대교
    dams: [[[126.547, 37.729], [126.538, 37.730], [126.528, 37.731]], [[126.553, 37.647], [126.535, 37.646], [126.516, 37.645]]],
    bridges: [{ name: '일산대교', pts: [[126.7380, 37.6675], [126.7566, 37.6741]] }, { name: '김포대교', pts: [[126.7800, 37.6205], [126.7980, 37.6295]] }],
    areas: [{ name: '한강신도시', at: [0.48, 0.38] }, { name: '고촌', at: [0.88, 0.95] }, { name: '한강 하구', at: [0.6, 0.97] }] },
  // 강화도 (섬). 석모도도 옆에
  { id: 'ganghwa', name: '강화도', bus: BUS_GANGHWA, spots: GANGHWA_SPOT_LIST, label: [0.62, 0.45],
    hills: [[0.46, 0.84, 0.05, 0.05], [0.45, 0.33, 0.06, 0.05], [0.58, 0.55, 0.05, 0.05]],   // 마니산·고려산·혈구산
    islands: [
      [[126.522, 37.778], [126.536, 37.745], [126.531, 37.715], [126.522, 37.690], [126.516, 37.660], [126.512, 37.630], [126.500, 37.600], [126.480, 37.586], [126.450, 37.584], [126.415, 37.590],
        [126.385, 37.603], [126.360, 37.625], [126.352, 37.655], [126.366, 37.685], [126.360, 37.715], [126.372, 37.750], [126.400, 37.778], [126.440, 37.793], [126.485, 37.792]],
      // 석모도
      [[126.330, 37.650], [126.345, 37.668], [126.350, 37.700], [126.338, 37.728], [126.318, 37.722], [126.305, 37.690], [126.310, 37.660]]],
    areas: [{ name: '강화읍', at: [0.72, 0.25] }, { name: '화도면', at: [0.5, 0.95] }, { name: '석모도', at: [0.05, 0.45] }, { name: '바다', at: [0.15, 0.95] }] },
  // 인천 바닷가 (송도·월미도·영종도). 바다 + 영종도·무의도 + 인천대교·영종대교
  { id: 'incheonwest', name: '인천 바닷가', bus: BUS_INCHEON_WEST, spots: INCHEON_WEST_SPOT_LIST, label: [0.62, 0.6],
    hills: [[0.58, 0.22, 0.03, 0.04]],   // 영종도 백운산
    areas: [{ name: '영종도', at: [0.45, 0.2] }, { name: '송도', at: [0.95, 0.58] }, { name: '서해 바다', at: [0.3, 0.75] }, { name: '중구', at: [0.95, 0.2] }],
    // 바다: 인천 해안선(검단 → 청라 → 북항 → 월미도 → 연안부두 → 송도) 서쪽 전부
    sea: [[126.300, 37.300], [126.300, 37.640], [126.605, 37.640], [126.602, 37.600], [126.598, 37.575], [126.612, 37.560], [126.603, 37.540], [126.610, 37.520], [126.614, 37.505],
      [126.600, 37.492], [126.588, 37.486], [126.584, 37.472], [126.591, 37.462], [126.589, 37.455], [126.597, 37.443], [126.611, 37.433], [126.611, 37.416], [126.601, 37.401],
      [126.605, 37.386], [126.620, 37.373], [126.645, 37.366], [126.660, 37.362], [126.660, 37.300]],
    islands: [
      // 영종도 (인천공항·용유도까지 이어진 모양)
      [[126.360, 37.448], [126.375, 37.470], [126.400, 37.495], [126.440, 37.506], [126.480, 37.520], [126.520, 37.526], [126.555, 37.516], [126.585, 37.501], [126.590, 37.489],
        [126.576, 37.475], [126.566, 37.455], [126.556, 37.432], [126.530, 37.424], [126.490, 37.417], [126.450, 37.419], [126.410, 37.424], [126.378, 37.432]],
      // 무의도
      [[126.408, 37.412], [126.430, 37.407], [126.440, 37.392], [126.425, 37.377], [126.404, 37.386]]],
    // 인천대교(송도 → 영종도)·영종대교(청라 → 영종도)는 공항까지 이어지는 고속도로로, 공항 → 을왕리 길
    dams: [[[126.612, 37.392], [126.595, 37.400], [126.575, 37.412], [126.556, 37.430], [126.530, 37.440], [126.490, 37.446], [126.4525, 37.4495]],
      [[126.612, 37.548], [126.592, 37.538], [126.572, 37.526], [126.552, 37.518], [126.520, 37.502], [126.490, 37.486], [126.466, 37.466], [126.4525, 37.4495]],
      [[126.4525, 37.4495], [126.420, 37.453], [126.392, 37.449], [126.376, 37.4475]]] },
  // 인천 북쪽 (계양·서구·청라 ~ 김포공항). 경인아라뱃길이 동서로 흐른다
  { id: 'incheonnorth', name: '인천 계양·서구', bus: BUS_INCHEON_NORTH, spots: INCHEON_NORTH_SPOT_LIST, label: [0.3, 0.3],
    hills: [[0.54, 0.86, 0.04, 0.1], [0.25, 0.35, 0.04, 0.08]],   // 계양산·검단 쪽 산
    river: [[126.600, 37.566], [126.625, 37.566], [126.660, 37.569], [126.700, 37.575], [126.740, 37.578], [126.775, 37.576], [126.810, 37.573]],
    areas: [{ name: '계양', at: [0.75, 0.75] }, { name: '서구', at: [0.36, 0.55] }, { name: '청라', at: [0.12, 0.85] }, { name: '검단', at: [0.35, 0.12] }] },
  // 인천 부평·남동 (부천·시흥 왼쪽). 소래포구 앞으로 바닷물이 들어오는 갯골(장수천)
  { id: 'incheon', name: '인천', bus: BUS_INCHEON, spots: INCHEON_SPOT_LIST, label: [0.38, 0.4],
    // 원적산(부평 서쪽)·만월산(부평과 구월 사이)
    hills: [[0.5, 0.15, 0.07, 0.035], [0.84, 0.42, 0.06, 0.035]],
    river: [[126.705, 37.389], [126.722, 37.394], [126.733, 37.398], [126.741, 37.406], [126.747, 37.418], [126.751, 37.435], [126.753, 37.452]],
    areas: [{ name: '부평', at: [0.68, 0.24] }, { name: '구월동', at: [0.72, 0.62] }, { name: '간석동', at: [0.45, 0.38] }, { name: '논현동', at: [0.62, 0.9] }] },
  // 부천 (시흥 위, 광명 왼쪽). 경인선(1호선)이 동서로, 7호선이 위쪽으로 지나간다
  { id: 'bucheon', name: '부천', bus: BUS_BUCHEON, spots: BUCHEON_SPOT_LIST, label: [0.3, 0.72],
    // 성주산(부천역 남쪽)·거마산(송내 남쪽)·춘덕산(식물원 동쪽)
    hills: [[0.33, 0.9, 0.07, 0.06], [0.06, 0.82, 0.05, 0.06], [0.86, 0.2, 0.05, 0.06]],
    areas: [{ name: '중동', at: [0.33, 0.52] }, { name: '상동', at: [0.18, 0.22] }, { name: '소사', at: [0.6, 0.76] }, { name: '오정', at: [0.48, 0.1] }] },
  // 시흥 (안산 위, 광명 왼쪽). 서해선이 남북으로 지나간다
  { id: 'siheung', name: '시흥', bus: BUS_SIHEUNG, spots: SIHEUNG_SPOT_LIST, label: [0.32, 0.6],
    // 소래산(신천역 동쪽)·군자봉(능곡 남쪽)·수암봉·수리산 서쪽(오른쪽 끝, 군포와 사이)
    hills: [[0.6, 0.05, 0.035, 0.04], [0.76, 0.86, 0.035, 0.04], [1.12, 0.62, 0.12, 0.16], [1.2, 0.85, 0.12, 0.14], [1.15, 0.35, 0.1, 0.12]],
    areas: [{ name: '정왕동', at: [0.12, 0.92] }, { name: '능곡동', at: [0.72, 0.52] }, { name: '신천동', at: [0.38, 0.2] }, { name: '은계', at: [0.65, 0.06] }] },
  // 대부도·오이도 바닷가 (시흥·안산 서쪽). 대부분 바다(서해·시화호), 시화방조제 길로 대부도 섬에 간다
  { id: 'daebu', name: '대부도', bus: BUS_DAEBU, spots: DAEBU_SPOT_LIST, label: [0.3, 0.57],
    // 구봉도·황금산·대부도 남쪽 언덕
    hills: [[0.07, 0.5, 0.025, 0.025], [0.36, 0.69, 0.03, 0.03], [0.52, 0.86, 0.025, 0.03]],
    areas: [{ name: '오이도', at: [0.72, 0.12] }, { name: '시화호', at: [0.7, 0.48] }, { name: '시화방조제', at: [0.44, 0.22] }, { name: '서해 바다', at: [0.12, 0.2] }],
    // 바다 (경도·위도): 서해 + 시화호. 방조제는 그 위에 길로 그린다
    sea: [[126.500, 37.376], [126.713, 37.376], [126.717, 37.362], [126.703, 37.353], [126.686, 37.348], [126.684, 37.340], [126.698, 37.334], [126.718, 37.324],
      [126.742, 37.308], [126.768, 37.293], [126.800, 37.289], [126.832, 37.291], [126.828, 37.281], [126.800, 37.276], [126.750, 37.268], [126.705, 37.262],
      [126.688, 37.245], [126.682, 37.200], [126.678, 37.150], [126.500, 37.150]],
    // 섬: 대부도 (구봉도·탄도까지 이어진 모양)
    islands: [[[126.588, 37.300], [126.600, 37.292], [126.615, 37.282], [126.628, 37.268], [126.645, 37.255], [126.668, 37.243], [126.672, 37.225], [126.660, 37.205],
      [126.652, 37.188], [126.636, 37.186], [126.620, 37.200], [126.598, 37.208], [126.582, 37.222], [126.570, 37.240], [126.560, 37.258], [126.548, 37.272],
      [126.535, 37.282], [126.540, 37.290], [126.560, 37.288], [126.575, 37.296]],
      // 누에섬 (탄도항 앞 작은 섬)
      [[126.628, 37.178], [126.636, 37.176], [126.638, 37.170], [126.630, 37.168], [126.624, 37.172]]],
    // 시화방조제: 오이도 → 조력발전소 → 대부도 방아머리
    dams: [[[126.687, 37.338], [126.650, 37.323], [126.608, 37.311], [126.590, 37.299], [126.583, 37.293]]] }
];
const boxToWorld = (box) => (p) => wuv(box.x0 + p[0] * (box.x1 - box.x0), box.y1 - p[1] * (box.y1 - box.y0));
// 온 동네의 모든 장소
export const ALL_TOWN_SPOTS = [];
export const SPOT_BY_ID = {};
const WALK_STOP_M = 350;
const worldStops = Object.keys(stopNode).map(id => ({ id: +id, p: NODES[stopNode[id]] }));
export const TOWN_LIST = TOWN_DEFS.map(def => {
  const box = def.bus.box, toW = boxToWorld(box), kx = (box.x1 - box.x0) / SX, ky = (box.y1 - box.y0) / SY;
  const spots = def.spots.map(sp => {
    const o = { ...sp, town: def.id, r: wuv(sp.real[0], sp.real[1]), a: toW(sp.at) };
    o.node = nearestNode(o.r);
    // 근처 정류장: 받아 둔 장소 정류장 → 없으면 600m 안 가까운 정류장
    o.stops = (def.bus.spotStops[sp.id] || []).filter(id => stopNode[id] != null);
    if (!o.stops.length) o.stops = worldStops.map(s => ({ id: s.id, d: meters(s.p, o.r) })).filter(s => s.d < 600).sort((x, y) => x.d - y.d).slice(0, 4).map(s => s.id);
    // 큰길까지 조금 걸어 나가면 타는 정류장(350m 안)도 같이: 바로 가는 버스가 더 많아진다
    const walkable = worldStops.map(s => ({ id: s.id, d: meters(s.p, o.r) })).filter(s => s.d < WALK_STOP_M).sort((x, y) => x.d - y.d).map(s => s.id);
    o.stops = [...new Set([...o.stops, ...walkable])];
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
// 바다·섬·방조제 (온 동네 좌표)
const toWorldPts = (l) => l.map(([x, y]) => wuv(x, y));
const SEA_DEFS = TOWN_DEFS.filter(d => d.sea);
export const SEAS = SEA_DEFS.map(d => toWorldPts(d.sea));
export const ISLANDS = TOWN_DEFS.flatMap(d => (d.islands || []).map(toWorldPts));   // 바다는 옆 동네에 있어도 섬은 이 동네에
export const DAMS = TOWN_DEFS.flatMap(d => (d.dams || []).map(toWorldPts));
export const BRIDGES = TOWN_DEFS.flatMap(d => (d.bridges || []).map(b => ({ name: b.name, pts: toWorldPts(b.pts) })));
// 다리·방조제 위 길: 섬으로 가는 버스는 정류장 사이가 멀어(1.3km 넘음) 길이 끊기니, 그림대로 잇고 양 끝을 가까운 길에 붙인다
DAMS.forEach(dm => {
  const ids = dm.map(p => { NODES.push({ u: p.u, v: p.v, n: 0 }); ADJ.push([]); return NODES.length - 1; });
  const link = (a, b) => { const d = meters(NODES[a], NODES[b]); EDGES.push([a, b]); ADJ[a].push([b, d]); ADJ[b].push([a, d]); };
  for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i]);
  [ids[0], ids[ids.length - 1]].forEach(e => {
    let best = -1, bd = 2500;
    NODES.forEach((nd, i) => { if (nd.n === 0) return; const d = meters(nd, NODES[e]); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) link(e, best);
  });
});
// 길이 끊긴 덩어리 잇기: 고속도로를 달리는 버스는 정류장 사이가 멀어 위에서 뺐는데, 그것 때문에 동네끼리 길이 끊기면
// 그 긴 구간(6km 안)을 길로 쓴다. 이미 이어진 곳에는 넣지 않는다 (산을 가로지르는 직선 길이 생기지 않게)
{
  const par = NODES.map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  EDGES.forEach(([a, b]) => { par[find(a)] = find(b); });
  const longs = [];
  ROUTES.forEach(r => r.runs.forEach(run => { for (let i = 1; i < run.length; i++) { const a = stopNode[run[i - 1]], b = stopNode[run[i]]; if (a != null && b != null && a !== b) { const d = meters(NODES[a], NODES[b]); if (d >= 1300 && d < 6000) longs.push([d, a, b]); } } }));
  longs.sort((x, y) => x[0] - y[0]).forEach(([d, a, b]) => {
    if (find(a) === find(b)) return;
    par[find(a)] = find(b); EDGES.push([a, b]); ADJ[a].push([b, d]); ADJ[b].push([a, d]);
  });
  // 장소가 붙은 길 점이 외딴 정류장이면 가장 큰 덩어리의 가까운 점으로 옮긴다
  const size = {}; NODES.forEach((_, i) => { const k = find(i); size[k] = (size[k] || 0) + 1; });
  const big = +Object.keys(size).sort((x, y) => size[y] - size[x])[0];
  ALL_TOWN_SPOTS.forEach(sp => {
    if (find(sp.node) === big) return;
    let best = sp.node, bd = Infinity;
    NODES.forEach((nd, i) => { if (find(i) !== big || nd.n === 0) return; const d = meters(nd, sp.link ? SPOT_BY_ID[sp.link].r : sp.r); if (d < bd) { bd = d; best = i; } });
    sp.node = best;
  });
}
const inPoly = (p, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.v > p.v) !== (b.v > p.v) && p.u < (b.u - a.u) * (p.v - a.v) / (b.v - a.v) + a.u) inside = !inside;
  }
  return inside;
};
// 바다 위인가 (섬은 땅)
export const inSea = (p) => SEAS.some(sp => inPoly(p, sp)) && !ISLANDS.some(il => inPoly(p, il));
// 시골 (아파트 대신 나무·작은 집): 섬, 그리고 안산 남쪽 시화호 아래(화성 송산 쪽)
const RURAL_V = wuv(0, 37.285).v, RURAL_U = wuv(126.83, 0).u, RURAL2_V = wuv(0, 37.668).v, RURAL2_U = wuv(126.665, 0).u;
export const isRural = (p) => ISLANDS.some(il => inPoly(p, il)) || (p.v > RURAL_V && p.u < RURAL_U) || (p.v < RURAL2_V && p.u < RURAL2_U);
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

// ── 전철 (4호선·1호선·2호선, 경도·위도). 금정역(1↔4)·사당역(2↔4)에서 갈아탄다 ──
export const LINES = [
  { id: 4, pts: [[126.7375, 37.3618], [126.7420, 37.3515], [126.7675, 37.3379], [126.7893, 37.3279], [126.8070, 37.3213], [126.8240, 37.3166], [126.8389, 37.3158], [126.8535, 37.3095],
    [126.8660, 37.3025], [126.9050, 37.3118], [126.9172, 37.3275], [126.9215, 37.3405], [126.9254, 37.3500], [126.9290, 37.3545], [126.9331, 37.3584], [126.9392, 37.3648], [126.9432, 37.3720], [126.9460, 37.3780],
    [126.9488, 37.3845], [126.9515, 37.3897], [126.9580, 37.3925], [126.9640, 37.3946], [126.9768, 37.4013], [126.9840, 37.4140], [126.9900, 37.4262], [126.9966, 37.4327], [127.0063, 37.4357], [127.0063, 37.4441], [127.0185, 37.4515],
    [127.0105, 37.4605], [126.9880, 37.4656], [126.9817, 37.4766], [126.9817, 37.4867], [126.9800, 37.5027]],
    stations: { oidoStn: 0, jeongwangStn: 1, ansanStn: 3, chojiStn: 4, ansanCenterStn: 6, handaeStn: 7, sangroksuStn: 8, daeyamiStn: 10, surisanStn: 12, sanbonStn: 14, geumjeongStn: 16, bumgyeStn: 19, pyeongchonStn: 21, indeogwonStn: 22, govStn: 24, gwacheonStn: 25, grandParkStn: 26, racecourseStn: 27, namtaeryeongStn: 30, sadangStn: 31, isuStn: 32, dongjakStn: 33 } },
  { id: 1, pts: [[127.0085, 37.2450], [127.0016, 37.2659], [126.9900, 37.2843], [126.9711, 37.3000], [126.9503, 37.3209], [126.9500, 37.3330], [126.9487, 37.3441], [126.9483, 37.3535], [126.9450, 37.3660], [126.9432, 37.3720], [126.9405, 37.3780],
    [126.9353, 37.3846], [126.9290, 37.3930], [126.9228, 37.4010], [126.9160, 37.4100], [126.9093, 37.4193], [126.9028, 37.4340], [126.8990, 37.4460], [126.8946, 37.4560], [126.8895, 37.4662], [126.8826, 37.4810], [126.8790, 37.4950], [126.8818, 37.5030], [126.8913, 37.5088], [126.9071, 37.5155], [126.9175, 37.5175], [126.9265, 37.5133], [126.9425, 37.5135]],
    stations: { suwonStn: 1, uiwangStn: 4, dangjeongStn: 6, gunpoStn: 7, geumjeongStn: 9, anyangStn: 13, gwanakStn: 15, seoksuStn: 16, geumcheonStn: 18, doksanStn: 19, gasanStn: 20, guroStn: 22, sindorimStn: 23, yeongdeungpoStn: 24, noryangjinStn: 27 } },
  // 2호선 (신대방 쪽 → 신림 → 봉천 → 서울대입구 → 낙성대 → 사당 → 방배 쪽)
  { id: 2, pts: [[126.8467, 37.5318], [126.8565, 37.5200], [126.8655, 37.5125], [126.8830, 37.5145], [126.8913, 37.5088], [126.8958, 37.4925], [126.9016, 37.4852], [126.9130, 37.4875], [126.9296, 37.4846], [126.9416, 37.4825], [126.9527, 37.4812], [126.9637, 37.4770], [126.9817, 37.4766], [126.9970, 37.4815],
    [127.0076, 37.4918], [127.0141, 37.4934], [127.0276, 37.4979], [127.0365, 37.5006], [127.0490, 37.5045], [127.0631, 37.5089], [127.0736, 37.5110], [127.0866, 37.5115], [127.1000, 37.5133], [127.1035, 37.5206]],
    stations: { kkachisanStn: 0, sindorimStn: 4, sillimStn: 8, bongcheonStn: 9, snuStn: 10, nakseongdaeStn: 11, sadangStn: 12, gyodaeStn: 15, gangnamStn: 16, samsungStn: 19, jamsilStadium: 20, lotteWorld: 22 } },
  // 서해선 (부천 소사 쪽 → 시흥대야 → 신천 → 신현 → 시흥시청 → 시흥능곡 → 달미 → 선부 → 초지 → 원시)
  { id: '서해', pts: [[126.7953, 37.4827], [126.7954, 37.4700], [126.7940, 37.4508], [126.7880, 37.4391], [126.7879, 37.4081], [126.8062, 37.3820], [126.8080, 37.3698], [126.8098, 37.3496], [126.8100, 37.3350], [126.8070, 37.3213], [126.7863, 37.3017]],
    stations: { sosaStn: 0, daeyaStn: 2, sincheonStn: 3, siheungHallStn: 5, chojiStn: 9 } },
  // 1호선 경인선 갈래 (개봉 → 오류동 → 온수 → 역곡 → 소사 → 부천 → 중동 → 송내 → 부개). 소사(서해선)·온수(7호선)에서 갈아탄다
  { id: '경인', pts: [[126.8818, 37.5030], [126.8705, 37.4965], [126.8580, 37.4945], [126.8395, 37.4946], [126.8240, 37.4921], [126.8115, 37.4853], [126.7953, 37.4827], [126.7829, 37.4842], [126.7646, 37.4866], [126.7530, 37.4877], [126.7400, 37.4890], [126.7238, 37.4897], [126.7076, 37.4834], [126.7027, 37.4718], [126.6936, 37.4648], [126.6810, 37.4648], [126.6687, 37.4660], [126.6566, 37.4667], [126.6430, 37.4687], [126.6327, 37.4751], [126.6167, 37.4766]],
    stations: { guroStn: 0, onsuStn: 4, yeokgokStn: 5, sosaStn: 6, bucheonStn: 7, songnaeStn: 9, bupyeongStn: 11, incheonStn: 20 } },
  // 7호선 (가산디지털단지 → 철산 → 광명사거리 → 천왕 → 온수 → 까치울 → 부천종합운동장 → 춘의 → 신중동 → 부천시청 → 상동 → 삼산체육관)
  { id: 7, pts: [[127.0540, 37.5190], [127.0412, 37.5172], [127.0317, 37.5143], [127.0215, 37.5110], [127.0115, 37.5082], [127.0050, 37.5050], [126.9937, 37.4874], [126.9817, 37.4867],
    [126.9710, 37.4846], [126.9536, 37.4963], [126.9478, 37.5029], [126.9390, 37.5050], [126.9278, 37.4997], [126.9200, 37.4995], [126.9090, 37.5000], [126.8955, 37.4925], [126.8873, 37.4861], [126.8826, 37.4810], [126.8680, 37.4760], [126.8547, 37.4792], [126.8387, 37.4866], [126.8251, 37.4921], [126.8062, 37.5063], [126.7975, 37.5050], [126.7871, 37.5036], [126.7760, 37.5029], [126.7634, 37.5045], [126.7531, 37.5057], [126.7426, 37.5065], [126.7317, 37.5067], [126.7215, 37.5082]],
    stations: { gangnamHall: 1, expressTermStn: 5, isuStn: 7, boramae: 13, gasanStn: 17, onsuStn: 21, bcStadiumStn: 23, bucheonHallStn: 26, bupyeongGuStn: 30 } },
  // 인천 1호선 (갈산 → 부평구청 → 부평시장 → 부평 → 동수 → 부평삼거리 → 간석오거리 → 인천시청 → 예술회관 → 인천터미널 → 문학경기장 → 선학)
  { id: '인천1', pts: [[126.7373, 37.5715], [126.7428, 37.5662], [126.7448, 37.5537], [126.7385, 37.5450], [126.7280, 37.5430], [126.7225, 37.5380], [126.7225, 37.5305], [126.7210, 37.5175], [126.7215, 37.5082], [126.7228, 37.4985], [126.7238, 37.4897], [126.7160, 37.4853], [126.7125, 37.4780], [126.7075, 37.4672], [126.7020, 37.4575],
    [126.7006, 37.4495], [126.6990, 37.4420], [126.6930, 37.4355], [126.6950, 37.4270],
      [126.6942, 37.4185], [126.6875, 37.4135], [126.6770, 37.4045], [126.6685, 37.3985], [126.6617, 37.3878], [126.6567, 37.3820], [126.6440, 37.3845], [126.6345, 37.3933], [126.6300, 37.3995]],
    stations: { gyeyangStn: 0, bupyeongGuStn: 8, bupyeongStn: 10, incheonHallStn: 14, lotteIncheon: 16, songdoPark: 26 } },
  // 수인선 (오이도 → 달월 → 월곶 → 소래포구 → 인천논현 → 호구포 → 남동인더스파크 → 원인재 → 연수)
  { id: '수인', pts: [[126.7375, 37.3618], [126.7475, 37.3795], [126.7428, 37.3918], [126.7339, 37.4012], [126.7225, 37.4005], [126.7085, 37.4015], [126.6955, 37.4075], [126.6875, 37.4135], [126.6785, 37.4180], [126.6575, 37.4285], [126.6545, 37.4485], [126.6435, 37.4615], [126.6243, 37.4697], [126.6167, 37.4766]],
    stations: { oidoStn: 0, soraePort: 3, incheonStn: 13 } },
  // 공항철도 (김포공항 → 계양 → 검암 → 청라국제도시 → 영종대교 → 영종 → 운서 → 공항화물청사 → 인천공항)
  { id: '공항', pts: [[126.8015, 37.5620], [126.7373, 37.5715], [126.6745, 37.5690], [126.6247, 37.5562], [126.5900, 37.5360], [126.5413, 37.5105], [126.4932, 37.4927], [126.4720, 37.4690], [126.4525, 37.4475]],
    stations: { gimpoAirport: 0, gyeyangStn: 1, cheongnaStn: 3, incheonAirport: 8 } },
  // 5호선 (김포공항 → 송정 → 마곡 → 발산 → 우장산 → 화곡 → 까치산 → 신정 → 목동 → 오목교 → 양평 → 영등포구청 → 영등포시장 → 신길 → 여의도 → 여의나루 → 마포)
  { id: 5, pts: [[126.8015, 37.5620], [126.8115, 37.5612], [126.8255, 37.5602], [126.8375, 37.5585], [126.8360, 37.5485], [126.8405, 37.5415], [126.8467, 37.5318], [126.8560, 37.5250], [126.8648, 37.5260],
    [126.8750, 37.5245], [126.8855, 37.5258], [126.8960, 37.5248], [126.9050, 37.5228], [126.9175, 37.5175], [126.9243, 37.5216], [126.9325, 37.5270], [126.9460, 37.5395]],
    stations: { gimpoAirport: 0, balsanStn: 3, hwagokStn: 5, kkachisanStn: 6, ohmokgyoStn: 9, yeouidoStn: 14 } },
  // 9호선 (김포공항 → 공항시장 → 신방화 → 마곡나루 → 양천향교 → 가양 → 증미 → 등촌 → 염창 → 신목동 → 선유도 → 당산 → 국회의사당 → 여의도 → 샛강 → 노량진)
  { id: 9, pts: [[126.8015, 37.5620], [126.8105, 37.5636], [126.8165, 37.5675], [126.8271, 37.5668], [126.8418, 37.5682], [126.8545, 37.5615], [126.8610, 37.5580], [126.8690, 37.5505],
    [126.8750, 37.5470], [126.8828, 37.5440], [126.8935, 37.5380], [126.9025, 37.5345], [126.9178, 37.5280], [126.9243, 37.5216], [126.9290, 37.5175], [126.9425, 37.5135],
    [126.9530, 37.5125], [126.9635, 37.5088], [126.9800, 37.5027], [126.9875, 37.5015], [126.9960, 37.5035], [127.0050, 37.5050], [127.0145, 37.5045], [127.0250, 37.5045], [127.0345, 37.5072],
    [127.0435, 37.5103], [127.0530, 37.5130], [127.0600, 37.5145], [127.0736, 37.5110], [127.0880, 37.5045], [127.0965, 37.5025], [127.1065, 37.5055], [127.1120, 37.5100], [127.1165, 37.5165], [127.1309, 37.5163]],
    stations: { gimpoAirport: 0, magokStn: 3, gayangStn: 5, yeouidoStn: 13, noryangjinStn: 15, dongjakStn: 18, expressTermStn: 21, seonjeongneung: 25, coex: 27, jamsilStadium: 28, seokchon: 31 } },
  // 김포골드라인 (김포공항 → 고촌 → 풍무 → 사우 → 걸포북변 → 운양 → 장기 → 마산 → 구래 → 양촌). 꼬마 무인 전철
  { id: '김포', pts: [[126.8015, 37.5620], [126.7695, 37.6015], [126.7320, 37.6125], [126.7170, 37.6205], [126.7058, 37.6315], [126.6850, 37.6505], [126.6705, 37.6430], [126.6440, 37.6400], [126.6280, 37.6450], [126.6150, 37.6440]],
    stations: { gimpoAirport: 0, sawooStn: 3, guraeStn: 8 } },
  // 3호선 (압구정 → 신사 → 잠원 → 고속터미널 → 교대 → 남부터미널 → 양재 → 매봉 → 도곡 → 대치 → 학여울 → 대청 → 일원 → 수서 → 가락시장 → 경찰병원 → 오금)
  { id: 3, pts: [[127.0286, 37.5270], [127.0203, 37.5163], [127.0110, 37.5128], [127.0050, 37.5050], [127.0141, 37.4934], [127.0161, 37.4850], [127.0344, 37.4840], [127.0466, 37.4870],
    [127.0555, 37.4910], [127.0630, 37.4945], [127.0717, 37.4966], [127.0794, 37.4937], [127.0840, 37.4836], [127.1017, 37.4873], [127.1183, 37.4925], [127.1236, 37.4960], [127.1281, 37.5021]],
    stations: { hyundaiApgujeong: 0, expressTermStn: 3, gyodaeStn: 4, yangjaeStn: 6, suseoStn: 13, garakMarket: 14 } },
  // 8호선 (강동구청 → 몽촌토성 → 잠실 → 석촌 → 송파 → 가락시장 → 문정 → 장지 → 복정)
  { id: 8, pts: [[127.1206, 37.5303], [127.1123, 37.5175], [127.1000, 37.5133], [127.1065, 37.5055], [127.1124, 37.4997], [127.1183, 37.4925], [127.1225, 37.4858], [127.1265, 37.4785], [127.1268, 37.4703]],
    stations: { olympicPark: 1, lotteWorld: 2, seokchon: 3, garakMarket: 5 } },
  // 수인분당선 (수원 → 수원시청 → 영통 → 기흥 → 구성 → 죽전 → 미금 → 정자 → 야탑 → 모란 → 복정 → 수서 → 도곡 → 선릉). 성남은 아직 동네가 없어 길만 지나간다
  { id: '분당', pts: [[127.0016, 37.2659], [127.0129, 37.2655], [127.0288, 37.2620], [127.0397, 37.2525], [127.0573, 37.2457], [127.0715, 37.2510], [127.0790, 37.2597], [127.1090, 37.2618],
    [127.1155, 37.2755], [127.1090, 37.2865], [127.1058, 37.2989], [127.1110, 37.3127], [127.1078, 37.3247], [127.1090, 37.3396], [127.1085, 37.3500], [127.1084, 37.3670], [127.1234, 37.3850],
    [127.1278, 37.4110], [127.1290, 37.4322], [127.1268, 37.4703], [127.1017, 37.4873], [127.0727, 37.4913], [127.0555, 37.4910], [127.0530, 37.4963], [127.0490, 37.5045]],
    stations: { suwonStn: 0, suwonHall: 2, giheungStn: 8, guseongStn: 10, shinsegaeGyeonggi: 12, suseoStn: 20 } },
  // 신분당선 (강남 → 양재 → 양재시민의숲 → 청계산입구 → 판교 → 정자 → 미금 → 동천 → 수지구청 → 성복 → 상현 → 광교중앙 → 광교)
  { id: '신분당', pts: [[127.0276, 37.4979], [127.0344, 37.4840], [127.0386, 37.4704], [127.0547, 37.4479], [127.1112, 37.3947], [127.1084, 37.3670], [127.1085, 37.3500], [127.1080, 37.3380],
    [127.0945, 37.3226], [127.0730, 37.3140], [127.0698, 37.2975], [127.0516, 37.2886], [127.0446, 37.3021]],
    stations: { gangnamStn: 0, yangjaeStn: 1, yangjaeForest: 2, dongcheonStn: 7, sujiGuStn: 8, lotteMallSuji: 9, gwanggyoStn: 12 } }
].map(l => ({ ...l, color: LINE_COLOR[l.id][0], dark: LINE_COLOR[l.id][1], pts: l.pts.map(([x, y]) => wuv(x, y)) }));
// 갈아타는 역: 두 노선에 같이 있는 역 (금정 1↔4, 사당 2↔4, 초지 4↔서해)
const sharedStn = (A, B) => Object.keys(A.stations).filter(id => B.stations[id] != null);
export const TRANSFERS = LINES.flatMap(A => LINES.filter(B => B !== A).flatMap(B => sharedStn(A, B).map(id => ({ id, line: B.id }))));
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
    : STATION_IDS.map(id => ({ id, d: meters(SPOT_BY_ID[id].r, sp.r) })).filter(x => x.d < 2200).sort((x, y) => x.d - y.d).slice(0, 3));
  let best = null;
  near(fromSpot).forEach(o => near(toSpot).forEach(d => {
    if (o.id === d.id) return;
    // 노선을 최대 5개(갈아타기 4번)까지 이어 본다 (집 → 인천공항처럼 먼 곳)
    const tries = [];
    const walk = (line, at, legs, used) => {
      if (line.stations[d.id] != null && at !== d.id) tries.push([...legs, lineLeg(line, at, d.id)]);
      if (used.length >= 5) return;
      LINES.forEach(B => {
        if (used.includes(B)) return;
        sharedStn(line, B).forEach(x => { if (x !== at && x !== d.id) walk(B, x, [...legs, lineLeg(line, at, x)], [...used, B]); });
      });
    };
    LINES.forEach(A => { if (A.stations[o.id] != null) walk(A, o.id, [], [A]); });
    tries.forEach(legs => {
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
