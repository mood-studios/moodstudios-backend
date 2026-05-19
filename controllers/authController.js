const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { issueAuth, clearAuthCookie, userPayload } = require('../utils/authCookie');
const { generateOtp, sendOtpEmail } = require('../services/emailService');
const { assignOtp, isOtpExpired } = require('../utils/otp');
const signupStore = require('../services/signupVerificationStore');
const { verifyRecaptcha } = require('../services/recaptchaService');
const { logActivity } = require('../services/activityLogService');

const emailTakenMessage = 'Email already registered';

async function assertEmailAvailable(email) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(400, emailTakenMessage);
  }
}

/** Remove legacy unverified accounts from the old signup flow. */
async function removeStaleUnverifiedUser(email) {
  await User.deleteOne({ email, isVerified: false });
}

exports.sendSignupOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  await assertEmailAvailable(email);
  signupStore.clear(email);

  const otp = generateOtp();
  signupStore.setOtp(email, otp);
  await sendOtpEmail(email, otp);

  res.json({
    success: true,
    message: 'Verification code sent to your email',
  });
});

exports.verifySignupOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const code = String(otp).trim();

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(400, emailTakenMessage);
  }

  const result = signupStore.verifyOtpCode(email, code);
  if (!result.ok) {
    throw new ApiError(400, result.expired ? 'Verification code expired' : 'Invalid verification code');
  }

  signupStore.markVerified(email);

  res.json({
    success: true,
    message: 'Email verified. You can finish creating your account.',
  });
});

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, recaptchaToken } = req.body;
  const isMobileClient = req.get('X-Mood-Client') === 'mobile';

  if (!signupStore.isVerified(email)) {
    throw new ApiError(400, 'Please verify your email before registering');
  }

  await verifyRecaptcha(recaptchaToken, { isMobileClient });
  await assertEmailAvailable(email);
  await removeStaleUnverifiedUser(email);

  const allowedRole = role === 'admin' && process.env.ALLOW_ADMIN_REGISTER === 'true' ? 'admin' : 'customer';

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: allowedRole,
    isVerified: true,
  });

  signupStore.consumeVerified(email);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: issueAuth(res, user),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +otpCode +otpExpires');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isVerified) {
    let message = 'Please verify your email. Use the code we already sent.';
    if (isOtpExpired(user)) {
      const otp = generateOtp();
      assignOtp(user, otp);
      await user.save();
      await sendOtpEmail(email, otp);
      message = 'Please verify your email. A new code was sent.';
    }

    return res.json({
      success: true,
      message,
      data: {
        ...issueAuth(res, user),
        requiresVerification: true,
      },
    });
  }

  const data = issueAuth(res, user);

  if (user.role === 'admin') {
    await logActivity({
      req,
      actor: user,
      action: 'auth.login',
      resourceType: 'auth',
      summary: `Admin signed in: ${user.email}`,
    });
  }

  res.json({
    success: true,
    data,
  });
});

/** Legacy: verify email for accounts created before SafeBite-style signup. */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const code = String(otp).trim();

  const user = await User.findOne({ email }).select('+otpCode +otpExpires');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  if (!user.otpCode || isOtpExpired(user) || user.otpCode !== code) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  user.isVerified = true;
  user.otpCode = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully',
    data: issueAuth(res, user),
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: userPayload(req.user),
  });
});

exports.logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

exports.resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const existing = await User.findOne({ email });
  if (!existing) {
    await assertEmailAvailable(email);
    const otp = generateOtp();
    signupStore.setOtp(email, otp);
    await sendOtpEmail(email, otp);
    return res.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  }

  if (existing.isVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  const otp = generateOtp();
  assignOtp(existing, otp);
  await existing.save();
  await sendOtpEmail(email, otp);

  res.json({
    success: true,
    message: 'OTP resent successfully',
  });
});
