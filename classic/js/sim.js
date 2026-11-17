// ============================================================
//  country.7mit — mesin simulasi (murni data, tanpa three.js)
// ============================================================
import { COUNTRIES, SECTORS, BUILDINGS, POLICIES, EVENTS } from './data.js';

export const GRID = 7;           // 7x7 plot
export const TERM_MONTHS = 60;   // satu periode = 5 tahun
export const MAX_TERMS = 2;
export const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const START_YEAR = 2026;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export const byId = id => COUNTRIES.find(c => c.id === id);
export const scale = S => Math.max(0.25, S.gdp0 / 1400);          // skala biaya proyek
export const dateOf = S => ({ y: START_YEAR + Math.floor(S.month / 12), m: S.month % 12 });
export const dateStr = S => { const d = dateOf(S); return `${MONTHS_ID[d.m]} ${d.y}`; };
export const buildCost = (S, type, level = 0) => Math.round(BUILDINGS[type].cost * scale(S) * (level === 0 ? 1 : (level + 0.6) * 0.8) * 10) / 10;
export const isCoastal = (i, j) => i === 0 || j === 0 || i === GRID - 1 || j === GRID - 1;
export const isPalace = (i, j) => i === 3 && j === 3;
export const plotAt = (S, i, j) => S.plots.find(p => p.i === i && p.j === j);

// ------------------------------------------------------------
//  Agregat bangunan
// ------------------------------------------------------------
export function aggregate(S) {
  const a = { fx: { edu: 0, health: 0, infra: 0, tech: 0, green: 0, sec: 0, welfare: 0 }, energy: 0, dem: 0, poll: 0, jobs: 0, trade: 0, tour: 0, ind: 0, food: 0, corr: 0, pop: 0, upkeep: 0, count: 0, byType: {} };
  for (const p of S.plots) {
    const b = p.b; if (!b) continue;
    const d = BUILDINGS[b.type];
    a.upkeep += d.upkeep * b.level * 0.7 + d.upkeep * 0.3;   // biaya jalan, termasuk saat dibangun
    if (b.progress < 1) continue;
    const L = b.level;
    a.count++; a.byType[b.type] = (a.byType[b.type] || 0) + L;
    for (const k in d.fx) a.fx[k] += d.fx[k] * L;
    a.energy += (d.energy || 0) * L; a.dem += (d.dem || 0) * L; a.poll += (d.poll || 0) * L;
    a.jobs += (d.jobs || 0) * L; a.trade += (d.trade || 0) * L; a.tour += (d.tour || 0) * L;
    a.ind += (d.ind || 0) * L; a.food += (d.food || 0) * L; a.corr += (d.corr || 0) * L; a.pop += (d.pop || 0) * L;
  }
  return a;
}
const bonus = x => (x >= 0 ? 1 : -1) * 60 * (1 - Math.exp(-Math.abs(x) / 40));

function policyFx(S) {
  const r = { fx: {}, g: 0, corr: 0, mood: 0, infl: 0, cost: 0 };
  for (const p of POLICIES) {
    if (!S.policies[p.k]) continue;
    for (const k in (p.fx || {})) r.fx[k] = (r.fx[k] || 0) + p.fx[k];
    r.g += p.g || 0; r.corr += p.corr || 0; r.mood += p.mood || 0; r.infl += p.infl || 0; r.cost += p.cost;
  }
  return r;
}

