FROM node:22

WORKDIR /server

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src ./src

# Migrations are read at runtime, not compiled - they have to ship as files.
COPY migrations ./migrations

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
