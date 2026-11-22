import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from './GTAOPass.js'; // local copy: its ../math import is missing on the render farm
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { SHOTS, CAPTIONS, DURATION, FADES } from './shots_dm.js';
import * as SHX from './shots_dm.js';
// Per-video look settings a shots file can export: STYLE = { shadow: 'pcf'|'vsm'|'soft', mb: samples, shutter: 0..1, exposure, grain: 0..0.05 }
const STYLE = SHX.STYLE || {};
// v1.2: bump mapping builds its normal from screen-space derivatives, which degenerate on a face seen exactly edge-on
// (fDet -> 0): the bumped normal swung far from the surface and a few MSAA samples on the top of a door lintel lit up
// to extreme values, a row of white dots after the highlight cap. Blend back to the true normal whenever the bumped one
// tilts more than ~65-80 degrees away (ordinary bumps stay well inside that).
{
  const from = 'return normalize( abs( fDet ) * surf_norm - vGrad );';
  if (!THREE.ShaderChunk.bumpmap_pars_fragment.includes(from)) throw new Error('bump guard: three.js bump chunk changed');
  THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment.replace(from,
    'vec3 nB = normalize( abs( fDet ) * surf_norm - vGrad ); if ( abs( fDet ) < 1e-3 || any( isnan( nB ) ) || any( isinf( nB ) ) ) return surf_norm; return normalize( mix( surf_norm, nB, smoothstep( 0.15, 0.45, dot( nB, surf_norm ) ) ) );');
}
import { TIME, skyMaterial as outdoorSky, SKY_PRESETS } from './world.js';

const RES = Number(new URLSearchParams(location.search).get('res') || 720);
const W = RES, H = Math.round(RES * 16 / 9);
{ const st = document.getElementById('stage'); st.style.width = W + 'px'; st.style.height = H + 'px'; document.documentElement.style.setProperty('--s', String(W / 720)); }
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
// PCFSoftShadowMap ignores light.shadow.radius; 'pcf' honours it (soft edges you can tune per light), 'vsm' is softest.
renderer.shadowMap.type = ({ pcf: THREE.PCFShadowMap, vsm: THREE.VSMShadowMap })[STYLE.shadow] ?? THREE.PCFSoftShadowMap;
document.getElementById('stage').prepend(renderer.domElement);

// ---------- studio sky (kept for the underwater shots) ----------
const SKY_FRAG = `
  uniform vec3 top, mid, horizon, floorC; varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 c = y > 0.0 ? mix(mix(horizon, mid, smoothstep(0.0,0.12,y)), top, smoothstep(0.1,0.8,y))
                     : mix(horizon, floorC, smoothstep(0.0,-0.08,y));
    gl_FragColor = vec4(c,1.0);
    #include <colorspace_fragment>
  }`;
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x2b78d6) }, mid: { value: new THREE.Color(0x5b9fea) },
      horizon: { value: new THREE.Color(0x92c3f2) }, floorC: { value: new THREE.Color(0xa9cdf1) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = (modelMatrix*vec4(position,1.)).xyz - cameraPosition; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, toneMapped: false,
  });
}
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
{
  const s = new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), skyMaterial());
  s.material.toneMapped = true; envScene.add(s);
  const u = s.material.uniforms;
  u.top.value.set(0x9aa6b6); u.mid.value.set(0xb7c2cf); u.horizon.value.set(0xe2e6ea); u.floorC.value.set(0x5c6066);
  const panel = (w, h, pos, inten) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(inten, inten, inten), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(8, 4, [-6, 8, 6], 3.2); panel(4, 10, [9, 3, -2], 1.6); panel(10, 3, [0, 4, -9], 1.0);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x55595f }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = -1.2; envScene.add(fl);
}
const envTex = pmrem.fromScene(envScene, 0.02).texture;

// ---------- outdoor environment: reflections + ambient light come from the same sky ----------
const envCache = new Map();
function outdoorEnv(key, P, sun) {
  if (envCache.has(key)) return envCache.get(key);
  const s = new THREE.Scene();
  const mat = outdoorSky({ sun, ...P, disk: 7.0 });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 96, 48), mat));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(38, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.ground).multiplyScalar(0.6) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -3; s.add(ground);
  const tex = pmrem.fromScene(s, 0.0, 0.1, 100).texture;
  envCache.set(key, tex);
  return tex;
}

