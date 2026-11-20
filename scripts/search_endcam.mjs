// end camera for shot 2: frame head, hips and the bucket (rest + overshoot) with the bucket clear of the face
import * as THREE from '/home/claude/deps/three/build/three.module.js';
const P = { head: [0.5, 2.28, 2.0], chin: [0.5, 2.12, 2.0], hips: [0.5, 1.45, 2.0], bucketRest: [0, 2.62, 2.17], bucketTop: [0, 3.15, 2.3], ropeTop: [0, 3.6, 2.2] };
const best = [];
for (let az = -10; az <= 80; az += 4) for (let d = 2.6; d <= 5.5; d += 0.2) for (let h = 1.6; h <= 3.2; h += 0.2) for (const fov of [30, 34, 38]) {
  const look = [0.28, 2.3, 2.05]; const a = az * Math.PI / 180;
  const pos = [look[0] - Math.cos(a) * d, h, look[2] + Math.sin(a) * d]; if (pos[2] < 0.9) continue; // stay over the water
  const cam = new THREE.PerspectiveCamera(fov, 9 / 16, 0.01, 500); cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const N = {}; let ok = true;
  for (const [k, p] of Object.entries(P)) { const v = new THREE.Vector3(...p).project(cam); N[k] = v; if (k !== 'ropeTop' && !(Math.abs(v.x) < 0.8 && v.y > -0.85 && v.y < 0.85 && v.z < 1)) ok = false; }
  if (!ok) continue;
  const sep = Math.min(Math.abs(N.head.x - N.bucketRest.x), Math.abs(N.head.x - N.bucketTop.x)); if (sep < 0.3) continue;
  // the face looks at the bucket: the camera must be within 50 degrees of that direction for the face to read
  const hd = new THREE.Vector3(...P.head); const face = new THREE.Vector3(...P.bucketRest).sub(hd).setY(0).normalize(); const toCam = new THREE.Vector3(...pos).sub(hd).setY(0).normalize();
  const ang = Math.acos(Math.max(-1, Math.min(1, face.dot(toCam)))) * 57.3; if (ang > 50) continue;
  // face towards camera: the farmer looks at the bucket, so prefer cameras on the bucket's side of him
  const score = (N.head.y - N.hips.y) + sep * 0.3;
  best.push([+score.toFixed(3), pos.map(v => +v.toFixed(2)), fov, az, +sep.toFixed(2), +ang.toFixed(0)]);
}
best.sort((a, b) => b[0] - a[0]); console.log(best.slice(0, 6).map(b => JSON.stringify(b)).join('\n'));
