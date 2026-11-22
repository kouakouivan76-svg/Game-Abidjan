/* sky.js — ciel dynamique (dégradé, soleil, lune, étoiles, nuages), lumière du jour et de la nuit */
import { THREE, G, scene, camera, renderer, nightFX, hemi, sun, DAYLEN, C, clamp, lerp, smooth, PI } from './core.js';

const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform vec3 top,bot,sunCol,sunDir; uniform float night; varying vec3 vP;
  void main(){ vec3 d=normalize(vP); float h=clamp(d.y,0.,1.); vec3 c=mix(bot,top,pow(h,.5));
   float s=max(dot(d,normalize(sunDir)),0.); c+=sunCol*(pow(s,900.)*4.+pow(s,10.)*.3);
   float m=max(dot(d,-normalize(sunDir)),0.); c+=vec3(.75,.8,.95)*pow(m,1400.)*3.*night;
   vec3 q=floor(d*70.); float st=step(.9972,fract(sin(dot(q,vec3(12.9898,78.233,45.164)))*43758.5453)); c+=vec3(st)*night*smoothstep(.12,.5,d.y);
   gl_FragColor=vec4(c,1.); }`
}));
dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);

/* nuages */
const cloudTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
const clouds = []; const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: .85 });
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat); m.rotation.x = -PI / 2; const s = 90 + Math.random() * 120; m.scale.set(s, s * (.5 + Math.random() * .3), 1); m.position.set((Math.random() - .5) * 1500, 150 + Math.random() * 60, (Math.random() - .5) * 1500); m.userData.sp = 1.5 + Math.random() * 3; scene.add(m); clouds.push(m); }

const cDayTop = C('#3b82d6'), cDayBot = C('#b5dcf4'), cNightTop = C('#12265a'), cNightBot = C('#36548f'), cSetTop = C('#5b5fa8'), cSetBot = C('#ff9a5a');
const cMoonHemi = C('#8fa8ee'), cMoonGround = C('#4a5f9a'); const plight = new THREE.PointLight(0xffe2b0, 0, 30, 1.6); scene.add(plight);
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
export let night = 0, hour = 8;
export const wallMatRef = { mat: null };

export function updateSky(dt) {
  const t = ((G.time / DAYLEN) + G.startHour) % 1;
  hour = t * 24;
  const ang = (t - .25) * PI * 2, el = Math.sin(ang);
  const dayF = smooth(-.08, .3, el), horiz = Math.exp(-Math.pow(el / .2, 2));
  night = 1 - dayF;
  tmpA.copy(cNightTop).lerp(cDayTop, dayF).lerp(cSetTop, horiz * .6);
  tmpB.copy(cNightBot).lerp(cDayBot, dayF).lerp(cSetBot, horiz * .85);
  const u = dome.material.uniforms; u.top.value.copy(tmpA); u.bot.value.copy(tmpB); u.night.value = clamp(night * 1.2, 0, 1);
  const sd = new THREE.Vector3(Math.cos(ang) * .8, el, .45).normalize(); u.sunDir.value.copy(sd);
  u.sunCol.value.setRGB(1, .85 - horiz * .3, .6 - horiz * .3);
  scene.background = scene.background || new THREE.Color(); scene.background.copy(tmpB); scene.fog.color.copy(tmpB);
  scene.fog.near = lerp(80, 90, dayF); scene.fog.far = lerp(330, 430, dayF);
  hemi.intensity = lerp(1.7, 1.45, dayF); hemi.color.copy(tmpA).lerp(new THREE.Color('#ffffff'), .5 * dayF).lerp(cMoonHemi, night * .85); hemi.groundColor.setRGB(.35, .3, .22).lerp(cMoonGround, night * .85);
  sun.intensity = Math.max(2.3 * night, 2.6 * dayF) * (1 - .2 * horiz); sun.color.setRGB(1, 1 - horiz * .35, .9 - horiz * .5).lerp(new THREE.Color('#9db8ff'), night * .85);
  renderer.toneMappingExposure = 1.05 + night * .5; plight.intensity = 55 * clamp(night * 1.4 - .1, 0, 1); plight.position.set(camera.position.x, 4.5, camera.position.z); if (G.P) { plight.position.x = G.P.x; plight.position.z = G.P.z; plight.position.y = (G.P.y || 0) + 4.5; }
  if (nightFX.pool) { const o = clamp(night * 1.3 - .15, 0, 1); nightFX.pool.opacity = o * 1; nightFX.haloMesh.material.opacity = o * .9; nightFX.haloMesh.quaternion.copy(camera.quaternion); if (nightFX.beam) nightFX.beam.opacity = o * .6; }
  const P = camera.position; dome.position.copy(P);
  for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > P.x + 800) c.position.x = P.x - 800; c.material.opacity = .85 * dayF + .15; }
  if (wallMatRef.mat) wallMatRef.mat.emissiveIntensity = clamp(night * 1.9, 0, 1.8);
  return { night, hour, sd, dayF };
}
export function followSun(px, py, pz, sd) {
  const d = sd.y > .05 ? sd : new THREE.Vector3(.3, .8, .4);
  sun.position.set(px + d.x * 150, py + Math.max(60, d.y * 150), pz + d.z * 150); sun.target.position.set(px, py, pz);
}
export const clockString = () => String(Math.floor(hour)).padStart(2, '0') + ':' + String(Math.floor((hour % 1) * 60)).padStart(2, '0');
