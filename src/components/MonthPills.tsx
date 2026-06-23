const ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  value: number; // 1-12
  onChange: (m: number) => void;
}

// A prominent 12-across month picker for the month-dependent views.
export function MonthPills({ value, onChange }: Props) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Month</span>
      <div className="flex flex-wrap gap-1.5">
        {ABBR.map((m, i) => {
          const month = i + 1;
          const active = month === value;
          return (
            <button key={m} onClick={() => onChange(month)}
              className={`min-w-[3.1rem] rounded-lg px-3 py-2 text-sm font-bold tracking-wide transition-all ${
                active
                  ? "bg-ember text-white shadow-md ring-1 ring-ember/40 scale-105"
                  : "border border-ink/15 bg-paper/60 text-ink/55 hover:border-ember/40 hover:text-ink"
              }`}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
