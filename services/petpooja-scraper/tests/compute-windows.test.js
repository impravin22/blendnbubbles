import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWindows } from '../src/windows.js';

test('computeWindows returns today / week-Monday / month-1st in IST', () => {
  // Wednesday 2026-05-20 12:00 UTC == 17:30 IST → Monday is 2026-05-18.
  const windows = computeWindows(new Date('2026-05-20T12:00:00Z'), 'Asia/Kolkata');
  assert.equal(windows.todayStart, '2026-05-20');
  assert.equal(windows.todayEnd, '2026-05-20');
  assert.equal(windows.weekStart, '2026-05-18');
  assert.equal(windows.weekEnd, '2026-05-20');
  assert.equal(windows.monthStart, '2026-05-01');
  assert.equal(windows.monthEnd, '2026-05-20');
});

test('computeWindows: Monday returns same day as week start', () => {
  const windows = computeWindows(new Date('2026-05-25T12:00:00Z'), 'Asia/Kolkata');
  assert.equal(windows.weekStart, '2026-05-25');
  assert.equal(windows.todayStart, '2026-05-25');
});

test('computeWindows: Sunday returns previous Monday', () => {
  const windows = computeWindows(new Date('2026-05-31T12:00:00Z'), 'Asia/Kolkata');
  assert.equal(windows.weekStart, '2026-05-25');
});

test('computeWindows: 1st of month returns same day as month start', () => {
  const windows = computeWindows(new Date('2026-06-01T12:00:00Z'), 'Asia/Kolkata');
  assert.equal(windows.monthStart, '2026-06-01');
  assert.equal(windows.monthEnd, '2026-06-01');
});
