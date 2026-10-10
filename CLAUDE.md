# verlof-ouderschap

Deze app volgt de shelly-nas standaarden uit de plugin **`shelly-fundamentals@shelly-nas`**
(repo `shelly-nas/shelly-fundamentals`). Gebruik de skills daaruit: `stack-voorkeuren`, `docker-traefik`,
`release-deploy`, `database-migraties`, `conventional-commits` en `design-richtlijnen`.

Is de plugin niet geladen, dan gelden in elk geval deze regels:

- **Stack:** React + Vite + TypeScript + MUI (`client/`), Node 22 + Express + TypeScript (`server/`, poort 3000, alles onder
  `/api`, met `GET /api/health`), PostgreSQL 16 (`database/`).
- **Lokaal:** `docker-compose.yml` bouwt vanuit de broncode. **Productie:** `docker-compose.prod.yml`
  gebruikt alleen images met een gepinde `IMAGE_TAG` (de commit), achter Traefik op `shelly-network`, op
  `verlof.shelly-nas.nl`. Elke merge naar `main` deployt direct naar productie.
- **Productiedata** staat in het externe Docker-volume `verlof-ouderschap_pgdata` (het volume van de eerdere Next.js-versie). Een deploy maakt het aan als het
  ontbreekt en verwijdert het nooit; zet de naam in `docker-compose.prod.yml` en `persistent_volumes` in `deploy.yml`.
- **Acc:** elke PR naar `main` wordt gedeployd naar `verlof-acc.shelly-nas.nl` via
  `docker-compose.acc.yml` en `.github/workflows/acc.yml`, met een verse database met demodata, en
  afgebroken zodra de PR sluit. Houd `docker-compose.acc.yml` gelijk aan prod, op namen, host en
  databaseopslag (bind mount in plaats van het externe volume) na.
- **Geheimen** staan alleen in `.env` (niet in git) en in GitHub-secrets. Een nieuwe env-variabele
  komt in `docker-compose.prod.yml` én `docker-compose.acc.yml`, in `env_file_content` van `deploy.yml` én `acc.yml`, en in `.env.example`.
- **Schemawijzigingen:** vóór de eerste productiedeploy in `database/init.sql`. Daarna als idempotente,
  additieve migratie `server/migrations/NNN_*.sql`, en `init.sql` wordt meegewerkt.

## Commitberichten

Elke merge naar `main` gaat direct naar productie; de geschiedenis van `main` is het logboek van
wat er live ging. **Elke commit is daarom een Conventional Commit** (`fix:`, `feat:`, `feat!:` voor
iets dat een API, het schema of het deploycontract breekt, en `perf:` `refactor:` `docs:` `test:`
`ci:` `build:` `chore:` voor de rest). Bij een squash-merge geldt dat ook voor de PR-titel.

Eén logische wijziging per commit. De samenvatting in de gebiedende wijs en met een kleine letter.
