import { randomUUID } from "node:crypto";
import { type Queryable, getPool, transaction } from "./db";
import type { LeaveEntryLike } from "./domain/balances";
import { type ContractLike, contractForDate } from "./domain/contracts";
import { type DateOnly, addMonthsOnly, endOfMonth, formatDateNl, startOfMonth } from "./domain/dates";
import type { ChildLike, LeaveTypeLike, SupplementLike } from "./domain/entitlements";
import type { PayslipContract } from "./domain/netsalary";
import {
  childSchema,
  contractSchema,
  formatZodError,
  leaveTypeSchema,
  periodSaveSchema,
  zodFieldErrors,
} from "./domain/validation";
import type { ZodError } from "zod";

/**
 * De enige plek waar SQL staat. Rijen komen er als plain objecten uit: DATE als
 * "yyyy-MM-dd"-string en NUMERIC als getal (zie db.ts), zodat de rekenkern en
 * de API alleen met gewone types werken.
 *
 * Tabel- en kolomnamen zijn CamelCase tussen quotes; zie database/init.sql.
 */

export type ContractDto = ContractLike &
  PayslipContract & {
    notes: string | null;
    supplements: SupplementDto[];
  };

export type SupplementDto = SupplementLike & {
  id: string;
  notes: string | null;
};

export type ChildDto = ChildLike;

export type LeaveTypeDto = LeaveTypeLike & {
  isStatutory: boolean;
};

export type LeaveEntryDto = LeaveEntryLike & {
  contractId: string;
  note: string | null;
};

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; errors: string[]; fieldErrors?: Record<string, string>; status?: number };

function fail(errors: string[], status = 400) {
  return { ok: false as const, errors, status };
}

function invalid(error: ZodError) {
  return { ok: false as const, errors: formatZodError(error), fieldErrors: zodFieldErrors(error), status: 400 };
}

const notFound = (what: string) => fail([`${what} niet gevonden.`], 404);

// Lezen

const CONTRACT_COLUMNS = `"id", "employerName", "employerEmail", "hoursPerWeek", "grossMonthlySalary",
  "startDate", "endDate", "notes", "pensionPercent", "pensionBase", "wgaPercent", "wgaBase",
  "wiaExcedent", "grossExpenseAllowance", "bijtellingPercent", "bijtellingBase",
  "netExpenseAllowance", "applyTaxCredits"`;

const SUPPLEMENT_COLUMNS = `"id", "contractId", "leaveTypeId", "topUpToPercent", "extraWeeks",
  "deadlineOverrideMonths", "notes"`;

export async function getSupplements(db: Queryable = getPool()): Promise<SupplementDto[]> {
  const { rows } = await db.query<SupplementDto>(
    `SELECT ${SUPPLEMENT_COLUMNS} FROM "EmployerSupplement"`,
  );
  return rows;
}

export async function getContracts(db: Queryable = getPool()): Promise<ContractDto[]> {
  const [{ rows }, supplements] = await Promise.all([
    db.query<Omit<ContractDto, "supplements">>(
      `SELECT ${CONTRACT_COLUMNS} FROM "Contract" ORDER BY "startDate" DESC`,
    ),
    getSupplements(db),
  ]);
  return rows.map((row) => ({
    ...row,
    supplements: supplements.filter((item) => item.contractId === row.id),
  }));
}

export async function getContract(id: string): Promise<ContractDto | null> {
  const contracts = await getContracts();
  return contracts.find((contract) => contract.id === id) ?? null;
}

export async function getChildren(db: Queryable = getPool()): Promise<ChildDto[]> {
  const { rows } = await db.query<ChildDto>(
    `SELECT "id", "name", "dateOfBirth" FROM "Child" ORDER BY "dateOfBirth" ASC, "name" ASC`,
  );
  return rows;
}

