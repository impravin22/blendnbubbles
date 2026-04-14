# PetPooja Webhook Receiver

A tiny HTTP server that:

1. Accepts `POST /petpooja-webhook` from PetPooja on every order event
2. Validates a shared token, persists the order, de-duplicates by `orderID`
3. Exposes `GET /petpooja-today` (bearer-authed) that the daily-digest script calls to pull "today's sales: ₹X from Y orders" into the Telegram message

## Why this exists

PetPooja has **no owner-facing pull API**. Their "Online Ordering API" is aggregator-facing (Swiggy/Zomato push orders *in*). The documented owner path is the **other direction** — PetPooja POSTs to a URL you provide, on every order event. Activation requires raising a support ticket with them.

See "Raise the support ticket" section below.

## Layout

```
services/petpooja-webhook/
  src/
    index.js     # HTTP server, reads env, wires routes
    handler.js   # POST handler, token validation + payload reshape
    storage.js   # JSON-file store keyed by orderID (idempotent)
  tests/
    handler.test.js
    storage.test.js
  package.json
```

## Required env vars

| Var | Purpose |
| --- | --- |
| `PETPOOJA_SHARED_TOKEN` | The token PetPooja will include in the `token` field of every webhook POST. You choose the value when raising the ticket. |
| `DIGEST_API_TOKEN` | Separate token the digest script sends in `Authorization: Bearer …` when calling `/petpooja-today`. Rotate independently. |
| `PETPOOJA_STORE_PATH` | Path to the JSON file. Defaults to `/tmp/petpooja-orders.json` — set to a persistent-disk path on Fly/Railway or to your serverless KV in a code-level swap. |
| `DIGEST_LOCALE_TZ` | Used to decide the day boundary for "today". Default `Asia/Kolkata` (restaurant time, not TPE). |
| `PORT` | Default `8787`. |

## Running locally

```bash
cd services/petpooja-webhook
export PETPOOJA_SHARED_TOKEN="$(openssl rand -hex 16)"
export DIGEST_API_TOKEN="$(openssl rand -hex 16)"
npm start
```

Then in another shell:

```bash
# Simulate a PetPooja POST
curl -X POST http://localhost:8787/petpooja-webhook \
  -H 'Content-Type: application/json' \
  -d '{"token":"'"$PETPOOJA_SHARED_TOKEN"'","properties":{"Order":{"orderID":"TEST-1","orderStatus":"Success","total":350}}}'

# Pull today's summary
curl -H "Authorization: Bearer $DIGEST_API_TOKEN" http://localhost:8787/petpooja-today
```

## Deploying

The service is a plain Node 20 HTTP server with one file for state. It runs anywhere:

### Option A — Fly.io (recommended, cheap, persistent volume)
- `flyctl launch` from this directory, answer no to Postgres/Redis
- `flyctl volumes create petpooja_data --size 1` and mount it at `/data` in `fly.toml`
- Set `PETPOOJA_STORE_PATH=/data/orders.json` in `fly.toml [env]`
- `flyctl secrets set PETPOOJA_SHARED_TOKEN=... DIGEST_API_TOKEN=...`

### Option B — Railway / Render
- Deploy this directory as a Node service, add env vars via their dashboard
- Add a persistent volume if the platform supports it, otherwise swap `storage.js` for an external store (see Option D)

### Option C — Cloudflare Workers
- Storage layer needs to change to Workers KV — replace `storage.js` with a KV-backed module
- Deploy with `wrangler deploy`

### Option D — Vercel Serverless
- Each serverless invocation has an ephemeral filesystem, so use **Vercel KV** (or Upstash Redis) for storage
- Wrap the handler from `src/handler.js` in a Vercel function at `api/petpooja-webhook.js`

## Raise the support ticket

Email **support@petpooja.com** with something like:

> Subject: Enable order webhook for Restaurant ID 21955142 (Blend N Bubbles, Barrackpore)
>
> Hi team,
>
> Please enable the order-push webhook for our outlet. Details:
>
> - Restaurant ID: 21955142
> - Outlet: Blend N Bubbles, Barrackpore (Kolkata)
> - Webhook URL: `https://<your-deployed-host>/petpooja-webhook`
> - Shared token (to include in the `token` field): `<generated value>`
> - Events needed: every order event (new / accepted / completed / cancelled)
>
> The URL accepts standard PetPooja JSON with the `token`, `properties.Restaurant`, and `properties.Order` shape as documented at
> https://onlineorderingapisv210.docs.apiary.io
>
> Happy to test once enabled.
>
> Thanks,
> Pravy (co-founder, Blend N Bubbles)

Turnaround is typically 2–5 business days.

## Connecting the digest

Once the webhook is active and the deploy is running, set these on the daily-digest GitHub Actions secrets:

- `PETPOOJA_WEBHOOK_URL` — e.g. `https://bnb-petpooja.fly.dev`
- `PETPOOJA_WEBHOOK_TOKEN` — same value as `DIGEST_API_TOKEN`

The digest will then call `GET /petpooja-today` before assembling each message, and prepend `💰 Today: ₹X from Y orders` to the PetPooja section. If either secret is missing, the digest silently skips the call — everything else keeps working.
