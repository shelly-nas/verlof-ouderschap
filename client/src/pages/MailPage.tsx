import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import { Alert, Box, Button, Card, CardContent, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useApi } from "../api/client";
import type { MailResponse } from "../api/types";
import { useToast } from "../components/Toast";
import { EmptyState, ErrorState, MonthNav, PageHeader, PageSkeleton } from "../components/ui";
import { formatMonthNl } from "../lib/dates";
import { formatHoursNumber } from "../lib/money";
import { useMonthParam } from "../lib/useMonthParam";

function days(count: number) {
  return `${count} ${count === 1 ? "dag" : "dagen"}`;
}

/** Waarschuwing of geruststelling rond de meldtermijn van de 15e. */
function DeadlineNotice({ data }: { data: MailResponse }) {
  const daysLeft = data.reportDeadlineDays;
  const isReportingMonth = data.monthStart === data.reportingMonth;
  const isCurrentMonth = data.monthStart.slice(0, 7) === data.today.slice(0, 7);

  if (isReportingMonth) {
    if (daysLeft > 0) {
      return <Alert severity="info">Nog {days(daysLeft)} om deze melding vóór de 15e te versturen.</Alert>;
    }
    if (daysLeft === 0) {
      return <Alert severity="warning">Vandaag is de 15e: verstuur de melding vandaag nog.</Alert>;
    }
    return <Alert severity="warning">De 15e is {days(Math.abs(daysLeft))} geleden verstreken.</Alert>;
  }

  if (isCurrentMonth) {
    return (
      <Alert severity="info">
        Je kijkt naar de lopende maand. Het verlof van {formatMonthNl(data.reportingMonth)} meld je vóór de 15e:{" "}
        <Link component={RouterLink} to={`/melden?maand=${data.reportingMonth.slice(0, 7)}`}>
          naar {formatMonthNl(data.reportingMonth)}
        </Link>
        {daysLeft > 0 ? ` (nog ${days(daysLeft)}).` : "."}
      </Alert>
    );
  }
  return null;
}

export function MailPage() {
  const nav = useMonthParam(null);
  const toast = useToast();
  const { data, error, loading, reload } = useApi<MailResponse>(
    nav.requested ? `/mail?maand=${nav.requested}` : "/mail",
  );

  if (loading && !data) return <PageSkeleton cards={1} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  if (!data.contract || !data.mail) {
    return (
      <>
        <PageHeader title="Verlof melden" />
        <EmptyState
          icon={<WorkRounded />}
          title="Nog geen contract"
          action={
            <Button component={RouterLink} to="/contracten/nieuw" variant="contained">
              Contract toevoegen
            </Button>
          }
        >
          Het e-mailadres van je werkgever staat bij het contract. Voeg je contract toe om je verlof te melden.
        </EmptyState>
      </>
    );
  }

  const { mail, contract } = data;
  const monthLabel = formatMonthNl(data.monthStart);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${mail.subject}\n\n${mail.body}`);
      toast("Tekst gekopieerd");
    } catch {
      toast("Kopiëren lukte niet; selecteer de tekst handmatig.", "error");
    }
  }

  return (
    <>
      <PageHeader
        title={`Verlof melden voor ${monthLabel}`}
        subtitle={`Naar ${contract.employerName} · ${contract.employerEmail}`}
        actions={
          <MonthNav
            onPrevious={nav.previous}
            onNext={nav.next}
            onToday={nav.current}
            isCurrent={data.monthStart.slice(0, 7) === data.today.slice(0, 7)}
          />
        }
      />

      <Stack spacing={6} sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s ease" }}>
        <DeadlineNotice data={data} />

        {mail.entryCount === 0 && (
          <Alert severity="info">
            Er staat nog geen verlof in {monthLabel}.{" "}
            <Link component={RouterLink} to={`/maand/${data.monthStart.slice(0, 7)}`}>
              Voer het in
            </Link>{" "}
            en de mail vult zichzelf aan. Je kunt de melding ook zo versturen om te laten weten dat je geen verlof
            opneemt.
          </Alert>
        )}

        {mail.tooLong && (
          <Alert severity="warning">
            Deze mail is te lang voor een mailto-link: mailprogramma&apos;s kappen die af. Kopieer de tekst en plak
            hem in een nieuwe mail.
          </Alert>
        )}

        <Card component="section">
          <CardContent>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                justifyContent: "space-between",
                alignItems: "flex-start",
                mb: 6,
              }}
            >
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: 4,
                  rowGap: 2,
                  fontSize: 14,
                  "& dt": { color: "text.secondary" },
                  "& dd": { m: 0, color: "text.primary", fontWeight: 500, wordBreak: "break-word" },
                }}
              >
                <dt>Aan</dt>
                <dd>{mail.to}</dd>
                <dt>Onderwerp</dt>
                <dd>{mail.subject}</dd>
                <dt>Totaal</dt>
                <dd>
                  {mail.entryCount} {mail.entryCount === 1 ? "dag" : "dagen"} · {formatHoursNumber(mail.totalHours)}{" "}
                  uur
                </dd>
              </Box>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  variant={mail.tooLong ? "contained" : "outlined"}
                  startIcon={<ContentCopyRounded />}
                  onClick={copy}
                >
                  Tekst kopiëren
                </Button>
                {!mail.tooLong && (
                  <Button variant="contained" href={mail.href} startIcon={<SendRounded />}>
                    Mail opstellen
                  </Button>
                )}
              </Box>
            </Box>

            <Box
              component="pre"
              sx={{
                m: 0,
                p: 5,
                borderRadius: "8px",
                bgcolor: "action.hover",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1.6,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                overflowX: "auto",
              }}
            >
              {mail.body}
            </Box>
          </CardContent>
        </Card>

        <Typography variant="body2">
          De knop opent je eigen mailprogramma met een ingevuld concept. Je verstuurt de mail zelf, dus je kunt hem
          eerst nog aanpassen.
        </Typography>
      </Stack>
    </>
  );
}
