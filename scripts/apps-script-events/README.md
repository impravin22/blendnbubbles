# Event Requests webhook

Receives submissions from `blendnbubbles.com/events`, logs each one to a
Google Sheet, and emails `blendnbubbles@gmail.com` with Reply-To set to the
customer, so replying in Gmail answers them directly.

Same architecture as `scripts/apps-script-spins`: an Apps Script web app
called with GET query params (this Workspace blocks anonymous POST bodies).

## Deploy (one-time, ~10 minutes)

1. **Create the sheet.** In Google Drive (as the account that should own the
   data), create a spreadsheet named e.g. `BnB Event Requests`. Copy its ID
   from the URL (`/spreadsheets/d/<ID>/edit`).
2. **Create the script.** Go to <https://script.google.com> → New project →
   name it `BnB Event Requests`. Paste `Code.js` into the editor, replacing
   the default file. Set `SHEET_ID` to the ID from step 1.
3. **Manifest.** Project Settings → tick "Show appsscript.json", then paste
   `appsscript.json` from this folder over the default one.
4. **Authorise + prove the mail path.** In the editor run the `authorize`
   function once. Approve the consent screen (Sheets + Mail scopes). It
   appends the header row and sends a test email to the recipient — check it
   arrived (look in spam the first time).
5. **Deploy.** Deploy → New deployment → type "Web app" →
   execute as **Me**, access **Anyone** → Deploy. Copy the
   `https://script.google.com/macros/s/…/exec` URL.
6. **Point the site at it.** In the repo root `.env.production` add:

   ```
   REACT_APP_EVENTS_WEBHOOK_URL=https://script.google.com/macros/s/…/exec
   ```

7. **Ship the site.** `npm run deploy` (builds and publishes to GitHub
   Pages). Until step 6 is done the form shows a fallback asking people to
   email/call instead — nothing breaks, but do steps 1–6 first so the form
   is live from the start.

## Verify after deploy

- Open the `/exec` URL in a browser with no params → replies
  `BnB Event Requests webhook is live.`
- Submit the form on `blendnbubbles.com/events` → row appears in the sheet,
  email lands in `blendnbubbles@gmail.com`, and the `Emailed` column says
  `yes`.

## Behaviour notes

- **Honeypot:** submissions with the hidden `hp` field filled get an `ok`
  reply but are neither stored nor emailed.
- **Sheet before email:** if the daily MailApp quota (100 recipients/day on
  a consumer account) is ever exhausted, the row is still stored and the
  `Emailed` column records the failure, so no request is lost.
- **Hourly mail budget:** at most 20 emails per rolling hour; past that,
  requests still land in the sheet with the `Emailed` column flagged. Stops
  a scripted flood burning the whole daily quota and silently muting real
  leads.
- **Formula-injection guard:** any cell value starting with `=`, `+`, `-`,
  `@` or a tab is prefixed with a quote so Sheets stores it as inert text.
- **Field caps:** every field is length-capped and single-line fields have
  line breaks stripped — that strip is also the email header-injection
  guard.
- **PII in query strings:** GET is unavoidable here (anonymous POST is
  blocked). Submissions travel as query params over HTTPS; Apps Script exec
  URLs are not cached by intermediaries. Same trade-off the spins webhook
  already made.

## Changing the recipient

Edit `RECIPIENT` at the top of `Code.js` and create a new deployment
(Deploy → Manage deployments → edit → new version).
