// ============================================================
//  country.7mit — scene Negara 3D (kota, bangunan, siang-malam)
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { BIOME, BUILDINGS } from './data.js';
import { GRID, isCoastal } from './sim.js';

const STEP = 5, PAD = 4.1, Y0 = 0.78, RY = 0.705;         // jarak plot, ukuran pad, tinggi permukaan pad
const pc = (i) => (i - 3) * STEP;
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// ---------- partikel ----------
class Particles {
  constructor(scene, max = 1600) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grow = new Float32Array(max); this.grav = new Float32Array(max); this.size0 = new Float32Array(max); this.a0 = new Float32Array(max);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*(260./-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d)*vA; if(a<.01) discard; gl_FragColor=vec4(vC,a); }`,
    });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, color, size, life, grow = 1, grav = 0, alpha = 0.6) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    this.pos.set([x, y, z], k * 3); this.vel.set([vx, vy, vz], k * 3);
    const c = new THREE.Color(color); this.col.set([c.r, c.g, c.b], k * 3);
    this.life[k] = life; this.maxLife[k] = life; this.size0[k] = size; this.grow[k] = grow; this.grav[k] = grav; this.a0[k] = alpha; this.size[k] = size; this.alpha[k] = alpha;
  }
  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.alpha[k] = 0; continue; }
      this.life[k] -= dt; const t = 1 - this.life[k] / this.maxLife[k];
      this.vel[k * 3 + 1] -= this.grav[k] * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.size[k] = this.size0[k] * (1 + t * (this.grow[k] - 1)); this.alpha[k] = this.a0[k] * (1 - t) * Math.min(1, t * 8);
    }
    const g = this.pts.geometry; g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = g.attributes.aColor.needsUpdate = true;
  }
}

export class Nation {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1200);
    this.camera.position.set(34, 30, 40);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 9, maxDistance: 85, maxPolarAngle: 1.47, panSpeed: 0.7, rotateSpeed: 0.55, zoomSpeed: 0.7 });
    this.controls.target.set(0, 2, 0);
    this.tod = 0.3; this.todSpeed = 1 / 110; this.clock = 0;
    this.slots = new Map(); this.animators = []; this.cars = []; this.nightMats = []; this.emitters = [];
    this.raycaster = new THREE.Raycaster(); this.hover = null; this.selected = null;
    this.blackout = 0; this.pollution = 0; this.infra = 50; this.rainAmt = 0; this.rainTarget = 0;
    this.pickables = new THREE.Group(); this.scene.add(this.pickables);
    this._lights(); this._textures(); this._sky(); this._water(); this._ui();
    this.particles = new Particles(this.scene);
    this.worldGroup = new THREE.Group(); this.scene.add(this.worldGroup);
    this._rain();
  }

  // ---------- util materi ----------
  M(color, o = {}) { const k = color + JSON.stringify(o); this._mc = this._mc || {}; return this._mc[k] || (this._mc[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o })); }
  facade(color) {
    this._fc = this._fc || {};
    if (!this._fc[color]) {
      const m = new THREE.MeshStandardMaterial({ color, map: this.winTex, emissiveMap: this.winEmit, emissive: 0xffd08a, emissiveIntensity: 0, roughness: 0.55, metalness: 0.1 });
      this._fc[color] = m; this.nightMats.push(m);
    }
    return this._fc[color];
  }
  _textures() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const e = document.createElement('canvas'); e.width = e.height = 128; const y = e.getContext('2d');
    x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, 128, 128); y.fillStyle = '#000'; y.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      const px = k * 32 + 6, py = r * 32 + 6;
      x.fillStyle = '#4b6b8f'; x.fillRect(px, py, 20, 20); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px, py, 20, 6);
      if (Math.random() < 0.62) { y.fillStyle = Math.random() < 0.5 ? '#ffd48a' : '#fff0c8'; y.fillRect(px, py, 20, 20); }
    }
    this.winTex = new THREE.CanvasTexture(c); this.winEmit = new THREE.CanvasTexture(e);
    for (const t of [this.winTex, this.winEmit]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    // marka jalan
    const d = document.createElement('canvas'); d.width = 64; d.height = 8; const dc = d.getContext('2d'); dc.fillStyle = '#34363b'; dc.fillRect(0, 0, 64, 8); dc.fillStyle = '#e8e8e8'; dc.fillRect(8, 3, 24, 2);
    this.roadTex = new THREE.CanvasTexture(d); this.roadTex.wrapS = THREE.RepeatWrapping; this.roadTex.colorSpace = THREE.SRGBColorSpace; this.roadTex.anisotropy = 4;
    // flag
    this.flagTex = new THREE.CanvasTexture(document.createElement('canvas'));
  }
  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x6b8a50, 0.7); s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 160; this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);
    this.moonL = new THREE.DirectionalLight(0x8fb0ff, 0); s.add(this.moonL);
    this.fog = new THREE.FogExp2(0xbfdcff, 0.004); s.fog = this.fog;
  }
  _sky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x3d7fd6) }, bot: { value: new THREE.Color(0xbfdcff) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xffffff) } },
      vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top,bot,sunCol,sunDir; varying vec3 vP; void main(){ float h=clamp(vP.y,0.,1.); vec3 c=mix(bot,top,pow(h,0.55)); float s=max(dot(normalize(vP),normalize(sunDir)),0.); c+=sunCol*(pow(s,40.)*0.9+pow(s,6.)*0.25); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat); this.scene.add(this.sky);
    const n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.95 + 0.04; v.normalize().multiplyScalar(560); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.scene.add(this.stars);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })); this.scene.add(this.sunDisc);
    this.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })); this.scene.add(this.moonDisc);
    // awan
    this.clouds = new THREE.Group(); const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92, fog: false, emissive: 0x000000 }); this.cloudMat = cm;
    const r = rng(5);
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group(); const k = 4 + Math.floor(r() * 4);
      for (let j = 0; j < k; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(3 + r() * 4, 10, 8), cm); s.position.set(j * 4 - k * 2 + r() * 2, r() * 2, r() * 4); s.scale.y = 0.55; g.add(s); }
      g.position.set((r() - 0.5) * 300, 55 + r() * 25, (r() - 0.5) * 300); g.userData.sp = 0.8 + r() * 1.2; this.clouds.add(g);
    }
    this.scene.add(this.clouds);
  }
  _water() {
    const g = new THREE.PlaneGeometry(700, 700, 90, 90); g.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshPhysicalMaterial({ color: 0x1b7fb8, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1 });
    this.water = new THREE.Mesh(g, this.waterMat); this.water.receiveShadow = true; this.water.position.y = 0; this.scene.add(this.water);
    this.waterBase = g.attributes.position.array.slice();
    // dasar laut
    this.seabed = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0f3b57, roughness: 1 })); this.seabed.position.y = -6; this.scene.add(this.seabed);
  }
  _ui() {
    const sq = new THREE.RingGeometry(2.95, 3.3, 4, 1); sq.rotateZ(Math.PI / 4); sq.rotateX(-Math.PI / 2);
    this.hoverRing = new THREE.Mesh(sq, new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); this.hoverRing.visible = false; this.hoverRing.position.y = Y0 + 0.05;
    this.selRing = new THREE.Mesh(sq, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95, depthWrite: false, fog: false })); this.selRing.visible = false; this.selRing.position.y = Y0 + 0.07;
    this.scene.add(this.hoverRing, this.selRing);
  }
  _rain() {
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 120, Math.random() * 50, (Math.random() - 0.5) * 120], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd7ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.0, depthWrite: false })); this.rain.frustumCulled = false; this.scene.add(this.rain);
  }

  // ---------- inisialisasi negara ----------
  setup(S) {
    this.S = S; this.cn = S.cn; const bm = BIOME[S.cn.biome]; this.bm = bm;
    // bersihkan
    for (const k of [...this.worldGroup.children]) { this.worldGroup.remove(k); k.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
    for (const v of this.slots.values()) { this.pickables.remove(v.pad); if (v.group) this.pickables.remove(v.group); if (v.plus) this.worldGroup.remove(v.plus); }
    this.slots.clear(); this.animators = []; this.cars = []; this.emitters = [];
    if (this.palace) { this.pickables.remove(this.palace); }
    this._terrain(bm); this._roads(); this._pads(S); this._palace(S.cn); this._scenery(bm); this._cars(); this._ships(); this.sync(S);
    this.water.material.color.set(S.cn.biome === 'arctic' ? 0x2f86a8 : S.cn.biome === 'desert' ? 0x1d9fb0 : 0x1b7fb8);
    this.controls.target.set(0, 2, 0); this.camera.position.set(34, 30, 40);
  }
  heightAt(x, z) {
    const d = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
    const n = fbm(x * 0.07 + 11, z * 0.07 + 3), edge = 32 + n * 8 - 4;
    const flat = 24.5;
    let h = 0.68 - smooth(flat, edge, d) * 3.6;
    const hills = Math.pow(fbm(x * 0.09 + 40, z * 0.09 + 90), 2.2) * 26 * smooth(flat + 1, flat + 11, d) * (1 - smooth(edge + 6, edge + 22, d));
    h += hills;
    return h;
  }
  _terrain(bm) {
    const g = new THREE.PlaneGeometry(130, 130, 170, 170); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), grass = new THREE.Color(bm.grass), hill = new THREE.Color(bm.hill), sand = new THREE.Color(bm.sand), rock = new THREE.Color(0x8a8a86), snow = new THREE.Color(0xf4f8fb), wet = new THREE.Color(0xa89a70);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = this.heightAt(x, z); p.setY(i, h);
      const nn = vnoise(x * 0.5, z * 0.5);
      if (h < 0.05) c.copy(wet); else if (h < 0.32) c.copy(sand); else if (h < 0.55) c.copy(sand).lerp(grass, (h - 0.32) / 0.23);
      else if (h < 5) c.copy(grass).lerp(hill, Math.min(1, Math.max(0, (h - 0.7) / 4)));
      else c.copy(hill).lerp(rock, Math.min(1, (h - 5) / 5));
      if (bm.snow && h > 5.5) c.lerp(snow, Math.min(1, (h - 5.5) / 2));
      c.offsetHSL(0, 0, (nn - 0.5) * 0.06); cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    this.terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
    this.terrain.receiveShadow = true; this.terrain.castShadow = true; this.worldGroup.add(this.terrain);
  }
  _roads() {
    const dash = this.roadTex.clone(); dash.needsUpdate = true; dash.repeat.set(36 / 2, 1); dash.wrapS = THREE.RepeatWrapping;
    const rm = new THREE.MeshStandardMaterial({ map: dash, roughness: 0.9 });
    const geo = new THREE.PlaneGeometry(37, 0.9); geo.rotateX(-Math.PI / 2);
    for (let k = 0; k < GRID + 1; k++) {
      const v = -17.5 + k * STEP;
      const a = new THREE.Mesh(geo, rm); a.position.set(0, RY, v); a.receiveShadow = true; this.worldGroup.add(a);
      const b = new THREE.Mesh(geo, rm); b.rotation.y = Math.PI / 2; b.position.set(v, RY + 0.005, 0); b.receiveShadow = true; this.worldGroup.add(b);
    }
    // lampu jalan (instanced)
    const n = (GRID + 1) * (GRID + 1);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), this.M(0x444a52), n);
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd27a, emissiveIntensity: 0 });
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), this.lampMat, n);
    const m = new THREE.Matrix4(); let q = 0;
    for (let a = 0; a < GRID + 1; a++) for (let b = 0; b < GRID + 1; b++) {
      const x = -17.5 + a * STEP + 0.5, z = -17.5 + b * STEP + 0.5;
      m.makeTranslation(x, RY + 0.65, z); pole.setMatrixAt(q, m); m.makeTranslation(x, RY + 1.35, z); bulb.setMatrixAt(q, m); q++;
    }
    pole.castShadow = true; this.worldGroup.add(pole, bulb);
  }
  _pads(S) {
    this.padGeo = this.padGeo || new THREE.BoxGeometry(PAD, 0.16, PAD);
    this.plusGeo = this.plusGeo || new THREE.BoxGeometry(0.9, 0.12, 0.2);
    for (const p of S.plots) {
      const pad = new THREE.Mesh(this.padGeo, new THREE.MeshStandardMaterial({ color: 0xc7ccd1, roughness: 0.9 }));
      pad.position.set(pc(p.i), Y0 - 0.08, pc(p.j)); pad.receiveShadow = true; pad.userData.key = p.i + ',' + p.j; pad.userData.shared = true;
      this.pickables.add(pad);
      const plus = new THREE.Group(); const pm = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, fog: false });
      const a = new THREE.Mesh(this.plusGeo, pm), b = new THREE.Mesh(this.plusGeo, pm); b.rotation.y = Math.PI / 2; plus.add(a, b); plus.position.set(pc(p.i), Y0 + 0.9, pc(p.j)); this.worldGroup.add(plus);
      this.slots.set(pad.userData.key, { p, pad, plus, group: null, type: null, level: 0, prog: -1 });
    }
  }

  // ---------- Istana ----------
  _palace(cn) {
    const g = new THREE.Group(); g.position.set(0, Y0, 0);
    const white = this.M(0xf3efe6), gold = this.M(0xe3b341, { metalness: 0.7, roughness: 0.3 }), stone = this.M(0xd8d2c4);
    const bx = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    bx(4.1, 0.15, 4.1, this.M(0xb7b0a0), 0, -0.08, 0);
    bx(3.6, 0.3, 3.0, stone, 0, 0, 0); bx(3.2, 0.25, 2.6, stone, 0, 0.3, 0);
    bx(2.8, 1.5, 1.8, white, 0, 0.55, -0.2);
    for (let i = -2; i <= 2; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 10), white); c.position.set(i * 0.55, 1.3, 1.0); c.castShadow = true; g.add(c); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 4), gold); roof.position.set(0, 2.3, 0.35); roof.rotation.y = Math.PI / 4; roof.scale.set(1.5, 1, 0.75); roof.castShadow = true; g.add(roof);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.set(0, 2.05, -0.3); dome.castShadow = true; g.add(dome);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.6, 6), gold); sp.position.set(0, 3.1, -0.3); g.add(sp);
    // tiang bendera
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.4, 8), this.M(0xdddddd, { metalness: 0.6 })); pole.position.set(1.6, 2.35, 1.4); pole.castShadow = true; g.add(pole);
    const fc = document.createElement('canvas'); fc.width = 96; fc.height = 64; const x = fc.getContext('2d'); x.fillStyle = cn.c1; x.fillRect(0, 0, 96, 32); x.fillStyle = cn.c2; x.fillRect(0, 32, 96, 32);
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    const fg = new THREE.PlaneGeometry(1.5, 1.0, 14, 6); const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(1.6 + 0.75, 4.1, 1.4); flag.castShadow = true; g.add(flag); this.flag = flag; this.flagBase = fg.attributes.position.array.slice();
    // taman
    for (const [tx, tz] of [[-1.7, 1.5], [-1.7, -1.5], [1.7, -1.5]]) this._tree(g, tx, 0, tz, 0.7);
    g.userData.key = 'palace'; g.traverse(o => { o.userData.palace = true; });
    this.palace = g; this.pickables.add(g);
    this.palaceLight = g;
  }

  _tree(g, x, y, z, s = 1, kind) {
    const bm = this.bm || BIOME.temperate;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.5 * s, 6), this.M(bm.trunk)); t.position.set(x, y + 0.25 * s, z); t.castShadow = true; g.add(t);
    const colv = new THREE.Color(bm.tree).offsetHSL((hash(x, z) - 0.5) * 0.04, 0, (hash(z, x) - 0.5) * 0.08);
    if (bm.snow || kind === 'pine') {
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((0.5 - k * 0.12) * s, 0.55 * s, 7), this.M(colv.getHex())); c.position.set(x, y + (0.7 + k * 0.38) * s, z); c.castShadow = true; g.add(c); }
    } else {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 0), this.M(colv.getHex())); c.position.set(x, y + 0.85 * s, z); c.castShadow = true; g.add(c);
    }
  }
  _scenery(bm) {
    // pohon instanced di luar plateau + batu
    const r = rng(77), pts = [];
    for (let i = 0; i < 900 && pts.length < 260; i++) {
      const x = (r() - 0.5) * 110, z = (r() - 0.5) * 110, h = this.heightAt(x, z);
      const d = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
      if (h > 0.4 && d > 21.5 && h < 8) pts.push([x, h, z]);
    }
    const tg = new THREE.ConeGeometry(0.55, 1.4, 6); tg.translate(0, 1.1, 0);
    const trunk = new THREE.CylinderGeometry(0.07, 0.1, 0.8, 5); trunk.translate(0, 0.4, 0);
    const inst = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ roughness: 0.9 }), pts.length), tr = new THREE.InstancedMesh(trunk, this.M(bm.trunk), pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    pts.forEach(([x, h, z], i) => { const s = 0.8 + r() * 1.1; m.compose(new THREE.Vector3(x, h - 0.05, z), q, new THREE.Vector3(s, s * (0.9 + r() * 0.5), s)); inst.setMatrixAt(i, m); tr.setMatrixAt(i, m); c.set(bm.tree).offsetHSL((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.1); inst.setColorAt(i, c); });
    inst.castShadow = tr.castShadow = true; this.worldGroup.add(inst, tr);
    for (let i = 0; i < 40; i++) {
      const x = (r() - 0.5) * 100, z = (r() - 0.5) * 100, h = this.heightAt(x, z), d = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
      if (h > 0.1 && d > 22) { const o = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + r() * 0.8, 0), this.M(0x8f8f8a)); o.position.set(x, h + 0.1, z); o.rotation.set(r() * 3, r() * 3, 0); o.castShadow = true; this.worldGroup.add(o); }
    }
  }
  _cars() {
    const cols = [0xe53935, 0x1e88e5, 0xfdd835, 0xffffff, 0x43a047, 0x8e24aa, 0xf4511e, 0x212121];
    this.carGroup = new THREE.Group(); this.worldGroup.add(this.carGroup);
    const bodyG = new THREE.BoxGeometry(0.62, 0.2, 0.3), roofG = new THREE.BoxGeometry(0.32, 0.16, 0.26), hl = new THREE.BoxGeometry(0.04, 0.05, 0.07);
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false });
    for (let i = 0; i < 34; i++) {
      const g = new THREE.Group(); const body = new THREE.Mesh(bodyG, this.M(cols[i % cols.length], { metalness: 0.5, roughness: 0.35 })); body.position.y = 0.16; const roof = new THREE.Mesh(roofG, this.M(0x223344, { metalness: 0.6, roughness: 0.2 })); roof.position.set(-0.03, 0.33, 0);
      const h1 = new THREE.Mesh(hl, this.headMat), h2 = h1.clone(); h1.position.set(0.31, 0.17, 0.09); h2.position.set(0.31, 0.17, -0.09);
      g.add(body, roof, h1, h2); body.castShadow = true; this.carGroup.add(g);
      const axis = i % 2, lane = Math.floor(Math.random() * (GRID + 1)), dir = Math.random() < 0.5 ? 1 : -1;
      this.cars.push({ g, axis, line: -17.5 + lane * STEP, dir, t: (Math.random() - 0.5) * 36, sp: 2.2 + Math.random() * 2.2 });
    }
  }
  _ships() {
    this.ships = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 1.3), this.M(0x37474f)); hull.position.y = 0.2; const bow = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.2, 4), this.M(0x37474f)); bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(3.05, 0.2, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.M(0xf5f5f5)); cab.position.set(-1.6, 1.0, 0);
      const cols = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047];
      for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1), this.M(cols[(k + i) % 4])); c.position.set(-0.5 + k * 0.75, 0.85, 0); g.add(c); }
      g.add(hull, bow, cab); g.traverse(o => o.castShadow = true); this.worldGroup.add(g);
      this.ships.push({ g, r: 46 + i * 7, a: i * 2.1, sp: 0.02 + i * 0.004 });
    }
  }

  // ---------- sinkronisasi bangunan ----------
  sync(S) {
    this.S = S;
    for (const p of S.plots) {
      const key = p.i + ',' + p.j, slot = this.slots.get(key); if (!slot) continue;
      const b = p.b;
      slot.plus.visible = !b;
      slot.pad.material.color.set(b ? (b.type === 'park' || b.type === 'farm' ? 0x8dbb6c : 0xbfc4c9) : 0x9fc77f);
      if (!b) { if (slot.group) { this.pickables.remove(slot.group); slot.group = null; this.animators = this.animators.filter(a => a.slot !== slot); this.emitters = this.emitters.filter(e => e.slot !== slot); } slot.type = null; continue; }
      if (slot.type !== b.type || slot.level !== b.level) {
        if (slot.group) { this.pickables.remove(slot.group); this.animators = this.animators.filter(a => a.slot !== slot); this.emitters = this.emitters.filter(e => e.slot !== slot); }
        const grp = new THREE.Group(); grp.position.set(pc(p.i), Y0, pc(p.j)); grp.userData.key = key;
        const outward = this._outward(p.i, p.j);
        const info = this.make(b.type, b.level, grp, { outward, seed: p.i * 17 + p.j * 31 });
        grp.traverse(o => { o.userData.key = key; if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
        const bb = new THREE.Box3().setFromObject(grp); slot.height = Math.max(1.2, bb.max.y - Y0);
        grp.userData.info = info; slot.group = grp; slot.type = b.type; slot.level = b.level; this.pickables.add(grp);
        for (const a of info.anim || []) this.animators.push({ slot, fn: a });
        for (const e of info.emit || []) this.emitters.push({ slot, ...e, world: new THREE.Vector3(pc(p.i) + e.x, Y0 + e.y, pc(p.j) + e.z) });
        slot.prog = -1; slot.site = null;
      }
      this._progress(slot, b);
    }
  }
  _outward(i, j) { const dx = i - 3, dz = j - 3; if (Math.abs(dx) >= Math.abs(dz)) return dx < 0 ? Math.PI * 1.5 : Math.PI * 0.5; return dz < 0 ? Math.PI : 0; }
  _progress(slot, b) {
    const g = slot.group; if (!g) return;
    const wasBuilding = slot.prog >= 0 && slot.prog < 1;
    if (b.progress < 1) {
      if (!slot.site) { slot.site = this._site(slot); this.worldGroup.add(slot.site); }
      const k = 0.04 + 0.96 * b.progress; g.scale.y = Math.max(0.04, k); g.visible = true;
      slot.site.visible = true;
    } else {
      if (slot.site) { this.worldGroup.remove(slot.site); slot.site = null; }
      g.scale.set(1, 1, 1);
      if (wasBuilding) { slot.pop = 0.0; this.burst(g.position.x, Y0 + 0.5, g.position.z); if (this.onBuilt) this.onBuilt(); }
    }
    slot.prog = b.progress;
  }
  _site(slot) {
    const g = new THREE.Group(); g.position.set(slot.group.position.x, Y0, slot.group.position.z);
    const h = Math.min(6, slot.height || 3);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.7, h, 3.7)), new THREE.LineBasicMaterial({ color: 0xffc533 })); frame.position.y = h / 2; g.add(frame);
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.06, 3.9), this.M(0x8a6a42)); dirt.position.y = 0.01; g.add(dirt);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, h + 1.5, 0.18), this.M(0xf6b800)); mast.position.set(1.75, (h + 1.5) / 2, 1.75); mast.castShadow = true; g.add(mast);
    const jib = new THREE.Group(); jib.position.set(1.75, h + 1.5, 1.75);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 0.14), this.M(0xf6b800)); arm.position.x = -1.2; const cw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), this.M(0x555555)); cw.position.x = 1.2;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), this.M(0x222222)); cable.position.set(-2.4, -0.7, 0); const hook = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.M(0xcc3333)); hook.position.set(-2.4, -1.45, 0);
    jib.add(arm, cw, cable, hook); g.add(jib); g.userData.jib = jib;
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 8), this.M(0xff6a00)); c.position.set(-1.7 + i * 1.1, 0.2, -2.1); g.add(c); }
    return g;
  }
  burst(x, y, z) {
    for (let i = 0; i < 36; i++) { const a = Math.random() * 6.28, s = 0.8 + Math.random() * 1.8; this.particles.emit(x, y, z, Math.cos(a) * s, 0.5 + Math.random() * 1.4, Math.sin(a) * s, 0xd8c9a6, 0.9 + Math.random() * 0.8, 1.6 + Math.random(), 2.2, 0.5, 0.55); }
  }
  fireworks() { this._fw = 6; this._fwT = 0; }
  setRain(on) { this.rainTarget = on ? 1 : 0; }

  // ---------- pemilihan ----------
  ndcPick(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.key && !o.userData.palace) o = o.parent; if (o && o.userData.key) return o.userData.key; if (o && o.userData.palace) return 'palace'; }
    return null;
  }
  setHover(key) {
    this.hover = key; if (!key || key === 'palace') { this.hoverRing.visible = false; return; }
    const [i, j] = key.split(',').map(Number); this.hoverRing.position.set(pc(i), Y0 + 0.05, pc(j)); this.hoverRing.visible = key !== this.selected;
  }
  setSelected(key) {
    this.selected = key; if (!key || key === 'palace') { this.selRing.visible = false; return; }
    const [i, j] = key.split(',').map(Number); this.selRing.position.set(pc(i), Y0 + 0.07, pc(j)); this.selRing.visible = true; this.hoverRing.visible = false;
    this.focusTo(pc(i), 1.5, pc(j));
  }
  focusTo(x, y, z) { this.focusT = { x, y, z }; }

  // ---------- loop ----------
  update(dt) {
    this.clock += dt; const t = this.clock;
    this.tod = (this.tod + dt * this.todSpeed) % 1;
    this._env(dt);
    // air
    const wp = this.water.geometry.attributes.position, wb = this.waterBase;
    for (let i = 0; i < wp.count; i++) { const x = wb[i * 3], z = wb[i * 3 + 2]; wp.setY(i, Math.sin(x * 0.12 + t * 1.1) * 0.12 + Math.cos(z * 0.15 + t * 0.9) * 0.1 + Math.sin((x + z) * 0.07 + t * 0.6) * 0.1); }
    wp.needsUpdate = true; this.water.geometry.computeVertexNormals();
    // fokus kamera
    if (this.focusT) { const c = this.controls.target, f = this.focusT; c.x += (f.x - c.x) * 0.08; c.y += (f.y - c.y) * 0.08; c.z += (f.z - c.z) * 0.08; if (Math.hypot(f.x - c.x, f.z - c.z) < 0.05) this.focusT = null; }
    const tg = this.controls.target; tg.x = Math.max(-28, Math.min(28, tg.x)); tg.z = Math.max(-28, Math.min(28, tg.z)); tg.y = Math.max(0, Math.min(10, tg.y));
    this.controls.update();
    // bendera
    if (this.flag) { const p = this.flag.geometry.attributes.position, b = this.flagBase; for (let i = 0; i < p.count; i++) { const x = b[i * 3] + 0.75; p.setZ(i, Math.sin(x * 3 - t * 5) * 0.1 * x); } p.needsUpdate = true; }
    // awan
    for (const c of this.clouds.children) { c.position.x += c.userData.sp * dt; if (c.position.x > 170) c.position.x = -170; }
    // animasi bangunan
    for (const a of this.animators) a.fn(dt, t);
    for (const slot of this.slots.values()) {
      if (slot.pop !== undefined && slot.group && slot.pop < 1) { slot.pop += dt * 1.6; const k = slot.pop, s = 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.12; slot.group.scale.set(s, s, s); if (k >= 1) { slot.group.scale.set(1, 1, 1); slot.pop = undefined; } }
      if (slot.plus.visible) { slot.plus.position.y = Y0 + 0.9 + Math.sin(t * 2 + slot.p.i + slot.p.j) * 0.12; slot.plus.rotation.y = t * 0.8; }
      if (slot.site) slot.site.userData.jib.rotation.y = Math.sin(t * 0.7 + slot.p.i) * 1.2;
    }
    // emitter asap
    const g = this.S ? Math.min(1, 0.4 + this.pollution / 40) : 0.6;
    for (const e of this.emitters) {
      if (!e.slot.group || e.slot.prog < 1) continue;
      if (Math.random() < e.rate * dt * 60 * 0.12) this.particles.emit(e.world.x + (Math.random() - 0.5) * 0.1, e.world.y, e.world.z + (Math.random() - 0.5) * 0.1, 0.25 + Math.random() * 0.2, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.15, e.color, e.size || 0.7, 3 + Math.random() * 1.5, 3.2, -0.05, 0.38 * g + 0.15);
    }
    // mobil
    const nCars = Math.round(6 + (this.infra / 100) * 28);
    this.cars.forEach((c, i) => {
      c.g.visible = i < nCars; if (!c.g.visible) return;
      c.t += c.dir * c.sp * dt; if (c.t > 18.5) c.t = -18.5; if (c.t < -18.5) c.t = 18.5;
      const off = 0.2 * c.dir * (c.axis ? 1 : -1);
      if (c.axis === 0) { c.g.position.set(c.t, RY + 0.02, c.line + off); c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; } else { c.g.position.set(c.line - off, RY + 0.02, c.t); c.g.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    });
    // kapal
    for (const s of this.ships) { s.a += s.sp * dt; s.g.position.set(Math.cos(s.a) * s.r, 0.1 + Math.sin(t * 1.3 + s.r) * 0.06, Math.sin(s.a) * s.r); s.g.rotation.y = -s.a - Math.PI; s.g.rotation.z = Math.sin(t + s.r) * 0.02; }
    // hover/select
    this.selRing.material.opacity = 0.65 + Math.sin(t * 4) * 0.3; this.selRing.scale.setScalar(1 + Math.sin(t * 4) * 0.015);
    // hujan
    this.rainAmt += (this.rainTarget - this.rainAmt) * Math.min(1, dt * 0.8);
    this.rain.material.opacity = this.rainAmt * 0.7; this.rain.visible = this.rainAmt > 0.02;
    if (this.rain.visible) { const p = this.rain.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * 45; if (y < 0) y += 50; p.setY(i, y); } p.needsUpdate = true; this.rain.position.set(tg.x, 0, tg.z); }
    // kembang api
    if (this._fw > 0) { this._fwT -= dt; if (this._fwT <= 0) { this._fwT = 0.5; this._fw--; const cx = (Math.random() - 0.5) * 30, cz = (Math.random() - 0.5) * 30, cy = 18 + Math.random() * 10, col = new THREE.Color().setHSL(Math.random(), 1, 0.6).getHex(); for (let i = 0; i < 90; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(5 + Math.random() * 3); this.particles.emit(cx, cy, cz, v.x, v.y, v.z, col, 0.9, 2 + Math.random() * 0.8, 0.5, 3, 1); } } }
    this.particles.update(dt);
  }
  _env(dt) {
    const a = this.tod * Math.PI * 2, elev = Math.sin(a - Math.PI / 2 + Math.PI / 2 * 0), el = Math.sin(a);   // el>0 siang
    const sd = new THREE.Vector3(Math.cos(a) * 0.85, el, 0.35).normalize();
    const day = Math.min(1, Math.max(0, el * 3 + 0.2)), night = 1 - Math.min(1, Math.max(0, el * 4 + 0.7));
    const dusk = Math.max(0, 1 - Math.abs(el) * 4) * 1;
    const top = new THREE.Color(0x03060f).lerp(new THREE.Color(0x2f78d4), day).lerp(new THREE.Color(0x5a4a8a), dusk * 0.45);
    const bot = new THREE.Color(0x0b1226).lerp(new THREE.Color(0xbcdcff), day).lerp(new THREE.Color(0xff9a5a), dusk * 0.8);
    const smog = Math.min(1, this.pollution / 55);
    bot.lerp(new THREE.Color(0x8a7f70), smog * 0.6 * day); top.lerp(new THREE.Color(0x6e7a86), smog * 0.35 * day);
    this.skyMat.uniforms.top.value.copy(top); this.skyMat.uniforms.bot.value.copy(bot); this.skyMat.uniforms.sunDir.value.copy(sd);
    this.skyMat.uniforms.sunCol.value.setRGB(1, 0.75 - dusk * 0.3, 0.45 - dusk * 0.2).multiplyScalar(Math.max(0, el + 0.15));
    this.fog.color.copy(bot); this.fog.density = 0.0032 + smog * 0.0045 + this.rainAmt * 0.004; this.scene.background = bot;
    this.sun.position.copy(sd).multiplyScalar(80).add(this.sun.target.position);
    this.sun.intensity = Math.max(0, el) * 2.6 * (1 - this.rainAmt * 0.5) * (1 - smog * 0.25);
    this.sun.color.setRGB(1, 0.92 - dusk * 0.35, 0.82 - dusk * 0.5);
    this.moonL.position.set(-sd.x * 60, Math.max(10, -sd.y * 60), -20); this.moonL.intensity = night * 0.55;
    this.hemi.intensity = 0.18 + day * 0.65; this.hemi.color.copy(bot).lerp(new THREE.Color(0xffffff), 0.3);
    this.renderer.toneMappingExposure = 0.95 + night * 0.15;
    this.sunDisc.position.copy(sd).multiplyScalar(520); this.sunDisc.visible = el > -0.1;
    this.moonDisc.position.set(-sd.x * 500, -sd.y * 500, -sd.z * 500); this.moonDisc.visible = -el > -0.05;
    this.stars.material.opacity = night * 0.95; this.cloudMat.color.setRGB(0.25 + day * 0.75, 0.25 + day * 0.75, 0.3 + day * 0.7 - dusk * 0.2); this.cloudMat.opacity = 0.85 - smog * 0.0;
    // jendela menyala saat malam (turun saat blackout)
    const flick = this.blackout > 0.05 ? (0.25 + 0.75 * (Math.sin(this.clock * 9 + 1) > -0.2 ? 1 : 0)) * (1 - Math.min(1, this.blackout * 2.2)) : 1;
    const ni = (night * 1.2 + dusk * 0.4) * flick;
    for (const m of this.nightMats) m.emissiveIntensity = ni;
    this.lampMat.emissiveIntensity = ni * 2.5; this.headMat.color.setRGB(1, 0.96, 0.78).multiplyScalar(0.3 + night * 1.4);
    this.waterMat.color.lerp(new THREE.Color(this.cn && this.cn.biome === 'desert' ? 0x1d9fb0 : 0x1b7fb8).multiplyScalar(0.25 + day * 0.75), 0.1);
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
}
