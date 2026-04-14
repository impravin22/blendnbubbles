const GOOGLE_BUSINESS_SENDERS = new Set([
  'noreply@business.google.com',
  'googlecommunityteam-noreply@google.com',
  'business-profile-noreply@google.com',
]);
const PETPOOJA_DOMAIN_SUFFIX = '@petpooja.com';
const ZOMATO_DOMAIN_SUFFIX = '@zomato.com';
const HYPERPURE_DOMAIN_MARKER = 'hyperpure';

const GOOGLE_REVIEW_SINGLE_RE = /^(.+?)\s+left a review for\s+(.+)$/i;
const GOOGLE_REVIEW_BATCH_RE = /^(.+?),\s*you got (\d+) new reviews?$/i;
const GBP_PHOTO_RE = /there['’]?s a new photo on your Business Profile/i;
const GBP_PERFORMANCE_RE = /your performance report for\s+(.+)$/i;

const ZOMATO_REVIEW_RE = /^\[Zomato\]\s+New Review for\s+(.+?)\s+by\s+(.+)$/i;
const ZOMATO_WEEKLY_RE = /^Zomato weekly business report\s+-\s+(.+)$/i;
const ZOMATO_SETTLEMENT_RE = /^Zomato\s+\|\s+Statement of account\s+\|\s+(.+)$/i;
const ZOMATO_TAX_INVOICE_RE = /^Tax Invoice\s*:\s*Zomato\s+(.+)$/i;
const ZOMATO_SWITCHED_OFF_RE = /Online ordering switched OFF/i;
const ZOMATO_ORDER_REJECTED_RE = /Online order rejected at/i;
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
  if (from.includes(HYPERPURE_DOMAIN_MARKER)) {
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
  const reportTitle = subject.slice('Report Notification:'.length).trim();
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
      title: weekly[1].trim(),
      attachments: extractAttachments(message),
      messageId,
      snippet: snippet.slice(0, 400),
    };
  }
  const settlement = subject.match(ZOMATO_SETTLEMENT_RE);
  if (settlement) {
    return {
      kind: 'zomato-settlement',
      title: settlement[1].trim(),
      attachments: extractAttachments(message),
      messageId,
    };
  }
  const taxInvoice = subject.match(ZOMATO_TAX_INVOICE_RE);
  if (taxInvoice) {
    return {
      kind: 'zomato-tax-invoice',
      title: taxInvoice[1].trim(),
      attachments: extractAttachments(message),
      messageId,
    };
  }
  if (ZOMATO_SWITCHED_OFF_RE.test(subject)) {
    return { kind: 'zomato-alert', severity: 'critical', title: subject, messageId, snippet };
  }
  if (ZOMATO_ORDER_REJECTED_RE.test(subject)) {
    return { kind: 'zomato-alert', severity: 'warning', title: subject, messageId, snippet };
  }
  if (ZOMATO_PAYOUT_RE.test(subject)) {
    return { kind: 'zomato-alert', severity: 'info', title: subject, messageId, snippet };
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

export function isReviewKind(parsed) {
  return parsed.kind === 'review-single' || parsed.kind === 'review-batch';
}

export function isSilentKind(parsed) {
  // Kinds we intentionally ignore in the digest (not surfaced, not flagged as unrecognised)
  return (
    parsed.kind === 'unknown' ||
    parsed.kind === 'zomato-other' ||
    parsed.kind === 'gbp-other' ||
    parsed.kind === 'hyperpure-other'
  );
}
