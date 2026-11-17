// country.7mit — halaman awal (pilih negara, peran, pengaturan akun) ala /classic
import { S, $, $$, esc, ic, usd, fmt, cty, toast, modal, closeModal, api, act, refreshIcons, REGION_ID } from './core.js';
import { Globe } from './globe.js';

let G = null, cur = null, filt = 'all', q = '';
export function stopStart() { if (G) { G.dispose(); G = null; } }
const hasPres = (c) => !!c.playerPres;

export function showStart(app, h) {
  stopStart(); document.title = 'Mulai — country.7mit';
  const u = S.user?.user_metadata || {}, nm = S.me?.name || u.full_name || 'Warga', av = u.avatar_url || u.picture;
  cur = cur && S.countries.get(cur) ? cur : (S.me?.president || S.me?.citizenship || 'ID'); if (!S.countries.get(cur)) cur = [...S.countries.keys()][0];
  const regs = [...new Set([...S.countries.values()].map(c => c.region))];
  app.innerHTML = `<div class="start"><div class="stbar"><div class="brand"><div class="logo"><span class="wordmark" style="font-size:20px">7</span></div><span class="wordmark">country<b>.7mit</b></span></div><div class="grow"></div>
   <button class="btn" id="stAcc">${av ? `<img src="${esc(av)}" alt="" referrerpolicy="no-referrer" style="width:22px;height:22px;border-radius:50%">` : ic('circle-user-round')} <span>${esc(nm)}</span></button>
   ${S.me?.president || S.me?.citizenship ? `<button class="btn pri" id="stBack">${ic('play')} Lanjutkan</button>` : ''}</div>
  <div class="stgrid"><div class="stglobe" id="stGlobe"></div>
   <div class="stpanel"><div class="card" id="stInfo"></div>
    <div class="card"><div class="row" style="gap:6px;margin-bottom:8px"><div class="search" style="flex:1">${ic('search')}<input id="stQ" type="search" placeholder="Cari negara…" value="${esc(q)}" autocomplete="off"></div>
     <select id="stReg"><option value="all">Semua kawasan</option>${regs.map(r => `<option value="${esc(r)}" ${filt === r ? 'selected' : ''}>${esc(REGION_ID[r] || r)}</option>`).join('')}</select></div>
     <div class="stlist" id="stList"></div></div></div></div></div>`;
  const list = () => [...S.countries.values()].filter(c => (filt === 'all' || c.region === filt) && (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase() === q.toLowerCase())).sort((a, b) => b.gdp - a.gdp);
  const drawList = () => { const L = list().slice(0, 80); $('#stList').innerHTML = L.length ? L.map(c => `<button data-c="${c.code}" class="${c.code === cur ? 'on' : ''}"><span style="font-size:20px">${c.flag}</span><span class="grow">${esc(c.name)}</span><span class="sub">${esc(hasPres(c) ? c.president : 'NPC (kosong)')}</span></button>`).join('') : `<div class="sub" style="padding:10px">Tidak ditemukan.</div>`; $$('#stList [data-c]').forEach(b => b.onclick = () => choose(b.dataset.c, true)); };
  const info = () => { const c = cty(cur); if (!c) return; const mine = S.me?.president === cur, cit = S.me?.citizenship === cur, taken = (hasPres(c) || c.locked) && !mine;
    $('#stInfo').innerHTML = `<div class="row" style="gap:12px"><span style="font-size:44px">${c.flag}</span><div><h2 style="margin:0">${esc(c.name)}</h2><div class="sub">${esc(REGION_ID[c.region] || c.region)} · zona waktu UTC${c.tz >= 0 ? '+' : ''}${c.tz}</div></div></div>
     <div class="grid g2" style="margin:12px 0"><div class="item"><div class="sub">Penduduk</div><b>${fmt(c.pop)}</b></div><div class="item"><div class="sub">PDB</div><b>${usd(c.gdp)}</b></div><div class="item"><div class="sub">Pertumbuhan</div><b>${fmt(c.growth, 1)}%</b></div><div class="item"><div class="sub">Presiden</div><b>${esc(hasPres(c) ? c.president : 'NPC (kosong)')}</b></div></div>
     <div class="row wrap" style="gap:8px"><button class="btn pri" id="stPres" ${taken ? 'disabled' : ''}>${ic('crown')} ${mine ? 'Lanjutkan sebagai Presiden' : taken ? (c.locked ? 'Dikunci admin UN' : 'Sudah ada presiden pemain') : 'Jadi Presiden'}</button><button class="btn" id="stCit" ${cit ? 'disabled' : ''}>${ic('id-card')} ${cit ? 'Anda warga negara ini' : 'Daftar sebagai warga'}</button><button class="btn" id="stView">${ic('eye')} Jelajah</button></div>
     <div class="sub" style="margin-top:8px">Semua angka dan peristiwa adalah data permainan. Jabatan presiden terikat pada tab ini.</div>`; refreshIcons();
    $('#stPres').onclick = (e) => { if (mine) { S.sel = cur; h.enter(); return; } act(e.currentTarget, 'claim', { code: cur }, () => `Anda kini Presiden ${c.name}`, async () => { S.sel = cur; await h.refresh(); h.enter(); }); };
    $('#stCit').onclick = (e) => act(e.currentTarget, 'become_citizen', { code: cur }, `Anda kini warga ${c.name}`, async () => { S.sel = cur; await h.refresh(); h.enter(); });
    $('#stView').onclick = () => { S.sel = cur; h.enter(); }; };
  const choose = (code, focus) => { cur = code; S.sel = code; info(); drawList(); if (G) { G.setSelected(code); if (focus) G.focus(code, 12); } };
  drawList(); info(); refreshIcons();
  try { G = new Globe($('#stGlobe'), { onPick: (c) => choose(c, false), onHover: () => {}, colorOf: (c) => hasPres(c) ? 0xffd166 : 0xf2f2f2, sizeOf: (c) => .028 + Math.min(.04, Math.log10(c.gdp + 1) * .01) }); G.setCountries([...S.countries.values()]); G.setSelected(cur); G.focus(cur, 14); } catch (e) { $('#stGlobe').innerHTML = `<div class="empty">${ic('globe')}<div>Globe 3D tidak tersedia; pilih negara dari daftar.</div></div>`; refreshIcons(); }
  $('#stQ').oninput = (e) => { q = e.target.value; drawList(); }; $('#stReg').onchange = (e) => { filt = e.target.value; drawList(); };
  $('#stBack')?.addEventListener('click', () => h.enter()); $('#stAcc').onclick = () => accountModal(h);
}

