import fs from 'fs';
import path from 'path';
import { MENU } from './menuData';
import {
  NAIL_OFFER,
  TOP_DRINK_NAMES,
  NAIL_DRINKS,
  MAX_QUANTITY_PER_LINE,
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
} from './nailOrderData';

const drink = (name) => NAIL_DRINKS.find((item) => item.name === name);

describe('the /nail drink list', () => {
  test('shows ten distinct best sellers, all still on the menu', () => {
    expect(TOP_DRINK_NAMES).toHaveLength(10);
    expect(new Set(TOP_DRINK_NAMES).size).toBe(10);
    expect(NAIL_DRINKS.map((item) => item.name)).toEqual([...TOP_DRINK_NAMES]);
  });

  test('every drink has a photo file the page can load', () => {
    NAIL_DRINKS.forEach((item) => {
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
    expect(orderLines(quantities, NAIL_DRINKS)).toEqual([
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
    expect(orderLines(quantities, NAIL_DRINKS)).toEqual([]);
  });

  test('sums the bill and the drink count across several drinks', () => {
    // 2 x Caramel cold (179) = 358, 1 x Caramel hot (149) = 149,
    // 1 x Royal Taro Mist cold (179) = 179. Total 686 over 4 drinks.
    const quantities = {
      [lineKey('Caramel Boba Coffee', 'cold')]: 2,
      [lineKey('Caramel Boba Coffee', 'hot')]: 1,
      [lineKey('Royal Taro Mist', 'cold')]: 1,
    };
    const lines = orderLines(quantities, NAIL_DRINKS);
    expect(lines).toHaveLength(3);
    expect(orderSubtotal(lines)).toBe(686);
    expect(drinkCount(lines)).toBe(4);
  });

  test('an empty order has no lines, no drinks and a zero total', () => {
    const lines = orderLines({}, NAIL_DRINKS);
    expect(lines).toEqual([]);
    expect(orderSubtotal(lines)).toBe(0);
    expect(drinkCount(lines)).toBe(0);
  });
});

describe('the bill', () => {
  test('no coupon below the minimum bill', () => {
    expect(couponSaving(NAIL_OFFER.minimumBill - 1)).toBe(0);
    expect(amountToPay(NAIL_OFFER.minimumBill - 1)).toBe(NAIL_OFFER.minimumBill - 1);
  });

  test('coupon applies from exactly the minimum bill, rounded to the rupee', () => {
    expect(couponSaving(199)).toBe(30); // 29.85
    expect(amountToPay(199)).toBe(169);
  });

  test('a typical two-drink order', () => {
    expect(couponSaving(358)).toBe(54); // 53.7
    expect(amountToPay(358)).toBe(304);
  });

  test('nothing ordered, nothing to pay', () => {
    expect(couponSaving(0)).toBe(0);
    expect(amountToPay(0)).toBe(0);
  });
});

describe('missingForOrder', () => {
  const lines = [{ name: 'Royal Taro Mist', temperature: 'cold', unitPrice: 179, quantity: 1, lineTotal: 179 }];

  test('asks for drinks first, then name, then studio', () => {
    expect(missingForOrder({ lines: [], customerName: 'Priya', studioName: 'Glossy Tips' })).toBe('Pick at least one drink');
    expect(missingForOrder({ lines, customerName: '', studioName: 'Glossy Tips' })).toBe('Add your name');
    expect(missingForOrder({ lines, customerName: 'Priya', studioName: '' })).toBe('Add your nail studio');
  });

  test('whitespace does not count as a name or studio', () => {
    expect(missingForOrder({ lines, customerName: '   ', studioName: 'Glossy Tips' })).toBe('Add your name');
    expect(missingForOrder({ lines, customerName: 'Priya', studioName: '\n\t' })).toBe('Add your nail studio');
  });

  test('a complete order has nothing missing', () => {
    expect(missingForOrder({ lines, customerName: 'Priya', studioName: 'Glossy Tips' })).toBeNull();
  });
});

describe('buildOrderMessage', () => {
  const twoTaro = orderLines({ [lineKey('Royal Taro Mist', 'cold')]: 2 }, NAIL_DRINKS);

  test('writes a searchable order with the discounted amount to pay', () => {
    const message = buildOrderMessage({ lines: twoTaro, customerName: 'Priya', studioName: 'Glossy Tips', note: 'less ice' });
    expect(message).toBe([
      '*NAIL ORDER · BNB-NAIL15*',
      'Studio: Glossy Tips',
      'Name: Priya',
      '',
      '2 x Royal Taro Mist (Cold) = ₹358',
      '',
      'Menu total: ₹358',
      'Coupon BNB-NAIL15 (15% off): -₹54',
      '*To pay: ₹304*',
      'Note: less ice',
    ].join('\n'));
  });

  test('below the minimum it says the full amount and why there is no discount', () => {
    const oneSoda = orderLines({ [lineKey('Lychee Blossom Fizz', 'cold')]: 1 }, NAIL_DRINKS);
    const message = buildOrderMessage({ lines: oneSoda, customerName: 'Priya', studioName: 'Glossy Tips' });
    expect(message).toContain('*To pay: ₹120*');
    expect(message).toContain('(BNB-NAIL15 starts at ₹199, so no discount on this order)');
    expect(message).not.toContain('Coupon BNB-NAIL15');
    expect(message).not.toContain('Note:');
  });

  test('keeps each field on one line so the order stays readable', () => {
    const message = buildOrderMessage({ lines: twoTaro, customerName: '  Priya\nSen ', studioName: 'Glossy\n\nTips', note: '  ' });
    expect(message).toContain('Name: Priya Sen');
    expect(message).toContain('Studio: Glossy Tips');
    expect(message).not.toContain('Note:');
  });

  test('refuses to build an incomplete order', () => {
    expect(() => buildOrderMessage({ lines: [], customerName: 'Priya', studioName: 'Glossy Tips' }))
      .toThrow('Order is incomplete: Pick at least one drink');
  });
});

describe('whatsappOrderUrl', () => {
  test('opens a chat with the shop and the message typed in', () => {
    const url = whatsappOrderUrl('*NAIL ORDER*\n2 x Tea = ₹358 & more');
    expect(url.startsWith('https://wa.me/919330697501?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('*NAIL ORDER*\n2 x Tea = ₹358 & more');
  });

  test('percent-encodes the characters that would otherwise truncate the order', () => {
    // Round-tripping through decodeURIComponent would also pass for an encoder
    // that emitted the text raw, so assert the encoded query directly. A bare
    // & ends the parameter and a bare # starts the fragment: either silently
    // cuts the order short on the shop's phone.
    const query = whatsappOrderUrl('Tea & Boba\n#1 order').split('?text=')[1];
    expect(query).toContain('%26');
    expect(query).toContain('%0A');
    expect(query).toContain('%23');
    expect(query).not.toContain('&');
    expect(query).not.toContain('#');
    expect(query).not.toContain(' ');
  });
});
