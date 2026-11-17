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

function prepare(c, year) { // belajar dari hasil tahun lalu, hitung tekanan masalah & kandidat kebijakan (aturan)
  const R = rng(c.code + '|ai|' + year), T = rng(c.code + '|traits'), p = c.pol;
  const ai = c.ai || (c.ai = { tr: { hawk: T(), pop: T(), lib: T(), caut: T() }, w: {}, last: null, goal: null, hist: [] });
  const m = metrics(c); let learned = null;
  if (ai.last) { const l = ai.last.m, reward = clamp((m.ap - l.ap) * 0.6 + (m.gr - l.gr) * 2 - (m.inf - l.inf) - (m.un - l.un) * 1.5 + (m.bal - l.bal) * 0.8, -4, 4);
    for (const k of ai.last.acts) ai.w[k] = r1(clamp((ai.w[k] || 0) * 0.9 + 0.25 * reward, -3, 3) * 10) / 10; learned = { reward: r1(reward), acts: ai.last.acts }; }
  const pr = { inflasi: Math.max(0, m.inf - 6) * 1.2, defisit: Math.max(0, -m.bal - 2) * 1.5 + Math.max(0, m.debt - 0.9) * 6, kerja: Math.max(0, m.un - 8) * 1.1, rakyat: Math.max(0, 48 - m.ap) * 0.5 * (1 + ai.tr.pop), tumbuh: Math.max(0, 2 - m.gr) * 1.5, perang: (c.war?.length || 0) * 5 * (0.5 + ai.tr.hawk), stabil: 1.2 };
  if (ai.goal && pr[ai.goal] !== undefined) pr[ai.goal] += 1;                                   // konsisten, tidak plin-plan
  const canSpend = m.bal > -4 && c.treasury > -c.gdp * 0.02, allowed = (k) => { const [f, d, cost] = ACTS[k]; if (cost && !canSpend) return false; const v = p[f] + d; return v >= LIM[f][0] && v <= LIM[f][1]; };
  return { R, ai, m, learned, pr, canSpend, allowed };
}
function ruleGoal(c, pc) { const { R, ai, m, pr, allowed } = pc, p = c.pol, goal = Object.entries(pr).sort((a, b) => b[1] - a[1])[0][0];
  const bias = (k) => (k.startsWith('tariff-') || k === 'corp-' ? ai.tr.lib - 0.5 : 0) + (k === 'welfare+' || k === 'tax-' ? ai.tr.pop - 0.5 : 0) + (k === 'def+' ? ai.tr.hawk - 0.5 : 0);
  const cand = GOALS[goal].a.filter(allowed).map(k => [k, 1 + (ai.w[k] || 0) + bias(k) + R() * (1 - ai.tr.caut) * 1.2 + (R() < 0.12 ? 1.5 : 0)]).sort((a, b) => b[1] - a[1]);   // 12% eksplorasi
  const n = pr[goal] > 6 && ai.tr.caut < 0.7 ? 2 : 1; return { goal, acts: cand.filter(x => x[1] > -0.5).slice(0, n).map(x => x[0]) }; }
