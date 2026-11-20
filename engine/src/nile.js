// Nile bank v2 for the shaduf demo: sculpted terrain with wet/dry soil, mud platform, detailed shaduf (plastered
// mud posts, bark pole, lumpy mud counterweight with rope lashings, clay bucket with water), instanced grass and
// papyrus that sway in the wind, date palms, a mud-brick hut, field channel. River along X; land is z < 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TIME, NOISE, waterMaterial } from './world.js';

export const LAND = 1.6, WY = 0.2;                 // top of the bank, water surface
export const PIV = new THREE.Vector3(0, 3.75, -0.3); // shaduf pivot
export const L1 = 2.6, L2 = 1.5, ROPE = 1.9;        // bucket arm, weight arm, rope length
export const PLAT = { x0: 0.3, x1: 1.45, z0: 0.15, z1: 2.3, y: 0.55 };

// ---------- deterministic noise (JS side, for geometry) ----------
function hash(x, y, s = 0) { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
export function fbm(x, y, s = 0, oct = 5) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 13); f *= 2.03; a *= 0.5; } return v; }
const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- canvas textures ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noiseTex(size, scale, seed, repeat, contrast = 1) {
  const t = canvasTex(size, size, (x, w) => {
    const img = x.createImageData(w, w);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
      // tileable: blend 4 offsets
      const u = i / w, v = j / w;
      const n = (fbm(i * scale, j * scale, seed) * (1 - u) * (1 - v) + fbm((i - w) * scale, j * scale, seed) * u * (1 - v) + fbm(i * scale, (j - w) * scale, seed) * (1 - u) * v + fbm((i - w) * scale, (j - w) * scale, seed) * u * v);
      const g = Math.max(0, Math.min(255, 128 + (n - 0.5) * 255 * contrast)); const k = (j * w + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }, repeat);
  t.colorSpace = THREE.NoColorSpace; return t;
}
// dried-mud cracks (tileable Voronoi edges) + fine grain + tiny pebble bumps: one bump map and one colour map
function crackCanvas(N, cells, seed, colour) {
  const r = rng(seed); const pts = []; for (let i = 0; i < cells; i++) pts.push([r() * N, r() * N]);
  const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); const img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let f1 = 1e9, f2 = 1e9;
    for (const [px, py] of pts) for (let oy = -N; oy <= N; oy += N) for (let ox = -N; ox <= N; ox += N) { const d = Math.hypot(i - px - ox, j - py - oy); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    const edge = f2 - f1; const crack = Math.max(0, 1 - edge / (1.1 + 0.9 * fbm(i * 0.05, j * 0.05, seed + 3)));
    const grain = fbm(i * 0.21, j * 0.21, seed + 5) - 0.5; const peb = Math.max(0, fbm(i * 0.09, j * 0.09, seed + 9) - 0.68) * 3;
    let v = colour ? 0.95 + grain * 0.14 - crack * 0.12 + peb * 0.04 : 0.62 + grain * 0.4 - crack * 0.3 + peb * 0.25;
    v = Math.max(0, Math.min(1, v)); const k = (j * N + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
}
// mud bricks with mortar (colour + bump), for the platform
function brickCanvas(colour) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); const r = rng(17);
  x.fillStyle = colour ? '#6e5436' : '#585858'; x.fillRect(0, 0, N, N);
  const rows = 8, bw = N / 3;
  for (let row = 0; row < rows; row++) { const off = (row % 2) * bw / 2; for (let col = -1; col < 4; col++) {
    const x0 = col * bw + off + 3, y0 = row * (N / rows) + 3, w = bw - 6, h = N / rows - 6;
    const tone = colour ? `rgb(${142 + r() * 16},${110 + r() * 12},${76 + r() * 10})` : `rgb(${150 + r() * 40},${150 + r() * 40},${150 + r() * 40})`;
    x.fillStyle = tone; x.beginPath(); x.roundRect(x0, y0, w, h, 6); x.fill();
    for (let k = 0; k < 40; k++) { x.fillStyle = colour ? `rgba(70,50,30,${r() * 0.18})` : `rgba(0,0,0,${r() * 0.25})`; x.fillRect(x0 + r() * w, y0 + r() * h, 2 + r() * 5, 1 + r() * 3); }
  } }
  if (colour) for (let k = 0; k < 14; k++) { const g2 = x.createRadialGradient(r() * N, r() * N, 0, r() * N, r() * N, 40 + r() * 90); g2.addColorStop(0, 'rgba(150,118,82,0.55)'); g2.addColorStop(1, 'rgba(150,118,82,0)'); x.fillStyle = g2; x.fillRect(0, 0, N, N); } // mud plaster smears
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
}
// terracotta with speckles, a darker band and a painted zigzag under the rim (u around, v up the bucket)
function clayCanvas() {
  const W2 = 512, H2 = 256, c = document.createElement('canvas'); c.width = W2; c.height = H2; const x = c.getContext('2d'); const r = rng(23);
  x.fillStyle = '#b4653b'; x.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${60 + r() * 60},${30 + r() * 30},${15},${r() * 0.25})`; x.fillRect(r() * W2, r() * H2, 1 + r() * 2, 1 + r() * 2); }
  x.fillStyle = 'rgba(70,30,15,0.55)'; x.fillRect(0, H2 * 0.12, W2, H2 * 0.07);
  x.strokeStyle = 'rgba(245,225,190,0.75)'; x.lineWidth = 4; x.beginPath(); for (let i = 0; i <= 24; i++) { const px = i * W2 / 24, py = H2 * (i % 2 ? 0.21 : 0.29); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ringCanvas() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.fillStyle = '#b8925e'; x.fillRect(0, 0, N, N);
  for (let i = 1; i < 14; i++) { x.strokeStyle = `rgba(110,75,40,${0.25 + (i % 3) * 0.1})`; x.lineWidth = 1.5; x.beginPath(); x.arc(N / 2 + Math.sin(i) * 2, N / 2, i * 4.4, 0, 7); x.stroke(); }
  x.strokeStyle = 'rgba(70,45,20,0.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(N / 2, N / 2); x.lineTo(N * 0.9, N * 0.62); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function detailTextures() {
  const cracksB = crackCanvas(512, 80, 41, false), cracksC = crackCanvas(512, 80, 41, true);
  return { cracksB, cracksC, plasterB: (() => { const t = cracksB.clone(); t.needsUpdate = true; t.repeat.set(2, 5); return t; })(),
    brickC: brickCanvas(true), brickB: brickCanvas(false), clayC: clayCanvas(), rings: ringCanvas() };
}
let _T = null;
function T() {
  if (_T) return _T;
  _T = {
    soil: noiseTex(256, 0.08, 3, [60, 60], 1.6),
    mud: noiseTex(256, 0.06, 7, [3, 3], 1.8),
    bark: (() => { const t = canvasTex(128, 512, (x, w, h) => { x.fillStyle = '#806040'; x.fillRect(0, 0, w, h); const r = rng(5); for (let i = 0; i < 260; i++) { const xx = r() * w, l = 20 + r() * 120, y = r() * h; x.strokeStyle = `rgba(${40 + r() * 40},${28 + r() * 25},${14 + r() * 14},${0.35 + r() * 0.4})`; x.lineWidth = 1 + r() * 3; x.beginPath(); x.moveTo(xx, y); x.bezierCurveTo(xx + r() * 6 - 3, y + l * 0.3, xx + r() * 6 - 3, y + l * 0.6, xx + r() * 4 - 2, y + l); x.stroke(); } for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(200,170,120,${0.15 + r() * 0.2})`; x.fillRect(r() * w, r() * h, 2 + r() * 6, 8 + r() * 30); } }, [2, 6]); return t; })(),
    rope: (() => { const t = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#b89a62'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(90,65,30,0.7)'; x.lineWidth = 5; for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 32, h); x.stroke(); } }, [3, 40]); return t; })(),
    clay: noiseTex(128, 0.12, 11, [2, 2], 1.2),
    ...detailTextures(),
  };
  return _T;
}
export function mats() {
  const t = T();
  return {
    ground: (() => { const b = t.cracksB, c = t.cracksC; b.repeat.set(6, 6); c.repeat.set(6, 6); return new THREE.MeshStandardMaterial({ vertexColors: true, map: c, roughness: 0.96, bumpMap: b, bumpScale: 1.6 }); })(),
    mud: (() => { t.brickC.repeat.set(2.2, 2.6); t.brickB.repeat.set(2.2, 2.6); return new THREE.MeshStandardMaterial({ map: t.brickC, roughness: 0.95, bumpMap: t.brickB, bumpScale: 3 }); })(),
    plaster: new THREE.MeshStandardMaterial({ color: 0xb48c5c, roughness: 0.93, bumpMap: t.plasterB, bumpScale: 2.8 }),
    wood: new THREE.MeshStandardMaterial({ map: t.bark, roughness: 0.82, bumpMap: t.bark, bumpScale: 1.6 }),
    rope: new THREE.MeshStandardMaterial({ map: t.rope, roughness: 0.9, bumpMap: t.rope, bumpScale: 1.2 }),
    clay: new THREE.MeshStandardMaterial({ map: t.clayC, roughness: 0.78, bumpMap: t.clay, bumpScale: 1.2, side: THREE.DoubleSide }),
    clayIn: new THREE.MeshStandardMaterial({ color: 0x5a2e1a, roughness: 0.9, side: THREE.BackSide }),
  };
}
const shadowAll = (o) => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// ---------- terrain ----------
export function heightAt(x, z) {
  const n = fbm(x * 0.35, z * 0.35, 1) - 0.5, n2 = fbm(x * 2.2, z * 2.2, 2) - 0.5;
  // upper bank: gentle bumps, rising slowly far back
  const top = LAND + n * 0.12 + n2 * 0.03 + Math.max(0, -z - 14) * 0.03 + (fbm(x * 0.05, z * 0.05, 4) - 0.5) * 1.2 * SS(-12, -40, z);
  // bank face: eroded slope from z=0 to z=1.1 with gullies
  const edge = 0.02 + (fbm(x * 0.6, 3, 5) - 0.5) * 0.35;
  const k = SS(edge, 1.15 + edge * 0.5, z);
  const bed = -0.45 - 0.6 * SS(1.2, 8, z) + n * 0.1;
  let h = top * (1 - k) + bed * k;
  // far bank (z > 44) rises again
  const far = SS(42, 52, z); h = h * (1 - far) + (1.0 + n * 0.3 + fbm(x * 0.1, z * 0.1, 9) * 0.6) * far;
  return h;
}
export function terrain() {
  const N = 300, S = 140;
  const map = (u) => S * (0.2 * u + 0.8 * u * u * u); // dense near the origin, coarse far away
  const pos = [], col = [], idx = [];
  const c = new THREE.Color(), dry = new THREE.Color(0xc79f68), dry2 = new THREE.Color(0xa98352), wet = new THREE.Color(0x4f3c2a), grass = new THREE.Color(0x6c8a3a), field = new THREE.Color(0x4f7f2a);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = map(i / N * 2 - 1), z = map(j / N * 2 - 1); const y = heightAt(x, z);
    pos.push(x, y, z);
    c.copy(dry).lerp(dry2, fbm(x * 0.8, z * 0.8, 6));
    c.lerp(wet, SS(0.75, 0.15, y) * (z > -0.5 ? 1 : 0));                    // wet mud near the waterline
    const g = SS(0.45, 0.75, fbm(x * 0.25, z * 0.25, 8)) * SS(-1.5, -4, z) * (1 - SS(-30, -60, z)); // grassy patches inland
    c.lerp(grass, g * 0.75);
    const fld = (z < -3.2 && z > -16 && x > -14 && x < 9) ? SS(0.0, 0.3, Math.abs(Math.sin(z * 2.6))) : 0; // green crop rows
    c.lerp(field, fld * 0.85);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  // uv from world xz for the detail bump
  // uv runs along the ground and down the bank face ((z - y) grows down the slope), so details don't stretch on it
  const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 4, (pos[k + 2] - pos[k + 1]) / 4); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mats().ground); m.receiveShadow = true; m.castShadow = true;
  return m;
}
// packed-mud platform the farmer stands on, jutting into the river
export function platform() {
  const P = PLAT, w = P.x1 - P.x0, d = P.z1 - P.z0, h = P.y + 1.0;
  const g = new RoundedBoxGeometry(w, h, d, 6, 0.05); const p = g.attributes.position; // small radius: a flat top right up to the edge
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = fbm(x * 3 + 5, z * 3 + y * 2, 12) - 0.5; const side = Math.abs(y) < h / 2 - 0.02 ? 1 : 0.25; p.setXYZ(i, x * (1 + 0.04 * (h / 2 - y)) + n * 0.05 * side, y + (y > h / 2 - 0.05 ? n * 0.02 : 0), z + n * 0.05 * side); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mats().mud); m.position.set((P.x0 + P.x1) / 2, P.y - h / 2, (P.z0 + P.z1) / 2); return shadowAll(m);
}

