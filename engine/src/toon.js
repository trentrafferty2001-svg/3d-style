// Character v2: one smooth skinned body (no visible joints), sculpted head with eyes, lids, brows and mouth,
// five-finger hands that curl, sandalled feet, linen kilt that follows the legs. Posed with FK on the spine and
// two-bone IK on arms and legs. Faces +Z, Y up, metres. Pure functions of the pose: no state between frames.
import * as THREE from 'three';
import { aimNegY } from './anim.js';
import { TIME } from './world.js';
import { addHair } from './hair.js';

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

// Cloth shading (v1.14, replaces the v1.0 kiltFlutter):
//  - flutter: small travelling ripples towards the hem (attribute hemk: 0 at the waist, 1 at the hem), before skinning
//    so they ride on the swinging skirt;
//  - legs push the skirt: after skinning, any skirt point inside a leg's capsule (hip-knee-ankle, uniforms set from the
//    bones before every draw) is pushed out to its surface plus a little room, so a stepping thigh or a bent knee moves
//    the cloth instead of poking through it. clothPush() below is the same function in JS, for the probes;
//  - linen wrinkles: fine creases as normal detail, mostly running down the cloth, taken from the rest-pose position so
//    they never swim. Own cache key (see nile.js windMaterial).
export const CLOTH = { wrinkle: 1.6, room: 0.012 };
if (typeof location !== 'undefined' && /[?&]nowrinkle/.test(location.search)) CLOTH.wrinkle = 0; // ?nowrinkle: a check without the creases
export const LEG_R = [0.088, 0.056, 0.046];                     // leg capsule radius at hip, knee, ankle (rest scale)
function clothShading(m, { name, wrinkle = CLOTH.wrinkle } = {}) {
  m.customProgramCacheKey = () => 'clothShading:' + name + ':' + wrinkle;
  const U = m.userData.legs = { uLeg: { value: [...Array(6)].map(() => new THREE.Vector3(0, -9, 0)) }, uLegR: { value: new THREE.Vector3(...LEG_R) }, uRoom: { value: CLOTH.room } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME; Object.assign(sh.uniforms, U); sh.uniforms.uWrinkle = { value: CLOTH.wrinkle ? wrinkle : 0 }; // ?nowrinkle turns every cloth's creases off
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        uniform float uTime, uRoom; uniform vec3 uLeg[6]; uniform vec3 uLegR; attribute float hemk; varying vec3 vRest;
        // out of a leg's capsule, always outwards from the body's centre line C (straight out from the leg, cloth on the
        // inner side of a thigh went in between the legs)
        vec3 legPush( vec3 p, vec3 a, vec3 b, float ra, float rb, vec3 C ) {
          vec3 ab = b - a; float h = clamp( dot( p - a, ab ) / dot( ab, ab ), 0.0, 1.0 ); vec3 c = a + ab * h;
          vec3 d = p - c; d.y *= 0.25; float L = length( d ), r = mix( ra, rb, h ) + uRoom, e = 0.012;
          if ( L >= r + 4.0 * e || L < 1e-5 ) return vec3( 0.0 );
          // soft: the new distance r + e*softplus((L - r)/e) rises with the old one, so neighbouring points never pass each
          // other (a hard push onto the surface crumpled the cloth over a knee)
          float L2 = r + e * log( 1.0 + exp( ( L - r ) / e ) );
          vec3 n = p - C; n.y = 0.0; n = normalize( n + vec3( 1e-5, 0.0, 0.0 ) );
          return n * ( L2 - L ) / max( dot( n, d / L ), 0.5 ); }
        // a lifted thigh carries the cloth in front of it: from the waist over the top of the knee, then hanging down
        // (s = how far down the skirt this point is, from the waist); tents across to the other leg
        vec3 legDrape( vec3 p, float s, vec3 H, vec3 K ) {
          vec3 t = normalize( K - H ); float wl = smoothstep( 0.25, 0.75, 1.0 + t.y ); if ( wl <= 0.0 ) return p;
          vec3 f = normalize( vec3( t.x, 0.0, t.z ) + 1e-5 ), sd = normalize( cross( vec3( 0.0, 1.0, 0.0 ), f ) );
          float lat = dot( p - H, sd ), w = wl * exp( - lat * lat / 0.0121 ) * smoothstep( -0.04, 0.06, dot( p - H, f ) ) * smoothstep( 0.0, 0.08, s );
          if ( w <= 0.0 ) return p;
          vec3 W = H + vec3( 0.0, 0.15, 0.0 ) + f * 0.13 + sd * lat, Kt = K + vec3( 0.0, uLegR.y + uRoom + 0.004, 0.0 ) + sd * lat * 0.85;
          float L1 = length( Kt - W );
          vec3 q = s <= L1 ? W + ( Kt - W ) * ( s / L1 ) : Kt + normalize( vec3( f.x * 0.15, -1.0, f.z * 0.15 ) ) * ( s - L1 );
          return mix( p, q, w ); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRest = position;
        float ka = atan(position.x, position.z);
        float gust = 0.6 + 0.4 * sin(uTime * 0.9 + 1.3);
        float fl = (sin(ka * 7.0 + uTime * 6.1) + 0.55 * sin(ka * 12.0 - uTime * 8.3) + 0.35 * sin(ka * 3.0 + uTime * 3.7)) * gust;
        transformed += normalize(vec3(position.x, 0.0, position.z) + 1e-5) * hemk * hemk * 0.008 * fl;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        { float below = smoothstep( 1.035, 0.985, position.y );   // the skirt below the belt meets the legs (fading in from 1.02 to 0.9, a walking thigh came 5 cm out at the back)
          if ( below > 0.0 ) { vec3 q = transformed; float sk = 1.06 - position.y;
            for ( int i = 0; i < 2; i++ ) q = legDrape( q, sk, uLeg[i * 3], uLeg[i * 3 + 1] );
            vec3 C = ( uLeg[0] + uLeg[3] ) * 0.5;
            for ( int it = 0; it < 4; it++ ) { int i = it % 2; vec3 hp = uLeg[i * 3], kn = uLeg[i * 3 + 1], an = uLeg[i * 3 + 2]; // both legs, twice
              q += legPush( q, hp, kn, uLegR.x, uLegR.y, C ); q += legPush( q, kn, an, uLegR.y, uLegR.z, C ); }
            transformed = mix( transformed, q, below ); } }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uWrinkle; varying vec3 vRest;
        float clHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float clNoise( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( clHash( i ), clHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( clHash( i + vec3( 0, 1, 0 ) ), clHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( clHash( i + vec3( 0, 0, 1 ) ), clHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( clHash( i + vec3( 0, 1, 1 ) ), clHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
        // creases: ridged noise stretched along the cloth's fall (long in y), plus a finer crinkle
        // round the body on a circle (no seam at the back, where an angle would jump), long in y: creases run down the cloth
        float clothH( vec3 p ) { vec2 c = normalize( p.xz + 1e-5 ) * 5.8;
          vec3 q = vec3( c.x + clNoise( p * 6.0 ) * 0.8, c.y, p.y * 5.0 );
          float r = 1.0 - abs( clNoise( q ) * 2.0 - 1.0 ), r2 = 1.0 - abs( clNoise( q * vec3( 1.9, 1.9, 2.2 ) + 7.0 ) * 2.0 - 1.0 );
          return r * r * 0.65 + r2 * r2 * 0.35; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { // the crease's gradient is taken exactly at this pixel (finite differences in the rest pose) and carried to the
          // screen by the rest position's own derivatives, which are smooth over a triangle. Taking dFdx of the crease
          // height itself stepped in 2x2-pixel blocks on the side of the chest.
          const float e = 0.0015; float h0 = clothH( vRest );
          vec3 g = vec3( clothH( vRest + vec3( e, 0.0, 0.0 ) ) - h0, clothH( vRest + vec3( 0.0, e, 0.0 ) ) - h0, clothH( vRest + vec3( 0.0, 0.0, e ) ) - h0 ) / e;
          vec3 px = dFdx( vRest ), py = dFdy( vRest ); vec2 dH = vec2( dot( g, px ), dot( g, py ) );
          float face = abs( dot( normal, normalize( vViewPosition ) ) );
          // faded at grazing angles and where a crease is finer than the pixels (it would alias)
          float fine = length( g ) * max( length( px ), length( py ) );
          dH *= uWrinkle * smoothstep( 0.15, 0.45, face ) * ( 1.0 - smoothstep( 0.05, 0.18, fine ) );
          normal = perturbNormalArb( - vViewPosition, normal, dH, faceDirection ); }`);
  };
  return m;
}
// JS twin of the shader's leg push (for probes): p in the cloth mesh's space, legs = [hip, knee, ankle] x 2 in the same
// space, k = the character's scale
export function clothPush(p, restY, legs, k = 1) {
  if (restY >= 1.035) return p;
  const below = SS(1.035, 0.985, restY), q = p.clone(), sk = 1.06 - restY;
  for (let i = 0; i < 2; i++) { // legDrape, as in the shader
    const H = legs[i * 3], K = legs[i * 3 + 1], t = K.clone().sub(H).normalize(), wl = SS(0.25, 0.75, 1 + t.y); if (wl <= 0) continue;
    const f = new THREE.Vector3(t.x, 0, t.z).addScalar(1e-5).normalize(), sd = new THREE.Vector3(0, 1, 0).cross(f).normalize();
    const lat = q.clone().sub(H).dot(sd), w = wl * Math.exp(-lat * lat / 0.0121) * SS(-0.04, 0.06, q.clone().sub(H).dot(f)) * SS(0, 0.08, sk); if (w <= 0) continue;
    const W = H.clone().add(new THREE.Vector3(0, 0.15, 0)).addScaledVector(f, 0.13).addScaledVector(sd, lat), Kt = K.clone().add(new THREE.Vector3(0, LEG_R[1] + CLOTH.room + 0.004, 0)).addScaledVector(sd, lat * 0.85);
    const L1 = Kt.distanceTo(W), tgt = sk <= L1 ? W.clone().lerp(Kt, sk / L1) : Kt.clone().addScaledVector(new THREE.Vector3(f.x * 0.15, -1, f.z * 0.15).normalize(), sk - L1);
    q.lerp(tgt, w);
  }
  const C = legs[0].clone().add(legs[3]).multiplyScalar(0.5);
  const push = (a, b, ra, rb) => { const ab = b.clone().sub(a), h = Math.min(1, Math.max(0, q.clone().sub(a).dot(ab) / ab.dot(ab))), c = a.clone().addScaledVector(ab, h);
    const d = q.clone().sub(c); d.y *= 0.25; const L = d.length(), r = (ra + (rb - ra) * h) * k + CLOTH.room * k, e = 0.012; if (L >= r + 4 * e || L < 1e-5) return;
    const L2 = r + e * Math.log(1 + Math.exp((L - r) / e));
    const n = q.clone().sub(C); n.y = 0; n.x += 1e-5; n.normalize(); q.addScaledVector(n, (L2 - L) / Math.max(n.dot(d.clone().divideScalar(L)), 0.5)); };
  for (let it = 0; it < 4; it++) { const i = it % 2; push(legs[i * 3], legs[i * 3 + 1], LEG_R[0], LEG_R[1]); push(legs[i * 3 + 1], legs[i * 3 + 2], LEG_R[1], LEG_R[2]); } // both legs, twice
  return p.clone().lerp(q, below);
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
    cloth: clothShading(new THREE.MeshStandardMaterial({ color: cloth, roughness: 1.0, roughnessMap: T.linenR, bumpMap: T.weave, bumpScale: 0.22, side: THREE.DoubleSide }), { name: 'linen' }),
    belt: new THREE.MeshStandardMaterial({ color: belt, roughness: 0.8, bumpMap: T.weave, bumpScale: 0.4 }),
    wool: clothShading(new THREE.MeshStandardMaterial({ color: cloth, roughness: 1.0, roughnessMap: T.linenR, bumpMap: T.weave, bumpScale: 0.3, side: THREE.DoubleSide }), { name: 'wool', wrinkle: 1.3 }),
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

const rng = (seed) => { let s = (Math.abs(seed) * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
// outfit: 'kilt' (linen shendyt, bare chest) or 'tunic' (knee-length belted tunic with short sleeves, e.g. Roman or Greek)
// hairStyle: 'crop' (default), 'curls', 'braids', 'shaved', 'headcloth' or 'cap' (the v1.0 smooth cap, a skullcap);
// beard: 'none', 'stubble', 'short', 'full' (hair.js, v1.15)
export function toon({ skin, cloth, hair, belt, seed = 0, headScale = 1.08, outfit = 'kilt', hairStyle = 'crop', beard = 'none', beardColor = null } = {}) {
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
  const TR = prof([[0.84, 0.13], [0.9, 0.152], [1.0, 0.142], [1.08, 0.138], [1.2, 0.158], [1.3, 0.17], [1.38, 0.168], [1.44, 0.15], [1.49, 0.1], [1.52, 0.04], [1.53, 0.001]]);
  const torsoGeo = (off = 0, y0 = 0.84, y1 = 1.505, closed = true, loose = false) => {
    const R = prof([[0.84, 0.13], [0.9, 0.152], [1.0, 0.142], [1.08, 0.138], [1.2, 0.158], [1.3, 0.17], [1.38, 0.168], [1.44, 0.15], [1.49, 0.1], [1.52, 0.04], [1.53, 0.001]]); // fuller trapezius slope up into the neck
    const pts = closed ? [[0.001, y0 - 0.02]] : [];
    // loose cloth: a little extra fullness above the belt (it blouses over it), none at the neck
    const ofs = (y) => off + (loose ? 0.016 * G((y - 1.1) / 0.08) + 0.006 * SS(1.45, 1.2, y) : 0);
    const rows = loose ? 110 : 64; for (let i = 0; i <= rows; i++) { const y = y0 + (y1 - y0) * i / rows; pts.push([R(y) + ofs(y), y]); }
    if (loose) { // cloth doesn't follow every change of curvature: smooth the profile (removes faint bands across the chest)
      const n0 = closed ? 1 : 0, rr = pts.map(q => q[0]);
      for (let pass = 0; pass < 10; pass++) for (let i = n0 + 1; i < pts.length - 1; i++) pts[i][0] = (rr[i - 1] + 2 * rr[i] + rr[i + 1]) / 4, rr[i] = pts[i][0];
    }
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), loose ? 180 : 48);
    // shape: wide shoulders, flatter front-to-back, a little chest and belly in front, shoulder blades behind
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const sxw = 1.12 + 0.3 * SS(1.2, 1.41, y) * (1 - SS(1.45, 1.5, y)); // shoulders wide enough to tuck the arm caps in
      x *= sxw; z *= 0.66;
      if (loose) { // cloth bridges the muscles (no chest or shoulder blades), and the tunic adds its folds (v1.14)
        if (z > 0) z += 0.01 * SS(1.18, 1.3, y) * (1 - SS(1.36, 1.44, y));
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
  // the bare torso's radius by angle a = atan2(x, z) and height (exact for the lathe and its x/z scaling; the chest and
  // belly bumps are added as their peaks): the cloth is cinched onto it under the belt
  const bodyR = (a, y) => { const R = TR(y), A = R * (1.12 + 0.3 * SS(1.2, 1.41, y) * (1 - SS(1.45, 1.5, y))), Bz = R * 0.66;
    const e = 1 / Math.sqrt((Math.sin(a) / A) ** 2 + (Math.cos(a) / Bz) ** 2);
    return e + (Math.cos(a) > 0 ? Math.cos(a) * 0.012 * SS(0.92, 1.0, y) * (1 - SS(1.06, 1.14, y)) : 0); };
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
  // ---------- cloth (v1.14): folds that follow the body. Every garment is a lathe shell deformed by its own fold field:
  // gathers where the belt pinches the cloth, opening into fewer, deeper folds towards the hem, a hem that rises and
  // falls with them, pull folds from the armpits, a shoulder that rounds into the sleeve. The cloth is cinched onto
  // the body under the belt, and the belt is built on the cloth's own cross-section (it used to float off the back). ----------
  const R0 = rng(seed * 7 + 3), ph = [...Array(8)].map(() => R0() * 6.283); // seeded fold phases: no two people fold alike
  const YB = 1.045;                                                      // belt height (rest)
  const skirtWeights = (y, x) => {
    // the thighs carry the skirt a little (0.35: at 0.7 a raised thigh swung the skirt's side up like a sail and showed
    // its inside); the legs' drape and push in clothShading do the rest
    const k = SS(1.03, 0.75, y) * 0.35 * Math.min(1, Math.abs(x) / 0.07); const leg = x > 0 ? I.lHip : I.rHip;
    const h = (1 - k) * 0.75 * SS(1.0, 0.62, y); // the hem swings on the kilt bone
    return [[I.hips, 1 - k - h], [leg, k], [I.kilt, h]];
  };
  const hemAttr = (g) => { const p = g.attributes.position, hk = new Float32Array(p.count); for (let i = 0; i < p.count; i++) hk[i] = SS(1.0, 0.6, p.getY(i)); g.setAttribute('hemk', new THREE.BufferAttribute(hk, 1)); };
  const zeroHem = (g) => g.setAttribute('hemk', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  // pull a point radially (about the body's axis) so its distance is r
  const toRadius = (x, z, r) => { const L = Math.hypot(x, z) || 1e-6; return [x / L * r, z / L * r]; };
  // a skirt: top at y0 (just above the belt), length len; widths and fold style per garment
  const skirt = ({ y0, len, r0, flare, sx, sz, pleats = 0, folds = 1, front = 0 }) => {
    const pts = [];
    for (let i = 60; i >= 0; i--) { const k = i / 60; const y = y0 - k * len; pts.push([r0 + 0.02 * Math.sin(k * 3) + flare * k * k + 0.022 * k, y]); } // bottom -> top
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 220);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z), k = (y0 - y) / len;
      // gathers under the belt (many small folds) open into a few deep ones at the hem; phases wander a little with
      // height so the folds aren't ruled lines
      const w = a + 0.06 * Math.sin(y * 11 + ph[0]);
      const gath = 0.55 * Math.sin(w * 19 + ph[1]) + 0.45 * Math.sin(w * 26 + ph[2]);
      const drape = 0.55 * Math.sin(w * 9 + ph[3] + 0.4 * Math.sin(w * 2 + ph[4])) + 0.3 * Math.sin(w * 5 + ph[5]) + 0.15 * Math.sin(w * 14 + ph[6]);
      const mix = SS(0.05, 0.6, k), f = gath * (1 - mix) + drape * mix;
      let dr = folds * (0.0035 * SS(0.0, 0.08, k) * (1 - mix) + 0.03 * k * mix) * f;
      if (pleats) dr += pleats * k * Math.sin(a * 22) + 0.4 * pleats * k * Math.sin(a * 7 + 1);
      // the wrap's outer panel: proud of the layer under it, ending in a crisp vertical edge at the front
      if (front) dr += (0.004 + front * k) * SS(-1.3, -0.9, a) * (1 - SS(0.5, 0.58, a));
      const r = Math.hypot(x, z) + dr; [x, z] = toRadius(x, z, r);
      x *= sx; z *= sz;
      y -= 0.03 * k * k * Math.cos(a) * (z > 0 ? 1 : 0.5) * (front ? 1 : 0.5); // apron hem lower in front
      y -= 0.012 * folds * k * k * (f + 1) * 0.5;                              // fold crests hang a little lower: a wavy hem
      // cinch: the top of the skirt is pulled onto the body under the belt
      const c = SS(YB - 0.03, YB - 0.018, y);
      if (c > 0) { const rb = bodyR(Math.atan2(x, z), y) + 0.011, rr = Math.hypot(x, z); [x, z] = toRadius(x, z, rr + (rb - rr) * c); }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); skinByY(g, skirtWeights); hemAttr(g); return g;
  };
  let clothParts = [];
  const ShJ = { l: wpos('lSh'), r: wpos('rSh') };
  if (outfit === 'kilt') {
    clothParts.push(addSkinned(skirt({ y0: 1.06, len: 0.48, r0: 0.168, flare: 0.05, sx: 1.16, sz: 0.78, pleats: 0.035 * 0.17, folds: 0.25, front: 0.012 }), M.cloth, 'kilt'));
  }
  // ---------- tunic: the body shell (the torso's own shape pushed out, same weights, folded), a skirt that swings on
  // the kilt bone, and short sleeves that grow out of the shoulder. The belt hides the seam at the waist. ----------
  if (outfit === 'tunic') {
    const g = torsoGeo(0.02, 0.99, 1.492, false, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(x, z), ax = Math.abs(x), sx = Math.sign(x) || 1;
      let r = Math.hypot(x, z);
      // blousing: soft gathers just above the belt, fading up the chest; their phases follow the skirt's
      const w = a + 0.1 * Math.sin(y * 9 + ph[0] + a * 2) + 0.04 * Math.sin(a * 5 + ph[4]);
      const bl = SS(YB + 0.0, YB + 0.03, y) * (1 - SS(YB + 0.05, YB + 0.2, y + 0.04 * Math.sin(a * 3 + ph[6])));
      r += 0.0055 * bl * (0.5 * Math.sin(w * 13 + ph[1]) + 0.3 * Math.sin(w * 7 + ph[7]) + 0.2 * Math.sin(w * 22 + ph[3]));
      // pull folds: from each armpit diagonally down and in across the chest and the back (cloth hanging from the
      // shoulder and caught at the belt), two or three soft ridges that fade out
      const u = (ax - 0.215) * 0.62 + (y - 1.33) * 0.78, v = -(ax - 0.215) * 0.78 + (y - 1.33) * 0.62; // u across, v along a fold
      const band = SS(0.02, -0.04, v) * SS(-0.24, -0.1, v) * SS(-0.05, 0.0, u) * SS(0.09, 0.03, u);
      r += 0.0045 * band * Math.sin(u * 95 + ph[2]) * (z > 0 ? 1 : 0.8);
      // back: a soft vertical fold either side of the spine
      if (z < 0) r += 0.003 * G((ax - 0.07) / 0.025) * SS(1.08, 1.2, y) * (1 - SS(1.3, 1.42, y));
      [x, z] = toRadius(x, z, r);
      // the shoulder: the cloth rounds over the arm's cap (deltoid) instead of a flat top meeting the sleeve at a corner
      { const J = ShJ[sx > 0 ? 'l' : 'r'], d = V3(x, y, z).sub(J), L = d.length(), rho = 0.078, e = 0.018; // broad and soft: a tighter one read as a ball on each shoulder
        if (L < rho + 3 * e && L > 1e-4 && d.y > -0.1) { const L2 = L + e * Math.log1p(Math.exp((rho - L) / e)) - e * Math.log1p(Math.exp(-3)); const k = SS(-0.1, 0.0, d.y);
          const n = V3(sx * Math.max(sx * d.x, 0), Math.max(d.y, 0), d.z).normalize(); // outwards and up only: pushed towards the neck it went under the skin
          const q = V3(x, y, z).addScaledVector(n, (Math.max(L, L2) - L) * k); x = q.x; y = q.y; z = q.z; } }
      // cinch at the belt: the bottom edge is pulled onto the body
      const c = SS(YB + 0.03, YB + 0.018, y);
      if (c > 0) { const rb = bodyR(a, y) + 0.009, rr = Math.hypot(x, z); [x, z] = toRadius(x, z, rr + (rb - rr) * c); }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); zeroHem(g);
    skinByY(g, torsoW); // the shell stays on the chest: the arm's cap turns inside the rounded shoulder
    clothParts.push(addSkinned(g, M.wool, 'tunic'));
    { // a rolled hem round the neckline
      const rows = p.count / 181, pts = []; // lathe order: 181 columns of `rows` points, bottom to top; the last is the neckline
      for (let c = 0; c < 180; c += 2) { const j = c * rows + rows - 1; pts.push(V3(p.getX(j), p.getY(j) - 0.002, p.getZ(j))); }
      const ng = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.0045, 8, true); skinByY(ng, torsoW); zeroHem(ng);
      clothParts.push(addSkinned(ng, M.wool, 'neckline'));
    }
    clothParts.push(addSkinned(skirt({ y0: 1.065, len: 0.475, r0: 0.172, flare: 0.045, sx: 1.14, sz: 0.8, folds: 1 }), M.cloth, 'kilt')); // named 'kilt' so the kilt probes and F.kilt() work on it too
    for (const s of ['l', 'r']) { // short sleeves: open at the elbow end, the top tucks into the shell
      // wide enough to carry the shoulder line down past the armpit (a T-tunic), so the arm comes out of the sleeve's hem,
      // not from under the body of the tunic. v1.14: a little flare and soft folds round the hem, a hem that isn't
      // ruler-straight, and the dome over the shoulder partly follows the chest, so a raised arm stretches the cloth
      // between them instead of lifting a rigid tube out of the shell.
      const sh = wpos(s + 'Sh'), L = 0.21, sp = [];
      // the top is tucked inside the shell (6.6 cm, the arm is 5.8): at 7.8 cm its side lay within a millimetre of the shell's
      // and the two z-fought in stepped patches. It widens below the shell's edge and flares to the hem.
      const sr = (d) => 0.066 + 0.012 * SS(0.0, 0.07, d) + 0.024 * (d / L) ** 1.3;
      for (let i = 0; i <= 24; i++) { const d = L - (i / 24) * L; sp.push([sr(d), -d]); }
      for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; sp.push([Math.max(1e-4, 0.066 * Math.cos(a)), 0.04 * Math.sin(a)]); } // a low dome over the arm's cap, inside the shell (which rounds over the cap)
      const sg = new THREE.LatheGeometry(sp.map(([a, b]) => new THREE.Vector2(a, b)), 72); sg.scale(1, 1, 0.92);
      const q = sg.attributes.position;
      for (let i = 0; i < q.count; i++) { let x = q.getX(i), y = q.getY(i), z = q.getZ(i); const a = Math.atan2(x, z), d = Math.max(0, -y) / L;
        const f = 0.6 * Math.sin(a * 6 + ph[3] + (s === 'l' ? 0 : 1.7)) + 0.4 * Math.sin(a * 11 + ph[5]);
        const r = Math.hypot(x, z) + 0.004 * d * d * f; [x, z] = toRadius(x, z, r); y -= 0.006 * d * d * (f + 1) * 0.5;
        q.setXYZ(i, x, y, z); }
      sg.computeVertexNormals();
      skinByY(sg, (y) => { const k = 1 - 0.5 * SS(0.0, 0.05, y); return [[I[s + 'Sh'], k], [I.chest, 1 - k]]; });
      sg.translate(sh.x, sh.y, sh.z); zeroHem(sg); // the dome's top half stays with the chest: a raised arm lifted it out of the shell
      clothParts.push(addSkinned(sg, M.wool, 'sleeve'));
    }
  }
  // the legs push the skirt (clothShading): leg capsules in the cloth's space, set from the bones before every draw
  const legPts = () => ['l', 'r'].flatMap(s => [s + 'Hip', s + 'Kn', s + 'An'].map(n => clothParts[0].worldToLocal(B[n].getWorldPosition(V3(0, 0, 0)))));
  for (const mesh of clothParts) mesh.onBeforeRender = () => { const L = mesh.material.userData.legs; if (L) legPts().forEach((v, i) => L.uLeg.value[i].copy(v)); };
  // belt sash (rigid, on the hips), laid round the cloth's own cross-section at belt height so it sits on the cloth
  {
    // the cloth under the belt is cinched to the body + 1.1 cm (the skirt, the outer layer), so the belt is laid on that
    const N = 96, cin = outfit === 'tunic' || outfit === 'kilt' ? 0.011 : 0.004;
    const sm2 = [...Array(N)].map((_, i) => bodyR((i / N) * 2 * Math.PI, YB) + cin);
    const tr = 0.011, loop = new THREE.CatmullRomCurve3(sm2.map((r, i) => { const a = (i / N) * 2 * Math.PI; return V3(Math.sin(a) * (r + tr * 0.45), 0, Math.cos(a) * (r + tr * 0.45)); }), true);
    const bg = new THREE.TubeGeometry(loop, 160, tr, 10, true); bg.scale(1, 1.55, 1);
    const m = new THREE.Mesh(bg, M.belt); m.position.y = YB - 0.98; m.castShadow = true; B.hips.add(m);
    const kr = sm2[Math.round(0.45 / (2 * Math.PI) * N)];
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), M.belt); knot.scale.set(1.1, 0.8, 0.6);
    knot.position.set(Math.sin(0.45) * (kr + 0.014), YB - 0.98 - 0.003, Math.cos(0.45) * (kr + 0.014)); knot.rotation.y = 0.45; B.hips.add(knot);
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
    const pos = [], idx = []; const cx = 0, cy = (yMid); pos.push(cx, cy, -0.0032);
    // the fill sits just behind the lips: further back, the mouth hollow's skin shows in front of it
    pts.forEach(q => pos.push(q.x, q.y, q.z - 0.0012)); for (let i = 1; i < pts.length; i++) idx.push(0, i, i + 1); idx.push(0, pts.length, 1);
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); og.setIndex(idx); og.computeVertexNormals();
    openM.geometry.dispose(); openM.geometry = og; openM.visible = gap > 0.0015; openM.material.side = THREE.DoubleSide;
    const place = (row, c, dy, sc) => row.forEach((m, i) => { const u = 0.16 + 0.68 * (i + 0.5) / 6; const p = c.getPoint(u), tg = c.getTangent(u);
      const big = 1 - 0.3 * Math.abs(u - 0.5) * 2; m.position.set(p.x, p.y + dy * big, p.z - 0.0016); m.rotation.set(0, (u - 0.5) * 0.9, Math.atan2(tg.y, tg.x)); m.scale.set(big, big * sc, 0.7); });
    place(upperT, inU, -0.0022, 1); place(lowerT, inL, 0.0022, 0.9); lowerT.forEach(m => { m.visible = clench; });
  };
  // hair and beard (hair.js): shells laid on headShape, seeded
  const hairMeshes = addHair({ head, headShape, R, style: hairStyle, beard, hair: hair ?? 0x241a14, beardColor, skin: M.skin.color, seed, M });

  // ---------- hands: palm + 4 three-joint fingers + a two-joint thumb (v1.8) ----------
  // Hand frame (wrist bone): fingers point along -y, the thumb/index side is +z, the palm faces -x on the left hand and +x
  // on the right (towards the body at rest). Each finger segment keeps its line (start, end, radius) for the grasp
  // solver and the grip probe.
  const fingers = { l: [], r: [] };
  const FR = [0.0098, 0.009, 0.0082];                                   // finger radii: base, middle, tip
  for (const [s, sx] of [['l', 1], ['r', -1]]) {
    const h = new THREE.Group(); h.position.y = -0.005; B[s + 'Wr'].add(h);
    // palm (a rounded slab)
    // palm: flatter and a little wider than before (it read as an egg)
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 20), M.skin); palm.scale.set(0.36, 1.0, 0.95); palm.position.set(0, -0.045, 0); palm.castShadow = true; h.add(palm);
    const fl = [0.05, 0.056, 0.053, 0.043], fz = [0.03, 0.01, -0.01, -0.028];
    const seg = (len, r) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), M.skin); m.position.y = -len / 2; m.castShadow = true; return m; };
    for (let k = 0; k < 4; k++) {
      const L = [fl[k] * 0.44, fl[k] * 0.3, fl[k] * 0.24];
      const j1 = new THREE.Group(); j1.position.set(0, -0.088, fz[k] * 0.95); h.add(j1); j1.add(seg(L[0], FR[0]));
      const j2 = new THREE.Group(); j2.position.y = -L[0] - 0.002; j1.add(j2); j2.add(seg(L[1], FR[1]));
      const j3 = new THREE.Group(); j3.position.y = -L[1] - 0.002; j2.add(j3); j3.add(seg(L[2], FR[2]));
      const f = [j1, j2, j3]; f.len = [L[0] + 0.002, L[1] + 0.002, L[2] + FR[2]]; fingers[s].push(f);
    }
    // thumb: a base joint that swings across the palm (opposition) and a tip joint that bends
    const th = new THREE.Group(); th.position.set(-sx * 0.012, -0.03, 0.04); h.add(th);
    th.add(seg(0.028, 0.0118));
    const th2 = new THREE.Group(); th2.position.y = -0.03; th.add(th2); th2.add(seg(0.02, 0.0113)); // nearly as thick as the base, or the joint shows as a ring
    const t = [th, th2]; t.len = [0.03, 0.02 + 0.0113]; fingers[s].thumb = t;
  }
  // thumb pose by direction (hand frame): k = 0 rests down and out beside the index finger, a little to the palm side;
  // k = 1 swings across the palm side towards the fingers (a grip); the tip bends with it. (Set by rotation angles, the
  // old thumb leaned out through the back of the hand.)
  const thumbPose = (s, k, tip = null) => { const sx = s === 'l' ? 1 : -1, [t1, t2] = fingers[s].thumb, ps = -sx;
    const d = V3(ps * 0.35, -0.78, 0.45).lerp(V3(ps * 0.85, -0.5, -0.25), k).normalize();
    t1.quaternion.setFromUnitVectors(V3(0, -1, 0), d);
    t2.rotation.set(0, 0, 0); const bend = tip ?? (0.15 + 0.5 * k);
    // bend the tip towards the palm side: about the axis across the thumb (thumb direction x palm normal)
    const ax = V3(0, -1, 0).cross(V3(ps, 0, 0).applyQuaternion(t1.quaternion.clone().invert())).normalize();
    t2.quaternion.setFromAxisAngle(ax, -bend); };
  // finger segments in world space: [[start, end, radius], ...] per finger (thumb last)
  const fingerLines = (s) => { const out = []; const W = (o, y) => o.localToWorld(V3(0, y, 0));
    for (const f of [...fingers[s], fingers[s].thumb]) out.push(f.map((j, i) => [W(j, 0), W(j, -f.len[i]), (i < 3 ? FR[Math.min(i, 2)] : FR[2]) * root.scale.x]));
    return out; };
  // closest distance between segments p1-q1 and p2-q2
  const segDist = (p1, q1, p2, q2) => {
    const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
    let s_ = 0, t_ = 0; const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
    s_ = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t_ = (b * s_ + f) / e;
    if (t_ < 0) { t_ = 0; s_ = Math.min(1, Math.max(0, -c / a)); } else if (t_ > 1) { t_ = 1; s_ = Math.min(1, Math.max(0, (b - c) / a)); }
    return p1.clone().addScaledVector(d1, s_).distanceTo(p2.clone().addScaledVector(d2, t_));
  };
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
    armIK(s, target, pole, hint = V3(0, 0, 1)) { this._arm2(s, target, pole, hint, 0.255 + 0.07); B[s + 'Wr'].quaternion.identity(); root.updateMatrixWorld(true); },
    // shoulder-elbow-(wrist or palm) two-bone solve: b = forearm length to the point being placed
    _arm2(s, target, pole, hint, b) {
      const k = root.scale.x, a = 0.28 * k; b *= k; // limb lengths follow the character's size (crowds: v1.11)
      root.updateMatrixWorld(true);
      const S = B[s + 'Sh'].getWorldPosition(V3(0, 0, 0));
      const D = target.clone().sub(S); const d = Math.min(D.length(), a + b - 1e-3); const dir = D.normalize();
      const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
      const p = pole.clone().sub(S); p.addScaledVector(dir, -p.dot(dir)); if (p.lengthSq() < 1e-8) p.set(0, 0, -1); p.normalize();
      const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(p, a * sinA);
      aimNegY(B[s + 'Sh'], E.clone().sub(S), hint);
      aimNegY(B[s + 'El'], S.clone().addScaledVector(dir, d).sub(E), hint);
      root.updateMatrixWorld(true); return E;
    },
    // two-bone IK: ankle to target (world), knee towards pole; foot kept level, pointing along yaw (radians, world)
    legIK(s, target, pole, footYaw = null) {
      const k = root.scale.x, a = 0.43 * k, b = 0.42 * k;
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
        // relaxed: the curl grows from the index to the little finger, and open fingers fan out a little
        fingers[s].forEach(([f1, f2, f3], i) => { const c = 0.08 * i * (1 - k);
          f1.rotation.set((1.5 - i) * 0.06 * (1 - k), 0, -sx * (0.2 + c + 1.15 * k) * (1 - i * 0.04));
          f2.rotation.set(0, 0, -sx * (0.28 + 1.5 * c + 1.35 * k)); f3.rotation.set(0, 0, -sx * (0.18 + c + 0.95 * k)); });
        thumbPose(s, k);
      }
    },
    // close hand s around a cylinder { a, b, r } (world points and radius): each joint bends until its segment, or the
    // rest of the finger, touches the surface, so fingers wrap ropes, handles and tools of any thickness. Fingers that
    // reach nothing stay fully bent (a fist past a thin rope). press: how far the skin sinks in (m). Returns the
    // number of fingers (of 5, thumb included) touching.
    grasp(s, cyl, { press = 0.0008, thumb = true } = {}) {
      const sx = s === 'l' ? 1 : -1, A = cyl.a, Bq = cyl.b, R = cyl.r;
      root.updateMatrixWorld(true);
      const gapFrom = (f, j) => { f[j].updateMatrixWorld(true); let m = 1e9;
        for (let i = j; i < f.length; i++) { const st = f[i].localToWorld(V3(0, 0, 0)), en = f[i].localToWorld(V3(0, -f.len[i], 0));
          m = Math.min(m, segDist(st, en, A, Bq) - R - (f === fingers[s].thumb ? 0.011 : FR[i]) * root.scale.x); }
        return m; };
      // march a joint from lo to hi in small steps; stop at the first touch and refine it
      const close = (f, j, set, lo, hi) => {
        const n = 16, touch = () => gapFrom(f, j) <= -press; let prev = lo;
        set(lo); if (touch()) return lo;
        for (let k = 1; k <= n; k++) { const v = lo + (hi - lo) * k / n; set(v); if (touch()) { let a0 = prev, a1 = v;
          for (let it = 0; it < 8; it++) { const m = (a0 + a1) / 2; set(m); if (touch()) a1 = m; else a0 = m; } set(a1); return a1; } prev = v; }
        return hi; };
      let n = 0;
      fingers[s].forEach((f) => {
        f.forEach(j => j.rotation.set(0, 0, -sx * 0.1));
        const MAX = [1.55, 1.75, 1.3]; let hit = false;
        for (let j = 0; j < 3; j++) { const v = close(f, j, (x) => f[j].rotation.set(0, 0, -sx * x), 0.1, MAX[j]); if (v < MAX[j]) hit = true; }
        if (hit || gapFrom(f, 0) < 0.004) n++;
      });
      if (thumb) { const T = fingers[s].thumb; let kk = 0;
        const k = close(T, 0, (x) => { kk = x; thumbPose(s, x, 0.1); }, -0.7, 1.3); // from wide open: its rest pose can already be inside a thick handle
        const v = close(T, 1, (x) => thumbPose(s, kk, x), 0.1, 1.2);
        if (k < 1.3 || v < 1.2) n++; }
      root.updateMatrixWorld(true); return n;
    },
    // hold a cylinder { a, b, r } in hand s at u (0..1 from a to b): the hand turns to lie across the axis with the
    // forearm's side of the hand towards `up` (default: the elbow), the thumb towards `thumbTo` along the axis (default:
    // world up, or towards b), the arm reaches with the elbow towards `pole`, then the fingers wrap it (grasp).
    // Returns the grasp's finger count; F.wristBend(s) says how far the wrist had to bend (radians).
    hold(s, cyl, { u = 0.5, up = null, thumbTo = null, pole = null, press } = {}) {
      const sx = s === 'l' ? 1 : -1; root.updateMatrixWorld(true);
      const Ax = cyl.b.clone().sub(cyl.a).normalize(), P = cyl.a.clone().lerp(cyl.b, u);
      const S = B[s + 'Sh'].getWorldPosition(V3(0, 0, 0)), side = root.localToWorld(V3(sx, 0, 0)).sub(root.position).normalize();
      const pl = pole || S.clone().addScaledVector(side, 0.45).add(V3(0, -0.25, 0)).addScaledVector(root.localToWorld(V3(0, 0, -1)).sub(root.position), 0.4);
      const tt = thumbTo || (Math.abs(Ax.y) > 0.3 ? V3(0, 1, 0) : Ax.clone());
      let upv = up ? up.clone() : S.clone().sub(P), wrist = null, Rm = new THREE.Matrix4();
      for (let pass = 0; pass < 2; pass++) {
        const Y = upv.clone().addScaledVector(Ax, -upv.dot(Ax)); if (Y.lengthSq() < 1e-8) Y.set(0, 1, 0); Y.normalize();
        const Z = Ax.clone().multiplyScalar(Ax.dot(tt) < 0 ? -1 : 1), X = Y.clone().cross(Z).normalize();
        Rm.makeBasis(X, Y, Z);
        // the axis runs across the base of the fingers, r beyond the skin of the palm (palm side = -sx x)
        const ks = root.scale.x; wrist = P.clone().sub(V3(-sx * (0.015 * ks + cyl.r), -0.085 * ks, -0.002 * ks).applyMatrix4(Rm));
        const E = this._arm2(s, wrist, pl, Z, 0.255); F.reachShort = F.reachShort || {}; F.reachShort[s] = Math.max(0, wrist.distanceTo(S) - 0.534 * root.scale.x); // > 0: the arm can't reach
        if (!up) upv = E.clone().sub(wrist);                    // second pass: the hand follows the forearm
      }
      const q = new THREE.Quaternion().setFromRotationMatrix(Rm); B[s + 'El'].getWorldQuaternion(_q2);
      B[s + 'Wr'].quaternion.copy(_q2.invert().multiply(q)); root.updateMatrixWorld(true);
      return this.grasp(s, cyl, { press });
    },
    // point with hand s (after grip()): the index finger straightens by k, the other three curl into the palm, the thumb
    // tucks across them (v1.14)
    point(s, k = 1) { const sx = s === 'l' ? 1 : -1, f = fingers[s];
      const [a1, a2, a3] = f[0]; a1.rotation.set(0.03, 0, a1.rotation.z * (1 - k) - sx * 0.05 * k); a2.rotation.z *= 1 - k; a3.rotation.z *= 1 - k;
      for (let i = 1; i < 4; i++) { const [b1, b2, b3] = f[i]; b1.rotation.z += (-sx * 1.35 - b1.rotation.z) * k; b2.rotation.z += (-sx * 1.5 - b2.rotation.z) * k; b3.rotation.z += (-sx * 1.0 - b3.rotation.z) * k; }
      thumbPose(s, 0.25 + 1.0 * k, 0.15 + 0.8 * k); root.updateMatrixWorld(true); },
    wristBend(s) { const q = B[s + 'Wr'].quaternion; return 2 * Math.acos(Math.min(1, Math.abs(q.w))); },
    fingerLines(s) { return fingerLines(s); },
    // face: brow -1 (frown/strain) .. 1 (raised), smile -1..1, open 0..1, blink 0..1, squint 0..1
    // wide: eyes open wider (surprise, relief); oh: round open mouth (a 'phew'); flare: nostrils (effort); cheek: cheeks lift (real smile)
    // speech: a mouth shape from lipsync.js (lipTrack), laid over the expression: the jaw opens, lips round or spread,
    // shut for m/b/p and tuck under the top teeth for f/v, and the top teeth show when the mouth is open
    face({ brow = 0, smile = 0, open = 0, blink = 0, squint = 0, teeth = 0, wide = 0, oh = 0, flare = 0, cheek = 0, speech = null } = {}) {
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
      let gap = Math.max(open * 0.012, teeth * 0.0075, oh * 0.016);
      let w = (0.019 + Math.max(0, smile) * 0.004) * (1 - 0.35 * oh), sm = smile * (1 - oh), showTeeth = teeth > 0.05;
      if (speech) {
        const S = speech, talkGap = (S.open * 0.017 + S.jaw * 0.003 * (1 - 0.8 * S.fv) + S.oh * 0.0035) * (1 - S.press) + S.fv * 0.0022; // rounded lips part a little even with the jaw nearly shut
        const k = Math.min(1, (S.open + S.press + S.fv + S.oh) * 4);               // how much the speech owns the mouth
        gap = Math.max(gap * (1 - S.press) * (1 - 0.8 * S.fv), talkGap);
        w *= 1 + k * (0.14 * S.ee - 0.5 * S.oh - 0.04 * S.press);               // spread for ee, rounded for oo, pressed for m
        sm *= 1 - 0.6 * k * Math.max(S.oh, S.press);                            // rounding and pressing pull the corners in
        showTeeth = showTeeth || (S.teeth > 0.25 && gap > 0.0018);
      }
      setMouth(sm, gap, w, smile < 0.25 && teeth > 0.3);
      teethG.visible = showTeeth; mouth.position.y = -0.07 + smile * 0.002 - (speech ? speech.jaw * 0.0015 : 0);
      F.mouthGap = gap; F.mouthW = w;
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
