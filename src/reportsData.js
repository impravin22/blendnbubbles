// Pure, framework-free aggregation helpers for the cross-filter dashboard.
//
// The dashboard ships a row-level ledger (one entry per sold line item) and
// derives every chart from the rows that match the active selection. Keeping
// these functions pure (no React, no router) makes them unit-testable in
// isolation and keeps Reports.js focused on rendering + selection state.
//
// Row shape: { drink, category, qty, revenue, hour, dow, week, order_type,
//              payment, inv } where dow is 0=Mon..6=Sun and inv is an integer
//              invoice id (real invoice numbers are never shipped).

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Filter rows by a cross-filter selection.
 *
 * @param {Array<Object>} rows - the full ledger.
 * @param {Object<string, Set>} sel - selection sets keyed by dimension. A
 *   dimension with an empty/absent set is ignored. Within a dimension the match
 *   is OR (the row's value is in the set); across dimensions it is AND.
 * @returns {Array<Object>} the matching rows (the same array instance when no
 *   dimension is active, so callers must not mutate it).
 */
export function filterRows(rows, sel) {
  const active = Object.keys(sel).filter((d) => sel[d] && sel[d].size > 0);
  if (active.length === 0) return rows;
  return rows.filter((r) => active.every((d) => sel[d].has(r[d])));
}

/** Top-line KPIs for a set of rows. Orders count distinct invoices. */
export function kpis(rows) {
  const orders = new Set(rows.map((r) => r.inv)).size;
  const items = rows.reduce((acc, r) => acc + r.qty, 0);
  const revenue = round2(rows.reduce((acc, r) => acc + r.revenue, 0));
  const aov = orders ? round2(revenue / orders) : 0;
  return { orders, items, revenue, aov };
}

/** Map of key value -> summed numeric field (e.g. qty by hour). */
export function groupSum(rows, key, field) {
  const out = new Map();
  for (const r of rows) out.set(r[key], (out.get(r[key]) || 0) + r[field]);
  return out;
}

/** Map of key value -> distinct invoice count (used by the order/payment donuts). */
export function groupOrders(rows, key) {
  const sets = new Map();
  for (const r of rows) {
    let set = sets.get(r[key]);
    if (!set) sets.set(r[key], (set = new Set()));
    set.add(r.inv);
  }
  const out = new Map();
  for (const [k, set] of sets) out.set(k, set.size);
  return out;
}

/**
 * Drinks ranked by quantity (desc), each with its summed revenue.
 *
 * @param {Array<Object>} rows - the already cross-filtered rows.
 * @param {number} [limit] - optional cap on how many drinks to return. Omit it
 *   to return every drink (the dashboard shows the full list, not just a top N).
 * @returns {Array<{drink:string,qty:number,revenue:number}>}
 */
export function topDrinks(rows, limit) {
  const qty = new Map();
  const rev = new Map();
  for (const r of rows) {
    qty.set(r.drink, (qty.get(r.drink) || 0) + r.qty);
    rev.set(r.drink, (rev.get(r.drink) || 0) + r.revenue);
  }
  return [...qty.entries()]
    .map(([drink, q]) => ({ drink, qty: q, revenue: round2(rev.get(drink) || 0) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

/** 7-row (Mon..Sun) day x hour quantity grid for the heatmap. */
export function heatmapGrid(rows, hours) {
  const grid = Array.from({ length: 7 }, (_unused, dow) => {
    const counts = {};
    hours.forEach((h) => {
      counts[h] = 0;
    });
    return { dow, counts };
  });
  for (const r of rows) {
    const row = grid[r.dow];
    if (row && row.counts[r.hour] !== undefined) row.counts[r.hour] += r.qty;
  }
  return grid;
}

/**
 * Weekly trend series for the line chart.
 *
 * @param {Array<Object>} rows - the already cross-filtered rows.
 * @param {Array<string>} weeks - ordered week keys (the x-axis); values align to it.
 * @param {Array<string>} drinks - selected drink names. Empty → one combined
 *   "All drinks" series; otherwise one series per drink (the compare lines),
 *   in the given order.
 * @returns {Array<{key:string,label:string,values:number[]}>} one entry per
 *   line, each `values` array aligned to `weeks` (0 where a week has no sales).
 *
 * Note: `weeks` is the canonical axis — rows whose `week` is not in `weeks` are
 * excluded from every series. `drinks` is de-duplicated so callers can't produce
 * two series with the same key (which would collide on React keys downstream).
 */
export function weeklySeries(rows, weeks, drinks) {
  const seriesFor = (subset) => {
    const byWeek = groupSum(subset, 'week', 'qty');
    return weeks.map((w) => byWeek.get(w) || 0);
  };
  const uniqueDrinks = drinks ? [...new Set(drinks)] : [];
  if (uniqueDrinks.length === 0) {
    return [{ key: '__all__', label: 'All drinks', values: seriesFor(rows) }];
  }
  return uniqueDrinks.map((drink) => ({
    key: drink,
    label: drink,
    values: seriesFor(rows.filter((r) => r.drink === drink)),
  }));
}
