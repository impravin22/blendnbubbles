/**
 * Build the partner sheet extract for the /partners portal.
 *
 * Reads every Google Sheet in the business Drive modified in the last 30 days
 * and writes them to scripts/out/partnerData.json, then prints the command that
 * uploads that file to Cloudflare KV.
 *
 * The extract is NOT written into src/. It carries customer names, phone
 * numbers, and event enquiries; anything under src/ is bundled by webpack and
 * published to a public site. It goes to KV and is served by services/partners
 * behind a bearer token — same arrangement as the sales dataset.
 *
 * Scope note: this collects whatever the authorised account can see, so adding
 * a sheet to that Drive adds it to the portal. That is the intent — the portal
 * is the owner's own view of their own Drive — but it does mean the extract is
 * only ever as private as the Drive account behind it.
 *
 * Usage:
 *   node scripts/fetch-partner-data.js        # after scripts/setup-drive.js
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ROOT = path.join(__dirname, '..');
const TOKEN_PATH = path.join(ROOT, 'token.json');
const OUTPUT_PATH = path.join(ROOT, 'scripts', 'out', 'partnerData.json');
const LOOKBACK_DAYS = 30;

/**
 * Locate the OAuth client-secret file downloaded from Google Cloud Console.
 *
 * Matched by prefix rather than hardcoded: the filename carries the client id,
 * and the previous hardcoded name silently pointed at whichever of the two
 * copies in the repo root happened to be named without a suffix.
 */
function findCredentialsPath() {
  const matches = fs
    .readdirSync(ROOT)
    .filter((name) => name.startsWith('client_secret_') && name.endsWith('.json'))
    .sort();
  if (matches.length === 0) {
    throw new Error(
      'No client_secret_*.json in the repo root. Download the OAuth client from ' +
        'Google Cloud Console, or see scripts/setup-drive.js.',
    );
  }
  if (matches.length > 1) {
    console.warn(`Multiple client secrets found; using ${matches[0]}.`);
  }
  return path.join(ROOT, matches[0]);
}

function authorise() {
  const credentials = JSON.parse(fs.readFileSync(findCredentialsPath(), 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;
  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob',
  );

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('token.json not found. Run `node scripts/setup-drive.js` first.');
  }
  auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));

  // The library refreshes the access token in the background; persist the new
  // one or every run starts from an expired credential.
  auth.on('tokens', (tokens) => {
    const current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    // A refresh response omits refresh_token — merging keeps the original.
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...current, ...tokens }), { mode: 0o600 });
  });

  return auth;
}

async function fetchSheets(auth) {
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceDate = since.toISOString().split('T')[0];

  console.log(`Listing Google Sheets modified since ${sinceDate}…`);
  const query =
    `modifiedTime > '${sinceDate}T00:00:00Z' and ` +
    "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";

  const listed = await drive.files.list({
    q: query,
    fields: 'files(id, name, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
  });

  const files = listed.data.files ?? [];
  const collected = [];

  for (const file of files) {
    console.log(`  reading ${file.name}`);
    try {
      const info = await sheets.spreadsheets.get({ spreadsheetId: file.id });
      const firstTab = info.data.sheets?.[0]?.properties?.title;
      if (!firstTab) {
        console.error(`  skipped ${file.name}: no readable tab`);
        continue;
      }

      const values = await sheets.spreadsheets.values.get({
        spreadsheetId: file.id,
        range: firstTab,
      });

      collected.push({
        id: file.id,
        name: file.name,
        lastUpdated: file.modifiedTime,
        url: file.webViewLink,
        rows: values.data.values ?? [],
      });
    } catch (err) {
      // One unreadable sheet must not lose the rest of the extract.
      console.error(`  skipped ${file.name}: ${err.message}`);
    }
  }

  return collected;
}

async function main() {
  const auth = authorise();
  const sheets = await fetchSheets(auth);
  const extract = { generatedAt: new Date().toISOString(), sheets };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(extract, null, 2), { mode: 0o600 });

  const rows = sheets.reduce((total, sheet) => total + sheet.rows.length, 0);
  console.log();
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} — ${sheets.length} sheet(s), ${rows} row(s).`);
  console.log();
  console.log('This file is gitignored on purpose. Publish it with:');
  console.log('  cd services/partners && npx wrangler kv key put partner-sheets \\');
  console.log('    --path ../../scripts/out/partnerData.json --binding PARTNERS --remote');
  console.log();
  console.log('The --remote flag is required. Without it wrangler writes to a local');
  console.log('store and the live portal silently keeps serving the old extract.');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
