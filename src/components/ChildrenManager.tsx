"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteChild, saveChild } from "@/lib/actions";
import { formatDateNl, today } from "@/lib/dates";
import type { ChildDto } from "@/lib/queries";
import { Alert, Card, EmptyState, Field, inputClass } from "./ui";

function ageDescription(dateOfBirth: string, now: string): string {
  if (dateOfBirth > now) return "verwacht";
  const years = Number(now.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  const hadBirthday = now.slice(5) >= dateOfBirth.slice(5);
  const age = hadBirthday ? years : years - 1;
  return age === 0 ? "jonger dan 1 jaar" : `${age} jaar`;
}

export function ChildrenManager({ kinderen }: { kinderen: ChildDto[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const now = today();

  function onSubmit(childId: string | null, form: FormData) {
    setErrors([]);
    startTransition(async () => {
      const result = await saveChild(childId, form);
      if (result.ok) {
        setEditing(null);
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  function onDelete(child: ChildDto) {
    if (!confirm(`${child.name} verwijderen?`)) return;
    setErrors([]);
    startTransition(async () => {
      const result = await deleteChild(child.id);
      if (result.ok) router.refresh();
      else setErrors(result.errors);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {errors.length > 0 && (
        <Alert tone="error" title="Er ging iets mis">
          <ul className="list-inside list-disc">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card
        title="Kind toevoegen"
        description="Verlofrechten en deadlines worden per kind berekend vanaf de geboortedatum."
      >
        <form
          action={(form) => onSubmit(null, form)}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Naam" className="min-w-48 flex-1">
            <input name="name" className={inputClass} required />
          </Field>
          <Field label="Geboortedatum" className="min-w-48">
            <input name="dateOfBirth" type="date" className={inputClass} required />
          </Field>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Toevoegen
          </button>
        </form>
      </Card>

      {kinderen.length === 0 ? (
        <EmptyState title="Nog geen kinderen">
          Voeg een kind toe om verlofrechten te berekenen.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {kinderen.map((child) =>
            editing === child.id ? (
              <Card key={child.id}>
                <form
                  action={(form) => onSubmit(child.id, form)}
                  className="flex flex-wrap items-end gap-3"
                >
                  <Field label="Naam" className="min-w-48 flex-1">
                    <input
                      name="name"
                      className={inputClass}
                      defaultValue={child.name}
                      required
                    />
                  </Field>
                  <Field label="Geboortedatum" className="min-w-48">
                    <input
                      name="dateOfBirth"
                      type="date"
                      className={inputClass}
                      defaultValue={child.dateOfBirth}
                      required
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Opslaan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    Annuleren
                  </button>
                </form>
              </Card>
            ) : (
              <Card key={child.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{child.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      Geboren {formatDateNl(child.dateOfBirth)} ·{" "}
                      {ageDescription(child.dateOfBirth, now)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(child.id)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                    >
                      Bewerken
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(child)}
                      disabled={pending}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
