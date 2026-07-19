// Discount voucher Worker.
//
//   POST /issue   { entryId }          -> { token, rupees, name, score, game, expiresAt }
//   POST /redeem  { token }            -> { valid, rupees, name, redeemedAt } | { valid: false, reason }
//   GET  /health                       -> ok
//
// WHY THIS EXISTS
//   The games score in the browser, so the reward card used to be rendered from
//   a local variable — a player could set their streak in dev tools and walk to
//   the counter with a card the server had never seen. The score cap in
//   firestore.rules guarded the leaderboard, not the money.
//
//   This Worker is the thing that decides the money. It never accepts a score
//   from the client: it takes a leaderboard document id, reads that document
//   back from Firestore, and reads the score AND the game from the stored copy.
//   Firestore rules cap the score per game and stamp `createdAt` with
//   `request.time`, so both the amount and its freshness are server facts.
//
//   Redemption is single-use, tracked in KV, so a screenshotted card is worth
//   one drink rather than unlimited drinks.
//
// WHAT THIS DOES NOT DEFEND
//   Anyone can create leaderboard documents anonymously — the rules allow it by
//   design, since the site is static and has no auth. So /issue can be driven in
//   volume by a script that fabricates entries and mints a voucher for each. The
//   score cap bounds each voucher's value; the daily redemption cap below and
//   the human at the counter bound the count. CORS is hygiene here, not a
//   control: /issue is unauthenticated and callable from curl.
//
// BINDINGS
//   VOUCHERS        KV namespace, redemption ledger
//   VOUCHER_SECRET  secret, HMAC key        (npx wrangler secret put VOUCHER_SECRET)
//   STAFF_TOKEN     secret, staff device auth (npx wrangler secret put STAFF_TOKEN)
//   FIREBASE_PROJECT_ID / FIREBASE_API_KEY  vars, both public by design
//   ALLOWED_ORIGIN  var, the site origin allowed to call /issue

import {
  signVoucher,
  verifyVoucher,
  isClaimable,
  discountFor,
  constantTimeEquals,
  VOUCHER_TTL_MS,
} from './voucher.js';

const JSON_HEADERS = { 'content-type': 'application/json' };

// Vouchers one device may redeem per day. A speed bump, not a control:
// playerId is minted client-side and a new one is one localStorage write away.
// It caps casual repeat abuse for one KV read.
const MAX_DAILY_REDEMPTIONS = 2;

function corsHeaders(env) {
  return {
    // Static origin, never '*'. This is hygiene rather than access control —
    // /issue takes no credentials, so CORS stops nothing that curl can do.
    'access-control-allow-origin': env.ALLOWED_ORIGIN ?? 'https://blendnbubbles.com',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-staff-token',
    'access-control-max-age': '86400',
  };
}

function json(body, env, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(env) },
  });
}

/** Unwrap Firestore's typed-value REST encoding into plain JS. */
function decodeFirestoreFields(fields = {}) {
  const out = {};
  for (const [key, wrapper] of Object.entries(fields)) {
    // A null or non-object wrapper would blow up the `in` checks below.
    if (!wrapper || typeof wrapper !== 'object') continue;
    if ('integerValue' in wrapper) out[key] = Number(wrapper.integerValue);
    else if ('stringValue' in wrapper) out[key] = wrapper.stringValue;
    else if ('timestampValue' in wrapper) out[key] = wrapper.timestampValue;
    else if ('booleanValue' in wrapper) out[key] = wrapper.booleanValue;
    else if ('doubleValue' in wrapper) out[key] = Number(wrapper.doubleValue);
  }
  return out;
}

/**
 * Read one leaderboard document, or null if it is missing or unreadable.
 *
 * The leaderboard is world-readable by design (every visitor renders it), so
 * this needs no service account — the public API key is enough. Contact details
 * live in a separate collection this Worker never touches.
 *
 * Note for whoever maintains the Firebase project: if HTTP-referrer restrictions
 * are ever added to that API key, this server-side fetch sends no Referer and
 * every /issue will begin failing.
 */
async function readLeaderboardEntry(entryId, env) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/leaderboard/${encodeURIComponent(entryId)}` +
    `?key=${env.FIREBASE_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const doc = await response.json();
    return decodeFirestoreFields(doc.fields);
  } catch {
    // Upstream down or body not JSON. Indistinguishable from "no such entry"
    // for our purposes, and the caller turns both into a 409.
    return null;
  }
}

/** Firestore auto-ids are exactly 20 alphanumeric characters. */
function isPlausibleEntryId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9]{20}$/.test(value);
}

function dayKey(now) {
  return new Date(now).toISOString().slice(0, 10);
}

