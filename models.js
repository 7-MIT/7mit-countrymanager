// Model bangunan 3D (sama dengan /classic) — dipakai di Negara 3D
import * as THREE from './lib/three.module.js';
const BM = { grass: 0x4caf50, hill: 0x2e7d32, sand: 0xe8d9a0, tree: 0x2e8b3a, trunk: 0x6b4a2b, snow: 0 };
class Kit {
  constructor() { this._mc = {}; this._fc = {}; this.nightMats = []; this.bm = BM; this._tex(); }
  M(color, o = {}) { const k = color + JSON.stringify(o); return this._mc[k] || (this._mc[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o })); }
  facade(color) { if (!this._fc[color]) { const m = new THREE.MeshStandardMaterial({ color, map: this.winTex, emissiveMap: this.winEmit, emissive: 0xffd08a, emissiveIntensity: 0, roughness: 0.55, metalness: 0.1 }); this._fc[color] = m; this.nightMats.push(m); } return this._fc[color]; }
  _tex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const e = document.createElement('canvas'); e.width = e.height = 128; const y = e.getContext('2d');
    x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, 128, 128); y.fillStyle = '#000'; y.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const px = k * 32 + 6, py = r * 32 + 6; x.fillStyle = '#4b6b8f'; x.fillRect(px, py, 20, 20); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px, py, 20, 6); if (Math.random() < 0.62) { y.fillStyle = Math.random() < 0.5 ? '#ffd48a' : '#fff0c8'; y.fillRect(px, py, 20, 20); } }
    this.winTex = new THREE.CanvasTexture(c); this.winEmit = new THREE.CanvasTexture(e);
    for (const t of [this.winTex, this.winEmit]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  }
  _tree(g, x, y, z, s = 1, kind) {
    const bm = this.bm, hash = (a, b) => { const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return q - Math.floor(q); };
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.5 * s, 6), this.M(bm.trunk)); t.position.set(x, y + 0.25 * s, z); t.castShadow = true; g.add(t);
    const colv = new THREE.Color(bm.tree).offsetHSL((hash(x, z) - 0.5) * 0.04, 0, (hash(z, x) - 0.5) * 0.08);
    if (kind === 'pine') { for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((0.5 - k * 0.12) * s, 0.55 * s, 7), this.M(colv.getHex())); c.position.set(x, y + (0.7 + k * 0.38) * s, z); c.castShadow = true; g.add(c); } }
    else { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 0), this.M(colv.getHex())); c.position.set(x, y + 0.85 * s, z); c.castShadow = true; g.add(c); }
  }
}
const WHITE = 0xf2efe8, BRICK = 0xc96f4a, RED = 0xb5472f, GRAY = 0x5d6670, CONC = 0xb8bcc2, DARK = 0x3a3f46, GLASS = 0x7fb5d9;

function H(N, g) {
  const h = {};
  h.bx = (w, hh, d, m, x = 0, y = 0, z = 0, p = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); o.position.set(x, y + hh / 2, z); p.add(o); return o; };
  h.cy = (rt, rb, hh, m, x = 0, y = 0, z = 0, seg = 16, p = g) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), m); o.position.set(x, y + hh / 2, z); p.add(o); return o; };
  h.pyr = (r, hh, m, x, y, z, sx = 1, sz = 1, p = g) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 4), m); o.rotation.y = Math.PI / 4; o.position.set(x, y + hh / 2, z); o.scale.set(sx, 1, sz); p.add(o); return o; };
  h.sph = (r, m, x, y, z, p = g) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.position.set(x, y, z); p.add(o); return o; };
  h.tower = (w, hh, d, color, x, y, z, roof = GRAY) => {
    const geo = new THREE.BoxGeometry(w, hh, d), uv = geo.attributes.uv, cols = Math.max(1, Math.round(w / 2)), rows = Math.max(1, Math.round(hh / 2.2));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * cols, uv.getY(i) * rows);
    const o = new THREE.Mesh(geo, N.facade(color)); o.position.set(x, y + hh / 2, z); g.add(o);
    h.bx(w + 0.12, 0.14, d + 0.12, N.M(roof), x, y + hh, z); return o;
  };
  h.house = (x, z, s = 1, wall = WHITE, roof = RED) => { h.bx(1.1 * s, 0.8 * s, 1.0 * s, N.M(wall), x, 0, z); h.pyr(0.95 * s, 0.6 * s, N.M(roof), x, 0.8 * s, z); h.bx(0.2 * s, 0.4 * s, 0.05, N.M(0x5a3b22), x, 0, z + 0.5 * s); };
  h.palm = (x, z, s = 1) => { const t = h.cy(0.05 * s, 0.08 * s, 1.2 * s, N.M(0x8a6a3c), x, 0, z, 6); t.rotation.z = 0.12; for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.8 * s, 4), N.M(0x2e9a45)); l.position.set(x + 0.1, 1.25 * s, z); l.rotation.set(Math.PI / 2.4, k * 1.05, 0); l.rotateX(0); l.translateY(0.3 * s); g.add(l); } };
  return h;
}

