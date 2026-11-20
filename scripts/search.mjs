import * as THREE from '/home/claude/deps/three/build/three.module.js';
const [pts, lookBase, opts] = [JSON.parse(process.argv[2]), JSON.parse(process.argv[3]), JSON.parse(process.argv[4] || '{}')];
const best = [];
for (let az = (opts.az0 ?? 90); az <= (opts.az1 ?? 180); az += 5) for (let d = opts.d0 ?? 5; d <= (opts.d1 ?? 13); d += 0.5) for (let h = opts.h0 ?? 1.5; h <= (opts.h1 ?? 4); h += 0.5) for (const fov of opts.fovs ?? [36, 40, 44, 48]) {
  const a = az * Math.PI / 180; const pos = [lookBase[0] + Math.cos(a) * d * -1, h, lookBase[2] + Math.sin(a) * d];
  if (pos[2] < 0.9 && pos[1] < 2.5) continue; // stay over the water / above ground
  const cam = new THREE.PerspectiveCamera(fov, 9 / 16, 0.01, 500); cam.position.set(...pos); cam.lookAt(...lookBase); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  let ok = true; const P = {};
  for (const [k, p] of Object.entries(pts)) { const v = new THREE.Vector3(...p).project(cam); P[k] = v; if (!(Math.abs(v.x) < (opts.mx ?? 0.85) && v.y > -0.88 && v.y < 0.86 && v.z < 1)) ok = false; }
  if (!ok) continue;
  const score = P.head.y - P.feet.y;
  best.push([score, pos.map(x => +x.toFixed(2)), fov, az]);
}
best.sort((a, b) => b[0] - a[0]); console.log(best.slice(0, 8).map(b => JSON.stringify(b)).join('\n'));
