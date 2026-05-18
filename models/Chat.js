const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
