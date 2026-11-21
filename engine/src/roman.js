// Roman set v2 (3d-style v1.2): materials with real detail, fluted columns, rounded blocks, and a Roman street set
// (romanSite) with basalt paving, kerbs, a portico, insula walls, an olive tree, cypresses and umbrella pines in the
// wind, amphorae and grass, all placed on the real ground surface. 1 unit = 1 m. rome.js keeps its old API and uses
// these materials and columns.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, rng, grass, windMaterial, windDepth, mats as nileMats } from './nile.js';
import { toon } from './toon.js';

const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const shadowAll = (o) => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// ---------- tileable texture helpers ----------
// tfbm: fbm that wraps every N pixels (blend of four offsets), so textures tile without seams
function tfbm(i, j, sc, seed, N, oct = 4) {
  const u = i / N, v = j / N;
  return fbm(i * sc, j * sc, seed, oct) * (1 - u) * (1 - v) + fbm((i - N) * sc, j * sc, seed, oct) * u * (1 - v)
    + fbm(i * sc, (j - N) * sc, seed, oct) * (1 - u) * v + fbm((i - N) * sc, (j - N) * sc, seed, oct) * u * v;
}
const h2 = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
// one pass, three textures: fn(i, j) -> { c: [r,g,b] 0..1 (sRGB), b: bump 0..1, r: roughness 0..1 }
function triTex(N, fn, repeat = [1, 1]) {
  const cv = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = N; return c; });
  const im = cv.map(c => c.getContext('2d').createImageData(N, N));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const o = fn(i, j), k = (j * N + i) * 4;
    im[0].data[k] = o.c[0] * 255; im[0].data[k + 1] = o.c[1] * 255; im[0].data[k + 2] = o.c[2] * 255;
    im[1].data[k] = im[1].data[k + 1] = im[1].data[k + 2] = clamp01(o.b) * 255;
    im[2].data[k] = im[2].data[k + 1] = im[2].data[k + 2] = clamp01(o.r) * 255;
    im[0].data[k + 3] = im[1].data[k + 3] = im[2].data[k + 3] = 255;
  }
  return cv.map((c, n) => {
    c.getContext('2d').putImageData(im[n], 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
    t.colorSpace = n === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
  });
}
// tileable jittered-grid voronoi: nearest and second-nearest distance (px) and the nearest cell's id
function voro(i, j, N, G, seed) {
  const cs = N / G, gx = Math.floor(i / cs), gy = Math.floor(j / cs); let f1 = 1e9, f2 = 1e9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = gx + ox, cy = gy + oy, wx = ((cx % G) + G) % G, wy = ((cy % G) + G) % G;
    const px = (cx + 0.15 + 0.7 * h2(wx, wy, seed)) * cs, py = (cy + 0.15 + 0.7 * h2(wx, wy, seed + 9)) * cs;
    const d = Math.hypot(i - px, j - py); if (d < f1) { f2 = f1; f1 = d; id = h2(wx, wy, seed + 3); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id, cs };
}
// rows of blocks of random length that wrap at N: returns the joints of every row
function courses(N, rows, minL, maxL, seed) {
  const r = rng(seed); return [...Array(rows)].map(() => { const xs = [Math.floor(r() * N)]; let x = xs[0];
    for (;;) { const l = minL + r() * (maxL - minL); if (x + l > xs[0] + N - minL * 0.7) break; x += l; xs.push(Math.floor(x)); } return xs; });
}
// distance (px) from column i to the nearest joint in a row, and which block of the row it is in
function jointDist(xs, i, N) {
  const ii = i < xs[0] ? i + N : i; let k = 0; while (k + 1 < xs.length && xs[k + 1] <= ii) k++;
  const next = k + 1 < xs.length ? xs[k + 1] : xs[0] + N; return [Math.min(ii - xs[k], next - ii), k];
}

