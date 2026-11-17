// @ts-nocheck
// country.7mit — otak NPC adaptif. Dijalankan sekali per tahun simulasi (idempoten lewat cm_world.npc_year).
// Presiden NPC: memilih tujuan dari masalah terbesar, mencoba kebijakan, lalu BELAJAR dari hasilnya (bobot per kebijakan naik/turun).
// Diplomasi: ingatan hubungan dengan negara pemain, tawaran dagang ke pemain yang disukai, peringatan ke yang dimusuhi.
// Warga NPC: memposting sesuai kondisi nyata negaranya dan membalas postingan pemain sesuai isi & suasana hati publik.
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = (v) => Math.round(v * 10) / 10, PRES_TTL = 45_000;
const rng = (str) => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
const pick = (R, a) => a[Math.floor(R() * a.length)];
const NAMES = ['Budi', 'Siti', 'Ahmad', 'Maria', 'Chen', 'Aiko', 'Omar', 'Elena', 'Kwame', 'Priya', 'Lucas', 'Fatima', 'Ivan', 'Sofia', 'Daniel', 'Aisha', 'Rahul', 'Mei', 'Carlos', 'Nadia'];
const SECT = ['manufaktur', 'energi', 'pertanian', 'teknologi', 'jasa'];
const LIM = { rate: [0.1, 40], taxInc: [5, 45], taxCorp: [5, 45], spend: [8, 30], infra: [0, 8], edu: [0, 10], welfare: [0, 12], health: [0, 10], defense: [0, 10], tariff: [0, 40] };
// kebijakan: [kunci, bidang, delta, biaya?, deskripsi]
const ACTS = {
  'rate+': ['rate', 1, 0, 'menaikkan suku bunga'], 'rate-': ['rate', -0.75, 0, 'menurunkan suku bunga'], 'spend-': ['spend', -0.5, 0, 'memangkas belanja'], 'spend+': ['spend', 0.4, 1, 'menambah belanja'],
  'tax+': ['taxInc', 1, 0, 'menaikkan pajak penghasilan'], 'tax-': ['taxInc', -1, 1, 'menurunkan pajak penghasilan'], 'corp+': ['taxCorp', 1, 0, 'menaikkan pajak korporasi'], 'corp-': ['taxCorp', -1, 1, 'memberi insentif pajak korporasi'],
  'infra+': ['infra', 0.4, 1, 'mempercepat infrastruktur'], 'edu+': ['edu', 0.3, 1, 'menambah anggaran pendidikan'], 'welfare+': ['welfare', 0.4, 1, 'memperluas bantuan sosial'], 'health+': ['health', 0.3, 1, 'memperkuat layanan kesehatan'],
  'tariff-': ['tariff', -2, 0, 'membuka perdagangan'], 'tariff+': ['tariff', 2, 0, 'melindungi industri dalam negeri'], 'def+': ['defense', 0.5, 1, 'memperkuat pertahanan'], 'def-': ['defense', -0.3, 0, 'mengalihkan anggaran pertahanan'],
};
const GOALS = {
  inflasi: { t: 'menjinakkan inflasi', a: ['rate+', 'spend-', 'tariff-'] }, defisit: { t: 'menyehatkan anggaran', a: ['tax+', 'corp+', 'spend-', 'def-'] }, kerja: { t: 'menciptakan lapangan kerja', a: ['infra+', 'corp-', 'rate-', 'edu+'] },
  rakyat: { t: 'memulihkan kepercayaan rakyat', a: ['welfare+', 'tax-', 'health+'] }, tumbuh: { t: 'mengejar pertumbuhan', a: ['infra+', 'corp-', 'tariff-', 'edu+', 'rate-'] }, perang: { t: 'memenangkan konflik', a: ['def+', 'tax+'] }, stabil: { t: 'menjaga stabilitas', a: ['edu+', 'health+', 'infra+', 'def-'] },
};
const metrics = (c) => ({ ap: c.gov.approval, gr: c.growth, inf: c.infl, un: c.unemp, bal: (c.lastBalance || 0) / Math.max(1, c.gdp) * 100, debt: c.debt / Math.max(1, c.gdp) });

