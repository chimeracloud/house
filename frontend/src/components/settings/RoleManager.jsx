import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { db } from '../../lib/firebase';
import { profiles } from '../../lib/data';

const ROLES = ['property_manager', 'property_owner', 'contractor', 'tenant', 'resident', 'admin'];

export default function RoleManager() {
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => profiles.list(),
  });

  const { mutate: setRole, isPending } = useMutation({
    mutationFn: async ({ id, role }) => {
      await updateDoc(doc(db, 'profiles', id), { role, updated_at: serverTimestamp() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update role'),
  });

  const { mutate: setActive } = useMutation({
    mutationFn: async ({ id, is_active }) => {
      await updateDoc(doc(db, 'profiles', id), { is_active, updated_at: serverTimestamp() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update status'),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-xs text-amber-800 dark:text-amber-300">
        <strong>Adding new users:</strong> direct them to <strong>Register</strong> on the login page,
        or create their account in <a className="underline" href="https://console.firebase.google.com" target="_blank" rel="noreferrer">Firebase Console</a>.
        Pending registrations show up in the <strong>Approvals</strong> page in the sidebar.
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs hidden md:table-cell">Phone</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Role</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-[10px]">
                        {u.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-xs text-slate-900 dark:text-white">{u.full_name || u.email || u.id}</p>
                      {u.email && <p className="text-[10px] text-slate-400">{u.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-500">{u.phone || '—'}</td>
                <td className="px-4 py-2.5">
                  <select
                    className="input py-1 text-xs"
                    value={u.role || ''}
                    disabled={isPending}
                    onChange={(e) => setRole({ id: u.id, role: e.target.value })}
                  >
                    <option value="">— pick role —</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => setActive({ id: u.id, is_active: !u.is_active })}
                    className={clsx(
                      'badge text-xs cursor-pointer',
                      u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {u.is_active ? 'Active' : (u.approval_status || 'Inactive')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
