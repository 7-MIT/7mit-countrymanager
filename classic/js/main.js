// ============================================================
//  country.7mit — kontroler utama: loop, UI, input
// ============================================================
import * as THREE from 'three';
import { COUNTRIES, SECTORS, BUILDINGS, POLICIES } from './data.js';
import * as Sim from './sim.js';
import { World } from './world.js';
import { Nation } from './nation.js';
import './builders.js';
import { Sound } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const fmt = (n, d = 0) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MONTH_SEC = 4;

// ---------- renderer ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
const world = new World(renderer);
const nation = new Nation(renderer);
nation.controls.enabled = false;

let S = null, view = 'intro', speed = 1, acc = 0, modalOpen = false, tab = 'ringkas', selPlot = null, placing = null, selCountry = null, introPick = null, dragging = false;

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); world.resize(w, h); nation.resize(w, h);
}
addEventListener('resize', resize); resize();

// ---------- util UI ----------
function toast(msg, kind = 'info') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3700);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function fade(fn) { const f = $('#fade'); f.style.opacity = 1; setTimeout(() => { fn(); f.style.opacity = 0; }, 350); }
function showModal(o) {
  modalOpen = true; const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="m glass">${o.icon ? `<div class="big">${o.icon}</div>` : ''}<h2>${o.title}</h2><p>${o.text || ''}</p>${o.html || ''}<div id="mbtns"></div></div>`;
  const b = $('#mbtns', m);
  (o.buttons || []).forEach((bt, i) => {
    const e = document.createElement('button'); e.className = bt.cls || 'btn'; e.innerHTML = bt.label; if (bt.disabled) e.disabled = true;
    e.style.marginRight = '8px'; e.onclick = () => { Sound.click(); if (!bt.keep) closeModal(); bt.fn && bt.fn(); }; b.appendChild(e);
  });
  if (o.choices) o.choices.forEach((c, i) => {
    const e = document.createElement('button'); e.className = 'ch'; e.innerHTML = `<b>${c.label}</b><span>${c.hint}${c.costTxt ? ' • ' + c.costTxt : ''}</span>`;
    if (c.disabled) e.disabled = true; e.onclick = () => { Sound.click(); closeModal(); c.fn(); }; b.appendChild(e);
  });
}
function closeModal() { modalOpen = false; $('#modal').classList.add('hidden'); }

// ---------- INTRO ----------
function buildIntro() {
  const list = $('#clist');
  list.innerHTML = COUNTRIES.map(c => {
    const d = Math.round(clamp(5 - (c.gdp > 8000 ? 1.5 : c.gdp > 2500 ? 1 : 0) - (c.corr < 30 ? 1 : 0) + (c.corr > 55 ? 1 : 0) + (c.infl0 > 20 ? 1.5 : 0) + (c.unemp0 > 20 ? 1 : 0) - 2, 1, 5));
    c.diff = d;
    return `<button class="cc" data-id="${c.id}"><span class="fl">${c.flag}</span><b>${c.name}</b><span>${fmt(c.pop)} jt jiwa</span><br><span class="diff">${'★'.repeat(d)}${'☆'.repeat(5 - d)}</span></button>`;
  }).join('');
  world.offset(innerWidth > 900 ? 0.17 : 0);
  list.onclick = e => { const b = e.target.closest('.cc'); if (b) { Sound.unlock(); Sound.click(); pickIntro(b.dataset.id); } };
  const lbl = ['Mudah', 'Santai', 'Sedang', 'Sulit', 'Ekstrem'];
  window._lbl = lbl;
  $('#pname').value = localStorage.getItem('country7mit_name') || '';
  $('#startBtn').onclick = startNew;
  $('#contBtn').disabled = !Sim.hasSave();
  $('#contBtn').onclick = () => { Sound.unlock(); const s = Sim.load(); if (s) begin(s); else toast('Tidak ada data tersimpan', 'warn'); };
  const best = Sim.bestScore(); $('#best').textContent = best ? `🏆 Rekor: ${best.score} poin (Grade ${best.grade}) — ${best.country}` : '';
}
function pickIntro(id) {
  introPick = id; const c = Sim.byId(id);
  document.querySelectorAll('.cc').forEach(e => e.classList.toggle('sel', e.dataset.id === id));
  world.select(id); world.focus(id, 11.5); world.controls.autoRotate = false;
  $('#cinfo').innerHTML = `<b>${c.flag} ${c.name}</b> — ibu kota ${c.capital}<br>PDB <b>$${fmt(c.gdp)} M</b> • Penduduk <b>${fmt(c.pop)} jt</b> • Pertumbuhan <b>${c.g0}%</b> • Korupsi <b>${c.corr}</b><br>✨ ${c.perk}<br>Tingkat kesulitan: <b>${window._lbl[c.diff - 1]}</b>`;
  $('#startBtn').disabled = false;
}
function startNew() {
  Sound.unlock(); const name = $('#pname').value.trim() || 'Presiden';
  try { localStorage.setItem('country7mit_name', name); } catch (e) {}
  if (!introPick) return; begin(Sim.newGame(introPick, name), true);
}
function begin(state, isNew) {
  S = state; fade(() => {
    $('#intro').classList.add('hidden'); $('#hud').classList.remove('hidden'); world.offset(0);
    world.setPlayer(S.cid); world.select(null); world.setDiplomacy(S.dip);
    nation.setup(S); setView('nation', true); updateAll(); selPlot = null;
    speed = 1; syncSpeed(); Sound.ambient(true); tabRender();
    if (isNew) setTimeout(() => showWelcome(), 500);
    else toast(`Selamat datang kembali, Presiden ${S.president}!`, 'good');
  });
}
function showWelcome() {
  const c = S.cn;
  showModal({
    icon: c.flag, title: `Selamat Datang, Presiden ${S.president}!`,
    text: `Anda resmi memimpin <b>${c.name}</b>. Masa jabatan <b>5 tahun</b> — rakyat akan memilih kembali di pemilu. Kelola anggaran, bangun kota, jalin diplomasi, dan jaga kepuasan rakyat di atas <b>50%</b>.`,
    html: `<div style="font-size:12.5px;color:var(--dim);margin-bottom:14px;line-height:1.7">🖱️ <b>Klik plot</b> di kota → bangun / tingkatkan • <b>Seret</b> untuk memutar • <b>Scroll</b> untuk zoom<br>⌨️ <span class="kbd">Spasi</span> jeda • <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> kecepatan • <span class="kbd">M</span> globe dunia • <span class="kbd">Esc</span> batal</div>`,
    buttons: [{ label: '🚀 Mulai Memimpin', cls: 'btn pri' }],
  });
}

// ---------- tampilan ----------
function setView(v, instant) {
  const apply = () => {
    view = v;
    nation.controls.enabled = v === 'nation'; world.controls.enabled = v === 'world' || v === 'intro';
    $('#labels').style.display = v === 'nation' ? 'none' : 'block'; world.hideLabels = v === 'nation';
    document.querySelectorAll('#views [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (v === 'world') { world.setPlayer(S.cid); world.setDiplomacy(S.dip); world.focus(S.cid, 14); }
    hint();
  };
  if (instant) apply(); else fade(apply);
}
function hint(msg) {
  const h = $('#hint');
  if (!msg && placing) msg = `Pilih plot untuk membangun <b>${BUILDINGS[placing].name}</b> — Esc untuk batal`;
  if (!msg && view === 'world') msg = 'Klik titik negara di globe untuk melihat diplomasi';
  if (!msg) { h.classList.add('hidden'); return; } h.innerHTML = msg; h.classList.remove('hidden');
}

// ---------- HUD ----------
function trend(v, good = 1) { return v > 0.05 ? `<em class="${good > 0 ? 'up' : 'down'}">▲</em>` : v < -0.05 ? `<em class="${good > 0 ? 'down' : 'up'}">▼</em>` : ''; }
const prev = {};
function updateHud() {
  const ag = Sim.aggregate(S);
  $('#wflag').textContent = S.cn.flag; $('#wname').textContent = S.cn.name; $('#wpres').textContent = `Presiden ${S.president} • Periode ${S.term}/${Sim.MAX_TERMS}`;
  $('#date').textContent = '📅 ' + Sim.dateStr(S);
  const el = Math.floor((S.month % Sim.TERM_MONTHS) / 12);
  const ch = [
    ['Kas Negara', Sim.money(S.treasury), `<em class="${S.lastNet >= 0 ? 'up' : 'down'}">${S.lastNet >= 0 ? '+' : ''}${Sim.money(S.lastNet)}/bln</em>`],
    ['Utang', Sim.money(S.debt), `<em class="${S.debt / S.gdp > 1.2 ? 'down' : 'warn'}">${fmt(S.debt / S.gdp * 100)}%</em>`],
    ['PDB', Sim.money(S.gdp), `<em class="${S.growth >= 0 ? 'up' : 'down'}">${S.growth >= 0 ? '+' : ''}${fmt(S.growth, 1)}%</em>`],
    ['Penduduk', fmt(S.pop, 1) + ' jt', ''],
    ['Inflasi', fmt(S.inflation, 1) + '%', trend(S.inflation - (prev.inf || S.inflation), -1)],
    ['Pengangguran', fmt(S.unemployment, 1) + '%', trend(S.unemployment - (prev.un || S.unemployment), -1)],
    ['Kepuasan', fmt(S.approval) + '%', `<em class="${S.approval >= 50 ? 'up' : 'down'}">${S.approval >= 50 ? '😊' : S.approval >= 30 ? '😐' : '😡'}</em>`],
    ['Listrik', S.energySupply >= S.energyDemand ? 'Aman' : 'Defisit', `<em class="${S.blackout > 0.03 ? 'down' : 'up'}">${fmt(S.energySupply / S.energyDemand * 100)}%</em>`],
  ];
  $('#stats').innerHTML = ch.map(c => `<div class="glass chip"><small>${c[0]}</small><b>${c[1]}</b>${c[2]}</div>`).join('');
  prev.inf = S.inflation; prev.un = S.unemployment;
}
function syncSpeed() { document.querySelectorAll('#spd button').forEach(b => b.classList.toggle('on', +b.dataset.s === speed)); }

// ---------- PANEL TABS ----------
const TABS = [['ringkas', '📊', 'Ringkasan'], ['anggaran', '💰', 'Anggaran'], ['bangun', '🏗️', 'Bangun'], ['diplo', '🤝', 'Diplomasi'], ['kebijakan', '📜', 'Kebijakan'], ['berita', '📰', 'Berita']];
function tabRender() {
  $('#tabs').innerHTML = TABS.map(t => `<button data-t="${t[0]}" title="${t[2]}" class="${t[0] === tab ? 'on' : ''}">${t[1]}</button>`).join('');
  renderTab();
}
function bar(v, color) { return `<div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${color}"></i></div>`; }
const colOf = v => v > 66 ? 'linear-gradient(90deg,#34d399,#6ee7a0)' : v > 38 ? 'linear-gradient(90deg,#f59e0b,#ffd166)' : 'linear-gradient(90deg,#ef4444,#ff6b7a)';
function spark(id, arr, color) {
  requestAnimationFrame(() => {
    const c = document.getElementById(id); if (!c) return; const w = c.width = c.clientWidth * 2, h = c.height = 108, x = c.getContext('2d');
    const mn = Math.min(...arr), mx = Math.max(...arr), rg = mx - mn || 1; x.lineWidth = 3; x.strokeStyle = color; x.beginPath();
    arr.forEach((v, i) => { const px = i / Math.max(1, arr.length - 1) * (w - 8) + 4, py = h - 10 - (v - mn) / rg * (h - 20); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
    x.lineTo(w - 4, h); x.lineTo(4, h); x.fillStyle = color + '22'; x.fill();
  });
}
function renderTab() {
  const el = $('#tabbody'); if (!S) return; const scroll = el.scrollTop;
  const fn = { ringkas: tabRingkas, anggaran: tabAnggaran, bangun: tabBangun, diplo: tabDiplo, kebijakan: tabKebijakan, berita: tabBerita }[tab];
  el.innerHTML = fn(); el.scrollTop = scroll;
  if (tab === 'ringkas') { spark('sp1', S.hist.gdp, '#5eead4'); spark('sp2', S.hist.appr, '#ffd166'); }
}
function tabRingkas() {
  const ag = Sim.aggregate(S), nextEl = Sim.TERM_MONTHS - (S.month % Sim.TERM_MONTHS), I = S.idx;
  const rows = [['edu', '🎓 Pendidikan'], ['health', '🏥 Kesehatan'], ['infra', '🛣️ Infrastruktur'], ['tech', '🔬 Teknologi'], ['green', '🌳 Lingkungan'], ['sec', '🛡️ Pertahanan'], ['welfare', '🤲 Kesejahteraan']];
  const score = Sim.score(S);
  return `
  <h3>Kepuasan Rakyat</h3>
  <div class="ind"><div class="l"><span><b>${S.approval >= 50 ? '😊' : '😠'} ${fmt(S.approval, 1)}%</b></span><span>${S.freeplay ? 'Mode bebas' : `Pemilu ${Math.floor(nextEl / 12)} th ${nextEl % 12} bln lagi`}</span></div>${bar(S.approval, colOf(S.approval))}</div>
  <canvas class="spark" id="sp2"></canvas>
  <h3>Pertumbuhan PDB</h3><canvas class="spark" id="sp1"></canvas>
  <h3>Indikator Nasional</h3>
  ${rows.map(r => `<div class="ind"><div class="l"><span>${r[1]}</span><span>${fmt(I[r[0]])} / 100</span></div>${bar(I[r[0]], colOf(I[r[0]]))}</div>`).join('')}
  <div class="ind"><div class="l"><span>⚖️ Bersih dari Korupsi</span><span>${fmt(100 - S.corruption)} / 100</span></div>${bar(100 - S.corruption, colOf(100 - S.corruption))}</div>
  <h3>Energi & Lingkungan</h3>
  <div class="kv"><span>🔌 Pasokan / Permintaan</span><span class="${S.blackout > 0.03 ? 'down' : 'up'}">${fmt(S.energySupply, 1)} / ${fmt(S.energyDemand, 1)}</span></div>
  <div class="kv"><span>🌫️ Polusi udara</span><span>${fmt(S.pollution, 1)}</span></div>
  <div class="kv"><span>🏗️ Proyek aktif</span><span>${S.plots.filter(p => p.b && p.b.progress < 1).length}</span></div>
  <div class="kv"><span>🏢 Bangunan jadi</span><span>${ag.count}</span></div>
  <div class="kv"><span>👷 Lapangan kerja proyek</span><span>${fmt(ag.jobs)}</span></div>
  <h3>Skor Kepemimpinan</h3>
  <div class="kv"><span>${score.title}</span><span style="color:var(--gold);font-weight:800">${score.score} • ${score.grade}</span></div>
  <div style="margin-top:12px" class="row"><button class="btn sm grow" data-a="save">💾 Simpan</button><button class="btn sm grow" data-a="help">❓ Bantuan</button></div>`;
}
function tabAnggaran() {
  const rev = S.lastRev, exp = S.lastExp;
  return `
  <h3>Pajak</h3>
  <div class="sl"><div class="l"><span>Tarif pajak nasional</span><b id="taxv">${fmt(S.tax, 1)}%</b></div><input type="range" min="5" max="45" step="0.5" value="${S.tax}" data-sl="tax"><div style="font-size:11px;color:var(--dim)">Awal: ${S.tax0}% — pajak tinggi menekan ekonomi & kepuasan.</div></div>
  <h3>Alokasi Anggaran (% dari standar)</h3>
  ${SECTORS.map(s => `<div class="sl"><div class="l"><span>${s.icon} ${s.name}</span><b id="sv_${s.k}">${S.spend[s.k]}%</b></div><input type="range" min="0" max="200" step="5" value="${S.spend[s.k]}" data-sl="${s.k}"></div>`).join('')}
  <h3>Neraca Bulanan</h3>
  <div class="kv"><span>Pemasukan</span><span class="up">${Sim.money(rev)}</span></div>
  <div class="kv"><span>Pengeluaran</span><span class="down">${Sim.money(exp)}</span></div>
  <div class="kv"><span>Selisih</span><span class="${rev >= exp ? 'up' : 'down'}">${Sim.money(rev - exp)}</span></div>
  <div class="kv"><span>Kas</span><span>${Sim.money(S.treasury)}</span></div>
  <div class="kv"><span>Utang (${fmt(S.debt / S.gdp * 100)}% PDB)</span><span>${Sim.money(S.debt)}</span></div>
  <div style="margin-top:10px"><button class="btn sm" data-a="repay">💳 Cicil utang</button></div>`;
}
function tabBangun() {
  const ag = Sim.aggregate(S);
  return `<h3>Katalog Proyek</h3><div style="font-size:12px;color:var(--dim);margin-bottom:10px">Klik proyek lalu pilih plot kosong (tanda <b style="color:#4ade80">+</b>) di kota. Atau klik plot langsung.</div>` +
    Object.entries(BUILDINGS).map(([k, d]) => `<button class="item ${placing === k ? 'on' : ''}" data-b="${k}"><span class="ic">${d.icon}</span><span class="tx"><b>${d.name} ${ag.byType[k] ? `<span class="pill g">×${ag.byType[k]}</span>` : ''}</b><span>${d.desc}</span><span>${effTxt(d)}</span></span><span class="pr">${Sim.money(Sim.buildCost(S, k))}</span></button>`).join('');
}
function effTxt(d) {
  const t = []; const nm = { edu: 'Pendidikan', health: 'Kesehatan', infra: 'Infra', tech: 'Teknologi', green: 'Lingkungan', sec: 'Pertahanan', welfare: 'Sejahtera' };
  for (const k in d.fx) t.push(`${d.fx[k] > 0 ? '+' : ''}${d.fx[k]} ${nm[k]}`);
  if (d.energy) t.push(`+${d.energy}⚡`); if (d.dem) t.push(`−${d.dem}⚡`); if (d.jobs) t.push(`${d.jobs}👷`); if (d.poll) t.push(`${d.poll}🌫️`); if (d.trade) t.push('Perdagangan'); if (d.tour) t.push('Wisata'); if (d.ind) t.push('Industri'); if (d.corr) t.push(`${d.corr} Korupsi`);
  return `<span class="pill y">${t.join(' • ')}</span> ⏱ ${d.months} bln`;
}
function tabDiplo() {
  const dp = Sim.dipIncome(S);
  const list = COUNTRIES.filter(c => c.id !== S.cid).sort((a, b) => S.dip[b.id].rel - S.dip[a.id].rel);
  let html = `<div class="kv"><span>Mitra dagang</span><span>${dp.n}</span></div><div class="kv"><span>Aliansi</span><span>${dp.al}</span></div><div class="kv"><span>Pemasukan dagang/bln</span><span class="up">${Sim.money(dp.inc)}</span></div>`;
  if (selCountry && S.dip[selCountry]) {
    const o = Sim.byId(selCountry), d = S.dip[selCountry];
    html += `<h3>${o.flag} ${o.name}</h3><div style="font-size:12px;color:var(--dim);margin-bottom:6px">${o.perk} • PDB $${fmt(o.gdp)}M • Militer ${o.mil}</div>
    <div class="ind"><div class="l"><span>Hubungan ${d.sanction ? '<span class="pill r">DISANKSI</span>' : ''}${d.trade ? '<span class="pill y">DAGANG</span>' : ''}${d.alliance ? '<span class="pill g">ALIANSI</span>' : ''}</span><span>${fmt(d.rel)} / 100</span></div>${bar(d.rel, colOf(d.rel))}</div><div style="margin-top:8px">` +
      Object.entries(Sim.DIP_ACTIONS).map(([k, a]) => {
        const err = Sim.dipCheck(S, selCountry, k); if ((k === 'cabut') && !d.trade && !d.alliance && !d.sanction) return '';
        return `<button class="item" data-d="${k}" ${err ? 'disabled style="opacity:.45"' : ''}><span class="ic">${a.icon}</span><span class="tx"><b>${a.name}</b><span>${err || 'Siap dilakukan'}</span></span><span class="pr">${a.cost ? Sim.money(Sim.dipCost(S, k)) : 'Gratis'}</span></button>`;
      }).join('') + `</div><h3>Semua Negara</h3>`;
  } else html += `<h3>Hubungan Internasional</h3>`;
  html += list.map(c => { const d = S.dip[c.id]; return `<button class="item ${selCountry === c.id ? 'on' : ''}" data-c="${c.id}" style="padding:7px 10px"><span class="ic" style="font-size:22px">${c.flag}</span><span class="tx"><b>${c.name} ${d.trade ? '📦' : ''}${d.alliance ? '🛡️' : ''}${d.sanction ? '⛔' : ''}</b>${bar(d.rel, colOf(d.rel))}</span><span class="pr" style="color:var(--dim)">${fmt(d.rel)}</span></button>`; }).join('');
  return html;
}
function tabKebijakan() {
  return `<h3>Kebijakan Nasional</h3><div style="font-size:12px;color:var(--dim);margin-bottom:10px">Kebijakan berjalan terus-menerus, ada biaya bulanan (% PDB) dan efek jangka panjang.</div>` +
    POLICIES.map(p => `<button class="item ${S.policies[p.k] ? 'on' : ''}" data-p="${p.k}"><span class="ic">${p.icon}</span><span class="tx"><b>${p.name}</b><span>${p.desc}</span><span><span class="pill ${p.cost < 0 ? 'g' : 'y'}">${p.cost < 0 ? 'Pemasukan' : 'Biaya'} ${fmt(Math.abs(p.cost) * 100, 2)}% PDB/12</span></span></span><span class="tog ${S.policies[p.k] ? 'on' : ''}"></span></button>`).join('');
}
function tabBerita() { return `<h3>Catatan Pemerintahan</h3>` + S.log.map(l => `<div class="log ${l.kind}"><small>${l.t}</small>${l.text}</div>`).join(''); }

// ---------- plot card ----------
function renderPlotCard() {
  const c = $('#plotcard');
  if (!selPlot || selPlot === 'palace' || !S) {
    if (selPlot === 'palace') { c.classList.remove('hidden'); c.innerHTML = `<h4>🏛️ Istana Kepresidenan</h4><div class="sub">Pusat pemerintahan ${S.cn.name} — ${S.cn.capital}</div><div style="font-size:13px;color:#c7d4f0">Dari sini Presiden ${S.president} memimpin negeri. Pilih plot kosong di sekitar untuk mulai membangun.</div>`; return; }
    c.classList.add('hidden'); return;
  }
  const [i, j] = selPlot.split(',').map(Number), p = Sim.plotAt(S, i, j), coast = Sim.isCoastal(i, j);
  c.classList.remove('hidden');
  if (!p.b) {
    c.innerHTML = `<h4>🟩 Plot Kosong ${coast ? '<span class="pill y">Pesisir</span>' : ''}</h4><div class="sub">Pilih proyek yang akan dibangun · Kas ${Sim.money(S.treasury)}</div><div class="bgrid">` +
      Object.entries(BUILDINGS).map(([k, d]) => { const err = Sim.canBuild(S, i, j, k); return `<button data-pb="${k}" ${err ? 'disabled' : ''} title="${d.name} — ${err || d.desc}"><i>${d.icon}</i>${d.name.split(' ')[0]}<br><small>${Sim.money(Sim.buildCost(S, k))}</small></button>`; }).join('') + `</div>`;
  } else {
    const b = p.b, d = BUILDINGS[b.type], done = b.progress >= 1, ue = Sim.canUpgrade(S, p);
    c.innerHTML = `<h4>${d.icon} ${d.name} <span class="pill g">Lv.${b.level}</span></h4><div class="sub">${done ? 'Beroperasi' : `Sedang dibangun… ${Math.round(b.progress * 100)}%`} · Upkeep ${Sim.money(d.upkeep * b.level * Sim.scale(S) * 0.12 * 0.7 + d.upkeep * Sim.scale(S) * 0.12 * 0.3)}/bln</div>
    <div style="font-size:12.5px;color:#c7d4f0;margin-bottom:10px">${d.desc}<br>${effTxt(d)}</div>
    ${done ? '' : `<div class="bar" style="margin-bottom:10px"><i style="width:${b.progress * 100}%;background:linear-gradient(90deg,#f59e0b,#ffd166)"></i></div>`}
    <div class="row"><button class="btn sm pri grow" data-a="upg" ${ue ? 'disabled' : ''} title="${ue || ''}">⬆️ Upgrade Lv.${b.level + 1} (${b.level < 3 ? Sim.money(Sim.upgradeCost(S, p)) : '—'})</button><button class="btn sm red" data-a="dem">🧨 Bongkar</button></div>${ue && b.level < 3 ? `<div style="font-size:11px;color:var(--dim);margin-top:6px">${ue}</div>` : ''}`;
  }
}

// ---------- event delegasi ----------
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { Sound.click(); tab = b.dataset.t; tabRender(); } });
$('#tabbody').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.b) { Sound.click(); placing = placing === t.dataset.b ? null : t.dataset.b; if (placing && selPlot && selPlot !== 'palace') { const [i, j] = selPlot.split(',').map(Number); if (!Sim.plotAt(S, i, j).b) { doBuild(i, j, placing); placing = null; } } if (placing) setView('nation'); hint(); renderTab(); }
  else if (t.dataset.c) { Sound.click(); selCountry = t.dataset.c; world.select(selCountry); if (view === 'world') world.focus(selCountry, 11); renderTab(); }
  else if (t.dataset.d) { const err = Sim.dipAct(S, selCountry, t.dataset.d); if (err) { toast(err, 'warn'); Sound.bad(); } else { Sound.coin(); world.setDiplomacy(S.dip); } updateAll(); }
  else if (t.dataset.p) { Sound.click(); S.policies[t.dataset.p] = !S.policies[t.dataset.p]; Sim.addLog(S, `📜 Kebijakan "${POLICIES.find(p => p.k === t.dataset.p).name}" ${S.policies[t.dataset.p] ? 'diberlakukan' : 'dicabut'}.`, 'info'); renderTab(); }
  else if (t.dataset.a === 'repay') { const p = Sim.repayDebt(S); if (p > 0) { Sound.coin(); toast(`Utang dicicil ${Sim.money(p)}`, 'good'); } else toast('Kas tidak cukup untuk mencicil', 'warn'); updateAll(); }
  else if (t.dataset.a === 'save') { Sim.save(S) ? toast('💾 Permainan disimpan', 'good') : toast('Gagal menyimpan', 'bad'); }
  else if (t.dataset.a === 'help') showHelp();
});
$('#tabbody').addEventListener('input', e => {
  const k = e.target.dataset.sl; if (!k) return; const v = +e.target.value;
  if (k === 'tax') { S.tax = v; $('#taxv').textContent = fmt(v, 1) + '%'; } else { S.spend[k] = v; $('#sv_' + k).textContent = v + '%'; }
});
$('#plotcard').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t || !selPlot || selPlot === 'palace') return; const [i, j] = selPlot.split(',').map(Number), p = Sim.plotAt(S, i, j);
  if (t.dataset.pb) doBuild(i, j, t.dataset.pb);
  else if (t.dataset.a === 'upg') { const err = Sim.upgrade(S, p); if (err) { toast(err, 'warn'); Sound.bad(); } else { Sound.build(); nation.sync(S); updateAll(); } }
  else if (t.dataset.a === 'dem') { showModal({ icon: '🧨', title: 'Bongkar bangunan?', text: 'Anda hanya mendapat sebagian kecil biaya kembali.', buttons: [{ label: 'Bongkar', cls: 'btn red', fn: () => { Sim.demolish(S, p); nation.sync(S); nation.burst(nation.slots.get(selPlot).pad.position.x, 1, nation.slots.get(selPlot).pad.position.z); Sound.bad(); updateAll(); } }, { label: 'Batal', cls: 'btn' }] }); }
});
$('#spd').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { Sound.click(); speed = +b.dataset.s; syncSpeed(); } });
$('#views').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sound.click(); if (b.dataset.v) { if (b.dataset.v !== view) setView(b.dataset.v); } else if (b.id === 'menuBtn') showMenu(); });
function doBuild(i, j, type) {
  const err = Sim.build(S, i, j, type);
  if (err) { toast(err, 'warn'); Sound.bad(); return; }
  Sound.build(); nation.sync(S); updateAll(); toast(`🏗️ ${BUILDINGS[type].name} mulai dibangun`, 'good');
}
function showHelp() {
  showModal({
    icon: '📖', title: 'Cara Bermain',
    html: `<div style="font-size:13px;line-height:1.7;color:#c7d4f0;margin-bottom:12px">
    <b>Tujuan:</b> menangkan pemilu 2× (10 tahun) dengan membuat negara maju, sejahtera & bersih.<br>
    • <b>Anggaran</b>: atur pajak & belanja tiap sektor. Defisit menambah utang.<br>
    • <b>Bangun</b>: klik plot di kota 3D. Sekolah, RS, pabrik, energi, pelabuhan, bandara, dsb.<br>
    • <b>Listrik</b>: pabrik & teknologi butuh daya. Pemadaman = kemarahan rakyat. PLTU murah tapi kotor.<br>
    • <b>Diplomasi</b>: bangun hubungan dagang & aliansi; jaga hubungan agar tak diserang.<br>
    • <b>Kebijakan</b>: aktifkan program nasional jangka panjang.<br>
    • <b>Event</b>: bencana & peluang muncul acak — keputusan Anda menentukan.<br>
    • Kalah bila kepuasan di bawah 14% terlalu lama, utang >320% PDB, atau kalah pemilu.<br><br>
    <span class="kbd">Spasi</span> jeda • <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> kecepatan • <span class="kbd">M</span> globe • <span class="kbd">Esc</span> batal</div>`,
    buttons: [{ label: 'Mengerti', cls: 'btn pri' }],
  });
}
function showMenu() {
  showModal({
    icon: '⚙️', title: 'Menu',
    buttons: [
      { label: '💾 Simpan', cls: 'btn', fn: () => { Sim.save(S); toast('💾 Disimpan', 'good'); } },
      { label: Sound.muted ? '🔊 Suara ON' : '🔇 Suara OFF', cls: 'btn', fn: () => { Sound.mute(!Sound.muted); } },
      { label: '❓ Bantuan', cls: 'btn', fn: () => setTimeout(showHelp, 50) },
      { label: '🏠 Menu Utama', cls: 'btn red', fn: () => { Sim.save(S); location.reload(); } },
      { label: 'Tutup', cls: 'btn' },
    ],
  });
}

