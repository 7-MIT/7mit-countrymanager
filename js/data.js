// ============================================================
//  country.7mit — data statis: negara, bangunan, kebijakan, event
// ============================================================

// biome: tropical | temperate | desert | arctic
export const COUNTRIES = [
  { id: 'id', name: 'Indonesia', flag: '🇮🇩', lat: -2.5, lon: 118, pop: 280, gdp: 1400, capital: 'Nusantara', c1: '#e11d2e', c2: '#ffffff', biome: 'tropical', g0: 5.0, infl0: 3.0, unemp0: 5.3, tax0: 17, corr: 55, debtR: 40, mil: 50, edu: 55, health: 50, infra: 45, tech: 40, green: 45, welfare: 40, res: 0.8, tour: 0.8, perk: 'Kepulauan, kaya sumber daya & pariwisata' },
  { id: 'us', name: 'Amerika Serikat', flag: '🇺🇸', lat: 39, lon: -98, pop: 335, gdp: 27000, capital: 'Washington', c1: '#1d3a8a', c2: '#dc2626', biome: 'temperate', g0: 2.2, infl0: 3.2, unemp0: 4.0, tax0: 26, corr: 30, debtR: 120, mil: 95, edu: 75, health: 70, infra: 70, tech: 90, green: 45, welfare: 55, res: 0.5, tour: 0.6, perk: 'Superpower teknologi & militer' },
  { id: 'cn', name: 'Tiongkok', flag: '🇨🇳', lat: 35, lon: 103, pop: 1410, gdp: 17800, capital: 'Beijing', c1: '#dc2626', c2: '#facc15', biome: 'temperate', g0: 4.8, infl0: 1.0, unemp0: 5.2, tax0: 20, corr: 45, debtR: 85, mil: 85, edu: 70, health: 65, infra: 80, tech: 80, green: 35, welfare: 50, res: 0.4, tour: 0.4, perk: 'Raksasa manufaktur dunia' },
  { id: 'in', name: 'India', flag: '🇮🇳', lat: 22, lon: 79, pop: 1430, gdp: 3600, capital: 'New Delhi', c1: '#f97316', c2: '#16a34a', biome: 'tropical', g0: 6.5, infl0: 5.0, unemp0: 7.5, tax0: 17, corr: 50, debtR: 82, mil: 70, edu: 50, health: 45, infra: 45, tech: 60, green: 40, welfare: 38, res: 0.4, tour: 0.5, perk: 'Populasi terbesar, ekonomi digital' },
  { id: 'br', name: 'Brasil', flag: '🇧🇷', lat: -10, lon: -52, pop: 216, gdp: 2100, capital: 'Brasília', c1: '#16a34a', c2: '#facc15', biome: 'tropical', g0: 2.5, infl0: 4.5, unemp0: 8.0, tax0: 22, corr: 50, debtR: 75, mil: 55, edu: 55, health: 50, infra: 45, tech: 50, green: 55, welfare: 45, res: 0.7, tour: 0.5, perk: 'Hutan Amazon & agribisnis' },
  { id: 'jp', rate: 0.008, name: 'Jepang', flag: '🇯🇵', lat: 36, lon: 138, pop: 124, gdp: 4200, capital: 'Tokyo', c1: '#ffffff', c2: '#dc2626', biome: 'temperate', g0: 1.0, infl0: 2.5, unemp0: 2.6, tax0: 25, corr: 20, debtR: 250, mil: 60, edu: 85, health: 90, infra: 85, tech: 85, green: 60, welfare: 65, res: 0.1, tour: 0.7, perk: 'Teknologi tinggi, utang raksasa' },
  { id: 'de', name: 'Jerman', flag: '🇩🇪', lat: 51, lon: 10, pop: 84, gdp: 4500, capital: 'Berlin', c1: '#111827', c2: '#facc15', biome: 'temperate', g0: 1.2, infl0: 2.8, unemp0: 3.2, tax0: 28, corr: 15, debtR: 65, mil: 55, edu: 85, health: 85, infra: 85, tech: 80, green: 70, welfare: 75, res: 0.1, tour: 0.4, perk: 'Industri & teknik terkemuka' },
  { id: 'gb', name: 'Inggris', flag: '🇬🇧', lat: 54, lon: -2, pop: 68, gdp: 3300, capital: 'London', c1: '#1e3a8a', c2: '#dc2626', biome: 'temperate', g0: 1.4, infl0: 3.0, unemp0: 4.2, tax0: 26, corr: 18, debtR: 100, mil: 65, edu: 80, health: 80, infra: 75, tech: 80, green: 65, welfare: 65, res: 0.3, tour: 0.6, perk: 'Pusat keuangan dunia' },
  { id: 'fr', name: 'Prancis', flag: '🇫🇷', lat: 46, lon: 2, pop: 68, gdp: 3000, capital: 'Paris', c1: '#1d4ed8', c2: '#dc2626', biome: 'temperate', g0: 1.3, infl0: 2.9, unemp0: 7.3, tax0: 30, corr: 20, debtR: 110, mil: 70, edu: 80, health: 85, infra: 80, tech: 78, green: 62, welfare: 72, res: 0.1, tour: 0.95, perk: 'Wisata & energi nuklir' },
  { id: 'ru', name: 'Rusia', flag: '🇷🇺', lat: 61, lon: 90, pop: 144, gdp: 2000, capital: 'Moskow', c1: '#1d4ed8', c2: '#dc2626', biome: 'arctic', g0: 1.5, infl0: 6.0, unemp0: 3.5, tax0: 22, corr: 55, debtR: 20, mil: 88, edu: 70, health: 55, infra: 60, tech: 60, green: 35, welfare: 45, res: 0.95, tour: 0.2, perk: 'Wilayah terluas, energi & militer' },
  { id: 'au', name: 'Australia', flag: '🇦🇺', lat: -25, lon: 134, pop: 26, gdp: 1700, capital: 'Canberra', c1: '#1e3a8a', c2: '#dc2626', biome: 'desert', g0: 2.0, infl0: 3.4, unemp0: 3.8, tax0: 24, corr: 15, debtR: 45, mil: 55, edu: 82, health: 82, infra: 75, tech: 75, green: 55, welfare: 65, res: 0.9, tour: 0.6, perk: 'Tambang & lahan luas' },
  { id: 'ng', name: 'Nigeria', flag: '🇳🇬', lat: 9, lon: 8, pop: 224, gdp: 400, capital: 'Abuja', c1: '#16a34a', c2: '#ffffff', biome: 'tropical', g0: 3.0, infl0: 22.0, unemp0: 33.0, tax0: 10, corr: 70, debtR: 40, mil: 40, edu: 35, health: 30, infra: 30, tech: 30, green: 35, welfare: 25, res: 0.9, tour: 0.2, perk: 'Minyak, tantangan sangat berat' },
  { id: 'eg', name: 'Mesir', flag: '🇪🇬', lat: 26, lon: 30, pop: 112, gdp: 400, capital: 'Kairo', c1: '#dc2626', c2: '#111827', biome: 'desert', g0: 3.5, infl0: 24.0, unemp0: 7.0, tax0: 14, corr: 55, debtR: 90, mil: 55, edu: 45, health: 45, infra: 45, tech: 35, green: 35, welfare: 35, res: 0.4, tour: 0.9, perk: 'Terusan Suez & piramida' },
  { id: 'za', name: 'Afrika Selatan', flag: '🇿🇦', lat: -29, lon: 24, pop: 60, gdp: 380, capital: 'Pretoria', c1: '#16a34a', c2: '#facc15', biome: 'temperate', g0: 1.0, infl0: 5.5, unemp0: 32.0, tax0: 25, corr: 50, debtR: 74, mil: 45, edu: 45, health: 40, infra: 50, tech: 45, green: 40, welfare: 35, res: 0.8, tour: 0.6, perk: 'Tambang emas & pengangguran tinggi' },
  { id: 'sa', name: 'Arab Saudi', flag: '🇸🇦', lat: 24, lon: 45, pop: 36, gdp: 1100, capital: 'Riyadh', c1: '#15803d', c2: '#ffffff', biome: 'desert', g0: 3.0, infl0: 2.5, unemp0: 5.0, tax0: 15, corr: 45, debtR: 25, mil: 65, edu: 55, health: 60, infra: 70, tech: 55, green: 25, welfare: 55, res: 1.0, tour: 0.4, perk: 'Raja minyak dunia' },
  { id: 'tr', name: 'Turki', flag: '🇹🇷', lat: 39, lon: 35, pop: 85, gdp: 1100, capital: 'Ankara', c1: '#dc2626', c2: '#ffffff', biome: 'temperate', g0: 3.5, infl0: 45.0, unemp0: 9.0, tax0: 20, corr: 45, debtR: 35, mil: 65, edu: 60, health: 60, infra: 65, tech: 55, green: 45, welfare: 45, res: 0.3, tour: 0.8, perk: 'Jembatan Asia–Eropa' },
  { id: 'mx', name: 'Meksiko', flag: '🇲🇽', lat: 23, lon: -102, pop: 128, gdp: 1800, capital: 'Mexico City', c1: '#16a34a', c2: '#dc2626', biome: 'desert', g0: 2.5, infl0: 4.5, unemp0: 3.0, tax0: 17, corr: 55, debtR: 55, mil: 45, edu: 50, health: 50, infra: 50, tech: 50, green: 45, welfare: 42, res: 0.5, tour: 0.8, perk: 'Pabrik ekspor ke AS' },
  { id: 'ca', name: 'Kanada', flag: '🇨🇦', lat: 56, lon: -106, pop: 40, gdp: 2100, capital: 'Ottawa', c1: '#dc2626', c2: '#ffffff', biome: 'arctic', g0: 1.8, infl0: 3.0, unemp0: 5.5, tax0: 26, corr: 15, debtR: 105, mil: 50, edu: 85, health: 85, infra: 75, tech: 78, green: 70, welfare: 70, res: 0.8, tour: 0.5, perk: 'Sumber daya & kualitas hidup' },
  { id: 'ar', name: 'Argentina', flag: '🇦🇷', lat: -34, lon: -64, pop: 46, gdp: 640, capital: 'Buenos Aires', c1: '#38bdf8', c2: '#ffffff', biome: 'temperate', g0: 0.5, infl0: 120.0, unemp0: 6.0, tax0: 22, corr: 45, debtR: 90, mil: 40, edu: 60, health: 60, infra: 50, tech: 45, green: 50, welfare: 40, res: 0.7, tour: 0.5, perk: 'Hiperinflasi & lahan subur' },
  { id: 'kr', name: 'Korea Selatan', flag: '🇰🇷', lat: 36, lon: 128, pop: 52, gdp: 1700, capital: 'Seoul', c1: '#ffffff', c2: '#1d4ed8', biome: 'temperate', g0: 2.2, infl0: 3.0, unemp0: 2.8, tax0: 22, corr: 25, debtR: 55, mil: 75, edu: 85, health: 85, infra: 85, tech: 88, green: 50, welfare: 58, res: 0.1, tour: 0.6, perk: 'Pusat teknologi & hiburan' },
];

