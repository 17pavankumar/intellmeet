import { create } from 'zustand';
import API from '../services/api';

// Define the shape of a User object
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

// Define the state schema and actions for our Authentication store
interface AuthState {
  user: User | null; // Currently logged-in user profile details (null if guest)
  token: string | null; // JWT authorization token (null if guest)
  isLoading: boolean; // True while waiting for login/registration API responses
  error: string | null; // Holds error message strings if authentication fails
  login: (email: string, password: string) => Promise<void>; // Action: Login request
  register: (name: string, email: string, password: string) => Promise<void>; // Action: Registration request
  loginWithGoogle: (idToken: string) => Promise<void>; // Action: Google login request
  logout: () => void; // Action: Clear session credentials
}

// Create the Zustand store for managing authentication state globally
const useAuthStore = create<AuthState>((set) => ({
  // Initialize state properties directly from localStorage to keep the user logged in across page refreshes
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,

  // Action to log in a user with email and password
  login: async (email, password) => {
    // Clear any previous error and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a POST request to our auth controller API
      const { data } = await API.post('/auth/login', { email, password });
      
      // Extract the JWT token, and group the remaining user details under the 'user' object
      const { token, ...user } = data;
      
      // Save token and user details inside browser storage for persistence
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update global state variables
      set({ user, token, isLoading: false });
    } catch (err: any) {
      console.error('Login error:', err);
      // Retrieve the API error message or show a default fallback error message
      set({ 
        error: err.response?.data?.message || 'Login failed. Please make sure the backend is running.', 
        isLoading: false 
      });
    }
  },

  // Action to register a new user
  register: async (name, email, password) => {
    // Clear previous errors and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a POST request to register a user
      const { data } = await API.post('/auth/register', { name, email, password });
      
      // Destructure authentication credentials and user profile details
      const { token, ...user } = data;
      
      // Save credentials into browser storage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update global state variables
      set({ user, token, isLoading: false });
    } catch (err: any) {
      console.error('Registration error:', err);
      // Retrieve error message or show default fallback
      set({ 
        error: err.response?.data?.message || 'Registration failed. Please make sure the backend is running.', 
        isLoading: false 
      });
    }
  },

  // Action to log in a user via Google ID Token
  loginWithGoogle: async (idToken) => {
    // Clear previous error and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a POST request to register/login via Google
      const { data } = await API.post('/auth/google', { idToken });
      
      // Destructure authentication credentials and user profile details
      const { token, ...user } = data;
      
      // Save credentials into browser storage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update global state variables
      set({ user, token, isLoading: false });
    } catch (err: any) {
      console.error('Google login error:', err);
      // Retrieve error message or show default fallback
      set({ 
        error: err.response?.data?.message || 'Google Sign-in failed. Please make sure the backend is running.', 
        isLoading: false 
      });
    }
  },

  // Action to log out the user and clean up auth credentials
  logout: () => {
    // Clear persisted variables from browser localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Reset global state properties back to null
    set({ user: null, token: null });
  },
}));

export default useAuthStore;
