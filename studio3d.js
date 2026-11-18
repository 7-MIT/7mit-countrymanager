// country.7mit — Studio 3D untuk Siaran Langsung: ruang studio TV (Breaking News) dan ruang sidang tiap aliansi (low-poly three.js).
// Tokoh 3D berbicara (mulut, kepala, tangan), kamera sinematik berpindah ke pembicara.
import * as THREE from './lib/three.module.js';

const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const hue = (s) => { let h = 0; for (const c of String(s || '?')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const col = (h, s, l) => new THREE.Color().setHSL(h / 360, s, l);
// gaya ruang sidang per aliansi (bentuk, warna dinding, aksen)
const STYLE = {
  UN: { shape: 'hemi', wall: 0x1f5f9a, accent: 0x7cc4ff, floor: 0x1b2b3c, name: 'Sidang Umum' },
  EU: { shape: 'hemi', wall: 0x1a3a9a, accent: 0xffd400, floor: 0x161c3a, name: 'Parlemen' },
  AU: { shape: 'hemi', wall: 0x1c5f38, accent: 0xe8b923, floor: 0x14281c, name: 'Majelis' },
  ASEAN: { shape: 'round', wall: 0x1a479a, accent: 0xe03a3a, floor: 0x182236, name: 'Meja Bundar' },
  NATO: { shape: 'round', wall: 0x0e2650, accent: 0xd5dcee, floor: 0x0f1626, name: 'Dewan' },
  G20: { shape: 'round', wall: 0x2a2a38, accent: 0x6fe0c0, floor: 0x1a1a22, name: 'KTT' },
  BRICS: { shape: 'round', wall: 0x6a1b1b, accent: 0xffc54a, floor: 0x261414, name: 'KTT' },
  OPEC: { shape: 'round', wall: 0x1c3a2c, accent: 0xe5c06a, floor: 0x121e18, name: 'Dewan' },
};
const styleOf = (k) => STYLE[k] || { shape: hue(k) % 2 ? 'hemi' : 'round', wall: col(hue(k), .45, .25).getHex(), accent: col(hue(k) + 40, .8, .65).getHex(), floor: 0x1a1a24, name: 'Sidang' };

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData = { c, g, draw, w, h }; return t; }
function redraw(t) { const u = t.userData; u.draw(u.g, u.w, u.h); t.needsUpdate = true; }
function wrap(g, text, x, y, maxW, lh, maxLines = 4) { const words = String(text || '').split(' '); let line = '', yy = y, n = 0; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); yy += lh; line = w; if (++n >= maxLines) return; } else line = t; } if (line) g.fillText(line, x, yy); }

const M = {}; const std = (c, o = {}) => { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: .05, ...o })); };

