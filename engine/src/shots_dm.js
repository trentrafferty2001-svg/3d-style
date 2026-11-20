// Style demo (v2 look): a farmer hauls a shaduf bucket into the Nile, lets go, and the mud counterweight lifts it.
// 7.5 s, 30 fps, motion blur. Every function of time here is pure: tables are computed once when a shot is built.
import * as THREE from 'three';
import { V, cam, place, clamp, lerp, smooth, easeInOut, range, springKeys, spring, handheld, camPath, noise1 } from './anim.js';
import { toon } from './toon.js';
import { birds } from './world.js';
import { LAND, WY, PIV, ROPE, PLAT, terrain, platform, shaduf, tipAt, grass, papyrus, palm, hut, jar, heightAt, rng, river, pebbles } from './nile.js';
import { waterMaterial } from './world.js';
import { VO } from './vo_dm.js';

export const STYLE = { shadow: 'pcf', mb: 6, shutter: 0.5 };
const at = (line, word, k = 0) => VO[line].words.filter(w => w[0].toLowerCase().replace(/[^a-z]/g, '') === word)[k][1];
const le = (line) => VO[line].words[VO[line].words.length - 1][2];
export const DURATION = Math.round((le(1) + 0.7) * 30) / 30;

const CHUNKS = [
  [['How do you', 3], ['*lift water*', 2], ['out of a *river*', 4], ['*all day*', 2], ['with just', 2], ['your *arms?*', 2]],
  [['But on', 2], ['the *Nile*', 2], ['a *lump*', 2], ['of *mud*', 2], ['did the', 2], ['*lifting*', 1]],
];
export const CAPTIONS = [];
CHUNKS.forEach((chunks, li) => {
  let wi = 0;
  chunks.forEach(([text, n], ci) => {
    const w0 = VO[li].words[wi], wl = VO[li].words[wi + n - 1];
    if (!w0 || !wl) throw new Error(`caption words out of range line ${li} chunk ${ci}`);
    CAPTIONS.push(ci === chunks.length - 1 ? [w0[1] - 0.04, text, wl[2] + 0.3] : [w0[1] - 0.04, text]);
    wi += n;
  });
  if (wi !== VO[li].words.length) throw new Error(`line ${li}: captions cover ${wi} of ${VO[li].words.length} words`);
});
export const FADES = [];

// ================= the action, as functions of global time =================
const CUT = VO[1].words[0][1] - 0.2;          // cut just before "But"
const T_REL = at(1, 'nile') + 0.3;             // he lets go at the end of "Nile"
const A_EQ = -0.3;                              // resting angle once the full bucket is up
// pole angle while hauling: spring-driven keys (heavy, little overshoot), a small lift before the first heave
const HAUL = [[0, -0.05], [0.12, -0.1], [0.32, 0.08], [0.72, 0.28], [1.1, 0.48], [1.45, 0.63], [T_REL - 0.45, 0.68]];
const A1 = (t) => springKeys(t, HAUL, 1.1, 0.9);
const A_R = A1(T_REL);
export function poleA(t) { return t < T_REL ? A1(t) : A_R + (A_EQ - A_R) * spring(t - T_REL, 0.42, 0.42); }
// times the bucket bottom crosses the water (in) and leaves it (out): bottom = tip.y - 2.455
const bottomY = (t) => tipAt(poleA(t)).y - (ROPE + 0.21 + 0.345);
function crossing(t0, t1, down) { let prev = bottomY(t0); for (let t = t0; t <= t1; t += 0.001) { const y = bottomY(t); if (down ? (prev >= WY && y < WY) : (prev <= WY && y > WY)) return t; prev = y; } return null; }
export const T_SPLASH = crossing(0, CUT, true);
export const T_OUT = crossing(T_REL, DURATION, false);
const rimUnder = (t) => tipAt(poleA(t)).y - (ROPE + 0.21) < WY - 0.02;
// bucket pendulum, simulated once at 1 kHz: driven by the tip's acceleration, damped by the farmer's grip while he
// holds the rope and heavily by the water while the bucket is under. phi = swing towards +z, psi = sideways (wind).
const PEND = (() => {
  const dt = 0.001, t0 = -1, n = Math.ceil((DURATION + 1.5 - t0) / dt), L = ROPE + 0.21;
  const tabA = new Float32Array(n), tabB = new Float32Array(n);
  let phi = 0, w = 0, psi = 0, wp = 0, maxHaul = 0, maxFree = 0;
  const tipT = (t) => tipAt(poleA(Math.max(0, t)));
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt, h = 0.002;
    const p0 = tipT(t - h), p1 = tipT(t), p2 = tipT(t + h);
    const ay = (p2.y - 2 * p1.y + p0.y) / (h * h), az = (p2.z - 2 * p1.z + p0.z) / (h * h);
    const sub = clamp((WY + 0.3 - bottomY(Math.max(0, t))) / 0.3);
    const c = (t < T_REL ? 3.0 : 0.7) + 9 * sub;
    const geff = 9.8 + ay;
    w += (-(geff / L) * Math.sin(phi) - (az / L) * Math.cos(phi) - c * w) * dt; phi += w * dt;
    const wind = noise1(t * 0.5, 12) * 0.25;
    wp += (-(geff / L) * Math.sin(psi) + wind / L - c * wp) * dt; psi += wp * dt;
    tabA[i] = phi; tabB[i] = psi;
    if (t > 0 && t < T_REL) maxHaul = Math.max(maxHaul, Math.abs(phi)); else if (t >= T_REL) maxFree = Math.max(maxFree, Math.abs(phi));
  }
  console.warn(`[dm] bucket swing max: hauling ${(maxHaul * 57.3).toFixed(1)} deg, after release ${(maxFree * 57.3).toFixed(1)} deg`);
  return (t) => { const i = Math.max(0, Math.min(n - 1, Math.round((t - t0) / dt))); return [tabA[i], tabB[i]]; };
})();
const swingAt = (t) => PEND(t);
const fillAt = (t) => { if (t < T_SPLASH) return 0; const k = clamp((t - T_SPLASH) / 1.1); return rimUnder(t) || t > T_REL ? Math.max(k, t > T_REL ? 1 : 0) : k * 0.7; };

