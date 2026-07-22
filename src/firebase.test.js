import { getWeekKey, isPlausibleScore, SCORE_CEILINGS } from './firebase';
import { getKeeperDifficulty, isSaved } from './penaltyLogic';

/**
 * Whether kick `k` can be scored by the luckiest possible perfect shot.
 *
 * Replays the shot pipeline from PenaltyShootout.js under best-case conditions:
 * the keeper is caught at one end of its patrol, the player picks any aim, and
 * the `anticipate` noise draws in the player's favour. Power wobble is left out
 * because its best-case draw is zero deviation, so this is a strict upper bound
 * on what is scoreable — exactly what a ceiling has to accommodate.
 */
function isKickScoreable(kick) {
  const d = getKeeperDifficulty(kick);
  for (const keeperX of [0.5 - d.oscRange, 0.5 + d.oscRange]) {
    for (let aimX = 0; aimX <= 1.0001; aimX += 0.01) {
      for (let aimY = 0; aimY <= 1.0001; aimY += 0.05) {
        // The kindest noise draw nudges the keeper away from the shot.
        const away = aimX >= keeperX ? -1 : 1;
        const keeperAtShot =
          keeperX + d.readBias * (aimX - keeperX) + away * d.anticipate;
        if (!isSaved({ x: aimX, y: aimY }, keeperAtShot, d)) return true;
      }
    }
  }
  return false;
}

/** Longest streak the keeper curve permits: the last consecutively scoreable kick. */
function derivedHonestCeiling() {
  let k = 1;
  while (k < 200 && isKickScoreable(k)) k++;
  return k - 1;
}

describe('isPlausibleScore', () => {
  // 19 is the highest streak the keeper curve permits; see the derivation in
  // firebase.js and the proof in penaltyLogic.test.js. A best-ever honest run
  // must still be accepted, so 19 passes and 20 does not.
  test('football scores up to the honest ceiling of 19 pass', () => {
    expect(SCORE_CEILINGS.football).toBe(19);
    expect(isPlausibleScore(0, 'football')).toBe(true);
    expect(isPlausibleScore(18, 'football')).toBe(true);
    expect(isPlausibleScore(19, 'football')).toBe(true);
  });

  test('football scores above the honest ceiling are rejected', () => {
    expect(isPlausibleScore(20, 'football')).toBe(false);
    expect(isPlausibleScore(101, 'football')).toBe(false);
    expect(isPlausibleScore(9999, 'football')).toBe(false);
  });

  // Regression: the ceiling used to sit at 40 against an honest wall of 18. The
  // 22-point gap was reachable only by editing the score in the browser, and a
  // player did exactly that, reading 40 out of the bundle and submitting it.
  // The ceiling must never again exceed what honest play can score.
  test('40 is rejected — the exact value the old headroom allowed', () => {
    expect(isPlausibleScore(40, 'football')).toBe(false);
  });

  test('boba catcher keeps its own, higher ceiling', () => {
    expect(SCORE_CEILINGS.bobacatcher).toBe(1000);
    expect(isPlausibleScore(250, 'bobacatcher')).toBe(true);
    expect(isPlausibleScore(1001, 'bobacatcher')).toBe(false);
  });

  test('non-integer and negative scores are rejected for any game', () => {
    expect(isPlausibleScore(-1, 'football')).toBe(false);
    expect(isPlausibleScore(3.5, 'football')).toBe(false);
    expect(isPlausibleScore(NaN, 'football')).toBe(false);
    expect(isPlausibleScore('12', 'football')).toBe(false);
  });
});

