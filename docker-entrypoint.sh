#!/bin/sh
set -e

# De Prisma CLI woont in een eigen map, los van de standalone app-bundel.
PRISMA="./migrate-tools/node_modules/.bin/prisma"
export NODE_PATH="/app/migrate-tools/node_modules"

echo "Migraties toepassen…"
"$PRISMA" migrate deploy --schema ./prisma/schema.prisma

# De seed is idempotent (upsert): hij houdt de wettelijke verlofsoorten en de
# maximumdaglonen op peil zonder bestaande registraties te raken.
if [ "${SKIP_SEED:-false}" != "true" ]; then
  echo "Seed uitvoeren…"
  ./migrate-tools/node_modules/.bin/tsx ./prisma/seed.ts || echo "Seed overgeslagen."
fi

echo "App starten…"
exec "$@"
