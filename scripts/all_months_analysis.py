#!/usr/bin/env python3
"""Jerusalem (02ws.co.il / ירושמיים) monthly temperatures, all 12 months x all years.

Sources (matching the site's ChooseMonthYear combo box):
  - 2002-2024: classic NOAA monthly text reports  reports/MMYY.txt
  - 2025-2026: JSON service NOAAReport_service.php

Produces:
  all_months_lines.png    - 12 subplots, 5 summary stats per month vs year
  all_months_boxplots.png - 12 subplots, per-year boxplot of daily mean temps
"""
import json, glob, os, re
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from bidi.algorithm import get_display

# matplotlib has no bidi engine, so reverse ONLY the Hebrew word and drop it into
# otherwise-LTR text — keeps numbers/parens/domain in their normal positions.
HEB = get_display("ירושמיים")

DAILY = re.compile(r"^\s*(\d{1,2})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+\d{1,2}:\d{2}\s+(-?\d+\.\d+)\s+\d{1,2}:\d{2}")
SUMMARY = re.compile(r"^\s*(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+\d+\s+(-?\d+\.\d+)\s+\d+\s")
MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"]


def parse_text(path):
    days, highs, lows, means, summ = [], [], [], [], None
    for line in open(path, encoding="utf-8", errors="replace"):
        m = DAILY.match(line)
        if m:
            day, mean, high, low = m.groups()
            days.append(int(day))
            means.append(float(mean)); highs.append(float(high)); lows.append(float(low))
            continue
        if highs and summ is None:
            s = SUMMARY.match(line)
            if s:
                summ = tuple(float(x) for x in s.groups())
    if not highs:
        return None
    return _pack(days, means, highs, lows, summ)


def parse_json(path):
    d = json.load(open(path))
    daily = d.get("dailySummary", [])
    if not daily:
        return None
    ms = d["monthSummary"][0]
    days = [int(x["day"].split("-")[2]) for x in daily]
    means = [x["MeanTemp"] for x in daily]
    highs = [x["highTemp"] for x in daily]
    lows = [x["MinTemp"] for x in daily]
    summ = (ms.get("MeanTemp"), ms.get("highTemp"), ms.get("MinTemp"))
    if summ[0] is None:
        summ = None
    return _pack(days, means, highs, lows, summ)


def _pack(days, means, highs, lows, summ):
    return {
        "days": len(means),
        "daily_day": days,
        "daily_mean": means, "daily_high": highs, "daily_low": lows,
        "mean_temp": summ[0] if summ else sum(means) / len(means),
        "mean_high": sum(highs) / len(highs),
        "mean_low": sum(lows) / len(lows),
        "max": summ[1] if summ else max(highs),
        "min": summ[2] if summ else min(lows),
    }


# data[month] = list of records sorted by year
data = {m: [] for m in range(1, 13)}
for path in sorted(glob.glob("all_txt/*.txt")):
    if os.path.getsize(path) < 500:
        continue
    name = os.path.basename(path)
    mm, yy = int(name[:2]), int(name[2:4])
    r = parse_text(path)
    if r:
        r["year"] = 2000 + yy; data[mm].append(r)
for path in sorted(glob.glob("all_json/*.json")):
    base = os.path.basename(path)[:-5]
    year, mm = (int(x) for x in base.split("_"))
    r = parse_json(path)
    if r:
        r["year"] = year; data[mm].append(r)
for m in data:
    data[m].sort(key=lambda r: r["year"])

