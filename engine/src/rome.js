// Roman concrete reel: concrete material with lime clasts, Roman builder, engineer, Pantheon (outside + coffered
// interior), aqueduct, formwork, quicklime trough with steam, crack/heal cut-away, harbour pier, volcano, crystals.
import * as THREE from 'three';
import { NOISE } from './world.js';
import { farmer2 } from './farm2.js';
import { materials } from './materials.js';
import { glowSprite } from './props.js';
import { rng, fabricTexture } from './textures.js';
import { romanMats, column2, worldUV } from './roman.js';

const shadowAll = (o) => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
const canvasTex = (w, h, draw, repeat = null) => {
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const cx = cv.getContext('2d'); cx.scale(2, 2); draw(cx, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
};

// ---------- concrete: grey paste, aggregate, optional white lime clasts (object-space pattern, stable while moving) ----------
// opts: base colour, clasts (0..1 amount), scale (pattern density), glow (uniform object: highlights clasts), modern (smooth grey)
export function concreteMaterial({ base = 0x8a8378, clasts = 0.0, scale = 1.0, glow = null, dissolve = null, modern = false, rough = 0.95 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough });
  const U = { uBase: { value: new THREE.Color(base) }, uClast: { value: clasts }, uScale: { value: scale }, uGlow: glow || { value: 0 }, uModern: { value: modern ? 1 : 0 }, uDis: dissolve || { value: new THREE.Vector4(0, 0, 0, -1) } };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vWP2;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvOP = position; vWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vOP; varying vec3 vWP2; uniform vec3 uBase; uniform float uClast, uScale, uGlow, uModern; uniform vec4 uDis;
      ${NOISE}
      float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      // cellular blobs: returns (dist to nearest feature, its random id)
      vec2 cells(vec3 p){ vec3 i = floor(p); float best = 9.0, id = 0.0;
        for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) for (int z=-1;z<=1;z++) { vec3 c = i + vec3(x,y,z);
          float h = hash13(c); vec3 f = c + vec3(hash13(c+11.1), hash13(c+23.7), hash13(c+5.3));
          float d = length(p - f) / (0.45 + 0.55 * hash13(c + 3.3)); if (d < best) { best = d; id = h; } }
        return vec2(best, id); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 P = vWP2 * uScale;
        float n = fbm(P.xy * 6.0 + P.zx * 4.0);
        vec3 c = uBase * (0.86 + 0.24 * n);
        if (uModern < 0.5) {
          vec2 ag = cells(P * 26.0);
          float stone = smoothstep(0.55, 0.42, ag.x) * step(0.45, ag.y);
          vec3 sc = mix(vec3(0.36, 0.31, 0.27), vec3(0.52, 0.44, 0.36), fract(ag.y * 7.0));
          c = mix(c, sc * (0.9 + 0.2 * n), stone * 0.55);
          vec2 cl = cells(P * 11.0 + 17.0);
          float clast = smoothstep(0.36, 0.28, cl.x) * step(1.0 - uClast, cl.y);
          vec3 lc = vec3(0.96, 0.95, 0.9) * (0.93 + 0.1 * fbm(P.xy * 60.0));
          c = mix(c, lc, clast);
          c += vec3(1.0, 0.82, 0.25) * clast * uGlow * 0.9;
          c *= 0.93 + 0.12 * smoothstep(0.7, 0.4, cells(P * 90.0).x);
        } else {
          c *= 0.95 + 0.1 * fbm(P.xy * 14.0 + P.zx * 9.0);
          c = mix(c, c * 0.7, smoothstep(0.75, 0.9, fbm(P.xz * 2.0 + P.y * 0.5)) * 0.5);
        }
        diffuseColor.rgb = c;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uModern < 0.5 && uGlow > 0.0) { vec2 cl2 = cells(vWP2 * uScale * 11.0 + 17.0); totalEmissiveRadiance += vec3(1.0, 0.75, 0.2) * smoothstep(0.36, 0.28, cl2.x) * step(1.0 - uClast, cl2.y) * uGlow * 0.6; }`);
  };
  return m;
}

// ---------- characters ----------
const tunicMats = (color) => ({
  tunic: new THREE.MeshStandardMaterial({ color, roughness: 0.95, bumpMap: fabricTexture(17), bumpScale: 1.6 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.7 }),
  sandal: new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.75 }),
});
// Roman builder: short belted tunic, bare forearms and shins, sandals, short dark hair
export function romanBuilder({ color = 0xd8c7a2, skin = null } = {}) {
  const h = farmer2();
  const M = materials(), T = tunicMats(color);
  h.hat.visible = false;
  h.root.traverse(o => {
    if (!o.isMesh) return;
    const hex = o.material.color ? o.material.color.getHex() : -1;
    if (hex === 0x4d6f99 || hex === 0x3f5f87 || hex === 0x45658f) o.material = T.tunic; // shirt, placket, pocket
    if (hex === 0xa8402c) o.material = T.belt; // sash
    if (hex === 0xe8e2d0) o.visible = false; // buttons
    if (hex === 0x3a342d) o.visible = false; // trousers
  });
  for (const s of ['l', 'r']) {
    h.j[s + 'Hip'].children.forEach(c => { if (c.isMesh && c.visible === false) { c.visible = true; c.material = M.skin; } });
    h.j[s + 'Kn'].children.forEach(c => { if (c.isMesh) { c.visible = true; c.material = M.skin; } });
    // sandal straps
    for (let i = 0; i < 2; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.005, 6, 20), T.sandal); st.rotation.x = Math.PI / 2; st.position.y = -0.03 + i * 0.04; h.j[s + 'An'].add(st); }
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.24), T.sandal); sole.position.set(0, -0.068, 0.05); h.j[s + 'An'].add(sole);
  }
  // tunic skirt: a flared open cylinder from the waist to above the knee
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.36, 28, 4, true), T.tunic);
  const p = skirt.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.05 * Math.sin(a * 9) * (0.5 - p.getY(i) / 0.36); p.setX(i, p.getX(i) * k * 1.12); p.setZ(i, p.getZ(i) * k * 0.78); }
  skirt.geometry.computeVertexNormals(); skirt.material.side = THREE.DoubleSide;
  skirt.position.y = -0.2; h.j.spine.add(skirt);
  // hair: short dark cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.152, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), M.hair);
  hair.position.set(0, 0.05, -0.02); hair.rotation.x = -0.45; hair.scale.set(1.02, 1.0, 1.06); h.j.head.add(hair);
  if (skin) { const sk = M.skin.clone(); sk.color.set(skin); h.root.traverse(o => { if (o.isMesh && o.material === M.skin) o.material = sk; }); }
  shadowAll(h.root);
  return h;
}
// modern engineer: hi-vis vest over the shirt, yellow hard hat
export function engineer() {
  const h = farmer2();
  h.hat.visible = false;
  const vest = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 });
  const refl = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.6 });
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.19, 0.4, 32, 1, true), vest);
  g.scale.set(1.13, 1, 0.68); g.position.y = 0.08; h.j.chest.add(g);
  for (const y of [0.0, 0.12]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.209, 0.207, 0.025, 32, 1, true), refl); b.scale.set(1.13, 1, 0.69); b.position.y = y; h.j.chest.add(b); }
  const hat = new THREE.Group(); hat.position.y = 0.09; h.j.head.add(hat);
  const yel = new THREE.MeshStandardMaterial({ color: 0xffc81a, roughness: 0.35 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.165, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), yel); dome.scale.set(1, 0.85, 1.12); hat.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), yel); brim.scale.set(1, 1, 1.15); brim.position.set(0, 0.0, 0.02); hat.add(brim);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), yel); ridge.position.y = 0.13; hat.add(ridge);
  shadowAll(h.root);
  return h;
}

// ---------- architecture ----------
let AM = null;
export function archMats() {
  if (AM) return AM;
  const travertine = canvasTex(256, 256, (x) => {
    x.fillStyle = '#e4d8bf'; x.fillRect(0, 0, 256, 256); const R = rng(8);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(150,130,100,${R() * 0.12})`; x.fillRect(R() * 256, R() * 256, 8 + R() * 40, 1 + R() * 2); }
    x.strokeStyle = 'rgba(120,105,80,0.35)'; x.lineWidth = 1.5;
    for (let j = 0; j < 8; j++) { x.beginPath(); x.moveTo(0, j * 32); x.lineTo(256, j * 32); x.stroke(); for (let i = 0; i < 4; i++) { const o = (j % 2) * 32; x.beginPath(); x.moveTo(o + i * 64, j * 32); x.lineTo(o + i * 64, j * 32 + 32); x.stroke(); } }
  }, [3, 3]);
  const brick = canvasTex(256, 256, (x) => {
    x.fillStyle = '#9a7556'; x.fillRect(0, 0, 256, 256); const R = rng(4);
    for (let j = 0; j < 32; j++) for (let i = 0; i < 8; i++) { x.fillStyle = `hsl(${18 + R() * 10},${30 + R() * 15}%,${36 + R() * 14}%)`; x.fillRect(i * 32 + (j % 2) * 16 + 1, j * 8 + 1, 30, 6); }
  }, [6, 3]);
  const coffer = canvasTex(256, 256, (x) => {
    x.fillStyle = '#d9cdb6'; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 4; k++) { const m = 28 + k * 22; x.fillStyle = `rgb(${200 - k * 22},${188 - k * 22},${166 - k * 22})`; x.fillRect(m, m, 256 - 2 * m, 256 - 2 * m); }
  }, [28, 5]);
  // v1.2: stone, brick, marble, wood and roof tiles come from the detailed Roman materials (roman.js); builders below
  // give their meshes world-scale UVs (worldUVAll) so the textures keep their real size
  const R2 = romanMats();
  AM = {
    stone: R2.stone, brick: R2.brick, marble: R2.marble, wood: R2.woodH, roofTile: R2.roof, // formwork and troughs are horizontal boards
    lead: new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.55, metalness: 0.3 }),
    coffer: new THREE.MeshStandardMaterial({ map: coffer, roughness: 0.9, bumpMap: coffer, bumpScale: 4, side: THREE.BackSide }),
  };
  return AM;
}
// v1.2: fluted column with entasis and an Attic base (roman.js), same footprint and height as before
function column(h, r, mat) { return column2(h * 1.03, r, mat, { flutes: 16 }); }
// world-scale UVs on every mesh of a builder that uses the tiled Roman materials (tile = metres per texture repeat,
// scaled for builders that are not at 1 unit = 1 m)
function worldUVAll(g, tile) {
  const A = archMats(), tiled = new Set([A.stone, A.brick, A.marble, A.wood, A.roofTile]);
  g.traverse(o => { if (o.isMesh && tiled.has(o.material) && !o.userData.uvDone) { o.geometry = o.geometry.clone(); o.geometry.applyMatrix4(new THREE.Matrix4().makeScale(o.scale.x, o.scale.y, o.scale.z)); worldUV(o.geometry, tile); o.geometry.applyMatrix4(new THREE.Matrix4().makeScale(1 / o.scale.x, 1 / o.scale.y, 1 / o.scale.z)); o.userData.uvDone = true; } });
  return g;
}
// Pantheon at real-ish proportions scaled to 1 unit = 1 m / 10 (rotunda 43 m wide -> r 2.17)
export function pantheon() {
  const A = archMats(); const g = new THREE.Group();
  const R = 2.17, Hw = 2.2;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Hw, 72, 1, true), A.brick); drum.position.y = Hw / 2; g.add(drum);
  for (const [y, k] of [[0.75, 1.012], [1.5, 1.012], [Hw, 1.02]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(R * k, R * k, 0.08, 72), A.stone); c.position.y = y; g.add(c); }
  // stepped rings at the base of the dome, then the dome
  for (let i = 0; i < 6; i++) { const r = R * (0.99 - i * 0.03); const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.04, 0.1, 72), A.stone); s.position.y = Hw + 0.05 + i * 0.1; g.add(s); }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0, 72, 36, 0, Math.PI * 2, 0, Math.PI * 0.5), A.lead); dome.scale.y = 0.62; dome.position.y = Hw + 0.05; g.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 10, 48), A.stone); ring.rotation.x = Math.PI / 2; ring.position.y = Hw + 0.05 + R * 0.62 - 0.03; g.add(ring);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.44, 40), new THREE.MeshBasicMaterial({ color: 0x15120e })); hole.rotation.x = -Math.PI / 2; hole.position.y = ring.position.y + 0.006; g.add(hole);
  // portico: block, 8 columns front + inner rows, pediment, roof
  const P = new THREE.Group(); P.position.z = R + 0.2; g.add(P);
  const block = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.7), A.brick); block.position.set(0, 1.3, -0.35); P.add(block);
  const colH = 1.42, cw = 3.3;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) { if (row > 0 && (i === 0 || i === 7 || i === 3 || i === 4)) continue; const c = column(colH, 0.075, A.marble); c.position.set(-cw / 2 + 0.2 + i * (cw - 0.4) / 7, 0.18, 1.25 - row * 0.45); P.add(c); }
  const stylo = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.2, 0.18, 1.8), A.stone); stylo.position.set(0, 0.09, 0.55); P.add(stylo);
  const ent = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.28, 1.7), A.stone); ent.position.set(0, 0.18 + colH + 0.18, 0.5); P.add(ent);
  const tri = new THREE.Shape(); tri.moveTo(-cw / 2, 0); tri.lineTo(cw / 2, 0); tri.lineTo(0, 0.62); tri.lineTo(-cw / 2, 0);
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.7, bevelEnabled: false }), A.stone); ped.position.set(0, 0.18 + colH + 0.32, -0.35); P.add(ped);
  const roofG = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.72, bevelEnabled: false }), A.lead); roofG.scale.set(1.04, 1.05, 1); roofG.position.set(0, 0.18 + colH + 0.34, -0.36); P.add(roofG);
  const tymp = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: 0xb5a68c, roughness: 0.9 })); tymp.scale.setScalar(0.86); tymp.position.set(0, 0.18 + colH + 0.38, 1.36); P.add(tymp);
  // dark doorway
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 })); door.position.set(0, 0.63, 0.005); P.add(door);
  // piazza
  const pz = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0xbfae92, roughness: 0.95, bumpMap: fabricTexture(9), bumpScale: 2 })); pz.rotation.x = -Math.PI / 2; pz.position.y = 0.002; g.add(pz);
  worldUVAll(g, 0.24); shadowAll(g);
  return g;
}
// inside the dome: coffered hemisphere, oculus with a light shaft and a sunlit disc on the floor
export function pantheonInterior() {
  const A = archMats(); const g = new THREE.Group();
  const R = 2.17;
  const domeG = new THREE.SphereGeometry(R, 96, 48, 0, Math.PI * 2, 0.115, Math.PI * 0.5 - 0.115);
  const dome = new THREE.Mesh(domeG, A.coffer); dome.position.y = R; g.add(dome);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0xcbb99a, roughness: 0.6, side: THREE.BackSide })); wall.position.y = R / 2; g.add(wall);
  // niches/columns ring
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const c = column(1.2, 0.05, A.marble); c.position.set(Math.sin(a) * (R - 0.12), 0, Math.cos(a) * (R - 0.12)); g.add(c); }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x) => { x.fillStyle = '#8a7a66'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#b8a585' : '#6f5d4c'; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); if ((i + j) % 2) { x.fillStyle = '#9b3e2e'; x.beginPath(); x.arc(i * 32 + 16, j * 32 + 16, 9, 0, 7); x.fill(); } } }, [6, 6]), roughness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  // oculus sky
  const sky = new THREE.Mesh(new THREE.CircleGeometry(0.25, 40), new THREE.MeshBasicMaterial({ color: 0xbfe0ff })); sky.rotation.x = Math.PI / 2; sky.position.y = R * 2 - 0.005; g.add(sky);
  // light shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 4.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  shaft.position.set(0.55, R * 2 - 2.2, 0.25); shaft.rotation.z = 0.25; shaft.rotation.x = -0.12; g.add(shaft);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.33, 40), new THREE.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: 0.35, depthWrite: false })); spot.rotation.x = -Math.PI / 2; spot.scale.set(1.3, 1, 1); spot.position.set(-0.3, R * 0.95, 0.2); spot.position.y = 0; g.add(spot);
  spot.position.set(1.05, 0.004, 0.55); spot.rotation.z = 0.3;
  g.userData.shaft = shaft;
  worldUVAll(g, 0.24); shadowAll(g); floor.castShadow = false;
  return g;
}
// aqueduct: arcade extruded from a shape with arched openings
export function aqueduct(n = 8, { span = 2.2, h = 3.6, depth = 0.8 } = {}) {
  const A = archMats();
  const W = n * span, s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, h); s.lineTo(-W / 2, h); s.lineTo(-W / 2, 0);
  const pier = span * 0.26, open = span - pier, archTop = h * 0.78;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * span + pier / 2, x1 = x0 + open, cx = (x0 + x1) / 2, r = open / 2;
    const hp = new THREE.Path(); hp.moveTo(x0, 0); hp.lineTo(x1, 0); hp.lineTo(x1, archTop - r); hp.absarc(cx, archTop - r, r, 0, Math.PI, false); hp.lineTo(x0, 0);
    s.holes.push(hp);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, A.stone);
  const g = new THREE.Group(); g.add(m);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, depth + 0.12), A.stone); cap.position.y = h + 0.09; g.add(cap);
  worldUVAll(g, 2.4); shadowAll(g);
  return g;
}
// wooden formwork box (two side boards + end boards + stakes)
export function formwork(len = 1.6, h = 0.5, w = 0.4) {
  const A = archMats(); const g = new THREE.Group();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(len, h / 3 - 0.008, 0.03), A.wood); b.position.set(0, h / 6 + i * h / 3, s * (w / 2 + 0.015)); g.add(b); }
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, h + 0.15, 0.04), A.wood); st.position.set(-len / 2 + 0.1 + i * (len - 0.2) / 3, (h + 0.15) / 2, s * (w / 2 + 0.05)); g.add(st); }
  }
  worldUVAll(g, 1.2); shadowAll(g);
  return g;
}
// trough of quicklime: wooden box, white lumpy bed, water layer that rises, steam + glow
export function quicklimeTrough() {
  const A = archMats(); const g = new THREE.Group();
  const L = 0.9, W = 0.5, H = 0.22;
  for (const [sx, sz, x, z] of [[L, 0.03, 0, W / 2], [L, 0.03, 0, -W / 2], [0.03, W, L / 2, 0], [0.03, W, -L / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, H, sz), A.wood); b.position.set(x, H / 2, z); g.add(b); }
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(L, 0.02, W), A.wood); bottom.position.y = 0.01; g.add(bottom);
  // lime lumps
  const R = rng(21);
  const lumps = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.95 }), 160);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 160; i++) { const s = 0.025 + R() * 0.03; q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)); m4.compose(new THREE.Vector3((R() - 0.5) * (L - 0.08), 0.03 + R() * 0.07, (R() - 0.5) * (W - 0.08)), q, new THREE.Vector3(s, s * 0.8, s * 1.1)); lumps.setMatrixAt(i, m4); }
  g.add(lumps);
  const water = new THREE.Mesh(new THREE.BoxGeometry(L - 0.04, 1, W - 0.04), new THREE.MeshPhysicalMaterial({ color: 0xcfd8d6, roughness: 0.15, transmission: 0.0, transparent: true, opacity: 0.75 })); g.add(water);
  // steam puffs + hot glow
  const tex = glowSprite().material.map;
  const puffs = [...Array(26)].map((_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf4f4f0, transparent: true, opacity: 0, depthWrite: false })); g.add(s); return { s, x: (R() - 0.5) * (L - 0.15), z: (R() - 0.5) * (W - 0.15), ph: R() * 3, sp: 0.25 + R() * 0.25 }; });
  const glow = new THREE.PointLight(0xff8a3a, 0, 1.5, 2); glow.position.y = 0.25; g.add(glow);
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.8 }), 50); g.add(bub);
  const bubD = [...Array(50)].map(() => [(R() - 0.5) * (L - 0.1), (R() - 0.5) * (W - 0.1), R() * 2, 0.008 + R() * 0.012]);
  g.set = (level, heat, t) => {
    water.visible = level > 0.001; water.scale.y = Math.max(0.001, level * 0.1); water.position.y = 0.02 + level * 0.05;
    water.material.color.set(0xcfd8d6).lerp(new THREE.Color(0xe9e6dc), heat);
    puffs.forEach((p, i) => { const a = ((t * p.sp + p.ph) % 1.2); const on = heat > 0.05; p.s.visible = on; if (!on) return; p.s.position.set(p.x + Math.sin(t + i) * 0.03, 0.12 + a * 0.6, p.z); p.s.scale.setScalar(0.12 + a * 0.35); p.s.material.opacity = heat * 0.3 * Math.sin(Math.PI * a / 1.2); });
    glow.intensity = heat * 1.2;
    bubD.forEach(([x, z, ph, s], i) => { const k = (t * 2.5 + ph) % 1; m4.compose(new THREE.Vector3(x, 0.02 + level * 0.1 + 0.002, z), q.identity(), new THREE.Vector3(1, 1, 1).multiplyScalar(heat > 0.1 ? s * Math.sin(k * Math.PI) : 0.0001)); bub.setMatrixAt(i, m4); });
    bub.instanceMatrix.needsUpdate = true;
  };
  g.set(0, 0, 0);
  worldUVAll(g, 1.2); shadowAll(g); water.castShadow = false;
  return g;
}
// jagged crack ribbon in a vertical face (x-y plane at z), grows from the top by k (0..1)
export function crackPath(seed = 3, { top = 0.5, bottom = -0.1, x0 = 0, wander = 0.08, steps = 24 } = {}) {
  const R = rng(seed); const pts = []; let x = x0;
  for (let i = 0; i <= steps; i++) { const y = top + (bottom - top) * i / steps; pts.push([x, y]); x += (R() - 0.5) * wander; }
  return pts;
}
export function ribbon(pts, width, mat, z = 0) {
  const n = pts.length; const pos = new Float32Array(n * 2 * 3); const idx = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i]; const w = width * (0.5 + 0.5 * Math.sin(i * 1.7) ** 2) * (1 - 0.6 * i / n);
    pos.set([x - w, y, z, x + w, y, z], i * 6);
    if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.reveal = (k) => geo.setDrawRange(0, Math.floor(Math.max(0, Math.min(1, k)) * (n - 1)) * 6);
  m.reveal(1);
  return m;
}
// volcano: displaced cone with a crater and a smoke plume
export function volcano({ r = 40, h = 26, seed = 2 } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const geo = new THREE.ConeGeometry(r, h, 192, 32, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.06 * Math.sin(a * 5 + seed) + 0.025 * Math.sin(a * 11 + 1.3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); if (y > h * 0.42) p.setY(i, h * 0.42 + (y - h * 0.42) * 0.25); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 1 }));
  m.position.y = h / 2; g.add(m);
  const tex = glowSprite().material.map;
  const smoke = [...Array(14)].map((_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x9a948c, transparent: true, opacity: 0.5, depthWrite: false, fog: true })); g.add(s); return { s, ph: i / 14 }; });
  g.update = (t) => smoke.forEach(({ s, ph }, i) => { const a = (t * 0.05 + ph) % 1; s.position.set(Math.sin(i) * 2 + a * 14, h * 0.62 + a * 22, Math.cos(i) * 2); s.scale.setScalar(6 + a * 20); s.material.opacity = 0.55 * (1 - a); });
  return g;
}
// plate crystals (aluminous tobermorite, cartoon): instanced thin hexagonal plates that grow by k
export function crystals(n = 120, { w = 0.6, h = 0.5, seed = 4, color = 0xe8f6ff } = {}) {
  const R = rng(seed);
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.08, 6), new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, metalness: 0.1, clearcoat: 1, emissive: 0x6fb6ff, emissiveIntensity: 0.25, transparent: true, opacity: 0.92 }), n);
  const D = [...Array(n)].map(() => ({ p: new THREE.Vector3((R() - 0.5) * w, (R() - 0.5) * h, R() * 0.01), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), s: 0.01 + R() * 0.018, d: R() }));
  const m4 = new THREE.Matrix4();
  mesh.grow = (k) => { D.forEach((o, i) => { const g = Math.max(0, Math.min(1, (k - o.d * 0.6) / 0.4)); m4.compose(o.p, o.q, new THREE.Vector3(o.s * g + 1e-5, o.s * g + 1e-5, o.s * g + 1e-5)); mesh.setMatrixAt(i, m4); }); mesh.instanceMatrix.needsUpdate = true; };
  mesh.grow(0);
  return mesh;
}
// modern cracked concrete wall: grid of chunks; some fall at a time; exposed rusty rebar
export function modernWall({ W = 2.2, H = 1.6, D = 0.3, cols = 11, rows = 8, seed = 5 } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const mat = concreteMaterial({ base: 0x75777a, modern: true, scale: 1.5, rough: 0.9 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x7a3d1d, roughness: 0.85, metalness: 0.3 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, D * 0.6), mat); back.position.set(0, H / 2, -D * 0.25); g.add(back);
  for (let i = 0; i < 4; i++) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, W, 8), rust); rb.rotation.z = Math.PI / 2; rb.position.set(0, 0.25 + i * 0.37, D * 0.1); g.add(rb); }
  for (let i = 0; i < 6; i++) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, H, 8), rust); rb.position.set(-W / 2 + 0.2 + i * (W - 0.4) / 5, H / 2, D * 0.12); g.add(rb); }
  const chunks = [];
  const cw = W / cols, ch = H / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const geo = new THREE.BoxGeometry(cw * 1.01, ch * 1.01, D * 0.42, 2, 2, 1);
    const p = geo.attributes.position; for (let k = 0; k < p.count; k++) { p.setX(k, p.getX(k) + (R() - 0.5) * 0.006); p.setY(k, p.getY(k) + (R() - 0.5) * 0.006); }
    geo.computeVertexNormals();
    const c = new THREE.Mesh(geo, mat); const home = new THREE.Vector3(-W / 2 + cw * (i + 0.5), ch * (j + 0.5), D * 0.2); c.position.copy(home); g.add(c);
    // which chunks fall: a ragged hole around the middle-right
    const dx = (i - cols * 0.58) / cols, dy = (j - rows * 0.45) / rows; const fall = dx * dx * 1.4 + dy * dy < 0.06 + R() * 0.04;
    chunks.push({ c, home, fall, t0: R() * 0.5, spin: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(8), v: new THREE.Vector3((R() - 0.5) * 0.4, 0.2 + R() * 0.3, 0.5 + R() * 0.5) });
  }
  // crack lines on the surface (dark ribbons)
  const crackMat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c });
  const cracks = [crackPath(11, { top: H * 0.95, bottom: H * 0.15, x0: W * 0.12, wander: 0.07 }), crackPath(12, { top: H * 0.85, bottom: H * 0.05, x0: -W * 0.25, wander: 0.06 }), crackPath(14, { top: H * 0.6, bottom: H * 0.0, x0: W * 0.35, wander: 0.08 })].map(pts => { const r = ribbon(pts, 0.018, crackMat, D * 0.41 + 0.002); g.add(r); return r; });
  shadowAll(g);
  g.update = (crackK, fallT) => {
    cracks.forEach((r, i) => r.reveal(crackK * 1.2 - i * 0.1));
    chunks.forEach(o => {
      const a = fallT - o.t0;
      if (!o.fall || a <= 0) { o.c.position.copy(o.home); o.c.rotation.set(0, 0, 0); o.c.visible = true; return; }
      o.c.position.set(o.home.x + o.v.x * a, o.home.y + o.v.y * a - 4.9 * a * a, o.home.z + o.v.z * a);
      o.c.rotation.set(o.spin.x * a, o.spin.y * a, o.spin.z * a);
      o.c.visible = o.c.position.y > -0.3;
    });
  };
  g.update(0, -1);
  return g;
}
export { shadowAll, canvasTex };
