import {
  getKeeperDifficulty,
  keeperOscX,
  isSaved,
  dragToAim,
  applyPowerWobble,
  getReward,
} from './penaltyLogic';

describe('getKeeperDifficulty (tiered by kick count)', () => {
  test('three tiers: hard 1-5, harder 6-10, extreme 11+', () => {
    const hard = getKeeperDifficulty(3);
    const harder = getKeeperDifficulty(8);
    const extreme = getKeeperDifficulty(15);
    // Coverage and pace grow tier over tier.
    expect(harder.reachX).toBeGreaterThan(hard.reachX);
    expect(extreme.reachX).toBeGreaterThan(harder.reachX);
    expect(harder.dive).toBeGreaterThan(hard.dive);
    expect(extreme.dive).toBeGreaterThan(harder.dive);
    expect(harder.oscSpeed).toBeGreaterThan(hard.oscSpeed);
    expect(extreme.oscSpeed).toBeGreaterThanOrEqual(harder.oscSpeed);
  });

  test('tier boundaries fall on 5 and 10', () => {
    expect(getKeeperDifficulty(5)).toEqual(getKeeperDifficulty(1)); // both hard tier
    expect(getKeeperDifficulty(6)).toEqual(getKeeperDifficulty(10)); // both harder tier
    expect(getKeeperDifficulty(11)).not.toEqual(getKeeperDifficulty(10)); // extreme begins
  });

  test('the first kick is already hard, not eased in', () => {
    // Tier-1 coverage is well above a "wide open net" baseline.
    const first = getKeeperDifficulty(1);
    expect(first.reachX).toBeGreaterThanOrEqual(0.2);
    expect(first.diveVert).toBeGreaterThanOrEqual(0.25);
  });

  test('clamps a kick below one to the first kick', () => {
    expect(getKeeperDifficulty(0)).toEqual(getKeeperDifficulty(1));
  });

  test('extreme tier stays capped so a placed shot is always scoreable', () => {
    const veryHard = getKeeperDifficulty(999);
    expect(veryHard.dive).toBeLessThanOrEqual(0.35);
    expect(veryHard.reachX).toBeLessThanOrEqual(0.24);
    expect(veryHard.reachY).toBeLessThanOrEqual(0.62);
    expect(veryHard.oscSpeed).toBeLessThanOrEqual(0.006);
    // Far corner must stay open: max horizontal cover < distance across the goal.
    expect(veryHard.dive + veryHard.reachX).toBeLessThan(0.6);
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
  const tier1 = getKeeperDifficulty(1); // dive 0.3, diveVert 0.46, reachX 0.21, reachY 0.5, guardY 0.6

  test('saves a low shot right at the keeper', () => {
    expect(isSaved({ x: 0.5, y: 0.62 }, 0.5, tier1)).toBe(true);
  });

  test('a shot to the opposite corner beats the lunge', () => {
    // Keeper pinned to the left post; a low shot to the right post is too far.
    expect(isSaved({ x: 0.9, y: 0.62 }, 0.16, tier1)).toBe(false);
  });

  test('even tier 1 stretches up to save a centred top-bins shot', () => {
    // Hard from kick 1: a top shot in the keeper's own column is saved.
    expect(isSaved({ x: 0.5, y: 0.2 }, 0.5, tier1)).toBe(true);
  });

  test('a far top corner away from the keeper is still open at tier 1', () => {
    // Keeper pinned left; top-right shot is too far sideways to reach.
    expect(isSaved({ x: 0.85, y: 0.2 }, 0.2, tier1)).toBe(false);
  });

  test('the extreme keeper stretches up to save top bins when lined up', () => {
    const extreme = getKeeperDifficulty(999);
    expect(isSaved({ x: 0.5, y: 0.18 }, 0.5, extreme)).toBe(true);
  });

  test('a shot within the lunge window is saved', () => {
    expect(isSaved({ x: 0.56, y: 0.6 }, 0.5, tier1)).toBe(true);
  });

  test('even the extreme keeper cannot cover the opposite corner', () => {
    const extreme = getKeeperDifficulty(999);
    // Keeper pinned to the left, shot to the top-right corner: too far sideways.
    expect(isSaved({ x: 0.88, y: 0.2 }, 0.2, extreme)).toBe(false);
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
