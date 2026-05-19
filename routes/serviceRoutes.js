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
router.post('/', serviceRules, validate, serviceController.createService);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);
router.patch('/:id/visibility', serviceController.toggleVisibility);

module.exports = router;
