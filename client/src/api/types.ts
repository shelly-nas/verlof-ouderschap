// Vormen van de API-antwoorden. Gespiegeld aan server/src/app.ts en de
// rekenkern in server/src/domain; alleen wat de schermen gebruiken.

export type DateOnly = string;

export type Payer = "EMPLOYER" | "UWV" | "UNPAID";
export type DeadlineAnchor = "WEEKS_AFTER_BIRTH" | "MONTHS_AFTER_BIRTH" | "YEARS_AFTER_BIRTH" | "NONE";

export type Supplement = {
  id: string;
  contractId: string;
  leaveTypeId: string;
  topUpToPercent: number | null;
  extraWeeks: number | null;
  deadlineOverrideMonths: number | null;
  notes: string | null;
};

export type Contract = {
  id: string;
  employerName: string;
  employerEmail: string;
  hoursPerWeek: number;
  grossMonthlySalary: number;
  startDate: DateOnly;
  endDate: DateOnly | null;
  notes: string | null;
  pensionPercent: number | null;
  pensionBase: number | null;
  wgaPercent: number | null;
  wgaBase: number | null;
  wiaExcedent: number | null;
  grossExpenseAllowance: number | null;
  bijtellingPercent: number | null;
  bijtellingBase: number | null;
  netExpenseAllowance: number | null;
  applyTaxCredits: boolean;
  supplements: Supplement[];
};

export type Child = { id: string; name: string; dateOfBirth: DateOnly };

export type LeaveType = {
  id: string;
  code: string;
  name: string;
  weeksMultiplier: number;
  payer: Payer;
  payPercent: number | null;
  deadlineAnchor: DeadlineAnchor;
  deadlineValue: number | null;
  fallbackLeaveTypeId: string | null;
  colorHex: string | null;
  sortOrder: number;
  isStatutory: boolean;
};

export type LeaveEntry = {
  id: string;
  date: DateOnly;
  hours: number;
  childId: string;
  leaveTypeId: string;
  contractId: string;
  note: string | null;
};

export type DeadlineStatus = "OK" | "SOON" | "EXPIRED" | "DONE" | "NONE";

export type Balance = {
  childId: string;
  childName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  colorHex: string | null;
  entitlement: {
    referenceContract: Pick<Contract, "employerName" | "hoursPerWeek"> | null;
    hoursPerWeek: number;
    weeks: number;
    payer: Payer;
    payPercent: number | null;
    topUpToPercent: number | null;
  };
  carriedInHours: number;
  carriedOutHours: number;
  entitledHours: number;
  usedHours: number;
  remainingHours: number;
  deadline: DateOnly | null;
  deadlineStatus: DeadlineStatus;
  daysUntilDeadline: number | null;
  usedAfterDeadlineHours: number;
  overBookedHours: number;
};

export type PayslipLine = { label: string; base?: number; percent?: number; amount: number };

export type Payslip = {
  grossTotal: number;
  baseSalary: number;
  grossExpenseAllowance: number;
  deductions: PayslipLine[];
  bijtelling: number;
  taxableIncome: number;
  payrollTax: number;
  effectiveTaxRate: number;
  netSalary: number;
  netExpenseAllowance: number;
  netPayout: number;
};

export type MonthImpact = {
  month: string;
  normalGross: number;
  workedGross: number;
  employerPaid: number;
  uwvBenefit: number;
  employerTopUp: number;
  totalReceived: number;
  difference: number;
  leaveHours: number;
  lines: {
    leaveTypeId: string;
    leaveTypeName: string;
    hours: number;
    dayEquivalents: number;
    employerPaid: number;
    uwvBenefit: number;
    employerTopUp: number;
    received: number;
    loss: number;
  }[];
  entriesWithoutContract: number;
  net: {
    normal: Payslip;
    actual: Payslip;
    netDifference: number;
    grossDifference: number;
    taxDifference: number;
  } | null;
};

export type Overview = {
  today: DateOnly;
  currentMonth: string;
  setup: { contracts: number; children: number };
  contract: { employerName: string; hoursPerWeek: number } | null;
  balances: Balance[];
  impact: MonthImpact | null;
  reportDeadlineDays: number;
  reportingMonth: DateOnly;
};

export type BalancesResponse = { today: DateOnly; children: Child[]; balances: Balance[] };

export type SalaryResponse = {
  today: DateOnly;
  month: string;
  hasContracts: boolean;
  impact: MonthImpact | null;
};

export type MailResult = {
  to: string;
  subject: string;
  body: string;
  href: string;
  tooLong: boolean;
  entryCount: number;
  totalHours: number;
};

export type MailResponse = {
  today: DateOnly;
  monthStart: DateOnly;
  reportingMonth: DateOnly;
  reportDeadlineDays: number;
  contract: { employerName: string; employerEmail: string } | null;
  mail: MailResult | null;
};

export type MonthResponse = {
  month: string;
  today: DateOnly;
  entries: LeaveEntry[];
  children: Child[];
  leaveTypes: LeaveType[];
  balances: Balance[];
  hoursPerWorkdayByDate: Record<string, number>;
  daysWithoutContract: number;
  contracts: { employerName: string; hoursPerWeek: number }[];
};

export type ContractsResponse = { today: DateOnly; contracts: Contract[]; overlaps: string[] };

export type ChildrenResponse = { today: DateOnly; children: Child[] };

export type MutationResult<T = undefined> = { ok: true; message?: string; data?: T };
