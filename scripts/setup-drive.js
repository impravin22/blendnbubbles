const fs = require('fs');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'client_secret_716675454725-4j4qclcvjd13676ll16849u3vmk734da.apps.googleusercontent.com.json';

const args = process.argv.slice(2);
const authCode = args[0];

fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob');

  if (authCode) {
    oAuth2Client.getToken(authCode, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      console.log('Successfully authenticated with Google Drive!');
    });
  } else {
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) {
        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
        console.log('\n--- GOOGLE DRIVE SETUP ---');
        console.log('Authorize this app by visiting this url:\n\n' + authUrl);
        console.log('\nThen provide me with the authorization code!');
      } else {
        console.log('Token already exists at', TOKEN_PATH, '- successfully authenticated!');
      }
    });
  }
});
