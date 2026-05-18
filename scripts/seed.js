/**
 * Seed the database with sample data for local testing.
 *
 * Usage:
 *   npm run seed         — seed only if database is empty
 *   npm run seed:fresh   — clear all collections and reseed
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

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

const CATEGORIES = [
  { name: 'Portrait' },
  { name: 'Wedding' },
  { name: 'Events' },
  { name: 'Product' },
];

const SERVICES = [
  {
    name: 'Basic Portrait Session',
    description: '1-hour studio portrait session with 10 edited photos.',
    price: 3500,
    duration: 60,
    categoryIndex: 0,
    isVisible: true,
  },
  {
    name: 'Premium Portrait Session',
    description: '2-hour session with wardrobe changes and 25 edited photos.',
    price: 6500,
    duration: 120,
    categoryIndex: 0,
    isVisible: true,
  },
  {
    name: 'Wedding Package — Essential',
    description: 'Full-day coverage, 300+ edited photos, online gallery.',
    price: 45000,
    duration: 480,
    categoryIndex: 1,
    isVisible: true,
  },
  {
    name: 'Wedding Package — Premium',
    description: 'Full-day coverage, second shooter, album, engagement shoot.',
    price: 75000,
    duration: 600,
    categoryIndex: 1,
    isVisible: true,
  },
  {
    name: 'Corporate Event Coverage',
    description: 'Half-day event photography with same-day highlights.',
    price: 12000,
    duration: 240,
    categoryIndex: 2,
    isVisible: true,
  },
  {
    name: 'Product Shoot — Starter',
    description: 'Up to 10 products on white background, web-ready files.',
    price: 5000,
    duration: 90,
    categoryIndex: 3,
    isVisible: true,
  },
];

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
    process.exit(0);
  }

  if (isFresh) {
    await clearDatabase();
  }

  const [admin, customer] = await User.create([TEST_ACCOUNTS.admin, TEST_ACCOUNTS.customer]);
  console.log('Created users:', admin.email, customer.email);

  const categories = await Category.insertMany(CATEGORIES);
  console.log(`Created ${categories.length} categories.`);

  const serviceDocs = SERVICES.map((s) => {
    const { categoryIndex, ...rest } = s;
    return { ...rest, category: categories[categoryIndex]._id };
  });
  const services = await Service.insertMany(serviceDocs);
  console.log(`Created ${services.length} services.`);

  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 14);

  const sampleBooking = await Booking.create({
    userId: customer._id,
    services: [services[0]._id, services[5]._id],
    bookingDate,
    bookingTime: '10:00 AM',
    specialRequest: 'Please use natural lighting if possible.',
    totalAmount: services[0].price + services[5].price,
    bookingStatus: 'pending',
    paymentStatus: 'unpaid',
  });
  console.log('Created sample booking:', sampleBooking._id.toString());

  console.log('\n========================================');
  console.log('  Mood Studios — Seed complete');
  console.log('========================================\n');
  console.log('Test accounts (use with POST /api/auth/login):\n');
  console.log('  Admin');
  console.log(`    Email:    ${TEST_ACCOUNTS.admin.email}`);
  console.log(`    Password: ${TEST_ACCOUNTS.admin.password}\n`);
  console.log('  Customer');
  console.log(`    Email:    ${TEST_ACCOUNTS.customer.email}`);
  console.log(`    Password: ${TEST_ACCOUNTS.customer.password}\n`);
  console.log('Quick tests:\n');
  console.log('  GET  http://localhost:5000/api/health');
  console.log('  GET  http://localhost:5000/api/categories');
  console.log('  GET  http://localhost:5000/api/services');
  console.log('  POST http://localhost:5000/api/auth/login');
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
