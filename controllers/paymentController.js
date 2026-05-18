const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  createPaymentIntent,
  createPaymentLink,
  parseWebhookEvent,
  resolvePayMongoPaidStatus,
  retrievePaymentLink,
} = require('../services/paymentService');
const { notifyPaymentStatus } = require('../services/notificationService');

const getBookingIdsForPayment = (payment) => {
  const ids = payment.metadata?.bookingIds;
  if (Array.isArray(ids) && ids.length) {
    return ids.map((id) => String(id));
  }
  return [String(payment.bookingId)];
};

const bookingIdsKey = (ids) => [...ids].map(String).sort().join(',');

const findPendingCombinedPayment = async (userId, bookingIds) => {
  const key = bookingIdsKey(bookingIds);
  const pending = await Payment.find({
    userId,
    status: 'pending',
    'metadata.combined': true,
  });

  return (
    pending.find((p) => bookingIdsKey(getBookingIdsForPayment(p)) === key) || null
  );
};

const buildCombinedPaymentResponse = async (payment, extras) => {
  let checkoutUrl = payment.metadata?.checkoutUrl || extras.checkoutUrl || null;

  if (!checkoutUrl && payment.metadata?.paymongoLinkId) {
    try {
      const { link } = await retrievePaymentLink(payment.metadata.paymongoLinkId);
      checkoutUrl = link.attributes?.checkout_url || null;
    } catch {
      /* use stored url only */
    }
  }

  return {
    payment,
    clientKey: payment.paymongoClientKey,
    paymentIntentId: payment.paymongoPaymentIntentId,
    checkoutUrl,
    amount: payment.amount,
    isTestMode: extras.isTestMode,
    linkError: extras.linkError,
    bookingIds: getBookingIdsForPayment(payment),
  };
};

const markPaymentSucceeded = async (payment, transactionId) => {
  if (payment.status !== 'succeeded') {
    payment.status = 'succeeded';
    payment.transactionId = transactionId || payment.transactionId;
    await payment.save();
  }

  const bookingIds = getBookingIdsForPayment(payment);
  let primary = null;

  for (const bookingId of bookingIds) {
    const booking = await Booking.findById(bookingId);
    if (!booking) continue;

    const wasAlreadyPaid = booking.paymentStatus === 'paid';
    const updates = { paymentStatus: 'paid' };
    if (booking.bookingStatus === 'pending') {
      updates.bookingStatus = 'confirmed';
    }

    const updated = await Booking.findByIdAndUpdate(bookingId, updates, { new: true });
    if (!primary) primary = updated;

    if (!wasAlreadyPaid) {
      await notifyPaymentStatus(payment.userId, bookingId, 'paid');
    }
  }

  return primary;
};

const startPaymongoCheckout = async ({ amount, description, metadata, userId }) => {
  let intent;
  try {
    intent = await createPaymentIntent({
      amount,
      description,
      metadata,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development' && !process.env.PAYMONGO_SECRET_KEY) {
      intent = {
        paymentIntentId: `mock_pi_${Date.now()}`,
        clientKey: 'mock_client_key',
        status: 'awaiting_payment_method',
        amount: amount * 100,
      };
    } else {
      throw err;
    }
  }

  let checkoutUrl = null;
  let linkError = null;
  let linkMeta = {};

  if (process.env.PAYMONGO_SECRET_KEY) {
    try {
      const link = await createPaymentLink({ amount, description, metadata });
      checkoutUrl = link.checkoutUrl;
      linkMeta = {
        paymongoLinkId: link.linkId,
        paymongoReferenceNumber: link.referenceNumber,
      };
    } catch (linkErr) {
      linkError = linkErr.response?.data?.errors?.[0]?.detail || linkErr.message;
      console.warn('PayMongo link creation failed:', linkError);
    }
  }

  const isTestKey = process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_test_');

  return { intent, checkoutUrl, linkError, linkMeta, isTestMode: isTestKey || !process.env.PAYMONGO_SECRET_KEY };
};

exports.createPayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (booking.paymentStatus === 'paid') {
    throw new ApiError(400, 'Booking is already paid');
  }

  const existing = await Payment.findOne({
    bookingId,
    status: { $in: ['pending', 'succeeded'] },
  });

  if (existing?.status === 'succeeded') {
    throw new ApiError(400, 'Payment already completed');
  }

  const { intent, checkoutUrl, linkError, linkMeta, isTestMode } = await startPaymongoCheckout({
    amount: booking.totalAmount,
    description: `Mood Studios — Booking`,
    metadata: { bookingId: String(booking._id), userId: String(req.user._id) },
  });

  const payment = await Payment.create({
    bookingId,
    userId: req.user._id,
    amount: booking.totalAmount,
    paymongoPaymentIntentId: intent.paymentIntentId,
    paymongoClientKey: intent.clientKey,
    status: 'pending',
    metadata: {
      ...linkMeta,
      bookingIds: [String(booking._id)],
      checkoutUrl: checkoutUrl || undefined,
    },
  });

  booking.paymentStatus = 'pending';
  await booking.save();

  res.status(201).json({
    success: true,
    data: {
      payment,
      clientKey: intent.clientKey,
      paymentIntentId: intent.paymentIntentId,
      checkoutUrl,
      amount: booking.totalAmount,
      isTestMode,
      linkError,
      bookingIds: [String(booking._id)],
    },
  });
});

