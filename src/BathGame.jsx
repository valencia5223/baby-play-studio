// 🛁 뽀글뽀글 목욕 놀이 (three.js 3D)
//  - 우리 집 욕실(하늘색 타일·세면대)의 벽에 붙은 큰 흰 붙박이 욕조에서 강아지 · 고양이 · 유나 · 토끼 · 곰 · 판다 · 돼지 · 펭귄 중 하나를 씻긴다. 물 위에는 아기상어·엄마상어·아빠상어·거북이·노란 병아리·하얀 병아리 장난감이 둥둥
//  - 도구: 비누 스펀지(문지르면 거품, 얼룩이 거품에 덮임) → 샤워기(물줄기로 거품·얼룩 헹굼) → (다 헹구면 부르르 털기) → 밀대(바닥 물웅덩이 청소) → 수건 → 드라이어(복슬복슬)
//    순서는 자유. 지금 할 차례인 도구 버튼이 반짝이고 음성으로 알려 준다
//  - 장난감: 처음엔 욕조 위 벽 선반에 나란히. 끌어서 욕조에 놓으면 퐁당 물에 떠다니고, 욕조 밖에 놓으면 선반으로 돌아간다.
//    누르면 소리(상어는 아기상어 멜로디). 비눗방울은 누르면 터진다. 물을 누르면 물결
//  - 좌표: 미터, y 위, 욕조 가운데가 원점. 뒷벽 z=-0.42, 왼쪽 벽 x=-0.84. 카메라는 앞(+z)에서 욕조를 내려다본다. 욕조 긴 쪽이 x
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VOICE } from './voiceLines.js';
import { GUEST_FN } from './KitchenGame.jsx';
import { makeWorld, makeParent } from './AdventureGame.jsx';   // 우리 집 (현관 오른쪽 방 · 거실 · 안방) · 엄마 아빠

const JUA = "'Jua', 'Gaegu', sans-serif";
const WATER_Y = 0.42;          // 욕조 물 높이
const TUB_CX = 0;              // 욕조 안쪽 가운데
const ROOT_Y = 0.06;           // 친구가 앉는 높이 (물 높이에 맞춤)
const SHELF_Y = 0.88, SHELF_W = 1.3, SHELF_Z = -0.34;   // 장난감 선반 윗면 높이 · 길이 · 장난감 놓는 z

const BATH_FRIENDS = [
  { id: 'dog', name: '멍멍이', icon: '🐶', label: '강아지', color: '#f59f00' },
  { id: 'cat', name: '야옹이', icon: '🐱', label: '고양이', color: '#e8590c' },
  { id: 'yuna', name: '유나', icon: '👧', label: '유나', color: '#f06595' },
  { id: 'rabbit', name: '깡총이', icon: '🐰', label: '토끼', color: '#f783ac' },
  { id: 'bear', name: '곰돌이', icon: '🐻', label: '곰', color: '#a0522d' },
  { id: 'panda', name: '판다', icon: '🐼', label: '판다', color: '#495057' },
  { id: 'pig', name: '꿀꿀이', icon: '🐷', label: '돼지', color: '#f06595' },
  { id: 'penguin', name: '펭펭이', icon: '🐧', label: '펭귄', color: '#1c7ed6' }
];
const BATH_TOYS = [
  { id: 'babyShark', kind: 'shark', color: '#ffd43b', size: 0.82, pitch: 1.25 },
  { id: 'momShark', kind: 'shark', color: '#ff8fab', size: 1.0, pitch: 1 },
  { id: 'dadShark', kind: 'shark', color: '#4dabf7', size: 1.15, pitch: 0.5 },
  { id: 'turtle', kind: 'turtle', color: '#51cf66', size: 1 },
  { id: 'chickY', kind: 'chick', color: '#ffd43b', size: 1 },
  { id: 'chickW', kind: 'chick', color: '#fbfbf8', size: 1 }
];

// ─────────────────────────────── 도우미 ───────────────────────────────
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const tileTex = (a, b, line) => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
  c.strokeStyle = line; c.lineWidth = 2; [[0, 0], [64, 0], [0, 64], [64, 64]].forEach(([x, y]) => c.strokeRect(x, y, 64, 64));
});
const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m; };
const sph = (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);

// 욕조 평면 모양: 둥근 사각형(초타원). a=반 길이, b=반 폭, pw 가 작을수록 모서리가 각진다
function ringPts(a, b, y, cx = 0, pw = 0.3, N = 96) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pts.push(new THREE.Vector3(cx + Math.sign(c) * Math.pow(Math.abs(c), pw) * a, y, Math.sign(s) * Math.pow(Math.abs(s), pw) * b));
  }
  return pts;
}
// 고리(점 목록)들을 차례로 이어 붙인 면
function loft(rings, flip = false) {
  const N = rings[0].length, pos = [], idx = [];
  rings.forEach(r => r.forEach(p => pos.push(p.x, p.y, p.z)));
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < N; i++) {
    const a = j * N + i, b = j * N + (i + 1) % N, c = (j + 1) * N + i, d = (j + 1) * N + (i + 1) % N;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 물 높이에서 욕조 안쪽 경계 (물 위 장난감·물결이 벗어나지 않게)
const IN_A = 0.676, IN_B = 0.277, IN_E = 2 / 0.3;
function insideTub(x, z, m = 1) {
  return Math.pow(Math.abs((x - TUB_CX) / (IN_A * m)), IN_E) + Math.pow(Math.abs(z / (IN_B * m)), IN_E) < 1;
}

// ─────────────────────────────── 욕실 ───────────────────────────────
function makeBathroom(scene) {
  const g = new THREE.Group(); scene.add(g);
  const floorTex = tileTex('#dff3fb', '#cfeaf6', 'rgba(110,160,180,0.5)'); floorTex.repeat.set(8, 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), S('#ffffff', { map: floorTex, roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.7); floor.receiveShadow = true; g.add(floor);
  const wallTex = tileTex('#f2fafd', '#e6f4fa', 'rgba(140,180,200,0.45)'); wallTex.repeat.set(10, 6);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.6), S('#ffffff', { map: wallTex, roughness: 0.3 })); back.position.set(0.9, 1.3, -0.42); back.receiveShadow = true; g.add(back);
  const wl = wallTex.clone(); wl.needsUpdate = true; wl.repeat.set(7, 6);
  [-0.84, 3.1].forEach(x => { const w = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), S('#ffffff', { map: wl, roughness: 0.3 })); w.position.set(x, 1.3, 1.18); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; w.receiveShadow = true; g.add(w); });
  // 띠 타일
  mesh(new THREE.BoxGeometry(4.4, 0.06, 0.01), S('#9ad3ea'), 0.9, 1.1, -0.415, g);
  // 수도꼭지 · 샤워기 걸이 (욕조 위 뒷벽)
  const white = S('#ffffff', { roughness: 0.25 });
  const chrome = S('#d9dee3', { metalness: 0.9, roughness: 0.18 });
  mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), chrome, -0.45, 0.72, -0.34, g).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), chrome, -0.45, 0.82, -0.39, g);
  [-1, 1].forEach(k => mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 12), S('#e9ecef', { roughness: 0.2 }), -0.45 + k * 0.13, 0.82, -0.37, g).rotation.x = Math.PI / 2);
  const holder = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 8), chrome, 0.75, 1.45, -0.4, g); holder.castShadow = false;
  // 장난감 선반 (욕조 위 뒷벽, 흰 선반 + 받침)
  const shelf = mesh(new THREE.BoxGeometry(SHELF_W, 0.03, 0.15), S('#ffffff', { roughness: 0.3 }), 0, SHELF_Y - 0.015, -0.345, g); shelf.receiveShadow = true;
  mesh(new THREE.BoxGeometry(SHELF_W, 0.012, 0.01), S('#9ad3ea', { roughness: 0.3 }), 0, SHELF_Y - 0.004, -0.272, g);
  [-1, 1].forEach(k => mesh(new THREE.BoxGeometry(0.03, 0.1, 0.1), S('#e9ecef', { roughness: 0.3 }), k * (SHELF_W / 2 - 0.08), SHELF_Y - 0.08, -0.37, g));
  // 세면대 + 거울 (욕조 오른쪽)
  mesh(new THREE.BoxGeometry(0.62, 0.8, 0.48), S('#f8f9fa', { roughness: 0.4 }), 1.6, 0.4, -0.17, g);
  mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.12, 24), white, 1.6, 0.86, -0.15, g);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 10), chrome, 1.6, 0.98, -0.35, g);
  const mirror = mesh(new THREE.BoxGeometry(0.7, 0.8, 0.02), S('#cfe3ee', { metalness: 0.95, roughness: 0.05 }), 1.6, 1.55, -0.405, g); mirror.castShadow = false;
  mesh(new THREE.BoxGeometry(0.74, 0.84, 0.01), S('#ffffff'), 1.6, 1.55, -0.415, g);
  // 수건걸이 + 분홍 수건 (욕조와 세면대 사이 뒷벽)
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), chrome, 1.05, 1.3, -0.38, g).rotation.z = Math.PI / 2;
  const tw = mesh(new THREE.BoxGeometry(0.36, 0.55, 0.03), S('#ffb3c6', { roughness: 0.95 }), 1.05, 1.04, -0.37, g); tw.castShadow = false;
  [0.86, 0.91].forEach(y => mesh(new THREE.BoxGeometry(0.36, 0.03, 0.035), S('#ffffff', { roughness: 0.95 }), 1.05, y, -0.37, g));
  // 욕실 매트
  const mat = mesh(new THREE.BoxGeometry(0.9, 0.015, 0.5), S('#c5f6fa', { roughness: 1 }), 0.1, 0.008, 0.72, g); mat.receiveShadow = true;
  return g;
}

// ─────────────────────────────── 붙박이 욕조 ───────────────────────────────
// 바깥은 각진 상자(앞판), 위는 넓은 턱, 안쪽은 둥근 사각형으로 파인 욕조. 뒷벽·왼쪽 벽에 붙어 있다
function makeTub(scene) {
  const g = new THREE.Group(); scene.add(g);
  const m = S('#ffffff', { roughness: 0.22, side: THREE.DoubleSide });
  const OA = 0.84, OB = 0.4, OZ = -0.02, TOP = 0.56;
  const box = (pw) => [ringPts(OA, OB, 0, 0, pw), ringPts(OA, OB, TOP, 0, pw)];
  const outer = loft(box(0.06)); outer.translate(0, 0, OZ);
  const deck = loft([ringPts(OA, OB, TOP, 0, 0.06).map(v => v.setZ(v.z + OZ)), ringPts(0.7, 0.29, TOP)]);
  const inner = loft([ringPts(0.7, 0.29, TOP), ringPts(0.69, 0.285, 0.5), ringPts(0.665, 0.275, 0.4), ringPts(0.62, 0.25, 0.16), ringPts(0.57, 0.22, 0.1), ringPts(0.01, 0.01, 0.1)], true);
  [outer, deck, inner].forEach(geo => { const o = mesh(geo, m, 0, 0, 0, g); o.receiveShadow = true; });
  mesh(new THREE.BoxGeometry(OA * 2, 0.06, 0.02), S('#e9ecef', { roughness: 0.4 }), 0, 0.03, OZ + OB + 0.005, g);    // 아래 걸레받이
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), S('#dee2e6', { metalness: 0.8, roughness: 0.2 }), 0.42, 0.103, 0, g);   // 배수 마개
  return g;
}

// 물 표면: 욕조 안쪽 모양으로 오린 촘촘한 판 (물결은 매 프레임 높이를 바꾼다)
function makeWater(scene) {
  const geo = new THREE.PlaneGeometry(IN_A * 2, IN_B * 2, 64, 28); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {   // 경계 밖 점은 경계로 당긴다
    let x = p.getX(i), z = p.getZ(i);
    for (let k = 0; k < 30 && !insideTub(x + TUB_CX, z, 0.995); k++) { x *= 0.97; z *= 0.97; }
    p.setXYZ(i, x + TUB_CX, WATER_Y, z);
  }
  geo.computeVertexNormals();
  const base = new Float32Array(p.array);
  const w = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#8fd3f0', transparent: true, opacity: 0.62, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }));
  w.renderOrder = 2; scene.add(w);
  return { mesh: w, base };
}