// ------------------------------------------------------------
//  Permainan baru
// ------------------------------------------------------------
export function newGame(countryId, president) {
  const cn = byId(countryId);
  const S = {
    v: 2, cid: countryId, president: president || 'Presiden', month: 0, term: 1, freeplay: false,
    gdp: cn.gdp, gdp0: cn.gdp, pop: cn.pop, pop0: cn.pop,
    treasury: cn.gdp * 0.055, debt: cn.gdp * cn.debtR / 100,
    idx: { edu: cn.edu, health: cn.health, infra: cn.infra, tech: cn.tech, green: cn.green, sec: cn.mil, welfare: cn.welfare },
    idx0: { edu: cn.edu, health: cn.health, infra: cn.infra, tech: cn.tech, green: cn.green, sec: cn.mil, welfare: cn.welfare },
    base: {}, corruption: cn.corr, corr0: cn.corr, inflation: cn.infl0, unemployment: cn.unemp0,
    growth: cn.g0, approval: 55, mood: 0, tax: cn.tax0, tax0: cn.tax0,
    spend: { edu: 100, health: 100, infra: 100, sec: 100, tech: 100, green: 100, welfare: 100 },
    policies: {}, shocks: [], plots: [], dip: {}, log: [], hist: { gdp: [cn.gdp], appr: [55], pop: [cn.pop] },
    energyLegacy: 0, jobs0: 0, lowApproval: 0, bankrupt: 0, stats: { built: 0, events: 0, deals: 0 },
    cd: { event: 4 }, lastNet: 0, lastRev: 0, lastExp: 0, energySupply: 0, energyDemand: 0, blackout: 0, pollution: 0,
  };
  S.cn = cn;
  // plot
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (!isPalace(i, j)) S.plots.push({ i, j, b: null });
  seedInitialBuildings(S, cn);
  const ag = aggregate(S);
  for (const k in S.idx) S.base[k] = S.idx[k] - bonus(ag.fx[k]);
  S.baseCorr = cn.corr - ag.corr;
  const dem0 = cn.pop * 0.1 * (1 + S.idx.tech / 400) + ag.dem;
  S.energyLegacy = dem0 * 1.06 - ag.energy;
  S.energyDemand = dem0; S.energySupply = S.energyLegacy + ag.energy;
  S.jobs0 = ag.jobs;
  // diplomasi
  const rr = mulberry(hashStr(countryId));
  for (const o of COUNTRIES) {
    if (o.id === countryId) continue;
    const d = Math.hypot(o.lat - cn.lat, o.lon - cn.lon);
    S.dip[o.id] = { rel: Math.round(clamp(55 + rr() * 30 - 12 - (d > 120 ? 4 : 0) + (o.id === 'ru' || o.id === 'cn' || o.id === 'us' ? -6 : 0), 20, 85)), trade: false, alliance: false, sanction: false, cd: 0 };
  }
  addLog(S, `🏛️ ${president} dilantik sebagai Presiden ${cn.name}! Masa jabatan 5 tahun dimulai.`, 'good');
  S.base0 = JSON.parse(JSON.stringify(S.base));
  return S;
}

function seedInitialBuildings(S, cn) {
  const r = mulberry(hashStr(cn.id) + 7);
  const n = clamp(Math.round(6 + 8 * Math.log10(Math.max(cn.gdp, 300) / 300)), 6, 20);
  const weights = {
    housing: 3, school: 1 + cn.edu / 40, hospital: 1 + cn.health / 40, factory: 1 + cn.tech / 50 + cn.g0 / 4, farm: 2.2 - cn.tech / 80,
    solar: cn.green / 40, wind: cn.green / 55, coal: 2 - cn.green / 50, port: 0.6, airport: 0.3 + cn.infra / 150, base: cn.mil / 60,
    techhub: cn.tech / 55, park: cn.green / 40, resort: cn.tour, anticorr: cn.corr < 30 ? 0.8 : 0.1, rail: cn.infra / 80,
  };
  const free = S.plots.slice().sort((a, b) => (Math.hypot(a.i - 3, a.j - 3) + r() * 2.2) - (Math.hypot(b.i - 3, b.j - 3) + r() * 2.2));
  const keys = Object.keys(weights);
  let placed = 0;
  for (const p of free) {
    if (placed >= n) break;
    const pool = keys.filter(k => !BUILDINGS[k].coastal || isCoastal(p.i, p.j));
    let tot = pool.reduce((s, k) => s + Math.max(0.05, weights[k]), 0), x = r() * tot, pick = pool[0];
    for (const k of pool) { x -= Math.max(0.05, weights[k]); if (x <= 0) { pick = k; break; } }
    p.b = { type: pick, level: cn.gdp > 2500 && r() < 0.5 ? 2 : 1, progress: 1, months: 1 };
    placed++;
  }
}

