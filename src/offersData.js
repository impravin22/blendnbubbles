// ─── BlendNBubbles live delivery-platform offers ─────────────
// Single source of truth for the offers block on the /offers page.
//
// These mirror what is actually configured in the Zomato Restaurant Partner
// dashboard and the Swiggy Partner portal. When an offer is created, paused or
// stopped on either platform, update this file and redeploy — nothing else
// needs touching.
//
// `LAST_VERIFIED` is shown to nobody, but it tells the next person editing this
// how stale the list might be. Bump it whenever the offers are re-checked
// against the partner dashboards.
//
// Field notes:
//   headline  – the number or phrase that carries the offer (largest type)
//   cap       – optional "up to ₹X" qualifier that follows the headline
//   who       – which customers the platform targets this at
//   condition – minimum order value or other gate, customer-facing wording
//   code      – Swiggy coupon code; Zomato applies its offers automatically
//   items     – optional list of the exact drinks an offer is limited to, so a
//               customer can see what qualifies without opening the app
//   isNew     – flags a recently launched offer with a "New" badge

export const LAST_VERIFIED = '2026-09-16';

export const ORDER_LINKS = {
  zomato: 'https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order',
  swiggy: 'https://www.swiggy.com/city/kolkata/blend-n-bubbles-barrackpore-rest1401296',
};

// Both platforms limit the Buy 1 Get 1 to these seven Fruit Teas, exactly as
// the offer item pickers list them. Kept here rather than derived from
// menuData so the offer stays truthful even if the menu is reorganised.
export const BOGO_FRUIT_TEAS = [
  'Taiwan Pink Guava Splash',
  'Raw Mango Mist Pop',
  'Tropical Pineapple Pop',
  'Passion Fruit Rush',
  'Orange Ginger Spark',
  'Mango Jade Splash',
  'Kiwi Island Tea',
];

export const PLATFORM_OFFERS = [
  {
    id: 'zomato',
    name: 'Zomato',
    note: 'Applied automatically at checkout',
    link: ORDER_LINKS.zomato,
    offers: [
      {
        id: 'z-b1g1',
        headline: 'Buy 1 Get 1',
        who: 'Everyone, on all seven Fruit Teas',
        condition: 'No minimum order · all of September',
        items: BOGO_FRUIT_TEAS,
        isNew: true,
      },
      {
        id: 'z-free-nachos',
        headline: 'Free Loaded Nachos',
        who: 'On orders above ₹349',
        condition: 'All customers · every day',
      },
      {
        id: 'z-first-order',
        headline: '40% off',
        cap: 'up to ₹80',
        who: 'Your first order',
        condition: 'Min order ₹149 · excludes MRP items',
      },
      {
        id: 'z-everyone',
        headline: '20% off',
        cap: 'up to ₹50',
        who: 'Everyone, every order',
        condition: 'Min order ₹159 · excludes MRP items',
      },
    ],
    footnote:
      'No codes to remember. Zomato applies your best available offer to the cart automatically.',
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    note: 'Apply the code at checkout',
    link: ORDER_LINKS.swiggy,
    offers: [
      {
        id: 's-b1g1',
        headline: 'Buy 1 Get 1',
        who: 'Everyone, on all seven Fruit Teas',
        condition: 'No minimum order',
        code: 'BUY1GET1',
        items: BOGO_FRUIT_TEAS,
        isNew: true,
      },
      {
        id: 's-trynew',
        headline: '30% off',
        cap: 'up to ₹75',
        who: 'New to BlendNBubbles',
        condition: 'Min order ₹179',
        code: 'TRYNEW',
      },
      {
        id: 's-swiggyit',
        headline: '15% off',
        cap: 'up to ₹45',
        who: 'Ordering again',
        condition: 'Min order ₹179',
        code: 'SWIGGYIT',
      },
      {
        id: 's-missedyou',
        headline: '15% off',
        cap: 'up to ₹45',
        who: 'Been a while? Come back',
        condition: 'Min order ₹179',
        code: 'MISSEDYOU',
      },
    ],
    footnote:
      'Bank and UPI offers stack on top. Look for SBI, Visa and BHIM UPI deals at checkout.',
  },
];

// Running at the counter only, so it sits outside PLATFORM_OFFERS and outside
// countOffers() — the hero counts app offers, and this one cannot be ordered
// through either app.
export const IN_STORE_OFFER = {
  id: 'pos-monsoon-bogo',
  headline: 'Buy 1 Get 1',
  who: 'Walk in and ask — Lychee and Peach sodas',
  condition: 'At the counter only · not on the apps',
};

// Bundled prices that hold in store and on both platforms.
export const COMBOS = [
  { id: 'nachos-boba', name: 'Nachos + Boba', price: 299 },
  { id: 'boba-soda', name: 'Boba + Soda', price: 329 },
  { id: 'flavoured-boba-soda', name: 'Taro / Thai / Vanilla + Soda', price: 329 },
];

/**
 * Total number of live platform offers, used for the page lede so the count
 * never drifts out of step with the list.
 *
 * @returns {number} count of offers across every platform
 */
export function countOffers() {
  return PLATFORM_OFFERS.reduce((total, platform) => total + platform.offers.length, 0);
}
