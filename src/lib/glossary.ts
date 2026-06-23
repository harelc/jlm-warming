// Plain-language definitions for the statistical / meteorological jargon,
// surfaced as hover/tap tooltips via <Term>.
export interface GlossEntry { title: string; body: string; }

export const GLOSSARY: Record<string, GlossEntry> = {
  "theil-sen": {
    title: "Theil–Sen slope",
    body: "A robust trend estimate: the median of the slopes between every pair of points. Unlike a least-squares line, a few freak years can't drag it around.",
  },
  "mann-kendall": {
    title: "Mann–Kendall test",
    body: "A non-parametric test for a monotonic trend. It only asks whether later values tend to be higher than earlier ones, so it assumes nothing about normality or linearity.",
  },
  tau: {
    title: "Kendall's τ (tau)",
    body: "The trend's effect size, from −1 (always falling) to +1 (always rising). 0 means no consistent up-or-down tendency.",
  },
  pvalue: {
    title: "p-value",
    body: "The chance of seeing a trend this strong if there were really none. Small = unlikely to be a fluke. Here it's optimistic, because nearby days are correlated (see autocorrelation).",
  },
  ci: {
    title: "95% confidence interval",
    body: "The plausible range for the Theil–Sen slope, from a moving-block bootstrap that resamples chunks of years (refitting Theil–Sen each time) so it respects that consecutive years aren't independent.",
  },
  bootstrap: {
    title: "Moving-block bootstrap",
    body: "Re-estimate the trend on hundreds of resampled versions of the data, drawing contiguous blocks of years to preserve correlation, then read off the spread of slopes.",
  },
  pettitt: {
    title: "Pettitt step-change test",
    body: "Flags a single abrupt shift in the level of a series and the year it most likely happened. It can spot a jump — but can't tell a real climate shift from an instrument change.",
  },
  harmonic: {
    title: "Harmonic (Fourier) model",
    body: "Represents the seasonal cycle as a sum of sine/cosine waves over the day-of-year. More harmonics = more wiggle room; 1 is a single smooth annual wave, 4 captures a sharper summer peak.",
  },
  anomaly: {
    title: "Anomaly",
    body: "A departure from the average. Here, each day minus the fitted seasonal cycle — so what's left is the part not explained by the time of year.",
  },
  deseasonalized: {
    title: "Deseasonalized",
    body: "The seasonal cycle has been subtracted, leaving only the trend and weather wiggles — so summer and winter days can be compared on the same footing.",
  },
  climatology: {
    title: "Climatology / baseline",
    body: "The long-term average seasonal pattern (or a reference period's mean) that anomalies are measured against.",
  },
  iqr: {
    title: "IQR — interquartile range",
    body: "The middle 50% of the values, from the 25th to the 75th percentile. The box of a boxplot spans it; the line inside is the median.",
  },
  dtr: {
    title: "Diurnal temperature range",
    body: "The day's maximum minus its minimum. A narrowing range — nights warming faster than days — is a recognized greenhouse-warming fingerprint.",
  },
  ols: {
    title: "OLS — ordinary least squares",
    body: "The familiar best-fit line (or curve), chosen to minimize the sum of squared vertical distances to the points.",
  },
  autocorrelation: {
    title: "Autocorrelation",
    body: "Consecutive days resemble each other, so they aren't independent observations. Treating them as independent makes p-values and intervals look more confident than they deserve.",
  },
};
