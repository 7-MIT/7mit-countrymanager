// @ts-nocheck
// country.7mit — Politik multipemain: jabatan (wakil presiden, menteri, DPR, hakim, jaksa agung, gubernur bank sentral),
// RUU templat/custom (presiden & anggota DPR), usulan kebijakan, uji materi, serta perang NPC terhadap pemain.
// Syarat jabatan: warga negara tersebut. Keputusan NPC & parlemen/mahkamah disimulasikan Gemini (kunci di tabel privat cm_secrets).
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100, PRES_TTL = 60_000;
const rng = (str) => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
const pick = (R, a) => a[Math.floor(R() * a.length)];
const clip = (v, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const txt = (v, max, name, min = 1) => { const s = String(v ?? '').trim(); if (s.length < min) bad(`${name} wajib diisi (min ${min} karakter)`); if (s.length > max) bad(`${name} maksimal ${max} karakter`); return s; };
const cc = (v) => { const s = String(v ?? '').toUpperCase(); if (!/^[A-Z]{2}$/.test(s)) bad('Kode negara tidak valid'); return s; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shared = (a, b) => (a.mem || []).some(x => x !== 'UN' && (b.mem || []).includes(x));

// ---------- auth ----------
async function authUser(req) {
  const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401);
  const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401);
  const u = data.user, md = u.user_metadata || {};
  return { id: u.id, email: (u.email || '').toLowerCase(), name: String(md.full_name || md.name || (u.email || 'Warga').split('@')[0]).slice(0, 40) };
}
async function profile(u) { let p = must(await sb.from('cm_profiles').select('*').eq('uid', u.id).maybeSingle()); if (!p) p = must(await sb.from('cm_profiles').insert({ uid: u.id, name: u.name }).select().single()); if (p.banned) bad('Akun Anda dibatasi oleh admin UN', 403); return p; }
const world = async () => must(await sb.from('cm_world').select('year,gov_year').eq('id', 1).single());
const getC = async (code) => { const r = must(await sb.from('cm_countries').select('code,data,slim,ver,president_uid,president_seen,president_session').eq('code', code).maybeSingle()); if (!r) bad('Negara tidak ditemukan', 404); return r; };
const live = (r, ttl = PRES_TTL) => !!(r?.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < ttl);
async function presRow(u, session) { if (!session) return null; const r = must(await sb.from('cm_countries').select('code,data,president_seen').eq('president_uid', u.id).eq('president_session', session).maybeSingle()); return r && live(r, PRES_TTL * 2) ? r : null; }
async function news(year, country, kind, title, body = '', source = 'Harian Dunia') { await sb.from('cm_news').insert({ year, country, source, kind, title: clip(title, 200), body: clip(body, 600) }); }
async function cas(code, fn) { // ubah data negara dengan penguncian optimistik; slim ikut disinkronkan agar klien melihat perubahan
  for (let i = 0; i < 6; i++) { const row = (await sb.from('cm_countries').select('data,slim,ver').eq('code', code).single()).data; if (!row) return false; const d = structuredClone(row.data); if (fn(d) === false) return false;
    const r = await sb.from('cm_countries').update({ data: d, slim: { ...row.slim, war: d.war, approval: d.gov.approval, corruption: d.gov.corruption, prosperity: d.gov.prosperity, stability: d.gov.stability, treasury: d.treasury, debt: d.debt, gdp: d.gdp }, ver: row.ver + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('ver', row.ver).select('code'); if (r.data?.length) return true; await sleep(40 + Math.random() * 120 * (i + 1)); }
  return false;
}

// ---------- Gemini ----------
let KEY = null; const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
async function llm(prompt, maxMs = 40000) {
  if (KEY === null) KEY = (await sb.from('cm_secrets').select('v').eq('k', 'gemini_key').maybeSingle()).data?.v || '';
  if (!KEY) return null; const t0 = Date.now();
  for (const m of MODELS) for (let a = 0; a < 2; a++) {
    if (Date.now() - t0 > maxMs) return null;
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.max(3000, maxMs - (Date.now() - t0))), headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.85, maxOutputTokens: 3000 } }) });
      if (r.status === 503 || r.status === 429) { await sleep(700); continue; } if (!r.ok) break;
      const j = await r.json(), t = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || ''; return JSON.parse(t.replace(/^```json|```$/g, '').trim()); } catch (e) { /* model berikutnya */ } }
  return null;
}
const dos = (c) => `${c.name} (presiden ${c.gov.president}; ideologi ${c.gov.ideology}; PDB ${c.gdp.toFixed(1)} M$, tumbuh ${c.growth.toFixed(1)}%, inflasi ${c.infl.toFixed(1)}%, pengangguran ${c.unemp.toFixed(1)}%, kepuasan ${Math.round(c.gov.approval)}%, kepercayaan ${Math.round(c.gov.trust)}, korupsi ${Math.round(c.gov.corruption)}, stabilitas ${Math.round(c.gov.stability)}, investasi ${Math.round(c.gov.invest)}, kemakmuran ${Math.round(c.gov.prosperity)}, kesiapan militer ${Math.round(c.gov.readiness ?? 50)}, ${c.war?.length ? 'berperang dengan ' + c.war.join(',') : 'damai'}; watak presiden agresif ${(c.ai?.tr.hawk ?? 0.5).toFixed(1)}, populis ${(c.ai?.tr.pop ?? 0.5).toFixed(1)}, liberal ${(c.ai?.tr.lib ?? 0.5).toFixed(1)}, hati-hati ${(c.ai?.tr.caut ?? 0.5).toFixed(1)})`;

