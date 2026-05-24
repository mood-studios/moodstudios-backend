const BookingDraft = require('../models/BookingDraft');
const asyncHandler = require('../utils/asyncHandler');

const emptyDraft = () => ({
  cart: [],
  selectedIndices: [],
  contactForm: {},
  checkoutPayment: {},
  paymentSession: null,
});

exports.getMyDraft = asyncHandler(async (req, res) => {
  const draft = await BookingDraft.findOne({ userId: req.user._id });
  if (!draft) {
    return res.json({ success: true, data: null });
  }

  res.json({
    success: true,
    data: {
      cart: draft.cart || [],
      selectedIndices: draft.selectedIndices || [],
      contactForm: draft.contactForm || {},
      checkoutPayment: draft.checkoutPayment || {},
      paymentSession: draft.paymentSession || null,
      updatedAt: draft.updatedAt,
    },
  });
});

exports.saveMyDraft = asyncHandler(async (req, res) => {
  const { cart, selectedIndices, contactForm, checkoutPayment, paymentSession } = req.body;

  const update = {};
  if (Array.isArray(cart)) update.cart = cart;
  if (Array.isArray(selectedIndices)) update.selectedIndices = selectedIndices;
  if (contactForm && typeof contactForm === 'object') update.contactForm = contactForm;
  if (checkoutPayment && typeof checkoutPayment === 'object') {
    update.checkoutPayment = checkoutPayment;
  }
  if (paymentSession !== undefined) update.paymentSession = paymentSession;

  const draft = await BookingDraft.findOneAndUpdate(
    { userId: req.user._id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.json({
    success: true,
    data: {
      cart: draft.cart || [],
      selectedIndices: draft.selectedIndices || [],
      contactForm: draft.contactForm || {},
      checkoutPayment: draft.checkoutPayment || {},
      paymentSession: draft.paymentSession || null,
      updatedAt: draft.updatedAt,
    },
  });
});

exports.clearMyDraft = asyncHandler(async (req, res) => {
  await BookingDraft.findOneAndDelete({ userId: req.user._id });
  res.json({ success: true, message: 'Booking draft cleared' });
});

exports.hasDraftContent = (draft) => {
  if (!draft) return false;
  if (Array.isArray(draft.cart) && draft.cart.length > 0) return true;
  if (Array.isArray(draft.checkoutPayment?.bookingIds) && draft.checkoutPayment.bookingIds.length) {
    return true;
  }
  return false;
};

module.exports.emptyDraft = emptyDraft;
