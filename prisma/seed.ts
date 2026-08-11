import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL ontbreekt.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Kalenderdatum zonder tijdcomponent, zoals @db.Date die opslaat. */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export const LEAVE_TYPE_CODES = {
  GEBOORTEVERLOF: "GEBOORTEVERLOF",
  AANVULLEND_GEBOORTEVERLOF: "AANVULLEND_GEBOORTEVERLOF",
  BETAALD_OUDERSCHAPSVERLOF: "BETAALD_OUDERSCHAPSVERLOF",
  ONBETAALD_OUDERSCHAPSVERLOF: "ONBETAALD_OUDERSCHAPSVERLOF",
} as const;

async function main() {
  // Maximumdaglonen. Wijzigen elke 1 januari en 1 juli; de UI kan nieuwe rijen
  // toevoegen zodat een nieuwe halfjaarwaarde geen deploy vergt.
  const maxDaglonen = [
    { validFrom: "2025-01-01", amount: "290.67" },
    { validFrom: "2025-07-01", amount: "297.82" },
    { validFrom: "2026-01-01", amount: "309.91" },
  ];

  for (const row of maxDaglonen) {
    await prisma.maxDagloon.upsert({
      where: { validFrom: d(row.validFrom) },
      update: { amount: row.amount },
      create: {
        validFrom: d(row.validFrom),
        amount: row.amount,
        source: "https://www.uwv.nl/nl/premies-bedragen/maximum-dagloon",
      },
    });
  }

  // Onbetaald ouderschapsverlof eerst: betaald OV verwijst ernaar als fallback
  // voor het restant dat na de eerste verjaardag doorschuift.
  const onbetaaldOv = await prisma.leaveType.upsert({
    where: { code: LEAVE_TYPE_CODES.ONBETAALD_OUDERSCHAPSVERLOF },
    update: {},
    create: {
      code: LEAVE_TYPE_CODES.ONBETAALD_OUDERSCHAPSVERLOF,
      name: "Onbetaald ouderschapsverlof",
      weeksMultiplier: "17",
      payer: "UNPAID",
      payPercent: null,
      cappedAtMaxDagloon: false,
      deadlineAnchor: "YEARS_AFTER_BIRTH",
      deadlineValue: 8,
      colorHex: "#94a3b8",
      sortOrder: 40,
    },
  });

  await prisma.leaveType.upsert({
    where: { code: LEAVE_TYPE_CODES.GEBOORTEVERLOF },
    update: {},
    create: {
      code: LEAVE_TYPE_CODES.GEBOORTEVERLOF,
      name: "Geboorteverlof",
      weeksMultiplier: "1",
      payer: "EMPLOYER",
      payPercent: "100",
      cappedAtMaxDagloon: false,
      deadlineAnchor: "WEEKS_AFTER_BIRTH",
      deadlineValue: 4,
      colorHex: "#22c55e",
      sortOrder: 10,
    },
  });

  await prisma.leaveType.upsert({
    where: { code: LEAVE_TYPE_CODES.AANVULLEND_GEBOORTEVERLOF },
    update: {},
    create: {
      code: LEAVE_TYPE_CODES.AANVULLEND_GEBOORTEVERLOF,
      name: "Aanvullend geboorteverlof",
      weeksMultiplier: "5",
      payer: "UWV",
      payPercent: "70",
      cappedAtMaxDagloon: true,
      deadlineAnchor: "MONTHS_AFTER_BIRTH",
      deadlineValue: 6,
      colorHex: "#3b82f6",
      sortOrder: 20,
    },
  });

  await prisma.leaveType.upsert({
    where: { code: LEAVE_TYPE_CODES.BETAALD_OUDERSCHAPSVERLOF },
    update: { fallbackLeaveTypeId: onbetaaldOv.id },
    create: {
      code: LEAVE_TYPE_CODES.BETAALD_OUDERSCHAPSVERLOF,
      name: "Betaald ouderschapsverlof",
      weeksMultiplier: "9",
      payer: "UWV",
      payPercent: "70",
      cappedAtMaxDagloon: true,
      deadlineAnchor: "YEARS_AFTER_BIRTH",
      deadlineValue: 1,
      fallbackLeaveTypeId: onbetaaldOv.id,
      colorHex: "#8b5cf6",
      sortOrder: 30,
    },
  });

  const types = await prisma.leaveType.count();
  const daglonen = await prisma.maxDagloon.count();
  console.log(`Seed klaar: ${types} verlofsoorten, ${daglonen} maximumdaglonen.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
