// Country Manager — halaman & aksi
import { S, $, $$, esc, ic, fmt, compact, usd, loc, cty, ago, when, isPres, myCode, toast, modal, closeModal, api, act, num, animateNumbers, lineChart, refreshIcons, REGION_ID, SECTOR_ID, ALLIANCES, LAWS, MOTIONS, MINISTRIES, IDEOLOGIES, PARTY_COLORS } from './core.js';

export const hooks = {}; // diisi main.js: reload(), go(), loadSel(), loadMine(), render()
const card = (t, i, body, cls = '') => `<div class="card ${cls}"><h3>${ic(i)} ${t}</h3>${body}</div>`;
const empty = (icon, msg) => `<div class="empty">${ic(icon)}<div>${msg}</div></div>`;
const skel = () => `<div class="grid g3"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
const bar = (v, col) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col || (v > 66 ? 'var(--good)' : v > 38 ? 'var(--warn)' : 'var(--bad)')}"></i></div>`;
const stat = (label, icon, val, sub = '') => `<div class="card stat"><small>${ic(icon)} ${label}</small><b>${val}</b><em>${sub}</em></div>`;
const flagName = (c) => `${c.flag} ${esc(c.name)}`;
const options = (list, sel) => list.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
const countryOptions = (exclude, sel) => options([...S.countries.values()].filter(c => c.code !== exclude).sort((a, b) => a.name.localeCompare(b.name, 'id')).map(c => [c.code, `${c.flag} ${c.name} (${c.code})`]), sel);
const M = () => S.M?.country; // negara yang saya pimpin
const gate = () => isPres() ? '' : `<div class="banner info">${ic('info')}<div class="grow">Halaman ini membutuhkan peran <b>Presiden</b>. Klaim kepresidenan pada negara yang belum dipimpin pemain lain (klaim berlaku selama sesi tab ini).</div><button class="btn sm pri" data-act="claimSel">${ic('crown')} Klaim ${esc(cty(S.sel)?.name || '')}</button></div>`;
const loadingM = () => isPres() && !S.M ? skel() : '';
const vote = (v) => v ? `<div class="item" style="margin-top:10px"><b>${v.passed ? 'DISETUJUI' : 'DITOLAK'}</b> — ${v.yes} setuju · ${v.no} menolak · ${v.abstain} abstain <span class="sub">(kursi koalisi ${v.coalition}/100)</span><div class="row" style="margin-top:8px;height:10px"><i style="flex:${v.yes};background:var(--good);height:10px;border-radius:5px 0 0 5px"></i><i style="flex:${v.abstain};background:var(--dim);height:10px"></i><i style="flex:${v.no};background:var(--bad);height:10px;border-radius:0 5px 5px 0"></i></div></div>` : '';
export const showVote = (title, v, note) => modal({ title, icon: 'landmark', body: (note ? `<p>${esc(note)}</p>` : '') + vote(v), actions: [{ label: 'Tutup', cls: 'pri' }] });

// ================= DASBOR =================
function dash() {
  const c = cty(S.sel), D = S.D; if (!c) return skel();
  const all = [...S.countries.values()], pop = all.reduce((a, x) => a + x.pop, 0), gdp = all.reduce((a, x) => a + x.gdp, 0), trade = all.reduce((a, x) => a + (x.exp || 0), 0);
  const byReg = {}; all.forEach(x => { byReg[x.region] = (byReg[x.region] || 0) + x.gdp; }); const maxR = Math.max(...Object.values(byReg), 1);
  const top = [...all].sort((a, b) => b.gdp - a.gdp).slice(0, 6);
  const players = all.filter(x => x.playerPres).length;
  const lead = c.playerPres ? `<span class="tag g">${ic('user')} Pemain</span>` : `<span class="tag">${ic('bot')} NPC</span>`;
  const actions = [];
  if (!isPres() && !c.playerPres && !c.locked) actions.push(`<button class="btn pri" data-act="claimSel">${ic('crown')} Jadi Presiden</button>`);
  if (c.locked) actions.push(`<span class="tag r">${ic('lock')} Dikunci admin UN</span>`);
  if (S.me.president === c.code) actions.push(`<button class="btn red" data-act="release">${ic('log-out')} Lepas jabatan</button>`);
  if (!S.me.president && S.me.citizenship !== c.code) actions.push(`<button class="btn" data-act="citizenSel">${ic('id-card')} Daftar sebagai warga</button>`);
  if (S.me.citizenship === c.code && !S.me.president) actions.push(`<button class="btn" data-act="leaveCit">${ic('user-minus')} Lepas kewarganegaraan</button>`);
  return `
  <div class="hero"><div class="flag">${c.flag}</div><div class="grow"><h1>${esc(c.name)}</h1>
    <div class="sub">${REGION_ID[c.region] || c.region} · ${esc(c.sub || '')} · Presiden: <b>${esc(c.president)}</b> ${lead}</div>
    <div class="sub" style="margin-top:4px">${ic('banknote')} Mata uang <b>${esc(c.cur)}</b> (${esc(c.sym)}) · kurs <b>1 USD = ${esc(c.sym)} ${fmt(c.fx, c.fx < 10 ? 3 : 1)}</b> · ${ic('users')} ${D ? fmt(D.citizens) : '…'} warga pemain · ${ic('clock')} UTC${c.tz >= 0 ? '+' : ''}${c.tz}</div>
    <div class="row wrap" style="margin-top:12px">${actions.join('')}</div></div></div>
  <div class="grid g4">
    ${stat('Populasi', 'users', num('pop', c.pop, 'compact'), 'jiwa')}
    ${stat('PDB', 'landmark', num('gdp', c.gdp, 'usd', 2), loc(c.gdp, c))}
    ${stat('Pertumbuhan', 'trending-up', `<span class="${c.growth >= 0 ? 'up' : 'down'}">${num('gr', c.growth, 'pct', 1)}</span>`, 'per tahun simulasi')}
    ${stat('Inflasi', 'flame', `<span class="${c.infl > 8 ? 'down' : ''}">${num('inf', c.infl, 'pct', 1)}</span>`, 'tahunan')}
    ${stat('Pengangguran', 'briefcase', num('un', c.unemp, 'pct', 1), 'angkatan kerja')}
    ${stat('Utang', 'receipt', num('debt', c.debt, 'usd', 2), `${fmt(c.debt / c.gdp * 100)}% PDB`)}
    ${stat('Kas Negara', 'vault', num('tre', c.treasury, 'usd', 2), loc(c.treasury, c))}
    ${stat('Kepuasan Rakyat', 'smile', num('apr', c.approval, 'pct', 0), `Skor ${c.score}`)}
  </div>
  <div class="grid g2">
    ${card('Riwayat PDB (miliar USD)', 'chart-line', D?.country?.hist?.length ? '<canvas class="chart" id="gdpChart"></canvas>' : D ? empty('chart-line', 'Belum ada riwayat') : skel())}
    ${card('Ringkasan Dunia', 'globe', `<div class="grid g3" style="gap:8px">
      <div class="item"><span class="sub">Populasi dunia</span><br><b style="font-size:18px">${compact(pop)}</b></div>
      <div class="item"><span class="sub">PDB dunia</span><br><b style="font-size:18px">${usd(gdp)}</b></div>
      <div class="item"><span class="sub">Perdagangan aktif</span><br><b style="font-size:18px">${usd(trade)}</b></div>
      <div class="item"><span class="sub">Rata-rata pertumbuhan</span><br><b style="font-size:18px">${fmt(all.reduce((a, x) => a + x.growth, 0) / all.length, 1)}%</b></div>
      <div class="item"><span class="sub">Rata-rata inflasi</span><br><b style="font-size:18px">${fmt(all.reduce((a, x) => a + x.infl, 0) / all.length, 1)}%</b></div>
      <div class="item"><span class="sub">Presiden pemain</span><br><b style="font-size:18px">${players} / ${all.length}</b></div></div>
      <h3 style="margin-top:16px">${ic('chart-bar')} PDB per kawasan</h3><div class="stack">${Object.entries(byReg).sort((a, b) => b[1] - a[1]).map(([r, v]) => `<div><div class="row between sub"><span>${REGION_ID[r] || r}</span><span>${usd(v)}</span></div>${bar(v / maxR * 100, 'var(--acc)')}</div>`).join('')}</div>`)}
  </div>
  ${card('Ekonomi Terbesar', 'trophy', `<table><tr><th>#</th><th>Negara</th><th>PDB</th><th>Pertumbuhan</th><th>Populasi</th></tr>${top.map((x, i) => `<tr class="click" data-act="pick" data-code="${x.code}"><td>${i + 1}</td><td>${flagName(x)}</td><td>${usd(x.gdp)}</td><td class="${x.growth >= 0 ? 'up' : 'down'}">${fmt(x.growth, 1)}%</td><td>${compact(x.pop)}</td></tr>`).join('')}</table>`)}`;
}
dash.after = () => { if (S.D?.country?.hist) lineChart($('#gdpChart'), S.D.country.hist.map(h => [h[0], h[1]])); };

