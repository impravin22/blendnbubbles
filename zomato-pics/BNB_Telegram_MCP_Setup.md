# BNB Ops Telegram MCP — deploy in ~5 minutes

Goal: a second Telegram MCP (separate from `pravys-market-bot-mcp`) that posts to the
**BlendNBubbles Digest** group via **@blendnbubbles_ops_bot**. Then the 9 AM daily
sales report can be scheduled against it.

## 1. Deploy the worker (Cloudflare dashboard route)

1. dash.cloudflare.com → **Workers & Pages → Create → Worker**.
2. Name it `bnb-ops-mcp` → Deploy the hello-world → **Edit code**.
3. Replace all code with the contents of `bnb-ops-mcp-worker.js` (in this folder) → **Deploy**.

*(wrangler route, if you prefer: copy the file into a new project, `wrangler deploy`.)*

## 2. Set the two variables

Worker → **Settings → Variables and Secrets**:

| Name | Value | Type |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | your @blendnbubbles_ops_bot token — use the FRESH one after `/revoke` in BotFather (the old one was pasted in chat) | **Secret** |
| `TELEGRAM_CHAT_ID` | `-5088053974` | Text |

The bot must be a member of the BlendNBubbles Digest group (it already is —
it posts the 09:00 rundown).

## 3. Sanity-check (optional, 10 seconds)

Open `https://bnb-ops-mcp.<your-subdomain>.workers.dev` in a browser —
you should see "BNB Ops Telegram MCP is up."

## 4. Add the connector in the Claude app

Settings → Connectors → **Add connector** → URL:
`https://bnb-ops-mcp.<your-subdomain>.workers.dev`

**Important:** in the connector's tool permissions, set **Send telegram message**
to **Always allow** (✓). If it's left on "Needs approval" (✋), the scheduled
9 AM run will hang waiting for a click nobody's there to make.

## 5. Tell Claude "go"

Claude will: send a test line → verify in web.telegram.org that it landed in
BlendNBubbles Digest (not MarketSmith) → enable the daily 9 AM schedule:

> 🧋 BNB Daily Online Report — [date]
> Total orders + billed amount (Petpooja)
> Zomato: orders, sales, offer spend
> Swiggy: orders, sales, funnel (impressions → orders)
> Flags: cancellations, complaints, outlet offline, zero-order days

Keep the old `pravys-telegram-mcp` connector untouched — MarketSmith reports
keep flowing to their own group.
