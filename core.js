// Country Manager — inti: klien Supabase, state, API, utilitas UI
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const SB_URL = 'https://lajzrempjyoqkubkumhb.supabase.co';
export const SB_KEY = 'sb_publishable_yGZ90Bkv3yreqc9pA55bpw_YKKBhWRw';
export const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
export const SESSION = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) + '-' + Date.now(); // hanya di memori: klaim presiden terikat sesi halaman ini

export const S = {
  user: null, token: null, me: null, world: { year: 1980, paused: false, announcement: '', mapbox: '' }, countries: new Map(), since: null, newsSince: 0,
  page: 'dash', sel: null, D: null, detailAt: 0, visitors: 0, pending: 0, notifs: [], online: false, lastSync: 0, rt: false, syncing: false,
  metric: 'gdp', elections: [], loading: {}, filters: {}, tutorialSeen: false, lastAnn: '',
};

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ic = (n, cls = '') => `<i data-lucide="${n}" class="${cls}"></i>`;
export const fmt = (n, d = 0) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
export const compact = (n) => { const a = Math.abs(n); if (a >= 1e15) return fmt(n / 1e15, 2) + ' kuadriliun'; if (a >= 1e12) return fmt(n / 1e12, 2) + ' T'; if (a >= 1e9) return fmt(n / 1e9, 2) + ' M'; if (a >= 1e6) return fmt(n / 1e6, 2) + ' jt'; if (a >= 1e3) return fmt(n / 1e3, 1) + ' rb'; return fmt(n, 2); };
export const usd = (b) => { const a = Math.abs(b); return `${b < 0 ? '-' : ''}$${a >= 1000 ? fmt(a / 1000, 2) + ' T' : fmt(a, 2) + ' M'}`; };
export const loc = (b, c) => `${c.sym} ${compact(b * 1e9 * c.fx)}`;
export const cty = (code) => S.countries.get(code);
export const ago = (ts) => { const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' mnt lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; return Math.floor(s / 86400) + ' hari lalu'; };
export const when = (ts) => new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
export const isPres = () => !!S.me?.president;
export const myCode = () => S.me?.president || S.me?.citizenship || null;

export function toast(msg, kind = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + kind;
  t.innerHTML = `${ic(kind === 'err' ? 'circle-alert' : kind === 'warn' ? 'triangle-alert' : 'circle-check')}<div>${esc(msg)}</div>`;
  $('#toasts').appendChild(t); refreshIcons(); setTimeout(() => { t.style.opacity = 0; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, kind === 'err' ? 6000 : 3800);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
export function refreshIcons() { try { window.lucide && window.lucide.createIcons(); } catch (e) {} }
export function modal({ title, icon, body = '', actions = [], wide }) {
  const m = $('#modal'); m.classList.remove('hidden');
  m.innerHTML = `<div class="m" role="dialog" aria-modal="true" ${wide ? 'style="width:min(820px,100%)"' : ''}><h2>${icon ? ic(icon) : ''}${esc(title)}</h2><div class="body">${body}</div><div class="row wrap" id="macts"></div></div>`;
  const box = $('#macts', m);
  actions.forEach(a => { const b = document.createElement('button'); b.className = 'btn ' + (a.cls || ''); b.innerHTML = (a.icon ? ic(a.icon) : '') + esc(a.label); b.onclick = async () => { if (a.keep) { await a.fn?.(b); } else { closeModal(); await a.fn?.(); } }; box.appendChild(b); });
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  refreshIcons();
}
export function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }

// ---------- API ----------
const PROXY = new Set(['propose_trade', 'propose_peace', 'set_policy', 'propose_law', 'repeal_law', 'motion']); // keputusan NPC/parlemen dipertajam Gemini lewat cm-npc
const GOV = new Set(['law_templates', 'law_draft', 'gov_state', 'office_apply', 'office_decide', 'office_resign', 'office_dismiss', 'proposal_create', 'proposal_decide', 'law_propose', 'law_repeal', 'law_mp', 'court_review', 'prosecute', 'bank_rate', 'war_turn', 'leg_register', 'leg_withdraw', 'leg_vote', 'leg_call', 'succeed']); // jabatan, RUU custom, perang NPC (cm-gov)
const PRES = new Set(['pres_state', 'coalition_set', 'parliament_dissolve', 'decree', 'appoint_direct', 'amnesty']); // Pusat Pemerintahan (cm-pres)
const EXTRA = new Set(['set_profile', 'builds', 'build_place', 'road_place', 'build_remove', 'build_kinds', 'comments', 'comment_create', 'comment_delete', 'comment_hide']);
export async function api(action, body = {}, { quiet = false, keepalive = false } = {}) {
  const { data: ses } = await sb.auth.getSession();
  const token = ses?.session?.access_token; if (!token) throw new Error('Sesi login berakhir. Silakan masuk lagi.');
  let res;
  try {
    const viaNpc = PROXY.has(action), fnName = viaNpc ? 'cm-npc' : PRES.has(action) ? 'cm-pres' : GOV.has(action) ? 'cm-gov' : EXTRA.has(action) ? 'cm-extra' : 'cm-api', payload = viaNpc ? { action: 'proxy', inner: action, session: SESSION, ...body } : { action, session: SESSION, ...body }, hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: SB_KEY };
    try { res = await fetch(`${SB_URL}/functions/v1/${fnName}`, { method: 'POST', keepalive, headers: hdr, body: JSON.stringify(payload) }); }
    catch (e) { if (!viaNpc) throw e; res = await fetch(`${SB_URL}/functions/v1/cm-api`, { method: 'POST', keepalive, headers: hdr, body: JSON.stringify({ action, session: SESSION, ...body }) }); }
  } catch (e) { S.online = false; throw new Error('Tidak dapat terhubung ke server'); }
  let j = null; try { j = await res.json(); } catch (e) {}
  if (!res.ok || !j?.ok) { const msg = j?.error || j?.message || `Kesalahan server (${res.status})`; if (res.status === 401) { S.online = false; } if (!quiet) toast(msg, 'err'); const err = new Error(msg); err.status = res.status; err.handled = !quiet; throw err; }
  return j.data;
}
// aksi pemain: menampilkan status memuat pada tombol, hasil sukses/gagal lewat toast
export async function act(btn, action, body, okMsg, after) {
  const orig = btn?.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = `${ic('loader-circle', 'spin')} Memproses…`; refreshIcons(); }
  try { const r = await api(action, body); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok'); await (after ? after(r) : Promise.resolve()); return r; }
  catch (e) { return null; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = orig; refreshIcons(); } }
}

