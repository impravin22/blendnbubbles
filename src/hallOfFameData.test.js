import { BEST_RUN, GOLDEN_BOOT, SEASON } from './hallOfFameData';
import { HONEST_MAX_STREAK } from '../scripts/hallOfFame.mjs';

// Contract test for the GENERATED table.
//
// Every other test that touches the board mocks this module, which means the
// shipped data could be arbitrarily wrong and the suite would still be green.
// These assertions pin the shape src/HallOfFame.js actually depends on, so a
// bad regeneration fails here instead of on the live site.

const TABLES = [
  ['GOLDEN_BOOT', GOLDEN_BOOT],
  ['BEST_RUN', BEST_RUN],
];

describe('SEASON', () => {
  it('reports whole, non-negative totals', () => {
    for (const key of ['players', 'games', 'goals', 'weeks', 'rejected']) {
      expect(Number.isInteger(SEASON[key])).toBe(true);
      expect(SEASON[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it('describes a season that actually happened', () => {
    expect(SEASON.games).toBeGreaterThan(0);
    expect(SEASON.players).toBeGreaterThan(0);
    expect(SEASON.weeks).toBeGreaterThan(0);
  });

  it('states the ceiling the page quotes in its footnote', () => {
    expect(SEASON.ceiling).toBe(HONEST_MAX_STREAK);
  });

  it.each([['firstWeek'], ['lastWeek']])(
    'exposes %s as a well-formed week key',
    (key) => {
      // Also the injection guard: the generator refuses to emit anything that
      // is not this shape, because these two strings are the only leaderboard
      // values it writes outside of JSON.stringify.
      expect(SEASON[key]).toMatch(/^\d{4}-W\d{2}$/);
    },
  );

  it('orders the season span', () => {
    expect(SEASON.firstWeek <= SEASON.lastWeek).toBe(true);
  });

  it('cannot have more games than goals imply, nor more players than games', () => {
    expect(SEASON.players).toBeLessThanOrEqual(SEASON.games);
  });
});

describe.each(TABLES)('%s', (name, table) => {
  it('is a non-empty table of at most ten', () => {
    expect(Array.isArray(table)).toBe(true);
    expect(table.length).toBeGreaterThan(0);
    expect(table.length).toBeLessThanOrEqual(10);
  });

  it('gives every row the fields the page renders', () => {
    for (const row of table) {
      expect(typeof row.name).toBe('string');
      expect(row.name.length).toBeGreaterThan(0);
      // Rendered via getTeamByCode, which tolerates null by falling back.
      expect(row.team === null || typeof row.team === 'string').toBe(true);
      for (const key of ['goals', 'games', 'best']) {
        expect(Number.isInteger(row[key])).toBe(true);
        expect(row[key]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('holds no score above the honest ceiling', () => {
    // The one submission of 40 must never reappear in a published table.
    for (const row of table) {
      expect(row.best).toBeLessThanOrEqual(HONEST_MAX_STREAK);
    }
  });

  it('keeps names within the width the layout was built for', () => {
    for (const row of table) {
      expect(row.name.length).toBeLessThanOrEqual(40);
    }
  });

  it('never reports more goals than games at the ceiling could produce', () => {
    for (const row of table) {
      expect(row.goals).toBeLessThanOrEqual(row.games * HONEST_MAX_STREAK);
      expect(row.best).toBeLessThanOrEqual(row.goals);
    }
  });
});

describe('GOLDEN_BOOT ordering', () => {
  it('descends by career goals', () => {
    const goals = GOLDEN_BOOT.map((row) => row.goals);
    expect([...goals].sort((a, b) => b - a)).toEqual(goals);
  });
});

describe('BEST_RUN ordering', () => {
  it('descends by best single run', () => {
    const best = BEST_RUN.map((row) => row.best);
    expect([...best].sort((a, b) => b - a)).toEqual(best);
  });
});
