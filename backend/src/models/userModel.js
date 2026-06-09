// Import mongoose to define schemas and interact with MongoDB
const mongoose = require('mongoose');

// Import bcryptjs to securely hash and verify passwords
const bcrypt = require('bcryptjs');

// Define the Schema for User documents
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'], // Field is required, custom error message is returned if missing
    trim: true // Automatically remove leading/trailing whitespace from the value
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // Prevent duplicate email registrations in the database
    lowercase: true, // Automatically store emails in lowercase
    trim: true,
    // Regular expression validator to check if the format matches a valid email address
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6, // Minimum allowed password length is 6 characters
    select: false // By default, do NOT include the hashed password when querying users (prevents accidental leaks)
  },
  avatar: {
    type: String,
    default: '' // Default profile picture string (empty if none provided)
  },
  role: {
    type: String,
    enum: ['Member', 'Admin'], // Only 'Member' or 'Admin' values are valid roles
    default: 'Member' // Default user role is 'Member'
  },
  googleId: {
    type: String,
    sparse: true, // Allows multiple null values for users registered with email/password
    unique: true // Google ID must be unique
  }
}, {
  // Automatically add createdAt and updatedAt date fields to each document
  timestamps: true
});

// A pre-save hook that runs automatically before a User document is saved into MongoDB.
// NOTE: With Mongoose 9.x, async pre-hooks should NOT declare `next` as a parameter.
// Instead, return a Promise (via async/await) and Mongoose handles the continuation automatically.
userSchema.pre('save', async function() {
  // If the password field hasn't been modified (e.g. updating profile info), skip re-hashing
  if (!this.isModified('password')) return;
  
  // Hash the password asynchronously using bcrypt with a salt round factor of 12
  // A higher salt factor = more secure but slightly slower (12 is production-safe)
  this.password = await bcrypt.hash(this.password, 12);
});

// A custom document helper method to compare a plain text candidate password with the user's stored hashed password
userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
  // Returns true if the passwords match, false otherwise
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Create and export the User model compiled from the userSchema definition
module.exports = mongoose.model('User', userSchema);
