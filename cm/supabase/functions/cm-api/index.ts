// @ts-nocheck
// Country Manager — API dunia bersama (Supabase Edge Function). Semua aksi lewat sini:
// autentikasi Google (JWT Supabase), pemeriksaan hak akses, validasi, dan optimistic locking (kolom ver).
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as E from './engine.ts';

const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const PRES_TTL = 45_000, COOLDOWN = 45_000, SOURCES = ['Harian Dunia', 'Kantor Berita Global', 'Warta Ekonomi', 'Radio Nusantara', 'Pos Diplomatik', 'Kompas Simulasi'];
const pick = (a, R = Math.random) => a[Math.floor(R() * a.length)];
const num = (v, min, max, name) => { const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) bad(`${name} harus berupa angka ${min}–${max}`); return n; };
const txt = (v, max, name, min = 1) => { const s = String(v ?? '').trim(); if (s.length < min) bad(`${name} wajib diisi`); if (s.length > max) bad(`${name} maksimal ${max} karakter`); return s; };
const cc = (v) => { const s = String(v ?? '').toUpperCase(); if (!/^[A-Z]{2}$/.test(s)) bad('Kode negara tidak valid'); return s; };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };

// ---------- akses data ----------
async function world() { return must(await sb.from('cm_world').select('*').eq('id', 1).single()); }
async function getRow(code) { const r = must(await sb.from('cm_countries').select('*').eq('code', code).maybeSingle()); if (!r) bad('Negara tidak ditemukan', 404); return r; }
function slimOf(row, presName) { const s = E.slim(row.data, presName ? { name: presName } : null); return s; }
async function save(row, data, extra = {}) {
  const slim = { ...E.slim(data, row.slim?.playerPres ? { name: row.slim.president } : null), ...(extra.slim || {}) };
  const { data: u, error } = await sb.from('cm_countries').update({ data, slim, ver: row.ver + 1, updated_at: new Date().toISOString(), ...(extra.cols || {}) }).eq('code', row.code).eq('ver', row.ver).select('code');
  if (error) throw new ApiError(error.message, 500);
  return u.length === 1;
}
// Pembaruan aman terhadap proses bersamaan: baca → ubah → simpan bila ver sama, ulangi jika bentrok
async function mutate(code, fn, extraFn) {
  for (let i = 0; i < 8; i++) {
    const row = await getRow(code); const data = structuredClone(row.data);
    const out = await fn(data, row);
    if (await save(row, data, extraFn ? extraFn(data, row) : {})) return out;
    await new Promise(r => setTimeout(r, 30 + Math.random() * 60 * (i + 1)));
  }
  bad('Data sedang diperbarui pemain lain, coba lagi', 409);
}
async function addNews(year, country, kind, title, body = '', source) { await sb.from('cm_news').insert({ year, country, kind, title, body, source: source || pick(SOURCES) }); }
const nowIso = () => new Date().toISOString();

// ---------- inisialisasi dunia ----------
async function ensureSeed(force = false) {
  const { count } = await sb.from('cm_countries').select('code', { count: 'exact', head: true });
  if (count && !force) return;
  const rows = E.allSeed().map(c => ({ code: c.code, data: c, slim: E.slim(c, null), ver: 0, updated_at: nowIso(), president_uid: null, president_session: null, locked: false }));
  for (let i = 0; i < rows.length; i += 60) must(await sb.from('cm_countries').upsert(rows.slice(i, i + 60)));
  if (!count) await addNews(E.START_YEAR, null, 'dunia', 'Dunia Country Manager dimulai tahun 1980', 'Seluruh negara kini dikelola NPC. Pemain dapat mengklaim kursi kepresidenan atau mendaftar sebagai warga. Seluruh berita adalah bagian dari simulasi.', 'Kantor Berita Global');
}

// ---------- pengguna ----------
async function authUser(req) {
  const tok = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!tok) bad('Silakan masuk terlebih dahulu', 401);
  const { data, error } = await sb.auth.getUser(tok);
  if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401);
  const u = data.user, md = u.user_metadata || {};
  return { id: u.id, email: (u.email || '').toLowerCase(), name: String(md.full_name || md.name || (u.email || 'Warga').split('@')[0]).slice(0, 40), avatar: md.avatar_url || md.picture || null };
}
async function isAdmin(u) { const r = must(await sb.from('cm_admins').select('email').eq('email', u.email).maybeSingle()); return !!r; }
async function profile(u) {
  let p = must(await sb.from('cm_profiles').select('*').eq('uid', u.id).maybeSingle());
  if (!p) p = must(await sb.from('cm_profiles').insert({ uid: u.id, name: u.name, avatar: u.avatar }).select().single());
  if (p.banned) bad('Akun Anda dibatasi oleh admin UN', 403);
  return p;
}
function validPres(row) { return row.president_uid && row.president_seen && Date.now() - new Date(row.president_seen).getTime() < PRES_TTL; }
async function myPresRow(u, session) {
  if (!session) return null;
  const r = must(await sb.from('cm_countries').select('*').eq('president_uid', u.id).eq('president_session', session).maybeSingle());
  return r && validPres(r) ? r : null;
}
async function needPres(u, session, code) {
  const r = await myPresRow(u, session); if (!r) bad('Anda bukan presiden dalam sesi ini. Klaim kepresidenan terlebih dahulu.', 403);
  if (code && r.code !== code) bad('Anda hanya dapat bertindak untuk negara yang Anda pimpin', 403);
  return r;
}
const needCitizen = async (p, code) => { if (p.citizenship !== code) bad('Hanya warga negara ini yang dapat melakukan aksi tersebut', 403); };

// ---------- pembantu perdagangan & kurs ----------
const toLocal = (usd, c) => usd * c.fx;
const fromLocal = (v, c) => v / c.fx;

// ============ AKSI ============
const A = {};

A.sync = async ({ u, p, body }) => {
  await ensureSeed();
  const w0 = await world();
  const since = body.since || '1970-01-01T00:00:00Z';
  await sb.from('cm_profiles').update({ last_seen: nowIso(), name: u.name, avatar: u.avatar }).eq('uid', u.id);
  const mine = body.session ? await sb.from('cm_countries').select('code,president_uid,president_session').eq('president_uid', u.id).maybeSingle() : { data: null };
  if (mine.data && mine.data.president_session === body.session) await sb.from('cm_countries').update({ president_seen: nowIso() }).eq('code', mine.data.code).eq('president_session', body.session);
  // lepas presiden yang sesinya berakhir (tab ditutup / muat ulang)
  const stale = must(await sb.from('cm_countries').select('code,slim').not('president_uid', 'is', null).lt('president_seen', new Date(Date.now() - PRES_TTL).toISOString()));
  for (const s of stale) { await releasePresident(s.code, 'sesi berakhir'); }
  await popTick(w0);
  const rows = must(await sb.from('cm_countries').select('code,slim,updated_at,locked,president_uid').gt('updated_at', since));
  const w = await world();
  const visitors = (await sb.from('cm_profiles').select('uid', { count: 'exact', head: true }).gt('last_seen', new Date(Date.now() - 30_000).toISOString())).count || 0;
  const meNow = await sb.from('cm_countries').select('code').eq('president_uid', u.id).eq('president_session', body.session || '-').maybeSingle();
  const admin = await isAdmin(u);
  let pending = 0, newsNew = [];
  if (meNow.data) pending = (await sb.from('cm_offers').select('id', { count: 'exact', head: true }).eq('to_c', meNow.data.code).eq('status', 'pending')).count || 0;
  const ns = must(await sb.from('cm_news').select('id,ts,year,country,source,kind,title').gt('id', body.newsSince || 0).order('id', { ascending: false }).limit(30));
  const lastNews = ns[0]?.id || body.newsSince || 0;
  const maxUpd = rows.reduce((a, r) => (r.updated_at > a ? r.updated_at : a), since);
  return {
    now: nowIso(), world: { year: w.year, paused: w.paused, announcement: w.announcement, mapbox: w.mapbox_token, lastAdvance: w.last_advance_at, cooldownMs: COOLDOWN, advancing: !!(w.advancing_until && new Date(w.advancing_until) > new Date()) },
    countries: rows.map(r => ({ ...r.slim, locked: r.locked, hasPres: !!r.president_uid })), since: maxUpd, full: !body.since,
    me: { uid: u.id, name: p.name, avatar: p.avatar, citizenship: p.citizenship, president: meNow.data?.code || null, admin }, visitors, pending, news: ns, lastNews,
  };
};
async function releasePresident(code, why) {
  const r = await getRow(code); if (!r.president_uid) return;
  const pf = must(await sb.from('cm_profiles').select('name').eq('uid', r.president_uid).maybeSingle());
  await sb.from('cm_countries').update({ president_uid: null, president_session: null, president_seen: null, slim: { ...r.slim, playerPres: false, president: r.data.gov.president }, updated_at: nowIso() }).eq('code', code).eq('president_uid', r.president_uid);
  const w = await world(); await addNews(w.year, code, 'politik', `${pf?.name || 'Presiden'} meninggalkan kursi kepresidenan ${r.data.name}`, `Kepresidenan dikembalikan kepada pemerintahan NPC (${why}).`);
}
async function popTick(w) {
  if (w.paused) return;
  if (w.last_pop_check && Date.now() - new Date(w.last_pop_check).getTime() < 30_000) return;
  const lease = await sb.from('cm_world').update({ last_pop_check: nowIso() }).eq('id', 1).eq('ver', w.ver).select('id');
  if (!lease.data?.length) return;
  await sb.from('cm_world').update({ ver: w.ver + 1 }).eq('id', 1);
  const list = must(await sb.from('cm_countries').select('code, lp:data->>lastPopDate, tz:data->>tz'));
  const todo = list.filter(r => (r.lp || '') !== E.localDate({ tz: Number(r.tz) }));
  for (let i = 0; i < todo.length; i += 20) await Promise.all(todo.slice(i, i + 20).map(r => mutate(r.code, (c) => {
    const today = E.localDate(c); if (c.lastPopDate === today) return;
    const days = c.lastPopDate ? Math.max(1, Math.min(30, Math.round((Date.parse(today) - Date.parse(c.lastPopDate)) / 864e5))) : 0;
    if (days) E.popDaily(c, days); c.lastPopDate = today;
  }).catch(() => null)));
}

