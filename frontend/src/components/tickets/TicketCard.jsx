import { Link } from 'react-router-dom';
import { MapPinIcon, CalendarIcon, UserIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import Badge from '../ui/Badge';
import clsx from 'clsx';

const priorityBorder = {
  low: 'border-l-slate-300',
  medium: 'border-l-amber-400',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

export default function TicketCard({ ticket }) {
  const isOverdue = ticket.deadline && new Date(ticket.deadline) < new Date()
    && !['completed', 'paid', 'rejected'].includes(ticket.status);

  return (
    <Link to={`/tickets/${ticket.id}`} className="block group">
      <div className={clsx(
        'card p-4 border-l-4 transition-shadow hover:shadow-md',
        priorityBorder[ticket.priority] || 'border-l-slate-300'
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge value={ticket.status} />
              <Badge value={ticket.priority} />
            </div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors line-clamp-2">
              {ticket.title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ticket.description}</p>
          </div>

          {(() => {
            const beforeImg = ticket.attachments?.find(
              (a) => a.file_type === 'image' && (a.phase || 'before') === 'before'
            );
            const anyImg = beforeImg || ticket.attachments?.find((a) => a.file_type === 'image');
            if (!anyImg) return null;
            return (
              <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                <img
                  src={anyImg.file_url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
                  }}
                />
              </div>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500">
          {ticket.room && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              {ticket.room.name || `Room ${ticket.room.number}`}
            </span>
          )}
          {ticket.assigned_contractor && (
            <span className="flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5" />
              {ticket.assigned_contractor?.full_name || 'Assigned'}
            </span>
          )}
          <span className={clsx('flex items-center gap-1', isOverdue && 'text-red-500 font-medium')}>
            <CalendarIcon className="w-3.5 h-3.5" />
            {ticket.deadline
              ? isOverdue
                ? `Overdue · ${formatDistanceToNow(new Date(ticket.deadline))} ago`
                : `Due ${formatDistanceToNow(new Date(ticket.deadline), { addSuffix: true })}`
              : formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })
            }
          </span>
          {ticket.quotations?.length > 0 && (
            <span className="text-brand-600 dark:text-brand-400">
              {ticket.quotations.length} quote{ticket.quotations.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
