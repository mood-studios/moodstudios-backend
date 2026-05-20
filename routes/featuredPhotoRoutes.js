const express = require('express');
const router = express.Router();
const featuredPhotoController = require('../controllers/featuredPhotoController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

router.use(protect, authorize('admin'));

router.get('/', featuredPhotoController.listFeaturedPhotos);
router.put(
  '/',
  [body('photos').isArray(), body('photos.*').optional().isString().trim()],
  validate,
  featuredPhotoController.syncFeaturedPhotos
);

module.exports = router;
