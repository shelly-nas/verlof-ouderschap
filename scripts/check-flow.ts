/**
 * Doorloopt de handmatige testflow uit het plan tegen de echte database:
 * een week die de contractwissel kruist, de salarisimpact per maand en de
 * doorschuifregel. Draai met `npx tsx scripts/check-flow.ts`.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { balanceKey, balanceMap, balancesFor } from "../src/lib/balances";
import { contractForDate } from "../src/lib/contracts";
import { formatDateOnly } from "../src/lib/dates";
import { formatEuro, toNumber, toNumberOrNull } from "../src/lib/money";
import { monthImpact } from "../src/lib/salary";
import { buildLeaveEmail } from "../src/lib/mailto";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function load() {
  const [contractRows, childRows, typeRows, supplementRows, entryRows] =
    await Promise.all([
      prisma.contract.findMany(),
      prisma.child.findMany(),
      prisma.leaveType.findMany(),
      prisma.employerSupplement.findMany(),
      prisma.leaveEntry.findMany(),
    ]);

  return {
    contracts: contractRows.map((row) => ({
      id: row.id,
      employerName: row.employerName,
      employerEmail: row.employerEmail,
      hoursPerWeek: toNumber(row.hoursPerWeek),
      grossMonthlySalary: toNumber(row.grossMonthlySalary),
      startDate: formatDateOnly(row.startDate),
      endDate: row.endDate ? formatDateOnly(row.endDate) : null,
    })),
    children: childRows.map((row) => ({
      id: row.id,
      name: row.name,
      dateOfBirth: formatDateOnly(row.dateOfBirth),
    })),
    leaveTypes: typeRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      weeksMultiplier: toNumber(row.weeksMultiplier),
      payer: row.payer,
      payPercent: toNumberOrNull(row.payPercent),
      deadlineAnchor: row.deadlineAnchor,
      deadlineValue: row.deadlineValue,
      fallbackLeaveTypeId: row.fallbackLeaveTypeId,
      colorHex: row.colorHex,
      sortOrder: row.sortOrder,
    })),
    supplements: supplementRows.map((row) => ({
      contractId: row.contractId,
      leaveTypeId: row.leaveTypeId,
      topUpToPercent: toNumberOrNull(row.topUpToPercent),
      extraWeeks: toNumberOrNull(row.extraWeeks),
      deadlineOverrideMonths: row.deadlineOverrideMonths,
    })),
    entries: entryRows.map((row) => ({
      id: row.id,
      date: formatDateOnly(row.date),
      hours: toNumber(row.hours),
      childId: row.childId,
      leaveTypeId: row.leaveTypeId,
    })),
  };
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "OK  " : "FOUT"} ${label}: ${actual}${ok ? "" : ` (verwacht ${expected})`}`);
}

async function main() {
  let data = await load();
  const child = data.children[0];
  const betaaldOv = data.leaveTypes.find(
    (type) => type.code === "BETAALD_OUDERSCHAPSVERLOF",
  )!;
  const onbetaaldOv = data.leaveTypes.find(
    (type) => type.code === "ONBETAALD_OUDERSCHAPSVERLOF",
  )!;

  console.log("\n== Stap 5: week die de contractwissel kruist ==");
  await prisma.leaveEntry.deleteMany();
  const aanvullend = data.leaveTypes.find(
    (type) => type.code === "AANVULLEND_GEBOORTEVERLOF",
  )!;

  // Maandag 30 en dinsdag 31 maart vallen onder contract A (40 u/wk),
  // donderdag 2 en vrijdag 3 april onder contract B (32 u/wk).
  for (const date of ["2026-03-30", "2026-03-31", "2026-04-02", "2026-04-03"]) {
    const contract = contractForDate(data.contracts, date)!;
    await prisma.leaveEntry.create({
      data: {
        date: d(date),
        hours: "8",
        childId: child.id,
        leaveTypeId: aanvullend.id,
        contractId: contract.id,
      },
    });
  }

  data = await load();
  const maart = monthImpact({ month: "2026-03", ...data });
  const april = monthImpact({ month: "2026-04", ...data });

  check("maart: dagequivalenten (2 × 8u bij 40u/wk)", maart.leaveDayEquivalents, 2);
  check("april: dagequivalenten (2 × 8u bij 32u/wk)", april.leaveDayEquivalents, 2.5);
  console.log(
    `     maart UWV ${formatEuro(maart.uwvBenefit)} (dagloon ${formatEuro(4000 / 21.75)})`,
  );
  console.log(
    `     april UWV ${formatEuro(april.uwvBenefit)} (dagloon ${formatEuro(3400 / 21.75)})`,
  );
  check(
    "maart rekent met contract A",
    Math.round(maart.uwvBenefit * 100) / 100,
    Math.round(2 * 0.7 * (4000 / 21.75) * 100) / 100,
  );
  check(
    "april rekent met contract B",
    Math.round(april.uwvBenefit * 100) / 100,
    Math.round(2.5 * 0.7 * (3400 / 21.75) * 100) / 100,
  );

  console.log("\n== Stap 6: werkgeversaanvulling tot 100% ==");
  const contractA = data.contracts.find((c) => c.employerName === "Werkgever X")!;
  await prisma.employerSupplement.create({
    data: {
      contractId: contractA.id,
      leaveTypeId: aanvullend.id,
      topUpToPercent: "100",
    },
  });
  data = await load();
  const maartMetAanvulling = monthImpact({ month: "2026-03", ...data });
  check(
    "verlies is 0 met aanvulling tot 100%",
    Math.abs(maartMetAanvulling.difference) < 0.005,
    true,
  );
  await prisma.employerSupplement.deleteMany();

  console.log("\n== Doorschuifregel betaald -> onbetaald OV ==");
  await prisma.leaveEntry.deleteMany();
  await prisma.leaveEntry.create({
    data: {
      date: d("2026-06-01"),
      hours: "80",
      childId: child.id,
      leaveTypeId: betaaldOv.id,
      contractId: data.contracts.find((c) => c.employerName === "Werkgever Y")!.id,
    },
  });
  data = await load();

  const voor = balanceMap(balancesFor({ ...data, today: "2027-01-31" }));
  const na = balanceMap(balancesFor({ ...data, today: "2027-02-01" }));
  check(
    "vóór de verjaardag: 280 uur betaald OV over",
    voor.get(balanceKey(child.id, betaaldOv.id))!.remainingHours,
    280,
  );
  check(
    "vóór de verjaardag: onbetaald OV 680 uur",
    voor.get(balanceKey(child.id, onbetaaldOv.id))!.entitledHours,
    680,
  );
  check(
    "ná de verjaardag: betaald OV op 0",
    na.get(balanceKey(child.id, betaaldOv.id))!.remainingHours,
    0,
  );
  check(
    "ná de verjaardag: onbetaald OV 960 uur",
    na.get(balanceKey(child.id, onbetaaldOv.id))!.entitledHours,
    960,
  );
  check(
    "totaal recht blijft 26 weken (1040 uur)",
    na.get(balanceKey(child.id, betaaldOv.id))!.usedHours +
      na.get(balanceKey(child.id, onbetaaldOv.id))!.entitledHours,
    1040,
  );

  console.log("\n== Stap 8: mailto ==");
  await prisma.leaveEntry.deleteMany();
  const contractY = data.contracts.find((c) => c.employerName === "Werkgever Y")!;
  for (const day of [1, 2, 3, 4, 7, 8, 9, 10, 11]) {
    await prisma.leaveEntry.create({
      data: {
        date: d(`2026-09-${`${day}`.padStart(2, "0")}`),
        hours: "6.4",
        childId: child.id,
        leaveTypeId: betaaldOv.id,
        contractId: contractY.id,
      },
    });
  }
  data = await load();
  const mail = buildLeaveEmail({
    employerName: contractY.employerName,
    employerEmail: contractY.employerEmail,
    entries: data.entries,
    children: data.children,
    leaveTypes: data.leaveTypes,
    monthStart: "2026-09-01",
  });
  check("mail bevat 9 verlofdagen", mail.entryCount, 9);
  check("mail telt 57,6 uur", mail.totalHours, 57.6);
  console.log(`     link is ${mail.length} tekens, tooLong=${mail.tooLong}`);
  console.log("---- mailtekst ----");
  console.log(mail.body);
  console.log("-------------------");

  // Genoeg dagen om de fallback te triggeren.
  const many = Array.from({ length: 22 }, (_, index) => ({
    id: `x${index}`,
    date: `2026-09-${`${index + 1}`.padStart(2, "0")}`,
    hours: 6.4,
    childId: child.id,
    leaveTypeId: betaaldOv.id,
  }));
  const longMail = buildLeaveEmail({
    employerName: contractY.employerName,
    employerEmail: contractY.employerEmail,
    entries: many,
    children: data.children,
    leaveTypes: data.leaveTypes,
    monthStart: "2026-09-01",
  });
  check("volle maand triggert de kopieer-fallback", longMail.tooLong, true);

  console.log(
    `\n${failures === 0 ? "Alle controles geslaagd." : `${failures} controle(s) mislukt.`}`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
