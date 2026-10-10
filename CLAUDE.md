# verlof-ouderschap

Deze app volgt de shelly-nas standaarden uit de plugin **`shelly-fundamentals@shelly-nas`**
(repo `shelly-nas/shelly-fundamentals`). Gebruik de skills daaruit: `stack-voorkeuren`, `docker-traefik`,
`release-deploy`, `database-migraties`, `conventional-commits` en `design-richtlijnen`.

Is de plugin niet geladen, dan gelden in elk geval deze regels:

- **Stack:** React + Vite + TypeScript + MUI (`client/`), Node 22 + Express + TypeScript (`server/`, poort 3000, alles onder
  `/api`, met `GET /api/health`), PostgreSQL 16 (`database/`).
- **Lokaal:** `docker-compose.yml` bouwt vanuit de broncode. **Productie:** `docker-compose.prod.yml`
  gebruikt alleen images met een gepinde `IMAGE_TAG`, achter Traefik op `shelly-network`, op
  `verlof.shelly-nas.nl`.
- **Acc:** elke PR naar `main` wordt gedeployd naar `verlof-acc.shelly-nas.nl` via
  `docker-compose.acc.yml` en `.github/workflows/acc.yml`, met een verse database met demodata.
  Houd `docker-compose.acc.yml` gelijk aan prod, op namen en host na.
- **Geheimen** staan alleen in `.env` (niet in git) en in GitHub-secrets. Een nieuwe env-variabele
  komt in `docker-compose.prod.yml` én `docker-compose.acc.yml`, in `env_file_content` van `deploy.yml` én `acc.yml`, en in `.env.example`.
- **Schemawijzigingen:** vóór 1.0.0 in `database/init.sql`. Daarna als idempotente, additieve
  migratie `server/migrations/NNN_*.sql`, en `init.sql` wordt meegewerkt.

## Commitberichten

Versiebeheer is automatisch: release-please leidt de volgende versie af uit de commitberichten op
`main`. **Elke commit is daarom een Conventional Commit.**

| Prefix | Bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` in de body | major |
| `perf:` `refactor:` `docs:` `test:` `ci:` `build:` `chore:` | geen |

Eén logische wijziging per commit. De samenvatting in de gebiedende wijs en met een kleine letter.
Pas nooit handmatig een versienummer aan.
