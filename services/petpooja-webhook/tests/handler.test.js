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
