const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { createBookingRules } = require('../validators/bookingValidators');
const { body } = require('express-validator');

router.use(protect);

router.get('/availability', authorize('admin', 'customer'), bookingController.getAvailability);
router.post('/', authorize('customer'), createBookingRules, validate, bookingController.createBooking);
router.get('/my', authorize('customer'), bookingController.getMyBookings);
router.get('/', authorize('admin'), bookingController.getAllBookings);
router.get('/:id', bookingController.getBooking);
router.patch('/:id/status', authorize('admin'), [body('status').isIn(['confirmed', 'declined', 'completed'])], validate, bookingController.updateBookingStatus);
router.patch(
  '/:id/reschedule',
  authorize('admin'),
  [body('bookingDate').isISO8601(), body('bookingTime').trim().notEmpty()],
  validate,
  bookingController.rescheduleBooking
);
router.delete('/:id', authorize('customer'), bookingController.cancelBooking);

module.exports = router;
