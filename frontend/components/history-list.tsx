"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HistoryEntry } from "@/types";
import { parseJson } from "@/lib/api-json";

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

export function HistoryList({ teamId }: { teamId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/teams/${teamId}/history?page=1&limit=30`
      );
      const data = await parseJson<{
        history: HistoryEntry[];
        error?: string;
      }>(res);
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "이력을 불러올 수 없습니다.");
        setHistory([]);
        setLoading(false);
        return;
      }
      setHistory(data.history ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return <p className="text-app-muted">불러오는 중…</p>;
  }

  if (error) {
    return (
      <p className="text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-app-muted">완료된 메뉴 이력이 아직 없습니다.</p>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-app-card shadow-[var(--app-card-shadow)]">
      {history.map((row) => (
        <li key={row.session_id}>
          <Link
            href={`/team/${teamId}/session/${row.session_id}`}
            className="flex flex-col gap-1 px-4 py-4 transition hover:bg-app-input-bg sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-semibold text-foreground">
              {formatHistoryDate(row.date)}
            </span>
            <span className="text-foreground">{row.decided_menu}</span>
            <span className="text-sm text-app-muted">
              득표 {row.vote_count} / {row.total_members}명
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
