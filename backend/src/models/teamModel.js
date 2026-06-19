// Import mongoose to define schemas and interact with MongoDB
const mongoose = require('mongoose');

// Define the Schema for Team/Workspace documents
const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
    default: 'My Team Workspace'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model who owns/created the workspace
    required: true
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // References to the User models who are part of this workspace
    }
  ]
}, {
  // Automatically add createdAt and updatedAt date fields to each document
  timestamps: true
});

// Create and export the Team model compiled from the teamSchema definition
module.exports = mongoose.model('Team', teamSchema);
