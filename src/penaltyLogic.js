// ─── Penalty Shootout: pure game logic ──────────────────────
// Kept free of canvas / DOM so it can be unit-tested. The component
// (PenaltyShootout.js) imports these helpers and only owns rendering,
// animation and input.
//
// Coordinate space: the goal mouth is normalised to 0..1 on both axes.
//   x: 0 = left post, 1 = right post
//   y: 0 = crossbar (top), 1 = ground line (bottom)
// The keeper starts centred at roughly { x: 0.5, y: 0.62 } and dives
// toward a guessed point. A shot is saved when it lands inside the
// keeper's reach box around that guessed point.

// Bengali / Hindi goal exclamations, matching Boba Catcher's flavour.
export const GOAL_WORDS = [
  'Daarun goal!',
  'Gooooal!',
  'Top bins, bhai!',
  'Jhakkas shot!',
  'Khelechho!',
  'Asadharon!',
  'Back of the net!',
];

export const SAVE_WORDS = [
  'Keeper read it!',
  'Saved!',
  'Denied!',
  'So close!',
];

// Six aim targets the reticle can snap to: 3 across × 2 high. Corners are
// the safe picks (keeper struggles to reach), centre is risky.
export const AIM_ZONES = [
  { id: 'TL', x: 0.16, y: 0.22, label: 'Top left' },
  { id: 'TC', x: 0.5, y: 0.18, label: 'Top centre' },
  { id: 'TR', x: 0.84, y: 0.22, label: 'Top right' },
  { id: 'BL', x: 0.16, y: 0.7, label: 'Bottom left' },
  { id: 'BC', x: 0.5, y: 0.72, label: 'Bottom centre' },
  { id: 'BR', x: 0.84, y: 0.7, label: 'Bottom right' },
];

/**
 * Keeper difficulty grows with the current streak but is capped so a
 * well-placed corner is always scoreable. Returns the reach half-box and
 * the chance the keeper "reads" the shooter's side.
 */
export function getKeeperDifficulty(streak) {
  const s = Math.max(0, streak);
  return {
    // How far the keeper covers around its guessed point (half-width / half-height).
    // Tuned harder again: higher base reach and caps so placed shots are saved
    // more often. The horizontal cap (0.44) still stays below the distance from
    // one post-zone to the other, so the far corner is always reachable.
    reachX: Math.min(0.2 + s * 0.024, 0.44),
    reachY: Math.min(0.31 + s * 0.024, 0.56),
    // Probability the keeper reads the shooter's placement rather than
    // committing to a random zone. The opening kicks stay roughly fair
    // (base 0.32) but it ramps steeply and caps high, so building a long streak
    // gets brutal. Stays below 1 so there is always a ~10% "keeper guessed
    // wrong" escape; runs stay finite.
    readChance: Math.min(0.32 + s * 0.09, 0.9),
    // Keeper dive speed multiplier (cosmetic; surfaced for the renderer).
    diveSpeed: Math.min(1.2 + s * 0.07, 2.6),
  };
}

/**
 * Decide where the keeper dives. With probability `readChance` it lunges
 * near the shooter's aim (with jitter so reads are not perfect); otherwise
 * it commits to a random zone. `rng` is injectable for deterministic tests.
 */
export function pickKeeperGuess(aim, streak, rng = Math.random) {
  const { readChance } = getKeeperDifficulty(streak);
  if (rng() < readChance) {
    // A read dive now tracks BOTH axes (v1 only read the side and always
    // sat mid-low, so top corners were untouchable). Tighter horizontal
    // error + real vertical tracking means a well-read shot can be saved.
    const jitterX = (rng() - 0.5) * 0.16; // ±0.08 horizontal read error
    const jitterY = (rng() - 0.5) * 0.3; // ±0.15 vertical read error
    return {
      x: clamp01(aim.x + jitterX),
      y: clamp01(aim.y + jitterY),
      read: true,
    };
  }
  const zone = AIM_ZONES[Math.floor(rng() * AIM_ZONES.length)];
  return { x: zone.x, y: zone.y, read: false };
}

/**
 * A shot is saved when the landing point falls inside the keeper's reach
 * box around its dive point.
 */
export function isSaved(aim, keeper, difficulty) {
  return (
    Math.abs(aim.x - keeper.x) <= difficulty.reachX &&
    Math.abs(aim.y - keeper.y) <= difficulty.reachY
  );
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
