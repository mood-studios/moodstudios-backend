const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

router.use(protect);

router.get('/booking/:bookingId', galleryController.getGalleryByBooking);
router.get('/:id/download', galleryController.downloadAlbum);
router.get('/:id', galleryController.getAlbum);

router.post('/', authorize('admin'), [body('bookingId').isMongoId(), body('albumName').trim().notEmpty()], validate, galleryController.createAlbum);
router.post(
  '/:id/photos',
  authorize('admin'),
  uploadLimiter,
  upload.array('photos', 20),
  galleryController.uploadPhotos
);
router.delete('/:id/photos/:photoId', authorize('admin'), galleryController.deletePhoto);
router.delete('/:id', galleryController.deleteAlbum);

module.exports = router;
