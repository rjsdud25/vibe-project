import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await context.params;
  if (!teamId) {
    return jsonError("팀 ID가 필요합니다.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.", 400);
  }
  const o = body as Record<string, unknown>;
  const password =
    typeof o.password === "string" ? o.password.trim().toUpperCase() : "";
  if (!password) {
    return jsonError("비밀번호를 입력해 주세요.", 400);
  }

  const supabase = createServerSupabaseClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, invite_code")
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 500);
  }
  if (!team) {
    return jsonError("팀을 찾을 수 없습니다.", 404);
  }
  if ((team.invite_code as string) !== password) {
    return jsonError("비밀번호가 올바르지 않습니다.", 401);
  }

  return Response.json({ ok: true as const });
}
