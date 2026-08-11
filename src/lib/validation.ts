import { z } from "zod";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik het formaat jjjj-mm-dd");

const optionalDateOnly = z
  .union([dateOnly, z.literal("")])
  .transform((value) => (value === "" ? null : value))
  .nullable();

/** Lege tekstvelden komen als "" binnen uit een formulier; die worden null. */
const optionalText = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  })
  .nullable();

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const raw = typeof value === "string" ? value.trim().replace(",", ".") : value;
    if (raw === "") return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  })
  .refine((value) => value === null || !Number.isNaN(value), "Geen geldig getal")
  .nullable();

const requiredNumber = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const raw = typeof value === "string" ? value.trim().replace(",", ".") : value;
    return Number(raw);
  })
  .refine((value) => !Number.isNaN(value), "Geen geldig getal");

export const supplementSchema = z.object({
  leaveTypeId: z.string().min(1),
  topUpToPercent: optionalNumber.refine(
    (value) => value === null || (value >= 0 && value <= 200),
    "Aanvulling moet tussen 0% en 200% liggen",
  ),
  extraWeeks: optionalNumber.refine(
    (value) => value === null || (value >= 0 && value <= 104),
    "Extra weken moet tussen 0 en 104 liggen",
  ),
  deadlineOverrideMonths: optionalNumber.refine(
    (value) => value === null || (value >= 0 && value <= 240),
    "Termijn moet tussen 0 en 240 maanden liggen",
  ),
  notes: optionalText,
});

export const contractSchema = z
  .object({
    employerName: z.string().trim().min(1, "Naam van de werkgever is verplicht"),
    employerEmail: z.string().trim().email("Geen geldig e-mailadres"),
    hoursPerWeek: requiredNumber.refine(
      (value) => value > 0 && value <= 60,
      "Contracturen moeten tussen 0 en 60 liggen",
    ),
    grossMonthlySalary: requiredNumber.refine(
      (value) => value >= 0,
      "Salaris kan niet negatief zijn",
    ),
    startDate: dateOnly,
    endDate: optionalDateOnly,
    notes: optionalText,

    // Loonstrookposten; leeg laten betekent dat de app alleen bruto rekent.
    pensionPercent: optionalNumber.refine(
      (value) => value === null || (value >= 0 && value <= 100),
      "Pensioenpremie moet tussen 0% en 100% liggen",
    ),
    pensionBase: optionalNumber.refine(
      (value) => value === null || value >= 0,
      "Grondslag kan niet negatief zijn",
    ),
    wgaPercent: optionalNumber.refine(
      (value) => value === null || (value >= 0 && value <= 100),
      "WGA-percentage moet tussen 0% en 100% liggen",
    ),
    wgaBase: optionalNumber.refine(
      (value) => value === null || value >= 0,
      "Grondslag kan niet negatief zijn",
    ),
    wiaExcedent: optionalNumber.refine(
      (value) => value === null || value >= 0,
      "Bedrag kan niet negatief zijn",
    ),
    grossExpenseAllowance: optionalNumber.refine(
      (value) => value === null || value >= 0,
      "Bedrag kan niet negatief zijn",
    ),
    bijtellingPercent: optionalNumber.refine(
      (value) => value === null || (value >= 0 && value <= 100),
      "Bijtelling moet tussen 0% en 100% liggen",
    ),
    bijtellingBase: optionalNumber.refine(
      (value) => value === null || value >= 0,
      "Cataloguswaarde kan niet negatief zijn",
    ),
    netExpenseAllowance: optionalNumber.refine(
      (value) => value === null || value >= 0,
      "Bedrag kan niet negatief zijn",
    ),
    applyTaxCredits: z.boolean().default(true),

    supplements: z.array(supplementSchema).default([]),
  })
  .refine(
    (value) => value.endDate === null || value.endDate >= value.startDate,
    { message: "De einddatum ligt vóór de startdatum", path: ["endDate"] },
  );

export const childSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht"),
  dateOfBirth: dateOnly,
});

export const leaveTypeSchema = z
  .object({
    name: z.string().trim().min(1, "Naam is verplicht"),
    weeksMultiplier: requiredNumber.refine(
      (value) => value >= 0 && value <= 104,
      "Aantal weken moet tussen 0 en 104 liggen",
    ),
    payer: z.enum(["EMPLOYER", "UWV", "UNPAID"]),
    payPercent: optionalNumber.refine(
      (value) => value === null || (value >= 0 && value <= 100),
      "Percentage moet tussen 0 en 100 liggen",
    ),
      deadlineAnchor: z.enum([
      "WEEKS_AFTER_BIRTH",
      "MONTHS_AFTER_BIRTH",
      "YEARS_AFTER_BIRTH",
      "NONE",
    ]),
    deadlineValue: optionalNumber.refine(
      (value) => value === null || (value >= 0 && value <= 240),
      "Termijn moet tussen 0 en 240 liggen",
    ),
    colorHex: optionalText,
  })
  .refine(
    (value) => value.deadlineAnchor === "NONE" || value.deadlineValue !== null,
    { message: "Vul een termijn in of kies 'geen deadline'", path: ["deadlineValue"] },
  );

/** Eén verlofregel. hours = 0 betekent: verwijder deze regel. */
export const leaveEntrySchema = z.object({
  date: dateOnly,
  childId: z.string().min(1, "Kies een kind"),
  leaveTypeId: z.string().min(1, "Kies een verlofsoort"),
  hours: requiredNumber.refine(
    (value) => value >= 0 && value <= 24,
    "Uren moeten tussen 0 en 24 liggen",
  ),
  note: optionalText.optional(),
});

export const periodSaveSchema = z
  .object({
    from: dateOnly,
    to: dateOnly,
    rows: z.array(leaveEntrySchema),
  })
  .refine((value) => value.to >= value.from, {
    message: "De einddatum ligt vóór de startdatum",
    path: ["to"],
  });

export type ContractInput = z.infer<typeof contractSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
export type PeriodSaveInput = z.infer<typeof periodSaveSchema>;

/** Zet een zod-fout om naar een platte lijst meldingen voor de UI. */
export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
