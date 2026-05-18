const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.getNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  const filter = { userId: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, data: notifications });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.json({ success: true, data: notification });
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.json({ success: true, message: 'Notification deleted' });
});
