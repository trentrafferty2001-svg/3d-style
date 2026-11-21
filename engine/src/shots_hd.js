// Hands test scene (3d-style v1.8, not a video): an Egyptian mason dresses a limestone block, his left hand holding a
// copper chisel upright on the stone, his right swinging a wooden club mallet onto its head. Both hands are placed with
// F.hold(): the hand turns to lie across the tool and every finger closes until it touches it (F.grasp). 5.3 s.
import * as THREE from 'three';
import { V, cam, place, clamp, smooth, range, noise1, handheld } from './anim.js';
import { egyptSite, egyptHeightAt, egyptWorker, egyptMats } from './egypt.js';
import { block } from './roman.js';

export const DURATION = 5.3; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 2.55;                                        // on the third blow: the knock covers the cut
export const STRIKES = [0.95, 1.75, 2.55, 3.55, 4.35];   // mallet on chisel (the sound's hits)
const G0 = egyptHeightAt(0, 0.4);
const TOP = G0 + 0.8;                                     // the block's top
const TIP = V(-0.06, TOP, 0.2), CDIR = V(0, 1, 0.22).normalize(), CLEN = 0.22, CR = 0.0095;   // chisel: tip on the stone, leaning back
const CTOP = TIP.clone().addScaledVector(CDIR, CLEN);
const MR = 0.016, HEADR = 0.052, HEADC = 0.24;            // mallet: handle radius, head radius, head centre from the grip end
const FPOS = V(0.08, 0, 0.6);                             // the mason, facing -z across the block

function world(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [0.5, 0.6, 0.6], fog: 0.0045, shadowSize: 5, shadowAt: [0, 1, 0.3], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.012;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(-3, 2, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.5); rim.position.set(-2, 5, -5); scene.add(rim);
  const site = egyptSite({ seed: 4 }); scene.add(site);
  return { scene, site };
}

// mallet swing: raise after each strike, fall faster and faster onto the next one, a small bounce off the chisel
function swingAt(t) {
  const UP = 0.7;
  if (t < STRIKES[0]) return UP * (1 - smooth(clamp((t - (STRIKES[0] - 0.42)) / 0.42)) ** 1.6);
  for (let i = 0; i < STRIKES.length; i++) {
    const a = STRIKES[i], b = STRIKES[i + 1] ?? DURATION + 1, d = t - a;
    if (t >= a && t < b) {
      if (d < 0.1) return 0.1 * Math.sin(Math.PI * d / 0.1);                       // bounce
      const span = b - a - 0.1, u = (d - 0.1) / span;
      if (u < 0.55) return UP * smooth(u / 0.55);                                    // lift
      return UP * (1 - ((u - 0.55) / 0.45) ** 2);                                    // fall, accelerating
    }
  }
  return 0;
}

