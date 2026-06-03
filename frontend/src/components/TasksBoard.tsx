import React from 'react';
import { useTasks } from '../hooks/useTasks';
import TaskCard from './TaskCard';
import './TasksBoard.css';

/**
 * TasksBoard Component
 * Renders a Kanban board structure representing task state columns: To Do, In Progress, Done.
 */
const TasksBoard: React.FC = () => {
  // Retrieve the tasks state array using React Query hook
  const { data: tasks = [] } = useTasks();

  // Filter tasks into their respective columns based on status values
  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="kanban-board">
      
      {/* 1. To Do Tasks Column */}
      <div className="kanban-column todo-col">
        <div className="kanban-header">
          <h3>To Do <span>{todoTasks.length}</span></h3>
        </div>
        <div className="kanban-list">
          {/* Map and render each task card */}
          {todoTasks.map(task => <TaskCard key={task._id} task={task} />)}
          {/* Show fallback message if column is empty */}
          {todoTasks.length === 0 && <div className="kanban-empty">No tasks</div>}
        </div>
      </div>

      {/* 2. In Progress Tasks Column */}
      <div className="kanban-column in-progress-col">
        <div className="kanban-header">
          <h3>In Progress <span>{inProgressTasks.length}</span></h3>
        </div>
        <div className="kanban-list">
          {/* Map and render in-progress tasks */}
          {inProgressTasks.map(task => <TaskCard key={task._id} task={task} />)}
          {inProgressTasks.length === 0 && <div className="kanban-empty">No tasks</div>}
        </div>
      </div>

      {/* 3. Done Tasks Column */}
      <div className="kanban-column done-col">
        <div className="kanban-header">
          <h3>Done <span>{doneTasks.length}</span></h3>
        </div>
        <div className="kanban-list">
          {/* Map and render completed tasks */}
          {doneTasks.map(task => <TaskCard key={task._id} task={task} />)}
          {doneTasks.length === 0 && <div className="kanban-empty">No tasks</div>}
        </div>
      </div>
      
    </div>
  );
};

export default TasksBoard;
