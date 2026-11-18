// country.7mit — Medan Perang 3D: diorama taktis low-poly. Pimpin pasukan (infanteri, tank, artileri, serangan udara) merebut 3 titik bendera,
// menguras tiket lawan, dan menghancurkan markas. Kekuatan awal mengikuti PDB & kesiapan kedua negara. Hasil dipakai oleh game (perang sungguhan).
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { esc, ic, refreshIcons } from './core.js';

const WX = 170, WZ = 110, HQX = 70, PL = 1, EN = -1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// medan: lembah di tengah, bukit di tepi utara/selatan, dataran rata di sekitar markas
export function H(x, z) {
  let h = Math.sin(x * .07 + 1.3) * 1.6 + Math.sin(z * .09 + .5) * 1.2 + Math.sin((x + z) * .04) * 2.2 + Math.sin(x * .19) * Math.cos(z * .17) * .6;
  h += Math.pow(Math.max(0, Math.abs(z) / (WZ / 2) - .5), 2) * 20; h = h * .8 - Math.exp(-Math.pow(z / 22, 2)) * 1.2 + 1.6;
  const f = sm(54, 66, Math.abs(x)) * (1 - sm(26, 44, Math.abs(z))); return lerp(h, 1.2, f);
}
const TYPES = {
  inf: { name: 'Infanteri', hp: 46, sp: 3.4, rg: 16, dmg: 7, cd: .8, cost: 20, n: 3, acc: .72, tix: 1 },
  tank: { name: 'Tank', hp: 280, sp: 2.7, rg: 27, dmg: 36, cd: 2.4, cost: 45, splash: 3.6, acc: .82, tix: 4 },
  art: { name: 'Artileri', hp: 84, sp: 1.5, rg: 74, min: 18, dmg: 52, cd: 5, cost: 40, splash: 7, acc: .9, tix: 3 },
};
const FLAGS = [{ x: -26, z: -14 }, { x: 2, z: 12 }, { x: 28, z: -6 }];
const COL = { 1: 0xe8b04a, [-1]: 0x4da3d6 };

let G = null; // sesi aktif
export function closeWar3D() { if (G) { G.dispose(); G = null; } }

