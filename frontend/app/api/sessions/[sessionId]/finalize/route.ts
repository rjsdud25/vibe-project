import { randomInt } from "node:crypto";
import { jsonError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VOTE_MS = 10 * 60 * 1000;
/** 마감 예정 시각 기준 이 시간(분) 안쪽이면 팀 생성자가 조기 마감 가능 */
const CREATOR_FINALIZE_LEAD_MS = 10 * 60 * 1000;

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!sessionId) {
    return jsonError("세션 ID가 필요합니다.", 400);
  }

  let memberId = "";
  try {
    const raw = await request.json();
    if (
      raw &&
      typeof raw === "object" &&
      "member_id" in raw &&
      typeof (raw as { member_id: unknown }).member_id === "string"
    ) {
      memberId = (raw as { member_id: string }).member_id.trim();
    }
  } catch {
    /* 본문 없음 — 자동 마감 */
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
  const { data: members } = await supabase
    .from("members")
    .select("id")
    .eq("team_id", session.team_id as string);

  const { data: votes } = await supabase
    .from("votes")
    .select("member_id")
    .eq("session_id", sessionId);

  const totalMembers = (members ?? []).length;
  const votedCount = new Set((votes ?? []).map((v) => v.member_id as string))
    .size;
  const now = Date.now();
  const timeUp = Number.isFinite(started) && now >= started + VOTE_MS;
  const allVoted = totalMembers > 0 && votedCount >= totalMembers;

  let creatorEarlyOk = false;
  let firstMemberId: string | undefined;
  if (memberId) {
    const { data: oldest, error: oldestErr } = await supabase
      .from("members")
      .select("id")
      .eq("team_id", session.team_id as string)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (oldestErr) {
      return jsonError(oldestErr.message, 500);
    }
    firstMemberId = oldest?.id as string | undefined;
    if (Number.isFinite(started)) {
      const voteEndsAt = started + VOTE_MS;
      const isCreator = firstMemberId === memberId;
      const inEarlyWindow = now >= voteEndsAt - CREATOR_FINALIZE_LEAD_MS;
      creatorEarlyOk = Boolean(isCreator && inEarlyWindow);
    }
  }

  if (!timeUp && !allVoted && !creatorEarlyOk) {
    if (memberId) {
      if (firstMemberId === memberId && Number.isFinite(started)) {
        const voteEndsAt = started + VOTE_MS;
        if (now < voteEndsAt - CREATOR_FINALIZE_LEAD_MS) {
          return jsonError(
            "팀 생성자는 투표 종료 시각 10분 전부터 조기 마감할 수 있습니다.",
            403
          );
        }
      } else if (firstMemberId !== memberId) {
        return jsonError("팀을 만든 멤버만 조기 마감할 수 있습니다.", 403);
      }
    }
    return jsonError("아직 투표를 마감할 수 없습니다.", 403);
  }

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, menu_name")
    .eq("session_id", sessionId);

  const { data: voteRows } = await supabase
    .from("votes")
    .select("proposal_id")
    .eq("session_id", sessionId);

  const countByProposal = new Map<string, number>();
  for (const p of proposals ?? []) {
    countByProposal.set(p.id as string, 0);
  }
  for (const v of voteRows ?? []) {
    const pid = v.proposal_id as string;
    countByProposal.set(pid, (countByProposal.get(pid) ?? 0) + 1);
  }

  let max = -1;
  const leaders: { id: string; menu_name: string }[] = [];
  for (const p of proposals ?? []) {
    const c = countByProposal.get(p.id as string) ?? 0;
    const id = p.id as string;
    const menu_name = p.menu_name as string;
    if (c > max) {
      max = c;
      leaders.length = 0;
      leaders.push({ id, menu_name });
    } else if (c === max) {
      leaders.push({ id, menu_name });
    }
  }

  const is_tie_broken = leaders.length > 1;
  const pick =
    leaders.length === 0
      ? null
      : leaders[randomInt(leaders.length)]!;
  const decided_menu = pick?.menu_name ?? "";

  const ranked = [...(proposals ?? [])]
    .map((p) => ({
      menu_name: p.menu_name as string,
      vote_count: countByProposal.get(p.id as string) ?? 0,
    }))
    .sort((a, b) => b.vote_count - a.vote_count);

  const results: {
    menu_name: string;
    vote_count: number;
    rank: number;
  }[] = [];
  let i = 0;
  while (i < ranked.length) {
    const v = ranked[i]!.vote_count;
    let j = i;
    while (j < ranked.length && ranked[j]!.vote_count === v) {
      j++;
    }
    const rank = i + 1;
    for (let k = i; k < j; k++) {
      results.push({
        menu_name: ranked[k]!.menu_name,
        vote_count: ranked[k]!.vote_count,
        rank,
      });
    }
    i = j;
  }

  const { data: updated, error: uErr } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      decided_menu,
    })
    .eq("id", sessionId)
    .eq("status", "voting")
    .select("id, status, decided_menu")
    .maybeSingle();

  if (uErr) {
    return jsonError(uErr.message, 500);
  }
  if (!updated) {
    return jsonError("세션 상태를 갱신할 수 없습니다.", 403);
  }

  const teamId = session.team_id as string;
  const { data: teamSessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("team_id", teamId);

  for (const row of teamSessions ?? []) {
    const sid = row.id as string;
    const { error: delVotesErr } = await supabase
      .from("votes")
      .delete()
      .eq("session_id", sid);
    if (delVotesErr) {
      return jsonError(delVotesErr.message, 500);
    }
    const { error: delPropsErr } = await supabase
      .from("proposals")
      .delete()
      .eq("session_id", sid);
    if (delPropsErr) {
      return jsonError(delPropsErr.message, 500);
    }
  }
  const { error: delSessionsErr } = await supabase
    .from("sessions")
    .delete()
    .eq("team_id", teamId);
  if (delSessionsErr) {
    return jsonError(delSessionsErr.message, 500);
  }
  const { error: delMembersErr } = await supabase
    .from("members")
    .delete()
    .eq("team_id", teamId);
  if (delMembersErr) {
    return jsonError(delMembersErr.message, 500);
  }
  const { error: delTeamErr } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId);

  if (delTeamErr) {
    return jsonError(
      delTeamErr.message ??
        "투표는 마감되었으나 팀을 삭제하지 못했습니다. Supabase RLS에서 teams DELETE를 허용하는지 확인해 주세요.",
      500
    );
  }

  const tie_candidates =
    is_tie_broken && leaders.length > 0
      ? leaders.map((l) => l.menu_name)
      : [];

  return Response.json({
    session_id: updated.id,
    status: updated.status,
    decided_menu,
    is_tie_broken,
    /** 동점 1위였던 메뉴 목록 (룰렛 후보). 비동점이면 빈 배열 */
    tie_candidates,
    results,
  });
}