// ---------- jabatan ----------
const POL_RANGE = { rate: [0, 50], taxInc: [0, 70], taxCorp: [0, 60], spend: [0, 40], infra: [0, 10], edu: [0, 10], welfare: [0, 15], tariff: [0, 80], defense: [0, 12], health: [0, 12], family: [0, 100], migration: [0, 100] };
const POL_NAME = { rate: 'suku bunga', taxInc: 'pajak penghasilan', taxCorp: 'pajak korporasi', spend: 'belanja pemerintah', infra: 'anggaran infrastruktur', edu: 'anggaran pendidikan', welfare: 'bantuan sosial', tariff: 'tarif impor', defense: 'anggaran pertahanan', health: 'anggaran kesehatan', family: 'program keluarga', migration: 'keterbukaan migrasi' };
const OFFICES = {
  wapres: { name: 'Wakil Presiden', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['spend', 'infra', 'edu', 'welfare', 'tariff', 'defense', 'health', 'family', 'migration'] },
  men_dalam: { name: 'Menteri Dalam Negeri', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['family', 'migration'], cab: 'dalam' },
  men_luar: { name: 'Menteri Luar Negeri', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['tariff'], cab: 'luar' },
  men_kesehatan: { name: 'Menteri Kesehatan', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['health'], cab: 'kesehatan' },
  men_pendidikan: { name: 'Menteri Pendidikan', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['edu'], cab: 'pendidikan' },
  men_keuangan: { name: 'Menteri Keuangan', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['spend'] },
  men_pertahanan: { name: 'Menteri Pertahanan', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['defense'] },
  men_infrastruktur: { name: 'Menteri Infrastruktur', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['infra'] },
  men_sosial: { name: 'Menteri Sosial', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['welfare'] },
  men_perdagangan: { name: 'Menteri Perdagangan', grp: 'Eksekutif', max: 1, term: 4, by: 'presiden', dom: ['tariff'] },
  dpr: { name: 'Anggota Parlemen', grp: 'Legislatif', max: 10, term: 5, by: 'parlemen' },
  hakim: { name: 'Hakim Mahkamah Agung', grp: 'Yudikatif', max: 5, term: 8, by: 'presiden' },
  jaksa: { name: 'Jaksa Agung', grp: 'Yudikatif', max: 1, term: 4, by: 'presiden' },
  bank: { name: 'Gubernur Bank Sentral', grp: 'Eksekutif', max: 1, term: 5, by: 'presiden' },
};
const officeMeta = () => Object.fromEntries(Object.entries(OFFICES).map(([k, v]) => [k, { name: v.name, grp: v.grp, max: v.max, term: v.term, by: v.by, dom: v.dom || [] }]));
async function cleanOffices(code, year) { // jabatan gugur otomatis: bukan warga lagi / jadi presiden / masa jabatan habis
  const rows = must(await sb.from('cm_offices').select('*').eq('country', code)); if (!rows.length) return rows;
  const uids = rows.map(r => r.uid), profs = must(await sb.from('cm_profiles').select('uid,citizenship').in('uid', uids)), pres = must(await sb.from('cm_countries').select('president_uid').in('president_uid', uids));
  const cit = new Map(profs.map(p => [p.uid, p.citizenship])), ps = new Set(pres.map(p => p.president_uid)), keep = [], drop = [];
  for (const r of rows) (cit.get(r.uid) !== code || ps.has(r.uid) || r.end_year < year ? drop : keep).push(r);
  if (drop.length) await sb.from('cm_offices').delete().in('id', drop.map(d => d.id)); return keep;
}
const holdsOf = (rows, uid) => rows.filter(r => r.uid === uid);
async function myOffice(uid) { return must(await sb.from('cm_offices').select('*').eq('uid', uid)); }
const needOffice = async (u, p, office, session) => { const code = p.citizenship; if (!code) bad('Anda belum menjadi warga negara mana pun', 403); const w = await world(); const rows = await cleanOffices(code, w.year), me = rows.find(r => r.uid === u.id && r.office === office); if (!me) bad(`Anda bukan ${OFFICES[office]?.name || 'pejabat'} di negara ini`, 403); return { code, w, me }; };

