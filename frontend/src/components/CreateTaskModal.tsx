import React, { useState } from 'react';
import useTaskStore from '../store/taskStore';
import './CreateMeetingModal.css';

// Props expected by the modal component
interface Props {
  onClose: () => void; // Callback function to close/dismiss the modal
}

/**
 * CreateTaskModal Component
 * Renders an overlay dialog box with a form to create a new task (Action item).
 */
const CreateTaskModal: React.FC<Props> = ({ onClose }) => {
  // Local state hook variables to store user task form inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Retrieve the task creation action from task global store
  const { createTask } = useTaskStore();

  // Handler for form submit events
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that the task title contains non-whitespace text
    if (!title.trim()) return;
    
    // Call store action to create task inside database with default state 'todo'
    await createTask(title, description, 'todo');
    
    // Close modal
    onClose();
  };

  return (
    // Click backdrop div layer to close modal
    <div className="modal-backdrop" onClick={onClose}>
      
      {/* stopPropagation prevents modal-box clicks from bubbling up and closing modal */}
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <h2 className="modal-title">Create Action Item</h2>
          {/* Close button with X icon */}
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          
          {/* Task Title Input */}
          <div className="form-group">
            <label>Task Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="E.g., Update project documentation"
              required 
            />
          </div>

          {/* Task Description Textarea */}
          <div className="form-group">
            <label>Description</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Add details..."
              rows={4}
            />
          </div>

          <div className="modal-footer">
            {/* Cancel Button */}
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            
            {/* Submit button: disabled if title text input is empty */}
            <button type="submit" className="submit-btn" disabled={!title.trim()}>Create Task</button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
