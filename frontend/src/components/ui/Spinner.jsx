import clsx from 'clsx';

export default function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8', xl: 'w-12 h-12' };
  return (
    <div className={clsx(
      'animate-spin rounded-full border-2 border-slate-200 border-t-brand-600',
      sizes[size], className
    )} />
  );
}

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="xl" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}