// farmer on the platform, facing -x (towards the rope)
const FPOS = V(0.5, PLAT.y, 2.02);
// hand-over-hand: each hand grips the rope at a fixed distance s below the tip, is pulled down, then lets go and
// reaches up to grab higher while the other hand holds. Simulated once at 500 Hz into a table.
const ropeDir = (sw) => new THREE.Vector3(Math.sin(sw[1]), -Math.cos(sw[1]) * Math.cos(sw[0]), Math.sin(sw[0])).normalize();
const ropePoint = (t, s) => tipAt(poleA(t)).addScaledVector(ropeDir(swingAt(t)), s);
const HI = 2.03, LO = 1.82, REACH = 0.20; // grab and let-go heights keep every grip within arm's reach (probe_hands)
function simulateHands() {
  const dt = 0.002, N = Math.ceil(T_REL / dt) + 2; const tab = { l: [], r: [] };
  const st = { l: { mode: 'grip', s: 1.85, t0: 0 }, r: { mode: 'grip', s: 1.86, t0: 0 } }; // just above the bucket's bail
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    for (const h of ['l', 'r']) {
      const o = h === 'l' ? 'r' : 'l'; const S = st[h];
      if (S.mode === 'grip') {
        const y = ropePoint(t, S.s).y;
        if (y < LO && st[o].mode === 'grip' && t - st[o].t0 > 0.06 && t < T_SPLASH + 1.0) { S.mode = 'reach'; S.from = ropePoint(t, S.s); S.t0 = t; S.sNew = Math.min(1.84, Math.max(0.25, tipAt(poleA(t + REACH)).y - HI)); }
        tab[h].push({ mode: 1, s: S.s, g: 1 });
      } else {
        const k = (t - S.t0) / REACH;
        if (k >= 1) { S.mode = 'grip'; S.s = S.sNew; S.t0 = t; tab[h].push({ mode: 1, s: S.s, g: 1 }); }
        else tab[h].push({ mode: 0, k, from: S.from, s: S.sNew, g: 0 });
      }
    }
  }
  return (h, t) => tab[h][Math.max(0, Math.min(tab[h].length - 1, Math.round(t / dt)))];
}

