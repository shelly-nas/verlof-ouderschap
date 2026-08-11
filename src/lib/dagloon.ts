import type { DateOnly } from "./dates";

/** UWV rekent een maand om naar dagen met deze factor (261 werkdagen / 12). */
export const UWV_DAGEN_PER_MAAND = 21.75;

export type PayerKind = "EMPLOYER" | "UWV" | "UNPAID";

/** Dagloon uit het bruto maandsalaris. */
export function dagloonFromMonthly(grossMonthlySalary: number): number {
  return grossMonthlySalary / UWV_DAGEN_PER_MAAND;
}

export type DayRateInput = {
  date: DateOnly;
  /** Bruto maandsalaris uit het contract dat op `date` gold. */
  grossMonthlySalary: number;
  payer: PayerKind;
  payPercent: number | null;
  /** Werkgever vult aan tot dit percentage van het dagloon; null = geen aanvulling. */
  topUpToPercent?: number | null;
};

export type DayRate = {
  /** Dagloon zonder verlof: wat een normale werkdag oplevert. */
  normalDagloon: number;
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
};

/**
 * Wat één volledige verlofdag bruto oplevert: `payPercent` van het dagloon,
 * eventueel aangevuld door de werkgever tot `topUpToPercent`.
 */
export function dayRate(input: DayRateInput): DayRate {
  const normalDagloon = dagloonFromMonthly(input.grossMonthlySalary);

  const percent = input.payPercent ?? 0;
  const statutoryPerDay = input.payer === "UNPAID" ? 0 : (percent / 100) * normalDagloon;

  const employerPerDay = input.payer === "EMPLOYER" ? statutoryPerDay : 0;
  const uwvPerDay = input.payer === "UWV" ? statutoryPerDay : 0;

  const topUpTarget = input.topUpToPercent ?? null;
  const topUpPerDay =
    topUpTarget === null
      ? 0
      : Math.max(0, (topUpTarget / 100) * normalDagloon - (employerPerDay + uwvPerDay));

  const totalPerDay = employerPerDay + uwvPerDay + topUpPerDay;

  return {
    normalDagloon,
    employerPerDay,
    uwvPerDay,
    topUpPerDay,
    totalPerDay,
    lossPerDay: Math.max(0, normalDagloon - totalPerDay),
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
