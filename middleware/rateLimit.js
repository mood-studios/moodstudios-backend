const rateLimit = require('express-rate-limit');

const RATE_LIMIT_MESSAGE = {
  success: false,
  message: 'Too many requests, please try again later',
};

const parsePositiveInt = (envKey, fallback) => {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const windowMs = parsePositiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

/** Paths that should not count toward rate limits (webhooks, health probes). */
const shouldSkip = (req) => {
  const path = req.originalUrl || req.url || req.path || '';
  if (path === '/api/health' || path.endsWith('/health')) return true;
  if (path.includes('/payments/webhook')) return true;
  return false;
};

const createLimiter = ({ max, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: shouldSkip,
    handler: (req, res) => {
      res.status(429).json(RATE_LIMIT_MESSAGE);
    },
  });

/** General API traffic (all routes). */
const generalLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_MAX', 200),
});

/** Login, register — brute-force protection. */
const authLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_AUTH_MAX', 15),
  skipSuccessfulRequests: true,
});

/** OTP send / verify / resend — tighter cap. */
const otpLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_OTP_MAX', 8),
});

/** File uploads — prevent abuse of Cloudinary/storage. */
const uploadLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_UPLOAD_MAX', 30),
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
};