// ================= scene =================
function world(makeStage) {
  const sunDir = [-0.72, 0.36, 0.6];
  // denser haze: distant banks and palms fade into the warm air (aerial perspective)
  const scene = makeStage({ outdoor: 'golden', sunDir, fog: 0.0085, shadowSize: 6, shadowAt: [0.2, 1.6, 0.6], envI: 0.85, hemi: 0.3 });
  const key = scene.userData.key; key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 2.2; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015;
  // soft bounce light from the river side + a cool rim from behind
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.55); fill.position.set(3, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7); rim.position.set(2, 4, -6); scene.add(rim);
  // warm light bouncing up off the sunlit sand: lifts chins, undersides of arms, the pole and the bucket
  const bounce = new THREE.DirectionalLight(0xd9a068, 0.5); bounce.position.set(-0.6, -1, 0.5); scene.add(bounce);
  const terr = terrain(); scene.add(terr); terr.updateMatrixWorld(true);
  const rcT = new THREE.Raycaster(); const groundY = (x, z) => { rcT.set(V(x, 50, z), V(0, -1, 0)); const h = rcT.intersectObject(terr, false)[0]; return h ? h.point.y : heightAt(x, z); }; // exact surface
  const water = river({ color: 0x35604f, ripple: 1.0 }); scene.add(water);
  (scene.userData.prerender = scene.userData.prerender || []).push(water.userData.prerender);
  scene.add(platform());
  const S = shaduf(); scene.add(S);
  // vegetation: grass on the top of the bank (kept off the posts, path and channel), papyrus at the waterline
  const r = rng(11); const gs = [];
  for (let i = 0; i < 3200; i++) {
    const x = (r() - 0.5) * 26, z = -r() * r() * 14 - 0.05;
    if (Math.abs(x) < 1.1 && z > -1.4) continue; if (Math.abs(x + 1.3) < 0.45) continue; if (x > 0.2 && x < 1.8 && z > -0.6) continue;
    const y = heightAt(x, z); if (y < LAND - 0.25) continue; gs.push([x, y - 0.01, z, 0.8 + r() * 0.6]);
  }
  scene.add(grass(gs, { h: 0.34, seed: 5 }));
  // pebbles on the bank top and down the bank face (kept off the posts, basin, channel, jars and the platform)
  const pb = [];
  for (let i = 0; i < 700; i++) {
    const x = (r() - 0.5) * 16, z = -r() * r() * 9 + 1.05 * r() * (r() < 0.35 ? 1 : 0);
    if (Math.abs(x) < 0.85 && z > -0.9 && z < 0.2) continue; if (Math.abs(x + 1.3) < 0.55) continue; if (x < -1.6 && x > -2.8 && z > -1.1 && z < 0) continue;
    if (x > PLAT.x0 - 0.15 && x < PLAT.x1 + 0.15 && z > -0.1) continue;
    const y = groundY(x, z); if (y < WY + 0.03) continue; pb.push([x, y - 0.004, z, 0.012 + r() * r() * 0.05]);
  }
  scene.add(pebbles(pb));
  const ps = [];
  for (let c = 0; c < 26; c++) {
    let cx = (r() - 0.5) * 24; if (cx > -5.5 && cx < 2.6) cx = cx < -1.5 ? cx - 4 : cx + 3.2;
    const cz = 0.95 + r() * 0.8; const n = 6 + Math.floor(r() * 7);
    for (let k = 0; k < n; k++) { const x = cx + (r() - 0.5) * 0.7, z = cz + (r() - 0.5) * 0.5; ps.push([x, Math.min(WY, heightAt(x, z)) - 0.05, z, 0.8 + r() * 0.5]); }
  }
  scene.add(papyrus(ps, 21));
  // irrigation channel from the shaduf back to the fields
  const ch = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 18), waterMaterial({ color: 0x4a7a6a, opacity: 1, ripple: 0.6 })); ch.rotation.x = -Math.PI / 2; ch.position.set(-1.3, LAND - 0.04, -9.2); scene.add(ch);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 18, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 1 })); b.rotation.x = Math.PI / 2; b.scale.y = 0.6; b.position.set(-1.3 + s * 0.27, LAND - 0.02, -9.2); b.receiveShadow = true; scene.add(b); }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 1 })); basin.position.set(-1.3, LAND - 0.02, -0.15); scene.add(basin);
  const bw = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), waterMaterial({ color: 0x4a7a6a, opacity: 1, ripple: 0.8 })); bw.rotation.x = -Math.PI / 2; bw.position.set(-1.3, LAND + 0.045, -0.15); scene.add(bw);
  // palms, hut, jars, far bank, distant pyramid in the haze
  [[-4.2, -5, 7.5, 3], [3.6, -7.5, 8.5, 4], [-8.5, -11, 7, 5], [7.5, -4.2, 6.5, 6], [1, -15, 9, 7], [-13, -6, 8, 8]].forEach(([x, z, h, sd]) => { const p = palm(h, sd); p.position.set(x, heightAt(x, z) - 0.05, z); scene.add(p); });
  for (let i = 0; i < 16; i++) { const x = -60 + i * 8 + (r() - 0.5) * 4, z = 54 + r() * 6; const p = palm(7 + r() * 3, 30 + i); p.position.set(x, heightAt(x, z) - 0.1, z); scene.add(p); }
  const H = hut(); H.position.set(-7.5, heightAt(-7.5, -9) - 0.05, -9); H.rotation.y = 0.5; scene.add(H);
  [[-2.05, -0.45, 0.55, 1], [-2.45, -0.75, 0.45, 2]].forEach(([x, z, h, sd]) => { const j = jar(h, sd); j.position.set(x, heightAt(x, z) - 0.02, z); scene.add(j); });
  return { scene, S, water };
}

