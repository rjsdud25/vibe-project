import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 팀 생성자(가장 먼저 가입한 멤버)만 다른 멤버를 삭제할 수 있습니다.
 * Supabase RLS에서 members·votes·proposals DELETE가 허용되어야 합니다.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; memberId: string }> }
) {
  const { teamId, memberId } = await context.params;
  if (!teamId?.trim() || !memberId?.trim()) {
    return jsonError("팀 ID와 멤버 ID가 필요합니다.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.", 400);
  }
  const o = body as Record<string, unknown>;
  const actor_member_id =
    typeof o.actor_member_id === "string" ? o.actor_member_id.trim() : "";
  if (!actor_member_id) {
    return jsonError("actor_member_id가 필요합니다.", 400);
  }

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

  const { data: creator, error: creErr } = await supabase
    .from("members")
    .select("id")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (creErr) {
    return jsonError(creErr.message, 500);
  }
  if (!creator || (creator.id as string) !== actor_member_id) {
    return jsonError("팀을 만든 멤버만 다른 멤버를 삭제할 수 있습니다.", 403);
  }

  if ((creator.id as string) === memberId) {
    return jsonError("팀 생성자 본인은 이 API로 삭제할 수 없습니다.", 403);
  }

  const { data: target, error: tgtErr } = await supabase
    .from("members")
    .select("id, team_id")
    .eq("id", memberId)
    .maybeSingle();

  if (tgtErr) {
    return jsonError(tgtErr.message, 500);
  }
  if (!target || (target.team_id as string) !== teamId) {
    return jsonError("삭제할 멤버를 찾을 수 없습니다.", 404);
  }

  const { data: targetProposals } = await supabase
    .from("proposals")
    .select("id")
    .eq("member_id", memberId);

  const proposalIds = (targetProposals ?? []).map((r) => r.id as string);
  if (proposalIds.length > 0) {
    const { error: delVotesOnProposals } = await supabase
      .from("votes")
      .delete()
      .in("proposal_id", proposalIds);
    if (delVotesOnProposals) {
      return jsonError(delVotesOnProposals.message, 500);
    }
  }

  const { error: delVotesByMember } = await supabase
    .from("votes")
    .delete()
    .eq("member_id", memberId);
  if (delVotesByMember) {
    return jsonError(delVotesByMember.message, 500);
  }

  const { error: delProposals } = await supabase
    .from("proposals")
    .delete()
    .eq("member_id", memberId);
  if (delProposals) {
    return jsonError(delProposals.message, 500);
  }

  const { error: delMember } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId)
    .eq("team_id", teamId);

  if (delMember) {
    return jsonError(delMember.message, 500);
  }

  return NextResponse.json({ ok: true });
}
