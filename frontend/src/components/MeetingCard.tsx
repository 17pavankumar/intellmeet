import React from 'react';
import { useNavigate } from 'react-router-dom';
import useMeetingStore from '../store/meetingStore';
import './MeetingCard.css';

// Define the shape of a Meeting object
interface Meeting {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  aiSummary?: string;
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

  // Parse and format the meeting start ISO timestamp into readable Date & Time format
  const formattedDate = new Date(meeting.startTime).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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

      {/* AI Summary Section: Render only if summary content is available */}
      {meeting.aiSummary && (
        <div className="meeting-summary">
          <p className="summary-label">🤖 AI Summary</p>
          <p className="summary-text">{meeting.aiSummary}</p>
        </div>
      )}

      {/* Action buttons panel */}
      <div className="meeting-actions">
        {/* Join button: Redirects user to the meeting room route "/meeting/:id" */}
        <button
          className="join-btn"
          onClick={() => navigate(`/meeting/${meeting._id}`)}
          style={{ 
            background: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            padding: '0.4rem 0.8rem', 
            borderRadius: '6px', 
            cursor: 'pointer' 
          }}
        >
          Join Meeting
        </button>
        
        {/* Delete button: Triggers delete API call and removes card from state */}
        <button
          id={`delete-meeting-${meeting._id}`}
          className="delete-btn"
          onClick={() => deleteMeeting(meeting._id)}
        >
          Delete
        </button>
      </div>
      
    </div>
  );
};

export default MeetingCard;
