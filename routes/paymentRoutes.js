const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

router.post('/webhook', paymentController.paymongoWebhook);

router.use(protect);

router.post(
  '/combined',
  [body('bookingIds').isArray({ min: 1 }), body('bookingIds.*').isMongoId()],
  validate,
  paymentController.createCombinedPayment
);
router.post('/', [body('bookingId').isMongoId()], validate, paymentController.createPayment);
router.get('/:id', paymentController.getPayment);
router.post('/:id/confirm', paymentController.confirmPayment);

module.exports = router;