A.get_country = async ({ u, p, body }) => {
  const code = cc(body.code), row = await getRow(code), d = row.data, w = await world();
  const [trades, transfers, news, posts, pets, elect, civic, vote, cit] = await Promise.all([
    sb.from('cm_offers').select('*').or(`from_c.eq.${code},to_c.eq.${code}`).order('id', { ascending: false }).limit(60),
    sb.from('cm_transfers').select('*').or(`from_c.eq.${code},to_c.eq.${code}`).order('id', { ascending: false }).limit(40),
    sb.from('cm_news').select('*').eq('country', code).order('id', { ascending: false }).limit(40),
    sb.from('cm_posts').select('*').eq('country', code).eq('hidden', false).order('id', { ascending: false }).limit(60),
    sb.from('cm_petitions').select('*').eq('country', code).eq('hidden', false).order('id', { ascending: false }).limit(40),
    sb.from('cm_elections').select('*').eq('country', code).order('year', { ascending: false }).limit(5),
    sb.from('cm_civic').select('kind').eq('uid', u.id).eq('year', w.year),
    sb.from('cm_votes').select('choice').eq('uid', u.id).eq('year', w.year).maybeSingle(),
    sb.from('cm_profiles').select('uid', { count: 'exact', head: true }).eq('citizenship', code),
  ]);
  const ids = (posts.data || []).map(x => x.id);
  const liked = ids.length ? (await sb.from('cm_post_likes').select('post_id').eq('uid', u.id).in('post_id', ids)).data?.map(x => x.post_id) || [] : [];
  const sup = (pets.data || []).length ? (await sb.from('cm_petition_supports').select('petition_id').eq('uid', u.id).in('petition_id', pets.data.map(x => x.id))).data?.map(x => x.petition_id) || [] : [];
  const presName = row.president_uid && validPres(row) ? row.slim?.president : d.gov.president;
  return { country: d, president: { name: presName, player: !!(row.president_uid && validPres(row)), mine: row.president_uid === u.id, claimedAt: row.president_seen }, locked: row.locked, citizens: cit.count || 0, trades: trades.data, transfers: transfers.data, news: news.data, posts: (posts.data || []).map(x => ({ ...x, liked: liked.includes(x.id) })), petitions: (pets.data || []).map(x => ({ ...x, supported: sup.includes(x.id) })), elections: elect.data, civicUsed: (civic.data || []).map(x => x.kind), voted: vote.data?.choice || null, year: w.year };
};

// ----- peran & kewarganegaraan -----
A.claim = async ({ u, p, body }) => {
  const code = cc(body.code), session = txt(body.session, 80, 'Sesi');
  if (await myPresRow(u, session)) bad('Anda sudah menjadi presiden negara lain dalam sesi ini');
  const old = must(await sb.from('cm_countries').select('code').eq('president_uid', u.id).maybeSingle()); if (old) await releasePresident(old.code, 'presiden pindah negara');
  const row = await getRow(code); if (row.locked) bad('Negara ini dikunci oleh admin UN', 403);
  if (validPres(row)) bad('Negara ini sudah dipimpin pemain lain', 409);
  const { data, error } = await sb.from('cm_countries').update({ president_uid: u.id, president_session: session, president_seen: nowIso(), slim: { ...row.slim, playerPres: true, president: p.name }, updated_at: nowIso() }).eq('code', code).eq('ver', row.ver).or(`president_uid.is.null,president_seen.lt.${new Date(Date.now() - PRES_TTL).toISOString()}`).select('code');
  if (error) throw new ApiError(error.message, 500); if (!data.length) bad('Negara baru saja diklaim pemain lain, coba lagi', 409);
  await sb.from('cm_profiles').update({ citizenship: code }).eq('uid', u.id);
  const w = await world(); await addNews(w.year, code, 'politik', `${p.name} dilantik sebagai Presiden ${row.data.name}`, 'Pemain mengambil alih pemerintahan dari NPC.');
  return { ok: true, code };
};
A.release = async ({ u, body }) => { const r = await myPresRow(u, body.session); if (!r) bad('Anda tidak sedang menjabat'); await releasePresident(r.code, 'mengundurkan diri'); return { ok: true }; };
A.become_citizen = async ({ u, p, body }) => {
  const code = cc(body.code); const row = await getRow(code);
  const mine = must(await sb.from('cm_countries').select('code,president_session').eq('president_uid', u.id).maybeSingle());
  if (mine && mine.code !== code) bad('Presiden tidak dapat menjadi warga negara lain. Lepaskan jabatan dahulu.');
  await sb.from('cm_profiles').update({ citizenship: code }).eq('uid', u.id);
  const w = await world(); await addNews(w.year, code, 'sosial', `${p.name} mendaftar sebagai warga ${row.data.name}`, '', 'Pos Diplomatik');
  return { ok: true };
};
A.leave_citizenship = async ({ u, body }) => {
  const mine = must(await sb.from('cm_countries').select('code').eq('president_uid', u.id).maybeSingle()); if (mine) bad('Lepaskan jabatan presiden terlebih dahulu');
  await sb.from('cm_profiles').update({ citizenship: null }).eq('uid', u.id); return { ok: true };
};

// ----- kebijakan -----
const POL_RANGE = { rate: [0, 50], taxInc: [0, 70], taxCorp: [0, 60], spend: [0, 40], infra: [0, 10], edu: [0, 10], welfare: [0, 15], tariff: [0, 80], defense: [0, 12], health: [0, 12], family: [0, 100], migration: [0, 100], fxIntervene: [-5, 5] };
A.set_policy = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(); let vote = null, taxNote = '';
  const patch = {}; for (const k in (body.policy || {})) { if (!POL_RANGE[k]) bad('Kebijakan tidak dikenal: ' + k); patch[k] = num(body.policy[k], POL_RANGE[k][0], POL_RANGE[k][1], k); }
  await mutate(pr.code, (c) => {
    const p = c.pol, tax = {}; for (const k of ['taxInc', 'taxCorp']) if (k in patch && Math.abs(patch[k] - p[k]) > 1e-9) tax[k] = patch[k];
    for (const k in patch) if (!(k in tax)) { if (k === 'fxIntervene') { if (c.used.intervene) bad('Intervensi cadangan hanya sekali per tahun simulasi'); c.used.intervene = 1; } p[k] = patch[k]; }
    if (Object.keys(tax).length) {
      const rise = Object.entries(tax).reduce((a, [k, v]) => a + Math.max(0, v - p[k]), 0), cut = Object.entries(tax).reduce((a, [k, v]) => a + Math.max(0, p[k] - v), 0);
      vote = E.parliamentVote(c, 'pajak', w.year, Date.now() % 997, { taxRise: rise, taxCut: cut });
      if (vote.passed) { Object.assign(p, tax); taxNote = 'Parlemen menyetujui perubahan pajak.'; } else taxNote = 'Parlemen MENOLAK perubahan pajak; tarif lama tetap berlaku.';
    }
  });
  if (vote) await addNews(w.year, pr.code, 'ekonomi', `Parlemen ${vote.passed ? 'setujui' : 'tolak'} usulan pajak ${pr.data.name}`, `Suara: ${vote.yes} setuju, ${vote.no} menolak, ${vote.abstain} abstain.`);
  return { ok: true, vote, note: taxNote };
};

