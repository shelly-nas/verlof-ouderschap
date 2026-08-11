-- Het maximumdagloon vervalt: UWV-verlof rekent voortaan 70% van het eigen
-- dagloon zonder aftopping. Daarmee vervallen ook de vlaggen die alleen
-- bestonden om met die aftopping om te gaan.

ALTER TABLE "LeaveType" DROP COLUMN "cappedAtMaxDagloon";

ALTER TABLE "EmployerSupplement" DROP COLUMN "topUpUncapped";

DROP TABLE "MaxDagloon";
