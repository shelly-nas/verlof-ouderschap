import { ContractForm } from "@/components/ContractForm";
import { getLeaveTypes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NieuwContractPage() {
  const leaveTypes = await getLeaveTypes();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Nieuw contract</h1>
      <ContractForm contract={null} leaveTypes={leaveTypes} />
    </div>
  );
}
