# Migraties

Leeg, en dat is zo bedoeld: vóór 1.0.0 staat het volledige schema in
`database/init.sql`. Een schemawijziging gaat daar rechtstreeks in, gevolgd door
een schone start (`docker compose down -v && docker compose up --build`).

`init.sql` is gelijk aan het schema dat de eerdere Prisma-versie van de app na
haar laatste migratie had (alleen `updatedAt` kreeg een standaardwaarde, die de
server niet nodig heeft omdat hij de kolom zelf vult). Een bestaande database
kan daardoor zonder migratie worden overgenomen.

Vanaf het moment dat de app ergens met data draait die je wilt houden, wordt
elke schemawijziging een migratie `NNN_omschrijving.sql` in deze map:
opeenvolgend genummerd, idempotent (`IF NOT EXISTS`) en additief. De server
past openstaande migraties bij het opstarten toe en legt in
`schema_migrations` vast wat al gedraaid heeft. Werk `init.sql` in dezelfde
commit mee bij.
