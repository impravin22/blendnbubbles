import fs from 'fs';
import path from 'path';
import { MENU } from './menuData';
import PARTNER_LIST from './partnerOffers.json';
import {
  PARTNER_TERMS,
  PARTNERS,
  TOP_DRINK_NAMES,
  ORDER_DRINKS,
  MAX_QUANTITY_PER_LINE,
  validatePartners,
  findPartner,
  offerFor,
  resolveDrinks,
  lineKey,
  clampQuantity,
  orderLines,
  orderSubtotal,
  drinkCount,
  couponSaving,
  amountToPay,
  missingForOrder,
  buildOrderMessage,
  whatsappOrderUrl,
  PARTNER_KINDS,
} from './partnerOrderData';

const drink = (name) => ORDER_DRINKS.find((item) => item.name === name);
const OH_NAILS = offerFor(findPartner('oh-nails'));
const partner = (overrides) => ({ slug: 'test-venue', name: 'Test Venue', kind: 'parlour', code: 'BNB-TEST', ...overrides });

describe('partners', () => {
  test('the five signed partners, each with its own slug, kind and code', () => {
    // slug is the printed URL and kind picks the hero copy, so both are pinned
    // here: changing either silently would reprint wrong or reword a live page.
    expect(PARTNERS.map((item) => [item.slug, item.name, item.kind, item.code])).toEqual([
      ['oh-nails', 'Oh Nails', 'nail', 'BNB-OH-NAIL'],
      ['artifice-studio', 'Artifice Studio', 'tattoo', 'BNB-ARTIFICE'],
      ['kanchiwala', 'Kanchiwala', 'parlour', 'BNB-KANCHIWALA'],
      ['headliners', 'Headliners', 'parlour', 'BNB-HEADLINERS'],
      ['maroon', 'Maroon', 'parlour', 'BNB-MAROON'],
    ]);
  });

  test('the hero copy for each kind, pinned literally', () => {
    // Deriving this from PARTNER_KINDS would be tautological: garbling the
    // copy would move the expectation with it. Verified by mutation — editing
    // any string below fails this test.
    expect(PARTNER_KINDS.nail).toMatchObject({ title: 'Fresh set?', titleAccent: 'Fresh sip.' });
    expect(PARTNER_KINDS.tattoo).toMatchObject({ title: 'Fresh ink?', titleAccent: 'Cold drink.' });
    expect(PARTNER_KINDS.parlour).toMatchObject({ title: 'Fresh look?', titleAccent: 'Fresh sip.' });
    Object.values(PARTNER_KINDS).forEach((copy) => {
      expect(copy.lede.trim().length).toBeGreaterThan(0);
    });
  });

  test('findPartner returns the partner for a known slug and null otherwise', () => {
    expect(findPartner('maroon').name).toBe('Maroon');
    expect(findPartner('nope')).toBeNull();
    expect(findPartner('')).toBeNull();
    expect(findPartner(undefined)).toBeNull();
  });

  test('offerFor combines the shared terms with the partner code and name', () => {
    expect(OH_NAILS).toEqual({ ...PARTNER_TERMS, code: 'BNB-OH-NAIL', partnerName: 'Oh Nails' });
  });

  test('validatePartners accepts the shipped list unchanged', () => {
    expect(validatePartners(PARTNER_LIST)).toEqual(PARTNER_LIST);
    expect(validatePartners([])).toEqual([]);
  });

  test.each([
    [partner({ slug: 'Bad Slug' }), 'Bad partner slug: Bad Slug'],
    [partner({ slug: '../etc' }), 'Bad partner slug: ../etc'],
    [partner({ code: 'bnb-lower' }), 'Bad partner code: bnb-lower'],
    [partner({ code: 'NAIL15' }), 'Bad partner code: NAIL15'],
    [partner({ kind: 'spa' }), 'Unknown partner kind: spa'],
    [partner({ name: '  ' }), 'Partner test-venue has no name'],
  ])('validatePartners rejects %o', (bad, message) => {
    expect(() => validatePartners([bad])).toThrow(message);
  });

  test('validatePartners rejects a reused slug or code', () => {
    expect(() => validatePartners([partner(), partner({ code: 'BNB-OTHER' })])).toThrow('Duplicate partner slug: test-venue');
    expect(() => validatePartners([partner(), partner({ slug: 'other' })])).toThrow('Duplicate partner code: BNB-TEST');
  });
});

