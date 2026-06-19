// Import Express library to create route handlers
const express = require('express');
const router = express.Router();

// Import team controller handler functions
const { getMyTeam, addTeamMember, removeTeamMember } = require('../controllers/teamController');

// Import authentication protection middleware
const { protect } = require('../middleware/authMiddleware');

// Protect all routes defined below with authentication check
router.use(protect);

// Define API routes:
// GET /api/teams -> Get current team workspace and list of members
router.get('/', getMyTeam);

// POST /api/teams/members -> Add a user to team members list by email
router.post('/members', addTeamMember);

// DELETE /api/teams/members/:userId -> Remove a user from team members list by ID
router.delete('/members/:userId', removeTeamMember);

module.exports = router;
