const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const categoryController = require('../controllers/categoryController');
const serviceController = require('../controllers/serviceController');

/** Public endpoints for the marketing / booking website (no auth). */

router.get('/categories', categoryController.getCategories);
router.get('/services', (req, res, next) => {
  req.query.visibleOnly = 'true';
  next();
}, serviceController.getServices);
router.get('/availability', bookingController.getAvailability);

module.exports = router;
