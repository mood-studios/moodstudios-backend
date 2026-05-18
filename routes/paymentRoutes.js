const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

router.post('/webhook', paymentController.paymongoWebhook);

router.use(protect);

router.post('/', [body('bookingId').isMongoId()], validate, paymentController.createPayment);
router.get('/:id', paymentController.getPayment);
router.post('/:id/confirm', paymentController.confirmPayment);

module.exports = router;
