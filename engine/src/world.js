// Outdoor world for the rice-fish short: sky with sun + clouds, sky-lit environment, haze,
// mountains, trees, procedural paddy fields that mirror the sky, birds. All driven by TIME.
import * as THREE from 'three';
import { rng } from './textures.js';

export const TIME = { value: 0 };

export const NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = m*p; a *= .5; } return s; }
`;

// ---------- sky ----------
export const SKY_PRESETS = {
  day: { zenith: 0x1c5cd0, horizon: 0xb9d6f0, ground: 0x6f7d55, sunColor: 0xfff0d8, cloud: 0.42, haze: 0xaecbe6, sunI: 3.9 },
  golden: { zenith: 0x2a5fb8, horizon: 0xf0cf98, ground: 0x6e5f3e, sunColor: 0xffc27e, cloud: 0.38, haze: 0xd9c3a0, sunI: 4.0 },
};

export function skyMaterial({ sun, zenith, horizon, ground, sunColor, cloud, cloudScale = 1.0, disk = 30.0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun.clone().normalize() }, uZenith: { value: new THREE.Color(zenith) }, uHorizon: { value: new THREE.Color(horizon) },
      uGround: { value: new THREE.Color(ground) }, uSunCol: { value: new THREE.Color(sunColor) }, uCloud: { value: cloud },
      uCloudScale: { value: cloudScale }, uTime: TIME, uDisk: { value: disk },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = (modelMatrix*vec4(position,1.)).xyz - cameraPosition; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: NOISE + `
      uniform vec3 uSun, uZenith, uHorizon, uGround, uSunCol; uniform float uCloud, uCloudScale, uTime, uDisk; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float y = d.y; vec3 s = normalize(uSun);
        float sd = max(dot(d, s), 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.4));
        col += uSunCol * (pow(sd, 5.0) * 0.28 + pow(sd, 40.0) * 0.55);
        if (y > 0.0) {
          vec2 uv = d.xz / (y + 0.1) * uCloudScale + vec2(uTime * 0.02, uTime * 0.007);
          float n = fbm(uv * 0.8);
          float n2 = fbm(uv * 0.8 + s.xz * 0.12);
          float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.25, n);
          float lit = clamp(0.85 + (n - n2) * 5.0, 0.5, 1.25);
          vec3 cc = mix(vec3(0.58, 0.64, 0.75), vec3(1.08, 1.05, 1.0), lit) + uSunCol * pow(sd, 3.0) * 0.5;
          col = mix(col, cc, cov * smoothstep(0.0, 0.18, y) * 0.92);
          col += uSunCol * smoothstep(0.9994, 0.99975, sd) * uDisk * (1.0 - cov * 0.8);
        }
        if (y < 0.0) col = mix(uHorizon, uGround, smoothstep(0.0, -0.06, y));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}

