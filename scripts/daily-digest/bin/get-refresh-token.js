#!/usr/bin/env node
import http from 'node:http';
import crypto from 'node:crypto';
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

  const port = await findFreePort();
  const redirectUri = `http://localhost:${port}`;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });

  console.log('\nOpen this URL in your browser (sign in as blendnbubbles@gmail.com):\n');
  console.log(authUrl);
  console.log('\nWaiting for callback on ' + redirectUri + ' ...\n');

  const code = await waitForAuthCode({ port, expectedState: state });
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      'No refresh_token returned. The Google account has probably authorised this client ' +
        'before. Revoke access at https://myaccount.google.com/permissions and rerun.',
    );
    process.exit(1);
  }

  console.log('\n✓ Refresh token (add as GMAIL_REFRESH_TOKEN in your .env and GitHub secrets):');
  console.log(tokens.refresh_token);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForAuthCode({ port, expectedState }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (error) {
        res.end(`<h1>Authorisation failed</h1><p>${escapeHtml(error)}</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.statusCode = 400;
        res.end('<h1>Invalid callback</h1>');
        server.close();
        reject(new Error('Missing or mismatched state'));
        return;
      }
      res.end('<h1>Authorisation received ✅</h1><p>You can close this tab.</p>');
      server.close();
      resolve(code);
    });
    server.listen(port);
    server.on('error', reject);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

main().catch((err) => {
  console.error(err.stack ?? err.message);
  process.exit(1);
});
