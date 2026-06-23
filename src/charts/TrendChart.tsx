import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { monthlyStats, type Dataset, type Metric, METRIC_LABEL, MONTH_NAMES } from "../lib/data";
import { polyFit, formatP } from "../lib/regression";
import { EMBER, INK } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  month: number;
  yearMin: number;
  yearMax: number;
  method: "linear" | "quadratic";
}

export function TrendChart({ ds, metric, month, yearMin, yearMax, method }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 460;
  const margin = { top: 20, right: 24, bottom: 54, left: 52 };

  const stats = useMemo(
    () => monthlyStats(ds, metric, month).filter((s) => s.year >= yearMin && s.year <= yearMax),
    [ds, metric, month, yearMin, yearMax]
  );

  const fit = useMemo(() => {
    if (stats.length < 3) return null;
    return polyFit(stats.map((s) => s.year), stats.map((s) => s.mean), method === "linear" ? 1 : 2);
  }, [stats, method]);

  if (stats.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const ys = stats.flatMap((s) => [s.min, s.max, s.mean]);
  const [ylo, yhi] = extent(ys) as [number, number];
  const x = scaleLinear().domain([yearMin - 0.5, yearMax + 0.5]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([ylo - 1, yhi + 1]).range([height - margin.bottom, margin.top]).nice();

  const line = (key: "mean" | "min" | "max") =>
    stats.map((s) => `${x(s.year)},${y(s[key])}`).join(" ");

  const fitPts: string[] = [];
  if (fit) {
    for (let yr = yearMin; yr <= yearMax; yr += 0.25) fitPts.push(`${x(yr)},${y(fit.predict(yr))}`);
  }
  const slopeDecade = fit?.slopePerYear !== undefined ? fit.slopePerYear * 10 : undefined;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={stats.map((s) => s.year)} xFormat={(v) => String(v)} rotateX
          yFormat={(v) => `${v}°`} yLabel={`${METRIC_LABEL[metric]} (°C)`} />

        {/* min–max envelope */}
        <polyline points={line("max")} fill="none" stroke="#9b2226" strokeWidth={1.2} opacity={0.5} />
        <polyline points={line("min")} fill="none" stroke="#1d4e89" strokeWidth={1.2} opacity={0.5} />
        {stats.map((s) => (
          <g key={s.year}>
            <circle cx={x(s.year)} cy={y(s.max)} r={2.4} fill="#9b2226" opacity={0.6} />
            <circle cx={x(s.year)} cy={y(s.min)} r={2.4} fill="#1d4e89" opacity={0.6} />
          </g>
        ))}

        {/* yearly mean of the metric */}
        <polyline points={line("mean")} fill="none" stroke={INK} strokeWidth={1.6} opacity={0.55} />
        {stats.map((s) => (
          <circle key={s.year} cx={x(s.year)} cy={y(s.mean)} r={3.4} fill={INK} />
        ))}

        {/* regression */}
        {fit && (
          <polyline points={fitPts.join(" ")} fill="none" stroke={EMBER} strokeWidth={3}
            strokeLinecap="round" />
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        <Legend swatch="#9b2226" label={`${MONTH_NAMES[month]} max`} />
        <Legend swatch={INK} label={`Yearly mean of ${METRIC_LABEL[metric].toLowerCase()}`} />
        <Legend swatch="#1d4e89" label={`${MONTH_NAMES[month]} min`} />
        <Legend swatch={EMBER} label={`${method} fit on yearly means`} thick />
        {slopeDecade !== undefined && (
          <span className="font-mono text-ember font-semibold tnum">
            {slopeDecade >= 0 ? "+" : ""}{slopeDecade.toFixed(2)} °C/decade
            {fit?.pValue !== undefined && <span className="text-ink/50"> · p={formatP(fit.pValue)}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, label, thick }: { swatch: string; label: string; thick?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ background: swatch, height: thick ? 4 : 2, width: 16, borderRadius: 2 }} />
      {label}
    </span>
  );
}
