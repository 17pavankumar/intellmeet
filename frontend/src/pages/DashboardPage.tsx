import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeetings } from '../hooks/useMeetings';
import { useTasks } from '../hooks/useTasks';
import { useTeam, useAddTeamMember, useRemoveTeamMember } from '../hooks/useTeam';
import useAuthStore from '../store/authStore';
import MeetingCard from '../components/MeetingCard.tsx';
import CreateMeetingModal from '../components/CreateMeetingModal.tsx';
import TasksBoard from '../components/TasksBoard.tsx';
import CreateTaskModal from '../components/CreateTaskModal.tsx';
import Analytics from '../components/Analytics.tsx';
import { Menu, X, LayoutDashboard, Video, CheckSquare, BarChart2, Users, Trash2 } from 'lucide-react';
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

  // Search input state for joining with a meeting code or link
  const [joinCode, setJoinCode] = useState('');

  // Team workspace invitation email state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Retrieve data using React Query hooks
  const { data: meetings = [], isLoading: loadingMeetings } = useMeetings();
  const { isLoading: loadingTasks } = useTasks();
  const { user, logout } = useAuthStore();

  // Retrieve team workspace details
  const { data: team, isLoading: loadingTeam } = useTeam();
  const members = team?.members || [];

  // Team mutation hooks
  const addMemberMutation = useAddTeamMember();
  const removeMemberMutation = useRemoveTeamMember();

  // React Router navigate hook to redirect to meeting rooms
  const navigate = useNavigate();

  // Sidebar navigation tab selector state (dashboard, meetings, tasks, analytics, team)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'meetings' | 'tasks' | 'analytics' | 'team'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Handler for joining an existing meeting using a code or link
  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    let meetingId = joinCode.trim();
    // Support full URLs by extracting the last part of the path (e.g. /meeting/id)
    if (meetingId.includes('/meeting/')) {
      const parts = meetingId.split('/meeting/');
      meetingId = parts[parts.length - 1];
    }
    // Remove query params if they exist
    meetingId = meetingId.split('?')[0];

    // Clean input and navigate
    setJoinCode('');
    navigate(`/meeting/${meetingId}`);
  };

  // Handler to add a user to the team workspace by email
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    if (!inviteEmail.trim()) return;

    try {
      await addMemberMutation.mutateAsync(inviteEmail);
      setInviteSuccess(`Successfully added ${inviteEmail} to your team workspace!`);
      setInviteEmail('');
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Failed to add team member.');
    }
  };

  // Handler to remove a member from the team workspace
  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the team workspace?')) return;
    
    try {
      await removeMemberMutation.mutateAsync(memberId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove team member.');
    }
  };

  return (
    <div className="dashboard">
      {/* Mobile Top Header */}
      <div className="mobile-top-bar">
        <button 
          className="hamburger-btn" 
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-bar-brand">
          <div className="mobile-bar-logo">IM</div>
          <span>IntellMeet</span>
        </div>
      </div>

      {/* Backdrop overlay for closing the mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* 1. SIDEBAR PANEL */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">IM</div>
          <span>IntellMeet</span>
          <button 
            className="sidebar-close-btn" 
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation Links */}
        <nav className="sidebar-nav">
          <a
            href="#"
            id="nav-dashboard"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); setIsSidebarOpen(false); }}
          >
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <a
            href="#"
            id="nav-meetings"
            className={`nav-item ${activeTab === 'meetings' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('meetings'); setIsSidebarOpen(false); }}
          >
            <Video size={18} /> Meetings
          </a>
          <a
            href="#"
            id="nav-tasks"
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('tasks'); setIsSidebarOpen(false); }}
          >
            <CheckSquare size={18} /> Tasks
          </a>
          <a
            href="#"
            id="nav-analytics"
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('analytics'); setIsSidebarOpen(false); }}
          >
            <BarChart2 size={18} /> Analytics
          </a>
          <a
            href="#"
            id="nav-team"
            className={`nav-item ${activeTab === 'team' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('team'); setIsSidebarOpen(false); }}
          >
            <Users size={18} /> Team Workspace
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
              
              <div className="header-actions">
                <form className="join-code-container" onSubmit={handleJoinWithCode}>
                  <input
                    type="text"
                    placeholder="Enter code or meeting link"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="join-code-input"
                  />
                  <button
                    type="submit"
                    className="join-code-btn"
                    disabled={!joinCode.trim()}
                  >
                    Join
                  </button>
                </form>
                <button
                  id="create-meeting-btn"
                  className="create-btn"
                  onClick={() => setShowModal(true)}
                >
                  + New Meeting
                </button>
              </div>
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
                <p className="page-subtitle">Manage and share your action items</p>
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

        {/* TAB VIEW: TEAM WORKSPACE */}
        {activeTab === 'team' && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Team Workspace</h1>
                <p className="page-subtitle">Invite team members to collaborate and delegate action items</p>
              </div>
            </div>

            <div className="team-container">
              <div className="team-info-card">
                <h2>🏢 {team?.name || "Workspace"}</h2>
                <p className="team-meta">Workspace ID: {team?._id}</p>
              </div>

              <div className="team-grid">
                {/* Members section */}
                <div className="team-card-section">
                  <h3>Team Members ({members.length})</h3>
                  {loadingTeam ? (
                    <div className="loading-state">Loading members...</div>
                  ) : (
                    <div className="team-members-list">
                      {members.map((member) => {
                        const isOwner = member._id === team?.owner;
                        const isSelf = member._id === user?._id;
                        return (
                          <div key={member._id} className="team-member-row">
                            <div className="member-info">
                              <div className="member-avatar">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="member-name">
                                  {member.name} {isSelf && <span className="self-tag">(You)</span>}
                                </p>
                                <p className="member-email">{member.email}</p>
                              </div>
                            </div>
                            <div className="member-actions">
                              <span className={`member-role-badge ${isOwner ? 'owner' : 'member'}`}>
                                {isOwner ? 'Owner' : 'Member'}
                              </span>
                              {!isOwner && team?.owner === user?._id && (
                                <button
                                  className="remove-member-btn"
                                  onClick={() => handleRemoveMember(member._id)}
                                  title="Remove Member"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Invite section */}
                <div className="team-card-section invite-section">
                  <h3>Invite Member</h3>
                  <p className="section-desc">Enter their email to add them to your shared task workspace.</p>
                  
                  <form onSubmit={handleAddMember} className="invite-form">
                    <div className="form-group">
                      <label htmlFor="invite-email">Member Email Address</label>
                      <input
                        id="invite-email"
                        type="email"
                        placeholder="e.g. colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    {inviteError && <div className="invite-error-banner">{inviteError}</div>}
                    {inviteSuccess && <div className="invite-success-banner">{inviteSuccess}</div>}
                    
                    <button
                      type="submit"
                      className="invite-submit-btn"
                      disabled={addMemberMutation.isPending}
                    >
                      {addMemberMutation.isPending ? 'Inviting...' : 'Invite to Workspace'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
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
