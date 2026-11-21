// Character v2: one smooth skinned body (no visible joints), sculpted head with eyes, lids, brows and mouth,
// five-finger hands that curl, sandalled feet, linen kilt that follows the legs. Posed with FK on the spine and
// two-bone IK on arms and legs. Faces +Z, Y up, metres. Pure functions of the pose: no state between frames.
import * as THREE from 'three';
import { aimNegY } from './anim.js';
import { TIME } from './world.js';

const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const G = (v) => Math.exp(-v * v); // gaussian bump

// ---------- procedural textures (canvas, drawn at 2x) ----------
function noiseCanvas(size, seed, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const img = x.createImageData(size, size); let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  fn(img.data, size, rnd);
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// fine skin pores / fabric weave as bump maps
let _tex = null;
function texes() {
  if (_tex) return _tex;
  const pores = noiseCanvas(256, 3, (d, n, r) => { for (let i = 0; i < n * n; i++) { const v = 128 + (r() - 0.5) * 60; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } });
  pores.repeat.set(6, 6);
  const weave = noiseCanvas(256, 5, (d, n, r) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4; const w = (Math.sin(x * 1.6) * Math.sin(y * 1.6) > 0 ? 150 : 110) + (r() - 0.5) * 30 + Math.sin(y * 0.21 + r()) * 8;
      d[i] = d[i + 1] = d[i + 2] = w; d[i + 3] = 255;
    }
  });
  weave.repeat.set(10, 10);
  const hair = noiseCanvas(256, 8, (d, n, r) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = (y * n + x) * 4; const v = 120 + Math.sin(x * 0.9 + Math.sin(y * 0.15) * 3) * 50 + (r() - 0.5) * 50; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } });
  hair.repeat.set(8, 3);
  // linen roughness variation (v1.1): soft blotches in [0.8, 1] so the kilt's sheen isn't one even sheet
  const linenR = noiseCanvas(128, 13, (d, n, r) => { const v = new Float32Array(n * n).map(() => r()); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let a = 0; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) a += v[((y + j + n) % n) * n + ((x + i + n) % n)]; a /= 49;
    const g = Math.round(255 * (0.8 + 0.2 * Math.min(1, Math.max(0, (a - 0.5) * 6 + 0.5)))); const k = (y * n + x) * 4; d[k] = d[k + 1] = d[k + 2] = g; d[k + 3] = 255; } });
  linenR.repeat.set(3, 3); linenR.colorSpace = THREE.NoColorSpace;
  _tex = { pores, weave, hair, linenR };
  return _tex;
}

// linen flutter: small travelling ripples towards the hem (attribute hemk: 0 at the waist, 1 at the hem), applied
// before skinning so they ride on the swinging kilt. Own cache key (see nile.js windMaterial).
function kiltFlutter(m) {
  m.customProgramCacheKey = () => 'kiltFlutter';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float hemk;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ka = atan(position.x, position.z);
        float gust = 0.6 + 0.4 * sin(uTime * 0.9 + 1.3);
        float fl = (sin(ka * 7.0 + uTime * 6.1) + 0.55 * sin(ka * 12.0 - uTime * 8.3) + 0.35 * sin(ka * 3.0 + uTime * 3.7)) * gust;
        transformed += normalize(vec3(position.x, 0.0, position.z) + 1e-5) * hemk * hemk * 0.008 * fl;`);
  };
  return m;
}
// Skin shading (v1.1): light wraps a little past the terminator and comes back warm, like light scattered under skin
// (a cheap subsurface term, diffuse only: highlights still use the true angle). A soft view-facing rim lifts the
// silhouette off any background, and roughness varies slightly over the body so the highlights aren't one plastic
// sheet. The noise is taken from the rest-pose position, so it never swims as the character moves. Own cache key.
export const SKIN = { wrap: 0.5, sss: [1.0, 0.36, 0.2], sssK: 0.7, rim: 0.25, rimColor: [1.0, 0.9, 0.78], rough: 0.22, lit: [1.05, 1.0, 0.92], shade: [1.05, 0.85, 0.72], sky: [1.0, 0.8, 0.66], sat: 0.56 };
function skinShading(m, o = SKIN) {
  const key = 'skinShading:' + JSON.stringify(o);
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWrap = { value: o.wrap }; sh.uniforms.uSssK = { value: o.sssK }; sh.uniforms.uSss = { value: new THREE.Vector3(...o.sss) };
    sh.uniforms.uRim = { value: o.rim }; sh.uniforms.uRimC = { value: new THREE.Vector3(...o.rimColor) }; sh.uniforms.uRough = { value: o.rough };
    sh.uniforms.uLit = { value: new THREE.Vector3(...o.lit) }; sh.uniforms.uShade = { value: new THREE.Vector3(...o.shade) }; sh.uniforms.uSkinSat = { value: o.sat }; sh.uniforms.uSkyT = { value: new THREE.Vector3(...(o.sky || [1, 1, 1])) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSkinP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinP = position;');
    const from = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (!chunk.includes(from)) throw new Error('skinShading: three.js lighting chunk changed');
    const fromI = 'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
    if (!chunk.includes(fromI)) throw new Error('skinShading: three.js lighting chunk changed');
    const lit = chunk.replace(from, `{
        float nl = dot( geometryNormal, directLight.direction );
        float wrapped = saturate( ( nl + uWrap ) / ( 1.0 + uWrap ) );
        vec3 scatter = uSss * uSssK * max( wrapped - saturate( nl ), 0.0 ); // warm light past the terminator
        reflectedLight.directDiffuse += directLight.color * ( saturate( nl ) * uLit + scatter ) * BRDF_Lambert( material.diffuseColor );
      }`).replace(fromI, 'reflectedLight.indirectDiffuse += irradiance * uShade * BRDF_Lambert( material.diffuseColor );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uWrap, uSssK, uRim, uRough, uSkinSat; uniform vec3 uSss, uRimC, uLit, uShade, uSkyT; varying vec3 vSkinP;
        float skinHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float skinNoise( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( skinHash( i ), skinHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( skinHash( i + vec3( 0, 1, 0 ) ), skinHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( skinHash( i + vec3( 0, 0, 1 ) ), skinHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( skinHash( i + vec3( 0, 1, 1 ) ), skinHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }`)
      .replace('#include <lights_physical_pars_fragment>', lit)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        #if defined( RE_IndirectDiffuse )
          iblIrradiance *= uShade; // sky light on skin comes back warm (scattered under the skin), not lavender
        #endif
        #if defined( RE_IndirectSpecular )
          radiance *= uSkyT; clearcoatRadiance *= uSkyT;
        #endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ), diffuseColor.rgb, uSkinSat );`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp( roughnessFactor * ( 1.0 + uRough * ( skinNoise( vSkinP * 38.0 ) * 0.7 + skinNoise( vSkinP * 9.0 ) * 0.3 - 0.5 ) * 2.0 ), 0.05, 1.0 );`)
      .replace('#include <opaque_fragment>', `float skinNV = saturate( dot( normal, normalize( vViewPosition ) ) );
        outgoingLight += diffuseColor.rgb * uRimC * uRim * pow( 1.0 - skinNV, 3.0 );
        #include <opaque_fragment>`);
  };
  return m;
}

