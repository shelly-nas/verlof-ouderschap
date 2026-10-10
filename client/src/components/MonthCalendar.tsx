import { Box, ButtonBase, Typography } from "@mui/material";
import { memo } from "react";
import type { LeaveType } from "../api/types";
import { type DateOnly, calendarWeeksOf, formatDayLong, isoWeekKey, isoWeekNumber } from "../lib/dates";
import { formatHoursNumber } from "../lib/money";
import { type Row, rowKey } from "../lib/monthRows";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

type Props = {
  month: string;
  today: DateOnly;
  rowsByDate: Map<string, Row[]>;
  leaveTypeById: Map<string, LeaveType>;
  isBookable: (date: DateOnly) => boolean;
  /** Een klik op de dag: zet de gekozen verlofsoort neer of haalt hem weg. */
  onToggle: (date: DateOnly) => void;
  /** Detail openen: andere uren of een tweede verlofsoort. */
  onOpen: (date: DateOnly) => void;
};

/**
 * Maandkalender van maandag tot zondag. Elke dag is één knop die de gekozen
 * verlofsoort neerzet of weghaalt; het urenlabel rechtsboven opent het detail.
 * Op een telefoon tonen de dagen alleen kleurstippen en het totaal.
 */
export const MonthCalendar = memo(function MonthCalendar({
  month,
  today,
  rowsByDate,
  leaveTypeById,
  isBookable,
  onToggle,
  onOpen,
}: Props) {
  const weeks = calendarWeeksOf(month);

  return (
    <Box
      role="grid"
      aria-label="Maandkalender"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(7, minmax(0, 1fr))", sm: "32px repeat(7, minmax(0, 1fr))" },
        gap: { xs: 1, sm: 2 },
      }}
    >
      <Box role="row" sx={{ display: "contents" }}>
        <Box sx={{ display: { xs: "none", sm: "block" } }} role="columnheader" aria-label="Week" />
        {WEEKDAYS.map((label) => (
          <Typography
            key={label}
            role="columnheader"
            variant="overline"
            sx={{ textAlign: "center", pb: 1 }}
          >
            {label}
          </Typography>
        ))}
      </Box>

      {weeks.map((week) => (
        <Box role="row" key={week[0]} sx={{ display: "contents" }}>
          <Typography
            variant="caption"
            sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", justifyContent: "center" }}
            aria-label={`Week ${isoWeekNumber(isoWeekKey(week[0]))}`}
          >
            {isoWeekNumber(isoWeekKey(week[0]))}
          </Typography>
          {week.map((date) => (
            <DayCell
              key={date}
              date={date}
              inMonth={date.startsWith(month)}
              isToday={date === today}
              bookable={isBookable(date)}
              rows={rowsByDate.get(date) ?? []}
              leaveTypeById={leaveTypeById}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
});

function DayCell({
  date,
  inMonth,
  isToday,
  bookable,
  rows,
  leaveTypeById,
  onToggle,
  onOpen,
}: {
  date: DateOnly;
  inMonth: boolean;
  isToday: boolean;
  bookable: boolean;
  rows: Row[];
  leaveTypeById: Map<string, LeaveType>;
  onToggle: (date: DateOnly) => void;
  onOpen: (date: DateOnly) => void;
}) {
  const day = Number(date.slice(8, 10));
  const weekend = [0, 6].includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
  const total = rows.reduce((sum, row) => sum + row.hours, 0);
  const names = rows.map((row) => leaveTypeById.get(row.leaveTypeId)?.name).filter(Boolean);

  if (!inMonth) {
    return <Box role="gridcell" aria-hidden sx={{ minHeight: { xs: 68, sm: 104 } }} />;
  }

  const label = `${formatDayLong(date)}${total > 0 ? `: ${formatHoursNumber(total)} uur ${names.join(", ")}` : ""}`;

  return (
    <Box
      role="gridcell"
      sx={{
        position: "relative",
        minHeight: { xs: 68, sm: 104 },
        borderRadius: "8px",
        border: 1,
        borderColor: total > 0 ? "primary.light" : "divider",
        bgcolor: !bookable ? "action.disabledBackground" : weekend ? "action.hover" : "background.paper",
        transition: "border-color .15s ease, background-color .15s ease",
        "&:hover": bookable ? { borderColor: "primary.main" } : undefined,
        "&:focus-within": { borderColor: "primary.main" },
      }}
    >
      <ButtonBase
        disabled={!bookable}
        onClick={() => onToggle(date)}
        aria-label={bookable ? label : `${formatDayLong(date)}: geen contract`}
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          textAlign: "left",
          p: { xs: 1, sm: 2 },
          gap: 1,
          "&.Mui-focusVisible": { boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.primary.main}` },
        }}
      >
        <Box
          component="span"
          sx={{
            alignSelf: "flex-start",
            minWidth: 24,
            height: 24,
            px: 1,
            borderRadius: "999px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: isToday ? 700 : 500,
            fontVariantNumeric: "tabular-nums",
            color: isToday ? "primary.contrastText" : bookable ? "text.primary" : "text.disabled",
            bgcolor: isToday ? "primary.main" : "transparent",
          }}
        >
          {day}
        </Box>

        {/* Telefoon: stippen. Groter: de namen. */}
        <Box component="span" sx={{ display: { xs: "flex", sm: "none" }, gap: "3px", flexWrap: "wrap", px: "2px" }}>
          {rows.map((row) => (
            <Box
              component="span"
              key={rowKey(row)}
              sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: leaveTypeById.get(row.leaveTypeId)?.colorHex ?? "text.disabled" }}
            />
          ))}
        </Box>
        <Box component="span" sx={{ display: { xs: "none", sm: "flex" }, flexDirection: "column", gap: "3px", minWidth: 0 }}>
          {rows.map((row) => {
            const type = leaveTypeById.get(row.leaveTypeId);
            return (
              <Box
                component="span"
                key={rowKey(row)}
                title={type?.name}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  minWidth: 0,
                  px: 1,
                  py: "2px",
                  borderRadius: "4px",
                  bgcolor: "action.hover",
                  fontSize: 12,
                  lineHeight: 1.3,
                  color: "text.primary",
                }}
              >
                <Box component="span" sx={{ width: 6, height: 6, flex: "none", borderRadius: "50%", bgcolor: type?.colorHex ?? "text.disabled" }} />
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {type?.name}
                </Box>
              </Box>
            );
          })}
        </Box>
      </ButtonBase>

      {total > 0 && (
        <ButtonBase
          onClick={() => onOpen(date)}
          aria-label={`Uren op ${formatDayLong(date)} aanpassen`}
          title="Uren aanpassen"
          sx={{
            position: "absolute",
            // Telefoon: onderaan, want bovenin staat het dagnummer al krap.
            top: { xs: "auto", sm: 6 },
            bottom: { xs: 2, sm: "auto" },
            right: { xs: 2, sm: 6 },
            minHeight: 24,
            minWidth: 24,
            px: 1,
            borderRadius: "6px",
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: "primary.main",
            bgcolor: "primary.light",
            "&:hover": { textDecoration: "underline" },
            "&.Mui-focusVisible": { boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}` },
            // Groter raakvlak dan de zichtbare knop, zodat hij op een telefoon te raken is.
            "&::after": { content: '""', position: "absolute", inset: -8 },
          }}
        >
          {formatHoursNumber(total)}u
        </ButtonBase>
      )}
    </Box>
  );
}
