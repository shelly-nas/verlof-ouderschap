import { WeekScreen } from "@/components/WeekScreen";
import { isoWeekKey, today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function WeekIndexPage() {
  // Rendert de huidige week rechtstreeks; een redirect naar /week/[isoWeek] zou
  // een extra navigatie kosten en de weeknavigatie laten knipperen.
  return <WeekScreen isoWeek={isoWeekKey(today())} />;
}
