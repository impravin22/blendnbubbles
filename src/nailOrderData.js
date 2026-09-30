// ─── Nail studio order page (/nail) ─────────────────────────
// The nail-studio coupon QR opens this page. Customers pick drinks and fill
// in their name and studio before WhatsApp opens, so the shop receives a
// complete order instead of a blank "My nail studio:" message to chase.
//
// Prices come from MENU, so /nail can never disagree with /menu. Menu
// prices already include 5% GST (PetPooja bills a ₹120 soda as 114.29 +
// 5.72 tax), and the PetPooja discount "BNB-NAIL15 Nail studios" comes off
// the pre-tax core total, so the amount to pay is simply the menu total
// less 15%. The cashier still applies the discount in PetPooja at billing.

import { MENU, photoSlug } from './menuData';

/** The partner offer printed on the coupon card and set up in PetPooja. */
export const NAIL_OFFER = Object.freeze({
  code: 'BNB-NAIL15',
  percentOff: 15,
  minimumBill: 199,
  validUntil: '31 Dec 2026',
  whatsappNumber: '919330697501',
});

/**
 * Best sellers by POS quantity, hot and cold combined, from the PetPooja
 * item-wise sales report for 1 Jul to 30 Sep 2026. Refresh from a newer
 * report when the menu or the season changes.
 */
export const TOP_DRINK_NAMES = Object.freeze([
  'Caramel Boba Coffee',
  'Taiwan Classic Boba',
  'Choco Ice Swirl',
  'Royal Taro Mist',
  'Cafe Mocha',
  'Biscoff Boba Coffee',
  'Lychee Blossom Fizz',
  'Blueberry Blend',
  'Peachy Summer Cooler',
  'Strawberry Chill',
]);

/** Upper bound for one drink at one temperature; stops fat-finger orders. */
export const MAX_QUANTITY_PER_LINE = 20;

/** Temperatures in display order, with the labels PetPooja bills them under. */
export const TEMPERATURES = Object.freeze(['cold', 'hot']);
export const TEMPERATURE_LABELS = Object.freeze({ cold: 'Cold', hot: 'Hot' });

/**
 * Looks each named drink up in the menu's temperature-priced categories.
 *
 * @param {string[]} names Drink names, in the order the page shows them.
 * @param {Array<{type: string, items: Array<Object>}>} menu Categories shaped like MENU.
 * @returns {Array<{name: string, desc: string, hot: ?number, cold: ?number, photo: string}>}
 *     One entry per name, with the photo path /menu uses.
 * @throws {Error} When a name is not a temperature-priced drink on the menu,
 *     so a renamed menu item fails the tests instead of vanishing from /nail.
 */
export function resolveDrinks(names, menu) {
  const drinksByName = new Map();
  menu
    .filter((category) => category.type === 'temp')
    .forEach((category) => category.items.forEach((item) => drinksByName.set(item.name, item)));
  return names.map((name) => {
    const item = drinksByName.get(name);
    if (!item) {
      throw new Error(`Drink is not on the menu: ${name}`);
    }
    return {
      name: item.name,
      desc: item.desc,
      hot: item.hot,
      cold: item.cold,
      photo: `/menu-photos/${photoSlug(item.name)}.webp`,
    };
  });
}

/** The drinks /nail shows, resolved once at load. */
export const NAIL_DRINKS = resolveDrinks(TOP_DRINK_NAMES, MENU);

/**
 * Builds the key for one drink at one temperature in the quantities map.
 *
 * @param {string} name Drink name.
 * @param {string} temperature 'cold' or 'hot'.
 * @returns {string} The map key.
 */
export function lineKey(name, temperature) {
  return `${name}|${temperature}`;
}

/**
 * Forces a requested quantity into a whole number from 0 to MAX_QUANTITY_PER_LINE.
 *
 * @param {number} quantity Requested quantity; may be negative, fractional or NaN.
 * @returns {number} The clamped quantity.
 */
export function clampQuantity(quantity) {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.min(MAX_QUANTITY_PER_LINE, Math.max(0, Math.trunc(quantity)));
}

/**
 * Turns the quantities map into priced order lines, in page order, cold before hot.
 * Lines with no quantity, or for a temperature the drink is not sold at, are dropped.
 *
 * @param {Object<string, number>} quantities Quantities keyed by lineKey().
 * @param {Array<Object>} drinks Drinks as returned by resolveDrinks().
 * @returns {Array<{name: string, temperature: string, unitPrice: number, quantity: number, lineTotal: number}>}
 */