// ----- perdagangan -----
const activeCount = async (code) => (await sb.from('cm_offers').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('kind', 'trade').or(`from_c.eq.${code},to_c.eq.${code}`)).count || 0;
A.propose_trade = async ({ u, body }) => {
  const pr = await needPres(u, body.session), to = cc(body.to), w = await world();
  if (to === pr.code) bad('Tidak dapat berdagang dengan negara sendiri');
  if (!E.SECTORS[body.sector]) bad('Sektor tidak valid');
  const maxV = pr.data.gdp * 0.05, value = num(body.value, 0.01, Math.max(0.05, maxV), `Nilai ekspor (maks ${maxV.toFixed(2)} miliar USD)`);
  const tariffTo = num(body.tariffTo ?? 10, 0, 80, 'Tarif impor mitra'), tariffFrom = num(body.tariffFrom ?? 10, 0, 80, 'Tarif impor Anda');
  const tr = await getRow(to);
  if (pr.data.war.includes(to)) bad('Tidak dapat berdagang dengan negara yang sedang berperang dengan Anda');
  if ((await activeCount(pr.code)) >= 12 || (await activeCount(to)) >= 12) bad('Batas 12 perjanjian aktif tercapai');
  const dup = must(await sb.from('cm_offers').select('id').eq('kind', 'trade').eq('from_c', pr.code).eq('to_c', to).eq('sector', body.sector).in('status', ['pending', 'active']).limit(1)); if (dup.length) bad('Sudah ada perjanjian/penawaran sektor ini dengan negara tersebut');
  const offer = must(await sb.from('cm_offers').insert({ kind: 'trade', from_c: pr.code, to_c: to, sector: body.sector, value, tariff_to: tariffTo, tariff_from: tariffFrom, status: 'pending', year: w.year, created_by: u.id }).select().single());
  await addNews(w.year, pr.code, 'perdagangan', `${pr.data.name} menawarkan perdagangan ${E.SECTORS[body.sector]} ke ${tr.data.name}`, `Nilai ekspor ${value.toFixed(2)} miliar USD/tahun, tarif impor ${tariffTo}%.`);
  if (validPres(tr)) return { ok: true, status: 'pending', note: 'Menunggu jawaban presiden pemain negara tujuan.', offer };
  const R = E.rng(`${offer.id}|${w.year}`); const acc = E.npcRespondTrade(offer, pr.data, tr.data, R);
  await sb.from('cm_offers').update({ status: acc ? 'active' : 'rejected' }).eq('id', offer.id);
  await addNews(w.year, to, 'perdagangan', `${tr.data.name} ${acc ? 'menerima' : 'menolak'} tawaran dagang dari ${pr.data.name}`, acc ? 'Perjanjian mulai berlaku pada pergantian tahun.' : 'Pemerintah NPC menilai syarat kurang menguntungkan.');
  if (acc) { await mutate(to, (c) => { c.rel[pr.code] = Math.min(100, (c.rel[pr.code] || 0) + 6); }); await mutate(pr.code, (c) => { c.rel[to] = Math.min(100, (c.rel[to] || 0) + 6); }); }
  return { ok: true, status: acc ? 'active' : 'rejected', note: acc ? 'NPC menerima tawaran.' : 'NPC menolak tawaran.' };
};
A.respond_offer = async ({ u, body }) => {
  const pr = await needPres(u, body.session), id = Number(body.id), w = await world();
  const o = must(await sb.from('cm_offers').select('*').eq('id', id).maybeSingle()); if (!o) bad('Penawaran tidak ditemukan', 404);
  if (o.to_c !== pr.code) bad('Penawaran ini bukan untuk negara Anda', 403); if (o.status !== 'pending') bad('Penawaran sudah diproses');
  const accept = !!body.accept;
  const up = await sb.from('cm_offers').update({ status: accept ? (o.kind === 'peace' ? 'done' : o.kind === 'bilateral' ? 'done' : 'active') : 'rejected' }).eq('id', id).eq('status', 'pending').select('id'); if (!up.data?.length) bad('Penawaran baru saja diproses', 409);
  const from = await getRow(o.from_c);
  if (accept && o.kind === 'peace') { await mutate(o.from_c, c => { c.war = c.war.filter(x => x !== o.to_c); }); await mutate(o.to_c, c => { c.war = c.war.filter(x => x !== o.from_c); }); }
  if (accept && o.kind === 'bilateral') { for (const [a, b] of [[o.from_c, o.to_c], [o.to_c, o.from_c]]) await mutate(a, c => { c.rel[b] = Math.min(100, (c.rel[b] || 0) + 15); c.gov.stability = E.clamp(c.gov.stability + 0.5, 0, 100); c.gov.prosperity = E.clamp(c.gov.prosperity + 0.3, 0, 100); }); }
  await addNews(w.year, o.to_c, o.kind === 'peace' ? 'konflik' : 'perdagangan', `${pr.data.name} ${accept ? 'menerima' : 'menolak'} ${o.kind === 'trade' ? 'tawaran dagang' : o.kind === 'peace' ? 'usulan damai' : 'kerja sama bilateral'} dari ${from.data.name}`);
  return { ok: true };
};
A.cancel_trade = async ({ u, body }) => {
  const pr = await needPres(u, body.session), id = Number(body.id), w = await world();
  const o = must(await sb.from('cm_offers').select('*').eq('id', id).maybeSingle()); if (!o || o.kind !== 'trade') bad('Perjanjian tidak ditemukan', 404);
  if (![o.from_c, o.to_c].includes(pr.code)) bad('Bukan perjanjian negara Anda', 403); if (!['active', 'pending'].includes(o.status)) bad('Perjanjian sudah tidak aktif');
  must(await sb.from('cm_offers').update({ status: 'cancelled' }).eq('id', id));
  const other = o.from_c === pr.code ? o.to_c : o.from_c;
  await mutate(other, c => { c.rel[pr.code] = Math.max(-100, (c.rel[pr.code] || 0) - 8); }); await mutate(pr.code, c => { c.rel[other] = Math.max(-100, (c.rel[other] || 0) - 4); });
  await addNews(w.year, pr.code, 'perdagangan', `${pr.data.name} membatalkan perdagangan ${E.SECTORS[o.sector]} dengan ${other}`);
  return { ok: true };
};