// ================= PETA =================
const METRICS = { gdp: 'PDB', growth: 'Pertumbuhan', infl: 'Inflasi', election: 'Hasil pemilu (dukungan petahana)' };
function mapPage() {
  const c = cty(S.sel), el = S.elections.find(e => e.country === S.sel);
  return `<div class="row wrap between"><div class="row wrap"><label class="sub">Warnai berdasarkan</label><select id="metricSel" data-input="metric" style="width:auto">${options(Object.entries(METRICS), S.metric)}</select><span class="legend">rendah <i></i> tinggi</span></div>
   <div class="row wrap"><div class="tabs"><button class="${S.mapMode !== '2d' ? 'on' : ''}" data-act="mapMode" data-v="3d">${ic('globe')} Globe 3D</button><button class="${S.mapMode === '2d' ? 'on' : ''}" data-act="mapMode" data-v="2d">${ic('map')} Peta 2D (${S.world.mapbox ? 'Mapbox' : 'OpenStreetMap'})</button></div><div class="sub">${ic('ship')} Rute kapal dagang negara terpilih • ukuran titik = ukuran ekonomi</div></div></div>
  <div id="map"></div>
  <div class="grid g2">${card('Negara Terpilih', 'map-pin', c ? `<div class="row wrap"><span style="font-size:40px">${c.flag}</span><div class="grow"><b style="font-size:18px">${esc(c.name)}</b><div class="sub">${esc(c.president)} · PDB ${usd(c.gdp)} · pertumbuhan ${fmt(c.growth, 1)}% · inflasi ${fmt(c.infl, 1)}%</div></div><button class="btn sm" data-act="goDash">${ic('layout-dashboard')} Dasbor</button></div>` : empty('map', 'Pilih negara di peta'))}
   ${card('Hasil Pemilu ' + (el ? el.result.year : ''), 'vote', el ? electionBars(el.result) : empty('vote', 'Belum ada pemilu untuk negara ini. Pemilu berlangsung setiap pergantian tahun.'))}</div>`;
}
function electionBars(r) {
  return `<div class="sub">${esc(r.incumbent)} <b>${r.share}%</b> vs ${esc(r.challenger)} <b>${r.challengerShare}%</b> · partisipasi ${r.turnout}% · perubahan ${r.change >= 0 ? '+' : ''}${r.change} pt · <span class="tag ${r.winner === 'incumbent' ? 'g' : 'r'}">${r.winner === 'incumbent' ? 'Petahana menang' : 'Penantang menang'}</span></div>
  <div class="stack" style="margin-top:10px">${r.districts.map(d => { const t = d.inc + d.ch || 1; return `<div><div class="row between sub"><span>${esc(d.name)}</span><span>${d.inc} – ${d.ch}</span></div><div class="row" style="height:9px"><i style="flex:${d.inc};background:var(--acc);border-radius:5px 0 0 5px"></i><i style="flex:${d.ch};background:var(--bad);border-radius:0 5px 5px 0"></i></div></div>`; }).join('')}</div>`;
}
mapPage.after = () => hooks.initMap?.();

// ================= NEGARA 3D =================
import { AREAS } from './areas.js';
function landPage() {
  const c = cty(S.sel); if (!c) return skel(); const km = AREAS[c.code]?.[1] || 0, id = AREAS.ID?.[1] || 1904569, mode = S.landMode || '3d';
  return `<div class="row wrap between"><div class="tabs"><button class="${mode === '3d' ? 'on' : ''}" data-act="landMode" data-v="3d">${ic('mountain')} Permukaan 3D (relief)</button><button class="${mode === 'peta' ? 'on' : ''}" data-act="landMode" data-v="peta">${ic('map')} Peta biasa</button></div>
  <div class="sub">${ic('ruler')} Luas <b>${fmt(km)} km²</b> ≈ ${fmt(km / id, 2)}× Indonesia · bentuk & ukuran mengikuti batas negara di globe</div></div>
  <div id="land" style="position:relative;height:calc(100vh - 250px);min-height:420px;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:#2a070d"><div id="landMsg" class="sub" style="position:absolute;left:14px;top:12px;z-index:3;padding:6px 12px;border-radius:99px;background:rgba(15,27,41,.9)">${ic('loader-circle', 'spin')} Memuat wilayah…</div><div id="landScale" class="sub" style="position:absolute;left:14px;bottom:12px;z-index:3;padding:6px 12px;border-radius:99px;background:rgba(15,27,41,.9)"></div></div>
  <div class="sub">Seret untuk memutar, scroll untuk zoom, klik kanan/geser dua jari untuk menggeser. Mode 3D memakai relief, laut, kota, dan kapal; mode peta memakai ${S.world.mapbox ? 'Mapbox' : 'OpenStreetMap'} dengan area di luar negara diredupkan.</div>`;
}
landPage.after = () => hooks.initLand?.();

