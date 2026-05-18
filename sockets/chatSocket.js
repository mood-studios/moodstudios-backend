const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { buildRoomId } = require('../controllers/chatController');
const { notifyNewMessage } = require('../services/notificationService');

const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
};

const initChatSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.user._id})`);

    socket.join(`user_${socket.user._id}`);

    socket.on('join_room', ({ receiverId, bookingId }) => {
      const roomId = buildRoomId(socket.user._id, receiverId, bookingId);
      socket.join(roomId);
      socket.emit('room_joined', { roomId });
    });

    socket.on('send_message', async ({ receiverId, message, bookingId }) => {
      if (!receiverId || !message?.trim()) {
        return socket.emit('error', { message: 'receiverId and message are required' });
      }

      const roomId = buildRoomId(socket.user._id, receiverId, bookingId);

      const chat = await Chat.create({
        roomId,
        senderId: socket.user._id,
        receiverId,
        bookingId: bookingId || undefined,
        message: message.trim(),
      });

      const populated = await chat.populate('senderId', 'name role');

      io.to(roomId).emit('receive_message', populated);
      io.to(`user_${receiverId}`).emit('new_message_notification', {
        roomId,
        preview: message.trim().substring(0, 80),
      });

      await notifyNewMessage(receiverId, socket.user.name);
    });

    socket.on('typing', ({ receiverId, bookingId, isTyping }) => {
      const roomId = buildRoomId(socket.user._id, receiverId, bookingId);
      socket.to(roomId).emit('user_typing', {
        userId: socket.user._id,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
};

module.exports = { initChatSocket };
