import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VOTE_MS = 10 * 60 * 1000;

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
    .select("id, team_id, status, vote_started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) {
    return jsonError(sErr.message, 500);
  }
  if (!session) {
    return jsonError("세션을 찾을 수 없습니다.", 404);
  }

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, menu_name")
    .eq("session_id", sessionId);

  const { data: votes } = await supabase
    .from("votes")
    .select("member_id, proposal_id")
    .eq("session_id", sessionId);

  const countByProposal = new Map<string, number>();
  for (const p of proposals ?? []) {
    countByProposal.set(p.id as string, 0);
  }
  const votedMembers = new Set<string>();
  for (const v of votes ?? []) {
    votedMembers.add(v.member_id as string);
    const pid = v.proposal_id as string;
    countByProposal.set(pid, (countByProposal.get(pid) ?? 0) + 1);
  }

  const results = (proposals ?? []).map((p) => ({
    proposal_id: p.id as string,
    menu_name: p.menu_name as string,
    vote_count: countByProposal.get(p.id as string) ?? 0,
  }));

  const { count: total_members, error: cErr } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", session.team_id as string);

  if (cErr) {
    return jsonError(cErr.message, 500);
  }

  const tm = total_members ?? 0;
  const voted_count = votedMembers.size;
  const all_voted = tm > 0 && voted_count >= tm;

  return Response.json({
    results,
    total_members: tm,
    voted_count,
    all_voted,
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
  const proposal_id =
    typeof o.proposal_id === "string" ? o.proposal_id.trim() : "";

  if (!member_id || !proposal_id) {
    return jsonError("member_id와 proposal_id가 필요합니다.", 400);
  }

  const supabase = createServerSupabaseClient();

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, team_id, status, vote_started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr) {
    return jsonError(sErr.message, 500);
  }
  if (!session) {
    return jsonError("세션을 찾을 수 없습니다.", 404);
  }
  if (session.status !== "voting") {
    return jsonError("투표 단계가 아닙니다.", 403);
  }

  const started = session.vote_started_at
    ? new Date(session.vote_started_at as string).getTime()
    : NaN;
  if (!Number.isFinite(started) || Date.now() > started + VOTE_MS) {
    return jsonError("투표가 이미 마감되었습니다.", 403);
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

  const { data: proposal, error: pErr } = await supabase
    .from("proposals")
    .select("id, session_id")
    .eq("id", proposal_id)
    .maybeSingle();

  if (pErr) {
    return jsonError(pErr.message, 500);
  }
  if (!proposal || proposal.session_id !== sessionId) {
    return jsonError("유효하지 않은 제안입니다.", 403);
  }

  const { data: existing } = await supabase
    .from("votes")
    .select("id")
    .eq("session_id", sessionId)
    .eq("member_id", member_id)
    .maybeSingle();

  if (existing) {
    const { data: updated, error: uErr } = await supabase
      .from("votes")
      .update({ proposal_id })
      .eq("id", existing.id as string)
      .select("id, session_id, member_id, proposal_id, created_at")
      .single();

    if (uErr) {
      return jsonError(uErr.message, 500);
    }
    return Response.json({ ...updated, updated: true });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("votes")
    .insert({ session_id: sessionId, member_id, proposal_id })
    .select("id, session_id, member_id, proposal_id, created_at")
    .single();

  if (insErr) {
    return jsonError(insErr.message, 500);
  }

  return NextResponse.json(inserted, { status: 201 });
}