export async function getLeaveTypes(db: Queryable = getPool()): Promise<LeaveTypeDto[]> {
  const { rows } = await db.query<LeaveTypeDto>(
    `SELECT "id", "code", "name", "weeksMultiplier", "payer", "payPercent", "deadlineAnchor",
            "deadlineValue", "fallbackLeaveTypeId", "colorHex", "sortOrder", "isStatutory"
       FROM "LeaveType"
      WHERE "archivedAt" IS NULL
      ORDER BY "sortOrder" ASC, "name" ASC`,
  );
  return rows;
}

export async function getLeaveEntries(
  range?: { from: DateOnly; to: DateOnly },
  db: Queryable = getPool(),
): Promise<LeaveEntryDto[]> {
  const where = range ? `WHERE "date" BETWEEN $1 AND $2` : "";
  const { rows } = await db.query<LeaveEntryDto>(
    `SELECT "id", "date", "hours", "childId", "leaveTypeId", "contractId", "note"
       FROM "LeaveEntry" ${where}
      ORDER BY "date" ASC`,
    range ? [range.from, range.to] : [],
  );
  return rows;
}

/** Alles wat de saldo-, salaris- en mailschermen nodig hebben, in één ronde. */
export async function getAppData() {
  const [contracts, children, leaveTypes, supplements, entries] = await Promise.all([
    getContracts(),
    getChildren(),
    getLeaveTypes(),
    getSupplements(),
    getLeaveEntries(),
  ]);
  return { contracts, children, leaveTypes, supplements, entries };
}

export type AppData = Awaited<ReturnType<typeof getAppData>>;

// Contracten