function think(c, year) {
  const R = rng(c.code + '|ai|' + year), T = rng(c.code + '|traits'), p = c.pol, g = c.gov;
  const ai = c.ai || (c.ai = { tr: { hawk: T(), pop: T(), lib: T(), caut: T() }, w: {}, last: null, goal: null, hist: [] });
  const m = metrics(c); let learned = null;
  if (ai.last) { const l = ai.last.m, reward = clamp((m.ap - l.ap) * 0.6 + (m.gr - l.gr) * 2 - (m.inf - l.inf) - (m.un - l.un) * 1.5 + (m.bal - l.bal) * 0.8, -4, 4);
    for (const k of ai.last.acts) ai.w[k] = r1(clamp((ai.w[k] || 0) * 0.9 + 0.25 * reward, -3, 3) * 10) / 10; learned = { reward: r1(reward), acts: ai.last.acts }; }
  const pr = { inflasi: Math.max(0, m.inf - 6) * 1.2, defisit: Math.max(0, -m.bal - 2) * 1.5 + Math.max(0, m.debt - 0.9) * 6, kerja: Math.max(0, m.un - 8) * 1.1, rakyat: Math.max(0, 48 - m.ap) * 0.5 * (1 + ai.tr.pop), tumbuh: Math.max(0, 2 - m.gr) * 1.5, perang: (c.war?.length || 0) * 5 * (0.5 + ai.tr.hawk), stabil: 1.2 };
  if (ai.goal && pr[ai.goal] !== undefined) pr[ai.goal] += 1;                                   // konsisten, tidak plin-plan
  const goal = Object.entries(pr).sort((a, b) => b[1] - a[1])[0][0], changed = goal !== ai.goal;
  const canSpend = m.bal > -4 && c.treasury > -c.gdp * 0.02;
  const bias = (k) => (k.startsWith('tariff-') || k === 'corp-' ? ai.tr.lib - 0.5 : 0) + (k === 'welfare+' || k === 'tax-' ? ai.tr.pop - 0.5 : 0) + (k === 'def+' ? ai.tr.hawk - 0.5 : 0);
  const cand = GOALS[goal].a.filter(k => { const [f, d, cost] = ACTS[k]; if (cost && !canSpend) return false; const v = p[f] + d; return v >= LIM[f][0] && v <= LIM[f][1]; })
    .map(k => [k, 1 + (ai.w[k] || 0) + bias(k) + R() * (1 - ai.tr.caut) * 1.2 + (R() < 0.12 ? 1.5 : 0)]).sort((a, b) => b[1] - a[1]);   // 12% eksplorasi
  const n = pr[goal] > 6 && ai.tr.caut < 0.7 ? 2 : 1, acts = cand.filter(x => x[1] > -0.5).slice(0, n).map(x => x[0]);
  for (const k of acts) { const [f, d] = ACTS[k]; p[f] = r1(clamp(p[f] + d, LIM[f][0], LIM[f][1])); }
  if (g.corruption > 60 && !g.laws.includes('uu_kpk') && R() < 0.5) g.laws.push('uu_kpk');
  ai.goal = goal; ai.last = { m, acts, year }; ai.hist = [...(ai.hist || []), { y: year, g: goal, a: acts }].slice(-6);
  for (const k of Object.keys(c.rel || {})) c.rel[k] = Math.round(c.rel[k] * 0.97);                // dendam & budi memudar
  return { goal, changed, acts, learned };
}
const affinity = (n, p) => (n.rel?.[p.code] || 0) + (n.mem?.some(a => a !== 'UN' && p.mem?.includes(a)) ? 25 : 0) + (n.region === p.region ? 10 : 0) - (n.war?.includes(p.code) ? 200 : 0);

