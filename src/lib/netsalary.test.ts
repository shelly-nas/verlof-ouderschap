import { describe, expect, it } from "vitest";
import { type PayslipContract, calculatePayslip, hasPayslipData, netImpact } from "./netsalary";

/**
 * De posten van een echte loonstrook:
 *
 *   Salaris                                        5.150,00
 *   Pensioenpremie          7,5%    3.964,33         -297,32
 *   WGA Hiaat Plus         0,144%   5.562,00           -8,01
 *   Bruto kostentoeslag                                80,00
 *   Bijtelling               12%   39.865,00          398,65
 *   WIA Excedent                                       -7,79
 *   Heffingsloon                                    5.315,53
 *   Loonbelasting/premie vv        5.315,53        -1.484,08
 *   Nettoloon                                       3.432,80
 *   Onkostenvergoeding                                 65,00
 */
const contract: PayslipContract = {
  grossMonthlySalary: 5_150,
  pensionPercent: 7.5,
  pensionBase: 3_964.33,
  wgaPercent: 0.144,
  wgaBase: 5_562,
  wiaExcedent: 7.79,
  grossExpenseAllowance: 80,
  bijtellingPercent: 12,
  bijtellingBase: 39_865,
  netExpenseAllowance: 65,
  applyTaxCredits: true,
};

describe("loonstrook nabouwen", () => {
  const payslip = calculatePayslip({
    contract,
    grossSalary: 5_150,
    year: 2026,
    salaryRatio: 1,
  });

  it("berekent de pensioenpremie", () => {
    const pension = payslip.deductions.find((line) => line.label === "Pensioenpremie")!;
    expect(pension.amount).toBeCloseTo(-297.32, 2);
  });

  it("berekent de WGA Hiaat Plus", () => {
    const wga = payslip.deductions.find((line) => line.label === "WGA Hiaat Plus")!;
    expect(wga.amount).toBeCloseTo(-8.01, 2);
  });

  it("neemt het WIA Excedent over", () => {
    const wia = payslip.deductions.find((line) => line.label === "WIA Excedent")!;
    expect(wia.amount).toBeCloseTo(-7.79, 2);
  });

  it("berekent de bijtelling per maand", () => {
    expect(payslip.bijtelling).toBeCloseTo(398.65, 2);
  });

  it("komt uit op het heffingsloon van de strook", () => {
    // 5.150 + 80 − 297,32 − 8,01 − 7,79 + 398,65 = 5.315,53
    expect(payslip.taxableIncome).toBeCloseTo(5_315.53, 2);
  });

  it("benadert de loonheffing van de strook", () => {
    expect(Math.abs(payslip.payrollTax - 1_484.08)).toBeLessThan(1);
  });

  it("benadert het nettoloon van de strook", () => {
    expect(Math.abs(payslip.netSalary - 3_432.80)).toBeLessThan(1);
  });

  it("telt de onkostenvergoeding netto op bij de uitbetaling", () => {
    expect(payslip.netPayout).toBeCloseTo(payslip.netSalary + 65, 2);
    expect(Math.abs(payslip.netPayout - (3_432.8 + 65))).toBeLessThan(1);
  });
});

describe("verlof en netto-effect", () => {
  it("levert minder netto op bij onbetaald verlof, maar minder dan bruto scheelt", () => {
    // Een maand met 400 euro minder brutoloon.
    const impact = netImpact({ contract, actualGross: 4_750, year: 2026 });

    expect(impact.grossDifference).toBeCloseTo(-400, 2);
    expect(impact.netDifference).toBeLessThan(0);
    // Minder loon betekent ook minder belasting, dus netto scheelt het minder.
    expect(Math.abs(impact.netDifference)).toBeLessThan(Math.abs(impact.grossDifference));
    expect(impact.taxDifference).toBeLessThan(0);
  });

  it("laat de premies meelopen met een lager brutoloon", () => {
    const vol = calculatePayslip({ contract, grossSalary: 5_150, year: 2026, salaryRatio: 1 });
    const half = calculatePayslip({ contract, grossSalary: 2_575, year: 2026 });

    const volPensioen = vol.deductions.find((l) => l.label === "Pensioenpremie")!.amount;
    const halfPensioen = half.deductions.find((l) => l.label === "Pensioenpremie")!.amount;
    expect(halfPensioen).toBeCloseTo(volPensioen / 2, 2);
  });

  it("geeft geen verschil bij een volledige maand", () => {
    const impact = netImpact({ contract, actualGross: 5_150, year: 2026 });
    expect(impact.netDifference).toBeCloseTo(0, 6);
  });

  it("rekent ook zonder loonstrookgegevens, dan alleen bruto en belasting", () => {
    const kaal: PayslipContract = {
      grossMonthlySalary: 4_000,
      pensionPercent: null,
      pensionBase: null,
      wgaPercent: null,
      wgaBase: null,
      wiaExcedent: null,
      grossExpenseAllowance: null,
      bijtellingPercent: null,
      bijtellingBase: null,
      netExpenseAllowance: null,
      applyTaxCredits: true,
    };
    expect(hasPayslipData(kaal)).toBe(false);

    const payslip = calculatePayslip({ contract: kaal, grossSalary: 4_000, year: 2026 });
    expect(payslip.taxableIncome).toBe(4_000);
    expect(payslip.deductions).toHaveLength(0);
    expect(payslip.netSalary).toBeCloseTo(4_000 - payslip.payrollTax, 6);
  });

  it("herkent een contract met loonstrookgegevens", () => {
    expect(hasPayslipData(contract)).toBe(true);
  });

  it("houdt meer in zonder loonheffingskorting", () => {
    const zonder = calculatePayslip({
      contract: { ...contract, applyTaxCredits: false },
      grossSalary: 5_150,
      year: 2026,
      salaryRatio: 1,
    });
    const met = calculatePayslip({ contract, grossSalary: 5_150, year: 2026, salaryRatio: 1 });
    expect(zonder.payrollTax).toBeGreaterThan(met.payrollTax);
    expect(zonder.netSalary).toBeLessThan(met.netSalary);
  });
});
