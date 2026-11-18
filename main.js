// Country Manager — boot, login, sinkronisasi real-time, peta, aksi
import { sb, S, SESSION, SB_URL, SB_KEY, $, $$, esc, ic, fmt, usd, cty, toast, modal, closeModal, api, act, lastPres, reclaimPresidency, refreshIcons, animateNumbers, ago, isPres, myCode, REGION_ID } from './core.js';
import { PAGES, hooks, showVote, tfPreview, tickClock, mapMetrics } from './pages.js';
import * as P from './pages.js';
import { Globe } from './globe.js';
import { Country3D, loadOutline } from './country3d.js';
import { AREAS } from './areas.js';
import { Region3D } from './region3d.js';
import { openDocs, renderDoc } from './docs.js';
import { openUNGA, closeUNGA } from './unga.js';
import { openWar3D, warCosts } from './war3d.js';
import { initI18n, setLang, syncLangFromAccount, LANGS, state as I18N } from './i18n.js';
import { showStart, stopStart, accountModal } from './start.js';

const app = $('#app');
initI18n((a, b) => api(a, b, { quiet: true }));
function openLang() { const cur = I18N.lang; modal({ title: 'Bahasa / Language', icon: 'languages', body: `<p class="sub" style="margin-bottom:10px">Pilihan bahasa berlaku untuk seluruh game dan disimpan di akun Anda.</p><div class="stack">${LANGS.map(([v, n, code, f]) => `<button class="btn ${v === cur ? 'pri' : ''}" data-act="langSet" data-v="${v}" style="justify-content:flex-start;gap:10px"><span style="font-size:20px">${f}</span><b>${esc(code)}</b> <span>${esc(n)}</span>${v === cur ? ic('check') : ''}</button>`).join('')}</div><p class="sub" style="margin-top:10px" data-notr>ENG · JVA (Jawa) · SDN (Sunda) diterjemahkan otomatis oleh Gemini dan disimpan agar cepat.</p>`, actions: [{ label: 'Tutup' }] }); }
const st = document.createElement('style'); st.textContent = '.osm-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(185deg) brightness(.82) contrast(.92) saturate(.6)}'; document.head.appendChild(st);

// ================= LOGIN =================
function showGate(msg) {
  document.title = 'Masuk — country.7mit';
  app.innerHTML = `<div class="gate"><div class="card box"><div class="logo"><span class="wordmark" style="font-size:30px">7</span></div><h1 class="wordmark">country<b>.7mit</b></h1>
  <p>Dunia bersama untuk semua pemain: jadi presiden atau warga, kelola ekonomi, dagang, politik, dan diplomasi. Anda harus masuk lebih dulu untuk bermain.</p>
  <button class="btn pri big" id="gLogin">${ic('log-in')} Masuk dengan Google</button>
  ${msg ? `<div class="banner" style="margin-top:16px">${ic('triangle-alert')}<div>${esc(msg)}</div></div>` : ''}
  <div style="margin-top:14px"><a class="sub" href="classic/">Mode klasik: game 3D satu pemain</a> · <a class="sub" href="#" data-act="lang">Bahasa / Language</a></div>
  <div class="sub" style="margin-top:12px">Login dikelola oleh server.7mit (Supabase Auth). Seluruh angka dan peristiwa adalah data permainan.</div></div></div>`;
  refreshIcons();
  $('#gLogin').onclick = async (e) => { const b = e.currentTarget; b.disabled = true; b.innerHTML = `${ic('loader-circle', 'spin')} Mengalihkan ke Google…`; refreshIcons();
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) { showGate('Gagal masuk: ' + error.message); } };
}

// ================= SHELL =================
const NAV_GROUPS = [['dash', 'map', 'land', 'leader', 'news'], ['inbox', 'policy', 'trade', 'treasury', 'politics', 'gov', 'struktur', 'jabatan', 'uu', 'pop', 'diplo', 'perang'], ['civic', 'social', 'publik', 'elections', 'report'], ['admin']];
function shell() {
  app.innerHTML = `<div class="shell"><aside class="side" id="side"><div class="brand"><div class="logo"><span class="wordmark" style="font-size:20px">7</span></div><span class="wordmark">country<b>.7mit</b></span></div>${NAV_GROUPS.map(g => g.filter(k => !PAGES[k].admin || S.me.admin).map(k => `<button class="nav" data-nav="${k}">${ic(PAGES[k].i)} <span>${PAGES[k].t}</span>${k === 'trade' || k === 'diplo' ? `<span class="dot hidden" data-pend></span>` : k === 'inbox' ? `<span class="dot hidden" data-rep></span>` : ''}</button>`).join('')).filter(Boolean).join('<div class="sep"></div>')}
   <div style="flex:1"></div><div class="sep"></div><button class="nav" data-act="openUN">${ic('globe')} <span>Sidang PBB</span></button><button class="nav" data-act="openCapital">${ic('building-2')} <span>Kota 3D</span></button><button class="nav" data-act="account">${ic('circle-user-round')} <span>Akun</span></button><button class="nav" data-act="toStart">${ic('house')} <span>Menu awal</span></button><button class="nav" data-act="help">${ic('circle-help')} <span>Bantuan</span></button><button class="nav" data-act="logout">${ic('log-out')} <span>Keluar</span></button></aside>
   <div class="main"><div class="top"><button class="iconbtn menuBtn" data-act="menu" aria-label="Menu">${ic('menu')}</button>
    <div class="search">${ic('search')}<input id="gSearch" type="search" placeholder="Cari negara atau teritori…" autocomplete="off"><div class="sres hidden" id="sRes"></div></div>
    <span class="chip" id="roleChip"></span><div class="grow"></div>
    <span class="chip" id="yearChip" title="Tahun simulasi ekonomi (bukan waktu nyata)">${ic('calendar')} Tahun sim. <b id="yr"></b></span>
    <span class="chip" id="realChip" title="Waktu nyata negara terpilih">${ic('clock')} <b id="realClock"></b></span>
    <button class="btn pri" id="advBtn" data-act="advanceAsk">${ic('fast-forward')} Majukan 1 tahun</button>
    <span class="chip" id="visChip" title="Pengunjung aktif">${ic('users-round')} <b id="vis">0</b></span>
    <span class="chip" id="connChip">${ic('wifi')} <span>…</span></span>
    <button class="iconbtn" data-act="lang" aria-label="Bahasa" title="Bahasa / Language">${ic('languages')}</button><div style="position:relative"><button class="iconbtn" id="bell" data-act="bell" aria-label="Notifikasi">${ic('bell')}<span class="badge hidden" id="bellN">0</span></button><div class="notif hidden" id="notifBox"></div></div>
    <button class="iconbtn" data-act="help" aria-label="Bantuan">${ic('circle-help')}</button></div>
   <div id="pg"></div></div></div>`;
  refreshIcons();
}
function updateChrome() {
  if (!$('#yr')) return; const me = S.me, c = cty(myCode());
  $('#yr').textContent = S.world.year;
  const role = me.president ? `${ic('crown')} Presiden <b>${esc(cty(me.president)?.name || me.president)}</b>` : me.citizenship ? `${ic('id-card')} Warga <b>${esc(cty(me.citizenship)?.name || me.citizenship)}</b>` : `${ic('eye')} Pengunjung — pilih negara & klaim atau jadi warga`;
  const rc = $('#roleChip'); if (rc.dataset.k !== role) { rc.dataset.k = role; rc.innerHTML = role; }
  $('#vis').textContent = S.visitors; $$('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === S.page));
  const rn = repCount(); $$('[data-rep]').forEach(d => { d.textContent = rn; d.classList.toggle('hidden', !rn); });
  $$('[data-pend]').forEach(d => { d.textContent = S.pending; d.classList.toggle('hidden', !S.pending); });
  const n = S.notifs.filter(x => !x.read).length; const bn = $('#bellN'); bn.textContent = n; bn.classList.toggle('hidden', !n);
  updateConn(); updateAdv(); tickTop();
  const canAdv = isPres() || S.me.admin || S.adv?.status === 'open'; $('#advBtn').classList.toggle('hidden', !canAdv);
}
function updateConn() { const ok = S.online && Date.now() - S.lastSync < 14000, el = $('#connChip'); if (!el) return; el.className = 'chip ' + (ok ? 'ok' : 'off'); const t = ok ? (S.rt ? 'Real-time' : 'Terhubung (5 dtk)') : 'Terputus'; if (el.dataset.k !== t) { el.dataset.k = t; el.innerHTML = `${ic(ok ? 'wifi' : 'wifi-off')} <span>${t}</span>`; refreshIcons(); } }
function updateAdv() { const b = $('#advBtn'); if (!b) return; const left = S.world.lastAdvance ? Math.ceil(((S.world.cooldownMs || 45000) - (Date.now() - new Date(S.world.lastAdvance).getTime())) / 1000) : 0; const voting = S.adv?.status === 'open'; b.disabled = S.world.paused || left > 0 || S.world.advancing || voting; b.title = voting ? 'Voting berjalan, ikut memilih' : S.world.paused ? 'Waktu dihentikan admin UN' : left > 0 ? `Jeda penggunaan ${left} detik` : 'Proses ekonomi, politik, diplomasi, dan pemilu'; const t = voting ? `Voting ${S.adv.yes}/${S.adv.total}` : S.world.advancing ? 'Memproses…' : S.world.paused ? 'Waktu dihentikan' : left > 0 ? `Jeda ${left} dtk` : 'Majukan 1 tahun'; if (b.dataset.k !== t) { b.dataset.k = t; b.innerHTML = `${ic(voting ? 'vote' : S.world.paused ? 'pause' : left > 0 ? 'hourglass' : 'fast-forward')} ${t}`; refreshIcons(); } }
function tickTop() { const c = cty(S.sel); const el = $('#realClock'); if (el && c) el.textContent = new Date(Date.now() + c.tz * 3600e3).toISOString().slice(11, 19) + ` (UTC${c.tz >= 0 ? '+' : ''}${c.tz})`; }

// ================= RENDER =================
export function render() {
  if (!$('#pg')) return; const Pg = PAGES[S.page] || PAGES.dash, y = window.scrollY;
  let html; try { html = Pg.r(); } catch (e) { console.error(e); html = `<div class="empty">${ic('circle-alert')}<div>Gagal menampilkan halaman: ${esc(e.message)}</div></div>`; }
  const ann = S.world.announcement ? `<div class="banner">${ic('megaphone')}<div><b>Pengumuman UN:</b> ${esc(S.world.announcement)}</div></div>` : '';
  $('#pg').innerHTML = `<div class="page">${S.page !== 'map' && S.page !== 'dash' ? `<div class="row wrap between"><h1 style="font-size:22px;display:flex;gap:10px;align-items:center">${ic(Pg.i)} ${Pg.t}</h1>${cty(S.sel) ? `<span class="tag a">${cty(S.sel).flag} ${esc(cty(S.sel).name)}</span>` : ''}</div>` : ''}${ann}${html}</div>`;
  refreshIcons(); animateNumbers($('#pg')); try { Pg.after?.(); } catch (e) { console.error(e); } tickClock(); window.scrollTo(0, y); document.title = `${Pg.t} — country.7mit`; updateChrome();
}
hooks.render = render;
export function go(p) { if (S.page === 'map' && p !== 'map') destroyMap(); if (S.page === 'land' && p !== 'land') destroyLand(); S.page = p; S.dirty = false; $('#side')?.classList.remove('open'); if (p === 'news') loadNews(); if (p === 'jabatan' || p === 'uu' || p === 'struktur') loadGov(true); if (p === 'map') loadElections(); render(); window.scrollTo(0, 0); }
hooks.go = go;
function softRender() { if (S.dirty || !$('#pg')) return; const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $('#pg').contains(a)) return; if (S.page === 'map') { updateMapStyle(); return; } if (S.page === 'land') return; render(); }