// ---------- mountains: a ring of rounded peaks, faded by the scene fog ----------
export function mountains({ center = [0, 0, 0], rMin = 70, rMax = 260, peaks = 46, height = 38, seed = 3, color = 0x456e3c, thetaFrom = 0, thetaTo = Math.PI * 2 } = {}) {
  const R = rng(seed);
  const P = [];
  for (let i = 0; i < peaks; i++) P.push({ th: thetaFrom + R() * (thetaTo - thetaFrom), r: rMin + 20 + R() * (rMax - rMin - 40), w: 0.08 + R() * 0.14, s: 18 + R() * 40, a: height * (0.35 + R() * 0.8) });
  const nT = 220, nR = 34;
  const pos = [], col = [], idx = [];
  const base = new THREE.Color(color), dark = new THREE.Color(0x2c4a2e), rock = new THREE.Color(0x6f7a6a);
  for (let j = 0; j <= nR; j++) {
    const r = rMin + (rMax - rMin) * Math.pow(j / nR, 1.3);
    for (let i = 0; i <= nT; i++) {
      const th = thetaFrom + (thetaTo - thetaFrom) * i / nT;
      let h = 0;
      for (const p of P) {
        let dth = th - p.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
        h += p.a * Math.exp(-((dth / p.w) ** 2) - (((r - p.r) / p.s) ** 2));
      }
      h += (Math.sin(th * 23 + r * 0.05) * 0.5 + Math.sin(th * 51 + r * 0.11) * 0.3) * 1.2;
      h *= Math.min(1, Math.max(0, (r - rMin) / 25));
      pos.push(center[0] + Math.sin(th) * r, center[1] + h - 0.5, center[2] + Math.cos(th) * r);
      const k = Math.min(1, h / height);
      const c = base.clone().lerp(dark, 0.35 + 0.3 * Math.sin(th * 13 + r)).lerp(rock, Math.max(0, k - 0.75) * 0.6);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < nR; j++) for (let i = 0; i < nT; i++) {
    const a = j * (nT + 1) + i, b = a + nT + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = false; m.castShadow = false;
  return m;
}

// ---------- trees: instanced round canopies ----------
export function trees(spots, { seed = 5, scale = 1 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const LOBES = 6;
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), spots.length * LOBES);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 6), new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1 }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let k = 0;
  spots.forEach(([x, y, z], i) => {
    const s = (0.8 + R() * 0.7) * scale;
    m.compose(new THREE.Vector3(x, y + 1.0 * s, z), q, new THREE.Vector3(s, 2 * s, s)); trunk.setMatrixAt(i, m);
    const tall = R() < 0.3;
    const hue = 0.24 + R() * 0.08, sat = 0.32 + R() * 0.2, lit = 0.13 + R() * 0.07;
    for (let j = 0; j < LOBES; j++) {
      const r = s * (0.55 + R() * 0.45) * (tall ? 0.7 : 1);
      const yy = y + 2.0 * s + R() * s * (tall ? 2.6 : 1.3);
      m.compose(new THREE.Vector3(x + (R() - 0.5) * s * (tall ? 0.8 : 1.8), yy, z + (R() - 0.5) * s * (tall ? 0.8 : 1.8)), q, new THREE.Vector3(r, r * (0.75 + R() * 0.4), r));
      canopy.setMatrixAt(k, m);
      c.setHSL(hue + (R() - 0.5) * 0.02, sat, lit * (0.85 + R() * 0.3)); canopy.setColorAt(k, c);
      k++;
    }
  });
  canopy.castShadow = true; trunk.castShadow = true; canopy.receiveShadow = true;
  g.add(canopy, trunk);
  return g;
}
export function ringSpots(n, rMin, rMax, seed = 1, center = [0, 0, 0], thFrom = 0, thTo = Math.PI * 2, y = 0) {
  const R = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const th = thFrom + R() * (thTo - thFrom), r = rMin + R() * (rMax - rMin);
    // clusters: a few trees around each spot
    const cnt = 1 + Math.floor(R() * 3);
    for (let j = 0; j < cnt; j++) out.push([center[0] + Math.sin(th) * r + (R() - 0.5) * 4, y, center[2] + Math.cos(th) * r + (R() - 0.5) * 4]);
  }
  return out;
}

