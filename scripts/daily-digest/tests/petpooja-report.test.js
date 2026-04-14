import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItemWiseSalesReport, summariseForDigest } from '../src/petpooja-report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SAMPLE_XLSX = path.join(REPO_ROOT, 'reports/Item_Wise_Sales_Report_2026_02_18_09_22_59.xlsx');

test('parseItemWiseSalesReport extracts date range, restaurant, grand totals from real xlsx', async () => {
  const buf = await fs.readFile(SAMPLE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  assert.equal(report.dateRange, '2026-02-01 to 2026-02-17');
  assert.match(report.restaurantName, /Blend N Bubbles/);
  assert.equal(report.grandTotalQty, 350);
  assert.ok(report.grandTotalRevenue > 50000);
  assert.ok(report.items.length > 20);
});

test('parseItemWiseSalesReport carries category forward across rows until Sub Total', async () => {
  const buf = await fs.readFile(SAMPLE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  const milkTeaItems = report.items.filter((i) => i.category === 'Milk Tea');
  assert.ok(milkTeaItems.length >= 2, 'Milk Tea category should have multiple items');
  const coffeeItems = report.items.filter((i) => i.category === 'Coffee');
  assert.ok(coffeeItems.some((i) => i.name === 'Cafe Mocha'));
  assert.ok(coffeeItems.some((i) => i.name === 'Caramel Boba Coffee'));
});

test('parseItemWiseSalesReport captures per-category subtotals', async () => {
  const buf = await fs.readFile(SAMPLE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  const coffee = report.categories.find((c) => c.name === 'Coffee');
  assert.ok(coffee, 'Coffee category subtotal expected');
  assert.equal(coffee.qty, 61);
});

test('summariseForDigest returns top N items ordered by quantity', async () => {
  const buf = await fs.readFile(SAMPLE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  const summary = summariseForDigest(report, { topN: 3 });
  assert.equal(summary.topItems.length, 3);
  assert.equal(summary.topItems[0].name, 'Caramel Boba Coffee');
  assert.equal(summary.topItems[0].qty, 41);
  assert.ok(summary.topItems[0].qty >= summary.topItems[1].qty);
  assert.ok(summary.topItems[1].qty >= summary.topItems[2].qty);
});

test('summariseForDigest orders top categories by revenue', async () => {
  const buf = await fs.readFile(SAMPLE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  const summary = summariseForDigest(report);
  assert.ok(summary.topCategories.length >= 3);
  for (let i = 1; i < summary.topCategories.length; i++) {
    assert.ok(summary.topCategories[i - 1].total >= summary.topCategories[i].total);
  }
});

test('summariseForDigest returns null for null report', () => {
  assert.equal(summariseForDigest(null), null);
});

test('parseItemWiseSalesReport rejects a template with unexpected headers', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  // Populate rows so row 6 has the wrong headers
  for (let i = 1; i < 6; i++) sheet.addRow([]);
  sheet.addRow(['Foo', 'Bar', 'Baz', 'Qux', 'Quux', 'Corge']);
  sheet.addRow(['Total', null, null, null, 350, 52373]);
  const buffer = await wb.xlsx.writeBuffer();
  await assert.rejects(
    () => parseItemWiseSalesReport(buffer),
    /template mismatch/,
  );
});
