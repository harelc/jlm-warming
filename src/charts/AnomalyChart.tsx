import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { points, type Dataset, type Metric, METRIC_LABEL } from "../lib/data";
import { harmonicFitByDoy, polyFit, formatP } from "../lib/regression";
import { EMBER, INK } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  yearMin: number;
  yearMax: number;
  method: "linear" | "quadratic";
}

// Deseasonalized: subtract the pooled harmonic climatology (K=4), then show the
// residual anomaly versus time with a trend fit and annual means.
export function AnomalyChart({ ds, metric, yearMin, yearMax, method }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 480;
  const margin = { top: 20, right: 24, bottom: 48, left: 52 };

  const pts = useMemo(() => points(ds, metric, { yearMin, yearMax }), [ds, metric, yearMin, yearMax]);

  const { anom, trend, annual, monthly } = useMemo(() => {
    if (pts.length < 20) return { anom: [], trend: null, annual: [], monthly: [] };
    const clim = harmonicFitByDoy(pts.map((p) => p.doy), pts.map((p) => p.v), 4);
    const anom = pts.map((p) => ({ t: p.decyear, year: p.year, month: p.month, a: p.v - clim.predict(p.doy) }));
    const trend = polyFit(anom.map((d) => d.t), anom.map((d) => d.a), method === "linear" ? 1 : 2);
    const byYear = new Map<number, number[]>();
    const byMonth = new Map<string, { t: number; vs: number[] }>();
    for (const d of anom) {
      if (!byYear.has(d.year)) byYear.set(d.year, []);
      byYear.get(d.year)!.push(d.a);
      const key = `${d.year}-${d.month}`;
      if (!byMonth.has(key)) byMonth.set(key, { t: d.year + (d.month - 0.5) / 12, vs: [] });
      byMonth.get(key)!.vs.push(d.a);
    }
    const annual = [...byYear].sort((a, b) => a[0] - b[0]).map(([year, vs]) => ({
      year, a: vs.reduce((s, v) => s + v, 0) / vs.length,
    }));
    const monthly = [...byMonth.values()].sort((a, b) => a.t - b.t).map((m) => ({
      t: m.t, a: m.vs.reduce((s, v) => s + v, 0) / m.vs.length,
    }));
    return { anom, trend, annual, monthly };
  }, [pts, method]);

  if (anom.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const [ylo, yhi] = extent(anom, (d) => d.a) as [number, number];
  const x = scaleLinear().domain([yearMin, yearMax + 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([ylo - 0.5, yhi + 0.5]).range([height - margin.bottom, margin.top]).nice();

  const trendPts: string[] = [];
  if (trend) for (let t = yearMin; t <= yearMax + 1; t += 0.05) trendPts.push(`${x(t)},${y(trend.predict(t))}`);
  const slopeDecade = trend?.slopePerYear !== undefined ? trend.slopePerYear * 10 : undefined;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i)}
          xFormat={(v) => `'${String(v).slice(2)}`}
          yFormat={(v) => `${v > 0 ? "+" : ""}${v}°`} yLabel={`${METRIC_LABEL[metric]} anomaly (°C)`}
          xLabel="Year" />
        <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} stroke={INK} strokeWidth={1} opacity={0.6} />

        {anom.map((d, i) => (
          <circle key={i} cx={x(d.t)} cy={y(d.a)} r={1.1} fill="#999" fillOpacity={0.3} />
        ))}
        {/* monthly mean anomaly — finer detail between daily noise and the annual line */}
        <polyline points={monthly.map((d) => `${x(d.t)},${y(d.a)}`).join(" ")}
          fill="none" stroke="#3b6ea5" strokeWidth={1} opacity={0.6} />
        <polyline points={annual.map((d) => `${x(d.year + 0.5)},${y(d.a)}`).join(" ")}
          fill="none" stroke="#2e7d32" strokeWidth={1.8} />
        {annual.map((d) => (
          <circle key={d.year} cx={x(d.year + 0.5)} cy={y(d.a)} r={3} fill="#2e7d32" />
        ))}
        {trend && (
          <polyline points={trendPts.join(" ")} fill="none" stroke={EMBER} strokeWidth={3} strokeLinecap="round" />
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        <span className="inline-flex items-center gap-1.5">
          <span style={{ background: "#999" }} className="inline-block h-1.5 w-1.5 rounded-full" /> daily anomaly
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ background: "#3b6ea5", height: 2, width: 16 }} /> monthly mean
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ background: "#2e7d32", height: 2, width: 16 }} /> annual mean
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ background: EMBER, height: 4, width: 16, borderRadius: 2 }} /> {method} trend
        </span>
        {slopeDecade !== undefined && (
          <span className="font-mono text-ember font-semibold tnum">
            {slopeDecade >= 0 ? "+" : ""}{slopeDecade.toFixed(2)} °C/decade
            {trend?.pValue !== undefined && <span className="text-ink/50"> · p={formatP(trend.pValue)}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
