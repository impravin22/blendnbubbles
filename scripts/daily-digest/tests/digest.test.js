import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDigestText, runDigest, escapeHtml } from '../src/digest.js';
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

test('formatDigestText aggregates single + batched review counts', () => {
  const text = formatDigestText({
    reviews: [
      { kind: 'review-single', reviewer: 'Sushmita', business: 'Blend n Bubbles', count: 1 },
      { kind: 'review-batch', business: 'Blend n Bubbles', count: 3 },
    ],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /4 new reviews/);
  assert.match(text, /From: Sushmita/);
});

test('formatDigestText pluralises exactly one review correctly', () => {
  const text = formatDigestText({
    reviews: [{ kind: 'review-single', reviewer: 'Amit', business: 'x', count: 1 }],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /1 new review\b/);
  assert.doesNotMatch(text, /1 new reviews/);
});

test('formatDigestText escapes HTML-unsafe reviewer and filename content', () => {
  const text = formatDigestText({
    reviews: [
      { kind: 'review-single', reviewer: '<script>', business: 'x', count: 1 },
    ],
    petpoojaReports: [
      {
        kind: 'petpooja',
        reportTitle: 'Report "A" & B',
        attachments: [
          { filename: 'evil<name>.xlsx', mimeType: 'x', attachmentId: 'a', size: 1 },
        ],
        messageId: 'm',
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.doesNotMatch(text, /<script>/);
  assert.match(text, /&lt;script&gt;/);
  assert.match(text, /Report &quot;A&quot; &amp; B/);
  assert.match(text, /evil&lt;name&gt;\.xlsx/);
});

test('formatDigestText surfaces fetchFailures and unrecognised counts', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    fetchFailures: 2,
    unrecognised: [{ kind: 'review-unrecognised', subject: 'x' }],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /2 Gmail message/);
  assert.match(text, /1 message.*could not be parsed/);
});

test('runDigest calls sendMessage before sendDocument, once per attachment', async () => {
  const order = [];
  const fakeGmail = {
    users: {
      messages: {
        list: async () => ({ data: { messages: [{ id: 'm1' }] } }),
        get: async () => ({
          data: {
            id: 'm1',
            internalDate: String(Date.now() - 3600_000),
            payload: {
              headers: [
                { name: 'From', value: '<no-reply@petpooja.com>' },
                { name: 'Subject', value: 'Report Notification: Item Wise' },
              ],
              parts: [
                {
                  filename: 'a.xlsx',
                  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  body: { attachmentId: 'A1', size: 1024 },
                },
                {
                  filename: 'b.xlsx',
                  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  body: { attachmentId: 'A2', size: 2048 },
                },
              ],
            },
          },
        }),
        attachments: {
          get: async () => ({ data: { data: Buffer.from('hello').toString('base64url') } }),
        },
      },
    },
  };
  const fakeTelegram = {
    sendMessage: async (text) => {
      order.push({ call: 'sendMessage', text });
      return { message_id: 1 };
    },
    sendDocument: async ({ filename }) => {
      order.push({ call: 'sendDocument', filename });
      return { message_id: 2 };
    },
  };
  const config = {
    gmail: {},
    telegram: {},
    lookbackHours: 24,
    localeTz: 'Asia/Taipei',
  };
  const summary = await runDigest({
    config,
    deps: { gmail: fakeGmail, telegram: fakeTelegram },
  });
  assert.equal(order[0].call, 'sendMessage');
  assert.equal(order[1].call, 'sendDocument');
  assert.equal(order[1].filename, 'a.xlsx');
  assert.equal(order[2].filename, 'b.xlsx');
  assert.equal(summary.reportCount, 1);
  assert.equal(summary.attachmentFailures, 0);
});

test('runDigest skips zero-byte and >50MB attachments with failure notice', async () => {
  const calls = [];
  const fakeGmail = {
    users: {
      messages: {
        list: async () => ({ data: { messages: [{ id: 'm1' }] } }),
        get: async () => ({
          data: {
            id: 'm1',
            internalDate: String(Date.now() - 3600_000),
            payload: {
              headers: [
                { name: 'From', value: '<no-reply@petpooja.com>' },
                { name: 'Subject', value: 'Report Notification: Item' },
              ],
              parts: [
                { filename: 'empty.xlsx', mimeType: 'x', body: { attachmentId: 'E', size: 0 } },
                { filename: 'huge.xlsx', mimeType: 'x', body: { attachmentId: 'H', size: 100 * 1024 * 1024 } },
              ],
            },
          },
        }),
        attachments: { get: async () => ({ data: { data: '' } }) },
      },
    },
  };
  const fakeTelegram = {
    sendMessage: async (text) => {
      calls.push({ call: 'sendMessage', text });
      return {};
    },
    sendDocument: async () => {
      calls.push({ call: 'sendDocument' });
      return {};
    },
  };
  const summary = await runDigest({
    config: { gmail: {}, telegram: {}, lookbackHours: 24, localeTz: 'Asia/Taipei' },
    deps: { gmail: fakeGmail, telegram: fakeTelegram },
  });
  assert.equal(calls.filter((c) => c.call === 'sendDocument').length, 0);
  assert.equal(summary.attachmentFailures, 2);
  const warnMsg = calls.find((c) => c.call === 'sendMessage' && c.text.includes('Some attachments'));
  assert.ok(warnMsg, 'warning message should be sent');
  assert.match(warnMsg.text, /empty\.xlsx.*zero-byte/s);
  assert.match(warnMsg.text, /huge\.xlsx.*too-large/s);
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

test('loadConfig rejects non-finite or non-positive DIGEST_LOOKBACK_HOURS', () => {
  const base = {
    GMAIL_CLIENT_ID: 'a',
    GMAIL_CLIENT_SECRET: 'b',
    GMAIL_REFRESH_TOKEN: 'c',
    TELEGRAM_BOT_TOKEN: 'd',
    TELEGRAM_CHAT_ID: '-1',
  };
  assert.throws(() => loadConfig({ ...base, DIGEST_LOOKBACK_HOURS: 'abc' }), /positive finite/);
  assert.throws(() => loadConfig({ ...base, DIGEST_LOOKBACK_HOURS: '-5' }), /positive finite/);
  assert.throws(() => loadConfig({ ...base, DIGEST_LOOKBACK_HOURS: '0' }), /positive finite/);
});

test('escapeHtml escapes all five HTML-unsafe characters', () => {
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(escapeHtml('plain'), 'plain');
});
