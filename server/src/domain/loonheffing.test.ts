import { describe, expect, it } from "../test/expect";
import {
  generalTaxCredit,
  grossAnnualTax,
  labourTaxCredit,
  monthlyPayrollTax,
  taxYearFor,
} from "./loonheffing";

const tax2026 = taxYearFor(2026);

describe("taxYearFor", () => {
  it("valt terug op het laatst bekende jaar", () => {
    expect(taxYearFor(2026).year).toBe(2026);
    expect(taxYearFor(2030).year).toBe(2026);
  });
});

describe("schijventarief", () => {
  it("rekent binnen de eerste schijf", () => {
    expect(grossAnnualTax(10_000, tax2026)).toBeCloseTo(10_000 * 0.3575, 2);
  });

  it("rekent over de schijfgrens heen", () => {
    // 38.883 in schijf 1, de rest in schijf 2.
    const expected = 38_883 * 0.3575 + (50_000 - 38_883) * 0.3756;
    expect(grossAnnualTax(50_000, tax2026)).toBeCloseTo(expected, 2);
  });

  it("rekent in de hoogste schijf", () => {
    const expected =
      38_883 * 0.3575 + (78_426 - 38_883) * 0.3756 + (100_000 - 78_426) * 0.495;
    expect(grossAnnualTax(100_000, tax2026)).toBeCloseTo(expected, 2);
  });

  it("geeft 0 bij geen inkomen", () => {
    expect(grossAnnualTax(0, tax2026)).toBe(0);
    expect(grossAnnualTax(-100, tax2026)).toBe(0);
  });
});

describe("algemene heffingskorting", () => {
  it("staat op het maximum onder de afbouwgrens", () => {
    expect(generalTaxCredit(25_000, tax2026)).toBe(3_115);
    expect(generalTaxCredit(29_736, tax2026)).toBe(3_115);
  });

  it("bouwt af boven de grens", () => {
    expect(generalTaxCredit(63_786.36, tax2026)).toBeCloseTo(
      3_115 - (63_786.36 - 29_736) * 0.06398,
      2,
    );
  });

  it("is nul vanaf het eindpunt", () => {
    expect(generalTaxCredit(78_426, tax2026)).toBe(0);
    expect(generalTaxCredit(120_000, tax2026)).toBe(0);
  });
});

describe("arbeidskorting", () => {
  it("bouwt op in het eerste traject", () => {
    expect(labourTaxCredit(10_000, tax2026)).toBeCloseTo(10_000 * 0.08324, 2);
  });

  it("bereikt het maximum op het knikpunt", () => {
    expect(labourTaxCredit(45_592, tax2026)).toBeCloseTo(5_685, 0);
  });

  it("bouwt af boven het knikpunt", () => {
    expect(labourTaxCredit(63_786.36, tax2026)).toBeCloseTo(
      5_685 - (63_786.36 - 45_592) * 0.0651,
      2,
    );
  });

  it("wordt niet negatief", () => {
    expect(labourTaxCredit(200_000, tax2026)).toBe(0);
  });
});

describe("maandelijkse loonheffing", () => {
  /**
   * IJkpunt: een echte loonstrook met een heffingsloon van €5.315,53 per maand
   * en €1.484,08 aan loonbelasting/premie volksverzekeringen. De witte tabel
   * werkt met loonintervallen, dus een afwijking van enkele centen tot ongeveer
   * een euro hoort erbij.
   */
  it("benadert de loonstrook binnen een euro", () => {
    const result = monthlyPayrollTax(5_315.53, tax2026);
    expect(result.monthlyTax).toBeGreaterThan(1_483);
    expect(result.monthlyTax).toBeLessThan(1_486);
    expect(Math.abs(result.monthlyTax - 1_484.08)).toBeLessThan(1);
  });

  it("komt op een effectief tarief van ongeveer 28%", () => {
    const result = monthlyPayrollTax(5_315.53, tax2026);
    expect(result.effectiveRate).toBeGreaterThan(0.27);
    expect(result.effectiveRate).toBeLessThan(0.29);
  });

  it("houdt fors meer in zonder loonheffingskorting", () => {
    const met = monthlyPayrollTax(5_315.53, tax2026, true);
    const zonder = monthlyPayrollTax(5_315.53, tax2026, false);
    expect(zonder.monthlyTax).toBeGreaterThan(met.monthlyTax);
    // De twee kortingen samen schelen zo'n 450 euro per maand.
    expect(zonder.monthlyTax - met.monthlyTax).toBeCloseTo(
      (met.generalCredit + met.labourCredit) / 12,
      2,
    );
  });

  it("houdt minder in bij een lager loon door verlof", () => {
    const vol = monthlyPayrollTax(5_315.53, tax2026);
    const metVerlof = monthlyPayrollTax(4_200, tax2026);
    expect(metVerlof.monthlyTax).toBeLessThan(vol.monthlyTax);
    // Bij een lager loon is het effectieve tarief ook lager.
    expect(metVerlof.effectiveRate).toBeLessThan(vol.effectiveRate);
  });

  it("wordt nooit negatief bij een laag loon", () => {
    const result = monthlyPayrollTax(500, tax2026);
    expect(result.monthlyTax).toBeGreaterThanOrEqual(0);
  });

  it("geeft 0 zonder inkomen", () => {
    const result = monthlyPayrollTax(0, tax2026);
    expect(result.monthlyTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });
});
