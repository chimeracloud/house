import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlusIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import TicketCard from '../components/tickets/TicketCard';
import TicketFilters from '../components/tickets/TicketFilters';
import CreateTicketModal from '../components/tickets/CreateTicketModal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useTickets } from '../hooks/useTickets';
import { useAuthStore } from '../stores/authStore';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import Badge from '../components/ui/Badge';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const STATUSES = ['pending','awaiting_quote','approved','in_progress','awaiting_inspection','completed','rejected','paid'];

export default function Tickets() {
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState('grid');
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const { isStaff } = useAuthStore();

  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateOpen(true);
  }, [searchParams]);

  const queryParams = {};
  if (filters.status) queryParams.status = filters.status;
  if (filters.priority) queryParams.priority = filters.priority;

  const { data, isLoading } = useTickets(queryParams);

  const tickets = (data?.tickets || []).filter((t) => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Maintenance Tickets</h1>
          <p className="text-sm text-slate-500">
            {data?.total ?? 0} total · {data?.tickets?.filter((t) => !['completed','paid','rejected'].includes(t.status)).length ?? 0} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 ${view === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 ${view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <PlusIcon className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <TicketFilters filters={filters} onChange={setFilters} />

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={WrenchScrewdriverIcon}
          title="No tickets found"
          description="No maintenance tickets match your current filters."
          action={
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <PlusIcon className="w-4 h-4" /> Log Issue
            </button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Title</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden md:table-cell">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden lg:table-cell">Room</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${t.id}`} className="font-medium text-slate-900 dark:text-white hover:text-brand-600 truncate block max-w-xs">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Badge value={t.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Badge value={t.priority} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">{t.room?.name || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTicketModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
