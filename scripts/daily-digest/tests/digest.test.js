import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDigestText } from '../src/digest.js';
import { loadConfig } from '../src/config.js';

test('formatDigestText produces quiet-day copy when nothing happened', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Blend N Bubbles — Daily Rundown/);
  assert.match(text, /No new reviews today/);
  assert.match(text, /No overnight report yet/);
});

test('formatDigestText counts single and batched reviews together', () => {
  const text = formatDigestText({
    reviews: [
      { kind: 'review', reviewer: 'Sushmita', business: 'Blend n Bubbles', count: 1 },
      { kind: 'review', reviewer: null, business: 'Blend n Bubbles', count: 3 },
    ],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /4 new reviews/);
  assert.match(text, /From: Sushmita/);
});

test('formatDigestText lists PetPooja attachments', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [
      {
        kind: 'petpooja',
        reportTitle: 'Item Wise Report — Barrackpore',
        attachments: [
          { filename: 'Item_bill_report_2026_04_14.xlsx', mimeType: 'xlsx', attachmentId: 'A' },
        ],
        messageId: 'msg1',
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Item Wise Report — Barrackpore/);
  assert.match(text, /Item_bill_report_2026_04_14\.xlsx/);
});

test('loadConfig fails fast when required env vars are missing', () => {
  assert.throws(() => loadConfig({}), /Missing required env vars/);
});

test('loadConfig parses defaults and overrides', () => {
  const config = loadConfig({
    GMAIL_CLIENT_ID: 'a',
    GMAIL_CLIENT_SECRET: 'b',
    GMAIL_REFRESH_TOKEN: 'c',
    TELEGRAM_BOT_TOKEN: 'd',
    TELEGRAM_CHAT_ID: '-123',
    DIGEST_LOOKBACK_HOURS: '48',
  });
  assert.equal(config.lookbackHours, 48);
  assert.equal(config.localeTz, 'Asia/Taipei');
  assert.equal(config.telegram.chatId, '-123');
});
