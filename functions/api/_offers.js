// ---------------------------------------------------------------------------
// Mobplus PIN API — offers en geo's.
//
// Dit bestand is de enige plek waar per-offer waarden staan. De Worker gebruikt
// het als allowlist: een offer_id dat hier niet in staat wordt geweigerd. Dat is
// belangrijk, want de Worker zet jouw token onder elk verzoek dat hij doorlaat.
// Zonder allowlist kan iedereen die je Worker-domein vindt jouw token op
// willekeurige offers afvuren.
// ---------------------------------------------------------------------------

// Nummerplannen per land. cc = landnummer, nsnLen = aantal cijfers na het
// landnummer, nsnPrefix = eerste cijfer(s) van een mobiel nummer.
//
// Deze regels zijn een eerste versie op basis van de publieke nummerplannen.
// Zet STRICT_PREFIX op "0" in wrangler.jsonc zodra blijkt dat een carrier ook
// prefixen gebruikt die hier niet in staan; een te strenge regel weigert echte
// bezoekers en dat zie je terug als een CR die inzakt.
export const GEOS = {
  KW: { name: 'Kuwait',      cc: '965', nsnLen: 8,  nsnPrefix: '[569]'  },
  AE: { name: 'UAE',         cc: '971', nsnLen: 9,  nsnPrefix: '5'      },
  SA: { name: 'Saudi Arabia',cc: '966', nsnLen: 9,  nsnPrefix: '5'      },
  OM: { name: 'Oman',        cc: '968', nsnLen: 8,  nsnPrefix: '[79]'   },
  QA: { name: 'Qatar',       cc: '974', nsnLen: 8,  nsnPrefix: '[3567]' },
  LK: { name: 'Sri Lanka',   cc: '94',  nsnLen: 9,  nsnPrefix: '7'      },
  BD: { name: 'Bangladesh',  cc: '880', nsnLen: 10, nsnPrefix: '1'      },
  JO: { name: 'Jordan',      cc: '962', nsnLen: 9,  nsnPrefix: '7'      },
};

