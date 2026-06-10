import axios from 'axios';

// Resolve host address dynamically:
// Windows local hosts sometimes run into connection resolution conflicts (localhost vs 127.0.0.1).
// This script checks if the app is rendered in the browser and resolves the correct API address.
const host = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';

// Use production backend API URL if specified, otherwise fall back to localhost
const apiBaseUrl = import.meta.env.VITE_API_URL || `http://${host}:5000/api`;

// Create a configured Axios HTTP client instance pointing to our backend API URL
const API = axios.create({
  baseURL: apiBaseUrl,
});

// REQUEST interceptor: Automatically attach our JWT token to every outgoing HTTP request.
// Before sending a request, the function retrieves the JWT token from browser localStorage.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  // If token is found, add the Authorization header formatted as: Bearer <token>
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// RESPONSE interceptor: Automatically handle expired or invalid token errors globally.
// If ANY API request comes back with a 401 Unauthorized status, it means the user's
// stored JWT token is invalid or has expired. We clear all credentials and redirect
// to the login page so the user can sign in again to get a fresh token.
API.interceptors.response.use(
  // On success, just pass the response through unchanged
  (response) => response,
  
  // On error, check if it's a 401 (auth failure)
  (error) => {
    if (error.response?.status === 401) {
      // Clear all stored credentials from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      const currentPath = window.location.pathname;
      
      // IMPORTANT: Do NOT redirect guests on meeting pages.
      // Meeting rooms allow unauthenticated guest access — guests click a shared
      // link and enter their name in the lobby. Redirecting them to /auth here
      // would prevent anyone from joining via a shared link without an account.
      const isMeetingPage = currentPath.startsWith('/meeting/');
      
      // Only redirect if we're not already on the auth page (prevents redirect loops)
      // and not on a meeting room page (guests are allowed there)
      if (currentPath !== '/auth' && !isMeetingPage) {
        window.location.href = '/auth';
      }
    }
    
    // Re-throw the error so individual catch blocks can still handle it if needed
    return Promise.reject(error);
  }
);

// Export the configured API instance
export default API;