// ---------- RUU: templat & custom ----------
const FXK = { corruption: 'korupsi (negatif = lebih bersih)', trust: 'kepercayaan publik', approval: 'kepuasan rakyat', invest: 'iklim investasi', prosperity: 'kemakmuran', stability: 'stabilitas' };
const TEMPLATES = [
  { id: 't_antisuap', name: 'UU Pemberantasan Suap', cat: 'antikorupsi', desc: 'Menjerat penyuap dan penerima suap dengan hukuman berat serta penyitaan aset.', fx: { corruption: -2.5, trust: 1.5 }, cost: 0.25 },
  { id: 't_pers', name: 'UU Kebebasan Pers', cat: 'hak', desc: 'Menjamin media bebas dari sensor pemerintah; liputan kritis meningkat.', fx: { trust: 2, corruption: -1, stability: -0.3 }, cost: 0.05 },
  { id: 't_ham', name: 'UU Hak Asasi & Kebebasan Sipil', cat: 'hak', desc: 'Memperluas jaminan hak sipil, hak berkumpul, dan perlindungan minoritas.', fx: { approval: 1.5, trust: 1.5, stability: -0.5 }, cost: 0.1 },
  { id: 't_ekdigital', name: 'UU Ekonomi Digital', cat: 'ekonomi', desc: 'Kerangka hukum e-commerce, pembayaran digital, dan startup.', fx: { invest: 2.5, prosperity: 0.8, corruption: 0.3 }, cost: 0.3 },
  { id: 't_umkm', name: 'UU Pemberdayaan UMKM', cat: 'ekonomi', desc: 'Kredit murah, pelatihan, dan akses pasar bagi usaha kecil.', fx: { prosperity: 1.5, approval: 0.8, invest: 0.4 }, cost: 0.4 },
  { id: 't_antimonopoli', name: 'UU Persaingan Usaha', cat: 'ekonomi', desc: 'Membatasi kartel dan monopoli agar pasar lebih sehat.', fx: { invest: 1, corruption: -1, approval: 0.5 }, cost: 0.1 },
  { id: 't_privatisasi', name: 'UU Privatisasi BUMN', cat: 'ekonomi', desc: 'Menjual sebagian BUMN untuk efisiensi dan pemasukan; kontroversial.', fx: { invest: 2.5, corruption: -0.5, approval: -1.5, prosperity: -0.5 }, cost: 0.05 },
  { id: 't_upah', name: 'UU Upah Minimum Layak', cat: 'kesejahteraan', desc: 'Menaikkan upah minimum; pekerja senang, pengusaha khawatir.', fx: { prosperity: 1.2, approval: 1, invest: -1.2 }, cost: 0.2 },
  { id: 't_pendidikan_gratis', name: 'UU Pendidikan Dasar Gratis', cat: 'kesejahteraan', desc: 'Sekolah dasar dan menengah tanpa biaya bagi seluruh anak.', fx: { prosperity: 1.2, approval: 1.5 }, cost: 0.6 },
  { id: 't_jkn', name: 'UU Jaminan Kesehatan Semesta', cat: 'kesejahteraan', desc: 'Asuransi kesehatan universal yang dibiayai negara.', fx: { prosperity: 1, approval: 1.5, stability: 0.5 }, cost: 0.7 },
  { id: 't_perumahan', name: 'UU Perumahan Rakyat', cat: 'kesejahteraan', desc: 'Subsidi dan kredit rumah murah bagi keluarga berpenghasilan rendah.', fx: { prosperity: 1.2, approval: 1.2 }, cost: 0.5 },
  { id: 't_agraria', name: 'UU Reforma Agraria', cat: 'kesejahteraan', desc: 'Redistribusi tanah untuk petani kecil; pemilik lahan besar menolak.', fx: { prosperity: 1.5, stability: 0.8, invest: -0.8 }, cost: 0.3 },
  { id: 't_pajak_kekayaan', name: 'UU Pajak Kekayaan', cat: 'kesejahteraan', desc: 'Pajak progresif atas kekayaan sangat besar untuk pemerataan.', fx: { prosperity: 1.2, approval: 0.6, invest: -1.5 }, cost: 0.1 },
  { id: 't_energi_hijau', name: 'UU Energi Terbarukan', cat: 'lingkungan', desc: 'Insentif surya, angin, dan panas bumi serta batas emisi.', fx: { invest: 1, approval: 0.5, prosperity: 0.3 }, cost: 0.45 },
  { id: 't_lingkungan', name: 'UU Perlindungan Lingkungan', cat: 'lingkungan', desc: 'Sanksi pencemaran dan perlindungan hutan; industri kena biaya.', fx: { approval: 0.8, trust: 0.5, invest: -0.8, prosperity: 0.4 }, cost: 0.2 },
  { id: 't_keamanan', name: 'UU Keamanan Nasional', cat: 'keamanan', desc: 'Memperluas wewenang aparat menjaga ketertiban; kebebasan sipil menyempit.', fx: { stability: 2, approval: -1.2, trust: -0.8 }, cost: 0.2 },
  { id: 't_siber', name: 'UU Keamanan Siber', cat: 'keamanan', desc: 'Melindungi infrastruktur digital dan data warga.', fx: { stability: 1, trust: 0.5, invest: 0.8 }, cost: 0.2 },
  { id: 't_imigrasi', name: 'UU Imigrasi Terbuka', cat: 'ekonomi', desc: 'Visa kerja lebih mudah untuk tenaga ahli dan pekerja asing.', fx: { invest: 1, prosperity: 0.8, approval: -0.5 }, cost: 0.1 },
  { id: 't_otonomi', name: 'UU Otonomi Daerah', cat: 'tata negara', desc: 'Memberi daerah wewenang dan dana lebih besar.', fx: { stability: 0.8, corruption: 0.5, approval: 0.8 }, cost: 0.15 },
];
const sumAbs = (fx) => Object.values(fx).reduce((a, v) => a + Math.abs(v), 0);
const costOf = (fx) => r2(clamp(0.1 + 0.12 * sumAbs(fx), 0.05, 1.5));
function cleanFx(raw) { const fx = {}; for (const k of Object.keys(FXK)) { const v = Number(raw?.[k]); if (Number.isFinite(v) && Math.abs(v) >= 0.05) fx[k] = r1(clamp(v, -3, 3)); } if (!Object.keys(fx).length) bad('Pilih minimal satu dampak yang berarti'); if (sumAbs(fx) > 8) bad('Total dampak terlalu besar (maks 8 poin per tahun)'); return fx; }
function lawFrom(body, by, year) {
  const t = body.template ? TEMPLATES.find(x => x.id === body.template) : null; if (body.template && !t) bad('Templat tidak dikenal');
  const name = txt(body.name ?? t?.name, 80, 'Judul RUU', 4), desc = txt(body.desc ?? t?.desc, 600, 'Isi RUU', 10);
  const fx = t && !body.fx ? t.fx : cleanFx(body.fx), cost = t && !body.fx ? t.cost : costOf(fx);
  return { id: 'x' + Date.now().toString(36) + Math.floor(Math.random() * 99), name, desc, cat: t?.cat || 'custom', fx, cost, year, by, kind: t ? 'templat' : 'custom' };
}
function coalitionSeats(c) { const ps = c.gov.parties || [], tot = ps.reduce((a, p) => a + (p.w || 1), 0) || 1, co = ps.filter(p => (c.gov.coalition || []).includes(p.name)).reduce((a, p) => a + (p.w || 1), 0); return clamp(Math.round(co / tot * 100), 5, 95); }
async function floorVote(c, law, sponsor, speech, salt) { // sidang parlemen 100 kursi disimulasikan Gemini, dibatasi ±25 suara dari baseline statistik
  const cs = coalitionSeats(c), R = rng(`${c.code}|${law.id}|${salt}`), fxs = Object.entries(law.fx).map(([k, v]) => `${FXK[k]} ${v > 0 ? '+' : ''}${v}`).join(', ');
  const base = clamp(0.3 + 0.45 * cs / 100 + (c.gov.approval - 50) * 0.002 - sumAbs(law.fx) * 0.008 - law.cost * 0.04 + (sponsor.role === 'presiden' ? 0.05 : 0) + (R() - 0.5) * 0.06, 0.08, 0.92);
  const yes0 = Math.round(base * 95), abs0 = 5, no0 = 100 - yes0 - abs0, parties = (c.gov.parties || []).map(x => x.name).slice(0, 5).join(', ') || 'partai-partai';
  const o = await llm(`Kamu mensimulasikan sidang parlemen 100 kursi dalam game simulasi (data fiksi) untuk negara ${dos(c)}.\nPartai: ${parties}. Kursi koalisi pemerintah: ${cs}.\nRUU "${law.name}": ${law.desc}\nDampak tahunan: ${fxs}; biaya ${law.cost}% PDB per tahun.\nPengusul: ${sponsor.role} ${sponsor.name}${speech ? `. Pidato pengusul: "${clip(speech, 400)}"` : ''}.\nModel statistik memprediksi: setuju ${yes0}, menolak ${no0}, abstain ${abs0}.\nTentukan hasil akhir realistis (boleh menyimpang maksimal 25 suara bila pidato pengusul meyakinkan/lemah atau ada alasan politik kuat) dan tulis 3 kutipan debat anggota parlemen dari partai berbeda (salah satunya menanggapi pidato pengusul bila ada), bahasa Indonesia, maks 160 karakter. yes+no+abstain harus 100.\nKeluarkan JSON: {"yes":int,"no":int,"abstain":int,"debate":[{"who":"Nama (Partai)","said":"..."}]}`);
  let yes = yes0, no = no0, abs = abs0, debate = [];
  if (o && [o.yes, o.no, o.abstain].every(Number.isInteger) && o.yes + o.no + o.abstain === 100 && o.yes >= 0 && o.no >= 0 && o.abstain >= 0 && Math.abs(o.yes - yes0) <= 25) { yes = o.yes; no = o.no; abs = o.abstain; debate = (o.debate || []).slice(0, 3).map(x => ({ who: clip(x?.who, 60), said: clip(x?.said, 170) })).filter(x => x.who && x.said); }
  return { yes, no, abstain: abs, passed: yes > 50, coalition: cs, debate };
}
function enact(c, law, half = true) { // efek langsung 50% saat disahkan; efek penuh tiap tahun lewat war_turn
  const g = c.gov; (g.customLaws ||= {})[law.id] = law; if (half) for (const [k, v] of Object.entries(law.fx)) g[k] = clamp((g[k] ?? 50) + v * 0.5, 0, 100);
}
const lawLine = (l) => `${l.name} (${Object.entries(l.fx).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}; biaya ${l.cost}% PDB/thn)`;

// ---------- keputusan NPC (presiden NPC / lembaga) ----------
async function npcJudge(c, what, ctx, fallback = true) { // -> {accept, why}
  const o = await llm(`Kamu menjadi presiden NPC dalam game simulasi (data fiksi): ${dos(c)}.\nKamu memutuskan: ${what}\n${ctx}\nPutuskan sesuai watak, ideologi, kepentingan politik, dan keadaan negara. Keluarkan JSON: {"accept":true|false,"why":"satu kalimat pernyataan, bahasa Indonesia, maks 170 karakter"}`);
  return typeof o?.accept === 'boolean' ? { accept: o.accept, why: clip(o.why, 200) } : { accept: fallback, why: '' };
}
const presLive = async (code) => { const r = await getC(code); return live(r, PRES_TTL * 2) ? r : null; };

