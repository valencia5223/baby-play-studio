// 🚌 우리 동네(산본) 버스 노선 받기 → src/townBus.json
//  - 경기도 버스정보(GBIS) 공공데이터포털 API. 키는 파일에서만 읽고(기본 ~/data_go_key.txt, 또는 DATA_GO_KEY_FILE) 결과 파일에는 넣지 않는다
//  - 장소마다 근처 정류장(spotStops)을 찾고, 그 정류장들 + 우리집 앞(HOME) + 길 잇기용(EXTRA)을 지나는 모든 노선을 받아
//    지도 범위(BOX) 안에 있는 구간만 정류장 순서대로 저장한다 (게임은 이 파일만 읽음)
//  - 실행: npm run bus  (산본), npm run bus anyang  (옆 동네 안양 → src/townBus_anyang.json). 노선이 바뀌었을 때만 가끔
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TOWN_SPOT_LISTS } from '../src/townSpots.js';

const KEY_FILE = process.env.DATA_GO_KEY_FILE || path.join(os.homedir(), 'data_go_key.txt');
const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
// 동네마다: 지도 범위, 우리집 앞 정류장, 길 잇기용 정류장 (townData.js 의 BOX 와 같아야 한다)
const TOWNS = {
  // 한라2차아파트입구 + 수리산역(길 양쪽). 철쭉동산·초막골공원·산본시장·산본역 쪽 길도 지도에 그리려고 EXTRA 를 같이 받는다
  sanbon: { out: 'townBus.json', box: { x0: 126.905, x1: 126.952, y0: 37.338, y1: 37.378 },
    home: [225000140, 225000138, 225000397, 225000398], extra: [225000092, 225000422, 225000096, 225000052, 225000047] },
  // 안양: 산본과 같은 크기(가로 0.047°, 세로 0.040°)로 산본 바로 위(북쪽)에 붙인 지도. 두 지도는 37.378 에서 맞닿는다
  anyang: { out: 'townBus_anyang.json', box: { x0: 126.9175, x1: 126.9645, y0: 37.378, y1: 37.418 }, home: [], extra: [] },
  // 의왕: 군포 동쪽. 북쪽 계원예대·동쪽 아울렛부터 남쪽 의왕역·왕송호수까지
  uiwang: { out: 'townBus_uiwang.json', box: { x0: 126.940, x1: 127.016, y0: 37.295, y1: 37.397 }, home: [], extra: [] },
  // 과천: 안양 바로 동쪽(북동쪽). 의왕처럼 군포보다 1.32배 넓다
  gwacheon: { out: 'townBus_gwacheon.json', box: { x0: 126.9645, x1: 127.0265, y0: 37.397, y1: 37.4498 }, home: [], extra: [] },
  // 군포 남쪽 대야미·송부 (산본 아래)
  gunposouth: { out: 'townBus_gunposouth.json', box: { x0: 126.880, x1: 126.955, y0: 37.300, y1: 37.338 }, home: [], extra: [] },
  // 안양 북쪽 석수·관악
  seoksu: { out: 'townBus_seoksu.json', box: { x0: 126.890, x1: 126.935, y0: 37.405, y1: 37.445 }, home: [], extra: [] },
  // 광명 남쪽 (광명역·광명동굴·이케아)
  gwangmyeong: { out: 'townBus_gwangmyeong.json', box: { x0: 126.850, x1: 126.895, y0: 37.395, y1: 37.440 }, home: [], extra: [] },
  // 안산: 군포 남쪽(대야미·송부) 바로 왼쪽
  ansan: { out: 'townBus_ansan.json', box: { x0: 126.760, x1: 126.880, y0: 37.290, y1: 37.345 }, home: [], extra: [] },
  // 시흥: 안산 위, 광명 왼쪽
  siheung: { out: 'townBus_siheung.json', box: { x0: 126.730, x1: 126.850, y0: 37.345, y1: 37.455 }, home: [], extra: [] },
  // 대부도·오이도 바닷가: 시흥·안산 서쪽 (대부 북쪽 방아머리 ~ 남쪽 탄도). 대부분 바다
  daebu: { out: 'townBus_daebu.json', box: { x0: 126.540, x1: 126.760, y0: 37.185, y1: 37.380 }, home: [], extra: [] },
  // 부천: 시흥 바로 위(북쪽), 광명 왼쪽
  bucheon: { out: 'townBus_bucheon.json', box: { x0: 126.735, x1: 126.850, y0: 37.455, y1: 37.530 }, home: [], extra: [] },
  // 인천 부평·남동: 부천·시흥 바로 왼쪽 (부평역 ~ 구월동 ~ 소래포구)
  incheon: { out: 'townBus_incheon.json', box: { x0: 126.660, x1: 126.735, y0: 37.385, y1: 37.530 }, home: [], extra: [] },
  // 인천 바닷가: 인천 부평·남동 왼쪽 (송도·월미도·영종도). 대부분 바다
  incheonwest: { out: 'townBus_incheonwest.json', box: { x0: 126.360, x1: 126.660, y0: 37.330, y1: 37.530 }, home: [], extra: [] },
  // 인천 북쪽: 계양·서구·청라 ~ 김포공항 (인천·부천 위)
  incheonnorth: { out: 'townBus_incheonnorth.json', box: { x0: 126.600, x1: 126.800, y0: 37.530, y1: 37.610 }, home: [], extra: [] },
  // 김포: 인천 서구 위 (한강 하구). 강화도: 김포 서쪽 섬
  gimpo: { out: 'townBus_gimpo.json', box: { x0: 126.540, x1: 126.800, y0: 37.590, y1: 37.770 }, home: [], extra: [] },
  ganghwa: { out: 'townBus_ganghwa.json', box: { x0: 126.330, x1: 126.545, y0: 37.580, y1: 37.800 }, home: [], extra: [] },
  // 수원 (의왕 아래), 용인 수지 (의왕 동쪽), 용인 기흥 (수원 동쪽, 용인 할비집·에버랜드)
  suwon: { out: 'townBus_suwon.json', box: { x0: 126.960, x1: 127.060, y0: 37.240, y1: 37.300 }, home: [], extra: [] },
  suji: { out: 'townBus_suji.json', box: { x0: 127.040, x1: 127.130, y0: 37.300, y1: 37.360 }, home: [], extra: [] },
  giheung: { out: 'townBus_giheung.json', box: { x0: 127.060, x1: 127.210, y0: 37.235, y1: 37.300 }, home: [], extra: [] }
};
const TOWN = process.argv[2] || 'sanbon';
if (!TOWNS[TOWN]) throw new Error(`동네 이름: ${Object.keys(TOWNS).join(', ')}`);
const { box: BOX, home: HOME, extra: EXTRA } = TOWNS[TOWN], SPOT_LIST = TOWN_SPOT_LISTS[TOWN];
const OUT = new URL(`../src/${TOWNS[TOWN].out}`, import.meta.url);
// 지도 밖으로 조금(약 600m) 더 받아 둔다: 옆 동네와 맞닿는 곳에서 길이 끊기지 않고 이어진다
const M = 0.006;
const inBox = (s) => s.x > BOX.x0 - M && s.x < BOX.x1 + M && s.y > BOX.y0 - M && s.y < BOX.y1 + M;

