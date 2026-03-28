"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Proposal, Session } from "@/types";
import type { FinalizeResponse, VoteResultRow } from "@/types/session-flow";
import { parseJson } from "@/lib/api-json";
import { normalizeMenu } from "@/lib/normalize-menu";
import {
  CREATOR_FINALIZE_LEAD_MS,
  REALTIME_REFETCH_DEBOUNCE_MS,
  VOTE_DURATION_SEC,
} from "@/lib/session-flow-constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  clearMemberStorageForTeam,
  getStoredMember,
} from "@/lib/member-storage";

export function useSessionFlow(teamId: string) {
  const memberId = useMemo(() => getStoredMember(teamId), [teamId]);

  const [session, setSession] = useState<Session | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [allProposed, setAllProposed] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [voteSummary, setVoteSummary] = useState<{
    results: VoteResultRow[];
    total_members: number;
    voted_count: number;
    all_voted: boolean;
  } | null>(null);

  const [menuInput, setMenuInput] = useState("");
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [remainingSec, setRemainingSec] = useState(VOTE_DURATION_SEC);
  const [voteEndsAtMs, setVoteEndsAtMs] = useState<number | null>(null);

  const [finalizeInfo, setFinalizeInfo] = useState<FinalizeResponse | null>(
    null
  );
  const [celebrationReady, setCelebrationReady] = useState(true);
  const finalizeOnce = useRef(false);
  const [firstMemberId, setFirstMemberId] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}/sessions/today`);
    const data = await parseJson<Session & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.error ?? "세션을 불러올 수 없습니다.");
    }
    setSession(data);
    if (data.status === "voting" && data.vote_started_at) {
      const end =
        new Date(data.vote_started_at).getTime() + VOTE_DURATION_SEC * 1000;
      setVoteEndsAtMs(end);
    } else {
      setVoteEndsAtMs(null);
    }
    return data;
  }, [teamId]);

  const loadProposals = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/proposals`);
    const data = await parseJson<{
      proposals: Proposal[];
      all_proposed: boolean;
      total_members?: number;
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error ?? "제안을 불러올 수 없습니다.");
    }
    setProposals(data.proposals ?? []);
    setAllProposed(Boolean(data.all_proposed));
    setTotalMembers(
      typeof data.total_members === "number" ? data.total_members : 0
    );
  }, []);

  const loadVotes = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/votes`);
    const data = await parseJson<{
      results: VoteResultRow[];
      total_members: number;
      voted_count: number;
      all_voted: boolean;
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error ?? "투표 현황을 불러올 수 없습니다.");
    }
    setVoteSummary({
      results: data.results ?? [],
      total_members: data.total_members ?? 0,
      voted_count: data.voted_count ?? 0,
      all_voted: Boolean(data.all_voted),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoadError(null);
      try {
        const s = await loadSession();
        if (cancelled || !s) return;
        await loadProposals(s.id);
        if (s.status === "voting") {
          await loadVotes(s.id);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "오류가 발생했습니다.");
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadSession, loadProposals, loadVotes]);

  useEffect(() => {
    if (!session?.id) return;
    const sid = session.id;
    const supabase = createBrowserSupabaseClient();

    let proposalsTimer: ReturnType<typeof setTimeout> | null = null;
    let votesTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleLoadProposals = () => {
      if (proposalsTimer !== null) clearTimeout(proposalsTimer);
      proposalsTimer = setTimeout(() => {
        proposalsTimer = null;
        void loadProposals(sid);
      }, REALTIME_REFETCH_DEBOUNCE_MS);
    };

    const scheduleLoadVotes = () => {
      if (votesTimer !== null) clearTimeout(votesTimer);
      votesTimer = setTimeout(() => {
        votesTimer = null;
        void loadVotes(sid);
      }, REALTIME_REFETCH_DEBOUNCE_MS);
    };

    const scheduleSessionSync = () => {
      if (sessionTimer !== null) clearTimeout(sessionTimer);
      sessionTimer = setTimeout(() => {
        sessionTimer = null;
        void loadSession().then((s) => {
          if (!s) return;
          if (s.status === "voting") {
            void loadVotes(s.id);
          }
          if (s.status === "proposing") {
            void loadProposals(s.id);
          }
        });
      }, REALTIME_REFETCH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`session-realtime-${sid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proposals",
          filter: `session_id=eq.${sid}`,
        },
        scheduleLoadProposals
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `session_id=eq.${sid}`,
        },
        scheduleLoadVotes
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sid}`,
        },
        scheduleSessionSync
      )
      .subscribe();

    return () => {
      if (proposalsTimer !== null) clearTimeout(proposalsTimer);
      if (votesTimer !== null) clearTimeout(votesTimer);
      if (sessionTimer !== null) clearTimeout(sessionTimer);
      void supabase.removeChannel(channel);
    };
  }, [session?.id, loadSession, loadProposals, loadVotes]);

  useEffect(() => {
    if (session?.status !== "voting") {
      setFirstMemberId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/teams/${teamId}/members`);
      const data = await parseJson<{
        members: { id: string }[];
        error?: string;
      }>(res);
      if (cancelled || !res.ok) return;
      const first = data.members?.[0]?.id ?? null;
      setFirstMemberId(first);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.status, teamId]);

  useEffect(() => {
    if (session?.status !== "voting" || voteEndsAtMs === null) return;
    const id = window.setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((voteEndsAtMs - Date.now()) / 1000)
      );
      setRemainingSec(left);
    }, 1000);
    const left = Math.max(
      0,
      Math.floor((voteEndsAtMs - Date.now()) / 1000)
    );
    setRemainingSec(left);
    return () => clearInterval(id);
  }, [session?.status, voteEndsAtMs]);

  const myProposal = useMemo(() => {
    if (!memberId) return null;
    return proposals.find((p) => p.member_id === memberId) ?? null;
  }, [proposals, memberId]);

  const handlePropose = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setProposalError(null);
      if (!memberId) {
        setProposalError("닉네임으로 팀에 참가한 뒤 이용해 주세요.");
        return;
      }
      if (!session) return;
      const raw = menuInput.trim();
      if (!raw) {
        setProposalError("메뉴 이름을 입력해 주세요.");
        return;
      }
      if (myProposal) {
        setProposalError("이미 제안을 등록했습니다.");
        return;
      }
      const dup = proposals.some(
        (p) => normalizeMenu(p.menu_name) === normalizeMenu(raw)
      );
      if (dup) {
        setProposalError("이미 제안된 메뉴입니다. 다른 메뉴를 입력해 주세요.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/sessions/${session.id}/proposals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: memberId, menu_name: raw }),
        });
        const data = await parseJson<{ error?: string }>(res);
        if (!res.ok) {
          setProposalError(data.error ?? "제안에 실패했습니다.");
          return;
        }
        setMenuInput("");
        await loadProposals(session.id);
      } finally {
        setBusy(false);
      }
    },
    [memberId, session, menuInput, proposals, myProposal, loadProposals]
  );

  const startVoting = useCallback(async () => {
    if (!session || !allProposed || proposals.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/start-voting`, {
        method: "POST",
      });
      const data = await parseJson<{
        vote_started_at?: string;
        vote_ends_at?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        setProposalError(data.error ?? "투표 시작에 실패했습니다.");
        return;
      }
      const ends = data.vote_ends_at
        ? new Date(data.vote_ends_at).getTime()
        : Date.now() + VOTE_DURATION_SEC * 1000;
      setVoteEndsAtMs(ends);
      finalizeOnce.current = false;
      await loadSession();
      await loadVotes(session.id);
    } finally {
      setBusy(false);
    }
  }, [session, allProposed, proposals.length, loadSession, loadVotes]);

  const selectVote = useCallback(
    async (proposalId: string) => {
      if (!memberId || !session || session.status !== "voting") return;
      setBusy(true);
      try {
        const res = await fetch(`/api/sessions/${session.id}/votes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_id: memberId,
            proposal_id: proposalId,
          }),
        });
        const data = await parseJson<{ error?: string }>(res);
        if (!res.ok) {
          setProposalError(data.error ?? "투표에 실패했습니다.");
          return;
        }
        await loadVotes(session.id);
      } finally {
        setBusy(false);
      }
    },
    [memberId, session, loadVotes]
  );

  const runFinalize = useCallback(
    async (opts?: { asTeamCreator?: boolean }) => {
      if (!session || finalizeOnce.current) return;
      finalizeOnce.current = true;
      try {
        const asCreator = Boolean(opts?.asTeamCreator && memberId);
        const res = await fetch(`/api/sessions/${session.id}/finalize`, {
          method: "POST",
          ...(asCreator
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ member_id: memberId }),
              }
            : {}),
        });
        const data = await parseJson<FinalizeResponse & { error?: string }>(
          res
        );
        if (!res.ok) {
          finalizeOnce.current = false;
          if (asCreator) {
            setProposalError(data.error ?? "조기 마감에 실패했습니다.");
          }
          return;
        }
        setProposalError(null);
        setFinalizeInfo(data);
        const tieList =
          Array.isArray(data.tie_candidates) && data.tie_candidates.length > 0
            ? data.tie_candidates
            : (data.results ?? [])
                .filter((r) => r.rank === 1)
                .map((r) => r.menu_name);
        const needsTieRoulette =
          Boolean(data.is_tie_broken) && tieList.length > 1;
        setCelebrationReady(!needsTieRoulette);
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                decided_menu: data.decided_menu,
              }
            : prev
        );
        clearMemberStorageForTeam(teamId);
      } catch {
        finalizeOnce.current = false;
      }
    },
    [session, memberId, teamId]
  );

  useEffect(() => {
    if (session?.status !== "voting" || !voteSummary) return;
    if (remainingSec === 0 || voteSummary.all_voted) {
      void runFinalize();
    }
  }, [session?.status, voteSummary, remainingSec, runFinalize]);

  const liveTallies = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of proposals) {
      map[p.id] = 0;
    }
    for (const r of voteSummary?.results ?? []) {
      map[r.proposal_id] = r.vote_count;
    }
    return map;
  }, [proposals, voteSummary]);

  const [myVoteId, setMyVoteId] = useState<string | null>(null);

  const selectVoteTracked = useCallback(
    async (proposalId: string) => {
      setMyVoteId(proposalId);
      await selectVote(proposalId);
    },
    [selectVote]
  );

  const rankedResults = finalizeInfo?.results ?? [];

  const tieCandidates = useMemo(() => {
    if (!finalizeInfo) return [];
    if (
      Array.isArray(finalizeInfo.tie_candidates) &&
      finalizeInfo.tie_candidates.length > 0
    ) {
      return finalizeInfo.tie_candidates;
    }
    return (finalizeInfo.results ?? [])
      .filter((r) => r.rank === 1)
      .map((r) => r.menu_name);
  }, [finalizeInfo]);

  const canCreatorFinalizeEarly =
    voteEndsAtMs !== null &&
    Date.now() >= voteEndsAtMs - CREATOR_FINALIZE_LEAD_MS;
  const isTeamCreator =
    Boolean(memberId && firstMemberId && memberId === firstMemberId);

  const requestCreatorFinalize = useCallback(() => {
    if (
      !window.confirm(
        "지금 투표를 마감할까요? 아직 투표하지 않은 팀원이 있을 수 있습니다."
      )
    ) {
      return;
    }
    void runFinalize({ asTeamCreator: true });
  }, [runFinalize]);

  return {
    memberId,
    session,
    loadError,
    proposals,
    totalMembers,
    allProposed,
    menuInput,
    setMenuInput,
    proposalError,
    setProposalError,
    busy,
    myProposal,
    handlePropose,
    startVoting,
    voteSummary,
    remainingSec,
    liveTallies,
    myVoteId,
    selectVoteTracked,
    isTeamCreator,
    canCreatorFinalizeEarly,
    requestCreatorFinalize,
    finalizeInfo,
    celebrationReady,
    setCelebrationReady,
    tieCandidates,
    rankedResults,
    teamId,
  };
}
