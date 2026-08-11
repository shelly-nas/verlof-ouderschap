/**
 * Loonbelasting en premie volksverzekeringen volgens de witte tabel voor loon
 * uit tegenwoordige dienstbetrekking.
 *
 * De methode van de witte tabel: maandloon × 12 geeft een jaarloon, daarover
 * het schijventarief, dan de heffingskortingen als jaarbedrag eraf, en het
 * resultaat gedeeld door 12. De kortingen worden dus niet per maand berekend
 * maar evenredig over het jaar verdeeld.
 *
 * De officiële tabellen werken met loonintervallen en afgeronde tabelbedragen;
 * deze formulebenadering wijkt daardoor tot ongeveer een euro per maand af van
 * een echte loonstrook. Voldoende voor een indicatie, niet voor de aangifte.
 */

export type TaxBracket = {
  /** Bovengrens van deze schijf in jaarloon; null = hoogste schijf. */
  upTo: number | null;
  /** Gecombineerd tarief loonbelasting + premie volksverzekeringen. */
  rate: number;
};

export type TaxYear = {
  year: number;
  brackets: TaxBracket[];
  /** Algemene heffingskorting. */
  generalCredit: {
    max: number;
    /** Vanaf dit jaarloon bouwt de korting af. */
    phaseOutFrom: number;
    phaseOutRate: number;
    phaseOutUntil: number;
  };
  /** Arbeidskorting: oplopende opbouwtrajecten, daarna afbouw. */
  labourCredit: {
    /** Elk traject loopt t/m `upTo` en bouwt op met `rate` over het deel erin. */
    buildUp: { upTo: number; rate: number }[];
    max: number;
    phaseOutFrom: number;
    phaseOutRate: number;
  };
};

/**
 * Peiljaren. De cijfers komen uit de cijferbijlage bij de Nieuwsbrief
 * Loonheffingen van de Belastingdienst; voeg een nieuw jaar toe zodra dat
 * gepubliceerd is.
 */
export const TAX_YEARS: TaxYear[] = [
  {
    year: 2026,
    brackets: [
      { upTo: 38_883, rate: 0.3575 },
      { upTo: 78_426, rate: 0.3756 },
      { upTo: null, rate: 0.495 },
    ],
    generalCredit: {
      max: 3_115,
      phaseOutFrom: 29_736,
      phaseOutRate: 0.06398,
      phaseOutUntil: 78_426,
    },
    labourCredit: {
      buildUp: [
        { upTo: 11_965, rate: 0.08324 },
        { upTo: 25_845, rate: 0.31009 },
        { upTo: 45_592, rate: 0.0195 },
      ],
      max: 5_685,
      phaseOutFrom: 45_592,
      phaseOutRate: 0.0651,
    },
  },
];

/** Het peiljaar dat bij een datum hoort; valt terug op het laatst bekende jaar. */
export function taxYearFor(year: number): TaxYear {
  const exact = TAX_YEARS.find((entry) => entry.year === year);
  if (exact) return exact;
  return [...TAX_YEARS].sort((a, b) => b.year - a.year)[0];
}

/** Bruto loonbelasting + premie volksverzekeringen over een jaarloon. */
export function grossAnnualTax(annualIncome: number, taxYear: TaxYear): number {
  if (annualIncome <= 0) return 0;

  let tax = 0;
  let previousLimit = 0;

  for (const bracket of taxYear.brackets) {
    const limit = bracket.upTo ?? Number.POSITIVE_INFINITY;
    const taxableInBracket = Math.min(annualIncome, limit) - previousLimit;
    if (taxableInBracket <= 0) break;
    tax += taxableInBracket * bracket.rate;
    previousLimit = limit;
  }

  return tax;
}

/** Algemene heffingskorting bij een jaarloon. */
export function generalTaxCredit(annualIncome: number, taxYear: TaxYear): number {
  const { max, phaseOutFrom, phaseOutRate, phaseOutUntil } = taxYear.generalCredit;
  if (annualIncome <= phaseOutFrom) return max;
  if (annualIncome >= phaseOutUntil) return 0;
  return Math.max(0, max - (annualIncome - phaseOutFrom) * phaseOutRate);
}

/** Arbeidskorting bij een jaarloon. */
export function labourTaxCredit(annualIncome: number, taxYear: TaxYear): number {
  const { buildUp, max, phaseOutFrom, phaseOutRate } = taxYear.labourCredit;
  if (annualIncome <= 0) return 0;

  if (annualIncome > phaseOutFrom) {
    return Math.max(0, max - (annualIncome - phaseOutFrom) * phaseOutRate);
  }

  let credit = 0;
  let previousLimit = 0;
  for (const step of buildUp) {
    const incomeInStep = Math.min(annualIncome, step.upTo) - previousLimit;
    if (incomeInStep <= 0) break;
    credit += incomeInStep * step.rate;
    previousLimit = step.upTo;
  }
  return Math.min(credit, max);
}

export type TaxBreakdown = {
  annualIncome: number;
  grossTax: number;
  generalCredit: number;
  labourCredit: number;
  /** Jaarheffing na aftrek van de kortingen, nooit negatief. */
  netAnnualTax: number;
  /** Inhouding voor deze maand. */
  monthlyTax: number;
  effectiveRate: number;
};

/**
 * Loonheffing over een maandelijks heffingsloon.
 *
 * `applyCredits` weerspiegelt of de loonheffingskorting is aangevinkt bij deze
 * werkgever; dat scheelt een paar honderd euro per maand.
 */
export function monthlyPayrollTax(
  monthlyTaxableIncome: number,
  taxYear: TaxYear,
  applyCredits = true,
): TaxBreakdown {
  const annualIncome = monthlyTaxableIncome * 12;
  const grossTax = grossAnnualTax(annualIncome, taxYear);

  const general = applyCredits ? generalTaxCredit(annualIncome, taxYear) : 0;
  const labour = applyCredits ? labourTaxCredit(annualIncome, taxYear) : 0;

  const netAnnualTax = Math.max(0, grossTax - general - labour);

  return {
    annualIncome,
    grossTax,
    generalCredit: general,
    labourCredit: labour,
    netAnnualTax,
    monthlyTax: netAnnualTax / 12,
    effectiveRate: monthlyTaxableIncome > 0 ? netAnnualTax / 12 / monthlyTaxableIncome : 0,
  };
}
