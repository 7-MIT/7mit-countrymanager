// @ts-nocheck
// Country Manager — mesin simulasi murni (tanpa I/O). Semua angka = data permainan.
import { SEED, GROUPS } from './data.ts';

export const START_YEAR = 1980;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const r1 = (v) => Math.round(v * 10) / 10;
export const r2 = (v) => Math.round(v * 100) / 100;
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (R) => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export const SECTORS = { manufaktur: 'Manufaktur', energi: 'Energi', pertanian: 'Pertanian', teknologi: 'Teknologi', jasa: 'Jasa' };
export const IDEOLOGIES = { pancasila: 'Pancasila', demokrasi: 'Demokrasi', komunisme: 'Komunisme' };
export const MINISTRIES = { dalam: 'Menteri Dalam Negeri', luar: 'Menteri Luar Negeri', kesehatan: 'Menteri Kesehatan', pendidikan: 'Menteri Pendidikan' };
export const PARTIES = ['Partai Persatuan Nasional', 'Partai Rakyat Sejahtera', 'Partai Demokrat Merdeka', 'Partai Karya Bangsa', 'Partai Hijau Makmur'];
export const MOTIONS = { transparansi: 'Mosi Transparansi', hak_warga: 'Mosi Hak Warga', layanan_publik: 'Mosi Layanan Publik', keamanan: 'Mosi Keamanan' };
export const LAWS = {
  uu_kpk: { name: 'UU Lembaga Antikorupsi', cat: 'antikorupsi', cost: 0.2, fx: { corruption: -3, trust: 1.5 } },
  uu_transparansi: { name: 'UU Keterbukaan Informasi', cat: 'antikorupsi', cost: 0.1, fx: { corruption: -1.5, trust: 2 } },
  uu_whistle: { name: 'UU Perlindungan Pelapor', cat: 'antikorupsi', cost: 0.1, fx: { corruption: -2, approval: 0.5 } },
  uu_investasi: { name: 'UU Investasi & Cipta Kerja', cat: 'ekonomi', cost: 0.1, fx: { invest: 3, corruption: 0.8, growth: 0.25 } },
  uu_insentif: { name: 'UU Insentif Pajak Usaha', cat: 'ekonomi', cost: 0.3, fx: { invest: 2, growth: 0.3 } },
  uu_kek: { name: 'UU Zona Ekonomi Khusus', cat: 'ekonomi', cost: 0.2, fx: { invest: 2, growth: 0.2, prosperity: 0.5 } },
  uu_jamsos: { name: 'UU Jaminan Sosial', cat: 'kesejahteraan', cost: 0.5, fx: { prosperity: 1.5, approval: 1, stability: 0.5 } },
  uu_pensiun: { name: 'UU Dana Pensiun', cat: 'kesejahteraan', cost: 0.4, fx: { prosperity: 1, approval: 1 } },
  uu_pangan: { name: 'UU Ketahanan Pangan', cat: 'kesejahteraan', cost: 0.3, fx: { prosperity: 1, stability: 1 } },
};
export const ALLIANCES = {
  UN: { name: 'Perserikatan Bangsa-Bangsa', short: 'UN', rule: 'Wajib bagi semua negara', bonus: 'Stabilitas +1, investasi +0,5 / tahun' },
  ASEAN: { name: 'ASEAN', short: 'ASEAN', rule: 'Hanya negara Asia Tenggara', bonus: 'Pertumbuhan +0,4 pt, investasi +1' },
  EU: { name: 'Uni Eropa', short: 'EU', rule: 'Negara Eropa, korupsi < 60, bukan Komunisme', bonus: 'Pertumbuhan +0,5 pt, stabilitas +1,5' },
  NATO: { name: 'NATO', short: 'NATO', rule: 'Eropa/Amerika Utara, stabilitas ≥ 50, kesiapan ≥ 40', bonus: 'Kesiapan pertahanan +6, stabilitas +1' },
  AU: { name: 'Uni Afrika', short: 'AU', rule: 'Hanya negara Afrika', bonus: 'Pertumbuhan +0,3 pt, stabilitas +0,8' },
  G20: { name: 'G20', short: 'G20', rule: '25 PDB terbesar dunia', bonus: 'Investasi +1,5, pertumbuhan +0,2 pt' },
  BRICS: { name: 'BRICS', short: 'BRICS', rule: '40 PDB terbesar, bukan anggota NATO/EU', bonus: 'Pertumbuhan +0,5 pt, kurs lebih stabil' },
  OPEC: { name: 'OPEC', short: 'OPEC', rule: 'Hanya produsen minyak', bonus: 'Pendapatan energi +20%' },
};
export const NPC_NAMES = ['Adi Wirawan', 'Maria Santos', 'Chen Wei', 'Amara Okafor', 'Lars Eriksen', 'Fatima Al-Zahra', 'Kenji Mori', 'Elena Petrova', 'Carlos Mendes', 'Priya Nair', 'Omar Haddad', 'Sofia Rossi', 'Tariq Rahman', 'Ingrid Berg', 'Joao Silva', 'Aisha Bello', 'Min-jun Park', 'Hana Sato', 'Diego Torres', 'Leila Karimi'];