// ---------- shaduf ----------
function log(len, r0, r1, bend = 0.02, seed = 1) {
  const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector3((fbm(k * 2, 1, seed) - 0.5) * bend * 4, k * len, Math.sin(k * Math.PI) * bend)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 48, 1, 14, false); const p = g.attributes.position, n = g.attributes.normal;
  // taper: TubeGeometry has radius 1; rescale each ring around the curve point
  const segs = 48, rad = 14;
  for (let i = 0; i <= segs; i++) {
    const k = i / segs, c = curve.getPointAt(k), r = r0 + (r1 - r0) * k;
    for (let j = 0; j <= rad; j++) { const v = i * (rad + 1) + j; const px = p.getX(v) - c.x, py = p.getY(v) - c.y, pz = p.getZ(v) - c.z; const bump = 1 + (fbm(k * 18, j * 0.7, seed + 3) - 0.5) * 0.12; p.setXYZ(v, c.x + px * r * bump, c.y + py * r * bump, c.z + pz * r * bump); }
  }
  void n; g.computeVertexNormals();
  // end caps
  const grp = new THREE.Group(); const m = new THREE.Mesh(g, mats().wood); grp.add(m);
  for (const [k, r] of [[0, r0], [1, r1]]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 14), new THREE.MeshStandardMaterial({ map: T().rings, roughness: 0.8 })); const c = curve.getPointAt(k); cap.position.copy(c); cap.rotation.x = k ? -Math.PI / 2 : Math.PI / 2; grp.add(cap); }
  return grp;
}
function lashing(r, turns = 5, w = 0.06, tube = 0.011) {
  const g = new THREE.Group(); const M = mats().rope;
  for (let i = 0; i < turns; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r + tube, tube, 8, 28), M); t.position.y = (i / (turns - 1) - 0.5) * w; t.rotation.x = Math.PI / 2 + (i % 2 ? 0.12 : -0.12); g.add(t); }
  return g;
}
export function shaduf() {
  const M = mats(); const g = new THREE.Group();
  // two plastered mud pillars with a notch for the crossbar
  for (const s of [-1, 1]) {
    const hgt = PIV.y - LAND + 0.08;
    const geo = new THREE.CylinderGeometry(0.13, 0.19, hgt, 20, 24); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(x, z); const n = fbm(a * 2 + s * 10, y * 2.5, 21) - 0.5; const k = 1 + n * 0.16; p.setXYZ(i, x * k, y, z * k); }
    geo.computeVertexNormals();
    const pil = new THREE.Mesh(geo, M.plaster); pil.position.set(s * 0.55, LAND + hgt / 2 - 0.06, PIV.z); g.add(pil);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.plaster); cap.scale.y = 0.45; cap.position.set(s * 0.55, LAND + hgt - 0.06, PIV.z); g.add(cap);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.16, 20), M.mud); foot.position.set(s * 0.55, LAND + 0.04, PIV.z); g.add(foot);
  }
  // crossbar log
  const bar = log(1.5, 0.055, 0.05, 0.01, 4); bar.rotation.z = -Math.PI / 2; bar.position.set(-0.75, PIV.y - 0.06, PIV.z); g.add(bar);
  for (const s of [-1, 1]) { const l = lashing(0.058, 4, 0.07); l.rotation.z = Math.PI / 2; l.position.set(s * 0.55, PIV.y - 0.06, PIV.z); g.add(l); }
  // pivoting pole: tapered bark log from the weight end to the tip, lashed to the crossbar
  const piv = new THREE.Group(); piv.position.copy(PIV); g.add(piv);
  const pole = log(L1 + L2 + 0.15, 0.078, 0.046, 0.03, 9); pole.rotation.x = Math.PI / 2; pole.position.z = -L2 - 0.1; pole.position.y = 0.02; piv.add(pole);
  const pl = lashing(0.08, 5, 0.12, 0.012); pl.rotation.x = Math.PI / 2; pl.position.set(0, 0.0, 0); piv.add(pl);
  // mud counterweight: lumpy, lashed to the pole end with crossing ropes
  const cwg = new THREE.IcosahedronGeometry(0.36, 5); const cp = cwg.attributes.position;
  for (let i = 0; i < cp.count; i++) { const v = new THREE.Vector3(cp.getX(i), cp.getY(i), cp.getZ(i)); const n = v.clone().normalize(); const d = 1 + (fbm(n.x * 2.2 + 3, n.y * 2.2 + n.z * 1.7, 31) - 0.5) * 0.5 + (fbm(n.x * 7, n.z * 7 + n.y * 3, 32) - 0.5) * 0.12; v.multiplyScalar(d); v.y *= 0.82; cp.setXYZ(i, v.x, v.y, v.z); }
  cwg.computeVertexNormals();
  const cw = new THREE.Mesh(cwg, new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.97, bumpMap: T().mud, bumpScale: 4 })); cw.position.set(0, -0.22, -L2 + 0.05); piv.add(cw);
  for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0], [0.6, 0.4]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.013, 8, 48), M.rope); t.position.copy(cw.position); t.rotation.set(rx, rz, 0); t.scale.set(1.04, 0.9, 1.08); piv.add(t); }
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.2, 8), M.rope); tie.position.set(0, -0.06, -L2 + 0.05); piv.add(tie);
  const tip = new THREE.Object3D(); tip.position.set(0, -0.02, L1); piv.add(tip);
  const tipL = lashing(0.05, 3, 0.05, 0.01); tipL.rotation.x = Math.PI / 2; tipL.position.set(0, 0, L1 - 0.03); piv.add(tipL);
  // rope + clay bucket with a two-bail handle and water inside
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8, 1), M.rope); g.add(rope);
  const bucket = new THREE.Group(); g.add(bucket);
  const prof = [[0.001, -0.34], [0.1, -0.345], [0.15, -0.32], [0.185, -0.25], [0.195, -0.17], [0.185, -0.09], [0.165, -0.035], [0.17, -0.01], [0.182, 0.0], [0.178, 0.012]];
  const bg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40); bg.computeVertexNormals();
  const bm = new THREE.Mesh(bg, M.clay); bucket.add(bm); const clayBase = M.clay.color.clone();
  const inner = new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0, -2).map(([r, y]) => new THREE.Vector2(Math.max(0.001, r - 0.012), y + 0.008)), 40), M.clayIn); bucket.add(inner);
  for (const r of [0, Math.PI / 2]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.009, 6, 24, Math.PI), M.rope); h.rotation.y = r; h.position.y = 0.0; h.scale.y = 1.25; bucket.add(h); }
  // water in the bucket: rougher than the river so a sun glint can't bloom into a white haze
  const wm = waterMaterial({ color: 0x3a6a5c, opacity: 1, ripple: 2.5 }); wm.roughness = 0.22; wm.envMapIntensity = 0.6;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.168, 40), wm); water.rotation.x = -Math.PI / 2; water.position.y = -0.05; bucket.add(water);
  g.userData = { piv, tip, rope, bucket, water, cw };
  // a = pole tilt (+ = bucket end down). swing = bucket pendulum angles [about x, about z]. fill 0..1, slosh tilt.
  g.set = (a, { swing = [0, 0], fill = 0, slosh = 0, wet = 0 } = {}) => {
    bm.material.color.copy(clayBase).multiplyScalar(1 - 0.32 * wet); bm.material.roughness = 0.78 - 0.4 * wet; // wet clay: darker and glossier
    piv.rotation.set(a, 0, 0); g.updateMatrixWorld(true);
    const tp = tip.getWorldPosition(new THREE.Vector3()); g.worldToLocal(tp);
    const dir = new THREE.Vector3(Math.sin(swing[1]), -Math.cos(swing[1]) * Math.cos(swing[0]), Math.sin(swing[0])).normalize();
    const bp = tp.clone().addScaledVector(dir, ROPE); // handle ring
    rope.position.copy(tp).addScaledVector(dir, (ROPE - 0.01) / 2); rope.scale.y = ROPE - 0.01; // down to the top of the bail
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    bucket.position.copy(bp).addScaledVector(dir, 0.21); bucket.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    water.visible = fill > 0.02; water.position.y = -0.31 + 0.27 * fill; water.rotation.set(-Math.PI / 2 + slosh, 0, 0);
  };
  g.tipWorld = () => tip.getWorldPosition(new THREE.Vector3());
  g.bucketWorld = () => bucket.getWorldPosition(new THREE.Vector3());
  g.set(0);
  return shadowAll(g);
}
// tip position for a pole angle, in world space (shaduf at the origin): used to time splashes and swings
export const tipAt = (a) => new THREE.Vector3(0, PIV.y - L1 * Math.sin(a) - 0.02 * Math.cos(a), PIV.z + L1 * Math.cos(a));

