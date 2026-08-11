import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` draait tijdens de Docker-build, waar nog geen database is.
// Daarom hier geen env() dat meteen gooit: de URL is alleen vereist voor
// commando's die de database echt aanspreken (migrate, seed, studio), en die
// melden zelf een duidelijke fout als hij ontbreekt.
const databaseUrl = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
