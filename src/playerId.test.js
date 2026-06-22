import { getPlayerId } from './playerId';

// Mirrors the injectable storage double used in playLimit.test.js.
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    _data: data,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('getPlayerId', () => {
  test('mints and persists an ID on first use', () => {
    const s = fakeStorage();
    const id = getPlayerId(s);
    expect(id).toMatch(UUID_RE);
    expect(s._data.bnbPlayerId).toBe(id); // persisted for next time
  });

  test('returns the same ID on later calls (stable across sessions)', () => {
    const s = fakeStorage();
    const first = getPlayerId(s);
    const second = getPlayerId(s);
    expect(second).toBe(first);
  });

  test('reuses a well-formed UUID already in storage', () => {
    const s = fakeStorage({ bnbPlayerId: VALID_UUID });
    expect(getPlayerId(s)).toBe(VALID_UUID);
  });

  test('replaces a malformed stored value with a fresh UUID', () => {
    const s = fakeStorage({ bnbPlayerId: 'not-a-uuid; junk' });
    const id = getPlayerId(s);
    expect(id).toMatch(UUID_RE);
    expect(id).not.toBe('not-a-uuid; junk');
    expect(s._data.bnbPlayerId).toBe(id); // the clean ID overwrites the junk
  });

  test('treats an empty stored value as missing and mints a fresh ID', () => {
    const s = fakeStorage({ bnbPlayerId: '' });
    expect(getPlayerId(s)).toMatch(UUID_RE);
  });

  test('unreadable storage fails open with an ephemeral ID', () => {
    const s = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(getPlayerId(s)).toMatch(UUID_RE);
  });

  test('unwritable storage still returns an ID (unpersisted)', () => {
    const s = {
      getItem: () => null,
      setItem: () => { throw new Error('full'); },
    };
    expect(getPlayerId(s)).toMatch(UUID_RE);
  });
});
