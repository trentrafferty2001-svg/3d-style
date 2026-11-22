// Pyramid reel: pyramid under construction (instanced block layers) + finished casing, limestone quarry, Nile barge,
// Merer's papyrus, sledge with block, Egyptian workers, water jar, construction ramp, Hatnub steep ramp with posts,
// workers' tomb (mastaba).
import * as THREE from 'three';
import { waterMaterial } from './world.js';
import { rng, fabricTexture } from './textures.js';
import { romanBuilder, shadowAll, canvasTex } from './rome.js';
import { persiaMats } from './persia.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { triTex, tfbm, voro, courses, jointDist, h2, std, worldUV, block, settle, smoothstepAB as SS, romanMats } from './roman.js';
import { fbm, grass, palm, mats as nileMats } from './nile.js';
import { flowWaterMaterial } from './water.js';
import { toon } from './toon.js';

// ---------- v1.4 materials (code-made, tileable, colour + bump + roughness) ----------
let _ET = null;
function egyptTex() {
  if (_ET) return _ET;
  const N = 512;
  // core limestone, 2.4 m tile: warm buff stone, chisel marks in diagonal strokes, shell pits, darker weathering
  const core = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.03, 201, N), m = tfbm(i, j, 0.12, 202, N), ch = Math.sin((i + j) * 0.35 + tfbm(i, j, 0.05, 203, N) * 6) * 0.5 + 0.5;
    const pit = SS(0.7, 0.78, tfbm(i, j, 0.09, 204, N)), w = SS(0.5, 0.8, tfbm(i, j * 0.4, 0.01, 205, N));
    const c = [0.82, 0.73, 0.57].map(v => v * (0.86 + 0.18 * n + 0.05 * m) * (1 - 0.12 * w) * (1 - 0.3 * pit));
    return { c, b: 0.5 + 0.12 * ch + 0.15 * m - 0.35 * pit, r: 0.9 };
  });
  // Tura casing limestone: fine, pale, smoothly dressed
  const casing = triTex(N, (i, j) => { const n = tfbm(i, j, 0.02, 211, N), m = tfbm(i, j, 0.2, 212, N); return { c: [0.94, 0.9, 0.81].map(v => v * (0.95 + 0.06 * n)), b: 0.5 + 0.05 * m, r: 0.62 + 0.1 * n }; });
  // sun-dried mud brick (36 x 18 x 12 cm), 1.44 m tile: grey-brown, straw flecks, soft eroded edges, mud mortar
  const MB = courses(N, 12, 100, 140, 221), mch = N / 12;
  const mud = triTex(N, (i, j) => {
    const row = Math.floor(j / mch), y = j - row * mch, [dx, k] = jointDist(MB[row], i, N), inB = y > 4 && y < mch - 4 && dx > 4, e = Math.min(y - 4, mch - 4 - y, dx - 4);
    const tone = 0.9 + 0.15 * h2(row, k, 222), n = tfbm(i, j, 0.08, 223, N), straw = SS(0.78, 0.84, tfbm(i * 2.5, j * 0.6, 0.2, 224, N));
    const c = inB ? [0.55 * tone, 0.45 * tone, 0.34 * tone].map(v => v * (0.85 + 0.2 * n)).map((v, q) => v * (1 - straw) + straw * [0.78, 0.68, 0.42][q]) : [0.5, 0.42, 0.32].map(v => v * (0.85 + 0.2 * n));
    return { c, b: inB ? 0.45 + 0.35 * SS(0, 6, e) + 0.12 * n : 0.15, r: 0.96 };
  });
  // desert sand, 4 m tile: pale, fine wind ripples, a few pebbles
  const sand = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.015, 231, N), w = tfbm(i, j, 0.03, 232, N), rip = 0.5 + 0.5 * Math.sin(j * 0.32 + w * 9 + i * 0.03), v = voro(i, j, N, 40, 233), peb = 0.6 * SS(0.12, 0.05, v.f1 / v.cs) * SS(0.72, 0.8, v.id); // tiny, sparse pebbles (big ones read as polka dots)
    const c = [0.86, 0.74, 0.54].map(x => x * (0.88 + 0.14 * n) * (0.97 + 0.04 * rip)).map((x, q) => x * (1 - 0.6 * peb) + 0.6 * peb * [0.6, 0.5, 0.4][q]);
    return { c, b: 0.4 + 0.18 * rip + 0.1 * n + 0.3 * peb, r: 0.97 };
  });
  _ET = { core, casing, mud, sand };
  return _ET;
}
let _EM = null;
export function egyptMats() {
  if (_EM) return _EM;
  const t = egyptTex(), R2 = romanMats();
  _EM = { core: std(t.core, { bumpScale: 3 }), casing: std(t.casing, { bumpScale: 0.8 }), mud: std(t.mud, { bumpScale: 3 }), sand: std(t.sand, { bumpScale: 2.5 }),
    wood: R2.woodH, woodV: R2.wood, rope: nileMats().rope, clay: std(t.casing, { color: 0xb8653c, bumpScale: 0.6 }) };
  return _EM;
}
const roundedUnit = new RoundedBoxGeometry(1, 1, 1, 2, 0.04); // instanced blocks: edges rounded, uv per face

