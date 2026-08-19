/* ---------------------------------------------------------------------------
 * pinflow.js — de PIN API-flow voor elke landingspagina in deze repo.
 *
 * Een landingspagina zet window.PIN_CONFIG en laadt daarna dit bestand. De
 * pagina hoeft zelf geen enkele regel flow-logica te bevatten.
 *
 *   <script>
 *     window.PIN_CONFIG = {
 *       offerId:   '291632',
 *       geo:       'LK',
 *       pinLength: 4,
 *       texts: { ... }        // optioneel, zie STANDAARDTEKST hieronder
 *     };
 *   </script>
 *   <script src="/lp/_shared/pinflow.js"></script>
 *
 * Vereiste elementen in de HTML (id's liggen vast):
 *   #pin-phone     sectie met het nummerveld
 *   #pin-msisdn      invoerveld voor het nummer
 *   #pin-send        knop "stuur code"
 *   #pin-code      sectie met de pincode
 *   #pin-boxes       lege container; de vakjes worden hier gemaakt
 *   #pin-verify      knop "controleer"
 *   #pin-done      sectie na een gelukt abonnement
 *   #pin-error     foutregel (één, wordt hergebruikt)
 *
 * De vakjes voor de pincode worden gemaakt op basis van pinLength. Zet dat
 * getal goed en het aantal vakjes klopt automatisch — dat scheelt de meest
 * gemaakte fout bij het live zetten.
 * --------------------------------------------------------------------------- */

