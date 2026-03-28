"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Member, Team } from "@/types";
import { parseJson } from "@/lib/api-json";
import { getStoredMember, getTeamMeta, setTeamMeta } from "@/lib/member-storage";

function formatJoinedAt(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

const cardClass =
  "rounded-2xl border border-app-border bg-app-card p-6 shadow-[var(--app-card-shadow)]";

const btnPrimary =
  "inline-flex flex-1 items-center justify-center rounded-full bg-app-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-app-primary-hover focus:outline-none focus:ring-2 focus:ring-app-primary/30 focus:ring-offset-2 focus:ring-offset-background";

export function TeamDashboard({ teamId }: { teamId: string }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [creatorMemberId, setCreatorMemberId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const actorMemberId = getStoredMember(teamId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      setRemoveError(null);
      const meta = getTeamMeta();
      const [teamRes, memRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/members`),
      ]);
      const teamJson = await parseJson<Team & { error?: string }>(teamRes);
      const memJson = await parseJson<{
        members: Member[];
        creator_member_id: string | null;
        error?: string;
      }>(memRes);
      if (cancelled) return;
      if (!teamRes.ok) {
        setLoadError(teamJson.error ?? "팀을 불러올 수 없습니다.");
        return;
      }
      if (!memRes.ok) {
        setLoadError(memJson.error ?? "멤버 목록을 불러올 수 없습니다.");
        return;
      }
      setTeam(teamJson);
      setMembers(memJson.members ?? []);
      setCreatorMemberId(memJson.creator_member_id ?? null);
      if (meta?.teamId === teamId) {
        setTeamMeta({
          teamId,
          name: teamJson.name,
          join_password: teamJson.join_password,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const removeMember = useCallback(
    async (targetMemberId: string) => {
      if (!actorMemberId) return;
      if (
        !window.confirm(
          "이 멤버를 팀에서 삭제할까요? 해당 멤버의 제안·투표 기록도 함께 제거됩니다."
        )
      ) {
        return;
      }
      setRemoveError(null);
      setRemoveBusyId(targetMemberId);
      try {
        const res = await fetch(
          `/api/teams/${teamId}/members/${targetMemberId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actor_member_id: actorMemberId }),
          }
        );
        const data = await parseJson<{ error?: string }>(res);
        if (!res.ok) {
          setRemoveError(data.error ?? "멤버를 삭제하지 못했습니다.");
          return;
        }
        setMembers((prev) => prev.filter((m) => m.id !== targetMemberId));
      } finally {
        setRemoveBusyId(null);
      }
    },
    [actorMemberId, teamId]
  );

  const copyInvite = useCallback(async () => {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(team.join_password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [team]);

  if (loadError) {
    return (
      <main className="mx-auto min-h-0 w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:py-12">
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-semibold text-app-primary hover:text-app-primary-hover"
        >
          ← 처음으로
        </Link>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="mx-auto min-h-0 w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:py-12">
        <p className="text-app-muted">불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-0 w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:py-12">
      <div className="mb-8">
        <h1 className="font-topic text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {team.name}
        </h1>
        <p className="mt-1 text-sm text-app-muted">팀 대시보드</p>
      </div>

      <section className={cardClass}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-app-muted">
          팀 비밀번호
        </h2>
        <p className="mt-2 text-sm text-app-muted">
          참가 화면에서 팀을 고른 뒤 이 비밀번호를 입력하면 들어올 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-app-border bg-app-input-bg px-4 py-2.5 font-mono text-lg font-semibold tracking-widest text-foreground">
            {team.join_password}
          </span>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-app-input-bg"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-app-muted">
          팀원 ({members.length}명)
        </h2>
        <p className="mt-2 text-xs text-app-muted">
          가장 먼저 참가한 멤버가 팀 생성자입니다. 생성자만 다른 멤버를 삭제할 수
          있습니다.
        </p>
        {removeError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          >
            {removeError}
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-app-border">
          {members.map((m) => {
            const isCreator = creatorMemberId !== null && m.id === creatorMemberId;
            const canRemove =
              Boolean(actorMemberId) &&
              actorMemberId === creatorMemberId &&
              m.id !== creatorMemberId;
            return (
              <li
                key={m.id}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground">
                    {m.nickname}
                    {isCreator ? (
                      <span className="ml-2 text-xs font-normal text-app-primary">
                        (팀 생성자)
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-app-muted sm:text-sm">
                    참가 {formatJoinedAt(m.created_at)}
                  </span>
                </div>
                {canRemove ? (
                  <button
                    type="button"
                    disabled={removeBusyId !== null}
                    onClick={() => void removeMember(m.id)}
                    className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
                  >
                    {removeBusyId === m.id ? "삭제 중…" : "삭제"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8">
        <Link href={`/team/${team.id}/session`} className={btnPrimary}>
          Team 메뉴 정하기
        </Link>
      </div>
    </main>
  );
}