// ================= KEBIJAKAN =================
const POLS = [['rate', 'Suku bunga acuan', 0, 50, 0.1, '%', 'Tinggi menekan inflasi namun memperlambat pertumbuhan'], ['taxInc', 'Pajak penghasilan', 0, 70, 1, '%', 'Perlu persetujuan parlemen'], ['taxCorp', 'Pajak perusahaan', 0, 60, 1, '%', 'Perlu persetujuan parlemen'], ['spend', 'Belanja pemerintah', 0, 40, 0.5, '% PDB', 'Stimulus ekonomi, menambah defisit'], ['infra', 'Infrastruktur', 0, 10, 0.1, '% PDB', 'Investasi jangka panjang'], ['edu', 'Pendidikan', 0, 10, 0.1, '% PDB', 'Meningkatkan modal manusia'], ['welfare', 'Kesejahteraan', 0, 15, 0.1, '% PDB', 'Menaikkan kepuasan & kemakmuran'], ['tariff', 'Tarif impor', 0, 80, 1, '%', 'Pendapatan negara, tetapi menghambat pertumbuhan'], ['fxIntervene', 'Intervensi cadangan devisa', -5, 5, 0.5, '', '+ menguatkan mata uang (memakai cadangan), − melemahkan. Sekali per tahun']];
function slider(p, c, attr = 'pol') { const v = c.pol[p[0]]; return `<div class="field"><div class="row between"><label>${p[1]}</label><span><input type="number" style="width:84px;padding:4px 8px" data-${attr}-n="${p[0]}" min="${p[2]}" max="${p[3]}" step="${p[4]}" value="${v}"> <span class="sub">${p[5]}</span></span></div><input type="range" data-${attr}="${p[0]}" min="${p[2]}" max="${p[3]}" step="${p[4]}" value="${v}"><div class="sub">${p[6] || ''}</div></div>`; }
function policy() {
  if (!isPres()) return gate() + loadingM(); if (!S.M) return skel(); const c = M(), un = S.M.country.used;
  return `<div class="grid g2"><div>${card('Kebijakan Ekonomi', 'sliders-horizontal', POLS.map(p => slider(p, c)).join('') + `<div class="row wrap"><button class="btn pri" data-act="applyPolicy">${ic('check')} Terapkan Kebijakan</button><button class="btn ghost" data-act="resetPolicy">${ic('rotate-ccw')} Kembalikan</button></div><div class="banner info" style="margin-top:12px">${ic('landmark')}<div>Perubahan <b>pajak</b> diputuskan oleh parlemen NPC (100 kursi). Kebijakan lain berlaku langsung. Dampak dihitung saat tahun dimajukan.</div></div>`)}</div>
  <div class="stack">${card('Kondisi Saat Ini', 'activity', `<div class="grid g2" style="gap:8px"><div class="item"><span class="sub">Pertumbuhan</span><br><b>${fmt(c.growth, 1)}%</b></div><div class="item"><span class="sub">Inflasi</span><br><b>${fmt(c.infl, 1)}%</b></div><div class="item"><span class="sub">Pengangguran</span><br><b>${fmt(c.unemp, 1)}%</b></div><div class="item"><span class="sub">Utang / PDB</span><br><b>${fmt(c.debt / c.gdp * 100)}%</b></div><div class="item"><span class="sub">Kurs</span><br><b>1 USD = ${c.sym} ${fmt(c.fx, 2)}</b></div><div class="item"><span class="sub">Cadangan devisa</span><br><b>${usd(c.reserves)}</b></div></div>`)}
  ${card('Anggaran Tahun Lalu', 'calculator', c.lastRevenue != null ? `<div class="kv row between"><span>Pemasukan</span><b class="up">${usd(c.lastRevenue)}</b></div><div class="row between"><span>Belanja</span><b class="down">${usd(c.lastExpense)}</b></div><div class="row between"><span>Saldo</span><b class="${c.lastBalance >= 0 ? 'up' : 'down'}">${usd(c.lastBalance)}</b></div>` : empty('calculator', 'Belum ada data. Majukan tahun untuk melihat neraca.'))}
  ${card('Dampak yang Dihitung', 'git-branch', '<div class="sub">Pertumbuhan, inflasi, lapangan kerja, utang, kurs, dan kepuasan dihitung ulang setiap pergantian tahun dan dijelaskan di halaman <b>Laporan Tahun</b>.</div>')}</div></div>`;
}

// ================= PERDAGANGAN =================
function offerRow(o, me) {
  const from = cty(o.from_c), to = cty(o.to_c), mine = o.from_c === me;
  const st = { pending: ['y', 'Menunggu'], active: ['g', 'Aktif'], rejected: ['r', 'Ditolak'], cancelled: ['', 'Dibatalkan'], expired: ['', 'Kedaluwarsa'], done: ['g', 'Selesai'] }[o.status] || ['', o.status];
  const kind = { trade: 'Dagang', peace: 'Damai', bilateral: 'Bilateral' }[o.kind];
  const exporter = from, v = +o.value;
  const lines = o.kind === 'trade' ? `${SECTOR_ID[o.sector]} · ekspor <b>${usd(v)}</b>/thn (${from ? loc(v, from) : ''} → ${to ? loc(v, to) : ''}) · tarif impor ${o.tariff_to}% / ${o.tariff_from}%` : o.kind === 'bilateral' ? `Kerja sama ${esc(o.sector)}` : 'Usulan perdamaian';
  const btns = [];
  if (o.status === 'pending' && o.to_c === me) btns.push(`<button class="btn sm pri" data-act="respond" data-id="${o.id}" data-accept="1">${ic('check')} Terima</button><button class="btn sm red" data-act="respond" data-id="${o.id}" data-accept="0">${ic('x')} Tolak</button>`);
  if (o.kind === 'trade' && ['active', 'pending'].includes(o.status)) btns.push(`<button class="btn sm red" data-act="cancelTrade" data-id="${o.id}">${ic('ban')} Batalkan</button>`);
  return `<div class="item"><div class="row wrap between"><div><b>${from ? from.flag : ''} ${esc(from?.name || o.from_c)} → ${to ? to.flag : ''} ${esc(to?.name || o.to_c)}</b> <span class="tag ${st[0]}">${st[1]}</span> <span class="tag b">${kind}</span><div class="sub">${lines} · ${mine ? 'diajukan oleh Anda' : ''} ${ago(o.ts)}</div></div><div class="row wrap">${btns.join('')}</div></div></div>`;
}
function trade() {
  if (!isPres()) return gate() + loadingM(); if (!S.M) return skel(); const c = M(), me = c.code, offers = (S.M.trades || []).filter(o => o.kind === 'trade');
  const tgt = S.filters.tradeTo || [...S.countries.keys()].find(k => k !== me);
  return `<div class="grid g2">${card('Ajukan Perjanjian Perdagangan', 'handshake', `
    <div class="field"><label>Negara mitra</label><select id="trTo" data-input="trade">${countryOptions(me, tgt)}</select></div>
    <div class="field"><label>Sektor</label><select id="trSec">${options(Object.entries(SECTOR_ID), 'manufaktur')}</select></div>
    <div class="field"><label>Nilai ekspor tahunan</label><div class="row"><input type="number" id="trVal" min="0.01" step="0.01" value="1" data-input="trade"><select id="trCur" style="width:130px" data-input="trade"><option value="USD">USD (miliar)</option><option value="LOCAL">${esc(c.cur)} (miliar)</option></select></div><div class="sub" id="trConv"></div></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Tarif impor mitra atas barang Anda (%)</label><input type="number" id="trT1" min="0" max="80" value="10"></div><div class="field"><label>Tarif impor Anda atas barang mitra (%)</label><input type="number" id="trT2" min="0" max="80" value="10"></div></div>
    <button class="btn pri" data-act="proposeTrade">${ic('send')} Kirim Penawaran</button><div class="sub" style="margin-top:8px">NPC dapat menerima atau menolak segera. Presiden pemain menjawab dari halaman ini. Maksimal nilai: 5% PDB Anda (${usd(c.gdp * 0.05)}).</div>`)}
  ${card('Ringkasan Perdagangan', 'package', `<div class="grid g2" style="gap:8px"><div class="item"><span class="sub">Ekspor aktif</span><br><b>${usd(offers.filter(o => o.status === 'active' && o.from_c === me).reduce((a, o) => a + +o.value, 0))}</b></div><div class="item"><span class="sub">Impor aktif</span><br><b>${usd(offers.filter(o => o.status === 'active' && o.to_c === me).reduce((a, o) => a + +o.value, 0))}</b></div><div class="item"><span class="sub">Perjanjian aktif</span><br><b>${offers.filter(o => o.status === 'active').length}</b></div><div class="item"><span class="sub">Menunggu</span><br><b>${offers.filter(o => o.status === 'pending').length}</b></div></div>`)}</div>
  ${card('Daftar Perjanjian & Penawaran', 'list', offers.length ? `<div class="stack">${offers.map(o => offerRow(o, me)).join('')}</div>` : empty('package-open', 'Belum ada perjanjian. Ajukan penawaran pertama Anda.'))}`;
}
trade.after = () => convPreview();
function convPreview() {
  const el = $('#trConv'); if (!el || !S.M) return; const c = M(), v = parseFloat($('#trVal')?.value) || 0, cur = $('#trCur')?.value, to = cty($('#trTo')?.value); const usdB = cur === 'USD' ? v : v / c.fx;
  el.innerHTML = `= <b>${usd(usdB)}</b> · ${esc(c.sym)} ${compact(usdB * 1e9 * c.fx)} (mata uang Anda)${to ? ` · ${esc(to.sym)} ${compact(usdB * 1e9 * to.fx)} (${esc(to.cur)})` : ''}`;
}

