const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../utils/asyncHandler');

exports.getActivityLogs = asyncHandler(async (req, res) => {
  const {
    action,
    resourceType,
    actorId,
    search,
    from,
    to,
    page = 1,
    limit = 30,
  } = req.query;

  const filter = {};

  if (action) filter.action = action;
  if (resourceType) filter.resourceType = resourceType;
  if (actorId) filter.actorId = actorId;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  if (search) {
    const regex = { $regex: search, $options: 'i' };
    filter.$or = [{ summary: regex }, { actorName: regex }, { actorEmail: regex }];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    ActivityLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
    },
  });
});

exports.getActivityActions = asyncHandler(async (req, res) => {
  const actions = await ActivityLog.distinct('action');
  const resourceTypes = await ActivityLog.distinct('resourceType');
  res.json({ success: true, data: { actions, resourceTypes } });
});
