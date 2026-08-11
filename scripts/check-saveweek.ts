/**
 * Controleert het opslaan van een week via de draaiende app (POST /api/entries):
 * het diff-gedrag (toevoegen, wijzigen, verwijderen), de contracttoewijzing per
 * dag en de weigering van ongeldige invoer.
 *
 * Vereist een draaiende dev-server. Draai met `npx tsx scripts/check-saveweek.ts`.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { formatDateOnly } from "../src/lib/dates";

const BASE = process.env.APP_URL ?? "http://localhost:3000";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "OK  " : "FOUT"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (verwacht ${JSON.stringify(expected)})`}`,
  );
}

type Row = { date: string; childId: string; leaveTypeId: string; hours: number };

async function saveWeek(weekStart: string, rows: Row[]) {
  const response = await fetch(`${BASE}/api/entries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weekStart, rows }),
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  const child = await prisma.child.findFirstOrThrow();
  const betaaldOv = await prisma.leaveType.findFirstOrThrow({
    where: { code: "BETAALD_OUDERSCHAPSVERLOF" },
  });
  const aanvullend = await prisma.leaveType.findFirstOrThrow({
    where: { code: "AANVULLEND_GEBOORTEVERLOF" },
  });
  const contractA = await prisma.contract.findFirstOrThrow({
    where: { employerName: "Werkgever X" },
  });
  const contractB = await prisma.contract.findFirstOrThrow({
    where: { employerName: "Werkgever Y" },
  });

  await prisma.leaveEntry.deleteMany();

  console.log("\n== Week 14 2026 opslaan (kruist de contractwissel) ==");
  const first = await saveWeek("2026-03-30", [
    { date: "2026-03-30", childId: child.id, leaveTypeId: betaaldOv.id, hours: 8 },
    { date: "2026-03-31", childId: child.id, leaveTypeId: betaaldOv.id, hours: 8 },
    { date: "2026-04-02", childId: child.id, leaveTypeId: betaaldOv.id, hours: 8 },
  ]);
  check("opslaan slaagt", first.body.ok, true);

  const saved = await prisma.leaveEntry.findMany({ orderBy: { date: "asc" } });
  check("drie verlofdagen opgeslagen", saved.length, 3);
  check(
    "maandag 30 maart krijgt contract A (40 u/wk)",
    saved.find((e) => formatDateOnly(e.date) === "2026-03-30")?.contractId,
    contractA.id,
  );
  check(
    "donderdag 2 april krijgt contract B (32 u/wk)",
    saved.find((e) => formatDateOnly(e.date) === "2026-04-02")?.contractId,
    contractB.id,
  );

  console.log("\n== Diff: wijzigen, verwijderen en toevoegen in één opslag ==");
  const second = await saveWeek("2026-03-30", [
    { date: "2026-03-30", childId: child.id, leaveTypeId: betaaldOv.id, hours: 4 },
    { date: "2026-04-02", childId: child.id, leaveTypeId: betaaldOv.id, hours: 8 },
    { date: "2026-04-02", childId: child.id, leaveTypeId: aanvullend.id, hours: 2 },
  ]);
  check("tweede opslag slaagt", second.body.ok, true);

  const after = await prisma.leaveEntry.findMany({ orderBy: [{ date: "asc" }] });
  check("nu drie regels", after.length, 3);
  check(
    "30 maart bijgewerkt naar 4 uur",
    Number(after.find((e) => formatDateOnly(e.date) === "2026-03-30")!.hours.toString()),
    4,
  );
  check(
    "31 maart verwijderd",
    after.some((e) => formatDateOnly(e.date) === "2026-03-31"),
    false,
  );
  check(
    "twee verlofsoorten op 2 april",
    after.filter((e) => formatDateOnly(e.date) === "2026-04-02").length,
    2,
  );

  console.log("\n== Idempotent: dezelfde week nogmaals opslaan ==");
  const rows: Row[] = after.map((e) => ({
    date: formatDateOnly(e.date),
    childId: e.childId,
    leaveTypeId: e.leaveTypeId,
    hours: Number(e.hours.toString()),
  }));
  await saveWeek("2026-03-30", rows);
  check("aantal regels ongewijzigd", await prisma.leaveEntry.count(), after.length);

  console.log("\n== Weigeringen ==");
  const outsideWeek = await saveWeek("2026-03-30", [
    { date: "2026-04-20", childId: child.id, leaveTypeId: betaaldOv.id, hours: 8 },
  ]);
  check("dag buiten de week wordt geweigerd", outsideWeek.body.ok, false);

  const noContract = await saveWeek("2024-01-01", [
    { date: "2024-01-01", childId: child.id, leaveTypeId: betaaldOv.id, hours: 8 },
  ]);
  check("dag zonder contract wordt geweigerd", noContract.body.ok, false);
  if (noContract.body.errors) console.log(`     melding: ${noContract.body.errors[0]}`);

  const duplicate = await saveWeek("2026-03-30", [
    { date: "2026-03-30", childId: child.id, leaveTypeId: betaaldOv.id, hours: 4 },
    { date: "2026-03-30", childId: child.id, leaveTypeId: betaaldOv.id, hours: 4 },
  ]);
  check("dubbele regel wordt geweigerd", duplicate.body.ok, false);

  const badHours = await saveWeek("2026-03-30", [
    { date: "2026-03-30", childId: child.id, leaveTypeId: betaaldOv.id, hours: 30 },
  ]);
  check("meer dan 24 uur op een dag wordt geweigerd", badHours.body.ok, false);

  console.log("\n== Lege week wist de regels ==");
  await saveWeek("2026-03-30", []);
  check("week is leeg", await prisma.leaveEntry.count(), 0);

  console.log(
    `\n${failures === 0 ? "Alle controles geslaagd." : `${failures} controle(s) mislukt.`}`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
