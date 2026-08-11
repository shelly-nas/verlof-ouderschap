# Verlofregistratie ouderschapsverlof

Een persoonlijke urenregistratie voor ouderschapsverlof: per week invoeren, saldo
en deadlines bewaken, zien wat het verlof met je brutosalaris doet, en met één
knop een verlofmelding naar je werkgever mailen.

## Snel starten (lokaal)

```bash
cp .env.example .env      # pas eventueel wachtwoorden aan
docker compose up --build # app op http://localhost:3000, database op :5432
```

Bij de eerste start moet je de database nog inrichten:

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

Daarna: voeg onder **Contracten** je contract toe en onder **Kinderen** je kind.
Zonder die twee kan er geen verlof worden geboekt.

### Zonder Docker

```bash
npm install
docker compose up -d db                    # alleen de database
# zet in .env de host op localhost in plaats van db
npm run db:migrate && npm run db:seed
npm run dev
```

## Productie

```bash
export POSTGRES_PASSWORD='iets-sterks'     # verplicht, geen standaardwaarde
docker compose -f docker-compose.prod.yml up -d --build
```

De container draait bij het starten zelf `prisma migrate deploy` en de seed, dus
een lege database wordt automatisch ingericht. De seed is idempotent en raakt
bestaande registraties niet aan; zet `SKIP_SEED=true` om hem over te slaan.
Postgres-data staat in het named volume `pgdata` en overleeft een herstart.

Instelbaar via environment: `APP_PORT` (standaard 3000), `POSTGRES_USER`,
`POSTGRES_DB`, `TZ`.

Let op: er zit geen login op de app. Zet hem alleen op een netwerk waar je hem
zelf kunt bereiken, of plaats er een reverse proxy met authenticatie voor.

## De verlofregels

Alle rechten gelden per kind en worden berekend als
`aantal weken × contracturen per week`.

| Verlofsoort | Weken | Betaald door | Percentage | Opnemen t/m |
|---|---|---|---|---|
| Geboorteverlof | 1 | Werkgever | 100% | 4 weken na de geboorte |
| Aanvullend geboorteverlof | 5 | UWV | 70% van het (max)dagloon | 6 maanden na de geboorte |
| Betaald ouderschapsverlof | 9 | UWV | 70% van het (max)dagloon | dag vóór de 1e verjaardag |
| Onbetaald ouderschapsverlof | 17 | — | 0% | tot het kind 8 jaar is |

Enkele regels die in de berekening verwerkt zitten:

- **Maximumdagloon.** UWV keert 70% uit over je dagloon, maar nooit over meer dan
  het maximumdagloon (€309,91 vanaf 1-1-2026). Bij een hoger salaris ontvang je
  dus effectief minder dan 70%. Het bedrag wordt opgezocht bij de datum van de
  verlofdag zelf; onder Instellingen zie je welke bedragen bekend zijn. Een nieuw
  bedrag voeg je toe in `prisma/seed.ts` en laad je met `npm run db:seed`.
- **Dagloon** = bruto maandsalaris ÷ 21,75.
- **Doorschuiven.** Ouderschapsverlof is wettelijk één pot van 26 weken waarvan er
  9 betaald zijn. Neem je die betaalde weken niet op vóór de eerste verjaardag,
  dan vervalt de uitkering maar niet het verlofrecht: het restant verhuist
  automatisch naar het onbetaalde saldo.
- **Contractwissel.** Elke verlofdag rekent met het contract dat op díe dag gold.
  Het verlofrecht zelf wordt vastgesteld met de contracturen die golden op de
  geboortedatum van het kind, en verandert dus niet als je later minder gaat
  werken.
- **Bovenwettelijke afspraken** leg je per contract vast (aanvulling tot een
  percentage, extra weken, ruimere termijn). Laat je dat leeg, dan gelden puur de
  UWV-regels.

De salarisweergave is een bruto-indicatie: loonheffing, vakantiegeld en
pensioenpremies blijven buiten beschouwing.

## De schermen

- **Overzicht** — resterend verlof, inkomen deze maand, en hoeveel dagen je nog
  hebt om vóór de 15e je melding te versturen.
- **Week invoeren** — het kernscherm. Per dag uren, verlofsoort en kind. "Hele
  week vullen" en "Vorige week kopiëren" schelen typewerk. Opslaan gebeurt als
  één transactie: de opgeslagen week is altijd exact wat je op het scherm ziet.
- **Saldo** — per kind per verlofsoort: recht, opgenomen, restant, deadline.
- **Salaris** — wat je bruto ontvangt in een maand met verlof, en wat je misloopt.
- **Mail** — genereert een `mailto:`-link met het weekoverzicht voor de komende
  maand. Bij een te lange mail (mailclients kappen die af) verschijnt in plaats
  daarvan een kopieerknop.
- **Contracten / Kinderen / Instellingen** — stamgegevens, eigen verlofsoorten en
  de bekende maximumdaglonen.

## Ontwikkelen

```bash
npm test              # unit tests op de rekenmodules
npm run build         # productiebuild
npm run db:studio     # database inspecteren
```

De rekenkern in [`src/lib/`](src/lib/) is bewust vrij van framework-code en
volledig getest: `dates.ts` (ISO-weken, kalenderdagen), `contracts.ts`,
`entitlements.ts` (recht en deadlines), `balances.ts` (saldo en doorschuiven),
`dagloon.ts` (uitkering en maximumdagloon), `salary.ts` en `mailto.ts`.

Datums worden overal als `yyyy-MM-dd`-string behandeld en in Postgres als `date`
opgeslagen. Een verlofdag is een kalenderdag, geen tijdstip; daarmee vervalt de
hele klasse zomertijd- en tijdzonebugs. De datumrekenkunde staat daarom bewust
niet in `date-fns` — die rekent in de lokale tijdzone.

Handmatige controlescripts (vereisen een draaiende database):

```bash
npx tsx scripts/seed-testdata.ts   # twee contracten met wissel + één kind
npx tsx scripts/check-flow.ts      # rechten, contractwissel, doorschuiven, mail
npx tsx scripts/check-saveweek.ts  # weekopslag via de API (dev-server vereist)
```

Na een schemawijziging: `npm run db:migrate` en `npx prisma generate`.