let _RT = null;
function romanTex() {
  if (_RT) return _RT;
  const N = 512;
  // travertine ashlar, 2.4 m tile, 6 courses of 40 cm: chamfered joints, horizontal pores, weathering streaks
  const AR = courses(N, 6, 110, 300, 5), ach = N / 6;
  const ashlar = triTex(N, (i, j) => {
    const row = Math.floor(j / ach), y = j - row * ach, [dx, k] = jointDist(AR[row], i, N);
    const d = Math.min(dx, y, ach - y), tone = 0.9 + 0.16 * h2(row, k, 2) - 0.08;
    const pore = SS(0.66, 0.74, tfbm(i * 0.6, j * 2.2, 0.06, 7, N)) * SS(0.3, 0.6, tfbm(i, j, 0.02, 8, N));
    const streak = SS(0.45, 0.75, tfbm(i, j, 0.004, 9, N) * 0.5 + tfbm(i, j * 0.08, 0.05, 10, N) * 0.5);
    const n = tfbm(i, j, 0.05, 11, N), joint = d < 2.2, ch = SS(2, 7, d);
    const c = joint ? [0.62, 0.57, 0.49] : [0.86 * tone, 0.79 * tone, 0.66 * tone].map(v => v * (0.93 + 0.12 * n) * (1 - 0.13 * streak) * (1 - 0.35 * pore) * (0.9 + 0.1 * ch));
    return { c, b: joint ? 0.05 : 0.2 + 0.7 * ch + 0.1 * n - 0.4 * pore, r: joint ? 1 : 0.82 + 0.12 * n + 0.1 * pore };
  });
  // Roman brick (opus testaceum), 1.2 m tile: thin red bricks, thick mortar beds
  const BR = courses(N, 16, 110, 210, 13), bch = N / 16;
  const brick = triTex(N, (i, j) => {
    const row = Math.floor(j / bch), y = j - row * bch, [dx, k] = jointDist(BR[row], i, N);
    const inBrick = y > 5 && y < bch - 6 && dx > 3, e = Math.min(y - 5, bch - 6 - y, dx - 3), hue = h2(row, k, 4), n = tfbm(i, j, 0.08, 14, N);
    const c = inBrick ? [0.6 + 0.12 * hue, 0.3 + 0.08 * hue, 0.19 + 0.04 * hue].map(v => v * (0.88 + 0.2 * n) * (1 - 0.15 * SS(0.55, 0.8, tfbm(i, j, 0.01, 15, N))))
      : [0.72, 0.67, 0.58].map(v => v * (0.85 + 0.2 * n));
    return { c, b: inBrick ? 0.55 + 0.35 * SS(0, 3, e) + 0.1 * n : 0.15 + 0.15 * n, r: inBrick ? 0.85 + 0.1 * n : 0.97 };
  });
  // basalt paving (polygonal "via" stones), 2.4 m tile: worn smooth tops, dark joints with a little soil
  const basalt = triTex(N, (i, j) => {
    const v = voro(i, j, N, 6, 21), edge = v.f2 - v.f1, n = tfbm(i, j, 0.06, 22, N), m = tfbm(i, j, 0.25, 23, N);
    const joint = edge < 3.5, wear = 1 - SS(0.0, 0.75, v.f1 / v.cs);
    const t = 0.78 + 0.4 * v.id;
    const c = joint ? [0.33, 0.28, 0.22].map(x => x * (0.8 + 0.3 * n)) : [0.29 * t, 0.3 * t, 0.32 * t].map(x => x * (0.85 + 0.25 * n + 0.12 * wear) + 0.03 * (m - 0.5));
    return { c, b: joint ? 0 : 0.45 + 0.4 * SS(3.5, 12, edge) * (0.6 + 0.4 * wear) + 0.1 * m, r: joint ? 1 : 0.62 - 0.22 * wear + 0.15 * m };
  });
  // marble / white stucco: faint warm veins
  const marble = triTex(N, (i, j) => {
    const w = tfbm(i, j, 0.012, 31, N), v = Math.abs(Math.sin((i + j * 0.4) * 0.0123 * Math.PI * 2 + w * 9)), vein = SS(0.08, 0.0, v) * 0.5 + SS(0.25, 0.0, v) * 0.15;
    const n = tfbm(i, j, 0.04, 32, N); const c = [0.93, 0.9, 0.84].map((x, q) => x * (0.95 + 0.06 * n) - vein * [0.18, 0.18, 0.15][q]);
    return { c, b: 0.5 + 0.08 * n, r: 0.38 + 0.12 * n + 0.1 * vein };
  });
  // plaster: grey multiplier (the colour comes from the material), stains, hairline cracks, a few patches fallen off
  const plaster = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.03, 41, N), st = SS(0.5, 0.85, tfbm(i, j * 0.3, 0.015, 42, N)), v = voro(i, j, N, 5, 43), crack = SS(1.6, 0, v.f2 - v.f1) * SS(0.55, 0.7, tfbm(i, j, 0.02, 44, N));
    const g = (0.9 + 0.1 * n) * (1 - 0.18 * st) * (1 - 0.35 * crack); // (no fallen-plaster patches: at this size they read as red specks)
    return { c: [g, g, g], b: 0.6 + 0.06 * n - 0.3 * crack, r: 0.9 + 0.08 * n };
  });
  // wooden planks, 1.2 m tile: 6 boards with grain
  const wood = triTex(N, (i, j) => {
    const bw = N / 6, b = Math.floor(i / bw), x = i - b * bw, gap = x < 2, s = h2(b, 0, 51), g = tfbm(i * 3.2, j * 0.08, 0.06, 52 + b, N);
    const ring = 0.5 + 0.5 * Math.sin((x * 0.35 + g * 14) + s * 6), t = 0.85 + 0.25 * s;
    const c = gap ? [0.18, 0.12, 0.07] : [0.52 * t, 0.36 * t, 0.22 * t].map(v => v * (0.82 + 0.22 * ring));
    // shallow gaps and no glossy wood: a steep gap bump on a rounded edge made a row of sun glints that DOF blew into discs
    return { c, b: gap ? 0.38 : 0.5 + 0.12 * ring, r: gap ? 1 : 0.86 + 0.1 * ring };
  });
  // terracotta roof tiles along +u: flat tegulae with rounded imbrices over the joints, overlapping rows along +v
  const roof = triTex(N, (i, j) => {
    const cw = N / 6, x = (i % cw) / cw, row = Math.floor(j / (N / 5)), y = (j % (N / 5)) / (N / 5), col = Math.floor(i / cw);
    const imb = Math.max(0, Math.cos((x - 0.5) * Math.PI / 0.28)) * (Math.abs(x - 0.5) < 0.14 ? 1 : 0), tone = 0.85 + 0.25 * h2(col, row, 61), n = tfbm(i, j, 0.05, 62, N);
    const lap = SS(0.0, 0.08, y), lip = SS(0.92, 1, y);
    const c = [0.66 * tone, 0.33 * tone, 0.2 * tone].map(v => v * (0.75 + 0.3 * imb) * (0.55 + 0.45 * lap) * (0.9 + 0.15 * n) * (1 - 0.2 * lip));
    return { c, b: 0.3 + 0.6 * imb + 0.1 * lap, r: 0.82 + 0.1 * n };
  });
  // dusty ground, 4 m tile: light earth, darker patches, small stones
  const dirt = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.02, 71, N), m = tfbm(i, j, 0.12, 72, N), v = voro(i, j, N, 24, 73), stone = SS(0.42, 0.3, v.f1 / v.cs) * SS(0.6, 0.75, v.id);
    const c = [0.62, 0.52, 0.38].map(x => x * (0.82 + 0.25 * n + 0.08 * m) * (1 - 0.18 * SS(0.6, 0.8, n))).map((x, q) => x * (1 - stone) + stone * [0.55, 0.52, 0.47][q] * (0.8 + 0.3 * v.id));
    return { c, b: 0.4 + 0.25 * m + 0.35 * stone, r: 0.95 - 0.1 * stone };
  });
  _RT = { ashlar, brick, basalt, marble, plaster, wood, roof, dirt };
  return _RT;
}
const std = ([map, bump, rough], o = {}) => new THREE.MeshStandardMaterial({ map, bumpMap: bump, roughnessMap: rough, roughness: 1, bumpScale: 2, ...o });
let _RM = null;
export function romanMats() {
  if (_RM) return _RM;
  const t = romanTex();
  _RM = {
    stone: std(t.ashlar, { bumpScale: 2.5 }), brick: std(t.brick, { bumpScale: 3 }), basalt: std(t.basalt, { bumpScale: 3.5 }),
    marble: std(t.marble, { bumpScale: 0.6 }), wood: std(t.wood, { bumpScale: 1.5 }), roof: std(t.roof, { bumpScale: 4 }),
    woodH: std(t.wood.map(x => { const c = x.clone(); c.center.set(0.5, 0.5); c.rotation = Math.PI / 2; c.needsUpdate = true; return c; }), { bumpScale: 1.5 }), // grain along x: horizontal boards
    dirt: std(t.dirt, { bumpScale: 2.5 }),
    plaster: (color) => std(t.plaster, { color, bumpScale: 1.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 }), // a dim interior, not a black hole
    bronze: new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.45, metalness: 0.7 }),
  };
  return _RM;
}

