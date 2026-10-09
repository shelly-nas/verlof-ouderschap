-- Referentiedata: de vier wettelijke verlofsoorten.
--
-- Idempotent: ON CONFLICT DO NOTHING laat bestaande rijen (en wat de gebruiker
-- daaraan heeft aangepast, zoals naam of kleur) ongemoeid.
--
-- | Verlofsoort                 | Weken | Betaald door | %   | Opnemen t/m              |
-- | Geboorteverlof              | 1     | Werkgever    | 100 | 4 weken na de geboorte   |
-- | Aanvullend geboorteverlof   | 5     | UWV          | 70  | 6 maanden na de geboorte |
-- | Betaald ouderschapsverlof   | 9     | UWV          | 70  | dag voor 1e verjaardag   |
-- | Onbetaald ouderschapsverlof | 17    | -            | 0   | tot het kind 8 jaar is   |

-- Onbetaald ouderschapsverlof eerst: betaald ouderschapsverlof verwijst ernaar
-- als fallback voor het restant dat na de eerste verjaardag doorschuift.
INSERT INTO "LeaveType"
    ("id", "code", "name", "weeksMultiplier", "payer", "payPercent",
     "deadlineAnchor", "deadlineValue", "colorHex", "sortOrder")
VALUES
    ('lt-onbetaald-ouderschapsverlof', 'ONBETAALD_OUDERSCHAPSVERLOF',
     'Onbetaald ouderschapsverlof', 17, 'UNPAID', NULL, 'YEARS_AFTER_BIRTH', 8, '#94a3b8', 40)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "LeaveType"
    ("id", "code", "name", "weeksMultiplier", "payer", "payPercent",
     "deadlineAnchor", "deadlineValue", "colorHex", "sortOrder")
VALUES
    ('lt-geboorteverlof', 'GEBOORTEVERLOF',
     'Geboorteverlof', 1, 'EMPLOYER', 100, 'WEEKS_AFTER_BIRTH', 4, '#22c55e', 10),
    ('lt-aanvullend-geboorteverlof', 'AANVULLEND_GEBOORTEVERLOF',
     'Aanvullend geboorteverlof', 5, 'UWV', 70, 'MONTHS_AFTER_BIRTH', 6, '#3b82f6', 20)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "LeaveType"
    ("id", "code", "name", "weeksMultiplier", "payer", "payPercent",
     "deadlineAnchor", "deadlineValue", "fallbackLeaveTypeId", "colorHex", "sortOrder")
SELECT
    'lt-betaald-ouderschapsverlof', 'BETAALD_OUDERSCHAPSVERLOF',
    'Betaald ouderschapsverlof', 9, 'UWV', 70, 'YEARS_AFTER_BIRTH', 1, "id", '#8b5cf6', 30
FROM "LeaveType"
WHERE "code" = 'ONBETAALD_OUDERSCHAPSVERLOF'
ON CONFLICT ("code") DO NOTHING;
