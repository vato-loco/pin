// ---------------------------------------------------------------------------
// Tests op de PIN API-function. Draaien zonder netwerk: fetch wordt vervangen, dus er
// gaat nooit een echt verzoek naar de carrier.
//
//   node --test test/
// ---------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afhandelen } from '../functions/api/_pinapi.js';

// --- gereedschap -----------------------------------------------------------

let gezien = [];                       // alle URL's die de Worker upstream aanriep
function stubFetch(antwoord) {
  gezien = [];
  globalThis.fetch = async (url) => {
    gezien.push(String(url));
    return new Response(JSON.stringify(antwoord), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
}

function nepKV() {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } };
}

const ENV = {
  MOBPLUS_TOKEN: 'geheim123',
  AFF_ID: '6293',
  ALLOWED_ORIGINS: 'https://play-center.org',
  STRICT_PREFIX: '1',
};

function req(pad, opties = {}) {
  return new Request('https://play-center.org' + pad, {
    headers: { 'CF-Connecting-IP': '203.0.113.5', 'User-Agent': 'TestUA/1.0', ...(opties.headers || {}) },
  });
}

const roep = (pad, env = ENV, opties) => afhandelen(req(pad, opties), env);

// --- offer-allowlist -------------------------------------------------------

test('onbekend offer wordt geweigerd en bereikt de carrier niet', async () => {
  stubFetch({ stateCode: 0, txid: 'x' });
  const r = await roep('/api/pin/request?offer_id=999999&msisdn=94771234567');
  const d = await r.json();
  assert.equal(r.status, 400);
  assert.equal(d.code, 'onbekend_offer');
  assert.equal(gezien.length, 0, 'er mag niets naar de carrier gaan');
});

// --- nummercontrole en normalisatie ----------------------------------------

test('nationaal nummer met nul ervoor wordt omgezet naar internationaal', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=0771234567');
  const d = await r.json();
  assert.equal(d.success, true);
  assert.equal(d.txid, 'tx1');
  assert.match(gezien[0], /msisdn=94771234567/);
});

test('nummer met plusteken en spaties wordt geaccepteerd', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=' + encodeURIComponent('+94 77 123 4567'));
  assert.equal((await r.json()).success, true);
});

test('nummer uit het verkeerde land wordt geweigerd', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=31612345678');
  const d = await r.json();
  assert.equal(r.status, 400);
  assert.equal(d.code, 'msisdn_ongeldig');
  assert.equal(gezien.length, 0);
});

test('STRICT_PREFIX=0 laat een onbekend mobiel prefix door', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const streng = await roep('/api/pin/request?offer_id=305187&msisdn=94991234567');
  assert.equal(streng.status, 400);

  stubFetch({ stateCode: 0, txid: 'tx1' });
  const los = await roep('/api/pin/request?offer_id=305187&msisdn=94991234567', { ...ENV, STRICT_PREFIX: '0' });
  assert.equal((await los.json()).success, true);
});

// --- token en herkomst van ip/ua -------------------------------------------

test('token gaat mee upstream maar staat niet in het antwoord', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567');
  assert.match(gezien[0], /token=geheim123/);
  assert.match(gezien[0], /\/c\/pin\/305187\/6293/);
  assert.ok(!JSON.stringify(await r.json()).includes('geheim123'));
});

test('ip en ua komen uit de headers, niet uit de querystring', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  await roep('/api/pin/request?offer_id=305187&msisdn=94771234567&ip=1.2.3.4&ua=nep');
  assert.match(gezien[0], /ip=203\.0\.113\.5/);
  assert.ok(!gezien[0].includes('1.2.3.4'), 'opgegeven ip mag niet worden overgenomen');
  assert.match(gezien[0], /ua=TestUA/);
});

test('zonder token weigert de Worker en belt hij de carrier niet', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567', { ...ENV, MOBPLUS_TOKEN: '' });
  assert.equal(r.status, 500);
  assert.equal((await r.json()).code, 'geen_token');
  assert.equal(gezien.length, 0);
});

// --- trackingparameters ----------------------------------------------------

