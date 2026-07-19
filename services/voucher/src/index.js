// Discount voucher Worker.
//
//   POST /issue   { entryId }          -> { token, rupees, name, score, expiresAt }
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
//   back from Firestore, and reads the score from the stored copy. Firestore
//   rules cap that score at what honest play can reach and stamp `createdAt`
//   with `request.time`, so both the amount and its freshness are server facts.
//
//   Redemption is single-use, tracked in KV, so a screenshotted card is worth
//   exactly one drink.
//
// BINDINGS
//   VOUCHERS        KV namespace, redemption ledger
//   VOUCHER_SECRET  secret, HMAC key        (npx wrangler secret put VOUCHER_SECRET)
//   STAFF_TOKEN     secret, staff device auth (npx wrangler secret put STAFF_TOKEN)
//   FIREBASE_PROJECT_ID / FIREBASE_API_KEY  vars, both public by design
//   ALLOWED_ORIGIN  var, the site origin allowed to call /issue

import { signVoucher, verifyVoucher, isClaimable, discountFor, VOUCHER_TTL_MS } from './voucher.js';

const JSON_HEADERS = { 'content-type': 'application/json' };

function corsHeaders(env) {
  return {
    // Never '*': /redeem is authenticated by a header, and a wildcard origin
    // would let any page on the internet drive a staff device's session.
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
    if ('integerValue' in wrapper) out[key] = Number(wrapper.integerValue);
    else if ('stringValue' in wrapper) out[key] = wrapper.stringValue;
    else if ('timestampValue' in wrapper) out[key] = wrapper.timestampValue;
    else if ('booleanValue' in wrapper) out[key] = wrapper.booleanValue;
    else if ('doubleValue' in wrapper) out[key] = Number(wrapper.doubleValue);
  }
  return out;
}

/**
 * Read one leaderboard document.
 *
 * The leaderboard is world-readable by design (every visitor renders it), so
 * this needs no service account — the public API key is enough. Contact details
 * live in a separate collection this Worker never touches.
 */
async function readLeaderboardEntry(entryId, env) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/leaderboard/${encodeURIComponent(entryId)}` +
    `?key=${env.FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const doc = await response.json();
  return decodeFirestoreFields(doc.fields);
}

/** Document ids are Firestore auto-ids: 20 chars, alphanumeric. */
function isPlausibleEntryId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9]{1,64}$/.test(value);
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

  const rupees = discountFor(entry.score);
  if (rupees <= 0) return json({ error: 'no-prize' }, env, 409);

  const issuedAt = Date.now();
  const token = await signVoucher(
    { entryId: body.entryId, name: entry.name ?? '', score: entry.score, rupees, issuedAt },
    env.VOUCHER_SECRET,
  );
  return json(
    { token, rupees, name: entry.name ?? '', score: entry.score, expiresAt: issuedAt + VOUCHER_TTL_MS },
    env,
  );
}

async function handleRedeem(request, env) {
  // Staff-only. Without this a customer could call /redeem from their own phone
  // and wave the resulting "valid" screen at the counter without the voucher
  // ever being marked used.
  if (request.headers.get('x-staff-token') !== env.STAFF_TOKEN) {
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

  const redeemedAt = new Date().toISOString();
  await env.VOUCHERS.put(
    ledgerKey,
    JSON.stringify({ redeemedAt, rupees: claim.rupees, name: claim.name, score: claim.score }),
    // Outlive the voucher so a replay after expiry still reads as redeemed
    // rather than falling back to "expired" and looking like a fresh failure.
    { expirationTtl: Math.ceil((VOUCHER_TTL_MS * 7) / 1000) },
  );

  return json({ valid: true, rupees: claim.rupees, name: claim.name, score: claim.score, redeemedAt }, env);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (pathname === '/health') {
      return json({ ok: true }, env);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method-not-allowed' }, env, 405);
    }
    if (pathname === '/issue') return handleIssue(request, env);
    if (pathname === '/redeem') return handleRedeem(request, env);
    return json({ error: 'not-found' }, env, 404);
  },
};
