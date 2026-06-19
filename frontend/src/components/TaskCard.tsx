import React from 'react';
import { useUpdateTaskStatus, useDeleteTask } from '../hooks/useTasks';
import './TaskCard.css';

// Shape definition of a Task object
interface Task {
  _id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
}

// Props expected by TaskCard
interface Props {
  task: Task;
}

// Border styling colors corresponding to task statuses
const statusColors: Record<string, string> = {
  'todo': '#fca5a5',        // Light Red
  'in-progress': '#fcd34d', // Light Orange
  'done': '#6ee7b7',        // Light Green
};

/**
 * TaskCard Component
 * Renders a task details card inside the Kanban column board layout.
 */
const TaskCard: React.FC<Props> = ({ task }) => {
  // Retrieve task status update actions and delete actions using React Query hooks
  const updateStatusMutation = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();

  // Handle dropdown value changes to update task status in the database
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateStatusMutation.mutate({ id: task._id, status: e.target.value as any });
  };

  return (
    <div className="task-card">
      {/* Task title */}
      <h3 className="task-title">{task.title}</h3>
      
      {/* Task description */}
      <p className="task-desc">{task.description || 'No description'}</p>

      {/* Task assignee details */}
      {task.assignedTo && typeof task.assignedTo === 'object' && (
        <div className="task-assignee">
          <span className="assignee-label">Assignee:</span>
          <span className="assignee-name">{task.assignedTo.name}</span>
        </div>
      )}
      
      {/* Action panel containing dropdown selector and delete button */}
      <div className="task-actions">
        
        {/* Dropdown status selector */}
        <select 
          className="task-status-select" 
          value={task.status} 
          onChange={handleStatusChange}
          style={{ borderColor: statusColors[task.status] }} // Highlight borders dynamically
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        
        {/* Delete button to remove task */}
        <button 
          className="delete-btn" 
          onClick={() => deleteTaskMutation.mutate(task._id)}
        >
          Delete
        </button>
      </div>
      
    </div>
  );
};

export default TaskCard;
