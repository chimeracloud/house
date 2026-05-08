import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, PaperClipIcon, ChatBubbleLeftIcon,
  CheckCircleIcon, XCircleIcon, PlusIcon, CameraIcon, ArrowUpTrayIcon,
  MapPinIcon, CalendarIcon, UserIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import SubmitQuoteModal from '../components/quotes/SubmitQuoteModal';
import CompleteJobModal from '../components/tickets/CompleteJobModal';
import { useTicket, useAddComment, useUpdateTicket, useSignOff } from '../hooks/useTickets';
import { useApproveQuote, useRejectQuote } from '../hooks/useQuotes';
import { useAuthStore } from '../stores/authStore';
import { uploadTicketAttachment } from '../lib/upload';

// Status transitions a manager/owner can drive directly. The contractor's
// "in_progress → awaiting_inspection" transition is handled separately via
// the Complete Job modal so it can require completion photos.
const STATUS_TRANSITIONS = {
  pending:              ['awaiting_quote', 'rejected'],
  awaiting_quote:       ['approved', 'rejected'],
  approved:             ['in_progress'],
  in_progress:          ['awaiting_inspection'],
  awaiting_inspection:  [],
  completed:            ['paid'],
  rejected:             [],
  paid:                 [],
};

export default function TicketDetail() {
  const { id } = useParams();
  const { data: ticket, isLoading } = useTicket(id);
  const { isStaff, isContractor, isOwner, user } = useAuthStore();
  const myUid = user?.uid;
  const [comment, setComment] = useState('');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [signoffNotes, setSignoffNotes] = useState('');
  const [signoffPassed, setSignoffPassed] = useState(true);

  const { mutate: addComment, isPending: addingComment } = useAddComment();
  const { mutate: updateTicket } = useUpdateTicket();
  const { mutateAsync: approveQuote } = useApproveQuote();
  const { mutateAsync: rejectQuote } = useRejectQuote();
  const { mutateAsync: signOff, isPending: signingOff } = useSignOff();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const handleUpload = (phase) => async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadTicketAttachment(id, file, { phase });
      }
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'storage/unauthorized' || code === 'storage/object-not-found' || /storage/i.test(err.message || '')) {
        toast.error('Storage upload failed — enable Firebase Storage (requires Blaze plan).');
      } else {
        toast.error(err.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="text-center py-24 text-slate-500">Ticket not found</div>;

  const canTransition = isStaff || isOwner;
  const transitions = STATUS_TRANSITIONS[ticket.status] || [];

  const handleStatusChange = (newStatus) => {
    updateTicket({ id: ticket.id, status: newStatus });
  };

  const handleComment = () => {
    if (!comment.trim()) return;
    addComment({ ticketId: ticket.id, content: comment });
    setComment('');
  };

  const handleSignoff = async () => {
    await signOff({ ticketId: ticket.id, notes: signoffNotes, passed: signoffPassed });
    setSignoffOpen(false);
    setSignoffNotes('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Tickets
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge value={ticket.status} />
              <Badge value={ticket.priority} />
              {ticket.category && (
                <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{ticket.category}</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{ticket.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{ticket.description}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {isContractor && ['approved', 'pending', 'awaiting_quote'].includes(ticket.status) && (
              <button onClick={() => setQuoteOpen(true)} className="btn-secondary text-xs">
                <PlusIcon className="w-3.5 h-3.5" /> Submit Quote
              </button>
            )}

            {/* Contractor's "I'm done" flow — requires after photos */}
            {isContractor && ticket.status === 'in_progress' && ticket.assigned_contractor?.id === myUid && (
              <button onClick={() => setCompleteOpen(true)} className="btn-primary text-xs">
                <CameraIcon className="w-3.5 h-3.5" /> Mark Complete
              </button>
            )}

            {canTransition && ticket.status === 'awaiting_inspection' && (
              <button onClick={() => setSignoffOpen(true)} className="btn-primary text-xs">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Sign Off
              </button>
            )}
            {canTransition && transitions
              .filter((s) => !(ticket.status === 'in_progress' && s === 'awaiting_inspection'))
              .map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)} className="btn-secondary text-xs">
                  → {s.replace('_', ' ')}
                </button>
              ))
            }
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
          {ticket.room && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              {ticket.room.name || `Room ${ticket.room.number}`}
            </span>
          )}
          {ticket.deadline && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" />
              Due {format(new Date(ticket.deadline), 'dd MMM yyyy')}
            </span>
          )}
          {ticket.created_by_profile && (
            <span className="flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5" />
              Logged by {ticket.created_by_profile.full_name}
            </span>
          )}
          {ticket.assigned_contractor && (
            <span className="flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5" />
              Assigned: {ticket.assigned_contractor.full_name}
            </span>
          )}
          {ticket.estimated_cost && (
            <span>Estimated: R {Number(ticket.estimated_cost).toFixed(2)}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Attachments + Quotes + Comments */}
        <div className="lg:col-span-2 space-y-5">
          {/* Photos: Before / After */}
          <PhotoSection
            ticket={ticket}
            uploading={uploading}
            onUpload={handleUpload}
          />

          {/* Other (non-image) attachments */}
          {ticket.attachments?.some((a) => a.file_type !== 'image') && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <PaperClipIcon className="w-4 h-4" /> Documents
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ticket.attachments.filter((a) => a.file_type !== 'image').map((att) => (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-400 transition-colors block">
                    <PaperClipIcon className="w-5 h-5 text-slate-400 mb-1" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{att.file_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{att.file_type}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quotes */}
          {ticket.quotations?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Quotations ({ticket.quotations.length})
              </h2>
              <div className="space-y-3">
                {ticket.quotations.map((q) => (
                  <div key={q.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {q.contractor?.full_name} {q.contractor?.company_name && `· ${q.contractor.company_name}`}
                        </p>
                        <p className="text-lg font-bold text-brand-600">R {Number(q.total_amount).toFixed(2)}</p>
                      </div>
                      <Badge value={q.status} />
                    </div>
                    {q.items?.length > 0 && (
                      <div className="text-xs text-slate-500 space-y-1 mb-3">
                        {q.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.description}</span>
                            <span>R {Number(item.total).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.notes && <p className="text-xs text-slate-500 italic">{q.notes}</p>}
                    {isStaff && q.status === 'submitted' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => approveQuote({ id: q.id })} className="btn-primary text-xs py-1.5">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => rejectQuote({ id: q.id, reason: 'Rejected by manager' })} className="btn-danger text-xs py-1.5">
                          <XCircleIcon className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              Comments ({ticket.comments?.length || 0})
            </h2>
            <div className="space-y-3 mb-4">
              {ticket.comments?.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-400 flex-shrink-0">
                    {c.author?.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-900 dark:text-white">{c.author?.full_name}</span>
                      <span className="text-xs text-slate-400">{format(new Date(c.created_at), 'dd MMM, HH:mm')}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              {!ticket.comments?.length && (
                <p className="text-xs text-slate-400 text-center py-2">No comments yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1 text-sm"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              />
              <button onClick={handleComment} disabled={addingComment || !comment.trim()} className="btn-primary text-xs px-3">
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right: Approvals + Timeline */}
        <div className="space-y-5">
          {ticket.approvals?.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Approvals</h2>
              <div className="space-y-3">
                {ticket.approvals.map((a) => (
                  <div key={a.id} className="border-l-2 pl-3 border-brand-300">
                    <div className="flex items-center gap-2">
                      {a.decision === 'approved'
                        ? <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                      }
                      <span className="text-xs font-medium capitalize text-slate-900 dark:text-white">{a.type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(a.created_at), 'dd MMM yyyy')}
                    </p>
                    {a.notes && <p className="text-xs text-slate-500 italic mt-1">{a.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Details</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900 dark:text-white">{format(new Date(ticket.created_at), 'dd MMM yyyy')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-900 dark:text-white">{format(new Date(ticket.updated_at), 'dd MMM yyyy')}</dd>
              </div>
              {ticket.deadline && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Deadline</dt>
                  <dd className="text-slate-900 dark:text-white">{format(new Date(ticket.deadline), 'dd MMM yyyy')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Quotes</dt>
                <dd className="text-slate-900 dark:text-white">{ticket.quotations?.length || 0}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Submit quote (contractor) */}
      {isContractor && (
        <SubmitQuoteModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          ticketId={ticket.id}
          ticketTitle={ticket.title}
        />
      )}

      {/* Mark complete (contractor) — requires after photos */}
      <CompleteJobModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        ticket={ticket}
      />

      {/* Sign-off modal */}
      <Modal open={signoffOpen} onClose={() => setSignoffOpen(false)} title="Inspection Sign-off">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Record your inspection result for <strong>{ticket.title}</strong>.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setSignoffPassed(true)}
              className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${signoffPassed ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
            >
              <CheckCircleIcon className="w-5 h-5 mx-auto mb-1" />
              Pass
            </button>
            <button
              onClick={() => setSignoffPassed(false)}
              className={`flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors ${!signoffPassed ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
            >
              <XCircleIcon className="w-5 h-5 mx-auto mb-1" />
              Fail / Re-work
            </button>
          </div>
          <div>
            <label className="label">Inspection Notes</label>
            <textarea
              rows={3}
              className="input resize-none"
              placeholder="Add inspection notes..."
              value={signoffNotes}
              onChange={(e) => setSignoffNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setSignoffOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSignoff} disabled={signingOff} className={signoffPassed ? 'btn-primary' : 'btn-danger'}>
              {signingOff ? 'Saving...' : signoffPassed ? 'Sign Off as Complete' : 'Return for Re-work'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Photo gallery: WAS (issue) photos and NOW (completion) photos side-by-side.
// Anyone can upload "before" photos; "after" uploads also have a button here
// for staff/contractor convenience but the canonical contractor completion
// path is the CompleteJobModal which forces an after-photo upload.
// ----------------------------------------------------------------------------
function PhotoSection({ ticket, uploading, onUpload }) {
  const images = (ticket.attachments || []).filter((a) => a.file_type === 'image');
  const before = images.filter((a) => (a.phase || 'before') === 'before');
  const after = images.filter((a) => a.phase === 'after');

  const Gallery = ({ items, emptyText }) => (
    items.length ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((att) => (
          <a
            key={att.id}
            href={att.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 block hover:opacity-80 transition-opacity"
          >
            <img src={att.file_url} alt={att.label || att.file_name} className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
    ) : (
      <p className="text-xs text-slate-400 text-center py-6">{emptyText}</p>
    )
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <PaperClipIcon className="w-4 h-4" /> Photos
        </h2>
        {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Before / WAS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Issue (WAS)
            </h3>
            <label className="btn-ghost text-xs cursor-pointer py-1 px-2">
              <CameraIcon className="w-3 h-3" />
              Add
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onUpload('before')}
                disabled={uploading}
              />
            </label>
          </div>
          <Gallery items={before} emptyText="No issue photos yet" />
        </div>

        {/* After / NOW */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Completion (NOW)
            </h3>
            <label className="btn-ghost text-xs cursor-pointer py-1 px-2">
              <CameraIcon className="w-3 h-3" />
              Add
              <input
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onUpload('after')}
                disabled={uploading}
              />
            </label>
          </div>
          <Gallery items={after} emptyText="No completion photos yet" />
        </div>
      </div>
    </div>
  );
}
