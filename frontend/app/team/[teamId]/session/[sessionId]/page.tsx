import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerOrigin } from "@/lib/server-origin";

type SessionDetail = {
  id: string;
  team_id: string;
  date: string;
  status: string;
  decided_menu: string | null;
  proposals: {
    id: string;
    menu_name: string;
    nickname: string;
    vote_count: number;
  }[];
};

function formatHistoryDate(iso: string) {
  try {
    const d = new Date(iso + "T12:00:00");
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; sessionId: string }>;
}) {
  const { teamId, sessionId } = await params;
  const origin = await getServerOrigin();
  const res = await fetch(`${origin}/api/sessions/${sessionId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    notFound();
  }
  const data = (await res.json()) as SessionDetail;
  if (data.team_id !== teamId) {
    notFound();
  }

  const maxVotes = Math.max(
    1,
    ...data.proposals.map((p) => p.vote_count ?? 0)
  );
  const ranked = [...data.proposals].sort(
    (a, b) => b.vote_count - a.vote_count
  );

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-sm text-app-muted">
        {formatHistoryDate(data.date)}
      </p>
      <h1 className="font-topic mt-2 text-2xl font-bold tracking-tight text-foreground">
        세션 상세
      </h1>
      {data.decided_menu ? (
        <p className="mt-2 text-lg text-app-primary">
          선정 메뉴: <strong>{data.decided_menu}</strong>
        </p>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold">제안 및 득표</h2>
      <ul className="mt-4 space-y-6">
        {ranked.map((p, idx) => {
          const c = p.vote_count ?? 0;
          const pct = Math.round((c / maxVotes) * 100);
          return (
            <li key={p.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {idx + 1}위 · {p.menu_name}
                  {p.nickname ? (
                    <span className="text-app-muted"> ({p.nickname})</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-foreground">
                  {c}표
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-app-sky-mist dark:bg-app-sky-soft/50">
                <div
                  className="h-full rounded-full bg-app-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10">
        <Link
          href={`/team/${teamId}/history`}
          className="inline-flex rounded-full border border-app-border bg-app-card px-5 py-3 text-sm font-medium text-foreground shadow-sm hover:bg-app-input-bg"
        >
          목록으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
