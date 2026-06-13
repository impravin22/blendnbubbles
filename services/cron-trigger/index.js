/**
 * blendnbubbles-cron — Cloudflare Worker
 *
 * Two responsibilities:
 *
 * 1. Cron scheduler: fires GitHub Actions workflow_dispatch on the
 *    blendnbubbles/daily-digest workflow at 01:00 UTC (09:00 Asia/Taipei)
 *    and 13:00 UTC (21:00 Asia/Taipei) every day. Cloudflare cron is
 *    second-accurate; GitHub's cron is routinely delayed 1-2h on free tier.
 *
 * 2. Seen-review store: lightweight KV-backed API the digest runtime uses
 *    to avoid re-notifying about reviews already surfaced in a past digest.
 *    30-day TTL per entry. Endpoints:
 *
 *       POST /seen/check   body: { ids: string[] }
 *                          → { seen: string[] }
 *       POST /seen/mark    body: { ids: string[] }
 *                          → { marked: number }
 *
 * Both /seen endpoints require Bearer auth against env.DIGEST_STATE_TOKEN.
 *
 * Required secrets (via `wrangler secret put`):
 *   DISPATCH_PAT         — fine-grained PAT with Actions:R/W on this repo.
 *   DIGEST_STATE_TOKEN   — shared bearer protecting /seen endpoints.
 *
 * Required KV binding (in wrangler.toml):
 *   DIGEST_STATE         — KV namespace storing seen review message IDs.
 */

const WORKFLOW_DISPATCH_URL =
  "https://api.github.com/repos/impravin22/blendnbubbles/actions/workflows/daily-digest.yml/dispatches";

const SEEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const MAX_IDS_PER_REQUEST = 200;

export default {
  async scheduled(event, env, ctx) {
    const firedAt = new Date(event.scheduledTime);
    const hour = firedAt.getUTCHours();
    const label = hour < 6 ? "morning" : "evening";

    const resp = await fetch(WORKFLOW_DISPATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DISPATCH_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "blendnbubbles-cron/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(
        `[cron] ${label} dispatch failed: HTTP ${resp.status} — ${body}`
      );
      throw new Error(`GitHub dispatch failed: ${resp.status}`);
    }

    console.info(
      `[cron] ${label} digest dispatched OK at ${firedAt.toISOString()}`
    );
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/seen/check" || url.pathname === "/seen/mark") {
      return handleSeen(request, env, url.pathname);
    }

    if (
      url.pathname === "/petpooja-stats/put" ||
      url.pathname === "/petpooja-stats/get"
    ) {
      return handlePetpoojaStats(request, env, url.pathname);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("blendnbubbles-cron worker OK", { status: 200 });
    }

    return new Response("not found", { status: 404 });
  },
};

async function handleSeen(request, env, pathname) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  if (!env.DIGEST_STATE_TOKEN) {
    return new Response("server misconfigured", { status: 500 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.DIGEST_STATE_TOKEN}`) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!env.DIGEST_STATE) {
    return new Response("KV namespace DIGEST_STATE not bound", { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const ids = sanitiseIds(body?.ids);
  if (ids === null) {
    return jsonResponse({ error: "ids must be a string array" }, 400);
  }
  if (ids.length > MAX_IDS_PER_REQUEST) {
    return jsonResponse(
      { error: `too many ids (max ${MAX_IDS_PER_REQUEST})` },
      400,
    );
  }

  if (pathname === "/seen/check") {
    const results = await Promise.all(
      ids.map(async (id) => ((await env.DIGEST_STATE.get(kvKey(id))) ? id : null)),
    );
    const seen = results.filter((x) => x !== null);
    return jsonResponse({ seen });
  }

  // /seen/mark
  await Promise.all(
    ids.map((id) =>
      env.DIGEST_STATE.put(kvKey(id), "1", { expirationTtl: SEEN_TTL_SECONDS }),
    ),
  );
  return jsonResponse({ marked: ids.length });
}

// PetPooja stats endpoints
//   POST /petpooja-stats/put — scraper uploads latest summary (auth:
//     SCRAPER_STATS_PUT_TOKEN). Body is JSON; stored in KV under
//     petpooja-stats:latest with a 7-day TTL so stale data eventually drops.
//   GET  /petpooja-stats/get — digest pulls latest summary (auth:
//     DIGEST_STATE_TOKEN, reusing the same token the dedupe endpoints use).
// Two separate tokens so a leaked digest token can't corrupt stats; a leaked
// scraper token can't replay seen-dedupe writes.
const PETPOOJA_STATS_KEY = "petpooja-stats:latest";
const PETPOOJA_STATS_TTL_SECONDS = 7 * 24 * 60 * 60;
const PETPOOJA_STATS_MAX_BYTES = 32 * 1024;

async function handlePetpoojaStats(request, env, pathname) {
  if (!env.DIGEST_STATE) {
    return new Response("KV namespace DIGEST_STATE not bound", { status: 500 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (pathname === "/petpooja-stats/put") {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    if (!env.SCRAPER_STATS_PUT_TOKEN) {
      return new Response("server misconfigured", { status: 500 });
    }
    if (auth !== `Bearer ${env.SCRAPER_STATS_PUT_TOKEN}`) {
      return new Response("unauthorized", { status: 401 });
    }
    const body = await request.text();
    if (body.length > PETPOOJA_STATS_MAX_BYTES) {
      return jsonResponse({ error: "payload too large" }, 400);
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return jsonResponse({ error: "invalid JSON body" }, 400);
    }
    if (!parsed || typeof parsed !== "object" || parsed.schemaVersion !== 1) {
      return jsonResponse({ error: "schemaVersion must be 1" }, 400);
    }
    await env.DIGEST_STATE.put(PETPOOJA_STATS_KEY, body, {
      expirationTtl: PETPOOJA_STATS_TTL_SECONDS,
    });
    return jsonResponse({ ok: true, bytes: body.length });
  }
  // GET /petpooja-stats/get
  if (request.method !== "GET") {
    return new Response("method not allowed", { status: 405 });
  }
  if (!env.DIGEST_STATE_TOKEN) {
    return new Response("server misconfigured", { status: 500 });
  }
  if (auth !== `Bearer ${env.DIGEST_STATE_TOKEN}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const stored = await env.DIGEST_STATE.get(PETPOOJA_STATS_KEY);
  if (!stored) {
    return jsonResponse({ ok: false, reason: "no-stats-yet" }, 404);
  }
  return new Response(stored, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sanitiseIds(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const v of raw) {
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    // Gmail message IDs are alphanumeric; reject anything with control chars.
    if (!trimmed || !/^[A-Za-z0-9_-]{1,128}$/.test(trimmed)) return null;
    out.push(trimmed);
  }
  return out;
}

function kvKey(id) {
  return `seen:${id}`;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