// ================= DATA =================
let lastDetail = '', lastMine = '';
async function loadSel(force) { if (!S.sel) return; try { const d = await api('get_country', { code: S.sel }, { quiet: true }); const j = JSON.stringify(d); if (j !== lastDetail || force) { lastDetail = j; S.D = d; softRender(); } } catch (e) { if (!S.D) S.D = null; } }
function repCount() { try { if (!S.M) return 0; const c = S.M.country; return P.citizenReports().filter(r => r.sev > 0 && !S.repDone?.has(P.repKey(c, r.id))).length; } catch (e) { return 0; } }
function checkReports() { const n = repCount(), key = S.world.year + ':' + (S.me?.president || ''); if (S.repKey !== key) { S.repKey = key; S.repN = 0; } if (n > (S.repN || 0)) { pushNotif({ id: 'rep' + key + n, icon: 'inbox', title: `${n} laporan rakyat menunggu keputusan Anda`, body: 'Buka menu Laporan Rakyat' }); if (S.repN !== undefined && S.repSeen) toast(`${n} laporan rakyat menunggu keputusan Anda`, 'warn'); } S.repN = n; S.repSeen = true; }
async function loadMine(force) { if (!S.me?.president) { S.M = null; lastMine = ''; return; } try { const d = await api('get_country', { code: S.me.president }, { quiet: true }); const j = JSON.stringify(d); if (j !== lastMine || force) { lastMine = j; S.M = d; checkReports(); softRender(); } } catch (e) {} }
async function loadElections() { try { const r = await api('elections', {}, { quiet: true }); const latest = new Map(); r.elections.forEach(e => { const o = latest.get(e.country); if (!o || e.year > o.year) latest.set(e.country, e); }); S.elections = [...latest.values()]; if (S.page === 'map') { updateMapStyle(); } } catch (e) {} }
async function loadNews(more) { const scope = S.filters.newsScope || 'all'; try { const r = await api('news', { country: scope === 'sel' ? S.sel : undefined, before: more && S.newsList?.length ? S.newsList[S.newsList.length - 1].id : undefined, limit: 40 }, { quiet: true }); S.newsList = more ? [...(S.newsList || []), ...r.news] : r.news; if (S.page === 'news') render(); } catch (e) { S.newsList = S.newsList || []; if (S.page === 'news') render(); } }
export async function reload() { await Promise.all([sync(true), loadSel(true), loadMine(true)]); }
hooks.reload = reload; hooks.loadSel = loadSel;
async function loadComments() { try { const r = await api('comments', { country: S.sel }, { quiet: true }); const j = JSON.stringify(r.comments); if (j !== S._cj) { S._cj = j; S.cmts = r.comments; if (S.page === 'social') softRender(); } } catch (e) {} }
hooks.loadComments = loadComments; hooks.loadMine = loadMine;
// ---- media sosial hidup: warga NPC memposting/membalas sendiri; polling ringan hanya saat halaman Sosial dibuka
// ---- Sosial (Publik): linimasa seluruh pemain
const PUBS = () => S.pub || (S.pub = { posts: [], trending: [], more: false, tag: '', mine: false, open: new Set(), cm: {}, loaded: false });
async function pubLoad(more) { const P = PUBS(); try { const r = await api('pub_feed', { before: more && P.posts.length ? P.posts[P.posts.length - 1].id : undefined, tag: P.tag || undefined, mine: P.mine || undefined }, { quiet: true }); const j = JSON.stringify(r); if (!more && P.loaded && j === P._j) return; P._j = j; P.loaded = true; P.posts = more ? [...P.posts, ...r.posts.filter(x => !P.posts.some(y => y.id === x.id))] : r.posts; if (!more && !P.tag && !P.mine) P.trending = r.trending; else if (!more && r.trending?.length) P.trending = r.trending; P.more = r.more; if (S.page === 'publik') softRender(); } catch (e) {} }
async function pubComments(id) { const P = PUBS(); try { const r = await api('pub_comments', { id }, { quiet: true }); P.cm[id] = r.comments; if (S.page === 'publik') softRender(); } catch (e) {} }
let pubTimer = null; hooks.pubStart = () => { PUBS(); if (!PUBS().loaded) pubLoad(); if (!pubTimer) pubTimer = setInterval(() => { if (S.page !== 'publik') { clearInterval(pubTimer); pubTimer = null; return; } if (document.hidden) return; pubLoad(); (S.pub.open || new Set()).forEach(id => pubComments(id)); }, 12000); };
let socTimer = null, socCode = null;
async function socOpen() { const code = S.sel; try { const r = await api('soc_open', { country: code }, { quiet: true }); if (code === S.sel) { S.soc = r; if (S.page === 'social') softRender(); } } catch (e) {} }
async function socTick() { if (S.page !== 'social' || !S.sel || document.hidden) return; try { const r = await api('soc_tick', { country: S.sel }, { quiet: true }); if (r && !r.skipped) { await loadSel(true); S._cj = null; await loadComments(); socOpen(); } } catch (e) {} }
hooks.socStart = () => { if (socCode !== S.sel) { socCode = S.sel; S.soc = null; socOpen(); } if (!socTimer) socTimer = setInterval(() => { if (S.page !== 'social') { clearInterval(socTimer); socTimer = null; socCode = null; return; } socTick(); }, 25000); };
let inboxLast = 0; async function socInbox() { if (!S.me || !(S.me.citizenship || S.me.president)) return; try { let after = inboxLast || +(localStorage.getItem('cm_inbox') || 0); const r = await api('soc_inbox', { after }, { quiet: true }); if (r.latest) { inboxLast = r.latest; try { localStorage.setItem('cm_inbox', String(r.latest)); } catch (e) {} } (r.items || []).slice(-4).forEach(i => { const t = i.reply ? `${i.author} membalas komentarmu` : `${i.author} menanggapi kamu`; pushNotif({ id: 'sc' + i.id, icon: 'message-circle', title: t, body: i.body, go: 'social' }); }); if (r.items?.length) toast(`${r.items.length} balasan baru di Sosial`, 'ok'); } catch (e) {} }
setInterval(() => { if (!document.hidden) socInbox(); }, 40000); setTimeout(socInbox, 8000);

