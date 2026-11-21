// Rope and cloth test scene (3d-style v1.9, not a video): a hauler leans back on a rope tied to a loaded sledge, heaves
// twice, then lets go: the rope drops slack onto the sand and he stumbles back a step, his kilt swinging. The rope is a
// verlet chain and the kilt's hem a pendulum driven by his hips, both simulated once when the shot is built
// (sim.js), so every frame stays a pure function of time. 5.5 s.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, noise1, handheld } from './anim.js';
import { egyptSite, egyptHeightAt, egyptWorker, sledge, egyptMats } from './egypt.js';
import { liveStream } from './water.js';
import { bakeRope, bakeHem } from './sim.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
export const T_LET = 73 / 30;                             // he lets go (front hand; the rear hand a frame later)
const CUT = T_LET;                                         // cut on the release (a creak and a thump cover it)
const G = (x, z) => egyptHeightAt(x, z);
const SL = V(0, G(0, 0), 0);                                // sledge, its front towards -z
const ANCHOR = V(0, SL.y + 0.32, -1.42);                    // the rope's knot on the sledge's front bar
const FZ = -4.05;                                           // the hauler's feet (z), facing the sledge (+z)
const ROPE_LEN = 3.8, N = 39, SEG = ROPE_LEN / (N - 1);

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [0.55, 0.55, 0.62], fog: 0.0045, shadowSize: 7, shadowAt: [0, 0.6, -2.6], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.012;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.4); fill.position.set(-3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(-2, 6, -6); scene.add(rim);
  const site = egyptSite({ seed: 4 }); scene.add(site);
  return { scene, site };
}

// the hauler's motion, as pure functions of time
const heave = (t) => t >= T_LET ? 0 : 0.5 - 0.5 * Math.cos(Math.min(t, T_LET) * 2 * Math.PI / 1.2);   // two heaves
const step = (t) => smooth(range(t, T_LET + 0.05, T_LET + 0.45));                                     // the stumble back
const settle = (t) => smooth(range(t, T_LET + 0.3, T_LET + 1.3));
function poseHauler(F, t) {
  const h = heave(t), st = step(t), se = settle(t), let_ = smooth(range(t, T_LET, T_LET + 0.25));
  F.root.position.set(0.05, G(0.05, FZ), FZ - 0.16 * st);
  F.root.rotation.y = 0;                                    // facing the sledge
  const lean = (1 - let_) * (-0.25 - 0.08 * h) + let_ * (-0.12 * (1 - se) + 0.04 * se);   // leaning back on the rope, then upright
  F.pose({ hipsY: -0.09 - 0.03 * h + 0.06 * let_, hipsZ: -0.06 * (1 - let_), spine: [lean, 0, 0], chest: [lean * 0.35, 0, 0] });
  const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
  // feet, planted on the sand (world positions, so they never slide): the left forward, the right braced behind. On the
  // stumble the right steps back, then the left follows; each foot lifts while it moves and is still otherwise
  const sR = smooth(range(t, T_LET + 0.05, T_LET + 0.4)), sL = smooth(range(t, T_LET + 0.45, T_LET + 0.85));
  const liftR = 0.07 * Math.sin(Math.PI * clamp((t - T_LET - 0.05) / 0.35)), liftL = 0.06 * Math.sin(Math.PI * clamp((t - T_LET - 0.45) / 0.4));
  const feet = [['l', V(0.17, 0, FZ + 0.3 - 0.3 * sL), liftL, 1], ['r', V(-0.08, 0, FZ - 0.32 - 0.14 * sR), liftR, -1]];
  for (const [s, p, up, sx] of feet) { p.y = G(p.x, p.z) + 0.075 + up; F.legIK(s, p, w(sx * 0.3, 0.5, 1.4)); }
  return { h, let_ };
}
// grip points on the rope while he holds it: both hands in front at belly height, rope running towards the sledge
const grips = (F, t) => { const h = heave(t), w = (x, y, z) => F.root.localToWorld(V(x, y, z));
  return [w(0.03, 1.09 - 0.02 * h, 0.29 - 0.02 * h), w(-0.02, 1.07 - 0.02 * h, 0.13 - 0.01 * h)]; }; // within reach while leaning back, clear of the kilt

