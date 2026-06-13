const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Send an email via Gmail
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email body
 * @param {string} options.html - HTML email body (optional)
 * @param {Array} options.attachments - Array of attachment objects (optional)
 */
async function sendEmail({ to, subject, text, html, attachments = [] }) {
  try {
    // Verify credentials
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not found. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: to,
      subject: subject,
      text: text,
      html: html,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error.message);
    throw error;
  }
}

// If run directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node send-email.js <to> <subject> <text> [html]');
    console.log('Example: node send-email.js recipient@example.com "Hello" "This is a test email"');
    process.exit(1);
  }

  const [to, subject, text, html] = args;
  
  sendEmail({ to, subject, text, html: html || text })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to send email:', error);
      process.exit(1);
    });
}

module.exports = { sendEmail };

