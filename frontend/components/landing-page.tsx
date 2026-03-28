"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { parseJson } from "@/lib/api-json";
import { setStoredMember, setTeamMeta } from "@/lib/member-storage";
import {
  normalizeTeamJoinPassword,
  validateTeamJoinPassword,
} from "@/lib/team-join-password";

type TeamCreated = {
  id: string;
  name: string;
  join_password: string;
  created_at: string;
};

type TeamListItem = {
  id: string;
  name: string;
  created_at: string;
};

type JoinResponse = {
  member: { id: string; team_id: string; nickname: string; created_at: string };
  team: { id: string; name: string };
  error?: string;
  code?: string;
};

type JoinStep = "pick" | "password" | "nickname";

export function LandingPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
  const [creatorNickname, setCreatorNickname] = useState("");
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [joinStep, setJoinStep] = useState<JoinStep>("pick");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [verifiedPassword, setVerifiedPassword] = useState("");
  const [nickname, setNickname] = useState("");

  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinDuplicate, setJoinDuplicate] = useState(false);
  const [resumeAfterCreate, setResumeAfterCreate] = useState<{
    join_password: string;
    teamId: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setTeamsLoading(true);
      setTeamsError(null);
      try {
        const res = await fetch("/api/teams");
        const data = await parseJson<{
          teams: TeamListItem[];
          error?: string;
        }>(res);
        if (cancelled) return;
        if (!res.ok) {
          setTeamsError(data.error ?? "팀 목록을 불러오지 못했습니다.");
          setTeams([]);
          return;
        }
        setTeams(data.teams ?? []);
      } catch {
        if (!cancelled) {
          setTeamsError("팀 목록을 불러오지 못했습니다.");
          setTeams([]);
        }
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  function resetJoinFlow() {
    setJoinStep("pick");
    setSelectedTeamId(null);
    setJoinPasswordInput("");
    setVerifiedPassword("");
    setNickname("");
    setJoinError(null);
    setJoinDuplicate(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setResumeAfterCreate(null);
    const name = teamName.trim();
    if (!name) return;
    const pwdNorm = normalizeTeamJoinPassword(createPassword);
    const pwdCheck = validateTeamJoinPassword(pwdNorm);
    if (pwdCheck) {
      setCreateError(pwdCheck);
      return;
    }
    const confirmNorm = normalizeTeamJoinPassword(createPasswordConfirm);
    if (pwdNorm !== confirmNorm) {
      setCreateError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, join_password: createPassword }),
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
          team_id: data.id,
          password: data.join_password,
          nickname: nick,
        }),
      });
      const joinData = await parseJson<JoinResponse>(joinRes);
      if (!joinRes.ok) {
        if (
          joinRes.status === 409 &&
          joinData.code === "duplicate_nickname"
        ) {
          setResumeAfterCreate({
            join_password: data.join_password,
            teamId: data.id,
            name: data.name,
          });
          setCreateError(
            joinData.error ??
              "같은 닉네임이 이미 있습니다. 기존 계정으로 입장해 주세요."
          );
        } else {
          setCreateError(joinData.error ?? "팀 생성 후 참가에 실패했습니다.");
        }
        return;
      }
      setTeamMeta({
        teamId: data.id,
        name: data.name,
        join_password: data.join_password,
      });
      setStoredMember(data.id, joinData.member.id);
      router.push(`/team/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeAfterCreate() {
    if (!resumeAfterCreate) return;
    setCreateError(null);
    const nick = creatorNickname.trim() || "나";
    setBusy(true);
    try {
      const joinRes = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: resumeAfterCreate.teamId,
          password: resumeAfterCreate.join_password,
          nickname: nick,
          resume: true,
        }),
      });
      const joinData = await parseJson<JoinResponse>(joinRes);
      if (!joinRes.ok) {
        setCreateError(joinData.error ?? "기존 계정으로 입장하지 못했습니다.");
        return;
      }
      setTeamMeta({
        teamId: resumeAfterCreate.teamId,
        name: resumeAfterCreate.name,
        join_password: resumeAfterCreate.join_password,
      });
      setStoredMember(resumeAfterCreate.teamId, joinData.member.id);
      setResumeAfterCreate(null);
      router.push(`/team/${resumeAfterCreate.teamId}`);
    } finally {
      setBusy(false);
    }
  }

  function completeJoin(data: JoinResponse, joinPassword: string) {
    setTeamMeta({
      teamId: data.team.id,
      name: data.team.name,
      join_password: joinPassword,
    });
    setStoredMember(data.team.id, data.member.id);
    setJoinDuplicate(false);
    resetJoinFlow();
    router.push(`/team/${data.team.id}`);
  }

  function goToPasswordStep() {
    setJoinError(null);
    setJoinDuplicate(false);
    if (!selectedTeamId) {
      setJoinError("참가할 팀을 목록에서 선택해 주세요.");
      return;
    }
    setJoinPasswordInput("");
    setVerifiedPassword("");
    setNickname("");
    setJoinStep("password");
  }

  async function handleVerifyPassword(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    if (!selectedTeamId) return;
    const pwd = joinPasswordInput.trim().toUpperCase();
    if (!pwd) {
      setJoinError("팀 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/verify-join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await parseJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) {
        setJoinError(data.error ?? "비밀번호를 확인할 수 없습니다.");
        return;
      }
      setVerifiedPassword(pwd);
      setJoinStep("nickname");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinNickname(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoinDuplicate(false);
    if (!selectedTeamId || !verifiedPassword) {
      setJoinError("비밀번호 확인 단계를 다시 진행해 주세요.");
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
        body: JSON.stringify({
          team_id: selectedTeamId,
          password: verifiedPassword,
          nickname: nick,
        }),
      });
      const data = await parseJson<JoinResponse>(res);
      if (!res.ok) {
        if (res.status === 409 && data.code === "duplicate_nickname") {
          setJoinError(
            data.error ??
              "이 팀에 이미 같은 닉네임이 있습니다. 새로 만들 수 없습니다."
          );
          setJoinDuplicate(true);
        } else {
          setJoinError(data.error ?? "참가에 실패했습니다.");
        }
        return;
      }
      completeJoin(data, verifiedPassword);
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeJoin() {
    setJoinError(null);
    if (!selectedTeamId || !verifiedPassword) {
      setJoinError("비밀번호 확인과 닉네임을 유지한 채 다시 시도해 주세요.");
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
        body: JSON.stringify({
          team_id: selectedTeamId,
          password: verifiedPassword,
          nickname: nick,
          resume: true,
        }),
      });
      const data = await parseJson<JoinResponse>(res);
      if (!res.ok) {
        setJoinError(data.error ?? "기존 계정으로 입장하지 못했습니다.");
        return;
      }
      completeJoin(data, verifiedPassword);
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
          팀을 만들거나, 목록에서 팀을 고른 뒤 비밀번호로 참가해 보세요.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <h2 className="text-lg font-medium text-foreground">팀 만들기</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          팀 이름·참가용 비밀번호·첫 닉네임을 입력하면 대시보드로 이동합니다.
          비밀번호는 다른 팀원이 목록에서 팀을 고른 뒤 입력합니다.
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
          <label
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
            htmlFor="create-team-password"
          >
            팀 비밀번호 (참가 시 사용)
          </label>
          <input
            id="create-team-password"
            type="password"
            value={createPassword}
            onChange={(e) => {
              setCreatePassword(e.target.value);
              setCreateError(null);
            }}
            placeholder="4~32자, 영문·숫자 (대소문자 구분 없음)"
            autoComplete="new-password"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <label
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
            htmlFor="create-team-password-confirm"
          >
            팀 비밀번호 확인
          </label>
          <input
            id="create-team-password-confirm"
            type="password"
            value={createPasswordConfirm}
            onChange={(e) => {
              setCreatePasswordConfirm(e.target.value);
              setCreateError(null);
            }}
            placeholder="비밀번호 다시 입력"
            autoComplete="new-password"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <label
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
            htmlFor="creator-nick"
          >
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
          {resumeAfterCreate ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                방금 만든 팀에 이미 이 닉네임이 있으면, 기존 멤버로 연결할 수
                있습니다.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResumeAfterCreate()}
                className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                {busy ? "처리 중…" : "기존 계정으로 입장"}
              </button>
            </div>
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
          아래 목록에서 팀을 선택한 뒤 참가하기를 누르면, 팀 비밀번호 입력 →
          닉네임 설정 순으로 진행됩니다.
        </p>

        {teamsLoading ? (
          <p className="mt-4 text-sm text-zinc-500">팀 목록을 불러오는 중…</p>
        ) : teamsError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          >
            {teamsError}
          </p>
        ) : teams.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            아직 만들어진 팀이 없습니다. 위에서 팀을 만들어 보세요.
          </p>
        ) : (
          <>
            {joinStep === "pick" ? (
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  팀 선택
                </span>
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
                  {teams.map((t) => {
                    const selected = t.id === selectedTeamId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeamId(t.id);
                            setJoinError(null);
                          }}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                            selected
                              ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100"
                              : "border-transparent bg-zinc-50 text-foreground hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {t.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={busy || !selectedTeamId}
                  onClick={goToPasswordStep}
                  className="mt-2 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-950"
                >
                  참가하기
                </button>
              </div>
            ) : null}

            {joinStep === "password" ? (
              <form
                onSubmit={(e) => void handleVerifyPassword(e)}
                className="mt-4 flex flex-col gap-3"
              >
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  선택한 팀:{" "}
                  <span className="font-semibold text-foreground">
                    {selectedTeam?.name ?? "—"}
                  </span>
                </p>
                <label
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                  htmlFor="team-password"
                >
                  팀 비밀번호
                </label>
                <input
                  id="team-password"
                  type="password"
                  value={joinPasswordInput}
                  onChange={(e) => {
                    setJoinPasswordInput(e.target.value);
                    setJoinError(null);
                  }}
                  placeholder="팀에서 공유한 비밀번호"
                  autoComplete="off"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-wider text-foreground placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
                />
                {joinError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                  >
                    {joinError}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={resetJoinFlow}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    다른 팀 고르기
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busy ? "확인 중…" : "확인"}
                  </button>
                </div>
              </form>
            ) : null}

            {joinStep === "nickname" ? (
              <form
                onSubmit={(e) => void handleJoinNickname(e)}
                className="mt-4 flex flex-col gap-3"
              >
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  선택한 팀:{" "}
                  <span className="font-semibold text-foreground">
                    {selectedTeam?.name ?? "—"}
                  </span>
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  비밀번호가 확인되었습니다. 표시할 닉네임을 정해 주세요.
                </p>
                <label
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                  htmlFor="join-nickname"
                >
                  닉네임
                </label>
                <input
                  id="join-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setJoinDuplicate(false);
                  }}
                  placeholder="표시할 닉네임"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
                  autoComplete="nickname"
                />
                {joinError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                  >
                    {joinError}
                  </p>
                ) : null}
                {joinDuplicate ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-medium">
                      이미 이 닉네임으로 참가한 적이 있나요?
                    </p>
                    <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                      기존 멤버로 다시 연결할 수 있습니다.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleResumeJoin()}
                      className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
                    >
                      {busy ? "처리 중…" : "기존 계정으로 입장"}
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setJoinStep("password");
                      setJoinError(null);
                      setJoinDuplicate(false);
                      setNickname("");
                    }}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    비밀번호 단계로
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-950"
                  >
                    {busy ? "처리 중…" : "참가 완료"}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
