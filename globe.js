// Country Manager — globe 3D interaktif (bumi realistis, penanda negara, rute kapal)
import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';

const R = 5;
export const ll2v = (lat, lon, r = R) => { const p = lat * Math.PI / 180, l = lon * Math.PI / 180; return new THREE.Vector3(r * Math.cos(p) * Math.cos(l), r * Math.sin(p), -r * Math.cos(p) * Math.sin(l)); };
const VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const FS = `uniform sampler2D dayMap,nightMap,specMap,normMap; uniform vec3 sunDir,camPos; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vec3 N=normalize(vN); vec3 nm=texture2D(normMap,vUv).xyz*2.-1.; N=normalize(N+vec3(nm.x,nm.y,0.)*0.12); vec3 L=normalize(sunDir),V=normalize(camPos-vW); float nl=dot(N,L); float dm=smoothstep(-0.12,0.22,nl);
 vec3 day=texture2D(dayMap,vUv).rgb,night=texture2D(nightMap,vUv).rgb; float sp=texture2D(specMap,vUv).r; vec3 H=normalize(L+V); float spec=pow(max(dot(N,H),0.),90.)*sp*0.22;
 vec3 lit=day*(0.07+max(nl,0.)*1.7)+vec3(1.,.95,.85)*spec*max(nl,0.); lit+=vec3(1.0,0.55,0.3)*smoothstep(-0.05,0.25,nl)*smoothstep(0.5,0.0,nl)*0.16*day.r;
 vec3 dark=day*0.015+night*vec3(1.6,1.15,.7)*1.35; vec3 col=mix(dark,lit,dm); float f=pow(1.-max(dot(N,V),0.),3.); col+=vec3(.25,.5,1.)*f*0.35*(0.35+max(nl,0.));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const AFS = `uniform vec3 sunDir,camPos; varying vec3 vN; varying vec3 vW; void main(){ vec3 V=normalize(camPos-vW); float f=pow(1.0-abs(dot(normalize(vN),V)),2.6); float s=0.25+0.75*smoothstep(-0.4,0.5,dot(normalize(vN),normalize(sunDir))); gl_FragColor=vec4(vec3(0.3,0.58,1.)*1.2,f*s*1.1);
 #include <colorspace_fragment>
}`;

export class Globe {
  constructor(host, { onPick, onHover, colorOf, sizeOf }) {
    this.host = host; this.onPick = onPick; this.onHover = onHover; this.colorOf = colorOf; this.sizeOf = sizeOf; this.t = 0; this.sunA = 2.4; this.markers = new Map(); this.routes = []; this.ships = []; this.sel = null; this.disposed = false;
    const w = host.clientWidth || 800, h = host.clientHeight || 500;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(w, h); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; host.appendChild(this.renderer.domElement); this.renderer.domElement.style.display = 'block';
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x1a0508);
    this.cam = new THREE.PerspectiveCamera(42, w / h, 0.1, 1000); this.cam.position.set(0, 4.8, 18.4);
    const tl = new THREE.TextureLoader(), ld = (u, srgb = true) => { const t = tl.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    this.sunDir = new THREE.Vector3(1, .25, .6).normalize();
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { dayMap: { value: ld('assets/earth_atmos_2048.jpg') }, nightMap: { value: ld('assets/earth_lights_2048.png') }, specMap: { value: ld('assets/earth_specular_2048.jpg', false) }, normMap: { value: ld('assets/earth_normal_2048.jpg', false) }, sunDir: { value: this.sunDir }, camPos: { value: this.cam.position } } });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 72), this.mat); this.scene.add(this.earth);
    const ct = ld('assets/earth_clouds_1024.png'); this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 64, 48), new THREE.MeshLambertMaterial({ map: ct, transparent: true, opacity: .8, depthWrite: false, alphaMap: ct })); this.scene.add(this.clouds);
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 64, 48), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: AFS, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { sunDir: { value: this.sunDir }, camPos: { value: this.cam.position } } })));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5); this.scene.add(this.sun, new THREE.AmbientLight(0x223355, .8));
    const n = 3000, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(300 + Math.random() * 100); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, color: 0xcfe3ff })));
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.14, .19, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false })); this.ring.visible = false; this.scene.add(this.ring);
    this.controls = new OrbitControls(this.cam, this.renderer.domElement); Object.assign(this.controls, { enableDamping: true, dampingFactor: .07, minDistance: 6.8, maxDistance: 34, enablePan: false, rotateSpeed: .5, zoomSpeed: .7, autoRotate: true, autoRotateSpeed: .25 });
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); this.down = null;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this.down = [e.clientX, e.clientY]; this.controls.autoRotate = false; });
    el.addEventListener('pointerup', (e) => { if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 5) { const c = this.pick(e); if (c) this.onPick?.(c); } this.down = null; });
    el.addEventListener('pointermove', (e) => { if (e.buttons) return; const c = this.pick(e); el.style.cursor = c ? 'pointer' : 'grab'; this.onHover?.(c, e); });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.loop = this.loop.bind(this); this.last = performance.now(); this.raf = requestAnimationFrame(this.loop);
  }
  setCountries(list) {
    for (const m of this.markers.values()) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); } this.markers.clear();
    for (const c of list) { const r = this.sizeOf(c), m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), new THREE.MeshBasicMaterial({ color: this.colorOf(c) })); m.position.copy(ll2v(c.lat, c.lng, R * 1.004)); m.userData.code = c.code; m.userData.c = c; this.group.add(m); this.markers.set(c.code, m); }
    this.refresh();
  }
  setOccupied(items) { // items: [{rings:[[lon,lat]...], color}] — wilayah yang diduduki (isi + garis tepi) di permukaan globe
    for (const o of this.occ || []) { this.group.remove(o); o.traverse(x => { x.geometry?.dispose(); x.material?.dispose(); }); } this.occ = [];
    for (const it of items || []) { const g = new THREE.Group(), col = new THREE.Color(it.color), pos = [];
      const sub = (a, b, c, depth) => { const e = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]); if (depth > 5 || Math.max(e(a, b), e(b, c), e(c, a)) < 2.2) { pos.push(a, b, c); return; } const m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2], ab = m(a, b), bc = m(b, c), ca = m(c, a); sub(a, ab, ca, depth + 1); sub(ab, b, bc, depth + 1); sub(ca, bc, c, depth + 1); sub(ab, bc, ca, depth + 1); };
      for (const ring of it.rings) { const pts = ring.map(p => new THREE.Vector2(p[0], p[1])); let idx; try { idx = THREE.ShapeUtils.triangulateShape(pts, []); } catch (e) { idx = []; } for (const t of idx) sub(ring[t[0]], ring[t[1]], ring[t[2]], 0);
        const lp = []; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 1.2)); for (let k = 0; k < n; k++) lp.push(ll2v(a[1] + (b[1] - a[1]) * k / n, a[0] + (b[0] - a[0]) * k / n, R * 1.006)); } g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), .35) }))); }
      const arr = new Float32Array(pos.length * 3); pos.forEach((p, i) => { const v = ll2v(p[1], p[0], R * 1.0035); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); g.add(m); this.group.add(g); this.occ.push(g); } }
  refresh() { for (const m of this.markers.values()) m.material.color.set(this.colorOf(m.userData.c)); if (this.sel) this.setSelected(this.sel); }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.cam);
    const hit = this.ray.intersectObjects([...this.markers.values()], false); if (!hit.length) return null;
    const eh = this.ray.intersectObject(this.earth, false); if (eh.length && eh[0].distance < hit[0].distance - 0.02) return null; return hit[0].object.userData.code;
  }
  setSelected(code) { this.sel = code; const m = this.markers.get(code); if (!m) { this.ring.visible = false; return; } this.ring.visible = true; this.ring.position.copy(m.position).multiplyScalar(1.002); this.ring.lookAt(m.position.clone().multiplyScalar(2)); }
  focus(code, dist = 11) { const m = this.markers.get(code); if (!m) return; this.target = m.position.clone().normalize().multiplyScalar(dist); this.sunTarget = Math.atan2(m.position.z, m.position.x) - 0.5; this.controls.autoRotate = false; }
  // busur lingkaran-besar yang selalu di atas permukaan bumi (tidak menembus globe); tinggi busur mengikuti jarak
  arc(from, to, hk = .28, h0 = .16) {
    const a = ll2v(from[0], from[1], 1), b = ll2v(to[0], to[1], 1), th = Math.acos(Math.min(1, Math.max(-1, a.dot(b)))), sn = Math.sin(th) || 1e-6, H = h0 + th * R * hk, pts = [];
    for (let i = 0; i <= 90; i++) { const t = i / 90, k1 = Math.sin((1 - t) * th) / sn, k2 = Math.sin(t * th) / sn, d = a.clone().multiplyScalar(k1).add(b.clone().multiplyScalar(k2)).normalize(); pts.push(d.multiplyScalar(R * 1.004 + Math.sin(Math.PI * t) * H)); }
    return { pts, getPoint(t) { const f = Math.min(.9999, Math.max(0, t)) * (pts.length - 1), i = Math.floor(f); return pts[i].clone().lerp(pts[i + 1], f - i); } };
  }
  setRoutes(routes) { // routes: [{from:[lat,lng], to:[lat,lng], color}]
    for (const r of this.routes) { this.scene.remove(r.line); r.line.geometry.dispose(); this.scene.remove(r.ship); } this.routes = [];
    for (const r of routes) { const curve = this.arc(r.from, r.to, .22, .12);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.pts), new THREE.LineBasicMaterial({ color: r.color || 0xfbbf24, transparent: true, opacity: .6 })); this.scene.add(line);
      const ship = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, .045), new THREE.MeshBasicMaterial({ color: 0xffd166 })); const glow = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: .35 })); ship.add(hull, glow); this.scene.add(ship);
      this.routes.push({ line, ship, curve, t: Math.random(), sp: .035 + Math.random() * .03 }); }
  }
  // pesawat tempur terbang bolak-balik antar negara yang sedang berperang (garis merah + kilatan di sasaran)
  setWars(pairs) { // pairs: [{a:[lat,lng], b:[lat,lng]}]
    for (const w of this.wars || []) { this.scene.remove(w.line); w.line.geometry.dispose(); w.jets.forEach(j => this.scene.remove(j.g)); this.scene.remove(w.flash); this.scene.remove(w.flash2); } this.wars = [];
    for (const p of pairs) for (const dir of [0, 1]) { const f = dir ? p.b : p.a, t = dir ? p.a : p.b, curve = this.arc(f, t, .34, .3);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.pts), new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: .5 })); this.scene.add(line);
      const mkJet = () => { const g = new THREE.Group(), mm = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 }); const body = new THREE.Mesh(new THREE.ConeGeometry(.028, .17, 6).rotateX(Math.PI / 2), mm), wing = new THREE.Mesh(new THREE.BoxGeometry(.19, .006, .07), new THREE.MeshBasicMaterial({ color: 0xcbd5e1 })), tail = new THREE.Mesh(new THREE.BoxGeometry(.006, .06, .045), new THREE.MeshBasicMaterial({ color: 0xff6b6b })), fl = new THREE.Mesh(new THREE.SphereGeometry(.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb347 })); tail.position.set(0, .03, -.07); fl.position.z = -.1; wing.position.z = -.03; g.add(body, wing, tail, fl); g.scale.setScalar(1.4); this.scene.add(g); return g; };
      const jets = [0, .5].map(o => ({ g: mkJet(), t: (Math.random() + o) % 1 })), flash = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0, depthWrite: false })), flash2 = new THREE.Mesh(new THREE.RingGeometry(.06, .09, 28), new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      const e = ll2v(t[0], t[1], R * 1.006); flash.position.copy(e); flash2.position.copy(e); flash2.lookAt(e.clone().multiplyScalar(2)); this.scene.add(flash, flash2); this.wars.push({ line, curve, jets, flash, flash2, sp: .07 + Math.random() * .03, hit: 0 }); }
  }
  // satelit: posisi waktu nyata dari data orbit (TLE CelesTrak + SGP4); bila gagal dimuat dipakai orbit perkiraan (ISS, Hubble, Tiangong, GPS, Starlink, GEO, kutub)
  async setSatellites(on = true) {
    if (!on) { if (this.satPts) { this.scene.remove(this.satPts); this.satPts.geometry.dispose(); this.satPts = null; } if (this.satIss) { this.scene.remove(this.satIss); this.satIss = null; } if (this.satTrail) { this.scene.remove(this.satTrail); this.satTrail = null; } this.sats = null; this.satLabel?.remove(); return; }
    if (this.sats || this.satLoading) return; this.satLoading = true; let lib = null; try { lib = await import('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm'); } catch (e) { /* tanpa pustaka: orbit perkiraan */ }
    if (this.disposed) return; const list = [], seen = new Set(); let real = false;
    const add = (name, l1, l2) => { if (seen.has(name) || !lib) return; try { const rec = lib.twoline2satrec(l1, l2); if (rec && !rec.error) { seen.add(name); list.push({ name, rec }); } } catch (e) {} };
    if (lib) for (const g of ['stations', 'visual']) { try { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000), txt = await (await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`, { signal: ctl.signal })).text(); clearTimeout(tm); const L = txt.split(/\r?\n/).map(x => x.trimEnd()).filter(Boolean); for (let i = 0; i + 2 < L.length; i += 3) if (L[i + 1].startsWith('1 ') && L[i + 2].startsWith('2 ')) add(L[i].trim(), L[i + 1], L[i + 2]); } catch (e) {} }
    real = list.length > 5; list.splice(260);
    if (!real) { list.length = 0; const syn = (name, inc, per, raan, ph, alt) => list.push({ name, syn: { inc: inc * Math.PI / 180, w: 2 * Math.PI / (per * 60), raan: raan * Math.PI / 180, ph: ph * Math.PI / 180, alt } });
      syn('ISS (ZARYA)', 51.64, 92.9, 40, 0, 420); syn('CSS (TIANHE)', 41.5, 92.3, 120, 80, 390); syn('HST', 28.5, 95.4, 200, 150, 540); for (let i = 0; i < 48; i++) syn('Starlink ' + (i + 1), 53, 95.5, (i % 6) * 60, Math.floor(i / 6) * 45, 550); for (let i = 0; i < 6; i++) syn('GPS ' + (i + 1), 55, 717.97, i * 60, i * 53, 20200); for (let i = 0; i < 5; i++) syn('GEO ' + (i + 1), 0.1, 1436.07, 0, i * 72, 35786); for (let i = 0; i < 6; i++) syn('NOAA-polar ' + (i + 1), 98.7, 101.3, i * 30, i * 61, 850); }
    this.sats = { list, lib, real }; const n = list.length, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.satPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8be9ff, size: 3.4, sizeAttenuation: false, transparent: true, opacity: .95, depthWrite: false })); this.satPts.frustumCulled = false; this.scene.add(this.satPts);
    const iss = new THREE.Group(); iss.add(new THREE.Mesh(new THREE.BoxGeometry(.07, .025, .025), new THREE.MeshBasicMaterial({ color: 0xffffff })), new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .2), new THREE.MeshBasicMaterial({ color: 0xffd166 })), new THREE.Mesh(new THREE.RingGeometry(.1, .12, 24), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }))); this.satIss = iss; this.scene.add(iss);
    this.satTrail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: .55 })); this.scene.add(this.satTrail);
    const lab = document.createElement('div'); lab.className = 'gl-sat'; lab.setAttribute('data-notr', ''); this.host.appendChild(lab); this.satLabel = lab; this.satT = 0; this.updateSats(true); this.satLoading = false;
  }
  satPos(s, date) { // -> {lat, lon, h(km)}
    if (s.rec) { const L = this.sats.lib, pv = L.propagate(s.rec, date); if (!pv.position) return null; const g = L.eciToGeodetic(pv.position, L.gstime(date)); return { lat: L.degreesLat(g.latitude), lon: L.degreesLong(g.longitude), h: g.height }; }
    const o = s.syn, t = date.getTime() / 1000, u = o.ph + o.w * t, x = Math.cos(u), y = Math.sin(u) * Math.cos(o.inc), z = Math.sin(u) * Math.sin(o.inc), c = Math.cos(o.raan), sn = Math.sin(o.raan), X = x * c - y * sn, Y = x * sn + y * c, Z = z, jd = t / 86400 + 2440587.5, gm = (280.46061837 + 360.98564736629 * (jd - 2451545)) * Math.PI / 180, lon = Math.atan2(Y, X) - gm;
    return { lat: Math.asin(Z) * 180 / Math.PI, lon: ((lon * 180 / Math.PI + 540) % 360) - 180, h: o.alt };
  }
  satR(h) { return R * (1.035 + Math.min(h, 40000) / 40000 * .42 + Math.min(h, 2000) / 2000 * .02); }
  updateSats(trail) {
    if (!this.sats || !this.satPts) return; const date = new Date(), pos = this.satPts.geometry.attributes.position; let issP = null, k = 0;
    this.sats.list.forEach((s, i) => { const p = this.satPos(s, date); if (!p) { pos.setXYZ(i, 0, 0, 0); return; } const v = ll2v(p.lat, p.lon, this.satR(p.h)); pos.setXYZ(i, v.x, v.y, v.z); if (!issP && /ISS|ZARYA/.test(s.name)) { issP = { p, v, s }; } k++; }); pos.needsUpdate = true;
    if (issP) { this.satIss.visible = true; this.satIss.position.copy(issP.v); this.satIss.lookAt(issP.v.clone().multiplyScalar(2)); this.issInfo = issP.p; if (trail) { const pts = []; for (let m = 0; m <= 100; m++) { const q = this.satPos(issP.s, new Date(date.getTime() + m * 57000)); if (q) pts.push(ll2v(q.lat, q.lon, this.satR(q.h))); } this.satTrail.geometry.dispose(); this.satTrail.geometry = new THREE.BufferGeometry().setFromPoints(pts); } } else this.satIss.visible = false;
    if (this.satLabel) { const i = this.issInfo; this.satLabel.innerHTML = `<b>Satelit waktu nyata</b> · ${k} objek${this.sats.real ? '' : ' (orbit perkiraan)'}${i ? `<br>ISS: ${i.lat.toFixed(1)}°, ${i.lon.toFixed(1)}° · ${Math.round(i.h)} km` : ''}`; }
  }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  loop(now) {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop); const dt = Math.min(.08, (now - this.last) / 1000); this.last = now; this.t += dt;
    if (this.sunTarget !== undefined) { let d = this.sunTarget - this.sunA; d = Math.atan2(Math.sin(d), Math.cos(d)); this.sunA += d * Math.min(1, dt * 1.5); if (Math.abs(d) < .02) this.sunTarget = undefined; } else this.sunA += dt * .02;
    this.sunDir.set(Math.cos(this.sunA), .28, Math.sin(this.sunA)).normalize(); this.sun.position.copy(this.sunDir).multiplyScalar(50); this.clouds.rotation.y += dt * .004;
    if (this.target) { this.cam.position.lerp(this.target, .07); if (this.cam.position.distanceTo(this.target) < .05) this.target = null; }
    if (this.ring.visible) { const k = (this.t * 1.2) % 1; this.ring.scale.setScalar(1 + k * 2.2); this.ring.material.opacity = (1 - k) * .9; }
    for (const r of this.routes) { r.t = (r.t + dt * r.sp) % 1; const p = r.curve.getPoint(r.t); r.ship.position.copy(p); r.ship.lookAt(r.curve.getPoint(Math.min(1, r.t + .01))); }
    for (const w of this.wars || []) { let hit = false; for (const j of w.jets) { j.t = (j.t + dt * w.sp) % 1; const p = w.curve.getPoint(j.t); j.g.position.copy(p); j.g.lookAt(w.curve.getPoint(Math.min(1, j.t + .015))); if (j.t > .94 && j.t < .985) hit = true; } if (hit) w.hit = 1; w.hit = Math.max(0, w.hit - dt * 1.4); w.flash.material.opacity = w.hit * .9; w.flash.scale.setScalar(1 + (1 - w.hit) * 2.4); w.flash2.material.opacity = w.hit * .7; w.flash2.scale.setScalar(1 + (1 - w.hit) * 3.2); }
    if (this.sats) { this.satT += dt; if (this.satT > 1) { this.satT = 0; this.satN = (this.satN || 0) + 1; this.updateSats(this.satN % 30 === 0); } }
    this.controls.update(); this.renderer.render(this.scene, this.cam);
  }
  dispose() { this.disposed = true; this.satLabel?.remove(); cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose(); this.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); }); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
