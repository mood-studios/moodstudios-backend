const mongoose = require('mongoose');

const contactFormSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const checkoutPaymentSchema = new mongoose.Schema(
  {
    bookingIds: [{ type: String }],
    selectedCartIndices: [{ type: Number }],
    totalAmount: { type: Number },
  },
  { _id: false }
);

const bookingDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cart: { type: Array, default: [] },
    selectedIndices: { type: [Number], default: [] },
    contactForm: { type: contactFormSchema, default: () => ({}) },
    checkoutPayment: { type: checkoutPaymentSchema, default: () => ({}) },
    paymentSession: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BookingDraft', bookingDraftSchema);
