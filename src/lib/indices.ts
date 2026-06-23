// Per-year climate-change indices derived from daily max / min.
import type { Dataset } from "./data";

export type IndexId =
  | "hotDays" | "veryHotDays" | "tropicalNights" | "coolNights" | "warmSpell" | "meanDTR";

export interface IndexDef {
  id: IndexId;
  label: string;
  unit: string;
  blurb: string;
}

export const INDEX_DEFS: IndexDef[] = [
  { id: "hotDays", label: "Hot days (max ≥ 30°C)", unit: "days/yr", blurb: "Days with a daily maximum at or above 30 °C." },
  { id: "veryHotDays", label: "Very hot days (max ≥ 35°C)", unit: "days/yr", blurb: "Days with a daily maximum at or above 35 °C — heat-stress territory." },
  { id: "tropicalNights", label: "Tropical nights (min ≥ 20°C)", unit: "nights/yr", blurb: "Nights that never drop below 20 °C — the kind you can't sleep through." },
  { id: "coolNights", label: "Cool nights (min ≤ 8°C)", unit: "nights/yr", blurb: "Nights with a daily minimum at or below 8 °C (Jerusalem rarely freezes)." },
  { id: "warmSpell", label: "Longest warm spell (max ≥ 30°C)", unit: "days", blurb: "Longest consecutive run of days with max ≥ 30 °C." },
  { id: "meanDTR", label: "Mean diurnal range (max−min)", unit: "°C", blurb: "Average daily max-minus-min. A narrowing range = nights warming faster than days." },
];

export interface YearIndex {
  year: number;
  value: number;
  nDays: number; // coverage that year (to flag partial years)
}

export function indexSeries(ds: Dataset, id: IndexId): YearIndex[] {
  const d = ds.daily;
  const byYear = new Map<number, { hi: number[]; lo: number[] }>();
  for (let i = 0; i < d.year.length; i++) {
    if (!byYear.has(d.year[i])) byYear.set(d.year[i], { hi: [], lo: [] });
    const e = byYear.get(d.year[i])!;
    e.hi.push(d.high[i]); e.lo.push(d.low[i]);
  }
  const out: YearIndex[] = [];
  for (const [year, e] of [...byYear].sort((a, b) => a[0] - b[0])) {
    const n = e.hi.length;
    let value = 0;
    switch (id) {
      case "hotDays": value = e.hi.filter((v) => v >= 30).length; break;
      case "veryHotDays": value = e.hi.filter((v) => v >= 35).length; break;
      case "tropicalNights": value = e.lo.filter((v) => v >= 20).length; break;
      case "coolNights": value = e.lo.filter((v) => v <= 8).length; break;
      case "warmSpell": {
        let run = 0, best = 0;
        for (const v of e.hi) { run = v >= 30 ? run + 1 : 0; best = Math.max(best, run); }
        value = best; break;
      }
      case "meanDTR": value = e.hi.reduce((s, v, k) => s + (v - e.lo[k]), 0) / n; break;
    }
    out.push({ year, value, nDays: n });
  }
  return out;
}