// ---------- inisialisasi ----------
export function worldRank(list, key) { const s = [...list].sort((a, b) => b[key] - a[key]); const m = new Map(); s.forEach((c, i) => m.set(c.code, i + 1)); return m; }
export function makeCountry(s) {
  const R = rng('seed-' + s.c);
  const gdp = r1(s.gdp * 0.32 * (0.9 + R() * 0.2) * 10) / 10 || 0.1, pop = Math.max(1000, Math.round(s.pop * 0.64 * (0.95 + R() * 0.1)));
  const pc = gdp * 1e9 / pop, rich = clamp(Math.log10(pc / 800) / 1.8, 0, 1);       // 0..1
  const names = [...NPC_NAMES].sort(() => R() - 0.5);
  const parties = PARTIES.map((p) => ({ name: p, w: 0.5 + R() })), tot = parties.reduce((a, b) => a + b.w, 0);
  let left = 100; parties.forEach((p, i) => { p.seats = i === 4 ? left : Math.round(p.w / tot * 100); left -= p.seats; delete p.w; });
  const cand = {}; for (const m in MINISTRIES) cand[m] = [0, 1, 2].map(() => ({ name: names.pop() || 'Calon ' + Math.floor(R() * 99), skill: Math.round(35 + R() * 55) }));
  const code = s.c;
  const inAlliance = (g) => (GROUPS[g] || []).includes(code);
  const mem = ['UN']; if (inAlliance('ASEAN')) mem.push('ASEAN'); if (inAlliance('EU')) mem.push('EU'); if (inAlliance('NATO')) mem.push('NATO'); if (inAlliance('AU')) mem.push('AU'); if (inAlliance('G20')) mem.push('G20'); if (inAlliance('BRICS')) mem.push('BRICS'); if (inAlliance('OPEC')) mem.push('OPEC');
  const infl0 = r1(5 + R() * 9 - rich * 3);
  return {
    code, name: s.n, region: s.r, sub: s.s, lat: s.la, lng: s.lo, flag: s.f, cur: s.cu, sym: s.sy, fx: s.fx, tz: s.tz, oil: s.oil, un: s.un, independent: s.ind,
    pop, popFrac: 0, gdp, growth: r1(2 + R() * 3 + (1 - rich) * 1.5), infl: infl0, unemp: r1(4 + R() * 8 - rich * 1.5),
    debt: r1(gdp * (0.2 + R() * 0.5) * 10) / 10, treasury: r1(gdp * (0.04 + R() * 0.05) * 10) / 10, reserves: r1(gdp * (0.05 + R() * 0.15) * 10) / 10,
    pol: { rate: r1(infl0 + 2), taxInc: Math.round(18 + rich * 14 + R() * 6), taxCorp: Math.round(18 + R() * 12), spend: Math.round(11 + rich * 6), infra: r1(2.5 + R()), edu: r1(3.5 + R()), welfare: r1(3 + rich * 3), defense: r1(1.5 + R() * 1.5), health: r1(2.5 + rich * 2), tariff: Math.round(5 + R() * 15), family: 50, migration: 50, fxIntervene: 0 },
    stock: { infra: Math.round(25 + rich * 55), edu: Math.round(30 + rich * 55), health: Math.round(30 + rich * 55) },
    gov: { ideology: ['pancasila', 'demokrasi', 'komunisme'][Math.floor(R() * 2.2)], coalition: [parties[0].name, parties[1].name], parties, cabinet: {}, cand, approval: Math.round(48 + R() * 20), corruption: Math.round(72 - rich * 50 + R() * 12), invest: Math.round(35 + rich * 30 + R() * 10), prosperity: Math.round(25 + rich * 55), trust: Math.round(35 + rich * 30 + R() * 12), stability: Math.round(45 + rich * 25 + R() * 15), readiness: Math.round(35 + R() * 30), laws: [], pendingTax: null, president: names.pop() || 'Presiden NPC', party: parties[0].name, lastInvestigate: 0 },
    mem, war: [], rel: {}, trade: { exp: 0, imp: 0 }, hist: [[START_YEAR, gdp, 0, infl0, pop]], lastPopDate: '', lastAdv: [], used: { investigate: 0, intervene: 0 },
  };
}
export function allSeed() { return SEED.map(makeCountry); }

