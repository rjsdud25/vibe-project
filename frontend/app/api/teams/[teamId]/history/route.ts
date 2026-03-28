import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await context.params;
  if (!teamId) {
    return jsonError("팀 ID가 필요합니다.", 400);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10)
  );
  const from = (page - 1) * limit;
  const to = from + limit;

  const supabase = createServerSupabaseClient();

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

  const { count: totalCompleted, error: cntErr } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("status", "completed");

  if (cntErr) {
    return jsonError(cntErr.message, 500);
  }

  const { data: sessions, error: sErr } = await supabase
    .from("sessions")
    .select("id, date, decided_menu")
    .eq("team_id", teamId)
    .eq("status", "completed")
    .order("date", { ascending: false })
    .range(from, to - 1);

  if (sErr) {
    return jsonError(sErr.message, 500);
  }

  const { count: totalMembers, error: mErr } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId);

  if (mErr) {
    return jsonError(mErr.message, 500);
  }

  const tm = totalMembers ?? 0;

  const history = await Promise.all(
    (sessions ?? []).map(async (s) => {
      const sessionId = s.id as string;
      const decided_menu = s.decided_menu as string | null;
      let vote_count = 0;

      if (decided_menu) {
        const { data: props } = await supabase
          .from("proposals")
          .select("id")
          .eq("session_id", sessionId)
          .eq("menu_name", decided_menu)
          .limit(1);

        const propId = props?.[0]?.id as string | undefined;
        if (propId) {
          const { count } = await supabase
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("session_id", sessionId)
            .eq("proposal_id", propId);
          vote_count = count ?? 0;
        }
      }

      return {
        session_id: sessionId,
        date: s.date as string,
        decided_menu: decided_menu ?? "",
        vote_count,
        total_members: tm,
      };
    })
  );

  const total = totalCompleted ?? 0;
  const has_next = page * limit < total;

  return Response.json({
    history,
    page,
    limit,
    has_next,
  });
}
