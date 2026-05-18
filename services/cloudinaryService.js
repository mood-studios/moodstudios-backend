const { cloudinary } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

const uploadToCloudinary = (buffer, folder = 'mood-studios/gallery') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const uploadImage = async (file, folder) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new ApiError(503, 'Cloudinary is not configured');
  }
  const result = await uploadToCloudinary(file.buffer, folder);
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

const uploadMultiple = async (files, folder) => {
  return Promise.all(files.map((f) => uploadImage(f, folder)));
};

const deleteImage = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
};

module.exports = { uploadImage, uploadMultiple, deleteImage };
