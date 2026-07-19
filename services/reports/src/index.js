// Sales dashboard data service.
//
//   GET /data   Authorization: Bearer <token>  -> the sales dataset JSON
//   GET /health                                -> ok
//
// WHY THIS EXISTS
//   The dataset used to be a file in the site's own build. That put 319KB of
//   item-level revenue in two public places at once: a committed file in a
//   public repository, and a chunk in the deployed bundle whose exact filename
//   the site's own asset-manifest.json advertised at the site root. The /reports
//   passcode gated neither — it sat in the same bundle as the data it guarded.
//
//   Moving the file inside the repo did not help and made the path easier to
//   guess. The data has to leave the repo and the build altogether, which is
//   what this service is for: the dataset lives in KV and is served only against
//   a token that exists as a Worker secret and never ships to a browser.
//
// WHAT THIS IS NOT
//   A bearer token is a shared secret, not an identity. It cannot tell two
//   people apart, and revoking it means rotating it for everyone. Cloudflare
//   Access would give real per-person auth for free, but it authenticates by
//   browser redirect, which a cross-origin fetch from the site cannot follow —
//   that needs the dashboard served from this origin instead. Worth doing;
//   this is the version that ships without restructuring the frontend.
//
// BINDINGS
//   REPORTS         KV namespace holding the dataset under DATA_KEY
//   REPORTS_TOKEN   secret (npx wrangler secret put REPORTS_TOKEN)
//   ALLOWED_ORIGIN  var, the site origin permitted to read it

const DATA_KEY = 'sales-dataset';

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
  if (!env.REPORTS_TOKEN) return false;
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return constantTimeEquals(header.slice(prefix.length), env.REPORTS_TOKEN);
}

export default {
  async fetch(request, env) {
    // The runtime's synthetic 500 for an uncaught throw carries no CORS headers,
    // so a crash would reach the dashboard as an opaque network error.
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
      // Fail closed on a half-configured deploy rather than serving the dataset
      // to anyone who happens to find the URL.
      if (!env.REPORTS || !env.REPORTS_TOKEN) {
        return json({ error: 'misconfigured' }, env, 503);
      }
      if (pathname !== '/data') {
        return json({ error: 'not-found' }, env, 404);
      }
      if (!isAuthorised(request, env)) {
        return json({ error: 'unauthorised' }, env, 401);
      }

      const dataset = await env.REPORTS.get(DATA_KEY);
      if (!dataset) return json({ error: 'no-dataset' }, env, 404);

      return new Response(dataset, {
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
