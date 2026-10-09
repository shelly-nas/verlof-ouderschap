import { format, parse } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * Een verlofdag is een kalenderdag, geen moment in de tijd. Alle datums leven
 * daarom als "yyyy-MM-dd"-string aan de randen van de app en als UTC-middernacht
 * Date daarbinnen — precies wat Postgres' `date`-type teruggeeft. Zo kan er geen
 * zomertijd- of tijdzoneverschuiving in sluipen.
 */
export type DateOnly = string;

const DATE_FORMAT = "yyyy-MM-dd";

/** Parse "2026-02-01" naar een Date op UTC-middernacht. */
export function parseDateOnly(value: DateOnly): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Ongeldige datum: "${value}" (verwacht yyyy-MM-dd)`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Ongeldige datum: "${value}"`);
  }
  return date;
}

/**
 * Formatteer een Date naar "yyyy-MM-dd" op basis van de UTC-velden. Nooit
 * toISOString() gebruiken op een lokale Date en nooit getFullYear() op een
 * UTC-middernacht Date — beide schuiven een dag afhankelijk van de tijdzone.
 */
export function formatDateOnly(date: Date): DateOnly {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** De datum van vandaag in de opgegeven tijdzone (standaard Europe/Amsterdam). */
export function today(timeZone = "Europe/Amsterdam"): DateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts as DateOnly;
}

// De datumrekenkunde staat bewust niet in date-fns: die functies rekenen in de
// lokale tijdzone, en op een UTC-middernacht Date levert dat in Amsterdam een
// verschuiving van een dag op.

export function addDaysOnly(value: DateOnly, days: number): DateOnly {
  const date = parseDateOnly(value);
  return formatDateOnly(new Date(date.getTime() + days * 86_400_000));
}

export function addWeeksOnly(value: DateOnly, weeks: number): DateOnly {
  return addDaysOnly(value, weeks * 7);
}

/**
 * Maanden optellen met dezelfde clamping als date-fns: 31 januari + 1 maand
 * wordt 28 (of 29) februari, niet 3 maart.
 */
