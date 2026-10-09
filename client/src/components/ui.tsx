import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import type { ApiError } from "../api/client";

/** Paginakop: Title met muted subtekst links, acties rechts. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <Box sx={{ mb: 8 }}>
      {back && (
        <Button
          component={RouterLink}
          to={back.to}
          variant="text"
          size="small"
          startIcon={<ChevronLeftRounded />}
          sx={{ ml: -3, mb: 2 }}
        >
          {back.label}
        </Button>
      )}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" component="div" sx={{ mt: 2 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>{actions}</Box>}
      </Box>
    </Box>
  );
}

/** Kaart met een Heading, muted subtekst en optioneel een actie rechts. */
export function SectionCard({
  title,
  description,
  action,
  children,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Card id={id} component="section">
      <CardContent>
        {(title || action) && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              alignItems: "flex-start",
              justifyContent: "space-between",
              mb: 6,
            }}
          >
            <Box sx={{ minWidth: 0, flex: "1 1 240px" }}>
              {title && (
                <Typography variant="h3" component="h2">
                  {title}
                </Typography>
              )}
              {description && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {description}
                </Typography>
              )}
            </Box>
            {action}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export type Tone = "info" | "success" | "warning" | "error" | "neutral";

/** Compacte status: altijd een stip plus een woord, nooit alleen kleur. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const theme = useTheme();
  const colors = {
    info: [theme.palette.primary.main, theme.palette.info.light],
    success: [theme.palette.success.main, theme.palette.success.light],
    warning: [theme.palette.warning.main, theme.palette.warning.light],
    error: [theme.palette.error.main, theme.palette.error.light],
    neutral: [theme.palette.text.secondary, theme.palette.action.hover],
  }[tone];

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        height: 24,
        px: 2,
        borderRadius: "999px",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: colors[0],
        bgcolor: colors[1],
        "&::before": {
          content: '""',
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: "currentColor",
        },
      }}
    >
      {children}
    </Box>
  );
}

/** Kleurstip van een verlofsoort; de naam staat er altijd naast. */
export function ColorDot({ color, size = 10 }: { color: string | null; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: color ?? "text.disabled",
      }}
    />
  );
}

/** Kerngetal in een kaart. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "negative" | "positive";
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="overline" component="p">
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            color: tone === "negative" ? "error.main" : tone === "positive" ? "success.main" : "text.primary",
          }}
        >
          {value}
        </Typography>
        {hint && <Typography variant="body2">{hint}</Typography>}
      </CardContent>
    </Card>
  );
}

/** Grid van stat-tegels: vier naast elkaar op desktop, twee op tablet, één op mobiel. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 4,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
      }}
    >
      {children}
    </Box>
  );
}

/** Voortgangsbalk voor een saldo; boven 100% kleurt hij rood. */
export function Meter({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color?: string | null;
  label: string;
}) {
  const percent = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  const over = max > 0 && value > max + 0.005;
  return (
    <LinearProgress
      variant="determinate"
      value={percent}
      aria-label={label}
      sx={{ "& .MuiLinearProgress-bar": { bgcolor: over ? "error.main" : (color ?? "primary.main") } }}
    />
  );
}

/** Lege staat: kop, zin over wanneer hier iets komt, en een volgende stap. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderStyle: "dashed",
        borderRadius: "12px",
        px: 6,
        py: 12,
        textAlign: "center",
        bgcolor: "transparent",
      }}
    >
      {icon && (
        <Box sx={{ color: "text.secondary", mb: 4, "& svg": { fontSize: 40 } }} aria-hidden>
          {icon}
        </Box>
      )}
      <Typography variant="h3" component="h2">
        {title}
      </Typography>
      {children && (
        <Typography variant="body1" component="div" sx={{ mt: 2, color: "text.secondary", maxWidth: 520, mx: "auto" }}>
          {children}
        </Typography>
      )}
      {action && <Box sx={{ mt: 6, display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>{action}</Box>}
    </Paper>
  );
}

/** Foutstaat: wat er misging, geruststelling, opnieuw proberen. */
export function ErrorState({
  title = "Kan de gegevens niet laden",
  error,
  onRetry,
}: {
  title?: string;
  error: ApiError | null;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      icon={<ErrorOutlineRounded />}
      title={title}
      action={
        <Button variant="contained" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      }
    >
      {error?.message ?? "Er ging iets mis."} Je gegevens zijn veilig opgeslagen.
    </EmptyState>
  );
}