// ---------- zona waktu & populasi harian ----------
export function localDate(c, now = new Date()) { const t = new Date(now.getTime() + c.tz * 3600e3); return t.toISOString().slice(0, 10); }
export function popDaily(c, days = 1) {
  // pertumbuhan alami: lahir − mati, dipengaruhi kesehatan, keluarga, kemakmuran (per tahun %)
  const natural = clamp(0.9 + (c.stock.health - 50) * 0.012 + (c.pol.family - 50) * 0.008 + (c.gov.prosperity - 50) * 0.004 - (c.war.length ? 0.5 : 0), -1, 3.5);
  const delta = c.pop * natural / 100 / 365 * days + c.popFrac;
  const whole = Math.trunc(delta); c.popFrac = delta - whole; c.pop = Math.max(1000, c.pop + whole);
}
// Migrasi: memindahkan penduduk antarnegara, total dunia tetap
export function migrate(list) {
  const pool = {}; let tot = 0;
  for (const c of list) { const out = Math.floor(c.pop * clamp(0.0015 + (60 - c.gov.prosperity) * 0.00004 + (c.gov.stability < 40 ? 0.002 : 0) + (c.war.length ? 0.004 : 0), 0.0003, 0.012) * (0.3 + c.pol.migration / 100 * 0.7 + 0.2)); pool[c.code] = out; c.pop -= out; tot += out; }
  const w = list.map(c => ({ c, w: Math.max(0.02, c.gov.prosperity / 100 * (c.pol.migration / 100 + 0.05) * Math.sqrt(c.pop / 1e6 + 1) * (c.war.length ? 0.3 : 1)) })), ws = w.reduce((a, b) => a + b.w, 0);
  let given = 0; for (const x of w) { const add = Math.floor(tot * x.w / ws); x.c.pop += add; given += add; }
  w.sort((a, b) => b.w - a.w); w[0].c.pop += tot - given; // sisa pembulatan: total dunia tetap
  return tot;
}

