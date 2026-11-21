// Rice-fish paddy test scene (3d-style v1.6, not a video): a farmer in a conical hat stands shin-deep among the rice
// while carp swim past his legs, rings spreading in the water round his shins. Shot 1 wide; shot 2 low over the water as
// the carp weaves between the stems. 5.5 s.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, springKeys, noise1, handheld, camPath } from './anim.js';
import { paddySite, paddyFarmer, carp, FS } from './farm2.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.0, FPOS = V(0.5, FS.mudY, 2.0), YAW = 0.2;
const feet = [[0.12, 0.0], [-0.12, -0.04]].map(([x, z]) => [FPOS.x + Math.cos(YAW) * x + Math.sin(YAW) * z, FPOS.z - Math.sin(YAW) * x + Math.cos(YAW) * z]);
const ROW0 = FS.rice.z[0] + 0.2, LANE = ROW0 + (Math.floor((FPOS.z + 0.3 - ROW0) / FS.step) + 1.5) * FS.step; // between two rows, two steps in front of his shins
const heroAt = (t, lag = 0) => { const u = t - lag; return V(-1.3 + u * 0.6, -0.045, LANE + 0.05 * Math.sin(u * 1.6)); }; // backs just under the surface

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [0.6, 0.6, 0.5], fog: 0.006, shadowSize: 8, shadowAt: [0.5, 0.5, 1.5], envI: 0.9, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.4); fill.position.set(-3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(-2, 7, -4); scene.add(rim); // high enough that its glint on the water stays out of the close-up
  const site = paddySite({ seed: 6, impacts: feet, clear: [[FPOS.x, FPOS.z, 0.5], [-0.6, 3.2, LANE + 0.2, LANE + 2.2]] }); scene.add(site);
  (scene.userData.updaters = scene.userData.updaters || []).push((t) => site.userData.update(t));
  return { scene, site };
}
function rig(makeStage) {
  const W = world(makeStage), S = W.site;
  const F = paddyFarmer(); F.root.position.copy(FPOS); F.root.rotation.y = YAW; W.scene.add(F.root);
  const heroes = [carp(0.34, { seed: 3, style: 'koi' }), carp(0.27, { seed: 5, style: 'carp' })]; heroes.forEach(h => { h.traverse(o => { o.userData.noGround = true; }); W.scene.add(h); });
  if (window.DBG) { window._F = F; window._FS = [F]; window._SITE = S; window._W = W; }
  const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
  const act = (t, camPos) => {
    heroes.forEach((h, i) => { const lag = i * 0.75, p = heroAt(t, lag), q = heroAt(t + 0.05, lag); h.position.copy(p); h.face(q.clone().sub(p)); h.swim(t * 1.1 + i, 10, 0.45); });
    const breathe = Math.sin(t * 2.0) * 0.01, watch = heroAt(t).clone();
    F.pose({ hipsY: -0.02 + breathe * 0.3, spine: [0.06, 0, 0], chest: [0.02 + breathe, 0, 0] });
    F.kilt(noise1(t * 0.8, 3) * 0.03, noise1(t * 1.2, 4) * 0.04);
    for (const [s, sx, zz] of [['l', 1, 0.0], ['r', -1, -0.04]]) F.legIK(s, w(sx * 0.12, 0.075, zz), w(sx * 0.3, 0.5, 1.2));
    const side = (sx) => F.root.localToWorld(V(sx, 0, 0)).sub(F.root.position).normalize();
    const hip = (sx) => F.bones.hips.localToWorld(V(sx * 0.225, 0.02, -0.02)); // hands on the hips, watching
    const k = smooth(range(t, 0.4, 1.1));
    for (const [s, sx] of [['l', 1], ['r', -1]]) F.armIK(s, w(sx * 0.29, 0.88, 0.03).lerp(hip(sx), k), w(sx * 0.6, 1.1, -0.4), side(sx).lerp(V(0, 1, 0), 0.5 * k).normalize());
    F.grip(0.2 + 0.5 * k, 0.2 + 0.5 * k);
    const look = watch.lerp(camPos, 0.35 * smooth(range(t, 2.1, 2.7)) * (1 - smooth(range(t, 3.4, 3.9))));
    F.headAt(look.clone().add(V(0, 0.9, 0)), 0.45); // only half-way down, so the hat brim does not hide his face F.look(look);
    F.face({ smile: 0.3 + 0.45 * smooth(range(t, 1.6, 2.3)), cheek: 0.4, blink: Math.max(0, 1 - Math.abs(t - 0.9 - 0.07) / 0.07, 1 - Math.abs(t - 4.4 - 0.07) / 0.07) });
  };
  return { W, act };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(42);
    return { scene: R.W.scene, camera: c, update(lt) {
      const k = smooth(lt / CUT), p = camPath(k, [[2.2, 1.55, 6.8], [1.95, 1.45, 6.3], [1.7, 1.38, 5.8]]), hh = handheld(lt, 0.8, 8);
      const cp = V(p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]); R.act(lt, cp);
      place(c, cp.toArray(), [-0.2, 0.55, 1.2], hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, flare: 0.3, dof: { focus: cp.distanceTo(FPOS), aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.5, 15), f = heroAt(t);
      // above the rice tops, in the cleared strip in front of the lane, panning slowly after the carp (it leads the frame)
      const cp = V(0.9 + 0.5 * f.x + hh.p[0], 1.02 - 0.06 * k + hh.p[1], LANE + 1.55 + hh.p[2]); R.act(t, cp);
      const tg = V(f.x + 0.12, -0.05, LANE + 0.05);
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, dof: { focus: cp.distanceTo(tg), aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
