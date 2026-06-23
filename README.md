# Is Jerusalem Getting Hotter? 🌡️

An interactive look at **25 years of daily temperatures in Jerusalem** (2002–2026) —
switch the metric, month, year range, and regression method, and judge the warming
trend for yourself.

> **Live demo:** _add your Netlify URL here_

## Data & Credit

**All temperature measurements were collected and published by the
[ירושמיים — 02ws.co.il](https://www.02ws.co.il) weather station**, a private
station on a Jerusalem rooftop (Boaz Nechemia's Davis Vantage Pro, elevation 745 m),
recording daily since 2002. **This project only visualizes their data — every
measurement is theirs.** Please visit and support the source.

The archive was read from the station's public monthly NOAA-style reports
(`02ws.co.il/ChooseMonthYear`): text reports for 2002–2024 and the JSON service for
2025–2026. 2026 is a partial year.

## Features

- **Eight views** of the same archive:
  - **Warming stripes** — Ed-Hawkins-style annual anomaly bars vs a 2002–2011 baseline
  - **Full record** — all ~8,900 daily readings on one continuous time axis, no folding
  - **Yearly trend** — per-year mean / max / min for a chosen month, with a bootstrap CI band
  - **Distribution** — per-year boxplots of daily readings, with outliers
  - **Distribution shift** — early vs late period KDE, showing the whole distribution slide
  - **Seasonal cycle** — readings folded on day-of-year with harmonic models (pooled or per-year, adjustable harmonic count, arbitrary year multi-select)
  - **Anomaly** — deseasonalized residual vs. time
  - **Climate indices** — hot days, very hot days, tropical nights, cool nights, longest warm spell, mean diurnal range
- **Four metrics** — daily **mean**, **maximum**, **minimum**, and **diurnal range (max−min)** — each with its own models
- **Robust trend statistics** — Theil–Sen slope, Mann–Kendall test, and a moving-block-bootstrap 95% CI, plus a Pettitt step-change flag — alongside linear / quadratic OLS, all computed in-browser
- **Interactive** — month pills, year range, year multi-select, harmonic count, hover tooltips
- **Shareable URL state** and **PNG export** of any view
- An honest **"what this can and can't tell you"** panel (single station, UHI, inhomogeneities, autocorrelation)
- Year-colored points on a cold→hot palette

## Tech Stack

- **Vite** + **React** + **TypeScript**
- **D3** (scales / shapes / interpolate) with hand-rolled SVG charts
- **Tailwind CSS**; OLS, polynomial & harmonic regression implemented from scratch (`src/lib/regression.ts`)
- Data pipeline in **Python** (`scripts/`)

## Getting Started

```bash
npm install
npm run dev          # dev server
npm run build        # production build -> dist/
npm run data         # rebuild public/data/daily.json from data_raw/ (Python 3)
```

## How It Works

1. `scripts/build_data.py` parses the raw NOAA reports in `data_raw/` into a compact
   columnar `public/data/daily.json` (~340 KB, 8,926 daily observations).
2. The React app loads that once and does **all** aggregation and regression
   client-side, so switching metric / method / years is instant.
3. Regression: linear & quadratic via OLS on the normal equations; the seasonal models
   are harmonic regressions on day-of-year (Σ sin/cos), fit either pooled across all
   years or independently per year.

**Caveat shown in-app:** p-values treat daily readings as independent. Daily
autocorrelation makes them optimistic — trust the slope, treat the interval as a floor.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — Harel Cain
(applies to this site and code only; the **data** belongs to
[ירושמיים / 02ws.co.il](https://www.02ws.co.il)).
