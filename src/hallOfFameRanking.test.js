import {
  HONEST_MAX_STREAK,
  aggregatePlayers,
  isHonestFootballRow,
  playerKey,
  rankByBestRun,
  rankByCareerGoals,
  summarise,
} from '../scripts/hallOfFame.mjs';

const row = (overrides = {}) => ({
  name: 'Player',
  score: 5,
  game: 'football',
  week: '2026-W24',
  ...overrides,
});

describe('isHonestFootballRow', () => {
  it('accepts a well-formed football row', () => {
    expect(isHonestFootballRow(row())).toBe(true);
  });

  it('accepts the ceiling itself, which is legitimately reachable', () => {
    expect(isHonestFootballRow(row({ score: HONEST_MAX_STREAK }))).toBe(true);
  });

  it('rejects a score above the ceiling', () => {
    // The real leaderboard holds exactly one of these: a 40 submitted after a
    // player read the old ceiling out of the JS bundle.
    expect(isHonestFootballRow(row({ score: 40 }))).toBe(false);
  });

  it('rejects other games so a Boba Catcher score never enters the football board', () => {
    expect(isHonestFootballRow(row({ game: 'bobacatcher', score: 900 }))).toBe(false);
  });

  it('rejects rows with no game field', () => {
    const { game, ...noGame } = row();
    expect(isHonestFootballRow(noGame)).toBe(false);
  });

  it.each([
    ['negative', -1],
    ['fractional', 4.5],
    ['string', '7'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
  ])('rejects a %s score', (_label, score) => {
    expect(isHonestFootballRow(row({ score }))).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['missing', undefined],
    ['non-string', 42],
  ])('rejects a %s name', (_label, name) => {
    expect(isHonestFootballRow(row({ name }))).toBe(false);
  });

  it('rejects null and undefined rows without throwing', () => {
    expect(isHonestFootballRow(null)).toBe(false);
    expect(isHonestFootballRow(undefined)).toBe(false);
  });
});

describe('playerKey', () => {
  it('prefers playerId when present', () => {
    expect(playerKey(row({ playerId: 'abc', name: 'Ada' }))).toBe('id:abc');
  });

  it('falls back to a case-folded, trimmed name', () => {
    expect(playerKey(row({ name: '  AdA  ' }))).toBe('name:ada');
  });

  it('does not merge an id-bearing row into a same-named id-less row', () => {
    // Two customers can share a first name. Folding them together would credit
    // one with the other's goals, which is worse than showing two rows.
    expect(playerKey(row({ name: 'Rahul', playerId: 'device-1' }))).not.toBe(
      playerKey(row({ name: 'Rahul' })),
    );
  });
});

describe('aggregatePlayers', () => {
  it('sums goals and counts games for one player across weeks', () => {
    const players = aggregatePlayers([
      row({ playerId: 'p1', score: 4, week: '2026-W24' }),
      row({ playerId: 'p1', score: 7, week: '2026-W25' }),
      row({ playerId: 'p1', score: 2, week: '2026-W26' }),
    ]);

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ goals: 13, games: 3, best: 7 });
  });

  it('drops dishonest rows before counting, rather than clamping them', () => {
    // Clamping a forged 40 to 19 would let it outrank players who earned it.
    const players = aggregatePlayers([
      row({ playerId: 'p1', score: 40 }),
      row({ playerId: 'p1', score: 6 }),
    ]);

    expect(players[0]).toMatchObject({ goals: 6, games: 1, best: 6 });
  });

  it('keeps the name spelling used on the best run', () => {
    const players = aggregatePlayers([
      row({ playerId: 'p1', name: 'rahul', score: 3 }),
      row({ playerId: 'p1', name: 'Rahul Roy', score: 11 }),
    ]);

    expect(players[0].name).toBe('Rahul Roy');
  });

  it('picks the most-played nation', () => {
    const players = aggregatePlayers([
      row({ playerId: 'p1', team: 'ARG' }),
      row({ playerId: 'p1', team: 'BRA' }),
      row({ playerId: 'p1', team: 'ARG' }),
    ]);

    expect(players[0].team).toBe('ARG');
  });

  it('breaks a nation tie deterministically, not by insertion order', () => {
    const forward = aggregatePlayers([
      row({ playerId: 'p1', team: 'POR' }),
      row({ playerId: 'p1', team: 'ARG' }),
    ]);
    const reversed = aggregatePlayers([
      row({ playerId: 'p1', team: 'ARG' }),
      row({ playerId: 'p1', team: 'POR' }),
    ]);

    expect(forward[0].team).toBe(reversed[0].team);
  });

  it('leaves team null when no nation was ever recorded', () => {
    expect(aggregatePlayers([row({ playerId: 'p1' })])[0].team).toBeNull();
  });

  it('truncates an over-long name', () => {
    const players = aggregatePlayers([row({ playerId: 'p1', name: `  ${'A'.repeat(60)}  ` })]);

    expect(players[0].name).toHaveLength(40);
    expect(players[0].name.endsWith('…')).toBe(true);
  });

  it('collapses internal runs of whitespace', () => {
    const players = aggregatePlayers([row({ playerId: 'p1', name: ' Ada\t\n  Lovelace ' })]);

    expect(players[0].name).toBe('Ada Lovelace');
  });

  it('returns an empty array for no rows', () => {
    expect(aggregatePlayers([])).toEqual([]);
  });

  it('counts a zero-goal game as a game played', () => {
    const players = aggregatePlayers([row({ playerId: 'p1', score: 0 })]);
    expect(players[0]).toMatchObject({ goals: 0, games: 1, best: 0 });
  });
});

