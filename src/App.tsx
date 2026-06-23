import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadDataset, years, MONTH_NAMES, METRIC_LABEL, type Dataset, type Metric } from "./lib/data";
import { Term } from "./components/Term";
import { Segmented } from "./components/Segmented";
import { MonthPills } from "./components/MonthPills";
import { YearPills } from "./components/YearPills";
import { Footer } from "./components/Footer";
import { yearColorScale } from "./lib/colors";
import { INDEX_DEFS, type IndexId } from "./lib/indices";
import { exportSvgPng } from "./lib/exportPng";
import { TrendChart } from "./charts/TrendChart";
import { BoxplotChart } from "./charts/BoxplotChart";
import { SeasonalChart } from "./charts/SeasonalChart";
import { AnomalyChart } from "./charts/AnomalyChart";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { WarmingStripes } from "./charts/WarmingStripes";
import { IndicesChart } from "./charts/IndicesChart";
import { DistributionShift } from "./charts/DistributionShift";

type ChartId =
  | "stripes" | "record" | "trend" | "distribution" | "distshift"
  | "seasonal" | "anomaly" | "indices";

const CHART_META: Record<ChartId, { name: string; blurb: ReactNode }> = {
  stripes: { name: "Warming stripes", blurb: <>One colored bar per year — hue is that year's <Term name="anomaly">anomaly</Term> from the 2002–2011 <Term name="climatology">baseline</Term>. Blue cooler, red warmer.</> },
  record: { name: "Full record", blurb: "Every daily reading on one continuous time axis — no folding. The rawest view of the archive." },
  trend: { name: "Yearly trend", blurb: <>Per-year mean/max/min for one month, with a regression line and a <Term name="bootstrap">bootstrap</Term> <Term name="ci">confidence band</Term>.</> },
  distribution: { name: "Distribution", blurb: <>Per-year <Term name="iqr">boxplots</Term> of every daily reading in one month; the trend line runs through the yearly means.</> },
  distshift: { name: "Distribution shift", blurb: "Early vs late period: the whole daily distribution sliding, not just the mean." },
  seasonal: { name: "Seasonal cycle", blurb: <>Daily readings folded onto day-of-year, with <Term name="harmonic">harmonic</Term> seasonal models — pooled or per-year.</> },
  anomaly: { name: "Anomaly", blurb: <><Term name="deseasonalized">Deseasonalized</Term>: each day minus the fitted seasonal cycle, leaving the signal versus time.</> },
  indices: { name: "Climate indices", blurb: <>Per-year counts of hot days, tropical nights, heat spells, and the <Term name="dtr">diurnal range</Term> — what warming actually feels like.</> },
};

const METRIC_OPTS = [
  { value: "mean" as Metric, label: "Mean" },
  { value: "high" as Metric, label: "Daily max" },
  { value: "low" as Metric, label: "Daily min" },
  { value: "dtr" as Metric, label: "Range (max−min)" },
];

// --- URL state (shareable views) ---
function readURL() {
  const p = new URLSearchParams(location.search);
  const num = (k: string, d: number) => (p.has(k) ? Number(p.get(k)) : d);
  return {
    chart: (p.get("c") as ChartId) || "stripes",
    metric: (p.get("m") as Metric) || "mean",
    method: (p.get("r") as "linear" | "quadratic") || "linear",
    month: num("mo", 6),
    seasonalMode: (p.get("sm") as "pooled" | "peryear") || "peryear",
    K: num("k", 2),
    indexId: (p.get("ix") as IndexId) || "hotDays",
    y0: p.has("y0") ? num("y0", 0) : null,
    y1: p.has("y1") ? num("y1", 0) : null,
    sp: p.has("sp") ? num("sp", 0) : null,
  };
}

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const init = readURL();

  const [chart, setChart] = useState<ChartId>(init.chart in CHART_META ? init.chart : "stripes");
  const [metric, setMetric] = useState<Metric>(init.metric);
  const [method, setMethod] = useState<"linear" | "quadratic">(init.method);
  const [month, setMonth] = useState(init.month);
  const [seasonalMode, setSeasonalMode] = useState<"pooled" | "peryear">(init.seasonalMode);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [K, setK] = useState(init.K);
  const [indexId, setIndexId] = useState<IndexId>(init.indexId);
  const [seasonalOverlay, setSeasonalOverlay] = useState(true);
  const [yr, setYr] = useState<[number, number]>([init.y0 ?? 2002, init.y1 ?? 2026]);
  const [splitYear, setSplitYear] = useState<number | null>(init.sp);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDataset()
      .then((d) => {
        setDs(d);
        const lo = init.y0 ?? d.meta.year_min, hi = init.y1 ?? d.meta.year_max;
        setYr([lo, hi]);
        setSelectedYears(new Set(years(d)));
      })
      .catch((e) => setErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <Centered>Couldn't load data: {err}</Centered>;
  if (!ds) return <Centered>Loading the archive…</Centered>;

  const allYears = years(ds);
  const [yMin, yMax] = yr;
  const colorDomain: [number, number] = [allYears[0], allYears[allYears.length - 1]];
  const colorScale = yearColorScale(colorDomain[0], colorDomain[1]);
  const baseline: [number, number] = [allYears[0], allYears[Math.min(9, allYears.length - 1)]];
  const effSplit = Math.min(Math.max(splitYear ?? Math.round((yMin + yMax) / 2), yMin + 1), yMax);

  const toggleYear = (y: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });
  };

  // build a shareable deep-link on demand (the address bar stays clean otherwise)
  const shareLink = () => {
    const p = new URLSearchParams();
    p.set("c", chart); p.set("m", metric); p.set("r", method);
    p.set("mo", String(month)); p.set("sm", seasonalMode); p.set("k", String(K));
    p.set("ix", indexId); p.set("y0", String(yr[0])); p.set("y1", String(yr[1]));
    if (splitYear !== null) p.set("sp", String(splitYear));
    const url = `${location.origin}${location.pathname}?${p.toString()}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  const doExport = () => {
    const svg = cardRef.current?.querySelector("svg");
    if (!svg) return;
    const m = METRIC_LABEL[metric].toLowerCase();      // e.g. "daily maximum"
    const idx = INDEX_DEFS.find((d) => d.id === indexId)?.label ?? "";
    const range = `${yMin}–${yMax}`;
    // self-describing caption per view
    const captions: Record<ChartId, string> = {
      stripes: `Jerusalem · ${m} annual anomaly vs ${baseline[0]}–${baseline[1]} · ${range}`,
      record: `Jerusalem · ${m}, every daily reading · ${range}`,
      trend: `Jerusalem · ${MONTH_NAMES[month]} ${m}, yearly trend · ${range}`,
      distribution: `Jerusalem · ${MONTH_NAMES[month]} ${m}, per-year distribution · ${range}`,
      distshift: `Jerusalem · ${m} distribution · ${yMin}–${effSplit - 1} vs ${effSplit}–${yMax}`,
      seasonal: `Jerusalem · ${m} seasonal cycle · ${selectedYears.size} years selected`,
      anomaly: `Jerusalem · ${m} deseasonalized anomaly · ${range}`,
      indices: `Jerusalem · ${idx} · ${range}`,
    };
    exportSvgPng(svg as SVGSVGElement, `jlm-${chart}-${metric}.png`, captions[chart]);
  };

  const showMonth = chart === "trend" || chart === "distribution";
  const showRegression = chart === "trend" || chart === "distribution" || chart === "anomaly" || chart === "record";
  const showRange = chart !== "seasonal";

  return (
    <div className="relative z-10 min-h-screen">
      {/* ---------- header (compact) ---------- */}
      <header className="mx-auto max-w-6xl px-5 pt-6 pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="rise font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Is Jerusalem <span className="hl">getting hotter?</span>
          </h1>
          <span className="rise text-[11px] font-semibold uppercase tracking-[0.18em] text-ember" style={{ animationDelay: "0.05s" }}>
            {ds.meta.year_min}–{ds.meta.year_max} · {ds.meta.n_obs.toLocaleString()} daily readings
          </span>
        </div>
        <p className="rise mt-1.5 text-sm text-ink/60" style={{ animationDelay: "0.1s" }}>
          A quarter-century from the{" "}
          <a href="https://www.02ws.co.il" target="_blank" rel="noopener noreferrer"
            className="font-heb font-bold text-ember hover:underline">ירושמיים</a>{" "}
          (<a href="https://www.02ws.co.il" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">02ws.co.il</a>) rooftop station — switch the metric, month, years and method, and decide for yourself.
        </p>
      </header>

      {/* ---------- chart-type tabs ---------- */}
      <nav className="sticky top-0 z-20 border-y border-ink/15 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-5 py-2">
          {(Object.keys(CHART_META) as ChartId[]).map((id) => (
            <button key={id} onClick={() => setChart(id)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-all ${
                chart === id ? "bg-ember text-white shadow" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
              }`}>
              {CHART_META[id].name}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-7">
        {/* prominent month picker for the month-dependent views */}
        {showMonth && (
          <div className="mb-5 rounded-xl border border-ember/25 bg-ember/[0.06] p-3.5">
            <MonthPills value={month} onChange={setMonth} />
          </div>
        )}

        {/* year multi-select for the seasonal view */}
        {chart === "seasonal" && (
          <div className="mb-5 rounded-xl border border-ember/25 bg-ember/[0.06] p-3.5">
            <YearPills allYears={allYears} selected={selectedYears} onToggle={toggleYear}
              onAll={() => setSelectedYears(new Set(allYears))} onNone={() => setSelectedYears(new Set())}
              colorFor={(y) => colorScale(y)} />
          </div>
        )}

        {/* ---------- controls ---------- */}
        <div className="mb-5 flex flex-wrap items-end gap-x-7 gap-y-4">
          {chart !== "indices" && (
            <Segmented label="Metric" value={metric} onChange={setMetric} options={METRIC_OPTS} />
          )}

          {chart === "indices" && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Index</span>
              <select value={indexId} onChange={(e) => setIndexId(e.target.value as IndexId)}
                className="rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-medium text-ink shadow-sm">
                {INDEX_DEFS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
          )}

          {showRegression && (
            <Segmented label="Regression" value={method} onChange={setMethod}
              options={[{ value: "linear", label: "Linear" }, { value: "quadratic", label: "Quadratic" }]} />
          )}

          {chart === "seasonal" && (
            <>
              <Segmented label="Seasonal model" value={seasonalMode} onChange={setSeasonalMode}
                options={[{ value: "pooled", label: "Pooled" }, { value: "peryear", label: "Per year" }]} />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Harmonics: {K}</span>
                <input type="range" min={1} max={6} value={K} onChange={(e) => setK(Number(e.target.value))} className="w-28" />
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

          {chart === "distshift" && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
                Split: <span className="font-mono text-ink/70">early &lt; {effSplit} ≤ late</span>
              </span>
              <input type="range" min={yMin + 1} max={yMax} value={effSplit}
                onChange={(e) => setSplitYear(Number(e.target.value))} className="w-40" />
            </div>
          )}

          {showRange && (
            <div className="flex flex-col gap-1">
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
          )}

          <div className="ml-auto flex items-end gap-2">
            <button onClick={shareLink}
              className="self-end rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-semibold text-ink/70 shadow-sm transition hover:bg-ink/5 hover:text-ink">
              {copied ? "✓ Copied" : "↗ Copy link"}
            </button>
            <button onClick={doExport}
              className="self-end rounded-lg border border-ink/15 bg-paper/60 px-3 py-1.5 text-sm font-semibold text-ink/70 shadow-sm transition hover:bg-ink/5 hover:text-ink">
              ↓ PNG
            </button>
          </div>
        </div>

        {/* ---------- chart card ---------- */}
        <section ref={cardRef} className="rounded-2xl border border-ink/12 bg-paper/70 p-5 shadow-[0_2px_30px_-12px_rgba(28,21,15,0.3)]">
          <div className="mb-3">
            <h2 className="font-display text-2xl font-bold text-ink">{CHART_META[chart].name}</h2>
            <p className="text-sm text-ink/60">{CHART_META[chart].blurb}</p>
          </div>

          {chart === "stripes" && <WarmingStripes ds={ds} metric={metric} yearMin={yMin} yearMax={yMax} baseline={baseline} />}
          {chart === "record" && <TimeSeriesChart ds={ds} metric={metric} yearMin={yMin} yearMax={yMax} method={method} showSeasonal={seasonalOverlay} />}
          {chart === "trend" && <TrendChart ds={ds} metric={metric} month={month} yearMin={yMin} yearMax={yMax} method={method} />}
          {chart === "distribution" && <BoxplotChart ds={ds} metric={metric} month={month} yearMin={yMin} yearMax={yMax} method={method} />}
          {chart === "distshift" && <DistributionShift ds={ds} metric={metric} yearMin={yMin} yearMax={yMax} splitYear={effSplit} />}
          {chart === "seasonal" && (
            <SeasonalChart ds={ds} metric={metric} selectedYears={selectedYears} colorDomain={colorDomain} mode={seasonalMode} K={K} />
          )}
          {chart === "anomaly" && <AnomalyChart ds={ds} metric={metric} yearMin={yMin} yearMax={yMax} method={method} />}
          {chart === "indices" && <IndicesChart ds={ds} indexId={indexId} yearMin={yMin} yearMax={yMax} />}
        </section>

        {/* ---------- honest caveats ---------- */}
        <details className="mt-5 rounded-xl border border-ink/12 bg-paper/50 px-4 py-3 text-sm text-ink/70">
          <summary className="cursor-pointer font-display text-base font-bold text-ink">
            What this can — and can't — tell you
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
            <li><b>One station, one rooftop.</b> This is a single private sensor in central Jerusalem, not a regional average. Some of the warming is genuine climate signal; some is plausibly <b>urban heat island</b> as the city built up around it.</li>
            <li><b>Inhomogeneities.</b> Instrument swaps, recalibration or a sensor move can create artificial step-changes. The "step change" flag (Pettitt test) hints at these, but can't separate a real shift from an equipment one.</li>
            <li><b>Autocorrelation.</b> Consecutive days are correlated, so naive p-values are over-confident. The headline numbers use <b>Theil–Sen slopes, Mann–Kendall tests, and a moving-block bootstrap CI</b> on yearly values to be honest about uncertainty.</li>
            <li><b>Short record &amp; a partial year.</b> {ds.meta.year_max - ds.meta.year_min}&nbsp;years is short for climate trends, and {ds.meta.year_max} is still in progress. {ds.meta.note}</li>
            <li><b>Data credit.</b> Every measurement was collected and published by the <a href="https://www.02ws.co.il" target="_blank" rel="noopener noreferrer" className="font-heb font-bold text-ember hover:underline">ירושמיים</a> station — this site only visualizes it.</li>
          </ul>
        </details>
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
