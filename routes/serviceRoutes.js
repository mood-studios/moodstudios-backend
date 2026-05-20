const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { protect } = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const { body } = require('express-validator');

const serviceRules = [
  body('name').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('duration').isInt({ min: 1 }),
  body('category').isMongoId(),
  body('samplePhotos').optional().isArray(),
  body('samplePhotos.*').optional().isString().trim(),
];

router.get('/', optionalAuth, serviceController.getServices);
router.get('/:id', serviceController.getService);

router.use(protect, authorize('admin'));

router.post(
  '/upload-image',
  uploadLimiter,
  upload.single('image'),
  serviceController.uploadServiceImage
);
router.post(
  '/upload-images',
  uploadLimiter,
  upload.array('images', 20),
  serviceController.uploadServiceImages
);
router.post('/', serviceRules, validate, serviceController.createService);
const updateServiceRules = [
  body('name').optional().trim().notEmpty(),
  body('description').optional().isString(),
  body('price').optional().isFloat({ min: 0 }),
  body('duration').optional().isInt({ min: 1 }),
  body('category').optional().isMongoId(),
  body('image').optional().isString(),
  body('samplePhotos').optional().isArray(),
  body('samplePhotos.*').optional().isString().trim(),
];

router.put('/:id', updateServiceRules, validate, serviceController.updateService);
router.delete('/:id', serviceController.deleteService);
router.patch('/:id/visibility', serviceController.toggleVisibility);

module.exports = router;
