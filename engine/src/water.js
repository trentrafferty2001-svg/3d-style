// Water v1.3.1: moving water that reads as water up close. All animation is a pure function of TIME, so motion blur and
// any render order give the same frame.
//  flowWaterMaterial  a flowing surface: ripples carried along the flow, rings spreading from impact points, foam that
//                     forms where water lands and drifts downstream, dark murky body, sky reflections (keep roughness low)
//  streamMaterial     a falling stream on a TubeGeometry (uv.x runs along the stream): see-through body, bright edges,
//                     streaks rushing down it, breaking into drops towards the end
//  splash             instanced droplets thrown up where a stream lands (periodic, seeded)
import * as THREE from 'three';
import { TIME, NOISE } from './world.js';

const glslVec2 = (v) => `vec2(${v[0].toFixed(4)}, ${v[1].toFixed(4)})`;

export function flowWaterMaterial({ color = 0x2a3a30, foam = 0xe4e8de, flow = [-1, 0], speed = 0.55, scale = 9, impacts = [], ripple = 1.0, env = 0.7, opacity = 1 } = {}) {
  // opacity < 1: shallow water you can see into (mud, plant bases, fish below); drawn after the opaque scene
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.07, metalness: 0, envMapIntensity: env, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  const f = new THREE.Vector2(...flow).normalize(), imps = impacts.slice(0, 2);
  m.userData.uImp = { value: 1 }; // impact strength 0..1: set m.userData.uImp.value = 0 while nothing is landing (rings and foam fade out)
  const key = `flowWater:${f.x.toFixed(3)},${f.y.toFixed(3)}:${speed}:${scale}:${ripple}:${imps.map(p => p.join(',')).join(';')}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME; sh.uniforms.uFoam = { value: new THREE.Color(foam) }; sh.uniforms.uImp = m.userData.uImp;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPw;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const F = glslVec2([f.x, f.y]), S = speed.toFixed(3), SC = scale.toFixed(2);
    const ringTerms = imps.map(p => `{ vec2 d = p - ${glslVec2(p)}; float r = length(d); h += uImp * (0.55 * sin(r * 85.0 - uTime * 17.0) * exp(-r * 11.0) + 0.35 * (fbm(p * 40.0 + uTime * 3.0) - 0.5) * exp(-r * 14.0)); }`).join('\n');
    const foamTerms = imps.map(p => `{ vec2 d = p - ${glslVec2(p)}; float along = dot(d, FL), across = dot(d, vec2(-FL.y, FL.x));
        fm += 1.2 * exp(-dot(d, d) / 0.0018) + 0.8 * exp(-across * across / (0.0005 + 0.0018 * max(along, 0.0))) * smoothstep(-0.03, 0.03, along) * exp(-max(along, 0.0) / 0.35); }`).join('\n');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPw; uniform float uTime, uImp; uniform vec3 uFoam;
        ${NOISE}
        const vec2 FL = ${F};
        float wH(vec2 p) { // height: two layers of ripples carried along the flow at different speeds, plus impact rings
          vec2 q = p * ${SC}; float h = fbm(q * vec2(1.0, 1.6) - FL * uTime * ${S} * ${SC}) * 0.6 + fbm(q * 2.3 - FL * uTime * ${S} * ${SC} * 1.7 + 7.0) * 0.4;
          ${ringTerms}
          return h; }
        float wFoam(vec2 p) { float fm = 0.0;
          ${foamTerms}
          float n = fbm(p * 34.0 - FL * uTime * ${S} * 34.0) * 0.7 + fbm(p * 90.0 - FL * uTime * ${S} * 90.0) * 0.3;
          return clamp(fm * uImp, 0.0, 1.0) * smoothstep(0.42, 0.64, n); }`) // foam only at the landing point and a thin wake (more read as snow)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wFm = wFoam(vWPw.xz); diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, wFm * 0.85);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.7, wFm);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float e = 0.004, h0 = wH(vWPw.xz), hx = wH(vWPw.xz + vec2(e, 0.0)), hz = wH(vWPw.xz + vec2(0.0, e));
          vec3 pert = vec3(h0 - hx, 0.0, h0 - hz) * ${(0.9 * ripple).toFixed(3)};
          normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz); }`);
  };
  return m;
}

export function streamMaterial({ color = 0xb8d0c8, speed = 9.0, breakup = 0.7, taper = 0.0 } = {}) { // taper: how much the radius shrinks by the end (m)
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.customProgramCacheKey = () => `stream:${speed}:${breakup}`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME; sh.uniforms.uTaper = { value: taper };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uTaper; varying vec2 vSUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSUv = uv; // falling water speeds up and thins; a slight shimmer only (bigger wobbles read as jelly)
        transformed -= normal * uTaper * uv.x;
        transformed += normal * (sin(uTime * 31.0 - uv.x * 40.0) * 0.0009 + sin(uTime * 19.0 - uv.x * 23.0 + 1.7) * 0.0007) * (0.3 + uv.x);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; varying vec2 vSUv;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sStreak = fbm(vec2(vSUv.y * 7.0, vSUv.x * 16.0 - uTime * ${speed.toFixed(2)}));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.35 * smoothstep(0.45, 0.75, sStreak));`)
      .replace('#include <opaque_fragment>', `
        { float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
          float gaps = smoothstep(${breakup.toFixed(2)}, 1.0, vSUv.x) * smoothstep(0.35, 0.6, fbm(vec2(vSUv.y * 4.0, vSUv.x * 22.0 - uTime * ${(speed * 1.3).toFixed(2)})));
          diffuseColor.a = clamp(0.16 + 0.62 * fr + 0.3 * smoothstep(0.45, 0.75, sStreak), 0.0, 0.92) * (1.0 - gaps);
          outgoingLight += vec3(0.25) * fr; }
        #include <opaque_fragment>`);
  };
  return m;
}