// ---------- tokoh ----------
function person(name, o = {}) {
  const h = hue(name), skin = col(20 + h % 22, .42, .5 + (h % 20) / 100), suit = col(h, .32, o.chair ? .2 : .26 + (h % 5) / 40), hair = col(15 + (h * 7) % 40, .4, .1 + (h % 24) / 100), female = (h % 3) === 0;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const seatY = o.stand ? 0 : .42;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.26, .31, .72, 10), std(suit.getHex())); torso.position.y = seatY + .72; body.add(torso);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.31, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(suit.getHex())); shoulder.position.y = seatY + 1.04; shoulder.scale.set(1, .5, .8); body.add(shoulder);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(.14, .4, .02), std(0xf2f2f2)); shirt.position.set(0, seatY + .95, .26); body.add(shirt);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(.05, .32, .02), std(o.chair ? 0xffd470 : col(h + 180, .7, .4).getHex())); tie.position.set(0, seatY + .93, .275); body.add(tie);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .1, 8), std(skin.getHex())); neck.position.y = seatY + 1.1; body.add(neck);
  const head = new THREE.Group(); head.position.y = seatY + 1.32; body.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.19, 14, 12), std(skin.getHex(), { roughness: .8 })); face.scale.set(.92, 1.06, .95); head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * .52), std(hair.getHex())); cap.position.y = .02; cap.rotation.x = -.18; head.add(cap);
  if (female) { const back = new THREE.Mesh(new THREE.CylinderGeometry(.19, .15, .3, 10, 1, true), std(hair.getHex(), { side: THREE.DoubleSide })); back.position.set(0, -.1, -.07); head.add(back); }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), eyes = [-.065, .065].map(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), eyeM); e.position.set(x, .03, .17); head.add(e); return e; });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.09, .03, .02), new THREE.MeshBasicMaterial({ color: 0x7a1f2b })); mouth.position.set(0, -.07, .175); head.add(mouth);
  const arms = [-1, 1].map(sd => { const a = new THREE.Group(); a.position.set(sd * .33, seatY + 1.0, 0); const up = new THREE.Mesh(new THREE.CylinderGeometry(.07, .06, .36, 8), std(suit.getHex())); up.position.y = -.18; a.add(up); const hand = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), std(skin.getHex())); hand.position.y = -.4; a.add(hand); a.rotation.x = o.stand ? .05 : -.9; a.rotation.z = sd * .12; body.add(a); return a; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd470, transparent: true, opacity: 0 })); ring.position.y = .03; g.add(ring);
  g.userData = { head, mouth, eyes, arms, body, ring, seed: Math.random() * 10, talk: 0, mood: '', stand: !!o.stand };
  return g;
}

function animatePerson(p, t, dt, talking) {
  const u = p.userData; u.talk += ((talking ? 1 : 0) - u.talk) * Math.min(1, dt * 8);
  const s = t + u.seed, tk = u.talk;
  u.body.rotation.z = Math.sin(s * .6) * .012; u.body.position.y = Math.sin(s * 1.1) * .008 + tk * Math.abs(Math.sin(s * 6)) * .012;
  u.head.rotation.x = Math.sin(s * 5) * .05 * tk + Math.sin(s * .8) * .02; u.head.rotation.y = Math.sin(s * .5) * .1 * (1 - tk) + Math.sin(s * 3.1) * .07 * tk;
  u.mouth.scale.set(1 - .25 * tk * Math.abs(Math.sin(s * 11)), .5 + tk * (.5 + Math.abs(Math.sin(s * 13)) * 2.6), 1);
  const blink = (Math.sin(s * 1.3) > .985) ? .15 : 1; u.eyes.forEach(e => { e.scale.y = blink; });
  u.arms[1].rotation.x = (u.stand ? .05 : -.9) - tk * (.5 + Math.sin(s * 4.2) * .35); u.arms[1].rotation.z = .12 + tk * (.25 + Math.sin(s * 3.3) * .2); u.arms[0].rotation.x = (u.stand ? .05 : -.9) - tk * Math.max(0, Math.sin(s * 2.1)) * .4;
  u.ring.material.opacity = tk * (.55 + Math.sin(t * 6) * .2);
}

