import Link from "next/link";
import { Alert, Badge, Card, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { balancesFor } from "@/lib/balances";
import { activeContract } from "@/lib/contracts";
import {
  formatDateNl,
  formatMonthNl,
  monthKey,
  today,
} from "@/lib/dates";
import { daysUntilDeadline, reportingMonthFor } from "@/lib/mailto";
import { formatEuro, formatHoursNumber } from "@/lib/money";
import { getAppData } from "@/lib/queries";
import { monthImpact } from "@/lib/salary";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { contracts, children, leaveTypes, supplements, entries, maxDaglonen } =
    await getAppData();
  const now = today();
  const contract = activeContract(contracts, now);

  if (contracts.length === 0 || children.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">Welkom</h1>
        <EmptyState title="Nog even instellen">
          <p>Twee dingen zijn nodig voordat je verlof kunt bijhouden:</p>
          <ol className="mt-3 flex flex-col gap-1 text-left">
            <li>
              1.{" "}
              <Link href="/contracten" className="underline">
                Voeg je contract toe
              </Link>{" "}
              {contracts.length > 0 && <Badge tone="green">gedaan</Badge>}
            </li>
            <li>
              2.{" "}
              <Link href="/kinderen" className="underline">
                Voeg je kind toe
              </Link>{" "}
              {children.length > 0 && <Badge tone="green">gedaan</Badge>}
            </li>
          </ol>
        </EmptyState>
      </div>
    );
  }

  const balances = balancesFor({
    children,
    leaveTypes,
    contracts,
    supplements,
    entries,
    today: now,
  });

  const currentMonth = monthKey(now);
  let impact: ReturnType<typeof monthImpact> | null = null;
  try {
    impact = monthImpact({
      month: currentMonth,
      entries,
      contracts,
      leaveTypes,
      supplements,
      maxDaglonen,
    });
  } catch {
    impact = null;
  }

  const urgent = balances.filter(
    (balance) =>
      (balance.deadlineStatus === "SOON" || balance.deadlineStatus === "EXPIRED") &&
      balance.remainingHours > 0,
  );

  const withRemaining = balances.filter((balance) => balance.remainingHours > 0);
  const daysLeft = daysUntilDeadline(now);
  const reportingMonth = reportingMonthFor(now);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Overzicht</h1>
          <p className="text-sm text-[var(--muted)]">
            {contract
              ? `${contract.employerName} · ${contract.hoursPerWeek} uur per week`
              : "Geen actief contract"}
          </p>
        </div>
        <Link
          href={`/maand/${currentMonth}`}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          {formatMonthNl(`${currentMonth}-01`)} invoeren
        </Link>
      </div>

      {urgent.length > 0 && (
        <Alert tone="warning" title="Deadlines in zicht">
          <ul className="list-inside list-disc">
            {urgent.map((balance) => (
              <li key={`${balance.childId}-${balance.leaveTypeId}`}>
                {balance.leaveTypeName} ({balance.childName}):{" "}
                {formatHoursNumber(balance.remainingHours)} uur over,{" "}
                {balance.deadlineStatus === "EXPIRED"
                  ? `termijn verstreken op ${formatDateNl(balance.deadline!)}`
                  : `opnemen t/m ${formatDateNl(balance.deadline!)}`}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {impact && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={`Verlof in ${formatMonthNl(`${currentMonth}-01`)}`}
            value={`${formatHoursNumber(impact.leaveHours)} uur`}
          />
          <Stat
            label="Verwacht bruto deze maand"
            value={formatEuro(impact.totalReceived)}
            hint={
              impact.difference < -0.005
                ? `${formatEuro(Math.abs(impact.difference))} minder dan normaal`
                : "Geen inkomensverlies"
            }
            tone={impact.difference < -0.005 ? "negative" : "neutral"}
          />
          <Stat
            label="Melden vóór de 15e"
            value={
              daysLeft > 0
                ? `nog ${daysLeft} dag${daysLeft === 1 ? "" : "en"}`
                : daysLeft === 0
                  ? "vandaag"
                  : "verstreken"
            }
            hint={`Voor ${formatMonthNl(reportingMonth)}`}
            tone={daysLeft < 0 ? "negative" : "neutral"}
          />
        </div>
      )}

      <Card
        title="Resterend verlof"
        action={
          <Link href="/saldo" className="text-sm text-[var(--accent)]">
            Alle saldi →
          </Link>
        }
      >
        {withRemaining.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Al je verlofrechten zijn opgenomen of verlopen.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {withRemaining.map((balance) => (
              <div key={`${balance.childId}-${balance.leaveTypeId}`}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{balance.leaveTypeName}</span>{" "}
                    <span className="text-[var(--muted)]">({balance.childName})</span>
                  </span>
                  <span className="tabular-nums">
                    {formatHoursNumber(balance.remainingHours)} van{" "}
                    {formatHoursNumber(balance.entitledHours)} uur over
                  </span>
                </div>
                <ProgressBar
                  value={balance.usedHours}
                  max={balance.entitledHours}
                  colorHex={balance.colorHex}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Snel naar">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/mail"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Verlof melden bij werkgever
          </Link>
          <Link
            href="/salaris"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Salarisimpact bekijken
          </Link>
          <Link
            href="/contracten"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Contracten beheren
          </Link>
        </div>
      </Card>
    </div>
  );
}