// ================= KAS & TRANSFER =================
function treasury() {
  if (!isPres()) return gate() + loadingM(); if (!S.M) return skel(); const c = M(), tr = S.M.transfers || [];
  const to = S.filters.trTo || [...S.countries.keys()].find(k => k !== c.code);
  return `<div class="grid g2">${card('Kas Negara', 'vault', `<div class="grid g2" style="gap:8px"><div class="item"><span class="sub">Saldo (USD)</span><br><b style="font-size:20px">${usd(c.treasury)}</b></div><div class="item"><span class="sub">Saldo (${esc(c.cur)})</span><br><b style="font-size:20px">${loc(c.treasury, c)}</b></div></div>`)}
  ${card('Transfer Dana', 'send', `<div class="field"><label>Negara penerima</label><select id="tfTo" data-input="tf">${countryOptions(c.code, to)}</select></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Jumlah (miliar)</label><input type="number" id="tfAmt" min="0.001" step="0.01" value="0.1" data-input="tf"></div><div class="field"><label>Mata uang</label><select id="tfCur" data-input="tf"><option value="USD">USD</option><option value="LOCAL">${esc(c.cur)} (lokal)</option></select></div></div>
    <div class="field"><label>Catatan</label><input type="text" id="tfNote" maxlength="140" placeholder="Opsional"></div>
    <div class="item" id="tfPrev" style="margin-bottom:12px"></div><button class="btn pri" id="tfBtn" data-act="transfer">${ic('send')} Kirim Dana</button>`)}</div>
  ${card('Riwayat Transaksi', 'history', tr.length ? `<div class="scroll"><table><tr><th>Waktu</th><th>Dari</th><th>Ke</th><th>USD</th><th>Nilai lokal</th><th>Catatan</th></tr>${tr.map(t => { const f = cty(t.from_c), r = cty(t.to_c); return `<tr><td>${when(t.ts)}</td><td>${t.from_c === 'UN' ? 'UN (admin)' : f ? flagName(f) : t.from_c}</td><td>${r ? flagName(r) : t.to_c}</td><td>${usd(+t.usd)}</td><td>${esc(r ? r.sym : '')} ${compact(+t.local_amt * 1e9)}</td><td>${esc(t.note || '')}</td></tr>`; }).join('')}</table></div>` : empty('receipt', 'Belum ada transaksi.'))}`;
}
treasury.after = () => tfPreview();
export function tfPreview() {
  const el = $('#tfPrev'); if (!el || !S.M) return; const c = M(), r = cty($('#tfTo')?.value), a = parseFloat($('#tfAmt')?.value) || 0, cur = $('#tfCur')?.value, u = cur === 'USD' ? a : a / c.fx;
  const ok = u > 0 && u <= c.treasury, rr = r && S.countries.get(r.code);
  el.innerHTML = `<div class="row between"><span class="sub">Setara</span><b>${usd(u)}</b></div><div class="row between"><span class="sub">Diterima ${r ? esc(r.name) : ''}</span><b>${r ? esc(r.sym) + ' ' + compact(u * 1e9 * r.fx) : '-'}</b></div><div class="row between"><span class="sub">Saldo Anda setelah transfer</span><b class="${ok ? '' : 'down'}">${usd(c.treasury - u)}</b></div><div class="row between"><span class="sub">Saldo ${r ? esc(r.name) : 'penerima'} setelah transfer</span><b>${r ? usd(r.treasury + u) : '-'}</b></div><div class="${ok ? 'up' : 'down'}" style="margin-top:6px">${ic(ok ? 'circle-check' : 'circle-x')} ${u <= 0 ? 'Masukkan jumlah' : ok ? 'Saldo mencukupi' : 'Saldo tidak mencukupi'}</div>`;
  const b = $('#tfBtn'); if (b) b.disabled = !ok; refreshIcons();
}

// ================= POLITIK & KABINET =================
function seatsViz(c) { const dots = []; c.gov.parties.forEach((p, i) => { for (let k = 0; k < p.seats; k++) dots.push(`<i style="background:${PARTY_COLORS[i]};opacity:${c.gov.coalition.includes(p.name) ? 1 : .35}" title="${esc(p.name)}"></i>`); }); return `<div class="seats">${dots.join('')}</div>`; }
function politics() {
  const pres = isPres(), c = pres ? M() : S.D?.country; if (!c) return (pres || S.sel ? skel() : '') + (pres ? '' : gate());
  const cs = c.gov.parties.filter(p => c.gov.coalition.includes(p.name)).reduce((a, p) => a + p.seats, 0);
  return gate() + `<div class="grid g2">${card('Parlemen — 100 Kursi NPC', 'landmark', `${seatsViz(c)}<div class="stack" style="margin-top:12px">${c.gov.parties.map((p, i) => `<label class="row sub"><i style="width:12px;height:12px;border-radius:50%;background:${PARTY_COLORS[i]}"></i>${pres ? `<input type="checkbox" data-coal="${esc(p.name)}" ${c.gov.coalition.includes(p.name) ? 'checked' : ''}>` : ''}<span class="grow">${esc(p.name)}</span><b>${p.seats}</b></label>`).join('')}</div><div class="sub" style="margin-top:8px">Kursi koalisi: <b>${cs}</b>/100 ${cs > 50 ? '<span class="tag g">Mayoritas</span>' : '<span class="tag r">Minoritas</span>'}</div>${pres ? `<div class="field" style="margin-top:12px"><label>Partai presiden</label><select id="partySel">${options(c.gov.parties.map(p => [p.name, p.name]), c.gov.party)}</select></div><button class="btn pri" data-act="setParty">${ic('users-round')} Simpan Partai & Koalisi</button>` : ''}`)}
  ${card('Kabinet', 'briefcase-business', Object.entries(MINISTRIES).map(([k, t]) => { const cur = c.gov.cabinet[k]; return `<div class="item" style="margin-bottom:9px"><div class="row between"><b>${t}</b>${cur ? `<span class="tag g">${esc(cur.name)} · skill ${cur.skill}</span>` : '<span class="tag">Kosong</span>'}</div>${pres ? `<div class="row" style="margin-top:8px"><select id="cab_${k}">${c.gov.cand[k].map((x, i) => `<option value="${i}">${esc(x.name)} — skill ${x.skill}</option>`).join('')}</select><button class="btn sm pri" data-act="appoint" data-m="${k}">${ic('user-check')} Tunjuk</button></div>` : ''}</div>`; }).join(''))}</div>
  ${card('Mosi Parlemen', 'gavel', `<div class="grid g4" style="gap:10px">${Object.entries(MOTIONS).map(([k, t]) => `<div class="item"><b>${t}</b><div class="sub" style="margin:4px 0 8px">${{ transparansi: 'Meningkatkan kepercayaan, menekan korupsi', hak_warga: 'Menaikkan kepuasan & stabilitas', layanan_publik: 'Kesehatan & infrastruktur, memakai kas', keamanan: 'Menaikkan kesiapan pertahanan' }[k]}</div>${pres ? `<button class="btn sm pri" data-act="motion" data-m="${k}">${ic('vote')} Ajukan</button>` : ''}</div>`).join('')}</div><div id="voteOut">${vote(S.filters.lastVote)}</div><div class="sub" style="margin-top:8px">Setiap mosi dapat diajukan sekali per tahun simulasi. Parlemen menilai berdasarkan kepercayaan, korupsi, kepuasan, stabilitas, dan utang.</div>`)}`;
}

