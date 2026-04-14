#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET before running:\n' +
        '  GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... npm run auth',
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n1) Open this URL in your browser and sign in with blendnbubbles@gmail.com:');
  console.log(authUrl);
  console.log('\n2) After approval, Google will show a code. Paste it below.\n');

  const rl = readline.createInterface({ input, output });
  const code = (await rl.question('Auth code: ')).trim();
  rl.close();

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      'No refresh_token returned. This usually means the Google account has already ' +
        'authorised this client. Revoke access at https://myaccount.google.com/permissions ' +
        'and run this again.',
    );
    process.exit(1);
  }

  console.log('\n✓ Refresh token (add to your .env and to GitHub secrets as GMAIL_REFRESH_TOKEN):');
  console.log(tokens.refresh_token);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
