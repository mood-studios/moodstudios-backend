const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const { registerRules, loginRules, otpRules } = require('../validators/authValidators');

router.post(
  '/send-signup-otp',
  otpLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.sendSignupOtp
);
router.post('/verify-signup-otp', otpLimiter, otpRules, validate, authController.verifySignupOtp);
router.post('/register', authLimiter, registerRules, validate, authController.register);
router.post('/login', authLimiter, loginRules, validate, authController.login);
router.post('/verify-otp', otpLimiter, otpRules, validate, authController.verifyOtp);
router.get('/me', protect, authController.me);
router.post('/logout', authController.logout);
router.post(
  '/resend-otp',
  otpLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.resendOtp
);

module.exports = router;
