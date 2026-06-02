// Import Express library to create route handlers
const express = require('express');

// Create a new router instance for routing API requests
const router = express.Router();

// Import controller functions that handle the meeting features business logic
const {
  createMeeting,
  getMyMeetings,
  getMeetingById,
  updateMeetingAccess,
  updateMeetingStatus,
  saveMeetingSummary,
  deleteMeeting,
} = require('../controllers/meetingController');

// Import authentication protection middleware
const { protect, optionalProtect } = require('../middleware/authMiddleware');

// Endpoint route for:
// 1. POST /api/meetings — Create a new meeting (handled by createMeeting controller)
// 2. GET  /api/meetings — Get all meetings the user is in (handled by getMyMeetings controller)
router.route('/')
  .post(protect, createMeeting)
  .get(protect, getMyMeetings);

// Endpoint route for specific meeting operations by ID:
// 1. GET    /api/meetings/:id — Retrieve detailed info of a meeting (handled by getMeetingById controller)
// 2. DELETE /api/meetings/:id — Remove a meeting from the database (handled by deleteMeeting controller)
router.route('/:id')
  .get(optionalProtect, getMeetingById)
  .delete(protect, deleteMeeting);

// Endpoint route to update meeting access settings: PATCH /api/meetings/:id/access
router.patch('/:id/access', protect, updateMeetingAccess);

// Endpoint route to update meeting status: PATCH /api/meetings/:id/status
router.patch('/:id/status', protect, updateMeetingStatus);

// Endpoint route to save meeting's AI summary & action items: PATCH /api/meetings/:id/summary
router.patch('/:id/summary', protect, saveMeetingSummary);

// Export the router module
module.exports = router;