// ---------- geometry helpers ----------
// world-scale UVs: each vertex takes the two coordinates across its main normal axis, divided by the tile size (m), so a
// texture keeps its real size on blocks of any shape (no stretching between a kerb and a wall)
export function worldUV(geo, tile = 2.4, off = [0, 0, 0]) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2], ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo;
}
// a stone block with rounded edges (radius r), world-scale UVs from its position so neighbouring blocks don't repeat
export function block(w, h, d, mat, { r = 0.02, tile = 2.4, at = [0, 0, 0] } = {}) {
  const g = worldUV(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), tile, at);
  const m = new THREE.Mesh(g, mat); m.position.set(...at); return m;
}
// column: Attic base (torus, scotia, torus) on a square plinth, a fluted shaft with entasis, Tuscan capital and abacus.
// Origin at the bottom of the plinth; total height h.
export function column2(h, r, mat, { flutes = 20, plinth = true } = {}) {
  const g = new THREE.Group(); const pl = plinth ? r * 0.36 : 0;
  if (plinth) g.add(block(r * 2.8, pl, r * 2.8, mat, { r: 0.012, tile: 1.2, at: [0, pl / 2, 0] }));
  const hb = r * 0.55, hc = r * 0.7, hs = h - pl - hb - hc;
  // base + shaft + capital as one lathe (bottom -> top), flutes cut into the shaft only
  const prof = [];
  const add = (rr, y) => prof.push(new THREE.Vector2(Math.max(1e-3, rr), y));
  add(1e-3, pl); add(r * 1.32, pl);
  for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; add(r * 1.22 + r * 0.12 * Math.sin(a), pl + r * 0.12 * (1 - Math.cos(a))); } // lower torus
  for (let i = 0; i <= 6; i++) { const k = i / 6; add(r * 1.08 - r * 0.07 * Math.sin(Math.PI * k), pl + r * 0.24 + r * 0.14 * k); }      // scotia
  for (let i = 0; i <= 6; i++) { const a = Math.PI * i / 6; add(r * 1.08 + r * 0.07 * Math.sin(a), pl + r * 0.38 + r * 0.1 * (1 - Math.cos(a))); } // upper torus
  const y0 = pl + hb; add(r * 1.03, y0 - 0.002);
  const NS = 40; for (let i = 0; i <= NS; i++) { const k = i / NS; add(r * (1 - 0.14 * Math.pow(k, 1.6) + 0.02 * Math.sin(Math.PI * k)), y0 + hs * k); } // entasis
  const y1 = y0 + hs; add(r * 0.92, y1 + r * 0.06); add(r * 0.92, y1 + r * 0.1);                                   // necking
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 * i / 8; add(r * 0.92 + r * 0.3 * Math.sin(a), y1 + r * 0.12 + r * 0.24 * (1 - Math.cos(a))); } // echinus
  add(1e-3, y1 + r * 0.38);
  const lg = new THREE.LatheGeometry(prof, flutes * 6);
  const p = lg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); if (y < y0 + r * 0.25 || y > y1 - r * 0.25) continue;
    const k = SS(y0 + r * 0.25, y0 + r * 0.6, y) * SS(y1 - r * 0.25, y1 - r * 0.6, y); // flutes end in rounded stops
    const a = Math.atan2(p.getX(i), p.getZ(i)), f = Math.pow(0.5 + 0.5 * Math.cos(a * flutes), 0.6);
    const s = 1 - 0.045 * k * f; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s);
  }
  lg.computeVertexNormals(); worldUV(lg, 1.2);
  g.add(new THREE.Mesh(lg, mat));
  g.add(block(r * 2.7, hc - r * 0.38, r * 2.7, mat, { r: 0.01, tile: 1.2, at: [0, y1 + r * 0.38 + (hc - r * 0.38) / 2, 0] })); // abacus
  return shadowAll(g);
}
// lowest point of an object (world), to settle props onto the ground exactly
// (precise box: a rotated object's loose box sits lower than its real lowest point)
export function settle(obj, groundY) { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj, true); obj.position.y += groundY - b.min.y; obj.updateMatrixWorld(true); return obj; }

