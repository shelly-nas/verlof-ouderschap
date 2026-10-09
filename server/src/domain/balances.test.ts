import { describe, expect, it } from "../test/expect";
import { type LeaveEntryLike, balanceKey, balanceMap, balancesFor } from "./balances";
import type { ContractLike } from "./contracts";
import type { ChildLike, LeaveTypeLike } from "./entitlements";

const contract: ContractLike = {
  id: "a",
  employerName: "Werkgever A",
  employerEmail: "a@example.com",
  hoursPerWeek: 40,
  grossMonthlySalary: 4000,
  startDate: "2025-01-01",
  endDate: null,
};

const child: ChildLike = { id: "c1", name: "Test", dateOfBirth: "2026-02-01" };

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

const leaveTypes = [geboorteverlof, betaaldOv, onbetaaldOv];

function entry(
  date: string,
  hours: number,
  leaveTypeId: string,
  id = `${date}-${leaveTypeId}`,
): LeaveEntryLike {
  return { id, date, hours, childId: child.id, leaveTypeId };
}

function run(entries: LeaveEntryLike[], today: string) {
  return balanceMap(
    balancesFor({
      children: [child],
      leaveTypes,
      contracts: [contract],
      supplements: [],
      entries,
      today,
    }),
  );
}

describe("balancesFor", () => {
  it("berekent het recht per verlofsoort", () => {
    const map = run([], "2026-02-15");
    expect(map.get(balanceKey("c1", "lt-geboorte"))?.entitledHours).toBe(40);
    expect(map.get(balanceKey("c1", "lt-betaald"))?.entitledHours).toBe(360);
    expect(map.get(balanceKey("c1", "lt-onbetaald"))?.entitledHours).toBe(680);
  });

  it("trekt opgenomen uren af", () => {
    const map = run(
      [entry("2026-02-02", 8, "lt-geboorte"), entry("2026-02-03", 8, "lt-geboorte")],
      "2026-02-15",
    );
    const saldo = map.get(balanceKey("c1", "lt-geboorte"))!;
    expect(saldo.usedHours).toBe(16);
    expect(saldo.remainingHours).toBe(24);
    expect(saldo.deadlineStatus).toBe("SOON");
  });

  it("markeert een volledig opgenomen recht als DONE", () => {
    const entries = ["2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06"].map(
      (date) => entry(date, 8, "lt-geboorte"),
    );
    const map = run(entries, "2026-02-15");
    const saldo = map.get(balanceKey("c1", "lt-geboorte"))!;
    expect(saldo.remainingHours).toBe(0);
    expect(saldo.deadlineStatus).toBe("DONE");
  });

  it("waarschuwt bij een naderende deadline en meldt een verstreken deadline", () => {
    // Deadline geboorteverlof is 2026-03-01.
    expect(run([], "2026-02-25").get(balanceKey("c1", "lt-geboorte"))?.deadlineStatus).toBe(
      "SOON",
    );
    expect(run([], "2026-03-02").get(balanceKey("c1", "lt-geboorte"))?.deadlineStatus).toBe(
      "EXPIRED",
    );
    // Onbetaald OV loopt tot 2034; nog ruim de tijd.
    expect(run([], "2026-02-25").get(balanceKey("c1", "lt-onbetaald"))?.deadlineStatus).toBe(
      "OK",
    );
  });

  it("schuift het restant van betaald OV door naar onbetaald na de eerste verjaardag", () => {
    // Deadline betaald OV is 2027-01-31; 80 van de 360 uur opgenomen.
    const entries = [entry("2026-06-01", 40, "lt-betaald"), entry("2026-06-08", 40, "lt-betaald")];

    const voor = run(entries, "2027-01-31");
    expect(voor.get(balanceKey("c1", "lt-betaald"))?.remainingHours).toBe(280);
    expect(voor.get(balanceKey("c1", "lt-onbetaald"))?.entitledHours).toBe(680);

    const na = run(entries, "2027-02-01");
    const betaald = na.get(balanceKey("c1", "lt-betaald"))!;
    const onbetaald = na.get(balanceKey("c1", "lt-onbetaald"))!;
    expect(betaald.carriedOutHours).toBe(280);
    expect(betaald.remainingHours).toBe(0);
    expect(onbetaald.carriedInHours).toBe(280);
    expect(onbetaald.entitledHours).toBe(960); // 680 + 280
    // Het totale recht van 26 weken blijft intact.
    expect(betaald.usedHours + onbetaald.entitledHours).toBe(1040);
  });

  it("schuift niets door als het betaalde recht volledig is opgenomen", () => {
    const entries = [entry("2026-06-01", 360, "lt-betaald")];
    const na = run(entries, "2027-02-01");
    expect(na.get(balanceKey("c1", "lt-betaald"))?.carriedOutHours).toBe(0);
    expect(na.get(balanceKey("c1", "lt-onbetaald"))?.entitledHours).toBe(680);
  });

  it("markeert uren die na de deadline zijn geboekt", () => {
    const map = run([entry("2026-04-01", 8, "lt-geboorte")], "2026-05-01");
    expect(map.get(balanceKey("c1", "lt-geboorte"))?.usedAfterDeadlineHours).toBe(8);
  });

  it("houdt deeldagen van een 32-urig contract exact", () => {
    // Bij 32 uur per week is een werkdag 6,4 uur; die tellen niet exact op in
    // drijvende komma. Vijf dagen moet precies het weekrecht opmaken.
    const parttime: ContractLike = { ...contract, hoursPerWeek: 32 };
    const entries = ["2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06"].map(
      (date) => entry(date, 6.4, "lt-geboorte"),
    );
    const map = balanceMap(
      balancesFor({
        children: [child],
        leaveTypes,
        contracts: [parttime],
        supplements: [],
        entries,
        today: "2026-02-15",
      }),
    );
    const saldo = map.get(balanceKey("c1", "lt-geboorte"))!;
    expect(saldo.usedHours).toBe(32);
    expect(saldo.remainingHours).toBe(0);
    expect(saldo.overBookedHours).toBe(0);
    expect(saldo.deadlineStatus).toBe("DONE");
  });

  it("meldt overschrijding van het recht", () => {
    const map = run([entry("2026-02-02", 48, "lt-geboorte")], "2026-02-15");
    const saldo = map.get(balanceKey("c1", "lt-geboorte"))!;
    expect(saldo.overBookedHours).toBe(8);
    expect(saldo.remainingHours).toBe(-8);
  });
});
