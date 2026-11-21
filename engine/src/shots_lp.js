// Lip-sync test scene (3d-style v1.7, not a video): a Roman worker on the pavement says one line to camera. The mouth is
// driven by the voice's own sound timings (vo_lp.js -> lipsync.js): shut on m/b/p, lip under the teeth on f, rounded on
// o/w, spread on ee, the jaw a beat behind. Shot 1 waist-up, shot 2 close on the face. 6.8 s.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, noise1, handheld } from './anim.js';
import { romanSite, romanHeightAt, romanWorker, RS } from './roman.js';
import { lipTracks } from './lipsync.js';
import { VO } from './vo_lp.js';

export const DURATION = 6.8; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.25;                                  // between "marble." and "Mostly"
const FPOS = V(-1.2, RS.walkY, 2.75), YAW = 0.12;  // on the near pavement, facing the camera
const talk = lipTracks(VO);

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [-0.65, 0.42, 0.62], fog: 0.011, shadowSize: 9, shadowAt: [-0.5, 1, -1], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6); rim.position.set(2, 4, -6); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xd9a068, 0.4); bounce.position.set(-0.6, -1, 0.5); scene.add(bounce);
  const site = romanSite({ seed: 1 }); scene.add(site);
  return { scene, site };
}

function rig(makeStage) {
  const W = world(makeStage);
  const F = romanWorker(); W.scene.add(F.root);
  F.root.position.copy(FPOS); F.root.position.y = romanHeightAt(FPOS.x, FPOS.z); F.root.rotation.y = YAW;
  if (window.DBG) { window._F = F; window._FS = [F]; window._SITE = W.site; window._W = W; window._TALK = talk; }
  const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
  const act = (t, camPos) => {
    const m = talk(t);
    const breathe = Math.sin(t * 2.3) * 0.012, shift = noise1(t * 0.5, 3) * 0.015;
    F.pose({ hipsY: -0.02 + breathe * 0.3, hipsX: shift, spine: [0.03, 0, -shift * 2], chest: [-0.02 + breathe, noise1(t * 0.4, 8) * 0.05, shift] });
    F.kilt(noise1(t * 0.9, 5) * 0.04, noise1(t * 1.3, 6) * 0.05);
    for (const [s, sx, zz] of [['l', 1, 0.02], ['r', -1, -0.08]]) { const fp = w(sx * 0.12, 0, zz); fp.y = romanHeightAt(fp.x, fp.z) + 0.075; F.legIK(s, fp, w(sx * 0.3, 0.5, 1.2)); }
    // hanging hands: the hint points forward, so the palms face the thighs (the sideways hint turned them to the camera)
    const fwd = F.root.localToWorld(V(0, 0, 1)).sub(F.root.position).normalize(), side = () => fwd.clone();
    // a small open-hand beat on "Mostly" (left hand) while talking; otherwise relaxed at the sides
    const g = smooth(range(t, 3.35, 3.75)) * (1 - smooth(range(t, 5.4, 6.0)));
    const restL = w(0.285, 0.88 + breathe, 0.03 + 0.015 * Math.sin(t * 1.7)), beatL = w(0.24, 1.02 + 0.03 * Math.sin(t * 5.2) * g, 0.3);
    F.armIK('l', restL.lerp(beatL, g), w(0.45, 0.95, -0.7), side(1).lerp(V(0, 1, 0), 0.6 * g).normalize());
    F.armIK('r', w(-0.285, 0.88 + breathe, 0.03 + 0.015 * Math.sin(t * 1.5 + 1)), w(-0.45, 0.95, -0.7), side(-1));
    F.grip(0.15 + 0.1 * (1 - g), 0.2);
    // head: at the camera, with small nods that follow the jaw (stress), and a slow drift
    F.headAt(camPos.clone().add(V(noise1(t * 0.35, 11) * 0.15, -0.05, 0)), 0.75);
    F.bones.head.rotation.x += 0.05 * m.jaw; F.bones.head.rotation.z += noise1(t * 0.5, 12) * 0.03; F.root.updateMatrixWorld(true);
    F.look(camPos);
    const blink = Math.max(0, 1 - Math.abs(t - 1.25 - 0.07) / 0.07, 1 - Math.abs(t - 3.32 - 0.07) / 0.07, 1 - Math.abs(t - 5.95 - 0.07) / 0.07);
    const smile = 0.15 + 0.35 * smooth(range(t, 4.2, 4.8));
    F.face({ smile, cheek: smile * 0.6, brow: 0.1 + 0.3 * m.jaw + 0.2 * smooth(range(t, 3.3, 3.6)) * (1 - smooth(range(t, 4.2, 4.6))), blink, speech: m });
  };
  return { W, F, act };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(32);
    return { scene: R.W.scene, camera: c, update(lt) {
      // chest-up at eye height, a slow push in
      const k = smooth(lt / CUT), hh = handheld(lt, 0.6, 3);
      const cp = V(-0.88 - 0.04 * k + hh.p[0], 1.55 + hh.p[1], 4.75 - 0.3 * k + hh.p[2]); R.act(lt, cp); // chest-up
      const head = R.F.bones.head.getWorldPosition(V(0, 0, 0));
      place(c, cp.toArray(), [head.x + 0.02, head.y - 0.22, head.z], hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(head), aperture: 0.003, maxblur: 0.006 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(28);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      // close on the face, a little to the side
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.4, 9);
      const cp = V(-0.98 + 0.04 * k + hh.p[0], 1.6 + hh.p[1], 4.0 - 0.08 * k + hh.p[2]); R.act(t, cp); // the face, at eye height
      const head = R.F.bones.head.getWorldPosition(V(0, 0, 0));
      place(c, cp.toArray(), [head.x, head.y - 0.03, head.z], hh.roll); // the whole head, a little above the middle
      return { bloom: 0.3, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(head) - 0.08, aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
