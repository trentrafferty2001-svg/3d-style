// Props for the 60 s cut: village houses, acacias, pesticide jerrycans, fertiliser sacks, rice basket, cap, mud clouds.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, fabricTexture } from './textures.js';
import { glowSprite } from './props.js';

const shadowAll = (o) => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
const canvasTex = (w, h, draw, repeat = null) => {
  const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const cx = cv.getContext('2d'); cx.scale(2, 2); draw(cx, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
};

// ---------- Zhejiang-style village house ----------
let HM = null;
function houseMats() {
  if (HM) return HM;
  const plaster = canvasTex(256, 256, (x) => {
    x.fillStyle = '#ece6da'; x.fillRect(0, 0, 256, 256);
    const R = rng(4);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,110,95,${R() * 0.08})`; x.beginPath(); x.arc(R() * 256, R() * 256, 2 + R() * 14, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, 200, 0, 256); g.addColorStop(0, 'rgba(90,80,60,0)'); g.addColorStop(1, 'rgba(90,80,60,0.35)'); x.fillStyle = g; x.fillRect(0, 200, 256, 56);
  }, [1, 1]);
  const tiles = canvasTex(256, 256, (x) => {
    x.fillStyle = '#3a3e44'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#2c3035' : '#474c53'; x.fillRect(i * 16, 0, 9, 256); }
    for (let j = 0; j < 16; j++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, j * 16, 256, 2); }
  }, [3, 2]);
  HM = {
    wall: new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.92 }),
    base: new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95, bumpMap: fabricTexture(31), bumpScale: 3 }),
    roof: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.65, bumpMap: tiles, bumpScale: 2 }),
    ridge: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 0.9 }),
  };
  return HM;
}
export function house({ w = 6, d = 4.4, h = 3.2, seed = 1 } = {}) {
  const M = houseMats();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.wall); body.position.y = h / 2; g.add(body);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.45, d + 0.12), M.base); plinth.position.y = 0.22; g.add(plinth);
  const rh = 1.5, ov = 0.55;
  const tri = (half, hh) => { const s = new THREE.Shape(); s.moveTo(-half, 0); s.lineTo(0, hh); s.lineTo(half, 0); s.lineTo(-half, 0); return s; };
  const gable = new THREE.ExtrudeGeometry(tri(d / 2, rh * 0.96), { depth: w, bevelEnabled: false }); gable.translate(0, 0, -w / 2); gable.rotateY(Math.PI / 2);
  const gm = new THREE.Mesh(gable, M.wall); gm.position.y = h; g.add(gm);
  // two roof slabs
  const slope = Math.atan2(rh, d / 2 + ov), len = Math.hypot(rh, d / 2 + ov);
  for (const s of [1, -1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + ov * 2, 0.14, len + 0.05), M.roof);
    slab.position.set(0, h + rh / 2 - 0.02, s * (d / 2 + ov) / 2); slab.rotation.x = s * slope; g.add(slab);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + ov * 2 + 0.3, 0.22, 0.26), M.ridge); ridge.position.y = h + rh + 0.06; g.add(ridge);
  for (const s of [1, -1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 8), M.ridge); horn.position.set(s * (w / 2 + ov + 0.2), h + rh + 0.22, 0); horn.rotation.z = -s * 0.9; g.add(horn);
  }
  // door and windows on the front (+z)
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.08), M.wood); door.position.set(0, 1.25, d / 2 + 0.03); g.add(door);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.14), M.wood); lintel.position.set(0, 2.32, d / 2 + 0.05); g.add(lintel);
  for (const s of [1, -1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.06), M.dark); win.position.set(s * w * 0.3, 2.0, d / 2 + 0.03); g.add(win);
    for (let i = -1; i <= 1; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.08), M.wood); bar.position.set(s * w * 0.3 + i * 0.22, 2.0, d / 2 + 0.05); g.add(bar); }
  }
  return shadowAll(g);
}

// ---------- umbrella acacia ----------
export function acacia(s = 1, seed = 1) {
  const R = rng(seed);
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x3e3127, roughness: 0.95 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4a5a26, roughness: 0.95 });
  const top = 4.2 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.18 * s, top * 0.55, 8), bark); trunk.position.y = top * 0.27; g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + R();
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, top * 0.55, 6), bark);
    br.position.set(Math.cos(a) * 0.55 * s, top * 0.72, Math.sin(a) * 0.55 * s); br.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); g.add(br);
  }
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), leaf);
    const a = R() * Math.PI * 2, r = R() * 1.4 * s;
    c.position.set(Math.cos(a) * r, top + R() * 0.3 * s, Math.sin(a) * r); c.scale.set((1.4 + R() * 0.8) * s, (0.32 + R() * 0.12) * s, (1.4 + R() * 0.8) * s); g.add(c);
  }
  return shadowAll(g);
}

// ---------- pesticide jerrycan (generic, no brand) ----------
let JT = null;
export function jerrycan() {
  JT = JT || canvasTex(256, 256, (x) => {
    x.fillStyle = '#f2f2ee'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#c8312a'; x.fillRect(0, 150, 256, 46);
    x.save(); x.translate(128, 92); x.rotate(Math.PI / 4); x.fillStyle = '#f39a1e'; x.fillRect(-34, -34, 68, 68); x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(-34, -34, 68, 68); x.restore();
    x.fillStyle = '#111'; x.fillRect(122, 66, 12, 34); x.beginPath(); x.arc(128, 112, 7, 0, 7); x.fill();
  });
  const g = new THREE.Group();
  const plastic = new THREE.MeshPhysicalMaterial({ map: JT, roughness: 0.35, clearcoat: 0.4 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.25, 0.11, 4, 0.025), plastic); body.position.y = 0.125; g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xc8312a, roughness: 0.5 })); cap.position.set(0.045, 0.265, 0); g.add(cap);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 8, 16, Math.PI), plastic); handle.position.set(-0.03, 0.25, 0); g.add(handle);
  return shadowAll(g);
}

// ---------- fertiliser sack ----------
let ST = null;
export function sack(seed = 1) {
  ST = ST || canvasTex(256, 256, (x) => {
    x.fillStyle = '#e9e6dc'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 4) { x.fillStyle = 'rgba(150,140,120,0.18)'; x.fillRect(i, 0, 1, 256); x.fillRect(0, i, 256, 1); }
    x.fillStyle = '#2e7d3a'; x.fillRect(0, 100, 256, 40);
    x.fillStyle = '#f5d33a'; x.beginPath(); x.arc(128, 60, 18, 0, 7); x.fill();
  });
  const geo = new RoundedBoxGeometry(0.62, 0.2, 0.4, 4, 0.08);
  const p = geo.attributes.position, R = rng(seed);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y * (1 - 0.25 * (Math.abs(p.getX(i)) / 0.31) ** 2)); p.setX(i, p.getX(i) + (R() - 0.5) * 0.004); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ST, roughness: 0.85 }));
  m.position.y = 0.1;
  const g = new THREE.Group(); g.add(m);
  return shadowAll(g);
}

// ---------- woven basket heaped with rice ----------
export function riceBasket() {
  const weave = canvasTex(256, 128, (x) => {
    x.fillStyle = '#9a7442'; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 16; j++) { x.fillStyle = (i + j) % 2 ? '#b88f55' : '#7d5d33'; x.fillRect(i * 8, j * 8, 8, 8); }
  }, [3, 1]);
  const grain = canvasTex(256, 256, (x) => {
    x.fillStyle = '#f1e7cf'; x.fillRect(0, 0, 256, 256);
    const R = rng(8);
    for (let i = 0; i < 1600; i++) { x.fillStyle = R() < 0.5 ? '#fbf5e6' : '#d9c9a4'; x.beginPath(); x.ellipse(R() * 256, R() * 256, 2.5, 1.2, R() * 3, 0, 7); x.fill(); }
  }, [2, 2]);
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.28, 32, 1, true), new THREE.MeshStandardMaterial({ map: weave, roughness: 0.9, side: THREE.DoubleSide })); b.position.y = 0.14; g.add(b);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 32), new THREE.MeshStandardMaterial({ color: 0x7d5d33, roughness: 0.9 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.28; g.add(rim);
  const heap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: grain, roughness: 0.7, bumpMap: grain, bumpScale: 2 })); heap.scale.y = 0.45; heap.position.y = 0.27; g.add(heap);
  return shadowAll(g);
}

// ---------- cap (swaps the straw hat) ----------
export function cap(color = 0xd8d0b8) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); crown.scale.y = 0.8; g.add(crown);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 24, 1, false, -Math.PI / 2, Math.PI), m); brim.position.set(0, 0.005, 0.1); brim.scale.set(1.25, 1, 1.2); brim.rotation.x = -0.12; g.add(brim);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), m); btn.position.y = 0.094; g.add(btn);
  return shadowAll(g);
}

// ---------- billowing mud cloud (normal blended soft sprites) ----------
export function mudCloud(n = 26, { color = 0x5b4329, seed = 3, rate = 1 } = {}) {
  const R = rng(seed);
  const tex = glowSprite().material.map;
  const g = new THREE.Group();
  const P = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false }));
    g.add(s);
    P.push({ s, t0: i * 0.12 / rate + R() * 0.08, dir: new THREE.Vector3((R() - 0.5) * 0.6, 0.35 + R() * 0.5, (R() - 0.5) * 0.6), sz: 0.05 + R() * 0.05, rot: R() * 6 });
  }
  g.update = (t, on = true) => {
    for (const p of P) {
      const life = 1.6, age = ((t - p.t0) % life + life) % life;
      const live = on && t > p.t0;
      p.s.visible = live;
      if (!live) continue;
      const k = age / life;
      p.s.position.copy(p.dir).multiplyScalar(0.18 * (1 - Math.exp(-age * 2.2)));
      p.s.scale.setScalar(p.sz * (0.5 + age * 1.6));
      p.s.material.opacity = 0.8 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.5);
      p.s.material.rotation = p.rot + age * 0.3;
    }
  };
  g.update(-1, false);
  return g;
}
