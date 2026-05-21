const { ZipArchive } = require('archiver');
const axios = require('axios');
const Gallery = require('../models/Gallery');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadMultiple, deleteImage } = require('../services/cloudinaryService');
const { logActivity } = require('../services/activityLogService');

const isGalleryEligibleBooking = (booking) => {
  const status = booking.bookingStatus || '';
  const pay = booking.paymentStatus || '';
  return (status === 'confirmed' || status === 'completed') && pay === 'paid';
};

const sanitizeFilename = (name) =>
  String(name || 'album')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 80) || 'album';

const assertGalleryBookingAccess = async (gallery, user) => {
  const booking = await Booking.findById(gallery.bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }
  if (user.role === 'admin') return booking;
  if (
    user.role === 'customer' &&
    booking.userId.toString() === user._id.toString()
  ) {
    return booking;
  }
  throw new ApiError(403, 'Not authorized');
};

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

  await logActivity({
    req,
    action: 'gallery.album_created',
    resourceType: 'gallery',
    resourceId: gallery._id,
    summary: `Created album "${albumName}" for booking`,
    metadata: { bookingId, albumName },
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

  await logActivity({
    req,
    action: 'gallery.photos_uploaded',
    resourceType: 'gallery',
    resourceId: gallery._id,
    summary: `Uploaded ${newPhotos.length} photo(s) to "${gallery.albumName}"`,
    metadata: { count: newPhotos.length, bookingId: gallery.bookingId },
  });

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

  if (req.user.role === 'customer' && !isGalleryEligibleBooking(booking)) {
    throw new ApiError(
      403,
      'Gallery is only available for confirmed bookings with completed payment'
    );
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

  const booking = await assertGalleryBookingAccess(gallery, req.user);
  if (req.user.role === 'customer' && !isGalleryEligibleBooking(booking)) {
    throw new ApiError(
      403,
      'Gallery is only available for confirmed bookings with completed payment'
    );
  }

  res.json({ success: true, data: gallery });
});

exports.downloadAlbum = asyncHandler(async (req, res) => {
  const gallery = await Gallery.findById(req.params.id);
  if (!gallery) {
    throw new ApiError(404, 'Album not found');
  }

  const booking = await assertGalleryBookingAccess(gallery, req.user);
  if (req.user.role === 'customer' && !isGalleryEligibleBooking(booking)) {
    throw new ApiError(
      403,
      'Gallery download is only available for confirmed bookings with completed payment'
    );
  }

  if (!gallery.photos?.length) {
    throw new ApiError(400, 'This album has no photos to download');
  }

  const safeName = sanitizeFilename(gallery.albumName);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.on('error', (err) => {
    throw err;
  });
  archive.pipe(res);

  let index = 0;
  for (const photo of gallery.photos) {
    if (!photo.url) continue;
    index += 1;
    try {
      const response = await axios.get(photo.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      const ext = photo.url.match(/\.(\w{3,4})(?:\?|$)/i)?.[1] || 'jpg';
      const base = photo.caption
        ? sanitizeFilename(photo.caption)
        : `photo-${index}`;
      archive.append(Buffer.from(response.data), { name: `${base}.${ext}` });
    } catch {
      /* skip photos that fail to fetch */
    }
  }

  await archive.finalize();
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

  await logActivity({
    req,
    action: 'gallery.photo_deleted',
    resourceType: 'gallery',
    resourceId: gallery._id,
    summary: `Removed a photo from "${gallery.albumName}"`,
  });

  res.json({ success: true, data: gallery });
});

exports.deleteAlbum = asyncHandler(async (req, res) => {
  const gallery = await Gallery.findById(req.params.id);
  if (!gallery) {
    throw new ApiError(404, 'Album not found');
  }

  await assertGalleryBookingAccess(gallery, req.user);

  for (const photo of gallery.photos) {
    if (photo.publicId) await deleteImage(photo.publicId);
  }

  await logActivity({
    req,
    action: 'gallery.album_deleted',
    resourceType: 'gallery',
    resourceId: gallery._id,
    summary: `Deleted album "${gallery.albumName}"`,
  });

  await gallery.deleteOne();
  res.json({ success: true, message: 'Album deleted' });
});