const NPOP = { n: 0 };
function popNotif(n) { if (!S.popReady) return; let box = $('#npop'); if (!box) { box = document.createElement('div'); box.id = 'npop'; box.setAttribute('role', 'status'); document.body.appendChild(box); } while (box.children.length >= 3) box.firstElementChild.remove(); const el = document.createElement('div'); el.className = 'npop'; el.innerHTML = `<span class="npi">${ic(n.icon || 'bell')}</span><div class="grow" style="min-width:0"><b>${esc(n.title || 'Notifikasi')}</b>${n.body ? `<div class="sub">${esc(String(n.body).slice(0, 140))}</div>` : ''}</div><button class="npx" aria-label="Tutup">${ic('x')}</button>`; const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }; el.onclick = (e) => { if (!e.target.closest('.npx') && n.go && PAGES[n.go]) go(n.go); kill(); }; box.appendChild(el); refreshIcons(); setTimeout(kill, 7000); }
setTimeout(() => { S.popReady = true; }, 6000);
function pushNotif(n) { if (S.notifs.some(x => x.id === n.id)) return; S.notifs.unshift({ ...n, read: false, ts: n.ts || new Date().toISOString() }); S.notifs = S.notifs.slice(0, 60); popNotif(n); if ('Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification(n.title, { body: n.body || '' }); } catch (e) {} } }
let syncing = false, syncTimer = null;
export async function sync(force) {
  if (syncing && !force) return; syncing = true;
  try {
    const d = await api('sync', { since: S.since || undefined, newsSince: S.newsSince || 0 }, { quiet: true });
    S.online = true; S.lastSync = Date.now();
    const firstTime = !S.since;
    if (d.full) S.countries.clear(); d.countries.forEach(c => S.countries.set(c.code, c)); if (d.since) S.since = d.since;
    const prevPres = S.me?.president, prevAnn = S.world.announcement;
    const prevYear = S.world?.year; S.me = d.me; if (d.me?.president) { lastPres(d.me.president); wasAway = false; } S.world = d.world; S.visitors = d.visitors; handleAdv(d.adv); if (prevYear && d.world.year !== prevYear) pushNotif({ id: 'unga' + d.world.year, icon: 'globe', title: `Sidang Majelis Umum PBB ${d.world.year} dibuka`, body: 'Pemimpin negara dan menteri luar negeri diundang berpidato di markas PBB (menu Sidang PBB).' }); if (S.npcYear !== d.world.year && !d.world.advancing) { S.npcYear = d.world.year; npcThink(); }
    if (d.pending > S.pending && !firstTime) pushNotif({ id: 'pend' + Date.now(), icon: 'inbox', title: 'Penawaran masuk', body: `${d.pending} penawaran menunggu jawaban Anda` });
    S.pending = d.pending;
    if (d.world.announcement && d.world.announcement !== S.lastAnn) { if (S.lastAnn !== '' || !firstTime) pushNotif({ id: 'ann' + d.world.announcement, icon: 'megaphone', title: 'Pengumuman UN', body: d.world.announcement }); S.lastAnn = d.world.announcement; }
    if (prevPres && !d.me.president && !firstTime) { pushNotif({ id: 'lost' + Date.now(), icon: 'user-x', title: 'Kepresidenan berakhir', body: 'Anda tidak lagi menjabat (kalah pemilu, dilepas admin, atau sesi berakhir).' }); toast('Kepresidenan Anda berakhir', 'warn'); S.M = null; }
    for (const n of [...d.news].reverse()) { if (firstTime) break; const mine = myCode(); if (n.country === mine || n.kind === 'pengumuman' || (n.kind === 'dunia' && !n.country)) pushNotif({ id: 'n' + n.id, icon: 'newspaper', title: n.title, body: n.source, ts: n.ts }); }
    if (d.lastNews) S.newsSince = d.lastNews;
    if (!S.sel) S.sel = myCode() || (S.countries.has('ID') ? 'ID' : [...S.countries.keys()][0]);
    if (firstTime) { await Promise.all([loadSel(true), loadMine(true)]); }
    else if (prevPres !== d.me.president) { await loadMine(true); }
    updateChrome(); softRender();
  } catch (e) { S.online = false; updateConn(); } finally { syncing = false; }
}
// otak NPC adaptif: dipicu sekali per tahun simulasi (server menjamin hanya satu yang jalan)
async function npcThink() { const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${S.token}`, apikey: SB_KEY }; try { const r = await (await fetch(`${SB_URL}/functions/v1/cm-npc`, { method: 'POST', headers: hdr, body: '{}' })).json(); if (r?.data?.ok) queueSync(); } catch (e) {} try { const r = await (await fetch(`${SB_URL}/functions/v1/cm-gov`, { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'war_turn' }) })).json(); if (r?.data?.ok) queueSync(); } catch (e) {}  try { const r = await (await fetch(`${SB_URL}/functions/v1/cm-npcgov`, { method: 'POST', headers: hdr, body: '{}' })).json(); if (r?.data?.ok) { queueSync(); loadNews?.(); } } catch (e) {} }

function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(async () => { await sync(true); loadSel(); loadMine(); if (S.page === 'news') loadNews(); if (S.page === 'social') loadComments(); if (S.page === 'land') reloadBuilds(); if (S.page === 'jabatan' || S.page === 'uu' || S.page === 'struktur') loadGov(); }, 450); }

async function subscribeRealtime() {
  try { await sb.realtime.setAuth(); if (S.ch) await sb.removeChannel(S.ch); S.ch = sb.channel('cm-world', { config: { private: true, broadcast: { self: false } } }).on('broadcast', { event: 'change' }, queueSync).subscribe((s) => { S.rt = s === 'SUBSCRIBED'; updateConn(); }); } catch (e) { S.rt = false; }
}

// ================= PETA =================
let GL = null, rankC = new Map();
let LMAP = null, markers = new Map(), routes = [], ships = [], raf = 0;
function ramp(t) { const st = [[255, 227, 210], [243, 176, 74], [255, 107, 124], [160, 29, 45]], x = Math.max(0, Math.min(0.999, t)) * 3, i = Math.floor(x), f = x - i; const a = st[i], b = st[i + 1]; return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`; }
function metricVal(c) { if (S.metric === 'gdp') return Math.log10(c.gdp + 1); if (S.metric === 'growth') return c.growth; if (S.metric === 'infl') return Math.min(c.infl, 40); const e = S.elections.find(x => x.country === c.code); return e ? e.result.share : NaN; }
function destroyMap() { cancelAnimationFrame(raf); if (GL) { GL.dispose(); GL = null; } if (LMAP) { LMAP.remove(); LMAP = null; } markers.clear(); routes = []; ships = []; }
function computeRank() { const vals = [...S.countries.values()].map(metricVal).filter(Number.isFinite).sort((a, b) => a - b); rankC = new Map(); for (const c of S.countries.values()) { const v = metricVal(c); rankC.set(c.code, Number.isFinite(v) && vals.length ? vals.indexOf(v) / Math.max(1, vals.length - 1) : null); } }
const colorOf3 = (c) => { const t = rankC.get(c.code); return t == null ? '#334155' : ramp(t); };
function init3D(el) {
  el.innerHTML = ''; el.style.position = 'relative'; const tip = document.createElement('div'); tip.className = 'gtip hidden'; el.appendChild(tip); computeRank();
  try { GL = new Globe(el, { onPick: (c) => pick(c, true), onHover: (c, e) => { if (!c) { tip.classList.add('hidden'); return; } const x = cty(c), r = el.getBoundingClientRect(); tip.innerHTML = `${x.flag} <b>${esc(x.name)}</b><br><span class="sub">PDB ${usd(x.gdp)} · ${fmt(x.growth, 1)}% · ${esc(x.president)}</span>`; tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 200) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; tip.classList.remove('hidden'); }, colorOf: colorOf3, sizeOf: (c) => 0.032 + Math.log10(c.gdp + 1) * 0.03 }); GL.setSatellites(true); window.__gl = GL; }
  catch (e) { console.error(e); S.mapMode = '2d'; toast('WebGL tidak tersedia, memakai peta 2D', 'warn'); render(); return; }
  GL.setCountries([...S.countries.values()]); GL.setSelected(S.sel); GL.focus(S.sel, 15); drawRoutes();
}
function initMap() {
  destroyMap(); const el = $('#map'); if (el && S.mapMode !== '2d') { init3D(el); return; } if (!el || !window.L) { if (el) el.innerHTML = `<div class="empty">${ic('map-off')}<div>Pustaka peta gagal dimuat.</div></div>`; return; }
  LMAP = L.map(el, { worldCopyJump: true, minZoom: 2, maxZoom: 9, zoomControl: true, attributionControl: true }).setView([20, 10], 2);
  if (S.world.mapbox) L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${S.world.mapbox}`, { tileSize: 512, zoomOffset: -1, attribution: '© Mapbox © OpenStreetMap' }).addTo(LMAP);
  else { el.classList.add('osm-dark'); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(LMAP); }
  for (const c of S.countries.values()) { const m = L.circleMarker([c.lat, c.lng], { radius: 3 + Math.log10(c.gdp + 1) * 3.2, weight: 1, color: '#0b1218', fillOpacity: .85 }).addTo(LMAP); m.bindTooltip(`${c.flag} ${c.name}`); m.on('click', () => pick(c.code, true)); markers.set(c.code, m); }
  updateMapStyle(); drawRoutes(); if (cty(S.sel)) LMAP.setView([cty(S.sel).lat, cty(S.sel).lng], 3);
  setTimeout(() => LMAP && LMAP.invalidateSize(), 200); loopShips();
}
hooks.initMap = initMap;
let LAND = null, landToken = 0;
function destroyLand() { closeCity(); landToken++; if (LAND) { LAND.dispose(); LAND = null; } }
const LKINDS = [['rumah', 'house', 'Perumahan', 1.2], ['sekolah', 'school', 'Sekolah', 1.5], ['rs', 'hospital', 'Rumah Sakit', 2.2], ['pabrik', 'factory', 'Pabrik', 3], ['pertanian', 'wheat', 'Pertanian', 1], ['listrik', 'zap', 'Pembangkit', 3.5], ['pelabuhan', 'anchor', 'Pelabuhan', 5], ['bandara', 'plane', 'Bandara', 8], ['pasar', 'store', 'Pasar', .8], ['taman', 'trees', 'Taman', .5], ['teknologi', 'cpu', 'Pusat Teknologi', 4], ['kantor', 'landmark', 'Kantor Pemerintah', 1.8]];
const ROADK = [['tol', 'route', 'Jalan Tol', .05], ['raya', 'signpost', 'Jalan Raya', .025], ['jalan', 'road', 'Jalan Kota', .012], ['rel', 'train-front', 'Rel Kereta', .08]];
const isRoad = (k) => ROADK.some(x => x[0] === k);
const LLEVELS = [['adm1', 'Provinsi'], ['adm2', 'Kab/Kota'], ['adm3', 'Kecamatan'], ['zona', 'Zona']];
S.land = S.land || { mode: 'jelajah', road: 'raya', kind: 'rumah', level: 'adm1', pts: [], regs: {}, builds: [] };
const kmBetween = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b[0] - a[0]) * r, y = (b[1] - a[1]) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const roadKm = () => { let k = 0; const p = S.land.pts; for (let i = 1; i < p.length; i++) k += kmBetween(p[i - 1], p[i]); return k; };
const costScale = () => Math.max(.05, (S.M?.country?.gdp || 500) / 500);
function regNames(pt) { const o = {}, L = S.land; for (const [k] of LLEVELS) { const f = L.regs[k]; if (f) { const n = LAND?.regionAt(pt.lon, pt.lat, f); if (n) o[k] = n; } } return o; }
function landHud() {
  const el = $('#landHud'); if (!el) return; const L = S.land, mine = S.me?.president === S.sel, cs = costScale(), km = roadKm(), counts = {}; L.builds.forEach(b => counts[b.kind] = (counts[b.kind] || 0) + 1);
  const tabs = (items, cur, act, key) => `<div class="tabs">${items.map(([v, t, i]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${i ? ic(i) + ' ' : ''}${t}</button>`).join('')}</div>`;
  el.innerHTML = `<div class="grid g2"><div class="card"><h3>${ic('hammer')} ${mine ? 'Bangun di Wilayah' : 'Pembangunan'}</h3>
   ${mine ? `${tabs([['jelajah', 'Jelajah', 'mouse-pointer-2'], ['gedung', 'Kota 3D (bangun)', 'building-2'], ['jalan', 'Bangun jalan & rel', 'route']], L.mode, 'landSet')}<div class="sub" style="margin:10px 0 6px">Tingkat wilayah (garis batas pada peta)</div>${tabs(LLEVELS, L.level, 'landLevel')}` : `<div class="banner info">${ic('info')}<div>Hanya presiden negara ini yang dapat membangun. Anda dapat melihat semua proyek di peta.</div></div><div class="sub" style="margin-top:8px">Tingkat wilayah</div>${tabs(LLEVELS, L.level, 'landLevel')}`}
   <div class="item" style="margin-top:12px"><div class="sub">${ic('map-pin')} Wilayah</div><b id="landInfo">Arahkan kursor ke daratan…</b></div>
   ${mine && L.mode === 'gedung' ? `<div class="sub" style="margin:12px 0 6px">Pilih jenis bangunan lalu klik daratan di peta (biaya dalam miliar USD)</div><div class="bgrid">${LKINDS.map(([k, i, n, b]) => `<button class="${L.kind === k ? 'sel' : ''}" data-act="landKind" data-v="${k}">${ic(i)}<br>${n}<br><small>${usd(b * cs)}</small></button>`).join('')}</div>` : ''}
   ${mine && L.mode === 'jalan' ? `<div class="item" style="margin-top:12px"><b>Bangun jalur</b><div class="bgrid" style="margin:8px 0">${ROADK.map(([k, i, n, c]) => `<button class="${L.road === k ? 'sel' : ''}" data-act="roadKind" data-v="${k}">${ic(i)}<br>${n}<br><small>${usd(c * cs)}/km</small></button>`).join('')}</div><div class="sub">Klik titik-titik di peta untuk membuat rute. Titik: ${L.pts.length} · Panjang ±${fmt(km, 1)} km · Biaya ±${usd(ROADK.find(x => x[0] === L.road)[3] * km * cs)}</div><div class="row wrap" style="margin-top:8px"><button class="btn sm pri" data-act="roadDone" ${L.pts.length < 2 ? 'disabled' : ''}>${ic('check')} Selesai & bangun</button><button class="btn sm" data-act="roadUndo" ${L.pts.length ? '' : 'disabled'}>${ic('undo-2')} Hapus titik</button><button class="btn sm red" data-act="roadCancel">${ic('x')} Batal</button></div></div>` : ''}
  </div><div class="card"><h3>${ic('list')} Proyek ${esc(cty(S.sel)?.name || '')} (${L.builds.length})</h3>${L.builds.length ? `<div class="scroll" style="max-height:300px"><div class="stack">${[...L.builds].reverse().slice(0, 60).map(b => { const k = LKINDS.find(x => x[0] === b.kind); const rd = ROADK.find(x => x[0] === b.kind); return `<div class="item row between wrap"><div>${ic(rd ? rd[1] : (k?.[1] || 'building'))} <b>${rd ? `${rd[2]} ${b.km} km` : esc(k?.[2] || b.kind)}</b><div class="sub">${esc(Object.values(b.region || {}).reverse().join(', ') || 'Wilayah tak tercatat')} · ${usd(+b.cost)} · tahun ${b.year}</div></div>${mine ? `<button class="btn sm red" data-act="buildDel" data-id="${b.id}">${ic('trash-2')}</button>` : ''}</div>`; }).join('')}</div></div>` : `<div class="empty">${ic('hammer')}<div>Belum ada proyek.${mine ? ' Mulai bangun jalan atau gedung!' : ''}</div></div>`}</div></div>`;
  refreshIcons();
}
async function reloadBuilds(first) { if (S.page !== 'land' && !CITY) return; try { const r = await api('builds', { country: S.sel }, { quiet: true }); S.land.builds = r.builds; LAND?.setBuilds(r.builds, !!first); landHud(); refreshCity(); } catch (e) {} }
async function loadRegions(level) {
  const L = S.land; if (!LAND) return; if (L.regs[level]) { LAND.setRegions(L.regs[level]); return; }
  if (level === 'zona') { L.regs.zona = LAND.gridRegions(); LAND.setRegions(L.regs.zona); return; }
  const c = cty(S.sel), cca3 = (AREAS[c.code]?.[0] || '').toUpperCase(), lv = level.toUpperCase(), token = landToken;
  try {
    const meta = await (await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${cca3}/${lv}/`)).json(); const url = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL; const rawUrl = url.replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(.+)$/, 'https://raw.githubusercontent.com/$1/$2/$3'); let txt = await (await fetch(rawUrl)).text();
    if (txt.startsWith('version https://git-lfs')) { const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/raw\/([^/]+)\/(.+)$/); if (m) txt = await (await fetch(`https://media.githubusercontent.com/media/${m[1]}/${m[2]}/${m[3]}/${m[4]}`)).text(); }
    if (token !== landToken) return; const gj = JSON.parse(txt), shift = LAND.outline.shifted, feats = [];
    for (const f of gj.features) { const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; const rings = polys.map(p => { let r = p[0]; const step = Math.max(1, Math.floor(r.length / 400)); r = r.filter((_, i) => i % step === 0); return shift ? r.map(q => [q[0] < 0 ? q[0] + 360 : q[0], q[1]]) : r; }); let bb = [1e9, 1e9, -1e9, -1e9]; rings.forEach(r => r.forEach(q => { bb = [Math.min(bb[0], q[0]), Math.min(bb[1], q[1]), Math.max(bb[2], q[0]), Math.max(bb[3], q[1])]; })); feats.push({ name: f.properties.shapeName || f.properties.name || 'Wilayah', bb, rings }); }
    if (!feats.length) throw new Error('kosong'); L.regs[level] = feats; LAND.setRegions(feats);
  } catch (e) { L.level = 'zona'; await loadRegions('zona'); landHud(); }
}
// ---- nama wilayah asli (Nominatim / OpenStreetMap), di-cache dan dibatasi 1 permintaan/detik ----
const geoCache = new Map(); let geoChain = Promise.resolve(), geoLast = 0;
function geoName(lat, lon) {
  const key = lat.toFixed(2) + ',' + lon.toFixed(2); if (geoCache.has(key)) return Promise.resolve(geoCache.get(key));
  const job = geoChain.then(async () => { if (geoCache.has(key)) return geoCache.get(key); const w = 1100 - (Date.now() - geoLast); if (w > 0) await new Promise(r => setTimeout(r, w)); geoLast = Date.now(); let o = {};
    try { const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&accept-language=id&lat=${lat}&lon=${lon}`)).json(), a = j.address || {};
      const a1 = a.state || a.province || a.region || a.state_district || a.island || '', a2 = a.county || a.city || a.municipality || a.regency || a.town || a.state_district || '', a3 = a.city_district || a.suburb || a.village || a.hamlet || a.town || a.neighbourhood || '';
      if (a1) o.adm1 = a1; if (a2 && a2 !== a1) o.adm2 = a2; if (a3 && a3 !== a2 && a3 !== a1) o.adm3 = a3; if (!o.adm1 && a.country) o.adm1 = a.country; } catch (e) {}
    if (Object.keys(o).length) geoCache.set(key, o); return o; });
  geoChain = job.catch(() => {}); return job;
}
const nameLabel = (n) => [n.adm3, n.adm2, n.adm1, n.zona].filter(Boolean).join(', ');
async function namesAt(pt) { const g = await geoName(pt.lat, pt.lon), z = regNames(pt); return Object.keys(g).length ? g : (z.zona ? { zona: z.zona } : z); }
let hoverTok = 0; function hoverName(pt) { const my = ++hoverTok, el = $('#landInfo'); setTimeout(async () => { if (my !== hoverTok) return; const n = await namesAt(pt); const e = $('#landInfo'); if (my === hoverTok && e) e.textContent = nameLabel(n) || 'Wilayah belum dikenali'; }, 450); }

// ---- Kota 3D (tampilan bangun ala /classic) ----
let CITY = null, CITYCTX = null;
const cityBuilds = () => S.land.builds.filter(b => b.region?.c === CITYCTX?.c);
function closeCity() { if (CITY) { CITY.dispose(); CITY = null; } CITYCTX = null; $('#cityov')?.remove(); }
function cityStats() { const el = $('#cityStats'), c = cty(S.sel), d = (S.me?.president === S.sel ? S.M?.country : S.D?.country) || {}; if (!el || !c) return; const t = d.treasury ?? c.treasury, ap = d.gov?.approval ?? c.approval; el.innerHTML = `<span>${c.flag} ${esc(c.name)}</span>${t !== undefined ? `<span>${ic('landmark')} ${usd(t)}</span>` : ''}<span>${ic('trending-up')} ${usd(c.gdp)}</span><span>${ic('users')} ${fmt(c.pop)}</span>${ap !== undefined ? `<span>${ic('smile')} ${fmt(ap, 0)}%</span>` : ''}<span>${ic('calendar')} ${S.world.year}</span>`; refreshIcons(); }
function refreshCity() { if (!CITY) return; cityStats(); const bs = cityBuilds(); CITY.setPlots(bs.filter(b => !b.path)); CITY.setRoads(bs.filter(b => b.path)); cityHud(); }
function cityHud() {
  const el = $('#cityHud'); if (!el || !CITYCTX) return; const L = S.land, mine = S.me?.president === S.sel, cs = costScale(), cx = CITYCTX, n = cx.pts.length; let km = 0; for (let i = 1; i < n; i++) km += Math.hypot(cx.pts[i][0] - cx.pts[i - 1][0], cx.pts[i][1] - cx.pts[i - 1][1]) * 0.5;
  el.innerHTML = mine ? `<div class="tabs"><button class="${cx.mode === 'plot' ? 'on' : ''}" data-act="cityMode" data-v="plot">${ic('building-2')} Bangun gedung</button><button class="${cx.mode === 'road' ? 'on' : ''}" data-act="cityMode" data-v="road">${ic('route')} Jalan & rel</button></div>
   ${cx.mode === 'plot' ? `<div class="sub" style="margin:8px 0 4px">Pilih jenis lalu klik petak kosong (klik petak terisi untuk membongkar)</div><div class="bgrid">${LKINDS.map(([k, i, nm, b]) => `<button class="${L.kind === k ? 'sel' : ''}" data-act="landKind" data-v="${k}">${ic(i)}<br>${nm}<br><small>${usd(b * cs)}</small></button>`).join('')}</div>`
    : `<div class="bgrid" style="margin:8px 0">${ROADK.map(([k, i, nm, c]) => `<button class="${L.road === k ? 'sel' : ''}" data-act="roadKind" data-v="${k}">${ic(i)}<br>${nm}<br><small>${usd(c * cs)}/km</small></button>`).join('')}</div><div class="sub">Klik persimpangan untuk membuat jalur. Titik: ${n} · ±${fmt(km, 2)} km · Biaya ±${usd(ROADK.find(x => x[0] === L.road)[3] * km * cs)}</div><div class="row wrap" style="margin-top:8px"><button class="btn sm pri" data-act="cityRoadDone" ${n < 2 ? 'disabled' : ''}>${ic('check')} Bangun jalur</button><button class="btn sm" data-act="cityRoadUndo" ${n ? '' : 'disabled'}>${ic('undo-2')} Hapus titik</button></div>`}`
   : `<div class="banner info">${ic('info')}<div>Anda melihat kota ini. Hanya presiden negara ini yang dapat membangun.</div></div>`;
  refreshIcons();
}
async function openCity(pt) {
  closeCity(); const names = await namesAt(pt), q = 0.03, lat = Math.round(pt.lat / q) * q, lng = Math.round(pt.lon / q) * q, c = `${Math.round(pt.lat / q)},${Math.round(pt.lon / q)}`;
  CITYCTX = { lat: +lat.toFixed(4), lng: +lng.toFixed(4), c, names, mode: 'plot', pts: [] };
  const ov = document.createElement('div'); ov.id = 'cityov'; ov.className = 'cityov'; ov.innerHTML = `<div class="cityhd"><b>${ic('building-2')} Kota 3D — ${esc(nameLabel(names) || 'Wilayah')}</b><span class="citystats" id="cityStats"></span><div class="grow"></div><div class="tabs citytime">${[['real', 'clock', 'Jam nyata'], ['day', 'sun', 'Siang'], ['night', 'moon', 'Malam']].map(([v, i, t]) => `<button class="${(S.cityTime || 'real') === v ? 'on' : ''}" data-act="cityTime" data-v="${v}" title="${t}">${ic(i)}</button>`).join('')}</div><button class="btn sm" data-act="cityClose">${ic('x')} Tutup</button></div><div id="cityGL" class="citygl"></div><div id="cityHud" class="cityhud"></div>`; document.body.appendChild(ov);
  try { CITY = new Region3D($('#cityGL'), { lat: CITYCTX.lat, lng: CITYCTX.lng, tz: cty(S.sel)?.tz || 0, timeMode: S.cityTime || 'real', onPlot: cityPlot, onNode: (x, z) => { CITYCTX.pts.push([x, z]); CITY.setPreview(CITYCTX.pts, S.land.road); cityHud(); } }); } catch (e) { toast('WebGL tidak tersedia untuk Kota 3D', 'warn'); closeCity(); return; }
  refreshCity();
}
function cityRegion(i, j) { return { ...CITYCTX.names, c: CITYCTX.c, ...(i === undefined ? {} : { plot: i + ',' + j }) }; }
function cityPlot(i, j) {
  const mine = S.me?.president === S.sel, L = S.land; if (!mine) { toast('Hanya presiden negara ini yang dapat membangun', 'warn'); return; }
  const ex = cityBuilds().find(b => b.region?.plot === i + ',' + j && !b.path);
  if (ex) { const k = LKINDS.find(x => x[0] === ex.kind); modal({ title: `${k?.[2] || ex.kind} di petak ${i + 1},${j + 1}`, icon: k?.[1] || 'building', body: `<p>Dibangun tahun ${ex.year}. Membongkar mengembalikan 40% biaya (${usd(+ex.cost * .4)}).</p>`, actions: [{ label: 'Bongkar', icon: 'trash-2', cls: 'red', fn: () => act(null, 'build_remove', { id: ex.id }, 'Bangunan dibongkar', async () => { await Promise.all([reloadBuilds(), loadMine(true), sync(true)]); }) }, { label: 'Batal' }] }); return; }
  const k = LKINDS.find(x => x[0] === L.kind), cost = k[3] * costScale(), [la, lo] = CITY.toLL(i + .5, j + .5);
  modal({ title: `Bangun ${k[2]}?`, icon: k[1], body: `<p>Lokasi: <b>${esc(nameLabel(CITYCTX.names))}</b>, petak ${i + 1},${j + 1}</p><div class="item">Biaya <b>${usd(cost)}</b> dari kas ${usd(S.M?.country?.treasury || 0)}.</div>`, actions: [{ label: 'Bangun', icon: 'hammer', cls: 'pri', fn: () => act(null, 'build_place', { kind: L.kind, lat: la, lng: lo, region: cityRegion(i, j) }, (r) => `${k[2]} dibangun (${usd(r.cost)})`, async () => { await Promise.all([reloadBuilds(), loadMine(true), sync(true)]); }) }, { label: 'Batal' }] });
}
function landClick(pt) {
  const L = S.land, mine = S.me?.president === S.sel;
  if (L.mode === 'jalan' && mine) { L.pts.push([+pt.lat.toFixed(4), +pt.lon.toFixed(4)]); LAND.setPreview(L.pts); landHud(); return; }
  const el = $('#landInfo'); if (el) el.textContent = 'Memuat nama wilayah…'; openCity(pt).then(() => { const e = $('#landInfo'); if (e && CITYCTX) e.textContent = nameLabel(CITYCTX.names); });
}
hooks.initLand = async () => {
  destroyLand(); const my = ++landToken, el = $('#land'), c = cty(S.sel); if (!el || !c) return; const msg = $('#landMsg');
  try {
    const outline = await loadOutline(c.code); if (my !== landToken) return;
    LAND = new Country3D(el, { code: c.code, name: c.name, lat: c.lat, lng: c.lng, outline, mode: S.landMode || '3d', mapbox: S.world.mapbox, onStatus: (t) => { if (msg) { msg.innerHTML = t ? `${ic('loader-circle', 'spin')} ${t}` : ''; msg.style.display = t ? '' : 'none'; refreshIcons(); } } }); LAND.pop = c.pop; S.land.pts = []; S.land.builds = []; S.land.regs = {}; LAND.onClick = landClick; LAND.onHover = (pt, e) => { const el = $('#landInfo'); if (!el) return; if (!pt) { hoverTok++; el.textContent = 'Arahkan kursor ke daratan…'; return; } hoverName(pt); }; landHud(); loadRegions(S.land.level); reloadBuilds(true);
    const sc = $('#landScale'); if (sc) sc.innerHTML = `${ic('ruler')} Bentang ±${fmt(LAND.widthKm)} × ${fmt(LAND.heightKm)} km · 1 satuan = 100 km`; refreshIcons(); if (msg && (S.landMode || '3d') === '3d') msg.style.display = 'none';
  } catch (e) { if (msg) msg.innerHTML = `${ic('circle-alert')} ${esc(e.message || 'Gagal memuat wilayah')}`; refreshIcons(); }
};
function updateMapStyle() {
  if (GL) { computeRank(); GL.refresh(); GL.setSelected(S.sel); drawRoutes(); return; }
  if (!LMAP) return; const vals = [...S.countries.values()].map(metricVal).filter(Number.isFinite).sort((a, b) => a - b);
  for (const [code, m] of markers) { const c = cty(code); if (!c) continue; const v = metricVal(c); const t = Number.isFinite(v) && vals.length ? vals.indexOf(v) / Math.max(1, vals.length - 1) : null; m.setStyle({ fillColor: t == null ? '#334155' : ramp(t), weight: code === S.sel ? 3 : 1, color: code === S.sel ? '#fff' : '#0b1218' }); if (code === S.sel) m.bringToFront(); }
  drawRoutes();
}
function drawRoutes() {
  if (GL) { const seen = new Set(), wp = []; for (const c of S.countries.values()) for (const w of (c.war || [])) { const k = [c.code, w].sort().join('|'), o = S.countries.get(w); if (!o || seen.has(k)) continue; seen.add(k); wp.push({ a: [c.lat, c.lng], b: [o.lat, o.lng] }); } GL.setWars(wp); const tr = (S.D?.trades || []).filter(o => o.kind === 'trade' && o.status === 'active'); GL.setRoutes(tr.map(o => ({ from: [cty(o.from_c)?.lat, cty(o.from_c)?.lng], to: [cty(o.to_c)?.lat, cty(o.to_c)?.lng] })).filter(r => r.from[0] != null && r.to[0] != null)); return; }
  if (!LMAP) return; routes.forEach(r => LMAP.removeLayer(r)); ships.forEach(s => LMAP.removeLayer(s.m)); routes = []; ships = [];
  const src = cty(S.sel); const tr = (S.D?.trades || []).filter(o => o.kind === 'trade' && o.status === 'active'); if (!src) return;
  for (const o of tr) { const a = cty(o.from_c), b = cty(o.to_c); if (!a || !b) continue; const mid = [(a.lat + b.lat) / 2 + Math.abs(a.lng - b.lng) * 0.08, (a.lng + b.lng) / 2]; const pts = []; for (let t = 0; t <= 1; t += 0.05) pts.push(bez([a.lat, a.lng], mid, [b.lat, b.lng], t)); routes.push(L.polyline(pts, { color: '#fbbf24', weight: 1.5, opacity: .6, dashArray: '4 6' }).addTo(LMAP)); const m = L.marker(pts[0], { icon: L.divIcon({ className: '', html: '<div class="ship"></div>', iconSize: [10, 10] }), interactive: false }).addTo(LMAP); ships.push({ m, pts, t: Math.random(), sp: 0.04 + Math.random() * 0.03 }); }
}
const bez = (a, m, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * m[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * m[1] + t * t * b[1]];
let lastT = 0;
function loopShips(t = 0) { raf = requestAnimationFrame(loopShips); if (!LMAP) return; const dt = Math.min(0.1, (t - lastT) / 1000 || 0); lastT = t; for (const s of ships) { s.t = (s.t + dt * s.sp) % 1; const i = Math.floor(s.t * (s.pts.length - 1)), f = s.t * (s.pts.length - 1) - i, a = s.pts[i], b = s.pts[Math.min(i + 1, s.pts.length - 1)]; s.m.setLatLng([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); } }

export function pick(code, fromMap) {
  if (!S.countries.has(code)) return; S.sel = code; S.D = null; lastDetail = ''; S.dirty = false;
  if (S.page === 'leader' || S.page === 'dash' && !fromMap) { if (S.page === 'leader') S.page = 'dash'; }
  loadSel(true).then(() => { if (S.page === 'map') { drawRoutes(); } }); if (S.page === 'news') loadNews();
  if (S.page === 'map' && GL) { GL.setSelected(code); GL.focus(code, 14); }
  if (S.page === 'map' && LMAP) { const c = cty(code); LMAP.flyTo([c.lat, c.lng], Math.max(LMAP.getZoom(), 4), { duration: .8 }); updateMapStyle(); }
  render(); if (false) {}
}

// ================= ACTIONS =================
const val = (id) => $('#' + id)?.value;
const A = {
  landSet: (el) => { S.land.mode = el.dataset.v; S.land.pts = []; LAND?.setPreview([]); landHud(); },
  landLevel: (el) => { S.land.level = el.dataset.v; landHud(); loadRegions(S.land.level); },
  landKind: (el) => { S.land.kind = el.dataset.v; if (!CITY) S.land.mode = 'gedung'; landHud(); cityHud(); },
  roadKind: (el) => { S.land.road = el.dataset.v; landHud(); if (CITY) { CITY.setPreview(CITYCTX.pts, S.land.road); cityHud(); } },
  roadUndo: () => { S.land.pts.pop(); LAND?.setPreview(S.land.pts); landHud(); },
  roadCancel: () => { S.land.pts = []; LAND?.setPreview([]); S.land.mode = 'jelajah'; landHud(); },
  roadDone: (el) => act(el, 'road_place', { kind: S.land.road, points: S.land.pts, region: (() => { const f = S.land.pts[0]; return f ? regNames({ lat: f[0], lon: f[1] }) : {}; })() }, (r) => `${ROADK.find(x => x[0] === S.land.road)[2]} ${r.km} km dibangun (${usd(r.cost)})`, async () => { S.land.pts = []; LAND?.setPreview([]); await Promise.all([reloadBuilds(), loadMine(true), sync(true)]); }),
  buildDel: (el) => modal({ title: 'Bongkar proyek?', icon: 'trash-2', body: '<p>Anda hanya mendapat 40% biaya kembali.</p>', actions: [{ label: 'Bongkar', cls: 'red', fn: () => act(null, 'build_remove', { id: +el.dataset.id }, (r) => `Dibongkar, kas kembali ${usd(r.refund)}`, async () => { await Promise.all([reloadBuilds(), loadMine(true)]); }) }, { label: 'Batal' }] }),
  landMode: (el) => { S.landMode = el.dataset.v; if (LAND) { const m = $('#landMsg'); if (m) { m.style.display = ''; } LAND.setMode(S.landMode); setTimeout(() => { loadRegions(S.land.level); reloadBuilds(true); }, 600); $$('[data-act=landMode]').forEach(b => b.classList.toggle('on', b.dataset.v === S.landMode)); } else render(); },
  mapMode: (el) => { S.mapMode = el.dataset.v; destroyMap(); render(); },
  menu: () => $('#side').classList.toggle('open'),
  cityClose: () => closeCity(),
  cityTime: (el) => { S.cityTime = el.dataset.v; CITY?.setTimeMode(S.cityTime); if (CITY) CITY.envT = 9; $$('[data-act=cityTime]').forEach(b => b.classList.toggle('on', b.dataset.v === S.cityTime)); },
  openCapital: async () => { const c = cty(S.sel); if (!c) return; $('#side')?.classList.remove('open'); await openCity({ lat: c.lat, lon: c.lng }); reloadBuilds(); },
  cityMode: (el) => { if (!CITY) return; CITYCTX.mode = el.dataset.v; CITYCTX.pts = []; CITY.setMode(CITYCTX.mode === 'road' ? 'road' : 'plot'); CITY.setPreview([], S.land.road); cityHud(); },
  cityRoadUndo: () => { CITYCTX.pts.pop(); CITY.setPreview(CITYCTX.pts, S.land.road); cityHud(); },
  cityRoadDone: (el) => { const pts = CITYCTX.pts.map(([x, z]) => CITY.toLL(x, z)); act(el, 'road_place', { kind: S.land.road, points: pts, region: cityRegion() }, (r) => `Jalur ${r.km} km dibangun (${usd(r.cost)})`, async () => { CITYCTX.pts = []; CITY.setPreview([], S.land.road); await Promise.all([reloadBuilds(), loadMine(true), sync(true)]); }); },
  account: () => accountModal(startHooks),
  lang: () => openLang(),
  langSet: (el) => { setLang(el.dataset.v); closeModal(); toast(({ id: 'Bahasa: Indonesia', en: 'Language: English', jv: 'Basa: Jawa', su: 'Basa: Sunda' })[el.dataset.v], 'ok'); },
  toStart: () => startHooks.start(),
  logout: async () => { releaseBeacon(); await sb.auth.signOut(); location.reload(); },
  help: () => tutorial(0),
  pick: (el) => { const keep = S.page; pick(el.dataset.code); if (keep === 'leader' || keep === 'dash') go('dash'); },
  goDash: () => go('dash'),
  claimSel: (el) => act(el, 'claim', { code: S.sel }, () => `Anda kini Presiden ${cty(S.sel)?.name}`, async () => { await sync(true); await Promise.all([loadMine(true), loadSel(true)]); updateChrome(); render(); }),
  release: (el) => act(el, 'release', {}, 'Jabatan dilepas. NPC kembali memimpin.', async () => { S.M = null; await sync(true); await loadSel(true); render(); }),
  citizenSel: (el) => act(el, 'become_citizen', { code: S.sel }, `Anda kini warga ${cty(S.sel)?.name}`, async () => { await sync(true); await loadSel(true); render(); }),
  leaveCit: (el) => act(el, 'leave_citizenship', {}, 'Kewarganegaraan dilepas', async () => { await sync(true); render(); }),
  bell: () => { const b = $('#notifBox'); b.classList.toggle('hidden'); if (!b.classList.contains('hidden')) { renderNotifs(); S.notifs.forEach(n => n.read = true); updateChrome(); } },
  advanceAsk: () => S.adv?.status === 'open' ? advModal(true) : modal({ title: 'Ajukan voting majukan 1 tahun', icon: 'vote', body: `<p>Seluruh pemain yang sedang <b>online</b> (${S.visitors} orang) harus memilih. Jika <b>semua setuju</b>, tahun dunia langsung maju dari <b>${S.world.year}</b> ke <b>${S.world.year + 1}</b> dan semua negara diproses. Satu penolakan membatalkan voting. Voting berakhir dalam 60 detik. Bila hanya Anda yang online, tahun langsung maju.</p>`, actions: [{ label: 'Mulai voting', cls: 'pri', icon: 'check', fn: () => A.advStart() }, { label: 'Batal' }] }),
  advStart: async () => { const b = $('#advBtn'); const r = await act(b, 'advance_start', {}, (x) => x.advanced ? 'Seluruh pemain setuju — tahun dimajukan' : 'Voting dimulai. Menunggu semua pemain online.', async (x) => { await reload(); if (x.advanced) showReport(); else if (x.adv) handleAdv(x.adv, true); }); },
  advVote: (el) => act(null, 'advance_vote', { yes: el.dataset.y === '1' }, (x) => x.status === 'rejected' ? 'Anda menolak. Voting dibatalkan.' : x.advanced ? 'Semua setuju — tahun dimajukan' : 'Suara Anda tercatat', async (x) => { await sync(true); if (x.advanced) { await reload(); showReport(); } }),
  advOpen: () => advModal(true),
  advance: async () => { const b = $('#advBtn'); S.world.advancing = true; updateAdv(); const r = await act(b, 'advance_year', {}, (x) => `Tahun ${x.year} dimulai (paksa admin)`, async () => { await reload(); }); S.world.advancing = false; if (r) { showReport(); } updateChrome(); },
  repDo: async (el) => { const r = S._reps?.[+el.dataset.i], j = +el.dataset.j; if (!r) return; const c = S.M.country, key = P.repKey(c, r.id); S.repDone = S.repDone || new Set();
    if (j < 0) { S.repDone.add(key); checkReports(); render(); updateChrome(); return; }
    const o = r.opts[j]; const orig = el.innerHTML; el.disabled = true; el.innerHTML = `${ic('loader-circle', 'spin')} Memproses…`; refreshIcons();
    try { const res = await o.run(); S.repDone.add(key); await Promise.all([loadMine(true), sync(true)]); checkReports(); if (res?.vote) showVote(res.vote.passed ? 'Parlemen menyetujui' : 'Parlemen menolak', res.vote, res.note); else toast(res?.note || 'Keputusan dijalankan', 'ok'); render(); updateChrome(); }
    catch (e) { /* pesan galat sudah ditampilkan */ } finally { if (el.isConnected) { el.disabled = false; el.innerHTML = orig; refreshIcons(); } } },
  answerPetIn: (el) => A.answerPet(el),
  applyPolicy: (el) => { const patch = {}, c = P_M(); $$('[data-pol]').forEach(i => { const k = i.dataset.pol; if (+i.value !== c.pol[k]) patch[k] = +i.value; }); if (!Object.keys(patch).length) return toast('Tidak ada perubahan', 'warn'); act(el, 'set_policy', { policy: patch }, null, async (r) => { await loadMine(true); S.dirty = false; render(); if (r.vote) showVote(r.vote.passed ? 'Parlemen menyetujui' : 'Parlemen menolak', r.vote, r.note); else toast('Kebijakan diterapkan'); }); },
  resetPolicy: () => { S.dirty = false; render(); },
  proposeTrade: (el) => act(el, 'propose_trade', (() => { const c = P_M(), v = parseFloat(val('trVal')), usdB = val('trCur') === 'USD' ? v : v / c.fx; return { to: val('trTo'), sector: val('trSec'), value: usdB, tariffTo: +val('trT1'), tariffFrom: +val('trT2') }; })(), (r) => r.note || 'Penawaran dikirim', async () => { await loadMine(true); S.dirty = false; render(); }),
  respond: (el) => act(el, 'respond_offer', { id: +el.dataset.id, accept: el.dataset.accept === '1' }, el.dataset.accept === '1' ? 'Penawaran diterima' : 'Penawaran ditolak', async () => { await loadMine(true); await sync(true); render(); }),
  cancelTrade: (el) => modal({ title: 'Batalkan perdagangan?', icon: 'ban', body: '<p>Hubungan dengan negara mitra akan memburuk.</p>', actions: [{ label: 'Batalkan perjanjian', cls: 'red', fn: () => act(null, 'cancel_trade', { id: +el.dataset.id }, 'Perjanjian dibatalkan', async () => { await loadMine(true); render(); }) }, { label: 'Kembali' }] }),
  transfer: (el) => { const c = P_M(), a = parseFloat(val('tfAmt')); act(el, 'transfer', { to: val('tfTo'), amount: a, currency: val('tfCur'), note: val('tfNote') }, 'Transfer berhasil', async () => { await Promise.all([loadMine(true), sync(true)]); S.dirty = false; render(); }); },
  setParty: (el) => act(el, 'set_party', { party: val('partySel'), coalition: $$('[data-coal]:checked').map(i => i.dataset.coal) }, (r) => `Koalisi disimpan (${r.seats} kursi)`, async () => { await loadMine(true); S.dirty = false; render(); }),
  appoint: (el) => act(el, 'appoint', { ministry: el.dataset.m, index: +val('cab_' + el.dataset.m) }, 'Menteri ditunjuk', async () => { await loadMine(true); S.dirty = false; render(); }),
  motion: (el) => act(el, 'motion', { motion: el.dataset.m }, null, async (r) => { S.filters.lastVote = r.vote; await loadMine(true); S.dirty = false; render(); showVote(r.vote.passed ? 'Mosi disetujui' : 'Mosi ditolak', r.vote); }),
  ideology: (el) => act(el, 'set_ideology', { ideology: el.dataset.id }, 'Ideologi diganti', async () => { await loadMine(true); render(); }),
  investigate: (el) => act(el, 'investigate', {}, (r) => `Penyelidikan selesai: korupsi turun ${r.found} poin`, async () => { await loadMine(true); render(); }),
  propose: (el) => act(el, 'propose_law', { law: el.dataset.id }, null, async (r) => { await loadMine(true); render(); showVote(r.vote.passed ? 'RUU disahkan' : 'RUU ditolak', r.vote); }),
  repeal: (el) => act(el, 'repeal_law', { law: el.dataset.id }, null, async (r) => { await loadMine(true); render(); showVote(r.vote.passed ? 'UU dicabut' : 'Pencabutan ditolak', r.vote); }),
  applySoc: (el) => { const patch = {}; $$('[data-soc]').forEach(i => patch[i.dataset.soc] = +i.value); act(el, 'set_policy', { policy: patch }, 'Pengaturan kependudukan diterapkan', async () => { await loadMine(true); S.dirty = false; render(); }); },
  alliance: (el) => act(el, 'alliance', { alliance: el.dataset.id, join: el.dataset.join === '1' }, el.dataset.join === '1' ? 'Bergabung dengan aliansi' : 'Keluar dari aliansi', async () => { await loadMine(true); await sync(true); render(); }),
  setDefense: (el) => act(el, 'set_defense', { defense: +val('defRange') }, 'Anggaran pertahanan diterapkan', async () => { await loadMine(true); S.dirty = false; render(); }),
  bilateral: (el) => act(el, 'bilateral', { target: val('dpTo'), type: val('dpType') }, (r) => r.status === 'accepted' ? 'Kerja sama disepakati' : r.status === 'pending' ? 'Usulan dikirim' : 'Usulan ditolak', async () => { await loadMine(true); render(); }),
  war: (el) => modal({ title: 'Nyatakan perang?', icon: 'swords', body: `<p>Perang memotong PDB, kas, kesiapan, dan kepuasan rakyat, serta membatalkan perdagangan dengan ${esc(cty(val('dpTo'))?.name || '')}.</p>`, actions: [{ label: 'Nyatakan perang', cls: 'red', fn: () => act(null, 'declare_war', { target: val('dpTo') }, 'Perang dinyatakan', async () => { await loadMine(true); render(); }) }, { label: 'Batal' }] }),
  peace: (el) => act(el, 'propose_peace', { target: val('dpTo') }, (r) => r.note || 'Selesai', async () => { await loadMine(true); render(); }),
  civic: (el) => act(el, 'civic', { kind: el.dataset.k, country: S.sel }, 'Aksi warga dicatat', async () => { await loadSel(true); render(); }),
  petition: (el) => act(el, 'petition_create', { country: S.sel, title: val('ptTitle'), body: val('ptBody') }, 'Petisi diajukan', async () => { S.dirty = false; await loadSel(true); render(); }),
  support: (el) => act(el, 'petition_support', { id: +el.dataset.id }, 'Dukungan dicatat', async () => { await loadSel(true); render(); }),
  answerPet: (el) => modal({ title: 'Jawab petisi', icon: 'reply', body: '<div class="field"><label>Jawaban (maks 300 karakter)</label><textarea id="ansT" maxlength="300"></textarea></div>', actions: [{ label: 'Kirim jawaban', cls: 'pri', keep: true, fn: async (b) => { const r = await act(b, 'petition_answer', { id: +el.dataset.id, answer: val('ansT') }, 'Jawaban dikirim', async () => { closeModal(); await loadSel(true); render(); }); } }, { label: 'Batal' }] }),
  post: (el) => act(el, 'post_create', { country: S.sel, body: val('poBody'), type: S.me.president === S.sel ? 'pesan' : val('poType') }, 'Pesan dipublikasikan', async (r) => { S.dirty = false; await loadSel(true); render(); const id = r?.post?.id ?? r?.id; if (id) api('soc_post_react', { post_id: id }, { quiet: true }).then(async () => { await loadSel(true); await loadComments(); }).catch(() => {}); }),
  socFilter: (el) => { S.filters.soc = el.dataset.v; render(); },
  cmToggle: (el) => { S.openThreads = S.openThreads || new Set(); const id = +el.dataset.id; S.openThreads.has(id) ? S.openThreads.delete(id) : S.openThreads.add(id); S.dirty = false; render(); },
  cmSend: (el) => { const id = +el.dataset.id, inp = $('#cmi_' + id), rp = S.replyTo?.post === id ? S.replyTo.id : null; act(el, 'soc_comment', { post_id: id, body: inp?.value || '', reply_to: rp }, (r) => r.replies?.length ? `Komentar terkirim · ${r.replies.length} balasan` : 'Komentar terkirim', async () => { S.replyTo = null; S.dirty = false; S._cj = null; await loadComments(); render(); }); },
  cmReply: (el) => { S.replyTo = { id: +el.dataset.id, post: +el.dataset.post, name: el.dataset.name }; S.dirty = false; render(); setTimeout(() => { const i = $('#cmi_' + el.dataset.post); if (i) { i.focus(); if (!i.value) i.value = '@' + el.dataset.name + ' '; } }, 30); },
  pubTab: (el) => { const P = PUBS(); P.mine = el.dataset.v === 'mine'; P.tag = ''; P.loaded = false; P._j = ''; pubLoad(); },
  pubTag: (el) => { const P = PUBS(); P.tag = el.dataset.v; P.mine = false; P.loaded = false; P._j = ''; pubLoad(); },
  pubMore: () => pubLoad(true),
  pubPost: (el) => act(el, 'pub_post', { body: val('pbBody') }, 'Dibagikan ke seluruh pemain', async () => { S.dirty = false; const P = PUBS(); P.tag = ''; P.mine = false; P.loaded = false; await pubLoad(); render(); }),
  pubLike: async (el) => { const id = +el.dataset.id; try { const r = await api('pub_like', { id }, { quiet: true }); const p = PUBS().posts.find(x => x.id === id); if (p) { p.likes = r.likes; p.liked = r.liked; } softRender(); } catch (e) {} },
  pubToggle: (el) => { const P = PUBS(), id = +el.dataset.id; if (P.open.has(id)) P.open.delete(id); else { P.open.add(id); pubComments(id); } S.dirty = false; render(); },
  pubCmSend: (el) => { const id = +el.dataset.id, inp = $('#pcm_' + id); act(el, 'pub_comment', { id, body: inp?.value || '' }, 'Komentar terkirim', async (r) => { const p = PUBS().posts.find(x => x.id === id); if (p && r?.count !== undefined) p.comments = r.count; S.dirty = false; await pubComments(id); render(); }); },
  pubDel: (el) => act(el, 'pub_delete', { id: +el.dataset.id, kind: el.dataset.kind }, 'Dihapus', async () => { const P = PUBS(); if (el.dataset.kind === 'comment') await pubComments(+el.dataset.post); else { P.posts = P.posts.filter(x => x.id !== +el.dataset.id); } render(); }),
  openWar: async (el) => startWar(el.dataset.e, el.dataset.m === 'train'),
  openWarTrain: () => { S.filters.wrTo = val('wrTo'); startWar(val('wrTo'), true); },
  warAlloc: (el) => { const a = { darat: +val('al_darat'), udara: +val('al_udara'), art: +val('al_art'), intel: +val('al_intel') }; act(el, 'war_alloc', { a }, 'Alokasi Anggaran Keamanan disimpan', async () => { await loadWar(); render(); }); },
  warFund: () => modal({ title: 'Danai Anggaran Perang', icon: 'banknote', body: `<p>Pindahkan dana dari kas negara ke Anggaran Perang. Kas: <b>${S.W ? S.W.treasury : '?'}</b> miliar USD.</p><label class="sub">Jumlah (juta USD, 50–20.000)</label><input id="wfAmt" type="number" min="50" max="20000" step="50" value="1000" style="width:100%">`, actions: [{ label: 'Pindahkan', cls: 'pri', keep: true, fn: (b) => act(b, 'war_fund', { amount: +val('wfAmt') }, (r) => `Anggaran Perang kini ${r.fund} juta USD`, async () => { closeModal(); await Promise.all([loadWar(), loadMine(true)]); render(); }) }, { label: 'Batal' }] }),
  warMobilize: (el) => act(el, 'war_mobilize', {}, (r) => `Mobilisasi: kesiapan keamanan ${r.readiness}`, async () => { await Promise.all([loadWar(), loadMine(true)]); render(); }),

  govRetry: () => { S.Gerr = false; render(); loadGov(true); },
  cmReplyX: () => { S.replyTo = null; render(); },
  cmLike: async (el) => { const id = +el.dataset.id; try { const r = await api('soc_clike', { id }, { quiet: true }); S.clk = S.clk || new Set(); r.liked ? S.clk.add(id) : S.clk.delete(id); const c = (S.cmts || []).find(x => x.id === id); if (c) c.likes = r.likes; softRender(); } catch (e) {} },
  socProfile: async (el) => { try { const r = await api('soc_profile', { id: +el.dataset.id }, { quiet: true }), p = r.persona; modal({ title: p.name, icon: 'user-round', body: `<div class="row" style="gap:12px;margin-bottom:10px"><span class="av npcav" style="width:56px;height:56px;font-size:24px;background:hsl(${(() => { let h = 0; for (const ch of p.name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; })()} 45% 38%)">${esc(p.name.charAt(0))}</span><div><b style="font-size:17px">${esc(p.name)}</b> <span class="tag b">${ic('bot')} NPC</span><div class="sub" data-notr>@${esc(p.handle)}</div><div class="sub">${esc(p.job)} · sikap: ${esc(p.stance)}</div></div></div><p>${esc(p.bio)}</p>${p.style ? `<div class="sub">Gaya: ${esc(p.style)}</div>` : ''}<div class="row" style="gap:16px;margin:10px 0"><span><b>${fmt(p.followers)}</b> <span class="sub">pengikut</span></span><span><b>${r.posts.length}</b> <span class="sub">unggahan</span></span><span><b>${r.comments}</b> <span class="sub">komentar</span></span></div><div class="stack scroll" style="max-height:260px">${r.posts.map(x => `<div class="item"><p style="margin:0">${esc(x.body)}</p><div class="sub">${ic('heart')} ${x.likes} · ${ago(x.ts)}</div></div>`).join('') || '<div class="sub">Belum ada unggahan.</div>'}</div>`, actions: [{ label: 'Tutup' }] }); } catch (e) {} },
  cmDel: (el) => act(el, 'comment_delete', { id: +el.dataset.id }, 'Komentar dihapus', async () => { await loadComments(); render(); }),
  cmHide: (el) => act(el, 'comment_hide', { id: +el.dataset.id, hidden: true }, 'Komentar disembunyikan', async () => { await loadComments(); render(); }),
  like: async (el) => { try { const r = await api('post_like', { id: +el.dataset.id }); el.classList.toggle('on', r.liked); el.innerHTML = `${ic('heart')} ${r.likes}`; refreshIcons(); } catch (e) {} },
  vote: (el) => act(el, 'vote', { country: S.sel, choice: el.dataset.v }, 'Suara Anda tercatat', async () => { await loadSel(true); render(); }),
  newsScope: (el) => { S.filters.newsScope = el.dataset.v; S.newsList = null; render(); loadNews(); },
  moreNews: () => loadNews(true),
  // admin
  adIndicator: (el) => act(el, 'admin_set_indicator', { code: val('adC'), field: val('adF'), value: parseFloat(val('adV')) }, 'Indikator diubah', () => reload()),
  adCurrency: (el) => act(el, 'admin_currency', { code: val('cuC'), cur: val('cuCode'), sym: val('cuSym'), fx: parseFloat(val('cuFx')) }, 'Mata uang diubah', () => reload()),
  adAlliance: (el) => act(el, 'admin_alliance', { code: val('alC'), alliance: val('alA'), member: el.dataset.v === '1' }, 'Keanggotaan diubah', () => reload()),
  adAid: (el) => act(el, 'admin_aid', { to: val('aiC'), amount: parseFloat(val('aiA')), currency: 'USD', note: val('aiN') }, 'Bantuan UN terkirim', () => reload()),
  adLock: (el) => act(el, 'admin_lock', { code: val('lkC'), locked: el.dataset.v === '1' }, 'Status klaim diubah', () => reload()),
  adRelease: (el) => act(el, 'admin_release', { code: val('lkC') }, 'Presiden pemain dilepas', () => reload()),
  adYear: (el) => act(el, 'admin_set_year', { year: +val('yrV') }, 'Tahun diatur', () => reload()),
  adPause: (el) => act(el, 'admin_pause', { paused: el.dataset.v === '1' }, 'Status waktu diubah', async () => { await reload(); render(); }),
  adReset: () => modal({ title: 'Reset dunia ke 1980?', icon: 'triangle-alert', body: '<p>Seluruh negara, perjanjian, berita, pemilu, petisi, dan unggahan dihapus. Tindakan ini tidak dapat dibatalkan. Ketik <b>RESET</b>:</p><input type="text" id="rsT">', actions: [{ label: 'Reset dunia', cls: 'red', keep: true, fn: async (b) => { await act(b, 'admin_reset', { confirm: val('rsT') }, 'Dunia direset ke 1980', async () => { closeModal(); S.since = null; await reload(); render(); }); } }, { label: 'Batal' }] }),
  adMapbox: (el) => act(el, 'admin_mapbox', { token: val('mbT') }, 'Token Mapbox disimpan', () => reload()),
  adAnnounce: (el) => act(el, 'admin_announce', { text: val('anT') }, 'Pengumuman diterbitkan', async () => { await reload(); render(); }),
  adModerate: (el) => act(el, 'admin_moderate', { type: el.dataset.t, id: +el.dataset.id, hidden: el.dataset.h === '1' }, 'Moderasi diterapkan', async () => { PAGES.admin.after(); }),
};
const P_M = () => S.M.country;
function showReport() { const r = S.M?.country?.report || S.D?.country?.report; if (!r) return; modal({ title: `Laporan Akhir Tahun ${r.year}`, icon: 'newspaper', wide: true, body: `<div class="stack">${r.lines.map(l => `<div class="item">${esc(l)}</div>`).join('')}</div><div class="sub" style="margin-top:10px">Seluruh isi laporan adalah bagian dari simulasi.</div>`, actions: [{ label: 'Lihat Laporan Lengkap', icon: 'newspaper', fn: () => go('report') }, { label: 'Tutup', cls: 'pri' }] }); }
function renderNotifs() { const b = $('#notifBox'); b.innerHTML = `<div class="row between" style="margin-bottom:8px"><b>Notifikasi</b>${'Notification' in window && Notification.permission !== 'granted' ? `<button class="btn sm" id="notifPerm">${ic('bell-ring')} Izinkan notifikasi browser</button>` : `<span class="tag g">${ic('bell-ring')} Notifikasi browser aktif</span>`}</div>${S.notifs.length ? `<div class="stack">${S.notifs.map(n => `<div class="item"><b>${ic(n.icon || 'bell')} ${esc(n.title)}</b><div class="sub">${esc(n.body || '')} · ${ago(n.ts)}</div></div>`).join('')}</div>` : `<div class="empty">${ic('bell-off')}<div>Belum ada notifikasi.</div></div>`}`; refreshIcons(); const p = $('#notifPerm'); if (p) p.onclick = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Notifikasi browser diaktifkan' : 'Izin notifikasi tidak diberikan', r === 'granted' ? 'ok' : 'warn'); renderNotifs(); }; }

// ================= VOTING PERGANTIAN TAHUN =================
let advSeen = 0, advDismissed = 0, advTimer = 0;
function advBody() {
  const a = S.adv; if (!a) return ''; const left = Math.max(0, Math.ceil((a.expires - Date.now()) / 1000));
  if (a.status === 'open') return `<p><b>${esc(a.by)}</b> mengajukan memajukan tahun dunia dari <b>${S.world.year}</b> ke <b>${S.world.year + 1}</b>. Tahun hanya maju bila <b>semua pemain online setuju</b>.</p><div class="row between sub"><span>${ic('users-round')} Setuju ${a.yes} dari ${a.total} pemain online</span><span>${ic('timer')} ${left} dtk</span></div><div class="bar" style="margin:8px 0 14px"><i style="width:${a.total ? a.yes / a.total * 100 : 0}%;background:var(--acc)"></i></div>${a.mine ? `<div class="banner info">${ic('check-check')} Anda memilih <b>${a.mine === 'yes' ? 'setuju' : 'menolak'}</b>. Menunggu pemain lain…</div>` : `<div class="row wrap"><button class="btn pri" data-act="advVote" data-y="1">${ic('thumbs-up')} Setuju</button><button class="btn red" data-act="advVote" data-y="0">${ic('thumbs-down')} Tolak</button></div>`}`;
  return `<p>${a.status === 'done' ? 'Semua setuju. Tahun berhasil dimajukan.' : a.status === 'rejected' ? `Voting dibatalkan: ${esc(a.rejectedBy || 'seorang pemain')} menolak.` : a.status === 'expired' ? 'Voting kedaluwarsa — tidak semua pemain online setuju tepat waktu.' : a.status === 'failed' ? 'Voting disetujui tetapi gagal diproses: ' + esc(a.error || '') : 'Voting disetujui…'}</p>`;
}
function advModal(force) {
  const a = S.adv; if (!a || a.status !== 'open') return; const exist = $('#advBody');
  if (exist) { exist.innerHTML = advBody(); refreshIcons(); return; }
  if (!force && advDismissed === a.id) return;
  modal({ title: 'Voting: majukan 1 tahun', icon: 'vote', body: `<div id="advBody">${advBody()}</div>`, actions: [{ label: 'Tutup (tetap berjalan)', fn: () => { advDismissed = a.id; } }] });
  const m = $('#modal'); m.onclick = (e) => { if (e.target === m) { advDismissed = a.id; closeModal(); } };
}
function handleAdv(adv, force) {
  const prev = S.adv; S.adv = adv;
  if (adv && adv.status === 'open') { advModal(force); clearInterval(advTimer); advTimer = setInterval(() => { if (S.adv?.status !== 'open') { clearInterval(advTimer); return; } const b = $('#advBody'); if (b) { b.innerHTML = advBody(); refreshIcons(); } updateAdv(); }, 1000); }
  if (adv && adv.status !== 'open' && advSeen !== adv.id) {
    advSeen = adv.id; clearInterval(advTimer); const b = $('#advBody'); if (b) closeModal();
    toast(adv.status === 'done' ? 'Semua pemain setuju — tahun dimajukan' : adv.status === 'rejected' ? `Voting ditolak ${adv.rejectedBy ? 'oleh ' + adv.rejectedBy : ''}` : adv.status === 'expired' ? 'Voting kedaluwarsa' : adv.status === 'failed' ? 'Voting gagal diproses: ' + adv.error : 'Voting disetujui', adv.status === 'done' ? 'ok' : 'warn');
    if (adv.status === 'done' && prev && prev.id === adv.id) { setTimeout(async () => { await reload(); if (S.me?.president) showReport(); }, 400); }
  }
  updateAdv();
}

// ================= TUTORIAL =================
const STEPS = [['globe', 'Negara', 'Dunia berisi ±250 negara dan teritori yang dikelola NPC. Pilih negara lewat peta atau kotak pencarian, lalu lihat dasbornya: populasi, PDB, pertumbuhan, inflasi, pengangguran, utang, dan kas.'], ['crown', 'Peran Pemain', 'Anda dapat <b>mengklaim kepresidenan</b> negara yang belum dipimpin pemain lain, atau mendaftar sebagai <b>warga</b>. Klaim presiden hanya berlaku selama tab ini terbuka — memuat ulang atau menutup tab akan melepasnya. Kewarganegaraan tetap tersimpan.'], ['landmark', 'Pemerintahan', 'Presiden mengatur suku bunga, pajak (butuh persetujuan parlemen NPC), belanja, dagang, kabinet, koalisi, ideologi, dan undang-undang. Pantau kepuasan rakyat, korupsi, investasi, dan stabilitas.'], ['megaphone', 'Warga', 'Warga mengajukan dan mendukung petisi, mengadakan forum, relawan, dan aksi damai (masing-masing sekali per tahun simulasi), menulis di linimasa, serta memberi suara.'], ['vote', 'Pemilu', 'Setiap pergantian tahun dunia ada pemilu. Warga pemain memberi satu suara per tahun; warga NPC memilih berdasarkan kondisi negara. Jika penantang menang, presiden pemain turun jabatan.'], ['fast-forward', 'Pergantian Tahun', 'Tombol <b>Majukan 1 tahun</b> memulai <b>voting</b>: semua pemain online harus setuju (jika Anda sendirian, langsung maju). Setelah itu sistem memproses ekonomi, politik, diplomasi, dan pemilu seluruh dunia, lalu menampilkan laporan akhir tahun. Ada jeda penggunaan. Tahun simulasi berbeda dari waktu nyata; populasi diperbarui tiap tengah malam menurut zona waktu negara.'], ['rss', 'Berita & Sinkronisasi', 'Semua pemain berada di dunia yang sama. Data tersinkron secara real-time dan setiap 5 detik. Seluruh berita adalah bagian dari simulasi.']];
function tutorial(i) { const s = STEPS[i]; modal({ title: `${i + 1}/${STEPS.length} — ${s[1]}`, icon: s[0], body: `<p>${s[2]}</p><div class="bar"><i style="width:${(i + 1) / STEPS.length * 100}%;background:var(--acc)"></i></div>`, actions: [...(i > 0 ? [{ label: 'Kembali', icon: 'chevron-left', keep: true, fn: () => tutorial(i - 1) }] : []), i < STEPS.length - 1 ? { label: 'Lanjut', icon: 'chevron-right', cls: 'pri', keep: true, fn: () => tutorial(i + 1) } : { label: 'Mulai bermain', icon: 'play', cls: 'pri', fn: () => { try { localStorage.setItem('cm_tut', '1'); } catch (e) {} } }, { label: 'Tutup' }] }); }

// ================= EVENT =================
document.addEventListener('click', (e) => {
  const nv = e.target.closest('[data-nav]'); if (nv) { go(nv.dataset.nav); return; }
  const gt = e.target.closest('[data-go]'); if (gt && PAGES[gt.dataset.go]) { e.preventDefault(); closeModal(); go(gt.dataset.go); return; }
  const el = e.target.closest('[data-act]'); if (el && A[el.dataset.act]) { e.preventDefault(); if (el.disabled) return; A[el.dataset.act](el, e); return; }
  if (!e.target.closest('#notifBox') && !e.target.closest('#bell')) $('#notifBox')?.classList.add('hidden');
  if (!e.target.closest('.search')) $('#sRes')?.classList.add('hidden');
});
document.addEventListener('keydown', (e) => { const t = e.target; if (e.key === 'Enter' && t.dataset?.pcm) { e.preventDefault(); $(`[data-act=pubCmSend][data-id="${t.dataset.pcm}"]`)?.click(); return; } if (e.key === 'Enter' && t.dataset?.cm) { e.preventDefault(); const b = $(`[data-act=cmSend][data-id="${t.dataset.cm}"]`); b?.click(); } });
document.addEventListener('input', (e) => {
  const t = e.target, d = t.dataset || {}; if (!$('#pg')?.contains(t)) { if (t.id === 'gSearch') searchCountries(t.value); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.id !== 'lbQ') S.dirty = true;
  if ('pol' in d || 'polN' in d) { const k = d.pol || d.polN; $$(`[data-pol="${k}"]`).forEach(i => i.value = t.value); $$(`[data-pol-n="${k}"]`).forEach(i => i.value = t.value); }
  if ('soc' in d) $('#soc_' + d.soc + '_v').textContent = t.value;
  if (t.id === 'defRange') $('#defV').textContent = t.value + '% PDB';
  if (d.input === 'metric') { S.metric = t.value; updateMapStyle(); S.dirty = false; }
  if (d.input === 'trade') P.convPreview(); if (d.input === 'tf') tfPreview();
  if (d.input === 'poCnt') $('#poCnt').textContent = t.value.length + '/500';
  if (d.input === 'alRng') { const ks = ['darat', 'udara', 'art', 'intel']; ks.forEach(k => { $('#alv_' + k).textContent = $('#al_' + k).value + '%'; }); const sum = ks.reduce((a, k) => a + +$('#al_' + k).value, 0), el = $('#alSum'); if (el) { el.textContent = `Total ${sum}% (harus 100%)`; el.style.color = sum === 100 ? '' : '#ff8a8a'; } }
  if (d.input === 'lb') { S.filters.lbQ = val('lbQ'); S.filters.lbReg = val('lbReg'); S.filters.lbSort = val('lbSort'); S.dirty = false; const pos = t.selectionStart; render(); const q = $('#lbQ'); if (t.id === 'lbQ' && q) { q.focus(); q.setSelectionRange(pos, pos); } }
  if (t.id === 'trTo') S.filters.tradeTo = t.value; if (t.id === 'tfTo') S.filters.trTo = t.value;
});
function searchCountries(q) { const box = $('#sRes'); q = q.trim().toLowerCase(); if (!q) { box.classList.add('hidden'); return; } const r = [...S.countries.values()].filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || (REGION_ID[c.region] || '').toLowerCase().includes(q)).slice(0, 9); box.innerHTML = r.length ? r.map(c => `<button data-sc="${c.code}"><span style="font-size:20px">${c.flag}</span><span class="grow">${esc(c.name)}</span><span class="sub">${usd(c.gdp)}</span></button>`).join('') : `<div class="sub" style="padding:12px">Tidak ditemukan.</div>`; box.classList.remove('hidden'); $$('[data-sc]', box).forEach(b => b.onclick = () => { box.classList.add('hidden'); $('#gSearch').value = ''; pick(b.dataset.sc, S.page === 'map'); if (!['map', 'dash'].includes(S.page) && !PAGES[S.page].live) render(); else if (S.page !== 'map') go('dash'); }); }
function releaseBeacon() { if (!S.me?.president || !S.token) return; try { fetch(`${SB_URL}/functions/v1/cm-api`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.token}`, apikey: SB_KEY }, body: JSON.stringify({ action: 'release', session: SESSION }) }); } catch (e) {} }
addEventListener('pagehide', releaseBeacon);

// ================= JABATAN, LEGISLASI, PERANG NPC (cm-gov) =================
async function loadGov(force) { if (!S.me) return; const c = S.me.president || S.me.citizenship || S.sel; if (!c) return; try { S.Gerr = false; const [tp, d, pst] = await Promise.all([S.templates ? null : api('law_templates', {}, { quiet: true }).catch(() => null), api('gov_state', { country: c }, { quiet: true }), api('pres_state', { country: c }, { quiet: true }).catch(() => null)]); if (!S.templates && tp?.templates) S.templates = tp.templates; const j = JSON.stringify([d, pst]); if (j !== S._gj || force) { S._gj = j; if (d && S.me?.president && S.me.president === d.country) d.isPresident = true; if (pst && S.me?.president && S.me.president === pst.country) pst.isPresident = true; S.G = d; S.P = pst; if (['jabatan', 'uu', 'struktur'].includes(S.page)) softRender(); } } catch (e) { if (!S.G) { S.G = null; S.Gerr = e.message || 'Gagal memuat'; if (['jabatan', 'uu', 'struktur'].includes(S.page)) softRender(); } } }
const afterGov = async () => { await Promise.all([loadGov(true), loadMine(true), sync(true)]); render(); };
const gvVal = (id) => ($('#' + id)?.value ?? '').trim();
function composer({ mode, tid }) {
  const G = S.G, T = (S.templates || []).find(t => t.id === tid), mp = mode === 'mp', dec = mode === 'decree', fx0 = T?.fx || {};
  const sl = Object.entries(FXN_C).map(([k, n]) => `<div class="row between" style="gap:8px;margin:4px 0"><label style="width:120px">${n}</label><input type="range" id="fx_${k}" min="-3" max="3" step="0.1" value="${fx0[k] ?? 0}" ${T ? 'disabled' : ''} style="flex:1"><b id="fxv_${k}" style="width:42px;text-align:right">${fx0[k] ?? 0}</b></div>`).join('');
  const calc = () => { const fx = {}; let s = 0; for (const k in FXN_C) { const v = +$('#fx_' + k).value; $('#fxv_' + k).textContent = v; if (Math.abs(v) >= .05) { fx[k] = v; s += Math.abs(v); } } const cost = T ? T.cost : Math.min(1.5, Math.max(.05, .1 + .12 * s)); const el = $('#fxCost'); if (el) el.innerHTML = `Biaya ±<b>${cost.toFixed(2)}%</b> PDB per tahun · total dampak ${s.toFixed(1)}/8`; return fx; };
  modal({ title: dec ? 'Dekret Darurat (Perppu)' : T ? `Ajukan: ${T.name}` : mp ? 'RUU Custom (Anggota Parlemen)' : 'RUU Custom', icon: dec ? 'zap' : 'scroll-text', wide: true,
    body: `<div class="stack"><div><label class="sub">Judul RUU (4–80 karakter)</label><input id="bName" maxlength="80" style="width:100%" value="${esc(T?.name || '')}" ${T ? 'disabled' : ''}></div>
     <div><label class="sub">Isi / maksud RUU</label><textarea id="bDesc" rows="3" maxlength="600" style="width:100%" ${T ? 'disabled' : ''}>${esc(T?.desc || '')}</textarea></div>
     <div class="item"><b>Dampak tahunan</b> <span class="sub">(50% berlaku langsung saat disahkan, sisanya penuh tiap tahun)</span>${sl}<div class="sub" id="fxCost"></div>${T ? '' : `<button class="btn sm" id="bDraft">${ic('sparkles')} Minta Badan Legislasi (Gemini) merancang dampak</button><div class="sub" id="bWhy" style="margin-top:6px"></div>`}</div>
     ${dec ? '<div class="banner info">Dekret berlaku seketika tanpa parlemen: kepercayaan −3, stabilitas −2, kepuasan −1.</div>' : ''}<div ${dec ? 'style="display:none"' : ''}><label class="sub">${mp ? 'Pidato pengusul (wajib, ≤500 karakter)' : 'Pidato pengantar (opsional, ≤500 karakter)'}</label><textarea id="bSpeech" rows="3" maxlength="500" style="width:100%" placeholder="Yakinkan para anggota parlemen…"></textarea></div></div>`,
    actions: [{ label: dec ? 'Terbitkan Dekret' : mp ? 'Ajukan ke Sidang Paripurna' : 'Ajukan ke Parlemen', icon: dec ? 'zap' : 'gavel', cls: 'pri', keep: true, fn: async (b) => { const body = { template: dec ? undefined : T?.id, name: gvVal('bName'), desc: gvVal('bDesc'), speech: gvVal('bSpeech') }; if (!T || dec) body.fx = calc();
      if (dec) { await act(b, 'decree', body, (r) => r.note, async () => { closeModal(); await afterGov(); }); return; }
      const r = await act(b, mp ? 'law_mp' : 'law_propose', body, null, async (r) => { closeModal(); await afterGov(); showVote(r.passed ? (mp ? 'RUU lolos parlemen' : 'RUU disahkan') : 'RUU ditolak', r.vote, r.note || (r.status === 'accepted' ? 'Presiden menandatangani RUU.' : r.status === 'rejected' && r.passed ? 'Presiden memveto RUU.' : '')); }); } }, { label: 'Batal' }] });
  const el = document.getElementById('modal'); $$('input[type=range]', el).forEach(i => i.oninput = calc); calc();
  $('#bDraft')?.addEventListener('click', async (e) => { const b = e.currentTarget; b.disabled = true; try { const d = await api('law_draft', { name: gvVal('bName'), desc: gvVal('bDesc') }); for (const k in FXN_C) { const v = d.fx[k] ?? 0; $('#fx_' + k).value = v; } calc(); $('#bWhy').innerHTML = `${esc(d.why)}${d.risks?.length ? '<br>Risiko: ' + d.risks.map(esc).join('; ') : ''}`; } catch (er) {} b.disabled = false; });
}
// pulihkan jabatan presiden otomatis bila tab sempat tidur / sesi terlepas (mis. iPad, tab di latar belakang)
let restoring = false;
let wasAway = true; // true saat halaman baru dimuat atau tab sempat disembunyikan
async function restorePresidency() { if (restoring || !wasAway || !S.me || S.me.president || S.inStart || !lastPres() || document.hidden) return; wasAway = false; restoring = true; try { if (await reclaimPresidency()) { await sync(true); if (S.me?.president) { toast('Jabatan presiden dipulihkan', 'ok'); await Promise.all([loadMine(true), loadSel(true), loadGov(true)]); render(); } } } catch (e) {} restoring = false; }
document.addEventListener('visibilitychange', () => { if (document.hidden) wasAway = true; else { sync(true).then(restorePresidency).catch(() => {}); } }); window.addEventListener('focus', () => restorePresidency()); setTimeout(() => restorePresidency(), 4000);
document.addEventListener('pres-restored', () => { sync(true).then(() => loadGov(true)).then(() => { if (['jabatan', 'uu', 'struktur'].includes(S.page)) render(); }).catch(() => {}); });
const ISLES = new Set(['ID', 'PH', 'JP', 'GB', 'IE', 'NZ', 'AU', 'CU', 'JM', 'LK', 'MV', 'SG', 'MT', 'CY', 'IS', 'TW', 'BS', 'BB', 'TT', 'HT', 'DO', 'FJ', 'PG', 'MG', 'MU', 'BH', 'KM', 'CV', 'TL', 'WS', 'TO', 'SB', 'VU', 'LC', 'GD', 'KN', 'AG', 'DM', 'SC', 'ST']);
const theatreOf = (a, b) => (ISLES.has(a.code) || ISLES.has(b.code) || (a.region && b.region && a.region !== b.region)) ? 'pulau' : 'darat';
const wmoney = (v) => v >= 1000 ? (v / 1000).toFixed(1) + ' miliar' : Math.round(v) + ' juta';
async function startWar(code, training) {
  const ec = cty(code), mineCode = S.me?.president || S.me?.citizenship || S.sel, mc = cty(mineCode); if (!ec || !mc) return toast('Pilih negara dahulu', 'err');
  $('#side')?.classList.remove('open'); let ed = null; try { ed = (await api('get_country', { code }, { quiet: true }))?.country; } catch (e) {} const md = (S.me?.president ? S.M?.country : null) || S.D?.country;
  let st = null; if (!training) { try { st = await api('war_state', {}, { quiet: true }); } catch (e) { return toast(e.message || 'Tidak dapat memuat anggaran perang', 'err'); } }
  const info = (x, d) => ({ code: x.code, name: x.name, flag: x.flag, gdp: d?.gdp ?? x.gdp, readiness: d?.gov?.readiness ?? 50 }), theatre = theatreOf(mc, ec), role = st?.role || 'presiden';
  const HK = Object.entries(warCosts.HEROES), fund = training ? 4000 : st.fund, maxA = training ? 4000 : Math.min(st.maxAlloc, fund), minA = training ? 400 : st.minAlloc, def = Math.min(maxA, training ? 1500 : 900);
  if (!training && fund < minA) return modal({ title: 'Anggaran Perang tidak cukup', icon: 'banknote', body: `<p>Dana operasi Anda <b>${wmoney(fund)} USD</b>, kurang dari minimum ${minA} juta untuk satu pertempuran. Danai dari kas negara di halaman Medan Perang 3D.</p>`, actions: [{ label: 'Tutup' }] });
  let hk = 'observe';
  const body = `<div class="stack"><div class="sub">${ic(theatre === 'pulau' ? 'waves' : 'mountain')} ${theatre === 'pulau' ? 'Pertempuran di seberang laut / pulau: daratan luas dikelilingi laut, kapal perang tersedia.' : 'Pertempuran darat di wilayah perbatasan.'}</div>
   <div><label class="sub">Dana pertempuran dari Anggaran Perang${training ? ' (latihan: gratis)' : ` (tersedia ${wmoney(fund)} USD)`} — <b id="wbV">${def}</b> juta USD</label><input type="range" id="wbR" min="${minA}" max="${maxA}" step="50" value="${def}" style="width:100%"><div class="sub">Seluruh pasukan, kekuatan khusus, dan rudal nuklir (${warCosts.NUKE_COST} juta USD) dibayar dari dana ini. Sisa dana dikembalikan 80%. Kesiapan keamanan ${st ? st.readiness : Math.round(md?.gov?.readiness ?? 50)} menentukan pasukan awal; alokasi anggaran keamanan menentukan mutu.</div></div>
   <div><label class="sub">Peran ${role === 'wapres' ? 'Wakil Presiden' : 'Presiden'} di medan perang (opsional — boleh ikut bertempur atau hanya mengamati):</label><div class="w3-pick" id="wbH"><button class="w3-hk on" data-hk="observe">${ic('eye')}<b>Hanya mengamati</b><span>Memimpin pasukan dari markas tanpa kendaraan; kamera bebas, tidak berisiko gugur.</span><em>Gratis</em></button>${HK.map(([k, h]) => `<button class="w3-hk" data-hk="${k}">${ic(h.icon)}<b>${h.name}</b><span>${h.desc}</span><em>${h.cost ? h.cost + ' jt USD' : 'Gratis'}</em></button>`).join('')}</div></div></div>`;
  modal({ title: training ? 'Latihan Tempur' : `Medan Perang: ${mc.name} vs ${ec.name}`, icon: 'swords', wide: true, body, actions: [{ label: 'Masuk medan perang', icon: 'swords', cls: 'pri', keep: true, fn: async (btn) => {
    const alloc = +$('#wbR').value; let started = null;
    if (!training) { try { btn.disabled = true; started = await api('war_start', { enemy: code, alloc }); } catch (e) { btn.disabled = false; return; } }
    closeModal(); const sh = started?.shares || st?.shares || { darat: .25, udara: .25, art: .25, intel: .25 };
    openWar3D({ me: info(mc, md), enemy: info(ec, ed), training, theatre, budget: alloc, mods: sh, hero: hk === 'observe' ? undefined : { kind: hk, role, name: `${role === 'wapres' ? 'Wakil Presiden' : 'Presiden'} ${S.me?.name || ''}` },
      onResult: async (R) => { if (training) return 'Mode latihan: tidak memengaruhi negara.'; const r = await api('war_result', { enemy: code, outcome: R.outcome, margin: R.margin, secs: R.secs, spent: R.spent, nukes: R.nukes, nuked: R.nuked, heroKills: R.heroKills, heroDeaths: R.heroDeaths }); await Promise.all([sync(true), loadMine(true), loadSel(true)]); render(); return `Dampak diterapkan: kepuasan ${r.approval >= 0 ? '+' : ''}${r.approval}, stabilitas ${r.stability >= 0 ? '+' : ''}${r.stability}, PDB ${r.gdp >= 0 ? '+' : ''}${r.gdp}%, kesiapan ${r.readiness}. Dana dikembalikan ${r.refund} juta USD.${r.nukes ? ' Dunia mengecam penggunaan senjata nuklir.' : ''}${r.heroic ? ' Keberanian di garis depan menaikkan kepuasan.' : ''}${r.reckless ? ' Komandan gugur berulang kali; publik menyesalkan.' : ''}${r.peaceOffer ? ' Lawan mengajukan gencatan senjata (menu Penawaran).' : ''}`; },
      onClose: () => { if (S.page === 'perang') { loadWar(); render(); } } }); } }, { label: 'Batal' }] });
  setTimeout(() => { const r = $('#wbR'); if (!r) return; r.oninput = () => { $('#wbV').textContent = r.value; }; $$('#wbH [data-hk]').forEach(b => b.onclick = () => { hk = b.dataset.hk; $$('#wbH [data-hk]').forEach(x => x.classList.toggle('on', x === b)); }); }, 0);
}
async function loadWar() { if (!S.me?.president && !S.G?.isVP) { S.W = null; return; } try { S.W = await api('war_state', {}, { quiet: true }); if (S.page === 'perang') softRender(); } catch (e) { S.W = null; } }
hooks.loadWar = loadWar;
let succBusy = false;
async function trySucceed() { if (succBusy || !S.me || S.me.president || !S.G?.isVP) return; succBusy = true; try { const r = await api('succeed', {}, { quiet: true }); if (r?.status === 'succeeded') { toast('Presiden meninggalkan jabatan: Anda dilantik sebagai Presiden!', 'ok'); pushNotif({ id: 'succ' + Date.now(), icon: 'crown', title: 'Anda dilantik sebagai Presiden', body: 'Suksesi otomatis dari Wakil Presiden' }); await sync(true); await Promise.all([loadMine(true), loadSel(true), loadGov(true)]); updateChrome(); render(); } } catch (e) {} succBusy = false; }
setInterval(trySucceed, 15000);
const FXN_C = { corruption: 'Korupsi', trust: 'Kepercayaan publik', approval: 'Kepuasan rakyat', invest: 'Investasi', prosperity: 'Kemakmuran', stability: 'Stabilitas' };
Object.assign(A, {
  gvApply: (el) => { const o = el.dataset.o, M = S.G.offices[o], c = cty(S.G.country); openDocs({ title: `Surat Lamaran — ${M.name}`, office: M.name, country: c?.name || S.G.country, name: S.me?.name || 'Pelamar', submitLabel: 'Kirim Lamaran',
      info: `<b>${esc(M.name)}</b><br>Diputuskan oleh: ${S.G.presidentLive ? 'presiden pemain' : 'presiden NPC (Gemini, menilai rekam jejak Anda)'}.${M.dom?.length ? `<br>Wewenang usulan kebijakan: ${esc(M.dom.join(', '))}.` : ''}<br>Masa jabatan: ${M.term} tahun simulasi.<br>Tip: surat yang jelas, terukur, dan menyebut program kerja lebih meyakinkan.`,
      onSubmit: async (html, title) => { const r = await act(null, 'office_apply', { country: S.G.country, office: o, pitch: html }, (r) => r.note || 'Lamaran terkirim'); if (!r) return false; await afterGov(); return true; } }); },
  openUN: () => { $('#side')?.classList.remove('open'); openUNGA(); },
  gvViewApp: (el) => { const a = (S.G.apps || []).find(x => x.id === +el.dataset.id); if (a) openDocs({ readOnly: true, title: `Lamaran ${a.name} — ${S.G.offices[a.office]?.name || a.office}`, html: a.pitch }); },
  gvCoal: (el) => act(el, 'coalition_set', { party: el.dataset.p, join: el.dataset.j === '1' }, (r) => r.accepted === false ? r.note : (r.note || 'Koalisi diperbarui'), afterGov),
  gvDissolve: () => modal({ title: 'Bubarkan parlemen?', icon: 'flame', body: `<p>Pemilu dini digelar seketika: kursi partai bergeser mengikuti kepuasan rakyat, dan pemilu legislatif pemain dibuka. Bila koalisi Anda berkuasa, kepuasan −2 dan stabilitas −2. Hanya sekali per 4 tahun simulasi.</p><textarea id="gvDis" rows="3" maxlength="300" style="width:100%" placeholder="Alasan pembubaran (min 10 karakter)"></textarea>`, actions: [{ label: 'Bubarkan', cls: 'red', keep: true, fn: (b) => act(b, 'parliament_dissolve', { reason: gvVal('gvDis') }, (r) => r.note, async () => { closeModal(); await afterGov(); }) }, { label: 'Batal' }] }),
  gvAppoint: (el) => { const o = el.dataset.o, P = S.P; const cs = (P.citizens || []); modal({ title: `Tunjuk: ${P.offices[o].name}`, icon: 'user-check', body: cs.length ? `<p class="sub">Pilih warga negara yang akan Anda tunjuk. Pejabat lama (bila jabatan tunggal) otomatis digantikan.</p><select id="gvPerson" style="width:100%">${cs.map(x => `<option value="${esc(x.uid)}" ${x.office ? 'disabled' : ''}>${esc(x.name)}${x.office ? ' — sudah menjabat' : ''}</option>`).join('')}</select>` : '<p>Belum ada warga lain di negara ini. Ajak pemain lain menjadi warga negara Anda.</p>', actions: [...(cs.length ? [{ label: 'Tunjuk', icon: 'check', cls: 'pri', keep: true, fn: (b) => act(b, 'appoint_direct', { office: o, uid: gvVal('gvPerson') }, 'Pejabat ditunjuk', async () => { closeModal(); await afterGov(); }) }] : []), { label: 'Tutup' }] }); },
  gvAmnesty: () => modal({ title: 'Beri amnesti', icon: 'hand-heart', body: '<p>Amnesti memicu reaksi publik (Gemini): stabilitas biasanya naik, kepercayaan bisa turun. Sekali per 2 tahun simulasi.</p><textarea id="gvAm" rows="3" maxlength="300" style="width:100%" placeholder="Lingkup amnesti (mis. tahanan politik, pelanggaran ringan)"></textarea>', actions: [{ label: 'Berikan', cls: 'pri', keep: true, fn: (b) => act(b, 'amnesty', { scope: gvVal('gvAm') }, (r) => r.reaction || 'Amnesti diberikan', async () => { closeModal(); await afterGov(); }) }, { label: 'Batal' }] }),
  gvResign: () => modal({ title: 'Mundur dari jabatan?', icon: 'door-open', body: '<p>Anda akan kehilangan jabatan ini.</p>', actions: [{ label: 'Mundur', cls: 'red', fn: () => act(null, 'office_resign', {}, 'Anda telah mundur', afterGov) }, { label: 'Batal' }] }),
  gvDismiss: (el) => act(el, 'office_dismiss', { id: +el.dataset.id }, 'Pejabat diberhentikan', afterGov),
  gvAppDecide: (el) => act(el, 'office_decide', { id: +el.dataset.id, accept: el.dataset.v === '1' }, (r) => r.status === 'accepted' ? 'Pejabat dilantik' : 'Lamaran ditolak', afterGov),
  gvPropDecide: (el) => act(el, 'proposal_decide', { id: +el.dataset.id, accept: el.dataset.v === '1' }, (r) => r.status === 'accepted' ? 'Disetujui' : 'Ditolak / diveto', afterGov),
  gvBill: (el) => composer({ mode: el.dataset.mode, tid: el.dataset.t }),
  gvLegReg: () => modal({ title: 'Daftar sebagai calon anggota parlemen', icon: 'megaphone', body: `<div class="stack"><div><label class="sub">Partai</label><select id="lgParty" style="width:100%">${(S.G.parties || []).map(p => `<option>${esc(p)}</option>`).join('')}</select></div><div><label class="sub">Platform / janji kampanye (10–400 karakter)</label><textarea id="lgPlat" rows="4" maxlength="400" style="width:100%"></textarea></div><div class="sub">Pemilu tahun ${S.G.leg.next}. Aktiflah di Sosial & Petisi: rekam jejak memengaruhi pemilih NPC.</div></div>`, actions: [{ label: 'Daftar', icon: 'check', cls: 'pri', keep: true, fn: (b) => act(b, 'leg_register', { country: S.G.country, party: gvVal('lgParty'), platform: gvVal('lgPlat') }, 'Anda terdaftar sebagai caleg', async () => { closeModal(); await afterGov(); }) }, { label: 'Batal' }] }),
  gvLegWithdraw: (el) => act(el, 'leg_withdraw', { country: S.G.country }, 'Pencalonan ditarik', afterGov),
  gvLegVote: (el) => act(el, 'leg_vote', { country: S.G.country, candidate: +el.dataset.id }, 'Suara Anda tercatat', afterGov),
  gvLegCall: (el) => modal({ title: 'Majukan pemilu legislatif?', icon: 'fast-forward', body: `<p>Pendaftaran caleg dibuka sekarang; pemungutan suara tahun ${S.G.year + 1}. Hanya sekali per 3 tahun.</p>`, actions: [{ label: 'Majukan', cls: 'pri', fn: () => act(null, 'leg_call', {}, 'Pemilu dimajukan', afterGov) }, { label: 'Batal' }] }),
  gvRepeal: (el) => modal({ title: 'Cabut UU?', icon: 'file-x', body: '<p>Pencabutan diputuskan sidang parlemen.</p><textarea id="gvSp" rows="2" maxlength="500" style="width:100%" placeholder="Pidato (opsional)"></textarea>', actions: [{ label: 'Ajukan Pencabutan', cls: 'red', keep: true, fn: (b) => act(b, 'law_repeal', { id: el.dataset.id, speech: gvVal('gvSp') }, null, async (r) => { closeModal(); await afterGov(); showVote(r.passed ? 'UU dicabut' : 'Pencabutan ditolak', r.vote); }) }, { label: 'Batal' }] }),
  gvProposal: (el) => { const o = el.dataset.o, M = S.G.offices[o], c = (S.M?.country || S.D?.country); const cur = (k) => c?.pol?.[k]; modal({ title: `Usulan kebijakan — ${M.name}`, icon: 'file-pen-line', body: `<div class="stack"><div><label class="sub">Kebijakan</label><select id="gvKey" style="width:100%">${M.dom.map(k => `<option value="${k}">${k} (sekarang ${cur(k) ?? '?'})</option>`).join('')}</select></div><div><label class="sub">Nilai baru (maks ±12% rentang dari nilai sekarang)</label><input id="gvVal" type="number" step="0.1" style="width:100%"></div><div><label class="sub">Alasan</label><textarea id="gvWhy" rows="3" maxlength="300" style="width:100%"></textarea></div></div>`, actions: [{ label: 'Kirim ke Presiden', icon: 'send', cls: 'pri', keep: true, fn: (b) => act(b, 'proposal_create', { office: o, key: gvVal('gvKey'), value: parseFloat(gvVal('gvVal')), reason: gvVal('gvWhy') }, (r) => r.note || 'Usulan terkirim', async () => { closeModal(); await afterGov(); }) }, { label: 'Batal' }] }); },
  gvReview: (el) => { const laws = [...Object.values(S.G.customLaws || {}).map(l => [l.id, l.name]), ...(S.G.laws || []).map(id => [id, (LAWS[id]?.[0]) || id])], pre = el?.dataset?.id; modal({ title: 'Uji Materi — Mahkamah Agung', icon: 'gavel', body: `<div class="stack"><div><label class="sub">UU yang diuji</label><select id="gvLaw" style="width:100%">${laws.map(([id, n]) => `<option value="${esc(id)}" ${id === pre ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><div><label class="sub">Pokok permohonan / argumen konstitusional (min 20 karakter)</label><textarea id="gvArg" rows="4" maxlength="600" style="width:100%"></textarea></div></div><div class="sub">Majelis 5 hakim (termasuk hakim NPC) memutus; mayoritas mengabulkan = UU dibatalkan. Satu uji materi per tahun.</div>`, actions: [{ label: 'Ajukan', icon: 'gavel', cls: 'pri', keep: true, fn: (b) => act(b, 'court_review', { law: gvVal('gvLaw'), argument: gvVal('gvArg') }, null, async (r) => { closeModal(); await afterGov(); modal({ title: r.strike ? `UU dibatalkan (${r.for}–${r.against})` : `Permohonan ditolak (${r.for}–${r.against})`, icon: 'gavel', body: `<p>${esc(r.opinion)}</p>`, actions: [{ label: 'Tutup', cls: 'pri' }] }); }) }, { label: 'Batal' }] }); },
  gvProsecute: (el) => act(el, 'prosecute', {}, (r) => `Kasus dibongkar: korupsi turun ${r.found} poin`, afterGov),
  gvRate: () => { const c = S.D?.country || S.M?.country, cur = c?.pol?.rate; modal({ title: 'Rapat Dewan Gubernur', icon: 'percent', body: `<div class="stack"><div class="sub">Suku bunga sekarang: <b>${cur ?? '?'}%</b>. Maksimal ±1,5 poin, sekali per tahun.</div><input id="gvRt" type="number" step="0.25" style="width:100%" value="${cur ?? ''}"><textarea id="gvRw" rows="2" maxlength="300" style="width:100%" placeholder="Pernyataan kebijakan moneter"></textarea></div>`, actions: [{ label: 'Putuskan', cls: 'pri', keep: true, fn: (b) => act(b, 'bank_rate', { rate: parseFloat(gvVal('gvRt')), reason: gvVal('gvRw') }, 'Suku bunga diubah', async () => { closeModal(); await afterGov(); }) }, { label: 'Batal' }] }); },
});

// ================= BOOT =================
let booted = false, running = false;
const startHooks = {
  refresh: async () => { await sync(true); await Promise.all([loadMine(true), loadSel(true)]); },
  start: () => { destroyMap(); destroyLand(); S.inStart = true; showStart(app, { ...startHooks, lang: openLang }); },
  enter: () => { stopStart(); S.inStart = false; S.page = S.page === 'land' ? 'land' : (S.me?.president ? 'dash' : S.page || 'dash'); shell(); render(); loadSel(true); loadMine(true); loadGov(true); let seen = false; try { seen = !!localStorage.getItem('cm_tut'); } catch (e) {} if (!seen) setTimeout(() => tutorial(0), 600); else if (S.me?.president || S.me?.citizenship) { S.sel = S.me.president || S.me.citizenship; setTimeout(() => A.openCapital(), 300); } },
  logout: async () => { releaseBeacon(); await sb.auth.signOut(); location.reload(); },
};
async function boot(session) {
  if (booted) return; booted = true; S.token = session.access_token; S.user = session.user;
  app.innerHTML = `<div class="gate"><div class="box"><div class="skeleton" style="height:120px"></div><p class="sub" style="margin-top:14px">${ic('loader-circle', 'spin')} Memuat dunia…</p></div></div>`; refreshIcons();
  try { await sync(true); } catch (e) {}
  if (!S.me) { booted = false; showGate('Tidak dapat memuat dunia. Pastikan koneksi dan coba lagi.'); return; }
  if (!running) { running = true; subscribeRealtime(); setInterval(() => sync(), 5000); setInterval(() => { updateAdv(); updateConn(); tickTop(); tickClock(); }, 1000); setInterval(() => { loadSel(); loadMine(); }, 10000); }
  syncLangFromAccount(); startHooks.start();
}
sb.auth.onAuthStateChange((ev, session) => { if (session) S.token = session.access_token; if (ev === 'SIGNED_OUT') { booted = false; showGate(); } if ((ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') && session && !booted) boot(session); });
(async () => { const { data } = await sb.auth.getSession(); if (!data.session) showGate(); else boot(data.session); })();
window.__cm = { S, sync, go, pick, render, get land() { return LAND; }, get city() { return CITY; } };