export function toonMaterials({ skin = 0x8e5434, cloth = 0xefe6d2, hair = 0x241a14, belt = 0x8a3a24 } = {}) {
  const T = texes();
  return {
    skin: skinShading(new THREE.MeshPhysicalMaterial({ color: skin, roughness: 0.55, bumpMap: T.pores, bumpScale: 0.25, sheen: 0.2, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffb08a), clearcoat: 0.12, clearcoatRoughness: 0.55 })),
    lip: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(skin).multiplyScalar(0.72).lerp(new THREE.Color(0x8a3a30), 0.25), roughness: 0.4, clearcoat: 0.3 }),
    cloth: kiltFlutter(new THREE.MeshStandardMaterial({ color: cloth, roughness: 1.0, roughnessMap: T.linenR, bumpMap: T.weave, bumpScale: 0.6, side: THREE.DoubleSide })),
    belt: new THREE.MeshStandardMaterial({ color: belt, roughness: 0.8, bumpMap: T.weave, bumpScale: 0.4 }),
    wool: new THREE.MeshStandardMaterial({ color: cloth, roughness: 1.0, roughnessMap: T.linenR, bumpMap: T.weave, bumpScale: 0.9, side: THREE.DoubleSide }),
    hair: new THREE.MeshStandardMaterial({ color: hair, roughness: 1.0, bumpMap: T.pores, bumpScale: 2.5 }),
    brow: new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.95 }),
    eyeW: new THREE.MeshPhysicalMaterial({ color: 0xe8dfd2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0x3a2414, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: 0x050302, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x2a0e0a, roughness: 0.9 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0xebe2cf, roughness: 0.45 }),
    sole: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x4a301a, roughness: 0.7 }),
  };
}

// Capped tube along -Y from the joint at y = 0: radius r(d) for d in [0, len], round caps of r(0) and r(len).
// weight(d) -> [[boneIndex, w], ...]. sx/sz flatten the cross-section.
function limbGeo(len, r, weight, { segs = 32, rows = 48, sx = 1, sz = 1 } = {}) {
  const pts = [];
  const r0 = r(0), r1 = r(len);
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([r0 * Math.sin(a), r0 * Math.cos(a)]); }
  for (let i = 1; i <= rows; i++) { const d = (i / rows) * len; pts.push([r(d), -d]); }
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([Math.max(1e-4, r1 * Math.cos(a)), -len - r1 * Math.sin(a)]); }
  pts[0][0] = 1e-4;
  pts.reverse(); // lathe profiles must run bottom -> top, otherwise the normals point inwards (dark, see-through limbs)
  const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), segs);
  g.scale(sx, 1, sz);
  skinByY(g, (y) => weight(-y));
  return g;
}
function skinByY(g, weight) {
  const p = g.attributes.position, n = p.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const ws = weight(p.getY(i), p.getX(i), p.getZ(i));
    let tot = 0; ws.forEach(([, w]) => tot += w);
    ws.slice(0, 4).forEach(([b, w], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = w / tot; });
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}
const blend2 = (a, b, x0, x1, x) => { const k = SS(x0, x1, x); return [[a, 1 - k], [b, k]]; };

// smooth radius profile through [d, r] keys (smoothstep between keys)
const prof = (keys) => (d) => {
  if (d <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [d0, r0] = keys[i], [d1, r1] = keys[i + 1]; if (d <= d1) return r0 + (r1 - r0) * SS(d0, d1, d); }
  return keys[keys.length - 1][1];
};

