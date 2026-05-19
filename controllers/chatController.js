const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyNewMessage } = require('../services/notificationService');

const getAdminIds = () => User.find({ role: 'admin' }).distinct('_id');

/**
 * Studio inbox: one thread per customer for all admins (not per admin user).
 */
const buildRoomId = (userId1, userId2, bookingId, roles = {}) => {
  const id1 = userId1.toString();
  const id2 = userId2.toString();
  const { role1, role2 } = roles;

  let customerId = null;
  if (role1 === 'customer') customerId = id1;
  else if (role2 === 'customer') customerId = id2;

  if (customerId && (role1 === 'admin' || role2 === 'admin')) {
    return bookingId
      ? `booking_${bookingId}_studio_${customerId}`
      : `chat_studio_${customerId}`;
  }

  const sorted = [id1, id2].sort().join('_');
  return bookingId ? `booking_${bookingId}_${sorted}` : `chat_${sorted}`;
};

const partnerRole = async (userId) => {
  const user = await User.findById(userId).select('role').lean();
  return user?.role || null;
};

const historyFilterForUser = async (user, receiverId, bookingId) => {
  const partnerOid = new mongoose.Types.ObjectId(String(receiverId));

  if (user.role === 'admin') {
    const adminIds = await getAdminIds();
    const filter = {
      $or: [
        { senderId: { $in: adminIds }, receiverId: partnerOid },
        { senderId: partnerOid, receiverId: { $in: adminIds } },
      ],
    };
    if (bookingId) filter.bookingId = new mongoose.Types.ObjectId(String(bookingId));
    return filter;
  }

  if (user.role === 'customer') {
    const adminIds = await getAdminIds();
    const filter = {
      $or: [
        { senderId: user._id, receiverId: { $in: adminIds } },
        { senderId: { $in: adminIds }, receiverId: user._id },
      ],
    };
    if (bookingId) filter.bookingId = new mongoose.Types.ObjectId(String(bookingId));
    return filter;
  }

  const filter = {
    $or: [
      { senderId: user._id, receiverId: partnerOid },
      { senderId: partnerOid, receiverId: user._id },
    ],
  };
  if (bookingId) filter.bookingId = new mongoose.Types.ObjectId(String(bookingId));
  return filter;
};

exports.sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, message, bookingId } = req.body;

  if (!receiverId || !message?.trim()) {
    throw new ApiError(400, 'receiverId and message are required');
  }

  const role2 = await partnerRole(receiverId);
  const roomId = buildRoomId(req.user._id, receiverId, bookingId, {
    role1: req.user.role,
    role2,
  });

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

  if (!mongoose.Types.ObjectId.isValid(String(receiverId))) {
    throw new ApiError(400, 'Invalid receiverId');
  }

  const role2 = req.user.role === 'customer' ? 'admin' : await partnerRole(receiverId);
  const roomId = buildRoomId(req.user._id, receiverId, bookingId, {
    role1: req.user.role,
    role2,
  });

  const filter = await historyFilterForUser(req.user, receiverId, bookingId);

  const messages = await Chat.find(filter)
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
  const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('name email role');
  if (!admin) {
    throw new ApiError(404, 'Studio contact not available');
  }
  res.json({ success: true, data: admin });
});

module.exports.buildRoomId = buildRoomId;
