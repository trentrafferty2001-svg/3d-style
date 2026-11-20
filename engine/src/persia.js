// Persian ice house (yakhchal) reel: desert, stepped mud dome (whole + cut-away), shade wall, qanat wells,
// shallow freezing channel, ice blocks, sarooj ingredients, faloodeh, air-flow arrows, palm trees.
import * as THREE from 'three';
import { SKY_PRESETS, NOISE } from './world.js';
import { glowSprite } from './props.js';
import { rng, fabricTexture } from './textures.js';
import { romanBuilder, shadowAll, canvasTex } from './rome.js';
import { cap } from './props60.js';

SKY_PRESETS.night = { zenith: 0x060c22, horizon: 0x24345e, ground: 0x15161c, sunColor: 0xa8bcff, cloud: 0.12, haze: 0x1a2244, sunI: 1.1 };
SKY_PRESETS.desert = { zenith: 0x2a6fd0, horizon: 0xe9d7b0, ground: 0xb08a5a, sunColor: 0xfff0d0, cloud: 0.12, haze: 0xe6d3ad, sunI: 4.6 };
SKY_PRESETS.winter = { zenith: 0x3a68b0, horizon: 0xc9d4de, ground: 0x8a7a62, sunColor: 0xfff2e2, cloud: 0.3, haze: 0xc4ccd4, sunI: 3.4 };

let PM = null;
export function persiaMats() {
  if (PM) return PM;
  const mud = canvasTex(256, 256, (x) => {
    x.fillStyle = '#b98e5e'; x.fillRect(0, 0, 256, 256); const R = rng(3);
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${90 + R() * 60},${60 + R() * 40},${30 + R() * 20},${R() * 0.18})`; x.beginPath(); x.arc(R() * 256, R() * 256, 1 + R() * 9, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(70,45,20,0.25)'; for (let i = 0; i < 40; i++) { x.beginPath(); const y0 = R() * 256; x.moveTo(R() * 256, y0); x.lineTo(R() * 256, y0 + (R() - 0.5) * 20); x.stroke(); }
  }, [14, 7]);
  const sand = canvasTex(256, 256, (x) => {
    x.fillStyle = '#d9b47e'; x.fillRect(0, 0, 256, 256); const R = rng(9);
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${150 + R() * 80},${110 + R() * 60},${60 + R() * 40},${R() * 0.25})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2); }
  }, [60, 60]);
  PM = {
    mud: new THREE.MeshStandardMaterial({ map: mud, roughness: 0.95, bumpMap: mud, bumpScale: 3 }),
    mudCut: new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 1, bumpMap: fabricTexture(61), bumpScale: 4, side: THREE.DoubleSide }),
    mudIn: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 1, side: THREE.BackSide }),
    sand: new THREE.MeshStandardMaterial({ map: sand, color: 0xffffff, roughness: 1 }),
    ice: new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, roughness: 0.06, metalness: 0, transmission: 0.85, ior: 1.31, thickness: 0.4, clearcoat: 1, attenuationColor: new THREE.Color(0x9fd8ff), attenuationDistance: 0.6, emissive: 0x1a4a6a, emissiveIntensity: 0.12 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c140c, roughness: 1 }),
  };
  return PM;
}

export function desertGround(scene, { y = 0, dunes = true, seed = 1, half = false } = {}) {
  const M = persiaMats();
  const g = half ? new THREE.Mesh(new THREE.PlaneGeometry(1000, 500), M.sand) : new THREE.Mesh(new THREE.CircleGeometry(500, 96), M.sand); g.rotation.x = -Math.PI / 2; g.position.y = y; if (half) g.position.z = -250; g.receiveShadow = true; scene.add(g);
  if (dunes) {
    const R = rng(seed);
    const dm = new THREE.MeshStandardMaterial({ color: 0xd2a96f, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const a = half ? Math.PI * (1.1 + R() * 0.8) : R() * Math.PI * 2, r = 60 + R() * 160, s = 10 + R() * 26;
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dm);
      d.scale.set(s * 1.6, s * (0.12 + R() * 0.12), s); d.position.set(Math.cos(a) * r, y - 0.2, Math.sin(a) * r); d.rotation.y = R() * 3; scene.add(d);
    }
    // far rocky mountains
    const mm = new THREE.MeshStandardMaterial({ color: 0x9a7a5e, roughness: 1 });
    for (let i = 0; i < 14; i++) { const a = -2.4 + i * 0.12 + R() * 0.05, r = 260 + R() * 60, h = 25 + R() * 35; const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.6, h, 7), mm); m.position.set(Math.sin(a) * r, y + h / 2 - 3, -Math.cos(a) * r); m.rotation.y = R() * 3; scene.add(m); }
  }
  return g;
}
export function palm(h = 4, seed = 1) {
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
  const dome = new THREE.Mesh(new THREE.LatheGeometry(domeProfile(R, H), 72), M.mud); g.add(dome);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 16, 1, true), M.mud); vent.position.y = H + 0.1; g.add(vent);
  const ventHole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), M.dark); ventHole.rotation.x = -Math.PI / 2; ventHole.position.y = H + 0.38; g.add(ventHole);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.8, R + 1.0, 1.2, 72), M.mud); ring.position.y = 0.6; g.add(ring);
  // entrance: a small arched porch
  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 2.2), M.mud); porch.position.set(0, 1.5, R + 0.6); g.add(porch);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), M.dark); door.position.set(0, 1.0, R + 1.71); g.add(door);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16, 0, Math.PI), M.dark); arch.position.set(0, 2.0, R + 1.71); g.add(arch);
  return shadowAll(g);
}
// cut-away yakhchal: half dome (thick wall with a cut face), deep pit, ice blocks, trench
export function yakhchalCut({ R = 9, H = 18, wall = 2.0, pit = 6 } = {}) {
  const M = persiaMats(); const g = new THREE.Group();
  const out = domeProfile(R, H), inn = domeProfile(R, H, 9, wall).map((v, i) => new THREE.Vector2(Math.max(0.3, v.x - (wall * 0.6) * (v.y / H)), v.y));
  const half = Math.PI; // back half only (camera sees the inside from +z)
  const o = new THREE.Mesh(new THREE.LatheGeometry(out, 72, Math.PI / 2, half), M.mud); g.add(o);
  const i = new THREE.Mesh(new THREE.LatheGeometry(inn, 72, Math.PI / 2, half), M.mudIn); g.add(i);
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
  shadowAll(g);
  return g;
}
// long east-west shade wall with buttresses
export function shadeWall(L = 40, H = 10, T = 1.2) {
  const M = persiaMats(); const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.BoxGeometry(L, H, T), M.mud); w.position.y = H / 2; g.add(w);
  for (let i = 0; i <= 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, H * 0.85, 1.6), M.mud); b.position.set(-L / 2 + i * L / 8, H * 0.425, -T / 2 - 0.6); g.add(b); }
  const crest = new THREE.Mesh(new THREE.BoxGeometry(L, 0.4, T + 0.3), M.mud); crest.position.y = H + 0.2; g.add(crest);
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