// ------------------------------------------------------------
//  API untuk event & aksi
// ------------------------------------------------------------
export function addLog(S, text, kind = 'info') {
  S.log.unshift({ t: dateStr(S), text, kind });
  if (S.log.length > 80) S.log.pop();
  if (S._hooks && S._hooks.onLog) S._hooks.onLog(text, kind);
}
const A = {
  mood: (S, n) => { S.mood += n; },
  shock: (S, s) => { S.shocks.push({ g: 0, infl: 0, ...s, name: s.name }); },
  idxBoost: (S, k, n) => { S.idx[k] = clamp(S.idx[k] + n, 0, 100); S.base[k] += n * 0.5; },
  corr: (S, n) => { S.corruption = clamp(S.corruption + n, 0, 100); },
};
export const hookRef = {};

// ------------------------------------------------------------
//  Aksi pemain
// ------------------------------------------------------------
export function canBuild(S, i, j, type) {
  const p = plotAt(S, i, j); if (!p) return 'Plot tidak valid';
  if (p.b) return 'Plot sudah terisi';
  const d = BUILDINGS[type];
  if (d.coastal && !isCoastal(i, j)) return 'Hanya bisa dibangun di pesisir';
  if (S.treasury < buildCost(S, type)) return 'Kas tidak cukup';
  return null;
}
export function build(S, i, j, type) {
  const err = canBuild(S, i, j, type); if (err) return err;
  const p = plotAt(S, i, j);
  S.treasury -= buildCost(S, type);
  p.b = { type, level: 1, progress: 0, months: BUILDINGS[type].months };
  S.stats.built++;
  addLog(S, `🏗️ Pembangunan ${BUILDINGS[type].name} dimulai.`, 'info');
  return null;
}
export function upgradeCost(S, p) { return buildCost(S, p.b.type, p.b.level); }
export function canUpgrade(S, p) {
  if (!p.b || p.b.progress < 1) return 'Belum selesai dibangun';
  if (p.b.level >= 3) return 'Level maksimum';
  if (S.treasury < upgradeCost(S, p)) return 'Kas tidak cukup';
  return null;
}
export function upgrade(S, p) {
  const e = canUpgrade(S, p); if (e) return e;
  S.treasury -= upgradeCost(S, p);
  p.b.level++; p.b.progress = 0; p.b.months = Math.max(2, Math.round(BUILDINGS[p.b.type].months * 0.7));
  p.b.upgrading = true;
  addLog(S, `⬆️ Peningkatan ${BUILDINGS[p.b.type].name} ke level ${p.b.level} dimulai.`, 'info');
  return null;
}
export function demolish(S, p) {
  if (!p.b) return;
  const refund = buildCost(S, p.b.type) * 0.35 * p.b.level;
  S.treasury += refund;
  addLog(S, `🧨 ${BUILDINGS[p.b.type].name} dibongkar (pengembalian ${money(refund)}).`, 'warn');
  p.b = null;
}
export function repayDebt(S) {
  const pay = Math.min(S.debt, Math.max(0, S.treasury - S.gdp * 0.01), S.debt * 0.2 + 1);
  if (pay <= 0) return 0;
  S.treasury -= pay; S.debt -= pay; return pay;
}
export const money = v => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(2)}T`;
  if (a >= 100) return `${s}$${a.toFixed(0)}M`.replace('M', 'B');
  return `${s}$${a.toFixed(1)}B`;
};

// diplomasi
export const DIP_ACTIONS = {
  delegasi: { name: 'Kirim Delegasi', icon: '🕊️', cost: 1.5, need: 0, run: (S, d, o) => { d.rel = clamp(d.rel + rnd(4, 8), 0, 100); return `Delegasi ke ${o.name} disambut hangat.`; } },
  bantuan: { name: 'Bantuan Luar Negeri', icon: '🎁', cost: 6, need: 0, run: (S, d, o) => { d.rel = clamp(d.rel + rnd(10, 16), 0, 100); S.mood += 0.5; return `Bantuan ke ${o.name} mempererat hubungan.`; } },
  dagang: { name: 'Perjanjian Dagang', icon: '📦', cost: 5, need: 55, run: (S, d, o) => { d.trade = true; S.stats.deals++; return `Perjanjian dagang dengan ${o.name} ditandatangani!`; } },
  aliansi: { name: 'Aliansi Pertahanan', icon: '🛡️', cost: 10, need: 75, run: (S, d, o) => { d.alliance = true; return `Aliansi pertahanan dengan ${o.name} terbentuk.`; } },
  sanksi: { name: 'Jatuhkan Sanksi', icon: '⛔', cost: 0, need: 0, run: (S, d, o) => { d.sanction = true; d.trade = false; d.alliance = false; d.rel = clamp(d.rel - 30, 0, 100); return `Sanksi dijatuhkan kepada ${o.name}.`; } },
  cabut: { name: 'Cabut Kesepakatan', icon: '✂️', cost: 0, need: 0, run: (S, d, o) => { d.trade = false; d.alliance = false; d.sanction = false; d.rel = clamp(d.rel - 8, 0, 100); return `Kesepakatan dengan ${o.name} dicabut.`; } },
};
export function dipCost(S, a) { return DIP_ACTIONS[a].cost * Math.max(0.5, scale(S) * 0.8); }
export function dipCheck(S, id, a) {
  const d = S.dip[id], A_ = DIP_ACTIONS[a];
  if (d.cd > 0 && a !== 'cabut' && a !== 'sanksi') return `Tunggu ${d.cd} bulan lagi`;
  if (S.treasury < dipCost(S, a)) return 'Kas tidak cukup';
  if (A_.need && d.rel < A_.need) return `Butuh hubungan ≥ ${A_.need}`;
  if (a === 'dagang' && d.trade) return 'Sudah berdagang';
  if (a === 'aliansi' && d.alliance) return 'Sudah beraliansi';
  if (a === 'sanksi' && d.sanction) return 'Sudah disanksi';
  if (d.sanction && (a === 'dagang' || a === 'aliansi')) return 'Negara sedang disanksi';
  return null;
}
export function dipAct(S, id, a) {
  const e = dipCheck(S, id, a); if (e) return e;
  const d = S.dip[id], o = byId(id);
  S.treasury -= dipCost(S, a);
  d.cd = a === 'cabut' || a === 'sanksi' ? d.cd : 3;
  const msg = DIP_ACTIONS[a].run(S, d, o);
  addLog(S, `🌐 ${msg}`, a === 'sanksi' ? 'warn' : 'good');
  return null;
}
export function dipIncome(S) {
  let inc = 0, n = 0, al = 0;
  for (const id in S.dip) {
    const d = S.dip[id], o = byId(id);
    if (d.trade) { inc += (S.gdp / 12) * 0.0065 * Math.min(1.5, Math.sqrt(o.gdp / S.gdp)) * (0.7 + d.rel / 150); n++; }
    if (d.alliance) al++;
  }
  return { inc, n, al };
}

// ------------------------------------------------------------
//  Tick bulanan
// ------------------------------------------------------------
export function tick(S, hooks = {}) {
  S._hooks = hooks;
  const cn = S.cn;
  // 1. konstruksi
  for (const p of S.plots) {
    const b = p.b; if (!b || b.progress >= 1) continue;
    b.progress = Math.min(1, b.progress + 1 / b.months);
    if (b.progress >= 1) {
      b.upgrading = false;
      addLog(S, `✅ ${BUILDINGS[b.type].name} (Lv.${b.level}) selesai dibangun!`, 'good');
      if (hooks.onBuilt) hooks.onBuilt(p);
    }
  }
  const ag = aggregate(S), pf = policyFx(S), dp = dipIncome(S);
  // 2. guncangan sementara
  let shG = 0, shI = 0;
  for (const s of S.shocks) { shG += s.g; shI += s.infl; s.left--; }
  S.shocks = S.shocks.filter(s => s.left > 0);
  // 3. indeks (infrastruktur & layanan menua tanpa perawatan)
  for (const k in S.base) S.base[k] -= 0.05;
  for (const k in S.idx) {
    const sp = (S.spend[k] - 100) * 0.22;
    let tgt = S.base[k] + bonus(ag.fx[k]) + sp + (pf.fx[k] || 0);
    if (k === 'sec') tgt += dp.al * 3;
    if (k === 'green') tgt -= S.pollution * 0.5;
    if (k === 'health') tgt -= S.pollution * 0.15;
    tgt = clamp(tgt, 2, 100);
    S.idx[k] += (tgt - S.idx[k]) * 0.07;
  }
  // 4. korupsi
  const corrTgt = clamp(S.baseCorr + ag.corr + pf.corr + (S.spend.sec - 100) * 0.0, 2, 100);
  S.corruption += (corrTgt - S.corruption) * 0.04;
  // 5. energi
  S.energyDemand = S.pop * 0.1 * (1 + S.idx.tech / 400) + ag.dem;
  S.energySupply = S.energyLegacy + ag.energy;
  const shortage = clamp(1 - S.energySupply / S.energyDemand, 0, 0.6);
  S.blackout = shortage;
  // 6. polusi
  const pollTgt = clamp(ag.poll * 2.2 + S.pop * 0.02 - ag.fx.green * 0.4 + (cn.green < 40 ? 6 : 0) - (S.idx.green - 50) * 0.15, 0, 60);
  S.pollution += (pollTgt - S.pollution) * 0.08;
  // 7. pertumbuhan
  const d = (k) => S.idx[k] - S.idx0[k];
  const g = cn.g0 + d('infra') * 0.05 + d('edu') * 0.035 + d('tech') * 0.05 + d('sec') * 0.004
    - (S.corruption - S.corr0) * 0.03 - (S.tax - S.tax0) * 0.1 + ag.trade * 0.28 + ag.tour * 0.22 * (0.5 + cn.tour)
    + ag.ind * 0.22 + dp.n * 0.2 + pf.g + shG - shortage * 14 - Math.max(0, S.inflation - cn.infl0 - 5) * 0.12 - Math.max(0, S.pollution - 25) * 0.04
    + (S.pop0 > 0 ? (S.pop / S.pop0 - 1) * 4 : 0) * 0;
  S.growth += (g - S.growth) * 0.2;
  const gdpGrowthM = Math.pow(1 + S.growth / 100, 1 / 12);
  S.gdp *= gdpGrowthM;
  // 8. penduduk
  const popRate = 0.9 + (S.idx.health - 50) * 0.01 + ag.pop * 3 + (S.idx.welfare - 40) * 0.006 - (cn.gdp > 3000 ? 0.5 : 0);
  S.pop *= 1 + Math.max(-0.3, popRate) / 1200;
  // 9. keuangan
  const corrLeak = 1 - S.corruption / 260;
  const resInc = (S.gdp / 12) * 0.012 * cn.res;
  const tourInc = (S.gdp / 12) * 0.010 * ag.tour * (0.4 + cn.tour);
  const taxRev = (S.gdp / 12) * (S.tax / 100) * corrLeak;
  const trInc = dp.inc + (ag.trade * (S.gdp / 12) * 0.0035);
  const carbon = S.policies.karbon ? (S.gdp / 12) * 0.003 : 0;
  const revenue = taxRev + resInc + tourInc + trInc + carbon;
  let exp = 0;
  for (const s of SECTORS) exp += (S.gdp / 12) * s.share * (S.spend[s.k] / 100);
  exp += (S.gdp / 12) * 0.014;                                 // administrasi
  const upkeep = ag.upkeep * scale(S) * 0.12;
  const polCost = (S.gdp / 12) * Math.max(0, pf.cost);
  const interest = S.debt * Math.min(0.09, (cn.rate ?? 0.032) + Math.max(0, S.debt / S.gdp - 1.0) * 0.012) / 12;
  const expense = exp + upkeep + polCost + interest;
  S.lastRev = revenue; S.lastExp = expense;
  S.treasury += revenue - expense;
  S.lastNet = revenue - expense;
  if (S.treasury < 0) { S.debt += -S.treasury; S.treasury = 0; }
  // 10. inflasi & pengangguran
  const deficitPct = (expense - revenue) / (S.gdp / 12) * 100;
  const inflTgt = cn.infl0 + Math.max(-1, deficitPct) * 0.08 + Math.max(0, S.growth - 6) * 0.4 + shI + pf.infl + shortage * 8 + (S.tax - S.tax0) * 0.05 * -1;
  S.inflation += (clamp(inflTgt, -1, 80) - S.inflation) * 0.12;
  const perJob = 50 / S.pop;
  const uTgt = cn.unemp0 - (ag.jobs - S.jobs0) * perJob - (S.growth - cn.g0) * 0.35 + (S.pop / S.pop0 - 1) * 15;
  S.unemployment += (clamp(uTgt, 1, 45) - S.unemployment) * 0.1;
  // 11. kepuasan rakyat
  const I = S.idx, I0 = S.idx0;
  const apprTgt = 55 + (I.health - I0.health) * 0.28 + (I.edu - I0.edu) * 0.18 + (I.welfare - I0.welfare) * 0.3 + (I.infra - I0.infra) * 0.12
    + (S.growth - cn.g0) * 1.8 - (S.unemployment - cn.unemp0) * 1.3 - (S.inflation - cn.infl0) * Math.min(1, 12 / Math.max(6, cn.infl0)) * 0.9
    - (S.tax - S.tax0) * 1.6 - (S.corruption - S.corr0) * 0.35 + (I.green - I0.green) * 0.1 - Math.max(0, S.pollution - 22) * 0.25
    - shortage * 40 + pf.mood - (S.month / 12) * 0.35 + (I.sec - I0.sec) * 0.05 - Math.max(0, S.debt / S.gdp - 1.5) * 12 + S.mood;
  S.approval += (clamp(apprTgt, 0, 100) - S.approval) * 0.18;
  S.mood *= 0.88;
  // 12. diplomasi sederhana
  for (const id in S.dip) {
    const dd = S.dip[id];
    if (dd.cd > 0) dd.cd--;
    if (!dd.trade && !dd.alliance) dd.rel += (50 - dd.rel) * 0.01 + rnd(-0.6, 0.6);
    else dd.rel += rnd(-0.2, 0.5);
    if (dd.sanction) dd.rel -= 0.4;
    dd.rel = clamp(dd.rel, 0, 100);
  }
  // 13. waktu & statistik
  S.month++;
  S.hist.gdp.push(S.gdp); S.hist.appr.push(S.approval); S.hist.pop.push(S.pop);
  if (S.hist.gdp.length > 130) { S.hist.gdp.shift(); S.hist.appr.shift(); S.hist.pop.shift(); }
  if (S.month % 12 === 0) addLog(S, `📅 Tahun ${dateOf(S).y}: PDB ${money(S.gdp)} (${S.growth >= 0 ? '+' : ''}${S.growth.toFixed(1)}%), kepuasan ${Math.round(S.approval)}%.`, 'info');
  if (shortage > 0.08 && S.month % 3 === 0) addLog(S, '🔌 Krisis listrik! Pemadaman bergilir melanda kota. Bangun pembangkit baru.', 'bad');
  if (S.treasury < 0.2 * scale(S) && S.month % 4 === 0) addLog(S, '💸 Kas negara menipis — negara berutang untuk menutup defisit.', 'warn');
  // 14. event
  S.cd.event--;
  if (S.cd.event <= 0 && !hooks.busy) {
    const ev = pickEvent(S);
    if (ev) { S.cd.event = Math.round(rnd(4, 9)); S.stats.events++; if (hooks.onEvent) hooks.onEvent(ev); }
    else S.cd.event = 2;
  }
  // 15. syarat kalah & pemilu
  if (S.approval < 14) S.lowApproval++; else S.lowApproval = Math.max(0, S.lowApproval - 1);
  if (S.lowApproval >= 4) return end(S, hooks, 'kudeta');
  if (S.debt / S.gdp > 3.2) return end(S, hooks, 'bangkrut');
  if (!S.freeplay && S.month % TERM_MONTHS === 0) return election(S, hooks);
}

function pickEvent(S) {
  const dp = Object.entries(S.dip);
  // konflik diplomatik
  const hostile = dp.filter(([id, d]) => d.rel < 22 && !d.alliance);
  if (hostile.length && Math.random() < 0.1 && S.month > 6) return conflictEvent(S, hostile[Math.floor(Math.random() * hostile.length)][0]);
  if (S.debt / S.gdp > 1.6 && Math.random() < 0.12) return debtEvent();
  const list = EVENTS.map(e => ({ e, w: e.w(S) }));
  if (Math.random() > 0.8) return null;
  const tot = list.reduce((s, x) => s + x.w, 0); let x = Math.random() * tot;
  for (const it of list) { x -= it.w; if (x <= 0) return it.e; }
  return list[0].e;
}
function debtEvent() {
  return {
    id: 'utang', icon: '🏦', title: 'Peringatan Lembaga Pemeringkat', text: S => `Utang negara mencapai ${(S.debt / S.gdp * 100).toFixed(0)}% PDB. Lembaga pemeringkat menurunkan peringkat kredit ${S.cn.name}.`,
    choices: [
      { label: 'Program penghematan', hint: 'Pasar tenang • rakyat kesal', cost: 0, run: (S, A_) => { A_.mood(S, -6); S.debt *= 0.97; return 'Pasar merespons positif, tapi masyarakat harus mengencangkan ikat pinggang.'; } },
      { label: 'Abaikan peringatan', hint: 'Risiko krisis', cost: 0, run: (S, A_) => { A_.shock(S, { name: 'Krisis kepercayaan', g: -1.5, infl: 1.5, left: 6 }); return 'Bunga pinjaman melonjak.'; } },
    ],
  };
}
function conflictEvent(S, id) {
  const o = byId(id);
  return {
    id: 'konflik', icon: '⚔️', title: `Ketegangan dengan ${o.name}`,
    text: S => `Hubungan dengan ${o.name} ${o.flag} memburuk drastis. Pasukan mereka bergerak ke perbatasan. Bagaimana sikap Presiden ${S.president}?`,
    choices: [
      { label: 'Jalur diplomasi', hint: 'Cost kecil • hubungan membaik', cost: 3, run: (S, A_) => { const d = S.dip[id]; d.rel = clamp(d.rel + 22, 0, 100); A_.mood(S, 3); return `Perundingan berhasil meredakan ketegangan dengan ${o.name}.`; } },
      { label: 'Siagakan militer', hint: 'Menang jika kuat • risiko perang', cost: 8, run: (S, A_) => {
          const my = S.idx.sec * Math.sqrt(S.gdp / 1000 + 1) * (1 + 0.15 * Object.values(S.dip).filter(x => x.alliance).length);
          const th = o.mil * Math.sqrt(o.gdp / 1000 + 1);
          if (my * rnd(0.7, 1.4) >= th * rnd(0.6, 1.2)) { A_.mood(S, 8); S.dip[id].rel = 35; return `Kekuatan militer membuat ${o.name} mundur. Rakyat bangga!`; }
          A_.mood(S, -12); S.gdp *= 0.985; A_.shock(S, { name: 'Perang perbatasan', g: -2.5, left: 6 }); S.dip[id].rel = 25; return `Bentrokan pecah dan ${S.cn.name} menderita kerugian.`;
        } },
    ],
  };
}

function end(S, hooks, reason) {
  S.over = reason; if (hooks.onEnd) hooks.onEnd(reason); return reason;
}

export function score(S) {
  const gdpRatio = S.gdp / S.gdp0, hdi = (S.idx.edu + S.idx.health + S.idx.welfare) / 3;
  const sc = Math.round(Math.max(0, (gdpRatio - 1) * 400 + hdi * 4 + S.approval * 3 + S.idx.green * 1.5 + (100 - S.corruption) * 2 + S.idx.tech * 2 - Math.max(0, S.debt / S.gdp - 1) * 80));
  const grade = sc > 1500 ? 'S' : sc > 1100 ? 'A' : sc > 800 ? 'B' : sc > 550 ? 'C' : 'D';
  const title = { S: 'Bapak/Ibu Pembangunan Bangsa', A: 'Negarawan Besar', B: 'Pemimpin yang Cakap', C: 'Presiden Biasa-biasa Saja', D: 'Pemimpin yang Terlupakan' }[grade];
  return { score: sc, grade, title };
}

function election(S, hooks) {
  const vote = clamp(S.approval * 0.97 + rnd(-5, 5), 0, 100);
  const win = vote >= 50;
  addLog(S, `🗳️ Pemilu: ${S.president} meraih ${vote.toFixed(1)}% suara — ${win ? 'MENANG' : 'KALAH'}.`, win ? 'good' : 'bad');
  if (!win) { S.over = 'pemilu'; if (hooks.onEnd) hooks.onEnd('pemilu', vote); return 'pemilu'; }
  if (S.term >= MAX_TERMS) { S.over = 'selesai'; if (hooks.onEnd) hooks.onEnd('selesai', vote); return 'selesai'; }
  S.term++; S.mood += 6;
  if (hooks.onElection) hooks.onElection(vote);
}

export function resolveEvent(S, ev, choiceIdx) {
  const c = ev.choices[choiceIdx];
  const cost = (c.cost || 0) * scale(S);
  if (cost > 0 && S.treasury < cost) { S.debt += cost - S.treasury; S.treasury = 0; } else S.treasury -= cost;
  const msg = c.run(S, A);
  addLog(S, `${ev.icon} ${ev.title}: ${msg}`, 'info');
  return msg;
}

export function save(S) { try { const c = { ...S }; delete c._hooks; delete c.cn; localStorage.setItem('country7mit_save', JSON.stringify(c)); return true; } catch (e) { return false; } }
export function load() {
  try { const t = localStorage.getItem('country7mit_save'); if (!t) return null; const S = JSON.parse(t); if (S.v !== 2) return null; S.cn = byId(S.cid); return S; } catch (e) { return null; }
}
export function hasSave() { try { return !!localStorage.getItem('country7mit_save'); } catch (e) { return false; } }
export function bestScore() { try { return JSON.parse(localStorage.getItem('country7mit_best') || 'null'); } catch (e) { return null; } }
export function saveBest(S, sc) { try { const b = bestScore(); if (!b || sc.score > b.score) localStorage.setItem('country7mit_best', JSON.stringify({ score: sc.score, grade: sc.grade, country: S.cn.name })); } catch (e) {} }
