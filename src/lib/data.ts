// Data loading + aggregation for the Jerusalem daily temperature archive.

export type Metric = "mean" | "high" | "low" | "dtr";

export interface Meta {
  station: string;
  source_url: string;
  credit: string;
  n_obs: number;
  year_min: number;
  year_max: number;
  note: string;
}

export interface Daily {
  year: number[];
  month: number[];
  day: number[];
  doy: number[];
  decyear: number[];
  mean: number[];
  high: number[];
  low: number[];
}

export interface Dataset {
  meta: Meta;
  daily: Daily;
}

export const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const METRIC_LABEL: Record<Metric, string> = {
  mean: "Daily mean",
  high: "Daily maximum",
  low: "Daily minimum",
  dtr: "Diurnal range (max−min)",
};

// Resolve a metric's value for a daily row index (DTR is derived on the fly).
export function metricValue(d: Daily, metric: Metric, i: number): number {
  if (metric === "dtr") return d.high[i] - d.low[i];
  return d[metric][i];
}

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/daily.json`);
  if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
  return res.json();
}

export interface DayPoint {
  year: number;
  month: number;
  day: number;
  doy: number;
  decyear: number;
  v: number; // value of the selected metric
}

// Flatten to points for a given metric, optionally filtered to a year range / month.
export function points(
  ds: Dataset,
  metric: Metric,
  opts: { yearMin?: number; yearMax?: number; month?: number } = {}
): DayPoint[] {
  const d = ds.daily;
  const out: DayPoint[] = [];
  for (let i = 0; i < d.year.length; i++) {
    if (opts.yearMin !== undefined && d.year[i] < opts.yearMin) continue;
    if (opts.yearMax !== undefined && d.year[i] > opts.yearMax) continue;
    if (opts.month !== undefined && d.month[i] !== opts.month) continue;
    out.push({
      year: d.year[i], month: d.month[i], day: d.day[i],
      doy: d.doy[i], decyear: d.decyear[i], v: metricValue(d, metric, i),
    });
  }
  return out;
}

export interface MonthlyStat {
  year: number;
  n: number;
  mean: number; // mean of daily metric values that month
  p25: number;
  median: number;
  p75: number;
  min: number;
  max: number;
  values: number[]; // raw daily values (for boxplots)
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

// Per-year stats for one month and metric.
export function monthlyStats(ds: Dataset, metric: Metric, month: number): MonthlyStat[] {
  const byYear = new Map<number, number[]>();
  const d = ds.daily;
  for (let i = 0; i < d.year.length; i++) {
    if (d.month[i] !== month) continue;
    if (!byYear.has(d.year[i])) byYear.set(d.year[i], []);
    byYear.get(d.year[i])!.push(metricValue(d, metric, i));
  }
  const out: MonthlyStat[] = [];
  for (const [year, raw] of byYear) {
    const values = [...raw].sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    out.push({
      year, n: values.length, mean,
      p25: quantile(values, 0.25),
      median: quantile(values, 0.5),
      p75: quantile(values, 0.75),
      min: values[0], max: values[values.length - 1],
      values,
    });
  }
  return out.sort((a, b) => a.year - b.year);
}

export function years(ds: Dataset): number[] {
  return Array.from(new Set(ds.daily.year)).sort((a, b) => a - b);
}

export interface AnnualMean { year: number; mean: number; n: number; }

// Per-year mean of a metric across the whole archive.
export function annualMeans(ds: Dataset, metric: Metric): AnnualMean[] {
  const d = ds.daily;
  const byYear = new Map<number, number[]>();
  for (let i = 0; i < d.year.length; i++) {
    if (!byYear.has(d.year[i])) byYear.set(d.year[i], []);
    byYear.get(d.year[i])!.push(metricValue(d, metric, i));
  }
  return [...byYear].sort((a, b) => a[0] - b[0]).map(([year, vs]) => ({
    year, n: vs.length, mean: vs.reduce((s, v) => s + v, 0) / vs.length,
  }));
}

// Min/max of a metric across the whole archive (handles derived DTR).
export function metricExtent(ds: Dataset, metric: Metric): [number, number] {
  const d = ds.daily;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < d.year.length; i++) {
    const v = metricValue(d, metric, i);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
