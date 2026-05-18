const axios = require('axios');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { FCM_ENDPOINT, isFcmConfigured } = require('../config/fcm');

const createNotification = async ({ userId, title, message, type = 'general', referenceId }) => {
  const notification = await Notification.create({
    userId,
    title,
    message,
    type,
    referenceId,
  });

  const user = await User.findById(userId).select('fcmToken');
  if (user?.fcmToken) {
    await sendPushNotification(user.fcmToken, { title, body: message, data: { type, referenceId: String(referenceId || '') } });
  }

  return notification;
};

const sendPushNotification = async (fcmToken, payload) => {
  if (!isFcmConfigured() || !fcmToken) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MOCK FCM]', payload);
    }
    return { success: false, mocked: true };
  }

  try {
    await axios.post(
      FCM_ENDPOINT,
      {
        to: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      },
      {
        headers: {
          Authorization: `key=${process.env.FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return { success: true };
  } catch (err) {
    console.error('FCM send failed:', err.message);
    return { success: false, error: err.message };
  }
};

const notifyBookingUpdate = async (userId, booking, status) => {
  return createNotification({
    userId,
    title: 'Booking Update',
    message: `Your booking has been ${status}.`,
    type: 'booking',
    referenceId: booking._id,
  });
};

const notifyPaymentStatus = async (userId, bookingId, status) => {
  return createNotification({
    userId,
    title: 'Payment Update',
    message: `Payment status: ${status}.`,
    type: 'payment',
    referenceId: bookingId,
  });
};

const notifyNewMessage = async (userId, senderName) => {
  return createNotification({
    userId,
    title: 'New Message',
    message: `You have a new message from ${senderName}.`,
    type: 'message',
  });
};

module.exports = {
  createNotification,
  sendPushNotification,
  notifyBookingUpdate,
  notifyPaymentStatus,
  notifyNewMessage,
};
