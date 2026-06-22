import { generateUUID } from './uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateUUID', () => {
  test('produces a v4-style UUID', () => {
    expect(generateUUID()).toMatch(UUID_RE);
  });

  test('produces a different value on each call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateUUID()));
    expect(ids.size).toBe(50);
  });
});