const lime = () => egyptMats().core; // v1.4: code-made limestone (was a flat colour with a fabric bump)
// pyramid of `levels` block courses; build(k) shows courses up to k (0..1); casing(k) fades in the smooth white casing
export function pyramid({ base = 46, levels = 20, block = 2.3 } = {}) {
  const g = new THREE.Group(); const M = lime();
  const courses = [];
  const h = base * 0.636 / levels; // Great Pyramid slope ~51.8°
  let count = 0; const spec = [];
  for (let l = 0; l < levels; l++) { const side = base * (1 - l / levels); const n = Math.max(1, Math.round(side / block)); spec.push([l, side, n]); count += n * n - Math.max(0, n - 2) ** 2; }
  const inst = new THREE.InstancedMesh(roundedUnit, M, count); g.add(inst); // rounded blocks, textured limestone
  inst.userData.noGround = true; // stacked courses: the bottom course sits on y = 0 by construction, the rest on each other
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); const R = rng(3);
  let i = 0; const levelStart = [];
  for (const [l, side, n] of spec) {
    levelStart.push(i); const bs = side / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (a > 0 && a < n - 1 && b > 0 && b < n - 1) continue; // only the outer ring of each course (inside hidden)
      m4.compose(new THREE.Vector3(-side / 2 + bs * (a + 0.5), h * (l + 0.5), -side / 2 + bs * (b + 0.5)), q, new THREE.Vector3(bs * 0.97, h * 0.96, bs * 0.97));
      inst.setMatrixAt(i, m4); const v = 0.9 + R() * 0.16; c.setRGB(v, v * (0.97 + R() * 0.04), v * (0.93 + R() * 0.06)); inst.setColorAt(i, c); i++; // near-white tint: each block a little different, texture shows through
    }
  }
  levelStart.push(i);
  // core fill (so the inside never looks hollow from above): stepped solid boxes
  const core = new THREE.Group(); g.add(core);
  const coreM = egyptMats().core;
  const cores = spec.map(([l, side]) => { const b = new THREE.Mesh(worldUV(new THREE.BoxGeometry(side * 0.9, h, side * 0.9), 2.4), coreM); b.position.y = h * (l + 0.5); core.add(b); return b; });
  // smooth casing
  const casM = egyptMats().casing.clone(); casM.transparent = true; casM.opacity = 0; // own copy: casing(k) fades it
  const cas = new THREE.Mesh(worldUV(new THREE.ConeGeometry(base / Math.SQRT2, base * 0.636, 4, 1), 4.8), casM);
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
  const g = new THREE.Group(); const m = egyptMats().mud;
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(len, 0); shape.lineTo(len, rise); shape.lineTo(0, 0);
  const r = new THREE.Mesh(worldUV(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }), 1.44), m); r.position.z = -w / 2; g.add(r);
  return shadowAll(g);
}
// limestone quarry: sunken pit with cut steps and loose blocks
export function quarry() {
  const g = new THREE.Group(); const M = lime();
  for (let i = 0; i < 4; i++) { const s = 14 - i * 3; g.add(block(s, 1.2, s * 0.7, M, { r: 0.06, at: [-i * 0.8, i * 1.2 + 0.6, -i * 0.6] })); }
  const R = rng(9);
  for (let i = 0; i < 9; i++) { const b = block(1.4, 1.0, 1.0, M, { r: 0.05, at: [5 + (R() - 0.5) * 6, 0.5, 6 + (R() - 0.5) * 4] }); b.rotation.y = R(); g.add(b); }
  return shadowAll(g);
}
// Nile cargo barge with a big limestone block
export function barge() {
  const g = new THREE.Group();
  const wood = egyptMats().wood;
  const hullShape = new THREE.Shape(); hullShape.moveTo(-5, 0.6); hullShape.quadraticCurveTo(-4, -0.4, 0, -0.5); hullShape.quadraticCurveTo(4, -0.4, 5, 0.9); hullShape.lineTo(-5, 0.9);
  const hull = new THREE.Mesh(worldUV(new THREE.ExtrudeGeometry(hullShape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }), 1.2), wood); hull.position.z = -1.1; g.add(hull);
  g.add(block(1.8, 1.2, 1.4, lime(), { r: 0.05, at: [0, 1.4, 0] }));
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
// world-scale UVs on a builder's textured meshes (geometry in its own units, scaled by the mesh's scale)
function uvAll(g, tile) {
  const M = egyptMats(), tiled = new Set([M.core, M.casing, M.mud, M.sand, M.wood, M.woodV]);
  g.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !tiled.has(o.material) || o.userData.uvDone) return;
    o.geometry = o.geometry.clone(); const sc = new THREE.Matrix4().makeScale(o.scale.x, o.scale.y, o.scale.z);
    o.geometry.applyMatrix4(sc); worldUV(o.geometry, tile); o.geometry.applyMatrix4(sc.invert()); o.userData.uvDone = true; });
}
// a rope loop hugging a box's cross-section (in the y-z plane at x): a rounded rectangle, half-sizes hy, hz, corner radius rc
function ropeLoop(x, yc, hy, hz, rc) {
  const pts = []; const corner = (cy, cz, a0) => { for (let k = 0; k <= 4; k++) { const a = a0 + k * Math.PI / 8; pts.push(new THREE.Vector3(x, yc + cy + Math.sin(a) * rc, cz + Math.cos(a) * rc)); } };
  corner(hy - rc, hz - rc, 0); corner(hy - rc, -hz + rc, Math.PI / 2); corner(-hy + rc, -hz + rc, Math.PI); corner(-hy + rc, hz - rc, Math.PI * 1.5);
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.016, 6, true), egyptMats().rope);
}
// wooden sledge carrying a block, with rope
export function sledge() {
  const g = new THREE.Group(); const wood = egyptMats().wood;
  for (const s of [-1, 1]) { const run = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.18), wood); run.position.set(0, 0.09, s * 0.5); g.add(run); const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 10, 1, false, 0, Math.PI), wood); tip.rotation.set(Math.PI / 2, 0, -Math.PI / 2); tip.position.set(1.3, 0.2, s * 0.5); g.add(tip); }
  for (let i = 0; i < 4; i++) g.add(block(0.14, 0.12, 1.2, wood, { r: 0.02, tile: 1.2, at: [-1 + i * 0.66, 0.22, 0] }));
  g.add(block(1.6, 1.0, 1.0, lime(), { r: 0.05, at: [0, 0.78, 0] }));
  // rope lashings round the block, tied to the crossbeams
  for (const x of [-0.45, 0.45]) g.add(ropeLoop(x, 0.78, 0.5 + 0.018, 0.5 + 0.018, 0.05));
  return shadowAll(g);
}
// Egyptian worker: white kilt-tunic, headcloth
export function egyptian(i = 0) {
  const h = romanBuilder({ color: [0xf2ece0, 0xe8dcc4, 0xf0e8d8][i % 3], skin: [0xa86a44, 0x9a6040, 0xb87850][i % 3] });
  const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: [0xf2ece0, 0x3a5a8a, 0xd8c890][i % 3], roughness: 0.9 })); cloth.position.set(0, 0.03, -0.02); cloth.scale.set(1.06, 1, 1.12); h.j.head.add(cloth);
  return shadowAll(h.root), h;
}
export function waterJar() {
  const g = new THREE.Group(); const m = egyptMats().clay; // red clay jar: lathe body, neck and rolled rim (origin at the body's centre, as before)
  const pr = [[0.001, -0.175], [0.07, -0.17], [0.13, -0.11], [0.145, -0.02], [0.13, 0.08], [0.085, 0.14], [0.055, 0.17], [0.05, 0.215], [0.062, 0.23], [0.058, 0.245], [0.045, 0.24]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 28), m));
  return shadowAll(g);
}
// Hatnub-style steep quarry ramp: central slope with staircases either side and post holes / posts
export function steepRamp({ len = 14, w = 3, angle = 0.2 } = {}) {
  const g = new THREE.Group(); const rock = egyptMats().core;
  const slope = new THREE.Group(); slope.rotation.z = angle; g.add(slope);
  const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, w), rock); r.position.set(len / 2, -0.2, 0); slope.add(r);
  const wood = egyptMats().woodV;
  const posts = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 18; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(len / 18, 0.25, 1.2), rock); st.position.set((i + 0.5) * len / 18, 0.05 + (i % 2) * 0.04, s * (w / 2 + 0.6)); slope.add(st); }
    for (let i = 0; i < 6; i++) { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: 0x2a2014 })); hole.rotation.x = -Math.PI / 2; hole.position.set(1 + i * 2.2, 0.19, s * (w / 2 + 0.6)); slope.add(hole); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 10), wood); p.position.set(1 + i * 2.2, 0.6, s * (w / 2 + 0.6)); slope.add(p); posts.push(p); }
  }
  const walls = [-1].map(s => { const wl = new THREE.Mesh(new THREE.BoxGeometry(len + 6, 8, 1), rock); wl.position.set(len / 2, 1, s * (w / 2 + 2.2)); slope.add(wl); return wl; });
  g.slope = slope; g.posts = posts;
  uvAll(g, 2.4);
  return shadowAll(g);
}
// workers' tomb: mastaba with doorway and a painted relief panel
export function workerTomb() {
  const g = new THREE.Group(); const mud = egyptMats().mud;
  const m = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 3.4), mud); m.position.y = 1.2; m.geometry.translate(0, 0, 0); g.add(m);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a1e14 })); door.position.set(0, 0.8, 1.71); g.add(door);
  const tex = canvasTex(256, 128, (x) => { x.fillStyle = '#d8c08a'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#4a2a14'; x.lineWidth = 3; for (let i = 0; i < 5; i++) { const px = 20 + i * 48; x.beginPath(); x.arc(px, 40, 7, 0, 7); x.stroke(); x.beginPath(); x.moveTo(px, 47); x.lineTo(px, 85); x.lineTo(px - 8, 115); x.moveTo(px, 85); x.lineTo(px + 8, 115); x.moveTo(px, 60); x.lineTo(px + 16, 52); x.stroke(); } x.fillStyle = '#a83a24'; x.fillRect(0, 0, 256, 8); x.fillRect(0, 120, 256, 8); });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); panel.position.set(1.4 + 0.5, 1.5, 1.705); panel.scale.setScalar(0.7); g.add(panel);
  uvAll(g, 1.44);
  return shadowAll(g);
}
export function nile(scene, { z = 0, w = 30, len = 400 } = {}) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(len, w), flowWaterMaterial({ color: 0x2c4c46, flow: [1, 0], speed: 0.25, scale: 1.6, env: 0.85, ripple: 0.8 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.03, z); scene.add(water);
  const green = new THREE.MeshStandardMaterial({ color: 0x5a7a34, roughness: 1 });
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 8), green); b.rotation.x = -Math.PI / 2; b.position.set(0, 0.025, z + s * (w / 2 + 4)); scene.add(b); }
  return water;
}

