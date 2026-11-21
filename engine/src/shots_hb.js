// Hand test bench (not a video): the right hand in close-up, one pose per second: relaxed at the side (two angles),
// half-curled, a fist, and F.hold() on a thin rope, a mallet-thick handle and an upright pole. Render a still per
// second after any change to the hands (QA in STYLE.md) and compare with the last bench.
import * as THREE from 'three';
import { V, cam, place } from './anim.js';
import { toon } from './toon.js';
export const DURATION = 8; export const CAPTIONS = []; export const FADES = []; export const STYLE = { shadow: 'pcf' };
const ROPE = { a: V(-0.48, 1.05, 0.3), b: V(-0.02, 1.07, 0.3), r: 0.009 };
const HANDLE = { a: V(-0.46, 1.0, 0.32), b: V(-0.1, 1.02, 0.3), r: 0.017 };
const POLE = { a: V(-0.3, 0.75, 0.33), b: V(-0.3, 1.35, 0.33), r: 0.024 };
// [what, camera offset from the palm, extra]
const SH = [
  ['relaxed', [-0.25, 0.05, 0.22]], ['relaxed', [0.02, 0.06, 0.32]], ['half', [-0.22, 0.04, 0.24]], ['fist', [-0.22, 0.04, 0.24]],
  ['rope', [-0.12, 0.1, 0.3], ROPE], ['handle', [-0.12, 0.1, 0.3], HANDLE], ['pole', [-0.2, 0.06, 0.28], POLE], ['pole', [0.05, 0.08, -0.3], POLE],
];
export const SHOTS = SH.map(([what, off, cyl], i) => ({
  start: i, end: i + 1,
  build: ({ makeStage }) => {
    const scene = makeStage({ shadowSize: 2, sunDir: [-2, 5, 4], sun: 2.6 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    const F = toon({ skin: 0x8a5232, cloth: 0xefe6d0, belt: 0x9a4a2a, outfit: 'tunic' }); scene.add(F.root); const c = cam(30);
    if (cyl) { const L = cyl.b.distanceTo(cyl.a), m = new THREE.Mesh(new THREE.CylinderGeometry(cyl.r, cyl.r, L, 24), new THREE.MeshStandardMaterial({ color: cyl === ROPE ? 0xb89a68 : 0x8a5a30, roughness: 0.8 }));
      m.position.copy(cyl.a).lerp(cyl.b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), cyl.b.clone().sub(cyl.a).normalize()); m.castShadow = m.receiveShadow = true; scene.add(m); }
    if (window.DBG) { window._F = F; window._FS = [F]; }
    return { scene, camera: c, update() {
      F.pose(); const w = (x, y, z) => F.root.localToWorld(V(x, y, z)), fwd = V(0, 0, 1);
      F.armIK('l', w(0.285, 0.88, 0.03), w(0.45, 0.95, -0.7), fwd);
      if (cyl) { const n = F.hold('r', cyl, { u: 0.5 }); if (window.DBG) window._HOLDS = [{ F, s: 'r', cyl, n }]; }
      else { F.armIK('r', w(-0.285, 0.88, 0.03), w(-0.45, 0.95, -0.7), fwd); if (window.DBG) window._HOLDS = []; }
      F.grip(0.15, what === 'half' ? 0.5 : what === 'fist' ? 1 : 0.0);
      if (cyl) F.hold('r', cyl, { u: 0.5 });                             // grip() above reset the fingers; wrap them again
      const p = F.bones.rWr.localToWorld(V(0, -0.06, 0));
      place(c, p.clone().add(V(...off)).toArray(), p.toArray(), 0); F.face({ smile: 0.15 });
      return { dof: { focus: V(...off).length(), aperture: 0.002, maxblur: 0.004 } };
    } };
  },
}));
