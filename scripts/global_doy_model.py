#!/usr/bin/env python3
"""Global day-of-year model for Jerusalem daily mean temperature (02ws.co.il).

One OLS fit over EVERY daily observation (all months, all years):

    mean_temp ~ b0 + b_trend*(decimal_year - ȳ)
                   + Σ_{k=1..K} [ a_k·sin(2πk·doy/yr) + c_k·cos(2πk·doy/yr) ]

The harmonic terms model the full seasonal cycle from day-of-year, so the
single b_trend coefficient is the underlying warming rate with seasonality
properly removed — instead of 12 separate per-month slopes.
"""
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
from matplotlib.ticker import FixedLocator
from bidi.algorithm import get_display
from weather_data import load_all

HEB = get_display("ירושמיים")
K = 4                      # number of seasonal harmonics
YEAR_LEN = 365.25

rows = load_all()
doy = np.array([r["doy"] for r in rows], dtype=float)
decy = np.array([r["decyear"] for r in rows], dtype=float)
y = np.array([r["mean"] for r in rows], dtype=float)
ybar = decy.mean()

# design matrix
cols = [np.ones_like(doy), decy - ybar]
omega = 2 * np.pi / YEAR_LEN
for k in range(1, K + 1):
    cols.append(np.sin(k * omega * doy))
    cols.append(np.cos(k * omega * doy))
X = np.column_stack(cols)

beta, *_ = np.linalg.lstsq(X, y, rcond=None)
resid = y - X @ beta
n, p = X.shape
dof = n - p
sigma2 = resid @ resid / dof
cov = sigma2 * np.linalg.inv(X.T @ X)
se = np.sqrt(np.diag(cov))
trend_per_decade = beta[1] * 10
t_trend = beta[1] / se[1]
p_trend = 2 * stats.t.sf(abs(t_trend), dof)
r2 = 1 - resid.var() / y.var()
ci = 1.96 * se[1] * 10     # ~95% CI half-width, per decade

print(f"Observations: {n}   harmonics: {K}   model R² = {r2:.3f}")
print(f"Warming trend: {trend_per_decade:+.3f} °C/decade  "
      f"(95% CI ±{ci:.3f}, p = {p_trend:.2e})")
print("  NOTE: CI/p assume independent days; daily autocorrelation makes them")
print("  optimistic — treat the point estimate as solid, the interval as a floor.")


def seasonal(doy_grid, year):
    """Fitted mean temperature for a given day-of-year at a given calendar year."""
    out = beta[0] + beta[1] * ((year + 0.5) - ybar)
    for i, k in enumerate(range(1, K + 1)):
        out = out + beta[2 + 2 * i] * np.sin(k * omega * doy_grid) \
                  + beta[3 + 2 * i] * np.cos(k * omega * doy_grid)
    return out


# ----------------------------- plot -----------------------------
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 12))

# Panel 1: seasonal cycle — one fitted curve per year, colored by year
import matplotlib as mpl
ax1.scatter(doy, y, s=3, c="#cccccc", alpha=0.30, linewidths=0, zorder=1)
g = np.linspace(1, 366, 400)
yrs_all = sorted({r["year"] for r in rows})
norm = mpl.colors.Normalize(vmin=min(yrs_all), vmax=max(yrs_all))
cmap = mpl.cm.viridis
for yy in yrs_all:
    ax1.plot(g, seasonal(g, yy), color=cmap(norm(yy)), lw=1.6, alpha=0.9, zorder=2)
y0, y1 = min(yrs_all), max(yrs_all)
ax1.set_title(f"Fitted seasonal cycle by year, Jerusalem (02ws.co.il / {HEB})\n"
              f"{K}-harmonic fit; curves shift up {trend_per_decade:+.2f} °C/decade "
              f"({y1}−{y0} ≈ {beta[1]*(y1-y0):+.2f} °C)",
              fontsize=14, fontweight="bold")
ax1.set_xlabel("Day of year"); ax1.set_ylabel("Daily mean temp (°C)")
month_starts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
ax1.xaxis.set_major_locator(FixedLocator(month_starts))
ax1.set_xticklabels(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])
ax1.set_xlim(1, 366); ax1.grid(True, alpha=0.3)
cb = fig.colorbar(mpl.cm.ScalarMappable(norm=norm, cmap=cmap), ax=ax1, pad=0.01)
cb.set_label("year of fitted curve")

