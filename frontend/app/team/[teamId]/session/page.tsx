import { SessionFlow } from "@/components/session-flow";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return <SessionFlow teamId={teamId} />;
}
