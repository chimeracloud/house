import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, UserGroupIcon, PhoneIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

function StarRating({ rating, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        i < Math.round(rating)
          ? <StarSolidIcon key={i} className="w-3.5 h-3.5 text-amber-400" />
          : <StarIcon key={i} className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
      ))}
      {rating && <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>}
    </div>
  );
}

export default function Contractors() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contractors'],
    queryFn: async () => {
      const { data } = await api.get('/contractors');
      return data.contractors;
    },
  });

  const contractors = (data || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Contractors</h1>
          <p className="text-sm text-slate-500">{data?.length ?? 0} registered</p>
        </div>
        <input
          type="text"
          placeholder="Search contractors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-auto max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !contractors.length ? (
        <EmptyState icon={UserGroupIcon} title="No contractors" description="Registered contractors will appear here." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {contractors.map((c) => (
            <Link key={c.id} to={`/contractors/${c.id}`} className="card p-5 hover:shadow-md transition-shadow group block">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 text-brand-700 dark:text-brand-400 font-bold text-sm">
                  {c.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{c.full_name}</p>
                  {c.company_name && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <BuildingOfficeIcon className="w-3 h-3" /> {c.company_name}
                    </p>
                  )}
                  {c.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <PhoneIcon className="w-3 h-3" /> {c.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                {c.avg_rating ? (
                  <div className="flex items-center justify-between">
                    <StarRating rating={c.avg_rating} />
                    <span className="text-xs text-slate-500">{c.completed_jobs} jobs done</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No ratings yet</p>
                )}
                {c.completion_rate !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Completion rate</span>
                      <span>{c.completion_rate}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${c.completion_rate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
