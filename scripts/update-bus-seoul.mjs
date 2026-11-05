// 🚌 우리 동네 서울 지역 버스 노선 받기 → src/townBus_<동네>.json (경기 버스와 같은 형식)
//  - 서울특별시 버스 API (ws.bus.go.kr, 공공데이터포털 '서울특별시_정류소정보조회'·'서울특별시_노선정보조회' 활용신청 필요)
//    키는 파일에서만 읽고(기본 ~/data_go_key.txt, 또는 DATA_GO_KEY_FILE) 결과 파일에는 넣지 않는다
//  - 장소마다 근처 정류장(spotStops)을 찾고, 그 정류장을 지나는 모든 노선을 받아 지도 범위(+600m) 안 구간만 정류장 순서대로 저장
//  - 서울 API 는 하루 호출 수가 적으니(개발 계정 약 1,000회) 노선이 바뀌었을 때만 가끔 실행
//  - 실행: npm run bus-seoul geumcheon
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TOWN_SPOT_LISTS } from '../src/townSpots.js';

const KEY_FILE = process.env.DATA_GO_KEY_FILE || path.join(os.homedir(), 'data_go_key.txt');
const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
const TOWNS = {
  // 서울 금천구 (석수역 위, 1호선 금천구청·독산·가산디지털단지)
  geumcheon: { out: 'townBus_geumcheon.json', box: { x0: 126.875, x1: 126.935, y0: 37.440, y1: 37.488 } },
  // 서울 관악구 (금천 동쪽, 2호선 신림~사당·서울대·관악산)
  gwanak: { out: 'townBus_gwanak.json', box: { x0: 126.935, x1: 126.995, y0: 37.440, y1: 37.488 } }
};
const TOWN = process.argv[2] || 'geumcheon';
if (!TOWNS[TOWN]) throw new Error(`동네 이름: ${Object.keys(TOWNS).join(', ')}`);
const { box: BOX } = TOWNS[TOWN], SPOT_LIST = TOWN_SPOT_LISTS[TOWN];
const OUT = new URL(`../src/${TOWNS[TOWN].out}`, import.meta.url);
const M = 0.006;
const inBox = (x, y) => x > BOX.x0 - M && x < BOX.x1 + M && y > BOX.y0 - M && y < BOX.y1 + M;
// 서울 노선 종류 → 버스 색 (townData.js 의 BUS_STYLE)
const TYPE = { 1: '일반형시내버스', 2: '마을버스', 3: '서울간선', 4: '서울지선', 5: '서울순환', 6: '직행좌석형시내버스', 7: '일반형시내버스', 8: '일반형시내버스', 0: '일반형시내버스' };

const hide = (s) => String(s).split(KEY).join('***').split(encodeURIComponent(KEY)).join('***');
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
let calls = 0;
async function api(op, q) {
  const u = `http://ws.bus.go.kr/api/rest/${op}?serviceKey=${encodeURIComponent(KEY)}&resultType=json&${q}`;
  for (let i = 0; i < 3; i++) {
    try {
      calls++;
      const r = await fetch(u); const j = JSON.parse(await r.text());
      return arr(j.msgBody && j.msgBody.itemList);
    } catch (e) { if (i === 2) throw new Error(hide(e.message)); await new Promise(res => setTimeout(res, 800)); }
  }
  return [];
}

// 장소 근처 정류장: 이름 키워드(stop)가 있으면 그 이름의 정류장, 없으면 350m 안 (가까운 순 최대 6개)
const spotStops = {}, stationArs = {};
for (const sp of SPOT_LIST) {
  let l = (await api('stationinfo/getStationByPos', `tmX=${sp.real[0]}&tmY=${sp.real[1]}&radius=450`))
    .map(st => ({ id: +st.stationId, ars: st.arsId, name: st.stationNm, d: +st.dist })).filter(st => st.ars && st.ars !== '0').sort((a, c) => a.d - c.d);
  const kw = sp.stop ? l.filter(st => sp.stop.some(k => st.name.replace(/\s/g, '').includes(k))) : [];
  l = kw.length ? kw : l.filter(st => st.d < 350);
  l = l.slice(0, 6);
  l.forEach(st => { stationArs[st.id] = st.ars; });
  spotStops[sp.id] = l.map(st => st.id);
  console.log(`${sp.name}: ${l.map(st => `${st.name}(${st.d}m)`).join(', ') || '정류장 없음'}`);
}

const routes = new Map();
for (const [id, ars] of Object.entries(stationArs)) {
  for (const r of await api('stationinfo/getRouteByStation', `arsId=${ars}`)) {
    if (!r.busRouteId || r.busRouteType === '9') continue;   // 폐지 노선
    if (!routes.has(r.busRouteId)) routes.set(r.busRouteId, { id: +r.busRouteId, name: String(r.busRouteNm), type: TYPE[r.busRouteType] || '일반형시내버스', home: false });
  }
  void id;
}

const stops = {};
const out = [];
for (const r of routes.values()) {
  const st = (await api('busRouteInfo/getStaionByRoute', `busRouteId=${r.id}`)).sort((a, c) => +a.seq - +c.seq);
  const runs = []; let cur = [];
  st.forEach(s => {
    const x = +s.gpsX, y = +s.gpsY;
    if (inBox(x, y)) { cur.push(+s.station); stops[+s.station] = [s.stationNm, +x.toFixed(6), +y.toFixed(6)]; }
    else if (cur.length) { runs.push(cur); cur = []; }
  });
  if (cur.length) runs.push(cur);
  const keep = runs.filter(rr => rr.length >= 2);
  if (keep.length) out.push({ ...r, runs: keep });
  console.log(`${r.name} (${r.type}): ${keep.map(k => k.length).join('+')} 정류장`);
}

out.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
const data = { updated: new Date().toISOString().slice(0, 10), box: BOX, home: [], spotStops, stops, routes: out };
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`저장: src/${TOWNS[TOWN].out} (노선 ${out.length}개, 정류장 ${Object.keys(stops).length}개, API 호출 ${calls}회)`);
