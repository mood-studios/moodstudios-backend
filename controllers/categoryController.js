const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

exports.createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  await logActivity({
    req,
    action: 'category.created',
    resourceType: 'category',
    resourceId: category._id,
    summary: `Created category "${category.name}"`,
  });
  res.status(201).json({ success: true, data: category });
});

exports.getCategories = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search?.trim()) {
    filter.name = { $regex: search.trim(), $options: 'i' };
  }
  const categories = await Category.find(filter).sort({ name: 1 });
  res.json({ success: true, data: categories });
});

exports.getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  res.json({ success: true, data: category });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  await logActivity({
    req,
    action: 'category.updated',
    resourceType: 'category',
    resourceId: category._id,
    summary: `Updated category "${category.name}"`,
  });
  res.json({ success: true, data: category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  await logActivity({
    req,
    action: 'category.deleted',
    resourceType: 'category',
    resourceId: category._id,
    summary: `Deleted category "${category.name}"`,
  });
  res.json({ success: true, message: 'Category deleted' });
});
