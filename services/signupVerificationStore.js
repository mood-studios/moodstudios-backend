const { OTP_TTL_MS } = require('../utils/otp');

/** In-memory signup OTP / verified-email cache. */
const store = new Map();

const VERIFIED_WINDOW_MS = 15 * 60 * 1000;

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const setOtp = (email, otp) => {
  store.set(normalizeEmail(email), {
    otp: String(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
};

const verifyOtpCode = (email, otp) => {
  const entry = store.get(normalizeEmail(email));
  if (!entry || entry.verified) {
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

const markVerified = (email) => {
  const key = normalizeEmail(email);
  store.set(key, {
    verified: true,
    expiresAt: Date.now() + VERIFIED_WINDOW_MS,
  });
};

const isVerified = (email) => {
  const entry = store.get(normalizeEmail(email));
  return Boolean(entry?.verified && entry.expiresAt > Date.now());
};

const consumeVerified = (email) => {
  const key = normalizeEmail(email);
  if (!isVerified(email)) return false;
  store.delete(key);
  return true;
};

const clear = (email) => {
  store.delete(normalizeEmail(email));
};

module.exports = {
  setOtp,
  verifyOtpCode,
  markVerified,
  isVerified,
  consumeVerified,
  clear,
};
