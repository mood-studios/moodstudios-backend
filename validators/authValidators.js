const { body } = require('express-validator');

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').optional().trim(),
  body('recaptchaToken').optional().isString(),
];

exports.loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

exports.otpRules = [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
];