// ---------- paddy fields: one plane, procedural plants in rows over mirror-like water ----------
// cover: 0 = flooded with tiny seedlings, 1 = full canopy. At grazing angles the canopy closes up like a real field.
export function paddyMaterial({ cover = 0.5, spacing = 0.26, rice = 0x5f9e32, rice2 = 0x9cc84a, water = 0x24302a, bunds = true, bundX = 14, bundZ = 10, golden = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 });
  const U = {
    uCover: { value: cover }, uSpacing: { value: spacing }, uRice: { value: new THREE.Color(rice) }, uRice2: { value: new THREE.Color(rice2) },
    uWater: { value: new THREE.Color(water) }, uBunds: { value: bunds ? 1 : 0 }, uBund: { value: new THREE.Vector2(bundX, bundZ) }, uTime: TIME,
  };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uCover, uSpacing, uBunds, uTime; uniform vec3 uRice, uRice2, uWater; uniform vec2 uBund;
      ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 Vw = normalize(cameraPosition - vWP);
        float graze = 1.0 - clamp(Vw.y, 0.0, 1.0);
        vec2 g = vWP.xz / uSpacing;
        vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
        vec2 off = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5;
        vec2 vv = f - off * 0.3;
        float dd0 = length(vv);
        float ang = atan(vv.y, vv.x);
        float star = 0.62 + 0.38 * sin(ang * 7.0 + hash12(cell) * 6.28) * (0.55 + 0.45 * vnoise(vec2(ang * 2.5, hash12(cell) * 13.0)));
        float dd = dd0 / star;
        float tuft = (1.0 - smoothstep(0.06 + uCover * 0.42, 0.12 + uCover * 0.5, dd)) * step(0.02, uCover);
        float aa = clamp(length(fwidth(g)) * 1.2, 0.0, 1.0);
        float avgCover = uCover < 0.02 ? 0.0 : 0.25 + uCover * 0.6;
        float cover = mix(tuft, avgCover, aa);
        cover = mix(cover, 1.0, smoothstep(0.55, 0.97, graze) * (0.55 + uCover * 0.45) * step(0.02, uCover));
        float patchN = fbm(vWP.xz * 0.08);
        vec3 rc = mix(uRice, uRice2, clamp(patchN * 1.4 - 0.2 + hash12(cell) * 0.25, 0.0, 1.0));
        rc *= (0.82 + 0.3 * fbm(vWP.xz * 1.7)) * mix(0.55, 1.1, smoothstep(0.0, 0.32, dd0));
        // bunds between the fields
        float bund = 0.0;
        if (uBunds > 0.5) {
          vec2 b = abs(fract(vWP.xz / uBund + vec2(0.37, 0.61)) - 0.5) * uBund;
          float wob = (vnoise(vWP.xz * 0.35) - 0.5) * 0.25;
          bund = 1.0 - smoothstep(0.18, 0.32, min(b.x, b.y) + wob);
        }
        vec3 bundC = mix(vec3(0.20, 0.28, 0.11), vec3(0.33, 0.27, 0.16), vnoise(vWP.xz * 2.0));
        diffuseColor.rgb = mix(uWater, rc, cover);
        diffuseColor.rgb = mix(diffuseColor.rgb, bundC, bund);
        float wetness = (1.0 - cover) * (1.0 - bund);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.85, 0.035, wetness);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (wetness > 0.01) {
          vec2 q = vWP.xz * 4.0 + vec2(uTime * 0.5, uTime * 0.33);
          float h0 = fbm(q), hx = fbm(q + vec2(0.15, 0.0)), hz = fbm(q + vec2(0.0, 0.15));
          vec3 pert = vec3(h0 - hx, 0.0, h0 - hz) * 0.9 * wetness;
          normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz);
        }`);
  };
  return m;
}
export function fields(size = 400, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), paddyMaterial(opts));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

// ---------- reflective water sheet (for paddies close to camera) ----------
export function waterMaterial({ color = 0x23362e, opacity = 0.9, ripple = 1.0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.03, metalness: 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  m.customProgramCacheKey = () => `water:${ripple}`; // each ripple strength gets its own program (and its own uniforms)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME; sh.uniforms.uRip = { value: ripple };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform float uTime, uRip;\n${NOISE}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 q = vWP.xz * 5.0 + vec2(uTime * 0.6, uTime * 0.37);
        float h0 = fbm(q), hx = fbm(q + vec2(0.12, 0.0)), hz = fbm(q + vec2(0.0, 0.12));
        vec3 pert = vec3(h0 - hx, 0.0, h0 - hz) * 0.8 * uRip;
        normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz);`);
  };
  return m;
}

// ---------- birds: white egrets flapping across the sky ----------

