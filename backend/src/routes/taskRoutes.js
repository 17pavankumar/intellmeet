// Import Express library to create route handlers
const express = require('express');

// Create a new router instance for routing API requests
const router = express.Router();

// Import controller functions that handle the task management business logic
const {
  createTask,
  getMyTasks,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/taskController');

// Import authentication protection middleware
const { protect } = require('../middleware/authMiddleware');

// Secure all routes listed below with authorization protection check first
// Every route below this line must pass through 'protect' middleware to verify the client's JWT token
router.use(protect);

// Endpoint route for:
// 1. POST /api/tasks — Create a new task (handled by createTask controller)
// 2. GET  /api/tasks — Retrieve all tasks assigned to current user (handled by getMyTasks controller)
router.route('/')
  .post(createTask)
  .get(getMyTasks);

// Endpoint route to update task status: PATCH /api/tasks/:id/status
router.patch('/:id/status', updateTaskStatus);

// Endpoint route to delete a task: DELETE /api/tasks/:id
router.delete('/:id', deleteTask);

// Export the router module
module.exports = router;