// ---------- adegan ----------
function newsSet(scene, spec) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2), std(0x56677f, { roughness: .4, metalness: .15 })); scene.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 9, 48, 1, true, Math.PI - 1.05, 2.1), std(0x3a64b0, { side: THREE.BackSide, roughness: .9 })); wall.position.set(0, 4.4, 2); scene.add(wall);
  const bigTex = canvasTex(1024, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0a12'); gr.addColorStop(1, '#8c1426'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(w * .78, h * .5, 40 + i * 28, 40 + i * 28, 0, 0, 7); g.stroke(); } g.fillStyle = '#fff'; g.font = '800 76px Inter,sans-serif'; g.fillText('TVRI WORLD', 40, 110); g.fillStyle = '#ffd470'; g.font = '700 34px Inter,sans-serif'; g.fillText('BERITA UMUM', 44, 160); g.fillStyle = '#fff'; g.font = '600 38px Inter,sans-serif'; g.fillStyle = '#ffd9de'; wrap(g, spec.headline || 'country.7mit siaran langsung', 40, 235, w * .6, 50, 4); g.fillStyle = '#ffd470'; g.font = '700 28px Inter,sans-serif'; g.fillText('country.7mit · LIVE', 40, h - 30); });
  const big = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.8), new THREE.MeshBasicMaterial({ map: bigTex })); big.position.set(0, 3.6, -7.9); big.rotation.y = 0; scene.add(big);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9.9, 5.1, .15), std(0x151515, { metalness: .6, roughness: .3 })); frame.position.set(0, 3.6, -8.02); scene.add(frame);
  for (const sx of [-1, 1]) { const tex = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#10243f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd470'; g.font = '800 44px Inter,sans-serif'; g.fillText('LIVE', 30, 90); g.strokeStyle = '#6fb7ff'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(20, 160 + i * 52); g.lineTo(w - 20, 160 + i * 52 - (i % 2 ? 24 : 0)); g.stroke(); } }); const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshBasicMaterial({ map: tex })); sc.position.set(sx * 6.4, 3.3, -7.2); sc.rotation.y = -sx * .35; scene.add(sc); }
  // meja siaran
  const desk = new THREE.Mesh(new THREE.BoxGeometry(6, .95, 1.4), std(0x131820, { metalness: .5, roughness: .25 })); desk.position.set(0, .48, -2.1); scene.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.1, .06, 1.5), std(0xe9eef5, { metalness: .3, roughness: .2 })); top.position.set(0, .98, -2.1); scene.add(top);
  const led = new THREE.Mesh(new THREE.BoxGeometry(5.8, .08, .04), new THREE.MeshBasicMaterial({ color: 0xff3b4a })); led.position.set(0, .7, -1.38); scene.add(led);
  for (const sx of [-1.3, 1.3]) { const mic = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .35, 6), std(0x222222)); mic.position.set(sx + .5, 1.18, -1.8); scene.add(mic); const mh = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), std(0x111111)); mh.position.set(sx + .5, 1.36, -1.8); scene.add(mh); }
  const people = {}; [['Rania', -1.3], ['Dimas', 1.3]].forEach(([n, x]) => { const p = person(n); p.position.set(x, 0, -2.75); scene.add(p); people[n] = p; });
  const rp = person('Reporter', { stand: true }); rp.position.set(5.2, 0, -4.2); rp.rotation.y = -.5; scene.add(rp); people.Reporter = rp;
  const link = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshBasicMaterial({ map: canvasTex(512, 300, (g, w, h) => { g.fillStyle = '#101820'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3b4a'; g.beginPath(); g.arc(40, 40, 12, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '800 34px Inter,sans-serif'; g.fillText('LIVE LINK', 64, 52); g.font = '600 24px Inter,sans-serif'; g.fillStyle = '#9fd0ff'; g.fillText('Reporter lapangan', 24, h - 24); }) })); link.position.set(5.2, 2.5, -5.2); link.rotation.y = -.5; scene.add(link);
  // kamera TV
  const cams = []; for (const sx of [-1, 1]) { const c = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .45, .8), std(0x1a1a1a)); body.position.y = 1.6; c.add(body); const lens = new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, .5, 10).rotateX(Math.PI / 2), std(0x000000, { metalness: .7 })); lens.position.set(0, 1.6, -.6); c.add(lens); const tally = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); tally.position.set(0, 1.88, -.2); c.add(tally); const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.4, 6), std(0x222222)); leg.position.y = .8; c.add(leg); c.position.set(sx * 3.6, 0, 3.2); c.rotation.y = Math.PI + sx * .35; scene.add(c); cams.push({ c, tally }); }
  // lampu
  for (let i = -2; i <= 2; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, .08, .25), new THREE.MeshBasicMaterial({ color: 0xfff3d0 })); bar.position.set(i * 3, 7, -2); scene.add(bar); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a78, 2.4)); scene.add(new THREE.AmbientLight(0xffffff, .9)); const d = new THREE.DirectionalLight(0xfff4e6, 2.4); d.position.set(2, 6, 6); scene.add(d); const pl = new THREE.PointLight(0xff4a5a, 18, 18); pl.position.set(0, 3, -6); scene.add(pl);
  return { people, home: { pos: [0, 2.0, 4.8], look: [0, 1.7, -3] }, focus: (k) => { const p = people[k]; if (!p) return null; const x = p.position.x; return k === 'Reporter' ? { pos: [x * .6, 2, 3.2], look: [x, 1.6, -4] } : { pos: [x * .5, 1.8, 3.4], look: [x, 1.55, -2.7] }; }, tick: (t) => { cams.forEach((c, i) => { c.c.rotation.y = Math.PI + (i ? 1 : -1) * (.35 + Math.sin(t * .4 + i) * .06); c.tally.visible = Math.sin(t * 2 + i * 3) > -.4; }); }, setText: () => { redraw(bigTex); }, bigTex };
}

