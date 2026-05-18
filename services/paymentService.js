const { getPayMongoClient } = require('../config/paymongo');
const ApiError = require('../utils/ApiError');

const createPaymentIntent = async ({ amount, description, metadata = {} }) => {
  const client = getPayMongoClient();
  if (!client) {
    throw new ApiError(503, 'PayMongo is not configured');
  }

  const amountInCentavos = Math.round(amount * 100);

  const { data } = await client.post('/payment_intents', {
    data: {
      attributes: {
        amount: amountInCentavos,
        payment_method_allowed: ['card', 'gcash', 'paymaya', 'grab_pay'],
        currency: 'PHP',
        description: description || 'Mood Studios booking payment',
        metadata,
      },
    },
  });

  const intent = data.data;
  return {
    paymentIntentId: intent.id,
    clientKey: intent.attributes.client_key,
    status: intent.attributes.status,
    amount: intent.attributes.amount,
  };
};

const retrievePaymentIntent = async (paymentIntentId) => {
  const client = getPayMongoClient();
  if (!client) {
    throw new ApiError(503, 'PayMongo is not configured');
  }

  const { data } = await client.get(`/payment_intents/${paymentIntentId}`);
  return data.data;
};

const parseWebhookEvent = (body) => {
  const event = body?.data;
  if (!event) return null;

  const type = body.type || '';
  const attributes = event.attributes || {};
  const resourceType = event.type || '';

  let linkId = attributes.link_id || attributes.source?.id;
  if (!linkId && resourceType === 'link') {
    linkId = event.id;
  }
  if (!linkId && type.includes('link') && event.id?.startsWith('link_')) {
    linkId = event.id;
  }

  return {
    type,
    resourceType,
    resourceId: event.id,
    status: attributes.status,
    paymentIntentId: attributes.payment_intent_id,
    linkId,
    referenceNumber: attributes.reference_number || attributes.external_reference_number,
    paymentId: resourceType === 'payment' ? event.id : attributes.payment_id,
    metadata: attributes.metadata || {},
    isPaid: type.includes('paid') || attributes.status === 'paid' || attributes.status === 'succeeded',
  };
};

const retrievePaymentLink = async (linkIdOrRef) => {
  const client = getPayMongoClient();
  if (!client) {
    throw new ApiError(503, 'PayMongo is not configured');
  }

  const { data } = await client.get(`/links/${linkIdOrRef}`, {
    params: { include: 'payments' },
  });
  return { link: data.data, included: data.included || [] };
};

const retrievePayment = async (paymentId) => {
  const client = getPayMongoClient();
  if (!client) {
    throw new ApiError(503, 'PayMongo is not configured');
  }

  const { data } = await client.get(`/payments/${paymentId}`);
  return data.data;
};

const listRecentPaidPayments = async (limit = 40) => {
  const client = getPayMongoClient();
  if (!client) {
    throw new ApiError(503, 'PayMongo is not configured');
  }

  const { data } = await client.get('/payments', {
    params: { status: 'paid', limit },
  });
  return data.data || [];
};

/**
 * Checkout uses Payment Links; paying there does NOT update a separate Payment Intent.
 * QRPh/card via link checkout may leave link.status as "unpaid" while a Payment is "paid".
 */
const getLinkPaymentStatus = (link, included = []) => {
  const attrs = link?.attributes || {};
  const paidStatuses = new Set(['paid', 'succeeded', 'completed']);

  if (paidStatuses.has(attrs.status)) {
    let transactionId = null;
    const payments = attrs.payments;
    if (Array.isArray(payments) && payments.length > 0) {
      const first = payments[0];
      transactionId = typeof first === 'string' ? first : first?.id;
    }
    return { paid: true, transactionId };
  }

  const includedPaid = included.find(
    (item) => item.type === 'payment' && paidStatuses.has(item.attributes?.status)
  );
  if (includedPaid) {
    return { paid: true, transactionId: includedPaid.id };
  }

  return { paid: false };
};

/**
 * PayMongo often keeps link.status "unpaid" for QRPh; match Payment by link reference + amount.
 */
const findPaidPaymentForLinkReference = async (referenceNumber, amountPhp) => {
  if (!referenceNumber) return null;

  const expectedCentavos = Math.round(Number(amountPhp) * 100);
  const payments = await listRecentPaidPayments(50);

  return (
    payments.find((item) => {
      const attrs = item.attributes || {};
      return (
        attrs.status === 'paid' &&
        attrs.external_reference_number === referenceNumber &&
        attrs.amount === expectedCentavos
      );
    }) || null
  );
};

/**
 * Returns whether PayMongo shows this booking as paid (link checkout or intent).
 */
const resolvePayMongoPaidStatus = async (payment) => {
  const linkId = payment.metadata?.paymongoLinkId;
  const linkRef = payment.metadata?.paymongoReferenceNumber;

  if (linkId || linkRef) {
    try {
      const { link, included } = await retrievePaymentLink(linkId || linkRef);
      const linkStatus = getLinkPaymentStatus(link, included);
      if (linkStatus.paid) {
        return {
          paid: true,
          transactionId: linkStatus.transactionId || link.id,
          source: 'link',
        };
      }

      const ref = linkRef || link.attributes?.reference_number;
      const paidPayment = await findPaidPaymentForLinkReference(ref, payment.amount);
      if (paidPayment) {
        return {
          paid: true,
          transactionId: paidPayment.id,
          source: 'link_payment',
        };
      }
    } catch (err) {
      console.warn('PayMongo link retrieve failed:', err.response?.data || err.message);
    }

    if (linkRef) {
      try {
        const paidPayment = await findPaidPaymentForLinkReference(linkRef, payment.amount);
        if (paidPayment) {
          return {
            paid: true,
            transactionId: paidPayment.id,
            source: 'link_payment',
          };
        }
      } catch (err) {
        console.warn('PayMongo paid payment lookup failed:', err.response?.data || err.message);
      }
    }
  }

  if (payment.paymongoPaymentIntentId && !payment.paymongoPaymentIntentId.startsWith('mock_pi_')) {
    const intent = await retrievePaymentIntent(payment.paymongoPaymentIntentId);
    if (intent.attributes?.status === 'succeeded') {
      return {
        paid: true,
        transactionId: payment.paymongoPaymentIntentId,
        source: 'intent',
      };
    }
  }

  return { paid: false };
};

const createPaymentLink = async ({ amount, description, metadata = {} }) => {
  const client = getPayMongoClient();
  if (!client) {
    throw new ApiError(503, 'PayMongo is not configured');
  }

  const amountInCentavos = Math.round(amount * 100);

  const { data } = await client.post('/links', {
    data: {
      attributes: {
        amount: amountInCentavos,
        description: description || 'Mood Studios booking payment',
        remarks: metadata.bookingId ? `Booking ${metadata.bookingId}` : 'Mood Studios',
      },
    },
  });

  const link = data.data;
  return {
    linkId: link.id,
    checkoutUrl: link.attributes.checkout_url,
    referenceNumber: link.attributes.reference_number,
  };
};

module.exports = {
  createPaymentIntent,
  createPaymentLink,
  retrievePaymentIntent,
  retrievePaymentLink,
  retrievePayment,
  getLinkPaymentStatus,
  findPaidPaymentForLinkReference,
  resolvePayMongoPaidStatus,
  parseWebhookEvent,
};
