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
    this.cam = new THREE.PerspectiveCamera(42, w / h, 0.1, 1000); this.cam.position.set(0, 4, 15);
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
    this.controls = new OrbitControls(this.cam, this.renderer.domElement); Object.assign(this.controls, { enableDamping: true, dampingFactor: .07, minDistance: 6.8, maxDistance: 28, enablePan: false, rotateSpeed: .5, zoomSpeed: .7, autoRotate: true, autoRotateSpeed: .25 });
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
  refresh() { for (const m of this.markers.values()) m.material.color.set(this.colorOf(m.userData.c)); if (this.sel) this.setSelected(this.sel); }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.cam);
    const hit = this.ray.intersectObjects([...this.markers.values()], false); if (!hit.length) return null;
    const eh = this.ray.intersectObject(this.earth, false); if (eh.length && eh[0].distance < hit[0].distance - 0.02) return null; return hit[0].object.userData.code;
  }
  setSelected(code) { this.sel = code; const m = this.markers.get(code); if (!m) { this.ring.visible = false; return; } this.ring.visible = true; this.ring.position.copy(m.position).multiplyScalar(1.002); this.ring.lookAt(m.position.clone().multiplyScalar(2)); }
  focus(code, dist = 11) { const m = this.markers.get(code); if (!m) return; this.target = m.position.clone().normalize().multiplyScalar(dist); this.sunTarget = Math.atan2(m.position.z, m.position.x) - 0.5; this.controls.autoRotate = false; }
  setRoutes(routes) { // routes: [{from:[lat,lng], to:[lat,lng], color}]
    for (const r of this.routes) { this.scene.remove(r.line); r.line.geometry.dispose(); this.scene.remove(r.ship); } this.routes = [];
    for (const r of routes) { const a = ll2v(r.from[0], r.from[1], R * 1.003), b = ll2v(r.to[0], r.to[1], R * 1.003), mid = a.clone().add(b).multiplyScalar(.5).setLength(R + a.distanceTo(b) * .32 + .25); const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(70)), new THREE.LineBasicMaterial({ color: r.color || 0xfbbf24, transparent: true, opacity: .55 })); this.scene.add(line);
      const ship = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, .045), new THREE.MeshBasicMaterial({ color: 0xffd166 })); const glow = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: .35 })); ship.add(hull, glow); this.scene.add(ship);
      this.routes.push({ line, ship, curve, t: Math.random(), sp: .035 + Math.random() * .03 }); }
  }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  loop(now) {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop); const dt = Math.min(.08, (now - this.last) / 1000); this.last = now; this.t += dt;
    if (this.sunTarget !== undefined) { let d = this.sunTarget - this.sunA; d = Math.atan2(Math.sin(d), Math.cos(d)); this.sunA += d * Math.min(1, dt * 1.5); if (Math.abs(d) < .02) this.sunTarget = undefined; } else this.sunA += dt * .02;
    this.sunDir.set(Math.cos(this.sunA), .28, Math.sin(this.sunA)).normalize(); this.sun.position.copy(this.sunDir).multiplyScalar(50); this.clouds.rotation.y += dt * .004;
    if (this.target) { this.cam.position.lerp(this.target, .07); if (this.cam.position.distanceTo(this.target) < .05) this.target = null; }
    if (this.ring.visible) { const k = (this.t * 1.2) % 1; this.ring.scale.setScalar(1 + k * 2.2); this.ring.material.opacity = (1 - k) * .9; }
    for (const r of this.routes) { r.t = (r.t + dt * r.sp) % 1; const p = r.curve.getPoint(r.t); r.ship.position.copy(p); r.ship.lookAt(r.curve.getPoint(Math.min(1, r.t + .01))); }
    this.controls.update(); this.renderer.render(this.scene, this.cam);
  }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose(); this.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); }); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