// ---------- parlemen ----------
export function coalitionSeats(c) { return c.gov.parties.filter(p => c.gov.coalition.includes(p.name)).reduce((a, p) => a + p.seats, 0); }
export function parliamentVote(c, motion, year, salt = 0, ctx = {}) {
  const R = rng(`${c.code}|${year}|${motion}|${salt}`);
  const g = c.gov, cs = coalitionSeats(c);
  let base = { transparansi: 0.4 + (g.trust < 45 ? 0.18 : 0) - (g.corruption > 65 ? 0.12 : 0), hak_warga: 0.42 + (g.approval < 50 ? 0.12 : 0) + (g.ideology === 'demokrasi' ? 0.12 : 0) - (g.ideology === 'komunisme' ? 0.1 : 0), layanan_publik: 0.45 - clamp(c.debt / c.gdp - 0.8, 0, 1) * 0.3 + (g.approval < 50 ? 0.08 : 0), keamanan: 0.42 + (c.war.length ? 0.25 : 0) + (g.stability < 45 ? 0.15 : 0), pajak: 0.5 - (ctx.taxRise || 0) * 0.04 - (g.approval < 45 ? 0.1 : 0) + (c.debt / c.gdp > 1 ? 0.15 : 0) + (ctx.taxCut > 0 ? 0.1 : 0), uu: 0.45 + (g.approval < 50 ? 0.05 : 0), }[motion] ?? 0.45;
  const coalBonus = 0.4 * (cs / 100 > 0.5 ? 1 : 0.7);
  let yes = 0, no = 0, abs = 0;
  for (let i = 0; i < 100; i++) {
    const inCoal = i < cs; const p = clamp(base + (inCoal ? coalBonus : -0.1) + gauss(R) * 0.08, 0.02, 0.97);
    const x = R(); if (x < 0.04) abs++; else if (x < 0.04 + p * 0.96) yes++; else no++;
  }
  return { yes, no, abstain: abs, passed: yes > 50, coalition: cs };
}
export function applyMotion(c, motion) {
  const g = c.gov;
  if (motion === 'transparansi') { g.trust = clamp(g.trust + 6, 0, 100); g.corruption = clamp(g.corruption - 4, 0, 100); }
  if (motion === 'hak_warga') { g.approval = clamp(g.approval + 4, 0, 100); g.stability = clamp(g.stability + 2, 0, 100); g.invest = clamp(g.invest - 1, 0, 100); }
  if (motion === 'layanan_publik') { c.stock.health = clamp(c.stock.health + 4, 0, 100); c.stock.infra = clamp(c.stock.infra + 3, 0, 100); c.treasury -= c.gdp * 0.003; if (c.treasury < 0) { c.debt -= c.treasury; c.treasury = 0; } g.approval = clamp(g.approval + 2, 0, 100); }
  if (motion === 'keamanan') { g.readiness = clamp(g.readiness + 8, 0, 100); g.stability = clamp(g.stability + 2, 0, 100); g.approval = clamp(g.approval - 2, 0, 100); }
}

// ---------- perdagangan ----------
export function tradeSummary(offers) {
  const m = {}; for (const o of offers) if (o.status === 'active') { (m[o.from_c] ||= { exp: 0, imp: 0 }).exp += +o.value; (m[o.to_c] ||= { exp: 0, imp: 0 }).imp += +o.value; } return m;
}
export function npcRespondTrade(offer, from, to, R) {
  const rel = (to.rel[from.code] || 0);
  const tariffPain = offer.tariff_to > to.pol.tariff + 15 ? 0.25 : 0, size = +offer.value / Math.max(1, to.gdp);
  let p = 0.55 + rel / 200 - tariffPain - (to.war.includes(from.code) ? 1 : 0) - clamp(size * 8, 0, 0.35) + (offer.sector === 'energi' && !to.oil ? 0.2 : 0) + (offer.sector === 'pertanian' && to.gdp / to.pop < 1e-5 ? 0.1 : 0);
  if (from.mem.some(a => a !== 'UN' && to.mem.includes(a))) p += 0.12;
  return R() < clamp(p, 0.03, 0.95);
}

