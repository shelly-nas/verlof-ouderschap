import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useApi } from "../api/client";
import type { MonthImpact, SalaryResponse } from "../api/types";
import {
  EmptyState,
  ErrorState,
  MonthNav,
  PageHeader,
  PageSkeleton,
  SectionCard,
  StatGrid,
  StatTile,
} from "../components/ui";
import { capitalize, formatMonthNl } from "../lib/dates";
import { formatEuro, formatHoursNumber, formatPercent } from "../lib/money";
import { useMonthParam } from "../lib/useMonthParam";

const num = { textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;

/** Tabel in een kaart die horizontaal kan scrollen. */
function TableCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card component="section">
      <Box sx={{ px: 6, pt: 6, pb: 4 }}>
        <Typography variant="h3" component="h2">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ overflowX: "auto" }}>{children}</Box>
    </Card>
  );
}

function BreakdownTable({ impact }: { impact: MonthImpact }) {
  return (
    <TableCard title="Opbouw" description="Wat elke verlofsoort deze maand oplevert en kost, bruto.">
      <Table sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow>
            <TableCell>Verlofsoort</TableCell>
            <TableCell sx={num}>Uren</TableCell>
            <TableCell sx={num}>Dagen</TableCell>
            <TableCell sx={num}>Werkgever</TableCell>
            <TableCell sx={num}>UWV</TableCell>
            <TableCell sx={num}>Aanvulling</TableCell>
            <TableCell sx={num}>Gemist</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {impact.lines.map((line) => (
            <TableRow key={line.leaveTypeId}>
              <TableCell sx={{ color: "text.primary", fontWeight: 500 }}>{line.leaveTypeName}</TableCell>
              <TableCell sx={num}>{formatHoursNumber(line.hours)}</TableCell>
              <TableCell sx={num}>{formatHoursNumber(line.dayEquivalents)}</TableCell>
              <TableCell sx={num}>{formatEuro(line.employerPaid)}</TableCell>
              <TableCell sx={num}>{formatEuro(line.uwvBenefit)}</TableCell>
              <TableCell sx={num}>{formatEuro(line.employerTopUp)}</TableCell>
              <TableCell sx={{ ...num, color: line.loss > 0.005 ? "error.main" : undefined }}>
                {line.loss > 0.005 ? `− ${formatEuro(line.loss)}` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={6} sx={{ color: "text.primary", fontSize: 14 }}>
              Loon over gewerkte dagen
            </TableCell>
            <TableCell sx={{ ...num, color: "text.primary", fontSize: 14 }}>{formatEuro(impact.workedGross)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={6} sx={{ color: "text.primary", fontWeight: 600, fontSize: 14, borderBottom: 0 }}>
              Totaal bruto
            </TableCell>
            <TableCell sx={{ ...num, color: "text.primary", fontWeight: 600, fontSize: 14, borderBottom: 0 }}>
              {formatEuro(impact.totalReceived)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableCard>
  );
}

function PayslipTable({ impact }: { impact: MonthImpact }) {
  const net = impact.net!;
  const { actual, normal } = net;

  const row = (label: ReactNode, current: number, usual: number, options: { base?: string; strong?: boolean } = {}) => (
    <TableRow>
      <TableCell sx={{ color: "text.primary", fontWeight: options.strong ? 600 : 400 }}>{label}</TableCell>
      <TableCell sx={{ ...num, color: "text.secondary" }}>{options.base ?? ""}</TableCell>
      <TableCell sx={{ ...num, color: "text.primary", fontWeight: options.strong ? 600 : 400 }}>
        {formatEuro(current)}
      </TableCell>
      <TableCell sx={{ ...num, color: "text.secondary" }}>{formatEuro(usual)}</TableCell>
    </TableRow>
  );

  const muted = (text: string) => (
    <Typography component="span" variant="body2" sx={{ ml: 2 }}>
      {text}
    </Typography>
  );

  return (
    <TableCard title="Loonstrook" description="Zo ziet de maand er netto uit, met het verlof verwerkt, naast een normale maand.">
      <Table sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            <TableCell>Post</TableCell>
            <TableCell sx={num}>Grondslag</TableCell>
            <TableCell sx={num}>Deze maand</TableCell>
            <TableCell sx={num}>Normaal</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {row("Salaris", actual.baseSalary, normal.baseSalary)}
          {actual.grossExpenseAllowance > 0 &&
            row("Bruto kostentoeslag", actual.grossExpenseAllowance, normal.grossExpenseAllowance)}
          {actual.deductions.map((line, index) => (
            <TableRow key={line.label}>
              <TableCell sx={{ color: "text.primary" }}>
                {line.label}
                {line.percent !== undefined && muted(formatPercent(line.percent))}
              </TableCell>
              <TableCell sx={{ ...num, color: "text.secondary" }}>
                {line.base !== undefined ? formatEuro(line.base) : "—"}
              </TableCell>
              <TableCell sx={{ ...num, color: "text.primary" }}>{formatEuro(line.amount)}</TableCell>
              <TableCell sx={{ ...num, color: "text.secondary" }}>
                {formatEuro(normal.deductions[index]?.amount ?? 0)}
              </TableCell>
            </TableRow>
          ))}
          {actual.bijtelling > 0 && row("Bijtelling", actual.bijtelling, normal.bijtelling)}
          {row("Heffingsloon", actual.taxableIncome, normal.taxableIncome, { strong: true })}
          {row(
            <>
              Loonbelasting/premie volksverzekeringen
              {muted(formatPercent(actual.effectiveTaxRate * 100))}
            </>,
            -actual.payrollTax,
            -normal.payrollTax,
          )}
          {row("Nettoloon", actual.netSalary, normal.netSalary, { strong: true })}
          {actual.netExpenseAllowance > 0 &&
            row("Onkostenvergoeding", actual.netExpenseAllowance, normal.netExpenseAllowance)}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell sx={{ color: "text.primary", fontWeight: 600, fontSize: 14, borderBottom: 0 }}>
              Netto te ontvangen
            </TableCell>
            <TableCell sx={{ borderBottom: 0 }} />
            <TableCell sx={{ ...num, color: "text.primary", fontWeight: 600, fontSize: 14, borderBottom: 0 }}>
              {formatEuro(actual.netPayout)}
            </TableCell>
            <TableCell sx={{ ...num, color: "text.secondary", fontSize: 14, borderBottom: 0 }}>
              {formatEuro(normal.netPayout)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {net.netDifference < -0.005 && (
        <Typography variant="body2" sx={{ px: 6, pb: 6, pt: 2 }}>
          Je ontvangt {formatEuro(Math.abs(net.netDifference))} minder netto dan normaal, terwijl je bruto{" "}
          {formatEuro(Math.abs(impact.difference))} misloopt. Het verschil zit in de lagere loonheffing.
        </Typography>
      )}
    </TableCard>
  );
}

export function SalaryPage() {
  const nav = useMonthParam(null);
  const { data, error, loading, reload } = useApi<SalaryResponse>(
    nav.requested ? `/salary?maand=${nav.requested}` : "/salary",
  );

  if (loading && !data) return <PageSkeleton tiles={4} cards={1} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  if (!data.hasContracts) {
    return (
      <>
        <PageHeader title="Salaris" />
        <EmptyState
          icon={<WorkRounded />}
          title="Nog geen contract"
          action={
            <Button component={RouterLink} to="/contracten/nieuw" variant="contained">
              Contract toevoegen
            </Button>
          }
        >
          Met je salaris en contracturen rekent de app uit wat je verlof kost.
        </EmptyState>
      </>
    );
  }

  const { impact } = data;
  const isCurrent = data.month === data.today.slice(0, 7);

  return (
    <>
      <PageHeader
        title={capitalize(formatMonthNl(`${data.month}-01`))}
        subtitle={
          impact?.net
            ? "Indicatie op basis van je loonstrook; vakantiegeld en eenmalige posten blijven buiten beschouwing."
            : "Bruto-indicatie. Vul de loonstrookposten bij je contract in om ook netto te zien."
        }
        actions={<MonthNav onPrevious={nav.previous} onNext={nav.next} onToday={nav.current} isCurrent={isCurrent} />}
      />

      {!impact ? (
        <Alert severity="error">De berekening voor deze maand is mislukt. Controleer de contractgegevens.</Alert>
      ) : (
        <Stack spacing={6} sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s ease" }}>
          {impact.entriesWithoutContract > 0 && (
            <Alert severity="warning">
              {impact.entriesWithoutContract} verlofdag(en) in deze maand vallen buiten elke contractperiode en zijn
              niet meegerekend.
            </Alert>
          )}

          <StatGrid>
            {impact.net ? (
              <>
                <StatTile label="Netto verschil" value={formatEuro(impact.net.netDifference)}
                  tone={impact.net.netDifference < -0.005 ? "negative" : "neutral"}
                  hint={impact.net.netDifference < -0.005 ? `Bruto scheelt ${formatEuro(Math.abs(impact.difference))}` : "Geen inkomensverlies"}
                />
                <StatTile label="Netto deze maand" value={formatEuro(impact.net.actual.netPayout)}
                  hint={`${formatHoursNumber(impact.leaveHours)} uur verlof`} />
                <StatTile label="Netto zonder verlof" value={formatEuro(impact.net.normal.netPayout)} hint="Een normale maand" />
              </>
            ) : (
              <>
                <StatTile label="Bruto verschil" value={formatEuro(impact.difference)}
                  tone={impact.difference < -0.005 ? "negative" : "neutral"}
                  hint={impact.difference < -0.005 ? "Minder inkomen deze maand" : "Geen inkomensverlies"}
                />
                <StatTile label="Verwacht bruto" value={formatEuro(impact.totalReceived)}
                  hint={`${formatHoursNumber(impact.leaveHours)} uur verlof`} />
                <StatTile label="Zonder verlof" value={formatEuro(impact.normalGross)} hint="Bruto maandsalaris" />
              </>
            )}
            <StatTile label="Waarvan UWV" value={formatEuro(impact.uwvBenefit)} hint="70% van je dagloon" />
          </StatGrid>

          {impact.lines.length === 0 ? (
            <EmptyState
              icon={<CalendarMonthRounded />}
              title="Geen verlof in deze maand"
              action={
                <Button component={RouterLink} to={`/maand/${data.month}`} variant="contained">
                  Verlof invoeren
                </Button>
              }
            >
              Zodra je verlof invoert, zie je hier wat het je kost.
            </EmptyState>
          ) : (
            <BreakdownTable impact={impact} />
          )}

          {impact.net ? (
            <PayslipTable impact={impact} />
          ) : (
            <SectionCard title="Netto berekenen" description="Neem de posten van je loonstrook over bij je contract; dan rekent de app ook je nettoloon uit.">
              <Button component={RouterLink} to="/contracten" variant="outlined">
                Naar contracten
              </Button>
            </SectionCard>
          )}
        </Stack>
      )}
    </>
  );
}