const TOPIC = [
  [/pajak|tax/i, ['Kalau pajak naik lagi, usaha kecil kami makin berat.', 'Pajak boleh, asal jalan dan sekolahnya terasa.'], ['Pajak yang adil itu yang kelihatan hasilnya. Sejauh ini lumayan.', 'Setuju, asal transparan penggunaannya.']],
  [/harga|inflasi|mahal/i, ['Harga di pasar naik terus. Tolong benar-benar diurus.', 'Gaji tetap, harga lari. Kami menunggu bukti.'], ['Harga mulai stabil di tempat saya. Pertahankan.', 'Terima kasih, belanja bulanan tidak separah tahun lalu.']],
  [/kerja|lowongan|pengangguran/i, ['Anak saya sudah setahun menganggur. Kapan lowongannya nyata?', 'Janji lapangan kerja sudah sering kami dengar.'], ['Pabrik baru di dekat sini mulai merekrut. Bagus.', 'Tetangga saya akhirnya dapat kerja. Lanjutkan.']],
  [/jalan|tol|rel|kereta|infrastruktur|bangun/i, ['Bangun boleh, tapi jalan di kampung kami masih rusak.', 'Proyeknya besar, semoga bukan cuma di kota.'], ['Jalan baru itu memangkas waktu tempuh saya separuhnya.', 'Akhirnya ada pembangunan yang terasa.']],
  [/sekolah|pendidikan|guru/i, ['Sekolah butuh guru, bukan cuma gedung.', 'Biaya sekolah masih berat bagi kami.'], ['Sekolah anak saya makin baik. Terima kasih.', 'Investasi pendidikan itu yang paling benar.']],
  [/sehat|rumah sakit|rs|dokter/i, ['Antrean rumah sakit masih berjam-jam.', 'Obat mahal, tolong perhatikan.'], ['Layanan puskesmas membaik tahun ini.', 'Rumah sakit baru sangat membantu orang tua saya.']],
  [/korupsi|suap/i, ['Buktikan dulu: tangkap yang besar, jangan yang kecil saja.', 'Kami lelah dengan janji antikorupsi.'], ['Penindakan mulai terasa. Jangan kendur.', 'Bagus, pejabat sekarang lebih hati-hati.']],
  [/perang|damai|militer|tentara/i, ['Kami tidak mau anak-anak kami dikirim berperang.', 'Perang hanya menguras kas negara.'], ['Damai itu yang kami mau. Jaga terus.', 'Pertahanan kuat membuat kami tenang.']],
];
function reply(R, body, c) { const mood = c.gov.approval + (c.growth - 2) * 3 - Math.max(0, c.infl - 8) * 1.5, pos = mood > 52 ? 1 : mood < 44 ? 0 : (R() < 0.5 ? 1 : 0); for (const [re, neg, ok] of TOPIC) if (re.test(body)) return pick(R, pos ? ok : neg);
  return pick(R, pos ? ['Kami mendukung, Presiden. Lanjutkan kerja nyatanya.', `Kepuasan publik ${Math.round(c.gov.approval)}% itu tidak datang sendiri. Pertahankan.`, 'Terima kasih sudah mau mendengar warga.'] : ['Kata-kata bagus, tapi kami menunggu hasilnya.', `Dengan pengangguran ${c.unemp.toFixed(1)}% dan inflasi ${c.infl.toFixed(1)}%, kami butuh lebih dari pidato.`, 'Turun ke lapangan, Pak/Bu. Lihat sendiri keadaan kami.']); }
