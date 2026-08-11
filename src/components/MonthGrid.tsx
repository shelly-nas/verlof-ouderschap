"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { type LeaveRowInput, copyPreviousMonth, saveMonth } from "@/lib/actions";
import type { Balance } from "@/lib/balances";
import { balanceKey } from "@/lib/balances";
import {
  type DateOnly,
  formatWeekdayWithDate,
  isWeekend,
  isoWeekKey,
  isoWeekNumber,
} from "@/lib/dates";
import { formatHoursNumber, parseHoursInput } from "@/lib/money";
import type { ChildDto, LeaveEntryDto, LeaveTypeDto } from "@/lib/queries";
import { Alert, Badge, Card, controlClass } from "./ui";

type Row = {
  key: string;
  date: DateOnly;
  childId: string;
  leaveTypeId: string;
  hours: string;
};

let rowCounter = 0;
function nextKey() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function rowsFromEntries(entries: LeaveEntryDto[]): Row[] {
  return entries.map((entry) => ({
    key: nextKey(),
    date: entry.date,
    childId: entry.childId,
    leaveTypeId: entry.leaveTypeId,
    hours: formatHoursNumber(entry.hours),
  }));
}

export function MonthGrid({
  month,
  days,
  entries,
  kinderen,
  leaveTypes,
  balances,
  hoursPerWorkdayByDate,
  daysWithoutContract,
}: {
  month: string;
  /** Alle kalenderdagen van de maand. */
  days: DateOnly[];
  entries: LeaveEntryDto[];
  kinderen: ChildDto[];
  leaveTypes: LeaveTypeDto[];
  balances: Balance[];
  /** Uren per werkdag per datum; volgt het contract dat op die dag geldt. */
  hoursPerWorkdayByDate: Record<string, number>;
  daysWithoutContract: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => rowsFromEntries(entries));
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const defaultChildId = kinderen[0]?.id ?? "";
  const defaultLeaveTypeId = leaveTypes[0]?.id ?? "";
  const balanceLookup = useMemo(
    () => new Map(balances.map((b) => [balanceKey(b.childId, b.leaveTypeId), b])),
    [balances],
  );

  // Het weekend blijft verborgen zolang er geen verlof op staat.
  const visibleDays = days.filter(
    (day) => !isWeekend(day) || rows.some((row) => row.date === day),
  );

  // Weeknummers groeperen de maand visueel, zonder dat je per week hoeft te
  // navigeren.
  const weekGroups = useMemo(() => {
    const groups: { weekKey: string; days: DateOnly[] }[] = [];
    for (const day of visibleDays) {
      const weekKey = isoWeekKey(day);
      const last = groups[groups.length - 1];
      if (last && last.weekKey === weekKey) last.days.push(day);
      else groups.push({ weekKey, days: [day] });
    }
    return groups;
  }, [visibleDays]);

  const totalHours = rows.reduce((sum, row) => sum + (parseHoursInput(row.hours) ?? 0), 0);

  const pendingByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const hours = parseHoursInput(row.hours) ?? 0;
      if (hours <= 0) continue;
      const key = balanceKey(row.childId, row.leaveTypeId);
      map.set(key, (map.get(key) ?? 0) + hours);
    }
    return map;
  }, [rows]);

  const savedThisMonthByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const key = balanceKey(entry.childId, entry.leaveTypeId);
      map.set(key, (map.get(key) ?? 0) + entry.hours);
    }
    return map;
  }, [entries]);

  function defaultHoursFor(date: DateOnly): string {
    const hours = hoursPerWorkdayByDate[date];
    return hours ? formatHoursNumber(hours) : "8";
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow(date: DateOnly) {
    setRows((current) => [
      ...current,
      {
        key: nextKey(),
        date,
        childId: defaultChildId,
        leaveTypeId: defaultLeaveTypeId,
        hours: defaultHoursFor(date),
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  /** Vult alle werkdagen van de maand met een volledige verlofdag. */
  function fillMonth() {
    if (!defaultChildId || !defaultLeaveTypeId) return;
    const workdays = days.filter(
      (day) => !isWeekend(day) && hoursPerWorkdayByDate[day] !== undefined,
    );
    setRows(
      workdays.map((date) => ({
        key: nextKey(),
        date,
        childId: defaultChildId,
        leaveTypeId: defaultLeaveTypeId,
        hours: defaultHoursFor(date),
      })),
    );
  }

  /** Vult één weekdag (bijvoorbeeld elke woensdag) in de hele maand. */
  function fillWeekday(weekday: number) {
    if (!defaultChildId || !defaultLeaveTypeId) return;
    const matching = days.filter(
      (day) =>
        new Date(`${day}T00:00:00.000Z`).getUTCDay() === weekday &&
        hoursPerWorkdayByDate[day] !== undefined,
    );
    setRows((current) => {
      const withoutWeekday = current.filter(
        (row) => new Date(`${row.date}T00:00:00.000Z`).getUTCDay() !== weekday,
      );
      return [
        ...withoutWeekday,
        ...matching.map((date) => ({
          key: nextKey(),
          date,
          childId: defaultChildId,
          leaveTypeId: defaultLeaveTypeId,
          hours: defaultHoursFor(date),
        })),
      ];
    });
  }

  function onSave() {
    setErrors([]);
    setMessages([]);

    const payload: LeaveRowInput[] = [];
    for (const row of rows) {
      const hours = parseHoursInput(row.hours);
      if (hours === null) {
        setErrors([`"${row.hours}" is geen geldig aantal uren.`]);
        return;
      }
      if (hours <= 0) continue;
      if (!row.childId || !row.leaveTypeId) {
        setErrors(["Kies bij elke regel een kind en een verlofsoort."]);
        return;
      }
      payload.push({
        date: row.date,
        childId: row.childId,
        leaveTypeId: row.leaveTypeId,
        hours,
      });
    }

    startTransition(async () => {
      const result = await saveMonth(month, payload);
      if (result.ok) {
        setMessages(["Maand opgeslagen."]);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  function onCopyPrevious() {
    setErrors([]);
    setMessages([]);
    startTransition(async () => {
      const result = await copyPreviousMonth(month);
      if (result.ok) {
        setMessages(["Vorige maand gekopieerd."]);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  if (Object.keys(hoursPerWorkdayByDate).length === 0) {
    return (
      <Alert tone="warning" title="Geen contract in deze maand">
        Voeg eerst een contract toe dat deze maand dekt; anders is niet te bepalen
        hoeveel uur een verlofdag is.
      </Alert>
    );
  }

  if (kinderen.length === 0) {
    return (
      <Alert tone="warning" title="Nog geen kinderen">
        Voeg eerst een kind toe onder Kinderen.
      </Alert>
    );
  }

  const weekdayButtons = [
    { day: 1, label: "ma" },
    { day: 2, label: "di" },
    { day: 3, label: "wo" },
    { day: 4, label: "do" },
    { day: 5, label: "vr" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <Alert tone="error" title="Opslaan is niet gelukt">
          <ul className="list-inside list-disc">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}
      {messages.length > 0 && <Alert tone="success">{messages.join(" ")}</Alert>}

      {daysWithoutContract > 0 && (
        <Alert tone="warning">
          {daysWithoutContract} dag(en) in deze maand vallen buiten elke
          contractperiode; daarop kun je geen verlof boeken.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={fillMonth}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          Hele maand vullen
        </button>
        <button
          type="button"
          onClick={onCopyPrevious}
          disabled={pending}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Vorige maand kopiëren
        </button>
        <button
          type="button"
          onClick={() => setRows([])}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          Maand leegmaken
        </button>

        <span className="ml-2 text-sm text-[var(--muted)]">Elke:</span>
        {weekdayButtons.map((item) => (
          <button
            key={item.day}
            type="button"
            onClick={() => fillWeekday(item.day)}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm"
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-1">
          {weekGroups.map((group) => (
            <div key={group.weekKey}>
              <p className="px-1 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Week {isoWeekNumber(group.weekKey)}
              </p>

              <div className="flex flex-col divide-y divide-[var(--border)]">
                {group.days.map((day) => {
                  const dayRows = rows.filter((row) => row.date === day);
                  const dayTotal = dayRows.reduce(
                    (sum, row) => sum + (parseHoursInput(row.hours) ?? 0),
                    0,
                  );
                  const bookable = hoursPerWorkdayByDate[day] !== undefined;

                  return (
                    <div
                      key={day}
                      className="flex flex-col gap-2 py-2 sm:flex-row sm:gap-4"
                    >
                      <div className="sm:w-44 sm:shrink-0 sm:pt-2">
                        <p className="font-medium capitalize leading-tight">
                          {formatWeekdayWithDate(day)}
                        </p>
                        {dayTotal > 0 && (
                          <p className="text-xs text-[var(--muted)]">
                            {formatHoursNumber(dayTotal)} uur
                          </p>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-2">
                        {dayRows.map((row) => (
                          <div key={row.key} className="flex flex-wrap items-center gap-2">
                            <input
                              aria-label={`Uren op ${day}`}
                              value={row.hours}
                              onChange={(event) =>
                                updateRow(row.key, { hours: event.target.value })
                              }
                              inputMode="decimal"
                              className={`${controlClass} w-20 text-right tabular-nums`}
                              placeholder="0"
                            />
                            <span className="text-sm text-[var(--muted)]">uur</span>
                            <select
                              aria-label="Verlofsoort"
                              value={row.leaveTypeId}
                              onChange={(event) =>
                                updateRow(row.key, { leaveTypeId: event.target.value })
                              }
                              className={`${controlClass} min-w-52`}
                            >
                              {leaveTypes.map((leaveType) => (
                                <option key={leaveType.id} value={leaveType.id}>
                                  {leaveType.name}
                                </option>
                              ))}
                            </select>
                            {kinderen.length > 1 && (
                              <select
                                aria-label="Kind"
                                value={row.childId}
                                onChange={(event) =>
                                  updateRow(row.key, { childId: event.target.value })
                                }
                                className={`${controlClass} min-w-36`}
                              >
                                {kinderen.map((child) => (
                                  <option key={child.id} value={child.id}>
                                    {child.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              aria-label="Regel verwijderen"
                              className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--muted)]"
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {bookable ? (
                          <button
                            type="button"
                            onClick={() => addRow(day)}
                            className="self-start text-sm text-[var(--accent)]"
                          >
                            + verlof toevoegen
                          </button>
                        ) : (
                          <p className="text-sm text-[var(--muted)]">Geen contract</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-sm">
            Totaal deze maand:{" "}
            <span className="font-semibold tabular-nums">
              {formatHoursNumber(totalHours)} uur
            </span>
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Bezig…" : "Maand opslaan"}
          </button>
        </div>
      </Card>

      {pendingByKey.size > 0 && (
        <Card title="Saldo na opslaan">
          <ul className="flex flex-col gap-2 text-sm">
            {[...pendingByKey.entries()].map(([key, hours]) => {
              const balance = balanceLookup.get(key);
              if (!balance) return null;
              const alreadySaved = savedThisMonthByKey.get(key) ?? 0;
              // balance.usedHours bevat de opgeslagen uren al; alleen het
              // verschil met wat er nu op het scherm staat telt mee.
              const projectedRemaining = balance.remainingHours - (hours - alreadySaved);
              const overBooked = projectedRemaining < 0;
              const afterDeadline =
                balance.deadline !== null &&
                rows.some(
                  (row) =>
                    balanceKey(row.childId, row.leaveTypeId) === key &&
                    row.date > balance.deadline!,
                );

              return (
                <li key={key} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{balance.leaveTypeName}</span>
                  <span className="text-[var(--muted)]">({balance.childName})</span>
                  <span className="tabular-nums">
                    nog {formatHoursNumber(Math.max(0, projectedRemaining))} uur van{" "}
                    {formatHoursNumber(balance.entitledHours)} uur
                  </span>
                  {overBooked && (
                    <Badge tone="red">
                      {formatHoursNumber(Math.abs(projectedRemaining))} uur te veel
                    </Badge>
                  )}
                  {afterDeadline && <Badge tone="amber">na de deadline</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
