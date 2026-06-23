interface Props {
  allYears: number[];
  selected: Set<number>;
  onToggle: (year: number) => void;
  onAll: () => void;
  onNone: () => void;
  colorFor: (year: number) => string;
}

// Multi-select: toggle any subset of years on/off. Selected pills carry their
// year-color so the legend lives in the buttons themselves.
export function YearPills({ allYears, selected, onToggle, onAll, onNone, colorFor }: Props) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
          Years <span className="font-mono text-ink/35">({selected.size} selected)</span>
        </span>
        <div className="flex gap-1">
          <button onClick={onAll}
            className="rounded-md border border-ink/15 bg-paper/60 px-2 py-0.5 text-xs font-semibold text-ink/60 hover:text-ink hover:bg-ink/5">All</button>
          <button onClick={onNone}
            className="rounded-md border border-ink/15 bg-paper/60 px-2 py-0.5 text-xs font-semibold text-ink/60 hover:text-ink hover:bg-ink/5">None</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {allYears.map((y) => {
          const on = selected.has(y);
          return (
            <button key={y} onClick={() => onToggle(y)}
              style={on ? { backgroundColor: colorFor(y), borderColor: colorFor(y) } : undefined}
              className={`rounded-md border px-2 py-1 font-mono text-xs font-semibold tabular-nums transition-all ${
                on ? "text-white shadow-sm" : "border-ink/15 bg-paper/60 text-ink/45 hover:border-ink/40 hover:text-ink/80"
              }`}>
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}