// ---------- langkah tahunan ----------
export function stepYear(c, ctx, R) {
  const p = c.pol, g = c.gov, ev = [], w = ctx.worldInfl ?? 4;
  const pcap = c.gdp * 1e9 / c.pop;
  const spendSum = p.spend + p.infra + p.edu + p.welfare + p.defense + p.health;
  const tr = ctx.trade[c.code] || { exp: 0, imp: 0 };
  c.trade = { exp: r1(tr.exp), imp: r1(tr.imp) };
  // kekuatan menteri
  const sk = (m) => { const x = (g.cabinet[m] || {}).skill; return x == null ? 0 : (x - 50) * 0.04; };
  // pendapatan & belanja
  const oilRev = c.oil ? c.gdp * 0.04 * (c.mem.includes('OPEC') ? 1.2 : 1) * (ctx.oilPrice || 1) : 0;
  const revenue = c.gdp * (p.taxInc * 0.75 + p.taxCorp * 0.45) / 100 * (1 - g.corruption / 250) + tr.imp * p.tariff / 100 * 0.6 + oilRev * 0.5 + (ctx.aid?.[c.code] || 0);
  const lawCost = g.laws.reduce((a, l) => a + (LAWS[l]?.cost || 0), 0) / 100 * c.gdp;
  const interest = c.debt * (p.rate / 100 * 0.6 + 0.012);
  const warCost = c.war.length * c.gdp * 0.02;
  const intervCost = Math.abs(p.fxIntervene) * 0.001 * c.gdp * (p.fxIntervene > 0 ? 1 : 0);
  const expense = c.gdp * spendSum / 100 + lawCost + interest + warCost + intervCost;
  const balance = revenue - expense;
  c.treasury += balance;
  if (p.fxIntervene > 0) c.reserves = Math.max(0, c.reserves - intervCost);
  if (c.treasury < 0) { c.debt += -c.treasury; c.treasury = 0; }
  else if (c.treasury > c.gdp * 0.12 && c.debt > 0) { const pay = Math.min(c.debt, c.treasury - c.gdp * 0.08); c.treasury -= pay; c.debt -= pay; }
  const deficit = Math.max(0, -balance) / c.gdp;
  // stok
  c.stock.infra = clamp(c.stock.infra + (p.infra - 3) * 3 - 0.5 + sk('dalam') * 0.5, 0, 100);
  c.stock.edu = clamp(c.stock.edu + (p.edu - 4) * 3 - 0.3 + sk('pendidikan') * 2, 0, 100);
  c.stock.health = clamp(c.stock.health + (p.health - 3) * 3 - 0.4 + sk('kesehatan') * 2, 0, 100);
  // dampak undang-undang & ideologi & aliansi
  const L = { corruption: 0, trust: 0, approval: 0, invest: 0, growth: 0, prosperity: 0, stability: 0 };
  for (const l of g.laws) for (const k in LAWS[l]?.fx || {}) L[k] += LAWS[l].fx[k];
  const A = { growth: 0, stability: 0, invest: 0, readiness: 0 };
  for (const a of c.mem) { if (a === 'UN') { A.stability += 1; A.invest += 0.5; } if (a === 'ASEAN') { A.growth += 0.4; A.invest += 1; } if (a === 'EU') { A.growth += 0.5; A.stability += 1.5; } if (a === 'NATO') { A.readiness += 6; A.stability += 1; } if (a === 'AU') { A.growth += 0.3; A.stability += 0.8; } if (a === 'G20') { A.invest += 1.5; A.growth += 0.2; } if (a === 'BRICS') A.growth += 0.5; }
  const ide = { pancasila: { stability: 0.4, trust: 0.4 }, demokrasi: { trust: 0.8, invest: 0.6, stability: -0.3 }, komunisme: { prosperity: 0.6, stability: 0.8, invest: -0.8, trust: -0.5 } }[g.ideology];
  // pertumbuhan
  let gr = 2.6 + clamp((12000 - pcap) / 12000, -1, 1) * 1.6
    + (c.stock.infra - 50) * 0.03 + (c.stock.edu - 50) * 0.03 + (c.stock.health - 50) * 0.012
    - (p.taxInc - 26) * 0.05 - (p.taxCorp - 24) * 0.06 + (spendSum - 24) * 0.09 - (p.rate - c.infl - 2) * 0.25
    - clamp(c.debt / c.gdp - 0.9, 0, 3) * 1.4 + (g.invest - 50) * 0.03 + (g.stability - 50) * 0.02 - g.corruption * 0.012
    + clamp(tr.exp / c.gdp * 6, 0, 1.5) - p.tariff * 0.03 + (p.tariff > 25 ? -(p.tariff - 25) * 0.04 : 0) - c.war.length * 4
    + (p.fxIntervene < 0 ? -p.fxIntervene * 0.06 : 0) + A.growth + L.growth + sk('luar') * 0.5 + (ctx.worldGrowth ?? 3) * 0.12 + gauss(R) * 0.9;
  if (ctx.shock) gr += ctx.shock[c.code] || 0;
  gr = clamp(gr, -12, 14); c.growth = r1(c.growth * 0.35 + gr * 0.65);
  c.gdp = Math.max(0.05, r2(c.gdp * (1 + c.growth / 100) * (1 + (c.fxDep || 0) * 0)));
  // inflasi
  const inflT = 2.2 + (c.growth - 3) * 0.3 + deficit * 25 - (p.rate - c.infl) * 0.35 + (w - 4) * 0.2 + (c.fxDevPrev || 0) * 0.15 + c.war.length * 2 + (p.tariff - 10) * 0.04 + gauss(R) * 0.6;
  c.infl = r1(clamp(c.infl * 0.4 + inflT * 0.6, -3, 60));
  // pengangguran
  const unT = 10.5 - c.growth * 0.55 - (c.stock.infra - 50) * 0.02 + (p.taxCorp - 24) * 0.06 + Math.max(0, p.rate - c.infl - 2) * 0.12 + p.tariff * 0.01 + (g.invest < 40 ? 1.2 : 0) + c.war.length * 2 - p.welfare * 0.1 + gauss(R) * 0.3;
  c.unemp = r1(clamp(c.unemp * 0.5 + unT * 0.5, 1, 40));
  // kurs
  const fxDev = clamp((c.infl - 2.5) * 0.9 - (p.rate - c.infl - 2) * 0.7 + deficit * 30 - c.growth * 0.1 - (p.fxIntervene > 0 ? p.fxIntervene * 0.9 : p.fxIntervene * 0.6) + (c.mem.includes('BRICS') ? -0.3 : 0) + gauss(R) * 1.2, -12, 40);
  c.fx = c.cur === 'USD' ? 1 : Math.max(0.0001, +(c.fx * (1 + fxDev / 100)).toPrecision(5)); c.fxDevPrev = fxDev;
  // indeks pemerintahan
  const inv = g.laws.includes('uu_kpk') ? 1 : 0;
  g.corruption = clamp(g.corruption + 0.6 + L.corruption + ((ctx.corrAdj || {})[c.code] || 0) - sk('dalam') * 1.2 + (g.trust > 60 ? -0.5 : 0) - inv * 0, 0, 100);
  g.trust = clamp(g.trust + (50 - g.corruption) * 0.03 + L.trust + (ide.trust || 0) + (g.approval - 50) * 0.02 + gauss(R) * 0.8, 0, 100);
  g.stability = clamp(g.stability + (g.approval - 50) * 0.05 + (c.infl > 15 ? -2 : 0) + (c.unemp > 15 ? -1.5 : 0) - c.war.length * 5 + A.stability + L.stability + (ide.stability || 0) + sk('dalam') + (g.stability > 75 ? -0.8 : 0.3) + gauss(R) * 1, 0, 100);
  g.invest = clamp(g.invest + (p.taxCorp < 22 ? 0.8 : -0.5) + (g.stability - 50) * 0.04 - (g.corruption - 50) * 0.04 + A.invest + L.invest + (ide.invest || 0) + clamp(tr.exp / c.gdp * 10, 0, 1) - p.tariff * 0.02 + gauss(R) * 0.8, 0, 100);
  g.prosperity = clamp(g.prosperity + (Math.log10(pcap / 800) / 1.8 * 100 - g.prosperity) * 0.12 - (c.unemp - 8) * 0.15 + (c.stock.edu + c.stock.health - 100) * 0.01 + p.welfare * 0.1 - 0.3 + L.prosperity + (ide.prosperity || 0), 0, 100);
  g.readiness = clamp(g.readiness + (p.defense - 2) * 8 - 3 + A.readiness * 0.1 - c.war.length * 6, 0, 100);
  const apprT = 50 + (c.growth - 3) * 2.2 - (c.infl - 3) * 1.1 - (c.unemp - 8) * 0.9 + (p.welfare - 4) * 2.5 + (c.stock.health - 50) * 0.12 - (p.taxInc - 28) * 0.6 - (p.taxCorp - 24) * 0.15 - g.corruption * 0.15 + (g.trust - 50) * 0.1 - (c.war.length ? 6 : 0) + L.approval + (ctx.mood?.[c.code] || 0) + gauss(R) * 2;
  g.approval = clamp(Math.round(g.approval * 0.45 + apprT * 0.55), 0, 100);
  g.readiness = clamp(Math.round(g.readiness), 0, 100); for (const k of ['corruption', 'trust', 'stability', 'invest', 'prosperity']) g[k] = Math.round(g[k] * 10) / 10;
  if (c.war.length) { c.gdp = r2(c.gdp * 0.97); c.pop = Math.max(1000, Math.round(c.pop * 0.999)); }
  c.lastBalance = r2(balance); c.lastRevenue = r2(revenue); c.lastExpense = r2(expense);
  c.hist.push([ctx.year, c.gdp, c.growth, c.infl, c.pop]); if (c.hist.length > 80) c.hist.shift();
  c.used = { investigate: 0, intervene: 0 };
  return ev;
}