// ---------- vegetation (instanced so the shared wind shader works; matching depth material so shadows sway too) ----------
// a lumpy leaf cluster with baked colour: darker underneath and inside, lighter on top
function blob(rad, seed, [r0, g0, b0], squash = 1) {
  const g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('uv'); const p = g.attributes.position, col = new Float32Array(p.count * 3); const R = rng(seed); const sh = R() * 9;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + 0.42 * fbm(x * 1.7 + sh, y * 1.7 + z * 1.3, seed, 3);
    p.setXYZ(i, x * rad * k, y * rad * k * squash, z * rad * k);
    const l = (0.62 + 0.38 * (y * 0.5 + 0.5)) * (0.85 + 0.3 * fbm(x * 5 + sh, z * 5 + y * 3, seed + 1, 2)); col.set([r0 * l, g0 * l, b0 * l], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
const leafMat = (amp, freq) => windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { amp, freq });
function instanced(geo, mat, list, depthOpts) {
  const im = new THREE.InstancedMesh(geo, mat, list.length); const o = new THREE.Object3D();
  list.forEach(([x, y, z, s = 1, ry = 0], i) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  if (depthOpts) im.customDepthMaterial = windDepth(depthOpts); im.castShadow = im.receiveShadow = true; return im;
}
// Italian cypress: a dark flame, widest a third of the way up
function cypressGeo(h, seed) {
  const R = rng(seed), parts = [], rmax = h * 0.085;
  for (let k = 0; k < 30; k++) {
    const t = k / 29, y = 0.5 + t * (h - 0.9), rr = rmax * (0.6 + 0.4 * SS(0, 0.22, t)) * Math.pow(1 - t, 0.9) + 0.06;
    for (let n = 0; n < 3; n++) { const a = R() * 6.28, b = blob(rr * (0.75 + R() * 0.25), seed * 100 + k * 3 + n, [0.12, 0.2, 0.1], 1.5); b.translate(Math.cos(a) * rr * 0.4, y, Math.sin(a) * rr * 0.4); parts.push(b); }
  }
  return mergeGeometries(parts);
}
// olive: a few big silver-green clumps on a gnarled trunk
function oliveGeo(seed) {
  const R = rng(seed), parts = [];
  for (let k = 0; k < 34; k++) { const a = R() * 6.28, d = 0.3 + R() * 1.5, y = 2.3 + R() * 1.3 - d * 0.25, s = 0.45 + R() * 0.4; const c = R() < 0.5 ? [0.36, 0.41, 0.27] : [0.47, 0.5, 0.38];
    const b = blob(s, seed * 50 + k, c, 0.7); b.translate(Math.cos(a) * d, y, Math.sin(a) * d); parts.push(b); }
  return mergeGeometries(parts);
}
function oliveTrunk(seed, bark) {
  const R = rng(seed), g = new THREE.Group();
  const tube = (pts, r0, r1, gnarl) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); const geo = new THREE.TubeGeometry(c, 40, 1, 10, false);
    const p = geo.attributes.position, n = geo.attributes.normal, seg = 41, rad = 11;
    for (let i = 0; i < p.count; i++) { const k = Math.floor(i / rad) / (seg - 1), cp = c.getPointAt(Math.min(1, k)); const rr = (r0 + (r1 - r0) * k) * (1 + gnarl * (fbm(i % rad * 0.7, k * 9, seed, 3) - 0.5));
      p.setXYZ(i, cp.x + n.getX(i) * rr, cp.y + n.getY(i) * rr, cp.z + n.getZ(i) * rr); }
    geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, bark)); };
  tube([[0, -0.15, 0], [0.12, 0.7, 0.05], [-0.08, 1.4, 0.12], [0.05, 2.0, 0]], 0.26, 0.15, 0.6);
  for (let b = 0; b < 4; b++) { const a = b * 1.6 + R(), d = 1.0 + R() * 0.5; tube([[0.05, 1.8, 0], [Math.cos(a) * d * 0.5, 2.4, Math.sin(a) * d * 0.5], [Math.cos(a) * d, 2.7 + R() * 0.4, Math.sin(a) * d]], 0.12, 0.04, 0.3); }
  return shadowAll(g);
}
// umbrella (stone) pine: a tall bare trunk and a flat dark canopy
function pineGeo(seed) {
  const R = rng(seed), parts = [];
  for (let k = 0; k < 40; k++) { const a = R() * 6.28, d = Math.sqrt(R()) * 3.2, s = 0.8 + R() * 0.6; const b = blob(s, seed * 70 + k, [0.16, 0.24, 0.12], 0.45); b.translate(Math.cos(a) * d, 8.2 + (1 - d / 3.2) * 0.8 + R() * 0.3, Math.sin(a) * d); parts.push(b); }
  return mergeGeometries(parts);
}

