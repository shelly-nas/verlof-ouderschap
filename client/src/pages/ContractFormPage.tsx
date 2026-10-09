import WorkRounded from "@mui/icons-material/WorkRounded";
import {
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, errorMessage, useApi } from "../api/client";
import type { Contract, LeaveType } from "../api/types";
import { useToast } from "../components/Toast";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import {
  ColorDot,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  ErrorState,
  PageHeader,
  PageSkeleton,
  SaveBar,
  SectionCard,
} from "../components/ui";

const PAYSLIP_FIELDS = [
  "pensionPercent",
  "pensionBase",
  "wgaPercent",
  "wgaBase",
  "wiaExcedent",
  "grossExpenseAllowance",
  "bijtellingPercent",
  "bijtellingBase",
  "netExpenseAllowance",
] as const;

type PayslipField = (typeof PAYSLIP_FIELDS)[number];

type SupplementForm = { topUpToPercent: string; extraWeeks: string; deadlineOverrideMonths: string; notes: string };

type Form = {
  employerName: string;
  employerEmail: string;
  hoursPerWeek: string;
  grossMonthlySalary: string;
  startDate: string;
  endDate: string;
  notes: string;
  applyTaxCredits: boolean;
  usePayslip: boolean;
  useSupplements: boolean;
  supplements: Record<string, SupplementForm>;
} & Record<PayslipField, string>;

/** Getallen tonen zoals je ze typt: met een komma. */
function text(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

function initialForm(contract: Contract | null, leaveTypes: LeaveType[]): Form {
  const supplements: Record<string, SupplementForm> = {};
  for (const type of leaveTypes) {
    const supplement = contract?.supplements.find((item) => item.leaveTypeId === type.id);
    supplements[type.id] = {
      topUpToPercent: text(supplement?.topUpToPercent),
      extraWeeks: text(supplement?.extraWeeks),
      deadlineOverrideMonths: text(supplement?.deadlineOverrideMonths),
      notes: supplement?.notes ?? "",
    };
  }
  const payslip = Object.fromEntries(PAYSLIP_FIELDS.map((field) => [field, text(contract?.[field])])) as Record<
    PayslipField,
    string
  >;

  return {
    employerName: contract?.employerName ?? "",
    employerEmail: contract?.employerEmail ?? "",
    hoursPerWeek: contract ? text(contract.hoursPerWeek) : "40",
    grossMonthlySalary: text(contract?.grossMonthlySalary),
    startDate: contract?.startDate ?? "",
    endDate: contract?.endDate ?? "",
    notes: contract?.notes ?? "",
    applyTaxCredits: contract?.applyTaxCredits ?? true,
    usePayslip: PAYSLIP_FIELDS.some((field) => payslip[field] !== ""),
    useSupplements: (contract?.supplements.length ?? 0) > 0,
    supplements,
    ...payslip,
  };
}

function toPayload(form: Form, leaveTypes: LeaveType[]) {
  const payslip = Object.fromEntries(
    PAYSLIP_FIELDS.map((field) => [field, form.usePayslip ? form[field] : null]),
  );
  return {
    employerName: form.employerName,
    employerEmail: form.employerEmail,
    hoursPerWeek: form.hoursPerWeek,
    grossMonthlySalary: form.grossMonthlySalary,
    startDate: form.startDate,
    endDate: form.endDate,
    notes: form.notes,
    applyTaxCredits: form.applyTaxCredits,
    ...payslip,
    supplements: form.useSupplements
      ? leaveTypes.map((type) => ({ leaveTypeId: type.id, ...form.supplements[type.id] }))
      : [],
  };
}

/** Velden in twee kolommen op desktop, één op mobiel. */
function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 6, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
      {children}
    </Box>
  );
}

