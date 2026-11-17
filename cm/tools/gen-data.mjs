// Menghasilkan data awal ±250 negara/teritori (data permainan, bukan data resmi)
import fs from 'node:fs';
const ml = JSON.parse(fs.readFileSync(process.argv[2]));
const pops = JSON.parse(fs.readFileSync(process.argv[3]));
const popBy = new Map(pops.map(p => [p.country.toLowerCase(), p.population]));
const ID = { ID:'Indonesia',US:'Amerika Serikat',CN:'Tiongkok',IN:'India',JP:'Jepang',DE:'Jerman',GB:'Inggris',FR:'Prancis',IT:'Italia',ES:'Spanyol',RU:'Rusia',BR:'Brasil',CA:'Kanada',AU:'Australia',KR:'Korea Selatan',KP:'Korea Utara',MX:'Meksiko',SA:'Arab Saudi',TR:'Turki',EG:'Mesir',ZA:'Afrika Selatan',NG:'Nigeria',AR:'Argentina',NL:'Belanda',CH:'Swiss',SE:'Swedia',NO:'Norwegia',DK:'Denmark',FI:'Finlandia',PL:'Polandia',BE:'Belgia',AT:'Austria',GR:'Yunani',PT:'Portugal',IE:'Irlandia',UA:'Ukraina',MY:'Malaysia',SG:'Singapura',TH:'Thailand',VN:'Vietnam',PH:'Filipina',MM:'Myanmar',KH:'Kamboja',LA:'Laos',BN:'Brunei',TL:'Timor Leste',PK:'Pakistan',BD:'Bangladesh',LK:'Sri Lanka',NP:'Nepal',IR:'Iran',IQ:'Irak',IL:'Israel',AE:'Uni Emirat Arab',QA:'Qatar',KW:'Kuwait',JO:'Yordania',LB:'Lebanon',SY:'Suriah',YE:'Yaman',AF:'Afganistan',NZ:'Selandia Baru',CL:'Cile',CO:'Kolombia',PE:'Peru',VE:'Venezuela',CU:'Kuba',MA:'Maroko',DZ:'Aljazair',LY:'Libya',TN:'Tunisia',ET:'Etiopia',KE:'Kenya',GH:'Ghana',TZ:'Tanzania',UG:'Uganda',SD:'Sudan',AO:'Angola',CD:'Kongo (DRC)',CZ:'Ceko',HU:'Hungaria',RO:'Rumania',BG:'Bulgaria',RS:'Serbia',HR:'Kroasia',SK:'Slovakia',KZ:'Kazakhstan',UZ:'Uzbekistan',MN:'Mongolia',TW:'Taiwan',HK:'Hong Kong',MO:'Makau',VA:'Vatikan',PS:'Palestina',EC:'Ekuador',BO:'Bolivia',UY:'Uruguay',PY:'Paraguay',IS:'Islandia',LU:'Luksemburg',MT:'Malta',CY:'Siprus',MV:'Maladewa',BT:'Bhutan',PG:'Papua Nugini',FJ:'Fiji',GL:'Greenland' };
const FX = { USD:1,EUR:.92,GBP:.79,JPY:150,CNY:7.2,INR:83,IDR:15800,KRW:1330,AUD:1.52,CAD:1.36,CHF:.88,BRL:5,MXN:17.2,RUB:92,TRY:30,SAR:3.75,AED:3.67,ZAR:18.7,NGN:900,EGP:31,ARS:830,SGD:1.34,MYR:4.7,THB:35.5,VND:24500,PHP:56,PKR:280,BDT:110,SEK:10.5,NOK:10.6,DKK:6.9,PLN:4,CZK:23,HUF:360,ILS:3.7,NZD:1.63,CLP:900,COP:3950,PEN:3.75,KES:150,GHS:12,MAD:10,DZD:135,QAR:3.64,KWD:.31,HKD:7.8,TWD:31.5,UAH:37 };
const PC = { 'Northern Europe':45000,'Western Europe':52000,'Southern Europe':30000,'Eastern Europe':16000,'Northern America':60000,'Australia and New Zealand':50000,'Eastern Asia':25000,'South-Eastern Asia':6000,'Southern Asia':2500,'Western Asia':14000,'Central Asia':4500,'Northern Africa':4500,'Western Africa':2000,'Middle Africa':1800,'Eastern Africa':1600,'Southern Africa':5000,'South America':9000,'Central America':7000,'Caribbean':9000,'Melanesia':3500,'Micronesia':6000,'Polynesia':6000 };
const GDPO = { US:27000,CN:17800,DE:4500,JP:4200,IN:3600,GB:3300,FR:3000,IT:2200,BR:2100,CA:2100,RU:2000,KR:1700,AU:1700,MX:1800,ES:1500,ID:1400,NL:1100,SA:1100,TR:1100,CH:900,PL:810,TW:760,BE:630,AR:640,SE:590,IE:550,AT:520,TH:510,IL:510,SG:500,AE:510,NO:480,PH:440,VN:430,MY:400,EG:400,NG:400,ZA:380,BD:440,DK:400,HK:380,CO:360,CL:340,FI:300,RO:350,CZ:330,PT:290,PK:340,IR:400,IQ:260,PE:260,NZ:250,GR:240,QA:220,KZ:260,DZ:240,HU:210,KW:160,MA:140,ET:160,KE:110,UA:160,LK:84,BN:15 };
const OIL = ['SA','RU','US','IQ','IR','AE','KW','QA','NG','DZ','LY','AO','VE','NO','KZ','MX','CA','BR','GA','CG','GQ'];
const OPEC = ['SA','IQ','IR','AE','KW','NG','DZ','LY','AO','VE','GA','CG','GQ'];
const EU = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');
const NATO = 'US CA GB FR DE IT ES NL BE LU NO DK IS PT PL CZ HU RO BG SK SI HR AL ME MK EE LV LT TR GR FI SE'.split(' ');
const ASEAN = 'ID MY SG TH VN PH MM KH LA BN'.split(' ');
const G20 = 'AR AU BR CA CN FR DE IN ID IT JP KR MX RU SA ZA TR GB US'.split(' ');
const BRICS = 'BR RU IN CN ZA EG ET IR AE ID'.split(' ');
const TZ = { ID:7,CN:8,IN:5.5,RU:3,US:-5,BR:-3,AU:10,CA:-5,MX:-6,AR:-3,JP:9,KR:9,NP:5.75,AF:4.5,IR:3.5,MM:6.5,LK:5.5,PK:5,BD:6,TH:7,VN:7,MY:8,SG:8,PH:8,TR:3,SA:3,EG:2,NG:1,ZA:2,KE:3,ET:3,GB:0,FR:1,DE:1,IT:1,ES:1,NZ:12,CL:-4,CO:-5,PE:-5,VE:-4,KZ:5,UZ:5,MN:8,TW:8,HK:8 };
const out = [];
for (const c of ml) {
  if (c.region === 'Antarctic') continue;
  const code = c.cca2, name = ID[code] || c.name.common;
  const ce = Object.entries(c.currencies || {}); const cur = ce[0] || ['USD', { symbol: '$' }];
  const area = c.area || 100;
  let pop = popBy.get(c.name.common.toLowerCase()) || popBy.get((c.name.official || '').toLowerCase());
  if (!pop) pop = Math.max(2000, Math.round(Math.min(area * 30, 3e6)));
  const pc = (PC[c.subregion] || 8000) * (0.55 + (((code.charCodeAt(0) * 31 + code.charCodeAt(1) * 17) % 100) / 100) * 1.1);
  const gdp = GDPO[code] || Math.max(0.05, +(pop * pc / 1e9).toFixed(2));
  out.push({ c: code, n: name, r: c.region, s: c.subregion || '', la: c.latlng?.[0] ?? 0, lo: c.latlng?.[1] ?? 0, f: c.flag, cu: cur[0], sy: cur[1].symbol || cur[0], fx: FX[cur[0]] || +(20 + ((code.charCodeAt(0) * 7 + code.charCodeAt(1) * 13) % 400)).toFixed(1), tz: TZ[code] ?? Math.max(-11, Math.min(12, Math.round((c.latlng?.[1] ?? 0) / 15))), pop, gdp, un: c.unMember ? 1 : 0, ind: c.independent ? 1 : 0, oil: OIL.includes(code) ? 1 : 0 });
}
const groups = { OPEC, EU, NATO, ASEAN, G20, BRICS, AU: out.filter(x => x.r === 'Africa' && x.ind).map(x => x.c) };
const REG = [...new Set(out.map(x => x.r))], SUB = [...new Set(out.map(x => x.s))];
const rows = out.map(x => [x.c, x.n, REG.indexOf(x.r), SUB.indexOf(x.s), +x.la.toFixed(1), +x.lo.toFixed(1), x.cu, x.sy, x.fx, x.tz, x.pop, x.gdp, x.oil, x.un, x.ind]);
fs.writeFileSync(process.argv[4], `// Data awal permainan (tools/gen-data.mjs) - angka simulasi
const REG = ${JSON.stringify(REG)}, SUB = ${JSON.stringify(SUB)};
const ROWS = ${JSON.stringify(rows)};
const fl = (c) => String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
export const SEED = ROWS.map(([c, n, r, s, la, lo, cu, sy, fx, tz, pop, gdp, oil, un, ind]) => ({ c, n, r: REG[r], s: SUB[s], la, lo, f: fl(c), cu, sy, fx, tz, pop, gdp, oil, un, ind }));
export const GROUPS = ${JSON.stringify(groups)};
`);
console.log(out.length);
