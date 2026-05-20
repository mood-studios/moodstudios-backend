/**
 * Backfill samplePhotos from legacy image-only service documents.
 *
 * Usage: npm run migrate:service-photos
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Service = require('../models/Service');

const run = async () => {
  await connectDB();

  const services = await Service.find({});
  let updated = 0;

  for (const service of services) {
    const photos = (service.samplePhotos || []).filter(Boolean);
    let changed = false;

    if (!photos.length && service.image) {
      service.samplePhotos = [service.image];
      changed = true;
    } else if (photos.length && service.image !== photos[0]) {
      service.image = photos[0];
      changed = true;
    }

    if (changed) {
      await service.save();
      updated += 1;
      console.log(`Updated "${service.name}" → ${service.samplePhotos.length} photo(s)`);
    }
  }

  console.log(`Done. ${updated} of ${services.length} service(s) updated.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