// ---------- hook simulasi ----------
const hooks = {
  get busy() { return modalOpen; },
  onLog(text, kind) {
    const t = $('#tick'); t.style.opacity = 0; setTimeout(() => { t.textContent = text; t.style.opacity = 1; }, 150);
    if (kind === 'bad' || kind === 'warn' || kind === 'good') toast(text, kind);
  },
  onBuilt() { Sound.done(); },
  onEvent(ev) {
    Sound.alert(); const sc = Sim.scale(S);
    if (['banjir', 'badai'].includes(ev.id)) nation.setRain(true); else if (ev.id !== 'konflik') nation.setRain(false);
    showModal({
      icon: ev.icon, title: ev.title, text: ev.text(S),
      choices: ev.choices.map((c, idx) => {
        const cost = (c.cost || 0) * sc;
        return { label: c.label, hint: c.hint, costTxt: cost > 0 ? `Biaya ${Sim.money(cost)}` : cost < 0 ? `Pemasukan ${Sim.money(-cost)}` : '', fn: () => { const msg = Sim.resolveEvent(S, ev, idx); toast(msg, 'info'); updateAll(); } };
      }),
    });
  },
  onElection(vote) {
    nation.fireworks(); Sound.win();
    showModal({ icon: '🗳️', title: 'Pemilu: Anda Menang!', text: `Presiden ${S.president} meraih <b>${vote.toFixed(1)}%</b> suara dan terpilih untuk periode kedua. Rakyat memberi mandat baru!`, buttons: [{ label: '🎉 Lanjutkan Memimpin', cls: 'btn pri', fn: () => Sim.save(S) }] });
  },
  onEnd(reason, vote) { endGame(reason, vote); },
};
function endGame(reason, vote) {
  speed = 0; syncSpeed(); const sc = Sim.score(S);
  const msg = {
    kudeta: ['🔥', 'Presiden Digulingkan!', 'Kepuasan rakyat runtuh terlalu lama. Massa menduduki istana dan parlemen memakzulkan Anda.'],
    bangkrut: ['💸', 'Negara Bangkrut!', 'Utang menggunung hingga negara gagal bayar. IMF mengambil alih kebijakan fiskal.'],
    pemilu: ['🗳️', 'Kalah Pemilu', `Anda hanya meraih ${vote ? vote.toFixed(1) : '?'}% suara. Rakyat memilih pemimpin baru.`],
    selesai: ['🏆', 'Masa Jabatan Selesai!', `Setelah 10 tahun, ${S.president} mengakhiri masa kepemimpinan dengan terhormat${vote ? ` (pemilu terakhir ${vote.toFixed(1)}%)` : ''}.`],
  }[reason];
  if (reason === 'selesai') { Sound.win(); nation.fireworks(); } else Sound.lose();
  Sim.saveBest(S, sc);
  showModal({
    icon: msg[0], title: msg[1], text: msg[2],
    html: `<div style="text-align:center;margin:8px 0 16px"><div class="grade">${sc.grade}</div><div style="font-weight:700">${sc.title}</div><div style="color:var(--gold);font-size:20px;font-weight:800;margin:6px 0">${sc.score} poin</div>
    <div style="font-size:12.5px;color:var(--dim);line-height:1.8">PDB $${fmt(S.gdp0)}M → <b style="color:var(--ink)">${Sim.money(S.gdp)}</b> • Penduduk ${fmt(S.pop0, 1)} → <b style="color:var(--ink)">${fmt(S.pop, 1)} jt</b><br>Kepuasan ${fmt(S.approval)}% • Korupsi ${fmt(S.corruption)} • Utang ${fmt(S.debt / S.gdp * 100)}% PDB<br>Proyek dibangun: ${S.stats.built} • Keputusan krisis: ${S.stats.events}</div></div>`,
    buttons: [
      ...(reason === 'selesai' ? [{ label: '♾️ Lanjut Mode Bebas', cls: 'btn pri', fn: () => { S.freeplay = true; S.over = null; speed = 1; syncSpeed(); } }] : []),
      { label: '🔁 Main Lagi', cls: 'btn gold', fn: () => { try { localStorage.removeItem('country7mit_save'); } catch (e) {} location.reload(); } },
    ],
  });
}

