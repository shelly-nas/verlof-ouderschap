"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteLeaveType, saveLeaveType } from "@/lib/actions";
import type { LeaveTypeDto } from "@/lib/queries";
import { Alert, Badge, Card, Field, inputClass } from "./ui";

const payerLabels = {
  EMPLOYER: "Werkgever",
  UWV: "UWV",
  UNPAID: "Onbetaald",
} as const;

const anchorLabels = {
  WEEKS_AFTER_BIRTH: "weken na geboorte",
  MONTHS_AFTER_BIRTH: "maanden na geboorte",
  YEARS_AFTER_BIRTH: "jaar na geboorte",
  NONE: "geen deadline",
} as const;

export function SettingsManager({ leaveTypes }: { leaveTypes: LeaveTypeDto[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; errors?: string[] }>) {
    setErrors([]);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setEditing(null);
        setAdding(false);
        router.refresh();
      } else {
        setErrors(result.errors ?? ["Er ging iets mis."]);
      }
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
        title="Verlofsoorten"
        description="De wettelijke soorten volgen de UWV-regels; daarvan zijn alleen naam en kleur aanpasbaar. Eigen soorten kun je volledig instellen."
        action={
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            {adding ? "Annuleren" : "Eigen soort toevoegen"}
          </button>
        }
      >
        {adding && (
          <form
            action={(form) => run(() => saveLeaveType(null, form))}
            className="mb-5 grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-3"
          >
            <Field label="Naam" className="sm:col-span-3">
              <input name="name" className={inputClass} required />
            </Field>
            <Field label="Aantal weken" hint="× je contracturen per week">
              <input
                name="weeksMultiplier"
                type="number"
                step="0.5"
                min="0"
                className={inputClass}
                defaultValue="1"
                required
              />
            </Field>
            <Field label="Betaald door">
              <select name="payer" className={inputClass} defaultValue="UNPAID">
                <option value="EMPLOYER">Werkgever</option>
                <option value="UWV">UWV</option>
                <option value="UNPAID">Onbetaald</option>
              </select>
            </Field>
            <Field label="Percentage" hint="Leeg bij onbetaald verlof.">
              <input
                name="payPercent"
                type="number"
                step="1"
                min="0"
                max="100"
                className={inputClass}
              />
            </Field>
            <Field label="Deadline ten opzichte van geboorte">
              <select name="deadlineAnchor" className={inputClass} defaultValue="NONE">
                <option value="NONE">Geen deadline</option>
                <option value="WEEKS_AFTER_BIRTH">Weken na geboorte</option>
                <option value="MONTHS_AFTER_BIRTH">Maanden na geboorte</option>
                <option value="YEARS_AFTER_BIRTH">Jaar na geboorte</option>
              </select>
            </Field>
            <Field label="Termijn" hint="Aantal weken, maanden of jaren.">
              <input
                name="deadlineValue"
                type="number"
                step="1"
                min="0"
                className={inputClass}
              />
            </Field>
            <Field label="Kleur">
              <input
                name="colorHex"
                type="color"
                className={`${inputClass} h-10 p-1`}
                defaultValue="#0ea5e9"
              />
            </Field>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Toevoegen
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-3">
          {leaveTypes.map((leaveType) =>
            editing === leaveType.id ? (
              <form
                key={leaveType.id}
                action={(form) => run(() => saveLeaveType(leaveType.id, form))}
                className="grid gap-3 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-3"
              >
                <Field label="Naam" className="sm:col-span-2">
                  <input
                    name="name"
                    className={inputClass}
                    defaultValue={leaveType.name}
                    required
                  />
                </Field>
                <Field label="Kleur">
                  <input
                    name="colorHex"
                    type="color"
                    className={`${inputClass} h-10 p-1`}
                    defaultValue={leaveType.colorHex ?? "#64748b"}
                  />
                </Field>

                {leaveType.isStatutory ? (
                  <p className="text-sm text-[var(--muted)] sm:col-span-3">
                    Dit is een wettelijke regeling; weken, percentage en deadline liggen
                    vast op het UWV-niveau. Bovenwettelijke afspraken leg je vast bij het
                    contract.
                  </p>
                ) : (
                  <>
                    <Field label="Aantal weken">
                      <input
                        name="weeksMultiplier"
                        type="number"
                        step="0.5"
                        min="0"
                        className={inputClass}
                        defaultValue={leaveType.weeksMultiplier}
                        required
                      />
                    </Field>
                    <Field label="Betaald door">
                      <select
                        name="payer"
                        className={inputClass}
                        defaultValue={leaveType.payer}
                      >
                        <option value="EMPLOYER">Werkgever</option>
                        <option value="UWV">UWV</option>
                        <option value="UNPAID">Onbetaald</option>
                      </select>
                    </Field>
                    <Field label="Percentage">
                      <input
                        name="payPercent"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        className={inputClass}
                        defaultValue={leaveType.payPercent ?? ""}
                      />
                    </Field>
                    <Field label="Deadline">
                      <select
                        name="deadlineAnchor"
                        className={inputClass}
                        defaultValue={leaveType.deadlineAnchor}
                      >
                        <option value="NONE">Geen deadline</option>
                        <option value="WEEKS_AFTER_BIRTH">Weken na geboorte</option>
                        <option value="MONTHS_AFTER_BIRTH">Maanden na geboorte</option>
                        <option value="YEARS_AFTER_BIRTH">Jaar na geboorte</option>
                      </select>
                    </Field>
                    <Field label="Termijn">
                      <input
                        name="deadlineValue"
                        type="number"
                        step="1"
                        min="0"
                        className={inputClass}
                        defaultValue={leaveType.deadlineValue ?? ""}
                      />
                    </Field>
                  </>
                )}

                <div className="flex gap-2 sm:col-span-3">
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
                </div>
              </form>
            ) : (
              <div
                key={leaveType.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {leaveType.colorHex && (
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: leaveType.colorHex }}
                      />
                    )}
                    <span className="font-medium">{leaveType.name}</span>
                    {leaveType.isStatutory ? (
                      <Badge tone="blue">wettelijk</Badge>
                    ) : (
                      <Badge tone="neutral">eigen</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {leaveType.weeksMultiplier} × weekuren ·{" "}
                    {payerLabels[leaveType.payer]}
                    {leaveType.payPercent !== null && ` ${leaveType.payPercent}%`}
                    {leaveType.deadlineAnchor !== "NONE" &&
                      ` · ${leaveType.deadlineValue} ${anchorLabels[leaveType.deadlineAnchor]}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(leaveType.id)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                  >
                    Bewerken
                  </button>
                  {!leaveType.isStatutory && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${leaveType.name}" verwijderen?`)) {
                          run(() => deleteLeaveType(leaveType.id));
                        }
                      }}
                      disabled={pending}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
                    >
                      Verwijderen
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}
