// Persian ice house (yakhchal) reel: desert, stepped mud dome (whole + cut-away), shade wall, qanat wells,
// shallow freezing channel, ice blocks, sarooj ingredients, faloodeh, air-flow arrows, palm trees.
import * as THREE from 'three';
import { SKY_PRESETS, NOISE } from './world.js';
import { glowSprite } from './props.js';
import { rng, fabricTexture } from './textures.js';
import { romanBuilder, shadowAll, canvasTex } from './rome.js';
import { cap } from './props60.js';
import { triTex, tfbm, voro, courses, jointDist, h2, std, worldUV, block, settle, smoothstepAB as SS, romanMats } from './roman.js';
import { fbm, grass, palm as nilePalm } from './nile.js';
import { cylUV } from './indus.js';
import { flowWaterMaterial, streamMaterial, splash, causticsMaterial } from './water.js';
import { toon } from './toon.js';

// ---------- v1.5 textures: kahgel, adobe brick, desert floor, dressed stone ----------
let _PT = null;
function persiaTex() {
  if (_PT) return _PT;
  const N = 512;
  // kahgel (mud + straw plaster), 2.4 m tile: warm ochre, straw flecks, trowel sweeps, hairline cracks, darker rain streaks
  const kahgel = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.02, 301, N), sw = tfbm(i * 0.4, j * 1.4, 0.03, 302, N), straw = SS(0.8, 0.86, tfbm(i * 3, j * 0.5, 0.2, 303, N)) + SS(0.8, 0.86, tfbm(i * 0.5, j * 3, 0.2, 304, N));
    const v = voro(i, j, N, 7, 305), cr = SS(1.2, 0, v.f2 - v.f1) * SS(0.55, 0.7, tfbm(i, j, 0.02, 306, N)), rain = SS(0.6, 0.85, tfbm(i, j * 0.08, 0.02, 307, N));
    const c = [0.78, 0.6, 0.42].map(x => x * (0.86 + 0.18 * n + 0.06 * sw) * (1 - 0.1 * rain) * (1 - 0.3 * cr)).map((x, q) => x * (1 - 0.6 * Math.min(1, straw)) + 0.6 * Math.min(1, straw) * [0.86, 0.74, 0.5][q]);
    return { c, b: 0.55 + 0.12 * sw + 0.08 * n - 0.3 * cr + 0.1 * Math.min(1, straw), r: 0.95 };
  });
  // adobe brick (sun-dried, 25 x 25 x 5 cm), 1.0 m tile: thin bricks, thick mud mortar
  const AB = courses(N, 16, 110, 140, 311), ach = N / 16;
  const adobe = triTex(N, (i, j) => {
    const row = Math.floor(j / ach), y = j - row * ach, [dx, k] = jointDist(AB[row], i, N), inB = y > 4 && y < ach - 5 && dx > 4, e = Math.min(y - 4, ach - 5 - y, dx - 4);
    const tone = 0.9 + 0.15 * h2(row, k, 312), n = tfbm(i, j, 0.08, 313, N);
    const c = inB ? [0.72 * tone, 0.55 * tone, 0.38 * tone].map(x => x * (0.86 + 0.2 * n)) : [0.62, 0.48, 0.34].map(x => x * (0.85 + 0.2 * n));
    return { c, b: inB ? 0.45 + 0.35 * SS(0, 5, e) + 0.1 * n : 0.15, r: 0.96 };
  });
  // desert floor, 4 m tile: red-ochre packed sand, gravel, faint wind streaks
  const desert = triTex(N, (i, j) => {
    const n = tfbm(i, j, 0.015, 321, N), st = tfbm(i * 0.3, j * 2, 0.02, 322, N), v = voro(i, j, N, 44, 323), peb = 0.55 * SS(0.12, 0.05, v.f1 / v.cs) * SS(0.7, 0.78, v.id);
    const c = [0.8, 0.62, 0.44].map(x => x * (0.86 + 0.16 * n + 0.04 * st)).map((x, q) => x * (1 - peb) + peb * [0.52, 0.44, 0.38][q]);
    return { c, b: 0.45 + 0.1 * st + 0.08 * n + 0.3 * peb, r: 0.97 };
  });
  // dressed stone (channel kerbs, spout), 1.2 m tile: pale grey-buff, fine tooling
  const stone = triTex(N, (i, j) => { const n = tfbm(i, j, 0.04, 331, N), m = tfbm(i, j, 0.25, 332, N); return { c: [0.74, 0.69, 0.6].map(x => x * (0.88 + 0.16 * n)), b: 0.5 + 0.1 * m, r: 0.8 + 0.1 * n }; });
  _PT = { kahgel, adobe, desert, stone };
  return _PT;
}
// world-scale UVs on every textured mesh of a builder (scale baked in temporarily), skipping meshes already done
function uvAllP(g, tile) {
  g.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.userData.uvDone || !o.material || !o.material.map) return;
    o.geometry = o.geometry.clone(); const sc = new THREE.Matrix4().makeScale(o.scale.x, o.scale.y, o.scale.z);
    o.geometry.applyMatrix4(sc); worldUV(o.geometry, tile); o.geometry.applyMatrix4(sc.invert()); o.userData.uvDone = true; });
}

