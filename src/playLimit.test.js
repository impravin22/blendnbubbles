import { DAILY_LIMIT, triesLeft, recordPlay } from './playLimit';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    _data: data,
  };
}

const NOON = '2026-06-12T12:00:00';
const TOMORROW = '2026-06-13T09:00:00';

describe('playLimit', () => {
  test('a fresh device has the full daily allowance', () => {
    expect(DAILY_LIMIT).toBe(3);
    expect(triesLeft(fakeStorage(), NOON)).toBe(3);
  });

  test('each play decrements until the limit is reached', () => {
    const s = fakeStorage();
    expect(recordPlay(s, NOON)).toBe(2);
    expect(recordPlay(s, NOON)).toBe(1);
    expect(recordPlay(s, NOON)).toBe(0);
    expect(triesLeft(s, NOON)).toBe(0);
  });

  test('the allowance resets on the next calendar day', () => {
    const s = fakeStorage();
    recordPlay(s, NOON);
    recordPlay(s, NOON);
    recordPlay(s, NOON);
    expect(triesLeft(s, NOON)).toBe(0);
    expect(triesLeft(s, TOMORROW)).toBe(3);
    expect(recordPlay(s, TOMORROW)).toBe(2);
  });

  test('plays beyond the limit never go negative', () => {
    const s = fakeStorage();
    for (let i = 0; i < 5; i++) recordPlay(s, NOON);
    expect(triesLeft(s, NOON)).toBe(0);
  });

  test('corrupt storage resets rather than blocking', () => {
    const s = fakeStorage({ penaltyPlays: '{not json' });
    expect(triesLeft(s, NOON)).toBe(3);
  });

  test('throwing storage fails open', () => {
    const s = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(triesLeft(s, NOON)).toBe(3);
    expect(recordPlay(s, NOON)).toBe(2); // play allowed, bookkeeping skipped
  });
});
