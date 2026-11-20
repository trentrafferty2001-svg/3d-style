// Pyramid reel: pyramid under construction (instanced block layers) + finished casing, limestone quarry, Nile barge,
// Merer's papyrus, sledge with block, Egyptian workers, water jar, construction ramp, Hatnub steep ramp with posts,
// workers' tomb (mastaba).
import * as THREE from 'three';
import { waterMaterial } from './world.js';
import { rng, fabricTexture } from './textures.js';
import { romanBuilder, shadowAll, canvasTex } from './rome.js';
import { persiaMats } from './persia.js';

const lime = () => new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.9, bumpMap: fabricTexture(19), bumpScale: 3 });
// pyramid of `levels` block courses; build(k) shows courses up to k (0..1); casing(k) fades in the smooth white casing
export function pyramid({ base = 46, levels = 20, block = 2.3 } = {}) {
  const g = new THREE.Group(); const M = lime();
  const courses = [];
  const h = base * 0.636 / levels; // Great Pyramid slope ~51.8°
  let count = 0; const spec = [];
  for (let l = 0; l < levels; l++) { const side = base * (1 - l / levels); const n = Math.max(1, Math.round(side / block)); spec.push([l, side, n]); count += n * n - Math.max(0, n - 2) ** 2; }
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M, count); g.add(inst);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); const R = rng(3);
  let i = 0; const levelStart = [];
  for (const [l, side, n] of spec) {
    levelStart.push(i); const bs = side / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (a > 0 && a < n - 1 && b > 0 && b < n - 1) continue; // only the outer ring of each course (inside hidden)
      m4.compose(new THREE.Vector3(-side / 2 + bs * (a + 0.5), h * (l + 0.5), -side / 2 + bs * (b + 0.5)), q, new THREE.Vector3(bs * 0.97, h * 0.96, bs * 0.97));
      inst.setMatrixAt(i, m4); c.setHSL(0.11, 0.35, 0.62 + (R() - 0.5) * 0.1); inst.setColorAt(i, c); i++;
    }
  }
  levelStart.push(i);
  // core fill (so the inside never looks hollow from above): stepped solid boxes
  const core = new THREE.Group(); g.add(core);
  const coreM = new THREE.MeshStandardMaterial({ color: 0xc4ae84, roughness: 1 });
  const cores = spec.map(([l, side]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(side * 0.9, h, side * 0.9), coreM); b.position.y = h * (l + 0.5); core.add(b); return b; });
  // smooth casing
  const cas = new THREE.Mesh(new THREE.ConeGeometry(base / Math.SQRT2, base * 0.636, 4, 1), new THREE.MeshStandardMaterial({ color: 0xf2e8d2, roughness: 0.45, transparent: true, opacity: 0 }));
  cas.rotation.y = Math.PI / 4; cas.position.y = base * 0.636 / 2; g.add(cas);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(base / Math.SQRT2 * 0.04, base * 0.636 * 0.04, 4), new THREE.MeshStandardMaterial({ color: 0xffd060, metalness: 0.9, roughness: 0.25 })); cap.rotation.y = Math.PI / 4; cap.position.y = base * 0.636 * 0.98; cap.visible = false; g.add(cap);
  g.build = (k) => { const L = Math.max(1, Math.round(k * levels)); inst.count = levelStart[Math.min(levels, L)]; cores.forEach((b, j) => b.visible = j < L); };
  g.casing = (k) => { cas.material.opacity = k; cas.visible = k > 0.01; cas.material.transparent = k < 0.99; cap.visible = k > 0.95; inst.visible = k < 0.99; core.visible = k < 0.99; };
  g.courseH = h; g.base = base; g.levels = levels;
  inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.build(1); g.casing(0);
  return shadowAll(g);
}
// straight construction ramp of mud brick leaning against one face
export function constructionRamp(len = 60, w = 6, rise = 14) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1, bumpMap: fabricTexture(41), bumpScale: 4 });
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(len, 0); shape.lineTo(len, rise); shape.lineTo(0, 0);
  const r = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), m); r.position.z = -w / 2; g.add(r);
  return shadowAll(g);
}
// limestone quarry: sunken pit with cut steps and loose blocks
export function quarry() {
  const g = new THREE.Group(); const M = lime();
  for (let i = 0; i < 4; i++) { const s = 14 - i * 3; const step = new THREE.Mesh(new THREE.BoxGeometry(s, 1.2, s * 0.7), M); step.position.set(-i * 0.8, i * 1.2 + 0.6, -i * 0.6); g.add(step); }
  const R = rng(9);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), M); b.position.set(5 + (R() - 0.5) * 6, 0.5, 6 + (R() - 0.5) * 4); b.rotation.y = R(); g.add(b); }
  return shadowAll(g);
}
// Nile cargo barge with a big limestone block
export function barge() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.8, bumpMap: fabricTexture(5), bumpScale: 2 });
  const hullShape = new THREE.Shape(); hullShape.moveTo(-5, 0.6); hullShape.quadraticCurveTo(-4, -0.4, 0, -0.5); hullShape.quadraticCurveTo(4, -0.4, 5, 0.9); hullShape.lineTo(-5, 0.9);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 2.2, bevelEnabled: false }), wood); hull.position.z = -1.1; g.add(hull);
  const blk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.4), lime()); blk.position.set(0, 1.4, 0); g.add(blk);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), wood); mast.position.set(-2, 3.3, 0); g.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.9, side: THREE.DoubleSide })); sail.position.set(-2, 3.6, 0.05); g.add(sail);
  const oar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3), wood); oar.position.set(4.6, 0.6, 1.2); oar.rotation.x = 0.5; g.add(oar);
  return shadowAll(g);
}
// papyrus logbook with hieratic-like script
export function papyrus() {
  const tex = canvasTex(512, 256, (x) => {
    x.fillStyle = '#d8c48e'; x.fillRect(0, 0, 512, 256); const R = rng(6);
    for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(120,95,50,${0.1 + R() * 0.1})`; x.beginPath(); x.moveTo(0, i * 4.3); x.lineTo(512, i * 4.3 + (R() - 0.5) * 2); x.stroke(); }
    x.fillStyle = 'rgba(30,20,10,0.85)';
    for (let line = 0; line < 9; line++) for (let k = 0; k < 26; k++) { const px = 470 - k * 17, py = 30 + line * 24; const t = R(); if (t < 0.3) x.fillRect(px, py, 10, 3); else if (t < 0.55) { x.beginPath(); x.arc(px + 5, py, 4, 0, 6); x.fill(); } else if (t < 0.8) { x.fillRect(px + 3, py - 6, 3, 12); } else { x.beginPath(); x.moveTo(px, py + 4); x.quadraticCurveTo(px + 6, py - 8, px + 12, py + 4); x.lineWidth = 2.5; x.strokeStyle = 'rgba(30,20,10,0.85)'; x.stroke(); } }
    x.fillStyle = 'rgba(150,40,25,0.8)'; x.fillRect(470, 24, 14, 4); x.fillRect(470, 120, 14, 4);
  });
  const geo = new THREE.PlaneGeometry(1.2, 0.6, 30, 1); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, 0.02 * Math.sin(x * 9)); }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const sheet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })); sheet.rotation.x = -Math.PI / 2; g.add(sheet);
  for (const s of [-1, 1]) { const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 16), new THREE.MeshStandardMaterial({ color: 0xc8b07a, roughness: 0.9 })); roll.rotation.x = Math.PI / 2; roll.position.set(s * 0.62, 0.03, 0); g.add(roll); }
  return shadowAll(g);
}
// wooden sledge carrying a block, with rope
export function sledge() {
  const g = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.85 });
  for (const s of [-1, 1]) { const run = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.18), wood); run.position.set(0, 0.09, s * 0.5); g.add(run); const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 10, 1, false, 0, Math.PI), wood); tip.rotation.set(Math.PI / 2, 0, -Math.PI / 2); tip.position.set(1.3, 0.2, s * 0.5); g.add(tip); }
  for (let i = 0; i < 4; i++) { const cb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 1.2), wood); cb.position.set(-1 + i * 0.66, 0.22, 0); g.add(cb); }
  const blk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.0), lime()); blk.position.y = 0.78; g.add(blk);
  return shadowAll(g);
}
// Egyptian worker: white kilt-tunic, headcloth
export function egyptian(i = 0) {
  const h = romanBuilder({ color: [0xf2ece0, 0xe8dcc4, 0xf0e8d8][i % 3], skin: [0xa86a44, 0x9a6040, 0xb87850][i % 3] });
  const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: [0xf2ece0, 0x3a5a8a, 0xd8c890][i % 3], roughness: 0.9 })); cloth.position.set(0, 0.03, -0.02); cloth.scale.set(1.06, 1, 1.12); h.j.head.add(cloth);
  return shadowAll(h.root), h;
}
export function waterJar() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xa8603a, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), m); body.scale.y = 1.25; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 12), m); neck.position.y = 0.18; g.add(neck);
  return shadowAll(g);
}
// Hatnub-style steep quarry ramp: central slope with staircases either side and post holes / posts
export function steepRamp({ len = 14, w = 3, angle = 0.2 } = {}) {
  const g = new THREE.Group(); const rock = new THREE.MeshStandardMaterial({ color: 0xc8b088, roughness: 1, bumpMap: fabricTexture(37), bumpScale: 5 });
  const slope = new THREE.Group(); slope.rotation.z = angle; g.add(slope);
  const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, w), rock); r.position.set(len / 2, -0.2, 0); slope.add(r);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85 });
  const posts = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 18; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(len / 18, 0.25, 1.2), rock); st.position.set((i + 0.5) * len / 18, 0.05 + (i % 2) * 0.04, s * (w / 2 + 0.6)); slope.add(st); }
    for (let i = 0; i < 6; i++) { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: 0x2a2014 })); hole.rotation.x = -Math.PI / 2; hole.position.set(1 + i * 2.2, 0.19, s * (w / 2 + 0.6)); slope.add(hole); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 10), wood); p.position.set(1 + i * 2.2, 0.6, s * (w / 2 + 0.6)); slope.add(p); posts.push(p); }
  }
  const walls = [-1].map(s => { const wl = new THREE.Mesh(new THREE.BoxGeometry(len + 6, 8, 1), rock); wl.position.set(len / 2, 1, s * (w / 2 + 2.2)); slope.add(wl); return wl; });
  g.slope = slope; g.posts = posts;
  return shadowAll(g);
}
// workers' tomb: mastaba with doorway and a painted relief panel
export function workerTomb() {
  const g = new THREE.Group(); const mud = new THREE.MeshStandardMaterial({ color: 0xb89a6a, roughness: 1, bumpMap: fabricTexture(23), bumpScale: 3 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 3.4), mud); m.position.y = 1.2; m.geometry.translate(0, 0, 0); g.add(m);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a1e14 })); door.position.set(0, 0.8, 1.71); g.add(door);
  const tex = canvasTex(256, 128, (x) => { x.fillStyle = '#d8c08a'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#4a2a14'; x.lineWidth = 3; for (let i = 0; i < 5; i++) { const px = 20 + i * 48; x.beginPath(); x.arc(px, 40, 7, 0, 7); x.stroke(); x.beginPath(); x.moveTo(px, 47); x.lineTo(px, 85); x.lineTo(px - 8, 115); x.moveTo(px, 85); x.lineTo(px + 8, 115); x.moveTo(px, 60); x.lineTo(px + 16, 52); x.stroke(); } x.fillStyle = '#a83a24'; x.fillRect(0, 0, 256, 8); x.fillRect(0, 120, 256, 8); });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); panel.position.set(1.4 + 0.5, 1.5, 1.705); panel.scale.setScalar(0.7); g.add(panel);
  return shadowAll(g);
}
export function nile(scene, { z = 0, w = 30, len = 400 } = {}) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(len, w), waterMaterial({ color: 0x2f5a5a, opacity: 1, ripple: 1.4 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.03, z); scene.add(water);
  const green = new THREE.MeshStandardMaterial({ color: 0x5a7a34, roughness: 1 });
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 8), green); b.rotation.x = -Math.PI / 2; b.position.set(0, 0.025, z + s * (w / 2 + 4)); scene.add(b); }
  return water;
}
