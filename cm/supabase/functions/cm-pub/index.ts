// @ts-nocheck
// country.7mit — Sosial (Publik): media sosial untuk seluruh pemain di server (lintas negara).
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

const isAdmin = async (u) => !!must(await sb.from('cm_admins').select('email').eq('email', u.email).maybeSingle());
const where = (p) => p.president || p.citizenship || null;
const roleOf = (p) => p.president ? 'presiden' : p.citizenship ? 'warga' : 'pengamat';
const hashtags = (texts) => { const m = new Map(); for (const t of texts) for (const h of String(t).match(/#[\p{L}\p{N}_]{3,30}/gu) || []) m.set(h.toLowerCase(), (m.get(h.toLowerCase()) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, n]) => ({ tag, n })); };
const A = {};
A.pub_feed = async ({ u, body }) => {
  const before = Number(body.before) || 0, tag = String(body.tag || '').toLowerCase().replace(/[^#\p{L}\p{N}_]/gu, '').slice(0, 31), mine = !!body.mine;
  let q = sb.from('cm_pub_posts').select('*').eq('hidden', false).order('id', { ascending: false }).limit(30); if (before) q = q.lt('id', before); if (tag) q = q.ilike('body', `%${tag}%`); if (mine) q = q.eq('uid', u.id);
  const posts = must(await q), ids = posts.map(p => p.id), liked = new Set(ids.length ? must(await sb.from('cm_pub_likes').select('post_id').eq('uid', u.id).in('post_id', ids)).map(x => x.post_id) : []);
  let trending = []; if (!before && !tag && !mine) { const recent = must(await sb.from('cm_pub_posts').select('body').eq('hidden', false).order('id', { ascending: false }).limit(150)); trending = hashtags(recent.map(r => r.body)); }
  return { posts: posts.map(p => ({ ...p, uid: undefined, mine: p.uid === u.id, liked: liked.has(p.id) })), trending, more: posts.length === 30 };
};
A.pub_post = async ({ u, p, body }) => {
  const text = txt(body.body, 500, 'Unggahan'); const last = must(await sb.from('cm_pub_posts').select('ts').eq('uid', u.id).order('id', { ascending: false }).limit(1))[0]; if (last && Date.now() - new Date(last.ts).getTime() < 4000) bad('Terlalu cepat, tunggu beberapa detik');
  const r = must(await sb.from('cm_pub_posts').insert({ uid: u.id, author: p.name, country: where(p), role: roleOf(p), body: text }).select().single());
  return { ok: true, post: { ...r, uid: undefined, mine: true, liked: false } };
};
A.pub_like = async ({ u, body }) => {
  const id = Number(body.id), po = must(await sb.from('cm_pub_posts').select('id,hidden').eq('id', id).maybeSingle()); if (!po || po.hidden) bad('Unggahan tidak ditemukan', 404);
  const ex = must(await sb.from('cm_pub_likes').select('post_id').eq('post_id', id).eq('uid', u.id).maybeSingle()); if (ex) await sb.from('cm_pub_likes').delete().eq('post_id', id).eq('uid', u.id); else await sb.from('cm_pub_likes').insert({ post_id: id, uid: u.id });
  const n = (await sb.from('cm_pub_likes').select('uid', { count: 'exact', head: true }).eq('post_id', id)).count || 0; await sb.from('cm_pub_posts').update({ likes: n }).eq('id', id); return { ok: true, likes: n, liked: !ex };
};
A.pub_comments = async ({ u, body }) => { const id = Number(body.id); const cs = must(await sb.from('cm_pub_comments').select('*').eq('post_id', id).eq('hidden', false).order('id').limit(200)); return { comments: cs.map(c => ({ ...c, uid: undefined, mine: c.uid === u.id })) }; };
A.pub_comment = async ({ u, p, body }) => {
  const id = Number(body.id), text = txt(body.body, 300, 'Komentar'), po = must(await sb.from('cm_pub_posts').select('id,hidden,comments').eq('id', id).maybeSingle()); if (!po || po.hidden) bad('Unggahan tidak ditemukan', 404);
  const last = must(await sb.from('cm_pub_comments').select('ts').eq('uid', u.id).order('id', { ascending: false }).limit(1))[0]; if (last && Date.now() - new Date(last.ts).getTime() < 2000) bad('Terlalu cepat, tunggu sebentar');
  const c = must(await sb.from('cm_pub_comments').insert({ post_id: id, uid: u.id, author: p.name, country: where(p), role: roleOf(p), body: text }).select().single());
  const n = (await sb.from('cm_pub_comments').select('id', { count: 'exact', head: true }).eq('post_id', id).eq('hidden', false)).count || 0; await sb.from('cm_pub_posts').update({ comments: n }).eq('id', id);
  return { ok: true, comment: { ...c, uid: undefined, mine: true }, count: n };
};
A.pub_delete = async ({ u, body }) => {
  const adm = await isAdmin(u), id = Number(body.id);
  if (body.kind === 'comment') { const c = must(await sb.from('cm_pub_comments').select('id,uid,post_id').eq('id', id).maybeSingle()); if (!c) bad('Tidak ditemukan', 404); if (c.uid !== u.id && !adm) bad('Bukan komentar Anda', 403); await sb.from('cm_pub_comments').update({ hidden: true }).eq('id', id); const n = (await sb.from('cm_pub_comments').select('id', { count: 'exact', head: true }).eq('post_id', c.post_id).eq('hidden', false)).count || 0; await sb.from('cm_pub_posts').update({ comments: n }).eq('id', c.post_id); return { ok: true }; }
  const po = must(await sb.from('cm_pub_posts').select('id,uid').eq('id', id).maybeSingle()); if (!po) bad('Tidak ditemukan', 404); if (po.uid !== u.id && !adm) bad('Bukan unggahan Anda', 403); await sb.from('cm_pub_posts').update({ hidden: true }).eq('id', id); return { ok: true };
};
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const u = await authUser(req), p = await profile(u), out = await A[action]({ u, p, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
