"use client";

import { useState } from "react";
import type { MailResult } from "@/lib/mailto";
import { Alert, Card } from "./ui";

export function MailPreview({ mail }: { mail: MailResult }) {
  const [copied, setCopied] = useState(false);

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(`${mail.subject}\n\n${mail.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {mail.tooLong && (
        <Alert tone="warning" title="Deze mail is te lang voor een mailto-link">
          Mailprogramma&apos;s kappen lange links af. Kopieer de tekst en plak die in een
          nieuwe mail.
        </Alert>
      )}

      <Card
        title="Voorbeeld"
        description={`Aan ${mail.to} · onderwerp: ${mail.subject}`}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyBody}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              {copied ? "Gekopieerd" : "Kopiëren"}
            </button>
            {!mail.tooLong && (
              <a
                href={mail.href}
                className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white"
              >
                Mail opstellen
              </a>
            )}
          </div>
        }
      >
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
          {mail.body}
        </pre>
      </Card>
    </div>
  );
}
