const BlockedDay = require('../models/BlockedDay');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');

const parseDay = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return null;
  return new Date(`${match[0]}T00:00:00.000Z`);
};

/** Public list of blocked dates (YYYY-MM-DD) for booking UIs — no auth. */
exports.listPublicBlockedDays = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setUTCMonth(max.getUTCMonth() + 3);

  const days = await BlockedDay.find({ date: { $gte: today, $lte: max } })
    .select('date')
    .sort({ date: 1 });

  res.json({
    success: true,
    data: days.map((d) => d.date.toISOString().slice(0, 10)),
  });
});

exports.listBlockedDays = asyncHandler(async (req, res) => {
  const from = parseDay(req.query.from);
  const to = parseDay(req.query.to);
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const days = await BlockedDay.find(filter)
    .populate('blockedBy', 'name email')
    .sort({ date: 1 });

  res.json({ success: true, data: days });
});

exports.blockDay = asyncHandler(async (req, res) => {
  const day = parseDay(req.body.date);
  if (!day) {
    throw new ApiError(400, 'date is required (YYYY-MM-DD)');
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (day < today) {
    throw new ApiError(400, 'Cannot block a date in the past');
  }

  const existing = await BlockedDay.findOne({ date: day });
  if (existing) {
    throw new ApiError(409, 'This date is already blocked');
  }

  const blocked = await BlockedDay.create({
    date: day,
    reason: req.body.reason?.trim() || '',
    blockedBy: req.user._id,
  });

  await logActivity({
    req,
    action: 'blocked_day.create',
    resourceType: 'blocked_day',
    resourceId: blocked._id,
    summary: `Blocked ${req.body.date}`,
    metadata: { date: req.body.date, reason: blocked.reason },
  });

  res.status(201).json({ success: true, data: blocked });
});

exports.unblockDay = asyncHandler(async (req, res) => {
  const blocked = await BlockedDay.findById(req.params.id);
  if (!blocked) {
    throw new ApiError(404, 'Blocked day not found');
  }

  await blocked.deleteOne();

  await logActivity({
    req,
    action: 'blocked_day.delete',
    resourceType: 'blocked_day',
    resourceId: blocked._id,
    summary: `Unblocked ${blocked.date.toISOString().slice(0, 10)}`,
  });

  res.json({ success: true, message: 'Date unblocked' });
});
