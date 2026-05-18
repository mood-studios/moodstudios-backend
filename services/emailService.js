/**
 * Email OTP service — mocked for development.
 * Replace sendOtpEmail with Nodemailer/SendGrid in production.
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOtpEmail = async (email, otp) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MOCK OTP] Email: ${email} | OTP: ${otp}`);
    return { success: true, mocked: true };
  }
  // TODO: Integrate real email provider
  console.log(`[OTP] Sent to ${email}`);
  return { success: true };
};

module.exports = { generateOtp, sendOtpEmail };
