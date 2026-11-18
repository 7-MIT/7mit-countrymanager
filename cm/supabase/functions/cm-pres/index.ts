// @ts-nocheck
// country.7mit — Pusat Pemerintahan: hak prerogatif presiden (koalisi parlemen, pembubaran DPR & pemilu dini, dekret darurat,
// penunjukan langsung pejabat, amnesti). Partai & kursi NPC mengikuti data negara; keputusan partai/aktor NPC disimulasikan Gemini.
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100, PRES_TTL = 60_000, sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clip = (v, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const txt = (v, max, name, min = 1) => { const s = String(v ?? '').trim(); if (s.length < min) bad(`${name} wajib diisi (min ${min} karakter)`); if (s.length > max) bad(`${name} maksimal ${max} karakter`); return s; };
async function authUser(req) { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401); const u = data.user, md = u.user_metadata || {}; return { id: u.id, email: (u.email || '').toLowerCase(), name: String(md.full_name || md.name || (u.email || 'Warga').split('@')[0]).slice(0, 40) }; }
async function profile(u) { let p = must(await sb.from('cm_profiles').select('*').eq('uid', u.id).maybeSingle()); if (!p) p = must(await sb.from('cm_profiles').insert({ uid: u.id, name: u.name }).select().single()); if (p.banned) bad('Akun Anda dibatasi oleh admin UN', 403); return p; }
const world = async () => must(await sb.from('cm_world').select('year').eq('id', 1).single());
const live = (r, ttl) => !!(r?.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < ttl);
async function presRow(u, session) { if (!session) return null; const r = must(await sb.from('cm_countries').select('code,data,president_uid,president_seen').eq('president_uid', u.id).eq('president_session', session).maybeSingle()); return r && live(r, PRES_TTL * 2) ? r : null; }
async function news(year, country, kind, title, body = '') { await sb.from('cm_news').insert({ year, country, source: 'Harian Dunia', kind, title: clip(title, 200), body: clip(body, 600) }); }
async function cas(code, fn) { for (let i = 0; i < 6; i++) { const row = (await sb.from('cm_countries').select('data,slim,ver').eq('code', code).single()).data; if (!row) return false; const d = structuredClone(row.data); if (fn(d) === false) return false;
  const r = await sb.from('cm_countries').update({ data: d, slim: { ...row.slim, war: d.war, approval: d.gov.approval, corruption: d.gov.corruption, prosperity: d.gov.prosperity, stability: d.gov.stability, treasury: d.treasury, debt: d.debt, gdp: d.gdp }, ver: row.ver + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('ver', row.ver).select('code'); if (r.data?.length) return true; await sleep(40 + Math.random() * 120 * (i + 1)); } return false; }
let KEY = null; const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
async function llm(prompt, maxMs = 35000) {
  if (KEY === null) KEY = (await sb.from('cm_secrets').select('v').eq('k', 'gemini_key').maybeSingle()).data?.v || ''; if (!KEY) return null; const t0 = Date.now();
  for (const m of MODELS) for (let a = 0; a < 2; a++) { if (Date.now() - t0 > maxMs) return null;
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.max(3000, maxMs - (Date.now() - t0))), headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.85, maxOutputTokens: 2000 } }) });
      if (r.status === 503 || r.status === 429) { await sleep(700); continue; } if (!r.ok) break; const j = await r.json(), t = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || ''; return JSON.parse(t.replace(/^```json|```$/g, '').trim()); } catch (e) { /* model berikutnya */ } }
  return null; }
const dos = (c) => `${c.name} (presiden ${c.gov.president}; ideologi ${c.gov.ideology}; PDB ${c.gdp.toFixed(1)} M$, kepuasan ${Math.round(c.gov.approval)}%, kepercayaan ${Math.round(c.gov.trust)}, korupsi ${Math.round(c.gov.corruption)}, stabilitas ${Math.round(c.gov.stability)}, inflasi ${c.infl.toFixed(1)}%, pengangguran ${c.unemp.toFixed(1)}%)`;

