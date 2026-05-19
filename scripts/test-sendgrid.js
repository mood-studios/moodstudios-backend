/**
 * Send one test OTP email via SendGrid (for SendGrid "Verify Integration" or local testing).
 * Usage: node scripts/test-sendgrid.js your@email.com
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sendOtpEmail, isSendGridConfigured } = require('../services/emailService');

const to = process.argv[2];

async function main() {
  if (!to) {
    console.error('Usage: node scripts/test-sendgrid.js <recipient@email.com>');
    process.exit(1);
  }

  if (!isSendGridConfigured()) {
    console.error('Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in backend/.env');
    process.exit(1);
  }

  const otp = '123456';
  console.log(`Sending test email to ${to} from ${process.env.SENDGRID_FROM_EMAIL}...`);

  try {
    const result = await sendOtpEmail(to, otp);
    if (result.mocked) {
      console.log('SendGrid not active — OTP only logged to console.');
      process.exit(1);
    }
    console.log('Success. Check the inbox (and spam). Then click Verify Integration in SendGrid.');
  } catch (err) {
    console.error('Send failed:', err.response?.body || err.message);
    process.exit(1);
  }
}

main();
