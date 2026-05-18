const axios = require('axios');

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

const getPayMongoClient = () => {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return axios.create({
    baseURL: PAYMONGO_BASE_URL,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });
};

module.exports = { getPayMongoClient, PAYMONGO_BASE_URL };
