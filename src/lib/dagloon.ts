import type { DateOnly } from "./dates";
import { formatDateNl } from "./dates";

/** UWV rekent een maand om naar dagen met deze factor (261 werkdagen / 12). */
export const UWV_DAGEN_PER_MAAND = 21.75;

export type MaxDagloonRow = {
  validFrom: DateOnly;
  amount: number;
};

export type PayerKind = "EMPLOYER" | "UWV" | "UNPAID";

/** Dagloon uit het bruto maandsalaris. */
export function dagloonFromMonthly(grossMonthlySalary: number): number {
  return grossMonthlySalary / UWV_DAGEN_PER_MAAND;
}

/**
 * Het maximumdagloon dat gold op `date`. Peildatum is de verlofdag zelf, niet
 * vandaag: een verlofmaand rond 1 januari of 1 juli valt onder twee
 * verschillende maxima, dus reken altijd per dag.
 */
export function maxDagloonAt(date: DateOnly, rows: readonly MaxDagloonRow[]): number {
  const applicable = rows
    .filter((row) => row.validFrom <= date)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];

  if (!applicable) {
    const earliest = [...rows].sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
    throw new Error(
      earliest
        ? `Geen maximumdagloon bekend voor ${formatDateNl(date)}; de vroegste bekende waarde geldt pas vanaf ${formatDateNl(earliest.validFrom)}.`
        : `Geen maximumdaglonen in de database. Draai de seed.`,
    );
  }
  return applicable.amount;
}

export type DayRateInput = {
  date: DateOnly;
  /** Bruto maandsalaris uit het contract dat op `date` gold. */
  grossMonthlySalary: number;
  payer: PayerKind;
  payPercent: number | null;
  cappedAtMaxDagloon: boolean;
  maxDaglonen: readonly MaxDagloonRow[];
  /** Werkgever vult aan tot dit percentage van het dagloon; null = geen aanvulling. */
  topUpToPercent?: number | null;
  /** Aanvulling over het eigen dagloon in plaats van het gecapte bedrag. */
  topUpUncapped?: boolean;
};

export type DayRate = {
  /** Dagloon zonder verlof: wat een normale werkdag oplevert. */
  normalDagloon: number;
  /** Het dagloon waarover de uitkering wordt berekend (mogelijk gecapt). */
  basisDagloon: number;
  /** Deel dat de werkgever doorbetaalt (100%-verlofsoorten). */
  employerPerDay: number;
  /** Deel dat UWV uitkeert. */
  uwvPerDay: number;
  /** Bovenwettelijke aanvulling door de werkgever. */
  topUpPerDay: number;
  /** Totaal ontvangen per verlofdag. */
  totalPerDay: number;
  /** Gemist bruto inkomen per verlofdag. */
  lossPerDay: number;
  /** True als het eigen dagloon boven het maximumdagloon uitkomt. */
  cappedByMaxDagloon: boolean;
  maxDagloon: number | null;
};

/**
 * Wat één volledige verlofdag bruto oplevert. Uitkering is
 * `payPercent × min(eigen dagloon, maximumdagloon)` voor UWV-soorten; de
 * werkgeversaanvulling gaat standaard over het volle eigen dagloon, want dat is
 * hoe cao-aanvullingen doorgaans zijn geformuleerd.
 */
export function dayRate(input: DayRateInput): DayRate {
  const normalDagloon = dagloonFromMonthly(input.grossMonthlySalary);
  const maxDagloon = input.cappedAtMaxDagloon
    ? maxDagloonAt(input.date, input.maxDaglonen)
    : null;

  const basisDagloon =
    maxDagloon === null ? normalDagloon : Math.min(normalDagloon, maxDagloon);
  const cappedByMaxDagloon = maxDagloon !== null && normalDagloon > maxDagloon;

  const percent = input.payPercent ?? 0;
  const statutoryPerDay = input.payer === "UNPAID" ? 0 : (percent / 100) * basisDagloon;

  const employerPerDay = input.payer === "EMPLOYER" ? statutoryPerDay : 0;
  const uwvPerDay = input.payer === "UWV" ? statutoryPerDay : 0;

  let topUpPerDay = 0;
  const topUpTarget = input.topUpToPercent ?? null;
  if (topUpTarget !== null) {
    const topUpBase = (input.topUpUncapped ?? true) ? normalDagloon : basisDagloon;
    const target = (topUpTarget / 100) * topUpBase;
    topUpPerDay = Math.max(0, target - (employerPerDay + uwvPerDay));
  }

  const totalPerDay = employerPerDay + uwvPerDay + topUpPerDay;

  return {
    normalDagloon,
    basisDagloon,
    employerPerDay,
    uwvPerDay,
    topUpPerDay,
    totalPerDay,
    lossPerDay: Math.max(0, normalDagloon - totalPerDay),
    cappedByMaxDagloon,
    maxDagloon,
  };
}

/**
 * Uren naar dagequivalenten: 4 uur bij een achturige dag telt als een halve
 * uitkeringsdag.
 */
export function hoursToDayEquivalent(hours: number, hoursPerWeek: number): number {
  const hoursPerDay = hoursPerWeek / 5;
  if (hoursPerDay <= 0) return 0;
  return hours / hoursPerDay;
}
