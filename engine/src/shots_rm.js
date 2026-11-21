// Roman street test scene (3d-style v1.2, not a video): a worker in a tunic on the pavement turns, points at the
// portico, then turns back with a smile. Shows the Roman set: basalt road and stepping stones, kerbs, travertine
// pavement, fluted portico, plaster walls, amphorae, olive, cypresses and umbrella pines in the wind. 5.5 s, 2 shots.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, spring, springKeys, noise1, handheld, camPath } from './anim.js';
import { romanSite, romanHeightAt, romanWorker, RS } from './roman.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.0;
const FPOS = V(-1.2, RS.walkY, 2.75), YAW0 = 0.3;  // on the near pavement, facing the camera
const POINT_AT = V(-6.5, 1.2, 0.6);                // down the street, at the stepping stones

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [-0.65, 0.42, 0.62], fog: 0.011, shadowSize: 9, shadowAt: [-0.5, 1, -1], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6); rim.position.set(2, 4, -6); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xd9a068, 0.4); bounce.position.set(-0.6, -1, 0.5); scene.add(bounce);
  const site = romanSite({ seed: 1 }); scene.add(site);
  return { scene, site };
}

// worker: pure functions of time
const turnK = (t) => springKeys(t, [[0, 0], [0.85, 1], [2.25, 0]], 1.4, 0.6);               // towards the crossing and back
const armK = (t) => springKeys(t, [[0, 0], [1.05, 1], [2.2, 0]], 1.8, 0.45);                // point, then lower
function rig(makeStage) {
  const W = world(makeStage);
  const F = romanWorker(); W.scene.add(F.root);
  F.root.position.copy(FPOS); F.root.position.y = romanHeightAt(FPOS.x, FPOS.z);
  if (window.DBG) { window._F = F; window._SITE = W.site; window._W = W; }
  const act = (t, camPos) => {
    const k = turnK(t), a = clamp(armK(t), 0, 1.2); // overshoot past the point is fine, undershoot would push the hand into the skirt
    F.root.rotation.y = YAW0 - 0.45 * k; // the whole body turns a little, the rest comes from the trunk and head
    const breathe = Math.sin(t * 2.3) * 0.012, shift = noise1(t * 0.5, 3) * 0.015;
    const nod = t > 4.15 ? 0.12 * Math.max(0, Math.sin(clamp((t - 4.15) / 0.5) * Math.PI * 2)) : 0;
    F.pose({ hipsY: -0.02 + breathe * 0.3, hipsX: shift, hipRot: [0, -0.25 * k, 0], spine: [0.03, -0.3 * k, -shift * 2], chest: [-0.02 + breathe, -0.2 * k, shift] });
    F.kilt(noise1(t * 0.9, 5) * 0.04, noise1(t * 1.3, 6) * 0.05);
    const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
    for (const [s, sx, zz] of [['l', 1, 0.02], ['r', -1, -0.08]]) { const fp = w(sx * 0.12, 0, zz); fp.y = romanHeightAt(fp.x, fp.z) + 0.075; F.legIK(s, fp, w(sx * 0.3, 0.5, 1.2)); }
    // arms: relaxed at the sides; the right arm points at the portico with a spring (overshoot and settle)
    // relaxed: hands hang beside the thighs, elbows a little back (a slow sway with the breath)
    const restL = w(0.285, 0.88 + breathe, 0.03 + 0.015 * Math.sin(t * 1.7)), restR = w(-0.285, 0.88 + breathe, 0.03 + 0.015 * Math.sin(t * 1.5 + 1)); // clear of the skirt (probe_rome)
    const side = (sx) => F.root.localToWorld(V(sx, 0, 0)).sub(F.root.position).normalize(); // back of the hand faces out, palm to the thigh
    F.armIK('l', restL, w(0.45, 0.95, -0.7), side(1));
    const sh = F.bones.rSh.getWorldPosition(V(0, 0, 0)), aim = POINT_AT.clone().sub(sh).normalize(), point = sh.clone().addScaledVector(aim, 0.6);
    F.armIK('r', restR.clone().lerp(point, a), w(lerpN(-0.45, -0.7, a), lerpN(0.95, 1.3, a), lerpN(-0.7, -0.3, a)), side(-1).lerp(V(0, 1, 0), clamp(a)).normalize());
    F.grip(0.15, 0.15 - 0.1 * clamp(a));
    // head and eyes: at the camera, then the column (eyes lead), then back to the camera
    const look = camPos.clone().lerp(POINT_AT, clamp(k));
    F.headAt(look, 0.7); F.bones.neck.rotation.x += nod * 0.5; F.bones.head.rotation.x += nod * 0.5; F.root.updateMatrixWorld(true);
    F.look(camPos.clone().lerp(POINT_AT, clamp(springKeys(t, [[0, 0], [0.7, 1], [2.1, 0]], 2.4, 0.7))));
    const smile = 0.25 + 0.6 * smooth(range(t, 3.4, 4.0)), blink = Math.max(0, 1 - Math.abs(t - 0.62 - 0.07) / 0.07, 1 - Math.abs(t - 2.05 - 0.07) / 0.07, 1 - Math.abs(t - 4.7 - 0.07) / 0.07);
    F.face({ smile, cheek: smile * 0.8, teeth: 0.4 * smooth(range(t, 3.6, 4.1)), brow: 0.25 * clamp(a), blink });
  };
  return { W, F, act };
}
const lerpN = (a, b, k) => a + (b - a) * k;

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(42);
    return { scene: R.W.scene, camera: c, update(lt) {
      // crane down: from the roofs and cypresses to the worker on the pavement
      const k = smooth(clamp(lt / 1.6)), p = camPath(k, [[1.3, 4.6, 10.2], [0.9, 2.6, 8.6], [0.55, 1.45, 7.1]]), hh = handheld(lt, 0.8, 2);
      const lk = V(-1.6, 3.4, -4.0).lerp(V(-1.5, 1.25, 1.2), k);
      const cp = V(p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]); R.act(lt, cp);
      place(c, cp.toArray(), lk.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, flare: 0.3, dof: { focus: cp.distanceTo(FPOS), aperture: 0.0018, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(30);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.6, 7);
      const cp = V(-0.05 - 0.15 * k + hh.p[0], 1.52 + hh.p[1], 4.95 - 0.3 * k + hh.p[2]); R.act(t, cp);
      const head = R.F.bones.head.getWorldPosition(V(0, 0, 0));
      place(c, cp.toArray(), [head.x + 0.05, head.y - 0.2, head.z], hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(head), aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
void spring;
