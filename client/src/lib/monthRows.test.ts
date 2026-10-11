import { describe, expect, it } from "vitest";
import type { Balance, LeaveEntry } from "../api/types";
import {
  exhaustedLeaveTypeIds,
  fillMonth,
  fillWeekday,
  isDirty,
  projectBalances,
  setHours,
  toggleDay,
} from "./monthRows";

// Oktober 2026: 1 oktober is een donderdag. Contractwissel op de 15e (8 → 6,4 uur).
const hours: Record<string, number> = {};
for (let day = 1; day <= 31; day += 1) {
  const date = `2026-10-${`${day}`.padStart(2, "0")}`;
  hours[date] = day < 15 ? 8 : 6.4;
}

const row = { date: "2026-10-07", childId: "c", leaveTypeId: "ov", hours: 6.4 };

describe("toggleDay", () => {
  it("zet een dag neer en haalt hem met een tweede klik weer weg", () => {
    const once = toggleDay([], row);
    expect(once).toHaveLength(1);
    expect(toggleDay(once, row)).toHaveLength(0);
  });

  it("voegt een andere verlofsoort op dezelfde dag toe", () => {
    const both = toggleDay([row], { ...row, leaveTypeId: "gv" });
    expect(both).toHaveLength(2);
  });
});

describe("setHours", () => {
  it("haalt de regel weg bij 0 uur", () => {
    expect(setHours([row], row, 0)).toHaveLength(0);
    expect(setHours([row], row, 3)[0].hours).toBe(3);
  });
});

describe("fillMonth", () => {
  it("vult alleen werkdagen, met de uren van het contract van die dag", () => {
    const rows = fillMonth(hours, "2026-10", "c", "ov");
    expect(rows).toHaveLength(22);
    expect(rows[0]).toMatchObject({ date: "2026-10-01", hours: 8 });
    expect(rows.find((item) => item.date === "2026-10-15")?.hours).toBe(6.4);
    expect(rows.some((item) => item.date === "2026-10-03")).toBe(false);
  });
});

describe("fillWeekday", () => {
  it("vervangt alle woensdagen en laat andere dagen staan", () => {
    const monday = { ...row, date: "2026-10-05" };
    const rows = fillWeekday([monday, row], hours, "2026-10", 3, "c", "gv");
    expect(rows.map((item) => item.date)).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-14",
      "2026-10-21",
      "2026-10-28",
    ]);
    expect(rows.filter((item) => item.leaveTypeId === "gv")).toHaveLength(4);
  });
});

describe("isDirty", () => {
  const saved: LeaveEntry[] = [{ ...row, id: "1", contractId: "b", note: null }];
  it("ziet geen verschil bij dezelfde regels", () => {
    expect(isDirty([row], saved)).toBe(false);
  });
  it("ziet gewijzigde uren", () => {
    expect(isDirty([{ ...row, hours: 3 }], saved)).toBe(true);
  });
});

describe("projectBalances", () => {
  const balance = {
    childId: "c",
    leaveTypeId: "ov",
    remainingHours: 10,
    deadline: "2026-10-20",
  } as Balance;

  it("telt alleen het verschil met wat al opgeslagen is", () => {
    const saved: LeaveEntry[] = [{ ...row, id: "1", contractId: "b", note: null }];
    const [projection] = projectBalances([row, { ...row, date: "2026-10-14" }], saved, [balance]);
    expect(projection.remaining).toBe(3.6);
    expect(projection.overBooked).toBe(0);
    expect(projection.afterDeadline).toBe(false);
  });

  it("signaleert overschrijding en boekingen na de deadline", () => {
    const rows = ["2026-10-07", "2026-10-21"].map((date) => ({ ...row, date, hours: 8 }));
    const [projection] = projectBalances(rows, [], [balance]);
    expect(projection.overBooked).toBe(6);
    expect(projection.afterDeadline).toBe(true);
  });
});

describe("exhaustedLeaveTypeIds", () => {
  const balances = [
    { childId: "c", leaveTypeId: "ov", remainingHours: 6.4 },
    { childId: "c", leaveTypeId: "gv", remainingHours: 0 },
    { childId: "d", leaveTypeId: "ov", remainingHours: 0 },
  ] as Balance[];

  it("is op als het saldo met het verlof op het scherm op 0 komt", () => {
    expect(exhaustedLeaveTypeIds([], [], balances, "c")).toEqual(new Set(["gv"]));
    expect(exhaustedLeaveTypeIds([row], [], balances, "c")).toEqual(new Set(["ov", "gv"]));
  });

  it("geeft opgeslagen uren die je weghaalt weer vrij", () => {
    const saved: LeaveEntry[] = [{ ...row, id: "1", contractId: "b", note: null }];
    const used = [{ childId: "c", leaveTypeId: "ov", remainingHours: 0 }] as Balance[];
    expect(exhaustedLeaveTypeIds(saved, saved, used, "c").has("ov")).toBe(true);
    expect(exhaustedLeaveTypeIds([], saved, used, "c").has("ov")).toBe(false);
  });

  it("kijkt alleen naar het gekozen kind", () => {
    expect(exhaustedLeaveTypeIds([], [], balances, "d")).toEqual(new Set(["ov"]));
  });
});
