import { SettingsManager } from "@/components/SettingsManager";
import { Card } from "@/components/ui";
import { formatDateNl } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { getLeaveTypes, getMaxDaglonen } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InstellingenPage() {
  const [leaveTypes, maxDaglonen] = await Promise.all([
    getLeaveTypes(),
    getMaxDaglonen(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Instellingen</h1>
      <SettingsManager leaveTypes={leaveTypes} />

      <Card
        title="Maximumdagloon"
        description="UWV keert nooit meer uit dan 70% van dit bedrag. Berekeningen gebruiken de waarde die gold op de verlofdag zelf. Nieuwe bedragen komen via de seed in de database."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="py-2 font-medium">Geldig vanaf</th>
                <th className="py-2 text-right font-medium">Maximumdagloon</th>
                <th className="py-2 text-right font-medium">70% daarvan</th>
              </tr>
            </thead>
            <tbody>
              {maxDaglonen.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2">{formatDateNl(row.validFrom)}</td>
                  <td className="py-2 text-right tabular-nums">{formatEuro(row.amount)}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--muted)]">
                    {formatEuro(row.amount * 0.7)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