// ================= PEMERINTAHAN =================
function gov() {
  const pres = isPres(), c = pres ? M() : S.D?.country; if (!c) return gate() + skel(); const g = c.gov;
  const ind = [['Kepuasan rakyat', g.approval, 'smile'], ['Bersih dari korupsi', 100 - g.corruption, 'shield-check'], ['Investasi', g.invest, 'chart-no-axes-combined'], ['Kemakmuran', g.prosperity, 'sprout'], ['Kepercayaan publik', g.trust, 'handshake'], ['Stabilitas', g.stability, 'scale']];
  const cats = { antikorupsi: 'Antikorupsi', ekonomi: 'Ekonomi & Investasi', kesejahteraan: 'Kesejahteraan' };
  return gate() + `<div class="grid g3">${ind.map(i => `<div class="card stat"><small>${ic(i[2])} ${i[0]}</small><b>${fmt(i[1])}</b>${bar(i[1])}</div>`).join('')}</div>
  <div class="grid g2">${card('Ideologi Negara', 'flag', `<div class="tabs">${Object.entries(IDEOLOGIES).map(([k, t]) => `<button class="${g.ideology === k ? 'on' : ''}" ${pres ? `data-act="ideology" data-id="${k}"` : 'disabled'}>${t}</button>`).join('')}</div><div class="sub" style="margin-top:10px">Pancasila: stabilitas & kepercayaan. Demokrasi: kepercayaan & investasi. Komunisme: kemakmuran & stabilitas, investasi turun. Dapat diganti sekali per tahun (stabilitas −3).</div>`)}
  ${card('Penyelidikan Korupsi', 'search', `<div class="sub">Membongkar kasus korupsi menurunkan indeks korupsi dan menaikkan kepercayaan. Biaya ±0,06% PDB. Sekali per tahun simulasi.</div>${pres ? `<button class="btn pri" style="margin-top:10px" data-act="investigate">${ic('search')} Selidiki Korupsi</button>` : ''}`)}</div>
  ${card('Undang-Undang', 'scroll-text', Object.entries(cats).map(([cat, t]) => `<h3 style="margin-top:10px">${t}</h3><div class="stack">${Object.entries(LAWS).filter(([, v]) => v[1] === cat).map(([id, v]) => { const on = g.laws.includes(id); return `<div class="item row wrap between"><div><b>${v[0]}</b> ${on ? '<span class="tag g">Berlaku</span>' : ''}<div class="sub">${v[2]}</div></div>${pres ? (on ? `<button class="btn sm red" data-act="repeal" data-id="${id}">${ic('file-x')} Cabut</button>` : `<button class="btn sm pri" data-act="propose" data-id="${id}">${ic('file-plus')} Ajukan RUU</button>`) : ''}</div>`; }).join('')}</div>`).join('') + '<div id="voteOut2"></div>')}`;
}

// ================= KEPENDUDUKAN =================
const SOC = [['health', 'Kesehatan publik (% PDB)', 0, 12, 0.1, 'Menambah harapan hidup & pertumbuhan penduduk'], ['family', 'Dukungan keluarga', 0, 100, 1, 'Subsidi keluarga, memengaruhi kelahiran'], ['migration', 'Keterbukaan migrasi', 0, 100, 1, 'Tinggi: lebih banyak penduduk keluar-masuk']];
function pop() {
  const pres = isPres(), c = pres ? M() : S.D?.country; if (!c) return gate() + skel();
  const all = [...S.countries.values()], total = all.reduce((a, x) => a + x.pop, 0);
  return gate() + `<div class="grid g2">${card('Penduduk', 'users', `<div class="grid g2" style="gap:8px"><div class="item"><span class="sub">Populasi</span><br><b style="font-size:22px">${fmt(c.pop)}</b></div><div class="item"><span class="sub">Populasi dunia</span><br><b style="font-size:22px">${fmt(total)}</b></div></div><div class="sub" style="margin-top:10px">Populasi diperbarui otomatis <b>setelah tengah malam</b> menurut zona waktu negara (UTC${c.tz >= 0 ? '+' : ''}${c.tz}). Migrasi memindahkan penduduk antarnegara dan total populasi dunia tidak bertambah karena migrasi.</div>`)}
  ${card('Waktu', 'clock', `<div class="row wrap"><div class="item grow"><span class="sub">Waktu nyata ${esc(c.name)}</span><br><b style="font-size:24px" id="tzClock"></b><div class="sub" id="tzNext"></div></div><div class="item grow"><span class="sub">Tahun simulasi ekonomi</span><br><b style="font-size:24px">${S.world.year}</b><div class="sub">Maju hanya saat ada yang menekan “Majukan 1 tahun”</div></div></div>`)}</div>
  ${card('Pengaturan Kependudukan', 'heart-pulse', (pres ? SOC.map(p => `<div class="field"><div class="row between"><label>${p[1]}</label><b id="soc_${p[0]}_v">${c.pol[p[0]]}</b></div><input type="range" data-soc="${p[0]}" min="${p[2]}" max="${p[3]}" step="${p[4]}" value="${c.pol[p[0]]}"><div class="sub">${p[5]}</div></div>`).join('') + `<button class="btn pri" data-act="applySoc">${ic('check')} Terapkan</button>` : SOC.map(p => `<div class="row between item" style="margin-bottom:8px"><span>${p[1]}</span><b>${c.pol[p[0]]}</b></div>`).join('')))}`;
}
pop.after = () => tickClock();
export function tickClock() { const c = isPres() ? M() : S.D?.country; const el = $('#tzClock'); if (!el || !c) return; const now = new Date(), loc_ = new Date(now.getTime() + c.tz * 3600e3); el.textContent = loc_.toISOString().slice(11, 19); const nxt = new Date(loc_); nxt.setUTCHours(24, 0, 0, 0); const s = Math.floor((nxt - loc_) / 1000); const n = $('#tzNext'); if (n) n.textContent = `Pembaruan populasi berikutnya dalam ${Math.floor(s / 3600)} j ${Math.floor(s % 3600 / 60)} m ${s % 60} d`; }

// ================= DIPLOMASI =================
function diplo() {
  const pres = isPres(), c = pres ? M() : S.D?.country; if (!c) return gate() + skel();
  const me = c.code, incoming = pres ? (S.M.trades || []).filter(o => o.to_c === me && o.status === 'pending') : [];
  const cmp = [...S.countries.values()].filter(x => x.code !== me).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return gate() + (incoming.length ? card('Penawaran Masuk', 'inbox', `<div class="stack">${incoming.map(o => offerRow(o, me)).join('')}</div>`) : '') + `<div class="grid g2">${card('Aliansi & Organisasi', 'network', `<div class="stack">${Object.entries(ALLIANCES).map(([k, a]) => { const mem = c.mem.includes(k); return `<div class="item"><div class="row wrap between"><div><b>${k}</b> <span class="sub">${a[0]}</span> ${mem ? '<span class="tag g">Anggota</span>' : ''}<div class="sub">Aturan: ${a[1]}</div><div class="sub">Bonus: ${a[2]}</div></div>${pres && k !== 'UN' ? (mem ? `<button class="btn sm red" data-act="alliance" data-id="${k}" data-join="0">${ic('log-out')} Keluar</button>` : `<button class="btn sm pri" data-act="alliance" data-id="${k}" data-join="1">${ic('log-in')} Gabung</button>`) : ''}</div></div>`; }).join('')}</div>`)}
  <div class="stack">${card('Pertahanan', 'shield', `<div class="grid g2" style="gap:8px"><div class="item"><span class="sub">Kesiapan pertahanan</span><br><b style="font-size:20px">${fmt(c.gov.readiness)}</b>${bar(c.gov.readiness)}</div><div class="item"><span class="sub">Anggaran pertahanan</span><br><b style="font-size:20px" id="defV">${c.pol.defense}% PDB</b></div></div>${pres ? `<input type="range" id="defRange" min="0" max="12" step="0.1" value="${c.pol.defense}" style="margin:12px 0"><button class="btn pri" data-act="setDefense">${ic('shield-check')} Terapkan Anggaran</button>` : ''}`)}
  ${card('Hubungan Bilateral, Perang & Damai', 'swords', pres ? `<div class="field"><label>Negara target</label><select id="dpTo">${options(cmp.map(x => [x.code, `${x.flag} ${x.name}${c.war.includes(x.code) ? ' (perang)' : ''}`]), S.filters.dpTo || cmp[0]?.code)}</select></div>
     <div class="row wrap"><select id="dpType" style="width:auto">${options([['ekonomi', 'Ekonomi'], ['budaya', 'Budaya'], ['pendidikan', 'Pendidikan'], ['keamanan', 'Keamanan']])}</select><button class="btn" data-act="bilateral">${ic('handshake')} Kerja sama</button><button class="btn red" data-act="war">${ic('swords')} Nyatakan perang</button><button class="btn pri" data-act="peace">${ic('dove')} Usulkan damai</button></div>
     <div class="sub" style="margin-top:8px">Perang memotong PDB, kas, kesiapan, dan penilaian rakyat. Tidak dapat menyerang sesama anggota aliansi (selain UN). Kesiapan minimal 25.</div>` : empty('lock', 'Hanya presiden yang dapat bertindak.'))}
  ${card('Status Perang', 'flag-triangle-right', c.war.length ? c.war.map(w => { const x = cty(w); return `<span class="tag r">${x ? flagName(x) : w}</span>`; }).join(' ') : '<span class="tag g">Damai</span>')}</div></div>`;
}

