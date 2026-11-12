// ═════════════════════════════════════════════════════════════════════════════
// 🏡 유나의 모험 (3D, three.js): 집에서 놀다가 → 신발 신고 현관문 → 복도(옆집 하나를 지나) → 엘리베이터 버튼 → 타고 층 버튼 → 1층
//  - 좌표: x = 동쪽, z = 남쪽, y = 위 (단위 m). 집은 x 0~10.12, z 0~6.96 (평면도를 위아래로 뒤집은 구조:
//    현관(서쪽 벽)에서 들어오면 왼쪽(북)에 욕실, 오른쪽(남)에 주방. 동쪽 끝은 확장한 베란다 + 폴딩도어)
//    복도는 집 서쪽(x -1.6~0). 현관 오른쪽 방(침실 B)이 복도 자리까지 넓혀져 있어 복도는 그 앞에서 끝나고(끝집 1404호),
//    현관문을 나와 오른쪽(북쪽)으로 옆집(1403호, z -6.96~0)을 지나 중앙 복도에서 오른쪽(동쪽)으로 꺾으면 엘리베이터 대기 공간,
//    그 북쪽 벽(집에서 가장 먼 벽)에 엘리베이터 두 대(EX1·EX2, 문은 남쪽)
//  - 화면을 누르면 그곳으로 걸어간다 (0.2m 격자 A* 길찾기, 벽·가구는 solids). 문은 다가가면 열린다(gates).
//    현관문은 신발을 신어야 열린다. 물건(taps)을 누르면 그 앞으로 가서 행동한다
//  - 카메라: 집 안은 남쪽 위에서 내려다보고 유나보다 남쪽에 있는 가로 벽은 흐리게(fades), 복도는 유나 뒤에서 유나 눈높이로,
//    엘리베이터 안은 뒤쪽 위에서 문을 본다
//  - 엘리베이터는 실제로 움직이지 않고, 문이 닫힌 동안 문 밖 풍경을 바꾼다 (1층 = lobbyG, 나머지 층 = floorG)
//  - 다음 장면(아파트 밖)은 여기서 이어 만든다. 집 위치 같은 실제 좌표는 넣지 않는다
// ═════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ADV_FLOORS, ADV_HOME_FLOOR } from './adventureData.js';
import { VOICE } from './voiceLines.js';

const JUA = "'Jua', 'Gowun Dodum', sans-serif";
const HOME = ADV_HOME_FLOOR;
const WALL_H = 2.2, T = 0.12;
const HALL_Z = -6.96, LZ0 = -9.96, LX1 = 3.6;   // 엘리베이터 대기 공간: z LZ0~HALL_Z, x 0~LX1 (북쪽 벽 z=LZ0 에 엘리베이터)
const END_Z = -14.4;                     // 복도 북쪽 끝
const EX1 = 0.95, EX2 = 2.7;             // 엘리베이터 두 대의 가운데 x (타는 건 첫째)
const BTN_X = (EX1 + EX2) / 2;           // 부르는 버튼
// 1층: 복도 x F1X0~F1X1 · z LZ0~F1Z1, 양 끝(z SZ0~SZ1)에 길이 ST 계단으로 DROP 만큼 내려가면 바깥
const F1X0 = -2.5, F1X1 = 6.2, F1Z1 = LZ0 + 3.0, SZ0 = LZ0 + 0.5, SZ1 = LZ0 + 2.5, ST = 1.5, DROP = 0.9;
const GRID1 = [-12, LZ0 - 6, 140, 85];
function heightAt1(x, z) {
  if (x >= F1X0 && x <= F1X1 && z > LZ0 - 3 && z < F1Z1 + 0.1) return 0;
  const onStair = z > SZ0 - 0.05 && z < SZ1 + 0.05;
  if (onStair && x < F1X0 && x > F1X0 - ST) return -0.18 * Math.min(5, Math.ceil((F1X0 - x) / 0.3));
  if (onStair && x > F1X1 && x < F1X1 + ST) return -0.18 * Math.min(5, Math.ceil((x - F1X1) / 0.3));
  return -DROP;
}
const inCorridor = (x, z) => z < 4.3 && (x < -0.05 || z < -6.9);   // 집 밖(복도·대기 공간)인지 (x<0 이라도 넓힌 방은 집 안)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ─────────────────────────────── 길찾기 격자 ───────────────────────────────
const CELL = 0.2, BODY = 0.17;
// 층마다 격자 범위 [x0, z0, 칸 수 W, 칸 수 H]
const GRID14 = [-1.8, -15.0, 62, 112];
function makeNav(solids, [GX0, GZ0, GW, GH]) {
  const cellOf = (x, z) => [Math.floor((x - GX0) / CELL), Math.floor((z - GZ0) / CELL)];
  const centerOf = (i, j) => [GX0 + (i + 0.5) * CELL, GZ0 + (j + 0.5) * CELL];
  const blocked = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const [x, z] = centerOf(i, j);
    for (const r of solids) if (x > r[0] - BODY && x < r[2] + BODY && z > r[1] - BODY && z < r[3] + BODY) { blocked[j * GW + i] = 1; break; }
  }
  const free = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && !blocked[j * GW + i];
  const freeAt = (x, z) => { const [i, j] = cellOf(x, z); return free(i, j); };
  const nearestFree = (i, j) => {
    if (free(i, j)) return [i, j];
    for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(i + di, j + dj)) return [i + di, j + dj];
    }
    return null;
  };
  const sight = (x0, z0, x1, z1) => {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.08));
    for (let k = 0; k <= n; k++) if (!freeAt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n)) return false;
    return true;
  };
  const find = (sx, sz, tx, tz) => {
    const s = nearestFree(...cellOf(sx, sz)), e = nearestFree(...cellOf(tx, tz));
    if (!s || !e) return [];
    const N = GW * GH, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const si = s[1] * GW + s[0], ei = e[1] * GW + e[0];
    const h = (k) => { const dx = Math.abs(k % GW - e[0]), dz = Math.abs(Math.floor(k / GW) - e[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const open = [si]; gs[si] = 0;
    const fs = new Float32Array(N).fill(Infinity); fs[si] = h(si);
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (fs[open[k]] < fs[open[bi]]) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur === ei) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const ci = cur % GW, cj = Math.floor(cur / GW);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;   // 모서리를 비스듬히 뚫지 않게
        const nk = nj * GW + ni, ng = gs[cur] + (di && dj ? 1.414 : 1);
        if (ng < gs[nk]) { gs[nk] = ng; fs[nk] = ng + h(nk); from[nk] = cur; open.push(nk); }
      }
    }
    if (from[ei] < 0 && ei !== si) return [];
    const cells = []; for (let k = ei; k >= 0; k = from[k]) { cells.push(k); if (k === si) break; }
    cells.reverse();
    const pts = cells.map(k => { const [x, z] = centerOf(k % GW, Math.floor(k / GW)); return { x, z }; });
    if (freeAt(tx, tz) && pts.length) pts[pts.length - 1] = { x: tx, z: tz };
    // 쭉 보이는 곳까지는 한 번에 (꺾이는 점만 남김)
    const out = []; let ax = sx, az = sz, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) if (sight(ax, az, pts[m].x, pts[m].z)) { far = m; break; }
      out.push(pts[far]); ax = pts[far].x; az = pts[far].z; k = far + 1;
    }
    return out;
  };
  return { find, freeAt };
}