SKY_PRESETS.night = { zenith: 0x060c22, horizon: 0x24345e, ground: 0x15161c, sunColor: 0xa8bcff, cloud: 0.12, haze: 0x1a2244, sunI: 1.1 };
SKY_PRESETS.desert = { zenith: 0x2a6fd0, horizon: 0xe9d7b0, ground: 0xb08a5a, sunColor: 0xfff0d0, cloud: 0.12, haze: 0xe6d3ad, sunI: 4.6 };
SKY_PRESETS.winter = { zenith: 0x3a68b0, horizon: 0xc9d4de, ground: 0x8a7a62, sunColor: 0xfff2e2, cloud: 0.3, haze: 0xc4ccd4, sunI: 3.4 };

let PM = null;
export function persiaMats() {
  if (PM) return PM;
  const t = persiaTex();
  PM = { // v1.5: code-made kahgel, adobe, desert and stone (same keys as before, plus adobe/stone/wood)
    mud: std(t.kahgel, { bumpScale: 2.5 }),
    mudCut: std(t.adobe, { bumpScale: 3, side: THREE.DoubleSide }),
    mudIn: std(t.kahgel, { color: 0xb8a088, bumpScale: 2, side: THREE.BackSide }),
    sand: std(t.desert, { bumpScale: 2.5 }),
    ice: new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, roughness: 0.06, metalness: 0, transmission: 0.85, ior: 1.31, thickness: 0.4, clearcoat: 1, attenuationColor: new THREE.Color(0x9fd8ff), attenuationDistance: 0.6, emissive: 0x1a4a6a, emissiveIntensity: 0.12 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 1 }),
    adobe: std(t.adobe, { bumpScale: 3 }), stone: std(t.stone, { bumpScale: 1.2 }),
    wood: romanMats().wood, metal: new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.4, metalness: 0.8 }),
  };
  return PM;
}

