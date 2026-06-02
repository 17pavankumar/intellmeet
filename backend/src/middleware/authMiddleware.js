// Import jsonwebtoken (JWT) library to verify and decode user authentication tokens
const jwt = require('jsonwebtoken');

// Import the User model to fetch user details from MongoDB database
const User = require('../models/userModel');

/**
 * Route protection middleware to authenticate users using JWT.
 * It intercepts requests, reads the Authorization header, validates the token,
 * and attaches the authenticated user object to the request object.
 */
const protect = async (req, res, next) => {
  let token;

  // Check if the request contains an "Authorization" header and if it starts with the word "Bearer"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Split the header value (e.g. "Bearer <token_string>") by spaces and select the token string (index 1)
      token = req.headers.authorization.split(' ')[1];

      // Verify the signature of the token using the secret key configured in environment variables
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Query the database to find the user with the ID matching the decoded token payload
      // Use select('-password') to exclude the hashed password from the returned user object for security
      req.user = await User.findById(decoded.id).select('-password');

      // Call next() to hand over control to the next middleware or router handler in the pipeline
      return next();
    } catch (error) {
      // If verification fails (e.g. token expired, malformed, or invalid signature), return an unauthorized error
      return res.status(401).json({ message: 'Not authorized — invalid token' });
    }
  }

  // If no token was found in the Authorization header, return an unauthorized error
  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token provided' });
  }
};

/**
 * Authorization middleware to allow access only to user accounts with the 'admin' role.
 * Must be used after the 'protect' middleware has run and populated 'req.user'.
 */
const adminOnly = (req, res, next) => {
  // Check if req.user exists and has the role set to 'admin'
  if (req.user && req.user.role === 'admin') {
    // If user is an admin, proceed to the next step
    next();
  } else {
    // If not, deny access with a 403 Forbidden HTTP status code
    res.status(403).json({ message: 'Access denied — admins only' });
  }
};

/**
 * Route protection middleware to optionally authenticate users.
 * If a token is provided and valid, it attaches 'req.user'.
 * Otherwise, it proceeds as a guest without returning an error.
 */
const optionalProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      return next();
    } catch (error) {
      // Proceed without blocking if token is invalid/expired
      return next();
    }
  }
  next();
};

// Export middleware functions to make them available for route files
module.exports = { protect, adminOnly, optionalProtect };

