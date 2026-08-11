import { notFound } from "next/navigation";
import { ContractForm } from "@/components/ContractForm";
import { getContract, getLeaveTypes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, leaveTypes] = await Promise.all([getContract(id), getLeaveTypes()]);

  if (!contract) notFound();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{contract.employerName}</h1>
      <ContractForm contract={contract} leaveTypes={leaveTypes} />
    </div>
  );
}
