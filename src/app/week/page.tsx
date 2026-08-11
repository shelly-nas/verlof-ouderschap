import { redirect } from "next/navigation";
import { isoWeekKey, today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function WeekIndexPage() {
  redirect(`/week/${isoWeekKey(today())}`);
}
