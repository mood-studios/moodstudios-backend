const sgMail = require('@sendgrid/mail');
const { OTP_TTL_MINUTES } = require('../utils/otp');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const isSendGridConfigured = () =>
  Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);

const buildOtpHtml = (otp, purpose = 'verification') => {
  const intro =
    purpose === 'reset'
      ? 'Use this code to reset your Mood Studios password:'
      : 'Use this code to verify your email address:';
  const footer =
    purpose === 'reset'
      ? 'If you did not request a password reset, you can ignore this email.'
      : 'If you did not create an account, you can ignore this email.';

  return `
  <div style="font-family: Outfit, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2 style="color: #960ffa; margin-bottom: 8px;">Mood Studios</h2>
    <p style="color: #444; line-height: 1.5;">${intro}</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a; margin: 24px 0;">${otp}</p>
    <p style="color: #666; font-size: 14px;">This code expires in ${OTP_TTL_MINUTES} minutes. ${footer}</p>
    <p style="color: #888; font-size: 12px; margin-top: 16px;">Can't find this message? Check your Spam or Promotions folder and mark it as Not spam.</p>
  </div>
`;
};

const sendOtpEmail = async (email, otp, { purpose = 'verification' } = {}) => {
  if (!isSendGridConfigured()) {
    return { success: true, mocked: true };
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const subject =
    purpose === 'reset'
      ? 'Reset your Mood Studios password'
      : 'Your Mood Studios verification code';
  const textIntro =
    purpose === 'reset'
      ? 'Your Mood Studios password reset code is'
      : 'Your Mood Studios verification code is';

  await sgMail.send({
    to: email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME || 'Mood Studios',
    },
    subject,
    text: `${textIntro} ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.\n\nCan't find this email? Check your Spam or Promotions folder.`,
    html: buildOtpHtml(otp, purpose),
  });

  return { success: true, mocked: false };
};

module.exports = { generateOtp, sendOtpEmail, isSendGridConfigured };
