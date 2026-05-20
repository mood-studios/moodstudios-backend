const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const Service = require('../models/Service');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadImage } = require('../services/cloudinaryService');
const { logActivity } = require('../services/activityLogService');

/** Ensure API consumers always get samplePhotos (legacy docs may only have image). */
function enrichService(service) {
  const doc = service.toObject ? service.toObject() : { ...service };
  const photos = Array.isArray(doc.samplePhotos)
    ? doc.samplePhotos.filter((url) => typeof url === 'string' && url.trim())
    : [];
  if (!photos.length && doc.image) {
    doc.samplePhotos = [doc.image];
  }
  return doc;
}

/** Merge image + samplePhotos into one array; image is always the first photo. */
function normalizeServicePayload(body, existing = null) {
  const payload = {
    name: body.name !== undefined ? body.name : existing?.name,
    description: body.description !== undefined ? body.description : existing?.description,
    price: body.price !== undefined ? body.price : existing?.price,
    duration: body.duration !== undefined ? body.duration : existing?.duration,
    category: body.category !== undefined ? body.category : existing?.category,
  };

  if (body.isVisible !== undefined) {
    payload.isVisible = body.isVisible;
  } else if (existing) {
    payload.isVisible = existing.isVisible;
  }

  let fromArray;
  if (Array.isArray(body.samplePhotos)) {
    fromArray = body.samplePhotos.filter((url) => typeof url === 'string' && url.trim());
  } else if (existing?.samplePhotos?.length) {
    fromArray = [...existing.samplePhotos];
  } else {
    fromArray = [];
  }

  const photos = [...new Set(fromArray.map((url) => url.trim()))];

  const cover =
    typeof body.image === 'string' && body.image.trim() ? body.image.trim() : '';
  if (cover && !photos.includes(cover)) {
    photos.unshift(cover);
  }

  payload.samplePhotos = photos;
  if (photos.length) {
    payload.image = photos[0];
  } else if (cover) {
    payload.image = cover;
    payload.samplePhotos = [cover];
  } else {
    payload.image = '';
    payload.samplePhotos = [];
  }

  return payload;
}

const saveLocalServiceImage = async (file, req) => {
  const dir = path.join(__dirname, '../uploads/services');
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, filename), file.buffer);
  const base = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  return { url: `${base}/uploads/services/${filename}` };
};

exports.uploadServiceImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Image file is required');
  }

  let result;
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    result = await uploadImage(req.file, 'mood-studios/services');
  } else if (process.env.NODE_ENV === 'development') {
    result = await saveLocalServiceImage(req.file, req);
  } else {
    throw new ApiError(503, 'Image upload is not configured. Set Cloudinary credentials.');
  }

  await logActivity({
    req,
    action: 'service.image_uploaded',
    resourceType: 'service',
    summary: 'Uploaded service image',
    metadata: { url: result.url },
  });

  res.json({ success: true, data: { url: result.url } });
});

exports.uploadServiceImages = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files?.length) {
    throw new ApiError(400, 'At least one image file is required');
  }

  const urls = [];
  for (const file of files) {
    let result;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      result = await uploadImage(file, 'mood-studios/services');
    } else if (process.env.NODE_ENV === 'development') {
      result = await saveLocalServiceImage(file, req);
    } else {
      throw new ApiError(503, 'Image upload is not configured. Set Cloudinary credentials.');
    }
    urls.push(result.url);
  }

  await logActivity({
    req,
    action: 'service.images_uploaded',
    resourceType: 'service',
    summary: `Uploaded ${urls.length} service image(s)`,
    metadata: { count: urls.length },
  });

  res.json({ success: true, data: { urls } });
});

exports.createService = asyncHandler(async (req, res) => {
  const service = await Service.create(normalizeServicePayload(req.body));
  const populated = await service.populate('category', 'name');
  await logActivity({
    req,
    action: 'service.created',
    resourceType: 'service',
    resourceId: service._id,
    summary: `Created service "${service.name}"`,
  });
  res.status(201).json({ success: true, data: enrichService(populated) });
});

exports.getServices = asyncHandler(async (req, res) => {
  const { category, visibleOnly, search } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (req.user?.role !== 'admin' || visibleOnly === 'true') {
    filter.isVisible = true;
  }

  if (search?.trim()) {
    const regex = { $regex: search.trim(), $options: 'i' };
    const categoryIds = await Category.find({ name: regex }).distinct('_id');
    const searchOr = [{ name: regex }, { description: regex }];
    if (categoryIds.length) searchOr.push({ category: { $in: categoryIds } });
    filter.$and = [...(filter.$and || []), { $or: searchOr }];
  }

  const services = await Service.find(filter)
    .populate('category', 'name')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: services.map(enrichService) });
});

exports.getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id).populate('category', 'name');
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  res.json({ success: true, data: enrichService(service) });
});

exports.updateService = asyncHandler(async (req, res) => {
  const existing = await Service.findById(req.params.id);
  if (!existing) {
    throw new ApiError(404, 'Service not found');
  }

  const service = await Service.findByIdAndUpdate(
    req.params.id,
    normalizeServicePayload(req.body, existing),
    { new: true, runValidators: true }
  ).populate('category', 'name');

  await logActivity({
    req,
    action: 'service.updated',
    resourceType: 'service',
    resourceId: service._id,
    summary: `Updated service "${service.name}"`,
    metadata: { samplePhotoCount: service.samplePhotos?.length || 0 },
  });
  res.json({ success: true, data: enrichService(service) });
});

exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  await logActivity({
    req,
    action: 'service.deleted',
    resourceType: 'service',
    resourceId: service._id,
    summary: `Deleted service "${service.name}"`,
  });
  res.json({ success: true, message: 'Service deleted' });
});

exports.toggleVisibility = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  service.isVisible = !service.isVisible;
  await service.save();

  await logActivity({
    req,
    action: 'service.visibility_toggled',
    resourceType: 'service',
    resourceId: service._id,
    summary: `Service "${service.name}" is now ${service.isVisible ? 'visible' : 'hidden'}`,
  });

  res.json({ success: true, data: service });
});
