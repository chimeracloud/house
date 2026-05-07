import { useState } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ArrowDownTrayIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import { useDashboardStats, useCosts } from '../hooks/useDashboard';
import { useContractors } from '../hooks/useContractors';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const PRIORITY_COLORS = { low: '#94a3b8', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444' };

export default function Reports() {
  const [months, setMonths] = useState(6);
  const { data: stats } = useDashboardStats();
  const { data: costs } = useCosts(months);

  const { data: contractorData } = useContractors();

  const statusData = Object.entries(stats?.tickets?.by_status || {}).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(stats?.tickets?.by_priority || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: PRIORITY_COLORS[name],
  }));

  const topContractors = (contractorData || [])
    .filter((c) => c.avg_rating)
    .sort((a, b) => b.avg_rating - a.avg_rating)
    .slice(0, 5);

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Tickets', stats?.tickets?.total || 0],
      ['Active Tickets', stats?.tickets?.active || 0],
      ['Overdue Tickets', stats?.tickets?.overdue || 0],
      ['Monthly Spend (£)', stats?.finances?.monthly_spend?.toFixed(2) || '0'],
      ['Pending Payments (£)', stats?.finances?.pending_payments?.toFixed(2) || '0'],
      ['Registered Contractors', stats?.contractors?.total || 0],
      ['Pending Approvals', stats?.approvals?.pending || 0],
      ...Object.entries(stats?.tickets?.by_status || {}).map(([s, v]) => [`Status: ${s}`, v]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `house-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Property maintenance overview</p>
        </div>
        <div className="flex gap-2">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="input w-auto text-sm">
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button onClick={exportCSV} className="btn-secondary text-sm">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tickets" value={stats?.tickets?.total ?? 0} color="blue" icon={ChartBarIcon} />
        <StatCard label="Active" value={stats?.tickets?.active ?? 0} color="amber" />
        <StatCard label="Overdue" value={stats?.tickets?.overdue ?? 0} color="red" />
        <StatCard
          label="Total Spend"
          value={`£${(stats?.finances?.monthly_spend ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}
          color="green"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Monthly Maintenance Spend</h2>
          {costs?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v) => format(new Date(v + '-01'), 'MMM yy')}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  formatter={(v) => [`£${Number(v).toFixed(2)}`, 'Total Spend']}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-16">No payment data available</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Tickets by Status</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [v, n.replace(/_/g, ' ')]}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Legend
                  formatter={(v) => v.replace(/_/g, ' ')}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-16">No ticket data yet</p>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Tickets by Priority</h2>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={55} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-14">No data yet</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Top Rated Contractors</h2>
          {topContractors.length > 0 ? (
            <div className="space-y-3">
              {topContractors.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{c.full_name}</p>
                    <p className="text-xs text-slate-500">{c.company_name} · {c.completed_jobs} jobs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-500">{c.avg_rating?.toFixed(1)}</p>
                    <p className="text-xs text-slate-400">/5.0</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-14">No rated contractors yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
