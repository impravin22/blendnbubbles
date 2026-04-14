import { saveOrder } from './storage.js';

// PetPooja webhook payload shape (from their documentation):
//   {
//     token: "<shared-secret>",
//     properties: {
//       Restaurant: { restID, restaurantName, ... },
//       Order:       { orderID, orderStatus, total, ... },
//       OrderItem:  [ ... ],
//       Customer:    { ... },
//       ...
//     }
//   }
// We validate the token, extract the bits we need for the "today's sales"
// digest, and persist. Everything else is ignored — we do not need
// customer PII or menu data for the daily summary.

export async function handleWebhook(body, { expectedToken, storePath } = {}) {
  if (!body || typeof body !== 'object') {
    return { ok: false, statusCode: 400, error: 'invalid-json' };
  }
  if (expectedToken && body.token !== expectedToken) {
    return { ok: false, statusCode: 401, error: 'bad-token' };
  }
  const props = body.properties ?? body;
  const order = props.Order ?? props.order ?? null;
  if (!order) {
    return { ok: false, statusCode: 400, error: 'missing-order' };
  }
  const orderId = String(order.orderID ?? order.orderId ?? '').trim();
  if (!orderId) {
    return { ok: false, statusCode: 400, error: 'missing-order-id' };
  }
  const record = {
    orderId,
    status: String(order.orderStatus ?? order.status ?? 'Unknown'),
    total: Number(order.total ?? order.totalAmount ?? 0),
    receivedAt: new Date().toISOString(),
  };
  const saved = await saveOrder(record, storePath);
  return { ok: true, statusCode: 200, order: saved };
}
