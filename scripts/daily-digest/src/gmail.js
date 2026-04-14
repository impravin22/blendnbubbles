import { google } from 'googleapis';

export function createGmailClient({ clientId, clientSecret, refreshToken }) {
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

export async function searchMessages(gmail, { query, maxResults = 50 }) {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
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

export async function fetchAttachmentBytes(gmail, { messageId, attachmentId }) {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  const b64 = res.data.data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

export function buildLookbackQuery({ senders, subjects, lookbackHours }) {
  const fromClause = senders.map((s) => `from:(${s})`).join(' OR ');
  const subjectClause = subjects.map((s) => `subject:"${s}"`).join(' OR ');
  const hoursInSeconds = lookbackHours * 3600;
  return `(${fromClause}) AND (${subjectClause}) newer_than:${Math.ceil(hoursInSeconds / 86400)}d`;
}
