// ---------------------------------------------------------------------------
// Mobplus PIN API — backend-proxy als Cloudflare Pages Function.
//
// De landingspagina praat nooit rechtstreeks met de carrier: het token mag niet
// in de browser terechtkomen. De pagina roept deze Worker aan, de Worker zet het
// token erbij en praat met m.vasvas.click.
//
//   Browser (LP)  ->  deze Function ->  https://m.vasvas.click/c/pin/...
//                        ^
//                        token staat alleen hier
//
// Verschillen met de template uit pinapiguide_en.docx, en waarom:
//
//  1. Token staat niet in de broncode maar in een secret (env.MOBPLUS_TOKEN).
//     De template zet 'm bovenin het bestand; dan staat je sleutel in elke
//     kopie, elke back-up en elke chat waarin je de code deelt.
//  2. offer_id wordt getoetst aan de allowlist in offers.js. De template stuurt
//     elk opgegeven offer_id door, dus wie je Worker-domein kent kan jouw token
//     op willekeurige offers gebruiken.
//  3. ip en ua komen uit de request-headers, niet uit de querystring. Zo krijgt
//     de adverteerder het echte apparaat te zien en kan een bezoeker het niet
//     zelf invullen.
//  4. Snelheidslimiet per nummer en per IP (als er een KV-namespace hangt).
//     Zonder limiet is dit endpoint een knop waarmee iedereen sms'jes naar
//     willekeurige nummers stuurt, op jouw account.
// ---------------------------------------------------------------------------

import { OFFERS, msisdnPattern, normalizeMsisdn } from './_offers.js';

// Het adres van de carrier-API. De handleiding noemt m.vasvas.click, maar de
// URL's die de AM per offer aanlevert staan op m.bolo2vas91.click. Het verschilt
// dus per aanlevering en hoort niet hardcoded te staan.
//
// Volgorde: eerst wat de offer zelf opgeeft, dan PIN_BASE_URL uit
// wrangler.jsonc, en pas als laatste deze waarde.
const STANDAARD_BASIS = 'https://m.bolo2vas91.click/c/pin';

// Alleen adressen die we kennen. Zonder deze lijst zou een verkeerd ingevulde
// var of offer ons token naar een willekeurige host sturen.
const TOEGESTANE_HOSTS = ['m.bolo2vas91.click', 'm.vasvas.click'];

function basisUrl(env, offer) {
  const kandidaat = (offer && offer.baseUrl) || env.PIN_BASE_URL || STANDAARD_BASIS;
  try {
    const u = new URL(kandidaat);
    if (!TOEGESTANE_HOSTS.includes(u.hostname)) return null;
    return kandidaat.replace(/\/$/, '');
  } catch (e) {
    return null;
  }
}

// Doorlaatlijst voor losse trackingparameters. Alles wat hier niet in staat
// gaat niet mee naar de carrier.
const PASSTHROUGH = ['cid', 'sc', 's1', 's2', 's3', 's4', 's5', 'lp', 'confirmBtnId'];

// Limieten. Ruim genoeg voor een echte bezoeker die zich vertypt, krap genoeg
// om misbruik af te remmen.
const LIMITS = {
  otpPerMsisdn: { max: 3,  windowSec: 600 },   // 3 sms'jes per nummer per 10 min
  otpPerIp:     { max: 10, windowSec: 600 },   // 10 aanvragen per IP per 10 min
  verifyPerTx:  { max: 5,  windowSec: 900 },   // 5 pogingen per transactie
};

// --------------------------------------------------------------------------- //
// Antwoorden
// --------------------------------------------------------------------------- //

function corsHeaders(request, env) {
  const toegestaan = (env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  // Staat er niets ingesteld, dan gedragen we ons als een dichte deur in plaats
  // van als een open deur: liever een LP die stukloopt tijdens het testen dan
  // een endpoint dat de hele wereld mag aanroepen.
  const allow = toegestaan.includes(origin) ? origin : (toegestaan[0] || 'null');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonRes(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env),
    },
  });
}