(function () {
  'use strict';

  var C = window.PIN_CONFIG || {};
  var API = (C.apiBase || '').replace(/\/$/, '');   // leeg = zelfde domein
  var PINLEN = Number(C.pinLength) || 4;

  var STANDAARDTEKST = {
    sending:    'Sending code...',
    verifying:  'Verifying...',
    badNumber:  'Please enter a valid mobile number.',
    shortPin:   'Please enter all ' + PINLEN + ' digits.',
    netwerk:    'Network error. Please check your connection.',
    processing: 'Confirming your subscription, one moment...',
    traag:      'This is taking longer than expected. Please try again.',
    resend:     'Resend code',
    resendIn:   'Resend in {s}s',
  };
  var T = Object.assign({}, STANDAARDTEKST, C.texts || {});

  function $(id) { return document.getElementById(id); }
  var elPhone = $('pin-phone'), elCode = $('pin-code'), elDone = $('pin-done');
  var elMsisdn = $('pin-msisdn'), elSend = $('pin-send'), elVerify = $('pin-verify');
  var elBoxes = $('pin-boxes'), elError = $('pin-error');

  if (!elPhone || !elCode || !elMsisdn || !elSend || !elBoxes || !elVerify) {
    console.error('[pinflow] verplichte elementen ontbreken; controleer de id\'s in de HTML');
    return;
  }

  var txid = null;
  var bezig = false;

  // De click-id van de tracker. Bemob geeft 'm mee als ?cid=, maar andere
  // trackers gebruiken andere namen; we pakken de eerste die er is, zodat een
  // verkeerd ingestelde campagne niet stilletjes zonder tracking draait.
  var qs = new URLSearchParams(location.search);
  var cid = qs.get('cid') || qs.get('clickid') || qs.get('click_id') ||
            qs.get('subid') || qs.get('mc_click_id') || ('direct_' + Date.now());
  var sc = qs.get('sc') || qs.get('s1') || null;

  // ---- schermen en meldingen ---------------------------------------------

  function toon(el) { if (el) el.style.display = 'block'; }
  function verberg(el) { if (el) el.style.display = 'none'; }

  function fout(msg) {
    if (!elError) return;
    elError.textContent = msg;
    elError.style.display = msg ? 'block' : 'none';
  }

  function bezigZetten(knop, aan, tekst) {
    bezig = aan;
    if (!knop) return;
    knop.disabled = aan;
    if (aan) {
      knop.dataset.labelOrigineel = knop.dataset.labelOrigineel || knop.textContent;
      knop.textContent = tekst;
    } else if (knop.dataset.labelOrigineel) {
      knop.textContent = knop.dataset.labelOrigineel;
    }
  }

  // ---- vakjes voor de pincode --------------------------------------------

  var vakjes = [];
  function bouwVakjes() {
    elBoxes.innerHTML = '';
    vakjes = [];
    for (var i = 0; i < PINLEN; i++) {
      var b = document.createElement('input');
      b.type = 'text';
      b.inputMode = 'numeric';
      b.autocomplete = i === 0 ? 'one-time-code' : 'off';
      b.maxLength = 1;
      b.className = 'pin-box';
      elBoxes.appendChild(b);
      vakjes.push(b);
    }
    vakjes.forEach(function (b, i) {
      b.addEventListener('input', function () {
        b.value = b.value.replace(/\D/g, '').slice(0, 1);
        if (b.value && i < vakjes.length - 1) vakjes[i + 1].focus();
        if (leesPin().length === PINLEN) elVerify.focus();
      });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !b.value && i > 0) vakjes[i - 1].focus();
      });
      // De code uit de sms in één keer plakken is voor veel bezoekers de
      // snelste weg; zonder dit belandt alles in het eerste vakje.
      b.addEventListener('paste', function (e) {
        var tekst = (e.clipboardData || window.clipboardData).getData('text') || '';
        var cijfers = tekst.replace(/\D/g, '').slice(0, PINLEN);
        if (!cijfers) return;
        e.preventDefault();
        for (var j = 0; j < cijfers.length && i + j < vakjes.length; j++) {
          vakjes[i + j].value = cijfers[j];
        }
        var laatste = Math.min(i + cijfers.length, vakjes.length - 1);
        vakjes[laatste].focus();
      });
    });
  }

  function leesPin() {
    return vakjes.map(function (b) { return b.value; }).join('');
  }

  function wisPin() {
    vakjes.forEach(function (b) { b.value = ''; });
    if (vakjes[0]) vakjes[0].focus();
  }

  // ---- stap 1: code aanvragen --------------------------------------------

  function vraagCode() {
    if (bezig) return;
    var ruw = (elMsisdn.value || '').replace(/[^\d+]/g, '');
    // Bewust ruim: de Worker normaliseert het nummer (landnummer, nul ervoor,
    // plusteken) en kent het nummerplan per land. Hier alleen grof filteren, om
    // te voorkomen dat we bezoekers met een geldig nummer tegenhouden.
    if (ruw.replace(/\D/g, '').length < 8) { fout(T.badNumber); return; }

    fout('');
    bezigZetten(elSend, true, T.sending);

    var url = API + '/api/pin/request?offer_id=' + encodeURIComponent(C.offerId) +
              '&msisdn=' + encodeURIComponent(ruw) +
              '&cid=' + encodeURIComponent(cid) +
              (sc ? '&sc=' + encodeURIComponent(sc) : '');

    fetch(url, { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        bezigZetten(elSend, false);
        if (!d.success) { fout(d.msg || T.netwerk); return; }
        txid = d.txid;

        // De adverteerder kan een stukje script meesturen dat op de pagina moet
        // draaien; dat hoort bij deze flow. Let op wat het is: het is code van
        // een derde partij die je hier zelf uitvoert.
        if (d.script) {
          try {
            var s = document.createElement('script');
            s.textContent = d.script;
            document.head.appendChild(s);
          } catch (e) { console.warn('[pinflow] script van adverteerder faalde', e); }
        }
        if (d.confirmBtnId) elSend.id = d.confirmBtnId;

        verberg(elPhone);
        toon(elCode);
        if (vakjes[0]) vakjes[0].focus();
        startResendTimer();
      })
      .catch(function () {
        bezigZetten(elSend, false);
        fout(T.netwerk);
      });
  }

  // ---- stap 2: code controleren ------------------------------------------

  function controleerCode() {
    if (bezig) return;
    var pin = leesPin();
    if (pin.length !== PINLEN) { fout(T.shortPin); return; }

    fout('');
    bezigZetten(elVerify, true, T.verifying);

    // offer_id gaat mee omdat offers op verschillende hosts kunnen staan; de API
    // kiest daarmee hetzelfde adres als bij de aanvraag.
    fetch(API + '/api/pin/verify?txid=' + encodeURIComponent(txid) + '&pin=' + encodeURIComponent(pin) +
          '&offer_id=' + encodeURIComponent(C.offerId), { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        bezigZetten(elVerify, false);
        if (d.success) { gelukt(); return; }
        if (d.processing) { fout(T.processing); pollStatus(0); return; }
        fout(d.msg || T.shortPin);
        wisPin();
      })
      .catch(function () {
        bezigZetten(elVerify, false);
        fout(T.netwerk);
      });
  }

  // Sommige carriers bevestigen niet meteen (stateCode 2). Dan blijven we even
  // navragen. Loopt dat af, dan is de conversie niet weg: de postback naar de
  // tracker komt later alsnog binnen.
  function pollStatus(poging) {
    if (poging >= 10) { fout(T.traag); return; }
    setTimeout(function () {
      fetch(API + '/api/pin/status?txid=' + encodeURIComponent(txid) + '&cid=' + encodeURIComponent(cid) +
            '&offer_id=' + encodeURIComponent(C.offerId), { credentials: 'omit' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status === 'subscribed') { gelukt(); return; }
          if (d.status === 'processing') { pollStatus(poging + 1); return; }
          fout(d.msg || T.shortPin);
          wisPin();
        })
        .catch(function () { pollStatus(poging + 1); });
    }, 3000);
  }

  function gelukt() {
    fout('');
    verberg(elPhone);
    verberg(elCode);
    toon(elDone);
    // Haakje voor de tracker of een pixel op de bedanksectie.
    if (typeof window.onPinSuccess === 'function') {
      try { window.onPinSuccess({ cid: cid, offerId: C.offerId }); } catch (e) {}
    }
  }

  // ---- code opnieuw sturen ------------------------------------------------

  var elResend = $('pin-resend');
  function startResendTimer() {
    if (!elResend) return;
    var over = 30;
    elResend.style.display = 'inline-block';
    elResend.disabled = true;
    elResend.textContent = T.resendIn.replace('{s}', over);
    var t = setInterval(function () {
      over--;
      if (over <= 0) {
        clearInterval(t);
        elResend.disabled = false;
        elResend.textContent = T.resend;
      } else {
        elResend.textContent = T.resendIn.replace('{s}', over);
      }
    }, 1000);
  }
  if (elResend) {
    elResend.addEventListener('click', function () {
      if (elResend.disabled) return;
      verberg(elCode);
      toon(elPhone);
      fout('');
      wisPin();
    });
  }

  // ---- opstarten ----------------------------------------------------------

  bouwVakjes();
  verberg(elCode);
  verberg(elDone);
  toon(elPhone);

  elSend.addEventListener('click', vraagCode);
  elMsisdn.addEventListener('keydown', function (e) { if (e.key === 'Enter') vraagCode(); });
  elVerify.addEventListener('click', controleerCode);
})();
