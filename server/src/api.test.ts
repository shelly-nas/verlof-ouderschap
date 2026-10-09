/**
 * Integratietest tegen een echte Postgres met init.sql en seed.sql erop, zoals
 * CI die klaarzet. Zonder DB_HOST, of als er al contracten in de database
 * staan, wordt hij overgeslagen: hij maakt zijn eigen gegevens aan en ruimt
 * na afloop alles op.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "./app";
import { closePool, getPool } from "./db";
import { runMigrations } from "./migrations";

async function databaseIsEmpty(): Promise<boolean> {
  if (!process.env.DB_HOST) return false;
  try {
    const { rows } = await getPool().query<{ count: string }>(`SELECT COUNT(*) AS count FROM "Contract"`);
    return rows[0].count === "0";
  } catch {
    return false;
  }
}

describe("API tegen Postgres", async () => {
  const usable = await databaseIsEmpty();
  if (!usable) await closePool();

  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  async function call(method: string, path: string, body?: unknown) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testantwoorden
    return { status: response.status, json: (await response.json()) as any };
  }

  before(async () => {
    if (!usable) return;
    await runMigrations();
    const server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((resolve) => server.close(() => resolve()));
  });

  after(async () => {
    if (!usable) return;
    const pool = getPool();
    await pool.query(`DELETE FROM "LeaveEntry"`);
    await pool.query(`DELETE FROM "Contract"`);
    await pool.query(`DELETE FROM "Child"`);
    await pool.query(`DELETE FROM "LeaveType" WHERE "isStatutory" = false`);
    await close();
    await closePool();
  });

  it("meldt de status en versie", { skip: !usable }, async () => {
    const { status, json } = await call("GET", "/health");
    assert.equal(status, 200);
    assert.equal(json.status, "ok");
    assert.match(json.version, /^\d+\.\d+\.\d+/);
  });

  it("boekt verlof over een contractwissel heen op het juiste contract", { skip: !usable }, async () => {
    const contractA = await call("POST", "/contracts", {
      employerName: "Werkgever X",
      employerEmail: "hr@werkgeverx.nl",
      hoursPerWeek: "40",
      grossMonthlySalary: "4000",
      startDate: "2025-01-01",
      endDate: "2026-03-31",
      supplements: [],
    });
    assert.equal(contractA.status, 200, JSON.stringify(contractA.json));

    const contractB = await call("POST", "/contracts", {
      employerName: "Werkgever Y",
      employerEmail: "hr@werkgevery.nl",
      hoursPerWeek: 32,
      grossMonthlySalary: 3400,
      startDate: "2026-04-01",
      endDate: "",
      pensionPercent: "7,5",
      pensionBase: "2500",
      applyTaxCredits: true,
      supplements: [],
    });
    assert.equal(contractB.status, 200, JSON.stringify(contractB.json));

    assert.equal((await call("POST", "/children", { name: "Test", dateOfBirth: "2026-02-01" })).status, 200);

    const { json: children } = await call("GET", "/children");
    const childId = children.children[0].id;
    const { json: leaveTypes } = await call("GET", "/leave-types");
    const betaald = leaveTypes.find((type: { code: string }) => type.code === "BETAALD_OUDERSCHAPSVERLOF");

    const saved = await call("POST", "/entries", {
      from: "2026-03-30",
      to: "2026-04-01",
      rows: [
        { date: "2026-03-31", childId, leaveTypeId: betaald.id, hours: 8 },
        { date: "2026-04-01", childId, leaveTypeId: betaald.id, hours: 6.4 },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.json));

    const { rows } = await getPool().query<{ date: string; contractId: string }>(
      `SELECT "date", "contractId" FROM "LeaveEntry" ORDER BY "date"`,
    );
    assert.deepEqual(
      rows.map((row) => [row.date, row.contractId]),
      [
        ["2026-03-31", contractA.json.data.id],
        ["2026-04-01", contractB.json.data.id],
      ],
    );

    // Een ingekorte looptijd verhuist de verlofdag naar het andere contract.
    await call("PUT", `/contracts/${contractB.json.data.id}`, {
      employerName: "Werkgever Y",
      employerEmail: "hr@werkgevery.nl",
      hoursPerWeek: 32,
      grossMonthlySalary: 3400,
      startDate: "2026-03-31",
      endDate: null,
      pensionPercent: 7.5,
      pensionBase: 2500,
      supplements: [],
    });
    const { rows: moved } = await getPool().query<{ contractId: string }>(
      `SELECT "contractId" FROM "LeaveEntry" WHERE "date" = '2026-03-31'`,
    );
    assert.equal(moved[0].contractId, contractB.json.data.id);
  });

  it("weigert verlof op een dag zonder contract", { skip: !usable }, async () => {
    const { json: children } = await call("GET", "/children");
    const { json: leaveTypes } = await call("GET", "/leave-types");
    const result = await call("PUT", "/months/2024-06", {
      rows: [{ date: "2024-06-03", childId: children.children[0].id, leaveTypeId: leaveTypes[0].id, hours: 8 }],
    });
    assert.equal(result.status, 400);
    assert.match(result.json.errors[0], /Geen contract gevonden/);
  });

  it("vervangt een hele maand en kopieert hem naar de volgende", { skip: !usable }, async () => {
    const { json: children } = await call("GET", "/children");
    const { json: leaveTypes } = await call("GET", "/leave-types");
    const childId = children.children[0].id;
    const leaveTypeId = leaveTypes[0].id;

    const save = await call("PUT", "/months/2026-05", {
      rows: [
        { date: "2026-05-06", childId, leaveTypeId, hours: "6,4" },
        { date: "2026-05-13", childId, leaveTypeId, hours: 6.4 },
      ],
    });
    assert.equal(save.status, 200, JSON.stringify(save.json));

    // De opgeslagen maand is precies wat er gestuurd is: 13 mei verdwijnt.
    await call("PUT", "/months/2026-05", { rows: [{ date: "2026-05-06", childId, leaveTypeId, hours: 3 }] });
    const { json: month } = await call("GET", "/months/2026-05");
    assert.deepEqual(
      month.entries.map((entry: { date: string; hours: number }) => [entry.date, entry.hours]),
      [["2026-05-06", 3]],
    );
    assert.equal(month.hoursPerWorkdayByDate["2026-05-06"], 6.4);

    const copy = await call("POST", "/months/2026-06/copy-previous");
    assert.equal(copy.status, 200, JSON.stringify(copy.json));
    const { json: june } = await call("GET", "/entries?from=2026-06-01&to=2026-06-30");
    assert.deepEqual(june.map((entry: { date: string }) => entry.date), ["2026-06-06"]);
  });

  it("levert de schermgegevens", { skip: !usable }, async () => {
    const overview = await call("GET", "/overview");
    assert.equal(overview.status, 200);
    assert.equal(overview.json.setup.contracts, 2);
    assert.ok(overview.json.balances.length >= 4);

    const salary = await call("GET", "/salary?maand=2026-05");
    assert.equal(salary.json.month, "2026-05");
    assert.ok(salary.json.impact.net, "netto verwacht: contract B heeft loonstrookgegevens");

    const mail = await call("GET", "/mail?maand=2026-05");
    assert.match(mail.json.mail.subject, /mei 2026/);
  });

  it("beschermt wettelijke verlofsoorten en contracten met verlof", { skip: !usable }, async () => {
    const { json: leaveTypes } = await call("GET", "/leave-types");
    assert.equal((await call("DELETE", `/leave-types/${leaveTypes[0].id}`)).status, 409);

    const { json: contracts } = await call("GET", "/contracts");
    const withEntries = contracts.contracts.find((c: { employerName: string }) => c.employerName === "Werkgever Y");
    assert.equal((await call("DELETE", `/contracts/${withEntries.id}`)).status, 409);
  });
});