function rig(makeStage) {
  const W = world(makeStage), S = W.site;
  const sl = sledge(); sl.rotation.y = Math.PI / 2; sl.position.copy(SL); W.scene.add(sl); S.userData.props.push(sl);
  const F = egyptWorker(2); W.scene.add(F.root);
  // ---- bake: pose the hauler on a fine clock once, record what the simulations need ----
  const T0 = -1.2, HZ = 240, rec = [];
  for (let k = 0; ; k++) { const t = T0 + k / HZ; if (t > DURATION + 0.05) break; const tt = Math.max(0, t);
    poseHauler(F, tt); F.root.updateMatrixWorld(true);
    const bp = (n) => F.bones[n].getWorldPosition(V(0, 0, 0));
    const body = [{ a: bp('hips'), b: bp('neck'), r: 0.15 }, { a: bp('lHip'), b: bp('lKn'), r: 0.075 }, { a: bp('lKn'), b: bp('lAn'), r: 0.06 },
      { a: bp('rHip'), b: bp('rKn'), r: 0.075 }, { a: bp('rKn'), b: bp('rAn'), r: 0.06 },
      ...['l', 'r'].map(s => { const an = bp(s + 'An'), toe = F.bones[s + 'An'].localToWorld(V(0, -0.05, 0.16)); return { a: an.clone().add(V(0, -0.04, 0)), b: toe, r: 0.045, up: true }; })]; // feet: the rope lies over the sandals, not under or round them
    const hq = F.bones.hips.getWorldQuaternion(new THREE.Quaternion());
    rec.push({ t, grips: grips(F, tt), body, hips: { pos: bp('hips'), quat: hq } }); }
  const at = (t) => rec[Math.max(0, Math.min(rec.length - 1, Math.round((t - T0) * HZ)))];
  // rope indices held: the front hand where the rope reaches it from the knot (1% slack at the hardest heave, or the
  // rope would have to stretch), the rear hand further on
  const g0 = at(0).grips, I1 = Math.ceil(Math.max(...[0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4].map(t => ANCHOR.distanceTo(at(t).grips[0]))) * 1.01 / SEG), I2 = I1 + Math.ceil(Math.max(...[0, 0.6, 1.2, 1.8, 2.4].map(t => at(t).grips[0].distanceTo(at(t).grips[1]))) * 1.03 / SEG); // rounded up: rounded down, the rope between the fists stretched 47%
  // start: knot -> front hand -> rear hand straight, then the tail hanging down behind him (it settles during the pre-roll)
  const init = []; for (let i = 0; i < N; i++) { if (i <= I1) init.push(ANCHOR.clone().lerp(g0[0], i / I1)); else if (i <= I2) init.push(g0[0].clone().lerp(g0[1], (i - I1) / (I2 - I1)));
    else { // the tail: straight down from the rear hand to the sand, then lying out behind him
      const d = (i - I2) * SEG, drop = g0[1].y - G(g0[1].x, g0[1].z) - 0.02;
      init.push(d <= drop ? g0[1].clone().add(V(0.08, -d, -0.05)) : V(g0[1].x + 0.08, 0, g0[1].z - 0.05 - (d - drop)).setY(G(g0[1].x, g0[1].z - (d - drop)) + 0.02)); } }
  const rope = bakeRope({ length: ROPE_LEN, n: N, radius: 0.017, init, t0: T0, t1: DURATION + 0.05, hz: 480, iters: 30,
    pins: (t) => { const r = at(t), p = [[0, ANCHOR]]; if (t < T_LET) p.push([I1, r.grips[0]]); if (t < T_LET + 1 / 30) p.push([I2, r.grips[1]]); return p; },
    bodies: (t) => at(t).body, groundAt: G, friction: 0.5, damping: 0.9992 }); // light air drag: at 0.993 a step (480 Hz) the rope fell like a feather
  const hem = bakeHem({ hipsAt: (t) => at(t).hips, t0: T0, t1: DURATION + 0.05, len: 0.42, stiff: 26, damping: 3.0 });
  const line = liveStream(egyptMats().rope, { radius: 0.017, segments: 96 }); line.castShadow = true; W.scene.add(line);
  if (window.DBG) { window._F = F; window._FS = [F]; window._SITE = S; window._W = W; window._ROPE = { rope, I1, I2, T_LET, radius: 0.017, bodies: (t) => at(t).body, groundAt: G, held: (t) => [[I1, t < T_LET], [I2, t < T_LET + 1 / 30]] }; }
  const act = (t, camPos) => {
    const r = poseHauler(F, t), pts = rope.at(t);
    const [hx, hz] = hem(t); F.kilt(hx + noise1(t * 0.8, 3) * 0.02, hz + noise1(t * 1.2, 4) * 0.03); // simulated swing plus a breath of wind
    line.set(pts);
    // hands: on the rope (wrapped round it) while holding, then opening and falling to his sides
    const side = (sx) => F.root.localToWorld(V(sx, 0, 0)).sub(F.root.position).normalize(), fwd = F.root.localToWorld(V(0, 0, 1)).sub(F.root.position).normalize();
    const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
    const segAt = (i) => ({ a: pts[Math.max(0, i - 1)], b: pts[Math.min(N - 1, i + 1)], r: 0.017 });
    const fall = smooth(range(t, T_LET, T_LET + 0.5)), shake = Math.sin(t * 9) * 0.02 * smooth(range(t, T_LET + 0.9, T_LET + 1.3)) * (1 - smooth(range(t, T_LET + 2.0, T_LET + 2.4)));
    const holds = [], curl = { l: 0.5, r: 0.5 };
    for (const [s, sx, i, tl] of [['l', 1, I1, T_LET], ['r', -1, I2, T_LET + 1 / 30]]) {
      if (t < tl) { holds.push({ F, s, cyl: segAt(i), opts: { u: 0.5, thumbTo: pts[0].clone().sub(pts[N - 1]), pole: w(sx * 0.75, 0.75, 0.05) } }); continue; } // elbows out to the sides (a tug-of-war grip): the rope crosses the fists instead of running along the forearms
      const k = smooth(range(t, tl, tl + 0.5)), from = grips(F, tl)[s === 'l' ? 0 : 1], rest = w(sx * 0.29, 0.86 + shake, 0.06);
      F.armIK(s, from.lerp(rest, k), w(sx * 0.45, 0.95, -0.7), side(sx).lerp(fwd, k).normalize()); curl[s] = 0.6 * (1 - k) + 0.12;   // the fist opens as the arm drops
    }
    F.grip(curl.l, curl.r); for (const h of holds) F.hold(h.s, h.cyl, h.opts);   // grip() sets both hands: wrap the held ones after it
    if (window.DBG) window._HOLDS = holds;
    // face: strain while pulling, a startled widening when the rope gives, then a breath out
    const strain = (1 - r.let_) * (0.5 + 0.5 * r.h), oops = smooth(range(t, T_LET, T_LET + 0.15)) * (1 - smooth(range(t, T_LET + 0.6, T_LET + 1.2)));
    F.headAt(t < T_LET ? ANCHOR.clone().add(V(0, 1.3, 0)) : w(0, 1.2, 0).add(V(0, 0, 0)).lerp(camPos, 0.5 * settle(t)), 0.6); F.look(t < T_LET ? ANCHOR.clone().add(V(0, 0.4, 0)) : camPos.clone().lerp(pts[Math.floor(N / 3)], 1 - settle(t)));
    F.face({ brow: -0.6 * strain + 0.6 * oops, smile: -0.3 * strain + 0.35 * settle(t), teeth: 0.7 * strain, squint: 0.4 * strain, flare: 0.5 * strain, wide: 0.8 * oops, oh: 0.5 * oops,
      blink: Math.max(0, 1 - Math.abs(t - 1.0 - 0.07) / 0.07, 1 - Math.abs(t - 4.6 - 0.07) / 0.07) });
  };
  return { W, F, act, rope };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.W.scene, camera: c, update(lt) {
      // behind him and to his right, down the rope: the hauler leaning back in front, the taut rope leading to the sledge
      const k = smooth(lt / CUT), hh = handheld(lt, 0.6, 3);
      const cp = V(1.6 - 0.1 * k + hh.p[0], 1.75 + hh.p[1], -7.4 + 0.25 * k + hh.p[2]); R.act(lt, cp);
      place(c, cp.toArray(), [-0.1, 0.7, -2.7], hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, flare: 0.25, dof: { focus: cp.distanceTo(V(0, 0.9, -4.0)), aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      // closer, from the front-side: the rope dropping slack at his feet, his kilt swinging as he steps back
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.5, 9);
      const cp = V(1.75 - 0.1 * k + hh.p[0], 1.3 + hh.p[1], -0.55 - 0.1 * k + hh.p[2]); R.act(t, cp);
      const tg = V(0.12, 0.72, -3.75); // his whole figure and the slack rope on the sand in front of him
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, dof: { focus: cp.distanceTo(tg), aperture: 0.003, maxblur: 0.006 } };
    } };
  } },
];
