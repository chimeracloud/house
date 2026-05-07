import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';

export function useTickets(params = {}) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const { data } = await api.get('/tickets', { params });
      return data;
    },
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data } = await api.get(`/tickets/${id}`);
      return data.ticket;
    },
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/tickets', payload);
      return data.ticket;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Ticket created successfully');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create ticket'),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await api.patch(`/tickets/${id}`, updates);
      return data.ticket;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Ticket updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Update failed'),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, content }) => {
      const { data } = await api.post(`/tickets/${ticketId}/comments`, { content });
      return data.comment;
    },
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add comment'),
  });
}

export function useSignOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, notes, passed }) => {
      const { data } = await api.post(`/tickets/${ticketId}/signoff`, { notes, passed });
      return data;
    },
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Inspection recorded');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Sign-off failed'),
  });
}