// ─────────────────────────────── 그림 재료 ───────────────────────────────
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const repeatTex = (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex; };
const woodTex = () => repeatTex(canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#e2b47c'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    c.fillStyle = ['#dcab70', '#e6ba84', '#d9a56a', '#e3b47a'][i]; c.fillRect(0, i * 64, w, 64);
    c.strokeStyle = 'rgba(120,70,30,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke();
    const off = (i % 2) * 128 + 40; c.beginPath(); c.moveTo(off, i * 64); c.lineTo(off, i * 64 + 64); c.stroke();
    c.strokeStyle = 'rgba(150,95,45,0.12)'; c.lineWidth = 1;
    for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(0, i * 64 + 8 + k * 11); c.bezierCurveTo(80, i * 64 + 4 + k * 11, 170, i * 64 + 14 + k * 11, w, i * 64 + 8 + k * 11); c.stroke(); }
  }
}));
const tileTex = (a, b, line) => repeatTex(canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
  c.strokeStyle = line; c.lineWidth = 2; c.strokeRect(0, 0, 64, 64); c.strokeRect(64, 0, 64, 64); c.strokeRect(0, 64, 64, 64); c.strokeRect(64, 64, 64, 64);
}));
function labelMesh(text, w, h, o = {}) {
  const tex = canvasTex(256, Math.round(256 * h / w), (c, cw, ch) => {
    c.fillStyle = o.bg || '#ffffff'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = o.fg || '#374151'; c.font = `bold ${Math.round(ch * (o.size || 0.62))}px Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, cw / 2, ch / 2 + ch * 0.04);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
// 엘리베이터 층 표시 (주황 숫자). draw(글자) 로 바꾼다
function makeDisplay() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  let last = null;
  const draw = (txt) => {
    if (txt === last) return; last = txt;
    const c = cv.getContext('2d'); c.fillStyle = '#111827'; c.fillRect(0, 0, 128, 64);
    c.fillStyle = '#ffb020'; c.font = 'bold 46px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 64, 35);
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

// ─────────────────────────────── 신발 ───────────────────────────────
// 신발 한 짝 (원점 = 밑창 바닥 가운데, 앞코가 +z). kind: velcro(찍찍이 운동화) · flat(단화) · crocs(크록스)
const SHOE_KINDS = [
  { id: 'crocsY', kind: 'crocs', color: '#ffd43b', x: 0.22, row: 0 },
  { id: 'crocsM', kind: 'crocs', color: '#63e6be', x: 0.57, row: 0 },
  { id: 'flatR', kind: 'flat', color: '#e03131', x: 0.92, row: 0 },
  { id: 'velcroP', kind: 'velcro', color: '#ff6fa5', x: 0.22, row: 1 },
  { id: 'velcroB', kind: 'velcro', color: '#4dabf7', x: 0.57, row: 1 },
  { id: 'flatV', kind: 'flat', color: '#b197fc', x: 0.92, row: 1 }
];
const SHOE_ROW_Z = [3.32, 4.2];
function makeShoe(kind, color) {
  const g = new THREE.Group();
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const col = new THREE.Color(color), dark = '#' + col.clone().multiplyScalar(0.55).getHexString();
  const add = (geo, mat, x, y, z, sc, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sc) m.scale.set(...sc); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const disc = (r) => new THREE.CylinderGeometry(r, r, 0.006, 16);
  if (kind === 'velcro') {
    add(new THREE.BoxGeometry(0.1, 0.022, 0.2), M('#f8f9fa'), 0, 0.011, 0);                         // 밑창
    add(cap(0.045, 0.1), M(color), 0, 0.054, -0.004, [1.1, 1, 0.75], Math.PI / 2);                   // 몸통
    add(new THREE.SphereGeometry(0.046, 14, 8), M('#ffffff'), 0, 0.036, 0.07, [1.08, 0.55, 0.7]);    // 앞코
    add(disc(0.032), M('#3f3f46'), 0, 0.087, -0.05, [1, 1, 1.35]);                                   // 발 넣는 곳
    [-0.005, 0.03].forEach(z => add(new THREE.BoxGeometry(0.106, 0.012, 0.026), M('#ffffff'), 0, 0.087, z, null, -0.25));   // 찍찍이 두 줄
  } else if (kind === 'flat') {
    add(new THREE.BoxGeometry(0.092, 0.016, 0.19), M(dark), 0, 0.008, 0);
    add(cap(0.04, 0.1), M(color), 0, 0.034, 0, [1.05, 1, 0.55], Math.PI / 2);
    add(disc(0.033), M('#fff0f0'), 0, 0.057, -0.022, [1, 1, 1.75]);                                 // 안창 (넓게 열림)
    add(new THREE.BoxGeometry(0.096, 0.01, 0.018), M(color), 0, 0.062, 0.028);                      // 발등 끈
    add(new THREE.BoxGeometry(0.014, 0.014, 0.012), M('#fcc419'), 0.046, 0.062, 0.028);              // 단추
    [-1, 1].forEach(k => add(new THREE.SphereGeometry(0.012, 8, 6), M('#ffffff'), k * 0.012, 0.052, 0.078, [1.2, 0.7, 0.7]));   // 리본
  } else {
    add(new THREE.BoxGeometry(0.106, 0.022, 0.2), M(dark), 0, 0.011, 0);
    add(cap(0.05, 0.095), M(color), 0, 0.05, 0, [1.05, 1, 0.8], Math.PI / 2);
    add(disc(0.036), M(dark), 0, 0.09, -0.04, [1, 1, 1.4]);
    for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.0075, 6, 5), M(dark), (i % 3 - 1) * 0.026, 0.084 - Math.floor(i / 3) * 0.008, 0.035 + Math.floor(i / 3) * 0.03, [1, 0.4, 1]);   // 구멍
    const strap = add(new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI), M(color), 0, 0.06, -0.03); strap.rotation.set(Math.PI / 2, 0, Math.PI);   // 뒤꿈치 끈
    [['#ff8787', -0.02], ['#74c0fc', 0.022]].forEach(([c, x]) => add(new THREE.SphereGeometry(0.011, 8, 6), M(c), x, 0.089, 0.0));   // 장식
  }
  return g;
}

// ─────────────────────────────── 엄마 · 아빠 ───────────────────────────────
// 어른 (키 약 1.75m). 다리·팔은 엉덩이·어깨에서 흔들린다
// 목욕 놀이(BathGame)의 안방 잠자리 장면도 이 엄마·아빠를 쓴다
// eslint-disable-next-line react-refresh/only-export-components
export function makeParent(kind) {
  const root = new THREE.Group();
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const mom = kind === 'mom';
  const skin = L('#ffe0c7'), hair = L(mom ? '#4a3426' : '#2b2622'), top = L(mom ? '#ff8fab' : '#4dabf7'), pants = L(mom ? '#8db4e2' : '#5c636e'), shoe = L(mom ? '#ffffff' : '#343a40');
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const legs = [-1, 1].map(k => {
    const p = new THREE.Group(); p.position.set(k * 0.085, 0.82, 0); root.add(p);
    add(p, new THREE.CylinderGeometry(0.075, 0.065, 0.78, 10), pants, 0, -0.39, 0);
    add(p, new THREE.BoxGeometry(0.11, 0.07, 0.24), shoe, 0, -0.785, 0.04);
    return p;
  });
  add(root, new THREE.CylinderGeometry(0.17, 0.16, 0.62, 14), top, 0, 1.12, 0);                   // 몸통
  add(root, new THREE.SphereGeometry(0.17, 14, 8), top, 0, 1.42, 0).scale.set(1.12, 0.45, 0.85);   // 어깨
  add(root, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), skin, 0, 1.5, 0);                     // 목
  const arms = [-1, 1].map(k => {
    const p = new THREE.Group(); p.position.set(k * 0.205, 1.4, 0); root.add(p);
    add(p, new THREE.CylinderGeometry(0.052, 0.045, 0.32, 10), top, 0, -0.15, 0);
    add(p, new THREE.CylinderGeometry(0.043, 0.038, 0.3, 10), skin, 0, -0.44, 0);
    add(p, new THREE.SphereGeometry(0.048, 10, 8), skin, 0, -0.61, 0);
    p.rotation.z = k * 0.08;
    return p;
  });
  const head = new THREE.Group(); head.position.set(0, 1.65, 0); root.add(head);
  add(head, new THREE.SphereGeometry(0.135, 20, 14), skin, 0, 0, 0);
  if (mom) {
    add(head, new THREE.SphereGeometry(0.145, 20, 14), hair, 0, 0.025, -0.025);
    add(head, new THREE.CylinderGeometry(0.13, 0.15, 0.32, 16), hair, 0, -0.12, -0.05).scale.set(1, 1, 0.75);   // 긴 머리
    add(head, new THREE.SphereGeometry(0.03, 8, 6), L('#ffd43b'), 0.1, 0.07, -0.06);                            // 머리핀
  } else {
    add(head, new THREE.SphereGeometry(0.142, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.02, -0.01);
    [-1, 1].forEach(k => add(head, new THREE.TorusGeometry(0.03, 0.006, 6, 14), L('#343a40'), k * 0.05, 0.0, 0.13));   // 안경
  }
  [-1, 1].forEach(k => {
    add(head, new THREE.SphereGeometry(0.015, 8, 6), L('#2b1d16'), k * 0.05, 0.0, 0.125);
    add(head, new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshLambertMaterial({ color: '#fb7185', transparent: true, opacity: 0.45 }), k * 0.075, -0.045, 0.105).scale.set(1, 0.7, 0.4);
  });
  add(head, new THREE.SphereGeometry(0.016, 8, 6), L('#c2410c'), 0, -0.06, 0.125).scale.set(1.6, 0.6, 0.5);
  return { root, legs, arms, head };
}

// 신발 고르기 창에 쓰는 신발 그림 (작은 렌더러로 한 번 그려 두고 재사용)
let SHOE_THUMBS = null;
function shoeThumbs() {
  if (SHOE_THUMBS) return SHOE_THUMBS;
  SHOE_THUMBS = {};
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(220, 160, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#d8cfc4', 2.2));
    const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(1, 2, 1.5); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 220 / 160, 0.01, 10); cam.position.set(0.3, 0.3, 0.44); cam.lookAt(0, 0.035, 0.005);
    SHOE_KINDS.forEach(sk => {
      const grp = new THREE.Group(); [-1, 1].forEach(k => { const sh = makeShoe(sk.kind, sk.color); sh.position.x = k * 0.06; sh.rotation.y = k * 0.06; grp.add(sh); });
      sc.add(grp); r.render(sc, cam); SHOE_THUMBS[sk.id] = r.domElement.toDataURL(); sc.remove(grp);
      grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    });
    r.dispose(); r.forceContextLoss();
  } catch { /* 그림 없이 색 동그라미로 */ }
  return SHOE_THUMBS;
}
const SHOE_NAMES = { velcro: '찍찍이 운동화', flat: '단화', crocs: '크록스' };

// ─────────────────────────────── 유나 ───────────────────────────────
function makeYuna() {
  const root = new THREE.Group();
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const skin = L('#ffe0c7'), hair = L('#3b2a20'), dress = L('#ffd43b'), sock = L('#ffffff');
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const body = new THREE.Group(); root.add(body);
  // 다리 (엉덩이에서 흔들림) + 발
  const legs = [-1, 1].map(k => {
    const p = new THREE.Group(); p.position.set(k * 0.07, 0.32, 0); body.add(p);
    add(p, new THREE.CylinderGeometry(0.045, 0.04, 0.28, 10), skin, 0, -0.14, 0);
    const foot = add(p, new THREE.SphereGeometry(0.06, 12, 8), sock, 0, -0.29, 0.025); foot.scale.set(1, 0.6, 1.45);
    return { p, foot };
  });
  // 원피스
  add(body, new THREE.CylinderGeometry(0.1, 0.2, 0.36, 16), dress, 0, 0.47, 0);
  add(body, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), L('#fab005'), 0, 0.305, 0);
  add(body, new THREE.SphereGeometry(0.1, 12, 8), dress, 0, 0.64, 0).scale.set(1.15, 0.6, 1);
  // 팔 (어깨에서 흔들림)
  const arms = [-1, 1].map(k => {
    const p = new THREE.Group(); p.position.set(k * 0.135, 0.62, 0); body.add(p);
    add(p, new THREE.CylinderGeometry(0.036, 0.032, 0.24, 8), dress, 0, -0.07, 0).scale.y = 0.6;
    add(p, new THREE.CylinderGeometry(0.032, 0.03, 0.14, 8), skin, 0, -0.19, 0);
    add(p, new THREE.SphereGeometry(0.04, 10, 8), skin, 0, -0.27, 0);
    p.rotation.z = k * 0.12;
    return p;
  });
  // 머리
  const head = new THREE.Group(); head.position.set(0, 0.87, 0); body.add(head);
  add(head, new THREE.SphereGeometry(0.2, 24, 18), skin, 0, 0, 0);
  add(head, new THREE.SphereGeometry(0.212, 24, 18), hair, 0, 0.035, -0.035);
  const bang = add(head, new THREE.SphereGeometry(0.19, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), hair, 0, 0.03, 0.02); bang.rotation.x = 0.35;
  [-1, 1].forEach(k => {
    add(head, new THREE.SphereGeometry(0.085, 14, 10), hair, k * 0.235, 0.0, -0.03).scale.set(0.85, 1.25, 0.85);
    add(head, new THREE.SphereGeometry(0.035, 10, 8), L('#f472b6'), k * 0.185, 0.085, -0.01);
    add(head, new THREE.SphereGeometry(0.026, 10, 8), L('#2b1d16'), k * 0.072, 0.0, 0.186).scale.set(1, 1.15, 0.5);
    add(head, new THREE.SphereGeometry(0.008, 6, 6), L('#ffffff'), k * 0.072 + 0.008, 0.012, 0.199);
    add(head, new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshLambertMaterial({ color: '#fb7185', transparent: true, opacity: 0.5 }), k * 0.115, -0.06, 0.158).scale.set(1, 0.7, 0.4);
  });
  add(head, new THREE.SphereGeometry(0.022, 10, 8), L('#e11d48'), 0, -0.085, 0.188).scale.set(1.3, 0.7, 0.5);
  const wearShoes = (sh) => legs.forEach(l => {
    if (l.shoe) { l.p.remove(l.shoe); l.shoe = null; }
    l.foot.visible = !sh;
    if (sh) { l.shoe = makeShoe(sh.kind, sh.color); l.shoe.position.set(0, -0.32, 0.01); l.shoe.scale.setScalar(0.95); l.p.add(l.shoe); }
  });
  return { root, body, legs, arms, head, wearShoes };
}

// ─────────────────────────────── 세상 만들기 ───────────────────────────────
// 목욕 놀이(BathGame)도 이 집(현관 오른쪽 방 · 거실)을 그대로 쓴다
// eslint-disable-next-line react-refresh/only-export-components
export function makeWorld() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#cdeafd');
  const floorG = new THREE.Group(), lobbyG = new THREE.Group(), coreG = new THREE.Group();   // 우리 층 / 1층 / 엘리베이터(늘 보임)
  scene.add(floorG, lobbyG, coreG); lobbyG.visible = false;
  const solids = [], fades = [], taps = [], doors = {};
  const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const box = (x0, z0, x1, z1, y0, y1, color, o = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), o.mat || L(color, o.matOpt));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = !!o.cast; m.receiveShadow = true;
    (o.parent || floorG).add(m); if (o.solid) solids.push([x0, z0, x1, z1]); return m;
  };
  // 벽: 가로 벽(z 가 같음)은 유나보다 남쪽이면 흐려진다
  const WALL = '#fbf6ee';
  const wall = (x0, z0, x1, z1, o = {}) => {
    const t = o.t ?? T, h = o.h ?? WALL_H, y0 = o.y0 ?? 0, ew = Math.abs(z1 - z0) < 1e-6;
    const solid = y0 < 0.5 && o.solid !== false;
    const m = ew ? box(x0, z0 - t / 2, x1, z0 + t / 2, y0, h, o.color || WALL, { solid, parent: o.parent })
      : box(x0 - t / 2, z0, x0 + t / 2, z1, y0, h, o.color || WALL, { solid, parent: o.parent });
    if (ew && !o.noFade) fades.push({ mats: [m.material], z: z0 });
    return m;
  };
  const floorRect = (x0, z0, x1, z1, mat, y = 0, parent = floorG, scale = 1.2) => {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0); const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / scale, (z0 + uv.getY(i) * (z1 - z0)) / scale);
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; parent.add(m); return m;
  };
  // 여닫이문: 경첩 (hx,hz), 닫혔을 때 방향 base(회전), 열리면 base + swing
  const hinged = (id, hx, hz, w, base, swing, color, o = {}) => {
    const pivot = new THREE.Group(); pivot.position.set(hx, 0, hz); pivot.rotation.y = base; (o.parent || floorG).add(pivot);
    const mat = L(color), h = o.h || 2.0;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mat); leaf.position.set(w / 2, h / 2, 0); leaf.castShadow = false; pivot.add(leaf);
    const knobM = L(o.knob || '#c9a227');
    [-1, 1].forEach(k => { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), knobM); kn.position.set(w - 0.09, 0.95, k * 0.05); pivot.add(kn); });
    const d = { id, pivot, base, swing, open: 0, target: 0, mats: [mat, knobM], leaf };
    doors[id] = d; if (o.fadeZ != null) fades.push({ mats: d.mats, z: o.fadeZ });
    return d;
  };
  const gates = [];

  const wood = new THREE.MeshLambertMaterial({ map: woodTex() });
  const tile = new THREE.MeshLambertMaterial({ map: tileTex('#eef2f5', '#e3e9ee', 'rgba(140,150,160,0.5)') });
  const bathTile = new THREE.MeshLambertMaterial({ map: tileTex('#dff3fb', '#cfeaf6', 'rgba(110,160,180,0.5)') });

  // ── 집 바닥 ──
  floorRect(0, 0, 10.12, 6.96, wood);
  floorRect(-1.6, 4.38, 0, 6.96, wood);                               // 복도 자리까지 넓힌 방
  floorRect(0, 2.84, 1.22, 4.38, tile, 0.004, floorG, 0.6);          // 현관
  floorRect(3.25, 0, 4.87, 1.88, bathTile, 0.004, floorG, 0.6);      // 욕실
  floorRect(8.68, 0.04, 10.08, 3.5, new THREE.MeshLambertMaterial({ map: tileTex('#e9e3da', '#ded6ca', 'rgba(140,128,112,0.45)') }), 0.004, floorG, 0.8);   // 베란다(폴딩도어~세탁기) 타일
  box(-0.06, -0.06, 10.18, 7.02, -0.25, -0.001, '#d8cfc4');           // 바닥 두께
  box(-1.66, 4.32, -0.06, 7.02, -0.25, -0.001, '#d8cfc4');

  // ── 바깥 벽 ──
  wall(0, 0, 10.12, 0);                                               // 북
  wall(-1.6, 6.96, 10.12, 6.96, { h: 0.12, color: '#e9dfd2' });          // 남 (카메라 쪽이라 턱만)
  wall(0, 0, 0, 0.35, { h: 2.4 }); wall(0, 2.55, 0, 3.15, { h: 2.4 }); wall(0, 0.35, 0, 2.55, { h: 0.6 }); wall(0, 0.35, 0, 2.55, { y0: 2.05, h: 2.4 }); wall(0, 4.05, 0, 4.38, { h: 2.4 }); wall(0, 3.15, 0, 4.05, { y0: 2.05, h: 2.4 });   // 서 + 현관문 위
  // 동 (베란다 바깥 창): 낮은 벽 + 유리
  wall(10.12, 0, 10.12, 3.5, { h: 0.95 });
  const glass = L('#bfe6ff', { transparent: true, opacity: 0.28, depthWrite: false });
  box(10.09, 0.06, 10.15, 3.5, 0.95, WALL_H, 0, { mat: glass });
  box(10.09, 3.5, 10.15, 6.9, 0.02, WALL_H, 0, { mat: glass });                             // 거실 앞: 바닥까지 통창
  solids.push([10.06, 3.5, 10.2, 6.96]);
  [0.06, 1.2, 2.34].forEach(z => box(10.08, z - 0.03, 10.16, z + 0.03, 0.95, WALL_H, '#ffffff'));
  [3.5, 4.35, 5.2, 6.05, 6.9].forEach(z => box(10.08, z - 0.03, 10.16, z + 0.03, 0, WALL_H, '#ffffff'));
  box(10.08, 3.5, 10.16, 6.9, 0, 0.05, '#ffffff');
  box(10.08, 0.06, 10.16, 6.9, WALL_H - 0.06, WALL_H, '#ffffff');

  // 샤시(미닫이 창): 남북으로 놓인 벽 x 위, z0~z1 · y0~y1 구멍에 흰 틀 + 유리 두 짝 (바깥을 본다)
  const sash = (x, z0, z1, y0, y1) => {
    const fr = '#ffffff', gm = L('#cfeaf8', { transparent: true, opacity: 0.32, depthWrite: false });
    box(x - 0.08, z0, x + 0.08, z1, y0 - 0.03, y0, fr); box(x - 0.08, z0, x + 0.08, z1, y1, y1 + 0.03, fr);   // 아래·위 틀
    box(x - 0.08, z0 - 0.03, x + 0.08, z0, y0, y1, fr); box(x - 0.08, z1, x + 0.08, z1 + 0.03, y0, y1, fr);   // 옆 틀
    box(x + 0.06, z0 - 0.02, x + 0.12, z1 + 0.02, y0 - 0.06, y0 - 0.02, '#f1f3f5');                         // 안쪽 창턱
    const half = (z1 - z0) / 2 + 0.03;
    [[z0, -0.025], [z1 - half, 0.025]].forEach(([a, dx]) => {
      const b = a + half;
      box(x + dx - 0.015, a, x + dx + 0.015, b, y0 + 0.01, y1 - 0.01, 0, { mat: gm });
      [[a, a + 0.04], [b - 0.04, b]].forEach(([p, q]) => box(x + dx - 0.02, p, x + dx + 0.02, q, y0, y1, '#f8f9fa'));
      box(x + dx - 0.02, a, x + dx + 0.02, b, y0, y0 + 0.04, '#f8f9fa'); box(x + dx - 0.02, a, x + dx + 0.02, b, y1 - 0.04, y1, '#f8f9fa');
    });
    box(x + 0.03, (z0 + z1) / 2 - 0.012, x + 0.05, (z0 + z1) / 2 + 0.012, (y0 + y1) / 2 - 0.06, (y0 + y1) / 2 + 0.06, '#adb5bd');   // 잠금 손잡이
  };
  sash(0, 0.35, 2.55, 0.6, 2.05);     // 유나 방(현관 왼쪽): 복도 쪽 큰 창
  sash(-1.6, 4.52, 6.82, 0.9, 2.08);  // 넓힌 방(현관 오른쪽): 바깥 쪽 큰 창 (벽 거의 전체)
  // ── 방 벽 ──
  // 침실 A (북서, 유나 방): 남쪽 벽에 문
  wall(0, 2.84, 1.75, 2.84); wall(2.5, 2.84, 2.57, 2.84); wall(1.75, 2.84, 2.5, 2.84, { y0: 2.0 });
  wall(2.57, 0, 2.57, 2.84);
  hinged('bedA', 1.75, 2.84, 0.75, 0, 1.45, '#fffaf2', { fadeZ: 2.84 });
  gates.push({ r: [1.75, 2.6, 2.5, 3.08], door: 'bedA' });
  // 침실 B (남서, 현관 오른쪽): 북쪽 벽에 문. 서쪽으로 복도 자리(x -1.6)까지 넓힌 방
  wall(-1.6, 4.38, 0, 4.38, { h: 2.4 }); wall(-1.6, 4.38, -1.6, 4.52, { h: 2.4 }); wall(-1.6, 6.82, -1.6, 6.96, { h: 2.4 }); wall(-1.6, 4.52, -1.6, 6.82, { h: 0.9 }); wall(-1.6, 4.52, -1.6, 6.82, { y0: 2.08, h: 2.4 });
  wall(0, 4.38, 1.75, 4.38); wall(2.5, 4.38, 2.61, 4.38); wall(1.75, 4.38, 2.5, 4.38, { y0: 2.0 });
  wall(2.61, 4.38, 2.61, 6.96);
  hinged('bedB', 1.75, 4.38, 0.75, 0, -1.45, '#fffaf2', { fadeZ: 4.38 });
  gates.push({ r: [1.75, 4.14, 2.5, 4.62], door: 'bedB' });
  // 붙박이장 (욕실 서쪽)
  box(2.63, 0.06, 3.25, 1.9, 0, WALL_H, '#f3ead9', { solid: true });
  // 욕실: 남쪽 벽에 문
  wall(3.25, 1.88, 4.15, 1.88); wall(4.8, 1.88, 4.87, 1.88); wall(4.15, 1.88, 4.8, 1.88, { y0: 2.0 });
  hinged('bath', 4.8, 1.88, 0.65, Math.PI, -1.45, '#fffaf2', { fadeZ: 1.88 });
  gates.push({ r: [4.15, 1.64, 4.8, 2.12], door: 'bath' });
  // 안방 (북동): 서쪽 벽에 문, 남쪽 벽
  wall(4.87, 0, 4.87, 2.75); wall(4.87, 2.75, 4.87, 3.48, { y0: 2.0 });
  wall(4.87, 3.48, 8.62, 3.48);
  hinged('bedC', 4.87, 3.45, 0.7, Math.PI / 2, -1.45, '#fffaf2');
  gates.push({ r: [4.63, 2.75, 5.11, 3.45], door: 'bedC' });
  // 안방 ↔ 베란다: 창이 있는 벽
  wall(8.62, 0, 8.62, 3.48, { h: 0.9 }); wall(8.62, 0, 8.62, 0.5); wall(8.62, 3.0, 8.62, 3.48); wall(8.62, 0.5, 8.62, 3.0, { y0: 1.95 });
  box(8.6, 0.5, 8.64, 3.0, 0.9, 1.95, 0, { mat: glass });
  box(8.58, 1.72, 8.66, 1.78, 0.9, 1.95, '#ffffff');

  // ── 현관: 회색 현관문 + 흰색 중문(미닫이) + 신발장 ──
  hinged('front', 0, 4.05, 0.9, Math.PI / 2, 1.7, '#8d9199', { h: 2.05, knob: '#d1d5db' });
  gates.push({ r: [-0.3, 3.15, 0.06, 4.05], door: 'front', needShoes: true });
  const frameM = L('#ffffff'), paneM = L('#dff1fb', { transparent: true, opacity: 0.35, depthWrite: false });
  const glassPanel = (w, h, parent) => {   // 흰 틀 + 유리 한 짝 (가운데가 원점, 폭은 x)
    const gp = new THREE.Group(); parent.add(gp);
    const bar = (bw, bh, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.045), frameM); m.position.set(x, y, 0); gp.add(m); };
    bar(w, 0.07, 0, 0.035); bar(w, 0.07, 0, h - 0.035); bar(0.06, h, -w / 2 + 0.03, h / 2); bar(0.06, h, w / 2 - 0.03, h / 2); bar(w, 0.04, 0, h * 0.42);
    const g = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h - 0.12, 0.012), paneM); g.position.set(0, h / 2, 0); gp.add(g);
    return gp;
  };
  const midFixed = glassPanel(0.74, 2.1, floorG); midFixed.rotation.y = Math.PI / 2; midFixed.position.set(1.2, 0, 3.225);
  const midSlide = glassPanel(0.78, 2.1, floorG); midSlide.rotation.y = Math.PI / 2; midSlide.position.set(1.255, 0, 3.99);
  solids.push([1.16, 2.84, 1.28, 3.6]);
  box(1.14, 2.84, 1.3, 4.38, 2.1, WALL_H, '#ffffff');
  doors.mid = { id: 'mid', slide: midSlide, open: 0, target: 0 };
  gates.push({ r: [0.98, 3.6, 1.5, 4.38], door: 'mid' });
  box(0.12, 2.9, 1.1, 3.13, 0, 1.05, '#ffffff', { solid: true, cast: true });       // 신발장
  box(0.14, 2.9, 1.08, 3.14, 0.5, 0.52, '#e5e7eb');
  // 신발 (누르면 신는다)
  // 앞코가 현관문(서쪽)을 보게 가지런히, 두 줄
  const shoePairs = SHOE_KINDS.map(sk => {
    const grp = new THREE.Group(); floorG.add(grp); grp.position.set(sk.x, 0.004, SHOE_ROW_Z[sk.row]); grp.rotation.y = -Math.PI / 2;
    [-1, 1].forEach(k => { const sh = makeShoe(sk.kind, sk.color); sh.position.x = k * 0.058; sh.rotation.y = k * 0.06; grp.add(sh); });
    return { ...sk, grp };
  });

  // ── 가구 ──
  const furn = (x0, z0, x1, z1, h, color, o = {}) => box(x0, z0, x1, z1, o.y0 || 0, h, color, { solid: o.solid !== false, cast: true });
  // 거실: TV(북쪽 벽) · 러그 · 소파(남쪽, 등받이가 카메라 쪽)
  // TV장: 흰 템바보드(세로 홈) 서랍 4개
  furn(5.6, 3.56, 7.8, 3.96, 0.42, '#eceef0');
  for (let x = 5.62; x < 7.79; x += 0.036) box(x, 3.96, x + 0.022, 3.985, 0.03, 0.4, '#ffffff');
  [6.15, 6.7, 7.25].forEach(x => box(x - 0.006, 3.96, x + 0.006, 3.99, 0.03, 0.4, '#c9ccd1'));
  box(5.6, 3.56, 7.8, 3.99, 0.42, 0.44, '#f8f9fa');
  // 77인치 TV (벽에 반쯤 묻힘): 벽 홈 + 얇게 튀어나온 화면
  box(5.8, 3.54, 7.6, 3.55, 0.68, 1.78, '#d6d0c4');
  const tv = box(5.845, 3.54, 7.555, 3.575, 0.72, 1.74, 0, { mat: L('#1f2937') });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.67, 0.96), new THREE.MeshBasicMaterial({ color: '#111827' })); tvScreen.position.set(6.7, 1.23, 3.577); floorG.add(tvScreen);
  // 스탠드 에어컨 (흰색): TV장과 폴딩도어 사이, 거실 대각선을 본다
  {
    const ac = new THREE.Group(); ac.position.set(8.1, 0, 3.82); ac.rotation.y = -Math.PI / 4; floorG.add(ac);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.82, 0.3), L('#f8f9fa')); body.position.y = 0.91; body.castShadow = true; ac.add(body);
    [1.5, 1.1].forEach(y => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 24), L('#dee2e6')); r.rotation.x = Math.PI / 2; r.position.set(0, y, 0.151); ac.add(r); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.022, 20), L('#adb5bd')); c.rotation.x = Math.PI / 2; c.position.set(0, y, 0.152); ac.add(c); });
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.04), new THREE.MeshBasicMaterial({ color: '#4dabf7' })); d.position.set(0, 0.8, 0.152); ac.add(d);
    solids.push([7.9, 3.62, 8.3, 4.02]);
  }
  // 공기청정기 (브론즈, 원통형): TV장 왼편
  {
    const pc = new THREE.Group(); pc.position.set(5.3, 0, 3.8); floorG.add(pc);
    const add = (geo, c, y) => { const m = new THREE.Mesh(geo, L(c)); m.position.y = y; m.castShadow = true; pc.add(m); };
    add(new THREE.CylinderGeometry(0.16, 0.17, 0.62, 28), '#a8794f', 0.31);   // 아래 몸통
    add(new THREE.CylinderGeometry(0.162, 0.162, 0.05, 28), '#d9c3a5', 0.645);
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 28), '#b58a5f', 0.85);   // 위 몸통
    add(new THREE.CylinderGeometry(0.13, 0.16, 0.04, 28), '#5c4632', 1.05);
    for (let i = 0; i < 6; i++) add(new THREE.TorusGeometry(0.168, 0.004, 4, 28).rotateX(Math.PI / 2), '#8a5f3a', 0.08 + i * 0.09);   // 흡입구 줄
    solids.push([5.12, 3.62, 5.48, 3.98]);
  }
  floorRect(5.6, 4.25, 7.8, 5.65, L('#ffd6e7'), 0.006);
  floorRect(5.75, 4.4, 7.65, 5.5, L('#ffe9f2'), 0.008);
  // 소파: 베이지 2.5인용, 오른쪽 끝이 베란다(폴딩도어) 선까지 붙는다
  {
    const SX0 = 6.3, SX1 = 8.56, sb = '#e3d3b6', sc = '#efe3cc';
    furn(SX0, 5.95, SX1, 6.6, 0.38, sb); furn(SX0, 6.6, SX1, 6.88, 0.86, '#d8c6a5');
    furn(SX0, 5.95, SX0 + 0.2, 6.88, 0.6, '#d8c6a5'); furn(SX1 - 0.2, 5.95, SX1, 6.88, 0.6, '#d8c6a5');   // 팔걸이
    const w = (SX1 - SX0 - 0.42) / 2;
    [0, 1].forEach(i => { const a = SX0 + 0.2 + 0.01 + i * w; box(a, 5.98, a + w - 0.02, 6.6, 0.38, 0.49, sc, { cast: true }); box(a, 6.42, a + w - 0.02, 6.62, 0.49, 0.84, sc, { cast: true }); });   // 방석·등쿠션
  }
  // 냉장고: 아기 방과 욕실 사이, 문이 주방(남쪽)을 본다 (양문형)
  furn(2.64, 2.1, 3.6, 2.82, 1.85, '#dfe3e8');
  box(3.115, 2.82, 3.125, 2.84, 0.05, 1.82, '#aab1bb');                                   // 가운데 틈
  [3.06, 3.18].forEach(x => box(x - 0.012, 2.84, x + 0.012, 2.87, 0.8, 1.35, '#9ca3af'));   // 손잡이
  box(2.72, 2.84, 2.92, 2.845, 1.2, 1.4, 0, { mat: L('#1f2937') });                       // 디스플레이
  // 화장대: 냉장고 왼편(동쪽)과 욕실 문 사이, 안방(동쪽)을 본다. 의자 없음, 위 수납 · 가운데 거울 · 아래 수납
  {
    const vw = '#f7f1e8';
    furn(3.62, 1.96, 4.04, 2.82, 0.8, vw);                                                 // 아래 수납
    box(4.04, 2.0, 4.055, 2.38, 0.06, 0.76, '#ece3d4'); box(4.04, 2.40, 4.055, 2.78, 0.06, 0.76, '#ece3d4');   // 아래 문 두 짝
    [2.34, 2.44].forEach(z => box(4.055, z - 0.012, 4.07, z + 0.012, 0.5, 0.62, '#b8a78f'));
    box(3.62, 1.96, 4.06, 2.82, 0.8, 0.83, '#e2d6c4');                                     // 상판
    box(3.62, 1.96, 3.68, 2.82, 0.83, 2.1, 0, { mat: L(vw) });                              // 뒤판
    box(3.68, 2.06, 3.695, 2.72, 0.95, 1.55, 0, { mat: L('#d4ecf7') });                      // 거울
    box(3.62, 1.96, 3.94, 2.82, 1.62, 2.1, vw, { cast: true });                             // 위 수납
    box(3.94, 2.0, 3.955, 2.38, 1.65, 2.07, '#ece3d4'); box(3.94, 2.40, 3.955, 2.78, 1.65, 2.07, '#ece3d4');
    [['#ffc9de', 2.2], ['#c5f6fa', 2.32], ['#ffe8a3', 2.6]].forEach(([c, z], i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12 + i * 0.03, 12), L(c)); b.position.set(3.8, 0.89 + i * 0.015, z); floorG.add(b); });
  }
  // 주방 (현관에서 오른쪽): 냉장고가 있던 자리부터 ㄱ자 싱크대 · 식탁
  furn(2.68, 4.45, 3.28, 6.36, 0.85, '#fdf6ec'); box(2.68, 4.45, 3.3, 6.36, 0.85, 0.89, '#6b7280');
  // 얼음정수기 (베이지, 냉장고가 있던 자리 위)
  furn(2.74, 4.55, 3.12, 4.95, 1.38, '#e9dcc3', { y0: 0.89 });
  box(3.12, 4.68, 3.15, 4.82, 1.02, 1.16, '#6b5d4b');                                      // 물 나오는 곳
  box(3.06, 4.62, 3.2, 4.88, 0.89, 0.92, '#cbbd9f');                                       // 물받이
  box(3.12, 4.6, 3.125, 4.9, 1.24, 1.32, 0, { mat: L('#3f3a33') });                        // 버튼판
  // 수전 (예전 가스레인지 자리)
  box(2.8, 5.45, 3.2, 6.05, 0.86, 0.9, '#d1d5db');
  box(2.73, 5.72, 2.79, 5.78, 0.89, 1.18, '#adb5bd'); box(2.73, 5.72, 2.98, 5.78, 1.14, 1.18, '#adb5bd');
  // 남쪽 싱크대: 소파 옆 끝에 3구 인덕션 + 아래 식기세척기
  furn(2.68, 6.36, 4.45, 6.9, 0.85, '#fdf6ec'); box(2.68, 6.34, 4.45, 6.9, 0.85, 0.89, '#6b7280');
  box(3.68, 6.4, 4.38, 6.86, 0.89, 0.905, '#111827');
  [[3.86, 6.54, 0.1], [4.2, 6.54, 0.1], [4.03, 6.74, 0.08]].forEach(([x, z, r]) => { const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 24), L('#ff8a65')); b.rotation.x = Math.PI / 2; b.position.set(x, 0.908, z); floorG.add(b); });
  box(3.68, 6.33, 4.38, 6.36, 0.08, 0.8, '#d9dde2');                                       // 식기세척기 문
  box(3.75, 6.31, 4.31, 6.33, 0.72, 0.75, '#9ca3af');
  // 싱크대 끝과 소파 사이 벽: 가로로 길고, 세로(두께)는 싱크대 깊이와 같다 + 그 앞(북쪽)으로 흰 아일랜드 식탁
  { const kw = wall(4.45, 6.66, 5.4, 6.66, { h: WALL_H, t: 0.6, noFade: true });   // 시야를 가리지 않게 투명, 테두리만 보인다
    kw.material = L('#fbf6ee', { transparent: true, opacity: 0.22, depthWrite: false }); kw.castShadow = false;
    kw.add(new THREE.LineSegments(new THREE.EdgesGeometry(kw.geometry), new THREE.LineBasicMaterial({ color: '#c9bfae' }))); }
  furn(4.66, 4.66, 5.2, 6.36, 0.88, '#ffffff'); box(4.6, 4.6, 5.26, 6.36, 0.88, 0.92, '#f8f9fa', { cast: true });   // 북쪽 끝은 TV장과 사이에 지나갈 틈을 남김
  [5.0, 5.5, 6.0].forEach(z => { furn(4.24, z - 0.15, 4.54, z + 0.15, 0.6, '#ffffff', { solid: false }); box(4.32, z - 0.07, 4.46, z + 0.07, 0, 0.58, '#ced4da'); });   // 의자(스툴)
  // 광파오븐: ㄱ자로 꺾이는 모서리 위, 문이 수전(북쪽)을 본다
  furn(2.74, 6.42, 3.26, 6.86, 1.24, '#1c1d21', { y0: 0.89 });
  box(2.78, 6.405, 3.08, 6.42, 0.95, 1.2, 0, { mat: L('#34383f') });                        // 유리 문
  box(3.1, 6.405, 3.22, 6.42, 0.95, 1.2, 0, { mat: L('#3f444c') });                         // 조작부
  box(3.13, 6.4, 3.19, 6.405, 1.12, 1.16, 0, { mat: new THREE.MeshBasicMaterial({ color: '#7dd3fc' }) });
  box(2.8, 6.39, 3.06, 6.405, 1.17, 1.19, '#c3c8cf');                                       // 손잡이
  // 유나 방 (침실 A)
  furn(0.8, 0.12, 2.5, 1.02, 0.32, '#fff0f6'); furn(2.37, 0.12, 2.5, 1.02, 0.62, '#f8b4d0'); box(0.83, 0.17, 1.95, 0.97, 0.32, 0.38, '#ffc2dc', { cast: true }); box(2.05, 0.24, 2.32, 0.9, 0.32, 0.42, '#ffffff');
  furn(0.12, 2.4, 1.6, 2.78, 0.9, '#ffe8a3'); [['#74c0fc', 0.4], ['#ff8787', 0.85], ['#69db7c', 1.3]].forEach(([c, x]) => box(x - 0.1, 2.46, x + 0.1, 2.7, 0.9, 1.08, c, { cast: true }));
  // 침실 B: 창 앞 현관 쪽(북쪽 벽)에 책꽂이 달린 컴퓨터 책상
  {
    const dk = '#e8d5b5', sh = '#dcc6a0';
    furn(-1.52, 4.46, 0.15, 5.16, 0.72, dk);
    box(-1.52, 4.44, 0.15, 4.5, 0.72, 1.75, sh); box(-1.52, 4.46, -1.48, 4.78, 0.72, 1.75, sh); box(0.11, 4.46, 0.15, 4.78, 0.72, 1.75, sh);   // 책꽂이 뒤판·옆판
    box(-1.52, 4.46, 0.15, 4.78, 1.71, 1.75, sh, { cast: true }); box(-1.52, 4.46, 0.15, 4.78, 1.2, 1.23, sh);                               // 위판·선반
    const bc = ['#ff8787', '#74c0fc', '#ffd43b', '#69db7c', '#b197fc', '#ffa94d', '#63e6be', '#f783ac'];
    for (let i = 0, x = -1.44; x < 0.05; i++) { const w = 0.05 + (i * 37 % 5) * 0.012, h = 0.2 + (i * 53 % 4) * 0.03; box(x, 4.52, x + w, 4.74, 1.23, 1.23 + h, bc[i % bc.length]); x += w + 0.012; }
    box(-0.9, 4.86, -0.3, 4.89, 0.84, 1.2, 0, { mat: L('#1f2937') }); box(-0.63, 4.88, -0.57, 4.94, 0.72, 0.84, '#4b5563');   // 모니터
    box(-0.82, 4.98, -0.4, 5.08, 0.72, 0.735, '#e9ecef');                                                                       // 키보드
    furn(-0.8, 5.28, -0.4, 5.64, 0.45, '#adb5bd', { solid: false }); box(-0.8, 5.58, -0.4, 5.64, 0.45, 0.95, '#868e96');      // 의자
  }
  // 창 앞 반대쪽(남쪽 벽): 검정 스타일러, 문이 현관(북쪽)을 본다
  furn(-1.52, 6.3, -0.9, 6.9, 1.9, '#16181c');
  box(-1.49, 6.285, -0.93, 6.3, 0.08, 1.84, 0, { mat: L('#2a2e35') });
  box(-1.0, 6.27, -0.975, 6.285, 0.75, 1.35, '#9ca3af');
  box(-1.4, 6.282, -1.2, 6.285, 1.62, 1.7, 0, { mat: new THREE.MeshBasicMaterial({ color: '#e5e7eb' }) });
  // 문 열고 들어온 앞쪽 ㄱ자 공간(동쪽 벽 + 남쪽 벽): 위는 옷걸이, 아래는 서랍
  {
    const cw = '#f3ead9', dr = '#ebe0cc', hd = '#b8a78f';
    furn(2.0, 5.25, 2.55, 6.9, 0.7, cw); furn(0.9, 6.35, 2.0, 6.9, 0.7, cw);
    [[5.3, 5.95], [6.0, 6.65]].forEach(([a, b]) => [0.06, 0.38].forEach(y => { box(1.985, a, 2.0, b, y, y + 0.28, dr); box(1.97, (a + b) / 2 - 0.06, 1.985, (a + b) / 2 + 0.06, y + 0.12, y + 0.16, hd); }));
    [[0.95, 1.45], [1.5, 1.95]].forEach(([a, b]) => [0.06, 0.38].forEach(y => { box(a, 6.335, b, 6.35, y, y + 0.28, dr); box((a + b) / 2 - 0.06, 6.32, (a + b) / 2 + 0.06, 6.335, y + 0.12, y + 0.16, hd); }));
    box(2.0, 5.25, 2.55, 5.29, 0.7, 1.98, cw); box(0.9, 6.35, 0.94, 6.9, 0.7, 1.98, cw);                                  // 옆 기둥
    box(2.0, 5.25, 2.57, 6.9, 1.95, 1.99, cw, { cast: true }); box(0.9, 6.35, 2.0, 6.92, 1.95, 1.99, cw, { cast: true });  // 위 선반
    box(2.26, 5.29, 2.29, 6.62, 1.82, 1.85, '#adb5bd'); box(0.94, 6.61, 2.29, 6.64, 1.82, 1.85, '#adb5bd');             // 봉
    const cc = ['#ffc9de', '#a5d8ff', '#ffe066', '#b2f2bb', '#d0bfff', '#ffd8a8', '#99e9f2'];
    for (let i = 0, z = 5.4; z < 6.45; i++, z += 0.17) box(2.06, z - 0.03, 2.5, z + 0.03, 1.08 + (i % 3) * 0.08, 1.8, cc[i % cc.length], { cast: true });
    for (let i = 0, x = 1.02; x < 1.95; i++, x += 0.17) box(x - 0.03, 6.4, x + 0.03, 6.86, 1.1 + (i % 3) * 0.08, 1.8, cc[(i + 3) % cc.length], { cast: true });
  }
  floorRect(-0.6, 5.6, 0.8, 6.25, L('#d0ebff'), 0.006);
  // 안방: 침대 머리가 거실 TV 쪽(남쪽 벽), 반대편 북쪽 벽은 미닫이문 4짝 붙박이장
  furn(5.85, 1.3, 7.75, 3.3, 0.36, '#f4f1ea'); furn(5.8, 3.28, 7.8, 3.42, 0.95, '#c9ada7');
  box(5.9, 1.33, 7.7, 2.6, 0.36, 0.43, '#b8d8be', { cast: true });
  [6.35, 7.25].forEach(x => box(x - 0.3, 2.75, x + 0.3, 3.1, 0.36, 0.47, '#ffffff'));
  box(4.95, 0.06, 8.55, 0.62, 0, WALL_H, '#f3ead9', { solid: true });
  for (let i = 0; i < 4; i++) {
    const x0 = 4.95 + i * 0.9, z0 = i % 2 ? 0.62 : 0.65;
    box(x0 + 0.01, z0, x0 + 0.89, z0 + 0.03, 0.04, WALL_H - 0.06, i % 2 ? '#f6efe3' : '#fbf6ee');
    const hx = i % 2 ? x0 + 0.08 : x0 + 0.82; box(hx - 0.012, z0 + 0.03, hx + 0.012, z0 + 0.045, 0.85, 1.25, '#c8b89d');
  }
  // 욕실: 욕조 · 세면대 · 변기
  furn(3.33, 0.1, 4.8, 0.78, 0.5, '#ffffff'); box(3.4, 0.17, 4.73, 0.71, 0.4, 0.46, '#a5d8ff');
  furn(3.33, 0.95, 3.72, 1.32, 0.78, '#ffffff'); furn(3.33, 1.42, 3.8, 1.8, 0.4, '#ffffff'); box(3.33, 1.44, 3.48, 1.78, 0.4, 0.78, '#ffffff');
  // 베란다 (확장형): 화분 · 작은 탁자
  const plant = (x, z) => { box(x - 0.14, z - 0.14, x + 0.14, z + 0.14, 0, 0.28, '#e9967a', { solid: true, cast: true }); [[0, 0.55, 0.22], [0.1, 0.78, 0.16], [-0.08, 0.92, 0.13]].forEach(([dx, y, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), L('#51cf66')); s.position.set(x + dx, y, z); s.castShadow = true; floorG.add(s); }); };
  plant(9.75, 5.55); plant(8.95, 0.35);
  {
    const cw = '#f6f1e9', dr = '#ece4d6', X0 = 8.78, X1 = 10.0, Z0 = 6.32, Z1 = 6.92;
    furn(X0, Z0, X1, Z1, 0.85, cw);                                                              // 아래 수납
    box(X0, Z0 - 0.02, X1, Z0, 0.82, 0.85, '#e2d6c4');
    for (let i = 0; i < 3; i++) { const a = X0 + 0.02 + i * 0.4; box(a, Z0 - 0.015, a + 0.38, Z0, 0.06, 0.8, dr); box(a + 0.17, Z0 - 0.03, a + 0.21, Z0 - 0.015, 0.68, 0.72, '#b8a78f'); }
    box(X0, Z1 - 0.04, X1, Z1, 0.85, 1.5, cw);                                                  // 가운데 뒤판
    box(X0, Z0, X0 + 0.03, Z1, 0.85, 1.5, cw); box(X1 - 0.03, Z0, X1, Z1, 0.85, 1.5, cw);        // 가운데 옆판
    box(X0 + 0.05, Z0 - 0.12, X1 - 0.05, Z1 - 0.06, 0.86, 0.89, '#ddd3c3');                      // 앞으로 당겨 쓰는 선반
    [X0 + 0.06, X1 - 0.06].forEach(x => box(x - 0.012, Z0 - 0.12, x + 0.012, Z1 - 0.06, 0.88, 0.9, '#adb5bd'));   // 레일
    // 커피머신 + 컵
    box(9.2, 6.4, 9.55, 6.78, 0.89, 1.27, '#2f3238', { cast: true }); box(9.24, 6.38, 9.51, 6.4, 1.08, 1.14, '#5b616b');
    box(9.3, 6.36, 9.45, 6.44, 0.89, 0.91, '#868e96');
    { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 14), L('#ffffff')); cup.position.set(9.375, 0.945, 6.42); floorG.add(cup); }
    box(9.7, 6.5, 9.88, 6.8, 0.89, 1.0, '#c9a27e');                                              // 캡슐 통
    box(X0, Z0 + 0.12, X1, Z1, 1.5, 2.15, cw, { cast: true });                                    // 위 수납
    for (let i = 0; i < 3; i++) { const a = X0 + 0.02 + i * 0.4; box(a, Z0 + 0.105, a + 0.38, Z0 + 0.12, 1.53, 2.12, dr); box(a + 0.17, Z0 + 0.09, a + 0.21, Z0 + 0.105, 1.56, 1.6, '#b8a78f'); }
  }
  {
    furn(9.22, 0.07, 9.98, 0.82, 1.95, '#ece7df');
    box(9.24, 0.82, 9.96, 0.835, 0.92, 1.12, 0, { mat: L('#2b2f36') });                     // 가운데 조작부
    box(9.5, 0.835, 9.7, 0.84, 0.98, 1.06, 0, { mat: new THREE.MeshBasicMaterial({ color: '#7dd3fc' }) });
    [0.5, 1.5].forEach(y => {                                                               // 아래 세탁기 · 위 건조기
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 28), L('#c3c8cf')); ring.rotation.x = Math.PI / 2; ring.position.set(9.6, y, 0.835); floorG.add(ring);
      const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 28), L('#4b5563')); gl.rotation.x = Math.PI / 2; gl.position.set(9.6, y, 0.84); floorG.add(gl);
    });
  }
  furn(9.35, 1.6, 9.9, 2.15, 0.5, '#ffffff');
  // 폴딩도어 (거실 ↔ 베란다, 접어서 열어 둔 모습): 네 짝이 지그재그로 북쪽에 모여 있다
  {
    box(8.56, 3.54, 8.68, 6.9, 2.1, WALL_H, '#ffffff'); box(8.59, 3.54, 8.65, 6.9, 0, 0.012, '#d1d5db');
    let px = 8.62, pz = 3.6; const w = 0.8;
    for (let i = 0; i < 4; i++) {
      const a = (i % 2 ? -1 : 1) * 1.2, dx = Math.sin(a) * w, dz = Math.cos(a) * w * 0.28 + 0.06;
      const p = glassPanel(w, 2.08, floorG); p.position.set(px + dx / 2, 0, pz + dz / 2); p.rotation.y = Math.atan2(dx, dz) - Math.PI / 2 + Math.PI;
      px += dx; pz += dz;
    }
    solids.push([8.3, 3.5, 8.95, 4.15]);
  }

  // ── 장난감 (거실 러그) ──
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshLambertMaterial({ map: canvasTex(128, 64, (c, w, h) => { ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w / 4, 0, w / 4, h); }); }) }));
  ball.position.set(6.2, 0.16, 5.0); ball.castShadow = true; floorG.add(ball);
  const teddy = new THREE.Group(); floorG.add(teddy); teddy.position.set(7.35, 0, 4.75);
  { const br = L('#c68b59'), cr = L('#f0d2a8'); const sp = (r, x, y, z, m, s) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); o.castShadow = true; if (s) o.scale.set(...s); teddy.add(o); };
    sp(0.16, 0, 0.17, 0, br, [1, 1.05, 0.9]); sp(0.13, 0, 0.42, 0, br); sp(0.05, -0.1, 0.53, 0, br); sp(0.05, 0.1, 0.53, 0, br); sp(0.06, 0, 0.39, 0.1, cr, [1, 0.8, 0.8]);
    sp(0.018, -0.045, 0.45, 0.115, L('#1f2937')); sp(0.018, 0.045, 0.45, 0.115, L('#1f2937')); sp(0.02, 0, 0.41, 0.155, L('#1f2937'));
    sp(0.06, -0.17, 0.2, 0.05, br); sp(0.06, 0.17, 0.2, 0.05, br); sp(0.07, -0.09, 0.05, 0.14, br); sp(0.07, 0.09, 0.05, 0.14, br); }
  const blocks = new THREE.Group(); floorG.add(blocks); blocks.position.set(6.0, 0, 4.55);
  const blockCols = ['#ff8787', '#ffd43b', '#74c0fc', '#69db7c', '#b197fc'];
  const blockMeshes = blockCols.map((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), L(c)); b.castShadow = true; b.position.set(0, 0.1 + i * 0.2, 0); b.rotation.y = i * 0.5; b.visible = i < 2; blocks.add(b); return b; });

  // ── 복도 (복도식 아파트, 서쪽이 바깥). 현관 오른쪽 방(침실 B)이 복도 자리까지 넓혀져 있어 복도는 거기서 끝나고(끝집 1404호),
  //    현관문을 나와 오른쪽(북쪽)으로 옆집(1403호)을 지나 중앙 복도에서 오른쪽으로 꺾으면 엘리베이터 대기 공간, 가장 먼(북쪽) 벽에 엘리베이터 두 대 ──
  const corr = new THREE.MeshLambertMaterial({ map: tileTex('#cfd4da', '#c6ccd3', 'rgba(110,118,128,0.35)') });
  floorRect(-1.6, END_Z, 0, 4.38, corr, 0, floorG, 0.8);
  const hallTile = new THREE.MeshLambertMaterial({ map: tileTex('#f1ece3', '#e8e1d6', 'rgba(150,140,125,0.45)') });
  floorRect(0, LZ0, LX1, HALL_Z, hallTile, 0, floorG, 0.8);
  box(-1.72, END_Z - 0.12, 0, 4.38, -0.3, -0.001, '#b8bec6');                       // 복도 바닥판
  // 위층 바닥판(천장)·위아래층 건물 벽: 집 안을 내려다볼 때는 가려서 숨긴다 (outerG)
  const outerG = new THREE.Group(); floorG.add(outerG);
  box(-1.72, END_Z - 0.12, 0.05, 4.38, 2.4, 2.56, '#e8ebee', { parent: outerG });
  box(0, LZ0, LX1, HALL_Z, 2.4, 2.56, '#f3f0ea', { parent: outerG });                      // 대기 공간 천장
  [[HALL_Z, 4.38], [END_Z - 0.12, LZ0]].forEach(([a, b]) => { box(0.02, a, 0.12, b, -12, -0.3, '#f1e9dc', { parent: outerG }); box(0.02, a, 0.12, b, 2.56, 9, '#f1e9dc', { parent: outerG }); });
  box(-1.66, 4.32, -1.54, 7.02, -12, -0.001, '#f1e9dc', { parent: outerG }); box(-1.66, 4.32, -1.54, 7.02, 2.4, 9, '#f1e9dc', { parent: outerG });
  // 난간: 콘크리트(시멘트) 벽
  box(-1.74, END_Z - 0.12, -1.5, 4.38, 0, 1.1, '#cdc8bf', { cast: true });
  box(-1.78, END_Z - 0.12, -1.46, 4.38, 1.1, 1.16, '#bdb7ad');
  box(-1.75, END_Z - 0.12, -1.49, 4.38, 0, 0.08, '#b5afa5');
  solids.push([-1.9, END_Z - 0.4, -1.5, 4.38]);
  wall(-1.6, END_Z, 0.1, END_Z, { h: 2.4, noFade: true, color: '#f1e9dc' });      // 복도 북쪽 끝
  // 옆집 1403호
  wall(0, HALL_Z, 0, -4.04, { h: 2.4 }); wall(0, -3.14, 0, 0, { h: 2.4 }); wall(0, -4.04, 0, -3.14, { y0: 2.05, h: 2.4 });
  box(-0.03, -4.04, 0.03, -3.14, 0, 2.05, '#8d9199'); { const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), L('#d1d5db')); k.position.set(-0.06, 0.95, -3.24); floorG.add(k); }
  solids.push([0.06, HALL_Z + 0.06, 10.4, -0.06]);
  const winBars = (z0, z1, see, y0 = 1.0, y1 = 1.9) => { if (!see) box(-0.07, z0, -0.02, z1, y0, y1, 0, { mat: L('#bcd9ea') }); for (let z = z0; z <= z1 + 0.01; z += 0.16) box(-0.09, z - 0.012, -0.06, z + 0.012, y0, y1, '#9ca3af'); box(-0.1, z0 - 0.04, -0.02, z1 + 0.04, y0 - 0.04, y0, '#e5e7eb'); };
  winBars(0.35, 2.55, true, 0.6, 2.05); winBars(-2.4, -1.2); winBars(-6.2, -5.0);
  const plate = (txt, z) => { const m = labelMesh(txt, 0.34, 0.16, { bg: '#374151', fg: '#ffffff' }); m.rotation.y = -Math.PI / 2; m.position.set(-0.07, 1.7, z); floorG.add(m); };
  plate(`${HOME}04`, 2.9); plate(`${HOME}03`, -2.9);
  box(-0.22, -6.6, -0.06, -6.4, 0, 0.5, '#e03131', { solid: true, cast: true });   // 소화기
  // 중앙 복도 건너편 1402호 (엘리베이터 대기 공간 북쪽)
  wall(0, LZ0, 0, -12.5, { h: 2.4 }); wall(0, -13.4, 0, END_Z, { h: 2.4 }); wall(0, -13.4, 0, -12.5, { y0: 2.05, h: 2.4 });
  box(-0.03, -13.4, 0.03, -12.5, 0, 2.05, '#8d9199'); { const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), L('#d1d5db')); k.position.set(-0.06, 0.95, -12.6); floorG.add(k); }
  plate(`${HOME}02`, -12.0); winBars(-11.6, -10.6);
  solids.push([0.06, END_Z - 0.4, 10.4, LZ0 - 1.8]);
  // ── 엘리베이터 대기 공간 (복도에서 오른쪽(동쪽)으로 꺾어 들어감) ──
  const HW = '#e9e4da';
  wall(0, HALL_Z, LX1, HALL_Z, { h: 2.4, t: 0.16, color: HW, noFade: true });                 // 남쪽 벽 (옆집과 사이)
  wall(LX1, LZ0, LX1, HALL_Z, { h: 2.4, t: 0.16, color: HW });                                // 안쪽 끝 벽
  solids.push([LX1, LZ0 - 2, 10.4, HALL_Z]);
  box(LX1 - 0.3, -7.6, LX1 - 0.08, -7.2, 0, 0.9, '#a5d8a0', { solid: true, cast: true });     // 화분 받침
  { const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), L('#51cf66')); s.position.set(LX1 - 0.19, 1.15, -7.4); floorG.add(s); }
  // 가장 먼(북쪽) 벽: 엘리베이터 두 대 (늘 보임 = coreG)
  [[0, EX1 - 0.5], [EX1 + 0.5, EX2 - 0.5], [EX2 + 0.5, LX1]].forEach(([a, b]) => wall(a, LZ0, b, LZ0, { h: 2.4, t: 0.16, color: HW, parent: coreG, noFade: true }));
  [EX1, EX2].forEach(xc => { wall(xc - 0.5, LZ0, xc + 0.5, LZ0, { y0: 2.08, h: 2.4, t: 0.16, color: HW, parent: coreG, noFade: true }); [-1, 1].forEach(k => box(xc + k * 0.5 - 0.04, LZ0 - 0.1, xc + k * 0.5 + 0.04, LZ0 + 0.1, 0, 2.1, '#9aa1ab', { parent: coreG })); box(xc - 0.54, LZ0 - 0.1, xc + 0.54, LZ0 + 0.1, 2.08, 2.14, '#9aa1ab', { parent: coreG }); });
  const floorSign = { mesh: null, set(n) { if (this.mesh) { coreG.remove(this.mesh); } const m = labelMesh(`${n}F`, 0.5, 0.28, { bg: '#1c7ed6', fg: '#ffffff' }); m.position.set(BTN_X, 1.85, LZ0 + 0.09); coreG.add(m); this.mesh = m; } };
  floorSign.set(HOME);
  // 부르는 버튼 (두 엘리베이터 사이, 아이 손 높이)
  box(BTN_X - 0.09, LZ0 + 0.07, BTN_X + 0.09, LZ0 + 0.11, 0.82, 1.2, '#d1d5db', { parent: coreG });
  const callMat = new THREE.MeshLambertMaterial({ color: '#f8f9fa', emissive: '#000000' });
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20), callMat); callBtn.rotation.x = Math.PI / 2; callBtn.position.set(BTN_X, 1.0, LZ0 + 0.12); coreG.add(callBtn);
  const callHit = box(BTN_X - 0.3, LZ0 + 0.05, BTN_X + 0.3, LZ0 + 0.3, 0.6, 1.5, 0, { parent: coreG, mat: new THREE.MeshBasicMaterial({ visible: false }) });
  // 엘리베이터 두 대 (문은 남쪽, 칸은 북쪽)
  const steel = L('#c9ced6'), carWall = L('#e7e2d6');
  const elevs = [EX1, EX2].map(xc => {
    const g = new THREE.Group(); coreG.add(g);
    const leaves = [-1, 1].map(k => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.08, 0.05), steel); m.position.set(xc + k * 0.25, 1.04, LZ0); g.add(m); return m; });
    const disp = makeDisplay();
    const dm = new THREE.MeshBasicMaterial({ map: disp.tex });
    const out = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), dm); out.position.set(xc, 2.25, LZ0 + 0.09); g.add(out);
    const inn = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), dm); inn.rotation.y = Math.PI; inn.position.set(xc, 2.2, LZ0 - 0.1); g.add(inn);
    // 칸 안
    const Z = LZ0;
    box(xc - 0.75, Z - 1.64, xc + 0.75, Z - 0.06, -0.02, 0, '#6b7280', { parent: g });
    box(xc - 0.8, Z - 1.72, xc + 0.8, Z - 1.64, 0, 2.35, 0, { parent: g, mat: carWall });
    box(xc - 0.8, Z - 1.64, xc - 0.75, Z - 0.06, 0, 2.35, 0, { parent: g, mat: carWall }); box(xc + 0.75, Z - 1.64, xc + 0.8, Z - 0.06, 0, 2.35, 0, { parent: g, mat: carWall });
    box(xc - 0.8, Z - 1.72, xc + 0.8, Z - 0.06, 2.35, 2.4, '#fffdf5', { parent: g });
    box(xc - 0.55, Z - 1.64, xc + 0.55, Z - 1.62, 0.9, 2.0, 0, { parent: g, mat: L('#cfe3ee') });   // 거울
    box(xc - 0.7, Z - 1.6, xc + 0.7, Z - 1.56, 0.85, 0.89, '#9aa1ab', { parent: g });              // 손잡이
    box(xc + 0.725, Z - 0.5, xc + 0.75, Z - 0.3, 0.8, 1.5, '#aab1bb', { parent: g });              // 버튼판
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), L('#fff3bf')); b.position.set(xc + 0.72, 0.9 + Math.floor(i / 2) * 0.16, Z - 0.44 + (i % 2) * 0.08); g.add(b); }
    solids.push([xc - 0.85, Z - 1.8, xc - 0.75, Z], [xc + 0.75, Z - 1.8, xc + 0.85, Z], [xc - 0.85, Z - 1.85, xc + 0.85, Z - 1.64]);
    return { xc, leaves, disp, door: 0 };
  });
  const carLight = new THREE.PointLight('#fff4d6', 0.9, 4); carLight.position.set(EX1, 2.1, LZ0 - 0.8); coreG.add(carLight);

  // ── 1층 (도착했을 때만 보임): 엘리베이터에서 내리면 동서로 긴 복도, 양쪽 끝에 밖으로 내려가는 계단, 바깥 마당 ──
  const solids1 = [], trees1 = [];
  const upper1 = [];   // 위에서 내려다볼 때 가리는 천장·위층·벽 윗부분 (유나가 건물 안·근처에 있으면 숨김)
  const b1 = (x0, z0, x1, z1, y0, y1, color, o = {}) => { const m = box(x0, z0, x1, z1, y0, y1, color, { ...o, parent: lobbyG }); if (o.solid1) solids1.push([x0, z0, x1, z1]); return m; };
  const W1 = '#f5efe4', FAC = '#efe6d8';
  floorRect(F1X0, LZ0, F1X1, F1Z1, new THREE.MeshLambertMaterial({ map: tileTex('#fbf7ef', '#f3ecdf', 'rgba(170,150,120,0.4)') }), 0.001, lobbyG, 1.0);
  b1(F1X0 - 0.1, LZ0 - 2.7, F1X1 + 0.1, F1Z1 + 0.1, -DROP, 0, '#d6d0c6');                 // 바닥판 (밖에서 보면 기단)
  // 북쪽 벽 (엘리베이터 문이 있는 가운데는 coreG)
  b1(F1X0, LZ0 - 0.08, 0, LZ0 + 0.08, 0, 2.4, W1); b1(LX1, LZ0 - 0.08, F1X1, LZ0 + 0.08, 0, 2.4, W1);
  solids1.push([F1X0 - 0.2, LZ0 - 3, F1X1 + 0.2, LZ0 + 0.05]);
  b1(-2.3, LZ0 + 0.08, -0.7, LZ0 + 0.42, 0, 1.3, '#cbd5e1', { solid1: true });              // 우편함
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) b1(-2.25 + i * 0.31, LZ0 + 0.42, -2.0 + i * 0.31, LZ0 + 0.44, 0.2 + j * 0.27, 0.42 + j * 0.27, '#94a3b8');
  // 남쪽 벽 + 창
  b1(F1X0, F1Z1 - 0.08, F1X1, F1Z1 + 0.08, 0, 0.9, W1); upper1.push(b1(F1X0, F1Z1 - 0.08, F1X1, F1Z1 + 0.08, 1.9, 2.4, W1));
  upper1.push(b1(F1X0, F1Z1 - 0.02, F1X1, F1Z1 + 0.02, 0.9, 1.9, 0, { mat: L('#d6f0ff', { transparent: true, opacity: 0.3, depthWrite: false }) }));
  for (let x = F1X0; x <= F1X1 + 0.01; x += (F1X1 - F1X0) / 6) upper1.push(b1(x - 0.04, F1Z1 - 0.06, x + 0.04, F1Z1 + 0.06, 0.9, 1.9, '#9aa1ab'));
  solids1.push([F1X0 - 0.2, F1Z1 - 0.05, F1X1 + 0.2, F1Z1 + 0.4]);
  // 양 끝 벽: 계단으로 열린 곳만 뚫림
  [F1X0, F1X1].forEach(x => {
    b1(x - 0.08, LZ0, x + 0.08, SZ0, 0, 2.4, W1); b1(x - 0.08, SZ1, x + 0.08, F1Z1, 0, 2.4, W1); upper1.push(b1(x - 0.08, SZ0, x + 0.08, SZ1, 2.1, 2.4, W1));
    solids1.push([x - 0.1, LZ0, x + 0.1, SZ0], [x - 0.1, SZ1, x + 0.1, F1Z1 + 0.1]);
  });
  { const m = labelMesh('1F', 0.5, 0.28, { bg: '#2f9e44', fg: '#ffffff' }); m.position.set(BTN_X, 1.85, LZ0 + 0.09); lobbyG.add(m); }
  // 천장 + 위층 건물 (밖에서 보면 아파트)
  upper1.push(b1(F1X0 - 0.1, LZ0 - 2.7, F1X1 + 0.1, F1Z1 + 0.1, 2.4, 2.55, '#f3f0ea'));
  upper1.push(b1(F1X0 - 0.1, LZ0 - 2.7, F1X1 + 0.1, F1Z1 + 0.1, 2.55, 30, FAC));
  b1(F1X0 - 0.1, LZ0 - 2.7, F1X1 + 0.1, LZ0 - 1.8, 0, 2.55, FAC); b1(F1X0 - 0.1, LZ0 - 1.8, 0.1, LZ0 - 0.08, 0, 2.55, FAC); b1(3.5, LZ0 - 1.8, F1X1 + 0.1, LZ0 - 0.08, 0, 2.55, FAC);
  for (let k = 0; k < 10; k++) for (let x = F1X0 + 0.3; x < F1X1 - 0.5; x += 1.45) upper1.push(b1(x, F1Z1 + 0.1, x + 0.95, F1Z1 + 0.13, 3.4 + k * 2.6, 4.5 + k * 2.6, '#a5c8e4'));
  // 계단 (양쪽 끝, 다섯 칸 내려감) + 콘크리트 옆벽
  [-1, 1].forEach(dir => {
    const x0 = dir < 0 ? F1X0 : F1X1;
    for (let i = 0; i < 5; i++) { const a = x0 + dir * 0.3 * i, b = x0 + dir * 0.3 * (i + 1); b1(Math.min(a, b), SZ0, Math.max(a, b), SZ1, -DROP, -0.18 * (i + 1), i % 2 ? '#d4cec4' : '#ddd7cd'); }
    const xa = Math.min(x0, x0 + dir * ST), xb = Math.max(x0, x0 + dir * ST);
    [[SZ0 - 0.15, SZ0], [SZ1, SZ1 + 0.15]].forEach(([za, zb]) => b1(xa, za, xb, zb, -DROP, 0.75, '#cdc8bf', { cast: true, solid1: true }));
  });
  // 바깥 마당: 잔디 · 건물 둘레 보도 · 앞 도로 · 나무 · 벤치
  floorRect(-40, LZ0 - 30, 45, LZ0 + 30, L('#a3d977'), -DROP - 0.01, lobbyG, 1);
  floorRect(F1X0 - ST - 2.5, LZ0 - 4, F1X1 + ST + 2.5, F1Z1 + 3.2, new THREE.MeshLambertMaterial({ map: tileTex('#e6e0d4', '#ddd6c8', 'rgba(150,140,125,0.4)') }), -DROP + 0.002, lobbyG, 0.8);
  floorRect(-40, F1Z1 + 8, 45, F1Z1 + 11.4, L('#6b7280'), -DROP + 0.003, lobbyG, 1);
  for (let x = -38; x < 44; x += 3) b1(x, F1Z1 + 9.62, x + 1.6, F1Z1 + 9.78, -DROP + 0.004, -DROP + 0.006, '#ffe066');
  floorRect(-40, F1Z1 + 7, 45, F1Z1 + 8, L('#d9d4cb'), -DROP + 0.003, lobbyG, 1);
  [[-6.6, LZ0 - 2.4], [-7.2, F1Z1 + 1.8], [10.6, LZ0 - 1.8], [11.2, F1Z1 + 2.2], [2.2, F1Z1 + 5], [-3.2, F1Z1 + 5.4], [7.4, F1Z1 + 5.2], [-9.5, F1Z1 + 4.6]].forEach(([x, z]) => {
    b1(x - 0.12, z - 0.12, x + 0.12, z + 0.12, -DROP, 0.3, '#8d6e4f', { cast: true }); solids1.push([x - 0.3, z - 0.3, x + 0.3, z + 0.3]);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), L('#40c057', { transparent: true })); s.position.set(x, 1.1, z); s.castShadow = true; lobbyG.add(s); trees1.push(s);
  });
  b1(4.0, F1Z1 + 3.9, 5.4, F1Z1 + 4.3, -DROP + 0.4, -DROP + 0.46, '#c08457', { cast: true, solid1: true }); [4.1, 5.2].forEach(x => b1(x, F1Z1 + 3.95, x + 0.1, F1Z1 + 4.25, -DROP, -DROP + 0.4, '#6b7280'));

  // ── 멀리 보이는 동네 (높은 층 느낌) ──
  { const far = new THREE.Group(); floorG.add(far);
    floorRect(-90, -60, 90, 90, L('#b9dba0'), -42, far, 1);
    [[-28, -10, 9, 30], [-40, 14, 10, 22], [-30, 34, 9, 36], [24, -22, 12, 28], [-55, -6, 10, 40], [-24, 60, 9, 26], [40, 30, 10, 34]].forEach(([x, z, w, h]) => box(x - w / 2, z - w / 2, x + w / 2, z + w / 2, -42, -42 + h, '#e9e4dc', { parent: far })); }

  // ── 빛 ──
  scene.add(new THREE.HemisphereLight('#ffffff', '#eadfd2', 1.9));
  const sun = new THREE.DirectionalLight('#fff3dd', 1.5); sun.position.set(-8, 18, 8); sun.target.position.set(4, 0, -1); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 15, bottom: -15, near: 1, far: 60 });

  return { scene, floorG, lobbyG, outerG, upper1, solids, solids1, trees1, fades, taps, doors, gates, shoePairs, ball, teddy, blocks, blockMeshes, tvScreen, tv, callBtn, callMat, callHit, elevs, floorSign };
}

// ─────────────────────────────── 화면 ───────────────────────────────
const HINTS = {
  home: '🏠 가고 싶은 곳을 콕! 밖에 나가려면 현관으로 가요',
  shoes: '🚪 현관문 쪽을 콕! 누르면 신발을 골라요',
  door: '🚪 현관문으로 나가요',
  corridor: '🚶 복도를 따라 가다가 오른쪽으로 꺾으면 엘리베이터예요',
  call: '🔘 엘리베이터 버튼을 콕! 눌러요',
  enter: '🛗 문이 열렸어요! 안으로 들어가요',
  pick: '🔢 몇 층으로 갈까요? 버튼을 콕!',
  lobby: '↔️ 왼쪽이나 오른쪽 계단으로 밖에 나가요',
  outside: '🌳 밖에 나왔어요! 여기저기 걸어 봐요'
};

export default function AdventureGame(props) {
  const [run, setRun] = useState(0);
  return <AdventureScene key={run} {...props} onRestart={() => setRun(r => r + 1)} />;
}

function AdventureScene({ audio, speak, onRestart }) {
  const wrapRef = useRef(null), canvasRef = useRef(null), apiRef = useRef({});
  const [shoePick, setShoePick] = useState(false);   // 현관문으로 나가려는데 신발이 없으면 신발 고르기 창
  const [ui, setUi] = useState({ hint: 'home', hintText: '', mode: 'home', floor: HOME, busy: false, done: false, target: null });

  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    let alive = true; const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (alive) fn(); }, ms)); };
    const say = (t) => { try { speak(t); } catch { /* 무시 */ } };
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const W = makeWorld(), nav14 = makeNav(W.solids, GRID14), nav1 = makeNav(W.solids1, GRID1);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    const yuna = makeYuna(); W.scene.add(yuna.root);
    // 엄마 또는 아빠 (무작위): 현관문이 열리면 복도에 나타나 기다리고, 유나가 나가면 자동으로 손을 잡고 옆에서 같이 걷는다. 집 안에서는 유나 혼자
    const PK = Math.random() < 0.5 ? 'mom' : 'dad', PN = PK === 'mom' ? '엄마' : '아빠';
    const par = makeParent(PK); W.scene.add(par.root);
    const PW = { x: -1.05, z: 3.1 };   // 기다리는 자리
    const P = { x: PW.x, z: PW.z, rot: Math.PI / 2 };
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 28), new THREE.MeshBasicMaterial({ color: '#ff6fa5', transparent: true, opacity: 0, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.02; W.scene.add(marker);
    const E = W.elevs[0];
    W.elevs[1].disp.draw('1');
    const g = {
      t: 0, mode: 'home', x: 6.6, z: 5.0, rot: Math.PI, path: [], pending: null, phase: 0, moving: false, shoes: false, pressT: -9, happyUntil: 0, stepT: 0,
      holding: false, pside: 1, el: { floor: 7, target: null, state: 'idle', humT: 0 }, said: {}, knockT: -9, markerT: -9, blocks: 2, ball: { vx: 0, vz: 0, hop: 0 }, tvOn: false,
      y: 0, outside: false, cam: new THREE.Vector3(6.6, 8, 11), look: new THREE.Vector3(6.6, 0.3, 4.6), fov: 42, lastUi: ''
    };
    const once = (key, fn) => { if (!g.said[key]) { g.said[key] = true; fn(); } };
    const pop = (emoji, x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(camera), el = document.createElement('span');
      el.textContent = emoji; el.style.cssText = `position:absolute;left:${(v.x + 1) / 2 * 100}%;top:${(1 - v.y) / 2 * 100}%;font-size:2rem;pointer-events:none;animation:advPop 1.2s ease-out forwards;margin:-1rem 0 0 -1rem;`;
      wrap.appendChild(el); later(() => el.remove(), 1250);
    };

    // ── 누를 수 있는 것 ──
    const addTap = (objs, stand, look, act) => { const i = W.taps.length; W.taps.push({ stand, look, act }); objs.forEach(o => o.traverse(c => { c.userData.tap = i; })); return objs; };
    const tapObjs = [];
    const wearShoe = (sp) => {
      if (g.shoes === sp.id) return false;
      const prev = W.shoePairs.find(o => o.id === g.shoes); if (prev) prev.grp.visible = true;   // 신던 신발은 제자리에
      g.shoes = sp.id; sp.grp.visible = false; yuna.wearShoes(sp); audio.playPopSound(); pop('👟', g.x, 0.6, g.z); g.happyUntil = g.t + 1.2;
      return !prev;
    };
    // 현관 바닥 신발은 보기만 한다 (현관문 앞에 있어 문 쪽을 누르면 신발이 먼저 눌려 고르기 창이 안 뜨던 문제). 신발은 고르기 창에서만 신는다
    // 신발 고르기 창에서 고르면 바로 신고, 가려던 곳으로 계속 간다
    const pickShoe = (id) => {
      const sp = W.shoePairs.find(o => o.id === id); if (!sp) return;
      wearShoe(sp); setShoePick(false); g.picking = false; say(VOICE.advShoesPicked());
      const goal = g.afterShoes; g.afterShoes = null;
      if (goal) later(() => { if (g.mode === 'home') goTo(goal.x, goal.z, null); }, 900);
    };
    const closePick = () => { setShoePick(false); g.picking = false; g.afterShoes = null; };
    tapObjs.push(...addTap([par.root], null, null, () => { audio.playPopSound(); for (let i = 0; i < 3; i++) later(() => pop('💗', P.x, 1.9, P.z), i * 150); }));
    tapObjs.push(...addTap([W.ball], null, null, () => kickBall()));
    tapObjs.push(...addTap([W.teddy], [7.35, 5.2], [7.35, 4.75], () => { audio.playPopSound(); for (let i = 0; i < 4; i++) later(() => pop('💗', 7.35 + (Math.random() - 0.5) * 0.4, 0.9, 4.75), i * 140); g.happyUntil = g.t + 1.5; say(VOICE.advTeddy()); }));
    tapObjs.push(...addTap([W.blocks], [6.0, 5.0], [6.0, 4.55], () => {
      if (g.blocks < 5) { W.blockMeshes[g.blocks].visible = true; g.blocks++; audio.playFreq(500 + g.blocks * 90, 'triangle', 0.12, 0.35); if (g.blocks === 5) { g.happyUntil = g.t + 1.5; pop('⭐', 6.0, 1.3, 4.55); say(VOICE.advBlocks()); } }
      else { g.blocks = 1; W.blockMeshes.forEach((b, i) => { b.visible = i < 1; }); audio.playNoise(0.3, 0.35, 700, 0.8); pop('💥', 6.0, 0.6, 4.55); }
    }));
    tapObjs.push(...addTap([W.tv, W.tvScreen], [6.7, 4.6], [6.7, 3.6], () => { g.tvOn = !g.tvOn; audio.playFreq(g.tvOn ? 880 : 440, 'sine', 0.1, 0.3); if (!g.tvOn) W.tvScreen.material.color.set('#111827'); }));
    tapObjs.push(...addTap([W.callBtn, W.callHit], [BTN_X, LZ0 + 0.6], [BTN_X, LZ0], () => pressCall()));

    const kickBall = () => {
      const b = W.ball.position, d = Math.hypot(b.x - g.x, b.z - g.z);
      if (d > 0.9) { goTo(b.x - (b.x - g.x) / d * 0.45, b.z - (b.z - g.z) / d * 0.45, () => kickBall()); return; }
      const dx = (b.x - g.x) / (d || 1), dz = (b.z - g.z) / (d || 1);
      g.ball.vx = dx * 3.2 + (Math.random() - 0.5); g.ball.vz = dz * 3.2 + (Math.random() - 0.5); g.ball.hop = 2.2;
      audio.playFreq(180, 'sine', 0.12, 0.5); audio.playNoise(0.06, 0.3, 900, 1); once('ball', () => say(VOICE.advBall()));
    };
    const pressCall = () => {
      g.pressT = g.t; audio.playFreq(1200, 'sine', 0.08, 0.3);
      if (g.el.state !== 'idle') return;
      W.callMat.emissive.set('#ff9f1c'); W.callMat.color.set('#ffe8a3');
      g.el.state = 'coming'; say(VOICE.advCalled());
    };

    // ── 걷기 ──
    const goTo = (x, z, then) => {
      if (g.mode !== 'home' && g.mode !== 'lobby') return;
      const p = (g.mode === 'lobby' ? nav1 : nav14).find(g.x, g.z, x, z);
      g.path = p; g.pending = then || null;
      if (p.length) { const e = p[p.length - 1]; marker.position.set(e.x, (g.mode === 'lobby' ? heightAt1(e.x, e.z) : 0) + 0.02, e.z); g.markerT = g.t; }
      else if (then) then();
    };
    const goTap = (i) => {
      const tp = W.taps[i]; if (!tp) return;
      if (!tp.stand) { tp.act(); return; }
      const arrive = () => { g.rot = Math.atan2(tp.look[0] - g.x, tp.look[1] - g.z); tp.act(); };
      if (Math.hypot(tp.stand[0] - g.x, tp.stand[1] - g.z) < 0.3) arrive(); else goTo(tp.stand[0], tp.stand[1], arrive);
    };
    const gateBlocks = (x, z) => {
      if (g.mode !== 'home') return false;
      // 엘리베이터 문
      for (const e of W.elevs) if (z > LZ0 - 0.35 && z < LZ0 + 0.25 && Math.abs(x - e.xc) < 0.55 && !(e === E && e.door > 0.85 && g.el.state === 'open')) {
        if (g.t - g.knockT > 4) { g.knockT = g.t; if (g.el.state === 'idle') say(VOICE.advCallHint()); }
        return true;
      }
      for (const gt of W.gates) {
        const [x0, z0, x1, z1] = gt.r;
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        const d = W.doors[gt.door];
        if (gt.needShoes && !g.shoes) {   // 신발이 없으면 멈추고 신발 고르기 창을 연다
          const goal = g.path[g.path.length - 1]; if (goal) g.afterShoes = goal;
          if (!g.picking) { g.picking = true; setShoePick(true); say(VOICE.advShoesNeed()); }
          g.path = []; g.pending = null; return true;
        }
        if (d.target === 0) { d.target = 1; audio.playNoise(0.25, 0.18, gt.door === 'mid' ? 1400 : 500, 0.7); if (gt.door === 'front') audio.playFreq(140, 'triangle', 0.15, 0.3); }
        if (d.open < 0.75) return true;
      }
      return false;
    };

    // ── 엘리베이터 ──
    const setOutside = (n) => { W.floorG.visible = n !== 1; W.lobbyG.visible = n === 1; W.floorSign.mesh.visible = n !== 1; if (n !== 1) W.floorSign.set(n); };
    const ding = () => { audio.playFreq(1046, 'sine', 0.35, 0.35); later(() => audio.playFreq(784, 'sine', 0.5, 0.35), 220); };
    const doorSound = () => audio.playNoise(0.7, 0.16, 420, 0.5);
    const pressFloor = (n) => {
      if (g.mode !== 'ride' || g.el.state !== 'open') return;
      g.pressT = g.t; audio.playFreq(1200, 'sine', 0.08, 0.3);
      if (n === Math.round(g.el.floor)) { say(VOICE.advHere(n)); return; }
      g.el.target = n; g.el.state = 'closing'; doorSound(); say(VOICE.advGo(n));
    };
    apiRef.current = { pressFloor, pickShoe, closePick };
    const onOpen = () => {
      const n = Math.round(g.el.floor);
      if (g.mode === 'home') { W.callMat.emissive.set('#000000'); W.callMat.color.set('#f8f9fa'); say(VOICE.advArrive()); return; }
      if (n === 1) {
        g.mode = 'exit'; g.path = [{ x: EX1, z: LZ0 + 0.9 }, { x: EX1 - 0.3, z: LZ0 + 1.5 }];
        g.pending = () => { g.mode = 'lobby'; g.rot = -Math.PI / 2; };
        say(VOICE.advLobby());
      } else say(VOICE.advWrong(n));
    };
    const stepElevator = (dt) => {
      const el = g.el;
      if (el.state === 'coming' || el.state === 'moving') {
        const tgt = el.state === 'coming' ? HOME : el.target, dir = Math.sign(tgt - el.floor);
        el.floor += dir * dt / 0.55;
        if (g.t - el.humT > 0.5) { el.humT = g.t; audio.playFreq(62, 'sine', 0.55, 0.22); }
        if ((dir > 0 && el.floor >= tgt) || (dir < 0 && el.floor <= tgt) || dir === 0) {
          el.floor = tgt; if (el.state === 'moving') setOutside(tgt);
          el.state = 'opening'; ding(); later(doorSound, 350);
        }
      } else if (el.state === 'opening') { E.door = Math.min(1, E.door + dt / 1.1); if (E.door >= 1) { el.state = 'open'; onOpen(); } }
      else if (el.state === 'closing') { E.door = Math.max(0, E.door - dt / 1.1); if (E.door <= 0) el.state = 'moving'; }
      E.leaves.forEach((m, k) => { m.position.x = E.xc + (k ? 1 : -1) * (0.25 + E.door * 0.48); });
      const n = Math.round(el.floor);
      E.disp.draw(el.state === 'coming' || el.state === 'moving' ? `${(el.state === 'coming' ? HOME : el.target) > el.floor ? '▲' : '▼'}${n}` : `${n}`);
    };

    // ── 터치 ──
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const onDown = (e) => {
      if (g.mode !== 'home' && g.mode !== 'lobby') return;
      const r = cv.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const shown = (o) => { for (; o; o = o.parent) if (o.visible === false) return false; return true; };   // 숨긴 것(신고 간 신발 등)은 못 누름
      const hs = ray.intersectObjects(tapObjs, true).filter(h => shown(h.object));
      if (hs.length && hs[0].object.userData.tap != null) { goTap(hs[0].object.userData.tap); return; }
      const lob = g.mode === 'lobby', out = lob || inCorridor(g.x, g.z);
      plane.constant = -g.y;
      let ok = !!ray.ray.intersectPlane(plane, hit);
      // 복도에서는 바닥이 아닌 곳(벽·하늘·먼 곳)을 눌러도 그 방향으로 몇 걸음 걸어간다
      if (out && (!ok || Math.hypot(hit.x - g.x, hit.z - g.z) > 6)) { const d = ray.ray.direction, l = Math.hypot(d.x, d.z) || 1; hit.set(g.x + d.x / l * 4, 0, g.z + d.z / l * 4); ok = true; }
      if (ok) { audio.playFreq(660, 'sine', 0.05, 0.15); if (lob) goTo(clamp(hit.x, -11.5, 15.5), clamp(hit.z, LZ0 - 5.5, LZ0 + 10.5), null); else goTo(clamp(hit.x, -1.5, 10), clamp(hit.z, END_Z + 0.2, 6.9), null); }
    };
    cv.addEventListener('pointerdown', onDown);
    if (import.meta.env.DEV) window.__adv = { g, goTo, goTap, pressFloor, W, yuna, par, P };

    // ── 매 프레임 ──
    let raf = 0, last = performance.now();
    const tmp = new THREE.Vector3();
    // 손잡기: 유나와 엄마·아빠 팔이 같은 한 점(맞잡은 손)을 가리키게 돌린다
    const hv = [0, 1, 2, 3].map(() => new THREE.Vector3()), hq = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
    const aimArm = (arm, target) => {
      arm.parent.getWorldQuaternion(hq).invert();
      const d = hv[3].subVectors(target, arm.getWorldPosition(hv[2])).applyQuaternion(hq).normalize();
      arm.quaternion.setFromUnitVectors(DOWN, d);
    };
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t += dt; const t = g.t;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

      // 걷기
      g.moving = false;
      if (g.path.length) {
        const p = g.path[0], dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz), stepLen = 1.7 * dt;
        if (d < Math.max(0.04, stepLen)) { g.x = p.x; g.z = p.z; g.path.shift(); if (!g.path.length && g.pending) { const f = g.pending; g.pending = null; f(); } }
        else {
          const nx = g.x + dx / d * stepLen, nz = g.z + dz / d * stepLen;
          const want = Math.atan2(dx, dz); let da = want - g.rot; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; g.rot += da * Math.min(1, dt * 12);
          if (!gateBlocks(nx, nz)) { g.x = nx; g.z = nz; g.moving = true; g.phase += dt * 11; if (t - g.stepT > 0.3) { g.stepT = t; audio.playNoise(0.03, 0.06, 320, 1); } }
        }
      }
      // 1층은 계단 높이를 따라간다
      { const gy = g.mode === 'lobby' || g.mode === 'exit' ? heightAt1(g.x, g.z) : 0; g.y += (gy - g.y) * Math.min(1, dt * 14); }
      if (g.mode === 'lobby' && g.y < -0.8 && !g.outside) {
        g.outside = true; audio.playFanfare(); say(VOICE.advOutside()); g.happyUntil = g.t + 3;
        for (let i = 0; i < 8; i++) later(() => pop(['🎉', '⭐', '🌳', '🎈'][i % 4], g.x + (Math.random() - 0.5) * 1.2, g.y + 1.2 + Math.random() * 0.6, g.z + (Math.random() - 0.5)), 200 + i * 180);
      }
      // 엘리베이터에 탔다
      if (g.mode === 'home' && g.el.state === 'open' && g.z < LZ0 - 0.35 && Math.abs(g.x - EX1) < 0.7) {
        g.mode = 'ride'; g.path = [{ x: EX1 + 0.3, z: LZ0 - 0.6 }]; g.pending = () => { g.rot = 0; }; say(VOICE.advInside());
      }
      // 처음 가 본 곳 안내
      // 현관 밖으로 나가면 자동으로 손잡기, 집 안으로 들어오면 놓기
      if (g.mode === 'home') {
        const outNow = inCorridor(g.x + 0.15, g.z);
        if (outNow && !g.holding) { g.holding = true; g.happyUntil = g.t + 1; say(VOICE.advHold(PN)); for (let i = 0; i < 3; i++) later(() => pop('💗', (g.x + P.x) / 2, 1.4, (g.z + P.z) / 2), i * 150); }
        else if (!outNow && g.holding && g.x > 0.15) { g.holding = false; P.x = PW.x; P.z = PW.z; }
        // 중문을 지나 현관에 들어서면 (신발이 없을 때) 신발 고르기 창. 닫으면 현관을 나갔다 다시 들어올 때 다시 뜬다
        const inEntr = g.x > 0.06 && g.x < 0.98 && g.z > 2.84 && g.z < 4.38;
        if (inEntr && !g.inEntr && !g.shoes && !g.picking) {
          const goal = g.path[g.path.length - 1]; g.afterShoes = goal && goal.x < 0.06 ? goal : null;   // 문 밖으로 가던 중이면 고른 뒤 계속 간다
          g.path = []; g.pending = null; g.picking = true; setShoePick(true); say(VOICE.advShoesNeed());
        }
        g.inEntr = inEntr;
      }
      if (g.mode === 'home' && inCorridor(g.x + 0.15, g.z) && g.holding) { once('corridor', () => say(VOICE.advCorridor())); if (g.z < HALL_Z - 0.2 && g.x > 0.1 && g.el.state === 'idle') once('hall', () => say(VOICE.advCallHint())); }

      // 유나 그림
      const happy = t < g.happyUntil, sw = g.moving ? Math.sin(g.phase) : 0;
      yuna.root.position.set(g.x, g.y + (g.moving ? Math.abs(Math.sin(g.phase)) * 0.03 : 0) + (happy ? Math.abs(Math.sin(t * 7)) * 0.12 : 0), g.z);
      yuna.root.rotation.y = g.rot;
      yuna.legs[0].p.rotation.x = sw * 0.7; yuna.legs[1].p.rotation.x = -sw * 0.7;
      const press = clamp(1 - Math.abs((t - g.pressT) - 0.25) / 0.25, 0, 1);
      yuna.arms[0].rotation.x = -sw * 0.6; yuna.arms[1].rotation.x = sw * 0.6 - press * 1.5;
      yuna.arms[0].rotation.z = -0.12 - (happy ? 2.4 + Math.sin(t * 12) * 0.3 : 0); yuna.arms[1].rotation.z = 0.12 + (happy ? 2.4 + Math.sin(t * 12 + 1) * 0.3 : 0);
      // 엄마·아빠: 손을 잡으면 유나 오른쪽(막히면 왼쪽, 둘 다 막히면 뒤)에서 같이 걷는다
      if (g.holding) {
        const nv = g.mode === 'lobby' || g.mode === 'exit' ? nav1 : nav14, fx = Math.sin(g.rot), fz = Math.cos(g.rot), D = 0.7;   // 어깨 사이가 벌어져야 엄마·아빠 팔이 유나 머리 옆이 아니라 옆으로 내민 유나 손에 닿는다
        const side = (k) => [g.x - fz * D * k, g.z + fx * D * k];
        let tx, tz; const r = side(g.pside), l = side(-g.pside);
        if (g.mode === 'ride' || nv.freeAt(r[0], r[1])) [tx, tz] = r; else if (nv.freeAt(l[0], l[1])) { g.pside = -g.pside; [tx, tz] = l; } else { tx = g.x - fz * 0.5 * g.pside - fx * 0.4; tz = g.z + fx * 0.5 * g.pside - fz * 0.4; }
        const k = Math.min(1, dt * 9); P.x += (tx - P.x) * k; P.z += (tz - P.z) * k;
        let da = g.rot - P.rot; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; P.rot += da * Math.min(1, dt * 8);
        const ps = g.moving ? Math.sin(g.phase * 0.75) : 0;
        par.legs[0].rotation.x = ps * 0.45; par.legs[1].rotation.x = -ps * 0.45;
        const near = g.pside > 0 ? 1 : 0;   // 엄마·아빠는 유나가 있는 쪽 팔을 내려 손을 잡는다
        par.arms[1 - near].rotation.set(-ps * 0.4, 0, (near ? -1 : 1) * 0.08);
      } else {
        const toY = Math.atan2(g.x - P.x, g.z - P.z), out = inCorridor(g.x + 0.15, g.z); P.rot += (toY - P.rot) * Math.min(1, dt * 4);
        par.arms[1].rotation.set(0, 0, out ? 2.6 + Math.sin(t * 8) * 0.35 : 0.08); par.arms[0].rotation.set(0, 0, -0.08);   // 유나가 나오면 손 흔들기
        par.legs.forEach(l => { l.rotation.x = 0; });
      }
      par.root.position.set(P.x, g.y + (g.holding && g.moving ? Math.abs(Math.sin(g.phase * 0.75)) * 0.02 : 0), P.z); par.root.rotation.y = P.rot;
      par.root.visible = g.mode !== 'home' || g.holding || (W.doors.front.open > 0.2 && g.x < 1.3 && g.z > 2.84 && g.z < 4.38);   // 현관문이 열려야 나타남
      if (g.holding && !happy) {   // 맞잡은 손: 유나 어깨에서 엄마·아빠 쪽 옆으로 살짝 들어 올린 곳 (높이 0.8쯤이라 엄마·아빠 팔이 거의 곧게 내려와 닿음)
        yuna.root.updateMatrixWorld(true); par.root.updateMatrixWorld(true);
        const ya = yuna.arms[g.pside > 0 ? 0 : 1], pa = par.arms[g.pside > 0 ? 1 : 0];
        const ys = ya.getWorldPosition(hv[0]), dir = hv[1].subVectors(pa.getWorldPosition(hv[1]), ys); dir.y = 0;
        const hand = ys.addScaledVector(dir.normalize(), 0.17); hand.y += 0.19;
        aimArm(ya, hand); aimArm(pa, hand);
      }
      yuna.head.rotation.z = Math.sin(t * 1.5) * 0.03; yuna.body.scale.y = 1 + Math.sin(t * 2) * 0.008;

      // 문
      Object.values(W.doors).forEach(d => {
        d.open += clamp(d.target - d.open, -dt / 0.55, dt / 0.55);
        if (d.slide) d.slide.position.z = 3.99 - d.open * 0.74; else d.pivot.rotation.y = d.base + d.swing * d.open;
      });
      stepElevator(dt);

      // 공
      { const b = g.ball, p = W.ball.position;
        if (g.mode === 'home' && Math.hypot(p.x - g.x, p.z - g.z) < 0.32 && g.moving) { const d = Math.hypot(p.x - g.x, p.z - g.z) || 1; b.vx = (p.x - g.x) / d * 2.6; b.vz = (p.z - g.z) / d * 2.6; b.hop = 1.5; audio.playFreq(180, 'sine', 0.1, 0.4); }
        if (Math.abs(b.vx) + Math.abs(b.vz) > 0.02 || p.y > 0.161) {
          p.x += b.vx * dt; p.z += b.vz * dt; b.vx *= 1 - dt * 1.3; b.vz *= 1 - dt * 1.3;
          if (p.x < 5.0) { p.x = 5.0; b.vx = Math.abs(b.vx); } if (p.x > 8.4) { p.x = 8.4; b.vx = -Math.abs(b.vx); }
          if (p.z < 4.15) { p.z = 4.15; b.vz = Math.abs(b.vz); } if (p.z > 5.75) { p.z = 5.75; b.vz = -Math.abs(b.vz); }
          b.hop -= 9 * dt; p.y += b.hop * dt; if (p.y < 0.16) { p.y = 0.16; b.hop = b.hop < -1.2 ? -b.hop * 0.5 : 0; }
          W.ball.rotation.z -= b.vx * dt / 0.16; W.ball.rotation.x += b.vz * dt / 0.16;
        } }
      if (g.tvOn) W.tvScreen.material.color.setHSL((t * 0.15) % 1, 0.6, 0.6);
      { const k = t - g.markerT; marker.material.opacity = k < 0.8 ? 0.8 * (1 - k / 0.8) : 0; marker.scale.setScalar(1 + k * 0.8); }

      // 카메라 + 벽 흐리게
      const inside = g.mode === 'home' && !inCorridor(g.x, g.z);
      let fov = 42;
      if (g.mode === 'lobby' || g.mode === 'exit') {   // 1층: 위에서 내려다본다 (화면 위 = 북쪽, 상하좌우 누르기 쉽게). 건물 뒤쪽에 있으면 반대편에서
        const k = g.z < LZ0 - 1 && g.x > F1X0 - 1.5 && g.x < F1X1 + 1.5 ? -1 : 1;
        tmp.set(g.x, g.y + 7.2, g.z + k * 2.6); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(g.x, g.y, g.z - k * 0.3); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); fov = 50;
      }
      else if (g.mode === 'ride') { tmp.set(EX1 - 0.15, 1.75, LZ0 - 1.55); g.cam.lerp(tmp, 1 - Math.exp(-dt * 5)); tmp.set(EX1, 0.95, LZ0 + 0.4); g.look.lerp(tmp, 1 - Math.exp(-dt * 5)); fov = 70; }
      else if (inside && g.x > 8.7 && g.z > 4.6) { tmp.set(9.3, 4.6, 2.2); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(9.4, 0.7, 6.3); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); fov = 50; }   // 베란다 남쪽 끝
      else if (inside && g.x < 1.3 && g.z > 2.84 && g.z < 4.38) { tmp.set(2.6, 6.3, 6.3); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(0.5, 0.1, 3.65); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); fov = 46; }   // 현관
      else if (inside) { const fx = 5 + (g.x - 5) * 0.6, fz = 3.5 + (g.z - 3.5) * 0.6; tmp.set(fx, 8.6, fz + 6.6); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(fx, 0.2, fz - 0.2); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); }
      else {   // 복도·대기 공간: 위에서 내려다본다 (화면 위 = 북쪽). 천장·위층은 숨김
        tmp.set(g.x, 7.2, g.z + 2.4); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(g.x, 0, g.z - 0.3); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); fov = 50;
      }
      g.fov += (fov - g.fov) * (1 - Math.exp(-dt * 4));
      if (Math.abs(camera.fov - g.fov) > 0.01) { camera.fov = g.fov; camera.updateProjectionMatrix(); }
      camera.position.copy(g.cam); camera.lookAt(g.look);
      W.outerG.visible = false;   // 위층 바닥판·건물 벽: 집 안·복도 모두 위에서 보므로 숨김
      { const near1 = g.x > F1X0 - ST - 1.2 && g.x < F1X1 + ST + 1.2 && g.z > LZ0 - 3.5 && g.z < F1Z1 + 1.5; W.upper1.forEach(m => { m.visible = !near1; }); }
      W.fades.forEach(f => {
        const want = inside && f.z > g.z + 0.05 ? 0.1 : 1;
        f.mats.forEach(m => { const o = m.opacity + (want - m.opacity) * Math.min(1, dt * 8), tr = o < 0.98; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = tr ? o : 1; m.depthWrite = !tr; });
      });
      // 1층 밖: 카메라와 유나 사이의 나무는 흐리게
      if (g.mode === 'lobby') W.trees1.forEach(tr => {
        const d = (tr.position.z - g.z) * Math.sign(g.cam.z - g.z), want = d > -0.4 && d < 5 && Math.abs(tr.position.x - g.x) < 1.6 ? 0.25 : 1;
        tr.material.opacity += (want - tr.material.opacity) * Math.min(1, dt * 8); tr.material.depthWrite = tr.material.opacity > 0.95;
      });
      renderer.render(W.scene, camera);

      // 화면 글자
      const n = Math.round(g.el.floor), st = g.el.state;
      let hint = 'home', hintText = '';
      if (g.mode === 'lobby' || g.mode === 'exit') hint = g.outside ? 'outside' : 'lobby';
      else if (g.mode === 'ride') { if (st === 'open') hint = 'pick'; else { hint = 'text'; hintText = st === 'moving' ? `🛗 슝~ ${n}층` : '🛗 문이 움직여요'; } }
      else if (inCorridor(g.x, g.z)) { if (st === 'open') hint = 'enter'; else if (st !== 'idle') { hint = 'text'; hintText = `🛗 엘리베이터가 오고 있어요... ${n}층`; } else hint = g.z < HALL_Z - 0.1 && g.x > 0.1 ? 'call' : 'corridor'; }
      else if (g.x < 1.22 && g.z > 2.84 && g.z < 4.38) hint = g.shoes ? 'door' : 'shoes';
      const key = `${hint}|${hintText}|${g.mode}|${n}|${st}|${g.el.target}|${g.outside}`;
      if (key !== g.lastUi) { g.lastUi = key; setUi({ hint, hintText, mode: g.mode, floor: n, busy: st !== 'open', done: g.outside, target: st === 'closing' || st === 'moving' ? g.el.target : null }); }
    };
    raf = requestAnimationFrame(loop);
    later(() => say(VOICE.advStart()), 600);

    return () => {
      alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); cv.removeEventListener('pointerdown', onDown);
      W.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose();
      if (import.meta.env.DEV) delete window.__adv;
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const btn = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', whiteSpace: 'nowrap' });
  const hint = ui.hint === 'text' ? ui.hintText : HINTS[ui.hint];
  const floors = Array.from({ length: ADV_FLOORS }, (_, i) => ADV_FLOORS - i);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <style>{'@keyframes advPop { 0% { transform: translateY(0) scale(0.4); opacity: 0; } 20% { transform: translateY(-14px) scale(1.2); opacity: 1; } 100% { transform: translateY(-70px) scale(1); opacity: 0; } }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={onRestart} style={btn('#f6efe7', '#5c5248')}>🔄 처음부터</button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#2b6cb0' }}>🏡 유나의 모험 · {ui.mode === 'home' ? '우리 집' : ui.mode === 'ride' ? `엘리베이터 ${ui.floor}층` : ui.done ? '아파트 밖' : '1층'}</div>
        <div style={{ width: '120px' }} />
      </div>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(43,108,176,0.55)', background: '#cdeafd' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'pointer' }} />
        {hint && <div style={{ position: 'absolute', left: 0, right: 0, top: '12px', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.9)', borderRadius: '18px', padding: '6px 16px', fontFamily: JUA, fontSize: '1.25rem', color: '#1e3a5f', boxShadow: '0 4px 12px -6px rgba(0,0,0,0.3)' }}>{hint}</span>
        </div>}
        {ui.mode === 'ride' && (
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(55,65,81,0.92)', borderRadius: '24px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', boxShadow: '0 16px 30px -14px rgba(0,0,0,0.6)' }}>
            <div style={{ background: '#111827', color: '#ffb020', fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: '2rem', borderRadius: '12px', padding: '4px 22px', minWidth: '70px', textAlign: 'center' }}>{ui.floor}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
              {floors.map(n => {
                const lit = ui.target === n, here = ui.floor === n && !ui.busy;
                return <button key={n} disabled={ui.busy} onClick={() => apiRef.current.pressFloor(n)} style={{ width: '52px', height: '52px', borderRadius: '26px', border: n === 1 ? '3px solid #51cf66' : '3px solid #9ca3af', background: lit ? '#ffb020' : here ? '#dbeafe' : '#f9fafb', color: '#1f2937', fontFamily: JUA, fontSize: '1.25rem', cursor: ui.busy ? 'default' : 'pointer', touchAction: 'manipulation', opacity: ui.busy && !lit ? 0.6 : 1, padding: 0 }}>{n}</button>;
              })}
            </div>
          </div>
        )}
        {shoePick && ui.mode === 'home' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,41,59,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ position: 'relative', background: '#fffaf3', borderRadius: '28px', padding: '18px 18px 20px', boxShadow: '0 20px 40px -18px rgba(0,0,0,0.5)', maxWidth: '640px', width: '100%' }}>
              <button onClick={() => apiRef.current.closePick()} aria-label="닫기" style={{ position: 'absolute', right: '12px', top: '10px', width: '44px', height: '44px', borderRadius: '22px', border: 'none', background: '#f1e7da', color: '#5c5248', fontSize: '1.3rem', cursor: 'pointer', touchAction: 'manipulation' }}>✕</button>
              <div style={{ textAlign: 'center', fontFamily: JUA, fontSize: '1.5rem', color: '#2b6cb0', marginBottom: '14px' }}>👟 어떤 신발을 신을까요?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {SHOE_KINDS.map(sk => {
                  const img = shoeThumbs()[sk.id];
                  return (
                    <button key={sk.id} onClick={() => apiRef.current.pickShoe(sk.id)} style={{ border: `4px solid ${sk.color}`, borderRadius: '22px', background: '#ffffff', padding: '8px 6px 10px', cursor: 'pointer', touchAction: 'manipulation', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      {img ? <img src={img} alt="" draggable={false} style={{ width: '100%', maxWidth: '170px', aspectRatio: '220 / 160', objectFit: 'contain', pointerEvents: 'none' }} />
                        : <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: sk.color }} />}
                      <span style={{ fontFamily: JUA, fontSize: '1.1rem', color: '#374151' }}>{SHOE_NAMES[sk.kind]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {ui.done && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', pointerEvents: 'none' }}>
            <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#db2777', textShadow: '0 3px 0 #fff', background: 'rgba(255,255,255,0.85)', borderRadius: '22px', padding: '6px 22px' }}>🎉 밖에 나왔어요!</div>
            <button onClick={onRestart} style={{ ...btn('#4dabf7'), pointerEvents: 'auto' }}>🔄 한 번 더 하기</button>
          </div>
        )}
      </div>
    </div>
  );
}
