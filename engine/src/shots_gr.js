// God-ray test scene (3d-style v1.12, not a video): from inside the Roman portico, looking out between the columns into
// a low sun; shafts of light fall between the columns as a man walks down the portico through them. One shot, 4.5 s.
import * as THREE from 'three';
import { V, cam, place, smooth, handheld } from './anim.js';
import { romanSite, RS } from './roman.js';
import { extra, walk, line } from './crowd.js';

export const DURATION = 4.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const SUN = [-0.9, 0.2, 0.32];                           // low, down the street (-x), so the columns stand in front of it

export const SHOTS = [
  { start: 0, end: DURATION, build: ({ makeStage }) => {
    const scene = makeStage({ outdoor: 'golden', sunDir: SUN, fog: 0.014, shadowSize: 12, shadowAt: [0, 1, -3], envI: 0.8, hemi: 0.28 });
    const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
    const site = romanSite({ seed: 1 }); scene.add(site); const G = site.userData.groundAt;
    const F = extra({ seed: 3 }); scene.add(F.root); const path = line(V(-9, 0, -4.75), V(9, 0, -4.75)); // inside the portico, walking through the shafts towards the camera
    if (window.DBG) { window._FS = [F]; window._F = F; window._SITE = site; }
    const c = cam(42);
    return { scene, camera: c, update(lt) {
      walk(F, lt, { path, speed: 0.8, d0: 5.4, groundAt: G });
      // inside the portico, looking down the colonnade into the sun
      const k = smooth(lt / DURATION), hh = handheld(lt, 0.4, 5);
      const cp = V(4.2 - 0.8 * k + hh.p[0], 1.35 + hh.p[1], -5.3 + hh.p[2]);
      place(c, cp.toArray(), [-6, 1.9, -3.4], hh.roll);
      return { bloom: 0.4, warm: 1.12, sat: 1.1, flare: 0.25, rays: 0.8, dof: { focus: 3.2, aperture: 0.0015, maxblur: 0.004 } };
    } };
  } },
];
