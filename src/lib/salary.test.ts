import { describe, expect, it } from "vitest";
import type { LeaveEntryLike } from "./balances";
import type { ContractLike } from "./contracts";
import type { LeaveTypeLike, SupplementLike } from "./entitlements";
import { monthImpact, normalGrossForMonth } from "./salary";

const contractA: ContractLike = {
  id: "a",
  employerName: "Werkgever A",
  employerEmail: "a@example.com",
  hoursPerWeek: 40,
  grossMonthlySalary: 4000,
  startDate: "2025-01-01",
  endDate: "2026-03-31",
};

const contractB: ContractLike = {
  id: "b",
  employerName: "Werkgever B",
  employerEmail: "b@example.com",
  hoursPerWeek: 32,
  grossMonthlySalary: 3400,
  startDate: "2026-04-01",
  endDate: null,
};

const betaaldOv: LeaveTypeLike = {
  id: "lt-betaald",
  code: "BETAALD_OUDERSCHAPSVERLOF",
  name: "Betaald ouderschapsverlof",
  weeksMultiplier: 9,
  payer: "UWV",
  payPercent: 70,
  deadlineAnchor: "YEARS_AFTER_BIRTH",
  deadlineValue: 1,
  fallbackLeaveTypeId: null,
  colorHex: null,
  sortOrder: 30,
};

const geboorteverlof: LeaveTypeLike = {
  id: "lt-geboorte",
  code: "GEBOORTEVERLOF",
  name: "Geboorteverlof",
  weeksMultiplier: 1,
  payer: "EMPLOYER",
  payPercent: 100,
  deadlineAnchor: "WEEKS_AFTER_BIRTH",
  deadlineValue: 4,
  fallbackLeaveTypeId: null,
  colorHex: null,
  sortOrder: 10,
};

const onbetaaldOv: LeaveTypeLike = {
  id: "lt-onbetaald",
  code: "ONBETAALD_OUDERSCHAPSVERLOF",
  name: "Onbetaald ouderschapsverlof",
  weeksMultiplier: 17,
  payer: "UNPAID",
  payPercent: null,
  deadlineAnchor: "YEARS_AFTER_BIRTH",
  deadlineValue: 8,
  fallbackLeaveTypeId: null,
  colorHex: null,
  sortOrder: 40,
};

const leaveTypes = [geboorteverlof, betaaldOv, onbetaaldOv];

function entry(date: string, hours: number, leaveTypeId: string): LeaveEntryLike {
  return { id: `${date}-${leaveTypeId}`, date, hours, childId: "c1", leaveTypeId };
}

function impact(
  month: string,
  entries: LeaveEntryLike[],
  contracts: ContractLike[] = [contractA, contractB],
  supplements: SupplementLike[] = [],
) {
  return monthImpact({ month, entries, contracts, leaveTypes, supplements });
}

describe("normalGrossForMonth", () => {
  it("geeft het volledige maandsalaris bij één contract", () => {
    expect(normalGrossForMonth("2026-02", [contractA])).toBeCloseTo(4000, 6);
  });

  it("rekent bij een contractwissel naar rato van kalenderdagen", () => {
    // Maart: 31 dagen contract A. April: 30 dagen contract B.
    expect(normalGrossForMonth("2026-03", [contractA, contractB])).toBeCloseTo(4000, 6);
    expect(normalGrossForMonth("2026-04", [contractA, contractB])).toBeCloseTo(3400, 6);
  });

  it("geeft 0 zonder contract", () => {
    expect(normalGrossForMonth("2020-01", [contractA])).toBe(0);
  });
});

