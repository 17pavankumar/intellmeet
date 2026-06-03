import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../services/api';

export interface Meeting {
  _id: string;
  title: string;
  description: string;
  startTime: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  summary?: string;
  actionItems?: { text: string; assignedTo?: any; done: boolean }[];
  messages?: { sender: any; senderName?: string; text: string; createdAt: string }[];
}

export const useMeetings = () => {
  return useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data } = await API.get('/meetings');
      return data;
    },
  });
};

export const useMeeting = (id: string) => {
  return useQuery<Meeting>({
    queryKey: ['meeting', id],
    queryFn: async () => {
      const { data } = await API.get(`/meetings/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; description: string; startTime: string }) => {
      const { data } = await API.post('/meetings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
};

export const useDeleteMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await API.delete(`/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
};
