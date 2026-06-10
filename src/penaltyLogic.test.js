import {
  getKeeperDifficulty,
  keeperOscX,
  isSaved,
  dragToAim,
  applyPowerWobble,
  getReward,
} from './penaltyLogic';

describe('getKeeperDifficulty (tiered by kick count)', () => {
  test('ramps across four tiers: easy, medium, very hard, extreme', () => {
    const easy = getKeeperDifficulty(1);
    const medium = getKeeperDifficulty(2);
    const veryHard = getKeeperDifficulty(3);
    const extreme = getKeeperDifficulty(5);
    // Coverage and pace grow tier over tier toward the reward kick.
    expect(medium.reachX).toBeGreaterThan(easy.reachX);
    expect(veryHard.reachX).toBeGreaterThan(medium.reachX);
    expect(extreme.reachX).toBeGreaterThan(veryHard.reachX);
    expect(medium.dive).toBeGreaterThan(easy.dive);
    expect(veryHard.dive).toBeGreaterThan(medium.dive);
    expect(extreme.dive).toBeGreaterThan(veryHard.dive);
    expect(medium.oscSpeed).toBeGreaterThan(easy.oscSpeed);
    expect(veryHard.oscSpeed).toBeGreaterThan(medium.oscSpeed);
    expect(extreme.oscSpeed).toBeGreaterThan(veryHard.oscSpeed);
  });

  test('tier boundaries fall on goals 1, 2 and 4 (reward at 5)', () => {
    expect(getKeeperDifficulty(2)).not.toEqual(getKeeperDifficulty(1)); // medium begins
    expect(getKeeperDifficulty(3)).not.toEqual(getKeeperDifficulty(2)); // very hard begins
    expect(getKeeperDifficulty(4)).toEqual(getKeeperDifficulty(3)); // 3-4 share the very-hard tier
    expect(getKeeperDifficulty(5)).not.toEqual(getKeeperDifficulty(4)); // extreme begins on the reward kick
  });

  test('the first kick is the most beatable tier', () => {
    const easy = getKeeperDifficulty(1);
    const medium = getKeeperDifficulty(2);
    // First kick leaves more of the goal open than later kicks.
    expect(easy.dive + easy.reachX).toBeLessThan(medium.dive + medium.reachX);
    expect(easy.diveVert).toBeLessThan(medium.diveVert);
  });

  test('clamps a kick below one to the first kick', () => {
    expect(getKeeperDifficulty(0)).toEqual(getKeeperDifficulty(1));
  });

  test('extreme tier stays capped so a placed shot is always scoreable', () => {
    const veryHard = getKeeperDifficulty(999);
    expect(veryHard.dive).toBeLessThanOrEqual(0.33);
    expect(veryHard.reachX).toBeLessThanOrEqual(0.26);
    expect(veryHard.reachY).toBeLessThanOrEqual(0.62);
    expect(veryHard.oscSpeed).toBeLessThanOrEqual(0.011);
    // Far corner must stay open: max horizontal cover < distance across the goal.
    expect(veryHard.dive + veryHard.reachX).toBeLessThan(0.6);
  });

  test('anticipation is zero on the first kick and grows modestly, capped', () => {
    expect(getKeeperDifficulty(1).anticipate).toBe(0);
    expect(getKeeperDifficulty(2).anticipate).toBeGreaterThan(0);
    expect(getKeeperDifficulty(5).anticipate).toBeGreaterThan(getKeeperDifficulty(3).anticipate);
    expect(getKeeperDifficulty(999).anticipate).toBeLessThanOrEqual(0.06);
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
  const first = getKeeperDifficulty(1); // easy: dive 0.14, diveVert 0.1, reachX 0.13, reachY 0.24, guardY 0.62

  test('saves a low shot right at the keeper', () => {
    expect(isSaved({ x: 0.5, y: 0.62 }, 0.5, first)).toBe(true);
  });

  test('a shot to the opposite corner beats the lunge', () => {
    // Keeper pinned to the left post; a low shot to the right post is too far.
    expect(isSaved({ x: 0.9, y: 0.62 }, 0.16, first)).toBe(false);
  });

  test('the first kick leaves the top bins open', () => {
    // First kick stays low, so a top shot in its own column still beats it.
    expect(isSaved({ x: 0.5, y: 0.2 }, 0.5, first)).toBe(false);
  });

  test('after one goal the keeper springs up to cover centred top bins', () => {
    const veryHard = getKeeperDifficulty(2);
    expect(isSaved({ x: 0.5, y: 0.2 }, 0.5, veryHard)).toBe(true);
  });

  test('a far top corner away from the keeper is still open on the first kick', () => {
    // Keeper pinned left; top-right shot is too far sideways to reach.
    expect(isSaved({ x: 0.85, y: 0.2 }, 0.2, first)).toBe(false);
  });

  test('the extreme keeper stretches up to save top bins when lined up', () => {
    const extreme = getKeeperDifficulty(999);
    expect(isSaved({ x: 0.5, y: 0.18 }, 0.5, extreme)).toBe(true);
  });

  test('a shot within the lunge window is saved', () => {
    expect(isSaved({ x: 0.56, y: 0.6 }, 0.5, first)).toBe(true);
  });

  test('even the extreme keeper cannot cover the opposite corner', () => {
    const extreme = getKeeperDifficulty(999);
    // Keeper pinned to the left, shot to the top-right corner: too far sideways.
    expect(isSaved({ x: 0.88, y: 0.2 }, 0.2, extreme)).toBe(false);
  });

  test('a bottom corner away from the keeper scores (bottom is not a dead zone)', () => {
    const extreme = getKeeperDifficulty(999);
    // Keeper pinned left, low shot to the bottom-right corner: not saved.
    expect(isSaved({ x: 0.9, y: 0.88 }, 0.2, extreme)).toBe(false);
  });

  test('a bottom corner at the keeper is still saved', () => {
    const extreme = getKeeperDifficulty(999);
    expect(isSaved({ x: 0.5, y: 0.88 }, 0.5, extreme)).toBe(true);
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

  test('a small up-flick aims near the bottom of the goal (bottom corners reachable)', () => {
    // Regression: the bottom of the net used to be untargetable (y capped 0.77).
    const aim = dragToAim(150, -15, 220);
    expect(aim.y).toBeGreaterThan(0.8); // low in the goal
    expect(aim.x).toBeGreaterThan(0.7); // toward the right post
  });

  test('the full goal height is reachable from a long up-drag to a flick', () => {
    expect(dragToAim(0, -220, 220).y).toBeLessThan(0.06); // top
    expect(dragToAim(0, -5, 220).y).toBeGreaterThan(0.9); // bottom
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
  test('tiers by goal count, aligned with the 5-goal reward kick', () => {
    expect(getReward(15).tier).toBe('PENALTY KING');
    expect(getReward(10).tier).toBe('PENALTY KING');
    expect(getReward(9).tier).toBe('SPOT-KICK STAR');
    expect(getReward(5).tier).toBe('SPOT-KICK STAR');
    expect(getReward(4).tier).toBe('STRIKER');
    expect(getReward(3).tier).toBe('STRIKER');
    expect(getReward(2).tier).toBe('ROOKIE');
    expect(getReward(0).tier).toBe('ROOKIE');
  });

  test('every claimable prize is doubled (x2)', () => {
    expect(getReward(10).msg).toMatch(/2x/i);
    expect(getReward(5).msg).toMatch(/2x 10% OFF/i);
    expect(getReward(3).msg).toMatch(/2x/i);
  });
});