// splash, ripples and drips
function effects(scene, S) {
  const g = new THREE.Group(); scene.add(g);
  // droplets: soft specular only (clearcoat sun glints on dozens of drops bloomed into a white haze)
  const dropM = new THREE.MeshStandardMaterial({ color: 0xa4bcbc, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.34, envMapIntensity: 0.5 });
  const N = 150; const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dropM, N); drops.frustumCulled = false; g.add(drops);
  const ND = 70; const drips = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), dropM, ND); drips.frustumCulled = false; g.add(drips);
  const r = rng(77); const SP = []; for (let i = 0; i < N; i++) { const a = r() * Math.PI * 2, sp = 0.5 + r() * 1.3; SP.push({ a, vr: sp, vy: 0.8 + r() * 2.6 * (1 - sp / 2.2), s: 0.004 + r() * r() * 0.014, dt: r() * 0.1 }); }
  const DR = []; for (let i = 0; i < ND; i++) DR.push({ a: r() * Math.PI * 2, rr: 0.05 + r() * 0.13, s: 0.004 + r() * 0.006, j: r() });
  // crown sheet: open cylinder with a ragged lip
  const cg = new THREE.CylinderGeometry(1, 0.8, 1, 48, 4, true); const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y > 0.4) { const a = Math.atan2(cp.getX(i), cp.getZ(i)); cp.setY(i, y + 0.25 * Math.abs(Math.sin(a * 7)) + 0.1 * Math.sin(a * 13)); } }
  cg.computeVertexNormals();
  const crownM = new THREE.MeshStandardMaterial({ color: 0xf4fbfa, roughness: 0.45, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const crown = new THREE.Mesh(cg, crownM); g.add(crown);
  // ripples: rings drawn by a shader on a patch of the surface around the rope
  const ripM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uS: { value: 0 }, uO: { value: 0 }, uHold: { value: 0 }, uC: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xz; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uT, uS, uO, uHold; uniform vec2 uC; varying vec2 vP;
      float ring(float d, float age, float sp){ if (age < 0.0) return 0.0; float r = age * sp; float w = 0.018 + age * 0.025; return exp(-pow((d - r) / w, 2.0)) * exp(-age * 1.8); }
      void main(){ float d = distance(vP, uC); float a = 0.0;
        for (int i = 0; i < 4; i++) { float o = float(i) * 0.16; a += ring(d, uT - uS - o, 0.75 - o * 0.6) * (1.0 - float(i) * 0.2); }
        for (int i = 0; i < 3; i++) { float o = float(i) * 0.14; a += ring(d, uT - uO - o, 0.7) * 0.8; }
        float hold = uHold * (0.5 + 0.5 * sin(d * 40.0 - uT * 7.0)) * exp(-d * 5.0) * 0.35;
        a = clamp(a + hold, 0.0, 1.0) * smoothstep(1.6, 0.6, d);
        gl_FragColor = vec4(vec3(0.92, 0.96, 0.95), a * 0.32);
        #include <colorspace_fragment>
      }`,
  });
  const rip = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), ripM); rip.rotation.x = -Math.PI / 2; rip.position.y = WY + 0.004; g.add(rip);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), P = new THREE.Vector3(), VEL = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const bucketAt = (t) => { const tp = tipAt(poleA(t)); return tp.addScaledVector(ropeDir(swingAt(t)), ROPE + 0.21); };
  return (t) => {
    const c0 = bucketAt(T_SPLASH); rip.position.x = c0.x; rip.position.z = c0.z;
    ripM.uniforms.uC.value.set(c0.x, c0.z); ripM.uniforms.uT.value = t; ripM.uniforms.uS.value = T_SPLASH; ripM.uniforms.uO.value = T_OUT ?? 99;
    ripM.uniforms.uHold.value = t > T_SPLASH + 0.3 && t < (T_OUT ?? 99) ? 1 : 0;
    // splash droplets: ballistic from the entry point, gone when back under the surface
    for (let i = 0; i < N; i++) {
      const d = SP[i]; const tau = t - T_SPLASH - d.dt; let vis = tau > 0 && tau < 1.3;
      let y = WY + 0.02 + d.vy * tau - 4.9 * tau * tau; if (y < WY - 0.01) vis = false;
      const rr = 0.16 + d.vr * tau; P.set(c0.x + Math.cos(d.a) * rr, y, c0.z + Math.sin(d.a) * rr);
      // stretch each drop along its velocity (falling water is a streak, not a ball)
      VEL.set(Math.cos(d.a) * d.vr, d.vy - 9.8 * tau, Math.sin(d.a) * d.vr); const sp = VEL.length(); Q.setFromUnitVectors(UP, VEL.normalize());
      const s = vis ? d.s * (1 - tau * 0.4) : 0; SC.set(s, s * (1 + sp * 0.8), s); M4.compose(P, Q, SC); drops.setMatrixAt(i, M4);
    }
    drops.instanceMatrix.needsUpdate = true;
    // crown: rises and thins in half a second
    const ct = t - T_SPLASH; crown.visible = ct > 0 && ct < 0.55;
    if (crown.visible) { const k = ct / 0.55; crown.position.set(c0.x, WY + 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.3)) * 0.5, c0.z); crown.scale.set(0.2 + k * 0.32, 0.02 + 0.3 * Math.sin(Math.PI * k), 0.2 + k * 0.32); crownM.opacity = 0.42 * (1 - k) * (1 - k); }
    // drips from the bucket after it leaves the water: emitted every 25 ms with the bucket's velocity, then falling
    for (let i = 0; i < ND; i++) {
      const d = DR[i]; let s = 0;
      if (T_OUT != null && t > T_OUT) {
        const period = 0.025 * ND; const te = t - ((t - T_OUT - (i * 0.025)) % period + period) % period; // most recent emission of this drop
        const tau = t - te;
        if (te >= T_OUT && tau < 1.6) {
          const b0 = bucketAt(te), b1 = bucketAt(te + 0.01); const v = b1.clone().sub(b0).multiplyScalar(100);
          const p = b0.clone().add(new THREE.Vector3(Math.cos(d.a) * d.rr, -0.33, Math.sin(d.a) * d.rr));
          const heavy = Math.exp(-(te - T_OUT) * 1.2); // more water right after it leaves the river
          p.addScaledVector(v, tau); p.y -= 4.9 * tau * tau;
          if (p.y > WY && d.j < 0.2 + 0.8 * heavy) { s = d.s * (0.8 + heavy); P.copy(p); }
        }
      }
      Q.identity(); SC.set(s, s * 2.2, s); M4.compose(P, Q, SC); drips.setMatrixAt(i, M4);
    }
    drips.instanceMatrix.needsUpdate = true;
  };
}

// generic 2nd-order lag of a vector function of time, simulated once at 500 Hz (overlap: the head arrives late and settles)
function lagTable(fn, f = 2.2, z = 0.75, t0 = 0, t1 = DURATION + 0.5) {
  const dt = 0.002, n = Math.ceil((t1 - t0) / dt) + 1, w = 2 * Math.PI * f; const tab = new Float32Array(n * 3);
  const p = fn(t0).clone(), v = new THREE.Vector3(), acc = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const g = fn(t0 + i * dt); acc.copy(g).sub(p).multiplyScalar(w * w).addScaledVector(v, -2 * z * w); v.addScaledVector(acc, dt); p.addScaledVector(v, dt); tab[i * 3] = p.x; tab[i * 3 + 1] = p.y; tab[i * 3 + 2] = p.z; }
  return (t) => { const i = Math.max(0, Math.min(n - 1, Math.round((t - t0) / dt))); return new THREE.Vector3(tab[i * 3], tab[i * 3 + 1], tab[i * 3 + 2]); };
}
const bucketAtT = (t) => tipAt(poleA(t)).addScaledVector(ropeDir(swingAt(t)), ROPE + 0.21);

function rig(makeStage) {
  const W = world(makeStage);
  const F = toon({ skin: 0x8a5232, cloth: 0xefe6d0, belt: 0x9a4a2a }); W.scene.add(F.root);
  if (window.DBG) { window._F = F; window._S = W.S; window._W = W; window._R = { ropePoint, poleA, T_REL }; } // ?dbg: lets the probe scripts measure the scene
  F.root.position.copy(FPOS); F.root.rotation.y = -Math.PI / 2;
  const fx = effects(W.scene, W.S);
  const hands = simulateHands(); if (window.DBG) window._R.hands = hands;
  const b = birds(5, { from: [-30, 11, -14], to: [30, 13, -22], spread: 4, speed: 0.06, scale: 1.3, seed: 6 }); W.scene.add(b);
  const T_HIPS = T_REL + 1.0, T_NOD = at(1, 'lifting') + 0.1; // hands to hips, proud nod

  // ---- trunk as a pure function of time (also drives the kilt's pendulum) ----
  const crouchAt = (t) => { if (t >= T_REL + 0.3) return 0; let acc = 0; for (let i = -4; i <= 4; i++) { const tt = Math.min(T_REL, Math.max(0, t + i * 0.03)); let lo = 9; for (const h of ['l', 'r']) { const H = hands(h, tt); if (H.mode) lo = Math.min(lo, ropePoint(tt, H.s).y); } acc += clamp((1.82 - lo) / 0.4); } return acc / 9; };
  const trunk = (t) => {
    const rel = t > T_REL ? t - T_REL : -1;
    const effort = t < T_REL ? clamp(0.55 + 0.45 * Math.sin(Math.min(1, t / 1.4) * Math.PI * 0.5)) : Math.max(0, 1 - spring(rel, 1.2, 0.7));
    const up = rel > 0 ? spring(rel - 0.05, 1.0, 0.5) : 0;
    // breathing: fast and deep while straining, a big exhale on release, then settling
    const rate = t < T_REL ? 3.4 : lerp(3.6, 2.2, clamp(rel / 2)); const depth = t < T_REL ? 0.016 : lerp(0.03, 0.012, clamp(rel / 1.8));
    const breathe = Math.sin(t * rate) * depth - (rel > 0 ? 0.03 * Math.exp(-rel * 3) * Math.sin(Math.min(Math.PI, rel * 6)) : 0);
    const strainShake = t < T_REL ? noise1(t * 9, 2) * 0.012 * clamp(t - 1.2) : 0;
    const rp = ropePoint(Math.min(t, T_REL), 1.0); const twist = Math.atan2(rp.z - FPOS.z, FPOS.x - rp.x) * (1 - up);
    const crouch = crouchAt(t);
    const shift = rel > 0 ? Math.sin((t - T_REL) * 1.6) * 0.018 * smooth(clamp((rel - 0.6) / 0.8)) : 0; // weight shift side to side
    return { rel, effort, up, breathe, twist, crouch,
      hipsY: lerp(-0.07 - 0.03 * effort - 0.17 * crouch, -0.02, up) + breathe * 0.3, hipsZ: lerp(-0.06, 0, up), hipsX: shift,
      spine: [lerp(0.28 + 0.06 * effort, 0.06, up) + strainShake, twist * 0.35, -shift * 2], chest: [lerp(0.16, -0.04, up) + breathe, twist * 0.15, shift * 1.2] };
  };
  // ---- kilt: a damped pendulum driven by the hips' acceleration (and a breeze), simulated at 500 Hz ----
  const KILT = (() => {
    const dt = 0.002, n = Math.ceil((DURATION + 0.5) / dt) + 1, w = 2 * Math.PI * 1.0, zt = 0.2, L = 0.4; const tab = new Float32Array(n * 2);
    const hip = (t) => { const T = trunk(Math.max(0, t)); return [T.hipsZ, T.hipsY, T.hipsX, T.twist * 0.5]; }; // root-local: forward, up, side, yaw
    let ax = 0, vx = 0, az = 0, vz = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt, h = 0.004; const p0 = hip(t - h), p1 = hip(t), p2 = hip(t + h);
      const acc = (k) => (p2[k] - 2 * p1[k] + p0[k]) / (h * h);
      const wind = noise1(t * 0.6, 21) * 1.2 + noise1(t * 1.7, 22) * 0.6; // breeze (rad/s^2)
      vx += (-w * w * ax - 2 * zt * w * vx + acc(0) / L + acc(3) * 0.6 + wind * 0.4) * dt; ax += vx * dt;  // forward accel swings the hem back
      vz += (-w * w * az - 2 * zt * w * vz - acc(2) / L - acc(3) * 0.4 + wind) * dt; az += vz * dt;
      tab[i * 2] = ax; tab[i * 2 + 1] = az;
    }
    return (t) => { const i = Math.max(0, Math.min(n - 1, Math.round(t / dt))); return [Math.max(-0.25, Math.min(0.25, tab[i * 2])), Math.max(-0.25, Math.min(0.25, tab[i * 2 + 1]))]; };
  })();
  // ---- where the head wants to look, then the same target lagged (head turns arrive late and settle) ----
  const UPLOOK = V(-0.6, 3.1, 2.75);
  const headGoal = (t) => {
    if (t < T_REL + 0.25) { const k = smooth(range(t, 2.1, 2.6)) * (1 - smooth(range(t, CUT + 0.3, T_REL))); return ropePoint(t, 0.15).add(V(0, 0.3, 0)).lerp(UPLOOK, k); }
    const k = smooth(clamp((t - T_REL - 0.25) / 0.6)); const g = bucketAtT(t).lerp(ropePoint(t, 0.9), 1 - k);
    // last beat: after the nod he looks out over the river, satisfied (and towards the lens side)
    return g.lerp(V(-2.2, 2.45, 4.6), smooth(clamp((t - T_NOD - 0.3) / 0.5)));
  };
  const headLag = lagTable(headGoal, 2.4, 0.8);
  // eye darts: small quick jumps of the gaze every 0.35-0.8 s (seeded, pure)
  const DARTS = (() => { const r = rng(91); const a = []; let t = 0; while (t < DURATION + 1) { a.push([t, (r() - 0.5) * 0.16, (r() - 0.5) * 0.1]); t += 0.35 + r() * 0.45; } return a; })();
  const dart = (t) => { let i = 0; while (i + 1 < DARTS.length && DARTS[i + 1][0] <= t) i++; const [t0, x, y] = DARTS[i]; const pr = DARTS[Math.max(0, i - 1)]; const k = smooth(clamp((t - t0) / 0.04)); return [lerp(pr[1], x, k), lerp(pr[2], y, k)]; };
  const BLINKS = [0.55, 2.4, 3.45, T_REL + 0.04, T_NOD + 0.45];
  const blinkAt = (t) => BLINKS.reduce((m, b) => Math.max(m, 1 - Math.abs(t - b - 0.07) / 0.07), 0);

  const act = (t) => {
    const a = poleA(t); const sw = swingAt(t);
    W.S.set(a, { swing: sw, fill: fillAt(t), slosh: -sw[0] * 0.8, wet: smooth(clamp((t - T_SPLASH) / 0.6)) });
    const T = trunk(t); const rel = T.rel;
    F.pose({ hipsY: T.hipsY, hipsZ: T.hipsZ, hipsX: T.hipsX, hipRot: [0, T.twist * 0.5, 0], spine: T.spine, chest: T.chest });
    const ks = KILT(t); F.kilt(ks[0], ks[1]);
    const w = (lx, ly, lz) => F.root.localToWorld(V(lx, ly, lz));
    F.legIK('l', w(0.14, 0.075, -0.03), w(0.35, 0.5, 1.2)); F.legIK('r', w(-0.14, 0.075, -0.25), w(-0.25, 0.5, 1.2)); // both feet fully on the platform top
    // hands: on the rope (hauling) or reaching; after the release they drop, then go to the hips (satisfied)
    const elbowPole = (s) => w(s * 0.6, 0.6, -0.2);
    for (const [h, s] of [['l', 1], ['r', -1]]) {
      if (t < T_REL + 0.02) {
        const H = hands(h, Math.min(t, T_REL)); let target;
        if (H.mode) target = ropePoint(t, H.s);
        else { const to = ropePoint(t, H.s), k = smooth(H.k); target = H.from.clone().lerp(to, k); const side = F.root.localToWorld(V(s, 0, 0)).sub(F.root.position).normalize(); target.addScaledVector(side, Math.sin(Math.PI * k) * 0.1); target.x += Math.sin(Math.PI * k) * 0.04; }
        target.x += 0.035; // palm centre sits just on the farmer's side of the rope
        F.armIK(h, target, elbowPole(s), V(0, 1, 0));
      } else {
        const k = spring(rel, 1.3, 0.55);
        const from = ropePoint(T_REL, hands(h, T_REL).s).add(V(0.035, 0, 0));
        const rest = w(s * 0.25, 0.95, 0.13 + 0.05 * Math.sin(t * 2 + s)); // clear of the kilt on the way down
        const hipHand = F.bones.hips.localToWorld(V(s * 0.225, 0.02, -0.02));  // fists on the hips (they ride with the hips' sway), elbows out
        const kh = spring(t - T_HIPS - (s > 0 ? 0 : 0.08), 1.6, 0.6);
        const tgt = from.lerp(rest, k).lerp(hipHand, clamp(kh));
        F.armIK(h, tgt, w(s * 0.6, lerp(0.9, 1.15, clamp(kh)), lerp(-0.6, -0.35, clamp(kh))), V(0, 1, 0));
      }
    }
    const Hl = hands('l', Math.min(t, T_REL)), Hr = hands('r', Math.min(t, T_REL));
    if (t < T_REL) F.grip(Hl.mode ? 1 : 0.15, Hr.mode ? 1 : 0.15); else { const k = clamp(rel / 0.25); const kh = clamp((t - T_HIPS) / 0.3); F.grip(lerp(lerp(1, 0.3, k), 0.75, kh), lerp(lerp(1, 0.3, k), 0.75, kh)); }
    // head: lagged target, plus a proud double nod on "lifting"; eyes lead the head and dart
    const hg = headLag(t); F.headAt(hg, t < T_REL + 0.25 ? 0.6 + 0.2 * smooth(range(t, 2.1, 2.6)) : 0.75);
    const nod = 0.13 * Math.max(0, Math.sin(clamp((t - T_NOD) / 0.55) * Math.PI * 2)) * (t > T_NOD ? 1 : 0);
    F.bones.neck.rotation.x += nod * 0.5; F.bones.head.rotation.x += nod * 0.5; F.root.updateMatrixWorld(true);
    const d = dart(t); const eg = headGoal(t).clone(); const toEye = eg.clone().sub(F.bones.head.getWorldPosition(V(0, 0, 0))); const side = new THREE.Vector3(-toEye.z, 0, toEye.x).normalize();
    eg.addScaledVector(side, d[0] * toEye.length()).add(V(0, d[1] * toEye.length(), 0)); F.look(eg);
    // face: effort grimace -> release blink + "phew" (wide eyes, round mouth) -> real smile with cheeks
    const phew = rel > 0 ? Math.sin(Math.PI * clamp((rel - 0.05) / 0.7)) : 0;
    const relax = rel > 0 ? smooth(clamp((rel - 0.45) / 0.6)) : 0;
    const proud = t > T_NOD ? 0.15 * Math.sin(Math.PI * clamp((t - T_NOD) / 0.8)) : 0;
    F.face({
      brow: lerp(-0.85, 0.3, relax) + 0.6 * phew, smile: lerp(-0.35, 0.95 + proud, relax), teeth: lerp(t < 1.0 ? 0.6 : 1, 0.55, relax) * (1 - phew),
      squint: lerp(0.55 + 0.15 * T.effort * (t < T_REL ? 1 : 0), 0.0, Math.max(relax, phew)), open: 0.05 * relax, oh: 0.85 * phew, wide: 0.7 * phew,
      flare: t < T_REL ? 0.6 + 0.4 * Math.max(0, Math.sin(t * 3.4)) : 0.5 * phew, cheek: relax * 0.9 + proud * 2, blink: blinkAt(t),
    });
    return { a };
  };
  return { ...W, F, fx, act, b };
}

// ================= shots =================
function sHaul({ makeStage }) {
  const R = rig(makeStage); const c = cam(38);
  return {
    scene: R.scene, camera: c,
    update(lt, t) {
      R.act(t); R.fx(t); R.b.update(t);
      c.fov = lerp(38, 34, easeInOut(range(t, 1.0, at(0, 'arms') + 0.3)));
      // low by the water looking up at the bucket plunging in, craning up to his straining face by "arms"
      const k = easeInOut(range(t, 1.0, at(0, 'arms') + 0.3));
      const p = camPath(k, [[-2.1, 1.25, 5.1], [-1.7, 1.55, 4.35], [-1.15, 1.88, 3.35], [-0.8, 2.02, 2.62]]);
      const look = V(0.25, 1.2, 2.0).lerp(V(0.5, 1.96, 2.0), smooth(range(t, 0.9, 2.45)));
      const hh = handheld(t, 1.2, 1); place(c, [p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]], look.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.15, sat: 1.1, flare: 0.5, dof: { focus: c.position.distanceTo(look), aperture: 0.004, maxblur: 0.008 } };
    },
  };
}
function sLift({ makeStage }) {
  const R = rig(makeStage); const c = cam(36);
  return {
    scene: R.scene, camera: c,
    update(lt, t) {
      R.act(t); R.fx(t); R.b.update(t);
      // wide from the river: slow arc while the counterweight drops and the bucket rises
      // wide while the counterweight drops ("a lump of mud"), then push in to a medium shot of the farmer and the
      // arriving bucket ("did the lifting"), from an angle where the bucket stays clear of his face
      const k0 = easeInOut(range(t, CUT, T_REL + 0.9)), k1 = easeInOut(range(t, T_REL + 0.95, DURATION - 0.35));
      const wide = camPath(k0, [[-4.6, 3.05, 10.3], [-4.45, 3.02, 10.05], [-4.3, 3.0, 9.85]]);
      const p = k1 > 0 ? camPath(k1, [wide, [-2.9, 2.45, 7.9], [-1.5, 2.0, 6.2], [-0.95, 1.8, 5.43]]) : wide;
      const look = V(0.15, 2.5, 0.3).lerp(V(0.28, 2.3, 2.05), k1);
      c.fov = lerp(36, 34, k1);
      const hh = handheld(t, 0.8, 4); place(c, [p[0] + hh.p[0], p[1] + hh.p[1], p[2] + hh.p[2]], look.toArray(), hh.roll);
      return { bloom: 0.35, warm: 1.15, sat: 1.1, flare: 0.6, dof: { focus: c.position.distanceTo(V(0.3, 2.0, 1.2)), aperture: 0.0025, maxblur: 0.006 } };
    },
  };
}
export const SHOTS = [
  { start: 0, end: CUT, build: sHaul },
  { start: CUT, end: DURATION + 1, build: sLift },
];
console.warn(`[dm] duration ${DURATION.toFixed(3)} cut ${CUT.toFixed(3)} splash ${T_SPLASH?.toFixed(3)} release ${T_REL.toFixed(3)} out ${T_OUT?.toFixed(3)}`);