describe("monthImpact", () => {
  it("laat geen inkomensverlies zien bij volledig doorbetaald geboorteverlof", () => {
    const result = impact("2026-02", [entry("2026-02-02", 8, "lt-geboorte")]);
    expect(result.employerPaid).toBeGreaterThan(0);
    expect(result.uwvBenefit).toBe(0);
    expect(result.difference).toBeCloseTo(0, 6);
  });

  it("laat 30% verlies zien bij UWV-verlof", () => {
    const result = impact("2026-02", [entry("2026-02-02", 8, "lt-betaald")]);
    const dagloon = 4000 / 21.75;
    expect(result.uwvBenefit).toBeCloseTo(0.7 * dagloon, 6);
    expect(result.difference).toBeCloseTo(-0.3 * dagloon, 6);
  });

  it("laat het volle dagloon als verlies zien bij onbetaald verlof", () => {
    const result = impact("2026-02", [entry("2026-02-02", 8, "lt-onbetaald")]);
    const dagloon = 4000 / 21.75;
    expect(result.totalReceived).toBeCloseTo(4000 - dagloon, 6);
    expect(result.difference).toBeCloseTo(-dagloon, 6);
  });

  it("gebruikt per verlofdag het contract dat op die dag gold", () => {
    // Week van 30 maart 2026 kruist de contractwissel op 1 april.
    const entries = [
      entry("2026-03-30", 8, "lt-betaald"),
      entry("2026-03-31", 8, "lt-betaald"),
    ];
    const maart = impact("2026-03", entries);
    // Twee volle dagen bij contract A: 8 uur is een hele dag bij 40 uur/week.
    expect(maart.leaveDayEquivalents).toBeCloseTo(2, 6);
    expect(maart.uwvBenefit).toBeCloseTo(2 * 0.7 * (4000 / 21.75), 6);

    // Dezelfde uren in april vallen onder contract B: 8 uur is daar 1,25 dag.
    const april = impact("2026-04", [
      entry("2026-04-02", 8, "lt-betaald"),
      entry("2026-04-03", 8, "lt-betaald"),
    ]);
    expect(april.leaveDayEquivalents).toBeCloseTo(2.5, 6);
    expect(april.uwvBenefit).toBeCloseTo(2.5 * 0.7 * (3400 / 21.75), 6);
  });

  it("keert ook bij een hoog salaris 70% van het eigen dagloon uit", () => {
    const rijk: ContractLike = { ...contractA, grossMonthlySalary: 8000, endDate: null };
    const result = impact("2026-02", [entry("2026-02-02", 8, "lt-betaald")], [rijk]);
    expect(result.uwvBenefit).toBeCloseTo(0.7 * (8000 / 21.75), 6);
    expect(result.difference).toBeCloseTo(-0.3 * (8000 / 21.75), 6);
  });

  it("heft het verlies op met een werkgeversaanvulling tot 100%", () => {
    const rijk: ContractLike = { ...contractA, grossMonthlySalary: 8000, endDate: null };
    const supplements: SupplementLike[] = [
      {
        contractId: "a",
        leaveTypeId: betaaldOv.id,
        topUpToPercent: 100,
        extraWeeks: null,
        deadlineOverrideMonths: null,
      },
    ];
    const result = impact("2026-02", [entry("2026-02-02", 8, "lt-betaald")], [rijk], supplements);
    expect(result.employerTopUp).toBeGreaterThan(0);
    expect(result.difference).toBeCloseTo(0, 6);
  });

  it("negeert verlofdagen buiten de gevraagde maand", () => {
    const result = impact("2026-02", [
      entry("2026-01-30", 8, "lt-betaald"),
      entry("2026-02-02", 8, "lt-betaald"),
      entry("2026-03-02", 8, "lt-betaald"),
    ]);
    expect(result.leaveHours).toBe(8);
  });

  it("rekent netto door zodra het contract loonstrookgegevens heeft", () => {
    const metLoonstrook = {
      ...contractA,
      endDate: null,
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

    const zonderVerlof = impact("2026-02", [], [metLoonstrook]);
    expect(zonderVerlof.net).not.toBeNull();
    // Heffingsloon en netto van de echte loonstrook.
    expect(zonderVerlof.net!.normal.taxableIncome).toBeCloseTo(5_315.53, 2);
    expect(Math.abs(zonderVerlof.net!.normal.netPayout - (3_432.8 + 65))).toBeLessThan(1);
    expect(zonderVerlof.net!.netDifference).toBeCloseTo(0, 6);

    // Een maand met onbetaald verlof levert netto minder op, maar minder dan bruto.
    const metVerlof = impact(
      "2026-02",
      [entry("2026-02-02", 8, "lt-onbetaald"), entry("2026-02-03", 8, "lt-onbetaald")],
      [metLoonstrook],
    );
    expect(metVerlof.net!.netDifference).toBeLessThan(0);
    expect(Math.abs(metVerlof.net!.netDifference)).toBeLessThan(
      Math.abs(metVerlof.difference),
    );
  });

  it("laat netto weg zonder loonstrookgegevens", () => {
    const result = impact("2026-02", [entry("2026-02-02", 8, "lt-betaald")]);
    expect(result.net).toBeNull();
  });

  it("telt verlofdagen zonder geldig contract apart", () => {
    const result = impact("2024-02", [entry("2024-02-01", 8, "lt-betaald")]);
    expect(result.entriesWithoutContract).toBe(1);
    expect(result.uwvBenefit).toBe(0);
  });
});
