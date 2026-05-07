import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';

export function useQuotes(params = {}) {
  return useQuery({
    queryKey: ['quotes', params],
    queryFn: async () => {
      const { data } = await api.get('/quotes', { params });
      return data.quotations;
    },
  });
}

export function useQuote(id) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes/${id}`);
      return data.quotation;
    },
    enabled: !!id,
  });
}

export function useSubmitQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/quotes', payload);
      return data.quotation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Quotation submitted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to submit quote'),
  });
}

export function useApproveQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }) => {
      const { data } = await api.post(`/quotes/${id}/approve`, { notes });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Quote approved');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Approval failed'),
  });
}

export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const { data } = await api.post(`/quotes/${id}/reject`, { reason });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote rejected');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Rejection failed'),
  });
}
