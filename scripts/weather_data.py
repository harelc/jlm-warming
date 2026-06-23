"""Shared loader for the 02ws.co.il Jerusalem daily archive.

load_all() returns a flat list of daily observations across all months/years:
    {year, month, day, doy, decyear, mean, high, low}
Sources: text reports all_txt/MMYY.txt (2002-2024) + JSON all_json/YYYY_M.json (2025-2026).
"""
import json, glob, os, re, datetime

DAILY = re.compile(r"^\s*(\d{1,2})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+\d{1,2}:\d{2}\s+(-?\d+\.\d+)\s+\d{1,2}:\d{2}")


def _text_days(path):
    out = []
    for line in open(path, encoding="utf-8", errors="replace"):
        m = DAILY.match(line)
        if m:
            day, mean, high, low = m.groups()
            out.append((int(day), float(mean), float(high), float(low)))
    return out


def _json_days(path):
    d = json.load(open(path))
    out = []
    for x in d.get("dailySummary", []):
        out.append((int(x["day"].split("-")[2]), x["MeanTemp"], x["highTemp"], x["MinTemp"]))
    return out


def _add(rows, year, month, days):
    for day, mean, high, low in days:
        try:
            doy = datetime.date(year, month, day).timetuple().tm_yday
        except ValueError:
            continue  # guard against bad day numbers
        ndays = 366 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 365
        rows.append({"year": year, "month": month, "day": day, "doy": doy,
                     "decyear": year + (doy - 0.5) / ndays,
                     "mean": mean, "high": high, "low": low})


def load_all(root="."):
    rows = []
    for path in sorted(glob.glob(os.path.join(root, "all_txt/*.txt"))):
        if os.path.getsize(path) < 500:
            continue
        name = os.path.basename(path)
        mm, yy = int(name[:2]), int(name[2:4])
        _add(rows, 2000 + yy, mm, _text_days(path))
    for path in sorted(glob.glob(os.path.join(root, "all_json/*.json"))):
        year, mm = (int(x) for x in os.path.basename(path)[:-5].split("_"))
        _add(rows, year, mm, _json_days(path))
    return rows
