import { useMemo, useState } from "react";
import { useMeasure } from "../components/useMeasure";
import { StatsReadout } from "../components/StatsReadout";
import { annualMeans, METRIC_LABEL, type Dataset, type Metric } from "../lib/data";
import { anomalyColor } from "../lib/colors";
import { trendStats } from "../lib/stats";

interface Props {
  ds: Dataset;
  metric: Metric;
  yearMin: number;
  yearMax: number;
  baseline: [number, number]; // reference period for anomalies
}

// Ed Hawkins "warming stripes": one colored bar per year, hue = anomaly from a
// baseline-period mean. Deliberately axis-light — the color IS the message.
export function WarmingStripes({ ds, metric, yearMin, yearMax, baseline }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;

  const { rows, maxAbs, base, stats } = useMemo(() => {
    const ann = annualMeans(ds, metric).filter((d) => d.year >= yearMin && d.year <= yearMax);
    const baseVals = ann.filter((d) => d.year >= baseline[0] && d.year <= baseline[1]).map((d) => d.mean);
    const base = baseVals.length ? baseVals.reduce((s, v) => s + v, 0) / baseVals.length : 0;
    const rows = ann.map((d) => ({ ...d, anom: d.mean - base }));
    const maxAbs = Math.max(0.5, ...rows.map((r) => Math.abs(r.anom)));
    const stats = rows.length >= 5 ? trendStats(rows.map((r) => r.year), rows.map((r) => r.mean)) : null;
    return { rows, maxAbs, base, stats };
  }, [ds, metric, yearMin, yearMax, baseline]);

  if (!rows.length) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const color = anomalyColor(maxAbs);
  const pad = 4;
  const w = (width - pad * 2) / rows.length;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <rect key={r.year} x={pad + i * w} y={20} width={Math.ceil(w) + 0.5} height={height - 70}
            fill={color(r.anom)} onMouseEnter={() => setHover(r.year)}
            opacity={hover === null || hover === r.year ? 1 : 0.6} />
        ))}
        {/* sparse year labels */}
        {rows.filter((_, i) => i % 3 === 0 || i === rows.length - 1).map((r) => {
          const i = rows.indexOf(r);
          return (
            <text key={r.year} x={pad + i * w + w / 2} y={height - 38} textAnchor="middle"
              fontSize={10} fill="#1c150f" opacity={0.6} fontFamily="JetBrains Mono, monospace">{r.year}</text>
          );
        })}
        {hover !== null && (() => {
          const r = rows.find((d) => d.year === hover)!;
          const i = rows.indexOf(r);
          const tx = Math.min(Math.max(pad + i * w + w / 2, 60), width - 60);
          return (
            <g pointerEvents="none" transform={`translate(${tx}, ${height - 28})`}>
              <text textAnchor="middle" fontSize={12} fontWeight={700} fill="#1c150f" fontFamily="JetBrains Mono, monospace">
                {r.year}: {r.anom >= 0 ? "+" : ""}{r.anom.toFixed(2)}°C vs {baseline[0]}–{baseline[1]}
              </text>
            </g>
          );
        })()}
      </svg>
      <div className="space-y-1 px-1">
        {stats && <StatsReadout s={stats} unit="°C" />}
        <p className="text-xs text-ink/55">
          {METRIC_LABEL[metric]} annual anomaly vs the {baseline[0]}–{baseline[1]} mean
          ({base.toFixed(1)}°C). Blue = cooler than baseline, red = warmer.
        </p>
      </div>
    </div>
  );
}
