import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats');
      return data;
    },
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useActivity(limit = 20) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/activity', { params: { limit } });
      return data.activity;
    },
  });
}

export function useCosts(months = 6) {
  return useQuery({
    queryKey: ['costs', months],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/costs', { params: { months } });
      return data.costs;
    },
  });
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/notifications', {
        params: { unread_only: unreadOnly },
      });
      return data;
    },
    refetchInterval: 1000 * 30,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      if (id === 'all') {
        await api.post('/dashboard/notifications/read-all');
      } else {
        await api.patch(`/dashboard/notifications/${id}/read`);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/rooms');
      return data.rooms;
    },
  });
}
