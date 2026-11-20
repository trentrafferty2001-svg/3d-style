// v4 assets: rice clumps (instanced curved blades + panicles, wind sway), carp, farmer outfit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materials } from './materials.js';
import { makeHuman } from './human.js';
import { rng, fabricTexture } from './textures.js';
import { TIME } from './world.js';

const shadowAll = (o, cast = true) => { o.traverse(c => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = true; } }); return o; };

// ---------- wind sway for instanced foliage ----------
function addSway(mat, amount = 0.06) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME; sh.uniforms.uSway = { value: amount };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uSway;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          float bl = length(instanceMatrix[1].xyz);
        #else
          float bl = 1.0;
        #endif
        mvPosition = modelMatrix * mvPosition;
        float hh = clamp(position.y, 0.0, 1.0);
        float ph = uTime * 1.9 + mvPosition.x * 0.8 + mvPosition.z * 0.55;
        float gust = 0.6 + 0.4 * sin(uTime * 0.7 + mvPosition.x * 0.15);
        mvPosition.x += (sin(ph) * 0.6 + 0.4) * uSway * gust * hh * hh * bl;
        mvPosition.z += sin(ph * 1.37 + 1.3) * uSway * 0.35 * hh * hh * bl;
        mvPosition = viewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'sway' + amount;
  return mat;
}

// ---------- one rice leaf: tapered ribbon, y 0..1, bends toward +z ----------
let _blade = null;
function bladeGeometry() {
  if (_blade) return _blade;
  const segs = 7, pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const v = i / segs;
    const w = 0.5 * (1 - Math.pow(v, 1.5) * 0.94) * (v < 0.08 ? 0.7 : 1);
    const z = v * v * 0.55;
    pos.push(-w, v, z, w, v, z);
    uv.push(0, v, 1, v);
    const sh = 0.5 + 0.55 * Math.pow(v, 0.7);
    col.push(sh, sh, sh, sh, sh, sh);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  _blade = g;
  return g;
}

// ---------- drooping golden panicle ----------
let _panicle = null;
function panicleGeometry() {
  if (_panicle) return _panicle;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.14, 0.02), new THREE.Vector3(0, 0.22, 0.08), new THREE.Vector3(0, 0.22, 0.16), new THREE.Vector3(0, 0.15, 0.22)]);
  const parts = [new THREE.TubeGeometry(curve, 10, 0.0022, 3, false)];
  const R = rng(77);
  for (let i = 0; i < 16; i++) {
    const u = 0.42 + 0.58 * (i / 15);
    const p = curve.getPointAt(u), tng = curve.getTangentAt(u);
    const gr = new THREE.OctahedronGeometry(1, 0); gr.scale(0.0048, 0.011, 0.0048);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tng.clone().add(new THREE.Vector3((R() - 0.5) * 1.2, -0.4, (R() - 0.5) * 1.2)).normalize());
    gr.applyQuaternion(q);
    gr.translate(p.x + (R() - 0.5) * 0.012, p.y - 0.004 + (R() - 0.5) * 0.008, p.z + (R() - 0.5) * 0.01);
    parts.push(gr);
  }
  const strip = (g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
  _panicle = mergeGeometries(parts.map(g => strip(g.index ? g.toNonIndexed() : g)));
  _panicle.computeVertexNormals();
  return _panicle;
}