function hallSet(scene, spec) {
  const st = styleOf(spec.alliance), accent = new THREE.Color(st.accent);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48).rotateX(-Math.PI / 2), std(new THREE.Color(st.floor).multiplyScalar(2.2).getHex(), { roughness: .45, metalness: .15 })); scene.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48).rotateX(-Math.PI / 2), std(accent.clone().multiplyScalar(.35).getHex(), { roughness: 1 })); rug.position.y = .01; scene.add(rug);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 10, 56, 1, true, Math.PI - 1.2, 2.4), std(new THREE.Color(st.wall).multiplyScalar(1.5).getHex(), { side: THREE.BackSide, roughness: .85 })); wall.position.set(0, 5, 0); scene.add(wall);
  for (let i = -5; i <= 5; i++) { const pil = new THREE.Mesh(new THREE.BoxGeometry(.5, 10, .5), std(new THREE.Color(st.wall).multiplyScalar(1.5).getHex())); const a = i * .19; pil.position.set(Math.sin(a) * 14.6, 5, -Math.cos(a) * 14.6); scene.add(pil); }
  const scrTex = canvasTex(1024, 420, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0a1424'); gr.addColorStop(1, '#14243e'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#' + accent.getHexString(); g.fillRect(0, 0, 14, h); g.fillStyle = '#fff'; g.font = '800 70px Inter,sans-serif'; g.fillText(spec.alliance || '', 50, 105); g.font = '700 30px Inter,sans-serif'; g.fillStyle = '#' + accent.getHexString(); g.fillText((st.name + ' · LIVE').toUpperCase(), 50, 155); g.fillStyle = '#e7eefc'; g.font = '600 34px Inter,sans-serif'; wrap(g, spec.theme || '', 50, 225, w - 100, 44, 3); });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.7), new THREE.MeshBasicMaterial({ map: scrTex })); scr.position.set(0, 5.4, -13.2); scene.add(scr);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(9.3, 4, .15), std(0x111111, { metalness: .6, roughness: .3 })); fr.position.set(0, 5.4, -13.3); scene.add(fr);
  // bendera dinding
  for (let i = -4; i <= 4; i++) { if (Math.abs(i) < 2) continue; const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((hue(spec.alliance) + i * 22) / 360, .6, .45), side: THREE.DoubleSide })); const a = i * .26; f.position.set(Math.sin(a) * 13.6, 5, -Math.cos(a) * 13.6 + .4); f.rotation.y = -a; scene.add(f); }
  // podium ketua
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, .5, 32, 1, false, 0, Math.PI * 2), std(0x2a2a30, { roughness: .4 })); dais.position.set(0, .25, -8.8); scene.add(dais);
  const cdesk = new THREE.Mesh(new THREE.BoxGeometry(3.6, .95, 1.1), std(0x151515, { metalness: .4, roughness: .3 })); cdesk.position.set(0, 1.0, -7.8); scene.add(cdesk); const cled = new THREE.Mesh(new THREE.BoxGeometry(3.4, .06, .03), new THREE.MeshBasicMaterial({ color: accent })); cled.position.set(0, .8, -7.24); scene.add(cled);
  const people = {}, names = {}; const chair = person('Ketua ' + spec.alliance, { chair: true }); chair.position.set(0, .5, -9.2); scene.add(chair); people.CHAIR = chair;
  const dels = (spec.delegates || []).slice(0, spec.shape === 'round' || st.shape === 'round' ? 12 : 14), n = dels.length, round = st.shape === 'round';
  const flagTex = (d) => canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#10151e'; g.fillRect(0, 0, w, h); g.fillStyle = '#' + accent.getHexString(); g.fillRect(0, h - 8, w, 8); g.fillStyle = '#fff'; g.font = '56px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.fillText(d.flag || '', 10, 66); g.font = '800 34px Inter,sans-serif'; g.fillText(String(d.code || ''), 100, 62); });
  dels.forEach((d, i) => { let x, z, ry, yy = 0;
    if (round) { const a = Math.PI * 2 * (i + .5) / n, rx = 5.4, rz = 3.6; x = Math.sin(a) * rx; z = Math.cos(a) * rz - 1.6; ry = Math.atan2(-x, -(z + 1.6)); }
    else { const rows = n > 7 ? 2 : 1, row = i % rows, idx = Math.floor(i / rows), cnt = Math.ceil(n / rows), a = (idx - (cnt - 1) / 2) * (cnt > 5 ? .3 : .38); const r = 5.2 + row * 2.2; x = Math.sin(a) * r; z = Math.cos(a) * r * .5 - 1.4 - row * 1.8; yy = row * .55; ry = Math.atan2(-x * .35, 8 - z); }
    const dk = new THREE.Mesh(new THREE.BoxGeometry(1.25, .62, .55), std(0x20232b, { roughness: .4 })); dk.position.set(x, .62 + yy, z); dk.rotation.y = ry; scene.add(dk); if (yy) { const st2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, yy, 1.8), std(0x14161c)); st2.position.set(x, yy / 2, z); scene.add(st2); }
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(.62, .24), new THREE.MeshBasicMaterial({ map: flagTex(d) })); pl.position.set(0, .12, .29); pl.rotation.x = -.4; dk.add(pl);
    const p = person(d.president || d.name || d.code); p.position.set(x - Math.sin(ry) * .55, yy, z - Math.cos(ry) * .55); p.rotation.y = ry; scene.add(p); people[d.code] = p; if (d.player) { const star = new THREE.Mesh(new THREE.OctahedronGeometry(.1), new THREE.MeshBasicMaterial({ color: 0xffd470 })); star.position.set(0, 2.15, 0); p.add(star); p.userData.star = star; } });
  if (round) { const tbl = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, .12, 40).scale(1, 1, .68), std(0x20242c, { metalness: .5, roughness: .25 })); tbl.position.set(0, .9, -1.6); scene.add(tbl); const holo = new THREE.Mesh(new THREE.TorusGeometry(.9, .04, 8, 32), new THREE.MeshBasicMaterial({ color: accent })); holo.position.set(0, 1.4, -1.6); holo.rotation.x = Math.PI / 2; scene.add(holo); people._holo = holo; }
  // lampu
  for (let i = 0; i < 7; i++) { const a = (i - 3) * .32; const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, .08, .3), new THREE.MeshBasicMaterial({ color: 0xfff3d0 })); l.position.set(Math.sin(a) * 9, 9, -Math.cos(a) * 9 + 1); l.rotation.y = -a; scene.add(l); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a78, 2.2)); scene.add(new THREE.AmbientLight(0xffffff, .9)); const d = new THREE.DirectionalLight(0xfff4e6, 2); d.position.set(3, 8, 8); scene.add(d); const pl = new THREE.PointLight(accent, 14, 22); pl.position.set(0, 4, -7); scene.add(pl);
  return { people, home: { pos: [0, round ? 4.0 : 2.9, 7.6], look: [0, round ? 1.0 : 1.7, -4.2] }, focus: (k) => { const p = people[k]; if (!p || k === '_holo') return null; if (k === 'CHAIR') return { pos: [0, 2.6, -2.5], look: [0, 1.9, -9.2] }; const q = p.position; return { pos: [q.x * .7, (round ? 3.6 : 2.7) + q.y, q.z + 4.6], look: [q.x, 1.6 + q.y, q.z] }; }, tick: (t) => { if (people._holo) people._holo.rotation.z = t * .6; for (const k in people) { const s = people[k].userData?.star; if (s) { s.rotation.y = t * 2; s.position.y = 2.15 + Math.sin(t * 3) * .05; } } }, setText: () => redraw(scrTex) };
}

