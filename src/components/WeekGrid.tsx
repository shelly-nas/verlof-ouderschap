"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { type WeekRowInput, copyPreviousWeek, saveWeek } from "@/lib/actions";
import type { Balance } from "@/lib/balances";
import { balanceKey } from "@/lib/balances";
import { type DateOnly, formatWeekdayWithDate, isWeekend, weekdaysOf } from "@/lib/dates";
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

export function WeekGrid({
  weekStart,
  entries,
  kinderen,
  leaveTypes,
  balances,
  hoursPerWorkday,
  hasContract,
}: {
  weekStart: DateOnly;
  entries: LeaveEntryDto[];
  kinderen: ChildDto[];
  leaveTypes: LeaveTypeDto[];
  balances: Balance[];
  hoursPerWorkday: number | null;
  hasContract: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => rowsFromEntries(entries));
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const days = weekdaysOf(weekStart);
  const defaultChildId = kinderen[0]?.id ?? "";
  const defaultLeaveTypeId = leaveTypes[0]?.id ?? "";
  const balanceLookup = useMemo(
    () => new Map(balances.map((b) => [balanceKey(b.childId, b.leaveTypeId), b])),
    [balances],
  );

  // Toon het weekend alleen als daar iets op staat; verlof valt normaal op werkdagen.
  const visibleDays = days.filter(
    (day) => !isWeekend(day) || rows.some((row) => row.date === day),
  );

  const totalHours = rows.reduce((sum, row) => sum + (parseHoursInput(row.hours) ?? 0), 0);

  /** Uren die deze week per kind/verlofsoort bij komen bovenop het opgeslagen saldo. */
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

  const savedThisWeekByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const key = balanceKey(entry.childId, entry.leaveTypeId);
      map.set(key, (map.get(key) ?? 0) + entry.hours);
    }
    return map;
  }, [entries]);

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
        hours: hoursPerWorkday ? formatHoursNumber(hoursPerWorkday) : "8",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function fillWeek() {
    if (!defaultChildId || !defaultLeaveTypeId) return;
    const workdays = days.filter((day) => !isWeekend(day));
    setRows(
      workdays.map((date) => ({
        key: nextKey(),
        date,
        childId: defaultChildId,
        leaveTypeId: defaultLeaveTypeId,
        hours: hoursPerWorkday ? formatHoursNumber(hoursPerWorkday) : "8",
      })),
    );
  }

  function onSave() {
    setErrors([]);
    setMessages([]);

    const payload: WeekRowInput[] = [];
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
      const result = await saveWeek(weekStart, payload);
      if (result.ok) {
        setMessages([result.message ?? "Opgeslagen."]);
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
      const result = await copyPreviousWeek(weekStart);
      if (result.ok) {
        setMessages(["Vorige week gekopieerd."]);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  if (!hasContract) {
    return (
      <Alert tone="warning" title="Geen contract in deze week">
        Voeg eerst een contract toe dat deze week dekt; anders is niet te bepalen hoeveel
        uur een verlofdag is.
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={fillWeek}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          Hele week vullen
        </button>
        <button
          type="button"
          onClick={onCopyPrevious}
          disabled={pending}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Vorige week kopiëren
        </button>
        <button
          type="button"
          onClick={() => setRows([])}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          Week leegmaken
        </button>
      </div>

      <Card>
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {visibleDays.map((day) => {
            const dayRows = rows.filter((row) => row.date === day);
            const dayTotal = dayRows.reduce(
              (sum, row) => sum + (parseHoursInput(row.hours) ?? 0),
              0,
            );
            return (
              <div key={day} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:gap-4">
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

                  <button
                    type="button"
                    onClick={() => addRow(day)}
                    className="self-start text-sm text-[var(--accent)]"
                  >
                    + verlof toevoegen
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-sm">
            Totaal deze week:{" "}
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
            {pending ? "Bezig…" : "Week opslaan"}
          </button>
        </div>
      </Card>

      {pendingByKey.size > 0 && (
        <Card title="Saldo na opslaan">
          <ul className="flex flex-col gap-2 text-sm">
            {[...pendingByKey.entries()].map(([key, hours]) => {
              const balance = balanceLookup.get(key);
              if (!balance) return null;
              const alreadySaved = savedThisWeekByKey.get(key) ?? 0;
              // balance.usedHours bevat de opgeslagen uren al; alleen het verschil telt.
              const projectedRemaining =
                balance.remainingHours - (hours - alreadySaved);
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
