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
  return {
    store,
    async get(key, opts) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key, value) {
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

function firestoreEntry({ score = 7, name = 'Pravy', ageMs = 0 } = {}) {
  return {
    score: { integerValue: String(score) },
    name: { stringValue: name },
    createdAt: { timestampValue: new Date(Date.now() - ageMs).toISOString() },
  };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('POST /issue', () => {
  beforeEach(() => stubFirestore(firestoreEntry()));

  test('mints a voucher for a fresh leaderboard entry', async () => {
    const response = await worker.fetch(post('/issue', { entryId: 'abc123' }), env());
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
      post('/issue', { entryId: 'abc123', score: 999, rupees: 5000 }),
      env(),
    );
    const body = await response.json();
    assert.equal(body.score, 7);
    assert.equal(body.rupees, 14);
  });

  test('refuses a score older than the freshness window', async () => {
    stubFirestore(firestoreEntry({ ageMs: 20 * 60 * 1000 }));
    const response = await worker.fetch(post('/issue', { entryId: 'abc123' }), env());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'stale');
  });

  test('refuses a zero score', async () => {
    stubFirestore(firestoreEntry({ score: 0 }));
    const response = await worker.fetch(post('/issue', { entryId: 'abc123' }), env());
    assert.equal(response.status, 409);
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
    const response = await worker.fetch(post('/issue', { entryId: 'nope123' }), env());
    assert.equal(response.status, 409);
  });
});

describe('POST /redeem', () => {
  const validToken = () =>
    signVoucher(
      { entryId: 'abc123', name: 'Pravy', score: 7, rupees: 14, issuedAt: Date.now() },
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

  test('a forged voucher is refused even with a valid staff token', async () => {
    const forged = await signVoucher(
      { entryId: 'abc123', name: 'Pravy', score: 99, rupees: 5000, issuedAt: Date.now() },
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