test('cid gaat mee en wordt ontdaan van rare tekens', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  await roep('/api/pin/request?offer_id=305187&msisdn=94771234567&cid=abc123&sc=sub01');
  assert.match(gezien[0], /cid=abc123/);
  assert.match(gezien[0], /sc=sub01/);

  stubFetch({ stateCode: 0, txid: 'tx1' });
  await roep('/api/pin/request?offer_id=305187&msisdn=94771234567&cid=' + encodeURIComponent('a&token=kwaad'));
  const aantalTokens = (gezien[0].match(/token=/g) || []).length;
  assert.equal(aantalTokens, 1, 'via cid mag geen tweede token worden binnengesmokkeld');
});

// --- antwoorden van de carrier ---------------------------------------------

test('stateCode 1 komt terug als nette fout', async () => {
  stubFetch({ stateCode: 1, msg: 'error' });
  const d = await (await roep('/api/pin/request?offer_id=305187&msisdn=94771234567')).json();
  assert.equal(d.success, false);
  assert.equal(d.code, 'carrier_weigert');
});

test('script en confirmBtnId worden doorgegeven aan de pagina', async () => {
  stubFetch({ stateCode: 0, txid: 'tx9', script: 'console.log(1)', confirmBtnId: 'btn-x' });
  const d = await (await roep('/api/pin/request?offer_id=305187&msisdn=94771234567')).json();
  assert.equal(d.script, 'console.log(1)');
  assert.equal(d.confirmBtnId, 'btn-x');
});

test('antwoord dat geen JSON is levert 502, geen crash', async () => {
  gezien = [];
  globalThis.fetch = async () => new Response('<html>onderhoud</html>', { status: 200 });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567');
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, 'upstream_geen_json');
});

// --- verify ----------------------------------------------------------------

test('goede pin geeft success', async () => {
  stubFetch({ stateCode: 0 });
  const d = await (await roep('/api/pin/verify?txid=tx1&pin=1234')).json();
  assert.equal(d.success, true);
  assert.match(gezien[0], /\/c\/pin\/verify\?/);
});

test('stateCode 2 komt terug als processing', async () => {
  stubFetch({ stateCode: 2 });
  const d = await (await roep('/api/pin/verify?txid=tx1&pin=1234')).json();
  assert.equal(d.processing, true);
});

test('verify zonder txid wordt geweigerd', async () => {
  stubFetch({ stateCode: 0 });
  const r = await roep('/api/pin/verify?pin=1234');
  assert.equal(r.status, 400);
  assert.equal(gezien.length, 0);
});

// --- snelheidslimiet -------------------------------------------------------

test('vierde codeaanvraag voor hetzelfde nummer wordt tegengehouden', async () => {
  const env = { ...ENV, PIN_KV: nepKV() };
  stubFetch({ stateCode: 0, txid: 'tx1' });
  for (let i = 0; i < 3; i++) {
    const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567', env);
    assert.equal(r.status, 200, `poging ${i + 1} hoort te lukken`);
  }
  const r4 = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567', env);
  assert.equal(r4.status, 429);
  assert.equal((await r4.json()).code, 'limiet_nummer');
  assert.equal(gezien.length, 3, 'de geweigerde poging mag de carrier niet bereiken');
});

test('pincode kan niet onbeperkt geraden worden', async () => {
  const env = { ...ENV, PIN_KV: nepKV() };
  stubFetch({ stateCode: 1, msg: 'fout' });
  for (let i = 0; i < 5; i++) {
    assert.equal((await roep('/api/pin/verify?txid=txA&pin=000' + i, env)).status, 200);
  }
  const r6 = await roep('/api/pin/verify?txid=txA&pin=9999', env);
  assert.equal(r6.status, 429);
  assert.equal((await r6.json()).code, 'limiet_pogingen');
});

test('zonder KV draait alles door, alleen zonder limiet', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  for (let i = 0; i < 5; i++) {
    assert.equal((await roep('/api/pin/request?offer_id=305187&msisdn=94771234567')).status, 200);
  }
});

// --- status ----------------------------------------------------------------

