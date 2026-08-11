"use server";

import { revalidatePath } from "next/cache";
import { contractForDate } from "./contracts";
import { type DateOnly, addDaysOnly, formatDateOnly, startOfIsoWeek } from "./dates";
import { prisma } from "./db";
import { getContracts } from "./queries";
import {
  childSchema,
  contractSchema,
  formatZodError,
  leaveTypeSchema,
  weekSaveSchema,
} from "./validation";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; errors: string[] };

function toDbDate(value: DateOnly): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function fail(errors: string[]): ActionResult {
  return { ok: false, errors };
}

function revalidateAll() {
  for (const path of ["/", "/week", "/saldo", "/salaris", "/mail", "/contracten", "/kinderen"]) {
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

export type WeekRowInput = {
  date: DateOnly;
  childId: string;
  leaveTypeId: string;
  hours: number;
  note?: string | null;
};

/**
 * Slaat een hele week in één transactie op.
 *
 * De client stuurt de gewenste eindtoestand van de week; de server bepaalt het
 * verschil met wat er staat en voert dat uit. Dat is idempotent: opnieuw
 * versturen levert dezelfde week op, en een mislukte opslag laat geen halve week
 * achter. Het contract per regel wordt hier bepaald op basis van de datum, niet
 * door de client meegestuurd.
 */
export async function saveWeek(
  weekStart: DateOnly,
  rows: WeekRowInput[],
): Promise<ActionResult> {
  const parsed = weekSaveSchema.safeParse({ weekStart, rows });
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const monday = startOfIsoWeek(parsed.data.weekStart);
  const sunday = addDaysOnly(monday, 6);
  const contracts = await getContracts();

  const errors: string[] = [];
  const keep = new Map<string, WeekRowInput & { contractId: string }>();

  for (const row of parsed.data.rows) {
    if (row.date < monday || row.date > sunday) {
      errors.push(`${row.date} valt buiten de week van ${monday}.`);
      continue;
    }
    if (row.hours <= 0) continue;

    const contract = contractForDate(contracts, row.date);
    if (!contract) {
      errors.push(`Geen contract gevonden voor ${row.date}. Voeg eerst een contract toe.`);
      continue;
    }

    const key = `${row.date}|${row.childId}|${row.leaveTypeId}`;
    if (keep.has(key)) {
      errors.push(
        `Dubbele regel voor ${row.date}: combineer de uren van dezelfde verlofsoort en hetzelfde kind.`,
      );
      continue;
    }
    keep.set(key, { ...row, contractId: contract.id });
  }

  if (errors.length > 0) return fail(errors);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.leaveEntry.findMany({
      where: { date: { gte: toDbDate(monday), lte: toDbDate(sunday) } },
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
  return { ok: true, message: "Week opgeslagen." };
}

/** Kopieert de vorige week naar deze week; bestaande regels worden vervangen. */
export async function copyPreviousWeek(weekStart: DateOnly): Promise<ActionResult> {
  const monday = startOfIsoWeek(weekStart);
  const previousMonday = addDaysOnly(monday, -7);
  const previousSunday = addDaysOnly(monday, -1);

  const previous = await prisma.leaveEntry.findMany({
    where: { date: { gte: toDbDate(previousMonday), lte: toDbDate(previousSunday) } },
  });

  if (previous.length === 0) {
    return fail(["De vorige week bevat geen verlof om te kopiëren."]);
  }

  const rows: WeekRowInput[] = previous.map((entry) => {
    const date = formatDateOnly(entry.date);
    return {
      date: addDaysOnly(date, 7),
      childId: entry.childId,
      leaveTypeId: entry.leaveTypeId,
      hours: Number(entry.hours.toString()),
      note: entry.note,
    };
  });

  return saveWeek(monday, rows);
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