// ─────────────────────────────── 친구 (강아지 · 고양이 · 유나) ───────────────────────────────
// 생김새·색은 선택창(요리 놀이 손님 그림 GUEST_FN)과 맞춘다
// 반환: root, fur(젖고 마르는 털 재질들), parts(얼룩·거품이 붙는 몸 메시, 구 모양), head, tail, ears, eyes
function makeFriend(id) {
  const root = new THREE.Group();
  const fur = [], parts = [], eyes = [], ears = [];
  const addPart = (m) => { parts.push(m); return m; };
  const Zv = new THREE.Vector3(0, 0, 1);
  // 구 표면에 납작하게 붙는 무늬 (줄무늬·눈 얼룩)
  const decal = (sphere, r, dir, sx, sy, mat) => { const d = dir.clone().normalize(); const m = mesh(sph(1, 12, 8), mat, 0, 0, 0, sphere); m.position.copy(d).multiplyScalar(r * 0.995); m.quaternion.setFromUnitVectors(Zv, d); m.scale.set(sx, sy, 0.004); m.castShadow = false; return m; };
  const blushMat = () => new THREE.MeshStandardMaterial({ color: '#f472b6', transparent: true, opacity: 0.35 });
  // 동그란 까만 눈 (또는 초록 눈동자 + 세로 동공) + 반짝이
  const eye = (head, x, y, z, r, iris) => {
    const e = mesh(sph(r), S(iris || '#2a1a0e', { roughness: 0.15 }), x, y, z, head); e.scale.set(1, 1.15, 0.5); eyes.push(e);
    if (iris) mesh(sph(r), S('#111111', { roughness: 0.15 }), 0, 0, 0.35 * r, e).scale.set(0.45, 0.85, 0.75);
    mesh(sph(r * 0.36), S('#ffffff'), x - r * 0.35, y + r * 0.45, z + r * 0.5, head);
  };
  if (id === 'dog') {
    // 강아지: 황토색 털, 진갈색 늘어진 귀, 한쪽 눈 갈색 얼룩, 크림색 주둥이·배, 까만 코
    const coat = S('#e6b47c', { roughness: 0.85 }), ear = S('#7a4a26', { roughness: 0.85 }), cream = S('#fff6e8', { roughness: 0.85 }), tailM = S('#c98b4c', { roughness: 0.85 });
    fur.push(coat, ear, cream, tailM);
    addPart(mesh(sph(0.16), coat, 0, 0.31, -0.03, root)).scale.set(1, 1.15, 1.05);                 // 몸
    addPart(mesh(sph(0.105), cream, 0, 0.43, 0.065, root)).scale.set(1, 1.05, 0.85);              // 배
    const head = new THREE.Group(); head.position.set(0, 0.6, 0.05); root.add(head);
    const skull = addPart(mesh(sph(0.145, 28, 20), coat, 0, 0, 0, head)); skull.scale.set(1.1, 1, 0.98);
    decal(skull, 0.145, new THREE.Vector3(0.42, 0.22, 0.88), 0.042, 0.037, S('#b9773f', { roughness: 0.85 }));   // 한쪽 눈 얼룩 (보는 사람 오른쪽)
    addPart(mesh(sph(0.065), cream, 0, -0.055, 0.11, head)).scale.set(1.25, 0.85, 0.85);          // 주둥이
    mesh(sph(0.024), S('#2b1a10', { roughness: 0.25 }), 0, -0.028, 0.168, head).scale.set(1.35, 0.9, 0.9);   // 코
    const smile = mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 16, Math.PI), S('#2b1a10'), 0, -0.065, 0.165, head); smile.rotation.z = Math.PI; smile.castShadow = false;
    [-1, 1].forEach(k => {
      eye(head, k * 0.058, 0.02, 0.122, 0.024);
      mesh(sph(0.026), blushMat(), k * 0.1, -0.04, 0.108, head).scale.set(1.1, 0.65, 0.4);
      const eg = new THREE.Group(); eg.position.set(k * 0.135, 0.07, -0.005); head.add(eg);   // 늘어진 귀
      addPart(mesh(sph(0.07), ear, 0, -0.085, 0, eg)).scale.set(0.5, 1.4, 0.95); eg.rotation.z = k * 0.3; ears.push(eg);
    });
    [-1, 1].forEach(k => addPart(mesh(sph(0.045), cream, k * 0.08, 0.37, 0.15, root)).scale.set(1, 0.8, 1.2));   // 앞발
    [-1, 1].forEach(k => mesh(sph(0.05), cream, k * 0.1, 0.15, 0.1, root).scale.set(1, 0.7, 1.35));             // 뒷발 (욕조 밖에서 보임)
    const tail = new THREE.Group(); tail.position.set(0.05, 0.38, -0.19); root.add(tail);
    const tl = mesh(new THREE.CapsuleGeometry(0.03, 0.13, 6, 10), tailM, 0, 0.08, 0, tail); tl.rotation.set(-0.4, 0, -0.5);
    root.userData = { head, tail, sound: 'dog', mouth: new THREE.Vector3(0, -0.065, 0.165) };
  } else if (id === 'cat') {
    // 고양이(치즈 태비): 주황 털, 이마 줄무늬 세 줄, 세모 귀(안쪽 분홍), 하얀 입 둘레, 초록 눈 + 세로 동공, 분홍 세모 코, 갈색 수염, 줄무늬 꼬리
    const coat = S('#f6ad62', { roughness: 0.85 }), body = S('#f8b46a', { roughness: 0.85 }), stripe = S('#d27a32', { roughness: 0.85 }), white = S('#fff8ef', { roughness: 0.85 });
    fur.push(coat, body, stripe, white);
    const bd = addPart(mesh(sph(0.15), body, 0, 0.31, -0.03, root)); bd.scale.set(1, 1.15, 1.05);
    [-0.5, 0, 0.5].forEach(x => decal(bd, 0.15, new THREE.Vector3(x, 0.55, -0.7), 0.012, 0.05, stripe));   // 등 줄무늬
    addPart(mesh(sph(0.095), white, 0, 0.43, 0.07, root)).scale.set(1, 1.05, 0.85);               // 하얀 배
    const head = new THREE.Group(); head.position.set(0, 0.6, 0.05); root.add(head);
    const skull = addPart(mesh(sph(0.14, 28, 20), coat, 0, 0, 0, head)); skull.scale.set(1.18, 0.98, 0.98);
    [-0.15, 0, 0.15].forEach((x, i) => decal(skull, 0.14, new THREE.Vector3(x, 0.75, 0.6), 0.011, i === 1 ? 0.04 : 0.032, stripe));   // 이마 줄무늬
    addPart(mesh(sph(0.062), white, 0, -0.06, 0.1, head)).scale.set(1.25, 0.82, 0.75);            // 하얀 입 둘레
    [-1, 1].forEach(k => {
      eye(head, k * 0.062, 0.018, 0.118, 0.027, '#9ccc4a');
      mesh(sph(0.024), blushMat(), k * 0.1, -0.035, 0.1, head).scale.set(1.1, 0.6, 0.4);
      const eg = new THREE.Group(); eg.position.set(k * 0.09, 0.095, 0); eg.rotation.set(-0.1, 0, -k * 0.32); head.add(eg);   // 세모 귀
      mesh(new THREE.ConeGeometry(0.058, 0.115, 16), S('#f2a557', { roughness: 0.85 }), 0, 0.045, 0, eg).scale.z = 0.55;
      mesh(new THREE.ConeGeometry(0.036, 0.078, 12), S('#f9b6c4', { roughness: 0.6 }), 0, 0.036, 0.013, eg).scale.z = 0.35;
      ears.push(eg);
      for (let i = 0; i < 3; i++) { const w = mesh(new THREE.CylinderGeometry(0.0018, 0.0012, 0.13, 4), S('#8a6a55', { roughness: 0.5 }), k * 0.11, -0.05 - (i - 1) * 0.014, 0.115, head); w.rotation.set(0, k * 0.35, Math.PI / 2 + k * (i - 1) * 0.18); w.castShadow = false; }
    });
    const nose = mesh(new THREE.ConeGeometry(0.017, 0.02, 3), S('#f47c96', { roughness: 0.35 }), 0, -0.03, 0.15, head); nose.rotation.set(Math.PI, 0, 0); nose.scale.z = 0.6;
    const smile = mesh(new THREE.TorusGeometry(0.016, 0.0032, 6, 16, Math.PI), S('#7a3e1a'), 0, -0.062, 0.148, head); smile.rotation.z = Math.PI; smile.castShadow = false;
    [-1, 1].forEach(k => addPart(mesh(sph(0.042), white, k * 0.075, 0.37, 0.15, root)).scale.set(1, 0.8, 1.2));   // 하얀 앞발
    [-1, 1].forEach(k => mesh(sph(0.048), white, k * 0.1, 0.15, 0.1, root).scale.set(1, 0.7, 1.35));             // 뒷발
    const tail = new THREE.Group(); tail.position.set(0.07, 0.36, -0.17); root.add(tail);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.07, 0.07, -0.03), new THREE.Vector3(0.1, 0.19, -0.02), new THREE.Vector3(0.07, 0.29, 0.01), new THREE.Vector3(0.02, 0.32, 0.03)]);
    const tailCol = S('#ea9a4c', { roughness: 0.85 });
    mesh(new THREE.TubeGeometry(curve, 28, 0.024, 12), tailCol, 0, 0, 0, tail);
    [0, 1].forEach(q => { const p = curve.getPoint(q); mesh(sph(0.024, 14, 10), tailCol, p.x, p.y, p.z, tail); });   // 꼬리 양 끝을 둥글게 막음
    // 꼬리 줄무늬: 꼬리 방향에 맞춰 눕힌 얇은 띠
    const Yax = new THREE.Vector3(0, 1, 0);
    [0.25, 0.45, 0.65, 0.84].forEach(q => { const p = curve.getPoint(q), b = mesh(new THREE.CylinderGeometry(0.0255, 0.0255, 0.014, 14), stripe, p.x, p.y, p.z, tail); b.quaternion.setFromUnitVectors(Yax, curve.getTangent(q)); });
    root.userData = { head, tail, sound: 'cat', mouth: new THREE.Vector3(0, -0.062, 0.148) };
  } else if (id !== 'yuna') {
    // 토끼 · 곰 · 판다 · 돼지 · 펭귄: 강아지와 같은 앉은 몸에 종류별 귀 · 코 · 무늬 · 꼬리
    const P = {
      rabbit: { coat: '#fbf8f4', belly: '#fffaf5', muzzle: '#ffffff', paw: '#fde4e8', foot: '#fff3f5', nose: '#f28ba1' },
      bear: { coat: '#b98352', belly: '#e9cba0', muzzle: '#efd6b3', paw: '#e9cba0', foot: '#a8733f', nose: '#2b1a10' },
      panda: { coat: '#f8f9fa', belly: '#ffffff', muzzle: '#ffffff', paw: '#2b2b30', foot: '#2b2b30', nose: '#1f1f24' },
      pig: { coat: '#ffc7d2', belly: '#ffe1e7', muzzle: null, paw: '#f5a3b5', foot: '#e88aa0', nose: '#b5546d' },
      penguin: { coat: '#334155', belly: '#ffffff', muzzle: null, paw: '#334155', foot: '#f59e0b', nose: '#f59e0b' }
    }[id];
    const coat = S(P.coat, { roughness: 0.85 }), belly = S(P.belly, { roughness: 0.85 }), paw = S(P.paw, { roughness: 0.85 });
    fur.push(coat, belly, paw);
    addPart(mesh(sph(0.16), coat, 0, 0.31, -0.03, root)).scale.set(1, 1.15, 1.05);                         // 몸
    addPart(mesh(sph(0.105), belly, 0, 0.43, 0.065, root)).scale.set(id === 'penguin' ? 1.2 : 1, 1.05, 0.85);   // 배
    const head = new THREE.Group(); head.position.set(0, 0.6, 0.05); root.add(head);
    const skull = addPart(mesh(sph(0.145, 28, 20), coat, 0, 0, 0, head)); skull.scale.set(1.1, 1, 0.98);
    const dark = S('#2b2b30', { roughness: 0.85 });
    if (id === 'panda') [-1, 1].forEach(k => decal(skull, 0.145, new THREE.Vector3(k * 0.4, 0.12, 0.9), 0.04, 0.052, dark).rotateZ(k * 0.55));   // 눈 둘레 까만 무늬
    if (id === 'penguin') [-1, 1].forEach(k => decal(skull, 0.145, new THREE.Vector3(k * 0.36, -0.05, 0.93), 0.062, 0.07, S('#ffffff', { roughness: 0.8 })));   // 하얀 얼굴
    if (P.muzzle) addPart(mesh(sph(0.065), S(P.muzzle, { roughness: 0.85 }), 0, -0.055, 0.11, head)).scale.set(1.2, 0.82, 0.8);   // 주둥이
    const noseM = S(P.nose, { roughness: 0.3 });
    let mouthY = -0.065, mouthZ = 0.162;
    if (id === 'pig') {   // 납작한 돼지코 + 콧구멍
      const sn = mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.05, 24), S('#f5a3b5', { roughness: 0.5 }), 0, -0.035, 0.13, head); sn.rotation.x = Math.PI / 2; sn.scale.z = 0.72;
      [-1, 1].forEach(k => mesh(sph(0.011), noseM, k * 0.018, -0.035, 0.155, head).scale.set(0.8, 1.2, 0.4));
      mouthY = -0.085; mouthZ = 0.135;
    } else if (id === 'penguin') {   // 주황 부리 (위아래 두 쪽)
      const up = mesh(new THREE.ConeGeometry(0.03, 0.07, 14), noseM, 0, -0.035, 0.165, head); up.rotation.x = Math.PI / 2; up.scale.set(1.3, 1, 0.6);
      const lo = mesh(new THREE.ConeGeometry(0.022, 0.045, 14), S('#fb923c', { roughness: 0.3 }), 0, -0.055, 0.155, head); lo.rotation.x = Math.PI / 2; lo.scale.set(1.2, 1, 0.5);
      mouthY = -0.05; mouthZ = 0.19;
    } else {
      mesh(sph(id === 'rabbit' ? 0.016 : 0.024), noseM, 0, -0.03, 0.165, head).scale.set(1.35, 0.9, 0.9);
    }
    if (id !== 'penguin') {
      const smile = mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 16, Math.PI), S('#5a2e1e'), 0, mouthY, mouthZ, head); smile.rotation.z = Math.PI; smile.castShadow = false;
    }
    if (id === 'rabbit') [-1, 1].forEach(k => mesh(new THREE.BoxGeometry(0.012, 0.016, 0.004), S('#ffffff', { roughness: 0.3 }), k * 0.0065, mouthY - 0.02, mouthZ - 0.004, head));   // 앞니
    [-1, 1].forEach(k => {
      if (id === 'panda') mesh(sph(0.03), S('#ffffff', { roughness: 0.3 }), k * 0.058, 0.02, 0.118, head).scale.set(1, 1.1, 0.45);   // 까만 무늬 위에 하얀 눈 테두리
      eye(head, k * 0.058, 0.02, 0.124, 0.024);
      mesh(sph(0.026), blushMat(), k * 0.1, -0.04, 0.108, head).scale.set(1.1, 0.65, 0.4);
      const eg = new THREE.Group(); head.add(eg);
      if (id === 'rabbit') {   // 길게 선 귀 (안쪽 분홍)
        eg.position.set(k * 0.06, 0.11, -0.01); eg.rotation.z = -k * 0.18;
        addPart(mesh(new THREE.CapsuleGeometry(0.036, 0.13, 6, 12), coat, 0, 0.09, 0, eg)).scale.z = 0.55;
        mesh(new THREE.CapsuleGeometry(0.021, 0.11, 6, 10), S('#f8bfcb', { roughness: 0.6 }), 0, 0.09, 0.016, eg).scale.z = 0.3;
      } else if (id === 'bear' || id === 'panda') {   // 동그란 귀
        eg.position.set(k * 0.112, 0.112, -0.01);
        addPart(mesh(sph(0.05), id === 'panda' ? dark : coat, 0, 0, 0, eg)).scale.z = 0.7;
        if (id === 'bear') mesh(sph(0.03), S('#e3b98a', { roughness: 0.85 }), 0, -0.004, 0.022, eg).scale.z = 0.5;
      } else if (id === 'pig') {   // 앞으로 살짝 접힌 세모 귀
        eg.position.set(k * 0.1, 0.11, 0.0); eg.rotation.set(0.5, 0, -k * 0.45);
        mesh(new THREE.ConeGeometry(0.048, 0.09, 4), S('#f5a3b5', { roughness: 0.6 }), 0, 0.03, 0, eg).scale.z = 0.4;
      }
      ears.push(eg);
    });
    if (id === 'penguin') {   // 날개
      [-1, 1].forEach(k => { const w = addPart(mesh(sph(0.07), coat, k * 0.165, 0.33, 0.0, root)); w.scale.set(0.35, 1.25, 0.75); w.rotation.z = k * 0.3; });
    } else [-1, 1].forEach(k => addPart(mesh(sph(0.045), paw, k * 0.08, 0.37, 0.15, root)).scale.set(1, 0.8, 1.2));   // 앞발
    [-1, 1].forEach(k => mesh(sph(0.05), S(P.foot, { roughness: 0.7 }), k * 0.1, 0.15, 0.1, root).scale.set(1, id === 'penguin' ? 0.4 : 0.7, 1.35));   // 뒷발
    if (id === 'panda') [-1, 1].forEach(k => decal(root.children[0], 0.16, new THREE.Vector3(k * 0.75, 0.5, 0.42), 0.06, 0.08, dark));   // 어깨 까만 띠
    const tail = new THREE.Group(); tail.position.set(0, 0.25, -0.2); root.add(tail);
    if (id === 'pig') {   // 꼬불 꼬리
      const pts = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 3; pts.push(new THREE.Vector3(Math.cos(a) * 0.025, 0.04 + Math.sin(a) * 0.025, -i * 0.003)); }
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.008, 8), S('#f39aae', { roughness: 0.6 }), 0, 0, 0, tail);
    } else if (id === 'penguin') {
      mesh(new THREE.ConeGeometry(0.04, 0.06, 10), coat, 0, -0.06, 0, tail).rotation.x = -2.2;
    } else mesh(sph(id === 'rabbit' ? 0.05 : 0.035), id === 'panda' ? dark : coat, 0, 0, 0, tail);   // 동그란 꼬리
    root.userData = { head, tail, sound: id, mouth: new THREE.Vector3(0, mouthY, mouthZ + 0.004) };
  } else {
    // 유나: 물에 앉아 어깨까지 보인다. 밝은 살색, 진갈색 양 갈래 머리 + 분홍 리본 (선택창 유나와 같은 모습)
    const skin = S('#ffd9bf', { roughness: 0.6 }), hair = S('#3b2a20', { roughness: 0.75 }), ribbon = S('#f472b6', { roughness: 0.45 });
    fur.push(hair);
    addPart(mesh(sph(0.15), skin, 0, 0.36, 0, root)).scale.set(1.2, 0.95, 0.8);                    // 어깨·가슴
    [-1, 1].forEach(k => { const a = addPart(mesh(new THREE.CapsuleGeometry(0.04, 0.16, 6, 10), skin, k * 0.2, 0.36, 0.06, root)); a.rotation.set(1.2, 0, k * 0.5); });
    const head = new THREE.Group(); head.position.set(0, 0.62, 0.02); head.scale.setScalar(0.85); root.add(head);
    addPart(mesh(sph(0.2, 28, 20), skin, 0, 0, 0, head));
    [-1, 1].forEach(k => mesh(sph(0.04), skin, k * 0.198, -0.01, 0.0, head).scale.set(0.6, 1, 0.8));   // 귀
    const hairCap = addPart(mesh(new THREE.SphereGeometry(0.212, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, 0, 0.02, -0.02, head));
    const back = mesh(sph(0.205, 24, 16), hair, 0, 0.0, -0.05, head); back.scale.set(1, 1, 0.9);
    // 앞머리: 가운데 가르마 (양쪽으로 둥글게)
    [-1, 1].forEach(k => { const b = mesh(new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, k * 0.075, 0.075, 0.07, head); b.rotation.set(0.75, 0, -k * 0.35); b.scale.set(1, 1, 0.8); });
    [-1, 1].forEach(k => {
      const pig = addPart(mesh(sph(0.075), hair, k * 0.25, -0.075, -0.03, head)); pig.scale.set(0.75, 1.4, 0.75); pig.rotation.z = k * 0.2; ears.push(pig);   // 양 갈래
      // 분홍 리본 (나비 모양 두 날개 + 매듭)
      const bw = new THREE.Group(); bw.position.set(k * 0.205, 0.045, -0.01); bw.rotation.z = -k * 0.35; head.add(bw);
      [-1, 1].forEach(sd => { const wng = mesh(new THREE.ConeGeometry(0.03, 0.055, 3), ribbon, sd * 0.028, 0, 0, bw); wng.rotation.z = sd * Math.PI / 2; wng.scale.z = 0.45; });
      mesh(sph(0.016), ribbon, 0, 0, 0.004, bw);
      eye(head, k * 0.075, -0.005, 0.18, 0.027);
      mesh(sph(0.035), blushMat(), k * 0.12, -0.065, 0.152, head).scale.set(1, 0.65, 0.4);
    });
    const mouth = mesh(new THREE.TorusGeometry(0.02, 0.0045, 6, 16, Math.PI), S('#c2410c'), 0, -0.085, 0.183, head); mouth.rotation.z = Math.PI; mouth.castShadow = false;
    // 욕조 밖: 분홍 수건 가운 → 다 닦으면 노란 땡땡이 잠옷 (선택창 유나의 노란 원피스), 발
    const wrap = new THREE.Group(); wrap.visible = false; root.add(wrap);
    mesh(sph(0.15), skin, 0, 0.21, 0.01, wrap).scale.set(1.1, 0.75, 0.9);   // 통통한 아랫몸 (잠옷을 입으면 가려짐)
    const robeG = new THREE.Group(); robeG.visible = false; wrap.add(robeG);
    const robe = mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.34, 28), S('#ffc9de', { roughness: 1 }), 0, 0.29, 0, robeG); robe.scale.z = 0.8;
    mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 28), S('#ffffff', { roughness: 1 }), 0, 0.45, 0, robeG).rotation.x = Math.PI / 2;
    [-1, 1].forEach(k => mesh(sph(0.045), skin, k * 0.08, 0.13, 0.13, wrap).scale.set(1, 0.7, 1.4));
    const pj = S('#ffffff', { roughness: 0.8, map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#ffd43b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.beginPath(); c.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, 7); c.fill(); } }) });
    pj.map.repeat.set(3, 1.5);
    root.userData = { head, tail: null, hairCap, mouth: new THREE.Vector3(0, -0.085, 0.183), wrap, robe, robeG, pj };
  }
  fur.forEach(f => { f.userData.base = f.color.clone(); });
  parts.forEach(p => { p.userData.baseScale = p.scale.clone(); p.userData.r = p.geometry.parameters.radius || 0.05; });
  const u = root.userData;
  return { root, fur, parts, eyes, ears, head: u.head, tail: u.tail, mouth: u.mouth, wrap: u.wrap, robe: u.robe, robeG: u.robeG, pj: u.pj };
}

