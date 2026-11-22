// Hair and beards (3d-style v1.15, backlog item B). Every style is a shell laid on the head's own shape (headShape from
// toon.js) with an offset field over the unit sphere of directions: where the offset is positive the shell is hair that
// far off the scalp, where it is negative the shell is tucked under the skin (so the hairline is where hair grows out of
// the scalp, not the cut edge of a cap). Triangles that are hidden everywhere are dropped. Curls are geometry (lumps
// that break the silhouette) plus normal detail in the shader (hairShading). Seeded, so crowds vary.
//
// styles: 'crop' (short tight curls, the default), 'curls' (a fuller head of curls), 'braids' (crop with braids hanging
// at the back), 'shaved' (stubble with a short fringe), 'headcloth' (a wrapped linen cloth with a band and tails),
// 'cap' (the v1.0 smooth cap, kept for builders that use it as a skullcap); beards: 'none', 'stubble', 'short', 'full'.
import * as THREE from 'three';

const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rng = (seed) => { let s = (Math.abs(seed) * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
// smooth 3D value noise (JS twin of the shader's), for the lumps
const hash = (x, y, z) => { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (t) => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
           L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}

export const HAIR_STYLES = ['crop', 'curls', 'braids', 'shaved', 'headcloth'];
export const BEARDS = ['none', 'stubble', 'short', 'full'];

// curl shading: round lumps as normal detail (the gradient taken exactly per pixel, as in toon.js clothShading), faded
// where a curl is finer than a pixel; scale = curls per metre
export function hairShading(m, { scale = 260, strength = 1.0, key = '' } = {}) {
  m.customProgramCacheKey = () => 'hairShading:' + scale + ':' + strength + ':' + key;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCurl = { value: scale }; sh.uniforms.uCurlK = { value: strength };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHairP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uCurl, uCurlK; varying vec3 vHairP;
        float hHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float hNoise( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( hHash( i ), hHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( hHash( i + vec3( 0, 1, 0 ) ), hHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( hHash( i + vec3( 0, 0, 1 ) ), hHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( hHash( i + vec3( 0, 1, 1 ) ), hHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
        // tight curls: rounded lumps (squared noise) with a finer twist on top
        // the bump normal (three.js defines perturbNormalArb only for materials with a bump map); falls back to the true
        // normal where the derivatives degenerate (a face seen edge-on, see main.js's bump guard)
        vec3 hairPerturb( vec3 sp, vec3 sn, vec2 dH, float fd ) { vec3 sx = normalize( dFdx( sp ) ), sy = normalize( dFdy( sp ) );
          vec3 r1 = cross( sy, sn ), r2 = cross( sn, sx ); float det = dot( sx, r1 ) * fd;
          if ( abs( det ) < 1e-4 ) return sn; return normalize( abs( det ) * sn - sign( det ) * ( dH.x * r1 + dH.y * r2 ) ); }
        float curlH( vec3 p ) { float a = hNoise( p * uCurl ), b = hNoise( p * uCurl * 2.3 + 5.0 ); return a * a * 0.75 + b * 0.25; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { const float e = 0.0006; float h0 = curlH( vHairP );
          vec3 g = vec3( curlH( vHairP + vec3( e, 0.0, 0.0 ) ) - h0, curlH( vHairP + vec3( 0.0, e, 0.0 ) ) - h0, curlH( vHairP + vec3( 0.0, 0.0, e ) ) - h0 ) / e;
          vec3 px = dFdx( vHairP ), py = dFdy( vHairP ); vec2 dH = vec2( dot( g, px ), dot( g, py ) );
          float fine = length( g ) * max( length( px ), length( py ) ), face = abs( dot( normal, normalize( vViewPosition ) ) );
          dH *= 0.0035 * uCurlK * smoothstep( 0.1, 0.4, face ) * ( 1.0 - smoothstep( 0.05, 0.2, fine ) );
          normal = hairPerturb( - vViewPosition, normal, dH, faceDirection ); }`);
  };
  return m;
}

export function hairMaterials(hair, skin, beardColor = hair) {
  const hc = new THREE.Color(hair), sk = new THREE.Color(skin), bc = new THREE.Color(beardColor);
  return {
    crop: hairShading(new THREE.MeshStandardMaterial({ color: hc, roughness: 0.92 }), { scale: 300, strength: 1.0, key: 'crop' }),
    curls: hairShading(new THREE.MeshStandardMaterial({ color: hc, roughness: 0.9 }), { scale: 150, strength: 1.2, key: 'curls' }),
    braid: hairShading(new THREE.MeshStandardMaterial({ color: hc.clone().multiplyScalar(0.92), roughness: 0.85 }), { scale: 420, strength: 0.6, key: 'braid' }),
    // stubble: the skin darkened by the hair's colour, with a fine grain
    stubble: hairShading(new THREE.MeshStandardMaterial({ color: sk.clone().lerp(hc, 0.3), roughness: 0.75 }), { scale: 900, strength: 0.4, key: 'stubble' }),
    beardStubble: hairShading(new THREE.MeshStandardMaterial({ color: sk.clone().lerp(bc, 0.3), roughness: 0.75 }), { scale: 900, strength: 0.4, key: 'stubble' }),
    beard: hairShading(new THREE.MeshStandardMaterial({ color: bc, roughness: 0.9 }), { scale: 340, strength: 1.0, key: 'beard' }),
  };
}

// a shell over the head: dirs on a sphere (R), each laid on headShape at R + offset(n); triangles kept where any corner
// is out of the skin (offset > -keep)
function shell(headShape, R, offset, { w = 96, h = 64, keep = 0.0005 } = {}) {
  const g = new THREE.SphereGeometry(R, w, h), p = g.attributes.position, off = new Float32Array(p.count), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).divideScalar(R); const o = offset(n.x, n.y, n.z); off[i] = o;
    const q = headShape(n.x, n.y, n.z, R + o); p.setXYZ(i, q[0], q[1], q[2]);
  }
  const idx = g.index.array, kept = [];
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (Math.max(off[a], off[b], off[c]) > -keep) kept.push(a, b, c); }
  g.setIndex(kept); g.computeVertexNormals(); g.setAttribute('hairOff', new THREE.BufferAttribute(off, 1)); return g; // hairOff: probes skip points under the skin
}

// where hair grows: above a hairline across the forehead and temples, round above the ears, down to the nape. h > 0
// inside, ramping to 0 at the line; n is a unit direction in head space (x left, y up, z front)
function hairZone(nx, ny, nz, R0, { front = 0.46, nape = -0.42, ears = true } = {}) {
  const j = (noise3(nx * 9 + R0 * 7, ny * 9, nz * 9) - 0.5) * 0.06;                 // the line isn't ruler-straight
  const fr = SS(0.0, 0.2, nz), back = 1 - fr;
  const temple = 0.1 * SS(0.12, 0.42, Math.abs(nx)) * SS(0.0, 0.5, nz);              // the temples recede (not a bowl cut)
  const lineY = (front + temple) * fr + nape * back * SS(-0.2, -0.7, nz);           // the line's height round the head
  let h = SS(lineY - 0.02, lineY + 0.1, ny + j);
  // the temples recede a little; above the ears the line rises round them (ears at |nx| ~ 0.85, ny ~ -0.07)
  if (ears) { const e = Math.exp(-(((Math.abs(nx) - 0.86) / 0.22) ** 2 + ((ny + 0.05) / 0.3) ** 2 + ((nz + 0.1) / 0.4) ** 2)); h *= 1 - SS(0.35, 0.7, e); }
  return h;
}

// beard zone: the jaw, chin and lower cheeks up to a line from the sideburns to the cheekbones, with the mouth kept clear
function beardZone(nx, ny, nz, full) {
  const fr = SS(-0.25, 0.1, nz);                                                    // from just behind the jaw forwards
  const line = -0.12 - 0.22 * SS(0.1, 0.45, Math.abs(nx)) * SS(0.3, 0.8, nz);       // cheek line, lower towards the nose
  let b = fr * SS(line + 0.04, line - 0.08, ny);
  // the mouth (lips at ny ~ -0.56..-0.66, |nx| < 0.2, front): clear of hair; a moustache above it when the beard is full
  const mouth = Math.exp(-((nx / 0.27) ** 2 + ((ny + 0.6) / 0.13) ** 2)) * SS(0.45, 0.8, nz);  // (narrower, a beard point came 0.7 mm from a lip)
  b *= 1 - SS(0.15, 0.5, mouth);
  // the nose and its sides stay clear
  b *= 1 - Math.exp(-((nx / 0.3) ** 2 + ((ny + 0.32) / 0.12) ** 2)) * SS(0.6, 0.85, nz);
  if (full) b = Math.max(b, Math.exp(-((nx / 0.32) ** 2 + ((ny + 0.44) / 0.04) ** 2)) * SS(0.7, 0.9, nz) * 0.9 * (1 - SS(0.3, 0.6, mouth))); // moustache, clear of the upper lip
  return Math.min(1, b);
}

// build the hair (and beard) of one character on its head group; returns the meshes
export function addHair({ head, headShape, R, style = 'crop', beard = 'none', hair = 0x241a14, beardColor = null, skin = 0x8e5434, seed = 0, M = null }) {
  const out = [], H = hairMaterials(hair, skin, beardColor ?? hair), r = rng(seed * 13 + 5), R0 = r();
  const add = (g, mat, name) => { const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; head.add(m); out.push(m); return m; };
  const lumps = (n, s, a) => (noise3(n.x * s + R0 * 31, n.y * s, n.z * s) - 0.5) * 2 * a;
  const V = new THREE.Vector3();
  if (style === 'crop' || style === 'braids') {
    add(shell(headShape, R, (x, y, z) => { const h = hairZone(x, y, z, R0); V.set(x, y, z); return -0.004 + (0.0075 + lumps(V, 26, 0.0009)) * SS(0, 0.6, h); }, { w: 128, h: 96 }), H.crop, 'hair');
  } else if (style === 'curls') {
    add(shell(headShape, R, (x, y, z) => { const h = hairZone(x, y, z, R0, { front: 0.5, nape: -0.38 }); V.set(x, y, z);
      return -0.004 + (0.016 + lumps(V, 11, 0.0045) + lumps(V, 23, 0.0018)) * SS(0, 0.5, h); }, { w: 144, h: 96 }), H.curls, 'hair');
  } else if (style === 'shaved') {
    add(shell(headShape, R, (x, y, z) => { const h = hairZone(x, y, z, R0); return -0.003 + 0.0042 * SS(0, 0.5, h); }, { w: 128, h: 96 }), H.stubble, 'hair');
    // the fringe: hair left long at the front, combed forward over the hairline, its tips ragged
    add(shell(headShape, R, (x, y, z) => { V.set(x, y, z); const fr = SS(0.35, 0.65, z) * (1 - SS(0.35, 0.6, Math.abs(x)));
      const tip = 0.38 + 0.05 * Math.sin(x * 40 + R0 * 9) + lumps(V, 30, 0.03);                 // where the tips end, down the brow
      const k = fr * SS(tip - 0.02, tip + 0.06, y) * (1 - SS(0.62, 0.8, y));
      return -0.004 + (0.009 + lumps(V, 34, 0.0012)) * SS(0, 0.5, k) * (0.4 + 0.6 * SS(0.75, 0.5, y)); }, { w: 144, h: 112 }), H.crop, 'fringe');
  } else if (style === 'cap') {
    const g = new THREE.SphereGeometry(R, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.53), p = g.attributes.position;
    const tilt = new THREE.Matrix4().makeRotationX(-0.55);
    for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i).applyMatrix4(tilt).divideScalar(R); const q = headShape(V.x, V.y, V.z, R * 1.012); p.setXYZ(i, q[0], q[1], q[2]); }
    g.computeVertexNormals(); add(g, M ? M.hair : H.crop, 'hair');
  }
  if (style === 'braids') { // four to six braids from the back of the head, hanging to the nape and a little past it
    const nb = 4 + Math.floor(r() * 3), BM = H.braid;
    for (let k = 0; k < nb; k++) {
      const a = Math.PI + (k / (nb - 1) - 0.5) * 1.5, ax = Math.sin(a), az = Math.cos(a); // round the back of the head (z < 0 is the back)
      const top = new THREE.Vector3(...headShape(0.72 * ax, 0.1, 0.72 * az, R + 0.004)), L = 0.09 + 0.025 * r();
      // to the nape, angled out over it (longer ones reached 27 mm into the upper back)
      const pts = [top, top.clone().add(new THREE.Vector3(ax * 0.014, -L * 0.5, az * 0.03)), top.clone().add(new THREE.Vector3(ax * 0.02, -L, az * 0.05))];
      const c = new THREE.CatmullRomCurve3(pts), tg = new THREE.TubeGeometry(c, 40, 1, 10, false), tp = tg.attributes.position;
      for (let i = 0; i <= 40; i++) { const u = i / 40, cp = c.getPointAt(u), rr = (0.0105 - 0.003 * u) * (1 + 0.25 * Math.abs(Math.sin(u * L * 200)));  // plaited: a lump per crossing
        for (let j = 0; j <= 10; j++) { const v = i * 11 + j; tp.setXYZ(v, cp.x + (tp.getX(v) - cp.x) * rr, cp.y + (tp.getY(v) - cp.y) * rr, cp.z + (tp.getZ(v) - cp.z) * rr); } }
      tg.computeVertexNormals(); add(tg, BM, 'braid');
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), new THREE.MeshStandardMaterial({ color: [0x8a3a24, 0xb08a50, 0x3a5a8a][k % 3], roughness: 0.8 }));
      tie.position.copy(pts[2]); tie.scale.set(1, 0.8, 1); tie.name = 'braid'; head.add(tie); out.push(tie);
    }
  }
  if (style === 'headcloth') { // a linen kerchief: over the head and the ears to the nape, a rolled hem across the brow, knotted behind
    const CM = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95, side: THREE.DoubleSide });
    const edge = (x, y, z) => { const fr = SS(0.4, 0.75, z); return 0.4 * fr - 0.5 * (1 - fr); };   // across the brow, down in front of the ears
    add(shell(headShape, R, (x, y, z) => { V.set(x, y, z); const h = SS(edge(x, y, z) - 0.06, edge(x, y, z) + 0.12, y); // a wide ramp: a narrow one stepped along the triangles at the temple
      const ear = Math.exp(-(((Math.abs(x) - 0.86) / 0.2) ** 2 + ((y + 0.05) / 0.28) ** 2 + ((z + 0.1) / 0.38) ** 2));
      const hem = Math.exp(-(((h - 0.3) / 0.22) ** 2)) * SS(0.3, 0.6, z);                         // the rolled hem at the brow
      return -0.004 + (0.016 + 0.022 * ear + 0.005 * hem + lumps(V, 8, 0.002)) * SS(0, 0.35, h); }, { w: 192, h: 144 }), CM, 'headcloth');
    const kn = new THREE.Vector3(...headShape(0, -0.28, -0.96, R + 0.024));
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), CM); knot.position.copy(kn); knot.scale.set(1.35, 0.9, 0.8);
    knot.name = 'headcloth'; knot.castShadow = true; head.add(knot); out.push(knot);
    for (const [dx, len, sw] of [[-0.008, 0.08, -0.25], [0.01, 0.065, 0.3]]) { // the two ends hang from the knot, tapering, lying on the nape
      const c = new THREE.CatmullRomCurve3([kn.clone(), kn.clone().add(new THREE.Vector3(dx + sw * 0.02, -len * 0.5, -0.008)), kn.clone().add(new THREE.Vector3(dx + sw * 0.04, -len, -0.004))]);
      const tg = new THREE.TubeGeometry(c, 16, 1, 8, false), tp = tg.attributes.position;
      for (let i = 0; i <= 16; i++) { const u = i / 16, cp = c.getPointAt(u), rr = 0.01 * (1 - 0.55 * u); for (let j = 0; j <= 8; j++) { const v = i * 9 + j;
        tp.setXYZ(v, cp.x + (tp.getX(v) - cp.x) * rr * 1.4, cp.y + (tp.getY(v) - cp.y) * rr, cp.z + (tp.getZ(v) - cp.z) * rr * 0.45); } }
      tg.computeVertexNormals(); const t = new THREE.Mesh(tg, CM); t.name = 'headcloth'; t.castShadow = true; head.add(t); out.push(t); }
  }
  if (beard === 'stubble' || beard === 'short' || beard === 'full') {
    const full = beard === 'full', mat = beard === 'stubble' ? H.beardStubble : H.beard;
    add(shell(headShape, R, (x, y, z) => { const b = beardZone(x, y, z, full || beard === 'short'); V.set(x, y, z);
      if (beard === 'stubble') return -0.003 + 0.0038 * SS(0, 0.5, b);
      const chin = full ? 0.022 * SS(-0.55, -0.95, y) * SS(0.3, 0.8, z) : 0.006 * SS(-0.6, -0.95, y) * SS(0.3, 0.8, z); // fuller and longer at the chin
      return -0.004 + (0.008 + (full ? 0.004 : 0) + chin + lumps(V, 24, 0.0012)) * SS(0.0, 0.4, b); }, { w: 160, h: 128 }), mat, 'beard');
  }
  return out;
}

// pick a look for an extra from its seed: style, beard
export function seededLook(seed, { hat = false } = {}) {
  const r = rng(seed * 7 + 2), s = HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)], b = BEARDS[Math.floor(r() * BEARDS.length)];
  return { style: hat && s !== 'shaved' ? 'crop' : s, beard: b };
}
