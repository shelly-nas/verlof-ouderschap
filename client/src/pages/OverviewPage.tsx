import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import EuroRounded from "@mui/icons-material/EuroRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useApi } from "../api/client";
import type { Overview } from "../api/types";
import {
  ColorDot,
  ErrorState,
  Meter,
  PageHeader,
  PageSkeleton,
  SectionCard,
  StatGrid,
  StatTile,
  StatusBadge,
} from "../components/ui";
import { capitalize, formatDateNl, formatMonthNl } from "../lib/dates";
import { formatEuro, formatHoursNumber } from "../lib/money";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function SetupChecklist({ data }: { data: Overview }) {
  const steps = [
    {
      done: data.setup.contracts > 0,
      title: "Voeg je contract toe",
      text: "Contracturen en salaris bepalen je verlofrecht en wat het verlof kost.",
      to: "/contracten/nieuw",
      action: "Contract toevoegen",
    },
    {
      done: data.setup.children > 0,
      title: "Voeg je kind toe",
      text: "Rechten en deadlines lopen vanaf de geboortedatum.",
      to: "/kinderen",
      action: "Kind toevoegen",
    },
  ];
  const next = steps.find((step) => !step.done);

  return (
    <>
      <PageHeader title="Welkom" subtitle="Twee dingen zijn nodig voordat je verlof kunt bijhouden." />
      <Card>
        <CardContent>
          <Stack spacing={6}>
            {steps.map((step, index) => (
              <Box key={step.title} sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                {step.done ? (
                  <CheckCircleRounded sx={{ color: "success.main", mt: "2px" }} aria-hidden />
                ) : (
                  <RadioButtonUncheckedRounded sx={{ color: "text.disabled", mt: "2px" }} aria-hidden />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                      {index + 1}. {step.title}
                    </Typography>
                    {step.done && <StatusBadge tone="success">Gedaan</StatusBadge>}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {step.text}
                  </Typography>
                </Box>
                {!step.done && (
                  <Button
                    component={RouterLink}
                    to={step.to}
                    variant={step === next ? "contained" : "outlined"}
                    sx={{ display: { xs: "none", sm: "inline-flex" } }}
                  >
                    {step.action}
                  </Button>
                )}
              </Box>
            ))}
            {next && (
              <Button
                component={RouterLink}
                to={next.to}
                variant="contained"
                sx={{ display: { xs: "inline-flex", sm: "none" }, alignSelf: "flex-start" }}
              >
                {next.action}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}

const shortcuts = [
  { to: "/melden", icon: <SendRounded />, title: "Verlof melden", text: "Mail je werkgever het verlof van volgende maand." },
  { to: "/salaris", icon: <EuroRounded />, title: "Salarisimpact", text: "Je loonstrook met en zonder verlof." },
  { to: "/saldo", icon: <CalendarMonthRounded />, title: "Alle saldi", text: "Recht, opgenomen en deadlines per kind." },
];

export function OverviewPage() {
  const { data, error, loading, reload } = useApi<Overview>("/overview");

  if (loading && !data) return <PageSkeleton tiles={4} cards={1} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  if (data.setup.contracts === 0 || data.setup.children === 0) return <SetupChecklist data={data} />;

  const { impact, balances } = data;
  const monthLabel = formatMonthNl(`${data.currentMonth}-01`);
  const urgent = balances.filter(
    (balance) =>
      (balance.deadlineStatus === "SOON" || balance.deadlineStatus === "EXPIRED") && balance.remainingHours > 0,
  );
  const withRemaining = balances.filter((balance) => balance.remainingHours > 0);
  const multipleChildren = new Set(balances.map((balance) => balance.childId)).size > 1;

  // Netto als het contract loonstrookgegevens heeft, anders bruto.
  const difference = impact?.net ? impact.net.netDifference : (impact?.difference ?? 0);
  const losing = difference < -0.005;
  const daysLeft = data.reportDeadlineDays;

  return (
    <>
      <PageHeader
        title="Overzicht"
        subtitle={
          data.contract
            ? `${data.contract.employerName} · ${formatHoursNumber(data.contract.hoursPerWeek)} uur per week`
            : "Geen actief contract"
        }
        actions={
          <Button component={RouterLink} to="/maand" variant="contained" startIcon={<CalendarMonthRounded />}>
            {capitalize(monthLabel)} invoeren
          </Button>
        }
      />

      <Stack spacing={6}>
        {urgent.length > 0 && (
          <Alert severity="warning">
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: "text.primary" }}>Deadlines in zicht</Typography>
            <Box component="ul" sx={{ m: 0, pl: 5 }}>
              {urgent.map((balance) => (
                <li key={`${balance.childId}-${balance.leaveTypeId}`}>
                  {balance.leaveTypeName}
                  {multipleChildren && ` (${balance.childName})`}: {formatHoursNumber(balance.remainingHours)} uur
                  over,{" "}
                  {balance.deadlineStatus === "EXPIRED"
                    ? `termijn verstreken op ${formatDateNl(balance.deadline!)}`
                    : `opnemen t/m ${formatDateNl(balance.deadline!)}`}
                </li>
              ))}
            </Box>
          </Alert>
        )}

        {impact && (
          <StatGrid>
            {/* Wat het verlof kost is het getal waar het om draait; dat staat vooraan. */}
            <StatTile
              label={impact.net ? "Netto minder deze maand" : "Bruto minder deze maand"}
              value={formatEuro(Math.abs(difference))}
              tone={losing ? "negative" : "neutral"}
              hint={losing ? `Door ${formatHoursNumber(impact.leaveHours)} uur verlof` : "Geen inkomensverlies"}
            />
            <StatTile
              label={impact.net ? "Verwacht netto" : "Verwacht bruto"}
              value={formatEuro(impact.net ? impact.net.actual.netPayout : impact.totalReceived)}
              hint={`Normaal ${formatEuro(impact.net ? impact.net.normal.netPayout : impact.normalGross)}`}
            />
            <StatTile
              label={`Verlof in ${monthLabel}`}
              value={`${formatHoursNumber(impact.leaveHours)} uur`}
              hint={
                <Link component={RouterLink} to="/maand">
                  Maand bekijken
                </Link>
              }
            />
            <StatTile
              label="Melden vóór de 15e"
              value={
                daysLeft > 0 ? `Nog ${plural(daysLeft, "dag", "dagen")}` : daysLeft === 0 ? "Vandaag" : "Verstreken"
              }
              tone={daysLeft < 0 ? "negative" : "neutral"}
              hint={
                <Link component={RouterLink} to={`/melden?maand=${data.reportingMonth.slice(0, 7)}`}>
                  Verlof van {formatMonthNl(data.reportingMonth)} melden
                </Link>
              }
            />
          </StatGrid>
        )}

        <SectionCard
          title="Resterend verlof"
          action={
            <Button component={RouterLink} to="/saldo" variant="text" size="small" endIcon={<ArrowForwardRounded />}>
              Alle saldi
            </Button>
          }
        >
          {withRemaining.length === 0 ? (
            <Typography variant="body2">Al je verlofrechten zijn opgenomen of verlopen.</Typography>
          ) : (
            <Stack spacing={5}>
              {withRemaining.map((balance) => (
                <Box key={`${balance.childId}-${balance.leaveTypeId}`}>
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 2,
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      mb: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                      <ColorDot color={balance.colorHex} />
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary" }}>
                        {balance.leaveTypeName}
                      </Typography>
                      {multipleChildren && <Typography variant="body2">{balance.childName}</Typography>}
                    </Box>
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
                        {formatHoursNumber(balance.remainingHours)} uur
                      </Box>{" "}
                      van {formatHoursNumber(balance.entitledHours)} over
                    </Typography>
                  </Box>
                  <Meter
                    value={balance.usedHours}
                    max={balance.entitledHours}
                    color={balance.colorHex}
                    label={`${balance.leaveTypeName}: ${formatHoursNumber(balance.usedHours)} van ${formatHoursNumber(balance.entitledHours)} uur opgenomen`}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>

        <Box sx={{ display: "grid", gap: 4, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
          {shortcuts.map((shortcut) => (
            <Card
              key={shortcut.to}
              sx={{
                transition: "box-shadow .15s ease, border-color .15s ease",
                "&:hover": { borderColor: "action.disabled", boxShadow: "0 8px 24px rgba(18,22,28,.12)" },
              }}
            >
              <CardActionArea component={RouterLink} to={shortcut.to} sx={{ height: "100%" }}>
                <CardContent sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                  <Box sx={{ color: "primary.main", display: "flex" }} aria-hidden>
                    {shortcut.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{shortcut.title}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {shortcut.text}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Stack>
    </>
  );
}
