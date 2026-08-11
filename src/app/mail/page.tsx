import Link from "next/link";
import { MailPreview } from "@/components/MailPreview";
import { Alert, EmptyState } from "@/components/ui";
import { activeContract } from "@/lib/contracts";
import {
  addMonthsOnly,
  formatMonthNl,
  monthKey,
  startOfMonth,
  today,
} from "@/lib/dates";
import { buildLeaveEmail, daysUntilDeadline, reportingMonthFor } from "@/lib/mailto";
import { getAppData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string }>;
}) {
  const { maand } = await searchParams;
  const now = today();
  const monthStart = /^\d{4}-\d{2}$/.test(maand ?? "")
    ? startOfMonth(`${maand}-01`)
    : reportingMonthFor(now);

  const { contracts, children, leaveTypes, entries } = await getAppData();
  const contract = activeContract(contracts, now);

  if (!contract) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">Verlof melden</h1>
        <EmptyState title="Nog geen contract">
          Het e-mailadres van je werkgever staat bij het contract. Voeg er een toe onder{" "}
          <Link href="/contracten" className="underline">
            Contracten
          </Link>
          .
        </EmptyState>
      </div>
    );
  }

  const mail = buildLeaveEmail({
    employerName: contract.employerName,
    employerEmail: contract.employerEmail,
    entries,
    children,
    leaveTypes,
    monthStart,
  });

  const daysLeft = daysUntilDeadline(now);
  const isNextMonth = monthStart === reportingMonthFor(now);
  const previous = monthKey(addMonthsOnly(monthStart, -1));
  const next = monthKey(addMonthsOnly(monthStart, 1));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Verlof melden voor {formatMonthNl(monthStart)}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Naar {contract.employerName} · {contract.employerEmail}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/mail?maand=${previous}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            ← Vorige
          </Link>
          <Link
            href={`/mail?maand=${monthKey(reportingMonthFor(now))}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Volgende maand
          </Link>
          <Link
            href={`/mail?maand=${next}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Volgende →
          </Link>
        </div>
      </div>

      {isNextMonth &&
        (daysLeft > 0 ? (
          <Alert tone="info">
            Nog {daysLeft} dag{daysLeft === 1 ? "" : "en"} om deze melding vóór de 15e te
            versturen.
          </Alert>
        ) : daysLeft === 0 ? (
          <Alert tone="warning">Vandaag is de 15e: verstuur de melding vandaag nog.</Alert>
        ) : (
          <Alert tone="warning">
            De 15e is {Math.abs(daysLeft)} dag{Math.abs(daysLeft) === 1 ? "" : "en"}{" "}
            geleden verstreken.
          </Alert>
        ))}

      {mail.entryCount === 0 && (
        <Alert tone="info">
          Er staat nog geen verlof in {formatMonthNl(monthStart)}. Voer het in via{" "}
          <Link href="/week" className="underline">
            Week invoeren
          </Link>{" "}
          — de mail vult zichzelf dan aan. Je kunt de melding ook zo versturen om te laten
          weten dat je geen verlof opneemt.
        </Alert>
      )}

      <MailPreview mail={mail} />

      <p className="text-sm text-[var(--muted)]">
        De knop opent je eigen mailprogramma met een ingevuld concept. Je verstuurt de
        mail zelf, dus je kunt hem eerst nog aanpassen.
      </p>
    </div>
  );
}
