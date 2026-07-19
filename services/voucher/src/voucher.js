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

// Per-game reward rules. A game absent from this table mints NOTHING.
//
// This table must be keyed by game, and the lookup must fail closed, because
// the games' scores are not in the same units. Football counts goals and is
// capped at 19 by firestore.rules, so 2 rupees a goal tops out at 38.
// Boba Catcher counts points — catchable items are worth 1 to 10 each with a
// combo multiplier up to 3x — and its rules ceiling is 1000. Paying 2 rupees a
// "goal" there hands the maximum discount to any ordinary run past 25 points,
// which is a normal score, not a cheat.
//
// bobacatcher is deliberately absent rather than set to a small number: its
// in-store reward is a topping upgrade, not money off, so it has no rupee value
// to express here. Give it an entry only when someone decides what it is worth.
export const REWARDS = {
  football: { rupeesPerPoint: 2, maxRupees: 50 },
};

// How long after the game a voucher can be minted. Covers walking to the
// counter and a slow queue, without leaving the board minable.
export const SCORE_MAX_AGE_MS = 15 * 60 * 1000;
// How long a minted voucher stays redeemable.
export const VOUCHER_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Rupees off for a score in a given game. Mirrors getReward in penaltyLogic.js
 * for football. Unknown or missing game => 0, never a default rate.
 */
export function discountFor(score, game) {
  const rule = REWARDS[game];
  if (!rule) return 0;
  if (!Number.isInteger(score) || score < 0) return 0;
  return Math.min(score * rule.rupeesPerPoint, rule.maxRupees);
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
export function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
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
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
  // Exactly two segments. A destructuring split would silently discard trailing
  // segments, so `<token>.anything` would verify as the same claim — unlimited
  // distinct strings for one voucher. Harmless while the redemption ledger keys
  // on entryId, but it stops being harmless the moment anything keys on the
  // token itself (an idempotency key, a scanned-QR cache), and that change
  // would look perfectly safe to whoever makes it.
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payload, signature] = parts;
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

  // A validly-signed payload can still decode to null, a number, or an array.
  // Only reachable by someone holding the secret, but the point of this module
  // is not to trust whatever comes back out of the parser.
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    return { ok: false, reason: 'malformed' };
  }
  // Guard both directions, as isClaimable does. A far-future issuedAt would
  // otherwise give a voucher that never expires. It is server-set and signed,
  // so reaching this needs a clock fault or a leaked secret — but the asymmetry
  // would be an odd thing to leave in a file that checks the other timestamp
  // both ways.
  const age = now - claim.issuedAt;
  if (!Number.isInteger(claim.issuedAt) || age > VOUCHER_TTL_MS || age < -60_000) {
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
