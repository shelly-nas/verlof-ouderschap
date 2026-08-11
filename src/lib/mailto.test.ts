import { describe, expect, it } from "vitest";
import type { LeaveEntryLike } from "./balances";
import type { ChildLike, LeaveTypeLike } from "./entitlements";
import {
  MAILTO_MAX_LENGTH,
  buildLeaveEmail,
  daysUntilDeadline,
  reportingMonthFor,
} from "./mailto";

const child: ChildLike = { id: "c1", name: "Test", dateOfBirth: "2026-02-01" };

const betaaldOv: LeaveTypeLike = {
  id: "lt-betaald",
  code: "BETAALD_OUDERSCHAPSVERLOF",
  name: "Betaald ouderschapsverlof",
  weeksMultiplier: 9,
  payer: "UWV",
  payPercent: 70,
  cappedAtMaxDagloon: true,
  deadlineAnchor: "YEARS_AFTER_BIRTH",
  deadlineValue: 1,
  fallbackLeaveTypeId: null,
  colorHex: null,
  sortOrder: 30,
};

function entry(date: string, hours: number): LeaveEntryLike {
  return { id: date, date, hours, childId: "c1", leaveTypeId: "lt-betaald" };
}

function build(entries: LeaveEntryLike[], children: ChildLike[] = [child]) {
  return buildLeaveEmail({
    employerName: "Werkgever A",
    employerEmail: "hr@example.com",
    entries,
    children,
    leaveTypes: [betaaldOv],
    monthStart: "2026-03-01",
    senderName: "Jelle",
  });
}

describe("buildLeaveEmail", () => {
  it("zet alle dagen van de maand op een rij met datum en uren", () => {
    const result = build([entry("2026-03-03", 8), entry("2026-03-05", 4)]);
    expect(result.subject).toBe("Opname verlof maart 2026");
    expect(result.to).toBe("hr@example.com");
    expect(result.body).toContain("8 uur");
    expect(result.body).toContain("4 uur");
    expect(result.body).toContain("Totaal: 12 uur.");
    expect(result.totalHours).toBe(12);
    // Geen weekkopjes meer: de maand is de eenheid.
    expect(result.body).not.toContain("Week ");
  });

  it("zet de dagen chronologisch, ook over weken heen", () => {
    const result = build([entry("2026-03-10", 8), entry("2026-03-03", 8)]);
    const eersteIndex = result.body.indexOf("3 mrt");
    const tweedeIndex = result.body.indexOf("10 mrt");
    expect(eersteIndex).toBeGreaterThan(-1);
    expect(tweedeIndex).toBeGreaterThan(eersteIndex);
  });

  it("noemt het kind alleen als er meerdere kinderen zijn", () => {
    const single = build([entry("2026-03-03", 8)]);
    expect(single.body).not.toContain("(Test)");

    const multiple = build([entry("2026-03-03", 8)], [
      child,
      { id: "c2", name: "Tweede", dateOfBirth: "2028-01-01" },
    ]);
    expect(multiple.body).toContain("(Test)");
  });

  it("meldt netjes als er geen verlof is", () => {
    const result = build([]);
    expect(result.body).toContain("geen verlof");
    expect(result.entryCount).toBe(0);
  });

  it("negeert dagen buiten de maand", () => {
    const result = build([entry("2026-02-27", 8), entry("2026-03-03", 8)]);
    expect(result.entryCount).toBe(1);
  });

  it("codeert regelovergangen als CRLF zodat elke mailclient ze toont", () => {
    const result = build([entry("2026-03-03", 8)]);
    expect(result.body).toContain("\r\n");
    expect(result.href).toContain("%0D%0A");
    expect(result.href).not.toMatch(/[^D]%0A/);
  });

  it("codeert het e-mailadres en speciale tekens", () => {
    const result = buildLeaveEmail({
      employerName: "Zorg & Welzijn",
      employerEmail: "hr+verlof@example.com",
      entries: [entry("2026-03-03", 8)],
      children: [child],
      leaveTypes: [betaaldOv],
      monthStart: "2026-03-01",
      senderName: null,
    });
    expect(result.href).toContain("hr%2Bverlof%40example.com");
    expect(result.href).toContain("Zorg%20%26%20Welzijn");
  });

  it("markeert een te lange link zodat de UI een kopieer-knop toont", () => {
    const short = build([entry("2026-03-03", 8)]);
    expect(short.tooLong).toBe(false);

    // Een volledige maand verlof levert een link op die mailclients afkappen.
    const many = Array.from({ length: 31 }, (_, index) =>
      entry(`2026-03-${`${index + 1}`.padStart(2, "0")}`, 8),
    );
    const long = build(many);
    expect(long.length).toBeGreaterThan(MAILTO_MAX_LENGTH);
    expect(long.tooLong).toBe(true);
  });
});

describe("meldtermijn", () => {
  it("meldt over de eerstvolgende maand", () => {
    expect(reportingMonthFor("2026-08-11")).toBe("2026-09-01");
    expect(reportingMonthFor("2026-12-20")).toBe("2027-01-01");
  });

  it("telt de dagen tot de 15e van deze maand", () => {
    expect(daysUntilDeadline("2026-08-11")).toBe(4);
    expect(daysUntilDeadline("2026-08-15")).toBe(0);
    expect(daysUntilDeadline("2026-08-20")).toBe(-5);
  });
});
