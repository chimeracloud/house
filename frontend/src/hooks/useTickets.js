import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { tickets } from '../lib/data';

export function useTickets(params = {}) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const list = await tickets.list(params);
      return { tickets: list, total: list.length };
    },
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => tickets.get(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => tickets.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Ticket created successfully');
    },
    onError: (err) => toast.error(err.message || 'Failed to create ticket'),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }) => tickets.update(id, updates),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Ticket updated');
    },
    onError: (err) => toast.error(err.message || 'Update failed'),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, content }) => tickets.addComment(ticketId, content),
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to add comment'),
  });
}

export function useSignOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, notes, passed }) => tickets.signOff(ticketId, { notes, passed }),
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Inspection recorded');
    },
    onError: (err) => toast.error(err.message || 'Sign-off failed'),
  });
}
