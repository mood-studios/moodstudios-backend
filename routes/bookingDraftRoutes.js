const express = require('express');
const router = express.Router();
const bookingDraftController = require('../controllers/bookingDraftController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(protect, authorize('customer'));

router.get('/me', bookingDraftController.getMyDraft);
router.put('/me', bookingDraftController.saveMyDraft);
router.delete('/me', bookingDraftController.clearMyDraft);

module.exports = router;
