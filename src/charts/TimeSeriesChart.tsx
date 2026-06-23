import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { points, type Dataset, type Metric, METRIC_LABEL } from "../lib/data";
import { polyFit, harmonicFitByDoy, formatP } from "../lib/regression";
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

  const trend = useMemo(() => {
    if (pts.length < 5) return null;
    return polyFit(pts.map((p) => p.decyear), pts.map((p) => p.v), method === "linear" ? 1 : 2);
  }, [pts, method]);

  // pooled harmonic (K=4) for the optional seasonal overlay, with linear trend baked in
  const seasonal = useMemo(() => {
    if (!showSeasonal || pts.length < 20) return null;
    const fit = harmonicFitByDoy(pts.map((p) => p.doy), pts.map((p) => p.v), 4);
    return fit;
  }, [pts, showSeasonal]);

  if (pts.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const [ylo, yhi] = extent(pts, (p) => p.v) as [number, number];
  const x = scaleLinear().domain([yearMin, yearMax + 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([ylo - 1, yhi + 1]).range([height - margin.bottom, margin.top]).nice();
  const color = yearColorScale(yearMin, yearMax);

  const trendPts: string[] = [];
  if (trend) for (let t = yearMin; t <= yearMax + 1; t += 0.05) trendPts.push(`${x(t)},${y(trend.predict(t))}`);
  const slopeDecade = trend?.slopePerYear !== undefined ? trend.slopePerYear * 10 : undefined;

  const seasonalPts: string[] = [];
  if (seasonal && trend) {
    // ride the linear trend: seasonal climatology (centered) + trend(t)
    const clim0 = (doy: number) => seasonal.predict(doy);
    const meanClim = pts.reduce((s, p) => s + clim0(p.doy), 0) / pts.length;
    for (let t = yearMin; t <= yearMax + 1; t += 0.02) {
      const doy = (t % 1) * 365.25 + 0.5;
      seasonalPts.push(`${x(t)},${y(clim0(doy) - meanClim + trend.predict(t))}`);
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

        {seasonal && (
          <polyline points={seasonalPts.join(" ")} fill="none" stroke="#1d4e89" strokeWidth={1}
            opacity={0.7} />
        )}
        {trend && (
          <polyline points={trendPts.join(" ")} fill="none" stroke={EMBER} strokeWidth={3}
            strokeLinecap="round" />
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        <span>{pts.length.toLocaleString()} daily readings</span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ background: EMBER, height: 4, width: 16, borderRadius: 2 }} /> {method} trend
        </span>
        {showSeasonal && (
          <span className="inline-flex items-center gap-1.5">
            <span style={{ background: "#1d4e89", height: 2, width: 16 }} /> seasonal model + trend
          </span>
        )}
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
