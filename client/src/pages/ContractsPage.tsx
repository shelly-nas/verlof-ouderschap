import AddRounded from "@mui/icons-material/AddRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useApi } from "../api/client";
import type { Contract, ContractsResponse } from "../api/types";
import { EmptyState, ErrorState, PageHeader, PageSkeleton, StatusBadge } from "../components/ui";
import { formatDateNl } from "../lib/dates";
import { formatEuro, formatHoursNumber } from "../lib/money";

/** UWV rekent een maand om naar dagen met deze factor (261 werkdagen / 12). */
const UWV_DAGEN_PER_MAAND = 21.75;

function hasPayslip(contract: Contract) {
  return [
    contract.pensionPercent,
    contract.wgaPercent,
    contract.wiaExcedent,
    contract.bijtellingPercent,
    contract.grossExpenseAllowance,
    contract.netExpenseAllowance,
  ].some((value) => value !== null);
}

function ContractCard({ contract, today }: { contract: Contract; today: string }) {
  const isCurrent = contract.startDate <= today && (contract.endDate === null || contract.endDate >= today);
  const facts = [
    { label: "Contracturen", value: `${formatHoursNumber(contract.hoursPerWeek)} uur per week` },
    { label: "Bruto maandsalaris", value: formatEuro(contract.grossMonthlySalary) },
    { label: "Dagloon", value: formatEuro(contract.grossMonthlySalary / UWV_DAGEN_PER_MAAND) },
    { label: "E-mail werkgever", value: contract.employerEmail },
  ];

  return (
    <Card
      sx={{
        transition: "box-shadow .15s ease, border-color .15s ease",
        "&:hover": { borderColor: "action.disabled", boxShadow: "0 8px 24px rgba(18,22,28,.12)" },
      }}
    >
      <CardActionArea component={RouterLink} to={`/contracten/${contract.id}`} aria-label={`${contract.employerName} bewerken`}>
        <CardContent sx={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
              <Typography variant="h3" component="h2">
                {contract.employerName}
              </Typography>
              {isCurrent && <StatusBadge tone="success">Huidig</StatusBadge>}
              {contract.supplements.length > 0 && <StatusBadge tone="info">Aanvullende voorwaarden</StatusBadge>}
              {!hasPayslip(contract) && <StatusBadge tone="neutral">Alleen bruto</StatusBadge>}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>
              {formatDateNl(contract.startDate)} – {contract.endDate ? formatDateNl(contract.endDate) : "heden"}
            </Typography>
            <Box
              component="dl"
              sx={{
                m: 0,
                mt: 6,
                display: "grid",
                gap: 4,
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
                "& dt": { fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" },
                "& dd": { m: 0, mt: 1, fontSize: 14, color: "text.primary", fontWeight: 500, wordBreak: "break-word" },
              }}
            >
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </Box>
            {contract.notes && (
              <Typography variant="body2" sx={{ mt: 4 }}>
                {contract.notes}
              </Typography>
            )}
          </Box>
          <ChevronRightRounded sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }} aria-hidden />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function ContractsPage() {
  const { data, error, loading, reload } = useApi<ContractsResponse>("/contracts");

  if (loading && !data) return <PageSkeleton cards={2} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Contracten"
        subtitle="Je verlofrecht wordt berekend met de contracturen die golden op de geboortedatum van je kind."
        actions={
          data.contracts.length > 0 && (
            <Button component={RouterLink} to="/contracten/nieuw" variant="contained" startIcon={<AddRounded />}>
              Nieuw contract
            </Button>
          )
        }
      />

      <Stack spacing={6}>
        {data.overlaps.length > 0 && (
          <Alert severity="warning">
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: "text.primary" }}>Overlappende contractperiodes</Typography>
            <Box component="ul" sx={{ m: 0, pl: 5 }}>
              {data.overlaps.map((overlap) => (
                <li key={overlap}>{overlap}</li>
              ))}
            </Box>
            Bij overlap rekent de app met het contract met de laatste startdatum.
          </Alert>
        )}

        {data.contracts.length === 0 ? (
          <EmptyState
            icon={<WorkRounded />}
            title="Nog geen contracten"
            action={
              <Button component={RouterLink} to="/contracten/nieuw" variant="contained" startIcon={<AddRounded />}>
                Contract toevoegen
              </Button>
            }
          >
            Voeg je contract toe om verlof te kunnen invoeren. Wissel je van baan of uren, dan voeg je later een
            tweede contract toe.
          </EmptyState>
        ) : (
          data.contracts.map((contract) => <ContractCard key={contract.id} contract={contract} today={data.today} />)
        )}
      </Stack>
    </>
  );
}
