/**
 * PetPooja billing scraper.
 *
 * Logs into billing.petpooja.com with email + password, pulls
 * today / week-to-date / month-to-date revenue and expense totals for the
 * configured outlet, and POSTs a compact JSON payload to the cron-trigger
 * Worker so the daily Telegram digest can render profit.
 *
 * Why headless Chromium and not raw HTTP?
 *   PetPooja billing uses HttpOnly session cookies + a CakePHP CSRF flow;
 *   the cheapest reliable way to re-use those cookies is to log in via a
 *   real browser session, then call the (already-discovered) data endpoints
 *   from inside the same browsing context.
 */

import { chromium } from 'playwright';
import { computeWindows } from './windows.js';

const ENV = process.env;

const REQUIRED_ENV = [
  'PETPOOJA_EMAIL',
  'PETPOOJA_PASSWORD',
  'PETPOOJA_OUTLET_ID',
  'SCRAPER_STATS_PUT_URL',
  'SCRAPER_STATS_PUT_TOKEN',
];
const LOCALE_TZ = ENV.PETPOOJA_LOCALE_TZ ?? 'Asia/Kolkata';
const PETPOOJA_BASE_URL = 'https://billing.petpooja.com';
const LOGIN_TIMEOUT_MS = 60_000;
const DATA_FETCH_TIMEOUT_MS = 30_000;
const DRY_RUN = ENV.DRY_RUN === '1' || ENV.DRY_RUN === 'true';

async function main() {
  const missing = REQUIRED_ENV.filter((k) => !ENV[k] && !(DRY_RUN && k.startsWith('SCRAPER_STATS_PUT_')));
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
  const outletId = String(ENV.PETPOOJA_OUTLET_ID);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-GB' });
  const page = await context.newPage();
  try {
    await login(page);
    const windows = computeWindows(new Date(), LOCALE_TZ);
    const stats = await collectStats(page, outletId, windows);
    const payload = {
      schemaVersion: 1,
      outletId,
      localeTz: LOCALE_TZ,
      windows,
      stats,
      fetchedAt: new Date().toISOString(),
    };
    if (DRY_RUN) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    await postToWorker(payload);
    console.log(
      `posted petpooja-stats month=₹${stats.monthToDate.profit.toLocaleString('en-IN')}`,
    );
  } finally {
    await browser.close();
  }
}

