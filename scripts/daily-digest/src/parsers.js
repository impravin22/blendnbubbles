const REVIEW_SENDER_ADDRESSES = new Set([
  'noreply@business.google.com',
  'googlecommunityteam-noreply@google.com',
  'business-profile-noreply@google.com',
]);
const PETPOOJA_DOMAIN_SUFFIX = '@petpooja.com';
const PETPOOJA_SUBJECT_PREFIX = 'Report Notification:';

const REVIEW_SUBJECT_SINGLE_RE = /^(.+?)\s+left a review for\s+(.+)$/i;
const REVIEW_SUBJECT_BATCH_RE = /^(.+?),\s*you got (\d+) new reviews?$/i;

/**
 * @typedef {object} ReviewSingle
 * @property {'review-single'} kind
 * @property {string} reviewer
 * @property {string} business
 * @property {1} count
 *
 * @typedef {object} ReviewBatch
 * @property {'review-batch'} kind
 * @property {string} business
 * @property {number} count
 *
 * @typedef {object} PetPoojaReport
 * @property {'petpooja'} kind
 * @property {string} reportTitle
 * @property {Array<{filename: string, mimeType: string, attachmentId: string, size: number}>} attachments
 * @property {string} messageId
 *
 * @typedef {object} UnrecognisedReview
 * @property {'review-unrecognised'} kind
 * @property {string} subject
 * @property {string} from
 * @property {string} messageId
 *
 * @typedef {object} UnrecognisedPetPooja
 * @property {'petpooja-unrecognised'} kind
 * @property {string} subject
 * @property {string} from
 * @property {string} messageId
 *
 * @typedef {object} UnknownMessage
 * @property {'unknown'} kind
 * @property {string} subject
 * @property {string} from
 * @property {string} messageId
 *
 * @typedef {ReviewSingle | ReviewBatch | PetPoojaReport | UnrecognisedReview | UnrecognisedPetPooja | UnknownMessage} ParsedMessage
 */

/**
 * Read a header value case-insensitively. Returns '' when missing.
 */
export function extractHeader(message, name) {
  const headers = message?.payload?.headers ?? [];
  const target = name.toLowerCase();
  const found = headers.find((h) => h?.name?.toLowerCase() === target);
  return found?.value ?? '';
}

/**
 * Extract the bare email address from a header like `"Name" <addr@host>` or plain `addr@host`.
 */
export function extractEmailAddress(headerValue) {
  const angle = headerValue.match(/<([^>]+)>/);
  const raw = (angle ? angle[1] : headerValue).trim().toLowerCase();
  return raw;
}

/**
 * Classify a Gmail message into one of the ParsedMessage variants.
 * @returns {ParsedMessage}
 */
export function classifyMessage(message) {
  const fromRaw = extractHeader(message, 'From');
  const from = extractEmailAddress(fromRaw);
  const subject = extractHeader(message, 'Subject');
  const messageId = message?.id ?? '';

  if (REVIEW_SENDER_ADDRESSES.has(from)) {
    return parseReview({ subject, from, messageId });
  }
  if (from.endsWith(PETPOOJA_DOMAIN_SUFFIX)) {
    return parsePetPooja(message, { subject, from, messageId });
  }
  return { kind: 'unknown', subject, from, messageId };
}

/**
 * @returns {ReviewSingle | ReviewBatch | UnrecognisedReview}
 */
export function parseReview({ subject, from = '', messageId = '' }) {
  const single = subject.match(REVIEW_SUBJECT_SINGLE_RE);
  if (single) {
    return {
      kind: 'review-single',
      reviewer: single[1].trim(),
      business: single[2].trim(),
      count: 1,
    };
  }
  const batch = subject.match(REVIEW_SUBJECT_BATCH_RE);
  if (batch) {
    const count = Number.parseInt(batch[2], 10);
    return {
      kind: 'review-batch',
      business: batch[1].trim(),
      count: Number.isFinite(count) && count > 0 ? count : 1,
    };
  }
  return { kind: 'review-unrecognised', subject, from, messageId };
}

/**
 * @returns {PetPoojaReport | UnrecognisedPetPooja}
 */
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
