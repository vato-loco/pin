/* ---------------------------------------------------------------------------
 * passcid.js — draagt de trackingparameters mee van pre-lander naar PIN-pagina.
 *
 * Dit is het stukje dat stil kapot gaat als je het vergeet: de bezoeker landt
 * met ?cid= op de pre-lander, klikt door naar de PIN-pagina, en die krijgt geen
 * cid mee. De flow werkt dan gewoon, de conversie wordt geactiveerd, maar de
 * postback van MOBPLUS kan bij Bemob aan niets gekoppeld worden. Je ziet dan
 * omzet zonder conversies in je tracker.
 *
 * Gebruik op een pre-lander:
 *
 *   <a href="/lp/kw-salini/" data-pin-cta>ابدأ الآن</a>
 *   <script src="/lp/_shared/passcid.js"></script>
 *
 * Elke link met data-pin-cta krijgt de parameters van de huidige pagina mee.
 * De verschillende namen die trackers voor de click-id gebruiken worden
 * allemaal omgezet naar cid, want dat is wat pinflow.js verwacht.
 * --------------------------------------------------------------------------- */

(function () {
  'use strict';

  // Namen die trackers voor de click-id gebruiken. Allemaal -> cid.
  var CLICKID = ['cid', 'clickid', 'click_id', 'subid', 'mc_click_id', 'clickId'];
  // Parameters die we onder hun eigen naam doorgeven.
  var OVERIG = ['sc', 's1', 's2', 's3', 's4', 's5', 'lp'];

  function verzamel() {
    var bron = new URLSearchParams(location.search);
    var mee = new URLSearchParams();

    for (var i = 0; i < CLICKID.length; i++) {
      var v = bron.get(CLICKID[i]);
      if (v) { mee.set('cid', v); break; }
    }
    OVERIG.forEach(function (k) {
      var v = bron.get(k);
      if (v) mee.set(k, v);
    });
    return mee;
  }

  // Maakt van een doel-URL een URL met de trackingparameters erbij. Bestaande
  // parameters op de link zelf blijven staan en winnen.
  function metTracking(href, mee) {
    var doel = new URL(href, location.href);
    mee.forEach(function (waarde, sleutel) {
      if (!doel.searchParams.has(sleutel)) doel.searchParams.set(sleutel, waarde);
    });
    return doel.toString();
  }

  function bedraad() {
    var mee = verzamel();
    if (!mee.toString()) return;   // niets door te geven
    var links = document.querySelectorAll('a[data-pin-cta]');
    for (var i = 0; i < links.length; i++) {
      links[i].href = metTracking(links[i].getAttribute('href'), mee);
    }
  }

  // Ook beschikbaar voor knoppen die met JS navigeren.
  window.pinCtaUrl = function (href) { return metTracking(href, verzamel()); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bedraad);
  } else {
    bedraad();
  }
})();