// ----- kas & transfer -----
A.transfer = async ({ u, body }) => {
  const w = await world(), admin = await isAdmin(u), un = body.from === 'UN';
  const to = cc(body.to), note = txt(body.note ?? '', 140, 'Catatan', 0), cur = body.currency === 'LOCAL' ? 'LOCAL' : 'USD';
  let fromCode = null, pr = null;
  if (un) { if (!admin) bad('Hanya admin UN yang dapat memakai dana UN', 403); }
  else { pr = await needPres(u, body.session); fromCode = pr.code; if (fromCode === to) bad('Tidak dapat mentransfer ke negara sendiri'); }
  const amount = num(body.amount, 0.001, 1e7, 'Jumlah');
  const toRow = await getRow(to); let usd;
  if (un) usd = cur === 'USD' ? amount : amount / toRow.data.fx;
  else usd = cur === 'USD' ? amount : amount / pr.data.fx;
  if (!un) { // debit lebih dulu, dengan pemeriksaan saldo di dalam penguncian optimistik
    await mutate(fromCode, (c) => { if (c.treasury < usd) bad(`Saldo kas tidak cukup. Tersedia ${c.treasury.toFixed(2)} miliar USD`); c.treasury = E.r2(c.treasury - usd); });
  }
  try { await mutate(to, (c) => { c.treasury = E.r2(c.treasury + usd); if (!un) c.rel[fromCode] = Math.min(100, (c.rel[fromCode] || 0) + 4); c.gov.approval = E.clamp(c.gov.approval + (usd / c.gdp > 0.005 ? 1 : 0), 0, 100); }); }
  catch (e) { if (!un) await mutate(fromCode, c => { c.treasury = E.r2(c.treasury + usd); }); throw e; }
  const localAmt = usd * toRow.data.fx;
  const t = must(await sb.from('cm_transfers').insert({ from_c: un ? 'UN' : fromCode, to_c: to, usd, currency: cur === 'USD' ? 'USD' : (un ? toRow.data.cur : pr.data.cur), local_amt: localAmt, note, uid: u.id, kind: un ? 'bantuan_un' : 'transfer' }).select().single());
  await addNews(w.year, to, 'bantuan', `${un ? 'UN' : pr.data.name} mengirim dana ${usd.toFixed(2)} miliar USD ke ${toRow.data.name}`, note);
  return { ok: true, transfer: t };
};

// ----- politik & kabinet -----
A.set_party = async ({ u, body }) => {
  const pr = await needPres(u, body.session), names = pr.data.gov.parties.map(x => x.name);
  const party = String(body.party || ''), coal = (body.coalition || []).map(String);
  if (!names.includes(party)) bad('Partai tidak valid'); if (!coal.length || !coal.every(x => names.includes(x))) bad('Koalisi tidak valid');
  if (!coal.includes(party)) coal.unshift(party);
  await mutate(pr.code, c => { c.gov.party = party; c.gov.coalition = [...new Set(coal)]; });
  return { ok: true, seats: pr.data.gov.parties.filter(x => coal.includes(x.name)).reduce((a, b) => a + b.seats, 0) };
};
A.appoint = async ({ u, body }) => {
  const pr = await needPres(u, body.session); if (!E.MINISTRIES[body.ministry]) bad('Jabatan tidak valid'); const i = num(body.index, 0, 2, 'Calon');
  await mutate(pr.code, c => { const cand = c.gov.cand[body.ministry][i]; if (!cand) bad('Calon tidak ada'); c.gov.cabinet[body.ministry] = cand; c.gov.approval = E.clamp(c.gov.approval + (cand.skill > 70 ? 1 : 0), 0, 100); });
  const w = await world(); await addNews(w.year, pr.code, 'politik', `${pr.data.gov.president} ... ${E.MINISTRIES[body.ministry]} baru ditunjuk di ${pr.data.name}`, pr.data.gov.cand[body.ministry][i].name);
  return { ok: true };
};
A.motion = async ({ u, body }) => {
  const pr = await needPres(u, body.session), m = body.motion, w = await world(); if (!E.MOTIONS[m]) bad('Mosi tidak dikenal');
  let vote;
  await mutate(pr.code, c => {
    const used = c.gov.motions || (c.gov.motions = {}); if (used[m] === w.year) bad('Mosi ini sudah diajukan pada tahun simulasi ini');
    used[m] = w.year; vote = E.parliamentVote(c, m, w.year, 1); if (vote.passed) E.applyMotion(c, m);
  });
  await addNews(w.year, pr.code, 'politik', `${E.MOTIONS[m]} di parlemen ${pr.data.name}: ${vote.passed ? 'DISETUJUI' : 'DITOLAK'}`, `Setuju ${vote.yes}, menolak ${vote.no}, abstain ${vote.abstain} (kursi koalisi ${vote.coalition}).`);
  return { ok: true, vote };
};

// ----- pemerintahan & legislasi -----
A.set_ideology = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(); if (!E.IDEOLOGIES[body.ideology]) bad('Ideologi tidak valid');
  await mutate(pr.code, c => { if (c.gov.ideology === body.ideology) bad('Ideologi sudah demikian'); if (c.gov.ideoYear === w.year) bad('Ideologi hanya dapat diganti sekali per tahun'); c.gov.ideology = body.ideology; c.gov.ideoYear = w.year; c.gov.stability = E.clamp(c.gov.stability - 3, 0, 100); });
  await addNews(w.year, pr.code, 'politik', `${pr.data.name} beralih ke ideologi ${E.IDEOLOGIES[body.ideology]}`); return { ok: true };
};
A.investigate = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(); let res;
  await mutate(pr.code, c => {
    if (c.used.investigate) bad('Penyelidikan korupsi hanya sekali per tahun simulasi'); const cost = c.gdp * 0.0006; if (c.treasury < cost) bad('Kas tidak cukup untuk penyelidikan'); c.treasury = E.r2(c.treasury - cost); c.used.investigate = 1;
    const found = Math.round(3 + Math.random() * 6 + c.gov.corruption * 0.05); c.gov.corruption = E.clamp(c.gov.corruption - found, 0, 100); c.gov.trust = E.clamp(c.gov.trust + 2, 0, 100); c.gov.approval = E.clamp(c.gov.approval + (Math.random() < 0.5 ? 2 : -1), 0, 100); res = { found, cost: E.r2(cost) };
  });
  await addNews(w.year, pr.code, 'politik', `Penyelidikan korupsi di ${pr.data.name} membongkar kasus besar`, `Indeks korupsi turun ${res.found} poin.`); return { ok: true, ...res };
};
A.propose_law = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), id = body.law, L = E.LAWS[id]; if (!L) bad('RUU tidak dikenal'); let vote;
  await mutate(pr.code, c => { if (c.gov.laws.includes(id)) bad('UU ini sudah berlaku'); vote = E.parliamentVote(c, 'uu', w.year, hashN(id)); if (vote.passed) c.gov.laws.push(id); });
  await addNews(w.year, pr.code, 'politik', `RUU "${L.name}" di ${pr.data.name}: ${vote.passed ? 'DISAHKAN' : 'DITOLAK'}`, `Setuju ${vote.yes}, menolak ${vote.no}.`); return { ok: true, vote };
};
A.repeal_law = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), id = body.law, L = E.LAWS[id]; if (!L) bad('UU tidak dikenal'); let vote;
  await mutate(pr.code, c => { if (!c.gov.laws.includes(id)) bad('UU ini tidak berlaku'); vote = E.parliamentVote(c, 'uu', w.year, hashN('x' + id)); if (vote.passed) c.gov.laws = c.gov.laws.filter(x => x !== id); });
  await addNews(w.year, pr.code, 'politik', `Pencabutan "${L.name}" di ${pr.data.name}: ${vote.passed ? 'DISETUJUI' : 'DITOLAK'}`, `Setuju ${vote.yes}, menolak ${vote.no}.`); return { ok: true, vote };
};
const hashN = (s) => E.hashStr(s) % 100000;

