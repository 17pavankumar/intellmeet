import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import MeetingRoomPage from './pages/MeetingRoomPage';
import useAuthStore from './store/authStore';

// Protected Route Wrapper component.
// It intercepts route navigation: if a client is not authenticated (no token),
// it redirects them to the auth login page `/auth`.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Retrieve token value from global auth state store
  const { token } = useAuthStore();
  
  // If token doesn't exist, redirect to /auth using Replace history option
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  
  // If token is found, render the protected component
  return <>{children}</>;
};

/**
 * Main Application Component
 * Initializes client router paths and registers page routes.
 */
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* Route for Auth Screen */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Protected route for Dashboard Screen */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Route for live Meeting Room Screen (Public with Guest Join Lobby) */}
        <Route path="/meeting/:id" element={<MeetingRoomPage />} />
        
        {/* Root Redirect: default root path `/` redirects directly to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
};

export default App;
