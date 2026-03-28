"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Member, Team } from "@/types";
import { parseJson } from "@/lib/api-json";
import { getTeamMeta, setTeamMeta } from "@/lib/member-storage";

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

export function TeamDashboard({ teamId }: { teamId: string }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      const meta = getTeamMeta();
      const [teamRes, memRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/members`),
      ]);
      const teamJson = await parseJson<Team & { error?: string }>(teamRes);
      const memJson = await parseJson<{ members: Member[]; error?: string }>(
        memRes
      );
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
      if (meta?.teamId === teamId) {
        setTeamMeta({
          teamId,
          name: teamJson.name,
          invite_code: teamJson.invite_code,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const copyInvite = useCallback(async () => {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(team.invite_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [team]);

  if (loadError) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-emerald-600"
        >
          ← 처음으로
        </Link>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-zinc-500">불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {team.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          팀 대시보드
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          초대 코드
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-zinc-100 px-3 py-2 font-mono text-lg font-semibold tracking-widest text-foreground dark:bg-zinc-900">
            {team.invite_code}
          </span>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          팀원 ({members.length}명)
        </h2>
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-foreground">{m.nickname}</span>
              <span className="text-xs text-zinc-500 sm:text-sm">
                참가 {formatJoinedAt(m.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/team/${team.id}/session`}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
        >
          오늘의 메뉴 정하기
        </Link>
        <Link
          href={`/team/${team.id}/history`}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-foreground transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          메뉴 이력 보기
        </Link>
      </div>
    </main>
  );
}
