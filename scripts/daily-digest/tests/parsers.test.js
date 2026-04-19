import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMessage,
  extractAttachments,
  extractEmailAddress,
  extractHeader,
  isReviewKind,
  isSilentKind,
} from '../src/parsers.js';

function makeMessage({ from, subject, parts = [], id = 'msg1', snippet = '' }) {
  return {
    id,
    snippet,
    payload: {
      headers: [
        { name: 'From', value: from },
        { name: 'Subject', value: subject },
      ],
      parts,
    },
  };
}

test('Google review single -> review-single with source google', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '"Google Business Profile" <noreply@business.google.com>',
      subject: 'Sushmita left a review for Blend n Bubbles',
    }),
  );
  assert.equal(parsed.kind, 'review-single');
  assert.equal(parsed.source, 'google');
  assert.equal(parsed.reviewer, 'Sushmita');
});

test('Google review from businessprofile-noreply@google.com -> review-single', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '"Google Business Profile" <businessprofile-noreply@google.com>',
      subject: 'Ashmita left a review for Blend n Bubbles',
    }),
  );
  assert.equal(parsed.kind, 'review-single');
  assert.equal(parsed.source, 'google');
  assert.equal(parsed.reviewer, 'Ashmita');
});

test('GBP photo from businessprofile-noreply@google.com -> gbp-photo', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<businessprofile-noreply@google.com>',
      subject: 'Blend n Bubbles, there’s a new photo on your Business Profile',
    }),
  );
  assert.equal(parsed.kind, 'gbp-photo');
});

test('Google review batch -> review-batch', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@business.google.com>',
      subject: 'Blend n Bubbles, you got 4 new reviews',
    }),
  );
  assert.equal(parsed.kind, 'review-batch');
  assert.equal(parsed.count, 4);
});

test('GBP monthly performance -> gbp-performance with month + snippet', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@business.google.com>',
      subject: 'Blend n Bubbles, your performance report for March 2026',
      snippet: '271 people viewed Blend n Bubbles last month.',
    }),
  );
  assert.equal(parsed.kind, 'gbp-performance');
  assert.equal(parsed.month, 'March 2026');
  assert.match(parsed.snippet, /271 people/);
});

test('GBP new photo -> gbp-photo', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@business.google.com>',
      subject: 'Blend n Bubbles, there’s a new photo on your Business Profile',
    }),
  );
  assert.equal(parsed.kind, 'gbp-photo');
});

test('Google account security alert -> google-security-alert', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '"Google" <no-reply@accounts.google.com>',
      subject: 'Security alert',
      snippet: 'New sign-in on Chrome (Mac)',
    }),
  );
  assert.equal(parsed.kind, 'google-security-alert');
  assert.equal(parsed.title, 'Security alert');
  assert.match(parsed.snippet, /sign-in/);
});

test('PetPooja data retention policy -> petpooja-action', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply-dataretention@petpooja.com>',
      subject: 'Important Update: Petpooja Data Retention Policy - Action Required',
      snippet: 'Please review and acknowledge our updated data retention policy.',
    }),
  );
  assert.equal(parsed.kind, 'petpooja-action');
  assert.match(parsed.title, /Action Required/);
});

test('PetPooja OTP -> silent', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<support@petpooja.com>',
      subject: 'One Time Password (OTP) for your Petpooja account',
    }),
  );
  assert.equal(parsed.kind, 'petpooja-otp');
  assert.equal(isSilentKind(parsed), true);
});

test('Zomato ads growth support -> zomato-ads-growth', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<prioritypartnersupport@zomato.com>',
      subject: 'Zomato Ads – Growth Support | Blend N Bubbles (ID: 21955142)',
      snippet: 'Your ads account manager wants to connect.',
    }),
  );
  assert.equal(parsed.kind, 'zomato-ads-growth');
  assert.match(parsed.title, /Growth Support/);
});

test('PetPooja report with attachments', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<no-reply@petpooja.com>',
      subject: 'Report Notification: Item Wise Report',
      parts: [
        { filename: 'x.xlsx', mimeType: 'x', body: { attachmentId: 'A', size: 10 } },
      ],
    }),
  );
  assert.equal(parsed.kind, 'petpooja');
  assert.equal(parsed.attachments.length, 1);
});

test('Zomato review -> review-single with source zomato', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@zomato.com>',
      subject: '[Zomato] New Review for Blend N Bubbles, Barrackpore by Jayasree Dutta',
    }),
  );
  assert.equal(parsed.kind, 'review-single');
  assert.equal(parsed.source, 'zomato');
  assert.equal(parsed.reviewer, 'Jayasree Dutta');
});

