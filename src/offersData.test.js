import {
  PLATFORM_OFFERS, COMBOS, ORDER_LINKS, LAST_VERIFIED, IN_STORE_OFFER,
  BOGO_FRUIT_TEAS, countOffers,
} from './offersData';

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

describe('the September 2026 line-up', () => {
  // These assertions exist so a stale offer cannot survive a careless edit:
  // the page is a promise to a customer standing in front of the app.
  const zomato = PLATFORM_OFFERS.find((p) => p.id === 'zomato');
  const swiggy = PLATFORM_OFFERS.find((p) => p.id === 'swiggy');

  it('runs four live offers on each platform', () => {
    expect(zomato.offers).toHaveLength(4);
    expect(swiggy.offers).toHaveLength(4);
    expect(countOffers()).toBe(8);
  });

  it('leads each platform with the Buy 1 Get 1, badged new', () => {
    expect(zomato.offers[0].id).toBe('z-b1g1');
    expect(swiggy.offers[0].id).toBe('s-b1g1');
    [zomato.offers[0], swiggy.offers[0]].forEach((offer) => {
      expect(offer.headline).toBe('Buy 1 Get 1');
      expect(offer.isNew).toBe(true);
      expect(offer.condition).toMatch(/no minimum order/i);
      expect(offer.items).toBe(BOGO_FRUIT_TEAS);
    });
  });

  it('carries no Buy 2 Get 1 anywhere — that offer went inactive', () => {
    const headlines = PLATFORM_OFFERS.flatMap((p) => p.offers.map((o) => o.headline));
    expect(headlines).not.toContain('Buy 2 Get 1');
  });

  it('scopes both platforms to the same seven Fruit Teas', () => {
    expect(BOGO_FRUIT_TEAS).toHaveLength(7);
    expect(new Set(BOGO_FRUIT_TEAS).size).toBe(7);
    expect(zomato.offers[0].items).toBe(BOGO_FRUIT_TEAS);
    expect(swiggy.offers[0].items).toBe(BOGO_FRUIT_TEAS);
    expect(zomato.offers[0].who).toBe(swiggy.offers[0].who);
    expect(swiggy.offers[0].code).toBe('BUY1GET1');
    BOGO_FRUIT_TEAS.forEach((tea) => {
      expect(typeof tea).toBe('string');
      expect(tea.trim()).toBe(tea);
      expect(tea.length).toBeGreaterThan(0);
    });
  });

  it('lists no soda on the Fruit Tea offer', () => {
    expect(BOGO_FRUIT_TEAS.some((tea) => /soda/i.test(tea))).toBe(false);
  });

  it('keeps every live Swiggy coupon code the dashboard shows', () => {
    expect(swiggy.offers.map((o) => o.code))
      .toEqual(['BUY1GET1', 'TRYNEW', 'SWIGGYIT', 'MISSEDYOU']);
  });

  it('spells out the MRP exclusion on the two percentage offers', () => {
    ['z-first-order', 'z-everyone'].forEach((id) => {
      expect(zomato.offers.find((o) => o.id === id).condition).toMatch(/excludes MRP items/);
    });
  });

  it('drops the new badge from the nachos offer, live since 7 August', () => {
    expect(zomato.offers.find((o) => o.id === 'z-free-nachos').isNew).toBeUndefined();
  });

  it('badges exactly the two offers that launched on 1 September', () => {
    const badged = PLATFORM_OFFERS.flatMap((p) => p.offers).filter((o) => o.isNew);
    expect(badged.map((o) => o.id)).toEqual(['z-b1g1', 's-b1g1']);
  });

  it('gives any items list at least one drink, and only strings', () => {
    PLATFORM_OFFERS.flatMap((p) => p.offers)
      .filter((offer) => offer.items)
      .forEach((offer) => {
        expect(Array.isArray(offer.items)).toBe(true);
        expect(offer.items.length).toBeGreaterThan(0);
        offer.items.forEach((item) => expect(typeof item).toBe('string'));
      });
  });

  it('keeps the counter-only offer out of the app count', () => {
    // It cannot be ordered through either app, so counting it in the hero
    // would overstate what a customer can actually tap.
    const appOfferIds = PLATFORM_OFFERS.flatMap((p) => p.offers.map((o) => o.id));
    expect(appOfferIds).not.toContain(IN_STORE_OFFER.id);
    expect(IN_STORE_OFFER.condition).toMatch(/counter/i);
    expect(IN_STORE_OFFER.who).toMatch(/lychee/i);
    expect(IN_STORE_OFFER.who).toMatch(/peach/i);
  });

  it('was verified against the dashboards on the day the offers went live', () => {
    expect(LAST_VERIFIED).toBe('2026-09-01');
  });
});
