# PIN API op play-center.org

`pin` is een **Cloudflare Pages-project** (`pin-e5x.pages.dev`, `play-center.org`)
dat automatisch bouwt bij een push naar GitHub. Het serveert de statische
landingspagina's én, via `functions/`, de PIN API-proxy op `/api/*`. Eén domein,
dus geen CORS.

```
bezoeker  ->  play-center.org/lp/<offer>/   (statische pagina)
          ->  play-center.org/api/pin/*     (Pages Function)
          ->  m.vasvas.click/c/pin/*        (Mobplus/carrier)
                    ^
                    het token wordt hier pas toegevoegd
```

## Bestanden

| pad | wat |
|-----|-----|
| `functions/api/[[path]].js` | instappunt voor `/api/*` |
| `functions/api/_pinapi.js` | alle logica; bestanden met `_` worden niet gerouteerd |
| `functions/api/_offers.js` | offers + nummerplannen per land |
| `functions/_middleware.js` | houdt ontwikkelbestanden uit de site |
| `_routes.json` | de function draait alleen op deze paden, niet op elk LP-verzoek |
| `lp/_shared/pinflow.js` | de flow, één keer, voor alle pagina's |
| `lp/_shared/passcid.js` | draagt de cid van pre-lander naar PIN-pagina |

## Eenmalig instellen

1. **Token als secret** op het Pages-project — nooit in een bestand:
   ```
   npx wrangler pages secret put MOBPLUS_TOKEN --project-name pin
   ```
2. **AFF_ID** staat in `wrangler.jsonc` onder `vars` (4647). Niet geheim.
3. **KV koppelen** voor de snelheidslimiet. Zonder deze stap draait alles, maar
   kan iedereen die het domein kent sms'jes laten versturen op jouw account:
   ```
   npx wrangler kv namespace create PIN_KV
   ```
   Plak de id in `wrangler.jsonc` en haal het `kv_namespaces`-blok uit commentaar.
4. **Controleren**:
   ```
   npm run doctor
   npm test
   npx wrangler pages dev        # lokaal
   curl https://play-center.org/api/health
   ```
   `/api/health` zegt of het token, de AFF_ID en KV er zijn, zonder het token
   zelf te tonen.

> Let op bij het samenvoegen: controleer in het dashboard dat de build output
> directory van het Pages-project op `/` staat. Die moet overeenkomen met
> `pages_build_output_dir` in `wrangler.jsonc`.

> `wrangler pages dev` serveert méér dan productie: het draait vanaf schijf, dus
> je ziet daar ook `functions/` en een eventuele `.dev.vars`. Pages bouwt uit
> git, waar die bestanden niet in zitten.

## Een landingspagina toevoegen

1. Zet de offer in `functions/api/_offers.js`. Staat hij daar niet, dan weigert
   de API hem — dat is bewust, het voorkomt dat jouw token op vreemde offers
   wordt gebruikt.
2. Maak `lp/<naam>/index.html` met deze acht id's en laad het gedeelde script:

   | id | wat |
   |----|-----|
   | `pin-phone` | sectie met het nummerveld |
   | `pin-msisdn` | invoerveld voor het nummer |
   | `pin-send` | knop "stuur code" |
   | `pin-code` | sectie met de pincode |
   | `pin-boxes` | **lege** container; de vakjes worden gemaakt uit `pinLength` |
   | `pin-verify` | knop "controleer" |
   | `pin-done` | sectie na een gelukt abonnement |
   | `pin-error` | foutregel |

   ```html
   <script>
   window.PIN_CONFIG = {
     offerId:   '301490',
     geo:       'KW',
     pinLength: 4,
     texts: { sending: '...', badNumber: '...' }   // optioneel, per taal
   };
   </script>
   <script src="/lp/_shared/pinflow.js"></script>
   ```
3. `npm run doctor` — controleert of de offer bestaat, of de geo klopt, of het
   aantal pincijfers overeenkomt en of alle id's er zijn.

Zet **nooit** flow-logica in de pagina zelf. Een pagina is vormgeving plus het
configblok, meer niet.

Prijs en afmeldinstructie moeten zichtbaar zijn **vóórdat** de bezoeker een
pincode invult. De carrier keurt de pagina anders af. `AAN_TE_VULLEN` in een
pagina is daarom een blokkerende fout in `doctor`.

## Wat per offer bij de AM opgevraagd moet worden

`_offers.js` heeft van bijna alle offers alleen naam, geo, carrier en payout.
Voor een LP zijn ook nodig:

- **Pin Length** — 4 of 6. Verkeerd = niemand kan de code afmaken.
- **Price** — bedrag en valuta, per dag of per week.
- **Unsubscribe** — afmeldwoord en shortcode.
- **Een testnummer** van de carrier, om de flow één keer helemaal te lopen.

## Pre-landers en tracking

Koud verkeer, zeker van pops, converteert slecht als het meteen op een
nummerveld landt. Daarom staat er een pre-lander voor:

```
advertentie → Bemob → pre-lander → CTA → PIN-pagina → activatie
                        (cid)             (cid)           │
                                                          ↓
                                    Bemob ←── postback ── MOBPLUS
```

Een pre-lander is een gewone HTML-pagina naast `index.html` in dezelfde
offermap, bijvoorbeeld `lp/kw-salini/pre-urgency.html`. Twee dingen zijn
verplicht:

```html
<a href="/lp/kw-salini/" data-pin-cta>افتح المكتبة الآن</a>
<script src="/lp/_shared/passcid.js"></script>
```

`passcid.js` zet de trackingparameters van de pre-lander op elke link met
`data-pin-cta`. Vergeet je dat, dan werkt de flow gewoon en wordt de conversie
geactiveerd, maar komt de postback bij Bemob aan zonder click-id en kan hij
nergens aan gekoppeld worden: omzet zonder conversies in je tracker. `doctor`
weigert daarom een pre-lander die naar de PIN-pagina linkt zonder deze twee.

Zet de prijs en de afmeldinstructie ook op de pre-lander, niet pas op de
PIN-pagina. Een funnel die de abonnementsvorm verzwijgt tot het laatste scherm
is waar carriers offers om laten vallen.

### In Bemob

- **Landing Page** = de pre-lander, **Offer** = de PIN-pagina. Zonder pre-lander
  gebruik je direct linking met de PIN-pagina als Offer.
- Link naar de URL **zonder** `.html` (`/lp/kw-salini/pre-urgency`). Met
  extensie geeft Pages een 308 en betaal je een redirect-hop.
- De `cid` wordt gelezen uit `cid`, `clickid`, `click_id`, `subid` of
  `mc_click_id`, wat er als eerste is. `sc` en `s1`–`s5` gaan mee voor splitsen
  per creative.

### Conversies

MOBPLUS stuurt **niet** uit zichzelf een postback. Kopieer de postback-URL uit
Bemob en geef die aan je AM; zij stellen hem in. Vraag er meteen bij of de offer
een postback vereist — offers die `stateCode 2` teruggeven bevestigen niet
direct, en dan is de postback je enige conversiesignaal.

Voor een pixel van Meta of Google: `pinflow.js` roept `window.onPinSuccess()`
aan zodra het abonnement rond is. Dat bijt niet met de postback; die twee dienen
verschillende doelen.

## Onderhoud

```
npm test        # 26 tests, draaien zonder netwerk
npm run doctor  # controleert config, functions en alle landingspagina's
```
