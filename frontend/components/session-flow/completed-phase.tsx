import Link from "next/link";
import { TieBreakRoulette } from "@/components/tie-break-roulette";

type RankedRow = { menu_name: string; vote_count: number; rank: number };

type Props = {
  decidedMenu: string;
  tieBroken: boolean;
  celebrationReady: boolean;
  tieCandidates: string[];
  rankedResults: RankedRow[];
  onRouletteComplete: () => void;
};

export function CompletedPhase({
  decidedMenu,
  tieBroken,
  celebrationReady,
  tieCandidates,
  rankedResults,
  onRouletteComplete,
}: Props) {
  return (
    <>
      {!celebrationReady && tieCandidates.length > 1 ? (
        <TieBreakRoulette
          candidates={tieCandidates}
          winner={decidedMenu}
          onComplete={onRouletteComplete}
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
            <p className="mt-3 text-sm text-app-muted">팀원 모두 고생했어요!</p>
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
  );
}
