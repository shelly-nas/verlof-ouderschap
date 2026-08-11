import { SettingsManager } from "@/components/SettingsManager";
import { getLeaveTypes, getMaxDaglonen } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InstellingenPage() {
  const [leaveTypes, maxDaglonen] = await Promise.all([
    getLeaveTypes(),
    getMaxDaglonen(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Instellingen</h1>
      <SettingsManager leaveTypes={leaveTypes} maxDaglonen={maxDaglonen} />
    </div>
  );
}
