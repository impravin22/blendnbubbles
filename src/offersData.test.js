import {
  PLATFORM_OFFERS, COMBOS, ORDER_LINKS, LAST_VERIFIED, IN_STORE_OFFER,
  BOGO_FRUIT_TEAS, PASSIONFRUIT_DRINKS, countOffers,
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

describe('the line-up as of 16 September 2026', () => {
  // These assertions exist so a stale offer cannot survive a careless edit:
  // the page is a promise to a customer standing in front of the app.
  const zomato = PLATFORM_OFFERS.find((p) => p.id === 'zomato');
  const swiggy = PLATFORM_OFFERS.find((p) => p.id === 'swiggy');

  it('runs four live offers on each platform', () => {
    expect(zomato.offers).toHaveLength(4);
    expect(swiggy.offers).toHaveLength(4);
    expect(countOffers()).toBe(8);
  });

  it('runs the Buy 1 Get 1 on Swiggy only, since Zomato\'s copy was stopped', () => {
    // PetPooja allows one Zomato discount per outlet. The Fruit Tea BOGO held
    // that slot, took zero Zomato orders in sixteen days, and was stopped on
    // 16 September so the passionfruit discount could use it.
    expect(swiggy.offers[0].id).toBe('s-b1g1');
    expect(swiggy.offers[0].headline).toBe('Buy 1 Get 1');
    expect(swiggy.offers[0].items).toBe(BOGO_FRUIT_TEAS);
    expect(swiggy.offers[0].condition).toMatch(/swiggy only/i);
    expect(zomato.offers.map((offer) => offer.headline)).not.toContain('Buy 1 Get 1');
  });

  it('leads Zomato with the passionfruit discount, badged new', () => {
    const offer = zomato.offers[0];
    expect(offer.id).toBe('z-passionfruit');
    expect(offer.headline).toBe('30% off');
    expect(offer.isNew).toBe(true);
    expect(offer.condition).toMatch(/no minimum order/i);
    expect(offer.items).toBe(PASSIONFRUIT_DRINKS);
  });

  it('scopes the passionfruit discount to the two drinks still on the menu', () => {
    // Pomelo Passion Twist is in older price exports but is delisted, and
    // "Passion Matcha Twist" never existed at all. Neither belongs here.
    expect(PASSIONFRUIT_DRINKS).toEqual(['Passion Fruit Rush', 'Exotic Passion Splash']);
    expect(PASSIONFRUIT_DRINKS).not.toContain('Pomelo Passion Twist');
    expect(PASSIONFRUIT_DRINKS.some((drink) => /matcha/i.test(drink))).toBe(false);
  });

  it('carries no Buy 2 Get 1 anywhere — that offer went inactive', () => {
    const headlines = PLATFORM_OFFERS.flatMap((p) => p.offers.map((o) => o.headline));
    expect(headlines).not.toContain('Buy 2 Get 1');
  });

  it('keeps the Fruit Tea list at seven distinct drinks', () => {
    expect(BOGO_FRUIT_TEAS).toHaveLength(7);
    expect(new Set(BOGO_FRUIT_TEAS).size).toBe(7);
    expect(swiggy.offers[0].items).toBe(BOGO_FRUIT_TEAS);
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

  it('carries TRYNEW at 30% capped at ₹75, cut from 50% on 16 September', () => {
    // The 50% version spent ₹2,897 over three months for 29 first orders and
    // zero repeats. If anyone restores it, this test is the tripwire.
    const trynew = swiggy.offers.find((offer) => offer.id === 's-trynew');
    expect(trynew.headline).toBe('30% off');
    expect(trynew.cap).toBe('up to ₹75');
    expect(trynew.condition).toBe('Min order ₹179');
  });

  it('runs no offer deeper than 40% off on Swiggy', () => {
    const rates = swiggy.offers
      .map((offer) => Number((offer.headline.match(/^(\d+)% off$/) || [])[1]))
      .filter((rate) => !Number.isNaN(rate));
    expect(rates.length).toBeGreaterThan(0);
    rates.forEach((rate) => expect(rate).toBeLessThanOrEqual(40));
  });

  it('spells out the MRP exclusion on the two percentage offers', () => {
    ['z-first-order', 'z-everyone'].forEach((id) => {
      expect(zomato.offers.find((o) => o.id === id).condition).toMatch(/excludes MRP items/);
    });
  });

  it('drops the new badge from the nachos offer, live since 7 August', () => {
    expect(zomato.offers.find((o) => o.id === 'z-free-nachos').isNew).toBeUndefined();
  });

  it('badges only the passionfruit discount, the one that launched today', () => {
    // The Swiggy BOGO lost its badge at sixteen days old.
    const badged = PLATFORM_OFFERS.flatMap((p) => p.offers).filter((o) => o.isNew);
    expect(badged.map((o) => o.id)).toEqual(['z-passionfruit']);
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

  it('was re-verified against the dashboards when TRYNEW was cut to 30%', () => {
    expect(LAST_VERIFIED).toBe('2026-09-16');
  });
});
