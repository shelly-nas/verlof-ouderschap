import AddRounded from "@mui/icons-material/AddRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ChildCareRounded from "@mui/icons-material/ChildCareRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, errorMessage, useApi } from "../api/client";
import type { LeaveType, MonthResponse } from "../api/types";
import { MonthCalendar } from "../components/MonthCalendar";
import { useToast } from "../components/Toast";
import { UnsavedChangesGuard } from "../components/UnsavedChangesGuard";
import {
  ColorDot,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  ErrorState,
  MonthNav,
  PageHeader,
  SaveBar,
  SectionCard,
  StatusBadge,
} from "../components/ui";
import {
  type DateOnly,
  addMonthsOnly,
  capitalize,
  formatDayLong,
  formatMonthNl,
  monthKey,
  today as todayInAmsterdam,
} from "../lib/dates";
import { formatHoursNumber, parseHoursInput } from "../lib/money";
import {
  type Row,
  addRow,
  fillMonth,
  fillWeekday,
  isDirty,
  projectBalances,
  rowKey,
  rowsFromEntries,
  setHours,
  toggleDay,
} from "../lib/monthRows";

const MONTH = /^\d{4}-\d{2}$/;

const WEEKDAY_BUTTONS = [
  { day: 1, label: "ma", name: "maandag" },
  { day: 2, label: "di", name: "dinsdag" },
  { day: 3, label: "wo", name: "woensdag" },
  { day: 4, label: "do", name: "donderdag" },
  { day: 5, label: "vr", name: "vrijdag" },
];

