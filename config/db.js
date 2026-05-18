const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it in Render → Environment (same value as backend/.env locally).'
    );
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    if (err.code === 8000 || err.codeName === 'AuthenticationFailed') {
      throw new Error(
        'MongoDB authentication failed — reset the DB user password in Atlas, then update MONGODB_URI on Render.'
      );
    }
    if (err.name === 'MongoServerSelectionError') {
      throw new Error(
        `MongoDB unreachable from Render — in Atlas → Network Access, allow 0.0.0.0/0 (or Render outbound IPs). ${err.message}`
      );
    }
    throw err;
  }
};

module.exports = connectDB;