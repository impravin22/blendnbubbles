import { google } from 'googleapis';

const MAX_MESSAGES_PER_QUERY = 50;

export function createGmailClient({ clientId, clientSecret, refreshToken }) {
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

export async function searchMessages(gmail, query) {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: MAX_MESSAGES_PER_QUERY,
  });
  return res.data.messages ?? [];
}

export async function fetchMessage(gmail, messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return res.data;
}

export async function fetchAttachmentBytes(gmail, messageId, attachmentId) {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  if (!res.data?.data) {
    throw new Error(`Attachment ${attachmentId} returned no inline data`);
  }
  return Buffer.from(res.data.data, 'base64url');
}

export function isInvalidGrantError(err) {
  const payload = err?.response?.data;
  return payload?.error === 'invalid_grant';
}
