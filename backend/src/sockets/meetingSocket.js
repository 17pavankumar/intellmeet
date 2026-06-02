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
    socket.on('join-meeting', async (data) => {
      // Support both string payload (meetingId) and object payload ({ meetingId, userId, name })
      const meetingId = typeof data === 'object' ? data.meetingId : data;
      const userId = typeof data === 'object' ? data.userId : null;
      const name = typeof data === 'object' ? data.name : null;

      // Put the socket channel into a room named after the meeting ID
      socket.join(meetingId);
      console.log(`User ${socket.id} joined meeting: ${meetingId}`);
      
      // Notify all other clients already inside this meeting room that a new user has joined
      socket.to(meetingId).emit('user-joined', { socketId: socket.id, userId, name });

      // Save participant to MongoDB if userId is provided
      if (userId) {
        try {
          const Meeting = require('../models/meetingModel');
          await Meeting.findByIdAndUpdate(meetingId, {
            $addToSet: { participants: userId } // Add to participants list without duplication
          });
          console.log(`Added participant ${userId} to meeting ${meetingId} in DB`);
        } catch (err) {
          console.error(`Failed to add participant to DB:`, err.message);
        }
      }
    });

    // Event: User sends a chat message inside a meeting room
    socket.on('send-message', async ({ meetingId, message, sender, senderId }) => {
      // Broadcast the received message object to all other participants in the same meeting room
      socket.to(meetingId).emit('receive-message', { 
        message, 
        sender, 
        timestamp: new Date() 
      });

      // Persist the message to MongoDB
      try {
        const Meeting = require('../models/meetingModel');
        await Meeting.findByIdAndUpdate(meetingId, {
          $push: {
            messages: {
              sender: senderId || null,
              senderName: sender,
              text: message,
              createdAt: new Date()
            }
          }
        });
        console.log(`Saved message from ${sender} in meeting ${meetingId} to DB`);
      } catch (err) {
        console.error(`Failed to save message to DB:`, err.message);
      }
    });

    // Event: User explicitly leaves a meeting room
    socket.on('leave-meeting', (meetingId) => {
      // Remove the socket channel from the meeting room
      socket.leave(meetingId);
      
      // Notify other participants in the room that this user has left
      socket.to(meetingId).emit('user-left', { socketId: socket.id });
    });

    // Event: User toggles audio/video mute state
    socket.on('toggle-mute', ({ meetingId, type, isMuted }) => {
      // Broadcast this mute change to all other participants in the room
      socket.to(meetingId).emit('user-mute-state', { socketId: socket.id, type, isMuted });
    });

    // Event: User disconnects from the WebSocket server (e.g. closed browser tab)
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });

    // ----- WebRTC Peer-to-Peer Signaling Events -----
    // WebRTC connection setup requires clients to trade "offers", "answers", and "ICE candidates"
    // to establish a direct connection with each other. The backend acts as a relay post here.

    // 1. Relays WebRTC SDP Offer from a calling client to a target client.
    //    We spread the full payload so senderName, isMicMuted, isVideoMuted all reach the recipient.
    socket.on('webrtc-offer', ({ targetSocketId, ...rest }) => {
      socket.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        ...rest  // Passes offer, senderName, isMicMuted, isVideoMuted through intact
      });
    });

    // 2. Relays WebRTC SDP Answer back from target client to calling client.
    //    Same spread approach — keeps all metadata fields intact.
    socket.on('webrtc-answer', ({ targetSocketId, ...rest }) => {
      socket.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        ...rest  // Passes answer, senderName, isMicMuted, isVideoMuted through intact
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
