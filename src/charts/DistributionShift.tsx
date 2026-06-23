import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { Axes } from "../components/Axes";
import { useMeasure } from "../components/useMeasure";
import { points, metricExtent, METRIC_LABEL, type Dataset, type Metric } from "../lib/data";

interface Props {
  ds: Dataset;
  metric: Metric;
  yearMin: number;
  yearMax: number;
}

function gaussianKDE(samples: number[], grid: number[]): number[] {
  const n = samples.length;
  const mean = samples.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const bw = 1.06 * sd * Math.pow(n, -1 / 5) || 1;
  const norm = 1 / (n * bw * Math.sqrt(2 * Math.PI));
  return grid.map((g) => {
    let s = 0;
    for (const x of samples) { const u = (g - x) / bw; s += Math.exp(-0.5 * u * u); }
    return s * norm;
  });
}

// Compare the daily-value distribution of an early vs a late slice of the
// selected range — shows the WHOLE distribution sliding, not just the mean.
export function DistributionShift({ ds, metric, yearMin, yearMax }: Props) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const height = 460;
  const margin = { top: 20, right: 24, bottom: 54, left: 52 };

  const model = useMemo(() => {
    const span = yearMax - yearMin;
    const cut = Math.floor(span / 2);
    const earlyMax = yearMin + Math.max(0, Math.min(cut, span - 1));
    const lateMin = yearMax - Math.max(0, Math.min(cut, span - 1));
    const early = points(ds, metric, { yearMin, yearMax: earlyMax }).map((p) => p.v);
    const late = points(ds, metric, { yearMin: lateMin, yearMax }).map((p) => p.v);
    if (early.length < 20 || late.length < 20) return null;
    const [lo, hi] = metricExtent(ds, metric);
    const grid: number[] = [];
    const step = (hi - lo) / 160;
    for (let g = lo - 1; g <= hi + 1; g += step) grid.push(g);
    const de = gaussianKDE(early, grid);
    const dl = gaussianKDE(late, grid);
    const meanE = early.reduce((s, v) => s + v, 0) / early.length;
    const meanL = late.reduce((s, v) => s + v, 0) / late.length;
    return {
      grid, de, dl, meanE, meanL,
      labelE: `${yearMin}–${earlyMax}`, labelL: `${lateMin}–${yearMax}`,
      dmax: Math.max(...de, ...dl),
    };
  }, [ds, metric, yearMin, yearMax]);

  if (!model) return <div ref={ref} className="text-ink/60 p-8">Widen the year range to compare periods.</div>;

  const x = scaleLinear().domain([model.grid[0], model.grid[model.grid.length - 1]]).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([0, model.dmax * 1.08]).range([height - margin.bottom, margin.top]).nice();
  const area = (d: number[]) =>
    `M${x(model.grid[0])},${y(0)} ` + model.grid.map((g, i) => `L${x(g)},${y(d[i])}`).join(" ") + ` L${x(model.grid[model.grid.length - 1])},${y(0)} Z`;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} role="img">
        <Axes x={x} y={y} width={width} height={height} margin={margin}
          yTicks={[]} xFormat={(v) => `${v}°`} xLabel={`${METRIC_LABEL[metric]} (°C)`} yLabel="density" />
        <path d={area(model.de)} fill="#1d4e89" fillOpacity={0.32} stroke="#1d4e89" strokeWidth={1.5} />
        <path d={area(model.dl)} fill="#cb181d" fillOpacity={0.32} stroke="#cb181d" strokeWidth={1.5} />
        <line x1={x(model.meanE)} x2={x(model.meanE)} y1={margin.top} y2={height - margin.bottom} stroke="#1d4e89" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={x(model.meanL)} x2={x(model.meanL)} y1={margin.top} y2={height - margin.bottom} stroke="#cb181d" strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-ink/70">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[#1d4e89]/40 ring-1 ring-[#1d4e89]" /> early {model.labelE}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[#cb181d]/40 ring-1 ring-[#cb181d]" /> late {model.labelL}</span>
        <span className="font-mono font-semibold text-ember tnum">
          mean shift {model.meanL - model.meanE >= 0 ? "+" : ""}{(model.meanL - model.meanE).toFixed(2)} °C
        </span>
        <span className="text-ink/50">whole-year daily {METRIC_LABEL[metric].toLowerCase()} distribution</span>
      </div>
    </div>
  );
}
