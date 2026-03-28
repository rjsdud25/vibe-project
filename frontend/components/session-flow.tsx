"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Proposal, Session } from "@/types";
import { parseJson } from "@/lib/api-json";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getStoredMember } from "@/lib/member-storage";

const VOTE_DURATION_SEC = 10 * 60;

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
  const finalizeOnce = useRef(false);

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
        () => {
          void loadProposals(sid);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `session_id=eq.${sid}`,
        },
        () => {
          void loadVotes(sid);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sid}`,
        },
        () => {
          void loadSession().then((s) => {
            if (s && s.status === "voting") {
              void loadVotes(s.id);
            }
            if (s && s.status === "proposing") {
              void loadProposals(s.id);
            }
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.id, loadSession, loadProposals, loadVotes]);

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

  const runFinalize = useCallback(async () => {
    if (!session || finalizeOnce.current) return;
    finalizeOnce.current = true;
    try {
      const res = await fetch(`/api/sessions/${session.id}/finalize`, {
        method: "POST",
      });
      const data = await parseJson<FinalizeResponse & { error?: string }>(res);
      if (!res.ok) {
        finalizeOnce.current = false;
        return;
      }
      setFinalizeInfo(data);
      await loadSession();
    } catch {
      finalizeOnce.current = false;
    }
  }, [session, loadSession]);

  useEffect(() => {
    if (session?.status !== "voting" || !voteSummary) return;
    if (remainingSec === 0 || voteSummary.all_voted) {
      void runFinalize();
    }
  }, [session?.status, voteSummary, remainingSec, runFinalize]);

  useEffect(() => {
    if (!session || session.status !== "completed" || finalizeInfo) return;
    const sid = session.id;
    let cancelled = false;
    const decidedFallback = session.decided_menu;
    async function loadDetail() {
      const res = await fetch(`/api/sessions/${sid}`);
      const data = await parseJson<{
        decided_menu: string | null;
        proposals: { menu_name: string; vote_count: number }[];
        error?: string;
      }>(res);
      if (cancelled || !res.ok) return;
      const ranked = [...(data.proposals ?? [])].sort(
        (a, b) => b.vote_count - a.vote_count
      );
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
      setFinalizeInfo({
        session_id: sid,
        status: "completed",
        decided_menu: data.decided_menu ?? decidedFallback ?? "",
        is_tie_broken: false,
        results,
      });
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [session, finalizeInfo]);

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

  if (loadError) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-red-600">{loadError}</p>
        <Link href={`/team/${teamId}`} className="mt-4 inline-block text-emerald-600">
          ← 팀 대시보드
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-zinc-500">불러오는 중…</p>
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
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            ← 팀 대시보드
          </Link>
        </nav>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatDisplayDate(session.date)}
        </span>
        {phase === "proposing" ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            제안 중
          </span>
        ) : null}
        {phase === "voting" ? (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-100">
            투표 중
          </span>
        ) : null}
        {phase === "completed" ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
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
          <h1 className="text-2xl font-semibold tracking-tight">메뉴 제안</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            팀원이 한 가지씩 메뉴를 제안하면 전원 제안 완료 후 투표를 시작할 수
            있습니다.
          </p>

          {myProposal ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
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
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !memberId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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

          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
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
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80"
              >
                <p className="text-lg font-semibold text-foreground">
                  {p.menu_name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  제안: {p.nickname ?? "팀원"}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => void startVoting()}
              disabled={!allProposed || busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
            >
              투표 시작
            </button>
            {!allProposed ? (
              <p className="mt-2 text-center text-xs text-zinc-500">
                모든 팀원이 제안하면 버튼이 활성화됩니다.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {phase === "voting" && !voteSummary ? (
        <p className="mt-6 text-zinc-500">투표 정보를 불러오는 중…</p>
      ) : null}

      {phase === "voting" && voteSummary ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">메뉴 투표</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            마음에 드는 메뉴에 투표하세요. 시간이 끝나거나 전원이 투표하면
            결과로 넘어갑니다.
          </p>

          <div
            className={`mt-4 flex items-center justify-center rounded-2xl border px-4 py-4 text-4xl font-mono font-bold tabular-nums ${
              remainingSec <= 60
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                : "border-zinc-200 bg-zinc-50 text-foreground dark:border-zinc-800 dark:bg-zinc-900/80"
            }`}
          >
            {formatMmSs(remainingSec)}
          </div>

          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
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
                    className={`w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950 ${
                      isMine
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40"
                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-lg font-semibold">{p.menu_name}</span>
                    <span className="mt-2 block text-sm text-zinc-600 dark:text-zinc-400">
                      득표 {count}표
                    </span>
                    <span className="mt-3 inline-block rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
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
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center dark:border-emerald-900/50 dark:from-emerald-950/50 dark:to-zinc-950">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              오늘의 메뉴
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
              {decidedMenu}
            </p>
            <p className="mt-3 text-sm text-emerald-800/90 dark:text-emerald-200/90">
              팀원 모두 고생했어요!
            </p>
            {tieBroken ? (
              <p className="mt-4 rounded-lg bg-amber-100/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                동점이었습니다. 시스템이 무작위로 선정했습니다.
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
                    <span className="text-zinc-500">
                      {row.rank}위 · {row.menu_name}
                    </span>
                    <span className="font-medium tabular-nums">
                      {row.vote_count}표
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/team/${teamId}`}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-emerald-700"
            >
              팀 대시보드로 돌아가기
            </Link>
            <Link
              href={`/team/${teamId}/history`}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              이력 보기
            </Link>
          </div>
        </>
      ) : null}
    </main>
  );
}
