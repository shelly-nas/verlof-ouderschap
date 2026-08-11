"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type LeaveRowInput, copyPreviousMonth, saveMonth } from "@/lib/actions";
import type { Balance } from "@/lib/balances";
import { balanceKey } from "@/lib/balances";
import {
  type DateOnly,
  calendarWeeksOf,
  formatDayLong,
  isWeekend,
  isoWeekKey,
  isoWeekNumber,
} from "@/lib/dates";
import { formatHoursNumber, parseHoursInput } from "@/lib/money";
import type { ChildDto, LeaveEntryDto, LeaveTypeDto } from "@/lib/queries";
import { Alert, Badge, Card, controlClass } from "./ui";

type Row = {
  date: DateOnly;
  childId: string;
  leaveTypeId: string;
  hours: number;
};

function rowKey(row: { date: string; childId: string; leaveTypeId: string }): string {
  return `${row.date}|${row.childId}|${row.leaveTypeId}`;
}

function rowsFromEntries(entries: LeaveEntryDto[]): Row[] {
  return entries.map((entry) => ({
    date: entry.date,
    childId: entry.childId,
    leaveTypeId: entry.leaveTypeId,
    hours: entry.hours,
  }));
}

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function MonthCalendar({
  month,
  entries,
  kinderen,
  leaveTypes,
  balances,
  hoursPerWorkdayByDate,
  daysWithoutContract,
  today,
}: {
  month: string;
  entries: LeaveEntryDto[];
  kinderen: ChildDto[];
  leaveTypes: LeaveTypeDto[];
  balances: Balance[];
  /** Uren per werkdag per datum; volgt het contract dat op die dag geldt. */
  hoursPerWorkdayByDate: Record<string, number>;
  daysWithoutContract: number;
  today: DateOnly;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => rowsFromEntries(entries));
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // Wat een klik op een dag invult.
  const [activeLeaveTypeId, setActiveLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [activeChildId, setActiveChildId] = useState(kinderen[0]?.id ?? "");
  /** Dag waarvan het detailpaneel openstaat. */
  const [selectedDay, setSelectedDay] = useState<DateOnly | null>(null);

  const weeks = useMemo(() => calendarWeeksOf(month), [month]);
  const leaveTypeById = useMemo(
    () => new Map(leaveTypes.map((type) => [type.id, type])),
    [leaveTypes],
  );
  const balanceLookup = useMemo(
    () => new Map(balances.map((b) => [balanceKey(b.childId, b.leaveTypeId), b])),
    [balances],
  );

  const rowsByDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
    return map;
  }, [rows]);

  const totalHours = rows
    .filter((row) => row.date.startsWith(month))
    .reduce((sum, row) => sum + row.hours, 0);

  const savedByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const key = balanceKey(entry.childId, entry.leaveTypeId);
      map.set(key, (map.get(key) ?? 0) + entry.hours);
    }
    return map;
  }, [entries]);

  const pendingByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.hours <= 0) continue;
      const key = balanceKey(row.childId, row.leaveTypeId);
      map.set(key, (map.get(key) ?? 0) + row.hours);
    }
    return map;
  }, [rows]);

  function isBookable(date: DateOnly): boolean {
    return date.startsWith(month) && hoursPerWorkdayByDate[date] !== undefined;
  }

  function fullDayHours(date: DateOnly): number {
    return hoursPerWorkdayByDate[date] ?? 8;
  }

  /**
   * Eén klik zet een volledige verlofdag neer met de gekozen soort; nog een klik
   * op dezelfde combinatie haalt hem weer weg. Staat er al iets anders op die
   * dag, dan komt de nieuwe soort erbij.
   */
  function toggleDay(date: DateOnly) {
    if (!isBookable(date) || !activeLeaveTypeId || !activeChildId) return;

    const key = rowKey({ date, childId: activeChildId, leaveTypeId: activeLeaveTypeId });
    setRows((current) => {
      const existing = current.find((row) => rowKey(row) === key);
      if (existing) return current.filter((row) => rowKey(row) !== key);
      return [
        ...current,
        {
          date,
          childId: activeChildId,
          leaveTypeId: activeLeaveTypeId,
          hours: fullDayHours(date),
        },
      ];
    });
  }

  function setDayHours(row: Row, hours: number) {
    const key = rowKey(row);
    setRows((current) =>
      hours <= 0
        ? current.filter((item) => rowKey(item) !== key)
        : current.map((item) => (rowKey(item) === key ? { ...item, hours } : item)),
    );
  }

  function removeRow(row: Row) {
    const key = rowKey(row);
    setRows((current) => current.filter((item) => rowKey(item) !== key));
  }

  function addRowToDay(date: DateOnly, leaveTypeId: string, childId: string) {
    const key = rowKey({ date, childId, leaveTypeId });
    setRows((current) => {
      if (current.some((row) => rowKey(row) === key)) return current;
      return [...current, { date, childId, leaveTypeId, hours: fullDayHours(date) }];
    });
  }

  function fillMonth() {
    if (!activeLeaveTypeId || !activeChildId) return;
    const workdays = Object.keys(hoursPerWorkdayByDate).filter(
      (date) => date.startsWith(month) && !isWeekend(date),
    );
    setRows(
      workdays.map((date) => ({
        date,
        childId: activeChildId,
        leaveTypeId: activeLeaveTypeId,
        hours: fullDayHours(date),
      })),
    );
  }

  /** Vult één weekdag (bijvoorbeeld elke woensdag) in de hele maand. */
  function fillWeekday(weekday: number) {
    if (!activeLeaveTypeId || !activeChildId) return;
    const matching = Object.keys(hoursPerWorkdayByDate).filter(
      (date) =>
        date.startsWith(month) &&
        new Date(`${date}T00:00:00.000Z`).getUTCDay() === weekday,
    );
    setRows((current) => {
      const others = current.filter(
        (row) => new Date(`${row.date}T00:00:00.000Z`).getUTCDay() !== weekday,
      );
      return [
        ...others,
        ...matching.map((date) => ({
          date,
          childId: activeChildId,
          leaveTypeId: activeLeaveTypeId,
          hours: fullDayHours(date),
        })),
      ];
    });
  }

  function onSave() {
    setErrors([]);
    setMessages([]);

    const payload: LeaveRowInput[] = rows
      .filter((row) => row.date.startsWith(month) && row.hours > 0)
      .map((row) => ({
        date: row.date,
        childId: row.childId,
        leaveTypeId: row.leaveTypeId,
        hours: row.hours,
      }));

    startTransition(async () => {
      const result = await saveMonth(month, payload);
      if (result.ok) {
        setMessages(["Maand opgeslagen."]);
        setSelectedDay(null);
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

  const selectedRows = selectedDay ? (rowsByDate.get(selectedDay) ?? []) : [];
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

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Klik zet neer</span>
            <select
              value={activeLeaveTypeId}
              onChange={(event) => setActiveLeaveTypeId(event.target.value)}
              className={`${controlClass} min-w-52`}
            >
              {leaveTypes.map((leaveType) => (
                <option key={leaveType.id} value={leaveType.id}>
                  {leaveType.name}
                </option>
              ))}
            </select>
          </label>

          {kinderen.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Voor</span>
              <select
                value={activeChildId}
                onChange={(event) => setActiveChildId(event.target.value)}
                className={`${controlClass} min-w-36`}
              >
                {kinderen.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fillMonth}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              Hele maand
            </button>
            <button
              type="button"
              onClick={onCopyPrevious}
              disabled={pending}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
            >
              Vorige maand kopiëren
            </button>
            <button
              type="button"
              onClick={() => setRows([])}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              Leegmaken
            </button>

            <span className="ml-1 text-sm text-[var(--muted)]">Elke:</span>
            {weekdayButtons.map((item) => (
              <button
                key={item.day}
                type="button"
                onClick={() => fillWeekday(item.day)}
                className="rounded-lg border border-[var(--border)] px-2.5 py-2 text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <div className="min-w-[44rem]">
            <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
              <div />
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-[var(--muted)]"
                >
                  {label}
                </div>
              ))}

              {weeks.map((week) => (
                <WeekRow
                  key={week[0]}
                  week={week}
                  month={month}
                  today={today}
                  rowsByDate={rowsByDate}
                  leaveTypeById={leaveTypeById}
                  selectedDay={selectedDay}
                  isBookable={isBookable}
                  onToggle={toggleDay}
                  onSelect={setSelectedDay}
                />
              ))}
            </div>
          </div>
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

      {selectedDay && (
        <Card
          title={formatDayLong(selectedDay)}
          description="Pas de uren aan of voeg een tweede verlofsoort toe."
          action={
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Sluiten
            </button>
          }
        >
          {selectedRows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Nog geen verlof op deze dag. Klik op de dag in de kalender of voeg
              hieronder een verlofsoort toe.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedRows.map((row) => {
                const leaveType = leaveTypeById.get(row.leaveTypeId);
                const child = kinderen.find((item) => item.id === row.childId);
                return (
                  <div
                    key={rowKey(row)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      aria-label={`Uren ${leaveType?.name ?? ""}`}
                      defaultValue={formatHoursNumber(row.hours)}
                      onChange={(event) => {
                        const parsed = parseHoursInput(event.target.value);
                        if (parsed !== null) setDayHours(row, parsed);
                      }}
                      inputMode="decimal"
                      className={`${controlClass} w-20 text-right tabular-nums`}
                    />
                    <span className="text-sm text-[var(--muted)]">uur</span>
                    <span className="text-sm font-medium">{leaveType?.name}</span>
                    {kinderen.length > 1 && child && (
                      <span className="text-sm text-[var(--muted)]">({child.name})</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(row)}
                      aria-label="Verwijderen"
                      className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--muted)]"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
            <span className="text-sm text-[var(--muted)]">Toevoegen:</span>
            {leaveTypes
              .filter(
                (leaveType) =>
                  !selectedRows.some(
                    (row) =>
                      row.leaveTypeId === leaveType.id && row.childId === activeChildId,
                  ),
              )
              .map((leaveType) => (
                <button
                  key={leaveType.id}
                  type="button"
                  onClick={() => addRowToDay(selectedDay, leaveType.id, activeChildId)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                >
                  + {leaveType.name}
                </button>
              ))}
          </div>
        </Card>
      )}

      {pendingByKey.size > 0 && (
        <Card title="Saldo na opslaan">
          <ul className="flex flex-col gap-2 text-sm">
            {[...pendingByKey.entries()].map(([key, hours]) => {
              const balance = balanceLookup.get(key);
              if (!balance) return null;
              const alreadySaved = savedByKey.get(key) ?? 0;
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

      <p className="text-sm text-[var(--muted)]">
        Klik op een dag om er een volledige verlofdag neer te zetten; nog een klik
        haalt hem weg. Klik op het aantal uren voor afwijkende uren of een tweede
        verlofsoort.
      </p>
    </div>
  );
}

function WeekRow({
  week,
  month,
  today,
  rowsByDate,
  leaveTypeById,
  selectedDay,
  isBookable,
  onToggle,
  onSelect,
}: {
  week: DateOnly[];
  month: string;
  today: DateOnly;
  rowsByDate: Map<string, Row[]>;
  leaveTypeById: Map<string, LeaveTypeDto>;
  selectedDay: DateOnly | null;
  isBookable: (date: DateOnly) => boolean;
  onToggle: (date: DateOnly) => void;
  onSelect: (date: DateOnly) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-center text-xs text-[var(--muted)]">
        {isoWeekNumber(isoWeekKey(week[0]))}
      </div>

      {week.map((date) => {
        const dayRows = rowsByDate.get(date) ?? [];
        const dayTotal = dayRows.reduce((sum, row) => sum + row.hours, 0);
        const inMonth = date.startsWith(month);
        const bookable = isBookable(date);
        const isToday = date === today;
        const isSelected = date === selectedDay;

        return (
          <div
            key={date}
            className={`min-h-20 rounded-lg border p-1.5 transition-colors ${
              isSelected
                ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                : "border-[var(--border)]"
            } ${inMonth ? "" : "opacity-40"} ${
              bookable ? "cursor-pointer hover:border-[var(--accent)]" : ""
            }`}
            onClick={() => bookable && onToggle(date)}
            role={bookable ? "button" : undefined}
            tabIndex={bookable ? 0 : undefined}
            onKeyDown={(event) => {
              if (!bookable) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggle(date);
              }
            }}
          >
            <div className="flex items-start justify-between">
              <span
                className={`text-xs tabular-nums ${
                  isToday
                    ? "rounded bg-[var(--accent)] px-1.5 py-0.5 font-semibold text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                {Number(date.slice(8, 10))}
              </span>
              {dayTotal > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(date);
                  }}
                  className="rounded px-1 text-xs font-semibold tabular-nums text-[var(--foreground)] underline decoration-dotted"
                  title="Uren aanpassen"
                >
                  {formatHoursNumber(dayTotal)}u
                </button>
              )}
            </div>

            <div className="mt-1 flex flex-col gap-0.5">
              {dayRows.map((row) => {
                const leaveType = leaveTypeById.get(row.leaveTypeId);
                return (
                  <span
                    key={rowKey(row)}
                    className="truncate rounded px-1 py-0.5 text-[11px] leading-tight text-white"
                    style={{ backgroundColor: leaveType?.colorHex ?? "#64748b" }}
                    title={leaveType?.name}
                  >
                    {leaveType?.name}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
