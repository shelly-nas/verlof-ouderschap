import Link from "next/link";
import { MonthCalendar } from "@/components/MonthCalendar";
import { Badge } from "@/components/ui";
import { balancesFor } from "@/lib/balances";
import { contractForDate, hoursPerWorkday } from "@/lib/contracts";
import {
  type DateOnly,
  addMonthsOnly,
  endOfMonth,
  formatMonthNl,
  monthKey,
  startOfMonth,
  today,
} from "@/lib/dates";
import { getAppData, getLeaveEntries } from "@/lib/queries";

/**
 * Het maandscherm. Zowel /maand (huidige maand) als /maand/[maand] rendert dit.
 */
export async function MonthScreen({ month: maand }: { month: string }) {
  const monthStart = startOfMonth(`${maand}-01`);
  const monthEnd = endOfMonth(monthStart);

  const [{ contracts, children, leaveTypes, supplements, entries }, monthEntries] =
    await Promise.all([
      getAppData(),
      getLeaveEntries({ from: monthStart, to: monthEnd }),
    ]);

  const now = today();

  // Per dag het contract dat er geldt; de kalender leidt daar het rooster uit af.
  const hoursPerWorkdayByDate: Record<string, number> = {};
  const contractsInMonth = new Map<string, { name: string; hours: number }>();
  let daysWithoutContract = 0;

  const lastDay = Number(monthEnd.slice(8, 10));
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${maand}-${`${day}`.padStart(2, "0")}` as DateOnly;
    const contract = contractForDate(contracts, date);
    if (contract) {
      hoursPerWorkdayByDate[date] = hoursPerWorkday(contract);
      contractsInMonth.set(contract.id, {
        name: contract.employerName,
        hours: contract.hoursPerWeek,
      });
    } else {
      daysWithoutContract += 1;
    }
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
  const previous = monthKey(addMonthsOnly(monthStart, -1));
  const next = monthKey(addMonthsOnly(monthStart, 1));
  const contractList = [...contractsInMonth.values()];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{formatMonthNl(monthStart)}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            {contractList.length === 0 ? (
              <span>Geen contract in deze maand</span>
            ) : (
              <span>
                {contractList
                  .map((item) => `${item.name} · ${item.hours} uur per week`)
                  .join(" → ")}
              </span>
            )}
            {maand === currentMonth && <Badge tone="blue">deze maand</Badge>}
            {contractList.length > 1 && (
              <Badge tone="amber">contractwissel binnen deze maand</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/maand/${previous}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ← Vorige
          </Link>
          <Link
            href={`/maand/${currentMonth}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Deze maand
          </Link>
          <Link
            href={`/maand/${next}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Volgende →
          </Link>
        </div>
      </div>

      <MonthCalendar
        key={maand}
        month={maand}
        today={now}
        entries={monthEntries}
        kinderen={children}
        leaveTypes={leaveTypes}
        balances={balances}
        hoursPerWorkdayByDate={hoursPerWorkdayByDate}
        daysWithoutContract={daysWithoutContract}
      />

      {contractList.length > 1 && (
        <p className="text-sm text-[var(--muted)]">
          Deze maand loopt over een contractwissel. Elke verlofdag wordt berekend met
          het contract dat op díe dag gold, dus het aantal uren per verlofdag verschilt
          binnen de maand.
        </p>
      )}
    </div>
  );
}
