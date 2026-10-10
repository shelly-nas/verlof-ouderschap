# Verlofregistratie ouderschapsverlof

Een persoonlijke urenregistratie voor ouderschapsverlof: per maand invoeren, saldo
en deadlines bewaken, zien wat het verlof netto met je salaris doet, en met één
knop een verlofmelding naar je werkgever mailen.

De app volgt de shelly-nas standaarden uit
[`shelly-nas/shelly-fundamentals`](https://github.com/shelly-nas/shelly-fundamentals):
React + Vite + MUI in `client/`, Node + Express in `server/`, PostgreSQL 16 in
`database/`, het Web App Template als huisstijl, een acceptatieomgeving per pull
request en een deploy naar productie bij elke merge.

| Omgeving | Adres |
|---|---|
| Lokaal | http://localhost:5173 |
| Acceptatie (elke PR) | http://verlof-acc.shelly-nas.nl |
| Productie | http://verlof.shelly-nas.nl |

## Snel starten (lokaal)

```bash
cp .env.example .env      # vul DB_PASSWORD in
docker compose up --build # app op http://localhost:5173
```

De database wordt bij de eerste start ingericht met het schema, de wettelijke
verlofsoorten en demodata (twee contracten met een wissel, een kind, wat verlof).
Opnieuw beginnen: `docker compose down -v && docker compose up --build`.

### Zonder Docker

```bash
docker compose up -d db                       # alleen de database
cd server && npm install
DB_HOST=localhost DB_USER=verlof DB_PASSWORD=… DB_NAME=verlof npm run dev
cd client && npm install && npm run dev       # Vite proxyt /api naar :3000
```

## Opbouw

```
client/     React + Vite + MUI; thema uit shelly-fundamentals (src/theme.ts)
server/     Express-API op poort 3000, alles onder /api
  src/domain/   de rekenkern: rechten, saldo, dagloon, loonheffing, netto, mail
  src/repo.ts   alle SQL (geen ORM)
  src/app.ts    de routes; elk scherm haalt één kant-en-klaar antwoord op
  migrations/   schemawijzigingen op de productiedatabase, zie de README daar
database/   init.sql (schema), seed.sql (verlofsoorten), seed-demo.sql (alleen lokaal/acc)
```

De rekenkern in `server/src/domain/` is vrij van framework-code en volledig
getest. Datums zijn overal `yyyy-MM-dd`-strings en in Postgres `DATE`: een
verlofdag is een kalenderdag, geen tijdstip. De client heeft een kopie van
`dates.ts` en `money.ts` voor dezelfde notatie; pas wijzigingen in beide aan.

## De schermen

- **Overzicht**: wat het verlof deze maand netto kost, resterend verlof,
  naderende deadlines en hoeveel dagen je nog hebt om vóór de 15e te melden.
- **Maand invoeren**: een maandkalender. Kies een verlofsoort en klik op een
  dag om er een volledige verlofdag neer te zetten; nog een klik haalt hem weg.
  Klik op het urenlabel voor afwijkende uren of een tweede verlofsoort.
  "Hele maand", "Elke ma/di/…" en "Vorige maand kopiëren" schelen typewerk.
  Zodra er iets verandert, verschijnt onderin de opslaanbalk; wegnavigeren met
  niet-opgeslagen wijzigingen vraagt om bevestiging. Opslaan is één
  transactie: de opgeslagen maand is precies wat je op het scherm ziet.
- **Saldo**: per kind per verlofsoort het recht, het opgenomen deel, het
  restant en de deadline.
- **Salaris**: de opbouw van de maand en de loonstrook met verlof naast een
  normale maand, bruto én netto.
- **Verlof melden**: een `mailto:`-link met alle verlofdagen van de maand. Bij
  een te lange mail (mailclients kappen die af) kopieer je de tekst.
- **Contracten, Kinderen, Instellingen**: stamgegevens, eigen verlofsoorten en
  licht/donker thema.

## De verlofregels

Alle rechten gelden per kind en worden berekend als
`aantal weken × contracturen per week`.

| Verlofsoort | Weken | Betaald door | Percentage | Opnemen t/m |
|---|---|---|---|---|
| Geboorteverlof | 1 | Werkgever | 100% | 4 weken na de geboorte |
| Aanvullend geboorteverlof | 5 | UWV | 70% van het dagloon | 6 maanden na de geboorte |
| Betaald ouderschapsverlof | 9 | UWV | 70% van het dagloon | dag vóór de 1e verjaardag |
| Onbetaald ouderschapsverlof | 17 | — | 0% | tot het kind 8 jaar is |

- **Dagloon** = bruto maandsalaris ÷ 21,75.
- **Doorschuiven.** Ouderschapsverlof is één pot van 26 weken waarvan er 9
  betaald zijn. Neem je die betaalde weken niet op vóór de eerste verjaardag,
  dan vervalt de uitkering maar niet het verlofrecht: het restant verhuist naar
  het onbetaalde saldo.
- **Contractwissel.** Elke verlofdag rekent met het contract dat op díe dag
  gold. Het verlofrecht zelf wordt vastgesteld met de contracturen op de
  geboortedatum van het kind.
- **Bovenwettelijke afspraken** leg je per contract vast (aanvulling tot een
  percentage, extra weken, ruimere termijn).

## Netto salaris

Vul je bij het contract de posten van je loonstrook in, dan rekent de app je
nettoloon uit, ook in een maand met verlof:

```
brutoloon + bruto kostentoeslag
  − pensioenpremie, WGA Hiaat, WIA Excedent
  + bijtelling
  = heffingsloon
  − loonbelasting/premie volksverzekeringen
  = nettoloon
  + onkostenvergoeding
  = netto te ontvangen
```

De loonheffing volgt de witte tabel (maandloon × 12, schijventarief, algemene
heffingskorting en arbeidskorting eraf, gedeeld door 12). De tarieven staan in
[`server/src/domain/loonheffing.ts`](server/src/domain/loonheffing.ts); voeg
daar een nieuw peiljaar toe zodra de Belastingdienst het publiceert. Reken op
een afwijking tot ongeveer een euro per maand ten opzichte van de officiële
tabellen.

## Ontwikkelen

```bash
cd server && npm test   # rekenkern; met DB_* naar een lege database ook de API-tests
cd client && npm test   # kalenderlogica en datumnotatie
```

Commitberichten zijn [Conventional Commits](CLAUDE.md#commitberichten): elke
merge naar `main` gaat direct live, en de geschiedenis van `main` laat zo zien
wat elke deploy deed.

## Deploy

1. Werk op een branch en open een PR naar `main`. Elke push daarop komt op
   **verlof-acc.shelly-nas.nl**, met een verse database met demodata.
2. **Mergen is releasen:** elke push naar `main` bouwt de images (getagd met de
   commit) en deployt ze direct naar **verlof.shelly-nas.nl**. `GET /api/health`
   meldt de commit die draait.
3. Acc wordt afgebroken zodra de PR sluit.

Opnieuw deployen of terugrollen: *Actions → Build & Deploy to Production → Run
workflow* op `main` of op een branch of tag met een eerdere commit (of revert de
commit en merge de revert).

### Productiedata

De productiedatabase staat in het externe Docker-volume
**`verlof-ouderschap_pgdata`**: het volume waarin de eerdere Next.js-versie van
de app haar data al bewaarde, dus die data gaat zonder kopiëren mee.

- De deploy maakt het volume alleen aan als het ontbreekt (`persistent_volumes`
  in `deploy.yml`) en verwijdert het nooit. Elke deploy, dus elke merge naar
  `main`, start de nieuwe containers op hetzelfde volume.
- Compose beheert een extern volume niet: `docker compose down -v` laat het
  staan, net als de opschoonstappen van de shared-workflows.
- Weggooien kan alleen bewust: `docker volume rm verlof-ouderschap_pgdata`.

De eerste deploy van deze versie ruimt ook de oude `app`-container van de
Next.js-versie op (`--remove-orphans`), zodat die niet naast de nieuwe stack
blijft draaien.

### Eenmalig in de GitHub-repo

*Settings → Secrets and variables → Actions*: variables `REGISTRY_URL` en
`REGISTRY_USERNAME`; secrets `REGISTRY_PASSWORD` en het databasewachtwoord. De
workflows lezen `DB_PASSWORD`, `DB_USER` en `DB_NAME`, en vallen terug op de
oude namen `POSTGRES_PASSWORD`, `POSTGRES_USER` en `POSTGRES_DB` (gebruiker en
database standaard `verlof`). Het bestaande `POSTGRES_PASSWORD` volstaat dus en
past bij de bestaande data.

Let op: er zit geen login op de app. Hij is alleen bedoeld voor het eigen
netwerk achter Traefik.
