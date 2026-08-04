// Client for the event-request webhook (scripts/apps-script-events).
//
// The webhook is an Apps Script web app called with GET query params — the
// same transport the spin webhook uses, because this Workspace deployment
// rejects anonymous POST bodies.
//
// Every outcome is named rather than collapsed into null, because the form
// has to say something different for each: an unconfigured webhook is not
// the same as a network failure, and neither is the same as the server
// rejecting the payload.

// Set REACT_APP_EVENTS_WEBHOOK_URL in `.env.production` (or `.env`) to the
// deployed web app URL, e.g. https://script.google.com/macros/s/…/exec
//
// Left unset, submissions return { status: 'disabled' } and the form shows
// its direct-contact fallback. That is deliberate: the page can ship before
// the webhook is deployed, and keeps degrading gracefully if the webhook is
// ever taken down.
const WEBHOOK_URL = process.env.REACT_APP_EVENTS_WEBHOOK_URL || '';

/** How long to wait for the webhook before reporting it unavailable. */
const REQUEST_TIMEOUT_MS = 10000;

/** Whether a webhook endpoint is configured at all. */
export function isEventsEnabled() {
  return Boolean(WEBHOOK_URL);
}

/**
 * Build the GET URL for a submission. Exported for tests.
 *
 * Args:
 *   fields: flat object of form values (already validated by the form).
 *
 * Returns the full URL string, or null when no webhook is configured.
 */
export function buildSubmitUrl(fields) {
  if (!WEBHOOK_URL) return null;
  const params = new URLSearchParams();
  [
    'name', 'org', 'email', 'phone', 'social', 'eventType', 'eventDate',
    'guests', 'message', 'brochure', 'hp',
  ].forEach((key) => {
    const value = fields[key];
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  params.set('userAgent', (navigator.userAgent || '').slice(0, 300));
  params.set('pageHref', window.location.href.slice(0, 300));
  return `${WEBHOOK_URL}?${params.toString()}`;
}

/**
 * Submit an event request.
 *
 * Args:
 *   fields: flat object of form values.
 *   options.fetchImpl: injected in tests.
 *   options.timeoutMs: overridden in tests.
 *
 * Returns one of:
 *   { status: 'disabled' }                 no webhook configured
 *   { status: 'sent' }                     accepted (or honeypot short-circuit)
 *   { status: 'invalid', fields }          server-side required check failed
 *   { status: 'unavailable' }              network, timeout, or non-OK reply
 *
 * Never throws. A failed send must leave the visitor's typed answers intact.
 */
export async function submitEventRequest(fields, options = {}) {
  const { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  // Honeypot: bots that fill the hidden field get a fake success with no
  // network call at all — nothing to learn from, nothing to retry.
  if (fields.hp) return { status: 'sent' };

  const url = buildSubmitUrl(fields);
  if (!url) return { status: 'disabled' };

  // AbortController rather than a bare race, so a slow request is actually
  // cancelled instead of leaking and resolving into a discarded promise.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'unavailable' };

    const body = await response.json().catch(() => null);
    if (!body || body.ok !== true) {
      if (body && body.error === 'missing-fields') {
        return { status: 'invalid', fields: body.fields || [] };
      }
      return { status: 'unavailable' };
    }
    return { status: 'sent' };
  } catch (err) {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