// NPC mengatur kebijakan sendiri
export function npcDecide(c, R, year) {
  const p = c.pol, g = c.gov, ch = [];
  const target = c.infl + 1.8; p.rate = r1(clamp(p.rate + clamp((c.infl - (p.rate - 2)) * 0.4, -1.5, 1.5), 0.1, 40));
  const lb = c.lastBalance || 0;
  if (lb < -c.gdp * 0.015 && p.taxInc < 38) { p.taxInc += 1; ch.push('menaikkan pajak penghasilan untuk menekan defisit'); }
  if (lb < -c.gdp * 0.025) { p.spend = r1(clamp(p.spend - 0.5, 8, 30)); p.welfare = r1(clamp(p.welfare - 0.2, 1, 12)); ch.push('memangkas belanja pemerintah'); }
  if (lb > c.gdp * 0.015 && g.approval < 50 && p.taxInc > 15) { p.taxInc -= 1; ch.push('menurunkan pajak karena surplus anggaran'); }
  if (g.approval < 42 && c.treasury > c.gdp * 0.02) { p.welfare = r1(clamp(p.welfare + 0.4, 0, 12)); ch.push('menambah anggaran kesejahteraan'); }
  if (g.approval > 62 && R() < 0.3 && p.taxInc > 15) { p.taxInc -= 1; ch.push('menurunkan pajak penghasilan'); }
  if (c.unemp > 12 && R() < 0.4) { p.infra = r1(clamp(p.infra + 0.3, 0, 8)); ch.push('mempercepat proyek infrastruktur'); }
  if (c.war.length) p.defense = r1(clamp(p.defense + 0.5, 0, 10)); else if (p.defense > 2.5) p.defense = r1(p.defense - 0.2);
  if (R() < 0.15 && !g.laws.includes('uu_kpk') && g.corruption > 55) { g.laws.push('uu_kpk'); ch.push('mengesahkan UU Lembaga Antikorupsi'); }
  if (R() < 0.15 && !g.laws.includes('uu_investasi')) { g.laws.push('uu_investasi'); ch.push('mengesahkan UU Investasi'); }
  if (R() < 0.1) g.ideology = ['pancasila', 'demokrasi', 'komunisme'][Math.floor(R() * 3)];
  return ch;
}

