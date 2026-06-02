import {
  getKeeperDifficulty,
  keeperOscX,
  isSaved,
  dragToAim,
  applyPowerWobble,
  getReward,
} from './penaltyLogic';

describe('getKeeperDifficulty (tiered by kick count)', () => {
  test('three tiers: easy <=10, medium 11-20, hard 21+', () => {
    const easy = getKeeperDifficulty(5);
    const medium = getKeeperDifficulty(15);
    const hard = getKeeperDifficulty(25);
    // Coverage and pace grow tier over tier.
    expect(medium.reachX).toBeGreaterThan(easy.reachX);
    expect(hard.reachX).toBeGreaterThan(medium.reachX);
    expect(medium.dive).toBeGreaterThan(easy.dive);
    expect(hard.dive).toBeGreaterThan(medium.dive);
    expect(medium.oscSpeed).toBeGreaterThan(easy.oscSpeed);
    expect(hard.oscSpeed).toBeGreaterThanOrEqual(medium.oscSpeed);
  });

  test('tier boundaries fall on 10 and 20', () => {
    expect(getKeeperDifficulty(10)).toEqual(getKeeperDifficulty(1)); // both easy
    expect(getKeeperDifficulty(11)).toEqual(getKeeperDifficulty(20)); // both medium
    expect(getKeeperDifficulty(21)).not.toEqual(getKeeperDifficulty(20)); // hard begins
  });

  test('clamps a kick below one to the first kick', () => {
    expect(getKeeperDifficulty(0)).toEqual(getKeeperDifficulty(1));
  });

  test('hard tier stays capped so a placed shot is always scoreable', () => {
    const veryHard = getKeeperDifficulty(999);
    expect(veryHard.dive).toBeLessThanOrEqual(0.26);
    expect(veryHard.reachX).toBeLessThanOrEqual(0.24);
    expect(veryHard.reachY).toBeLessThanOrEqual(0.46);
    expect(veryHard.oscSpeed).toBeLessThanOrEqual(0.0045);
  });
});

describe('keeperOscX (visible glide)', () => {
  test('starts centred at time zero', () => {
    const diff = getKeeperDifficulty(5);
    expect(keeperOscX(0, diff)).toBeCloseTo(0.5, 6);
  });

  test('stays within the oscillation range either side of centre', () => {
    const diff = getKeeperDifficulty(25);
    for (let t = 0; t < 10000; t += 137) {
      const x = keeperOscX(t, diff);
      expect(x).toBeGreaterThanOrEqual(0.5 - diff.oscRange - 1e-9);
      expect(x).toBeLessThanOrEqual(0.5 + diff.oscRange + 1e-9);
    }
  });
});

describe('isSaved (lunge from the keeper position)', () => {
  const easy = getKeeperDifficulty(5); // dive 0.06, reachX 0.12, reachY 0.22, guardY 0.62

  test('saves a low shot right at the keeper', () => {
    expect(isSaved({ x: 0.5, y: 0.62 }, 0.5, easy)).toBe(true);
  });

  test('a shot far from the keeper beats the lunge', () => {
    // Keeper at 0.5, shot to the right post; lunge is capped at 0.06.
    expect(isSaved({ x: 0.9, y: 0.62 }, 0.5, easy)).toBe(false);
  });

  test('an early-tier high shot clears the keeper (top bins is open)', () => {
    // Same x as the keeper but near the crossbar; easy keeper cannot stretch up.
    expect(isSaved({ x: 0.5, y: 0.2 }, 0.5, easy)).toBe(false);
  });

  test('a late-tier keeper stretches up to save top bins when lined up', () => {
    const hard = getKeeperDifficulty(999);
    // Top-of-goal shot right at the keeper's column: the vertical leap reaches it.
    expect(isSaved({ x: 0.5, y: 0.18 }, 0.5, hard)).toBe(true);
  });

  test('a shot within the lunge window is saved', () => {
    expect(isSaved({ x: 0.56, y: 0.6 }, 0.5, easy)).toBe(true);
  });

  test('even the hardest keeper cannot cover the opposite corner', () => {
    const hard = getKeeperDifficulty(999);
    // Keeper pinned to the left, shot to the top-right corner: too far sideways.
    expect(isSaved({ x: 0.88, y: 0.2 }, 0.2, hard)).toBe(false);
  });
});

describe('dragToAim', () => {
  test('straight-up drag aims centre-high with mid power', () => {
    const aim = dragToAim(0, -150, 220);
    expect(aim.x).toBeCloseTo(0.5, 5);
    expect(aim.y).toBeLessThan(0.5);
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
