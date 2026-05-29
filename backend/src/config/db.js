// Import the mongoose library to enable connection and queries with MongoDB
const mongoose = require('mongoose');

// Define an asynchronous function to connect to the MongoDB database
const connectDB = async () => {
  try {
    // Attempt to establish a connection to MongoDB using the URI string specified in the environment variables (.env file)
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    // Log a success message to the console, showing the database server host name
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // If connection fails, log the error message to the console
    console.error(`❌ MongoDB connection error: ${error.message}`);
    
    // Terminate the Node.js application process immediately with a failure exit code (1)
    process.exit(1);
  }
};

// Export the connectDB function so it can be imported and executed in other files (like server.js)
module.exports = connectDB;