const hide = (s) => String(s).split(KEY).join('***').split(encodeURIComponent(KEY)).join('***');
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
async function api(svc, op, q) {
  const u = `https://apis.data.go.kr/6410000/${svc}/v2/${op}?serviceKey=${encodeURIComponent(KEY)}&format=json&${q}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u); const t = await r.text();
      const j = JSON.parse(t).response;
      if (!j) throw new Error(`응답 이상: ${t.replace(/\s+/g, ' ').slice(0, 300)}`);
      return j.msgBody || {};
    } catch (e) { if (i === 2) throw new Error(hide(e.message)); await new Promise(res => setTimeout(res, 800)); }
  }
  return {};
}

// 장소 근처 정류장: 이름 키워드(stop)가 있으면 그 이름의 정류장, 없으면 350m 안 (가까운 순 최대 6개)
const spotStops = {};
const dist = (x1, y1, x2, y2) => Math.hypot((x1 - x2) * 88400, (y1 - y2) * 111000);
for (const sp of SPOT_LIST) {
  if (sp.id === 'home') { spotStops.home = HOME; continue; }
  const b = await api('busstationservice', 'getBusStationAroundListv2', `x=${sp.real[0]}&y=${sp.real[1]}`);
  let l = arr(b.busStationAroundList).map(st => ({ id: st.stationId, name: st.stationName, d: dist(+st.x, +st.y, sp.real[0], sp.real[1]) })).filter(st => !st.name.includes('미정차')).sort((a, c) => a.d - c.d);
  const kw = sp.stop ? l.filter(st => sp.stop.some(k => st.name.includes(k))) : [];
  l = kw.length ? kw : l.filter(st => st.d < 350);
  spotStops[sp.id] = l.slice(0, 6).map(st => st.id);
  console.log(`${sp.name}: ${l.slice(0, 6).map(st => `${st.name}(${Math.round(st.d)}m)`).join(', ') || '정류장 없음'}`);
}

const routes = new Map();
for (const id of [...new Set([...HOME, ...EXTRA, ...Object.values(spotStops).flat()])]) {
  const b = await api('busstationservice', 'getBusStationViaRouteListv2', `stationId=${id}`);
  for (const r of arr(b.busRouteList)) {
    const o = routes.get(r.routeId) || { id: r.routeId, name: String(r.routeName), type: r.routeTypeName, home: false };
    if (HOME.includes(id)) o.home = true;
    routes.set(r.routeId, o);
  }
}

const stops = {};
const out = [];
for (const r of routes.values()) {
  const b = await api('busrouteservice', 'getBusRouteStationListv2', `routeId=${r.id}`);
  const st = arr(b.busRouteStationList).sort((a, c) => a.stationSeq - c.stationSeq);
  // 지도 안에 연속으로 있는 구간들
  const runs = []; let cur = [];
  st.forEach(s => {
    if (inBox(s)) { cur.push(s.stationId); stops[s.stationId] = [s.stationName, +(+s.x).toFixed(6), +(+s.y).toFixed(6)]; }
    else if (cur.length) { runs.push(cur); cur = []; }
  });
  if (cur.length) runs.push(cur);
  const keep = runs.filter(rr => rr.length >= 2);
  if (keep.length) out.push({ id: r.id, name: r.name, type: r.type, home: r.home, runs: keep });
  console.log(`${r.name} (${r.type})${r.home ? ' ★' : ''}: ${keep.map(k => k.length).join('+')} 정류장`);
}

out.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
const data = { updated: new Date().toISOString().slice(0, 10), box: BOX, home: HOME, spotStops, stops, routes: out };
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`저장: src/${TOWNS[TOWN].out} (노선 ${out.length}개, 정류장 ${Object.keys(stops).length}개)`);