describe('the drink list', () => {
  test('shows ten distinct best sellers, all still on the menu', () => {
    expect(TOP_DRINK_NAMES).toHaveLength(10);
    expect(new Set(TOP_DRINK_NAMES).size).toBe(10);
    expect(ORDER_DRINKS.map((item) => item.name)).toEqual([...TOP_DRINK_NAMES]);
  });

  test('every drink has a photo file the page can load', () => {
    ORDER_DRINKS.forEach((item) => {
      expect(fs.existsSync(path.join(__dirname, '..', 'public', item.photo))).toBe(true);
    });
  });

  test('resolveDrinks fails loudly for a renamed or missing drink', () => {
    expect(() => resolveDrinks(['Not A Real Drink'], MENU)).toThrow('Drink is not on the menu: Not A Real Drink');
  });

  test('resolveDrinks ignores toppings, which have no temperatures', () => {
    expect(() => resolveDrinks(['Tapioca (Boba)'], MENU)).toThrow();
  });

  test('resolveDrinks of nothing is nothing', () => {
    expect(resolveDrinks([], MENU)).toEqual([]);
  });
});

describe('clampQuantity', () => {
  test.each([
    [3, 3],
    [0, 0],
    [-2, 0],
    [2.7, 2],
    [MAX_QUANTITY_PER_LINE + 5, MAX_QUANTITY_PER_LINE],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('clampQuantity(%p) is %p', (input, expected) => {
    expect(clampQuantity(input)).toBe(expected);
  });
});

describe('orderLines', () => {
  test('prices each chosen drink and temperature, cold before hot', () => {
    const quantities = {
      [lineKey('Caramel Boba Coffee', 'hot')]: 1,
      [lineKey('Caramel Boba Coffee', 'cold')]: 2,
    };
    expect(orderLines(quantities, ORDER_DRINKS)).toEqual([
      { name: 'Caramel Boba Coffee', temperature: 'cold', unitPrice: 179, quantity: 2, lineTotal: 358 },
      { name: 'Caramel Boba Coffee', temperature: 'hot', unitPrice: 149, quantity: 1, lineTotal: 149 },
    ]);
  });

  test('drops zero quantities and temperatures a drink is not sold at', () => {
    expect(drink('Cafe Mocha').hot).toBeNull();
    const quantities = {
      [lineKey('Cafe Mocha', 'hot')]: 3,
      [lineKey('Royal Taro Mist', 'cold')]: 0,
    };
    expect(orderLines(quantities, ORDER_DRINKS)).toEqual([]);
  });

  test('sums the bill and the drink count across several drinks', () => {
    // 2 x Caramel cold (179) = 358, 1 x Caramel hot (149) = 149,
    // 1 x Royal Taro Mist cold (179) = 179. Total 686 over 4 drinks.
    const quantities = {
      [lineKey('Caramel Boba Coffee', 'cold')]: 2,
      [lineKey('Caramel Boba Coffee', 'hot')]: 1,
      [lineKey('Royal Taro Mist', 'cold')]: 1,
    };
    const lines = orderLines(quantities, ORDER_DRINKS);
    expect(lines).toHaveLength(3);
    expect(orderSubtotal(lines)).toBe(686);
    expect(drinkCount(lines)).toBe(4);
  });

  test('an empty order has no lines, no drinks and a zero total', () => {
    const lines = orderLines({}, ORDER_DRINKS);
    expect(lines).toEqual([]);
    expect(orderSubtotal(lines)).toBe(0);
    expect(drinkCount(lines)).toBe(0);
  });
});

describe('the bill', () => {
  test('no coupon below the minimum bill', () => {
    expect(couponSaving(PARTNER_TERMS.minimumBill - 1, OH_NAILS)).toBe(0);
    expect(amountToPay(PARTNER_TERMS.minimumBill - 1, OH_NAILS)).toBe(PARTNER_TERMS.minimumBill - 1);
  });

  test('coupon applies from exactly the minimum bill, rounded to the rupee', () => {
    expect(couponSaving(199, OH_NAILS)).toBe(30); // 29.85
    expect(amountToPay(199, OH_NAILS)).toBe(169);
  });

  test('a typical two-drink order', () => {
    expect(couponSaving(358, OH_NAILS)).toBe(54); // 53.7
    expect(amountToPay(358, OH_NAILS)).toBe(304);
  });

  test('nothing ordered, nothing to pay', () => {
    expect(couponSaving(0, OH_NAILS)).toBe(0);
    expect(amountToPay(0, OH_NAILS)).toBe(0);
  });
});

describe('missingForOrder', () => {
  const lines = [{ name: 'Royal Taro Mist', temperature: 'cold', unitPrice: 179, quantity: 1, lineTotal: 179 }];

  test('asks for drinks first, then the name', () => {
    expect(missingForOrder({ lines: [], customerName: 'Priya' })).toBe('Pick at least one drink');
    expect(missingForOrder({ lines, customerName: '' })).toBe('Add your name');
  });

  test('whitespace does not count as a name', () => {
    expect(missingForOrder({ lines, customerName: ' \n\t ' })).toBe('Add your name');
  });

  test('a complete order has nothing missing', () => {
    expect(missingForOrder({ lines, customerName: 'Priya' })).toBeNull();
  });
});

describe('buildOrderMessage', () => {
  const twoTaro = orderLines({ [lineKey('Royal Taro Mist', 'cold')]: 2 }, ORDER_DRINKS);

  test('writes a searchable order that names the partner and the discounted amount to pay', () => {
    const message = buildOrderMessage({ lines: twoTaro, customerName: 'Priya', note: 'less ice' }, OH_NAILS);
    expect(message).toBe([
      '*BNB ORDER · BNB-OH-NAIL*',
      'Partner: Oh Nails',
      'Name: Priya',
      '',
      '2 x Royal Taro Mist (Cold) = ₹358',
      '',
      'Menu total: ₹358',
      'Coupon BNB-OH-NAIL (15% off): -₹54',
      '*To pay: ₹304*',
      'Note: less ice',
    ].join('\n'));
  });

  test('each partner gets its own code and name in the order', () => {
    const maroon = offerFor(findPartner('maroon'));
    const message = buildOrderMessage({ lines: twoTaro, customerName: 'Priya' }, maroon);
    expect(message.startsWith('*BNB ORDER · BNB-MAROON*\nPartner: Maroon\n')).toBe(true);
    expect(message).toContain('Coupon BNB-MAROON (15% off): -₹54');
  });

  test('below the minimum it says the full amount and why there is no discount', () => {
    const oneSoda = orderLines({ [lineKey('Lychee Blossom Fizz', 'cold')]: 1 }, ORDER_DRINKS);
    const message = buildOrderMessage({ lines: oneSoda, customerName: 'Priya' }, OH_NAILS);
    expect(message).toContain('*To pay: ₹120*');
    expect(message).toContain('(BNB-OH-NAIL starts at ₹199, so no discount on this order)');
    expect(message).not.toContain('Coupon BNB-OH-NAIL');
    expect(message).not.toContain('Note:');
  });

  test('keeps each field on one line so the order stays readable', () => {
    const message = buildOrderMessage({ lines: twoTaro, customerName: '  Priya\nSen ', note: '  ' }, OH_NAILS);
    expect(message).toContain('Name: Priya Sen');
    expect(message).not.toContain('Note:');
  });

  test('refuses to build an incomplete order', () => {
    expect(() => buildOrderMessage({ lines: [], customerName: 'Priya' }, OH_NAILS))
      .toThrow('Order is incomplete: Pick at least one drink');
  });
});

describe('whatsappOrderUrl', () => {
  test('opens a chat with the shop and the message typed in', () => {
    const url = whatsappOrderUrl('*BNB ORDER*\n2 x Tea = ₹358 & more', OH_NAILS);
    expect(url.startsWith('https://wa.me/919330697501?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('*BNB ORDER*\n2 x Tea = ₹358 & more');
  });

  test('percent-encodes the characters that would otherwise truncate the order', () => {
    // Round-tripping through decodeURIComponent would also pass for an encoder
    // that emitted the text raw, so assert the encoded query directly. A bare
    // & ends the parameter and a bare # starts the fragment: either silently
    // cuts the order short on the shop's phone.
    const query = whatsappOrderUrl('Tea & Boba\n#1 order', OH_NAILS).split('?text=')[1];
    expect(query).toContain('%26');
    expect(query).toContain('%0A');
    expect(query).toContain('%23');
    expect(query).not.toContain('&');
    expect(query).not.toContain('#');
    expect(query).not.toContain(' ');
  });
});
