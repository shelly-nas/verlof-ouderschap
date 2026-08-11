"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteContract, saveContract } from "@/lib/actions";
import { hasPayslipData } from "@/lib/netsalary";
import type { ContractDto, LeaveTypeDto } from "@/lib/queries";
import { Alert, Card, Field, inputClass } from "./ui";

/**
 * Contractformulier inclusief de bovenwettelijke afspraken per verlofsoort.
 * Wie niets aanvullends heeft, laat het hele blok leeg: dan geldt puur de
 * UWV-regeling.
 */
export function ContractForm({
  contract,
  leaveTypes,
}: {
  contract: ContractDto | null;
  leaveTypes: LeaveTypeDto[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [showSupplements, setShowSupplements] = useState(
    (contract?.supplements.length ?? 0) > 0,
  );
  const [showPayslip, setShowPayslip] = useState(
    contract !== null && hasPayslipData(contract),
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(form: FormData) {
    setErrors([]);
    startTransition(async () => {
      const result = await saveContract(contract?.id ?? null, form);
      if (result.ok) {
        router.push("/contracten");
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  function onDelete() {
    if (!contract) return;
    if (!confirm(`Contract "${contract.employerName}" verwijderen?`)) return;
    setErrors([]);
    startTransition(async () => {
      const result = await deleteContract(contract.id);
      if (result.ok) {
        router.push("/contracten");
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  const supplementFor = (leaveTypeId: string) =>
    contract?.supplements.find((item) => item.leaveTypeId === leaveTypeId);

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      {errors.length > 0 && (
        <Alert tone="error" title="Opslaan is niet gelukt">
          <ul className="list-inside list-disc">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card title="Gegevens">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Werkgever">
            <input
              name="employerName"
              className={inputClass}
              defaultValue={contract?.employerName ?? ""}
              required
            />
          </Field>
          <Field
            label="E-mailadres werkgever"
            hint="Hiernaartoe gaat de verlofmelding."
          >
            <input
              name="employerEmail"
              type="email"
              className={inputClass}
              defaultValue={contract?.employerEmail ?? ""}
              required
            />
          </Field>
          <Field label="Contracturen per week" hint="Bijvoorbeeld 40 of 32.">
            <input
              name="hoursPerWeek"
              type="number"
              step="0.5"
              min="1"
              max="60"
              className={inputClass}
              defaultValue={contract?.hoursPerWeek ?? 40}
              required
            />
          </Field>
          <Field
            label="Bruto maandsalaris"
            hint="Basis voor het dagloon (maandsalaris ÷ 21,75)."
          >
            <input
              name="grossMonthlySalary"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              defaultValue={contract?.grossMonthlySalary ?? ""}
              required
            />
          </Field>
          <Field label="Startdatum">
            <input
              name="startDate"
              type="date"
              className={inputClass}
              defaultValue={contract?.startDate ?? ""}
              required
            />
          </Field>
          <Field label="Einddatum" hint="Leeg laten als dit je huidige contract is.">
            <input
              name="endDate"
              type="date"
              className={inputClass}
              defaultValue={contract?.endDate ?? ""}
            />
          </Field>
          <Field label="Notities" className="sm:col-span-2">
            <textarea
              name="notes"
              rows={2}
              className={inputClass}
              defaultValue={contract?.notes ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Loonstrook"
        description="Neem de posten van je loonstrook over; dan rekent de app je nettoloon uit, ook in een maand met verlof. Laat je dit leeg, dan blijft het bij een bruto-indicatie."
        action={
          <button
            type="button"
            onClick={() => setShowPayslip((value) => !value)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            {showPayslip ? "Verbergen" : "Invullen"}
          </button>
        }
      >
        {showPayslip ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pensioenpremie (%)" hint="Percentage van de premiegrondslag.">
              <input
                name="pensionPercent"
                type="number"
                step="0.001"
                min="0"
                className={inputClass}
                defaultValue={contract?.pensionPercent ?? ""}
                placeholder="7,5"
              />
            </Field>
            <Field label="Premiegrondslag pensioen" hint="Bruto minus de franchise.">
              <input
                name="pensionBase"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                defaultValue={contract?.pensionBase ?? ""}
                placeholder="3964,33"
              />
            </Field>

            <Field label="WGA Hiaat Plus (%)">
              <input
                name="wgaPercent"
                type="number"
                step="0.001"
                min="0"
                className={inputClass}
                defaultValue={contract?.wgaPercent ?? ""}
                placeholder="0,144"
              />
            </Field>
            <Field label="Grondslag WGA Hiaat Plus">
              <input
                name="wgaBase"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                defaultValue={contract?.wgaBase ?? ""}
                placeholder="5562,00"
              />
            </Field>

            <Field label="WIA Excedent" hint="Vast bedrag per maand.">
              <input
                name="wiaExcedent"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                defaultValue={contract?.wiaExcedent ?? ""}
                placeholder="7,79"
              />
            </Field>
            <Field
              label="Bruto kostentoeslag"
              hint="Telt mee in het brutoloon en het heffingsloon."
            >
              <input
                name="grossExpenseAllowance"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                defaultValue={contract?.grossExpenseAllowance ?? ""}
                placeholder="80,00"
              />
            </Field>

            <Field label="Bijtelling (%)" hint="Percentage van de cataloguswaarde.">
              <input
                name="bijtellingPercent"
                type="number"
                step="0.001"
                min="0"
                className={inputClass}
                defaultValue={contract?.bijtellingPercent ?? ""}
                placeholder="12"
              />
            </Field>
            <Field label="Cataloguswaarde auto" hint="Jaarbedrag; wordt per maand verdeeld.">
              <input
                name="bijtellingBase"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                defaultValue={contract?.bijtellingBase ?? ""}
                placeholder="39865,00"
              />
            </Field>

            <Field
              label="Onkostenvergoeding"
              hint="Netto vergoeding; hierover wordt geen loonheffing berekend."
            >
              <input
                name="netExpenseAllowance"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                defaultValue={contract?.netExpenseAllowance ?? ""}
                placeholder="65,00"
              />
            </Field>

            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                name="applyTaxCredits"
                defaultChecked={contract?.applyTaxCredits ?? true}
                className="h-4 w-4"
              />
              Loonheffingskorting toegepast bij deze werkgever
            </label>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Geen loonstrookgegevens ingevuld — de app toont alleen bruto bedragen.
          </p>
        )}
      </Card>

      <Card
        title="Aanvullende arbeidsvoorwaarden"
        description="Alleen invullen als je werkgever méér biedt dan de wettelijke UWV-regeling. Laat je dit leeg, dan gelden de UWV-regels."
        action={
          <button
            type="button"
            onClick={() => setShowSupplements((value) => !value)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            {showSupplements ? "Verbergen" : "Invullen"}
          </button>
        }
      >
        {showSupplements ? (
          <div className="flex flex-col gap-4">
            {leaveTypes.map((leaveType) => {
              const supplement = supplementFor(leaveType.id);
              return (
                <fieldset
                  key={leaveType.id}
                  className="rounded-lg border border-[var(--border)] p-4"
                >
                  <legend className="px-1 text-sm font-medium">{leaveType.name}</legend>
                  <input
                    type="hidden"
                    name="supplementLeaveTypeId"
                    value={leaveType.id}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      label="Aanvullen tot (%)"
                      hint={
                        leaveType.payer === "UWV"
                          ? `UWV betaalt ${leaveType.payPercent ?? 0}%.`
                          : leaveType.payer === "UNPAID"
                            ? "Wettelijk onbetaald."
                            : "Wettelijk volledig doorbetaald."
                      }
                    >
                      <input
                        name={`topUpToPercent_${leaveType.id}`}
                        type="number"
                        step="1"
                        min="0"
                        max="200"
                        className={inputClass}
                        defaultValue={supplement?.topUpToPercent ?? ""}
                      />
                    </Field>
                    <Field label="Extra weken" hint="Bovenop het wettelijke recht.">
                      <input
                        name={`extraWeeks_${leaveType.id}`}
                        type="number"
                        step="0.5"
                        min="0"
                        className={inputClass}
                        defaultValue={supplement?.extraWeeks ?? ""}
                      />
                    </Field>
                    <Field
                      label="Ruimere termijn (maanden)"
                      hint="Leeg = wettelijke deadline."
                    >
                      <input
                        name={`deadlineOverrideMonths_${leaveType.id}`}
                        type="number"
                        step="1"
                        min="0"
                        className={inputClass}
                        defaultValue={supplement?.deadlineOverrideMonths ?? ""}
                      />
                    </Field>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`topUpUncapped_${leaveType.id}`}
                      defaultChecked={supplement?.topUpUncapped ?? true}
                      className="h-4 w-4"
                    />
                    Aanvulling over het volledige dagloon (ook boven het maximumdagloon)
                  </label>
                  <Field label="Notitie" className="mt-3">
                    <input
                      name={`supplementNotes_${leaveType.id}`}
                      className={inputClass}
                      defaultValue={supplement?.notes ?? ""}
                      placeholder="Bijvoorbeeld: cao artikel 12.3"
                    />
                  </Field>
                </fieldset>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Geen aanvullende voorwaarden ingesteld — de wettelijke UWV-regeling geldt.
          </p>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Bezig…" : "Opslaan"}
        </button>
        {contract && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
          >
            Verwijderen
          </button>
        )}
      </div>
    </form>
  );
}