// ---------- amphora (Dressel 1 shape): pointed toe, long body, shoulder, neck, rim, two handles ----------
export function amphora(mat, seed = 1) {
  const pr = [[0.001, 0], [0.03, 0.02], [0.045, 0.09], [0.1, 0.2], [0.16, 0.38], [0.175, 0.55], [0.165, 0.68], [0.12, 0.76], [0.065, 0.8], [0.055, 0.95], [0.06, 1.0], [0.075, 1.02], [0.07, 1.05], [0.05, 1.05]];
  const g = new THREE.Group(); const lg = new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 32); worldUV(lg, 1.2); g.add(new THREE.Mesh(lg, mat));
  for (const s of [-1, 1]) { const c = new THREE.CatmullRomCurve3([[0.05 * s, 0.97, 0], [0.13 * s, 0.98, 0], [0.15 * s, 0.86, 0], [0.13 * s, 0.75, 0]].map(p => new THREE.Vector3(...p))); g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.016, 8), mat)); }
  void seed; return shadowAll(g);
}

// ---------- the street ----------
// Layout (z towards the camera side): basalt road |z| < 1.5 with a crown, kerbs, travertine pavements to |z| = 3.6, a
// portico on the far side (stylobate z -3.6..-7.2, columns at z -4.05, back wall at z -7.2), dusty ground with grass on
// the near side, an olive tree, cypresses and umbrella pines behind the roofs, Pompeii-style stepping stones across the
// road at x = -4. heightAt(x, z) is the walkable top surface used by feet IK and the grounding probe.
export const RS = { road: 1.5, kerb: 1.8, walk: 3.6, walkY: 0.22, stylo: [-3.6, -7.2], styloY: 0.42, colZ: -4.05, wallZ: -7.2, X: 15 };
const dirtY = (x, z) => z > RS.walk ? 0.17 + 0.05 * (fbm(x * 0.25, z * 0.25, 81, 3) - 0.5) * SS(RS.walk, RS.walk + 1.5, z) + 0.6 * SS(14, 40, z) * fbm(x * 0.05, z * 0.05, 82, 3)
  : 0.0 + 1.2 * SS(-14, -40, z) * fbm(x * 0.04, z * 0.04, 83, 3);
