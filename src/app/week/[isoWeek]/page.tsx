import Link from "next/link";
import { notFound } from "next/navigation";
import { WeekGrid } from "@/components/WeekGrid";
import { Badge } from "@/components/ui";
import { balancesFor } from "@/lib/balances";
import { contractForDate, hoursPerWorkday } from "@/lib/contracts";
import {
  formatDateShortNl,
  isoWeekKey,
  isoWeekNumber,
  parseIsoWeekKey,
  shiftIsoWeek,
  today,
} from "@/lib/dates";
import { getAppData, getLeaveEntries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ isoWeek: string }>;
}) {
  const { isoWeek } = await params;

  let week: { start: string; end: string };
  try {
    week = parseIsoWeekKey(isoWeek);
  } catch {
    notFound();
  }

  const [{ contracts, children, leaveTypes, supplements, entries }, weekEntries] =
    await Promise.all([
      getAppData(),
      getLeaveEntries({ from: week.start, to: week.end }),
    ]);

  const now = today();
  const contract = contractForDate(contracts, week.start);
  // Een week kan twee contracten raken; dat melden we expliciet.
  const contractAtEnd = contractForDate(contracts, week.end);
  const contractChangesMidWeek =
    contract !== null && contractAtEnd !== null && contract.id !== contractAtEnd.id;

  const balances = balancesFor({
    children,
    leaveTypes,
    contracts,
    supplements,
    entries,
    today: now,
  });

  const currentWeek = isoWeekKey(now);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Week {isoWeekNumber(isoWeek)}{" "}
            <span className="text-[var(--muted)]">
              ({formatDateShortNl(week.start)} t/m {formatDateShortNl(week.end)})
            </span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            {contract ? (
              <span>
                {contract.employerName} · {contract.hoursPerWeek} uur per week
              </span>
            ) : (
              <span>Geen contract in deze week</span>
            )}
            {isoWeek === currentWeek && <Badge tone="blue">deze week</Badge>}
            {contractChangesMidWeek && (
              <Badge tone="amber">contractwissel binnen deze week</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/week/${shiftIsoWeek(isoWeek, -1)}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ← Vorige
          </Link>
          <Link
            href={`/week/${currentWeek}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Vandaag
          </Link>
          <Link
            href={`/week/${shiftIsoWeek(isoWeek, 1)}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Volgende →
          </Link>
        </div>
      </div>

      <WeekGrid
        key={isoWeek}
        weekStart={week.start}
        entries={weekEntries}
        kinderen={children}
        leaveTypes={leaveTypes}
        balances={balances}
        hoursPerWorkday={contract ? hoursPerWorkday(contract) : null}
        hasContract={contract !== null || contractAtEnd !== null}
      />

      {contractChangesMidWeek && contract && contractAtEnd && (
        <p className="text-sm text-[var(--muted)]">
          Deze week loopt over een contractwissel: tot en met{" "}
          {formatDateShortNl(contract.endDate ?? week.end)} geldt {contract.employerName} (
          {contract.hoursPerWeek} uur), daarna {contractAtEnd.employerName} (
          {contractAtEnd.hoursPerWeek} uur). Elke verlofdag wordt met het contract van
          die dag berekend.
        </p>
      )}

      <p className="text-sm text-[var(--muted)]">
        Het weekend blijft verborgen zolang er geen verlof op staat. Verlof buiten je
        contractperiode kan niet worden opgeslagen.
      </p>
    </div>
  );
}
