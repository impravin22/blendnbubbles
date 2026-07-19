/**
 * BnB Anniversary Spin Wheel — webhook receiver.
 *
 * Append one row per spin to the bound spreadsheet. The web client POSTs
 * JSON as text/plain to avoid a CORS preflight.
 */
const SHEET_ID = '1dN_nYA7s5fzsBWNfvEuHupm5Hz83bIHJpEriSx-4RJA';
const HEADERS = [
  'ReceivedAt',
  'Ticket',
  'PrizeIndex',
  'PrizeLabel',
  'PrizeTitle',
  'SpunAt',
  'UserAgent',
  'PageHref',
  'FpHash',
];
const FP_HASH_COL = HEADERS.indexOf('FpHash') + 1;
const TICKET_COL = HEADERS.indexOf('Ticket') + 1;
const PRIZE_INDEX_COL = HEADERS.indexOf('PrizeIndex') + 1;
const PRIZE_LABEL_COL = HEADERS.indexOf('PrizeLabel') + 1;
const PRIZE_TITLE_COL = HEADERS.indexOf('PrizeTitle') + 1;
const SPUN_AT_COL = HEADERS.indexOf('SpunAt') + 1;

function doPost(e) {
  // The web client uses doGet (Workspace blocks anonymous POST). This stays
  // as a fallback for any future curl tests or future workspace policy change.
  return handleSpin(e && e.postData ? safeJson(e.postData.contents) : {});
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  // Liveness probe — no params.
  if (!params.ticket && !params.payload && !params.check) {
    return ContentService
      .createTextOutput('BnB Anniversary Spins webhook is live.')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  // Pre-spin check: did this fingerprint already win something?
  if (params.check) {
    const prior = lookupByFpHash(params.fpHash || '');
    return jsonResponse(prior
      ? Object.assign({ alreadySpun: true }, prior)
      : { alreadySpun: false });
  }
  // Log a spin attempt.
  let body = params.payload ? safeJson(params.payload) : {};
  ['ticket', 'prizeIndex', 'prizeLabel', 'prizeTitle', 'spunAt', 'userAgent', 'pageHref', 'fpHash'].forEach(function (k) {
    if (params[k] !== undefined && params[k] !== '') body[k] = params[k];
  });
  if (typeof body.prizeIndex === 'string' && body.prizeIndex !== '') {
    body.prizeIndex = Number(body.prizeIndex);
  }
  return handleSpin(body);
}

function handleSpin(body) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  ensureHeaders(sheet);
  // Server-side dedupe: if this fingerprint already won, return the prior prize.
  if (body.fpHash) {
    const prior = lookupByFpHash(body.fpHash, sheet);
    if (prior) {
      return jsonResponse(Object.assign({ ok: true, alreadySpun: true }, prior));
    }
  }
  sheet.appendRow([
    new Date(),
    body.ticket || '',
    typeof body.prizeIndex === 'number' ? body.prizeIndex : '',
    body.prizeLabel || '',
    body.prizeTitle || '',
    body.spunAt || '',
    body.userAgent || '',
    body.pageHref || '',
    body.fpHash || '',
  ]);
  return jsonResponse({ ok: true, alreadySpun: false, ticket: body.ticket || '' });
}

function lookupByFpHash(fpHash, providedSheet) {
  if (!fpHash) return null;
  const sheet = providedSheet || SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  ensureHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  // Pull the FpHash column for all data rows.
  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
  const values = range.getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (values[i][FP_HASH_COL - 1] === fpHash) {
      return {
        ticket: values[i][TICKET_COL - 1] || '',
        prizeIndex: Number(values[i][PRIZE_INDEX_COL - 1]),
        prizeLabel: values[i][PRIZE_LABEL_COL - 1] || '',
        prizeTitle: values[i][PRIZE_TITLE_COL - 1] || '',
        spunAt: values[i][SPUN_AT_COL - 1] || '',
      };
    }
  }
  return null;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }
  // Backfill the FpHash header if the sheet was created before this column existed.
  const firstRow = sheet.getRange(1, 1, 1, Math.max(HEADERS.length, sheet.getLastColumn())).getValues()[0];
  if (firstRow[FP_HASH_COL - 1] !== 'FpHash') {
    sheet.getRange(1, FP_HASH_COL).setValue('FpHash');
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeJson(str) {
  try { return JSON.parse(str || '{}'); } catch (err) { return {}; }
}

/**
 * Run this once from the editor to grant the SpreadsheetApp scope so the
 * deployed web app can append rows. After the first run + authorisation,
 * doPost will work for everyone.
 */
function authorize() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  Logger.log('Authorised. Sheet rows so far: %s', sheet.getLastRow());
}
