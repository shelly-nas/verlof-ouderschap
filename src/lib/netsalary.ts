import type { ContractLike } from "./contracts";
import { monthlyPayrollTax, taxYearFor } from "./loonheffing";

/**
 * Netto maandloon volgens de opbouw van een Nederlandse loonstrook:
 *
 *   brutoloon
 *   − pensioenpremie, WGA Hiaat, WIA Excedent   (verlagen het heffingsloon)
 *   + bijtelling auto                            (verhoogt het heffingsloon)
 *   = heffingsloon
 *   − loonbelasting/premie volksverzekeringen
 *   = nettoloon
 *   + onkostenvergoeding                         (netto, geen heffing)
 *   = netto te ontvangen
 *
 * De bijtelling verhoogt wel het heffingsloon maar wordt niet uitbetaald; hij
 * wordt daarom na de belastingberekening weer van het nettoloon afgetrokken.
 */

export type PayslipInput = {
  /** Brutoloon in deze maand, inclusief een eventuele verlofkorting. */
  grossSalary: number;
  contract: PayslipContract;
  /** Jaar waarvan de belastingtabel geldt. */
  year: number;
  /**
   * Verhouding tussen het brutoloon deze maand en een volledige maand. Bij
   * onbetaald verlof lopen de premies naar rato mee terug.
   */
  salaryRatio?: number;
};

export type PayslipContract = Pick<ContractLike, "grossMonthlySalary"> & {
  pensionPercent: number | null;
  pensionBase: number | null;
  wgaPercent: number | null;
  wgaBase: number | null;
  wiaExcedent: number | null;
  grossExpenseAllowance: number | null;
  bijtellingPercent: number | null;
  bijtellingBase: number | null;
  netExpenseAllowance: number | null;
  applyTaxCredits: boolean;
};

export type PayslipLine = {
  label: string;
  /** Grondslag waarover gerekend is, als die er is. */
  base?: number;
  /** Percentage, als de post een percentage gebruikt. */
  percent?: number;
  /** Negatief = inhouding. */
  amount: number;
};

export type Payslip = {
  /** Brutoloon inclusief bruto kostentoeslag. */
  grossTotal: number;
  baseSalary: number;
  grossExpenseAllowance: number;
  deductions: PayslipLine[];
  /** Totaal aan inhoudingen die het heffingsloon verlagen (positief bedrag). */
  deductionTotal: number;
  bijtelling: number;
  /** Grondslag voor de loonheffing. */
  taxableIncome: number;
  payrollTax: number;
  effectiveTaxRate: number;
  netSalary: number;
  netExpenseAllowance: number;
  /** Wat er op de rekening komt. */
  netPayout: number;
};

/** Contract zonder loonstrookposten: dan blijft het bij een bruto-indicatie. */
export function hasPayslipData(contract: PayslipContract): boolean {
  return (
    contract.pensionPercent !== null ||
    contract.wgaPercent !== null ||
    contract.wiaExcedent !== null ||
    contract.bijtellingPercent !== null ||
    contract.grossExpenseAllowance !== null ||
    contract.netExpenseAllowance !== null
  );
}

export function calculatePayslip(input: PayslipInput): Payslip {
  const { contract, grossSalary, year } = input;
  const ratio =
    input.salaryRatio ??
    (contract.grossMonthlySalary > 0 ? grossSalary / contract.grossMonthlySalary : 1);

  // De bruto kostentoeslag is een vaste vergoeding en loopt mee met het
  // dienstverband, niet met het aantal gewerkte uren.
  const grossExpenseAllowance = contract.grossExpenseAllowance ?? 0;
  const grossTotal = grossSalary + grossExpenseAllowance;

  const deductions: PayslipLine[] = [];

  // Premies zijn gebaseerd op een grondslag uit het contract. Bij minder loon
  // door onbetaald verlof schaalt die grondslag evenredig mee.
  if (contract.pensionPercent !== null && contract.pensionBase !== null) {
    const base = contract.pensionBase * ratio;
    deductions.push({
      label: "Pensioenpremie",
      base,
      percent: contract.pensionPercent,
      amount: -(base * (contract.pensionPercent / 100)),
    });
  }

  if (contract.wgaPercent !== null && contract.wgaBase !== null) {
    const base = contract.wgaBase * ratio;
    deductions.push({
      label: "WGA Hiaat Plus",
      base,
      percent: contract.wgaPercent,
      amount: -(base * (contract.wgaPercent / 100)),
    });
  }

  if (contract.wiaExcedent !== null) {
    deductions.push({
      label: "WIA Excedent",
      amount: -(contract.wiaExcedent * ratio),
    });
  }

  const deductionTotal = deductions.reduce((sum, line) => sum + Math.abs(line.amount), 0);

  // De bijtelling is een fictief loonbestanddeel: hij verhoogt het heffingsloon
  // maar wordt niet uitbetaald.
  const bijtelling =
    contract.bijtellingPercent !== null && contract.bijtellingBase !== null
      ? (contract.bijtellingBase * (contract.bijtellingPercent / 100)) / 12
      : 0;

  const taxableIncome = Math.max(0, grossTotal - deductionTotal + bijtelling);

  const tax = monthlyPayrollTax(taxableIncome, taxYearFor(year), contract.applyTaxCredits);

  const netSalary = taxableIncome - tax.monthlyTax - bijtelling;
  const netExpenseAllowance = contract.netExpenseAllowance ?? 0;

  return {
    grossTotal,
    baseSalary: grossSalary,
    grossExpenseAllowance,
    deductions,
    deductionTotal,
    bijtelling,
    taxableIncome,
    payrollTax: tax.monthlyTax,
    effectiveTaxRate: tax.effectiveRate,
    netSalary,
    netExpenseAllowance,
    netPayout: netSalary + netExpenseAllowance,
  };
}

export type NetImpact = {
  /** Loonstrook zoals hij eruitziet zonder verlof. */
  normal: Payslip;
  /** Loonstrook met het verlof van deze maand verwerkt. */
  actual: Payslip;
  /** Verschil in netto te ontvangen loon; negatief = minder. */
  netDifference: number;
  grossDifference: number;
  taxDifference: number;
};

/**
 * Wat het verlof netto kost. Doordat een lager brutoloon ook minder
 * loonheffing betekent, valt het netto-verschil kleiner uit dan het
 * bruto-verschil — dat is precies wat dit zichtbaar maakt.
 */
export function netImpact(params: {
  contract: PayslipContract;
  /** Brutoloon in deze maand na verrekening van het verlof. */
  actualGross: number;
  year: number;
}): NetImpact {
  const normal = calculatePayslip({
    contract: params.contract,
    grossSalary: params.contract.grossMonthlySalary,
    year: params.year,
    salaryRatio: 1,
  });

  const actual = calculatePayslip({
    contract: params.contract,
    grossSalary: params.actualGross,
    year: params.year,
  });

  return {
    normal,
    actual,
    netDifference: actual.netPayout - normal.netPayout,
    grossDifference: actual.grossTotal - normal.grossTotal,
    taxDifference: actual.payrollTax - normal.payrollTax,
  };
}
