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

/** Paths that should not count toward rate limits (webhooks, health probes, low-cost polls). */
const POLL_SKIP_PATTERNS = [
  '/chat/messages/',
  '/chat/unread',
  '/notifications/unread',
  '/booking-drafts/me',
];

const shouldSkip = (req) => {
  const path = req.originalUrl || req.url || req.path || '';
  if (path === '/api/health' || path.endsWith('/health')) return true;
  if (path.includes('/payments/webhook')) return true;
  if (req.method === 'GET' && POLL_SKIP_PATTERNS.some((p) => path.includes(p))) {
    return true;
  }
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

/** General API traffic (all routes). Generous so busy admin sessions don't trip it. */
const generalLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_MAX', 1000),
});

/** Login, register — brute-force protection. */
const authLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_AUTH_MAX', 20),
  skipSuccessfulRequests: true,
});

/** OTP send / verify / resend — tighter cap. */
const otpLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_OTP_MAX', 12),
});

/** File uploads — prevent abuse of Cloudinary/storage. */
const uploadLimiter = createLimiter({
  max: parsePositiveInt('RATE_LIMIT_UPLOAD_MAX', 60),
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
};