// ---------- aksi ----------
const A = {};
A.law_templates = async () => ({ templates: TEMPLATES, fxKeys: FXK });
A.law_draft = async ({ u, body }) => { // Gemini (Badan Legislasi) merancang dampak RUU dari judul & maksud
  const name = txt(body.name, 80, 'Judul RUU', 4), desc = txt(body.desc, 600, 'Maksud RUU', 10);
  const o = await llm(`Kamu Badan Legislasi di game simulasi politik (data fiksi). Rancang dampak seimbang untuk RUU berikut.\nJudul: ${name}\nMaksud: ${desc}\nDampak yang boleh (nilai per tahun, antara -3 dan 3, kecil dan realistis; RUU yang menguntungkan satu sisi harus punya efek samping di sisi lain): ${Object.entries(FXK).map(([k, v]) => `${k} = ${v}`).join('; ')}.\nPakai 2-4 dampak. Keluarkan JSON: {"fx":{"kunci":angka},"cat":"antikorupsi|ekonomi|kesejahteraan|lingkungan|keamanan|hak|tata negara","why":"satu kalimat analisis dampak, maks 200 karakter","risks":["risiko 1","risiko 2"]}`);
  let fx; try { fx = cleanFx(o?.fx); } catch (e) { fx = null; } if (!fx) bad('Badan Legislasi belum dapat merancang dampak RUU ini. Atur dampaknya secara manual.');
  return { fx, cost: costOf(fx), cat: clip(o.cat, 30) || 'custom', why: clip(o.why, 220), risks: (o.risks || []).slice(0, 3).map(x => clip(x, 140)) };
};
A.gov_state = async ({ u, p, body }) => {
  const code = cc(body.country || p.citizenship || 'ID'), w = await world(), row = await getC(code), c = row.data, rows = await cleanOffices(code, w.year);
  const myPres = body.session ? await presRow(u, body.session) : null, isPres = !!myPres && myPres.code === code, mine = (await myOffice(u.id)), mineHere = mine.filter(m => m.country === code);
  const apps = isPres ? must(await sb.from('cm_applications').select('*').eq('country', code).eq('status', 'pending').order('id')) : must(await sb.from('cm_applications').select('*').eq('country', code).eq('uid', u.id).order('id', { ascending: false }).limit(5));
  const props = isPres ? must(await sb.from('cm_proposals').select('*').eq('country', code).eq('status', 'pending').order('id')) : must(await sb.from('cm_proposals').select('*').eq('country', code).eq('uid', u.id).order('id', { ascending: false }).limit(8));
  const npc = {}; for (const [k, o] of Object.entries(OFFICES)) if (o.cab && c.gov.cabinet?.[o.cab]) npc[k] = c.gov.cabinet[o.cab].name;
  const g = c.gov, bills = g.billsYear?.year === w.year ? g.billsYear.n : 0;
  return { year: w.year, country: code, citizen: p.citizenship === code, isPresident: isPres, presidentLive: live(row, PRES_TTL * 2), president: c.gov.president, offices: officeMeta(), holders: rows.map(r => ({ id: r.id, office: r.office, uid: r.uid, name: r.name, since: r.since_year, end: r.end_year, me: r.uid === u.id })), npc, mine: mineHere, hasOtherOffice: mine.some(m => m.country !== code), apps, proposals: props, customLaws: g.customLaws || {}, laws: g.laws || [], billsLeft: Math.max(0, 3 - bills), parties: (g.parties || []).map(x => x.name), coalition: g.coalition || [], seats: coalitionSeats(c) };
};
A.office_apply = async ({ u, p, body }) => {
  const office = String(body.office), O = OFFICES[office]; if (!O) bad('Jabatan tidak dikenal'); const code = cc(body.country); if (p.citizenship !== code) bad('Hanya warga negara ini yang dapat melamar jabatan di sini', 403);
  const pitch = txt(body.pitch, 400, 'Surat lamaran / visi', 10), w = await world(), row = await getC(code), c = row.data;
  if (must(await sb.from('cm_countries').select('code').eq('president_uid', u.id).maybeSingle())) bad('Presiden tidak dapat merangkap jabatan lain', 403);
  const rows = await cleanOffices(code, w.year); if ((await myOffice(u.id)).length) bad('Anda sudah memegang satu jabatan. Mundur dahulu untuk melamar yang lain.');
  if (rows.filter(r => r.office === office).length >= O.max) bad('Jabatan ini sudah penuh');
  const pend = must(await sb.from('cm_applications').select('id').eq('uid', u.id).eq('status', 'pending')); if (pend.length >= 2) bad('Maksimal 2 lamaran yang sedang menunggu');
  const app = must(await sb.from('cm_applications').insert({ country: code, office, uid: u.id, name: p.name, pitch, year: w.year }).select().single());
  const pr = O.by === 'presiden' ? await presLive(code) : null;
  if (pr) { await news(w.year, code, 'politik', `${p.name} melamar sebagai ${O.name} ${c.name}`, 'Menunggu keputusan presiden.'); return { ok: true, status: 'pending', note: 'Lamaran dikirim ke presiden pemain.' }; }
  // keputusan NPC: presiden NPC / partai-partai parlemen (Gemini) dengan rekam jejak pelamar
  const posts = (await sb.from('cm_posts').select('id,likes', { count: 'exact' }).eq('uid', u.id).eq('country', code).limit(200)), likes = (posts.data || []).reduce((a, x) => a + (x.likes || 0), 0);
  const pet = (await sb.from('cm_petitions').select('id', { count: 'exact', head: true }).eq('uid', u.id).eq('country', code)).count || 0;
  const who = O.by === 'parlemen' ? `partai-partai parlemen yang memilih anggota baru (pilih berdasarkan popularitas dan rekam jejak)` : `presiden`;
  const j = await npcJudge(c, `apakah ${p.name} diterima sebagai ${O.name} (${who} yang memutuskan)`, `Surat lamaran: "${pitch}". Rekam jejak publik pelamar di negara ini: ${posts.count || 0} postingan, total ${likes} suka, ${pet} petisi. Pemegang jabatan lain saat ini: ${rows.filter(r => r.office === office).map(r => r.name).join(', ') || 'tidak ada'}.`, true);
  return await settleApp(app, j.accept, j.why, O.by === 'parlemen' ? 'Partai-partai' : `Presiden ${c.gov.president} (NPC)`, w, c);
};
async function settleApp(app, accept, why, by, w, c) {
  const O = OFFICES[app.office]; const cur = await getC(app.country), rows = await cleanOffices(app.country, w.year);
  if (accept && (rows.filter(r => r.office === app.office).length >= O.max || (await myOffice(app.uid)).length)) { accept = false; why = why || 'Jabatan sudah terisi.'; }
  await sb.from('cm_applications').update({ status: accept ? 'accepted' : 'rejected', note: clip(why, 220), decided_by: by }).eq('id', app.id);
  if (accept) { await sb.from('cm_offices').insert({ country: app.country, office: app.office, uid: app.uid, name: app.name, since_year: w.year, end_year: w.year + O.term, pitch: app.pitch }); await news(w.year, app.country, 'politik', `${app.name} dilantik sebagai ${O.name} ${c.name}`, clip(why, 200)); }
  else await news(w.year, app.country, 'politik', `Lamaran ${app.name} sebagai ${O.name} ditolak`, clip(why, 200));
  return { ok: true, status: accept ? 'accepted' : 'rejected', note: why || (accept ? 'Lamaran diterima.' : 'Lamaran ditolak.') };
}
A.office_decide = async ({ u, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya presiden yang sedang menjabat yang dapat memutuskan', 403);
  const app = must(await sb.from('cm_applications').select('*').eq('id', Number(body.id)).maybeSingle()); if (!app || app.country !== pr.code || app.status !== 'pending') bad('Lamaran tidak ditemukan atau sudah diputuskan', 404);
  const w = await world(); return await settleApp(app, !!body.accept, clip(body.note, 200), `Presiden ${pr.data.gov.president}`, w, pr.data);
};
A.office_resign = async ({ u, p }) => { const mine = await myOffice(u.id); if (!mine.length) bad('Anda tidak memegang jabatan'); await sb.from('cm_offices').delete().in('id', mine.map(m => m.id)); const w = await world(), c = (await getC(mine[0].country)).data; await news(w.year, mine[0].country, 'politik', `${p.name} mengundurkan diri sebagai ${OFFICES[mine[0].office].name} ${c.name}`); return { ok: true }; };
A.office_dismiss = async ({ u, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya presiden yang dapat memberhentikan pejabat', 403);
  const o = must(await sb.from('cm_offices').select('*').eq('id', Number(body.id)).maybeSingle()); if (!o || o.country !== pr.code) bad('Pejabat tidak ditemukan', 404); if (OFFICES[o.office].by !== 'presiden') bad('Jabatan ini tidak dapat diberhentikan presiden (anggota parlemen dipilih partai)', 403);
  if (OFFICES[o.office].grp === 'Yudikatif' && o.office === 'hakim') bad('Hakim tidak dapat diberhentikan presiden (independensi peradilan)', 403);
  await sb.from('cm_offices').delete().eq('id', o.id); const w = await world(); await news(w.year, pr.code, 'politik', `${o.name} diberhentikan dari jabatan ${OFFICES[o.office].name} ${pr.data.name}`, clip(body.note, 200)); return { ok: true };
};

// usulan kebijakan (wakil presiden & menteri) — presiden pemain memutuskan; presiden NPC diputuskan Gemini
function checkPolicy(O, c, key, value) {
  if (!O.dom?.includes(key)) bad(`Jabatan ini tidak berwenang mengusulkan ${POL_NAME[key] || key}`, 403); const [lo, hi] = POL_RANGE[key]; const v = Number(value); if (!Number.isFinite(v) || v < lo || v > hi) bad(`Nilai ${POL_NAME[key]} harus ${lo}–${hi}`);
  const cur = c.pol[key], maxD = Math.max((hi - lo) * 0.12, 0.5); if (Math.abs(v - cur) > maxD + 1e-9) bad(`Perubahan maksimal ±${r1(maxD)} dari nilai sekarang (${cur})`); if (Math.abs(v - cur) < 1e-9) bad('Nilai sama dengan kebijakan sekarang'); return v;
}
async function applyPolicy(code, key, value) { await cas(code, c => { c.pol[key] = value; }); }
A.proposal_create = async ({ u, p, body }) => {
  const office = String(body.office), O = OFFICES[office]; if (!O?.dom) bad('Jabatan ini tidak dapat mengusulkan kebijakan'); const { code, w } = await needOffice(u, p, office);
  const row = await getC(code), c = row.data, key = String(body.key), value = checkPolicy(O, c, key, body.value), reason = txt(body.reason, 300, 'Alasan usulan', 8);
  const rows = must(await sb.from('cm_proposals').select('id,year,status').eq('uid', u.id)), thisYear = rows.filter(x => x.year === w.year);
  if (rows.filter(x => x.status === 'pending').length >= 2) bad('Maksimal 2 usulan sedang menunggu'); if (thisYear.length >= 3) bad('Maksimal 3 usulan per tahun simulasi');
  const pr = await presLive(code);
  const prop = must(await sb.from('cm_proposals').insert({ country: code, office, uid: u.id, name: p.name, kind: 'policy', payload: { key, value, from: c.pol[key] }, reason, year: w.year }).select().single());
  if (pr) { await news(w.year, code, 'politik', `${O.name} ${p.name} mengusulkan ${POL_NAME[key]} ${c.pol[key]} → ${value}`, clip(reason, 200)); return { ok: true, status: 'pending', note: 'Usulan dikirim ke presiden.' }; }
  const j = await npcJudge(c, `apakah usulan ${O.name} ${p.name} diterima: ubah ${POL_NAME[key]} dari ${c.pol[key]} menjadi ${value}`, `Alasan menteri: "${reason}".`, true);
  return await settleProp(prop, j.accept, j.why, `Presiden ${c.gov.president} (NPC)`, w);
};
async function settleProp(prop, accept, why, by, w) {
  const row = await getC(prop.country), c = row.data;
  if (accept && prop.kind === 'policy') { const { key, value } = prop.payload; await applyPolicy(prop.country, key, value); }
  if (accept && prop.kind === 'bill') { const law = prop.payload.law; await cas(prop.country, cc => { enact(cc, law); }); }
  await sb.from('cm_proposals').update({ status: accept ? 'accepted' : 'rejected', note: clip(why, 220), decided_by: by }).eq('id', prop.id);
  if (prop.kind === 'policy') await news(w.year, prop.country, 'politik', `Usulan ${OFFICES[prop.office].name} ${prop.name} ${accept ? 'DISETUJUI' : 'DITOLAK'}: ${POL_NAME[prop.payload.key]} → ${prop.payload.value}`, clip(why, 200));
  else await news(w.year, prop.country, 'politik', accept ? `Presiden menandatangani RUU "${prop.payload.law.name}" usulan ${prop.name}` : `Presiden MEMVETO RUU "${prop.payload.law.name}" usulan ${prop.name}`, clip(why, 200));
  return { ok: true, status: accept ? 'accepted' : 'rejected', note: why || (accept ? 'Disetujui.' : 'Ditolak.') };
}
A.proposal_decide = async ({ u, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya presiden yang sedang menjabat yang dapat memutuskan', 403);
  const prop = must(await sb.from('cm_proposals').select('*').eq('id', Number(body.id)).maybeSingle()); if (!prop || prop.country !== pr.code || prop.status !== 'pending') bad('Usulan tidak ditemukan atau sudah diputuskan', 404);
  const w = await world();
  return await settleProp(prop, !!body.accept, clip(body.note, 200), `Presiden ${pr.data.gov.president}`, w);
};

// RUU oleh presiden (templat/custom) & anggota DPR
A.law_propose = async ({ u, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya presiden yang sedang menjabat yang dapat mengajukan RUU', 403);
  const w = await world(), c = (await getC(pr.code)).data, bills = c.gov.billsYear?.year === w.year ? c.gov.billsYear.n : 0; if (bills >= 3) bad('Maksimal 3 RUU per tahun simulasi');
  if (Object.keys(c.gov.customLaws || {}).length >= 15) bad('Batas 15 undang-undang custom tercapai; cabut sebagian dahulu');
  const law = lawFrom(body, `Presiden ${c.gov.president}`, w.year); if (Object.values(c.gov.customLaws || {}).some(l => l.name === law.name)) bad('UU dengan judul ini sudah berlaku');
  const vote = await floorVote(c, law, { role: 'presiden', name: c.gov.president }, body.speech, bills);
  await cas(pr.code, cc => { cc.gov.billsYear = { year: w.year, n: bills + 1 }; if (vote.passed) { enact(cc, law); } });
  await news(w.year, pr.code, 'politik', `RUU "${law.name}" di ${c.name}: ${vote.passed ? 'DISAHKAN' : 'DITOLAK'}`, `Suara: ${vote.yes} setuju, ${vote.no} menolak, ${vote.abstain} abstain.${vote.debate[0] ? ` ${vote.debate[0].who}: "${vote.debate[0].said}"` : ''}`);
  return { ok: true, vote, law, passed: vote.passed };
};
A.law_repeal = async ({ u, body }) => {
  const pr = await presRow(u, body.session); if (!pr) bad('Hanya presiden yang sedang menjabat yang dapat mencabut UU', 403);
  const w = await world(), c = (await getC(pr.code)).data, law = c.gov.customLaws?.[String(body.id)]; if (!law) bad('UU custom tidak ditemukan', 404);
  const vote = await floorVote(c, { ...law, name: 'Pencabutan ' + law.name, desc: `Mencabut ${law.name}: ${law.desc}`, fx: Object.fromEntries(Object.entries(law.fx).map(([k, v]) => [k, -v])), cost: 0.05, id: law.id + 'r' }, { role: 'presiden', name: c.gov.president }, body.speech, 'cabut');
  if (vote.passed) await cas(pr.code, cc => { delete cc.gov.customLaws[law.id]; });
  await news(w.year, pr.code, 'politik', `Pencabutan "${law.name}" di ${c.name}: ${vote.passed ? 'DISETUJUI' : 'DITOLAK'}`, `Suara: ${vote.yes} setuju, ${vote.no} menolak.`);
  return { ok: true, vote, passed: vote.passed };
};
A.law_mp = async ({ u, p, body }) => {
  const { code, w, me } = await needOffice(u, p, 'dpr'), row = await getC(code), c = row.data, used = must(await sb.from('cm_proposals').select('id').eq('uid', u.id).eq('kind', 'bill').eq('year', w.year)); if (used.length >= 2) bad('Anggota parlemen maksimal 2 RUU per tahun simulasi');
  if (Object.keys(c.gov.customLaws || {}).length >= 15) bad('Batas 15 undang-undang custom tercapai');
  const speech = txt(body.speech, 500, 'Pidato pengusul', 10), law = lawFrom(body, `Anggota parlemen ${p.name}`, w.year); if (Object.values(c.gov.customLaws || {}).some(l => l.name === law.name)) bad('UU dengan judul ini sudah berlaku');
  const vote = await floorVote(c, law, { role: 'anggota parlemen', name: p.name }, speech, 'mp' + used.length);
  const rec = must(await sb.from('cm_proposals').insert({ country: code, office: 'dpr', uid: u.id, name: p.name, kind: 'bill', payload: { law, vote }, reason: clip(speech, 300), year: w.year, status: vote.passed ? 'pending' : 'rejected', note: vote.passed ? '' : 'Ditolak dalam sidang paripurna.', decided_by: vote.passed ? null : 'Parlemen' }).select().single());
  await news(w.year, code, 'politik', `RUU "${law.name}" usulan ${p.name}: ${vote.passed ? 'LOLOS PARLEMEN, menunggu tanda tangan presiden' : 'DITOLAK parlemen'}`, `Suara: ${vote.yes} setuju, ${vote.no} menolak, ${vote.abstain} abstain.${vote.debate[0] ? ` ${vote.debate[0].who}: "${vote.debate[0].said}"` : ''}`);
  if (!vote.passed) return { ok: true, vote, status: 'rejected', passed: false };
  if (await presLive(code)) return { ok: true, vote, status: 'pending', passed: true, note: 'Lolos parlemen. Menunggu tanda tangan presiden (presiden dapat memveto).' };
  const j = await npcJudge(c, `apakah menandatangani atau memveto RUU "${law.name}" yang telah lolos parlemen (usulan anggota parlemen ${p.name})`, `Isi: ${law.desc}. Dampak: ${lawLine(law)}.`, true);
  const out = await settleProp(rec, j.accept, j.why, `Presiden ${c.gov.president} (NPC)`, w); return { ...out, vote, passed: true };
};

// uji materi (hakim), jaksa agung, gubernur bank sentral
A.court_review = async ({ u, p, body }) => {
  const { code, w, me } = await needOffice(u, p, 'hakim'), c = (await getC(code)).data, id = String(body.law), law = c.gov.customLaws?.[id]; const std = !law && (c.gov.laws || []).includes(id);
  if (!law && !std) bad('UU tidak ditemukan atau tidak berlaku', 404); const arg = txt(body.argument, 600, 'Pokok permohonan uji materi', 20);
  const used = must(await sb.from('cm_proposals').select('id').eq('uid', u.id).eq('kind', 'review').eq('year', w.year)); if (used.length) bad('Satu uji materi per hakim per tahun simulasi');
  const hak = (await cleanOffices(code, w.year)).filter(r => r.office === 'hakim'), npcN = Math.max(0, 5 - hak.length), name = law?.name || id.replace(/_/g, ' ');
  const o = await llm(`Kamu mensimulasikan majelis 5 hakim Mahkamah Agung dalam game simulasi (data fiksi) di ${dos(c)}.\nPermohonan uji materi atas UU "${name}"${law ? `: ${law.desc} (${lawLine(law)})` : ''}.\nPemohon: hakim ${p.name}. Argumen: "${arg}"\nMajelis: ${hak.map(h => `hakim ${h.name} (pemain)`).join(', ')}${hak.length ? ' dan ' : ''}${npcN} hakim NPC independen.\nPertimbangkan kekuatan argumen konstitusional, ideologi negara, dan stabilitas. Mayoritas (≥3) mengabulkan = UU dibatalkan. Keluarkan JSON: {"for":int,"against":int,"strike":true|false,"opinion":"pertimbangan hukum 1-2 kalimat, maks 260 karakter"}`);
  let f = Number.isInteger(o?.for) && o.for >= 0 && o.for <= 5 ? o.for : 2, strike = f >= 3; const opinion = clip(o?.opinion, 280) || 'Majelis menimbang argumen pemohon dan keadaan negara.';
  await sb.from('cm_proposals').insert({ country: code, office: 'hakim', uid: u.id, name: p.name, kind: 'review', payload: { law: id, for: f }, reason: clip(arg, 300), status: strike ? 'accepted' : 'rejected', note: opinion, decided_by: 'Mahkamah Agung', year: w.year });
  if (strike) await cas(code, cc => { if (cc.gov.customLaws?.[id]) delete cc.gov.customLaws[id]; else cc.gov.laws = (cc.gov.laws || []).filter(x => x !== id); });
  await news(w.year, code, 'politik', `Mahkamah Agung ${strike ? 'MEMBATALKAN' : 'menolak uji materi atas'} "${name}" (${f}-${5 - f})`, opinion);
  return { ok: true, strike, for: f, against: 5 - f, opinion };
};
A.prosecute = async ({ u, p }) => {
  const { code, w } = await needOffice(u, p, 'jaksa'), c = (await getC(code)).data, used = must(await sb.from('cm_proposals').select('id').eq('uid', u.id).eq('kind', 'case').eq('year', w.year)); if (used.length) bad('Jaksa Agung hanya dapat membuka satu penyidikan besar per tahun simulasi');
  const cost = r2(c.gdp * 0.0006); if (c.treasury < cost) bad('Kas tidak cukup untuk penyidikan'); const found = Math.round(3 + Math.random() * 6 + c.gov.corruption * 0.05);
  const o = await llm(`Tulis kasus korupsi fiktif besar yang dibongkar Jaksa Agung ${p.name} di ${c.name} (game simulasi, data fiksi): 1 kalimat tajuk berita, maks 180 karakter, bahasa Indonesia. Keluarkan JSON: {"headline":"..."}`);
  await cas(code, cc => { cc.treasury = r2(cc.treasury - cost); cc.gov.corruption = clamp(cc.gov.corruption - found, 0, 100); cc.gov.trust = clamp(cc.gov.trust + 2, 0, 100); });
  await sb.from('cm_proposals').insert({ country: code, office: 'jaksa', uid: u.id, name: p.name, kind: 'case', payload: { found, cost }, status: 'accepted', year: w.year, reason: '' });
  await news(w.year, code, 'politik', `Jaksa Agung ${p.name} membongkar kasus korupsi besar di ${c.name}`, clip(o?.headline, 200) || `Indeks korupsi turun ${found} poin.`);
  return { ok: true, found, cost };
};
A.bank_rate = async ({ u, p, body }) => {
  const { code, w } = await needOffice(u, p, 'bank'), c = (await getC(code)).data, used = must(await sb.from('cm_proposals').select('id').eq('uid', u.id).eq('kind', 'rate').eq('year', w.year)); if (used.length) bad('Rapat Dewan Gubernur hanya sekali per tahun simulasi');
  const v = Number(body.rate); if (!Number.isFinite(v) || v < 0 || v > 50) bad('Suku bunga harus 0–50%'); if (Math.abs(v - c.pol.rate) > 1.5 + 1e-9) bad('Perubahan suku bunga maksimal ±1,5 poin per tahun'); if (Math.abs(v - c.pol.rate) < 1e-9) bad('Nilai sama dengan suku bunga sekarang');
  await cas(code, cc => { cc.pol.rate = r1(v); }); await sb.from('cm_proposals').insert({ country: code, office: 'bank', uid: u.id, name: p.name, kind: 'rate', payload: { from: c.pol.rate, to: v }, status: 'accepted', year: w.year, reason: clip(body.reason, 300) });
  await news(w.year, code, 'ekonomi', `Gubernur Bank Sentral ${p.name} ${v > c.pol.rate ? 'menaikkan' : 'menurunkan'} suku bunga ${c.pol.rate}% → ${r1(v)}%`, clip(body.reason, 200)); return { ok: true };
};

// ---------- giliran tahunan: efek UU custom, perang NPC terhadap pemain ----------
async function warTurn() {
  const w = await world(); if ((w.gov_year ?? 0) >= w.year) return { skipped: true, year: w.year };
  const lock = await sb.from('cm_world').update({ gov_year: w.year }).eq('id', 1).or(`gov_year.is.null,gov_year.lt.${w.year}`).select('id'); if (!lock.data?.length) return { skipped: true, year: w.year };
  const year = w.year, R = rng('gov|' + year), rows = must(await sb.from('cm_countries').select('code,data,president_uid,president_seen')), by = Object.fromEntries(rows.map(r => [r.code, r]));
  const players = rows.filter(r => live(r, PRES_TTL * 60)), out = { laws: 0, wars: 0, battles: 0, joins: 0, peace: 0 }, nw = [];
  // 1) efek tahunan UU custom (+ biaya) di semua negara yang punya
  for (const r of rows) { const cl = r.data.gov.customLaws; if (!cl || !Object.keys(cl).length) continue; await cas(r.code, c => { for (const l of Object.values(c.gov.customLaws || {})) { if (l.year >= year) continue; for (const [k, v] of Object.entries(l.fx)) c.gov[k] = clamp((c.gov[k] ?? 50) + v, 0, 100); const cost = l.cost / 100 * c.gdp; c.treasury = r2(c.treasury - cost); if (c.treasury < 0) { c.debt = r2(c.debt - c.treasury); c.treasury = 0; } } }); out.laws++; }
  // 2) agresi NPC terhadap negara pemain (langka)
  for (const P of players) { const pc = by[P.code].data, cands = rows.filter(r => !r.president_uid && r.code !== P.code && !(pc.war || []).includes(r.code) && !shared(pc, r.data) && (r.data.ai?.tr.hawk ?? 0) >= 0.6 && (r.data.gov.readiness ?? 0) >= 45 && !(r.data.war || []).length && (r.data.region === pc.region || (r.data.rel?.[P.code] || 0) <= -30)).map(r => ({ r, s: (r.data.ai?.tr.hawk ?? 0.5) - (r.data.rel?.[P.code] || 0) / 100 + (r.data.gov.approval < 45 ? 0.2 : 0) + (r.data.gdp > pc.gdp ? 0.1 : -0.1) + R() * 0.2 })).sort((a, b) => b.s - a.s).slice(0, 6);
    if (!cands.length || (pc.war || []).length >= 2) continue;
    const o = await llm(`Kamu menentukan apakah ada NPC yang menyerang negara pemain dalam game simulasi politik (data fiksi). Perang itu LANGKA dan serius; pilih paling banyak 1 penyerang, hanya bila ada alasan kuat (presiden agresif, kesiapan tinggi, hubungan buruk, pengalihan isu saat kepuasan rakyat rendah, sasaran terlihat lemah). Boleh memilih nol.\nSasaran: [${P.code}] ${dos(pc)}.\nKandidat penyerang:\n${cands.map(({ r }, i) => `${i + 1}. [${r.code}] ${dos(r.data)}; hubungan dengan sasaran ${r.data.rel?.[P.code] || 0}`).join('\n')}\nKeluarkan JSON: {"attack":{"c":"KODE","casus":"alasan resmi (casus belli) satu kalimat, maks 170 karakter"}|null}`);
    const at = o?.attack, A_ = at && cands.find(x => x.r.code === String(at.c).toUpperCase()); if (!A_) continue; const N = A_.r.code, nd = A_.r.data;
    await cas(N, c => { if (!c.war.includes(P.code)) c.war.push(P.code); c.rel = c.rel || {}; c.rel[P.code] = -80; }); await cas(P.code, c => { if (!c.war.includes(N)) c.war.push(N); c.rel = c.rel || {}; c.rel[N] = -80; c.gov.readiness = clamp((c.gov.readiness ?? 50) + 5, 0, 100); c.gov.approval = clamp(c.gov.approval - 1, 0, 100); });
    await sb.from('cm_offers').update({ status: 'cancelled' }).eq('kind', 'trade').in('status', ['active', 'pending']).or(`and(from_c.eq.${N},to_c.eq.${P.code}),and(from_c.eq.${P.code},to_c.eq.${N})`);
    nw.push({ year, country: P.code, source: 'Kantor Berita Global', kind: 'konflik', title: `PERANG: ${nd.name} menyerang ${pc.name}`, body: clip(at.casus, 200) }); out.wars++; pc.war = [...(pc.war || []), N]; by[N].data.war = [...(by[N].data.war || []), P.code];
  }
  // 3) perang yang melibatkan pemain: peristiwa front, tawaran damai NPC, sekutu bergabung / membantu
  for (const P of players) { const pc = by[P.code].data, foes = (pc.war || []).map(c => by[c]).filter(r => r && !r.president_uid); if (!foes.length) continue;
    const allies = rows.filter(r => !r.president_uid && r.code !== P.code && !foes.some(f => f.code === r.code) && !(r.data.war || []).length && shared(r.data, pc)).slice(0, 4), foeAllies = rows.filter(r => !r.president_uid && !foes.some(f => f.code === r.code) && !(r.data.war || []).includes(P.code) && !shared(r.data, pc) && foes.some(f => shared(r.data, f.data))).slice(0, 3);
    const o = await llm(`Kamu narator perang dalam game simulasi politik (data fiksi). Negara pemain [${P.code}] ${dos(pc)} sedang berperang melawan:\n${foes.map(f => `[${f.code}] ${dos(f.data)}`).join('\n')}\nUntuk SETIAP lawan: tulis peristiwa front tahun ini (outcome: "menang"|"seri"|"kalah" dari sudut pandang pemain; dampak realistis dan kecil), dan apakah lawan menawarkan damai (peace true bila kelelahan perang tinggi: kepuasan/stabilitas rendah atau ekonomi merosot, atau ia sedang kalah).\nSekutu pemain (calon membantu): ${allies.map(a => `[${a.code}] ${a.data.name} (kesiapan ${Math.round(a.data.gov.readiness ?? 50)})`).join('; ') || 'tidak ada'}.\nSekutu lawan (calon bergabung ke lawan): ${foeAllies.map(a => `[${a.code}] ${a.data.name}`).join('; ') || 'tidak ada'}.\nSekutu boleh "join" (ikut perang), "aid" (kirim bantuan dana; hanya sekutu pemain), atau "neutral". Paling banyak 2 yang join.\nKeluarkan JSON: {"fronts":[{"c":"KODE lawan","outcome":"...","report":"laporan front 1-2 kalimat, maks 240 karakter","peace":true|false}],"allies":[{"c":"KODE","side":"pemain|lawan","act":"join|aid|neutral","why":"maks 140 karakter"}]}`, 50000);
    for (const f of o?.fronts || []) { const F = foes.find(x => x.code === String(f?.c).toUpperCase()); if (!F || !['menang', 'seri', 'kalah'].includes(f.outcome)) continue; const d = { menang: { a: 2, s: 1, g: 0.5, fg: -1 }, seri: { a: -1, s: -1, g: -0.5, fg: -0.5 }, kalah: { a: -3, s: -2, g: -1.5, fg: 0.5 } }[f.outcome];
      await cas(P.code, c => { c.gov.approval = clamp(c.gov.approval + d.a, 0, 100); c.gov.stability = clamp(c.gov.stability + d.s, 0, 100); c.gdp = r2(c.gdp * (1 + d.g / 100)); }); await cas(F.code, c => { c.gov.approval = clamp(c.gov.approval - d.a * 0.5, 0, 100); c.gdp = r2(c.gdp * (1 + d.fg / 100)); });
      nw.push({ year, country: P.code, source: 'Kantor Berita Global', kind: 'konflik', title: `Front ${F.data.name}: ${f.outcome === 'menang' ? 'pasukan Anda unggul' : f.outcome === 'kalah' ? 'pasukan Anda terdesak' : 'pertempuran buntu'}`, body: clip(f.report, 260) }); out.battles++;
      if (f.peace === true) { const ex = must(await sb.from('cm_offers').select('id').eq('kind', 'peace').eq('from_c', F.code).eq('to_c', P.code).eq('status', 'pending')); if (!ex.length) { await sb.from('cm_offers').insert({ kind: 'peace', from_c: F.code, to_c: P.code, status: 'pending', year }); nw.push({ year, country: P.code, source: 'Kantor Berita Global', kind: 'konflik', title: `${F.data.name} mengajukan gencatan senjata kepada ${pc.name}`, body: 'Jawab tawaran damai di menu Perdagangan/Diplomasi (Penawaran masuk).' }); out.peace++; } } }
    let joins = 0; for (const x of o?.allies || []) { const code = String(x?.c).toUpperCase(), side = x.side === 'lawan' ? 'lawan' : 'pemain', ally = [...allies, ...foeAllies].find(a => a.code === code); if (!ally || x.act === 'neutral') continue;
      if (x.act === 'aid' && side === 'pemain') { const amt = r2(ally.data.gdp * 0.002); await cas(ally.code, c => { c.treasury = r2(c.treasury - amt); }); await cas(P.code, c => { c.treasury = r2(c.treasury + amt); }); nw.push({ year, country: P.code, source: 'Kantor Berita Global', kind: 'bantuan', title: `${ally.data.name} mengirim bantuan perang ${amt.toFixed(2)} miliar USD kepada ${pc.name}`, body: clip(x.why, 160) }); }
      if (x.act === 'join' && joins < 2) { const enemy = side === 'pemain' ? foes[0] : { code: P.code, data: pc }; if (!enemy) continue; joins++; await cas(ally.code, c => { if (!c.war.includes(enemy.code)) c.war.push(enemy.code); c.rel = c.rel || {}; c.rel[enemy.code] = -60; }); await cas(enemy.code, c => { if (!c.war.includes(ally.code)) c.war.push(ally.code); c.rel = c.rel || {}; c.rel[ally.code] = -60; });
        nw.push({ year, country: P.code, source: 'Kantor Berita Global', kind: 'konflik', title: `${ally.data.name} bergabung dalam perang ${side === 'pemain' ? 'membela ' + pc.name : 'melawan ' + pc.name}`, body: clip(x.why, 160) }); out.joins++; } } }
  if (nw.length) await sb.from('cm_news').insert(nw); return { ok: true, year, ...out };
}
A.war_turn = async () => await warTurn();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404);
    const u = await authUser(req), p = await profile(u), out = await A[action]({ u, p, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
