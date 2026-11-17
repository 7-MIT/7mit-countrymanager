// @ts-nocheck
// country.7mit — Media sosial hidup: warga NPC (persona tetap) memposting, saling membalas, berdebat, memberi suka,
// dan menanggapi pemain (balasan komentar, sebutan @nama). Semua teks dihasilkan Gemini dari keadaan negara & berita terbaru.
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sleep = (ms) => new Promise(r => setTimeout(r, ms)), PRES_TTL = 60_000;
const clip = (v, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const txt = (v, max, name, min = 1) => { const s = String(v ?? '').trim(); if (s.length < min) bad(`${name} wajib diisi`); if (s.length > max) bad(`${name} maksimal ${max} karakter`); return s; };
const cc = (v) => { const s = String(v ?? '').toUpperCase(); if (!/^[A-Z]{2}$/.test(s)) bad('Kode negara tidak valid'); return s; };
const slug = (n) => String(n || 'warga').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 18) || 'warga';
async function authUser(req) { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401); const u = data.user, md = u.user_metadata || {}; return { id: u.id, email: (u.email || '').toLowerCase(), name: String(md.full_name || md.name || (u.email || 'Warga').split('@')[0]).slice(0, 40) }; }
async function profile(u) { let p = must(await sb.from('cm_profiles').select('*').eq('uid', u.id).maybeSingle()); if (!p) p = must(await sb.from('cm_profiles').insert({ uid: u.id, name: u.name }).select().single()); if (p.banned) bad('Akun Anda dibatasi oleh admin UN', 403); return p; }
const live = (r, ttl) => !!(r?.president_uid && r.president_seen && Date.now() - new Date(r.president_seen).getTime() < ttl);
async function presRow(u, session) { if (!session) return null; const r = must(await sb.from('cm_countries').select('code,data,president_seen').eq('president_uid', u.id).eq('president_session', session).maybeSingle()); return r && live(r, PRES_TTL * 2) ? r : null; }
let KEY = null; const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
async function llm(prompt, maxMs = 35000) {
  if (KEY === null) KEY = (await sb.from('cm_secrets').select('v').eq('k', 'gemini_key').maybeSingle()).data?.v || ''; if (!KEY) return null; const t0 = Date.now();
  for (const m of MODELS) for (let a = 0; a < 2; a++) { if (Date.now() - t0 > maxMs) return null;
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.max(3000, maxMs - (Date.now() - t0))), headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 1, maxOutputTokens: 3500 } }) });
      if (r.status === 503 || r.status === 429) { await sleep(600); continue; } if (!r.ok) break; const j = await r.json(), t = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || ''; return JSON.parse(t.replace(/^```json|```$/g, '').trim()); } catch (e) { /* model berikutnya */ } }
  return null; }
const STYLE = 'Tulis seperti orang sungguhan di media sosial (bahasa Indonesia sehari-hari/gaul, boleh slang daerah, singkat, kadang emoji atau typo ringan, hashtag jarang, maks 220 karakter). Ada yang mendukung pemerintah, ada yang kritis, ada yang netral atau melucu; jangan semuanya sepakat; boleh berdebat, meledek ringan, atau menyindir tetapi tanpa SARA, ujaran kebencian, atau ancaman. Jangan menyebut diri AI. Ini game simulasi (data fiksi).';
const brief = (c) => `${c.name}: presiden ${c.gov.president}, kepuasan ${Math.round(c.gov.approval)}%, pertumbuhan ${c.growth.toFixed(1)}%, inflasi ${c.infl.toFixed(1)}%, pengangguran ${c.unemp.toFixed(1)}%, korupsi ${Math.round(c.gov.corruption)}/100, ${(c.war || []).length ? 'sedang berperang' : 'damai'}`;
const FALLBACK = [['Budi', 'Santoso', 'pedagang pasar', 'kritis'], ['Siti', 'Aminah', 'guru honorer', 'netral'], ['Joko', 'Pratama', 'driver ojol', 'kritis'], ['Dewi', 'Lestari', 'perawat', 'netral'], ['Andi', 'Wijaya', 'mahasiswa', 'kritis'], ['Rina', 'Kusuma', 'pemilik warung', 'pro-pemerintah'], ['Agus', 'Salim', 'petani', 'netral'], ['Maya', 'Putri', 'karyawan swasta', 'humoris'], ['Dani', 'Hermawan', 'buruh pabrik', 'kritis'], ['Lina', 'Marlina', 'ibu rumah tangga', 'pro-pemerintah']];

