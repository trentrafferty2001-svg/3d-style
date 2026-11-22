// Hair bench (3d-style v1.15, not a video): every hairstyle and beard in close-up, front, three-quarter, side and back,
// plus the head covers (Egyptian headcloth, Persian skullcap, the farmer's conical hat over short hair). One still per
// second: render it after any hair change and compare with the last bench.
import * as THREE from 'three';
import { V, cam, place } from './anim.js';
import { toon } from './toon.js';
import { conicalHat } from './farm2.js';
export const DURATION = 14; export const CAPTIONS = []; export const FADES = []; export const STYLE = { shadow: 'pcf' };
// [hairStyle, beard, camera direction (from the face), hair colour, skin, extra]
const SH = [
  ['crop', 'none', [0, 0, 1]], ['crop', 'stubble', [0.7, 0.05, 0.7]], ['curls', 'short', [0, 0.05, 1]], ['curls', 'short', [1, 0.05, 0.15]],
  ['braids', 'none', [-0.6, 0.1, -0.8]], ['braids', 'full', [0.75, 0, 0.66]], ['shaved', 'none', [0, 0.1, 1]], ['shaved', 'short', [-0.8, 0.05, 0.6]],
  ['headcloth', 'none', [0.6, 0.05, 0.8], 0xece4d0], ['headcloth', 'stubble', [-0.5, 0.15, -0.85], 0xd8c890], ['crop', 'full', [0, -0.05, 1]], ['curls', 'none', [0, 0.25, -1]],
  ['cap', 'none', [0.6, 0.1, 0.8], 0xf0ece2], ['crop', 'short', [0.5, 0.2, 0.85], null, 0x9a6644, 'hat'],
];
export const SHOTS = SH.map(([style, beard, dir, hc, sk, extra], i) => ({
  start: i, end: i + 1,
  build: ({ makeStage }) => {
    const scene = makeStage({ shadowSize: 2, sunDir: [-2, 5, 4], sun: 2.6 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    const F = toon({ skin: sk ?? [0x8a5232, 0x6e4128, 0xa9764e][i % 3], cloth: 0xc9b38c, belt: 0x9a4a2a, hair: hc ?? [0x1a1410, 0x3a2a1c, 0x241a14][i % 3], outfit: 'tunic', hairStyle: style, beard, seed: i + 1 });
    scene.add(F.root); if (extra === 'hat') F.hat = conicalHat(F);
    if (window.DBG) { window._F = F; window._FS = [F]; }
    const c = cam(30), d = V(...dir).normalize();
    return { scene, camera: c, update(t) {
      F.pose(); F.grip(0.3); const lt = t - i;
      F.look(F.root.localToWorld(V(0.2 * Math.sin(lt * 2), 1.66, 1))); F.face({ smile: 0.2, speech: null, open: lt > 0.5 ? 0.6 : 0 });
      const h = F.bones.head.localToWorld(V(0, 0.08, 0.01)), dist = extra === 'hat' ? 1.25 : 0.85;
      place(c, h.clone().addScaledVector(d, dist).toArray(), h.toArray(), 0);
      return { bloom: 0.15, dof: { focus: dist, aperture: 0.0015, maxblur: 0.004 } };
    } };
  },
}));
