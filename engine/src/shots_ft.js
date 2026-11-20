// Face test bench (not a video): expressions and gaze in close-up from several angles.
import * as THREE from 'three';
import { V, cam, place } from './anim.js';
import { toon } from './toon.js';
export const DURATION = 12; export const CAPTIONS = []; export const FADES = []; export const STYLE = { shadow: 'pcf' };
const EX = {
  neutral: { smile: 0.15 }, grin: { smile: 0.95, teeth: 0.55, cheek: 0.9, brow: 0.3 },
  strain: { brow: -0.85, smile: -0.35, teeth: 1, squint: 0.6, flare: 0.8 }, phew: { brow: 0.6, oh: 0.85, wide: 0.7 },
};
// [camera pos, look at, expression, gaze target, head yaw]
const SH = [
  [[0, 1.66, 0.85], [0, 1.66, 0], 'neutral', [0, 1.66, 1], 0],
  [[0.45, 1.68, 0.72], [0, 1.66, 0], 'neutral', [-0.8, 1.66, 0.6], 0],
  [[-0.45, 1.68, 0.72], [0, 1.66, 0], 'neutral', [0.8, 1.7, 0.6], 0],
  [[0, 1.66, 0.85], [0, 1.66, 0], 'grin', [0, 1.66, 1], 0],
  [[0.42, 1.62, 0.74], [0, 1.66, 0], 'grin', [-0.6, 1.8, 1], 0.25],
  [[0, 1.66, 0.85], [0, 1.66, 0], 'strain', [0.2, 2.2, 1], 0],
  [[-0.42, 1.6, 0.74], [0, 1.66, 0], 'strain', [-0.5, 2.4, 1], -0.3],
  [[0, 1.66, 0.85], [0, 1.66, 0], 'phew', [0, 1.9, 1], 0],
  [[0.78, 1.66, 0.08], [0, 1.66, 0], 'grin', [0, 1.66, 1], 0],
  [[0.28, 1.55, 0.8], [0, 1.66, 0], 'neutral', [0, 1.2, 1], 0],
  [[0, 1.66, 0.85], [0, 1.66, 0], 'neutral', [0.5, 1.4, 1], 0],
  [[0.7, 1.3, 1.6], [0, 1.2, 0], 'grin', [0, 1.66, 1], 0],
];
export const SHOTS = SH.map(([cp, lk, ex, gz, yaw], i) => ({
  start: i, end: i + 1,
  build: ({ makeStage }) => {
    const scene = makeStage({ shadowSize: 2, sunDir: [-2, 5, 4], sun: 2.6 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    const F = toon({ skin: 0x8a5232, cloth: 0xefe6d0, belt: 0x9a4a2a }); scene.add(F.root); const c = cam(30);
    return { scene, camera: c, update() { F.pose(); F.bones.neck.rotation.y = yaw * 0.4; F.bones.head.rotation.y = yaw * 0.6; F.root.updateMatrixWorld(true); F.look(V(...gz)); F.face(EX[ex]); F.grip(0.3); place(c, cp, lk); return { bloom: 0.15 }; } };
  },
}));
