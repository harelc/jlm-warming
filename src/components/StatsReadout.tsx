import type { TrendStats } from "../lib/stats";

// Per-decade readout of the robust trend stats. `perDecade` multiplies the
// per-year slope (10 for °C/decade; for counts it's change per decade).
export function StatsReadout({ s, unit }: { s: TrendStats; unit: string }) {
  const k = 10;
  const sen = s.senSlope * k;
  const lo = s.ci[0] * k, hi = s.ci[1] * k;
  const sig = s.mkP < 0.05;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="font-mono font-semibold text-ember tnum">
        {sen >= 0 ? "+" : ""}{sen.toFixed(2)} {unit}/decade
        {!Number.isNaN(lo) && (
          <span className="font-normal text-ink/50"> (95% CI {lo >= 0 ? "+" : ""}{lo.toFixed(2)} … {hi >= 0 ? "+" : ""}{hi.toFixed(2)})</span>
        )}
      </span>
      <span className="text-ink/60">
        Theil–Sen · Mann–Kendall τ={s.tau.toFixed(2)},{" "}
        <span className={sig ? "font-semibold text-ember" : "text-ink/50"}>
          p={s.mkP < 1e-3 ? s.mkP.toExponential(1) : s.mkP.toFixed(3)}{sig ? " ✓" : ""}
        </span>
      </span>
      {s.breakYear && (
        <span className="rounded bg-ink/5 px-2 py-0.5 text-ink/60">
          step change ≈ {s.breakYear} <span className="text-ink/40">(Pettitt p={s.breakP.toFixed(2)})</span>
        </span>
      )}
    </div>
  );
}