// ---------- vegetation ----------
// wind sway for instanced plants: bend grows with height, gusts travel across the field
// radial: sway grows with distance from the mesh origin (palm fronds built around the crown, which never moves);
// otherwise with height above the origin (grass, reeds rooted at y = 0). Gust phase comes from world position.
function windMaterial(base, { amp = 0.12, freq = 1.3, radial = false } = {}) {
  // three.js caches programs by onBeforeCompile's source text, which is the same for every wind setting: without a
  // distinct key, grass, papyrus and palms could all end up with whichever variant compiled first
  base.customProgramCacheKey = () => `wind:${amp}:${freq}:${radial}`;
  base.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp0 = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float hk = ${radial ? 'length(position)' : 'max(0.0, position.y)'};
        float gust = sin(uTime * ${freq.toFixed(2)} + wp0.x * 0.35 + wp0.z * 0.22) * 0.6 + sin(uTime * ${(freq * 2.3).toFixed(2)} + wp0.x * 1.1) * 0.25;
        transformed.x += hk * hk * ${amp.toFixed(3)} * (gust + 0.4);
        transformed.z += hk * hk * ${amp.toFixed(3)} * 0.35 * sin(uTime * ${(freq * 1.7).toFixed(2)} + wp0.z);`);
  };
  return base;
}
// matching shadow-pass material, so swaying plants cast swaying shadows
function windDepth(opts) { return windMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }), opts); }
function bladeTuft(blades = 9, h = 0.32, seed = 1) {
  const r = rng(seed); const pos = [], col = [], idx = []; let v0 = 0;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.35, hh = h * (0.55 + r() * 0.6), w = 0.012 + r() * 0.01; const ox = (r() - 0.5) * 0.08, oz = (r() - 0.5) * 0.08;
    const dx = Math.cos(a), dz = Math.sin(a); const SEG = 4;
    for (let s = 0; s <= SEG; s++) {
      const k = s / SEG, y = hh * k, off = lean * k * k * hh, ww = w * (1 - k * 0.92);
      const cx = ox + dx * off, cz = oz + dz * off;
      pos.push(cx - dz * ww, y, cz + dx * ww, cx + dz * ww, y, cz - dx * ww);
      const g = 0.55 + k * 0.45; col.push(0.36 * g, 0.5 * g, 0.18 * g, 0.4 * g, 0.53 * g, 0.2 * g);
    }
    for (let s = 0; s < SEG; s++) { const a0 = v0 + s * 2; idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
    v0 += (SEG + 1) * 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function grass(spots, { h = 0.32, seed = 3, color = 0xffffff } = {}) {
  const g = bladeTuft(9, h, seed);
  const m = windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, color, roughness: 0.85, side: THREE.DoubleSide }), { amp: 0.35, freq: 1.4 });
  const im = new THREE.InstancedMesh(g, m, spots.length); const o = new THREE.Object3D(); const r = rng(seed + 7);
  spots.forEach(([x, y, z, s = 1], i) => { o.position.set(x, y, z); o.rotation.set(0, r() * 6.28, 0); o.scale.setScalar(s * (0.7 + r() * 0.6)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.customDepthMaterial = windDepth({ amp: 0.35, freq: 1.4 }); im.castShadow = true; im.receiveShadow = true; return im;
}
// papyrus: tall stem with an umbel of thin rays at the top
function papyrusGeo(seed) {
  const r = rng(seed); const parts = [];
  const H = 1.5 + r() * 0.9; const stem = new THREE.CylinderGeometry(0.009, 0.016, H, 6, 6); stem.translate(0, H / 2, 0);
  const sp = stem.attributes.position; for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) / H; sp.setX(i, sp.getX(i) + y * y * 0.12); }
  parts.push(stem);
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + r() * 0.2, el = 0.3 + r() * 0.9; const L = 0.18 + r() * 0.1; const ray = new THREE.CylinderGeometry(0.0015, 0.003, L, 3); ray.translate(0, L / 2, 0); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * el, 0, Math.sin(a) * el)); ray.applyQuaternion(q); ray.translate(0.12, H, 0); parts.push(ray); }
  const merged = mergeGeos(parts); return merged;
}
function mergeGeos(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g0 of list) { const g = g0.index ? g0 : g0; const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } const ix = g.index; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
export function papyrus(spots, seed = 4) {
  const geos = [papyrusGeo(seed), papyrusGeo(seed + 1), papyrusGeo(seed + 2)];
  const m = windMaterial(new THREE.MeshStandardMaterial({ color: 0x5f8a30, roughness: 0.75, side: THREE.DoubleSide }), { amp: 0.04, freq: 1.1 });
  const grp = new THREE.Group(); const r = rng(seed + 9);
  geos.forEach((geo, gi) => {
    const mine = spots.filter((_, i) => i % 3 === gi); if (!mine.length) return;
    const im = new THREE.InstancedMesh(geo, m, mine.length); const o = new THREE.Object3D();
    mine.forEach(([x, y, z, s = 1], i) => { o.position.set(x, y, z); o.rotation.set((r() - 0.5) * 0.15, r() * 6.28, (r() - 0.5) * 0.15); o.scale.setScalar(s * (0.75 + r() * 0.5)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.customDepthMaterial = windDepth({ amp: 0.04, freq: 1.1 }); im.castShadow = true; im.receiveShadow = true; grp.add(im);
  });
  return grp;
}
// date palm: curved ringed trunk, drooping fronds made of many leaflets, date clusters
export function palm(h = 7, seed = 1) {
  const r = rng(seed); const g = new THREE.Group();
  const lean = new THREE.Vector3((r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2);
  const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(new THREE.Vector3(lean.x * k * k, k * h, lean.z * k * k)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 60, 1, 12, false); const p = tg.attributes.position;
  for (let i = 0; i <= 60; i++) { const k = i / 60, c = curve.getPointAt(k); const rr = (0.2 - 0.06 * k) * (1 + 0.12 * Math.max(0, Math.sin(k * h * 9))); for (let j = 0; j <= 12; j++) { const v = i * 13 + j; p.setXYZ(v, c.x + (p.getX(v) - c.x) * rr, c.y + (p.getY(v) - c.y) * rr, c.z + (p.getZ(v) - c.z) * rr); } }
  tg.computeVertexNormals();
  g.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x7a5e40, roughness: 0.92, bumpMap: T().bark, bumpScale: 3 })));
  const top = curve.getPointAt(1);
  const leafM = windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), { amp: 0.012, freq: 0.9, radial: true });
  const pos = [], col = [], idx = []; let v0 = 0;
  const NF = 18;
  for (let f = 0; f < NF; f++) {
    const az = (f / NF) * Math.PI * 2 + r() * 0.3, up = 0.9 - (f % 3) * 0.45 - r() * 0.3, L = 2.4 + r() * 0.8;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)); const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const P = (k) => top.clone().addScaledVector(dir, k * L).add(new THREE.Vector3(0, Math.sin(up) * k * L * 0.8 - k * k * L * 0.55, 0));
    const NL = 26;
    for (let l = 0; l < NL; l++) {
      const k = 0.12 + (l / NL) * 0.86; const base = P(k); const ll = 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.1)) + 0.1;
      for (const s of [-1, 1]) {
        const tipp = base.clone().addScaledVector(side, s * ll).add(new THREE.Vector3(0, -0.18 * ll, 0)).addScaledVector(dir, ll * 0.35);
        const w = 0.035; const b2 = P(k + 0.02);
        pos.push(base.x, base.y, base.z, b2.x, b2.y, b2.z, tipp.x, tipp.y + w, tipp.z, tipp.x, tipp.y - w * 0.3, tipp.z);
        const gk = 0.75 + r() * 0.35, yel = k * 0.25; for (let q = 0; q < 4; q++) col.push((0.24 + yel) * gk, (0.42 + yel * 0.5) * gk, 0.14 * gk);
        idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); v0 += 4;
      }
    }
    // midrib: merged into the same mesh as its leaflets so both sway together (a separate static rib left the
    // leaflets swinging in mid-air)
    const rib = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([0, 0.3, 0.6, 1].map(P)), 12, 0.02, 5);
    const rp = rib.attributes.position, ri = rib.index;
    for (let q = 0; q < rp.count; q++) { pos.push(rp.getX(q), rp.getY(q), rp.getZ(q)); col.push(0.42, 0.42, 0.2); }
    for (let q = 0; q < ri.count; q++) idx.push(ri.getX(q) + v0);
    v0 += rp.count;
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); lg.setIndex(idx);
  lg.translate(-top.x, -top.y, -top.z); lg.computeVertexNormals(); // crown at the origin: radial wind keeps it fixed
  // the instanced wind shader expects instanceMatrix: use a 1-instance InstancedMesh
  const im = new THREE.InstancedMesh(lg, leafM, 1); im.setMatrixAt(0, new THREE.Matrix4()); im.position.copy(top); im.customDepthMaterial = windDepth({ amp: 0.012, freq: 0.9, radial: true }); g.add(im);
  for (let c = 0; c < 3; c++) { const a = r() * 6.28; const cl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc8742a, roughness: 0.6, bumpMap: T().clay, bumpScale: 3 })); cl.scale.set(0.8, 1.2, 0.8); cl.position.copy(top).add(new THREE.Vector3(Math.cos(a) * 0.3, -0.35, Math.sin(a) * 0.3)); g.add(cl); }
  return shadowAll(g);
}
// mud-brick hut
export function hut() {
  const M = mats(); const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(3.4, 2.3, 2.8, 4, 0.18), M.plaster); body.position.y = 1.1; g.add(body);
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.75, 1.4, 0.1, 2, 0.04), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 })); door.position.set(0.5, 0.7, 1.41); g.add(door);
  for (let i = 0; i < 7; i++) { const b = log(3.0, 0.05, 0.045, 0.01, 40 + i); b.rotation.x = Math.PI / 2; b.position.set(-1.5 + i * 0.5, 2.28, -1.5); g.add(b); }
  const roof = new THREE.Mesh(new RoundedBoxGeometry(3.5, 0.14, 2.9, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0x9a8a5a, roughness: 1, bumpMap: T().soil, bumpScale: 4 })); roof.position.y = 2.36; g.add(roof);
  return shadowAll(g);
}
export function jar(h = 0.6, seed = 1) {
  const r = rng(seed); const pr = []; for (let i = 0; i <= 16; i++) { const k = i / 16; pr.push(new THREE.Vector2(Math.max(0.001, (0.18 * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.05) * (1 + r() * 0.02) * (k > 0.9 ? 0.75 : 1)), k * h)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pr, 32), mats().clay); return shadowAll(m);
}

// ---------- river v2: planar reflection + depth tint + shore foam ----------
// The reflection is rendered from a camera mirrored in the water plane (oblique near-plane clipping removes
// everything below the surface) into a half-resolution HDR target, before the main render of each (sub)frame:
// main.js calls scene.userData.prerender hooks. The water shader distorts it with the ripple normals and blends it by
// Fresnel. A top-down depth/edge map (built once from the terrain and the platform) drives a lighter tint in the
// shallows and animated foam where the water meets the bank and the platform.
export function river({ W = 1080, H = 1920, color = 0x35604f, ripple = 1.0 } = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), { type: THREE.HalfFloatType });
  const vcam = new THREE.PerspectiveCamera(); const texM = new THREE.Matrix4();
  // depth / edge map over the water near the action: R = depth (0..0.5 m), G = closeness to an edge (bank or platform)
  const DX0 = -26, DX1 = 26, DZ0 = 0.2, DZ1 = 10.2, NX = 1024, NZ = 200; const data = new Uint8Array(NX * NZ * 4);
  const P = PLAT, pr = 0.04; // platform footprint (a little inflated for its rough sides)
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = DX0 + (DX1 - DX0) * (i + 0.5) / NX, z = DZ0 + (DZ1 - DZ0) * (j + 0.5) / NZ;
    let depth = Math.max(0, WY - heightAt(x, z));
    const dx = Math.max(P.x0 - pr - x, 0, x - P.x1 - pr), dz = Math.max(P.z0 - z, 0, z - P.z1 - pr); const dPlat = Math.hypot(dx, dz);
    if (dPlat === 0) depth = 0;
    const edge = Math.min(depth / 0.05, dPlat / 0.07);
    const k = (j * NX + i) * 4; data[k] = Math.min(255, depth / 0.5 * 255); data[k + 1] = Math.min(255, edge * 255); data[k + 2] = 0; data[k + 3] = 255;
  }
  const dtex = new THREE.DataTexture(data, NX, NZ); dtex.magFilter = dtex.minFilter = THREE.LinearFilter; dtex.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.04, metalness: 0, envMapIntensity: 0.3 });
  m.customProgramCacheKey = () => 'river2';
  const U = { uTime: TIME, uRip: { value: ripple }, tRefl: { value: rt.texture }, uTexM: { value: texM }, tDepth: { value: dtex },
    uDMin: { value: new THREE.Vector2(DX0, DZ0) }, uDMax: { value: new THREE.Vector2(DX1, DZ1) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec4 vRefl; uniform mat4 uTexM;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vRefl = uTexM * vec4(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec4 vRefl; uniform float uTime, uRip; uniform sampler2D tRefl, tDepth; uniform vec2 uDMin, uDMax; vec3 gPert;
        ${NOISE}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 q = vWP.xz * 5.0 + vec2(uTime * 0.6, uTime * 0.37);
        float h0 = fbm(q), hx = fbm(q + vec2(0.12, 0.0)), hz = fbm(q + vec2(0.0, 0.12));
        gPert = vec3(h0 - hx, 0.0, h0 - hz) * 0.8 * uRip;
        normal = normalize(normal + (viewMatrix * vec4(gPert, 0.0)).xyz);`)
      .replace('#include <opaque_fragment>', `
        vec2 duv = (vWP.xz - uDMin) / (uDMax - uDMin); vec4 dm = texture2D(tDepth, clamp(duv, 0.0, 1.0));
        bool inMap = duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0;
        float depth = inMap ? dm.r * 0.5 : 0.5; float edge = inMap ? dm.g : 1.0;
        // shallows: warmer and lighter near the bank
        outgoingLight = mix(outgoingLight * vec3(1.18, 1.1, 0.88) + vec3(0.02, 0.016, 0.006), outgoingLight, smoothstep(0.0, 0.35, depth));
        // planar reflection, rippled, by Fresnel
        vec2 ruv = vRefl.xy / vRefl.w + gPert.xz * 0.09;
        vec3 refl = texture2D(tRefl, ruv).rgb * vec3(0.82, 0.9, 0.86);
        vec3 Vd = normalize(cameraPosition - vWP); float cosT = clamp(Vd.y, 0.0, 1.0);
        float Fr = 0.03 + 0.97 * pow(1.0 - cosT, 5.0);
        outgoingLight = mix(outgoingLight, refl, clamp(Fr * 0.6 + 0.05, 0.0, 0.6));
        // foam where the water touches the bank and the platform: broken up and drifting
        float fn = fbm(vWP.xz * 9.0 + vec2(uTime * 0.25, -uTime * 0.18)) * 0.7 + fbm(vWP.xz * 23.0 - uTime * 0.4) * 0.3;
        float foam = (1.0 - smoothstep(0.0, 0.9, edge + (fn - 0.5) * 0.9)) * smoothstep(0.45, 0.7, fn + 0.2 * (1.0 - edge));
        outgoingLight = mix(outgoingLight, vec3(0.58, 0.56, 0.5), clamp(foam, 0.0, 1.0) * 0.45);
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 60, 1, 1), m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, WY, 28); mesh.receiveShadow = true;
  // mirrored-camera render (adapted from three.js Reflector, MIT)
  const N = new THREE.Vector3(0, 1, 0), PW = new THREE.Vector3(0, WY, 0), view = new THREE.Vector3(), target = new THREE.Vector3(), rotM = new THREE.Matrix4(), lookAt = new THREE.Vector3(0, 0, -1);
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q4 = new THREE.Vector4();
  mesh.userData.prerender = (renderer, scene, camera) => {
    camera.updateMatrixWorld(); mesh.updateMatrixWorld();
    view.subVectors(PW, camera.position); if (view.dot(N) > 0) return;
    view.reflect(N).negate().add(PW);
    rotM.extractRotation(camera.matrixWorld); lookAt.set(0, 0, -1).applyMatrix4(rotM).add(camera.position);
    target.subVectors(PW, lookAt).reflect(N).negate().add(PW);
    vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rotM).reflect(N); vcam.lookAt(target);
    vcam.far = camera.far; vcam.near = camera.near; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix);
    texM.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse).multiply(mesh.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(N, PW).applyMatrix4(vcam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = vcam.projectionMatrix.elements;
    q4.x = (Math.sign(clip.x) + e[8]) / e[0]; q4.y = (Math.sign(clip.y) + e[9]) / e[5]; q4.z = -1.0; q4.w = (1.0 + e[10]) / e[14];
    clip.multiplyScalar(2.0 / clip.dot(q4));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1.0 - 0.003; e[14] = clip.w;
    const hidden = []; scene.traverse(o => { if (o.isMesh && o.userData.noReflect && o.visible) { o.visible = false; hidden.push(o); } });
    mesh.visible = false;
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.shadowMap.autoUpdate, prevAC = renderer.autoClear;
    renderer.shadowMap.autoUpdate = false; renderer.autoClear = true;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam);
    renderer.setRenderTarget(prevRT); renderer.shadowMap.autoUpdate = prevAuto; renderer.autoClear = prevAC;
    mesh.visible = true; hidden.forEach(o => { o.visible = true; });
  };
  return mesh;
}

// pebbles: small displaced rocks with varied colour, sitting on the ground (y = ground height)
export function pebbles(spots, seed = 61) {
  const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = v.clone().normalize(); v.multiplyScalar(1 + (fbm(n.x * 2 + 4, n.y * 2 + n.z * 2, seed) - 0.5) * 0.5); v.y *= 0.6; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, bumpMap: T().clay, bumpScale: 2 });
  const im = new THREE.InstancedMesh(g, m, spots.length); const o = new THREE.Object3D(); const r = rng(seed); const c = new THREE.Color();
  spots.forEach(([x, y, z, s], i) => { o.position.set(x, y + s * 0.25, z); o.rotation.set(r() * 0.5, r() * 6.28, r() * 0.5); o.scale.set(s * (0.8 + r() * 0.5), s, s * (0.8 + r() * 0.5)); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    c.setHSL(0.07 + r() * 0.04, 0.25 + r() * 0.2, 0.32 + r() * 0.2); im.setColorAt(i, c); });
  im.castShadow = true; im.receiveShadow = true; return im;
}
