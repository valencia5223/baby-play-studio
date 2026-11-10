// ═════════════════════════════════════════════════════════════════════════════
// 🏡 유나의 모험 (3D, three.js): 집에서 놀다가 → 신발 신고 현관문 → 복도(옆집 하나를 지나) → 엘리베이터 버튼 → 타고 층 버튼 → 1층
//  - 좌표: x = 동쪽, z = 남쪽, y = 위 (단위 m). 집은 x 0~10.12, z 0~6.96 (평면도를 위아래로 뒤집은 구조:
//    현관(서쪽 벽)에서 들어오면 왼쪽(북)에 욕실, 오른쪽(남)에 주방. 동쪽 끝은 확장한 베란다 + 폴딩도어)
//    복도는 집 서쪽(x -1.6~0). 현관 오른쪽 방(침실 B)이 복도 자리까지 넓혀져 있어 복도는 그 앞에서 끝나고(끝집),
//    현관문을 나와 오른쪽(북쪽)으로 옆집(z -6.96~0)을 지나면 엘리베이터 두 대(CAR_Z·CAR2_Z)
//  - 화면을 누르면 그곳으로 걸어간다 (0.2m 격자 A* 길찾기, 벽·가구는 solids). 문은 다가가면 열린다(gates).
//    현관문은 신발을 신어야 열린다. 물건(taps)을 누르면 그 앞으로 가서 행동한다
//  - 카메라: 집 안은 남쪽 위에서 내려다보고 유나보다 남쪽에 있는 가로 벽은 흐리게(fades), 복도는 건물 밖 서쪽에서 옆으로,
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
const HALL_Z = -6.96, END_Z = -11.24;    // 엘리베이터 홀이 시작하는 z, 복도 북쪽 끝
const CAR_Z = -7.94, CAR2_Z = -9.64;     // 엘리베이터 두 대의 가운데 z (타는 건 첫째)
const BTN_Z = (CAR_Z + CAR2_Z) / 2;      // 부르는 버튼
const inCorridor = (x, z) => x < -0.05 && z < 4.3;   // 복도에 있는지 (x<0 이라도 넓힌 방은 집 안)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ─────────────────────────────── 길찾기 격자 ───────────────────────────────
const CELL = 0.2, GX0 = -1.8, GZ0 = -11.8, GW = 62, GH = 96, BODY = 0.17;
const cellOf = (x, z) => [Math.floor((x - GX0) / CELL), Math.floor((z - GZ0) / CELL)];
const centerOf = (i, j) => [GX0 + (i + 0.5) * CELL, GZ0 + (j + 0.5) * CELL];
function buildGrid(solids) {
  const blocked = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const [x, z] = centerOf(i, j);
    for (const r of solids) if (x > r[0] - BODY && x < r[2] + BODY && z > r[1] - BODY && z < r[3] + BODY) { blocked[j * GW + i] = 1; break; }
  }
  return blocked;
}
function makeNav(blocked) {
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

// ─────────────────────────────── 유나 ───────────────────────────────
function makeYuna() {
  const root = new THREE.Group();
  const L = (c) => new THREE.MeshLambertMaterial({ color: c });
  const skin = L('#ffe0c7'), hair = L('#3b2a20'), dress = L('#ffd43b'), sock = L('#ffffff'), shoe = L('#ff6fa5');
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
  const wearShoes = (on) => legs.forEach(l => { l.foot.material = on ? shoe : sock; });
  return { root, body, legs, arms, head, wearShoes };
}

// ─────────────────────────────── 세상 만들기 ───────────────────────────────
function makeWorld() {
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
  box(-0.06, -0.06, 10.18, 7.02, -0.25, -0.001, '#d8cfc4');           // 바닥 두께
  box(-1.66, 4.32, -0.06, 7.02, -0.25, -0.001, '#d8cfc4');

  // ── 바깥 벽 ──
  wall(0, 0, 10.12, 0);                                               // 북
  wall(-1.6, 6.96, 10.12, 6.96, { h: 0.12, color: '#e9dfd2' });          // 남 (카메라 쪽이라 턱만)
  wall(0, 0, 0, 3.15, { h: 2.4 }); wall(0, 4.05, 0, 4.38, { h: 2.4 }); wall(0, 3.15, 0, 4.05, { y0: 2.05, h: 2.4 });   // 서 + 현관문 위
  // 동 (베란다 바깥 창): 낮은 벽 + 유리
  wall(10.12, 0, 10.12, 6.96, { h: 0.95 });
  const glass = L('#bfe6ff', { transparent: true, opacity: 0.28, depthWrite: false });
  box(10.09, 0.06, 10.15, 6.9, 0.95, WALL_H, 0, { mat: glass });
  for (let z = 0.06; z <= 6.9; z += 1.14) box(10.08, z - 0.03, 10.16, z + 0.03, 0.95, WALL_H, '#ffffff');
  box(10.08, 0.06, 10.16, 6.9, WALL_H - 0.06, WALL_H, '#ffffff');

  // ── 방 벽 ──
  // 침실 A (북서, 유나 방): 남쪽 벽에 문
  wall(0, 2.84, 1.75, 2.84); wall(2.5, 2.84, 2.57, 2.84); wall(1.75, 2.84, 2.5, 2.84, { y0: 2.0 });
  wall(2.57, 0, 2.57, 2.84);
  hinged('bedA', 1.75, 2.84, 0.75, 0, 1.45, '#fffaf2', { fadeZ: 2.84 });
  gates.push({ r: [1.75, 2.6, 2.5, 3.08], door: 'bedA' });
  // 침실 B (남서, 현관 오른쪽): 북쪽 벽에 문. 서쪽으로 복도 자리(x -1.6)까지 넓힌 방
  wall(-1.6, 4.38, 0, 4.38, { h: 2.4 }); wall(-1.6, 4.38, -1.6, 6.96, { h: 2.4 }); box(-1.68, 5.0, -1.63, 6.3, 1.0, 1.9, 0, { mat: L('#bcd9ea') }); box(-1.7, 4.96, -1.62, 6.34, 0.95, 1.0, '#e5e7eb');
  wall(0, 4.38, 1.75, 4.38); wall(2.5, 4.38, 2.61, 4.38); wall(1.75, 4.38, 2.5, 4.38, { y0: 2.0 });
  wall(2.61, 4.38, 2.61, 6.96);
  hinged('bedB', 1.75, 4.38, 0.75, 0, -1.45, '#fffaf2', { fadeZ: 4.38 });
  gates.push({ r: [1.75, 4.14, 2.5, 4.62], door: 'bedB' });
  // 붙박이장·창고 (욕실 서쪽)
  box(2.63, 0.06, 3.25, 1.9, 0, WALL_H, '#f3ead9', { solid: true });
  box(2.63, 1.9, 3.7, 2.84, 0, WALL_H, '#efe6d6', { solid: true });
  box(3.69, 2.05, 3.72, 2.7, 0.05, 1.95, '#d9cfbd');                  // 창고 문
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
  gates.push({ r: [-0.3, 3.15, 0.3, 4.05], door: 'front', needShoes: true });
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
  const shoes = new THREE.Group(); floorG.add(shoes); shoes.position.set(0.72, 0, 4.12);
  [-1, 1].forEach(k => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), L('#ff6fa5')); s.scale.set(1, 0.6, 1.5); s.position.set(k * 0.09, 0.045, 0); s.castShadow = true; shoes.add(s); });

  // ── 가구 ──
  const furn = (x0, z0, x1, z1, h, color, o = {}) => box(x0, z0, x1, z1, o.y0 || 0, h, color, { solid: o.solid !== false, cast: true });
  // 거실: TV(북쪽 벽) · 러그 · 소파(남쪽, 등받이가 카메라 쪽)
  furn(5.8, 3.56, 7.6, 3.95, 0.42, '#f1e4cf');
  const tv = box(5.95, 3.6, 7.45, 3.66, 0.55, 1.45, 0, { mat: L('#1f2937') });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ color: '#111827' })); tvScreen.position.set(6.7, 1.0, 3.665); floorG.add(tvScreen);
  floorRect(5.6, 4.25, 7.8, 5.65, L('#ffd6e7'), 0.006);
  floorRect(5.75, 4.4, 7.65, 5.5, L('#ffe9f2'), 0.008);
  furn(5.7, 5.95, 7.7, 6.6, 0.4, '#9ec5e8'); furn(5.7, 6.6, 7.7, 6.82, 0.82, '#8ab6dd'); furn(5.5, 5.95, 5.7, 6.82, 0.6, '#8ab6dd'); furn(7.7, 5.95, 7.9, 6.82, 0.6, '#8ab6dd');
  // 주방 (현관에서 오른쪽): 냉장고 · ㄱ자 싱크대 · 식탁
  furn(2.68, 4.45, 3.36, 5.15, 1.8, '#e5e7eb'); box(3.36, 4.5, 3.375, 5.1, 0.95, 0.97, '#9ca3af');
  furn(2.68, 5.15, 3.28, 6.36, 0.85, '#fdf6ec'); box(2.68, 5.15, 3.3, 6.36, 0.85, 0.89, '#6b7280');
  [[2.98, 5.5], [2.98, 5.95]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20), L('#111827')); b.position.set(x, 0.9, z); floorG.add(b); });
  furn(2.68, 6.36, 4.5, 6.9, 0.85, '#fdf6ec'); box(2.68, 6.34, 4.5, 6.9, 0.85, 0.89, '#6b7280');
  box(3.55, 6.45, 4.15, 6.8, 0.86, 0.9, '#d1d5db'); box(3.82, 6.78, 3.88, 6.84, 0.89, 1.12, '#9ca3af');
  furn(3.9, 5.05, 4.75, 5.75, 0.7, '#f5d9a8', { y0: 0.64 }); [[3.96, 5.11], [4.69, 5.11], [3.96, 5.69], [4.69, 5.69]].forEach(([x, z]) => box(x - 0.03, z - 0.03, x + 0.03, z + 0.03, 0, 0.64, '#e0bf85'));
  furn(4.1, 4.72, 4.5, 5.0, 0.42, '#ffb4a2', { solid: false }); furn(4.1, 5.8, 4.5, 6.08, 0.42, '#a5d8ff', { solid: false });
  // 유나 방 (침실 A)
  furn(0.15, 0.15, 1.05, 1.85, 0.32, '#fff0f6'); furn(0.15, 0.15, 1.05, 0.28, 0.62, '#f8b4d0'); box(0.2, 0.55, 1.0, 1.82, 0.32, 0.38, '#ffc2dc', { cast: true }); box(0.32, 0.3, 0.88, 0.52, 0.32, 0.42, '#ffffff');
  furn(1.45, 0.1, 2.45, 0.45, 0.9, '#ffe8a3'); [['#74c0fc', 1.6], ['#ff8787', 1.95], ['#69db7c', 2.28]].forEach(([c, x]) => box(x - 0.1, 0.16, x + 0.1, 0.4, 0.9, 1.08, c, { cast: true }));
  // 침실 B: 책상 · 옷장
  furn(-0.7, 4.5, 0.9, 5.05, 0.72, '#e8d5b5'); box(-0.2, 4.56, 0.4, 4.6, 0.74, 1.15, '#1f2937'); furn(-0.1, 5.25, 0.3, 5.6, 0.42, '#adb5bd', { solid: false });
  furn(-1.5, 5.75, -0.95, 6.85, 1.9, '#f1e4cf'); furn(1.2, 6.5, 2.5, 6.88, 1.2, '#f1e4cf');
  floorRect(-0.6, 5.5, 1.0, 6.6, L('#d0ebff'), 0.006);
  // 안방: 큰 침대 · 옷장 · 서랍장
  furn(5.95, 0.15, 7.75, 2.2, 0.36, '#f4f1ea'); furn(5.95, 0.15, 7.75, 0.3, 0.8, '#c9ada7'); box(6.0, 0.75, 7.7, 2.17, 0.36, 0.43, '#b8d8be', { cast: true });
  [6.4, 7.3].forEach(x => box(x - 0.3, 0.34, x + 0.3, 0.68, 0.36, 0.47, '#ffffff'));
  furn(4.95, 0.1, 5.5, 2.0, 1.9, '#f1e4cf'); furn(8.0, 0.12, 8.5, 1.0, 0.75, '#f1e4cf');
  // 욕실: 욕조 · 세면대 · 변기
  furn(3.33, 0.1, 4.8, 0.78, 0.5, '#ffffff'); box(3.4, 0.17, 4.73, 0.71, 0.4, 0.46, '#a5d8ff');
  furn(3.33, 0.95, 3.72, 1.32, 0.78, '#ffffff'); furn(3.33, 1.42, 3.8, 1.8, 0.4, '#ffffff'); box(3.33, 1.44, 3.48, 1.78, 0.4, 0.78, '#ffffff');
  // 베란다 (확장형): 화분 · 작은 탁자
  const plant = (x, z) => { box(x - 0.14, z - 0.14, x + 0.14, z + 0.14, 0, 0.28, '#e9967a', { solid: true, cast: true }); [[0, 0.55, 0.22], [0.1, 0.78, 0.16], [-0.08, 0.92, 0.13]].forEach(([dx, y, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), L('#51cf66')); s.position.set(x + dx, y, z); s.castShadow = true; floorG.add(s); }); };
  plant(9.75, 0.4); plant(9.75, 6.5); plant(9.1, 0.35);
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
  const blocks = new THREE.Group(); floorG.add(blocks); blocks.position.set(5.35, 0, 4.7);
  const blockCols = ['#ff8787', '#ffd43b', '#74c0fc', '#69db7c', '#b197fc'];
  const blockMeshes = blockCols.map((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), L(c)); b.castShadow = true; b.position.set(0, 0.1 + i * 0.2, 0); b.rotation.y = i * 0.5; b.visible = i < 2; blocks.add(b); return b; });

  // ── 복도 (복도식 아파트, 서쪽이 바깥). 현관 오른쪽 방(침실 B)이 복도 자리까지 넓혀져 있어 복도는 거기서 끝나고(끝집),
  //    현관문을 나와 오른쪽(북쪽)으로 옆집 하나를 지나면 엘리베이터 홀이다 ──
  const corr = new THREE.MeshLambertMaterial({ map: tileTex('#cfd4da', '#c6ccd3', 'rgba(110,118,128,0.35)') });
  floorRect(-1.6, HALL_Z, 0, 4.38, corr, 0, floorG, 0.8);
  const hallTile = new THREE.MeshLambertMaterial({ map: tileTex('#f1ece3', '#e8e1d6', 'rgba(150,140,125,0.45)') });
  floorRect(-1.6, END_Z, 0, HALL_Z, hallTile, 0, floorG, 0.8);
  box(-1.72, END_Z - 0.12, 0, 4.38, -0.3, -0.001, '#b8bec6');                       // 복도 바닥판
  // 위층 바닥판(천장)·위아래층 건물 벽: 집 안을 내려다볼 때는 가려서 숨긴다 (outerG)
  const outerG = new THREE.Group(); floorG.add(outerG);
  box(-1.72, END_Z - 0.12, 0.05, 4.38, 2.4, 2.56, '#e8ebee', { parent: outerG });
  box(0.02, END_Z - 0.12, 0.12, 4.38, -12, -0.3, '#f1e9dc', { parent: outerG }); box(0.02, END_Z - 0.12, 0.12, 4.38, 2.56, 9, '#f1e9dc', { parent: outerG });
  box(-1.66, 4.32, -1.54, 7.02, -12, -0.001, '#f1e9dc', { parent: outerG }); box(-1.66, 4.32, -1.54, 7.02, 2.4, 9, '#f1e9dc', { parent: outerG });
  // 난간 (살이 있어 유나가 보인다)
  box(-1.68, END_Z - 0.12, -1.56, 4.38, 0, 0.14, '#aeb5bd');
  box(-1.66, END_Z - 0.12, -1.58, 4.38, 1.1, 1.17, '#6b7280');
  for (let z = END_Z; z <= 4.3; z += 0.26) box(-1.635, z - 0.012, -1.605, z + 0.012, 0.14, 1.1, '#868e96');
  solids.push([-1.9, END_Z - 0.4, -1.56, 4.38]);
  wall(-1.6, END_Z, 0.1, END_Z, { h: 2.4, noFade: true, color: '#f1e9dc' });      // 복도 북쪽 끝
  // 옆집
  wall(0, HALL_Z, 0, -4.04, { h: 2.4 }); wall(0, -3.14, 0, 0, { h: 2.4 }); wall(0, -4.04, 0, -3.14, { y0: 2.05, h: 2.4 });
  box(-0.03, -4.04, 0.03, -3.14, 0, 2.05, '#8d9199'); { const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), L('#d1d5db')); k.position.set(-0.06, 0.95, -3.24); floorG.add(k); }
  solids.push([0.06, HALL_Z + 0.06, 10.4, -0.06]);
  const winBars = (z0, z1) => { box(-0.07, z0, -0.02, z1, 1.0, 1.9, 0, { mat: L('#bcd9ea') }); for (let z = z0; z <= z1 + 0.01; z += 0.16) box(-0.09, z - 0.012, -0.06, z + 0.012, 1.0, 1.9, '#9ca3af'); box(-0.1, z0 - 0.04, -0.02, z1 + 0.04, 0.96, 1.0, '#e5e7eb'); };
  winBars(1.0, 2.2); winBars(-2.4, -1.2); winBars(-6.2, -5.0);
  const plate = (txt, z) => { const m = labelMesh(txt, 0.34, 0.16, { bg: '#374151', fg: '#ffffff' }); m.rotation.y = -Math.PI / 2; m.position.set(-0.07, 1.7, z); floorG.add(m); };
  plate(`${HOME}01`, 2.9); plate(`${HOME}02`, -2.9);
  box(-0.22, -6.6, -0.06, -6.4, 0, 0.5, '#e03131', { solid: true, cast: true });   // 소화기
  // ── 엘리베이터 홀 벽 (늘 보임) ──
  const HW = '#e9e4da';
  [[CAR_Z + 0.5, HALL_Z], [CAR2_Z + 0.5, CAR_Z - 0.5], [END_Z, CAR2_Z - 0.5]].forEach(([a, b]) => wall(0, a, 0, b, { h: 2.4, t: 0.16, color: HW, parent: coreG }));
  [CAR_Z, CAR2_Z].forEach(zc => { wall(0, zc - 0.5, 0, zc + 0.5, { y0: 2.08, h: 2.4, t: 0.16, color: HW, parent: coreG }); [-1, 1].forEach(k => box(-0.1, zc + k * 0.5 - 0.04, 0.1, zc + k * 0.5 + 0.04, 0, 2.1, '#9aa1ab', { parent: coreG })); box(-0.1, zc - 0.54, 0.1, zc + 0.54, 2.08, 2.14, '#9aa1ab', { parent: coreG }); });
  const floorSign = { mesh: null, set(n) { if (this.mesh) { coreG.remove(this.mesh); } const m = labelMesh(`${n}F`, 0.5, 0.28, { bg: '#1c7ed6', fg: '#ffffff' }); m.rotation.y = -Math.PI / 2; m.position.set(-0.09, 1.85, BTN_Z); coreG.add(m); this.mesh = m; } };
  floorSign.set(HOME);
  // 부르는 버튼 (두 엘리베이터 사이, 아이 손 높이)
  box(-0.11, BTN_Z - 0.09, -0.07, BTN_Z + 0.09, 0.82, 1.2, '#d1d5db', { parent: coreG });
  const callMat = new THREE.MeshLambertMaterial({ color: '#f8f9fa', emissive: '#000000' });
  const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20), callMat); callBtn.rotation.z = Math.PI / 2; callBtn.position.set(-0.12, 1.0, BTN_Z); coreG.add(callBtn);
  const callHit = box(-0.3, BTN_Z - 0.3, -0.05, BTN_Z + 0.3, 0.6, 1.5, 0, { parent: coreG, mat: new THREE.MeshBasicMaterial({ visible: false }) });
  // 엘리베이터 두 대
  const steel = L('#c9ced6'), carWall = L('#e7e2d6');
  const elevs = [CAR_Z, CAR2_Z].map(zc => {
    const g = new THREE.Group(); coreG.add(g);
    const leaves = [-1, 1].map(k => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.08, 0.5), steel); m.position.set(0, 1.04, zc + k * 0.25); g.add(m); return m; });
    const disp = makeDisplay();
    const dm = new THREE.MeshBasicMaterial({ map: disp.tex });
    const out = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), dm); out.rotation.y = -Math.PI / 2; out.position.set(-0.09, 2.25, zc); g.add(out);
    const inn = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), dm); inn.rotation.y = Math.PI / 2; inn.position.set(0.1, 2.2, zc); g.add(inn);
    // 칸 안
    box(0.06, zc - 0.75, 1.7, zc + 0.75, -0.02, 0, '#6b7280', { parent: g });
    box(1.7, zc - 0.8, 1.78, zc + 0.8, 0, 2.35, 0, { parent: g, mat: carWall });
    box(0.06, zc - 0.8, 1.7, zc - 0.75, 0, 2.35, 0, { parent: g, mat: carWall }); box(0.06, zc + 0.75, 1.7, zc + 0.8, 0, 2.35, 0, { parent: g, mat: carWall });
    box(0.06, zc - 0.8, 1.78, zc + 0.8, 2.35, 2.4, '#fffdf5', { parent: g });
    box(1.68, zc - 0.55, 1.7, zc + 0.55, 0.9, 2.0, 0, { parent: g, mat: L('#cfe3ee') });   // 거울
    box(1.6, zc - 0.7, 1.64, zc + 0.7, 0.85, 0.89, '#9aa1ab', { parent: g });              // 손잡이
    box(0.085, zc - 0.72, 0.11, zc - 0.54, 0.8, 1.5, '#aab1bb', { parent: g });            // 버튼판
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), L('#fff3bf')); b.position.set(0.115, 0.9 + Math.floor(i / 2) * 0.16, zc - 0.67 + (i % 2) * 0.08); g.add(b); }
    solids.push([0, zc - 0.85, 1.8, zc - 0.75], [0, zc + 0.75, 1.8, zc + 0.85], [1.7, zc - 0.85, 1.9, zc + 0.85]);
    return { zc, leaves, disp, door: 0 };
  });
  solids.push([0, CAR_Z + 0.75, 1.9, HALL_Z + 0.1], [0, END_Z - 0.4, 10.4, CAR2_Z - 0.75], [1.8, END_Z - 0.4, 10.4, HALL_Z + 0.1]);
  const carLight = new THREE.PointLight('#fff4d6', 0.9, 4); carLight.position.set(0.9, 2.1, CAR_Z); coreG.add(carLight);

  // ── 1층 로비 (엘리베이터 문 밖, 1층에 도착했을 때만 보임) ──
  const LB0 = END_Z - 0.8, LB1 = HALL_Z + 1.5;
  floorRect(-6, LB0, 0, LB1, new THREE.MeshLambertMaterial({ map: tileTex('#fbf7ef', '#f3ecdf', 'rgba(170,150,120,0.4)') }), 0, lobbyG, 1.0);
  box(-6, LB0 - 0.1, 0, LB0, 0, 2.6, '#f5efe4', { parent: lobbyG }); box(-6, LB1, 0, LB1 + 0.1, 0, 2.6, '#f5efe4', { parent: lobbyG });
  box(-6.02, LB0, -5.98, LB1, 0, 2.6, 0, { parent: lobbyG, mat: L('#d6f0ff', { transparent: true, opacity: 0.35, depthWrite: false }) });
  for (let z = LB0; z <= LB1 + 0.01; z += (LB1 - LB0) / 4) box(-6.06, z - 0.04, -5.94, z + 0.04, 0, 2.6, '#6b7280', { parent: lobbyG });
  box(-6.06, LB0, -5.94, LB1, 2.1, 2.2, '#6b7280', { parent: lobbyG });
  floorRect(-30, LB0 - 14, -6, LB1 + 14, L('#a3d977'), -0.02, lobbyG, 1);
  floorRect(-9.5, LB0 - 14, -7.2, LB1 + 14, L('#d9d4cb'), -0.01, lobbyG, 1);
  [[-11, CAR_Z + 1.4], [-12.5, CAR_Z - 1.6], [-10.8, CAR_Z - 4], [-14, CAR_Z + 0.4]].forEach(([x, z]) => { box(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 0, 1.1, '#8d6e4f', { parent: lobbyG }); const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 12), L('#40c057')); s.position.set(x, 1.8, z); lobbyG.add(s); });
  box(-0.5, LB1 - 1.4, -0.1, LB1, 0, 1.3, '#cbd5e1', { parent: lobbyG });   // 우편함
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) box(-0.52, LB1 - 1.32 + i * 0.32, -0.5, LB1 - 1.06 + i * 0.32, 0.2 + j * 0.27, 0.42 + j * 0.27, '#94a3b8', { parent: lobbyG });
  { const m = labelMesh('1F', 0.5, 0.28, { bg: '#2f9e44', fg: '#ffffff' }); m.rotation.y = Math.PI / 2; m.position.set(-5.9, 2.35, CAR_Z); lobbyG.add(m); }

  // ── 멀리 보이는 동네 (높은 층 느낌) ──
  { const far = new THREE.Group(); floorG.add(far);
    floorRect(-90, -60, 90, 90, L('#b9dba0'), -42, far, 1);
    [[-28, -10, 9, 30], [-40, 14, 10, 22], [-30, 34, 9, 36], [24, -22, 12, 28], [-55, -6, 10, 40], [-24, 60, 9, 26], [40, 30, 10, 34]].forEach(([x, z, w, h]) => box(x - w / 2, z - w / 2, x + w / 2, z + w / 2, -42, -42 + h, '#e9e4dc', { parent: far })); }

  // ── 빛 ──
  scene.add(new THREE.HemisphereLight('#ffffff', '#eadfd2', 1.9));
  const sun = new THREE.DirectionalLight('#fff3dd', 1.5); sun.position.set(-8, 18, 8); sun.target.position.set(4, 0, -1); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 15, bottom: -15, near: 1, far: 60 });

  return { scene, floorG, lobbyG, outerG, solids, fades, taps, doors, gates, shoes, ball, teddy, blocks, blockMeshes, tvScreen, tv, callBtn, callMat, callHit, elevs, floorSign };
}

