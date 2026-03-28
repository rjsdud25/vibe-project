import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VOTE_MS = 10 * 60 * 1000;

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError("세션 ID가 필요합니다.", 400);
  }

  const supabase = await createServerSupabaseClient();

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, status, team_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) {
    return jsonError(sErr.message, 500);
  }
  if (!session) {
    return jsonError("세션을 찾을 수 없습니다.", 404);
  }
  if (session.status !== "proposing") {
    return jsonError("제안 단계가 아닙니다.", 403);
  }

  const { count: proposalCount, error: pcErr } = await supabase
    .from("proposals")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (pcErr) {
    return jsonError(pcErr.message, 500);
  }
  if (!proposalCount || proposalCount < 1) {
    return jsonError("제안된 메뉴가 없습니다.", 403);
  }

  const vote_started_at = new Date().toISOString();

  const { data: updated, error: uErr } = await supabase
    .from("sessions")
    .update({
      status: "voting",
      vote_started_at,
    })
    .eq("id", sessionId)
    .eq("status", "proposing")
    .select("id, status, vote_started_at")
    .maybeSingle();

  if (uErr) {
    return jsonError(uErr.message, 500);
  }
  if (!updated) {
    return jsonError("이미 투표가 시작되었거나 상태를 바꿀 수 없습니다.", 403);
  }

  const start = new Date(updated.vote_started_at as string).getTime();
  const vote_ends_at = new Date(start + VOTE_MS).toISOString();

  return Response.json({
    session_id: updated.id,
    status: updated.status,
    vote_started_at: updated.vote_started_at,
    vote_ends_at,
  });
}
