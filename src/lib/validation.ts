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
  topUpUncapped: z.boolean().default(true),
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
    cappedAtMaxDagloon: z.boolean().default(false),
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

export const maxDagloonSchema = z.object({
  validFrom: dateOnly,
  amount: requiredNumber.refine((value) => value > 0, "Bedrag moet groter dan 0 zijn"),
  source: optionalText,
});

/** Eén regel in het weekscherm. hours = 0 betekent: verwijder deze regel. */
export const weekEntrySchema = z.object({
  date: dateOnly,
  childId: z.string().min(1, "Kies een kind"),
  leaveTypeId: z.string().min(1, "Kies een verlofsoort"),
  hours: requiredNumber.refine(
    (value) => value >= 0 && value <= 24,
    "Uren moeten tussen 0 en 24 liggen",
  ),
  note: optionalText.optional(),
});

export const weekSaveSchema = z.object({
  weekStart: dateOnly,
  rows: z.array(weekEntrySchema),
});

export type ContractInput = z.infer<typeof contractSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
export type MaxDagloonInput = z.infer<typeof maxDagloonSchema>;
export type WeekSaveInput = z.infer<typeof weekSaveSchema>;

/** Zet een zod-fout om naar een platte lijst meldingen voor de UI. */
export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
