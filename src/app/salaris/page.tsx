import Link from "next/link";
import { Alert, Card, EmptyState, Stat } from "@/components/ui";
import { addMonthsOnly, formatMonthNl, monthKey, today } from "@/lib/dates";
import { formatEuro, formatHoursNumber, formatPercent } from "@/lib/money";
import { getAppData } from "@/lib/queries";
import { type MonthImpact, monthImpact } from "@/lib/salary";

export const dynamic = "force-dynamic";

export default async function SalarisPage({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string }>;
}) {
  const { maand } = await searchParams;
  const now = today();
  const month = /^\d{4}-\d{2}$/.test(maand ?? "") ? maand! : monthKey(now);

  const { contracts, leaveTypes, supplements, entries, maxDaglonen } = await getAppData();

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">Salaris</h1>
        <EmptyState title="Nog geen contract">
          Voeg een contract toe onder{" "}
          <Link href="/contracten" className="underline">
            Contracten
          </Link>
          .
        </EmptyState>
      </div>
    );
  }

  let impact: ReturnType<typeof monthImpact> | null = null;
  let error: string | null = null;
  try {
    impact = monthImpact({
      month,
      entries,
      contracts,
      leaveTypes,
      supplements,
      maxDaglonen,
    });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const previous = monthKey(addMonthsOnly(`${month}-01`, -1));
  const next = monthKey(addMonthsOnly(`${month}-01`, 1));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold capitalize">
            {formatMonthNl(`${month}-01`)}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {impact?.net
              ? "Indicatie op basis van je loonstrook; vakantiegeld en eenmalige posten blijven buiten beschouwing."
              : "Bruto-indicatie. Vul de loonstrookgegevens bij je contract in om ook netto te zien."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/salaris?maand=${previous}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ← Vorige
          </Link>
          <Link
            href={`/salaris?maand=${monthKey(now)}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Deze maand
          </Link>
          <Link
            href={`/salaris?maand=${next}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Volgende →
          </Link>
        </div>
      </div>

      {error && (
        <Alert tone="error" title="Berekening mislukt">
          {error}
        </Alert>
      )}

      {impact && (
        <>
          {impact.entriesWithoutContract > 0 && (
            <Alert tone="warning">
              {impact.entriesWithoutContract} verlofdag(en) in deze maand vallen buiten
              elke contractperiode en zijn niet meegerekend.
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {impact.net ? (
              <>
                <Stat
                  label="Netto zonder verlof"
                  value={formatEuro(impact.net.normal.netPayout)}
                  hint="Zoals een normale maand"
                />
                <Stat
                  label="Netto deze maand"
                  value={formatEuro(impact.net.actual.netPayout)}
                  hint={`${formatHoursNumber(impact.leaveHours)} uur verlof`}
                />
                <Stat
                  label="Netto verschil"
                  value={formatEuro(impact.net.netDifference)}
                  tone={impact.net.netDifference < -0.005 ? "negative" : "neutral"}
                  hint={
                    impact.net.netDifference < -0.005
                      ? `Bruto scheelt ${formatEuro(Math.abs(impact.difference))}`
                      : "Geen inkomensverlies"
                  }
                />
                <Stat
                  label="Waarvan UWV"
                  value={formatEuro(impact.uwvBenefit)}
                  hint={
                    impact.cappedByMaxDagloon
                      ? "Gemaximeerd op het maximumdagloon"
                      : "70% van je dagloon"
                  }
                />
              </>
            ) : (
              <>
                <Stat
                  label="Zonder verlof"
                  value={formatEuro(impact.normalGross)}
                  hint="Bruto maandsalaris"
                />
                <Stat
                  label="Verwacht bruto"
                  value={formatEuro(impact.totalReceived)}
                  hint={`${formatHoursNumber(impact.leaveHours)} uur verlof`}
                />
                <Stat
                  label="Verschil"
                  value={formatEuro(impact.difference)}
                  tone={impact.difference < -0.005 ? "negative" : "neutral"}
                  hint={
                    impact.difference < -0.005
                      ? "Minder inkomen deze maand"
                      : "Geen inkomensverlies"
                  }
                />
                <Stat
                  label="Waarvan UWV"
                  value={formatEuro(impact.uwvBenefit)}
                  hint={
                    impact.cappedByMaxDagloon
                      ? "Gemaximeerd op het maximumdagloon"
                      : "70% van je dagloon"
                  }
                />
              </>
            )}
          </div>

          {impact.cappedByMaxDagloon && (
            <Alert tone="info" title="Je uitkering is gemaximeerd">
              Je dagloon ligt boven het wettelijk maximumdagloon. UWV rekent 70% over dat
              maximum, niet over je eigen loon — je ontvangt dus effectief minder dan 70%
              van je salaris.
            </Alert>
          )}

          {impact.lines.length === 0 ? (
            <EmptyState title="Geen verlof in deze maand">
              Voer verlof in via{" "}
              <Link href="/maand" className="underline">
                Maand invoeren
              </Link>
              .
            </EmptyState>
          ) : (
            <Card title="Opbouw">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                      <th className="py-2 font-medium">Verlofsoort</th>
                      <th className="py-2 text-right font-medium">Uren</th>
                      <th className="py-2 text-right font-medium">Dagen</th>
                      <th className="py-2 text-right font-medium">Werkgever</th>
                      <th className="py-2 text-right font-medium">UWV</th>
                      <th className="py-2 text-right font-medium">Aanvulling</th>
                      <th className="py-2 text-right font-medium">Gemist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.lines.map((line) => (
                      <tr
                        key={line.leaveTypeId}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="py-2">
                          {line.leaveTypeName}
                          {line.cappedByMaxDagloon && (
                            <span className="ml-2 text-xs text-[var(--muted)]">
                              (gemaximeerd)
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatHoursNumber(line.hours)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatHoursNumber(line.dayEquivalents)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(line.employerPaid)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(line.uwvBenefit)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(line.employerTopUp)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                          {line.loss > 0.005 ? `− ${formatEuro(line.loss)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border)] font-medium">
                      <td className="py-2">Loon over gewerkte dagen</td>
                      <td colSpan={5} />
                      <td className="py-2 text-right tabular-nums">
                        {formatEuro(impact.workedGross)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="py-2">Totaal bruto</td>
                      <td colSpan={5} />
                      <td className="py-2 text-right tabular-nums">
                        {formatEuro(impact.totalReceived)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {impact.net && renderPayslip(impact.net, impact.difference)}
        </>
      )}
    </div>
  );
}

/** De loonstrook van deze maand naast een normale maand. */
function renderPayslip(net: NonNullable<MonthImpact["net"]>, grossDifference: number) {
  return (
            <Card
              title="Loonstrook"
              description="Zo ziet de maand er netto uit, met het verlof verwerkt."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                      <th className="py-2 font-medium">Post</th>
                      <th className="py-2 text-right font-medium">Grondslag</th>
                      <th className="py-2 text-right font-medium">Deze maand</th>
                      <th className="py-2 text-right font-medium">Normaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]">
                      <td className="py-2">Salaris</td>
                      <td />
                      <td className="py-2 text-right tabular-nums">
                        {formatEuro(net.actual.baseSalary)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                        {formatEuro(net.normal.baseSalary)}
                      </td>
                    </tr>

                    {net.actual.grossExpenseAllowance > 0 && (
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2">Bruto kostentoeslag</td>
                        <td />
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(net.actual.grossExpenseAllowance)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                          {formatEuro(net.normal.grossExpenseAllowance)}
                        </td>
                      </tr>
                    )}

                    {net.actual.deductions.map((line, index) => (
                      <tr key={line.label} className="border-b border-[var(--border)]">
                        <td className="py-2">
                          {line.label}
                          {line.percent !== undefined && (
                            <span className="ml-2 text-xs text-[var(--muted)]">
                              {line.percent}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                          {line.base !== undefined ? formatEuro(line.base) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(line.amount)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                          {formatEuro(net.normal.deductions[index]?.amount ?? 0)}
                        </td>
                      </tr>
                    ))}

                    {net.actual.bijtelling > 0 && (
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2">Bijtelling</td>
                        <td />
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(net.actual.bijtelling)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                          {formatEuro(net.normal.bijtelling)}
                        </td>
                      </tr>
                    )}

                    <tr className="border-b border-[var(--border)] font-medium">
                      <td className="py-2">Heffingsloon</td>
                      <td />
                      <td className="py-2 text-right tabular-nums">
                        {formatEuro(net.actual.taxableIncome)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                        {formatEuro(net.normal.taxableIncome)}
                      </td>
                    </tr>

                    <tr className="border-b border-[var(--border)]">
                      <td className="py-2">
                        Loonbelasting/premie volksverzekeringen
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          {formatPercent(net.actual.effectiveTaxRate * 100)}
                        </span>
                      </td>
                      <td />
                      <td className="py-2 text-right tabular-nums">
                        − {formatEuro(net.actual.payrollTax)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                        − {formatEuro(net.normal.payrollTax)}
                      </td>
                    </tr>

                    <tr className="border-b border-[var(--border)] font-medium">
                      <td className="py-2">Nettoloon</td>
                      <td />
                      <td className="py-2 text-right tabular-nums">
                        {formatEuro(net.actual.netSalary)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                        {formatEuro(net.normal.netSalary)}
                      </td>
                    </tr>

                    {net.actual.netExpenseAllowance > 0 && (
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2">Onkostenvergoeding</td>
                        <td />
                        <td className="py-2 text-right tabular-nums">
                          {formatEuro(net.actual.netExpenseAllowance)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                          {formatEuro(net.normal.netExpenseAllowance)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border)] font-semibold">
                      <td className="py-2">Netto te ontvangen</td>
                      <td />
                      <td className="py-2 text-right tabular-nums">
                        {formatEuro(net.actual.netPayout)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                        {formatEuro(net.normal.netPayout)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {net.netDifference < -0.005 && (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Je ontvangt {formatEuro(Math.abs(net.netDifference))} minder netto dan
                  normaal, terwijl je bruto {formatEuro(Math.abs(grossDifference))}
                  {" "}misloopt — het verschil zit in de lagere loonheffing.
                </p>
              )}
            </Card>
  );
}
