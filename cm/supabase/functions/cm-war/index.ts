// @ts-nocheck
// country.7mit — Ekonomi perang & Medan Perang 3D. Seluruh peperangan dibiayai Anggaran Perang (dana operasi dari Anggaran Pertahanan,
// diisi tiap tahun simulasi) dan dipengaruhi Kesiapan Keamanan + Alokasi Anggaran Keamanan (darat/udara/artileri/intelijen). Rudal nuklir = 500 juta USD.
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r2 = (v) => Math.round(v * 100) / 100, r0 = (v) => Math.round(v), sleep = (ms) => new Promise(r => setTimeout(r, ms)), PRES_TTL = 60_000;
async function authUser(req) { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401); return { id: data.user.id }; }
const live = (r, ttl) => !!(r?.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < ttl);
async function presRow(u, session) { if (!session) return null; const r = must(await sb.from('cm_countries').select('code,data,president_uid,president_seen').eq('president_uid', u.id).eq('president_session', session).maybeSingle()); return r && live(r, PRES_TTL * 2) ? r : null; }
async function needPres(u, session) { const r = await presRow(u, session); if (!r) bad('Hanya presiden yang sedang menjabat yang dapat mengatur perang', 403); return r; }
async function cas(code, fn, npcOnly = false) {
  for (let i = 0; i < 6; i++) { const row = (await sb.from('cm_countries').select('data,slim,ver,president_uid').eq('code', code).single()).data; if (!row || (npcOnly && row.president_uid)) return false; const d = structuredClone(row.data); if (fn(d) === false) return false;
    const r = await sb.from('cm_countries').update({ data: d, slim: { ...row.slim, war: d.war, approval: d.gov.approval, stability: d.gov.stability, treasury: d.treasury, debt: d.debt, gdp: d.gdp }, ver: row.ver + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('ver', row.ver).select('code'); if (r.data?.length) return true; await sleep(40 + Math.random() * 120 * (i + 1)); }
  return false; }
async function actor(u, session) { const pr = await presRow(u, session); if (pr) return { row: pr, role: 'presiden' }; const off = must(await sb.from('cm_offices').select('country').eq('uid', u.id).eq('office', 'wapres').maybeSingle()); if (!off) bad('Hanya presiden atau wakil presiden yang dapat ikut perang', 403); const row = must(await sb.from('cm_countries').select('code,data,president_uid,president_seen').eq('code', off.country).maybeSingle()); if (!row) bad('Negara tidak ditemukan', 404); return { row, role: 'wapres' }; }
const world = async () => must(await sb.from('cm_world').select('year').eq('id', 1).single());
const NUKE = 500, MAX_ALLOC = 4000, MIN_ALLOC = 150, ALLOC0 = { darat: 25, udara: 25, art: 25, intel: 25 };
// Anggaran Perang (juta USD): diisi dari Anggaran Pertahanan (% PDB) per tahun simulasi, hingga 3 tahun tertumpuk
function accrue(d, year) { const g = d.gov, wf = g.warFund || (g.warFund = { m: 0, year: year - 1 }), yrs = clamp(year - (wf.year ?? year - 1), 0, 3); if (yrs > 0) { const per = d.gdp * 1000 * (d.pol?.defense ?? 2) / 100 * 0.3; wf.m = r0(Math.min(per * 3, wf.m + per * yrs)); wf.year = year; } return wf; }
const per = (d) => r0(d.gdp * 1000 * (d.pol?.defense ?? 2) / 100 * 0.3);
const shares = (a) => { const t = (a.darat + a.udara + a.art + a.intel) || 100; return { darat: a.darat / t, udara: a.udara / t, art: a.art / t, intel: a.intel / t }; };

const A = {};
A.war_state = async ({ u, body }) => {
  const { row: pr, role } = await actor(u, body.session), w = await world(); let out = null;
  await cas(pr.code, d => { const wf = accrue(d, w.year); out = { fund: wf.m }; });
  const d = (await sb.from('cm_countries').select('data').eq('code', pr.code).single()).data.data, g = d.gov, a = g.alloc?.a || ALLOC0;
  return { fund: out.fund, perYear: per(d), readiness: Math.round(g.readiness ?? 50), defense: d.pol?.defense ?? 2, treasury: r2(d.treasury), alloc: a, allocYear: g.alloc?.year ?? null, canAlloc: (g.alloc?.year ?? -99) < w.year, canMobilize: (g.mobYear ?? -99) < w.year, mobCost: r2(d.gdp * 0.004), nuke: NUKE, maxAlloc: MAX_ALLOC, minAlloc: MIN_ALLOC, shares: shares(a), year: w.year, battles: g.battles?.year === w.year ? g.battles.list || [] : [], nukesUsed: g.nukes || 0, role, battlesVp: g.battles?.year === w.year ? g.battles.vp || [] : [] };
};
A.war_alloc = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), a = body.a || {}, v = { darat: Number(a.darat), udara: Number(a.udara), art: Number(a.art), intel: Number(a.intel) };
  if (Object.values(v).some(x => !Number.isFinite(x) || x < 0 || x > 70)) bad('Tiap matra maksimal 70% dan tidak boleh negatif'); const sum = v.darat + v.udara + v.art + v.intel; if (Math.abs(sum - 100) > 0.6) bad('Total alokasi harus 100%');
  if ((pr.data.gov.alloc?.year ?? -99) >= w.year) bad('Alokasi Anggaran Keamanan hanya dapat diubah sekali per tahun simulasi');
  await cas(pr.code, d => { d.gov.alloc = { year: w.year, a: v }; }); return { ok: true, alloc: v };
};
A.war_fund = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), m = clamp(Math.round(Number(body.amount) || 0), 50, 20000); let fund = 0, tre = 0;
  const ok = await cas(pr.code, d => { const cost = m / 1000; if (d.treasury < cost) return false; d.treasury = r2(d.treasury - cost); const wf = accrue(d, w.year); wf.m = r0(wf.m + m); fund = wf.m; tre = d.treasury; }); if (!ok) bad('Kas negara tidak cukup');
  return { ok: true, fund, treasury: tre };
};
A.war_mobilize = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(); let ready = 0, cost = 0;
  const ok = await cas(pr.code, d => { if ((d.gov.mobYear ?? -99) >= w.year) return false; cost = r2(d.gdp * 0.004); if (d.treasury < cost) return false; d.treasury = r2(d.treasury - cost); d.gov.mobYear = w.year; d.gov.readiness = clamp((d.gov.readiness ?? 50) + 8, 0, 100); d.gov.stability = clamp(d.gov.stability - 1, 0, 100); d.gov.approval = clamp(d.gov.approval - 0.5, 0, 100); ready = d.gov.readiness; }); if (!ok) bad('Mobilisasi hanya sekali per tahun simulasi dan butuh kas cukup');
  return { ok: true, readiness: Math.round(ready), cost };
};
A.war_start = async ({ u, body }) => {
  const { row: pr, role } = await actor(u, body.session), vp = role === 'wapres', w = await world(), enemy = String(body.enemy || '').toUpperCase(), alloc = clamp(Math.round(Number(body.alloc) || 0), MIN_ALLOC, MAX_ALLOC);
  if (!(pr.data.war || []).includes(enemy)) bad('Negara Anda tidak sedang berperang dengan negara itu'); const bb = pr.data.gov.battles?.year === w.year ? pr.data.gov.battles : {}, b = (vp ? bb.vp : bb.list) || []; if (b.includes(enemy)) bad('Pertempuran melawan negara ini sudah dihitung tahun ini (latihan tetap bisa)');
  let fund = 0; const ok = await cas(pr.code, d => { const wf = accrue(d, w.year); if (wf.m < alloc) return false; wf.m -= alloc; fund = wf.m; d.gov[vp ? 'warOpVp' : 'warOp'] = { enemy, alloc, ts: Date.now(), year: w.year }; }); if (!ok) bad('Anggaran Perang tidak cukup. Danai dari kas negara atau kurangi alokasi.');
  const g = (await sb.from('cm_countries').select('data').eq('code', pr.code).single()).data.data.gov; return { ok: true, fund, alloc, role, shares: shares(g.alloc?.a || ALLOC0), readiness: Math.round(g.readiness ?? 50) };
};
const FX = { menang: { a: 2, s: 1, g: 0.4, rd: -1, ea: -1, eg: -0.8, er: -4 }, seri: { a: -1, s: -1, g: -0.4, rd: -2, ea: -0.5, eg: -0.4, er: -2 }, kalah: { a: -3, s: -2, g: -1.2, rd: -5, ea: 1, eg: 0.3, er: -1 } };
A.war_result = async ({ u, body }) => {
  const { row: pr, role } = await actor(u, body.session), vp = role === 'wapres', OPK = vp ? 'warOpVp' : 'warOp', w = await world(), enemy = String(body.enemy || '').toUpperCase(), outcome = String(body.outcome || ''), margin = clamp(Math.round(Number(body.margin) || 0), 0, 100), secs = Number(body.secs) || 0;
  if (!FX[outcome]) bad('Hasil tidak valid'); const op = pr.data.gov[OPK]; if (!op || op.enemy !== enemy || op.year !== w.year || Date.now() - op.ts > 40 * 60_000) bad('Mulai pertempuran lewat Medan Perang 3D terlebih dahulu'); if (secs < 25) bad('Pertempuran terlalu singkat untuk dihitung');
  const nukes = clamp(Math.round(Number(body.nukes) || 0), 0, 1), nuked = clamp(Math.round(Number(body.nuked) || 0), 0, 1), spent = clamp(Math.round(Number(body.spent) || 0), 0, op.alloc), refund = r0((op.alloc - spent) * 0.8);
  const heroKills = clamp(Math.round(Number(body.heroKills) || 0), 0, 200), heroDeaths = clamp(Math.round(Number(body.heroDeaths) || 0), 0, 20), heroic = outcome === 'menang' && heroKills >= 8 ? 1 : 0, reckless = heroDeaths >= 2 ? 1 : 0, sc = vp ? .6 : 1;
  const f = FX[outcome], k = clamp(0.6 + margin / 100 * 0.8, 0.6, 1.4) * sc, er = must(await sb.from('cm_countries').select('data,president_uid').eq('code', enemy).maybeSingle()), en = er?.data?.name || enemy;
  const ok = await cas(pr.code, d => { const o = d.gov[OPK]; if (!o || o.enemy !== enemy || o.year !== w.year) return false; delete d.gov[OPK]; const B = d.gov.battles?.year === w.year ? d.gov.battles : { year: w.year, list: [], vp: [] }; d.gov.battles = { year: w.year, list: vp ? B.list || [] : [...(B.list || []), enemy], vp: vp ? [...(B.vp || []), enemy] : B.vp || [] }; const wf = accrue(d, w.year); wf.m = r0(wf.m + refund);
    d.gov.approval = clamp(d.gov.approval + f.a * k - (nukes ? 2 : 0) - (nuked ? 3 : 0) + heroic * 1 - reckless * 1, 0, 100); d.gov.stability = clamp(d.gov.stability + f.s - (nukes ? 3 : 0) - (nuked ? 3 : 0), 0, 100); d.gdp = r2(d.gdp * (1 + (f.g - (nuked ? 1.5 : 0)) / 100)); d.gov.readiness = clamp((d.gov.readiness ?? 50) + f.rd, 0, 100);
    if (nukes) { d.gov.trust = clamp(d.gov.trust - 8, 0, 100); d.gov.nukes = (d.gov.nukes || 0) + 1; d.gov.invest = clamp((d.gov.invest ?? 50) - 4, 0, 100); } });
  if (!ok) bad('Pertempuran sudah dihitung, coba lagi');
  if (er && !er.president_uid) await cas(enemy, d => { d.gov.approval = clamp(d.gov.approval + f.ea * k - (nuked ? 3 : 0), 0, 100); d.gdp = r2(d.gdp * (1 + (f.eg - (nukes ? 1.5 : 0)) / 100)); d.gov.readiness = clamp((d.gov.readiness ?? 50) + f.er * k, 0, 100); }, true);
  const title = outcome === 'menang' ? `Pasukan ${pr.data.name} menang atas ${en} di medan perang` : outcome === 'kalah' ? `Pasukan ${pr.data.name} dikalahkan ${en} di medan perang` : `Pertempuran ${pr.data.name} melawan ${en} berakhir imbang`;
  const news = [{ year: w.year, country: pr.code, source: 'Kantor Berita Global', kind: 'konflik', title, body: `${vp ? 'Wakil Presiden' : 'Presiden'} ${vp ? (must(await sb.from('cm_offices').select('name').eq('uid', u.id).eq('office', 'wapres').maybeSingle())?.name || '') : pr.data.gov.president} ikut bertempur langsung di Medan Perang 3D (selisih ${margin}%, ${Math.round(secs)} detik). Dana operasi terpakai ${spent} juta USD.` }];
  if (nukes) news.push({ year: w.year, country: null, source: 'Kantor Berita Global', kind: 'konflik', title: `${pr.data.name} MELUNCURKAN SENJATA NUKLIR terhadap ${en}`, body: 'Dunia mengecam keras penggunaan senjata nuklir; hubungan diplomatik merosot dan investasi lari.' });
  if (nuked) news.push({ year: w.year, country: pr.code, source: 'Kantor Berita Global', kind: 'konflik', title: `${en} meluncurkan serangan nuklir ke pasukan ${pr.data.name}`, body: 'Korban besar jatuh di medan perang; masyarakat panik dan ekonomi terguncang.' });
  await sb.from('cm_news').insert(news);
  if (nukes) { // kecaman dunia: hubungan 30 ekonomi terbesar (NPC) ke negara pelaku merosot
    const top = must(await sb.from('cm_countries').select('code,slim,president_uid').order('code')).filter(r => !r.president_uid && r.code !== pr.code).sort((a, b) => (b.slim?.gdp || 0) - (a.slim?.gdp || 0)).slice(0, 30);
    await Promise.all(top.map(r => cas(r.code, d => { d.rel = d.rel || {}; d.rel[pr.code] = clamp((d.rel[pr.code] || 0) - (r.code === enemy ? 45 : 14), -100, 100); }, true))); }
  let peace = false; if (outcome === 'menang' && margin >= 40 && er && !er.president_uid) { const ex = must(await sb.from('cm_offers').select('id').eq('kind', 'peace').eq('from_c', enemy).eq('to_c', pr.code).eq('status', 'pending')); if (!ex.length) { await sb.from('cm_offers').insert({ kind: 'peace', from_c: enemy, to_c: pr.code, status: 'pending', year: w.year }); peace = true; } }
  return { ok: true, outcome, role, approval: r2(f.a * k + heroic - reckless), stability: f.s, gdp: f.g, readiness: f.rd, refund, spent, nukes, heroic: !!heroic, reckless: !!reckless, peaceOffer: peace };
};

