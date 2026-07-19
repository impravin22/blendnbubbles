// Worker routing tests: auth, single-use redemption, and the rule that a score
// is only ever read back from Firestore, never accepted from the caller.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signVoucher } from '../src/voucher.js';

const SECRET = 'test-voucher-secret';
const STAFF = 'test-staff-token';

/** Minimal in-memory stand-in for a KV namespace. */
function fakeKv() {
  const store = new Map();
  // Real KV rejects an expirationTtl below 60, so the options have to be
  // captured rather than dropped — otherwise a bad TTL passes here and throws
  // only in production, which is exactly the failure this fake exists to catch.
  const puts = [];
  return {
    store,
    puts,
    async get(key, opts) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key, value, options) {
      if (options?.expirationTtl !== undefined && options.expirationTtl < 60) {
        throw new Error(`expirationTtl ${options.expirationTtl} is below KV's 60s minimum`);
      }
      puts.push({ key, value, options });
      store.set(key, value);
    },
  };
}

const env = () => ({
  VOUCHERS: fakeKv(),
  VOUCHER_SECRET: SECRET,
  STAFF_TOKEN: STAFF,
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_API_KEY: 'test-key',
  ALLOWED_ORIGIN: 'https://blendnbubbles.com',
});

const post = (path, body, headers = {}) =>
  new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/** Stub the Firestore REST read with a document in its typed-value encoding. */
function stubFirestore(fields) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ fields }), { status: 200 });
}

function firestoreEntry({ score = 7, name = 'Pravy', game = 'football', ageMs = 0 } = {}) {
  return {
    score: { integerValue: String(score) },
    name: { stringValue: name },
    game: { stringValue: game },
    // Firestore REST returns RFC3339 with microseconds rather than the three
    // fractional digits toISOString gives, so use the real shape.
    createdAt: {
      timestampValue: new Date(Date.now() - ageMs).toISOString().replace('Z', '456Z'),
    },
  };
}

// Firestore auto-ids are exactly 20 alphanumeric characters, and the Worker
// rejects anything else before it reaches the network.
const ENTRY_ID = 'aBcDeF1234567890GhIj';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('POST /issue', () => {
  beforeEach(() => stubFirestore(firestoreEntry()));

  test('mints a voucher for a fresh leaderboard entry', async () => {
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.rupees, 14);
    assert.equal(body.score, 7);
    assert.ok(body.token.includes('.'));
  });

  test('the payout comes from Firestore, not from the caller', async () => {
    // The client asks for a huge score. The Worker must ignore it entirely and
    // pay out on the stored value — this is the whole trust boundary.
    const response = await worker.fetch(
      post('/issue', { entryId: ENTRY_ID, score: 999, rupees: 5000 }),
      env(),
    );
    const body = await response.json();
    assert.equal(body.score, 7);
    assert.equal(body.rupees, 14);
  });

  test('refuses a score older than the freshness window', async () => {
    stubFirestore(firestoreEntry({ ageMs: 20 * 60 * 1000 }));
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'stale');
  });

  test('refuses a zero score', async () => {
    stubFirestore(firestoreEntry({ score: 0 }));
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'no-prize');
  });

  // Regression, end to end. Both games write to the same leaderboard collection
  // but their scores are in different units, and firestore.rules caps
  // bobacatcher at 1000. When the Worker paid a flat rate without reading
  // `game`, an ordinary 25-point Boba Catcher run minted the maximum discount.
  test('a Boba Catcher entry mints no voucher, at any score', async () => {
    for (const score of [25, 900, 1000]) {
      stubFirestore(firestoreEntry({ score, game: 'bobacatcher' }));
      const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
      assert.equal(response.status, 409, `bobacatcher ${score} should mint nothing`);
      assert.equal((await response.json()).error, 'no-prize');
    }
  });

  test('an entry with no game field mints nothing', async () => {
    // Rows written before the multi-game split carry no `game`, and the client
    // treats those as Boba Catcher. They must not fall through to a default rate.
    const fields = firestoreEntry();
    delete fields.game;
    stubFirestore(fields);
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'no-prize');
  });

  test('the signed claim records which game was played', async () => {
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
    assert.equal((await response.json()).game, 'football');
  });

  test('rejects a malformed entry id without calling Firestore', async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response('{}', { status: 200 });
    };
    const response = await worker.fetch(
      post('/issue', { entryId: '../../../etc/passwd' }),
      env(),
    );
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });

  test('handles a missing document', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    const response = await worker.fetch(post('/issue', { entryId: 'zZyYxX9876543210WvUt' }), env());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'not-found');
  });

  test('an upstream failure returns a CORS-bearing error, not an opaque crash', async () => {
    // An uncaught throw gets the runtime's synthetic 500, which carries no CORS
    // headers — the browser then reports a network failure and the player's card
    // silently never appears, with nothing to diagnose.
    for (const breakFetch of [
      async () => { throw new TypeError('network blip'); },
      async () => new Response('<html>proxy error</html>', { status: 200 }),
    ]) {
      globalThis.fetch = breakFetch;
      const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
      assert.ok(response.status >= 400);
      assert.equal(
        response.headers.get('access-control-allow-origin'),
        'https://blendnbubbles.com',
      );
    }
  });

  test('a null field wrapper does not crash the decoder', async () => {
    stubFirestore({ ...firestoreEntry(), junk: null });
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), env());
    assert.equal(response.status, 200);
  });
});

