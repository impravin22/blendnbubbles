import {
  getKeeperDifficulty,
  pickKeeperGuess,
  isSaved,
  dragToAim,
  applyPowerWobble,
  getReward,
  AIM_ZONES,
} from './penaltyLogic';

// Deterministic RNG: replays a fixed queue of values, looping.
function seededRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('getKeeperDifficulty', () => {
  test('grows with streak but stays capped (always beatable)', () => {
    const easy = getKeeperDifficulty(0);
    const hard = getKeeperDifficulty(50);
    expect(hard.reachX).toBeGreaterThan(easy.reachX);
    expect(hard.readChance).toBeGreaterThan(easy.readChance);
    // Caps keep a corner reachable: reach never spans the whole goal, and
    // readChance stays below 1 so a ~15% "keeper guessed wrong" escape remains.
    expect(hard.reachX).toBeLessThanOrEqual(0.4);
    expect(hard.reachY).toBeLessThanOrEqual(0.52);
    expect(hard.readChance).toBeLessThanOrEqual(0.85);
  });

  test('clamps negative streak to zero baseline', () => {
    expect(getKeeperDifficulty(-5)).toEqual(getKeeperDifficulty(0));
  });
});

describe('pickKeeperGuess', () => {
  test('reads both axes near the shooter aim when rng is below readChance', () => {
    // streak 0 → readChance 0.30. First rng value 0.05 < 0.30 → read branch.
    // rng 0.5 on the jitter terms → zero offset, so the dive lands on the aim.
    const rng = seededRng([0.05, 0.5, 0.5]);
    const guess = pickKeeperGuess({ x: 0.84, y: 0.22 }, 0, rng);
    expect(guess.read).toBe(true);
    // Read dive tracks the shooter's x (±0.08) AND y (±0.15).
    expect(Math.abs(guess.x - 0.84)).toBeLessThanOrEqual(0.08);
    expect(Math.abs(guess.y - 0.22)).toBeLessThanOrEqual(0.15);
  });

  test('commits to a random zone when rng is above readChance', () => {
    // First rng 0.95 > 0.30 → random-zone branch; second picks the zone index.
    const rng = seededRng([0.95, 0]);
    const guess = pickKeeperGuess({ x: 0.5, y: 0.5 }, 0, rng);
    expect(guess.read).toBe(false);
    expect(guess.x).toBe(AIM_ZONES[0].x);
    expect(guess.y).toBe(AIM_ZONES[0].y);
  });
});

describe('isSaved', () => {
  const diff = getKeeperDifficulty(0); // reachX 0.16, reachY 0.26

  test('saves a shot inside the keeper reach box', () => {
    const keeper = { x: 0.5, y: 0.5 };
    expect(isSaved({ x: 0.55, y: 0.55 }, keeper, diff)).toBe(true);
  });

  test('lets a corner past a centred keeper', () => {
    const keeper = { x: 0.5, y: 0.5 };
    // Top-right corner is outside both reach axes.
    expect(isSaved({ x: 0.84, y: 0.22 }, keeper, diff)).toBe(false);
  });

  test('even a max-difficulty keeper cannot cover the opposite corner', () => {
    const hard = getKeeperDifficulty(99);
    const keeperLeft = { x: 0.16, y: 0.7 };
    expect(isSaved({ x: 0.84, y: 0.18 }, keeperLeft, hard)).toBe(false);
  });
});

describe('dragToAim', () => {
  test('straight-up drag aims centre-high with mid power', () => {
    const aim = dragToAim(0, -150, 220);
    expect(aim.x).toBeCloseTo(0.5, 5);
    expect(aim.y).toBeLessThan(0.5); // higher in the goal
    expect(aim.power).toBeGreaterThan(0);
    expect(aim.power).toBeLessThanOrEqual(1);
  });

  test('full right-up drag aims the top-right corner at max power', () => {
    const aim = dragToAim(220, -220, 220);
    expect(aim.x).toBeGreaterThan(0.7);
    expect(aim.y).toBeLessThan(0.4);
    expect(aim.power).toBe(1);
  });

  test('aim coordinates clamp to 0..1', () => {
    const aim = dragToAim(9999, -9999, 220);
    expect(aim.x).toBeLessThanOrEqual(1);
    expect(aim.y).toBeGreaterThanOrEqual(0);
  });
});

describe('applyPowerWobble', () => {
  test('clean shots (<=70% power) are unchanged', () => {
    const aim = { x: 0.84, y: 0.22 };
    const out = applyPowerWobble(aim, 0.6, () => 0.5);
    expect(out.x).toBeCloseTo(0.84, 5);
    expect(out.y).toBeCloseTo(0.22, 5);
  });

  test('high-power shots wobble away from the target', () => {
    const aim = { x: 0.5, y: 0.5 };
    // rng 1 → max positive wobble; power 1 → over = 0.3 → wobble 0.054.
    const out = applyPowerWobble(aim, 1, () => 1);
    expect(out.x).toBeGreaterThan(0.5);
  });
});

describe('getReward', () => {
  test('tiers by goal count', () => {
    expect(getReward(15).tier).toBe('PENALTY KING');
    expect(getReward(12).tier).toBe('PENALTY KING');
    expect(getReward(8).tier).toBe('SPOT-KICK STAR');
    expect(getReward(7).tier).toBe('SPOT-KICK STAR');
    expect(getReward(4).tier).toBe('STRIKER');
    expect(getReward(3).tier).toBe('STRIKER');
    expect(getReward(2).tier).toBe('ROOKIE');
    expect(getReward(0).tier).toBe('ROOKIE');
  });
});