// ================= WARGA =================
function civic() {
  const code = S.sel, c = cty(code), D = S.D; if (!c || !D) return skel(); const cit = S.me.citizenship === code || S.me.president === code;
  const used = D.civicUsed || [];
  const civ = [['forum', 'Forum publik', 'messages-square', 'Kepercayaan publik naik'], ['relawan', 'Kegiatan relawan', 'hand-heart', 'Kemakmuran & stabilitas naik'], ['aksi_damai', 'Aksi damai', 'megaphone', 'Menekan pemerintah: kepuasan turun, kepercayaan naik']];
  return `${cit ? '' : `<div class="banner info">${ic('info')}<div class="grow">Anda belum menjadi warga ${esc(c.name)}. Daftar sebagai warga untuk mengajukan petisi dan beraksi.</div>${S.me.president ? '' : `<button class="btn sm pri" data-act="citizenSel">${ic('id-card')} Jadi warga</button>`}</div>`}
  <div class="grid g3">${civ.map(([k, t, i, d]) => `<div class="card"><h3>${ic(i)} ${t}</h3><div class="sub" style="margin-bottom:12px">${d}</div><button class="btn pri" data-act="civic" data-k="${k}" ${used.includes(k) || !cit ? 'disabled' : ''}>${used.includes(k) ? ic('check') + ' Sudah dilakukan tahun ini' : ic('play') + ' Lakukan'}</button></div>`).join('')}</div>
  <div class="grid g2">${card('Ajukan Petisi', 'file-pen-line', `<div class="field"><label>Judul</label><input type="text" id="ptTitle" maxlength="100" ${cit ? '' : 'disabled'}></div><div class="field"><label>Isi petisi (maks 500 karakter)</label><textarea id="ptBody" maxlength="500" ${cit ? '' : 'disabled'}></textarea></div><button class="btn pri" data-act="petition" ${cit ? '' : 'disabled'}>${ic('send')} Kirim Petisi</button>`)}
  ${card('Petisi Warga', 'scroll', D.petitions.length ? `<div class="stack scroll" style="max-height:480px">${D.petitions.map(p => `<div class="item"><div class="row between"><b>${esc(p.title)}</b><span class="tag ${p.status === 'open' ? 'y' : 'g'}">${p.status === 'open' ? 'Terbuka' : 'Dijawab'}</span></div><div class="sub">${esc(p.author)} · ${ago(p.ts)}</div><p style="margin:6px 0">${esc(p.body)}</p>${p.answer ? `<div class="banner info">${ic('landmark')}<div><b>Jawaban presiden:</b> ${esc(p.answer)}</div></div>` : ''}<div class="row wrap"><button class="btn sm" data-act="support" data-id="${p.id}" ${p.supported || !cit ? 'disabled' : ''}>${ic('thumbs-up')} ${p.supported ? 'Didukung' : 'Dukung'} (${p.supports})</button>${S.me.president === code && p.status === 'open' ? `<button class="btn sm pri" data-act="answerPet" data-id="${p.id}">${ic('reply')} Jawab</button>` : ''}</div></div>`).join('')}</div>` : empty('scroll', 'Belum ada petisi.'))}</div>`;
}

// ================= SOSIAL =================
function social() {
  const code = S.sel, c = cty(code), D = S.D; if (!c || !D) return skel(); const cit = S.me.citizenship === code || S.me.president === code, pres = S.me.president === code;
  return `<div class="grid g2"><div class="stack">${card('Tulis Pesan — ' + flagName(c), 'pen-line', cit ? `${pres ? '' : `<div class="field"><label>Jenis</label><select id="poType">${options([['aspirasi', 'Aspirasi'], ['kritik', 'Kritik']])}</select></div>`}<div class="field"><label>${pres ? 'Pesan presiden' : 'Pesan'} <span class="sub" id="poCnt">0/500</span></label><textarea id="poBody" maxlength="500" data-input="poCnt" placeholder="${pres ? 'Sampaikan pesan resmi kepada rakyat…' : 'Tulis aspirasi atau kritik Anda…'}"></textarea></div><button class="btn pri" data-act="post">${ic('send')} Publikasikan</button>` : `<div class="sub">Hanya presiden dan warga ${esc(c.name)} yang dapat menulis. Anda tetap dapat memberi suka.</div>`)}
  ${pres ? card('Panel Aspirasi Terbaru', 'inbox', '<div id="aspBox">' + skel() + '</div>') : ''}</div>
  ${card('Linimasa ' + flagName(c), 'rss', D.posts.length ? `<div class="stack scroll" style="max-height:640px">${D.posts.map(p => `<div class="post"><div class="who">${ic(p.role === 'presiden' ? 'crown' : p.role === 'npc' ? 'bot' : p.role === 'kritik' ? 'message-square-warning' : p.role === 'aspirasi' ? 'lightbulb' : 'user')} ${esc(p.author)} <span class="tag ${p.role === 'presiden' ? 'a' : p.role === 'kritik' ? 'r' : p.role === 'aspirasi' ? 'y' : ''}">${{ presiden: 'Presiden', npc: 'NPC', kritik: 'Kritik', aspirasi: 'Aspirasi', warga: 'Warga' }[p.role]}</span><span class="sub">${ago(p.ts)}</span></div><p>${esc(p.body)}</p><button class="like ${p.liked ? 'on' : ''}" data-act="like" data-id="${p.id}">${ic('heart')} ${p.likes}</button></div>`).join('')}</div>` : empty('message-circle', 'Belum ada unggahan.'))}</div>`;
}
social.after = async () => { if (isPres() && S.me.president === S.sel && $('#aspBox')) { try { const r = await api('aspirations', {}, { quiet: true }); $('#aspBox').innerHTML = (r.posts.length || r.petitions.length) ? `<div class="stack scroll" style="max-height:300px">${r.posts.map(p => `<div class="post"><b>${esc(p.author)}</b> <span class="tag ${p.role === 'kritik' ? 'r' : 'y'}">${p.role}</span><p>${esc(p.body)}</p></div>`).join('')}${r.petitions.map(p => `<div class="post"><b>${ic('scroll')} ${esc(p.title)}</b> <span class="tag b">${p.supports} dukungan</span></div>`).join('')}</div>` : empty('inbox', 'Belum ada aspirasi baru.'); refreshIcons(); } catch (e) { $('#aspBox').innerHTML = empty('circle-alert', 'Gagal memuat aspirasi.'); } } };

