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
  'OR (from:petpooja AND subject:"Report Notification:") ' +
  'OR (from:zomato.com AND (subject:"weekly business report" OR subject:"Statement of account" OR subject:"New Review")))';

export async function buildDigest({ gmail, lookbackHours }) {
  const query = `${GMAIL_SEARCH_QUERY} newer_than:${Math.max(1, Math.ceil(lookbackHours / 24))}d`;
  const stubs = await searchMessages(gmail, query);
  const fetches = await Promise.allSettled(stubs.map((s) => fetchMessage(gmail, s.id)));
  const messages = fetches
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  const fetchFailures = fetches.filter((r) => r.status === 'rejected').length;

  const reviews = [];
  const petpoojaReports = [];
  const zomatoWeekly = [];
  const zomatoSettlements = [];
  const unrecognised = [];
  const cutoffMs = Date.now() - lookbackHours * 3600 * 1000;

  for (const msg of messages) {
    const receivedMs = Number(msg.internalDate);
    if (!Number.isFinite(receivedMs) || receivedMs < cutoffMs) continue;
    const parsed = classifyMessage(msg);
    if (isReviewKind(parsed)) reviews.push(parsed);
    else if (parsed.kind === 'petpooja') petpoojaReports.push(parsed);
    else if (parsed.kind === 'zomato-weekly') zomatoWeekly.push(parsed);
    else if (parsed.kind === 'zomato-settlement') zomatoSettlements.push(parsed);
    else if (parsed.kind !== 'unknown' && parsed.kind !== 'zomato-other') unrecognised.push(parsed);
  }

  return { reviews, petpoojaReports, zomatoWeekly, zomatoSettlements, fetchFailures, unrecognised };
}

export function formatDigestText({
  reviews,
  petpoojaReports,
  zomatoWeekly = [],
  zomatoSettlements = [],
  fetchFailures = 0,
  unrecognised = [],
  localeTz,
  now = new Date(),
}) {
  const today = now.toLocaleDateString('en-GB', {
    timeZone: localeTz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = formatTimeLabel(now, localeTz);
  const { emoji, slot } = pickDigestSlot(now, localeTz);

  const googleReviews = reviews.filter((r) => r.source !== 'zomato');
  const zomatoReviews = reviews.filter((r) => r.source === 'zomato');
  const googleCount = googleReviews.reduce((sum, r) => sum + r.count, 0);
  const zomatoCount = zomatoReviews.reduce((sum, r) => sum + r.count, 0);

  const lines = [
    `${emoji} <b>Blend N Bubbles — ${slot} Rundown</b>`,
    `${escapeHtml(today)}, ${escapeHtml(timeLabel)} TPE`,
    '',
  ];

  lines.push('<b>⭐ Customer Reviews (last window)</b>');
  if (googleCount + zomatoCount === 0) {
    lines.push('  • No new reviews ✅');
  } else {
    if (googleCount > 0) {
      lines.push(`  • Google: ${formatReviewLine(googleReviews)}`);
      lines.push('    <a href="https://business.google.com/reviews">Reply on Google Business ↗</a>');
    }
    if (zomatoCount > 0) {
      lines.push(`  • Zomato: ${formatReviewLine(zomatoReviews)}`);
      lines.push('    <a href="https://www.zomato.com/business/">Reply on Zomato Business ↗</a>');
    }
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
  lines.push('');

  lines.push('<b>🍽️ Zomato — Business</b>');
  if (zomatoWeekly.length === 0 && zomatoSettlements.length === 0) {
    lines.push('  • No Zomato reports in this window');
  } else {
    for (const report of zomatoWeekly) {
      lines.push(`  • Weekly report: ${escapeHtml(report.title)}`);
      if (report.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(report.snippet, 200))}</i>`);
      }
    }
    for (const settlement of zomatoSettlements) {
      lines.push(`  • Settlement: ${escapeHtml(settlement.title)}`);
      for (const att of settlement.attachments) {
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

function formatReviewLine(reviews) {
  const total = reviews.reduce((sum, r) => sum + r.count, 0);
  const names = reviews
    .filter((r) => r.kind === 'review-single' && r.reviewer)
    .map((r) => r.reviewer);
  const word = total === 1 ? 'review' : 'reviews';
  if (names.length === 0) return `${total} new ${word}`;
  return `${total} new ${word} (from ${names.map(escapeHtml).join(', ')})`;
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '…';
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
  const attachmentSources = [
    ...digestInput.petpoojaReports.map((r) => ({
      messageId: r.messageId,
      captionPrefix: '📊',
      title: r.reportTitle,
      attachments: r.attachments,
    })),
    ...digestInput.zomatoSettlements.map((s) => ({
      messageId: s.messageId,
      captionPrefix: '🍽️',
      title: s.title,
      attachments: s.attachments,
    })),
  ];

  for (const source of attachmentSources) {
    for (const att of source.attachments) {
      if (att.size === 0) {
        attachmentFailures.push({ filename: att.filename, reason: 'zero-byte' });
        continue;
      }
      if (att.size > TELEGRAM_DOCUMENT_BYTE_LIMIT) {
        attachmentFailures.push({ filename: att.filename, reason: 'too-large' });
        continue;
      }
      try {
        const buffer = await fetchAttachmentBytes(gmail, source.messageId, att.attachmentId);
        await telegram.sendDocument({
          filename: att.filename,
          buffer,
          mimeType: att.mimeType,
          caption: `${source.captionPrefix} ${source.title}`,
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
    googleReviewCount: digestInput.reviews
      .filter((r) => r.source !== 'zomato')
      .reduce((sum, r) => sum + r.count, 0),
    zomatoReviewCount: digestInput.reviews
      .filter((r) => r.source === 'zomato')
      .reduce((sum, r) => sum + r.count, 0),
    petpoojaReportCount: digestInput.petpoojaReports.length,
    zomatoWeeklyCount: digestInput.zomatoWeekly.length,
    zomatoSettlementCount: digestInput.zomatoSettlements.length,
    fetchFailures: digestInput.fetchFailures,
    attachmentFailures: attachmentFailures.length,
  };
}

function pickDigestSlot(now, localeTz) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: localeTz,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  const isMorning = Number.isFinite(hour) && hour >= 4 && hour < 16;
  return { emoji: isMorning ? '☀️' : '🌙', slot: isMorning ? 'Morning' : 'Evening' };
}

function formatTimeLabel(now, localeTz) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: localeTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
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
