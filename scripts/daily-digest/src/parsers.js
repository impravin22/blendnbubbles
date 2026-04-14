const GOOGLE_REVIEW_SENDERS = new Set([
  'noreply@business.google.com',
  'googlecommunityteam-noreply@google.com',
  'business-profile-noreply@google.com',
]);
const PETPOOJA_DOMAIN_SUFFIX = '@petpooja.com';
const PETPOOJA_SUBJECT_PREFIX = 'Report Notification:';
const ZOMATO_DOMAIN_SUFFIX = '@zomato.com';

const GOOGLE_REVIEW_SINGLE_RE = /^(.+?)\s+left a review for\s+(.+)$/i;
const GOOGLE_REVIEW_BATCH_RE = /^(.+?),\s*you got (\d+) new reviews?$/i;
const ZOMATO_REVIEW_RE = /^\[Zomato\]\s+New Review for\s+(.+?)\s+by\s+(.+)$/i;
const ZOMATO_WEEKLY_RE = /^Zomato weekly business report\s+-\s+(.+)$/i;
const ZOMATO_SETTLEMENT_RE = /^Zomato\s+\|\s+Statement of account\s+\|\s+(.+)$/i;

/**
 * @typedef {object} ReviewSingle
 * @property {'review-single'} kind
 * @property {'google' | 'zomato'} source
 * @property {string} reviewer
 * @property {string} business
 * @property {1} count
 *
 * @typedef {object} ReviewBatch
 * @property {'review-batch'} kind
 * @property {'google'} source
 * @property {string} business
 * @property {number} count
 *
 * @typedef {object} PetPoojaReport
 * @property {'petpooja'} kind
 * @property {string} reportTitle
 * @property {Array<{filename: string, mimeType: string, attachmentId: string, size: number}>} attachments
 * @property {string} messageId
 *
 * @typedef {object} ZomatoWeeklyReport
 * @property {'zomato-weekly'} kind
 * @property {string} title
 * @property {Array<{filename: string, mimeType: string, attachmentId: string, size: number}>} attachments
 * @property {string} messageId
 * @property {string} snippet
 *
 * @typedef {object} ZomatoSettlement
 * @property {'zomato-settlement'} kind
 * @property {string} title
 * @property {Array<{filename: string, mimeType: string, attachmentId: string, size: number}>} attachments
 * @property {string} messageId
 */

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

export function classifyMessage(message) {
  const fromRaw = extractHeader(message, 'From');
  const from = extractEmailAddress(fromRaw);
  const subject = extractHeader(message, 'Subject');
  const messageId = message?.id ?? '';
  const snippet = (message?.snippet ?? '').trim();

  if (GOOGLE_REVIEW_SENDERS.has(from)) {
    return parseGoogleReview({ subject, from, messageId });
  }
  if (from.endsWith(PETPOOJA_DOMAIN_SUFFIX)) {
    return parsePetPooja(message, { subject, from, messageId });
  }
  if (from.endsWith(ZOMATO_DOMAIN_SUFFIX)) {
    return parseZomato(message, { subject, from, messageId, snippet });
  }
  return { kind: 'unknown', subject, from, messageId };
}

export function parseGoogleReview({ subject, from = '', messageId = '' }) {
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
  return { kind: 'review-unrecognised', subject, from, messageId };
}

export function parsePetPooja(message, { subject, from = '', messageId = message?.id ?? '' }) {
  if (!subject.startsWith(PETPOOJA_SUBJECT_PREFIX)) {
    return { kind: 'petpooja-unrecognised', subject, from, messageId };
  }
  const reportTitle = subject.slice(PETPOOJA_SUBJECT_PREFIX.length).trim();
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
  return { kind: 'zomato-other', subject, from, messageId };
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
