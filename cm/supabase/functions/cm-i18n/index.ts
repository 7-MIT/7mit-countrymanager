// @ts-nocheck
// country.7mit — Terjemahan antarmuka (Indonesia → English / Jawa / Sunda) oleh Gemini, di-cache bersama di tabel cm_i18n.
// Preferensi bahasa disimpan di akun (cm_profiles.lang).
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
class ApiError extends Error { constructor(m, code = 400) { super(m); this.code = code; } }
const bad = (m, c = 400) => { throw new ApiError(m, c); };
const must = (r) => { if (r.error) throw new ApiError('Kesalahan basis data: ' + r.error.message, 500); return r.data; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LANGS = { en: 'English', jv: 'Javanese (Basa Jawa, ngoko alus: natural, sopan, mudah dipahami; aksara Latin)', su: 'Sundanese (Basa Sunda, loma yang sopan; aksara Latin)' };
async function authUser(req) { const tok = (req.headers.get('Authorization') || '').replace('Bearer ', ''); if (!tok) bad('Silakan masuk terlebih dahulu', 401); const { data, error } = await sb.auth.getUser(tok); if (error || !data.user) bad('Sesi tidak valid, masuk ulang', 401); return data.user; }
let KEY = null; const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
async function llm(prompt, maxMs = 45000) {
  if (KEY === null) KEY = (await sb.from('cm_secrets').select('v').eq('k', 'gemini_key').maybeSingle()).data?.v || ''; if (!KEY) return null; const t0 = Date.now();
  for (const m of MODELS) for (let a = 0; a < 2; a++) { if (Date.now() - t0 > maxMs) return null;
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.max(4000, maxMs - (Date.now() - t0))), headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8000 } }) });
      if (r.status === 503 || r.status === 429) { await sleep(700); continue; } if (!r.ok) break; const j = await r.json(), t = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || ''; return JSON.parse(t.replace(/^```json|```$/g, '').trim()); } catch (e) { /* model berikutnya */ } }
  return null; }
const phs = (s) => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
async function translate(lang, items) { // items: [{h,s}] -> {h: out}
  const o = await llm(`You translate the user interface of "country.7mit", an Indonesian-language multiplayer political/country-management simulation game, into ${LANGS[lang]}.\nRules:\n- Translate each value from Indonesian to the target language, natural and concise (UI text, buttons, news, game narration).\n- Keep placeholders like {0}, {1} EXACTLY as is (same count, same form). Keep emoji, symbols, units, proper names (country names are translated normally to their common name in the target language, but player/person names, "country.7mit", "Goggle Docs", "Gemini", "UN" stay).\n- Do not add explanations. Keep line breaks. Keep short strings short.\nInput is a JSON object {"id": "indonesian text"}. Output ONLY a JSON object with the same ids and the translated texts.\n${JSON.stringify(Object.fromEntries(items.map(x => [x.h, x.s])))}`);
  const out = {}; if (o) for (const x of items) { const v = o[x.h]; if (typeof v === 'string' && v.trim() && phs(v) === phs(x.s) && v.length < x.s.length * 4 + 40) out[x.h] = v; } return out;
}
const A = {};
A.tr = async ({ body }) => {
  const lang = String(body.lang || ''); if (!LANGS[lang]) bad('Bahasa tidak didukung'); const items = (Array.isArray(body.items) ? body.items : []).slice(0, 80).map(x => ({ h: String(x.h || '').slice(0, 40), s: String(x.s || '').slice(0, 700) })).filter(x => x.h && x.s);
  if (!items.length) return { map: {} }; const hs = items.map(x => x.h), rows = must(await sb.from('cm_i18n').select('h,src,out').eq('lang', lang).in('h', hs)), map = {}, have = new Map(rows.map(r => [r.h, r]));
  const need = []; for (const it of items) { const r = have.get(it.h); if (r && r.src === it.s) map[it.h] = r.out; else need.push(it); }
  for (let i = 0; i < need.length; i += 40) { const part = need.slice(i, i + 40), out = await translate(lang, part); const ins = []; for (const it of part) if (out[it.h]) { map[it.h] = out[it.h]; ins.push({ lang, h: it.h, src: it.s, out: out[it.h] }); } if (ins.length) await sb.from('cm_i18n').upsert(ins, { onConflict: 'lang,h' }); }
  return { map };
};
A.lang_get = async ({ user }) => { const p = must(await sb.from('cm_profiles').select('lang').eq('uid', user.id).maybeSingle()); return { lang: p?.lang || null }; };
A.lang_set = async ({ user, body }) => { const lang = String(body.lang || ''); if (!['id', 'en', 'jv', 'su'].includes(lang)) bad('Bahasa tidak didukung'); const md = user.user_metadata || {}; const ex = must(await sb.from('cm_profiles').select('uid').eq('uid', user.id).maybeSingle()); if (ex) must(await sb.from('cm_profiles').update({ lang }).eq('uid', user.id)); else must(await sb.from('cm_profiles').insert({ uid: user.id, name: String(md.full_name || md.name || 'Warga').slice(0, 40), lang })); return { ok: true, lang }; };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const body = await req.json().catch(() => ({})), action = String(body.action || ''); if (!A[action]) bad('Aksi tidak dikenal', 404); const user = await authUser(req), out = await A[action]({ user, body });
    return new Response(JSON.stringify({ ok: true, data: out }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { const code = e instanceof ApiError ? e.code : 500; if (!(e instanceof ApiError)) console.error(e); return new Response(JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : 'Kesalahan server: ' + (e?.message || e) }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
});
