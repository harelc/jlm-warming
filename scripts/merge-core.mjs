// Shared incremental-merge logic, used by both the local CLI updater
// (scripts/update_data.mjs) and the scheduled Netlify function.
// Pure of filesystem/Blobs IO: takes the dataset object, mutates it in place,
// returns {fetched, added, updated}. Uses global fetch (Node 18+ / Netlify).

const API = (m, y) => `https://v2013.02ws.co.il/NOAAReport_service.php?m=${m}&y=${y}`;
const r1 = (v) => (v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const doyOf = (y, m, day) => Math.round((Date.UTC(y, m - 1, day) - Date.UTC(y, 0, 0)) / 86400000);

export async function mergeRecent(data, now = new Date(), maxMonths = 48) {
  const d = data.daily;
  const byKey = new Map();
  for (let i = 0; i < d.year.length; i++) {
    byKey.set(`${d.year[i]}-${d.month[i]}-${d.day[i]}`, {
      year: d.year[i], month: d.month[i], day: d.day[i],
      mean: d.mean[i], high: d.high[i], low: d.low[i],
    });
  }

  // refresh from the latest month we have through the current calendar month
  const maxOrd = Math.max(...[...byKey.values()].map((r) => r.year * 12 + r.month - 1));
  const curOrd = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const months = [];
  for (let o = maxOrd; o <= curOrd && months.length < maxMonths; o++)
    months.push([Math.floor(o / 12), (o % 12) + 1]);

  let fetched = 0, added = 0, updated = 0;
  for (const [y, m] of months) {
    try {
      const res = await fetch(API(m, y), { headers: { "user-agent": "jlm-warming-updater" } });
      if (!res.ok) continue;
      const j = await res.json();
      const days = j?.dailySummary ?? [];
      if (!days.length) continue;
      fetched++;
      for (const x of days) {
        const day = Number(String(x.day).split("-")[2]);
        const mean = r1(x.MeanTemp), high = r1(x.highTemp), low = r1(x.MinTemp);
        if (!day || mean == null || high == null || low == null) continue;
        if (high === low && low === mean) continue; // known corrupt-day signature
        const key = `${y}-${m}-${day}`;
        byKey.has(key) ? updated++ : added++;
        byKey.set(key, { year: y, month: m, day, mean, high, low });
      }
    } catch { /* skip unreachable month */ }
  }

  if (fetched === 0) return { fetched: 0, added: 0, updated: 0 };

  const recs = [...byKey.values()].sort(
    (a, b) => a.year - b.year || a.month - b.month || a.day - b.day
  );
  const cols = { year: [], month: [], day: [], doy: [], decyear: [], mean: [], high: [], low: [] };
  for (const r of recs) {
    const doy = doyOf(r.year, r.month, r.day);
    cols.year.push(r.year); cols.month.push(r.month); cols.day.push(r.day); cols.doy.push(doy);
    cols.decyear.push(Math.round((r.year + (doy - 0.5) / (isLeap(r.year) ? 366 : 365)) * 1e5) / 1e5);
    cols.mean.push(r.mean); cols.high.push(r.high); cols.low.push(r.low);
  }
  const years = [...new Set(recs.map((r) => r.year))].sort((a, b) => a - b);
  data.daily = cols;
  data.meta = {
    ...data.meta,
    n_obs: recs.length,
    year_min: years[0],
    year_max: years[years.length - 1],
    last_updated: now.toISOString().slice(0, 10),
  };
  return { fetched, added, updated };
}
