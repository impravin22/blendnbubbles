import crypto from 'node:crypto';
import { saveOrder } from './storage.js';

// Status values PetPooja has been observed to send, normalised to a canonical set.
// Keeps the digest truthful when PetPooja changes wording slightly.
const STATUS_ALIASES = new Map([
  ['success', 'Success'],
  ['successful', 'Success'],
  ['completed', 'Success'],
  ['delivered', 'Success'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Rejected'],
  ['canceled', 'Rejected'],
  ['pending', 'Pending'],
  ['accepted', 'Pending'],
]);
const UNSAFE_KEY_RE = /^(?:__proto__|prototype|constructor)$/i;
const VALID_ORDER_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export async function handleWebhook(body, { expectedToken, storePath } = {}) {
  if (!body || typeof body !== 'object') {
    return { ok: false, statusCode: 400, error: 'invalid-json' };
  }
  // Fail-closed on missing expectedToken rather than trusting the caller.
  if (!expectedToken || !safeEqual(String(body.token ?? ''), expectedToken)) {
    return { ok: false, statusCode: 401, error: 'bad-token' };
  }
  const props = body.properties;
  if (!props || typeof props !== 'object') {
    return { ok: false, statusCode: 400, error: 'missing-properties' };
  }
  const order = props.Order ?? props.order;
  if (!order || typeof order !== 'object') {
    return { ok: false, statusCode: 400, error: 'missing-order' };
  }
  const orderId = String(order.orderID ?? order.orderId ?? '').trim();
  if (!orderId) {
    return { ok: false, statusCode: 400, error: 'missing-order-id' };
  }
  if (UNSAFE_KEY_RE.test(orderId) || !VALID_ORDER_ID_RE.test(orderId)) {
    return { ok: false, statusCode: 400, error: 'unsafe-order-id' };
  }
  const total = parseCurrency(order.total ?? order.totalAmount);
  if (!Number.isFinite(total)) {
    return { ok: false, statusCode: 400, error: 'invalid-total' };
  }
  const status = normaliseStatus(order.orderStatus ?? order.status);
  const record = {
    orderId,
    status,
    total,
    receivedAt: new Date().toISOString(),
  };
  const saved = await saveOrder(record, storePath);
  return { ok: true, statusCode: 200, order: saved };
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function normaliseStatus(raw) {
  if (raw == null) return 'Unknown';
  const canonical = STATUS_ALIASES.get(String(raw).trim().toLowerCase());
  return canonical ?? 'Unknown';
}

export function parseCurrency(raw) {
  if (raw == null) return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const cleaned = String(raw).replace(/[₹,Rs\s]/gi, '');
  return Number(cleaned);
}

export const _internals = { safeEqual };
