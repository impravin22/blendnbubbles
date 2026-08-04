/**
 * BnB Event Requests — webhook receiver.
 *
 * Receives event-request form submissions from /events, appends one row per
 * request to the bound spreadsheet, then emails the shop inbox. The web
 * client sends GET with query params for the same reason the spins webhook
 * does: this Workspace deployment rejects anonymous POST bodies.
 *
 * Deploy notes live in README.md next to this file.
 */
const SHEET_ID = 'PASTE_EVENTS_SHEET_ID_HERE';
const RECIPIENT = 'blendnbubbles@gmail.com';
const SENDER_NAME = 'BlendNBubbles Website';

const HEADERS = [
  'ReceivedAt',
  'Name',
  'Organisation',
  'Email',
  'Phone',
  'Social',
  'EventType',
  'EventDate',
  'Guests',
  'Message',
  'BrochureUrl',
  'Emailed',
  'UserAgent',
  'PageHref',
];

/** Required fields and the caps applied to every stored/emailed value. */
const REQUIRED = ['name', 'email', 'phone', 'eventType', 'eventDate', 'guests'];
const MAX_LEN = {
  name: 120,
  org: 160,
  email: 200,
  phone: 40,
  social: 80,
  eventType: 60,
  eventDate: 20,
  guests: 20,
  message: 2000,
  brochure: 300,
  userAgent: 300,
  pageHref: 300,
};

function doPost(e) {
  // Fallback only — the web client uses doGet (Workspace blocks anonymous
  // POST). Kept for curl tests and any future workspace policy change.
  return handleRequest(e && e.postData ? safeJson(e.postData.contents) : {});
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  // Liveness probe — no params.
  if (Object.keys(params).length === 0) {
    return ContentService
      .createTextOutput('BnB Event Requests webhook is live.')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  let body = params.payload ? safeJson(params.payload) : {};
  [
    'name', 'org', 'email', 'phone', 'social', 'eventType', 'eventDate',
    'guests', 'message', 'brochure', 'hp', 'userAgent', 'pageHref',
  ].forEach(function (k) {
    if (params[k] !== undefined && params[k] !== '') body[k] = params[k];
  });
  return handleRequest(body);
}

function handleRequest(body) {
  // Honeypot: a filled hidden field means a bot. Answer ok so it moves on,
  // but store nothing and send nothing.
  if (body.hp) {
    return jsonResponse({ ok: true });
  }

  const cleaned = sanitise(body);

  const missing = REQUIRED.filter(function (k) { return !cleaned[k]; });
  if (missing.length > 0) {
    return jsonResponse({ ok: false, error: 'missing-fields', fields: missing });
  }

  // Sheet first, email second: if the mail quota is exhausted the request is
  // still recorded, and the Emailed column says which rows need a manual look.
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  ensureHeaders(sheet);

  let emailed = false;
  let emailError = '';
  if (underMailBudget()) {
    try {
      sendRequestEmail(cleaned);
      emailed = true;
    } catch (err) {
      emailError = String(err && err.message ? err.message : err);
    }
  } else {
    emailError = 'hourly mail budget reached';
  }

  sheet.appendRow([
    new Date(),
    sheetSafe(cleaned.name),
    sheetSafe(cleaned.org),
    sheetSafe(cleaned.email),
    sheetSafe(cleaned.phone),
    sheetSafe(cleaned.social),
    sheetSafe(cleaned.eventType),
    sheetSafe(cleaned.eventDate),
    sheetSafe(cleaned.guests),
    sheetSafe(cleaned.message),
    sheetSafe(cleaned.brochure),
    emailed ? 'yes' : 'FAILED: ' + emailError,
    sheetSafe(cleaned.userAgent),
    sheetSafe(cleaned.pageHref),
  ]);

  return jsonResponse({ ok: true, emailed: emailed });
}

/**
 * Sheets renders a leading =, +, -, @ or tab as a formula when the cell is
 * written, exactly as if typed by hand. Prefixing a single quote makes the
 * value inert text (the quote is Sheets' own literal-text marker and stays
 * out of the displayed value). Applied to every attacker-controllable cell.
 */
function sheetSafe(value) {
  return /^[=+\-@\t]/.test(value) ? "'" + value : value;
}

/**
 * Cap outbound mail per rolling hour so a scripted flood cannot burn the
 * 100-recipients/day MailApp quota and silently mute real leads for the
 * rest of the day. Over budget, requests still land in the sheet with the
 * Emailed column flagged. Twenty an hour is far above any legitimate rate
 * for a single-shop events form.
 */
function underMailBudget() {
  const cache = CacheService.getScriptCache();
  const key = 'mail_' + Math.floor(Date.now() / 3600000);
  const count = Number(cache.get(key) || 0);
  if (count >= 20) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}

function sendRequestEmail(cleaned) {
  const subject = 'Event request — ' + cleaned.eventType + ' on ' +
    cleaned.eventDate + ' — ' + cleaned.name;
  const lines = [
    'New event request from blendnbubbles.com/events',
    '',
    'Name:           ' + cleaned.name,
    'Organisation:   ' + (cleaned.org || '—'),
    'Email:          ' + cleaned.email,
    'Phone:          ' + cleaned.phone,
    'Social:         ' + (cleaned.social || '—'),
    'Event type:     ' + cleaned.eventType,
    'Event date:     ' + cleaned.eventDate,
    'Guests:         ' + cleaned.guests,
    'Brochure/deck:  ' + (cleaned.brochure || '—'),
    '',
    'Message:',
    cleaned.message || '—',
    '',
    'Reply to this email to answer ' + cleaned.name + ' directly.',
  ];
  const options = { name: SENDER_NAME };
  // Reply-To the submitter so a plain reply in Gmail goes to the customer.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
    options.replyTo = cleaned.email;
  }
  MailApp.sendEmail(RECIPIENT, subject, lines.join('\n'), options);
}

/**
 * Cap lengths and strip line breaks from single-line fields. The subject
 * line is built from these values, so the line-break strip is also the
 * header-injection guard.
 */
function sanitise(body) {
  const singleLine = [
    'name', 'org', 'email', 'phone', 'social', 'eventType', 'eventDate',
    'guests', 'brochure', 'userAgent', 'pageHref',
  ];
  const out = {};
  singleLine.concat(['message']).forEach(function (k) {
    let v = body[k] === undefined || body[k] === null ? '' : String(body[k]);
    if (singleLine.indexOf(k) !== -1) v = v.replace(/[\r\n  ]+/g, ' ');
    out[k] = v.slice(0, MAX_LEN[k] || 200).trim();
  });
  return out;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
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
 * Run once from the editor to grant the SpreadsheetApp + MailApp scopes so
 * the deployed web app can append rows and send mail. Sends a test email so
 * the whole path is proven before the form goes live.
 */
function authorize() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  ensureHeaders(sheet);
  MailApp.sendEmail(RECIPIENT, 'BnB events webhook — test email',
    'The events webhook can send mail. Rows so far: ' + sheet.getLastRow(),
    { name: SENDER_NAME });
  Logger.log('Authorised. Sheet rows so far: %s', sheet.getLastRow());
}
