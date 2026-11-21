// Egypt test scene (3d-style v1.4, not a video): a limestone block on a sledge, two haulers leaning into the rope, and a
// worker pouring water from a jar onto the sand in front of the runners (wet sand halves the pull). The pyramid rises
// behind. Shot 1 wide, shot 2 close on the water hitting the sand. 5.5 s.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, springKeys, noise1, handheld, camPath } from './anim.js';
import { egyptSite, egyptHeightAt, egyptWorker, sledge, waterJar, egyptMats } from './egypt.js';
import { streamMaterial, liveStream, splash, wetPatch } from './water.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.0, T_TIP = 0.35;                       // the jar starts tipping at T_TIP
const SL = V(0, 0, 0), POUR = V(0.95, 0, -2.0);       // sledge (front towards -z), the pourer beside its front
const HAUL = [V(-0.3, 0, -5.0), V(0.32, 0, -6.6)];   // haulers ahead on the rope

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [0.55, 0.55, 0.62], fog: 0.0045, shadowSize: 9, shadowAt: [0.3, 1, -3], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.4); fill.position.set(-3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(-2, 4, -6); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xe0b070, 0.5); bounce.position.set(0.2, -1, 0.3); scene.add(bounce);
  const site = egyptSite({ seed: 4 }); scene.add(site);
  return { scene, site };
}

