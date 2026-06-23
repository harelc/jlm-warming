// Ordinary-least-squares fitting utilities — all client-side so the UI can
// switch regression methods live. Small design matrices, solved by Gaussian
// elimination on the normal equations (XᵀX)β = Xᵀy.

export interface Fit {
  beta: number[]; // coefficients
  predict: (x: number) => number; // evaluate fitted model at predictor x
  r2: number;
  rmse: number;
  n: number;
  // slope of the linear time term in user units per year (when applicable)
  slopePerYear?: number;
  slopeSE?: number;
  pValue?: number;
}

// Solve A·x = b for symmetric positive-definite-ish A via Gaussian elimination
// with partial pivoting.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1e-12));
}

// Generic OLS given a basis (maps predictor x -> feature row).
export function olsBasis(xs: number[], ys: number[], basis: (x: number) => number[]): Fit {
  const X = xs.map(basis);
  const p = X[0].length;
  const n = xs.length;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * ys[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solve(XtX, Xty);
  const predict = (x: number) => basis(x).reduce((s, f, k) => s + f * beta[k], 0);

  const ybar = ys.reduce((s, v) => s + v, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const e = ys[i] - predict(xs[i]);
    ssRes += e * e;
    ssTot += (ys[i] - ybar) ** 2;
  }
  return {
    beta,
    predict,
    r2: ssTot ? 1 - ssRes / ssTot : 0,
    rmse: Math.sqrt(ssRes / n),
    n,
  };
}

// --- Polynomial / linear trend in a single predictor (e.g. year) -----------
// Returns coefficients plus inferential stats for the *linear* term, computed
// on a centered predictor for numerical stability.
export function polyFit(xs: number[], ys: number[], degree: number): Fit {
  const xbar = xs.reduce((s, v) => s + v, 0) / xs.length;
  const xc = xs.map((x) => x - xbar);
  const basis = (x: number) => {
    const row = [];
    for (let d = 0; d <= degree; d++) row.push((x - xbar) ** d);
    return row;
  };
  const fit = olsBasis(xs, ys, basis);
  fit.predict = (x: number) => basis(x).reduce((s, f, k) => s + f * fit.beta[k], 0);

  // inference on the linear coefficient beta[1]
  const n = xs.length;
  const p = degree + 1;
  if (n > p) {
    // recompute (XtX)^-1 diagonal for SE
    const X = xc.map((x) => Array.from({ length: p }, (_, d) => x ** d));
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < n; i++)
      for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    const inv = invert(XtX);
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const e = ys[i] - fit.predict(xs[i]);
      ssRes += e * e;
    }
    const sigma2 = ssRes / (n - p);
    const se1 = Math.sqrt(sigma2 * inv[1][1]);
    fit.slopePerYear = fit.beta[1];
    fit.slopeSE = se1;
    fit.pValue = 2 * (1 - studentTCdf(Math.abs(fit.beta[1] / se1), n - p));
  }
  return fit;
}

// --- Harmonic seasonal model on day-of-year, with optional linear trend ----
const OMEGA = (2 * Math.PI) / 365.25;
export function harmonicBasis(K: number, withTrend: boolean, xbarYear = 0) {
  // predictor x is decimal year; we recover doy from the fractional part.
  return (x: number) => {
    const doy = ((x % 1) * 365.25) + 0.5;
    const row = [1];
    if (withTrend) row.push(x - xbarYear);
    for (let k = 1; k <= K; k++) {
      row.push(Math.sin(k * OMEGA * doy));
      row.push(Math.cos(k * OMEGA * doy));
    }
    return row;
  };
}

// Fit harmonic-by-doy directly given parallel doy & value arrays (per-year use).
export function harmonicFitByDoy(doys: number[], ys: number[], K: number) {
  const basis = (doy: number) => {
    const row = [1];
    for (let k = 1; k <= K; k++) {
      row.push(Math.sin(k * OMEGA * doy));
      row.push(Math.cos(k * OMEGA * doy));
    }
    return row;
  };
  return olsBasis(doys, ys, basis);
}

// matrix inverse via Gauss-Jordan (small matrices)
function invert(A: number[][]): number[][] {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let c = 0; c < 2 * n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = 0; c < 2 * n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row.slice(n));
}

// Student-t CDF via regularized incomplete beta (good enough for p-values).
function studentTCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const ib = incBeta(df / 2, 0.5, x);
  return 1 - 0.5 * ib;
}
function incBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 200; i++) {
    const m = Math.floor(i / 2);
    let num;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;
    if (Math.abs(1 - d * c) < 1e-10) break;
  }
  return front * (f - 1);
}
function lgamma(z: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function formatP(p?: number): string {
  if (p === undefined) return "—";
  if (p < 1e-4) return p.toExponential(1);
  return p.toFixed(p < 0.01 ? 4 : 3);
}
