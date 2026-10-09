import { describe, expect, it } from "../test/expect";
import type { ContractLike } from "./contracts";
import { contractForDate, findContractOverlaps, hoursPerWorkday } from "./contracts";
import {
  type ChildLike,
  type LeaveTypeLike,
  type SupplementLike,
  deadlineFor,
  entitlementFor,
} from "./entitlements";

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

const contracts = [contractA, contractB];

const child: ChildLike = { id: "c1", name: "Test", dateOfBirth: "2026-02-01" };

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

const betaaldOv: LeaveTypeLike = {
  id: "lt-betaald",
  code: "BETAALD_OUDERSCHAPSVERLOF",
  name: "Betaald ouderschapsverlof",
  weeksMultiplier: 9,
  payer: "UWV",
  payPercent: 70,
  deadlineAnchor: "YEARS_AFTER_BIRTH",
  deadlineValue: 1,
  fallbackLeaveTypeId: "lt-onbetaald",
  colorHex: null,
  sortOrder: 30,
};

describe("contractForDate", () => {
  it("kiest het contract dat op die dag gold", () => {
    expect(contractForDate(contracts, "2026-03-31")?.id).toBe("a");
    expect(contractForDate(contracts, "2026-04-01")?.id).toBe("b");
  });

  it("geeft null buiten elke contractperiode", () => {
    expect(contractForDate(contracts, "2024-12-31")).toBeNull();
  });

  it("kiest bij overlap het nieuwste dienstverband", () => {
    const overlapping = [
      contractA,
      { ...contractB, startDate: "2026-01-01", id: "b2" },
    ];
    expect(contractForDate(overlapping, "2026-02-01")?.id).toBe("b2");
  });

  it("signaleert overlappende periodes", () => {
    expect(findContractOverlaps(contracts)).toHaveLength(0);
    const overlapping = [contractA, { ...contractB, startDate: "2026-01-01" }];
    expect(findContractOverlaps(overlapping)).toHaveLength(1);
  });

  it("rekent uren per werkdag met een vijfdaagse week", () => {
    expect(hoursPerWorkday(contractA)).toBe(8);
    expect(hoursPerWorkday(contractB)).toBe(6.4);
  });
});

describe("deadlineFor", () => {
  it("rekent 4 weken na de geboorte t/m dag 28", () => {
    expect(deadlineFor("2026-02-01", "WEEKS_AFTER_BIRTH", 4)).toBe("2026-03-01");
  });

  it("rekent 6 maanden na de geboorte", () => {
    expect(deadlineFor("2026-02-01", "MONTHS_AFTER_BIRTH", 6)).toBe("2026-08-01");
  });

  it("laat 'vóór de eerste verjaardag' eindigen op de dag ervóór", () => {
    expect(deadlineFor("2026-02-01", "YEARS_AFTER_BIRTH", 1)).toBe("2027-01-31");
    expect(deadlineFor("2026-02-01", "YEARS_AFTER_BIRTH", 8)).toBe("2034-01-31");
  });

  it("respecteert een ruimere termijn van de werkgever", () => {
    expect(deadlineFor("2026-02-01", "MONTHS_AFTER_BIRTH", 6, 12)).toBe("2027-01-31");
  });

  it("geeft null zonder anker", () => {
    expect(deadlineFor("2026-02-01", "NONE", null)).toBeNull();
  });
});

describe("entitlementFor", () => {
  it("rekent het recht met de uren van het contract op de geboortedatum", () => {
    const result = entitlementFor(child, betaaldOv, contracts, []);
    expect(result.referenceContract?.id).toBe("a");
    expect(result.hoursPerWeek).toBe(40);
    expect(result.totalHours).toBe(360); // 9 weken x 40 uur
    expect(result.deadline).toBe("2027-01-31");
  });

  it("verandert het recht niet door een latere contractwissel", () => {
    const laterChild: ChildLike = { ...child, dateOfBirth: "2026-05-01" };
    const result = entitlementFor(laterChild, betaaldOv, contracts, []);
    expect(result.referenceContract?.id).toBe("b");
    expect(result.totalHours).toBe(288); // 9 weken x 32 uur
  });

  it("telt bovenwettelijke extra weken mee", () => {
    const supplements: SupplementLike[] = [
      {
        contractId: "a",
        leaveTypeId: betaaldOv.id,
        topUpToPercent: 100,
        extraWeeks: 2,
        deadlineOverrideMonths: null,
      },
    ];
    const result = entitlementFor(child, betaaldOv, contracts, supplements);
    expect(result.weeks).toBe(11);
    expect(result.totalHours).toBe(440);
    expect(result.topUpToPercent).toBe(100);
  });

  it("negeert een supplement van een ander contract", () => {
    const supplements: SupplementLike[] = [
      {
        contractId: "b",
        leaveTypeId: betaaldOv.id,
        topUpToPercent: 100,
        extraWeeks: 2,
        deadlineOverrideMonths: null,
      },
    ];
    const result = entitlementFor(child, betaaldOv, contracts, supplements);
    expect(result.weeks).toBe(9);
    expect(result.topUpToPercent).toBeNull();
  });

  it("valt terug op het nieuwste contract als er bij de geboorte geen contract was", () => {
    const earlyChild: ChildLike = { ...child, dateOfBirth: "2020-01-01" };
    const result = entitlementFor(earlyChild, geboorteverlof, contracts, []);
    expect(result.referenceContract?.id).toBe("b");
    expect(result.totalHours).toBe(32);
  });
});
