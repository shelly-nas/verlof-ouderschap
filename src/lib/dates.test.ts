import { describe, expect, it } from "vitest";
import {
  addDaysOnly,
  daysBetween,
  endOfMonth,
  formatDateOnly,
  isWithinRange,
  isoWeekKey,
  parseDateOnly,
  parseIsoWeekKey,
  shiftIsoWeek,
  startOfIsoWeek,
  startOfMonth,
  weekdaysOf,
} from "./dates";

describe("parse/format", () => {
  it("rondtrip blijft dezelfde kalenderdag", () => {
    expect(formatDateOnly(parseDateOnly("2026-02-01"))).toBe("2026-02-01");
  });

  it("weigert onzin", () => {
    expect(() => parseDateOnly("01-02-2026")).toThrow();
    expect(() => parseDateOnly("2026-13-01")).toThrow();
  });

  it("verschuift niet rond de zomertijdwissel", () => {
    // Laatste zondag van maart: in Europe/Amsterdam gaat de klok vooruit.
    expect(addDaysOnly("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDaysOnly("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDaysOnly("2026-10-24", 1)).toBe("2026-10-25");
  });
});

describe("ISO-weken", () => {
  it("gebruikt het ISO-weekjaar rond de jaarwissel", () => {
    // 31 december 2026 valt in week 53 van 2026.
    expect(isoWeekKey("2026-12-31")).toBe("2026-W53");
    // 1 januari 2027 valt nog steeds in week 53 van 2026.
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    // 4 januari 2027 is week 1 van 2027.
    expect(isoWeekKey("2027-01-04")).toBe("2027-W01");
    // 1 januari 2026 valt in week 1 van 2026.
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
  });

  it("weeksleutel en weekbereik zijn elkaars omgekeerde", () => {
    const { start, end } = parseIsoWeekKey("2026-W07");
    expect(start).toBe("2026-02-09");
    expect(end).toBe("2026-02-15");
    expect(isoWeekKey(start)).toBe("2026-W07");
  });

  it("week 53 van 2026 loopt door in januari 2027", () => {
    const { start, end } = parseIsoWeekKey("2026-W53");
    expect(start).toBe("2026-12-28");
    expect(end).toBe("2027-01-03");
  });

  it("weigert een week die in dat jaar niet bestaat", () => {
    // 2025 heeft 52 weken.
    expect(() => parseIsoWeekKey("2025-W53")).toThrow();
    expect(() => parseIsoWeekKey("2026-W99")).toThrow();
  });

  it("start van de week is altijd maandag", () => {
    expect(startOfIsoWeek("2026-02-11")).toBe("2026-02-09");
    expect(startOfIsoWeek("2026-02-09")).toBe("2026-02-09");
    expect(startOfIsoWeek("2026-02-15")).toBe("2026-02-09");
  });

  it("schuift over de jaargrens", () => {
    expect(shiftIsoWeek("2026-W53", 1)).toBe("2027-W01");
    expect(shiftIsoWeek("2027-W01", -1)).toBe("2026-W53");
  });

  it("weekdaysOf geeft maandag t/m zondag", () => {
    const days = weekdaysOf("2026-02-11");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-02-09");
    expect(days[6]).toBe("2026-02-15");
  });
});

describe("bereiken en maanden", () => {
  it("isWithinRange is inclusief en behandelt een open einde", () => {
    expect(isWithinRange("2026-01-01", "2026-01-01", "2026-12-31")).toBe(true);
    expect(isWithinRange("2026-12-31", "2026-01-01", "2026-12-31")).toBe(true);
    expect(isWithinRange("2025-12-31", "2026-01-01", "2026-12-31")).toBe(false);
    expect(isWithinRange("2099-01-01", "2026-01-01", null)).toBe(true);
  });

  it("maandgrenzen kloppen ook in een schrikkeljaar", () => {
    expect(startOfMonth("2026-02-17")).toBe("2026-02-01");
    expect(endOfMonth("2026-02-17")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-01")).toBe("2028-02-29");
    expect(endOfMonth("2026-12-05")).toBe("2026-12-31");
  });

  it("daysBetween telt hele dagen", () => {
    expect(daysBetween("2026-02-01", "2026-02-01")).toBe(0);
    expect(daysBetween("2026-02-01", "2026-03-01")).toBe(28);
    expect(daysBetween("2026-03-01", "2026-02-01")).toBe(-28);
  });
});
