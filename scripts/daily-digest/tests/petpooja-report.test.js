import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItemWiseSalesReport, summariseForDigest } from '../src/petpooja-report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SAMPLE_XLSX = path.join(REPO_ROOT, 'reports/Item_Wise_Sales_Report_2026_02_18_09_22_59.xlsx');
const SAMPLE_BILLWISE_XLSX = path.join(REPO_ROOT, 'reports/Item_bill_report_2026_04_14_01_38_27.xlsx');

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

test('parseItemWiseSalesReport handles real "Item Wise Report With Bill No." nightly format', async () => {
  const buf = await fs.readFile(SAMPLE_BILLWISE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  assert.equal(report.template, 'billwise');
  assert.match(report.restaurantName, /Blend N Bubbles/);
  assert.equal(report.dateRange, '2026-04-13 to 2026-04-13');
  assert.ok(report.grandTotalQty > 0, 'should count some items');
  assert.ok(report.grandTotalRevenue > 0, 'should have revenue');
  assert.ok(report.billCount > 0, 'should count unique bills');
  assert.ok(report.items.length > 0);
  // Spot-check: Cafe Mocha appears in this real sample
  assert.ok(report.items.some((i) => i.name === 'Cafe Mocha'));
});

test('parseItemWiseSalesReport (billwise) aggregates across bill-lines correctly', async () => {
  const buf = await fs.readFile(SAMPLE_BILLWISE_XLSX);
  const report = await parseItemWiseSalesReport(buf);
  const caramel = report.items.find((i) => i.name === 'Caramel Boba Coffee');
  assert.ok(caramel, 'Caramel Boba Coffee appears in the real sample');
  // Three bill-lines at ₹157.14 each
  assert.equal(caramel.qty, 3);
});

test('summariseForDigest from billwise report includes billCount', async () => {
  const buf = await fs.readFile(SAMPLE_BILLWISE_XLSX);
  const summary = summariseForDigest(await parseItemWiseSalesReport(buf));
  assert.ok(summary.billCount >= 5, 'should have counted at least 5 bills');
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
