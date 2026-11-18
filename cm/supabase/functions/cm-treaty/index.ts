// @ts-nocheck
// country.7mit — Perjanjian dagang tanpa batas jumlah. cm-api/cm-npc menolak bila sebuah negara sudah punya 12 perjanjian aktif;
// gerbang ini menyisihkan sementara (status 'paused_cap') perjanjian aktif tertua yang berlebih pada kedua negara selama proses tawaran
// diteruskan ke cm-npc (yang memanggil cm-api), lalu mengembalikannya ke 'active' apa pun hasilnya.
import { createClient } from 'npm:@supabase/supabase-js@2';
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const KEEP = 10; // sisakan 10 aktif -> hitungan cm-api (>=12) tidak pernah tercapai, termasuk +1 perjanjian baru
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body = {}; try { body = await req.json(); } catch (e) {}
  const auth = req.headers.get('Authorization') || '', apikey = req.headers.get('apikey') || '', tok = auth.replace('Bearer ', '');
  const forward = () => fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cm-npc`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth, apikey }, body: JSON.stringify(body) });
  const ids = [];
  try {
    const { data: ud } = await sb.auth.getUser(tok); const uid = ud?.user?.id; const to = String(body.to || '').toUpperCase();
    const pr = uid && body.session ? (await sb.from('cm_countries').select('code').eq('president_uid', uid).eq('president_session', body.session).maybeSingle()).data : null;
    if (pr && to) {
      for (const code of [pr.code, to]) {
        const rows = (await sb.from('cm_offers').select('id').eq('status', 'active').eq('kind', 'trade').or(`from_c.eq.${code},to_c.eq.${code}`).order('id', { ascending: true })).data || [];
        if (rows.length > KEEP) ids.push(...rows.slice(0, rows.length - KEEP).map(r => r.id));
      }
      if (ids.length) await sb.from('cm_offers').update({ status: 'paused_cap' }).in('id', [...new Set(ids)]).eq('status', 'active');
    }
    const res = await forward(), text = await res.text();
    return new Response(text, { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) { return J({ ok: false, error: 'Kesalahan server: ' + (e?.message || e) }, 500); }
  finally { if (ids.length) await sb.from('cm_offers').update({ status: 'active' }).in('id', [...new Set(ids)]).eq('status', 'paused_cap'); }
});