function mood(R, c, builds) { const o = [];
  if (builds.length) { const b = pick(R, builds), where = b.region?.adm3 || b.region?.adm2 || b.region?.adm1 || c.name, nm = { rumah: 'perumahan', sekolah: 'sekolah', rs: 'rumah sakit', pabrik: 'pabrik', pertanian: 'lahan pertanian', listrik: 'pembangkit listrik', pelabuhan: 'pelabuhan', bandara: 'bandara', pasar: 'pasar', taman: 'taman kota', teknologi: 'pusat teknologi', kantor: 'kantor pemerintah', tol: 'jalan tol', raya: 'jalan raya', jalan: 'jalan kota', rel: 'jalur kereta' }[b.kind] || 'proyek';
    o.push(c.gov.approval > 45 ? `Ada ${nm} baru di ${where}. Akhirnya pembangunan sampai ke sini!` : `${nm[0].toUpperCase() + nm.slice(1)} baru di ${where} bagus, tapi harga kebutuhan pokok juga tolong diurus.`); }
  if (c.infl > 10) o.push(`Inflasi ${c.infl.toFixed(1)}%. Uang belanja seminggu sekarang habis dalam tiga hari.`);
  if (c.unemp > 10) o.push(`Pengangguran ${c.unemp.toFixed(1)}%. Di gang saya saja lima orang menganggur.`);
  if (c.growth > 5) o.push(`Ekonomi tumbuh ${c.growth.toFixed(1)}%. Toko saya ramai lagi tahun ini.`);
  if (c.gov.corruption > 65) o.push('Urus izin masih harus "uang rokok". Kapan berubahnya?');
  if (c.war?.length) o.push('Semoga perang cepat selesai. Kami ingin hidup tenang.');
  if (c.gov.approval > 62) o.push('Jujur, pemerintahan sekarang yang paling terasa kerjanya.');
  if (!o.length) o.push('Tahun yang biasa saja. Semoga tahun depan lebih baik.'); return pick(R, o); }

