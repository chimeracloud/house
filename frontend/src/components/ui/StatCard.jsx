import clsx from 'clsx';

export default function StatCard({ label, value, subtext, icon: Icon, trend, color = 'blue' }) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green:   'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber:   'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    red:     'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    purple:  'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    slate:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
          {subtext && <p className="text-xs text-slate-500 mt-0.5">{subtext}</p>}
        </div>
        {Icon && (
          <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend && (
        <p className={clsx('text-xs mt-3 font-medium', trend.up ? 'text-emerald-600' : 'text-red-500')}>
          {trend.up ? '↑' : '↓'} {trend.label}
        </p>
      )}
    </div>
  );
}