export async function saveContract(
  contractId: string | null,
  body: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contractSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  // Een supplement zonder enige waarde is "geen aanvullende voorwaarden".
  const supplements = data.supplements.filter(
    (item) =>
      item.topUpToPercent !== null ||
      item.extraWeeks !== null ||
      item.deadlineOverrideMonths !== null ||
      item.notes !== null,
  );

  const values = [
    data.employerName,
    data.employerEmail,
    data.hoursPerWeek,
    data.grossMonthlySalary,
    data.startDate,
    data.endDate,
    data.notes,
    data.pensionPercent,
    data.pensionBase,
    data.wgaPercent,
    data.wgaBase,
    data.wiaExcedent,
    data.grossExpenseAllowance,
    data.bijtellingPercent,
    data.bijtellingBase,
    data.netExpenseAllowance,
    data.applyTaxCredits,
  ];

  const id = await transaction(async (client) => {
    let id = contractId;
    if (id) {
      const { rowCount } = await client.query(
        `UPDATE "Contract" SET
           "employerName" = $2, "employerEmail" = $3, "hoursPerWeek" = $4,
           "grossMonthlySalary" = $5, "startDate" = $6, "endDate" = $7, "notes" = $8,
           "pensionPercent" = $9, "pensionBase" = $10, "wgaPercent" = $11, "wgaBase" = $12,
           "wiaExcedent" = $13, "grossExpenseAllowance" = $14, "bijtellingPercent" = $15,
           "bijtellingBase" = $16, "netExpenseAllowance" = $17, "applyTaxCredits" = $18,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1`,
        [id, ...values],
      );
      if (rowCount === 0) return null;
    } else {
      id = randomUUID();
      await client.query(
        `INSERT INTO "Contract" ("id", "employerName", "employerEmail", "hoursPerWeek",
           "grossMonthlySalary", "startDate", "endDate", "notes", "pensionPercent", "pensionBase",
           "wgaPercent", "wgaBase", "wiaExcedent", "grossExpenseAllowance", "bijtellingPercent",
           "bijtellingBase", "netExpenseAllowance", "applyTaxCredits", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
           CURRENT_TIMESTAMP)`,
        [id, ...values],
      );
    }

    await client.query(`DELETE FROM "EmployerSupplement" WHERE "contractId" = $1`, [id]);
    for (const supplement of supplements) {
      await client.query(
        `INSERT INTO "EmployerSupplement" ("id", "contractId", "leaveTypeId", "topUpToPercent",
           "extraWeeks", "deadlineOverrideMonths", "notes")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          id,
          supplement.leaveTypeId,
          supplement.topUpToPercent,
          supplement.extraWeeks,
          supplement.deadlineOverrideMonths,
          supplement.notes,
        ],
      );
    }

    // Een gewijzigde looptijd kan verlofdagen aan een ander contract toewijzen.
    await reassignContracts(client);
    return id;
  });

  if (!id) return notFound("Contract");
  return { ok: true, message: `Contract "${data.employerName}" opgeslagen.`, data: { id } };
}

export async function deleteContract(contractId: string): Promise<ActionResult> {
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "LeaveEntry" WHERE "contractId" = $1`,
    [contractId],
  );
  const entryCount = Number(rows[0].count);
  if (entryCount > 0) {
    return fail([
      `Dit contract hangt aan ${entryCount} verlofdag(en). Verwijder die eerst of pas de looptijd aan.`,
    ], 409);
  }
  const { rowCount } = await getPool().query(`DELETE FROM "Contract" WHERE "id" = $1`, [contractId]);
  if (rowCount === 0) return notFound("Contract");
  return { ok: true, message: "Contract verwijderd." };
}

/**
 * Zet elke verlofdag op het contract dat op díe datum geldt. Nodig zodra een
 * contractperiode verschuift, anders blijft een verlofdag aan een contract
 * hangen dat er niet meer over gaat en rekent het salarisscherm met de
 * verkeerde uren.
 */
export async function reassignContracts(db: Queryable): Promise<number> {
  const contracts = await getContracts(db);
  const { rows } = await db.query<{ id: string; date: DateOnly; contractId: string }>(
    `SELECT "id", "date", "contractId" FROM "LeaveEntry"`,
  );

  let updated = 0;
  for (const entry of rows) {
    const contract = contractForDate(contracts, entry.date);
    if (contract && contract.id !== entry.contractId) {
      await db.query(
        `UPDATE "LeaveEntry" SET "contractId" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        [entry.id, contract.id],
      );
      updated += 1;
    }
  }
  return updated;
}

// Kinderen

export async function saveChild(childId: string | null, body: unknown): Promise<ActionResult> {
  const parsed = childSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const { name, dateOfBirth } = parsed.data;

  if (childId) {
    const { rowCount } = await getPool().query(
      `UPDATE "Child" SET "name" = $2, "dateOfBirth" = $3, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1`,
      [childId, name, dateOfBirth],
    );
    if (rowCount === 0) return notFound("Kind");
  } else {
    await getPool().query(
      `INSERT INTO "Child" ("id", "name", "dateOfBirth", "updatedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [randomUUID(), name, dateOfBirth],
    );
  }

  return { ok: true, message: `${name} opgeslagen.` };
}

export async function deleteChild(childId: string): Promise<ActionResult> {
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "LeaveEntry" WHERE "childId" = $1`,
    [childId],
  );
  const entryCount = Number(rows[0].count);
  if (entryCount > 0) {
    return fail([`Er staan nog ${entryCount} verlofdag(en) op dit kind. Verwijder die eerst.`], 409);
  }
  const { rowCount } = await getPool().query(`DELETE FROM "Child" WHERE "id" = $1`, [childId]);
  if (rowCount === 0) return notFound("Kind");
  return { ok: true, message: "Kind verwijderd." };
}

// Verlofregistratie

export type LeaveRowInput = {
  date: DateOnly;
  childId: string;
  leaveTypeId: string;
  hours: number;
  note?: string | null;
};

/**
 * Slaat alle verlofdagen in een periode in één transactie op.
 *
 * De client stuurt de gewenste eindtoestand van de periode; de server bepaalt
 * het verschil met wat er staat en voert dat uit. Dat is idempotent: opnieuw
 * versturen levert dezelfde periode op, en een mislukte opslag laat geen halve
 * maand achter. Het contract per regel wordt hier bepaald op basis van de datum
 * van die regel, niet door de client meegestuurd — zo klopt een periode die
 * over een contractwissel heen loopt.
 */
export async function savePeriod(from: DateOnly, to: DateOnly, rows: unknown): Promise<ActionResult> {
  const parsed = periodSaveSchema.safeParse({ from, to, rows });
  if (!parsed.success) return invalid(parsed.error);

  const [contracts, children, leaveTypes] = await Promise.all([
    getContracts(),
    getChildren(),
    getLeaveTypes(),
  ]);
  const childIds = new Set(children.map((child) => child.id));
  const leaveTypeIds = new Set(leaveTypes.map((type) => type.id));

  const errors: string[] = [];
  const keep = new Map<string, LeaveRowInput & { contractId: string }>();

  for (const row of parsed.data.rows) {
    if (row.date < parsed.data.from || row.date > parsed.data.to) {
      errors.push(`${formatDateNl(row.date)} valt buiten de gekozen periode.`);
      continue;
    }
    if (row.hours <= 0) continue;

    if (!childIds.has(row.childId)) {
      errors.push(`Onbekend kind op ${formatDateNl(row.date)}.`);
      continue;
    }
    if (!leaveTypeIds.has(row.leaveTypeId)) {
      errors.push(`Onbekende verlofsoort op ${formatDateNl(row.date)}.`);
      continue;
    }

    const contract = contractForDate(contracts, row.date);
    if (!contract) {
      errors.push(
        `Geen contract gevonden voor ${formatDateNl(row.date)}. Voeg eerst een contract toe.`,
      );
      continue;
    }

    const key = `${row.date}|${row.childId}|${row.leaveTypeId}`;
    if (keep.has(key)) {
      errors.push(
        `Dubbele regel voor ${formatDateNl(row.date)}: combineer de uren van dezelfde verlofsoort en hetzelfde kind.`,
      );
      continue;
    }
    keep.set(key, { ...row, note: row.note ?? null, contractId: contract.id });
  }

  if (errors.length > 0) return fail(errors);

  await transaction(async (client) => {
    const existing = await getLeaveEntries(parsed.data, client);
    for (const entry of existing) {
      const key = `${entry.date}|${entry.childId}|${entry.leaveTypeId}`;
      if (!keep.has(key)) {
        await client.query(`DELETE FROM "LeaveEntry" WHERE "id" = $1`, [entry.id]);
      }
    }

    for (const row of keep.values()) {
      await client.query(
        `INSERT INTO "LeaveEntry" ("id", "date", "hours", "childId", "leaveTypeId", "contractId",
           "note", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT ("date", "childId", "leaveTypeId") DO UPDATE SET
           "hours" = EXCLUDED."hours",
           "contractId" = EXCLUDED."contractId",
           "note" = EXCLUDED."note",
           "updatedAt" = CURRENT_TIMESTAMP`,
        [randomUUID(), row.date, row.hours, row.childId, row.leaveTypeId, row.contractId, row.note],
      );
    }
  });

  return { ok: true, message: "Opgeslagen." };
}

export const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** Slaat een hele maand op. `month` heeft de vorm "2026-08". */
export async function saveMonth(month: string, rows: unknown): Promise<ActionResult> {
  if (!MONTH_PATTERN.test(month)) {
    return fail([`"${month}" is geen geldige maand (verwacht jjjj-mm).`]);
  }
  const start = startOfMonth(`${month}-01`);
  const result = await savePeriod(start, endOfMonth(start), rows);
  return result.ok ? { ok: true, message: "Maand opgeslagen." } : result;
}

/** Kopieert de vorige maand naar deze maand; bestaande regels worden vervangen. */
export async function copyPreviousMonth(month: string): Promise<ActionResult> {
  if (!MONTH_PATTERN.test(month)) {
    return fail([`"${month}" is geen geldige maand (verwacht jjjj-mm).`]);
  }

  const start = startOfMonth(`${month}-01`);
  const previousStart = addMonthsOnly(start, -1);
  const previous = await getLeaveEntries({ from: previousStart, to: endOfMonth(previousStart) });

  if (previous.length === 0) {
    return fail(["De vorige maand bevat geen verlof om te kopiëren."]);
  }

  // Dezelfde dag-van-de-maand aanhouden; dagen die in deze maand niet bestaan
  // (31 januari naar februari) vallen af.
  const daysInMonth = Number(endOfMonth(start).slice(8, 10));
  const rows: LeaveRowInput[] = previous
    .filter((entry) => Number(entry.date.slice(8, 10)) <= daysInMonth)
    .map((entry) => ({
      date: `${month}-${entry.date.slice(8, 10)}`,
      childId: entry.childId,
      leaveTypeId: entry.leaveTypeId,
      hours: entry.hours,
      note: entry.note,
    }));

  if (rows.length === 0) {
    return fail(["De vorige maand bevat geen dagen die in deze maand passen."]);
  }

  const result = await saveMonth(month, rows);
  return result.ok ? { ok: true, message: "Vorige maand gekopieerd." } : result;
}

// Verlofsoorten

export async function saveLeaveType(
  leaveTypeId: string | null,
  body: unknown,
): Promise<ActionResult> {
  const parsed = leaveTypeSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  const pool = getPool();

  if (leaveTypeId) {
    const { rows } = await pool.query<{ isStatutory: boolean }>(
      `SELECT "isStatutory" FROM "LeaveType" WHERE "id" = $1`,
      [leaveTypeId],
    );
    if (rows.length === 0) return notFound("Verlofsoort");

    // Wettelijke soorten: alleen naam en kleur zijn vrij aanpasbaar, zodat de
    // UWV-basis niet per ongeluk wordt overschreven.
    if (rows[0].isStatutory) {
      await pool.query(
        `UPDATE "LeaveType" SET "name" = $2, "colorHex" = $3, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1`,
        [leaveTypeId, data.name, data.colorHex],
      );
    } else {
      await pool.query(
        `UPDATE "LeaveType" SET "name" = $2, "weeksMultiplier" = $3, "payer" = $4,
           "payPercent" = $5, "deadlineAnchor" = $6, "deadlineValue" = $7, "colorHex" = $8,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1`,
        [
          leaveTypeId,
          data.name,
          data.weeksMultiplier,
          data.payer,
          data.payPercent,
          data.deadlineAnchor,
          data.deadlineValue,
          data.colorHex,
        ],
      );
    }
    return { ok: true, message: `${data.name} opgeslagen.` };
  }

  const code = `EIGEN_${data.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const { rows: duplicate } = await pool.query(`SELECT 1 FROM "LeaveType" WHERE "code" = $1`, [code]);
  if (duplicate.length > 0) return fail(["Er bestaat al een verlofsoort met deze naam."], 409);

  await pool.query(
    `INSERT INTO "LeaveType" ("id", "code", "name", "weeksMultiplier", "payer", "payPercent",
       "deadlineAnchor", "deadlineValue", "colorHex", "isStatutory", "sortOrder", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false,
       (SELECT COALESCE(MAX("sortOrder"), 0) + 10 FROM "LeaveType"), CURRENT_TIMESTAMP)`,
    [
      randomUUID(),
      code,
      data.name,
      data.weeksMultiplier,
      data.payer,
      data.payPercent,
      data.deadlineAnchor,
      data.deadlineValue,
      data.colorHex,
    ],
  );
  return { ok: true, message: `${data.name} toegevoegd.` };
}

export async function deleteLeaveType(leaveTypeId: string): Promise<ActionResult> {
  const pool = getPool();
  const { rows } = await pool.query<{ isStatutory: boolean }>(
    `SELECT "isStatutory" FROM "LeaveType" WHERE "id" = $1`,
    [leaveTypeId],
  );
  if (rows.length === 0) return notFound("Verlofsoort");
  if (rows[0].isStatutory) {
    return fail(["Wettelijke verlofsoorten kunnen niet worden verwijderd."], 409);
  }

  const { rows: count } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "LeaveEntry" WHERE "leaveTypeId" = $1`,
    [leaveTypeId],
  );
  const entryCount = Number(count[0].count);
  if (entryCount > 0) {
    return fail([`Er staan nog ${entryCount} verlofdag(en) op deze soort.`], 409);
  }

  await pool.query(`DELETE FROM "LeaveType" WHERE "id" = $1`, [leaveTypeId]);
  return { ok: true, message: "Verlofsoort verwijderd." };
}