export function makeStage({ shadowSize = 3, sunDir = [-3, 6, 4], sun = 2.3, outdoor = null, fog = 0.0, envI = 0.8, shadowAt = [0, 0, 0], cloud = null, hemi = 0.35 } = {}) {
  const scene = new THREE.Scene();
  scene.userData.updaters = [];
  if (outdoor) {
    const P = { ...SKY_PRESETS[outdoor] };
    if (cloud != null) P.cloud = cloud;
    const sd = new THREE.Vector3(...sunDir).normalize();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 32), outdoorSky({ sun: sd, ...P }));
    sky.frustumCulled = false; sky.renderOrder = -10;
    scene.add(sky); scene.userData.sky = sky; scene.userData.sunDir = sd;
    scene.environment = outdoorEnv(outdoor + sunDir.join(',') + P.cloud, P, sd);
    scene.environmentIntensity = envI;
    if (fog > 0) scene.fog = new THREE.FogExp2(new THREE.Color(P.haze), fog);
    const h = new THREE.HemisphereLight(0xbcd6ff, 0x5c5030, hemi); scene.add(h);
    const key = new THREE.DirectionalLight(new THREE.Color(P.sunColor), P.sunI);
    key.position.copy(sd).multiplyScalar(30).add(new THREE.Vector3(...shadowAt));
    key.target.position.set(...shadowAt);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera; c.left = c.bottom = -shadowSize; c.right = c.top = shadowSize; c.near = 1; c.far = 80;
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
    scene.add(key, key.target);
    scene.userData.key = key;
    return scene;
  }
  scene.environment = envTex;
  scene.environmentIntensity = 1.0;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), skyMaterial());
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky); scene.userData.sky = sky;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: 0x1a3a66, opacity: 0.32 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const hemiL = new THREE.HemisphereLight(0xcfe4ff, 0x7f93ad, 0.75); scene.add(hemiL);
  const key = new THREE.DirectionalLight(0xfff3e6, sun);
  key.position.set(...sunDir); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  const c = key.shadow.camera; c.left = c.bottom = -shadowSize; c.right = c.top = shadowSize; c.near = 0.5; c.far = 30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xdbe9ff, 1.2); rim.position.set(4, 3, -5); scene.add(rim);
  scene.userData.key = key;
  return scene;
}

