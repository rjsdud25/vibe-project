import { jsonError } from "@/lib/api-response";
import { todayDateStringKst } from "@/lib/date";
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

  const date = todayDateStringKst();

  const { data: existing, error: selErr } = await supabase
    .from("sessions")
    .select(
      "id, team_id, date, status, vote_started_at, decided_menu, created_at"
    )
    .eq("team_id", teamId)
    .eq("date", date)
    .maybeSingle();

  if (selErr) {
    return jsonError(selErr.message, 500);
  }

  if (existing) {
    return Response.json(existing);
  }

  const { data: created, error: insErr } = await supabase
    .from("sessions")
    .insert({ team_id: teamId, date, status: "proposing" })
    .select(
      "id, team_id, date, status, vote_started_at, decided_menu, created_at"
    )
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      const { data: race } = await supabase
        .from("sessions")
        .select(
          "id, team_id, date, status, vote_started_at, decided_menu, created_at"
        )
        .eq("team_id", teamId)
        .eq("date", date)
        .single();
      if (race) {
        return Response.json(race);
      }
    }
    return jsonError(insErr.message, 500);
  }

  return Response.json(created);
}
