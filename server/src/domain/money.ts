/**
 * Postgres levert NUMERIC-kolommen als string; alles wat uit de database komt
 * gaat daarom door toNumber(). Geldbedragen worden pas bij weergave afgerond.
 */

export type DecimalLike = number | string | { toString(): string } | null | undefined;

export function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(typeof value === "string" ? value : value.toString());
  if (Number.isNaN(parsed)) {
    throw new Error(`Kan "${String(value)}" niet als getal lezen`);
  }
  return parsed;
}

export function toNumberOrNull(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  return toNumber(value);
}

/** Afronden op centen; alleen doen bij weergave of bij een eindtotaal. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Uren worden in kwartieren geregistreerd; 0,25 is de kleinste eenheid. */
export function roundHours(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(value: number): string {
  return euroFormatter.format(roundMoney(value));
}

const hoursFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatHours(value: number): string {
  return `${hoursFormatter.format(roundHours(value))} uur`;
}

export function formatHoursNumber(value: number): string {
  return hoursFormatter.format(roundHours(value));
}

/**
 * Leest "8", "8,5" en "8.5" als uren. Lege invoer geeft 0 zodat een leeggemaakt
 * veld in het weekscherm de regel verwijdert.
 */
export function parseHoursInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const normalised = trimmed.replace(",", ".");
  if (!/^\d*\.?\d*$/.test(normalised)) return null;
  const parsed = Number(normalised);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return roundHours(parsed);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(value)}%`;
}
