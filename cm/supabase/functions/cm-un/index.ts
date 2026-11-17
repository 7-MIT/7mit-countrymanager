// @ts-nocheck
// country.7mit — Sidang Majelis Umum PBB (UNGA): ruang sidang 3D multipemain. Kehadiran & posisi (polling), obrolan, pidato presiden
// (dinilai Gemini; memengaruhi hubungan antarnegara), dan percakapan dengan delegasi NPC. Ketua sidang = admin UN (Chair of UN).
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r2 = (v) => Math.round(v * 100) / 100, PRES_TTL = 60_000, sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clip = (v, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const txt = (v, max, name, min = 1) => { const s = String(v ?? '').trim(); if (s.length < min) bad(`${name} wajib diisi (min ${min} karakter)`); if (s.length > max) bad(`${name} maksimal ${max} karakter`); return s; };
async function authUser(req) { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401); const u = data.user, md = u.user_metadata || {}; return { id: u.id, email: (u.email || '').toLowerCase(), name: String(md.full_name || md.name || (u.email || 'Warga').split('@')[0]).slice(0, 40) }; }
async function profile(u) { let p = must(await sb.from('cm_profiles').select('*').eq('uid', u.id).maybeSingle()); if (!p) p = must(await sb.from('cm_profiles').insert({ uid: u.id, name: u.name }).select().single()); if (p.banned) bad('Akun Anda dibatasi oleh admin UN', 403); return p; }
const world = async () => must(await sb.from('cm_world').select('year').eq('id', 1).single());
const live = (r, ttl) => !!(r?.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < ttl);
async function presRow(u, session) { if (!session) return null; const r = must(await sb.from('cm_countries').select('code,data,president_seen').eq('president_uid', u.id).eq('president_session', session).maybeSingle()); return r && live(r, PRES_TTL * 2) ? r : null; }
async function cas(code, fn) { for (let i = 0; i < 6; i++) { const row = (await sb.from('cm_countries').select('data,slim,ver').eq('code', code).single()).data; if (!row) return false; const d = structuredClone(row.data); if (fn(d) === false) return false;
  const r = await sb.from('cm_countries').update({ data: d, slim: { ...row.slim, approval: d.gov.approval, stability: d.gov.stability }, ver: row.ver + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('ver', row.ver).select('code'); if (r.data?.length) return true; await sleep(40 + Math.random() * 120 * (i + 1)); } return false; }
let KEY = null; const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
async function llm(prompt, maxMs = 30000) {
  if (KEY === null) KEY = (await sb.from('cm_secrets').select('v').eq('k', 'gemini_key').maybeSingle()).data?.v || ''; if (!KEY) return null; const t0 = Date.now();
  for (const m of MODELS) for (let a = 0; a < 2; a++) { if (Date.now() - t0 > maxMs) return null;
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.max(3000, maxMs - (Date.now() - t0))), headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 2000 } }) });
      if (r.status === 503 || r.status === 429) { await sleep(600); continue; } if (!r.ok) break; const j = await r.json(), t = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || ''; return JSON.parse(t.replace(/^```json|```$/g, '').trim()); } catch (e) { /* model berikutnya */ } }
  return null; }
