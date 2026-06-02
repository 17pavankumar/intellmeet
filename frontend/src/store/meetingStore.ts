import { create } from 'zustand';
import API from '../services/api';

// Define the shape of a Meeting object
interface Meeting {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  summary?: string;
  actionItems?: { text: string; assignedTo?: any; done: boolean }[];
  messages?: { sender: any; senderName?: string; text: string; createdAt: string }[];
}

// Define the state schema and actions for our Meeting store
interface MeetingState {
  meetings: Meeting[]; // Array containing all meetings the user participates in
  currentMeeting: Meeting | null; // The meeting document currently selected/viewed
  isLoading: boolean; // True while waiting for meeting actions API calls to finish
  error: string | null; // Stores API error message strings if meeting actions fail
  fetchMeetings: () => Promise<void>; // Action: Load all meetings
  createMeeting: (title: string, description: string, startTime: string) => Promise<any>; // Action: Create a new meeting, returns the created meeting
  deleteMeeting: (id: string) => Promise<void>; // Action: Delete a meeting
  selectMeeting: (meeting: Meeting) => void; // Action: Set the currently active meeting
}

// Create the Zustand store for managing meeting states globally
const useMeetingStore = create<MeetingState>((set) => ({
  meetings: [],
  currentMeeting: null,
  isLoading: false,
  error: null,

  // Action to fetch all meetings associated with the user from backend
  fetchMeetings: async () => {
    // Clear previous errors and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a GET request to /meetings
      const { data } = await API.get('/meetings');
      
      // Update global state with the fetched meeting records
      set({ meetings: data, isLoading: false });
    } catch (err: any) {
      // Update store state with error message
      set({ 
        error: err.response?.data?.message || 'Failed to load meetings', 
        isLoading: false 
      });
    }
  },

  // Action to create a new meeting
  // Returns the new meeting object on success, or throws an error on failure.
  createMeeting: async (title, description, startTime) => {
    // Clear previous errors and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a POST request containing meeting parameters
      const { data } = await API.post('/meetings', { title, description, startTime });
      
      // Insert the newly created meeting object at the beginning of the list array
      set((state) => ({ 
        meetings: [data, ...state.meetings], 
        isLoading: false 
      }));
      
      // Return the new meeting data so callers (like CreateMeetingModal)
      // can navigate to the newly created meeting room immediately
      return data;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create meeting. Make sure you are logged in and the backend is running.';
      set({ error: message, isLoading: false });
      
      // Re-throw the error so the modal can catch it and show feedback
      throw new Error(message);
    }
  },

  // Action to delete a meeting
  deleteMeeting: async (id) => {
    try {
      // Send a DELETE request targeting the specific meeting ID
      await API.delete(`/meetings/${id}`);
      
      // Remove the deleted meeting object from the local global state array
      set((state) => ({ 
        meetings: state.meetings.filter((m) => m._id !== id) 
      }));
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || 'Failed to delete meeting' 
      });
    }
  },

  // Action to select a specific meeting for viewing
  selectMeeting: (meeting) => set({ currentMeeting: meeting }),
}));

export default useMeetingStore;
