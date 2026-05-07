import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CurrencyPoundIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function Payments() {
  const [statusFilter, setStatusFilter] = useState('');
  const { isOwner, isAdmin } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payments', statusFilter],
    queryFn: async () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/payments', { params });
      return data.payments;
    },
  });

  const { mutate: authorize, isPending: authorizing } = useMutation({
    mutationFn: async (id) => api.post(`/payments/${id}/authorize`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment authorized');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Authorization failed'),
  });

  const { mutate: markPaid, isPending: marking } = useMutation({
    mutationFn: async ({ id, ref }) => api.post(`/payments/${id}/paid`, { transaction_ref: ref }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment marked as sent');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to mark as paid'),
  });

  const totalPending = (data || [])
    .filter((p) => p.status === 'authorized')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Payments</h1>
          <p className="text-sm text-slate-500">
            {data?.length ?? 0} records
            {totalPending > 0 && ` · £${totalPending.toFixed(2)} pending payment`}
          </p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !data?.length ? (
        <EmptyState icon={CurrencyPoundIcon} title="No payments" description="Payment records will appear here." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Ticket</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden sm:table-cell">Contractor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden md:table-cell">Method</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden lg:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    {p.ticket ? (
                      <Link to={`/tickets/${p.ticket.id}`} className="text-brand-600 hover:underline text-xs font-medium truncate block max-w-[160px]">
                        {p.ticket.title}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-600 dark:text-slate-400">
                    {p.contractor?.full_name || '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    £{Number(p.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3"><Badge value={p.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500 capitalize">
                    {p.payment_method?.replace('_', ' ') || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                    {p.paid_at
                      ? format(new Date(p.paid_at), 'dd MMM yyyy')
                      : format(new Date(p.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(isOwner || isAdmin) && p.status === 'pending' && (
                      <button
                        onClick={() => authorize(p.id)}
                        disabled={authorizing}
                        className="btn-primary text-xs py-1 px-2"
                      >
                        <CheckCircleIcon className="w-3.5 h-3.5" /> Authorize
                      </button>
                    )}
                    {p.status === 'authorized' && (
                      <button
                        onClick={() => markPaid({ id: p.id, ref: `TXN-${Date.now()}` })}
                        disabled={marking}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
