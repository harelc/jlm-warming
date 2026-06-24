import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { useZoom } from "../components/useZoom";
import { ZoomHint } from "./TimeSeriesChart";
import { points, metricExtent, type Dataset, type Metric, METRIC_LABEL } from "../lib/data";
import { harmonicFitByDoy } from "../lib/regression";
import { yearColorScale } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  selectedYears: Set<number>; // arbitrary subset of years to display
  colorDomain: [number, number]; // global year range, so colors are stable
  mode: "pooled" | "peryear";
  smoother: "harmonic" | "moving";
  K: number;       // harmonic count
  window: number;  // moving-average window in days
}

const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Moving-average over a ±window/2 day window. Wraps day-of-year (Dec↔Jan) ONLY
// when the data covers the full year; for a partial year (e.g. an in-progress
// 2026) it clamps to the observed range with a non-wrapping window — so the
// curve neither bleeds January into December nor spills past the last day.
function movingMean(doy: number[], v: number[], W: number): [number, number][] {
  const sum = new Array(367).fill(0), cnt = new Array(367).fill(0);
  let minD = 367, maxD = 0;
  for (let i = 0; i < doy.length; i++) {
    const d = Math.round(doy[i]); sum[d] += v[i]; cnt[d]++;
    if (d < minD) minD = d; if (d > maxD) maxD = d;
  }
  const half = Math.floor(W / 2);
  const full = minD <= 1 + half && maxD >= 366 - half; // data reaches both ends → seam is real
  const lo = full ? 1 : minD, hi = full ? 366 : maxD;
  const out: [number, number][] = [];
  for (let d = lo; d <= hi; d++) {
    let s = 0, c = 0;
    for (let k = -half; k <= half; k++) {
      let dd = d + k;
      if (full) dd = ((dd - 1) % 366 + 366) % 366 + 1;
      else if (dd < 1 || dd > 366) continue; // clamp, don't wrap
      s += sum[dd]; c += cnt[dd];
    }
    if (c > 0) out.push([d, s / c]);
  }
  return out;
}

export function SeasonalChart({ ds, metric, selectedYears, colorDomain, mode, smoother, K, window }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const { setZoomRef, transform, reset, zoomed } = useZoom();
  const height = 480;
  const margin = { top: 20, right: 24, bottom: 48, left: 52 };

  const pts = useMemo(
    () => points(ds, metric).filter((p) => selectedYears.has(p.year)),
    [ds, metric, selectedYears]
  );

  const curves = useMemo(() => {
    if (pts.length < 10) return [];
    const makeCurve = (doy: number[], v: number[], full: boolean): [number, number][] => {
      if (smoother === "moving") return movingMean(doy, v, window);
      if (doy.length < 2 * K + 1) return [];
      const fit = harmonicFitByDoy(doy, v, K);
      const path: [number, number][] = [];
      const lo = full ? 1 : Math.min(...doy), hi = full ? 366 : Math.max(...doy);
      for (let d = lo; d <= hi; d += 1) path.push([d, fit.predict(d)]);
      return path;
    };
    if (mode === "pooled") {
      return [{ year: colorDomain[1], path: makeCurve(pts.map((p) => p.doy), pts.map((p) => p.v), true) }];
    }
    const byYear = new Map<number, { doy: number[]; v: number[] }>();
    for (const p of pts) {
      if (!byYear.has(p.year)) byYear.set(p.year, { doy: [], v: [] });
      const e = byYear.get(p.year)!;
      e.doy.push(p.doy); e.v.push(p.v);
    }
    return [...byYear].sort((a, b) => a[0] - b[0])
      .map(([year, e]) => ({ year, path: makeCurve(e.doy, e.v, false) }))
      .filter((c) => c.path.length > 1);
  }, [pts, mode, smoother, K, window, colorDomain]);

  if (pts.length < 2) return <div ref={ref} className="text-ink/60 p-8">Select at least one year.</div>;

  const single = selectedYears.size === 1;
  // Fix the y-domain to the full metric range across ALL years so changing the
  // year selection keeps the axis stable and comparable.
  const [ylo, yhi] = metricExtent(ds, metric);
  const x0 = scaleLinear().domain([1, 366]).range([margin.left, width - margin.right]);
  const y0 = scaleLinear().domain([ylo - 1, yhi + 1]).range([height - margin.bottom, margin.top]).nice();
  const x = transform.rescaleX(x0);
  const y = transform.rescaleY(y0);
  const color = yearColorScale(colorDomain[0], colorDomain[1]);
  const fitLabel = smoother === "moving" ? `${window}-day moving average` : `${K}-harmonic fit`;

  return (
    <div ref={ref} className="relative w-full">
      <svg ref={setZoomRef} width={width} height={height} role="img"
        className="cursor-grab touch-none select-none active:cursor-grabbing">
        <defs>
          <clipPath id="clip-seasonal">
            <rect x={margin.left} y={margin.top} width={Math.max(0, width - margin.left - margin.right)}
              height={Math.max(0, height - margin.top - margin.bottom)} />
          </clipPath>
        </defs>
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          xTicks={zoomed ? undefined : MONTH_STARTS}
          xFormat={(v) => (zoomed ? String(Math.round(v)) : MONTH_ABBR[MONTH_STARTS.indexOf(v)] ?? "")}
          yFormat={(v) => `${v}°`} yLabel={`${METRIC_LABEL[metric]} (°C)`}
          xLabel={zoomed ? "Day of year" : "Day of year"} />

        <g clipPath="url(#clip-seasonal)">
          {/* points always colored by year (matching the pills); single selection
              just gets larger, more opaque dots for readability */}
          {pts.map((p, i) => (
            <circle key={i} cx={x(p.doy)} cy={y(p.v)}
              r={single ? 2.2 : 1.2} fill={color(p.year)}
              fillOpacity={single ? 0.55 : 0.4} />
          ))}

          {curves.map((c, i) => (
            <polyline key={i}
              points={c.path.map(([d, v]) => `${x(d)},${y(v)}`).join(" ")}
              fill="none"
              stroke={mode === "pooled" ? "#1c150f" : color(c.year)}
              strokeWidth={mode === "pooled" || single ? 3 : 1.5}
              opacity={mode === "pooled" || single ? 1 : 0.85} />
          ))}
        </g>
      </svg>

      <ZoomHint zoomed={zoomed} onReset={reset} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        {single ? (
          <span>{pts.length.toLocaleString()} daily readings in {[...selectedYears][0]}, with its {fitLabel}</span>
        ) : (
          <>
            <span>{pts.length.toLocaleString()} readings, colored by year (blue = older → red = recent)</span>
            <span>{mode === "pooled"
              ? `One pooled ${fitLabel}`
              : `${curves.length} independent ${fitLabel}s, one per year`}</span>
          </>
        )}
      </div>
    </div>
  );
}
