import { scaleSequential } from "d3-scale";
import { interpolateRgbBasis } from "d3-interpolate";

// A cold→hot ramp for coloring years (deep blue → teal → amber → ember-red).
const HEAT = interpolateRgbBasis([
  "#1d4e89", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51", "#9b2226",
]);

export function yearColorScale(yearMin: number, yearMax: number) {
  // guard against a degenerate domain (single year) which yields invisible fills
  const hi = yearMax === yearMin ? yearMin + 1 : yearMax;
  return scaleSequential(HEAT).domain([yearMin, hi]);
}

// Series colors for the trend chart (the five monthly summary stats).
export const SERIES = {
  max: { label: "Monthly max", color: "#9b2226" },
  mean_high: { label: "Mean of daily highs", color: "#e76f51" },
  mean: { label: "Monthly mean", color: "#bc6c25" },
  mean_low: { label: "Mean of daily lows", color: "#2a9d8f" },
  min: { label: "Monthly min", color: "#1d4e89" },
} as const;

export const INK = "#1c150f";
export const EMBER = "#c2410c";
export const GRID = "#d8cdb8";
