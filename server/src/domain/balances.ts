import type { ContractLike } from "./contracts";
import type { DateOnly } from "./dates";
import { daysBetween } from "./dates";
import { roundHours } from "./money";
import {
  type ChildLike,
  type Entitlement,
  type LeaveTypeLike,
  type SupplementLike,
  entitlementFor,
} from "./entitlements";

export type LeaveEntryLike = {
  id: string;
  date: DateOnly;
  hours: number;
  childId: string;
  leaveTypeId: string;
};

export type DeadlineStatus = "OK" | "SOON" | "EXPIRED" | "DONE" | "NONE";

/** Binnen hoeveel dagen een naderende deadline als "SOON" telt. */
export const DEADLINE_SOON_DAYS = 60;

export type Balance = {
  childId: string;
  childName: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  colorHex: string | null;
  sortOrder: number;
  entitlement: Entitlement;
  /** Wettelijk recht in uren, vóór doorschuiven. */
  baseEntitledHours: number;
  /** Uren die uit een verlopen verlofsoort zijn doorgeschoven naar deze soort. */
  carriedInHours: number;
  /** Uren die vanuit deze soort zijn doorgeschoven naar de fallback-soort. */
  carriedOutHours: number;
  /** Recht inclusief doorschuiven. */
  entitledHours: number;
  usedHours: number;
  remainingHours: number;
  deadline: DateOnly | null;
  deadlineStatus: DeadlineStatus;
  daysUntilDeadline: number | null;
  /** Uren geboekt na de deadline: een datafout die zichtbaar moet zijn. */
  usedAfterDeadlineHours: number;
  /** Meer opgenomen dan het recht toestaat. */
  overBookedHours: number;
};

function statusFor(
  deadline: DateOnly | null,
  remainingHours: number,
  entitledHours: number,
  today: DateOnly,
): { status: DeadlineStatus; daysUntil: number | null } {
  if (entitledHours > 0 && remainingHours <= 0) {
    return { status: "DONE", daysUntil: deadline ? daysBetween(today, deadline) : null };
  }
  if (!deadline) return { status: "NONE", daysUntil: null };

  const daysUntil = daysBetween(today, deadline);
  if (daysUntil < 0) return { status: "EXPIRED", daysUntil };
  if (daysUntil <= DEADLINE_SOON_DAYS) return { status: "SOON", daysUntil };
  return { status: "OK", daysUntil };
}

/**
 * Saldo per kind per verlofsoort.
 *
 * Ouderschapsverlof is wettelijk één pot van 26 weken waarvan er 9 betaald zijn.
 * Neem je die betaalde weken niet op vóór de eerste verjaardag, dan vervalt de
 * uitkering maar niet het verlofrecht: het restant schuift door naar het
 * onbetaalde deel. Dat gebeurt hier via `fallbackLeaveTypeId`.
 */
export function balancesFor(params: {
  children: readonly ChildLike[];
  leaveTypes: readonly LeaveTypeLike[];
  contracts: readonly ContractLike[];
  supplements: readonly SupplementLike[];
  entries: readonly LeaveEntryLike[];
  today: DateOnly;
}): Balance[] {
  const { children, leaveTypes, contracts, supplements, entries, today } = params;

  const usedByKey = new Map<string, number>();
  const usedAfterDeadlineByKey = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.childId}:${entry.leaveTypeId}`;
    usedByKey.set(key, (usedByKey.get(key) ?? 0) + entry.hours);
  }

  const balances: Balance[] = [];

  for (const child of children) {
    // Eerst het kale recht en verbruik per verlofsoort bepalen.
    const rows = leaveTypes.map((leaveType) => {
      const entitlement = entitlementFor(child, leaveType, contracts, supplements);
      const key = `${child.id}:${leaveType.id}`;
      // Afronden voorkomt dat het optellen van deeldagen (6,4 uur bij een
      // 32-urig contract) een saldo van -0,0000001 oplevert dat als
      // overschrijding wordt gelezen.
      const usedHours = roundHours(usedByKey.get(key) ?? 0);

      const usedAfterDeadlineHours = entitlement.deadline
        ? roundHours(
            entries
              .filter(
                (entry) =>
                  entry.childId === child.id &&
                  entry.leaveTypeId === leaveType.id &&
                  entry.date > entitlement.deadline!,
              )
              .reduce((sum, entry) => sum + entry.hours, 0),
          )
        : 0;
      usedAfterDeadlineByKey.set(key, usedAfterDeadlineHours);

      return { leaveType, entitlement, usedHours, usedAfterDeadlineHours };
    });

    // Doorschuiven: is de deadline verstreken en resteert er recht, dan verhuist
    // dat restant naar de fallback-verlofsoort.
    const carriedIn = new Map<string, number>();
    const carriedOut = new Map<string, number>();

    for (const row of rows) {
      const { leaveType, entitlement, usedHours } = row;
      if (!leaveType.fallbackLeaveTypeId || !entitlement.deadline) continue;
      if (entitlement.deadline >= today) continue;

      const leftover = Math.max(0, entitlement.totalHours - usedHours);
      if (leftover <= 0) continue;

      carriedOut.set(leaveType.id, (carriedOut.get(leaveType.id) ?? 0) + leftover);
      carriedIn.set(
        leaveType.fallbackLeaveTypeId,
        (carriedIn.get(leaveType.fallbackLeaveTypeId) ?? 0) + leftover,
      );
    }

    for (const row of rows) {
      const { leaveType, entitlement, usedHours, usedAfterDeadlineHours } = row;
      const carriedInHours = roundHours(carriedIn.get(leaveType.id) ?? 0);
      const carriedOutHours = roundHours(carriedOut.get(leaveType.id) ?? 0);
      const entitledHours = roundHours(
        entitlement.totalHours + carriedInHours - carriedOutHours,
      );
      const remainingHours = roundHours(entitledHours - usedHours);
      const { status, daysUntil } = statusFor(
        entitlement.deadline,
        remainingHours,
        entitledHours,
        today,
      );

      balances.push({
        childId: child.id,
        childName: child.name,
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        leaveTypeName: leaveType.name,
        colorHex: leaveType.colorHex,
        sortOrder: leaveType.sortOrder,
        entitlement,
        baseEntitledHours: entitlement.totalHours,
        carriedInHours,
        carriedOutHours,
        entitledHours,
        usedHours,
        remainingHours,
        deadline: entitlement.deadline,
        deadlineStatus: status,
        daysUntilDeadline: daysUntil,
        usedAfterDeadlineHours,
        overBookedHours: roundHours(Math.max(0, usedHours - entitledHours)),
      });
    }
  }

  return balances.sort(
    (a, b) =>
      a.childName.localeCompare(b.childName) ||
      a.sortOrder - b.sortOrder ||
      a.leaveTypeName.localeCompare(b.leaveTypeName),
  );
}

export function balanceKey(childId: string, leaveTypeId: string): string {
  return `${childId}:${leaveTypeId}`;
}

export function balanceMap(balances: readonly Balance[]): Map<string, Balance> {
  return new Map(balances.map((b) => [balanceKey(b.childId, b.leaveTypeId), b]));
}
