import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDigestText, runDigest, escapeHtml } from '../src/digest.js';
import { loadConfig } from '../src/config.js';

test('formatDigestText produces quiet-day copy when nothing happened', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoWeekly: [],
    zomatoSettlements: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Blend N Bubbles — (Morning|Evening) Rundown/);
  assert.match(text, /No new reviews/);
  assert.match(text, /No overnight report yet/);
  assert.match(text, /No Zomato reports/);
});

test('formatDigestText uses Morning header + actual time at 09:05 TPE', () => {
  const morning = new Date('2026-04-14T01:05:00Z');
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
    now: morning,
  });
  assert.match(text, /☀️ <b>Blend N Bubbles — Morning Rundown<\/b>/);
  assert.match(text, /14 Apr 2026, 09:05 TPE/);
});

test('formatDigestText uses Evening header at 21:30 TPE', () => {
  const evening = new Date('2026-04-14T13:30:00Z');
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
    now: evening,
  });
  assert.match(text, /🌙 <b>Blend N Bubbles — Evening Rundown<\/b>/);
  assert.match(text, /14 Apr 2026, 21:30 TPE/);
});

test('formatDigestText separates Google and Zomato reviews with per-platform links', () => {
  const text = formatDigestText({
    reviews: [
      { kind: 'review-single', source: 'google', reviewer: 'Sushmita', business: 'x', count: 1 },
      { kind: 'review-batch', source: 'google', business: 'x', count: 2 },
      { kind: 'review-single', source: 'zomato', reviewer: 'Jayasree', business: 'x', count: 1 },
    ],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Google: 3 new reviews \(from Sushmita\)/);
  assert.match(text, /Zomato: 1 new review \(from Jayasree\)/);
  assert.match(text, /business\.google\.com\/reviews/);
  assert.match(text, /zomato\.com\/business/);
});

test('formatDigestText escapes HTML in reviewer, filenames, titles, snippets', () => {
  const text = formatDigestText({
    reviews: [{ kind: 'review-single', source: 'google', reviewer: '<script>', business: 'x', count: 1 }],
    petpoojaReports: [],
    zomatoWeekly: [
      { kind: 'zomato-weekly', title: 'Week "A" & B', attachments: [], messageId: 'm', snippet: '<img>' },
    ],
    zomatoSettlements: [
      {
        kind: 'zomato-settlement',
        title: 'Range',
        attachments: [{ filename: 'ok.xlsx', mimeType: 'x', attachmentId: 'a', size: 1 }],
        messageId: 'm2',
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.doesNotMatch(text, /<script>/);
  assert.match(text, /&lt;script&gt;/);
  assert.match(text, /Week &quot;A&quot; &amp; B/);
  assert.match(text, /&lt;img&gt;/);
});

test('formatDigestText renders Zomato weekly snippet and settlement attachment list', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoWeekly: [
      {
        kind: 'zomato-weekly',
        title: 'Week 15 (6 to 12 Apr, 2026)',
        attachments: [],
        messageId: 'm',
        snippet: 'Orders: 120, Revenue: ₹42,000',
      },
    ],
    zomatoSettlements: [
      {
        kind: 'zomato-settlement',
        title: 'Statement | 30 Mar - 05 Apr',
        attachments: [
          { filename: 'soa.xlsx', mimeType: 'x', attachmentId: 'a', size: 10 },
        ],
        messageId: 'm2',
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Weekly report: Week 15/);
  assert.match(text, /Orders: 120, Revenue: ₹42,000/);
  assert.match(text, /Settlement:/);
  assert.match(text, /📎 soa\.xlsx/);
});

test('runDigest forwards PetPooja AND Zomato attachments with distinct captions', async () => {
  const calls = [];
  const fakeGmail = {
    users: {
      messages: {
        list: async () => ({ data: { messages: [{ id: 'pp' }, { id: 'zo' }] } }),
        get: async ({ id }) => ({
          data: {
            id,
            internalDate: String(Date.now() - 3600_000),
            snippet: 'snippet',
            payload:
              id === 'pp'
                ? {
                    headers: [
                      { name: 'From', value: '<no-reply@petpooja.com>' },
                      { name: 'Subject', value: 'Report Notification: PetPooja' },
                    ],
                    parts: [
                      { filename: 'pp.xlsx', mimeType: 'x', body: { attachmentId: 'P1', size: 100 } },
                    ],
                  }
                : {
                    headers: [
                      { name: 'From', value: '<billing@zomato.com>' },
                      { name: 'Subject', value: 'Zomato | Statement of account | BnB | 30 Mar to 05 Apr' },
                    ],
                    parts: [
                      { filename: 'zo.xlsx', mimeType: 'x', body: { attachmentId: 'Z1', size: 200 } },
                    ],
                  },
          },
        }),
        attachments: {
          get: async () => ({ data: { data: Buffer.from('x').toString('base64url') } }),
        },
      },
    },
  };
  const fakeTelegram = {
    sendMessage: async (text) => calls.push({ call: 'sendMessage', text }),
    sendDocument: async ({ filename, caption }) => calls.push({ call: 'sendDocument', filename, caption }),
  };
  const config = { gmail: {}, telegram: {}, lookbackHours: 12, localeTz: 'Asia/Taipei' };
  const summary = await runDigest({ config, deps: { gmail: fakeGmail, telegram: fakeTelegram } });
  assert.equal(summary.petpoojaReportCount, 1);
  assert.equal(summary.zomatoSettlementCount, 1);
  assert.equal(summary.attachmentFailures, 0);
  const docs = calls.filter((c) => c.call === 'sendDocument');
  assert.equal(docs.length, 2);
  assert.match(docs.find((d) => d.filename === 'pp.xlsx').caption, /📊/);
  assert.match(docs.find((d) => d.filename === 'zo.xlsx').caption, /🍽️/);
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
    sendMessage: async (text) => calls.push({ call: 'sendMessage', text }),
    sendDocument: async () => calls.push({ call: 'sendDocument' }),
  };
  const summary = await runDigest({
    config: { gmail: {}, telegram: {}, lookbackHours: 12, localeTz: 'Asia/Taipei' },
    deps: { gmail: fakeGmail, telegram: fakeTelegram },
  });
  assert.equal(calls.filter((c) => c.call === 'sendDocument').length, 0);
  assert.equal(summary.attachmentFailures, 2);
  const warnMsg = calls.find((c) => c.call === 'sendMessage' && c.text.includes('Some attachments'));
  assert.ok(warnMsg);
  assert.match(warnMsg.text, /empty\.xlsx.*zero-byte/s);
  assert.match(warnMsg.text, /huge\.xlsx.*too-large/s);
});

test('loadConfig defaults lookbackHours to 12 and fails fast on missing vars', () => {
  assert.throws(() => loadConfig({}), /Missing required env vars/);
  const config = loadConfig({
    GMAIL_CLIENT_ID: 'a',
    GMAIL_CLIENT_SECRET: 'b',
    GMAIL_REFRESH_TOKEN: 'c',
    TELEGRAM_BOT_TOKEN: 'd',
    TELEGRAM_CHAT_ID: '-1',
  });
  assert.equal(config.lookbackHours, 12);
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
});

test('escapeHtml escapes all five HTML-unsafe characters', () => {
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});
