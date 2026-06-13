import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeenStore } from '../src/seen-store.js';

function mockFetch(handlers) {
  const calls = [];
  async function fetchImpl(url, init) {
    calls.push({ url, init });
    const handler = handlers[url] ?? handlers.default;
    if (!handler) throw new Error(`no mock for ${url}`);
    return handler(init);
  }
  return { fetchImpl, calls };
}

function jsonRes(obj, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(obj),
    json: async () => obj,
  };
}

test('unconfigured store returns empty seen set and logs warning', async () => {
  const store = createSeenStore({});
  assert.equal(store.configured, false);
  const seen = await store.check(['a', 'b']);
  assert.equal(seen.size, 0);
  assert.equal(await store.mark(['a']), false);
});

test('check() returns server-reported seen ids', async () => {
  const { fetchImpl, calls } = mockFetch({
    'https://worker.example/seen/check': () => jsonRes({ seen: ['id2'] }),
  });
  const store = createSeenStore({ url: 'https://worker.example', token: 'T', fetchImpl });
  const seen = await store.check(['id1', 'id2', 'id3']);
  assert.deepEqual([...seen], ['id2']);
  assert.equal(calls.length, 1);
  const { init } = calls[0];
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer T');
  assert.deepEqual(JSON.parse(init.body), { ids: ['id1', 'id2', 'id3'] });
});

test('check() fail-open when the worker errors', async () => {
  const { fetchImpl } = mockFetch({
    default: () => jsonRes({ error: 'boom' }, 500),
  });
  const store = createSeenStore({ url: 'https://worker.example', token: 'T', fetchImpl });
  const seen = await store.check(['x']);
  assert.equal(seen.size, 0);
});

test('mark() POSTs ids and reports success', async () => {
  const { fetchImpl, calls } = mockFetch({
    'https://worker.example/seen/mark': () => jsonRes({ marked: 2 }),
  });
  const store = createSeenStore({ url: 'https://worker.example', token: 'T', fetchImpl });
  const ok = await store.mark(['a', 'b']);
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://worker.example/seen/mark');
});

test('empty id list short-circuits without a network call', async () => {
  const { fetchImpl, calls } = mockFetch({ default: () => jsonRes({ seen: [] }) });
  const store = createSeenStore({ url: 'https://worker.example', token: 'T', fetchImpl });
  await store.check([]);
  await store.mark([]);
  assert.equal(calls.length, 0);
});

test('trailing slash on URL is normalised', async () => {
  const { fetchImpl, calls } = mockFetch({
    'https://worker.example/seen/check': () => jsonRes({ seen: [] }),
  });
  const store = createSeenStore({ url: 'https://worker.example/', token: 'T', fetchImpl });
  await store.check(['a']);
  assert.equal(calls[0].url, 'https://worker.example/seen/check');
});
