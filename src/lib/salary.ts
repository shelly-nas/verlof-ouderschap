import type { ContractLike } from "./contracts";
import { contractForDate } from "./contracts";
import { type MaxDagloonRow, dayRate, hoursToDayEquivalent } from "./dagloon";
import { type DateOnly, endOfMonth, startOfMonth } from "./dates";
import type { LeaveTypeLike, SupplementLike } from "./entitlements";
import { findSupplement } from "./entitlements";
import type { LeaveEntryLike } from "./balances";

export type SalaryLineItem = {
  leaveTypeId: string;
  leaveTypeName: string;
  hours: number;
  dayEquivalents: number;
  employerPaid: number;
  uwvBenefit: number;
  employerTopUp: number;
  received: number;
  loss: number;
  cappedByMaxDagloon: boolean;
};

export type MonthImpact = {
  month: string;
  monthStart: DateOnly;
  monthEnd: DateOnly;
  /** Bruto maandsalaris zonder verlof; pro rata bij een contractwissel. */
  normalGross: number;
  /** Loon over de dagen waarop niet met verlof is gegaan. */
  workedGross: number;
  employerPaid: number;
  uwvBenefit: number;
  employerTopUp: number;
  /** Totaal bruto in deze maand, inclusief gewerkte dagen. */
  totalReceived: number;
  /** Verschil met een maand zonder verlof (negatief = minder inkomen). */
  difference: number;
  leaveHours: number;
  leaveDayEquivalents: number;
  cappedByMaxDagloon: boolean;
  lines: SalaryLineItem[];
  /** Dagen in deze maand zonder geldig contract, met verlof geboekt. */
  entriesWithoutContract: number;
};

/**
 * Bruto-inkomen in een maand met verlof.
 *
 * Elke verlofdag rekent met het contract dat op díe dag gold, niet met het
 * contract dat vandaag actief is — anders klopt een maand waarin je van
 * werkgever wisselt niet. Het maximumdagloon wordt eveneens per dag opgezocht,
 * want dat wijzigt op 1 januari en 1 juli.
 *
 * Dit is een bruto-indicatie: loonheffing, vakantiegeld en pensioenpremies
 * blijven buiten beschouwing.
 */
export function monthImpact(params: {
  month: string;
  entries: readonly LeaveEntryLike[];
  contracts: readonly ContractLike[];
  leaveTypes: readonly LeaveTypeLike[];
  supplements: readonly SupplementLike[];
  maxDaglonen: readonly MaxDagloonRow[];
}): MonthImpact {
  const { month, contracts, leaveTypes, supplements, maxDaglonen } = params;
  const monthStart = startOfMonth(`${month}-01`);
  const monthEnd = endOfMonth(monthStart);

  const entries = params.entries.filter(
    (entry) => entry.date >= monthStart && entry.date <= monthEnd,
  );

  const leaveTypeById = new Map(leaveTypes.map((type) => [type.id, type]));

  const lineByType = new Map<string, SalaryLineItem>();
  let employerPaid = 0;
  let uwvBenefit = 0;
  let employerTopUp = 0;
  let leaveHours = 0;
  let leaveDayEquivalents = 0;
  let normalGrossForLeaveDays = 0;
  let cappedByMaxDagloon = false;
  let entriesWithoutContract = 0;

  for (const entry of entries) {
    const leaveType = leaveTypeById.get(entry.leaveTypeId);
    if (!leaveType) continue;

    const contract = contractForDate(contracts, entry.date);
    if (!contract) {
      entriesWithoutContract += 1;
      continue;
    }

    const supplement = findSupplement(supplements, contract.id, leaveType.id);
    const rate = dayRate({
      date: entry.date,
      grossMonthlySalary: contract.grossMonthlySalary,
      payer: leaveType.payer,
      payPercent: leaveType.payPercent,
      cappedAtMaxDagloon: leaveType.cappedAtMaxDagloon,
      maxDaglonen,
      topUpToPercent: supplement?.topUpToPercent ?? null,
      topUpUncapped: supplement?.topUpUncapped ?? true,
    });

    const days = hoursToDayEquivalent(entry.hours, contract.hoursPerWeek);

    const entryEmployer = rate.employerPerDay * days;
    const entryUwv = rate.uwvPerDay * days;
    const entryTopUp = rate.topUpPerDay * days;
    const entryNormal = rate.normalDagloon * days;

    employerPaid += entryEmployer;
    uwvBenefit += entryUwv;
    employerTopUp += entryTopUp;
    leaveHours += entry.hours;
    leaveDayEquivalents += days;
    normalGrossForLeaveDays += entryNormal;
    cappedByMaxDagloon = cappedByMaxDagloon || rate.cappedByMaxDagloon;

    const existing = lineByType.get(leaveType.id) ?? {
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      hours: 0,
      dayEquivalents: 0,
      employerPaid: 0,
      uwvBenefit: 0,
      employerTopUp: 0,
      received: 0,
      loss: 0,
      cappedByMaxDagloon: false,
    };
    existing.hours += entry.hours;
    existing.dayEquivalents += days;
    existing.employerPaid += entryEmployer;
    existing.uwvBenefit += entryUwv;
    existing.employerTopUp += entryTopUp;
    existing.received += entryEmployer + entryUwv + entryTopUp;
    existing.loss += Math.max(0, entryNormal - (entryEmployer + entryUwv + entryTopUp));
    existing.cappedByMaxDagloon = existing.cappedByMaxDagloon || rate.cappedByMaxDagloon;
    lineByType.set(leaveType.id, existing);
  }

  const normalGross = normalGrossForMonth(month, contracts);
  const workedGross = Math.max(0, normalGross - normalGrossForLeaveDays);
  const totalReceived = workedGross + employerPaid + uwvBenefit + employerTopUp;

  return {
    month,
    monthStart,
    monthEnd,
    normalGross,
    workedGross,
    employerPaid,
    uwvBenefit,
    employerTopUp,
    totalReceived,
    difference: totalReceived - normalGross,
    leaveHours,
    leaveDayEquivalents,
    cappedByMaxDagloon,
    lines: [...lineByType.values()].sort((a, b) =>
      a.leaveTypeName.localeCompare(b.leaveTypeName),
    ),
    entriesWithoutContract,
  };
}

/**
 * Het bruto maandsalaris zonder verlof. Wisselt het contract midden in de maand,
 * dan telt elk contract naar rato van het aantal kalenderdagen dat het gold.
 */
export function normalGrossForMonth(
  month: string,
  contracts: readonly ContractLike[],
): number {
  const monthStart = startOfMonth(`${month}-01`);
  const monthEnd = endOfMonth(monthStart);

  const totalDays = Number(monthEnd.slice(8, 10));
  let gross = 0;
  let daysWithContract = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${month}-${`${day}`.padStart(2, "0")}` as DateOnly;
    const contract = contractForDate(contracts, date);
    if (!contract) continue;
    daysWithContract += 1;
    gross += contract.grossMonthlySalary / totalDays;
  }

  return daysWithContract === 0 ? 0 : gross;
}
