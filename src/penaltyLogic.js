// ─── Penalty Shootout: pure game logic ──────────────────────
// Kept free of canvas / DOM so it can be unit-tested. The component
// (PenaltyShootout.js) imports these helpers and only owns rendering,
// animation and input.
//
// Coordinate space: the goal mouth is normalised to 0..1 on both axes.
//   x: 0 = left post, 1 = right post
//   y: 0 = crossbar (top), 1 = ground line (bottom)
//
// Skill model (not luck): the keeper glides side to side along the goal line
// in plain sight while the player aims. On release the keeper lunges from
// wherever it is toward the shot, but it can only cover a limited window, so
// the player watches it and shoots the open side. Difficulty steps up by kick
// count: easy for the first 10, harder to 20, much harder after that.

// Bengali / Hindi goal exclamations, matching Boba Catcher's flavour.
export const GOAL_WORDS = [
  'Daarun goal!',
  'Gooooal!',
  'Top bins, bhai!',
  'Jhakkas shot!',
  'Khelechho!',
  'Asadharon!',
  // Repeated so it comes up more often than the other shouts.
  'Bahot acha kiye dost!',
  'Bahot acha kiye dost!',
  'Bahot acha kiye dost!',
  'Back of the net!',
];

export const SAVE_WORDS = [
  'Keeper got it!',
  'Saved!',
  'Denied!',
  'So close!',
];

/**
 * Keeper behaviour for a given kick number (1-based). Returns how far and how
 * fast the keeper paces along the goal (oscRange / oscSpeed), how far it can
 * lunge toward the shot (dive), its reach half-box (reachX / reachY) and the
 * height it guards (guardY). The curve is built around the reward (free drink
 * at 5 goals), so it ramps tier by tier:
 *   kick 1   : easy      - wide open net, get on the board
 *   kick 2   : medium    - decent placement needed
 *   kick 3-4 : very hard - fast, wide, springs high
 *   kick 5+  : extreme   - the reward kick: fastest and widest, ramping
 */
export function getKeeperDifficulty(kick) {
  const k = Math.max(1, kick);
  // `dive` is the horizontal lunge, `diveVert` the vertical stretch toward the
  // shot. Caps keep the corner away from the keeper reachable so it stays fair.
  if (k <= 1) {
    // Goal 1: easy. Slow, low, narrow keeper leaves the corners and top bins.
    return { oscRange: 0.3, oscSpeed: 0.0034, dive: 0.14, diveVert: 0.1, reachX: 0.13, reachY: 0.24, guardY: 0.62 };
  }
  if (k <= 2) {
    // Goal 2: medium. Quicker and wider; needs a placed shot.
    return { oscRange: 0.36, oscSpeed: 0.005, dive: 0.2, diveVert: 0.24, reachX: 0.16, reachY: 0.34, guardY: 0.6 };
  }
  if (k <= 4) {
    // Goals 3-4: very hard. Fast, wide patrol, long lunge, springs high.
    return { oscRange: 0.42, oscSpeed: 0.0072, dive: 0.28, diveVert: 0.44, reachX: 0.21, reachY: 0.5, guardY: 0.58 };
  }
  // Goal 5+ (the reward kick): extreme. Ramps with each further kick but stays
  // capped so a well-placed shot to the corner away from the keeper is scoreable.
  const over = k - 5;
  return {
    oscRange: 0.46,
    oscSpeed: Math.min(0.0085 + over * 0.0003, 0.0098),
    dive: Math.min(0.3 + over * 0.003, 0.33),
    diveVert: Math.min(0.5 + over * 0.006, 0.6),
    reachX: Math.min(0.23 + over * 0.001, 0.25),
    reachY: Math.min(0.56 + over * 0.004, 0.6),
    guardY: 0.56,
  };
}

