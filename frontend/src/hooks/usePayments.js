import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { payments } from '../lib/data';
import { useAuthStore } from '../stores/authStore';

export function usePayments(filters = {}) {
  const role = useAuthStore((s) => s.profile?.role);
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['payments', filters, role, uid],
    queryFn: () => {
      if (role === 'contractor') return payments.list({ ...filters, contractorId: uid });
      return payments.list(filters);
    },
    enabled: !!uid,
  });
}

export function useAuthorizePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => payments.authorize(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Payment authorized');
    },
    onError: (e) => toast.error(e.message || 'Authorization failed'),
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ref }) => payments.markPaid(id, ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment marked as sent');
    },
    onError: (e) => toast.error(e.message || 'Failed to mark as paid'),
  });
}
