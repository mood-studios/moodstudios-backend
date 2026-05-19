const ActivityLog = require('../models/ActivityLog');

const clientIp = (req) => {
  if (!req) return undefined;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip;
};

/** Fire-and-forget admin activity log (never throws to callers). */
const logActivity = async ({
  req,
  actor,
  action,
  resourceType,
  resourceId,
  summary,
  metadata = {},
}) => {
  const user = actor || req?.user;
  if (!user) return;

  try {
    await ActivityLog.create({
      actorId: user._id,
      actorName: user.name,
      actorEmail: user.email,
      action,
      resourceType,
      resourceId,
      summary,
      metadata,
      ip: clientIp(req),
      userAgent: req?.get?.('user-agent'),
    });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
};

module.exports = { logActivity };
