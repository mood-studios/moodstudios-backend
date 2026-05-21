const mongoose = require('mongoose');

const blockedDaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true },
    reason: { type: String, trim: true, default: '' },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlockedDay', blockedDaySchema);
