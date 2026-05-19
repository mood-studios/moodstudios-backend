const Chat = require('../models/Chat');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyNewMessage } = require('../services/notificationService');

const buildRoomId = (userId1, userId2, bookingId) => {
  const sorted = [userId1.toString(), userId2.toString()].sort().join('_');
  return bookingId ? `booking_${bookingId}_${sorted}` : `chat_${sorted}`;
};

exports.sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, message, bookingId } = req.body;

  if (!receiverId || !message?.trim()) {
    throw new ApiError(400, 'receiverId and message are required');
  }

  const roomId = buildRoomId(req.user._id, receiverId, bookingId);

  const chat = await Chat.create({
    roomId,
    senderId: req.user._id,
    receiverId,
    bookingId: bookingId || undefined,
    message: message.trim(),
  });

  const populated = await chat.populate('senderId', 'name role');

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('receive_message', populated);
    io.to(`user_${receiverId}`).emit('new_message_notification', {
      roomId,
      senderId: req.user._id.toString(),
      preview: message.trim().substring(0, 80),
    });
  }

  await notifyNewMessage(receiverId, req.user.name);

  res.status(201).json({ success: true, data: populated });
});

exports.getChatHistory = asyncHandler(async (req, res) => {
  const { receiverId, bookingId } = req.query;

  if (!receiverId) {
    throw new ApiError(400, 'receiverId is required');
  }

  const roomId = buildRoomId(req.user._id, receiverId, bookingId);

  const messages = await Chat.find({ roomId })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role')
    .sort({ createdAt: 1 })
    .limit(200);

  res.json({ success: true, data: { roomId, messages } });
});

exports.getMyConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const messages = await Chat.aggregate([
    {
      $match: {
        $or: [{ senderId: userId }, { receiverId: userId }],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$roomId',
        lastMessage: { $first: '$$ROOT' },
      },
    },
    { $limit: 50 },
  ]);

  const populated = await Chat.populate(messages, [
    { path: 'lastMessage.senderId', select: 'name role' },
    { path: 'lastMessage.receiverId', select: 'name role' },
  ]);

  res.json({ success: true, data: populated });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const { roomId } = req.body;

  await Chat.updateMany(
    { roomId, receiverId: req.user._id, read: false },
    { read: true }
  );

  res.json({ success: true, message: 'Messages marked as read' });
});

exports.getAdminChatPartners = asyncHandler(async (req, res) => {
  const customers = await User.find({ role: 'customer' }).select('name email');
  res.json({ success: true, data: customers });
});

exports.getStudioContact = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ role: 'admin' }).select('name email role');
  if (!admin) {
    throw new ApiError(404, 'Studio contact not available');
  }
  res.json({ success: true, data: admin });
});

module.exports.buildRoomId = buildRoomId;
