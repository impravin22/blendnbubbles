import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDigestText, runDigest, escapeHtml } from '../src/digest.js';
import { loadConfig } from '../src/config.js';

test('formatDigestText quiet-day covers every section', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Blend N Bubbles — (Morning|Evening) Rundown/);
  assert.match(text, /No new reviews/);
  assert.match(text, /No overnight report yet/);
  assert.match(text, /No Zomato reports/);
  assert.match(text, /No GBP updates/);
  assert.match(text, /No Hyperpure activity/);
});

test('Urgent Alerts section renders above Reviews when alerts exist', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoAlerts: [
      { kind: 'zomato-alert', severity: 'critical', title: 'Online ordering switched OFF for BnB', messageId: 'a1', snippet: 'auto-off due to rejection' },
      { kind: 'zomato-alert', severity: 'warning', title: 'Online order rejected at BnB', messageId: 'a2', snippet: 'Order Id 7957697049' },
    ],
    localeTz: 'Asia/Taipei',
  });
  const alertsIdx = text.indexOf('Urgent Alerts');
  const reviewsIdx = text.indexOf('Customer Reviews');
  assert.ok(alertsIdx > 0 && alertsIdx < reviewsIdx, 'Urgent Alerts must render before Customer Reviews');
  assert.match(text, /🚨 Online ordering switched OFF/);
  assert.match(text, /⚠️ Online order rejected/);
});

test('Morning vs Evening header chosen by TPE hour', () => {
  const morning = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
    now: new Date('2026-04-14T01:05:00Z'),
  });
  assert.match(morning, /☀️ <b>Blend N Bubbles — Morning Rundown<\/b>/);
  const evening = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    localeTz: 'Asia/Taipei',
    now: new Date('2026-04-14T13:30:00Z'),
  });
  assert.match(evening, /🌙 <b>Blend N Bubbles — Evening Rundown<\/b>/);
});

test('Reviews split per-platform with reply links', () => {
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
});

test('GBP section renders performance + photo counts', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    gbpPerformance: [{ kind: 'gbp-performance', month: 'March 2026', messageId: 'p', snippet: '271 people viewed last month' }],
    gbpPhotos: [
      { kind: 'gbp-photo', subject: 'photo 1', messageId: 'a', snippet: '' },
      { kind: 'gbp-photo', subject: 'photo 2', messageId: 'b', snippet: '' },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Monthly performance — March 2026/);
  assert.match(text, /271 people viewed/);
  assert.match(text, /2 new customer photos/);
});

test('Hyperpure section lists placed and delivered with order IDs', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    hyperpureOrders: [
      { kind: 'hyperpure-order', status: 'placed', orderId: 'ZHPWB27-OR-0025296424', subject: '', messageId: 'h1', snippet: '' },
      { kind: 'hyperpure-order', status: 'delivered', orderId: 'ZHPWB26-OR-0025064133', subject: '', messageId: 'h2', snippet: '' },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /🛒 Placed — ZHPWB27-OR-0025296424/);
  assert.match(text, /✅ Delivered — ZHPWB26-OR-0025064133/);
});

test('Zomato section includes tax invoice alongside weekly + settlement', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoTaxInvoices: [
      {
        kind: 'zomato-tax-invoice',
        title: 'Online Ordering for 2026-03-01 to 2026-03-31',
        attachments: [{ filename: 'Z26.pdf', mimeType: 'application/pdf', attachmentId: 'a', size: 10 }],
        messageId: 'm',
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Tax invoice: Online Ordering/);
  assert.match(text, /📎 Z26\.pdf/);
});

test('HTML escape applied to alert titles, snippets, filenames, month labels', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoAlerts: [{ kind: 'zomato-alert', severity: 'warning', title: '<script>', messageId: 'a', snippet: '"evil"' }],
    gbpPerformance: [{ kind: 'gbp-performance', month: '<img>', messageId: 'p', snippet: 'snippet & more' }],
    localeTz: 'Asia/Taipei',
  });
  assert.doesNotMatch(text, /<script>/);
  assert.match(text, /&lt;script&gt;/);
  assert.match(text, /&lt;img&gt;/);
  assert.match(text, /snippet &amp; more/);
  assert.match(text, /&quot;evil&quot;/);
});

