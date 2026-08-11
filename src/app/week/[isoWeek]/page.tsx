import { notFound } from "next/navigation";
import { WeekScreen } from "@/components/WeekScreen";
import { parseIsoWeekKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ isoWeek: string }>;
}) {
  const { isoWeek } = await params;

  try {
    parseIsoWeekKey(isoWeek);
  } catch {
    notFound();
  }

  return <WeekScreen isoWeek={isoWeek} />;
}
