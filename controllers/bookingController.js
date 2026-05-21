const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Service = require('../models/Service');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyBookingUpdate, createNotification } = require('../services/notificationService');
const {
  getAvailability,
  assertSlotAvailable,
  getTotalDurationForServices,
} = require('../services/bookingAvailabilityService');
const { logActivity } = require('../services/activityLogService');

const calculateTotal = async (serviceIds) => {
  const services = await Service.find({ _id: { $in: serviceIds }, isVisible: true });
  if (services.length !== serviceIds.length) {
    throw new ApiError(400, 'One or more services are invalid or hidden');
  }
  return services.reduce((sum, s) => sum + s.price, 0);
};

exports.getAvailability = asyncHandler(async (req, res) => {
  const { date, durationMinutes, excludeBookingId } = req.query;
  if (!date) {
    throw new ApiError(400, 'date query parameter is required (YYYY-MM-DD)');
  }

  const data = await getAvailability(
    date,
    Number(durationMinutes) || 60,
    excludeBookingId || undefined
  );
  res.json({ success: true, data });
});

exports.createBooking = asyncHandler(async (req, res) => {
  const { services, bookingDate, bookingTime, specialRequest } = req.body;

  if (!services?.length) {
    throw new ApiError(400, 'At least one service is required');
  }

  const totalAmount = await calculateTotal(services);
  const durationMinutes = await getTotalDurationForServices(services);
  const normalizedTime = await assertSlotAvailable(bookingDate, bookingTime, durationMinutes);

  const booking = await Booking.create({
    userId: req.user._id,
    services,
    bookingDate,
    bookingTime: normalizedTime,
    specialRequest,
    totalAmount,
  });

  const populated = await booking.populate([
    { path: 'services', select: 'name price duration' },
    { path: 'userId', select: 'name email phone' },
  ]);

  res.status(201).json({ success: true, data: populated });
});

exports.getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .populate('services', 'name price duration image samplePhotos description')
    .sort({ createdAt: -1 });

  const needsSync = bookings.filter((b) => b.paymentStatus !== 'paid');
  if (needsSync.length) {
    const succeeded = await Payment.find({
      bookingId: { $in: needsSync.map((b) => b._id) },
      status: 'succeeded',
    });
    const paidBookingIds = new Set(succeeded.map((p) => p.bookingId.toString()));

    for (const booking of bookings) {
      if (!paidBookingIds.has(booking._id.toString())) continue;
      booking.paymentStatus = 'paid';
      if (booking.bookingStatus === 'pending') {
        booking.bookingStatus = 'confirmed';
      }
      await booking.save();
    }
  }

  res.json({ success: true, data: bookings });
});

function bookingDateRangeFilter(date, dateFrom, dateTo) {
  const day = (value) => {
    if (!value || typeof value !== 'string') return null;
    const match = value.trim().match(/^\d{4}-\d{2}-\d{2}$/);
    if (!match) return null;
    return new Date(`${match[0]}T00:00:00.000Z`);
  };

  const single = day(date);
  if (single) {
    const end = new Date(single);
    end.setUTCDate(end.getUTCDate() + 1);
    return { $gte: single, $lt: end };
  }

  const range = {};
  const from = day(dateFrom);
  const to = day(dateTo);
  if (from) range.$gte = from;
  if (to) {
    const end = new Date(to);
    end.setUTCDate(end.getUTCDate() + 1);
    range.$lt = end;
  }
  return Object.keys(range).length ? range : null;
}

exports.getAllBookings = asyncHandler(async (req, res) => {
  const { status, paymentStatus, search, date, dateFrom, dateTo } = req.query;
  const filter = {};
  if (status) filter.bookingStatus = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const bookingDateFilter = bookingDateRangeFilter(date, dateFrom, dateTo);
  if (bookingDateFilter) filter.bookingDate = bookingDateFilter;

  if (search?.trim()) {
    const regex = { $regex: search.trim(), $options: 'i' };
    const [userIds, serviceIds] = await Promise.all([
      User.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] }).distinct('_id'),
      Service.find({ name: regex }).distinct('_id'),
    ]);
    const searchOr = [{ bookingTime: regex }, { specialRequest: regex }];
    if (userIds.length) searchOr.push({ userId: { $in: userIds } });
    if (serviceIds.length) searchOr.push({ services: { $in: serviceIds } });
    filter.$or = searchOr;
  }

  const bookings = await Booking.find(filter)
    .populate('userId', 'name email phone')
    .populate('services', 'name price duration image samplePhotos')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: bookings });
});

exports.getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'name email phone')
    .populate('services', 'name price duration image samplePhotos description');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (
    req.user.role === 'customer' &&
    booking.userId._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, 'Not authorized to view this booking');
  }

  res.json({ success: true, data: booking });
});

exports.updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'declined', 'completed'];

  if (!allowed.includes(status)) {
    throw new ApiError(400, 'Invalid booking status');
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  booking.bookingStatus = status;
  await booking.save();

  await notifyBookingUpdate(booking.userId, booking, status);

  await logActivity({
    req,
    action: 'booking.status_updated',
    resourceType: 'booking',
    resourceId: booking._id,
    summary: `Booking marked as ${status}`,
    metadata: { status, bookingId: booking._id },
  });

  const populated = await booking.populate([
    { path: 'services', select: 'name price' },
    { path: 'userId', select: 'name email' },
  ]);

  res.json({ success: true, data: populated });
});

exports.rescheduleBooking = asyncHandler(async (req, res) => {
  const { bookingDate, bookingTime } = req.body;
  const booking = await Booking.findById(req.params.id).populate('services', 'duration name');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.bookingStatus === 'declined') {
    throw new ApiError(400, 'Cannot reschedule a declined booking');
  }

  const serviceIds = booking.services.map((s) => s._id);
  const durationMinutes = await getTotalDurationForServices(serviceIds);
  const normalizedTime = await assertSlotAvailable(
    bookingDate,
    bookingTime,
    durationMinutes,
    booking._id
  );

  const previousDate = booking.bookingDate;
  const previousTime = booking.bookingTime;

  booking.bookingDate = bookingDate;
  booking.bookingTime = normalizedTime;
  await booking.save();

  await createNotification({
    userId: booking.userId,
    title: 'Booking Rescheduled',
    message: `Your session was moved to ${normalizedTime} on ${new Date(bookingDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
    type: 'booking',
    referenceId: booking._id,
  });

  await logActivity({
    req,
    action: 'booking.rescheduled',
    resourceType: 'booking',
    resourceId: booking._id,
    summary: `Rescheduled booking to ${normalizedTime}`,
    metadata: {
      previousDate,
      previousTime,
      bookingDate,
      bookingTime: normalizedTime,
    },
  });

  const populated = await booking.populate([
    { path: 'services', select: 'name price duration' },
    { path: 'userId', select: 'name email phone' },
  ]);

  res.json({ success: true, data: populated });
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (booking.bookingStatus !== 'pending') {
    throw new ApiError(400, 'Only pending bookings can be cancelled');
  }

  booking.bookingStatus = 'declined';
  await booking.save();

  res.json({ success: true, message: 'Booking cancelled', data: booking });
});