test('runDigest forwards PetPooja, Zomato settlement AND Zomato tax invoice attachments with distinct captions', async () => {
  const calls = [];
  const fakeGmail = makeFakeGmailWithThreeSources();
  const fakeTelegram = {
    sendMessage: async (text) => calls.push({ call: 'sendMessage', text }),
    sendDocument: async ({ filename, caption }) => calls.push({ call: 'sendDocument', filename, caption }),
  };
  const summary = await runDigest({
    config: { gmail: {}, telegram: {}, lookbackHours: 12, localeTz: 'Asia/Taipei' },
    deps: { gmail: fakeGmail, telegram: fakeTelegram },
  });
  assert.equal(summary.petpoojaReportCount, 1);
  assert.equal(summary.zomatoSettlementCount, 1);
  assert.equal(summary.zomatoTaxInvoiceCount, 1);
  const docs = calls.filter((c) => c.call === 'sendDocument');
  assert.equal(docs.length, 3);
  assert.match(docs.find((d) => d.filename === 'pp.xlsx').caption, /📊/);
  assert.match(docs.find((d) => d.filename === 'zo.xlsx').caption, /🍽️/);
  assert.match(docs.find((d) => d.filename === 'tax.pdf').caption, /🧾/);
});

test('runDigest skips zero-byte and oversize attachments and sends failure notice', async () => {
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
                { name: 'Subject', value: 'Report Notification: x' },
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
});

test('runDigest fetches each PetPooja attachment exactly once (cache reused for forwarding)', async () => {
  let attGetCalls = 0;
  const fakeGmail = {
    users: {
      messages: {
        list: async () => ({ data: { messages: [{ id: 'm1' }] } }),
        get: async () => ({
          data: {
            id: 'm1',
            internalDate: String(Date.now() - 3600_000),
            snippet: '',
            payload: {
              headers: [
                { name: 'From', value: '<no-reply@petpooja.com>' },
                { name: 'Subject', value: 'Report Notification: Item' },
              ],
              parts: [
                { filename: 'x.xlsx', mimeType: 'x', body: { attachmentId: 'ATT1', size: 123 } },
              ],
            },
          },
        }),
        attachments: {
          get: async () => {
            attGetCalls++;
            // Return a buffer that is intentionally not a real xlsx; the parse
            // will fail and summaryError will be set, but the cache logic is
            // still exercised because we cached the buffer before the throw.
            return { data: { data: Buffer.from('not-a-real-xlsx').toString('base64url') } };
          },
        },
      },
    },
  };
  const fakeTelegram = { sendMessage: async () => {}, sendDocument: async () => {} };
  await runDigest({
    config: { gmail: {}, telegram: {}, lookbackHours: 12, localeTz: 'Asia/Taipei' },
    deps: { gmail: fakeGmail, telegram: fakeTelegram },
  });
  assert.equal(attGetCalls, 1, 'attachment.get must be called once, not re-fetched');
});

test('loadConfig rejects invalid IANA timezone', () => {
  assert.throws(
    () =>
      loadConfig({
        GMAIL_CLIENT_ID: 'a',
        GMAIL_CLIENT_SECRET: 'b',
        GMAIL_REFRESH_TOKEN: 'c',
        TELEGRAM_BOT_TOKEN: 'd',
        TELEGRAM_CHAT_ID: '-1',
        DIGEST_LOCALE_TZ: 'Not/A/Zone',
      }),
    /not a valid IANA timezone/,
  );
});

test('loadConfig defaults lookbackHours to 12', () => {
  const config = loadConfig({
    GMAIL_CLIENT_ID: 'a',
    GMAIL_CLIENT_SECRET: 'b',
    GMAIL_REFRESH_TOKEN: 'c',
    TELEGRAM_BOT_TOKEN: 'd',
    TELEGRAM_CHAT_ID: '-1',
  });
  assert.equal(config.lookbackHours, 12);
});

test('escapeHtml covers all five entity characters', () => {
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('Weekly Trend section renders on Sunday evening in TPE with parsed metrics', () => {
  const sundayEvening = new Date('2026-04-12T13:30:00Z'); // 21:30 TPE Sunday
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoWeekly: [
      {
        kind: 'zomato-weekly',
        title: 'Week 15 (6 to 12 Apr, 2026)',
        attachments: [],
        messageId: 'w',
        snippet: 'Total sales ₹1156 -67% Delivered orders 5 -58%',
        metrics: { salesRupees: 1156, salesDeltaPct: -67, orders: 5, ordersDeltaPct: -58 },
      },
    ],
    localeTz: 'Asia/Taipei',
    now: sundayEvening,
  });
  assert.match(text, /📈 Weekly Trend/);
  assert.match(text, /Sales: ₹1,156 \(-67% 🔻 vs last week\)/);
  assert.match(text, /Delivered orders: 5 \(-58% 🔻 vs last week\)/);
});

