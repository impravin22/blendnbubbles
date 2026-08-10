// Partner sheets data service.
//
//   GET /data   Authorization: Bearer <token>  -> the partner sheet extract
//   GET /health                                -> ok
//
// WHY THIS EXISTS
//   The first version of /partners imported the extract straight into the React
//   bundle and gated it with a passcode constant in that same bundle. A build
//   from that tree carried 1,187 customer phone numbers, the event-enquiry sheet
//   (name, organisation, email, phone), and the hardcoded passcode constant
//   that claimed to protect them — all readable from View Source before anyone
//   typed anything. It was never deployed. This service is what it should have
//   been. The passcode is not repeated here: it was a real chosen secret, and a
//   dead credential written into a public repo is one someone reuses later.
//
//   Same shape as services/reports, and for the same reason: data that must not
//   be public cannot live in a public build. It lives in KV and is served only
//   against a token that exists as a Worker secret and never reaches a browser.
//
// WHY NOT REUSE THE REPORTS SERVICE
//   Both are owner-only, so one Worker with one token would have worked and
//   saved this duplication. Kept separate because these sheets are personal
//   data and the sales dataset is not: a partner-token rotation should not
//   black out the sales dashboard, and vice versa. The house convention is
//   already one Worker per concern (reports, voucher, cron, petpooja-webhook).
//   If a fourth bearer-token service appears, extract the shared auth helpers.
//
// WHAT THIS IS NOT
//   A bearer token is a shared secret, not an identity. It cannot tell two
//   people apart, and revoking it means rotating it for everyone. Cloudflare
//   Access would give real per-person auth, but it authenticates by browser
//   redirect, which a cross-origin fetch from the site cannot follow.
//
// BINDINGS
//   PARTNERS        KV namespace holding the extract under DATA_KEY
//   PARTNERS_TOKEN  secret (npx wrangler secret put PARTNERS_TOKEN)
//   ALLOWED_ORIGIN  var, the site origin permitted to read it

const DATA_KEY = 'partner-sheets';

function corsHeaders(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN ?? 'https://blendnbubbles.com',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization',
    'access-control-max-age': '86400',
  };
}

function json(body, env, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(env) },
  });
}

/**
 * Compare two strings without leaking where they diverge.
 *
 * A plain === returns as soon as it hits a mismatched byte, so response timing
 * reveals how many leading bytes were right.
 */
function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorised(request, env) {
  // An empty-string secret must never authorise an empty header: '' !== '' is
  // false, so a plain comparison would let anyone in on a half-finished deploy.
  if (!env.PARTNERS_TOKEN) return false;
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return constantTimeEquals(header.slice(prefix.length), env.PARTNERS_TOKEN);
}

export default {
  async fetch(request, env) {
    // The runtime's synthetic 500 for an uncaught throw carries no CORS headers,
    // so a crash would reach the page as an opaque network error.
    try {
      const { pathname } = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(env) });
      }
      if (pathname === '/health' && request.method === 'GET') {
        return json({ ok: true }, env);
      }
      if (request.method !== 'GET') {
        return json({ error: 'method-not-allowed' }, env, 405);
      }
      // Fail closed on a half-configured deploy rather than serving personal
      // data to anyone who happens to find the URL.
      if (!env.PARTNERS || !env.PARTNERS_TOKEN) {
        return json({ error: 'misconfigured' }, env, 503);
      }
      if (pathname !== '/data') {
        return json({ error: 'not-found' }, env, 404);
      }
      if (!isAuthorised(request, env)) {
        return json({ error: 'unauthorised' }, env, 401);
      }

      const extract = await env.PARTNERS.get(DATA_KEY);
      if (!extract) return json({ error: 'no-dataset' }, env, 404);

      return new Response(extract, {
        headers: {
          'content-type': 'application/json',
          // Never let a shared cache hold an authorised response.
          'cache-control': 'private, no-store',
          ...corsHeaders(env),
        },
      });
    } catch {
      return json({ error: 'internal' }, env, 500);
    }
  },
};
