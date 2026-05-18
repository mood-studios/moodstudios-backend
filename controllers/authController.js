const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { issueAuth, clearAuthCookie, userPayload } = require('../utils/authCookie');
const { generateOtp, sendOtpEmail } = require('../services/emailService');

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    throw new ApiError(400, 'Email already registered');
  }

  const allowedRole = role === 'admin' && process.env.ALLOW_ADMIN_REGISTER === 'true' ? 'admin' : 'customer';

  const otp = generateOtp();
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: allowedRole,
    otpCode: otp,
    otpExpires: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendOtpEmail(email, otp);

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email with the OTP sent.',
    data: issueAuth(res, user),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({
    success: true,
    data: issueAuth(res, user),
  });
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email }).select('+otpCode +otpExpires');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.otpCode !== otp || user.otpExpires < new Date()) {
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

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  const otp = generateOtp();
  user.otpCode = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpEmail(email, otp);

  res.json({
    success: true,
    message: 'OTP resent successfully',
  });
});
