#!/usr/bin/env node
// ---------------------------------------------------------------------------
// doctor.mjs — controleert de PIN API-opzet zonder iets te versturen.
//
//   node tools/doctor.mjs
//
// Draai dit voor elke deploy, en zeker nadat er een nieuwe landingspagina bij
// is gekomen. Het vangt de fouten die je pas ziet als er al verkeer op staat:
// een offer_id dat niet bestaat, een verkeerd aantal pincijfers, of een prijs
// die nog niet is ingevuld.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OFFERS, GEOS } from '../src/offers.js';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..');
const blokkerend = [];
const waarschuwing = [];

// --- 1. wrangler.jsonc -----------------------------------------------------

const wPad = join(wortel, 'wrangler.jsonc');
if (!existsSync(wPad)) {
  blokkerend.push('wrangler.jsonc ontbreekt — zonder dat bestand draait de Worker zonder "main" en bestaat /api/pin/* niet.');
} else {
  const ruw = readFileSync(wPad, 'utf8');
  const cfg = JSON.parse(ruw.replace(/^\s*\/\/.*$/gm, ''));
  if (cfg.name !== 'pin') blokkerend.push(`wrangler.jsonc: name is "${cfg.name}" maar moet "pin" zijn, anders ontstaat er een tweede Worker.`);
  if (!cfg.main) blokkerend.push('wrangler.jsonc: "main" ontbreekt — dan worden alleen bestanden geserveerd.');
  if (!cfg.vars?.AFF_ID || cfg.vars.AFF_ID.startsWith('VUL_')) blokkerend.push('wrangler.jsonc: AFF_ID is nog niet ingevuld.');
  if (!/kv_namespaces/.test(ruw.replace(/^\s*\/\/.*$/gm, ''))) {
    waarschuwing.push('Geen KV-namespace gekoppeld: de snelheidslimiet staat uit. Iedereen die het domein kent kan sms\'jes laten sturen op jouw account.');
  }
  if (!existsSync(join(wortel, '.assetsignore'))) {
    blokkerend.push('.assetsignore ontbreekt — src/worker.js is dan publiek op te vragen in de browser.');
  } else {
    const ai = readFileSync(join(wortel, '.assetsignore'), 'utf8');
    if (!/^src$/m.test(ai)) blokkerend.push('.assetsignore bevat geen regel "src" — de Worker-broncode is dan publiek.');
  }
}

// --- 2. landingspagina's ---------------------------------------------------

const lpWortel = join(wortel, 'lp');
const paginas = [];
if (existsSync(lpWortel)) {
  for (const naam of readdirSync(lpWortel)) {
    if (naam.startsWith('_')) continue;
    const pad = join(lpWortel, naam, 'index.html');
    if (existsSync(pad) && statSync(pad).isFile()) paginas.push({ naam, pad });
  }
}

if (paginas.length === 0) waarschuwing.push('Geen landingspagina\'s gevonden in lp/.');

for (const { naam, pad } of paginas) {
  const html = readFileSync(pad, 'utf8');

  const mOffer = html.match(/offerId:\s*'([^']+)'/);
  const mGeo = html.match(/geo:\s*'([^']+)'/);
  const mPin = html.match(/pinLength:\s*(\d+)/);

  if (!mOffer) { blokkerend.push(`lp/${naam}: geen offerId in PIN_CONFIG.`); continue; }
  const offerId = mOffer[1];
  const offer = OFFERS[offerId];

  if (!offer) {
    blokkerend.push(`lp/${naam}: offer ${offerId} staat niet in src/offers.js — de Worker weigert dit verzoek.`);
    continue;
  }
  if (mGeo && mGeo[1] !== offer.geo) {
    blokkerend.push(`lp/${naam}: geo '${mGeo[1]}' klopt niet met offers.js ('${offer.geo}') — nummers worden dan verkeerd gecontroleerd.`);
  }
  if (mGeo && !GEOS[mGeo[1]]) {
    blokkerend.push(`lp/${naam}: geo '${mGeo[1]}' bestaat niet in GEOS.`);
  }
  if (offer.pinLength && mPin && Number(mPin[1]) !== offer.pinLength) {
    blokkerend.push(`lp/${naam}: pinLength ${mPin[1]} wijkt af van offers.js (${offer.pinLength}).`);
  }
  if (!offer.pinLength) {
    waarschuwing.push(`lp/${naam}: pinLength van offer ${offerId} is nog niet bevestigd bij de AM (staat nu op ${mPin ? mPin[1] : '?'}).`);
  }
  if (!/pinflow\.js/.test(html)) {
    blokkerend.push(`lp/${naam}: laadt /lp/_shared/pinflow.js niet.`);
  }
  for (const id of ['pin-phone', 'pin-msisdn', 'pin-send', 'pin-code', 'pin-boxes', 'pin-verify', 'pin-done', 'pin-error']) {
    if (!new RegExp(`id="${id}"`).test(html)) blokkerend.push(`lp/${naam}: element met id="${id}" ontbreekt.`);
  }
  const openstaand = (html.match(/AAN_TE_VULLEN/g) || []).length;
  if (openstaand) {
    blokkerend.push(`lp/${naam}: ${openstaand}× AAN_TE_VULLEN — prijs of afmeldinstructie ontbreekt nog. De carrier keurt de pagina zo af.`);
  }
}

// --- 3. offers zonder complete gegevens ------------------------------------

const onvolledig = Object.entries(OFFERS)
  .filter(([, o]) => !o.pinLength || !o.price || !o.unsub)
  .map(([id, o]) => `${id} ${o.name}`);

// --- rapport ---------------------------------------------------------------

console.log('\nPIN API — controle\n' + '='.repeat(60));
console.log(`offers in register : ${Object.keys(OFFERS).length}`);
console.log(`landingspagina's   : ${paginas.length}${paginas.length ? ' (' + paginas.map(p => p.naam).join(', ') + ')' : ''}`);
console.log(`offers incompleet  : ${onvolledig.length} van ${Object.keys(OFFERS).length}`);

if (blokkerend.length) {
  console.log('\nBLOKKEREND — dit moet opgelost voor je verkeer stuurt:');
  blokkerend.forEach(r => console.log('  ✗ ' + r));
}
if (waarschuwing.length) {
  console.log('\nLET OP:');
  waarschuwing.forEach(r => console.log('  ! ' + r));
}
if (onvolledig.length) {
  console.log('\nNog opvragen bij de AM (pinLength / price / unsub), alleen nodig zodra je een LP voor die offer bouwt:');
  onvolledig.slice(0, 8).forEach(r => console.log('  · ' + r));
  if (onvolledig.length > 8) console.log(`  · ... en nog ${onvolledig.length - 8}`);
}
if (!blokkerend.length && !waarschuwing.length) console.log('\nAlles in orde.');

console.log('');
process.exit(blokkerend.length ? 1 : 0);
