import { TeamDashboard } from "@/components/team-dashboard";

export default async function TeamDashboardPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return <TeamDashboard teamId={teamId} />;
}