export function desertGround(scene, { y = 0, dunes = true, seed = 1, half = false } = {}) {
  const M = persiaMats();
  const g = half ? new THREE.Mesh(worldUV(new THREE.PlaneGeometry(1000, 500), 4), M.sand) : new THREE.Mesh(worldUV(new THREE.CircleGeometry(500, 96), 4), M.sand); g.rotation.x = -Math.PI / 2; g.position.y = y; if (half) g.position.z = -250; g.receiveShadow = true; scene.add(g);
  if (dunes) {
    const R = rng(seed);
    const dm = M.sand; const duneG = new THREE.Group(); scene.add(duneG);
    for (let i = 0; i < 26; i++) {
      const a = half ? Math.PI * (1.1 + R() * 0.8) : R() * Math.PI * 2, r = 60 + R() * 160, s = 10 + R() * 26;
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dm);
      d.scale.set(s * 1.6, s * (0.12 + R() * 0.12), s); d.position.set(Math.cos(a) * r, y - 0.2, Math.sin(a) * r); d.rotation.y = R() * 3; duneG.add(d);
    }
    uvAllP(duneG, 4);
    // far rocky mountains
    const mm = new THREE.MeshStandardMaterial({ color: 0x9a7a5e, roughness: 1 });
    for (let i = 0; i < 14; i++) { const a = -2.4 + i * 0.12 + R() * 0.05, r = 260 + R() * 60, h = 25 + R() * 35; const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.6, h, 7), mm); m.position.set(Math.sin(a) * r, y + h / 2 - 3, -Math.cos(a) * r); m.rotation.y = R() * 3; scene.add(m); }
  }
  return g;
}
// v1.5: the Nile set's date palm (hundreds of leaflets, swaying in the wind); the old flat-frond palm below is kept as palmOld
export function palm(h = 4, seed = 1) { return nilePalm(Math.max(3, h * 1.4), seed); }
export function palmOld(h = 4, seed = 1) {
  const R = rng(seed); const g = new THREE.Group();
  const tm = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9, bumpMap: fabricTexture(5), bumpScale: 4 });
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, h * 0.5, 0), new THREE.Vector3(0.15, h, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.12, 8), tm));
  const fm = new THREE.MeshStandardMaterial({ color: 0x4f7a2a, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + R() * 0.3; const L = 1.6 + R() * 0.6;
    const geo = new THREE.PlaneGeometry(L, 0.35, 8, 1); const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k) + L / 2; p.setZ(k, -0.25 * x * x); p.setY(k, p.getY(k) * (1 - x / L)); }
    geo.translate(0, 0, 0); geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, fm); f.position.set(0.15, h, 0); f.rotation.set(0, a, -0.25); f.translateX(L / 2); g.add(f);
  }
  return shadowAll(g);
}
// stepped conical dome profile (radius r at height y), base radius ~R, height H
function domeProfile(R, H, steps = 9, inner = 0) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y0 = H * i / steps, y1 = H * (i + 1) / steps;
    const r0 = Math.max(0.06 * R, R * Math.pow(1 - i / steps, 0.62)) - inner;
    pts.push(new THREE.Vector2(Math.max(0.02, r0), y0));
    if (i < steps) pts.push(new THREE.Vector2(Math.max(0.02, r0 - R * 0.035), y0 + (y1 - y0) * 0.15));
  }
  return pts;
}
// whole yakhchal: stepped dome over a ring wall, small vent at the top, entrance arch
export function yakhchal({ R = 9, H = 18 } = {}) {
  const M = persiaMats(); const g = new THREE.Group();
  const dome = new THREE.Mesh(cylUV(new THREE.LatheGeometry(domeProfile(R, H), 72), 2.4), M.mud); dome.userData.uvDone = true; g.add(dome);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 16, 1, true), M.mud); vent.position.y = H + 0.1; g.add(vent);
  const ventHole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), M.dark); ventHole.rotation.x = -Math.PI / 2; ventHole.position.y = H + 0.38; g.add(ventHole);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.8, R + 1.0, 1.2, 72), M.mud); ring.position.y = 0.6; g.add(ring);
  // entrance: a small arched porch
  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 2.2), M.mud); porch.position.set(0, 1.5, R + 0.6); g.add(porch);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), M.dark); door.position.set(0, 1.0, R + 1.71); g.add(door);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16, 0, Math.PI), M.dark); arch.position.set(0, 2.0, R + 1.71); g.add(arch);
  uvAllP(g, 2.4);
  return shadowAll(g);
}
// cut-away yakhchal: half dome (thick wall with a cut face), deep pit, ice blocks, trench
export function yakhchalCut({ R = 9, H = 18, wall = 2.0, pit = 6 } = {}) {
  const M = persiaMats(); const g = new THREE.Group();
  const out = domeProfile(R, H), inn = domeProfile(R, H, 9, wall).map((v, i) => new THREE.Vector2(Math.max(0.3, v.x - (wall * 0.6) * (v.y / H)), v.y));
  const half = Math.PI; // back half only (camera sees the inside from +z)
  const o = new THREE.Mesh(cylUV(new THREE.LatheGeometry(out, 72, Math.PI / 2, half), 2.4), M.mud); o.userData.uvDone = true; g.add(o);
  const i = new THREE.Mesh(cylUV(new THREE.LatheGeometry(inn, 72, Math.PI / 2, half), 2.4), M.mudIn); i.userData.uvDone = true; g.add(i);
  // cut faces (two side sections): build a shape between outer and inner profiles
  const sh = new THREE.Shape(); sh.moveTo(out[0].x, out[0].y); out.forEach(v => sh.lineTo(v.x, v.y)); [...inn].reverse().forEach(v => sh.lineTo(v.x, v.y)); sh.lineTo(out[0].x, out[0].y);
  for (const s of [1, -1]) { const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.mudCut); f.scale.x = s; g.add(f); }
  // pit: cylinder below ground (back half) + floor
  const pitW = new THREE.Mesh(new THREE.CylinderGeometry(R - wall, R - wall, pit, 72, 1, true, Math.PI / 2, Math.PI), M.mudIn); pitW.position.y = -pit / 2; g.add(pitW);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R - wall, 72), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -pit; g.add(floor);
  // ground section cut (earth around the pit)
  const earth = new THREE.Shape(); earth.moveTo(R - wall, 0); earth.lineTo(300, 0); earth.lineTo(300, -80); earth.lineTo(-300, -80); earth.lineTo(-300, 0); earth.lineTo(-(R - wall), 0); earth.lineTo(-(R - wall), -pit); earth.lineTo(R - wall, -pit); earth.lineTo(R - wall, 0);
  const ec = new THREE.Mesh(new THREE.ShapeGeometry(earth), new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 1, side: THREE.DoubleSide })); g.add(ec);
  // trench ring at the bottom
  const trench = new THREE.Mesh(new THREE.TorusGeometry(R - wall - 0.4, 0.28, 8, 72, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3e2c1e, roughness: 1 })); trench.rotation.x = Math.PI / 2; trench.rotation.z = Math.PI; trench.scale.z = 0.2; trench.position.y = -pit + 0.01; g.add(trench);
  const tw = new THREE.Mesh(new THREE.TorusGeometry(R - wall - 0.4, 0.22, 8, 72, Math.PI), new THREE.MeshStandardMaterial({ color: 0x4f9ad0, roughness: 0.05, emissive: 0x2a6a9a, emissiveIntensity: 0.5 })); tw.rotation.x = Math.PI / 2; tw.rotation.z = Math.PI; tw.scale.set(1, 1.05, 0.22); tw.position.y = -pit + 0.05; g.add(tw);
  g.userData.trenchWater = tw;
  // ice blocks stacked in the pit (rows), revealed by count
  const blocks = [];
  const bw = 1.1, bh = 0.6, bd = 0.8;
  for (let lvl = 0; lvl < 6; lvl++) for (let k = -4; k <= 4; k++) for (let z = 0; z < 4; z++) {
    const x = k * (bw + 0.06), zz = -z * (bd + 0.06) - 0.5;
    if (Math.hypot(x, zz) > R - wall - 1.1) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), M.ice); b.position.set(x, -pit + 0.32 + lvl * (bh + 0.03), zz); g.add(b); blocks.push(b);
  }
  g.userData.blocks = blocks;
  g.setFill = (k) => { const n = Math.floor(k * blocks.length); blocks.forEach((b, i) => b.visible = i < n); };
  g.setFill(1);
  uvAllP(g, 1.0);
  shadowAll(g);
  return g;
}
// long east-west shade wall with buttresses
export function shadeWall(L = 40, H = 10, T = 1.2) {
  const M = persiaMats(); const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.BoxGeometry(L, H, T), M.mud); w.position.y = H / 2; g.add(w);
  for (let i = 0; i <= 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, H * 0.85, 1.6), M.mud); b.position.set(-L / 2 + i * L / 8, H * 0.425, -T / 2 - 0.6); g.add(b); }
  const crest = new THREE.Mesh(new THREE.BoxGeometry(L, 0.4, T + 0.3), M.mud); crest.position.y = H + 0.2; g.add(crest);
  uvAllP(g, 2.4);
  return shadowAll(g);
}
// shallow channel: long pool whose surface goes from water to ice by freeze k (0..1)
export function freezeChannel(L = 36, W = 3, { seed = 4 } = {}) {
  const g = new THREE.Group();
  const M = persiaMats();
  const bank = new THREE.Mesh(new THREE.BoxGeometry(L + 0.8, 0.3, W + 0.8), M.mud); bank.position.y = 0.15; g.add(bank);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, W), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 })); bed.position.y = 0.16; g.add(bed);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x55808c, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.85 });
  const U = { uFreeze: { value: 0 }, uFill: { value: 1 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP3;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP3 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP3; uniform float uFreeze, uFill;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = fbm(vWP3.xz * 1.5); float f = smoothstep(n * 0.6, n * 0.6 + 0.4, uFreeze * 1.4 - 0.2);
        float cracks = smoothstep(0.03, 0.0, abs(fract(fbm(vWP3.xz * 2.5) * 6.0) - 0.5) - 0.47);
        vec3 ice = mix(vec3(0.82, 0.92, 0.98), vec3(0.95, 0.98, 1.0), fbm(vWP3.xz * 8.0)) - cracks * 0.15;
        diffuseColor.rgb = mix(diffuseColor.rgb, ice, f);
        diffuseColor.a = mix(diffuseColor.a, 1.0, f);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.04, 0.35, smoothstep(0.3, 0.9, uFreeze));`);
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(L, W), mat); water.rotation.x = -Math.PI / 2; water.position.y = 0.33; g.add(water);
  g.set = (freeze, fill = 1) => { U.uFreeze.value = freeze; U.uFill.value = fill; water.scale.x = Math.max(0.001, fill); water.position.x = -L / 2 * (1 - fill); water.visible = fill > 0.002; };
  g.set(0, 1);
  uvAllP(g, 2.4);
  shadowAll(g); water.castShadow = false;
  return g;
}
// qanat: row of well-shaft mounds across the desert, getting closer to the surface
export function qanatLine(n = 9, { from = [-60, 0, -80], to = [-4, 0, -2] } = {}) {
  const M = persiaMats(); const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1); const x = from[0] + (to[0] - from[0]) * k, z = from[2] + (to[2] - from[2]) * k;
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.55, 10, 20), M.mud); m.rotation.x = Math.PI / 2; m.scale.z = 0.6; m.position.set(x, 0.15, z); g.add(m);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), M.dark); hole.rotation.x = -Math.PI / 2; hole.position.set(x, 0.2, z); g.add(hole);
  }
  uvAllP(g, 2.4);
  return shadowAll(g);
}
// Persian worker: tunic + skull cap, darker skin
export function persianWorker({ color = 0xd9cdb0, capC = 0xf2efe6 } = {}) {
  const h = romanBuilder({ color, skin: 0xb98060 });
  const c = cap(capC); c.position.set(0, 0.16, -0.005); h.j.head.add(c);
  return h;
}
// ice block with physical ice material
export function iceBlock(w = 1.1, hgt = 0.6, d = 0.8) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), persiaMats().ice); b.castShadow = b.receiveShadow = true; return b; }
// melting ice cube + spreading puddle
export function meltingCube() {
  const g = new THREE.Group(); const M = persiaMats();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12, 4, 4, 4), M.ice); g.add(cube);
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 })); pud.rotation.x = -Math.PI / 2; pud.position.y = 0.002; g.add(pud);
  g.set = (k) => { const s = Math.max(0.02, 1 - k * 0.85); cube.scale.set(s * (1 + k * 0.1), s * (1 - k * 0.2), s); cube.position.y = 0.06 * s * (1 - k * 0.2); pud.scale.setScalar(0.05 + k * 0.16); };
  g.set(0); cube.castShadow = true;
  return g;
}
// air-flow arrows (instanced particles moving along paths) - warm rising, cold sinking
export function airFlow(n = 40, { color = 0xff7a3a, up = true, R = 6, H = 14, seed = 2 } = {}) {
  const tex = glowSprite().material.map; const R0 = rng(seed);
  const g = new THREE.Group();
  const P = [...Array(n)].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(s); return { s, x: (R0() - 0.5) * 2 * R * 0.6, ph: R0(), sp: 0.15 + R0() * 0.1 }; });
  g.update = (t, k = 1) => P.forEach(({ s, x, ph, sp }) => { const a = (t * sp + ph) % 1; const y = up ? a * H : H * (1 - a); const xx = up ? x * (1 - a * 0.9) : x * (0.3 + a * 0.7); s.position.set(xx, y, 0.5); s.scale.setScalar(0.5 + 0.4 * Math.sin(a * 3)); s.material.opacity = k * 0.8 * Math.sin(Math.PI * a); });
  return g;
}
export function arrow(color = 0xff7a3a, len = 2) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.4 });
  const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 12), m); sh.position.y = len / 2; g.add(sh);
  const hd = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 16), m); hd.position.y = len + 0.3; g.add(hd);
  return g;
}
// sarooj ingredients in a row: sand, clay, lime piles, eggs, goat hair tuft
export function ingredients() {
  const g = new THREE.Group(); const R = rng(8);
  const pile = (c, s) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.14 * s, 24), new THREE.MeshStandardMaterial({ color: c, roughness: 1, bumpMap: fabricTexture(7), bumpScale: 3 })); m.position.y = 0.07 * s; return m; };
  const items = [];
  const add = (o, x) => { o.position.x = x; g.add(o); items.push(o); };
  add(pile(0xe0bd84, 1), -0.72); add(pile(0x9a5a38, 1), -0.36); add(pile(0xf4f2ea, 1), 0);
  const eggs = new THREE.Group(); for (let i = 0; i < 3; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.5 })); e.scale.y = 1.3; e.position.set((i - 1) * 0.07, 0.045, (i % 2) * 0.04); eggs.add(e); } add(eggs, 0.36);
  // goat hair: a soft combed bundle tied with twine (loose arching strands read as a spider)
  const hair = new THREE.Group(); const hm = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 1, bumpMap: fabricTexture(23), bumpScale: 4 });
  const hg = new THREE.SphereGeometry(0.1, 48, 24); const hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); const n = 1 + 0.06 * Math.sin(x * 140 + z * 60) + 0.04 * Math.sin(y * 170 + x * 90); hp.setXYZ(i, x * 1.5 * n, Math.max(-0.01, y) * 0.45 * n, z * 0.8 * n); }
  hg.computeVertexNormals(); const hb = new THREE.Mesh(hg, hm); hb.position.y = 0.012; hair.add(hb);
  const sm = new THREE.MeshStandardMaterial({ color: 0x9a8466, roughness: 1 });
  for (let i = 0; i < 24; i++) { const zz = (R() - 0.5) * 0.12, yy = 0.02 + R() * 0.025, sx = (R() < 0.5 ? -1 : 1); const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, yy, zz), new THREE.Vector3(sx * 0.11, yy + 0.008, zz * 1.1), new THREE.Vector3(sx * (0.13 + R() * 0.02), 0.006, zz * 1.2 + (R() - 0.5) * 0.02)); hair.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.0018, 5), sm)); }
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 8, 32), new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.9 })); tie.rotation.y = Math.PI / 2; tie.scale.set(1, 0.55, 1); tie.position.y = 0.022; hair.add(tie);
  add(hair, 0.72);
  // wooden board under them
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.45), new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.8 })); board.position.y = -0.015; g.add(board);
  g.items = items;
  return shadowAll(g);
}
// faloodeh: glass bowl with thin noodles, ice, rose syrup, lime wedge; plus a cup
export function faloodeh() {
  const g = new THREE.Group(); const R = rng(12);
  // footed glass dessert cup (lathe with real wall thickness and a stem)
  const prof = [[0, 0], [0.055, 0], [0.058, 0.008], [0.02, 0.016], [0.014, 0.05], [0.02, 0.07], [0.09, 0.1], [0.125, 0.155], [0.13, 0.17], [0.122, 0.17], [0.117, 0.157], [0.084, 0.108], [0.02, 0.078], [0, 0.077]].map(([x, y]) => new THREE.Vector2(x, y));
  const cupMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.92, roughness: 0.04, thickness: 0.02, ior: 1.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), cupMat); g.add(cup);
  // frozen noodles: a domed heap of soft white strands that fills the cup
  const nm = new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.55 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.8, bumpMap: fabricTexture(31), bumpScale: 3 })); core.scale.set(1, 0.55, 1); core.position.y = 0.13; g.add(core);
  for (let i = 0; i < 220; i++) { const pts = []; let a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.1; for (let k = 0; k < 7; k++) { a += (R() - 0.5) * 0.9; r = Math.min(0.105, Math.max(0, r + (R() - 0.5) * 0.04)); const h = 0.13 + 0.06 * Math.sqrt(Math.max(0, 1 - (r / 0.11) ** 2)); pts.push(new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.0032, 6), nm)); }
  const syrup = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 8, 0, Math.PI * 2, 0, 0.6), new THREE.MeshStandardMaterial({ color: 0xc83a5a, roughness: 0.15, transparent: true, opacity: 0.75 })); syrup.scale.set(1, 0.4, 1); syrup.position.set(-0.01, 0.17, 0.01); g.add(syrup);
  const lime = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x9ac840, roughness: 0.5, side: THREE.DoubleSide })); lime.position.set(0.075, 0.18, 0.03); lime.rotation.set(0.3, 0.5, 0.8); g.add(lime);
  return shadowAll(g);
}

// ---------- v1.5: a Yazd lane ----------
// x runs along the lane. Kahgel walls at |z| = PS.half (4 m apart, 4.5-5.5 m tall) with wooden doors in arched niches,
// small windows, windcatchers (badgir: tall towers with slatted vents) above the roofs, a dome; a stone jub (open water
// channel) along the far wall carrying qanat water towards -x, fed by a stone spout in the wall at x = 0; a yakhchal and
// palms beyond. 1 unit = 1 m. persiaHeightAt(x, z) is the walkable top.
export const PS = { half: 2.0, X: 16, jubZ: -1.45, jubW: 0.34, kerb: 0.12, kerbH: 0.2, waterY: 0.14, spoutY: 1.5, spoutX: 0 };
export function persiaHeightAt(x, z) {
  if (Math.abs(z - PS.jubZ) < PS.jubW / 2 + PS.kerb) return PS.kerbH; // the channel's kerbs (the water is below, inside)
  return 0;
}
// a windcatcher: square tower with tall vent slots and fins on all four faces, a flat cap
function windcatcher(M, h = 5, w = 1.8, d = 1.3) {
  const g = new THREE.Group();
  g.add(block(w, h, d, M.mud, { r: 0.03, at: [0, h / 2, 0] }));
  const sh = h * 0.42, sy = h - 0.35 - sh / 2;
  for (const [ax, len, off] of [['z', w, d / 2], ['z', w, -d / 2], ['x', d, w / 2], ['x', d, -w / 2]]) {
    const n = Math.max(2, Math.round(len / 0.32)); // vent slots separated by thin fins
    for (let k = 0; k < n; k++) { const c = -len / 2 + (k + 0.5) * len / n, sw = len / n * 0.62;
      const slot = ax === 'z' ? block(sw, sh, 0.06, M.dark, { r: 0.004, at: [c, sy, off + Math.sign(off) * 0.005] }) : block(0.06, sh, sw, M.dark, { r: 0.004, at: [off + Math.sign(off) * 0.005, sy, c] }); g.add(slot); }
  }
  g.add(block(w + 0.2, 0.18, d + 0.2, M.mud, { r: 0.03, at: [0, h + 0.09, 0] }));
  return g;
}
export function persiaSite({ seed = 5 } = {}) {
  const M = persiaMats(), g = new THREE.Group(), R = rng(seed), props = [], ground = [], updaters = [], X = PS.X, H = PS.half;
  // ground: the lane and the desert beyond (dunes and far mountains from desertGround)
  const ground0 = desertGround(g, { y: 0, dunes: true, seed: seed + 1 }); g.add(ground0); ground.push(ground0);
  // walls: house fronts on both sides with doors, windows; a dome and windcatchers above
  const house = (x0, x1, side, h) => {
    const L = x1 - x0, zc = side * (H + 0.35);
    g.add(block(L, h, 0.7, M.mud, { r: 0.03, at: [(x0 + x1) / 2, h / 2 - 0.05, zc] }));
    if (R() < 0.5) g.add(block(L * 0.5, 0.9, 0.04, M.adobe, { r: 0.004, at: [(x0 + x1) / 2 + (R() - 0.5) * L * 0.3, 0.5 + R() * 2, side * (H - 0.005)] })); // plaster worn back to the adobe
    if (L > 3.2) { const dx = x0 + 1.2 + R() * (L - 2.4);
      g.add(block(1.5, 2.7, 0.12, M.dark, { r: 0.01, at: [dx, 1.3, side * (H + 0.02)] }));           // arched niche (dark)
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24, 0, Math.PI), M.dark); arch.position.set(dx, 2.65, side * (H - 0.045)); arch.rotation.y = side < 0 ? 0 : Math.PI; g.add(arch);
      for (const s2 of [-1, 1]) g.add(block(0.5, 2.0, 0.08, M.wood, { r: 0.01, tile: 1.2, at: [dx + s2 * 0.26, 1.0, side * (H - 0.03)] })); // double wooden door
      g.add(block(0.04, 0.12, 0.05, M.metal, { r: 0.01, at: [dx - 0.08, 1.3, side * (H - 0.09)] })); g.add(block(0.04, 0.12, 0.05, M.metal, { r: 0.01, at: [dx + 0.08, 1.3, side * (H - 0.09)] }));
      g.add(block(0.5, 0.5, 0.06, M.dark, { r: 0.004, at: [dx + (R() < 0.5 ? -1 : 1) * 1.4, 3.6, side * (H + 0.005)] })); }
  };
  for (const side of [-1, 1]) { let x = -X - 1; while (x < X + 1) { const x1 = Math.min(X + 1, x + 4 + R() * 3); house(x, x1, side, 4.5 + R()); x = x1 + 0.03; } }
  g.add(block(0.7, 5.2, 2 * H + 1.4, M.mud, { r: 0.03, at: [-X - 1.35, 2.55, 0] })); // a house closing the far end
  for (const [x, side, h] of [[-6, -1, 5.5], [3.2, 1, 5], [-13, -1, 6], [9, -1, 4.5]]) { const wc = windcatcher(M, h); wc.position.set(x, 4.9, side * (H + 1.6)); g.add(wc); }
  { const dome = new THREE.Mesh(cylUV(new THREE.SphereGeometry(2.6, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), 2.4), M.mud); dome.userData.uvDone = true; dome.position.set(-9.5, 5.0, H + 3.2); g.add(dome); }
  const yk = yakhchal({ R: 7, H: 14 }); yk.position.set(-34, 0, -32); g.add(yk);
  for (let k = 0; k < 6; k++) { const p = palm(4 + R() * 2.5, k + 11); p.position.set(-X + R() * 2 * X, 0, (R() < 0.5 ? -1 : 1) * (H + 4 + R() * 6)); g.add(p); p.traverse(o => { if (o.isInstancedMesh) o.userData.noGround = true; }); }
  // the jub: stone floor and kerbs, flowing water; the spout in the wall and its stream (into the jub unless something is under it)
  const jz = PS.jubZ, jw = PS.jubW;
  g.add(block(2 * X + 2, 0.04, jw + 2 * PS.kerb, causticsMaterial(M.stone, { waterY: PS.waterY, flow: [-1, 0], scale: 6, speed: 0.3, strength: 2.4 }), { r: 0.004, tile: 1.2, at: [0, 0.02, jz] })); // caustics on the floor under the clear water
  for (const s2 of [-1, 1]) { const k = block(2 * X + 2, PS.kerbH, PS.kerb, M.stone, { r: 0.012, tile: 1.2, at: [0, PS.kerbH / 2, jz + s2 * (jw / 2 + PS.kerb / 2)] }); g.add(k); ground.push(k); }
  const LAND = [PS.spoutX, jz + 0.02];
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * X + 2, jw, 1, 1).rotateX(-Math.PI / 2), flowWaterMaterial({ color: 0x3a5048, flow: [-1, 0], speed: 0.7, scale: 10, impacts: [LAND], env: 0.7, opacity: 0.62 }));
  water.position.set(0, PS.waterY, jz); g.add(water);
  { const sp = block(0.34, 0.16, 0.62, M.stone, { r: 0.02, tile: 1.2, at: [PS.spoutX, PS.spoutY, -H + 0.26] }); g.add(sp);
    g.add(block(0.08, 0.03, 0.6, M.dark, { r: 0.006, at: [PS.spoutX, PS.spoutY + 0.075, -H + 0.27] })); } // the groove
  const spoutLip = new THREE.Vector3(PS.spoutX, PS.spoutY + 0.05, -H + 0.56);
  const sm = streamMaterial({ speed: 10, breakup: 0.85, taper: 0.004 }), stream = new THREE.Mesh(new THREE.BufferGeometry(), sm); stream.castShadow = false; stream.userData.noGround = true; g.add(stream);
  const spl = splash(new THREE.Vector3(LAND[0], PS.waterY + 0.004, LAND[1]), { surfaceY: PS.waterY, n: 20, size: 0.004, spread: 0.35, up: 0.7 }); g.add(spl);
  // the stream leaves the lip with a little forward speed and falls to `stopY` (the water, or a jar's mouth)
  const flowTo = (stopY) => { const v0 = 0.35, pts = []; const T = Math.sqrt(2 * Math.max(0.01, spoutLip.y - stopY) / 9.8);
    for (let i = 0; i <= 20; i++) { const tt = T * i / 20; pts.push(new THREE.Vector3(spoutLip.x, spoutLip.y - 4.9 * tt * tt, spoutLip.z + v0 * tt)); } return pts; };
  const streamAt = (stopY) => { stream.geometry.dispose(); stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flowTo(stopY)), 32, 0.013, 10, false); };
  streamAt(PS.waterY);
  // weeds at the wall bases
  const gs = []; for (let i = 0; i < 90; i++) { const x = (R() - 0.5) * 2 * X, z = R() < 0.5 ? H - 0.05 - R() * 0.1 : -(H - 0.05 - R() * 0.1); if (z < 0) continue; gs.push([x, -0.005, z, 0.35 + R() * 0.35]); }
  g.add(grass(gs, { h: 0.25, seed: 41, color: 0xd8d0a0 }));
  shadowAll(g); water.castShadow = false; stream.castShadow = false;
  g.updateMatrixWorld(true); const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
  const groundAt = (x, z) => { for (const m of ground) m.updateMatrixWorld(); rc.set(new THREE.Vector3(x, 30, z), DOWN); const h = rc.intersectObjects(ground, false)[0]; return h ? h.point.y : persiaHeightAt(x, z); };
  g.userData = { ground, props, heightAt: persiaHeightAt, groundAt, spoutLip, streamTo: streamAt, splash: spl, landY: PS.waterY, jubWater: water.material,
    update: (t) => { spl.update(t); updaters.forEach(u => u(t)); } };
  return g;
}
// a Persian worker: the v1.1 character in a belted tunic and a white cap (the cap drawn as pale cloth)
export function persianWorker2({ color = 0x4a5e86, cap = 0xf0ece2, skin = 0x9a6644 } = {}) {
  return toon({ skin, cloth: color, belt: 0x6a4a2a, hair: cap, outfit: 'tunic' });
}
