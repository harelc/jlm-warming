import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { monthlyStats, type Dataset, type Metric, METRIC_LABEL, MONTH_NAMES } from "../lib/data";
import { polyFit } from "../lib/regression";
import { trendStats, blockBootstrapCI } from "../lib/stats";
import { Term } from "../components/Term";
import { StatsReadout } from "../components/StatsReadout";
import { EMBER } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  month: number;
  yearMin: number;
  yearMax: number;
  method: "linear" | "quadratic";
}

// Tukey whiskers: extend to furthest point within 1.5*IQR; rest are outliers.
function whiskers(s: { values: number[]; p25: number; p75: number }) {
  const iqr = s.p75 - s.p25;
  const loF = s.p25 - 1.5 * iqr, hiF = s.p75 + 1.5 * iqr;
  let lo = Infinity, hi = -Infinity;
  const out: number[] = [];
  for (const v of s.values) {
    if (v < loF || v > hiF) out.push(v);
    else { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  if (lo === Infinity) { lo = s.p25; hi = s.p75; }
  return { lo, hi, out };
}

export function BoxplotChart({ ds, metric, month, yearMin, yearMax, method }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 460;
  const margin = { top: 20, right: 24, bottom: 54, left: 52 };

  const stats = useMemo(
    () => monthlyStats(ds, metric, month).filter((s) => s.year >= yearMin && s.year <= yearMax),
    [ds, metric, month, yearMin, yearMax]
  );

  // Trend on the per-year MEANS (same robust treatment as the Yearly-trend tab,
  // so the reported numbers are clear and consistent across views).
  const robust = useMemo(
    () => (stats.length >= 5 ? trendStats(stats.map((s) => s.year), stats.map((s) => s.mean)) : null),
    [stats]
  );
  const ciBand = useMemo(
    () => (stats.length >= 5 ? blockBootstrapCI(stats.map((s) => s.year), stats.map((s) => s.mean)) : null),
    [stats]
  );
  const quadFit = useMemo(
    () => (method === "quadratic" && stats.length >= 3
      ? polyFit(stats.map((s) => s.year), stats.map((s) => s.mean), 2) : null),
    [stats, method]
  );

  if (stats.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const all = stats.flatMap((s) => s.values);
  const [ylo, yhi] = extent(all) as [number, number];
  const x = scaleLinear().domain([yearMin - 0.7, yearMax + 0.7]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([ylo - 1, yhi + 1]).range([height - margin.bottom, margin.top]).nice();
  const bw = Math.min(18, (width - margin.left - margin.right) / (stats.length * 1.7));

  // linear → Theil–Sen line; quadratic → OLS quadratic curve
  const fitPts: string[] = [];
  if (method === "linear" && robust) {
    for (const yr of [yearMin, yearMax]) fitPts.push(`${x(yr)},${y(robust.senIntercept + robust.senSlope * yr)}`);
  } else if (quadFit) {
    for (let yr = yearMin; yr <= yearMax; yr += 0.25) fitPts.push(`${x(yr)},${y(quadFit.predict(yr))}`);
  }
  let bandPath = "";
  if (ciBand && robust && !Number.isNaN(ciBand[0])) {
    const xm = stats.reduce((s, d) => s + d.year, 0) / stats.length;
    const ym = robust.senIntercept + robust.senSlope * xm; // pivot on the Sen line
    const at = (yr: number, slope: number) => ym + slope * (yr - xm);
    bandPath = [
      `${x(yearMin)},${y(at(yearMin, ciBand[0]))}`, `${x(yearMax)},${y(at(yearMax, ciBand[0]))}`,
      `${x(yearMax)},${y(at(yearMax, ciBand[1]))}`, `${x(yearMin)},${y(at(yearMin, ciBand[1]))}`,
    ].join(" ");
  }

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={stats.map((s) => s.year)} xFormat={(v) => String(v)} rotateX
          yFormat={(v) => `${v}°`} yLabel={`${METRIC_LABEL[metric]} (°C)`} />

        {bandPath && <polygon points={bandPath} fill={EMBER} opacity={0.12} />}

        {stats.map((s) => {
          const w = whiskers(s);
          const cx = x(s.year);
          return (
            <g key={s.year}>
              <line x1={cx} x2={cx} y1={y(w.lo)} y2={y(w.hi)} stroke="#1d4e89" strokeWidth={1} />
              <line x1={cx - bw / 3} x2={cx + bw / 3} y1={y(w.lo)} y2={y(w.lo)} stroke="#1d4e89" />
              <line x1={cx - bw / 3} x2={cx + bw / 3} y1={y(w.hi)} y2={y(w.hi)} stroke="#1d4e89" />
              <rect x={cx - bw / 2} y={y(s.p75)} width={bw} height={Math.max(1, y(s.p25) - y(s.p75))}
                fill="#9ecae1" stroke="#2171b5" strokeWidth={1} fillOpacity={0.85} />
              <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(s.median)} y2={y(s.median)}
                stroke="#9b2226" strokeWidth={1.6} />
              {w.out.map((v, i) => (
                <path key={i} d={diamond(cx, y(v), 3)} fill="#d62728" stroke="#7a0000" strokeWidth={0.5} />
              ))}
            </g>
          );
        })}

        {fitPts.length > 0 && (
          <polyline points={fitPts.join(" ")} fill="none" stroke={EMBER} strokeWidth={3}
            strokeLinecap="round" />
        )}
      </svg>

      <div className="space-y-1 px-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded-sm border border-[#2171b5] bg-[#9ecae1]" />
            <Term name="iqr">IQR</Term> (25–75th pct of {METRIC_LABEL[metric].toLowerCase()} readings for {MONTH_NAMES[month]})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ background: "#d62728" }} className="inline-block h-2 w-2 rotate-45" /> outlier day
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ background: EMBER, height: 4, width: 16, borderRadius: 2 }} />
            {method === "linear" ? "Theil–Sen line" : "OLS quadratic"} on yearly means + 95% CI
          </span>
        </div>
        {robust && <StatsReadout s={robust} unit="°C" />}
      </div>
    </div>
  );
}

function diamond(cx: number, cy: number, r: number): string {
  return `M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z`;
}
