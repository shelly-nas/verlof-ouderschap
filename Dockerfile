# Productie-image: multi-stage build met Next.js standalone output.

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies apart, zodat een codewijziging de npm-installatie niet ongeldig maakt.
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall draait prisma generate; dat heeft geen database nodig.
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Losse laag met alleen de migratiegereedschappen. De Prisma CLI heeft een brede
# set eigen dependencies; die uit elkaar plukken is fragiel, dus installeren we
# ze hier apart in plaats van ze uit de app-node_modules te vissen.
FROM base AS migrator
COPY package.json package-lock.json ./
RUN npm install --no-save prisma@$(node -p "require('./package.json').devDependencies.prisma.replace(/[^0-9.]/g,'')") tsx dotenv @prisma/adapter-pg pg

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone bundelt de server met alleen de gebruikte dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migraties en seed draaien bij het starten.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=migrator --chown=nextjs:nodejs /app/node_modules ./migrate-tools/node_modules
COPY --from=migrator --chown=nextjs:nodejs /app/package.json ./migrate-tools/package.json

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
