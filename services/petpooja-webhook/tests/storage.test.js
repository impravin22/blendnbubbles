import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateToday, aggregateRange, aggregateSummary } from '../src/storage.js';

// Build a tiny in-memory "orders" map for the aggregator tests. Receivedat
// timestamps cover the past month so the same fixture serves day / week /
// month assertions. All amounts are in rupees and statuses match the live
// PetPooja shape ("Success" / "Rejected").
function makeOrders(now) {
  const day = 24 * 60 * 60 * 1000;
  const minus = (days, hours = 0) =>
    new Date(now.getTime() - days * day - hours * 60 * 60 * 1000).toISOString();
  return {
    today1: { orderId: 'today1', status: 'Success', total: 150, receivedAt: minus(0, 1) },
    today2: { orderId: 'today2', status: 'Success', total: 350, receivedAt: minus(0, 3) },
    todayReject: { orderId: 'todayReject', status: 'Rejected', total: 0, receivedAt: minus(0, 2) },
    yesterday: { orderId: 'yesterday', status: 'Success', total: 200, receivedAt: minus(1) },
    fourDaysAgo: { orderId: 'fourDaysAgo', status: 'Success', total: 500, receivedAt: minus(4) },
    tenDaysAgo: { orderId: 'tenDaysAgo', status: 'Success', total: 700, receivedAt: minus(10) },
    twentyDaysAgo: { orderId: 'twentyDaysAgo', status: 'Success', total: 900, receivedAt: minus(20) },
    fortyDaysAgo: { orderId: 'fortyDaysAgo', status: 'Success', total: 1000, receivedAt: minus(40) },
    malformed: { orderId: 'malformed', status: 'Success', total: 50 /* no receivedAt */ },
  };
}

test('aggregateToday sums only orders within the current local day', () => {
  // Use UTC noon so the order is comfortably within "today" in Asia/Kolkata too.
  const now = new Date('2026-05-30T12:00:00Z');
  const summary = aggregateToday(makeOrders(now), { now, localeTz: 'Asia/Kolkata' });
  assert.equal(summary.orderCount, 2);
  assert.equal(summary.totalRupees, 500);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.date, '2026-05-30');
});

test('aggregateRange sums orders inclusive of both endpoints', () => {
  const now = new Date('2026-05-30T12:00:00Z');
  const summary = aggregateRange(makeOrders(now), {
    startKey: '2026-05-25',
    endKey: '2026-05-30',
    localeTz: 'Asia/Kolkata',
  });
  // today (2 successes), yesterday (1), four-days-ago (1) all fall in window.
  // ten-days-ago and earlier are outside.
  assert.equal(summary.orderCount, 4);
  assert.equal(summary.totalRupees, 150 + 350 + 200 + 500);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.startDate, '2026-05-25');
  assert.equal(summary.endDate, '2026-05-30');
});

test('aggregateRange rejects invalid windows', () => {
  assert.throws(
    () => aggregateRange({}, { startKey: '2026-05-30', endKey: '2026-05-25' }),
    /is after endKey/,
  );
  assert.throws(() => aggregateRange({}, { startKey: '2026-05-30' }), /required/);
});

test('aggregateSummary returns today + week-to-date + month-to-date', () => {
  // Pick a date deep inside a month so month-to-date is unambiguous.
  // 2026-05-20 is a Wednesday in IST so week-to-date covers Mon 18 → Wed 20.
  const now = new Date('2026-05-20T12:00:00Z');
  const orders = {
    today: { orderId: 'today', status: 'Success', total: 200, receivedAt: '2026-05-20T08:00:00Z' },
    monday: { orderId: 'monday', status: 'Success', total: 300, receivedAt: '2026-05-18T08:00:00Z' },
    lastWeek: { orderId: 'lastWeek', status: 'Success', total: 400, receivedAt: '2026-05-12T08:00:00Z' },
    lastMonth: { orderId: 'lastMonth', status: 'Success', total: 999, receivedAt: '2026-04-30T08:00:00Z' },
  };
  const summary = aggregateSummary(orders, { now, localeTz: 'Asia/Kolkata' });

  assert.equal(summary.today.orderCount, 1);
  assert.equal(summary.today.totalRupees, 200);

  // Week-to-date = Monday's order + today.
  assert.equal(summary.weekToDate.orderCount, 2);
  assert.equal(summary.weekToDate.totalRupees, 500);
  assert.equal(summary.weekToDate.startDate, '2026-05-18');
  assert.equal(summary.weekToDate.endDate, '2026-05-20');

  // Month-to-date = everything in May (today + monday + lastWeek) but not April's order.
  assert.equal(summary.monthToDate.orderCount, 3);
  assert.equal(summary.monthToDate.totalRupees, 200 + 300 + 400);
  assert.equal(summary.monthToDate.startDate, '2026-05-01');
  assert.equal(summary.monthToDate.endDate, '2026-05-20');
});

test('aggregateToday tolerates orders missing receivedAt', () => {
  const now = new Date('2026-05-30T12:00:00Z');
  const orders = {
    ok: { orderId: 'ok', status: 'Success', total: 100, receivedAt: '2026-05-30T08:00:00Z' },
    missing: { orderId: 'missing', status: 'Success', total: 999 /* no receivedAt */ },
  };
  const summary = aggregateToday(orders, { now, localeTz: 'Asia/Kolkata' });
  assert.equal(summary.orderCount, 1);
  assert.equal(summary.totalRupees, 100);
});