export function accountModal(h) {
  const u = S.user?.user_metadata || {}, me = S.me || {}, av = u.avatar_url || u.picture;
  modal({ title: 'Pengaturan Akun', icon: 'circle-user-round', body: `<div class="row" style="gap:12px;margin-bottom:12px">${av ? `<img src="${esc(av)}" alt="" referrerpolicy="no-referrer" style="width:52px;height:52px;border-radius:50%">` : ''}<div><b>${esc(me.name || '')}</b><div class="sub">${esc(S.user?.email || '')}</div><div class="sub">${me.president ? 'Presiden ' + esc(cty(me.president)?.name || me.president) : me.citizenship ? 'Warga ' + esc(cty(me.citizenship)?.name || me.citizenship) : 'Belum memilih peran'}${me.admin ? ' · Admin UN' : ''}</div></div></div>
   <label class="sub">Nama tampilan (2–40 karakter)</label><input id="acName" maxlength="40" value="${esc(me.name || '')}" style="width:100%;margin:4px 0 12px">
   <div class="row wrap" style="gap:8px">${me.citizenship && !me.president ? `<button class="btn sm red" id="acLeave">${ic('user-minus')} Lepas kewarganegaraan</button>` : ''}${me.president ? `<button class="btn sm red" id="acRes">${ic('crown')} Lepas jabatan presiden</button>` : ''}<button class="btn sm" id="acStart">${ic('house')} Ke halaman awal</button><button class="btn sm red" id="acOut">${ic('log-out')} Keluar</button></div>`,
    actions: [{ label: 'Simpan nama', icon: 'save', cls: 'pri', keep: true, fn: async () => { const name = $('#acName').value.trim(); try { await api('set_profile', { name }); toast('Nama diperbarui', 'ok'); await h.refresh(); } catch (e) {} } }, { label: 'Tutup' }] });
  setTimeout(() => {
    $('#acLeave')?.addEventListener('click', () => act(null, 'leave_citizenship', {}, 'Kewarganegaraan dilepas', async () => { await h.refresh(); closeModal(); h.start(); }));
    $('#acRes')?.addEventListener('click', () => act(null, 'release', {}, 'Jabatan dilepas', async () => { await h.refresh(); closeModal(); h.start(); }));
    $('#acStart')?.addEventListener('click', () => { closeModal(); h.start(); }); $('#acOut')?.addEventListener('click', () => h.logout()); }, 0);
}
