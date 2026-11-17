// country.7mit — Kota 3D realistis ala /classic: pulau berbukit, laut beriak, langit siang-malam mengikuti jam nyata,
// lampu jalan & jendela menyala saat malam, lalu lintas, kereta; klik petak untuk membangun
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { makeBuilding, kit } from './models.js';

export const N = 7, PITCH = 5, HALF = N * PITCH / 2, KM_U = 0.1; // 1 satuan = 100 m
const MODEL = { rumah: ['housing', 1], sekolah: ['school', 1], rs: ['hospital', 1], pabrik: ['factory', 1], pertanian: ['farm', 1], listrik: ['solar', 2], pelabuhan: ['port', 1], bandara: ['airport', 1], pasar: ['housing', 2], taman: ['park', 1], teknologi: ['techhub', 1], kantor: ['anticorr', 1] };
const RS = { tol: { w: 1.5, col: 0x1f2227, stripe: 0x4aa3ff, cars: 4, sp: 5 }, raya: { w: 1.0, col: 0x2c2e33, stripe: 0xfdd835, cars: 3, sp: 3 }, jalan: { w: .7, col: 0x3d4045, stripe: 0xffffff, cars: 2, sp: 2 }, rel: { w: .7, col: 0x77706a, stripe: 0, cars: 0, sp: 3.5 } };
const rnd = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const WATER_Y = -.55, SIZE = 240, SEG = 150;
const CARCOL = [0xc62828, 0x1565c0, 0xf9a825, 0x2e7d32, 0xeceff1, 0x37474f, 0x6a1b9a, 0xef6c00];

function noiseFn(seed) { // value noise + fbm, deterministik per kota
  const R = rnd(seed), P = new Uint8Array(512); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), h = (a, b) => P[(P[a & 255] + b) & 255] / 255; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, y, o = 5) => { let s = 0, a = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += n2(x * f, y * f) * a; t += a; a *= .5; f *= 2.03; } return s / t; };
}
const tex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (rep) t.repeat.set(rep[0], rep[1]); return t; };
const speckle = (g, w, h, n, cols, a = .5) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } g.globalAlpha = 1; };

