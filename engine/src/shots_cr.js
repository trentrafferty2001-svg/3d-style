// Crowd test scene (3d-style v1.11, not a video): a Roman street with five extras built by crowd.js, each a different
// height, build, skin tone and tunic. Three walk along the pavements (feet planted, arms swinging), two chat on the near
// pavement, taking turns to talk. Shot 1 wide down the street; shot 2 on the two talking, walkers passing. 6 s.
import * as THREE from 'three';
import { V, cam, place, smooth, handheld } from './anim.js';
import { romanSite, RS } from './roman.js';
import { extra, walk, chat, line } from './crowd.js';

export const DURATION = 6; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.0;
const WALKERS = [
  { seed: 3, path: line(V(-9, 0, -2.45), V(9, 0, -2.45)), speed: 1.1, d0: 3.2 },
  { seed: 8, path: line(V(9, 0, -3.1), V(-9, 0, -3.1)), speed: 0.95, d0: 6.0 },
  { seed: 5, path: line(V(-9, 0, 2.2), V(9, 0, 2.2)), speed: 1.2, d0: 2.0 },   // behind the two talking, from shot 2
];
const CHAT = [{ seed: 12, pos: V(-0.55, 0, 3.08), face: Math.PI / 2 - 0.35 }, { seed: 21, pos: V(0.2, 0, 3.15), face: -Math.PI / 2 + 0.3 }];
const talking = (i) => (t) => (Math.floor(t / 2) % 2) === i;    // they take turns every 2 s

function rig(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [-0.65, 0.42, 0.62], fog: 0.011, shadowSize: 12, shadowAt: [0, 1, 0], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.45); fill.position.set(3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6); rim.position.set(2, 4, -6); scene.add(rim);
  const site = romanSite({ seed: 1 }); scene.add(site); const G = site.userData.groundAt;
  const walkers = WALKERS.map(w => ({ ...w, F: extra({ seed: w.seed }) })), chatters = CHAT.map(c => ({ ...c, F: extra({ seed: c.seed }) }));
  [...walkers, ...chatters].forEach(o => scene.add(o.F.root));
  const FS = [...walkers, ...chatters].map(o => o.F);
  if (window.DBG) { window._FS = FS; window._F = FS[0]; window._SITE = site; }
  const act = (t) => {
    for (const w of walkers) walk(w.F, t, { path: w.path, speed: w.speed, d0: w.d0, groundAt: G });
    chatters.forEach((c, i) => { const other = chatters[1 - i].F.bones.head.getWorldPosition(V(0, 0, 0));
      chat(c.F, t, { pos: c.pos, face: c.face, partner: i === 0 ? CHAT[1].pos.clone().setY(G(CHAT[1].pos.x, CHAT[1].pos.z) + 1.55) : CHAT[0].pos.clone().setY(G(CHAT[0].pos.x, CHAT[0].pos.z) + 1.55), groundAt: G, talking: talking(i), seed: c.seed });
      void other; });
  };
  return { scene, act, chatters };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(50);
    return { scene: R.scene, camera: c, update(lt) {
      // down the street from above the road: walkers coming and going on both pavements, the portico on the left
      const k = smooth(lt / CUT), hh = handheld(lt, 0.6, 2);
      const cp = V(11.5 - 0.8 * k + hh.p[0], 2.7 - 0.2 * k + hh.p[1], 0.3 + hh.p[2]); R.act(lt);
      place(c, cp.toArray(), [-1.5, 0.95, 0.0], hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, flare: 0.3, dof: { focus: 7.5, aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(36);
    return { scene: R.scene, camera: c, update(lt, t) {
      // the two talking, from the near side: the road, the far pavement's walkers and the portico behind them
      const k = smooth(lt / (DURATION - CUT)), hh = handheld(t, 0.5, 7);
      const cp = V(-0.2 + 0.15 * k + hh.p[0], 1.7 + hh.p[1], 7.3 - 0.2 * k + hh.p[2]); R.act(t);
      place(c, cp.toArray(), [-0.15, 1.0, 2.9], hh.roll);
      return { bloom: 0.35, warm: 1.12, sat: 1.1, dof: { focus: 4.4, aperture: 0.0022, maxblur: 0.005 } };
    } };
  } },
];
