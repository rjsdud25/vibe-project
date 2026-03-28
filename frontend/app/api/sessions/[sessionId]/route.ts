import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError("세션 ID가 필요합니다.", 400);
  }

  const supabase = createServerSupabaseClient();

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select(
      "id, team_id, date, status, vote_started_at, decided_menu, created_at"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) {
    return jsonError(sErr.message, 500);
  }
  if (!session) {
    return jsonError("세션을 찾을 수 없습니다.", 404);
  }

  const { data: proposalsRaw, error: pErr } = await supabase
    .from("proposals")
    .select("id, menu_name, member_id, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (pErr) {
    return jsonError(pErr.message, 500);
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("proposal_id")
    .eq("session_id", sessionId);

  const countByProposal = new Map<string, number>();
  for (const row of votes ?? []) {
    const pid = row.proposal_id as string;
    countByProposal.set(pid, (countByProposal.get(pid) ?? 0) + 1);
  }

  const proposals = (proposalsRaw ?? []).map((p) => ({
    id: p.id as string,
    menu_name: p.menu_name as string,
    vote_count: countByProposal.get(p.id as string) ?? 0,
  }));

  return Response.json({
    ...session,
    proposals,
  });
}