describe('deploy misconfiguration fails closed', () => {
  beforeEach(() => stubFirestore(firestoreEntry()));

  // An empty-string secret is the dangerous case: `'' !== ''` is false, so a
  // plain comparison would authorise a request sending an empty header.
  test('an empty STAFF_TOKEN does not authorise an empty header', async () => {
    const broken = { ...env(), STAFF_TOKEN: '' };
    const response = await worker.fetch(
      post('/redeem', { token: 'x.y' }, { 'x-staff-token': '' }),
      broken,
    );
    assert.notEqual(response.status, 200);
    assert.equal((await response.json()).error, 'misconfigured');
  });

  test('a missing VOUCHER_SECRET refuses to sign', async () => {
    const broken = { ...env(), VOUCHER_SECRET: undefined };
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), broken);
    assert.equal(response.status, 503);
  });

  test('an unbound KV namespace is caught — it is the default of a fresh deploy', async () => {
    // wrangler.toml ships a placeholder namespace id, so this is what a deploy
    // looks like before someone runs `wrangler kv namespace create`.
    const broken = { ...env(), VOUCHERS: undefined };
    const response = await worker.fetch(post('/issue', { entryId: ENTRY_ID }), broken);
    assert.equal(response.status, 503);
  });
});

describe('POST /redeem', () => {
  const validToken = () =>
    signVoucher(
      { entryId: ENTRY_ID, name: 'Pravy', score: 7, rupees: 14, issuedAt: Date.now() },
      SECRET,
    );

  test('requires the staff token', async () => {
    const response = await worker.fetch(post('/redeem', { token: await validToken() }), env());
    assert.equal(response.status, 401);
    assert.equal((await response.json()).reason, 'unauthorised');
  });

  test('a wrong staff token is rejected', async () => {
    const response = await worker.fetch(
      post('/redeem', { token: await validToken() }, { 'x-staff-token': 'guess' }),
      env(),
    );
    assert.equal(response.status, 401);
  });

  test('redeems a valid voucher once', async () => {
    const response = await worker.fetch(
      post('/redeem', { token: await validToken() }, { 'x-staff-token': STAFF }),
      env(),
    );
    const body = await response.json();
    assert.equal(body.valid, true);
    assert.equal(body.rupees, 14);
  });

  test('a second redemption of the same voucher is refused', async () => {
    const sharedEnv = env();
    const token = await validToken();
    const first = await worker.fetch(
      post('/redeem', { token }, { 'x-staff-token': STAFF }),
      sharedEnv,
    );
    assert.equal((await first.json()).valid, true);

    const second = await worker.fetch(
      post('/redeem', { token }, { 'x-staff-token': STAFF }),
      sharedEnv,
    );
    const body = await second.json();
    assert.equal(body.valid, false);
    assert.equal(body.reason, 'already-redeemed');
    assert.ok(body.redeemedAt);
  });

  test('the redemption record outlives the voucher, at a TTL real KV accepts', async () => {
    // Without this the ledger could expire before the voucher does, and a
    // replay would read as 'expired' rather than 'already-redeemed'.
    const sharedEnv = env();
    await worker.fetch(
      post('/redeem', { token: await validToken() }, { 'x-staff-token': STAFF }),
      sharedEnv,
    );
    const record = sharedEnv.VOUCHERS.puts.find((p) => p.key.startsWith('voucher:'));
    assert.ok(record.options.expirationTtl >= 24 * 60 * 60);
  });

  test('a device is capped at two redemptions a day', async () => {
    const sharedEnv = env();
    const redeem = async (entryId) =>
      worker.fetch(
        post(
          '/redeem',
          {
            token: await signVoucher(
              { entryId, name: 'Pravy', score: 7, game: 'football', playerId: 'device-1', rupees: 14, issuedAt: Date.now() },
              SECRET,
            ),
          },
          { 'x-staff-token': STAFF },
        ),
        sharedEnv,
      );

    // Distinct entryIds, so the single-use ledger does not stop these — only
    // the per-device daily counter does.
    assert.equal((await (await redeem('entry0000000000000a')).json()).valid, true);
    assert.equal((await (await redeem('entry0000000000000b')).json()).valid, true);
    const third = await (await redeem('entry0000000000000c')).json();
    assert.equal(third.valid, false);
    assert.equal(third.reason, 'daily-limit');
  });

  test('a forged voucher is refused even with a valid staff token', async () => {
    const forged = await signVoucher(
      { entryId: ENTRY_ID, name: 'Pravy', score: 99, rupees: 5000, issuedAt: Date.now() },
      'not-the-real-secret',
    );
    const response = await worker.fetch(
      post('/redeem', { token: forged }, { 'x-staff-token': STAFF }),
      env(),
    );
    const body = await response.json();
    assert.equal(body.valid, false);
    assert.equal(body.reason, 'bad-signature');
  });
});

describe('routing and CORS', () => {
  test('health check responds', async () => {
    const response = await worker.fetch(
      new Request('https://worker.test/health'),
      env(),
    );
    assert.equal(response.status, 200);
  });

  test('CORS origin is the site, never a wildcard', async () => {
    const response = await worker.fetch(
      new Request('https://worker.test/issue', { method: 'OPTIONS' }),
      env(),
    );
    const origin = response.headers.get('access-control-allow-origin');
    assert.equal(origin, 'https://blendnbubbles.com');
    assert.notEqual(origin, '*');
  });

  test('unknown paths 404', async () => {
    const response = await worker.fetch(post('/anything', {}), env());
    assert.equal(response.status, 404);
  });
});
