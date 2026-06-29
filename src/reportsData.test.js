import { filterRows, kpis, groupSum, groupOrders, topDrinks, heatmapGrid, weeklySeries } from './reportsData';

const ROWS = [
  { drink: 'Coffee', category: 'Coffee', qty: 2, revenue: 200, hour: 20, dow: 5, week: '2026-05-04', month: '2026-05', order_type: 'Dine In', payment: 'UPI', inv: 1 },
  { drink: 'Tea', category: 'Milk Tea', qty: 1, revenue: 100, hour: 20, dow: 5, week: '2026-05-04', month: '2026-05', order_type: 'Pick Up', payment: 'Cash', inv: 1 }, // same invoice as above
  { drink: 'Coffee', category: 'Coffee', qty: 1, revenue: 100, hour: 18, dow: 6, week: '2026-05-11', month: '2026-05', order_type: 'Dine In', payment: 'UPI', inv: 2 },
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

  test('narrows to a single month (the dashboard month filter)', () => {
    const mrows = [
      { drink: 'A', month: '2026-05', qty: 1, revenue: 0, hour: 20, dow: 5, week: '2026-05-04', category: 'x', order_type: 'd', payment: 'c', inv: 1 },
      { drink: 'B', month: '2026-06', qty: 1, revenue: 0, hour: 20, dow: 5, week: '2026-06-01', category: 'x', order_type: 'd', payment: 'c', inv: 2 },
    ];
    expect(filterRows(mrows, { month: new Set(['2026-06']) }).map((r) => r.inv)).toEqual([2]);
    expect(filterRows(mrows, { month: new Set() }).length).toBe(2); // "All time"
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

describe('weeklySeries', () => {
  const WEEKS = ['2026-05-04', '2026-05-11'];

  test('no drinks selected -> single combined "All drinks" series', () => {
    const series = weeklySeries(ROWS, WEEKS, []);
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe('__all__');
    expect(series[0].label).toBe('All drinks');
    expect(series[0].values).toEqual([3, 1]); // week04: 2+1, week11: 1
  });

  test('one series per selected drink, values aligned to weeks', () => {
    const series = weeklySeries(ROWS, WEEKS, ['Coffee', 'Tea']);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ key: 'Coffee', label: 'Coffee', values: [2, 1] });
    expect(series[1]).toEqual({ key: 'Tea', label: 'Tea', values: [1, 0] }); // Tea: no week11 sale -> 0
  });

  test('preserves the given drink order', () => {
    const series = weeklySeries(ROWS, WEEKS, ['Tea', 'Coffee']);
    expect(series.map((s) => s.key)).toEqual(['Tea', 'Coffee']);
  });

  test('a week with no sales for a drink yields 0, not undefined', () => {
    const series = weeklySeries(ROWS, ['2026-05-04', '2026-05-11', '2026-05-18'], ['Tea']);
    expect(series[0].values).toEqual([1, 0, 0]);
  });

  test('empty rows yield a zero-filled all-drinks series', () => {
    expect(weeklySeries([], WEEKS, []).values?.[0]).toBeUndefined();
    expect(weeklySeries([], WEEKS, [])[0].values).toEqual([0, 0]);
  });

  test('a compare drink with no matching rows yields an all-zero series', () => {
    expect(weeklySeries(ROWS, WEEKS, ['Ghost'])[0]).toEqual({ key: 'Ghost', label: 'Ghost', values: [0, 0] });
  });

  test('de-duplicates the drinks argument (no duplicate-key series)', () => {
    const series = weeklySeries(ROWS, WEEKS, ['Coffee', 'Coffee']);
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe('Coffee');
  });

  test('the trend path (drink dim cleared) ignores the drink cross-filter but keeps other filters', () => {
    // Mirrors the production composition: filterRows(rows, {...sel, drink: empty}) -> weeklySeries.
    const rows = [
      { drink: 'A', week: '2026-05-04', dow: 5, qty: 2, hour: 20, inv: 1, category: 'x', revenue: 0, order_type: 'd', payment: 'c' },
      { drink: 'B', week: '2026-05-04', dow: 5, qty: 3, hour: 20, inv: 2, category: 'x', revenue: 0, order_type: 'd', payment: 'c' },
      { drink: 'A', week: '2026-05-04', dow: 6, qty: 9, hour: 20, inv: 3, category: 'x', revenue: 0, order_type: 'd', payment: 'c' }, // Sun — excluded by the dow filter
    ];
    const sel = { dow: new Set([5]), drink: new Set(['A']) };
    const base = filterRows(rows, { ...sel, drink: new Set() });
    const series = weeklySeries(base, ['2026-05-04'], ['A', 'B']);
    // dow filter narrowed A (9 on Sun dropped -> 2); drink filter ignored so B still shows.
    expect(series.map((s) => s.values[0])).toEqual([2, 3]);
  });
});
