import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import './Auth.css';

/**
 * AuthPage Component
 * Handles user authentication (Login and Registration forms) in a single card view.
 */
const AuthPage: React.FC = () => {
  // Local state to toggle between Login mode (true) and Register mode (false)
  const [isLogin, setIsLogin] = useState(true);
  
  // Local states to capture text values typed in inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Extract auth actions and state variables from our global auth store
  const { login, register, isLoading, error, token } = useAuthStore();
  const navigate = useNavigate();

  // Redirect to dashboard if the user is already authenticated (token exists)
  useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  // Handler for form submit events
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent browser refresh
    e.preventDefault();
    
    // Choose which store action to invoke based on toggle state
    if (isLogin) {
      await login(email, password);
    } else {
      await register(name, email, password);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        
        {/* Top Branding Header */}
        <div className="auth-brand">
          <div className="auth-logo">IM</div>
          <h1 className="auth-title">IntellMeet</h1>
          <p className="auth-subtitle">AI-Powered Meeting Intelligence</p>
        </div>

        {/* Tab switchers to toggle between Sign In / Sign Up */}
        <div className="auth-tabs">
          <button
            id="login-tab"
            type="button"
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Log In
          </button>
          <button
            id="register-tab"
            type="button"
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        {/* Authentication Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          
          {/* Full Name field: rendered only when user is registering a new account */}
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          {/* Email input field */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password input field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Error Message: Rendered dynamically if store actions trigger an error */}
          {error && <p className="auth-error">{error}</p>}

          {/* Submit button: disables and shows feedback while waiting for API response */}
          <button
            id="auth-submit"
            type="submit"
            className="auth-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : isLogin ? 'Log In' : 'Create Account'}
          </button>
          
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