// ─────────────────────────────── 물놀이 장난감 ───────────────────────────────
function makeToy(t) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const col = S(t.color, { roughness: 0.28 });
  if (t.kind === 'shark') {
    mesh(sph(0.05), col, 0, 0.02, 0, inner).scale.set(1.7, 0.85, 0.95);
    mesh(sph(0.045), S('#ffffff', { roughness: 0.3 }), 0.01, 0.0, 0.0, inner).scale.set(1.5, 0.6, 0.85);          // 흰 배
    const fin = mesh(new THREE.ConeGeometry(0.025, 0.055, 10), col, -0.005, 0.075, 0, inner); fin.rotation.z = -0.35;   // 등지느러미
    const tail = mesh(new THREE.ConeGeometry(0.03, 0.06, 10), col, -0.095, 0.03, 0, inner); tail.rotation.z = Math.PI / 2 + 0.2; tail.scale.set(1, 1, 0.35);
    [-1, 1].forEach(k => { mesh(sph(0.009), S('#1f2937'), 0.06, 0.035, k * 0.03, inner); mesh(sph(0.003), S('#ffffff'), 0.066, 0.039, k * 0.032, inner); });
    mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 14, Math.PI), S('#e64980'), 0.075, 0.012, 0, inner).rotation.set(0, Math.PI / 2, Math.PI);   // 웃는 입
  } else if (t.kind === 'turtle') {
    mesh(new THREE.SphereGeometry(0.055, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), col, 0, 0.0, 0, inner).scale.set(1.1, 0.75, 1);   // 등껍질
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; mesh(sph(0.014, 10, 8), S('#2f9e44', { roughness: 0.3 }), Math.cos(a) * 0.03, 0.035, Math.sin(a) * 0.03, inner).scale.set(1, 0.5, 1); }
    mesh(sph(0.014, 10, 8), S('#2f9e44', { roughness: 0.3 }), 0, 0.043, 0, inner).scale.set(1, 0.5, 1);
    const skin = S('#b2f2bb', { roughness: 0.4 });
    mesh(sph(0.024), skin, 0.072, 0.012, 0, inner);
    [-1, 1].forEach(k => { mesh(sph(0.006), S('#1f2937'), 0.088, 0.02, k * 0.012, inner); });
    [[0.035, 0.05], [-0.035, 0.05], [0.035, -0.05], [-0.035, -0.05]].forEach(([x, z]) => mesh(sph(0.018), skin, x, 0.0, z, inner).scale.set(1.3, 0.4, 0.8));
  } else {   // 병아리 (고무 오리 모양)
    mesh(sph(0.05), col, 0, 0.02, 0, inner).scale.set(1.25, 0.85, 1);
    mesh(sph(0.035), col, 0.04, 0.075, 0, inner);
    const beak = mesh(new THREE.ConeGeometry(0.014, 0.03, 10), S('#ff922b', { roughness: 0.3 }), 0.08, 0.07, 0, inner); beak.rotation.z = -Math.PI / 2;
    [-1, 1].forEach(k => { mesh(sph(0.0065), S('#1f2937'), 0.065, 0.088, k * 0.017, inner); mesh(sph(0.022), col, -0.005, 0.03, k * 0.045, inner).scale.set(1.2, 0.6, 0.4); });
    const tuft = mesh(sph(0.012), col, 0.035, 0.112, 0, inner); tuft.scale.set(0.6, 1.4, 0.6);
  }
  inner.scale.setScalar(t.size * 1.25);
  g.traverse(o => { o.userData.toy = t.id; });
  return { g, inner };
}

// ─────────────────────────────── 도구 그림 ───────────────────────────────
// ─────────────────────────────── 드라이어 소리 ───────────────────────────────
//  - 병원놀이 콧물 흡입기 모터와 같은 방식(톱니파 모터음 + 바람 소리)을 드라이어답게 바꿈:
//    더 높고 가는 모터 윙~ + 날개 윙윙 떨림 + 센 바람 쏴~. 켜면 위잉 하고 돌기 시작, 끄면 우웅 하고 잦아든다
//  - 털에 대고 있으면 바람이 막혀 음이 살짝 낮고 먹먹해진다
//  - 아이패드 elementMode(<audio> 로 재생)에서는 0.5초 조각으로 만들어 이어 튼다
function dryerNoise(ctx, sec) { const n = Math.ceil(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = l * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = l * 1.6; } return b; }
function buildDryer(ctx, out, now, dur, load) {
  const f0 = load ? 182 : 205;
  const master = ctx.createGain(); master.connect(out);
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  const osc2 = ctx.createOscillator(); osc2.type = 'triangle';   // 높은 윙~ (작은 모터가 빨리 도는 소리)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = load ? 1100 : 1500; lp.Q.value = 1.2;
  const og = ctx.createGain(); og.gain.value = 0.09; const og2 = ctx.createGain(); og2.gain.value = 0.025;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 41; const lfoG = ctx.createGain(); lfoG.gain.value = 0.035;
  lfo.connect(lfoG); lfoG.connect(og.gain); osc.connect(og); osc2.connect(og2); og.connect(lp); og2.connect(master); lp.connect(master);
  const ns = ctx.createBufferSource(); ns.buffer = dryerNoise(ctx, dur ? dur + 0.05 : 2); ns.loop = !dur;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = load ? 1300 : 1900; bp.Q.value = 0.45;
  const ng = ctx.createGain(); ng.gain.value = load ? 0.3 : 0.38; ns.connect(bp); bp.connect(ng); ng.connect(master);
  const hs = ctx.createBiquadFilter(); hs.type = 'highpass'; hs.frequency.value = 3800;   // 쉬~ 하는 바람 끝소리
  const hg = ctx.createGain(); hg.gain.value = load ? 0.04 : 0.09; ns.connect(hs); hs.connect(hg); hg.connect(master);
  if (dur) {
    osc.frequency.value = f0; osc2.frequency.value = f0 * 8;
    master.gain.setValueAtTime(0.0001, now); master.gain.linearRampToValueAtTime(0.5, now + 0.03); master.gain.setValueAtTime(0.5, now + dur - 0.03); master.gain.linearRampToValueAtTime(0.0001, now + dur);
  } else {
    osc.frequency.setValueAtTime(50, now); osc.frequency.exponentialRampToValueAtTime(f0, now + 0.5);
    osc2.frequency.setValueAtTime(400, now); osc2.frequency.exponentialRampToValueAtTime(f0 * 8, now + 0.5);
    master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(0.5, now + 0.3);
  }
  const nodes = [osc, osc2, lfo, ns]; nodes.forEach(n => n.start(now)); if (dur) nodes.forEach(n => n.stop(now + dur + 0.02));
  return { master, osc, osc2, bp, ng, hg, lp, nodes };
}
function startDryer(audio) {
  if (audio.muted || audio.elementMode) return null;
  try {
    audio.init(); const ctx = audio.ctx; if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    const m = buildDryer(ctx, audio.out(), ctx.currentTime + 0.01, 0, false);
    return {
      setLoad(on) {
        const t = ctx.currentTime, f0 = on ? 182 : 205;
        m.osc.frequency.setTargetAtTime(f0, t, 0.1); m.osc2.frequency.setTargetAtTime(f0 * 8, t, 0.1);
        m.bp.frequency.setTargetAtTime(on ? 1300 : 1900, t, 0.1); m.ng.gain.setTargetAtTime(on ? 0.3 : 0.38, t, 0.08); m.hg.gain.setTargetAtTime(on ? 0.04 : 0.09, t, 0.08); m.lp.frequency.setTargetAtTime(on ? 1100 : 1500, t, 0.1);
      },
      stop() {
        const t = ctx.currentTime;
        try { m.master.gain.cancelScheduledValues(t); m.master.gain.setValueAtTime(Math.max(0.0001, m.master.gain.value), t); m.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); m.osc.frequency.setTargetAtTime(45, t, 0.18); m.osc2.frequency.setTargetAtTime(300, t, 0.18); m.nodes.forEach(n => n.stop(t + 0.65)); } catch { /* 이미 멈춤 */ }
      }
    };
  } catch { return null; }
}
function playDryerChunk(audio, load) {
  if (audio.muted) return;
  audio._renderPlay(`bathDryer${load ? 1 : 0}`, 0.5, (c, o, now) => buildDryer(c, o, now, 0.5, load));
}

function makeTools(scene) {
  const sponge = new THREE.Group(); scene.add(sponge);
  mesh(new THREE.BoxGeometry(0.11, 0.05, 0.075), S('#ffd43b', { roughness: 1 }), 0, 0, 0, sponge);
  mesh(new THREE.BoxGeometry(0.112, 0.016, 0.077), S('#69db7c', { roughness: 0.9 }), 0, 0.03, 0, sponge);
  const shower = new THREE.Group(); scene.add(shower);
  const chrome = S('#dfe3e8', { metalness: 0.85, roughness: 0.2 });
  const headM = mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.035, 24), chrome, 0, 0, 0, shower);
  mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.004, 24), S('#b8c2cc', { roughness: 0.4 }), 0, -0.019, 0, shower);
  const handle = mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.2, 10), chrome, 0, 0.06, 0.1, shower); handle.rotation.x = 1.1;
  headM.castShadow = true;
  const towel = new THREE.Group(); scene.add(towel);
  const tm = mesh(new THREE.BoxGeometry(0.28, 0.045, 0.18), S('#ffffff', { roughness: 1 }), 0, 0, 0, towel);   // 흰 샤워 타월
  [-0.06, -0.075].forEach(z => mesh(new THREE.BoxGeometry(0.282, 0.047, 0.008), S('#e3e8ee', { roughness: 1 }), 0, 0, z, towel));
  tm.castShadow = true;
  const dryer = new THREE.Group(); scene.add(dryer);
  const pink = S('#f783ac', { roughness: 0.35 });
  const body = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 16), pink, 0, 0, 0, dryer); body.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 16), S('#ffffff'), 0, 0, -0.09, dryer).rotation.x = Math.PI / 2;
  const grip = mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.12, 12), pink, 0, -0.07, 0.03, dryer); grip.rotation.x = 0.25;
  // 칫솔: 손잡이는 x 방향, 솔은 -z (얼굴 쪽)
  const brush = new THREE.Group(); scene.add(brush);
  mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.15, 10), S('#f783ac', { roughness: 0.35 }), -0.035, 0, 0, brush).rotation.z = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.045, 0.014, 0.016), S('#ffffff', { roughness: 0.4 }), 0.06, 0, 0, brush);
  mesh(new THREE.BoxGeometry(0.04, 0.018, 0.016), S('#a5d8ff', { roughness: 0.8 }), 0.06, 0, -0.014, brush);
  // 밀대 스위퍼: 납작한 하늘색 판 + 아래 하얀 걸레 + 긴 손잡이 (판만 미는 방향으로 돈다)
  const mop = new THREE.Group(); scene.add(mop);
  const mopHead = new THREE.Group(); mop.add(mopHead);
  mesh(new THREE.BoxGeometry(0.36, 0.022, 0.1), S('#4dabf7', { roughness: 0.4 }), 0, 0.026, 0, mopHead);
  const cloth = mesh(new THREE.BoxGeometry(0.38, 0.016, 0.12), S('#f8f9fa', { roughness: 1 }), 0, 0.008, 0, mopHead);
  [-0.04, 0, 0.04].forEach(z => mesh(new THREE.BoxGeometry(0.382, 0.017, 0.006), S('#d0ebff', { roughness: 1 }), 0, 0.008, z, mopHead));
  mesh(sph(0.022, 12, 8), S('#1c7ed6', { roughness: 0.4 }), 0, 0.042, 0, mop);   // 이음새
  const stick = new THREE.Group(); stick.position.y = 0.045; stick.rotation.set(0.95, 0, 0.2); mop.add(stick);
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.8, 10), S('#ced4da', { metalness: 0.7, roughness: 0.25 }), 0, 0.4, 0, stick);
  mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 12), S('#f783ac', { roughness: 0.45 }), 0, 0.74, 0, stick);
  mop.userData = { head: mopHead, cloth };
  [sponge, shower, towel, dryer, brush, mop].forEach(t => { t.visible = false; });
  return { soap: sponge, shower, towel, dryer, brush, mop };
}

// ─────────────────────────────── 화면 ───────────────────────────────
const TOOLS = [
  { id: 'soap', icon: '🧽', label: '비누' },
  { id: 'shower', icon: '🚿', label: '샤워기' },
  { id: 'towel', icon: null, label: '수건' },
  { id: 'dryer', icon: '💨', label: '드라이어' },
  { id: 'brush', icon: '🪥', label: '칫솔' },
  { id: 'mop', icon: '🧹', label: '밀대' }
];
// 단계마다 보이는 도구
const STAGE_TOOLS = { soap: ['soap', 'shower'], shower: ['soap', 'shower'], towel: ['towel'], dryer: ['dryer'], brush: ['brush'], clean: ['mop'] };
// 다음 장소로 가는 큰 버튼
const GO_BTN = {
  cleanGo: { icon: '🧹', label: '바닥 청소', bg: '#12b886' },
  towelGo: { icon: null, label: '수건 두르기', bg: '#f783ac' },   // 그림은 흰 수건
  milkGo: { icon: '🥛', label: '우유 마시기', bg: '#4dabf7' },
  brushGo: { icon: '🪥', label: '양치하기', bg: '#20c997' },
  rinseGo: { icon: '💧', label: '입 헹구기', bg: '#3b82f6' },
  bedGo: { icon: '🛏️', label: '코 자러 가기', bg: '#9775fa' }   // 엄마 또는 아빠 (무작위)
};
const HINTS = {
  soap: '🧽 비누로 몸을 뽀득뽀득 문질러요',
  shower: '🚿 샤워기로 거품을 쏴아 헹궈요',
  towel: '✋ 몸을 콕 누르면 수건을 둘러요',
  caped: '🦸 수건 망토 멋져요!',
  cleanGo: '💦 바닥에 물이 흥건해요! 청소해요',
  clean: '🧹 밀대로 바닥 물기를 쓱쓱 밀어요',
  towelGo: '🛁 수건을 눌러 욕조에서 나와요',
  out: '🛁 욕조에서 폴짝 나와요',
  dryer: '💨 방에서 드라이어로 위잉 말려요',
  milkGo: '🥛 우유 마시러 거실로 가요',
  milk: '🍼 우유를 눌러 쪽쪽 마셔요',
  brushGo: '🪥 이제 이를 닦아요',
  brush: '🪥 칫솔로 입을 치카치카 문질러요',
  rinseGo: '💧 세면대에서 입을 헹궈요',
  rinse: '💧 컵을 눌러 가글가글 헹궈요',
  bedGo: '🛏️ 이제 코~ 자러 가요',
  bedIn: '🛏️ 침대에 영차 올라가요',
  blanket: '🛏️ 이불을 콕 눌러 덮어 줘요',
  light: '💡 침대 위 전등을 눌러 불을 꺼요',
  end: '🌙 쉿, 코~ 자요'
};

export default function BathGame(props) {
  const [friend, setFriend] = useState(null);
  const [run, setRun] = useState(0);
  const { speak } = props;
  useEffect(() => { if (!friend) { try { speak(VOICE.bathPick()); } catch { /* 무시 */ } } }, [friend]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!friend) return <FriendPicker onPick={(id) => { props.audio.playPopSound(); setFriend(id); }} />;
  return <BathScene key={`${friend}-${run}`} {...props} friendId={friend} onAgain={() => setRun(r => r + 1)} onChange={() => setFriend(null)} />;
}

// 친구 고르기 카드 그림: 요리 놀이 손님 그림(GUEST_FN)을 그대로 쓴다 (원점 = 발밑 가운데, S = 크기)
function GuestPic({ id, size = 170 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext('2d'); let raf = 0; const t0 = performance.now();
    const draw = (now) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
      ctx.save(); ctx.translate(size / 2, size * 0.98); GUEST_FN[id](ctx, size * 0.78, t, false, 0); ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [id, size]);
  return <canvas ref={ref} style={{ width: `${size}px`, height: `${size}px`, pointerEvents: 'none' }} />;
}

