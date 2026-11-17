// country.7mit — bahasa (IDN / ENG / JVA / SDN): menerjemahkan seluruh antarmuka secara langsung dengan cache bersama.
// Teks sumber = Indonesia. Angka dijadikan placeholder {n}; terjemahan oleh Gemini lewat cm-i18n lalu disimpan di cache lokal + server.
export const LANGS = [['id', 'Indonesia', 'IDN', '🇮🇩'], ['en', 'English', 'ENG', '🇬🇧'], ['jv', 'Basa Jawa', 'JVA', '🇮🇩'], ['su', 'Basa Sunda', 'SDN', '🇮🇩']];
const LOCALE = { id: 'id-ID', en: 'en-US', jv: 'id-ID', su: 'id-ID' };
export const state = { lang: 'id', loc: 'id-ID' };
let call = null, obs = null, timer = null, ready = false;
const caches = {}, pending = new Map(), failed = new Map(), onChange = new Set();
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };
const hash = (s) => { let a = 2166136261, b = 5381; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) ^ c) >>> 0; } return (a >>> 0).toString(36) + b.toString(36) + s.length.toString(36); };
const cacheOf = (l) => caches[l] || (caches[l] = (() => { try { return new Map(Object.entries(JSON.parse(LS('cm_i18n_' + l) || '{}'))); } catch (e) { return new Map(); } })());
const saveCache = (l) => { const m = cacheOf(l); try { let e = [...m.entries()]; if (e.length > 6000) e = e.slice(-6000); LS('cm_i18n_' + l, JSON.stringify(Object.fromEntries(e))); } catch (e) {} };

// normalisasi: angka -> {0},{1}… agar string dengan angka berbeda memakai satu terjemahan
const NUM = /\d[\d.,]*\d|\d/g;
function norm(raw) { const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], core = raw.trim(); if (core.length < 2 || core.length > 700) return null; if (!/[A-Za-zÀ-ÿ]{3,}/.test(core)) return null; if (/^[A-Z0-9\s:+().,%/\-–—•·$€£¥]+$/.test(core)) return null; if (/^[\w.+-]+@[\w.-]+$/.test(core) || /^https?:\/\//.test(core)) return null;
  const nums = []; const key = core.replace(NUM, (m) => { nums.push(m); return `{${nums.length - 1}}`; }); return { key, nums, lead, trail }; }
const denorm = (out, nums) => out.replace(/\{(\d+)\}/g, (m, i) => nums[+i] ?? m);

const SKIP_TAG = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);
function skip(el) { for (let e = el; e && e !== document.body; e = e.parentElement) { if (SKIP_TAG.has(e.tagName)) return true; if (e.dataset?.notr !== undefined || e.classList?.contains('wordmark') || e.isContentEditable || e.classList?.contains('gd-doc-body') || e.classList?.contains('leaflet-container')) return true; } return false; }

function applyNode(node) {
  const raw = node.nodeValue; if (!raw || !raw.trim()) return; const p = node.parentElement; if (!p || skip(p)) return; const st = node.__i; if (st && st.out === raw && st.lang === state.lang) return; if (st && st.lang !== state.lang && st.out === raw) node.nodeValue = raw; // bahasa berganti: terjemahkan ulang dari sumber
  const src = st && st.out === node.nodeValue ? st.src : node.nodeValue; const n = norm(src); if (!n) return; const out = cacheOf(state.lang).get(n.key);
  if (out !== undefined) { const t = n.lead + denorm(out, n.nums) + n.trail; if (t !== node.nodeValue) { node.__i = { src, out: t, lang: state.lang }; node.nodeValue = t; } else node.__i = { src, out: t, lang: state.lang }; }
  else queue(n.key, () => applyNode(node));
}
const ATTRS = ['placeholder', 'title', 'aria-label'];
function applyEl(el) {
  if (el.nodeType !== 1 || skip(el)) return; for (const a of ATTRS) { if (!el.hasAttribute(a)) continue; const store = el.__ia || (el.__ia = {}), cur = el.getAttribute(a), st = store[a]; const src = st && st.out === cur ? st.src : cur; const n = norm(src); if (!n) continue; const out = cacheOf(state.lang).get(n.key);
    if (out !== undefined) { const t = n.lead + denorm(out, n.nums) + n.trail; store[a] = { src, out: t }; if (t !== cur) el.setAttribute(a, t); } else queue(n.key, () => applyEl(el)); }
}
function walk(root) { if (!root) return; if (root.nodeType === 3) { applyNode(root); return; } if (root.nodeType !== 1 || skip(root)) return; applyEl(root); const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null); let n = tw.nextNode(); while (n) { if (n.nodeType === 3) applyNode(n); else applyEl(n); n = tw.nextNode(); } }

