# PIN API op play-center.org

De Worker `pin` serveert twee dingen vanaf hetzelfde domein: de statische
landingspagina's in deze repo, en de PIN API-proxy op `/api/pin/*`. Omdat het
één domein is, is er geen CORS in het spel.

```
bezoeker  ->  play-center.org/lp/<offer>/   (statische pagina)
          ->  play-center.org/api/pin/*     (deze Worker)
          ->  m.vasvas.click/c/pin/*        (Mobplus/carrier)
                    ^
                    het token wordt hier pas toegevoegd
```

## Waarom dit er niet was

De repo had geen `wrangler.jsonc`. Zonder dat bestand verzint Cloudflare bij
elke build zelf een configuratie **zonder `main`**: dan worden alleen de
bestanden geserveerd en bestaat `/api/pin/*` niet. Dat is de reden dat de
PIN API-opzet niet werkte.

## Eenmalig instellen

1. **Token als secret** — nooit in een bestand, ook niet in `wrangler.jsonc`:
   ```
   npx wrangler secret put MOBPLUS_TOKEN
   ```
2. **AFF_ID invullen** in `wrangler.jsonc` onder `vars`. Dat is je publisher-ID,
   niet geheim.
3. **KV koppelen** voor de snelheidslimiet. Zonder deze stap draait alles, maar
   kan iedereen die het domein kent sms'jes laten versturen op jouw account:
   ```
   npx wrangler kv namespace create PIN_KV
   ```
   Plak de id in `wrangler.jsonc` en haal het `kv_namespaces`-blok uit commentaar.
4. **Controleren en uitrollen**:
   ```
   npm run doctor
   npx wrangler deploy
   curl https://play-center.org/api/health
   ```
   `/api/health` zegt of het token, de AFF_ID en KV er zijn. Het toont het token
   zelf niet.

## Een landingspagina toevoegen

Alleen dit, verder niets:

1. Zet de offer in `src/offers.js`. Staat hij daar niet, dan weigert de Worker
   hem — dat is bewust, het voorkomt dat jouw token op vreemde offers wordt
   gebruikt.
2. Maak `lp/<naam>/index.html` met deze acht id's, en laad het gedeelde script:

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
3. `npm run doctor` — die controleert of de offer bestaat, of de geo klopt, of
   het aantal pincijfers overeenkomt en of alle id's er zijn.

Zet **nooit** flow-logica in de pagina zelf. Alles zit in
`lp/_shared/pinflow.js`; een pagina is alleen vormgeving plus het configblok.

De prijs en de afmeldinstructie moeten zichtbaar zijn **vóórdat** de bezoeker
een pincode invult. De carrier keurt de pagina anders af, en het scheelt
klachten. `AAN_TE_VULLEN` in een pagina is daarom een blokkerende fout in
`doctor`.

## Wat per offer bij de AM opgevraagd moet worden

`src/offers.js` heeft van bijna alle offers alleen naam, geo, carrier en payout.
Voor een LP zijn ook nodig:

- **Pin Length** — 4 of 6. Verkeerd = niemand kan de code afmaken.
- **Price** — bedrag en valuta, per dag of per week.
- **Unsubscribe** — afmeldwoord en shortcode.
- **Een testnummer** van de carrier, om de flow één keer helemaal door te lopen.

## Tracking

De `cid` wordt automatisch uit de URL gelezen: `cid`, `clickid`, `click_id`,
`subid` of `mc_click_id`, wat er als eerste is. Voor Bemob:

```
play-center.org/lp/kw-salini/?cid={clickid}
```

Geeft de carrier `stateCode 2` (nog niet bevestigd), dan blijft de pagina
navragen. Loopt dat af, dan is de conversie niet weg: geef je postback-URL aan
de AM, dan komt de bevestiging alsnog binnen bij de tracker.

## Onderhoud

```
npm test        # 24 tests op de Worker, draaien zonder netwerk
npm run doctor  # controleert config en alle landingspagina's
```
