import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { quotes } from '../lib/data';
import { useAuthStore } from '../stores/authStore';

export function useQuotes(params = {}) {
  const role = useAuthStore((s) => s.profile?.role);
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['quotes', params, role, uid],
    queryFn: () => {
      if (role === 'contractor') return quotes.list({ ...params, contractorId: uid });
      return quotes.list(params);
    },
    enabled: !!uid,
  });
}

export function useSubmitQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => quotes.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket'] });
      toast.success('Quotation submitted');
    },
    onError: (err) => toast.error(err.message || 'Failed to submit quote'),
  });
}

export function useApproveQuote() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.profile?.role);
  return useMutation({
    mutationFn: ({ id, notes }) => quotes.approve(id, { currentRole: role, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket'] });
      toast.success('Quote approved');
    },
    onError: (err) => toast.error(err.message || 'Approval failed'),
  });
}

export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => quotes.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['ticket'] });
      toast.success('Quote rejected');
    },
    onError: (err) => toast.error(err.message || 'Rejection failed'),
  });
}
