# PetPooja Scraper

Headless Chromium scraper that logs into [billing.petpooja.com](https://billing.petpooja.com), pulls today / week-to-date / month-to-date revenue + expenses for the Barrackpore outlet, computes profit per window, and posts the payload to the `cron-trigger` Cloudflare Worker so the daily Telegram digest can render it.

## Why headless Chromium

PetPooja billing has no owner-facing pull API. The site uses HttpOnly session cookies + a CakePHP-style form flow. The cheapest reliable way to talk to those endpoints is to log in via a real browser, then run `fetch()` calls from inside the same page context — the browser auto-attaches the session cookie.

## Pipeline

```
GitHub Actions (cron via cron-trigger Worker, 00:50 + 12:50 UTC)
  └─ services/petpooja-scraper (Playwright + Chromium)
       └─ login → run 6 in-page fetches (revenue × 3 windows + expense × 3 windows)
            └─ POST { today, weekToDate, monthToDate } to /petpooja-stats/put on the cron Worker
                 └─ Daily digest (10 min later) GETs /petpooja-stats/get and renders the profit line
```

## Env vars

| Var | Purpose |
| --- | --- |
| `PETPOOJA_EMAIL` | The login email/phone the scraper uses to authenticate. |
| `PETPOOJA_PASSWORD` | The matching password. Stored as a GitHub Actions secret. |
| `PETPOOJA_OUTLET_ID` | Numeric outlet id (e.g. `400681` for Barrackpore). |
| `PETPOOJA_LOCALE_TZ` | IANA timezone for window boundaries. Defaults to `Asia/Kolkata`. |
| `SCRAPER_STATS_PUT_URL` | Worker URL, e.g. `https://blendnbubbles-cron.<id>.workers.dev/petpooja-stats/put`. |
| `SCRAPER_STATS_PUT_TOKEN` | Bearer the Worker checks before accepting a stats payload. |
| `DRY_RUN` | Set to `1` to skip the Worker POST and just print the payload to stdout. Useful for local testing. |

## Running locally

```bash
cd services/petpooja-scraper
npm install
npm run install:browser   # one-off: downloads Chromium
PETPOOJA_EMAIL=...@gmail.com \
PETPOOJA_PASSWORD=... \
PETPOOJA_OUTLET_ID=400681 \
DRY_RUN=1 npm run scrape
```

The dry run prints the JSON payload — verify revenue / expense / profit numbers match what you see in the PetPooja UI.

## Tests

```bash
npm test
```

`computeWindows` is the only piece worth unit-testing — every other path goes through Playwright + the live site. Visual verification is via the dry-run script.

## Cron-trigger Worker secrets

The cron-trigger Worker needs one new secret:

```bash
cd services/cron-trigger
wrangler secret put SCRAPER_STATS_PUT_TOKEN
```

`DIGEST_STATE_TOKEN` is reused for the read endpoint (`/petpooja-stats/get`) — no separate secret.

## Failure mode

If the scraper fails (PetPooja login change, password expiry, captcha), the GitHub Action posts a Telegram alert and exits non-zero. The next digest run will see no fresh stats and fall back to "Profit feed unavailable" or just omit the line if the snapshot is older than 12 hours.

## Snapshot schema (v1)

```json
{
  "schemaVersion": 1,
  "outletId": "400681",
  "localeTz": "Asia/Kolkata",
  "windows": {
    "todayStart": "2026-05-31",
    "todayEnd": "2026-05-31",
    "weekStart": "2026-05-25",
    "weekEnd": "2026-05-31",
    "monthStart": "2026-05-01",
    "monthEnd": "2026-05-31"
  },
  "stats": {
    "today": { "bills": 0, "netSales": 0, "totalSales": 0, "tax": 0, "discount": 0, "expenses": 0, "profit": 0 },
    "weekToDate": { "bills": 117, "netSales": 30039, "totalSales": 31554, "tax": 1363, "discount": 3227, "expenses": 0, "profit": 30039 },
    "monthToDate": { "bills": 371, "netSales": 90955, "totalSales": 95651, "tax": 4034, "discount": 7902, "expenses": 40953, "profit": 50002 }
  },
  "fetchedAt": "2026-05-31T03:00:00.000Z"
}
```
