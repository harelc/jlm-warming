import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { StatsReadout } from "../components/StatsReadout";
import type { Dataset } from "../lib/data";
import { indexSeries, INDEX_DEFS, type IndexId } from "../lib/indices";
import { trendStats, olsSlope, theilSen, blockBootstrapCI } from "../lib/stats";
import { EMBER, INK } from "../lib/colors";

interface Props {
  ds: Dataset;
  indexId: IndexId;
  yearMin: number;
  yearMax: number;
}

export function IndicesChart({ ds, indexId, yearMin, yearMax }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 460;
  const margin = { top: 20, right: 24, bottom: 54, left: 52 };
  const def = INDEX_DEFS.find((d) => d.id === indexId)!;

  const series = useMemo(
    () => indexSeries(ds, indexId).filter((d) => d.year >= yearMin && d.year <= yearMax),
    [ds, indexId, yearMin, yearMax]
  );

  const stats = useMemo(() => {
    if (series.length < 5) return null;
    return trendStats(series.map((d) => d.year), series.map((d) => d.value));
  }, [series]);

  // CI band around the Theil–Sen line, from the same bootstrap
  const band = useMemo(() => {
    if (series.length < 5) return null;
    const xs = series.map((d) => d.year), ys = series.map((d) => d.value);
    const ci = blockBootstrapCI(xs, ys);
    const sen = theilSen(xs, ys);
    const ols = olsSlope(xs, ys);
    return { ci, sen, ols };
  }, [series]);

  if (series.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const partial = (n: number) => n < 350; // flag incomplete years for annual counts
  const isDTR = indexId === "meanDTR";
  const [vlo, vhi] = extent(series, (d) => d.value) as [number, number];
  const x = scaleLinear().domain([yearMin - 0.7, yearMax + 0.7]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([Math.min(0, vlo), vhi * 1.1]).range([height - margin.bottom, margin.top]).nice();
  const bw = Math.min(20, (width - margin.left - margin.right) / (series.length * 1.5));

  // build CI band polygon (between slope-lo and slope-hi lines through the Sen anchor)
  let bandPath = "";
  if (band && !Number.isNaN(band.ci[0])) {
    const xm = series.reduce((s, d) => s + d.year, 0) / series.length;
    const ym = series.reduce((s, d) => s + d.value, 0) / series.length;
    const at = (yr: number, slope: number) => ym + slope * (yr - xm);
    const xa = yearMin, xb = yearMax;
    bandPath = [
      `${x(xa)},${y(at(xa, band.ci[0]))}`, `${x(xb)},${y(at(xb, band.ci[0]))}`,
      `${x(xb)},${y(at(xb, band.ci[1]))}`, `${x(xa)},${y(at(xa, band.ci[1]))}`,
    ].join(" ");
  }
  const senLine = band ? [yearMin, yearMax].map((yr) => `${x(yr)},${y(band.sen.intercept + band.sen.slope * yr)}`).join(" ") : "";

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img" onMouseLeave={() => setHover(null)}>
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={series.map((d) => d.year)} xFormat={(v) => String(v)} rotateX
          yFormat={(v) => String(Math.round(v))} yLabel={def.unit} />

        {bandPath && <polygon points={bandPath} fill={EMBER} opacity={0.12} />}

        {series.map((d) => (
          <g key={d.year} onMouseEnter={() => setHover(d.year)}>
            <rect x={x(d.year) - bw / 2} y={y(d.value)} width={bw}
              height={Math.max(0, height - margin.bottom - y(d.value))}
              fill={partial(d.nDays) ? "#c9bfa8" : "#e9a178"} stroke="#bc6c25" strokeWidth={0.6}
              opacity={hover === null || hover === d.year ? 0.95 : 0.55} rx={1.5} />
          </g>
        ))}

        {senLine && <polyline points={senLine} fill="none" stroke={EMBER} strokeWidth={3} strokeLinecap="round" />}

        {hover !== null && (() => {
          const d = series.find((s) => s.year === hover)!;
          const tx = Math.min(Math.max(x(hover), margin.left + 40), width - margin.right - 40);
          return (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={margin.top} y2={height - margin.bottom} stroke={INK} strokeWidth={0.6} opacity={0.3} />
              <g transform={`translate(${tx},${margin.top + 6})`}>
                <rect x={-46} y={0} width={92} height={36} rx={5} fill={INK} />
                <text x={0} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="JetBrains Mono, monospace">{d.year}</text>
                <text x={0} y={28} textAnchor="middle" fontSize={11} fill="#fff" fontFamily="JetBrains Mono, monospace">
                  {isDTR ? d.value.toFixed(1) : Math.round(d.value)} {def.unit}{partial(d.nDays) ? " *" : ""}
                </text>
              </g>
            </g>
          );
        })()}
      </svg>

      <div className="space-y-1 px-1">
        {stats && <StatsReadout s={stats} unit={def.unit.replace("/yr", "")} />}
        <p className="text-xs text-ink/55">
          {def.blurb} Bars are per-year totals; faded bars are partial years (&lt;350 days). Band = 95% bootstrap CI of the trend.
        </p>
      </div>
    </div>
  );
}