// ================= PEMILU =================
function elections() {
  const code = S.sel, c = cty(code), D = S.D; if (!c || !D) return skel(); const cit = S.me.citizenship === code || S.me.president === code;
  return `<div class="grid g2">${card('Pemilu Tahun ' + S.world.year, 'vote', `<div class="sub" style="margin-bottom:10px">Pemilu diadakan setiap kali tahun dunia dimajukan. Setiap warga pemain memiliki <b>satu suara per tahun</b>. Warga NPC memilih berdasarkan kondisi negara. Jika penantang menang dan Anda presiden, kepresidenan Anda berakhir.</div>
    <div class="item"><b>${esc(c.president)}</b> (petahana) <span class="tag ${c.playerPres ? 'g' : ''}">${c.playerPres ? 'Pemain' : 'NPC'}</span><div class="sub">Kepuasan ${c.approval}% · kemakmuran ${fmt(c.prosperity)} · stabilitas ${fmt(c.stability)}</div></div>
    ${D.voted ? `<div class="banner info" style="margin-top:12px">${ic('check-check')} Anda sudah memilih tahun ini: <b>${D.voted === 'incumbent' ? 'Mempertahankan petahana' : 'Memilih penantang'}</b></div>` : `<div class="row wrap" style="margin-top:12px"><button class="btn pri" data-act="vote" data-v="incumbent" ${cit ? '' : 'disabled'}>${ic('badge-check')} Pertahankan petahana</button><button class="btn" data-act="vote" data-v="challenger" ${cit ? '' : 'disabled'}>${ic('user-round-plus')} Pilih penantang NPC</button></div>${cit ? '' : `<div class="sub" style="margin-top:6px">Jadilah warga negara ini untuk memilih.</div>`}`}`)}
  ${card('Hasil Pemilu Terakhir', 'chart-column', D.elections?.length ? D.elections.map(e => `<div style="margin-bottom:16px"><b>Tahun ${e.year}</b>${electionBars(e.result)}</div>`).join('') : empty('vote', 'Belum ada hasil pemilu. Majukan tahun untuk menggelar pemilu.'))}</div>`;
}

// ================= LAPORAN =================
function report() {
  const pres = isPres(), D = pres ? S.M : S.D; if (!D) return skel(); const r = D.country.report;
  return r ? card(`Laporan Akhir Tahun ${r.year} — ${flagName(D.country)}`, 'newspaper', `<div class="stack">${r.lines.map(l => `<div class="item">${esc(l)}</div>`).join('')}</div><div class="sub" style="margin-top:10px">Laporan menjelaskan perubahan dan akibat keputusan kebijakan. Seluruh isi adalah bagian dari simulasi.</div>`) : empty('newspaper', 'Belum ada laporan. Majukan tahun untuk membuat laporan akhir tahun.');
}

// ================= LEADERBOARD =================
const SORTS = { score: ['Skor keseluruhan', (c) => c.score], gdp: ['PDB', (c) => c.gdp], pop: ['Populasi', (c) => c.pop], prosperity: ['Kemakmuran', (c) => c.prosperity], approval: ['Kepuasan rakyat', (c) => c.approval], growth: ['Pertumbuhan', (c) => c.growth], treasury: ['Kas negara', (c) => c.treasury], clean: ['Korupsi terendah', (c) => -c.corruption] };
function leader() {
  const f = S.filters, q = (f.lbQ || '').toLowerCase(), reg = f.lbReg || '', sort = f.lbSort || 'score';
  let list = [...S.countries.values()].filter(c => (!reg || c.region === reg) && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q));
  const key = SORTS[sort][1]; list.sort((a, b) => key(b) - key(a));
  return card('Leaderboard Negara', 'trophy', `<div class="row wrap" style="margin-bottom:12px"><input type="search" id="lbQ" placeholder="Cari negara…" value="${esc(f.lbQ || '')}" data-input="lb" style="max-width:240px"><select id="lbReg" data-input="lb" style="width:auto">${options([['', 'Semua kawasan'], ...Object.entries(REGION_ID)], reg)}</select><select id="lbSort" data-input="lb" style="width:auto">${options(Object.entries(SORTS).map(([k, v]) => [k, 'Urut: ' + v[0]]), sort)}</select></div>
  ${list.length ? `<div class="scroll"><table><tr><th>#</th><th>Negara</th><th>Skor</th><th>PDB</th><th>Populasi</th><th>Kemakmuran</th><th>Kepuasan</th><th>Pertumbuhan</th><th>Kas</th><th>Korupsi</th></tr>${list.map((c, i) => `<tr class="click" data-act="pick" data-code="${c.code}"><td>${i + 1}</td><td>${flagName(c)} ${c.playerPres ? '<span class="tag g">Pemain</span>' : ''}</td><td><b>${c.score}</b></td><td>${usd(c.gdp)}</td><td>${compact(c.pop)}</td><td>${fmt(c.prosperity)}</td><td>${c.approval}%</td><td class="${c.growth >= 0 ? 'up' : 'down'}">${fmt(c.growth, 1)}%</td><td>${usd(c.treasury)}</td><td>${fmt(c.corruption)}</td></tr>`).join('')}</table></div>` : empty('search-x', 'Tidak ada negara yang cocok.')}`);
}

// ================= BERITA =================
function news() {
  const f = S.filters, scope = f.newsScope || 'all', list = S.newsList ?? null;
  return `<div class="banner">${ic('info')}<div>Seluruh berita di halaman ini dihasilkan otomatis oleh simulasi dan merupakan <b>bagian dari permainan</b>, bukan peristiwa nyata.</div></div>
  <div class="row wrap between"><div class="tabs"><button class="${scope === 'all' ? 'on' : ''}" data-act="newsScope" data-v="all">${ic('globe')} Semua berita</button><button class="${scope === 'sel' ? 'on' : ''}" data-act="newsScope" data-v="sel">${ic('map-pin')} ${esc(cty(S.sel)?.name || 'Negara')}</button></div></div>
  ${list === null ? skel() : list.length ? `<div class="stack">${list.map(n => { const x = n.country && cty(n.country); return `<div class="card"><div class="row wrap between"><b>${x ? x.flag + ' ' : ic('globe') + ' '}${esc(n.title)}</b><span class="tag ${{ konflik: 'r', pemilu: 'b', admin: 'y', pengumuman: 'y', bencana: 'r', bantuan: 'g', perdagangan: 'a' }[n.kind] || ''}">${esc(n.kind)}</span></div>${n.body ? `<p style="margin:6px 0;color:#c3d6df">${esc(n.body)}</p>` : ''}<div class="sub">${ic('newspaper')} ${esc(n.source)} · Tahun simulasi ${n.year} · ${when(n.ts)} (${ago(n.ts)})</div></div>`; }).join('')}</div><button class="btn" data-act="moreNews">${ic('chevrons-down')} Muat lebih banyak</button>` : empty('newspaper', 'Belum ada berita.')}`;
}