// ---------- update ----------
function updateAll() { if (!S) return; updateHud(); renderTab(); renderPlotCard(); nation.blackout = S.blackout; nation.pollution = S.pollution; nation.infra = S.idx.infra; nation.sync(S); }
function doTick() {
  Sim.tick(S, hooks); Sound.tick();
  if (S.month % 12 === 0 && !S.over) Sim.save(S);
  updateAll();
  if (S.month % 6 === 0) world.setDiplomacy(S.dip);
}

// ---------- input ----------
let pdown = null;
canvas.addEventListener('pointerdown', e => { pdown = { x: e.clientX, y: e.clientY, t: performance.now() }; dragging = false; Sound.unlock(); });
canvas.addEventListener('pointermove', e => {
  if (pdown && Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y) > 5) dragging = true;
  if (dragging || e.buttons) return;
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (view === 'nation') { const k = nation.ndcPick(ndc); nation.setHover(k); canvas.style.cursor = k ? 'pointer' : 'default'; }
  else { const k = world.pick(ndc); canvas.style.cursor = k ? 'pointer' : 'grab'; }
});
canvas.addEventListener('pointerup', e => {
  const moved = pdown && Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y) > 5; pdown = null; if (moved) return;
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (view === 'intro') { const k = world.pick(ndc); if (k) pickIntro(k); return; }
  if (view === 'world') { const k = world.pick(ndc); if (k && k !== S.cid) { Sound.click(); selCountry = k; world.select(k); tab = 'diplo'; tabRender(); } else if (k === S.cid) { setView('nation'); } return; }
  if (view === 'nation') {
    const k = nation.ndcPick(ndc);
    if (placing) { if (k && k !== 'palace') { const [i, j] = k.split(',').map(Number); const p = Sim.plotAt(S, i, j); if (p.b) { toast('Plot sudah terisi', 'warn'); return; } doBuild(i, j, placing); placing = null; hint(); renderTab(); } return; }
    Sound.click(); selPlot = k; nation.setSelected(k); renderPlotCard();
  }
});
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (!S || modalOpen) return;
  if (e.code === 'Space') { e.preventDefault(); speed = speed === 0 ? 1 : 0; syncSpeed(); }
  else if (e.key === '1') { speed = 1; syncSpeed(); } else if (e.key === '2') { speed = 2; syncSpeed(); } else if (e.key === '3') { speed = 4; syncSpeed(); }
  else if (e.key.toLowerCase() === 'm') setView(view === 'world' ? 'nation' : 'world');
  else if (e.key === 'Escape') { placing = null; selPlot = null; nation.setSelected(null); hint(); renderPlotCard(); renderTab(); }
});

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.08, (now - last) / 1000); last = now;
  if (S && speed > 0 && !modalOpen && !S.over) { acc += dt * speed; while (acc >= MONTH_SEC) { acc -= MONTH_SEC; doTick(); if (modalOpen || S.over) { acc = 0; break; } } $('#mbar i').style.width = (acc / MONTH_SEC * 100) + '%'; }
  if (S && view === 'nation') { nation.todSpeed = 1 / 110 * Math.max(0.4, speed || 0.4); }
  if (view === 'nation') { nation.update(dt); renderer.render(nation.scene, nation.camera); }
  else { world.update(dt, innerWidth, innerHeight); renderer.render(world.scene, world.camera); }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
buildIntro();
setTimeout(() => {
  $('#loading').style.opacity = 0; setTimeout(() => $('#loading').remove(), 900);
  $('#intro').classList.remove('hidden'); view = 'intro';
}, 900);
requestAnimationFrame(frame);
window.__game = { get S() { return S; }, Sim, nation, world, begin, setView, doTick, hooks };
