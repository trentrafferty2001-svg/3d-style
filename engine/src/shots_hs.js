// Hair and beards test scene (3d-style v1.15, not a video): a group of Roman townspeople talking under the portico, each
// an extra with a seeded look (curls, a headcloth, braids, a shaved head with a fringe, short hair; beards from stubble
// to full), taking turns to talk (their mouths move inside the beards). The camera looks along the group from one end,
// then the backs of their heads from behind the other end. 5.5 s.
import * as THREE from 'three';
import { V, cam, place, smooth, handheld } from './anim.js';
import { romanSite } from './roman.js';
import { extra, chat } from './crowd.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const CUT = 3.2;
// [seed, x, z, facing]; on the far pavement, in a loose arc facing the street
const PEOPLE = [[1, -1.3, -2.55, 0.35], [3, -0.6, -2.85, 0.15], [6, 0.1, -2.7, -0.1], [4, 0.85, -2.85, -0.3], [8, 1.5, -2.55, -0.55]];
const talking = (i) => (t) => (Math.floor(t / 1.4 + i * 0.5) % 3) === i % 3;   // two or so talk at a time, in turns

function rig(makeStage) {
  const scene = makeStage({ outdoor: 'golden', sunDir: [-0.65, 0.42, 0.62], fog: 0.011, shadowSize: 5, shadowAt: [0, 1, -2.6], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.5); fill.position.set(3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6); rim.position.set(2, 4, -6); scene.add(rim);
  const site = romanSite({ seed: 1 }); scene.add(site); const G = site.userData.groundAt;
  const people = PEOPLE.map(([seed, x, z, face]) => ({ seed, pos: V(x, 0, z), face, F: extra({ seed }) })); people.forEach(p => scene.add(p.F.root));
  const act = (t) => { if (window.DBG) { window._FS = people.map(p => p.F); window._SITE = site; window._F = people[0].F; }
    people.forEach((p, i) => { const o = people[i % 2 ? i - 1 : (i + 1 < people.length ? i + 1 : i - 1)];
      chat(p.F, t, { pos: p.pos, face: p.face, partner: o.pos.clone().setY(G(o.pos.x, o.pos.z) + 1.55), groundAt: G, talking: talking(i), seed: p.seed }); }); };
  return { scene, act };
}

export const SHOTS = [
  { start: 0, end: CUT, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(32);
    return { scene: R.scene, camera: c, update(lt) {
      R.act(lt); const k = smooth(lt / CUT), hh = handheld(lt, 0.35, 4);
      // from the east end of the group, looking along it: five heads in a row receding (a 9:16 frame is narrow, so a track
      // across them mostly showed the gaps); angles checked against the measured head positions, all within 6 degrees
      const cp = V(3.6 - 0.3 * k + hh.p[0], 1.9 + hh.p[1], -2.0 + hh.p[2]);
      place(c, cp.toArray(), [0.1, 1.8, -2.66], hh.roll);
      return { bloom: 0.3, warm: 1.1, sat: 1.08, dof: { focus: 3.3, aperture: 0.0012, maxblur: 0.003 } };
    } };
  } },
  { start: CUT, end: DURATION, build: ({ makeStage }) => {
    const R = rig(makeStage), c = cam(30);
    return { scene: R.scene, camera: c, update(lt, t) {
      R.act(t); const hh = handheld(t, 0.3, 8), k = smooth(lt / (DURATION - CUT));
      // from behind the west end, a little above: the backs and sides of their heads (braids, the kerchief's knot, curls)
      const cp = V(-3.9 + 0.25 * k + hh.p[0], 2.05 + hh.p[1], -3.2 + hh.p[2]);
      place(c, cp.toArray(), [-0.2, 1.8, -2.6], hh.roll);
      return { bloom: 0.3, warm: 1.1, sat: 1.08, dof: { focus: 3.0, aperture: 0.0012, maxblur: 0.003 } };
    } };
  } },
];