// De offers. `payout`, `cr` en `epc` komen uit de Mobplus-mail van 18-08-2026
// en zijn alleen ter prioritering — ze doen niets in de code.
//
// `pinLength`, `price`, `unsub` en `service` staan op null zolang de AM ze niet
// heeft doorgegeven. De Worker draait daar prima mee door; de landingspagina
// niet, want die moet de prijs en de afmeldinstructie tonen. `npm run doctor`
// laat zien welke velden nog open staan.
export const OFFERS = {
  // --- Testoffer, aangeleverd door de AM op 19-08-2026 ----------------------
  // Hiermee wordt de koppeling end-to-end gecontroleerd. De AM leverde de
  // endpoints op m.bolo2vas91.click, niet op de m.vasvas.click uit de
  // handleiding; dat adres staat daarom in PIN_BASE_URL en niet in de code.
  '305187': {
    name: 'Funny Games-LK-Mobitel-PIN API',
    geo: 'LK', carrier: 'Mobitel',
    service: 'Funny Games',
    pinLength: 6,
    price: '10 LKR/day',
    unsub: 'Send C FG to 32565',
    shortcode: '32565',
    payout: 0.35, cr: null, epc: null,
    cap: 400,
  },

  // --- Top offers uit de mail van 18-08-2026, gesorteerd op EPC ------------
  // Compleet: gegevens van de offerpagina (18-08-2026). Let op de merknaam —
  // de offer heet 'Salini' bij Mobplus, maar de door de carrier goedgekeurde
  // disclaimer spreekt van 'Salni'. Op de pagina staat de tekst van de carrier.
  '301490': {
    name: 'Salini-KW-Zain-PIN API',
    geo: 'KW', carrier: 'Zain',
    service: 'Salni',
    pinLength: 5,
    price: '3 KWD/day',
    unsub: 'Send Unsub M1 to 95437',
    shortcode: '95437',
    payout: 3.50, cr: 13.44, epc: 0.4704,
  },
  '314200': { name: 'Games Joy-KW-ZAIN-M-PINAPI',          geo: 'KW', carrier: 'Zain',    service: 'Games Joy',         pinLength: null, price: null, unsub: null, payout: 3.50, cr: 12.39, epc: 0.4336 },
  '301062': { name: 'Kidzzy-KW-Ooredoo-M-PIN API',         geo: 'KW', carrier: 'Ooredoo', service: 'Kidzzy',            pinLength: null, price: null, unsub: null, payout: 3.50, cr: 10.59, epc: 0.3706 },
  '293705': { name: 'Jeoreis-AE-Etisalat-PIN API',         geo: 'AE', carrier: 'Etisalat',service: 'Jeoreis',           pinLength: null, price: null, unsub: null, payout: 2.90, cr: 12.76, epc: 0.3701 },
  '303348': { name: 'NEW Fantasy Sports-SA-Lebara-PIN API',geo: 'SA', carrier: 'Lebara',  service: 'Fantasy Sports',    pinLength: null, price: null, unsub: null, payout: 2.00, cr: 16.98, epc: 0.3396 },
  '312732': { name: 'Cricket Fantasy-KSA-Mobily-M-PIN API',geo: 'SA', carrier: 'Mobily',  service: 'Cricket Fantasy',   pinLength: null, price: null, unsub: null, payout: 2.00, cr: 13.51, epc: 0.2703 },
  '213822': { name: 'SA(989)-Mobily-PIN API',              geo: 'SA', carrier: 'Mobily',  service: 'SA 989',            pinLength: null, price: null, unsub: null, payout: 2.00, cr: 11.67, epc: 0.2333 },
  '306926': { name: 'Dimin-OM-Omantel-PIN-API',            geo: 'OM', carrier: 'Omantel', service: 'Dimin',             pinLength: null, price: null, unsub: null, payout: 2.20, cr: 10.21, epc: 0.2247 },
  '308450': { name: 'Comedybox-KW-Zain-M-PIN API',         geo: 'KW', carrier: 'Zain',    service: 'Comedybox',         pinLength: null, price: null, unsub: null, payout: 3.50, cr: 6.13,  epc: 0.2145 },
  '313864': { name: 'Ai Student HUB-SA-Mobily-M-PINAPI',   geo: 'SA', carrier: 'Mobily',  service: 'AI Student HUB',    pinLength: null, price: null, unsub: null, payout: 2.20, cr: 8.26,  epc: 0.1818 },
  '280229': { name: 'ZD Dbay-QA-Ooredoo-M-PIN API',        geo: 'QA', carrier: 'Ooredoo', service: 'ZD Dbay',           pinLength: null, price: null, unsub: null, payout: 2.50, cr: 7.03,  epc: 0.1757 },
  '311877': { name: 'Gulfgamez-QA-Vodafone-M-PIN API',     geo: 'QA', carrier: 'Vodafone',service: 'Gulfgamez',         pinLength: null, price: null, unsub: null, payout: 2.30, cr: 7.12,  epc: 0.1637 },
  '313704': { name: 'Gamify-KW-STC-M-API PIN',             geo: 'KW', carrier: 'STC',     service: 'Gamify',            pinLength: null, price: null, unsub: null, payout: 3.50, cr: 4.39,  epc: 0.1537 },
  '279771': { name: 'Firegames-AE-Etisalat-M-PIN API',     geo: 'AE', carrier: 'Etisalat',service: 'Firegames',         pinLength: null, price: null, unsub: null, payout: 4.00, cr: 3.25,  epc: 0.1299 },
  '301998': { name: 'Zeen Cafe-OM-Omantel-M-PIN API',      geo: 'OM', carrier: 'Omantel', service: 'Zeen Cafe',         pinLength: null, price: null, unsub: null, payout: 2.20, cr: 5.11,  epc: 0.1124 },
  '266305': { name: 'Game-OM-Omantel-PIN-API',             geo: 'OM', carrier: 'Omantel', service: 'Game',              pinLength: null, price: null, unsub: null, payout: 2.20, cr: 5.04,  epc: 0.1108 },
  '312676': { name: 'ZeroPoint-OM-Vodafone-M-PIN API',     geo: 'OM', carrier: 'Vodafone',service: 'ZeroPoint',         pinLength: null, price: null, unsub: null, payout: 2.20, cr: 4.89,  epc: 0.1075 },
  '290947': { name: 'Globalonegaming-QA-Ooredoo-M-PIN API',geo: 'QA', carrier: 'Ooredoo', service: 'Globalonegaming',   pinLength: null, price: null, unsub: null, payout: 2.30, cr: 3.63,  epc: 0.0834 },
  '271148': { name: 'Hangout-OM-Omantel-PIN API',          geo: 'OM', carrier: 'Omantel', service: 'Hangout',           pinLength: null, price: null, unsub: null, payout: 2.40, cr: 3.39,  epc: 0.0814 },
  '313706': { name: 'Gamify-KW-Ooredoo-M-API PIN',         geo: 'KW', carrier: 'Ooredoo', service: 'Gamify',            pinLength: null, price: null, unsub: null, payout: 3.50, cr: 2.30,  epc: 0.0806 },
};

// Regex waarmee een volledig internationaal nummer wordt gecontroleerd.
// strictPrefix=false laat het eerste cijfer vrij; dat is de ontsnapping als
// een carrier prefixen blijkt te gebruiken die niet in GEOS staan.
export function msisdnPattern(geo, strictPrefix = true) {
  const g = GEOS[geo];
  if (!g) return /^\d{10,15}$/;
  const head = strictPrefix && g.nsnPrefix ? g.nsnPrefix : '\\d';
  return new RegExp(`^${g.cc}${head}\\d{${g.nsnLen - 1}}$`);
}

// Maakt van wat de bezoeker intypt een nummer zoals de carrier het wil zien.
// Bezoekers typen hun nummer zoals ze het kennen: met +, met spaties, of
// nationaal met een 0 ervoor. Dat zonder meer doorsturen kost conversies, dus
// halen we het hier uit elkaar in plaats van de bezoeker te laten puzzelen.
export function normalizeMsisdn(raw, geo) {
  let n = String(raw || '').replace(/[^\d]/g, '');
  const g = GEOS[geo];
  if (!g) return n;
  if (n.startsWith('00' + g.cc)) n = n.slice(2);           // 0094... -> 94...
  else if (n.startsWith(g.cc) && n.length === g.cc.length + g.nsnLen) return n;
  else if (n.startsWith('0') && n.length === g.nsnLen + 1) n = g.cc + n.slice(1); // 077... -> 9477...
  else if (n.length === g.nsnLen) n = g.cc + n;            // kaal nationaal nummer
  return n;
}
