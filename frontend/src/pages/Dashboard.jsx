import { Link } from 'react-router-dom';
import {
  WrenchScrewdriverIcon, ClockIcon, ExclamationTriangleIcon,
  CurrencyPoundIcon, UserGroupIcon, CheckCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import StatCard from '../components/ui/StatCard';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import { useDashboardStats, useActivity, useCosts } from '../hooks/useDashboard';
import { useAuthStore } from '../stores/authStore';
import { useTickets } from '../hooks/useTickets';

const ACTION_LABELS = {
  ticket_created: 'Ticket logged',
  ticket_updated: 'Ticket updated',
  quote_submitted: 'Quote submitted',
  quote_approved: 'Quote approved',
  payment_authorized: 'Payment authorized',
  payment_paid: 'Payment sent',
  inspection_passed: 'Inspection passed',
  inspection_failed: 'Re-work required',
};

const ROLE_LABELS = {
  admin:            { label: 'Admin Dashboard',            badge: 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30' },
  property_owner:   { label: 'Owner Dashboard',            badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/30' },
  property_manager: { label: 'Manager Dashboard',          badge: 'bg-brand-500/15 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/30' },
  contractor:       { label: 'Contractor Dashboard',       badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30' },
  tenant:           { label: 'Tenant Dashboard',           badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30' },
  resident:         { label: 'Resident Dashboard',         badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30' },
};

export default function Dashboard() {
  const { user, role } = useAuthStore();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity } = useActivity(10);
  const { data: costs } = useCosts(6);
  const { data: ticketData } = useTickets({ status: 'pending', limit: 5 });

  const urgentTickets = useTickets({ priority: 'urgent', limit: 4 });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const s = stats || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const roleMeta = ROLE_LABELS[role] || { label: 'Dashboard', badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 ring-1 ring-slate-500/30' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${roleMeta.badge}`}>
          {roleMeta.label}
        </span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
          {greeting}, {user?.profile?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Here's what's happening at the property today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Tickets"
          value={s.tickets?.active ?? 0}
          icon={WrenchScrewdriverIcon}
          color="blue"
          subtext={`${s.tickets?.total ?? 0} total`}
        />
        <StatCard
          label="Overdue"
          value={s.tickets?.overdue ?? 0}
          icon={ExclamationTriangleIcon}
          color={s.tickets?.overdue > 0 ? 'red' : 'green'}
          subtext="past deadline"
        />
        <StatCard
          label="Pending Approvals"
          value={s.approvals?.pending ?? 0}
          icon={DocumentTextIcon}
          color="amber"
          subtext="quotes awaiting review"
        />
        <StatCard
          label="Monthly Spend"
          value={`R ${(s.finances?.monthly_spend ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={CurrencyPoundIcon}
          color="purple"
          subtext="last 30 days"
        />
      </div>

      {/* Status breakdown + Cost chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Ticket Status Breakdown</h2>
          <div className="space-y-2.5">
            {Object.entries(s.tickets?.by_status || {}).map(([status, count]) => {
              const total = s.tickets?.total || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge value={status} />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!Object.keys(s.tickets?.by_status || {}).length && (
              <p className="text-sm text-slate-400 text-center py-4">No tickets yet</p>
            )}
          </div>
        </div>

        {/* Monthly cost chart */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Monthly Maintenance Spend</h2>
          {costs?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costs} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v) => format(new Date(v + '-01'), 'MMM')}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `R ${v}`} />
                <Tooltip
                  formatter={(v) => [`R ${Number(v).toFixed(2)}`, 'Spend']}
                  labelFormatter={(l) => format(new Date(l + '-01'), 'MMMM yyyy')}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {(costs || []).map((_, i) => (
                    <Cell key={i} fill={i === costs.length - 1 ? '#3b82f6' : '#bfdbfe'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              No payment data yet
            </div>
          )}
        </div>
      </div>

      {/* Bottom two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
          {activity?.length > 0 ? (
            <div className="space-y-3">
              {activity.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-brand-600 text-xs font-bold">
                      {log.user?.full_name?.[0] || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-900 dark:text-slate-100">
                      <span className="font-medium">{log.user?.full_name || 'System'}</span>
                      {' · '}
                      {ACTION_LABELS[log.action] || log.action}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">No activity yet</p>
          )}
        </div>

        {/* Quick actions + pending */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/tickets?create=1" className="flex flex-col items-center gap-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors text-center group">
                <WrenchScrewdriverIcon className="w-5 h-5 text-brand-600" />
                <span className="text-xs font-medium text-brand-700 dark:text-brand-400">New Ticket</span>
              </Link>
              <Link to="/quotes" className="flex flex-col items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 transition-colors text-center">
                <DocumentTextIcon className="w-5 h-5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">View Quotes</span>
              </Link>
              <Link to="/contractors" className="flex flex-col items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 transition-colors text-center">
                <UserGroupIcon className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Contractors</span>
              </Link>
              <Link to="/payments" className="flex flex-col items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 transition-colors text-center">
                <CurrencyPoundIcon className="w-5 h-5 text-purple-600" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Payments</span>
              </Link>
            </div>
          </div>

          {/* Pending tickets snippet */}
          {ticketData?.tickets?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Latest Pending</h2>
                <Link to="/tickets?status=pending" className="text-xs text-brand-600 hover:underline">View all</Link>
              </div>
              <div className="space-y-2">
                {ticketData.tickets.slice(0, 3).map((t) => (
                  <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <Badge value={t.priority} />
                    <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{t.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