async function login(page) {
  const url = `${PETPOOJA_BASE_URL}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: LOGIN_TIMEOUT_MS });
  // Step 1: email or mobile
  await page.fill('input[type="email"], input[name="email"], input[name="mobile_number"], input[placeholder*="Email" i]', ENV.PETPOOJA_EMAIL);
  await page.click('button:has-text("Continue"), input[type="submit"][value*="Continue" i]');
  // Step 2: password
  await page.waitForSelector('input[type="password"]', { timeout: LOGIN_TIMEOUT_MS });
  await page.fill('input[type="password"]', ENV.PETPOOJA_PASSWORD);
  await page.click('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"]');
  // Wait for dashboard — the outlet header text is reliable.
  await page.waitForURL(/users\/dashboard/i, { timeout: LOGIN_TIMEOUT_MS });
  await page.waitForLoadState('networkidle', { timeout: LOGIN_TIMEOUT_MS });
}

async function collectStats(page, outletId, windows) {
  // Pre-warm both report pages so the auth + cookies are primed for the in-page
  // fetches that follow. The scraper runs all 6 calls from inside the page so
  // the HttpOnly session cookie is auto-attached.
  await page.goto(`${PETPOOJA_BASE_URL}/custom_reports/view_report/9`, { waitUntil: 'domcontentloaded', timeout: DATA_FETCH_TIMEOUT_MS });
  await page.goto(`${PETPOOJA_BASE_URL}/items/expense_list/`, { waitUntil: 'domcontentloaded', timeout: DATA_FETCH_TIMEOUT_MS });

  const raw = await page.evaluate(
    async ({ outletId, windows }) => {
      async function fetchRevenue(fromStr, toStr) {
        const filter = [
          { table: 'C', field: 'created_date', operator: 'gteq', value: fromStr },
          { table: 'C', field: 'created_date', operator: 'lteq', value: toStr },
          { table: 'A', field: 'status', operator: 'eq', value: ['1', '3'] },
          { table: 'A', field: 'restaurant_id', operator: 'eq', value: [outletId] },
        ];
        const body = new URLSearchParams({
          json_query: '', datasource: '3', replace: '[]', filter: JSON.stringify(filter),
        }).toString();
        const r = await fetch('/custom_reports/get_data_query/1/3', {
          method: 'POST', credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body,
        });
        if (!r.ok) throw new Error(`revenue HTTP ${r.status}`);
        const data = await r.json();
        const row = data.final_result?.[0];
        if (!row) return { bills: 0, netSales: 0, totalSales: 0, tax: 0, discount: 0 };
        const idxByName = {};
        Object.entries(data.fields).forEach(([idx, name]) => { idxByName[name] = Number(idx); });
        return {
          bills: Number(row[idxByName['Total no. of bills']] ?? 0),
          grossRupees: Number(row[idxByName['My Amount (Rs.)']] ?? 0),
          discount: Number(row[idxByName['Total Discount (Rs.)']] ?? 0),
          netSales: Number(row[idxByName['net_sales']] ?? 0),
          tax: Number(row[idxByName['Total Tax (Rs.)']] ?? 0),
          totalSales: Number(row[idxByName['Total Sales (Rs.)']] ?? 0),
        };
      }
      function formatHumanDate(yyyymmdd) {
        const [y, m, d] = yyyymmdd.split('-').map(Number);
        const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${d} ${names[m - 1]} ${y}`;
      }
      async function fetchExpensePage(fromStr, toStr, pageNum) {
        const url = pageNum ? `/items/expenselist/page:${pageNum}` : '/items/expenselist/';
        const body = new URLSearchParams({
          'data[Expense][startdate]': formatHumanDate(fromStr),
          'data[Expense][enddate]': formatHumanDate(toStr),
          'data[Expense][title]': '',
          'data[restaurant_id]': outletId,
          'data[current_page_url]': '',
        }).toString();
        const r = await fetch(url, {
          method: 'POST', credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body,
        });
        if (!r.ok) throw new Error(`expense HTTP ${r.status}`);
        return r.text();
      }
      function sumExpenseHtml(html) {
        const rows = [...html.matchAll(/<td[^>]*>\s*([A-Za-z][^<]{1,60}?)\s*<\/td>\s*<td[^>]*>\s*([\d,]+\.\d{2})\s*<\/td>/g)];
        return rows.reduce((sum, m) => sum + Number(m[2].replace(/,/g, '')), 0);
      }
      async function fetchExpense(fromStr, toStr) {
        const [p1, p2] = await Promise.all([
          fetchExpensePage(fromStr, toStr, ''),
          fetchExpensePage(fromStr, toStr, '2'),
        ]);
        return sumExpenseHtml(p1) + sumExpenseHtml(p2);
      }

      const [revToday, revWeek, revMonth, expToday, expWeek, expMonth] = await Promise.all([
        fetchRevenue(windows.todayStart, windows.todayEnd),
        fetchRevenue(windows.weekStart, windows.weekEnd),
        fetchRevenue(windows.monthStart, windows.monthEnd),
        fetchExpense(windows.todayStart, windows.todayEnd),
        fetchExpense(windows.weekStart, windows.weekEnd),
        fetchExpense(windows.monthStart, windows.monthEnd),
      ]);

      return { revToday, revWeek, revMonth, expToday, expWeek, expMonth };
    },
    { outletId, windows },
  );

  // Build the digest payload. Net sales is post-discount, ex-GST — the right
  // top-line for profit. Profit = netSales - expenses.
  const buildBucket = (rev, exp) => ({
    bills: rev.bills ?? 0,
    netSales: rev.netSales ?? 0,
    totalSales: rev.totalSales ?? 0,
    tax: rev.tax ?? 0,
    discount: rev.discount ?? 0,
    expenses: exp ?? 0,
    profit: Math.round(((rev.netSales ?? 0) - (exp ?? 0)) * 100) / 100,
  });
  return {
    today: buildBucket(raw.revToday, raw.expToday),
    weekToDate: buildBucket(raw.revWeek, raw.expWeek),
    monthToDate: buildBucket(raw.revMonth, raw.expMonth),
  };
}

async function postToWorker(payload) {
  const r = await fetch(ENV.SCRAPER_STATS_PUT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENV.SCRAPER_STATS_PUT_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Worker PUT failed: HTTP ${r.status} — ${text.slice(0, 500)}`);
  }
}

main().catch((err) => {
  console.error('scraper-failed', err.stack ?? err.message ?? err);
  process.exitCode = 1;
});
