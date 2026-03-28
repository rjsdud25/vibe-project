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

const cardClass =
  "flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-app-border bg-app-card p-6 shadow-[var(--app-card-shadow)] md:p-8";

const inputClass =
  "w-full rounded-full border border-app-border bg-app-input-bg px-4 py-3 text-sm text-foreground placeholder:text-app-muted focus:border-app-primary focus:outline-none focus:ring-2 focus:ring-app-primary/20";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-app-muted";

const btnPrimary =
  "inline-flex items-center justify-center rounded-full bg-app-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

const btnPrimarySm =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-app-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-app-primary-hover disabled:opacity-50";

const btnSecondary =
  "inline-flex items-center justify-center rounded-full border border-app-border bg-app-card px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-app-input-bg disabled:opacity-50";

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

  function beginJoinTeam(teamId: string) {
    setJoinError(null);
    setJoinDuplicate(false);
    setSelectedTeamId(teamId);
    setJoinPasswordInput("");
    setVerifiedPassword("");
    setNickname("");
    setJoinStep("password");
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

  function teamInitial(name: string) {
    const t = name.trim();
    if (!t) return "?";
    const ch = t[0]!;
    return /[a-zA-Z가-힣0-9]/.test(ch) ? ch.toUpperCase() : "?";
  }

  return (
    <div className="min-h-0 flex-1">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 text-center lg:mb-10 lg:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Team 메뉴 정하기
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-app-muted lg:mx-0">
            새 팀을 만들거나 목록에서 팀을 고른 뒤, 비밀번호로 참가할 수
            있습니다.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
          {/* 팀 참가 — 디자인 참고: 왼쪽 카드 / 진행 과제형 리스트 */}
          <section className={cardClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">팀 참가하기</h2>
              <p className="mt-1 text-sm text-app-muted">
                팀을 선택한 뒤 참가 → 비밀번호 확인 → 닉네임을 입력하세요.
              </p>
            </div>

            {teamsLoading ? (
              <p className="text-sm text-app-muted">팀 목록을 불러오는 중…</p>
            ) : teamsError ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200"
              >
                {teamsError}
              </p>
            ) : teams.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-app-border bg-app-input-bg/50 px-4 py-8 text-center text-sm text-app-muted">
                아직 만들어진 팀이 없습니다.
                <br />
                오른쪽에서 팀을 만들어 보세요.
              </div>
            ) : (
              <>
                {joinStep === "pick" ? (
                  <div className="flex flex-col gap-1">
                    <span className={`${labelClass} mb-2`}>팀 목록</span>
                    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {teams.map((t) => (
                        <li key={t.id}>
                          <div className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 transition hover:border-app-border hover:bg-app-input-bg/80">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-primary/10 text-sm font-bold text-app-primary"
                              aria-hidden
                            >
                              {teamInitial(t.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-foreground">
                                {t.name}
                              </p>
                              <p className="text-xs text-app-muted">
                                팀 비밀번호가 있으면 참가할 수 있어요
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => beginJoinTeam(t.id)}
                              className={btnPrimarySm}
                            >
                              참가
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {joinStep === "password" ? (
                  <form
                    onSubmit={(e) => void handleVerifyPassword(e)}
                    className="flex flex-col gap-4"
                  >
                    <p className="text-sm text-foreground">
                      <span className="text-app-muted">선택한 팀</span>{" "}
                      <span className="font-semibold">
                        {selectedTeam?.name ?? "—"}
                      </span>
                    </p>
                    <div>
                      <label className={labelClass} htmlFor="team-password">
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
                        className={`${inputClass} mt-2 font-mono tracking-wider`}
                      />
                    </div>
                    {joinError ? (
                      <p
                        role="alert"
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200"
                      >
                        {joinError}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={resetJoinFlow}
                        className={btnSecondary}
                      >
                        목록으로
                      </button>
                      <button type="submit" disabled={busy} className={btnPrimary}>
                        {busy ? "확인 중…" : "확인"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {joinStep === "nickname" ? (
                  <form
                    onSubmit={(e) => void handleJoinNickname(e)}
                    className="flex flex-col gap-4"
                  >
                    <p className="text-sm text-foreground">
                      <span className="text-app-muted">팀</span>{" "}
                      <span className="font-semibold">
                        {selectedTeam?.name ?? "—"}
                      </span>
                    </p>
                    <p className="text-xs text-app-muted">
                      비밀번호가 확인되었습니다. 표시할 닉네임을 입력하세요.
                    </p>
                    <div>
                      <label className={labelClass} htmlFor="join-nickname">
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
                        className={`${inputClass} mt-2`}
                        autoComplete="nickname"
                      />
                    </div>
                    {joinError ? (
                      <p
                        role="alert"
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200"
                      >
                        {joinError}
                      </p>
                    ) : null}
                    {joinDuplicate ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                        <p className="font-semibold">
                          이미 이 닉네임으로 참가한 적이 있나요?
                        </p>
                        <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                          기존 멤버로 다시 연결할 수 있습니다.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleResumeJoin()}
                          className={`${btnPrimary} mt-3 w-full bg-amber-600 hover:bg-amber-700`}
                        >
                          {busy ? "처리 중…" : "기존 계정으로 입장"}
                        </button>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setJoinStep("password");
                          setJoinError(null);
                          setJoinDuplicate(false);
                          setNickname("");
                        }}
                        className={btnSecondary}
                      >
                        비밀번호 단계로
                      </button>
                      <button type="submit" disabled={busy} className={btnPrimary}>
                        {busy ? "처리 중…" : "참가 완료"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </>
            )}
          </section>

          {/* 팀 만들기 — 오른쪽 카드 */}
          <section className={cardClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">팀 만들기</h2>
              <p className="mt-1 text-sm text-app-muted">
                이름·참가용 비밀번호·첫 닉네임을 입력하면 대시보드로 이동합니다.
              </p>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className={labelClass} htmlFor="team-name">
                  팀 이름
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="예: 기획팀 점심방"
                  className={`${inputClass} mt-2`}
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="create-team-password">
                  팀 비밀번호
                </label>
                <input
                  id="create-team-password"
                  type="password"
                  value={createPassword}
                  onChange={(e) => {
                    setCreatePassword(e.target.value);
                    setCreateError(null);
                  }}
                  placeholder="4~32자, 영문·숫자"
                  autoComplete="new-password"
                  className={`${inputClass} mt-2 font-mono text-sm`}
                />
              </div>
              <div>
                <label
                  className={labelClass}
                  htmlFor="create-team-password-confirm"
                >
                  비밀번호 확인
                </label>
                <input
                  id="create-team-password-confirm"
                  type="password"
                  value={createPasswordConfirm}
                  onChange={(e) => {
                    setCreatePasswordConfirm(e.target.value);
                    setCreateError(null);
                  }}
                  placeholder="다시 입력"
                  autoComplete="new-password"
                  className={`${inputClass} mt-2 font-mono text-sm`}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="creator-nick">
                  내 닉네임 (첫 멤버)
                </label>
                <input
                  id="creator-nick"
                  type="text"
                  value={creatorNickname}
                  onChange={(e) => setCreatorNickname(e.target.value)}
                  placeholder="비우면 &quot;나&quot;로 참가"
                  className={`${inputClass} mt-2`}
                  autoComplete="nickname"
                />
              </div>
              {createError ? (
                <p
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200"
                >
                  {createError}
                </p>
              ) : null}
              {resumeAfterCreate ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="text-amber-900/90 dark:text-amber-200/90">
                    방금 만든 팀에 이미 이 닉네임이 있으면, 기존 멤버로 연결할 수
                    있습니다.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResumeAfterCreate()}
                    className={`${btnPrimary} mt-3 w-full bg-amber-600 hover:bg-amber-700`}
                  >
                    {busy ? "처리 중…" : "기존 계정으로 입장"}
                  </button>
                </div>
              ) : null}
              <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
                {busy ? "처리 중…" : "팀 만들고 시작하기"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