# Panel 2: deseasonalized anomaly vs time + trend
clim = seasonal(doy, ybar - 0.5)   # climatology at the mean year (trend term ~0)
anom = y - clim
ax2.scatter(decy, anom, s=4, c="#888", alpha=0.3, linewidths=0)
# annual mean anomaly for readability
yrs_u = np.array(sorted({r["year"] for r in rows}))
ann = np.array([anom[(decy >= yy) & (decy < yy + 1)].mean() for yy in yrs_u])
ax2.plot(yrs_u + 0.5, ann, "o-", color="#2e7d32", lw=1.5, ms=5, label="annual mean anomaly")
xr = np.array([decy.min(), decy.max()])
ax2.plot(xr, beta[1] * (xr - ybar), color="#b22222", lw=2.8,
         label=f"trend {trend_per_decade:+.2f} °C/decade")
ax2.axhline(0, color="k", lw=0.6)
ax2.set_title("Deseasonalized temperature anomaly (observed − fitted seasonal cycle)",
              fontsize=14, fontweight="bold")
ax2.set_xlabel("Year"); ax2.set_ylabel("Anomaly (°C)")
ax2.grid(True, alpha=0.3); ax2.legend(loc="upper left")

fig.tight_layout()
fig.savefig("global_doy_model.png", dpi=140)
print("Saved global_doy_model.png")


# ============ SECOND FIGURE: independent harmonic fit per year ============
KY = 2   # fewer harmonics per year: smoother, less overfit than the pooled K


def design(doy_arr, nharm=KY):
    cols = [np.ones_like(doy_arr)]
    for k in range(1, nharm + 1):
        cols.append(np.sin(k * omega * doy_arr))
        cols.append(np.cos(k * omega * doy_arr))
    return np.column_stack(cols)

from collections import defaultdict
import matplotlib as mpl
by_year = defaultdict(lambda: ([], []))
for r in rows:
    by_year[r["year"]][0].append(r["doy"])
    by_year[r["year"]][1].append(r["mean"])

fig2, ax = plt.subplots(figsize=(15, 8))
norm = mpl.colors.Normalize(vmin=min(yrs_u), vmax=max(yrs_u))
cmap = mpl.cm.turbo
pt_year = np.array([r["year"] for r in rows], dtype=float)
ax.scatter(doy, y, s=5, c=pt_year, cmap=cmap, norm=norm, alpha=0.45,
           linewidths=0, zorder=1)
year_peaks = {}
for yy in sorted(by_year):
    dq = np.array(by_year[yy][0], dtype=float)
    tq = np.array(by_year[yy][1], dtype=float)
    if len(dq) < 2 * KY + 1:
        continue
    by, *_ = np.linalg.lstsq(design(dq), tq, rcond=None)
    # only draw across the days actually observed that year (e.g. 2026 = Jan–Jun)
    gg = np.linspace(dq.min(), dq.max(), 400)
    curve = design(gg) @ by
    ax.plot(gg, curve, color=cmap(norm(yy)), lw=1.6, alpha=0.9, zorder=2)
    year_peaks[yy] = curve.max()

ax.set_title(f"Independent {KY}-harmonic seasonal fit per year — Jerusalem "
             f"(02ws.co.il / {HEB})\n"
             f"each curve fitted on that year's days only; shape & level free to vary",
             fontsize=14, fontweight="bold")
ax.set_xlabel("Day of year"); ax.set_ylabel("Daily mean temp (°C)")
ax.xaxis.set_major_locator(FixedLocator(month_starts))
ax.set_xticklabels(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])
ax.set_xlim(1, 366); ax.grid(True, alpha=0.3)
cb2 = fig2.colorbar(mpl.cm.ScalarMappable(norm=norm, cmap=cmap), ax=ax, pad=0.01)
cb2.set_label("year")
fig2.tight_layout()
fig2.savefig("per_year_harmonics.png", dpi=140)
print("Saved per_year_harmonics.png")
