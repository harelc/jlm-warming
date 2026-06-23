#!/usr/bin/env python3
"""Build the compact daily JSON the React app consumes.

Reads the raw NOAA text reports + JSON archive in ../data_raw and emits
../public/data/daily.json as columnar arrays (small, fast to parse in JS).
All regression/aggregation is done client-side so the UI can switch methods live.
"""
import json, os
from weather_data import load_all

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "data_raw")
OUT = os.path.join(HERE, "..", "public", "data", "daily.json")

rows = load_all(ROOT)
rows.sort(key=lambda r: (r["year"], r["month"], r["day"]))

cols = {k: [] for k in ("year", "month", "day", "doy", "decyear", "mean", "high", "low")}
for r in rows:
    cols["year"].append(r["year"])
    cols["month"].append(r["month"])
    cols["day"].append(r["day"])
    cols["doy"].append(r["doy"])
    cols["decyear"].append(round(r["decyear"], 5))
    cols["mean"].append(round(r["mean"], 1))
    cols["high"].append(round(r["high"], 1))
    cols["low"].append(round(r["low"], 1))

years = sorted({r["year"] for r in rows})
payload = {
    "meta": {
        "station": "02ws.co.il — ירושמיים (Jerusalem)",
        "source_url": "https://www.02ws.co.il/ChooseMonthYear",
        "credit": "Daily observations collected and published by the ירושמיים (02ws.co.il) "
                  "private weather station, Jerusalem. Boaz Nechemia's Vantage Pro, elev. 745 m.",
        "n_obs": len(rows),
        "year_min": min(years),
        "year_max": max(years),
        "note": "2002–2024 from monthly NOAA text reports; 2025–2026 from the JSON archive. "
                "2026 is partial (year in progress).",
    },
    "daily": cols,
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
print(f"Wrote {OUT}: {len(rows)} obs, years {min(years)}–{max(years)}, "
      f"{os.path.getsize(OUT)/1024:.0f} KB")