const ROLE_NAME = { ketua: 'Ketua Sidang (Chair of UN)', presiden: 'Kepala Negara', wapres: 'Wakil Presiden', menlu: 'Menteri Luar Negeri', pejabat: 'Pejabat Delegasi', warga: 'Warga (pengamat)', pengunjung: 'Pengunjung' };
const sessionNo = (y) => Math.max(1, y - 1945);
async function roleOf(u, p, session) {
  const adm = must(await sb.from('cm_admins').select('email').eq('email', u.email).maybeSingle()); if (adm) return { role: 'ketua', country: p.citizenship || null };
  const pr = await presRow(u, session); if (pr) return { role: 'presiden', country: pr.code };
  const off = must(await sb.from('cm_offices').select('office,country').eq('uid', u.id)); const o = off[0]; if (o) return { role: o.office === 'wapres' ? 'wapres' : o.office === 'men_luar' ? 'menlu' : 'pejabat', country: o.country };
  return { role: p.citizenship ? 'warga' : 'pengunjung', country: p.citizenship || null };
}
async function ensureSession(year) {
  let s = must(await sb.from('cm_unga_sessions').select('*').eq('year', year).maybeSingle()); if (s) return s;
  const cs = must(await sb.from('cm_countries').select('slim')), wars = cs.filter(c => (c.slim?.war || []).length).length, infl = cs.reduce((a, c) => a + (c.slim?.infl || 0), 0) / Math.max(1, cs.length), growth = cs.reduce((a, c) => a + (c.slim?.growth || 0), 0) / Math.max(1, cs.length);
  const o = await llm(`Kamu Sekretariat PBB dalam game simulasi politik (data fiksi). Susun tema dan 3 agenda Sidang Majelis Umum PBB ke-${sessionNo(year)} tahun ${year}. Keadaan dunia: ${wars} negara sedang berperang, rata-rata inflasi ${infl.toFixed(1)}%, rata-rata pertumbuhan ${growth.toFixed(1)}%. Bahasa Indonesia, ringkas. Keluarkan JSON: {"theme":"tema maks 90 karakter","agenda":["agenda 1 (maks 90 karakter)","agenda 2","agenda 3"]}`);
  const theme = clip(o?.theme, 120) || `Perdamaian dan Kerja Sama Dunia ${year}`, agenda = (o?.agenda || ['Keamanan dan perdamaian dunia', 'Pembangunan ekonomi berkelanjutan', 'Bantuan kemanusiaan']).slice(0, 3).map(x => clip(x, 120));
  const ins = await sb.from('cm_unga_sessions').upsert({ year, theme, agenda }, { onConflict: 'year' }).select().single(); if (ins.error) return { year, theme, agenda };
  await sb.from('cm_news').insert({ year, country: null, source: 'Harian Dunia', kind: 'pengumuman', title: `Sidang Majelis Umum PBB ke-${sessionNo(year)} dibuka: ${theme}`, body: `Para pemimpin negara diundang ke markas PBB untuk berpidato dan berdiskusi. Agenda: ${agenda.join('; ')}.` }); return ins.data;
}
const logRows = async (year, after = 0) => must(await sb.from('cm_unga_log').select('id,uid,name,country,role,kind,body,ts').eq('year', year).gt('id', after).order('id', { ascending: false }).limit(after ? 60 : 40)).reverse();

