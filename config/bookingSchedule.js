/**
 * Studio operating hours and slot settings.
 * Adjust OPEN_HOUR / CLOSE_HOUR for your studio schedule.
 */
module.exports = {
  OPEN_HOUR: 9,
  CLOSE_HOUR: 18,
  SLOT_INTERVAL_MINUTES: 30,
  MAX_BOOKINGS_PER_SLOT: 1,
  // Days closed: 0 = Sunday, 6 = Saturday
  CLOSED_WEEKDAYS: [],
};
