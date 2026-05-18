const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

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
  const { role, page = 1, limit = 20 } = req.query;
  const filter = role ? { role } : {};

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

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  res.json({ success: true, message: 'User deleted' });
});
