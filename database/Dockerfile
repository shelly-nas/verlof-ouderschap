# Production database image.
#
# The schema is baked in rather than bind-mounted: the deploy workflow copies
# only docker-compose.prod.yml to the host, so a host path like
# ./database/init.sql cannot resolve there - Docker would silently create an
# empty directory in its place and Postgres would start with no schema.
#
# Both files run on the first start of an empty data volume, in filename order.
# seed-demo.sql is deliberately left out: demo data is for local use only.
FROM postgres:16-alpine

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql
COPY seed.sql /docker-entrypoint-initdb.d/02-seed.sql
