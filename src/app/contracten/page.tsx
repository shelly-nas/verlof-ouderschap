import Link from "next/link";
import { Alert, Badge, Card, EmptyState } from "@/components/ui";
import { findContractOverlaps } from "@/lib/contracts";
import { formatDateNl, today } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { getContracts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ContractenPage() {
  const contracts = await getContracts();
  const now = today();
  const overlaps = findContractOverlaps(contracts);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contracten</h1>
          <p className="text-sm text-[var(--muted)]">
            Je verlofrecht wordt berekend met de contracturen die golden op de
            geboortedatum van je kind.
          </p>
        </div>
        <Link
          href="/contracten/nieuw"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Nieuw contract
        </Link>
      </div>

      {overlaps.length > 0 && (
        <Alert tone="warning" title="Overlappende contractperiodes">
          <ul className="list-inside list-disc">
            {overlaps.map((overlap) => (
              <li key={`${overlap.a.id}-${overlap.b.id}`}>{overlap.message}</li>
            ))}
          </ul>
          <p className="mt-1">
            Bij overlap gebruikt de app het contract met de laatste startdatum.
          </p>
        </Alert>
      )}

      {contracts.length === 0 ? (
        <EmptyState title="Nog geen contracten">
          Voeg je contract toe om verlof te kunnen invoeren.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => {
            const isCurrent =
              contract.startDate <= now &&
              (contract.endDate === null || contract.endDate >= now);
            return (
              <Card key={contract.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{contract.employerName}</h2>
                      {isCurrent && <Badge tone="green">Huidig contract</Badge>}
                      {contract.supplements.length > 0 && (
                        <Badge tone="violet">Aanvullende voorwaarden</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDateNl(contract.startDate)} –{" "}
                      {contract.endDate ? formatDateNl(contract.endDate) : "heden"}
                    </p>
                    <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                      <div>
                        <dt className="text-[var(--muted)]">Contracturen</dt>
                        <dd className="font-medium">{contract.hoursPerWeek} uur per week</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Bruto maandsalaris</dt>
                        <dd className="font-medium">
                          {formatEuro(contract.grossMonthlySalary)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Dagloon</dt>
                        <dd className="font-medium">
                          {formatEuro(contract.grossMonthlySalary / 21.75)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">E-mail</dt>
                        <dd className="font-medium">{contract.employerEmail}</dd>
                      </div>
                    </dl>
                    {contract.notes && (
                      <p className="mt-3 text-sm text-[var(--muted)]">{contract.notes}</p>
                    )}
                  </div>
                  <Link
                    href={`/contracten/${contract.id}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                  >
                    Bewerken
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
