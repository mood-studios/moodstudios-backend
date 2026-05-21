const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { PENDING_PAYMENT_MINUTES, PENDING_PAYMENT_MS } = require('../config/bookingPayment');

/** Check for expired unpaid bookings every minute (15-minute payment window). */
const EXPIRED_BOOKING_CHECK_INTERVAL_MS = 60 * 1000;

let expiryRunning = false;

function getExpiryCutoff() {
  return new Date(Date.now() - PENDING_PAYMENT_MS);
}

/**
 * Decline bookings that were never paid within the payment window.
 */
async function expireUnpaidBookings() {
  if (expiryRunning) {
    return { expired: 0, skipped: true };
  }

  expiryRunning = true;
  try {
    const cutoff = getExpiryCutoff();

    const bookings = await Booking.find({
      bookingStatus: 'pending',
      paymentStatus: { $in: ['unpaid', 'pending'] },
      createdAt: { $lte: cutoff },
    })
      .select('_id userId paymentStatus')
      .lean();

    if (!bookings.length) {
      return { expired: 0 };
    }

    const bookingIds = bookings.map((b) => b._id);

    await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { $set: { bookingStatus: 'declined', paymentStatus: 'failed' } }
    );

    await Payment.updateMany(
      { bookingId: { $in: bookingIds }, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );

    const message = `Your booking was automatically cancelled because payment was not completed within ${PENDING_PAYMENT_MINUTES} minutes.`;

    await Notification.insertMany(
      bookings.map((b) => ({
        userId: b.userId,
        title: 'Booking cancelled',
        message,
        type: 'booking',
        referenceId: b._id,
      }))
    );

    return { expired: bookings.length };
  } finally {
    expiryRunning = false;
  }
}

function startExpiredBookingJob() {
  const run = async () => {
    try {
      const { expired, skipped } = await expireUnpaidBookings();
      if (expired > 0) {
        console.log(
          `[bookings] Auto-cancelled ${expired} booking(s) (unpaid > ${PENDING_PAYMENT_MINUTES} min)`
        );
      } else if (skipped) {
        console.log('[bookings] Expire job skipped (already running)');
      }
    } catch (err) {
      console.error('[bookings] Expire unpaid bookings job failed:', err.message);
    }
  };

  run();
  return setInterval(run, EXPIRED_BOOKING_CHECK_INTERVAL_MS);
}

module.exports = {
  expireUnpaidBookings,
  startExpiredBookingJob,
  getExpiryMinutes: () => PENDING_PAYMENT_MINUTES,
};