// --------------------------------------------------------------------------- //
// Snelheidslimiet
// --------------------------------------------------------------------------- //

// Telt een gebeurtenis en zegt of de limiet is bereikt. Zonder KV-binding doet
// deze functie niets: de Worker draait dan wel, maar ongelimiteerd. De README
// legt uit hoe je de namespace koppelt.
async function binnenLimiet(env, sleutel, limiet) {
  if (!env.PIN_KV) return true;
  try {
    const huidig = Number(await env.PIN_KV.get(sleutel)) || 0;
    if (huidig >= limiet.max) return false;
    await env.PIN_KV.put(sleutel, String(huidig + 1), { expirationTtl: limiet.windowSec });
    return true;
  } catch (e) {
    // Gaat KV onderuit, dan laten we het verzoek door in plaats van het te
    // blokkeren. Op het gratis niveau is het aantal schrijfacties per dag
    // beperkt, en dat raak je bij volume aan; een uitgeputte quota hoort de
    // flow niet plat te leggen. De limiet is bescherming tegen misbruik, geen
    // voorwaarde om te mogen converteren.
    console.warn('KV niet beschikbaar, limiet overgeslagen voor', sleutel);
    return true;
  }
}

// --------------------------------------------------------------------------- //
// Gedeelde controles
// --------------------------------------------------------------------------- //

// Een waarde die nog op de placeholder uit wrangler.jsonc staat telt als
// niet ingevuld. Anders meldt /api/health dat alles klaarstaat terwijl er
// VUL_JE_AFF_ID_IN naar de carrier gaat.
function ingevuld(waarde) {
  const v = (waarde || '').trim();
  return v && !v.startsWith('VUL_') ? v : null;
}

function pakToken(env) {
  return ingevuld(env.MOBPLUS_TOKEN);
}

// Trackingwaarden zijn vrije tekst van buiten. Kort houden en beperken tot
// tekens die een URL niet uit elkaar trekken.
function schoonParam(waarde) {
  if (!waarde) return null;
  const schoon = String(waarde).replace(/[^A-Za-z0-9._~-]/g, '').slice(0, 128);
  return schoon || null;
}

async function haalUpstream(url) {
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const tekst = await resp.text();
  try {
    return { ok: resp.ok, data: JSON.parse(tekst) };
  } catch (e) {
    // De carrier stuurt bij storingen soms HTML terug. Dat is geen JSON-fout van
    // ons, maar wel iets wat je in de logs wilt terugzien.
    return { ok: false, data: null, ruw: tekst.slice(0, 200) };
  }
}

// --------------------------------------------------------------------------- //
// 1. OTP aanvragen
// --------------------------------------------------------------------------- //

