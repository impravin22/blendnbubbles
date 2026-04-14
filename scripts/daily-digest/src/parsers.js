const GOOGLE_BUSINESS_SENDERS = new Set([
  'noreply@business.google.com',
  'googlecommunityteam-noreply@google.com',
  'business-profile-noreply@google.com',
]);
const PETPOOJA_DOMAIN_SUFFIX = '@petpooja.com';
const ZOMATO_DOMAIN_SUFFIX = '@zomato.com';
const HYPERPURE_DOMAIN_SUFFIXES = ['@hyperpure.com', '.hyperpure.com'];
const TITLE_MAX_CHARS = 200;

const GOOGLE_REVIEW_SINGLE_RE = /^(.+?)\s+left a review for\s+(.+)$/i;
const GOOGLE_REVIEW_BATCH_RE = /^(.+?),\s*you got (\d+) new reviews?$/i;
const GBP_PHOTO_RE = /there['’]?s a new photo on your Business Profile/i;
const GBP_PERFORMANCE_RE = /your performance report for\s+(.+)$/i;

const ZOMATO_REVIEW_RE = /^\[Zomato\]\s+New Review for\s+(.+?)\s+by\s+(.+)$/i;
const ZOMATO_WEEKLY_RE = /^Zomato weekly business report\s+-\s+(.+)$/i;
const ZOMATO_SETTLEMENT_RE = /^Zomato\s+\|\s+Statement of account\s+\|\s+(.+)$/i;
const ZOMATO_TAX_INVOICE_RE = /^Tax Invoice\s*:\s*Zomato\s+(.+)$/i;
// Critical: anything indicating the restaurant is currently not accepting orders.
const ZOMATO_SWITCHED_OFF_RE = /\bordering\s+(?:has\s+been\s+)?(?:switched\s+off|turned\s+off|disabled|paused)\b|\bswitched\s+OFF\b/i;
const ZOMATO_ORDER_REJECTED_RE = /\bOnline order rejected\b/i;
const ZOMATO_PAYOUT_RE = /Update on your payout/i;

const HYPERPURE_ORDER_PLACED_RE = /^Thank you for your order/i;
const HYPERPURE_ORDER_DELIVERED_RE = /has been delivered on/i;

export function extractHeader(message, name) {
  const headers = message?.payload?.headers ?? [];
  const target = name.toLowerCase();
  const found = headers.find((h) => h?.name?.toLowerCase() === target);
  return found?.value ?? '';
}

export function extractEmailAddress(headerValue) {
  const angle = headerValue.match(/<([^>]+)>/);
  return (angle ? angle[1] : headerValue).trim().toLowerCase();
}

/**
 * @returns {object} parsed message with a `kind` discriminator
 */
export function classifyMessage(message) {
  const fromRaw = extractHeader(message, 'From');
  const from = extractEmailAddress(fromRaw);
  const subject = extractHeader(message, 'Subject');
  const messageId = message?.id ?? '';
  const snippet = (message?.snippet ?? '').trim();

  if (GOOGLE_BUSINESS_SENDERS.has(from)) {
    return parseGoogleBusiness({ subject, from, messageId, snippet });
  }
  if (from.endsWith(PETPOOJA_DOMAIN_SUFFIX)) {
    return parsePetPooja(message, { subject, from, messageId });
  }
  if (HYPERPURE_DOMAIN_SUFFIXES.some((suffix) => from.endsWith(suffix))) {
    return parseHyperpure({ subject, from, messageId, snippet });
  }
  if (from.endsWith(ZOMATO_DOMAIN_SUFFIX)) {
    return parseZomato(message, { subject, from, messageId, snippet });
  }
  return { kind: 'unknown', subject, from, messageId };
}

function parseGoogleBusiness({ subject, from, messageId, snippet }) {
  const single = subject.match(GOOGLE_REVIEW_SINGLE_RE);
  if (single) {
    return {
      kind: 'review-single',
      source: 'google',
      reviewer: single[1].trim(),
      business: single[2].trim(),
      count: 1,
    };
  }
  const batch = subject.match(GOOGLE_REVIEW_BATCH_RE);
  if (batch) {
    const count = Number.parseInt(batch[2], 10);
    return {
      kind: 'review-batch',
      source: 'google',
      business: batch[1].trim(),
      count: Number.isFinite(count) && count > 0 ? count : 1,
    };
  }
  if (GBP_PHOTO_RE.test(subject)) {
    return { kind: 'gbp-photo', subject, messageId, snippet };
  }
  const perf = subject.match(GBP_PERFORMANCE_RE);
  if (perf) {
    return {
      kind: 'gbp-performance',
      month: perf[1].trim(),
      messageId,
      snippet: snippet.slice(0, 400),
    };
  }
  return { kind: 'gbp-other', subject, from, messageId };
}

export function parsePetPooja(message, { subject, from = '', messageId = message?.id ?? '' }) {
  if (!subject.startsWith('Report Notification:')) {
    return { kind: 'petpooja-unrecognised', subject, from, messageId };
  }
  const reportTitle = clampTitle(subject.slice('Report Notification:'.length).trim());
  return {
    kind: 'petpooja',
    reportTitle,
    attachments: extractAttachments(message),
    messageId,
  };
}

export function parseZomato(message, { subject, from = '', messageId = message?.id ?? '', snippet = '' }) {
  const review = subject.match(ZOMATO_REVIEW_RE);
  if (review) {
    return {
      kind: 'review-single',
      source: 'zomato',
      reviewer: review[2].trim(),
      business: review[1].trim(),
      count: 1,
    };
  }
  const weekly = subject.match(ZOMATO_WEEKLY_RE);
  if (weekly) {
    return {
      kind: 'zomato-weekly',
      title: clampTitle(weekly[1].trim()),
      attachments: extractAttachments(message),
      messageId,
      snippet: snippet.slice(0, 400),
      metrics: parseZomatoWeeklyMetrics(snippet),
    };
  }
  const settlement = subject.match(ZOMATO_SETTLEMENT_RE);
  if (settlement) {
    return {
      kind: 'zomato-settlement',
      title: clampTitle(settlement[1].trim()),
      attachments: extractAttachments(message),
      messageId,
    };
  }
  const taxInvoice = subject.match(ZOMATO_TAX_INVOICE_RE);
  if (taxInvoice) {
    return {
      kind: 'zomato-tax-invoice',
      title: clampTitle(taxInvoice[1].trim()),
      attachments: extractAttachments(message),
      messageId,
    };
  }
  if (ZOMATO_SWITCHED_OFF_RE.test(subject)) {
    return { kind: 'zomato-alert', severity: 'critical', title: clampTitle(subject), messageId, snippet };
  }
  if (ZOMATO_ORDER_REJECTED_RE.test(subject)) {
    return { kind: 'zomato-alert', severity: 'warning', title: clampTitle(subject), messageId, snippet };
  }
  if (ZOMATO_PAYOUT_RE.test(subject)) {
    return { kind: 'zomato-alert', severity: 'info', title: clampTitle(subject), messageId, snippet };
  }
  return { kind: 'zomato-other', subject, from, messageId };
}

function parseHyperpure({ subject, from, messageId, snippet }) {
  if (HYPERPURE_ORDER_DELIVERED_RE.test(subject)) {
    const idMatch = subject.match(/Order\s+([A-Z0-9-]+)/i);
    return {
      kind: 'hyperpure-order',
      status: 'delivered',
      orderId: idMatch?.[1] ?? '',
      subject,
      messageId,
      snippet,
    };
  }
  if (HYPERPURE_ORDER_PLACED_RE.test(subject)) {
    const idMatch = snippet.match(/Order Number:\s*([A-Z0-9-]+)/i);
    return {
      kind: 'hyperpure-order',
      status: 'placed',
      orderId: idMatch?.[1] ?? '',
      subject,
      messageId,
      snippet,
    };
  }
  return { kind: 'hyperpure-other', subject, from, messageId };
}

export function extractAttachments(message) {
  const parts = flattenParts(message?.payload);
  return parts
    .filter((p) => p.filename && p.body?.attachmentId)
    .map((p) => ({
      filename: p.filename,
      mimeType: p.mimeType,
      attachmentId: p.body.attachmentId,
      size: p.body.size ?? 0,
    }));
}

function flattenParts(part) {
  if (!part) return [];
  const out = [part];
  if (part.parts) {
    for (const child of part.parts) out.push(...flattenParts(child));
  }
  return out;
}

function clampTitle(title) {
  if (title.length <= TITLE_MAX_CHARS) return title;
  return title.slice(0, TITLE_MAX_CHARS - 1).trimEnd() + '…';
}

// Extracts structured metrics from a Zomato weekly-report snippet. Handles
// variants we've observed or are plausible: plain ASCII minus, unicode minus
// (U+2212), +/- signs, Indian-format commas (₹1,15,000), decimals (₹1,156.50),
// and optional parenthesised deltas ("(-67%)").
//   Example snippets:
//     "Total sales ₹1156 -67% Delivered orders 5 -58%"
//     "Total sales ₹1,15,000 (+45%) Delivered orders 120 (+20%)"
// Returns { salesRupees, salesDeltaPct, orders, ordersDeltaPct }; unparseable
// fields are null.
export function parseZomatoWeeklyMetrics(snippet) {
  const empty = { salesRupees: null, salesDeltaPct: null, orders: null, ordersDeltaPct: null };
  if (!snippet || typeof snippet !== 'string') return empty;
  // Normalise unicode minus (U+2212) to ASCII so both regexes succeed.
  const normalised = snippet.replace(/\u2212/g, '-');
  const salesMatch = normalised.match(
    /Total sales\s+(?:[₹Rs.]|Rs\.?)\s*([\d,]+(?:\.\d+)?)[^0-9\-+%]*?([+-]?\d+)\s*%/i,
  );
  const ordersMatch = normalised.match(/Delivered orders\s+([\d,]+)[^0-9\-+%]*?([+-]?\d+)\s*%/i);
  return {
    salesRupees: parseLooseNumber(salesMatch?.[1]),
    salesDeltaPct: parseLooseInt(salesMatch?.[2]),
    orders: parseLooseInt(ordersMatch?.[1]),
    ordersDeltaPct: parseLooseInt(ordersMatch?.[2]),
  };
}

function parseLooseNumber(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseLooseInt(s) {
  if (s == null) return null;
  const n = Number.parseInt(String(s).replace(/[,+]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function isReviewKind(parsed) {
  return parsed.kind === 'review-single' || parsed.kind === 'review-batch';
}

// Only `unknown` (completely unrelated senders) is truly silent. Emails from
// trusted senders (Zomato/GBP/Hyperpure) that our parsers can't classify are
// surfaced as warnings — so a new email format surfaces instead of disappearing.
export function isSilentKind(parsed) {
  return parsed.kind === 'unknown';
}
