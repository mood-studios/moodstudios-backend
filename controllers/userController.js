const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

exports.getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, fcmToken } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (fcmToken !== undefined) updates.fcmToken = fcmToken;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: user });
});

exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('preferences');
  res.json({ success: true, data: user.preferences });
});

exports.updatePreferences = asyncHandler(async (req, res) => {
  const { notifications, emailDigest, theme, language } = req.body;
  const user = await User.findById(req.user._id);

  if (!user.preferences) {
    user.preferences = {};
  }

  if (notifications) {
    const current = user.preferences.notifications?.toObject?.() ?? user.preferences.notifications ?? {};
    user.preferences.notifications = { ...current, ...notifications };
    user.markModified('preferences.notifications');
  }
  if (emailDigest !== undefined) user.preferences.emailDigest = emailDigest;
  if (theme !== undefined) user.preferences.theme = theme;
  if (language !== undefined) user.preferences.language = language;

  await user.save();
  res.json({ success: true, data: user.preferences });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
});

exports.deleteMyAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!password || !(await user.comparePassword(password))) {
    throw new ApiError(400, 'Password is required to delete your account');
  }

  await user.deleteOne();
  res.json({ success: true, message: 'Account deleted successfully' });
});

exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20, isVerified } = req.query;
  const filter = role ? { role } : {};

  if (isVerified === 'true') filter.isVerified = true;
  else if (isVerified === 'false') filter.isVerified = false;

  if (search?.trim()) {
    const regex = { $regex: search.trim(), $options: 'i' };
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
  });
});

exports.getCustomers = asyncHandler(async (req, res) => {
  const customers = await User.find({ role: 'customer' })
    .select('-password')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: customers });
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  res.json({ success: true, data: user });
});

exports.updateUserByAdmin = asyncHandler(async (req, res) => {
  const { name, phone, role, isVerified } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user._id.toString() === req.user._id.toString() && role === 'customer') {
    throw new ApiError(400, 'You cannot demote your own admin account');
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) {
    if (!['admin', 'customer'].includes(role)) {
      throw new ApiError(400, 'Invalid role');
    }
    user.role = role;
  }
  if (isVerified !== undefined) user.isVerified = isVerified;

  await user.save();

  await logActivity({
    req,
    action: 'user.updated',
    resourceType: 'user',
    resourceId: user._id,
    summary: `Updated user ${user.email}`,
    metadata: { role: user.role, isVerified: user.isVerified },
  });

  const safe = user.toObject();
  delete safe.password;
  res.json({ success: true, data: safe });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot delete your own account from the admin panel');
  }

  await logActivity({
    req,
    action: 'user.deleted',
    resourceType: 'user',
    resourceId: user._id,
    summary: `Deleted user ${user.email}`,
    metadata: { role: user.role },
  });

  await user.deleteOne();
  res.json({ success: true, message: 'User deleted' });
});
