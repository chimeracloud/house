import { formatDistanceToNow } from 'date-fns';
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useNotifications, useMarkRead } from '../hooks/useDashboard';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import clsx from 'clsx';

const TYPE_ICONS = {
  ticket_created: '🔧',
  quote_submitted: '📋',
  quote_approved: '✅',
  quote_rejected: '❌',
  inspection_passed: '✔️',
  inspection_failed: '⚠️',
  payment_authorized: '💳',
  payment_sent: '💸',
};

export default function Notifications() {
  const { data, isLoading } = useNotifications();
  const { mutate: markRead, isPending } = useMarkRead();

  const notifications = data?.notifications || [];
  const unread = data?.unread_count || 0;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={() => markRead('all')} disabled={isPending} className="btn-secondary text-xs">
            <CheckIcon className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !notifications.length ? (
        <EmptyState icon={BellIcon} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={clsx(
                'flex gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                !n.read && 'bg-brand-50/50 dark:bg-brand-900/10'
              )}
              onClick={() => !n.read && markRead(n.id)}
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-base flex-shrink-0">
                {TYPE_ICONS[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={clsx('text-sm', n.read ? 'text-slate-600 dark:text-slate-400' : 'font-semibold text-slate-900 dark:text-white')}>
                    {n.title}
                  </p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />}
                </div>
                {n.message && <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
