import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import API from '../services/api';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff,
  Lock, X, Send, Shield, Plus, Volume2, Home
} from 'lucide-react';
import './MeetingRoomPage.css';

// Schema for messages sent inside the chat drawer
interface ChatMessage {
  sender: string;
  message: string;
  timestamp: string;
}

// Simple helper function to extract user initials from their full name
const getInitials = (fullName: string): string => {
  // If name is empty, fallback to 'Participant'
  const name = fullName || 'Participant';
  // Split the name string into an array of words
  const parts = name.split(' ');
  // Initialize accumulator for initials
  let initials = '';
  // Loop through words to get the first letter of each
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part && part.length > 0) {
      initials += part.charAt(0);
    }
    // Restrict initials length to at most 2 characters
    if (initials.length >= 2) {
      break;
    }
  }
  // Return the initials in uppercase format
  return initials.toUpperCase();
};

// Sub-component to bind and render remote participant video streams cleanly
interface RemoteVideoProps {
  stream: MediaStream;
}

const RemoteVideo: React.FC<RemoteVideoProps> = (props) => {
  const stream = props.stream;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Monitor stream updates and bind to video DOM element
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  return (
    <video 
      ref={videoRef}
      autoPlay 
      playsInline 
      className="meet-video-stream remote"
    />
  );
};

// Sub-component to bind and render local participant video streams cleanly
interface LocalVideoProps {
  stream: MediaStream;
}

const LocalVideo: React.FC<LocalVideoProps> = (props) => {
  const stream = props.stream;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Monitor stream updates and bind to video DOM element
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream]);

  return (
    <video 
      ref={videoRef}
      autoPlay 
      muted
      playsInline 
      className="meet-video-stream"
    />
  );
};