// The whole exploit came from a ceiling that drifted above what the game could
// actually produce, so the two are locked together here. Retuning the keeper
// curve without moving the ceiling — in either direction — fails this block.
describe('football ceiling tracks the keeper curve', () => {
  test('the ceiling is exactly the highest streak the curve permits', () => {
    expect(SCORE_CEILINGS.football).toBe(derivedHonestCeiling());
  });

  test('the last allowed kick is scoreable and the next one is not', () => {
    expect(isKickScoreable(SCORE_CEILINGS.football)).toBe(true);
    expect(isKickScoreable(SCORE_CEILINGS.football + 1)).toBe(false);
  });

  test('the wall is where the read bias overtakes the reachable gap', () => {
    // Sanity-check the mechanism, not just the number: past the wall the keeper
    // tracks the shot far enough that no gap beats its dive plus reach.
    const wall = getKeeperDifficulty(SCORE_CEILINGS.football + 1);
    const widestGap = 2 * wall.oscRange * (1 - wall.readBias) + wall.anticipate;
    expect(widestGap).toBeLessThan(wall.dive + wall.reachX);
  });
});

// firestore.rules is the copy that actually enforces the ceiling, and it cannot
// import anything — so nothing but this test stops it drifting from the code.
// The realistic failure is quiet: retune the curve, bump HONEST_MAX_STREAK,
// tests pass, ship, and every player who reaches the new maximum gets "Could
// not submit" while the leaderboard silently rejects them.
describe('firestore.rules agrees with the derived ceiling', () => {
  const fs = require('fs');
  const path = require('path');

  const ceilingIn = (file) => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const match = source.match(/game == 'football' \? (\d+)/);
    if (!match) throw new Error(`No football ceiling found in ${file}`);
    return Number(match[1]);
  };

  test('the live ruleset uses the same football ceiling as the client', () => {
    expect(ceilingIn('firestore.rules')).toBe(SCORE_CEILINGS.football);
  });

  test('the transitional ruleset uses it too', () => {
    expect(ceilingIn('firestore.rules.transitional')).toBe(SCORE_CEILINGS.football);
  });
});

// The rules pin `week` to a shape rather than a length, because the generated
// Hall of Fame module interpolates the first and last week keys into its header
// and a newline in one would end that comment. The cost of pinning it is that
// getWeekKey() must never emit anything outside the shape: if it did, every
// score submission would start failing server-side while the client showed no
// error at all. That makes this contract worth a test, not just a comment.
//
// It is a live constraint, not a historical one — Boba Catcher still writes.
describe('getWeekKey satisfies the week shape firestore.rules enforces', () => {
  const fs = require('fs');
  const path = require('path');

  // Read the pattern out of the ruleset rather than restating it, so editing
  // one without the other fails here.
  const rulePattern = () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const match = source.match(/value\.matches\('([^']+)'\)/);
    if (!match) throw new Error('No week pattern found in firestore.rules');
    return new RegExp(match[1]);
  };

  test('the ruleset states a week pattern', () => {
    expect(rulePattern().source).toBe('^[0-9]{4}-W[0-9]{2}$');
  });

  test('todays key matches it', () => {
    expect(getWeekKey()).toMatch(rulePattern());
  });

  test.each([0, 1, 2, 5, 13, 26, 52, 104])('an offset of %i weeks back matches it', (offset) => {
    expect(getWeekKey(offset)).toMatch(rulePattern());
  });

  test('every week of every year from 2020 to 2035 matches it', () => {
    // getWeekKey reads the clock, so replicate its arithmetic over fixed dates.
    const keyAt = (date) => {
      const jan1 = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date - jan1) / 86400000);
      const week = Math.ceil((days + jan1.getDay() + 1) / 7);
      return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
    };

    const pattern = rulePattern();
    const offenders = [];
    for (const d = new Date(2020, 0, 1); d < new Date(2036, 0, 1); d.setDate(d.getDate() + 1)) {
      const key = keyAt(d);
      if (!pattern.test(key)) offenders.push(key);
    }

    expect(offenders).toEqual([]);
  });

  test('the replicated arithmetic still matches the real implementation', () => {
    // Guards the test above from drifting away from the function it stands in for.
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - jan1) / 86400000);
    const week = Math.ceil((days + jan1.getDay() + 1) / 7);

    expect(`${now.getFullYear()}-W${String(week).padStart(2, '0')}`).toBe(getWeekKey());
  });
});
