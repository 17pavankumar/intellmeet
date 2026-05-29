// Import the Task model to query, create, update and delete task documents in MongoDB
const Task = require('../models/taskModel');

/**
 * @route   POST /api/tasks
 * @desc    Create a new task (Action item)
 * @access  Private (Requires JWT token authentication)
 */
const createTask = async (req, res) => {
  // Extract task attributes from request body
  const { title, description, assignedTo, meetingId, dueDate } = req.body;

  try {
    // Create new Task document in database.
    // If assignedTo is not specified, assign the task to the creator.
    // createdBy is set to currently logged-in user.
    // Optional meeting field connects the task to a specific meeting session.
    const task = await Task.create({
      title,
      description,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,
      meeting: meetingId || null,
      dueDate
    });

    // Return the created task with 201 Created status
    return res.status(201).json(task);
  } catch (error) {
    // Return server error code 500 if database creation fails
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   GET /api/tasks
 * @desc    Retrieve all tasks assigned to the authenticated user
 * @access  Private (Requires JWT token authentication)
 */
const getMyTasks = async (req, res) => {
  try {
    // Query database for tasks where assignedTo field matches the user's ID
    const tasks = await Task.find({ assignedTo: req.user._id })
      // Populate fields: replace User IDs with names and emails, and include meeting titles
      .populate('createdBy', 'name email')
      .populate('meeting', 'title')
      // Sort tasks: display newly created tasks first
      .sort({ createdAt: -1 });

    // Return tasks array
    return res.json(tasks);
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   PATCH /api/tasks/:id/status
 * @desc    Update status of a specific task (e.g. todo, in-progress, done)
 * @access  Private (Requires JWT token authentication)
 */
const updateTaskStatus = async (req, res) => {
  // Extract new status value from request body
  const { status } = req.body;

  try {
    // Find task by ID and update its status
    // { new: true } option ensures we receive the updated document back in response
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!task) {
      // Return 404 error if task doesn't exist
      return res.status(404).json({ message: 'Task not found' });
    }

    // Return updated task object
    return res.json(task);
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Remove a task entry from the database
 * @access  Private (Only task creator can delete the task)
 */
const deleteTask = async (req, res) => {
  try {
    // Find the task document
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Authorization check: Compare creator's ID with logged-in user ID
    if (task.createdBy.toString() !== req.user._id.toString()) {
      // If not creator, deny with 403 Forbidden status
      return res.status(403).json({ message: 'Only the task creator can delete it' });
    }

    // Remove task document from collection
    await task.deleteOne();
    
    // Return success confirmation message
    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

// Export controller functions for router mapping
module.exports = { createTask, getMyTasks, updateTaskStatus, deleteTask };
