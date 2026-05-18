const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { readAuthToken } = require('../utils/authCookie');

const protect = asyncHandler(async (req, res, next) => {
  const token = readAuthToken(req);

  if (!token) {
    throw new ApiError(401, 'Not authorized — no token provided');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  req.user = user;
  next();
});

module.exports = { protect };
