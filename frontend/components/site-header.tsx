import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-sky-200/70 bg-app-card/80 backdrop-blur-md dark:border-sky-800/50 dark:bg-app-card/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-primary text-sm font-bold text-white shadow-sm"
            aria-hidden
          >
            M
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-topic text-base font-bold tracking-tight text-foreground sm:text-lg">
              오늘의 메뉴
            </span>
            <span className="text-xs font-medium text-app-muted">
              팀 점심 메뉴 정하기
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-app-border bg-app-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-app-primary/30 hover:bg-app-input-bg"
          >
            홈
          </Link>
        </nav>
      </div>
    </header>
  );
}