// ---------- post ----------
const QS0 = new URLSearchParams(location.search);
window.QS0 = QS0; window.DBG = QS0.has('dbg');
const rt = new THREE.WebGLRenderTarget(W, H, { samples: Number(QS0.get('samples') || 4), type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const dummyScene = new THREE.Scene(), dummyCam = new THREE.PerspectiveCamera();
const renderPass = new RenderPass(dummyScene, dummyCam);
const bokeh = new BokehPass(dummyScene, dummyCam, { focus: 2, aperture: 0.002, maxblur: 0.01 });
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.25, 0.5, 1.2);
// film grain (v1.1): fine monochrome grain, strongest in the midtones, new every output frame. Applied once per output
// frame (after the motion-blur average), so it looks the same at any mb. STYLE.grain sets the strength (0 = off).
const GRAIN_GLSL = `vec3 filmGrain(vec3 col, vec2 px, float t, float amt) {
    if (amt <= 0.0) return col;
    vec2 q = px + vec2(floor(t * 30.0 + 0.5) * 17.0, floor(t * 30.0 + 0.5) * 29.0);
    float n = fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453) + fract(sin(dot(q + 0.37, vec2(39.3468, 11.135))) * 24634.6345) - 1.0; // triangular, -1..1
    float l = dot(clamp(col, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
    return col + n * amt * (0.35 + 2.6 * l * (1.0 - l)); }`;
const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.3 }, uWhip: { value: 0 },
    uSun: { value: new THREE.Vector2(0.5, 0.5) }, uFlare: { value: 0 }, uWarm: { value: 1 }, uSat: { value: 1.12 }, uRes: { value: RES / 720 }, uGrain: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uWhip, uFlare, uWarm, uSat, uRes, uGrain; uniform vec2 uSun; varying vec2 vUv;
    ${GRAIN_GLSL}
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.13) * 43758.5453); }
    vec3 ghost(vec2 uv, vec2 c, float r, vec3 col){ vec2 d = (uv - c); d.x *= 0.5625; float k = 1.0 - smoothstep(r*0.7, r, length(d)); return col * k; }
    void main(){ vec4 c = vec4(0.0);
      if (abs(uWhip) > 0.001) { for (int i = -8; i <= 8; i++) c += texture2D(tDiffuse, vUv + vec2(float(i) * uWhip * 0.012, 0.0)); c /= 17.0; c.rgb *= 1.0 + abs(uWhip) * 0.25; }
      else c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // grade: cool shadows, warm highlights, a little more colour and contrast
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.93, 1.0, 1.07), (1.0 - l) * 0.45 * uWarm);
      col = mix(col, col * vec3(1.06, 1.01, 0.92), l * 0.5 * uWarm);
      col = mix(vec3(l), col, uSat);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.32);
      // sun flare
      if (uFlare > 0.001) {
        vec2 d = vUv - uSun; d.x *= 0.5625;
        float r = length(d);
        col += vec3(1.0, 0.85, 0.6) * (exp(-r * 9.0) * 0.35 + exp(-r * 40.0) * 0.5) * uFlare;
        col += vec3(1.0, 0.8, 0.55) * exp(-abs(d.y) * 220.0) * exp(-abs(d.x) * 5.0) * 0.18 * uFlare;
        vec2 axis = vec2(0.5) - uSun;
        col += ghost(vUv, uSun + axis * 0.7, 0.05, vec3(0.25, 0.32, 0.18)) * uFlare * 0.35;
        col += ghost(vUv, uSun + axis * 1.25, 0.09, vec3(0.18, 0.12, 0.3)) * uFlare * 0.3;
        col += ghost(vUv, uSun + axis * 1.6, 0.03, vec3(0.3, 0.25, 0.15)) * uFlare * 0.4;
      }
      vec2 q = vUv - 0.5; q.x *= 0.5625;
      col *= 1.0 - uVig * smoothstep(0.2, 0.66, length(q));
      vec2 px = floor(vUv * vec2(720.0, 1280.0) * uRes);
      col += (fract(dot(px, vec2(0.7548777, 0.5698403))) - 0.5) / 255.0;
      col = filmGrain(col, px, uTime, uGrain);
      gl_FragColor = vec4(col, 1.0); }`,
});
composer.addPass(renderPass);
// ambient occlusion: soft contact shadows where objects meet (biggest single fix for the flat, 'floating' look)
const gtao = new GTAOPass(dummyScene, dummyCam, W, H);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = 1.0;
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 12 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
gtao.enabled = !QS0.has('noao');
// keep sprites, glows, sky domes and other no-depth effects out of the AO buffers (they produced dark seams)
gtao.overrideVisibility = function () {
  const cache = this._visibilityCache;
  this.scene.traverse((o) => {
    cache.set(o, o.visible);
    const m = o.material;
    if (o.isPoints || o.isLine || o.isSprite || (m && !Array.isArray(m) && (m.depthWrite === false || m.blending === THREE.AdditiveBlending))) o.visible = false;
  });
};
composer.addPass(gtao);
composer.addPass(bokeh);
// sanitise HDR before bloom: a single NaN/Inf pixel (degenerate normal, tiny cap triangle) otherwise blooms into a
// white blotch for a frame. Bad pixels take the average of their valid neighbours; highlights are capped.
const sanitize = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uPx: { value: new THREE.Vector2(1 / W, 1 / H) }, uMax: { value: 24.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPx; uniform float uMax; varying vec2 vUv;
    bool bad(vec4 c){ return any(isnan(c)) || any(isinf(c)) || max(max(c.r, c.g), c.b) > 6.0e4; }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c)) { vec4 s = vec4(0.0); float n = 0.0;
        for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) { vec4 q = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * uPx); if (!bad(q)) { s += q; n += 1.0; } }
        c = n > 0.0 ? s / n : vec4(0.0, 0.0, 0.0, 1.0); }
      gl_FragColor = vec4(min(max(c.rgb, 0.0), vec3(uMax)), c.a); }`,
});
composer.addPass(sanitize);
// god rays (v1.12, the optional part of backlog item 6): light shafts from the sun through gaps (between columns, palm
// fronds, a doorway). A radial blur of the brightest light towards the sun's place on screen, in HDR before bloom, so it
// takes the real sky and sun. Off unless a shot returns { rays: 0..1 } and the sun is near the frame.
const rays = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.8) }, uRays: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uRays, uAspect; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = (uSun - vUv) / 56.0; vec2 p = vUv; vec3 acc = vec3(0.0); float w = 1.0;
      for (int i = 0; i < 56; i++) { p += d; vec3 q = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb; float l = dot(q, vec3(0.299, 0.587, 0.114));
        acc += q * smoothstep(2.6, 7.0, l) * w; w *= 0.965; }   // only the sun and its glow: a lower threshold washed the whole sky
      vec2 off = (vUv - uSun) * vec2(uAspect, 1.0);
      float fall = exp(-length(off) * 1.6);                            // strongest near the sun
      gl_FragColor = vec4(c.rgb + acc / 56.0 * uRays * 2.2 * fall * vec3(1.0, 0.92, 0.78), c.a); }`,
});
rays.enabled = false;
composer.addPass(rays);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(grade);

// ---------- timeline ----------
const capEl = document.getElementById('cap');
const fadeEl = document.getElementById('fade');
const hud = document.getElementById('hud');
const built = new Map();
function getShot(i) {
  if (!built.has(i)) built.set(i, SHOTS[i].build({ makeStage, W, H, start: SHOTS[i].start }));
  return built.get(i);
}
const capHTML = (s) => s.replace(/\*(.+?)\*/g, '<span class="hl">$1</span>');
let lastCap = null;

window.DURATION = DURATION; window.CUTS = SHOTS.slice(1).map(s => s.start); // for qa.py (cut times can be formulas)
// ---------- motion blur + antialiasing by sub-frame accumulation ----------
// mb = number of sub-frames per output frame (1 = off, the old look). Each sub-frame is rendered at a slightly
// different time inside the shutter (180 degrees = half a frame) and with a sub-pixel camera jitter, then averaged
// in linear light. Result: real motion blur on everything that moves, supersampled edges, smoother AO and shadows.
const MB = Number(QS0.get('mb') || STYLE.mb || 1);
const FPS = Number(QS0.get('fps') || 24);
const SHUTTER = Number(QS0.get('shutter') || STYLE.shutter || 0.5);
const GRAIN = QS0.has('grain') ? Number(QS0.get('grain')) : (STYLE.grain ?? 0.022);
grade.uniforms.uGrain.value = MB <= 1 ? GRAIN : 0;
const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const accQuad = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uW: { value: 1 } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uW; varying vec2 vUv;
    void main(){ vec3 c = max(texture2D(tDiffuse, vUv).rgb, 0.0); gl_FragColor = vec4(pow(c, vec3(2.2)) * uW, 1.0); }`,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  depthTest: false, depthWrite: false, transparent: true,
}));
const outQuad = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: accRT.texture }, uTime: { value: 0 }, uGrain: { value: GRAIN }, uRes: { value: RES / 720 } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uRes; varying vec2 vUv;
    ${GRAIN_GLSL}
    void main(){ vec3 c = pow(max(texture2D(tDiffuse, vUv).rgb, 0.0), vec3(1.0 / 2.2));
      gl_FragColor = vec4(filmGrain(c, floor(vUv * vec2(720.0, 1280.0) * uRes), uTime, uGrain), 1.0); }`,
  depthTest: false, depthWrite: false,
}));
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const _cc = new THREE.Color();

function drawScene(t, idx, jit) {
  const def = SHOTS[idx];
  const shot = getShot(idx);
  const lt = t - def.start;  TIME.value = t;
  const r = shot.update(lt, t) || {};
  for (const u of shot.scene.userData.updaters || []) u(t, lt);
  const cam = shot.camera;
  cam.aspect = W / H; cam.updateProjectionMatrix();
  if (jit) cam.setViewOffset(W, H, jit[0], jit[1], W, H);
  shot.scene.userData.sky.position.copy(cam.position);
  renderPass.scene = bokeh.scene = gtao.scene = shot.scene;
  renderPass.camera = bokeh.camera = gtao.camera = cam;
  if (!QS0.has('noao')) { gtao.enabled = r.ao !== 0; gtao.blendIntensity = r.ao ?? 1.0; if (r.aoRadius) gtao.updateGtaoMaterial({ radius: r.aoRadius }); }
  const dof = r.dof || { focus: 3, aperture: 0, maxblur: 0 };
  bokeh.enabled = dof.aperture > 0 && !QS0.has('nodof');
  bokeh.uniforms.focus.value = dof.focus;
  // softer depth of field: the old settings smeared whole close-ups into mush
  bokeh.uniforms.aperture.value = dof.aperture * 0.5;
  bokeh.uniforms.maxblur.value = Math.min(0.006, dof.maxblur ?? 0.012);
  bokeh.uniforms.nearClip.value = cam.near; bokeh.uniforms.farClip.value = cam.far;
  bloom.strength = (r.bloom ?? 0.35) * 0.45; // gentler glow: the old value washed sunsets out to white
  renderer.toneMappingExposure = r.exposure ?? 1.0;
  grade.uniforms.uTime.value = t;
  grade.uniforms.uWarm.value = r.warm ?? 1.0;
  grade.uniforms.uSat.value = r.sat ?? 1.2;
  // lens flare toward the sun when it is on screen
  let flare = 0;
  if (r.flare && shot.scene.userData.sunDir) {
    const p = cam.position.clone().addScaledVector(shot.scene.userData.sunDir, 300).project(cam);
    if (p.z < 1 && Math.abs(p.x) < 1.3 && Math.abs(p.y) < 1.3) {
      grade.uniforms.uSun.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      const m = Math.max(Math.abs(p.x), Math.abs(p.y));
      flare = 0.45 * r.flare * Math.min(1, Math.max(0, 1 - (m - 0.85) / 0.45));
    }
  }
  grade.uniforms.uFlare.value = Math.max(0, flare);
  rays.enabled = false;
  if (r.rays && shot.scene.userData.sunDir) {
    const p = cam.position.clone().addScaledVector(shot.scene.userData.sunDir, 300).project(cam);
    const m = Math.max(Math.abs(p.x), Math.abs(p.y));
    if (p.z < 1 && m < 1.8) { rays.enabled = true; rays.uniforms.uSun.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      rays.uniforms.uRays.value = r.rays * Math.min(1, Math.max(0, (1.8 - m) / 0.6)); rays.uniforms.uAspect.value = W / H; }
  }
  let whip = 0;
  if (QS0.has('whip')) SHOTS.forEach((s, i) => { if (i === 0) return; const d = (t - s.start) / 0.07; const w = Math.exp(-d * d); if (w > Math.abs(whip)) whip = (i % 2 ? 1 : -1) * w; });
  grade.uniforms.uWhip.value = whip;
  if (shot.scene.userData.caustic) shot.scene.userData.caustic.uniforms.uTime.value = t;
  // per-(sub)frame passes a scene needs before its main render (e.g. planar water reflections)
  for (const f of shot.scene.userData.prerender || []) f(renderer, shot.scene, cam);
  composer.render();
  if (jit) cam.clearViewOffset();
  return shot;
}

// adaptive motion blur (v1.12, backlog item 9): how many sub-frames a frame needs depends on how far things move on
// screen during the shutter. Pose the shot at the shutter's start and end (cheap: no render), project a sample of
// points (every bone, and the centre of every mesh) and take the largest move in pixels: one sub-frame per MB_PX pixels,
// at least MB_MIN (edges still need a few jittered sub-frames) and at most MB. Still shots render 2-3x faster; fast
// ones keep the full count. ?mbfixed (or STYLE.mbFixed) turns it off.
const MB_MIN = Number(QS0.get('mbmin') || STYLE.mbMin || 3), MB_PX = Number(QS0.get('mbpx') || STYLE.mbPx || 1.6);
const MB_ADAPT = !(QS0.has('mbfixed') || STYLE.mbFixed);
const _mbPts = new Map(), _mbV = new THREE.Vector3();
function mbSamples(shot) {
  if (_mbPts.has(shot)) return _mbPts.get(shot);
  const sky = shot.scene.userData.sky, objs = []; shot.scene.traverse(o => { if (o.isBone || (o.isMesh && o !== sky && o.visible)) objs.push(o); }); // the sky rides with the camera
  const step = Math.max(1, Math.floor(objs.length / 600)), list = objs.filter((_, i) => i % step === 0);
  _mbPts.set(shot, list); return list;
}
function mbProject(shot, t, def) {
  const lt = t - def.start; TIME.value = t; shot.update(lt, t); for (const u of shot.scene.userData.updaters || []) u(t, lt);
  const cam = shot.camera; cam.aspect = W / H; cam.updateProjectionMatrix(); shot.scene.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  return mbSamples(shot).map(o => { o.getWorldPosition(_mbV).project(cam); return [_mbV.x, _mbV.y, _mbV.z]; });
}
function mbFor(t, idx, def, span) {
  if (!MB_ADAPT || MB <= MB_MIN) return MB;
  const shot = getShot(idx), t0 = Math.max(def.start, t - span / 2), t1 = Math.min(def.end - 1e-4, t + span / 2);
  const a = mbProject(shot, t0, def), b = mbProject(shot, t1, def);
  // only points on screen at both ends (off-screen points project to huge, meaningless coordinates); pixels at 1080x1920
  const on = (p) => Math.abs(p[0]) <= 1.05 && Math.abs(p[1]) <= 1.05 && Math.abs(p[2]) < 1;
  let px = 0; for (let i = 0; i < a.length; i++) if (on(a[i]) && on(b[i])) px = Math.max(px, Math.hypot((b[i][0] - a[i][0]) * 540, (b[i][1] - a[i][1]) * 960));
  const n = Math.max(MB_MIN, Math.min(MB, Math.ceil(px / MB_PX)));
  window._mbLast = { t, px, n }; return n;
}

window.renderAt = (t) => {
  let idx = SHOTS.findIndex(s => t >= s.start && t < s.end);
  if (idx < 0) idx = SHOTS.length - 1;
  const def = SHOTS[idx];
  if (MB <= 1) { composer.renderToScreen = true; drawScene(t, idx, null); }
  else {
    composer.renderToScreen = false;
    renderer.getClearColor(_cc); const ca = renderer.getClearAlpha();
    renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.setClearColor(_cc, ca);
    const span = SHUTTER / FPS, n = mbFor(t, idx, def, span);
    for (let i = 0; i < n; i++) {
      // sub-frame time, kept inside the current shot so a cut never blends two shots
      const ts = Math.min(def.end - 1e-4, Math.max(def.start, t + ((i + 0.5) / n - 0.5) * span));
      drawScene(ts, idx, [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5]);
      accQuad.material.uniforms.tDiffuse.value = composer.readBuffer.texture;
      accQuad.material.uniforms.uW.value = 1 / n;
      // autoClear would wipe the accumulation buffer before every add
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(accRT); accQuad.render(renderer);
      renderer.autoClear = ac;
    }
    renderer.setRenderTarget(null); outQuad.material.uniforms.uTime.value = t; outQuad.render(renderer);
    TIME.value = t;
  }
  // captions: pop in, highlighted keywords
  const c = CAPTIONS.filter(c => t >= c[0]).pop();
  const on = c && (c[2] == null || t < c[2]);
  if (on) {
    if (lastCap !== c[1]) { capEl.innerHTML = capHTML(c[1]); lastCap = c[1]; }
    const age = t - c[0];
    const s = age < 0.07 ? lerp(0.55, 1.14, age / 0.07) : age < 0.16 ? lerp(1.14, 1.0, (age - 0.07) / 0.09) : 1.0;
    capEl.style.transform = `scale(${s.toFixed(3)})`;
    capEl.style.opacity = Math.min(1, age / 0.04 + 0.2).toFixed(2);
  } else { capEl.innerHTML = ''; lastCap = null; }
  let f = 0;
  // no dip-to-black at the first cut (it read as a 2-3 frame black flash); ?fades brings it back
  if (QS0.has('fades')) for (const [a, b, c2, d] of FADES) if (t >= a && t < d) f = Math.max(f, t < b ? (t - a) / (b - a) : t < c2 ? 1 : (d - t) / (d - c2));
  fadeEl.style.opacity = f;
  hud.textContent = `t=${t.toFixed(2)} shot ${idx}`;
  return idx;
};
function lerp(a, b, k) { return a + (b - a) * Math.min(1, Math.max(0, k)); }

// interactive preview: ?t=12.3 for a still, otherwise realtime playback
const qs = new URLSearchParams(location.search);
window.ready = document.fonts.ready.then(() => true);
if (qs.has('t')) window.ready.then(() => window.renderAt(parseFloat(qs.get('t'))));
else if (!qs.has('render')) {
  const audio = new Audio('./audio.m4a');
  let t0 = null;
  document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); t0 = performance.now(); });
  const loop = () => { const t = t0 ? ((performance.now() - t0) / 1000) % DURATION : 0; window.renderAt(t); requestAnimationFrame(loop); };
  window.ready.then(loop);
}
