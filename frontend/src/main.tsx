import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';

// Create a TanStack Query client with sensible defaults.
// staleTime: 30s — data is considered fresh for 30 seconds before background re-fetch.
// retry: 1 — only retry failed requests once before showing an error.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
    },
  },
});

// Compile and mount our React application under the root div element in index.html.
// QueryClientProvider makes server-state available to every component in the tree.
// StrictMode enables checks and logs warnings during development for code quality.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
