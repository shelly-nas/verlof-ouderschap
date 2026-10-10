import { readFileSync } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { getPool } from "./db";
import { balancesFor } from "./domain/balances";
import { activeContract, contractForDate, findContractOverlaps, hoursPerWorkday } from "./domain/contracts";
import { type DateOnly, endOfMonth, monthKey, startOfMonth, today } from "./domain/dates";
import { buildLeaveEmail, daysUntilDeadline, reportingMonthFor } from "./domain/mailto";
import { type MonthImpact, monthImpact } from "./domain/salary";
import {
  type ActionResult,
  MONTH_PATTERN,
  copyPreviousMonth,
  deleteChild,
  deleteContract,
  deleteLeaveType,
  getAppData,
  getChildren,
  getContract,
  getContracts,
  getLeaveEntries,
  getLeaveTypes,
  saveChild,
  saveContract,
  saveLeaveType,
  saveMonth,
  savePeriod,
} from "./repo";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** De gedeployde commit (APP_VERSION uit compose), lokaal de versie uit package.json. */
export const version: string =
  process.env.APP_VERSION ||
  JSON.parse(readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8")).version;

function send<T>(res: Response, result: ActionResult<T>) {
  if (result.ok) {
    res.json({ ok: true, message: result.message, data: result.data });
  } else {
    res
      .status(result.status ?? 400)
      .json({ ok: false, errors: result.errors, fieldErrors: result.fieldErrors });
  }
}

/** ?maand=jjjj-mm, of de huidige maand. */
function monthParam(req: Request, now: DateOnly): string {
  const value = req.query.maand;
  return typeof value === "string" && MONTH_PATTERN.test(value) ? value : monthKey(now);
}

function safeMonthImpact(params: Parameters<typeof monthImpact>[0]): MonthImpact | null {
  try {
    return monthImpact(params);
  } catch (error) {
    console.error("Salarisberekening mislukt", error);
    return null;
  }
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  const api = express.Router();

  api.get("/health", async (_req, res) => {
    try {
      await getPool().query("SELECT 1");
      res.json({ status: "ok", version });
    } catch (error) {
      res.status(503).json({ status: "error", version, message: (error as Error).message });
    }
  });

  // Schermen. Elke route rekent met de rekenkern en geeft precies terug wat
  // het scherm toont; de client formatteert alleen.

  api.get("/overview", async (_req, res) => {
    const { contracts, children, leaveTypes, supplements, entries } = await getAppData();
    const now = today();
    const currentMonth = monthKey(now);
    const contract = activeContract(contracts, now);

    const ready = contracts.length > 0 && children.length > 0;
    res.json({
      today: now,
      currentMonth,
      setup: { contracts: contracts.length, children: children.length },
      contract: contract && {
        employerName: contract.employerName,
        hoursPerWeek: contract.hoursPerWeek,
      },
      balances: ready
        ? balancesFor({ children, leaveTypes, contracts, supplements, entries, today: now })
        : [],
      impact: ready
        ? safeMonthImpact({ month: currentMonth, entries, contracts, leaveTypes, supplements })
        : null,
      reportDeadlineDays: daysUntilDeadline(now),
      reportingMonth: reportingMonthFor(now),
    });
  });

  api.get("/balances", async (_req, res) => {
    const { contracts, children, leaveTypes, supplements, entries } = await getAppData();
    const now = today();
    res.json({
      today: now,
      children,
      balances: balancesFor({ children, leaveTypes, contracts, supplements, entries, today: now }),
    });
  });

  api.get("/salary", async (req, res) => {
    const { contracts, leaveTypes, supplements, entries } = await getAppData();
    const now = today();
    const month = monthParam(req, now);
    res.json({
      today: now,
      month,
      hasContracts: contracts.length > 0,
      impact:
        contracts.length > 0
          ? safeMonthImpact({ month, entries, contracts, leaveTypes, supplements })
          : null,
    });
  });

  api.get("/mail", async (req, res) => {
    const { contracts, children, leaveTypes, entries } = await getAppData();
    const now = today();
    const monthStart = startOfMonth(`${monthParam(req, now)}-01`);
    const contract = activeContract(contracts, now);

    res.json({
      today: now,
      monthStart,
      reportingMonth: reportingMonthFor(now),
      reportDeadlineDays: daysUntilDeadline(now),
      contract: contract && {
        employerName: contract.employerName,
        employerEmail: contract.employerEmail,
      },
      mail: contract
        ? buildLeaveEmail({
            employerName: contract.employerName,
            employerEmail: contract.employerEmail,
            entries,
            children,
            leaveTypes,
            monthStart,
          })
        : null,
    });
  });

  // Maand invoeren

  api.get("/months/:month", async (req, res) => {
    const { month } = req.params;
    if (!MONTH_PATTERN.test(month)) {
      res.status(400).json({ ok: false, errors: ["Gebruik het formaat jjjj-mm."] });
      return;
    }

    const monthStart = startOfMonth(`${month}-01`);
    const monthEnd = endOfMonth(monthStart);
    const [{ contracts, children, leaveTypes, supplements, entries }, monthEntries] =
      await Promise.all([getAppData(), getLeaveEntries({ from: monthStart, to: monthEnd })]);
    const now = today();

    // Per dag het contract dat er geldt; de kalender leidt daar het rooster uit af.
    const hoursPerWorkdayByDate: Record<string, number> = {};
    const contractsInMonth = new Map<string, { employerName: string; hoursPerWeek: number }>();
    let daysWithoutContract = 0;

    const lastDay = Number(monthEnd.slice(8, 10));
    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${month}-${`${day}`.padStart(2, "0")}`;
      const contract = contractForDate(contracts, date);
      if (contract) {
        hoursPerWorkdayByDate[date] = hoursPerWorkday(contract);
        contractsInMonth.set(contract.id, {
          employerName: contract.employerName,
          hoursPerWeek: contract.hoursPerWeek,
        });
      } else {
        daysWithoutContract += 1;
      }
    }

    res.json({
      month,
      today: now,
      entries: monthEntries,
      children,
      leaveTypes,
      balances: balancesFor({ children, leaveTypes, contracts, supplements, entries, today: now }),
      hoursPerWorkdayByDate,
      daysWithoutContract,
      contracts: [...contractsInMonth.values()],
    });
  });

  api.put("/months/:month", async (req, res) => {
    send(res, await saveMonth(req.params.month, req.body?.rows ?? []));
  });

  api.post("/months/:month/copy-previous", async (req, res) => {
    send(res, await copyPreviousMonth(req.params.month));
  });

  /** GET /api/entries?from=2026-08-01&to=2026-08-31 */
  api.get("/entries", async (req, res) => {
    const { from, to } = req.query;
    if (from !== undefined || to !== undefined) {
      if (typeof from !== "string" || typeof to !== "string" || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
        res.status(400).json({ ok: false, errors: ["Gebruik het formaat jjjj-mm-dd voor from en to."] });
        return;
      }
      res.json(await getLeaveEntries({ from, to }));
      return;
    }
    res.json(await getLeaveEntries());
  });

  /**
   * POST /api/entries — slaat een periode op als één transactie. Body:
   * `{ from, to, rows }`; de rows zijn de gewenste eindtoestand.
   */
  api.post("/entries", async (req, res) => {
    const { from, to, rows } = req.body ?? {};
    if (typeof from !== "string" || typeof to !== "string" || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      res.status(400).json({ ok: false, errors: ["Geef from en to op in het formaat jjjj-mm-dd."] });
      return;
    }
    send(res, await savePeriod(from, to, rows ?? []));
  });

  // Contracten

  api.get("/contracts", async (_req, res) => {
    const contracts = await getContracts();
    res.json({
      today: today(),
      contracts,
      overlaps: findContractOverlaps(contracts).map((overlap) => overlap.message),
    });
  });

  api.get("/contracts/:id", async (req, res) => {
    const contract = await getContract(req.params.id);
    if (!contract) {
      res.status(404).json({ ok: false, errors: ["Contract niet gevonden."] });
      return;
    }
    res.json(contract);
  });

  api.post("/contracts", async (req, res) => send(res, await saveContract(null, req.body)));
  api.put("/contracts/:id", async (req, res) => send(res, await saveContract(req.params.id, req.body)));
  api.delete("/contracts/:id", async (req, res) => send(res, await deleteContract(req.params.id)));

  // Kinderen

  api.get("/children", async (_req, res) => {
    res.json({ today: today(), children: await getChildren() });
  });
  api.post("/children", async (req, res) => send(res, await saveChild(null, req.body)));
  api.put("/children/:id", async (req, res) => send(res, await saveChild(req.params.id, req.body)));
  api.delete("/children/:id", async (req, res) => send(res, await deleteChild(req.params.id)));

  // Verlofsoorten

  api.get("/leave-types", async (_req, res) => res.json(await getLeaveTypes()));
  api.post("/leave-types", async (req, res) => send(res, await saveLeaveType(null, req.body)));
  api.put("/leave-types/:id", async (req, res) => send(res, await saveLeaveType(req.params.id, req.body)));
  api.delete("/leave-types/:id", async (req, res) => send(res, await deleteLeaveType(req.params.id)));

  api.use((_req, res) => {
    res.status(404).json({ ok: false, errors: ["Onbekende API-route."] });
  });

  app.use("/api", api);

  // Express 5 stuurt fouten uit async handlers hierheen.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ ok: false, errors: ["Ongeldige JSON."] });
      return;
    }
    res.status(500).json({
      ok: false,
      errors: ["Er ging iets mis op de server. Probeer het opnieuw."],
    });
  });

  return app;
}
