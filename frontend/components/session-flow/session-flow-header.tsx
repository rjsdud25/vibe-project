import type { Session } from "@/types";
import { formatDisplayDate } from "@/lib/format-session-ui";

type Props = {
  session: Session;
  phase: Session["status"];
};

export function SessionFlowHeader({ session, phase }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-sm text-app-muted">
        {formatDisplayDate(session.date)}
      </span>
      {phase === "proposing" ? (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          제안 중
        </span>
      ) : null}
      {phase === "voting" ? (
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-900/35 dark:text-sky-100">
          투표 중
        </span>
      ) : null}
      {phase === "completed" ? (
        <span className="rounded-full bg-app-primary/10 px-2.5 py-0.5 text-xs font-semibold text-app-primary">
          완료
        </span>
      ) : null}
    </div>
  );
}