const FXK = { corruption: 'korupsi', trust: 'kepercayaan publik', approval: 'kepuasan rakyat', invest: 'investasi', prosperity: 'kemakmuran', stability: 'stabilitas' };
const sumAbs = (fx) => Object.values(fx).reduce((a, v) => a + Math.abs(v), 0), costOf = (fx) => r2(clamp(0.1 + 0.12 * sumAbs(fx), 0.05, 1.5));
function cleanFx(raw) { const fx = {}; for (const k of Object.keys(FXK)) { const v = Number(raw?.[k]); if (Number.isFinite(v) && Math.abs(v) >= 0.05) fx[k] = r1(clamp(v, -3, 3)); } if (!Object.keys(fx).length) bad('Pilih minimal satu dampak yang berarti'); if (sumAbs(fx) > 8) bad('Total dampak terlalu besar (maks 8 poin per tahun)'); return fx; }
const OFF = { wapres: ['Wakil Presiden', 1, 4], men_dalam: ['Menteri Dalam Negeri', 1, 4], men_luar: ['Menteri Luar Negeri', 1, 4], men_kesehatan: ['Menteri Kesehatan', 1, 4], men_pendidikan: ['Menteri Pendidikan', 1, 4], men_keuangan: ['Menteri Keuangan', 1, 4], men_pertahanan: ['Menteri Pertahanan', 1, 4], men_infrastruktur: ['Menteri Infrastruktur', 1, 4], men_sosial: ['Menteri Sosial', 1, 4], men_perdagangan: ['Menteri Perdagangan', 1, 4], hakim: ['Hakim Mahkamah Agung', 5, 8], jaksa: ['Jaksa Agung', 1, 4], bank: ['Gubernur Bank Sentral', 1, 5] };
const seatsOf = (c) => (c.gov.parties || []).map(p => ({ name: p.name, seats: p.seats ?? 0, coal: (c.gov.coalition || []).includes(p.name) }));
const coalSeats = (c) => seatsOf(c).filter(p => p.coal).reduce((a, p) => a + p.seats, 0);
async function needPres(u, session) { const r = await presRow(u, session); if (!r) bad('Hanya presiden yang sedang menjabat yang dapat melakukan ini', 403); return r; }