test('Zomato weekly business report with snippet', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<reports@zomato.com>',
      subject: 'Zomato weekly business report - Week 15 (6 to 12 Apr, 2026)',
      snippet: 'Total sales ₹1156 -67% Delivered orders 5',
    }),
  );
  assert.equal(parsed.kind, 'zomato-weekly');
  assert.match(parsed.snippet, /Total sales/);
});

test('Zomato settlement statement with xlsx attachment', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<billing@zomato.com>',
      subject: 'Zomato | Statement of account | BnB 21955142 | 30 Mar to 05 Apr',
      parts: [{ filename: 'soa.xlsx', mimeType: 'x', body: { attachmentId: 'Z', size: 1 } }],
    }),
  );
  assert.equal(parsed.kind, 'zomato-settlement');
  assert.equal(parsed.attachments.length, 1);
});

test('Zomato tax invoice with pdf attachment', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<billing@zomato.com>',
      subject: 'Tax Invoice : Zomato Online Ordering for 2026-03-01 to 2026-03-31',
      parts: [{ filename: 'Z26.pdf', mimeType: 'application/pdf', body: { attachmentId: 'T', size: 1 } }],
    }),
  );
  assert.equal(parsed.kind, 'zomato-tax-invoice');
  assert.match(parsed.title, /Online Ordering/);
  assert.equal(parsed.attachments.length, 1);
});

test('Zomato "switched OFF" alert -> zomato-alert critical', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@zomato.com>',
      subject: 'Online ordering switched OFF for Blend N Bubbles, Barrackpore',
    }),
  );
  assert.equal(parsed.kind, 'zomato-alert');
  assert.equal(parsed.severity, 'critical');
});

test('Zomato "order rejected" -> zomato-alert warning', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@zomato.com>',
      subject: 'Online order rejected at Blend N Bubbles, Barrackpore',
    }),
  );
  assert.equal(parsed.kind, 'zomato-alert');
  assert.equal(parsed.severity, 'warning');
});

test('Zomato "[IMP] Update on your payout" -> zomato-alert info', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@zomato.com>',
      subject: '[IMP] Update on your payout for this week',
    }),
  );
  assert.equal(parsed.kind, 'zomato-alert');
  assert.equal(parsed.severity, 'info');
});

test('Hyperpure "Thank you for your order" -> hyperpure-order placed', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '"Hyperpure by Zomato" <noreply@hyperpure.com>',
      subject: 'Thank you for your order!',
      snippet: 'Order Number: ZHPWB27-OR-0025296424',
    }),
  );
  assert.equal(parsed.kind, 'hyperpure-order');
  assert.equal(parsed.status, 'placed');
  assert.equal(parsed.orderId, 'ZHPWB27-OR-0025296424');
});

test('Hyperpure delivered subject -> hyperpure-order delivered with id', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '"Hyperpure by Zomato" <noreply@hyperpure.com>',
      subject: 'Hyperpure-Blend n Bubbles-Your Order ZHPWB27-OR-0025296424 has been delivered on 09-04-2026',
    }),
  );
  assert.equal(parsed.kind, 'hyperpure-order');
  assert.equal(parsed.status, 'delivered');
  assert.equal(parsed.orderId, 'ZHPWB27-OR-0025296424');
});

test('classifyMessage rejects spoofed Hyperpure sender substrings', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '"Evil" <hyperpure@attacker.com>',
      subject: 'Thank you for your order!',
    }),
  );
  assert.equal(parsed.kind, 'unknown');
});

test('Hyperpure subdomain sender accepted', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@mail.hyperpure.com>',
      subject: 'Thank you for your order!',
      snippet: 'Order Number: ZHPWB27-OR-0001',
    }),
  );
  assert.equal(parsed.kind, 'hyperpure-order');
});

test('parseZomatoWeeklyMetrics handles Indian-format commas, decimals, and unicode minus', async () => {
  const { parseZomatoWeeklyMetrics } = await import('../src/parsers.js');
  const lakhs = parseZomatoWeeklyMetrics(
    'Total sales ₹1,15,000 (+45%) Delivered orders 1,200 +20%',
  );
  assert.equal(lakhs.salesRupees, 115000);
  assert.equal(lakhs.salesDeltaPct, 45);
  assert.equal(lakhs.orders, 1200);
  assert.equal(lakhs.ordersDeltaPct, 20);

  const decimal = parseZomatoWeeklyMetrics('Total sales ₹1,156.50 -67% Delivered orders 5 -58%');
  assert.equal(decimal.salesRupees, 1156.5);
  assert.equal(decimal.salesDeltaPct, -67);

  const unicodeMinus = parseZomatoWeeklyMetrics('Total sales ₹1,156 \u221267% Delivered orders 5 \u221258%');
  assert.equal(unicodeMinus.salesDeltaPct, -67);
  assert.equal(unicodeMinus.ordersDeltaPct, -58);

  const empty = parseZomatoWeeklyMetrics('');
  assert.equal(empty.salesRupees, null);
  assert.equal(empty.orders, null);
});

