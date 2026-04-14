import { createGmailClient, searchMessages, fetchMessage, fetchAttachmentBytes } from './gmail.js';
import { classifyMessage } from './parsers.js';
import { TelegramClient } from './telegram.js';

const GMAIL_SEARCH_QUERY = [
  '(',
  'from:(noreply@business.google.com OR googlecommunityteam-noreply@google.com OR business-profile-noreply@google.com)',
  'AND (subject:"left a review" OR subject:"you got")',
  ')',
  'OR',
  '(from:petpooja AND subject:"Report Notification:")',
].join(' ');

export async function buildDigest({ gmail, lookbackHours }) {
  const query = `(${GMAIL_SEARCH_QUERY}) newer_than:${Math.ceil(lookbackHours / 24)}d`;
  const stubs = await searchMessages(gmail, { query });
  const messages = await Promise.all(stubs.map((s) => fetchMessage(gmail, s.id)));

  const reviews = [];
  const petpoojaReports = [];
  const cutoffMs = Date.now() - lookbackHours * 3600 * 1000;

  for (const msg of messages) {
    const receivedMs = Number(msg.internalDate);
    if (!Number.isFinite(receivedMs) || receivedMs < cutoffMs) continue;
    const parsed = classifyMessage(msg);
    if (parsed.kind === 'review') reviews.push(parsed);
    else if (parsed.kind === 'petpooja') petpoojaReports.push(parsed);
  }

  return { reviews, petpoojaReports };
}

export function formatDigestText({ reviews, petpoojaReports, localeTz }) {
  const today = new Date().toLocaleDateString('en-GB', {
    timeZone: localeTz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const reviewCount = reviews.reduce((sum, r) => sum + r.count, 0);
  const reviewerNames = reviews
    .filter((r) => r.reviewer)
    .map((r) => r.reviewer);

  const lines = [`☀️ <b>Blend N Bubbles — Daily Rundown</b>`, `${today}, 09:00 TPE`, ''];

  lines.push('<b>⭐ Google Reviews (last 24h)</b>');
  if (reviewCount === 0) {
    lines.push('  • No new reviews today ✅');
  } else {
    lines.push(`  • ${reviewCount} new review${reviewCount > 1 ? 's' : ''}`);
    if (reviewerNames.length > 0) {
      lines.push(`  • From: ${reviewerNames.join(', ')}`);
    }
    lines.push('  • <a href="https://business.google.com/reviews">Reply on Google Business ↗</a>');
  }
  lines.push('');

  lines.push('<b>📊 PetPooja — Barrackpore Branch</b>');
  if (petpoojaReports.length === 0) {
    lines.push("  • No overnight report yet — check again later");
  } else {
    for (const report of petpoojaReports) {
      lines.push(`  • ${report.reportTitle}`);
      for (const att of report.attachments) {
        lines.push(`  • 📎 ${att.filename}`);
      }
    }
  }

  return lines.join('\n');
}

export async function runDigest({ config, now = Date.now }) {
  const gmail = createGmailClient(config.gmail);
  const telegram = new TelegramClient(config.telegram);

  const { reviews, petpoojaReports } = await buildDigest({
    gmail,
    lookbackHours: config.lookbackHours,
  });

  const text = formatDigestText({
    reviews,
    petpoojaReports,
    localeTz: config.localeTz,
  });

  await telegram.sendMessage(text);

  for (const report of petpoojaReports) {
    for (const att of report.attachments) {
      const buffer = await fetchAttachmentBytes(gmail, {
        messageId: report.messageId,
        attachmentId: att.attachmentId,
      });
      await telegram.sendDocument({
        filename: att.filename,
        buffer,
        mimeType: att.mimeType,
        caption: `📊 ${report.reportTitle}`,
      });
    }
  }

  return {
    sentAt: new Date(typeof now === 'function' ? now() : now).toISOString(),
    reviewCount: reviews.reduce((sum, r) => sum + r.count, 0),
    reportCount: petpoojaReports.length,
  };
}