// droplets thrown up where a stream lands: n drops, each on its own cycle (period ~0.45 s), launched in a cone around `up`,
// falling back under gravity; hidden when back under the surface. update(t) places them (call it every (sub)frame).
export function splash(at, { n = 26, surfaceY = at.y, size = 0.007, spread = 0.35, up = 0.9, seed = 3, color = 0xd8e6e0 } = {}) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const D = [...Array(n)].map(() => ({ ph: r(), per: 0.32 + r() * 0.26, a: r() * Math.PI * 2, v: up * (0.5 + r() * 0.6), h: spread * (0.3 + r()), sz: size * (0.6 + r() * 0.8) }));
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.3, transparent: true, opacity: 0.45, depthWrite: false }), n); // see-through: opaque drops read as pebbles
  mesh.castShadow = false; mesh.frustumCulled = false; mesh.userData.noGround = true; // airborne by design: grounding probes skip it
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), SC = new THREE.Vector3(), VEL = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  mesh.update = (t) => {
    D.forEach((d, i) => {
      const age = (((t / d.per + d.ph) % 1) + 1) % 1 * d.per; // seconds since this drop's latest launch
      P.set(at.x + Math.cos(d.a) * d.h * age, at.y + d.v * age - 4.9 * age * age, at.z + Math.sin(d.a) * d.h * age);
      const vis = P.y > surfaceY - 0.002; VEL.set(Math.cos(d.a) * d.h, d.v - 9.8 * age, Math.sin(d.a) * d.h); const sp = VEL.length(); Q.setFromUnitVectors(UP, VEL.normalize());
      const k = vis ? d.sz : 0; SC.set(k, k * (1 + sp * 0.6), k); M.compose(P, Q, SC); mesh.setMatrixAt(i, M);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.update(0);
  return mesh;
}

// wet ground: a patch that darkens and turns glossy where water has soaked in, with a ragged edge. radius(t) gives
// its size (m) at time t, pure. Lay it 2-3 mm above the ground; call update(t) every sub-frame.
export function wetPatch(center, radius, { color = 0x7a5e3e, y = center.y, size = 1.6, seed = 1 } = {}) {
  // damp sand is darker with a dull sheen: a glossier patch caught the sky in its middle and read as a glowing puddle
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, envMapIntensity: 0.35, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.customProgramCacheKey = () => 'wetPatch';
  const U = { uR: { value: 0 }, uSeed: { value: seed } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWUv = position.xy;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vWUv; uniform float uR, uSeed;\n${NOISE}`)
      .replace('#include <opaque_fragment>', `
        { float d = length(vWUv), edge = (fbm(vWUv * 7.0 + uSeed) - 0.5) * 0.35 * uR;
          float wet = smoothstep(uR + edge, uR * 0.55 + edge, d);   // soaked in the middle, a ragged drying edge
          diffuseColor.a = wet * 0.82; }
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(center.x, y, center.z);
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.noGround = true;
  mesh.update = (t) => { U.uR.value = Math.max(0, radius(t)); mesh.visible = U.uR.value > 0.002; };
  mesh.update(0);
  return mesh;
}

// a stream whose path changes every frame (e.g. poured from a jar in moving hands): set(points) rebuilds the tube
export function liveStream(material, { radius = 0.011, segments = 32 } = {}) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material); mesh.castShadow = false; mesh.frustumCulled = false; mesh.userData.noGround = true;
  mesh.set = (pts) => {
    mesh.geometry.dispose();
    mesh.visible = pts.length >= 2;
    mesh.geometry = mesh.visible ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segments, radius, 10, false) : new THREE.BufferGeometry();
  };
  return mesh;
}