// ----- diplomasi & pertahanan -----
function allianceOk(code, a, c, ranks) {
  const g = c.gov, ok = (r) => r || null;
  if (a === 'UN') return 'UN wajib dan tidak dapat diubah';
  if (c.mem.includes(a)) return 'Sudah menjadi anggota';
  if (a === 'ASEAN' && c.sub !== 'South-Eastern Asia') return 'Hanya negara Asia Tenggara';
  if (a === 'EU' && (c.region !== 'Europe' || g.corruption >= 60 || g.ideology === 'komunisme')) return 'Syarat Uni Eropa: Eropa, korupsi < 60, bukan Komunisme';
  if (a === 'NATO' && (!['Europe', 'Americas'].includes(c.region) || (c.sub !== 'North America' && c.region !== 'Europe') || g.stability < 50 || g.readiness < 40)) return 'Syarat NATO: Eropa/Amerika Utara, stabilitas ≥ 50, kesiapan ≥ 40';
  if (a === 'AU' && c.region !== 'Africa') return 'Hanya negara Afrika';
  if (a === 'G20' && ranks.get(code) > 25) return 'Hanya 25 PDB terbesar';
  if (a === 'BRICS' && (ranks.get(code) > 40 || c.mem.includes('NATO') || c.mem.includes('EU'))) return 'Syarat BRICS: 40 PDB terbesar, bukan anggota NATO/EU';
  if (a === 'OPEC' && !c.oil) return 'Hanya produsen minyak';
  return null;
}
A.alliance = async ({ u, body }) => {
  const pr = await needPres(u, body.session), a = String(body.alliance), join = !!body.join, w = await world(); if (!E.ALLIANCES[a]) bad('Aliansi tidak dikenal');
  if (join) { const all = must(await sb.from('cm_countries').select('code,slim')); const ranks = E.worldRank(all.map(r => ({ code: r.code, gdp: r.slim.gdp })), 'gdp'); const err = allianceOk(pr.code, a, pr.data, ranks); if (err) bad(err); await mutate(pr.code, c => { if (!c.mem.includes(a)) c.mem.push(a); }); }
  else { if (a === 'UN') bad('Semua negara wajib menjadi anggota UN'); await mutate(pr.code, c => { c.mem = c.mem.filter(x => x !== a); c.gov.stability = E.clamp(c.gov.stability - 1, 0, 100); }); }
  await addNews(w.year, pr.code, 'diplomasi', `${pr.data.name} ${join ? 'bergabung dengan' : 'keluar dari'} ${E.ALLIANCES[a].name}`); return { ok: true };
};
A.set_defense = async ({ u, body }) => { const pr = await needPres(u, body.session), v = num(body.defense, 0, 12, 'Anggaran pertahanan'); await mutate(pr.code, c => { c.pol.defense = v; }); return { ok: true }; };
const shared = (a, b) => a.mem.some(m => m !== 'UN' && b.mem.includes(m));
A.declare_war = async ({ u, body }) => {
  const pr = await needPres(u, body.session), t = cc(body.target), w = await world(); if (t === pr.code) bad('Target tidak valid');
  const tr = await getRow(t); if (pr.data.war.includes(t)) bad('Sudah berperang'); if (shared(pr.data, tr.data)) bad('Tidak dapat menyerang sesama anggota aliansi (selain UN)');
  if (pr.data.gov.readiness < 25) bad('Kesiapan pertahanan terlalu rendah (minimal 25)');
  await mutate(pr.code, c => { c.war.push(t); c.gov.approval = E.clamp(c.gov.approval + (c.gov.readiness > 60 ? 3 : -4), 0, 100); c.rel[t] = -80; });
  await mutate(t, c => { if (!c.war.includes(pr.code)) c.war.push(pr.code); c.rel[pr.code] = -80; c.gov.readiness = E.clamp(c.gov.readiness + 5, 0, 100); });
  await sb.from('cm_offers').update({ status: 'cancelled' }).eq('kind', 'trade').in('status', ['active', 'pending']).or(`and(from_c.eq.${pr.code},to_c.eq.${t}),and(from_c.eq.${t},to_c.eq.${pr.code})`);
  await addNews(w.year, pr.code, 'konflik', `PERANG: ${pr.data.name} menyatakan perang terhadap ${tr.data.name}`, 'Perdagangan dibatalkan; ekonomi kedua negara terdampak.', 'Kantor Berita Global'); return { ok: true };
};
A.propose_peace = async ({ u, body }) => {
  const pr = await needPres(u, body.session), t = cc(body.target), w = await world(); if (!pr.data.war.includes(t)) bad('Anda tidak sedang berperang dengan negara ini');
  const tr = await getRow(t);
  if (validPres(tr)) { must(await sb.from('cm_offers').insert({ kind: 'peace', from_c: pr.code, to_c: t, status: 'pending', year: w.year, created_by: u.id })); return { ok: true, status: 'pending', note: 'Usulan damai dikirim ke presiden pemain.' }; }
  const acc = Math.random() < E.clamp(0.35 + (tr.data.gov.approval < 45 ? 0.3 : 0) + (tr.data.gov.stability < 40 ? 0.2 : 0), 0.1, 0.9);
  if (acc) { await mutate(pr.code, c => { c.war = c.war.filter(x => x !== t); }); await mutate(t, c => { c.war = c.war.filter(x => x !== pr.code); }); }
  await addNews(w.year, pr.code, 'konflik', acc ? `DAMAI: ${pr.data.name} dan ${tr.data.name} sepakat gencatan senjata` : `${tr.data.name} menolak usulan damai ${pr.data.name}`); return { ok: true, status: acc ? 'accepted' : 'rejected', note: acc ? 'Perdamaian tercapai.' : 'NPC menolak perdamaian.' };
};
A.bilateral = async ({ u, body }) => {
  const pr = await needPres(u, body.session), t = cc(body.target), w = await world(); const type = txt(body.type, 20, 'Jenis'); if (!['budaya', 'pendidikan', 'keamanan', 'ekonomi'].includes(type)) bad('Jenis kerja sama tidak valid');
  if (pr.data.war.includes(t)) bad('Tidak dapat bekerja sama dengan negara yang sedang diperangi'); const tr = await getRow(t);
  const cost = pr.data.gdp * 0.0005; await mutate(pr.code, c => { if (c.treasury < cost) bad('Kas tidak cukup'); c.treasury = E.r2(c.treasury - cost); });
  if (validPres(tr)) { must(await sb.from('cm_offers').insert({ kind: 'bilateral', from_c: pr.code, to_c: t, sector: type, status: 'pending', year: w.year, created_by: u.id })); return { ok: true, status: 'pending' }; }
  const acc = Math.random() < E.clamp(0.55 + (tr.data.rel[pr.code] || 0) / 200, 0.1, 0.95);
  if (acc) for (const [a, b] of [[pr.code, t], [t, pr.code]]) await mutate(a, c => { c.rel[b] = Math.min(100, (c.rel[b] || 0) + 15); c.gov.stability = E.clamp(c.gov.stability + 0.5, 0, 100); c.gov.prosperity = E.clamp(c.gov.prosperity + 0.4, 0, 100); if (type === 'keamanan') c.gov.readiness = E.clamp(c.gov.readiness + 3, 0, 100); if (type === 'pendidikan') c.stock.edu = E.clamp(c.stock.edu + 1.5, 0, 100); });
  await addNews(w.year, pr.code, 'diplomasi', `${pr.data.name} dan ${tr.data.name} ${acc ? 'menandatangani' : 'gagal menyepakati'} kerja sama ${type}`); return { ok: true, status: acc ? 'accepted' : 'rejected' };
};

// ----- warga -----
A.petition_create = async ({ u, p, body }) => {
  const code = cc(body.country); await needCitizen(p, code); const w = await world();
  const title = txt(body.title, 100, 'Judul', 4), text = txt(body.body, 500, 'Isi petisi', 10);
  const open = (await sb.from('cm_petitions').select('id', { count: 'exact', head: true }).eq('uid', u.id).eq('status', 'open')).count || 0; if (open >= 3) bad('Maksimal 3 petisi terbuka per warga');
  const r = must(await sb.from('cm_petitions').insert({ country: code, uid: u.id, author: p.name, title, body: text, year: w.year, supports: 1 }).select().single());
  await sb.from('cm_petition_supports').insert({ petition_id: r.id, uid: u.id }); return { ok: true, petition: r };
};
A.petition_support = async ({ u, p, body }) => {
  const id = Number(body.id), pt = must(await sb.from('cm_petitions').select('*').eq('id', id).maybeSingle()); if (!pt) bad('Petisi tidak ditemukan', 404); await needCitizen(p, pt.country);
  const ins = await sb.from('cm_petition_supports').insert({ petition_id: id, uid: u.id }); if (ins.error) bad('Anda sudah mendukung petisi ini');
  const n = (await sb.from('cm_petition_supports').select('uid', { count: 'exact', head: true }).eq('petition_id', id)).count || 1; await sb.from('cm_petitions').update({ supports: n }).eq('id', id); return { ok: true, supports: n };
};
A.petition_answer = async ({ u, body }) => {
  const pr = await needPres(u, body.session), id = Number(body.id), ans = txt(body.answer, 300, 'Jawaban', 3), w = await world();
  const pt = must(await sb.from('cm_petitions').select('*').eq('id', id).maybeSingle()); if (!pt || pt.country !== pr.code) bad('Petisi bukan milik negara Anda', 403); if (pt.status !== 'open') bad('Petisi sudah dijawab');
  await sb.from('cm_petitions').update({ status: 'answered', answer: ans }).eq('id', id).eq('status', 'open');
  await mutate(pr.code, c => { c.gov.trust = E.clamp(c.gov.trust + Math.min(3, 0.5 + pt.supports * 0.1), 0, 100); c.gov.approval = E.clamp(c.gov.approval + Math.min(2, pt.supports * 0.1), 0, 100); });
  await addNews(w.year, pr.code, 'sosial', `Presiden ${pr.data.name} menjawab petisi "${pt.title}"`, ans); return { ok: true };
};
A.civic = async ({ u, p, body }) => {
  const kind = String(body.kind), code = cc(body.country); await needCitizen(p, code); const w = await world();
  const FX = { forum: ['Forum publik', { trust: 0.8, approval: 0.3 }], relawan: ['Kegiatan relawan', { prosperity: 0.5, stability: 0.4 }], aksi_damai: ['Aksi damai', { approval: -1, trust: 0.4, stability: -0.2 }] }[kind]; if (!FX) bad('Jenis aksi tidak valid');
  const ins = await sb.from('cm_civic').insert({ uid: u.id, kind, year: w.year, country: code }); if (ins.error) bad(`${FX[0]} sudah Anda lakukan pada tahun simulasi ini`);
  await mutate(code, c => { for (const k in FX[1]) c.gov[k] = E.clamp(c.gov[k] + FX[1][k], 0, 100); if (kind === 'aksi_damai' && c.gov.corruption > 55) c.gov.corruption = E.clamp(c.gov.corruption - 0.5, 0, 100); });
  await addNews(w.year, code, 'sosial', `${p.name} menggelar ${FX[0].toLowerCase()} di ${code}`, '', 'Pos Diplomatik'); return { ok: true };
};

