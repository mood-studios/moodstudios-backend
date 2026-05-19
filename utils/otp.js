const OTP_TTL_MS = 5 * 60 * 1000;

const getOtpExpiresAt = () => new Date(Date.now() + OTP_TTL_MS);

const isOtpExpired = (user) => {
  if (!user?.otpCode || !user?.otpExpires) return true;
  return user.otpExpires.getTime() <= Date.now();
};

const assignOtp = (user, otp) => {
  user.otpCode = otp;
  user.otpExpires = getOtpExpiresAt();
};

module.exports = {
  OTP_TTL_MS,
  OTP_TTL_MINUTES: OTP_TTL_MS / 60_000,
  getOtpExpiresAt,
  isOtpExpired,
  assignOtp,
};