export const SECTORS = [
  { k: 'edu', name: 'Pendidikan', icon: '🎓', share: 0.030 },
  { k: 'health', name: 'Kesehatan', icon: '🏥', share: 0.028 },
  { k: 'infra', name: 'Infrastruktur', icon: '🛣️', share: 0.025 },
  { k: 'sec', name: 'Pertahanan', icon: '🛡️', share: 0.015 },
  { k: 'tech', name: 'Riset & Teknologi', icon: '🔬', share: 0.010 },
  { k: 'green', name: 'Lingkungan', icon: '🌳', share: 0.006 },
  { k: 'welfare', name: 'Kesejahteraan Sosial', icon: '🤲', share: 0.035 },
];

// fx = bonus indeks per level. cost dalam "miliar USD" pada ekonomi dasar (PDB 1400) — diskalakan.
export const BUILDINGS = {
  housing: { name: 'Perumahan Rakyat', icon: '🏘️', cost: 18, months: 3, upkeep: 0.25, jobs: 2, dem: 0.6, fx: { welfare: 2.2 }, pop: 0.04, desc: 'Rumah terjangkau. Meningkatkan kesejahteraan & pertumbuhan penduduk.' },
  school: { name: 'Sekolah & Kampus', icon: '🏫', cost: 22, months: 4, upkeep: 0.5, jobs: 3, dem: 0.3, fx: { edu: 7 }, desc: 'Meningkatkan mutu pendidikan nasional.' },
  hospital: { name: 'Rumah Sakit', icon: '🏥', cost: 28, months: 5, upkeep: 0.8, jobs: 4, dem: 0.5, fx: { health: 7 }, desc: 'Layanan kesehatan & harapan hidup.' },
  factory: { name: 'Kawasan Industri', icon: '🏭', cost: 35, months: 5, upkeep: 0.9, jobs: 8, dem: 2, poll: 3, ind: 1, fx: {}, desc: 'Lapangan kerja & pertumbuhan, tapi polusi & butuh listrik.' },
  farm: { name: 'Pertanian', icon: '🌾', cost: 15, months: 3, upkeep: 0.3, jobs: 5, ind: 0.3, fx: { green: 1, welfare: 1 }, food: 1, desc: 'Ketahanan pangan & lapangan kerja desa.' },
  solar: { name: 'Pembangkit Surya', icon: '☀️', cost: 40, months: 4, upkeep: 0.3, jobs: 1, energy: 4, fx: { green: 2 }, desc: 'Listrik bersih tanpa polusi.' },
  wind: { name: 'Turbin Angin', icon: '🌬️', cost: 45, months: 5, upkeep: 0.3, jobs: 1, energy: 5, fx: { green: 2 }, desc: 'Listrik bersih dari angin.' },
  coal: { name: 'PLTU Batubara', icon: '⚫', cost: 30, months: 5, upkeep: 0.8, jobs: 3, energy: 9, poll: 5, fx: {}, desc: 'Listrik murah & besar, tapi sangat berpolusi.' },
  port: { name: 'Pelabuhan Laut', icon: '⚓', cost: 50, months: 6, upkeep: 1.0, jobs: 5, trade: 1, fx: { infra: 3 }, coastal: true, desc: 'Gerbang perdagangan. Hanya di pesisir.' },
  airport: { name: 'Bandar Udara', icon: '✈️', cost: 80, months: 8, upkeep: 1.5, jobs: 6, dem: 1, trade: 0.5, tour: 0.6, fx: { infra: 5 }, desc: 'Konektivitas, wisata & perdagangan.' },
  base: { name: 'Pangkalan Militer', icon: '🪖', cost: 55, months: 6, upkeep: 1.6, jobs: 3, dem: 1, fx: { sec: 9 }, desc: 'Memperkuat pertahanan negara.' },
  techhub: { name: 'Pusat Teknologi', icon: '💡', cost: 60, months: 6, upkeep: 1.2, jobs: 4, dem: 2, ind: 0.4, fx: { tech: 8 }, desc: 'Inovasi, riset & startup.' },
  park: { name: 'Taman & Hutan Kota', icon: '🌳', cost: 12, months: 2, upkeep: 0.2, jobs: 1, fx: { green: 6, welfare: 1.5 }, desc: 'Paru-paru kota, menekan polusi.' },
  resort: { name: 'Resor Wisata', icon: '🏝️', cost: 45, months: 5, upkeep: 0.8, jobs: 5, tour: 1, fx: { green: -1 }, coastal: true, desc: 'Pendapatan pariwisata. Hanya di pesisir.' },
  anticorr: { name: 'Lembaga Anti-Korupsi', icon: '⚖️', cost: 40, months: 5, upkeep: 0.8, jobs: 2, fx: {}, corr: -5, desc: 'Menekan korupsi & kebocoran anggaran.' },
  rail: { name: 'Stasiun Kereta Cepat', icon: '🚄', cost: 55, months: 6, upkeep: 1.0, jobs: 3, dem: 1.2, fx: { infra: 7 }, desc: 'Transportasi massal modern.' },
};

