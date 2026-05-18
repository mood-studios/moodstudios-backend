const Gallery = require('../models/Gallery');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadMultiple, deleteImage } = require('../services/cloudinaryService');

exports.createAlbum = asyncHandler(async (req, res) => {
  const { bookingId, albumName } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  const gallery = await Gallery.create({
    bookingId,
    albumName,
    uploadedBy: req.user._id,
    photos: [],
  });

  res.status(201).json({ success: true, data: gallery });
});

exports.uploadPhotos = asyncHandler(async (req, res) => {
  const gallery = await Gallery.findById(req.params.id);
  if (!gallery) {
    throw new ApiError(404, 'Gallery album not found');
  }

  if (!req.files?.length) {
    throw new ApiError(400, 'No images provided');
  }

  const uploaded = await uploadMultiple(
    req.files,
    `mood-studios/bookings/${gallery.bookingId}`
  );

  const newPhotos = uploaded.map((u, i) => ({
    url: u.url,
    publicId: u.publicId,
    caption: req.body.captions?.[i] || '',
  }));

  gallery.photos.push(...newPhotos);
  await gallery.save();

  res.json({ success: true, data: gallery });
});

exports.getGalleryByBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (
    req.user.role === 'customer' &&
    booking.userId.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, 'Not authorized');
  }

  const galleries = await Gallery.find({ bookingId: req.params.bookingId }).sort({
    createdAt: -1,
  });

  res.json({ success: true, data: galleries });
});

exports.getAlbum = asyncHandler(async (req, res) => {
  const gallery = await Gallery.findById(req.params.id).populate('bookingId');
  if (!gallery) {
    throw new ApiError(404, 'Album not found');
  }

  const booking = await Booking.findById(gallery.bookingId);
  if (
    req.user.role === 'customer' &&
    booking?.userId.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, 'Not authorized');
  }

  res.json({ success: true, data: gallery });
});

exports.deletePhoto = asyncHandler(async (req, res) => {
  const { photoId } = req.params;
  const gallery = await Gallery.findById(req.params.id);
  if (!gallery) {
    throw new ApiError(404, 'Album not found');
  }

  const photo = gallery.photos.id(photoId);
  if (!photo) {
    throw new ApiError(404, 'Photo not found');
  }

  if (photo.publicId) {
    await deleteImage(photo.publicId);
  }

  gallery.photos.pull(photoId);
  await gallery.save();

  res.json({ success: true, data: gallery });
});

exports.deleteAlbum = asyncHandler(async (req, res) => {
  const gallery = await Gallery.findById(req.params.id);
  if (!gallery) {
    throw new ApiError(404, 'Album not found');
  }

  for (const photo of gallery.photos) {
    if (photo.publicId) await deleteImage(photo.publicId);
  }

  await gallery.deleteOne();
  res.json({ success: true, message: 'Album deleted' });
});
