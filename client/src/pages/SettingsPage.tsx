import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Fragment, useState } from "react";
import { useThemeMode } from "../ThemeModeProvider";
import { ApiError, api, errorMessage, useApi } from "../api/client";
import type { DeadlineAnchor, LeaveType, Payer } from "../api/types";
import { useToast } from "../components/Toast";
import {
  BusyButton,
  ColorDot,
  ConfirmDialog,
  ErrorAlert,
  ErrorState,
  PageHeader,
  PageSkeleton,
  SectionCard,
  StatusBadge,
} from "../components/ui";
import { formatHoursNumber } from "../lib/money";

const payerLabels: Record<Payer, string> = { EMPLOYER: "Werkgever", UWV: "UWV", UNPAID: "Onbetaald" };

const anchorLabels: Record<DeadlineAnchor, string> = {
  WEEKS_AFTER_BIRTH: "weken na de geboorte",
  MONTHS_AFTER_BIRTH: "maanden na de geboorte",
  YEARS_AFTER_BIRTH: "jaar na de geboorte",
  NONE: "geen deadline",
};

function describe(type: LeaveType): string {
  const parts = [
    `${formatHoursNumber(type.weeksMultiplier)} × weekuren`,
    `${payerLabels[type.payer]}${type.payPercent !== null && type.payer !== "UNPAID" ? ` ${formatHoursNumber(type.payPercent)}%` : ""}`,
  ];
  parts.push(
    type.deadlineAnchor === "NONE" ? "geen deadline" : `t/m ${type.deadlineValue} ${anchorLabels[type.deadlineAnchor]}`,
  );
  return parts.join(" · ");
}

type Form = {
  name: string;
  colorHex: string;
  weeksMultiplier: string;
  payer: Payer;
  payPercent: string;
  deadlineAnchor: DeadlineAnchor;
  deadlineValue: string;
};

