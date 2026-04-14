import {
  createGmailClient,
  searchMessages,
  fetchMessage,
  fetchAttachmentBytes,
  isInvalidGrantError,
} from './gmail.js';
import { classifyMessage, isReviewKind } from './parsers.js';
import { TelegramClient } from './telegram.js';

const TELEGRAM_DOCUMENT_BYTE_LIMIT = 50 * 1024 * 1024;
const GMAIL_SEARCH_QUERY =
  '((from:(noreply@business.google.com OR googlecommunityteam-noreply@google.com OR business-profile-noreply@google.com) ' +
  'AND (subject:"left a review" OR subject:"you got")) ' +
  'OR (from:petpooja AND subject:"Report Notification:"))';

export async function buildDigest({ gmail, lookbackHours }) {
  const query = `${GMAIL_SEARCH_QUERY} newer_than:${Math.ceil(lookbackHours / 24)}d`;
  const stubs = await searchMessages(gmail, query);
  const fetches = await Promise.allSettled(stubs.map((s) => fetchMessage(gmail, s.id)));
  const messages = fetches
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  const fetchFailures = fetches.filter((r) => r.status === 'rejected').length;

  const reviews = [];
  const petpoojaReports = [];
  const unrecognised = [];
  const cutoffMs = Date.now() - lookbackHours * 3600 * 1000;

  for (const msg of messages) {
    const receivedMs = Number(msg.internalDate);
    if (!Number.isFinite(receivedMs) || receivedMs < cutoffMs) continue;
    const parsed = classifyMessage(msg);
    if (isReviewKind(parsed)) {
      reviews.push(parsed);
    } else if (parsed.kind === 'petpooja') {
      petpoojaReports.push(parsed);
    } else if (parsed.kind !== 'unknown') {
      unrecognised.push(parsed);
    }
  }

  return { reviews, petpoojaReports, fetchFailures, unrecognised };
}

export function formatDigestText({
  reviews,
  petpoojaReports,
  fetchFailures = 0,
  unrecognised = [],
  localeTz,
}) {
  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: localeTz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const reviewCount = reviews.reduce((sum, r) => sum + r.count, 0);
  const reviewerNames = reviews
    .filter((r) => r.kind === 'review-single')
    .map((r) => r.reviewer);

  const lines = [
    `☀️ <b>Blend N Bubbles — Daily Rundown</b>`,
    `${escapeHtml(today)}, 09:00 TPE`,
    '',
  ];

  lines.push('<b>⭐ Google Reviews (last 24h)</b>');
  if (reviewCount === 0) {
    lines.push('  • No new reviews today ✅');
  } else {
    const reviewWord = reviewCount === 1 ? 'review' : 'reviews';
    lines.push(`  • ${reviewCount} new ${reviewWord}`);
    if (reviewerNames.length > 0) {
      lines.push(`  • From: ${reviewerNames.map(escapeHtml).join(', ')}`);
    }
    lines.push('  • <a href="https://business.google.com/reviews">Reply on Google Business ↗</a>');
  }
  lines.push('');

  lines.push('<b>📊 PetPooja — Barrackpore Branch</b>');
  if (petpoojaReports.length === 0) {
    lines.push('  • No overnight report yet — check again later');
  } else {
    for (const report of petpoojaReports) {
      lines.push(`  • ${escapeHtml(report.reportTitle)}`);
      for (const att of report.attachments) {
        lines.push(`  • 📎 ${escapeHtml(att.filename)}`);
      }
    }
  }

  if (fetchFailures > 0 || unrecognised.length > 0) {
    lines.push('');
    lines.push('<i>⚠️ Digest warnings</i>');
    if (fetchFailures > 0) {
      lines.push(`  • ${fetchFailures} Gmail message(s) failed to fetch`);
    }
    if (unrecognised.length > 0) {
      lines.push(`  • ${unrecognised.length} message(s) matched senders but could not be parsed`);
    }
  }

  return lines.join('\n');
}

export async function runDigest({ config, deps = {} }) {
  const gmail = deps.gmail ?? createGmailClient(config.gmail);
  const telegram = deps.telegram ?? new TelegramClient(config.telegram);

  let digestInput;
  try {
    digestInput = await buildDigest({ gmail, lookbackHours: config.lookbackHours });
  } catch (err) {
    if (isInvalidGrantError(err)) {
      await telegram
        .sendMessage(
          '❌ <b>Daily digest paused</b>\n' +
            'The Gmail refresh token is no longer valid. Run <code>npm run auth</code> locally ' +
            'and update the <code>GMAIL_REFRESH_TOKEN</code> GitHub secret.',
        )
        .catch(() => {});
    }
    throw err;
  }

  const text = formatDigestText({ ...digestInput, localeTz: config.localeTz });
  await telegram.sendMessage(text);

  const attachmentFailures = [];
  for (const report of digestInput.petpoojaReports) {
    for (const att of report.attachments) {
      if (att.size === 0) {
        attachmentFailures.push({ filename: att.filename, reason: 'zero-byte' });
        continue;
      }
      if (att.size > TELEGRAM_DOCUMENT_BYTE_LIMIT) {
        attachmentFailures.push({ filename: att.filename, reason: 'too-large' });
        continue;
      }
      try {
        const buffer = await fetchAttachmentBytes(gmail, report.messageId, att.attachmentId);
        await telegram.sendDocument({
          filename: att.filename,
          buffer,
          mimeType: att.mimeType,
          caption: `📊 ${report.reportTitle}`,
        });
      } catch (err) {
        attachmentFailures.push({ filename: att.filename, reason: err.message });
      }
    }
  }

  if (attachmentFailures.length > 0) {
    const lines = ['⚠️ <b>Some attachments failed to forward</b>'];
    for (const f of attachmentFailures) {
      lines.push(`  • ${escapeHtml(f.filename)} — ${escapeHtml(f.reason)}`);
    }
    lines.push('Open the original email in Gmail to retrieve them.');
    await telegram.sendMessage(lines.join('\n')).catch(() => {});
  }

  return {
    sentAt: new Date().toISOString(),
    reviewCount: digestInput.reviews.reduce((sum, r) => sum + r.count, 0),
    reportCount: digestInput.petpoojaReports.length,
    fetchFailures: digestInput.fetchFailures,
    attachmentFailures: attachmentFailures.length,
  };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