export const POLICIES = [
  { k: 'wajib', name: 'Wajib Belajar 12 Tahun', icon: '📚', cost: 0.0035, fx: { edu: 6, welfare: 2 }, desc: 'Pendidikan gratis untuk semua anak.' },
  { k: 'jkn', name: 'Jaminan Kesehatan Universal', icon: '💊', cost: 0.004, fx: { health: 8, welfare: 3 }, mood: 2, desc: 'Setiap warga dijamin berobat.' },
  { k: 'subsidi', name: 'Subsidi Energi & Pangan', icon: '⛽', cost: 0.006, fx: { welfare: 3 }, mood: 5, infl: -1.5, desc: 'Harga murah, tapi kas terkuras.' },
  { k: 'investasi', name: 'Insentif Investasi Asing', icon: '💼', cost: 0.002, g: 0.8, corr: 4, desc: 'Menarik modal asing; risiko korupsi naik.' },
  { k: 'karbon', name: 'Pajak Karbon', icon: '🌫️', cost: -0.003, fx: { green: 8 }, g: -0.5, mood: -2, desc: 'Menambah pemasukan & menekan polusi, tapi menghambat industri.' },
  { k: 'birokrasi', name: 'Reformasi Birokrasi', icon: '🧾', cost: 0.003, corr: -10, g: 0.2, desc: 'Pemerintah bersih & efisien (efek bertahap).' },
  { k: 'milisi', name: 'Wajib Militer', icon: '🎖️', cost: 0.0015, fx: { sec: 10 }, mood: -4, desc: 'Cadangan militer besar, rakyat kurang senang.' },
  { k: 'digital', name: 'Digitalisasi Pemerintahan', icon: '🖥️', cost: 0.0025, fx: { tech: 6 }, corr: -4, g: 0.3, desc: 'e-Government, layanan cepat & transparan.' },
];

