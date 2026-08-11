import { NextResponse } from "next/server";
import { type LeaveRowInput, saveMonth, savePeriod } from "@/lib/actions";
import { getLeaveEntries } from "@/lib/queries";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** GET /api/entries?from=2026-08-01&to=2026-08-31 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (from && to) {
    if (!DATE.test(from) || !DATE.test(to)) {
      return NextResponse.json(
        { error: "Gebruik het formaat jjjj-mm-dd voor from en to." },
        { status: 400 },
      );
    }
    return NextResponse.json(await getLeaveEntries({ from, to }));
  }

  return NextResponse.json(await getLeaveEntries());
}

/**
 * POST /api/entries — slaat een periode op als één transactie.
 *
 * Body: `{ month: "2026-08", rows: [...] }` voor een hele maand, of
 * `{ from, to, rows }` voor een vrije periode. De rows vormen de gewenste
 * eindtoestand; wat er niet in staat wordt verwijderd.
 */
export async function POST(request: Request) {
  let body: { month?: string; from?: string; to?: string; rows?: LeaveRowInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const rows = body.rows ?? [];

  const result = body.month
    ? MONTH.test(body.month)
      ? await saveMonth(body.month, rows)
      : { ok: false as const, errors: ["month heeft niet het formaat jjjj-mm."] }
    : body.from && body.to
      ? DATE.test(body.from) && DATE.test(body.to)
        ? await savePeriod(body.from, body.to, rows)
        : { ok: false as const, errors: ["from en to hebben niet het formaat jjjj-mm-dd."] }
      : { ok: false as const, errors: ["Geef month, of from en to op."] };

  return result.ok
    ? NextResponse.json({ ok: true, message: result.message })
    : NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
}
