import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { points, annualMeans, type Dataset, type Metric, METRIC_LABEL } from "../lib/data";
import { harmonicTrendFit } from "../lib/regression";
import { trendStats } from "../lib/stats";
import { StatsReadout } from "../components/StatsReadout";
import { EMBER, yearColorScale } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  yearMin: number;
  yearMax: number;
  method: "linear" | "quadratic";
  showSeasonal: boolean; // overlay the pooled harmonic seasonal model riding the trend
}

// The raw record: every daily reading on a continuous time axis. No folding.
export function TimeSeriesChart({ ds, metric, yearMin, yearMax, method, showSeasonal }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 480;
  const margin = { top: 20, right: 24, bottom: 48, left: 52 };

  const pts = useMemo(
    () => points(ds, metric, { yearMin, yearMax }),
    [ds, metric, yearMin, yearMax]
  );

  // ONE joint fit: trend + 4 harmonics, fit simultaneously over all daily data.
  const fit = useMemo(() => {
    if (pts.length < 20) return null;
    return harmonicTrendFit(
      pts.map((p) => p.decyear), pts.map((p) => p.doy), pts.map((p) => p.v),
      4, method === "linear" ? 1 : 2
    );
  }, [pts, method]);

  // robust trend on the metric's annual means (consistent with the other tabs)
  const robust = useMemo(() => {
    const am = annualMeans(ds, metric).filter((d) => d.year >= yearMin && d.year <= yearMax);
    return am.length >= 5 ? trendStats(am.map((d) => d.year), am.map((d) => d.mean)) : null;
  }, [ds, metric, yearMin, yearMax]);

  if (pts.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const [ylo, yhi] = extent(pts, (p) => p.v) as [number, number];
  const x = scaleLinear().domain([yearMin, yearMax + 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([ylo - 1, yhi + 1]).range([height - margin.bottom, margin.top]).nice();
  const color = yearColorScale(yearMin, yearMax);

  // trend = deseasonalized trend component of the joint fit (unbiased by coverage)
  const trendPts: string[] = [];
  if (fit) for (let t = yearMin; t <= yearMax + 1; t += 0.05) trendPts.push(`${x(t)},${y(fit.trendOnly(t))}`);
  const slopeDecade = fit ? fit.slopePerYear * 10 : undefined;

  // seasonal overlay = the full joint model (trend + harmonics) evaluated over time
  const seasonalPts: string[] = [];
  if (fit && showSeasonal) {
    for (let t = yearMin; t <= yearMax + 1; t += 0.01) {
      const doy = (t - Math.floor(t)) * 365.25 + 0.5;
      seasonalPts.push(`${x(t)},${y(fit.predict(t, doy))}`);
    }
  }

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i)}
          xFormat={(v) => `'${String(v).slice(2)}`}
          yFormat={(v) => `${v}°`} yLabel={`${METRIC_LABEL[metric]} (°C)`} xLabel="Every daily reading, 2002 → 2026" />

        {pts.map((p, i) => (
          <circle key={i} cx={x(p.decyear)} cy={y(p.v)} r={1.3}
            fill={color(p.year)} fillOpacity={0.5} />
        ))}

        {fit && showSeasonal && (
          <polyline points={seasonalPts.join(" ")} fill="none" stroke="#1d4e89" strokeWidth={1}
            opacity={0.7} />
        )}
        {fit && (
          <polyline points={trendPts.join(" ")} fill="none" stroke={EMBER} strokeWidth={3}
            strokeLinecap="round" />
        )}
      </svg>

      <div className="space-y-1 px-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink/70">
          <span>{pts.length.toLocaleString()} daily readings</span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ background: EMBER, height: 4, width: 16, borderRadius: 2 }} /> {method} trend (deseasonalized)
          </span>
          {showSeasonal && (
            <span className="inline-flex items-center gap-1.5">
              <span style={{ background: "#1d4e89", height: 2, width: 16 }} /> joint harmonic + trend fit
            </span>
          )}
          {slopeDecade !== undefined && (
            <span className="text-ink/50">joint-fit trend {slopeDecade >= 0 ? "+" : ""}{slopeDecade.toFixed(2)} °C/decade</span>
          )}
        </div>
        {robust && <StatsReadout s={robust} unit="°C" />}
      </div>
    </div>
  );
}
