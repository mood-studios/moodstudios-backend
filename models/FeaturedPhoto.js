const mongoose = require('mongoose');

const featuredPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

featuredPhotoSchema.index({ sortOrder: 1 });

module.exports = mongoose.model('FeaturedPhoto', featuredPhotoSchema);
