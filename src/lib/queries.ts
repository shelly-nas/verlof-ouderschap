import "server-only";
import type { ContractLike } from "./contracts";
import { type DateOnly, formatDateOnly } from "./dates";
import type { MaxDagloonRow } from "./dagloon";
import { prisma } from "./db";
import type { ChildLike, LeaveTypeLike, SupplementLike } from "./entitlements";
import type { LeaveEntryLike } from "./balances";
import type { PayslipContract } from "./netsalary";
import { type DecimalLike, toNumber, toNumberOrNull } from "./money";

/**
 * De enige plek waar Prisma-rijen de app binnenkomen. Decimal-velden worden hier
 * getallen (Prisma's Decimal serialiseert niet naar JSON) en Date-velden worden
 * "yyyy-MM-dd"-strings, zodat de rest van de app alleen met plain types werkt.
 */

function dateOnly(value: Date): DateOnly {
  return formatDateOnly(value);
}

function dateOnlyOrNull(value: Date | null): DateOnly | null {
  return value === null ? null : formatDateOnly(value);
}

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
  archivedAt: string | null;
};

export type LeaveEntryDto = LeaveEntryLike & {
  contractId: string;
  note: string | null;
};

export type MaxDagloonDto = MaxDagloonRow & {
  id: string;
  source: string | null;
};

type PrismaContract = {
  id: string;
  employerName: string;
  employerEmail: string;
  hoursPerWeek: DecimalLike;
  grossMonthlySalary: DecimalLike;
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
  pensionPercent: DecimalLike;
  pensionBase: DecimalLike;
  wgaPercent: DecimalLike;
  wgaBase: DecimalLike;
  wiaExcedent: DecimalLike;
  grossExpenseAllowance: DecimalLike;
  bijtellingPercent: DecimalLike;
  bijtellingBase: DecimalLike;
  netExpenseAllowance: DecimalLike;
  applyTaxCredits: boolean;
  supplements?: PrismaSupplement[];
};

type PrismaSupplement = {
  id: string;
  contractId: string;
  leaveTypeId: string;
  topUpToPercent: DecimalLike;
  topUpUncapped: boolean;
  extraWeeks: DecimalLike;
  deadlineOverrideMonths: number | null;
  notes: string | null;
};

export function toContractDto(row: PrismaContract): ContractDto {
  return {
    id: row.id,
    employerName: row.employerName,
    employerEmail: row.employerEmail,
    hoursPerWeek: toNumber(row.hoursPerWeek),
    grossMonthlySalary: toNumber(row.grossMonthlySalary),
    startDate: dateOnly(row.startDate),
    endDate: dateOnlyOrNull(row.endDate),
    notes: row.notes,
    pensionPercent: toNumberOrNull(row.pensionPercent),
    pensionBase: toNumberOrNull(row.pensionBase),
    wgaPercent: toNumberOrNull(row.wgaPercent),
    wgaBase: toNumberOrNull(row.wgaBase),
    wiaExcedent: toNumberOrNull(row.wiaExcedent),
    grossExpenseAllowance: toNumberOrNull(row.grossExpenseAllowance),
    bijtellingPercent: toNumberOrNull(row.bijtellingPercent),
    bijtellingBase: toNumberOrNull(row.bijtellingBase),
    netExpenseAllowance: toNumberOrNull(row.netExpenseAllowance),
    applyTaxCredits: row.applyTaxCredits,
    supplements: (row.supplements ?? []).map(toSupplementDto),
  };
}

export function toSupplementDto(row: PrismaSupplement): SupplementDto {
  return {
    id: row.id,
    contractId: row.contractId,
    leaveTypeId: row.leaveTypeId,
    topUpToPercent: toNumberOrNull(row.topUpToPercent),
    topUpUncapped: row.topUpUncapped,
    extraWeeks: toNumberOrNull(row.extraWeeks),
    deadlineOverrideMonths: row.deadlineOverrideMonths,
    notes: row.notes,
  };
}

export async function getContracts(): Promise<ContractDto[]> {
  const rows = await prisma.contract.findMany({
    include: { supplements: true },
    orderBy: { startDate: "desc" },
  });
  return rows.map(toContractDto);
}

export async function getContract(id: string): Promise<ContractDto | null> {
  const row = await prisma.contract.findUnique({
    where: { id },
    include: { supplements: true },
  });
  return row ? toContractDto(row) : null;
}

export async function getChildren(): Promise<ChildDto[]> {
  const rows = await prisma.child.findMany({ orderBy: { dateOfBirth: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    dateOfBirth: dateOnly(row.dateOfBirth),
  }));
}

export async function getLeaveTypes(includeArchived = false): Promise<LeaveTypeDto[]> {
  const rows = await prisma.leaveType.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    weeksMultiplier: toNumber(row.weeksMultiplier),
    payer: row.payer,
    payPercent: toNumberOrNull(row.payPercent),
    cappedAtMaxDagloon: row.cappedAtMaxDagloon,
    deadlineAnchor: row.deadlineAnchor,
    deadlineValue: row.deadlineValue,
    fallbackLeaveTypeId: row.fallbackLeaveTypeId,
    colorHex: row.colorHex,
    sortOrder: row.sortOrder,
    isStatutory: row.isStatutory,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  }));
}

export async function getSupplements(): Promise<SupplementDto[]> {
  const rows = await prisma.employerSupplement.findMany();
  return rows.map(toSupplementDto);
}

export async function getMaxDaglonen(): Promise<MaxDagloonDto[]> {
  const rows = await prisma.maxDagloon.findMany({ orderBy: { validFrom: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    validFrom: dateOnly(row.validFrom),
    amount: toNumber(row.amount),
    source: row.source,
  }));
}

export async function getLeaveEntries(range?: {
  from: DateOnly;
  to: DateOnly;
}): Promise<LeaveEntryDto[]> {
  const rows = await prisma.leaveEntry.findMany({
    where: range
      ? {
          date: {
            gte: new Date(`${range.from}T00:00:00.000Z`),
            lte: new Date(`${range.to}T00:00:00.000Z`),
          },
        }
      : undefined,
    orderBy: { date: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    date: dateOnly(row.date),
    hours: toNumber(row.hours),
    childId: row.childId,
    leaveTypeId: row.leaveTypeId,
    contractId: row.contractId,
    note: row.note,
  }));
}

/** Alles wat de saldo-, salaris- en mailschermen nodig hebben, in één ronde. */
export async function getAppData() {
  const [contracts, children, leaveTypes, supplements, maxDaglonen, entries] =
    await Promise.all([
      getContracts(),
      getChildren(),
      getLeaveTypes(),
      getSupplements(),
      getMaxDaglonen(),
      getLeaveEntries(),
    ]);
  return { contracts, children, leaveTypes, supplements, maxDaglonen, entries };
}

export type AppData = Awaited<ReturnType<typeof getAppData>>;