/** Skelet in de vorm van een paginakop met kaarten eronder. */
export function PageSkeleton({ tiles = 0, cards = 2 }: { tiles?: number; cards?: number }) {
  return (
    <Box aria-busy aria-label="Laden">
      <Skeleton variant="rounded" width={280} height={32} />
      <Skeleton variant="rounded" width={360} height={20} sx={{ mt: 2, mb: 8, maxWidth: "100%" }} />
      {tiles > 0 && (
        <StatGrid>
          {Array.from({ length: tiles }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={116} />
          ))}
        </StatGrid>
      )}
      <Stack spacing={6} sx={{ mt: tiles > 0 ? 6 : 0 }}>
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={180} />
        ))}
      </Stack>
    </Box>
  );
}

/** Lijst van foutmeldingen van de server. */
export function ErrorAlert({ title, errors }: { title: string; errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <Alert severity="error" sx={{ mb: 6 }}>
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: "text.primary" }}>{title}</Typography>
      {errors.length === 1 ? (
        errors[0]
      ) : (
        <Box component="ul" sx={{ m: 0, pl: 5 }}>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </Box>
      )}
    </Alert>
  );
}

/** Vorige / huidige / volgende maand. */
export function MonthNav({
  onPrevious,
  onNext,
  onToday,
  isCurrent,
}: {
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  isCurrent: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Tooltip title="Vorige maand">
        <IconButton aria-label="Vorige maand" onClick={onPrevious} sx={{ width: 44, height: 44 }}>
          <ChevronLeftRounded />
        </IconButton>
      </Tooltip>
      <Button variant="outlined" onClick={onToday} disabled={isCurrent}>
        Deze maand
      </Button>
      <Tooltip title="Volgende maand">
        <IconButton aria-label="Volgende maand" onClick={onNext} sx={{ width: 44, height: 44 }}>
          <ChevronRightRounded />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/** Bevestigingsdialoog voor destructieve of ingrijpende acties. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" sx={{ color: "text.secondary" }}>
          {children}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={busy}>
          Annuleren
        </Button>
        <BusyButton
          variant={destructive ? "outlined" : "contained"}
          color={destructive ? "error" : "primary"}
          busy={busy}
          busyLabel={busyLabel}
          onClick={onConfirm}
        >
          {confirmLabel}
        </BusyButton>
      </DialogActions>
    </Dialog>
  );
}

/** Knop met loading-state: spinner plus werkwoord met "…", niet nog eens in te drukken. */
export function BusyButton({
  busy,
  busyLabel,
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { busy: boolean; busyLabel?: string }) {
  return (
    <Button {...props} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy && <CircularProgress size={16} color="inherit" aria-hidden />}
      {busy ? (busyLabel ?? "Bezig…") : children}
    </Button>
  );
}

/**
 * Sticky balk onderaan zodra er niet-opgeslagen wijzigingen zijn: links de
 * status, rechts ongedaan maken en opslaan.
 */
export function SaveBar({
  visible,
  status = "Niet-opgeslagen wijzigingen",
  detail,
  saveLabel,
  savingLabel = "Opslaan…",
  saving,
  onSave,
  onDiscard,
  discardLabel = "Ongedaan maken",
}: {
  visible: boolean;
  status?: string;
  detail?: ReactNode;
  saveLabel: string;
  savingLabel?: string;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  discardLabel?: string;
}) {
  if (!visible) return null;
  return (
    <Paper
      role="region"
      aria-label="Opslaan"
      elevation={0}
      sx={(theme) => ({
        position: "sticky",
        bottom: { xs: 12, sm: 24 },
        zIndex: theme.zIndex.appBar,
        mt: 6,
        px: { xs: 4, sm: 6 },
        py: 3,
        borderRadius: "12px",
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === "dark" ? "none" : "0 8px 24px rgba(18,22,28,.12)",
        bgcolor: theme.palette.mode === "dark" ? "#282E39" : "background.paper",
        display: "flex",
        flexWrap: "wrap",
        gap: 3,
        alignItems: "center",
        justifyContent: "space-between",
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
        <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#F5B83D", flex: "none" }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>{status}</Typography>
        {detail && (
          <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>
            {detail}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 2, ml: "auto" }}>
        <Button variant="text" onClick={onDiscard} disabled={saving}>
          {discardLabel}
        </Button>
        <BusyButton variant="contained" busy={saving} busyLabel={savingLabel} onClick={onSave}>
          {saveLabel}
        </BusyButton>
      </Box>
    </Paper>
  );
}
