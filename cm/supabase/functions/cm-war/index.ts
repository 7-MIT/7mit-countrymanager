// @ts-nocheck
// country.7mit — Hasil pertempuran Medan Perang 3D diterapkan ke perang yang sedang berlangsung (sekali per lawan per tahun simulasi).
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r2 = (v) => Math.round(v * 100) / 100, sleep = (ms) => new Promise(r => setTimeout(r, ms)), PRES_TTL = 60_000;
async function authUser(req) { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401); return { id: data.user.id }; }
const live = (r, ttl) => !!(r?.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < ttl);
async function presRow(u, session) { if (!session) return null; const r = must(await sb.from('cm_countries').select('code,data,president_uid,president_seen').eq('president_uid', u.id).eq('president_session', session).maybeSingle()); return r && live(r, PRES_TTL * 2) ? r : null; }
async function cas(code, fn, npcOnly = false) {
  for (let i = 0; i < 6; i++) { const row = (await sb.from('cm_countries').select('data,slim,ver,president_uid').eq('code', code).single()).data; if (!row || (npcOnly && row.president_uid)) return false; const d = structuredClone(row.data); if (fn(d) === false) return false;
    const r = await sb.from('cm_countries').update({ data: d, slim: { ...row.slim, war: d.war, approval: d.gov.approval, stability: d.gov.stability, treasury: d.treasury, debt: d.debt, gdp: d.gdp }, ver: row.ver + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('ver', row.ver).select('code'); if (r.data?.length) return true; await sleep(40 + Math.random() * 120 * (i + 1)); }
  return false; }
const FX = { menang: { a: 2, s: 1, g: 0.4, rd: -1, ea: -1, eg: -0.8, er: -4 }, seri: { a: -1, s: -1, g: -0.4, rd: -2, ea: -0.5, eg: -0.4, er: -2 }, kalah: { a: -3, s: -2, g: -1.2, rd: -5, ea: 1, eg: 0.3, er: -1 } };
const A = {};
A.war_result = async ({ u, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya presiden yang sedang menjabat yang dapat memimpin pertempuran', 403);
  const enemy = String(body.enemy || '').toUpperCase(), outcome = String(body.outcome || ''), margin = clamp(Math.round(Number(body.margin) || 0), 0, 100), secs = Number(body.secs) || 0;
  if (!FX[outcome]) bad('Hasil tidak valid'); if (!(pr.data.war || []).includes(enemy)) bad('Negara Anda tidak sedang berperang dengan negara itu'); if (secs < 25) bad('Pertempuran terlalu singkat untuk dihitung');
  const w = must(await sb.from('cm_world').select('year').eq('id', 1).single()), b = pr.data.gov.battles?.year === w.year ? pr.data.gov.battles.list || [] : [];
  if (b.includes(enemy)) bad('Pertempuran melawan negara ini sudah dihitung pada tahun simulasi ini (latihan tetap bisa dimainkan)');
  const f = FX[outcome], k = clamp(0.6 + margin / 100 * 0.8, 0.6, 1.4), er = must(await sb.from('cm_countries').select('data,president_uid').eq('code', enemy).maybeSingle()), en = er?.data?.name || enemy;
  const ok = await cas(pr.code, d => { const L = d.gov.battles?.year === w.year ? d.gov.battles.list || [] : []; if (L.includes(enemy)) return false; d.gov.battles = { year: w.year, list: [...L, enemy] }; d.gov.approval = clamp(d.gov.approval + f.a * k, 0, 100); d.gov.stability = clamp(d.gov.stability + f.s, 0, 100); d.gdp = r2(d.gdp * (1 + f.g / 100)); d.gov.readiness = clamp((d.gov.readiness ?? 50) + f.rd, 0, 100); });
  if (!ok) bad('Pertempuran sudah dihitung, coba lagi');
  if (er && !er.president_uid) await cas(enemy, d => { d.gov.approval = clamp(d.gov.approval + f.ea * k, 0, 100); d.gdp = r2(d.gdp * (1 + f.eg / 100)); d.gov.readiness = clamp((d.gov.readiness ?? 50) + f.er * k, 0, 100); }, true);
  const title = outcome === 'menang' ? `Pasukan ${pr.data.name} menang atas ${en} di medan perang` : outcome === 'kalah' ? `Pasukan ${pr.data.name} dikalahkan ${en} di medan perang` : `Pertempuran ${pr.data.name} melawan ${en} berakhir imbang`;
  await sb.from('cm_news').insert({ year: w.year, country: pr.code, source: 'Kantor Berita Global', kind: 'konflik', title, body: `Presiden ${pr.data.gov.president} memimpin langsung pasukan di Medan Perang 3D (selisih ${margin}%, ${Math.round(secs)} detik).` });
  let peace = false; if (outcome === 'menang' && margin >= 40 && er && !er.president_uid) { const ex = must(await sb.from('cm_offers').select('id').eq('kind', 'peace').eq('from_c', enemy).eq('to_c', pr.code).eq('status', 'pending')); if (!ex.length) { await sb.from('cm_offers').insert({ kind: 'peace', from_c: enemy, to_c: pr.code, status: 'pending', year: w.year }); peace = true; } }
  return { ok: true, outcome, approval: r2(f.a * k), stability: f.s, gdp: f.g, readiness: f.rd, peaceOffer: peace };
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const u = await authUser(req), out = await A[action]({ u, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
