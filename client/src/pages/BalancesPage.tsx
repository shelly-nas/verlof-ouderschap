import ChildCareRounded from "@mui/icons-material/ChildCareRounded";
import { Alert, Box, Button, Divider, Stack, Typography } from "@mui/material";
import { Fragment } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useApi } from "../api/client";
import type { Balance, BalancesResponse } from "../api/types";
import {
  ColorDot,
  EmptyState,
  ErrorState,
  Meter,
  PageHeader,
  PageSkeleton,
  SectionCard,
  StatusBadge,
} from "../components/ui";
import { formatDateNl } from "../lib/dates";
import { formatHoursNumber } from "../lib/money";

function DeadlineBadge({ balance }: { balance: Balance }) {
  switch (balance.deadlineStatus) {
    case "DONE":
      return <StatusBadge tone="success">Volledig opgenomen</StatusBadge>;
    case "EXPIRED":
      return <StatusBadge tone="error">Termijn verstreken</StatusBadge>;
    case "SOON":
      return (
        <StatusBadge tone="warning">
          Nog {balance.daysUntilDeadline} {balance.daysUntilDeadline === 1 ? "dag" : "dagen"}
        </StatusBadge>
      );
    case "OK":
      return <StatusBadge tone="info">Op tijd</StatusBadge>;
    default:
      return null;
  }
}

function payment(balance: Balance): string {
  const { payer, payPercent, topUpToPercent } = balance.entitlement;
  if (payer === "EMPLOYER") return "Volledig doorbetaald door de werkgever";
  if (payer === "UWV") {
    return `UWV betaalt ${payPercent}% van het dagloon${topUpToPercent ? `, werkgever vult aan tot ${topUpToPercent}%` : ""}`;
  }
  return `Onbetaald${topUpToPercent ? `, werkgever betaalt ${topUpToPercent}%` : ""}`;
}

function BalanceRow({ balance }: { balance: Balance }) {
  const { entitlement } = balance;
  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <ColorDot color={balance.colorHex} />
          <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{balance.leaveTypeName}</Typography>
          <DeadlineBadge balance={balance} />
          {balance.carriedInHours > 0 && (
            <StatusBadge tone="info">+{formatHoursNumber(balance.carriedInHours)} uur doorgeschoven</StatusBadge>
          )}
          {balance.carriedOutHours > 0 && (
            <StatusBadge tone="neutral">{formatHoursNumber(balance.carriedOutHours)} uur doorgeschoven</StatusBadge>
          )}
        </Box>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600, fontSize: 16 }}>
            {formatHoursNumber(Math.max(0, balance.remainingHours))} uur
          </Box>{" "}
          van {formatHoursNumber(balance.entitledHours)} over
        </Typography>
      </Box>

      <Box sx={{ my: 3 }}>
        <Meter
          value={balance.usedHours}
          max={balance.entitledHours}
          color={balance.colorHex}
          label={`${balance.leaveTypeName}: ${formatHoursNumber(balance.usedHours)} van ${formatHoursNumber(balance.entitledHours)} uur opgenomen`}
        />
      </Box>

      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          "& dt": { fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" },
          "& dd": { m: 0, mt: 1, fontSize: 14, color: "text.primary" },
        }}
      >
        <div>
          <dt>Opgenomen</dt>
          <dd>
            {formatHoursNumber(balance.usedHours)} uur
            <Typography variant="body2" component="span">
              {" "}
              · {formatHoursNumber(entitlement.weeks)} {entitlement.weeks === 1 ? "week" : "weken"} ×{" "}
              {formatHoursNumber(entitlement.hoursPerWeek)} uur
            </Typography>
          </dd>
        </div>
        <div>
          <dt>Opnemen t/m</dt>
          <dd>{balance.deadline ? formatDateNl(balance.deadline) : "Geen deadline"}</dd>
        </div>
        <div>
          <dt>Betaling</dt>
          <dd>{payment(balance)}</dd>
        </div>
      </Box>

      {balance.carriedInHours > 0 && (
        <Typography variant="body2" sx={{ mt: 3 }}>
          De termijn voor het betaalde deel is verstreken; het resterende recht is naar dit onbetaalde saldo verplaatst.
        </Typography>
      )}
    </Box>
  );
}

export function BalancesPage() {
  const { data, error, loading, reload } = useApi<BalancesResponse>("/balances");

  if (loading && !data) return <PageSkeleton cards={2} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const header = (
    <PageHeader title="Saldo" subtitle="Je recht is berekend met de contracturen die golden op de geboortedatum." />
  );

  if (data.children.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<ChildCareRounded />}
          title="Nog geen kinderen"
          action={
            <Button component={RouterLink} to="/kinderen" variant="contained">
              Kind toevoegen
            </Button>
          }
        >
          Verlofrechten worden per kind berekend. Voeg je kind toe om je saldo te zien.
        </EmptyState>
      </>
    );
  }

  const warnings = data.balances.filter(
    (balance) => balance.usedAfterDeadlineHours > 0 || balance.overBookedHours > 0,
  );

  return (
    <>
      {header}
      <Stack spacing={6}>
        {warnings.length > 0 && (
          <Alert severity="warning">
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: "text.primary" }}>Controleer je boekingen</Typography>
            <Box component="ul" sx={{ m: 0, pl: 5 }}>
              {warnings.map((balance) => (
                <li key={`${balance.childId}-${balance.leaveTypeId}`}>
                  {balance.leaveTypeName} ({balance.childName}):
                  {balance.overBookedHours > 0 &&
                    ` ${formatHoursNumber(balance.overBookedHours)} uur meer opgenomen dan je recht.`}
                  {balance.usedAfterDeadlineHours > 0 &&
                    ` ${formatHoursNumber(balance.usedAfterDeadlineHours)} uur geboekt na de deadline.`}
                </li>
              ))}
            </Box>
          </Alert>
        )}

        {data.children.map((child) => {
          const childBalances = data.balances.filter((balance) => balance.childId === child.id);
          const reference = childBalances[0]?.entitlement.referenceContract;
          return (
            <SectionCard
              key={child.id}
              title={child.name}
              description={
                reference
                  ? `Geboren ${formatDateNl(child.dateOfBirth)} · recht berekend op ${formatHoursNumber(reference.hoursPerWeek)} uur per week (${reference.employerName})`
                  : `Geboren ${formatDateNl(child.dateOfBirth)} · nog geen contract gevonden`
              }
            >
              <Stack spacing={6}>
                {childBalances.map((balance, index) => (
                  <Fragment key={balance.leaveTypeId}>
                    {index > 0 && <Divider />}
                    <BalanceRow balance={balance} />
                  </Fragment>
                ))}
              </Stack>
            </SectionCard>
          );
        })}
      </Stack>
    </>
  );
}
