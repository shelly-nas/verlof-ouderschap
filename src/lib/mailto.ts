import type { LeaveEntryLike } from "./balances";
import {
  type DateOnly,
  addMonthsOnly,
  endOfMonth,
  formatDateShortNl,
  formatDayShort,
  formatMonthNl,
  isoWeekKey,
  isoWeekNumber,
  parseIsoWeekKey,
  startOfMonth,
} from "./dates";
import type { ChildLike, LeaveTypeLike } from "./entitlements";
import { formatHoursNumber, roundHours } from "./money";

/**
 * mailto:-links worden door mailclients afgekapt. Outlook geeft rond 2000 tekens
 * op, dus onder die grens blijven en anders de kopieer-knop tonen.
 */
export const MAILTO_MAX_LENGTH = 1800;

export type MailInput = {
  employerName: string;
  employerEmail: string;
  entries: readonly LeaveEntryLike[];
  children: readonly ChildLike[];
  leaveTypes: readonly LeaveTypeLike[];
  /** Eerste dag van de maand waarover gemaild wordt. */
  monthStart: DateOnly;
  senderName?: string | null;
};

export type MailResult = {
  to: string;
  subject: string;
  body: string;
  href: string;
  length: number;
  tooLong: boolean;
  entryCount: number;
  totalHours: number;
};

/** De maand waarover je nu meldt: de eerstvolgende maand. */
export function reportingMonthFor(today: DateOnly): DateOnly {
  return startOfMonth(addMonthsOnly(today, 1));
}

/** Dagen tot de 15e van de huidige maand; negatief als die al voorbij is. */
export function daysUntilDeadline(today: DateOnly): number {
  const fifteenth = `${today.slice(0, 7)}-15`;
  const MS_PER_DAY = 86_400_000;
  return Math.round(
    (new Date(`${fifteenth}T00:00:00.000Z`).getTime() -
      new Date(`${today}T00:00:00.000Z`).getTime()) /
      MS_PER_DAY,
  );
}

/**
 * Stelt de mail samen: alleen een overzicht per week met datums en uren, want
 * dat is wat de werkgever nodig heeft om het verlof in te plannen.
 */
export function buildLeaveEmail(input: MailInput): MailResult {
  const monthStart = startOfMonth(input.monthStart);
  const monthEnd = endOfMonth(monthStart);

  const entries = [...input.entries]
    .filter((entry) => entry.date >= monthStart && entry.date <= monthEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  const childById = new Map(input.children.map((child) => [child.id, child]));
  const leaveTypeById = new Map(input.leaveTypes.map((type) => [type.id, type]));
  const multipleChildren = input.children.length > 1;

  const monthLabel = formatMonthNl(monthStart);
  const subject = `Opname verlof ${monthLabel}`;

  const lines: string[] = [];
  lines.push(`Beste ${input.employerName},`);
  lines.push("");
  lines.push(`Hierbij mijn verlofopname voor ${monthLabel}:`);
  lines.push("");

  if (entries.length === 0) {
    lines.push("Ik neem deze maand geen verlof op.");
  } else {
    const byWeek = new Map<string, LeaveEntryLike[]>();
    for (const entry of entries) {
      const key = isoWeekKey(entry.date);
      const list = byWeek.get(key) ?? [];
      list.push(entry);
      byWeek.set(key, list);
    }

    for (const [weekKey, weekEntries] of [...byWeek.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const { start, end } = parseIsoWeekKey(weekKey);
      lines.push(
        `Week ${isoWeekNumber(weekKey)} (${formatDateShortNl(start)} t/m ${formatDateShortNl(end)})`,
      );

      for (const entry of weekEntries) {
        const leaveType = leaveTypeById.get(entry.leaveTypeId);
        const child = childById.get(entry.childId);
        const suffix = multipleChildren && child ? ` (${child.name})` : "";
        const typeName = leaveType ? ` ${leaveType.name.toLowerCase()}` : "";
        lines.push(
          `  ${formatDayShort(entry.date)}: ${formatHoursNumber(entry.hours)} uur${typeName}${suffix}`,
        );
      }
      lines.push("");
    }

    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    lines.push(`Totaal: ${formatHoursNumber(totalHours)} uur.`);
  }

  lines.push("");
  lines.push("Met vriendelijke groet,");
  if (input.senderName) lines.push(input.senderName);

  // Mailclients gaan verschillend om met een kale %0A; met CRLF tonen ze allemaal
  // een echte regelovergang.
  const body = lines.join("\r\n");
  const href = `mailto:${encodeURIComponent(input.employerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    to: input.employerEmail,
    subject,
    body,
    href,
    length: href.length,
    tooLong: href.length > MAILTO_MAX_LENGTH,
    entryCount: entries.length,
    totalHours: roundHours(entries.reduce((sum, entry) => sum + entry.hours, 0)),
  };
}
