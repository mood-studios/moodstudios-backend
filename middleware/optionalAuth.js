const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { readAuthToken } = require('../utils/authCookie');

const optionalAuth = async (req, res, next) => {
  try {
    const token = readAuthToken(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
  } catch {
    req.user = null;
  }
  next();
};

module.exports = optionalAuth;
