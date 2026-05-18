const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  createPaymentIntent,
  createPaymentLink,
  retrievePaymentIntent,
  parseWebhookEvent,
} = require('../services/paymentService');
const { notifyPaymentStatus } = require('../services/notificationService');

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

  let intent;
  try {
    intent = await createPaymentIntent({
      amount: booking.totalAmount,
      description: `Booking ${booking._id}`,
      metadata: { bookingId: String(booking._id), userId: String(req.user._id) },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development' && !process.env.PAYMONGO_SECRET_KEY) {
      intent = {
        paymentIntentId: `mock_pi_${Date.now()}`,
        clientKey: 'mock_client_key',
        status: 'awaiting_payment_method',
        amount: booking.totalAmount * 100,
      };
    } else {
      throw err;
    }
  }

  const payment = await Payment.create({
    bookingId,
    userId: req.user._id,
    amount: booking.totalAmount,
    paymongoPaymentIntentId: intent.paymentIntentId,
    paymongoClientKey: intent.clientKey,
    status: 'pending',
  });

  booking.paymentStatus = 'pending';
  await booking.save();

  let checkoutUrl = null;
  let linkError = null;
  const isTestKey = process.env.PAYMONGO_SECRET_KEY?.startsWith('sk_test_');

  if (process.env.PAYMONGO_SECRET_KEY) {
    try {
      const link = await createPaymentLink({
        amount: booking.totalAmount,
        description: `Mood Studios — Booking`,
        metadata: { bookingId: String(booking._id), userId: String(req.user._id) },
      });
      checkoutUrl = link.checkoutUrl;
      payment.metadata = { ...(payment.metadata || {}), paymongoLinkId: link.linkId };
      await payment.save();
    } catch (linkErr) {
      linkError = linkErr.response?.data?.errors?.[0]?.detail || linkErr.message;
      console.warn('PayMongo link creation failed:', linkError);
    }
  }

  res.status(201).json({
    success: true,
    data: {
      payment,
      clientKey: intent.clientKey,
      paymentIntentId: intent.paymentIntentId,
      checkoutUrl,
      amount: booking.totalAmount,
      isTestMode: isTestKey || !process.env.PAYMONGO_SECRET_KEY,
      linkError,
    },
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

  let intentStatus = 'pending';

  if (isMock || (testConfirm && allowTestConfirm)) {
    intentStatus = 'succeeded';
  } else if (process.env.PAYMONGO_SECRET_KEY && payment.paymongoPaymentIntentId) {
    const intent = await retrievePaymentIntent(payment.paymongoPaymentIntentId);
    const status = intent.attributes?.status;
    if (status === 'succeeded') {
      intentStatus = 'succeeded';
    } else if (testConfirm && allowTestConfirm) {
      intentStatus = 'succeeded';
    } else if (status === 'awaiting_payment_method' || status === 'awaiting_next_action') {
      throw new ApiError(
        400,
        allowTestConfirm
          ? 'Payment not completed on PayMongo yet. Open "Continue to PayMongo" and pay with a test card, or use test confirm if enabled.'
          : 'Payment not completed yet. Finish paying in PayMongo, then tap "I\'ve completed payment".'
      );
    }
  } else if (testConfirm) {
    intentStatus = 'succeeded';
  }

  if (intentStatus !== 'succeeded') {
    throw new ApiError(400, 'Payment not yet completed. Please finish checkout first.');
  }

  payment.status = 'succeeded';
  payment.transactionId = payment.paymongoPaymentIntentId;
  await payment.save();

  const booking = await Booking.findByIdAndUpdate(
    payment.bookingId,
    { paymentStatus: 'paid' },
    { new: true }
  );

  await notifyPaymentStatus(payment.userId, payment.bookingId, 'paid');

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

  const payment = await Payment.findOne({
    paymongoPaymentIntentId: event.paymentIntentId,
  });

  if (!payment) {
    return res.status(200).json({ received: true });
  }

  if (event.status === 'succeeded' || event.type?.includes('payment.paid')) {
    payment.status = 'succeeded';
    payment.transactionId = event.resourceId;
    await payment.save();

    await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'paid' });
    await notifyPaymentStatus(payment.userId, payment.bookingId, 'paid');
  } else if (event.status === 'failed') {
    payment.status = 'failed';
    await payment.save();
    await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'failed' });
  }

  res.status(200).json({ received: true });
});
