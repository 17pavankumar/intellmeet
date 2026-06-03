import React, { useState } from 'react';
import { useMeetings } from '../hooks/useMeetings';
import { useTasks } from '../hooks/useTasks';
import useAuthStore from '../store/authStore';
import MeetingCard from '../components/MeetingCard.tsx';
import CreateMeetingModal from '../components/CreateMeetingModal.tsx';
import TasksBoard from '../components/TasksBoard.tsx';
import CreateTaskModal from '../components/CreateTaskModal.tsx';
import Analytics from '../components/Analytics.tsx';
import './Dashboard.css';

/**
 * DashboardPage Component
 * The central workspace for logged-in users, displaying statistics, recent meetings, 
 * navigation sidebar tabs, and lists of tasks.
 */
const DashboardPage: React.FC = () => {
  // Toggle states to display or hide creation modals
  const [showModal, setShowModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Retrieve data using React Query hooks
  const { data: meetings = [], isLoading: loadingMeetings } = useMeetings();
  const { isLoading: loadingTasks } = useTasks();
  const { user, logout } = useAuthStore();

  // Sidebar navigation tab selector state (dashboard, meetings, tasks, analytics)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'meetings' | 'tasks' | 'analytics'>('dashboard');

  return (
    <div className="dashboard">
      
      {/* 1. SIDEBAR PANEL */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">IM</div>
          <span>IntellMeet</span>
        </div>
        
        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <a
            href="#"
            id="nav-dashboard"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
          >
            <span className="nav-icon"></span> Dashboard
          </a>
          <a
            href="#"
            id="nav-meetings"
            className={`nav-item ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('meetings'); }}
          >
            <span className="nav-icon"></span> Meetings
          </a>
          <a
            href="#"
            id="nav-tasks"
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('tasks'); }}
          >
            <span className="nav-icon"></span> Tasks
          </a>
          <a
            href="#"
            id="nav-analytics"
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('analytics'); }}
          >
            <span className="nav-icon"></span> Analytics
          </a>
        </nav>
        
        {/* Footer Profile & Logout */}
        <div className="sidebar-footer">
          <div className="user-info">
            {/* Display first letter of user's name as an avatar placeholder */}
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <span className="user-name">{user?.name}</span>
          </div>
          <button id="logout-btn" className="logout-btn" onClick={logout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="main-content">
        
        {/* TAB VIEW: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Overview of your meetings and tasks</p>
              </div>
              <button
                id="create-meeting-btn"
                className="create-btn"
                onClick={() => setShowModal(true)}
              >
                + New Meeting
              </button>
            </div>

            {/* Statistics Cards Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">Total Meetings</p>
                <p className="stat-value">{meetings.length}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Completed</p>
                <p className="stat-value">
                  {meetings.filter((m) => m.status === 'completed').length}
                </p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Scheduled</p>
                <p className="stat-value">
                  {meetings.filter((m) => m.status === 'scheduled').length}
                </p>
              </div>
            </div>

            {/* Recent Meetings Lists */}
            <h2 style={{ marginTop: '1rem', fontSize: '1.2rem' }}>Recent Meetings</h2>
            {loadingMeetings ? (
              <div className="loading-state">Loading meetings...</div>
            ) : meetings.length === 0 ? (
              <div className="empty-state">
                <p>No meetings yet.</p>
                <p>Click "+ New Meeting" to create one.</p>
              </div>
            ) : (
              <div className="meetings-grid">
                {/* Limit rendering to the 3 most recent meetings */}
                {meetings.slice(0, 3).map((meeting) => (
                  <MeetingCard key={meeting._id} meeting={meeting} />
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB VIEW: ALL MEETINGS */}
        {activeTab === 'meetings' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Your Meetings</h1>
                <p className="page-subtitle">Manage and review your AI-powered meetings</p>
              </div>
              <button
                className="create-btn"
                onClick={() => setShowModal(true)}
              >
                + New Meeting
              </button>
            </div>

            {loadingMeetings ? (
              <div className="loading-state">Loading meetings...</div>
            ) : meetings.length === 0 ? (
              <div className="empty-state">
                <p>No meetings yet.</p>
              </div>
            ) : (
              <div className="meetings-grid">
                {meetings.map((meeting) => (
                  <MeetingCard key={meeting._id} meeting={meeting} />
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB VIEW: KANBAN TASKS BOARD */}
        {activeTab === 'tasks' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Your Tasks</h1>
                <p className="page-subtitle">Manage your action items</p>
              </div>
              <button
                className="create-btn"
                onClick={() => setShowTaskModal(true)}
              >
                + New Task
              </button>
            </div>
            
            {loadingTasks ? (
              <div className="loading-state">Loading tasks...</div>
            ) : (
              <TasksBoard />
            )}
          </>
        )}

        {/* TAB VIEW: ANALYTICS */}
        {activeTab === 'analytics' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Analytics & Insights</h1>
                <p className="page-subtitle">Understand meeting statistics and task progress</p>
              </div>
            </div>
            <Analytics />
          </>
        )}
        
      </main>

      {/* 3. MODAL OVERLAY WRAPPERS */}
      
      {/* Conditionally render Create Meeting modal */}
      {showModal && <CreateMeetingModal onClose={() => setShowModal(false)} />}
      
      {/* Conditionally render Create Task modal */}
      {showTaskModal && <CreateTaskModal onClose={() => setShowTaskModal(false)} />}
      
    </div>
  );
};

export default DashboardPage;
