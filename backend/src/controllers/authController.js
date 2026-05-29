// Import jsonwebtoken (JWT) library to sign/create secure authentication tokens
const jwt = require('jsonwebtoken');

// Import the User model to query and modify user accounts in MongoDB
const User = require('../models/userModel');

/**
 * Helper function to generate a JSON Web Token (JWT) for a specific user ID.
 * The token encodes the user ID and is signed using our secret key, expiring in 7 days.
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
const register = async (req, res) => {
  // Extract user parameters from request body
  const { name, email, password } = req.body;

  try {
    // Check if a user with the provided email address is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists, return a 400 Bad Request error
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Create a new User document in MongoDB (the password is automatically hashed by our userModel's pre-save hook)
    const user = await User.create({ name, email, password });

    // Generate JWT token for the newly registered user
    const token = generateToken(user._id);

    // Return the created user's profile information alongside their new access token
    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: token
    });
  } catch (error) {
    // Catch database errors or server errors and return a 500 Server Error response
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user credentials and return a token
 * @access  Public
 */
const login = async (req, res) => {
  // Extract login parameters from request body
  const { email, password } = req.body;

  try {
    // Look up the user document by email. We explicitly call select('+password') because the password field is normally excluded by default
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      // If user is not found, return 401 Unauthorized status
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare the candidate text password with the hashed password stored in the database
    const isMatch = await user.comparePassword(password, user.password);
    if (!isMatch) {
      // If password comparison fails, return 401 Unauthorized status
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token for the authenticated user
    const token = generateToken(user._id);

    // Return the user's profile details and token (excluding password hash)
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: token
    });
  } catch (error) {
    // Return a 500 Server Error if database queries fail
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Fetch profile details of currently logged-in user
 * @access  Private
 */
const getMe = async (req, res) => {
  // req.user has already been populated by our 'protect' middleware after token validation
  return res.json(req.user);
};

// Export controller functions for auth routes mapping
module.exports = { register, login, getMe };
