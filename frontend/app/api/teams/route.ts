import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { validateTeamName } from "@/lib/team-name";
import {
  normalizeTeamJoinPassword,
  validateTeamJoinPassword,
} from "@/lib/team-join-password";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isJsonContentType(request: Request): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("application/json");
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError("로그인이 필요합니다.", 401);
  }

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return jsonError(error.message, 500);
  }

  return Response.json({ teams: data ?? [] });
}

export async function POST(request: Request) {
  if (!isJsonContentType(request)) {
    return jsonError("Content-Type은 application/json이어야 합니다.", 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.", 400);
  }
  const b =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  if ("name" in b && typeof b.name !== "string") {
    return jsonError("name 필드는 문자열이어야 합니다.", 400);
  }
  const nameRaw = typeof b.name === "string" ? b.name : "";
  const nameErr = validateTeamName(nameRaw);
  if (nameErr) {
    return jsonError(nameErr, 400);
  }
  const name = nameRaw.trim();
  const joinPasswordRaw =
    typeof b.join_password === "string" ? b.join_password : "";

  const invite_code = normalizeTeamJoinPassword(joinPasswordRaw);
  if (!invite_code) {
    return jsonError("팀 비밀번호를 입력해 주세요.", 400);
  }
  const pwdErr = validateTeamJoinPassword(invite_code);
  if (pwdErr) {
    return jsonError(pwdErr, 400);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError("로그인이 필요합니다.", 401);
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({ name, invite_code })
    .select("id, name, invite_code, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError(
        "이미 다른 팀에서 사용 중인 비밀번호입니다. 다른 비밀번호를 정해 주세요.",
        409
      );
    }
    return jsonError("팀 생성에 실패했습니다.", 500);
  }

  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      join_password: data.invite_code as string,
      created_at: data.created_at,
    },
    { status: 201 }
  );
}
