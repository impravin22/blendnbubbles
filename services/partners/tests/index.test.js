// The load-bearing property: partner sheets carry customer names, phone
// numbers, and event enquiries, and are never returned without a valid token.
// A half-configured deploy refuses rather than serving them open.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

const TOKEN = 'test-partners-token';
const SHEETS = JSON.stringify({
  generatedAt: '2026-08-10T00:00:00.000Z',
  sheets: [{ id: 'abc', name: 'BnB Event Requests', rows: [['Name', 'Phone']] }],
});

function fakeKv(value = SHEETS) {
  return { async get() { return value; } };
}

const env = (over = {}) => ({
  PARTNERS: fakeKv(),
  PARTNERS_TOKEN: TOKEN,
  ALLOWED_ORIGIN: 'https://blendnbubbles.com',
  ...over,
});

const get = (path, headers = {}) =>
  new Request(`https://partners.test${path}`, { method: 'GET', headers });

const authed = (token = TOKEN) => ({ authorization: `Bearer ${token}` });

describe('GET /data', () => {
  test('returns the sheets with a valid token', async () => {
    const response = await worker.fetch(get('/data', authed()), env());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), JSON.parse(SHEETS));
  });

  test('refuses with no Authorization header', async () => {
    const response = await worker.fetch(get('/data'), env());
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'unauthorised');
  });

  test('refuses a wrong token', async () => {
    const response = await worker.fetch(get('/data', authed('guess')), env());
    assert.equal(response.status, 401);
  });

  test('refuses a token of the right length but wrong content', async () => {
    // Guards the constant-time compare's length check from being the only test.
    const wrong = 'x'.repeat(TOKEN.length);
    const response = await worker.fetch(get('/data', authed(wrong)), env());
    assert.equal(response.status, 401);
  });

  test('refuses a bare token without the Bearer prefix', async () => {
    const response = await worker.fetch(get('/data', { authorization: TOKEN }), env());
    assert.equal(response.status, 401);
  });

  test('refuses the reports token — the two services do not share a credential', async () => {
    const response = await worker.fetch(
      get('/data', authed('test-reports-token')),
      env(),
    );
    assert.equal(response.status, 401);
  });

  test('an authorised response is never stored by a shared cache', async () => {
    const response = await worker.fetch(get('/data', authed()), env());
    assert.match(response.headers.get('cache-control'), /no-store/);
  });

  test('reports a missing extract rather than an empty success', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ PARTNERS: { async get() { return null; } } }),
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'no-dataset');
  });
});

describe('deploy misconfiguration fails closed', () => {
  // The dangerous case: '' !== '' is false, so a plain comparison would
  // authorise a request sending an empty token.
  test('an empty token does not authorise an empty header', async () => {
    const response = await worker.fetch(
      get('/data', authed('')),
      env({ PARTNERS_TOKEN: '' }),
    );
    assert.notEqual(response.status, 200);
    assert.equal((await response.json()).error, 'misconfigured');
  });

  test('a missing token binding refuses to serve', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ PARTNERS_TOKEN: undefined }),
    );
    assert.equal(response.status, 503);
  });

  test('an unbound KV namespace refuses to serve', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ PARTNERS: undefined }),
    );
    assert.equal(response.status, 503);
  });
});

describe('routing and CORS', () => {
  test('health check needs no token', async () => {
    const response = await worker.fetch(get('/health'), env());
    assert.equal(response.status, 200);
  });

  test('health check does not leak the sheets', async () => {
    const response = await worker.fetch(get('/health'), env());
    assert.deepEqual(await response.json(), { ok: true });
  });

  test('unknown paths 404 without checking the token', async () => {
    const response = await worker.fetch(get('/anything', authed()), env());
    assert.equal(response.status, 404);
  });

  test('non-GET is refused', async () => {
    const response = await worker.fetch(
      new Request('https://partners.test/data', { method: 'POST', headers: authed() }),
      env(),
    );
    assert.equal(response.status, 405);
  });

  test('CORS origin is the site, never a wildcard', async () => {
    const response = await worker.fetch(
      new Request('https://partners.test/data', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      }),
      env(),
    );
    const origin = response.headers.get('access-control-allow-origin');
    assert.equal(origin, 'https://blendnbubbles.com');
    assert.notEqual(origin, '*');
  });

  test('a KV failure returns a CORS-bearing error, not an opaque crash', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ PARTNERS: { async get() { throw new Error('kv down'); } } }),
    );
    assert.equal(response.status, 500);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://blendnbubbles.com',
    );
  });
});
