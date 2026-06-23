import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { points, annualMeans, type Dataset, type Metric, METRIC_LABEL } from "../lib/data";
import { harmonicFitByDoy, polyFit } from "../lib/regression";
import { trendStats, blockBootstrapCI } from "../lib/stats";
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

  // Trend reported & drawn the SAME way as every other tab: robust stats on the
  // metric's annual means, drawing the Theil–Sen line (linear) / OLS quadratic.
  const am = useMemo(
    () => annualMeans(ds, metric).filter((d) => d.year >= yearMin && d.year <= yearMax),
    [ds, metric, yearMin, yearMax]
  );
  const robust = useMemo(() => (am.length >= 5 ? trendStats(am.map((d) => d.year), am.map((d) => d.mean)) : null), [am]);
  const ciBand = useMemo(() => (am.length >= 5 ? blockBootstrapCI(am.map((d) => d.year), am.map((d) => d.mean)) : null), [am]);
  const quadFit = useMemo(
    () => (method === "quadratic" && am.length >= 3 ? polyFit(am.map((d) => d.year), am.map((d) => d.mean), 2) : null),
    [am, method]
  );
  // pooled harmonic SHAPE for the seasonal overlay (rides the same trend)
  const shapeFit = useMemo(() => (pts.length >= 20 ? harmonicFitByDoy(pts.map((p) => p.doy), pts.map((p) => p.v), 4) : null), [pts]);

  if (pts.length < 2) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const [ylo, yhi] = extent(pts, (p) => p.v) as [number, number];
  const x = scaleLinear().domain([yearMin, yearMax + 1]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([ylo - 1, yhi + 1]).range([height - margin.bottom, margin.top]).nice();
  const color = yearColorScale(yearMin, yearMax);

  const trendAt = (t: number): number =>
    method === "linear" && robust ? robust.senIntercept + robust.senSlope * t
      : quadFit ? quadFit.predict(t) : NaN;
  const haveTrend = (method === "linear" && robust) || quadFit;

  const trendPts: string[] = [];
  if (haveTrend) for (let t = yearMin; t <= yearMax + 1; t += 0.05) trendPts.push(`${x(t)},${y(trendAt(t))}`);

  // seasonal overlay = pooled harmonic shape riding the SAME trend
  const seasonalPts: string[] = [];
  if (shapeFit && haveTrend && showSeasonal) {
    const meanShape = pts.reduce((s, p) => s + shapeFit.predict(p.doy), 0) / pts.length;
    for (let t = yearMin; t <= yearMax + 1; t += 0.01) {
      const doy = (t - Math.floor(t)) * 365.25 + 0.5;
      seasonalPts.push(`${x(t)},${y(shapeFit.predict(doy) - meanShape + trendAt(t))}`);
    }
  }

  let bandPath = "";
  if (ciBand && !Number.isNaN(ciBand[0])) {
    const xm = am.reduce((s, d) => s + d.year, 0) / am.length;
    const ym = am.reduce((s, d) => s + d.mean, 0) / am.length;
    const at = (yr: number, slope: number) => ym + slope * (yr - xm);
    bandPath = [
      `${x(yearMin)},${y(at(yearMin, ciBand[0]))}`, `${x(yearMax + 1)},${y(at(yearMax + 1, ciBand[0]))}`,
      `${x(yearMax + 1)},${y(at(yearMax + 1, ciBand[1]))}`, `${x(yearMin)},${y(at(yearMin, ciBand[1]))}`,
    ].join(" ");
  }

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i)}
          xFormat={(v) => `'${String(v).slice(2)}`}
          yFormat={(v) => `${v}°`} yLabel={`${METRIC_LABEL[metric]} (°C)`} xLabel="Every daily reading, 2002 → 2026" />

        {bandPath && <polygon points={bandPath} fill={EMBER} opacity={0.12} />}

        {pts.map((p, i) => (
          <circle key={i} cx={x(p.decyear)} cy={y(p.v)} r={1.3}
            fill={color(p.year)} fillOpacity={0.5} />
        ))}

        {showSeasonal && seasonalPts.length > 0 && (
          <polyline points={seasonalPts.join(" ")} fill="none" stroke="#1d4e89" strokeWidth={1}
            opacity={0.7} />
        )}
        {trendPts.length > 0 && (
          <polyline points={trendPts.join(" ")} fill="none" stroke={EMBER} strokeWidth={3}
            strokeLinecap="round" />
        )}
      </svg>

      <div className="space-y-1 px-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink/70">
          <span>{pts.length.toLocaleString()} daily readings</span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ background: EMBER, height: 4, width: 16, borderRadius: 2 }} />
            {method === "linear" ? "Theil–Sen" : "OLS quadratic"} on annual means + 95% CI
          </span>
          {showSeasonal && (
            <span className="inline-flex items-center gap-1.5">
              <span style={{ background: "#1d4e89", height: 2, width: 16 }} /> seasonal cycle riding the trend
            </span>
          )}
        </div>
        {robust && <StatsReadout s={robust} unit="°C" />}
      </div>
    </div>
  );
}
