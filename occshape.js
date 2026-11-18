// country.7mit — Bentuk wilayah yang diduduki: bagian batas negara korban yang menghadap penduduk, dipotong hingga luasnya = porsi yang diduduki.
import { loadOutline } from './country3d.js';
const cache = new Map();
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
function clipRing(r, d, t) { // potong poligon (bisa cekung) dengan setengah bidang p·d >= t; hasil dipisah menjadi lingkaran sederhana
  const n = r.length, ud = [-d[1], d[0]], val = (p) => p[0] * d[0] + p[1] * d[1] - t, eps = 1e-9, ins = r.map(p => val(p) >= 0);
  if (ins.every(Boolean)) return [r]; if (!ins.some(Boolean)) return [];
  let st = ins.findIndex((v, i) => v && !ins[(i - 1 + n) % n]); if (st < 0) return [];
  const chains = []; let i = st, cnt = 0;
  while (cnt < n + 1) { const pts = []; const prev = r[(i - 1 + n) % n], cur = r[i], dp = val(prev), dc = val(cur), k = dp / (dp - dc || eps); pts.push([prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k]);
    let j = i; while (ins[j % n]) { pts.push(r[j % n]); j++; cnt++; if (cnt > n + 2) break; } const a = r[(j - 1) % n], b = r[j % n], da = val(a), db = val(b), k2 = da / (da - db || eps); pts.push([a[0] + (b[0] - a[0]) * k2, a[1] + (b[1] - a[1]) * k2]); chains.push(pts);
    let nx = j % n, guard = 0; while (!ins[nx] && guard++ < n) { nx = (nx + 1) % n; cnt++; } if (!ins[nx] || nx === st || cnt >= n) break; i = nx; }
  // hubungkan ujung rantai: titik-titik pada garis potong diurutkan, dipasangkan (genap-ganjil)
  const ends = []; chains.forEach((c, ci) => { ends.push({ ci, end: 0, u: c[0][0] * ud[0] + c[0][1] * ud[1] }); ends.push({ ci, end: 1, u: c[c.length - 1][0] * ud[0] + c[c.length - 1][1] * ud[1] }); }); ends.sort((a, b) => a.u - b.u);
  const partner = new Map(); for (let k = 0; k + 1 < ends.length; k += 2) { partner.set(ends[k].ci + ':' + ends[k].end, ends[k + 1]); partner.set(ends[k + 1].ci + ':' + ends[k + 1].end, ends[k]); }
  const used = new Set(), loops = []; for (let ci = 0; ci < chains.length; ci++) { if (used.has(ci)) continue; const loop = []; let c = ci, guard = 0; while (!used.has(c) && guard++ < chains.length + 2) { used.add(c); loop.push(...chains[c]); const pe = partner.get(c + ':1'); if (!pe) break; c = pe.ci; if (pe.end !== 0) { /* orientasi tak cocok: berhenti */ break; } } if (loop.length >= 3) loops.push(loop); }
  return loops.length ? loops : [chains.flat()]; }
export async function occRings(victim, vLL, hLL, share) {
  const key = [victim, hLL.map(v => v.toFixed(1)), share.toFixed(2)].join('|'); if (cache.has(key)) return cache.get(key);
  const o = await loadOutline(victim); let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9; o.rings.forEach(r => r.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }));
  const cl = Math.max(.2, Math.cos(((minY + maxY) / 2) * Math.PI / 180)), pl = o.rings.map(r => r.map(p => [p[0] * cl, p[1]])), cx = (minX + maxX) / 2 * cl, cy = (minY + maxY) / 2;
  let dlon = ((hLL[1] - vLL[1] + 540) % 360) - 180; let dx = dlon * cl, dy = hLL[0] - vLL[0]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; const d = [dx, dy];
  const total = pl.reduce((s, r) => s + area(r), 0) || 1; let pmin = 1e9, pmax = -1e9; for (const r of pl) for (const p of r) { const v = p[0] * dx + p[1] * dy; pmin = Math.min(pmin, v); pmax = Math.max(pmax, v); }
  let lo = pmin, hi = pmax; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2, f = pl.reduce((s, r) => s + clipRing(r, d, mid).reduce((q, l) => q + area(l), 0), 0) / total; if (f > share) lo = mid; else hi = mid; }
  const t = (lo + hi) / 2, rings = pl.flatMap(r => clipRing(r, d, t)).filter(r => r.length >= 3 && area(r) > 1e-4).map(r => r.map(p => [p[0] / cl, p[1]]));
  cache.set(key, rings); return rings; }