function rig(makeStage) {
  const W = world(makeStage), S = W.site, M = egyptMats();
  // the block being dressed
  const st = block(1.0, 0.8, 0.7, M.casing, { r: 0.02, tile: 2.4, at: [0, G0 + 0.4, -0.12] }); W.scene.add(st); S.userData.props.push(st);
  // copper chisel (origin at the tip, along +y), a little flared at the head
  const copper = new THREE.MeshStandardMaterial({ color: 0xb06a3c, metalness: 0.75, roughness: 0.38 });
  const ch = new THREE.Group(); W.scene.add(ch);
  { const pts = [[0, 0], [0.004, 0.006], [CR * 0.9, 0.03], [CR, 0.05], [CR, CLEN - 0.012], [CR * 1.15, CLEN - 0.004], [CR * 1.05, CLEN], [0, CLEN]].map(([r, y]) => new THREE.Vector2(r, y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), copper); m.castShadow = true; ch.add(m); }
  ch.position.copy(TIP); ch.quaternion.setFromUnitVectors(V(0, 1, 0), CDIR);
  // club mallet: handle along +y from the grip end, a bulbous head beyond it
  const ml = new THREE.Group(); W.scene.add(ml);
  { const pts = [[0, 0], [MR * 1.15, 0.004], [MR, 0.02], [MR, 0.15], [0.03, 0.175], [HEADR * 0.95, 0.2], [HEADR, HEADC], [HEADR * 0.92, 0.29], [0.035, 0.315], [0, 0.32]].map(([r, y]) => new THREE.Vector2(r, y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), M.woodV || M.wood); m.castShadow = true; ml.add(m); }
  const F = egyptWorker(1); F.root.position.set(FPOS.x, egyptHeightAt(FPOS.x, FPOS.z), FPOS.z); F.root.rotation.y = Math.PI; W.scene.add(F.root);
  const w = (x, y, z) => F.root.localToWorld(V(x, y, z));
  // the mallet at the strike: horizontal, across the body from the right hand to the chisel (across the fist, at about
  // a right angle to the forearm: lined up with the forearm, the wrist had to bend 170 degrees); the head's underside on
  // the chisel's head. The swing turns forearm and mallet together about the elbow (found by posing the strike once),
  // so the wrist stays nearly straight; the elbow lifts a little as the mallet rises.
  const MDIR = V(-1, -0.06, -0.1).normalize(),  DOWN = V(0, 1, 0).addScaledVector(MDIR, -MDIR.y).normalize();
  const HEAD0 = CTOP.clone().addScaledVector(DOWN, HEADR * 0.98), BASE0 = HEAD0.clone().addScaledVector(MDIR, -HEADC);
  const AXIS = MDIR.clone().cross(DOWN).normalize();
  const malletCyl = (base, dir) => ({ a: base.clone().addScaledVector(dir, 0.02), b: base.clone().addScaledVector(dir, 0.15), r: MR });
  const bodyPose = (t, th) => { const breathe = Math.sin(t * 2.1) * 0.008, effort = smooth(clamp(1 - th / 0.7));
    F.pose({ hipsY: -0.04 + breathe * 0.3, spine: [0.14 + 0.03 * effort, -0.06, 0], chest: [0.06 + breathe, -0.08, 0] }); return effort; }; // bent over the work, the head clear of the swing
  const RPOLE = () => w(-0.4, 0.75, -0.45);                    // the right elbow back, out and down
  bodyPose(STRIKES[0], 0); F.hold('r', malletCyl(BASE0, MDIR), { u: 0.3, thumbTo: MDIR, pole: RPOLE() });
  const PIV0 = F.bones.rEl.getWorldPosition(V(0, 0, 0));
  const mallet = (t) => { const th = swingAt(t), q = new THREE.Quaternion().setFromAxisAngle(AXIS, th);
    const piv = PIV0.clone().add(V(0, 0.06, 0).multiplyScalar(th));
    const base = BASE0.clone().sub(PIV0).applyQuaternion(q).add(piv), dir = MDIR.clone().applyQuaternion(q);
    return { base, dir, th }; };
  if (window.DBG) { window._F = F; window._FS = [F]; window._SITE = S; window._W = W; }
  const holds = [];
  const act = (t, camPos) => {
    const m = mallet(t); ml.position.copy(m.base); ml.quaternion.setFromUnitVectors(V(0, 1, 0), m.dir); ml.updateMatrixWorld(true);
    const effort = bodyPose(t, m.th);
    F.kilt(noise1(t * 0.8, 3) * 0.03, noise1(t * 1.2, 4) * 0.03);
    for (const [s, sx, zz] of [['l', 1, 0.1], ['r', -1, -0.08]]) { const fp = w(sx * 0.13, 0, zz); fp.y = egyptHeightAt(fp.x, fp.z) + 0.075; F.legIK(s, fp, w(sx * 0.3, 0.5, 1.2)); }
    // hands on the tools: the chisel in the left fist, thumb up; the mallet's handle in the right, near its end
    const chis = { a: TIP.clone().addScaledVector(CDIR, 0.06), b: CTOP.clone(), r: CR };
    const mal = malletCyl(m.base, m.dir);
    holds.length = 0;
    holds.push({ s: 'l', cyl: chis, n: F.hold('l', chis, { u: 0.55, up: w(0.25, -0.1, -0.05).sub(chis.a.clone().lerp(chis.b, 0.55)), thumbTo: V(0, 1, 0) }) });
    holds.push({ s: 'r', cyl: mal, n: F.hold('r', mal, { u: 0.3, thumbTo: m.dir, pole: RPOLE() }) });
    if (window.DBG) window._HOLDS = holds.map(h => ({ F, s: h.s, cyl: h.cyl, n: h.n }));
    // eyes on the chisel's edge; a squint of concentration, a blink between blows
    const look = TIP.clone().lerp(CTOP, 0.3);
    F.headAt(look.clone().add(V(0, 0.25, 0)), 0.6); F.look(look);
    F.face({ brow: -0.15, squint: 0.25 + 0.2 * effort, smile: 0.05, blink: Math.max(0, 1 - Math.abs(t - 1.3 - 0.07) / 0.07, 1 - Math.abs(t - 3.1 - 0.07) / 0.07) });
  };
  return { W, F, act };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.W.scene, camera: c, update(lt) {
      // across the block, facing the mason: the stone in the foreground, the mallet seen side-on
      const k = smooth(lt / CUT), hh = handheld(lt, 0.6, 4);
      const cp = V(-0.55 + 0.12 * k + hh.p[0], G0 + 1.62 - 0.05 * k + hh.p[1], -1.75 + 0.2 * k + hh.p[2]); R.act(lt, cp);
      const tg = V(0.02, G0 + 1.08, 0.35);
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.1, sat: 1.1, flare: 0.25, dof: { focus: cp.distanceTo(CTOP), aperture: 0.002, maxblur: 0.005 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(32);
    return { scene: R.W.scene, camera: c, update(lt, t) {
      // close on the hands from across the block, a little to the left: the chisel fist, the mallet coming down on it
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.4, 13);
      const cp = V(-0.45 + 0.04 * k + hh.p[0], TOP + 0.5 + hh.p[1], -0.85 + 0.05 * k + hh.p[2]); R.act(t, cp);
      const tg = CTOP.clone().add(V(0.1, 0.07, 0.0)); // room above the chisel for the mallet's lift
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.3, warm: 1.1, sat: 1.1, dof: { focus: cp.distanceTo(tg), aperture: 0.004, maxblur: 0.008 } };
    } };
  } },
];
