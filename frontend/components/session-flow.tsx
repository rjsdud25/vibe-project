"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Proposal, Session } from "@/types";
import { parseJson } from "@/lib/api-json";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  clearMemberStorageForTeam,
  getStoredMember,
} from "@/lib/member-storage";
import { MenuProposalInspiration } from "@/components/menu-proposal-inspiration";
import { TieBreakRoulette } from "@/components/tie-break-roulette";

const VOTE_DURATION_SEC = 10 * 60;
/** 서버 `finalize`의 CREATOR_FINALIZE_LEAD_MS와 동일: 종료 예정 시각 기준 이 안쪽이면 생성자 조기 마감 가능 */
const CREATOR_FINALIZE_LEAD_MS = 10 * 60 * 1000;
/** Supabase Realtime 이벤트 연속 발생 시 REST 재조회가 겹치지 않도록 묶는 간격 */
const REALTIME_REFETCH_DEBOUNCE_MS = 400;

function normalizeMenu(s: string) {
  return s.trim().toLowerCase();
}

function formatMmSs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDisplayDate(isoDate: string) {
  try {
    const d = new Date(isoDate + "T12:00:00");
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(d);
  } catch {
    return isoDate;
  }
}

type VoteResultRow = {
  proposal_id: string;
  menu_name: string;
  vote_count: number;
};

type FinalizeResponse = {
  session_id: string;
  status: string;
  decided_menu: string;
  is_tie_broken: boolean;
  /** 동점 1위 메뉴 이름들 (서버가 룰렛과 동일 후보로 사용) */
  tie_candidates?: string[];
  results: { menu_name: string; vote_count: number; rank: number }[];
};