// ----- sosial -----
A.post_create = async ({ u, p, body }) => {
  const code = cc(body.country), text = txt(body.body, 500, 'Pesan'), type = ['pesan', 'kritik', 'aspirasi'].includes(body.type) ? body.type : 'pesan'; let role;
  const pres = await myPresRow(u, body.session);
  if (pres && pres.code === code) role = 'presiden'; else if (p.citizenship === code) role = type === 'pesan' ? 'warga' : type; else bad('Hanya presiden dan warga negara ini yang dapat memposting', 403);
  if (role !== 'presiden' && type === 'pesan') role = 'warga'; if (role === 'presiden' && type !== 'pesan') bad('Presiden memposting pesan resmi');
  const last = must(await sb.from('cm_posts').select('ts').eq('uid', u.id).order('id', { ascending: false }).limit(1))[0]; if (last && Date.now() - new Date(last.ts).getTime() < 4000) bad('Terlalu cepat, tunggu beberapa detik');
  const r = must(await sb.from('cm_posts').insert({ country: code, uid: u.id, author: p.name, role, body: text }).select().single()); return { ok: true, post: r };
};
A.post_like = async ({ u, body }) => {
  const id = Number(body.id); const ex = must(await sb.from('cm_post_likes').select('post_id').eq('post_id', id).eq('uid', u.id).maybeSingle());
  if (ex) await sb.from('cm_post_likes').delete().eq('post_id', id).eq('uid', u.id); else { const i = await sb.from('cm_post_likes').insert({ post_id: id, uid: u.id }); if (i.error) bad('Postingan tidak ditemukan', 404); }
  const n = (await sb.from('cm_post_likes').select('uid', { count: 'exact', head: true }).eq('post_id', id)).count || 0; await sb.from('cm_posts').update({ likes: n }).eq('id', id); return { ok: true, likes: n, liked: !ex };
};
A.aspirations = async ({ u, body }) => {
  const pr = await needPres(u, body.session);
  return { posts: must(await sb.from('cm_posts').select('*').eq('country', pr.code).eq('hidden', false).in('role', ['aspirasi', 'kritik']).order('id', { ascending: false }).limit(30)), petitions: must(await sb.from('cm_petitions').select('*').eq('country', pr.code).eq('hidden', false).eq('status', 'open').order('supports', { ascending: false }).limit(20)) };
};
A.news = async ({ body }) => {
  let q = sb.from('cm_news').select('*').order('id', { ascending: false }).limit(Math.min(120, Number(body.limit) || 60));
  if (body.country) q = q.eq('country', cc(body.country)); if (body.before) q = q.lt('id', Number(body.before)); return { news: must(await q) };
};
A.elections = async ({ body }) => ({ elections: must(await sb.from('cm_elections').select('*').order('year', { ascending: false }).limit(300)) });
A.vote = async ({ u, p, body }) => {
  const code = cc(body.country), choice = body.choice === 'challenger' ? 'challenger' : 'incumbent'; await needCitizen(p, code); const w = await world();
  const i = await sb.from('cm_votes').insert({ uid: u.id, year: w.year, choice, country: code }); if (i.error) bad('Anda sudah memberikan suara pada pemilu tahun ini'); return { ok: true };
};

