/**
 * Testdata voor de handmatige controle: twee contracten met een wissel op
 * 1 april 2026 en één kind. Draai met `npx tsx scripts/seed-testdata.ts`.
 * Verwijdert bestaande contracten, kinderen en verlofdagen.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function main() {
  await prisma.leaveEntry.deleteMany();
  await prisma.employerSupplement.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.child.deleteMany();

  const contractA = await prisma.contract.create({
    data: {
      employerName: "Werkgever X",
      employerEmail: "hr@werkgeverx.nl",
      hoursPerWeek: "40",
      grossMonthlySalary: "4000",
      startDate: d("2025-01-01"),
      endDate: d("2026-03-31"),
    },
  });

  const contractB = await prisma.contract.create({
    data: {
      employerName: "Werkgever Y",
      employerEmail: "hr@werkgevery.nl",
      hoursPerWeek: "32",
      grossMonthlySalary: "3400",
      startDate: d("2026-04-01"),
      endDate: null,
    },
  });

  const child = await prisma.child.create({
    data: { name: "Test", dateOfBirth: d("2026-02-01") },
  });

  console.log(
    JSON.stringify({ contractA: contractA.id, contractB: contractB.id, child: child.id }),
  );
}

main().finally(() => prisma.$disconnect());
