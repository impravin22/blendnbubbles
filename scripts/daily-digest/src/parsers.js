const REVIEW_SENDERS = [
  'noreply@business.google.com',
  'googlecommunityteam-noreply@google.com',
  'business-profile-noreply@google.com',
];
const REVIEW_SUBJECT_SINGLE_RE = /^(.+?)\s+left a review for\s+(.+)$/i;
const REVIEW_SUBJECT_BATCH_RE = /^(.+?),\s*you got (\d+) new reviews?$/i;

const PETPOOJA_SENDER_PARTS = ['petpooja'];
const PETPOOJA_SUBJECT_PREFIX = 'Report Notification:';

export function extractHeader(message, name) {
  const headers = message?.payload?.headers ?? [];
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? '';
}

export function classifyMessage(message) {
  const from = extractHeader(message, 'From').toLowerCase();
  const subject = extractHeader(message, 'Subject');

  if (REVIEW_SENDERS.some((sender) => from.includes(sender))) {
    return parseReview(subject);
  }
  if (PETPOOJA_SENDER_PARTS.some((part) => from.includes(part))) {
    return parsePetPooja(message, subject);
  }
  return { kind: 'unknown', subject, from };
}

export function parseReview(subject) {
  const single = subject.match(REVIEW_SUBJECT_SINGLE_RE);
  if (single) {
    return {
      kind: 'review',
      reviewer: single[1].trim(),
      business: single[2].trim(),
      count: 1,
    };
  }
  const batch = subject.match(REVIEW_SUBJECT_BATCH_RE);
  if (batch) {
    return {
      kind: 'review',
      reviewer: null,
      business: batch[1].trim(),
      count: Number(batch[2]),
    };
  }
  return { kind: 'review-unrecognised', subject };
}

export function parsePetPooja(message, subject) {
  if (!subject.startsWith(PETPOOJA_SUBJECT_PREFIX)) {
    return { kind: 'petpooja-unrecognised', subject };
  }
  const reportTitle = subject.slice(PETPOOJA_SUBJECT_PREFIX.length).trim();
  const attachments = extractAttachments(message);
  return {
    kind: 'petpooja',
    reportTitle,
    attachments,
    messageId: message.id,
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
