import clsx from 'clsx';

const statusConfig = {
  pending:              { label: 'Pending',             cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  awaiting_quote:       { label: 'Awaiting Quote',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  approved:             { label: 'Approved',            cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  in_progress:          { label: 'In Progress',         cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' },
  awaiting_inspection:  { label: 'Awaiting Inspection', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  completed:            { label: 'Completed',           cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  rejected:             { label: 'Rejected',            cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  paid:                 { label: 'Paid',                cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  // quote statuses
  submitted:            { label: 'Submitted',           cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  pending_owner_approval: { label: 'Pending Approval',  cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  expired:              { label: 'Expired',             cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  // priority
  low:                  { label: 'Low',                 cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
  medium:               { label: 'Medium',              cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  high:                 { label: 'High',                cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  urgent:               { label: 'Urgent',              cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  // payment
  authorized:           { label: 'Authorized',         cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
};

export default function Badge({ value, className }) {
  const cfg = statusConfig[value] || { label: value, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={clsx('badge', cfg.cls, className)}>
      {cfg.label}
    </span>
  );
}
