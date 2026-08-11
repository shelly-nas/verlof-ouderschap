import type { ContractLike } from "./contracts";
import { contractForDate } from "./contracts";
import {
  type DateOnly,
  addDaysOnly,
  addMonthsOnly,
  addWeeksOnly,
  addYearsOnly,
} from "./dates";

export type DeadlineAnchor =
  | "WEEKS_AFTER_BIRTH"
  | "MONTHS_AFTER_BIRTH"
  | "YEARS_AFTER_BIRTH"
  | "NONE";

export type LeaveTypeLike = {
  id: string;
  code: string;
  name: string;
  weeksMultiplier: number;
  payer: "EMPLOYER" | "UWV" | "UNPAID";
  payPercent: number | null;
  cappedAtMaxDagloon: boolean;
  deadlineAnchor: DeadlineAnchor;
  deadlineValue: number | null;
  fallbackLeaveTypeId: string | null;
  colorHex: string | null;
  sortOrder: number;
};

export type ChildLike = {
  id: string;
  name: string;
  dateOfBirth: DateOnly;
};

export type SupplementLike = {
  contractId: string;
  leaveTypeId: string;
  topUpToPercent: number | null;
  topUpUncapped: boolean;
  extraWeeks: number | null;
  deadlineOverrideMonths: number | null;
};

/**
 * De laatste dag waarop het verlof nog opgenomen mag worden, inclusief.
 *
 * "Binnen 4 weken na de geboorte" loopt t/m dag 28 na de geboortedatum;
 * "vóór de eerste verjaardag" loopt t/m de dag vóór die verjaardag. Die
 * inclusief/exclusief-keuze staat alleen hier, zodat hij niet per ongeluk
 * ergens anders anders wordt uitgelegd.
 */
export function deadlineFor(
  dateOfBirth: DateOnly,
  anchor: DeadlineAnchor,
  value: number | null,
  overrideMonths?: number | null,
): DateOnly | null {
  if (overrideMonths !== null && overrideMonths !== undefined) {
    return addDaysOnly(addMonthsOnly(dateOfBirth, overrideMonths), -1);
  }
  if (value === null || anchor === "NONE") return null;

  switch (anchor) {
    case "WEEKS_AFTER_BIRTH":
      // Vier weken na de geboorte = t/m dag 28.
      return addWeeksOnly(dateOfBirth, value);
    case "MONTHS_AFTER_BIRTH":
      return addMonthsOnly(dateOfBirth, value);
    case "YEARS_AFTER_BIRTH":
      // Vóór de verjaardag: de dag ervoor is de laatste geldige dag.
      return addDaysOnly(addYearsOnly(dateOfBirth, value), -1);
    default:
      return null;
  }
}

export type Entitlement = {
  childId: string;
  leaveTypeId: string;
  /** Contract waarop het recht is gebaseerd (dat van de geboortedatum). */
  referenceContract: ContractLike | null;
  hoursPerWeek: number;
  weeks: number;
  statutoryWeeks: number;
  extraWeeks: number;
  totalHours: number;
  deadline: DateOnly | null;
  payer: LeaveTypeLike["payer"];
  payPercent: number | null;
  topUpToPercent: number | null;
  topUpUncapped: boolean;
};

export function findSupplement(
  supplements: readonly SupplementLike[],
  contractId: string | null,
  leaveTypeId: string,
): SupplementLike | null {
  if (!contractId) return null;
  return (
    supplements.find(
      (item) => item.contractId === contractId && item.leaveTypeId === leaveTypeId,
    ) ?? null
  );
}

/**
 * Het recht in uren voor één kind en één verlofsoort.
 *
 * Het recht wordt uitgedrukt in uren van het contract dat gold op de
 * geboortedatum van het kind. Wissel je daarna van 40 naar 32 uur, dan blijft
 * het recht staan op de uren die bij de geboorte golden — reeds opgenomen uren
 * worden nooit omgerekend. Is er op de geboortedatum geen contract, dan valt de
 * berekening terug op het meest recente contract, zodat de app ook bruikbaar is
 * als je de historie niet volledig hebt ingevoerd.
 */
export function entitlementFor(
  child: ChildLike,
  leaveType: LeaveTypeLike,
  contracts: readonly ContractLike[],
  supplements: readonly SupplementLike[],
): Entitlement {
  const referenceContract =
    contractForDate(contracts, child.dateOfBirth) ??
    [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ??
    null;

  const supplement = findSupplement(
    supplements,
    referenceContract?.id ?? null,
    leaveType.id,
  );

  const hoursPerWeek = referenceContract?.hoursPerWeek ?? 0;
  const statutoryWeeks = leaveType.weeksMultiplier;
  const extraWeeks = supplement?.extraWeeks ?? 0;
  const weeks = statutoryWeeks + extraWeeks;

  return {
    childId: child.id,
    leaveTypeId: leaveType.id,
    referenceContract,
    hoursPerWeek,
    weeks,
    statutoryWeeks,
    extraWeeks,
    totalHours: weeks * hoursPerWeek,
    deadline: deadlineFor(
      child.dateOfBirth,
      leaveType.deadlineAnchor,
      leaveType.deadlineValue,
      supplement?.deadlineOverrideMonths ?? null,
    ),
    payer: leaveType.payer,
    payPercent: leaveType.payPercent,
    topUpToPercent: supplement?.topUpToPercent ?? null,
    topUpUncapped: supplement?.topUpUncapped ?? true,
  };
}

export function entitlementsFor(
  children: readonly ChildLike[],
  leaveTypes: readonly LeaveTypeLike[],
  contracts: readonly ContractLike[],
  supplements: readonly SupplementLike[],
): Entitlement[] {
  return children.flatMap((child) =>
    leaveTypes.map((leaveType) =>
      entitlementFor(child, leaveType, contracts, supplements),
    ),
  );
}
