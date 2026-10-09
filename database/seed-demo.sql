-- Demodata voor lokaal en acc. Komt nooit in het database-image.
--
-- Twee contracten met een wissel op de eerste van deze maand (40 -> 32 uur),
-- een kind van ruim drie maanden, het geboorteverlof en een deel van het
-- aanvullend geboorteverlof direct na de geboorte, en elke woensdag betaald
-- ouderschapsverlof van vorige maand tot en met volgende maand. Alles is
-- relatief aan vandaag, zodat de demo nooit veroudert.
--
-- Staat er al een contract, dan doet dit script niets.
DO $$
DECLARE
    switch_date DATE := date_trunc('month', CURRENT_DATE)::date;
    birth DATE := CURRENT_DATE - 100;
BEGIN
    IF EXISTS (SELECT 1 FROM "Contract") THEN
        RAISE NOTICE 'Er staan al contracten; demodata overgeslagen.';
        RETURN;
    END IF;

    INSERT INTO "Contract"
        ("id", "employerName", "employerEmail", "hoursPerWeek", "grossMonthlySalary",
         "startDate", "endDate", "pensionPercent", "pensionBase", "wgaPercent", "wgaBase",
         "wiaExcedent", "netExpenseAllowance", "applyTaxCredits")
    VALUES
        ('demo-contract-noord', 'Bureau Noord', 'hr@bureaunoord.nl', 40, 4200,
         switch_date - INTERVAL '3 years', switch_date - 1, 7.5, 2900, 0.144, 4200,
         7.79, 50, true),
        ('demo-contract-zuid', 'Studio Zuid', 'personeelszaken@studiozuid.nl', 32, 3600,
         switch_date, NULL, 7.5, 2500, NULL, NULL, NULL, 65, true);

    -- Studio Zuid vult het betaald ouderschapsverlof aan tot 85%.
    INSERT INTO "EmployerSupplement" ("id", "contractId", "leaveTypeId", "topUpToPercent", "notes")
    SELECT 'demo-supplement-zuid', 'demo-contract-zuid', "id", 85, 'Cao artikel 7.4'
    FROM "LeaveType" WHERE "code" = 'BETAALD_OUDERSCHAPSVERLOF';

    INSERT INTO "Child" ("id", "name", "dateOfBirth")
    VALUES ('demo-kind-noor', 'Noor', birth);

    -- De eerste twintig werkdagen na de geboorte: vijf dagen geboorteverlof,
    -- daarna vijftien dagen aanvullend geboorteverlof.
    INSERT INTO "LeaveEntry" ("id", "date", "hours", "childId", "leaveTypeId", "contractId")
    SELECT 'demo-' || workday::text, workday, 8, 'demo-kind-noor', lt."id", 'demo-contract-noord'
    FROM (
        SELECT day::date AS workday, row_number() OVER (ORDER BY day) AS n
        FROM generate_series(birth + 1, birth + 40, INTERVAL '1 day') AS day
        WHERE EXTRACT(ISODOW FROM day) < 6
    ) AS days
    JOIN "LeaveType" lt
      ON lt."code" = CASE WHEN days.n <= 5 THEN 'GEBOORTEVERLOF' ELSE 'AANVULLEND_GEBOORTEVERLOF' END
    WHERE days.n <= 20;

    -- Elke woensdag betaald ouderschapsverlof, met de uren van het contract
    -- dat die dag gold.
    INSERT INTO "LeaveEntry" ("id", "date", "hours", "childId", "leaveTypeId", "contractId")
    SELECT 'demo-ov-' || day::date::text, day::date,
           CASE WHEN day::date < switch_date THEN 8 ELSE 6.4 END,
           'demo-kind-noor', lt."id",
           CASE WHEN day::date < switch_date THEN 'demo-contract-noord' ELSE 'demo-contract-zuid' END
    FROM generate_series(
        switch_date - INTERVAL '1 month',
        switch_date + INTERVAL '2 months' - INTERVAL '1 day',
        INTERVAL '1 day'
    ) AS day
    JOIN "LeaveType" lt ON lt."code" = 'BETAALD_OUDERSCHAPSVERLOF'
    WHERE EXTRACT(ISODOW FROM day) = 3
      AND day::date > birth + 40;
END $$;
