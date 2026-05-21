const express = require('express');
const router = express.Router();
const blockedDayController = require('../controllers/blockedDayController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

router.use(protect, authorize('admin'));

router.get('/', blockedDayController.listBlockedDays);
router.post(
  '/',
  [body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'), body('reason').optional().trim()],
  validate,
  blockedDayController.blockDay
);
router.delete('/:id', blockedDayController.unblockDay);

module.exports = router;
