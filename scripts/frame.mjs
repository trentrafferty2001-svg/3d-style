// Project key points through a camera and report where they land on a 9:16 frame (NDC -1..1).
// usage: node frame.mjs '<json [{name,pos:[x,y,z],look:[x,y,z],fov}]>' '<json {label:[x,y,z]}>'
import * as THREE from '/home/claude/deps/three/build/three.module.js';
const cams = JSON.parse(process.argv[2]), pts = JSON.parse(process.argv[3]);
for (const c of cams) {
  const cam = new THREE.PerspectiveCamera(c.fov, 9 / 16, 0.01, 500); cam.position.set(...c.pos); cam.lookAt(...c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const out = Object.entries(pts).map(([k, p]) => { const v = new THREE.Vector3(...p).project(cam); const ok = Math.abs(v.x) < 0.92 && v.y > -0.92 && v.y < 0.9 && v.z < 1; return `${k}:${v.x.toFixed(2)},${v.y.toFixed(2)}${ok ? '' : ' OUT'}`; });
  console.log(c.name, '|', out.join('  '));
}
