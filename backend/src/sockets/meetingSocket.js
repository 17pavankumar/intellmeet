/**
 * Setup WebSocket listeners on the Socket.io instance.
 * This coordinates real-time chat messages and WebRTC signaling (offers, answers, candidates).
 */
const setupMeetingSocket = (io) => {
  // Listen for whenever a user client connects to our Socket.io server
  io.on('connection', (socket) => {
    // Log the unique socket ID representing this user session
    console.log('User connected: ' + socket.id);

    // Listener: A participant joins a meeting room
    socket.on('join-meeting', async (data) => {
      // Initialize meeting room parameters
      let meetingId = '';
      let userId = null;
      let name = null;

      // Extract details depending on whether the payload is an object or string
      if (typeof data === 'object' && data !== null) {
        meetingId = data.meetingId;
        userId = data.userId;
        name = data.name;
      } else {
        meetingId = data;
      }

      // Add this client's socket session to the channel room named after the meeting ID
      socket.join(meetingId);
      console.log('User ' + socket.id + ' joined meeting: ' + meetingId);
      
      // Notify all other clients in the same room that a new participant has joined
      socket.to(meetingId).emit('user-joined', { 
        socketId: socket.id, 
        userId: userId, 
        name: name 
      });

      // If a valid userId exists, persist their participant status to the MongoDB database
      if (userId) {
        try {
          // Import the Meeting model to query/update meeting documents
          const Meeting = require('../models/meetingModel');
          
          // Use Mongoose addToSet to add user to participant list uniquely
          await Meeting.findByIdAndUpdate(meetingId, {
            $addToSet: { participants: userId }
          });
          console.log('Added participant ' + userId + ' to meeting ' + meetingId + ' in database');
        } catch (err) {
          // Print error message if DB update fails
          console.error('Failed to add participant to DB:', err.message);
        }
      }
    });

    // Listener: A user sends a text chat message
    socket.on('send-message', async (data) => {
      // Extract properties from payload explicitly
      const meetingId = data.meetingId;
      const message = data.message;
      const sender = data.sender;
      const senderId = data.senderId;

      // Broadcast message to everyone else in the meeting room
      socket.to(meetingId).emit('receive-message', { 
        message: message, 
        sender: sender, 
        timestamp: new Date() 
      });

      // Save the message content to the Mongoose meeting document
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
        console.log('Saved message from ' + sender + ' in meeting ' + meetingId + ' to database');
      } catch (err) {
        console.error('Failed to save message to DB:', err.message);
      }
    });

    // Listener: A client leaves the meeting room explicitly
    socket.on('leave-meeting', (meetingId) => {
      // Remove this client's socket from the room channel
      socket.leave(meetingId);
      
      // Notify other clients in the room that this user has left
      socket.to(meetingId).emit('user-left', { socketId: socket.id });
    });

    // Listener: A client changes their local device mute state (audio microphone or video camera)
    socket.on('toggle-mute', (data) => {
      const meetingId = data.meetingId;
      const type = data.type;
      const isMuted = data.isMuted;

      // Broadcast this user's new mute state to all other room members
      socket.to(meetingId).emit('user-mute-state', { 
        socketId: socket.id, 
        type: type, 
        isMuted: isMuted 
      });
    });

    // Listener: A client disconnects completely (e.g. closes browser tab or network drops)
    socket.on('disconnect', () => {
      console.log('User disconnected: ' + socket.id);

      // Notify ALL meeting rooms this socket was in that the participant left.
      // socket.rooms is a Set that always contains the socket's own ID room plus
      // any rooms joined via socket.join(). We skip the self-room (socket.id).
      // Without this, disconnected participants stay in peers' participant lists
      // forever — so when they reconnect with a new socket ID, two entries appear.
      socket.rooms.forEach((roomId) => {
        if (roomId !== socket.id) {
          socket.to(roomId).emit('user-left', { socketId: socket.id });
          console.log('Emitted user-left for ' + socket.id + ' in room ' + roomId);
        }
      });
    });

    // ----- WebRTC Peer-to-Peer Signaling Events -----
    // Peer-to-peer WebRTC connections require clients to swap local media session descriptions 
    // and network pathways (ICE Candidates) through a signaling intermediary.
    
    // Relay WebRTC SDP Offer from caller to target peer
    socket.on('webrtc-offer', (data) => {
      // Extract target ID and WebRTC parameters explicitly
      const targetSocketId = data.targetSocketId;
      const offer = data.offer;
      const senderName = data.senderName;
      const isMicMuted = data.isMicMuted;
      const isVideoMuted = data.isVideoMuted;

      // Relay parameters to the designated target client
      socket.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer: offer,
        senderName: senderName,
        isMicMuted: isMicMuted,
        isVideoMuted: isVideoMuted
      });
    });

    // Relay WebRTC SDP Answer back from target peer to caller
    socket.on('webrtc-answer', (data) => {
      // Extract target ID and parameters explicitly
      const targetSocketId = data.targetSocketId;
      const answer = data.answer;
      const senderName = data.senderName;
      const isMicMuted = data.isMicMuted;
      const isVideoMuted = data.isVideoMuted;

      // Relay parameters to the designated target client
      socket.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        answer: answer,
        senderName: senderName,
        isMicMuted: isMicMuted,
        isVideoMuted: isVideoMuted
      });
    });

    // Relay WebRTC ICE Candidates (network routes) between peers
    socket.on('webrtc-ice-candidate', (data) => {
      const targetSocketId = data.targetSocketId;
      const candidate = data.candidate;

      // Send routing paths to designated receiver
      socket.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate: candidate
      });
    });
  });
};

// Export setup function
module.exports = setupMeetingSocket;