// ---------- v1.4: a pyramid work site ----------
// Desert floor (flat over the work area, dunes beyond), a pyramid two-thirds built in the distance with a mud-brick
// ramp up its front face, scattered limestone blocks, a strip of Nile fields with palms off to one side. The sledge
// track runs along -z at x = 0 towards the ramp. 1 unit = 1 m. egyptHeightAt(x, z) is the walkable top.
// the ramp is placed from the pyramid's slope (51.8 deg) so its top meets the front face at its own height
export const ES = { pyr: [-8, -120], base: 46, levels: 20, built: 0.62, ramp: { x: -8, len: 31.5, rise: 8, w: 6 }, fields: -42, flat: { x: 34, z0: -150, z1: 14 } };
ES.ramp.z0 = ES.pyr[1] + ES.base / 2 - ES.ramp.rise / Math.tan(51.8 * Math.PI / 180) + ES.ramp.len;
export function egyptHeightAt(x, z) {
  const ax = Math.max(0, Math.abs(x) - ES.flat.x), az = Math.max(0, z - ES.flat.z1, ES.flat.z0 - z), d = Math.hypot(ax, az); // flat under the work site, pyramid and ramp
  return 3.2 * SS(4, 40, d) * fbm(x * 0.025, z * 0.025, 251, 4) + 0.04 * SS(2, 10, d) * (fbm(x * 0.3, z * 0.3, 252, 3) - 0.5) * (x > ES.fields ? 1 : 0);
}
export function egyptSite({ seed = 4 } = {}) {
  const M = egyptMats(), g = new THREE.Group(), R = rng(seed), props = [], ground = [];
  const sg = new THREE.PlaneGeometry(260, 260, 260, 260); sg.rotateX(-Math.PI / 2);
  { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, egyptHeightAt(p.getX(i), p.getZ(i))); }
  sg.computeVertexNormals(); worldUV(sg, 4); const sand = new THREE.Mesh(sg, M.sand); g.add(sand); ground.push(sand);
  // the pyramid, two-thirds built, and its supply ramp of mud brick up the front face
  const py = pyramid({ base: ES.base, levels: ES.levels }); py.position.set(ES.pyr[0], 0, ES.pyr[1]); py.build(ES.built); g.add(py);
  const rp = constructionRamp(ES.ramp.len, ES.ramp.w, ES.ramp.rise); rp.rotation.y = Math.PI / 2; rp.position.set(ES.ramp.x, 0, ES.ramp.z0); g.add(rp);
  // scattered blocks waiting by the track
  for (let k = 0; k < 7; k++) { const s = R() < 0.5 ? -1 : 1, x = s * (2.6 + R() * 5), z = -2 - R() * 14, w = 1.2 + R() * 0.5, h = 0.8 + R() * 0.3;
    const b = block(w, h, 0.9 + R() * 0.3, M.core, { r: 0.05, at: [x, egyptHeightAt(x, z) + h / 2 - 0.02, z] }); b.rotation.y = (R() - 0.5) * 0.5; g.add(b); props.push(b); }
  // Nile fields and palms off to the left
  const fg = new THREE.PlaneGeometry(40, 120, 1, 1); fg.rotateX(-Math.PI / 2); const fields = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0x5f7a36, roughness: 1 })); fields.position.set(ES.fields - 20.5, 0.01, -20); g.add(fields);
  const gs = []; for (let i = 0; i < 900; i++) { const x = ES.fields - 1 - R() * 30, z = 30 - R() * 110; gs.push([x, 0.0, z, 0.9 + R() * 0.8]); }
  g.add(grass(gs, { h: 0.45, seed: 31, color: 0xd8f0b0 }));
  for (let k = 0; k < 9; k++) { const p = palm(6 + R() * 4, k + 3); p.position.set(ES.fields - 3 - R() * 16, 0, -4 - R() * 40); g.add(p); props.push(p);
    p.traverse(o => { if (o.isInstancedMesh) o.userData.noGround = true; }); } // crowns sway about the trunk top, so their origin is up there; the trunk is checked as a prop
  // a few dry tufts on the work site's edges
  const ts = []; for (let i = 0; i < 70; i++) { const x = (R() < 0.5 ? -1 : 1) * (6 + R() * 10), z = 6 - R() * 40; ts.push([x, egyptHeightAt(x, z) - 0.005, z, 0.4 + R() * 0.4]); }
  g.add(grass(ts, { h: 0.25, seed: 33, color: 0xe8d8a0 }));
  shadowAll(g); fields.castShadow = false;
  g.updateMatrixWorld(true); const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
  const groundAt = (x, z) => { for (const m of ground) m.updateMatrixWorld(); rc.set(new THREE.Vector3(x, 40, z), DOWN); const h = rc.intersectObjects(ground, false)[0]; return h ? h.point.y : egyptHeightAt(x, z); };
  g.userData = { ground, props, heightAt: egyptHeightAt, groundAt, pyramid: py };
  return g;
}
// an Egyptian worker: the v1.1 character in a white linen kilt and a cloth head cover (the cap drawn as pale linen)
export function egyptWorker(i = 0) {
  return toon({ skin: [0x8a5232, 0x7a4628, 0x93593a][i % 3], cloth: [0xf0e8d6, 0xe8dcc4, 0xf2ecde][i % 3], belt: [0xb08a50, 0x8a3a24, 0x6a7a9a][i % 3], hair: [0xece4d0, 0x2a1e16, 0xe4dac4][i % 3], seed: i, hairStyle: i % 3 === 1 ? 'crop' : 'headcloth' }); // a linen headcloth, or short hair
}
