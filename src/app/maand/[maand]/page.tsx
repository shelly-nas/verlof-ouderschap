import { notFound } from "next/navigation";
import { MonthScreen } from "@/components/MonthScreen";

export const dynamic = "force-dynamic";

export default async function MaandPage({
  params,
}: {
  params: Promise<{ maand: string }>;
}) {
  const { maand } = await params;
  if (!/^\d{4}-\d{2}$/.test(maand)) notFound();

  return <MonthScreen month={maand} />;
}
