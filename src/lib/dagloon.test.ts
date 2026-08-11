import { describe, expect, it } from "vitest";
import {
  type MaxDagloonRow,
  UWV_DAGEN_PER_MAAND,
  dagloonFromMonthly,
  dayRate,
  hoursToDayEquivalent,
  maxDagloonAt,
} from "./dagloon";

const MAX_DAGLONEN: MaxDagloonRow[] = [
  { validFrom: "2025-01-01", amount: 290.67 },
  { validFrom: "2025-07-01", amount: 297.82 },
  { validFrom: "2026-01-01", amount: 309.91 },
];

describe("maxDagloonAt", () => {
  it("pakt de waarde die op die dag gold", () => {
    expect(maxDagloonAt("2025-06-30", MAX_DAGLONEN)).toBe(290.67);
    expect(maxDagloonAt("2025-07-01", MAX_DAGLONEN)).toBe(297.82);
    expect(maxDagloonAt("2025-12-31", MAX_DAGLONEN)).toBe(297.82);
    expect(maxDagloonAt("2026-01-01", MAX_DAGLONEN)).toBe(309.91);
  });

  it("blijft op de laatst bekende waarde staan na de laatste rij", () => {
    expect(maxDagloonAt("2030-05-05", MAX_DAGLONEN)).toBe(309.91);
  });

  it("gooit een fout vóór de eerste bekende waarde in plaats van 0 te rekenen", () => {
    expect(() => maxDagloonAt("2024-12-31", MAX_DAGLONEN)).toThrow(/maximumdagloon/i);
    expect(() => maxDagloonAt("2026-01-01", [])).toThrow(/seed/i);
  });
});

describe("dagloon", () => {
  it("rekent het maandsalaris om met de UWV-factor", () => {
    expect(dagloonFromMonthly(4000)).toBeCloseTo(4000 / UWV_DAGEN_PER_MAAND, 6);
    expect(dagloonFromMonthly(4000)).toBeCloseTo(183.9, 1);
  });

  it("rekent deeldagen om naar dagequivalenten", () => {
    expect(hoursToDayEquivalent(8, 40)).toBe(1);
    expect(hoursToDayEquivalent(4, 40)).toBe(0.5);
    // Bij 32 uur is een werkdag 6,4 uur.
    expect(hoursToDayEquivalent(6.4, 32)).toBeCloseTo(1, 6);
    expect(hoursToDayEquivalent(8, 0)).toBe(0);
  });
});

describe("dayRate", () => {
  const base = {
    date: "2026-02-10" as const,
    maxDaglonen: MAX_DAGLONEN,
  };

  it("betaalt geboorteverlof volledig door via de werkgever", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "EMPLOYER",
      payPercent: 100,
      cappedAtMaxDagloon: false,
    });
    expect(rate.employerPerDay).toBeCloseTo(rate.normalDagloon, 6);
    expect(rate.uwvPerDay).toBe(0);
    expect(rate.lossPerDay).toBeCloseTo(0, 6);
  });

  it("keert 70% uit onder het maximumdagloon zonder cap", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000, // dagloon ~183,91, ruim onder 309,91
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
    });
    expect(rate.cappedByMaxDagloon).toBe(false);
    expect(rate.basisDagloon).toBeCloseTo(rate.normalDagloon, 6);
    expect(rate.uwvPerDay).toBeCloseTo(0.7 * rate.normalDagloon, 6);
    expect(rate.lossPerDay).toBeCloseTo(0.3 * rate.normalDagloon, 6);
  });

  it("capt de uitkering bij een dagloon boven het maximum", () => {
    // 8000 / 21,75 = 367,82 per dag; dat ligt boven het maximum van 309,91.
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 8000,
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
    });
    expect(rate.cappedByMaxDagloon).toBe(true);
    expect(rate.basisDagloon).toBe(309.91);
    expect(rate.uwvPerDay).toBeCloseTo(0.7 * 309.91, 6);
    // Effectief minder dan 70% van het eigen loon.
    expect(rate.uwvPerDay / rate.normalDagloon).toBeLessThan(0.7);
  });

  it("gebruikt het maximumdagloon van de verlofdag zelf", () => {
    const juni = dayRate({
      date: "2025-06-30",
      maxDaglonen: MAX_DAGLONEN,
      grossMonthlySalary: 9000,
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
    });
    const juli = dayRate({
      date: "2025-07-01",
      maxDaglonen: MAX_DAGLONEN,
      grossMonthlySalary: 9000,
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
    });
    expect(juni.basisDagloon).toBe(290.67);
    expect(juli.basisDagloon).toBe(297.82);
    expect(juli.uwvPerDay).toBeGreaterThan(juni.uwvPerDay);
  });

  it("betaalt niets bij onbetaald verlof", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "UNPAID",
      payPercent: null,
      cappedAtMaxDagloon: false,
    });
    expect(rate.totalPerDay).toBe(0);
    expect(rate.lossPerDay).toBeCloseTo(rate.normalDagloon, 6);
  });

  it("vult aan tot 100% over het volle dagloon, ook boven de cap", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 8000,
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
      topUpToPercent: 100,
      topUpUncapped: true,
    });
    expect(rate.totalPerDay).toBeCloseTo(rate.normalDagloon, 6);
    expect(rate.lossPerDay).toBeCloseTo(0, 6);
    expect(rate.topUpPerDay).toBeGreaterThan(0);
  });

  it("vult bij topUpUncapped=false alleen aan tot het gecapte dagloon", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 8000,
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
      topUpToPercent: 100,
      topUpUncapped: false,
    });
    expect(rate.totalPerDay).toBeCloseTo(309.91, 6);
    expect(rate.lossPerDay).toBeGreaterThan(0);
  });

  it("vult niet aan als de aanvulling lager is dan de uitkering", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "UWV",
      payPercent: 70,
      cappedAtMaxDagloon: true,
      topUpToPercent: 50,
    });
    expect(rate.topUpPerDay).toBe(0);
  });
});