// ---------- animasi angka ----------
const prevNum = new Map();
export function animateNumbers(root = document) {
  $$('[data-count]', root).forEach(el => {
    const to = parseFloat(el.dataset.count), id = el.dataset.cid || el.id || null, from = id && prevNum.has(id) ? prevNum.get(id) : 0, d = parseInt(el.dataset.d || '0'), kind = el.dataset.kind || 'n';
    if (id) prevNum.set(id, to); const t0 = performance.now(), dur = 700;
    const f = (v) => kind === 'usd' ? usd(v) : kind === 'pct' ? fmt(v, d) + '%' : kind === 'compact' ? compact(v) : fmt(v, d);
    if (from === to || !isFinite(to)) { el.textContent = f(to); return; }
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
  });
}
export function num(id, v, kind = 'n', d = 0) { return `<span data-count="${v}" data-cid="${id}" data-kind="${kind}" data-d="${d}">${kind === 'usd' ? usd(v) : fmt(v, d)}</span>`; }

export function lineChart(canvas, series, { color = '#e9b8a0', label = '' } = {}) {
  if (!canvas) return; const dpr = Math.min(2, devicePixelRatio || 1), W = canvas.clientWidth, H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  if (!series.length) return;
  const xs = series.map(p => p[0]), ys = series.map(p => p[1]), mn = Math.min(...ys), mx = Math.max(...ys), rg = (mx - mn) || 1, pl = 48, pb = 22, pt = 10, pr = 10;
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#8ba3b3'; g.font = '11px sans-serif'; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pt + (H - pt - pb) * i / 4; g.beginPath(); g.moveTo(pl, y); g.lineTo(W - pr, y); g.stroke(); g.fillText(compact((mx - rg * i / 4) * 1e9).replace(' ', ''), 4, y + 4); }
  const X = (i) => pl + (W - pl - pr) * (series.length === 1 ? 0.5 : i / (series.length - 1)), Y = (v) => pt + (H - pt - pb) * (1 - (v - mn) / rg);
  const gr = g.createLinearGradient(0, pt, 0, H - pb); gr.addColorStop(0, color + '55'); gr.addColorStop(1, color + '00');
  g.beginPath(); series.forEach((p, i) => i ? g.lineTo(X(i), Y(p[1])) : g.moveTo(X(i), Y(p[1]))); g.strokeStyle = color; g.lineWidth = 2.5; g.stroke();
  g.lineTo(X(series.length - 1), H - pb); g.lineTo(X(0), H - pb); g.fillStyle = gr; g.fill();
  g.fillStyle = '#8ba3b3'; const step = Math.max(1, Math.ceil(series.length / 8)); series.forEach((p, i) => { if (i % step === 0 || i === series.length - 1) g.fillText(String(xs[i]), X(i) - 12, H - 6); });
  g.fillStyle = color; series.forEach((p, i) => { if (series.length < 30 || i === series.length - 1) { g.beginPath(); g.arc(X(i), Y(p[1]), 3, 0, 7); g.fill(); } });
}