test('Weekly Trend section is omitted on non-Sunday', () => {
  const monday = new Date('2026-04-13T13:30:00Z'); // 21:30 TPE Monday
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoWeekly: [
      {
        kind: 'zomato-weekly',
        title: 'Week 15',
        attachments: [],
        messageId: 'w',
        snippet: 'x',
        metrics: { salesRupees: 1000, salesDeltaPct: 10, orders: 5, ordersDeltaPct: 0 },
      },
    ],
    localeTz: 'Asia/Taipei',
    now: monday,
  });
  assert.doesNotMatch(text, /Weekly Trend/);
});

test('Weekly Trend section is omitted on Sunday morning (before 16:00 TPE)', () => {
  const sundayMorning = new Date('2026-04-12T01:05:00Z'); // 09:05 TPE Sunday
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoWeekly: [
      {
        kind: 'zomato-weekly',
        title: 'Week 15',
        attachments: [],
        messageId: 'w',
        snippet: 'x',
        metrics: { salesRupees: 1000, salesDeltaPct: 10, orders: 5, ordersDeltaPct: 5 },
      },
    ],
    localeTz: 'Asia/Taipei',
    now: sundayMorning,
  });
  assert.doesNotMatch(text, /Weekly Trend/);
});

test('Positive weekly deltas render with up arrow', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoWeekly: [
      {
        kind: 'zomato-weekly',
        title: 'Week 14',
        attachments: [],
        messageId: 'w',
        snippet: 'x',
        metrics: { salesRupees: 3547, salesDeltaPct: 45, orders: 12, ordersDeltaPct: 20 },
      },
    ],
    localeTz: 'Asia/Taipei',
    now: new Date('2026-04-12T13:00:00Z'),
  });
  assert.match(text, /\(\+45% 🔺/);
});

test('PetPooja section surfaces summaryError when xlsx parse fails', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [
      {
        kind: 'petpooja',
        reportTitle: 'Bad report',
        attachments: [{ filename: 'bad.xlsx', mimeType: 'x', attachmentId: 'a', size: 1 }],
        messageId: 'm',
        summaryError: 'template mismatch',
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Could not parse xlsx: template mismatch/);
});

test('PetPooja live-feed error surfaces in digest instead of silently omitting', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    petpoojaLive: { ok: false, reason: 'HTTP 500' },
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Live feed unavailable \(HTTP 500\)/);
});

test('PetPooja live-feed "not-configured" stays silent (no scary warning)', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    petpoojaLive: { ok: false, reason: 'not-configured' },
    localeTz: 'Asia/Taipei',
  });
  assert.doesNotMatch(text, /Live feed unavailable/);
});

test('PetPooja section renders drink-wise summary when report.summary is present', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [
      {
        kind: 'petpooja',
        reportTitle: 'Item Wise Report',
        attachments: [{ filename: 'a.xlsx', mimeType: 'x', attachmentId: 'a', size: 1 }],
        messageId: 'm',
        summary: {
          dateRange: '2026-02-01 to 2026-02-17',
          totalOrders: 350,
          totalRevenue: 52373.14,
          topItems: [
            { name: 'Caramel Boba Coffee', category: 'Coffee', qty: 41, total: 6567 },
            { name: 'Taiwan Classic Boba', category: 'Milk Tea', qty: 25, total: 4266 },
            { name: 'Cafe Mocha', category: 'Coffee', qty: 20, total: 3449 },
          ],
          topCategories: [
            { name: 'Smoothies', qty: 68, total: 11311 },
            { name: 'Coffee', qty: 61, total: 10016 },
          ],
        },
      },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /₹52,373 • 350 items sold/);
  assert.match(text, /🏆 Top drinks:/);
  assert.match(text, /Caramel Boba Coffee × 41/);
  assert.match(text, /Taiwan Classic Boba × 25/);
  assert.match(text, /Cafe Mocha × 20/);
  assert.match(text, /📂 By category: Smoothies ₹11,311/);
});

test('Urgent Alerts heading is absent when zomatoAlerts is empty', () => {
  const text = formatDigestText({
    reviews: [{ kind: 'review-single', source: 'google', reviewer: 'X', business: 'x', count: 1 }],
    petpoojaReports: [],
    zomatoAlerts: [],
    localeTz: 'Asia/Taipei',
  });
  assert.doesNotMatch(text, /Urgent Alerts/);
});

