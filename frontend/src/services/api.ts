import axios from 'axios';

// Resolve host address dynamically:
// Windows local hosts sometimes run into connection resolution conflicts (localhost vs 127.0.0.1).
// This script checks if the app is rendered in the browser and resolves the correct API address.
const host = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';

// Create a configured Axios HTTP client instance pointing to our backend API URL
const API = axios.create({
  baseURL: `http://${host}:5000/api`,
});

// Configure a request interceptor to automatically attach our user token to every outgoing HTTP request.
// Before sending a request, the function retrieves the JWT token from browser localStorage.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  // If token is found, add the Authorization header formatted as: Bearer <token>
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Export the configured API instance
export default API;