# =========================  FIGURE 1: line grid  =========================
series = [
    ("max",       "Monthly Max",     "#b22222", "^", "--"),
    ("mean_high", "Mean Daily High",  "#e8860c", "o", "-"),
    ("mean_temp", "Monthly Mean",    "#2e7d32", "s", "-"),
    ("mean_low",  "Mean Daily Low",   "#1565c0", "o", "-"),
    ("min",       "Monthly Min",     "#4527a0", "v", "--"),
]
fig, axes = plt.subplots(4, 3, figsize=(22, 18), sharex=True)
for m in range(1, 13):
    ax = axes[(m - 1) // 3][(m - 1) % 3]
    recs = data[m]
    yrs = [r["year"] for r in recs]
    for key, label, color, marker, ls in series:
        ax.plot(yrs, [r[key] for r in recs], marker=marker, ls=ls, color=color,
                label=label, lw=1.5, ms=4)
    ax.set_title(MONTH_NAMES[m], fontsize=13, fontweight="bold")
    ax.grid(True, alpha=0.3)
    ax.yaxis.set_major_locator(mticker.MultipleLocator(5))
    ax.set_xticks(yrs)
    ax.set_xticklabels(yrs, rotation=90, fontsize=7)
axes[0][0].legend(loc="upper left", fontsize=8, framealpha=0.9)
fig.supxlabel("Year", fontsize=13)
fig.supylabel("Temperature (°C)", fontsize=13)
fig.suptitle(f"Monthly Temperatures in Jerusalem (02ws.co.il / {HEB}), 2002–2026",
             fontsize=18, fontweight="bold")
fig.tight_layout(rect=[0, 0, 1, 0.98])
fig.savefig("all_months_lines.png", dpi=130)
print("Saved all_months_lines.png")

# =====================  FIGURE 2: boxplot grid  =====================
# Each year = one box of that month's daily MEAN temperatures.
# Box = median + IQR; whiskers/fliers show day-to-day spread within the month.
fig, axes = plt.subplots(4, 3, figsize=(22, 18), sharex=True)
trends = {}
for m in range(1, 13):
    ax = axes[(m - 1) // 3][(m - 1) % 3]
    recs = data[m]
    yrs = [r["year"] for r in recs]
    box_data = [r["daily_mean"] for r in recs]
    bp = ax.boxplot(box_data, positions=yrs, widths=0.6, patch_artist=True,
                    showfliers=True,
                    flierprops=dict(marker="d", ms=5, mfc="#d62728", mec="#7a0000",
                                    mew=0.6, alpha=0.9),
                    medianprops=dict(color="#b22222", lw=1.5),
                    whiskerprops=dict(color="#2171b5", lw=1),
                    capprops=dict(color="#2171b5", lw=1))
    for patch in bp["boxes"]:
        patch.set(facecolor="#9ecae1", edgecolor="#2171b5", alpha=0.85)
    # overlay monthly mean line for trend context
    ax.plot(yrs, [r["mean_temp"] for r in recs], color="#2e7d32", lw=1.2,
            marker="", alpha=0.7)
    # --- OLS on every daily-mean reading ---
    yr = np.array([r["year"] for r in recs for _ in r["daily_mean"]], dtype=float)
    dy = np.array([d for r in recs for d in r["daily_day"]], dtype=float)
    ys = np.array([v for r in recs for v in r["daily_mean"]], dtype=float)
    yr_c, dy_c = yr - yr.mean(), dy - dy.mean()

    def ols(X):
        beta, *_ = np.linalg.lstsq(X, ys, rcond=None)
        resid = ys - X @ beta
        dof = len(ys) - X.shape[1]
        s2 = resid @ resid / dof
        cov = s2 * np.linalg.inv(X.T @ X)
        rmse = np.sqrt(resid @ resid / len(ys))
        return beta, np.sqrt(np.diag(cov)), dof, rmse

    # baseline: year only
    Xa = np.column_stack([np.ones_like(yr_c), yr_c])
    ba, sea, da, rmse_a = ols(Xa)
    p_a = 2 * stats.t.sf(abs(ba[1] / sea[1]), da)
    # improved: control for within-month seasonal ramp (day + day^2)
    Xb = np.column_stack([np.ones_like(yr_c), yr_c, dy_c, dy_c ** 2])
    bb, seb, db, rmse_b = ols(Xb)
    p_b = 2 * stats.t.sf(abs(bb[1] / seb[1]), db)
    trends[m] = {"slope_a": ba[1], "p_a": p_a, "rmse_a": rmse_a,
                 "slope_b": bb[1], "p_b": p_b, "rmse_b": rmse_b}

    xg = np.linspace(min(yrs), max(yrs), 200)
    # day terms vanish at mean day, so the displayed trend is intercept + slope*year
    ax.plot(xg, ba[0] + ba[1] * (xg - yr.mean()), color="black", lw=1.8, ls="--",
            zorder=10, label="year only")
    ax.plot(xg, bb[0] + bb[1] * (xg - yr.mean()), color="#6a3d9a", lw=2.4,
            zorder=11, label="year + day-in-month")

    sa = "*" if p_a < 0.05 else ""
    sb = "*" if p_b < 0.05 else ""
    ax.text(0.03, 0.96,
            f"year only:   {ba[1]*10:+.2f} °C/dec{sa}  (RMSE {rmse_a:.2f})\n"
            f"+day/day²: {bb[1]*10:+.2f} °C/dec{sb}  (RMSE {rmse_b:.2f})",
            transform=ax.transAxes, va="top", ha="left", fontsize=8,
            bbox=dict(boxstyle="round", fc="white", ec="black", alpha=0.8))
    ax.set_title(MONTH_NAMES[m], fontsize=13, fontweight="bold")
    ax.grid(True, axis="y", alpha=0.3)
    ax.yaxis.set_major_locator(mticker.MultipleLocator(5))
    ax.set_xticks(yrs)
    ax.set_xticklabels(yrs, rotation=90, fontsize=7)

# explanatory legend (one box explains every element of the boxplots)
from matplotlib.patches import Patch
from matplotlib.lines import Line2D
legend_handles = [
    Patch(facecolor="#9ecae1", edgecolor="#2171b5", alpha=0.85,
          label="IQR (25th–75th pct of daily means)"),
    Line2D([0], [0], color="#b22222", lw=1.5, label="median daily-mean temp"),
    Line2D([0], [0], color="#2171b5", lw=1, label="whiskers (1.5×IQR) & caps"),
    Line2D([0], [0], marker="d", color="none", mfc="#d62728", mec="#7a0000",
           ms=8, label="outlier day (beyond whiskers)"),
    Line2D([0], [0], color="#2e7d32", lw=1.2, alpha=0.7, label="monthly mean"),
    Line2D([0], [0], color="black", lw=1.8, ls="--", label="OLS trend: year only"),
    Line2D([0], [0], color="#6a3d9a", lw=2.4, label="OLS trend: year + day-in-month"),
]
fig.legend(handles=legend_handles, loc="lower center", ncol=7, fontsize=10,
           frameon=True, framealpha=0.95, bbox_to_anchor=(0.5, 0.005))
fig.supxlabel("Year", fontsize=13)
fig.supylabel("Daily mean temperature (°C)", fontsize=13)
fig.suptitle(f"Distribution of Daily Mean Temperatures by Month — Jerusalem "
             f"(02ws.co.il / {HEB}), 2002–2026",
             fontsize=18, fontweight="bold")
fig.tight_layout(rect=[0, 0.035, 1, 0.98])
fig.savefig("all_months_boxplots.png", dpi=130)
print("Saved all_months_boxplots.png")

# coverage + trend summary
print("\nYears available per month:")
for m in range(1, 13):
    yrs = [r["year"] for r in data[m]]
    print(f"  {MONTH_NAMES[m]:<10} {len(yrs):2d} years ({min(yrs)}–{max(yrs)})")

print("\nWarming trend (°C/decade) — year-only vs. controlling for day-in-month:")
print(f"  {'Month':<11}{'year only':>11}{'yr p':>9}{'RMSE':>7}   "
      f"{'+day/day²':>11}{'yr p':>9}{'RMSE':>7}")
for m in range(1, 13):
    t = trends[m]
    sa = "*" if t["p_a"] < 0.05 else " "
    sb = "*" if t["p_b"] < 0.05 else " "
    print(f"  {MONTH_NAMES[m]:<11}{t['slope_a']*10:>+10.2f}{sa}{t['p_a']:>8.1e}{t['rmse_a']:>7.2f}   "
          f"{t['slope_b']*10:>+10.2f}{sb}{t['p_b']:>8.1e}{t['rmse_b']:>7.2f}")
print("  (* = year trend significant at p < 0.05; lower RMSE = less residual noise)")
