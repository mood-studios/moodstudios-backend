const ApiError = require('../utils/ApiError');

const isRecaptchaEnabled = () => Boolean(process.env.RECAPTCHA_SECRET_KEY);

const verifyRecaptcha = async (token, { isMobileClient = false } = {}) => {
  if (!isRecaptchaEnabled()) {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(503, 'reCAPTCHA is not configured');
    }
    if (process.env.ALLOW_RECAPTCHA_SKIP === 'true') {
      return true;
    }
    return true;
  }

  if (!token) {
    if (isMobileClient && process.env.ALLOW_MOBILE_RECAPTCHA_SKIP === 'true') {
      return true;
    }
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_RECAPTCHA_SKIP === 'true') {
      return true;
    }
    throw new ApiError(400, 'Please complete the reCAPTCHA challenge');
  }

  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: token,
  });

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (!data.success) {
    throw new ApiError(400, 'reCAPTCHA verification failed. Please try again.');
  }

  return true;
};

module.exports = { isRecaptchaEnabled, verifyRecaptcha };