/** Keuzechip voor een verlofsoort: kleur plus vinkje en ring als hij gekozen is. */
function LeaveTypeChip({ type, selected, onSelect }: { type: LeaveType; selected: boolean; onSelect: () => void }) {
  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={(theme) => ({
        minHeight: 44,
        px: 4,
        gap: 2,
        borderRadius: "8px",
        border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
        boxShadow: selected ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none",
        bgcolor: selected ? "primary.light" : "background.paper",
        color: selected ? "primary.main" : "text.primary",
        fontSize: 14,
        fontWeight: 600,
        transition: "border-color .15s ease, background-color .15s ease",
        "&:hover": { borderColor: selected ? theme.palette.primary.main : theme.palette.text.secondary },
        "&.Mui-focusVisible": { boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.primary.main}` },
      })}
    >
      {selected ? <CheckRounded sx={{ fontSize: 18 }} aria-hidden /> : <ColorDot color={type.colorHex} />}
      {type.name}
    </ButtonBase>
  );
}

/** Detail van één dag: andere uren, of een tweede verlofsoort op dezelfde dag. */
function DayDialog({
  date,
  rows,
  data,
  activeChildId,
  fullDayHours,
  onChangeHours,
  onRemove,
  onAdd,
  onClose,
}: {
  date: DateOnly | null;
  rows: Row[];
  data: MonthResponse;
  activeChildId: string;
  fullDayHours: number;
  onChangeHours: (row: Row, hours: number) => void;
  onRemove: (row: Row) => void;
  onAdd: (leaveTypeId: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => setDrafts({}), [date]);

  const leaveTypeById = new Map(data.leaveTypes.map((type) => [type.id, type]));
  const multipleChildren = data.children.length > 1;
  const available = data.leaveTypes.filter(
    (type) => !rows.some((row) => row.leaveTypeId === type.id && row.childId === activeChildId),
  );

  return (
    <Dialog open={date !== null} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{date ? capitalize(formatDayLong(date)) : ""}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 6 }}>
          Een volledige dag is {formatHoursNumber(fullDayHours)} uur. Wijzigingen tellen mee zodra je de maand opslaat.
        </Typography>

        {rows.length === 0 ? (
          <Typography variant="body2">Nog geen verlof op deze dag. Voeg hieronder een verlofsoort toe.</Typography>
        ) : (
          <Stack spacing={4}>
            {rows.map((row) => {
              const type = leaveTypeById.get(row.leaveTypeId);
              const child = data.children.find((item) => item.id === row.childId);
              const key = rowKey(row);
              const draft = drafts[key] ?? formatHoursNumber(row.hours);
              const invalid = parseHoursInput(draft) === null || (parseHoursInput(draft) ?? 0) > 24;
              return (
                <Box key={key} sx={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
                  <Box sx={{ flex: 1, minWidth: 0, pt: "10px", display: "flex", alignItems: "center", gap: 2 }}>
                    <ColorDot color={type?.colorHex ?? null} />
                    <Typography sx={{ fontWeight: 600, color: "text.primary", fontSize: 14 }} noWrap>
                      {type?.name}
                    </Typography>
                    {multipleChildren && child && <Typography variant="body2">{child.name}</Typography>}
                  </Box>
                  <TextField
                    value={draft}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDrafts((current) => ({ ...current, [key]: value }));
                      const parsed = parseHoursInput(value);
                      if (parsed !== null && parsed > 0 && parsed <= 24) onChangeHours(row, parsed);
                    }}
                    error={invalid}
                    helperText={invalid ? "Tussen 0 en 24 uur" : undefined}
                    sx={{ width: 120, flex: "none" }}
                    slotProps={{
                      htmlInput: {
                        inputMode: "decimal",
                        "aria-label": `Uren ${type?.name ?? ""}`,
                        style: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
                      },
                      input: { endAdornment: <InputAdornment position="end">uur</InputAdornment> },
                    }}
                  />
                  <Tooltip title="Verwijderen">
                    <IconButton aria-label={`${type?.name ?? "Verlof"} verwijderen`} onClick={() => onRemove(row)} sx={{ width: 44, height: 44 }}>
                      <DeleteOutlineRounded />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Stack>
        )}

        {available.length > 0 && (
          <Box sx={{ mt: 8 }}>
            <Typography variant="overline" component="p" sx={{ mb: 3 }}>
              Toevoegen
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {available.map((type) => (
                <Button key={type.id} variant="outlined" startIcon={<AddRounded />} onClick={() => onAdd(type.id)}>
                  {type.name}
                </Button>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Klaar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CalendarSkeleton() {
  return (
    <Box aria-busy aria-label="Laden">
      <Skeleton variant="rounded" width={240} height={32} />
      <Skeleton variant="rounded" width={320} height={20} sx={{ mt: 2, mb: 8, maxWidth: "100%" }} />
      <Skeleton variant="rounded" height={120} sx={{ mb: 6 }} />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} variant="rounded" sx={{ height: { xs: 68, sm: 104 } }} />
        ))}
      </Box>
    </Box>
  );
}

function MonthEditor({ data, reload }: { data: MonthResponse; reload: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { month } = data;

  const [rows, setRows] = useState<Row[]>(() => rowsFromEntries(data.entries));
  const [activeLeaveTypeId, setActiveLeaveTypeId] = useState(data.leaveTypes[0]?.id ?? "");
  const [activeChildId, setActiveChildId] = useState(data.children[0]?.id ?? "");
  const [selectedDay, setSelectedDay] = useState<DateOnly | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  // Na opslaan of kopiëren komt er nieuwe data: dat is de nieuwe uitgangssituatie.
  useEffect(() => setRows(rowsFromEntries(data.entries)), [data.entries]);

  const dirty = isDirty(rows, data.entries);

  const leaveTypeById = useMemo(() => new Map(data.leaveTypes.map((type) => [type.id, type])), [data.leaveTypes]);
  const rowsByDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) map.set(row.date, [...(map.get(row.date) ?? []), row]);
    return map;
  }, [rows]);

  const isBookable = useCallback(
    (date: DateOnly) => date.startsWith(month) && data.hoursPerWorkdayByDate[date] !== undefined,
    [month, data.hoursPerWorkdayByDate],
  );
  const fullDayHours = (date: DateOnly) => data.hoursPerWorkdayByDate[date] ?? 8;

  const onToggle = useCallback(
    (date: DateOnly) => {
      if (!activeLeaveTypeId || !activeChildId) return;
      setRows((current) =>
        toggleDay(current, {
          date,
          childId: activeChildId,
          leaveTypeId: activeLeaveTypeId,
          hours: data.hoursPerWorkdayByDate[date] ?? 8,
        }),
      );
    },
    [activeChildId, activeLeaveTypeId, data.hoursPerWorkdayByDate],
  );

  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
  const projections = projectBalances(rows, data.entries, data.balances);
  const previousLabel = formatMonthNl(addMonthsOnly(`${month}-01`, -1));
  const monthLabel = formatMonthNl(`${month}-01`);

  async function save() {
    setErrors([]);
    setSaving(true);
    try {
      await api.put(`/months/${month}`, { rows: rows.filter((row) => row.hours > 0) });
      toast("Maand opgeslagen");
      reload();
    } catch (error) {
      setErrors(error instanceof ApiError ? error.errors : [errorMessage(error)]);
      toast("Opslaan is niet gelukt", "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevious() {
    setErrors([]);
    setCopying(true);
    try {
      await api.post(`/months/${month}/copy-previous`);
      setCopyOpen(false);
      toast(`${capitalize(previousLabel)} gekopieerd`);
      reload();
    } catch (error) {
      setCopyOpen(false);
      setErrors(error instanceof ApiError ? error.errors : [errorMessage(error)]);
    } finally {
      setCopying(false);
    }
  }

  const goTo = (target: string) => navigate(`/maand/${target}`);
  const currentMonth = monthKey(data.today);

  return (
    <>
      <PageHeader
        title={capitalize(monthLabel)}
        subtitle={
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            <span>
              {data.contracts.length === 0
                ? "Geen contract in deze maand"
                : data.contracts
                    .map((item) => `${item.employerName} · ${formatHoursNumber(item.hoursPerWeek)} uur per week`)
                    .join(" → ")}
            </span>
            {data.contracts.length > 1 && <StatusBadge tone="warning">Contractwissel</StatusBadge>}
          </Box>
        }
        actions={
          <MonthNav
            onPrevious={() => goTo(monthKey(addMonthsOnly(`${month}-01`, -1)))}
            onNext={() => goTo(monthKey(addMonthsOnly(`${month}-01`, 1)))}
            onToday={() => goTo(currentMonth)}
            isCurrent={month === currentMonth}
          />
        }
      />

      <ErrorAlert title="Opslaan is niet gelukt" errors={errors} />

      {data.contracts.length === 0 ? (
        <EmptyState
          icon={<WorkRounded />}
          title="Geen contract in deze maand"
          action={
            <Button component={RouterLink} to="/contracten" variant="contained">
              Naar contracten
            </Button>
          }
        >
          Zonder contract is niet te bepalen hoeveel uur een verlofdag is. Voeg een contract toe dat deze maand dekt.
        </EmptyState>
      ) : data.children.length === 0 ? (
        <EmptyState
          icon={<ChildCareRounded />}
          title="Nog geen kinderen"
          action={
            <Button component={RouterLink} to="/kinderen" variant="contained">
              Kind toevoegen
            </Button>
          }
        >
          Verlof wordt per kind geboekt. Voeg eerst je kind toe.
        </EmptyState>
      ) : (
        <Stack spacing={6}>
          {data.daysWithoutContract > 0 && (
            <Alert severity="warning">
              {data.daysWithoutContract} {data.daysWithoutContract === 1 ? "dag valt" : "dagen vallen"} in deze maand
              buiten elke contractperiode; daarop kun je geen verlof boeken.
            </Alert>
          )}

          <Card>
            <CardContent>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-end" }}>
                <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", mb: 2 }} id="active-type-label">
                    Klik op een dag om neer te zetten
                  </Typography>
                  <Box role="group" aria-labelledby="active-type-label" sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    {data.leaveTypes.map((type) => (
                      <LeaveTypeChip
                        key={type.id}
                        type={type}
                        selected={type.id === activeLeaveTypeId}
                        onSelect={() => setActiveLeaveTypeId(type.id)}
                      />
                    ))}
                  </Box>
                </Box>
                {data.children.length > 1 && (
                  <TextField
                    select
                    label="Voor"
                    value={activeChildId}
                    onChange={(event) => setActiveChildId(event.target.value)}
                    sx={{ width: 200 }}
                  >
                    {data.children.map((child) => (
                      <MenuItem key={child.id} value={child.id}>
                        {child.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mt: 6 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    setRows(fillMonth(data.hoursPerWorkdayByDate, month, activeChildId, activeLeaveTypeId))
                  }
                >
                  Hele maand
                </Button>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} role="group" aria-label="Elke weekdag vullen">
                  <Typography variant="body2" sx={{ mx: 1 }}>
                    Elke
                  </Typography>
                  {WEEKDAY_BUTTONS.map((item) => (
                    <Tooltip key={item.day} title={`Elke ${item.name} in ${monthLabel}`}>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ minWidth: 40, px: 2 }}
                        aria-label={`Elke ${item.name} vullen`}
                        onClick={() =>
                          setRows((current) =>
                            fillWeekday(current, data.hoursPerWorkdayByDate, month, item.day, activeChildId, activeLeaveTypeId),
                          )
                        }
                      >
                        {item.label}
                      </Button>
                    </Tooltip>
                  ))}
                </Box>
                <Box sx={{ display: "flex", gap: 1, ml: { md: "auto" } }}>
                  <Button variant="text" size="small" onClick={() => setCopyOpen(true)}>
                    {capitalize(previousLabel)} kopiëren
                  </Button>
                  <Button variant="text" size="small" onClick={() => setRows([])} disabled={rows.length === 0}>
                    Leegmaken
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 6 }, "&:last-child": { pb: { xs: 3, sm: 6 } } }}>
              <MonthCalendar
                month={month}
                today={data.today}
                rowsByDate={rowsByDate}
                leaveTypeById={leaveTypeById}
                isBookable={isBookable}
                onToggle={onToggle}
                onOpen={setSelectedDay}
              />
              <Box
                sx={{
                  mt: 4,
                  px: { xs: 2, sm: 0 },
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="body2">
                  Klik op een dag voor een volledige verlofdag; nog een klik haalt hem weg. Klik op de uren voor
                  afwijkende uren of een tweede verlofsoort.
                </Typography>
                <Typography sx={{ fontSize: 14, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>
                  Totaal <strong>{formatHoursNumber(totalHours)} uur</strong>
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {projections.length > 0 && (
            <SectionCard
              title={dirty ? "Saldo na opslaan" : "Saldo"}
              description="Wat er overblijft van je recht met het verlof zoals het nu in de kalender staat."
            >
              <Stack spacing={3}>
                {projections.map((projection) => (
                  <Box
                    key={projection.key}
                    sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", fontSize: 14 }}
                  >
                    <ColorDot color={projection.balance.colorHex} />
                    <Typography sx={{ fontWeight: 600, color: "text.primary", fontSize: 14 }}>
                      {projection.balance.leaveTypeName}
                    </Typography>
                    {data.children.length > 1 && (
                      <Typography variant="body2">{projection.balance.childName}</Typography>
                    )}
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", ml: { sm: "auto" } }}>
                      Nog {formatHoursNumber(Math.max(0, projection.remaining))} van{" "}
                      {formatHoursNumber(projection.balance.entitledHours)} uur
                    </Typography>
                    {projection.overBooked > 0 && (
                      <StatusBadge tone="error">{formatHoursNumber(projection.overBooked)} uur te veel</StatusBadge>
                    )}
                    {projection.afterDeadline && <StatusBadge tone="warning">Na de deadline</StatusBadge>}
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          <SaveBar
            visible={dirty}
            detail={`Totaal ${formatHoursNumber(totalHours)} uur`}
            saveLabel="Maand opslaan"
            saving={saving}
            onSave={save}
            onDiscard={() => {
              setRows(rowsFromEntries(data.entries));
              setErrors([]);
            }}
          />
        </Stack>
      )}

      <DayDialog
        date={selectedDay}
        rows={selectedDay ? (rowsByDate.get(selectedDay) ?? []) : []}
        data={data}
        activeChildId={activeChildId}
        fullDayHours={selectedDay ? fullDayHours(selectedDay) : 8}
        onChangeHours={(row, hours) => setRows((current) => setHours(current, row, hours))}
        onRemove={(row) => setRows((current) => setHours(current, row, 0))}
        onAdd={(leaveTypeId) =>
          selectedDay &&
          setRows((current) =>
            addRow(current, { date: selectedDay, childId: activeChildId, leaveTypeId, hours: fullDayHours(selectedDay) }),
          )
        }
        onClose={() => setSelectedDay(null)}
      />

      <ConfirmDialog
        open={copyOpen}
        title={`${capitalize(previousLabel)} kopiëren?`}
        confirmLabel="Kopiëren"
        busyLabel="Kopiëren…"
        busy={copying}
        onConfirm={copyPrevious}
        onClose={() => setCopyOpen(false)}
      >
        Het verlof van {previousLabel} komt op dezelfde dagen van de maand in {monthLabel}. Wat nu in {monthLabel}{" "}
        staat, wordt vervangen{dirty ? ", ook je niet-opgeslagen wijzigingen" : ""}.
      </ConfirmDialog>

      {/* Niet stilletjes wijzigingen weggooien bij wegnavigeren of sluiten. */}
      <UnsavedChangesGuard when={dirty && !saving}>
        Je hebt het verlof in {monthLabel} aangepast maar nog niet opgeslagen. Als je deze pagina verlaat, ben je die
        wijzigingen kwijt.
      </UnsavedChangesGuard>
    </>
  );
}

export function MonthPage() {
  const params = useParams();
  const month = params.maand && MONTH.test(params.maand) ? params.maand : monthKey(todayInAmsterdam());
  const { data, error, loading, reload } = useApi<MonthResponse>(`/months/${month}`);

  if (params.maand && !MONTH.test(params.maand)) {
    return (
      <EmptyState
        title="Onbekende maand"
        action={
          <Button component={RouterLink} to="/maand" variant="contained">
            Naar deze maand
          </Button>
        }
      >
        Een maand staat in het adres als jjjj-mm, bijvoorbeeld /maand/2026-10.
      </EmptyState>
    );
  }
  if ((loading && data?.month !== month) || (!data && !error)) return <CalendarSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  return <MonthEditor key={data.month} data={data} reload={reload} />;
}
