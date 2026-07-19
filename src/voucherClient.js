// Client for the voucher Worker (services/voucher).
//
// The game computes its score in the browser, so the reward card it draws is
// only ever a claim. This module exchanges a leaderboard document id for a
// server-signed voucher, which is the thing the counter actually honours.
//
// Every outcome is named rather than collapsed into null, because the card has
// to say something different for each: a configured-but-unreachable Worker is
// not the same as a Worker that looked at the score and declined it, and
// neither is the same as the feature being switched off.

// Set REACT_APP_VOUCHER_URL to the deployed Worker origin, e.g.
// https://blendnbubbles-voucher.<subdomain>.workers.dev
//
// Left unset, the voucher step is skipped entirely and the game behaves exactly
// as it did before. That is deliberate: this can ship before the Worker is
// deployed, and the game keeps working if the Worker is ever taken down.
const VOUCHER_API = process.env.REACT_APP_VOUCHER_URL;

/** How long to wait for the Worker before falling back to the plain card. */
const REQUEST_TIMEOUT_MS = 6000;

/** Whether a voucher endpoint is configured at all. */
export function isVoucherEnabled() {
  return Boolean(VOUCHER_API);
}

/**
 * Ask the Worker to mint a voucher for a leaderboard row.
 *
 * Args:
 *   entryId: Firestore document id returned by submitScore.
 *   options.fetchImpl: injected in tests.
 *   options.timeoutMs: overridden in tests.
 *
 * Returns one of:
 *   { status: 'disabled' }                        no endpoint configured
 *   { status: 'issued', token, rupees, name, score, game, expiresAt }
 *   { status: 'declined', reason }                the Worker refused; reason is
 *                                                 one of stale / not-found /
 *                                                 no-prize / bad-score
 *   { status: 'unavailable' }                     network, timeout, or 5xx
 *
 * Never throws. A voucher failing must not lose the player their game.
 */
export async function requestVoucher(entryId, options = {}) {
  const { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  if (!VOUCHER_API) return { status: 'disabled' };
  if (!entryId) return { status: 'unavailable' };

  // AbortController rather than a bare race, so a slow request is actually
  // cancelled instead of leaking and resolving into a discarded promise.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${VOUCHER_API}/issue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entryId }),
      signal: controller.signal,
    });

    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      return { status: 'declined', reason: body.error ?? 'declined' };
    }
    if (!response.ok) return { status: 'unavailable' };

    const body = await response.json();
    if (!body?.token || typeof body.rupees !== 'number') {
      return { status: 'unavailable' };
    }
    return {
      status: 'issued',
      token: body.token,
      rupees: body.rupees,
      name: body.name ?? '',
      score: body.score,
      game: body.game,
      expiresAt: body.expiresAt,
    };
  } catch {
    // Abort, DNS failure, offline, CORS — all the same to the player.
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The URL a staff device opens when it scans the customer's QR code.
 *
 * The token travels in the fragment, not the query string, so it is never sent
 * to the server in a request line and never lands in an access log.
 */
export function redeemUrl(token, staffOrigin = VOUCHER_API) {
  return `${staffOrigin}/redeem#${encodeURIComponent(token)}`;
}