const BUILD = {
  housing(L, g, c) {
    const h = H(this, g), r = [];
    if (L === 1) { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) h.house(x, z, 1, [WHITE, 0xf5dfb8, 0xd9e8f2][Math.floor(Math.abs(x * 7 + z * 3)) % 3], [RED, 0x6b4a3a, 0x3f6fa0][Math.floor(Math.abs(x * 5 + z)) % 3]); }
    else if (L === 2) { h.tower(1.5, 3.2, 1.5, 0xf0e6d6, -1, 0, -1); h.tower(1.5, 2.6, 1.5, 0xe6eef5, 1, 0, -1); h.house(-1, 1.1, 1.05); h.house(1, 1.1, 1.05, 0xf5dfb8); }
    else { h.bx(3.7, 0.3, 3.7, this.M(0x9aa3aa)); h.tower(1.3, 5.6, 1.3, 0xe8eef4, -1.1, 0.3, -1.1); h.tower(1.3, 4.4, 1.3, 0xf0e6d6, 1.1, 0.3, -1.1); h.tower(1.3, 3.4, 1.3, 0xe6eef5, -1.1, 0.3, 1.1); h.tower(1.3, 6.4, 1.3, 0xdfe7ee, 1.1, 0.3, 1.1); this._tree(g, 0, 0.3, 0, 0.8); }
    return { anim: r };
  },
  school(L, g) {
    const h = H(this, g), an = [];
    h.bx(3.6, 0.12, 3.6, this.M(0xaebf9b));
    h.tower(3.0, 1.3, 1.5, 0xf3dcb4, 0, 0.1, -0.7, RED);
    h.bx(0.9, 0.9, 0.06, this.M(0x28445f), 0, 0.2, 0.06);
    h.bx(0.5, 2.1, 0.5, this.M(0xf3dcb4), 1.1, 0.1, -0.7); h.pyr(0.5, 0.45, this.M(RED), 1.1, 2.2, -0.7);
    h.sph(0.15, this.M(0xffffff), 1.1, 1.8, -0.43);
    const pole = h.cy(0.02, 0.02, 1.8, this.M(0xdddddd), -1.4, 0.1, 1.2, 6);
    h.bx(0.5, 0.3, 0.02, this.M(0xdd2222), -1.15, 1.5, 1.2);
    if (L >= 2) { h.tower(1.3, 1.1, 1.3, 0xf3dcb4, -1.3, 0.1, 0.5, RED); h.tower(1.3, 1.1, 1.3, 0xf3dcb4, 1.3, 0.1, 0.9, RED); }
    if (L >= 3) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.M(0x9ad0e0, { metalness: 0.6, roughness: 0.2 })); d.position.set(0, 1.4, -0.7); g.add(d); h.cy(0.85, 0.85, 0.25, this.M(WHITE), 0, 1.2, -0.7); this._tree(g, -1.6, 0.1, -1.5, 0.7); this._tree(g, 1.6, 0.1, 1.6, 0.7); }
    return { anim: an };
  },
  hospital(L, g) {
    const h = H(this, g), an = [];
    h.bx(3.6, 0.1, 3.6, this.M(0xcfd6dc));
    const hh = 1.8 + L * 0.9;
    h.tower(2.4, hh, 1.8, 0xffffff, -0.2, 0.1, -0.5, 0xdddddd);
    if (L >= 2) h.tower(1.1, hh * 0.65, 1.2, 0xf4f8fb, 1.35, 0.1, -0.2, 0xdddddd);
    const red = this.M(0xdd2233, { emissive: 0x330000 });
    h.bx(0.7, 0.1, 0.22, red, -0.2, 0.1 + hh + 0.14, -0.5); h.bx(0.22, 0.1, 0.7, red, -0.2, 0.1 + hh + 0.14, -0.5);
    const amb = new THREE.Group(); h.bx(0.7, 0.35, 0.34, this.M(0xffffff), 0, 0.1, 0, amb); h.bx(0.15, 0.06, 0.36, red, 0, 0.45, 0, amb); amb.position.set(-1.0, 0, 1.3); g.add(amb);
    const beacon = h.sph(0.06, new THREE.MeshBasicMaterial({ color: 0xff2233 }), -1.0, 0.55, 1.3);
    an.push((dt, t) => { beacon.visible = Math.sin(t * 8) > 0; });
    if (L >= 3) { h.bx(1.2, 0.05, 1.2, this.M(0x4a4f56), 1.2, 0.1, 1.2); const hp = new THREE.Group(); hp.position.set(1.2, 0.25, 1.2); h.bx(0.5, 0.25, 0.28, this.M(0xe8e8e8), 0, 0, 0, hp); const rot = h.cy(0.02, 0.02, 0.05, this.M(0x222222), 0, 0.28, 0, 6, hp); const bl = h.bx(1.1, 0.02, 0.06, this.M(0x222222), 0, 0.3, 0, hp); g.add(hp); an.push((dt, t) => { bl.rotation.y += dt * 25; hp.position.y = 0.25 + Math.max(0, Math.sin(t * 0.4)) * 1.6; }); }
    return { anim: an };
  },
  factory(L, g) {
    const h = H(this, g), emit = [];
    h.bx(3.8, 0.1, 3.8, this.M(0x8a8e94));
    h.bx(2.8, 1.3, 1.6, this.M(0x9aa3ab, { metalness: 0.3 }), -0.3, 0.1, 0.6);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.6), this.M(0x6d7680)); s.position.set(-1.2 + k * 0.9, 1.65, 0.6); s.rotation.z = -0.25; g.add(s); }
    const n = L; for (let k = 0; k < n; k++) { const x = -1.2 + k * 0.7; h.cy(0.2, 0.26, 3.0 + k * 0.3, this.M(0xa0522d), x, 0.1, -1.3, 12); h.cy(0.22, 0.22, 0.2, this.M(0xeeeeee), x, 2.5 + k * 0.3, -1.3, 12); emit.push({ x, y: 3.2 + k * 0.3, z: -1.3, rate: 1, color: 0xcfcfcf, size: 0.8 }); }
    h.cy(0.5, 0.5, 1.2, this.M(0xdde3e8, { metalness: 0.6, roughness: 0.3 }), 1.45, 0.1, -1.0); h.cy(0.5, 0.5, 1.2, this.M(0xdde3e8, { metalness: 0.6, roughness: 0.3 }), 1.45, 0.1, 0.1);
    h.bx(1.0, 0.5, 0.6, this.M(0x2e6fb0), 1.2, 0.1, 1.5); if (L >= 2) h.bx(1.0, 0.5, 0.6, this.M(0xd9a21b), 0.1, 0.1, 1.7);
    if (L >= 3) { h.bx(1.5, 0.9, 1.0, this.M(0xaab2ba), -1.3, 0.1, -1.4); }
    return { emit };
  },
  farm(L, g) {
    const h = H(this, g), an = [];
    h.bx(3.8, 0.06, 3.8, this.M(0x6b4a2b));
    const rows = 4 + L; for (let k = 0; k < rows; k++) { h.bx(2.2, 0.14, 0.22, this.M(k % 2 ? 0x8fc044 : 0x5da832), -0.8, 0.06, -1.7 + k * 0.5); }
    h.bx(1.0, 0.8, 0.9, this.M(0xb43a2f), 1.4, 0.06, -1.2); h.pyr(0.8, 0.5, this.M(0x7a2a22), 1.4, 0.86, -1.2, 1.1, 1);
    h.cy(0.28, 0.28, 1.2, this.M(0xd0d5da, { metalness: 0.5 }), 1.5, 0.06, 0.1); h.sph(0.28, this.M(0xaeb4ba), 1.5, 1.26, 0.1);
    const tr = new THREE.Group(); h.bx(0.5, 0.25, 0.3, this.M(0x2e8b3a), 0, 0.1, 0, tr); h.bx(0.2, 0.2, 0.25, this.M(0x2e8b3a), 0.15, 0.3, 0, tr); tr.position.set(-0.8, 0.06, 1.3); g.add(tr);
    an.push((dt, t) => { tr.position.x = -1.5 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 2.2; tr.rotation.y = Math.cos(t * 0.6) > 0 ? 0 : Math.PI; });
    if (L >= 3) { const gh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0xcfeee0, transparent: true, opacity: 0.45, roughness: 0.1 })); gh.position.set(1.3, 0.4, 1.4); g.add(gh); h.bx(1.2, 0.12, 0.7, this.M(0x4caf50), 1.3, 0.1, 1.4); }
    return { anim: an };
  },
  solar(L, g) {
    const h = H(this, g); h.bx(3.8, 0.08, 3.8, this.M(0xaab0b5));
    const pm = this.M(0x1d3f78, { metalness: 0.8, roughness: 0.18, emissive: 0x0a1633 }), cols = L === 3 ? 3 : 2, rows = L + 1;
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.7), pm); p.position.set(-1.2 + a * 1.2 - (cols === 3 ? 0 : -0.6), 0.55, -1.5 + b * (3.2 / rows) + 0.4); p.rotation.x = -0.55; g.add(p);
      const post = h.cy(0.04, 0.04, 0.5, this.M(0x888888), p.position.x, 0.08, p.position.z, 6);
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7, 4, 2), new THREE.MeshBasicMaterial({ color: 0x8fb4ee, wireframe: true, transparent: true, opacity: 0.25 })); grid.rotation.x = -Math.PI / 2 - 0.55; grid.position.copy(p.position); grid.position.y += 0.03; g.add(grid);
    }
    h.bx(0.5, 0.45, 0.4, this.M(0xe0e0e0), 1.5, 0.08, 1.6);
    return {};
  },
  wind(L, g) {
    const h = H(this, g), an = []; h.bx(3.8, 0.08, 3.8, this.M(0xb3bbb2));
    const pos = L === 1 ? [[0, 0]] : L === 2 ? [[-0.9, -0.7], [0.9, 0.6]] : [[-1.1, -1.0], [1.1, -0.4], [0, 1.2]];
    pos.forEach(([x, z], i) => {
      h.cy(0.06, 0.12, 4.4, this.M(0xf4f6f8), x, 0.08, z, 10); h.bx(0.2, 0.2, 0.5, this.M(0xe8ecee), x, 4.4, z);
      const rot = new THREE.Group(); rot.position.set(x, 4.55, z + 0.3); const hub = h.sph(0.1, this.M(0xdddddd), 0, 0, 0, rot);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.03), this.M(0xffffff)); b.position.y = 0.95; const piv = new THREE.Group(); piv.rotation.z = k * Math.PI * 2 / 3; piv.add(b); rot.add(piv); }
      g.add(rot); an.push((dt, t) => { rot.rotation.z += dt * (0.9 + i * 0.12); });
    });
    return { anim: an };
  },
  coal(L, g) {
    const h = H(this, g), emit = []; h.bx(3.8, 0.1, 3.8, this.M(0x4a4d52));
    h.bx(2.4, 1.2, 1.4, this.M(0x4b5159), -0.6, 0.1, 1.0); h.bx(2.4, 0.1, 1.4, this.M(0x2a2d31), -0.6, 1.3, 1.0);
    const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(0.62 + Math.pow(t - 0.62, 2) * 1.0 + 0.0, t * 3.2)); }
    const cool = (x, z) => { const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), this.M(0xcfd2d6, { roughness: 0.9 })); m.position.set(x, 0.1, z); g.add(m); emit.push({ x, y: 3.35, z, rate: 1.6, color: 0xf2f2f2, size: 1.3 }); };
    cool(-0.9, -0.9); if (L >= 2) cool(0.7, -0.9);
    h.cy(0.12, 0.16, 3.6, this.M(0x7a4b3a), 1.5, 0.1, 0.4, 10); emit.push({ x: 1.5, y: 3.7, z: 0.4, rate: 1.2, color: 0x6b6b6b, size: 0.9 });
    if (L >= 3) { h.cy(0.12, 0.16, 3.2, this.M(0x7a4b3a), 1.5, 0.1, 1.2, 10); emit.push({ x: 1.5, y: 3.3, z: 1.2, rate: 1.2, color: 0x555555, size: 0.9 }); }
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 8), this.M(0x151618)); c.position.set(-1.6 + k * 0.6, 0.35, -1.6); g.add(c); }
    return { emit };
  },
  port(L, g, ctx) {
    const root = new THREE.Group(); root.rotation.y = ctx.outward; g.add(root); const h = H(this, root), an = [];
    h.bx(3.9, 0.1, 3.9, this.M(0x8a8f94), 0, 0, 0); h.bx(4.4, 0.25, 2.4, this.M(0x7b8085), 0, -0.1, 3.0);
    h.bx(3.0, 1.1, 1.1, this.M(0x9aa3ab), 0, 0.1, -1.4); h.bx(3.0, 0.1, 1.1, this.M(0x586069), 0, 1.2, -1.4);
    const cc = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7043, 0x8e24aa], r = (n) => (Math.sin(n * 91.7) * 0.5 + 0.5);
    for (let a = 0; a < 3 + L; a++) for (let b = 0; b < 2; b++) { const n = 1 + Math.floor(r(a + b * 7) * (L + 1)); for (let k = 0; k < Math.min(n, 3); k++) h.bx(0.8, 0.34, 0.4, this.M(cc[(a * 3 + b + k) % cc.length]), -1.4 + a * 0.85, 0.1 + k * 0.34, -0.2 + b * 0.55); }
    // gantri
    const gan = new THREE.Group(); gan.position.set(0, 0.2, 2.0); h.bx(0.12, 2.4, 0.12, this.M(0xf6b800), -0.7, 0, -0.5, gan); h.bx(0.12, 2.4, 0.12, this.M(0xf6b800), 0.7, 0, -0.5, gan); h.bx(0.12, 2.4, 0.12, this.M(0xf6b800), -0.7, 0, 0.5, gan); h.bx(0.12, 2.4, 0.12, this.M(0xf6b800), 0.7, 0, 0.5, gan); h.bx(1.6, 0.14, 2.6, this.M(0xf6b800), 0, 2.4, 0.3, gan);
    const trolley = h.bx(0.3, 0.3, 0.3, this.M(0x444444), 0, 2.1, 0, gan); g.add(gan); an.push((dt, t) => { gan.position.x = Math.sin(t * 0.4) * 1.4; });
    const mk = (x, col, i) => { const s = new THREE.Group(); const hu = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 1.0), this.M(0x2f3b45)); hu.position.y = 0.0; const cb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.8), this.M(0xffffff)); cb.position.set(-1.1, 0.6, 0); s.add(hu, cb); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.7), this.M(cc[(k + i) % cc.length])); c.position.set(-0.4 + k * 0.6, 0.45, 0); s.add(c); } s.position.set(x, 0.0, 3.4); root.add(s); s.traverse(o => o.castShadow = true); return s; };
    const sh = mk(0, 0, 0); an.push((dt, t) => { sh.position.y = Math.sin(t * 1.2) * 0.05; sh.rotation.z = Math.sin(t * 0.9) * 0.015; });
    if (L >= 2) { const s2 = mk(-1.2, 0, 2); s2.scale.setScalar(0.001); s2.visible = false; }
    return { anim: an };
  },
  airport(L, g) {
    const h = H(this, g), an = [];
    h.bx(3.9, 0.1, 3.9, this.M(0x7f8489));
    h.bx(3.8, 0.04, 0.9, this.M(0x2b2d31), 0, 0.1, 1.2); for (let k = 0; k < 6; k++) h.bx(0.3, 0.01, 0.06, this.M(0xffffff), -1.5 + k * 0.6, 0.14, 1.2);
    h.tower(2.2, 0.9 + L * 0.2, 0.9, 0xcfe3f2, -0.3, 0.1, -0.5, 0x888888);
    h.cy(0.17, 0.2, 1.6, this.M(0xe8e8e8), 1.5, 0.1, -1.2, 12); h.cy(0.28, 0.2, 0.35, this.M(0x7fb5d9, { metalness: 0.7, roughness: 0.1 }), 1.5, 1.7, -1.2, 12);
    const beacon = h.sph(0.07, new THREE.MeshBasicMaterial({ color: 0xff2233 }), 1.5, 2.2, -1.2); an.push((d, t) => { beacon.visible = Math.sin(t * 5) > 0; });
    if (L >= 2) h.tower(1.0, 0.8, 1.0, 0xd5e6f2, 1.3, 0.1, 0.0, 0x888888);
    if (L >= 3) h.tower(1.0, 0.9, 1.4, 0xd5e6f2, -1.5, 0.1, -1.4, 0x888888);
    // pesawat
    const plane = new THREE.Group(); const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 1.1, 10), this.M(0xf4f4f4, { metalness: 0.4, roughness: 0.3 })); fus.rotation.z = Math.PI / 2; plane.add(fus);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 10), this.M(0xf4f4f4)); nose.rotation.z = -Math.PI / 2; nose.position.x = 0.68; plane.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 1.4), this.M(0xdde3ea)); wing.position.set(0.05, 0, 0); plane.add(wing); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.03), this.M(0x2e6fb0)); tail.position.set(-0.5, 0.17, 0); plane.add(tail); const th = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.5), this.M(0xdde3ea)); th.position.set(-0.52, 0.05, 0); plane.add(th);
    plane.traverse(o => o.castShadow = true); plane.scale.setScalar(1.3); g.add(plane);
    const curve = new THREE.CatmullRomCurve3([[-2, 0.28, 1.2], [1.2, 0.28, 1.2], [4, 1.2, 1.2], [9, 5, 0], [15, 10, -8], [9, 14, -17], [-6, 13, -15], [-15, 9, -6], [-11, 4, 5], [-6, 1.6, 4.5], [-3.2, 0.5, 2.6], [-2.4, 0.3, 1.3]].map(p => new THREE.Vector3(...p)), true, 'catmullrom', 0.3);
    let u = Math.random();
    an.push((dt) => { u = (u + dt * 0.018) % 1; const p = curve.getPoint(u), tg = curve.getTangent(u); plane.position.copy(p); plane.rotation.y = -Math.atan2(tg.z, tg.x); plane.rotation.z = Math.asin(Math.max(-1, Math.min(1, tg.y))); });
    return { anim: an };
  },
  base(L, g) {
    const h = H(this, g), an = []; h.bx(3.9, 0.1, 3.9, this.M(0x6f7a5a));
    const olive = this.M(0x5e6b3f), dk = this.M(0x3d4a2a);
    h.bx(3.7, 0.35, 0.1, this.M(0x777b72), 0, 0.1, 1.9); h.bx(0.1, 0.35, 3.7, this.M(0x777b72), -1.9, 0.1, 0); h.bx(0.1, 0.35, 3.7, this.M(0x777b72), 1.9, 0.1, 0);
    const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.8, 16, 1, false, 0, Math.PI), this.M(0x6a7a52)); hg.rotation.z = Math.PI / 2; hg.rotation.y = Math.PI / 2; hg.position.set(-0.8, 0.1, -1.0); hg.scale.set(1, 1, 1); g.add(hg);
    h.bx(1.8, 1.4, 1.6, this.M(0x66724c), -0.8, 0.1, -1.0).visible = false;
    h.tower(1.5, 1.2, 1.2, 0xb9c0a8, 1.1, 0.1, -1.3, 0x4a5538);
    h.cy(0.07, 0.1, 1.8, this.M(0xd0d0d0), -1.5, 0.1, 1.2, 8);
    const dish = new THREE.Group(); dish.position.set(1.3, 2.0, 0.6); h.cy(0.07, 0.1, 1.6, this.M(0xbbbbbb), 1.3, 0.1, 0.6, 8); const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), this.M(0xe6e6e6, { side: THREE.DoubleSide })); bowl.rotation.x = -Math.PI / 2.4; dish.add(bowl); g.add(dish);
    an.push((dt) => { dish.rotation.y += dt * 1.2; });
    const tank = (x, z) => { const t = new THREE.Group(); h.bx(0.8, 0.22, 0.5, dk, 0, 0.1, 0, t); h.bx(0.4, 0.18, 0.36, olive, -0.05, 0.32, 0, t); h.cy(0.03, 0.03, 0.55, dk, 0.4, 0.38, 0, 6, t).rotation.z = Math.PI / 2; t.position.set(x, 0, z); g.add(t); return t; };
    tank(-0.2, 1.1); if (L >= 2) tank(0.9, 1.3); if (L >= 3) { tank(-1.3, 0.2); const mis = h.cy(0.1, 0.12, 1.0, this.M(0xe9e9e9), 0.2, 0.1, 0.2, 10); h.cy(0.0, 0.1, 0.3, this.M(0xdd3333), 0.2, 1.1, 0.2, 10); }
    const flag = h.bx(0.4, 0.25, 0.02, this.M(0xdd2222), -1.3, 1.4, 1.2);
    return { anim: an };
  },
  techhub(L, g) {
    const h = H(this, g), an = []; h.bx(3.9, 0.1, 3.9, this.M(0xaeb7c0));
    const gl = this.M(0x5ab0e0, { metalness: 0.9, roughness: 0.08, emissive: 0x0a3a66, emissiveIntensity: 0.5 });
    const tow = h.bx(1.5, 4.2 + L * 0.7, 1.5, gl, -0.3, 0.1, -0.3);
    for (let k = 1; k < 5 + L; k++) h.bx(1.56, 0.04, 1.56, this.M(0xdde6ee), -0.3, 0.1 + k * 0.85, -0.3);
    if (L >= 2) h.bx(1.1, 2.6, 1.1, gl, 1.2, 0.1, 0.9); h.bx(1.8, 0.5, 1.8, this.M(0xf0f4f8), -0.3, 0.1, 1.2);
    const top = 0.1 + 4.2 + L * 0.7;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: 0x5ff3ff })); ring.rotation.x = Math.PI / 2; ring.position.set(-0.3, top + 0.7, -0.3); g.add(ring);
    const holo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshBasicMaterial({ color: 0x5ff3ff, wireframe: true })); holo.position.copy(ring.position); g.add(holo);
    h.cy(0.03, 0.04, 0.9, this.M(0xdddddd), -0.3, top + 0.1, -0.3, 6);
    an.push((dt, t) => { ring.rotation.z += dt * 1.4; holo.rotation.y += dt * 1.2; holo.rotation.x += dt * 0.7; holo.position.y = top + 0.7 + Math.sin(t * 2) * 0.08; });
    if (L >= 3) { h.tower(1.1, 2.0, 1.1, 0xdfe7ee, -1.5, 0.1, 1.5, 0x777777); this._tree(g, 1.5, 0.1, -1.6, 0.6); }
    return { anim: an };
  },
  park(L, g) {
    const h = H(this, g); h.bx(3.9, 0.08, 3.9, this.M(0x62b04a));
    const pond = h.cy(0.9, 0.9, 0.04, this.M(0x4aa8d8, { roughness: 0.1, metalness: 0.2 }), 0.4, 0.08, 0.3, 20); pond.scale.z = 0.7;
    const n = 7 + L * 4, r = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < n; i++) { const x = (r(i) - 0.5) * 3.4, z = (r(i + 50) - 0.5) * 3.4; if (Math.hypot(x - 0.4, (z - 0.3) / 0.7) < 1.05) continue; this._tree(g, x, 0.08, z, 0.8 + r(i + 9) * 0.7, i % 4 === 0 ? 'pine' : undefined); }
    h.bx(0.5, 0.18, 0.18, this.M(0x7a5a38), -1.4, 0.08, 1.2); h.bx(0.5, 0.18, 0.18, this.M(0x7a5a38), 1.3, 0.08, -1.2);
    if (L >= 2) { h.cy(0.5, 0.5, 0.1, this.M(0xe7e0cf), -1.2, 0.08, -1.2, 8); h.pyr(0.6, 0.35, this.M(0xb5472f), -1.2, 1.2, -1.2); for (const [a, b] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) h.cy(0.03, 0.03, 1.1, this.M(0xffffff), -1.2 + a, 0.18, -1.2 + b, 6); }
    if (L >= 3) { h.bx(0.8, 0.05, 0.8, this.M(0xd33a2c), 1.3, 0.08, 1.2); h.bx(0.04, 0.5, 0.04, this.M(0x888888), 1.0, 0.1, 1.5); h.bx(0.04, 0.5, 0.04, this.M(0x888888), 1.6, 0.1, 1.5); h.bx(0.64, 0.04, 0.04, this.M(0x888888), 1.3, 0.58, 1.5); }
    return {};
  },
  resort(L, g, c) {
    const root = new THREE.Group(); root.rotation.y = c.outward; g.add(root); const h = H(this, root);
    h.bx(3.9, 0.08, 3.9, this.M(0xf0dfae)); h.bx(3.9, 0.06, 1.2, this.M(0xf3e6b8), 0, 0.02, 1.4);
    h.tower(2.4, 1.8 + L * 0.9, 1.0, 0xfaf6ec, -0.3, 0.08, -1.2, 0xcfc5b0);
    for (let k = 0; k < 2 + L; k++) h.bx(2.5, 0.05, 1.2, this.M(0xe8dcc4), -0.3, 0.9 + k * 0.9, -1.15);
    if (L >= 3) h.tower(1.0, 4.2, 1.0, 0xfaf6ec, 1.3, 0.08, -0.6, 0xcfc5b0);
    const pool = h.bx(1.5, 0.05, 0.8, this.M(0x4fd0ff, { roughness: 0.05, metalness: 0.1, emissive: 0x0a4a66, emissiveIntensity: 0.3 }), -0.5, 0.06, 0.1); h.bx(1.7, 0.04, 1.0, this.M(0xf6f2e8), -0.5, 0.04, 0.1);
    h.palm(1.4, 0.6, 1); h.palm(-1.6, 0.5, 0.9); h.palm(1.6, 1.4, 1.1); if (L >= 2) h.palm(-1.5, 1.5, 1);
    for (const x of [0.4, 0.9]) { h.cy(0.02, 0.02, 0.7, this.M(0xdddddd), x, 0.06, 0.6, 5); const u = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.18, 10), this.M(x < 0.6 ? 0xe53935 : 0xfdd835)); u.position.set(x, 0.8, 0.6); root.add(u); }
    return {};
  },
  anticorr(L, g) {
    const h = H(this, g); h.bx(3.9, 0.08, 3.9, this.M(0xb7b3a8)); const st = this.M(0xe6dfce), gd = this.M(0xe3b341, { metalness: 0.7, roughness: 0.3 });
    h.bx(3.6, 0.2, 2.8, st, 0, 0.08, 0); h.bx(3.3, 0.2, 2.5, st, 0, 0.28, 0); h.bx(3.0, 0.2, 2.2, st, 0, 0.48, 0);
    h.bx(2.6, 1.1 + L * 0.3, 1.4, this.M(0xefe9da), 0, 0.68, -0.4);
    for (let i = -2; i <= 2; i++) h.cy(0.12, 0.12, 1.1 + L * 0.3, st, i * 0.5, 0.68, 0.7, 12);
    h.bx(2.8, 0.12, 1.8, st, 0, 0.68 + 1.1 + L * 0.3, 0.1); h.pyr(1.6, 0.55, st, 0, 0.8 + 1.1 + L * 0.3, 0.1, 1.15, 0.65);
    const top = 0.8 + 1.1 + L * 0.3 + 0.6; h.cy(0.03, 0.03, 0.5, gd, 0, top, 0.1, 6); h.bx(0.8, 0.03, 0.03, gd, 0, top + 0.5, 0.1); h.cy(0.12, 0.12, 0.02, gd, -0.4, top + 0.4, 0.1, 10); h.cy(0.12, 0.12, 0.02, gd, 0.4, top + 0.4, 0.1, 10);
    return {};
  },
  rail(L, g) {
    const h = H(this, g), an = []; h.bx(3.9, 0.08, 3.9, this.M(0x8e949a));
    h.bx(3.9, 0.06, 0.8, this.M(0x4a4038), 0, 0.08, 1.2); h.bx(3.9, 0.03, 0.06, this.M(0xc0c4c8), 0, 0.14, 1.0); h.bx(3.9, 0.03, 0.06, this.M(0xc0c4c8), 0, 0.14, 1.4);
    h.bx(3.0, 0.14, 0.7, this.M(0xd6d2c8), 0, 0.08, 0.5);
    for (const x of [-1.3, 0, 1.3]) h.bx(0.1, 1.0, 0.1, this.M(0x667), x, 0.22, 0.5); h.bx(3.2, 0.1, 0.8, this.M(0x2e6fb0, { metalness: 0.3 }), 0, 1.22, 0.5);
    h.tower(2.4, 1.0 + L * 0.35, 1.2, 0xcfe0ef, 0, 0.08, -1.1, 0x777777);
    const tr = new THREE.Group(); const bodyM = this.M(0xf2f4f6, { metalness: 0.5, roughness: 0.25 }), stripe = this.M(0x1e88e5);
    for (let k = 0; k < 2 + L; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.34, 0.4), bodyM); c.position.set(k * 0.88, 0.32, 0); const s = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.41), stripe); s.position.set(k * 0.88, 0.28, 0); tr.add(c, s); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), bodyM); nose.rotation.z = Math.PI / 2; nose.position.set(-0.65, 0.32, 0); tr.add(nose); tr.traverse(o => o.castShadow = true); tr.position.set(-1.4, 0.1, 1.2); g.add(tr);
    an.push((dt, t) => { const u = (Math.sin(t * 0.35) * 0.5 + 0.5); const e = u * u * (3 - 2 * u); tr.position.x = -1.8 + e * (3.6 - (1 + L) * 0.88 + 0.5); });
    return { anim: an };
  },
};


export const kit = new Kit();
export function makeBuilding(type, level, grp, ctx = {}) { const f = BUILD[type]; return f ? (f.call(kit, level, grp, { outward: 0, seed: 1, ...ctx }) || {}) : {}; }
export const MODEL_TYPES = Object.keys(BUILD);