async function ensurePersonas(code) {
  const st = must(await sb.from('cm_soc_state').select('seeded').eq('country', code).maybeSingle());
  if (st?.seeded) return; if (!st) await sb.from('cm_soc_state').insert({ country: code }).then(() => {}, () => {});
  const claim = await sb.from('cm_soc_state').update({ seeded: true }).eq('country', code).eq('seeded', false).select('country'); if (!claim.data?.length) return;
  const row = must(await sb.from('cm_countries').select('data').eq('code', code).maybeSingle()), c = row?.data; if (!c) return;
  const o = await llm(`Buat 14 persona warga biasa untuk jejaring sosial negara fiksi ${brief(c)} (region ${c.region}) dalam game simulasi. Nama, nama pengguna (handle huruf kecil tanpa spasi, mis. budi_88), pekerjaan, bio 1 kalimat (gaya bio media sosial), sikap terhadap pemerintah ("pro-pemerintah","kritis","netral","humoris","aktivis","oposisi"), dan sifat singkat. Sesuaikan nama dan pekerjaan dengan budaya negara itu (tapi tulis bio dalam bahasa Indonesia). Keluarkan JSON: {"p":[{"name":"","handle":"","job":"","bio":"","stance":"","trait":"sifat khas gaya menulis"}]}`, 40000);
  let list = (o?.p || []).filter(x => x?.name && x?.handle).slice(0, 16);
  if (list.length < 6) list = FALLBACK.map(([a, b, job, stance], i) => ({ name: `${a} ${b}`, handle: `${a.toLowerCase()}_${b.toLowerCase().slice(0, 3)}${10 + i * 7}`, job, bio: `${job} · warga ${c.name}`, stance, trait: '' }));
  const rows = list.map((x, i) => ({ country: code, handle: slug(x.handle).slice(0, 18) || 'warga' + i, name: clip(x.name, 40), bio: clip(x.bio, 140), job: clip(x.job, 40), stance: clip(x.stance, 20) || 'netral', traits: { style: clip(x.trait, 80) }, followers: 40 + Math.floor(Math.random() * 4800) }));
  await sb.from('cm_personas').upsert(rows, { onConflict: 'country,handle' });
}
const personasOf = async (code) => must(await sb.from('cm_personas').select('*').eq('country', code).order('id'));

