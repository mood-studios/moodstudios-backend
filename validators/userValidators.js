const { body } = require('express-validator');

exports.changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

exports.preferencesRules = [
  body('notifications.booking').optional().isBoolean(),
  body('notifications.payment').optional().isBoolean(),
  body('notifications.messages').optional().isBoolean(),
  body('notifications.marketing').optional().isBoolean(),
  body('emailDigest').optional().isBoolean(),
  body('theme').optional().isIn(['light', 'dark', 'system']),
  body('language').optional().isString().trim().isLength({ min: 2, max: 10 }),
];

exports.updateProfileRules = [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('fcmToken').optional().isString(),
];

exports.adminUpdateUserRules = [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('role').optional().isIn(['admin', 'customer']),
  body('isVerified').optional().isBoolean(),
];

exports.adminCreateCustomerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').optional().trim(),
];
