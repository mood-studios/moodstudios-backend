const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    actorEmail: { type: String, trim: true },
    action: { type: String, required: true, trim: true, index: true },
    resourceType: { type: String, trim: true, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, required: true, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