// ---------- PvP (pemain vs pemain): lobi pertandingan; simulasi berjalan di tiap klien, sinkron lewat Supabase Realtime (broadcast) ----------
const PVP_WAIT = 150_000, pvpGet = async (id) => { const m = must(await sb.from('cm_pvp').select('*').eq('id', String(id || '')).maybeSingle()); if (!m) bad('Pertandingan tidak ditemukan', 404); return m; };
A.pvp_create = async ({ u, body }) => {
  const { row: pr } = await actor(u, body.session), enemy = String(body.enemy || '').toUpperCase(); if (!(pr.data.war || []).includes(enemy)) bad('Negara Anda tidak sedang berperang dengan negara itu');
  const er = must(await sb.from('cm_countries').select('code,president_uid,president_seen').eq('code', enemy).maybeSingle()); if (!er || !live(er, PRES_TTL * 2) || er.president_uid === u.id) return { ok: true, pvp: false };
  await sb.from('cm_pvp').update({ status: 'cancel' }).eq('a_uid', u.id).eq('status', 'wait');
  const cfg = body.cfg && typeof body.cfg === 'object' ? body.cfg : {}; if (JSON.stringify(cfg).length > 20000) bad('Konfigurasi terlalu besar');
  const m = must(await sb.from('cm_pvp').insert({ a_code: pr.code, b_code: enemy, a_uid: u.id, b_uid: er.president_uid, cfg }).select('id').single());
  return { ok: true, pvp: true, id: m.id, wait: PVP_WAIT / 1000 };
};
A.pvp_poll = async ({ u }) => { const since = new Date(Date.now() - PVP_WAIT).toISOString(); const ms = must(await sb.from('cm_pvp').select('id,a_code,b_code,created_at').eq('b_uid', u.id).eq('status', 'wait').gt('created_at', since).order('created_at', { ascending: false }).limit(3)); return { matches: ms }; };
A.pvp_status = async ({ u, body }) => { const m = await pvpGet(body.id); if (m.a_uid !== u.id && m.b_uid !== u.id) bad('Bukan peserta', 403); return { status: m.status, result: m.result }; };
A.pvp_join = async ({ u, body }) => { const m = await pvpGet(body.id); if (m.b_uid !== u.id) bad('Anda bukan lawan pertandingan ini', 403); if (m.status !== 'wait' || Date.now() - new Date(m.created_at).getTime() > PVP_WAIT + 15000) bad('Pertandingan sudah berakhir atau kedaluwarsa'); must(await sb.from('cm_pvp').update({ status: 'live', joined_at: new Date().toISOString() }).eq('id', m.id).eq('status', 'wait').select('id')); return { ok: true, id: m.id, a: m.a_code, b: m.b_code, cfg: m.cfg }; };
A.pvp_cancel = async ({ u, body }) => { const m = await pvpGet(body.id); if (m.a_uid !== u.id) bad('Bukan penantang', 403); await sb.from('cm_pvp').update({ status: 'cancel' }).eq('id', m.id).eq('status', 'wait'); return { ok: true }; };
A.pvp_end = async ({ u, body }) => { const m = await pvpGet(body.id); if (m.a_uid !== u.id && m.b_uid !== u.id) bad('Bukan peserta', 403); await sb.from('cm_pvp').update({ status: 'done', result: { by: m.a_uid === u.id ? 'a' : 'b', outcome: String(body.outcome || '').slice(0, 10) } }).eq('id', m.id).neq('status', 'done'); return { ok: true }; };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const u = await authUser(req), out = await A[action]({ u, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
