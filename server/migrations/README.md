# Migraties

De productiedatabase draait al met echte data (het volume
`verlof-ouderschap_pgdata`, overgenomen van de eerdere Prisma-versie van de
app). Elke schemawijziging is daarom een migratie `NNN_omschrijving.sql` in
deze map: opeenvolgend genummerd, idempotent (`IF NOT EXISTS`) en additief. De
server past openstaande migraties bij het opstarten toe en legt in
`schema_migrations` vast wat al gedraaid heeft. Werk `database/init.sql` in
dezelfde commit mee bij, zodat een verse installatie (lokaal, CI, acc) hetzelfde
schema krijgt.

De map is nog leeg omdat `init.sql` gelijk is aan het schema dat de
Prisma-versie na haar laatste migratie had (alleen `updatedAt` kreeg een
standaardwaarde, die de server niet nodig heeft omdat hij de kolom zelf vult).
De bestaande database kon daardoor zonder migratie worden overgenomen.
