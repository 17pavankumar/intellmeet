import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import API from '../services/api';
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
  // Extract meeting ID from the URL path (/meeting/:id)
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Get active session user from the global Zustand auth store
  const { user } = useAuthStore();
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  // 1. Meeting & Message states
  const [meeting, setMeeting] = useState<any>(null); // DB details (host, title, settings, invites)
  const [messages, setMessages] = useState<ChatMessage[]>([]); // Conversation history list
  const [messageInput, setMessageInput] = useState(''); // Text in message input field
  
  // 2. WebRTC & Media streams states
  const [participants, setParticipants] = useState<string[]>([]); // Active remote socket IDs
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({}); // Remote peer MediaStreams
  const [mediaError, setMediaError] = useState<string | null>(null); // Permission errors
  const [isScreenSharing, setIsScreenSharing] = useState(false); // Screen sharing track state
  
  // 3. User local device mute toggles
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  
  // 4. Remote peers mute states & names (relayed via WebSockets)
  const [remoteMuteStates, setRemoteMuteStates] = useState<Record<string, { audio: boolean, video: boolean }>>({});
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  
  // 5. Drawer, copy, & guest states
  const [activeSidebar, setActiveSidebar] = useState<'chat' | 'participants' | null>(null);
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isReadyToJoin, setIsReadyToJoin] = useState(!!user); // Skip lobby if logged in
  
  // 6. Access Control & Invitation settings states
  const [restrictionError, setRestrictionError] = useState<string | null>(null); // Block page overlay
  const [showShareModal, setShowShareModal] = useState(false); // 3-dots menu visibility
  const [newInviteEmail, setNewInviteEmail] = useState(''); // Text in guest invite field
  const [isSavingAccess, setIsSavingAccess] = useState(false); // Network saving state

  // ==========================================================================
  // REFS (Persistent mutable references that don't trigger re-renders)
  // ==========================================================================
  const socketRef = useRef<Socket | null>(null); // Live Socket.io client instance
  const localStreamRef = useRef<MediaStream | null>(null); // Camera + Mic MediaStream reference
  const localVideoRef = useRef<HTMLVideoElement>(null); // Local video DOM node
  const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // Active WebRTC Peer connections
  const screenStreamRef = useRef<MediaStream | null>(null); // Current presentation screen stream

  // Standard STUN servers configuration for NAT traversal/discovering public endpoints
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // ==========================================================================
  // EFFECT 1: Load Meeting Info & Check Access Restrictions
  // ==========================================================================
  useEffect(() => {
    let isMounted = true;
    
    const fetchMeeting = async () => {
      try {
        const { data } = await API.get(`/meetings/${id}`);
        if (isMounted) {
          setMeeting(data);
          setRestrictionError(null); // Access granted, clear errors
        }
      } catch (err: any) {
        console.error("Failed to load meeting details from DB", err);
        if (isMounted) {
          // If server returns 403, user is uninvited/unauthorized to join
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

  // ==========================================================================
  // EFFECT 2: Initialize Audio/Video Streams & Socket.io Signaling
  // ==========================================================================
  useEffect(() => {
    // Only run if user submitted lobby name, meeting exists in DB, and access is permitted
    if (!isReadyToJoin || !meeting || restrictionError) return;
    let isMounted = true;

    const initMeeting = async () => {
      // Step A: Request local webcam and microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Clean up tracks if user navigated away during permission prompt
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        localStreamRef.current = stream;
        
        // Bind local stream to the video DOM element using direct assignment if ref is ready
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing media devices.", err);
        if (isMounted) {
          setMediaError("Could not access camera/microphone. You can still join without video.");
        }
      }
      
      if (!isMounted) return;
      
      // Step B: Connect to the backend Socket.io signaling server
      const socketHost = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
      const socketUrl = import.meta.env.VITE_SOCKET_URL || `http://${socketHost}:5000`;
      socketRef.current = io(socketUrl);

      if (socketRef.current) {
        // Notify the signaling server that we want to join the meeting room
        socketRef.current.emit('join-meeting', { meetingId: id, userId: user?._id, name: user?.name || guestName });

        // LISTENER 1: A new participant has joined the room
        socketRef.current.on('user-joined', ({ socketId, name }) => {
          setParticipants(prev => {
            if (!prev.includes(socketId)) return [...prev, socketId];
            return prev;
          });
          if (name) {
            setParticipantNames(prev => ({ ...prev, [socketId]: name }));
          }
          // Initiate a WebRTC peer connection (isInitiator = true)
          createPeerConnection(socketId, true);
        });

        // LISTENER 2: Receive WebRTC SDP Offer from another client
        socketRef.current.on('webrtc-offer', async ({ senderSocketId, offer, senderName, isMicMuted: remoteMicMuted, isVideoMuted: remoteVideoMuted }) => {
          setParticipants(prev => {
            if (!prev.includes(senderSocketId)) return [...prev, senderSocketId];
            return prev;
          });
          if (senderName) {
            setParticipantNames(prev => ({ ...prev, [senderSocketId]: senderName }));
          }
          setRemoteMuteStates(prev => ({
            ...prev,
            [senderSocketId]: { audio: !!remoteMicMuted, video: !!remoteVideoMuted }
          }));
          
          // Create matching peer connection (isInitiator = false)
          const pc = createPeerConnection(senderSocketId, false);
          try {
            // Apply offer as remote description
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Create matching WebRTC Answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            // Send SDP Answer back to signaling channel
            socketRef.current?.emit('webrtc-answer', { 
              targetSocketId: senderSocketId, 
              answer, 
              senderName: user?.name || guestName,
              isMicMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
              isVideoMuted: localStreamRef.current ? !localStreamRef.current.getVideoTracks()[0]?.enabled : false
            });
          } catch (err) {
            console.error("Error handling offer:", err);
          }
        });

        // LISTENER 3: Receive WebRTC SDP Answer from remote peer
        socketRef.current.on('webrtc-answer', async ({ senderSocketId, answer, senderName, isMicMuted: remoteMicMuted, isVideoMuted: remoteVideoMuted }) => {
          const pc = peersRef.current[senderSocketId];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              if (senderName) {
                setParticipantNames(prev => ({ ...prev, [senderSocketId]: senderName }));
              }
              setRemoteMuteStates(prev => ({
                ...prev,
                [senderSocketId]: { audio: !!remoteMicMuted, video: !!remoteVideoMuted }
              }));
            } catch (err) {
              console.error("Error handling answer:", err);
            }
          }
        });

        // LISTENER 4: Receive ICE candidate path route from remote peer
        socketRef.current.on('webrtc-ice-candidate', async ({ senderSocketId, candidate }) => {
          const pc = peersRef.current[senderSocketId];
          if (pc && candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding ice candidate:", err);
            }
          }
        });

        // LISTENER 5: Monitor remote participant mute changes
        socketRef.current.on('user-mute-state', ({ socketId, type, isMuted: remoteMuted }) => {
          setRemoteMuteStates(prev => {
            const current = prev[socketId] || { audio: false, video: false };
            return {
              ...prev,
              [socketId]: { ...current, [type === 'audio' ? 'audio' : 'video']: !!remoteMuted }
            };
          });
        });

        // LISTENER 6: A remote participant has disconnected/left
        socketRef.current.on('user-left', ({ socketId }) => {
          setParticipants(prev => prev.filter(p => p !== socketId));
          setParticipantNames(prev => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
          setRemoteMuteStates(prev => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
          
          if (peersRef.current[socketId]) {
            peersRef.current[socketId].close();
            delete peersRef.current[socketId];
          }
          
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
        });

        // LISTENER 7: Live chat message syncing
        socketRef.current.on('receive-message', (data: ChatMessage) => {
          setMessages(prev => [...prev, data]);
        });
      }
    };

    initMeeting();

    // CLEANUP FUNCTION: Shuts down streams, socket, and WebRTC peer instances on exit
    return () => {
      isMounted = false;
      
      // Stop webcam and microphone hardware tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close all active peer connections
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      
      // Emit leave notification and disconnect
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [id, isReadyToJoin, !!meeting, !!restrictionError]);

  // ==========================================================================
  // WEBRTC SIGNALING UTILITY
  // ==========================================================================
  
  /**
   * Helper function to instantiate a new RTCPeerConnection object for a participant.
   * Runs NAT STUN, registers ICE events, track handlers, and performs local track bindings.
   */
  const createPeerConnection = (socketId: string, isInitiator: boolean) => {
    if (peersRef.current[socketId]) {
      return peersRef.current[socketId];
    }

    const pc = new RTCPeerConnection(configuration);
    peersRef.current[socketId] = pc;

    // ICE Callback: Send network pathways to target peer via socket server
    pc.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // Track Callback: Receives audio/video tracks and stores it in state to display
    pc.ontrack = event => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => ({ ...prev, [socketId]: event.streams[0] }));
      }
    };

    // Attach local hardware tracks to the peer connection so the remote peer receives it
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // SDP Negotiation: Initiator creates SDP Offer, sets locally, and sends to signaling channel
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit('webrtc-offer', {
            targetSocketId: socketId,
            offer: pc.localDescription,
            senderName: user?.name || guestName,
            isMicMuted: localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : false,
            isVideoMuted: localStreamRef.current ? !localStreamRef.current.getVideoTracks()[0]?.enabled : false
          });
        })
        .catch(console.error);
    }

    return pc;
  };

  // ==========================================================================
  // DEVICE CONTROL EVENT HANDLERS
  // ==========================================================================
  
  // Toggle microphone track
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

  // Toggle camera track
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

  // Start screen share stream and replace active tracks in peer connections
  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((sender) => sender.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Failed to start screen sharing:", err);
    }
  };

  // Stop screen sharing and restore local camera video tracks
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      
      Object.values(peersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((sender) => sender.track?.kind === 'video');
        if (videoSender && cameraTrack) {
          videoSender.replaceTrack(cameraTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }

    setIsScreenSharing(false);
  };

  // Conclude meeting session (Trigger AI summary & Kanban task extraction)
  const endMeeting = async () => {
    if (!window.confirm("Are you sure you want to end this meeting for everyone? This will conclude the meeting and generate an AI summary.")) return;
    try {
      await API.patch(`/meetings/${id}/status`, { status: 'completed' });
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to end meeting:", err);
      alert("Failed to conclude the meeting. Please try again.");
    }
  };

  // Send a text message to meeting chatroom
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
    setMessages(prev => [...prev, { ...chatData, timestamp: new Date().toISOString() }]);
    setMessageInput('');
  };

  // Fallback copying method using a temporary textarea (supports non-secure HTTP and local dev network origins)
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

  // Copy meeting join URL to user clipboard with a robust fallback
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${id}`;
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

  // ==========================================================================
  // GUEST INVITATION & ACCESS CONTROL ADMIN HANDLERS (Host only)
  // ==========================================================================
  
  // Push updated settings array to backend DB
  const updateAccessSettings = async (newType: 'public' | 'restricted', emails: string[]) => {
    setIsSavingAccess(true);
    try {
      const { data } = await API.patch(`/meetings/${id}/access`, {
        accessType: newType,
        invitedEmails: emails
      });
      setMeeting(data);
    } catch (err) {
      console.error("Failed to update access settings:", err);
      alert("Failed to update share settings. Make sure you are the host.");
    } finally {
      setIsSavingAccess(false);
    }
  };

  // Toggle public vs restricted mode
  const handleToggleAccessType = (newType: 'public' | 'restricted') => {
    if (!meeting) return;
    updateAccessSettings(newType, meeting.invitedEmails || []);
  };

  // Validate format and add guest email to access settings list
  const handleAddInviteEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !newInviteEmail.trim()) return;
    const emailToAdd = newInviteEmail.trim().toLowerCase();
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToAdd)) {
      alert("Please enter a valid email address.");
      return;
    }

    const currentEmails = meeting.invitedEmails || [];
    if (currentEmails.includes(emailToAdd)) {
      alert("This email is already invited.");
      return;
    }

    const updatedEmails = [...currentEmails, emailToAdd];
    setNewInviteEmail('');
    updateAccessSettings(meeting.accessType, updatedEmails);
  };

  // Remove invited guest email from access settings list
  const handleRemoveInviteEmail = (emailToRemove: string) => {
    if (!meeting) return;
    const updatedEmails = (meeting.invitedEmails || []).filter(
      (email: string) => email !== emailToRemove
    );
    updateAccessSettings(meeting.accessType, updatedEmails);
  };

  // ==========================================================================
  // INTERFACE RENDERING HELPERS
  // ==========================================================================
  
  // Generate name initials for profile avatars
  const getLocalInitials = () => {
    const name = user?.name || guestName || 'ME';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getParticipantInitials = (pId: string) => {
    const name = participantNames[pId];
    if (!name) return 'P';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Dynamic grid card width class (based on total active caller windows)
  const videoCount = 1 + participants.length;
  const cardClass = videoCount === 1 ? 'single' : videoCount <= 4 ? '' : 'tiled';

  // ==========================================================================
  // VIEW 1: RESTRICTED ACCESS SCREEN (Shown to uninvited/unauthorized users)
  // ==========================================================================
  if (restrictionError) {
    return (
      <div className="restricted-container">
        <div className="restricted-card">
          <div className="restricted-icon-wrap">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" />
            </svg>
          </div>
          <h2 className="restricted-title">Access Restricted</h2>
          <p className="restricted-message">{restrictionError}</p>
          <div className="restricted-actions">
            <button className="restricted-btn primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
            {!user && (
              <button className="restricted-btn secondary" onClick={() => navigate('/auth')}>
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: GUEST LOBBY CARD (Collect name parameter before starting sockets)
  // ==========================================================================
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
            {meeting ? `Enter your name to join "${meeting.title}"` : 'Enter your name to join the meeting room'}
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (guestName.trim()) setIsReadyToJoin(true); }} className="lobby-form">
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

  // ==========================================================================
  // VIEW 3: MAIN MEETING CONFERENCE ROOM (WebRTC local/remote stream grid)
  // ==========================================================================
  return (
    <div className="meeting-room-container">
      
      {/* 3.1: HEADER PANEL */}
      <header className="meeting-header">
        <div className="header-left">
          <h2>Meeting Room: {meeting?.title || id}</h2>
        </div>
        <div className="header-right">
          {/* Copy Meeting Link Info Button */}
          <button 
            className={`copy-link-btn ${copied ? 'copied' : ''}`} 
            onClick={copyMeetingLink}
            title="Copy meeting link to share"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
              )}
            </svg>
            {copied ? 'Copied!' : 'Copy Info'}
          </button>

          {/* 3-Dots Settings Popover Wrapper */}
          <div className="share-settings-wrapper">
            <button
              className={`settings-dots-btn ${showShareModal ? 'active' : ''}`}
              onClick={() => setShowShareModal(!showShareModal)}
              title="Meeting Share Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>

            {/* Access Options Dropdown Popover */}
            {showShareModal && meeting && (
              <div className="share-settings-popover">
                <div className="popover-header">
                  <h4>Access Restrictions</h4>
                  <button className="popover-close-btn" onClick={() => setShowShareModal(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                    </svg>
                  </button>
                </div>
                
                {/* Access Options Toggle Buttons */}
                <div className="access-options">
                  <button 
                    className={`access-pill ${meeting.accessType === 'public' ? 'active' : ''}`}
                    onClick={() => handleToggleAccessType('public')}
                    disabled={isSavingAccess || meeting.host?._id !== user?._id}
                  >
                    <span className="dot public-dot"></span>
                    Anyone with link (Public)
                  </button>
                  <button 
                    className={`access-pill ${meeting.accessType === 'restricted' ? 'active' : ''}`}
                    onClick={() => handleToggleAccessType('restricted')}
                    disabled={isSavingAccess || meeting.host?._id !== user?._id}
                  >
                    <span className="dot restricted-dot"></span>
                    Only invited guests (Restricted)
                  </button>
                </div>

                {/* Copy Link shortcut inside popover */}
                <div className="popover-share-link">
                  <h5>Meeting Link</h5>
                  <div className="popover-share-row">
                    <input 
                      type="text" 
                      readOnly 
                      value={`${window.location.origin}/meeting/${id}`} 
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to select all"
                    />
                    <button type="button" onClick={copyMeetingLink}>
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Invite Guest list input (Available only to host) */}
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

                  {/* Dynamic guest email chips columns */}
                  <div className="invited-emails-list">
                    {meeting.invitedEmails && meeting.invitedEmails.length > 0 ? (
                      meeting.invitedEmails.map((email: string) => (
                        <div key={email} className="email-chip">
                          <span className="email-text" title={email}>{email}</span>
                          {meeting.host?._id === user?._id && (
                            <button 
                              type="button" 
                              className="remove-email-btn"
                              onClick={() => handleRemoveInviteEmail(email)}
                              disabled={isSavingAccess}
                              title={`Remove ${email}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="no-emails-placeholder">No guest invitations sent yet.</p>
                    )}
                  </div>
                </div>

                {/* Loading indicator during network patches */}
                {isSavingAccess && (
                  <div className="popover-loading-overlay">
                    <div className="popover-spinner"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3.2: MEET CONTENT AREA */}
      <div className="meeting-content">
        
        {/* 3.2.1: LEFT PANEL - Video Conference Grid */}
        <div className="video-area">
          {mediaError && <div className="media-error-alert">{mediaError}</div>}
          
          <div className="videos-grid">
            {/* Local User Webcam Card */}
            <div className={`video-card ${cardClass}`}>
              {isVideoMuted ? (
                <div className="avatar-placeholder">
                  <div className="avatar-circle">{getLocalInitials()}</div>
                  <span className="avatar-label">{user?.name || guestName} (You)</span>
                </div>
              ) : (
                <video 
                  ref={(el) => {
                    if (localVideoRef) {
                      (localVideoRef as any).current = el;
                    }
                    if (el) {
                      // Dynamically bind the active media stream (webcam or screen share) to the video tag
                      const activeStream = isScreenSharing ? screenStreamRef.current : localStreamRef.current;
                      if (activeStream && el.srcObject !== activeStream) {
                        el.srcObject = activeStream;
                      }
                    }
                  }}
                  autoPlay 
                  muted 
                  playsInline 
                  className="meet-video-stream"
                />
              )}
              
              <div className="video-card-overlay">
                <span className="name-tag">{user?.name || guestName} (You)</span>
                {isMicMuted && (
                  <span className="badge-mic-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17l-9.9-9.9L3.5 2.7l3 3V9c0 3.07 2.26 5.61 5.23 6.07l1.27 1.27c-.89.5-1.91.76-3 .76-3.31 0-6-2.69-6-6H3c0 4.07 3.06 7.43 7 7.93V22h4v-3.07c1.3-.17 2.52-.64 3.59-1.34l3.14 3.14 1.41-1.41-11.16-11.15zM12 4c1.66 0 3 1.34 3 3v4.67l3 3V7c0-3.31-2.69-6-6-6-2.88 0-5.3 2.03-5.87 4.75l2.06 2.06C9.69 5.3 10.74 4 12 4z"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* Remote Participants WebRTC Video Cards */}
            {participants.map(pId => {
              const isRemoteVideoMuted = !!remoteMuteStates[pId]?.video;
              const isRemoteMicMuted = !!remoteMuteStates[pId]?.audio;
              const remoteName = participantNames[pId] || `Participant (${pId.substring(0,4)})`;

              return (
                <div key={pId} className={`video-card ${cardClass}`}>
                  {isRemoteVideoMuted ? (
                    <div className="avatar-placeholder">
                      <div className="avatar-circle">{getParticipantInitials(pId)}</div>
                      <span className="avatar-label">{remoteName}</span>
                    </div>
                  ) : (
                    remoteStreams[pId] ? (
                      <video 
                        autoPlay 
                        playsInline 
                        className="meet-video-stream remote"
                        ref={(el) => {
                          if (el && el.srcObject !== remoteStreams[pId]) {
                            el.srcObject = remoteStreams[pId];
                          }
                        }}
                      />
                    ) : (
                      // Display dynamic glassmorphic spinner during connection negotiation
                      <div className="video-connecting">
                        <div className="video-spinner"></div>
                        <span>Connecting to {remoteName}...</span>
                      </div>
                    )
                  )}

                  <div className="video-card-overlay">
                    <span className="name-tag">{remoteName}</span>
                    {isRemoteMicMuted && (
                      <span className="badge-mic-muted">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17l-9.9-9.9L3.5 2.7l3 3V9c0 3.07 2.26 5.61 5.23 6.07l1.27 1.27c-.89.5-1.91.76-3 .76-3.31 0-6-2.69-6-6H3c0 4.07 3.06 7.43 7 7.93V22h4v-3.07c1.3-.17 2.52-.64 3.59-1.34l3.14 3.14 1.41-1.41-11.16-11.15zM12 4c1.66 0 3 1.34 3 3v4.67l3 3V7c0-3.31-2.69-6-6-6-2.88 0-5.3 2.03-5.87 4.75l2.06 2.06C9.69 5.3 10.74 4 12 4z"/>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3.2.2: RIGHT PANEL - sliding side drawer (Chat / Active User list) */}
        {activeSidebar !== null && (
          <div className="meet-sidebar-drawer">
            <div className="drawer-header">
              <h3>{activeSidebar === 'chat' ? 'In-call Messages' : 'People'}</h3>
              <button className="close-drawer-btn" onClick={() => setActiveSidebar(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                </svg>
              </button>
            </div>

            {/* Chat Messages Log Layout */}
            {activeSidebar === 'chat' ? (
              <div className="drawer-chat-container">
                <div className="chat-notice-banner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="banner-icon">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Messages are only visible to people in the call and are deleted when the call ends.</span>
                </div>
                <div className="drawer-chat-messages">
                  {messages.map((msg, index) => {
                    const isOwn = msg.sender === (user?.name || guestName);
                    const initials = msg.sender.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <div key={index} className={`meet-chat-msg-row ${isOwn ? 'own' : ''}`}>
                        {!isOwn && (
                          <div className="chat-msg-avatar" title={msg.sender}>
                            {initials}
                          </div>
                        )}
                        <div className="chat-msg-bubble-wrap">
                          <div className="chat-msg-meta">
                            <span className="chat-msg-sender">{isOwn ? 'You' : msg.sender}</span>
                            <span className="chat-msg-time">
                              {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="meet-chat-text">{msg.message}</p>
                        </div>
                        {isOwn && (
                          <div className="chat-msg-avatar own" title="You">
                            {initials}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Premium Centered Empty Chat State Placeholder */}
                  {messages.length === 0 && (
                    <div className="empty-chat-container">
                      <div className="empty-chat-icon-wrap">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <h4>No messages yet</h4>
                      <p>Send a message to start the conversation with others in this call.</p>
                    </div>
                  )}
                </div>
                
                {/* Chat message submission input form */}
                <form onSubmit={sendMessage} className="meet-chat-input-form">
                  <input 
                    type="text" 
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    placeholder="Send a message..."
                  />
                  <button type="submit" disabled={!messageInput.trim()} className="send-msg-btn" title="Send message">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : (
              // Active Call User List Layout
              <div className="participants-drawer-list">
                {/* Meeting Host Item (Sticky first entry) */}
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
                
                {/* Other remote participants joined */}
                {participants.map(pId => {
                  const name = participantNames[pId] || `Guest (${pId.substring(0,4)})`;
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
                        <span className={`participant-mic-status ${isRemoteMicMuted ? 'muted' : ''}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            {isRemoteMicMuted ? (
                              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17l-9.9-9.9L3.5 2.7l3 3V9c0 3.07 2.26 5.61 5.23 6.07l1.27 1.27c-.89.5-1.91.76-3 .76-3.31 0-6-2.69-6-6H3c0 4.07 3.06 7.43 7 7.93V22h4v-3.07c1.3-.17 2.52-.64 3.59-1.34l3.14 3.14 1.41-1.41-11.16-11.15z"/>
                            ) : (
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                            )}
                          </svg>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3.3: FLOATING CENTER CONTROLS BAR (Google Meet Style actions) */}
      <div className="controls-bar">
        {/* Toggle local audio mute */}
        <button 
          className={`control-btn ${isMicMuted ? 'muted' : ''}`} 
          onClick={toggleMic}
          data-tooltip={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            {isMicMuted ? (
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17l-9.9-9.9L3.5 2.7l3 3V9c0 3.07 2.26 5.61 5.23 6.07l1.27 1.27c-.89.5-1.91.76-3 .76-3.31 0-6-2.69-6-6H3c0 4.07 3.06 7.43 7 7.93V22h4v-3.07c1.3-.17 2.52-.64 3.59-1.34l3.14 3.14 1.41-1.41-11.16-11.15zM12 4c1.66 0 3 1.34 3 3v4.67l3 3V7c0-3.31-2.69-6-6-6-2.88 0-5.3 2.03-5.87 4.75l2.06 2.06C9.69 5.3 10.74 4 12 4z"/>
            ) : (
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            )}
          </svg>
        </button>

        {/* Toggle local camera video mute */}
        <button 
          className={`control-btn ${isVideoMuted ? 'muted' : ''}`} 
          onClick={toggleVideo}
          data-tooltip={isVideoMuted ? "Turn on Camera" : "Turn off Camera"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            {isVideoMuted ? (
              <path d="M18 10.48V6c0-1.1-.9-2-2-2H6.83l2 2H16v7.17l2 2v-1.65l4 3.98v-11l-4 3.98zM2.71 1.58L1.29 3l3.29 3.29C4.21 6.56 4 7.26 4 8v10c0 1.1.9 2 2 2h12.17l3.54 3.54 1.41-1.41-11.16-11.15zM6 18V8.83L15.17 18H6z"/>
            ) : (
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            )}
          </svg>
        </button>

        {/* Toggle presentation screen sharing */}
        <button 
          className={`control-btn ${isScreenSharing ? 'active' : ''}`} 
          onClick={isScreenSharing ? stopScreenShare : shareScreen}
          data-tooltip={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
        </button>

        {/* Toggle messaging sliding drawer */}
        <button 
          className={`control-btn ${activeSidebar === 'chat' ? 'active' : ''}`} 
          onClick={() => setActiveSidebar(prev => prev === 'chat' ? null : 'chat')}
          data-tooltip="In-call Messages"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
          </svg>
        </button>

        {/* Toggle callers list sliding drawer */}
        <button 
          className={`control-btn ${activeSidebar === 'participants' ? 'active' : ''}`} 
          onClick={() => setActiveSidebar(prev => prev === 'participants' ? null : 'participants')}
          data-tooltip="People"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </button>

        {/* Leave/End call connection */}
        {meeting && user && meeting.host?._id === user._id && meeting.status !== 'completed' ? (
          <button 
            className="control-btn danger" 
            onClick={endMeeting}
            data-tooltip="End Meeting for Everyone"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-2.2 0-4.3.4-6.2 1.1-.5.2-.8.6-.8 1.1v2.8c0 .5.3.9.7 1.1 1.8.9 3.8 1.4 5.9 1.4 2.1 0 4.1-.5 5.9-1.4.4-.2.7-.6.7-1.1v-2.8c0-.5-.3-.9-.8-1.1-1.9-.7-4-1.1-6.2-1.1z"/>
            </svg>
          </button>
        ) : (
          <button 
            className="control-btn danger" 
            onClick={() => navigate('/dashboard')}
            data-tooltip="Leave Call"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-2.2 0-4.3.4-6.2 1.1-.5.2-.8.6-.8 1.1v2.8c0 .5.3.9.7 1.1 1.8.9 3.8 1.4 5.9 1.4 2.1 0 4.1-.5 5.9-1.4.4-.2.7-.6.7-1.1v-2.8c0-.5-.3-.9-.8-1.1-1.9-.7-4-1.1-6.2-1.1z"/>
            </svg>
          </button>
        )}
      </div>

    </div>
  );
};

export default MeetingRoomPage;
