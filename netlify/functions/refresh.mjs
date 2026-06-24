// Scheduled trigger: every Monday at 12:00 UTC, kick off a fresh Netlify build
// via a build hook. The build runs `scripts/update_data.mjs`, which pulls any
// newly-elapsed months/days from the ירושמיים (02ws.co.il) archive into
// public/data/daily.json before `vite build` — so the deployed site refreshes
// itself weekly with no manual step.
//
// Requires the env var BUILD_HOOK_URL (a Netlify build hook for branch `main`).
export const config = { schedule: "0 12 * * 1" };

export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    console.error("refresh: BUILD_HOOK_URL is not set");
    return new Response("BUILD_HOOK_URL not configured", { status: 500 });
  }
  const res = await fetch(hook, { method: "POST", body: "{}" });
  const msg = `refresh: build hook POST → ${res.status}`;
  console.log(msg);
  return new Response(msg, { status: res.ok ? 200 : 502 });
};
