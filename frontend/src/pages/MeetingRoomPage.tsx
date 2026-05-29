import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import './MeetingRoomPage.css';

// TypeScript schema for chat messages exchanged in the room
interface ChatMessage {
  sender: string;
  message: string;
  timestamp: string;
}

/**
 * MeetingRoomPage Component
 * Core interface for real-time video conferencing. It combines:
 * 1. WebRTC peer connections to share camera/mic streams directly peer-to-peer.
 * 2. Socket.io to coordinate signaling events (offers, answers, ice candidates) and live chat text sync.
 */
const MeetingRoomPage: React.FC = () => {
  // Extract the meeting ID parameter from the URL path (/meeting/:id)
  const { id } = useParams<{ id: string }>();
  
  // React Router navigate hook to redirect pages (e.g. leaving the meeting)
  const navigate = useNavigate();
  
  // Get details of the currently logged-in user
  const { user } = useAuthStore();
  
  // React states to hold reactive UI values
  const [messages, setMessages] = useState<ChatMessage[]>([]); // Chat messages list
  const [messageInput, setMessageInput] = useState(''); // Current chat input field text
  const [participants, setParticipants] = useState<string[]>([]); // Active participant socket IDs in the room
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({}); // Maps peer socket ID to their video/audio stream
  const [mediaError, setMediaError] = useState<string | null>(null); // Stores permissions errors when fetching webcam/mic
  
  // Refs are used to keep persistent object references that persist across rendering cycles without triggering re-renders
  const socketRef = useRef<Socket | null>(null); // WebSocket client instance
  const localStreamRef = useRef<MediaStream | null>(null); // Local camera/mic media stream object
  const localVideoRef = useRef<HTMLVideoElement>(null); // Ref referencing the HTML local video element
  const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // Stores active RTCPeerConnection instances mapped by participant socket ID

  // WebRTC STUN server configurations used by peers to discover their public IP routing addresses
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Main React Hook: Sets up camera/mic, initializes socket events, and handles cleanup on exit
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if the user leaves the page early

    const initMeeting = async () => {
      // Step 1: Request permission to access user camera and microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // If user left the page before camera granted permission, stop the camera tracks immediately
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        // Save stream in ref and bind it to the local video HTML element for playback
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing media devices.", err);
        // Show non-blocking warning if camera fails (e.g. no webcam found or permission blocked)
        if (isMounted) {
          setMediaError("Could not access camera/microphone. You can still join without video.");
        }
      }
      
      // Stop initialization if component got unmounted
      if (!isMounted) return;

      // Step 2: Establish Socket.io connection to backend server
      const socketHost = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
      socketRef.current = io(`http://${socketHost}:5000`);

      if (socketRef.current) {
        // Send a join-meeting socket notification to join the specified room
        socketRef.current.emit('join-meeting', id);

        // SOCKET EVENT LISTENER: A new participant joined the room
        socketRef.current.on('user-joined', ({ socketId }) => {
          setParticipants(prev => {
            if (!prev.includes(socketId)) return [...prev, socketId];
            return prev;
          });
          
          // Initiate a new WebRTC Peer Connection with the incoming participant (isInitiator = true)
          createPeerConnection(socketId, true);
        });

        // SOCKET EVENT LISTENER: Relays incoming WebRTC SDP Offer from another client
        socketRef.current.on('webrtc-offer', async ({ senderSocketId, offer }) => {
          setParticipants(prev => {
            if (!prev.includes(senderSocketId)) return [...prev, senderSocketId];
            return prev;
          });
          
          // Create matching peer connection (isInitiator = false)
          const pc = createPeerConnection(senderSocketId, false);
          try {
            // Apply offer data as the remote description
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Create a matching WebRTC Answer
            const answer = await pc.createAnswer();
            
            // Set local description
            await pc.setLocalDescription(answer);
            
            // Send the answer back to the calling peer via socket signaling
            socketRef.current?.emit('webrtc-answer', { targetSocketId: senderSocketId, answer });
          } catch (err) {
            console.error("Error handling offer:", err);
          }
        });

        // SOCKET EVENT LISTENER: Relays incoming WebRTC SDP Answer from another client
        socketRef.current.on('webrtc-answer', async ({ senderSocketId, answer }) => {
          const pc = peersRef.current[senderSocketId];
          if (pc) {
            try {
              // Apply answer details to establish peer call connection handshake
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
              console.error("Error handling answer:", err);
            }
          }
        });

        // SOCKET EVENT LISTENER: Relays incoming WebRTC ICE Candidates (network paths) from another client
        socketRef.current.on('webrtc-ice-candidate', async ({ senderSocketId, candidate }) => {
          const pc = peersRef.current[senderSocketId];
          if (pc && candidate) {
            try {
              // Add candidate route pathways directly to peer connection
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding ice candidate:", err);
            }
          }
        });

        // SOCKET EVENT LISTENER: A participant left the meeting room
        socketRef.current.on('user-left', ({ socketId }) => {
          // Remove client ID from state list
          setParticipants(prev => prev.filter(p => p !== socketId));
          
          // Close connection and remove reference from peers object
          if (peersRef.current[socketId]) {
            peersRef.current[socketId].close();
            delete peersRef.current[socketId];
          }
          
          // Remove client's remote video stream from dashboard interface
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
        });

        // SOCKET EVENT LISTENER: Receive incoming chat messages
        socketRef.current.on('receive-message', (data: ChatMessage) => {
          setMessages(prev => [...prev, data]);
        });
      }
    };

    // Trigger meeting connection startup logic
    initMeeting();

    // CLEANUP FUNCTION: Executes automatically when user navigates away or closes page
    return () => {
      isMounted = false;
      
      // Stop local webcam capture tracks to turn off camera lights
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close all open WebRTC connection instances
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      
      // Disconnect socket client from server
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [id]);

  /**
   * Helper function to instantiate a new RTCPeerConnection object for a participant.
   * @param {string} socketId - Target peer's WebSocket ID connection.
   * @param {boolean} isInitiator - True if calling peer, False if receiving peer.
   * @returns {RTCPeerConnection} Compiled WebRTC peer connection object.
   */
  const createPeerConnection = (socketId: string, isInitiator: boolean) => {
    // If connection already exists, return the active instance to avoid duplicate setups
    if (peersRef.current[socketId]) {
      return peersRef.current[socketId];
    }

    // Create a new RTCPeerConnection using standard STUN servers configurations
    const pc = new RTCPeerConnection(configuration);
    peersRef.current[socketId] = pc;

    // WebRTC Callback: Triggers when the client discovers a network pathway (ICE Candidate)
    pc.onicecandidate = event => {
      if (event.candidate) {
        // Send candidate pathway details to target peer via signaling socket channel
        socketRef.current?.emit('webrtc-ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // WebRTC Callback: Triggers when the target peer starts transmitting video/audio track streams
    pc.ontrack = event => {
      if (event.streams && event.streams[0]) {
        // Store remote stream object to render in participant grid dashboard
        setRemoteStreams(prev => ({
          ...prev,
          [socketId]: event.streams[0]
        }));
      }
    };

    // Add local camera/mic stream tracks to the connection so remote peer receives it
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // If initiator client: create offer, apply description locally, and transmit offer details to target peer
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit('webrtc-offer', {
            targetSocketId: socketId,
            offer: pc.localDescription
          });
        })
        .catch(console.error);
    }

    return pc;
  };

  // Helper method: Send chat text message to other participants inside meeting
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socketRef.current) return;

    const chatData = {
      meetingId: id,
      message: messageInput,
      sender: user?.name || 'Anonymous',
    };

    // Send the chat message event to backend
    socketRef.current.emit('send-message', chatData);
    
    // Add the message directly to local message list UI
    setMessages(prev => [...prev, { ...chatData, timestamp: new Date().toISOString() }]);
    
    // Clear chat field text
    setMessageInput('');
  };

  return (
    <div className="meeting-room-container">
      
      {/* HEADER PANEL */}
      <header className="meeting-header">
        <div className="header-left">
          <h2>Meeting Room: {id}</h2>
        </div>
        <div className="header-right">
          <button className="leave-btn" onClick={() => navigate('/dashboard')}>
            Leave Meeting
          </button>
        </div>
      </header>

      {/* MEET CONTENT AREA */}
      <div className="meeting-content">
        
        {/* LEFT: Video stream displays */}
        <div className="video-area">
          {mediaError && <div className="media-error-alert">{mediaError}</div>}
          
          <div className="main-video-placeholder">
            {/* Local Client Webcam Display */}
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted // Mute local camera preview to avoid feedback echoes
              playsInline 
              className="main-video-stream"
            />
            <div className="video-overlay">
              <span className="participant-name">{user?.name} (You)</span>
            </div>
          </div>
          
          {/* Grid display for Remote participants */}
          <div className="participants-grid">
            {participants.map(pId => (
              <div key={pId} className="participant-video">
                
                {/* Render remote video if remote stream is established */}
                {remoteStreams[pId] ? (
                  <video 
                    autoPlay 
                    playsInline 
                    className="remote-video-stream"
                    // Assign stream to video HTML element dynamically as ref updates
                    ref={(el) => {
                      if (el && el.srcObject !== remoteStreams[pId]) {
                        el.srcObject = remoteStreams[pId];
                      }
                    }}
                  />
                ) : (
                  // Fallback connection screen
                  <div className="video-loading">Connecting to {pId.substring(0,4)}...</div>
                )}
                
                <span className="participant-name">Participant {pId.substring(0,4)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Meeting Sidebar Chat */}
        <div className="meeting-sidebar">
          <div className="chat-section">
            <h3 className="chat-header">In-Call Chat</h3>
            
            {/* Chats Messages logs */}
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.sender === user?.name ? 'own' : ''}`}>
                  <span className="msg-sender">{msg.sender}</span>
                  <p className="msg-text">{msg.message}</p>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="empty-chat">No messages yet. Say hello!</p>
              )}
            </div>
            
            {/* Message input form */}
            <form onSubmit={sendMessage} className="chat-input-form">
              <input 
                type="text" 
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit">Send</button>
            </form>
            
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default MeetingRoomPage;
