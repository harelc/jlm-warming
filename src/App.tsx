import { useEffect, useState } from "react";
import { loadDataset, years, MONTH_NAMES, type Dataset, type Metric } from "./lib/data";
import { Segmented } from "./components/Segmented";
import { Footer } from "./components/Footer";
import { TrendChart } from "./charts/TrendChart";
import { BoxplotChart } from "./charts/BoxplotChart";
import { SeasonalChart } from "./charts/SeasonalChart";
import { AnomalyChart } from "./charts/AnomalyChart";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";

type ChartId = "record" | "trend" | "distribution" | "seasonal" | "anomaly";

const CHART_META: Record<ChartId, { name: string; blurb: string }> = {
  record: { name: "Full record", blurb: "Every daily reading on one continuous time axis — no folding by month or year. The rawest view of the archive." },
  trend: { name: "Yearly trend", blurb: "Per-year mean, max and min for one calendar month, with a regression line through the yearly means." },
  distribution: { name: "Distribution", blurb: "Per-year boxplots of every daily reading in one month. The regression runs on all daily points." },
  seasonal: { name: "Seasonal cycle", blurb: "Daily readings folded onto day-of-year, with harmonic seasonal models — pooled, or fit independently per year." },
  anomaly: { name: "Anomaly", blurb: "Deseasonalized: each day minus the fitted seasonal cycle, leaving the warming signal versus time." },
};

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [chart, setChart] = useState<ChartId>("record");
  const [metric, setMetric] = useState<Metric>("mean");
  const [method, setMethod] = useState<"linear" | "quadratic">("linear");
  const [month, setMonth] = useState(6);
  const [seasonalMode, setSeasonalMode] = useState<"pooled" | "peryear">("peryear");
  const [focusYear, setFocusYear] = useState<number | "all">("all");
  const [K, setK] = useState(2);
  const [seasonalOverlay, setSeasonalOverlay] = useState(true);
  const [yr, setYr] = useState<[number, number]>([2002, 2026]);

  useEffect(() => {
    loadDataset()
      .then((d) => { setDs(d); setYr([d.meta.year_min, d.meta.year_max]); })
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <Centered>Couldn't load data: {err}</Centered>;
  if (!ds) return <Centered>Loading the archive…</Centered>;

  const allYears = years(ds);
  const [yMin, yMax] = yr;

  // step the seasonal focus-year through: all → first → … → last → all
  const stepFocus = (dir: number) => {
    if (focusYear === "all") { setFocusYear(dir > 0 ? allYears[0] : allYears[allYears.length - 1]); return; }
    const i = allYears.indexOf(focusYear) + dir;
    setFocusYear(i < 0 || i >= allYears.length ? "all" : allYears[i]);
  };

  return (
    <div className="relative z-10 min-h-screen">
      {/* ---------- header ---------- */}
      <header className="mx-auto max-w-6xl px-5 pt-12 pb-6">
        <div className="rise text-[11px] font-semibold uppercase tracking-[0.28em] text-ember">
          Jerusalem · 2002 – 2026 · {ds.meta.n_obs.toLocaleString()} daily readings
        </div>
        <h1 className="rise font-display text-5xl font-black leading-[0.95] tracking-tight text-ink sm:text-7xl"
          style={{ animationDelay: "0.05s" }}>
          Is Jerusalem<br /><span className="hl">getting hotter?</span>
        </h1>
        <p className="rise mt-5 max-w-2xl font-display text-lg italic text-ink/70" style={{ animationDelay: "0.12s" }}>
          A quarter-century of rooftop temperature measurements, sliced every way I could think of —
          switch the metric, the month, the years, and the regression method, and decide for yourself.
        </p>
        <p className="rise mt-3 text-sm text-ink/60" style={{ animationDelay: "0.18s" }}>
          Measurements by the{" "}
          <a href="https://www.02ws.co.il/ChooseMonthYear" target="_blank" rel="noopener noreferrer"
            className="font-heb font-bold text-ember hover:underline">ירושמיים</a>{" "}
          (<a href="https://www.02ws.co.il" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">02ws.co.il</a>) weather station.
        </p>
      </header>

      {/* ---------- chart-type tabs ---------- */}
      <nav className="sticky top-0 z-20 border-y border-ink/15 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-5 py-2">
          {(Object.keys(CHART_META) as ChartId[]).map((id) => (
            <button key={id} onClick={() => setChart(id)}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold transition-all ${
                chart === id ? "bg-ember text-white shadow" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
              }`}>
              {CHART_META[id].name}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-7">
        {/* ---------- controls ---------- */}
        <div className="mb-5 flex flex-wrap items-end gap-x-7 gap-y-4">
          <Segmented label="Metric" value={metric} onChange={setMetric}
            options={[
              { value: "mean", label: "Mean temp" },
              { value: "high", label: "Daily max" },
              { value: "low", label: "Daily min" },
            ]} />

          {(chart === "trend" || chart === "distribution") && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Month</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-medium text-ink shadow-sm">
                {MONTH_NAMES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          {(chart === "trend" || chart === "distribution" || chart === "anomaly" || chart === "record") && (
            <Segmented label="Regression" value={method} onChange={setMethod}
              options={[{ value: "linear", label: "Linear" }, { value: "quadratic", label: "Quadratic" }]} />
          )}

          {chart === "seasonal" && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Focus year</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => stepFocus(-1)}
                    className="rounded-md border border-ink/15 bg-paper/60 px-2 py-1.5 text-sm text-ink/70 shadow-sm hover:bg-ink/5"
                    aria-label="previous year">‹</button>
                  <select value={String(focusYear)} onChange={(e) => setFocusYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-medium text-ink shadow-sm">
                    <option value="all">All years</option>
                    {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <button onClick={() => stepFocus(1)}
                    className="rounded-md border border-ink/15 bg-paper/60 px-2 py-1.5 text-sm text-ink/70 shadow-sm hover:bg-ink/5"
                    aria-label="next year">›</button>
                </div>
              </div>
              {focusYear === "all" && (
                <Segmented label="Seasonal model" value={seasonalMode} onChange={setSeasonalMode}
                  options={[{ value: "pooled", label: "Pooled" }, { value: "peryear", label: "Per year" }]} />
              )}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
                  Harmonics: {K}
                </span>
                <input type="range" min={1} max={6} value={K} onChange={(e) => setK(Number(e.target.value))}
                  className="w-28" />
              </div>
            </>
          )}

          {chart === "record" && (
            <label className="flex cursor-pointer items-center gap-2 pb-1 text-sm font-medium text-ink/70">
              <input type="checkbox" checked={seasonalOverlay} onChange={(e) => setSeasonalOverlay(e.target.checked)}
                className="h-4 w-4 accent-[#1d4e89]" />
              Seasonal overlay
            </label>
          )}

          {/* year range — hidden in seasonal view when a single focus year is active */}
          <div className={`flex flex-col gap-1 ${chart === "seasonal" && focusYear !== "all" ? "hidden" : ""}`}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
              Years: <span className="font-mono text-ink/70">{yMin}–{yMax}</span>
            </span>
            <div className="flex items-center gap-2">
              <input type="range" min={allYears[0]} max={allYears[allYears.length - 1]} value={yMin}
                onChange={(e) => setYr([Math.min(Number(e.target.value), yMax), yMax])} className="w-24" />
              <input type="range" min={allYears[0]} max={allYears[allYears.length - 1]} value={yMax}
                onChange={(e) => setYr([yMin, Math.max(Number(e.target.value), yMin)])} className="w-24" />
            </div>
          </div>
        </div>

        {/* ---------- chart card ---------- */}
        <section className="rounded-2xl border border-ink/12 bg-paper/70 p-5 shadow-[0_2px_30px_-12px_rgba(28,21,15,0.3)]">
          <div className="mb-3">
            <h2 className="font-display text-2xl font-bold text-ink">{CHART_META[chart].name}</h2>
            <p className="text-sm text-ink/60">{CHART_META[chart].blurb}</p>
          </div>

          {chart === "record" && <TimeSeriesChart ds={ds} metric={metric} yearMin={yMin} yearMax={yMax} method={method} showSeasonal={seasonalOverlay} />}
          {chart === "trend" && <TrendChart ds={ds} metric={metric} month={month} yearMin={yMin} yearMax={yMax} method={method} />}
          {chart === "distribution" && <BoxplotChart ds={ds} metric={metric} month={month} yearMin={yMin} yearMax={yMax} method={method} />}
          {chart === "seasonal" && (
            <SeasonalChart ds={ds} metric={metric}
              yearMin={focusYear === "all" ? yMin : focusYear}
              yearMax={focusYear === "all" ? yMax : focusYear}
              mode={focusYear === "all" ? seasonalMode : "peryear"} K={K} />
          )}
          {chart === "anomaly" && <AnomalyChart ds={ds} metric={metric} yearMin={yMin} yearMax={yMax} method={method} />}
        </section>

        <p className="mt-4 text-xs leading-relaxed text-ink/45">
          Note: p-values treat daily readings as independent; daily autocorrelation makes them optimistic —
          trust the slope, treat the interval as a floor. 2026 is a partial year. {ds.meta.note}
        </p>
      </main>

      <Footer />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-6 text-center font-display text-xl text-ink/70">
      {children}
    </div>
  );
}
