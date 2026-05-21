const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const blockedDayController = require('../controllers/blockedDayController');
const schedule = require('../config/bookingSchedule');
const categoryController = require('../controllers/categoryController');
const serviceController = require('../controllers/serviceController');
const featuredPhotoController = require('../controllers/featuredPhotoController');

/** Public endpoints for the marketing / booking website (no auth). */

router.get('/categories', categoryController.getCategories);
router.get('/featured-photos', (req, res, next) => {
  req.query.visibleOnly = 'true';
  next();
}, featuredPhotoController.listFeaturedPhotos);
router.get('/services', (req, res, next) => {
  req.query.visibleOnly = 'true';
  next();
}, serviceController.getServices);
router.get('/availability', bookingController.getAvailability);
router.get('/blocked-days', blockedDayController.listPublicBlockedDays);
router.get('/schedule', (req, res) => {
  res.json({
    success: true,
    data: {
      openHour: schedule.OPEN_HOUR,
      closeHour: schedule.CLOSE_HOUR,
      closedWeekdays: schedule.CLOSED_WEEKDAYS,
    },
  });
});

module.exports = router;
