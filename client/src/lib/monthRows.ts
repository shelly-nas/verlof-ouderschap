import type { Balance, LeaveEntry } from "../api/types";
import type { DateOnly } from "./dates";
import { roundHours } from "./money";

/**
 * De bewerkbare toestand van een maand: één regel per dag, kind en
 * verlofsoort. Opslaan stuurt precies deze regels als eindtoestand.
 */
export type Row = {
  date: DateOnly;
  childId: string;
  leaveTypeId: string;
  hours: number;
};

export function rowKey(row: Pick<Row, "date" | "childId" | "leaveTypeId">): string {
  return `${row.date}|${row.childId}|${row.leaveTypeId}`;
}

export function balanceKey(childId: string, leaveTypeId: string): string {
  return `${childId}:${leaveTypeId}`;
}

export function rowsFromEntries(entries: readonly LeaveEntry[]): Row[] {
  return entries.map(({ date, childId, leaveTypeId, hours }) => ({ date, childId, leaveTypeId, hours }));
}

/** Zijn de regels anders dan wat er opgeslagen staat? */
export function isDirty(rows: readonly Row[], saved: readonly LeaveEntry[]): boolean {
  if (rows.length !== saved.length) return true;
  const savedHours = new Map(saved.map((entry) => [rowKey(entry), entry.hours]));
  return rows.some((row) => savedHours.get(rowKey(row)) !== row.hours);
}

function weekday(date: DateOnly): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/**
 * Eén klik zet een volledige verlofdag neer met de gekozen soort; nog een klik
 * op dezelfde combinatie haalt hem weer weg. Staat er al iets anders op die
 * dag, dan komt de nieuwe soort erbij.
 */
export function toggleDay(rows: readonly Row[], target: Row): Row[] {
  const key = rowKey(target);
  return rows.some((row) => rowKey(row) === key)
    ? rows.filter((row) => rowKey(row) !== key)
    : [...rows, target];
}

/** Zet de uren van één regel; 0 of minder haalt hem weg. */
export function setHours(rows: readonly Row[], target: Row, hours: number): Row[] {
  const key = rowKey(target);
  return hours <= 0
    ? rows.filter((row) => rowKey(row) !== key)
    : rows.map((row) => (rowKey(row) === key ? { ...row, hours } : row));
}

export function addRow(rows: readonly Row[], target: Row): Row[] {
  const key = rowKey(target);
  return rows.some((row) => rowKey(row) === key) ? [...rows] : [...rows, target];
}

/**
 * Alle werkdagen (ma–vr) met een contract krijgen een volledige verlofdag van
 * de gekozen soort. Vervangt wat er stond.
 */
export function fillMonth(
  hoursPerWorkdayByDate: Record<string, number>,
  month: string,
  childId: string,
  leaveTypeId: string,
): Row[] {
  return Object.entries(hoursPerWorkdayByDate)
    .filter(([date]) => date.startsWith(month) && weekday(date) >= 1 && weekday(date) <= 5)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => ({ date, childId, leaveTypeId, hours }));
}

/** Vult één weekdag (bijvoorbeeld elke woensdag) in de hele maand. */
export function fillWeekday(
  rows: readonly Row[],
  hoursPerWorkdayByDate: Record<string, number>,
  month: string,
  day: number,
  childId: string,
  leaveTypeId: string,
): Row[] {
  const others = rows.filter((row) => weekday(row.date) !== day);
  const matching = Object.entries(hoursPerWorkdayByDate)
    .filter(([date]) => date.startsWith(month) && weekday(date) === day)
    .map(([date, hours]) => ({ date, childId, leaveTypeId, hours }));
  return [...others, ...matching];
}

function hoursByBalance(items: readonly { childId: string; leaveTypeId: string; hours: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = balanceKey(item.childId, item.leaveTypeId);
    map.set(key, (map.get(key) ?? 0) + item.hours);
  }
  return map;
}

/**
 * Verlofsoorten waarvan het recht van dit kind op is, met het verlof zoals het
 * nu op het scherm staat. Die kun je niet meer neerzetten, wel weghalen.
 */
export function exhaustedLeaveTypeIds(
  rows: readonly Row[],
  saved: readonly LeaveEntry[],
  balances: readonly Balance[],
  childId: string,
): Set<string> {
  const pending = hoursByBalance(rows);
  const alreadySaved = hoursByBalance(saved);
  const result = new Set<string>();
  for (const balance of balances) {
    if (balance.childId !== childId) continue;
    const key = balanceKey(balance.childId, balance.leaveTypeId);
    const remaining = roundHours(balance.remainingHours - ((pending.get(key) ?? 0) - (alreadySaved.get(key) ?? 0)));
    if (remaining <= 0) result.add(balance.leaveTypeId);
  }
  return result;
}

export type Projection = {
  key: string;
  balance: Balance;
  /** Resterend recht als deze maand wordt opgeslagen zoals hij nu op het scherm staat. */
  remaining: number;
  overBooked: number;
  afterDeadline: boolean;
};

/**
 * Het saldo na opslaan, per kind en verlofsoort die deze maand voorkomt.
 * `balance.usedHours` bevat de opgeslagen uren van deze maand al; alleen het
 * verschil met wat er nu op het scherm staat telt mee.
 */
export function projectBalances(
  rows: readonly Row[],
  saved: readonly LeaveEntry[],
  balances: readonly Balance[],
): Projection[] {
  const pending = hoursByBalance(rows);
  const alreadySaved = hoursByBalance(saved);
  const lookup = new Map(balances.map((balance) => [balanceKey(balance.childId, balance.leaveTypeId), balance]));

  const result: Projection[] = [];
  for (const [key, hours] of pending) {
    const balance = lookup.get(key);
    if (!balance) continue;
    const remaining = roundHours(balance.remainingHours - (hours - (alreadySaved.get(key) ?? 0)));
    result.push({
      key,
      balance,
      remaining,
      overBooked: remaining < 0 ? Math.abs(remaining) : 0,
      afterDeadline:
        balance.deadline !== null &&
        rows.some((row) => balanceKey(row.childId, row.leaveTypeId) === key && row.date > balance.deadline!),
    });
  }
  return result;
}