export function openWar3D(opts) {
  closeWar3D();
  const root = document.createElement('div'); root.className = 'w3'; root.id = 'war3d'; document.body.appendChild(root);
  root.innerHTML = `<div class="w3-stage"></div><div class="w3-ui"></div>`;
  const stage = root.querySelector('.w3-stage'), ui = root.querySelector('.w3-ui');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), SKY = new THREE.Color(0xc9dbe8); scene.background = SKY; scene.fog = new THREE.Fog(SKY, 150, 330);
  const camera = new THREE.PerspectiveCamera(48, 1, .5, 700);
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x6c5a3a, .95));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.35); sun.position.set(-70, 110, 50); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -95; sc.right = 95; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 320; scene.add(sun);

  // ---------- medan ----------
  const geo = new THREE.PlaneGeometry(WX, WZ, 90, 58); geo.rotateX(-Math.PI / 2); const pos = geo.attributes.position, colA = new Float32Array(pos.count * 3), cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = H(x, z); pos.setY(i, h); const t = clamp((h - 1) / 9, 0, 1), n = (Math.sin(x * 1.7) * Math.cos(z * 1.3)) * .04; cc.setRGB(lerp(.43, .6, t) + n, lerp(.5, .52, t) + n, lerp(.27, .4, t) + n); if (h < 0.4) cc.setRGB(.66, .6, .42); colA.set([cc.r, cc.g, cc.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(colA, 3)); geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); terrain.receiveShadow = true; scene.add(terrain);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x59693f, roughness: 1 })); ground.position.y = -1.5; scene.add(ground);
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  { // pohon & batu
    const tg = new THREE.ConeGeometry(1.6, 5, 6).translate(0, 3.6, 0), tr = new THREE.CylinderGeometry(.25, .35, 1.4, 5).translate(0, .7, 0);
    const trees = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x2f5a2f, flatShading: true }), 170), trunks = new THREE.InstancedMesh(tr, new THREE.MeshStandardMaterial({ color: 0x5b3d22 }), 170), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(); let n = 0;
    for (let k = 0; k < 900 && n < 170; k++) { const x = (rnd() - .5) * (WX - 8), z = (rnd() - .5) * (WZ - 8); if (Math.abs(x) > 56 && Math.abs(z) < 30) continue; if (FLAGS.some(f => Math.hypot(f.x - x, f.z - z) < 12)) continue; if (Math.abs(z) < 6 && Math.abs(x) < 50) continue; const s = .7 + rnd() * .9; pv.set(x, H(x, z), z); sv.set(s, s, s); m.compose(pv, q, sv); trees.setMatrixAt(n, m); trunks.setMatrixAt(n, m); n++; }
    trees.count = trunks.count = n; trees.castShadow = true; scene.add(trees, trunks);
    const rg = new THREE.DodecahedronGeometry(1.2), rocks = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x8a8578, flatShading: true }), 70); let r = 0;
    for (let k = 0; k < 400 && r < 70; k++) { const x = (rnd() - .5) * (WX - 8), z = (rnd() - .5) * (WZ - 8); if (Math.abs(x) > 60 && Math.abs(z) < 24) continue; const s = .5 + rnd() * 1.4; pv.set(x, H(x, z) + .3, z); q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)); sv.set(s, s * .7, s); m.compose(pv, q, sv); rocks.setMatrixAt(r++, m); }
    rocks.count = r; rocks.castShadow = true; scene.add(rocks);
  }
  const clouds = []; for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + rnd() * 8, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, fog: false })); c.scale.set(2.2, .55, 1.2); c.position.set((rnd() - .5) * 320, 70 + rnd() * 25, (rnd() - .5) * 200); scene.add(c); clouds.push(c); }

  // ---------- bahan & model ----------
  const MAT = {}, mat = (c, o = {}) => { const k = c + JSON.stringify(o); return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .85, ...o })); };
  const GEO = { body: new THREE.CylinderGeometry(.32, .38, 1, 6), head: new THREE.SphereGeometry(.26, 8, 6), helm: new THREE.SphereGeometry(.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), gun: new THREE.BoxGeometry(.12, .14, .95), legs: new THREE.BoxGeometry(.55, .6, .3), hull: new THREE.BoxGeometry(3.2, .9, 5), track: new THREE.BoxGeometry(.85, .8, 5.4), tur: new THREE.BoxGeometry(2, .75, 2.4), barrel: new THREE.CylinderGeometry(.14, .16, 3.6, 6).rotateX(Math.PI / 2), abase: new THREE.BoxGeometry(2.4, .7, 3.2), abar: new THREE.CylinderGeometry(.16, .22, 4.4, 6), ring: new THREE.RingGeometry(1.1, 1.4, 20).rotateX(-Math.PI / 2), bar: new THREE.PlaneGeometry(1, .16) };
  const dark = 0x2b2f2a, skin = 0xd9a77a;
  function mkInf(side) { const g = new THREE.Group(), cl = COL[side]; const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    add(GEO.legs, mat(dark), 0, .3, 0); const b = add(GEO.body, mat(cl), 0, 1.1, 0); add(GEO.head, mat(skin), 0, 1.78, 0); add(GEO.helm, mat(side === PL ? 0x6b5a2a : 0x2f4c63), 0, 1.82, 0); add(GEO.gun, mat(0x161616), .32, 1.2, .5); return g; }
  function mkTank(side) { const g = new THREE.Group(), cl = COL[side]; const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    add(g, GEO.track, mat(dark), -1.7, .5, 0); add(g, GEO.track, mat(dark), 1.7, .5, 0); add(g, GEO.hull, mat(cl), 0, 1.15, 0); const tur = new THREE.Group(); tur.position.y = 1.9; g.add(tur); add(tur, GEO.tur, mat(cl, { metalness: .2 }), 0, 0, 0); add(tur, GEO.barrel, mat(0x1c1f1b), 0, .05, 2.8); g.userData.tur = tur; return g; }
  function mkArt(side) { const g = new THREE.Group(), cl = COL[side]; const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    add(GEO.abase, mat(cl), 0, .6, 0); add(GEO.track, mat(dark), 0, .4, -1.6).scale.set(2.3, .6, .35); const bar = add(GEO.abar, mat(0x23261f), 0, 1.5, 1.3); bar.rotation.x = Math.PI / 2 - .7; return g; }
  function hpBar(w) { const g = new THREE.Group(), bg = new THREE.Mesh(GEO.bar, new THREE.MeshBasicMaterial({ color: 0x1a0a0a, transparent: true, opacity: .75, depthTest: false })), fg = new THREE.Mesh(GEO.bar, new THREE.MeshBasicMaterial({ color: 0x4ade80, depthTest: false })); bg.renderOrder = 10; fg.renderOrder = 11; fg.position.z = .01; g.add(bg, fg); g.scale.set(w, w, 1); g.userData.fg = fg; g.visible = false; return g; }

  // ---------- negara & kekuatan ----------
  const me = opts.me, enemy = opts.enemy, power = (c) => Math.sqrt(Math.max(1, c.gdp)) * (.4 + (c.readiness ?? 50) / 100), pr = clamp(power(me) / (power(me) + power(enemy)), .27, .73);
  const S = { t: 0, over: false, speed: 1, paused: false, auto: !!opts.auto, aim: false, units: [], shells: [], fx: [], pool: [], uid: 0, sel: new Set(), air: 0,
    side: { [PL]: { sup: 55 + pr * 55, tix: 260, flags: 0, lost: 0, kills: 0, aiT: 0, hq: null }, [EN]: { sup: 55 + (1 - pr) * 55, tix: 260, flags: 0, lost: 0, kills: 0, aiT: 0, hq: null } }, flags: [], marks: [] };

  // markas
  function mkHQ(side) { const g = new THREE.Group(), cl = COL[side], add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    add(new THREE.BoxGeometry(13, 3.2, 9), mat(0x8c8f86), 0, 1.6, 0); add(new THREE.BoxGeometry(13.4, .5, 9.4), mat(cl), 0, 3.4, 0); add(new THREE.BoxGeometry(5, 2.2, 4), mat(0x6f7268), 0, 4.8, 0); add(new THREE.CylinderGeometry(.12, .12, 6, 5), mat(0x222222), -4.5, 6.2, 0); add(new THREE.BoxGeometry(2.6, 1.5, .08), mat(cl), -3.2, 8.6, 0); const dish = add(new THREE.SphereGeometry(1.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xcfd2d6), 3, 6.1, 1); dish.rotation.x = -.8; return g; }
  for (const side of [PL, EN]) { const x = side * -HQX, g = mkHQ(side); g.position.set(x, H(x, 0), 0); if (side === EN) g.rotation.y = Math.PI; scene.add(g); const hp = 2000, bar = hpBar(9); bar.position.set(x, H(x, 0) + 12, 0); scene.add(bar); S.side[side].hq = { x, z: 0, hp, max: hp, bar, mesh: g, side }; }
  // bendera
  for (const f of FLAGS) { const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 8, 5), mat(0xdddddd)); pole.position.y = 4; g.add(pole); const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, .06), new THREE.MeshStandardMaterial({ color: 0xcccccc, flatShading: true })); cloth.position.set(1.45, 7.1, 0); g.add(cloth); const ring = new THREE.Mesh(new THREE.RingGeometry(8, 9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false })); ring.position.y = .3; g.add(ring); g.position.set(f.x, H(f.x, f.z), f.z); ring.position.y = .35; scene.add(g); S.flags.push({ x: f.x, z: f.z, p: 0, owner: 0, cloth, ring }); }

  // ---------- unit ----------
  const own = new THREE.Group(), foe = new THREE.Group(); scene.add(own, foe);
  function spawn(side, type, x, z, rally) { const T = TYPES[type], n = T.n || 1, out = [];
    for (let i = 0; i < n; i++) { const px = x + (Math.random() - .5) * 4 + (i - (n - 1) / 2) * 1.8, pz = z + (Math.random() - .5) * 4; const mesh = type === 'inf' ? mkInf(side) : type === 'tank' ? mkTank(side) : mkArt(side); const hb = hpBar(type === 'inf' ? 1.3 : 3); hb.position.y = type === 'inf' ? 2.6 : 4; mesh.add(hb); const ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false })); ring.scale.setScalar(type === 'inf' ? .8 : 2); ring.position.y = .15; ring.visible = false; mesh.add(ring); mesh.position.set(px, H(px, pz), pz); mesh.rotation.y = side === PL ? Math.PI / 2 : -Math.PI / 2; (side === PL ? own : foe).add(mesh);
      const u = { id: ++S.uid, side, type, T, mesh, hb, ring, hp: T.hp, max: T.hp, x: px, z: pz, yaw: mesh.rotation.y, cd: Math.random() * T.cd, dest: rally ? { x: rally.x + (Math.random() - .5) * 8, z: rally.z + (Math.random() - .5) * 8 } : null, focus: null, tgt: null, scan: Math.random() * .4, dead: false }; mesh.userData.uid = u.id; S.units.push(u); out.push(u); }
    return out; }
  const alive = (s) => S.units.filter(u => u.side === s && !u.dead), nearestFlagToHQ = (side) => FLAGS.map((f, i) => i).sort((a, b) => Math.abs(FLAGS[a].x + side * HQX) - Math.abs(FLAGS[b].x + side * HQX))[0];
  // pasukan awal
  { const n = (base, k) => Math.max(1, Math.round(base + k)), mk = (side, share) => { const sp = [-14, -4, 6, 16]; const hx = side * -HQX + side * 8; for (let i = 0; i < n(3, 4 * share); i++) spawn(side, 'inf', hx + (i % 3) * 3, sp[i % 4] - 6 + (i >> 2) * 3, FLAGS[i % 3]); for (let i = 0; i < n(1, 3 * share); i++) spawn(side, 'tank', hx + 4, -10 + i * 8, FLAGS[(i + 1) % 3]); for (let i = 0; i < n(1, 2 * share); i++) spawn(side, 'art', side * -HQX + side * 14, -8 + i * 8, null); }; mk(PL, pr); mk(EN, 1 - pr); }

  // ---------- efek ----------
  const fxGeo = { sph: new THREE.SphereGeometry(1, 10, 8), box: new THREE.BoxGeometry(1, 1, 1) };
  function puff(x, y, z, size, color, life, rise = 2) { const m = new THREE.Mesh(fxGeo.sph, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false })); m.position.set(x, y, z); m.scale.setScalar(size * .4); scene.add(m); S.fx.push({ m, t: 0, life, size, rise, kind: 'puff' }); }
  function boom(x, z, r) { const y = H(x, z) + .5; puff(x, y + .5, z, r * 1.6, 0xffa23a, .45, .5); puff(x, y + 1, z, r * 1.1, 0xfff2b0, .25, 0); for (let i = 0; i < 4; i++) puff(x + (Math.random() - .5) * r, y + 1 + Math.random() * 2, z + (Math.random() - .5) * r, r * 1.2, 0x555555, 1.4 + Math.random() * .6, 3); if (cam.d < 80) { const dx = camera.position.x - x, dz = camera.position.z - z; shake = Math.min(1.2, shake + r / Math.max(30, Math.hypot(dx, dz)) * 1.1); } }
  function tracer(a, b, col) { const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); const m = S.pool.pop() || new THREE.Mesh(fxGeo.box, new THREE.MeshBasicMaterial({ color: 0xffe9a0 })); m.material.color.setHex(col); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.scale.set(.07, .07, L); m.lookAt(b.x, b.y, b.z); m.visible = true; scene.add(m); S.fx.push({ m, t: 0, life: .09, kind: 'tr' }); }
  let shake = 0;
  function damage(u, d) { if (u.dead) return; u.hp -= d; u.hb.visible = true; u.hb.userData.fg.scale.x = Math.max(.001, u.hp / u.max); u.hb.userData.fg.position.x = -(1 - Math.max(.001, u.hp / u.max)) * .5; u.hb.userData.fg.material.color.setHex(u.hp / u.max > .5 ? 0x4ade80 : u.hp / u.max > .25 ? 0xfacc15 : 0xef4444); if (u.hp <= 0) kill(u); }
  function kill(u) { u.dead = true; const s = S.side[u.side]; s.tix -= u.T.tix; s.lost++; S.side[-u.side].kills++; S.sel.delete(u); u.hb.visible = false; u.ring.visible = false; u.dieT = 0; if (u.type === 'inf') { puff(u.x, u.mesh.position.y + 1, u.z, 1.2, 0x7a1d1d, .5, 0); } else { boom(u.x, u.z, u.type === 'tank' ? 4.5 : 3.5); u.mesh.traverse(o => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) o.material = mat(0x1d1d1b); }); } }
  function splash(x, z, r, d, side) { for (const u of S.units) { if (u.dead || u.side === side) continue; const dist = Math.hypot(u.x - x, u.z - z); if (dist < r) damage(u, d * (1 - dist / r * .6)); } const hq = S.side[-side].hq; if (hq.hp > 0 && Math.hypot(hq.x - x, hq.z - z) < r + 6) hurtHQ(hq, d * .6); boom(x, z, r); }
  function hurtHQ(hq, d) { if (hq.hp <= 0) return; hq.hp -= d; hq.bar.visible = true; const f = Math.max(.001, hq.hp / hq.max); hq.bar.userData.fg.scale.x = f; hq.bar.userData.fg.position.x = -(1 - f) * .5; if (hq.hp <= 0) { boom(hq.x, hq.z, 12); hq.mesh.traverse(o => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) o.material = mat(0x262421); }); hq.mesh.scale.y = .5; } }
  function shoot(u, tg) { const T = u.T, a = { x: u.x, y: u.mesh.position.y + (u.type === 'inf' ? 1.2 : 2.2), z: u.z }, ty = tg.hq ? tg.y : tg.mesh.position.y + (tg.type === 'inf' ? 1.1 : 1.4), b = { x: tg.x, y: ty, z: tg.z };
    if (u.type === 'art') { const dur = clamp(Math.hypot(b.x - a.x, b.z - a.z) / 40, 1.1, 2.4); S.shells.push({ a, b, t: 0, dur, arc: 28, dmg: T.dmg, r: T.splash, side: u.side, tank: false }); puff(u.x, a.y, u.z, 2.2, 0xdddddd, .5, 1); return; }
    const dist = Math.hypot(b.x - a.x, b.z - a.z), hit = Math.random() < T.acc * (1.1 - dist / T.rg * .5);
    if (u.type === 'tank') { S.shells.push({ a, b: hit ? b : { x: b.x + (Math.random() - .5) * 7, y: b.y, z: b.z + (Math.random() - .5) * 7 }, t: 0, dur: dist / 70, arc: 1.5, dmg: T.dmg, r: T.splash, side: u.side, tank: true }); puff(u.x + Math.sin(u.yaw) * 3, a.y, u.z + Math.cos(u.yaw) * 3, 1.6, 0xffe9a0, .15, 0); return; }
    tracer(a, hit ? b : { x: b.x + (Math.random() - .5) * 3, y: b.y, z: b.z + (Math.random() - .5) * 3 }, u.side === PL ? 0xffd470 : 0x9fe0ff); if (hit) { if (tg.hq) hurtHQ(tg, T.dmg * .35); else damage(tg, T.dmg * (.8 + Math.random() * .4)); } }

  // ---------- AI & perintah ----------
  function aiThink(side) { const s = S.side[side], mine = alive(side), foes = alive(-side), hq = s.hq;
    const cnt = (arr, t) => arr.filter(u => u.type === t).length, ft = cnt(foes, 'tank'), fi = cnt(foes, 'inf');
    for (let guard = 0; guard < 3 && mine.length < 46; guard++) { const w = { inf: 1.4, tank: ft < 3 ? 1.1 : .5, art: cnt(mine, 'art') < 4 ? .55 : .15 }; if (ft >= 3) w.art += .3; if (fi >= 8) w.tank += .5; const arr = Object.entries(w), tot = arr.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot, pick = 'inf'; for (const [k, v] of arr) { if ((r -= v) <= 0) { pick = k; break; } } if (s.sup < TYPES[pick].cost) break; s.sup -= TYPES[pick].cost; spawn(side, pick, hq.x + side * -8 * -1 - side * 0, hq.z + (Math.random() - .5) * 14, FLAGS[nearestFlagToHQ(side)]); mine.push(...[]); }
    const targets = FLAGS.map((f, i) => ({ i, f, st: S.flags[i], d: Math.abs(f.x + side * HQX) })).filter(o => o.st.owner !== side).sort((a, b) => a.d - b.d);
    const threatened = foes.filter(u => Math.hypot(u.x - hq.x, u.z - hq.z) < 40);
    let k = 0; for (const u of alive(side)) { if (u.focus && !u.focus.dead) continue; if (u.dest && Math.hypot(u.dest.x - u.x, u.dest.z - u.z) > 6 && u.aiK === Math.floor(S.t / 12)) continue; u.aiK = Math.floor(S.t / 12); k++;
      if (u.type === 'art') { const f = (targets[0]?.f) || { x: -side * 20, z: 0 }; u.dest = { x: lerp(hq.x, f.x, .55) + (Math.random() - .5) * 6, z: lerp(0, f.z, .6) + (Math.random() - .5) * 8 }; continue; }
      if (threatened.length && k % 3 === 0) { const t = threatened[0]; u.dest = { x: t.x, z: t.z }; continue; }
      const t = targets.length ? targets[(k % 2 && targets[1]) ? 1 : 0].f : null; u.dest = t ? { x: t.x + (Math.random() - .5) * 12, z: t.z + (Math.random() - .5) * 12 } : { x: -side * (HQX - 12) + (Math.random() - .5) * 6, z: (Math.random() - .5) * 20 }; } }
  function order(units, x, z, focus) { for (const u of units) { u.dest = focus ? null : { x: x + (Math.random() - .5) * Math.min(10, units.length * .7), z: z + (Math.random() - .5) * Math.min(10, units.length * .7) }; u.focus = focus || null; } }

  // ---------- simulasi ----------
  const hqList = [S.side[PL].hq, S.side[EN].hq];
  function step(dt) { if (S.over) return; S.t += dt; const sd = S.side;
    for (const s of [PL, EN]) { const o = sd[s]; const income = (s === PL ? 1.9 : 1.9 * (.65 + (1 - pr) * .9)) + o.flags * 1.1 + (s === PL ? pr : 1 - pr) * .8; o.sup = Math.min(260, o.sup + income * dt); o.aiT -= dt; if (((s === EN) || S.auto) && o.aiT <= 0) { o.aiT = 1.6 + Math.random(); aiThink(s); } }
    // unit
    for (const u of S.units) { if (u.dead) { u.dieT += dt; if (u.type === 'inf') { u.mesh.rotation.z = Math.min(Math.PI / 2, u.mesh.rotation.z + dt * 6); if (u.dieT > 3) u.mesh.position.y -= dt * .5; } else if (u.dieT < 9 && Math.random() < dt * 2.5) puff(u.x, u.mesh.position.y + 1.8, u.z, 1.5, 0x3a3a3a, 1.6, 3); continue; }
      const T = u.T, hqE = sd[-u.side].hq; u.cd -= dt; u.scan -= dt;
      if (u.focus && u.focus.dead) u.focus = null;
      if (u.scan <= 0) { u.scan = .35 + Math.random() * .15; let best = null, bd = 1e9; const rg = T.rg; if (u.focus) { best = u.focus; bd = Math.hypot(best.x - u.x, best.z - u.z); } else for (const e of S.units) { if (e.dead || e.side === u.side) continue; const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < bd && d <= rg && d >= (T.min || 0)) { bd = d; best = e; } } if (!best && hqE.hp > 0) { const d = Math.hypot(hqE.x - u.x, hqE.z - u.z); if (d <= rg + 5 && d >= (T.min || 0)) { best = { hq: true, x: hqE.x, z: hqE.z, y: H(hqE.x, 0) + 2, hp: hqE.hp, side: hqE.side, ref: hqE }; bd = d; } } u.tgt = best; u.tdist = bd; }
      let tg = u.tgt; if (tg && !tg.hq && tg.dead) tg = u.tgt = null; if (tg && tg.hq && tg.ref.hp <= 0) tg = u.tgt = null;
      const inRange = tg && Math.hypot(tg.x - u.x, tg.z - u.z) <= T.rg && Math.hypot(tg.x - u.x, tg.z - u.z) >= (T.min || 0);
      let moving = false;
      const turn = (want, rate) => { const dd = ((want - u.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; u.yaw += clamp(dd, -dt * rate, dt * rate); };
      if (inRange) { const want = Math.atan2(tg.x - u.x, tg.z - u.z); if (u.type === 'tank') { const tur = u.mesh.userData.tur, dd = ((want - u.yaw - tur.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; tur.rotation.y += clamp(dd, -dt * 3, dt * 3); } else if (!(u.dest && u.type === 'inf')) turn(want, 5);
        if (u.cd <= 0) { u.cd = T.cd * (.9 + Math.random() * .25); shoot(u, tg); } }
      const goal = u.focus ? { x: u.focus.x, z: u.focus.z } : u.dest;
      if (goal && (!inRange || (u.type === 'inf' && !u.focus) || u.focus)) { const dx = goal.x - u.x, dz = goal.z - u.z, d = Math.hypot(dx, dz), stop = u.focus ? Math.max(4, T.rg * .75) : 1.5;
        if (d > stop) { const slope = Math.abs(H(u.x + dx / d, u.z + dz / d) - H(u.x, u.z)), sp = T.sp * (1 - clamp(slope * .6, 0, .5)) * dt; let mx = dx / d * sp, mz = dz / d * sp;
          for (const o of S.units) { if (o === u || o.dead) continue; const ox = u.x - o.x, oz = u.z - o.z; if (Math.abs(ox) > 2.2 || Math.abs(oz) > 2.2) continue; const dd = Math.hypot(ox, oz) || .1; if (dd < 1.7) { mx += ox / dd * dt * 1.2; mz += oz / dd * dt * 1.2; } }
          u.x = clamp(u.x + mx, -WX / 2 + 4, WX / 2 - 4); u.z = clamp(u.z + mz, -WZ / 2 + 4, WZ / 2 - 4); moving = true; turn(Math.atan2(dx, dz), 4); if (u.type === 'tank' && !inRange) { const tur = u.mesh.userData.tur; tur.rotation.y *= .92; } }
        else if (!u.focus) u.dest = null; }
      u.mesh.position.set(u.x, H(u.x, u.z), u.z); u.mesh.rotation.y = u.yaw; if (u.type === 'inf' && moving) u.mesh.position.y += Math.abs(Math.sin(S.t * 9 + u.id)) * .12;
      if (u.type !== 'inf') { const hx = H(u.x + Math.sin(u.yaw), u.z + Math.cos(u.yaw)) - H(u.x, u.z); u.mesh.rotation.x = -Math.atan(hx) * .6; } }
    // markas menembak
    for (const hq of hqList) { if (hq.hp <= 0) continue; hq.cd = (hq.cd || 0) - dt; if (hq.cd > 0) continue; let best = null, bd = 34; for (const e of S.units) { if (e.dead || e.side === hq.side) continue; const d = Math.hypot(e.x - hq.x, e.z - hq.z); if (d < bd) { bd = d; best = e; } } if (best) { hq.cd = .35; tracer({ x: hq.x, y: H(hq.x, 0) + 5, z: hq.z }, { x: best.x, y: best.mesh.position.y + 1.2, z: best.z }, 0xfff0a0); if (Math.random() < .6) damage(best, 8); } }
    // bendera
    S.side[PL].flags = S.side[EN].flags = 0;
    for (const f of S.flags) { let a = 0, b = 0; for (const u of S.units) { if (u.dead || u.type === 'art') continue; if (Math.abs(u.x - f.x) < 9 && Math.abs(u.z - f.z) < 9 && Math.hypot(u.x - f.x, u.z - f.z) < 9) (u.side === PL ? a++ : b++); } const net = clamp(a - b, -5, 5); f.p = clamp(f.p + net * .07 * dt, -1, 1); if (f.owner === PL && f.p < .2) f.owner = 0; if (f.owner === EN && f.p > -.2) f.owner = 0; if (f.p >= .98) f.owner = PL; if (f.p <= -.98) f.owner = EN;
      const col = f.owner === PL ? COL[PL] : f.owner === EN ? COL[EN] : 0xcccccc; f.cloth.material.color.setHex(col); f.ring.material.color.setHex(col); f.cloth.position.y = 7.1 - (1 - Math.abs(f.p)) * 3 * (f.owner ? 0 : 1) ; if (f.owner === PL) S.side[PL].flags++; if (f.owner === EN) S.side[EN].flags++; }
    // tiket
    const diff = S.side[PL].flags - S.side[EN].flags; if (diff > 0) S.side[EN].tix -= diff * .55 * dt; else if (diff < 0) S.side[PL].tix -= -diff * .55 * dt;
    // peluru
    for (let i = S.shells.length - 1; i >= 0; i--) { const s = S.shells[i]; s.t += dt; const k = Math.min(1, s.t / s.dur); if (!s.m) { s.m = new THREE.Mesh(fxGeo.sph, new THREE.MeshBasicMaterial({ color: s.tank ? 0xffd27a : 0x222222 })); s.m.scale.setScalar(s.tank ? .28 : .45); scene.add(s.m); } s.m.position.set(lerp(s.a.x, s.b.x, k), lerp(s.a.y, s.b.y, k) + Math.sin(k * Math.PI) * s.arc, lerp(s.a.z, s.b.z, k)); if (k >= 1) { scene.remove(s.m); S.shells.splice(i, 1); splash(s.b.x, s.b.z, s.r, s.dmg, s.side); } }
    // efek
    for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i]; f.t += dt; const k = f.t / f.life; if (f.kind === 'puff') { f.m.scale.setScalar(f.size * (.4 + k * .9)); f.m.position.y += f.rise * dt; f.m.material.opacity = Math.max(0, .8 * (1 - k)); } if (k >= 1) { scene.remove(f.m); if (f.kind === 'tr') { f.m.visible = false; S.pool.push(f.m); } else { f.m.material.dispose(); } S.fx.splice(i, 1); } }
    for (const m of S.marks) { m.t += dt; m.m.scale.setScalar(1 + m.t * 3); m.m.material.opacity = Math.max(0, .9 - m.t * 1.6); } S.marks = S.marks.filter(m => { if (m.t > .6) { scene.remove(m.m); return false; } return true; });
    for (const c of clouds) { c.position.x += dt * 1.6; if (c.position.x > 200) c.position.x = -200; }
    S.air = Math.max(0, S.air - dt);
    // akhir
    const p = S.side[PL], e = S.side[EN]; let res = null; const ratio = () => Math.round(Math.abs(p.tix - e.tix) / Math.max(1, p.tix + e.tix) * 200);
    if (p.hq.hp <= 0) res = ['kalah', 100]; else if (e.hq.hp <= 0) res = ['menang', 100]; else if (p.tix <= 0 && e.tix <= 0) res = [p.tix >= e.tix ? 'menang' : 'kalah', 20]; else if (e.tix <= 0) res = ['menang', clamp(Math.round(p.tix / 2.6), 25, 100)]; else if (p.tix <= 0) res = ['kalah', clamp(Math.round(e.tix / 2.6), 25, 100)]; else if (S.t >= 420) { const m = ratio(); res = [m < 12 ? 'seri' : p.tix > e.tix ? 'menang' : 'kalah', m]; }
    if (res) finish(res[0], res[1]); }
  function finish(outcome, margin, retreat = false) { if (S.over) return; S.over = true; const p = S.side[PL], e = S.side[EN]; S.result = { outcome, margin: Math.round(margin), secs: Math.round(S.t), lost: p.lost, killed: e.lost, flags: p.flags, tixOwn: Math.max(0, Math.round(p.tix)), tixEnemy: Math.max(0, Math.round(e.tix)), retreat }; showResult(); }

  // ---------- kamera & input ----------
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(-24, 0, 0); camera.position.set(-98, 62, 52); controls.maxPolarAngle = 1.28; controls.minDistance = 14; controls.maxDistance = 135; controls.enableDamping = true; controls.dampingFactor = .09; controls.screenSpacePanning = false; controls.update();
  const cam = { get d() { return camera.position.distanceTo(controls.target); } };
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2(); let down = null;
  function pick(ev) { const r = renderer.domElement.getBoundingClientRect(); v2.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, camera); const eh = ray.intersectObjects(foe.children, true)[0]; const ownHit = ray.intersectObjects(own.children, true)[0], g = ray.intersectObject(terrain)[0]; const idOf = (o) => { while (o && o.userData.uid === undefined) o = o.parent; return o?.userData.uid; }; return { enemy: eh ? S.units.find(u => u.id === idOf(eh.object)) : null, own: ownHit ? S.units.find(u => u.id === idOf(ownHit.object)) : null, ground: g?.point }; }
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => { if (!down || S.over) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null; if (moved > 8 || dt > 450) return; const h = pick(e); if (S.aim && h.ground) { airstrike(h.ground.x, h.ground.z); S.aim = false; syncUI(); return; } const sel = [...S.sel].filter(u => !u.dead); if (h.enemy && sel.length) { order(sel, 0, 0, h.enemy); mark(h.enemy.x, h.enemy.z, 0xff5050); return; } if (h.own && !sel.length) { selectType(h.own.type); return; } if (h.ground && sel.length) { order(sel, h.ground.x, h.ground.z); mark(h.ground.x, h.ground.z, 0xfff3b0); } else if (h.own) selectType(h.own.type); });
  function mark(x, z, col) { const m = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, depthWrite: false })); m.position.set(x, H(x, z) + .4, z); scene.add(m); S.marks.push({ m, t: 0 }); }
  function selectType(t) { for (const u of S.units) u.ring.visible = false; S.sel.clear(); for (const u of alive(PL)) if (t === 'all' || u.type === t) { S.sel.add(u); u.ring.visible = true; } sel = t; syncUI(); }
  let sel = null;
  function airstrike(x, z) { if (S.air > 0) return; S.air = 55; mark(x, z, 0xff8a3a); const dir = new THREE.Vector3(1, 0, .25).normalize();
    for (let j = 0; j < 2; j++) { const jet = new THREE.Group(), b = new THREE.Mesh(new THREE.ConeGeometry(.7, 6, 6).rotateX(Math.PI / 2), mat(0x8e949b)), w = new THREE.Mesh(new THREE.BoxGeometry(7, .2, 1.8), mat(0x6c7178)); jet.add(b, w); const off = (j - .5) * 9; jet.position.set(x - dir.x * 110 + dir.z * off, 45, z - dir.z * 110 - dir.x * off); jet.lookAt(jet.position.x + dir.x, 45, jet.position.z + dir.z); scene.add(jet); const t0 = performance.now();
      const fly = () => { const t = (performance.now() - t0) / 1000 * (S.paused ? 0 : S.speed); jet.position.x = x - dir.x * 110 + dir.z * off + dir.x * 110 * 2 * t / 2.6; jet.position.z = z - dir.z * 110 - dir.x * off + dir.z * 110 * 2 * t / 2.6; if (t < 2.7 && G) requestAnimationFrame(fly); else scene.remove(jet); }; fly(); }
    for (let k = 0; k < 7; k++) setTimeout(() => { if (!G || S.over) return; const bx = x + (k - 3) * 3.2 * dir.x + (Math.random() - .5) * 3, bz = z + (k - 3) * 3.2 * dir.z + (Math.random() - .5) * 3; S.shells.push({ a: { x: bx, y: 40, z: bz }, b: { x: bx, y: H(bx, bz), z: bz }, t: 0, dur: .7, arc: 0, dmg: 95, r: 7, side: PL, tank: false }); }, (950 + k * 120) / S.speed); syncUI(); }

  // ---------- UI ----------
  const flag = (c) => `<span class="w3-flag">${c.flag || ''}</span>`;
  ui.innerHTML = `<div class="w3-top"><div class="w3-team me">${flag(me)}<b>${esc(me.name)}</b><div class="w3-tix"><i id="w3-tp"></i><span id="w3-tpv"></span></div></div><div class="w3-mid"><div id="w3-time">0:00</div><div class="w3-flags" id="w3-fl"><i></i><i></i><i></i></div></div><div class="w3-team en"><div class="w3-tix r"><i id="w3-te"></i><span id="w3-tev"></span></div><b>${esc(enemy.name)}</b>${flag(enemy)}</div></div>
  <div class="w3-hint" id="w3-hint"></div><canvas class="w3-mini" id="w3-mini" width="180" height="116"></canvas>
  <div class="w3-dock"><div class="w3-grp" id="w3-grp"></div><div class="w3-buy" id="w3-buy"></div><div class="w3-pow" id="w3-pow"></div></div>
  <div class="w3-credit" data-notr>Credits: <b>Pockzet</b> · <b>SMFA 3D</b></div><button class="w3-x" id="w3-quit" title="Mundur">${ic('door-open')}</button><div class="w3-over" id="w3-over" hidden></div><div class="w3-pause" id="w3-pause" hidden><div>${ic('pause')} Dijeda</div></div>`;
  const $ = (s) => ui.querySelector(s), mini = $('#w3-mini').getContext('2d');
  const hint = $('#w3-hint'); const hints = ['Pilih pasukan di bawah, lalu ketuk peta untuk memerintah. Ketuk musuh untuk fokus tembak.', 'Rebut 3 bendera untuk menguras tiket lawan. Hancurkan markas untuk menang cepat.', 'Geser = putar kamera · cubit = zoom · dua jari = geser peta.'];
  let hi = 0; hint.textContent = hints[0]; const hintTimer = setInterval(() => { hi = (hi + 1) % hints.length; hint.textContent = S.aim ? 'Ketuk peta untuk menjatuhkan serangan udara.' : hints[hi]; }, 7000);
  function syncUI() { const cnt = (t) => alive(PL).filter(u => u.type === t).length, sp = Math.floor(S.side[PL].sup);
    $('#w3-grp').innerHTML = [['all', 'Semua', 'users', alive(PL).length], ['inf', 'Infanteri', 'footprints', cnt('inf')], ['tank', 'Tank', 'truck', cnt('tank')], ['art', 'Artileri', 'crosshair', cnt('art')]].map(([k, t, i, n]) => `<button class="w3-b ${sel === k ? 'on' : ''}" data-w="sel" data-k="${k}">${ic(i)}<span>${t}</span><em>${n}</em></button>`).join('');
    $('#w3-buy').innerHTML = `<div class="w3-sup">${ic('package')} <b>${sp}</b></div>` + Object.entries(TYPES).map(([k, T]) => `<button class="w3-b buy" data-w="buy" data-k="${k}" ${sp < T.cost || alive(PL).length >= 46 ? 'disabled' : ''}>${ic('plus')}<span>${T.name}</span><em>${T.cost}</em></button>`).join('');
    $('#w3-pow').innerHTML = `<button class="w3-b pow ${S.aim ? 'on' : ''}" data-w="air" ${S.air > 0 ? 'disabled' : ''}>${ic('plane')}<span>${S.air > 0 ? Math.ceil(S.air) + ' dtk' : 'Serangan udara'}</span></button><button class="w3-b pow ${S.auto ? 'on' : ''}" data-w="auto">${ic('bot')}<span>Otomatis</span></button><button class="w3-b pow" data-w="speed">${ic('fast-forward')}<span>${S.speed}x</span></button><button class="w3-b pow" data-w="pause">${ic(S.paused ? 'play' : 'pause')}</button>`; refreshIcons(); }
  ui.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b || S.over) { if (e.target.closest('#w3-done')) end(); return; } const w = b.dataset.w;
    if (w === 'sel') selectType(b.dataset.k); else if (w === 'buy') { const T = TYPES[b.dataset.k], s = S.side[PL]; if (s.sup >= T.cost) { s.sup -= T.cost; const nf = S.flags.findIndex(f => f.owner !== PL); spawn(PL, b.dataset.k, -HQX + 9, (Math.random() - .5) * 24, FLAGS[nf < 0 ? 1 : nf]); syncUI(); } } else if (w === 'air') { S.aim = !S.aim; syncUI(); } else if (w === 'auto') { S.auto = !S.auto; syncUI(); } else if (w === 'speed') { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; syncUI(); } else if (w === 'pause') { S.paused = !S.paused; $('#w3-pause').hidden = !S.paused; syncUI(); } });
  $('#w3-quit').onclick = () => { if (S.over) return; if (confirm('Mundur dari medan perang? Ini dihitung sebagai kekalahan.')) finish('kalah', 60, true); };
  $('#w3-mini').addEventListener('pointerdown', (e) => { const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width - .5) * WX, z = ((e.clientY - r.top) / r.height - .5) * WZ; const d = camera.position.clone().sub(controls.target); controls.target.set(x, 0, z); camera.position.copy(controls.target).add(d); e.stopPropagation(); });
  function showResult() { const R = S.result, t = { menang: ['Kemenangan!', 'trophy'], kalah: ['Kekalahan', 'skull'], seri: ['Pertempuran imbang', 'scale'] }[R.outcome], ov = $('#w3-over'); ov.hidden = false;
    ov.innerHTML = `<div class="w3-card ${R.outcome}"><div class="w3-ic">${ic(t[1])}</div><h2>${t[0]}</h2><div class="w3-sub">${esc(me.name)} vs ${esc(enemy.name)}${opts.training ? ' · latihan' : ''}</div><div class="w3-stats"><div><b>${R.tixOwn}</b><span>Tiket Anda</span></div><div><b>${R.tixEnemy}</b><span>Tiket lawan</span></div><div><b>${R.killed}</b><span>Musuh gugur</span></div><div><b>${R.lost}</b><span>Pasukan gugur</span></div><div><b>${R.flags}/3</b><span>Bendera</span></div><div><b>${Math.floor(R.secs / 60)}:${String(R.secs % 60).padStart(2, '0')}</b><span>Durasi</span></div></div><div class="w3-credit-in" data-notr>Credits: Pockzet · SMFA 3D</div><div class="w3-note" id="w3-note">${opts.training ? 'Mode latihan: tidak memengaruhi negara.' : 'Menerapkan hasil ke negara…'}</div><button class="btn pri" id="w3-done">${ic('check')} Selesai</button></div>`; refreshIcons();
    (async () => { try { const msg = await opts.onResult?.(R); if (msg && $('#w3-note')) $('#w3-note').textContent = msg; } catch (e) { if ($('#w3-note')) $('#w3-note').textContent = e?.message || 'Gagal menerapkan hasil.'; } })(); }
  function end() { closeWar3D(); opts.onClose?.(); }

  // ---------- loop ----------
  function drawMini() { const w = 180, h = 116, X = (x) => (x / WX + .5) * w, Z = (z) => (z / WZ + .5) * h; mini.fillStyle = '#26301e'; mini.fillRect(0, 0, w, h); mini.fillStyle = 'rgba(255,255,255,.07)'; mini.fillRect(0, h * .3, w, h * .4);
    for (const f of S.flags) { mini.fillStyle = f.owner === PL ? '#e8b04a' : f.owner === EN ? '#4da3d6' : '#bbb'; mini.beginPath(); mini.arc(X(f.x), Z(f.z), 5, 0, 7); mini.fill(); }
    for (const hq of hqList) { mini.fillStyle = hq.hp > 0 ? '#' + COL[hq.side].toString(16) : '#444'; mini.fillRect(X(hq.x) - 5, Z(0) - 5, 10, 10); }
    for (const u of S.units) { if (u.dead) continue; mini.fillStyle = u.side === PL ? '#ffd470' : '#6fc3ff'; const s = u.type === 'inf' ? 2 : 3.5; mini.fillRect(X(u.x) - s / 2, Z(u.z) - s / 2, s, s); }
    const tx = X(controls.target.x), tz = Z(controls.target.z); mini.strokeStyle = '#fff'; mini.strokeRect(tx - 14, tz - 9, 28, 18); }
  let last = performance.now(), raf = 0, uiT = 0, miniT = 0;
  function resize() { const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function updateHUD() { const p = S.side[PL], e = S.side[EN]; $('#w3-tp').style.width = clamp(p.tix / 260 * 100, 0, 100) + '%'; $('#w3-te').style.width = clamp(e.tix / 260 * 100, 0, 100) + '%'; $('#w3-tpv').textContent = Math.max(0, Math.round(p.tix)); $('#w3-tev').textContent = Math.max(0, Math.round(e.tix)); const t = Math.max(0, 420 - Math.floor(S.t)); $('#w3-time').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); const fl = $('#w3-fl').children; S.flags.forEach((f, i) => { fl[i].style.background = f.owner === PL ? '#e8b04a' : f.owner === EN ? '#4da3d6' : '#9a9a9a'; fl[i].style.opacity = f.owner ? 1 : .6 + Math.abs(f.p) * .4; }); }
  function frame(now) { if (!G) return; raf = requestAnimationFrame(frame); const real = clamp((now - last) / 1000, 0, .06); last = now; if (!S.paused) { const n = S.speed; for (let i = 0; i < n; i++) step(real); }
    shake *= .9; controls.update(); controls.target.x = clamp(controls.target.x, -WX / 2 + 10, WX / 2 - 10); controls.target.z = clamp(controls.target.z, -WZ / 2 + 8, WZ / 2 - 8); if (shake > .02) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake * .6; }
    for (const u of S.units) if (!u.dead && u.hb.visible) u.hb.quaternion.copy(camera.quaternion); for (const hq of hqList) hq.bar.quaternion.copy(camera.quaternion);
    uiT += real; miniT += real; if (uiT > .4) { uiT = 0; updateHUD(); syncUI(); } if (miniT > .25) { miniT = 0; drawMini(); }
    renderer.render(scene, camera); }
  updateHUD(); syncUI(); selectType('all'); drawMini(); raf = requestAnimationFrame(frame);
  G = { S, step, dispose() { cancelAnimationFrame(raf); clearInterval(hintTimer); removeEventListener('resize', resize); controls.dispose(); renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); root.remove(); }, sim(sec) { const n = Math.round(sec / .05); for (let i = 0; i < n && !S.over; i++) step(.05); return S.result || null; } };
  window.__war = { sim: (s) => G?.sim(s), state: () => ({ t: S.t, over: S.over, result: S.result, own: alive(PL).length, foe: alive(EN).length, tp: S.side[PL].tix, te: S.side[EN].tix, flags: S.flags.map(f => f.owner), pr, sup: [S.side[PL].sup, S.side[EN].sup] }), auto: (v) => { S.auto = v; } };
  return G;
}
export function warPower(c) { return Math.sqrt(Math.max(1, c.gdp)) * (.4 + (c.readiness ?? 50) / 100); }