test('Zomato alert regex covers turned-off / disabled / paused variants', () => {
  const variants = [
    'Online ordering switched OFF for Blend N Bubbles',
    'Your online ordering has been turned off for Blend N Bubbles, Barrackpore',
    'Online ordering disabled for Blend N Bubbles',
    'Online ordering paused for Blend N Bubbles',
  ];
  for (const subject of variants) {
    const parsed = classifyMessage(makeMessage({ from: '<noreply@zomato.com>', subject }));
    assert.equal(parsed.kind, 'zomato-alert', `failed for: ${subject}`);
    assert.equal(parsed.severity, 'critical', `wrong severity for: ${subject}`);
  }
});

test('Unknown Zomato email format surfaces as zomato-other (NOT silent)', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@zomato.com>',
      subject: 'Menu item out of stock notification',
    }),
  );
  assert.equal(parsed.kind, 'zomato-other');
  assert.equal(isSilentKind(parsed), false);
});

test('Title-clamp: a ridiculously long subject is truncated to 200 chars with ellipsis', () => {
  const long = 'Report Notification: ' + 'X'.repeat(500);
  const parsed = classifyMessage(
    makeMessage({
      from: '<no-reply@petpooja.com>',
      subject: long,
    }),
  );
  assert.equal(parsed.kind, 'petpooja');
  assert.ok(parsed.reportTitle.length <= 200, `title length ${parsed.reportTitle.length} exceeds 200`);
  assert.match(parsed.reportTitle, /…$/);
});

test('classifyMessage rejects spoofed Google sender substrings', () => {
  const parsed = classifyMessage(
    makeMessage({
      from: '<noreply@business.google.com.attacker.com>',
      subject: 'Jane left a review for Blend n Bubbles',
    }),
  );
  assert.equal(parsed.kind, 'unknown');
});

test('Unrelated senders -> unknown', () => {
  assert.equal(
    classifyMessage(makeMessage({ from: 'newsletter@random.com', subject: 'x' })).kind,
    'unknown',
  );
});

test('Zomato login alert -> zomato-other (surfaced, NOT silent)', () => {
  // Pre-fix: zomato-other was silenced. Post-fix: it surfaces as unrecognised so
  // a new Zomato email format can be noticed and taught to the parser.
  const parsed = classifyMessage(
    makeMessage({ from: '<noreply@zomato.com>', subject: 'Login Alert for your Zomato account!' }),
  );
  assert.equal(parsed.kind, 'zomato-other');
  assert.equal(isSilentKind(parsed), false);
});

test('isReviewKind and isSilentKind discriminate correctly', () => {
  assert.equal(isReviewKind({ kind: 'review-single' }), true);
  assert.equal(isReviewKind({ kind: 'review-batch' }), true);
  assert.equal(isReviewKind({ kind: 'zomato-alert' }), false);
  // Only 'unknown' (unrelated senders entirely) is silent. '*-other' kinds
  // surface so unfamiliar email formats from trusted senders are visible.
  assert.equal(isSilentKind({ kind: 'unknown' }), true);
  assert.equal(isSilentKind({ kind: 'gbp-other' }), false);
  assert.equal(isSilentKind({ kind: 'hyperpure-other' }), false);
  assert.equal(isSilentKind({ kind: 'zomato-other' }), false);
  assert.equal(isSilentKind({ kind: 'zomato-alert' }), false);
});

test('extractAttachments recurses through nested multipart', () => {
  const msg = {
    payload: {
      parts: [
        { mimeType: 'text/plain', filename: '', body: {} },
        { mimeType: 'application/pdf', filename: 'r.pdf', body: { attachmentId: 'A', size: 1 } },
      ],
    },
  };
  assert.equal(extractAttachments(msg).length, 1);
});

test('extractEmailAddress and extractHeader helpers', () => {
  assert.equal(
    extractEmailAddress('"X" <a@b.com>'),
    'a@b.com',
  );
  assert.equal(extractHeader({}, 'From'), '');
});
