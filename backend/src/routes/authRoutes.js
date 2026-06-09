// Import Express library to create route handlers
const express = require('express');

// Create a new router instance for routing API requests
const router = express.Router();

// Import controller functions that handle the business logic of authentication endpoints
const { register, login, getMe, googleLogin } = require('../controllers/authController');

// Import authentication protection middleware
const { protect } = require('../middleware/authMiddleware');

// Define API route paths and map them to their corresponding controller functions:

// Route to register a new user account: POST /api/auth/register
router.post('/register', register);

// Route to authenticate and log in a user: POST /api/auth/login
router.post('/login', login);

// Route to authenticate a user using Google OAuth ID token: POST /api/auth/google
router.post('/google', googleLogin);

// Route to retrieve current user's profile details: GET /api/auth/me
// Passes through 'protect' middleware first to verify JWT authentication token
router.get('/me', protect, getMe);

// Export the router module
module.exports = router;
