// Country Manager — wilayah negara 3D: luas & bentuk mengikuti negara asli (km²), permukaan 3D relief atau peta biasa
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { AREAS } from './areas.js';
import { makeBuilding, kit } from './models.js';

const KM = 100;                       // 1 unit scene = 100 km
const D2R = Math.PI / 180;
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function vn(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const h = (a, b) => { const r = Math.sin((a * 127.1 + b * 311.7 + s) * 1.0) * 43758.5453; return r - Math.floor(r); }; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, y, s) => vn(x, y, s) * .5 + vn(x * 2.1, y * 2.1, s) * .27 + vn(x * 4.3, y * 4.3, s) * .15 + vn(x * 8.7, y * 8.7, s) * .08;

export async function loadOutline(code) {
  const meta = AREAS[code]; if (!meta) throw new Error('Data wilayah tidak tersedia');
  const r = await fetch(`https://cdn.jsdelivr.net/gh/mledoze/countries@master/data/${meta[0]}.geo.json`); if (!r.ok) throw new Error('Batas wilayah gagal dimuat');
  const g = await r.json(); const geom = g.features[0].geometry; const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let rings = []; for (const p of polys) for (const ring of p) rings.push(ring);
  // jangan terlalu banyak titik: sederhanakan
  const total = rings.reduce((a, r) => a + r.length, 0), step = Math.max(1, Math.floor(total / 6000));
  rings = rings.map(r => { const o = r.filter((_, i) => i % step === 0); if (o.length < 3 && r.length >= 3) return r.slice(0, 3); return o; }).filter(r => r.length >= 3);
  let minLon = 1e9, maxLon = -1e9; rings.forEach(r => r.forEach(p => { minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]); }));
  let shifted = false; if (maxLon - minLon > 180) { shifted = true; rings = rings.map(r => r.map(p => [p[0] < 0 ? p[0] + 360 : p[0], p[1]])); }
  return { rings, area: meta[1], shifted };
}