// a readable bird: teardrop body, head + beak, fanned tail, and two-part cambered wings (inner + outer panel)
// so the silhouette reads as a bird from any angle. Forward +x, wings along +-z, up +y. flap(t, k) beats the wings.
export function birdMesh({ color = 0xf4f4f0, tip = 0x2a2a2e, beak = 0xe0a030, fingers = false } = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide });
  const mt = new THREE.MeshStandardMaterial({ color: tip, roughness: 0.75, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m); body.scale.set(0.3, 0.1, 0.11); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), m); head.position.set(0.3, 0.05, 0); g.add(head);
  const bk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.11, 8), new THREE.MeshStandardMaterial({ color: beak, roughness: 0.5 })); bk.rotation.z = -Math.PI / 2; bk.position.set(0.41, 0.04, 0); g.add(bk);
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 })); e.position.set(0.34, 0.08, sd * 0.05); g.add(e); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0.01, 0, -0.5, 0.0, 0.13, -0.53, 0.0, 0.0, -0.5, 0.0, -0.13], 3)); tg.setIndex([0, 1, 2, 0, 2, 3]); tg.computeVertexNormals(); g.add(new THREE.Mesh(tg, m));
  const panel = (le0, le1, te0, te1, span, camber) => { // grid panel: chord from te to le, span along +z
    const pos = [], idx = [], NU = 5, NV = 4;
    for (let j = 0; j <= NV; j++) { const v = j / NV; const le = le0 + (le1 - le0) * v, te = te0 + (te1 - te0) * v;
      for (let i = 0; i <= NU; i++) { const u = i / NU; pos.push(te + (le - te) * u, camber * Math.sin(Math.PI * u) * (1 - 0.5 * v), v * span); } }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  };
  const wings = [-1, 1].map(sd => {
    const inner = new THREE.Group(); inner.position.set(0.04, 0.04, sd * 0.08); g.add(inner);
    const gi = panel(0.13, 0.11, -0.17, -0.13, 0.4, 0.035); if (sd < 0) gi.scale(1, 1, -1); inner.add(new THREE.Mesh(gi, m));
    const outer = new THREE.Group(); outer.position.z = sd * 0.4; inner.add(outer);
    const go = panel(0.11, -0.04, -0.13, -0.12, 0.42, 0.025); if (sd < 0) go.scale(1, 1, -1); outer.add(new THREE.Mesh(go, m));
    const gt = panel(-0.01, -0.06, -0.125, -0.12, 0.14, 0.01); gt.translate(0, 0, 0.3); if (sd < 0) gt.scale(1, 1, -1); const tipM = new THREE.Mesh(gt, mt); tipM.position.y = 0.002; outer.add(tipM);
    if (fingers) for (let f = 0; f < 4; f++) { const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.12), m); fg.rotation.x = -Math.PI / 2; fg.position.set(-0.03 - f * 0.028, 0.0, sd * (0.45 + (f % 2) * 0.015)); outer.add(fg); }
    return { inner, outer, sd };
  });
  g.flap = (t, k = 1, ph = 0) => wings.forEach(({ inner, outer, sd }) => {
    const a = Math.sin(t * 9 + ph) * 0.6 * k + 0.12, b = Math.sin(t * 9 + ph - 0.7) * 0.45 * k + 0.05;
    inner.rotation.x = -sd * a; outer.rotation.x = -sd * b;
  });
  g.flap(0, 0);
  return g;
}
export function birds(n = 5, { from = [-30, 9, -25], to = [30, 12, -35], spread = 6, seed = 4, speed = 0.08, scale = 1 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.7, side: THREE.DoubleSide });
  const list = [];
  for (let i = 0; i < n; i++) {
    const b = birdMesh({ color: 0xf4f4f0, tip: 0x34343a, beak: 0xe0a030 }); const wl = null, wr = null;
    b.scale.setScalar(scale * (0.8 + R() * 0.4));
    const off = [(R() - 0.5) * spread, (R() - 0.5) * spread * 0.3, (R() - 0.5) * spread];
    list.push({ b, wl, wr, off, ph: R() * 6, sp: 0.85 + R() * 0.3 });
    g.add(b);
  }
  const A = new THREE.Vector3(...from), B = new THREE.Vector3(...to);
  const dir = B.clone().sub(A).normalize();
  g.update = (t) => {
    for (const o of list) {
      const k = (t * speed * o.sp + o.ph * 0.02) % 1;
      o.b.position.copy(A).lerp(B, k).add(new THREE.Vector3(...o.off));
      o.b.position.y += Math.sin(t * 1.2 + o.ph) * 0.3;
      o.b.rotation.y = -Math.atan2(dir.z, dir.x);
      // flap in bursts, glide in between (a constant flutter looks mechanical)
      const burst = 0.5 + 0.5 * Math.sin(t * 0.9 + o.ph); o.b.flap(t * o.sp, 0.25 + 0.75 * burst, o.ph);
    }
  };
  g.update(0);
  return g;
}