function hashtags(texts) { const m = new Map(); for (const t of texts) for (const h of String(t).match(/#[\p{L}\p{N}_]{3,30}/gu) || []) m.set(h.toLowerCase(), (m.get(h.toLowerCase()) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, n]) => ({ tag, n })); }

async function tick(code, force = false) {
  await ensurePersonas(code);
  const thr = new Date(Date.now() - 18_000).toISOString(); const claim = await sb.from('cm_soc_state').update({ last_tick: new Date().toISOString() }).eq('country', code).lt('last_tick', thr).select('country'); if (!force && !claim.data?.length) return { skipped: true };
  const row = must(await sb.from('cm_countries').select('data').eq('code', code).maybeSingle()), c = row?.data; if (!c) return { skipped: true };
  const ps = await personasOf(code); if (!ps.length) return { skipped: true };
  const posts = must(await sb.from('cm_posts').select('id,author,role,body,likes,persona_id,uid,ts').eq('country', code).eq('hidden', false).order('id', { ascending: false }).limit(12)), pids = posts.map(p => p.id);
  const cms = pids.length ? must(await sb.from('cm_comments').select('id,post_id,author,role,body,persona_id,uid,reply_to,ts').in('post_id', pids).eq('hidden', false).order('id', { ascending: false }).limit(30)) : [];
  const news = must(await sb.from('cm_news').select('title').eq('country', code).order('id', { ascending: false }).limit(5)), cutoff = Date.now() - 20 * 60_000;
  const replied = new Set(cms.filter(x => x.reply_to).map(x => x.reply_to)), needC = cms.filter(x => x.uid && !replied.has(x.id) && new Date(x.ts).getTime() > cutoff), cmByPost = new Map(); cms.forEach(x => cmByPost.set(x.post_id, (cmByPost.get(x.post_id) || 0) + 1));
  const needP = posts.filter(p => p.uid && !cmByPost.get(p.id) && new Date(p.ts).getTime() > cutoff);
  const pLine = ps.map(p => `#${p.id} @${p.handle} ${p.name} (${p.job}; sikap ${p.stance}; gaya ${p.traits?.style || '-'})`).join('\n');
  const postLine = posts.map(p => `[post ${p.id}] ${p.persona_id ? '@' + (ps.find(x => x.id === p.persona_id)?.handle || p.author) : p.author + (p.uid ? ' (PEMAIN)' : '')}: "${clip(p.body, 160)}" (suka ${p.likes}, komentar ${cmByPost.get(p.id) || 0})${needP.some(x => x.id === p.id) ? ' <-- perlu ditanggapi' : ''}`).join('\n');
  const cmLine = cms.slice().reverse().map(x => `[komentar ${x.id} pada post ${x.post_id}${x.reply_to ? ' membalas ' + x.reply_to : ''}] ${x.persona_id ? '@' + (ps.find(p => p.id === x.persona_id)?.handle || x.author) : x.author + (x.uid ? ' (PEMAIN)' : '')}: "${clip(x.body, 140)}"${needC.some(n => n.id === x.id) ? ' <-- perlu dibalas' : ''}`).join('\n');
  const o = await llm(`Kamu menggerakkan warga NPC di media sosial negara ${brief(c)}. Berita terbaru: ${news.map(n => n.title).join(' | ') || '-'}.\nAkun NPC (gunakan id angka persis):\n${pLine}\n\nUnggahan terbaru:\n${postLine || '(belum ada)'}\n\nKomentar terbaru:\n${cmLine || '(belum ada)'}\n\n${STYLE}\nPilih 4-7 aksi realistis dalam satu putaran: (a) unggahan baru dari akun NPC (opini/berita/curhat/meme, hubungkan dengan keadaan negara atau berita); (b) komentar atau balasan antar-NPC (debat, dukung, sindir) - "reply" diisi id komentar yang dibalas bila membalas komentar; (c) suka. UTAMAKAN menanggapi yang ditandai "perlu ditanggapi/dibalas" (unggahan/komentar pemain) dengan balasan yang nyambung ke isinya. Satu akun maks 2 aksi, jangan membalas komentarnya sendiri. Keluarkan JSON: {"a":[{"t":"post","p":ID,"body":"..."},{"t":"comment","p":ID,"post":ID,"reply":ID|null,"body":"..."},{"t":"like","post":ID,"n":1-4}]}`);
  const acts = Array.isArray(o?.a) ? o.a : []; const used = new Map(); let np = 0, nc = 0, nl = 0; const pmap = new Map(ps.map(p => [p.id, p])), postIds = new Set(pids), cmMap = new Map(cms.map(x => [x.id, x]));
  for (const x of acts.slice(0, 9)) { const p = pmap.get(Number(x?.p)); const body = clip(x?.body, 240);
    if (x?.t === 'like') { const id = Number(x.post); if (postIds.has(id)) { const n = clamp(Math.round(Number(x.n) || 1), 1, 4), cur = posts.find(q => q.id === id); await sb.from('cm_posts').update({ likes: (cur?.likes || 0) + n }).eq('id', id); cur.likes += n; nl += n; } continue; }
    if (!p || !body || (used.get(p.id) || 0) >= 2) continue;
    if (x.t === 'post' && np < 2) { await sb.from('cm_posts').insert({ country: code, uid: null, author: p.name, role: 'npc', body, persona_id: p.id, handle: p.handle }); used.set(p.id, (used.get(p.id) || 0) + 1); np++; }
    else if (x.t === 'comment' && nc < 6) { const pid = Number(x.post); if (!postIds.has(pid)) continue; let rep = x.reply ? cmMap.get(Number(x.reply)) : null; if (rep && rep.post_id !== pid) rep = null; if (rep?.persona_id === p.id) continue; await sb.from('cm_comments').insert({ post_id: pid, country: code, uid: null, author: p.name, role: 'npc', body, persona_id: p.id, handle: p.handle, reply_to: rep?.id || null }); used.set(p.id, (used.get(p.id) || 0) + 1); nc++; } }
  return { ok: true, posts: np, comments: nc, likes: nl };
}
// komentar pemain -> balasan NPC langsung (mention @handle / balasan atas komentar NPC diprioritaskan)
async function replyToComment(code, comment, post) {
  const c = must(await sb.from('cm_countries').select('data').eq('code', code).maybeSingle())?.data; if (!c) return [];
  const ps = await personasOf(code), by = new Map(ps.map(p => [p.id, p])); const ment = (comment.body.match(/@([a-z0-9_]{2,20})/gi) || []).map(m => m.slice(1).toLowerCase()); let must_ = ps.filter(p => ment.includes(p.handle.toLowerCase()));
  let parent = null; if (comment.reply_to) { parent = must(await sb.from('cm_comments').select('id,persona_id,author,body').eq('id', comment.reply_to).maybeSingle()); if (parent?.persona_id && by.get(parent.persona_id) && !must_.some(p => p.id === parent.persona_id)) must_.unshift(by.get(parent.persona_id)); }
  const thread = must(await sb.from('cm_comments').select('id,author,persona_id,body,reply_to').eq('post_id', comment.post_id).eq('hidden', false).order('id', { ascending: false }).limit(10)).reverse();
  const others = ps.filter(p => !must_.some(m => m.id === p.id)).sort(() => Math.random() - .5).slice(0, 3), want = must_.length ? must_.slice(0, 2) : [others[0]], extra = others.slice(1, must_.length ? 2 : 3);
  const o = await llm(`Kamu memerankan warga NPC di media sosial negara ${brief(c)}. Unggahan: ${post.persona_id ? '@' + (by.get(post.persona_id)?.handle || post.author) : post.author}: "${clip(post.body, 220)}"\nUtas komentar:\n${thread.map(x => `[${x.id}] ${x.persona_id ? '@' + (by.get(x.persona_id)?.handle || x.author) : x.author + ' (PEMAIN)'}: "${clip(x.body, 160)}"`).join('\n')}\n\nPEMAIN ${comment.author} baru berkomentar: "${clip(comment.body, 250)}"\nAkun yang WAJIB membalas: ${want.map(p => `#${p.id} @${p.handle} ${p.name} (${p.job}; sikap ${p.stance}; gaya ${p.traits?.style || '-'})`).join('; ')}.${extra.length ? `\nAkun lain yang boleh ikut menimpali: ${extra.map(p => `#${p.id} @${p.handle} ${p.name} (${p.job}; sikap ${p.stance})`).join('; ')}.` : ''}\n${STYLE}\nBalasan harus nyambung ke isi komentar pemain, sesuai sikap tiap akun (boleh setuju, menyanggah, bercanda). Boleh menyebut @${slug(comment.author)}. Keluarkan JSON: {"r":[{"p":ID,"body":"..."}]}`);
  const out = []; for (const r of (o?.r || []).slice(0, 3)) { const p = by.get(Number(r?.p)), body = clip(r?.body, 240); if (!p || !body) continue; const ins = await sb.from('cm_comments').insert({ post_id: comment.post_id, country: code, uid: null, author: p.name, role: 'npc', body, persona_id: p.id, handle: p.handle, reply_to: comment.id }).select().single(); if (!ins.error) out.push(ins.data); }
  if (!out.length && want[0]) { const p = want[0], fb = ['Setuju sih, apalagi kondisi sekarang.', 'Hmm menarik, tapi kenyataannya di lapangan beda lho.', 'Wkwk bener juga. Gimana menurut yang lain?'][Math.floor(Math.random() * 3)]; const ins = await sb.from('cm_comments').insert({ post_id: comment.post_id, country: code, uid: null, author: p.name, role: 'npc', body: fb, persona_id: p.id, handle: p.handle, reply_to: comment.id }).select().single(); if (!ins.error) out.push(ins.data); }
  return out;
}

const A = {};
A.soc_open = async ({ body }) => { const code = cc(body.country); await ensurePersonas(code); const ps = await personasOf(code); const posts = must(await sb.from('cm_posts').select('body').eq('country', code).order('id', { ascending: false }).limit(60)), cms = must(await sb.from('cm_comments').select('body').eq('country', code).order('id', { ascending: false }).limit(100));
  return { personas: ps.map(p => ({ id: p.id, handle: p.handle, name: p.name, job: p.job, bio: p.bio, stance: p.stance, followers: p.followers })), trending: hashtags([...posts.map(x => x.body), ...cms.map(x => x.body)]) }; };
A.soc_tick = async ({ body }) => await tick(cc(body.country));
A.soc_comment = async ({ u, p, body }) => {
  const text = txt(body.body, 300, 'Komentar'), post = must(await sb.from('cm_posts').select('id,country,hidden,author,body,persona_id,uid').eq('id', Number(body.post_id)).maybeSingle()); if (!post || post.hidden) bad('Postingan tidak ditemukan', 404);
  const pr = await presRow(u, body.session); let role; if (pr && pr.code === post.country) role = 'presiden'; else if (p.citizenship === post.country) role = 'warga'; else bad('Hanya presiden dan warga negara ini yang dapat berkomentar', 403);
  const last = must(await sb.from('cm_comments').select('ts').eq('uid', u.id).order('id', { ascending: false }).limit(1))[0]; if (last && Date.now() - new Date(last.ts).getTime() < 2000) bad('Terlalu cepat, tunggu sebentar');
  let reply_to = null; if (body.reply_to) { const t = must(await sb.from('cm_comments').select('id,post_id').eq('id', Number(body.reply_to)).maybeSingle()); if (t && t.post_id === post.id) reply_to = t.id; }
  const c = must(await sb.from('cm_comments').insert({ post_id: post.id, country: post.country, uid: u.id, author: p.name, role, body: text, handle: slug(p.name), reply_to }).select().single());
  let replies = []; try { replies = await replyToComment(post.country, c, post); } catch (e) { console.error('reply', e); }
  return { ok: true, comment: c, replies };
};
A.soc_post_react = async ({ u, body }) => {
  const po = must(await sb.from('cm_posts').select('id,country,body,uid,author,ts,hidden').eq('id', Number(body.post_id)).maybeSingle()); if (!po || po.hidden || po.uid !== u.id) return { skipped: true }; if (Date.now() - new Date(po.ts).getTime() > 120_000) return { skipped: 'terlambat' };
  const has = (await sb.from('cm_comments').select('id', { count: 'exact', head: true }).eq('post_id', po.id).not('persona_id', 'is', null)).count || 0; if (has >= 2) return { skipped: 'sudah dibalas' };
  await ensurePersonas(po.country); const c = must(await sb.from('cm_countries').select('data').eq('code', po.country).maybeSingle())?.data, ps = (await personasOf(po.country)).sort(() => Math.random() - .5).slice(0, 4); if (!c || !ps.length) return { skipped: true };
  const o = await llm(`Kamu memerankan warga NPC di media sosial negara ${brief(c)}. PEMAIN ${po.author} baru memposting: "${clip(po.body, 300)}"\nAkun yang menanggapi:\n${ps.map(p => `#${p.id} @${p.handle} ${p.name} (${p.job}; sikap ${p.stance}; gaya ${p.traits?.style || '-'})`).join('\n')}\n${STYLE}\nTulis 3 komentar dari 3 akun berbeda yang nyambung ke isi unggahan (boleh setuju, menyanggah, bercanda, bertanya). Keluarkan JSON: {"r":[{"p":ID,"body":"..."}],"likes":1-8}`);
  let n = 0; const by = new Map(ps.map(p => [p.id, p])); for (const r of (o?.r || []).slice(0, 3)) { const p = by.get(Number(r?.p)), t = clip(r?.body, 240); if (!p || !t) continue; await sb.from('cm_comments').insert({ post_id: po.id, country: po.country, uid: null, author: p.name, role: 'npc', body: t, persona_id: p.id, handle: p.handle }); n++; }
  const lk = clamp(Math.round(Number(o?.likes) || (n ? 3 : 0)), 0, 8); if (lk) await sb.from('cm_posts').update({ likes: (must(await sb.from('cm_posts').select('likes').eq('id', po.id).maybeSingle())?.likes || 0) + lk }).eq('id', po.id);
  return { ok: true, comments: n, likes: lk };
};
A.soc_profile = async ({ body }) => { const p = must(await sb.from('cm_personas').select('*').eq('id', Number(body.id)).maybeSingle()); if (!p) bad('Akun tidak ditemukan', 404); const posts = must(await sb.from('cm_posts').select('id,body,likes,ts').eq('persona_id', p.id).order('id', { ascending: false }).limit(8)); const cm = (await sb.from('cm_comments').select('id', { count: 'exact', head: true }).eq('persona_id', p.id)).count || 0; return { persona: { id: p.id, handle: p.handle, name: p.name, job: p.job, bio: p.bio, stance: p.stance, followers: p.followers, style: p.traits?.style || '', country: p.country }, posts, comments: cm }; };
A.soc_clike = async ({ u, body }) => { const id = Number(body.id), ex = must(await sb.from('cm_comment_likes').select('comment_id').eq('comment_id', id).eq('uid', u.id).maybeSingle()); if (ex) await sb.from('cm_comment_likes').delete().eq('comment_id', id).eq('uid', u.id); else { const i = await sb.from('cm_comment_likes').insert({ comment_id: id, uid: u.id }); if (i.error) bad('Komentar tidak ditemukan', 404); } const n = (await sb.from('cm_comment_likes').select('uid', { count: 'exact', head: true }).eq('comment_id', id)).count || 0; await sb.from('cm_comments').update({ likes: n }).eq('id', id); return { ok: true, likes: n, liked: !ex }; };
A.soc_inbox = async ({ u, p, body }) => {
  const after = Number(body.after) || 0, mineC = must(await sb.from('cm_comments').select('id').eq('uid', u.id).order('id', { ascending: false }).limit(80)).map(x => x.id), mineP = must(await sb.from('cm_posts').select('id').eq('uid', u.id).order('id', { ascending: false }).limit(30)).map(x => x.id);
  const latest = must(await sb.from('cm_comments').select('id').order('id', { ascending: false }).limit(1))[0]?.id || 0; if (!after) return { items: [], latest };
  const q = []; if (mineC.length) q.push(`reply_to.in.(${mineC.join(',')})`); if (mineP.length) q.push(`post_id.in.(${mineP.join(',')})`); q.push(`body.ilike.%@${slug(p.name)}%`);
  const rows = must(await sb.from('cm_comments').select('id,post_id,author,persona_id,body,reply_to,uid').gt('id', after).neq('uid', u.id).or(q.join(',')).order('id').limit(20).then(r => r.error ? { data: [] } : r)) || [];
  return { items: rows.filter(r => r.uid !== u.id).map(r => ({ id: r.id, post_id: r.post_id, author: r.author, npc: !!r.persona_id, body: clip(r.body, 140), reply: !!(r.reply_to && mineC.includes(r.reply_to)) })), latest };
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const u = await authUser(req), p = await profile(u), out = await A[action]({ u, p, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