export class Country3D {
  constructor(host, { code, name, lat, lng, outline, mode = '3d', mapbox = '', onStatus }) {
    this.host = host; this.code = code; this.mode = mode; this.mapbox = mapbox; this.outline = outline; this.disposed = false; this.t = 0; this.onStatus = onStatus || (() => {});
    const w = host.clientWidth || 800, h = host.clientHeight || 500;
    this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(w, h); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; host.appendChild(this.renderer.domElement); this.renderer.domElement.style.display = 'block';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x2a070d); this.scene.fog = new THREE.Fog(0x2a070d, 10, 100);
    this.cam = new THREE.PerspectiveCamera(45, w / h, 0.05, 5000);
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a6b50, .9); this.sun = new THREE.DirectionalLight(0xfff1d6, 2.1); this.scene.add(this.hemi, this.sun);
    this.controls = new OrbitControls(this.cam, this.renderer.domElement); Object.assign(this.controls, { enableDamping: true, dampingFactor: .08, maxPolarAngle: 1.5, rotateSpeed: .6, zoomSpeed: .8, panSpeed: .8 });
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); this.down = null; const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this.down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => { if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 5) { const pt = this.pickPoint(e); if (pt) this.onClick?.(pt); } this.down = null; });
    el.addEventListener('pointermove', (e) => { if (e.buttons) return; const pt = this.pickPoint(e); this.onHover?.(pt, e); });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.prep(); this.build(); this.last = performance.now(); this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  prep() {
    const rings = this.outline.rings; let minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9; rings.forEach(r => r.forEach(p => { minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]); minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]); }));
    const padLon = Math.max((maxLon - minLon) * .12, .06), padLat = Math.max((maxLat - minLat) * .12, .06);
    this.b = { minLon: minLon - padLon, maxLon: maxLon + padLon, minLat: minLat - padLat, maxLat: maxLat + padLat }; this.lat0 = (minLat + maxLat) / 2; this.lon0 = (minLon + maxLon) / 2;
    // proyeksi sinusoidal: luas terjaga (km² nyata)
    this.px = (lon, lat) => (lon - this.lon0) * 111.32 * Math.cos(lat * D2R) / KM; this.pz = (lat) => -(lat - this.lat0) * 110.57 / KM;
    const wx = this.px(this.b.maxLon, this.lat0) - this.px(this.b.minLon, this.lat0), wz = this.pz(this.b.minLat) - this.pz(this.b.maxLat); this.W = wx; this.H = wz; this.diag = Math.hypot(wx, wz); this.widthKm = wx * KM; this.heightKm = wz * KM;
    // mask daratan (lon/lat linear) pada canvas
    const N = 320, c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff'; g.beginPath();
    const X = (lon) => (lon - this.b.minLon) / (this.b.maxLon - this.b.minLon) * N, Y = (lat) => (1 - (lat - this.b.minLat) / (this.b.maxLat - this.b.minLat)) * N;
    rings.forEach(r => { r.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); }); g.fill('evenodd');
    const c2 = document.createElement('canvas'); c2.width = N; c2.height = N; const g2 = c2.getContext('2d'); g2.filter = 'blur(2.2px)'; g2.drawImage(c, 0, 0); const d = g2.getImageData(0, 0, N, N).data; this.mask = new Float32Array(N * N); for (let i = 0; i < N * N; i++) this.mask[i] = d[i * 4] / 255; this.N = N;
    const c3 = document.createElement('canvas'); c3.width = N; c3.height = N; const g3 = c3.getContext('2d'); g3.filter = 'blur(8px)'; g3.drawImage(c, 0, 0); const d3 = g3.getImageData(0, 0, N, N).data; this.soft = new Float32Array(N * N); for (let i = 0; i < N * N; i++) this.soft[i] = d3[i * 4] / 255;
  }
  softAt(lon, lat) { const N = this.N, u = (lon - this.b.minLon) / (this.b.maxLon - this.b.minLon), v = 1 - (lat - this.b.minLat) / (this.b.maxLat - this.b.minLat); const x = Math.min(N - 1, Math.max(0, Math.floor(u * N))), y = Math.min(N - 1, Math.max(0, Math.floor(v * N))); return this.soft[y * N + x]; }
  hgt(lon, lat) {
    const { relief, is3, s1, s2 } = this.cfg, b = this.b, u = (lon - b.minLon) / (b.maxLon - b.minLon), v = (b.maxLat - lat) / (b.maxLat - b.minLat), sft = this.softAt(lon, lat);
    const n = fbm(u * 5 + 3, v * 5 + 3, s1), n2 = fbm(u * 16, v * 16, s2), sm = (a, c, x) => { const t = Math.max(0, Math.min(1, (x - a) / (c - a))); return t * t * (3 - 2 * t); };
    const land = sft > .5, inland = sm(.5, .88, sft); let h;
    if (is3) h = land ? .02 + relief * (.06 + .94 * n) * inland * inland * (.55 + .9 * n2) : -sm(.5, .08, sft) * relief * .9 - .03; else h = land ? .012 : -.01;
    return { h, land, m: sft, n, n2, coast: inland };
  }
  maskAt(lon, lat) { const N = this.N, u = (lon - this.b.minLon) / (this.b.maxLon - this.b.minLon), v = 1 - (lat - this.b.minLat) / (this.b.maxLat - this.b.minLat); const x = Math.min(N - 1, Math.max(0, Math.floor(u * N))), y = Math.min(N - 1, Math.max(0, Math.floor(v * N))); return this.mask[y * N + x]; }
  clear() { if (this.root) { this.scene.remove(this.root); this.root.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.bumpMap?.dispose?.(); x.dispose?.(); }); }); } this.root = new THREE.Group(); this.scene.add(this.root); this.bpins = []; this.roadLines = []; this.bmap = null; this.bgroup = null; this.regionLines = null; this.prev = null; this.roadCars = []; this.anims = []; this.ships = []; this.clouds = []; this.water = null; this.cityInst = null; this.cities = []; this.cars = []; this.pins = null; this.detail = new THREE.Group(); this.root.add(this.detail); this.dtiles = new Map(); this.dkey = ''; }
  async build() {
    this.clear(); const root = this.root, SEG = 200, b = this.b, seed = hash(this.code), R = rng(seed), is3 = this.mode === '3d';
    const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG); geo.rotateX(-Math.PI / 2); const P = geo.attributes.position, cols = new Float32Array(P.count * 3), uv = geo.attributes.uv;
    const relief = Math.min(this.diag * .03, 9) * (is3 ? 1 : 0), col = new THREE.Color(), lat0 = this.lat0, arctic = Math.abs(lat0) > 55, desert = Math.abs(lat0) > 14 && Math.abs(lat0) < 33, trop = Math.abs(lat0) <= 14;
    const grass = new THREE.Color(trop ? 0x4caf50 : desert ? 0xd8b66a : arctic ? 0xdfe9ee : 0x7cb342), hill = new THREE.Color(trop ? 0x2e7d32 : desert ? 0xb98c4a : arctic ? 0xb9c9d2 : 0x558b2f), sand = new THREE.Color(0xe8d9a0), rock = new THREE.Color(0x8c8c88), snow = new THREE.Color(0xf4f8fb), deep = new THREE.Color(0x0e3550), shallow = new THREE.Color(0x2f8fb0);
    this.biomeTree = trop ? 0x2e8b3a : desert ? 0x8a9a3a : arctic ? 0x2f6b4a : 0x3f8f3a; this.cfg = { relief, is3, s1: seed % 97, s2: seed % 53 }; this.landCells = []; this.seaCells = [];
    for (let i = 0; i < P.count; i++) {
      const u = (i % (SEG + 1)) / SEG, v = Math.floor(i / (SEG + 1)) / SEG; const lon = b.minLon + u * (b.maxLon - b.minLon), lat = b.maxLat - v * (b.maxLat - b.minLat);
      const x = this.px(lon, lat), z = this.pz(lat); const { h, land, m, n2 } = this.hgt(lon, lat);
      P.setXYZ(i, x, h, z);
      if (is3) { const t = relief ? h / relief : 0; if (!land) col.copy(deep).lerp(shallow, Math.min(1, m * 1.6)); else if (t < .035) col.copy(sand); else if (t < .07) col.copy(sand).lerp(grass, (t - .035) / .035); else if (t < .6) col.copy(grass).lerp(hill, Math.min(1, t * 1.4)); else col.copy(hill).lerp(rock, Math.min(1, (t - .6) * 2.2)); if (land && t > .85) col.lerp(snow, Math.min(1, (t - .85) * 5)); if (arctic && land) col.lerp(snow, .45); col.offsetHSL(0, 0, (n2 - .5) * .07); }
      else col.set(0xffffff); cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
      if (!is3) { const mx = (lon + 180) / 360, my = (1 - Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) / Math.PI) / 2; uv.setXY(i, mx, my); }
      if (land && m > .8 && i % 23 === 0) this.landCells.push([x, h, z, lon, lat]); else if (!land && m < .05 && i % 29 === 0) this.seaCells.push([x, z]);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    let mat;
    if (is3) mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: false });
    else { mat = new THREE.MeshBasicMaterial({ color: 0x1b2b38 }); this.onStatus('Memuat peta…'); this.buildTiles(geo, mat); }
    const terrain = new THREE.Mesh(geo, mat); root.add(terrain); this.terrain = terrain;
    if (is3) {
      const wg = new THREE.PlaneGeometry(this.W * 16, this.H * 16, 1, 1); wg.rotateX(-Math.PI / 2); this.bump = this.waterBump(); const wm = new THREE.MeshPhysicalMaterial({ color: 0x1b7fb8, roughness: .15, metalness: .1, transparent: true, opacity: .82, clearcoat: .6, bumpMap: this.bump, bumpScale: .5 }); this.water = new THREE.Mesh(wg, wm); this.water.position.y = 0; root.add(this.water);
      this.addCities(R); this.addShips(R); this.addClouds(R);
      // dasar laut
      const sb = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 16, this.H * 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b2538 })); sb.position.y = -relief * .6 - .2; root.add(sb);
    } else {
      // garis batas
      const lm = new THREE.LineBasicMaterial({ color: 0xe9b8a0 }); this.outline.rings.forEach(r => { const pts = r.map(p => new THREE.Vector3(this.px(p[0], p[1]), .05, this.pz(p[1]))); root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm)); });
    }
    this.fit(); this.onStatus('');
  }
  waterBump() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), id = g.createImageData(256, 256); for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const v = Math.floor(fbm(x / 24, y / 24, 7) * 255); const k = (y * 256 + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; } g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(4, this.W / 3), Math.max(4, this.H / 3)); return t; }
  addCities(R) {
    if (!this.landCells.length) return; const sc = Math.max(.0035, Math.min(this.diag * .0011, .12)) / 4, nC = Math.min(16, 4 + Math.round(Math.log10(Math.max(1000, this.pop || 1e7)))); this.sc = sc; this.cities = []; this.cars = []; this.pins = new THREE.Group(); this.root.add(this.pins);
    const ROADM = new THREE.MeshStandardMaterial({ color: 0x34363b, roughness: .9 }), PADM = new THREE.MeshStandardMaterial({ color: 0xbfc4c9, roughness: .9 }), pool = ['housing', 'housing', 'housing', 'school', 'hospital', 'factory', 'park', 'techhub', 'housing', 'rail', 'farm', 'anticorr'], carCols = [0xe53935, 0x1e88e5, 0xfdd835, 0xffffff, 0x43a047];
    for (let c = 0; c < nC; c++) {
      const [cx, cy, cz] = this.landCells[Math.floor(R() * this.landCells.length)]; const g = new THREE.Group(); g.position.set(cx, Math.max(.02, cy) + sc * 1.2, cz); g.scale.setScalar(sc); g.rotation.y = R() * 6;
      const n = c === 0 ? 3 : 2, pitch = 5;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const sub = new THREE.Group(); sub.position.set((i - (n - 1) / 2) * pitch, 0, (j - (n - 1) / 2) * pitch); const pad = new THREE.Mesh(new THREE.BoxGeometry(4.1, .16, 4.1), PADM); pad.position.y = -.08; pad.receiveShadow = true; sub.add(pad); makeBuilding(pool[Math.floor(R() * pool.length)], 1 + (R() < .25 ? 1 : 0), sub, { outward: 0 }); g.add(sub); }
      const span = n * pitch; for (let k = 0; k <= n; k++) { const v = (k - n / 2) * pitch; const a = new THREE.Mesh(new THREE.PlaneGeometry(span + .9, .9), ROADM); a.rotation.x = -Math.PI / 2; a.position.set(0, .01, v); g.add(a); const b2 = a.clone(); b2.rotation.z = Math.PI / 2; b2.position.set(v, .011, 0); g.add(b2); }
      for (let k = 0; k < 5; k++) { const car = new THREE.Mesh(new THREE.BoxGeometry(.6, .25, .3), new THREE.MeshStandardMaterial({ color: carCols[k % 5] })); car.position.y = .15; g.add(car); this.cars.push({ car, span, line: (Math.floor(R() * (n + 1)) - n / 2) * pitch, axis: k % 2, t: R() * span, sp: 2 + R() * 2, dir: R() < .5 ? 1 : -1 }); }
      this.root.add(g); this.cities.push(g);
      const pin = new THREE.Mesh(new THREE.ConeGeometry(Math.max(.025, this.diag * .004), Math.max(.07, this.diag * .012), 8), new THREE.MeshBasicMaterial({ color: 0xffe3d2 })); pin.rotation.x = Math.PI; pin.position.set(cx, Math.max(.02, cy) + Math.max(.07, this.diag * .012) * .55, cz); this.pins.add(pin);
    }
    // pohon
    const treeN = Math.min(6000, Math.round(this.diag * 70)), tg = new THREE.ConeGeometry(.5, 1.4, 6); tg.translate(0, .7, 0); const tr = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), treeN), m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let k = 0; const ts = Math.max(.006, this.diag * .00055), bm = this.biomeTree;
    for (let tries = 0; tries < treeN * 4 && k < treeN; tries++) { const lon = this.b.minLon + R() * (this.b.maxLon - this.b.minLon), lat = this.b.minLat + R() * (this.b.maxLat - this.b.minLat), hh = this.hgt(lon, lat); if (!hh.land || hh.m < .62) continue; const s2 = ts * (.7 + R() * .9); m.compose(new THREE.Vector3(this.px(lon, lat), hh.h, this.pz(lat)), q, new THREE.Vector3(s2, s2 * (.9 + R() * .6), s2)); tr.setMatrixAt(k, m); col.set(bm).offsetHSL((R() - .5) * .05, 0, (R() - .5) * .1); tr.setColorAt(k, col); k++; }
    tr.count = k; tr.castShadow = false; this.root.add(tr); this.treesMesh = tr;
  }
  addShips(R) { if (this.seaCells.length < 5) return; for (let i = 0; i < Math.min(8, this.seaCells.length); i++) { const [x, z] = this.seaCells[Math.floor(R() * this.seaCells.length)]; const s = Math.max(.008, this.diag * .0013); const g = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(s * 3, s * .6, s), new THREE.MeshStandardMaterial({ color: 0x37474f })); const top = new THREE.Mesh(new THREE.BoxGeometry(s * .8, s * .7, s * .8), new THREE.MeshStandardMaterial({ color: 0xf5f5f5 })); top.position.set(-s, s * .6, 0); g.add(hull, top); g.position.set(x, .01, z); this.root.add(g); this.ships.push({ g, cx: x, cz: z, r: s * (2 + R() * 6), a: R() * 6.28, sp: .1 + R() * .15 }); } }
  addClouds(R) { const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .55, roughness: 1 }); for (let i = 0; i < 6; i++) { const g = new THREE.Group(); for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(this.diag * (.02 + R() * .03), 10, 8), m); s.position.set(j * this.diag * .03, R() * this.diag * .01, R() * this.diag * .02); s.scale.y = .45; g.add(s); } g.position.set((R() - .5) * this.W * 1.4, this.diag * .22 + R() * this.diag * .08, (R() - .5) * this.H * 1.4); this.root.add(g); this.clouds.push(g); } }
  async buildTiles(geo, mat) {
    const b = this.b, lonSpan = b.maxLon - b.minLon; let z = Math.max(1, Math.min(11, Math.floor(Math.log2(360 / lonSpan * 4.2)))); const mx = (lon) => (lon + 180) / 360 * Math.pow(2, z), my = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) / Math.PI) / 2 * Math.pow(2, z);
    let x0 = Math.floor(mx(b.minLon)), x1 = Math.floor(mx(b.maxLon)), y0 = Math.floor(my(b.maxLat)), y1 = Math.floor(my(b.minLat));
    while ((x1 - x0 + 1) * (y1 - y0 + 1) > 36 && z > 1) { z--; x0 = Math.floor(mx(b.minLon)); x1 = Math.floor(mx(b.maxLon)); y0 = Math.floor(my(b.maxLat)); y1 = Math.floor(my(b.minLat)); }
    const nx = x1 - x0 + 1, ny = y1 - y0 + 1, c = document.createElement('canvas'); c.width = nx * 256; c.height = ny * 256; const g = c.getContext('2d'); g.fillStyle = '#1b2b38'; g.fillRect(0, 0, c.width, c.height);
    const url = (x, y) => this.mapbox ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${z}/${x}/${y}?access_token=${this.mapbox}` : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`; const tiles = []; const n = Math.pow(2, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push(new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { g.drawImage(im, (x - x0) * 256, (y - y0) * 256); res(); }; im.onerror = () => res(); im.src = url(((x % n) + n) % n, y); }));
    await Promise.all(tiles); if (this.disposed) return;
    // redupkan area di luar batas negara, garis tepi
    const X = (lon) => (mx(lon) - x0) * 256, Y = (lat) => (my(lat) - y0) * 256; g.save(); g.beginPath(); g.rect(0, 0, c.width, c.height); this.outline.rings.forEach(r => { r.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); }); g.fillStyle = 'rgba(4,10,16,.62)'; g.fill('evenodd'); g.restore();
    g.strokeStyle = '#e9b8a0'; g.lineWidth = Math.max(1.5, c.width / 700); this.outline.rings.forEach(r => { g.beginPath(); r.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); g.stroke(); });
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; const uv = geo.attributes.uv, P = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) { const u0 = (i % 201) / 200, v0 = Math.floor(i / 201) / 200, lon = b.minLon + u0 * (b.maxLon - b.minLon), lat = b.maxLat - v0 * (b.maxLat - b.minLat); uv.setXY(i, (mx(lon) - x0) / nx, 1 - (my(lat) - y0) / ny); }
    uv.needsUpdate = true; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; this.onStatus('');
  }
  fit() {
    const d = this.diag, fov = this.cam.fov * D2R, asp = this.cam.aspect || 1.6, bb = this.b;
    const lw = (this.px(bb.maxLon, this.lat0) - this.px(bb.minLon, this.lat0)) * .86, lh = this.H * .86, th = Math.tan(fov / 2);
    const dist = Math.max((lh / 2) / th / Math.sin(.95), (lw / 2) / (th * asp)) * .98, tilt = 56 * D2R, az = .25;
    this.cam.near = d / 4000; this.cam.far = d * 40; this.cam.updateProjectionMatrix(); this.controls.target.set(0, 0, 0);
    this.cam.position.set(Math.sin(az) * Math.cos(tilt) * dist, Math.sin(tilt) * dist, Math.cos(az) * Math.cos(tilt) * dist);
    this.fitDist = dist; this.controls.minDistance = d * .0015; this.controls.maxDistance = d * 3.5; this.sun.position.set(d * .6, d, d * .4);
  }
  // ---- tile peta asli (jalan, bangunan, label) dimuat saat di-zoom ----
  lonLatAt(x, z) { const lat = this.lat0 - z * KM / 110.57, lon = this.lon0 + x * KM / (111.32 * Math.cos(lat * D2R)); return [lon, lat]; }
  updateDetail() {
    if (!this.detail) return; const tgt = this.controls.target, dist = this.cam.position.distanceTo(tgt), on = dist < this.fitDist * .8; this.dFactor = on ? Math.min(1, (this.fitDist * .8 - dist) / (this.fitDist * .45)) : 0;
    if (!on) { if (this.dtiles.size && this.dFactor === 0) { /* biarkan memudar lalu hapus */ } return; }
    const [lon, lat] = this.lonLatAt(tgt.x, tgt.z), viewKm = 2 * dist * Math.tan(this.cam.fov * D2R / 2) * (this.cam.aspect || 1.6) * KM;
    let z = Math.round(Math.log2(40075 * Math.cos(lat * D2R) * 3.4 / Math.max(.05, viewKm))); z = Math.max(4, Math.min(17, z)); const n = Math.pow(2, z), cx = Math.floor((lon + 180) / 360 * n), cy = Math.floor((1 - Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) / Math.PI) / 2 * n);
    const key = z + '/' + cx + '/' + cy; if (key === this.dkey) return; this.dkey = key; const want = new Set(), r = 2;
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) { if (y < 0 || y >= n) continue; const xx = ((x % n) + n) % n, id = z + '/' + xx + '/' + y + '@' + x; want.add(id); if (!this.dtiles.has(id)) this.addTile(z, xx, y, x, id); }
    clearTimeout(this.dprune); this.dprune = setTimeout(() => { for (const [id, t] of this.dtiles) if (!want.has(id)) { this.detail.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.map?.dispose(); t.mesh.material.dispose(); this.dtiles.delete(id); } }, 1400);
  }
  addTile(z, x, y, xRaw, id) {
    const n = Math.pow(2, z), G = 14, lon0 = xRaw / n * 360 - 180, lon1 = (xRaw + 1) / n * 360 - 180, my = (yy) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) / D2R;
    const geo = new THREE.PlaneGeometry(1, 1, G, G), P = geo.attributes.position, uv = geo.attributes.uv, eps = Math.max(.0008, this.diag * .00003);
    for (let i = 0; i < P.count; i++) { const u = (i % (G + 1)) / G, v = Math.floor(i / (G + 1)) / G, lon = lon0 + u * (lon1 - lon0), lat = my(y + v); P.setXYZ(i, this.px(lon, lat), Math.max(0, this.hgt(lon, lat).h) + eps, this.pz(lat)); uv.setXY(i, u, 1 - v); }
    geo.computeVertexNormals(); const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 2; mesh.visible = false; this.detail.add(mesh); const t = { mesh, loaded: false }; this.dtiles.set(id, t);
    const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { if (this.disposed || !this.dtiles.has(id)) return; const tex = new THREE.Texture(im); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; mat.map = tex; mat.needsUpdate = true; t.loaded = true; mesh.visible = true; }; im.onerror = () => {};
    im.src = this.mapbox ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${z}/${x}/${y}?access_token=${this.mapbox}` : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  // ---- pembangunan & wilayah ----
  pickPoint(e) { if (!this.terrain) return null; const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.cam); const h = this.ray.intersectObject(this.terrain, false)[0]; if (!h) return null; const [lon, lat] = this.lonLatAt(h.point.x, h.point.z); if (!this.hgt(lon, lat).land) return null; return { lon, lat, x: h.point.x, y: h.point.y, z: h.point.z }; }
  setRegions(feats) {
    if (this.regionLines) { this.root.remove(this.regionLines); this.regionLines.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); } this.regions = feats || []; this.regionLines = new THREE.Group(); this.root.add(this.regionLines);
    const m = new THREE.LineBasicMaterial({ color: 0xffe3d2, transparent: true, opacity: .55 });
    for (const f of this.regions) for (const r of f.rings) { const step = Math.max(1, Math.floor(r.length / 260)), pts = []; for (let i = 0; i < r.length; i += step) { const [lo, la] = r[i]; pts.push(new THREE.Vector3(this.px(lo, la), Math.max(0, this.hgt(lo, la).h) + Math.max(.01, this.diag * .0004), this.pz(la))); } if (pts.length > 2) this.regionLines.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m)); }
    this.regionLines.visible = true;
  }
  regionAt(lon, lat, feats) { for (const f of feats || this.regions || []) { if (lon < f.bb[0] || lon > f.bb[2] || lat < f.bb[1] || lat > f.bb[3]) continue; for (const r of f.rings) { let inside = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; } if (inside) return f.name; } } return null; }
  gridRegions(n = 8) { const b = this.b, out = []; const dl = (b.maxLon - b.minLon) / n, da = (b.maxLat - b.minLat) / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const lo0 = b.minLon + i * dl, la0 = b.maxLat - (j + 1) * da; if (!this.hgt(lo0 + dl / 2, la0 + da / 2).land) continue; out.push({ name: `Zona ${String.fromCharCode(65 + j)}${i + 1}`, bb: [lo0, la0, lo0 + dl, la0 + da], rings: [[[lo0, la0], [lo0 + dl, la0], [lo0 + dl, la0 + da], [lo0, la0 + da]]] }); } return out; }
  modelFor(kind) { return { rumah: ['housing', 1], sekolah: ['school', 1], rs: ['hospital', 1], pabrik: ['factory', 1], pertanian: ['farm', 1], listrik: ['solar', 2], pelabuhan: ['port', 1], bandara: ['airport', 1], pasar: ['housing', 2], taman: ['park', 1], teknologi: ['techhub', 1], kantor: ['anticorr', 1] }[kind] || ['housing', 1]; }
  unit() { return this.sc || Math.max(.0035, Math.min(this.diag * .0011, .12)) / 4; }
  setBuilds(list, firstLoad) {
    this.bmap = this.bmap || new Map(); this.bgroup = this.bgroup || (() => { const g = new THREE.Group(); this.root.add(g); return g; })(); if (!this.roadCars) this.roadCars = []; if (!this.anims) this.anims = [];
    const ids = new Set(list.map(b => b.id)); for (const [id, o] of this.bmap) if (!ids.has(id)) { this.bgroup.remove(o.obj); this.bmap.delete(id); this.roadCars = this.roadCars.filter(c => c.bid !== id); }
    const sc = this.unit(); this.bpins = this.bpins || [];
    for (const b of list) { if (this.bmap.has(b.id)) continue; const fresh = !firstLoad && Date.now() - new Date(b.ts).getTime() < 30000; let obj;
      if (b.path) obj = this.makeRoad(b, fresh);
      else { const h = this.hgt(b.lng, b.lat).h; obj = new THREE.Group(); obj.position.set(this.px(b.lng, b.lat), Math.max(.02, h) + sc * 1.2, this.pz(b.lat)); const inner = new THREE.Group(); inner.scale.setScalar(sc); const [t, lv] = this.modelFor(b.kind); const pad = new THREE.Mesh(new THREE.BoxGeometry(4.1, .16, 4.1), new THREE.MeshStandardMaterial({ color: 0xbfc4c9, roughness: .9 })); pad.position.y = -.08; inner.add(pad); makeBuilding(t, lv, inner, { outward: 0 }); obj.add(inner); const pin = new THREE.Mesh(new THREE.ConeGeometry(Math.max(.012, this.diag * .0022), Math.max(.04, this.diag * .007), 8), new THREE.MeshBasicMaterial({ color: 0xffd166 })); pin.rotation.x = Math.PI; pin.position.y = Math.max(.04, this.diag * .007) * .55; obj.add(pin); this.bpins.push(pin); if (fresh) { inner.scale.set(sc, sc * .04, sc); const site = new THREE.Group(); site.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.7, 5, 3.7)), new THREE.LineBasicMaterial({ color: 0xffc533 }))); site.children[0].position.y = 2.5; const mast = new THREE.Mesh(new THREE.BoxGeometry(.18, 6.5, .18), new THREE.MeshStandardMaterial({ color: 0xf6b800 })); mast.position.set(1.75, 3.25, 1.75); const jib = new THREE.Mesh(new THREE.BoxGeometry(4.6, .14, .14), new THREE.MeshStandardMaterial({ color: 0xf6b800 })); jib.position.set(-.5, 6.5, 1.75); site.add(mast, jib); site.scale.setScalar(sc); obj.add(site); this.anims.push({ t: 0, inner, site, sc, jib }); } }
      this.bgroup.add(obj); this.bmap.set(b.id, { obj, b }); }
  }
  makeRoad(b, fresh) {
    const pts = [], P = b.path, ey = Math.max(.006, this.diag * .0005);
    for (let i = 0; i < P.length - 1; i++) { const [la0, lo0] = P[i], [la1, lo1] = P[i + 1], n = Math.max(2, Math.ceil(Math.hypot(this.px(lo1, la1) - this.px(lo0, la0), this.pz(la1) - this.pz(la0)) / Math.max(.015, this.diag * .003))); for (let k = 0; k < n; k++) { const t = k / n, lo = lo0 + (lo1 - lo0) * t, la = la0 + (la1 - la0) * t; pts.push(new THREE.Vector3(this.px(lo, la), Math.max(.015, this.hgt(lo, la).h) + ey, this.pz(la))); } }
    const [laE, loE] = P[P.length - 1]; pts.push(new THREE.Vector3(this.px(loE, laE), Math.max(.015, this.hgt(loE, laE).h) + ey, this.pz(laE)));
    const ST = { tol: { w: 1.8, col: 0x1f2227, stripe: 0x4aa3ff, cars: 5, sp: 1.9 }, raya: { w: 1.25, col: 0x34363b, stripe: 0xfdd835, cars: 3, sp: 1 }, jalan: { w: .8, col: 0x4a4d52, stripe: 0xffffff, cars: 2, sp: .7 }, rel: { w: .8, col: 0x8c8f94, stripe: 0, cars: 0, sp: 1.2 } }, st = ST[b.kind] || ST.jalan, base = Math.max(.0028, this.unit() * .55), rad = base * st.w, g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(pts), seg = Math.min(900, pts.length * 3), len = curve.getLength(); const tan = (t) => curve.getTangent(Math.min(.999, t));
    if (b.kind === 'rel') {
      const metal = new THREE.MeshStandardMaterial({ color: 0xb9bdc4, metalness: .7, roughness: .35 }), off = rad * .75;
      for (const side of [-1, 1]) { const op = pts.map((p, i) => { const t = tan(i / (pts.length - 1)), l = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(off * side); return p.clone().add(l).add(new THREE.Vector3(0, rad * .3, 0)); }); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(op), seg, rad * .17, 5), metal)); }
      const nS = Math.min(700, Math.max(2, Math.floor(len / (rad * 2.4)))), sl = new THREE.InstancedMesh(new THREE.BoxGeometry(rad * 2.6, rad * .16, rad * .4), new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 }), nS), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < nS; i++) { const t = i / nS, p = curve.getPoint(t), tg = tan(t); q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(tg.x, 0, tg.z).normalize()); m4.compose(p.clone().add(new THREE.Vector3(0, rad * .08, 0)), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2)), new THREE.Vector3(1, 1, 1)); sl.setMatrixAt(i, m4); } g.add(sl);
      const tc = [0x1e88e5, 0xf5f5f5, 0xf5f5f5, 0xe53935], gap = rad * 3 / Math.max(.01, len), t0 = Math.random();
      for (let k = 0; k < 4; k++) { const car = new THREE.Mesh(new THREE.BoxGeometry(rad * 2.6, rad * 1.2, rad * 1.2), new THREE.MeshStandardMaterial({ color: tc[k], metalness: .4, roughness: .4 })); g.add(car); this.roadCars.push({ bid: b.id, car, curve, t: ((t0 - k * gap) % 1 + 1) % 1, sp: st.sp / Math.max(1, len) * 1.2, rad, lift: rad * 1.05, train: true }); }
    } else {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, seg, rad, 6), new THREE.MeshStandardMaterial({ color: st.col, roughness: .9 })));
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, rad * .2, 4), new THREE.MeshBasicMaterial({ color: st.stripe })); line.position.y = rad * .55; g.add(line);
      if (b.kind === 'tol') for (const sd of [-1, 1]) { const op = pts.map((p, i) => { const t = tan(i / (pts.length - 1)); return p.clone().add(new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(rad * .85 * sd)).add(new THREE.Vector3(0, rad * .5, 0)); }); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(op), seg, rad * .1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }))); }
      const cols = [0xe53935, 0x1e88e5, 0xfdd835, 0xffffff, 0x43a047]; for (let k = 0; k < st.cars; k++) { const car = new THREE.Mesh(new THREE.BoxGeometry(rad * 2.2, rad * 1, rad * 1.1), new THREE.MeshStandardMaterial({ color: cols[k % 5] })); g.add(car); this.roadCars.push({ bid: b.id, car, curve, t: Math.random(), sp: (.025 + Math.random() * .03) * st.sp * (k % 2 ? -1 : 1), rad, lift: rad * .9 }); }
    }
    const farLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: { tol: 0x4aa3ff, raya: 0xfdd835, jalan: 0xffffff, rel: 0xff8a65 }[b.kind] || 0xffffff })); g.add(farLine); this.roadLines = this.roadLines || []; this.roadLines.push(farLine);
    if (fresh) { this.anims = this.anims || []; this.anims.push({ road: g, t: 0 }); } return g;
  }
  setPreview(pts) { if (this.prev) { this.root.remove(this.prev); this.prev.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.prev = null; } if (!pts?.length) return; const g = new THREE.Group(), v = pts.map(([la, lo]) => new THREE.Vector3(this.px(lo, la), Math.max(.02, this.hgt(lo, la).h) + Math.max(.02, this.diag * .002), this.pz(la))); v.forEach(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(.012, this.diag * .0025), 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd166 })); m.position.copy(p); g.add(m); }); if (v.length > 1) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), new THREE.LineBasicMaterial({ color: 0xffd166 }))); this.prev = g; this.root.add(g); }
  setMode(mode) { if (mode === this.mode) return; this.mode = mode; this.build(); }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  loop(now) {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop); const dt = Math.min(.08, (now - this.last) / 1000); this.last = now; this.t += dt;
    if (this.bump) { this.bump.offset.x += dt * .01; this.bump.offset.y += dt * .006; }
    for (const s of this.ships) { s.a += s.sp * dt; s.g.position.set(s.cx + Math.cos(s.a) * s.r, .012 + Math.sin(this.t * 1.3 + s.cx) * .004, s.cz + Math.sin(s.a) * s.r); s.g.rotation.y = -s.a - Math.PI / 2; }
    for (const c of this.clouds) { c.position.x += dt * this.diag * .004; if (c.position.x > this.W * .9) c.position.x = -this.W * .9; }
    if (this.mode === '3d') { const day = .5 + .5 * Math.sin(this.t * .08); this.hemi.intensity = .35 + day * .65; this.sun.intensity = .3 + day * 1.9; const bg = new THREE.Color(0x050b12).lerp(new THREE.Color(0x7fb6e6), day); this.scene.background.copy(bg); this.scene.fog.color.copy(bg); this.scene.fog.near = this.diag * 1.2; this.scene.fog.far = this.diag * 4.5; const nt = Math.max(0, 1 - day * 2.2) * 1.2; for (const m of kit.nightMats) m.emissiveIntensity = nt; }
    else { this.hemi.intensity = 1; this.scene.background.set(0x2a070d); this.scene.fog.color.set(0x2a070d); this.scene.fog.near = this.diag * 20; this.scene.fog.far = this.diag * 40; }
    this.dt = (this.dt || 0) + dt; if (this.dt > .25) { this.dt = 0; this.updateDetail(); }
    const f = this.dFactor || 0; const bright = this.mode === '3d' ? .4 + .4 * (.5 + .5 * Math.sin(this.t * .08)) : 1; for (const t of this.dtiles) { const m = t[1].mesh.material; m.opacity += ((t[1].loaded ? f * (this.mode === '3d' ? .88 : 1) : 0) - m.opacity) * Math.min(1, dt * 6); m.color.setScalar(bright); }
    const near = this.cam.position.distanceTo(this.controls.target) < this.diag * .3; if (this.pins) this.pins.visible = !near; if (this.bpins) for (const pn of this.bpins) pn.visible = !near;
    for (const c of this.cars) { c.t += dt * c.sp * c.dir; const h2 = c.span / 2; if (c.t > h2) c.t = -h2; if (c.t < -h2) c.t = h2; const off = .2 * c.dir; if (c.axis === 0) { c.car.position.set(c.t, .15, c.line + off); c.car.rotation.y = c.dir > 0 ? 0 : Math.PI; } else { c.car.position.set(c.line - off, .15, c.t); c.car.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; } } for (const c of this.clouds) c.visible = f < .2; if (this.treesMesh) this.treesMesh.visible = f < .45; for (const sh of this.ships) sh.g.visible = f < .3;
    if (this.anims) for (const a of this.anims) { a.t += dt; if (a.inner) { const k = Math.min(1, a.t / 3.2), e = 1 - Math.pow(1 - k, 3); a.inner.scale.set(a.sc, a.sc * Math.max(.04, e), a.sc); if (a.jib) a.jib.position.x = -.5 + Math.sin(a.t * 3) * .6; if (k >= 1) { a.site.visible = false; const p = Math.min(1, (a.t - 3.2) / .5), b = 1 + Math.sin(p * Math.PI) * .12; a.inner.scale.set(a.sc * b, a.sc * b, a.sc * b); if (p >= 1) { a.inner.scale.setScalar(a.sc); a.done = true; } } } else a.done = a.t > 1; } if (this.anims) this.anims = this.anims.filter(a => !a.done);
    if (this.roadCars) for (const c of this.roadCars) { c.t = (c.t + dt * c.sp + 1) % 1; const p = c.curve.getPoint(c.t), q = c.curve.getPoint(Math.min(1, c.t + .004)); c.car.position.set(p.x, p.y + (c.lift || c.rad * .9), p.z); c.car.lookAt(q.x, q.y + (c.lift || c.rad * .9), q.z); }
    this.controls.update(); this.renderer.render(this.scene, this.cam);
  }
  dispose() { this.disposed = true; clearTimeout(this.dprune); cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose(); this.clear(); this.bump?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