const MeetingRoomPage: React.FC = () => {
  // Extract meeting ID from URL params
  const params = useParams<{ id: string }>();
  const id = params.id;
  
  // Router hook to redirect users back to dashboard
  const navigate = useNavigate();
  
  // Fetch active user context from Zustand authentication store
  const authStore = useAuthStore();
  const user = authStore.user;
  
  // State: holds meeting settings and info from MongoDB
  const [meeting, setMeeting] = useState<any>(null);
  
  // State: lists chat messages sent during the call
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // State: controls the user's text input inside chat form
  const [messageInput, setMessageInput] = useState('');
  
  // State: tracks socket IDs of other peers in the room
  const [participants, setParticipants] = useState<string[]>([]);
  
  // State: mappings of remote socket IDs to their respective MediaStreams
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  // State: error description when hardware devices can't be fetched
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // State: retry attempt counter to re-trigger media access
  const [mediaRetryCount, setMediaRetryCount] = useState(0);

  // State: stores local media stream so React re-renders when it becomes available
  // (useRef alone won't trigger the video element srcObject binding effect)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // State: checks if the local user is presenting their screen
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // State: toggle mic status for local user
  const [isMicMuted, setIsMicMuted] = useState(false);
  
  // State: toggle camera status for local user
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  
  // State: keeps track of remote participant mute states (audio/video)
  const [remoteMuteStates, setRemoteMuteStates] = useState<Record<string, { audio: boolean, video: boolean }>>({});
  
  // State: lists name text for each socket participant
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  
  // State: sidebar display selector (chat log vs access settings drawer)
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'settings' | null>(null);
  
  // State: confirms if sharing info has been copied to clipboard
  const [copied, setCopied] = useState(false);
  
  // State: guest name text entered in the lobby before joining
  const [guestName, setGuestName] = useState('');
  
  // State: flag to bypass lobby if user is already signed in
  const [isReadyToJoin, setIsReadyToJoin] = useState(!!user);
  
  // State: block page if access is restricted
  const [restrictionError, setRestrictionError] = useState<string | null>(null);
  
  
  // State: text to type guest invite email
  const [newInviteEmail, setNewInviteEmail] = useState('');
  
  // State: loader indicator during access list modifications
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // References to keep persistent state values across renders without re-rendering
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // ICE server configuration: STUN + TURN servers for NAT traversal.
  // STUN servers help peers discover their public IP/port (works for simple NAT).
  // TURN servers RELAY media traffic when direct peer-to-peer paths fail — this is
  // required on mobile 5G/LTE networks which use symmetric NAT (STUN alone fails).
  // Using free Open Relay Project TURN servers for production connectivity.
  const configuration = {
    iceServers: [
      // Google STUN — fast direct connection when possible
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Open Relay free TURN — port 80 (bypasses most firewalls)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Open Relay free TURN — port 443 (HTTPS port, almost never blocked)
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Open Relay free TURN over TCP — fallback when UDP is blocked
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    // Prioritise relay candidates so mobile connections succeed faster
    iceCandidatePoolSize: 10
  };

  // EFFECT: Fetch meeting configuration and check credentials on load
  useEffect(() => {
    let isMounted = true;
    
    const fetchMeeting = async () => {
      try {
        const response = await API.get('/meetings/' + id);
        if (isMounted) {
          setMeeting(response.data);
          setRestrictionError(null);
        }
      } catch (err: any) {
        console.error("Failed to load meeting details from DB", err);
        if (isMounted) {
          if (err.response?.status === 403 || err.response?.data?.isRestricted) {
            setRestrictionError(err.response?.data?.message || "This meeting is restricted. You are not authorized to join.");
          } else {
            setRestrictionError("Meeting not found or server is unreachable.");
          }
        }
      }
    };
    
    fetchMeeting();
    
    return () => {
      isMounted = false;
    };
  }, [id]);

  // EFFECT: Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // EFFECT: Access local media stream and initialize websocket connection
  useEffect(() => {
    if (!isReadyToJoin || !meeting || restrictionError) return;
    let isMounted = true;

    const initMeeting = async () => {
      // ── Media acquisition with graceful fallbacks ──────────────────────────
      // Try: video+audio → audio only → no media (chat only)
      // This ensures the meeting works even if camera/mic is unavailable.
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setMediaError("Camera/microphone not supported on this browser. Make sure you are on a secure (HTTPS) connection.");
        }
      } else {
        try {
          // Attempt 1: full video + audio
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
          localStreamRef.current = stream;
          setLocalStream(stream);
          setMediaError(null);
        } catch (videoErr: any) {
          console.warn('Video+audio failed:', videoErr.name);

          // Always try audio-only next — even on NotAllowedError.
          // Mobile Chrome sometimes only blocks the camera permission but still
          // allows microphone, so a separate audio-only request can succeed.
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            if (!isMounted) { audioStream.getTracks().forEach(t => t.stop()); return; }
            localStreamRef.current = audioStream;
            setLocalStream(audioStream);
            if (isMounted) {
              if (videoErr.name === 'NotAllowedError' || videoErr.name === 'PermissionDeniedError') {
                setMediaError("📷 Camera was blocked — joined with microphone only. Tap the 🔒 lock in the address bar → Site settings → Allow Camera, then tap Retry.");
              } else {
                setMediaError("Camera unavailable — joined with microphone only.");
              }
            }
          } catch (audioErr: any) {
            console.warn('Audio-only also failed:', audioErr.name);
            if (isMounted) {
              if (videoErr.name === 'NotAllowedError' || videoErr.name === 'PermissionDeniedError') {
                // Both camera and mic were blocked — give clear mobile step-by-step guide
                setMediaError("🎤 Camera & microphone blocked. To fix:\n1. Tap the 🔒 lock icon in your browser address bar\n2. Tap Site settings or Permissions\n3. Set Camera and Microphone to Allow\n4. Tap the Retry button");
              } else if (audioErr.name === 'NotFoundError' || audioErr.name === 'DevicesNotFoundError') {
                setMediaError("No camera or microphone found on this device. You can still join and use chat.");
              } else {
                setMediaError("Could not access camera/microphone. You can still see and hear others.");
              }
            }
          }
        }
      }
      
      if (!isMounted) return;
      
      // ── Resolve WebSocket server URL ──────────────────────────────────────
      // Priority: VITE_SOCKET_URL → derived from VITE_API_URL → localhost fallback
      // On production (Vercel), VITE_SOCKET_URL or VITE_API_URL must be set in
      // Vercel environment variables pointing to the Render backend.
      let socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
      if (!socketUrl) {
        const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
        if (apiUrl) {
          // Strip the /api suffix to get the base server URL for WebSockets
          socketUrl = apiUrl.replace(/\/api\/?$/, '');
        } else {
          // Local development fallback
          const socketHost = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
          socketUrl = 'http://' + socketHost + ':5000';
        }
      }
      
      // Connect to WebSocket server
      socketRef.current = io(socketUrl);

      if (socketRef.current) {
        // Send join meeting request payload
        socketRef.current.emit('join-meeting', { 
          meetingId: id, 
          userId: user?._id, 
          name: user?.name || guestName 
        });

        // Event: A new participant joins the room
        socketRef.current.on('user-joined', (payload) => {
          const socketId = payload.socketId;
          const participantName = payload.name;

          setParticipants((prev) => {
            const list = [];
            for (let i = 0; i < prev.length; i++) {
              list.push(prev[i]);
            }
            if (list.indexOf(socketId) === -1) {
              list.push(socketId);
            }
            return list;
          });

          if (participantName) {
            setParticipantNames((prev) => {
              const obj = { ...prev };
              obj[socketId] = participantName;
              return obj;
            });
          }

          // Instantiate a Peer Connection as initiator (isInitiator = true)
          createPeerConnection(socketId, true);
        });

        // Event: Relays WebRTC Offer from remote peer
        socketRef.current.on('webrtc-offer', async (payload) => {
          const senderSocketId = payload.senderSocketId;
          const offer = payload.offer;
          const senderName = payload.senderName;
          const remoteMicMuted = payload.isMicMuted;
          const remoteVideoMuted = payload.isVideoMuted;

          setParticipants((prev) => {
            const list = [];
            for (let i = 0; i < prev.length; i++) {
              list.push(prev[i]);
            }
            if (list.indexOf(senderSocketId) === -1) {
              list.push(senderSocketId);
            }
            return list;
          });

          if (senderName) {
            setParticipantNames((prev) => {
              const obj = { ...prev };
              obj[senderSocketId] = senderName;
              return obj;
            });
          }

          setRemoteMuteStates((prev) => {
            const obj = { ...prev };
            obj[senderSocketId] = { audio: !!remoteMicMuted, video: !!remoteVideoMuted };
            return obj;
          });
          
          // Instantiate a Peer Connection (isInitiator = false)
          const pc = createPeerConnection(senderSocketId, false);
          try {
            // Apply offer as remote session description
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Create corresponding local Answer description
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            // Send answer back to the signaling post
            let localMicMuted = false;
            let localVideoMuted = false;
            if (localStreamRef.current) {
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              if (audioTrack) {
                localMicMuted = !audioTrack.enabled;
              }
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack) {
                localVideoMuted = !videoTrack.enabled;
              }
            }

            socketRef.current?.emit('webrtc-answer', { 
              targetSocketId: senderSocketId, 
              answer: answer, 
              senderName: user?.name || guestName,
              isMicMuted: localMicMuted,
              isVideoMuted: localVideoMuted
            });
          } catch (err) {
            console.error("Error handling offer:", err);
          }
        });

        // Event: Relays WebRTC Answer from remote peer
        socketRef.current.on('webrtc-answer', async (payload) => {
          const senderSocketId = payload.senderSocketId;
          const answer = payload.answer;
          const senderName = payload.senderName;
          const remoteMicMuted = payload.isMicMuted;
          const remoteVideoMuted = payload.isVideoMuted;

          const pc = peersRef.current[senderSocketId];
          if (pc) {
            try {
              // Apply answer as remote description
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              if (senderName) {
                setParticipantNames((prev) => {
                  const obj = { ...prev };
                  obj[senderSocketId] = senderName;
                  return obj;
                });
              }
              setRemoteMuteStates((prev) => {
                const obj = { ...prev };
                obj[senderSocketId] = { audio: !!remoteMicMuted, video: !!remoteVideoMuted };
                return obj;
              });
            } catch (err) {
              console.error("Error handling answer:", err);
            }
          }
        });

        // Event: Relays ICE Candidate pathway configuration
        socketRef.current.on('webrtc-ice-candidate', async (payload) => {
          const senderSocketId = payload.senderSocketId;
          const candidate = payload.candidate;

          const pc = peersRef.current[senderSocketId];
          if (pc && candidate) {
            try {
              // Register new network endpoint candidate to current connection
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding ice candidate:", err);
            }
          }
        });

        // Event: Relays remote user mute states changes
        socketRef.current.on('user-mute-state', (payload) => {
          const socketId = payload.socketId;
          const type = payload.type;
          const remoteMuted = payload.isMuted;

          setRemoteMuteStates((prev) => {
            const obj = { ...prev };
            const current = obj[socketId] || { audio: false, video: false };
            
            if (type === 'audio') {
              obj[socketId] = { audio: !!remoteMuted, video: current.video };
            } else {
              obj[socketId] = { audio: current.audio, video: !!remoteMuted };
            }
            return obj;
          });
        });

        // Event: A remote participant leaves the call
        socketRef.current.on('user-left', (payload) => {
          const socketId = payload.socketId;

          // Remove socket from states list
          setParticipants((prev) => {
            const list = [];
            for (let i = 0; i < prev.length; i++) {
              if (prev[i] !== socketId) {
                list.push(prev[i]);
              }
            }
            return list;
          });

          // Clean up participant tracking references
          setParticipantNames((prev) => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });

          setRemoteMuteStates((prev) => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
          
          if (peersRef.current[socketId]) {
            peersRef.current[socketId].close();
            delete peersRef.current[socketId];
          }
          
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
        });

        // Event: Synchronizes live room chat messages
        socketRef.current.on('receive-message', (data: ChatMessage) => {
          setMessages((prev) => {
            const list = [];
            for (let i = 0; i < prev.length; i++) {
              list.push(prev[i]);
            }
            list.push(data);
            return list;
          });
        });
      }
    };

    initMeeting();

    // CLEANUP: Close camera feeds and sockets on navigation away
    return () => {
      isMounted = false;
      
      // Stop webcam and microphone tracks
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].stop();
        }
      }
      
      // Close WebRTC peer links
      const activePeers = Object.values(peersRef.current);
      for (let i = 0; i < activePeers.length; i++) {
        activePeers[i].close();
      }
      peersRef.current = {};
      
      // Leave room channel and terminate socket
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [id, isReadyToJoin, !!meeting, !!restrictionError, mediaRetryCount]);

  // Helper method: builds new RTCPeerConnection object and hooks events
  const createPeerConnection = (socketId: string, isInitiator: boolean) => {
    // Deduplicate: if a connection to this socket already exists and is not closed, reuse it.
    // This prevents multiple "Connecting to Pavan..." spinners when the socket reconnects
    // (e.g. Render cold-start causes a brief disconnect then reconnect with a new socket ID).
    if (peersRef.current[socketId]) {
      const existing = peersRef.current[socketId];
      // Only reuse if the connection is still viable
      if (existing.signalingState !== 'closed') {
        return existing;
      }
      // If closed, remove it so we recreate below
      delete peersRef.current[socketId];
    }

    const pc = new RTCPeerConnection(configuration);
    peersRef.current[socketId] = pc;

    // Send local ICE candidates to target peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // Receive remote media tracks and save them to streams state
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setRemoteStreams((prev) => {
          const obj = { ...prev };
          obj[socketId] = stream;
          return obj;
        });
      }
    };

    // Attach local camera/mic tracks to feed the connection.
    // IMPORTANT: If no local stream is available (camera/mic denied or unavailable),
    // we MUST still add recvonly transceivers. Without transceivers the SDP offer/answer
    // has zero media sections and WebRTC negotiation silently fails — meaning the local
    // user cannot hear or see the remote participant even though they have their camera on.
    if (localStreamRef.current) {
      // We have local media — add tracks normally (sendrecv by default)
      const tracks = localStreamRef.current.getTracks();
      for (let i = 0; i < tracks.length; i++) {
        pc.addTrack(tracks[i], localStreamRef.current);
      }
    } else {
      // No local media — add receive-only transceivers so we can still RECEIVE
      // the remote participant's audio and video stream.
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch (transceiverErr) {
        // Older browsers (e.g. Safari 12) don't support addTransceiver.
        // In that case the SDP negotiation may still work partially via offer/answer.
        console.warn('addTransceiver not supported on this browser:', transceiverErr);
      }
    }

    // SDP Offer compilation for call initiator
    if (isInitiator) {
      const startNegotiation = async () => {
        try {
          // Create the WebRTC offer description
          const offer = await pc.createOffer();
          
          // Save the offer description as local state on this PeerConnection
          await pc.setLocalDescription(offer);
          
          // Determine if mic and video are enabled on the local stream
          let micMuted = false;
          let videoMuted = false;
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              micMuted = !audioTrack.enabled;
            }
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
              videoMuted = !videoTrack.enabled;
            }
          }

          // Emit the offer and user information to signaling channel
          if (socketRef.current) {
            socketRef.current.emit('webrtc-offer', {
              targetSocketId: socketId,
              offer: pc.localDescription,
              senderName: user?.name || guestName,
              isMicMuted: micMuted,
              isVideoMuted: videoMuted
            });
          }
        } catch (err) {
          console.error("Error creating WebRTC offer:", err);
        }
      };
      
      startNegotiation();
    }

    return pc;
  };

  // Handler: toggle microphone track mute
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
        socketRef.current?.emit('toggle-mute', { 
          meetingId: id, 
          type: 'audio', 
          isMuted: !audioTrack.enabled 
        });
      }
    }
  };

  // Handler: toggle camera stream track mute
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
        socketRef.current?.emit('toggle-mute', { 
          meetingId: id, 
          type: 'video', 
          isMuted: !videoTrack.enabled 
        });
      }
    }
  };

  // Handler: request screen capture stream and swap tracks on peer links
  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Swap video track in all active peer connections
      const connectionsList = Object.values(peersRef.current);
      for (let i = 0; i < connectionsList.length; i++) {
        const pc = connectionsList[i];
        const senders = pc.getSenders();
        for (let j = 0; j < senders.length; j++) {
          const sender = senders[j];
          if (sender.track && sender.track.kind === 'video') {
            sender.replaceTrack(screenTrack);
          }
        }
      }

      setIsScreenSharing(true);

      // Restore camera feeds when presentation concludes
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Failed to start screen sharing:", err);
    }
  };

  // Handler: turn off screen presentation and restore local camera video tracks
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      const tracks = screenStreamRef.current.getTracks();
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].stop();
      }
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      
      const connectionsList = Object.values(peersRef.current);
      for (let i = 0; i < connectionsList.length; i++) {
        const pc = connectionsList[i];
        const senders = pc.getSenders();
        for (let j = 0; j < senders.length; j++) {
          const sender = senders[j];
          if (sender.track && sender.track.kind === 'video' && cameraTrack) {
            sender.replaceTrack(cameraTrack);
          }
        }
      }
    }

    setIsScreenSharing(false);
  };

  // Handler: host closes meeting and calls status updater API
  const endMeeting = async () => {
    const confirmChoice = window.confirm("Are you sure you want to end this meeting for everyone? This will conclude the meeting and generate an AI summary.");
    if (!confirmChoice) return;
    
    try {
      await API.patch('/meetings/' + id + '/status', { status: 'completed' });
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to end meeting:", err);
      alert("Failed to conclude the meeting. Please try again.");
    }
  };

  // Handler: send text chat message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socketRef.current) return;

    const chatData = {
      meetingId: id,
      message: messageInput,
      sender: user?.name || guestName || 'Anonymous',
      senderId: user?._id
    };

    socketRef.current.emit('send-message', chatData);
    
    setMessages((prev) => {
      const list = [];
      for (let i = 0; i < prev.length; i++) {
        list.push(prev[i]);
      }
      list.push({ 
        sender: chatData.sender, 
        message: chatData.message, 
        timestamp: new Date().toISOString() 
      });
      return list;
    });

    setMessageInput('');
  };

  // Fallback clipboard copying routine
  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        alert("Could not copy link automatically. Please copy it manually: " + text);
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
      alert("Could not copy link automatically. Please copy it manually: " + text);
    }
    document.body.removeChild(textArea);
  };

  // Copy meeting link with browser Clipboard API
  const copyMeetingLink = () => {
    const link = window.location.origin + '/meeting/' + id;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy link with clipboard API: ', err);
        fallbackCopyText(link);
      });
    } else {
      fallbackCopyText(link);
    }
  };

  // Handler: send updated security restriction settings array to DB
  const updateAccessSettings = async (newType: 'public' | 'restricted', emails: string[]) => {
    setIsSavingAccess(true);
    try {
      const response = await API.patch('/meetings/' + id + '/access', {
        accessType: newType,
        invitedEmails: emails
      });
      setMeeting(response.data);
    } catch (err) {
      console.error("Failed to update access settings:", err);
      alert("Failed to update share settings. Make sure you are the host.");
    } finally {
      setIsSavingAccess(false);
    }
  };

  // Toggle privacy mode setting
  const handleToggleAccessType = (newType: 'public' | 'restricted') => {
    if (!meeting) return;
    updateAccessSettings(newType, meeting.invitedEmails || []);
  };

  // Verify and add invited email address to host access list
  const handleAddInviteEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !newInviteEmail.trim()) return;
    const emailToAdd = newInviteEmail.trim().toLowerCase();
    
    // Check basic regex email layout structure
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToAdd)) {
      alert("Please enter a valid email address.");
      return;
    }

    const currentEmails = meeting.invitedEmails || [];
    if (currentEmails.indexOf(emailToAdd) !== -1) {
      alert("This email is already invited.");
      return;
    }

    const updatedEmails = [];
    for (let i = 0; i < currentEmails.length; i++) {
      updatedEmails.push(currentEmails[i]);
    }
    updatedEmails.push(emailToAdd);

    setNewInviteEmail('');
    updateAccessSettings(meeting.accessType, updatedEmails);
  };

  // Remove email address from host invite roster list
  const handleRemoveInviteEmail = (emailToRemove: string) => {
    if (!meeting) return;
    
    const currentEmails = meeting.invitedEmails || [];
    const updatedEmails = [];
    for (let i = 0; i < currentEmails.length; i++) {
      const email = currentEmails[i];
      if (email !== emailToRemove) {
        updatedEmails.push(email);
      }
    }
    
    updateAccessSettings(meeting.accessType, updatedEmails);
  };

  // Helpers to get local user initials
  const getLocalInitials = () => {
    const name = user?.name || guestName || 'ME';
    return getInitials(name);
  };

  // Helpers to get participant initials
  const getParticipantInitials = (pId: string) => {
    const name = participantNames[pId];
    return getInitials(name || 'Participant');
  };


  // Lobby form submit check
  const handleLobbySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim()) {
      setIsReadyToJoin(true);
    }
  };

  // VIEW 1: Restricted access warning window
  if (restrictionError) {
    return (
      <div className="restricted-container">
        <div className="restricted-card">
          <div className="restricted-icon-wrap">
            <Lock size={48} strokeWidth={1.5} />
          </div>
          <h2 className="restricted-title">Access Restricted</h2>
          <p className="restricted-message">{restrictionError}</p>
          <div className="restricted-actions">
            <button className="restricted-btn primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
            {!user ? (
              <button className="restricted-btn secondary" onClick={() => navigate('/auth')}>
                Sign In / Sign Up
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: Guest name entry lobby modal screen
  if (!isReadyToJoin) {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-brand">
            <div className="lobby-logo">IM</div>
            <span>IntellMeet Lobby</span>
          </div>
          <h2 className="lobby-title">Ready to join?</h2>
          <p className="lobby-subtitle">
            {meeting ? ('Enter your name to join "' + meeting.title + '"') : 'Enter your name to join the meeting room'}
          </p>
          <form onSubmit={handleLobbySubmit} className="lobby-form">
            <input 
              type="text" 
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Your name"
              required
              className="lobby-input"
              maxLength={30}
            />
            <button type="submit" className="lobby-join-btn">
              Join Meeting
            </button>
          </form>
          <div className="lobby-footer">
            <button className="lobby-back-btn" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 3: Main video call conference room layout (Redesigned)
  
  // Check if local video stream is available and active
  const hasLocalVideo = (isScreenSharing && screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0) ||
                        (!isScreenSharing && localStream && localStream.getVideoTracks().length > 0 && !isVideoMuted);

  // Assemble all video card structures (including local user and remote participants)
  const allVideoCards = [
    {
      id: 'local',
      name: `${user?.name || guestName} (You)`,
      isMicMuted: isMicMuted,
      element: hasLocalVideo ? (
        <LocalVideo stream={isScreenSharing ? screenStreamRef.current! : localStream!} />
      ) : (
        <div className="redesign-avatar-placeholder">
          <div className="redesign-avatar-circle">{getLocalInitials()}</div>
        </div>
      )
    },
    ...participants.map(pId => {
      const isRemoteVideoMuted = !!remoteMuteStates[pId]?.video;
      const isRemoteMicMuted = !!remoteMuteStates[pId]?.audio;
      const remoteName = participantNames[pId] || (`Guest (${pId.substring(0, 4)})`);
      const hasRemoteVideo = remoteStreams[pId] && remoteStreams[pId].getVideoTracks().length > 0 && !isRemoteVideoMuted;
      return {
        id: pId,
        name: remoteName,
        isMicMuted: isRemoteMicMuted,
        element: hasRemoteVideo ? (
          <RemoteVideo stream={remoteStreams[pId]} />
        ) : (
          remoteStreams[pId] ? (
            <div className="redesign-avatar-placeholder">
              <div className="redesign-avatar-circle">{getParticipantInitials(pId)}</div>
            </div>
          ) : (
            <div className="redesign-video-connecting">
              <div className="redesign-spinner"></div>
              <span>Connecting to {remoteName}...</span>
            </div>
          )
        )
      };
    })
  ];

  return (
    <div className="meet-redesign-container">
      
      {/* 1. LEFT SIDEBAR PANEL (White/Light) */}
      <aside className="meet-redesign-sidebar">
        
        {/* User profile section */}
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {getLocalInitials()}
          </div>
          <div className="profile-details">
            <span className="profile-name">{user?.name || guestName}</span>
            <span className="profile-status">
              <span className="status-dot green"></span> Available
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="sidebar-navigation">
          <button className="nav-button active" onClick={() => navigate('/dashboard')}>
            <span className="nav-icon-wrap"><Home size={18} /></span> Home
          </button>
          <button className="nav-button" onClick={() => navigate('/dashboard')}>
            <span className="nav-icon-wrap"><Plus size={18} /></span> New
          </button>
        </nav>

        {/* Contacts / Call Participants Section */}
        <div className="sidebar-contacts-section">
          <span className="contacts-title">Contacts</span>
          
          {/* Active Call Group */}
          <div className="active-call-group">
            <div className="group-avatar-row">
              <span className="group-icon">📞</span>
            </div>
            <div className="group-names-wrap">
              <span className="group-names">
                {participants.length > 0 
                  ? [user?.name || guestName, ...participants.map(p => participantNames[p] || 'Guest')].join(', ')
                  : 'Just You'}
              </span>
            </div>
            <button className="group-hangup-btn" onClick={() => navigate('/dashboard')} title="Leave Call">
              🛑
            </button>
          </div>

          {/* List of other participants / contacts in call */}
          <div className="contacts-list">
            {/* Local User */}
            <div className="contact-item">
              <div className="contact-avatar">
                {getLocalInitials()}
              </div>
              <span className="contact-name">{user?.name || guestName} (You)</span>
              <span className="contact-status-dot online"></span>
            </div>

            {/* Remote Users */}
            {participants.map(pId => {
              const name = participantNames[pId] || 'Guest';
              const initials = getParticipantInitials(pId);
              return (
                <div key={pId} className="contact-item">
                  <div className="contact-avatar">
                    {initials}
                  </div>
                  <span className="contact-name">{name}</span>
                  <span className="contact-status-dot online"></span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* 2. MAIN CALL PANEL (Dark Blue/Teal) */}
      <main className="meet-redesign-main">
        
        {/* Top Control/Search Bar */}
        <div className="main-top-bar">
          <div className="search-bar-mock" onClick={copyMeetingLink}>
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              readOnly 
              value={`Room: ${meeting?.title || id}`} 
              title="Click to copy meeting link"
            />
            <button className="search-copy-btn">
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Video Workspace Area */}
        <div className="main-video-workspace">
          
          {mediaError && (
            <div className="media-error-alert">
              <span>{mediaError}</span>
              <button 
                className="media-retry-btn" 
                onClick={() => {
                  setMediaError(null);
                  setMediaRetryCount(c => c + 1);
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Videos Grid with Redesigned layout */}
          <div className="redesign-videos-layout">
            
            {/* Top Row: up to 3 videos */}
            <div className="video-row top-row">
              {allVideoCards.slice(0, 3).map((card, idx) => (
                <div key={idx} className="redesign-video-card">
                  {card.element}
                  <div className="redesign-card-name">
                    {card.name}
                    {card.isMicMuted ? <span className="mic-muted-badge">🎙️ Off</span> : null}
                  </div>
                </div>
              ))}
            </div>

            {/* vertical pagination dots in between */}
            {allVideoCards.length > 3 && (
              <div className="pagination-dots">
                <span className="dot active"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            )}

            {/* Bottom Row: remaining videos (centered) */}
            {allVideoCards.length > 3 && (
              <div className="video-row bottom-row">
                {allVideoCards.slice(3, 6).map((card, idx) => (
                  <div key={idx} className="redesign-video-card centered">
                    {card.element}
                    <div className="redesign-card-name">
                      {card.name}
                      {card.isMicMuted ? <span className="mic-muted-badge">🎙️ Off</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
          </div>

          {/* Sliding Right Sidebar Drawer */}
          {activeSidebar !== null && (
            <div className="redesign-chat-drawer">
              <div className="drawer-header">
                <h3>{activeSidebar === 'chat' ? 'In-call Messages' : 'Access & Invites'}</h3>
                <button className="close-drawer-btn" onClick={() => setActiveSidebar(null)}>
                  <X size={20} />
                </button>
              </div>

              {/* 1. Chat Drawer Content */}
              {activeSidebar === 'chat' ? (
                <div className="drawer-chat-container">
                  <div className="chat-notice-banner">
                    <Shield size={14} className="banner-icon" />
                    <span>Messages are deleted when the call ends.</span>
                  </div>
                  <div className="drawer-chat-messages">
                    {messages.map((msg, index) => {
                      const isOwn = msg.sender === (user?.name || guestName);
                      const messageInitials = getInitials(msg.sender);
                      
                      return (
                        <div key={index} className={'meet-chat-msg-row ' + (isOwn ? 'own' : '')}>
                          {!isOwn ? (
                            <div className="chat-msg-avatar" title={msg.sender}>
                              {messageInitials}
                            </div>
                          ) : null}
                          <div className="chat-msg-bubble-wrap">
                            <div className="chat-msg-meta">
                              <span className="chat-msg-sender">{isOwn ? 'You' : msg.sender}</span>
                              <span className="chat-msg-time">
                                {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="meet-chat-text">{msg.message}</p>
                          </div>
                          {isOwn ? (
                            <div className="chat-msg-avatar own" title="You">
                              {messageInitials}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />

                    {messages.length === 0 ? (
                      <div className="empty-chat-container">
                        <div className="empty-chat-icon-wrap">
                          <MessageSquare size={36} strokeWidth={1.5} />
                        </div>
                        <h4>No messages yet</h4>
                        <p>Start the conversation with others.</p>
                      </div>
                    ) : null}
                  </div>
                  
                  <form onSubmit={sendMessage} className="meet-chat-input-form">
                    <input 
                      type="text" 
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      placeholder="Send a message..."
                    />
                    <button type="submit" disabled={!messageInput.trim()} className="send-msg-btn" title="Send message">
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              ) : (
                /* 2. Access Settings Drawer Content */
                <div className="drawer-settings-container">
                  <div className="access-options">
                    <button 
                      className={'access-pill ' + (meeting?.accessType === 'public' ? 'active' : '')}
                      onClick={() => handleToggleAccessType('public')}
                      disabled={isSavingAccess || meeting?.host?._id !== user?._id}
                    >
                      <span className="dot public-dot"></span>
                      Anyone with link (Public)
                    </button>
                    <button 
                      className={'access-pill ' + (meeting?.accessType === 'restricted' ? 'active' : '')}
                      onClick={() => handleToggleAccessType('restricted')}
                      disabled={isSavingAccess || meeting?.host?._id !== user?._id}
                    >
                      <span className="dot restricted-dot"></span>
                      Only invited guests (Restricted)
                    </button>
                  </div>

                  <div className="popover-share-link">
                    <h5>Meeting Link</h5>
                    <div className="popover-share-row">
                      <input 
                        type="text" 
                        readOnly 
                        value={window.location.origin + '/meeting/' + id} 
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        title="Click to select all"
                      />
                      <button type="button" onClick={copyMeetingLink}>
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="invited-guests-section">
                    <h5>Invited Guest List</h5>
                    {meeting?.host?._id === user?._id ? (
                      <form onSubmit={handleAddInviteEmail} className="invite-email-form">
                        <input
                          type="email"
                          value={newInviteEmail}
                          onChange={e => setNewInviteEmail(e.target.value)}
                          placeholder="Add guest email..."
                          disabled={isSavingAccess}
                        />
                        <button type="submit" disabled={isSavingAccess || !newInviteEmail.trim()}>
                          Add
                        </button>
                      </form>
                    ) : (
                      <p className="viewer-notice">Only the host can modify the guest list.</p>
                    )}

                    <div className="invited-emails-list">
                      {meeting?.invitedEmails && meeting.invitedEmails.length > 0 ? (
                        meeting.invitedEmails.map((email: string) => (
                          <div key={email} className="email-chip">
                            <span className="email-text" title={email}>{email}</span>
                            {meeting?.host?._id === user?._id ? (
                              <button 
                                type="button" 
                                className="remove-email-btn"
                                onClick={() => handleRemoveInviteEmail(email)}
                                disabled={isSavingAccess}
                                title={'Remove ' + email}
                              >
                                <X size={12} />
                              </button>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="no-emails-placeholder">No guest invitations sent yet.</p>
                      )}
                    </div>
                  </div>

                  {isSavingAccess && (
                    <div className="popover-loading-overlay">
                      <div className="popover-spinner"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating pill-shaped controls bar at the bottom */}
        <div className="redesign-controls-pill">
          {/* Screen Share */}
          <button 
            className={'control-btn ' + (isScreenSharing ? 'active' : '')} 
            onClick={isScreenSharing ? stopScreenShare : shareScreen}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            <Monitor size={20} />
          </button>

          {/* Toggle Chat */}
          <button 
            className={'control-btn ' + (activeSidebar === 'chat' ? 'active' : '')} 
            onClick={() => setActiveSidebar(prev => prev === 'chat' ? null : 'chat')}
            title="In-call Messages"
          >
            <MessageSquare size={20} />
          </button>

          {/* Toggle Video Camera */}
          <button 
            className={'control-btn ' + (isVideoMuted ? 'muted' : '')} 
            onClick={toggleVideo}
            title={isVideoMuted ? "Turn on Camera" : "Turn off Camera"}
          >
            {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Toggle Microphone */}
          <button 
            className={'control-btn ' + (isMicMuted ? 'muted' : '')} 
            onClick={toggleMic}
            title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Red End Call Hangup */}
          {meeting && user && meeting.host?._id === user._id && meeting.status !== 'completed' ? (
            <button 
              className="control-btn hangup" 
              onClick={endMeeting}
              title="End Meeting for Everyone"
            >
              <PhoneOff size={20} />
            </button>
          ) : (
            <button 
              className="control-btn hangup" 
              onClick={() => navigate('/dashboard')}
              title="Leave Call"
            >
              <PhoneOff size={20} />
            </button>
          )}

          {/* Visual audio level graphics mock */}
          <div className="audio-graphic-mock" title="Microphone Level">
            <Volume2 size={18} />
            <div className="audio-bars">
              <span className="bar active"></span>
              <span className="bar active"></span>
              <span className="bar"></span>
              <span className="bar"></span>
            </div>
          </div>

          {/* Add / Invite Participant settings drawer trigger */}
          <button 
            className={'control-btn ' + (activeSidebar === 'settings' ? 'active' : '')} 
            onClick={() => setActiveSidebar(prev => prev === 'settings' ? null : 'settings')}
            title="Invite & Settings"
          >
            <Plus size={20} />
          </button>
        </div>

      </main>

    </div>
  );
};

export default MeetingRoomPage;

