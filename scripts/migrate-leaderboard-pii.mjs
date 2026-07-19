// One-off migration: move phone numbers out of the public leaderboard.
//
// WHY
//   `leaderboard` is world-readable — every visitor's browser downloads it to
//   draw the board — and historically each row carried the player's phone
//   number. This copies each number into the private `contacts` collection and
//   then strips the field from the public row.
//
// CREDENTIALS
//   Uses whichever of these it finds, in order:
//
//     1. GOOGLE_APPLICATION_CREDENTIALS — path to a service-account JSON.
//     2. The credential `firebase login` already stored. Preferred, because it
//        creates no new long-lived secret: it is scoped to one person, and
//        `firebase logout` revokes it.
//
//   Either way this calls the Firestore REST API with an OAuth token, which
//   bypasses firestore.rules by design. That is the only way to edit existing
//   rows at all — the rules deliberately forbid client updates, which is what
//   stops a player rewriting their own score.
//
//   The token is never printed, never written to disk, and never leaves the
//   process.
//
// SAFETY
//   Dry run by default: prints what it would do and writes nothing. Pass
//   --apply to commit. Each contact is written with its source row's document
//   ID, so a repeat run overwrites rather than duplicating, and the original
//   createdAt is carried over rather than reset to now.
//
//   Both writes for a row go in one commit, so a row can never end up stripped
//   without its contact having been saved. Leaderboard rows are never deleted;
//   only the `phone` field is removed.
//
// USAGE
//   npx firebase-tools login                            # once
//   node scripts/migrate-leaderboard-pii.mjs            # dry run
//   node scripts/migrate-leaderboard-pii.mjs --apply    # commit

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'blendnbubbles-b166b';
const APPLY = process.argv.includes('--apply');
// Firestore caps a commit at 500 writes. Each row costs one contact write plus
// one field strip, so 200 rows per batch stays comfortably inside it.
const ROWS_PER_BATCH = 200;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Mask a phone so no terminal or CI log ever carries the full number. */
function mask(phone) {
  const s = String(phone ?? '');
  return s.length > 4 ? `${'*'.repeat(s.length - 4)}${s.slice(-4)}` : '****';
}

/** An OAuth access token with Firestore write scope. Callers must not log it. */
async function getAccessToken() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath) {
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        keyFile: saPath,
        scopes: ['https://www.googleapis.com/auth/datastore'],
      });
      return await auth.getAccessToken();
    } catch {
      throw new Error(
        'GOOGLE_APPLICATION_CREDENTIALS is set but google-auth-library is missing.\n' +
          'Run `npm i --no-save google-auth-library`, or unset the variable and\n' +
          'use `npx firebase-tools login` instead.',
      );
    }
  }

  const cfg = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  if (!fs.existsSync(cfg)) {
    throw new Error('Not authenticated. Run `npx firebase-tools login` first.');
  }
  const tokens = JSON.parse(fs.readFileSync(cfg, 'utf8')).tokens ?? {};
  if (!tokens.access_token) {
    throw new Error('No access token found. Run `npx firebase-tools login` again.');
  }
  if (tokens.expires_at && tokens.expires_at < Date.now()) {
    throw new Error(
      'The stored access token has expired.\n' +
        'Run `npx firebase-tools login --reauth` and retry — this migration is\n' +
        'idempotent, so re-running after a partial pass is safe.',
    );
  }
  return tokens.access_token;
}

async function api(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    // Surface the status and body, never the request headers.
    throw new Error(`Firestore API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

/** Every leaderboard document, following pagination to the end. */
async function fetchAllRows(token) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${BASE}/leaderboard?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const page = await api(url, token);
    docs.push(...(page.documents ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

const main = async () => {
  const token = await getAccessToken();
  const rows = await fetchAllRows(token);
  const withPhone = rows.filter((d) => d.fields?.phone !== undefined);

  console.log(`project                  : ${PROJECT}`);
  console.log(`leaderboard rows scanned : ${rows.length}`);
  console.log(`rows carrying a phone    : ${withPhone.length}`);
  console.log(`mode                     : ${APPLY ? 'APPLY (writes committed)' : 'DRY RUN (nothing written)'}`);

  if (withPhone.length === 0) {
    console.log('\nNothing to migrate.');
    return;
  }

  if (!APPLY) {
    const preview = withPhone.slice(0, 5).map((d) => {
      const id = d.name.split('/').pop();
      const f = d.fields;
      return `  ${id}  ${f.week?.stringValue ?? '?'}  ${f.game?.stringValue ?? '(no game)'}  phone=${mask(f.phone?.stringValue)}`;
    });
    console.log(`\nFirst ${preview.length} of ${withPhone.length} rows that would move:`);
    console.log(preview.join('\n'));
    console.log('\nRe-run with --apply to commit.');
    return;
  }

  let migrated = 0;
  for (let i = 0; i < withPhone.length; i += ROWS_PER_BATCH) {
    const chunk = withPhone.slice(i, i + ROWS_PER_BATCH);
    const writes = [];

    for (const row of chunk) {
      const id = row.name.split('/').pop();
      const f = row.fields;

      // The contact keeps its source row's ID so the two can be joined, and the
      // original createdAt rather than today's date.
      const contact = {
        name: f.name ?? { stringValue: '' },
        phone: f.phone,
        week: f.week ?? { stringValue: '' },
        createdAt: f.createdAt ?? { timestampValue: new Date().toISOString() },
      };
      if (f.playerId) contact.playerId = f.playerId;

      writes.push({
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/contacts/${id}`,
          fields: contact,
        },
      });
      // Field-level delete: name the field in the mask, omit it from fields.
      writes.push({
        update: { name: row.name, fields: {} },
        updateMask: { fieldPaths: ['phone'] },
      });
    }

    await api(`${BASE}:commit`, token, { method: 'POST', body: JSON.stringify({ writes }) });
    migrated += chunk.length;
    console.log(`committed ${migrated}/${withPhone.length}`);
  }

  console.log(`\nDone. ${migrated} rows moved to contacts and stripped from the public leaderboard.`);
  console.log('Verify with an unauthenticated read of /leaderboard — no phone field should appear.');
};

main().catch((err) => {
  console.error(`\nMigration failed: ${err.message}`);
  console.error('Each batch commits atomically and the migration is idempotent,');
  console.error('so there is no partial state to clean up — just re-run.');
  process.exit(1);
});