async function handlePinRequest(request, env, url) {
  const token = pakToken(env);
  if (!token) return jsonRes(request, env, { success: false, code: 'geen_token', msg: 'Server is not configured.' }, 500);

  if (!ingevuld(env.AFF_ID)) {
    return jsonRes(request, env, { success: false, code: 'geen_affid', msg: 'Server is not configured.' }, 500);
  }

  const offerId = url.searchParams.get('offer_id');
  const offer = OFFERS[offerId];
  if (!offer) {
    return jsonRes(request, env, { success: false, code: 'onbekend_offer', msg: 'Unknown offer.' }, 400);
  }

  const strict = (env.STRICT_PREFIX ?? '1') !== '0';
  const msisdn = normalizeMsisdn(url.searchParams.get('msisdn'), offer.geo);
  if (!msisdnPattern(offer.geo, strict).test(msisdn)) {
    return jsonRes(request, env, {
      success: false,
      code: 'msisdn_ongeldig',
      msg: 'Please enter a valid mobile number.',
    }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await binnenLimiet(env, `otp:m:${msisdn}`, LIMITS.otpPerMsisdn)) {
    return jsonRes(request, env, { success: false, code: 'limiet_nummer', msg: 'Too many code requests. Please wait a few minutes.' }, 429);
  }
  if (ip && !await binnenLimiet(env, `otp:i:${ip}`, LIMITS.otpPerIp)) {
    return jsonRes(request, env, { success: false, code: 'limiet_ip', msg: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const basis = basisUrl(env, offer);
  if (!basis) {
    return jsonRes(request, env, { success: false, code: 'basis_url_ongeldig', msg: 'Server is not configured.' }, 500);
  }

  const upstream = new URL(`${basis}/${offerId}/${env.AFF_ID}`);
  upstream.searchParams.set('msisdn', msisdn);
  upstream.searchParams.set('token', token);
  // Het echte apparaat, niet wat de pagina beweert.
  if (ip) upstream.searchParams.set('ip', ip);
  const ua = request.headers.get('User-Agent');
  if (ua) upstream.searchParams.set('ua', ua.slice(0, 256));
  for (const key of PASSTHROUGH) {
    const val = schoonParam(url.searchParams.get(key));
    if (val) upstream.searchParams.set(key, val);
  }

  let res;
  try {
    res = await haalUpstream(upstream.toString());
  } catch (e) {
    return jsonRes(request, env, { success: false, code: 'upstream_stuk', msg: 'Service unavailable. Please try again.' }, 502);
  }
  if (!res.data) {
    return jsonRes(request, env, { success: false, code: 'upstream_geen_json', msg: 'Service unavailable. Please try again.' }, 502);
  }

  if (res.data.stateCode === 0) {
    return jsonRes(request, env, {
      success: true,
      txid: res.data.txid,
      script: res.data.script || '',
      confirmBtnId: res.data.confirmBtnId || '',
    });
  }
  return jsonRes(request, env, {
    success: false,
    code: 'carrier_weigert',
    msg: res.data.msg || 'Could not send the code. Please try again.',
  });
}

// --------------------------------------------------------------------------- //
// 2. PIN controleren
// --------------------------------------------------------------------------- //

async function handlePinVerify(request, env, url) {
  const token = pakToken(env);
  if (!token) return jsonRes(request, env, { success: false, code: 'geen_token', msg: 'Server is not configured.' }, 500);

  const txid = schoonParam(url.searchParams.get('txid'));
  const pin = String(url.searchParams.get('pin') || '').replace(/\D/g, '');
  if (!txid) return jsonRes(request, env, { success: false, code: 'txid_ontbreekt', msg: 'Session expired. Please start again.' }, 400);
  if (!pin)  return jsonRes(request, env, { success: false, code: 'pin_ongeldig', msg: 'Please enter the code.' }, 400);

  // Zonder deze limiet kan een pincode eruit geprobeerd worden.
  if (!await binnenLimiet(env, `vf:${txid}`, LIMITS.verifyPerTx)) {
    return jsonRes(request, env, { success: false, code: 'limiet_pogingen', msg: 'Too many attempts. Please request a new code.' }, 429);
  }

  // De pagina stuurt offer_id mee zodat we hetzelfde adres gebruiken als bij de
  // aanvraag. Offers kunnen op verschillende hosts staan; verifiëren op de
  // verkeerde host levert een transactie op die daar niet bestaat.
  const offer = OFFERS[url.searchParams.get('offer_id')];
  const basis = basisUrl(env, offer);
  if (!basis) {
    return jsonRes(request, env, { success: false, code: 'basis_url_ongeldig', msg: 'Server is not configured.' }, 500);
  }

  const upstream = new URL(`${basis}/verify`);
  upstream.searchParams.set('txid', txid);
  upstream.searchParams.set('pin', pin);
  upstream.searchParams.set('token', token);

  let res;
  try {
    res = await haalUpstream(upstream.toString());
  } catch (e) {
    return jsonRes(request, env, { success: false, code: 'upstream_stuk', msg: 'Verification failed. Please try again.' }, 502);
  }
  if (!res.data) {
    return jsonRes(request, env, { success: false, code: 'upstream_geen_json', msg: 'Verification failed. Please try again.' }, 502);
  }

  if (res.data.stateCode === 0) return jsonRes(request, env, { success: true });
  if (res.data.stateCode === 2) {
    return jsonRes(request, env, {
      success: false,
      processing: true,
      code: 'in_behandeling',
      msg: 'Confirming your subscription...',
    });
  }
  return jsonRes(request, env, {
    success: false,
    code: 'pin_fout',
    msg: res.data.msg || 'Incorrect code. Please try again.',
  });
}

// --------------------------------------------------------------------------- //
// 3. Status opvragen (na stateCode 2)
// --------------------------------------------------------------------------- //

async function handleStatusCheck(request, env, url) {
  const token = pakToken(env);
  if (!token) return jsonRes(request, env, { success: false, code: 'geen_token', msg: 'Server is not configured.' }, 500);

  const txid = schoonParam(url.searchParams.get('txid'));
  const cid = schoonParam(url.searchParams.get('cid'));
  if (!txid && !cid) {
    return jsonRes(request, env, { success: false, code: 'sleutel_ontbreekt', msg: 'Provide txid or cid.' }, 400);
  }

  const offer = OFFERS[url.searchParams.get('offer_id')];
  const basis = basisUrl(env, offer);
  if (!basis) {
    return jsonRes(request, env, { success: false, status: 'unknown', code: 'basis_url_ongeldig' }, 500);
  }

  const upstream = new URL(`${basis}/check`);
  upstream.searchParams.set('token', token);
  if (txid) upstream.searchParams.set('txid', txid);
  if (cid) upstream.searchParams.set('cid', cid);

  let res;
  try {
    res = await haalUpstream(upstream.toString());
  } catch (e) {
    return jsonRes(request, env, { success: false, status: 'unknown', code: 'upstream_stuk' }, 502);
  }
  if (!res.data) {
    return jsonRes(request, env, { success: false, status: 'unknown', code: 'upstream_geen_json' }, 502);
  }

  if (res.data.stateCode === 0) return jsonRes(request, env, { success: true, status: 'subscribed' });
  if (res.data.stateCode === 2) return jsonRes(request, env, { success: false, status: 'processing' });
  return jsonRes(request, env, { success: false, status: 'failed', msg: res.data.msg || '' });
}

// --------------------------------------------------------------------------- //
// 4. Zelfcontrole — controleert de opzet zonder de carrier aan te roepen
// --------------------------------------------------------------------------- //

function handleHealth(request, env) {
  return jsonRes(request, env, {
    ok: true,
    token: pakToken(env) ? 'ingesteld' : 'ONTBREEKT',
    affId: ingevuld(env.AFF_ID) ? 'ingesteld' : 'ONTBREEKT',
    kv: env.PIN_KV ? 'gekoppeld' : 'niet gekoppeld (geen snelheidslimiet)',
    origins: (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    strictPrefix: (env.STRICT_PREFIX ?? '1') !== '0',
    // Handig bij het uitzoeken: praten we met de host die de AM heeft
    // aangeleverd, of nog met die uit de handleiding?
    basisUrl: basisUrl(env, null) || 'ONGELDIG',
    offers: Object.keys(OFFERS).length,
  });
}

// --------------------------------------------------------------------------- //

// Het instappunt. functions/api/[[path]].js roept dit aan; de tests roepen het
// rechtstreeks aan, zodat er geen Pages-omgeving nodig is om ze te draaien.
export async function afhandelen(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(request, env), 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'GET') {
      return jsonRes(request, env, { success: false, msg: 'Method not allowed' }, 405);
    }
    switch (url.pathname) {
      case '/api/pin/request': return handlePinRequest(request, env, url);
      case '/api/pin/verify':  return handlePinVerify(request, env, url);
      case '/api/pin/status':  return handleStatusCheck(request, env, url);
      case '/api/health':      return handleHealth(request, env);
      default:                 return jsonRes(request, env, { success: false, msg: 'Not found' }, 404);
    }
}
