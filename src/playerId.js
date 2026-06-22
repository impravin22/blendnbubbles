// Stable per-device player ID for the penalty game. A UUID is minted once and
// kept in localStorage so a player can be tracked across submissions even when
// they type a different phone number each time. Like playLimit.js this is
// best-effort: clearing storage or a private window yields a fresh ID, so it
// counts browsers, not people.

import { generateUUID } from './uuid';

const STORAGE_KEY = 'bnbPlayerId';

// A well-formed v4 UUID. Stored values are validated against this before being
// trusted, so a corrupt or hand-edited localStorage entry cannot leak a junk
// value into the leaderboard analytics; anything that fails is replaced.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The device's stable player ID, creating and persisting one on first use.
 * A stored value is only reused when it is a well-formed UUID; anything else
 * (corrupt, tampered, empty) is replaced. Storage failures fail open: a fresh
 * ID is returned but not saved, so the game still works (tracking just is not
 * stable on that device).
 *
 * @param {Storage} [storage=window.localStorage] storage backend (injected in tests)
 * @returns {string} the player UUID
 */
export function getPlayerId(storage = window.localStorage) {
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
  } catch {
    // Unreadable storage (private mode, blocked): mint an ephemeral ID.
    return generateUUID();
  }
  const fresh = generateUUID();
  try {
    storage.setItem(STORAGE_KEY, fresh);
  } catch {
    // Storage full / blocked: return the ID anyway, just unpersisted.
  }
  return fresh;
}
