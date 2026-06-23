import type { ReactNode } from "react";
import { GLOSSARY } from "../lib/glossary";

// Inline glossary term: dotted underline + a tooltip on hover/focus/tap.
// Focusable (tabIndex 0) so it also works on touch and for keyboard users.
export function Term({ name, children }: { name: keyof typeof GLOSSARY | string; children: ReactNode }) {
  const d = GLOSSARY[name];
  if (!d) return <>{children}</>;
  return (
    <span tabIndex={0}
      className="group relative cursor-help underline decoration-dotted decoration-ink/40 underline-offset-2 outline-none focus:decoration-ember">
      {children}
      <span role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 max-w-[78vw] -translate-x-1/2 rounded-lg border border-ink/15 bg-paper px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink/75 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
        <span className="font-semibold text-ink">{d.title}</span>
        <span className="mt-1 block">{d.body}</span>
      </span>
    </span>
  );
}
