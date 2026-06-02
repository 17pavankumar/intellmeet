import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMeetingStore from '../store/meetingStore';
import API from '../services/api';
import './MeetingCard.css';

// Define the shape of a Meeting object
interface Meeting {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  summary?: string;
  actionItems?: { text: string; assignedTo?: any; done: boolean }[];
  messages?: { sender: any; senderName?: string; text: string; createdAt: string }[];
}

// Props expected by the card component
interface Props {
  meeting: Meeting;
}

// Visual status badges mapping to color hex values
const statusColors: Record<string, string> = {
  scheduled: '#60a5fa', // Blue
  ongoing: '#34d399',   // Green
  completed: '#a78bfa', // Purple
};

/**
 * MeetingCard Component
 * Displays a summary preview of a meeting card in the dashboard list.
 */
const MeetingCard: React.FC<Props> = ({ meeting }) => {
  // Retrieve delete action from meeting store
  const { deleteMeeting } = useMeetingStore();
  
  // React Router navigate hook to redirect users to different routes
  const navigate = useNavigate();

  // Modal display states
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [detailedMeeting, setDetailedMeeting] = useState<Meeting | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'actionItems' | 'transcript'>('summary');

  // Parse and format the meeting start ISO timestamp into readable Date & Time format
  const formattedDate = new Date(meeting.startTime).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Handler to fetch and open meeting AI summary insights & transcript details
  const openInsights = async () => {
    setShowInsightsModal(true);
    setLoadingDetails(true);
    try {
      const { data } = await API.get(`/meetings/${meeting._id}`);
      setDetailedMeeting(data);
    } catch (err) {
      console.error('Failed to load meeting details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="meeting-card">
      
      {/* Status badge representing the state of the meeting */}
      <span
        className="meeting-status"
        style={{ color: statusColors[meeting.status] }}
      >
        ● {meeting.status}
      </span>

      {/* Meeting Title */}
      <h3 className="meeting-title">{meeting.title}</h3>
      
      {/* Meeting Description */}
      <p className="meeting-desc">
        {meeting.description || 'No description provided.'}
      </p>
      
      {/* Formatted Date & Time */}
      <p className="meeting-time">🕐 {formattedDate}</p>

      {/* AI Summary Preview: Render only if summary content is available */}
      {meeting.summary && (
        <div className="meeting-summary">
          <p className="summary-label">🤖 AI Summary Preview</p>
          <p className="summary-text">
            {meeting.summary.length > 130 ? `${meeting.summary.slice(0, 130)}...` : meeting.summary}
          </p>
        </div>
      )}

      {/* Action buttons panel */}
      <div className="meeting-actions">
        {/* Toggle between Join and View Insights based on status */}
        {meeting.status === 'completed' ? (
          <button
            className="join-btn"
            onClick={openInsights}
            style={{ 
              background: 'linear-gradient(135deg, #8a73fa, #6346f0)', 
              color: 'white', 
              border: 'none', 
              padding: '0.45rem 1rem', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            View AI Insights
          </button>
        ) : (
          <button
            className="join-btn"
            onClick={() => navigate(`/meeting/${meeting._id}`)}
            style={{ 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              padding: '0.45rem 1rem', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Join Meeting
          </button>
        )}
        
        {/* Delete button: Triggers delete API call and removes card from state */}
        <button
          id={`delete-meeting-${meeting._id}`}
          className="delete-btn"
          onClick={() => deleteMeeting(meeting._id)}
        >
          Delete
        </button>
      </div>

      {/* Premium AI Insights & Transcript Modal */}
      {showInsightsModal && (
        <div className="insights-modal-overlay" onClick={() => setShowInsightsModal(false)}>
          <div className="insights-modal" onClick={e => e.stopPropagation()}>
            <div className="insights-modal-header">
               <div>
                 <h2>{meeting.title}</h2>
                 <p className="insights-modal-time">🕐 {formattedDate}</p>
               </div>
               <button className="insights-modal-close" onClick={() => setShowInsightsModal(false)} title="Close Modal">
                 &times;
               </button>
            </div>
            
            {loadingDetails ? (
              <div className="insights-modal-loading">
                <div className="insights-spinner"></div>
                <p>Analyzing conversation transcript & generating summary...</p>
              </div>
            ) : (
              <>
                <div className="insights-modal-tabs">
                  <button 
                    className={`insights-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                  >
                    🤖 AI Summary
                  </button>
                  <button 
                    className={`insights-tab-btn ${activeTab === 'actionItems' ? 'active' : ''}`}
                    onClick={() => setActiveTab('actionItems')}
                  >
                    ✅ Action Items
                  </button>
                  <button 
                    className={`insights-tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcript')}
                  >
                    📝 Discussion Transcript
                  </button>
                </div>
                
                <div className="insights-modal-body">
                  {activeTab === 'summary' && (
                    <div className="insights-tab-content fade-in">
                      <div className="ai-summary-glow-card">
                        <h3>Interactive AI Discussion Summary</h3>
                        <p className="summary-full-text">
                          {detailedMeeting?.summary || 'No AI summary generated for this meeting.'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'actionItems' && (
                    <div className="insights-tab-content fade-in">
                      <h3>Extracted Action Items</h3>
                      {detailedMeeting?.actionItems && detailedMeeting.actionItems.length > 0 ? (
                        <div className="action-items-checklist">
                          {detailedMeeting.actionItems.map((item, idx) => (
                            <div key={idx} className="action-item-checkbox-row">
                              <div className="action-checkbox-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="checkbox-svg">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                              <span className="action-item-text">{item.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="insights-empty-state">No action items detected in this meeting.</p>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'transcript' && (
                    <div className="insights-tab-content fade-in">
                      <h3>Discussion Transcript</h3>
                      {detailedMeeting?.messages && detailedMeeting.messages.length > 0 ? (
                        <div className="transcript-timeline">
                          {detailedMeeting.messages.map((msg, idx) => {
                            const name = msg.sender ? msg.sender.name : (msg.senderName || 'Participant');
                            const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                            return (
                              <div key={idx} className="transcript-timeline-item">
                                <div className="timeline-avatar">{initials}</div>
                                <div className="timeline-bubble-wrap">
                                  <div className="timeline-meta">
                                    <span className="timeline-sender">{name}</span>
                                    <span className="timeline-time">
                                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="timeline-message-text">{msg.text}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="insights-empty-state">No chat messages were recorded during this session.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
};

export default MeetingCard;
