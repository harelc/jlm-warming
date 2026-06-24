import { useEffect, useMemo, useState } from "react";
import { dailyForMonth, years, MONTH_NAMES, type Dataset } from "../lib/data";

interface Props {
  ds: Dataset;
  initialYear: number;
  initialMonth: number;
  onClose: () => void;
}

// Unobtrusive raw-data inspector: pick a year + month, see that month's daily
// readings (date, mean, max, min, range), copy or download as CSV.
export function RawDataModal({ ds, initialYear, initialMonth, onClose }: Props) {
  const allYears = years(ds);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => dailyForMonth(ds, year, month), [ds, year, month]);

  const csv = useMemo(() => {
    const head = "date,mean_c,max_c,min_c,range_c";
    const body = rows.map((r) => `${r.date},${r.mean},${r.high},${r.low},${Math.round((r.high - r.low) * 10) / 10}`);
    return [head, ...body].join("\n");
  }, [rows]);

  const copy = () => {
    navigator.clipboard?.writeText(csv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  const download = () => {
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jlm-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="flex max-h-[82vh] w-full max-w-lg flex-col rounded-2xl border border-ink/15 bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink/12 px-5 py-3">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-lg font-bold text-ink">Daily readings</h3>
            <span className="text-xs text-ink/50">{rows.length} days</span>
          </div>
          <button onClick={onClose} aria-label="close"
            className="rounded-md px-2 py-1 text-lg leading-none text-ink/50 hover:bg-ink/5 hover:text-ink">×</button>
        </div>

        {/* pickers */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-medium text-ink shadow-sm">
            {MONTH_NAMES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-mono text-ink shadow-sm">
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="ml-auto flex gap-2">
            <button onClick={copy}
              className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-semibold text-ink/70 shadow-sm hover:bg-ink/5 hover:text-ink">
              {copied ? "✓ Copied" : "Copy CSV"}
            </button>
            <button onClick={download}
              className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-semibold text-ink/70 shadow-sm hover:bg-ink/5 hover:text-ink">
              ↓ CSV
            </button>
          </div>
        </div>

        {/* table */}
        <div className="min-h-0 flex-1 overflow-auto px-5 pb-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/50">No data for {MONTH_NAMES[month]} {year}.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-paper text-left text-[11px] uppercase tracking-wide text-ink/45">
                <tr>
                  <th className="py-1.5 pr-2 font-semibold">Day</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Mean</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Max</th>
                  <th className="py-1.5 px-2 text-right font-semibold">Min</th>
                  <th className="py-1.5 pl-2 text-right font-semibold">Range</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((r) => (
                  <tr key={r.day} className="border-t border-ink/8">
                    <td className="py-1 pr-2 text-ink/70">{r.day}</td>
                    <td className="py-1 px-2 text-right text-ink">{r.mean.toFixed(1)}°</td>
                    <td className="py-1 px-2 text-right text-[#9b2226]">{r.high.toFixed(1)}°</td>
                    <td className="py-1 px-2 text-right text-[#1d4e89]">{r.low.toFixed(1)}°</td>
                    <td className="py-1 pl-2 text-right text-ink/55">{(r.high - r.low).toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-ink/12 px-5 py-2 text-center text-[11px] text-ink/45">
          Data: <span className="font-heb font-bold text-ember">ירושמיים</span> / 02ws.co.il
        </div>
      </div>
    </div>
  );
}
