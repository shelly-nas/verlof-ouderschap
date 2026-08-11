"use server";

import { revalidatePath } from "next/cache";
import { contractForDate } from "./contracts";
import {
  type DateOnly,
  addMonthsOnly,
  endOfMonth,
  formatDateNl,
  formatDateOnly,
  startOfMonth,
} from "./dates";
import { prisma } from "./db";
import { getContracts } from "./queries";
import {
  childSchema,
  contractSchema,
  formatZodError,
  leaveTypeSchema,
  periodSaveSchema,
} from "./validation";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; errors: string[] };

function toDbDate(value: DateOnly): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Prisma neemt Decimal-velden als string aan; null blijft null. */
function decimalOrNull(value: number | null): string | null {
  return value === null ? null : String(value);
}

function fail(errors: string[]): ActionResult {
  return { ok: false, errors };
}

function revalidateAll() {
  for (const path of ["/", "/maand", "/saldo", "/salaris", "/mail", "/contracten", "/kinderen"]) {
    revalidatePath(path, "layout");
  }
}

/** Leest een formulier uit; checkboxen komen als "on" of ontbreken volledig. */
function formValue(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
}

function formBool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

// Contracten

export async function saveContract(
  contractId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const leaveTypeIds = form.getAll("supplementLeaveTypeId").map(String);

  const parsed = contractSchema.safeParse({
    employerName: formValue(form, "employerName") ?? "",
    employerEmail: formValue(form, "employerEmail") ?? "",
    hoursPerWeek: formValue(form, "hoursPerWeek") ?? "",
    grossMonthlySalary: formValue(form, "grossMonthlySalary") ?? "",
    startDate: formValue(form, "startDate") ?? "",
    endDate: formValue(form, "endDate") ?? "",
    notes: formValue(form, "notes"),
    pensionPercent: formValue(form, "pensionPercent"),
    pensionBase: formValue(form, "pensionBase"),
    wgaPercent: formValue(form, "wgaPercent"),
    wgaBase: formValue(form, "wgaBase"),
    wiaExcedent: formValue(form, "wiaExcedent"),
    grossExpenseAllowance: formValue(form, "grossExpenseAllowance"),
    bijtellingPercent: formValue(form, "bijtellingPercent"),
    bijtellingBase: formValue(form, "bijtellingBase"),
    netExpenseAllowance: formValue(form, "netExpenseAllowance"),
    applyTaxCredits: formBool(form, "applyTaxCredits"),
    supplements: leaveTypeIds
      .map((leaveTypeId) => ({
        leaveTypeId,
        topUpToPercent: formValue(form, `topUpToPercent_${leaveTypeId}`),
        topUpUncapped: formBool(form, `topUpUncapped_${leaveTypeId}`),
        extraWeeks: formValue(form, `extraWeeks_${leaveTypeId}`),
        deadlineOverrideMonths: formValue(form, `deadlineOverrideMonths_${leaveTypeId}`),
        notes: formValue(form, `supplementNotes_${leaveTypeId}`),
      }))
      // Een supplement zonder enige waarde is "geen aanvullende voorwaarden".
      .filter(
        (item) =>
          item.topUpToPercent ||
          item.extraWeeks ||
          item.deadlineOverrideMonths ||
          item.notes,
      ),
  });

  if (!parsed.success) return fail(formatZodError(parsed.error));
  const data = parsed.data;

  const payload = {
    employerName: data.employerName,
    employerEmail: data.employerEmail,
    hoursPerWeek: String(data.hoursPerWeek),
    grossMonthlySalary: String(data.grossMonthlySalary),
    startDate: toDbDate(data.startDate),
    endDate: data.endDate ? toDbDate(data.endDate) : null,
    notes: data.notes,
    pensionPercent: decimalOrNull(data.pensionPercent),
    pensionBase: decimalOrNull(data.pensionBase),
    wgaPercent: decimalOrNull(data.wgaPercent),
    wgaBase: decimalOrNull(data.wgaBase),
    wiaExcedent: decimalOrNull(data.wiaExcedent),
    grossExpenseAllowance: decimalOrNull(data.grossExpenseAllowance),
    bijtellingPercent: decimalOrNull(data.bijtellingPercent),
    bijtellingBase: decimalOrNull(data.bijtellingBase),
    netExpenseAllowance: decimalOrNull(data.netExpenseAllowance),
    applyTaxCredits: data.applyTaxCredits,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const contract = contractId
      ? await tx.contract.update({ where: { id: contractId }, data: payload })
      : await tx.contract.create({ data: payload });

    await tx.employerSupplement.deleteMany({ where: { contractId: contract.id } });
    for (const supplement of data.supplements) {
      await tx.employerSupplement.create({
        data: {
          contractId: contract.id,
          leaveTypeId: supplement.leaveTypeId,
          topUpToPercent:
            supplement.topUpToPercent === null ? null : String(supplement.topUpToPercent),
          topUpUncapped: supplement.topUpUncapped,
          extraWeeks: supplement.extraWeeks === null ? null : String(supplement.extraWeeks),
          deadlineOverrideMonths: supplement.deadlineOverrideMonths,
          notes: supplement.notes,
        },
      });
    }
    return contract;
  });

  // Een gewijzigde looptijd kan verlofdagen aan een ander contract toewijzen.
  await reassignContracts();
  revalidateAll();
  return { ok: true, message: `Contract "${saved.employerName}" opgeslagen.` };
}

