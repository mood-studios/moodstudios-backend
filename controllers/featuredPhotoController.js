const FeaturedPhoto = require('../models/FeaturedPhoto');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

const MAX_FEATURED = 12;

function normalizeUrls(photos) {
  if (!Array.isArray(photos)) return [];
  const seen = new Set();
  const urls = [];
  for (const item of photos) {
    const url = typeof item === 'string' ? item.trim() : item?.url?.trim?.();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_FEATURED) break;
  }
  return urls;
}

exports.listFeaturedPhotos = asyncHandler(async (req, res) => {
  const photos = await FeaturedPhoto.find().sort({ sortOrder: 1, createdAt: 1 });
  res.json({ success: true, data: photos });
});

exports.syncFeaturedPhotos = asyncHandler(async (req, res) => {
  const urls = normalizeUrls(req.body.photos);

  await FeaturedPhoto.deleteMany({});
  if (urls.length) {
    await FeaturedPhoto.insertMany(
      urls.map((url, index) => ({ url, sortOrder: index }))
    );
  }

  const photos = await FeaturedPhoto.find().sort({ sortOrder: 1, createdAt: 1 });

  await logActivity({
    req,
    action: 'featured_photos.updated',
    resourceType: 'featured_photo',
    summary: `Updated landing featured photos (${photos.length})`,
    metadata: { count: photos.length },
  });

  res.json({ success: true, data: photos });
});
