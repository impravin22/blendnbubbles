// The load-bearing property: the dataset is never returned without a valid
// token, and a half-configured deploy refuses rather than serving it open.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

const TOKEN = 'test-reports-token';
const DATASET = JSON.stringify({ meta: { source: 'test' }, rows: [1, 2, 3] });

function fakeKv(value = DATASET) {
  return { async get() { return value; } };
}

const env = (over = {}) => ({
  REPORTS: fakeKv(),
  REPORTS_TOKEN: TOKEN,
  ALLOWED_ORIGIN: 'https://blendnbubbles.com',
  ...over,
});

const get = (path, headers = {}) =>
  new Request(`https://reports.test${path}`, { method: 'GET', headers });

const authed = (token = TOKEN) => ({ authorization: `Bearer ${token}` });

describe('GET /data', () => {
  test('returns the dataset with a valid token', async () => {
    const response = await worker.fetch(get('/data', authed()), env());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), JSON.parse(DATASET));
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

  test('an authorised response is never stored by a shared cache', async () => {
    const response = await worker.fetch(get('/data', authed()), env());
    assert.match(response.headers.get('cache-control'), /no-store/);
  });

  test('reports a missing dataset rather than an empty success', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ REPORTS: { async get() { return null; } } }),
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
      env({ REPORTS_TOKEN: '' }),
    );
    assert.notEqual(response.status, 200);
    assert.equal((await response.json()).error, 'misconfigured');
  });

  test('a missing token binding refuses to serve', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ REPORTS_TOKEN: undefined }),
    );
    assert.equal(response.status, 503);
  });

  test('an unbound KV namespace refuses to serve', async () => {
    const response = await worker.fetch(
      get('/data', authed()),
      env({ REPORTS: undefined }),
    );
    assert.equal(response.status, 503);
  });
});

describe('routing and CORS', () => {
  test('health check needs no token', async () => {
    const response = await worker.fetch(get('/health'), env());
    assert.equal(response.status, 200);
  });

  test('health check does not leak the dataset', async () => {
    const response = await worker.fetch(get('/health'), env());
    assert.deepEqual(await response.json(), { ok: true });
  });

  test('unknown paths 404 without checking the token', async () => {
    const response = await worker.fetch(get('/anything', authed()), env());
    assert.equal(response.status, 404);
  });

  test('non-GET is refused', async () => {
    const response = await worker.fetch(
      new Request('https://reports.test/data', { method: 'POST', headers: authed() }),
      env(),
    );
    assert.equal(response.status, 405);
  });

  test('CORS origin is the site, never a wildcard', async () => {
    const response = await worker.fetch(
      new Request('https://reports.test/data', {
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
      env({ REPORTS: { async get() { throw new Error('kv down'); } } }),
    );
    assert.equal(response.status, 500);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://blendnbubbles.com',
    );
  });
});