test('Section order invariant: Alerts < Reviews < PetPooja < Zomato < GBP < Hyperpure', () => {
  const text = formatDigestText({
    reviews: [{ kind: 'review-single', source: 'google', reviewer: 'X', business: 'x', count: 1 }],
    petpoojaReports: [{ kind: 'petpooja', reportTitle: 'PP', attachments: [], messageId: 'p' }],
    zomatoWeekly: [{ kind: 'zomato-weekly', title: 'W', attachments: [], messageId: 'w', snippet: '' }],
    gbpPhotos: [{ kind: 'gbp-photo', subject: '', messageId: 'g', snippet: '' }],
    hyperpureOrders: [{ kind: 'hyperpure-order', status: 'placed', orderId: 'X', subject: '', messageId: 'h', snippet: '' }],
    zomatoAlerts: [{ kind: 'zomato-alert', severity: 'critical', title: 'OFF', messageId: 'a', snippet: '' }],
    localeTz: 'Asia/Taipei',
  });
  const order = [
    text.indexOf('Urgent Alerts'),
    text.indexOf('Customer Reviews'),
    text.indexOf('PetPooja'),
    text.indexOf('Zomato — Business'),
    text.indexOf('Google Business Profile'),
    text.indexOf('Hyperpure Supplies'),
  ];
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i] > order[i - 1], `section at index ${i} must follow previous; got ${order}`);
  }
});

test('Info-only alert does not emit the "Open Zomato Business" CTA', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoAlerts: [
      { kind: 'zomato-alert', severity: 'info', title: '[IMP] Update on your payout', messageId: 'a', snippet: '' },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /ℹ️ \[IMP\] Update on your payout/);
  assert.doesNotMatch(text, /Open Zomato Business/);
});

test('Mixed-severity alerts do emit the CTA (when at least one needs action)', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoAlerts: [
      { kind: 'zomato-alert', severity: 'info', title: 'Payout', messageId: 'a', snippet: '' },
      { kind: 'zomato-alert', severity: 'critical', title: 'Switched OFF', messageId: 'b', snippet: '' },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Open Zomato Business/);
});

test('Tax invoice with no attachment emits "No PDF attached" warning', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoTaxInvoices: [
      { kind: 'zomato-tax-invoice', title: 'Online Ordering for 2026-03', attachments: [], messageId: 'i' },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /Tax invoice: Online Ordering for 2026-03/);
  assert.match(text, /⚠️ No PDF attached/);
});

test('Hyperpure order with empty orderId renders without trailing em-dash', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    hyperpureOrders: [
      { kind: 'hyperpure-order', status: 'placed', orderId: '', subject: '', messageId: 'h', snippet: '' },
    ],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /🛒 Placed$/m);
  assert.doesNotMatch(text, /Placed — /);
});

test('Single new photo uses singular noun', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    gbpPhotos: [{ kind: 'gbp-photo', subject: 'one', messageId: 'a', snippet: '' }],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /1 new customer photo\b/);
  assert.doesNotMatch(text, /1 new customer photos/);
});

test('Info-severity alert renders with ℹ️ glyph', () => {
  const text = formatDigestText({
    reviews: [],
    petpoojaReports: [],
    zomatoAlerts: [{ kind: 'zomato-alert', severity: 'info', title: 'Payout info', messageId: 'a', snippet: '' }],
    localeTz: 'Asia/Taipei',
  });
  assert.match(text, /ℹ️ Payout info/);
});

