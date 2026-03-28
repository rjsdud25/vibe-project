import type { Proposal } from "@/types";
import type { VoteResultRow } from "@/types/session-flow";
import { formatMmSs } from "@/lib/format-session-ui";

type VoteSummary = {
  results: VoteResultRow[];
  total_members: number;
  voted_count: number;
  all_voted: boolean;
};

type Props = {
  proposals: Proposal[];
  voteSummary: VoteSummary | null;
  remainingSec: number;
  liveTallies: Record<string, number>;
  myVoteId: string | null;
  memberId: string | null;
  busy: boolean;
  proposalError: string | null;
  isTeamCreator: boolean;
  canCreatorFinalizeEarly: boolean;
  requestCreatorFinalize: () => void;
  selectVoteTracked: (proposalId: string) => void;
};

export function VotingPhase({
  proposals,
  voteSummary,
  remainingSec,
  liveTallies,
  myVoteId,
  memberId,
  busy,
  proposalError,
  isTeamCreator,
  canCreatorFinalizeEarly,
  requestCreatorFinalize,
  selectVoteTracked,
}: Props) {
  if (!voteSummary) {
    return (
      <p className="mt-6 text-app-muted">투표 정보를 불러오는 중…</p>
    );
  }

  return (
    <>
      <h1 className="font-topic text-2xl font-bold tracking-tight">
        메뉴 투표
      </h1>
      <p className="mt-1 text-sm text-app-muted">
        마음에 드는 메뉴에 투표하세요. 시간이 끝나거나 전원이 투표하면 결과로
        넘어갑니다.
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
            <span className="font-medium text-foreground">10분 전</span>부터 조기
            마감할 수 있습니다. (10분짜리 투표면 투표 내내 가능합니다.)
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
  );
}
