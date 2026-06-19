import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../services/api';

// Interface representing a team member returned by the API
export interface Member {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

// Interface representing the Team Workspace
export interface Team {
  _id: string;
  name: string;
  owner: string;
  members: Member[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook to retrieve the current user's team workspace details and members.
 */
export const useTeam = () => {
  return useQuery<Team>({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await API.get('/teams');
      return data;
    },
  });
};

/**
 * Hook to add a member to the current team workspace by email.
 */
export const useAddTeamMember = () => {
  const queryClient = useQueryClient();
  return useMutation<Team, Error, string>({
    mutationFn: async (email: string) => {
      const { data } = await API.post('/teams/members', { email });
      return data;
    },
    onSuccess: () => {
      // Invalidate the 'team' query cache to trigger a reload of members
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
};

/**
 * Hook to remove a member from the current team workspace by member ID.
 */
export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();
  return useMutation<Team, Error, string>({
    mutationFn: async (userId: string) => {
      const { data } = await API.delete(`/teams/members/${userId}`);
      return data;
    },
    onSuccess: () => {
      // Invalidate both 'team' and 'tasks' queries to update UI and task assignments
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};