// ---------- hillside rice terraces following the contours ----------
export function terraces({ center = [0, 0, -8], levels = 16, r0 = 46, step = 2.5, rise = 0.6, thFrom = -1.25, thTo = 1.25, seed = 9 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const C = new THREE.Vector3(...center);
  const ph = [...Array(levels + 2)].map(() => [R() * 6, R() * 6, R() * 6]);
  const rOut = (i, th) => r0 - i * step + 0.9 * Math.sin(th * 3 + ph[i][0]) + 0.45 * Math.sin(th * 7.3 + ph[i][1]) + 0.2 * Math.sin(th * 15 + ph[i][2]);
  const nT = 140;
  const wallPos = [], wallCol = [], wallIdx = [];
  const grass = new THREE.Color(0x63972f), mud = new THREE.Color(0x5b6a2c), dark = new THREE.Color(0x3f5a22);
  for (let i = 0; i < levels; i++) {
    const y = i * rise;
    // paddy surface: annulus sector between this level's outer edge and the next level's
    const pos = [], idx = [];
    const nr = 3;
    for (let a = 0; a <= nT; a++) {
      const th = thFrom + (thTo - thFrom) * a / nT;
      const ro = rOut(i, th) - 0.15, ri = (i < levels - 1 ? rOut(i + 1, th) : rOut(i, th) - step) + 0.1;
      for (let b = 0; b <= nr; b++) {
        const r = ro + (ri - ro) * b / nr;
        pos.push(C.x + Math.sin(th) * r, C.y + y + 0.02, C.z + Math.cos(th) * r);
      }
    }
    for (let a = 0; a < nT; a++) for (let b = 0; b < nr; b++) {
      const p = a * (nr + 1) + b, q = p + nr + 1;
      idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
    const rr = R(); const cover = rr < 0.4 ? 0.55 + R() * 0.35 : rr < 0.75 ? 0.0 : 0.08 + R() * 0.15;
    const surf = new THREE.Mesh(sg, paddyMaterial({ cover, bunds: false, spacing: 0.24, rice: 0x5a9a2e, rice2: 0x9ccb4c }));
    surf.receiveShadow = true;
    g.add(surf);
    // riser: slope face, flat bund top and a short inner lip, as separate strips so the edges stay crisp
    const strips = [
      [[0.4, -rise - 0.06, mud], [0.12, -rise * 0.3, mud], [0.0, 0.08, grass]],
      [[0.0, 0.08, grass], [-0.27, 0.08, grass]],
      [[-0.27, 0.08, mud], [-0.29, -0.03, mud]],
    ];
    for (const rows of strips) {
      const base = wallPos.length / 3, nr = rows.length;
      for (let a = 0; a <= nT; a++) {
        const th = thFrom + (thTo - thFrom) * a / nT;
        const r = rOut(i, th);
        const sn = Math.sin(th), cs = Math.cos(th);
        for (const [dr, dy, col] of rows) {
          wallPos.push(C.x + sn * (r + dr), C.y + y + dy, C.z + cs * (r + dr));
          const n = 0.85 + 0.3 * Math.sin(th * 40 + i * 3) * Math.sin(th * 17 + dy * 9);
          wallCol.push(col.r * n, col.g * n, col.b * n);
        }
      }
      for (let a = 0; a < nT; a++) for (let b = 0; b < nr - 1; b++) {
        const p = base + a * nr + b, q = p + nr;
        wallIdx.push(p, q, p + 1, p + 1, q, q + 1);
      }
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wg.setAttribute('color', new THREE.Float32BufferAttribute(wallCol, 3));
  wg.setIndex(wallIdx); wg.computeVertexNormals();
  const walls = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  walls.receiveShadow = true; walls.castShadow = true;
  g.add(walls);
  // hilltop: a forested dome above the top terrace
  const topR = r0 - levels * step;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(topR + 1.5, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3d6a2c, roughness: 1 }));
  dome.scale.set(1, 0.45, 1); dome.position.set(C.x, C.y + levels * rise - 0.4, C.z); g.add(dome);
  g.rOut = rOut; g.levelY = (i) => C.y + i * rise; g.C = C;
  return g;
}

// ---------- low drifting mist ----------
export function mist(w = 80, d = 40, { y = 1, opacity = 0.35, color = 0xffffff, scale = 0.05 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShaderMaterial({
    uniforms: { uTime: TIME, uOp: { value: opacity }, uCol: { value: new THREE.Color(color) }, uS: { value: scale } },
    vertexShader: `varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vWP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vWP,1.); }`,
    fragmentShader: NOISE + `uniform float uTime, uOp, uS; uniform vec3 uCol; varying vec2 vUv; varying vec3 vWP;
      void main(){ float n = fbm(vWP.xz * uS + vec2(uTime * 0.03, uTime * 0.01));
        float a = smoothstep(0.35, 0.8, n) * uOp;
        a *= smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        gl_FragColor = vec4(uCol, a); }`,
    transparent: true, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 5;
  return m;
}