export const BIOME = {
  tropical: { grass: 0x4caf50, hill: 0x2e7d32, sand: 0xe8d9a0, tree: 0x2e8b3a, trunk: 0x6b4a2b, snow: 0 },
  temperate: { grass: 0x7cb342, hill: 0x558b2f, sand: 0xdccb9b, tree: 0x3f8f3a, trunk: 0x6b4a2b, snow: 0 },
  desert: { grass: 0xd8b66a, hill: 0xb98c4a, sand: 0xf0dca0, tree: 0x8a9a3a, trunk: 0x7a5a30, snow: 0 },
  arctic: { grass: 0xdfe9ee, hill: 0xb9c9d2, sand: 0xe9eef0, tree: 0x2f6b4a, trunk: 0x5b4636, snow: 1 },
};

// Event acak. cost dihitung = n * skala ekonomi.
export const EVENTS = [
  {
    id: 'gempa', icon: '🌋', title: 'Gempa Bumi Dahsyat',
    text: S => `Gempa berkekuatan besar mengguncang salah satu provinsi di ${S.cn.name}. Ribuan rumah rusak dan korban berjatuhan. Rakyat menunggu respons Presiden ${S.president}.`,
    w: () => 1.0,
    choices: [
      { label: 'Tanggap darurat penuh', hint: 'Biaya besar • kepuasan naik', cost: 14, run: (S, A) => { A.mood(S, 7); A.shock(S, { name: 'Pemulihan gempa', g: -0.6, left: 3 }); return 'Bantuan penuh dikerahkan. Rakyat menghargai kepemimpinan Anda.'; } },
      { label: 'Bantuan terbatas', hint: 'Hemat • kepuasan turun', cost: 4, run: (S, A) => { A.mood(S, -8); A.shock(S, { name: 'Dampak gempa', g: -1.2, left: 4 }); return 'Respons lambat memicu kritik pedas.'; } },
    ],
  },
  {
    id: 'banjir', icon: '🌊', title: 'Banjir Bandang',
    text: S => `Curah hujan ekstrem memicu banjir besar di ${S.cn.name}. Infrastruktur drainase kewalahan.`,
    w: S => 0.8 + (60 - S.idx.infra) / 80,
    choices: [
      { label: 'Normalisasi sungai & tanggul', hint: 'Infrastruktur naik', cost: 12, run: (S, A) => { A.idxBoost(S, 'infra', 3); A.mood(S, 3); return 'Proyek pengendali banjir dimulai.'; } },
      { label: 'Bantuan logistik saja', hint: 'Murah', cost: 3, run: (S, A) => { A.mood(S, -3); A.shock(S, { name: 'Kerusakan banjir', g: -0.5, left: 3 }); return 'Korban terbantu, tapi masalah menahun tetap.'; } },
    ],
  },
  {
    id: 'krisis', icon: '📉', title: 'Krisis Ekonomi Global',
    text: S => `Pasar keuangan dunia anjlok. Ekspor ${S.cn.name} merosot dan investor menarik dana.`,
    w: () => 0.55,
    choices: [
      { label: 'Paket stimulus fiskal', hint: 'Biaya besar • dampak ringan', cost: 22, run: (S, A) => { A.shock(S, { name: 'Krisis global', g: -1.5, left: 6 }); A.mood(S, 2); return 'Stimulus menahan dampak krisis.'; } },
      { label: 'Pengetatan anggaran', hint: 'Hemat • resesi dalam', cost: 0, run: (S, A) => { A.shock(S, { name: 'Resesi global', g: -4, infl: 0.5, left: 8 }); A.mood(S, -6); return 'Ekonomi terpukul keras, rakyat mengeluh.'; } },
    ],
  },
  {
    id: 'pandemi', icon: '🦠', title: 'Wabah Penyakit Menular',
    text: S => `Virus baru menyebar cepat di ${S.cn.name}. Rumah sakit mulai penuh.`,
    w: S => 0.5 + (60 - S.idx.health) / 90,
    choices: [
      { label: 'Vaksinasi massal', hint: 'Biaya besar • aman', cost: 18, run: (S, A) => { A.idxBoost(S, 'health', 3); A.shock(S, { name: 'Wabah terkendali', g: -0.8, left: 3 }); A.mood(S, 3); return 'Wabah berhasil dikendalikan.'; } },
      { label: 'Karantina wilayah', hint: 'Ekonomi terhenti sementara', cost: 6, run: (S, A) => { A.shock(S, { name: 'Karantina', g: -3.5, left: 4 }); A.mood(S, -2); return 'Wabah tertahan namun ekonomi lesu.'; } },
      { label: 'Biarkan berjalan', hint: 'Gratis • sangat berisiko', cost: 0, run: (S, A) => { A.idxBoost(S, 'health', -6); A.mood(S, -12); A.shock(S, { name: 'Wabah meluas', g: -2, left: 6 }); S.pop *= 0.999; return 'Korban jiwa bertambah. Rakyat marah.'; } },
    ],
  },
  {
    id: 'demo', icon: '✊', title: 'Demonstrasi Besar',
    text: S => `Ribuan mahasiswa dan buruh turun ke jalan di ${S.cn.capital} menuntut perbaikan ekonomi dan pemberantasan korupsi.`,
    w: S => 0.6 + Math.max(0, 55 - S.approval) / 40 + S.corruption / 150,
    choices: [
      { label: 'Dialog terbuka', hint: 'Kepuasan naik', cost: 2, run: (S, A) => { A.mood(S, 5); A.corr(S, -2); return 'Dialog meredam situasi.'; } },
      { label: 'Tindakan tegas aparat', hint: 'Keamanan naik • rakyat benci', cost: 0, run: (S, A) => { A.mood(S, -10); A.idxBoost(S, 'sec', 2); return 'Massa bubar, namun luka sosial tersisa.'; } },
    ],
  },
  {
    id: 'minyak', icon: '🛢️', title: 'Cadangan Minyak & Gas Ditemukan',
    text: S => `Eksplorasi menemukan cadangan energi raksasa di wilayah ${S.cn.name}!`,
    w: S => 0.2 + S.cn.res * 0.4,
    choices: [
      { label: 'Kelola oleh BUMN', hint: 'Untung besar • butuh modal', cost: 15, run: (S, A) => { A.shock(S, { name: 'Boom energi', g: 1.8, left: 14 }); A.mood(S, 4); return 'BUMN mengelola ladang baru. Penerimaan negara melonjak!'; } },
      { label: 'Undang investor asing', hint: 'Cepat • bagi hasil kecil', cost: 0, run: (S, A) => { A.shock(S, { name: 'Investasi energi', g: 0.9, left: 12 }); A.corr(S, 3); return 'Investor datang membawa teknologi dan modal.'; } },
    ],
  },
  {
    id: 'skandal', icon: '🕵️', title: 'Skandal Korupsi Menteri',
    text: S => `Media membongkar dugaan korupsi triliunan rupiah yang melibatkan salah satu menteri kabinet ${S.president}.`,
    w: S => 0.3 + S.corruption / 70,
    choices: [
      { label: 'Pecat & serahkan ke penegak hukum', hint: 'Citra membaik', cost: 0, run: (S, A) => { A.mood(S, 6); A.corr(S, -4); return 'Langkah tegas Presiden dipuji publik.'; } },
      { label: 'Tutupi kasus', hint: 'Berisiko', cost: 0, run: (S, A) => { if (Math.random() < 0.5) { A.mood(S, -18); A.corr(S, 5); return 'Kasus bocor! Kepercayaan publik runtuh.'; } A.corr(S, 4); return 'Kasus mereda... untuk sementara.'; } },
    ],
  },
  {
    id: 'festival', icon: '🎉', title: 'Festival Budaya Internasional',
    text: S => `${S.cn.name} dipercaya menjadi tuan rumah festival budaya dunia. Turis berdatangan!`,
    w: S => 0.3 + S.cn.tour * 0.5,
    choices: [
      { label: 'Gelar besar-besaran', hint: 'Pariwisata melonjak', cost: 10, run: (S, A) => { A.shock(S, { name: 'Boom wisata', g: 0.9, left: 6 }); A.mood(S, 6); return 'Festival sukses besar!'; } },
      { label: 'Skala sederhana', hint: 'Hemat', cost: 3, run: (S, A) => { A.mood(S, 2); return 'Festival berjalan lancar.'; } },
    ],
  },
  {
    id: 'terobosan', icon: '🚀', title: 'Terobosan Teknologi',
    text: S => `Peneliti dalam negeri menemukan terobosan penting. Siapa yang akan mengomersialkan?`,
    w: S => 0.1 + S.idx.tech / 150,
    choices: [
      { label: 'Danai hilirisasi', hint: 'Teknologi & ekonomi naik', cost: 12, run: (S, A) => { A.idxBoost(S, 'tech', 5); A.shock(S, { name: 'Inovasi', g: 0.8, left: 8 }); A.mood(S, 3); return 'Startup baru bermunculan.'; } },
      { label: 'Jual lisensi ke asing', hint: 'Pemasukan cepat', cost: -10, run: (S, A) => { A.mood(S, -2); return 'Kas negara bertambah, tetapi nilai tambah mengalir keluar.'; } },
    ],
  },
  {
    id: 'hama', icon: '🐛', title: 'Gagal Panen & Hama',
    text: S => `Serangan hama dan cuaca buruk menggerus hasil panen di ${S.cn.name}. Harga pangan merangkak naik.`,
    w: () => 0.6,
    choices: [
      { label: 'Impor pangan & subsidi petani', hint: 'Inflasi terkendali', cost: 9, run: (S, A) => { A.mood(S, 1); return 'Pasokan aman, harga stabil.'; } },
      { label: 'Biarkan pasar', hint: 'Inflasi naik', cost: 0, run: (S, A) => { A.shock(S, { name: 'Harga pangan', infl: 2.5, left: 6, g: -0.3 }); A.mood(S, -6); return 'Harga pangan melonjak.'; } },
    ],
  },
  {
    id: 'kebakaran', icon: '🔥', title: 'Kebakaran Hutan',
    text: S => `Kebakaran hutan hebat menyelimuti negeri dengan kabut asap tebal.`,
    w: S => 0.3 + (60 - S.idx.green) / 80,
    choices: [
      { label: 'Pemadaman udara & penegakan hukum', hint: 'Lingkungan terjaga', cost: 10, run: (S, A) => { A.idxBoost(S, 'green', 2); A.mood(S, 3); return 'Api dipadamkan, pelaku dijerat hukum.'; } },
      { label: 'Tunggu hujan', hint: 'Gratis • lingkungan rusak', cost: 0, run: (S, A) => { A.idxBoost(S, 'green', -8); A.idxBoost(S, 'health', -3); A.mood(S, -7); return 'Kabut asap mengganggu kesehatan jutaan orang.'; } },
    ],
  },
  {
    id: 'komoditas', icon: '📈', title: 'Lonjakan Harga Komoditas',
    text: S => `Harga komoditas dunia melonjak tajam — berkah bagi eksportir, beban bagi konsumen.`,
    w: S => 0.3 + S.cn.res * 0.4,
    choices: [
      { label: 'Nikmati windfall', hint: 'Kas naik', cost: -14, run: (S, A) => { A.shock(S, { name: 'Harga naik', infl: 1.2, left: 5 }); return 'Kas negara terisi.'; } },
      { label: 'Bagikan ke rakyat', hint: 'Kepuasan naik', cost: -4, run: (S, A) => { A.mood(S, 6); return 'Rakyat menikmati dividen komoditas.'; } },
    ],
  },
  {
    id: 'investor', icon: '🤝', title: 'Tawaran Investor Asing',
    text: S => `Konglomerat global menawarkan investasi pabrik raksasa — dengan syarat keringanan pajak dan perizinan khusus.`,
    w: () => 0.45,
    choices: [
      { label: 'Terima tawaran', hint: 'Ekonomi naik • korupsi naik', cost: -8, run: (S, A) => { A.shock(S, { name: 'Investasi asing', g: 1.0, left: 10 }); A.corr(S, 2); A.mood(S, 1); return 'Investasi mengalir, ribuan lapangan kerja baru.'; } },
      { label: 'Tolak', hint: 'Menjaga kedaulatan', cost: 0, run: (S, A) => { A.mood(S, 2); return 'Rakyat mendukung sikap tegas Anda.'; } },
    ],
  },
  {
    id: 'mogok', icon: '🪧', title: 'Mogok Kerja Nasional',
    text: S => `Serikat buruh mengancam mogok nasional menuntut kenaikan upah minimum.`,
    w: S => 0.3 + S.unemployment / 60,
    choices: [
      { label: 'Naikkan upah minimum', hint: 'Buruh senang • industri tertekan', cost: 5, run: (S, A) => { A.mood(S, 5); A.shock(S, { name: 'Biaya upah', g: -0.4, left: 6 }); return 'Buruh mencabut ancaman mogok.'; } },
      { label: 'Tolak tuntutan', hint: 'Produksi terganggu', cost: 0, run: (S, A) => { A.mood(S, -5); A.shock(S, { name: 'Mogok', g: -1.2, left: 3 }); return 'Mogok melumpuhkan pabrik selama beberapa pekan.'; } },
    ],
  },
  {
    id: 'siber', icon: '💻', title: 'Serangan Siber Nasional',
    text: S => `Peretas melumpuhkan sistem perbankan dan layanan publik ${S.cn.name}.`,
    w: S => 0.25 + (S.idx.tech > 50 ? 0.25 : 0),
    choices: [
      { label: 'Bentuk Badan Siber Nasional', hint: 'Teknologi naik', cost: 10, run: (S, A) => { A.idxBoost(S, 'tech', 3); A.mood(S, 2); return 'Sistem dipulihkan dan diperkuat.'; } },
      { label: 'Pulihkan seadanya', hint: 'Murah', cost: 2, run: (S, A) => { A.shock(S, { name: 'Gangguan siber', g: -0.6, left: 3 }); A.mood(S, -4); return 'Layanan lambat pulih.'; } },
    ],
  },
  {
    id: 'badai', icon: '🌀', title: 'Badai Tropis',
    text: S => `Badai besar menghantam wilayah pesisir ${S.cn.name}.`,
    w: S => 0.55,
    choices: [
      { label: 'Evakuasi & bantuan', hint: 'Kepuasan naik', cost: 8, run: (S, A) => { A.mood(S, 4); return 'Evakuasi berjalan lancar, korban minim.'; } },
      { label: 'Tanggapan standar', hint: 'Hemat', cost: 2, run: (S, A) => { A.mood(S, -3); A.shock(S, { name: 'Dampak badai', g: -0.5, left: 3 }); return 'Kerusakan cukup parah.'; } },
    ],
  },
  {
    id: 'kekeringan', icon: '☀️', title: 'Kekeringan Panjang',
    text: S => `Musim kemarau ekstrem membuat waduk menyusut dan sawah gagal.`,
    w: S => 0.45,
    choices: [
      { label: 'Bangun irigasi & hujan buatan', hint: 'Efektif', cost: 9, run: (S, A) => { A.idxBoost(S, 'infra', 1); A.mood(S, 2); return 'Pasokan air terjaga.'; } },
      { label: 'Imbau hemat air', hint: 'Gratis', cost: 0, run: (S, A) => { A.shock(S, { name: 'Kekeringan', g: -0.7, infl: 0.8, left: 5 }); A.mood(S, -4); return 'Panen gagal di banyak daerah.'; } },
    ],
  },
];