function queue(key, cb) { if (state.lang === 'id' || failed.get(state.lang + key) > 2) return; let e = pending.get(key); if (!e) pending.set(key, e = []); if (e.length < 40) e.push(cb); if (!timer) timer = setTimeout(flush, 180); }
let flushing = false;
async function flush() {
  timer = null; if (flushing || !call || !pending.size || state.lang === 'id') { if (pending.size && !timer) timer = setTimeout(flush, 400); return; } flushing = true; const lang = state.lang, keys = [...pending.keys()].slice(0, 60), batch = keys.map(k => ({ h: hash(k), s: k })), cbs = keys.map(k => pending.get(k)); keys.forEach(k => pending.delete(k));
  try { const r = await call('tr', { lang, items: batch }); const map = r?.map || {}, c = cacheOf(lang); let got = 0; keys.forEach((k, i) => { const out = map[batch[i].h]; if (out) { c.set(k, out); got++; cbs[i].forEach(f => { try { if (lang === state.lang) f(); } catch (e) {} }); } else failed.set(lang + k, (failed.get(lang + k) || 0) + 1); }); if (got) saveCache(lang); }
  catch (e) { keys.forEach(k => failed.set(lang + k, (failed.get(lang + k) || 0) + 1)); }
  flushing = false; if (pending.size) timer = setTimeout(flush, 120);
}
function restore(root = document.body) { const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n = tw.nextNode(); while (n) { if (n.nodeType === 3 && n.__i && n.nodeValue === n.__i.out) { n.nodeValue = n.__i.src; n.__i = null; } else if (n.nodeType === 1 && n.__ia) { for (const [a, st] of Object.entries(n.__ia)) if (n.getAttribute(a) === st.out) n.setAttribute(a, st.src); n.__ia = null; } n = tw.nextNode(); } }
const titleSrc = { v: null, out: null };
function fixTitle() { const t = document.title; if (!t) return; if (titleSrc.out === t) return; if (state.lang === 'id') { if (titleSrc.out && t === titleSrc.out) document.title = titleSrc.v; titleSrc.v = t; titleSrc.out = null; return; } const n = norm(t); if (!n) return; const out = cacheOf(state.lang).get(n.key); if (out !== undefined) { titleSrc.v = t; titleSrc.out = n.lead + denorm(out, n.nums) + n.trail; document.title = titleSrc.out; } else queue(n.key, fixTitle); }

export function onLangChange(fn) { onChange.add(fn); }
export function setLang(lang, { save = true } = {}) {
  if (!LANGS.some(l => l[0] === lang)) lang = 'id'; const prev = state.lang; state.lang = lang; state.loc = LOCALE[lang]; LS('cm_lang', lang); document.documentElement.lang = lang === 'jv' ? 'jv' : lang === 'su' ? 'su' : lang;
  if (ready) { if (prev !== 'id') restore(); pending.clear(); if (lang !== 'id') walk(document.body); fixTitle(); } onChange.forEach(f => { try { f(lang); } catch (e) {} });
  if (save && call) call('lang_set', { lang }).catch(() => {});
}
export function initI18n(apiCall) {
  call = apiCall; state.lang = LS('cm_lang') || 'id'; if (!LANGS.some(l => l[0] === state.lang)) state.lang = 'id'; state.loc = LOCALE[state.lang]; if (ready) return; ready = true;
  obs = new MutationObserver((muts) => { if (state.lang === 'id') { fixTitle(); return; } const seen = new Set(); for (const m of muts) { if (m.type === 'childList') m.addedNodes.forEach(n => seen.add(n)); else if (m.type === 'characterData') { if (!(m.target.__i && m.target.nodeValue === m.target.__i.out)) seen.add(m.target); } else if (m.type === 'attributes') seen.add(m.target); } seen.forEach(n => walk(n)); fixTitle(); });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (state.lang !== 'id') walk(document.body); setInterval(fixTitle, 1500);
}
// bahasa tersimpan di akun: dipanggil setelah login
export async function syncLangFromAccount() { if (!call) return; try { const r = await call('lang_get', {}); if (r?.lang && r.lang !== state.lang) setLang(r.lang, { save: false }); else if (!r?.lang && state.lang !== 'id') call('lang_set', { lang: state.lang }).catch(() => {}); } catch (e) {} }
