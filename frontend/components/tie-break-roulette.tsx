"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const SLOT_W_PX = 128;
const DURATION_MS = 3800;

type Strip = { items: string[]; landingIndex: number };

function buildStrip(candidates: string[], winner: string): Strip {
  const n = candidates.length;
  const landingIndex = 26 + n * 2;
  const total = landingIndex + n + 6;
  const items: string[] = [];
  for (let i = 0; i < total; i++) {
    items.push(candidates[i % n]!);
  }
  items[landingIndex] = winner;
  return { items, landingIndex };
}

type Props = {
  candidates: string[];
  winner: string;
  onComplete: () => void;
};

export function TieBreakRoulette({ candidates, winner, onComplete }: Props) {
  const strip = useMemo(
    () => buildStrip(candidates, winner),
    [candidates, winner]
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [translateX, setTranslateX] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);

  const startSpin = useCallback(() => {
    if (phase !== "idle" || candidates.length < 2) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setPhase("done");
      onComplete();
      return;
    }

    const vw = viewportRef.current?.clientWidth ?? 280;
    const centerSlot = vw / 2 - SLOT_W_PX / 2;
    const endX = -(strip.landingIndex * SLOT_W_PX - centerSlot);

    setTranslateX(0);
    setTransitionOn(false);
    setPhase("spinning");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionOn(true);
        setTranslateX(endX);
      });
    });
  }, [phase, candidates.length, strip.landingIndex, onComplete]);

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform" || phase !== "spinning") return;
      setPhase("done");
      onComplete();
    },
    [phase, onComplete]
  );

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-app-card p-5 dark:border-amber-900/40 dark:from-amber-950/40 dark:to-app-card">
      <p className="text-center text-sm font-semibold text-amber-950 dark:text-amber-100">
        동점이에요
      </p>
      <p className="mt-1 text-center text-xs text-app-muted">
        같은 득표인 메뉴 중 하나가 랜덤으로 정해집니다. 룰렛을 돌려 최종 메뉴를
        확인해 보세요.
      </p>

      <div className="relative mt-5">
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-0 -translate-x-1/2 border-l-2 border-app-primary shadow-[0_0_12px_rgba(0,0,0,0.12)] dark:shadow-[0_0_12px_rgba(0,0,0,0.4)]"
          aria-hidden
        />
        <div
          ref={viewportRef}
          className="relative h-[5.5rem] overflow-hidden rounded-xl border border-app-border bg-app-input-bg/80 dark:bg-app-input-bg/50"
        >
          <div
            role="presentation"
            onTransitionEnd={onTransitionEnd}
            className="flex h-full flex-row"
            style={{
              width: `${strip.items.length * SLOT_W_PX}px`,
              transform: `translate3d(${translateX}px, 0, 0)`,
              transition: transitionOn
                ? `transform ${DURATION_MS}ms cubic-bezier(0.18, 0.9, 0.22, 1)`
                : "none",
            }}
          >
            {strip.items.map((label, i) => (
              <div
                key={`${i}-${label}`}
                className="flex h-full shrink-0 items-center justify-center border-r border-app-border/60 px-2 text-center text-sm font-semibold text-foreground last:border-r-0"
                style={{ width: SLOT_W_PX }}
              >
                <span className="line-clamp-2">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-app-muted">
        후보: {candidates.join(" · ")}
      </p>

      {phase === "idle" ? (
        <button
          type="button"
          onClick={startSpin}
          className="mt-5 w-full rounded-full bg-app-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primary-hover"
        >
          룰렛 돌리기
        </button>
      ) : phase === "spinning" ? (
        <p className="mt-5 text-center text-sm text-app-muted">돌아가는 중…</p>
      ) : null}
    </div>
  );
}
