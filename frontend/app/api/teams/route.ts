import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { generateInviteCode } from "@/lib/invite-code";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.", 400);
  }
  const name =
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof (body as { name: unknown }).name === "string"
      ? (body as { name: string }).name.trim()
      : "";
  if (!name) {
    return jsonError("팀 이름을 입력해 주세요.", 400);
  }

  const supabase = createServerSupabaseClient();
  for (let attempt = 0; attempt < 12; attempt++) {
    const invite_code = generateInviteCode();
    const { data, error } = await supabase
      .from("teams")
      .insert({ name, invite_code })
      .select("id, name, invite_code, created_at")
      .single();
    if (!error && data) {
      return NextResponse.json(data, { status: 201 });
    }
    if (error?.code !== "23505") {
      return jsonError(error?.message ?? "팀 생성에 실패했습니다.", 500);
    }
  }
  return jsonError("팀을 만들 수 없습니다. 다시 시도해 주세요.", 500);
}
