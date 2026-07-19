// One-off migration: move phone numbers out of the public leaderboard.
//
// WHY
//   `leaderboard` is world-readable — every visitor's browser downloads it to
//   draw the board — and historically each row carried the player's phone
//   number. This script copies each number into the private `contacts`
//   collection and then strips the field from the public row.
//
// SAFETY
//   Dry run by default: it prints what it would do and writes nothing. Pass
//   --apply to commit. Contacts are written BEFORE the public field is
//   stripped, so an interrupted run can only ever leave data duplicated, never
//   lost. Each contact uses its source leaderboard document's ID as its own, so
//   re-running overwrites rather than piling up duplicates.
//
//   Leaderboard rows are never deleted. Only the `phone` field is removed.
//
// USAGE
//   npm i --no-save firebase-admin
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json
//   node scripts/migrate-leaderboard-pii.mjs            # dry run
//   node scripts/migrate-leaderboard-pii.mjs --apply    # commit
//
//   The service account key is a full-access credential. Keep it outside the
//   repo, and delete it once the migration is done.
//
//   This runs through the Admin SDK, which bypasses firestore.rules by design —
//   that is the only way to edit existing rows, since the rules deliberately
//   forbid client updates.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
// Firestore caps a batch at 500 operations. Each row costs one contact write
// plus one field strip, so 200 rows per batch stays comfortably inside it.
const ROWS_PER_BATCH = 200;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See the usage notes at the top of this file.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const snapshot = await db.collection('leaderboard').get();
const withPhone = snapshot.docs.filter((d) => d.get('phone') !== undefined);

console.log(`leaderboard rows scanned : ${snapshot.size}`);
console.log(`rows carrying a phone    : ${withPhone.length}`);
console.log(`mode                     : ${APPLY ? 'APPLY (writes committed)' : 'DRY RUN (nothing written)'}`);

if (withPhone.length === 0) {
  console.log('\nNothing to migrate.');
  process.exit(0);
}

if (!APPLY) {
  const preview = withPhone.slice(0, 5).map((d) => {
    const phone = String(d.get('phone') ?? '');
    // Never print a full number to a terminal or CI log.
    const masked = phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : '****';
    return `  ${d.id}  ${d.get('week')}  ${d.get('game') ?? '(no game)'}  phone=${masked}`;
  });
  console.log(`\nFirst ${preview.length} of ${withPhone.length} rows that would move:`);
  console.log(preview.join('\n'));
  console.log('\nRe-run with --apply to commit.');
  process.exit(0);
}

let migrated = 0;
for (let i = 0; i < withPhone.length; i += ROWS_PER_BATCH) {
  const chunk = withPhone.slice(i, i + ROWS_PER_BATCH);
  const batch = db.batch();

  for (const row of chunk) {
    const contact = {
      name: row.get('name') ?? '',
      phone: row.get('phone'),
      week: row.get('week') ?? '',
      createdAt: row.get('createdAt') ?? FieldValue.serverTimestamp(),
    };
    const playerId = row.get('playerId');
    if (playerId) contact.playerId = playerId;

    // Same ID as the source row, so a repeated run overwrites in place.
    batch.set(db.collection('contacts').doc(row.id), contact);
    batch.update(row.ref, { phone: FieldValue.delete() });
  }

  await batch.commit();
  migrated += chunk.length;
  console.log(`committed ${migrated}/${withPhone.length}`);
}

console.log(`\nDone. ${migrated} rows moved to contacts and stripped from the public leaderboard.`);
console.log('Verify with: leaderboard rows should now return undefined for .phone');
