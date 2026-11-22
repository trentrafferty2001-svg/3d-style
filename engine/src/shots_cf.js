// Cloth folds test scene (3d-style v1.14, not a video): a Roman street. Shot 1: a worker in a tunic walks along the
// pavement towards the camera (the skirt's folds swing, the legs push the cloth, the hem rises and falls with the folds),
// Shot 2: chest-up on a worker who raises his arm to point down the street (the
// shoulder rounds over, the sleeve stretches from the chest, creases in the linen, the belt sitting on the cloth). 5.5 s.
import * as THREE from 'three';
import { V, cam, place, smooth, handheld } from './anim.js';
import { romanSite } from './roman.js';
import { extra, walk, line } from './crowd.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 2.8;
const HERO = { seed: 4, path: line(V(-3.4, 0, -2.75), V(4, 0, -2.45)), speed: 1.0, d0: 0.2 };
const POINTER = { seed: 14, pos: V(0.3, 0, 3.0) };

function rig(makeStage, who) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [-0.65, 0.42, 0.62], fog: 0.011, shadowSize: 6, shadowAt: [0, 1, 3], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6); rim.position.set(2, 4, -6); scene.add(rim);
  const site = romanSite({ seed: 1 }); scene.add(site); const G = site.userData.groundAt;
  const people = who.map(o => ({ ...o, F: extra({ seed: o.seed }) })); people.forEach(o => scene.add(o.F.root));
  if (window.DBG) { window._FS = people.map(o => o.F); window._F = people[0].F; window._SITE = site; }
  return { scene, G, people };
}

// a worker standing on the pavement who raises his right arm to point down the street (to his right, our left), his
// head turning after it; feet planted, weight shifting onto the left leg
function pointAt(F, t, G) {
  const p = POINTER.pos, y = G(p.x, p.z);
  F.root.position.set(p.x, y, p.z); F.root.rotation.y = 0.35;
  const k = smooth(Math.min(1, Math.max(0, (t - 0.45) / 0.7))), sway = 0.012 * Math.sin(t * 1.3);
  F.pose({ hipsY: -0.015, hipsX: 0.015 * k + sway, hipRot: [0, -0.12 * k, -0.03 * k], spine: [0.0, -0.08 * k, 0.02 * k], chest: [-0.03 * k, -0.1 * k, 0] });
  const w = (x, z, yy) => F.root.localToWorld(V(x, yy, z));
  F.legIK('l', V(...w(0.11, 0.03, 0).toArray()).setY(y + 0.075), w(0.3, 1.4, 0.5)); F.legIK('r', V(...w(-0.1, -0.04, 0).toArray()).setY(y + 0.075), w(-0.3, 1.4, 0.5));
  const fwd = F.root.localToWorld(V(0, 0, 1)).sub(F.root.position).normalize();
  // right hand from beside the thigh up to a point out to the side and forward, at about eye height
  const rest = w(-0.27, 0.05, 0.88), up = w(-0.55, 0.38, 1.52), tgt = rest.clone().lerp(up, k);
  F.armIK('r', tgt, w(-0.75, -0.25, 1.05 + 0.2 * k), fwd.clone().lerp(V(0, 1, 0), k).normalize());
  F.armIK('l', w(0.27, 0.06, 0.88), w(0.45, -0.7, 0.95), fwd);
  F.grip(0.3, 0.55 - 0.3 * k); F.point('r', k); // the index finger out (an open or half-curled hand read as a thumb-up)
  const look = w(-2.6, 2.6, 1.6);
  F.headAt(look.clone().lerp(w(0, 3, 1.62), 1 - k), 0.55); F.look(look.clone().lerp(w(0, 3, 1.62), 1 - smooth(Math.min(1, Math.max(0, (t - 0.3) / 0.4)))));
  F.face({ smile: 0.25 + 0.2 * k, brow: 0.2 * k, blink: t > 1.9 && t < 2.02 ? 1 : 0 });
  F.kilt(0.02 * Math.sin(t * 2.1), 0.03 * k);
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage, [HERO, POINTER]), c = cam(38);
    return { scene: R.scene, camera: c, update(lt) {
      if (window.DBG) window._FS = R.people.map(o => o.F); // probes see the people of the shot on screen
      walk(R.people[0].F, lt, { path: HERO.path, speed: HERO.speed, d0: HERO.d0, groundAt: R.G }); pointAt(R.people[1].F, lt - CUT, R.G); // the pointer waits behind the camera
      const hp = HERO.path(HERO.d0 + HERO.speed * lt).pos, hh = handheld(lt, 0.5, 3);
      // low, from the road: the walker comes along the far pavement towards us, full figure, the portico behind him
      const cp = V(3.4 + hh.p[0], 1.0 + hh.p[1], 0.3 + hh.p[2]);
      place(c, cp.toArray(), [hp.x, 0.95, hp.z], hh.roll);
      return { bloom: 0.3, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(hp), aperture: 0.0016, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage, [HERO, POINTER]), c = cam(34);
    return { scene: R.scene, camera: c, update(lt) {
      if (window.DBG) window._FS = R.people.map(o => o.F);
      const F = R.people[1].F; pointAt(F, lt, R.G); walk(R.people[0].F, lt + CUT, { path: HERO.path, speed: HERO.speed, d0: HERO.d0, groundAt: R.G }); // the walker passes behind
      const hh = handheld(lt, 0.4, 9), k = smooth(lt / (DURATION - CUT));
      const cp = V(0.45 - 0.1 * k + hh.p[0], 1.55 + hh.p[1], 5.45 - 0.15 * k + hh.p[2]);
      place(c, cp.toArray(), [0.08, 1.4, 3.1], hh.roll);
      return { bloom: 0.3, warm: 1.12, sat: 1.1, dof: { focus: cp.distanceTo(V(0.3, 1.4, 3.0)), aperture: 0.002, maxblur: 0.005 } };
    } };
  } },
];
