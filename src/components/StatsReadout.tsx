import type { TrendStats } from "../lib/stats";
import { Term } from "./Term";

// Per-decade readout of the robust trend stats. `perDecade` multiplies the
// per-year slope (10 for °C/decade; for counts it's change per decade).
export function StatsReadout({ s, unit }: { s: TrendStats; unit: string }) {
  const k = 10;
  const sen = s.senSlope * k;
  const ols = s.olsSlope * k;
  const lo = s.ci[0] * k, hi = s.ci[1] * k;
  const sig = s.mkP < 0.05;
  const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="font-mono font-semibold tnum">
        <span className="text-ember"><Term name="theil-sen">Theil–Sen</Term> {fmt(sen)}</span>
        <span className="text-ink/45"> · </span>
        <span className="text-ink/55"><Term name="ols">OLS</Term> {fmt(ols)}</span>
        <span className="font-normal text-ink/55"> {unit}/decade</span>
        {!Number.isNaN(lo) && (
          <span className="font-normal text-ink/50">
            {" "}(<Term name="ci">95% CI</Term> {fmt(lo)} … {fmt(hi)})
          </span>
        )}
      </span>
      <span className="text-ink/60">
        <Term name="mann-kendall">Mann–Kendall</Term>{" "}
        <Term name="tau">τ</Term>={s.tau.toFixed(2)},{" "}
        <span className={sig ? "font-semibold text-ember" : "text-ink/50"}>
          <Term name="pvalue">p</Term>={s.mkP < 1e-3 ? s.mkP.toExponential(1) : s.mkP.toFixed(3)}{sig ? " ✓" : ""}
        </span>
      </span>
      {s.breakYear && (
        <span className="rounded bg-ink/5 px-2 py-0.5 text-ink/60">
          <Term name="pettitt">step change</Term> ≈ {s.breakYear}{" "}
          <span className="text-ink/40">(Pettitt p={s.breakP.toFixed(2)})</span>
        </span>
      )}
    </div>
  );
}