export function addMonthsOnly(value: DateOnly, months: number): DateOnly {
  const date = parseDateOnly(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthStart = new Date(Date.UTC(year, month + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return formatDateOnly(
    new Date(
      Date.UTC(
        targetMonthStart.getUTCFullYear(),
        targetMonthStart.getUTCMonth(),
        Math.min(day, daysInTargetMonth),
      ),
    ),
  );
}

export function addYearsOnly(value: DateOnly, years: number): DateOnly {
  return addMonthsOnly(value, years * 12);
}

/** Verschil in hele dagen: b - a. */
export function daysBetween(a: DateOnly, b: DateOnly): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / MS_PER_DAY);
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBeforeDateOnly(a: DateOnly, b: DateOnly): boolean {
  return a < b;
}

export function isAfterDateOnly(a: DateOnly, b: DateOnly): boolean {
  return a > b;
}

/** Inclusief aan beide zijden; `to` mag null zijn voor "loopt nog door". */
export function isWithinRange(value: DateOnly, from: DateOnly, to: DateOnly | null): boolean {
  if (value < from) return false;
  if (to !== null && value > to) return false;
  return true;
}

export type IsoWeekKey = string;

/** Maandag van de ISO-week waarin `value` valt. */
export function startOfIsoWeek(value: DateOnly): DateOnly {
  const date = parseDateOnly(value);
  // getUTCDay geeft zondag = 0; ISO-weken beginnen op maandag.
  const dayOfWeek = (date.getUTCDay() + 6) % 7;
  return addDaysOnly(value, -dayOfWeek);
}

/**
 * ISO-weeksleutel, bijvoorbeeld "2026-W07".
 *
 * Het jaar in de sleutel is het ISO-weekjaar, niet het kalenderjaar: 1 januari
 * 2027 valt nog in week 53 van 2026, en 31 december 2029 valt al in week 1 van
 * 2030.
 */
export function isoWeekKey(value: DateOnly): IsoWeekKey {
  // De donderdag van deze week bepaalt per ISO-definitie het weekjaar.
  const thursday = addDaysOnly(startOfIsoWeek(value), 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDaysOnly(startOfIsoWeek(`${year}-01-04`), 3);
  const week = Math.round(daysBetween(firstThursday, thursday) / 7) + 1;
  return `${year}-W${`${week}`.padStart(2, "0")}`;
}

/** Zet "2026-W07" om naar de maandag en zondag van die week. */
export function parseIsoWeekKey(key: IsoWeekKey): { start: DateOnly; end: DateOnly } {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) {
    throw new Error(`Ongeldige weeksleutel: "${key}" (verwacht yyyy-Www)`);
  }
  const [, year, week] = match;
  const weekNumber = Number(week);
  if (weekNumber < 1 || weekNumber > 53) {
    throw new Error(`Ongeldig weeknummer: "${key}"`);
  }
  // 4 januari valt per ISO-definitie altijd in week 1.
  const firstMonday = startOfIsoWeek(`${year}-01-04`);
  const start = addWeeksOnly(firstMonday, weekNumber - 1);
  // Niet elk jaar heeft een week 53.
  if (isoWeekKey(start) !== key) {
    throw new Error(`Week ${key} bestaat niet in dat jaar`);
  }
  return { start, end: addDaysOnly(start, 6) };
}

/** De zeven dagen (ma t/m zo) van de week waarin `weekStart` valt. */
export function weekdaysOf(weekStart: DateOnly): DateOnly[] {
  const monday = startOfIsoWeek(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDaysOnly(monday, index));
}

/**
 * De weken van een maandkalender: rijen van zeven dagen, van maandag tot en met
 * zondag. De eerste en laatste rij lopen door in de vorige respectievelijk
 * volgende maand, zodat elke rij compleet is.
 */
export function calendarWeeksOf(month: string): DateOnly[][] {
  const first = startOfMonth(`${month}-01`);
  const last = endOfMonth(first);

  const weeks: DateOnly[][] = [];
  let cursor = startOfIsoWeek(first);

  // De laatste rij is die waarin de laatste dag van de maand valt.
  const lastRowStart = startOfIsoWeek(last);
  while (cursor <= lastRowStart) {
    weeks.push(weekdaysOf(cursor));
    cursor = addDaysOnly(cursor, 7);
  }
  return weeks;
}

export function shiftIsoWeek(key: IsoWeekKey, weeks: number): IsoWeekKey {
  const { start } = parseIsoWeekKey(key);
  return isoWeekKey(addWeeksOnly(start, weeks));
}

/** Zaterdag of zondag. */
export function isWeekend(value: DateOnly): boolean {
  const day = parseDateOnly(value).getUTCDay();
  return day === 0 || day === 6;
}

export function startOfMonth(value: DateOnly): DateOnly {
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonth(value: DateOnly): DateOnly {
  const start = parseDateOnly(startOfMonth(value));
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return formatDateOnly(new Date(next.getTime() - 86_400_000));
}

export function monthKey(value: DateOnly): string {
  return value.slice(0, 7);
}

// Weergave in het Nederlands.

export function formatDayShort(value: DateOnly): string {
  return format(parse(value, DATE_FORMAT, new Date()), "EEEEEE d MMM", { locale: nl });
}

export function formatDayLong(value: DateOnly): string {
  return format(parse(value, DATE_FORMAT, new Date()), "EEEE d MMMM yyyy", { locale: nl });
}

/** "maandag 10 aug." — dagnaam voluit, datum kort. Voor het weekscherm. */
export function formatWeekdayWithDate(value: DateOnly): string {
  return format(parse(value, DATE_FORMAT, new Date()), "EEEE d MMM", { locale: nl });
}

export function formatDateNl(value: DateOnly): string {
  return format(parse(value, DATE_FORMAT, new Date()), "d MMMM yyyy", { locale: nl });
}

export function formatDateShortNl(value: DateOnly): string {
  return format(parse(value, DATE_FORMAT, new Date()), "d MMM yyyy", { locale: nl });
}

export function formatMonthNl(value: DateOnly): string {
  return format(parse(value, DATE_FORMAT, new Date()), "MMMM yyyy", { locale: nl });
}

export function isoWeekNumber(key: IsoWeekKey): number {
  return Number(key.slice(6));
}