function think(c, year, pc, plan) { // plan (dari Gemini) menggantikan keputusan aturan bila valid
  const { R, ai, m, learned, allowed } = pc, p = c.pol, g = c.gov; let d = ruleGoal(c, pc), by = 'aturan';
  if (plan && GOALS[plan.goal]) { const acts = [...new Set((plan.acts || []).filter(k => ACTS[k] && allowed(k)))].slice(0, 3); if (acts.length) { d = { goal: plan.goal, acts }; by = 'gemini'; } }
  const goal = d.goal, acts = d.acts, changed = goal !== ai.goal;
  for (const k of acts) { const [f, dl] = ACTS[k]; p[f] = r1(clamp(p[f] + dl, LIM[f][0], LIM[f][1])); }
  if (g.corruption > 60 && !g.laws.includes('uu_kpk') && R() < 0.5) g.laws.push('uu_kpk');
  ai.goal = goal; ai.last = { m, acts, year }; ai.why = by === 'gemini' ? clip(plan.why, 240) : ''; ai.hist = [...(ai.hist || []), { y: year, g: goal, a: acts, by }].slice(-6);
  for (const k of Object.keys(c.rel || {})) c.rel[k] = Math.round(c.rel[k] * 0.97);                // dendam & budi memudar
  return { goal, changed, acts, learned, by, why: ai.why };
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

// ---------- lapisan AI (Gemini). Kunci disimpan di tabel privat cm_secrets; bila gagal, jatuh ke templat ----------
let KEY = null; const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
async function llm(prompt, maxMs = 40000) {
  if (KEY === null) KEY = (await sb.from('cm_secrets').select('v').eq('k', 'gemini_key').maybeSingle()).data?.v || '';
  if (!KEY) return null; const t0 = Date.now();
  for (const m of MODELS) for (let a = 0; a < 2; a++) {
    if (Date.now() - t0 > maxMs) return null;
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.max(3000, maxMs - (Date.now() - t0))), headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 3000 } }) });
      if (r.status === 503 || r.status === 429) { await new Promise(x => setTimeout(x, 700)); continue; } if (!r.ok) break;
      const j = await r.json(), txt = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || ''; const o = JSON.parse(txt.replace(/^```json|```$/g, '').trim()); return o; } catch (e) { /* coba model berikutnya */ } }
  return null;
}
const clip = (v, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const brief = (c) => `Negara: ${c.name}. Tahun ${c.year ?? ''}. Presiden: ${c.gov.president}. Kepuasan rakyat ${Math.round(c.gov.approval)}%, pertumbuhan ${c.growth.toFixed(1)}%, inflasi ${c.infl.toFixed(1)}%, pengangguran ${c.unemp.toFixed(1)}%, korupsi ${Math.round(c.gov.corruption)}/100, ${c.war?.length ? 'sedang berperang' : 'damai'}, tujuan kebijakan ${c.ai?.goal || '-'}.`;
const PERSONA = ['pedagang pasar', 'guru honorer', 'sopir ojek', 'petani', 'mahasiswa', 'perawat', 'pemilik warung', 'buruh pabrik', 'pensiunan', 'pegawai kantoran', 'nelayan', 'pengusaha kecil'];
const WARGA_RULE = 'Tulis dalam bahasa Indonesia sehari-hari, nada manusia nyata (boleh kesal, ragu, bangga, bercanda), maksimal 220 karakter per teks, tanpa hashtag, tanpa emoji berlebihan, jangan menyebut diri AI. Ini game simulasi, semua angka adalah data permainan.';
async function aiCitizenReplies(c, posts, R) { // posts: [{id, body}] -> {id: [teks, teks]}
  if (!posts.length) return {};
  const people = posts.map((p, i) => `${i + 1}. [id ${p.id}] "${clip(p.body)}"`).join('\n'), who = Array.from({ length: 3 }, () => pick(R, PERSONA)).join(', ');
  const o = await llm(`Kamu menulis balasan beberapa warga biasa di media sosial negara fiksi dalam game simulasi.\n${brief(c)}\nWarga yang membalas punya profesi acak seperti: ${who}. Balasan harus menanggapi ISI postingan dan terasa dipengaruhi keadaan negara di atas (jangan sebut angka persis kecuali natural). Beri 1-2 balasan berbeda sudut pandang per postingan.\n${WARGA_RULE}\nPostingan:\n${people}\nKeluarkan JSON: {"r":[{"id":<id>,"t":["balasan 1","balasan 2"]}]}`);
  const out = {}; for (const x of o?.r || []) if (x && Array.isArray(x.t)) out[x.id] = x.t.map(t => clip(t, 220)).filter(Boolean).slice(0, 2); return out;
}
async function aiCitizenPosts(c, builds, R) {
  const bs = builds.slice(0, 4).map(b => `${b.kind} di ${b.region?.adm3 || b.region?.adm2 || b.region?.adm1 || c.name}`).join('; ');
  const o = await llm(`Kamu menulis 2 postingan spontan warga biasa di media sosial negara fiksi dalam game simulasi.\n${brief(c)}\n${bs ? `Proyek yang baru dibangun pemerintah: ${bs}.` : 'Tidak ada proyek baru.'}\nSatu postingan boleh membahas proyek/kebijakan, satu lagi kehidupan sehari-hari yang dipengaruhi ekonomi.\n${WARGA_RULE}\nKeluarkan JSON: {"p":["postingan 1","postingan 2"]}`);
  return (o?.p || []).map(t => clip(t, 300)).filter(Boolean).slice(0, 2);
}
async function aiNewsSpin(items) { // items: [{n,goal,acts,ok}] -> tajuk analisis singkat
  if (!items.length) return {};
  const o = await llm(`Kamu jurnalis "Analisis Dunia" di game simulasi. Untuk tiap negara tulis SATU kalimat analisis tajam (maks 200 karakter) tentang arah kebijakan barunya, bahasa Indonesia formal-ringkas.\n${items.map((x, i) => `${i + 1}. ${x.n}: fokus ${x.goal}; langkah: ${x.acts}; evaluasi tahun lalu: ${x.ok}`).join('\n')}\nKeluarkan JSON: {"a":["kalimat 1","kalimat 2",...]} urut sesuai nomor.`);
  const r = {}; (o?.a || []).forEach((t, i) => { if (t) r[i] = clip(t, 220); }); return r;
}


// ---------- presiden NPC berpikir dengan Gemini: memilih tujuan & kebijakan dari keadaan, ingatan, dan pelajaran sebelumnya ----------
const ACT_LIST = Object.entries(ACTS).map(([k, v]) => `${k} (${v[3]})`).join('; '), GOAL_LIST = Object.entries(GOALS).map(([k, v]) => `${k} (${v.t})`).join('; ');
function dossier(r, pc, playerRel) { const c = r.data, p = c.pol, ai = pc.ai, m = pc.m, w = Object.entries(ai.w).filter(([, v]) => Math.abs(v) >= 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join(',');
  return `[${c.code}] ${c.name}, presiden ${c.gov.president}, watak(agresif ${ai.tr.hawk.toFixed(1)}, populis ${ai.tr.pop.toFixed(1)}, liberal ${ai.tr.lib.toFixed(1)}, hati-hati ${ai.tr.caut.toFixed(1)}). PDB ${c.gdp.toFixed(1)} M$, tumbuh ${m.gr.toFixed(1)}%, inflasi ${m.inf.toFixed(1)}%, pengangguran ${m.un.toFixed(1)}%, kepuasan ${Math.round(m.ap)}%, saldo anggaran ${m.bal.toFixed(1)}% PDB, utang ${(m.debt * 100).toFixed(0)}% PDB, korupsi ${Math.round(c.gov.corruption)}, perang dengan ${c.war?.length || 0} negara. Kebijakan: bunga ${p.rate}, pajak ${p.taxInc}/${p.taxCorp}, belanja ${p.spend}, tarif ${p.tariff}, pertahanan ${p.defense}. Tujuan lalu: ${ai.goal || '-'}; langkah lalu: ${(ai.last?.acts || []).join(',') || '-'}; hasilnya ${pc.learned ? (pc.learned.reward >= 0 ? 'baik' : 'buruk') + ' (' + pc.learned.reward + ')' : 'belum ada'}; bobot belajar: ${w || '-'}.${playerRel ? ` Hubungan dengan pemain: ${playerRel}.` : ''} Opsi aturan menyarankan: ${ruleGoal(c, pc).goal}.`; }
async function aiPresidents(batch) { // batch: [{r, pc}] -> {code: {goal, acts, why}}
  if (!batch.length) return {};
  const rows = batch.map(({ r, pc, rel }) => dossier(r, pc, rel)).join('\n');
  const o = await llm(`Kamu otak strategis para presiden NPC dalam game simulasi negara (data fiksi). Untuk setiap negara pilih SATU tujuan utama tahun ini dan 1-3 langkah kebijakan yang paling masuk akal, sesuai watak presidennya dan pelajaran dari hasil langkah sebelumnya (jangan mengulang langkah yang hasilnya buruk; ulangi yang berhasil bila masalah masih ada; hindari plin-plan tanpa alasan). Pertimbangkan trade-off: menaikkan belanja memperlebar defisit, memangkas belanja menurunkan kepuasan, dst.\nTujuan yang boleh: ${GOAL_LIST}.\nLangkah yang boleh (pakai kuncinya persis): ${ACT_LIST}.\nTulis "why" satu kalimat bahasa Indonesia ala juru bicara kepresidenan (maks 200 karakter) yang menjelaskan alasan memakai angka negaranya.\nNegara:\n${rows}\nKeluarkan JSON: {"d":[{"c":"KODE","goal":"...","a":["kunci","kunci"],"why":"..."}]}`, 60000);
  const out = {}; for (const x of o?.d || []) if (x?.c && GOALS[x.goal] && Array.isArray(x.a)) out[String(x.c).toUpperCase()] = { goal: x.goal, acts: x.a.map(String), why: clip(x.why, 240) }; return out;
}

// ================= KEPUTUSAN DIPLOMASI & PARLEMEN OLEH GEMINI =================
// Klien memanggil cm-npc (action:'proxy') untuk aksi tertentu; cm-npc meneruskan ke cm-api (validasi & efek tetap di sana),
// lalu Gemini memutuskan sikap NPC/parlemen. Bila keputusannya beda dari aturan, hasilnya dikoreksi di basis data (terbatas & tervalidasi).
const PROXIED = new Set(['propose_trade', 'propose_peace', 'set_policy', 'propose_law', 'repeal_law', 'motion']);
const MOTIONS = { transparansi: 'Mosi Transparansi', hak_warga: 'Mosi Hak Warga', layanan_publik: 'Mosi Layanan Publik', keamanan: 'Mosi Keamanan' };
const MOTION_FX = { transparansi: 'kepercayaan publik +6, korupsi -4', hak_warga: 'kepuasan +4, stabilitas +2, investasi -1', layanan_publik: 'kesehatan +4, infrastruktur +3, kas -0,3% PDB, kepuasan +2', keamanan: 'kesiapan militer +8, stabilitas +2, kepuasan -2' };
const MOTION_FIELDS = { transparansi: [['gov', 'trust'], ['gov', 'corruption']], hak_warga: [['gov', 'approval'], ['gov', 'stability'], ['gov', 'invest']], layanan_publik: [['stock', 'health'], ['stock', 'infra'], [null, 'treasury'], [null, 'debt'], ['gov', 'approval']], keamanan: [['gov', 'readiness'], ['gov', 'stability'], ['gov', 'approval']] };
const getF = (c, [a, k]) => (a ? c[a][k] : c[k]), setF = (c, [a, k], v) => { if (a) c[a][k] = v; else c[k] = v; };
function applyMotionFx(c, m) { // salinan efek mosi di cm-api (engine.applyMotion)
  const g = c.gov;
  if (m === 'transparansi') { g.trust = clamp(g.trust + 6, 0, 100); g.corruption = clamp(g.corruption - 4, 0, 100); }
  if (m === 'hak_warga') { g.approval = clamp(g.approval + 4, 0, 100); g.stability = clamp(g.stability + 2, 0, 100); g.invest = clamp(g.invest - 1, 0, 100); }
  if (m === 'layanan_publik') { c.stock.health = clamp(c.stock.health + 4, 0, 100); c.stock.infra = clamp(c.stock.infra + 3, 0, 100); c.treasury -= c.gdp * 0.003; if (c.treasury < 0) { c.debt -= c.treasury; c.treasury = 0; } g.approval = clamp(g.approval + 2, 0, 100); }
  if (m === 'keamanan') { g.readiness = clamp(g.readiness + 8, 0, 100); g.stability = clamp(g.stability + 2, 0, 100); g.approval = clamp(g.approval - 2, 0, 100); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shared = (a, b) => (a.mem || []).some(x => x !== 'UN' && (b.mem || []).includes(x));
async function cas(code, fn) { // ubah data negara dengan penguncian optimistik; sinkron slim.war & updated_at agar klien melihat perubahan
  for (let i = 0; i < 6; i++) { const row = (await sb.from('cm_countries').select('data,slim,ver').eq('code', code).single()).data; if (!row) return false; const d = structuredClone(row.data); fn(d);
    const r = await sb.from('cm_countries').update({ data: d, slim: { ...row.slim, war: d.war, approval: d.gov.approval }, ver: row.ver + 1, updated_at: new Date().toISOString() }).eq('code', code).eq('ver', row.ver).select('code'); if (r.data?.length) return true; await sleep(40 + Math.random() * 120 * (i + 1)); }
  return false;
}
async function fixNews(code, re, title, body) { const rows = (await sb.from('cm_news').select('id,title').eq('country', code).order('id', { ascending: false }).limit(8)).data || [], n = rows.find(x => re.test(x.title)); if (n) await sb.from('cm_news').update({ title, body }).eq('id', n.id); }
async function presOf(uid, session) { if (!session) return null; const r = (await sb.from('cm_countries').select('code,data,president_seen').eq('president_uid', uid).eq('president_session', session).maybeSingle()).data; return r && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < PRES_TTL * 2 ? r : null; }
const dos = (c, extra = '') => `${c.name} (presiden ${c.gov.president}; watak agresif ${(c.ai?.tr.hawk ?? 0.5).toFixed(1)}, populis ${(c.ai?.tr.pop ?? 0.5).toFixed(1)}, liberal ${(c.ai?.tr.lib ?? 0.5).toFixed(1)}, hati-hati ${(c.ai?.tr.caut ?? 0.5).toFixed(1)}; PDB ${c.gdp.toFixed(1)} M$, tumbuh ${c.growth.toFixed(1)}%, inflasi ${c.infl.toFixed(1)}%, pengangguran ${c.unemp.toFixed(1)}%, kepuasan ${Math.round(c.gov.approval)}%, stabilitas ${Math.round(c.gov.stability)}, kesiapan militer ${Math.round(c.gov.readiness ?? 50)}, ${c.war?.length ? 'berperang dengan ' + c.war.join(',') : 'damai'}${extra ? '; ' + extra : ''})`;
const sayWhy = (t) => clip(t, 200);

async function refine(inner, fwd, d, pre, uid) {
  if (inner === 'propose_trade' && (d.status === 'active' || d.status === 'rejected')) {
    const pr = await presOf(uid, fwd.session), to = String(fwd.to || '').toUpperCase(); if (!pr) return;
    const offer = (await sb.from('cm_offers').select('id,status,sector,value,tariff_to,tariff_from,year').eq('from_c', pr.code).eq('to_c', to).eq('sector', fwd.sector).order('id', { ascending: false }).limit(1)).data?.[0], tr = (await sb.from('cm_countries').select('data').eq('code', to).single()).data?.data; if (!offer || !tr) return;
    const rule = d.status === 'active', rel = tr.rel?.[pr.code] || 0, size = (+offer.value / Math.max(1, tr.gdp) * 100).toFixed(1);
    const o = await llm(`Kamu menjadi presiden NPC yang menjawab tawaran dagang dari negara lain dalam game simulasi (data fiksi).\nKamu: ${dos(tr)}.\nPengusul: ${dos(pr.data)}.\nHubungan kamu dengan pengusul: ${rel} (skala -100..100)${shared(tr, pr.data) ? ', sesama anggota aliansi' : ''}.\nTawaran: ekspor sektor ${fwd.sector} senilai ${(+offer.value).toFixed(2)} miliar USD/tahun (${size}% dari PDB-mu), tarif impor yang dikenakan padamu ${offer.tariff_to}%, tarif yang kamu kenakan ${offer.tariff_from}%, tarif umummu ${tr.pol.tariff}%.\nModel aturan menyarankan: ${rule ? 'TERIMA' : 'TOLAK'}.\nPutuskan sesuai kepentinganmu dan wataknya (industri lokal, defisit/surplus, hubungan, aliansi, inflasi). Keluarkan JSON: {"accept":true|false,"why":"satu kalimat pernyataan resmi presiden, bahasa Indonesia, maks 180 karakter"}`);
    if (typeof o?.accept !== 'boolean') return; const acc = o.accept, why = sayWhy(o.why);
    if (acc !== rule) { if (acc) { const cnt = async (cd) => (await sb.from('cm_offers').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('kind', 'trade').or(`from_c.eq.${cd},to_c.eq.${cd}`)).count || 0; if ((await cnt(pr.code)) >= 12 || (await cnt(to)) >= 12) return; }
      await sb.from('cm_offers').update({ status: acc ? 'active' : 'rejected' }).eq('id', offer.id); const dl = acc ? 6 : -6; await cas(to, c => { c.rel = c.rel || {}; c.rel[pr.code] = clamp((c.rel[pr.code] || 0) + dl, -100, 100); }); await cas(pr.code, c => { c.rel = c.rel || {}; c.rel[to] = clamp((c.rel[to] || 0) + dl, -100, 100); }); }
    await fixNews(to, /menerima tawaran dagang|menolak tawaran dagang/, `${tr.name} ${acc ? 'menerima' : 'menolak'} tawaran dagang dari ${pr.data.name}`, `${why}${acc ? ' Perjanjian mulai berlaku pada pergantian tahun.' : ''}`);
    d.status = acc ? 'active' : 'rejected'; d.note = `${acc ? 'NPC menerima tawaran' : 'NPC menolak tawaran'}: ${why}`; return;
  }
  if (inner === 'propose_peace' && (d.status === 'accepted' || d.status === 'rejected')) {
    const pr = await presOf(uid, fwd.session), t = String(fwd.target || '').toUpperCase(); if (!pr) return; const tr = (await sb.from('cm_countries').select('data').eq('code', t).single()).data?.data; if (!tr) return;
    const rule = d.status === 'accepted';
    const o = await llm(`Kamu menjadi presiden NPC yang menjawab usulan damai dari lawan perangmu dalam game simulasi (data fiksi).\nKamu: ${dos(tr)}.\nPengusul: ${dos(pr.data)}.\nPerang menggerus PDB ~3% per tahun dan stabilitas kedua pihak.\nModel aturan menyarankan: ${rule ? 'TERIMA' : 'TOLAK'}.\nPutuskan berdasarkan wataknya, kelelahan perang (kepuasan, stabilitas, ekonomi) dan kekuatan relatif. Keluarkan JSON: {"accept":true|false,"why":"satu kalimat pernyataan presiden, maks 180 karakter"}`);
    if (typeof o?.accept !== 'boolean') return; const acc = o.accept, why = sayWhy(o.why);
    if (acc !== rule) { if (acc) { await cas(pr.code, c => { c.war = (c.war || []).filter(x => x !== t); }); await cas(t, c => { c.war = (c.war || []).filter(x => x !== pr.code); }); } else { await cas(pr.code, c => { if (!c.war.includes(t)) c.war.push(t); }); await cas(t, c => { if (!c.war.includes(pr.code)) c.war.push(pr.code); }); } }
    await fixNews(pr.code, /DAMAI|menolak usulan damai/, acc ? `DAMAI: ${pr.data.name} dan ${tr.name} sepakat gencatan senjata` : `${tr.name} menolak usulan damai ${pr.data.name}`, why);
    d.status = acc ? 'accepted' : 'rejected'; d.note = `${acc ? 'Perdamaian tercapai' : 'NPC menolak perdamaian'}: ${why}`; return;
  }
  const taxKeys = ['taxInc', 'taxCorp'], isTax = inner === 'set_policy' && taxKeys.some(k => fwd.policy && k in fwd.policy);
  const isMotion = inner === 'motion' && !!MOTIONS[fwd.motion];
  if (d.vote && (isTax || isMotion || inner === 'propose_law' || inner === 'repeal_law')) {
    const pr = await presOf(uid, fwd.session); if (!pr) return; const c = pr.data, v = d.vote, rule = !!v.passed, parties = (c.gov.parties || []).map(x => x.name).slice(0, 5).join(', ') || 'partai-partai';
    const desc = isMotion ? `${MOTIONS[fwd.motion]} (dampak bila disetujui: ${MOTION_FX[fwd.motion]})` : isTax ? `usulan perubahan pajak: penghasilan ${pre?.taxInc ?? '?'}% -> ${fwd.policy.taxInc ?? pre?.taxInc ?? '?'}%, korporasi ${pre?.taxCorp ?? '?'}% -> ${fwd.policy.taxCorp ?? pre?.taxCorp ?? '?'}%` : inner === 'propose_law' ? `RUU baru "${String(fwd.law).replace(/_/g, ' ')}"` : `usulan pencabutan UU "${String(fwd.law).replace(/_/g, ' ')}"`;
    const o = await llm(`Kamu mensimulasikan sidang parlemen 100 kursi dalam game simulasi (data fiksi) untuk negara ${dos(c)}.\nPartai: ${parties}. Kursi koalisi pemerintah: ${v.coalition}. Ideologi negara: ${c.gov.ideology}, kepercayaan publik ${Math.round(c.gov.trust)}, korupsi ${Math.round(c.gov.corruption)}, utang ${(c.debt / Math.max(1, c.gdp) * 100).toFixed(0)}% PDB, kas ${c.treasury.toFixed(1)} M$.\nMosi: ${desc}.\nModel statistik memprediksi: setuju ${v.yes}, menolak ${v.no}, abstain ${v.abstain} (${rule ? 'LOLOS' : 'GAGAL'}).\nTentukan hasil akhir yang realistis (boleh menyimpang maksimal 20 suara dari prediksi, hanya bila ada alasan politik kuat) dan tulis 3 kutipan debat anggota parlemen dengan partai berbeda, bahasa Indonesia, maks 160 karakter per kutipan. yes+no+abstain harus 100.\nKeluarkan JSON: {"yes":int,"no":int,"abstain":int,"debate":[{"who":"Nama (Partai)","said":"..."}]}`);
    if (!o || ![o.yes, o.no, o.abstain].every(Number.isInteger) || o.yes + o.no + o.abstain !== 100 || o.yes < 0 || o.no < 0 || o.abstain < 0 || Math.abs(o.yes - v.yes) > 20) return;
    const passed = o.yes > 50, debate = (o.debate || []).slice(0, 3).map(x => ({ who: clip(x?.who, 60), said: clip(x?.said, 170) })).filter(x => x.who && x.said);
    if (passed !== rule) {
      if (isTax) { const tax = {}; for (const k of taxKeys) if (fwd.policy && k in fwd.policy) tax[k] = passed ? fwd.policy[k] : pre?.[k]; await cas(pr.code, cc => { for (const k in tax) if (tax[k] !== undefined) cc.pol[k] = tax[k]; }); }
      else if (isMotion) await cas(pr.code, cc => { if (passed) applyMotionFx(cc, fwd.motion); else for (const f of MOTION_FIELDS[fwd.motion]) if (pre?.snap?.[f[1]] !== undefined) setF(cc, f, pre.snap[f[1]]); });
      else if (inner === 'propose_law') await cas(pr.code, cc => { cc.gov.laws = cc.gov.laws.filter(x => x !== fwd.law); if (passed) cc.gov.laws.push(fwd.law); });
      else await cas(pr.code, cc => { if (passed) cc.gov.laws = cc.gov.laws.filter(x => x !== fwd.law); else if (!cc.gov.laws.includes(fwd.law)) cc.gov.laws.push(fwd.law); }); }
    const head = debate[0] ? ` Debat: ${debate[0].who}: "${debate[0].said}"` : '';
    await fixNews(pr.code, /pajak|RUU|Pencabutan|Mosi/i, isMotion ? `${MOTIONS[fwd.motion]} di parlemen ${c.name}: ${passed ? 'DISETUJUI' : 'DITOLAK'}` : isTax ? `Parlemen ${passed ? 'setujui' : 'tolak'} usulan pajak ${c.name}` : inner === 'propose_law' ? `RUU "${String(fwd.law).replace(/_/g, ' ')}" di ${c.name}: ${passed ? 'DISAHKAN' : 'DITOLAK'}` : `Pencabutan "${String(fwd.law).replace(/_/g, ' ')}" di ${c.name}: ${passed ? 'DISETUJUI' : 'DITOLAK'}`, `Suara: ${o.yes} setuju, ${o.no} menolak, ${o.abstain} abstain.${head}`);
    d.vote = { ...v, yes: o.yes, no: o.no, abstain: o.abstain, passed, debate }; if (isTax) d.note = passed ? 'Parlemen menyetujui perubahan pajak.' : 'Parlemen MENOLAK perubahan pajak; tarif lama tetap berlaku.'; }
}
async function proxy(tok, apikey, uid, body) {
  const inner = String(body.inner || ''); if (!PROXIED.has(inner)) return { status: 404, json: { ok: false, error: 'Aksi tidak dikenal' } };
  const fwd = { ...body, action: inner }; delete fwd.inner; let pre = null;
  if (inner === 'set_policy' && fwd.policy) { const pr = await presOf(uid, fwd.session); if (pr) pre = { taxInc: pr.data.pol.taxInc, taxCorp: pr.data.pol.taxCorp }; }
  if (inner === 'motion' && MOTION_FIELDS[fwd.motion]) { const pr = await presOf(uid, fwd.session); if (pr) { const snap = {}; for (const f of MOTION_FIELDS[fwd.motion]) snap[f[1]] = getF(pr.data, f); pre = { snap }; } }
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cm-api`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, apikey: apikey || '' }, body: JSON.stringify(fwd) });
  const j = await r.json().catch(() => null); if (!r.ok || !j?.ok) return { status: r.status || 502, json: j || { ok: false, error: 'Kesalahan server' } };
  try { if (j.data) await refine(inner, fwd, j.data, pre, uid); } catch (e) { console.error('refine', e); }
  return { status: 200, json: j };
}

// ---------- geopolitik NPC: perang & damai antar-NPC diputuskan Gemini (langka, maks 2 perang baru per tahun) ----------
async function npcGeopolitics(npcs, year, news) {
  const by = Object.fromEntries(npcs.map(r => [r.code, r])), R = rng('geo|' + year), out = { peace: 0, war: 0 };
  const pairs = []; for (const r of npcs) for (const t of r.data.war || []) if (r.code < t && by[t]) pairs.push([r, by[t]]);
  if (pairs.length) { const o = await llm(`Kamu menentukan apakah perang antar-negara NPC berakhir tahun ini dalam game simulasi (data fiksi). Perang menggerus PDB 3% per tahun. Pertimbangkan kelelahan perang (kepuasan, stabilitas, ekonomi), watak presiden, dan kekuatan relatif. Damai sebaiknya tidak terlalu cepat bila kedua presiden agresif dan masih kuat.\n${pairs.slice(0, 20).map(([a, b], i) => `${i + 1}. [${a.code}] ${dos(a.data)} vs [${b.code}] ${dos(b.data)}`).join('\n')}\nKeluarkan JSON: {"p":[{"a":"KODE","b":"KODE","peace":true|false,"why":"satu kalimat, maks 160 karakter"}]}`);
    for (const x of o?.p || []) { const a = by[String(x?.a).toUpperCase()], b = by[String(x?.b).toUpperCase()]; if (!a || !b || x.peace !== true || !a.data.war.includes(b.code)) continue; await cas(a.code, c => { c.war = c.war.filter(y => y !== b.code); }); await cas(b.code, c => { c.war = c.war.filter(y => y !== a.code); }); out.peace++; news.push({ year, country: a.code, source: 'Kantor Berita Global', kind: 'konflik', title: `DAMAI: ${a.data.name} dan ${b.data.name} mengakhiri perang`, body: sayWhy(x.why) }); } }
  const cand = []; for (const r of npcs) { const c = r.data; if ((c.ai?.tr.hawk ?? 0) < 0.68 || (c.gov.readiness ?? 0) < 45 || c.war?.length) continue; const nb = npcs.filter(b => b.code !== r.code && b.data.region === c.region && !b.data.war?.length && !shared(c, b.data) && (c.rel?.[b.code] || 0) <= 5).sort(() => R() - 0.5)[0]; if (nb) cand.push([r, nb]); }
  const pick12 = cand.sort(() => R() - 0.5).slice(0, 12);
  if (pick12.length) { const o = await llm(`Kamu menentukan apakah ada perang baru antar-negara NPC dalam game simulasi (data fiksi). Perang itu LANGKA dan merusak ekonomi; pilih paling banyak 2 perang dari kandidat di bawah, hanya bila ada alasan kuat (presiden agresif, kesiapan militer tinggi, kepuasan rakyat rendah sehingga butuh pengalihan isu, lawan lebih lemah, hubungan buruk). Boleh memilih nol.\n${pick12.map(([a, b], i) => `${i + 1}. penyerang [${a.code}] ${dos(a.data)} -> sasaran [${b.code}] ${dos(b.data)}; hubungan ${a.data.rel?.[b.code] || 0}`).join('\n')}\nKeluarkan JSON: {"w":[{"a":"KODE penyerang","b":"KODE sasaran","why":"alasan resmi satu kalimat, maks 160 karakter"}]}`);
    for (const x of (o?.w || []).slice(0, 2)) { const a = by[String(x?.a).toUpperCase()], b = by[String(x?.b).toUpperCase()]; if (!a || !b || !pick12.some(([p, q]) => p.code === a.code && q.code === b.code) || a.data.war?.length) continue;
      await cas(a.code, c => { if (!c.war.includes(b.code)) c.war.push(b.code); c.rel = c.rel || {}; c.rel[b.code] = -80; }); await cas(b.code, c => { if (!c.war.includes(a.code)) c.war.push(a.code); c.rel = c.rel || {}; c.rel[a.code] = -80; c.gov.readiness = clamp((c.gov.readiness ?? 50) + 5, 0, 100); });
      await sb.from('cm_offers').update({ status: 'cancelled' }).eq('kind', 'trade').in('status', ['active', 'pending']).or(`and(from_c.eq.${a.code},to_c.eq.${b.code}),and(from_c.eq.${b.code},to_c.eq.${a.code})`); out.war++;
      news.push({ year, country: a.code, source: 'Kantor Berita Global', kind: 'konflik', title: `PERANG: ${a.data.name} menyerang ${b.data.name}`, body: sayWhy(x.why) }); } }
  return out;
}

async function run() {
  const w = (await sb.from('cm_world').select('year,npc_year').eq('id', 1).single()).data; if (!w || (w.npc_year ?? 0) >= w.year) return { skipped: true, year: w?.year };
  const lock = await sb.from('cm_world').update({ npc_year: w.year }).eq('id', 1).or(`npc_year.is.null,npc_year.lt.${w.year}`).select('id'); if (!lock.data?.length) return { skipped: true, year: w.year };
  const year = w.year, R = rng('npc|' + year), rows = (await sb.from('cm_countries').select('code,data,ver,president_uid,president_seen')).data || [];
  const live = (r) => r.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < PRES_TTL * 40, players = rows.filter(live), npcs = rows.filter(r => !r.president_uid);
  const offers = (await sb.from('cm_offers').select('from_c,to_c,status,kind,year').gte('year', year - 1)).data || [], pset = new Set(players.map(p => p.code)), byCode = Object.fromEntries(rows.map(r => [r.code, r]));
  const news = [], shifts = [];
  // 1) presiden NPC berpikir + belajar; ingatan hubungan dari perlakuan pemain
  const plan = {};
  for (const r of npcs) { const c = r.data; c.rel = c.rel || {};
    for (const o of offers) { if (o.year !== year - 1 && o.year !== year) continue; if (o.to_c === c.code && pset.has(o.from_c)) c.rel[o.from_c] = clamp((c.rel[o.from_c] || 0) + (o.status === 'active' ? 5 : o.kind === 'peace' ? 3 : 1), -100, 100); if (o.from_c === c.code && pset.has(o.to_c) && o.status === 'rejected') c.rel[o.to_c] = clamp((c.rel[o.to_c] || 0) - 4, -100, 100); }
    for (const p of players) if (c.war?.includes(p.code)) c.rel[p.code] = clamp((c.rel[p.code] || 0) - 10, -100, 100); else if (p.data.war?.some(x => byCode[x] && c.mem?.some(a => a !== 'UN' && byCode[x].data.mem?.includes(a)))) c.rel[p.code] = clamp((c.rel[p.code] || 0) - 5, -100, 100);
    r.pc = prepare(c, year); }
  // negara yang "layak dipikirkan Gemini": ekonomi besar, atau sedang bermasalah / berperang / berhubungan dengan pemain
  const ranked0 = [...npcs].sort((a, b) => b.data.gdp - a.data.gdp), top = new Set(ranked0.slice(0, 48).map(r => r.code)), interesting = npcs.filter(r => top.has(r.code) || Math.max(...Object.values(r.pc.pr)) > 5 || r.data.war?.length || players.some(p => Math.abs(r.data.rel?.[p.code] || 0) >= 15)).slice(0, 120);
  const batches = []; for (let i = 0; i < interesting.length; i += 15) batches.push(interesting.slice(i, i + 15).map(r => ({ r, pc: r.pc, rel: players.map(p => `${p.data.name} ${r.data.rel?.[p.code] || 0}`).join(', ') })));
  let aiN = 0; (await Promise.all(batches.map(b => aiPresidents(b)))).forEach(o => Object.assign(plan, o));
  for (const r of npcs) { const t = think(r.data, year, r.pc, plan[r.code]); r.t = t; if (t.by === 'gemini') aiN++; if (t.changed && t.acts.length) shifts.push(r); }
  let saved = 0; for (let i = 0; i < npcs.length; i += 25) { const res = await Promise.all(npcs.slice(i, i + 25).map(r => sb.from('cm_countries').update({ data: r.data, ver: r.ver + 1 }).eq('code', r.code).eq('ver', r.ver).is('president_uid', null).select('code'))); saved += res.filter(x => x.data?.length).length; }
  for (const r of shifts.sort((a, b) => b.data.gdp - a.data.gdp).slice(0, 6)) news.push({ year, country: r.code, source: 'Analisis Dunia', kind: 'politik', title: `${r.data.name} mengubah arah: fokus ${GOALS[r.t.goal].t}`, body: `${r.t.why ? '"' + r.t.why + '" — ' : ''}Presiden ${r.data.gov.president} ${r.t.acts.map(k => ACTS[k][3]).join(' dan ')}.${r.t.learned ? ` Evaluasi kebijakan tahun lalu: ${r.t.learned.reward >= 0 ? 'berhasil' : 'kurang berhasil'}, strategi disesuaikan.` : ''}` });
  const geo = await npcGeopolitics(npcs, year, news).catch(e => { console.error('geo', e); return null; });
  // 2) diplomasi adaptif ke negara pemain
  const busy = new Set(offers.filter(o => o.status === 'pending' || o.status === 'active').map(o => [o.from_c, o.to_c].sort().join('|'))), ins = [];
  for (const p of players) { const ranked = npcs.map(r => [r, affinity(r.data, p.data) + R() * 12]).sort((a, b) => b[1] - a[1]);
    for (const [r, a] of ranked.slice(0, 2)) { if (a < 8 || busy.has([r.code, p.code].sort().join('|'))) continue; const n = r.data, sector = !p.data.oil && n.oil ? 'energi' : pick(R, SECT), value = Math.round(clamp(Math.min(n.gdp, p.data.gdp) * 0.004 * (0.5 + R()), 0.05, 60) * 100) / 100, cut = a > 40 ? 5 : a > 20 ? 2 : 0, tf = clamp(Math.round(n.pol.tariff - cut), 0, 40);
      ins.push({ kind: 'trade', from_c: r.code, to_c: p.code, sector, value, tariff_from: tf, tariff_to: tf, status: 'pending', year }); news.push({ year, country: p.code, source: 'Harian Dunia', kind: 'perdagangan', title: `${n.name} menawarkan perdagangan ${sector} kepada ${p.data.name}`, body: `Nilai ${value.toFixed(2)} miliar USD/tahun, tarif ${tf}%. ${a > 40 ? 'Hubungan erat membuat tarif diturunkan.' : 'Menunggu jawaban presiden.'}` }); }
    const foe = ranked[ranked.length - 1]; if (foe && (foe[0].data.rel?.[p.code] || 0) < -40 && foe[0].data.ai?.tr.hawk > 0.55) news.push({ year, country: p.code, source: 'Harian Dunia', kind: 'konflik', title: `${foe[0].data.name} memperingatkan ${p.data.name}`, body: 'Hubungan memburuk. Diplomasi atau bantuan dapat meredakan ketegangan.' }); }
  if (ins.length) await sb.from('cm_offers').insert(ins);
  // 3) warga NPC (AI Gemini; jatuh ke templat bila gagal): posting sesuai keadaan & balasan atas postingan pemain
  await Promise.all(players.map(async (p) => { const c = { ...p.data, year }, Rc = rng(p.code + '|soc|' + year), builds = (await sb.from('cm_builds').select('kind,region').eq('country', p.code).eq('year', year - 1).limit(30)).data || [];
    const recent = (await sb.from('cm_posts').select('id,body,uid').eq('country', p.code).not('uid', 'is', null).eq('hidden', false).order('id', { ascending: false }).limit(4)).data || [], todo = [];
    for (const po of recent) { const has = (await sb.from('cm_comments').select('id', { count: 'exact', head: true }).eq('post_id', po.id).is('uid', null)).count || 0; if (has < 2) todo.push(po); }
    const [aiPosts, aiRep] = await Promise.all([aiCitizenPosts(c, builds, Rc), aiCitizenReplies(c, todo, Rc)]);
    const texts = aiPosts.length ? aiPosts : [mood(Rc, c, builds), mood(Rc, c, [])]; await sb.from('cm_posts').insert(texts.map(body => ({ country: p.code, author: pick(Rc, NAMES), role: 'warga', body })));
    for (const po of todo) for (const t of (aiRep[po.id]?.length ? aiRep[po.id] : [reply(Rc, po.body, c)])) await sb.from('cm_comments').insert({ post_id: po.id, country: p.code, uid: null, author: pick(Rc, NAMES), role: 'warga', body: t }); }));
  // analisis berita bergaya jurnalis (AI)
  { const top = shifts.slice(0, 6), spin = await aiNewsSpin(top.map(r => ({ n: r.data.name, goal: GOALS[r.t.goal].t, acts: r.t.acts.map(k => ACTS[k][3]).join(', '), ok: r.t.learned ? (r.t.learned.reward >= 0 ? 'berhasil' : 'kurang berhasil') : 'belum ada' })));
    top.forEach((r, i) => { if (spin[i]) { const n = news.find(x => x.country === r.code && x.source === 'Analisis Dunia'); if (n) n.body = spin[i] + ' — ' + n.body; } }); }
  if (news.length) await sb.from('cm_news').insert(news);
  return { ok: true, year, npcs: saved, ai: aiN, geo, offers: ins.length, news: news.length };
}
// balasan warga NPC langsung setelah pemain memposting (bukan menunggu pergantian tahun)
async function react(uid, postId) {
  const po = (await sb.from('cm_posts').select('id,body,uid,country,hidden,ts').eq('id', postId).maybeSingle()).data; if (!po || po.hidden || po.uid !== uid) return { skipped: 'bukan postingan Anda' };
  if (Date.now() - new Date(po.ts).getTime() > 120_000) return { skipped: 'terlalu lama' };
  const has = (await sb.from('cm_comments').select('id', { count: 'exact', head: true }).eq('post_id', po.id).is('uid', null)).count || 0; if (has >= 2) return { skipped: 'sudah dibalas' };
  const row = (await sb.from('cm_countries').select('data').eq('code', po.country).single()).data; if (!row) return { skipped: 'negara tidak ada' };
  const w = (await sb.from('cm_world').select('year').eq('id', 1).single()).data, c = { ...row.data, year: w.year }, R = rng(po.id + '|react');
  const ai = await aiCitizenReplies(c, [po], R), list = ai[po.id]?.length ? ai[po.id] : [reply(R, po.body, c)];
  for (const t of list) await sb.from('cm_comments').insert({ post_id: po.id, country: po.country, uid: null, author: pick(R, NAMES), role: 'warga', body: t });
  return { ok: true, replies: list.length, ai: !!ai[po.id]?.length };
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) return new Response(JSON.stringify({ ok: false, error: 'Silakan masuk terlebih dahulu' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    const body = await req.json().catch(() => ({}));
    if (body.action === 'proxy') { const px = await proxy(tok, req.headers.get('apikey'), data.user.id, body); return new Response(JSON.stringify(px.json), { status: px.status, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
    if (body.action === 'react') return new Response(JSON.stringify({ ok: true, data: await react(data.user.id, Number(body.post_id)) }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true, data: await run() }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { console.error(e); return new Response(JSON.stringify({ ok: false, error: 'Kesalahan server: ' + (e?.message || e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
