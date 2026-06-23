// Robust trend statistics for annual (or per-year index) series.
// Everything here operates on a small per-year series (n ~ 25), where the
// strong daily autocorrelation has already been collapsed by aggregation.

export interface TrendStats {
  n: number;
  olsSlope: number;      // per year
  senSlope: number;      // Theil–Sen, per year
  senIntercept: number;
  tau: number;           // Kendall's tau
  mkP: number;           // Mann–Kendall two-sided p-value
  ci: [number, number];  // 95% block-bootstrap CI for the slope (per year)
  breakYear: number | null; // Pettitt change-point (year), if significant
  breakP: number;
}

export function normalCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export function mannKendall(y: number[]): { S: number; tau: number; p: number } {
  const n = y.length;
  let S = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i]);
  // tie correction for variance
  const counts = new Map<number, number>();
  for (const v of y) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tie = 0;
  for (const t of counts.values()) tie += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tie) / 18;
  const z = S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const tau = S / (0.5 * n * (n - 1));
  return { S, tau, p };
}

export function theilSen(x: number[], y: number[]): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < x.length - 1; i++)
    for (let j = i + 1; j < x.length; j++)
      if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
  const slope = median(slopes);
  const inter = median(x.map((xi, i) => y[i] - slope * xi));
  return { slope, intercept: inter };
}

export function olsSlope(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const slope = sxx ? sxy / sxx : 0;
  return { slope, intercept: my - slope * mx };
}

function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = [...a].sort((p, q) => p - q);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Moving-block bootstrap of OLS-residuals → CI for the slope. Preserves the x
// positions and the residual autocorrelation structure (block length L).
// Deterministic PRNG so results are stable across renders.
export function blockBootstrapCI(
  x: number[], y: number[], B = 800, seed = 12345
): [number, number] {
  const n = x.length;
  if (n < 5) return [NaN, NaN];
  const { slope, intercept } = olsSlope(x, y);
  const fitted = x.map((xi) => intercept + slope * xi);
  const resid = y.map((yi, i) => yi - fitted[i]);
  const L = Math.max(2, Math.round(Math.pow(n, 1 / 3)));
  const nBlocks = Math.ceil(n / L);

  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  const slopes: number[] = [];
  for (let b = 0; b < B; b++) {
    const res: number[] = [];
    while (res.length < n) {
      const start = Math.floor(rand() * n);
      for (let k = 0; k < L && res.length < n; k++) res.push(resid[(start + k) % n]);
    }
    const yb = fitted.map((f, i) => f + res[i]);
    slopes.push(olsSlope(x, yb).slope);
    void nBlocks;
  }
  slopes.sort((p, q) => p - q);
  const lo = slopes[Math.floor(0.025 * B)];
  const hi = slopes[Math.floor(0.975 * B)];
  return [lo, hi];
}

// Pettitt change-point test (non-parametric, detects a single shift in level).
export function pettitt(y: number[], yearsArr: number[]): { year: number | null; p: number } {
  const n = y.length;
  if (n < 6) return { year: null, p: 1 };
  let bestK = 0, bestU = 0;
  for (let k = 1; k < n; k++) {
    let U = 0;
    for (let i = 0; i < k; i++) for (let j = k; j < n; j++) U += Math.sign(y[i] - y[j]);
    if (Math.abs(U) > Math.abs(bestU)) { bestU = U; bestK = k; }
  }
  const Kt = Math.abs(bestU);
  const p = 2 * Math.exp((-6 * Kt * Kt) / (n ** 3 + n ** 2));
  return { year: p < 0.1 ? yearsArr[bestK] : null, p: Math.min(1, p) };
}

export function trendStats(yearsArr: number[], y: number[]): TrendStats {
  const ols = olsSlope(yearsArr, y);
  const sen = theilSen(yearsArr, y);
  const mk = mannKendall(y);
  const ci = blockBootstrapCI(yearsArr, y);
  const pt = pettitt(y, yearsArr);
  return {
    n: y.length,
    olsSlope: ols.slope,
    senSlope: sen.slope,
    senIntercept: sen.intercept,
    tau: mk.tau,
    mkP: mk.p,
    ci,
    breakYear: pt.year,
    breakP: pt.p,
  };
}
