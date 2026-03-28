import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.", 400);
  }
  const o = body as Record<string, unknown>;
  const teamId = typeof o.team_id === "string" ? o.team_id.trim() : "";
  const password =
    typeof o.password === "string" ? o.password.trim().toUpperCase() : "";
  const nickname =
    typeof o.nickname === "string" ? o.nickname.trim() : "";
  const resume = o.resume === true;
  if (!teamId) {
    return jsonError("팀을 선택해 주세요.", 400);
  }
  if (!password) {
    return jsonError("비밀번호를 입력해 주세요.", 400);
  }
  if (!nickname) {
    return jsonError("닉네임을 입력해 주세요.", 400);
  }

  const supabase = createServerSupabaseClient();
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, invite_code")
    .eq("id", teamId)
    .maybeSingle();

  if (teamErr) {
    return jsonError(teamErr.message, 500);
  }
  if (!team) {
    return jsonError("팀을 찾을 수 없습니다.", 404);
  }
  if ((team.invite_code as string) !== password) {
    return jsonError("비밀번호가 올바르지 않습니다.", 401);
  }

  const { data: existing, error: findErr } = await supabase
    .from("members")
    .select("id, team_id, nickname, created_at")
    .eq("team_id", team.id)
    .eq("nickname", nickname)
    .maybeSingle();

  if (findErr) {
    return jsonError(findErr.message, 500);
  }

  if (existing) {
    if (resume) {
      return NextResponse.json({
        member: existing,
        team: { id: team.id, name: team.name },
      });
    }
    return jsonError(
      "이 팀에 이미 같은 닉네임이 있습니다. 새 계정으로는 만들 수 없습니다. 이전에 쓰던 닉네임이면 아래에서 기존 계정으로 입장해 주세요.",
      409,
      { code: "duplicate_nickname" }
    );
  }

  if (resume) {
    return jsonError(
      "해당 닉네임으로 등록된 멤버가 없습니다. 닉네임을 확인하거나 새로 참가해 주세요.",
      404
    );
  }

  const { data: member, error: memErr } = await supabase
    .from("members")
    .insert({ team_id: team.id, nickname })
    .select("id, team_id, nickname, created_at")
    .single();

  if (memErr) {
    if (memErr.code === "23505") {
      return jsonError(
        "이 팀에 이미 같은 닉네임이 있습니다. 새 계정으로는 만들 수 없습니다. 이전에 쓰던 닉네임이면 기존 계정으로 입장해 주세요.",
        409,
        { code: "duplicate_nickname" }
      );
    }
    return jsonError(memErr.message, 500);
  }

  return NextResponse.json(
    { member, team: { id: team.id, name: team.name } },
    { status: 201 }
  );
}
