const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const Service = require('../models/Service');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadImage } = require('../services/cloudinaryService');
const { logActivity } = require('../services/activityLogService');

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

exports.createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);
  const populated = await service.populate('category', 'name');
  await logActivity({
    req,
    action: 'service.created',
    resourceType: 'service',
    resourceId: service._id,
    summary: `Created service "${service.name}"`,
  });
  res.status(201).json({ success: true, data: populated });
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

  res.json({ success: true, data: services });
});

exports.getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id).populate('category', 'name');
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  res.json({ success: true, data: service });
});

exports.updateService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('category', 'name');

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  await logActivity({
    req,
    action: 'service.updated',
    resourceType: 'service',
    resourceId: service._id,
    summary: `Updated service "${service.name}"`,
  });
  res.json({ success: true, data: service });
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