export async function deleteContract(contractId: string): Promise<ActionResult> {
  const entryCount = await prisma.leaveEntry.count({ where: { contractId } });
  if (entryCount > 0) {
    return fail([
      `Dit contract hangt aan ${entryCount} verlofdag(en). Verwijder die eerst of pas de looptijd aan.`,
    ]);
  }
  await prisma.contract.delete({ where: { id: contractId } });
  revalidateAll();
  return { ok: true, message: "Contract verwijderd." };
}

/**
 * Zet elke verlofdag op het contract dat op díe datum geldt. Nodig zodra een
 * contractperiode verschuift, anders blijft een verlofdag aan een contract
 * hangen dat er niet meer over gaat en rekent het salarisscherm met de
 * verkeerde uren.
 */
export async function reassignContracts(): Promise<number> {
  const contracts = await getContracts();
  const entries = await prisma.leaveEntry.findMany({
    select: { id: true, date: true, contractId: true },
  });

  let updated = 0;
  for (const entry of entries) {
    const date = formatDateOnly(entry.date);
    const contract = contractForDate(contracts, date);
    if (contract && contract.id !== entry.contractId) {
      await prisma.leaveEntry.update({
        where: { id: entry.id },
        data: { contractId: contract.id },
      });
      updated += 1;
    }
  }
  return updated;
}

// Kinderen

export async function saveChild(
  childId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = childSchema.safeParse({
    name: formValue(form, "name") ?? "",
    dateOfBirth: formValue(form, "dateOfBirth") ?? "",
  });
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const payload = {
    name: parsed.data.name,
    dateOfBirth: toDbDate(parsed.data.dateOfBirth),
  };

  if (childId) {
    await prisma.child.update({ where: { id: childId }, data: payload });
  } else {
    await prisma.child.create({ data: payload });
  }

  revalidateAll();
  return { ok: true, message: `${parsed.data.name} opgeslagen.` };
}

export async function deleteChild(childId: string): Promise<ActionResult> {
  const entryCount = await prisma.leaveEntry.count({ where: { childId } });
  if (entryCount > 0) {
    return fail([
      `Er staan nog ${entryCount} verlofdag(en) op dit kind. Verwijder die eerst.`,
    ]);
  }
  await prisma.child.delete({ where: { id: childId } });
  revalidateAll();
  return { ok: true, message: "Kind verwijderd." };
}

// Weekregistratie

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
export async function savePeriod(
  from: DateOnly,
  to: DateOnly,
  rows: LeaveRowInput[],
): Promise<ActionResult> {
  const parsed = periodSaveSchema.safeParse({ from, to, rows });
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const contracts = await getContracts();
  const errors: string[] = [];
  const keep = new Map<string, LeaveRowInput & { contractId: string }>();

  for (const row of parsed.data.rows) {
    if (row.date < parsed.data.from || row.date > parsed.data.to) {
      errors.push(`${formatDateNl(row.date)} valt buiten de gekozen periode.`);
      continue;
    }
    if (row.hours <= 0) continue;

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
    keep.set(key, { ...row, contractId: contract.id });
  }

  if (errors.length > 0) return fail(errors);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.leaveEntry.findMany({
      where: {
        date: { gte: toDbDate(parsed.data.from), lte: toDbDate(parsed.data.to) },
      },
    });

    for (const entry of existing) {
      const date = formatDateOnly(entry.date);
      const key = `${date}|${entry.childId}|${entry.leaveTypeId}`;
      if (!keep.has(key)) {
        await tx.leaveEntry.delete({ where: { id: entry.id } });
      }
    }

    for (const [, row] of keep) {
      await tx.leaveEntry.upsert({
        where: {
          date_childId_leaveTypeId: {
            date: toDbDate(row.date),
            childId: row.childId,
            leaveTypeId: row.leaveTypeId,
          },
        },
        update: {
          hours: String(row.hours),
          contractId: row.contractId,
          note: row.note ?? null,
        },
        create: {
          date: toDbDate(row.date),
          childId: row.childId,
          leaveTypeId: row.leaveTypeId,
          contractId: row.contractId,
          hours: String(row.hours),
          note: row.note ?? null,
        },
      });
    }
  });

  revalidateAll();
  return { ok: true, message: "Opgeslagen." };
}