// ─────────────────────────────── 화면 ───────────────────────────────
const HINTS = {
  home: '🏠 가고 싶은 곳을 콕! 밖에 나가려면 현관으로 가요',
  shoes: '👟 신발을 콕! 눌러서 신어요',
  door: '🚪 현관문으로 나가요',
  corridor: '👈 복도를 따라 엘리베이터로 가요',
  call: '🔘 엘리베이터 버튼을 콕! 눌러요',
  enter: '🛗 문이 열렸어요! 안으로 들어가요',
  pick: '🔢 몇 층으로 갈까요? 버튼을 콕!'
};

export default function AdventureGame(props) {
  const [run, setRun] = useState(0);
  return <AdventureScene key={run} {...props} onRestart={() => setRun(r => r + 1)} />;
}

function AdventureScene({ audio, speak, onRestart }) {
  const wrapRef = useRef(null), canvasRef = useRef(null), apiRef = useRef({});
  const [ui, setUi] = useState({ hint: 'home', hintText: '', mode: 'home', floor: HOME, busy: false, done: false, target: null });

  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    let alive = true; const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (alive) fn(); }, ms)); };
    const say = (t) => { try { speak(t); } catch { /* 무시 */ } };
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const W = makeWorld(), nav = makeNav(buildGrid(W.solids));
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    const yuna = makeYuna(); W.scene.add(yuna.root);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 28), new THREE.MeshBasicMaterial({ color: '#ff6fa5', transparent: true, opacity: 0, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.02; W.scene.add(marker);
    const E = W.elevs[0];
    W.elevs[1].disp.draw('1');
    const g = {
      t: 0, mode: 'home', x: 6.6, z: 5.0, rot: Math.PI, path: [], pending: null, phase: 0, moving: false, shoes: false, pressT: -9, happyUntil: 0, stepT: 0,
      el: { floor: 7, target: null, state: 'idle', humT: 0 }, said: {}, knockT: -9, markerT: -9, blocks: 2, ball: { vx: 0, vz: 0, hop: 0 }, tvOn: false,
      cam: new THREE.Vector3(6.6, 8, 11), look: new THREE.Vector3(6.6, 0.3, 4.6), fov: 42, lastUi: ''
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
    tapObjs.push(...addTap([W.shoes], [0.72, 3.8], [0.72, 4.12], () => {
      if (g.shoes) return;
      g.shoes = true; W.shoes.visible = false; yuna.wearShoes(true); audio.playPopSound(); pop('👟', g.x, 0.6, g.z); g.happyUntil = g.t + 1.2; say(VOICE.advShoesOn());
    }));
    tapObjs.push(...addTap([W.ball], null, null, () => kickBall()));
    tapObjs.push(...addTap([W.teddy], [7.35, 5.2], [7.35, 4.75], () => { audio.playPopSound(); for (let i = 0; i < 4; i++) later(() => pop('💗', 7.35 + (Math.random() - 0.5) * 0.4, 0.9, 4.75), i * 140); g.happyUntil = g.t + 1.5; say(VOICE.advTeddy()); }));
    tapObjs.push(...addTap([W.blocks], [5.35, 5.15], [5.35, 4.7], () => {
      if (g.blocks < 5) { W.blockMeshes[g.blocks].visible = true; g.blocks++; audio.playFreq(500 + g.blocks * 90, 'triangle', 0.12, 0.35); if (g.blocks === 5) { g.happyUntil = g.t + 1.5; pop('⭐', 5.35, 1.3, 4.7); say(VOICE.advBlocks()); } }
      else { g.blocks = 1; W.blockMeshes.forEach((b, i) => { b.visible = i < 1; }); audio.playNoise(0.3, 0.35, 700, 0.8); pop('💥', 5.35, 0.6, 4.7); }
    }));
    tapObjs.push(...addTap([W.tv, W.tvScreen], [6.7, 4.6], [6.7, 3.6], () => { g.tvOn = !g.tvOn; audio.playFreq(g.tvOn ? 880 : 440, 'sine', 0.1, 0.3); if (!g.tvOn) W.tvScreen.material.color.set('#111827'); }));
    tapObjs.push(...addTap([W.callBtn, W.callHit], [-0.55, BTN_Z], [0, BTN_Z], () => pressCall()));

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
      if (g.mode !== 'home') return;
      const p = nav.find(g.x, g.z, x, z);
      g.path = p; g.pending = then || null;
      if (p.length) { const e = p[p.length - 1]; marker.position.set(e.x, 0.02, e.z); g.markerT = g.t; }
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
      for (const e of W.elevs) if (x > -0.25 && x < 0.35 && Math.abs(z - e.zc) < 0.55 && !(e === E && e.door > 0.85 && g.el.state === 'open')) {
        if (g.t - g.knockT > 4) { g.knockT = g.t; if (g.el.state === 'idle') say(VOICE.advCallHint()); }
        return true;
      }
      for (const gt of W.gates) {
        const [x0, z0, x1, z1] = gt.r;
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        const d = W.doors[gt.door];
        if (gt.needShoes && !g.shoes) { if (g.t - g.knockT > 4) { g.knockT = g.t; say(VOICE.advShoesNeed()); pop('👟', 0.72, 0.5, 4.12); } g.path = []; g.pending = null; return true; }
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
    apiRef.current = { pressFloor };
    const onOpen = () => {
      const n = Math.round(g.el.floor);
      if (g.mode === 'home') { W.callMat.emissive.set('#000000'); W.callMat.color.set('#f8f9fa'); say(VOICE.advArrive()); return; }
      if (n === 1) {
        g.mode = 'done'; g.path = [{ x: -1.5, z: CAR_Z }]; g.pending = () => { g.rot = Math.PI / 2; g.happyUntil = g.t + 999; };
        audio.playFanfare(); say(VOICE.advDone());
        for (let i = 0; i < 8; i++) later(() => pop(['🎉', '⭐', '💗', '🎈'][i % 4], -0.8 + (Math.random() - 0.5), 1.2 + Math.random() * 0.6, CAR_Z + (Math.random() - 0.5) * 1.2), 400 + i * 180);
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
      E.leaves.forEach((m, k) => { m.position.z = E.zc + (k ? 1 : -1) * (0.25 + E.door * 0.48); });
      const n = Math.round(el.floor);
      E.disp.draw(el.state === 'coming' || el.state === 'moving' ? `${(el.state === 'coming' ? HOME : el.target) > el.floor ? '▲' : '▼'}${n}` : `${n}`);
    };

    // ── 터치 ──
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const onDown = (e) => {
      if (g.mode !== 'home') return;
      const r = cv.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const hs = ray.intersectObjects(tapObjs, true).filter(h => h.object.visible !== false && (h.object.parent ? h.object.parent.visible !== false : true));
      if (hs.length && hs[0].object.userData.tap != null) { goTap(hs[0].object.userData.tap); return; }
      if (ray.ray.intersectPlane(plane, hit)) { audio.playFreq(660, 'sine', 0.05, 0.15); goTo(clamp(hit.x, -1.5, 10), clamp(hit.z, END_Z + 0.2, 6.9), null); }
    };
    cv.addEventListener('pointerdown', onDown);
    if (import.meta.env.DEV) window.__adv = { g, goTo, goTap, pressFloor, W };

    // ── 매 프레임 ──
    let raf = 0, last = performance.now();
    const tmp = new THREE.Vector3();
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
      // 엘리베이터에 탔다
      if (g.mode === 'home' && g.el.state === 'open' && g.x > 0.4 && Math.abs(g.z - CAR_Z) < 0.7) {
        g.mode = 'ride'; g.path = [{ x: 0.5, z: CAR_Z + 0.36 }]; g.pending = () => { g.rot = -Math.PI / 2; }; say(VOICE.advInside());
      }
      // 처음 가 본 곳 안내
      if (g.mode === 'home' && inCorridor(g.x + 0.15, g.z)) { once('corridor', () => say(VOICE.advCorridor())); if (g.z < HALL_Z + 0.5 && g.el.state === 'idle') once('hall', () => say(VOICE.advCallHint())); }

      // 유나 그림
      const happy = t < g.happyUntil, sw = g.moving ? Math.sin(g.phase) : 0;
      yuna.root.position.set(g.x, (g.moving ? Math.abs(Math.sin(g.phase)) * 0.03 : 0) + (happy ? Math.abs(Math.sin(t * 7)) * 0.12 : 0), g.z);
      yuna.root.rotation.y = g.rot;
      yuna.legs[0].p.rotation.x = sw * 0.7; yuna.legs[1].p.rotation.x = -sw * 0.7;
      const press = clamp(1 - Math.abs((t - g.pressT) - 0.25) / 0.25, 0, 1);
      yuna.arms[0].rotation.x = -sw * 0.6; yuna.arms[1].rotation.x = sw * 0.6 - press * 1.5;
      yuna.arms[0].rotation.z = -0.12 - (happy ? 2.4 + Math.sin(t * 12) * 0.3 : 0); yuna.arms[1].rotation.z = 0.12 + (happy ? 2.4 + Math.sin(t * 12 + 1) * 0.3 : 0);
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
      if (g.mode === 'ride' || g.mode === 'done') { tmp.set(1.66, 1.8, CAR_Z + 0.1); g.cam.lerp(tmp, 1 - Math.exp(-dt * 5)); tmp.set(0, 0.95, CAR_Z); g.look.lerp(tmp, 1 - Math.exp(-dt * 5)); fov = 70; }
      else if (inside) { const fx = 5 + (g.x - 5) * 0.6, fz = 3.5 + (g.z - 3.5) * 0.6; tmp.set(fx, 8.6, fz + 6.6); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(fx, 0.2, fz - 0.2); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); }
      else { tmp.set(-7.2, 3.5, g.z + 0.6); g.cam.lerp(tmp, 1 - Math.exp(-dt * 3)); tmp.set(0, 0.95, g.z - 0.7); g.look.lerp(tmp, 1 - Math.exp(-dt * 3)); fov = 40; }
      g.fov += (fov - g.fov) * (1 - Math.exp(-dt * 4));
      if (Math.abs(camera.fov - g.fov) > 0.01) { camera.fov = g.fov; camera.updateProjectionMatrix(); }
      camera.position.copy(g.cam); camera.lookAt(g.look);
      W.outerG.visible = !inside;
      W.fades.forEach(f => {
        const want = inside && f.z > g.z + 0.05 ? 0.1 : 1;
        f.mats.forEach(m => { const o = m.opacity + (want - m.opacity) * Math.min(1, dt * 8), tr = o < 0.98; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = tr ? o : 1; m.depthWrite = !tr; });
      });
      renderer.render(W.scene, camera);

      // 화면 글자
      const n = Math.round(g.el.floor), st = g.el.state;
      let hint = 'home', hintText = '';
      if (g.mode === 'done') hint = '';
      else if (g.mode === 'ride') { if (st === 'open') hint = 'pick'; else { hint = 'text'; hintText = st === 'moving' ? `🛗 슝~ ${n}층` : '🛗 문이 움직여요'; } }
      else if (inCorridor(g.x, g.z)) { if (st === 'open') hint = 'enter'; else if (st !== 'idle') { hint = 'text'; hintText = `🛗 엘리베이터가 오고 있어요... ${n}층`; } else hint = g.z < HALL_Z + 0.7 ? 'call' : 'corridor'; }
      else if (g.x < 1.22 && g.z > 2.84 && g.z < 4.38) hint = g.shoes ? 'door' : 'shoes';
      const key = `${hint}|${hintText}|${g.mode}|${n}|${st}|${g.el.target}`;
      if (key !== g.lastUi) { g.lastUi = key; setUi({ hint, hintText, mode: g.mode, floor: n, busy: st !== 'open', done: g.mode === 'done', target: st === 'closing' || st === 'moving' ? g.el.target : null }); }
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
        <div style={{ flex: 1, textAlign: 'center', fontFamily: JUA, fontSize: '1.4rem', color: '#2b6cb0' }}>🏡 유나의 모험 · {ui.mode === 'home' ? '우리 집' : `엘리베이터 ${ui.floor}층`}</div>
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
        {ui.done && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#db2777', textShadow: '0 3px 0 #fff', background: 'rgba(255,255,255,0.85)', borderRadius: '22px', padding: '6px 22px' }}>🎉 1층에 도착했어요!</div>
            <button onClick={onRestart} style={btn('#4dabf7')}>🔄 한 번 더 하기</button>
          </div>
        )}
      </div>
    </div>
  );
}
