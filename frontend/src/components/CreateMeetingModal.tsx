import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateMeeting } from '../hooks/useMeetings';
import { AlertCircle } from 'lucide-react';
import './CreateMeetingModal.css';

// Props expected by the modal component
interface Props {
  onClose: () => void; // Callback function to close/dismiss the modal
}

/**
 * CreateMeetingModal Component
 * Renders an overlay dialog box with a form to schedule a new meeting.
 * On success: navigates directly to the newly created meeting room.
 * On error: shows the error message in the form without closing.
 */
const CreateMeetingModal: React.FC<Props> = ({ onClose }) => {
  // Local state hook variables to store user form inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');

  // Local error state to display inline form errors to the user
  const [formError, setFormError] = useState<string | null>(null);

  // Retrieve the meeting creation action and loading indicator using React Query hook
  const createMeetingMutation = useCreateMeeting();
  const { isPending: isLoading } = createMeetingMutation;

  // React Router navigate hook to redirect after meeting is created
  const navigate = useNavigate();

  // Handler for form submit events
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent browser reload on submit
    e.preventDefault();

    // Clear any previous form error before trying again
    setFormError(null);

    try {
      // Call mutation to save meeting in backend MongoDB database.
      const newMeeting = await createMeetingMutation.mutateAsync({ title, description, startTime });

      // Close the modal overlay
      onClose();

      // Navigate directly into the meeting room using the new meeting's ID
      navigate(`/meeting/${newMeeting._id}`);
    } catch (err: any) {
      // Show the error message inside the form instead of silently failing
      setFormError(err.message || 'Failed to create meeting. Please try again.');
    }
  };

  return (
    // Click backdrop div layer to close modal (onClose)
    <div className="modal-backdrop" onClick={onClose}>
      
      {/* stopPropagation prevents modal-box clicks from bubbling up to backdrop and closing the modal */}
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <h2 className="modal-title">New Meeting</h2>
          {/* Close button with X icon */}
          <button id="close-modal-btn" className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          
          {/* Meeting Title Input Field */}
          <div className="form-group">
            <label htmlFor="meeting-title">Meeting Title</label>
            <input
              id="meeting-title"
              type="text"
              placeholder="Weekly Standup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required // Browser level validation: field is mandatory
            />
          </div>

          {/* Meeting Description Text Area */}
          <div className="form-group">
            <label htmlFor="meeting-desc">Description</label>
            <textarea
              id="meeting-desc"
              placeholder="What is this meeting about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Meeting Start Time Picker (datetime-local picker) */}
          <div className="form-group">
            <label htmlFor="meeting-time">Start Time</label>
            <input
              id="meeting-time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          {/* Inline error message — shown only when meeting creation fails */}
          {formError && (
            <div className="form-error-banner">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{formError}</span>
            </div>
          )}

          <div className="modal-footer">
            {/* Cancel Button */}
            <button
              id="cancel-modal-btn"
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            
            {/* Submit button: Disabled while loading backend response */}
            <button
              id="submit-meeting-btn"
              type="submit"
              className="submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create & Join'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default CreateMeetingModal;
