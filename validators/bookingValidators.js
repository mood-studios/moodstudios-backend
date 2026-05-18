const { body } = require('express-validator');

exports.createBookingRules = [
  body('services').isArray({ min: 1 }).withMessage('At least one service is required'),
  body('services.*').isMongoId(),
  body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
  body('bookingTime').trim().notEmpty().withMessage('Booking time is required'),
  body('specialRequest').optional().trim(),
];
