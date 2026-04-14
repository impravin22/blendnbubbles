import fs from 'node:fs/promises';
import path from 'node:path';

// Portable JSON-file storage. Keyed by order ID for idempotency — PetPooja can
// send duplicate POSTs and we want the latest snapshot per order, not a log.
// Run this service on a host with a persistent disk (Fly, Railway, a tiny VM),
// or swap this module for a KV binding (Vercel KV, Cloudflare KV) if deploying
// serverless — see README for instructions.

const DEFAULT_PATH = process.env.PETPOOJA_STORE_PATH ?? '/tmp/petpooja-orders.json';

export async function loadOrders(storePath = DEFAULT_PATH) {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function saveOrder(order, storePath = DEFAULT_PATH) {
  const orders = await loadOrders(storePath);
  orders[order.orderId] = order;
  await fs.mkdir(path.dirname(storePath), { recursive: true }).catch(() => {});
  await fs.writeFile(storePath, JSON.stringify(orders, null, 2));
  return order;
}

export function aggregateToday(orders, { now = new Date(), localeTz = 'Asia/Kolkata' } = {}) {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: localeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const todays = Object.values(orders).filter((o) => {
    if (!o?.receivedAt) return false;
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: localeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(o.receivedAt));
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
