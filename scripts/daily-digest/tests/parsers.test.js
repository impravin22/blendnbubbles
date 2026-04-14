import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGoogleReview,
  parseZomato,
  classifyMessage,
  extractAttachments,
  extractEmailAddress,
  extractHeader,
  isReviewKind,
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

test('parseGoogleReview single emits review-single with source google', () => {
  const parsed = parseGoogleReview({ subject: 'Sushmita left a review for Blend n Bubbles' });
  assert.deepEqual(parsed, {
    kind: 'review-single',
    source: 'google',
    reviewer: 'Sushmita',
    business: 'Blend n Bubbles',
    count: 1,
  });
});

test('parseGoogleReview batch emits review-batch with source google', () => {
  const parsed = parseGoogleReview({ subject: 'Blend n Bubbles, you got 4 new reviews' });
  assert.deepEqual(parsed, {
    kind: 'review-batch',
    source: 'google',
    business: 'Blend n Bubbles',
    count: 4,
  });
});

test('parseZomato detects new customer reviews as review-single with source zomato', () => {
  const msg = makeMessage({
    from: '"Zomato" <noreply@zomato.com>',
    subject: '[Zomato] New Review for Blend N Bubbles, Barrackpore by Jayasree Dutta',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'review-single');
  assert.equal(parsed.source, 'zomato');
  assert.equal(parsed.reviewer, 'Jayasree Dutta');
  assert.equal(parsed.business, 'Blend N Bubbles, Barrackpore');
});

test('parseZomato detects weekly business reports with title and snippet', () => {
  const msg = makeMessage({
    from: '"Zomato business reports" <reports@zomato.com>',
    subject: 'Zomato weekly business report - Week 15 (6 to 12 Apr, 2026)',
    snippet: 'Week: 15 (6 to 12 Apr, 2026) Restaurant Name: Blend N Bubbles, ID - 21955142',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'zomato-weekly');
  assert.equal(parsed.title, 'Week 15 (6 to 12 Apr, 2026)');
  assert.match(parsed.snippet, /Week: 15/);
});

test('parseZomato detects settlement statements with xlsx attachment', () => {
  const msg = makeMessage({
    from: '"Zomato Billing" <billing@zomato.com>',
    subject: 'Zomato | Statement of account | Blend N Bubbles 21955142 | 30 Mar 2026 to 05 Apr 2026',
    parts: [
      {
        filename: 'Zomato_Settlement_Report_21955142_30_Mar_2026_05_Apr_2026.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: { attachmentId: 'ZATT1', size: 20000 },
      },
    ],
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'zomato-settlement');
  assert.equal(parsed.attachments.length, 1);
  assert.match(parsed.title, /Blend N Bubbles 21955142/);
});

test('classifyMessage rejects spoofed substring senders (strict domain match)', () => {
  const msg = makeMessage({
    from: '"Attacker" <noreply@business.google.com.attacker.com>',
    subject: 'Jane left a review for Blend n Bubbles',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'unknown');
});

test('classifyMessage detects PetPooja sender and report title', () => {
  const msg = makeMessage({
    from: 'Petpooja <no-reply@petpooja.com>',
    subject: 'Report Notification: Item Wise Report With Bill No. : Blend N Bubbles [Barrackpore Branch]',
    parts: [
      {
        filename: 'Item_bill_report.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: { attachmentId: 'ATT123', size: 10000 },
      },
    ],
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'petpooja');
  assert.equal(parsed.attachments.length, 1);
});

test('classifyMessage returns unknown for unrelated senders', () => {
  const msg = makeMessage({ from: 'newsletter@randomsite.com', subject: 'Weekly digest' });
  assert.equal(classifyMessage(msg).kind, 'unknown');
});

test('Zomato alerts and admin emails classify as zomato-other (not forwarded, not flagged)', () => {
  const msg = makeMessage({
    from: '"Zomato" <noreply@zomato.com>',
    subject: 'Online ordering switched OFF for Blend N Bubbles, Barrackpore',
  });
  assert.equal(classifyMessage(msg).kind, 'zomato-other');
});

test('extractAttachments traverses nested multipart MIME tree', () => {
  const message = {
    payload: {
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', filename: '', body: {} },
        { mimeType: 'application/pdf', filename: 'r.pdf', body: { attachmentId: 'A', size: 1 } },
      ],
    },
  };
  assert.equal(extractAttachments(message).length, 1);
});

test('PetPooja OTP subjects classify as petpooja-unrecognised', () => {
  const msg = makeMessage({
    from: 'petpooja billing <billing@petpooja.com>',
    subject: 'One Time Password (OTP) for your Petpooja account',
  });
  assert.equal(classifyMessage(msg).kind, 'petpooja-unrecognised');
});

test('extractEmailAddress handles angle brackets and plain addresses', () => {
  assert.equal(
    extractEmailAddress('"Google Business Profile" <noreply@business.google.com>'),
    'noreply@business.google.com',
  );
  assert.equal(extractEmailAddress('noreply@business.google.com'), 'noreply@business.google.com');
});

test('extractHeader returns empty string for missing headers', () => {
  assert.equal(extractHeader({}, 'From'), '');
});

test('isReviewKind discriminates review shapes from report shapes', () => {
  assert.equal(isReviewKind({ kind: 'review-single' }), true);
  assert.equal(isReviewKind({ kind: 'review-batch' }), true);
  assert.equal(isReviewKind({ kind: 'petpooja' }), false);
  assert.equal(isReviewKind({ kind: 'zomato-weekly' }), false);
  assert.equal(isReviewKind({ kind: 'zomato-settlement' }), false);
});
