import { ChildrenManager } from "@/components/ChildrenManager";
import { getChildren } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function KinderenPage() {
  const kinderen = await getChildren();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Kinderen</h1>
      <ChildrenManager kinderen={kinderen} />
    </div>
  );
}
