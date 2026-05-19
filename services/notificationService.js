const Notification = require('../models/Notification');
const User = require('../models/User');
const { getMessaging, isFcmConfigured } = require('../config/fcm');

const shouldSendPush = (user, type) => {
  const prefs = user?.preferences?.notifications;
  if (!prefs) return true;
  switch (type) {
    case 'booking':
      return prefs.booking !== false;
    case 'payment':
      return prefs.payment !== false;
    case 'message':
      return prefs.messages !== false;
    case 'marketing':
      return prefs.marketing === true;
    default:
      return true;
  }
};

const toStringData = (data) =>
  Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => [key, value == null ? '' : String(value)]),
  );

const createNotification = async ({ userId, title, message, type = 'general', referenceId }) => {
  const notification = await Notification.create({
    userId,
    title,
    message,
    type,
    referenceId,
  });

  const user = await User.findById(userId).select('fcmToken preferences');
  if (user?.fcmToken && shouldSendPush(user, type)) {
    await sendPushNotification(user.fcmToken, {
      title,
      body: message,
      data: { type, referenceId: String(referenceId || '') },
    });
  }

  return notification;
};

const sendPushNotification = async (fcmToken, payload) => {
  if (!fcmToken) {
    return { success: false, error: 'missing_token' };
  }

  if (!isFcmConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MOCK FCM v1]', payload);
    }
    return { success: false, mocked: true };
  }

  try {
    const messaging = getMessaging();
    const messageId = await messaging.send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: toStringData(payload.data),
      android: {
        priority: 'high',
        notification: { channelId: 'mood_studios_alerts' },
      },
      apns: {
        payload: { aps: { sound: 'default' } },
      },
    });
    return { success: true, messageId };
  } catch (err) {
    console.error('FCM v1 send failed:', err.message);
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
