import { PLATFORM_OFFERS, COMBOS, ORDER_LINKS, LAST_VERIFIED, countOffers } from './offersData';

describe('offersData', () => {
  it('covers both delivery platforms', () => {
    expect(PLATFORM_OFFERS.map((p) => p.id)).toEqual(['zomato', 'swiggy']);
  });

  it('counts every offer across platforms', () => {
    const manual = PLATFORM_OFFERS.reduce((total, p) => total + p.offers.length, 0);
    expect(countOffers()).toBe(manual);
    expect(countOffers()).toBeGreaterThan(0);
  });

  it('gives every offer a unique id', () => {
    const ids = PLATFORM_OFFERS.flatMap((p) => p.offers.map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every offer the fields the page renders', () => {
    PLATFORM_OFFERS.flatMap((p) => p.offers).forEach((offer) => {
      expect(typeof offer.headline).toBe('string');
      expect(offer.headline.length).toBeGreaterThan(0);
      expect(typeof offer.who).toBe('string');
      expect(offer.who.length).toBeGreaterThan(0);
      expect(typeof offer.condition).toBe('string');
      expect(offer.condition.length).toBeGreaterThan(0);
    });
  });

  it('only puts coupon codes on Swiggy, since Zomato auto-applies', () => {
    const zomato = PLATFORM_OFFERS.find((p) => p.id === 'zomato');
    const swiggy = PLATFORM_OFFERS.find((p) => p.id === 'swiggy');
    zomato.offers.forEach((offer) => expect(offer.code).toBeUndefined());
    expect(swiggy.offers.some((offer) => typeof offer.code === 'string')).toBe(true);
  });

  it('uses uppercase coupon codes so they match the app exactly', () => {
    PLATFORM_OFFERS.flatMap((p) => p.offers)
      .filter((offer) => offer.code)
      .forEach((offer) => expect(offer.code).toBe(offer.code.toUpperCase()));
  });

  it('points each platform at its own https storefront', () => {
    PLATFORM_OFFERS.forEach((platform) => {
      expect(platform.link).toMatch(/^https:\/\//);
      expect(platform.link).toContain(platform.id);
    });
    expect(ORDER_LINKS.zomato).toMatch(/^https:\/\/www\.zomato\.com\//);
    expect(ORDER_LINKS.swiggy).toMatch(/^https:\/\/www\.swiggy\.com\//);
  });

  it('prices every combo as a positive number', () => {
    expect(COMBOS.length).toBeGreaterThan(0);
    COMBOS.forEach((combo) => {
      expect(typeof combo.price).toBe('number');
      expect(combo.price).toBeGreaterThan(0);
    });
  });

  it('records an ISO date for the last verification against the partner dashboards', () => {
    expect(LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LAST_VERIFIED))).toBe(false);
  });
});