export function mkStage(host, spec) {
  const w = () => Math.max(260, host.clientWidth || 640), h = () => Math.max(200, host.clientHeight || 380);
  const renderer = new THREE.WebGLRenderer({ antialias: !COARSE, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, COARSE ? 1.25 : 1.6)); renderer.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  const scene = new THREE.Scene(); scene.background = new THREE.Color(spec.kind === 'news' ? 0x1b2a44 : 0x1a2338);
  const set = spec.kind === 'news' ? newsSet(scene, spec) : hallSet(scene, spec), cam = new THREE.PerspectiveCamera(50, 1, .1, 120);
  const resize = () => { renderer.setSize(w(), h(), false); cam.aspect = w() / h(); cam.updateProjectionMatrix(); }; resize(); const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; ro?.observe(host);
  let talking = null, tgt = { pos: [...set.home.pos], look: [...set.home.look] }, cur = { pos: new THREE.Vector3(...set.home.pos), look: new THREE.Vector3(...set.home.look) }, raf = 0, last = performance.now(), t = 0, dead = false;
  const dispose = () => { if (dead) return; dead = true; cancelAnimationFrame(raf); ro?.disconnect(); renderer.dispose(); scene.traverse(o => { o.geometry?.dispose?.(); }); renderer.domElement.remove(); };
  const loop = (now) => { if (dead) return; if (!host.isConnected) return dispose(); raf = requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt; if (document.hidden) return;
    for (const k in set.people) { const p = set.people[k]; if (p.userData?.head) animatePerson(p, t, dt, k === talking); } set.tick?.(t);
    const f = talking ? set.focus(talking) : null, g = f || { pos: set.home.pos.map((v, i) => i === 0 ? v + Math.sin(t * .25) * 1.2 : i === 1 ? v + Math.sin(t * .17) * .15 : v), look: set.home.look }; tgt = g;
    const k = Math.min(1, dt * 2.2); cur.pos.x += (tgt.pos[0] - cur.pos.x) * k; cur.pos.y += (tgt.pos[1] - cur.pos.y) * k; cur.pos.z += (tgt.pos[2] - cur.pos.z) * k; cur.look.x += (tgt.look[0] - cur.look.x) * k; cur.look.y += (tgt.look[1] - cur.look.y) * k; cur.look.z += (tgt.look[2] - cur.look.z) * k;
    cam.position.copy(cur.pos); cam.lookAt(cur.look); renderer.render(scene, cam); };
  raf = requestAnimationFrame(loop);
  return { talk: (k) => { talking = k; }, setText: (txt) => { spec.headline = txt; if (set.bigTex) redraw(set.bigTex); }, dispose, hasPerson: (k) => !!set.people[k] };
}