async function handleIssue(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-request' }, env, 400);
  }
  if (!isPlausibleEntryId(body?.entryId)) {
    return json({ error: 'bad-request' }, env, 400);
  }

  const entry = await readLeaderboardEntry(body.entryId, env);
  const claimable = isClaimable(entry, Date.now());
  if (!claimable.ok) {
    // 'stale' and 'not-found' are ordinary outcomes (a slow walk to the
    // counter, a reload), not errors worth alarming the player about.
    return json({ error: claimable.reason }, env, 409);
  }

  // Game comes from the stored document, never the request. Reward rules are
  // per game and fail closed: a game with no entry in the table mints nothing.
  const rupees = discountFor(entry.score, entry.game);
  if (rupees <= 0) return json({ error: 'no-prize' }, env, 409);

  const issuedAt = Date.now();
  const token = await signVoucher(
    {
      entryId: body.entryId,
      name: entry.name ?? '',
      score: entry.score,
      game: entry.game,
      playerId: entry.playerId ?? null,
      rupees,
      issuedAt,
    },
    env.VOUCHER_SECRET,
  );
  return json(
    {
      token,
      rupees,
      name: entry.name ?? '',
      score: entry.score,
      game: entry.game,
      expiresAt: issuedAt + VOUCHER_TTL_MS,
    },
    env,
  );
}

async function handleRedeem(request, env) {
  // Staff-only. Without this a customer could call /redeem from their own phone
  // and wave the resulting "valid" screen at the counter without the voucher
  // ever being marked used.
  if (!constantTimeEquals(request.headers.get('x-staff-token'), env.STAFF_TOKEN)) {
    return json({ valid: false, reason: 'unauthorised' }, env, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ valid: false, reason: 'malformed' }, env, 400);
  }

  const verified = await verifyVoucher(body?.token, env.VOUCHER_SECRET, Date.now());
  if (!verified.ok) return json({ valid: false, reason: verified.reason }, env, 200);

  const { claim } = verified;
  const ledgerKey = `voucher:${claim.entryId}`;
  const existing = await env.VOUCHERS.get(ledgerKey, { type: 'json' });
  if (existing) {
    return json(
      { valid: false, reason: 'already-redeemed', redeemedAt: existing.redeemedAt, name: claim.name },
      env,
    );
  }

  const now = Date.now();
  // Per-device daily cap. Skipped when the entry carried no playerId, since
  // there is nothing to count against.
  const dailyKey = claim.playerId ? `daily:${claim.playerId}:${dayKey(now)}` : null;
  const usedToday = dailyKey ? ((await env.VOUCHERS.get(dailyKey, { type: 'json' }))?.count ?? 0) : 0;
  if (dailyKey && usedToday >= MAX_DAILY_REDEMPTIONS) {
    return json({ valid: false, reason: 'daily-limit', name: claim.name }, env);
  }

  const redeemedAt = new Date(now).toISOString();
  // Single-use, subject to KV's eventual consistency: two scans within the
  // propagation window can both read "unredeemed". Staff-gated and worth one
  // duplicate discount, so not defended further — see README.
  await env.VOUCHERS.put(
    ledgerKey,
    JSON.stringify({ redeemedAt, rupees: claim.rupees, name: claim.name, score: claim.score }),
    // Outlive the voucher so a replay after expiry still reads as redeemed
    // rather than falling back to "expired" and looking like a fresh failure.
    { expirationTtl: Math.ceil((VOUCHER_TTL_MS * 7) / 1000) },
  );
  if (dailyKey) {
    await env.VOUCHERS.put(dailyKey, JSON.stringify({ count: usedToday + 1 }), {
      expirationTtl: 48 * 60 * 60,
    });
  }

  return json({ valid: true, rupees: claim.rupees, name: claim.name, score: claim.score, redeemedAt }, env);
}

export default {
  async fetch(request, env) {
    // Every error this Worker returns deliberately carries CORS headers, but
    // the runtime's synthetic 500 for an uncaught throw does not — so a crash
    // reaches the browser as an opaque CORS failure rather than an HTTP error,
    // and the player's card simply never appears with nothing to diagnose. This
    // boundary keeps failures legible.
    try {
      const { pathname } = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(env) });
      }
      if (pathname === '/health' && request.method === 'GET') {
        return json({ ok: true }, env);
      }
      if (request.method !== 'POST') {
        return json({ error: 'method-not-allowed' }, env, 405);
      }
      // Fail closed on a bad deploy. An empty-string secret is the dangerous
      // case: `'' !== ''` is false, so a plain comparison against an empty
      // STAFF_TOKEN would authorise a request sending an empty header. An
      // unbound KV namespace matters just as much — wrangler.toml ships a
      // placeholder id, so that is the default state of a fresh deploy.
      if (!env.VOUCHER_SECRET || !env.STAFF_TOKEN || !env.VOUCHERS) {
        return json({ error: 'misconfigured' }, env, 503);
      }
      if (pathname === '/issue') return handleIssue(request, env);
      if (pathname === '/redeem') return handleRedeem(request, env);
      return json({ error: 'not-found' }, env, 404);
    } catch {
      return json({ error: 'internal' }, env, 500);
    }
  },
};