/** Slaat een hele maand op. `month` heeft de vorm "2026-08". */
export async function saveMonth(
  month: string,
  rows: LeaveRowInput[],
): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return fail([`"${month}" is geen geldige maand (verwacht jjjj-mm).`]);
  }
  const start = startOfMonth(`${month}-01`);
  return savePeriod(start, endOfMonth(start), rows);
}

/** Kopieert de vorige maand naar deze maand; bestaande regels worden vervangen. */
export async function copyPreviousMonth(month: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return fail([`"${month}" is geen geldige maand (verwacht jjjj-mm).`]);
  }

  const start = startOfMonth(`${month}-01`);
  const previousStart = addMonthsOnly(start, -1);
  const previousEnd = endOfMonth(previousStart);

  const previous = await prisma.leaveEntry.findMany({
    where: { date: { gte: toDbDate(previousStart), lte: toDbDate(previousEnd) } },
  });

  if (previous.length === 0) {
    return fail(["De vorige maand bevat geen verlof om te kopiëren."]);
  }

  // Dezelfde dag-van-de-maand aanhouden; dagen die in deze maand niet bestaan
  // (31 januari naar februari) vallen af.
  const daysInMonth = Number(endOfMonth(start).slice(8, 10));
  const rows: LeaveRowInput[] = [];
  for (const entry of previous) {
    const day = Number(formatDateOnly(entry.date).slice(8, 10));
    if (day > daysInMonth) continue;
    rows.push({
      date: `${month}-${`${day}`.padStart(2, "0")}`,
      childId: entry.childId,
      leaveTypeId: entry.leaveTypeId,
      hours: Number(entry.hours.toString()),
      note: entry.note,
    });
  }

  if (rows.length === 0) {
    return fail(["De vorige maand bevat geen dagen die in deze maand passen."]);
  }

  return saveMonth(month, rows);
}

// Verlofsoorten en maximumdaglonen

export async function saveLeaveType(
  leaveTypeId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = leaveTypeSchema.safeParse({
    name: formValue(form, "name") ?? "",
    weeksMultiplier: formValue(form, "weeksMultiplier") ?? "",
    payer: formValue(form, "payer") ?? "UNPAID",
    payPercent: formValue(form, "payPercent"),
    cappedAtMaxDagloon: formBool(form, "cappedAtMaxDagloon"),
    deadlineAnchor: formValue(form, "deadlineAnchor") ?? "NONE",
    deadlineValue: formValue(form, "deadlineValue"),
    colorHex: formValue(form, "colorHex"),
  });
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const data = parsed.data;

  if (leaveTypeId) {
    const existing = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!existing) return fail(["Verlofsoort niet gevonden."]);

    // Wettelijke soorten: alleen naam en kleur zijn vrij aanpasbaar, zodat de
    // UWV-basis niet per ongeluk wordt overschreven.
    await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: existing.isStatutory
        ? { name: data.name, colorHex: data.colorHex }
        : {
            name: data.name,
            weeksMultiplier: String(data.weeksMultiplier),
            payer: data.payer,
            payPercent: data.payPercent === null ? null : String(data.payPercent),
            cappedAtMaxDagloon: data.cappedAtMaxDagloon,
            deadlineAnchor: data.deadlineAnchor,
            deadlineValue: data.deadlineValue,
            colorHex: data.colorHex,
          },
    });
  } else {
    const code = `EIGEN_${data.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    const duplicate = await prisma.leaveType.findUnique({ where: { code } });
    if (duplicate) return fail(["Er bestaat al een verlofsoort met deze naam."]);

    const last = await prisma.leaveType.findFirst({ orderBy: { sortOrder: "desc" } });
    await prisma.leaveType.create({
      data: {
        code,
        name: data.name,
        weeksMultiplier: String(data.weeksMultiplier),
        payer: data.payer,
        payPercent: data.payPercent === null ? null : String(data.payPercent),
        cappedAtMaxDagloon: data.cappedAtMaxDagloon,
        deadlineAnchor: data.deadlineAnchor,
        deadlineValue: data.deadlineValue,
        colorHex: data.colorHex,
        isStatutory: false,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });
  }

  revalidateAll();
  return { ok: true, message: "Verlofsoort opgeslagen." };
}

export async function deleteLeaveType(leaveTypeId: string): Promise<ActionResult> {
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType) return fail(["Verlofsoort niet gevonden."]);
  if (leaveType.isStatutory) {
    return fail(["Wettelijke verlofsoorten kunnen niet worden verwijderd."]);
  }

  const entryCount = await prisma.leaveEntry.count({ where: { leaveTypeId } });
  if (entryCount > 0) {
    return fail([`Er staan nog ${entryCount} verlofdag(en) op deze soort.`]);
  }

  await prisma.leaveType.delete({ where: { id: leaveTypeId } });
  revalidateAll();
  return { ok: true, message: "Verlofsoort verwijderd." };
}
