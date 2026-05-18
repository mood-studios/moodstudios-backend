const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);
  const populated = await service.populate('category', 'name');
  res.status(201).json({ success: true, data: populated });
});

exports.getServices = asyncHandler(async (req, res) => {
  const { category, visibleOnly } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (req.user?.role !== 'admin' || visibleOnly === 'true') {
    filter.isVisible = true;
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
  res.json({ success: true, data: service });
});

exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
  res.json({ success: true, message: 'Service deleted' });
});

exports.toggleVisibility = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  service.isVisible = !service.isVisible;
  await service.save();

  res.json({ success: true, data: service });
});