async function run() {
  const w = (await sb.from('cm_world').select('year,npc_year').eq('id', 1).single()).data; if (!w || (w.npc_year ?? 0) >= w.year) return { skipped: true, year: w?.year };
  const lock = await sb.from('cm_world').update({ npc_year: w.year }).eq('id', 1).or(`npc_year.is.null,npc_year.lt.${w.year}`).select('id'); if (!lock.data?.length) return { skipped: true, year: w.year };
  const year = w.year, R = rng('npc|' + year), rows = (await sb.from('cm_countries').select('code,data,ver,president_uid,president_seen')).data || [];
  const live = (r) => r.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < PRES_TTL * 40, players = rows.filter(live), npcs = rows.filter(r => !r.president_uid);
  const offers = (await sb.from('cm_offers').select('from_c,to_c,status,kind,year').gte('year', year - 1)).data || [], pset = new Set(players.map(p => p.code)), byCode = Object.fromEntries(rows.map(r => [r.code, r]));
  const news = [], shifts = [];
  // 1) presiden NPC berpikir + belajar; ingatan hubungan dari perlakuan pemain
  for (const r of npcs) { const c = r.data; c.rel = c.rel || {};
    for (const o of offers) { if (o.year !== year - 1 && o.year !== year) continue; if (o.to_c === c.code && pset.has(o.from_c)) c.rel[o.from_c] = clamp((c.rel[o.from_c] || 0) + (o.status === 'active' ? 5 : o.kind === 'peace' ? 3 : 1), -100, 100); if (o.from_c === c.code && pset.has(o.to_c) && o.status === 'rejected') c.rel[o.to_c] = clamp((c.rel[o.to_c] || 0) - 4, -100, 100); }
    for (const p of players) if (c.war?.includes(p.code)) c.rel[p.code] = clamp((c.rel[p.code] || 0) - 10, -100, 100); else if (p.data.war?.some(x => byCode[x] && c.mem?.some(a => a !== 'UN' && byCode[x].data.mem?.includes(a)))) c.rel[p.code] = clamp((c.rel[p.code] || 0) - 5, -100, 100);
    const t = think(c, year); r.t = t; if (t.changed && t.acts.length) shifts.push(r); }
  let saved = 0; for (let i = 0; i < npcs.length; i += 25) { const res = await Promise.all(npcs.slice(i, i + 25).map(r => sb.from('cm_countries').update({ data: r.data, ver: r.ver + 1 }).eq('code', r.code).eq('ver', r.ver).is('president_uid', null).select('code'))); saved += res.filter(x => x.data?.length).length; }
  for (const r of shifts.sort((a, b) => b.data.gdp - a.data.gdp).slice(0, 6)) news.push({ year, country: r.code, source: 'Analisis Dunia', kind: 'politik', title: `${r.data.name} mengubah arah: fokus ${GOALS[r.t.goal].t}`, body: `Presiden ${r.data.gov.president} ${r.t.acts.map(k => ACTS[k][3]).join(' dan ')}.${r.t.learned ? ` Evaluasi kebijakan tahun lalu: ${r.t.learned.reward >= 0 ? 'berhasil' : 'kurang berhasil'}, strategi disesuaikan.` : ''}` });
  // 2) diplomasi adaptif ke negara pemain
  const busy = new Set(offers.filter(o => o.status === 'pending' || o.status === 'active').map(o => [o.from_c, o.to_c].sort().join('|'))), ins = [];
  for (const p of players) { const ranked = npcs.map(r => [r, affinity(r.data, p.data) + R() * 12]).sort((a, b) => b[1] - a[1]);
    for (const [r, a] of ranked.slice(0, 2)) { if (a < 8 || busy.has([r.code, p.code].sort().join('|'))) continue; const n = r.data, sector = !p.data.oil && n.oil ? 'energi' : pick(R, SECT), value = Math.round(clamp(Math.min(n.gdp, p.data.gdp) * 0.004 * (0.5 + R()), 0.05, 60) * 100) / 100, cut = a > 40 ? 5 : a > 20 ? 2 : 0, tf = clamp(Math.round(n.pol.tariff - cut), 0, 40);
      ins.push({ kind: 'trade', from_c: r.code, to_c: p.code, sector, value, tariff_from: tf, tariff_to: tf, status: 'pending', year }); news.push({ year, country: p.code, source: 'Harian Dunia', kind: 'perdagangan', title: `${n.name} menawarkan perdagangan ${sector} kepada ${p.data.name}`, body: `Nilai ${value.toFixed(2)} miliar USD/tahun, tarif ${tf}%. ${a > 40 ? 'Hubungan erat membuat tarif diturunkan.' : 'Menunggu jawaban presiden.'}` }); }
    const foe = ranked[ranked.length - 1]; if (foe && (foe[0].data.rel?.[p.code] || 0) < -40 && foe[0].data.ai?.tr.hawk > 0.55) news.push({ year, country: p.code, source: 'Harian Dunia', kind: 'konflik', title: `${foe[0].data.name} memperingatkan ${p.data.name}`, body: 'Hubungan memburuk. Diplomasi atau bantuan dapat meredakan ketegangan.' }); }
  if (ins.length) await sb.from('cm_offers').insert(ins);
  // 3) warga NPC: posting sesuai keadaan & membalas postingan pemain
  for (const p of players) { const c = p.data, Rc = rng(p.code + '|soc|' + year), builds = (await sb.from('cm_builds').select('kind,region').eq('country', p.code).eq('year', year - 1).limit(30)).data || [];
    const posts = []; for (let i = 0; i < 2; i++) posts.push({ country: p.code, author: pick(Rc, NAMES), role: 'warga', body: mood(Rc, c, i ? [] : builds) }); await sb.from('cm_posts').insert(posts);
    const recent = (await sb.from('cm_posts').select('id,body,uid').eq('country', p.code).not('uid', 'is', null).eq('hidden', false).order('id', { ascending: false }).limit(4)).data || [];
    for (const po of recent) { const has = (await sb.from('cm_comments').select('id', { count: 'exact', head: true }).eq('post_id', po.id).is('uid', null)).count || 0; if (has >= 2) continue; await sb.from('cm_comments').insert({ post_id: po.id, country: p.code, uid: null, author: pick(Rc, NAMES), role: 'warga', body: reply(Rc, po.body, c) }); } }
  if (news.length) await sb.from('cm_news').insert(news);
  return { ok: true, year, npcs: saved, offers: ins.length, news: news.length };
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) return new Response(JSON.stringify({ ok: false, error: 'Silakan masuk terlebih dahulu' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true, data: await run() }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { console.error(e); return new Response(JSON.stringify({ ok: false, error: 'Kesalahan server: ' + (e?.message || e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