// outfit: 'kilt' (linen shendyt, bare chest) or 'tunic' (knee-length belted tunic with short sleeves, e.g. Roman or Greek)
export function toon({ skin, cloth, hair, belt, seed = 0, headScale = 1.08, outfit = 'kilt' } = {}) {
  const M = toonMaterials({ skin, cloth, hair, belt });
  const root = new THREE.Group();
  // ---------- skeleton ----------
  const B = {}; const list = [];
  const bone = (name, parent, pos) => { const b = new THREE.Bone(); b.name = name; b.position.set(...pos); (parent ? B[parent] : root).add(b); B[name] = b; list.push(b); return b; };
  bone('hips', null, [0, 0.98, 0]);
  bone('spine', 'hips', [0, 0.12, 0]);
  bone('kilt', 'hips', [0, 0.06, 0]); // swings the kilt's hem (secondary motion)
  bone('chest', 'spine', [0, 0.17, 0]);
  bone('neck', 'chest', [0, 0.2, -0.005]);
  bone('head', 'neck', [0, 0.088, 0.005]); // a slightly shorter neck
  for (const [s, sx] of [['l', 1], ['r', -1]]) {
    bone(s + 'Sh', 'chest', [sx * 0.185, 0.145, -0.012]); bone(s + 'El', s + 'Sh', [0, -0.28, 0]); bone(s + 'Wr', s + 'El', [0, -0.255, 0]);
    bone(s + 'Hip', 'hips', [sx * 0.093, -0.07, 0]); bone(s + 'Kn', s + 'Hip', [0, -0.43, 0]); bone(s + 'An', s + 'Kn', [0, -0.42, 0]);
  }
  const I = Object.fromEntries(list.map((b, i) => [b.name, i]));
  root.updateMatrixWorld(true);
  const wpos = (n) => B[n].getWorldPosition(V3(0, 0, 0));
  const skinned = [];
  const addSkinned = (geo, mat, name = '') => { const m = new THREE.SkinnedMesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; root.add(m); skinned.push(m); return m; };

  // ---------- torso (pelvis to neck base), weights hips -> spine -> chest ----------
  // torsoGeo(off, y0, y1): the same shaped body, pushed out by off (a tunic over it uses off > 0 and the same weights,
  // so cloth follows every bend of the body underneath)
  const torsoW = (y) => y < 1.04 ? [[I.hips, 1]] : y < 1.22 ? blend2(I.hips, I.spine, 1.04, 1.22, y).concat() : y < 1.42 ? blend2(I.spine, I.chest, 1.22, 1.36, y) : blend2(I.chest, I.neck, 1.44, 1.52, y);
  const torsoGeo = (off = 0, y0 = 0.84, y1 = 1.505, closed = true, loose = false) => {
    const R = prof([[0.84, 0.13], [0.9, 0.152], [1.0, 0.142], [1.08, 0.138], [1.2, 0.158], [1.3, 0.17], [1.38, 0.168], [1.44, 0.15], [1.49, 0.1], [1.52, 0.04], [1.53, 0.001]]); // fuller trapezius slope up into the neck
    const pts = closed ? [[0.001, y0 - 0.02]] : [];
    // loose cloth: a little extra fullness above the belt (it blouses over it), none at the neck
    const ofs = (y) => off + (loose ? 0.016 * G((y - 1.1) / 0.08) + 0.006 * SS(1.45, 1.2, y) : 0);
    for (let i = 0; i <= 64; i++) { const y = y0 + (y1 - y0) * i / 64; pts.push([R(y) + ofs(y), y]); }
    if (loose) { // cloth doesn't follow every change of curvature: smooth the profile (removes faint bands across the chest)
      const n0 = closed ? 1 : 0, rr = pts.map(q => q[0]);
      for (let pass = 0; pass < 3; pass++) for (let i = n0 + 1; i < pts.length - 1; i++) pts[i][0] = (rr[i - 1] + 2 * rr[i] + rr[i + 1]) / 4, rr[i] = pts[i][0];
    }
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), loose ? 72 : 48);
    // shape: wide shoulders, flatter front-to-back, a little chest and belly in front, shoulder blades behind
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const sxw = 1.12 + 0.3 * SS(1.2, 1.41, y) * (1 - SS(1.45, 1.5, y)); // shoulders wide enough to tuck the arm caps in
      x *= sxw; z *= 0.66;
      if (loose) { // cloth bridges the muscles (no chest or shoulder blades) and hangs in soft vertical folds below the chest
        const a = Math.atan2(x, z), f = 1 + 0.022 * SS(1.32, 1.12, y) * (Math.sin(a * 7 + 0.4) * 0.7 + Math.sin(a * 13 + 1.9) * 0.3);
        x *= f; z *= f; if (z > 0) z += 0.01 * SS(1.18, 1.3, y) * (1 - SS(1.36, 1.44, y));
      } else {
      if (z > 0) z += 0.018 * SS(1.18, 1.3, y) * (1 - SS(1.36, 1.44, y)) * G((Math.abs(x) - 0.08) / 0.09); // chest
      if (z > 0) z += 0.012 * SS(0.92, 1.0, y) * (1 - SS(1.06, 1.14, y)) * G(x / 0.1); // belly
      if (z < 0) z -= 0.01 * SS(1.22, 1.32, y) * (1 - SS(1.38, 1.44, y)) * G((Math.abs(x) - 0.07) / 0.06);
      }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    skinByY(g, torsoW);
    return g;
  };
  addSkinned(torsoGeo(), M.skin, 'torso');
  // ---------- neck ----------
  {
    const g = limbGeo(0.2, prof([[0, 0.072], [0.08, 0.066], [0.2, 0.066]]), // d is measured down from the top: the top (inside the head) follows the head, the base follows the chest
      (d) => d < 0.1 ? blend2(I.head, I.neck, 0.02, 0.09, d) : blend2(I.neck, I.chest, 0.13, 0.2, d), { sz: 0.92 });
    g.translate(0, 1.645, -0.005); g.computeBoundingSphere();
    addSkinned(g, M.skin);
  }
  // ---------- arms ----------
  for (const s of ['l', 'r']) {
    const sh = wpos(s + 'Sh');
    const g = limbGeo(0.545, prof([[0, 0.058], [0.06, 0.058], [0.16, 0.053], [0.26, 0.041], [0.29, 0.039], [0.34, 0.043], [0.44, 0.036], [0.52, 0.029], [0.545, 0.028]]),
      (d) => d < 0.2 ? [[I[s + 'Sh'], 1]] : blend2(I[s + 'Sh'], I[s + 'El'], 0.24, 0.32, d), { sz: 0.92 });
    g.translate(sh.x, sh.y, sh.z);
    addSkinned(g, M.skin);
  }
  // ---------- legs ----------
  for (const s of ['l', 'r']) {
    const hp = wpos(s + 'Hip');
    const g = limbGeo(0.86, prof([[0, 0.085], [0.12, 0.08], [0.32, 0.064], [0.42, 0.05], [0.46, 0.05], [0.55, 0.056], [0.66, 0.048], [0.8, 0.033], [0.86, 0.032]]),
      (d) => d < 0.34 ? [[I[s + 'Hip'], 1]] : d < 0.8 ? blend2(I[s + 'Hip'], I[s + 'Kn'], 0.38, 0.48, d) : blend2(I[s + 'Kn'], I[s + 'An'], 0.82, 0.88, d), { sz: 0.95 });
    g.translate(hp.x, hp.y, hp.z);
    addSkinned(g, M.skin);
  }
  // ---------- linen kilt (shendyt): pleated, flared, follows the thighs at the hem ----------
  if (outfit === 'kilt') {
    const pts = [];
    for (let i = 40; i >= 0; i--) { const k = i / 40; const y = 1.05 - k * 0.47; pts.push([0.168 + 0.022 * Math.sin(k * 3) + 0.05 * k * k + 0.025 * k, y]); } // bottom -> top (a fairly straight kilt)
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 96);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z), k = (1.05 - y) / 0.47;
      const pleat = 1 + 0.035 * k * Math.sin(a * 22) + 0.02 * k * Math.sin(a * 7 + 1);
      const front = z > 0 ? 1 + 0.05 * k * G((a - 0.35) / 0.25) : 1; // the wrap's overlapping front panel
      x *= 1.16 * pleat * front; z *= 0.78 * pleat * front;
      p.setXYZ(i, x, y - 0.03 * k * k * Math.cos(a) * (z > 0 ? 1 : 0.5), z);
    }
    g.computeVertexNormals();
    skinByY(g, (y, x) => {
      const k = SS(1.03, 0.75, y) * 0.7 * Math.min(1, Math.abs(x) / 0.07); const leg = x > 0 ? I.lHip : I.rHip;
      const h = (1 - k) * 0.75 * SS(1.0, 0.62, y); // the hem swings on the kilt bone
      return [[I.hips, 1 - k - h], [leg, k], [I.kilt, h]];
    });
    const hk = new Float32Array(p.count); for (let i = 0; i < p.count; i++) hk[i] = SS(1.0, 0.6, p.getY(i)); g.setAttribute('hemk', new THREE.BufferAttribute(hk, 1));
    addSkinned(g, M.cloth, 'kilt');
  }
  // ---------- tunic: body shell (the torso's own shape, pushed out, same weights), a skirt that swings on the kilt bone,
  // short sleeves on the upper arms. Open at the neck and the hem; the belt hides the seam at the waist. ----------
  if (outfit === 'tunic') {
    addSkinned(torsoGeo(0.02, 0.99, 1.492, false, true), M.wool, 'tunic');
    const pts = [];
    for (let i = 40; i >= 0; i--) { const k = i / 40; const y = 1.06 - k * 0.47; pts.push([0.172 + 0.02 * Math.sin(k * 3) + 0.045 * k * k + 0.02 * k, y]); } // bottom -> top
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 96);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z), k = (1.06 - y) / 0.47;
      const fold = 1 + 0.03 * k * Math.sin(a * 9 + 0.6) + 0.015 * k * Math.sin(a * 5 + 2.1); // soft wool folds, not pleats
      x *= 1.14 * fold; z *= 0.8 * fold;
      p.setXYZ(i, x, y - 0.015 * k * k * Math.cos(a), z);
    }
    g.computeVertexNormals();
    skinByY(g, (y, x) => {
      const k = SS(1.03, 0.75, y) * 0.7 * Math.min(1, Math.abs(x) / 0.07); const leg = x > 0 ? I.lHip : I.rHip;
      const h = (1 - k) * 0.75 * SS(1.0, 0.62, y);
      return [[I.hips, 1 - k - h], [leg, k], [I.kilt, h]];
    });
    const hk = new Float32Array(p.count); for (let i = 0; i < p.count; i++) hk[i] = SS(1.0, 0.6, p.getY(i)); g.setAttribute('hemk', new THREE.BufferAttribute(hk, 1));
    addSkinned(g, M.cloth, 'kilt'); // named 'kilt' so the kilt probes and F.kilt() work on it too
    for (const s of ['l', 'r']) { // short sleeves: open at the elbow end, the top tucks into the shell
      // wide enough to carry the shoulder line down past the armpit (a T-tunic), so the arm comes out of the sleeve's hem,
      // not from under the body of the tunic
      const sh = wpos(s + 'Sh'), L = 0.21, sp = [];
      for (let i = 0; i <= 14; i++) { const d = L - (i / 14) * L; sp.push([0.078 + 0.014 * (d / L), -d]); }
      for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; sp.push([Math.max(1e-4, 0.078 * Math.cos(a)), 0.066 * Math.sin(a)]); } // dome over the arm's shoulder cap
      const sg = new THREE.LatheGeometry(sp.map(([a, b]) => new THREE.Vector2(a, b)), 32); sg.scale(1, 1, 0.92);
      skinByY(sg, () => [[I[s + 'Sh'], 1]]); sg.translate(sh.x, sh.y, sh.z);
      addSkinned(sg, M.wool, 'sleeve');
    }
  }
  // belt sash (rigid, on the hips)
  {
    const g = new THREE.TorusGeometry(0.163, 0.012, 10, 64); g.rotateX(Math.PI / 2); if (outfit === 'tunic') g.scale(1.29, 1.5, 0.95); else g.scale(1.17, 1.6, 0.8); // over the tunic's skirt top
    const m = new THREE.Mesh(g, M.belt); m.position.y = 0.065; m.castShadow = true; B.hips.add(m);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), M.belt); knot.scale.set(1.1, 0.8, 0.6); knot.position.set(0.06, 0.062, 0.118); B.hips.add(knot);
  }

  // ---------- head ----------
  const head = new THREE.Group(); head.position.set(0, 0.075, 0.012); head.scale.setScalar(headScale); B.head.add(head);
  const R = 0.118;
  // head shape from a unit direction (nx, ny, nz). Every regional change is blended smoothly (no if-cutoffs: a hard
  // switch at nz = 0 left a crease from the ear to the chin). The hair cap uses the same function, so it hugs the head.
  const headShape = (nx, ny, nz, rad) => {
    let x = nx * rad * 0.86, y = ny * rad * 1.06, z = nz * rad * 0.98;
    const back = SS(0.25, -0.25, nz), front = 1 - back;
    const jaw = SS(-0.15, -0.95, ny); x *= 1 - 0.12 * jaw; z *= 1 - 0.12 * jaw * (0.3 + 1.1 * back);
    z += rad * 0.08 * jaw * G(nx / 0.45) * SS(0.0, 0.4, nz);                                 // chin
    z *= 1 + back * (0.06 + 0.06 * SS(-0.2, 0.5, ny));                                      // back of skull
    const fz = SS(0.15, 0.45, nz);
    z -= rad * 0.085 * fz * Math.exp(-(((Math.abs(nx) - 0.31) / 0.16) ** 2 + ((ny - 0.03) / 0.13) ** 2));                // eye sockets (centred on the eyes)
    const c = fz * Math.exp(-(((Math.abs(nx) - 0.48) / 0.2) ** 2 + ((ny + 0.25) / 0.2) ** 2)); z += rad * 0.03 * c; x += Math.sign(nx) * rad * 0.02 * c; // cheeks
    z += rad * 0.035 * fz * Math.exp(-(((Math.abs(nx) - 0.33) / 0.3) ** 2 + ((ny - 0.25) / 0.07) ** 2));                // brow ridge
    z -= rad * 0.05 * fz * Math.exp(-((nx / 0.2) ** 2 + ((ny + 0.56) / 0.075) ** 2));                                    // mouth hollow: teeth and the dark opening sit in it
    void front; return [x, y, z];
  };
  {
    const g = new THREE.SphereGeometry(R, 64, 48); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = headShape(p.getX(i) / R, p.getY(i) / R, p.getZ(i) / R, R); p.setXYZ(i, v[0], v[1], v[2]); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.skin); m.castShadow = m.receiveShadow = true; head.add(m);
  }
  const part = (geo, mat, pos, rot = [0, 0, 0], sc = [1, 1, 1], parent = head) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...sc); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  // nose: bridge + tip + nostril wings
  part(new THREE.CapsuleGeometry(0.0085, 0.03, 6, 16), M.skin, [0, -0.011, 0.108], [-0.3, 0, 0], [1.0, 1, 0.78]);
  part(new THREE.SphereGeometry(0.0112, 24, 16), M.skin, [0, -0.034, 0.119], [0.3, 0, 0], [1.12, 0.82, 0.92]);
  const nostrils = [-1, 1].map(s => part(new THREE.SphereGeometry(0.0068, 16, 12), M.skin, [s * 0.0112, -0.038, 0.111], [0, 0, 0], [0.9, 0.72, 0.9]));
  // ears
  // ears: a flattened shell, a rim (helix) that follows its outline, a darker bowl inside and an earlobe
  const earIn = skinShading(new THREE.MeshPhysicalMaterial({ color: M.skin.color.clone().multiplyScalar(0.7), roughness: 0.6 })); // follows the skin tone
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.1, -0.008, -0.016); ear.rotation.y = s * 0.3; head.add(ear);
    part(new THREE.SphereGeometry(0.03, 24, 16), M.skin, [0, 0, 0], [0, 0, 0], [0.34, 1, 0.66], ear);
    part(new THREE.SphereGeometry(0.019, 16, 12), earIn, [s * 0.0085, 0.003, 0.002], [0, 0, 0], [0.12, 0.85, 0.6], ear); // the bowl
    part(new THREE.SphereGeometry(0.008, 12, 10), M.skin, [s * 0.002, -0.026, 0.004], [0, 0, 0], [0.6, 1, 0.9], ear);
  }
  // eyes: off-white ball set into the socket, iris with a dark limbal ring and a lighter ring round the pupil,
  // upper lid with a lash line (it follows the gaze up and down), lower lid, thin tapered brows
  const eyes = [], lids = [], lows = [], brows = [], gaze = [0, 0];
  const irisTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 9); g.addColorStop(0, '#c08a4c'); g.addColorStop(0.5, '#8a5428'); g.addColorStop(0.82, '#5a3416'); g.addColorStop(1, '#1c1008');
    x.fillStyle = g; x.fillRect(0, 0, 4, 9); x.fillStyle = '#1c1008'; x.fillRect(0, 9, 4, 55); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const irisM = new THREE.MeshPhysicalMaterial({ map: irisTex, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.03 });
  const lashM = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const er = 0.021;
    const eg = new THREE.Group(); eg.position.set(s * 0.035, 0.004, 0.0835); head.add(eg);
    part(new THREE.SphereGeometry(er, 32, 24), M.eyeW, [0, 0, 0], [0, 0, 0], [1, 1, 1], eg);
    const look = new THREE.Group(); eg.add(look);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(er * 1.004, 40, 14, 0, Math.PI * 2, 0, 0.44), irisM); iris.rotation.x = Math.PI / 2; look.add(iris);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(er * 1.008, 32, 8, 0, Math.PI * 2, 0, 0.17), M.pupil); pup.rotation.x = Math.PI / 2; look.add(pup);
    eyes.push(look);
    // upper lid: a shell slightly bigger than the eye; rotating it about X opens/closes; dark lash line on its rim
    const lid = new THREE.Mesh(new THREE.SphereGeometry(er * 1.1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), M.skin); lid.castShadow = true; eg.add(lid); lids.push(lid);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(er * 1.1, er * 0.085, 6, 32, Math.PI), lashM); lash.rotation.x = Math.PI / 2; lash.scale.set(1.02, 1, 1); lid.add(lash);
    const low = new THREE.Mesh(new THREE.SphereGeometry(er * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), M.skin); eg.add(low); lows.push(low);
    const bc = new THREE.CatmullRomCurve3([V3(-0.02, -0.003, -0.004), V3(-0.005, 0.003, 0.003), V3(0.014, 0.002, 0.0), V3(0.026, -0.005, -0.008)]);
    const bg = new THREE.TubeGeometry(bc, 24, 0.0036, 8, false);
    const bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); const k = 1 - 0.55 * Math.max(0, (x + 0.005) / 0.031); const c = bc.getPoint(Math.min(1, Math.max(0, (x + 0.02) / 0.046))); bp.setY(i, c.y + (bp.getY(i) - c.y) * k); bp.setZ(i, c.z + (bp.getZ(i) - c.z) * k); } bg.computeVertexNormals(); // taper to the outer end
    const brow = new THREE.Group(); brow.position.set(s * 0.037, 0.036, 0.104); brow.scale.x = s; head.add(brow);
    const bm = new THREE.Mesh(bg, M.brow); bm.castShadow = true; brow.add(bm); brows.push(brow);
  }
  // mouth: one shape drives everything. Corners rise for a smile (fall for strain); the lips open by `gap`.
  // Upper and lower lips are tapered tubes along the outer curves, the dark opening is filled exactly between the
  // inner curves, and the teeth sit just inside the upper (and for a clench, the lower) inner curve. Built in the
  // mouth hollow sculpted into the head, and wrapped around the face (corners sit further back).
  const mouth = new THREE.Group(); mouth.position.set(0, -0.07, 0.098); head.add(mouth);
  const lipUm = new THREE.Mesh(new THREE.BufferGeometry(), M.lip), lipLm = new THREE.Mesh(new THREE.BufferGeometry(), M.lip);
  const openM = new THREE.Mesh(new THREE.BufferGeometry(), M.mouth), seam = new THREE.Mesh(new THREE.BufferGeometry(), M.mouth);
  [lipUm, lipLm, openM, seam].forEach(m => mouth.add(m)); lipUm.castShadow = lipLm.castShadow = true;
  const teethG = new THREE.Group(); mouth.add(teethG); const toothGeo = new THREE.CapsuleGeometry(0.0026, 0.003, 4, 10);
  const upperT = [...Array(6)].map(() => { const m = new THREE.Mesh(toothGeo, M.teeth); teethG.add(m); return m; });
  const lowerT = [...Array(6)].map(() => { const m = new THREE.Mesh(toothGeo, M.teeth); teethG.add(m); return m; });
  const wrapZ = (x, w) => -0.0055 * (x / w) ** 2;                   // the mouth follows the face's curve
  const curve = (w, yEnd, yMid, z0 = 0) => { const c = new THREE.QuadraticBezierCurve3(V3(-w, yEnd, wrapZ(w, w) + z0), V3(0, 2 * yMid - yEnd, z0 + 0.0025), V3(w, yEnd, wrapZ(w, w) + z0)); return c; };
  // tube with a radius profile r(u) (fat in the middle, pinched at the corners)
  const taperTube = (c, rMid, rEnd, segs = 28) => {
    const g = new THREE.TubeGeometry(c, segs, 1, 10, false); const p = g.attributes.position;
    for (let i = 0; i <= segs; i++) { const u = i / segs, cp = c.getPointAt(u), r = rEnd + (rMid - rEnd) * Math.sin(Math.PI * u) ** 0.7;
      for (let j = 0; j <= 10; j++) { const v = i * 11 + j; p.setXYZ(v, cp.x + (p.getX(v) - cp.x) * r, cp.y + (p.getY(v) - cp.y) * r, cp.z + (p.getZ(v) - cp.z) * r); } }
    g.computeVertexNormals(); return g;
  };
  let mouthKey = '';
  const setMouth = (smile, gap, w, clench) => {
    const key = [smile, gap, w, clench ? 1 : 0].map(v => v.toFixed(3)).join(); if (key === mouthKey) return; mouthKey = key;
    const yEnd = smile * 0.011, yMid = -smile * 0.004;                 // corners up, centre down for a smile
    const inU = curve(w, yEnd, yMid + gap * 0.45), inL = curve(w, yEnd, yMid - gap * 0.55);
    const outU = curve(w * 1.02, yEnd + 0.0006, yMid + gap * 0.45 + 0.0032), outL = curve(w * 0.98, yEnd - 0.0008, yMid - gap * 0.55 - 0.0042);
    lipUm.geometry.dispose(); lipUm.geometry = taperTube(outU, 0.0034, 0.0012);
    lipLm.geometry.dispose(); lipLm.geometry = taperTube(outL, 0.0044, 0.0012);
    seam.geometry.dispose(); seam.geometry = taperTube(curve(w * 0.99, yEnd, yMid), 0.0015, 0.0008); seam.visible = gap < 0.002;
    // opening: polygon between the inner curves, pushed back into the hollow
    const pts = []; for (let i = 0; i <= 24; i++) { const q = inU.getPoint(i / 24); pts.push(q); } for (let i = 24; i >= 0; i--) { const q = inL.getPoint(i / 24); pts.push(q); }
    const pos = [], idx = []; const cx = 0, cy = (yMid); pos.push(cx, cy, -0.004);
    pts.forEach(q => pos.push(q.x, q.y, q.z - 0.003)); for (let i = 1; i < pts.length; i++) idx.push(0, i, i + 1); idx.push(0, pts.length, 1);
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); og.setIndex(idx); og.computeVertexNormals();
    openM.geometry.dispose(); openM.geometry = og; openM.visible = gap > 0.0015; openM.material.side = THREE.DoubleSide;
    const place = (row, c, dy, sc) => row.forEach((m, i) => { const u = 0.16 + 0.68 * (i + 0.5) / 6; const p = c.getPoint(u), tg = c.getTangent(u);
      const big = 1 - 0.3 * Math.abs(u - 0.5) * 2; m.position.set(p.x, p.y + dy * big, p.z - 0.0016); m.rotation.set(0, (u - 0.5) * 0.9, Math.atan2(tg.y, tg.x)); m.scale.set(big, big * sc, 0.7); });
    place(upperT, inU, -0.0022, 1); place(lowerT, inL, 0.0022, 0.9); lowerT.forEach(m => { m.visible = clench; });
  };
  // short hair cap with a hairline, plus a little beard shadow on the jaw
  {
    const g = new THREE.SphereGeometry(R, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.53); const p = g.attributes.position; // close-cropped hair
    const tilt = new THREE.Matrix4().makeRotationX(-0.55); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(tilt).divideScalar(R); // tilted back: hairline high on the forehead, low at the nape
      const q = headShape(v.x, v.y, v.z, R * 1.012); p.setXYZ(i, q[0], q[1], q[2]);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.hair); m.castShadow = true; head.add(m);
  }

  // ---------- hands: palm + 4 two-segment fingers + thumb; curl 0..1 ----------
  const fingers = { l: [], r: [] };
  for (const [s, sx] of [['l', 1], ['r', -1]]) {
    const h = new THREE.Group(); h.position.y = -0.005; B[s + 'Wr'].add(h);
    // palm (a rounded slab), palm faces -x on the left hand (towards the body at rest)
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 20), M.skin); palm.scale.set(0.42, 1.05, 0.9); palm.position.set(0, -0.045, 0); palm.castShadow = true; h.add(palm);
    const fl = [0.042, 0.047, 0.045, 0.037], fz = [0.03, 0.01, -0.01, -0.028];
    for (let k = 0; k < 4; k++) {
      const f1 = new THREE.Group(); f1.position.set(0, -0.09, fz[k] * 0.95); h.add(f1);
      const seg = (len, r) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), M.skin); m.position.y = -len / 2; m.castShadow = true; return m; };
      f1.add(seg(fl[k] * 0.52, 0.0095));
      const f2 = new THREE.Group(); f2.position.y = -fl[k] * 0.55; f1.add(f2); f2.add(seg(fl[k] * 0.45, 0.0088));
      fingers[s].push([f1, f2]);
    }
    const th = new THREE.Group(); th.position.set(-sx * 0.012, -0.03, 0.04); th.rotation.set(0.5, 0, sx * 0.5); h.add(th);
    const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.035, 6, 12), M.skin); t1.position.y = -0.02; t1.castShadow = true; th.add(t1);
    fingers[s].thumb = th;
  }
  // ---------- feet: foot + toes on a sandal ----------
  for (const s of ['l', 'r']) {
    const f = new THREE.Group(); B[s + 'An'].add(f);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 20), M.skin); foot.scale.set(0.72, 0.55, 1.75); foot.position.set(0, -0.03, 0.045); foot.castShadow = true; f.add(foot);
    const toes = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), M.skin); toes.scale.set(1.15, 0.5, 0.9); toes.position.set(0, -0.045, 0.13); toes.castShadow = true; f.add(toes);
    const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.17, 6, 16), M.sole); sole.rotation.x = Math.PI / 2; sole.scale.set(1.05, 1, 0.16); sole.position.set(0, -0.066, 0.05); sole.castShadow = sole.receiveShadow = true; f.add(sole);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 24, Math.PI), M.strap); strap.position.set(0, -0.06, 0.1); strap.scale.set(1, 0.6, 1); f.add(strap);
  }

  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  skinned.forEach(m => m.bind(skeleton, m.matrixWorld.clone()));
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------- posing API ----------
  const rest = Object.fromEntries(list.map(b => [b.name, b.position.clone()]));
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const F = {
    root, bones: B, M,
    // reset to rest, then FK on the trunk: { hips: [y offset, z offset], hipRot: [x,y,z], spine, chest, neck, head }
    pose({ hipsY = 0, hipsZ = 0, hipsX = 0, hipRot = [0, 0, 0], spine = [0, 0, 0], chest = [0, 0, 0], neck = [0, 0, 0], headR = [0, 0, 0] } = {}) {
      list.forEach(b => { b.position.copy(rest[b.name]); b.quaternion.identity(); });
      B.hips.position.set(hipsX, rest.hips.y + hipsY, hipsZ); B.hips.rotation.set(...hipRot);
      B.spine.rotation.set(...spine); B.chest.rotation.set(...chest); B.neck.rotation.set(...neck); B.head.rotation.set(...headR);
      // arms hang slightly away from the body by default
      B.lSh.rotation.z = 0.12; B.rSh.rotation.z = -0.12; B.lEl.rotation.x = -0.15; B.rEl.rotation.x = -0.15;
      root.updateMatrixWorld(true);
    },
    // FK an arm: shoulder [x,y,z], elbow bend (radians, forward), wrist [x,y,z]
    armFK(s, sh, el, wr = [0, 0, 0]) { B[s + 'Sh'].rotation.set(...sh); B[s + 'El'].rotation.set(-el, 0, 0); B[s + 'Wr'].rotation.set(...wr); root.updateMatrixWorld(true); },
    // two-bone IK: put the palm centre at target (world). pole = where the elbow should point (world).
    // hint = world direction the back of the hand / palm normal should roughly face.
    armIK(s, target, pole, hint = V3(0, 0, 1)) {
      const a = 0.28, b = 0.255 + 0.07;
      root.updateMatrixWorld(true);
      const S = B[s + 'Sh'].getWorldPosition(V3(0, 0, 0));
      const D = target.clone().sub(S); const d = Math.min(D.length(), a + b - 1e-3); const dir = D.normalize();
      const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
      const p = pole.clone().sub(S); p.addScaledVector(dir, -p.dot(dir)); if (p.lengthSq() < 1e-8) p.set(0, 0, -1); p.normalize();
      const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(p, a * sinA);
      aimNegY(B[s + 'Sh'], E.clone().sub(S), hint);
      aimNegY(B[s + 'El'], S.clone().addScaledVector(dir, d).sub(E), hint);
      B[s + 'Wr'].quaternion.identity(); root.updateMatrixWorld(true);
    },
    // two-bone IK: ankle to target (world), knee towards pole; foot kept level, pointing along yaw (radians, world)
    legIK(s, target, pole, footYaw = null) {
      const a = 0.43, b = 0.42;
      root.updateMatrixWorld(true);
      const S = B[s + 'Hip'].getWorldPosition(V3(0, 0, 0));
      const D = target.clone().sub(S); const d = Math.min(D.length(), a + b - 1e-3); const dir = D.normalize();
      const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
      const p = pole.clone().sub(S); p.addScaledVector(dir, -p.dot(dir)); if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
      const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(p, a * sinA);
      const fwd = V3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(_q));
      aimNegY(B[s + 'Hip'], E.clone().sub(S), fwd);
      aimNegY(B[s + 'Kn'], S.clone().addScaledVector(dir, d).sub(E), fwd);
      // level foot: world rotation = root yaw (+ optional extra yaw)
      root.getWorldQuaternion(_q); if (footYaw) _q.multiply(_q2.setFromAxisAngle(V3(0, 1, 0), footYaw));
      B[s + 'Kn'].getWorldQuaternion(_q2); B[s + 'An'].quaternion.copy(_q2.invert().multiply(_q));
      root.updateMatrixWorld(true);
    },
    // curl the fingers (0 open .. 1 fist)
    grip(l = 0, r = l) {
      for (const [s, k, sx] of [['l', l, 1], ['r', r, -1]]) {
        fingers[s].forEach(([f1, f2], i) => { f1.rotation.set(0, 0, -sx * (0.25 + 1.2 * k) * (1 - i * 0.04)); f2.rotation.set(0, 0, -sx * (0.2 + 1.4 * k)); });
        fingers[s].thumb.rotation.set(0.5 + 0.5 * k, 0, sx * (0.5 - 0.6 * k));
      }
    },
    // face: brow -1 (frown/strain) .. 1 (raised), smile -1..1, open 0..1, blink 0..1, squint 0..1
    // wide: eyes open wider (surprise, relief); oh: round open mouth (a 'phew'); flare: nostrils (effort); cheek: cheeks lift (real smile)
    face({ brow = 0, smile = 0, open = 0, blink = 0, squint = 0, teeth = 0, wide = 0, oh = 0, flare = 0, cheek = 0 } = {}) {
      // brows: the group is mirrored with scale.x = s, and scale applies before rotation, so the angle carries s too.
      // angle > 0 drops the inner ends (frown / strain), < 0 lifts them (surprise / worry)
      brows.forEach((b, i) => { const s = i ? 1 : -1; b.position.y = 0.036 + brow * 0.006 - squint * 0.004; b.rotation.set(0, 0, s * (brow < 0 ? -brow * 0.35 : -brow * 0.12)); });
      const shut = Math.min(1, Math.max(blink, squint * 0.45));
      // upper lid = top hemisphere shell. Tilting its pole back (-x rotation) opens it: at -0.6 the front edge sits
      // 34 degrees above the eye centre (open, relaxed); at +0.45 it passes below the centre (closed).
      // the upper lid follows the gaze up and down (looking down lowers it), so no bare white shows above the iris
      lids.forEach((l, i) => l.rotation.set(-0.55 - 0.28 * wide * (1 - shut) + 1.0 * shut + gaze[i] * 0.6 * (1 - shut), 0, 0));
      // lower lid = small cap pointing down; squinting tilts it forward so it rises over the eye
      lows.forEach((l, i) => l.rotation.set(Math.PI - 0.3 * squint - 0.16 * cheek + 0.08 * wide + gaze[i] * 0.25, 0, 0));
      nostrils.forEach(n => n.scale.set(0.9 * (1 + 0.3 * flare), 0.7 * (1 + 0.15 * flare), 0.9));
      // gap: how far the lips part (teeth showing, an open 'oh', talking); an 'oh' also narrows the mouth
      const gap = Math.max(open * 0.012, teeth * 0.0075, oh * 0.016);
      const w = (0.019 + Math.max(0, smile) * 0.004) * (1 - 0.35 * oh);
      setMouth(smile * (1 - oh), gap, w, smile < 0.25 && teeth > 0.3);
      teethG.visible = teeth > 0.05; mouth.position.y = -0.07 + smile * 0.002;
    },
    // swing the kilt's hem: x = forwards/back, z = sideways (radians)
    kilt(x = 0, z = 0) { B.kilt.rotation.set(x, 0, z); root.updateMatrixWorld(true); },
    // eyes look at a world point
    look(target) {
      root.updateMatrixWorld(true);
      eyes.forEach(e => {
        const p = e.getWorldPosition(V3(0, 0, 0)); const lt = e.parent.worldToLocal(target.clone()); void p;
        const yaw = Math.atan2(lt.x, lt.z), pitch = Math.atan2(-lt.y, Math.hypot(lt.x, lt.z));
        // a natural range: about 20 degrees each way (further, and the iris slides into the corner leaving a bare white eye)
        const pc = Math.max(-0.3, Math.min(0.3, pitch)); e.rotation.set(pc, Math.max(-0.36, Math.min(0.36, yaw)), 0); gaze[eyes.indexOf(e)] = pc;
      });
    },
    // turn the head (neck + head bones) towards a world point, by amount k
    headAt(target, k = 1) {
      root.updateMatrixWorld(true);
      const hp = B.head.getWorldPosition(V3(0, 0, 0)); const lt = B.neck.parent.worldToLocal(target.clone()).sub(B.neck.position);
      void hp;
      const yaw = Math.atan2(lt.x, lt.z) * k, pitch = -Math.atan2(lt.y - 0.25, Math.hypot(lt.x, lt.z)) * k;
      B.neck.rotation.set(pitch * 0.45, yaw * 0.45, 0); B.head.rotation.set(pitch * 0.55, yaw * 0.55, 0);
      root.updateMatrixWorld(true);
    },
  };
  F.pose(); F.grip(0.3); F.face({ smile: 0.2 });
  return F;
}
