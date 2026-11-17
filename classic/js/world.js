// ============================================================
//  country.7mit — scene Globe Dunia (bumi realistis)
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { COUNTRIES } from './data.js';

export const R = 5;
export function ll2v(lat, lon, r = R) {
  const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
  return new THREE.Vector3(r * Math.cos(φ) * Math.cos(λ), r * Math.sin(φ), -r * Math.cos(φ) * Math.sin(λ));
}

const EARTH_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const EARTH_FS = `
uniform sampler2D dayMap, nightMap, specMap, normMap; uniform vec3 sunDir; uniform vec3 camPos;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 N=normalize(vN);
  vec3 nm=texture2D(normMap,vUv).xyz*2.-1.;
  N=normalize(N+vec3(nm.x,nm.y,0.)*0.12);
  vec3 L=normalize(sunDir); vec3 V=normalize(camPos-vW);
  float nl=dot(N,L);
  float dayMix=smoothstep(-0.12,0.22,nl);
  vec3 day=texture2D(dayMap,vUv).rgb;
  vec3 night=texture2D(nightMap,vUv).rgb;
  float sp=texture2D(specMap,vUv).r;
  vec3 H=normalize(L+V);
  float spec=pow(max(dot(N,H),0.),90.)*sp*0.22;
  vec3 lit=day*(0.07+max(nl,0.)*1.7)+vec3(1.,.95,.85)*spec*max(nl,0.);
  float tw=smoothstep(-0.05,0.25,nl)*smoothstep(0.5,0.0,nl)*0.9;
  lit+=vec3(1.0,0.55,0.3)*tw*0.18*day.r;
  vec3 dark=day*0.015+night*vec3(1.6,1.15,.7)*1.35;
  vec3 col=mix(dark,lit,dayMix);
  float fres=pow(1.-max(dot(N,V),0.),3.);
  col+=vec3(.25,.5,1.)*fres*0.35*(0.35+max(nl,0.));
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ATMO_FS = `
uniform vec3 sunDir; uniform vec3 camPos; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 V=normalize(camPos-vW); float f=pow(1.0-abs(dot(normalize(vN),V)),2.6);
  float sun=0.25+0.75*smoothstep(-0.4,0.5,dot(normalize(vN),normalize(sunDir)));
  gl_FragColor=vec4(vec3(0.3,0.58,1.)*1.2,f*sun*1.1);
  #include <colorspace_fragment>
}`;

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 4, 17);
    this.clock = 0;
    this.markers = []; this.arcs = []; this.labels = {};
    this.selectedId = null; this.playerId = null; this.focusDir = null;
    this.sunAngle = 2.2;
    this.raycaster = new THREE.Raycaster();
    this._build();
  }
  _build() {
    const s = this.scene, tl = new THREE.TextureLoader();
    const load = (u, srgb = true) => { const t = tl.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    this.sunDir = new THREE.Vector3(1, 0.2, 0.6).normalize();
    const mat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VS, fragmentShader: EARTH_FS,
      uniforms: { dayMap: { value: load('assets/earth_atmos_2048.jpg') }, nightMap: { value: load('assets/earth_lights_2048.png') }, specMap: { value: load('assets/earth_specular_2048.jpg', false) }, normMap: { value: load('assets/earth_normal_2048.jpg', false) }, sunDir: { value: this.sunDir }, camPos: { value: this.camera.position } },
    });
    this.earthMat = mat;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), mat);
    s.add(this.earth);
    // awan
    const ct = load('assets/earth_clouds_1024.png');
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 64), new THREE.MeshLambertMaterial({ map: ct, transparent: true, opacity: 0.85, depthWrite: false, alphaMap: ct }));
    s.add(this.clouds);
    // atmosfer
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 96, 64), new THREE.ShaderMaterial({ vertexShader: EARTH_VS, fragmentShader: ATMO_FS, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { sunDir: { value: this.sunDir }, camPos: { value: this.camera.position } } }));
    s.add(this.atmo);
    // cahaya
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6); s.add(this.sun);
    s.add(new THREE.AmbientLight(0x223355, 0.8));
    // bintang
    const n = 4000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(300 + Math.random() * 100); pos.set([v.x, v.y, v.z], i * 3);
      const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.3, 0.6 + Math.random() * 0.4); col.set([c.r, c.g, c.b], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    s.add(this.stars);
    // Bulan
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 1 }));
    this.moon.position.set(-38, 8, -30); s.add(this.moon);
    // satelit
    this.sat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }));
    const panelM = new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.6, roughness: 0.3, emissive: 0x112266 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.12), panelM); p1.position.x = 0.26; const p2 = p1.clone(); p2.position.x = -0.26;
    this.sat.add(body, p1, p2); s.add(this.sat);
    // marker
    this.markerGroup = new THREE.Group(); s.add(this.markerGroup);
    const ringGeo = new THREE.RingGeometry(0.1, 0.14, 40);
    for (const c of COUNTRIES) {
      const g = new THREE.Group();
      const p = ll2v(c.lat, c.lon, R * 1.004);
      g.position.copy(p); g.lookAt(p.clone().multiplyScalar(2));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0x66ccff }));
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.cid = c.id;
      g.add(dot, ring, hit); this.markerGroup.add(g);
      this.markers.push({ id: c.id, g, dot, ring, hit, p, c });
    }
    // beam pemain
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.09, 1.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; s.add(this.beam);
    this.arcGroup = new THREE.Group(); s.add(this.arcGroup);
    // kontrol
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.07; this.controls.minDistance = 7.5; this.controls.maxDistance = 30; this.controls.enablePan = false; this.controls.rotateSpeed = 0.5; this.controls.zoomSpeed = 0.6;
    this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.35;
    // label HTML
    this.labelLayer = document.getElementById('labels');
    for (const c of COUNTRIES) {
      const el = document.createElement('div'); el.className = 'wlabel'; el.innerHTML = `<span>${c.flag}</span> ${c.name}`; el.dataset.id = c.id;
      this.labelLayer.appendChild(el); this.labels[c.id] = el;
    }
  }
  setPlayer(id) {
    this.playerId = id; this.controls.autoRotate = !id;
    for (const m of this.markers) {
      const me = m.id === id;
      m.dot.material.color.set(me ? 0xffd166 : 0x66ccff); m.ring.material.color.set(me ? 0xffd166 : 0x66ccff);
      m.dot.scale.setScalar(me ? 1.8 : 1);
      this.labels[m.id].classList.toggle('me', me);
    }
    this.beam.visible = !!id;
    if (id) { const m = this.markers.find(x => x.id === id); const dir = m.p.clone().normalize(); this.beam.position.copy(dir.clone().multiplyScalar(R + 0.8)); this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); }
  }
  select(id) {
    this.selectedId = id;
    for (const m of this.markers) { m.sel = m.id === id; this.labels[m.id].classList.toggle('sel', m.id === id); }
  }
  focus(id, dist = 12) {
    const m = this.markers.find(x => x.id === id); if (!m) return;
    const d = m.p.clone().normalize(); this.focusDir = d.clone().multiplyScalar(dist); this.focusT = 0; this.sunTarget = Math.atan2(d.z, d.x) - 0.55;
  }
  setDiplomacy(dip, byId) {
    while (this.arcGroup.children.length) { const c = this.arcGroup.children.pop(); c.geometry && c.geometry.dispose(); }
    this.arcs = [];
    if (!this.playerId) return;
    const me = this.markers.find(x => x.id === this.playerId);
    for (const id in dip) {
      const d = dip[id]; if (!d.trade && !d.alliance && !d.sanction) continue;
      const o = this.markers.find(x => x.id === id);
      const a = me.p.clone(), b = o.p.clone(), mid = a.clone().add(b).multiplyScalar(0.5);
      mid.setLength(R + a.distanceTo(b) * 0.35 + 0.4);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const color = d.sanction ? 0xff4455 : d.alliance ? 0x6dff9c : 0xffc94d;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
      this.arcGroup.add(line);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color }));
      this.arcGroup.add(pulse);
      this.arcs.push({ curve, pulse, t: Math.random(), sp: 0.12 + Math.random() * 0.08 });
    }
  }
  pick(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.markers.map(m => m.hit), false);
    if (hits.length) {
      // pastikan tidak terhalang bumi
      const e = this.raycaster.intersectObject(this.earth, false);
      if (!e.length || e[0].distance > hits[0].distance - 0.05) return hits[0].object.userData.cid;
    }
    return null;
  }
  update(dt, w, h) {
    this.clock += dt;
    if (this.sunTarget !== undefined) { let df = this.sunTarget - this.sunAngle; df = Math.atan2(Math.sin(df), Math.cos(df)); this.sunAngle += df * Math.min(1, dt * 1.2); if (Math.abs(df) < 0.02) this.sunTarget = undefined; } else this.sunAngle += dt * 0.02;
    this.sunDir.set(Math.cos(this.sunAngle), 0.28, Math.sin(this.sunAngle)).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(50);
    this.earthMat.uniforms.camPos.value.copy(this.camera.position);
    this.clouds.rotation.y += dt * 0.004;
    this.moon.rotation.y += dt * 0.01;
    // satelit
    const st = this.clock * 0.25; this.sat.position.set(Math.cos(st) * 6.6, Math.sin(st * 0.7) * 2.4, Math.sin(st) * 6.6); this.sat.rotation.y = -st;
    if (this.focusDir) {
      this.focusT += dt; const k = Math.min(1, this.focusT * 1.5);
      this.camera.position.lerp(this.focusDir, 0.08 + k * 0.04);
      if (this.camera.position.distanceTo(this.focusDir) < 0.05 || this.focusT > 2.5) this.focusDir = null;
    }
    // marker pulse
    for (const m of this.markers) {
      const t = (this.clock * (m.id === this.playerId ? 1.4 : 0.8) + m.p.x) % 1;
      m.ring.scale.setScalar(1 + t * (m.id === this.playerId ? 3.4 : 2.2)); m.ring.material.opacity = (1 - t) * (m.sel ? 1 : 0.75);
      if (m.sel) m.dot.scale.setScalar(1.6 + Math.sin(this.clock * 6) * 0.3);
    }
    if (this.beam.visible) this.beam.material.opacity = 0.35 + Math.sin(this.clock * 3) * 0.12;
    for (const a of this.arcs) { a.t = (a.t + dt * a.sp) % 1; a.pulse.position.copy(a.curve.getPoint(a.t)); }
    this.controls.update();
    this._labels(w, h);
  }
  _labels(w, h) {
    const cam = this.camera.position, v = new THREE.Vector3();
    for (const m of this.markers) {
      const el = this.labels[m.id];
      const n = m.p.clone().normalize();
      const facing = n.dot(cam.clone().normalize()) > 0.18;
      v.copy(m.p).multiplyScalar(1.05).project(this.camera);
      if (!facing || this.hideLabels) { el.style.display = 'none'; continue; }
      el.style.display = 'block'; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h - 16}px) translate(-50%,-100%)`;
    }
  }
  resize(w, h) { this.camera.aspect = w / h; this.W = w; this.H = h; this.offset(this.shift); this.camera.updateProjectionMatrix(); }
  offset(f) { this.shift = f; if (f) this.camera.setViewOffset(this.W, this.H, -this.W * f, 0, this.W, this.H); else this.camera.clearViewOffset(); }
}
