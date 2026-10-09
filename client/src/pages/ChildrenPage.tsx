import AddRounded from "@mui/icons-material/AddRounded";
import ChildCareRounded from "@mui/icons-material/ChildCareRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Fragment, useState } from "react";
import { ApiError, api, errorMessage, useApi } from "../api/client";
import type { Child, ChildrenResponse } from "../api/types";
import { useToast } from "../components/Toast";
import {
  BusyButton,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  ErrorState,
  PageHeader,
  PageSkeleton,
  StatusBadge,
} from "../components/ui";
import { formatDateNl } from "../lib/dates";

function age(dateOfBirth: string, today: string): string {
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  const value = today.slice(5) >= dateOfBirth.slice(5) ? years : years - 1;
  return value === 0 ? "Jonger dan 1 jaar" : `${value} jaar`;
}

function ChildDialog({
  child,
  open,
  onClose,
  onSaved,
}: {
  child: Child | null;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(child?.name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(child?.dateOfBirth ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  async function save() {
    setSaving(true);
    setErrors([]);
    setFieldErrors({});
    try {
      const body = { name, dateOfBirth };
      const result = child ? await api.put(`/children/${child.id}`, body) : await api.post("/children", body);
      onSaved(result.message ?? "Opgeslagen");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setFieldErrors(error.fieldErrors);
      else setErrors([errorMessage(error)]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <DialogTitle>{child ? `${child.name} bewerken` : "Kind toevoegen"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 6 }}>
            Verlofrechten en deadlines worden per kind berekend vanaf de geboortedatum. Is je kind nog niet geboren?
            Vul dan de verwachte datum in.
          </Typography>
          <ErrorAlert title="Opslaan is niet gelukt" errors={errors} />
          <Stack spacing={6}>
            <TextField
              label="Naam"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={Boolean(fieldErrors.name)}
              helperText={fieldErrors.name}
              autoFocus
              required
            />
            <TextField
              label="Geboortedatum"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              error={Boolean(fieldErrors.dateOfBirth)}
              helperText={fieldErrors.dateOfBirth ? "Kies een datum." : undefined}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose} disabled={saving}>
            Annuleren
          </Button>
          <BusyButton type="submit" variant="contained" busy={saving} busyLabel="Opslaan…">
            {child ? "Opslaan" : "Toevoegen"}
          </BusyButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function ChildrenPage() {
  const { data, error, loading, reload } = useApi<ChildrenResponse>("/children");
  const toast = useToast();
  const [editing, setEditing] = useState<Child | "new" | null>(null);
  const [deleting, setDeleting] = useState<Child | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (loading && !data) return <PageSkeleton cards={1} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setErrors([]);
    try {
      await api.delete(`/children/${deleting.id}`);
      toast(`${deleting.name} verwijderd`);
      reload();
    } catch (caught) {
      setErrors([errorMessage(caught)]);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  const add = (
    <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditing("new")}>
      Kind toevoegen
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Kinderen"
        subtitle="Per kind heb je recht op geboorte- en ouderschapsverlof."
        actions={data.children.length > 0 && add}
      />

      <ErrorAlert title="Verwijderen is niet gelukt" errors={errors} />

      {data.children.length === 0 ? (
        <EmptyState icon={<ChildCareRounded />} title="Nog geen kinderen" action={add}>
          Voeg je kind toe om verlofrechten en deadlines te berekenen.
        </EmptyState>
      ) : (
        <Card>
          {data.children.map((child, index) => (
            <Fragment key={child.id}>
              {index > 0 && <Divider />}
              <Box sx={{ display: "flex", alignItems: "center", gap: 4, px: 6, py: 4 }}>
                <Avatar aria-hidden>{child.name.charAt(0).toUpperCase()}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{child.name}</Typography>
                    {child.dateOfBirth > data.today && <StatusBadge tone="info">Verwacht</StatusBadge>}
                  </Box>
                  <Typography variant="body2">
                    {child.dateOfBirth > data.today ? "Uitgerekend op" : "Geboren"} {formatDateNl(child.dateOfBirth)}
                    {child.dateOfBirth <= data.today && ` · ${age(child.dateOfBirth, data.today)}`}
                  </Typography>
                </Box>
                <Tooltip title="Bewerken">
                  <IconButton aria-label={`${child.name} bewerken`} onClick={() => setEditing(child)} sx={{ width: 44, height: 44 }}>
                    <EditRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Verwijderen">
                  <IconButton
                    aria-label={`${child.name} verwijderen`}
                    onClick={() => setDeleting(child)}
                    sx={{ width: 44, height: 44, "&:hover": { color: "error.main" } }}
                  >
                    <DeleteOutlineRounded />
                  </IconButton>
                </Tooltip>
              </Box>
            </Fragment>
          ))}
        </Card>
      )}

      {editing !== null && (
        <ChildDialog
          open
          child={editing === "new" ? null : editing}
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
        Dit kan alleen als er geen verlof meer op dit kind staat. Het verwijderen kan niet ongedaan worden gemaakt.
      </ConfirmDialog>
    </>
  );
}