export function orderLines(quantities, drinks) {
  const lines = [];
  drinks.forEach((drink) => {
    TEMPERATURES.forEach((temperature) => {
      const unitPrice = drink[temperature];
      const quantity = clampQuantity(quantities[lineKey(drink.name, temperature)] ?? 0);
      if (unitPrice == null || quantity === 0) {
        return;
      }
      lines.push({ name: drink.name, temperature, unitPrice, quantity, lineTotal: unitPrice * quantity });
    });
  });
  return lines;
}

/**
 * Sums the menu prices of the order lines.
 *
 * @param {Array<{lineTotal: number}>} lines Order lines.
 * @returns {number} Menu total in rupees, before tax and discount.
 */
export function orderSubtotal(lines) {
  return lines.reduce((total, line) => total + line.lineTotal, 0);
}

/**
 * Counts drinks across all order lines.
 *
 * @param {Array<{quantity: number}>} lines Order lines.
 * @returns {number} Number of drinks.
 */
export function drinkCount(lines) {
  return lines.reduce((count, line) => count + line.quantity, 0);
}

/**
 * Works out the coupon saving, rounded to the rupee.
 *
 * @param {number} subtotal Menu total in rupees, GST included.
 * @param {{percentOff: number, minimumBill: number}} offer The offer.
 * @returns {number} The saving, or 0 below the minimum bill.
 */
export function couponSaving(subtotal, offer = NAIL_OFFER) {
  if (subtotal < offer.minimumBill) {
    return 0;
  }
  return Math.round((subtotal * offer.percentOff) / 100);
}

/**
 * Works out what the customer pays once the coupon is applied.
 *
 * @param {number} subtotal Menu total in rupees, GST included.
 * @param {{percentOff: number, minimumBill: number}} offer The offer.
 * @returns {number} Amount to pay in rupees.
 */
export function amountToPay(subtotal, offer = NAIL_OFFER) {
  return subtotal - couponSaving(subtotal, offer);
}

/**
 * Says what still stops the order being sent.
 *
 * @param {{lines: Array, customerName: string, studioName: string}} order The order so far.
 * @returns {?string} The first missing piece, or null when the order is complete.
 */
export function missingForOrder({ lines, customerName, studioName }) {
  if (lines.length === 0) {
    return 'Pick at least one drink';
  }
  if (!customerName.trim()) {
    return 'Add your name';
  }
  if (!studioName.trim()) {
    return 'Add your nail studio';
  }
  return null;
}

// Collapses line breaks and runs of spaces so one field stays on one line.
function singleLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Writes the WhatsApp message the shop receives. It always starts with
 * "NAIL ORDER" so staff can search for these chats.
 *
 * @param {{lines: Array, customerName: string, studioName: string, note: (string|undefined)}} order
 *     A complete order.
 * @param {Object} offer The offer; defaults to NAIL_OFFER.
 * @returns {string} The message text, using WhatsApp's *bold* markup for the header.
 * @throws {Error} When the order is incomplete, so a blank order can never be built.
 */
export function buildOrderMessage({ lines, customerName, studioName, note = '' }, offer = NAIL_OFFER) {
  const missing = missingForOrder({ lines, customerName, studioName });
  if (missing) {
    throw new Error(`Order is incomplete: ${missing}`);
  }
  const subtotal = orderSubtotal(lines);
  const saving = couponSaving(subtotal, offer);
  const billLines = saving > 0
    ? [`Coupon ${offer.code} (${offer.percentOff}% off): -₹${saving}`, `*To pay: ₹${amountToPay(subtotal, offer)}*`]
    : [`*To pay: ₹${subtotal}*`, `(${offer.code} starts at ₹${offer.minimumBill}, so no discount on this order)`];
  const message = [
    `*NAIL ORDER · ${offer.code}*`,
    `Studio: ${singleLine(studioName)}`,
    `Name: ${singleLine(customerName)}`,
    '',
    ...lines.map(
      (line) => `${line.quantity} x ${line.name} (${TEMPERATURE_LABELS[line.temperature]}) = ₹${line.lineTotal}`
    ),
    '',
    `Menu total: ₹${subtotal}`,
    ...billLines,
  ];
  const cleanNote = singleLine(note);
  if (cleanNote) {
    message.push(`Note: ${cleanNote}`);
  }
  return message.join('\n');
}

/**
 * Builds the click-to-chat link that opens WhatsApp with the message typed in.
 *
 * @param {string} message Message text.
 * @param {{whatsappNumber: string}} offer The offer; defaults to NAIL_OFFER.
 * @returns {string} A wa.me URL.
 */
export function whatsappOrderUrl(message, offer = NAIL_OFFER) {
  return `https://wa.me/${offer.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
