// Import mongoose to define schemas and interact with MongoDB
const mongoose = require('mongoose');

// Define the Schema for Task documents (action items/Kanban items)
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'], // Task title is mandatory
    trim: true // Remove leading/trailing spaces
  },
  description: {
    type: String,
    default: '' // Default description is empty string
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model representing the person assigned to complete the task
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model representing the person who created the task
    required: true
  },
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting' // Reference to the Meeting model if the task was generated from a specific meeting
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'done'], // Allowed status values for our task board
    default: 'todo' // Default task state is 'todo'
  },
  dueDate: {
    type: Date // Optional deadline date for task completion
  }
}, {
  // Automatically add createdAt and updatedAt date fields to each document
  timestamps: true
});

// Create and export the Task model compiled from the taskSchema definition
module.exports = mongoose.model('Task', taskSchema);
