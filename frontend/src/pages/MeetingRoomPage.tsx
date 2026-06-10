import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import API from '../services/api';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, Users, PhoneOff,
  Lock, X, Send, Shield, Copy, Check, MoreVertical
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
  
  // State: sidebar display selector (chat log vs participant roster drawer)
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'participants' | null>(null);
  
  // State: confirms if sharing info has been copied to clipboard
  const [copied, setCopied] = useState(false);
  
  // State: guest name text entered in the lobby before joining
  const [guestName, setGuestName] = useState('');
  
  // State: flag to bypass lobby if user is already signed in
  const [isReadyToJoin, setIsReadyToJoin] = useState(!!user);
  
  // State: block page if access is restricted
  const [restrictionError, setRestrictionError] = useState<string | null>(null);
  
  // State: opens 3-dots share config dropdown
  const [showShareModal, setShowShareModal] = useState(false);
  
  // State: text to type guest invite email
  const [newInviteEmail, setNewInviteEmail] = useState('');
  
  // State: loader indicator during access list modifications
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // References to keep persistent state values across renders without re-rendering
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const screenStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // STUN servers configuration for network discovery
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
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
      try {
        // On mobile browsers, camera/mic requires HTTPS — provide a helpful message
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (isMounted) {
            setMediaError("Camera/microphone not supported. Make sure you are on a secure (HTTPS) connection.");
          }
        } else {
          // Request local user hardware access
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          
          if (!isMounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          // Save the stream locally
          localStreamRef.current = stream;
          setMediaError(null); // Clear any previous error
          
          // Assign stream directly to video ref if bound
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err: any) {
        console.error("Error accessing media devices.", err);
        if (isMounted) {
          // Provide specific messages for different failure modes
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setMediaError("Camera/microphone access was denied. Please allow permissions in your browser settings and tap the retry button below.");
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setMediaError("No camera or microphone found on this device. You can still join and chat.");
          } else if (err.name === 'NotReadableError') {
            setMediaError("Camera/microphone is being used by another app. Close other video apps and tap retry.");
          } else {
            setMediaError("Could not access camera/microphone. You can still join without video. Tap retry to try again.");
          }
        }
      }
      
      if (!isMounted) return;
      
      // Select socket host address dynamically
      let socketHost = 'localhost';
      if (typeof window !== 'undefined') {
        if (window.location.hostname === '127.0.0.1') {
          socketHost = '127.0.0.1';
        }
      }
      const socketUrl = import.meta.env.VITE_SOCKET_URL || ('http://' + socketHost + ':5000');
      
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

  // EFFECT: Keep video srcObject updated when camera streams change
  useEffect(() => {
    if (localVideoRef.current) {
      const activeStream = isScreenSharing ? screenStreamRef.current : localStreamRef.current;
      if (activeStream && localVideoRef.current.srcObject !== activeStream) {
        localVideoRef.current.srcObject = activeStream;
      }
    }
  }, [isScreenSharing, isReadyToJoin]);

  // Helper method: builds new RTCPeerConnection object and hooks events
  const createPeerConnection = (socketId: string, isInitiator: boolean) => {
    if (peersRef.current[socketId]) {
      return peersRef.current[socketId];
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

    // Attach local camera/mic tracks to feed the connection
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        pc.addTrack(track, localStreamRef.current);
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

  // Compute layout grid styles class depending on total speakers
  const videoCount = 1 + participants.length;
  let cardClass = '';
  if (videoCount === 1) {
    cardClass = 'single';
  } else if (videoCount > 4) {
    cardClass = 'tiled';
  }

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

  // VIEW 3: Main video call conference room layout
  return (
    <div className="meeting-room-container">
      
      {/* 3.1: HEADER PANEL */}
      <header className="meeting-header">
        <div className="header-left">
          <h2>Meeting Room: {meeting?.title || id}</h2>
        </div>
        <div className="header-right">
          {/* Copy Meeting Link button */}
          <button 
            className={'copy-link-btn ' + (copied ? 'copied' : '')} 
            onClick={copyMeetingLink}
            title="Copy meeting link to share"
          >
            {copied ? (
              <Check size={16} style={{ marginRight: '6px' }} />
            ) : (
              <Copy size={16} style={{ marginRight: '6px' }} />
            )}
            {copied ? 'Copied!' : 'Copy Info'}
          </button>

          {/* Settings Menu popover button wrapper */}
          <div className="share-settings-wrapper">
            <button
              className={'settings-dots-btn ' + (showShareModal ? 'active' : '')}
              onClick={() => setShowShareModal(!showShareModal)}
              title="Meeting Share Settings"
            >
              <MoreVertical size={20} />
            </button>

            {/* Privacy setting dropdown config */}
            {showShareModal && meeting ? (
              <div className="share-settings-popover">
                <div className="popover-header">
                  <h4>Access Restrictions</h4>
                  <button className="popover-close-btn" onClick={() => setShowShareModal(false)}>
                    <X size={16} />
                  </button>
                </div>
                
                {/* Access Options Toggle Pills */}
                <div className="access-options">
                  <button 
                    className={'access-pill ' + (meeting.accessType === 'public' ? 'active' : '')}
                    onClick={() => handleToggleAccessType('public')}
                    disabled={isSavingAccess || meeting.host?._id !== user?._id}
                  >
                    <span className="dot public-dot"></span>
                    Anyone with link (Public)
                  </button>
                  <button 
                    className={'access-pill ' + (meeting.accessType === 'restricted' ? 'active' : '')}
                    onClick={() => handleToggleAccessType('restricted')}
                    disabled={isSavingAccess || meeting.host?._id !== user?._id}
                  >
                    <span className="dot restricted-dot"></span>
                    Only invited guests (Restricted)
                  </button>
                </div>

                {/* Share Link Row */}
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

                {/* Invited guest emails registry */}
                <div className="invited-guests-section">
                  <h5>Invited Guest List</h5>
                  
                  {meeting.host?._id === user?._id ? (
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

                  {/* List of guest email chips */}
                  <div className="invited-emails-list">
                    {meeting.invitedEmails && meeting.invitedEmails.length > 0 ? (
                      meeting.invitedEmails.map((email: string) => (
                        <div key={email} className="email-chip">
                          <span className="email-text" title={email}>{email}</span>
                          {meeting.host?._id === user?._id ? (
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

                {/* Network save layout overlay */}
                {isSavingAccess ? (
                  <div className="popover-loading-overlay">
                    <div className="popover-spinner"></div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* 3.2: MEETING STREAMS CONTENT AREA */}
      <div className="meeting-content">
        
        {/* 3.2.1: Video Streams layout grid */}
        <div className="video-area">
          {mediaError ? (
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
          ) : null}
          
          <div className="videos-grid">
            {/* Local Speaker Video Card */}
            <div className={'video-card ' + cardClass}>
              {isVideoMuted ? (
                <div className="avatar-placeholder">
                  <div className="avatar-circle">{getLocalInitials()}</div>
                  <span className="avatar-label">{user?.name || guestName} (You)</span>
                </div>
              ) : (
                <video 
                  ref={localVideoRef}
                  autoPlay 
                  muted 
                  playsInline 
                  className="meet-video-stream"
                />
              )}
              
              <div className="video-card-overlay">
                <span className="name-tag">{user?.name || guestName} (You)</span>
                {isMicMuted ? (
                  <span className="badge-mic-muted">
                    <MicOff size={14} />
                  </span>
                ) : null}
              </div>
            </div>

            {/* Remote Speakers Video Cards list */}
            {participants.map(pId => {
              const isRemoteVideoMuted = !!remoteMuteStates[pId]?.video;
              const isRemoteMicMuted = !!remoteMuteStates[pId]?.audio;
              const remoteName = participantNames[pId] || ('Participant (' + pId.substring(0, 4) + ')');

              return (
                <div key={pId} className={'video-card ' + cardClass}>
                  {isRemoteVideoMuted ? (
                    <div className="avatar-placeholder">
                      <div className="avatar-circle">{getParticipantInitials(pId)}</div>
                      <span className="avatar-label">{remoteName}</span>
                    </div>
                  ) : (
                    remoteStreams[pId] ? (
                      <RemoteVideo stream={remoteStreams[pId]} />
                    ) : (
                      // Connecting spinner overlay
                      <div className="video-connecting">
                        <div className="video-spinner"></div>
                        <span>Connecting to {remoteName}...</span>
                      </div>
                    )
                  )}

                  <div className="video-card-overlay">
                    <span className="name-tag">{remoteName}</span>
                    {isRemoteMicMuted ? (
                      <span className="badge-mic-muted">
                        <MicOff size={14} />
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3.2.2: Chat / Roster sliding drawer sidebar panel */}
        {activeSidebar !== null ? (
          <div className="meet-sidebar-drawer">
            <div className="drawer-header">
              <h3>{activeSidebar === 'chat' ? 'In-call Messages' : 'People'}</h3>
              <button className="close-drawer-btn" onClick={() => setActiveSidebar(null)}>
                <X size={20} />
              </button>
            </div>

            {/* 3.2.2.1: Chat view layout */}
            {activeSidebar === 'chat' ? (
              <div className="drawer-chat-container">
                <div className="chat-notice-banner">
                  <Shield size={14} className="banner-icon" />
                  <span>Messages are only visible to people in the call and are deleted when the call ends.</span>
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
                  
                  {/* Empty chat placeholder container */}
                  {/* Invisible scroll anchor at the bottom of the message list */}
                  <div ref={chatBottomRef} />

                  {messages.length === 0 ? (
                    <div className="empty-chat-container">
                      <div className="empty-chat-icon-wrap">
                        <MessageSquare size={36} strokeWidth={1.5} />
                      </div>
                      <h4>No messages yet</h4>
                      <p>Send a message to start the conversation with others in this call.</p>
                    </div>
                  ) : null}
                </div>
                
                {/* Chat text box submit form */}
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
              // 3.2.2.2: Participant Roster view layout
              <div className="participants-drawer-list">
                {/* Meeting Host item row (Always first element) */}
                <div className="participant-item">
                  <div className="participant-item-left">
                    <div className="participant-item-avatar">
                      {meeting?.host?.name ? meeting.host.name[0] : 'H'}
                    </div>
                    <span className="participant-item-name">
                      {meeting?.host?.name || 'Loading Host...'}
                      <span className="participant-item-role">Host</span>
                    </span>
                  </div>
                </div>
                
                {/* Active attendees listing */}
                {participants.map(pId => {
                  const name = participantNames[pId] || ('Guest (' + pId.substring(0, 4) + ')');
                  const isRemoteMicMuted = !!remoteMuteStates[pId]?.audio;
                  return (
                    <div key={pId} className="participant-item">
                      <div className="participant-item-left">
                        <div className="participant-item-avatar">
                          {name[0]}
                        </div>
                        <span className="participant-item-name">{name}</span>
                      </div>
                      <div className="participant-item-status">
                        <span className={'participant-mic-status ' + (isRemoteMicMuted ? 'muted' : '')}>
                          {isRemoteMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 3.3: FLOATING CENTER CONTROLS BAR */}
      <div className="controls-bar">
        {/* Toggle Audio Mute */}
        <button 
          className={'control-btn ' + (isMicMuted ? 'muted' : '')} 
          onClick={toggleMic}
          data-tooltip={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Camera Mute */}
        <button 
          className={'control-btn ' + (isVideoMuted ? 'muted' : '')} 
          onClick={toggleVideo}
          data-tooltip={isVideoMuted ? "Turn on Camera" : "Turn off Camera"}
        >
          {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        {/* Share Screen presentation */}
        <button 
          className={'control-btn ' + (isScreenSharing ? 'active' : '')} 
          onClick={isScreenSharing ? stopScreenShare : shareScreen}
          data-tooltip={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
        >
          <Monitor size={20} />
        </button>

        {/* Toggle sliding Chat Drawer */}
        <button 
          className={'control-btn ' + (activeSidebar === 'chat' ? 'active' : '')} 
          onClick={() => setActiveSidebar(prev => prev === 'chat' ? null : 'chat')}
          data-tooltip="In-call Messages"
        >
          <MessageSquare size={20} />
        </button>

        {/* Toggle sliding Attendee roster drawer */}
        <button 
          className={'control-btn ' + (activeSidebar === 'participants' ? 'active' : '')} 
          onClick={() => setActiveSidebar(prev => prev === 'participants' ? null : 'participants')}
          data-tooltip="People"
        >
          <Users size={20} />
        </button>

        {/* Call end button (Host ends meeting for all vs Guest exits room) */}
        {meeting && user && meeting.host?._id === user._id && meeting.status !== 'completed' ? (
          <button 
            className="control-btn danger" 
            onClick={endMeeting}
            data-tooltip="End Meeting for Everyone"
          >
            <PhoneOff size={20} />
          </button>
        ) : (
          <button 
            className="control-btn danger" 
            onClick={() => navigate('/dashboard')}
            data-tooltip="Leave Call"
          >
            <PhoneOff size={20} />
          </button>
        )}
      </div>

    </div>
  );
};

export default MeetingRoomPage;

