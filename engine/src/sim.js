// Baked simulations (3d-style v1.9): ropes and cloth that move like the real thing, simulated once when a shot is built
// and played back as a pure function of time (so motion blur sub-frames, stills and the render farm all agree).
import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- rope: a verlet chain ----------
// length (m), n points; pins(t) -> [[index, Vector3], ...] holds points (a stake, the hands); bodies(t) -> capsules
// [{ a, b, r }] the rope can't pass through (legs, torso, a post); groundAt(x, z) the floor under it (null: none).
// heavy: { index: mass ratio } for a load on the rope (a bucket). The table is stored at `store` Hz from t0 to t1.
// damping is per step: keep it close to 1 (0.9992 at 480 Hz is a light air drag; lower and ropes fall in slow motion).
export function bakeRope({ length, n = 32, radius = 0.012, init, pins = () => [], bodies = () => [], groundAt = null,
  t0 = 0, t1 = 5, hz = 480, store = 120, iters = 24, damping = 0.9992, gravity = -9.81, friction = 0.6, heavy = {} } = {}) {
  const L = length / (n - 1), dt = 1 / hz;
  const P = init.map(p => p.clone()), Q = init.map(p => p.clone());
  const W = P.map((_, i) => 1 / (heavy[i] || 1));                    // inverse mass
  const frames = [], every = Math.round(hz / store);
  const tmp = V3(), d = V3();
  const pushOut = (p, c) => {                                          // out of a capsule
    const ab = tmp.copy(c.b).sub(c.a), k = Math.max(0, Math.min(1, d.copy(p).sub(c.a).dot(ab) / ab.lengthSq()));
    const q = c.a.clone().addScaledVector(ab, k), off = p.clone().sub(q), dist = off.length(), min = c.r + radius;
    if (dist < min && dist > 1e-9) p.copy(q).addScaledVector(off, min / dist);
  };
  let step = 0;
  for (let t = t0; t <= t1 + 1e-9; t += dt, step++) {
    const pin = pins(t), body = bodies(t), pinned = new Set(pin.map(([i]) => i));
    // integrate (verlet, damped)
    for (let i = 0; i < n; i++) { if (pinned.has(i)) continue;
      const p = P[i], q = Q[i]; d.copy(p).sub(q).multiplyScalar(damping); q.copy(p); p.add(d); p.y += gravity * dt * dt; }
    for (const [i, x] of pin) { Q[i].copy(P[i]); P[i].copy(x); }
    // constraints: segment lengths (mass-weighted), pins, bodies, ground
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n - 1; i++) { const a = P[i], b = P[i + 1], wa = pinned.has(i) ? 0 : W[i], wb = pinned.has(i + 1) ? 0 : W[i + 1];
        if (wa + wb === 0) continue; d.copy(b).sub(a); const len = d.length(); if (len < 1e-9) continue;
        const corr = (len - L) / (len * (wa + wb)); a.addScaledVector(d, corr * wa); b.addScaledVector(d, -corr * wb); }
      for (const [i, x] of pin) P[i].copy(x);
      for (let i = 0; i < n; i++) { if (pinned.has(i)) continue; for (const c of body) pushOut(P[i], c);
        if (groundAt) { const g = groundAt(P[i].x, P[i].z) + radius; if (P[i].y < g) { P[i].y = g;
          // friction on the ground: kill part of the sideways slide
          const q = Q[i]; q.x += (P[i].x - q.x) * friction; q.z += (P[i].z - q.z) * friction; } } }
    }
    if (step % every === 0) { const f = new Float32Array(n * 3); P.forEach((p, i) => { f[i * 3] = p.x; f[i * 3 + 1] = p.y; f[i * 3 + 2] = p.z; }); frames.push(f); }
  }
  // playback: linear between stored frames
  const at = (t) => { const x = Math.max(0, Math.min(frames.length - 1, (t - t0) * store)), i = Math.floor(x), k = x - i, a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const out = []; for (let j = 0; j < n; j++) out.push(V3(a[j * 3] + (b[j * 3] - a[j * 3]) * k, a[j * 3 + 1] + (b[j * 3 + 1] - a[j * 3 + 1]) * k, a[j * 3 + 2] + (b[j * 3 + 2] - a[j * 3 + 2]) * k));
    return out; };
  return { at, n, L, radius, frames };
}

// ---------- kilt hem: a damped 2D pendulum driven by the hips ----------
// hipsAt(t) -> { pos: Vector3, quat: Quaternion } (world); legsAt(t) -> { l, r } forward swing of each thigh (radians)
// so the hem rides on the front knee. Returns hem(t) -> [x, z] for F.kilt(x, z).
export function bakeHem({ hipsAt, legsAt = null, t0 = 0, t1 = 5, hz = 480, store = 120, len = 0.45, damping = 3.2, stiff = 30, flutter = 0 } = {}) {
  const dt = 1 / hz, frames = [], every = Math.round(hz / store);
  let x = 0, z = 0, vx = 0, vz = 0, prev = null, prevV = V3();
  const g = 9.81, inv = new THREE.Quaternion();
  let step = 0;
  for (let t = t0; t <= t1 + 1e-9; t += dt, step++) {
    const h = hipsAt(t), v = prev ? h.pos.clone().sub(prev).divideScalar(dt) : V3(), a = v.clone().sub(prevV).divideScalar(dt);
    prev = h.pos.clone(); prevV.copy(v); if (step < 2) a.set(0, 0, 0);
    inv.copy(h.quat).invert();
    const aL = a.applyQuaternion(inv), up = V3(0, 1, 0).applyQuaternion(inv);    // in the hips' frame
    // the hem hangs along gravity (the hips' tilt) and lags behind accelerations; the cloth's own spring pulls it home
    const gx = Math.atan2(-up.z, up.y), gz = Math.atan2(up.x, up.y);
    const ax = (-aL.z / len) - stiff * (x - gx * 0.6) - damping * vx, az = (aL.x / len) - stiff * (z + gz * 0.6) - damping * vz;
    vx += ax * dt; vz += az * dt; x += vx * dt; z += vz * dt;
    // the front leg pushes the hem forward (it can't pass through the knee)
    if (legsAt) { const L = legsAt(t), front = Math.max(L.l, L.r, 0) * 0.55; if (x < front) { x = front; vx = Math.max(vx, 0); } }
    x = Math.max(-0.6, Math.min(0.6, x)); z = Math.max(-0.4, Math.min(0.4, z));
    if (step % every === 0) frames.push([x, z]);
  }
  return (t) => { const f = Math.max(0, Math.min(frames.length - 1, (t - t0) * store)), i = Math.floor(f), k = f - i, a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    return [a[0] + (b[0] - a[0]) * k + flutter * Math.sin(t * 9.1) * 0.01, a[1] + (b[1] - a[1]) * k]; };
}
