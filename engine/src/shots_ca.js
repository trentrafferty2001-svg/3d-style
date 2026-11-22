// Caustics test scene (3d-style v1.10, not a video): the Yazd lane's jub at midday. Clear qanat water runs over the
// stone floor and the sun draws a wavering web of caustics on it (water.js causticsMaterial); the spout's stream lands
// in the channel with rings, foam and a splash. One slow shot low along the channel, 5.5 s.
import * as THREE from 'three';
import { V, cam, place, smooth, handheld } from './anim.js';
import { persiaSite, PS } from './persia.js';

export const DURATION = 5.5; export const CAPTIONS = []; export const FADES = [];
export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };

export const SHOTS = [
  { start: 0, end: DURATION, build: ({ makeStage }) => {
    // a high sun along the channel, so the kerbs don't shade it
    const scene = makeStage({ outdoor: 'golden', sunDir: [0.62, 0.8, -0.05], fog: 0.006, shadowSize: 6, shadowAt: [0.6, 0.3, PS.jubZ], envI: 0.85, hemi: 0.3 });
    const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.012;
    const fill = new THREE.DirectionalLight(0xffe2c0, 0.4); fill.position.set(4, 2, 5); scene.add(fill);
    const site = persiaSite({ seed: 5 }), U = site.userData; scene.add(site);
    (scene.userData.updaters = scene.userData.updaters || []).push((t) => U.update(t));
    if (window.DBG) { window._SITE = site; window._FS = []; }
    const c = cam(38);
    return { scene, camera: c, update(lt) {
      U.streamTo(U.landY); U.splash.visible = true; U.jubWater.userData.uImp.value = 1;
      // low over the channel, drifting towards the falling stream
      const k = smooth(lt / DURATION), hh = handheld(lt, 0.4, 6);
      const cp = V(1.45 - 0.35 * k + hh.p[0], 0.78 - 0.05 * k + hh.p[1], PS.jubZ + 0.4 + hh.p[2]);
      const tg = V(0.15 - 0.1 * k, 0.12, PS.jubZ);
      place(c, cp.toArray(), tg.toArray(), hh.roll);
      return { bloom: 0.3, warm: 1.08, sat: 1.1, dof: { focus: cp.distanceTo(V(0.6, 0.1, PS.jubZ)), aperture: 0.003, maxblur: 0.006 } };
    } };
  } },
];