// the jar: held at chest height in front of the pourer, tipping towards -x (spring with a little overshoot)
const tipAt = (t) => springKeys(t, [[0, 0.25], [T_TIP, 1.95]], 1.3, 0.55);
function rig(makeStage) {
  const W = world(makeStage), S = W.site;
  const sl = sledge(); sl.rotation.y = Math.PI / 2; sl.position.copy(SL); W.scene.add(sl); S.userData.props.push(sl);
  const P = egyptWorker(0); P.root.position.copy(POUR); P.root.rotation.y = -Math.PI / 2; W.scene.add(P.root); // faces -x, towards the track
  const H = HAUL.map((p, i) => { const F = egyptWorker(i + 1); F.root.position.copy(p); F.root.rotation.y = Math.PI; W.scene.add(F.root); return F; });
  const jar = waterJar(); W.scene.add(jar);
  // water: a live stream from the jar's mouth, the wet patch and splash where it lands (found once from the steady pour)
  const stream = liveStream(streamMaterial({ speed: 10, breakup: 0.8, taper: 0.004 }), { radius: 0.014 }); W.scene.add(stream);
  const rope = liveStream(egyptMats().rope, { radius: 0.017, segments: 48 }); rope.castShadow = true; W.scene.add(rope);
  const mouthAt = (t) => { poseJar(t); return jar.localToWorld(V(0, 0.245, 0)); };
  const dirAt = (t) => { poseJar(t); return V(0, 1, 0).applyQuaternion(jar.quaternion); };
  function poseJar(t) { const breathe = Math.sin(t * 2.1) * 0.006; jar.position.copy(P.root.localToWorld(V(0.0, 1.13 + breathe, 0.33))); jar.rotation.set(0, 0, tipAt(t)); jar.updateMatrixWorld(true); }
  const V0 = 0.7, flow = (t) => clamp((tipAt(t) - 1.2) / 0.5);                         // water leaves once the jar is tipped far enough
  const T_FLOW = (() => { for (let t = 0; t < 2; t += 0.005) if (flow(t) > 0.02) return t; return 1; })();
  const fall = (m, d, a) => V(m.x + d.x * V0 * a, m.y + d.y * V0 * a - 4.9 * a * a, m.z + d.z * V0 * a);
  const landAt = (t) => { const m = mouthAt(t), d = dirAt(t); for (let a = 0; a < 1.5; a += 0.002) { const p = fall(m, d, a); if (p.y <= egyptHeightAt(p.x, p.z)) return [p, a]; } return [fall(m, d, 1.5), 1.5]; };
  const [LAND, T_FALL] = landAt(2.5); const T_LAND = T_FLOW + T_FALL;
  const wet = wetPatch(V(LAND.x, egyptHeightAt(LAND.x, LAND.z) + 0.003, LAND.z), (t) => t < T_LAND ? 0 : 0.06 + 0.3 * smooth(clamp((t - T_LAND) / 4.5)), { color: 0x94765a, seed: 2 }); W.scene.add(wet); // the patch soaks in slowly
  const sp = splash(V(LAND.x, egyptHeightAt(LAND.x, LAND.z) + 0.004, LAND.z), { surfaceY: 0, n: 16, size: 0.0028, spread: 0.4, up: 0.55, color: 0xeef2ee }); W.scene.add(sp);
  if (window.DBG) { window._F = P; window._FS = [P, ...H]; window._SITE = S; window._W = W; window._JAR = jar; }
  const act = (t, camPos) => {
    // --- pourer ---
    const breathe = Math.sin(t * 2.1) * 0.01, lean = 0.1 * smooth(clamp((t - T_TIP) / 0.5));
    P.pose({ hipsY: -0.03 + breathe * 0.3, spine: [0.05 + lean, 0, 0], chest: [0.02 + breathe, 0, 0] });
    P.kilt(noise1(t * 0.8, 3) * 0.03, noise1(t * 1.2, 4) * 0.04);
    const w = (F, x, y, z) => F.root.localToWorld(V(x, y, z));
    for (const [s, sx, zz] of [['l', 1, 0.05], ['r', -1, -0.06]]) { const fp = w(P, sx * 0.12, 0, zz); fp.y = egyptHeightAt(fp.x, fp.z) + 0.075; P.legIK(s, fp, w(P, sx * 0.3, 0.5, 1.2)); }
    poseJar(t);
    for (const [s, sz] of [['l', 1], ['r', -1]]) { // palms on the jar's sides (it tips about the axis between them)
      const side = V(0, 0, 0).sub(P.root.localToWorld(V(sz, 0, 0)).sub(P.root.position)).normalize();
      const hand = jar.position.clone().addScaledVector(side, -0.18);
      P.armIK(s, hand, w(P, sz * 0.55, 0.9, -0.3), side.clone().negate());
    }
    P.grip(0.55, 0.55);
    const look = V(LAND.x, 0.1, LAND.z).lerp(camPos, 0.25 * smooth(range(t, 3.9, 4.6)));
    P.headAt(look, 0.75); P.look(look); P.face({ smile: 0.2 + 0.4 * smooth(range(t, 2.4, 3.0)), brow: 0.15, blink: Math.max(0, 1 - Math.abs(t - 1.7 - 0.07) / 0.07, 1 - Math.abs(t - 4.3 - 0.07) / 0.07) });
    // --- haulers: leaning into the rope, one foot forward, gripping at chest height; a slow heave ---
    const ropePts = [SL.clone().add(V(0, 0.32, -1.42))];
    H.forEach((F, i) => {
      const heave = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.7), b = Math.sin(t * 2.6 + i * 1.7) * 0.01;
      F.pose({ hipsY: -0.07 - 0.03 * heave, hipsZ: 0.02, spine: [0.3 + 0.06 * heave, 0, 0], chest: [0.12 + b, 0, 0] });
      F.kilt(-0.08 - 0.04 * heave, noise1(t, 7 + i) * 0.03);
      F.legIK('l', w(F, 0.12, 0.075, 0.34), w(F, 0.3, 0.5, 1.4)); F.legIK('r', w(F, -0.12, 0.075, -0.36), w(F, -0.3, 0.5, 1.4));
      const grip = w(F, 0.0, 1.06 - 0.03 * heave, 0.36);
      for (const [s, sx] of [['l', 1], ['r', -1]]) F.armIK(s, grip.clone().add(F.root.localToWorld(V(sx * 0.07, 0, 0)).sub(F.root.position)), w(F, sx * 0.6, 0.7, -0.3), V(0, 1, 0));
      F.grip(1, 1); F.headAt(w(F, 0, 1.5, 4), 0.6); F.look(w(F, 0, 1.4, 6));
      F.face({ brow: -0.6, smile: -0.25, teeth: 0.6, squint: 0.4, flare: 0.5, blink: Math.max(0, 1 - Math.abs(t - 1.1 - i * 1.3 - 0.07) / 0.07) });
      ropePts.push(grip.clone().add(V(0, 0.018, 0)));
    });
    ropePts.push(V(0.1, 0.95, -12));
    rope.set(ropePts.map((p, k) => k === 0 || k === ropePts.length - 1 ? p : p).flatMap((p, k, arr) => k === 0 ? [p] : [p.clone().lerp(arr[k - 1], 0.5).add(V(0, -0.02, 0)), p]));
    // --- water ---
    const s = t - T_FLOW;
    if (s <= 0) stream.set([]); else {
      const m = mouthAt(t), d = dirAt(t), front = Math.min(s, T_FALL), pts = [];
      for (let k = 0; k <= 18; k++) { const a = front * k / 18; pts.push(fall(m, d, a)); }
      stream.set(pts);
    }
    wet.update(t); sp.update(t); sp.visible = t > T_LAND;
  };
  return { W, act, LAND };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(40);
    return { scene: R.W.scene, camera: c, update(lt) {
      // high and behind the sledge, looking down the track: sledge, pourer, haulers and the pyramid stack up the frame
      const k = smooth(lt / CUT), p = camPath(k, [[1.9, 3.1, 5.2], [1.75, 2.95, 4.8], [1.6, 2.8, 4.4]]), hh = handheld(lt, 0.8, 5);
      const cp = V(p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]); R.act(lt, cp);
      place(c, cp.toArray(), [-0.2, 0.9, -4.5], hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, flare: 0.3, dof: { focus: cp.distanceTo(POUR), aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(34);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.5, 11), L = R.LAND;
      // ahead of the landing point, looking back: the water hits the sand right in front of the sledge's runners
      const cp = V(L.x + 0.6 - 0.08 * k + hh.p[0], 0.62 - 0.05 * k + hh.p[1], L.z - 1.0 + 0.08 * k + hh.p[2]); R.act(t, cp);
      const tg = V(L.x, 0.12, L.z + 0.2); // the landing point in the middle of the frame, the runners' tips behind it
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, dof: { focus: cp.distanceTo(tg), aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
