# Gmail Email Setup Guide

This project includes a script to send emails via Gmail SMTP.

## Setup Instructions

### 1. Get a Gmail App Password

**IMPORTANT:** You MUST use an App Password, NOT your regular Gmail password!

1. Go to your Google Account settings: https://myaccount.google.com/
2. Click on **Security** in the left sidebar
3. Enable **2-Step Verification** if not already enabled
4. Under "2-Step Verification", click **App passwords**
5. Select "Mail" as the app and "Other" as the device
6. Enter a name (e.g., "Blend n Bubbles Email")
7. Click **Generate**
8. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

### 2. Create .env File

Create a `.env` file in the project root with the following:

```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

**Note:** Remove any spaces from the app password when pasting it.

### 3. Send Emails

#### Option 1: Command Line

```bash
node send-email.js recipient@example.com "Subject" "Email body text"
```

#### Option 2: Use in Your Code

```javascript
const { sendEmail } = require('./send-email');

// Simple text email
await sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  text: 'This is a test email'
});

// HTML email
await sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  text: 'Plain text version',
  html: '<h1>Hello</h1><p>This is an HTML email</p>'
});

// Email with attachment
await sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  text: 'Check out the attachment',
  attachments: [
    {
      filename: 'document.pdf',
      path: './path/to/document.pdf'
    }
  ]
});
```

## Security Notes

- Never commit your `.env` file to git (it's already in `.gitignore`)
- Never share your App Password
- App Passwords can be revoked at any time from your Google Account settings
- If you get authentication errors, generate a new App Password