test('status vertaalt de statuscodes', async () => {
  stubFetch({ stateCode: 0 });
  assert.equal((await (await roep('/api/pin/status?txid=tx1')).json()).status, 'subscribed');
  stubFetch({ stateCode: 2 });
  assert.equal((await (await roep('/api/pin/status?txid=tx1')).json()).status, 'processing');
  stubFetch({ stateCode: 1, msg: 'nope' });
  assert.equal((await (await roep('/api/pin/status?txid=tx1')).json()).status, 'failed');
});

test('status zonder txid en zonder cid wordt geweigerd', async () => {
  stubFetch({ stateCode: 0 });
  assert.equal((await roep('/api/pin/status')).status, 400);
});

// --- routering en CORS -----------------------------------------------------

test('onbekend pad geeft 404', async () => {
  stubFetch({ stateCode: 0 });
  assert.equal((await roep('/api/pin/onzin')).status, 404);
});

test('POST wordt geweigerd', async () => {
  stubFetch({ stateCode: 0 });
  const r = await afhandelen(new Request('https://play-center.org/api/pin/request', { method: 'POST' }), ENV);
  assert.equal(r.status, 405);
});

test('vreemde herkomst krijgt geen toegang via CORS', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567', ENV, {
    headers: { Origin: 'https://kwaadaardig.example' },
  });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://play-center.org');
});

test('gezondheidscheck verklapt het token niet', async () => {
  const d = await (await roep('/api/health')).json();
  assert.equal(d.token, 'ingesteld');
  assert.equal(d.offers, 21);
  assert.ok(!JSON.stringify(d).includes('geheim123'));
});

// --- placeholders gelden als "niet ingesteld" ------------------------------

test('een AFF_ID dat nog op de placeholder staat blokkeert de aanvraag', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567', { ...ENV, AFF_ID: 'VUL_JE_AFF_ID_IN' });
  assert.equal(r.status, 500);
  assert.equal((await r.json()).code, 'geen_affid');
  assert.equal(gezien.length, 0, 'placeholder mag nooit naar de carrier');
});

test('gezondheidscheck ziet een placeholder als ontbrekend', async () => {
  const d = await (await roep('/api/health', { ...ENV, AFF_ID: 'VUL_JE_AFF_ID_IN' })).json();
  assert.equal(d.affId, 'ONTBREEKT');
});

// --- adres van de carrier-API ---------------------------------------------

test('standaard gaat het verzoek naar de host die de AM aanleverde', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  await roep('/api/pin/request?offer_id=305187&msisdn=94771234567');
  assert.match(gezien[0], /^https:\/\/m\.bolo2vas91\.click\/c\/pin\/305187\/6293\?/);
});

test('PIN_BASE_URL overschrijft het adres', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  await roep('/api/pin/request?offer_id=305187&msisdn=94771234567',
             { ...ENV, PIN_BASE_URL: 'https://m.vasvas.click/c/pin' });
  assert.match(gezien[0], /^https:\/\/m\.vasvas\.click\/c\/pin\//);
});

test('een onbekende host wordt geweigerd en krijgt het token niet', async () => {
  stubFetch({ stateCode: 0, txid: 'tx1' });
  const r = await roep('/api/pin/request?offer_id=305187&msisdn=94771234567',
                       { ...ENV, PIN_BASE_URL: 'https://kwaadaardig.example/c/pin' });
  assert.equal(r.status, 500);
  assert.equal((await r.json()).code, 'basis_url_ongeldig');
  assert.equal(gezien.length, 0);
});

test('verify gebruikt dezelfde host als de aanvraag', async () => {
  stubFetch({ stateCode: 0 });
  await roep('/api/pin/verify?txid=tx1&pin=123456&offer_id=305187',
             { ...ENV, PIN_BASE_URL: 'https://m.vasvas.click/c/pin' });
  assert.match(gezien[0], /^https:\/\/m\.vasvas\.click\/c\/pin\/verify\?/);
});

test('gezondheidscheck laat zien met welke host gepraat wordt', async () => {
  const d = await (await roep('/api/health')).json();
  assert.equal(d.basisUrl, 'https://m.bolo2vas91.click/c/pin');
});
