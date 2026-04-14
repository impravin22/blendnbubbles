import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReview,
  parsePetPooja,
  classifyMessage,
  extractAttachments,
} from '../src/parsers.js';

function makeMessage({ from, subject, parts = [] }) {
  return {
    id: 'msg1',
    payload: {
      headers: [
        { name: 'From', value: from },
        { name: 'Subject', value: subject },
      ],
      parts,
    },
  };
}

test('parseReview extracts single reviewer and business', () => {
  const parsed = parseReview('Sushmita left a review for Blend n Bubbles');
  assert.deepEqual(parsed, {
    kind: 'review',
    reviewer: 'Sushmita',
    business: 'Blend n Bubbles',
    count: 1,
  });
});

test('parseReview handles batched review digest subjects', () => {
  const parsed = parseReview('Blend n Bubbles, you got 4 new reviews');
  assert.deepEqual(parsed, {
    kind: 'review',
    reviewer: null,
    business: 'Blend n Bubbles',
    count: 4,
  });
});

test('parseReview returns unrecognised for unexpected subjects', () => {
  const parsed = parseReview('Google Business Profile update');
  assert.equal(parsed.kind, 'review-unrecognised');
});

test('classifyMessage detects Google review sender', () => {
  const msg = makeMessage({
    from: '"Google Business Profile" <noreply@business.google.com>',
    subject: 'Rajat left a review for Blend n Bubbles',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'review');
  assert.equal(parsed.reviewer, 'Rajat');
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

test('parsePetPooja rejects unrelated subject formats', () => {
  const msg = makeMessage({
    from: 'petpooja billing <billing@petpooja.com>',
    subject: 'One Time Password (OTP) for your Petpooja account',
  });
  const parsed = classifyMessage(msg);
  assert.equal(parsed.kind, 'petpooja-unrecognised');
});
