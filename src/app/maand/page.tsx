import { MonthScreen } from "@/components/MonthScreen";
import { monthKey, today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function MaandIndexPage() {
  // Rendert de huidige maand direct; een redirect naar /maand/[maand] kostte een
  // extra navigatie en liet Next struikelen over een performance-meting.
  return <MonthScreen month={monthKey(today())} />;
}
