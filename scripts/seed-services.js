/**
 * Sync Mood Studios service catalog without deleting users or bookings.
 *
 * Usage: npm run seed:services
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { CATEGORIES, SERVICES } = require('./moodStudiosCatalog');
const Category = require('../models/Category');
const Service = require('../models/Service');

const sync = async () => {
  const categories = [];
  for (const name of CATEGORIES) {
    let cat = await Category.findOne({ name });
    if (!cat) cat = await Category.create({ name });
    categories.push(cat);
  }

  let created = 0;
  let updated = 0;

  for (const pkg of SERVICES) {
    const category = categories[pkg.categoryIndex];
    const existing = await Service.findOne({ name: pkg.name, category: category._id });

    const data = {
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      duration: pkg.duration,
      category: category._id,
      isVisible: true,
    };

    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      updated++;
    } else {
      await Service.create(data);
      created++;
    }
  }

  console.log(`Catalog sync done. Created: ${created}, Updated: ${updated}`);
};

const run = async () => {
  try {
    await connectDB();
    await sync();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err.message);
    process.exit(1);
  }
};

run();
