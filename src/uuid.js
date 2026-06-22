// Shared v4-style UUID generator. Used for the anniversary spin claim ticket
// (SpinWheel.js) and the per-device player tracking ID (playerId.js), so the
// generation logic lives in exactly one place.

/**
 * Generate a v4-style UUID. Uses crypto.randomUUID() when available (all modern
 * browsers since 2022) and falls back to a Math.random() build for very old
 * browsers. Not cryptographically strong on the fallback path: fine for claim
 * tickets and analytics handles, never for credentials or session tokens.
 *
 * @returns {string} a v4-style UUID
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback v4-ish: not cryptographically strong, but fine for a claim/track ID.
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[(Math.random() * 4) | 8];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}
