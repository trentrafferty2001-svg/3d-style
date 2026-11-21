// Indus lane test scene (3d-style v1.3, not a video): a worker beside the open street drain in a Mohenjo-daro lane
// points down into it and turns to the camera; then a close-up of the drain with water running and a stream falling from
// the terracotta pipe. 5.5 s, 2 shots.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, springKeys, noise1, handheld, camPath } from './anim.js';
import { indusSite, indusHeightAt, indusWorker, IS } from './indus.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.0;
const FPOS = V(-1.1, 0, -0.3), YAW0 = 1.35;    // beyond the open drain (seen from the camera), facing down the lane towards the camera
const POINT_AT = V(IS.gapX, -0.15, IS.drainZ); // into the open drain

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [0.42, 0.86, 0.22], fog: 0.012, shadowSize: 9, shadowAt: [1, 1, -1], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(6, 2, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(-6, 4, 1); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xd9a068, 0.45); bounce.position.set(0.3, -1, 0.2); scene.add(bounce);
  const site = indusSite({ seed: 2 }); scene.add(site);
  (scene.userData.updaters = scene.userData.updaters || []).push((t) => site.userData.update(t)); // splash droplets
  return { scene, site };
}

const turnK = (t) => springKeys(t, [[0, 0], [0.6, 1], [2.1, 0]], 1.4, 0.6);  // towards the drain and back
const armK = (t) => springKeys(t, [[0, 0], [0.8, 1], [2.05, 0]], 1.8, 0.45);
function rig(makeStage) {
  const W = world(makeStage);
  const F = indusWorker(); W.scene.add(F.root);
  F.root.position.copy(FPOS); F.root.position.y = indusHeightAt(FPOS.x, FPOS.z);
  if (window.DBG) { window._F = F; window._SITE = W.site; window._W = W; }
  const act = (t, camPos) => {
    const k = turnK(t), a = clamp(armK(t), 0, 1.2);
    F.root.rotation.y = YAW0 + 0.45 * k; // the drain is on his left: he turns a little towards it
    const breathe = Math.sin(t * 2.3) * 0.012, shift = noise1(t * 0.5, 3) * 0.015, lean = 0.12 * clamp(k);
    const nod = t > 4.0 ? 0.12 * Math.max(0, Math.sin(clamp((t - 4.0) / 0.5) * Math.PI * 2)) : 0;
    F.pose({ hipsY: -0.02 + breathe * 0.3, hipsX: shift, hipRot: [0, 0.1 * k, 0], spine: [0.03 + lean, 0.12 * k, -shift * 2], chest: [-0.02 + breathe + lean * 0.5, 0.08 * k, shift] });
    F.kilt(noise1(t * 0.9, 5) * 0.04 + lean * 0.3, noise1(t * 1.3, 6) * 0.05);
    const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
    for (const [s, sx, zz] of [['l', 1, 0.02], ['r', -1, -0.08]]) { const fp = w(sx * 0.12, 0, zz); fp.y = indusHeightAt(fp.x, fp.z) + 0.075; F.legIK(s, fp, w(sx * 0.3, 0.5, 1.2)); }
    const side = (sx) => F.root.localToWorld(V(sx, 0, 0)).sub(F.root.position).normalize();
    const restL = w(0.29, 0.88 + breathe, 0.03 + 0.015 * Math.sin(t * 1.7)), restR = w(-0.29, 0.88 + breathe, 0.03 + 0.015 * Math.sin(t * 1.5 + 1)); // clear of the kilt's flare (probe_rome)
    F.armIK('r', restR, w(-0.45, 0.95, -0.7), side(-1));
    // the left arm points down into the drain with a spring (overshoot, settle), clamped so it never undershoots into the body
    const sh = F.bones.lSh.getWorldPosition(V(0, 0, 0)), aim = POINT_AT.clone().add(V(0, 0.6, 0)).sub(sh).normalize(), point = sh.clone().addScaledVector(aim, 0.6); // aimed above the drain: pointing straight down reads as a hanging arm
    F.armIK('l', restL.clone().lerp(point, a), w(0.6, lerpN(0.95, 1.2, a), lerpN(-0.7, -0.4, a)), side(1).lerp(V(0, 1, 0), clamp(a)).normalize());
    F.grip(0.15 - 0.1 * clamp(a), 0.15);
    // the head only tilts part of the way down (a fully bowed head hides the face from the camera); the eyes go all the way
    const look = camPos.clone().lerp(POINT_AT.clone().add(V(0, 0.9, 0)), clamp(k));
    F.headAt(look, 0.7); F.bones.neck.rotation.x += nod * 0.5; F.bones.head.rotation.x += nod * 0.5; F.root.updateMatrixWorld(true);
    F.look(camPos.clone().lerp(POINT_AT, clamp(springKeys(t, [[0, 0], [0.5, 1], [1.95, 0]], 2.4, 0.7))));
    const smile = 0.25 + 0.55 * smooth(range(t, 2.2, 2.8)), blink = Math.max(0, 1 - Math.abs(t - 0.45 - 0.07) / 0.07, 1 - Math.abs(t - 1.9 - 0.07) / 0.07, 1 - Math.abs(t - 4.6 - 0.07) / 0.07);
    F.face({ smile, cheek: smile * 0.8, teeth: 0.35 * smooth(range(t, 2.4, 2.9)), brow: 0.25 * clamp(a), blink });
  };
  return { W, F, act };
}
const lerpN = (a, b, k) => a + (b - a) * k;

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(40);
    return { scene: R.W.scene, camera: c, update(lt) {
      const k = smooth(lt / CUT), p = camPath(k, [[6.2, 1.25, 0.55], [5.5, 1.22, 0.45], [4.9, 1.2, 0.35]]), hh = handheld(lt, 0.8, 4);
      const cp = V(p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]); R.act(lt, cp);
      place(c, cp.toArray(), [-1.0, 1.55, -0.35], hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(FPOS), aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.5, 9);
      const cp = V(0.95 - 0.12 * k + hh.p[0], 0.95 - 0.08 * k + hh.p[1], 0.05 - 0.1 * k + hh.p[2]); R.act(t, cp); // from the camera side of the drain
      const tg = V(IS.gapX + 0.05, -0.02, IS.drainZ - 0.05);
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(tg), aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
