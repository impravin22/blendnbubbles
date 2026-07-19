// Pure voucher logic: discount maths, signing, and verification.
//
// Kept free of Worker bindings and network calls so it can be unit-tested with
// `node --test`. src/index.js owns routing, Firestore reads, and KV.
//
// THREAT MODEL
//   The browser cannot be trusted with the score — it computes the game locally
//   and a player can edit it. So the Worker never accepts a score from the
//   client. It accepts a leaderboard document *id*, reads that document back
//   from Firestore, and reads the score from there.
//
//   Firestore rules cap the score at what honest play can reach and stamp
//   `createdAt` with `request.time`, which the client cannot forge. Together
//   those give the Worker two guarantees it can rely on:
//     1. the score is within the honest range, and
//     2. the document was written when the server says it was.
//
//   Freshness matters as much as the cap: without it, anyone could point at the
//   top of the public leaderboard and mint a voucher from a stranger's run.

const ENCODER = new TextEncoder();

export const RUPEES_PER_GOAL = 2;
// Backstop only; the score cap in firestore.rules binds well below this.
export const MAX_DISCOUNT_RS = 50;
// How long after the game a voucher can be minted. Covers walking to the
// counter and a slow queue, without leaving the board minable.
export const SCORE_MAX_AGE_MS = 15 * 60 * 1000;
// How long a minted voucher stays redeemable.
export const VOUCHER_TTL_MS = 24 * 60 * 60 * 1000;

/** Rupees off for a goal count. Mirrors getReward in src/penaltyLogic.js. */
export function discountFor(score) {
  if (!Number.isInteger(score) || score < 0) return 0;
  return Math.min(score * RUPEES_PER_GOAL, MAX_DISCOUNT_RS);
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, ENCODER.encode(message));
  return toBase64Url(new Uint8Array(signature));
}

/**
 * Compare two strings without leaking where they diverge.
 *
 * A plain `===` on a signature returns as soon as it finds a mismatched byte,
 * so response time reveals how many leading bytes were right and a forger can
 * recover the signature one byte at a time. This always walks both strings.
 */
function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mint a signed voucher token.
 *
 * Args:
 *   claim: { entryId, name, score, rupees, issuedAt } — already validated
 *     against Firestore by the caller.
 *   secret: HMAC key from the VOUCHER_SECRET binding.
 *
 * Returns:
 *   `<payload>.<signature>`, both base64url. Safe to put in a QR code.
 */
export async function signVoucher(claim, secret) {
  const payload = toBase64Url(ENCODER.encode(JSON.stringify(claim)));
  return `${payload}.${await hmac(payload, secret)}`;
}

/**
 * Check a voucher token and return its claim.
 *
 * Returns `{ ok: true, claim }`, or `{ ok: false, reason }` where reason is one
 * of 'malformed', 'bad-signature', or 'expired'. The reasons are deliberately
 * coarse — a staff device shows "not valid", and a forger learns nothing about
 * which part failed beyond what they already control.
 */
export async function verifyVoucher(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' };
  }
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return { ok: false, reason: 'malformed' };

  const expected = await hmac(payload, secret);
  // Verify the signature BEFORE parsing the payload, so untrusted bytes are
  // never handed to JSON.parse.
  if (!constantTimeEquals(signature, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let claim;
  try {
    claim = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!Number.isInteger(claim.issuedAt) || now - claim.issuedAt > VOUCHER_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claim };
}

/**
 * Whether a Firestore leaderboard document may back a voucher.
 *
 * `entry` is the decoded document. `createdAt` is server-stamped via the
 * `request.time` rule, so it is the one timestamp here the client cannot move.
 */
export function isClaimable(entry, now = Date.now()) {
  if (!entry) return { ok: false, reason: 'not-found' };
  if (!Number.isInteger(entry.score) || entry.score < 0) {
    return { ok: false, reason: 'bad-score' };
  }
  const createdAt = Date.parse(entry.createdAt);
  if (Number.isNaN(createdAt)) return { ok: false, reason: 'bad-timestamp' };
  // Guard both directions: a future timestamp would mean the server clock or
  // the rules are wrong, and should not mint anything.
  if (createdAt > now + 60_000) return { ok: false, reason: 'bad-timestamp' };
  if (now - createdAt > SCORE_MAX_AGE_MS) return { ok: false, reason: 'stale' };
  if (entry.score === 0) return { ok: false, reason: 'no-prize' };
  return { ok: true };
}
