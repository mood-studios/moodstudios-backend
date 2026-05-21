const express = require('express');
const router = express.Router();

router.use('/public', require('./publicRoutes'));
router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/featured-photos', require('./featuredPhotoRoutes'));
router.use('/services', require('./serviceRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/blocked-days', require('./blockedDayRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/gallery', require('./galleryRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/activity-logs', require('./activityLogRoutes'));

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Mood Studios API is running', timestamp: new Date().toISOString() });
});

module.exports = router;
