/** Unpaid bookings must be paid within this window (minutes). */
const PENDING_PAYMENT_MINUTES = Number(process.env.PENDING_PAYMENT_MINUTES) || 15;

const PENDING_PAYMENT_MS = PENDING_PAYMENT_MINUTES * 60 * 1000;

function getPaymentDeadline(createdAt) {
  const base = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return new Date(base.getTime() + PENDING_PAYMENT_MS);
}

function isPaymentWindowExpired(booking) {
  const pay = booking.paymentStatus || 'unpaid';
  const status = booking.bookingStatus || 'pending';
  if (pay === 'paid' || status === 'declined') return false;
  if (!booking.createdAt) return false;
  return Date.now() > getPaymentDeadline(booking.createdAt).getTime();
}

function enrichBookingForClient(booking) {
  const doc = booking.toObject ? booking.toObject() : { ...booking };
  const pay = doc.paymentStatus || 'unpaid';
  const status = doc.bookingStatus || 'pending';

  if (pay !== 'paid' && status !== 'declined' && doc.createdAt) {
    doc.paymentDeadlineAt = getPaymentDeadline(doc.createdAt).toISOString();
    doc.paymentHoldMinutes = PENDING_PAYMENT_MINUTES;
  }

  return doc;
}

async function getCombinedPaymentDeadline(bookingIds) {
  const Booking = require('../models/Booking');
  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .select('createdAt paymentStatus bookingStatus')
    .lean();

  let earliest = null;
  for (const b of bookings) {
    if (b.paymentStatus === 'paid' || b.bookingStatus === 'declined') continue;
    if (!b.createdAt) continue;
    const deadline = getPaymentDeadline(b.createdAt);
    if (!earliest || deadline < earliest) earliest = deadline;
  }

  return earliest ? earliest.toISOString() : null;
}

module.exports = {
  PENDING_PAYMENT_MINUTES,
  PENDING_PAYMENT_MS,
  getPaymentDeadline,
  isPaymentWindowExpired,
  enrichBookingForClient,
  getCombinedPaymentDeadline,
};
