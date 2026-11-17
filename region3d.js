// country.7mit — Kota 3D ala /classic: pulau 7x7 plot, jalan, lampu, mobil, kereta; klik plot untuk membangun
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { makeBuilding } from './models.js';

export const N = 7, PITCH = 5, HALF = N * PITCH / 2, KM_U = 0.1; // 1 satuan = 100 m
const MODEL = { rumah: ['housing', 1], sekolah: ['school', 1], rs: ['hospital', 1], pabrik: ['factory', 1], pertanian: ['farm', 1], listrik: ['solar', 2], pelabuhan: ['port', 1], bandara: ['airport', 1], pasar: ['housing', 2], taman: ['park', 1], teknologi: ['techhub', 1], kantor: ['anticorr', 1] };
const RS = { tol: { w: 1.5, col: 0x1f2227, stripe: 0x4aa3ff, cars: 4, sp: 5 }, raya: { w: 1.0, col: 0x34363b, stripe: 0xfdd835, cars: 3, sp: 3 }, jalan: { w: .7, col: 0x4a4d52, stripe: 0xffffff, cars: 2, sp: 2 }, rel: { w: .7, col: 0x8c8f94, stripe: 0, cars: 0, sp: 3.5 } };
const rnd = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

export class Region3D {
  // opts: lat, lng (pusat kota), key, onPlot(i,j), onNode(x,z)
  constructor(host, o) {
    this.host = host; this.o = o; this.cos = Math.cos(o.lat * Math.PI / 180) || 1; this.cars = []; this.plots = new Map(); this.roads = new THREE.Group(); this.prev = new THREE.Group(); this.mode = 'plot';
    const w = host.clientWidth || 800, h = host.clientHeight || 500;
    this.r = new THREE.WebGLRenderer({ antialias: true }); this.r.setPixelRatio(Math.min(devicePixelRatio, 2)); this.r.setSize(w, h); this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap; host.appendChild(this.r.domElement);
    this.s = new THREE.Scene(); this.s.background = new THREE.Color(0x9ccfee); this.s.fog = new THREE.Fog(0x9ccfee, 60, 160);
    this.cam = new THREE.PerspectiveCamera(42, w / h, .1, 400); this.cam.position.set(30, 32, 36);
    this.ctl = new OrbitControls(this.cam, this.r.domElement); Object.assign(this.ctl, { enableDamping: true, maxPolarAngle: 1.45, minDistance: 8, maxDistance: 90, target: new THREE.Vector3(0, 0, 0) });
    this.s.add(new THREE.HemisphereLight(0xdfefff, 0x6b8a4e, .9)); const sun = new THREE.DirectionalLight(0xfff2d6, 1.5); sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 }); this.s.add(sun);
    // air + pulau
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: .35, metalness: .1 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.9; this.s.add(sea);
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(HALF * 1.12, HALF * 1.22, 1.6, 48), new THREE.MeshStandardMaterial({ color: 0x8a6d4b, roughness: 1 })); isl.position.y = -.85; isl.receiveShadow = true; this.s.add(isl);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(HALF * 1.12, HALF * 1.12, .12, 48), new THREE.MeshStandardMaterial({ color: 0x6fae52, roughness: 1 })); grass.position.y = -.06; grass.receiveShadow = true; this.s.add(grass);
    // jalan kota (kisi) + marka + lampu
    const RM = new THREE.MeshStandardMaterial({ color: 0x34363b, roughness: .9 }), LM = new THREE.MeshBasicMaterial({ color: 0xffffff }), span = N * PITCH;
    for (let k = 0; k <= N; k++) { const v = (k - N / 2) * PITCH; const a = new THREE.Mesh(new THREE.PlaneGeometry(span + .9, .9), RM); a.rotation.x = -Math.PI / 2; a.position.set(0, .02, v); a.receiveShadow = true; this.s.add(a); const b = a.clone(); b.rotation.z = Math.PI / 2; b.position.set(v, .021, 0); this.s.add(b);
      for (let m = 0; m < N * 2; m++) { const d = (m - N + .5) * (PITCH / 2); const l1 = new THREE.Mesh(new THREE.PlaneGeometry(.5, .06), LM); l1.rotation.x = -Math.PI / 2; l1.position.set(d, .03, v); this.s.add(l1); const l2 = l1.clone(); l2.rotation.z = Math.PI / 2; l2.position.set(v, .03, d); this.s.add(l2); } }
    const pm = new THREE.MeshStandardMaterial({ color: 0xbfc4c9, roughness: .9 }), R = rnd(Math.abs(Math.floor(o.lat * 1000 + o.lng * 777)) % 2147483646 + 1);
    this.padM = []; this.hit = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const sub = new THREE.Group(); sub.position.set((i - (N - 1) / 2) * PITCH, 0, (j - (N - 1) / 2) * PITCH); this.s.add(sub);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(4.1, .16, 4.1), pm.clone()); pad.position.y = -.07; pad.receiveShadow = true; pad.userData.plot = [i, j]; sub.add(pad); this.hit.push(pad);
      const tg = new THREE.Group(); sub.add(tg); this.plots.set(i + ',' + j, { sub, tg, pad, built: null });
      if (R() < .7) { const t = new THREE.Mesh(new THREE.ConeGeometry(.45, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0x3e8e41 })); t.position.set((R() - .5) * 2.4, .65, (R() - .5) * 2.4); t.castShadow = true; tg.add(t); if (R() < .5) { const t2 = t.clone(); t2.position.set((R() - .5) * 2.4, .6, (R() - .5) * 2.4); t2.scale.setScalar(.8); tg.add(t2); } }
    }
    this.s.add(this.roads, this.prev); this.hl = new THREE.Mesh(new THREE.BoxGeometry(4.2, .22, 4.2), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: .55 })); this.hl.visible = false; this.s.add(this.hl);
    this.nodeHl = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .2, 16), new THREE.MeshBasicMaterial({ color: 0xff5d6c })); this.nodeHl.visible = false; this.s.add(this.nodeHl);
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); this.ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ visible: false })); this.ground.rotation.x = -Math.PI / 2; this.s.add(this.ground);
    const el = this.r.domElement; el.addEventListener('pointerdown', (e) => { this.down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => { if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 5) this.click(e); this.down = null; });
    el.addEventListener('pointermove', (e) => { if (e.buttons) return; this.hover(e); });
    this.ro = new ResizeObserver(() => { const W = host.clientWidth, H = host.clientHeight; if (W && H) { this.r.setSize(W, H); this.cam.aspect = W / H; this.cam.updateProjectionMatrix(); } }); this.ro.observe(host);
    this.last = performance.now(); this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  setCursor(e) { const b = this.r.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.cam); }
  nodeAt(e) { this.setCursor(e); const g = this.ray.intersectObject(this.ground)[0]; if (!g) return null; const x = Math.round((g.point.x + HALF) / PITCH), z = Math.round((g.point.z + HALF) / PITCH); if (x < 0 || z < 0 || x > N || z > N) return null; return [x, z]; }
  hover(e) {
    if (this.mode === 'plot') { this.setCursor(e); const h = this.ray.intersectObjects(this.hit)[0]; this.nodeHl.visible = false; if (!h) { this.hl.visible = false; return; } this.hl.visible = true; this.hl.position.copy(h.object.parent.position); this.hl.position.y = -.05; return; }
    this.hl.visible = false; const n = this.nodeAt(e); this.nodeHl.visible = !!n; if (n) this.nodeHl.position.set(n[0] * PITCH - HALF, .1, n[1] * PITCH - HALF);
  }
  click(e) {
    if (this.mode === 'plot') { this.setCursor(e); const h = this.ray.intersectObjects(this.hit)[0]; if (h) this.o.onPlot?.(...h.object.userData.plot); return; }
    const n = this.nodeAt(e); if (n) this.o.onNode?.(n[0], n[1]);
  }
  setMode(m) { this.mode = m; this.hl.visible = false; this.nodeHl.visible = false; }
  // koordinat lokal <-> lat/lng
  toLL(x, z) { return [+(this.o.lat - (z * PITCH - HALF) * KM_U / 111.2).toFixed(6), +(this.o.lng + (x * PITCH - HALF) * KM_U / (111.2 * this.cos)).toFixed(6)]; }
  fromLL(lat, lng) { return [((this.o.lng - lng) * -1 * 111.2 * this.cos / KM_U + HALF) / PITCH, ((this.o.lat - lat) * 111.2 / KM_U + HALF) / PITCH]; }
  setPlots(builds) { // builds: [{kind, region:{plot:'i,j'}}]
    for (const p of this.plots.values()) { if (p.built) { p.sub.remove(p.built); p.built = null; } p.tg.visible = true; }
    for (const b of builds) { const k = b.region?.plot, p = this.plots.get(k); if (!p) continue; const [t, lv] = MODEL[b.kind] || ['housing', 1], g = new THREE.Group(); makeBuilding(t, lv, g, { outward: 0 }); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); p.sub.add(g); p.built = g; p.tg.visible = false; }
  }
  occupied(i, j) { return !!this.plots.get(i + ',' + j)?.built; }
  roadMesh(pts, kind) { // pts: [[x,z]] satuan lokal dunia
    const st = RS[kind] || RS.jalan, g = new THREE.Group();
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .01) continue; const seg = new THREE.Group(); seg.position.set((a[0] + b[0]) / 2, .08 + (kind === 'rel' ? .02 : 0), (a[1] + b[1]) / 2); seg.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(len + st.w * .6, .08, st.w), new THREE.MeshStandardMaterial({ color: st.col, roughness: .9 })); bed.receiveShadow = true; seg.add(bed);
      if (kind === 'rel') { for (const s of [-.2, .2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .05), new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: .6 })); rail.position.set(0, .07, s); seg.add(rail); } for (let k = 0; k < len * 3; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(.1, .04, .62), new THREE.MeshStandardMaterial({ color: 0x5a4632 })); sl.position.set(-len / 2 + (k + .5) / 3, .06, 0); seg.add(sl); } }
      else if (st.stripe) { for (let k = 0; k < len * 2; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(.3, .01, .05), new THREE.MeshBasicMaterial({ color: st.stripe })); d.position.set(-len / 2 + (k + .5) / 2, .05, 0); seg.add(d); } }
      g.add(seg); }
    return g;
  }
  setRoads(list) { // list: [{kind, path:[[lat,lng]]}]
    this.s.remove(this.roads); this.roads.traverse(o => { o.geometry?.dispose?.(); }); this.roads = new THREE.Group(); this.s.add(this.roads); this.cars = this.cars.filter(c => { if (c.road) { c.car.parent?.remove(c.car); return false; } return true; });
    const cols = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xffffff];
    for (const r of list) { const pts = (r.path || []).map(([la, lo]) => { const [x, z] = this.fromLL(la, lo); return [x * PITCH - HALF, z * PITCH - HALF]; }); if (pts.length < 2) continue; this.roads.add(this.roadMesh(pts, r.kind)); const st = RS[r.kind] || RS.jalan;
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const mk = r.kind === 'rel' ? 1 : st.cars; for (let k = 0; k < mk; k++) { let car; if (r.kind === 'rel') { car = new THREE.Group(); for (let w = 0; w < 4; w++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.9, .45, .45), new THREE.MeshStandardMaterial({ color: w ? 0xd8dde2 : 0xb71c1c })); m.position.x = -w * 1; car.add(m); } } else car = new THREE.Mesh(new THREE.BoxGeometry(.6, .25, .3), new THREE.MeshStandardMaterial({ color: cols[k % 5] })); car.position.y = .28; this.roads.add(car); this.cars.push({ car, pts, cum, t: Math.random() * cum[cum.length - 1], sp: st.sp * (.8 + Math.random() * .5), road: true }); }
    }
  }
  setPreview(nodes, kind) { this.s.remove(this.prev); this.prev = new THREE.Group(); if (nodes.length) { const pts = nodes.map(([x, z]) => [x * PITCH - HALF, z * PITCH - HALF]); this.prev.add(this.roadMesh(pts, kind)); for (const p of pts) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .3, 12), new THREE.MeshBasicMaterial({ color: 0xffd166 })); m.position.set(p[0], .2, p[1]); this.prev.add(m); } } this.s.add(this.prev); }
  loop(now) {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop); const dt = Math.min(.08, (now - this.last) / 1000); this.last = now;
    for (const c of this.cars) { const L = c.cum[c.cum.length - 1]; c.t = (c.t + dt * c.sp) % L; let i = 1; while (i < c.cum.length - 1 && c.cum[i] < c.t) i++; const a = c.pts[i - 1], b = c.pts[i], f = (c.t - c.cum[i - 1]) / Math.max(.001, c.cum[i] - c.cum[i - 1]); c.car.position.x = a[0] + (b[0] - a[0]) * f; c.car.position.z = a[1] + (b[1] - a[1]) * f + .12; c.car.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); }
    this.ctl.update(); this.r.render(this.s, this.cam);
  }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.ctl.dispose(); this.s.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose?.()); }); this.r.dispose(); this.r.domElement.remove(); }
}
