// Ranking rules for the all-time football board.
//
// Pure functions, no Firestore: build-hall-of-fame.mjs supplies the rows and
// src/hallOfFame.test.js exercises the edge cases. Kept out of src/ because the
// app never runs this — the season is closed, so the table is computed once at
// build time and shipped as a static module.

// Highest score honest play reaches. Mirrors HONEST_MAX_STREAK in
// src/penaltyLogic.js and scoreCeiling() in firestore.rules; all three must
// move together. Anything above it was not earned:  a player once read the old
// ceiling of 40 out of the JS bundle and submitted exactly that.
export const HONEST_MAX_STREAK = 19;

/**
 * Whether a leaderboard row is an honest, well-formed football score.
 *
 * Rows above the ceiling are dropped rather than clamped. Clamping would let a
 * forged 40 sit in the table as a legitimate-looking 19 and outrank players who
 * actually earned it.
 */
export function isHonestFootballRow(row) {
  if (!row || row.game !== 'football') return false;
  if (!Number.isInteger(row.score)) return false;
  if (row.score < 0 || row.score > HONEST_MAX_STREAK) return false;
  return typeof row.name === 'string' && row.name.trim().length > 0;
}

/**
 * Identity key for a row.
 *
 * Prefers the per-device playerId, which survives a player changing the phone
 * number they type in. Only 502 of 906 rows carry one — the rest predate the
 * field — so the fallback is the case-folded name.
 *
 * The fallback is deliberately NOT applied to rows that do have a playerId:
 * merging those by name too would fold two genuinely different customers who
 * share a first name into one, silently crediting one with the other's goals.
 * An extra row is a cosmetic problem; a stolen total is not.
 */
export function playerKey(row) {
  if (row.playerId) return `id:${row.playerId}`;
  return `name:${row.name.trim().toLowerCase()}`;
}

/** Display name capped so an over-long submission cannot break the layout. */
function displayName(name, maxLen = 40) {
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

/**
 * Collapse rows into one record per player.
 *
 * Returns an array of { name, team, goals, games, best }, where `team` is the
 * nation the player picked most often and `name` is the spelling they used on
 * their best single run — the run they are most likely to be remembered for.
 */
export function aggregatePlayers(rows) {
  const players = new Map();

  for (const row of rows) {
    if (!isHonestFootballRow(row)) continue;

    const key = playerKey(row);
    const player = players.get(key) ?? { name: row.name, goals: 0, games: 0, best: -1, teams: new Map() };

    player.goals += row.score;
    player.games += 1;
    if (row.score > player.best) {
      player.best = row.score;
      player.name = row.name;
    }
    if (row.team) player.teams.set(row.team, (player.teams.get(row.team) ?? 0) + 1);

    players.set(key, player);
  }

  return [...players.values()].map((p) => ({
    name: displayName(p.name),
    team: mostPlayedTeam(p.teams),
    goals: p.goals,
    games: p.games,
    best: p.best,
  }));
}

/**
 * The nation a player picked most often.
 *
 * Ties break on team code so the generated table is byte-identical between
 * runs — otherwise Map insertion order would let an unrelated re-run produce a
 * spurious diff.
 */
function mostPlayedTeam(teams) {
  let bestTeam = null;
  let bestCount = 0;
  for (const [team, count] of teams) {
    if (count > bestCount || (count === bestCount && bestTeam !== null && team < bestTeam)) {
      bestTeam = team;
      bestCount = count;
    }
  }
  return bestTeam;
}

// Every comparator ends on name so equal players sort identically on every run.
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Career goals, highest first. Ties break on best run, then games, then name. */
export function rankByCareerGoals(players, limit = 10) {
  return [...players]
    .sort((a, b) => b.goals - a.goals || b.best - a.best || a.games - b.games || byName(a, b))
    .slice(0, limit);
}

/**
 * Longest single streak, highest first.
 *
 * Ties break on career goals: eight players finished on 18, and among equals
 * the one who did it more often has the better claim.
 */
export function rankByBestRun(players, limit = 10) {
  return [...players]
    .sort((a, b) => b.best - a.best || b.goals - a.goals || a.games - b.games || byName(a, b))
    .slice(0, limit);
}

/** Headline totals for the season strip. */
export function summarise(rows) {
  const honest = rows.filter(isHonestFootballRow);
  const football = rows.filter((r) => r && r.game === 'football');
  const weeks = [...new Set(honest.map((r) => r.week).filter(Boolean))].sort();

  return {
    players: new Set(honest.map(playerKey)).size,
    games: honest.length,
    goals: honest.reduce((sum, r) => sum + r.score, 0),
    rejected: football.length - honest.length,
    weeks: weeks.length,
    firstWeek: weeks[0] ?? null,
    lastWeek: weeks[weeks.length - 1] ?? null,
    ceiling: HONEST_MAX_STREAK,
  };
}