// ---------- rice clumps ----------
// spots: [[x, z] or [x, y, z]]
export function riceClumps(spots, { h = 0.7, hVar = 0.25, blades = 10, width = 0.013, color = 0x4f8f2e, color2 = 0x8cc34a, golden = false, panicles = false, sway = 0.05, seed = 3, spread = 0.45, cast = true } = {}) {
  const R = rng(seed);
  const n = spots.length * blades;
  const mat = addSway(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), sway);
  const mesh = new THREE.InstancedMesh(bladeGeometry(), mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), c = new THREE.Color();
  const c1 = new THREE.Color(color), c2 = new THREE.Color(color2);
  const tips = [];
  let k = 0;
  for (const sp of spots) {
    const [x, y, z] = sp.length === 3 ? sp : [sp[0], 0, sp[1]];
    const base = R() * Math.PI * 2;
    const hc = h * (1 - hVar / 2 + R() * hVar);
    for (let b = 0; b < blades; b++) {
      const yaw = base + (b / blades) * Math.PI * 2 + (R() - 0.5) * 0.6;
      const tilt = 0.08 + R() * spread;
      const len = hc * (0.65 + R() * 0.45);
      e.set(tilt, yaw, 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x + (R() - 0.5) * 0.02, y, z + (R() - 0.5) * 0.02), q, new THREE.Vector3(width * (0.8 + R() * 0.4), len, len * (0.25 + R() * 0.5)));
      mesh.setMatrixAt(k, m);
      c.copy(c1).lerp(c2, R()); c.offsetHSL((R() - 0.5) * 0.02, 0, (R() - 0.5) * 0.06);
      mesh.setColorAt(k, c);
      if (b < (panicles ? 4 : 3)) tips.push([x, y, z, yaw, len]);
      k++;
    }
  }
  mesh.castShadow = cast && !(window.QS0 && window.QS0.has('nors')); mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh); g.blades = mesh;
  if (panicles) {
    const pm = addSway(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), sway * 1.2);
    const pmesh = new THREE.InstancedMesh(panicleGeometry(), pm, tips.length);
    tips.forEach(([x, y, z, yaw, len], i) => {
      e.set(0.1 + R() * 0.2, yaw + Math.PI + (R() - 0.5), 0); q.setFromEuler(e);
      const s = 0.8 + R() * 0.5;
      m.compose(new THREE.Vector3(x, y + len * 0.72, z), q, new THREE.Vector3(s, s, s));
      pmesh.setMatrixAt(i, m);
      c.set(0xe2b84c).offsetHSL((R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.1); pmesh.setColorAt(i, c);
    });
    pmesh.castShadow = false;
    g.add(pmesh);
  }
  return g;
}
export function clumpGrid(x0, x1, z0, z1, step, { jitter = 0.05, seed = 2, y = 0, skip = null } = {}) {
  const R = rng(seed), out = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) for (let z = z0; z <= z1 + 1e-6; z += step) {
    const p = [x + (R() - 0.5) * jitter, y, z + (R() - 0.5) * jitter];
    if (skip && skip(p[0], p[2])) continue;
    out.push(p);
  }
  return out;
}