// ============ MAJUKAN TAHUN ============
const EV = [['Gempa bumi melanda', -2.2, -6], ['Banjir besar melanda', -1, -4], ['Krisis pangan melanda', -1.5, -5], ['Gelombang wisata & investasi melonjak di', 1.4, 4], ['Penemuan sumber daya baru di', 1.8, 5], ['Wabah penyakit menyebar di', -2, -5]];
async function advanceYear(actor, why = 'tombol') {
  const w = await world();
  if (w.paused) bad('Waktu dunia dihentikan oleh admin UN');
  if (w.last_advance_at && Date.now() - new Date(w.last_advance_at).getTime() < COOLDOWN) bad(`Jeda penggunaan: tunggu ${Math.ceil((COOLDOWN - (Date.now() - new Date(w.last_advance_at).getTime())) / 1000)} detik lagi`, 429);
  const lease = await sb.from('cm_world').update({ advancing_until: new Date(Date.now() + 120_000).toISOString(), ver: w.ver + 1 }).eq('id', 1).eq('ver', w.ver).select('id');
  if (!lease.data?.length) bad('Pergantian tahun sedang diproses pemain lain', 409);
  try { return await doAdvance(w, actor); } finally { await sb.from('cm_world').update({ advancing_until: null }).eq('id', 1); }
}
async function doAdvance(w, actor) {
  const year = w.year + 1, rows = must(await sb.from('cm_countries').select('*')), R = E.rng(`yr${year}|${w.ver}`);
  const offers = must(await sb.from('cm_offers').select('*').in('status', ['active', 'pending']));
  // penawaran yang menggantung > 1 tahun kedaluwarsa
  const exp = offers.filter(o => o.status === 'pending' && year - o.year >= 2).map(o => o.id); if (exp.length) await sb.from('cm_offers').update({ status: 'expired' }).in('id', exp);
  const trade = E.tradeSummary(offers.filter(o => o.kind === 'trade'));
  const list = rows.map(r => r.data), avgInfl = list.reduce((a, c) => a + c.infl, 0) / list.length, avgG = list.reduce((a, c) => a + c.growth, 0) / list.length;
  const votes = must(await sb.from('cm_votes').select('*').eq('year', w.year)); const vb = {};
  for (const v of votes) { const d = E.hashStr(v.uid) % 5; const b = (vb[v.country] ||= { total: 0, byDistrict: {} }); b.total++; ((b.byDistrict[d] ||= { inc: 0, ch: 0 })[v.choice === 'incumbent' ? 'inc' : 'ch'])++; }
  const mood = {}, shock = {}, ctxAid = {}, news = [], posts = [], results = [], released = [], reports = {};
  const before = Object.fromEntries(list.map(c => [c.code, { gdp: c.gdp, growth: c.growth, infl: c.infl, unemp: c.unemp, debt: c.debt, fx: c.fx, approval: c.gov.approval, treasury: c.treasury }]));
  // kejadian acak & bantuan NPC
  const poor = [];
  for (const c of list) if (R() < 0.06) { const e = EV[Math.floor(R() * EV.length)]; shock[c.code] = e[1]; mood[c.code] = e[2]; news.push([c.code, 'bencana', `${e[0]} ${c.name}`, `Dampak ekonomi tercatat pada tahun ${year}.`]); if (e[1] < 0) poor.push(c); }
  for (const d of poor) { const donors = list.filter(c => c.code !== d.code && c.treasury > c.gdp * 0.09 && !rows.find(r => r.code === c.code).president_uid).sort(() => R() - 0.5); if (donors[0]) { const amt = E.r2(donors[0].gdp * 0.002); ctxAid[d.code] = amt; donors[0].treasury = E.r2(donors[0].treasury - amt); rows.find(r => r.code === donors[0].code).data = donors[0]; news.push([d.code, 'bantuan', `${donors[0].name} (NPC) mengirim bantuan ${amt.toFixed(2)} miliar USD ke ${d.name}`, '']); results.push({ kind: 'aid', from: donors[0].code, to: d.code, usd: amt }); } }
  // perang NPC: damai tercapai bertahap
  for (const c of list) for (const t of [...c.war]) if (c.code < t) { const a = rows.find(r => r.code === c.code), b = rows.find(r => r.code === t); if (!validPres(a) && !validPres(b) && R() < 0.35) { c.war = c.war.filter(x => x !== t); const tc = b.data; tc.war = tc.war.filter(x => x !== c.code); news.push([c.code, 'konflik', `DAMAI: ${c.name} dan ${tc.name} mengakhiri perang`, '']); } }
  // proses per negara
  const ctx0 = { year, trade, worldInfl: avgInfl, worldGrowth: avgG, shock, mood, aid: ctxAid, oilPrice: 0.8 + R() * 0.5 };
  const moves = [], deltaPop = {};
  const proc = async (row) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const cur = attempt === 0 ? row : await getRow(row.code); const c = structuredClone(cur.data), Rn = E.rng(`${year}|${c.code}|${attempt}`);
      const player = validPres(cur), b = { gdp: c.gdp, growth: c.growth, infl: c.infl, unemp: c.unemp, debt: c.debt, fx: c.fx, approval: c.gov.approval, treasury: c.treasury };
      const npcActs = player ? [] : E.npcDecide(c, Rn, year);
      E.stepYear(c, ctx0, Rn);
      // pemilu
      const el = E.runElection(c, vb[c.code] || { total: 0, byDistrict: {} }, year - 1, Rn); let presOut = false;
      if (el.winner === 'challenger') {
        const name = el.challenger.split(' (')[0]; if (player) presOut = true;
        c.gov.president = name; c.gov.party = c.gov.parties[Math.floor(Rn() * 5)].name; c.gov.coalition = [c.gov.party]; c.gov.cabinet = {}; c.gov.approval = E.clamp(c.gov.approval + 6, 0, 100); c.gov.lastShare = 50;
      }
      // laporan tahunan
      const rep = report(c, b, ctx0, tr(trade, c.code), player, npcActs, el, year);
      c.report = { year, lines: rep, before: b };
      c.lastPopDate = c.lastPopDate || '';
      const ok = await save(cur, c, presOut ? { cols: { president_uid: null, president_session: null, president_seen: null }, slim: { playerPres: false, president: c.gov.president } } : {});
      if (ok) { moves.push({ code: c.code, el, presOut, name: c.name, president: cur.slim?.president, pop: c.pop, player }); return; }
    }
  };
  for (let i = 0; i < rows.length; i += 25) await Promise.all(rows.slice(i, i + 25).map(proc));
  // migrasi: total dunia tetap (hanya selisih diterapkan, aman terhadap pembaruan lain)
  const fresh = must(await sb.from('cm_countries').select('code,data'));
  const snap = fresh.map(r => ({ code: r.code, pop: r.data.pop, gov: r.data.gov, pol: r.data.pol, war: r.data.war })); const orig = Object.fromEntries(snap.map(s => [s.code, s.pop]));
  const moved = E.migrate(snap); const diffs = snap.filter(s => s.pop !== orig[s.code]);
  for (let i = 0; i < diffs.length; i += 25) await Promise.all(diffs.slice(i, i + 25).map(s => mutate(s.code, c => { c.pop = Math.max(1000, c.pop + (s.pop - orig[s.code])); })));
  // simpan hasil pemilu, berita, status presiden
  for (const m of moves) await sb.from('cm_elections').upsert({ year: year - 1, country: m.code, result: m.el });
  const playerCountries = new Set(moves.filter(m => m.player).map(m => m.code));
  for (const m of moves) {
    if (m.presOut) { news.push([m.code, 'pemilu', `${m.president} KALAH pemilu di ${m.name}`, `Penantang menang dengan ${m.el.challengerShare}% suara. Kepresidenan pemain berakhir.`]); }
    else if (playerCountries.has(m.code) || R() < 0.06) news.push([m.code, 'pemilu', `Pemilu ${m.name}: ${m.el.incumbent} ${m.el.winner === 'incumbent' ? 'menang' : 'kalah'} (${m.el.share}%)`, `Partisipasi ${m.el.turnout}%; ${m.el.playerVotes} suara dari warga pemain.`]);
  }
  // timeline NPC
  const npcSample = rows.filter(() => R() < 0.12).slice(0, 25);
  for (const r of npcSample) { const c = r.data; const t = [`Pertumbuhan ekonomi ${c.name} tahun ini ${c.growth.toFixed(1)}%. Kita terus bekerja.`, `Inflasi ${c.infl.toFixed(1)}% — pemerintah akan menjaga harga tetap stabil.`, `Pengangguran ${c.unemp.toFixed(1)}%. Lapangan kerja baru adalah prioritas.`, `Terima kasih rakyat ${c.name}, kita lanjutkan pembangunan!`]; posts.push({ country: c.code, uid: null, author: c.gov.president + ' (NPC)', role: 'npc', body: pick(t, R) }); }
  if (posts.length) await sb.from('cm_posts').insert(posts);
  const topG = [...rows].sort((a, b) => b.data.gdp - a.data.gdp)[0];
  news.unshift([null, 'dunia', `Tahun ${year} dimulai: dunia bergeser`, `Rata-rata inflasi dunia ${avgInfl.toFixed(1)}%, pertumbuhan rata-rata ${avgG.toFixed(1)}%. Ekonomi terbesar: ${topG.data.name}. ${E.r1(moved / 1000)} ribu orang bermigrasi. (Seluruh berita merupakan bagian dari simulasi.)`]);
  for (let i = 0; i < news.length; i += 50) await sb.from('cm_news').insert(news.slice(i, i + 50).map(n => ({ year, country: n[0], kind: n[1], title: n[2], body: n[3], source: pick(SOURCES, R) })));
  await sb.from('cm_world').update({ year, last_advance_at: nowIso() }).eq('id', 1);
  return { year, moved, byActor: actor, countries: rows.length };
}
const tr = (t, c) => t[c] || { exp: 0, imp: 0 };
function report(c, b, ctx, t, player, npcActs, el, year) {
  const L = [], p = c.pol, f = (x, d = 1) => Number(x).toFixed(d);
  L.push(`PDB ${b.gdp.toFixed(1)} → ${c.gdp.toFixed(1)} miliar USD (pertumbuhan ${f(c.growth)}%).`);
  if (p.taxInc > 32) L.push(`Pajak penghasilan tinggi (${p.taxInc}%) menekan konsumsi dan pertumbuhan.`); else if (p.taxInc < 18) L.push(`Pajak penghasilan rendah (${p.taxInc}%) mendorong konsumsi namun menipiskan pendapatan negara.`);
  if (p.taxCorp > 30) L.push(`Pajak perusahaan ${p.taxCorp}% menurunkan minat investasi.`);
  if (p.rate - c.infl > 4) L.push(`Suku bunga ${p.rate}% jauh di atas inflasi: kredit mahal, pengangguran cenderung naik.`); else if (p.rate < c.infl) L.push(`Suku bunga ${p.rate}% di bawah inflasi memicu tekanan harga dan pelemahan kurs.`);
  L.push(`Inflasi ${f(b.infl)}% → ${f(c.infl)}%; pengangguran ${f(b.unemp)}% → ${f(c.unemp)}%.`);
  if (Math.abs(c.fx / b.fx - 1) > 0.02) L.push(`Kurs ${c.cur} ${c.fx > b.fx ? 'melemah' : 'menguat'} ${f(Math.abs(c.fx / b.fx - 1) * 100)}% terhadap USD.`);
  L.push(`Anggaran: pemasukan ${f(c.lastRevenue, 2)}, belanja ${f(c.lastExpense, 2)} → ${c.lastBalance >= 0 ? 'surplus' : 'defisit'} ${f(Math.abs(c.lastBalance), 2)} miliar USD. Utang ${f(b.debt)} → ${f(c.debt)}.`);
  if (t.exp + t.imp > 0) L.push(`Perdagangan: ekspor ${f(t.exp, 2)} dan impor ${f(t.imp, 2)} miliar USD lewat perjanjian aktif.`);
  if (c.war.length) L.push(`PERANG dengan ${c.war.join(', ')} memotong PDB dan stabilitas.`);
  L.push(`Kepuasan rakyat ${b.approval} → ${c.gov.approval}%. Korupsi ${f(c.gov.corruption, 0)}, stabilitas ${f(c.gov.stability, 0)}, kepercayaan ${f(c.gov.trust, 0)}.`);
  if (npcActs.length) L.push(`Pemerintah NPC: ${npcActs.join('; ')}.`);
  L.push(`Pemilu ${year - 1}: ${el.incumbent} ${el.winner === 'incumbent' ? 'terpilih kembali' : 'kalah'} dengan ${el.share}% suara (partisipasi ${el.turnout}%).`);
  return L;
}
A.advance_year = async ({ u, body }) => {
  const admin = await isAdmin(u); if (!admin) await needPres(u, body.session);
  const r = await advanceYear(u.id); return { ok: true, ...r };
};

