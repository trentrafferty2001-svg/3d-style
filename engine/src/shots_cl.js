// Cloth test bench (not a video): the tunic and the kilt in close-up, front, side and back, with arms and legs in
// poses that crease cloth (arm raised, hands on hips, a step, a knee bent). One still per second: render it after any
// cloth change (QA in STYLE.md) and compare with the last bench.
import * as THREE from 'three';
import { V, cam, place } from './anim.js';
import { toon } from './toon.js';
export const DURATION = 12; export const CAPTIONS = []; export const FADES = []; export const STYLE = { shadow: 'pcf' };
// [outfit, pose, camera offset from the look point, look point (local), lens]
const SH = [
  ['tunic', 'hang', [0, 0.05, 1.25], [0, 1.3, 0], 30],
  ['tunic', 'reach', [0.85, 0.1, 0.95], [0, 1.3, 0], 30],
  ['tunic', 'akimbo', [0, 0.05, 1.3], [0, 1.25, 0], 30],
  ['tunic', 'step', [1.9, 0.0, 0.25], [0, 1.0, 0], 30],
  ['tunic', 'reach', [-0.6, 0.12, -1.0], [0, 1.3, 0], 30],
  ['tunic', 'step', [0.9, -0.05, 1.9], [0, 0.95, 0], 30],
  ['kilt', 'hang', [0, 0.0, 1.3], [0, 0.95, 0], 30],
  ['kilt', 'step', [1.5, -0.05, 0.4], [0, 0.85, 0], 30],
  ['kilt', 'akimbo', [0.7, 0.1, 1.0], [0, 1.1, 0], 30],
  ['tunic', 'akimbo', [0.95, 0.15, 0.0], [0, 1.3, 0], 30],
  ['tunic', 'climb', [1.5, 0.0, 0.7], [0, 0.95, 0], 30],
  ['kilt', 'climb', [0.9, 0.05, 1.4], [0, 0.95, 0], 30],
];
export const SHOTS = SH.map(([outfit, pose, off, lk, lens], i) => ({
  start: i, end: i + 1,
  build: ({ makeStage }) => {
    const scene = makeStage({ shadowSize: 3, sunDir: [-2, 5, 4], sun: 2.6 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    const F = toon({ skin: 0x8a5232, cloth: outfit === 'tunic' ? 0xc9b38c : 0xefe6d0, belt: 0x9a4a2a, outfit }); scene.add(F.root); const c = cam(lens);
    if (window.DBG) { window._F = F; window._FS = [F]; }
    return { scene, camera: c, update() {
      const w = (x, y, z) => F.root.localToWorld(V(x, y, z)), fwd = V(0, 0, 1);
      if (pose === 'step') {
        F.pose({ hipsY: -0.05, hipsZ: 0.0, hipRot: [0, 0.1, 0], spine: [0.04, -0.06, 0] });
        F.legIK('l', w(0.1, 0.075, 0.28), w(0.3, 0.5, 1.4)); F.legIK('r', w(-0.1, 0.12, -0.3), w(-0.3, 0.5, 1.4));
      } else if (pose === 'climb') { // a foot up on a 35 cm step: the thigh lifts into the skirt
        F.pose({ hipsY: -0.04, spine: [0.12, 0, 0] });
        F.legIK('l', w(0.1, 0.39, 0.3), w(0.3, 0.8, 1.4)); F.legIK('r', w(-0.1, 0.075, -0.06), w(-0.3, 0.5, 1.4));
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.33, 0.35), new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.9 }));
        if (!F._step) { F._step = st; st.position.copy(w(0.1, 0.165, 0.33)); st.castShadow = st.receiveShadow = true; scene.add(st); }
      } else {
        F.pose({ hipsY: -0.01 });
        F.legIK('l', w(0.1, 0.075, 0.02), w(0.3, 0.5, 1.4)); F.legIK('r', w(-0.1, 0.075, -0.02), w(-0.3, 0.5, 1.4));
      }
      if (pose === 'reach') { F.armIK('r', w(-0.2, 1.42, 0.5), w(-0.7, 1.1, 0.0), V(0, 1, 0)); F.armIK('l', w(0.27, 0.88, 0.04), w(0.45, 0.95, -0.7), fwd); F.grip(0.25, 0.1); }
      else if (pose === 'akimbo') { for (const [s, sx] of [['l', 1], ['r', -1]]) F.armIK(s, w(sx * 0.215, 1.0, 0.0), w(sx * 0.7, 1.1, -0.2), V(0, 0, 1)); F.grip(0.9, 0.9); }
      else if (pose === 'step' || pose === 'climb') { F.armIK('l', w(0.27, 0.88, 0.17), w(0.45, 0.95, -0.7), fwd); F.armIK('r', w(-0.27, 0.88, -0.1), w(-0.45, 0.95, -0.7), fwd); F.grip(0.25); }
      else { F.armIK('l', w(0.27, 0.88, 0.04), w(0.45, 0.95, -0.7), fwd); F.armIK('r', w(-0.27, 0.88, 0.04), w(-0.45, 0.95, -0.7), fwd); F.grip(0.25); }
      F.kilt(pose === 'step' ? 0.05 : 0, 0);
      F.headAt(w(0, 1.6, 2), 0.5); F.look(w(0, 1.6, 2)); F.face({ smile: 0.15 });
      place(c, V(...lk).add(V(...off).multiplyScalar(1.9)).toArray(), lk, 0);
      return { bloom: 0.15, dof: { focus: V(...off).length() * 1.9, aperture: 0.0015, maxblur: 0.004 } };
    } };
  },
}));
