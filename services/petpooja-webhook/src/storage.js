import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Portable JSON-file storage. Keyed by order ID for idempotency — PetPooja can
// send duplicate POSTs and we want the latest snapshot per order, not a log.
// Run this service on a host with a persistent disk (Fly, Railway, a tiny VM),
// or swap this module for a KV binding (Vercel KV, Cloudflare KV) if deploying
// serverless — see README for instructions.

const DEFAULT_PATH = process.env.PETPOOJA_STORE_PATH ?? '/tmp/petpooja-orders.json';
// Only allow writing under these roots — otherwise a misconfigured env var
// could silently point at /etc/passwd etc.
const ALLOWED_ROOTS = [
  path.resolve(os.tmpdir()) + path.sep,
  '/tmp/',
  '/data/',
  path.resolve(process.cwd()) + path.sep,
];

// Serialise reads/writes per-path so concurrent POSTs can't race.
const writeLocks = new Map();

function acquireLock(key) {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  writeLocks.set(
    key,
    prev.then(() => next),
  );
  return { ready: prev, release };
}

export function assertAllowedPath(p) {
  const abs = path.resolve(p);
  if (!ALLOWED_ROOTS.some((root) => abs === root.replace(/\/$/, '') || abs.startsWith(root))) {
    throw new Error(`PETPOOJA_STORE_PATH "${p}" is not under an allowed root`);
  }
  return abs;
}

export async function loadOrders(storePath = DEFAULT_PATH) {
  const abs = assertAllowedPath(storePath);
  try {
    const raw = await fs.readFile(abs, 'utf8');
    const parsed = JSON.parse(raw);
    // Re-create without __proto__ key inheritance from JSON parse.
    const clean = Object.create(null);
    for (const [k, v] of Object.entries(parsed ?? {})) {
      if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
      clean[k] = v;
    }
    return clean;
  } catch (err) {
    if (err.code === 'ENOENT') return Object.create(null);
    throw err;
  }
}

export async function saveOrder(order, storePath = DEFAULT_PATH) {
  const abs = assertAllowedPath(storePath);
  const lock = acquireLock(abs);
  await lock.ready;
  try {
    const orders = await loadOrders(abs);
    orders[order.orderId] = order;
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.tmp-${process.pid}`;
    await fs.writeFile(tmp, JSON.stringify(orders, null, 2));
    await fs.rename(tmp, abs);
    return order;
  } finally {
    lock.release();
  }
}

export function aggregateToday(orders, { now = new Date(), localeTz = 'Asia/Kolkata' } = {}) {
  const formatter = makeDayFormatter(localeTz);
  const todayKey = formatter.format(now);
  const todays = Object.values(orders).filter((o) => {
    if (!o?.receivedAt) return false;
    const key = formatter.format(new Date(o.receivedAt));
    return key === todayKey;
  });
  return {
    date: todayKey,
    ...summariseOrders(todays),
  };
}

/**
 * Aggregate every order whose receivedAt date-key falls between startKey and
 * endKey (inclusive), where the keys are en-CA "YYYY-MM-DD" strings in the
 * configured timezone. Returns the same shape as aggregateToday minus the
 * `date` field, with a `startDate` and `endDate` instead so callers can
 * distinguish week-to-date from month-to-date.
 */
export function aggregateRange(orders, { startKey, endKey, localeTz = 'Asia/Kolkata' } = {}) {
  if (!startKey || !endKey) {
    throw new Error('aggregateRange: startKey and endKey are required');
  }
  if (startKey > endKey) {
    throw new Error(`aggregateRange: startKey "${startKey}" is after endKey "${endKey}"`);
  }
  const formatter = makeDayFormatter(localeTz);
  const inRange = Object.values(orders).filter((o) => {
    if (!o?.receivedAt) return false;
    const key = formatter.format(new Date(o.receivedAt));
    return key >= startKey && key <= endKey;
  });
  return {
    startDate: startKey,
    endDate: endKey,
    ...summariseOrders(inRange),
  };
}

/**
 * Convenience: builds today / week-to-date / month-to-date summaries in one
 * pass over the orders store. Week starts on Monday in the configured tz.
 */
export function aggregateSummary(orders, { now = new Date(), localeTz = 'Asia/Kolkata' } = {}) {
  const formatter = makeDayFormatter(localeTz);
  const todayKey = formatter.format(now);
  const weekStartKey = formatter.format(startOfWeek(now, localeTz));
  const monthStartKey = formatter.format(startOfMonth(now, localeTz));
  return {
    today: aggregateToday(orders, { now, localeTz }),
    weekToDate: aggregateRange(orders, {
      startKey: weekStartKey,
      endKey: todayKey,
      localeTz,
    }),
    monthToDate: aggregateRange(orders, {
      startKey: monthStartKey,
      endKey: todayKey,
      localeTz,
    }),
  };
}

function summariseOrders(orders) {
  const successful = orders.filter((o) => o.status === 'Success');
  return {
    orderCount: successful.length,
    totalRupees: successful.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    rejectedCount: orders.filter((o) => o.status === 'Rejected').length,
  };
}

function makeDayFormatter(localeTz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: localeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (err) {
    throw new Error(`storage: invalid localeTz "${localeTz}"`);
  }
}

// Monday of the week containing `from`, expressed in the local timezone.
// We read the weekday name in the target tz, then roll the UTC Date back by
// that many days. Re-formatting through makeDayFormatter then yields the
// correct Monday YYYY-MM-DD string regardless of the host's local offset.
function startOfWeek(from, localeTz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: localeTz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(from);
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value;
  const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = weekdayMap[weekdayName] ?? 0;
  const out = new Date(from);
  out.setUTCDate(out.getUTCDate() - offset);
  return out;
}

// 1st of the month containing `from`, expressed in the local timezone.
// Anchor at noon UTC on the 1st so a ±12h tz offset still reports day 1.
function startOfMonth(from, localeTz) {
  const formatter = makeDayFormatter(localeTz);
  const today = formatter.format(from);
  const [year, month] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}
