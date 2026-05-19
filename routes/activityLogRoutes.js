const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(protect, authorize('admin'));

router.get('/meta', activityLogController.getActivityActions);
router.get('/', activityLogController.getActivityLogs);

module.exports = router;
