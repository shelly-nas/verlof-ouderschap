-- Schema van de verlofregistratie.
--
-- Tabel- en kolomnamen zijn bewust gelijk aan die van de eerdere Prisma-versie
-- van de app (CamelCase, tussen dubbele quotes). Een bestaande database kan
-- daardoor ongewijzigd door deze versie worden overgenomen; zie de README.
--
-- Alle datumvelden zijn DATE: een verlofdag is een kalenderdag, geen moment in
-- de tijd. Dat houdt zomertijd en tijdzones buiten alle berekeningen.

CREATE TYPE "PayerKind" AS ENUM ('EMPLOYER', 'UWV', 'UNPAID');

CREATE TYPE "DeadlineAnchor" AS ENUM (
    'WEEKS_AFTER_BIRTH',
    'MONTHS_AFTER_BIRTH',
    'YEARS_AFTER_BIRTH',
    'NONE'
);

CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "employerEmail" TEXT NOT NULL,
    "hoursPerWeek" DECIMAL(5,2) NOT NULL,
    "grossMonthlySalary" DECIMAL(10,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    -- Posten van de loonstrook, voor de netto-berekening. Alles optioneel:
    -- laat je ze leeg, dan rekent de app alleen bruto.
    "pensionPercent" DECIMAL(6,3),
    "pensionBase" DECIMAL(10,2),
    "wgaPercent" DECIMAL(6,3),
    "wgaBase" DECIMAL(10,2),
    "wiaExcedent" DECIMAL(10,2),
    "grossExpenseAllowance" DECIMAL(10,2),
    "bijtellingPercent" DECIMAL(6,3),
    "bijtellingBase" DECIMAL(10,2),
    "netExpenseAllowance" DECIMAL(10,2),
    "applyTaxCredits" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    -- Recht = weeksMultiplier * contract.hoursPerWeek, per kind.
    "weeksMultiplier" DECIMAL(5,2) NOT NULL,
    "payer" "PayerKind" NOT NULL,
    "payPercent" DECIMAL(5,2),
    "deadlineAnchor" "DeadlineAnchor" NOT NULL,
    "deadlineValue" INTEGER,
    -- Restant schuift na een verstreken deadline door naar deze verlofsoort
    -- (betaald ouderschapsverlof -> onbetaald ouderschapsverlof).
    "fallbackLeaveTypeId" TEXT,
    "isStatutory" BOOLEAN NOT NULL DEFAULT true,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");
CREATE INDEX "LeaveType_fallbackLeaveTypeId_idx" ON "LeaveType"("fallbackLeaveTypeId");

ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_fallbackLeaveTypeId_fkey"
    FOREIGN KEY ("fallbackLeaveTypeId") REFERENCES "LeaveType"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Bovenwettelijke afspraken van de werkgever. Geen rij = puur wettelijk (UWV).
CREATE TABLE "EmployerSupplement" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "topUpToPercent" DECIMAL(5,2),
    "extraWeeks" DECIMAL(5,2),
    "deadlineOverrideMonths" INTEGER,
    "notes" TEXT,

    CONSTRAINT "EmployerSupplement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployerSupplement_leaveTypeId_idx" ON "EmployerSupplement"("leaveTypeId");
CREATE UNIQUE INDEX "EmployerSupplement_contractId_leaveTypeId_key"
    ON "EmployerSupplement"("contractId", "leaveTypeId");

ALTER TABLE "EmployerSupplement" ADD CONSTRAINT "EmployerSupplement_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerSupplement" ADD CONSTRAINT "EmployerSupplement_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeaveEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "childId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    -- Het contract dat gold op "date", vastgelegd bij opslaan.
    "contractId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveEntry_date_idx" ON "LeaveEntry"("date");
CREATE INDEX "LeaveEntry_childId_leaveTypeId_idx" ON "LeaveEntry"("childId", "leaveTypeId");
CREATE INDEX "LeaveEntry_contractId_idx" ON "LeaveEntry"("contractId");
CREATE INDEX "LeaveEntry_leaveTypeId_idx" ON "LeaveEntry"("leaveTypeId");
CREATE UNIQUE INDEX "LeaveEntry_date_childId_leaveTypeId_key"
    ON "LeaveEntry"("date", "childId", "leaveTypeId");

ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