// ============ ADMIN UN ============
const IND = { gdp: [0.05, 1e6], growth: [-20, 30], infl: [-5, 500], unemp: [0, 100], debt: [0, 1e6], treasury: [0, 1e6], pop: [1000, 3e9], approval: [0, 100], corruption: [0, 100], prosperity: [0, 100], stability: [0, 100], invest: [0, 100], trust: [0, 100], readiness: [0, 100] };
const adminOnly = async (u) => { if (!(await isAdmin(u))) bad('Hanya owner/admin UN yang berwenang', 403); };
A.admin_set_indicator = async ({ u, body }) => { await adminOnly(u); const code = cc(body.code), f = body.field; if (!IND[f]) bad('Indikator tidak valid'); const v = num(body.value, IND[f][0], IND[f][1], f); const w = await world();
  await mutate(code, c => { if (['approval', 'corruption', 'prosperity', 'stability', 'invest', 'trust', 'readiness'].includes(f)) c.gov[f] = v; else c[f] = f === 'pop' ? Math.round(v) : v; }); await addNews(w.year, code, 'admin', `Admin UN menyesuaikan ${f} ${code} menjadi ${v}`, '', 'Sekretariat UN'); return { ok: true }; };
A.admin_currency = async ({ u, body }) => { await adminOnly(u); const code = cc(body.code), cur = txt(body.cur, 5, 'Kode mata uang', 2).toUpperCase(), sym = txt(body.sym, 5, 'Simbol'), fx = num(body.fx, 0.00001, 1e8, 'Kurs'); const w = await world();
  await mutate(code, c => { c.cur = cur; c.sym = sym; c.fx = fx; }); await addNews(w.year, code, 'admin', `Admin UN mengubah mata uang ${code}: ${cur} (${fx}/USD)`, '', 'Sekretariat UN'); return { ok: true }; };
A.admin_alliance = async ({ u, body }) => { await adminOnly(u); const code = cc(body.code), a = String(body.alliance), on = !!body.member, w = await world(); if (!E.ALLIANCES[a]) bad('Aliansi tidak dikenal'); if (a === 'UN' && !on) bad('Semua negara wajib menjadi anggota UN');
  await mutate(code, c => { c.mem = on ? [...new Set([...c.mem, a])] : c.mem.filter(x => x !== a); }); await addNews(w.year, code, 'admin', `Admin UN ${on ? 'menambahkan' : 'mencabut'} keanggotaan ${a} untuk ${code}`, '', 'Sekretariat UN'); return { ok: true }; };
A.admin_aid = async (ctx) => { await adminOnly(ctx.u); return A.transfer({ ...ctx, body: { ...ctx.body, from: 'UN' } }); };
A.admin_lock = async ({ u, body }) => { await adminOnly(u); const code = cc(body.code), lock = !!body.locked; const r = await getRow(code); await sb.from('cm_countries').update({ locked: lock, updated_at: nowIso() }).eq('code', code); const w = await world(); await addNews(w.year, code, 'admin', `Admin UN ${lock ? 'mengunci' : 'membuka'} klaim kepresidenan ${r.data.name}`, '', 'Sekretariat UN'); return { ok: true }; };
A.admin_release = async ({ u, body }) => { await adminOnly(u); await releasePresident(cc(body.code), 'dilepas admin UN'); return { ok: true }; };
A.admin_set_year = async ({ u, body }) => { await adminOnly(u); const y = Math.round(num(body.year, 1900, 2500, 'Tahun')); await sb.from('cm_world').update({ year: y }).eq('id', 1); await addNews(y, null, 'admin', `Admin UN menetapkan tahun dunia ke ${y}`, '', 'Sekretariat UN'); return { ok: true }; };
A.admin_pause = async ({ u, body }) => { await adminOnly(u); const w = await world(); await sb.from('cm_world').update({ paused: !!body.paused }).eq('id', 1); await addNews(w.year, null, 'admin', body.paused ? 'Waktu dunia dihentikan oleh admin UN' : 'Waktu dunia dilanjutkan', '', 'Sekretariat UN'); return { ok: true }; };
A.admin_mapbox = async ({ u, body }) => { await adminOnly(u); const t = String(body.token || '').trim(); if (t && !/^pk\.[A-Za-z0-9._-]{20,}$/.test(t)) bad('Token publik Mapbox harus diawali "pk."'); await sb.from('cm_world').update({ mapbox_token: t }).eq('id', 1); return { ok: true }; };
A.admin_announce = async ({ u, body }) => { await adminOnly(u); const t = txt(body.text ?? '', 300, 'Pengumuman', 0), w = await world(); await sb.from('cm_world').update({ announcement: t }).eq('id', 1); if (t) await addNews(w.year, null, 'pengumuman', 'Pengumuman UN', t, 'Sekretariat UN'); return { ok: true }; };
A.admin_moderation = async ({ u }) => { await adminOnly(u); return { posts: must(await sb.from('cm_posts').select('*').order('id', { ascending: false }).limit(60)), petitions: must(await sb.from('cm_petitions').select('*').order('id', { ascending: false }).limit(40)) }; };
A.admin_moderate = async ({ u, body }) => { await adminOnly(u); const t = body.type === 'petition' ? 'cm_petitions' : 'cm_posts'; must(await sb.from(t).update({ hidden: !!body.hidden }).eq('id', Number(body.id))); const w = await world(); await addNews(w.year, null, 'admin', `Admin UN ${body.hidden ? 'menyembunyikan' : 'memulihkan'} konten #${body.id}`, '', 'Sekretariat UN'); return { ok: true }; };
A.admin_reset = async ({ u, body }) => {
  await adminOnly(u); if (body.confirm !== 'RESET') bad('Ketik RESET untuk mengonfirmasi');
  const Z = '00000000-0000-0000-0000-000000000000';
  for (const [t, col, v] of [['cm_post_likes', 'uid', Z], ['cm_petition_supports', 'uid', Z], ['cm_posts', 'id', -1], ['cm_petitions', 'id', -1], ['cm_offers', 'id', -1], ['cm_transfers', 'id', -1], ['cm_news', 'id', -1], ['cm_civic', 'uid', Z], ['cm_votes', 'uid', Z], ['cm_elections', 'year', -99999]]) must(await sb.from(t).delete().neq(col, v));
  await sb.from('cm_countries').delete().neq('code', '--'); await sb.from('cm_world').update({ year: E.START_YEAR, paused: false, advancing_until: null, last_advance_at: null, last_pop_check: null }).eq('id', 1);
  await ensureSeed(true); await sb.from('cm_profiles').update({ citizenship: null }).neq('uid', '00000000-0000-0000-0000-000000000000');
  await addNews(E.START_YEAR, null, 'admin', 'Dunia direset ke tahun 1980', 'Admin UN memulai ulang simulasi. Seluruh berita adalah bagian dari simulasi.', 'Sekretariat UN'); return { ok: true };
};

// ============ ROUTER ============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({})); const action = String(body.action || '');
    if (!A[action]) bad('Aksi tidak dikenal', 404);
    const u = await authUser(req), p = await profile(u);
    const out = await A[action]({ u, p, body, req });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
