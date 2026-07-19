# Voucher Worker

Issues and redeems the discount vouchers for the shop games.

## Why this exists

The games score in the browser. That is fine for gameplay and unavoidable for a
static site, but it meant the reward card was rendered from a local variable —
set your streak in dev tools, and a card the server had never seen appeared,
worth up to the maximum discount. The score cap in `firestore.rules` guarded the
leaderboard; it never guarded the money.

This Worker is the thing that decides the money.

**It never accepts a score from the client.** It accepts a leaderboard document
id, reads that document back from Firestore, and takes the score from the stored
copy. Two Firestore rules make that trustworthy:

- the score cap rejects anything above what honest play can reach (19 goals for
  football), so the most a voucher can ever be worth is ₹38; and
- `createdAt == request.time` means the write timestamp is the server's, not the
  client's, so the Worker can require the score to be **fresh**.

Freshness matters as much as the cap. The leaderboard is world-readable, so
without it anyone could point at the top of the board and mint a voucher from a
stranger's run.

Redemption is single-use, tracked in KV, so a screenshotted card is worth
exactly one drink.

### What this does not fix

A player can still edit their streak up to 19 and get ₹38 — the same as a strong
honest player, which is the point of setting the cap at the honest maximum.
Closing that needs shot-by-shot server-authoritative scoring, which is a large
rewrite of the game loop for a bounded gain. Not worth it at this scale.

## Layout

```
services/voucher/
  src/
    voucher.js   # pure: discount maths, HMAC sign/verify, claim freshness
    index.js     # routing, Firestore read, KV ledger
  tests/
    voucher.test.js
    index.test.js
```

## API

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /issue` | none — see below | `{ entryId }` → `{ token, rupees, name, score, expiresAt }` |
| `POST /redeem` | `x-staff-token` header | `{ token }` → `{ valid, rupees, name, redeemedAt }` |
| `GET /health` | none | liveness |

`/redeem` is staff-only on purpose. Without it a customer could call it from
their own phone and show the resulting "valid" screen at the counter while the
voucher stayed unredeemed. **Staff must scan the customer's QR on the staff
device** — reading a verdict off the customer's screen defeats the control.

## Deploy

```bash
cd services/voucher

# 1. Redemption ledger
npx wrangler kv namespace create VOUCHERS
#    paste the returned id into wrangler.toml

# 2. Secrets — never in wrangler.toml
openssl rand -base64 32 | npx wrangler secret put VOUCHER_SECRET
openssl rand -base64 24 | npx wrangler secret put STAFF_TOKEN

# 3. Ship
npx wrangler deploy
```

`FIREBASE_API_KEY` sits in `[vars]` in plain sight deliberately: it is a public
identifier, not a credential, and already ships in the site bundle. It grants
only what `firestore.rules` allows.

Rotating `VOUCHER_SECRET` invalidates every unredeemed voucher. Rotating
`STAFF_TOKEN` only requires re-entering it on the counter device.

## Test

```bash
npm test        # node --test, no dependencies
```

The tests run under Node while the code runs under `workers_dev`. Both runtimes
provide `crypto.subtle`, `btoa`/`atob`, `TextEncoder`, and `Request`/`Response`,
so the surface used here behaves identically — but anything added later should
be checked against the Workers runtime, not just against a green `node --test`.

## What `/issue` is not protected by

`/issue` takes no credentials. The CORS header names the site origin, but CORS
is a browser policy — `curl` ignores it entirely, so it is hygiene here rather
than an access control.

Two consequences worth stating plainly:

- **Vouchers are mintable in volume.** Firestore rules allow anonymous document
  creation by design (the site is static and has no login), so a script can
  fabricate a leaderboard row and mint a voucher for it, repeatedly. The score
  cap bounds each voucher's value; the per-device daily cap and the person at
  the counter bound the count.
- **Someone can mint a stranger's voucher.** The board is world-readable, so a
  fresh `entryId` is public for the 15 minutes it stays claimable. The thief
  must still be at the counter to redeem, and the redemption ledger keys on
  `entryId`, so the two collide on one key and only one drink is ever handed
  over — the honest player gets `already-redeemed`. That is a support problem,
  not a money problem, but it is worth knowing before someone reports it.

`playerId` cannot fix either: `getWeeklyLeaderboard` returns whole documents, so
it is published alongside everything else.

## Reward table

`REWARDS` in `src/voucher.js` is keyed by game and **fails closed** — a game not
in the table mints nothing.

This is load-bearing, not defensive coding. Both games write to the same
`leaderboard` collection, but their scores are not in the same units: football
counts goals and is capped at 19, while Boba Catcher counts points (items worth
up to 10, combo multiplier to 3x) and is capped at 1000. An earlier revision
applied one flat rate to whatever score it found, which handed the maximum ₹50
to any ordinary Boba Catcher run past 25 points — on the default game path, with
no tampering at all.

Boba Catcher is deliberately absent rather than set to a low rate: its in-store
reward is a topping upgrade, not money off, so it has no rupee value to express.
Give it an entry only once someone decides what it is worth.
