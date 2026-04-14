# Daily Digest Bot

Sends a Telegram digest **twice a day** — **09:00 and 21:00 Asia/Taipei** (01:00 and 13:00 UTC) — summarising the last **12 hours** of:

- **⚠️ Urgent Zomato alerts** (top of digest): online ordering switched OFF, orders rejected, payout delays
- Customer reviews on **Google** + **Zomato** (merged into one section, per-platform counts)
- **PetPooja** overnight reports (xlsx forwarded)
- **Zomato business** updates: weekly report, settlement statement, monthly tax invoice PDF
- **Google Business Profile**: monthly performance summary + new customer photos
- **Hyperpure** supply-chain orders (placed + delivered, with order IDs)

Runs on GitHub Actions (`.github/workflows/daily-digest.yml`). No server to maintain.

## How it works

```
GitHub Actions cron (01:00 UTC)
   ↓
Node.js script
   ↓
Gmail API  ← reads last-24h emails from blendnbubbles@gmail.com
   ↓
Parsers   ← classify "Google review" vs "PetPooja report"
   ↓
Telegram Bot API
   ↓
Group chat ← digest text + any xlsx attachments
```

All secrets live in GitHub Actions secrets — never in the repo.

## One-time setup

### 1. Google Cloud — enable Gmail API and create OAuth credentials

1. Go to <https://console.cloud.google.com/>
2. Create a new project (or reuse one). Name it `blendnbubbles-digest`.
3. **APIs & Services → Library → Gmail API → Enable**
4. **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - App name: `BnB Daily Digest`
   - Support / developer email: your email
   - Scopes: add `.../auth/gmail.readonly`
   - Test users: add `blendnbubbles@gmail.com`
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Desktop app**
   - Name: `BnB Digest CLI`
   - Download the JSON. You only need `client_id` and `client_secret`.

### 2. Generate a refresh token (run once)

From this directory:

```bash
cd scripts/daily-digest
npm install
GMAIL_CLIENT_ID="..." GMAIL_CLIENT_SECRET="..." npm run auth
```

The script prints a URL. Open it, sign in with **blendnbubbles@gmail.com**, approve, copy the code back into the terminal. You'll get a `refresh_token` printed at the end. Save it — this is `GMAIL_REFRESH_TOKEN`.

> If Google says "No refresh_token returned", go to <https://myaccount.google.com/permissions>, remove the `BnB Digest CLI` app, and rerun.

### 3. Add GitHub Actions secrets

**Settings → Secrets and variables → Actions → New repository secret**, add all five:

| Secret                  | Value                                                 |
| ----------------------- | ----------------------------------------------------- |
| `GMAIL_CLIENT_ID`       | From step 1                                           |
| `GMAIL_CLIENT_SECRET`   | From step 1                                           |
| `GMAIL_REFRESH_TOKEN`   | From step 2                                           |
| `TELEGRAM_BOT_TOKEN`    | The `@BotFather` token for `@blendnbubbles_ops_bot`   |
| `TELEGRAM_CHAT_ID`      | The group chat ID (negative integer, e.g. `-5088...`) |

### 4. Enable the workflow

- Default: the workflow runs on its cron automatically.
- Manual test: **Actions → Daily Digest → Run workflow**.

## Local development

```bash
cd scripts/daily-digest
cp .env.example .env          # fill in values
npm install
npm test                      # 13 parser + digest tests
set -a; source .env; set +a   # export env vars
npm start                     # sends a digest right now
```

## File layout

```
scripts/daily-digest/
  bin/
    run.js                    # entry point used by `npm start`
    get-refresh-token.js      # one-time OAuth helper
  src/
    config.js                 # env var validation
    gmail.js                  # Gmail API client + queries
    parsers.js                # review + PetPooja subject parsers
    telegram.js               # sendMessage + sendDocument
    digest.js                 # orchestrator + text formatter
    index.js                  # public exports (for tests / future consumers)
  tests/
    parsers.test.js
    digest.test.js
```

## Security notes

- `GMAIL_REFRESH_TOKEN` grants **read-only Gmail access** (`gmail.readonly` scope). It cannot send or delete mail.
- `TELEGRAM_BOT_TOKEN` lets the bot post to the specific group only. Regenerate via `@BotFather /token` if it ever leaks.
- No credentials are logged. The digest script never writes secrets to stdout.
- Attachments are streamed end-to-end (Gmail → memory → Telegram), never written to disk.

## What the digest looks like

```
☀️ Blend N Bubbles — Morning Rundown
14 Apr 2026, 09:00 TPE

⚠️ Urgent Alerts — act now
  • 🚨 Online ordering switched OFF for Blend N Bubbles, Barrackpore
    (auto-off due to rejection…)
  • ⚠️ Online order rejected at Blend N Bubbles, Barrackpore
  • ℹ️ [IMP] Update on your payout for this week
  Open Zomato Business ↗

⭐ Customer Reviews (last window)
  • Google: 3 new reviews (from Sushmita, Rajat, Anamika)
  • Zomato: 1 new review (from Jayasree Dutta)

📊 PetPooja — Barrackpore Branch
  • Item Wise Report With Bill No. : Blend N Bubbles [Barrackpore Branch]
  • 📎 Item_bill_report_2026_04_14_01_38_27.xlsx

🍽️ Zomato — Business
  • Weekly report: Week 15 (6 to 12 Apr, 2026)
    Total sales ₹1156 -67%, Delivered orders 5 -58% …
  • Settlement: Blend N Bubbles 21955142 | 30 Mar to 05 Apr
  • 📎 Zomato_Settlement_Report_...xlsx
  • Tax invoice: Online Ordering for 2026-03-01 to 2026-03-31
  • 📎 Z26-WBOO-166484.pdf

📈 Google Business Profile
  • 📊 Monthly performance — March 2026
    271 people viewed Blend n Bubbles last month …
  • 📸 2 new customer photos

📦 Hyperpure Supplies
  • 🛒 Placed — ZHPWB27-OR-0025296424
  • ✅ Delivered — ZHPWB26-OR-0025064133
```

Evening digest (21:00 TPE) uses the same structure with `🌙 Evening Rundown`. Empty sections render a one-line "no activity" placeholder so the owner can tell the bot ran. Attachments land as separate Telegram documents right after the text digest.