// ---------- pemilu ----------
export function runElection(c, playerVotes, year, R) {
  const g = c.gov;
  const sentiment = clamp(0.5 + (g.approval - 50) * 0.008 + (g.prosperity - 50) * 0.002 + (g.trust - 50) * 0.002 + (g.stability - 50) * 0.002 + (c.growth - 3) * 0.01 - (c.infl > 10 ? 0.05 : 0), 0.15, 0.85);
  const turnout = clamp(0.55 + (g.trust - 50) * 0.003 + gauss(R) * 0.03, 0.35, 0.92);
  const NPC = 100;                                  // pemilih NPC mewakili masyarakat; tiap warga pemain = 1 suara
  const districts = [];
  let inc = 0, tot = 0, prevInc = c.gov.lastShare ?? 50;
  for (let d = 0; d < 5; d++) {
    const dv = Math.round(NPC * turnout / 5 * (0.9 + R() * 0.2)), pi = clamp(sentiment + gauss(R) * 0.06, 0.05, 0.95);
    const incV = Math.round(dv * pi) + (playerVotes.byDistrict[d]?.inc || 0), chV = dv - Math.round(dv * pi) + (playerVotes.byDistrict[d]?.ch || 0);
    districts.push({ name: `Daerah Pemilihan ${d + 1}`, inc: incV, ch: chV, winner: incV >= chV ? 'incumbent' : 'challenger' }); inc += incV; tot += incV + chV;
  }
  const share = tot ? r1(inc / tot * 100) : 50;
  const res = { year, incumbent: g.president, challenger: NPC_NAMES[Math.floor(R() * NPC_NAMES.length)] + ' (' + g.parties[Math.floor(R() * 5)].name + ')', share, challengerShare: r1(100 - share), turnout: r1(turnout * 100), change: r1(share - prevInc), districts, playerVotes: playerVotes.total, winner: share >= 50 ? 'incumbent' : 'challenger' };
  g.lastShare = share; return res;
}

