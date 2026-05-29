import { create } from 'zustand';
import API from '../services/api';

// Define the shape of a Task object
interface Task {
  _id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  dueDate?: string;
}

// Define the state schema and actions for our Task store
interface TaskState {
  tasks: Task[]; // Array containing all tasks assigned to the user
  isLoading: boolean; // True while waiting for task operations API calls to complete
  error: string | null; // Stores API error message strings if task operations fail
  fetchTasks: () => Promise<void>; // Action: Load all tasks assigned to the user
  createTask: (title: string, description: string, status: string) => Promise<void>; // Action: Create a new task
  updateTaskStatus: (id: string, status: string) => Promise<void>; // Action: Update task status state
  deleteTask: (id: string) => Promise<void>; // Action: Delete a task
}

// Create the Zustand store for managing task states globally
const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  isLoading: false,
  error: null,

  // Action to fetch all tasks assigned to current user
  fetchTasks: async () => {
    // Clear previous errors and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a GET request to /tasks
      const { data } = await API.get('/tasks');
      
      // Update global store state with the fetched tasks array
      set({ tasks: data, isLoading: false });
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || 'Failed to load tasks', 
        isLoading: false 
      });
    }
  },

  // Action to create a new task
  createTask: async (title, description, status) => {
    // Clear previous errors and set loading state to true
    set({ isLoading: true, error: null });
    try {
      // Send a POST request containing task details
      const { data } = await API.post('/tasks', { title, description, status });
      
      // Insert the newly created task object at the beginning of the list array
      set((state) => ({ 
        tasks: [data, ...state.tasks], 
        isLoading: false 
      }));
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || 'Failed to create task', 
        isLoading: false 
      });
    }
  },

  // Action to update the status code of a task (todo -> in-progress -> done)
  updateTaskStatus: async (id, status) => {
    try {
      // Send a PATCH request to update the task status attribute on the server
      const { data } = await API.patch(`/tasks/${id}/status`, { status });
      
      // Update the modified task object inside our local global state list
      set((state) => ({
        tasks: state.tasks.map((t) => (t._id === id ? data : t)),
      }));
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || 'Failed to update task' 
      });
    }
  },

  // Action to delete a task
  deleteTask: async (id) => {
    try {
      // Send a DELETE request targeting the specific task ID
      await API.delete(`/tasks/${id}`);
      
      // Remove the deleted task object from our local global state list
      set((state) => ({ 
        tasks: state.tasks.filter((t) => t._id !== id) 
      }));
    } catch (err: any) {
      set({ 
        error: err.response?.data?.message || 'Failed to delete task' 
      });
    }
  },
}));

export default useTaskStore;
