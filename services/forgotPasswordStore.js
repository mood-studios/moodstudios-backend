const { OTP_TTL_MS } = require('../utils/otp');

/** In-memory OTP cache for password reset (verified accounts only). */
const store = new Map();

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const setOtp = (email, otp) => {
  store.set(normalizeEmail(email), {
    otp: String(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
};

const verifyOtpCode = (email, otp) => {
  const entry = store.get(normalizeEmail(email));
  if (!entry) {
    return { ok: false };
  }
  if (!entry.otp || entry.expiresAt <= Date.now()) {
    return { ok: false, expired: true };
  }
  if (entry.otp !== String(otp).trim()) {
    return { ok: false };
  }
  return { ok: true };
};

const clear = (email) => {
  store.delete(normalizeEmail(email));
};

module.exports = {
  setOtp,
  verifyOtpCode,
  clear,
};
