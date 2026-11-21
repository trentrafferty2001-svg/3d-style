// Indus city set (3d-style v1.3): a Mohenjo-daro lane, c. 2500 BC. Fired-brick walls in English bond, a packed-earth
// street with a covered brick drain along it (one cover lifted to show the water), a terracotta pipe from an upper
// floor down into the drain, small doorways and beam ends, a junction with a round brick well, painted pots, a pipal
// tree over the walls. 1 unit = 1 m. Built from the same tools as roman.js (tileable code-made textures, world-scale
// UVs, rounded blocks, settle) and placed on the real ground.
import * as THREE from 'three';
import { fbm, rng, grass, mats as nileMats } from './nile.js';
import { waterMaterial, TIME } from './world.js';
import { toon } from './toon.js';
import { triTex, tfbm, voro, courses, jointDist, h2, std, worldUV, block, settle, smoothstepAB as SS, instanced, leafMat, oliveGeo, oliveTrunk } from './roman.js';

const shadowAll = (o) => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// ---------- textures ----------
let _IT = null;
function indusTex() {
  if (_IT) return _IT;
  const N = 512;
  // fired brick in English bond, 1.12 m x 1.2 m tile: 16 courses of 7.5 cm, stretcher courses (28 cm bricks) alternate
  // with header courses (14 cm, centred on the joints below); thin mud mortar, worn edges, a little salt bloom
  const ch = N / 16;
  const bondRows = [...Array(16)].map((_, r) => r % 2 === 0 ? [0, 128, 256, 384] : [...Array(8)].map((_, k) => 32 + k * 64));
  const brick = triTex(N, (i, j) => {
    const row = Math.floor(j / ch), y = j - row * ch, [dx, k] = jointDist(bondRows[row], i, N);
    const inB = y > 2.5 && y < ch - 2.5 && dx > 2, e = Math.min(y - 2.5, ch - 2.5 - y, dx - 2);
    const hue = h2(row, k, 7), n = tfbm(i, j, 0.09, 101, N), wear = SS(0.55, 0.8, tfbm(i, j, 0.03, 102, N));
    const salt = SS(0.68, 0.8, tfbm(i, j * 0.5, 0.012, 103, N)) * 0.35;
    let c = inB ? [0.54 + 0.1 * hue, 0.36 + 0.06 * hue, 0.27 + 0.04 * hue].map(v => v * (0.84 + 0.22 * n) * (1 - 0.12 * wear)) // muted brownish-red fired brick
      : [0.5, 0.4, 0.3].map(v => v * (0.85 + 0.2 * n));
    c = c.map(v => v * (1 - salt) + 0.86 * salt);
    return { c, b: inB ? 0.45 + 0.45 * SS(0, 2.5 + 3 * wear, e) + 0.1 * n : 0.12 + 0.1 * n, r: inB ? 0.86 + 0.1 * n : 0.97 };
  });
  // packed earth street, 4 m tile: trodden, a few potsherds and pebbles
  const earth = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.02, 111, N), m = tfbm(i, j, 0.14, 112, N), v = voro(i, j, N, 28, 113);
    // small pebbles only, close to the earth colour (big coloured sherds read as polka dots in a close-up)
    const peb = SS(0.22, 0.12, v.f1 / v.cs) * SS(0.55, 0.65, v.id);
    const base = [0.66, 0.53, 0.38].map(x => x * (0.82 + 0.24 * n + 0.07 * m));
    const c = base.map((x, q) => x * (1 - 0.6 * peb) + 0.6 * peb * [0.52, 0.47, 0.4][q] * (0.85 + 0.3 * v.id));
    return { c, b: 0.4 + 0.2 * m + 0.35 * peb, r: 0.95 };
  });
  // mud plaster (grey multiplier, the colour comes from the material)
  const plaster = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.03, 121, N), st = SS(0.5, 0.85, tfbm(i, j * 0.3, 0.015, 122, N)), v = voro(i, j, N, 6, 123), cr = SS(1.4, 0, v.f2 - v.f1) * SS(0.5, 0.7, tfbm(i, j, 0.02, 124, N));
    const g = (0.9 + 0.1 * n) * (1 - 0.15 * st) * (1 - 0.3 * cr); return { c: [g, g, g], b: 0.6 + 0.08 * n - 0.3 * cr, r: 0.93 };
  });
  // red-slipped terracotta with black painted bands (u around, v up), for pots
  const pot = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); const r = rng(131);
    x.fillStyle = '#a4442a'; x.fillRect(0, 0, 512, 256);
    for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(60,20,10,${r() * 0.18})`; x.fillRect(r() * 512, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    x.fillStyle = '#1e140f'; for (const [y, h] of [[58, 10], [74, 4], [150, 6]]) x.fillRect(0, y, 512, h);
    x.strokeStyle = '#1e140f'; x.lineWidth = 3; for (let k = 0; k < 16; k++) { x.beginPath(); x.arc(k * 32 + 16, 112, 12, 0, Math.PI * 2); x.stroke(); } // intersecting-circle band
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  _IT = { brick, earth, plaster, pot };
  return _IT;
}
let _IM = null;
export function indusMats() {
  if (_IM) return _IM;
  const t = indusTex();
  _IM = {
    brick: std(t.brick, { bumpScale: 3 }), earth: std(t.earth, { bumpScale: 2.5 }), plaster: std(t.plaster, { color: 0xb08a64, bumpScale: 1.5 }),
    pot: new THREE.MeshStandardMaterial({ map: t.pot, roughness: 0.75 }),
    terracotta: std(t.plaster, { color: 0xc06a42, bumpScale: 1 }),
    wood: nileMats().wood, dark: new THREE.MeshStandardMaterial({ color: 0x2e2218, roughness: 1 }), stone: std(t.plaster, { color: 0xa69a88, bumpScale: 2 }),
  };
  return _IM;
}
// UVs around a cylinder or lathe: u along the circumference (m), v up (m), so bricks keep their size on a round well
function cylUV(geo, tile) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); uv[i * 2] = Math.atan2(x, z) * Math.max(r, 0.3) / tile; uv[i * 2 + 1] = p.getY(i) / tile; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
// Indus storage jar: red slip, black bands, a rolled rim
export function indusPot(h = 0.6, seed = 1) {
  const R = rng(seed), w = 0.85 + R() * 0.3;
  const pr = [[0.001, 0], [0.12, 0.005], [0.2, 0.08], [0.26, 0.28], [0.25, 0.45], [0.18, 0.6], [0.12, 0.68], [0.115, 0.74], [0.135, 0.77], [0.13, 0.8], [0.1, 0.8]].map(([r, y]) => new THREE.Vector2(r * w * h / 0.8, y * h / 0.8));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pr, 36), indusMats().pot); return shadowAll(m);
}

// ---------- the lane ----------
// x runs along the lane. Lane between walls at |z| < 1.65 (packed earth, slight crown); a covered drain along z = -1.0
// (channel 0.26 wide, 0.3 deep, covers flush with the street, one lifted at x = 0); a junction with a well square on the
// far side at x 5.4 .. 9; houses of fired brick 5-7 m tall on both sides with doorways, small windows and beam ends.
export const IS = { half: 1.65, drainZ: -1.0, drainW: 0.26, wallT: 0.7, X: 16, sq: [5.4, 9.0], sqZ: -6.2, well: [7.2, -3.9], gapX: 0 };
const earthY = (x, z) => 0.025 * (1 - Math.min(1, (z / IS.half) ** 2)) + 0.01 * (fbm(x * 0.6, z * 0.6, 141, 3) - 0.5);
export function indusHeightAt(x, z) {
  if (z <= -IS.half && x > IS.sq[0] && x < IS.sq[1] && z > IS.sqZ) return 0.0; // the well square
  if (Math.abs(z - IS.drainZ) < 0.25) return 0.035;                            // drain covers / drain walls
  return earthY(x, z);
}
export function indusSite({ seed = 2 } = {}) {
  const M = indusMats(), g = new THREE.Group(), R = rng(seed), props = [], ground = [], X = IS.X, H = IS.half, dz = IS.drainZ, dw = IS.drainW;
  // base earth everywhere (under and beyond)
  const base = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(120, 120, 1, 1).rotateX(-Math.PI / 2), 4), M.earth); base.position.y = -0.4; g.add(base);
  // street in two strips either side of the drain, displaced to earthY
  const strip = (z0, z1) => { const gg = new THREE.PlaneGeometry(2 * X + 2, z1 - z0, 160, 24); gg.rotateX(-Math.PI / 2); gg.translate(0, 0, (z0 + z1) / 2);
    const p = gg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, earthY(p.getX(i), p.getZ(i))); gg.computeVertexNormals(); worldUV(gg, 4);
    const m = new THREE.Mesh(gg, M.earth); g.add(m); ground.push(m); };
  strip(-H, dz - dw / 2 - 0.12); strip(dz + dw / 2 + 0.12, H);
  // drain: brick side walls (top flush), brick floor, flowing water, covers (one lifted, leaning on the wall)
  for (const s of [-1, 1]) { const w = block(2 * X + 2, 0.36, 0.12, M.brick, { r: 0.01, tile: 1.2, at: [0, 0.035 - 0.18, dz + s * (dw / 2 + 0.06)] }); g.add(w); ground.push(w); }
  g.add(block(2 * X + 2, 0.06, dw + 0.02, M.brick, { r: 0.005, tile: 1.2, at: [0, -0.33, dz] }));
  // water runs high in the channel so it shows through the open cover (lower down it sat in shadow below the sight line)
  const WL = -0.1, wm = waterMaterial({ color: 0x5a6a55, opacity: 1, ripple: 1.4 }); wm.roughness = 0.1;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * X + 2, dw, 1, 1).rotateX(-Math.PI / 2), wm); water.position.set(0, WL, dz); g.add(water);
  const cw = 0.52, gap = [IS.gapX - cw / 2, IS.gapX + cw / 2];
  for (let x = -X - 1 + cw / 2; x < X + 1; x += cw) {
    if (Math.abs(x - IS.gapX) < cw / 2) continue;
    const c = block(cw - 0.015, 0.07, dw + 0.22, M.stone, { r: 0.012, tile: 1.2, at: [x, 0.035 - 0.035 + (h2(Math.round(x * 10), 1, 5) - 0.5) * 0.006, dz] }); g.add(c); ground.push(c);
  }
  // the exact ground (raycast on what is rendered) for everything placed from here on
  g.updateMatrixWorld(true); const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
  // refresh matrices first: a mesh added to `ground` after the last updateMatrixWorld raycasts as if it sat at the origin
  const groundAt = (x, z) => { for (const m of ground) m.updateMatrixWorld(); rc.set(new THREE.Vector3(x, 30, z), DOWN); const h = rc.intersectObjects(ground, false)[0]; return h ? h.point.y : indusHeightAt(x, z); };
  // the lifted cover stands on its edge, its top leaning back against the wall
  { const c = block(cw - 0.015, 0.07, dw + 0.22, M.stone, { r: 0.012, tile: 1.2 }); c.rotation.set(0, 0.06, 0); c.rotateX(1.32); c.position.set(gap[1] + 0.45, 0, -H + 0.11); settle(c, Math.min(groundAt(gap[1] + 0.3, -H + 0.16), groundAt(gap[1] + 0.6, -H + 0.16)) - 0.004); g.add(c); props.push(c); }
  // houses: segments of brick wall on both sides; the far side opens onto the well square
  const doorAt = [], house = (x0, x1, side, h) => {
    const L = x1 - x0, zc = side * (H + IS.wallT / 2), w = block(L, h, IS.wallT, M.brick, { r: 0.02, tile: 1.2, at: [(x0 + x1) / 2, h / 2 - 0.05, zc] }); g.add(w);
    g.add(block(L + 0.04, 0.16, IS.wallT + 0.06, M.brick, { r: 0.02, tile: 1.2, at: [(x0 + x1) / 2, h + 0.03, zc] })); // coping course
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.62) g.add(block(0.13, 0.13, 0.22, M.wood, { r: 0.01, tile: 1.2, at: [x, 3.1, side * (H - 0.08)] })); // floor-beam ends
    if (L > 4) { const dx = x0 + 1.2 + R() * (L - 2.6); doorAt.push([dx, side]);
      g.add(block(0.95, 1.95, 0.08, M.dark, { r: 0.004, at: [dx, 0.95, side * (H + 0.02)] }));
      g.add(block(1.2, 0.14, 0.2, M.wood, { r: 0.01, tile: 1.2, at: [dx, 2.0, side * (H - 0.06)] }));
      g.add(block(0.5, 0.36, 0.06, M.dark, { r: 0.004, at: [dx + (R() < 0.5 ? -1 : 1) * 1.6, 4.2, side * (H + 0.005)] })); }
  };
  for (const side of [-1, 1]) { let x = -X - 1;
    while (x < X + 1) { const L = 5 + R() * 3.5; let x1 = Math.min(X + 1, x + L);
      if (side < 0 && x < IS.sq[1] && x1 > IS.sq[0]) { house(x, IS.sq[0], side, 5 + R() * 2); x = IS.sq[1]; continue; }
      house(x, x1, side, 5 + R() * 2); x = x1 + 0.02; } }
  // a house across the far end closes the view down the lane
  g.add(block(IS.wallT, 6.2, 2 * H + 2 * IS.wallT, M.brick, { r: 0.02, tile: 1.2, at: [-X - 1 - IS.wallT / 2, 3.05, 0] }));
  // the well square: brick paving, side and back walls, the well, pots
  const sqW = IS.sq[1] - IS.sq[0], sqC = (IS.sq[0] + IS.sq[1]) / 2, sqD = -H - IS.sqZ;
  const pav = block(sqW, 0.3, sqD, M.brick, { r: 0.005, tile: 1.2, at: [sqC, -0.15, -H - sqD / 2] }); g.add(pav); ground.push(pav);
  for (const sx of [IS.sq[0] - 0.35, IS.sq[1] + 0.35]) g.add(block(IS.wallT, 5.6, sqD + 0.7, M.brick, { r: 0.02, tile: 1.2, at: [sx, 2.75, -H - sqD / 2 - 0.35] }));
  g.add(block(sqW + 1.4, 5.2, IS.wallT, M.brick, { r: 0.02, tile: 1.2, at: [sqC, 2.55, IS.sqZ - IS.wallT / 2] }));
  { const [wx, wz] = IS.well, ro = 0.78, ri = 0.55, hh = 0.62;
    const sh = new THREE.Shape(); sh.absarc(0, 0, ro, 0, Math.PI * 2); const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, Math.PI * 2, true); sh.holes.push(hole);
    const wg = new THREE.ExtrudeGeometry(sh, { depth: hh, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 48 }); wg.rotateX(-Math.PI / 2); cylUV(wg, 1.2);
    const well = new THREE.Mesh(wg, M.brick); well.position.set(wx, 0, wz); g.add(well); props.push(well);
    const inside = new THREE.Mesh(new THREE.CircleGeometry(ri, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.2 })); inside.position.set(wx, hh - 0.9, wz); g.add(inside);
    const shaft = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(ri, ri, 0.9, 40, 1, true), 1.2), new THREE.MeshStandardMaterial({ map: M.brick.map, color: 0x6a5a4a, roughness: 1, side: THREE.BackSide })); shaft.position.set(wx, hh - 0.45, wz); g.add(shaft);
    for (const [ox, oz, h, s] of [[1.15, 0.35, 0.62, 3], [1.0, -0.55, 0.5, 4], [-1.25, 0.6, 0.56, 5]]) { const p = indusPot(h, s); p.position.set(wx + ox, 0, wz + oz); p.rotation.y = R() * 6; settle(p, 0.0); g.add(p); props.push(p); } }
  // a pipal tree behind the square's back wall
  { const tx = sqC + 0.6, tz = IS.sqZ - 2.6; const tr = oliveTrunk(seed + 7, M.wood); tr.scale.set(1.6, 1.9, 1.6); tr.position.set(tx, -0.4, tz); g.add(tr);
    const leaves = instanced(oliveGeo(seed + 8), leafMat(0.002, 1.0), [[tx, -0.4 + 2.4, tz, 1.8, 0.3]], { amp: 0.002, freq: 1.0 }); g.add(leaves); }
  // terracotta pipe from an upper floor down the wall, bending out over the open drain; a thin stream falls from it
  { const px = IS.gapX, wz = -H + 0.1;
    const curve = new THREE.CatmullRomCurve3([[px, 3.6, -H - 0.3], [px, 3.45, wz], [px, 3.2, wz], [px, 0.55, wz], [px, 0.34, wz + 0.06], [px, 0.3, dz - 0.04]].map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
    const pg = new THREE.TubeGeometry(curve, 80, 0.07, 16, false); const pipe = new THREE.Mesh(pg, M.terracotta); g.add(pipe);
    for (let k = 0.08; k < 0.97; k += 0.16) { const p = curve.getPointAt(k), tg = curve.getTangentAt(k); const col = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.014, 8, 24), M.terracotta); col.position.copy(p); col.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); g.add(col); }
    const sw = waterMaterial({ color: 0x8a9a8a, opacity: 1, ripple: 2.5 }); sw.roughness = 0.1;
    // the stream: thin, pale and partly see-through, wavering a little (vertex wobble driven by time)
    const sm = new THREE.MeshStandardMaterial({ color: 0xcfe0d8, roughness: 0.12, transparent: true, opacity: 0.42, depthWrite: false });
    sm.customProgramCacheKey = () => 'indusStream';
    sm.onBeforeCompile = (sh) => { sh.uniforms.uTime = TIME; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n float fall = 0.2 - position.y; transformed.x += sin(uTime * 23.0 + position.y * 31.0) * 0.004 * fall; transformed.z += sin(uTime * 17.0 + position.y * 27.0 + 1.3) * 0.003 * fall;'); };
    // a parabola from just inside the mouth's lower lip (water leaves along the pipe, +z, then falls) down into the water
    const y0 = 0.3 - 0.045, z0 = dz - 0.07, v0 = 0.45, T = Math.sqrt(2 * (y0 - WL + 0.01) / 9.8), arc = [];
    for (let i = 0; i <= 16; i++) { const tt = T * i / 16; arc.push(new THREE.Vector3(px, y0 - 4.9 * tt * tt, z0 + v0 * tt)); }
    const stream = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 32, 0.011, 10, false), sm); stream.castShadow = false; g.add(stream);
    void sw; }
  // weeds along the wall bases and in the square's corners
  const gs = [];
  for (let i = 0; i < 160; i++) { const x = (R() - 0.5) * 2 * X, side = R() < 0.5 ? -1 : 1, z = side * (H - 0.06 - R() * 0.12); if (side < 0 && Math.abs(x - IS.gapX) < 0.8) continue; gs.push([x, groundAt(x, z) - 0.005, z, 0.35 + R() * 0.4]); }
  for (let i = 0; i < 30; i++) { const x = IS.sq[0] + 0.1 + R() * (sqW - 0.2), z = IS.sqZ + 0.1 + R() * 0.25; gs.push([x, -0.005, z, 0.3 + R() * 0.3]); }
  g.add(grass(gs, { h: 0.26, seed: 21, color: 0xc8c090 }));
  shadowAll(g); water.castShadow = false; base.castShadow = false;
  g.userData = { ground, props, heightAt: indusHeightAt, groundAt, doors: doorAt };
  return g;
}

// an Indus worker: the v1.1 character in a wrapped cotton cloth (the kilt outfit), off-white by default
export function indusWorker({ skin = 0x7e4a2e, color = 0xe8dcc0, belt = 0x8a5a3a, hair = 0x1e1612 } = {}) { return toon({ skin, cloth: color, belt, hair }); }