export function romanHeightAt(x, z) {
  const az = Math.abs(z);
  if (Math.abs(x) > RS.X + 0.5) return dirtY(x, z);
  if (az < RS.road) return 0.03 * (1 - (z / RS.road) ** 2);
  if (az < RS.kerb) return 0.25;
  if (az < RS.walk) return RS.walkY;
  if (z < 0 && z > RS.wallZ) return RS.styloY;
  return dirtY(x, z);
}
export function romanSite({ seed = 1 } = {}) {
  const M = romanMats(), g = new THREE.Group(), R = rng(seed), props = [], ground = [];
  const X = RS.X;
  // dusty ground under everything (a little lower under the built parts)
  // 25 cm rows so the surface matches dirtY closely; level with the pavement edge under the near pavement (no ditch)
  const dg = new THREE.PlaneGeometry(140, 120, 280, 480); dg.rotateX(-Math.PI / 2); dg.translate(0, 0, -10);
  { const p = dg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), inX = Math.abs(x) <= X + 0.6;
    p.setY(i, inX && z > RS.wallZ - 0.5 && z < RS.road + 0.05 ? -0.05 : inX && z >= RS.road + 0.05 && z < RS.walk ? dirtY(x, RS.walk + 0.001) : dirtY(x, z)); } }
  dg.computeVertexNormals(); worldUV(dg, 4); const dm = new THREE.Mesh(dg, M.dirt); dm.name = 'ground'; g.add(dm); ground.push(dm);
  // road: basalt with a crown
  const rg = new THREE.PlaneGeometry(2 * X + 1, 2 * RS.road, 120, 16); rg.rotateX(-Math.PI / 2);
  { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, romanHeightAt(p.getX(i), p.getZ(i))); }
  rg.computeVertexNormals(); worldUV(rg, 2.4); const road = new THREE.Mesh(rg, M.basalt); road.name = 'road'; g.add(road); ground.push(road);
  // kerbs: travertine blocks of uneven length with hairline gaps
  for (const s of [-1, 1]) { let x = -X - 0.5; while (x < X + 0.5) { const l = 0.8 + R() * 0.7; const k = block(l - 0.012, 0.36, 0.3, M.stone, { r: 0.03, at: [x + l / 2, 0.25 - 0.18, s * (RS.road + 0.15)] }); g.add(k); ground.push(k); x += l; } }
  // pavements: travertine slabs (the ashlar texture seen from above)
  for (const s of [-1, 1]) { const w = RS.walk - RS.kerb + 0.02; const pv = block(2 * X + 1, 0.3, w, M.stone, { r: 0.01, at: [0, RS.walkY - 0.15, s * (RS.kerb + w / 2 - 0.01)] }); g.add(pv); ground.push(pv); }
  // stepping stones across the road (Pompeii)
  for (const z of [-0.85, 0, 0.85]) { const st = block(0.95, 0.34, 0.5, M.basalt, { r: 0.09, at: [-4, 0.34 / 2 - 0.02 + 0.03, z] }); g.add(st); props.push(st); }
  // portico: stylobate with a step, fluted columns, architrave, lean-to tiled roof, ochre back wall with shop doors and windows
  const sy = RS.styloY, sz0 = RS.stylo[0], sz1 = RS.stylo[1];
  const sty = block(2 * X + 1, sy + 0.1, sz0 - sz1, M.stone, { r: 0.015, at: [0, (sy - 0.1) / 2, (sz0 + sz1) / 2] }); g.add(sty); ground.push(sty);
  const colH = 3.4, cr = 0.21, stucco = M.marble;
  for (let x = -X + 1.4; x <= X - 1.3; x += 2.8) { const c = column2(colH, cr, stucco); c.position.set(x, sy, RS.colZ); g.add(c); props.push(c); }
  const archY = sy + colH; g.add(block(2 * X + 1, 0.42, 0.62, M.marble, { r: 0.02, tile: 1.2, at: [0, archY + 0.21, RS.colZ] }));
  g.add(block(2 * X + 1, 0.12, 0.74, M.stone, { r: 0.02, at: [0, archY + 0.48, RS.colZ + 0.02] }));
  const rz0 = RS.colZ + 0.45, rz1 = RS.wallZ, ry0 = archY + 0.52, ry1 = ry0 + 0.9, len = Math.hypot(rz0 - rz1, ry1 - ry0);
  { const pg = new THREE.PlaneGeometry(2 * X + 1, len, 1, 1); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * X + 1) / 2.4, uv.getY(i) * len / 2.4);
    const roofM = new THREE.Mesh(pg, M.roof); roofM.rotation.x = -Math.PI / 2 + Math.atan2(ry1 - ry0, rz0 - rz1); roofM.position.set(0, (ry0 + ry1) / 2 + 0.06, (rz0 + rz1) / 2); g.add(roofM);
    // a solid slab under the tiles (a single-sided plane casts no shadow from its front, and a thin ceiling let a dotted
    // line of sun leak onto the wall): runs 0.3 m into the wall and over the architrave, wooden boards underneath
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * X + 1, 0.14, len + 0.7), M.woodH); worldUV(slab.geometry, 1.2);
    slab.rotation.x = Math.atan2(ry1 - ry0, rz0 - rz1); slab.position.set(0, (ry0 + ry1) / 2 - 0.02, (rz0 + rz1) / 2 - 0.1); g.add(slab); }
  const ochre = M.plaster(0xd8a86a), red = M.plaster(0xa8452e), wallH = 8.2;
  g.add(block(2 * X + 1, wallH, 0.6, ochre, { r: 0.02, at: [0, wallH / 2, RS.wallZ - 0.3] }));
  g.add(block(2 * X + 1, 1.1, 0.64, red, { r: 0.015, at: [0, sy + 0.55, RS.wallZ - 0.3] })); // painted dado
  g.add(block(2 * X + 1, 0.24, 0.9, M.brick, { r: 0.02, tile: 1.2, at: [0, wallH - 0.12, RS.wallZ - 0.2] })); // cornice
  for (let x = -X + 2.8; x <= X - 2.8; x += 5.6) { // shop doors (tabernae) with wooden frames, windows above
    g.add(block(1.9, 2.6, 0.1, M.dark, { r: 0.005, at: [x, sy + 1.3, RS.wallZ + 0.02] }));
    g.add(block(2.1, 0.16, 0.16, M.wood, { r: 0.01, tile: 1.2, at: [x, sy + 2.68, RS.wallZ + 0.07] }));
    for (const s of [-1, 1]) g.add(block(0.14, 2.6, 0.14, M.wood, { r: 0.01, tile: 1.2, at: [x + s * 1.0, sy + 1.3, RS.wallZ + 0.07] }));
    g.add(block(0.9, 2.5, 0.06, M.wood, { r: 0.008, tile: 1.2, at: [x + 0.48, sy + 1.27, RS.wallZ + 0.06] })); // a shop shutter, half open
    for (const s of [-1, 1]) { const wx = x + s * 1.3;
      g.add(block(0.62, 0.8, 0.08, M.dark, { r: 0.004, at: [wx, 5.7, RS.wallZ + 0.01] })); g.add(block(0.72, 0.08, 0.14, M.stone, { r: 0.01, at: [wx, 5.26, RS.wallZ + 0.05] }));
      g.add(block(0.32, 0.8, 0.04, M.wood, { r: 0.006, tile: 1.2, at: [wx - s * 0.47, 5.7, RS.wallZ + 0.1] })); // one shutter open against the wall
      g.add(block(0.05, 0.8, 0.05, M.wood, { r: 0.006, tile: 1.2, at: [wx, 5.7, RS.wallZ + 0.06] })); }
  }
  // the exact walkable surface (raycast on the ground meshes): plants and props are placed on what is really there
  g.updateMatrixWorld(true); const rcG = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
  // refresh matrices first: a mesh added to `ground` after the last updateMatrixWorld raycasts as if it sat at the origin
  const groundAt = (x, z) => { for (const m of ground) m.updateMatrixWorld(); rcG.set(new THREE.Vector3(x, 40, z), DOWN); const h = rcG.intersectObjects(ground, false)[0]; return h ? h.point.y : romanHeightAt(x, z); };
  // amphorae: two leaning on the back wall under the portico, one lying in the dust by the olive tree
  const clay = M.plaster(0xc4805a);
  for (const [x, rz] of [[1.2, -0.16], [1.75, -0.2], [-6.5, -0.15]]) { const a = amphora(clay); a.rotation.set(rz, R() * 0.6, 0); a.position.set(x, 0, RS.wallZ + 0.48); settle(a, sy); g.add(a); props.push(a); }
  { const a = amphora(clay); a.rotation.set(0, 0.7, Math.PI / 2 - 0.08); a.position.set(2.6, 0, 5.9); settle(a, Math.min(groundAt(2.25, 5.75), groundAt(2.6, 5.9), groundAt(2.95, 6.05)) - 0.01); g.add(a); props.push(a); }
  // olive tree on the near side
  const bark = nileMats().wood, OL = [3.4, 5.4];
  const ot = oliveTrunk(seed + 3, bark); ot.position.set(OL[0], groundAt(...OL), OL[1]); g.add(ot); props.push(ot);
  g.add(instanced(oliveGeo(seed + 4), leafMat(0.004, 1.1), [[OL[0], groundAt(...OL), OL[1], 1, 0.4]], { amp: 0.004, freq: 1.1 }));
  // cypresses behind the roofs and at the street's end, umbrella pines further back
  const cy = []; for (let k = 0; k < 9; k++) { const x = -X + 2 + k * 3.4 + (R() - 0.5) * 1.5, z = -10.5 - R() * 5; cy.push([x, dirtY(x, z) - 0.2, z, 0.9 + R() * 0.35, R() * 6]); }
  cy.push([X + 3, dirtY(X + 3, 2) - 0.2, 2, 1.05, 1], [X + 4.5, dirtY(X + 4.5, -2) - 0.2, -2, 0.95, 2]);
  g.add(instanced(cypressGeo(11, seed + 5), leafMat(0.0012, 0.9), cy, { amp: 0.0012, freq: 0.9 }));
  const trunkM = bark, pines = [[-9, -22], [4, -26], [13, -19], [-17, -9]];
  const pl = pines.map(([x, z]) => [x, dirtY(x, z) - 0.1, z, 0.9 + R() * 0.3, R() * 6]);
  g.add(instanced(pineGeo(seed + 6), leafMat(0.0008, 0.7), pl, { amp: 0.0008, freq: 0.7 }));
  for (const [x, y, z, s] of pl) { const c = new THREE.CatmullRomCurve3([[0, -0.3, 0], [0.3, 3, 0.1], [-0.2, 6, 0.2], [0.1, 8.6, 0]].map(p => new THREE.Vector3(...p))); const t = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.2, 8), trunkM); t.position.set(x, y, z); t.scale.setScalar(s); g.add(t); }
  // grass: tufts in the dust on the near side, a few weeds in the road joints and along the stylobate
  const gs = [];
  for (let i = 0; i < 900; i++) { const x = (R() - 0.5) * 2 * X, z = RS.walk + 0.15 + R() * R() * 9; if (Math.hypot(x - OL[0], z - OL[1]) < 0.45 || (Math.abs(x - 2.6) < 0.7 && Math.abs(z - 5.9) < 0.4)) continue; gs.push([x, groundAt(x, z) - 0.01, z, 0.7 + R() * 0.6]); }
  g.add(grass(gs, { h: 0.3, seed: 9, color: 0xd8d0a0 }));
  const ws = []; for (let i = 0; i < 70; i++) { const x = (R() - 0.5) * 2 * X, z = (R() - 0.5) * 2 * RS.road * 0.9; ws.push([x, groundAt(x, z) - 0.005, z, 0.22 + R() * 0.15]); }
  for (let i = 0; i < 40; i++) { const x = (R() - 0.5) * 2 * X; ws.push([x, RS.walkY - 0.005, -RS.walk + 0.03, 0.3 + R() * 0.2]); }
  g.add(grass(ws, { h: 0.22, seed: 12, color: 0xc8c890 }));
  shadowAll(g);
  g.userData = { ground, props, heightAt: romanHeightAt, groundAt };
  return g;
}

// a Roman worker: the v1.1 character in a belted wool tunic (undyed by default)
export function romanWorker({ skin = 0x8a5232, color = 0xc9b38c, belt = 0x5a3a20, hair = 0x241a14 } = {}) {
  return toon({ skin, cloth: color, belt, hair, outfit: 'tunic' });
}

// texture and geometry helpers shared with other sets (indus.js)
export { triTex, tfbm, voro, courses, jointDist, h2, std, SS as smoothstepAB };
export { blob, instanced, leafMat, oliveGeo, oliveTrunk };
