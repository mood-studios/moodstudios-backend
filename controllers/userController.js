const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, fcmToken } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { ...(name && { name }), ...(phone && { phone }), ...(fcmToken && { fcmToken }) },
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: user });
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
