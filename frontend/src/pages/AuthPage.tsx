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
  const { login, register, loginWithGoogle, isLoading, error, token } = useAuthStore();
  const navigate = useNavigate();

  // State to check and display missing production configurations
  const [envWarning, setEnvWarning] = useState<string | null>(null);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      const apiUrl = import.meta.env.VITE_API_URL;
      const googleId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      
      if (!apiUrl) {
        setEnvWarning('VITE_API_URL is missing in Vercel. Frontend cannot contact Render backend.');
      } else if (!googleId) {
        setEnvWarning('VITE_GOOGLE_CLIENT_ID is missing in Vercel. Google auth is disabled.');
      }
    }
  }, []);

  // Redirect to dashboard if the user is already authenticated (token exists)
  useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  // Handle Google OAuth response payload
  const handleGoogleLoginResponse = async (response: any) => {
    if (response.credential) {
      await loginWithGoogle(response.credential);
    }
  };

  // Initialize Google Sign-in client flow with dynamic width fitting and observer
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if ((window as any).google?.accounts?.id) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleLoginResponse,
        });
        
        const btnElement = document.getElementById("google-signin-btn");
        if (btnElement) {
          // Clear container content to prevent duplication/overlapping iframe elements
          btnElement.innerHTML = '';
          
          // Dynamically compute width of the form element to match input fields
          const formElement = document.querySelector(".auth-form");
          const computeWidth = formElement ? formElement.clientWidth : 360;
          
          (window as any).google.accounts.id.renderButton(btnElement, {
            theme: "outline",
            size: "large",
            shape: "rectangular",
            logo_alignment: "left",
            text: "continue_with",
            width: Math.min(Math.max(computeWidth, 200), 400),
          });
        }
      }
    };

    initializeGoogleSignIn();

    // Resize observer to handle changes in container size smoothly without extra re-renders
    const formElement = document.querySelector(".auth-form");
    let resizeObserver: ResizeObserver | null = null;
    if (formElement) {
      resizeObserver = new ResizeObserver(() => {
        initializeGoogleSignIn();
      });
      resizeObserver.observe(formElement);
    }

    // Check periodically in case Google script takes time to load
    const interval = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        initializeGoogleSignIn();
        clearInterval(interval);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isLogin]);

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

        {/* Dynamic environment setup warning for developer deployments */}
        {envWarning && (
          <div className="auth-warning-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>{envWarning}</span>
          </div>
        )}

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

        {/* Google Authentication divider and button */}
        <div className="google-auth-container">
          <div className="auth-divider">
            <span>or</span>
          </div>
          <div id="google-signin-btn" className="google-btn"></div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
