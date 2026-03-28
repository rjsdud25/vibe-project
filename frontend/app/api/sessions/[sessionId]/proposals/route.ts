import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeMenu(s: string) {
  return s.trim().toLowerCase();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError("세션 ID가 필요합니다.", 400);
  }

  const supabase = createServerSupabaseClient();

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, team_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) {
    return jsonError(sErr.message, 500);
  }
  if (!session) {
    return jsonError("세션을 찾을 수 없습니다.", 404);
  }

  const { data: proposalsRaw, error: pErr } = await supabase
    .from("proposals")
    .select("id, menu_name, member_id, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (pErr) {
    return jsonError(pErr.message, 500);
  }

  const memberIds = [
    ...new Set((proposalsRaw ?? []).map((p) => p.member_id as string)),
  ];
  const nickById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, nickname")
      .in("id", memberIds);
    for (const m of members ?? []) {
      nickById.set(m.id as string, m.nickname as string);
    }
  }

  const { count: totalMembers, error: cErr } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", session.team_id as string);

  if (cErr) {
    return jsonError(cErr.message, 500);
  }

  const distinctProposers = new Set(
    (proposalsRaw ?? []).map((p) => p.member_id as string)
  );
  const total = totalMembers ?? 0;
  const all_proposed = total > 0 && distinctProposers.size >= total;

  const proposals = (proposalsRaw ?? []).map((p) => ({
    id: p.id as string,
    menu_name: p.menu_name as string,
    member_id: p.member_id as string,
    nickname: nickById.get(p.member_id as string) ?? "",
    created_at: p.created_at as string,
  }));

  return Response.json({
    proposals,
    all_proposed,
    total_members: total,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError("세션 ID가 필요합니다.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.", 400);
  }
  const o = body as Record<string, unknown>;
  const member_id = typeof o.member_id === "string" ? o.member_id.trim() : "";
  const menu_name =
    typeof o.menu_name === "string" ? o.menu_name.trim() : "";

  if (!member_id) {
    return jsonError("member_id가 필요합니다.", 400);
  }
  if (!menu_name) {
    return jsonError("메뉴 이름을 입력해 주세요.", 400);
  }

  const supabase = createServerSupabaseClient();

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, team_id, status")
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

  const { data: member, error: mErr } = await supabase
    .from("members")
    .select("id, team_id")
    .eq("id", member_id)
    .maybeSingle();

  if (mErr) {
    return jsonError(mErr.message, 500);
  }
  if (!member || member.team_id !== session.team_id) {
    return jsonError("유효하지 않은 멤버입니다.", 403);
  }

  const { data: existing } = await supabase
    .from("proposals")
    .select("id, menu_name")
    .eq("session_id", sessionId);

  const dup = (existing ?? []).some(
    (row) => normalizeMenu(row.menu_name as string) === normalizeMenu(menu_name)
  );
  if (dup) {
    return jsonError("이미 같은 메뉴가 제안되어 있습니다.", 409);
  }

  const { data: created, error: insErr } = await supabase
    .from("proposals")
    .insert({
      session_id: sessionId,
      member_id,
      menu_name,
    })
    .select("id, session_id, member_id, menu_name, created_at")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return jsonError("이미 같은 메뉴가 제안되어 있습니다.", 409);
    }
    return jsonError(insErr.message, 500);
  }

  return NextResponse.json(created, { status: 201 });
}
