"use client";

import Link from "next/link";
import { useSessionFlow } from "@/hooks/use-session-flow";
import { CompletedPhase } from "@/components/session-flow/completed-phase";
import { ProposingPhase } from "@/components/session-flow/proposing-phase";
import { SessionFlowHeader } from "@/components/session-flow/session-flow-header";
import { VotingPhase } from "@/components/session-flow/voting-phase";

export function SessionFlow({ teamId }: { teamId: string }) {
  const flow = useSessionFlow(teamId);

  if (flow.loadError) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-red-600 dark:text-red-400">{flow.loadError}</p>
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

  if (!flow.session) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-app-muted">불러오는 중…</p>
      </main>
    );
  }

  const phase = flow.session.status;
  const decidedMenu =
    flow.finalizeInfo?.decided_menu ?? flow.session.decided_menu ?? "";
  const tieBroken = flow.finalizeInfo?.is_tie_broken ?? false;

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      {phase !== "completed" ? (
        <nav className="mb-6">
          <Link
            href={`/team/${flow.teamId}`}
            className="text-sm font-medium text-app-primary hover:text-app-primary-hover"
          >
            ← 팀 대시보드
          </Link>
        </nav>
      ) : null}

      <SessionFlowHeader session={flow.session} phase={phase} />

      {!flow.memberId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          이 기기에서 팀에 참가한 기록이 없습니다. 랜딩 페이지에서 참가해 주세요.
        </p>
      ) : null}

      {phase === "proposing" ? (
        <ProposingPhase
          memberId={flow.memberId}
          busy={flow.busy}
          menuInput={flow.menuInput}
          setMenuInput={flow.setMenuInput}
          proposalError={flow.proposalError}
          setProposalError={flow.setProposalError}
          myProposal={flow.myProposal}
          proposals={flow.proposals}
          totalMembers={flow.totalMembers}
          allProposed={flow.allProposed}
          handlePropose={flow.handlePropose}
          startVoting={flow.startVoting}
        />
      ) : null}

      {phase === "voting" ? (
        <VotingPhase
          proposals={flow.proposals}
          voteSummary={flow.voteSummary}
          remainingSec={flow.remainingSec}
          liveTallies={flow.liveTallies}
          myVoteId={flow.myVoteId}
          memberId={flow.memberId}
          busy={flow.busy}
          proposalError={flow.proposalError}
          isTeamCreator={flow.isTeamCreator}
          canCreatorFinalizeEarly={flow.canCreatorFinalizeEarly}
          requestCreatorFinalize={flow.requestCreatorFinalize}
          selectVoteTracked={flow.selectVoteTracked}
        />
      ) : null}

      {phase === "completed" && decidedMenu ? (
        <CompletedPhase
          decidedMenu={decidedMenu}
          tieBroken={tieBroken}
          celebrationReady={flow.celebrationReady}
          tieCandidates={flow.tieCandidates}
          rankedResults={flow.rankedResults}
          onRouletteComplete={() => flow.setCelebrationReady(true)}
        />
      ) : null}
    </main>
  );
}
