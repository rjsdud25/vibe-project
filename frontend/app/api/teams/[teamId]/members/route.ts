import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await context.params;
  if (!teamId) {
    return jsonError("팀 ID가 필요합니다.", 400);
  }

  const supabase = await createServerSupabaseClient();
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamErr) {
    return jsonError(teamErr.message, 500);
  }
  if (!team) {
    return jsonError("팀을 찾을 수 없습니다.", 404);
  }

  const { data: members, error } = await supabase
    .from("members")
    .select("id, nickname, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  const list = members ?? [];
  const creator_member_id = list[0]?.id as string | undefined;

  return Response.json({
    members: list,
    creator_member_id: creator_member_id ?? null,
  });
}
