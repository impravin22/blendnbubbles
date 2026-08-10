// Client for the partner sheets data service (services/partners).
//
// The extract used to be `src/partnerData.json`, imported straight into this
// bundle. That put 1,187 customer phone numbers and the event-enquiry sheet
// into the deployed JavaScript, alongside the hardcoded passcode constant that
// claimed to gate them. Anyone could read the code and skip the gate. It was
// caught before the first deploy, so nothing ever went public.
//
// Now the extract lives in Cloudflare KV and is served only against a token
// held as a Worker secret. Nothing in this file can decide whether a token is
// valid; only the server can. That is the point — there is no longer a
// client-side check to read out of the bundle and bypass.

const PARTNERS_API = process.env.REACT_APP_PARTNERS_URL;

// Deliberately distinct from the reports key. The two services hold separate
// Worker secrets, so a shared key would hand each one the other's token.
export const TOKEN_KEY = 'bnbPartnersToken';

export function isPartnersConfigured() {
  return Boolean(PARTNERS_API);
}

export function readStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    // Private mode or blocked storage: the page still works, the token just
    // has to be entered each time.
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
 * Fetch the partner sheet extract.
 *
 * Returns one of:
 *   { status: 'ok', data }
 *   { status: 'unauthorised' }   token missing, wrong, or revoked
 *   { status: 'unconfigured' }   REACT_APP_PARTNERS_URL not set at build time
 *   { status: 'unavailable', detail }  network, server, or malformed response
 *
 * Never throws. Outcomes stay distinct because the page has to say something
 * different for each — "your token was rejected" and "the server is
 * unreachable" are not the same problem, and collapsing them is how a stale
 * deployment becomes undiagnosable.
 */
export async function fetchPartnerSheets(token, options = {}) {
  const { fetchImpl = fetch } = options;
  if (!PARTNERS_API) return { status: 'unconfigured' };
  if (!token) return { status: 'unauthorised' };

  let response;
  try {
    response = await fetchImpl(`${PARTNERS_API}/data`, {
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
    // A truthy object with a sheets array is the contract. An empty array is a
    // valid answer — no Drive activity in 30 days — so only a non-array fails.
    if (!data || !Array.isArray(data.sheets)) {
      return { status: 'unavailable', detail: 'unexpected response shape' };
    }
    return { status: 'ok', data };
  } catch (err) {
    return { status: 'unavailable', detail: err?.message ?? 'invalid JSON' };
  }
}