exports.createCombinedPayment = asyncHandler(async (req, res) => {
  const { bookingIds: rawIds } = req.body;
  const bookingIds = [...new Set(rawIds.map(String))];

  const bookings = await Booking.find({ _id: { $in: bookingIds } });
  if (bookings.length !== bookingIds.length) {
    throw new ApiError(404, 'One or more bookings were not found');
  }

  let totalAmount = 0;
  for (const booking of bookings) {
    if (booking.userId.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Not authorized for one or more bookings');
    }
    if (booking.paymentStatus === 'paid') {
      throw new ApiError(400, 'One or more bookings are already paid');
    }
    totalAmount += booking.totalAmount;
  }

  const existingPending = await findPendingCombinedPayment(req.user._id, bookingIds);
  if (existingPending) {
    const isTestKey = process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_test_');
    return res.status(200).json({
      success: true,
      data: await buildCombinedPaymentResponse(existingPending, {
        isTestMode: isTestKey || !process.env.PAYMONGO_SECRET_KEY,
        linkError: null,
      }),
    });
  }

  await Payment.deleteMany({
    userId: req.user._id,
    status: 'pending',
    bookingId: { $in: bookingIds },
  });

  const metaUserId = String(req.user._id);
  const paymongoMeta = {
    bookingIds: bookingIds.join(','),
    userId: metaUserId,
    combined: 'true',
  };

  const { intent, checkoutUrl, linkError, linkMeta, isTestMode } = await startPaymongoCheckout({
    amount: totalAmount,
    description: `Mood Studios — ${bookingIds.length} booking(s)`,
    metadata: paymongoMeta,
  });

  const payment = await Payment.create({
    bookingId: bookings[0]._id,
    userId: req.user._id,
    amount: totalAmount,
    paymongoPaymentIntentId: intent.paymentIntentId,
    paymongoClientKey: intent.clientKey,
    status: 'pending',
    metadata: {
      ...linkMeta,
      bookingIds,
      combined: true,
      checkoutUrl: checkoutUrl || undefined,
    },
  });

  await Booking.updateMany(
    { _id: { $in: bookingIds } },
    { paymentStatus: 'pending' }
  );

  res.status(201).json({
    success: true,
    data: await buildCombinedPaymentResponse(payment, {
      checkoutUrl,
      isTestMode,
      linkError,
    }),
  });
});

exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('bookingId');
  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  if (
    req.user.role === 'customer' &&
    payment.userId.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, 'Not authorized');
  }

  res.json({ success: true, data: payment });
});

exports.confirmPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  if (payment.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  const isMock = payment.paymongoPaymentIntentId?.startsWith('mock_pi_');
  const isTestKey = process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_test_');
  const allowTestConfirm =
    process.env.ALLOW_TEST_PAYMENT_CONFIRM === 'true' || isTestKey;
  const testConfirm = req.body.testConfirm === true;

  if (payment.status === 'succeeded') {
    const booking = await Booking.findById(payment.bookingId);
    return res.json({ success: true, data: { payment, booking } });
  }

  let paid = false;
  let transactionId = null;

  if (isMock || (testConfirm && allowTestConfirm)) {
    paid = true;
    transactionId = payment.paymongoPaymentIntentId;
  } else if (process.env.PAYMONGO_SECRET_KEY) {
    const resolved = await resolvePayMongoPaidStatus(payment);
    paid = resolved.paid;
    transactionId = resolved.transactionId;
  } else if (testConfirm) {
    paid = true;
  }

  if (!paid) {
    throw new ApiError(
      400,
      'Payment not completed on PayMongo yet. Finish paying on the PayMongo page, then tap "I\'ve completed payment".'
    );
  }

  const booking = await markPaymentSucceeded(payment, transactionId);
  res.json({ success: true, data: { payment, booking } });
});

exports.paymongoWebhook = asyncHandler(async (req, res) => {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    body = JSON.parse(body.toString());
  }
  const event = parseWebhookEvent(body);
  if (!event) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }

  let payment = null;

  if (event.paymentIntentId) {
    payment = await Payment.findOne({ paymongoPaymentIntentId: event.paymentIntentId });
  }

  if (!payment && event.linkId) {
    payment = await Payment.findOne({ 'metadata.paymongoLinkId': event.linkId });
  }

  if (!payment && event.resourceId?.startsWith('link_')) {
    payment = await Payment.findOne({ 'metadata.paymongoLinkId': event.resourceId });
  }

  if (!payment && event.referenceNumber) {
    payment = await Payment.findOne({
      'metadata.paymongoReferenceNumber': event.referenceNumber,
    });
  }

  if (!payment) {
    return res.status(200).json({ received: true });
  }

  if (event.isPaid || event.status === 'succeeded' || event.status === 'paid') {
    await markPaymentSucceeded(
      payment,
      event.paymentId || event.resourceId
    );
  } else if (event.status === 'failed') {
    payment.status = 'failed';
    await payment.save();
    const ids = getBookingIdsForPayment(payment);
    await Booking.updateMany({ _id: { $in: ids } }, { paymentStatus: 'failed' });
  }

  res.status(200).json({ received: true });
});
