const { body } = require('express-validator');

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must include at least one uppercase letter')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must include at least one special character'),
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

exports.forgotPasswordSendRules = [body('email').isEmail().normalizeEmail()];

exports.forgotPasswordResetRules = [
  body('email').isEmail().normalizeEmail(),
  body('otp')
    .customSanitizer((value) => String(value).trim().replace(/\D/g, ''))
    .isLength({ min: 6, max: 6 })
    .withMessage('Enter the 6-digit code from your email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must include at least one uppercase letter')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must include at least one special character'),
];