// ---------- carp ----------
function carpTexture(seed = 1, style = 'koi') {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const x = cv.getContext('2d'); x.scale(2, 2);
  const R = rng(seed);
  // u (x): 0 back, 0.25 flank, 0.5 belly, 0.75 flank, 1 back.  v (y): tail (0) -> head (1)
  const grad = x.createLinearGradient(0, 0, 512, 0);
  if (style === 'koi') {
    grad.addColorStop(0, '#d8551f'); grad.addColorStop(0.18, '#f1e8da'); grad.addColorStop(0.5, '#fbf6ec'); grad.addColorStop(0.82, '#f1e8da'); grad.addColorStop(1, '#d8551f');
  } else {
    grad.addColorStop(0, '#5b4a22'); grad.addColorStop(0.2, '#b48a3a'); grad.addColorStop(0.5, '#efe0b0'); grad.addColorStop(0.8, '#b48a3a'); grad.addColorStop(1, '#5b4a22');
  }
  x.fillStyle = grad; x.fillRect(0, 0, 512, 256);
  if (style === 'koi') {
    // red-orange patches over the back and flanks
    for (let i = 0; i < 26; i++) {
      const u = (R() < 0.5 ? R() * 0.32 : 0.68 + R() * 0.32) * 512, v = 20 + R() * 220, r = 18 + R() * 42;
      x.fillStyle = `rgba(${215 + R() * 30 | 0},${60 + R() * 40 | 0},${20 + R() * 15 | 0},0.92)`;
      x.beginPath(); x.ellipse(u, v, r * 1.2, r, R() * 3, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(512 - u, v + (R() - 0.5) * 30, r, r * 0.9, R() * 3, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 7; i++) {
      const u = (0.05 + R() * 0.25) * 512 * (R() < 0.5 ? 1 : 0) + (R() < 0.5 ? 0 : 0.7 * 512 + R() * 140), v = 40 + R() * 180;
      x.fillStyle = 'rgba(25,22,20,0.85)'; x.beginPath(); x.ellipse(u, v, 6 + R() * 12, 5 + R() * 9, R() * 3, 0, Math.PI * 2); x.fill();
    }
  }
  // scales: rows of crescents
  x.strokeStyle = 'rgba(70,40,20,0.22)'; x.lineWidth = 1.6;
  for (let row = 0; row < 26; row++) for (let col = 0; col < 34; col++) {
    const u = col * 15.5 + (row % 2) * 7.7, v = row * 10 + 5;
    x.beginPath(); x.arc(u, v, 8, Math.PI * 0.15, Math.PI * 0.85); x.stroke();
  }
  // lateral line
  x.strokeStyle = 'rgba(60,40,25,0.35)'; x.lineWidth = 2;
  for (const u of [128, 384]) { x.beginPath(); x.moveTo(u, 10); x.lineTo(u + 6, 250); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function finTexture(color = '#f08a3c') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const x = cv.getContext('2d'); x.scale(2, 2);
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,240,220,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(120,50,20,0.45)'; x.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) { x.beginPath(); x.moveTo(0, 64); x.lineTo(128, i * 8.5); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {};
export function carp(len = 0.3, { seed = 1, style = 'koi', fin = '#f08a3c' } = {}) {
  const M = materials();
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  // streamlined lathe body: tail (x=-0.5) -> head (x=+0.5), deepest ~ 40% from the head
  const prof = [[-0.5, 0.0], [-0.47, 0.055], [-0.4, 0.07], [-0.3, 0.1], [-0.15, 0.155], [0.0, 0.19], [0.12, 0.2], [0.25, 0.185], [0.36, 0.15], [0.44, 0.105], [0.49, 0.055], [0.5, 0.0]];
  const pts = prof.map(([px, r]) => new THREE.Vector2(r * len, px * len));
  const geo = new THREE.LatheGeometry(pts, 40, -Math.PI / 2, Math.PI * 2);
  geo.rotateZ(-Math.PI / 2); geo.scale(1, 1, 0.58);
  const key = style + seed;
  TEX[key] = TEX[key] || carpTexture(seed, style);
  const skin = new THREE.MeshPhysicalMaterial({ map: TEX[key], roughness: 0.32, clearcoat: 1.0, clearcoatRoughness: 0.15, sheen: 0.3, sheenColor: new THREE.Color(0xfff0d0) });
  const U = { uPh: { value: 0 }, uAmp: { value: 0 }, uLen: { value: len } };
  skin.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uPh, uAmp, uLen;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bx = clamp((0.25 * uLen - transformed.x) / uLen, 0.0, 1.0);
        transformed.z += uAmp * uLen * bx * bx * sin(uPh - bx * 3.0);`);
  };
  const b = new THREE.Mesh(geo, skin); body.add(b);
  // tail: forked caudal fin
  const ts = new THREE.Shape();
  ts.moveTo(0, 0); ts.quadraticCurveTo(-0.12 * len, 0.06 * len, -0.26 * len, 0.17 * len); ts.quadraticCurveTo(-0.17 * len, 0.02 * len, -0.19 * len, 0); ts.quadraticCurveTo(-0.17 * len, -0.02 * len, -0.26 * len, -0.17 * len); ts.quadraticCurveTo(-0.12 * len, -0.06 * len, 0, 0);
  TEX[fin] = TEX[fin] || finTexture(fin);
  const finMat = new THREE.MeshPhysicalMaterial({ map: TEX[fin], roughness: 0.4, transparent: true, opacity: 0.88, side: THREE.DoubleSide, clearcoat: 0.6, depthWrite: false });
  const tailPivot = new THREE.Group(); tailPivot.position.x = -0.46 * len; body.add(tailPivot);
  const tg = new THREE.ShapeGeometry(ts, 12); tg.computeBoundingBox();
  const tuv = tg.attributes.uv; for (let i = 0; i < tuv.count; i++) { const p = tg.attributes.position; tuv.setXY(i, -p.getX(i) / (0.26 * len), 0.5 + p.getY(i) / (0.4 * len)); }
  tailPivot.add(new THREE.Mesh(tg, finMat));
  // long dorsal fin + pectoral/pelvic/anal fins
  const fin1 = (w, hgt) => { const s = new THREE.Shape(); s.moveTo(w * 0.5, 0); s.quadraticCurveTo(w * 0.35, hgt, w * 0.1, hgt * 1.05); s.lineTo(-w * 0.5, hgt * 0.35); s.lineTo(-w * 0.5, 0); const fg = new THREE.ShapeGeometry(s, 8); const uv = fg.attributes.uv, p = fg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getY(i) / hgt, 0.5 + p.getX(i) / w * 0.5); return fg; };
  const dorsal = new THREE.Mesh(fin1(0.36 * len, 0.13 * len), finMat); dorsal.position.set(-0.02 * len, 0.17 * len, 0); body.add(dorsal);
  const anal = new THREE.Mesh(fin1(0.1 * len, 0.08 * len), finMat); anal.rotation.x = Math.PI; anal.position.set(-0.3 * len, -0.08 * len, 0); body.add(anal);
  const fins = [];
  for (const s of [1, -1]) {
    const pf = new THREE.Mesh(fin1(0.12 * len, 0.09 * len), finMat); pf.position.set(0.24 * len, -0.09 * len, s * 0.08 * len); pf.rotation.set(s * 2.2, s * 0.4, Math.PI * 0.85); body.add(pf); fins.push(pf);
    const vf = new THREE.Mesh(fin1(0.1 * len, 0.08 * len), finMat); vf.position.set(0.0, -0.17 * len, s * 0.04 * len); vf.rotation.set(s * 2.6, 0, Math.PI * 0.9); body.add(vf); fins.push(vf);
  }
  // eyes: gold iris, black pupil, glossy
  const iris = new THREE.MeshPhysicalMaterial({ color: 0xd9a632, roughness: 0.2, clearcoat: 1, metalness: 0.3 });
  const pupil = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 });
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(len * 0.042, 20, 14), iris); e.position.set(len * 0.37, len * 0.045, s * len * 0.062); e.scale.set(1, 1, 0.6); body.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(len * 0.026, 16, 10), pupil); p.position.set(len * 0.375, len * 0.047, s * len * 0.082); p.scale.set(1, 1, 0.45); body.add(p);
    // gill cover line
    const gl = new THREE.Mesh(new THREE.TorusGeometry(len * 0.12, len * 0.005, 6, 24, Math.PI * 0.7), new THREE.MeshStandardMaterial({ color: 0x9a4a22, roughness: 0.5 }));
    gl.position.set(len * 0.2, -len * 0.0, s * len * 0.085); gl.rotation.set(0, s > 0 ? 0 : Math.PI, -Math.PI * 0.45); gl.scale.set(0.9, 1.1, 1); body.add(gl);
  }
  // mouth with lips, and two barbels
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xe9b89a, roughness: 0.45 });
  const mouth = new THREE.Group(); mouth.position.set(len * 0.5, -len * 0.01, 0); body.add(mouth);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(len * 0.03, len * 0.011, 8, 20), lipMat); lip.rotation.y = Math.PI / 2; mouth.add(lip);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(len * 0.03, 20), M.mouth); hole.rotation.y = Math.PI / 2; hole.position.x = -0.001; mouth.add(hole);
  for (const s of [1, -1]) {
    const bb = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.004, len * 0.002, len * 0.08, 6), lipMat);
    bb.position.set(len * 0.47, -len * 0.04, s * len * 0.03); bb.rotation.set(s * 0.4, 0, 0.9); body.add(bb);
  }
  shadowAll(g);
  g.swim = (t, rate = 9, amp = 0.45) => {
    U.uPh.value = t * rate; U.uAmp.value = amp * 0.35;
    tailPivot.rotation.y = Math.sin(t * rate - 3.0) * amp * 0.9;
    body.rotation.y = -Math.sin(t * rate - 0.6) * amp * 0.06;
    fins.forEach((f, i) => { f.rotation.y = Math.sin(t * rate * 0.6 + i) * 0.3 * (i % 2 ? 1 : -1); });
  };
  g.mouth = (k) => { mouth.scale.set(1, 0.6 + k * 0.9, 0.7 + k * 0.6); hole.visible = true; };
  g.face = (dir) => { const d = dir.clone().normalize(); g.rotation.set(0, -Math.atan2(d.z, d.x), Math.asin(Math.max(-1, Math.min(1, d.y))), 'YZX'); };
  g.mouth(0);
  g.swim(0);
  return g;
}

// ---------- farmer in work clothes ----------
let FM2 = null;
function farmerMats() {
  if (FM2) return FM2;
  const fab = fabricTexture(23);
  const straw = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const x = cv.getContext('2d'); x.scale(2, 2);
    x.fillStyle = '#d8b874'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 4) { x.fillStyle = i % 8 ? 'rgba(140,100,40,0.18)' : 'rgba(255,240,200,0.18)'; x.fillRect(0, i, 256, 2); }
    for (let i = 0; i < 64; i++) { x.strokeStyle = 'rgba(120,85,35,0.25)'; x.beginPath(); x.moveTo(i * 4, 0); x.lineTo(i * 4 + 6, 256); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  FM2 = {
    shirt: new THREE.MeshStandardMaterial({ color: 0x4d6f99, roughness: 0.95, bumpMap: fab, bumpScale: 1.6 }),
    trousers: new THREE.MeshStandardMaterial({ color: 0x3a342d, roughness: 0.95, bumpMap: fab, bumpScale: 1.4 }),
    sash: new THREE.MeshStandardMaterial({ color: 0xa8402c, roughness: 0.85, bumpMap: fab, bumpScale: 1 }),
    hat: new THREE.MeshStandardMaterial({ map: straw, roughness: 0.85, bumpMap: straw, bumpScale: 1.5 }),
    hatIn: new THREE.MeshStandardMaterial({ color: 0x9c7b3c, roughness: 0.9 }),
  };
  return FM2;
}
export function farmer2() {
  const M = materials(), F = farmerMats();
  const h = makeHuman('farmer');
  const j = h.j;
  // shirt on torso and upper arms, skin on the forearms, rolled sleeves
  h.root.traverse(c => { if (c.isMesh && c.material === M.cloth) c.material = F.shirt; });
  for (const s of ['l', 'r']) {
    j[s + 'El'].children.forEach(c => { if (c.isMesh) c.material = M.skin; });
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.02, 10, 24), F.shirt); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.27; j[s + 'Sh'].add(cuff);
    // trousers on thighs and knees, rolled up below the knee, bare shins
    j[s + 'Hip'].children.forEach(c => { if (c.isMesh) c.material = F.trousers; });
    j[s + 'Kn'].children.forEach((c, i) => { if (c.isMesh) c.material = i === 0 ? F.trousers : M.skin; });
    const tc = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.022, 10, 24), F.trousers); tc.rotation.x = Math.PI / 2; tc.position.y = -0.07; j[s + 'Kn'].add(tc);
    j[s + 'An'].children.forEach(c => { if (c.isMesh && c.material !== M.skin) c.visible = false; });
  }
  // sash at the waist, collar
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 10, 40), F.sash); sash.rotation.x = Math.PI / 2; sash.scale.set(1.13, 0.66, 1); sash.position.y = -0.03; j.spine.add(sash);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), F.sash); knot.position.set(0.12, -0.04, 0.12); j.spine.add(knot);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.012), F.sash); tail.position.set(0.13, -0.13, 0.125); tail.rotation.z = 0.15; j.spine.add(tail);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 24), F.shirt); collar.rotation.x = Math.PI / 2 - 0.25; collar.position.set(0, 0.35, 0.0); j.chest.add(collar);
  // loose sleeves and trouser legs over the capsule limbs, so the joints stop reading as a mannequin
  for (const sd of ['l', 'r']) {
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.067, 0.27, 20, 4, true), F.shirt); sl.position.y = -0.13; j[sd + 'Sh'].add(sl);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), F.shirt); cap.position.y = 0.005; j[sd + 'Sh'].add(cap);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.086, 0.42, 20, 4, true), F.trousers); leg.position.y = -0.2; j[sd + 'Hip'].add(leg);
    const p = leg.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.04 * Math.sin(a * 5 + p.getY(i) * 18); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    leg.geometry.computeVertexNormals();
  }
  // shirt yoke, placket with buttons, a pocket
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 6, 40, Math.PI), F.shirt); yoke.rotation.set(Math.PI / 2, 0, 0); yoke.scale.set(1.13, 0.66, 1); yoke.position.set(0, 0.3, 0); j.chest.add(yoke);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.4 });
  const plk = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.36, 0.006), new THREE.MeshStandardMaterial({ color: 0x3f5f87, roughness: 0.95 })); plk.position.set(0, 0.07, 0.127); j.chest.add(plk);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), btnMat); b.scale.z = 0.5; b.position.set(0, 0.2 - i * 0.085, 0.132 + (i > 2 ? -0.004 : 0)); j.chest.add(b); }
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.008), new THREE.MeshStandardMaterial({ color: 0x45658f, roughness: 0.95 })); pocket.position.set(0.085, 0.14, 0.118); pocket.rotation.y = 0.35; j.chest.add(pocket);
  // hands with fingers instead of mitten fists
  for (const [sd, sgn] of [['l', 1], ['r', -1]]) {
    const wr = j[sd + 'Wr'];
    for (const c of [...wr.children]) wr.remove(c);
    const hand = new THREE.Group(); wr.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M.skin); palm.scale.set(0.038, 0.047, 0.02); palm.position.set(0, -0.05, 0.004); hand.add(palm);
    const fingers = [];
    [-0.024, -0.008, 0.008, 0.024].forEach((fx, i) => {
      const base = new THREE.Group(); base.position.set(fx, -0.088, 0.006); hand.add(base);
      const L1 = [0.026, 0.03, 0.029, 0.023][i], L2 = L1 * 0.85;
      const p1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, L1, 4, 8), M.skin); p1.position.y = -L1 / 2; base.add(p1);
      const mid = new THREE.Group(); mid.position.y = -L1 - 0.004; base.add(mid);
      const p2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0074, L2, 4, 8), M.skin); p2.position.y = -L2 / 2; mid.add(p2);
      fingers.push([base, mid]);
    });
    const tb = new THREE.Group(); tb.position.set(-sgn * 0.03, -0.045, 0.012); hand.add(tb);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.03, 4, 8), M.skin); th.position.y = -0.02; tb.add(th);
    tb.rotation.set(0.5, 0, sgn * 0.7);
    hand.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    h['grip' + sd.toUpperCase()] = (k) => { fingers.forEach(([b, m], i) => { b.rotation.x = -(0.2 + k * 1.15); m.rotation.x = -(0.15 + k * 1.3); }); tb.rotation.x = 0.5 - k * 0.3; };
    h['grip' + sd.toUpperCase()](0.25);
  }
  h.grip = (l, r = l) => { h.gripL(l); h.gripR(r); };
  // conical straw hat with an inner band
  const hat = new THREE.Group(); hat.position.y = 0.2; j.head.add(hat);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.15, 48, 1, true), F.hat); cone.position.y = 0.075; cone.material.side = THREE.DoubleSide; hat.add(cone);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.308, 0.006, 6, 48), F.hatIn); rimT.rotation.x = Math.PI / 2; hat.add(rimT);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.035, 24, 1, true), F.hatIn); band.position.y = 0.02; hat.add(band);
  shadowAll(h.root);
  h.hat = hat;
  return h;
}

// ---------- slow-motion splash: crown sheet, centre jet, droplets, spray, foam ----------
import { sparks, glowSprite as glow2 } from './props.js';
export function splash2(scale = 1, seed = 5) {
  const R = rng(seed);
  const g = new THREE.Group();
  const wmat = new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, roughness: 0.04, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.6 });
  const crownMat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 1 }, uSeed: { value: R() * 10 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uFade, uSeed; varying vec2 vUv; varying vec3 vN, vV;
      float h1(float x){ return fract(sin(x * 127.1 + uSeed) * 43758.5453); }
      float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main(){
        float a = vUv.x * 30.0;
        float jag = 0.35 + 0.6 * pow(n1(a), 2.0) + 0.15 * n1(a * 3.7);
        float body = 1.0 - smoothstep(jag - 0.12, jag, vUv.y);
        float streak = 0.55 + 0.45 * n1(vUv.x * 140.0);
        float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float alpha = body * streak * (0.18 + 0.75 * fr) * uFade * smoothstep(0.0, 0.08, vUv.y + 0.02);
        gl_FragColor = vec4(vec3(0.88, 0.96, 1.0) * (0.9 + fr * 0.8), alpha);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.55, 1, 64, 1, true), crownMat); g.add(crown);
  const jetMat = wmat.clone(); jetMat.opacity = 0.75;
  const jet = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 6, 12), jetMat); g.add(jet);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), jetMat); g.add(top);
  const drops = [];
  const dmat = new THREE.MeshPhysicalMaterial({ color: 0xd8eefa, roughness: 0.02, transparent: true, opacity: 0.7, clearcoat: 1, envMapIntensity: 2.2 });
  for (let i = 0; i < 60; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dmat); g.add(d);
    const a = R() * Math.PI * 2, v = 0.6 + R() * 0.9, up = 1.2 + R() * 1.4;
    drops.push({ d, a, v, up, s: (0.0025 + R() * 0.0045) * scale, t0: R() * 0.12 });
  }
  const sp = sparks(70, { speed: 1.5 * scale, spread: 0.55, gravity: -4 * scale, life: 0.7, size: 0.008 * scale, dir: new THREE.Vector3(0, 1, 0), seed, color: [0.35, 0.42, 0.48] });
  g.add(sp);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const rings = [0, 0.2, 0.45].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), ringMat.clone()); r.rotation.x = -Math.PI / 2; r.position.y = 0.003; g.add(r); return r; });
  const foam = glow2(0xffffff, 0.2 * scale); g.add(foam);
  g.update = (t) => {
    const on = t > 0;
    // crown: rises and widens, then falls back
    const ct = Math.max(0, t);
    const ch = on ? Math.max(0, Math.sin(Math.min(1, ct / 0.6) * Math.PI)) * 0.2 * scale : 0;
    crown.visible = on && ct < 0.6;
    const cr = (0.05 + ct * 0.2) * scale;
    crown.scale.set(cr, Math.max(0.001, ch), cr); crown.position.y = ch / 2;
    crownMat.uniforms.uFade.value = 1 - Math.min(1, Math.max(0, (ct - 0.25) / 0.35));
    // Worthington jet after the cavity collapses
    const jt = ct - 0.22;
    const jh = jt > 0 ? Math.max(0, Math.sin(Math.min(1, jt / 0.5) * Math.PI)) * 0.2 * scale : 0;
    jet.visible = top.visible = jt > 0 && jt < 0.5;
    jet.scale.set(0.012 * scale, Math.max(0.001, jh * 0.5), 0.012 * scale); jet.position.y = jh * 0.5;
    top.scale.setScalar(0.02 * scale); top.position.y = jh + 0.018 * scale * Math.min(1, jt * 6);
    for (const o of drops) {
      const dt = ct - o.t0;
      o.d.visible = on && dt > 0 && dt < 0.9;
      if (o.d.visible) {
        const r = (0.06 + dt * 0.34 * o.v) * scale;
        o.d.position.set(Math.cos(o.a) * r, (0.08 * Math.min(1, dt * 8) + Math.max(-0.08, (o.up * dt - 3.0 * dt * dt)) * 0.3) * scale, Math.sin(o.a) * r);
        o.d.scale.set(o.s, o.s * 1.3, o.s);
      }
    }
    sp.update(t);
    rings.forEach((r, i) => { const tt = t - i * 0.2; r.scale.setScalar(tt > 0 ? (0.05 + tt * 0.38) * scale : 0.001); r.material.opacity = tt > 0 ? Math.max(0, 0.6 - tt * 0.55) : 0; });
    foam.position.y = 0.01; foam.scale.setScalar((0.1 + ct * 0.3) * scale); foam.material.opacity = on ? Math.max(0, 0.3 - ct * 0.5) : 0;
  };
  g.update(-1);
  return g;
}
