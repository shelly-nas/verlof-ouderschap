import { NextResponse } from "next/server";
import { type WeekRowInput, saveWeek } from "@/lib/actions";
import { type DateOnly, startOfIsoWeek } from "@/lib/dates";
import { getLeaveEntries } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/entries?from=2026-03-30&to=2026-04-05 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (from && to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
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
 * POST /api/entries — slaat een hele week op als één transactie.
 * Body: { weekStart: "2026-03-30", rows: [{ date, childId, leaveTypeId, hours }] }
 */
export async function POST(request: Request) {
  let body: { weekStart?: string; rows?: WeekRowInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
    return NextResponse.json(
      { error: "weekStart ontbreekt of heeft niet het formaat jjjj-mm-dd." },
      { status: 400 },
    );
  }

  const weekStart = startOfIsoWeek(body.weekStart as DateOnly);
  const result = await saveWeek(weekStart, body.rows ?? []);

  return result.ok
    ? NextResponse.json({ ok: true, message: result.message })
    : NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
}
