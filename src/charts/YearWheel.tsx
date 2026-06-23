import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { useMeasure } from "../components/useMeasure";
import { points, metricExtent, METRIC_LABEL, type Dataset, type Metric } from "../lib/data";
import { GRID, INK, yearColorScale } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  selectedYears: Set<number>;
  colorDomain: [number, number]; // global year range, stable colors
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q, b = Math.floor(pos), rest = pos - b;
  return sorted[b + 1] !== undefined ? sorted[b] + rest * (sorted[b + 1] - sorted[b]) : sorted[b];
}

// Cyclical "year wheel": months around a circle, radius = temperature.
//  - shaded fan = middle-50% (IQR) of daily readings each month (the typical range)
//  - bold loop  = the median climatology
//  - thin loops = each selected year's monthly mean, colored by year
//  - hover a wedge to read that month's numbers in the hub
export function YearWheel({ ds, metric, selectedYears, colorDomain }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 560;

  const { loops, month } = useMemo(() => {
    const byYear = new Map<number, number[][]>();
    const daily: number[][] = Array.from({ length: 12 }, () => []);
    for (const p of points(ds, metric)) {
      if (!selectedYears.has(p.year)) continue;
      if (!byYear.has(p.year)) byYear.set(p.year, Array.from({ length: 12 }, () => []));
      byYear.get(p.year)![p.month - 1].push(p.v);
      daily[p.month - 1].push(p.v);
    }
    const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
    const loops = [...byYear].sort((a, b) => a[0] - b[0]).map(([year, months]) => ({
      year, vals: months.map(mean),
    }));
    const month = daily.map((a) => {
      const s = [...a].sort((p, q) => p - q);
      return { n: a.length, p25: quantile(s, 0.25), p50: quantile(s, 0.5), p75: quantile(s, 0.75) };
    });
    return { loops, month };
  }, [ds, metric, selectedYears]);

  if (!loops.length) return <div ref={ref} className="text-ink/60 p-8">Select at least one year.</div>;

  const single = loops.length === 1;
  const [dmin, dmax] = metricExtent(ds, metric);
  const cx = width / 2, cy = height / 2 - 6;
  const outerR = Math.min(width, height) / 2 - 54;
  const innerR = 60;
  const r = scaleLinear().domain([dmin, dmax]).range([innerR, outerR]);
  const color = yearColorScale(colorDomain[0], colorDomain[1]);
  const ang = (m: number) => ((m + 0.5) / 12) * 2 * Math.PI - Math.PI / 2; // mid-month, Jan at top
  const pt = (m: number, v: number) => [cx + r(v) * Math.cos(ang(m)), cy + r(v) * Math.sin(ang(m))] as const;
  const loopPath = (vals: number[]) => {
    const seg = vals.map((v, m) => (Number.isNaN(v) ? null : pt(m, v).join(","))).filter(Boolean) as string[];
    return seg.length ? "M" + seg.join(" L") + " Z" : "";
  };
  const closed = (pick: (mo: typeof month[number]) => number) =>
    "M" + month.map((mo, m) => pt(m, pick(mo)).join(",")).join(" L") + " Z";

  const ticks = r.ticks(5).filter((t) => t >= dmin && t <= dmax);
  const fanOk = month.every((mo) => Number.isFinite(mo.p25) && Number.isFinite(mo.p75));
  const fan = fanOk ? `${closed((mo) => mo.p75)} ${closed((mo) => mo.p25)}` : "";

  // wedge sector (center → outer) for hover capture
  const wedge = (m: number) => {
    const a0 = (m / 12) * 2 * Math.PI - Math.PI / 2, a1 = ((m + 1) / 12) * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + outerR * Math.cos(a0), y0 = cy + outerR * Math.sin(a0);
    const x1 = cx + outerR * Math.cos(a1), y1 = cy + outerR * Math.sin(a1);
    return `M${cx},${cy} L${x0},${y0} A${outerR},${outerR} 0 0 1 ${x1},${y1} Z`;
  };

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <circle cx={cx} cy={cy} r={r(t)} fill="none" stroke={GRID} strokeWidth={1} />
            <text x={cx + 3} y={cy - r(t)} fontSize={9} fill={INK} opacity={0.5}
              fontFamily="JetBrains Mono, monospace">{Math.round(t)}°</text>
          </g>
        ))}
        {MONTHS.map((name, m) => {
          const [ox, oy] = pt(m, dmax);
          const [lx, ly] = [cx + (outerR + 16) * Math.cos(ang(m)), cy + (outerR + 16) * Math.sin(ang(m))];
          return (
            <g key={name}>
              <line x1={cx} y1={cy} x2={ox} y2={oy} stroke={GRID} strokeWidth={0.6} opacity={0.7} />
              <text x={lx} y={ly} fontSize={11} fill={INK} opacity={hover === m ? 1 : 0.7} textAnchor="middle"
                dominantBaseline="middle" fontFamily="Archivo, sans-serif"
                fontWeight={hover === m ? 800 : 600}>{name}</text>
            </g>
          );
        })}

        {/* IQR fan + highlighted month sector */}
        {fan && <path d={fan} fillRule="evenodd" fill="#c98a5e" opacity={0.18} />}
        {hover !== null && <path d={wedge(hover)} fill={INK} opacity={0.05} />}

        {/* median climatology loop — subtle dashed reference, UNDER the year lines */}
        {!single && fanOk && (
          <path d={loopPath(month.map((mo) => mo.p50))} fill="none" stroke={INK} strokeWidth={1.2}
            strokeDasharray="3 3" opacity={0.4} />
        )}
        {/* per-year mean loops on top */}
        {loops.map((lp) => (
          <path key={lp.year} d={loopPath(lp.vals)} fill="none"
            stroke={color(lp.year)} strokeWidth={single ? 2.6 : 1.6} opacity={single ? 1 : 0.8} />
        ))}

        {/* invisible hover wedges */}
        {MONTHS.map((_, m) => (
          <path key={m} d={wedge(m)} fill="transparent" onMouseEnter={() => setHover(m)} />
        ))}

        {/* hub readout */}
        {hover !== null && month[hover].n > 0 && (
          <g pointerEvents="none" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            <text x={cx} y={cy - 12} fontSize={13} fontWeight={700} fill={INK}>{MONTHS[hover]}</text>
            <text x={cx} y={cy + 5} fontSize={11} fill={INK} opacity={0.75}>med {month[hover].p50.toFixed(1)}°</text>
            <text x={cx} y={cy + 20} fontSize={10} fill={INK} opacity={0.55}>
              IQR {month[hover].p25.toFixed(1)}–{month[hover].p75.toFixed(1)}°
            </text>
          </g>
        )}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        {single
          ? <span>{loops[0].year} — monthly-mean {METRIC_LABEL[metric].toLowerCase()} around the year</span>
          : <span>{loops.length} years, thin loops colored by year (blue = older → red = recent)</span>}
        {!single && <span className="inline-flex items-center gap-1.5"><span style={{ borderTop: "1.5px dashed " + INK, width: 16, opacity: 0.5 }} /> median climatology</span>}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#c98a5e", opacity: 0.3 }} /> middle-50% of daily readings (IQR)</span>
        <span className="text-ink/50">hover a month for its numbers</span>
      </div>
    </div>
  );
}