export const REGION_ID = { Africa: 'Afrika', Americas: 'Amerika', Asia: 'Asia', Europe: 'Eropa', Oceania: 'Oseania' };
export const SECTOR_ID = { manufaktur: 'Manufaktur', energi: 'Energi', pertanian: 'Pertanian', teknologi: 'Teknologi', jasa: 'Jasa' };
export const ALLIANCES = {
  UN: ['Perserikatan Bangsa-Bangsa', 'Wajib bagi semua negara', 'Stabilitas +1, investasi +0,5 / tahun'],
  ASEAN: ['ASEAN', 'Hanya negara Asia Tenggara', 'Pertumbuhan +0,4 pt, investasi +1'],
  EU: ['Uni Eropa', 'Negara Eropa, korupsi < 60, bukan Komunisme', 'Pertumbuhan +0,5 pt, stabilitas +1,5'],
  NATO: ['NATO', 'Eropa/Amerika Utara, stabilitas ≥ 50, kesiapan ≥ 40', 'Kesiapan +6, stabilitas +1'],
  AU: ['Uni Afrika', 'Hanya negara Afrika', 'Pertumbuhan +0,3 pt, stabilitas +0,8'],
  G20: ['G20', '25 PDB terbesar dunia', 'Investasi +1,5, pertumbuhan +0,2 pt'],
  BRICS: ['BRICS', '40 PDB terbesar, bukan anggota NATO/EU', 'Pertumbuhan +0,5 pt, kurs lebih stabil'],
  OPEC: ['OPEC', 'Hanya produsen minyak', 'Pendapatan energi +20%'],
};
export const LAWS = {
  uu_kpk: ['UU Lembaga Antikorupsi', 'antikorupsi', 'Korupsi −3/thn, kepercayaan +1,5'], uu_transparansi: ['UU Keterbukaan Informasi', 'antikorupsi', 'Korupsi −1,5/thn, kepercayaan +2'], uu_whistle: ['UU Perlindungan Pelapor', 'antikorupsi', 'Korupsi −2/thn'],
  uu_investasi: ['UU Investasi & Cipta Kerja', 'ekonomi', 'Investasi +3, pertumbuhan +0,25 pt'], uu_insentif: ['UU Insentif Pajak Usaha', 'ekonomi', 'Investasi +2, pertumbuhan +0,3 pt'], uu_kek: ['UU Zona Ekonomi Khusus', 'ekonomi', 'Investasi +2, kemakmuran +0,5'],
  uu_jamsos: ['UU Jaminan Sosial', 'kesejahteraan', 'Kemakmuran +1,5, kepuasan +1'], uu_pensiun: ['UU Dana Pensiun', 'kesejahteraan', 'Kemakmuran +1, kepuasan +1'], uu_pangan: ['UU Ketahanan Pangan', 'kesejahteraan', 'Kemakmuran +1, stabilitas +1'],
};
export const MOTIONS = { transparansi: 'Mosi Transparansi', hak_warga: 'Mosi Hak Warga', layanan_publik: 'Mosi Layanan Publik', keamanan: 'Mosi Keamanan' };
export const MINISTRIES = { dalam: 'Menteri Dalam Negeri', luar: 'Menteri Luar Negeri', kesehatan: 'Menteri Kesehatan', pendidikan: 'Menteri Pendidikan' };
export const IDEOLOGIES = { pancasila: 'Pancasila', demokrasi: 'Demokrasi', komunisme: 'Komunisme' };
export const PARTY_COLORS = ['#2dd4bf', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa'];