const A = {};
A.unga_join = async ({ u, p, body }) => {
  const w = await world(), me = await roleOf(u, p, body.session), s = await ensureSession(w.year), speeches = must(await sb.from('cm_unga_speeches').select('country,summary,resonance').eq('year', w.year));
  await sb.from('cm_unga_presence').upsert({ uid: u.id, name: p.name, country: me.country, role: me.role, x: 0, z: 14, ry: Math.PI, sit: false, ts: new Date().toISOString() }, { onConflict: 'uid' });
  const spoke = me.country ? speeches.some(x => x.country === me.country) : false;
  return { year: w.year, no: sessionNo(w.year), theme: s.theme, agenda: s.agenda, me: { uid: u.id, name: p.name, role: me.role, roleName: ROLE_NAME[me.role], country: me.country, canSpeak: me.role === 'presiden' && !spoke, spoke, chair: me.role === 'ketua' }, speeches, log: await logRows(w.year) };
};
A.unga_sync = async ({ u, p, body }) => {
  const w = await world(), x = clamp(Number(body.x) || 0, -60, 60), z = clamp(Number(body.z) || 0, -60, 60), ry = Number(body.ry) || 0;
  const cur = must(await sb.from('cm_unga_presence').select('role,country').eq('uid', u.id).maybeSingle()); let role = cur?.role, country = cur?.country; if (!cur) { const me = await roleOf(u, p, body.session); role = me.role; country = me.country; }
  await sb.from('cm_unga_presence').upsert({ uid: u.id, name: p.name, country, role, x, z, ry, sit: !!body.sit, ts: new Date().toISOString() }, { onConflict: 'uid' });
  const since = new Date(Date.now() - 12_000).toISOString(), others = must(await sb.from('cm_unga_presence').select('uid,name,country,role,x,z,ry,sit').gt('ts', since).neq('uid', u.id).limit(80));
  return { others, log: await logRows(w.year, Number(body.after) || 0) };
};
A.unga_leave = async ({ u }) => { await sb.from('cm_unga_presence').delete().eq('uid', u.id); return { ok: true }; };
A.unga_say = async ({ u, p, body }) => {
  const w = await world(), text = txt(body.text, 200, 'Pesan', 1), last = must(await sb.from('cm_unga_log').select('ts').eq('uid', u.id).order('id', { ascending: false }).limit(1))[0]; if (last && Date.now() - new Date(last.ts).getTime() < 1200) bad('Terlalu cepat, tunggu sebentar');
  const pr = must(await sb.from('cm_unga_presence').select('role,country').eq('uid', u.id).maybeSingle()); await sb.from('cm_unga_log').insert({ year: w.year, uid: u.id, name: p.name, country: pr?.country || p.citizenship || null, role: pr?.role || 'warga', kind: 'chat', body: text }); return { ok: true };
};
A.unga_chair = async ({ u, p, body }) => {
  const pr = must(await sb.from('cm_unga_presence').select('role').eq('uid', u.id).maybeSingle()); if (pr?.role !== 'ketua') bad('Hanya Ketua Sidang (admin UN) yang dapat membuat pengumuman sidang', 403);
  const w = await world(); await sb.from('cm_unga_log').insert({ year: w.year, uid: u.id, name: p.name, country: null, role: 'ketua', kind: 'chair', body: txt(body.text, 300, 'Pengumuman', 3) }); return { ok: true };
};
A.unga_speech = async ({ u, p, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya kepala negara (presiden yang sedang menjabat) yang dapat berpidato di podium', 403);
  const w = await world(), text = txt(body.text, 1500, 'Pidato', 40), ex = must(await sb.from('cm_unga_speeches').select('year').eq('year', w.year).eq('country', pr.code).maybeSingle()); if (ex) bad('Negara Anda sudah berpidato pada sidang tahun ini');
  const c = pr.data, s = await ensureSession(w.year), others = must(await sb.from('cm_countries').select('code,slim')).filter(x => x.code !== pr.code).sort((a, b) => (b.slim?.gdp || 0) - (a.slim?.gdp || 0)).slice(0, 14);
  const o = await llm(`Kamu mensimulasikan Sidang Majelis Umum PBB ke-${sessionNo(w.year)} (tema "${s.theme}") dalam game simulasi politik (data fiksi). Presiden ${c.gov.president} dari ${c.name} (PDB ${c.gdp.toFixed(0)} M$, kepuasan ${Math.round(c.gov.approval)}%, ${(c.war || []).length ? 'sedang berperang' : 'damai'}) berpidato:\n"${clip(text, 1500)}"\nNilai pidato (kejelasan, relevansi dengan tema/agenda, kredibilitas, nada diplomatik). Delegasi yang hadir: ${others.map(x => `[${x.code}] ${x.slim?.name}`).join('; ')}.\nKeluarkan JSON: {"summary":"ringkasan netral pidato maks 180 karakter","resonance":0-100,"reactions":[{"c":"KODE","said":"tanggapan delegasi 1 kalimat maks 150 karakter"}],"rel":[{"c":"KODE","d":-6..6}],"approval":-1..2}. Beri 3 reaksi dan 3-6 perubahan hubungan (positif bila pidato resonan dengan negara itu, negatif bila pidato menyinggungnya).`);
  const reso = clamp(Math.round(Number(o?.resonance) || 50), 0, 100), summary = clip(o?.summary, 200) || 'Pidato disampaikan di hadapan Majelis Umum.', reactions = (o?.reactions || []).slice(0, 3).filter(x => x?.c && x.said), rels = (o?.rel || []).slice(0, 6).filter(x => x?.c && Number.isFinite(Number(x.d))), appr = clamp(Number(o?.approval) || (reso > 60 ? 1 : 0), -1, 2);
  must(await sb.from('cm_unga_speeches').insert({ year: w.year, country: pr.code, uid: u.id, body: text, summary, resonance: reso }));
  for (const r of rels) { const code = String(r.c).toUpperCase(), d = clamp(Number(r.d), -6, 6); if (code === pr.code || !others.some(x => x.code === code)) continue; await cas(code, cc => { cc.rel = cc.rel || {}; cc.rel[pr.code] = clamp((cc.rel[pr.code] || 0) + d, -100, 100); }); }
  await cas(pr.code, cc => { cc.gov.approval = clamp(cc.gov.approval + appr, 0, 100); cc.gov.trust = clamp(cc.gov.trust + (reso > 70 ? 1 : reso < 35 ? -1 : 0), 0, 100); });
  await sb.from('cm_unga_log').insert([{ year: w.year, uid: u.id, name: p.name, country: pr.code, role: 'presiden', kind: 'speech', body: text }, ...reactions.map(x => ({ year: w.year, uid: null, name: `Delegasi ${others.find(y => y.code === String(x.c).toUpperCase())?.slim?.name || x.c}`, country: String(x.c).toUpperCase(), role: 'npc', kind: 'npc', body: clip(x.said, 180) }))]);
  await sb.from('cm_news').insert({ year: w.year, country: pr.code, source: 'Harian Dunia', kind: 'diplomasi', title: `Presiden ${c.gov.president} berpidato di Majelis Umum PBB`, body: `${summary} (resonansi ${reso}/100)` });
  return { ok: true, resonance: reso, summary, approval: appr, reactions: reactions.length };
};
A.unga_talk = async ({ u, p, body }) => {
  const w = await world(), npc = body.npc || {}, kind = ['delegate', 'sg', 'guard', 'journalist', 'staff', 'interpreter'].includes(npc.kind) ? npc.kind : 'staff', text = txt(body.text, 300, 'Pesan', 1);
  const me = must(await sb.from('cm_unga_presence').select('role,country').eq('uid', u.id).maybeSingle()), lastTalk = must(await sb.from('cm_unga_log').select('ts').eq('uid', u.id).eq('kind', 'talk').order('id', { ascending: false }).limit(1))[0]; if (lastTalk && Date.now() - new Date(lastTalk.ts).getTime() < 2500) bad('Tunggu sebentar sebelum berbicara lagi');
  let ctx = ''; let target = null; if (kind === 'delegate' && npc.country) { target = must(await sb.from('cm_countries').select('code,data').eq('code', String(npc.country).toUpperCase()).maybeSingle()); if (target) { const c = target.data; ctx = `Kamu duta besar/delegasi ${c.name}; presidenmu ${c.gov.president} (watak agresif ${(c.ai?.tr?.hawk ?? .5).toFixed(1)}, hati-hati ${(c.ai?.tr?.caut ?? .5).toFixed(1)}); ekonomi: tumbuh ${c.growth.toFixed(1)}%, inflasi ${c.infl.toFixed(1)}%; ${(c.war || []).length ? 'negaramu sedang berperang' : 'negaramu damai'}; hubunganmu dengan negara lawan bicara: ${me?.country ? (c.rel?.[me.country] || 0) : 0}.`; } }
  const roleTxt = { delegate: 'delegasi negara', sg: 'Sekretaris Jenderal PBB', guard: 'petugas keamanan PBB', journalist: 'jurnalis internasional', staff: 'staf protokol PBB', interpreter: 'juru bahasa PBB' }[kind];
  const o = await llm(`Kamu memerankan ${roleTxt} bernama "${clip(npc.name, 40)}" di ruang Sidang Majelis Umum PBB dalam game simulasi politik (data fiksi). ${ctx}\nLawan bicara: ${p.name} (${ROLE_NAME[me?.role] || 'warga'}${me?.country ? ' dari negara ' + me.country : ''}). Dia berkata: "${clip(text, 300)}"\nJawab sesuai perananmu, 1-3 kalimat bahasa Indonesia (boleh diplomatis, curiga, ramah, atau humor tipis). ${kind === 'delegate' ? 'Bila lawan bicara pejabat negara dan pembicaraan konstruktif, hubungan negaramu bisa membaik sedikit; bila menyinggung, memburuk.' : ''}\nKeluarkan JSON: {"reply":"jawabanmu maks 280 karakter","rel":-3..3}`);
  const reply = clip(o?.reply, 300) || 'Terima kasih atas perhatiannya. Mari kita lanjutkan sidang.', d = clamp(Math.round(Number(o?.rel) || 0), -3, 3);
  let rel = 0; if (kind === 'delegate' && target && me?.country && ['presiden', 'menlu', 'wapres'].includes(me.role) && d !== 0) { const done = must(await sb.from('cm_unga_talks').select('uid').eq('uid', u.id).eq('year', w.year).eq('npc', target.code).maybeSingle()); if (!done) { await sb.from('cm_unga_talks').insert({ uid: u.id, year: w.year, npc: target.code }); await cas(target.code, cc => { cc.rel = cc.rel || {}; cc.rel[me.country] = clamp((cc.rel[me.country] || 0) + d, -100, 100); }); rel = d; } }
  await sb.from('cm_unga_log').insert({ year: w.year, uid: u.id, name: p.name, country: me?.country || null, role: me?.role || 'warga', kind: 'talk', body: `→ ${clip(npc.name, 40)}: ${clip(text, 120)}` });
  return { ok: true, reply, rel };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const u = await authUser(req), p = await profile(u), out = await A[action]({ u, p, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
