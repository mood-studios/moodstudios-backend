const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { COOKIE_NAME } = require('../utils/authCookie');
const { buildRoomId } = require('../controllers/chatController');
const { notifyNewMessage } = require('../services/notificationService');

const readTokenFromHandshake = (socket) => {
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookieHeader = socket.handshake.headers?.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (key === COOKIE_NAME) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = readTokenFromHandshake(socket);

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

    socket.on('join_room', async ({ receiverId, bookingId }) => {
      try {
        const partner = await User.findById(receiverId).select('role').lean();
        const roomId = buildRoomId(socket.user._id, receiverId, bookingId, {
          role1: socket.user.role,
          role2: partner?.role,
        });
        socket.join(roomId);
        socket.emit('room_joined', { roomId });
      } catch (err) {
        socket.emit('error', { message: 'Could not join room' });
      }
    });

    socket.on('send_message', async ({ receiverId, message, bookingId }) => {
      if (!receiverId || !message?.trim()) {
        return socket.emit('error', { message: 'receiverId and message are required' });
      }

      const partner = await User.findById(receiverId).select('role').lean();
      const roomId = buildRoomId(socket.user._id, receiverId, bookingId, {
        role1: socket.user.role,
        role2: partner?.role,
      });

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
        senderId: socket.user._id.toString(),
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
