-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "applyTaxCredits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bijtellingBase" DECIMAL(10,2),
ADD COLUMN     "bijtellingPercent" DECIMAL(6,3),
ADD COLUMN     "grossExpenseAllowance" DECIMAL(10,2),
ADD COLUMN     "netExpenseAllowance" DECIMAL(10,2),
ADD COLUMN     "pensionBase" DECIMAL(10,2),
ADD COLUMN     "pensionPercent" DECIMAL(6,3),
ADD COLUMN     "wgaBase" DECIMAL(10,2),
ADD COLUMN     "wgaPercent" DECIMAL(6,3),
ADD COLUMN     "wiaExcedent" DECIMAL(10,2);
