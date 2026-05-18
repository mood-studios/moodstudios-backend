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

  const type = body.type;
  const attributes = event.attributes || {};

  return {
    type,
    resourceId: event.id,
    status: attributes.status,
    paymentIntentId: attributes.payment_intent_id || event.id,
    metadata: attributes.metadata || {},
  };
};

module.exports = {
  createPaymentIntent,
  retrievePaymentIntent,
  parseWebhookEvent,
};
