const { signToken } = require('./token');

const COOKIE_NAME = 'mood_token';

const cookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
};

/** Sign JWT, set httpOnly cookie, return auth payload (includes token for mobile clients). */
const issueAuth = (res, user) => {
  const token = signToken(user._id, user.role);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    token,
  };
};

const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

const readAuthToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return req.cookies?.[COOKIE_NAME] || null;
};

const userPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isVerified: user.isVerified,
});

module.exports = {
  COOKIE_NAME,
  issueAuth,
  clearAuthCookie,
  readAuthToken,
  userPayload,
};
