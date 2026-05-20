const FeaturedPhoto = require('../models/FeaturedPhoto');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

const MAX_FEATURED = 12;

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  const seen = new Set();
  const items = [];

  for (const item of photos) {
    const url = typeof item === 'string' ? item.trim() : item?.url?.trim?.();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const isVisible =
      typeof item === 'object' && item !== null && item.isVisible !== undefined
        ? Boolean(item.isVisible)
        : true;
    items.push({ url, isVisible });
    if (items.length >= MAX_FEATURED) break;
  }

  return items;
}

exports.listFeaturedPhotos = asyncHandler(async (req, res) => {
  const filter = req.query.visibleOnly === 'true' ? { isVisible: true } : {};
  const photos = await FeaturedPhoto.find(filter).sort({ sortOrder: 1, createdAt: 1 });
  res.json({ success: true, data: photos });
});

exports.syncFeaturedPhotos = asyncHandler(async (req, res) => {
  const items = normalizePhotos(req.body.photos);

  await FeaturedPhoto.deleteMany({});
  if (items.length) {
    await FeaturedPhoto.insertMany(
      items.map((item, index) => ({
        url: item.url,
        isVisible: item.isVisible,
        sortOrder: index,
      }))
    );
  }

  const photos = await FeaturedPhoto.find().sort({ sortOrder: 1, createdAt: 1 });
  const visibleCount = photos.filter((p) => p.isVisible).length;

  await logActivity({
    req,
    action: 'featured_photos.updated',
    resourceType: 'featured_photo',
    summary: `Updated landing featured photos (${visibleCount} visible)`,
    metadata: { count: photos.length, visibleCount },
  });

  res.json({ success: true, data: photos });
});

exports.toggleVisibility = asyncHandler(async (req, res) => {
  const photo = await FeaturedPhoto.findById(req.params.id);
  if (!photo) {
    throw new ApiError(404, 'Featured photo not found');
  }

  photo.isVisible = !photo.isVisible;
  await photo.save();

  await logActivity({
    req,
    action: 'featured_photo.visibility_toggled',
    resourceType: 'featured_photo',
    resourceId: photo._id,
    summary: `Featured photo is now ${photo.isVisible ? 'visible' : 'hidden'}`,
  });

  res.json({ success: true, data: photo });
});