function FriendPicker({ onPick }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', background: 'linear-gradient(#e0f4fc, #f3fbff)', borderRadius: '26px', padding: '1rem' }}>
      <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#1d6fa5' }}>🛁 누구랑 목욕할까요?</div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '760px' }}>
        {BATH_FRIENDS.map(f => (
          <button key={f.id} onClick={() => onPick(f.id)} style={{ width: '170px', height: '190px', borderRadius: '30px', border: `5px solid ${f.color}`, background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 14px 26px -16px rgba(0,0,0,0.45)' }}>
            {GUEST_FN[f.id] ? <GuestPic id={f.id} size={136} /> : <span style={{ fontSize: '5.5rem', lineHeight: 1 }}>{f.icon}</span>}
            <span style={{ fontFamily: JUA, fontSize: '1.6rem', color: '#374151' }}>{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BathScene({ audio, speak, animals, friendId, onAgain, onChange }) {
  const wrapRef = useRef(null), canvasRef = useRef(null), apiRef = useRef({});
  const [tool, setTool] = useState('soap');
  const [ui, setUi] = useState({ stage: 'soap', done: false });
  const F = BATH_FRIENDS.find(f => f.id === friendId);

  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    let alive = true; const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(() => { if (alive) fn(); }, ms)); };
    const say = (t) => { try { speak(t); } catch { /* 무시 */ } };

    // ── 렌더러 · 장면 ──
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.95;   // ACES 보다 색이 덜 바램
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eaf6fb');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex; scene.environmentIntensity = 0.5;
    scene.add(new THREE.HemisphereLight('#ffffff', '#cfe6ef', 0.75));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.6); sun.position.set(-0.8, 3.2, 1.6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -2.4, right: 2.4, top: 2.0, bottom: -2.0, near: 0.5, far: 7 }); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 20);
    makeBathroom(scene); makeTub(scene);
    const water = makeWater(scene);
    const tools = makeTools(scene);

    // ── 장소 ──
    // 욕조 → (나와서) 욕실 매트 → 현관 오른쪽 방(드라이) → 거실(우유 · 양치) → 욕실 세면대(입 헹굼)
    const SIT = -0.11;   // 바닥에 앉을 때 root 높이 (몸 아래가 바닥에 닿게)
    const SPOTS = {
      tub: { p: [TUB_CX + 0.05, ROOT_Y, 0], cam: [0.05, 1.68, 1.0], look: [TUB_CX, 0.45, -0.2], head: -0.33 },
      mat: { p: [0.1, 0.015 + SIT, 0.74], cam: [0.15, 1.25, 2.05], look: [0.1, 0.4, 0.62], head: -0.12 },
      room: { p: [0.3, 0.006 + SIT, 5.92], cam: [0.5, 1.7, 7.45], look: [0.3, 0.38, 5.82], head: -0.15 },
      living: { p: [6.75, 0.008 + SIT, 5.0], cam: [6.85, 1.8, 6.85], look: [6.8, 0.38, 4.95], head: -0.15 },
      sink: { p: [1.6, 0.38 + SIT, 0.37], cam: [1.8, 1.5, 1.95], look: [1.62, 0.86, 0.2], head: -0.12 },
      floor: { cam: [0.75, 2.2, 2.55], look: [0.75, 0, 0.9] },   // 욕실 바닥 청소 (위에서 내려다봄)
      bed: { cam: [6.8, 2.0, 0.72], look: [6.8, 0.6, 2.75] }      // 안방 침대 (발치 쪽 위에서 머리맡을 봄)
    };
    const camG = { p: new THREE.Vector3(), l: new THREE.Vector3() }, camL = new THREE.Vector3(), camTmp = new THREE.Vector3();
    let camFar = 1, camSnap = true, cur = scene, house = null;
    const setSpot = (name, snap) => { const sp = SPOTS[name]; camG.p.set(...sp.cam); camG.l.set(...sp.look); if (snap) camSnap = true; };
    // 집: 처음 갈 때 만든다 (유나의 모험과 같은 집)
    const getHouse = () => {
      if (!house) {
        house = makeWorld(); house.scene.environment = envTex; house.scene.environmentIntensity = 0.3;
        house.scene.add(milks.bottle, milks.straw);
      }
      return house;
    };
    // 하얀 화면으로 살짝 덮었다가 장소를 바꾼다
    const veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;background:#ffffff;opacity:0;transition:opacity 0.42s;pointer-events:none;';
    wrap.appendChild(veil);
    let moving = false;
    const transition = (fn) => { moving = true; veil.style.opacity = '1'; later(() => { fn(); veil.style.opacity = '0'; moving = false; }, 460); };

    // ── 친구 ──
    const fr = makeFriend(friendId); fr.root.position.set(TUB_CX + 0.05, ROOT_Y, 0); scene.add(fr.root);
    const base = new THREE.Vector3(TUB_CX + 0.05, ROOT_Y, 0);   // 친구가 앉아 있는 자리
    const moveTo = (sc) => { cur = sc; [fr.root, ...Object.values(tools), drops, air, trailMesh.water, trailMesh.soap].forEach(o => sc.add(o)); };
    const place = (name) => { const sp = SPOTS[name]; base.set(...sp.p); fr.root.position.copy(base); st.headX = sp.head; st.rotY = 0; fr.root.rotation.set(0, 0, 0); };
    // 흰 샤워 타월: 몸을 누르면 한 바퀴 휘감기며 어깨에 망토처럼 걸쳐진다 (앞은 열림)
    const cape = new THREE.Group(); cape.visible = false; fr.root.add(cape);
    {
      const yu = friendId === 'yuna', rt = yu ? 0.17 : 0.14, rb = yu ? 0.3 : 0.28;
      const terry = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#dfe5ec'; c.fillRect(0, h * 0.78, w, h * 0.06); c.fillRect(0, h * 0.88, w, h * 0.04); });
      const cm = S('#ffffff', { map: terry, roughness: 1, side: THREE.DoubleSide });
      // 몸을 한 바퀴 빙 둘러 몸통이 안 보이게 (목에서 바닥까지)
      mesh(new THREE.CylinderGeometry(rt, rb, 0.4, 48, 1, true), cm, 0, 0.3, -0.01, cape);
      const collar = new THREE.TorusGeometry(rt + 0.005, 0.03, 10, 40); collar.rotateX(Math.PI / 2);
      mesh(collar, S('#ffffff', { roughness: 1 }), 0, 0.495, -0.01, cape);
      // 앞에서 겹친 수건 끝자락
      const edge = mesh(new THREE.BoxGeometry(0.014, 0.41, 0.01), S('#e3e8ee', { roughness: 1 }), 0.035, 0.3, (rt + rb) / 2 - 0.006, cape); edge.rotation.x = -Math.atan((rb - rt) / 0.4);
    }
    // 우유 묻은 입 (우유를 마시면 생기고 양치하면 없어짐)
    const milkLip = mesh(sph(1, 14, 10), S('#ffffff', { roughness: 0.4 }), fr.mouth.x, fr.mouth.y + 0.018, fr.mouth.z + 0.004, fr.head); milkLip.scale.set(0.034, 0.011, 0.012); milkLip.visible = false; milkLip.castShadow = false;
    // 컵: 투명 컵 + 안의 우유(높이 = 남은 양) / 양치 컵(하늘색). 누르기 쉽게 보이지 않는 큰 구를 단다
    // 양치 컵 (하늘색). 누르기 쉽게 보이지 않는 큰 구를 단다
    const addHit = (g, y) => { const hit = new THREE.Mesh(sph(0.11, 8, 6), new THREE.MeshBasicMaterial()); hit.position.y = y; hit.visible = false; g.add(hit); };
    const makeCup = () => {
      const g = new THREE.Group();
      mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.1, 22), S('#74c0fc', { roughness: 0.35 }), 0, 0.05, 0, g);
      mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.004, 22), S('#d0ebff', { roughness: 0.1 }), 0, 0.092, 0, g);
      mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16), S('#74c0fc', { roughness: 0.35 }), 0.046, 0.05, 0, g);
      addHit(g, 0.06);
      return g;
    };
    // 우유: 젖병 또는 빨대컵 (갈 때마다 무작위). tip = 입에 닿는 곳(로컬), tilt = 마실 때 기울기
    const makeMilk = (kind) => {
      const g = new THREE.Group();
      const clear = new THREE.MeshPhysicalMaterial({ color: '#f3faff', transparent: true, opacity: 0.38, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
      let fh, fr0, fr1;
      if (kind === 'bottle') {   // 젖병: 투명 몸통 + 눈금 + 분홍 고리 + 살색 젖꼭지
        mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.12, 24, 1, true), clear, 0, 0.06, 0, g);
        mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.005, 24), S('#f1f3f5', { roughness: 0.2 }), 0, 0.0025, 0, g);
        mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.026, 24), S('#ff8fab', { roughness: 0.35 }), 0, 0.132, 0, g);
        const nip = S('#f3d2a2', { roughness: 0.45 });
        mesh(new THREE.CylinderGeometry(0.013, 0.025, 0.022, 20), nip, 0, 0.155, 0, g);
        mesh(sph(0.012, 14, 10), nip, 0, 0.171, 0, g).scale.set(1, 1.3, 1);
        [0.035, 0.06, 0.085].forEach(y => mesh(new THREE.BoxGeometry(0.014, 0.0025, 0.002), S('#adb5bd'), 0, y, 0.0345, g));
        fh = 0.11; fr0 = 0.031; fr1 = 0.031;
        g.userData.tip = new THREE.Vector3(0, 0.183, 0); g.userData.tilt = 1.2;
      } else {   // 빨대컵: 반투명 하늘색 컵 + 노란 뚜껑 · 손잡이 둘 + 빨간 빨대
        const body = new THREE.MeshPhysicalMaterial({ color: '#a5d8ff', transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
        mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.1, 24, 1, true), body, 0, 0.05, 0, g);
        mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.005, 24), S('#74c0fc', { roughness: 0.3 }), 0, 0.0025, 0, g);
        const yel = S('#ffd43b', { roughness: 0.35 });
        mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.022, 24), yel, 0, 0.109, 0, g);
        mesh(sph(0.044, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), yel, 0, 0.119, 0, g).scale.y = 0.25;
        [-1, 1].forEach(k => { const h = mesh(new THREE.TorusGeometry(0.02, 0.007, 8, 16, Math.PI), yel, k * 0.044, 0.065, 0, g); h.rotation.z = -k * Math.PI / 2; });
        const straw = mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.075, 10), S('#ff8787', { roughness: 0.4 }), 0, 0.15, -0.006, g); straw.rotation.x = -0.25;
        fh = 0.09; fr0 = 0.037; fr1 = 0.032;
        g.userData.tip = new THREE.Vector3(0, 0.186, -0.015); g.userData.tilt = 0.12;
      }
      const fg = new THREE.CylinderGeometry(fr0, fr1, fh, 22); fg.translate(0, fh / 2, 0);
      g.userData.fill = mesh(fg, S('#ffffff', { roughness: 0.3 }), 0, 0.005, 0, g);
      addHit(g, 0.08);
      g.visible = false;
      return g;
    };
    const milks = { bottle: makeMilk('bottle'), straw: makeMilk('straw') };
    let milkCup = milks.bottle;
    const rinseCup = makeCup(); scene.add(rinseCup); rinseCup.visible = false;
    const MILK_HOME = new THREE.Vector3(6.97, 0.008, 5.22), RINSE_HOME = new THREE.Vector3(1.86, 0.8, 0.0);
    rinseCup.position.copy(RINSE_HOME);
    // 세면대 앞 아기 발판
    const stool = new THREE.Group(); scene.add(stool); stool.visible = false;
    mesh(new THREE.BoxGeometry(0.44, 0.38, 0.34), S('#ffd8a8', { roughness: 0.7 }), 1.6, 0.19, 0.37, stool).receiveShadow = true;
    mesh(new THREE.BoxGeometry(0.45, 0.02, 0.35), S('#ffa94d', { roughness: 0.7 }), 1.6, 0.385, 0.37, stool);
    const animal = animals && animals.find(a => a.id === fr.root.userData.sound);
    const st = { wet: 0, fluff: 0, shakeT: -9, shaken: false, done: false, stage: 'soap', blinkT: 2, happyT: 0, said: {}, headX: -0.33, headTilt: 0, rotY: 0, hop: null, cupA: null, milk: 1, brush: 0, gargles: 0, bed: null, sleep: false, who: 'mom' };
    // 얼룩 그림: 가장자리가 흐리고 모양이 불규칙한 자국 + 둘레에 튄 방울. 동물은 진흙·흙먼지·풀물, 유나는 진흙·초콜릿·케첩
    const STAINS = friendId === 'yuna' ? [[96, 66, 40], [62, 36, 22], [176, 52, 32], [112, 84, 54]] : [[96, 66, 40], [124, 94, 62], [74, 52, 32], [88, 96, 46]];
    const stainTex = ([R, G, B]) => canvasTex(128, 128, (c) => {
      const blob = (x, y, rad, a, k = 1) => { const g = c.createRadialGradient(x, y, 0, x, y, rad); const col = `${(R * k) | 0},${(G * k) | 0},${(B * k) | 0}`; g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.55, `rgba(${col},${a * 0.75})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill(); };
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, d = Math.random() * 20; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d * 0.8, 9 + Math.random() * 15, 0.32); }
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, d = Math.random() * 11; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 4 + Math.random() * 7, 0.4, 0.68); }   // 진한 가운데
      for (let i = 0; i < 11; i++) { const a = Math.random() * 6.28, d = 32 + Math.random() * 24, rr = 1.6 + Math.random() * 3.4; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rr * 1.7, 0.75); }   // 튄 방울
      c.strokeStyle = `rgba(${(R * 0.6) | 0},${(G * 0.6) | 0},${(B * 0.6) | 0},0.25)`; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { c.beginPath(); let x = 50 + Math.random() * 28, y = 50 + Math.random() * 28; c.moveTo(x, y); for (let j = 0; j < 3; j++) { x += (Math.random() - 0.5) * 14; y += (Math.random() - 0.5) * 14; c.lineTo(x, y); } c.stroke(); }   // 마른 결
    });
    const dirts = [], foams = [];
    const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), XA = new THREE.Vector3(1, 0, 0);
    scene.updateMatrixWorld(true);
    // 얼룩: 물 위로 보이고 카메라 쪽을 보는 몸 표면에 무작위로
    const seeRay = new THREE.Raycaster();
    // 숨겨 둔 물체(수건 망토 · 유나 잠옷 등)는 누르기 판정에서 뺀다 (부모가 숨겨져 있어도)
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    for (let tries = 0; dirts.length < (friendId === 'yuna' ? 7 : 9) && tries < 600; tries++) {
      const skinParts = friendId === 'yuna' ? fr.parts.filter(p => !p.material.userData.base) : fr.parts;
      const part = skinParts[Math.floor(Math.random() * skinParts.length)];
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() * 0.9 + 0.1).normalize();
      const local = dir.clone().multiplyScalar(part.userData.r * 0.97);
      const w = part.localToWorld(local.clone()); if (w.y < WATER_Y + 0.04) continue;
      const wn = part.localToWorld(local.clone().multiplyScalar(1.3)).sub(w).normalize(); if (wn.z < 0.15) continue;
      if (dirts.some(d => d.world.distanceTo(w) < 0.07)) continue;
      if (![1, 1.4].every(far => {   // 턱 밑처럼 위에서 안 보이는 곳이면 다시 뽑는다
        const look = new THREE.Vector3(...SPOTS.tub.look), cam = new THREE.Vector3(...SPOTS.tub.cam).sub(look).multiplyScalar(far).add(look);
        const dist = cam.distanceTo(w); seeRay.set(cam, w.clone().sub(cam).normalize());
        const hit = seeRay.intersectObject(fr.root, true).find(x => !x.object.userData.dirt && shown(x.object));
        return hit && hit.distance > dist - 0.012;
      })) continue;
      // 몸 곡면에 맞춰 휜 얇은 판에 얼룩 그림을 붙인다
      const r = 0.03 + Math.random() * 0.018, ps = part.scale, avg = (ps.x + ps.y + ps.z) / 3, Rw = part.userData.r * avg;
      const geo = new THREE.PlaneGeometry(r * 2, r * 2, 6, 6), gp = geo.attributes.position;
      for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i); gp.setZ(i, Math.sqrt(Math.max(0, Rw * Rw - x * x - y * y)) - Rw + 0.003); }
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: stainTex(STAINS[dirts.length % STAINS.length]), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.position.copy(dir).multiplyScalar(part.userData.r); m.quaternion.setFromUnitVectors(Z, dir); m.rotateZ(Math.random() * 6.28);
      m.scale.setScalar(1 / avg); m.renderOrder = 1; m.castShadow = false;
      m.userData.dirt = true; part.add(m);
      dirts.push({ m, part, world: w, soap: 0, hp: 1, gone: false, s0: m.scale.clone() });
    }
    const foamGeo = sph(1, 12, 9), foamMat = S('#ffffff', { roughness: 0.35, transparent: true, opacity: 0.95 });
    const addFoam = (obj, worldP, small) => {
      if (foams.length > 260) { const old = foams.shift(); old.m.parent.remove(old.m); }
      const m = new THREE.Mesh(foamGeo, foamMat); const local = obj.worldToLocal(worldP.clone());
      const r = small ? 0.006 + Math.random() * 0.006 : 0.016 + Math.random() * 0.016, ws = new THREE.Vector3(); obj.getWorldScale(ws);
      m.position.copy(local); m.scale.set(r / ws.x, r / ws.y, r / ws.z); m.userData.r = r; m.userData.grow = 0;
      obj.add(m); foams.push({ m, obj, die: 0, mouth: !!small });
    };

    // ── 장난감 ──
    const toys = BATH_TOYS.map((t, i) => {
      const { g, inner } = makeToy(t); scene.add(g);
      const home = new THREE.Vector3(-0.5 + i * 0.2, SHELF_Y, SHELF_Z);
      return { t, g, inner, home, x: home.x, z: home.z, y: home.y, vx: 0, vz: 0, yaw: 0, hop: 0, spin: 0, inWater: false, held: false };
    });
    const toyById = Object.fromEntries(toys.map(o => [o.t.id, o]));

    // ── 비눗방울 · 물방울 ──
    const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, roughness: 0, metalness: 0, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [120, 900], depthWrite: false, envMapIntensity: 2.2 });
    const bubbles = [];
    const addBubble = (x, y, z, r) => {
      if (bubbles.length > 22) return;
      const m = new THREE.Mesh(sph(1, 24, 16), bubbleMat); m.position.set(x, y, z); m.scale.setScalar(0.001); m.renderOrder = 3; m.userData.bubble = true; scene.add(m);
      bubbles.push({ m, r: r || 0.03 + Math.random() * 0.035, vy: 0.05 + Math.random() * 0.05, ph: Math.random() * 6, age: 0, life: 7 + Math.random() * 5 });
    };
    const DROPS = 500, drops = new THREE.InstancedMesh(sph(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.85, roughness: 0.05 }), DROPS);
    drops.frustumCulled = false; drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(drops);
    const dp = []; const dm = new THREE.Matrix4(), dsc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const addDrop = (x, y, z, vx, vy, vz, r = 0.007) => { if (dp.length < DROPS) dp.push({ x, y, z, vx, vy, vz, r, life: 2 }); };
    const AIR = 120, air = new THREE.InstancedMesh(sph(1, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffe8cc', transparent: true, opacity: 0.35, depthWrite: false }), AIR);
    air.frustumCulled = false; scene.add(air); const ap = [];
    const ripples = [];
    const addRipple = (x, z, amp = 0.006) => { if (ripples.length > 7) ripples.shift(); ripples.push({ x, z, t: 0, amp }); };

    // ── 바닥 물웅덩이 (청소 단계) · 배수구 ──
    // 웅덩이 = 가장자리가 울퉁불퉁한 납작한 원판. 가운데는 맑고 테두리는 물이 볼록해 하얗게 빛난다
    const DRAIN = new THREE.Vector3(1.05, 0, 1.25);
    {
      const drain = new THREE.Group(); drain.position.copy(DRAIN); scene.add(drain);
      const dm0 = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 28), S('#ced4da', { metalness: 0.85, roughness: 0.25 }), 0, 0.002, 0, drain); dm0.castShadow = false; dm0.receiveShadow = true;
      for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(0.1 - Math.abs(i) * 0.02, 0.002, 0.009), S('#495057'), 0, 0.0045, i * 0.022, drain).castShadow = false;
    }
    const puddleTex = canvasTex(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(176,218,242,0.42)'); g.addColorStop(0.72, 'rgba(160,208,238,0.55)'); g.addColorStop(0.9, 'rgba(236,248,255,0.95)'); g.addColorStop(1, 'rgba(236,248,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    const puddleMat = new THREE.MeshPhysicalMaterial({ map: puddleTex, transparent: true, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const puddles = [];
    const spawnPuddles = () => {
      for (let tries = 0; puddles.length < 10 && tries < 500; tries++) {
        const big = puddles.length < 6, r = big ? 0.09 + Math.random() * 0.07 : 0.028 + Math.random() * 0.025;
        const x = -0.6 + Math.random() * 2.6, z = 0.5 + Math.random() * 0.95;
        if (x > -0.47 - r && x < 0.67 + r && z < 1.0 + r) continue;   // 욕실 매트 위는 빼고
        if (Math.hypot(x - DRAIN.x, z - DRAIN.z) < 0.2 + r || puddles.some(q => Math.hypot(q.x - x, q.z - z) < q.r + r + 0.08)) continue;
        const geo = new THREE.CircleGeometry(1, 48), gp = geo.attributes.position, ph = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
        for (let i = 1; i < gp.count; i++) { const x0 = gp.getX(i), y0 = gp.getY(i), a = Math.atan2(y0, x0), k = 1 + 0.2 * Math.sin(2 * a + ph[0]) + 0.12 * Math.sin(3 * a + ph[1]) + 0.06 * Math.sin(5 * a + ph[2]); gp.setXY(i, x0 * k, y0 * k * 0.8); }
        const m = new THREE.Mesh(geo, puddleMat.clone()); m.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28); m.renderOrder = 1; m.receiveShadow = true;
        m.position.set(x, 0.003, z); m.scale.set(r, r, 1); scene.add(m);
        puddles.push({ m, x, z, r, hp: 1, small: !big, gone: false });
      }
    };

    // ── 몸을 타고 흘러내리는 물줄기 (물 / 비눗물) ──
    // 물줄기 머리는 몸 부분(구)의 표면 방향 dir 을 중력 쪽으로 미끄러지며, 지나간 자리에 젖은 자국(trail)을 남긴다.
    // 부분 아래쪽 끝에 닿으면 떨어져 아래 몸에 다시 붙거나, 물에 퐁 떨어진다.
    const STREAMS = 46, streams = [];
    const TRAIL = { water: 1800, soap: 900 };
    const streamMat = {
      water: new THREE.MeshPhysicalMaterial({ color: '#6cc4ff', transparent: true, opacity: 0.62, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.8, depthWrite: false }),
      soap: new THREE.MeshStandardMaterial({ color: '#f4fbff', transparent: true, opacity: 0.68, roughness: 0.25, metalness: 0, depthWrite: false })
    };
    const trailMesh = {}, trails = { water: [], soap: [] };
    ['water', 'soap'].forEach(kind => {
      const m = new THREE.InstancedMesh(sph(1, 8, 6), streamMat[kind], TRAIL[kind] + STREAMS);
      m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.renderOrder = 2; scene.add(m); trailMesh[kind] = m;
    });
    const partOf = (o) => { while (o && !fr.parts.includes(o)) o = o.parent; return o; };
    const sV = new THREE.Vector3(), sW = new THREE.Vector3(), sD = new THREE.Vector3(), downRay = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
    const addStream = (part, worldP, soap) => {
      if (!part || streams.length >= STREAMS) return;
      const dir = part.worldToLocal(worldP.clone()).normalize();
      streams.push({ part, dir, soap, sp: 0.07 + Math.random() * 0.05, wob: Math.random() * 6, r: soap ? 0.0065 + Math.random() * 0.003 : 0.0055 + Math.random() * 0.0025, tt: 0, fall: null, life: 6 });
    };
    // 부분 위의 점(dir) → 세상 좌표
    const streamWorld = (s, out) => out.copy(s.dir).multiplyScalar(s.part.userData.r * 1.02).applyMatrix4(s.part.matrixWorld);
    const updateStreams = (dt) => {
      for (let i = streams.length - 1; i >= 0; i--) {
        const s = streams[i]; s.life -= dt;
        if (s.fall) {   // 아래 몸으로 떨어지는 중
          s.fall.vy -= 4 * dt; s.fall.p.y += s.fall.vy * dt;
          if (s.fall.p.y <= s.fall.y) { s.part = s.fall.part; s.dir = s.part.worldToLocal(s.fall.p.clone()).normalize(); s.fall = null; }
          else if (s.life <= 0) { streams.splice(i, 1); }
          continue;
        }
        const w0 = streamWorld(s, sW);
        // 중력 방향을 부분의 로컬 좌표로 (찌그러진 구도 대충 맞게)
        const a = s.part.worldToLocal(w0.clone()), b = s.part.worldToLocal(w0.clone().add(DOWN)); sD.copy(b).sub(a).normalize();
        const along = s.dir.dot(sD); sV.copy(sD).addScaledVector(s.dir, -along);
        const tl = sV.length();
        if (along > 0.86 || tl < 0.05 || s.life <= 0 || w0.y < WATER_Y) {   // 아래쪽 끝 · 물 · 수명 끝
          streams.splice(i, 1);
          if (w0.y < WATER_Y + 0.01) { if (Math.random() < 0.3) addRipple(w0.x, w0.z, 0.002); continue; }
          if (s.life > 0) {
            downRay.set(w0.clone().addScaledVector(DOWN, 0.005), DOWN); downRay.far = 0.35;
            const h = downRay.intersectObjects(fr.parts, false).find(x => x.object !== s.part);
            if (h && h.point.y > WATER_Y) { s.fall = { p: w0.clone(), vy: 0, y: h.point.y, part: h.object }; streams.push(s); continue; }
          }
          addDrop(w0.x, w0.y, w0.z, 0, -0.2, 0.03, s.r * 0.9);
          continue;
        }
        // 살짝 구불구불하게, 아래로 갈수록 빨라짐
        sV.multiplyScalar(1 / tl); sW.crossVectors(s.dir, sV).multiplyScalar(Math.sin(s.wob + s.life * 3) * 0.12); sV.add(sW).normalize();
        const step = s.sp * (0.6 + Math.max(0, along) * 1.2) * dt / s.part.userData.r;
        s.dir.addScaledVector(sV, step).normalize();
        s.tt -= dt;
        if (s.tt <= 0) {
          s.tt = 0.012;
          const tr = trails[s.soap ? 'soap' : 'water'];
          if (tr.length >= TRAIL[s.soap ? 'soap' : 'water']) tr.shift();
          tr.push({ part: s.part, p: s.dir.clone().multiplyScalar(s.part.userData.r * 1.012), r: s.r, life: s.soap ? 1.3 : 1.3, max: s.soap ? 1.3 : 1.3 });
        }
      }
      // 몸 표면에 납작하게 붙은 같은 굵기의 물길 (끝만 가늘어지며 사라짐)
      const centers = new Map();
      const centerOf = (part) => { let c = centers.get(part); if (!c) { c = part.getWorldPosition(new THREE.Vector3()); centers.set(part, c); } return c; };
      const film = (m, n, part, w, r, flat) => {
        tmpN.copy(w).sub(centerOf(part)).normalize(); tmpQ.setFromUnitVectors(Z, tmpN);
        dm.compose(w, tmpQ, dsc.set(r, r, r * flat)); m.setMatrixAt(n, dm);
      };
      ['water', 'soap'].forEach(kind => {
        const tr = trails[kind], m = trailMesh[kind]; let n = 0;
        for (let i = tr.length - 1; i >= 0; i--) { tr[i].life -= dt; if (tr[i].life <= 0) tr.splice(i, 1); }
        tr.forEach(p => {
          const k = Math.min(1, p.life / p.max / 0.35); sW.copy(p.p).applyMatrix4(p.part.matrixWorld);
          film(m, n++, p.part, sW, p.r * (0.3 + 0.7 * k), 0.3);
        });
        streams.forEach(s => {
          if (s.soap !== (kind === 'soap')) return;
          if (s.fall) { dm.makeScale(s.r * 0.8, s.r * 1.6, s.r * 0.8).setPosition(s.fall.p); m.setMatrixAt(n++, dm); }
          else { streamWorld(s, sW); film(m, n++, s.part, sW, s.r * 1.1, 0.45); }
        });
        m.count = n; m.instanceMatrix.needsUpdate = true;
      });
    };

    // ── 화면 위 이모지 ──
    const pop = (emoji, x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(camera), el = document.createElement('span');
      el.textContent = emoji; el.style.cssText = `position:absolute;left:${(v.x + 1) / 2 * 100}%;top:${(1 - v.y) / 2 * 100}%;font-size:2rem;pointer-events:none;animation:bathPop 1.2s ease-out forwards;margin:-1rem 0 0 -1rem;`;
      wrap.appendChild(el); later(() => el.remove(), 1250);
    };

    // ── 소리 ──
    const sfx = {
      squeak: () => { audio.playFreq(1300, 'triangle', 0.07, 0.35); setTimeout(() => audio.playFreq(1650, 'triangle', 0.09, 0.3), 70); },
      splash: (v = 0.25) => audio.playNoise(0.22, v, 900, 0.6),
      pop: () => audio.playFreq(1500 + Math.random() * 400, 'sine', 0.05, 0.3),
      scrub: () => audio.playNoise(0.07, 0.12, 2600 + Math.random() * 800, 1.4),
      shower: () => audio.playNoise(0.3, 0.13, 3200, 0.5),
      towel: () => audio.playNoise(0.09, 0.1, 1400, 0.8)
    };
    const sharkTune = (pitch) => {
      const D4 = 293.66, E4 = 329.63, G4 = 392, A = [[0, D4, 0.2], [0.25, E4, 0.2], [0.5, G4, 0.28], [0.83, G4, 0.12], [1.01, G4, 0.12], [1.19, G4, 0.1], [1.31, G4, 0.12], [1.49, G4, 0.1], [1.61, G4, 0.2]];
      A.forEach(([t, f, d]) => audio.later(() => audio.playFreq(f * pitch, 'triangle', d, pitch < 1 ? 0.45 : 0.32), t * 1000));
    };
    const friendSound = () => { if (animal && audio.playItemSound) audio.playItemSound(animal); else audio.playYum(); };

    // ── 단계 ──
    const setStage = (s, line) => {
      if (st.stage === s) return; st.stage = s; setUi(u => ({ ...u, stage: s }));
      if (s === 'shower') say(VOICE.bathRinse());
      if (line) say(line);
    };
    const cheer = (n = 6) => { const hp = fr.head.getWorldPosition(new THREE.Vector3()); for (let i = 0; i < n; i++) later(() => pop(['✨', '💗', '⭐', '🫧'][i % 4], hp.x + (Math.random() - 0.5) * 0.4, hp.y + 0.1 + Math.random() * 0.2, hp.z), 100 + i * 130); };
    // 다 헹구고 털고 나면: 욕조에서 폴짝 나와 매트로
    const getOut = () => {
      setStage('out', VOICE.bathOut()); setSpot('mat');
      st.hop = { t: 0, from: fr.root.position.clone(), to: new THREE.Vector3(...SPOTS.mat.p) };
      sfx.splash(0.35); addRipple(fr.root.position.x, 0.05, 0.016);
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28; addDrop(fr.root.position.x + Math.cos(a) * 0.15, WATER_Y + 0.02, Math.sin(a) * 0.15, Math.cos(a) * 0.6, 0.8 + Math.random() * 0.7, Math.sin(a) * 0.6 + 0.3, 0.008); }
      if (fr.wrap) later(() => { fr.wrap.visible = true; }, 550);   // 유나는 나오면서 수건 가운을 입는다
    };
    // 다 닦으면: 현관 오른쪽 방으로 가서 드라이어
    const goRoom = () => {
      setStage('dryer', VOICE.bathToRoom());
      transition(() => { const h = getHouse(); moveTo(h.scene); place('room'); setSpot('room', true); if (fr.robe) { fr.robe.material = fr.pj; fr.robeG.visible = true; } cape.visible = false; fr.root.children.forEach(c => { if (c.userData.wasVis !== undefined) { c.visible = c.userData.wasVis; delete c.userData.wasVis; } }); });
    };
    const go = (what) => {
      if (moving) return;
      if (what === 'bedGo' && st.stage === 'bedGo') { goBed(Math.random() < 0.5 ? 'mom' : 'dad'); return; }
      if (what === 'towelGo' && st.stage === 'towelGo') { getOut(); }
      else if (what === 'cleanGo' && st.stage === 'cleanGo') {
        setStage('clean', VOICE.bathClean()); setSpot('floor');
        st.mopYaw = 0; st.mopP = null; tools.mop.position.set(1.75, 0, 1.3); tools.mop.userData.head.rotation.y = 0; tools.mop.visible = true;
      }
      else if (what === 'milkGo' && st.stage === 'milkGo') {
        setStage('milk', VOICE.bathMilk());
        transition(() => {
          place('living'); setSpot('living', true);
          milkCup = Math.random() < 0.5 ? milks.bottle : milks.straw;   // 젖병 또는 빨대컵
          Object.values(milks).forEach(m => { m.visible = m === milkCup; });
          milkCup.position.copy(MILK_HOME); milkCup.rotation.set(0, 0, 0); milkCup.userData.fill.visible = true; milkCup.userData.fill.scale.y = 1; st.milk = 1;
        });
      } else if (what === 'brushGo' && st.stage === 'brushGo') {
        st.brush = 0; setStage('brush', VOICE.bathBrush());
      } else if (what === 'rinseGo' && st.stage === 'rinseGo') {
        setStage('rinse', VOICE.bathGargle());
        transition(() => { moveTo(scene); place('sink'); setSpot('sink', true); stool.visible = true; rinseCup.visible = true; rinseCup.position.copy(RINSE_HOME); });
      }
    };
    apiRef.current.go = go;

    // ── 안방: 엄마·아빠랑 침대에 올라가 눕고 → 이불 덮고 → 불 끄면 토닥토닥 코~ ──
    // 침대(makeWorld): x 5.85~7.75, z 1.3(발치)~3.3(머리판), 매트 위 0.43, 베개 z 2.75~3.1
    const BED = {
      fFrom: new THREE.Vector3(5.3, SIT, 2.4), fSit: new THREE.Vector3(6.4, 0.43 + SIT, 2.42), lift: 0.11, lean: 1.1,
      pFrom: new THREE.Vector3(8.3, 0, 1.85), pSide: new THREE.Vector3(8.02, 0, 2.05), pLie: new THREE.Vector3(7.15, 0.6, 1.45),
      X0: 5.62, X1: 7.98, Z0: 1.32, Z1: 2.64, NX: 48, NZ: 28
    };
    const qStand = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
    const qLie = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 1).normalize(), Math.PI);   // 등을 대고 누움, 머리는 베개(+z) 쪽
    let parent = null, blanket = null, lamp = null;
    const nightDiv = document.createElement('div');
    nightDiv.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 30%, rgba(40,50,120,0.25), rgba(8,12,45,0.6));';
    nightDiv.innerHTML = [['12%', '10%', '🌙', 2.6, 0], ['30%', '6%', '⭐', 1.4, 0.4], ['68%', '9%', '✨', 1.3, 1.1], ['84%', '16%', '⭐', 1.6, 0.7], ['50%', '4%', '✨', 1.1, 1.6], ['92%', '5%', '⭐', 1.1, 0.2]]
      .map(([l, tp, e, f, d]) => `<span style="position:absolute;left:${l};top:${tp};font-size:${f}rem;animation:bathTwinkle 2.4s ${d}s infinite">${e}</span>`).join('');
    cv.after(nightDiv);
    // 이불: 누운 몸 위를 레이로 재서 높이를 미리 만들어 두고, p(0~1)만큼 펼친다 (덜 펼친 부분은 발치에 접혀 쌓임)
    const makeBlanket = (hs) => {
      const { NX, NZ, X0, X1, Z0, Z1 } = BED;
      const ray2 = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3();
      const H = [], col = [];
      for (let i = 0; i <= NX; i++) {
        const x = X0 + (X1 - X0) * i / NX, inX = Math.max(5.84, Math.min(7.76, x));
        col.push({ x: x < 5.84 ? 5.82 - (5.84 - x) * 0.12 : x > 7.76 ? 7.78 + (x - 7.76) * 0.12 : x, ie: Math.round((inX - X0) / (X1 - X0) * NX), drop: Math.abs(x - inX) * 1.6 });
        H.push([]);
        for (let j = 0; j <= NZ; j++) {
          o.set(x, 2, Z0 + (Z1 - Z0) * j / NZ); ray2.set(o, down);
          const h = ray2.intersectObjects(hs, true).find(q => shown(q.object));
          H[i].push(Math.max(0.45, h ? h.point.y + 0.03 : 0));
        }
      }
      // 몸 위로 부드럽게: 한 번 넓히고(최댓값) 두 번 흐리기
      const pass = (fn) => {
        const C = H.map(r => r.slice());
        for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
          const a = [];
          for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) { const r = C[i + di]; if (r && r[j + dj] != null) a.push(r[j + dj]); }
          H[i][j] = fn(a, C[i][j]);
        }
      };
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      pass((a) => Math.max(...a)); pass((a) => avg(a)); pass((a, c) => Math.max(0.45, (avg(a) + c) / 2));
      const n = (NX + 1) * (NZ + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
      for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
        const v = i * (NZ + 1) + j; uv[v * 2] = i / NX * 2; uv[v * 2 + 1] = j / NZ * 1.2;
        if (i < NX && j < NZ) idx.push(v, v + 1, v + NZ + 1, v + 1, v + NZ + 2, v + NZ + 1);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      const tex = canvasTex(256, 256, (c, w) => {
        c.fillStyle = '#fff3bf'; c.fillRect(0, 0, w, 256);
        c.fillStyle = '#ffe8a3'; for (let k = 0; k < 8; k++) c.fillRect(0, k * 32, w, 14);
        c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        [[40, 40, '⭐'], [150, 70, '🌙'], [220, 180, '⭐'], [90, 160, '⭐'], [190, 240, '✨'], [30, 230, '🌙']].forEach(([x, y, e]) => c.fillText(e, x, y));
      });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const m = new THREE.Mesh(geo, S('#ffffff', { map: tex, roughness: 0.95, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true;
      const set = (p) => {
        const jc = Math.max(0.5, p * NZ);
        for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
          // 펼친 곳까지는 제자리, 그 뒤는 지그재그로 접혀 쌓인다
          const k = Math.floor(j / jc), r = j - k * jc, mj = k % 2 ? jc - r : r, j0 = Math.floor(mj), j1 = Math.min(NZ, j0 + 1), f = mj - j0, C = col[i];
          const v = (i * (NZ + 1) + j) * 3;
          pos[v] = C.x; pos[v + 1] = H[C.ie][j0] * (1 - f) + H[C.ie][j1] * f - C.drop + k * 0.03; pos[v + 2] = Z0 + (Z1 - Z0) * mj / NZ;
        }
        geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
      };
      return { m, set };
    };
    // 머리판 위 수면등: 누르면 딸깍 꺼진다
    const makeLamp = (sc) => {
      const g = new THREE.Group(); g.position.set(6.08, 0.95, 3.34); sc.add(g);
      mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.04, 20), S('#c9ada7'), 0, 0.02, 0, g);
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), S('#e9ecef'), 0, 0.09, 0, g);
      const bulbM = new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffd27a', emissiveIntensity: 1.6, roughness: 0.4 });
      const bulb = mesh(sph(0.075, 20, 14), bulbM, 0, 0.18, 0, g); bulb.scale.set(1, 0.85, 1);
      const shade = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.09, 24, 1, true), S('#ffc9de', { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, 0.21, 0, g);
      shade.castShadow = false;
      const light = new THREE.PointLight('#ffcf8a', 2.2, 3.2, 1.6); light.position.set(0, 0.2, -0.1); g.add(light);
      const hit = new THREE.Mesh(sph(0.26, 8, 6), new THREE.MeshBasicMaterial()); hit.position.y = 0.15; hit.visible = false; g.add(hit);
      return { g, bulbM, light, hit, on: true };
    };
    const goBed = (who) => {
      st.who = who; setStage('bedIn', VOICE.bathBedIn(who));
      transition(() => {
        const h = getHouse(); moveTo(h.scene); stool.visible = false; rinseCup.visible = false; Object.values(tools).forEach(o => { o.visible = false; });
        if (!lamp) lamp = makeLamp(h.scene);
        parent = makeParent(who); parent.root.scale.setScalar(0.92); h.scene.add(parent.root);
        // 다 누운 모습으로 잠깐 두고 이불 모양을 잰 뒤, 처음 자리로
        fr.root.position.copy(BED.fSit); fr.root.position.y += BED.lift; fr.root.rotation.set(BED.lean, Math.PI, 0);
        parent.root.position.copy(BED.pLie); parent.root.quaternion.copy(qLie);
        fr.root.updateMatrixWorld(true); parent.root.updateMatrixWorld(true);
        blanket = makeBlanket([fr.root, parent.root]); blanket.set(0.22); h.scene.add(blanket.m);
        parent.root.position.copy(BED.pFrom); parent.root.quaternion.copy(qStand);
        base.copy(BED.fFrom); fr.root.position.copy(base); fr.root.rotation.set(0, Math.PI, 0); st.rotY = Math.PI; st.headX = -0.2;
        st.bed = { t: 0, cover: null, night: null, zz: 0.6 };
        setSpot('bed', true);
      });
    };
    const lullaby = () => {   // 브람스 자장가 (실로폰, 작게)
      const N = { D: 293.66, E: 329.63, F: 349.23, G: 392, A: 440, B: 493.88, C5: 523.25 };
      const M = [['E', 1], ['E', 1], ['G', 2.5], ['E', 1], ['E', 1], ['G', 2.5], ['E', 1], ['G', 1], ['C5', 1.5], ['B', 1.5], ['A', 1], ['A', 1], ['G', 2.5],
        ['D', 1], ['E', 1], ['F', 1.5], ['D', 1.5], ['D', 1], ['E', 1], ['F', 2.5], ['D', 1], ['F', 1], ['B', 1], ['A', 1], ['G', 1.5], ['B', 1.5], ['C5', 3]];
      let at = 1400; M.forEach(([nt, d]) => { audio.later(() => audio.playXylophone(N[nt], 0.32), at); at += d * 330; });
    };
    const bedTick = (dt) => {
      const B = st.bed, P = parent; B.t += dt;
      const cl = (u) => Math.max(0, Math.min(1, u)), ez = (u) => u * u * (3 - 2 * u);
      // 친구: 바닥에서 폴짝 침대 위로 → 베개에 기대 눕기
      const hu = cl((B.t - 0.3) / 1.0), lu = ez(cl((B.t - 1.5) / 0.8));
      base.lerpVectors(BED.fFrom, BED.fSit, ez(hu)); base.y += Math.sin(hu * Math.PI) * 0.45 + lu * BED.lift;
      if (hu >= 1 && !B.landed) { B.landed = true; audio.playPopSound(); audio.playNoise(0.15, 0.12, 700, 0.7); }
      fr.root.position.copy(base); fr.root.rotation.x = lu * BED.lean;
      // 엄마·아빠: 침대 옆까지 걸어와서 올라가 눕는다
      if (B.t < 0.8) { P.root.position.lerpVectors(BED.pFrom, BED.pSide, ez(B.t / 0.8)); P.legs.forEach((l, k) => { l.rotation.x = Math.sin(B.t * 11) * 0.45 * (k ? 1 : -1); }); }
      else {
        const cu = ez(cl((B.t - 0.8) / 1.3));
        P.root.position.lerpVectors(BED.pSide, BED.pLie, cu); P.root.position.y += Math.sin(cu * Math.PI) * 0.3; P.root.quaternion.slerpQuaternions(qStand, qLie, cu);
        P.legs.forEach(l => { l.rotation.x *= Math.max(0, 1 - dt * 8); });
      }
      if (B.t > 2.5 && st.stage === 'bedIn') setStage('blanket', VOICE.bathBlanket());
      // 이불 펼치기
      if (B.cover != null && B.cover < 1) {
        B.cover = Math.min(1, B.cover + dt / 1.3); blanket.set(0.22 + 0.78 * ez(B.cover));
        if (B.cover >= 1) { st.happyT = 1.5; audio.playYum(); later(() => setStage('light', VOICE.bathLight()), 700); }
      }
      // 전등: 끄라고 할 때 살짝 반짝, 끄면 방이 어두워진다
      if (lamp) lamp.g.scale.setScalar(st.stage === 'light' ? 1 + Math.abs(Math.sin(t * 4)) * 0.18 : 1);
      if (B.night != null) { B.night = Math.min(1, B.night + dt / 1.6); renderer.toneMappingExposure = 0.95 - 0.55 * B.night; nightDiv.style.opacity = String(B.night); }
      if (st.sleep) {
        fr.eyes.forEach(e => { e.scale.y = 0.1; }); fr.head.rotation.z = Math.sin(t * 1.1) * 0.025;
        fr.root.scale.setScalar(1 + Math.sin(t * 1.6) * 0.012);   // 새근새근
        const a = P.arms[1]; a.rotation.z += (1.25 - a.rotation.z) * Math.min(1, dt * 3); a.rotation.y = -0.12 - Math.abs(Math.sin(t * 3.2)) * 0.3;   // 토닥토닥
        P.head.rotation.y += (0.55 - P.head.rotation.y) * Math.min(1, dt * 2);
        B.zz -= dt; if (B.zz < 0) { B.zz = 2.2; const hp2 = fr.head.getWorldPosition(new THREE.Vector3()); pop('💤', hp2.x - 0.1, hp2.y + 0.2, hp2.z); }
      }
    };
    const tapBed = () => {
      const B = st.bed; if (!B || moving) return false;
      if (st.stage === 'blanket' && B.cover == null) { B.cover = 0; audio.playNoise(0.7, 0.16, 900, 0.5); return true; }
      if (st.stage === 'light' && lamp.on && ray.intersectObject(lamp.hit, false).length) {
        lamp.on = false; lamp.bulbM.emissiveIntensity = 0; lamp.bulbM.color.set('#d9cfa8'); lamp.light.intensity = 0;
        audio.playFreq(1900, 'square', 0.025, 0.18); B.night = 0;
        later(() => { st.sleep = true; finish(); }, 900);
        return true;
      }
      return st.stage === 'end' || st.stage === 'light' || st.stage === 'bedIn';   // 자는 중에는 친구를 눌러도 깨우지 않는다
    };
    const finish = () => {
      if (st.done) return; st.done = true; st.happyT = 3; setStage('end'); setUi({ stage: 'end', done: true });
      if (st.bed) { say(VOICE.bathNight(st.who)); lullaby(); return; }
      audio.playFanfare(); say(VOICE.bathReady()); cheer(10);
    };
    // 컵 누르기: 우유는 꿀꺽 (4번이면 다 마심), 양치 컵은 머금고 → 가글가글 → 세면대 쪽으로 퉤 (2번)
    const tapCup = (kind) => {
      if (st.cupA || moving) return;
      st.cupA = { kind, t: 0, cup: kind === 'milk' ? milkCup : rinseCup, home: (kind === 'milk' ? MILK_HOME : RINSE_HOME).clone(), snd: 0 };
      audio.playPopSound();
    };
    const doShake = () => {
      st.shakeT = 0; st.shaken = true;
      if (friendId === 'yuna') { say(VOICE.bathYunaSplash()); for (let i = 0; i < 4; i++) later(() => { sfx.splash(0.3); addRipple(fr.root.position.x + (Math.random() - 0.5) * 0.3, 0.12, 0.012); }, i * 220); }
      else { say(VOICE.bathShake()); friendSound(); for (let i = 0; i < 6; i++) later(() => sfx.splash(0.12), i * 150); }
    };
    later(() => say(VOICE.bathHello(F.name)), 400);

    // ── 누르기 ──
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y), holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WATER_Y + 0.12)), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ptr = { down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, drag: null, hit: null, lastP: new THREE.Vector3(), t0: 0 };
    const pick = (e) => {
      const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
      ray.setFromCamera(ndc, camera);
    };
    const hitFriend = () => { const hs = ray.intersectObject(fr.root, true).filter(h => shown(h.object) && h.object.material !== foamMat && !h.object.userData.dirt); return hs[0] || null; };
    const onDown = (e) => {
      if (ptr.down) return;
      audio.init && audio.init();
      pick(e); ptr.down = true; ptr.id = e.pointerId; ptr.sx = e.clientX; ptr.sy = e.clientY; ptr.moved = 0; ptr.t0 = performance.now();
      try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      // 비눗방울 → 장난감 → 도구 순서
      const bh = ray.intersectObjects(bubbles.map(b => b.m), false)[0];
      if (bh) { const b = bubbles.find(o => o.m === bh.object); if (b) popBubble(b); }   // 터뜨리고 하던 일(샤워 등)은 계속
      const th = cur === scene ? ray.intersectObjects(toys.map(o => o.g), true)[0] : null;
      if (th) { ptr.drag = toyById[th.object.userData.toy]; return; }
      ptr.drag = null;
      if (st.stage === 'milk' && ray.intersectObject(milkCup, true).length) { tapCup('milk'); return; }
      if (st.stage === 'rinse' && ray.intersectObject(rinseCup, true).length) { tapCup('rinse'); return; }
      if (st.bed && tapBed()) return;
      if (!STAGE_TOOLS[st.stage] && hitFriend()) { st.happyT = 1.2; friendSound(); return; }   // 도구가 없을 때 친구를 누르면 반가워함
      act(0, true);
    };
    const onMove = (e) => {
      if (!ptr.down || e.pointerId !== ptr.id) return;
      ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy)); pick(e);
      // 장난감 끌기: 손가락 아래 물 높이 지점을 따라 물 위로 살짝 든 채 움직인다
      if (!ptr.drag && !moving && (tool_.current === 'soap' || tool_.current === 'brush' || tool_.current === 'mop')) act(0, false);   // 느린 기기에서도 문지른 길을 빠짐없이
      if (ptr.drag && ptr.moved >= 12) { const h = new THREE.Vector3(); if (ray.ray.intersectPlane(holdPlane, h)) { const o = ptr.drag; o.held = true; const nx = Math.max(-0.82, Math.min(0.82, h.x)), nz = Math.max(-0.36, Math.min(0.6, h.z)); o.vx = (nx - o.x) * 8; o.vz = (nz - o.z) * 8; o.x = nx; o.z = nz; } }
    };
    const onUp = (e) => {
      if (!ptr.down || e.pointerId !== ptr.id) return;
      ptr.down = false;
      if (ptr.drag) {
        const o = ptr.drag; o.held = false;
        if (ptr.moved < 12) tapToy(o);
        else if (insideTub(o.x, o.z, 0.9)) {   // 욕조 안에 놓음: 퐁당
          for (let k = 0; k < 20 && !insideTub(o.x, o.z, 0.82); k++) { o.x = TUB_CX + (o.x - TUB_CX) * 0.95; o.z *= 0.95; }
          const first = !o.inWater; o.inWater = true; o.vx *= 0.3; o.vz *= 0.3;
          sfx.splash(0.3); addRipple(o.x, o.z, 0.014);
          for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28; addDrop(o.x, WATER_Y + 0.02, o.z, Math.cos(a) * 0.5, 0.7 + Math.random() * 0.6, Math.sin(a) * 0.5, 0.007); }
          if (first) say(VOICE.bathToy(o.t.id));
        } else { o.inWater = false; o.vx = 0; o.vz = 0; audio.playPopSound(); }   // 밖에 놓으면 선반으로
        ptr.drag = null;
      }
      Object.values(tools).forEach(t => { t.visible = false; });
      if (st.stage === 'clean') tools.mop.visible = true;   // 밀대는 바닥에 세워 둔다
      if (ptr.nextTool) { tool_.current = ptr.nextTool; ptr.nextTool = null; }
    };
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('lostpointercapture', onUp); window.addEventListener('pointerup', onUp);

    const popBubble = (b, quiet) => {
      const p = b.m.position;
      if (!quiet) sfx.pop();
      for (let i = 0; i < (quiet ? 0 : 10); i++) { const a = Math.random() * 6.28; addDrop(p.x, p.y, p.z, Math.cos(a) * 0.5, Math.random() * 0.5, Math.sin(a) * 0.5, 0.004); }
      scene.remove(b.m); bubbles.splice(bubbles.indexOf(b), 1);
    };
    const tapToy = (o) => {
      o.hop = 1; o.spin = 1;
      if (o.t.kind === 'shark') { sharkTune(o.t.pitch); for (let i = 0; i < 6; i++) later(() => pop(i % 2 ? '🎵' : '🎶', o.x, WATER_Y + 0.18, o.z), i * 300); }
      else if (o.t.kind === 'chick') sfx.squeak(); else { audio.playFreq(220, 'sine', 0.25, 0.4); setTimeout(() => audio.playFreq(330, 'sine', 0.2, 0.3), 150); }
      say(VOICE.bathToy(o.t.id)); addRipple(o.x, o.z, 0.01); sfx.splash(0.1);
    };

    // 도구 사용 (누르고 있는 동안 매 프레임)
    let sndT = 0, dryerOn = 0, dryerLoad = false, dryerSnd = null, dryerChunkT = 0;
    // 밀대: 손가락 아래 바닥으로 따라오고, 판은 미는 방향에 맞춰 돈다. 판에 걸린 웅덩이는 밀리면서 줄어든다
    const clothDry = new THREE.Color('#f8f9fa'), clothWet = new THREE.Color('#9fc3d6');
    const mopAct = (dt, first) => {
      sndT -= dt;
      const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(floorPlane, p)) return;
      p.x = Math.max(-0.65, Math.min(2.15, p.x)); p.z = Math.max(0.5, Math.min(1.6, p.z));
      const mp = tools.mop, prev = first || !st.mopP ? p : st.mopP, mv = p.clone().sub(prev), dist = mv.length();
      st.mopP = p.clone(); mp.visible = true; mp.position.copy(p);
      if (dist > 0.003) { let da = Math.atan2(mv.x, mv.z) - st.mopYaw; while (da > Math.PI / 2) da -= Math.PI; while (da < -Math.PI / 2) da += Math.PI; st.mopYaw += da * 0.35; }
      mp.userData.head.rotation.y = st.mopYaw;
      const ax = Math.cos(st.mopYaw), az = -Math.sin(st.mopYaw);   // 판의 긴 방향
      let wiped = false;
      puddles.forEach(q => {
        if (q.gone) return;
        const dx = q.x - p.x, dz = q.z - p.z, along = dx * ax + dz * az, perp = Math.abs(-dx * az + dz * ax);
        if (Math.abs(along) < 0.19 + q.r * 0.4 && perp < 0.06 + q.r * 0.6) { wiped = true; q.hp -= dist * (q.small ? 14 : 5) + dt * 0.35; q.x += mv.x * 0.55; q.z += mv.z * 0.55; }
      });
      if (wiped) {
        st.mopWet = Math.min(1, (st.mopWet || 0) + dt * 0.5); st.happyT = Math.max(st.happyT, 0.3);
        if (Math.random() < 0.35 && dist > 0.004) addDrop(p.x + mv.x * 3, 0.02, p.z + mv.z * 3, mv.x * 20, 0.25, mv.z * 20, 0.005);
      }
      mp.userData.cloth.material.color.copy(clothDry).lerp(clothWet, (st.mopWet || 0) * 0.7);   // 걸레가 점점 젖는다
      if (dist > 0.006 && sndT <= 0) { sndT = 0.11; audio.playNoise(0.1, wiped ? 0.14 : 0.07, wiped ? 900 : 1600, 1.0); }
    };
    const act = (dt, first) => {
      if (tool_.current === 'mop') { if (st.stage === 'clean') mopAct(dt, first); return; }
      const h = hitFriend(), tl = tools[tool_.current];
      let target = null, onBody = false, normal = null;
      if (h) { target = h.point.clone(); onBody = true; normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 0, 1); }
      else { const p = new THREE.Vector3(); if (ray.ray.intersectPlane(waterPlane, p) && insideTub(p.x, p.z)) target = p; else if (ray.ray.intersectPlane(floorPlane, p)) target = p; }
      if (!target) return;
      const inWater = !onBody && Math.abs(target.y - WATER_Y) < 0.01;
      const k = tool_.current;
      if (!STAGE_TOOLS[st.stage] || !STAGE_TOOLS[st.stage].includes(k)) return;
      sndT -= dt;
      if (k === 'soap') {
        tl.visible = true; tl.position.copy(target).addScaledVector(normal || new THREE.Vector3(0, 1, 0), 0.04); tl.lookAt(camera.position); tl.rotateX(-Math.PI / 2 + 0.4);
        if (onBody) {
          if (first || target.distanceTo(ptr.lastP) > 0.018) { addFoam(h.object, target.clone().addScaledVector(normal, 0.004)); if (Math.random() < 0.6) addFoam(h.object, target.clone().addScaledVector(normal, 0.004).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0))); ptr.lastP.copy(target); if (Math.random() < 0.08) addBubble(target.x, target.y + 0.04, target.z + 0.05); }
          dirts.forEach(d => { if (!d.gone && d.m.getWorldPosition(tmpV).distanceTo(target) < 0.075) d.soap = 1; });
          st.wet = Math.max(st.wet, 0.3); st.happyT = Math.max(st.happyT, 0.4); st.soapT = (st.soapT || 0) + dt;
          if (sndT <= 0) { sndT = 0.12; sfx.scrub(); }
        } else if (inWater) { if (Math.random() < 0.15) addBubble(target.x, WATER_Y + 0.03, target.z); if (sndT <= 0) { sndT = 0.2; sfx.scrub(); addRipple(target.x, target.z, 0.004); } }
      } else if (k === 'shower') {
        tl.visible = true; tl.position.set(target.x, Math.max(target.y, WATER_Y) + 0.38, target.z + 0.12);
        for (let i = 0; i < 6; i++) { const ox = (Math.random() - 0.5) * 0.06, oz = (Math.random() - 0.5) * 0.06; addDrop(tl.position.x + ox, tl.position.y - 0.03, tl.position.z + oz, ox * 2 + (target.x - tl.position.x) * 0.5, -1.4 - Math.random() * 0.4, oz * 2 + (target.z - tl.position.z) * 2.4, 0.006); }
        if (onBody) {
          const R = 0.1;
          // 맞은 자리에서 물줄기가 흘러내린다. 거품이 있던 자리면 비눗물로
          let soapy = 0;
          foams.forEach(f => { if (!f.die && f.m.getWorldPosition(tmpV).distanceTo(target) < R) { f.die = 0.001; soapy++; if (Math.random() < 0.15) addStream(partOf(f.obj), tmpV, true); } });
          if (Math.random() < dt * 22) { const p = partOf(h.object); if (p) addStream(p, target.clone().add(sV.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.03, 0)), soapy > 0 && Math.random() < 0.6); }
          dirts.forEach(d => { if (!d.gone && d.m.getWorldPosition(tmpV).distanceTo(target) < R) { d.hp -= dt * (d.soap ? 3 : 0.9); } });
          st.wet = Math.min(1, st.wet + dt * 0.8); st.fluff = Math.max(0, st.fluff - dt); st.rinseT = (st.rinseT || 0) + dt; if (!dirts.some(d => !d.gone)) st.cleanT = (st.cleanT || 0) + dt;
          if (friendId === 'cat' && !st.said.catWet) { st.said.catWet = true; friendSound(); }
        } else if (inWater && Math.random() < 0.3) addRipple(target.x, target.z, 0.003);
        if (sndT <= 0) { sndT = 0.24; sfx.shower(); }
      } else if (k === 'towel') {
        if (st.capeT == null) { tl.visible = true; tl.position.copy(target).addScaledVector(normal || new THREE.Vector3(0, 1, 0), 0.06); tl.lookAt(camera.position); tl.rotateX(-Math.PI / 2 + 0.3); }
        if (onBody && st.capeT == null) { st.capeT = 0; tl.visible = false; sfx.towel(); audio.playNoise(0.35, 0.18, 900, 0.6); }   // 휘리릭 한 바퀴
      } else if (k === 'brush') {
        const mw = fr.head.localToWorld(fr.mouth.clone()), near = onBody && target.distanceTo(mw) < 0.11;
        const jig = Math.sin(performance.now() / 45) * 0.014;
        tl.visible = true; tl.rotation.set(0, 0, 0);
        if (near) tl.position.set(mw.x - 0.06 + jig, mw.y + 0.004, mw.z + 0.03); else tl.position.copy(target).addScaledVector(normal || new THREE.Vector3(0, 0, 1), 0.04).add(sV.set(-0.06, 0, 0));
        if (near) {
          const move = target.distanceTo(ptr.lastP); ptr.lastP.copy(target);
          st.brush = Math.min(1, st.brush + dt * 0.3 + move * 2.5); st.happyT = Math.max(st.happyT, 0.3);
          if (st.brush > 0.25) milkLip.visible = false;
          if (Math.random() < dt * 9 && foams.filter(f => f.mouth).length < 26) addFoam(fr.head, mw.clone().add(sV.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.025, 0.008)), true);
          if (sndT <= 0) { sndT = 0.09; audio.playNoise(0.06, 0.1, 4200 + Math.random() * 900, 1.6); }
        }
      } else if (k === 'dryer') {
        const toCam = camera.position.clone().sub(target).normalize();
        tl.visible = true; tl.position.copy(target).addScaledVector(toCam, 0.28); tl.lookAt(target);
        if (ap.length < AIR) ap.push({ p: tl.position.clone(), v: target.clone().sub(tl.position).multiplyScalar(2.6), life: 0.4 });
        if (onBody) { st.wet = Math.max(0, st.wet - dt * 0.35); if (st.wet < 0.35) st.fluff = Math.min(1, st.fluff + dt * 0.4); st.happyT = Math.max(st.happyT, 0.3); }
        dryerOn = 0.12; dryerLoad = !!onBody;   // 모터 소리는 그림 루프에서 (누르는 동안 계속 위잉)
      }
    };
    const tool_ = { current: 'soap' };
    // 문지르는 중에 다음 단계로 넘어가도 도구는 손을 뗀 뒤에 바꾼다 (비누칠하던 손이 갑자기 샤워가 되지 않게)
    apiRef.current.setTool = (t) => { if (ptr.down) ptr.nextTool = t; else tool_.current = t; };

    // ── 매 프레임 ──
    const DPR = [2, 1.6, 1.3, 1]; let dprI = 0, slowT = 0, raf = 0, last = performance.now(), t = 0;
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR[dprI])); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // 화면이 세로로 길면 조금 더 멀리서
      camFar = w / h < 1.1 ? 1.4 : 1; camSnap = true;
    };
    setSpot('tub', true); resize(); const ro = new ResizeObserver(resize); ro.observe(wrap);
    const wp = water.mesh.geometry.attributes.position;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // 느린 기기: 해상도 한 단계씩 낮춤
      if (dt > 0.026) slowT += dt; else slowT = Math.max(0, slowT - dt * 0.5);
      if (slowT > 2 && dprI < DPR.length - 1) { dprI++; slowT = 0; resize(); }
      {
        const k = camSnap ? 1 : 1 - Math.exp(-dt * 2.2); camSnap = false;
        camTmp.copy(camG.p).sub(camG.l).multiplyScalar(camFar).add(camG.l);
        camera.position.lerp(camTmp, k); camL.lerp(camG.l, k); camera.lookAt(camL);
      }
      if (ptr.down && !ptr.drag && !moving) act(dt, false);
      // 드라이어 모터: 쓰는 동안 계속 돌고, 손을 떼면 잦아든다
      dryerOn -= dt;
      if (dryerOn > 0) {
        if (audio.elementMode) { dryerChunkT -= dt; if (dryerChunkT <= 0) { dryerChunkT = 0.46; playDryerChunk(audio, dryerLoad); } }
        else {
          if (!dryerSnd) { dryerSnd = startDryer(audio); dryerSnd && (dryerSnd.load = false); }
          if (dryerSnd && dryerSnd.load !== dryerLoad) { dryerSnd.load = dryerLoad; dryerSnd.setLoad(dryerLoad); }
        }
      } else if (dryerSnd) { dryerSnd.stop(); dryerSnd = null; }

      // 얼룩 · 거품
      dirts.forEach(d => {
        if (d.gone) return;
        if (d.hp <= 0) { d.gone = true; d.part.remove(d.m); return; }
        d.m.scale.copy(d.s0).multiplyScalar(0.85 + 0.15 * d.hp); d.m.material.opacity = Math.max(0, Math.min(1, d.hp * 1.2));   // 씻길수록 옅어짐
      });
      for (let i = foams.length - 1; i >= 0; i--) {
        const f = foams[i], m = f.m;
        if (m.userData.grow < 1) { m.userData.grow = Math.min(1, m.userData.grow + dt * 6); }
        let k = m.userData.grow;
        if (f.die) { f.die += dt * 4; k *= Math.max(0, 1 - f.die); if (f.die >= 1) { m.parent.remove(m); foams.splice(i, 1); if (Math.random() < 0.3) { const p = m.getWorldPosition(tmpV); addDrop(p.x, p.y, p.z, 0, -0.3, 0.1, 0.008); } continue; } }
        const ws = f.obj.getWorldScale(tmpN); m.scale.set(m.userData.r * k / ws.x, m.userData.r * k / ws.y, m.userData.r * k / ws.z);
      }
      const left = dirts.filter(d => !d.gone), soaped = left.every(d => d.soap);
      // 단계 진행
      const liveFoam = foams.reduce((n, f) => n + (!f.die && !f.mouth ? 1 : 0), 0);
      st.foamPeak = Math.max(st.foamPeak || 0, liveFoam);
      if (st.stage === 'soap') {
        // 얼룩을 다 문지르거나, 꽤 오래 문질러 대부분 덮었으면 헹구기로 (한 번 넘어가면 다시 비누로 돌아가지 않는다)
        const nSoap = dirts.filter(d => d.soap || d.gone).length;
        if (soaped || (st.soapT > 5 && nSoap >= dirts.length * 0.6) || st.soapT > 12) { dirts.forEach(d => { d.soap = 1; }); setStage('shower'); }
      } else if (st.stage === 'shower') {
        // 오래 헹궜는데 남은 얼룩이 조금이면 저절로 씻겨 나감
        if (left.length && left.length <= 3 && st.rinseT > 4) left.forEach(d => { d.hp -= dt * 0.8; });
        // 얼룩이 다 없어진 뒤 2.5초쯤 더 헹궜으면 구석에 남은 거품은 신경 쓰지 않는다
        if (left.length || (liveFoam > Math.max(3, st.foamPeak * 0.15) && (st.cleanT || 0) < 2.5)) { /* 헹구는 중 */ }
        else {
          foams.forEach(f => { if (!f.die) f.die = 0.001; });
          if (!st.shaken) { if (!ptr.down) doShake(); }   // 누르고 있는 동안은 계속 샤워
          else if (st.shakeT > 1.4) { spawnPuddles(); setStage('cleanGo', VOICE.bathCleanGo()); }   // 바닥에 튄 물을 닦고 → 수건
        }
      } else if (st.stage === 'towel' && st.capeT != null && st.capeT < 1) {
        st.capeT = Math.min(1, st.capeT + dt / 1.0); const e = 1 - Math.pow(1 - st.capeT, 3);
        cape.visible = true; cape.rotation.y = -(1 - e) * Math.PI * 2; cape.scale.setScalar(0.35 + 0.65 * e); cape.position.y = (1 - e) * 0.3;
        st.wet = Math.min(st.wet, 1 - e);
        if (st.capeT > 0.55 && !st.capeHid) {
          st.capeHid = true;
          fr.root.children.forEach(c => { if (c !== fr.head && c !== cape) { c.userData.wasVis = c.visible; c.visible = false; } });
          streams.length = 0; trails.water.length = 0; trails.soap.length = 0;
        }
        if (st.capeT >= 1) { st.wet = 0; st.happyT = 4; setStage('caped'); say(VOICE.bathCape()); cheer(8); audio.playYum(); later(() => goRoom(), 4800); }
      }
      else if (st.stage === 'dryer') { if (st.fluff >= 1 && !ptr.down && !moving) { setStage('milkGo', VOICE.bathDried()); st.happyT = 2; cheer(); audio.playYum(); Object.values(tools).forEach(t => { t.visible = false; }); } }
      else if (st.stage === 'clean') {
        // 남은 게 작은 물방울이나 거의 닦인 웅덩이뿐이면 저절로 마른다
        const lp = puddles.filter(q => !q.gone);
        if (lp.length && !ptr.down && lp.every(q => q.small || q.hp < 0.25)) lp.forEach(q => { q.fade = true; });
        if (!lp.length && !st.cleanDone) {
          st.cleanDone = true; tools.mop.visible = false; st.happyT = 2; audio.playYum();
          for (let i = 0; i < 8; i++) later(() => pop('✨', -0.4 + Math.random() * 2.3, 0.02, 0.6 + Math.random() * 0.8), i * 110);
          later(() => { setStage('towelGo', VOICE.bathCleanDone()); setSpot('tub'); }, 900);
        }
      }
      else if (st.stage === 'brush') { if (st.brush >= 1 && !ptr.down) { setStage('rinseGo', VOICE.bathBrushDone()); st.happyT = 2; cheer(); tools.brush.visible = false; } }

      // 물웅덩이: 닦인 만큼 작아지고 옅어짐, 배수구에 밀어 넣으면 꼬르륵
      puddles.forEach(q => {
        if (q.gone) return;
        if (Math.hypot(q.x - DRAIN.x, q.z - DRAIN.z) < 0.09 + q.r * 0.3) { q.hp -= dt * 1.6; if (!q.gurgle) { q.gurgle = true; audio.playFreq(190, 'sine', 0.2, 0.35); setTimeout(() => audio.playFreq(120, 'sine', 0.3, 0.3), 140); } }
        if (q.fade) q.hp -= dt * 0.7;
        if (q.hp <= 0) { q.gone = true; scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); if (!q.small) pop('✨', q.x, 0.02, q.z); return; }
        const s = q.r * (0.3 + 0.7 * q.hp); q.m.scale.set(s, s, 1); q.m.position.set(q.x, 0.003, q.z); q.m.material.opacity = Math.min(1, q.hp * 1.6);
      });

      // 욕조에서 나오기: 포물선으로 폴짝
      if (st.hop) {
        const h = st.hop; h.t = Math.min(1, h.t + dt / 1.1); const e = h.t * h.t * (3 - 2 * h.t);
        base.lerpVectors(h.from, h.to, e); base.y += Math.sin(h.t * Math.PI) * 0.55;
        if (h.t >= 1) { st.hop = null; base.copy(h.to); st.headX = SPOTS.mat.head; setStage('towel'); sfx.splash(0.15); audio.playPopSound(); }
      } else if (st.stage === 'out') st.headX = -0.33;
      // 컵 움직임
      if (st.cupA) {
        const A = st.cupA, c = A.cup; A.t += dt;
        const mw = fr.head.localToWorld(fr.mouth.clone()); mw.z += 0.065; mw.y -= 0.085;
        const toMouth = (u) => { c.position.lerpVectors(A.home, mw, u * u * (3 - 2 * u)); };
        if (A.kind === 'milk') {
          const tilt = c.userData.tilt, tipW = c.userData.tip.clone().applyAxisAngle(XA, -tilt);
          const at = fr.head.localToWorld(fr.mouth.clone()); at.z += 0.012; at.sub(tipW);   // 이 자리에 두면 끝이 입에 닿는다
          const ez = (u) => u * u * (3 - 2 * u);
          if (A.t < 0.45) { const u = ez(A.t / 0.45); c.position.lerpVectors(A.home, at, u); c.rotation.x = -tilt * u; }
          else if (A.t < 1.45) {
            c.position.copy(at); c.position.z += Math.sin(A.t * 18) * 0.002; c.rotation.x = -tilt; st.headTilt = tilt > 0.5 ? -0.2 : -0.05;
            c.userData.fill.scale.y = Math.max(0.02, st.milk - 0.25 * Math.min(1, (A.t - 0.5) / 0.9));
            if (A.snd < 3 && A.t > 0.55 + A.snd * 0.3) { A.snd++; audio.playFreq(640, 'sine', 0.05, 0.3); setTimeout(() => audio.playFreq(470, 'sine', 0.06, 0.28), 60); milkLip.visible = true; }   // 쪽쪽
          } else if (A.t < 1.9) { st.headTilt = 0; const u = ez((A.t - 1.45) / 0.45); c.position.lerpVectors(at, A.home, u); c.rotation.x = -tilt * (1 - u); }
          else {
            c.position.copy(A.home); c.rotation.x = 0; st.cupA = null; st.milk = Math.max(0, st.milk - 0.25); c.userData.fill.scale.y = Math.max(0.02, st.milk); st.happyT = 1;
            if (st.milk <= 0.01) { c.userData.fill.visible = false; setStage('brushGo', VOICE.bathMilkDone()); cheer(); audio.playYum(); }
          }
        } else {
          if (A.t < 0.45) { toMouth(A.t / 0.45); }
          else if (A.t < 0.95) { c.position.copy(mw); c.rotation.x = -Math.sin((A.t - 0.45) / 0.5 * Math.PI) * 0.8; }
          else if (A.t < 1.35) { const u = (A.t - 0.95) / 0.4; c.position.lerpVectors(mw, A.home, u * u * (3 - 2 * u)); c.rotation.x = 0; }
          else if (A.t < 2.6) {   // 가글가글: 고개를 젖히고 보글보글
            c.position.copy(A.home); st.headTilt = -0.45;
            if (A.t - A.snd * 0.09 > 1.35) { A.snd++; audio.playFreq(260 + Math.random() * 260, 'sine', 0.06, 0.35); if (A.snd % 2) { const m2 = fr.head.localToWorld(fr.mouth.clone()); addDrop(m2.x + (Math.random() - 0.5) * 0.03, m2.y + 0.02, m2.z + 0.02, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.3, 0.1, 0.005); } }
          } else if (A.t < 2.95) { st.headTilt = 0; st.rotY = Math.PI; }   // 세면대 쪽으로 돌아서
          else if (A.t < 3.5) {   // 퉤
            if (!A.spat) { A.spat = true; audio.playNoise(0.25, 0.25, 1500, 0.8); foams.forEach(f => { if (f.mouth && !f.die) f.die = 0.001; }); }
            if (Math.random() < 0.8) { const m2 = fr.head.localToWorld(fr.mouth.clone()); addDrop(m2.x + (Math.random() - 0.5) * 0.02, m2.y, m2.z, (1.6 - m2.x) * 1.2 + (Math.random() - 0.5) * 0.15, 0.4 + Math.random() * 0.3, (-0.15 - m2.z) * 3.0, 0.006); }
          } else if (A.t < 3.9) { st.rotY = 0; }
          else {
            st.cupA = null; st.gargles++; st.happyT = 1;
            if (st.gargles >= 2) { setStage('bedGo', VOICE.bathBedGo()); cheer(); audio.playYum(); } else say(VOICE.bathGargle());
          }
        }
      }

      // 젖은 털: 어둡고 반짝, 마르면 복슬
      const wet = st.wet, fl = st.fluff;
      fr.fur.forEach(m => { m.color.copy(m.userData.base).multiplyScalar(1 - 0.22 * wet); m.roughness = 0.85 - 0.55 * wet; });
      const puff = 1 - 0.05 * wet + 0.06 * fl;
      fr.parts.forEach(p => { if (p.material.userData.base && !(p.parent === fr.head && p.userData.r >= 0.13)) p.scale.copy(p.userData.baseScale).multiplyScalar(puff); });   // 머리통은 그대로 (부풀면 눈이 묻힘)
      // 젖어 있으면 샤워를 멈춰도 물이 몇 줄기씩 주르륵
      if (wet > 0.45 && Math.random() < dt * 4 * wet) {
        const p = Math.random() < 0.6 ? fr.head : fr.parts[Math.floor(Math.random() * fr.parts.length)];
        tmpN.set((Math.random() - 0.5) * 1.2, 0.35 + Math.random() * 0.5, 0.5 + Math.random() * 0.5).normalize().multiplyScalar(p.userData.r);
        addStream(p, p.localToWorld(tmpN.clone()), false);
      }

      // 친구 움직임
      st.happyT = Math.max(0, st.happyT - dt); st.blinkT -= dt;
      const blink = st.blinkT < 0.12; if (st.blinkT < 0) st.blinkT = 2 + Math.random() * 3;
      fr.eyes.forEach(e => { e.scale.y = blink ? 0.15 : 1.15; });
      const hp = (st.happyT > 0 || st.done) && !st.sleep;
      fr.head.rotation.z = Math.sin(t * (hp ? 6 : 1.4)) * (hp ? 0.12 : 0.05);
      fr.head.rotation.x = st.headX + st.headTilt + Math.sin(t * 0.9) * 0.04;   // 카메라를 올려다본다 (가글할 땐 젖힘)
      if (fr.tail) fr.tail.rotation.z = Math.sin(t * (hp ? 14 : 4)) * (hp ? 0.6 : 0.25);
      fr.ears.forEach((e, i) => { if (friendId === 'dog') e.rotation.z = (i ? 1 : -1) * (0.35 + Math.sin(t * 3 + i) * 0.05 - fl * 0.15); });
      fr.root.position.copy(base); fr.root.position.y += st.done && !st.bed ? Math.abs(Math.sin(t * 5)) * 0.05 : 0;
      if (st.shakeT > 2 || !st.shaken) { let da = st.rotY - fr.root.rotation.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; fr.root.rotation.y += da * Math.min(1, dt * 8); }
      if (st.shaken) {
        st.shakeT += dt;
        if (st.shakeT < 1.3) {
          const a = Math.sin(st.shakeT * 45) * 0.35 * (1 - st.shakeT / 1.3);
          if (friendId !== 'yuna') { fr.root.rotation.y = a; fr.head.rotation.y = a * 1.5; for (let i = 0; i < 5; i++) { const ang = Math.random() * 6.28, hp2 = fr.head.getWorldPosition(tmpV); addDrop(hp2.x, hp2.y - 0.1 + Math.random() * 0.2, hp2.z, Math.cos(ang) * 1.3, 0.5 + Math.random() * 0.8, Math.sin(ang) * 1.3, 0.008); } }
          else { fr.root.rotation.z = a * 0.15; if (Math.random() < 0.5) addDrop(fr.root.position.x + (Math.random() - 0.5) * 0.4, WATER_Y, 0.15, (Math.random() - 0.5) * 1.2, 1 + Math.random(), 0.6 + Math.random() * 0.6, 0.009); }
        } else if (st.shakeT < 2) { fr.root.rotation.y = 0; fr.root.rotation.z = 0; fr.head.rotation.y = 0; }
      }

      if (st.bed && parent) bedTick(dt);

      // 물결
      ripples.forEach(r => { r.t += dt; }); while (ripples.length && ripples[0].t > 3) ripples.shift();
      for (let i = 0; i < wp.count; i++) {
        const x = water.base[i * 3], z = water.base[i * 3 + 2];
        let y = Math.sin(x * 9 + t * 1.6) * 0.0015 + Math.cos(z * 11 + t * 1.3) * 0.0012;
        for (const r of ripples) { const d = Math.hypot(x - r.x, z - r.z), front = r.t * 0.35; if (d < front + 0.05) y += r.amp * Math.sin((d - front) * 60) * Math.exp(-r.t * 1.6) * Math.exp(-Math.max(0, front - d) * 8); }
        wp.setY(i, WATER_Y + y);
      }
      wp.needsUpdate = true; water.mesh.geometry.computeVertexNormals();
      const waveAt = (x, z) => { let y = 0; for (const r of ripples) { const d = Math.hypot(x - r.x, z - r.z), front = r.t * 0.35; if (d < front + 0.05) y += r.amp * Math.sin((d - front) * 60) * Math.exp(-r.t * 1.6) * Math.exp(-Math.max(0, front - d) * 8); } return y; };

      // 장난감: 둥둥, 서로·친구를 피하고 욕조 안에
      toys.forEach((o, i) => {
        o.hop = Math.max(0, o.hop - dt * 1.6); o.spin = Math.max(0, o.spin - dt * 1.2);
        if (o.held || !o.inWater) {   // 끌고 있거나 선반에 있음
          if (!o.held) { o.x += (o.home.x - o.x) * Math.min(1, dt * 6); o.z += (o.home.z - o.z) * Math.min(1, dt * 6); }
          const ty = o.held ? WATER_Y + 0.12 : o.home.y; o.y += (ty - o.y) * Math.min(1, dt * (o.held ? 12 : 6));
          if (!o.held) { let da = -o.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; o.yaw += da * Math.min(1, dt * 5); }
          o.g.position.set(o.x, o.y + Math.sin(o.hop * Math.PI) * 0.1 + (o.held ? Math.sin(t * 6) * 0.01 : 0), o.z);
          o.g.rotation.set(o.held ? Math.sin(t * 5) * 0.15 : 0, o.yaw + o.spin * Math.PI * 2, 0);
          return;
        }
        {   // 물에 떠 있음
          o.vx += Math.sin(t * 0.3 + i * 2) * 0.004 * dt * 60 * 0.02; o.vz += Math.cos(t * 0.25 + i) * 0.004 * dt * 60 * 0.02;
          const fx = fr.root.position.x, dx = o.x - fx, dz = o.z - 0.02, dd = Math.hypot(dx, dz); if (cur === scene && insideTub(fr.root.position.x, fr.root.position.z) && dd < 0.27) { o.vx += dx / (dd + 0.01) * dt * 0.4; o.vz += dz / (dd + 0.01) * dt * 0.4; }
          toys.forEach(q => { if (q === o || !q.inWater || q.held) return; const ex = o.x - q.x, ez = o.z - q.z, e = Math.hypot(ex, ez); if (e < 0.11) { o.vx += ex / (e + 0.01) * dt * 0.3; o.vz += ez / (e + 0.01) * dt * 0.3; } });
          o.vx *= Math.exp(-dt * 1.2); o.vz *= Math.exp(-dt * 1.2);
          let nx = o.x + o.vx * dt, nz = o.z + o.vz * dt;
          if (!insideTub(nx, nz, 0.82)) { o.vx *= -0.5; o.vz *= -0.5; nx = o.x; nz = o.z; }
          o.x = nx; o.z = nz;
        }
        const sp = Math.hypot(o.vx, o.vz); if (sp > 0.02) { const ty = Math.atan2(-o.vz, o.vx); let da = ty - o.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; o.yaw += da * Math.min(1, dt * 3); }
        o.y = WATER_Y;
        o.g.position.set(o.x, WATER_Y - 0.012 + waveAt(o.x, o.z) * 2 + Math.sin(t * 2 + i) * 0.004 + Math.sin(o.hop * Math.PI) * 0.12, o.z);
        o.g.rotation.set(Math.sin(t * 1.7 + i) * 0.08, o.yaw + (1 - o.spin) * 0 + o.spin * Math.PI * 2, Math.cos(t * 1.4 + i) * 0.08);
      });

      // 비눗방울
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; b.age += dt;
        b.m.position.y += b.vy * dt; b.m.position.x += Math.sin(t * 1.3 + b.ph) * 0.02 * dt; b.m.position.z += Math.cos(t * 1.1 + b.ph) * 0.015 * dt;
        const s = b.r * Math.min(1, b.age * 3) * (1 + Math.sin(t * 5 + b.ph) * 0.03); b.m.scale.set(s, s * 0.97, s);
        if (b.age > b.life || b.m.position.y > 1.6) popBubble(b, true);
      }
      if (Math.random() < dt * 0.25 && bubbles.length < 6) addBubble(TUB_CX + (Math.random() - 0.5) * 1.0, WATER_Y + 0.02, (Math.random() - 0.5) * 0.35);

      // 물방울
      for (let i = dp.length - 1; i >= 0; i--) {
        const d = dp[i]; d.vy -= 4.5 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
        if (d.y < 0.9 && Math.hypot(d.x - 1.6, d.z + 0.15) < 0.19) { dp.splice(i, 1); continue; }
        const inTub = insideTub(d.x, d.z);
        if ((inTub && d.y < WATER_Y) || d.y < 0.005 || d.life <= 0) { if (inTub && d.y < WATER_Y && Math.random() < 0.08) addRipple(d.x, d.z, 0.002); dp.splice(i, 1); continue; }
      }
      for (let i = 0; i < DROPS; i++) {
        const d = dp[i];
        if (d) { const sp = Math.hypot(d.vx, d.vy, d.vz); tmpV.set(d.x, d.y, d.z); tmpN.set(d.vx, d.vy, d.vz).normalize(); tmpQ.setFromUnitVectors(UP, tmpN); dm.compose(tmpV, tmpQ, dsc.set(d.r, d.r * (1 + Math.min(2, sp * 0.8)), d.r)); }
        else dm.makeScale(0, 0, 0);
        drops.setMatrixAt(i, dm);
      }
      drops.instanceMatrix.needsUpdate = true; drops.count = DROPS;
      for (let i = ap.length - 1; i >= 0; i--) { const a = ap[i]; a.life -= dt; a.p.addScaledVector(a.v, dt); if (a.life <= 0) ap.splice(i, 1); }
      for (let i = 0; i < AIR; i++) { const a = ap[i]; if (a) { const s = 0.012 + (0.4 - a.life) * 0.05; dm.makeScale(s, s, s).setPosition(a.p.x + (Math.random() - 0.5) * 0.01, a.p.y, a.p.z); } else dm.makeScale(0, 0, 0); air.setMatrixAt(i, dm); }
      air.instanceMatrix.needsUpdate = true;
      updateStreams(dt);
      if (!ptr.down) { const sh = tools.shower; sh.visible = false; }
      renderer.render(cur, camera);
    };
    raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) window.__bath = { st, ptr, dirts, foams, toys, fr, camera, scene, tool_, puddles, tools, get milkCup() { return milkCup; }, rinseCup };

    return () => {
      alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro.disconnect();
      if (dryerSnd) { dryerSnd.stop(); dryerSnd = null; }
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); cv.removeEventListener('lostpointercapture', onUp); window.removeEventListener('pointerup', onUp);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      if (house) house.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      veil.remove(); nightDiv.remove(); envTex.dispose(); pmrem.dispose(); renderer.dispose();
      if (import.meta.env.DEV) delete window.__bath;
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (apiRef.current.setTool) apiRef.current.setTool(tool); }, [tool]);
  // 할 차례가 바뀌면 그 도구를 골라 준다 (아기가 도구를 몰라도 이어서 놀 수 있게)
  useEffect(() => { if (['soap', 'shower', 'towel', 'dryer', 'brush'].includes(ui.stage)) setTool(ui.stage); else if (ui.stage === 'clean') setTool('mop'); }, [ui.stage]);

  const big = (bg, color = '#ffffff') => ({ border: 'none', borderRadius: '24px', minHeight: '52px', padding: '0 20px', background: bg, color, fontFamily: JUA, fontSize: '1.15rem', cursor: 'pointer', touchAction: 'manipulation', whiteSpace: 'nowrap' });
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <style>{'@keyframes bathPop { 0% { transform: translateY(0) scale(0.4); opacity: 0; } 20% { transform: translateY(-14px) scale(1.2); opacity: 1; } 100% { transform: translateY(-70px) scale(1); opacity: 0; } } @keyframes bathTwinkle { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } } @keyframes bathGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,212,59,0.9); } 50% { box-shadow: 0 0 0 10px rgba(255,212,59,0); } }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={onChange} style={big('#f6efe7', '#5c5248')}>🔄 친구 바꾸기</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: '#e7f5ff', borderRadius: '18px', padding: '6px 18px', fontFamily: JUA, fontSize: '1.3rem', color: '#1e3a5f' }}>{HINTS[ui.stage]}</span>
        </div>
        <div style={{ width: '130px' }} />
      </div>
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 16px 30px -18px rgba(29,111,165,0.55)', background: '#eaf6fb' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'pointer' }} />
        {GO_BTN[ui.stage] && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '18px', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <button onClick={() => { audio.playPopSound(); if (apiRef.current.go) apiRef.current.go(ui.stage); }} style={{ ...big(GO_BTN[ui.stage].bg), pointerEvents: 'auto', minHeight: '84px', fontSize: '1.7rem', padding: '0 34px', borderRadius: '30px', animation: 'bathGlow 1.2s infinite', boxShadow: '0 10px 22px -10px rgba(0,0,0,0.5)' }}>
              {GO_BTN[ui.stage].icon ? <span style={{ fontSize: '2.4rem', verticalAlign: 'middle', marginRight: '10px' }}>{GO_BTN[ui.stage].icon}</span>
                : <span style={{ display: 'inline-block', width: '44px', height: '32px', borderRadius: '6px', background: 'linear-gradient(#ffffff 0 70%, #dee2e6 70% 78%, #ffffff 78% 84%, #dee2e6 84% 90%, #ffffff 90%)', verticalAlign: 'middle', marginRight: '12px', border: '2px solid #ffffff' }} />}{GO_BTN[ui.stage].label}
            </button>
          </div>
        )}
        {!ui.done && STAGE_TOOLS[ui.stage] && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '14px', display: 'flex', justifyContent: 'center', gap: '14px', pointerEvents: 'none' }}>
            {TOOLS.filter(tb => STAGE_TOOLS[ui.stage].includes(tb.id)).map(tb => {
              const on = tool === tb.id, next = ui.stage === tb.id;
              return (
                <button key={tb.id} onClick={() => { audio.playPopSound(); setTool(tb.id); }} style={{ pointerEvents: 'auto', width: '86px', height: '86px', borderRadius: '26px', border: on ? '4px solid #1d6fa5' : '4px solid #ffffff', background: on ? '#e7f5ff' : 'rgba(255,255,255,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer', touchAction: 'manipulation', animation: next && !on ? 'bathGlow 1.2s infinite' : 'none', boxShadow: '0 8px 18px -10px rgba(0,0,0,0.45)', padding: 0 }}>
                  {tb.icon ? <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{tb.icon}</span>
                    : <span style={{ width: '40px', height: '30px', borderRadius: '6px', background: 'linear-gradient(#ffffff 0 70%, #dee2e6 70% 78%, #ffffff 78% 84%, #dee2e6 84% 90%, #ffffff 90%)', border: '2px solid #ced4da', display: 'block' }} />}
                  <span style={{ fontFamily: JUA, fontSize: '0.95rem', color: '#374151' }}>{tb.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {ui.done && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', pointerEvents: 'none' }}>
            <div style={{ fontFamily: JUA, fontSize: '2rem', color: '#db2777', textShadow: '0 3px 0 #fff', background: 'rgba(255,255,255,0.85)', borderRadius: '22px', padding: '6px 22px' }}>🌙 잘 자요, 좋은 꿈 꿔요!</div>
            <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
              <button onClick={onAgain} style={big('#4dabf7')}>🛁 한 번 더</button>
              <button onClick={onChange} style={big('#f783ac')}>🐾 다른 친구</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
