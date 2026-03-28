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
  const inviteRaw =
    typeof o.invite_code === "string" ? o.invite_code.trim().toUpperCase() : "";
  const nickname =
    typeof o.nickname === "string" ? o.nickname.trim() : "";
  if (!inviteRaw) {
    return jsonError("초대 코드를 입력해 주세요.", 400);
  }
  if (!nickname) {
    return jsonError("닉네임을 입력해 주세요.", 400);
  }

  const supabase = createServerSupabaseClient();
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name")
    .eq("invite_code", inviteRaw)
    .maybeSingle();

  if (teamErr) {
    return jsonError(teamErr.message, 500);
  }
  if (!team) {
    return jsonError("존재하지 않는 초대 코드입니다.", 404);
  }

  const { data: member, error: memErr } = await supabase
    .from("members")
    .insert({ team_id: team.id, nickname })
    .select("id, team_id, nickname, created_at")
    .single();

  if (memErr) {
    return jsonError(memErr.message, 500);
  }

  return NextResponse.json(
    { member, team: { id: team.id, name: team.name } },
    { status: 201 }
  );
}
