"use client";

import type { ReactElement } from "react";

type MenuProposalInspirationProps = {
  onPick: (menuName: string) => void;
  disabled?: boolean;
};

type Example = {
  name: string;
  caption: string;
  Icon: () => ReactElement;
};

function IconStew() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden>
      <ellipse cx="28" cy="44" rx="18" ry="5" fill="rgba(28,154,212,0.12)" />
      <path
        d="M14 38c0-8 6-14 14-14s14 6 14 14v2H14v-2z"
        fill="#fef3c7"
        stroke="#f59e0b"
        strokeWidth="1.5"
      />
      <ellipse cx="28" cy="28" rx="10" ry="5" fill="#fb923c" opacity="0.85" />
      <path
        d="M22 24c2-4 6-6 10-4"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24 18q2-6 8-4"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

function IconBibimbap() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden>
      <ellipse cx="28" cy="44" rx="18" ry="5" fill="rgba(28,154,212,0.12)" />
      <ellipse cx="28" cy="30" rx="16" ry="10" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.5" />
      <circle cx="28" cy="28" r="4" fill="#facc15" />
      <path d="M16 30h8M32 30h8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 34h6" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 34h8" stroke="#a855f7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconNoodles() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden>
      <ellipse cx="28" cy="44" rx="18" ry="5" fill="rgba(28,154,212,0.12)" />
      <path
        d="M16 36c0-10 5-16 12-16s12 6 12 16"
        fill="#fef9c3"
        stroke="#eab308"
        strokeWidth="1.5"
      />
      <path
        d="M20 32c3-6 6-8 8-8s5 2 8 8M22 36c2-4 5-6 6-6s4 2 6 6M24 40c2-3 4-4 4-4s2 1 4 4"
        stroke="#ca8a04"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="38" y1="18" x2="42" y2="10" stroke="#78716c" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMeat() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden>
      <ellipse cx="28" cy="44" rx="18" ry="5" fill="rgba(28,154,212,0.12)" />
      <ellipse cx="28" cy="30" rx="14" ry="9" fill="#fecaca" stroke="#f87171" strokeWidth="1.5" />
      <path
        d="M18 28c3-4 8-6 14-4s10 4 12 8"
        stroke="#fca5a5"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="24" cy="27" r="2" fill="#fff" opacity="0.6" />
    </svg>
  );
}

function IconPasta() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden>
      <ellipse cx="28" cy="44" rx="18" ry="5" fill="rgba(28,154,212,0.12)" />
      <ellipse cx="28" cy="32" rx="14" ry="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path
        d="M18 30c4-2 8-3 12-1s8 4 10 8"
        stroke="#f97316"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M20 34c3-1 6-1 9 1M22 38c4 0 7 1 10 3"
        stroke="#ea580c"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function IconSalad() {
  return (
    <svg viewBox="0 0 56 56" className="h-12 w-12" aria-hidden>
      <ellipse cx="28" cy="44" rx="18" ry="5" fill="rgba(28,154,212,0.12)" />
      <path
        d="M16 36c2-8 6-12 12-12s10 4 12 12"
        fill="#dcfce7"
        stroke="#4ade80"
        strokeWidth="1.5"
      />
      <circle cx="22" cy="30" r="3" fill="#86efac" />
      <circle cx="30" cy="26" r="3.5" fill="#22c55e" />
      <circle cx="36" cy="32" r="2.5" fill="#bbf7d0" />
      <ellipse cx="28" cy="34" rx="6" ry="3" fill="#fef08a" opacity="0.9" />
    </svg>
  );
}

const EXAMPLES: Example[] = [
  { name: "김치찌개", caption: "찌개·국", Icon: IconStew },
  { name: "비빔밥", caption: "덮밥", Icon: IconBibimbap },
  { name: "라면", caption: "면요리", Icon: IconNoodles },
  { name: "삼겹살", caption: "구이", Icon: IconMeat },
  { name: "파스타", caption: "양식", Icon: IconPasta },
  { name: "샐러드", caption: "가벼운", Icon: IconSalad },
];

export function MenuProposalInspiration({
  onPick,
  disabled,
}: MenuProposalInspirationProps) {
  return (
    <div className="mt-5 rounded-2xl border border-sky-200/70 bg-gradient-to-b from-sky-50/90 to-app-card/80 p-4 dark:border-app-border dark:from-app-primary/5 dark:to-app-card/60">
      <p className="text-xs font-medium text-app-muted">
        메뉴가 안 떠오를 때 — 그림을 누르면 입력란에 예시가 들어가요.
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {EXAMPLES.map(({ name, caption, Icon }) => (
          <li key={name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(name)}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-transparent bg-white/70 px-2 py-2.5 text-center transition hover:border-app-primary/35 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-app-primary/30 disabled:pointer-events-none disabled:opacity-50 dark:bg-app-input-bg/60 dark:hover:bg-app-input-bg"
            >
              <Icon />
              <span className="text-[11px] font-semibold leading-tight text-foreground">
                {name}
              </span>
              <span className="text-[10px] text-app-muted">{caption}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