export function SessionFlow({ teamId }: { teamId: string }) {
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
  /** 동점일 때 룰렛을 마친 뒤에만 최종 축하 카드·결과 목록 표시 */
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
    setTotalMembers(typeof data.total_members === "number" ? data.total_members : 0);
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
      const data = await parseJson<{ members: { id: string }[]; error?: string }>(
        res
      );
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
        const data = await parseJson<FinalizeResponse & { error?: string }>(res);
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

  if (loadError) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <p className="mt-2 text-sm text-app-muted">
          투표가 끝난 팀은 자동으로 삭제됩니다. 팀이 없어졌다면 처음 화면에서 새로
          만들거나 참가해 주세요.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-semibold text-app-primary hover:text-app-primary-hover"
        >
          ← 처음으로
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-app-muted">불러오는 중…</p>
      </main>
    );
  }

  const phase = session.status;
  const decidedMenu =
    finalizeInfo?.decided_menu ?? session.decided_menu ?? "";
  const tieBroken = finalizeInfo?.is_tie_broken ?? false;

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      {phase !== "completed" ? (
        <nav className="mb-6">
          <Link
            href={`/team/${teamId}`}
            className="text-sm font-medium text-app-primary hover:text-app-primary-hover"
          >
            ← 팀 대시보드
          </Link>
        </nav>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-app-muted">
          {formatDisplayDate(session.date)}
        </span>
        {phase === "proposing" ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            제안 중
          </span>
        ) : null}
        {phase === "voting" ? (
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-900/35 dark:text-sky-100">
            투표 중
          </span>
        ) : null}
        {phase === "completed" ? (
          <span className="rounded-full bg-app-primary/10 px-2.5 py-0.5 text-xs font-semibold text-app-primary">
            완료
          </span>
        ) : null}
      </div>

      {!memberId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          이 기기에서 팀에 참가한 기록이 없습니다. 랜딩 페이지에서 참가해 주세요.
        </p>
      ) : null}

      {phase === "proposing" ? (
        <>
          <h1 className="font-topic text-2xl font-bold tracking-tight">
            메뉴 제안
          </h1>
          <p className="mt-1 text-sm text-app-muted">
            팀원이 한 가지씩 메뉴를 제안하면 전원 제안 완료 후 투표를 시작할 수
            있습니다.
          </p>

          {memberId && !myProposal ? (
            <MenuProposalInspiration
              disabled={busy}
              onPick={(name) => {
                setMenuInput(name);
                setProposalError(null);
              }}
            />
          ) : null}

          {myProposal ? (
            <p className="mt-4 text-sm text-app-muted">
              내 제안: <strong>{myProposal.menu_name}</strong> — 다른 팀원을
              기다리는 중입니다.
            </p>
          ) : (
            <form
              onSubmit={handlePropose}
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="menu"
                  className="text-xs font-medium text-app-muted"
                >
                  메뉴 제안
                </label>
                <input
                  id="menu"
                  value={menuInput}
                  onChange={(e) => {
                    setMenuInput(e.target.value);
                    setProposalError(null);
                  }}
                  placeholder="예: 김치찌개"
                  disabled={busy || !memberId}
                  className="mt-1 w-full rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm text-foreground placeholder:text-app-muted focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/25 dark:bg-app-input-bg"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !memberId}
                className="rounded-full bg-app-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                제안하기
              </button>
            </form>
          )}
          {proposalError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              {proposalError}
            </p>
          ) : null}

          <p className="mt-4 text-sm text-app-muted">
            제안 현황:{" "}
            <span className="font-semibold text-foreground">
              {new Set(proposals.map((p) => p.member_id)).size}/
              {totalMembers > 0 ? totalMembers : "…"}명
            </span>{" "}
            제안 완료
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-app-border bg-app-card p-4 shadow-[var(--app-card-shadow)] dark:border-app-border dark:bg-app-card"
              >
                <p className="text-lg font-semibold text-foreground">
                  {p.menu_name}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => void startVoting()}
              disabled={!allProposed || busy}
              className="w-full rounded-full bg-app-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              투표 시작
            </button>
            {!allProposed ? (
              <p className="mt-2 text-center text-xs text-app-muted">
                모든 팀원이 제안하면 버튼이 활성화됩니다.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === "voting" && !voteSummary ? (
        <p className="mt-6 text-app-muted">투표 정보를 불러오는 중…</p>
      ) : null}

      {phase === "voting" && voteSummary ? (
        <>
          <h1 className="font-topic text-2xl font-bold tracking-tight">
            메뉴 투표
          </h1>
          <p className="mt-1 text-sm text-app-muted">
            마음에 드는 메뉴에 투표하세요. 시간이 끝나거나 전원이 투표하면
            결과로 넘어갑니다.
          </p>

          <div
            className={`mt-4 flex items-center justify-center rounded-2xl border px-4 py-4 text-4xl font-mono font-bold tabular-nums ${
              remainingSec <= 60
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                : "border-sky-200/80 bg-app-sky-mist/90 text-foreground dark:border-app-border dark:bg-app-sky-soft/40"
            }`}
          >
            {formatMmSs(remainingSec)}
          </div>

          {isTeamCreator && canCreatorFinalizeEarly ? (
            <div className="mt-4 rounded-xl border border-sky-200/70 bg-app-sky-mist/50 p-4 dark:border-app-border dark:bg-app-sky-soft/25">
              <p className="text-sm text-app-muted">
                팀을 만든 멤버는 투표 종료 시각{" "}
                <span className="font-medium text-foreground">10분 전</span>부터
                조기 마감할 수 있습니다. (10분짜리 투표면 투표 내내 가능합니다.)
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={requestCreatorFinalize}
                className="mt-3 w-full rounded-lg border border-red-200 bg-app-card px-4 py-2.5 text-sm font-medium text-red-800 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-app-card dark:text-red-200 dark:hover:bg-red-950/40"
              >
                지금 투표 마감하기
              </button>
            </div>
          ) : null}

          <p className="mt-4 text-sm text-app-muted">
            투표 현황:{" "}
            <span className="font-semibold text-foreground">
              {voteSummary.voted_count}/{voteSummary.total_members}명
            </span>{" "}
            투표 완료
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {proposals.map((p) => {
              const count = liveTallies[p.id] ?? 0;
              const isMine = myVoteId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void selectVoteTracked(p.id)}
                    disabled={busy || !memberId}
                    className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-app-primary/30 focus:ring-offset-2 focus:ring-offset-background ${
                      isMine
                        ? "border-app-primary bg-app-primary/10 ring-2 ring-app-primary/25"
                        : "border-app-border bg-app-card hover:border-app-primary/30 dark:hover:border-app-primary/40"
                    }`}
                  >
                    <span className="text-lg font-semibold">{p.menu_name}</span>
                    <span className="mt-2 block text-sm text-app-muted">
                      득표 {count}표
                    </span>
                    <span className="mt-3 inline-block rounded-md bg-app-sky-soft/70 px-2 py-1 text-xs font-medium text-foreground dark:bg-app-sky-soft/50 dark:text-foreground">
                      투표
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {proposalError ? (
            <p className="mt-3 text-sm text-red-600">{proposalError}</p>
          ) : null}
        </>
      ) : null}

      {phase === "completed" && decidedMenu ? (
        <>
          {!celebrationReady && tieCandidates.length > 1 ? (
            <TieBreakRoulette
              candidates={tieCandidates}
              winner={decidedMenu}
              onComplete={() => setCelebrationReady(true)}
            />
          ) : null}

          {celebrationReady ? (
            <>
              <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-100/80 via-app-card to-app-sky-mist/50 p-6 text-center shadow-[var(--app-card-shadow)] dark:border-app-primary/25 dark:from-app-primary/10 dark:via-app-card dark:to-app-sky-mist/20">
                <p className="text-sm font-semibold text-app-primary">
                  오늘의 메뉴
                </p>
                <p className="font-topic mt-2 text-3xl font-bold tracking-tight text-foreground">
                  {decidedMenu}
                </p>
                <p className="mt-3 text-sm text-app-muted">
                  팀원 모두 고생했어요!
                </p>
                {tieBroken ? (
                  <p className="mt-4 rounded-lg bg-amber-100/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                    동점이었습니다. 룰렛으로 최종 메뉴를 정했습니다.
                  </p>
                ) : null}
              </div>

              <h2 className="mt-10 text-lg font-semibold">전체 투표 결과</h2>
              <ul className="mt-4 space-y-4">
                {rankedResults.map((row, idx) => {
                  const maxVotes = Math.max(
                    1,
                    ...rankedResults.map((r) => r.vote_count)
                  );
                  const pct = Math.round((row.vote_count / maxVotes) * 100);
                  return (
                    <li key={`${row.rank}-${row.menu_name}-${idx}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-app-muted">
                          {row.rank}위 · {row.menu_name}
                        </span>
                        <span className="font-medium tabular-nums">
                          {row.vote_count}표
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-app-sky-mist dark:bg-app-sky-soft/50">
                        <div
                          className="h-full rounded-full bg-app-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-10">
                <Link
                  href="/"
                  className="inline-flex w-full items-center justify-center rounded-full bg-app-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-app-primary-hover sm:w-auto sm:min-w-[12rem]"
                >
                  처음으로
                </Link>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
