/**
 * Seed the database with Mood Studios catalog and test accounts.
 *
 * Usage:
 *   npm run seed         — seed only if database is empty
 *   npm run seed:fresh   — clear all collections and reseed
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { CATEGORIES, SERVICES } = require('./moodStudiosCatalog');

const User = require('../models/User');
const Category = require('../models/Category');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

const TEST_ACCOUNTS = {
  admin: {
    name: 'Studio Admin',
    email: 'admin@moodstudios.test',
    password: 'Admin123!',
    phone: '+639171234567',
    role: 'admin',
    isVerified: true,
  },
  customer: {
    name: 'Jane Customer',
    email: 'customer@moodstudios.test',
    password: 'Customer123!',
    phone: '+639189876543',
    role: 'customer',
    isVerified: true,
  },
};

const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
  console.log('Cleared all collections.');
};

const seed = async () => {
  const isFresh = process.argv.includes('--fresh');
  const userCount = await User.countDocuments();

  if (userCount > 0 && !isFresh) {
    console.log('Database already has data. Run "npm run seed:fresh" to reset and reseed.');
    console.log('Or run "npm run seed:services" to update only categories & services.');
    process.exit(0);
  }

  if (isFresh) {
    await clearDatabase();
  }

  const [admin, customer] = await User.create([TEST_ACCOUNTS.admin, TEST_ACCOUNTS.customer]);
  console.log('Created users:', admin.email, customer.email);

  const categories = await Category.insertMany(CATEGORIES.map((name) => ({ name })));
  console.log(`Created ${categories.length} categories.`);

  const serviceDocs = SERVICES.map((s) => {
    const { categoryIndex, ...rest } = s;
    return { ...rest, category: categories[categoryIndex]._id, isVisible: true };
  });
  const services = await Service.insertMany(serviceDocs);
  console.log(`Created ${services.length} services.`);

  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 14);

  const keepsake = services.find((s) => s.name === 'Keepsake');
  const sampleBooking = await Booking.create({
    userId: customer._id,
    services: [keepsake._id],
    bookingDate,
    bookingTime: '10:00 AM',
    specialRequest: 'First self-portrait session — excited to try the studio!',
    totalAmount: keepsake.price,
    bookingStatus: 'pending',
    paymentStatus: 'unpaid',
  });
  console.log('Created sample booking:', sampleBooking._id.toString());

  console.log('\n========================================');
  console.log('  Mood Studios — Seed complete');
  console.log('========================================\n');
  console.log('Catalog: 3 categories, 12 packages\n');
  console.log('Test accounts (POST /api/auth/login):\n');
  console.log('  Admin    ', TEST_ACCOUNTS.admin.email, '/', TEST_ACCOUNTS.admin.password);
  console.log('  Customer ', TEST_ACCOUNTS.customer.email, '/', TEST_ACCOUNTS.customer.password);
  console.log('\nStart the API: npm run dev\n');
};

const run = async () => {
  try {
    await connectDB();
    await seed();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

run();
