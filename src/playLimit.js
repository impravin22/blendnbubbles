// Daily play limit for the penalty game: each device gets DAILY_LIMIT games
// per local calendar day, tracked in localStorage. This is queue-game-grade
// enforcement (clearing storage resets it); the prize itself is still
// verified at the counter via the dated claim card.

export const DAILY_LIMIT = 3;
const STORAGE_KEY = 'penaltyPlays';

function dayKey(now) {
  const d = now ? new Date(now) : new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function readRecord(storage, now) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { date: dayKey(now), count: 0 };
    const parsed = JSON.parse(raw);
    if (parsed.date !== dayKey(now) || !Number.isInteger(parsed.count) || parsed.count < 0) {
      return { date: dayKey(now), count: 0 };
    }
    return parsed;
  } catch {
    // Unreadable storage (privacy mode, corrupt JSON): fail open so the game
    // still works; the counter just is not enforced on this device.
    return { date: dayKey(now), count: 0 };
  }
}

/** Games still available today on this device (0..DAILY_LIMIT). */
export function triesLeft(storage = window.localStorage, now = undefined) {
  return Math.max(0, DAILY_LIMIT - readRecord(storage, now).count);
}

/**
 * Record the start of a game. Returns the tries left AFTER this play.
 * Storage failures fail open (play allowed, nothing recorded).
 */
export function recordPlay(storage = window.localStorage, now = undefined) {
  const rec = readRecord(storage, now);
  const next = { date: dayKey(now), count: rec.count + 1 };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full / blocked: allow the play, skip the bookkeeping.
  }
  return Math.max(0, DAILY_LIMIT - next.count);
}
