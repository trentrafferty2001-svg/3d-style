// Crowds and extras (3d-style v1.11): background people built from toon.js with different heights, builds, skin tones,
// clothes and faces, and simple loops for them (walking with planted feet, chatting, carrying a jar on the head). All
// pure functions of time.
import * as THREE from 'three';
import { toon } from './toon.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rng = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const sm = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

const SKINS = [0x5a3420, 0x6e4128, 0x8a5232, 0x9a6644, 0xa9764e, 0xc08a62];
const CLOTH = { tunic: [0xc9b38c, 0x8a5a3a, 0x6b7a5a, 0xa04a32, 0x5a6a8a, 0xd8cbb0], kilt: [0xf2ece0, 0xe8dcc4, 0xd9cdb2] };
const HAIR = [0x1a1410, 0x241a14, 0x3a2a1c, 0x2a2420];

// one extra: seed picks the look; height 0.9..1.08 of the hero; outfit 'tunic' or 'kilt'
export function extra({ seed = 1, outfit = 'tunic', height = null, skin = null, cloth = null } = {}) {
  const R = rng(seed + 11);
  const F = toon({ skin: skin ?? SKINS[Math.floor(R() * SKINS.length)], cloth: cloth ?? CLOTH[outfit][Math.floor(R() * CLOTH[outfit].length)],
    belt: [0x5a3a20, 0x7a2a1a, 0x3a2a1a][Math.floor(R() * 3)], hair: HAIR[Math.floor(R() * HAIR.length)], outfit, seed, headScale: 1.02 + R() * 0.1 });
  const h = height ?? (0.92 + R() * 0.14); F.root.scale.setScalar(h); F.size = h;
  F.look_ = { blink: R() * 3, gesture: R() * 6, nod: R() * 5 };
  return F;
}

// ---- walking: feet planted on the ground while they carry weight, swinging (lifted) otherwise; hips bob and sway,
// arms swing against the legs. path(d) -> { pos, dir } for distance d (m) along it; groundAt(x, z) the floor.
export function walk(F, t, { path, speed = 1.1, d0 = 0, groundAt, stride = 0.68, lift = 0.09, look = null } = {}) {
  const k = F.size || 1, L = stride * k, d = d0 + speed * t, ah = 0.075 * k;
  const at = (s) => path(s), here = at(d), side = V3(-here.dir.z, 0, here.dir.x);       // side: to the walker's left
  const footAt = (i) => {                                                               // i: 0 left, 1 right
    const ph = ((d / L + i) % 2 + 2) % 2, start = d - (ph % 1) * L;
    const sx = i === 0 ? 1 : -1;
    if (ph < 1) { const p = at(start + L / 2), sd = V3(-p.dir.z, 0, p.dir.x); const q = p.pos.clone().addScaledVector(sd, sx * 0.1 * k); q.y = groundAt(q.x, q.z) + ah; return { q, stance: true }; }
    // swing (start = where the body was when this foot lifted): from the last plant, half a stride behind, to the next,
    // a stride and a half ahead (it lands as the body reaches start + L, half a stride ahead of it, as in the stance case)
    const u = sm(ph - 1), from = at(start - L / 2), to = at(start + 1.5 * L);
    const a = from.pos.clone().addScaledVector(V3(-from.dir.z, 0, from.dir.x), sx * 0.1 * k), b = to.pos.clone().addScaledVector(V3(-to.dir.z, 0, to.dir.x), sx * 0.1 * k);
    const q = a.lerp(b, u); q.y = groundAt(q.x, q.z) + ah + lift * k * Math.sin(Math.PI * (ph - 1)); return { q, stance: false };
  };
  const phase = (d / L) * Math.PI;                                                      // one step = pi
  const bob = -0.022 * k * Math.cos(2 * phase), sway = 0.018 * k * Math.sin(phase);
  F.root.position.copy(here.pos).addScaledVector(side, sway); F.root.position.y = groundAt(here.pos.x, here.pos.z) + bob;
  F.root.rotation.y = Math.atan2(here.dir.x, here.dir.z);
  F.pose({ hipsY: -0.03 * k, hipRot: [0, 0.12 * Math.sin(phase), 0], spine: [0.05, -0.1 * Math.sin(phase), 0], chest: [0.02, -0.08 * Math.sin(phase), 0] });
  const w = (x, y, z) => F.root.localToWorld(V3(x, y, z));
  const feet = [footAt(0), footAt(1)];
  feet.forEach((f, i) => F.legIK(i === 0 ? 'l' : 'r', f.q, w(i === 0 ? 0.3 : -0.3, 0.5, 1.4)));
  // arms swing opposite to the legs (the left arm forward with the right leg)
  const fwd = F.root.localToWorld(V3(0, 0, 1)).sub(F.root.position).normalize();
  for (const [s, sx, ps] of [['l', 1, 1], ['r', -1, 0]]) { const sw = 0.13 * Math.sin(phase + ps * Math.PI);
    F.armIK(s, w(sx * 0.27, 0.88 - 0.02 * Math.abs(sw), 0.04 + sw), w(sx * 0.45, 0.95, -0.7), fwd); }
  F.grip(0.25, 0.25);
  return { feet, d };
}