function ContractForm({ contract, leaveTypes }: { contract: Contract | null; leaveTypes: LeaveType[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const initial = useMemo(() => initialForm(contract, leaveTypes), [contract, leaveTypes]);
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const isNew = contract === null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setSupplement = (leaveTypeId: string, key: keyof SupplementForm, value: string) =>
    setForm((current) => ({
      ...current,
      supplements: { ...current.supplements, [leaveTypeId]: { ...current.supplements[leaveTypeId], [key]: value } },
    }));

  /** Props voor een tekstveld: waarde, wijziging en de fout van de server eronder. */
  const field = (key: keyof Form & string, hint?: string) => ({
    value: form[key] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => set(key, event.target.value as never),
    error: Boolean(fieldErrors[key]),
    helperText: fieldErrors[key] ?? hint,
    name: key,
  });
  const decimal = { htmlInput: { inputMode: "decimal" as const } };
  const euro = { ...decimal, input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } };
  const percent = { ...decimal, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } };

  async function save() {
    setErrors([]);
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = toPayload(form, leaveTypes);
      const result = isNew ? await api.post("/contracts", payload) : await api.put(`/contracts/${contract.id}`, payload);
      toast(result.message ?? "Contract opgeslagen");
      setLeaving(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        // Fouten die niet bij een zichtbaar veld horen, komen bovenaan.
        setErrors(Object.keys(error.fieldErrors).length > 0 ? ["Controleer de gemarkeerde velden."] : error.errors);
      } else {
        setErrors([errorMessage(error)]);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  // Pas navigeren als de bewaker uit staat, anders vraagt hij om bevestiging.
  useEffect(() => {
    if (leaving) navigate("/contracten");
  }, [leaving, navigate]);

  async function remove() {
    if (!contract) return;
    setDeleting(true);
    try {
      await api.delete(`/contracts/${contract.id}`);
      toast("Contract verwijderd");
      setLeaving(true);
    } catch (error) {
      setDeleteOpen(false);
      setErrors(error instanceof ApiError ? error.errors : [errorMessage(error)]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: "/contracten", label: "Contracten" }}
        title={isNew ? "Nieuw contract" : contract.employerName}
        subtitle="Wijzigingen gelden na opslaan."
      />

      <ErrorAlert title="Opslaan is niet gelukt" errors={errors} />

      <Stack
        spacing={6}
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <SectionCard title="Gegevens" description="Hiermee rekent de app je verlofrecht, dagloon en inkomen uit.">
          <FieldGrid>
            <TextField label="Werkgever" required autoComplete="organization" {...field("employerName")} />
            <TextField
              label="E-mailadres werkgever"
              type="email"
              required
              autoComplete="email"
              {...field("employerEmail", "Hiernaartoe gaat de verlofmelding.")}
            />
            <TextField
              label="Contracturen per week"
              required
              slotProps={{ ...decimal, input: { endAdornment: <InputAdornment position="end">uur</InputAdornment> } }}
              {...field("hoursPerWeek", "Bijvoorbeeld 40 of 32.")}
            />
            <TextField
              label="Bruto maandsalaris"
              required
              slotProps={euro}
              {...field("grossMonthlySalary", "Basis voor het dagloon (maandsalaris ÷ 21,75).")}
            />
            <TextField label="Startdatum" type="date" required {...field("startDate")} />
            <TextField
              label="Einddatum (optioneel)"
              type="date"
              {...field("endDate", "Leeg laten als dit je huidige contract is.")}
            />
            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <TextField
                label="Notities (optioneel)"
                multiline
                minRows={2}
                {...field("notes")}
                helperText={fieldErrors.notes ?? `${form.notes.length} / 500`}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            </Box>
          </FieldGrid>
        </SectionCard>

        <SectionCard
          title="Loonstrook"
          description="Neem de posten van je loonstrook over; dan rekent de app je nettoloon uit, ook in een maand met verlof. Zonder deze posten blijft het bij een bruto-indicatie."
          action={
            <FormControlLabel
              control={<Switch checked={form.usePayslip} onChange={(event) => set("usePayslip", event.target.checked)} />}
              label="Netto berekenen"
              sx={{ m: 0, gap: 3, minHeight: 44 }}
            />
          }
        >
          {form.usePayslip ? (
            <FieldGrid>
              <TextField label="Pensioenpremie" slotProps={percent} {...field("pensionPercent", "Percentage van de premiegrondslag.")} />
              <TextField label="Premiegrondslag pensioen" slotProps={euro} {...field("pensionBase", "Bruto minus de franchise.")} />
              <TextField label="WGA Hiaat Plus (optioneel)" slotProps={percent} {...field("wgaPercent")} />
              <TextField label="Grondslag WGA Hiaat Plus (optioneel)" slotProps={euro} {...field("wgaBase")} />
              <TextField label="WIA Excedent (optioneel)" slotProps={euro} {...field("wiaExcedent", "Vast bedrag per maand.")} />
              <TextField
                label="Bruto kostentoeslag (optioneel)"
                slotProps={euro}
                {...field("grossExpenseAllowance", "Telt mee in het brutoloon en het heffingsloon.")}
              />
              <TextField label="Bijtelling auto (optioneel)" slotProps={percent} {...field("bijtellingPercent", "Percentage van de cataloguswaarde.")} />
              <TextField label="Cataloguswaarde auto (optioneel)" slotProps={euro} {...field("bijtellingBase", "Jaarbedrag; wordt per maand verdeeld.")} />
              <TextField
                label="Onkostenvergoeding (optioneel)"
                slotProps={euro}
                {...field("netExpenseAllowance", "Netto; hierover wordt geen loonheffing berekend.")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.applyTaxCredits}
                    onChange={(event) => set("applyTaxCredits", event.target.checked)}
                  />
                }
                label="Loonheffingskorting toegepast bij deze werkgever"
                sx={{ m: 0, gap: 3, minHeight: 44, alignSelf: "center" }}
              />
            </FieldGrid>
          ) : (
            <Typography variant="body2">
              {initial.usePayslip
                ? "Bij opslaan worden de ingevulde loonstrookposten gewist; de app toont dan alleen bruto bedragen."
                : "Geen loonstrookgegevens: de app toont alleen bruto bedragen."}
            </Typography>
          )}
        </SectionCard>

        <SectionCard
          title="Aanvullende arbeidsvoorwaarden"
          description="Alleen nodig als je werkgever méér biedt dan de wettelijke UWV-regeling."
          action={
            <FormControlLabel
              control={
                <Switch checked={form.useSupplements} onChange={(event) => set("useSupplements", event.target.checked)} />
              }
              label="Bovenwettelijk"
              sx={{ m: 0, gap: 3, minHeight: 44 }}
            />
          }
        >
          {form.useSupplements ? (
            <Stack spacing={8}>
              {leaveTypes.map((type, index) => {
                const values = form.supplements[type.id];
                const error = (key: string) => fieldErrors[`supplements.${index}.${key}`];
                return (
                  <Box key={type.id} component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
                    <Box component="legend" sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4, p: 0 }}>
                      <ColorDot color={type.colorHex} />
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{type.name}</Typography>
                      <Typography variant="body2">
                        {type.payer === "UWV"
                          ? `UWV betaalt ${type.payPercent ?? 0}%`
                          : type.payer === "UNPAID"
                            ? "Wettelijk onbetaald"
                            : "Wettelijk volledig doorbetaald"}
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: "grid", gap: 6, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}
                    >
                      <TextField
                        label="Aanvullen tot"
                        value={values.topUpToPercent}
                        onChange={(event) => setSupplement(type.id, "topUpToPercent", event.target.value)}
                        error={Boolean(error("topUpToPercent"))}
                        helperText={error("topUpToPercent") ?? "Percentage van het dagloon."}
                        slotProps={percent}
                      />
                      <TextField
                        label="Extra weken"
                        value={values.extraWeeks}
                        onChange={(event) => setSupplement(type.id, "extraWeeks", event.target.value)}
                        error={Boolean(error("extraWeeks"))}
                        helperText={error("extraWeeks") ?? "Bovenop het wettelijke recht."}
                        slotProps={decimal}
                      />
                      <TextField
                        label="Ruimere termijn"
                        value={values.deadlineOverrideMonths}
                        onChange={(event) => setSupplement(type.id, "deadlineOverrideMonths", event.target.value)}
                        error={Boolean(error("deadlineOverrideMonths"))}
                        helperText={error("deadlineOverrideMonths") ?? "Maanden na de geboorte; leeg = wettelijk."}
                        slotProps={{ htmlInput: { inputMode: "numeric" } }}
                      />
                      <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
                        <TextField
                          label="Notitie (optioneel)"
                          value={values.notes}
                          onChange={(event) => setSupplement(type.id, "notes", event.target.value)}
                          placeholder="Bijvoorbeeld: cao artikel 12.3"
                        />
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2">Geen aanvullende voorwaarden: de wettelijke UWV-regeling geldt.</Typography>
          )}
        </SectionCard>

        {!isNew && (
          <SectionCard
            title="Contract verwijderen"
            description="Verwijderen kan alleen als er geen verlofdagen aan dit contract hangen. De afspraken en loonstrookposten verdwijnen dan ook."
          >
            <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>
              Contract verwijderen…
            </Button>
          </SectionCard>
        )}

        {/* Enter in een veld slaat op, net als de knop in de balk. */}
        <button type="submit" hidden />
      </Stack>

      <SaveBar
        visible={dirty || isNew}
        status={isNew ? "Nieuw contract" : undefined}
        saveLabel={isNew ? "Contract toevoegen" : "Wijzigingen opslaan"}
        saving={saving}
        onSave={save}
        discardLabel={isNew ? "Annuleren" : "Ongedaan maken"}
        onDiscard={() => {
          if (isNew) navigate("/contracten");
          else {
            setForm(initial);
            setErrors([]);
            setFieldErrors({});
          }
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`${contract?.employerName ?? "Contract"} verwijderen?`}
        confirmLabel="Verwijderen"
        busyLabel="Verwijderen…"
        destructive
        busy={deleting}
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      >
        Het contract en de bijbehorende afspraken worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.
      </ConfirmDialog>

      <UnsavedChangesGuard when={dirty && !saving && !leaving}>
        Je wijzigingen aan dit contract zijn nog niet opgeslagen. Als je deze pagina verlaat, ben je ze kwijt.
      </UnsavedChangesGuard>
    </>
  );
}

export function ContractFormPage() {
  const { id } = useParams();
  const leaveTypes = useApi<LeaveType[]>("/leave-types");
  const contract = useApi<Contract>(id ? `/contracts/${id}` : null);

  const loading = leaveTypes.loading || contract.loading;
  const error = leaveTypes.error ?? contract.error;

  if (loading) return <PageSkeleton cards={3} />;
  if (error?.status === 404) {
    return (
      <EmptyState
        icon={<WorkRounded />}
        title="Contract niet gevonden"
        action={
          <Button component={RouterLink} to="/contracten" variant="contained">
            Naar contracten
          </Button>
        }
      >
        Misschien is het al verwijderd.
      </EmptyState>
    );
  }
  if (error || !leaveTypes.data) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          leaveTypes.reload();
          contract.reload();
        }}
      />
    );
  }

  return <ContractForm key={id ?? "nieuw"} contract={id ? contract.data : null} leaveTypes={leaveTypes.data} />;
}
