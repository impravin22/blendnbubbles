// Tests for the week-keyed leaderboard read path. The Firestore SDK is mocked
// at the module boundary so getWeeklyLeaderboard can be exercised without a
// live database; getWeekKey is tested against a frozen clock.

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(),
  // query just forwards its filter args so a test can inspect them.
  query: jest.fn((_collection, ...filters) => ({ filters })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDocs: jest.fn(),
}));

import { getDocs, where } from 'firebase/firestore';
import { getWeekKey, getWeeklyLeaderboard } from './firebase';

// Build a fake Firestore snapshot from plain objects.
function snapshotOf(rows) {
  return { docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) };
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('getWeekKey', () => {
  test('offset 0 is the current week for a frozen clock', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15)); // Mon 15 Jun 2026
    expect(getWeekKey(0)).toBe('2026-W25');
  });

  test('offset 1 is the previous week', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15));
    expect(getWeekKey(1)).toBe('2026-W24');
  });

  test('defaults to the current week when called with no argument', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15));
    expect(getWeekKey()).toBe('2026-W25');
  });

  test('rolls back across a year boundary', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 3)); // Sat 3 Jan 2026
    // One week earlier lands in the prior calendar year, not 2026-W00.
    expect(getWeekKey(1).startsWith('2025-W')).toBe(true);
  });
});

describe('getWeeklyLeaderboard', () => {
  test('queries the offset week, keeps only the game, sorts desc, caps at 10', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15));
    const rows = [
      { id: 'a', name: 'Low', score: 3, game: 'football' },
      { id: 'b', name: 'High', score: 18, game: 'football' },
      { id: 'c', name: 'Boba', score: 999, game: 'bobacatcher' },
      { id: 'd', name: 'Legacy', score: 500 }, // no game field -> bobacatcher
    ];
    getDocs.mockResolvedValueOnce(snapshotOf(rows));

    const result = await getWeeklyLeaderboard('football', 1);

    expect(where).toHaveBeenCalledWith('week', '==', '2026-W24');
    expect(result.map((entry) => entry.name)).toEqual(['High', 'Low']);
  });

  test('queries the current week when offset is 0 (guards against off-by-one)', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15));
    getDocs.mockResolvedValueOnce(snapshotOf([]));
    await getWeeklyLeaderboard('football', 0);
    expect(where).toHaveBeenCalledWith('week', '==', '2026-W25');
  });

  test('returns at most 10 entries', async () => {
    const rows = Array.from({ length: 15 }, (_unused, index) => ({
      id: String(index),
      name: `P${index}`,
      score: index,
      game: 'football',
    }));
    getDocs.mockResolvedValueOnce(snapshotOf(rows));

    const result = await getWeeklyLeaderboard('football', 0);

    expect(result).toHaveLength(10);
    expect(result[0].score).toBe(14); // highest first
  });

  test('returns an empty array when the week has no rows (boundary)', async () => {
    getDocs.mockResolvedValueOnce(snapshotOf([]));
    const result = await getWeeklyLeaderboard('football', 1);
    expect(result).toEqual([]);
  });

  test('propagates a Firestore read error (error case)', async () => {
    getDocs.mockRejectedValueOnce(new Error('network down'));
    await expect(getWeeklyLeaderboard('football', 1)).rejects.toThrow('network down');
  });
});
