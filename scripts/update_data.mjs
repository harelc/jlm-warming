#!/usr/bin/env node
// Local/CLI updater: refresh public/data/daily.json from the ירושמיים
// (02ws.co.il) archive. Run with `npm run update`. Resilient — if the source
// is unreachable the committed file is left untouched.
import fs from "node:fs";
import { mergeRecent } from "./merge-core.mjs";

const OUT = new URL("../public/data/daily.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(OUT, "utf8"));
const { fetched, added, updated } = await mergeRecent(data);

if (fetched === 0) {
  console.log("update_data: no months fetched (source unreachable?) — leaving daily.json unchanged.");
} else {
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(
    `update_data: fetched ${fetched} month(s), +${added} new / ${updated} refreshed; ` +
    `now ${data.meta.n_obs} obs, ${data.meta.year_min}–${data.meta.year_max}.`
  );
}