const A = {};
A.pres_state = async ({ u, p, body }) => {
  const code = String(body.country || p.citizenship || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(code)) bad('Negara tidak valid'); const w = await world(), row = must(await sb.from('cm_countries').select('data').eq('code', code).maybeSingle()); if (!row) bad('Negara tidak ditemukan', 404); const c = row.data, g = c.gov, pr = body.session ? await presRow(u, body.session) : null, isPres = !!pr && pr.code === code;
  let citizens = []; if (isPres) { const cs = must(await sb.from('cm_profiles').select('uid,name').eq('citizenship', code).limit(80)), off = must(await sb.from('cm_offices').select('uid,office').eq('country', code)); citizens = cs.filter(x => x.uid !== u.id).map(x => ({ uid: x.uid, name: x.name, office: off.find(o => o.uid === x.uid)?.office || null })); }
  const leg = g.leg || {}, coalY = g.coalYear?.year === w.year ? g.coalYear.n : 0;
  return { year: w.year, country: code, isPresident: isPres, president: g.president, party: g.party || null, parties: seatsOf(c), coalSeats: coalSeats(c), majority: coalSeats(c) >= 51, coalLeft: Math.max(0, 3 - coalY), dissolveOk: w.year - (leg.dissolved ?? -99) >= 4, decreeLeft: g.decreeYear === w.year ? 0 : 1, amnestyOk: w.year - (g.amnestyYear ?? -99) >= 2, citizens, offices: Object.fromEntries(Object.entries(OFF).map(([k, v]) => [k, { name: v[0], max: v[1] }])) };
};
A.coalition_set = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), c = pr.data, party = String(body.party || ''), join = !!body.join, ps = seatsOf(c), P = ps.find(x => x.name === party); if (!P) bad('Partai tidak ditemukan');
  const coalY = c.gov.coalYear?.year === w.year ? c.gov.coalYear.n : 0; if (coalY >= 3) bad('Maksimal 3 perubahan koalisi per tahun simulasi');
  if (join === P.coal) bad(join ? 'Partai sudah ada di koalisi' : 'Partai bukan anggota koalisi');
  let why = '';
  if (join) { const o = (await llm(`Kamu pimpinan partai "${party}" (${P.seats} dari 100 kursi parlemen) di ${dos(c)}. Partai pemerintah: ${c.gov.party || '-'}; koalisi sekarang ${coalSeats(c)} kursi. Presiden mengundang partaimu bergabung dalam koalisi pemerintah. Pertimbangkan popularitas pemerintah (kepuasan ${Math.round(c.gov.approval)}%), korupsi, dan ambisi politik (jatah kursi, pemilu berikutnya). Keluarkan JSON: {"accept":true|false,"why":"satu kalimat pernyataan partai, maks 170 karakter"}`)) || {}; if (typeof o?.accept !== 'boolean') o.accept = c.gov.approval >= 45; if (!o.accept) { await cas(pr.code, cc => { cc.gov.coalYear = { year: w.year, n: coalY + 1 }; }); await news(w.year, pr.code, 'politik', `${party} menolak bergabung dengan koalisi pemerintah ${c.name}`, clip(o.why, 200)); return { ok: true, accepted: false, note: clip(o.why, 200) || 'Partai menolak bergabung.' }; } why = clip(o.why, 200); }
  await cas(pr.code, cc => { const set = new Set(cc.gov.coalition || []); join ? set.add(party) : set.delete(party); cc.gov.coalition = [...set]; cc.gov.coalYear = { year: w.year, n: coalY + 1 }; });
  const after = ps.filter(x => (x.name === party ? join : x.coal)).reduce((a, x) => a + x.seats, 0);
  if (!join && after < 51) { await cas(pr.code, cc => { cc.gov.stability = clamp(cc.gov.stability - 1.5, 0, 100); cc.gov.approval = clamp(cc.gov.approval - 1, 0, 100); }); }
  await news(w.year, pr.code, 'politik', join ? `${party} bergabung dengan koalisi pemerintah ${c.name} (${after} kursi)` : `${party} keluar dari koalisi ${c.name}${after < 51 ? ': pemerintah kehilangan mayoritas' : ''}`, why);
  return { ok: true, accepted: true, seats: after, note: why || (join ? 'Partai bergabung.' : 'Partai dikeluarkan dari koalisi.') };
};
A.parliament_dissolve = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), c = pr.data, leg = c.gov.leg || {}; if (w.year - (leg.dissolved ?? -99) < 4) bad('Parlemen hanya dapat dibubarkan sekali per 4 tahun simulasi');
  const reason = txt(body.reason, 300, 'Alasan pembubaran', 10), cs = coalSeats(c), approval = c.gov.approval, ps = seatsOf(c);
  // pemilu dini: kursi partai digeser mengikuti kepuasan rakyat (koalisi naik bila pemerintah populer)
  const wts = ps.map(x => Math.max(1, x.seats) * (x.coal ? (approval > 55 ? 1.2 : approval < 45 ? 0.75 : 1) : (approval < 45 ? 1.25 : approval > 55 ? 0.85 : 1)) * (0.85 + Math.random() * 0.3)), tot = wts.reduce((a, b) => a + b, 0), raw = wts.map(x => x / tot * 100), base = raw.map(Math.floor); let left = 100 - base.reduce((a, b) => a + b, 0); raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => base[i]++);
  const penalty = cs >= 51;
  await cas(pr.code, cc => { cc.gov.parties = cc.gov.parties.map((p, i) => ({ ...p, seats: base[i] })); cc.gov.leg = { ...(cc.gov.leg || {}), next: w.year + 1, called: w.year, dissolved: w.year }; if (penalty) { cc.gov.approval = clamp(cc.gov.approval - 2, 0, 100); cc.gov.stability = clamp(cc.gov.stability - 2, 0, 100); } });
  const nc = ps.map((x, i) => `${x.name} ${base[i]}`).join(', ');
  await news(w.year, pr.code, 'politik', `Presiden ${c.gov.president} MEMBUBARKAN parlemen ${c.name}; pemilu dini digelar`, `${clip(reason, 200)} Kursi hasil pemilu dini: ${nc}.`);
  const ncoal = ps.reduce((a, x, i) => a + (x.coal ? base[i] : 0), 0); return { ok: true, seats: base, coalSeats: ncoal, penalty, note: `Pemilu dini selesai. Koalisi kini ${ncoal} kursi.` };
};
A.decree = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), c = pr.data; if (c.gov.decreeYear === w.year) bad('Dekret darurat hanya satu per tahun simulasi');
  if (Object.keys(c.gov.customLaws || {}).length >= 15) bad('Batas 15 undang-undang custom tercapai; cabut sebagian dahulu');
  const name = txt(body.name, 80, 'Judul dekret', 4), desc = txt(body.desc, 600, 'Isi dekret', 10), fx = cleanFx(body.fx); if (Object.values(c.gov.customLaws || {}).some(l => l.name === name)) bad('Aturan dengan judul ini sudah berlaku');
  const law = { id: 'd' + Date.now().toString(36) + Math.floor(Math.random() * 99), name: 'Perppu: ' + name, desc, cat: 'dekret', fx, cost: costOf(fx), year: w.year, by: `Presiden ${c.gov.president} (dekret darurat)`, kind: 'dekret' };
  await cas(pr.code, cc => { cc.gov.decreeYear = w.year; (cc.gov.customLaws ||= {})[law.id] = law; for (const [k, v] of Object.entries(fx)) cc.gov[k] = clamp((cc.gov[k] ?? 50) + v * 0.5, 0, 100); cc.gov.trust = clamp(cc.gov.trust - 3, 0, 100); cc.gov.stability = clamp(cc.gov.stability - 2, 0, 100); cc.gov.approval = clamp(cc.gov.approval - 1, 0, 100); });
  await news(w.year, pr.code, 'politik', `Presiden ${c.gov.president} menerbitkan dekret darurat: ${name}`, `Tanpa pembahasan parlemen. ${clip(desc, 200)} Dapat diuji materi di Mahkamah Agung.`);
  return { ok: true, law, note: 'Dekret berlaku seketika (kepercayaan −3, stabilitas −2, kepuasan −1).' };
};
A.appoint_direct = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), c = pr.data, office = String(body.office), O = OFF[office]; if (!O) bad('Jabatan tidak dapat diisi lewat penunjukan langsung');
  const t = must(await sb.from('cm_profiles').select('uid,name,citizenship').eq('uid', String(body.uid)).maybeSingle()); if (!t || t.citizenship !== pr.code) bad('Calon harus warga negara ini', 400);
  if (must(await sb.from('cm_countries').select('code').eq('president_uid', t.uid).maybeSingle())) bad('Calon sedang menjabat presiden');
  const mine = must(await sb.from('cm_offices').select('*').eq('uid', t.uid)); if (mine.length) bad('Calon sudah memegang jabatan lain; ia harus mundur dahulu');
  const cur = must(await sb.from('cm_offices').select('id').eq('country', pr.code).eq('office', office)); if (cur.length >= O[1]) { if (O[1] === 1) await sb.from('cm_offices').delete().eq('id', cur[0].id); else bad('Kursi jabatan ini sudah penuh; berhentikan salah satu pejabat dahulu'); }
  await sb.from('cm_offices').insert({ country: pr.code, office, uid: t.uid, name: t.name, since_year: w.year, end_year: w.year + O[2], pitch: 'Ditunjuk langsung oleh presiden' });
  await news(w.year, pr.code, 'politik', `Presiden ${c.gov.president} menunjuk ${t.name} sebagai ${O[0]} ${c.name}`, 'Penunjukan langsung (hak prerogatif presiden).'); return { ok: true };
};
A.amnesty = async ({ u, body }) => {
  const pr = await needPres(u, body.session), w = await world(), c = pr.data; if (w.year - (c.gov.amnestyYear ?? -99) < 2) bad('Amnesti hanya dapat diberikan sekali per 2 tahun simulasi'); const scope = txt(body.scope, 300, 'Lingkup amnesti', 8);
  const o = await llm(`Presiden ${c.gov.president} memberi amnesti: "${scope}" di ${dos(c)} (game simulasi, data fiksi). Nilai reaksi publik dan lembaga. Keluarkan JSON: {"reaction":"satu kalimat reaksi publik, maks 200 karakter","a":angka kepuasan -2..2,"s":angka stabilitas -1..2,"t":angka kepercayaan -3..1}`);
  const a = clamp(Number(o?.a) || 0, -2, 2), s = clamp(Number(o?.s) || 1, -1, 2), t = clamp(Number(o?.t) || -1, -3, 1);
  await cas(pr.code, cc => { cc.gov.amnestyYear = w.year; cc.gov.approval = clamp(cc.gov.approval + a, 0, 100); cc.gov.stability = clamp(cc.gov.stability + s, 0, 100); cc.gov.trust = clamp(cc.gov.trust + t, 0, 100); });
  await news(w.year, pr.code, 'politik', `Presiden ${c.gov.president} memberi amnesti di ${c.name}`, `${clip(scope, 160)} ${clip(o?.reaction, 200)}`); return { ok: true, a, s, t, reaction: clip(o?.reaction, 220) };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const u = await authUser(req), p = await profile(u), out = await A[action]({ u, p, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