// Caustics (v1.10): the bright, wavering web that sunlight focused by ripples draws on the floor of clear shallow water.
// Patches a copy of a floor material: two layers of cells drift with the flow, and their edges (where two cells meet)
// make the net. It is scaled by the sun's direct light on that spot, so shadows
// keep it out, and it fades in under the water line (waterY) and out with depth. A pure function of TIME.
export function causticsMaterial(mat, { waterY = 0, flow = [1, 0], scale = 7, speed = 0.35, strength = 1.6, depth = 0.6 } = {}) {
  const m = mat.clone(), FL = `vec2(${(+flow[0]).toFixed(3)}, ${(+flow[1]).toFixed(3)})`;
  m.customProgramCacheKey = () => `caustics_${waterY}_${scale}_${speed}_${strength}_${depth}_${flow}`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPc;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPc = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWPc; uniform float uTime;\n${NOISE}
      // cellular caustics: bright lines where two cells meet (F2 - F1 small); the cell points circle slowly
      float causCell(vec2 p, float t) { vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), h = vec2(hash12(i + g), hash12(i + g + 17.3));
          vec2 o = 0.5 + 0.42 * sin(t * (0.6 + h) + 6.2831 * h); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        return exp(-(d2 - d1) * 9.0); }`)
      .replace('#include <opaque_fragment>', `{
        float dw = ${(+waterY).toFixed(3)} - vWPc.y;
        float under = smoothstep(0.0, 0.015, dw) * exp(-max(dw, 0.0) / ${(+depth).toFixed(3)});
        vec2 p = vWPc.xz * ${(+scale).toFixed(2)}; float t = uTime * ${(+speed).toFixed(3)} * ${(+scale).toFixed(2)};
        vec2 w = vec2(vnoise(p * 0.45 + t * 0.2), vnoise(p * 0.45 - t * 0.2 + 5.0)) * 1.1   // wobble: no straight cell edges
          + vec2(vnoise(p * 1.6 + t * 0.5 + 2.0), vnoise(p * 1.6 - t * 0.5 + 8.0)) * 0.32;
        float c1 = causCell(p + w + ${FL} * t * 0.3, uTime * 1.3), c2 = causCell(p * 1.7 - w * 0.8 + 3.7 - ${FL} * t * 0.2, uTime * 1.7);
        // the brightest light where both layers' lines cross, a faint net elsewhere, and uneven over the floor
        float c = (pow(c1, 4.0) * 0.35 + pow(c1 * c2, 1.6) * 1.1) * (0.55 + 0.9 * vnoise(p * 0.3 + 11.0));
        outgoingLight += reflectedLight.directDiffuse * c * ${(+strength).toFixed(2)} * under;
      }
      #include <opaque_fragment>`);
  };
  return m;
}
