-- CreateEnum
CREATE TYPE "PayerKind" AS ENUM ('EMPLOYER', 'UWV', 'UNPAID');

-- CreateEnum
CREATE TYPE "DeadlineAnchor" AS ENUM ('WEEKS_AFTER_BIRTH', 'MONTHS_AFTER_BIRTH', 'YEARS_AFTER_BIRTH', 'NONE');

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "employerEmail" TEXT NOT NULL,
    "hoursPerWeek" DECIMAL(5,2) NOT NULL,
    "grossMonthlySalary" DECIMAL(10,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerSupplement" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "topUpToPercent" DECIMAL(5,2),
    "topUpUncapped" BOOLEAN NOT NULL DEFAULT true,
    "extraWeeks" DECIMAL(5,2),
    "deadlineOverrideMonths" INTEGER,
    "notes" TEXT,

    CONSTRAINT "EmployerSupplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weeksMultiplier" DECIMAL(5,2) NOT NULL,
    "payer" "PayerKind" NOT NULL,
    "payPercent" DECIMAL(5,2),
    "cappedAtMaxDagloon" BOOLEAN NOT NULL DEFAULT false,
    "deadlineAnchor" "DeadlineAnchor" NOT NULL,
    "deadlineValue" INTEGER,
    "fallbackLeaveTypeId" TEXT,
    "isStatutory" BOOLEAN NOT NULL DEFAULT true,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "childId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaxDagloon" (
    "id" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "amount" DECIMAL(8,2) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxDagloon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "EmployerSupplement_leaveTypeId_idx" ON "EmployerSupplement"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerSupplement_contractId_leaveTypeId_key" ON "EmployerSupplement"("contractId", "leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE INDEX "LeaveType_fallbackLeaveTypeId_idx" ON "LeaveType"("fallbackLeaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveEntry_date_idx" ON "LeaveEntry"("date");

-- CreateIndex
CREATE INDEX "LeaveEntry_childId_leaveTypeId_idx" ON "LeaveEntry"("childId", "leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveEntry_contractId_idx" ON "LeaveEntry"("contractId");

-- CreateIndex
CREATE INDEX "LeaveEntry_leaveTypeId_idx" ON "LeaveEntry"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveEntry_date_childId_leaveTypeId_key" ON "LeaveEntry"("date", "childId", "leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "MaxDagloon_validFrom_key" ON "MaxDagloon"("validFrom");

-- CreateIndex
CREATE INDEX "MaxDagloon_validFrom_idx" ON "MaxDagloon"("validFrom");

-- AddForeignKey
ALTER TABLE "EmployerSupplement" ADD CONSTRAINT "EmployerSupplement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerSupplement" ADD CONSTRAINT "EmployerSupplement_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_fallbackLeaveTypeId_fkey" FOREIGN KEY ("fallbackLeaveTypeId") REFERENCES "LeaveType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