// ================= ADMIN UN =================
function admin() {
  if (!S.me.admin) return `<div class="empty">${ic('shield-alert')}<div>Panel ini khusus owner/admin UN yang berwenang.</div></div>`;
  const c = cty(S.sel), all = [...S.countries.values()].sort((a, b) => a.name.localeCompare(b.name, 'id')), co = options(all.map(x => [x.code, `${x.flag} ${x.name}`]), S.sel);
  const F = (id, label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;
  return `<div class="banner">${ic('shield')}<div>Panel admin UN — semua perubahan penting dicatat di berita. Negara terpilih: <b>${c ? flagName(c) : '-'}</b></div></div>
  <div class="grid g2">
  ${card('Indikator Negara', 'sliders-vertical', F('adC', 'Negara', `<select id="adC">${co}</select>`) + F('adF', 'Indikator', `<select id="adF">${options([['gdp', 'PDB (miliar USD)'], ['growth', 'Pertumbuhan %'], ['infl', 'Inflasi %'], ['unemp', 'Pengangguran %'], ['debt', 'Utang (miliar USD)'], ['treasury', 'Kas (miliar USD)'], ['pop', 'Populasi'], ['approval', 'Kepuasan'], ['corruption', 'Korupsi'], ['prosperity', 'Kemakmuran'], ['stability', 'Stabilitas'], ['invest', 'Investasi'], ['trust', 'Kepercayaan'], ['readiness', 'Kesiapan pertahanan']])}</select>`) + F('adV', 'Nilai', '<input type="number" id="adV" step="any">') + `<button class="btn pri" data-act="adIndicator">${ic('save')} Simpan</button>`)}
  ${card('Mata Uang', 'banknote', F('cuC', 'Negara', `<select id="cuC">${co}</select>`) + `<div class="grid g3" style="gap:8px">${F('cuCode', 'Kode', '<input type="text" id="cuCode" maxlength="5" placeholder="IDR">')}${F('cuSym', 'Simbol', '<input type="text" id="cuSym" maxlength="5" placeholder="Rp">')}${F('cuFx', 'Kurs per USD', '<input type="number" id="cuFx" step="any">')}</div><button class="btn pri" data-act="adCurrency">${ic('save')} Simpan</button>`)}
  ${card('Keanggotaan Aliansi', 'network', F('alC', 'Negara', `<select id="alC">${co}</select>`) + F('alA', 'Aliansi', `<select id="alA">${options(Object.keys(ALLIANCES).filter(k => k !== 'UN').map(k => [k, k]))}</select>`) + `<div class="row"><button class="btn pri" data-act="adAlliance" data-v="1">${ic('plus')} Tambahkan</button><button class="btn red" data-act="adAlliance" data-v="0">${ic('minus')} Cabut</button></div><div class="sub" style="margin-top:6px">UN wajib bagi semua negara dan tidak dapat dicabut.</div>`)}
  ${card('Bantuan UN (dana tak terbatas)', 'life-buoy', F('aiC', 'Penerima', `<select id="aiC">${co}</select>`) + F('aiA', 'Jumlah (miliar USD)', '<input type="number" id="aiA" min="0.01" step="0.01" value="5">') + F('aiN', 'Catatan', '<input type="text" id="aiN" maxlength="140">') + `<button class="btn pri" data-act="adAid">${ic('send')} Kirim Bantuan</button>`)}
  ${card('Kepresidenan', 'crown', F('lkC', 'Negara', `<select id="lkC">${co}</select>`) + `<div class="row wrap"><button class="btn" data-act="adLock" data-v="1">${ic('lock')} Kunci klaim</button><button class="btn" data-act="adLock" data-v="0">${ic('lock-open')} Buka kunci</button><button class="btn red" data-act="adRelease">${ic('user-x')} Lepas presiden pemain</button></div>`)}
  ${card('Waktu Dunia', 'hourglass', `<div class="row wrap"><span class="tag ${S.world.paused ? 'r' : 'g'}">${S.world.paused ? 'Dihentikan' : 'Berjalan'}</span><b>Tahun ${S.world.year}</b></div><div class="field" style="margin-top:10px"><label>Atur tahun</label><div class="row"><input type="number" id="yrV" value="${S.world.year}"><button class="btn" data-act="adYear">${ic('calendar-cog')} Atur</button></div></div><div class="row wrap"><button class="btn" data-act="adPause" data-v="${S.world.paused ? 0 : 1}">${ic(S.world.paused ? 'play' : 'pause')} ${S.world.paused ? 'Lanjutkan waktu' : 'Hentikan waktu'}</button><button class="btn pri" data-act="advance">${ic('fast-forward')} Majukan paksa (admin)</button><button class="btn red" data-act="adReset">${ic('rotate-ccw')} Reset dunia ke 1980</button></div>`)}
  ${card('Peta & Pengumuman', 'megaphone', F('mbT', 'Token publik Mapbox (pk.…)', `<div class="row"><input type="text" id="mbT" placeholder="kosong = OpenStreetMap"><button class="btn" data-act="adMapbox">${ic('map')} Simpan</button></div>`) + F('anT', 'Pengumuman (maks 300 karakter)', `<textarea id="anT" maxlength="300">${esc(S.world.announcement || '')}</textarea>`) + `<button class="btn pri" data-act="adAnnounce">${ic('megaphone')} Terbitkan</button>`)}
  </div>
  ${card('Moderasi Konten', 'shield-alert', '<div id="modBox">' + skel() + '</div>')}`;
}
admin.after = async () => { if (!S.me.admin || !$('#modBox')) return; try { const r = await api('admin_moderation', {}, { quiet: true }); const row = (t, x) => `<div class="item row wrap between"><div><b>${esc(x.author)}</b> <span class="tag">${t === 'post' ? x.role : 'petisi'}</span> <span class="sub">${x.country} · #${x.id} · ${ago(x.ts)}</span><p>${esc(x.title ? x.title + ' — ' : '')}${esc(x.body)}</p></div><button class="btn sm ${x.hidden ? '' : 'red'}" data-act="adModerate" data-t="${t}" data-id="${x.id}" data-h="${x.hidden ? 0 : 1}">${ic(x.hidden ? 'eye' : 'eye-off')} ${x.hidden ? 'Pulihkan' : 'Sembunyikan'}</button></div>`; $('#modBox').innerHTML = `<div class="stack scroll" style="max-height:420px">${r.posts.map(x => row('post', x)).join('')}${r.petitions.map(x => row('petition', x)).join('') || ''}${!r.posts.length && !r.petitions.length ? empty('shield-check', 'Tidak ada konten.') : ''}</div>`; refreshIcons(); } catch (e) { $('#modBox').innerHTML = empty('circle-alert', 'Gagal memuat.'); } };

export const PAGES = {
  dash: { t: 'Dasbor', i: 'layout-dashboard', r: dash, live: true }, map: { t: 'Peta Dunia', i: 'map', r: mapPage }, land: { t: 'Negara 3D', i: 'mountain', r: landPage }, policy: { t: 'Kebijakan Ekonomi', i: 'sliders-horizontal', r: policy }, trade: { t: 'Perdagangan', i: 'handshake', r: trade },
  treasury: { t: 'Kas & Transfer', i: 'vault', r: treasury }, politics: { t: 'Politik & Kabinet', i: 'landmark', r: politics }, gov: { t: 'Pemerintahan', i: 'scale', r: gov }, pop: { t: 'Kependudukan', i: 'users', r: pop },
  diplo: { t: 'Diplomasi & Pertahanan', i: 'shield', r: diplo }, civic: { t: 'Warga', i: 'megaphone', r: civic }, social: { t: 'Sosial', i: 'messages-square', r: social }, elections: { t: 'Pemilu', i: 'vote', r: elections },
  report: { t: 'Laporan Tahun', i: 'newspaper', r: report }, leader: { t: 'Leaderboard', i: 'trophy', r: leader, live: true }, news: { t: 'Berita', i: 'rss', r: news, live: true }, admin: { t: 'Admin UN', i: 'shield-alert', r: admin, admin: true },
};
Object.values(PAGES).forEach((p, i) => { const k = Object.keys(PAGES)[i]; const fn = { dash, map: mapPage, land: landPage, policy, trade, treasury, politics, gov, pop, diplo, civic, social, elections, report, leader, news, admin }[k]; if (fn.after) p.after = fn.after; });
export const mapMetrics = METRICS; export { convPreview };
