/**
 * Socket.io Meeting Event Handler
 * Sets up listeners for WebSocket connections to handle real-time chat
 * and WebRTC peer-to-peer connection signaling.
 */
const setupMeetingSocket = (io) => {
  // Listen for new client connection events
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Event: User joins a specific meeting room
    socket.on('join-meeting', (meetingId) => {
      // Put the socket channel into a room named after the meeting ID
      socket.join(meetingId);
      console.log(`User ${socket.id} joined meeting: ${meetingId}`);
      
      // Notify all other clients already inside this meeting room that a new user has joined
      socket.to(meetingId).emit('user-joined', { socketId: socket.id });
    });

    // Event: User sends a chat message inside a meeting room
    socket.on('send-message', ({ meetingId, message, sender }) => {
      // Broadcast the received message object to all other participants in the same meeting room
      socket.to(meetingId).emit('receive-message', { 
        message, 
        sender, 
        timestamp: new Date() 
      });
    });

    // Event: User explicitly leaves a meeting room
    socket.on('leave-meeting', (meetingId) => {
      // Remove the socket channel from the meeting room
      socket.leave(meetingId);
      
      // Notify other participants in the room that this user has left
      socket.to(meetingId).emit('user-left', { socketId: socket.id });
    });

    // Event: User disconnects from the WebSocket server (e.g. closed browser tab)
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });

    // ----- WebRTC Peer-to-Peer Signaling Events -----
    // WebRTC connection setup requires clients to trade "offers", "answers", and "ICE candidates"
    // to establish a direct connection with each other. The backend acts as a relay post here.

    // 1. Relays WebRTC SDP Offer from a calling client to a target client
    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
      socket.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer
      });
    });

    // 2. Relays WebRTC SDP Answer back from target client to calling client
    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
      socket.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        answer
      });
    });

    // 3. Relays WebRTC ICE Candidates (network routes) between peers
    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
      socket.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });
  });
};

// Export the socket setup function
module.exports = setupMeetingSocket;
