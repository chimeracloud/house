import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircleIcon, XCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { useQuotes, useApproveQuote, useRejectQuote } from '../hooks/useQuotes';
import { useAuthStore } from '../stores/authStore';
import { useForm } from 'react-hook-form';

export default function Quotes() {
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const { isStaff, isOwner } = useAuthStore();
  const { register, handleSubmit, reset } = useForm();

  const { data: quotes, isLoading } = useQuotes({ status: statusFilter || undefined });
  const { mutate: approve, isPending: approving } = useApproveQuote();
  const { mutateAsync: reject, isPending: rejecting } = useRejectQuote();

  const handleReject = async ({ reason }) => {
    await reject({ id: rejectModal, reason });
    setRejectModal(null);
    reset();
  };

  const STATUS_OPTS = ['', 'submitted', 'pending_owner_approval', 'approved', 'rejected', 'expired'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Quotations</h1>
          <p className="text-sm text-slate-500">{quotes?.length ?? 0} quotes</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All Statuses'}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !quotes?.length ? (
        <EmptyState icon={DocumentTextIcon} title="No quotations" description="Submitted quotes will appear here." />
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge value={q.status} />
                    {q.ticket && (
                      <Link to={`/tickets/${q.ticket.id}`} className="text-xs text-brand-600 hover:underline truncate">
                        {q.ticket.title}
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-900 dark:text-white text-base">
                      £{Number(q.total_amount).toFixed(2)}
                    </span>
                    <span>By: {q.contractor?.full_name} {q.contractor?.company_name && `(${q.contractor.company_name})`}</span>
                    {q.estimated_days && <span>{q.estimated_days} day{q.estimated_days > 1 ? 's' : ''} estimated</span>}
                    {q.valid_until && <span>Valid until {format(new Date(q.valid_until), 'dd MMM yyyy')}</span>}
                  </div>
                  {q.notes && <p className="text-xs text-slate-500 italic mt-1.5">{q.notes}</p>}
                </div>

                {(isStaff || isOwner) && ['submitted', 'pending_owner_approval'].includes(q.status) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve({ id: q.id })}
                      disabled={approving}
                      className="btn-primary text-xs py-1.5"
                    >
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectModal(q.id)}
                      className="btn-secondary text-xs py-1.5"
                    >
                      <XCircleIcon className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Line items */}
              {q.items?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 text-left">
                        <th className="pb-1 font-medium">Description</th>
                        <th className="pb-1 font-medium text-center w-16">Qty</th>
                        <th className="pb-1 font-medium text-right w-20">Unit</th>
                        <th className="pb-1 font-medium text-right w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {q.items.map((item) => (
                        <tr key={item.id} className="text-slate-600 dark:text-slate-400">
                          <td className="py-1">
                            {item.description}
                            <span className="ml-1 text-slate-400 capitalize">({item.item_type})</span>
                          </td>
                          <td className="py-1 text-center">{item.quantity}</td>
                          <td className="py-1 text-right">£{Number(item.unit_price).toFixed(2)}</td>
                          <td className="py-1 text-right font-medium text-slate-900 dark:text-white">£{Number(item.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Quotation" size="sm">
        <form onSubmit={handleSubmit(handleReject)} className="space-y-4">
          <div>
            <label className="label">Reason for rejection *</label>
            <textarea
              rows={3}
              className="input resize-none"
              placeholder="Explain why this quote is being rejected..."
              {...register('reason', { required: 'Reason is required' })}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRejectModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={rejecting} className="btn-danger">
              {rejecting ? 'Rejecting...' : 'Reject Quote'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
