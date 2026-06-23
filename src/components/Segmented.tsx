interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">{label}</span>
      <div className="inline-flex rounded-lg border border-ink/15 bg-paper/60 p-0.5 shadow-sm">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                active ? "bg-ink text-paper shadow" : "text-ink/65 hover:text-ink hover:bg-ink/5"
              }`}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
