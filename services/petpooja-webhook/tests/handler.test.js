import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { handleWebhook } from '../src/handler.js';
import { loadOrders, aggregateToday } from '../src/storage.js';

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bnb-webhook-'));
  const file = path.join(dir, 'orders.json');
  return { file, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

test('handleWebhook rejects missing or mismatched token', async () => {
  const { file, cleanup } = await tempStore();
  try {
    const res1 = await handleWebhook({ token: 'wrong', properties: { Order: { orderID: '1', orderStatus: 'Success', total: 100 } } }, { expectedToken: 'right', storePath: file });
    assert.equal(res1.statusCode, 401);
    assert.equal(res1.error, 'bad-token');
    const res2 = await handleWebhook(null, { expectedToken: 'right', storePath: file });
    assert.equal(res2.statusCode, 400);
  } finally {
    await cleanup();
  }
});

test('handleWebhook rejects missing order or order ID', async () => {
  const { file, cleanup } = await tempStore();
  try {
    const res1 = await handleWebhook({ token: 'ok', properties: {} }, { expectedToken: 'ok', storePath: file });
    assert.equal(res1.error, 'missing-order');
    const res2 = await handleWebhook({ token: 'ok', properties: { Order: { total: 100 } } }, { expectedToken: 'ok', storePath: file });
    assert.equal(res2.error, 'missing-order-id');
  } finally {
    await cleanup();
  }
});

test('handleWebhook persists an order keyed by orderID and is idempotent', async () => {
  const { file, cleanup } = await tempStore();
  try {
    const body = { token: 't', properties: { Order: { orderID: 'ORD-1', orderStatus: 'Success', total: 350 } } };
    const res1 = await handleWebhook(body, { expectedToken: 't', storePath: file });
    assert.equal(res1.statusCode, 200);
    // Duplicate POST with the same ID should overwrite, not duplicate
    const res2 = await handleWebhook(
      { token: 't', properties: { Order: { orderID: 'ORD-1', orderStatus: 'Success', total: 400 } } },
      { expectedToken: 't', storePath: file },
    );
    assert.equal(res2.statusCode, 200);
    const stored = await loadOrders(file);
    assert.equal(Object.keys(stored).length, 1);
    assert.equal(stored['ORD-1'].total, 400);
  } finally {
    await cleanup();
  }
});

test('handleWebhook fails closed when expectedToken is missing', async () => {
  const { file, cleanup } = await tempStore();
  try {
    const res = await handleWebhook(
      { token: 'anything', properties: { Order: { orderID: '1', orderStatus: 'Success', total: 1 } } },
      { expectedToken: undefined, storePath: file },
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.error, 'bad-token');
  } finally {
    await cleanup();
  }
});

test('handleWebhook rejects __proto__ and unsafe characters in orderID', async () => {
  const { file, cleanup } = await tempStore();
  try {
    for (const badId of ['__proto__', 'constructor', 'ok id with space', 'bad/path']) {
      const res = await handleWebhook(
        { token: 't', properties: { Order: { orderID: badId, orderStatus: 'Success', total: 1 } } },
        { expectedToken: 't', storePath: file },
      );
      assert.equal(res.error, 'unsafe-order-id', `expected rejection for "${badId}"`);
    }
  } finally {
    await cleanup();
  }
});

test('handleWebhook normalises status variants so aggregateToday counts them', async () => {
  const { file, cleanup } = await tempStore();
  try {
    for (const [i, variant] of ['success', 'SUCCESS', 'Completed', 'delivered'].entries()) {
      const res = await handleWebhook(
        { token: 't', properties: { Order: { orderID: `O${i}`, orderStatus: variant, total: 100 } } },
        { expectedToken: 't', storePath: file },
      );
      assert.equal(res.statusCode, 200);
      assert.equal(res.order.status, 'Success', `variant "${variant}" should normalise to Success`);
    }
  } finally {
    await cleanup();
  }
});

test('handleWebhook accepts stringified rupee amounts ("₹350", "350.00")', async () => {
  const { file, cleanup } = await tempStore();
  try {
    for (const [i, value] of ['₹350', '350.00', '1,200', 350].entries()) {
      const res = await handleWebhook(
        { token: 't', properties: { Order: { orderID: `S${i}`, orderStatus: 'Success', total: value } } },
        { expectedToken: 't', storePath: file },
      );
      assert.equal(res.statusCode, 200, `expected accept for total=${JSON.stringify(value)}`);
    }
  } finally {
    await cleanup();
  }
});

test('handleWebhook is concurrency-safe — 20 parallel POSTs all persist', async () => {
  const { file, cleanup } = await tempStore();
  try {
    const writes = Array.from({ length: 20 }, (_, i) =>
      handleWebhook(
        { token: 't', properties: { Order: { orderID: `C${i}`, orderStatus: 'Success', total: 100 + i } } },
        { expectedToken: 't', storePath: file },
      ),
    );
    await Promise.all(writes);
    const stored = await loadOrders(file);
    assert.equal(Object.keys(stored).length, 20);
  } finally {
    await cleanup();
  }
});

test('aggregateToday throws on invalid timezone', () => {
  assert.throws(
    () => aggregateToday({}, { localeTz: 'Not/A/Zone' }),
    /invalid localeTz/,
  );
});

test('aggregateToday buckets the same UTC instant into different IST days depending on boundary', () => {
  // Two orders straddling the IST midnight boundary, but same UTC date (12 Apr).
  //   order a — UTC 18:29 on 12 Apr → IST 23:59 on 12 Apr
  //   order b — UTC 18:31 on 12 Apr → IST 00:01 on 13 Apr
  const orders = {
    a: { orderId: 'a', status: 'Success', total: 100, receivedAt: '2026-04-12T18:29:00Z' },
    b: { orderId: 'b', status: 'Success', total: 200, receivedAt: '2026-04-12T18:31:00Z' },
  };
  const queryFrom12th = aggregateToday(orders, {
    now: new Date('2026-04-12T10:00:00Z'), // IST 15:30 on 12 Apr
    localeTz: 'Asia/Kolkata',
  });
  const queryFrom13th = aggregateToday(orders, {
    now: new Date('2026-04-13T10:00:00Z'), // IST 15:30 on 13 Apr
    localeTz: 'Asia/Kolkata',
  });
  assert.equal(queryFrom12th.orderCount, 1);
  assert.equal(queryFrom12th.totalRupees, 100);
  assert.equal(queryFrom13th.orderCount, 1);
  assert.equal(queryFrom13th.totalRupees, 200);
});

test('aggregateToday sums successful orders in the given timezone, ignoring rejected + yesterday', async () => {
  const nowIso = new Date().toISOString();
  const yesterdayIso = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const orders = {
    a: { orderId: 'a', status: 'Success', total: 100, receivedAt: nowIso },
    b: { orderId: 'b', status: 'Success', total: 250, receivedAt: nowIso },
    c: { orderId: 'c', status: 'Rejected', total: 999, receivedAt: nowIso },
    d: { orderId: 'd', status: 'Success', total: 50, receivedAt: yesterdayIso },
  };
  const summary = aggregateToday(orders, { localeTz: 'Asia/Kolkata' });
  assert.equal(summary.orderCount, 2);
  assert.equal(summary.totalRupees, 350);
  assert.equal(summary.rejectedCount, 1);
});
