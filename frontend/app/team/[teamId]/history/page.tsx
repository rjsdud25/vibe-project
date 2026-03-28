import Link from "next/link";
import { HistoryList } from "@/components/history-list";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        메뉴 이력
      </h1>
      <p className="mt-1 text-sm text-app-muted">
        최근 완료된 세션 목록입니다. 행을 눌러 상세를 확인하세요.
      </p>

      <HistoryList teamId={teamId} />

      <div className="mt-8">
        <Link
          href={`/team/${teamId}`}
          className="text-sm font-semibold text-app-primary hover:text-app-primary-hover"
        >
          ← 팀 대시보드로
        </Link>
      </div>
    </main>
  );
}
