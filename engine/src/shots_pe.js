// Persia test scene (3d-style v1.5, not a video): a Yazd lane with windcatchers; qanat water runs along the jub and pours
// from a stone spout. A worker lifts his jar under the spout and it fills. Shot 1 cranes down from the windcatchers to the
// worker; shot 2 is close on the jar filling. 5.5 s.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, springKeys, noise1, handheld, camPath } from './anim.js';
import { persiaSite, persiaHeightAt, persianWorker2, PS } from './persia.js';
import { waterJar } from './egypt.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.0;
const WPOS = V(0.12, 0, -0.95);                    // the worker, facing the spout (-z)
const T0 = 0.9, T1 = 1.75;                          // the jar moves from his hip to under the spout

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [0.5, 0.75, 0.42], fog: 0.006, shadowSize: 10, shadowAt: [0, 2, -1], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(4, 2, 5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(-4, 4, -5); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xd9a068, 0.45); bounce.position.set(0.2, -1, 0.3); scene.add(bounce);
  const site = persiaSite({ seed: 5 }); scene.add(site);
  (scene.userData.updaters = scene.userData.updaters || []).push((t) => site.userData.update(t));
  return { scene, site };
}
function rig(makeStage) {
  const W = world(makeStage), S = W.site, U = S.userData;
  const F = persianWorker2(); F.root.position.copy(WPOS); F.root.rotation.y = Math.PI; W.scene.add(F.root);
  const jar = waterJar(); W.scene.add(jar); // held in the hands, so not a grounded prop
  const fillDisc = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a5048, roughness: 0.08 })); jar.add(fillDisc);
  const under = V(U.spoutLip.x, 1.02, U.spoutLip.z + 0.06);   // jar centre under the stream
  const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
  const jarAt = (t) => { const k = springKeys(t, [[0, 0], [T0, 1]], 1.3, 0.75), hip = w(0.05, 0.86, 0.3); return hip.lerp(under, clamp(k)).add(V(0, Math.sin(t * 2.1) * 0.004, 0)); };
  let filled = 0;
  if (window.DBG) { window._F = F; window._FS = [F]; window._SITE = S; window._W = W; window._JAR = jar; }
  const act = (t, camPos) => {
    const k = smooth(range(t, T0, T1)), lean = 0.16 * k, breathe = Math.sin(t * 2.1) * 0.01;
    F.pose({ hipsY: -0.03 - 0.03 * k + breathe * 0.3, spine: [0.05 + lean, 0, 0], chest: [0.02 + breathe + lean * 0.4, 0, 0] });
    F.kilt(noise1(t * 0.8, 3) * 0.03 - 0.05 * k, noise1(t * 1.2, 4) * 0.04);
    for (const [s, sx, zz] of [['l', 1, 0.05], ['r', -1, -0.06]]) { const fp = w(sx * 0.12, 0, zz); fp.y = persiaHeightAt(fp.x, fp.z) + 0.075; F.legIK(s, fp, w(sx * 0.3, 0.5, 1.2)); }
    jar.position.copy(jarAt(t)); jar.rotation.set(0, 0, 0); jar.updateMatrixWorld(true);
    for (const [s, sx] of [['l', 1], ['r', -1]]) { const side = F.root.localToWorld(V(sx, 0, 0)).sub(F.root.position).normalize();
      F.armIK(s, jar.position.clone().addScaledVector(side, 0.18), w(sx * 0.55, 0.9, -0.3), side.clone().negate()); }
    F.grip(0.55, 0.55);
    // the stream ends in the jar's mouth once the mouth is under it, otherwise in the jub
    const mouth = jar.localToWorld(V(0, 0.245, 0)), lip = U.spoutLip, catches = Math.hypot(mouth.x - lip.x, mouth.z - (lip.z + 0.04)) < 0.05 && mouth.y < lip.y - 0.05;
    U.streamTo(catches ? mouth.y - 0.02 : U.landY); U.splash.visible = !catches; U.jubWater.userData.uImp.value = catches ? 0 : 1;
    filled = catches ? clamp((t - T1) / 3.2) : 0; fillDisc.position.y = 0.04 + 0.12 * filled; fillDisc.visible = filled > 0.01; // stops below the neck (higher, it poked through the narrower neck)
    const look = catches ? mouth.clone() : V(lip.x, 0.4, lip.z).lerp(camPos, 0.15);
    F.headAt(look.clone().lerp(camPos, 0.2 * smooth(range(t, 4.2, 4.8))), 0.7); F.look(look);
    F.face({ smile: 0.25 + 0.35 * smooth(range(t, 2.2, 2.8)), blink: Math.max(0, 1 - Math.abs(t - 0.6 - 0.07) / 0.07, 1 - Math.abs(t - 3.9 - 0.07) / 0.07) });
  };
  return { W, act };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(44);
    return { scene: R.W.scene, camera: c, update(lt) {
      // crane down: from the windcatchers on the skyline to the worker at the spout
      const k = smooth(clamp(lt / 1.8)), p = camPath(k, [[3.8, 6.2, 1.3], [3.7, 3.4, 1.0], [3.5, 1.6, 0.7]]), hh = handheld(lt, 0.8, 6);
      const lk = V(-8, 7.5, -1.2).lerp(V(-0.4, 1.15, -1.0), k);
      const cp = V(p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]); R.act(lt, cp);
      place(c, cp.toArray(), lk.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, flare: 0.3, dof: { focus: cp.distanceTo(WPOS), aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.5, 13);
      // beside the jar, at the worker's right: the spout, the stream and the jar filling (behind him, his back blocked the view)
      const cp = V(1.3 - 0.12 * k + hh.p[0], 1.45 - 0.03 * k + hh.p[1], -1.6 + 0.05 * k + hh.p[2]); R.act(t, cp);
      const tg = V(0.0, 1.22, -1.4);
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, dof: { focus: cp.distanceTo(tg), aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
