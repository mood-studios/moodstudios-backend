/**
 * Firebase Cloud Messaging — API-ready structure.
 * Set FCM_SERVER_KEY and call sendPushNotification from notificationService.
 */
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

const isFcmConfigured = () => Boolean(process.env.FCM_SERVER_KEY);

module.exports = { FCM_ENDPOINT, isFcmConfigured };
