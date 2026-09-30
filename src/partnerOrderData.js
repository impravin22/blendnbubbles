// ─── Partner order pages (/p/:slug) ──────────────────────────
// Every partner venue (nail studio, tattoo studio, parlour) has its own page
// and coupon code. The QR on that partner's coupon card opens /p/<slug>:
// customers pick drinks and see the bill with the partner's code applied
// before WhatsApp opens, so the shop receives a complete order that already
// says which partner sent it.
//
// Partners live in partnerOffers.json, which scripts/partner-pages.js also
// reads to publish one static page per partner. Prices come from MENU, so
// these pages never disagree with /menu. Menu prices include 5% GST
// (PetPooja bills a ₹120 soda as 114.29 + 5.72 tax), and each partner's
// PetPooja discount comes off the pre-tax core total, so the amount to pay
// is the menu total less the discount. The cashier still applies the
// discount in PetPooja at billing.

import { MENU, photoSlug } from './menuData';
import PARTNER_LIST from './partnerOffers.json';

/** Terms shared by every partner code, matching the PetPooja discounts. */
export const PARTNER_TERMS = Object.freeze({
  percentOff: 15,
  minimumBill: 199,
  validUntil: '31 Dec 2026',
  whatsappNumber: '919330697501',
});

/** Page copy per kind of venue. */
export const PARTNER_KINDS = Object.freeze({
  nail: Object.freeze({
    title: 'Fresh set?',
    titleAccent: 'Fresh sip.',
    lede: 'Boba teas, fruit teas and smoothies while your nails dry.',
  }),
  tattoo: Object.freeze({
    title: 'Fresh ink?',
    titleAccent: 'Cold drink.',
    lede: 'Cold coffees, boba teas and smoothies for the long sit.',
  }),
  parlour: Object.freeze({
    title: 'Fresh look?',
    titleAccent: 'Fresh sip.',
    lede: 'Boba teas, fruit teas and smoothies while you are in the chair.',
  }),
});

// Slugs become URL paths and build folders, so keep them to a-z, 0-9 and single hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_PATTERN = /^BNB-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/**
 * Checks the partner list and freezes each entry.
 *
 * @param {Array<{slug: string, name: string, kind: string, code: string}>} partners Raw partner entries.
 * @returns {Array<Object>} The same partners, frozen.
 * @throws {Error} On a malformed slug or code, an unknown kind, a blank name,
 *     or a slug or code used twice.
 */
export function validatePartners(partners) {
  const slugs = new Set();
  const codes = new Set();
  return partners.map((partner) => {
    if (!SLUG_PATTERN.test(partner.slug)) {
      throw new Error(`Bad partner slug: ${partner.slug}`);
    }
    if (!CODE_PATTERN.test(partner.code)) {
      throw new Error(`Bad partner code: ${partner.code}`);
    }
    if (!PARTNER_KINDS[partner.kind]) {
      throw new Error(`Unknown partner kind: ${partner.kind}`);
    }
    if (typeof partner.name !== 'string' || !partner.name.trim()) {
      throw new Error(`Partner ${partner.slug} has no name`);
    }
    if (slugs.has(partner.slug)) {
      throw new Error(`Duplicate partner slug: ${partner.slug}`);
    }
    if (codes.has(partner.code)) {
      throw new Error(`Duplicate partner code: ${partner.code}`);
    }
    slugs.add(partner.slug);
    codes.add(partner.code);
    return Object.freeze({ ...partner });
  });
}

export const PARTNERS = Object.freeze(validatePartners(PARTNER_LIST));

/**
 * Finds a partner by URL slug.
 *
 * @param {string} slug The :slug route parameter.
 * @param {Array<Object>} partners Partners to search; defaults to PARTNERS.
 * @returns {?Object} The partner, or null for an unknown slug.
 */
export function findPartner(slug, partners = PARTNERS) {
  return partners.find((partner) => partner.slug === slug) ?? null;
}

/**
 * Combines the shared terms with one partner's code and name.
 *
 * @param {{code: string, name: string}} partner A partner.
 * @param {Object} terms Shared terms; defaults to PARTNER_TERMS.
 * @returns {{code: string, partnerName: string, percentOff: number, minimumBill: number,
 *     validUntil: string, whatsappNumber: string}} The partner's offer.
 */
export function offerFor(partner, terms = PARTNER_TERMS) {
  return Object.freeze({ ...terms, code: partner.code, partnerName: partner.name });
}

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
 *     so a renamed menu item fails the tests instead of vanishing from the page.
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

/** The drinks every partner page shows, resolved once at load. */
export const ORDER_DRINKS = resolveDrinks(TOP_DRINK_NAMES, MENU);

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
 * @returns {number} Menu total in rupees, GST included, before the discount.
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
export function couponSaving(subtotal, offer) {
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
export function amountToPay(subtotal, offer) {
  return subtotal - couponSaving(subtotal, offer);
}

/**
 * Says what still stops the order being sent.
 *
 * @param {{lines: Array, customerName: string}} order The order so far.
 * @returns {?string} The first missing piece, or null when the order is complete.
 */
export function missingForOrder({ lines, customerName }) {
  if (lines.length === 0) {
    return 'Pick at least one drink';
  }
  if (!customerName.trim()) {
    return 'Add your name';
  }
  return null;
}

// Collapses line breaks and runs of spaces so one field stays on one line.
function singleLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Writes the WhatsApp message the shop receives. It always starts with
 * "BNB ORDER" and the partner's code, so staff can search for these chats
 * and know which partner sent the customer.
 *
 * @param {{lines: Array, customerName: string, note: (string|undefined)}} order A complete order.
 * @param {Object} offer The partner's offer from offerFor().
 * @returns {string} The message text, using WhatsApp's *bold* markup.
 * @throws {Error} When the order is incomplete, so a blank order can never be built.
 */
export function buildOrderMessage({ lines, customerName, note = '' }, offer) {
  const missing = missingForOrder({ lines, customerName });
  if (missing) {
    throw new Error(`Order is incomplete: ${missing}`);
  }
  const subtotal = orderSubtotal(lines);
  const saving = couponSaving(subtotal, offer);
  const billLines = saving > 0
    ? [`Coupon ${offer.code} (${offer.percentOff}% off): -₹${saving}`, `*To pay: ₹${amountToPay(subtotal, offer)}*`]
    : [`*To pay: ₹${subtotal}*`, `(${offer.code} starts at ₹${offer.minimumBill}, so no discount on this order)`];
  const message = [
    `*BNB ORDER · ${offer.code}*`,
    `Partner: ${offer.partnerName}`,
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
 * @param {{whatsappNumber: string}} offer The offer.
 * @returns {string} A wa.me URL.
 */
export function whatsappOrderUrl(message, offer) {
  return `https://wa.me/${offer.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