export class Region3D {
  // opts: lat, lng (pusat kota), tz (jam UTC), onPlot(i,j), onNode(x,z)
  constructor(host, o) {
    this.host = host; this.o = o; this.cos = Math.cos(o.lat * Math.PI / 180) || 1; this.cars = []; this.plots = new Map(); this.roads = new THREE.Group(); this.prev = new THREE.Group(); this.mode = 'plot'; this.clock = 0; this.timeMode = o.timeMode || 'real';
    const seed = Math.abs(Math.floor(o.lat * 1000 + o.lng * 777)) % 2147483646 + 1, R = this.R = rnd(seed); this.fbm = noiseFn(seed);
    const al = Math.abs(o.lat); this.biome = al > 58 ? 'cold' : al > 35 ? 'temperate' : (al > 14 && al < 32 && this.fbm(o.lng * .05, o.lat * .05) > .52) ? 'arid' : 'tropic';
    const w = host.clientWidth || 800, h = host.clientHeight || 500;
    const r = this.r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(w, h); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(r.domElement);
    const s = this.s = new THREE.Scene(); this.fog = new THREE.FogExp2(0xbfdcff, .0045); s.fog = this.fog;
    this.cam = new THREE.PerspectiveCamera(40, w / h, .2, 1400); this.cam.position.set(30, 26, 40);
    this.ctl = new OrbitControls(this.cam, r.domElement); Object.assign(this.ctl, { enableDamping: true, dampingFactor: .08, maxPolarAngle: 1.5, minDistance: 6, maxDistance: 120, zoomSpeed: .8 }); this.ctl.target.set(0, 0, 0);
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x6b8a50, .7); this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 220 }); this.sun.shadow.bias = -.0005; this.sun.shadow.normalBias = .04;
    this.moonL = new THREE.DirectionalLight(0x8fb0ff, 0); s.add(this.hemi, this.sun, this.sun.target, this.moonL);
    this.sky(); this.terrain(); this.water(); this.city(); this.forest(); this.traffic();
    s.add(this.roads, this.prev); this.hl = new THREE.Mesh(new THREE.BoxGeometry(4.2, .22, 4.2), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: .5 })); this.hl.visible = false; s.add(this.hl);
    this.nodeHl = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .2, 16), new THREE.MeshBasicMaterial({ color: 0xff5d6c })); this.nodeHl.visible = false; s.add(this.nodeHl);
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); this.ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ visible: false })); this.ground.rotation.x = -Math.PI / 2; s.add(this.ground);
    const el = r.domElement; el.addEventListener('pointerdown', (e) => { this.down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => { if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 5) this.click(e); this.down = null; });
    el.addEventListener('pointermove', (e) => { if (e.buttons) return; this.hover(e); });
    this.ro = new ResizeObserver(() => { const W = host.clientWidth, H = host.clientHeight; if (W && H) { r.setSize(W, H); this.cam.aspect = W / H; this.cam.updateProjectionMatrix(); } }); this.ro.observe(host);
    this.env(0); this.last = performance.now(); this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  // ---------- lingkungan ----------
  sky() {
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } },
      vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 top,bot,sunCol,sunDir; varying vec3 vP; void main(){ float h=clamp(vP.y*.5+.5,0.,1.); h=clamp((h-.48)*2.,0.,1.); vec3 c=mix(bot,top,pow(h,.5)); float s=max(dot(normalize(vP),normalize(sunDir)),0.); c+=sunCol*(pow(s,350.)*3.+pow(s,40.)*.6+pow(s,6.)*.22); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}` });
    this.s.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat));
    const n = 1800, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * .95 + .03; v.normalize().multiplyScalar(850); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.s.add(this.stars);
    this.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe6ecff, fog: false })); this.s.add(this.moonDisc);
    // awan lembut (sprite gumpalan)
    const ct = tex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
    this.cloudMat = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: .38 }); this.clouds = new THREE.Group(); const R = this.R;
    for (let i = 0; i < 9; i++) { const cg = new THREE.Group(), k = 4 + Math.floor(R() * 4); for (let j = 0; j < k; j++) { const sp = new THREE.Sprite(this.cloudMat); const sc = 22 + R() * 26; sp.scale.set(sc, sc * .5, 1); sp.position.set((j - k / 2) * 10 + R() * 6, R() * 5, R() * 10); cg.add(sp); } cg.position.set((R() - .5) * 900, 110 + R() * 60, (R() - .5) * 900); cg.userData.sp = .6 + R() * 1.2; this.clouds.add(cg); }
    this.s.add(this.clouds);
  }
  hgt(x, z) { // dataran kota datar, di luar: bukit, gunung, teluk & danau, lalu laut
    const d = Math.max(Math.abs(x), Math.abs(z)), r = Math.hypot(x, z), t = sm(HALF + 2.5, HALF + 26, d);
    const base = this.fbm(x * .022 + 7, z * .022 + 3), ridge = 1 - Math.abs(this.fbm(x * .035 + 40, z * .035 + 11, 4) * 2 - 1), dir = sm(-.2, .9, (x * this.mx + z * this.mz) / 80);
    let h = (base - .43) * 20 + ridge * ridge * 16 * dir * sm(HALF + 10, HALF + 45, d) + (this.fbm(x * .18, z * .18, 3) - .5) * 1.2;
    h = h * t + .0 * (1 - t); const edge = sm(78, 108, r); return h * (1 - edge) + (-7) * edge;
  }
  terrain() {
    const a = this.R() * Math.PI * 2; this.mx = Math.cos(a); this.mz = Math.sin(a);
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, this.hgt(p.getX(i), p.getZ(i)) - .03); g.computeVertexNormals();
    const B = { tropic: [0x4f9a3c, 0x2f7d32], temperate: [0x6aa04a, 0x4d8a3a], arid: [0xc9a865, 0xa98f4f], cold: [0x7d9a6a, 0xdfe7ea] }[this.biome], g1 = new THREE.Color(B[0]), g2 = new THREE.Color(B[1]), sand = new THREE.Color(0xdcc890), rock = new THREE.Color(0x77726b), snow = new THREE.Color(0xf4f7fa), sea = new THREE.Color(0x8a7a55), col = new Float32Array(p.count * 3), nrm = g.attributes.normal, c = new THREE.Color(), snowLine = this.biome === 'cold' ? 5 : this.biome === 'temperate' ? 13 : 17;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i), sl = 1 - nrm.getY(i), n = this.fbm(x * .3, z * .3, 2);
      c.copy(g1).lerp(g2, n); if (y < 0) c.lerp(sand, sm(-.06, -.38, y)); if (y < WATER_Y) c.lerp(sea, sm(WATER_Y, WATER_Y - 2, y));
      c.lerp(rock, sm(.22, .45, sl) * sm(1, 3, y)); c.lerp(rock, sm(8, 13, y) * .7); c.lerp(snow, sm(snowLine, snowLine + 3, y + n * 2) * (1 - sm(.5, .8, sl) * .5)); c.multiplyScalar(.88 + n * .24); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const gt = tex(256, 256, (c2, w, h) => { c2.fillStyle = '#fff'; c2.fillRect(0, 0, w, h); speckle(c2, w, h, 9000, ['#d8d8d8', '#bdbdbd', '#f4f4f4', '#a8a8a8'], .55); }, [60, 60]);
    this.land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: gt, roughness: .95, metalness: 0 })); this.land.receiveShadow = true; this.s.add(this.land);
  }
  water() {
    const nt = (() => { const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), id = g.createImageData(S, S), f = noiseFn(99), H = (x, y) => f(x / 18, y / 18, 4) + f((S - x) / 7, y / 9, 2) * .35;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = (y * S + x) * 4, dx = (H(x + 1, y) - H(x - 1, y)) * 9, dy = (H(x, y + 1) - H(x, y - 1)) * 9; id.data[k] = 128 + dx * 127; id.data[k + 1] = 128 + dy * 127; id.data[k + 2] = 255; id.data[k + 3] = 255; } g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26); return t; })();
    this.wN = nt; this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1b6fa8, roughness: .12, metalness: .55, normalMap: nt, normalScale: new THREE.Vector2(.55, .55), transparent: true, opacity: .9 });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), this.waterMat); w.rotation.x = -Math.PI / 2; w.position.y = WATER_Y; w.receiveShadow = true; this.s.add(w);
  }
  city() {
    const s = this.s, span = N * PITCH, R = this.R;
    const asph = tex(256, 256, (c, w, h) => { c.fillStyle = '#2f3136'; c.fillRect(0, 0, w, h); speckle(c, w, h, 7000, ['#3d4046', '#26282c', '#484b52', '#1f2125'], .7); }, [span / 3, .4]);
    const RM = new THREE.MeshStandardMaterial({ map: asph, roughness: .92 }), LM = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .7 }), YM = new THREE.MeshStandardMaterial({ color: 0xf4c430, roughness: .7 });
    // alas kota + trotoar
    const base = new THREE.Mesh(new THREE.BoxGeometry(span + 2.2, .3, span + 2.2), new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: .95 })); base.position.y = -.17; base.receiveShadow = true; s.add(base);
    const dashG = new THREE.PlaneGeometry(.55, .07), dashes = new THREE.InstancedMesh(dashG, YM, (N + 1) * N * 4 * 2), zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .42), LM, (N + 1) * (N + 1) * 16), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1); let di = 0, zi = 0;
    const put = (im, i, x, y, z, ry) => { E.set(-Math.PI / 2, 0, ry); Q.setFromEuler(E); M.compose(V.set(x, y, z), Q, S1); im.setMatrixAt(i, M); };
    for (let k = 0; k <= N; k++) { const v = (k - N / 2) * PITCH; const a = new THREE.Mesh(new THREE.PlaneGeometry(span + .9, .9), RM); a.rotation.x = -Math.PI / 2; a.position.set(0, .012, v); a.receiveShadow = true; s.add(a); const b = a.clone(); b.rotation.z = Math.PI / 2; b.position.set(v, .014, 0); s.add(b);
      for (let m = 0; m < N; m++) for (let q = 0; q < 4; q++) { const d = (m - N / 2) * PITCH + .9 + q * 1.05; put(dashes, di++, d, .022, v, 0); put(dashes, di++, v, .022, d, Math.PI / 2); }
      for (let m = 0; m <= N; m++) { const u = (m - N / 2) * PITCH; for (let q = 0; q < 4; q++) { const off = -.3 + q * .2; put(zebra, zi++, u + .62, .024, v + off, Math.PI / 2); put(zebra, zi++, u - .62, .024, v + off, Math.PI / 2); put(zebra, zi++, v + off, .024, u + .62, 0); put(zebra, zi++, v + off, .024, u - .62, 0); } } }
    dashes.count = di; zebra.count = zi; s.add(dashes, zebra);
    // petak: trotoar + lahan rumput
    const curbM = new THREE.MeshStandardMaterial({ color: 0xb9bdc1, roughness: .9 }), lotT = tex(128, 128, (c, w, h) => { c.fillStyle = '#6da04e'; c.fillRect(0, 0, w, h); speckle(c, w, h, 4000, ['#5c8f41', '#7db45c', '#4f7f38', '#8cbf66'], .7); }), lotM = new THREE.MeshStandardMaterial({ map: lotT, roughness: 1 }), paveM = new THREE.MeshStandardMaterial({ color: 0xa9adb1, roughness: .9 });
    this.hit = []; this.lotM = lotM; this.paveM = paveM;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const sub = new THREE.Group(); sub.position.set((i - (N - 1) / 2) * PITCH, 0, (j - (N - 1) / 2) * PITCH); s.add(sub);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(4.1, .14, 4.1), curbM); curb.position.y = -.01; curb.receiveShadow = true; sub.add(curb);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(3.7, .16, 3.7), lotM); pad.position.y = .005; pad.receiveShadow = true; pad.userData.plot = [i, j]; sub.add(pad); this.hit.push(pad);
      const tg = new THREE.Group(); sub.add(tg); this.plots.set(i + ',' + j, { sub, tg, pad, built: null });
      const nT = Math.floor(R() * 3.2); for (let k = 0; k < nT; k++) tg.add(this.tree((R() - .5) * 2.8, .08, (R() - .5) * 2.8, .55 + R() * .35, R));
    }
    // lampu jalan (kepala berpendar saat malam)
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd27a, emissiveIntensity: 0 }); const poleG = new THREE.CylinderGeometry(.03, .04, 1.5, 6); poleG.translate(0, .75, 0); const headG = new THREE.SphereGeometry(.09, 8, 6); headG.translate(0, 1.52, 0);
    const cnt = (N + 1) * (N + 1), poles = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: .6, roughness: .5 }), cnt), heads = new THREE.InstancedMesh(headG, this.lampMat, cnt); let li = 0;
    for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) { M.makeTranslation((a - N / 2) * PITCH + .52, 0, (b - N / 2) * PITCH + .52); poles.setMatrixAt(li, M); heads.setMatrixAt(li++, M); } poles.castShadow = true; s.add(poles, heads);
    // cahaya hangat kota di malam hari
    this.glow = []; for (const [gx, gz] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [0, 0]]) { const pl = new THREE.PointLight(0xffc878, 0, 30, 1.6); pl.position.set(gx, 3.2, gz); s.add(pl); this.glow.push(pl); }
  }
  tree(x, y, z, sc, R) { // pohon sesuai iklim
    const g = new THREE.Group(), tm = this.tM || (this.tM = { trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }), a: new THREE.MeshStandardMaterial({ color: this.biome === 'arid' ? 0x7f9a4a : 0x2f7d32, roughness: .9 }), b: new THREE.MeshStandardMaterial({ color: this.biome === 'cold' ? 0x2c5f3f : 0x3f9142, roughness: .9 }) });
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, .7, 6), tm.trunk); tr.position.y = .35; g.add(tr);
    if (this.biome === 'tropic' && R() < .45) { tr.scale.set(.8, 1.9, .8); tr.position.y = .66; for (let k = 0; k < 6; k++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(.12, .85, 4), tm.b); lf.position.y = 1.3; lf.rotation.set(1.15, k * 1.05, 0, 'YXZ'); lf.translateY(.38); g.add(lf); } }
    else if (this.biome === 'cold' || R() < .4) { for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(.5 - k * .12, .7, 7), tm.b); cn.position.y = .75 + k * .4; g.add(cn); } }
    else { const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), tm.a); cr.position.y = 1; cr.scale.y = .85; g.add(cr); const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.34, 1), tm.b); c2.position.set(.25, 1.25, .1); g.add(c2); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.position.set(x, y, z); g.scale.setScalar(sc); g.rotation.y = R() * 6; return g;
  }
  forest() { // hutan instanced di perbukitan + batu
    const R = this.R, cnt = this.biome === 'arid' ? 500 : 2200, cg = new THREE.ConeGeometry(.55, 1.7, 6); cg.translate(0, 1.15, 0); const bg = new THREE.IcosahedronGeometry(.62, 1); bg.translate(0, 1.1, 0); const tg = new THREE.CylinderGeometry(.07, .1, .7, 5); tg.translate(0, .35, 0);
    const pine = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), cnt), leaf = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), cnt), trunk = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x5f4329, roughness: 1 }), cnt * 2);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), pineBias = this.biome === 'cold' ? .9 : this.biome === 'temperate' ? .55 : .2; let pi = 0, bi = 0, ti = 0, tries = 0;
    while (pi + bi < cnt && tries++ < cnt * 12) { const x = (R() - .5) * 200, z = (R() - .5) * 200, d = Math.max(Math.abs(x), Math.abs(z)); if (d < HALF + 2.2) continue; const y = this.hgt(x, z); if (y < .25 || y > 11) continue; if (this.fbm(x * .06 + 90, z * .06, 3) < (this.biome === 'arid' ? .58 : .42)) continue;
      const sc = .7 + R() * .9; Q.setFromAxisAngle(up, R() * 6); M.compose(V.set(x, y - .05, z), Q, S.set(sc, sc * (.9 + R() * .4), sc)); trunk.setMatrixAt(ti++, M);
      if (R() < pineBias || y > 6) { pine.setMatrixAt(pi, M); pine.setColorAt(pi++, C.setHSL(.33 + R() * .05, .45, .2 + R() * .1)); } else { leaf.setMatrixAt(bi, M); leaf.setColorAt(bi++, C.setHSL(this.biome === 'arid' ? .2 : .28 + R() * .07, .5, .26 + R() * .12)); } }
    pine.count = pi; leaf.count = bi; trunk.count = ti; for (const m of [pine, leaf, trunk]) { m.castShadow = true; m.receiveShadow = true; this.s.add(m); }
    const rg = new THREE.DodecahedronGeometry(.6, 0), rocks = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x8a857d, roughness: 1, flatShading: true }), 120); let ri = 0;
    for (let k = 0; k < 400 && ri < 120; k++) { const x = (R() - .5) * 190, z = (R() - .5) * 190; if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 3) continue; const y = this.hgt(x, z); if (y < -.2) continue; const sc = .4 + R() * 1.6; Q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)); M.compose(V.set(x, y, z), Q, S.set(sc, sc * .7, sc)); rocks.setMatrixAt(ri++, M); } rocks.count = ri; rocks.castShadow = true; this.s.add(rocks);
  }
  carMesh(col) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(.62, .16, .28), new THREE.MeshStandardMaterial({ color: col, metalness: .5, roughness: .35 })); body.position.y = .13; const cab = new THREE.Mesh(new THREE.BoxGeometry(.32, .13, .25), new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: .7, roughness: .2 })); cab.position.set(-.03, .27, 0); g.add(body, cab);
    for (const sx of [-.2, .2]) for (const sz of [-.14, .14]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .05, 8), this.whM || (this.whM = new THREE.MeshStandardMaterial({ color: 0x111111 }))); wh.rotation.x = Math.PI / 2; wh.position.set(sx, .06, sz); g.add(wh); }
    this.headMat = this.headMat || new THREE.MeshBasicMaterial({ color: 0xfff6c8 }); this.tailMat = this.tailMat || new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const sz of [-.09, .09]) { const hd = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, .06), this.headMat); hd.position.set(.315, .14, sz); const tl = new THREE.Mesh(new THREE.BoxGeometry(.02, .04, .06), this.tailMat); tl.position.set(-.315, .15, sz); g.add(hd, tl); }
    body.castShadow = true; return g; }
  traffic() { // lalu lintas dasar di kisi jalan kota
    const R = this.R; for (let k = 0; k < 18; k++) { const line = (Math.floor(R() * (N + 1)) - N / 2) * PITCH, ax = k % 2, dir = R() < .5 ? 1 : -1, a = [-HALF, line + dir * .2], b = [HALF, line + dir * .2], pts = (dir > 0 ? [a, b] : [b, a]).map(p => ax ? [p[1], p[0]] : p); const car = this.carMesh(CARCOL[k % CARCOL.length]); this.s.add(car); this.cars.push({ car, pts, cum: [0, N * PITCH], t: R() * N * PITCH, sp: 1.6 + R() * 1.8, off: 0 }); }
  }
  // ---------- waktu & cahaya ----------
  tod() { if (this.timeMode === 'day') return .22; if (this.timeMode === 'night') return .72; const d = new Date(Date.now() + (this.o.tz || 0) * 3600e3), hr = d.getUTCHours() + d.getUTCMinutes() / 60; return ((hr - 6) / 24 + 1) % 1; }
  setTimeMode(m) { this.timeMode = m; }
  env(dt) {
    const a = this.tod() * Math.PI * 2, el = Math.sin(a), sd = new THREE.Vector3(Math.cos(a) * .85, el, .38).normalize(), day = Math.min(1, Math.max(0, el * 3 + .2)), night = 1 - Math.min(1, Math.max(0, el * 4 + .7)), dusk = Math.max(0, 1 - Math.abs(el) * 4);
    const top = new THREE.Color(0x03060f).lerp(new THREE.Color(0x2a6fd0), day).lerp(new THREE.Color(0x5a4a8a), dusk * .45), bot = new THREE.Color(0x0a1022).lerp(new THREE.Color(0xb9d9fb), day).lerp(new THREE.Color(0xff9a5a), dusk * .8);
    const u = this.skyMat.uniforms; u.top.value.copy(top); u.bot.value.copy(bot); u.sunDir.value.copy(sd); u.sunCol.value.setRGB(1, .8 - dusk * .3, .55 - dusk * .25).multiplyScalar(Math.max(0, el + .15));
    this.fog.color.copy(bot); this.s.background = bot; this.sun.position.copy(sd).multiplyScalar(90); this.sun.intensity = Math.max(0, el) * 2.9; this.sun.color.setRGB(1, .93 - dusk * .35, .84 - dusk * .5);
    this.moonL.position.set(-sd.x * 60, Math.max(12, -sd.y * 60), -20); this.moonL.intensity = night * .5; this.hemi.intensity = .16 + day * .7; this.hemi.color.copy(bot).lerp(new THREE.Color(0xffffff), .3);
    this.r.toneMappingExposure = .92 + night * .2; this.moonDisc.position.set(-sd.x * 800, Math.abs(sd.y) * 800 * (el < 0 ? 1 : -1), -sd.z * 800); this.stars.material.opacity = night * .95;
    this.cloudMat.color.setRGB(.22 + day * .78, .22 + day * .78 - dusk * .12, .28 + day * .72 - dusk * .25);
    const ni = night * 1.25 + dusk * .4; for (const m of kit.nightMats) m.emissiveIntensity = ni; this.lampMat.emissiveIntensity = ni * 2.6; for (const g of this.glow) g.intensity = ni * 14; this.headMat?.color.setRGB(1, .96, .78).multiplyScalar(.35 + night * 1.2);
    this.waterMat.color.set(this.biome === 'tropic' ? 0x1583a8 : 0x1b6fa8).multiplyScalar(.2 + day * .8); this.night = night;
  }
  // ---------- interaksi ----------
  setCursor(e) { const b = this.r.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.cam); }
  nodeAt(e) { this.setCursor(e); const g = this.ray.intersectObject(this.ground)[0]; if (!g) return null; const x = Math.round((g.point.x + HALF) / PITCH), z = Math.round((g.point.z + HALF) / PITCH); if (x < 0 || z < 0 || x > N || z > N) return null; return [x, z]; }
  hover(e) {
    if (this.mode === 'plot') { this.setCursor(e); const h = this.ray.intersectObjects(this.hit)[0]; this.nodeHl.visible = false; this.r.domElement.style.cursor = h ? 'pointer' : 'grab'; if (!h) { this.hl.visible = false; return; } this.hl.visible = true; this.hl.position.copy(h.object.parent.position); this.hl.position.y = .02; return; }
    this.hl.visible = false; const n = this.nodeAt(e); this.nodeHl.visible = !!n; if (n) this.nodeHl.position.set(n[0] * PITCH - HALF, .12, n[1] * PITCH - HALF);
  }
  click(e) {
    if (this.mode === 'plot') { this.setCursor(e); const h = this.ray.intersectObjects(this.hit)[0]; if (h) this.o.onPlot?.(...h.object.userData.plot); return; }
    const n = this.nodeAt(e); if (n) this.o.onNode?.(n[0], n[1]);
  }
  setMode(m) { this.mode = m; this.hl.visible = false; this.nodeHl.visible = false; }
  toLL(x, z) { return [+(this.o.lat - (z * PITCH - HALF) * KM_U / 111.2).toFixed(6), +(this.o.lng + (x * PITCH - HALF) * KM_U / (111.2 * this.cos)).toFixed(6)]; }
  fromLL(lat, lng) { return [((lng - this.o.lng) * 111.2 * this.cos / KM_U + HALF) / PITCH, ((this.o.lat - lat) * 111.2 / KM_U + HALF) / PITCH]; }
  setPlots(builds) {
    const seen = new Set();
    for (const b of builds) { const k = b.region?.plot, p = this.plots.get(k); if (!p) continue; seen.add(k); if (p.built && p.kind === b.kind) continue; if (p.built) p.sub.remove(p.built);
      const [t, lv] = MODEL[b.kind] || ['housing', 1], g = new THREE.Group(); makeBuilding(t, lv, g, { outward: 0 }); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.position.y = .08; g.scale.setScalar(.9);
      const fresh = this.ready; if (fresh) { g.scale.set(.9, .02, .9); p.grow = 0; } p.sub.add(g); p.built = g; p.kind = b.kind; p.tg.visible = false; p.pad.material = this.paveM; }
    for (const [k, p] of this.plots) if (p.built && !seen.has(k)) { p.sub.remove(p.built); p.built = null; p.kind = null; p.tg.visible = true; p.pad.material = this.lotM; }
    this.ready = true;
  }
  occupied(i, j) { return !!this.plots.get(i + ',' + j)?.built; }
  roadMesh(pts, kind) {
    const st = RS[kind] || RS.jalan, g = new THREE.Group(), bedM = new THREE.MeshStandardMaterial({ color: st.col, roughness: .9 });
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .01) continue; const seg = new THREE.Group(); seg.position.set((a[0] + b[0]) / 2, .07 + (kind === 'rel' ? .02 : 0), (a[1] + b[1]) / 2); seg.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(len + st.w * .6, .08, st.w), bedM); bed.receiveShadow = true; seg.add(bed);
      if (kind === 'rel') { const rm = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: .8, roughness: .3 }), slm = new THREE.MeshStandardMaterial({ color: 0x4f3d2b, roughness: 1 }); for (const sd of [-.2, .2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .05), rm); rail.position.set(0, .08, sd); seg.add(rail); } const n = Math.floor(len * 3), sl = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, .04, .62), slm, n), M = new THREE.Matrix4(); for (let k = 0; k < n; k++) { M.makeTranslation(-len / 2 + (k + .5) / 3, .055, 0); sl.setMatrixAt(k, M); } seg.add(sl); }
      else { const n = Math.floor(len * 2), ds = new THREE.InstancedMesh(new THREE.BoxGeometry(.3, .01, .05), new THREE.MeshBasicMaterial({ color: st.stripe }), n), M = new THREE.Matrix4(); for (let k = 0; k < n; k++) { M.makeTranslation(-len / 2 + (k + .5) / 2, .046, 0); ds.setMatrixAt(k, M); } seg.add(ds);
        if (kind === 'tol') for (const sd of [-st.w / 2, st.w / 2]) { const gr = new THREE.Mesh(new THREE.BoxGeometry(len, .14, .04), new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: .7, roughness: .4 })); gr.position.set(0, .11, sd); seg.add(gr); } }
      g.add(seg); }
    return g;
  }
  setRoads(list) {
    const key = JSON.stringify(list.map(r => [r.id, r.kind])); if (key === this.roadKey) return; this.roadKey = key;
    this.s.remove(this.roads); this.roads.traverse(o => { o.geometry?.dispose?.(); }); this.roads = new THREE.Group(); this.s.add(this.roads); this.cars = this.cars.filter(c => !c.road);
    for (const r of list) { const pts = (r.path || []).map(([la, lo]) => { const [x, z] = this.fromLL(la, lo); return [x * PITCH - HALF, z * PITCH - HALF]; }); if (pts.length < 2) continue; this.roads.add(this.roadMesh(pts, r.kind)); const st = RS[r.kind] || RS.jalan;
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const mk = r.kind === 'rel' ? 1 : st.cars; for (let k = 0; k < mk; k++) { let car; if (r.kind === 'rel') { car = new THREE.Group(); for (let w = 0; w < 4; w++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.92, .42, .44), w ? kit.facade(0xd8dde2) : new THREE.MeshStandardMaterial({ color: 0xb71c1c, metalness: .5, roughness: .4 })); m.position.set(-w * 1, .22, 0); m.castShadow = true; car.add(m); } } else car = this.carMesh(CARCOL[(k + r.id) % CARCOL.length || 0]); car.position.y = .12; this.roads.add(car); this.cars.push({ car, pts, cum, t: Math.random() * cum[cum.length - 1], sp: st.sp * (.8 + Math.random() * .5), road: true, off: r.kind === 'rel' ? 0 : .12 }); }
    }
  }
  setPreview(nodes, kind) { this.s.remove(this.prev); this.prev = new THREE.Group(); if (nodes.length) { const pts = nodes.map(([x, z]) => [x * PITCH - HALF, z * PITCH - HALF]); this.prev.add(this.roadMesh(pts, kind)); for (const p of pts) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .3, 12), new THREE.MeshBasicMaterial({ color: 0xffd166 })); m.position.set(p[0], .2, p[1]); this.prev.add(m); } } this.s.add(this.prev); }
  loop(now) {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop); const dt = Math.min(.08, (now - this.last) / 1000); this.last = now; this.clock += dt;
    for (const c of this.cars) { const L = c.cum[c.cum.length - 1]; c.t = (c.t + dt * c.sp) % L; let i = 1; while (i < c.cum.length - 1 && c.cum[i] < c.t) i++; const a = c.pts[i - 1], b = c.pts[i], f = (c.t - c.cum[i - 1]) / Math.max(.001, c.cum[i] - c.cum[i - 1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]); c.car.position.x = a[0] + (b[0] - a[0]) * f - Math.sin(ang) * c.off; c.car.position.z = a[1] + (b[1] - a[1]) * f + Math.cos(ang) * c.off; c.car.rotation.y = -ang; }
    for (const p of this.plots.values()) if (p.built && p.grow !== undefined && p.grow < 1) { p.grow = Math.min(1, p.grow + dt * 1.1); const e = 1 - Math.pow(1 - p.grow, 3); p.built.scale.set(.9, Math.max(.02, .9 * e), .9); }
    for (const c of this.clouds.children) { c.position.x += dt * c.userData.sp; if (c.position.x > 460) c.position.x = -460; }
    this.wN.offset.x += dt * .006; this.wN.offset.y += dt * .004; this.envT = (this.envT || 0) + dt; if (this.envT > .5) { this.envT = 0; this.env(dt); }
    this.ctl.target.y = Math.max(0, Math.min(6, this.ctl.target.y)); if (this.cam.position.y < .6) this.cam.position.y = .6;
    this.ctl.update(); this.r.render(this.s, this.cam);
  }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.ctl.dispose(); for (const m of kit.nightMats) m.emissiveIntensity = 0; const keep = new Set(kit.nightMats); this.s.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { if (!keep.has(x)) x.dispose?.(); }); }); this.r.dispose(); this.r.domElement.remove(); }
}
