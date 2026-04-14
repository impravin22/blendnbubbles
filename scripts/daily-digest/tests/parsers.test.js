import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReview,
  classifyMessage,
  extractAttachments,
  extractEmailAddress,
  extractHeader,
  isReviewKind,
} from '../src/parsers.js';

function makeMessage({ from, subject, parts = [], id = 'msg1' }) {
  return {
    id,
    payload: {
      headers: [
        { name: 'From', value: from },
        { name: 'Subject', value: subject },
      ],
      parts,
    },
  };
}

test('parseReview extracts single reviewer as review-single', () => {
  const parsed = parseReview({ subject: 'Sushmita left a review for Blend n Bubbles' });
  assert.deepEqual(parsed, {
    kind: 'review-single',
    reviewer: 'Sushmita',
    business: 'Blend n Bubbles',
    count: 1,
  });
});

test('parseReview handles batched digest subjects as review-batch', () => {
  const parsed = parseReview({ subject: 'Blend n Bubbles, you got 4 new reviews' });
  assert.deepEqual(parsed, {
    kind: 'review-batch',
    business: 'Blend n Bubbles',
    count: 4,
  });
});

test('parseReview returns review-unrecognised with context for unexpected subjects', () => {
  const parsed = parseReview({
    subject: 'Google Business Profile update',
    from: 'noreply@business.google.com',
    messageId: 'abc123',
  });
  assert.equal(parsed.kind, 'review-unrecognised');
  assert.equal(parsed.subject, 'Google Business Profile update');
  assert.equal(parsed.from, 'noreply@business.google.com');
  assert.equal(parsed.messageId, 'abc123');
});

test('classifyMessage detects Google review sender from angle-bracket From header', () => {
  const msg = makeMessage({
    from: '"Google Business Profile" <noreply@business.google.com>',
    subject: 'Rajat left a review for Blend n Bubbles',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'review-single');
  assert.equal(parsed.reviewer, 'Rajat');
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
        filename: 'Item_bill_report_2026_04_14_01_38_27.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: { attachmentId: 'ATT123', size: 10000 },
      },
    ],
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'petpooja');
  assert.equal(
    parsed.reportTitle,
    'Item Wise Report With Bill No. : Blend N Bubbles [Barrackpore Branch]',
  );
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].filename, 'Item_bill_report_2026_04_14_01_38_27.xlsx');
});

test('classifyMessage returns unknown for unrelated senders', () => {
  const msg = makeMessage({
    from: 'newsletter@randomsite.com',
    subject: 'Weekly digest',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'unknown');
});

test('extractAttachments traverses nested multipart MIME tree', () => {
  const message = {
    payload: {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', filename: '', body: {} },
            { mimeType: 'text/html', filename: '', body: {} },
          ],
        },
        {
          mimeType: 'application/pdf',
          filename: 'report.pdf',
          body: { attachmentId: 'ATT-PDF', size: 2048 },
        },
      ],
    },
  };
  const atts = extractAttachments(message);
  assert.equal(atts.length, 1);
  assert.equal(atts[0].filename, 'report.pdf');
});

test('PetPooja OTP subjects classify as petpooja-unrecognised', () => {
  const msg = makeMessage({
    from: 'petpooja billing <billing@petpooja.com>',
    subject: 'One Time Password (OTP) for your Petpooja account',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'petpooja-unrecognised');
});

test('extractEmailAddress handles angle brackets and plain addresses', () => {
  assert.equal(
    extractEmailAddress('"Google Business Profile" <noreply@business.google.com>'),
    'noreply@business.google.com',
  );
  assert.equal(extractEmailAddress('noreply@business.google.com'), 'noreply@business.google.com');
  assert.equal(extractEmailAddress(' UPPER@EXAMPLE.COM '), 'upper@example.com');
});

test('extractHeader returns empty string for missing or malformed headers', () => {
  assert.equal(extractHeader({}, 'From'), '');
  assert.equal(extractHeader({ payload: { headers: [null, { name: 'From', value: 'x' }] } }, 'From'), 'x');
});

test('isReviewKind discriminates both single and batch shapes', () => {
  assert.equal(isReviewKind({ kind: 'review-single' }), true);
  assert.equal(isReviewKind({ kind: 'review-batch' }), true);
  assert.equal(isReviewKind({ kind: 'petpooja' }), false);
  assert.equal(isReviewKind({ kind: 'unknown' }), false);
});