function LeaveTypeDialog({
  type,
  onClose,
  onSaved,
}: {
  type: LeaveType | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<Form>({
    name: type?.name ?? "",
    colorHex: type?.colorHex ?? "#0ea5e9",
    weeksMultiplier: type ? String(type.weeksMultiplier).replace(".", ",") : "1",
    payer: type?.payer ?? "UNPAID",
    payPercent: type?.payPercent != null ? String(type.payPercent) : "",
    deadlineAnchor: type?.deadlineAnchor ?? "NONE",
    deadlineValue: type?.deadlineValue != null ? String(type.deadlineValue) : "",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const statutory = type?.isStatutory ?? false;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fieldError = (key: keyof Form) => ({ error: Boolean(fieldErrors[key]), helperText: fieldErrors[key] });

  async function save() {
    setSaving(true);
    setErrors([]);
    setFieldErrors({});
    try {
      const result = type ? await api.put(`/leave-types/${type.id}`, form) : await api.post("/leave-types", form);
      onSaved(result.message ?? "Opgeslagen");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setFieldErrors(error.fieldErrors);
      else setErrors([errorMessage(error)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <DialogTitle>{type ? `${type.name} bewerken` : "Eigen verlofsoort toevoegen"}</DialogTitle>
        <DialogContent>
          <ErrorAlert title="Opslaan is niet gelukt" errors={errors} />
          <Stack spacing={6} sx={{ pt: 2 }}>
            <Box sx={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 96px" }}>
              <TextField label="Naam" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus required {...fieldError("name")} />
              <TextField
                label="Kleur"
                type="color"
                value={form.colorHex}
                onChange={(e) => set("colorHex", e.target.value)}
                slotProps={{ htmlInput: { style: { padding: 4, cursor: "pointer" }, "aria-label": "Kleur in de kalender" } }}
              />
            </Box>

            {statutory ? (
              <Alert severity="info">
                Dit is een wettelijke regeling: weken, betaling en deadline volgen het UWV. Bovenwettelijke afspraken
                van je werkgever leg je vast bij het contract.
              </Alert>
            ) : (
              <Box sx={{ display: "grid", gap: 6, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
                <TextField
                  label="Aantal weken"
                  value={form.weeksMultiplier}
                  onChange={(e) => set("weeksMultiplier", e.target.value)}
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                  {...fieldError("weeksMultiplier")}
                  helperText={fieldErrors.weeksMultiplier ?? "Keer je contracturen per week."}
                />
                <TextField select label="Betaald door" value={form.payer} onChange={(e) => set("payer", e.target.value as Payer)}>
                  {Object.entries(payerLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Percentage van het dagloon"
                  value={form.payPercent}
                  onChange={(e) => set("payPercent", e.target.value)}
                  disabled={form.payer === "UNPAID"}
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                  {...fieldError("payPercent")}
                  helperText={fieldErrors.payPercent ?? (form.payer === "UNPAID" ? "Niet van toepassing bij onbetaald verlof." : undefined)}
                />
                <Box />
                <TextField
                  select
                  label="Deadline"
                  value={form.deadlineAnchor}
                  onChange={(e) => set("deadlineAnchor", e.target.value as DeadlineAnchor)}
                >
                  <MenuItem value="NONE">Geen deadline</MenuItem>
                  <MenuItem value="WEEKS_AFTER_BIRTH">Weken na de geboorte</MenuItem>
                  <MenuItem value="MONTHS_AFTER_BIRTH">Maanden na de geboorte</MenuItem>
                  <MenuItem value="YEARS_AFTER_BIRTH">Jaar na de geboorte</MenuItem>
                </TextField>
                <TextField
                  label="Termijn"
                  value={form.deadlineValue}
                  onChange={(e) => set("deadlineValue", e.target.value)}
                  disabled={form.deadlineAnchor === "NONE"}
                  slotProps={{ htmlInput: { inputMode: "numeric" } }}
                  {...fieldError("deadlineValue")}
                  helperText={fieldErrors.deadlineValue ?? "Aantal weken, maanden of jaren."}
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose} disabled={saving}>
            Annuleren
          </Button>
          <BusyButton type="submit" variant="contained" busy={saving} busyLabel="Opslaan…">
            {type ? "Opslaan" : "Toevoegen"}
          </BusyButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function Appearance() {
  const { preference, setPreference } = useThemeMode();
  return (
    <SectionCard title="Weergave" description="Standaard volgt de app de instelling van je apparaat.">
      <ToggleButtonGroup
        exclusive
        value={preference ?? "system"}
        onChange={(_event, value) => value && setPreference(value === "system" ? null : value)}
        aria-label="Thema"
        sx={{ "& .MuiToggleButton-root": { minHeight: 44, px: 4, textTransform: "none", fontWeight: 600 } }}
      >
        <ToggleButton value="system">Systeem</ToggleButton>
        <ToggleButton value="light">Licht</ToggleButton>
        <ToggleButton value="dark">Donker</ToggleButton>
      </ToggleButtonGroup>
    </SectionCard>
  );
}

export function SettingsPage() {
  const { data, error, loading, reload } = useApi<LeaveType[]>("/leave-types");
  const toast = useToast();
  const [editing, setEditing] = useState<LeaveType | "new" | null>(null);
  const [deleting, setDeleting] = useState<LeaveType | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (loading && !data) return <PageSkeleton cards={2} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setErrors([]);
    try {
      await api.delete(`/leave-types/${deleting.id}`);
      toast(`${deleting.name} verwijderd`);
      reload();
    } catch (caught) {
      setErrors([errorMessage(caught)]);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader title="Instellingen" />
      <Stack spacing={6}>
        <Appearance />

        <SectionCard
          title="Verlofsoorten"
          description="De wettelijke soorten volgen de UWV-regels; daarvan pas je alleen naam en kleur aan. Eigen soorten stel je volledig zelf in."
          action={
            <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setEditing("new")}>
              Eigen soort
            </Button>
          }
        >
          <ErrorAlert title="Verwijderen is niet gelukt" errors={errors} />
          <Box sx={{ mx: -6, mb: -6 }}>
            {data.map((type) => (
              <Fragment key={type.id}>
                <Divider />
                <Box sx={{ display: "flex", alignItems: "center", gap: 4, px: 6, py: 4 }}>
                  <ColorDot color={type.colorHex} size={12} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{type.name}</Typography>
                      {type.isStatutory ? (
                        <StatusBadge tone="info">Wettelijk</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Eigen</StatusBadge>
                      )}
                    </Box>
                    <Typography variant="body2">{describe(type)}</Typography>
                  </Box>
                  <Tooltip title="Bewerken">
                    <IconButton aria-label={`${type.name} bewerken`} onClick={() => setEditing(type)} sx={{ width: 44, height: 44 }}>
                      <EditRounded />
                    </IconButton>
                  </Tooltip>
                  {!type.isStatutory && (
                    <Tooltip title="Verwijderen">
                      <IconButton
                        aria-label={`${type.name} verwijderen`}
                        onClick={() => setDeleting(type)}
                        sx={{ width: 44, height: 44, "&:hover": { color: "error.main" } }}
                      >
                        <DeleteOutlineRounded />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Fragment>
            ))}
          </Box>
        </SectionCard>
      </Stack>

      {editing !== null && (
        <LeaveTypeDialog
          type={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            toast(message);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ""} verwijderen?`}
        confirmLabel="Verwijderen"
        busyLabel="Verwijderen…"
        destructive
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        Dit kan alleen als er geen verlof op deze soort geboekt staat. Het verwijderen kan niet ongedaan worden
        gemaakt.
      </ConfirmDialog>
    </>
  );
}