// Sharpening factor for the keeper glide: a tanh curve pushes the sine toward
// its extremes, so the keeper dwells at the posts and snaps across the middle
// ("goes to corners often") instead of loitering in the centre.
const OSC_SHARPEN = 1.5;
const OSC_SHARPEN_NORM = Math.tanh(OSC_SHARPEN);

/**
 * Visible keeper position along the goal at a given elapsed time. A fast
 * left-right patrol the player can read and shoot away from, biased toward the
 * posts. Returns a normalised x in [0.5 - oscRange, 0.5 + oscRange].
 */
export function keeperOscX(elapsedMs, difficulty) {
  const s = Math.sin(elapsedMs * difficulty.oscSpeed);
  const shaped = Math.tanh(OSC_SHARPEN * s) / OSC_SHARPEN_NORM;
  return 0.5 + difficulty.oscRange * shaped;
}

/**
 * Whether the shot is saved. The keeper lunges from its position at the moment
 * of the shot toward the ball in both axes: horizontally from `keeperX`
 * (limited by `dive`) and vertically from `guardY` (limited by `diveVert`),
 * then saves if the ball lands inside its reach box around that lunge point.
 * Shooting far enough sideways from the keeper, or higher than it can stretch,
 * beats it.
 */
export function isSaved(aim, keeperX, difficulty) {
  const lungeX = clampDive(aim.x - keeperX, difficulty.dive);
  const lungeY = clampDive(aim.y - difficulty.guardY, difficulty.diveVert);
  const effectiveX = keeperX + lungeX;
  const effectiveY = difficulty.guardY + lungeY;
  return (
    Math.abs(aim.x - effectiveX) <= difficulty.reachX &&
    Math.abs(aim.y - effectiveY) <= difficulty.reachY
  );
}

function clampDive(delta, limit) {
  return Math.max(-limit, Math.min(limit, delta));
}

/**
 * Convert a raw drag vector (in canvas pixels, from the ball toward the
 * goal) into a normalised aim point + a 0..1 power value. Longer / faster
 * drags add power but a high-power shot wobbles, so accuracy is the
 * caller's concern via `applyPowerWobble`.
 */
export function dragToAim(dragX, dragY, maxDrag = 220) {
  // Horizontal: map [-maxDrag, +maxDrag] → [0, 1].
  const x = clamp01(0.5 + dragX / (maxDrag * 2));
  // Vertical: only upward drags aim at the goal. More up = higher (smaller y).
  const up = Math.max(0, -dragY);
  const y = clamp01(0.85 - (up / maxDrag) * 0.8);
  const power = clamp01(Math.hypot(dragX, dragY) / maxDrag);
  return { x, y, power };
}

/**
 * High-power shots trade accuracy: add a small random wobble proportional
 * to how far power exceeds the "clean" threshold. Keeps the risk/reward of
 * smashing it vs placing it.
 */
export function applyPowerWobble(aim, power, rng = Math.random) {
  const over = Math.max(0, power - 0.7); // clean up to 70% power
  const wobble = over * 0.18;
  return {
    x: clamp01(aim.x + (rng() - 0.5) * 2 * wobble),
    y: clamp01(aim.y + (rng() - 0.5) * 2 * wobble),
    power,
  };
}

/**
 * Reward tiers shown on game over, mirroring Boba Catcher's staff-show
 * pattern but scaled to penalty-streak scores.
 */
export function getReward(goals) {
  if (goals >= 12) {
    return { tier: 'PENALTY KING', msg: 'Tumi to legend! Show this at the counter for a FREE topping upgrade!' };
  }
  if (goals >= 7) {
    return { tier: 'SPOT-KICK STAR', msg: 'Daarun khela! Show this for 10% off your next drink!' };
  }
  if (goals >= 3) {
    return { tier: 'STRIKER', msg: 'Bhalo khelecho! Show this for a surprise treat!' };
  }
  return { tier: 'ROOKIE', msg: 'Aar ekbar try koro! Every player gets a smile from us!' };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
