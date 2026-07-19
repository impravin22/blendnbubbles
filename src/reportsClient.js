// Client for the sales dashboard data service (services/reports).
//
// The dataset used to be a file in this build. That put 319KB of item-level
// revenue in two public places at once — a committed file in a public
// repository, and a chunk in the deployed bundle whose exact filename the
// site's own asset-manifest.json advertised at the root. The passcode gated
// neither, because it shipped in the same bundle as the data it guarded.
//
// Now the data lives in Cloudflare KV and is served only against a token held
// as a Worker secret. Nothing in this file can decide whether a token is valid;
// only the server can. That is the point — there is no longer a client-side
// check to read out of the bundle and bypass.

const REPORTS_API = process.env.REACT_APP_REPORTS_URL;

// Persisted rather than per-session: the token is a long random string and
// retyping it on every visit would push someone toward writing it down
// somewhere worse.
export const TOKEN_KEY = 'bnbReportsToken';

export function isReportsConfigured() {
  return Boolean(REPORTS_API);
}

export function readStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    // Private mode or blocked storage: the dashboard still works, the token
    // just has to be entered each time.
    return '';
  }
}

export function storeToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Not fatal — the fetch below uses the in-memory value regardless.
  }
}

export function clearStoredToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to do; the caller already treats the token as rejected.
  }
}

/**
 * Fetch the sales dataset.
 *
 * Returns one of:
 *   { status: 'ok', data }
 *   { status: 'unauthorised' }   token missing, wrong, or revoked
 *   { status: 'unconfigured' }   REACT_APP_REPORTS_URL not set at build time
 *   { status: 'unavailable', detail }  network, server, or malformed response
 *
 * Never throws. Outcomes stay distinct because the dashboard has to say
 * something different for each — "your token was rejected" and "the server is
 * unreachable" are not the same problem, and collapsing them is how a stale
 * deployment becomes undiagnosable.
 */
export async function fetchReportsData(token, options = {}) {
  const { fetchImpl = fetch } = options;
  if (!REPORTS_API) return { status: 'unconfigured' };
  if (!token) return { status: 'unauthorised' };

  let response;
  try {
    response = await fetchImpl(`${REPORTS_API}/data`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { status: 'unavailable', detail: err?.message ?? 'network error' };
  }

  if (response.status === 401) return { status: 'unauthorised' };
  if (!response.ok) {
    return { status: 'unavailable', detail: `server returned ${response.status}` };
  }

  try {
    const data = await response.json();
    // A truthy object with rows is the contract; anything else means the
    // endpoint changed under us and the charts would throw further down.
    if (!data || !Array.isArray(data.rows)) {
      return { status: 'unavailable', detail: 'unexpected response shape' };
    }
    return { status: 'ok', data };
  } catch (err) {
    return { status: 'unavailable', detail: err?.message ?? 'invalid JSON' };
  }
}
