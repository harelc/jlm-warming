import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { useMeasure } from "../components/useMeasure";
import { points, metricExtent, METRIC_LABEL, type Dataset, type Metric } from "../lib/data";
import { GRID, INK } from "../lib/colors";

interface Props {
  ds: Dataset;
  metric: Metric;
  yearMin: number;
  yearMax: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Cyclical "year wheel": months around a circle, radius = temperature. Shows the
// seasonal cycle as a closed loop, with the early vs late epoch overlaid so the
// warming appears as the red loop bulging outside the blue one.
export function YearWheel({ ds, metric, yearMin, yearMax }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 560;

  const months = useMemo(() => {
    const mid = (yearMin + yearMax) / 2;
    const acc = Array.from({ length: 12 }, () => ({ all: [] as number[], early: [] as number[], late: [] as number[] }));
    for (const p of points(ds, metric, { yearMin, yearMax })) {
      const e = acc[p.month - 1];
      e.all.push(p.v);
      (p.year < mid ? e.early : e.late).push(p.v);
    }
    const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
    return acc.map((e) => ({
      mean: mean(e.all),
      min: e.all.length ? Math.min(...e.all) : NaN,
      max: e.all.length ? Math.max(...e.all) : NaN,
      early: mean(e.early), late: mean(e.late),
    }));
  }, [ds, metric, yearMin, yearMax]);

  if (months.every((m) => Number.isNaN(m.mean))) return <div ref={ref} className="text-ink/60 p-8">Not enough data.</div>;

  const [dmin, dmax] = metricExtent(ds, metric);
  const cx = width / 2, cy = height / 2 - 6;
  const outerR = Math.min(width, height) / 2 - 54;
  const innerR = 46;
  const r = scaleLinear().domain([dmin, dmax]).range([innerR, outerR]);
  const ang = (m: number) => ((m + 0.5) / 12) * 2 * Math.PI - Math.PI / 2; // mid-month, Jan at top
  const pt = (m: number, v: number) => [cx + r(v) * Math.cos(ang(m)), cy + r(v) * Math.sin(ang(m))] as const;
  const loop = (vals: number[]) =>
    vals.map((v, m) => `${m === 0 ? "M" : "L"}${pt(m, v).join(",")}`).join(" ") + " Z";

  const ticks = r.ticks(5).filter((t) => t >= dmin && t <= dmax);

  // min–max envelope as a ring (max loop, then min loop reversed)
  const band =
    months.map((mo, m) => `${m === 0 ? "M" : "L"}${pt(m, mo.max).join(",")}`).join(" ") + " " +
    months.map((_, i) => 11 - i).map((m) => `L${pt(m, months[m].min).join(",")}`).join(" ") + " Z";

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        {/* grid rings + temp labels */}
        {ticks.map((t) => (
          <g key={t}>
            <circle cx={cx} cy={cy} r={r(t)} fill="none" stroke={GRID} strokeWidth={1} />
            <text x={cx + 3} y={cy - r(t)} fontSize={9} fill={INK} opacity={0.5}
              fontFamily="JetBrains Mono, monospace">{Math.round(t)}°</text>
          </g>
        ))}
        {/* month spokes + labels */}
        {MONTHS.map((name, m) => {
          const [ox, oy] = pt(m, dmax);
          const [lx, ly] = [cx + (outerR + 16) * Math.cos(ang(m)), cy + (outerR + 16) * Math.sin(ang(m))];
          return (
            <g key={name}>
              <line x1={cx} y1={cy} x2={ox} y2={oy} stroke={GRID} strokeWidth={0.6} opacity={0.7} />
              <text x={lx} y={ly} fontSize={11} fill={INK} opacity={0.7} textAnchor="middle"
                dominantBaseline="middle" fontFamily="Archivo, sans-serif" fontWeight={600}>{name}</text>
            </g>
          );
        })}

        <path d={band} fill="#bbb" opacity={0.16} />
        <path d={loop(months.map((m) => m.early))} fill="none" stroke="#1d4e89" strokeWidth={2} opacity={0.9} />
        <path d={loop(months.map((m) => m.late))} fill="none" stroke="#cb181d" strokeWidth={2.4} opacity={0.95} />
        {months.map((mo, m) => {
          const [ex, ey] = pt(m, mo.early), [lx, ly] = pt(m, mo.late);
          return (
            <g key={m}>
              <circle cx={ex} cy={ey} r={2} fill="#1d4e89" />
              <circle cx={lx} cy={ly} r={2.4} fill="#cb181d" />
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        <span className="inline-flex items-center gap-1.5"><span style={{ background: "#1d4e89", height: 2, width: 16 }} /> early {yearMin}–{Math.floor((yearMin + yearMax) / 2) - 1}</span>
        <span className="inline-flex items-center gap-1.5"><span style={{ background: "#cb181d", height: 2, width: 16 }} /> late {Math.floor((yearMin + yearMax) / 2)}–{yearMax}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[#bbb]/40" /> daily min–max envelope</span>
        <span className="text-ink/50">{METRIC_LABEL[metric]} by month, radius = °C. Red outside blue = warming.</span>
      </div>
    </div>
  );
}
