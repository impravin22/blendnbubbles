import { filterRows, kpis, groupSum, groupOrders, topDrinks, heatmapGrid } from './reportsData';

const ROWS = [
  { drink: 'Coffee', category: 'Coffee', qty: 2, revenue: 200, hour: 20, dow: 5, week: '2026-05-04', order_type: 'Dine In', payment: 'UPI', inv: 1 },
  { drink: 'Tea', category: 'Milk Tea', qty: 1, revenue: 100, hour: 20, dow: 5, week: '2026-05-04', order_type: 'Pick Up', payment: 'Cash', inv: 1 }, // same invoice as above
  { drink: 'Coffee', category: 'Coffee', qty: 1, revenue: 100, hour: 18, dow: 6, week: '2026-05-11', order_type: 'Dine In', payment: 'UPI', inv: 2 },
];

describe('filterRows', () => {
  test('empty selection returns every row', () => {
    expect(filterRows(ROWS, {}).length).toBe(3);
  });

  test('an empty set for a dimension is ignored', () => {
    expect(filterRows(ROWS, { hour: new Set() }).length).toBe(3);
  });

  test('single dimension filters', () => {
    expect(filterRows(ROWS, { hour: new Set([20]) }).length).toBe(2);
  });

  test('multiple values within a dimension are OR', () => {
    expect(filterRows(ROWS, { hour: new Set([20, 18]) }).length).toBe(3);
  });

  test('across dimensions is AND (intersection)', () => {
    const result = filterRows(ROWS, { hour: new Set([20]), drink: new Set(['Coffee']) });
    expect(result.map((r) => r.inv)).toEqual([1]);
  });
});

describe('kpis', () => {
  test('orders count distinct invoices, items/revenue sum', () => {
    expect(kpis(ROWS)).toEqual({ orders: 2, items: 4, revenue: 400, aov: 200 });
  });

  test('empty rows yield zeroes with no divide-by-zero', () => {
    expect(kpis([])).toEqual({ orders: 0, items: 0, revenue: 0, aov: 0 });
  });
});

describe('groupSum', () => {
  test('sums a field by key', () => {
    const map = groupSum(ROWS, 'hour', 'qty');
    expect(map.get(20)).toBe(3);
    expect(map.get(18)).toBe(1);
  });
});

describe('groupOrders', () => {
  test('counts distinct invoices per key (not rows)', () => {
    const map = groupOrders(ROWS, 'payment');
    expect(map.get('UPI')).toBe(2); // inv 1 and inv 2
    expect(map.get('Cash')).toBe(1); // inv 1 only
  });
});

describe('topDrinks', () => {
  test('ranks by quantity desc with summed revenue', () => {
    const top = topDrinks(ROWS, 10);
    expect(top[0]).toEqual({ drink: 'Coffee', qty: 3, revenue: 300 });
    expect(top[1]).toEqual({ drink: 'Tea', qty: 1, revenue: 100 });
  });

  test('respects the limit', () => {
    expect(topDrinks(ROWS, 1).length).toBe(1);
  });

  test('empty rows yield an empty list', () => {
    expect(topDrinks([], 10)).toEqual([]);
  });
});

describe('heatmapGrid', () => {
  test('builds a 7-row day x hour quantity grid', () => {
    const grid = heatmapGrid(ROWS, [18, 20]);
    expect(grid).toHaveLength(7);
    const sat = grid.find((r) => r.dow === 5);
    expect(sat.counts[20]).toBe(3);
    expect(sat.counts[18]).toBe(0);
    const sun = grid.find((r) => r.dow === 6);
    expect(sun.counts[18]).toBe(1);
  });
});
