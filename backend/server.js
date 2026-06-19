// Import express framework to create our web server and handle API requests
const express = require('express');

// Import Node's built-in http module to create an HTTP server instance
const http = require('http');

// Import Server class from socket.io to handle real-time WebSockets communication
const { Server } = require('socket.io');

// Import CORS (Cross-Origin Resource Sharing) middleware to allow frontend to communicate with backend
const cors = require('cors');

// Import dotenv library to load configuration variables from the .env file into process.env
const dotenv = require('dotenv');
// Load environment variables from the .env configuration file into process.env
dotenv.config();

// Import mongoose library to connect to and interact with our MongoDB database
const mongoose = require('mongoose');

// Import custom API router modules for authentication, meetings, and task management
const authRoutes = require('./src/routes/authRoutes');
const meetingRoutes = require('./src/routes/meetingRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const teamRoutes = require('./src/routes/teamRoutes');

// Import socket setup function to initialize WebSockets event listeners for meeting features
const setupMeetingSocket = require('./src/sockets/meetingSocket');

// Create an instance of the Express application
const app = express();

// Create an HTTP server using our Express application instance
const server = http.createServer(app);

// Initialize Socket.io Server instance on top of the HTTP server, allowing any origin to connect via WebSockets
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from any frontend origin (useful for development)
    methods: ['GET', 'POST'], // Allow GET and POST HTTP methods for WebSockets handshake
  },
});

// Import helmet middleware to protect our server from web vulnerabilities by setting appropriate HTTP headers
const helmet = require('helmet');

// Import express-rate-limit middleware to prevent brute-force attacks by limiting request rates from a single IP
const rateLimit = require('express-rate-limit');

// ----- Security & Express Middleware Setup -----

// Use helmet middleware to add security headers to all HTTP responses
app.use(helmet());

// Configure the API rate limiter: max 100 requests per 15 minutes per IP address
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes duration in milliseconds
  max: 100, // Maximum number of requests allowed per window per IP
  message: 'Too many requests from this IP, please try again after 15 minutes', // Error message when limit is exceeded
  standardHeaders: true, // Return rate limit info in the standard `RateLimit-*` headers
  legacyHeaders: false, // Disable the old `X-RateLimit-*` headers
});

// Use CORS middleware to allow cross-origin requests from any frontend URL
app.use(cors({ origin: '*' }));

// Use express.json middleware to automatically parse incoming JSON payloads in request bodies
app.use(express.json());

// Apply the rate limiter middleware to all routes starting with '/api/'
app.use('/api/', apiLimiter);

// ----- API Endpoint Routes Mapping -----

// Define a simple root endpoint to check if the backend API server is alive
app.get('/', (req, res) => {
  res.send('IntellMeet API is running...');
});

// Mount authentication router endpoints at /api/auth
app.use('/api/auth', authRoutes);

// Mount meetings router endpoints at /api/meetings
app.use('/api/meetings', meetingRoutes);

// Mount tasks router endpoints at /api/tasks
app.use('/api/tasks', taskRoutes);

// Mount teams router endpoints at /api/teams
app.use('/api/teams', teamRoutes);

// ----- Socket.io Real-Time Signaling Initialization -----

// Pass our Socket.io server instance to setup meeting event listeners (Webrtc & Chat)
setupMeetingSocket(io);

// ----- Database Connection and Server Startup -----

// Set the port number from environment variables or default to 5000
const PORT = process.env.PORT || 5000;

// Set the MongoDB connection URI string from environment variables or default to a local MongoDB database
let MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/intellmeet';

// Helper function to auto-encode special characters (like '@' or ':') in the connection credentials
const sanitizeMongoUri = (uri) => {
  if (!uri) return uri;
  try {
    const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):(.*)@([^@/]+)(.*)$/);
    if (match) {
      const [_, protocol, username, password, hostAndDb, options] = match;
      const decodedPassword = decodeURIComponent(password);
      const encodedPassword = encodeURIComponent(decodedPassword);
      const decodedUsername = decodeURIComponent(username);
      const encodedUsername = encodeURIComponent(decodedUsername);
      return `${protocol}${encodedUsername}:${encodedPassword}@${hostAndDb}${options}`;
    }
  } catch (err) {
    console.error('Failed to parse/sanitize MONGO_URI:', err.message);
  }
  return uri;
};

MONGO_URI = sanitizeMongoUri(MONGO_URI);

// Connect to MongoDB database via mongoose
mongoose
  .connect(MONGO_URI)
  .then(() => {
    // When database connection is successful:
    console.log('✅ MongoDB Connected');
    
    // Start listening for incoming HTTP and WebSocket requests on the specified PORT
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // If the database connection fails, log the error and terminate the process
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('👉 Make sure MongoDB is running: mongod');
    process.exit(1); // Exit process with failure code 1
  });
