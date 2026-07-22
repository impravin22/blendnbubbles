// Regenerates src/hallOfFameData.js from the live leaderboard.
//
//   node scripts/build-hall-of-fame.mjs
//
// Run by hand, not by the build. The football season closed in July 2026, so
// the table is frozen: baking it means a visitor's browser reads zero Firestore
// documents to draw the board instead of the ~900 a live query would cost, and
// the page renders with no loading state because there is nothing to wait for.
//
// Re-run this only if the season reopens or a row is removed from Firestore.
// The output is deterministic — same rows in, byte-identical file out — so an
// unnecessary run produces an empty diff rather than churn.
//
// Reads only the world-readable `leaderboard` collection. It never touches
// `contacts`, which holds the phone numbers and is read-denied to clients.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { aggregatePlayers, rankByBestRun, rankByCareerGoals, summarise } from './hallOfFame.mjs';

// Same public web config the site ships in src/firebase.js. A Firebase web
// config is an identifier, not a credential — access is decided by
// firestore.rules — so it is not a secret and is not read from the environment.
const firebaseConfig = {
  apiKey: 'AIzaSyBTuYMNsRT665qMD3wwb3UabTfjf6sIm4Q',
  authDomain: 'blendnbubbles-b166b.firebaseapp.com',
  projectId: 'blendnbubbles-b166b',
  storageBucket: 'blendnbubbles-b166b.firebasestorage.app',
  messagingSenderId: '1002005993561',
  appId: '1:1002005993561:web:e10f6c899e85750a35f948',
};

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hallOfFameData.js');

// The date the season closed, not the date this script ran: a re-run must not
// produce a diff, and "generated at 09:14" would.
const SEASON_CLOSED = '2026-07-22';

const serialise = (value) => JSON.stringify(value, null, 2);

// Every string that reaches the generated file must be escaped, and the only
// escaping sink is serialise(). Interpolating a leaderboard value straight into
// the source — even into a `//` comment — is a code-execution hole: `week` is
// written by an unauthenticated public client and firestore.rules bounds its
// length but not its characters, so a newline in it ends the comment and puts
// whatever follows into a module that src/App.js imports on every page load.
// Week keys are therefore reduced to the shape getWeekKey() actually emits, and
// anything else is refused rather than escaped, so a malformed key fails the
// build loudly instead of shipping.
const WEEK_KEY = /^\d{4}-W\d{2}$/;

function assertWeekKey(value, label) {
  if (typeof value !== 'string' || !WEEK_KEY.test(value)) {
    throw new Error(
      `Refusing to generate: ${label} is ${JSON.stringify(value)}, which is not a YYYY-Www week key.`,
    );
  }
  return value;
}

function render({ season, goldenBoot, bestRun }) {
  const firstWeek = assertWeekKey(season.firstWeek, 'firstWeek');
  const lastWeek = assertWeekKey(season.lastWeek, 'lastWeek');

  return `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/build-hall-of-fame.mjs
//
// The all-time football board, frozen at the close of the ${Number(season.weeks)}-week season
// (${firstWeek} to ${lastWeek}). Baked rather than queried so the page costs
// no Firestore reads; see scripts/build-hall-of-fame.mjs for why.

export const SEASON = ${serialise({ ...season, closedOn: SEASON_CLOSED })};

// Career goals: every goal a player scored, across every game they played.
export const GOLDEN_BOOT = ${serialise(goldenBoot)};

// Longest unbroken streak in a single game.
export const BEST_RUN = ${serialise(bestRun)};
`;
}

async function main() {
  const db = getFirestore(initializeApp(firebaseConfig));
  const snapshot = await getDocs(collection(db, 'leaderboard'));
  const rows = snapshot.docs.map((doc) => doc.data());

  const season = summarise(rows);
  if (season.games === 0) {
    throw new Error('No football rows found; refusing to overwrite the table with an empty one.');
  }

  const players = aggregatePlayers(rows);
  const goldenBoot = rankByCareerGoals(players);
  const bestRun = rankByBestRun(players);

  writeFileSync(OUT_PATH, render({ season, goldenBoot, bestRun }), 'utf8');

  console.log(`Wrote ${OUT_PATH}`);
  console.log(
    `${season.games} games · ${season.goals} goals · ${season.players} players · ` +
      `${season.weeks} weeks · ${season.rejected} rejected above the ceiling of ${season.ceiling}`,
  );
  console.log(`Golden Boot leader: ${goldenBoot[0].name} (${goldenBoot[0].goals})`);
  console.log(`Best run: ${bestRun[0].name} (${bestRun[0].best})`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
