import { describe, expect, it } from "vitest";
import {
  UWV_DAGEN_PER_MAAND,
  dagloonFromMonthly,
  dayRate,
  hoursToDayEquivalent,
} from "./dagloon";

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
  const base = { date: "2026-02-10" as const };

  it("betaalt geboorteverlof volledig door via de werkgever", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "EMPLOYER",
      payPercent: 100,
    });
    expect(rate.employerPerDay).toBeCloseTo(rate.normalDagloon, 6);
    expect(rate.uwvPerDay).toBe(0);
    expect(rate.lossPerDay).toBeCloseTo(0, 6);
  });

  it("keert 70% van het eigen dagloon uit bij UWV-verlof", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "UWV",
      payPercent: 70,
    });
    expect(rate.uwvPerDay).toBeCloseTo(0.7 * rate.normalDagloon, 6);
    expect(rate.lossPerDay).toBeCloseTo(0.3 * rate.normalDagloon, 6);
  });

  it("blijft 70% van het eigen dagloon, ook bij een hoog salaris", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 9000,
      payer: "UWV",
      payPercent: 70,
    });
    expect(rate.uwvPerDay).toBeCloseTo(0.7 * (9000 / UWV_DAGEN_PER_MAAND), 6);
    expect(rate.uwvPerDay / rate.normalDagloon).toBeCloseTo(0.7, 6);
  });

  it("betaalt niets bij onbetaald verlof", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "UNPAID",
      payPercent: null,
    });
    expect(rate.totalPerDay).toBe(0);
    expect(rate.lossPerDay).toBeCloseTo(rate.normalDagloon, 6);
  });

  it("vult met een werkgeversaanvulling aan tot het volle dagloon", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "UWV",
      payPercent: 70,
      topUpToPercent: 100,
    });
    expect(rate.totalPerDay).toBeCloseTo(rate.normalDagloon, 6);
    expect(rate.lossPerDay).toBeCloseTo(0, 6);
    expect(rate.topUpPerDay).toBeCloseTo(0.3 * rate.normalDagloon, 6);
  });

  it("vult niet aan als de aanvulling lager is dan de uitkering", () => {
    const rate = dayRate({
      ...base,
      grossMonthlySalary: 4000,
      payer: "UWV",
      payPercent: 70,
      topUpToPercent: 50,
    });
    expect(rate.topUpPerDay).toBe(0);
  });
});
