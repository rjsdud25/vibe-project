import type { Proposal } from "@/types";
import { MenuProposalInspiration } from "@/components/menu-proposal-inspiration";

type Props = {
  memberId: string | null;
  busy: boolean;
  menuInput: string;
  setMenuInput: (v: string) => void;
  proposalError: string | null;
  setProposalError: (v: string | null) => void;
  myProposal: Proposal | null;
  proposals: Proposal[];
  totalMembers: number;
  allProposed: boolean;
  handlePropose: (e: React.FormEvent) => void;
  startVoting: () => void;
};

export function ProposingPhase({
  memberId,
  busy,
  menuInput,
  setMenuInput,
  proposalError,
  setProposalError,
  myProposal,
  proposals,
  totalMembers,
  allProposed,
  handlePropose,
  startVoting,
}: Props) {
  return (
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
          내 제안: <strong>{myProposal.menu_name}</strong> — 다른 팀원을 기다리는
          중입니다.
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
  );
}
