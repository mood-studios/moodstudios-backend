const Booking = require('../models/Booking');
const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');
const schedule = require('../config/bookingSchedule');

const BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

/**
 * Parse "10:00 AM", "2:30 PM", or "14:00" → minutes from midnight.
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }

  return null;
};

const minutesToLabel = (minutes) => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
};

const minutesToValue = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const startOfDay = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(23, 59, 59, 999);
  return d;
};

const generateSlotStarts = () => {
  const slots = [];
  const open = schedule.OPEN_HOUR * 60;
  const close = schedule.CLOSE_HOUR * 60;
  for (let m = open; m < close; m += schedule.SLOT_INTERVAL_MINUTES) {
    slots.push(m);
  }
  return slots;
};

const getBookingDurationMinutes = async (booking) => {
  if (!booking.services?.length) return schedule.SLOT_INTERVAL_MINUTES;
  const ids = booking.services.map((s) => (s._id ? s._id : s));
  const services = await Service.find({ _id: { $in: ids } });
  const total = services.reduce((sum, s) => sum + (s.duration || 60), 0);
  return Math.max(total, schedule.SLOT_INTERVAL_MINUTES);
};

const rangesOverlap = (startA, durationA, startB, durationB) => {
  const endA = startA + durationA;
  const endB = startB + durationB;
  return startA < endB && startB < endA;
};

const getBookedRangesForDate = async (date, excludeBookingId) => {
  const bookings = await Booking.find({
    bookingDate: { $gte: startOfDay(date), $lte: endOfDay(date) },
    bookingStatus: { $in: BLOCKING_STATUSES },
  }).populate('services', 'duration');

  const ranges = [];
  for (const b of bookings) {
    if (excludeBookingId && b._id.toString() === String(excludeBookingId)) continue;
    const start = parseTimeToMinutes(b.bookingTime);
    if (start === null) continue;
    const duration = await getBookingDurationMinutes(b);
    ranges.push({ start, duration, bookingId: b._id.toString() });
  }
  return ranges;
};

const isSlotAvailable = (slotStartMinutes, durationMinutes, bookedRanges) => {
  const closeMinutes = schedule.CLOSE_HOUR * 60;
  if (slotStartMinutes + durationMinutes > closeMinutes) {
    return false;
  }

  let overlapCount = 0;
  for (const range of bookedRanges) {
    if (rangesOverlap(slotStartMinutes, durationMinutes, range.start, range.duration)) {
      overlapCount += 1;
      if (overlapCount >= schedule.MAX_BOOKINGS_PER_SLOT) {
        return false;
      }
    }
  }
  return true;
};

const assertDateBookable = (date) => {
  const day = startOfDay(date);
  const today = startOfDay(new Date());
  if (day < today) {
    throw new ApiError(400, 'Cannot book a date in the past');
  }
  if (schedule.CLOSED_WEEKDAYS.includes(day.getDay())) {
    throw new ApiError(400, 'Studio is closed on this day');
  }
};

exports.getAvailability = async (date, durationMinutes, excludeBookingId) => {
  assertDateBookable(date);
  const duration = Math.max(durationMinutes || 60, schedule.SLOT_INTERVAL_MINUTES);
  const bookedRanges = await getBookedRangesForDate(date, excludeBookingId);
  const now = new Date();
  const isToday = startOfDay(date).getTime() === startOfDay(now).getTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slots = generateSlotStarts().map((startMinutes) => {
    let available = isSlotAvailable(startMinutes, duration, bookedRanges);
    if (isToday && startMinutes <= currentMinutes) {
      available = false;
    }
    return {
      time: minutesToLabel(startMinutes),
      value: minutesToValue(startMinutes),
      available,
    };
  });

  return {
    date: startOfDay(date).toISOString(),
    durationMinutes: duration,
    slots,
  };
};

exports.assertSlotAvailable = async (date, bookingTime, durationMinutes, excludeBookingId) => {
  assertDateBookable(date);
  const startMinutes = parseTimeToMinutes(bookingTime);
  if (startMinutes === null) {
    throw new ApiError(400, 'Invalid booking time format');
  }

  const duration = Math.max(durationMinutes || 60, schedule.SLOT_INTERVAL_MINUTES);
  const bookedRanges = await getBookedRangesForDate(date, excludeBookingId);

  if (!isSlotAvailable(startMinutes, duration, bookedRanges)) {
    throw new ApiError(
      409,
      'This time slot is no longer available. Please choose another date or time.'
    );
  }

  const now = new Date();
  if (startOfDay(date).getTime() === startOfDay(now).getTime() && startMinutes <= now.getHours() * 60 + now.getMinutes()) {
    throw new ApiError(400, 'Cannot book a time that has already passed today');
  }

  return minutesToLabel(startMinutes);
};

exports.getTotalDurationForServices = async (serviceIds) => {
  const services = await Service.find({ _id: { $in: serviceIds } });
  const total = services.reduce((sum, s) => sum + (s.duration || 60), 0);
  return Math.max(total, schedule.SLOT_INTERVAL_MINUTES);
};
