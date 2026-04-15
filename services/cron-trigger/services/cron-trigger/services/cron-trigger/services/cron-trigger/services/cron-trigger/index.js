/**
 * blendnbubbles-cron — Cloudflare Worker
 *
 * Fires GitHub Actions workflow_dispatch on the blendnbubbles/daily-digest
 * workflow at exactly 01:00 UTC (09:00 Asia/Taipei) and 13:00 UTC (21:00
 * Asia/Taipei) every day.
 *
 * Why a Worker instead of GitHub Actions schedule?
 * GitHub cron is best-effort and routinely delayed 1-2 hours on the free
 * tier. Cloudflare Workers cron fires within seconds of the scheduled time.
 *
 * Required secret (set via deploy workflow or `wrangler secret put GITHUB_PAT`):
 *   GITHUB_PAT — fine-grained PAT with Actions: Read and Write on this repo.
 */

const WORKFLOW_DISPATCH_URL =
  "https://api.github.com/repos/impravin22/blendnbubbles/actions/workflows/daily-digest.yml/dispatches";

export default {
  async scheduled(event, env, ctx) {
    const firedAt = new Date(event.scheduledTime);
    const hour = firedAt.getUTCHours();
    const label = hour < 6 ? "morning" : "evening";

    const resp = await fetch(WORKFLOW_DISPATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "blendnbubbles-cron/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[cron] ${label} dispatch failed: HTTP ${resp.status} — ${body}`);
      throw new Error(`GitHub dispatch failed: ${resp.status}`);
    }

    console.info(`[cron] ${label} digest dispatched OK at ${firedAt.toISOString()}`);
  },

  async fetch(request, env, ctx) {
    return new Response("blendnbubbles-cron worker OK", { status: 200 });
  },
};
