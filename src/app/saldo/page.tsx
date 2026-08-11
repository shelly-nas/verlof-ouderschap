import Link from "next/link";
import { Alert, Badge, Card, EmptyState, ProgressBar } from "@/components/ui";
import { type Balance, balancesFor } from "@/lib/balances";
import { formatDateNl, today } from "@/lib/dates";
import { formatHoursNumber } from "@/lib/money";
import { getAppData } from "@/lib/queries";

export const dynamic = "force-dynamic";

function DeadlineBadge({ balance }: { balance: Balance }) {
  switch (balance.deadlineStatus) {
    case "DONE":
      return <Badge tone="green">volledig opgenomen</Badge>;
    case "EXPIRED":
      return <Badge tone="red">termijn verstreken</Badge>;
    case "SOON":
      return (
        <Badge tone="amber">
          nog {balance.daysUntilDeadline} dag
          {balance.daysUntilDeadline === 1 ? "" : "en"}
        </Badge>
      );
    case "OK":
      return <Badge tone="blue">op tijd</Badge>;
    default:
      return null;
  }
}

export default async function SaldoPage() {
  const { contracts, children, leaveTypes, supplements, entries } = await getAppData();
  const now = today();

  const balances = balancesFor({
    children,
    leaveTypes,
    contracts,
    supplements,
    entries,
    today: now,
  });

  if (children.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">Saldo</h1>
        <EmptyState title="Nog geen kinderen">
          Voeg een kind toe onder{" "}
          <Link href="/kinderen" className="underline">
            Kinderen
          </Link>{" "}
          om je verlofrechten te zien.
        </EmptyState>
      </div>
    );
  }

  const byChild = new Map<string, Balance[]>();
  for (const balance of balances) {
    const list = byChild.get(balance.childId) ?? [];
    list.push(balance);
    byChild.set(balance.childId, list);
  }

  const warnings = balances.filter(
    (balance) => balance.usedAfterDeadlineHours > 0 || balance.overBookedHours > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Saldo</h1>
        <p className="text-sm text-[var(--muted)]">
          Je recht is berekend met de contracturen die golden op de geboortedatum.
        </p>
      </div>

      {warnings.length > 0 && (
        <Alert tone="warning" title="Let op">
          <ul className="list-inside list-disc">
            {warnings.map((balance) => (
              <li key={`${balance.childId}-${balance.leaveTypeId}`}>
                {balance.leaveTypeName} ({balance.childName}):
                {balance.overBookedHours > 0 &&
                  ` ${formatHoursNumber(balance.overBookedHours)} uur meer opgenomen dan je recht.`}
                {balance.usedAfterDeadlineHours > 0 &&
                  ` ${formatHoursNumber(balance.usedAfterDeadlineHours)} uur geboekt na de deadline.`}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {[...byChild.entries()].map(([childId, childBalances]) => {
        const child = children.find((item) => item.id === childId);
        const reference = childBalances[0]?.entitlement.referenceContract;

        return (
          <Card
            key={childId}
            title={child?.name ?? "Kind"}
            description={
              reference
                ? `Geboren ${formatDateNl(child?.dateOfBirth ?? "")} · recht berekend op ${reference.hoursPerWeek} uur per week (${reference.employerName})`
                : `Geboren ${formatDateNl(child?.dateOfBirth ?? "")} · nog geen contract gevonden`
            }
          >
            <div className="flex flex-col gap-5">
              {childBalances.map((balance) => (
                <div key={balance.leaveTypeId} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{balance.leaveTypeName}</span>
                      <DeadlineBadge balance={balance} />
                      {balance.carriedInHours > 0 && (
                        <Badge tone="violet">
                          +{formatHoursNumber(balance.carriedInHours)} uur doorgeschoven
                        </Badge>
                      )}
                      {balance.carriedOutHours > 0 && (
                        <Badge tone="neutral">
                          {formatHoursNumber(balance.carriedOutHours)} uur doorgeschoven
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">
                        {formatHoursNumber(Math.max(0, balance.remainingHours))} uur
                      </span>{" "}
                      <span className="text-[var(--muted)]">
                        van {formatHoursNumber(balance.entitledHours)} uur over
                      </span>
                    </span>
                  </div>

                  <ProgressBar
                    value={balance.usedHours}
                    max={balance.entitledHours}
                    colorHex={balance.colorHex}
                  />

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted)]">
                    <span>
                      Opgenomen: {formatHoursNumber(balance.usedHours)} uur (
                      {formatHoursNumber(balance.entitlement.weeks)}{" "}
                      {balance.entitlement.weeks === 1 ? "week" : "weken"} ×{" "}
                      {formatHoursNumber(balance.entitlement.hoursPerWeek)} uur)
                    </span>
                    {balance.deadline && (
                      <span>Opnemen t/m {formatDateNl(balance.deadline)}</span>
                    )}
                    {balance.entitlement.payer === "UWV" && (
                      <span>
                        UWV betaalt {balance.entitlement.payPercent}% van het dagloon
                        {balance.entitlement.topUpToPercent
                          ? `, werkgever vult aan tot ${balance.entitlement.topUpToPercent}%`
                          : ""}
                      </span>
                    )}
                    {balance.entitlement.payer === "EMPLOYER" && (
                      <span>Volledig doorbetaald door de werkgever</span>
                    )}
                    {balance.entitlement.payer === "UNPAID" && (
                      <span>
                        Onbetaald
                        {balance.entitlement.topUpToPercent
                          ? `, werkgever betaalt ${balance.entitlement.topUpToPercent}%`
                          : ""}
                      </span>
                    )}
                  </div>

                  {balance.carriedInHours > 0 && (
                    <p className="text-xs text-[var(--muted)]">
                      De termijn voor het betaalde deel is verstreken; het resterende
                      recht is naar dit onbetaalde saldo verplaatst.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