test('All-kinds integration: runDigest surfaces every section in a single digest', async () => {
  const calls = [];
  const now = Date.now();
  const specs = {
    alert: {
      from: '<noreply@zomato.com>',
      subject: 'Online ordering switched OFF for Blend N Bubbles',
      parts: [],
      snippet: 'auto-off',
    },
    petpooja: {
      from: '<no-reply@petpooja.com>',
      subject: 'Report Notification: PP',
      parts: [{ filename: 'pp.xlsx', mimeType: 'x', body: { attachmentId: 'P', size: 100 } }],
      snippet: '',
    },
    settlement: {
      from: '<billing@zomato.com>',
      subject: 'Zomato | Statement of account | BnB | 30 Mar to 05 Apr',
      parts: [{ filename: 'zo.xlsx', mimeType: 'x', body: { attachmentId: 'Z', size: 200 } }],
      snippet: '',
    },
    perf: {
      from: '<noreply@business.google.com>',
      subject: 'Blend n Bubbles, your performance report for March 2026',
      parts: [],
      snippet: '271 people viewed',
    },
    hyperpure: {
      from: '<noreply@hyperpure.com>',
      subject: 'Thank you for your order!',
      parts: [],
      snippet: 'Order Number: ZHPWB27-OR-0025296424',
    },
  };
  const fakeGmail = {
    users: {
      messages: {
        list: async () => ({ data: { messages: Object.keys(specs).map((id) => ({ id })) } }),
        get: async ({ id }) => ({
          data: {
            id,
            internalDate: String(now - 3600_000),
            snippet: specs[id].snippet,
            payload: {
              headers: [
                { name: 'From', value: specs[id].from },
                { name: 'Subject', value: specs[id].subject },
              ],
              parts: specs[id].parts,
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
  const summary = await runDigest({
    config: { gmail: {}, telegram: {}, lookbackHours: 12, localeTz: 'Asia/Taipei' },
    deps: { gmail: fakeGmail, telegram: fakeTelegram },
  });
  assert.equal(summary.zomatoAlertCount, 1);
  assert.equal(summary.petpoojaReportCount, 1);
  assert.equal(summary.zomatoSettlementCount, 1);
  assert.equal(summary.gbpPerformanceCount, 1);
  assert.equal(summary.hyperpureOrderCount, 1);

  const body = calls.find((c) => c.call === 'sendMessage').text;
  const indices = {
    alerts: body.indexOf('Urgent Alerts'),
    reviews: body.indexOf('Customer Reviews'),
    petpooja: body.indexOf('PetPooja'),
    zomato: body.indexOf('Zomato — Business'),
    gbp: body.indexOf('Google Business Profile'),
    hyperpure: body.indexOf('Hyperpure'),
  };
  for (const [name, idx] of Object.entries(indices)) {
    assert.ok(idx > 0, `section "${name}" missing from body`);
  }

  assert.equal(calls.filter((c) => c.call === 'sendDocument').length, 2);
});

test('fetchMessage rejections are logged (warns to stderr) and counted in fetchFailures', async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const fakeGmail = {
      users: {
        messages: {
          list: async () => ({ data: { messages: [{ id: 'm1' }, { id: 'm2' }] } }),
          get: async ({ id }) => {
            if (id === 'm1') throw new Error('transient 500');
            return {
              data: {
                id,
                internalDate: String(Date.now() - 1000),
                snippet: '',
                payload: {
                  headers: [
                    { name: 'From', value: 'x@y.com' },
                    { name: 'Subject', value: 'irrelevant' },
                  ],
                  parts: [],
                },
              },
            };
          },
        },
      },
    };
    const fakeTelegram = {
      sendMessage: async () => {},
      sendDocument: async () => {},
    };
    const summary = await runDigest({
      config: { gmail: {}, telegram: {}, lookbackHours: 12, localeTz: 'Asia/Taipei' },
      deps: { gmail: fakeGmail, telegram: fakeTelegram },
    });
    assert.equal(summary.fetchFailures, 1);
    assert.ok(
      warnings.some((w) => w.includes('fetchMessage failed') && w.includes('transient 500')),
      `expected a fetchMessage warning, got: ${warnings.join(' | ')}`,
    );
  } finally {
    console.warn = originalWarn;
  }
});

function makeFakeGmailWithThreeSources() {
  const messageSpecs = {
    pp: {
      from: '<no-reply@petpooja.com>',
      subject: 'Report Notification: PP Report',
      parts: [{ filename: 'pp.xlsx', mimeType: 'x', body: { attachmentId: 'P1', size: 100 } }],
    },
    zo: {
      from: '<billing@zomato.com>',
      subject: 'Zomato | Statement of account | BnB | 30 Mar to 05 Apr',
      parts: [{ filename: 'zo.xlsx', mimeType: 'x', body: { attachmentId: 'Z1', size: 200 } }],
    },
    tax: {
      from: '<billing@zomato.com>',
      subject: 'Tax Invoice : Zomato Online Ordering for 2026-03-01 to 2026-03-31',
      parts: [{ filename: 'tax.pdf', mimeType: 'application/pdf', body: { attachmentId: 'T1', size: 300 } }],
    },
  };
  return {
    users: {
      messages: {
        list: async () => ({
          data: { messages: Object.keys(messageSpecs).map((id) => ({ id })) },
        }),
        get: async ({ id }) => ({
          data: {
            id,
            internalDate: String(Date.now() - 3600_000),
            snippet: '',
            payload: {
              headers: [
                { name: 'From', value: messageSpecs[id].from },
                { name: 'Subject', value: messageSpecs[id].subject },
              ],
              parts: messageSpecs[id].parts,
            },
          },
        }),
        attachments: {
          get: async () => ({ data: { data: Buffer.from('x').toString('base64url') } }),
        },
      },
    },
  };
}