// ---- chatting: weight shifts, head nods and turns towards the partner, a hand gesture now and then, the mouth moving
// while talking (talking(t) true/false), blinks.
export function chat(F, t, { pos, face, partner, groundAt, talking = () => false, seed = 1 } = {}) {
  const k = F.size || 1, R = F.look_ || { blink: 0, gesture: 0, nod: 0 }, ah = 0.075 * k;
  F.root.position.copy(pos); F.root.position.y = groundAt(pos.x, pos.z); F.root.rotation.y = face;
  const shift = 0.02 * Math.sin(t * 0.7 + seed);
  F.pose({ hipsX: shift * k, hipsY: -0.02 * k, spine: [0.04, 0, -shift], chest: [0.02 + 0.01 * Math.sin(t * 2.2 + seed), 0, shift * 0.5] });
  const w = (x, y, z) => F.root.localToWorld(V3(x, y, z)), fwd = F.root.localToWorld(V3(0, 0, 1)).sub(F.root.position).normalize();
  for (const [s, sx, zz] of [['l', 1, 0.04], ['r', -1, -0.06]]) { const p = w(sx * 0.12, 0, zz); p.y = groundAt(p.x, p.z) + ah; F.legIK(s, p, w(sx * 0.3, 0.5, 1.2)); }
  // a gesture: the right hand comes up open, palm up, every few seconds while talking
  const g = Math.max(0, Math.sin((t + R.gesture) * 0.9)) ** 3 * (talking(t) ? 1 : 0.3);
  F.armIK('l', w(0.285, 0.88, 0.04 + 0.01 * Math.sin(t)), w(0.45, 0.95, -0.7), fwd);
  F.armIK('r', w(-0.285, 0.88, 0.04).lerp(w(-0.2, 1.05, 0.3), g), w(-0.45, 0.95, -0.7), fwd.clone().lerp(V3(0, 1, 0), g).normalize());
  F.grip(0.2, 0.2 - 0.15 * g);
  const head = partner.clone().add(V3(0, 0.05 * Math.sin(t * 1.3 + R.nod), 0));
  F.headAt(head, 0.7); F.bones.head.rotation.x += 0.06 * Math.max(0, Math.sin((t + R.nod) * 2.4)) ** 4; F.root.updateMatrixWorld(true); F.look(head);
  const talk = talking(t) ? 0.5 + 0.5 * Math.sin(t * 17 + seed) * Math.sin(t * 7.3) : 0;
  const bt = (t + R.blink) % 3.3;
  F.face({ smile: 0.3 + 0.2 * Math.sin(t * 0.5 + seed), open: Math.max(0, talk) * 0.6, brow: 0.15 * g, blink: bt < 0.14 ? 1 - Math.abs(bt - 0.07) / 0.07 : 0, cheek: 0.2 });
}

// a straight path from a to b (pauses are the caller's business)
export function line(a, b) { const dir = b.clone().sub(a).setY(0).normalize(), len = a.distanceTo(b);
  return (s) => ({ pos: a.clone().addScaledVector(dir, Math.max(-5, Math.min(len + 5, s))), dir }); }
