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
import { OFFERS, GEOS } from '../functions/api/_offers.js';

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..');
const blokkerend = [];
const waarschuwing = [];

// --- 1. Pages-configuratie ------------------------------------------------

const wPad = join(wortel, 'wrangler.jsonc');
if (!existsSync(wPad)) {
  waarschuwing.push('wrangler.jsonc ontbreekt — bindings en vars staan dan alleen in het dashboard en zijn niet versiebeheerd.');
} else {
  const ruw = readFileSync(wPad, 'utf8');
  const zonderCommentaar = ruw.replace(/^\s*\/\/.*$/gm, '');
  const cfg = JSON.parse(zonderCommentaar);
  if (cfg.name !== 'pin') blokkerend.push(`wrangler.jsonc: name is "${cfg.name}" maar het Pages-project heet "pin".`);
  if (cfg.main) blokkerend.push('wrangler.jsonc: "main" hoort hier niet — dit is een Pages-project, de API zit in functions/.');
  if (!cfg.pages_build_output_dir) blokkerend.push('wrangler.jsonc: pages_build_output_dir ontbreekt.');
  if (!cfg.vars?.AFF_ID || cfg.vars.AFF_ID.startsWith('VUL_')) blokkerend.push('wrangler.jsonc: AFF_ID is nog niet ingevuld.');
  if (!/kv_namespaces/.test(zonderCommentaar)) {
    waarschuwing.push('Geen KV-namespace gekoppeld: de snelheidslimiet staat uit. Iedereen die het domein kent kan sms\'jes laten sturen op jouw account.');
  }
}

// De functions-map is het instappunt; zonder deze bestanden bestaat /api/ niet.
for (const f of ['functions/api/[[path]].js', 'functions/api/_pinapi.js', 'functions/api/_offers.js', 'functions/_middleware.js']) {
  if (!existsSync(join(wortel, f))) blokkerend.push(`${f} ontbreekt — /api/* werkt dan niet.`);
}

// Zonder _routes.json draait de function op elk verzoek, ook op de duizenden
// statische LP-bestanden. Dat is trager en duurder dan nodig.
const rPad = join(wortel, '_routes.json');
if (!existsSync(rPad)) {
  waarschuwing.push('_routes.json ontbreekt: de function draait dan op elk verzoek, ook op statische pagina\'s.');
} else {
  const routes = JSON.parse(readFileSync(rPad, 'utf8'));
  if (!routes.include?.includes('/api/*')) blokkerend.push('_routes.json bevat "/api/*" niet — de API wordt dan nooit aangeroepen.');
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
  // Zonder successUrl eindigt de bezoeker op een leeg bedanktscherm terwijl hij
  // net een abonnement heeft genomen. Dat levert afmeldingen en klachten op.
  if (!/successUrl/.test(html)) {
    waarschuwing.push(`lp/${naam}: geen successUrl — na activatie blijft de bezoeker op het bedanktscherm hangen. Vraag de portal-URL op bij de AM.`);
  }

  const openstaand = (html.match(/AAN_TE_VULLEN/g) || []).length;
  if (openstaand) {
    blokkerend.push(`lp/${naam}: ${openstaand}× AAN_TE_VULLEN — prijs of afmeldinstructie ontbreekt nog. De carrier keurt de pagina zo af.`);
  }
}

// --- 2b. pre-landers: gaat de cid mee? -------------------------------------

// Een pre-lander kan op twee manieren doorsturen:
//
//  1. via de click-URL van Bemob — dan regelt Bemob de cid zelf en hoeft hier
//     niets bijzonders te gebeuren;
//  2. rechtstreeks naar de PIN-pagina — dan moet de cid mee via data-pin-cta en
//     passcid.js, anders valt hij weg.
//
// Die tweede is de stilste fout in deze opzet: de flow werkt, de conversie
// wordt geactiveerd, maar de postback komt bij Bemob aan zonder click-id en kan
// nergens aan gekoppeld worden.
for (const { naam } of paginas) {
  const map = join(lpWortel, naam);
  for (const bestand of readdirSync(map)) {
    if (!bestand.endsWith('.html') || bestand === 'index.html') continue;
    const html = readFileSync(join(map, bestand), 'utf8');
    const linktNaarPin = new RegExp(`href=["']/lp/${naam}/["']`).test(html);
    const linktNaarTracker = /href=["']https?:\/\/[^"']*bemobtrk\.com\/click/.test(html);

    if (!linktNaarPin && !linktNaarTracker) {
      blokkerend.push(`lp/${naam}/${bestand}: geen werkende CTA — hij linkt niet naar de click-URL van Bemob en ook niet naar de PIN-pagina.`);
      continue;
    }
    if (!linktNaarPin) continue;   // gaat via Bemob, dat regelt de cid zelf

    if (!/data-pin-cta/.test(html)) {
      blokkerend.push(`lp/${naam}/${bestand}: linkt naar de PIN-pagina zonder data-pin-cta — de cid gaat verloren en de postback kan niet gekoppeld worden.`);
    }
    if (!/passcid\.js/.test(html)) {
      blokkerend.push(`lp/${naam}/${bestand}: laadt /lp/_shared/passcid.js niet — data-pin-cta doet dan niets.`);
    }
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
