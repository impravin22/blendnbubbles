/**
 * Seen-store client — talks to the blendnbubbles-cron Worker's /seen endpoints.
 *
 * The store prevents review emails from re-appearing in digests after they've
 * already been surfaced once. 30-day TTL is enforced server-side.
 *
 * Both check() and mark() fail open: if the store is unreachable or
 * misconfigured, callers get conservative results (empty Set from check,
 * false from mark) and the digest proceeds without deduplication. Missing
 * config (no URL/token) is not an error — it just disables the feature.
 */

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * @param {object} config
 * @param {string} [config.url]   Worker origin, e.g. "https://blendnbubbles-cron.workers.dev"
 * @param {string} [config.token] Bearer token shared with the Worker
 * @param {typeof fetch} [config.fetchImpl] injectable for tests
 * @param {number} [config.timeoutMs]
 */
export function createSeenStore({ url, token, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const configured = Boolean(url && token);
  if (!configured) {
    console.warn('seen-store not configured — dedupe disabled');
  }
  const origin = (url ?? '').replace(/\/$/, '');

  async function post(pathname, ids) {
    const body = JSON.stringify({ ids });
    const res = await fetchImpl(`${origin}${pathname}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`seen-store ${pathname} HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  return {
    configured,

    /**
     * @param {string[]} ids
     * @returns {Promise<Set<string>>} subset of `ids` already marked seen
     */
    async check(ids) {
      if (!configured || ids.length === 0) return new Set();
      try {
        const data = await post('/seen/check', ids);
        return new Set(Array.isArray(data?.seen) ? data.seen : []);
      } catch (err) {
        console.warn('seen-store check failed — treating all as unseen:', err?.message ?? err);
        return new Set();
      }
    },

    /**
     * @param {string[]} ids
     * @returns {Promise<boolean>} true on success
     */
    async mark(ids) {
      if (!configured || ids.length === 0) return false;
      try {
        await post('/seen/mark', ids);
        return true;
      } catch (err) {
        console.warn('seen-store mark failed — next digest may re-notify:', err?.message ?? err);
        return false;
      }
    },
  };
}