describe('rankByCareerGoals', () => {
  const players = [
    { name: 'Low', team: 'ARG', goals: 10, games: 2, best: 6 },
    { name: 'High', team: 'BRA', goals: 90, games: 9, best: 12 },
    { name: 'Mid', team: 'POR', goals: 50, games: 5, best: 18 },
  ];

  it('orders by career goals, highest first', () => {
    expect(rankByCareerGoals(players).map((p) => p.name)).toEqual(['High', 'Mid', 'Low']);
  });

  it('breaks a goals tie on the better single run', () => {
    const tied = [
      { name: 'Grinder', goals: 40, games: 20, best: 4 },
      { name: 'Striker', goals: 40, games: 20, best: 15 },
    ];
    expect(rankByCareerGoals(tied)[0].name).toBe('Striker');
  });

  it('breaks a full tie on name so repeat runs are byte-identical', () => {
    const tied = [
      { name: 'Zoe', goals: 5, games: 1, best: 5 },
      { name: 'Amir', goals: 5, games: 1, best: 5 },
    ];
    expect(rankByCareerGoals(tied).map((p) => p.name)).toEqual(['Amir', 'Zoe']);
  });

  it('caps the table at ten', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      name: `P${i}`,
      goals: i,
      games: 1,
      best: 1,
    }));
    expect(rankByCareerGoals(many)).toHaveLength(10);
  });

  it('does not mutate the array it is given', () => {
    const input = [...players];
    rankByCareerGoals(input);
    expect(input.map((p) => p.name)).toEqual(['Low', 'High', 'Mid']);
  });

  it('returns fewer than ten when fewer players exist', () => {
    expect(rankByCareerGoals(players.slice(0, 2))).toHaveLength(2);
  });
});

describe('rankByBestRun', () => {
  it('orders by longest streak, highest first', () => {
    const players = [
      { name: 'A', goals: 100, games: 30, best: 9 },
      { name: 'B', goals: 20, games: 2, best: 19 },
    ];
    expect(rankByBestRun(players)[0].name).toBe('B');
  });

  it('breaks a streak tie on career goals', () => {
    // Eight real players finished on 18; among equals, doing it more often wins.
    const tied = [
      { name: 'Once', goals: 18, games: 1, best: 18 },
      { name: 'Often', goals: 88, games: 7, best: 18 },
    ];
    expect(rankByBestRun(tied)[0].name).toBe('Often');
  });

  it('breaks a streak-and-goals tie on fewer games', () => {
    const tied = [
      { name: 'Ground it out', goals: 40, games: 12, best: 18 },
      { name: 'Efficient', goals: 40, games: 3, best: 18 },
    ];
    expect(rankByBestRun(tied)[0].name).toBe('Efficient');
  });

  it('breaks a total tie on name so repeat runs are byte-identical', () => {
    const tied = [
      { name: 'Zoe', goals: 18, games: 1, best: 18 },
      { name: 'Amir', goals: 18, games: 1, best: 18 },
    ];
    expect(rankByBestRun(tied).map((p) => p.name)).toEqual(['Amir', 'Zoe']);
  });
});

// Both comparators share a contract: cap at ten, never mutate the caller's array.
describe.each([
  ['rankByCareerGoals', rankByCareerGoals],
  ['rankByBestRun', rankByBestRun],
])('%s shared contract', (_name, rank) => {
  const many = Array.from({ length: 25 }, (_, i) => ({
    name: `P${i}`,
    goals: i,
    games: 1,
    best: i % 20,
  }));

  it('caps the table at ten', () => {
    expect(rank(many)).toHaveLength(10);
  });

  it('does not mutate the array it is given', () => {
    const input = [...many];
    rank(input);
    expect(input.map((p) => p.name)).toEqual(many.map((p) => p.name));
  });

  it('returns an empty table for no players', () => {
    expect(rank([])).toEqual([]);
  });
});

describe('summarise', () => {
  const rows = [
    row({ playerId: 'p1', score: 4, week: '2026-W24' }),
    row({ playerId: 'p1', score: 6, week: '2026-W25' }),
    row({ playerId: 'p2', score: 9, week: '2026-W25' }),
    row({ playerId: 'p3', score: 40, week: '2026-W26' }),
    row({ game: 'bobacatcher', score: 500, week: '2026-W24' }),
  ];

  it('counts only honest football rows', () => {
    expect(summarise(rows)).toMatchObject({ games: 3, goals: 19, players: 2, rejected: 1 });
  });

  it('reports the week span from honest rows only', () => {
    expect(summarise(rows)).toMatchObject({
      weeks: 2,
      firstWeek: '2026-W24',
      lastWeek: '2026-W25',
    });
  });

  it('exposes the ceiling so the page can state it without hardcoding', () => {
    expect(summarise(rows).ceiling).toBe(HONEST_MAX_STREAK);
  });

  it('handles an empty collection without throwing', () => {
    expect(summarise([])).toMatchObject({
      games: 0,
      goals: 0,
      players: 0,
      rejected: 0,
      weeks: 0,
      firstWeek: null,
      lastWeek: null,
    });
  });

  it('does not count a rejected row as a Boba Catcher rejection', () => {
    // `rejected` must describe football only, or the footnote misleads.
    expect(summarise([row({ game: 'bobacatcher', score: 5000 })]).rejected).toBe(0);
  });
});
