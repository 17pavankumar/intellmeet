import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteMeeting } from '../hooks/useMeetings';
import { Check } from 'lucide-react';
import API from '../services/api';
import './MeetingCard.css';

// Define the properties of a single Meeting object
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

// Define the arguments that must be passed to this Component
interface Props {
  meeting: Meeting;
}

// Map meeting status keys to hexadecimal color strings
const statusColors: Record<string, string> = {
  scheduled: '#60a5fa', // Soft Blue
  ongoing: '#34d399',   // Soft Green
  completed: '#a78bfa', // Soft Purple
};

// Helper function to extract initials from a user name safely and simply
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

/**
 * Component representing a meeting item shown on the dashboard.
 */
const MeetingCard: React.FC<Props> = (props) => {
  // Extract meeting details from props
  const meeting = props.meeting;

  // React Query hook to request deletion of a meeting
  const deleteMeetingMutation = useDeleteMeeting();
  
  // React Router hook to change browser pages programmatically
  const navigate = useNavigate();

  // Control visibility of the AI insights modal
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  
  // State storing the fully populated meeting object fetched from API
  const [detailedMeeting, setDetailedMeeting] = useState<Meeting | null>(null);
  
  // Loading flag while fetching meeting details
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Controls which sub-tab is visible inside the modal
  const [activeTab, setActiveTab] = useState<'summary' | 'actionItems' | 'transcript'>('summary');

  // Convert scheduled start ISO time into formatted date string
  const meetingDateObject = new Date(meeting.startTime);
  const formattedDate = meetingDateObject.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Fetch the full details from the database and open the summary modal
  const openInsights = async () => {
    // Open modal first
    setShowInsightsModal(true);
    // Show spinner
    setLoadingDetails(true);
    try {
      // Make network request to fetch single meeting endpoint
      const response = await API.get('/meetings/' + meeting._id);
      const data = response.data;
      // Set the detailed meeting data in state
      setDetailedMeeting(data);
    } catch (err) {
      console.error('Failed to load meeting details:', err);
    } finally {
      // Hide spinner
      setLoadingDetails(false);
    }
  };

  // Truncate summary text preview for dashboard card presentation
  let summaryPreview = '';
  if (meeting.summary) {
    if (meeting.summary.length > 130) {
      summaryPreview = meeting.summary.slice(0, 130) + '...';
    } else {
      summaryPreview = meeting.summary;
    }
  }

  // Handle clicking the delete button
  const handleDeleteClick = () => {
    deleteMeetingMutation.mutate(meeting._id);
  };

  return (
    <div className="meeting-card">
      
      {/* Display meeting status dot indicator */}
      <span
        className="meeting-status"
        style={{ color: statusColors[meeting.status] }}
      >
        ● {meeting.status}
      </span>

      {/* Title */}
      <h3 className="meeting-title">{meeting.title}</h3>
      
      {/* Description */}
      <p className="meeting-desc">
        {meeting.description || 'No description provided.'}
      </p>
      
      {/* Date */}
      <p className="meeting-time">🕐 {formattedDate}</p>

      {/* Render AI summary preview section if summary field exists */}
      {meeting.summary ? (
        <div className="meeting-summary">
          <p className="summary-label">🤖 AI Summary Preview</p>
          <p className="summary-text">{summaryPreview}</p>
        </div>
      ) : null}

      {/* Actions buttons */}
      <div className="meeting-actions">
        {/* Toggle buttons based on status: view insights vs join room */}
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
            onClick={() => navigate('/meeting/' + meeting._id)}
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
        
        {/* Delete action button */}
        <button
          id={'delete-meeting-' + meeting._id}
          className="delete-btn"
          onClick={handleDeleteClick}
        >
          Delete
        </button>
      </div>

      {/* AI Insights and transcript viewer popup modal overlay */}
      {showInsightsModal ? (
        <div className="insights-modal-overlay" onClick={() => setShowInsightsModal(false)}>
          <div className="insights-modal" onClick={e => e.stopPropagation()}>
            
            {/* Modal header details */}
            <div className="insights-modal-header">
               <div>
                 <h2>{meeting.title}</h2>
                 <p className="insights-modal-time">🕐 {formattedDate}</p>
               </div>
               <button className="insights-modal-close" onClick={() => setShowInsightsModal(false)} title="Close Modal">
                 &times;
               </button>
             </div>
             
             {/* Conditional layout: show loading spinner or tab contents */}
             {loadingDetails ? (
               <div className="insights-modal-loading">
                 <div className="insights-spinner"></div>
                 <p>Analyzing conversation transcript & generating summary...</p>
               </div>
             ) : (
               <>
                 {/* Modal tab selector buttons */}
                 <div className="insights-modal-tabs">
                   <button 
                     className={'insights-tab-btn ' + (activeTab === 'summary' ? 'active' : '')}
                     onClick={() => setActiveTab('summary')}
                   >
                     🤖 AI Summary
                   </button>
                   <button 
                     className={'insights-tab-btn ' + (activeTab === 'actionItems' ? 'active' : '')}
                     onClick={() => setActiveTab('actionItems')}
                   >
                     ✅ Action Items
                   </button>
                   <button 
                     className={'insights-tab-btn ' + (activeTab === 'transcript' ? 'active' : '')}
                     onClick={() => setActiveTab('transcript')}
                   >
                     📝 Discussion Transcript
                   </button>
                 </div>
                 
                 {/* Tab Content body details */}
                 <div className="insights-modal-body">
                   {/* 1. Summary View Tab */}
                   {activeTab === 'summary' ? (
                     <div className="insights-tab-content fade-in">
                       <div className="ai-summary-glow-card">
                         <h3>Interactive AI Discussion Summary</h3>
                         <p className="summary-full-text">
                           {detailedMeeting?.summary || 'No AI summary generated for this meeting.'}
                         </p>
                       </div>
                     </div>
                   ) : null}
                   
                   {/* 2. Action Items checklist Tab */}
                   {activeTab === 'actionItems' ? (
                     <div className="insights-tab-content fade-in">
                       <h3>Extracted Action Items</h3>
                       {detailedMeeting?.actionItems && detailedMeeting.actionItems.length > 0 ? (
                         <div className="action-items-checklist">
                           {detailedMeeting.actionItems.map((item, idx) => (
                             <div key={idx} className="action-item-checkbox-row">
                               <div className="action-checkbox-icon">
                                 <Check size={14} className="checkbox-svg" strokeWidth={3} />
                               </div>
                               <span className="action-item-text">{item.text}</span>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <p className="insights-empty-state">No action items detected in this meeting.</p>
                       )}
                     </div>
                   ) : null}
                   
                   {/* 3. Message timeline Transcript Tab */}
                   {activeTab === 'transcript' ? (
                     <div className="insights-tab-content fade-in">
                       <h3>Discussion Transcript</h3>
                       {detailedMeeting?.messages && detailedMeeting.messages.length > 0 ? (
                         <div className="transcript-timeline">
                           {detailedMeeting.messages.map((msg, idx) => {
                             // Identify name or fallback if sender details are absent
                             let senderDisplayName = 'Participant';
                             if (msg.sender && msg.sender.name) {
                               senderDisplayName = msg.sender.name;
                             } else if (msg.senderName) {
                               senderDisplayName = msg.senderName;
                             }
                             // Fetch initials using helper function
                             const userInitials = getInitials(senderDisplayName);
                             return (
                               <div key={idx} className="transcript-timeline-item">
                                 <div className="timeline-avatar">{userInitials}</div>
                                 <div className="timeline-bubble-wrap">
                                   <div className="timeline-meta">
                                     <span className="timeline-sender">{senderDisplayName}</span>
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
                   ) : null}
                 </div>
               </>
             )}
          </div>
        </div>
      ) : null}
      
    </div>
  );
};

export default MeetingCard;
