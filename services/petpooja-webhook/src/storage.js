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
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: localeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (err) {
    throw new Error(`aggregateToday: invalid localeTz "${localeTz}"`);
  }
  const todayKey = formatter.format(now);
  const todays = Object.values(orders).filter((o) => {
    if (!o?.receivedAt) return false;
    const key = formatter.format(new Date(o.receivedAt));
    return key === todayKey;
  });
  const successful = todays.filter((o) => o.status === 'Success');
  return {
    date: todayKey,
    orderCount: successful.length,
    totalRupees: successful.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    rejectedCount: todays.filter((o) => o.status === 'Rejected').length,
  };
}
