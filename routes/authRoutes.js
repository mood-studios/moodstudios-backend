const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { registerRules, loginRules, otpRules } = require('../validators/authValidators');

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.post('/verify-otp', otpRules, validate, authController.verifyOtp);
const { body } = require('express-validator');
router.post('/resend-otp', [body('email').isEmail().normalizeEmail()], validate, authController.resendOtp);

module.exports = router;
