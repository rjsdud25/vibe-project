import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** 대시보드용 팀 단건 조회 (명세 보완) */
export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await context.params;
  if (!teamId) {
    return jsonError("팀 ID가 필요합니다.", 400);
  }

  const supabase = createServerSupabaseClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, invite_code, created_at")
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 500);
  }
  if (!team) {
    return jsonError("팀을 찾을 수 없습니다.", 404);
  }

  return Response.json(team);
}
