import {
  createGmailClient,
  searchMessages,
  fetchMessage,
  fetchAttachmentBytes,
  isInvalidGrantError,
} from './gmail.js';
import { classifyMessage, isReviewKind, isSilentKind } from './parsers.js';
import { parseItemWiseSalesReport, summariseForDigest } from './petpooja-report.js';
import { createSeenStore } from './seen-store.js';
import { TelegramClient } from './telegram.js';

const TELEGRAM_DOCUMENT_BYTE_LIMIT = 50 * 1024 * 1024;
const ALERT_ICONS = Object.freeze({
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
});

// Broad Gmail search that catches every sender/subject pattern the parsers know about.
// The parsers do the final classification; this query just reduces the result set.
const GMAIL_SEARCH_QUERY = [
  '(',
  'from:(noreply@business.google.com OR googlecommunityteam-noreply@google.com OR business-profile-noreply@google.com OR businessprofile-noreply@google.com)',
  ')',
  'OR (from:no-reply@accounts.google.com)',
  'OR (from:petpooja.com)',
  'OR (from:zomato.com)',
  'OR (from:hyperpure)',
].join(' ');

export async function fetchPetpoojaToday({ url, token } = {}, { fetchImpl = fetch } = {}) {
  if (!url || !token) {
    console.warn('petpoojaWebhook not configured — live-sales line omitted');
    return { ok: false, reason: 'not-configured' };
  }
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/petpooja-today`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const reason = `HTTP ${res.status}`;
      console.warn(`petpooja-today fetch failed: ${reason}`);
      return { ok: false, reason };
    }
    const data = await res.json();
    if (!data?.ok) return { ok: false, reason: 'body-not-ok' };
    return {
      ok: true,
      date: data.date,
      orderCount: data.orderCount,
      totalRupees: data.totalRupees,
      rejectedCount: data.rejectedCount,
    };
  } catch (err) {
    const reason = err?.message ?? 'fetch-threw';
    console.warn('petpooja-today fetch threw:', reason);
    return { ok: false, reason };
  }
}

export async function buildDigest({ gmail, lookbackHours }) {
  const query = `(${GMAIL_SEARCH_QUERY}) newer_than:${Math.max(1, Math.ceil(lookbackHours / 24))}d`;
  const stubs = await searchMessages(gmail, query);
  const fetches = await Promise.allSettled(stubs.map((s) => fetchMessage(gmail, s.id)));
  const messages = fetches
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  const rejected = fetches.filter((r) => r.status === 'rejected');
  for (const r of rejected) {
    console.warn('fetchMessage failed:', r.reason?.message ?? r.reason);
  }
  const fetchFailures = rejected.length;

  const reviews = [];
  const petpoojaReports = [];
  const petpoojaActions = [];
  const zomatoWeekly = [];
  const zomatoSettlements = [];
  const zomatoTaxInvoices = [];
  const zomatoAlerts = [];
  const zomatoAdsGrowth = [];
  const gbpPhotos = [];
  const gbpPerformance = [];
  const hyperpureOrders = [];
  const googleSecurityAlerts = [];
  const unrecognised = [];
  const cutoffMs = Date.now() - lookbackHours * 3600 * 1000;

  for (const msg of messages) {
    const receivedMs = Number(msg.internalDate);
    if (!Number.isFinite(receivedMs) || receivedMs < cutoffMs) continue;
    const parsed = classifyMessage(msg);
    if (isReviewKind(parsed)) reviews.push(parsed);
    else if (parsed.kind === 'petpooja') petpoojaReports.push(parsed);
    else if (parsed.kind === 'petpooja-action') petpoojaActions.push(parsed);
    else if (parsed.kind === 'zomato-weekly') zomatoWeekly.push(parsed);
    else if (parsed.kind === 'zomato-settlement') zomatoSettlements.push(parsed);
    else if (parsed.kind === 'zomato-tax-invoice') zomatoTaxInvoices.push(parsed);
    else if (parsed.kind === 'zomato-alert') zomatoAlerts.push(parsed);
    else if (parsed.kind === 'zomato-ads-growth') zomatoAdsGrowth.push(parsed);
    else if (parsed.kind === 'gbp-photo') gbpPhotos.push(parsed);
    else if (parsed.kind === 'gbp-performance') gbpPerformance.push(parsed);
    else if (parsed.kind === 'hyperpure-order') hyperpureOrders.push(parsed);
    else if (parsed.kind === 'google-security-alert') googleSecurityAlerts.push(parsed);
    else if (!isSilentKind(parsed)) unrecognised.push(parsed);
  }

  return {
    reviews,
    petpoojaReports,
    petpoojaActions,
    zomatoWeekly,
    zomatoSettlements,
    zomatoTaxInvoices,
    zomatoAlerts,
    zomatoAdsGrowth,
    gbpPhotos,
    gbpPerformance,
    hyperpureOrders,
    googleSecurityAlerts,
    fetchFailures,
    unrecognised,
  };
}

export function formatDigestText({
  reviews,
  petpoojaReports,
  petpoojaActions = [],
  zomatoWeekly = [],
  zomatoSettlements = [],
  zomatoTaxInvoices = [],
  zomatoAlerts = [],
  zomatoAdsGrowth = [],
  gbpPhotos = [],
  gbpPerformance = [],
  hyperpureOrders = [],
  googleSecurityAlerts = [],
  petpoojaLive = null,
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

  const showWeeklyTrend = isSundayEvening(now, localeTz);
  const weeklyWithMetrics = zomatoWeekly.find((w) => hasMetrics(w.metrics));
  if (showWeeklyTrend && weeklyWithMetrics) {
    lines.push('<b>📈 Weekly Trend — this week vs last</b>');
    const m = weeklyWithMetrics.metrics;
    if (m.salesRupees != null) {
      lines.push(
        `  • Sales: ₹${m.salesRupees.toLocaleString('en-IN')} ${formatDelta(m.salesDeltaPct)}`,
      );
    }
    if (m.orders != null) {
      lines.push(`  • Delivered orders: ${m.orders} ${formatDelta(m.ordersDeltaPct)}`);
    }
    lines.push(`  • Week: ${escapeHtml(weeklyWithMetrics.title)}`);
    lines.push('');
  }

  if (googleSecurityAlerts.length > 0 || petpoojaActions.length > 0) {
    lines.push('<b>🔐 Action Required</b>');
    for (const alert of googleSecurityAlerts) {
      lines.push(`  • 🚨 Google account: ${escapeHtml(alert.title)}`);
      if (alert.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(alert.snippet, 200))}</i>`);
      }
    }
    for (const action of petpoojaActions) {
      lines.push(`  • 📣 PetPooja: ${escapeHtml(action.title)}`);
      if (action.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(action.snippet, 200))}</i>`);
      }
    }
    lines.push('');
  }

  if (zomatoAlerts.length > 0) {
    lines.push('<b>⚠️ Urgent Alerts — act now</b>');
    for (const alert of zomatoAlerts) {
      const icon = ALERT_ICONS[alert.severity] ?? 'ℹ️';
      lines.push(`  • ${icon} ${escapeHtml(alert.title)}`);
      if (alert.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(alert.snippet, 200))}</i>`);
      }
    }
    // Only emit the action link when something truly requires manual intervention on Zomato Business.
    // Pure info alerts (e.g. payout timing) do not.
    const needsAction = zomatoAlerts.some((a) => a.severity !== 'info');
    if (needsAction) {
      lines.push('    <a href="https://www.zomato.com/business/">Open Zomato Business ↗</a>');
    }
    lines.push('');
  }

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
  if (petpoojaLive?.ok) {
    const rupees = (petpoojaLive.totalRupees ?? 0).toLocaleString('en-IN');
    lines.push(
      `  • 💰 Today (live): ₹${rupees} from ${petpoojaLive.orderCount} orders` +
        (petpoojaLive.rejectedCount ? ` (${petpoojaLive.rejectedCount} rejected)` : ''),
    );
  } else if (petpoojaLive && petpoojaLive.reason !== 'not-configured') {
    lines.push(`  • ⚠️ Live feed unavailable (${escapeHtml(petpoojaLive.reason)})`);
  }
  if (petpoojaReports.length === 0) {
    if (!petpoojaLive?.ok) lines.push('  • No overnight report yet — check again later');
  } else {
    for (const report of petpoojaReports) {
      lines.push(`  • ${escapeHtml(report.reportTitle)}`);
      if (report.summary) {
        const s = report.summary;
        if (s.totalRevenue != null && s.totalOrders != null) {
          const billPart = s.billCount ? ` across ${s.billCount} bills` : '';
          lines.push(
            `    💰 ₹${s.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • ${s.totalOrders} items sold${billPart}`,
          );
        }
        if (s.topItems.length > 0) {
          lines.push('    🏆 Top drinks:');
          for (const item of s.topItems) {
            lines.push(`      ${escapeHtml(item.name)} × ${item.qty}`);
          }
        }
        if (s.topCategories.length > 0) {
          const tops = s.topCategories
            .map((c) => `${escapeHtml(c.name)} ₹${Math.round(c.total).toLocaleString('en-IN')}`)
            .join(', ');
          lines.push(`    📂 By category: ${tops}`);
        }
      } else if (report.summaryError) {
        lines.push(`    ⚠️ Could not parse xlsx: ${escapeHtml(report.summaryError)}`);
      }
      for (const att of report.attachments) {
        lines.push(`  • 📎 ${escapeHtml(att.filename)}`);
      }
    }
  }
  lines.push('');

  lines.push('<b>🍽️ Zomato — Business</b>');
  if (
    zomatoWeekly.length === 0 &&
    zomatoSettlements.length === 0 &&
    zomatoTaxInvoices.length === 0 &&
    zomatoAdsGrowth.length === 0
  ) {
    lines.push('  • No Zomato reports in this window');
  } else {
    for (const report of zomatoWeekly) {
      lines.push(`  • Weekly report: ${escapeHtml(report.title)}`);
      if (report.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(report.snippet, 400))}</i>`);
      }
    }
    for (const settlement of zomatoSettlements) {
      lines.push(`  • Settlement: ${escapeHtml(settlement.title)}`);
      for (const att of settlement.attachments) {
        lines.push(`  • 📎 ${escapeHtml(att.filename)}`);
      }
    }
    for (const invoice of zomatoTaxInvoices) {
      lines.push(`  • Tax invoice: ${escapeHtml(invoice.title)}`);
      if (invoice.attachments.length === 0) {
        lines.push('    ⚠️ No PDF attached — open the email in Gmail to retrieve it');
      }
      for (const att of invoice.attachments) {
        lines.push(`  • 📎 ${escapeHtml(att.filename)}`);
      }
    }
    for (const ads of zomatoAdsGrowth) {
      lines.push(`  • 📣 Ads growth: ${escapeHtml(ads.title)}`);
      if (ads.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(ads.snippet, 200))}</i>`);
      }
    }
  }
  lines.push('');

  lines.push('<b>📈 Google Business Profile</b>');
  if (gbpPhotos.length === 0 && gbpPerformance.length === 0) {
    lines.push('  • No GBP updates in this window');
  } else {
    for (const perf of gbpPerformance) {
      lines.push(`  • 📊 Monthly performance — ${escapeHtml(perf.month)}`);
      if (perf.snippet) {
        lines.push(`    <i>${escapeHtml(truncate(perf.snippet, 300))}</i>`);
      }
    }
    if (gbpPhotos.length > 0) {
      lines.push(`  • 📸 ${gbpPhotos.length} new customer photo${gbpPhotos.length === 1 ? '' : 's'}`);
      lines.push(
        '    <a href="https://business.google.com/photos">View on Google Business ↗</a>',
      );
    }
  }
  lines.push('');

  lines.push('<b>📦 Hyperpure Supplies</b>');
  if (hyperpureOrders.length === 0) {
    lines.push('  • No Hyperpure activity in this window');
  } else {
    for (const order of hyperpureOrders) {
      const icon = order.status === 'delivered' ? '✅' : '🛒';
      const label = order.status === 'delivered' ? 'Delivered' : 'Placed';
      const idSegment = order.orderId ? ` — ${escapeHtml(order.orderId)}` : '';
      lines.push(`  • ${icon} ${label}${idSegment}`);
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
  const seenStore = deps.seenStore ?? createSeenStore(config.seenStore ?? {});

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
        .catch((alertErr) => {
          console.error('Failed to send invalid_grant alert to Telegram:', alertErr?.message ?? alertErr);
        });
    }
    throw err;
  }

  // Dedupe reviews against the seen-store. Reviews with a messageId already
  // marked seen are dropped so we don't re-notify about something the user has
  // likely already actioned. Reviews without a messageId always pass through.
  const reviewMessageIds = digestInput.reviews
    .map((r) => r.messageId)
    .filter((id) => typeof id === 'string' && id.length > 0);
  const seenIdSet = await seenStore.check(reviewMessageIds);
  const dedupedReviews = digestInput.reviews.filter(
    (r) => !r.messageId || !seenIdSet.has(r.messageId),
  );
  const suppressedReviewCount = digestInput.reviews.length - dedupedReviews.length;
  digestInput.reviews = dedupedReviews;

  const petpoojaLive = await fetchPetpoojaToday(config.petpoojaWebhook ?? {});

  // Parse PetPooja xlsx attachments up-front so the summary can land in the
  // main digest text BEFORE the attachment itself is forwarded. On failure
  // the report carries a human-readable summaryError that the formatter
  // surfaces in the Telegram message — never silently drop.
  const attachmentBuffers = new Map();
  for (const report of digestInput.petpoojaReports) {
    for (const att of report.attachments) {
      if (!isParseableReport(att)) continue;
      try {
        const buffer = await fetchAttachmentBytes(gmail, report.messageId, att.attachmentId);
        attachmentBuffers.set(att.attachmentId, { buffer, mimeType: att.mimeType, filename: att.filename });
        report.summary = summariseForDigest(await parseItemWiseSalesReport(buffer));
      } catch (err) {
        const reason = err?.message ?? String(err);
        console.warn('PetPooja xlsx parse failed:', reason);
        report.summaryError = reason;
      }
    }
  }

  const text = formatDigestText({
    ...digestInput,
    petpoojaLive,
    localeTz: config.localeTz,
  });
  await telegram.sendMessage(text);

  // Only mark after the Telegram send succeeds — if send failed we still want
  // these reviews to surface on the next run. Ignore the mark return value:
  // mark-failures are logged inside seen-store and should not fail the digest.
  const newlySurfacedReviewIds = dedupedReviews
    .map((r) => r.messageId)
    .filter((id) => typeof id === 'string' && id.length > 0);
  if (newlySurfacedReviewIds.length > 0) {
    await seenStore.mark(newlySurfacedReviewIds);
  }

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
    ...digestInput.zomatoTaxInvoices.map((i) => ({
      messageId: i.messageId,
      captionPrefix: '🧾',
      title: i.title,
      attachments: i.attachments,
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
        // Reuse the buffer we already fetched for summary parsing (PetPooja case).
        const cached = attachmentBuffers.get(att.attachmentId);
        const buffer = cached?.buffer ?? await fetchAttachmentBytes(gmail, source.messageId, att.attachmentId);
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
    await telegram.sendMessage(lines.join('\n')).catch((warnErr) => {
      console.error('Failed to send attachment-failure notice:', warnErr?.message ?? warnErr);
    });
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
    petpoojaActionCount: digestInput.petpoojaActions.length,
    zomatoWeeklyCount: digestInput.zomatoWeekly.length,
    zomatoSettlementCount: digestInput.zomatoSettlements.length,
    zomatoTaxInvoiceCount: digestInput.zomatoTaxInvoices.length,
    zomatoAlertCount: digestInput.zomatoAlerts.length,
    zomatoAdsGrowthCount: digestInput.zomatoAdsGrowth.length,
    gbpPhotoCount: digestInput.gbpPhotos.length,
    gbpPerformanceCount: digestInput.gbpPerformance.length,
    hyperpureOrderCount: digestInput.hyperpureOrders.length,
    googleSecurityAlertCount: digestInput.googleSecurityAlerts.length,
    suppressedReviewCount,
    fetchFailures: digestInput.fetchFailures,
    attachmentFailures: attachmentFailures.length,
    petpoojaLive: petpoojaLive
      ? { orderCount: petpoojaLive.orderCount, totalRupees: petpoojaLive.totalRupees }
      : null,
  };
}

function isSundayEvening(now, localeTz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: localeTz,
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    return weekday === 'Sun' && Number.isFinite(hour) && hour >= 16;
  } catch (err) {
    console.warn(`isSundayEvening: invalid timeZone "${localeTz}"`);
    return false;
  }
}

function hasMetrics(metrics) {
  if (!metrics) return false;
  return metrics.salesRupees != null || metrics.orders != null;
}

function formatDelta(pct) {
  if (pct == null) return '';
  const sign = pct > 0 ? '+' : '';
  const arrow = pct > 0 ? '🔺' : pct < 0 ? '🔻' : '➖';
  return `(${sign}${pct}% ${arrow} vs last week)`;
}

function isParseableReport(att) {
  const filename = (att.filename ?? '').toLowerCase();
  return filename.endsWith('.xlsx');
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
