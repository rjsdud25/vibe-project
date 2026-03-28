"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseJson } from "@/lib/api-json";
import { setStoredMember, setTeamMeta } from "@/lib/member-storage";

type TeamCreated = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

type JoinResponse = {
  member: { id: string; team_id: string; nickname: string; created_at: string };
  team: { id: string; name: string };
};

export function LandingPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [creatorNickname, setCreatorNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const name = teamName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await parseJson<TeamCreated & { error?: string }>(res);
      if (!res.ok) {
        setCreateError(data.error ?? "팀을 만들 수 없습니다.");
        return;
      }
      const nick = creatorNickname.trim() || "나";
      const joinRes = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_code: data.invite_code,
          nickname: nick,
        }),
      });
      const joinData = await parseJson<JoinResponse & { error?: string }>(
        joinRes
      );
      if (!joinRes.ok) {
        setCreateError(joinData.error ?? "팀 생성 후 참가에 실패했습니다.");
        return;
      }
      setTeamMeta({
        teamId: data.id,
        name: data.name,
        invite_code: data.invite_code,
      });
      setStoredMember(data.id, joinData.member.id);
      router.push(`/team/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setJoinError("초대 코드를 입력해 주세요.");
      return;
    }
    const nick = nickname.trim();
    if (!nick) {
      setJoinError("닉네임을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code, nickname: nick }),
      });
      const data = await parseJson<
        JoinResponse & { error?: string }
      >(res);
      if (!res.ok) {
        setJoinError(data.error ?? "참가에 실패했습니다.");
        return;
      }
      setTeamMeta({
        teamId: data.team.id,
        name: data.team.name,
        invite_code: code,
      });
      setStoredMember(data.team.id, data.member.id);
      router.push(`/team/${data.team.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-10 px-4 py-12 sm:px-6">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          오늘의 메뉴 추천
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 sm:text-base">
          팀을 만들거나 초대 코드로 참가해 점심 메뉴를 함께 정해 보세요.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <h2 className="text-lg font-medium text-foreground">팀 만들기</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          팀 이름과 첫 닉네임을 입력하면 대시보드로 이동합니다.
        </p>
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3">
          <label className="sr-only" htmlFor="team-name">
            팀 이름
          </label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="팀 이름"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
            autoComplete="organization"
          />
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300" htmlFor="creator-nick">
            내 닉네임 (팀 첫 멤버)
          </label>
          <input
            id="creator-nick"
            type="text"
            value={creatorNickname}
            onChange={(e) => setCreatorNickname(e.target.value)}
            placeholder="비우면 &quot;나&quot;로 참가"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
            autoComplete="nickname"
          />
          {createError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              {createError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-zinc-950"
          >
            {busy ? "처리 중…" : "팀 만들기"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <h2 className="text-lg font-medium text-foreground">팀 참가하기</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          팀에서 받은 초대 코드와 표시할 닉네임을 입력하세요.
        </p>
        <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300" htmlFor="invite">
              초대 코드
            </label>
            <input
              id="invite"
              type="text"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setJoinError(null);
              }}
              placeholder="예: X7K9M2"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-wider text-foreground placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300" htmlFor="nickname">
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="표시할 닉네임"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
              autoComplete="nickname"
            />
          </div>
          {joinError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              {joinError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-950"
          >
            {busy ? "처리 중…" : "참가하기"}
          </button>
        </form>
      </section>
    </main>
  );
}