// ---------- skor & ringkasan ----------
export function score(c, rank) {
  const g = c.gov, pc = c.gdp * 1e9 / c.pop;
  return Math.round(clamp(Math.log10(c.gdp + 1) * 14, 0, 60) + clamp(Math.log10(pc / 300), 0, 2) * 10 + g.prosperity * 0.2 + g.approval * 0.15 + (100 - g.corruption) * 0.12 + g.stability * 0.1 + clamp(c.growth, -5, 10) * 1.2 + clamp(c.treasury / c.gdp * 40, 0, 6) - clamp(c.debt / c.gdp - 1, 0, 3) * 4);
}
export function slim(c, pres) {
  return { code: c.code, name: c.name, region: c.region, sub: c.sub, lat: c.lat, lng: c.lng, flag: c.flag, cur: c.cur, sym: c.sym, fx: c.fx, tz: c.tz, pop: c.pop, gdp: c.gdp, growth: c.growth, infl: c.infl, unemp: c.unemp, debt: c.debt, treasury: c.treasury, approval: c.gov.approval, corruption: c.gov.corruption, prosperity: c.gov.prosperity, stability: c.gov.stability, president: pres?.name || c.gov.president, playerPres: !!pres, score: score(c), mem: c.mem, war: c.war, exp: c.trade?.exp || 0, imp: c.trade?.imp || 0, ide: c.gov.ideology };
}
