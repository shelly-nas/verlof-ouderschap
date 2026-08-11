import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ontbreekt. Kopieer .env.example naar .env.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * De client wordt pas aangemaakt bij de eerste query, niet bij het laden van de
 * module. Anders faalt `next build` — die verzamelt paginadata zonder database —
 * op een ontbrekende DATABASE_URL.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = (globalForPrisma.prisma ??= createClient());
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
